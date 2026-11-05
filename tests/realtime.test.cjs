const {test}=require('node:test');
const assert=require('node:assert/strict');
const {connectRealtime}=require('../dist/realtime.js');

test('Realtime joins, receives invalidation, broadcasts no board contents, closes',()=>{
  let ws,changes=0,connected=false;
  class Socket {
    constructor(url){this.url=url;this.readyState=1;this.sent=[];ws=this}
    send(message){this.sent.push(JSON.parse(message))}
    close(){this.readyState=3;this.onclose?.()}
  }
  const client=connectRealtime({url:'https://example.supabase.co',key:'sb_publishable_test',topic:'test-hash',
    onChange:()=>changes++,onStatus:s=>connected=s,WebSocketImpl:Socket});
  ws.onopen();assert.equal(ws.sent[0].event,'phx_join');
  ws.onmessage({data:JSON.stringify({topic:'realtime:test-hash',event:'phx_reply',ref:'1',payload:{status:'ok'}})});
  assert.equal(connected,true);assert.equal(changes,1);
  ws.onmessage({data:JSON.stringify({topic:'realtime:other',event:'broadcast',payload:{event:'changed'}})});
  assert.equal(changes,1);
  ws.onmessage({data:JSON.stringify({topic:'realtime:test-hash',event:'broadcast',payload:{event:'changed'}})});
  assert.equal(changes,2);client.notify();
  assert.deepEqual(ws.sent.at(-1).payload,{type:'broadcast',event:'changed',payload:{}});
  client.close();assert.equal(connected,false);
});
