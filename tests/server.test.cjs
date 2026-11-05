const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');

test('local server serves application, blocks project files, handles optional config',async()=>{
  const child=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,PORT:'31389'}});
  try{
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited before readiness')}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server did not start')),5000).unref())]);
    const base='http://127.0.0.1:31389';
    const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Iskra/);
    const config=await fetch(base+'/config.local.js');assert.equal(config.status,200);
    assert.equal((await fetch(base+'/.env')).status,403);
    assert.equal((await fetch(base+'/.git/config')).status,403);
    assert.equal((await fetch(base+'/README.md')).status,404);
    assert.equal((await fetch(base+'/index.html',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/board-core.js')).status,200);
  }finally{if(child.exitCode===null){child.kill();await once(child,'exit')}}
});
