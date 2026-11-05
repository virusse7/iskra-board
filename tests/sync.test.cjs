const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const core=require('../dist/board-core.js');

function harness(){
  let server={title:'Shared',nodes:{},edges:{}},fail=false,id=0;
  const tasks=new Map(),storage=new Map(),events={};
  const elements=new Map();
  const element=()=>({textContent:'',className:'',style:{},addEventListener(name,fn){events['board:'+name]=fn},remove(){}});
  const document={activeElement:null,hidden:false,getElementById(key){if(!elements.has(key))elements.set(key,element());return elements.get(key)},createElement:element,querySelector:()=>({insertBefore(){}}),querySelectorAll:()=>[],addEventListener(name,fn){events[name]=fn}};
  const context={document,IskraCore:core,structuredClone,AbortSignal,TextEncoder,Uint8Array,URLSearchParams,
    crypto:{subtle:{digest:async()=>new ArrayBuffer(32)}},
    window:{ISKRA_CONFIG:{supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test'},addEventListener(name,fn){events[name]=fn}},
    location:{hash:'#room='+'a'.repeat(64)},history:{replaceState(){}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    data:{title:'Local',nodes:[],edges:[]},drag:null,resizing:null,mode:'move',render(){},stats(){},toast(){},
    setTimeout(fn){tasks.clear();tasks.set(++id,fn);return id},clearTimeout(key){tasks.delete(key)},
    IskraRealtime:{connectRealtime(){return {notify(){},close(){}}}},
    async fetch(url,options){
      if(fail)throw Error('offline');
      const {operations}=JSON.parse(options.body);server=core.overlay(server,operations);
      return {ok:true,json:async()=>structuredClone(server)};
    }};
  vm.createContext(context);vm.runInContext(readFileSync('dist/sync.js','utf8'),context);
  return {context,events,storage,setFail(value){fail=value},server:()=>server,
    async tick(){await Promise.resolve();const item=tasks.entries().next().value;assert.ok(item,'expected scheduled sync');tasks.delete(item[0]);await item[1]()}};
}
test('actual sync queue retries offline writes and restores cached pending operations',async()=>{
  const h=harness();await h.tick();h.setFail(true);
  h.context.data.nodes.push({id:'new',text:'offline',x:1,y:2,color:'#f5edb4'});h.context.save();await h.tick();
  assert.equal(h.server().nodes.new,undefined);
  const cache=JSON.parse([...h.storage.values()][0]);assert.ok(cache.pending.length>0);
  h.setFail(false);await h.tick();assert.equal(h.server().nodes.new.text,'offline');
  assert.equal(JSON.parse([...h.storage.values()][0]).pending.length,0);
});
test('remote changes during active editing are fetched fresh after blur, not stale snapshots',async()=>{
  const h=harness();await h.tick();
  h.context.document.activeElement={id:'title',tagName:'INPUT'};
  h.context.data.title='Local edit';h.context.save();await h.tick();
  assert.equal(h.server().title,'Local edit');
  h.server().title='Newer remote edit';
  h.context.document.activeElement=null;h.events.focusout();await h.tick();
  assert.equal(h.context.data.title,'Newer remote edit');
});
