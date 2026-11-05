const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const core=require('../dist/board-core.js');

function access(hash,remembered){
  const elements=new Map(),storage=new Map(remembered?[['iskra-active-room',remembered]]:[]);
  const make=()=>({style:{},inert:false,hidden:false,textContent:'',setAttribute(){},append(){},insertBefore(){}});
  const document={querySelector(selector){if(!elements.has(selector))elements.set(selector,make());return elements.get(selector)},getElementById(id){return this.querySelector('#'+id)},createElement:make,body:make()};
  const context={document,window:{ISKRA_CONFIG:{shareBaseUrl:'https://virusse7.github.io/iskra-board/'}},IskraCore:core,URLSearchParams,location:{hash,href:'http://localhost:3000/'},history:{replaceState(a,b,value){context.location.hash=value}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},toast(){},navigator:{clipboard:{async writeText(text){context.copied=text}}}};
  vm.runInNewContext(readFileSync('dist/rooms.js','utf8'),context);
  return {context,elements,storage};
}
test('missing key locks editing; no key or board is generated',()=>{
  const {context,elements}=access('');
  assert.equal(context.window.ISKRA_ACCESS.token,null);
  assert.equal(elements.get('header').inert,true);
  assert.ok(!elements.get('section')?.innerHTML?.includes('newRoom'));
});
test('valid link is remembered only after successful authorization; sharing uses Pages path',async()=>{
  const key='a'.repeat(64),h=access('#room='+key);
  assert.equal(h.storage.has('iskra-active-room'),false);
  h.context.window.ISKRA_ACCESS.unlock();
  assert.equal(h.storage.get('iskra-active-room'),key);
  await h.context.document.getElementById('shareRoom').onclick();
  assert.equal(h.context.copied,`https://virusse7.github.io/iskra-board/#room=${key}`);
});
test('remembered key restores a link; invalid explicit link cannot silently use remembered key',()=>{
  const remembered='a'.repeat(64);
  assert.equal(access('',remembered).context.location.hash,'#room='+remembered);
  assert.equal(access('#room=wrong',remembered).context.window.ISKRA_ACCESS.token,null);
});
