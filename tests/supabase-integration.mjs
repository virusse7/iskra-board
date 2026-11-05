// Read-only production probe. No room key is needed or stored.
// Detailed allowed-key writes are covered by PostgreSQL tests; unknown keys MUST fail.
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c={window:{}};vm.createContext(c);
vm.runInContext(await readFile(new URL('../dist/config.js',import.meta.url),'utf8'),c);
const {supabaseUrl,publishableKey}=c.window.ISKRA_CONFIG;
assert.ok(publishableKey.startsWith('sb_publishable_'));
const unknown=randomBytes(32).toString('hex');
for(const operations of [[],[{path:['title'],value:'unauthorized probe'}]]){
  const r=await fetch(supabaseUrl+'/rest/v1/rpc/iskra_sync',{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({room_token:unknown,operations}),signal:AbortSignal.timeout(15000)});
  assert.ok([401,403].includes(r.status),'Unknown key must be denied');
  const body=await r.json();assert.equal(body.code,'42501');
}
console.log('PASS: unknown key cannot read, write or implicitly create a board through RPC');
for(const table of ['iskra_rooms','iskra_active_board'])for(const method of ['GET','POST','PATCH','DELETE']){
  const r=await fetch(supabaseUrl+'/rest/v1/'+table+'?'+(table==='iskra_rooms'?'token_hash=eq.invalid':'singleton=eq.false'),{method,headers:{apikey:publishableKey,'Content-Type':'application/json'},...(['GET','DELETE'].includes(method)?{}:{body:'{}'}),signal:AbortSignal.timeout(10000)});
  assert.ok([401,403].includes(r.status),`Direct ${method} access to ${table} must be denied`);
}
console.log('PASS: direct reads and writes to both protected tables denied');
