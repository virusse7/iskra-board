const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {parseRoom,normalize,denormalize,diff,overlay}=require('../dist/board-core.js');
const token='a'.repeat(64);
const node={id:'node-a',text:'Myśl',x:10,y:20,color:'#f5edb4'};
const board=()=>({title:'Test',nodes:[{...node}],edges:[]});

test('link from another computer/port and bare key join the same room',()=>{
  assert.equal(parseRoom(token),token);
  assert.equal(parseRoom(`http://localhost:3999/#room=${token}`),token);
  assert.equal(parseRoom(`https://example.com/old-path/#room=${token}`),token);
  assert.throws(()=>parseRoom('javascript:alert(1)'));
  assert.throws(()=>parseRoom('abc'));
  assert.throws(()=>parseRoom('https://example.com/#room=abc'));
});
test('different fields edited by two instances survive merging',()=>{
  const before=normalize(board());
  const a=structuredClone(before),b=structuredClone(before);
  a.nodes['node-a'].x=500;b.nodes['node-a'].text='Druga osoba';
  const merged=overlay(overlay(structuredClone(before),diff(before,a)),diff(before,b));
  assert.equal(merged.nodes['node-a'].x,500);
  assert.equal(merged.nodes['node-a'].text,'Druga osoba');
});
test('node/edge creation and deletion, replay is idempotent',()=>{
  const before=normalize(board()),after=board();
  after.nodes.push({...node,id:'node-b'});after.edges.push(['node-a','node-b']);
  const ops=diff(before,normalize(after));
  const state=overlay(structuredClone(before),ops);
  assert.deepEqual(denormalize(state),after);
  assert.deepEqual(overlay(structuredClone(state),ops),state);
  const deletion=diff(normalize(after),normalize({title:'Test',nodes:[node],edges:[]}));
  assert.deepEqual(denormalize(overlay(state,deletion)),board());
});
test('pending offline operations survive a remote snapshot and deleted endpoints are hidden',()=>{
  const remote=normalize(board());
  const local=board();local.nodes[0].text='Offline';
  const pending=diff(remote,normalize(local));
  remote.nodes['node-a'].x=100;
  const merged=denormalize(overlay(remote,pending));
  assert.equal(merged.nodes[0].text,'Offline');assert.equal(merged.nodes[0].x,100);
  remote.edges.bad=['node-a','gone'];assert.equal(denormalize(remote).edges.length,0);
});
test('untrusted object keys do not pollute prototypes',()=>{
  overlay({nodes:{},edges:{}},[{path:['nodes','__proto__','text'],value:'payload'}]);
  assert.equal({}.text,undefined);
});
test('all inline and application scripts have valid syntax',()=>{
  const html=readFileSync('dist/index.html','utf8');
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  for(const file of ['config','rooms','sync','board-core','realtime','theme'])new vm.Script(readFileSync(`dist/${file}.js`,'utf8'));
  assert.ok(html.includes('width:4800px;height:3600px'));
});

 test('custom idea titles survive normalization, field merges and export/import',()=>{
  const before=normalize(board()),after=board();after.nodes[0].title='Mechanika walki';
  const ops=diff(before,normalize(after));
  assert.deepEqual(ops,[{path:['nodes','node-a','title'],value:'Mechanika walki'}]);
  const remote=structuredClone(before);remote.nodes['node-a'].text='Opis wspólnika';
  const result=denormalize(overlay(remote,ops));
  assert.equal(result.nodes[0].title,'Mechanika walki');assert.equal(result.nodes[0].text,'Opis wspólnika');
  assert.equal(JSON.parse(JSON.stringify(result)).nodes[0].title,'Mechanika walki');
  assert.equal(denormalize(before).nodes.length,1);
});
