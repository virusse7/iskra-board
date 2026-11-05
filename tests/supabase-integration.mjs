// Creates two isolated test rooms. Does not change schema, RLS or existing boards.
import { readFile } from 'node:fs/promises';
import { randomBytes,createHash } from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {connectRealtime}=require('../dist/realtime.js');
const context={window:{}};vm.createContext(context);
vm.runInContext(await readFile(new URL('../dist/config.js',import.meta.url),'utf8'),context);
try{vm.runInContext(await readFile(new URL('../dist/config.local.js',import.meta.url),'utf8'),context)}catch(e){if(e.code!=='ENOENT')throw e}
const {supabaseUrl,publishableKey}=context.window.ISKRA_CONFIG;
assert.ok(publishableKey.startsWith('sb_publishable_'),'Only public publishable keys are supported');
const token=randomBytes(32).toString('hex'),other=randomBytes(32).toString('hex');
const endpoint=supabaseUrl+'/rest/v1/';
async function call(room,operations=[]){
  const r=await fetch(endpoint+'rpc/iskra_sync',{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({room_token:room,operations}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error(`RPC HTTP ${r.status}`);
  return r.json();
}
const op=(path,value)=>({path,value});
const node=(id,text)=>Object.entries({id,text,x:50,y:60,color:'#f5edb4'}).map(([key,value])=>op(['nodes',id,key],value));
let a,b;
try{
  await call(token);await call(other);
  await call(token,[...node('test-a','Pierwsza osoba'),...node('test-b','Druga osoba'),op(['edges','test-a_test-b'],['test-a','test-b'])]);
  await call(token,[op(['nodes','test-a','x'],300),op(['nodes','test-a','title'],'Mechanika walki')]);
  await call(token,[op(['nodes','test-b','text'],'Zmieniono')]);
  const state=await call(token);
  assert.equal(state.nodes['test-a'].x,300);assert.equal(state.nodes['test-a'].title,'Mechanika walki');assert.equal(state.nodes['test-b'].text,'Zmieniono');
  assert.deepEqual(state.edges['test-a_test-b'],['test-a','test-b']);
  assert.deepEqual((await call(other)).nodes,{});
  console.log('PASS: shared read/write, independent edits, edge persistence, room isolation');
  for(const method of ['GET','POST','PATCH']){
    const r=await fetch(endpoint+'iskra_rooms?token_hash=eq.invalid',{method,headers:{apikey:publishableKey,'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{}'}),signal:AbortSignal.timeout(10000)});
    assert.ok([401,403].includes(r.status),`Direct ${method} table access must be denied`);
  }
  await assert.rejects(()=>call(null));
  await assert.rejects(()=>call('invalid'));
  await assert.rejects(()=>call(token,[op(['forbidden'],'bad')]));
  console.log('PASS: direct SELECT/INSERT/UPDATE denied, invalid keys and paths rejected');
  const topic='iskra-'+createHash('sha256').update('iskra-realtime-v1:'+token).digest('hex');
  let gotChange;
  function joined(){
    let resolve,reject;
    const ready=new Promise((yes,no)=>{resolve=yes;reject=no});
    const timer=setTimeout(()=>reject(Error('Realtime subscription timed out')),15000);
    const client=connectRealtime({url:supabaseUrl,key:publishableKey,topic,
      onChange:()=>gotChange?.(),onStatus:ok=>{if(ok){clearTimeout(timer);resolve()}}});
    return {client,ready};
  }
  const first=joined();a=first.client;const second=joined();b=second.client;
  await Promise.all([first.ready,second.ready]);
  const received=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Realtime invalidation timed out')),10000);
    gotChange=()=>{clearTimeout(timer);resolve()};
  });
  await call(token,[op(['nodes','test-a','text'],'Realtime verified')]);
  a.notify();await received;
  assert.equal((await call(token)).nodes['test-a'].text,'Realtime verified');
  console.log('PASS: two actual Realtime WebSocket clients receive invalidation and reload persisted data');
  a.close();b.close();a=b=null;
  // A new connection represents returning online; its initial onChange requests a fresh read.
  const reconnected=joined();b=reconnected.client;await reconnected.ready;
  assert.equal((await call(token)).nodes['test-a'].text,'Realtime verified');
  console.log('PASS: reconnect and persisted read');
  await call(token,[op(['edges','test-a_test-b'],null),op(['nodes','test-a'],null),op(['nodes','test-b'],null)]);
  const final=await call(token);assert.equal(final.nodes['test-a'],null);assert.equal(final.edges['test-a_test-b'],null);
  console.log('PASS: removal of test nodes and edge; empty test-room records remain');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1}
finally{a?.close();b?.close()}
