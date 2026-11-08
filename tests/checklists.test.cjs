const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../dist/board-core.js');
const node={id:'one',text:'Existing text',x:10,y:20,color:'#f5edb4'};
const board=n=>({title:'Board',nodes:[n],edges:[]});
test('checklists are optional and progress counts live tasks',()=>{
  assert.equal(core.validNode(node),true);assert.deepEqual(core.progress(node),{done:0,total:0});
  const n={...node,checklist:{a:{text:'First',done:true,order:1},b:{text:'Second',done:false,order:2},gone:null}};
  assert.equal(core.validNode(n),true);assert.deepEqual(core.progress(n),{done:1,total:2});
  assert.equal(core.validChecklist({a:{text:'invalid',done:'yes',order:1}}),false);
  assert.equal(core.validChecklist({a:{text:'x'.repeat(2001),done:false,order:1}}),false);
});
test('different task fields merge without replacing the list',()=>{
  const old=core.normalize(board({...node,checklist:{a:{text:'First',done:false,order:1}}}));
  const a=structuredClone(old),b=structuredClone(old);
  a.nodes.one.checklist.a.text='Edited';b.nodes.one.checklist.a.done=true;
  const changesA=core.diff(old,a),changesB=core.diff(old,b);
  assert.deepEqual(changesA,[{path:['nodes','one','checklist','a','text'],value:'Edited'}]);
  const merged=core.overlay(core.overlay(old,changesA),changesB);
  assert.deepEqual(merged.nodes.one.checklist.a,{text:'Edited',done:true,order:1});
});
test('concurrent additions have distinct ids and deletions use tombstones',()=>{
  const old=core.normalize(board({...node,checklist:{}})),a=structuredClone(old),b=structuredClone(old);
  a.nodes.one.checklist.a={text:'A',done:false,order:1};b.nodes.one.checklist.b={text:'B',done:false,order:1};
  const merged=core.overlay(core.overlay(structuredClone(old),core.diff(old,a)),core.diff(old,b));
  assert.equal(Object.keys(merged.nodes.one.checklist).length,2);
  const deleted=structuredClone(merged);deleted.nodes.one.checklist.a=null;
  assert.deepEqual(core.diff(merged,deleted),[{path:['nodes','one','checklist','a'],value:null}]);
  assert.equal(core.denormalize(merged).nodes[0].text,'Existing text');
});

test('large Unicode checklists are split into request batches below the RPC payload limit',()=>{
  const pending=Array.from({length:500},(_,i)=>({path:['nodes','one','checklist','task-'+i],value:{text:'🌱'.repeat(1000),done:false,order:i}}));
  const batch=core.selectBatch(pending);assert.ok(batch.length>0&&batch.length<500);
  assert.ok(new TextEncoder().encode(JSON.stringify(batch)).length<750000);
});

test('completed tasks move after unfinished tasks and restore original order when unchecked',()=>{
  const n={...node,checklist:{
    a:{text:'Start',done:true,order:1},
    b:{text:'Prepare',done:false,order:2},
    c:{text:'Review',done:false,order:3},
    d:{text:'Finish',done:true,order:4},
    removed:null
  }};
  assert.deepEqual(core.checklistItems(n).map(([id])=>id),['b','c','a','d']);
  n.checklist.a.done=false;
  assert.deepEqual(core.checklistItems(n).map(([id])=>id),['a','b','c','d']);
  n.checklist.c.done=true;
  assert.deepEqual(core.checklistItems(n).map(([id])=>id),['a','b','c','d']);
  n.checklist.b.done=true;
  assert.deepEqual(core.checklistItems(n).map(([id])=>id),['a','b','c','d']);
  n.checklist.b.done=false;
  assert.deepEqual(core.checklistItems(n).map(([id])=>id),['a','b','c','d']);
  assert.deepEqual(core.progress(n),{done:2,total:4});
});
test('completion order affects rendering, not serialized task metadata',()=>{
  const n={...node,checklist:{
    first:{text:'First',done:false,order:1},
    second:{text:'Second',done:false,order:2}
  }};
  const before=core.normalize(board(structuredClone(n)));
  n.checklist.first.done=true;
  assert.deepEqual(core.checklistItems(n).map(([id])=>id),['second','first']);
  assert.deepEqual(core.diff(before,core.normalize(board(n))),[
    {path:['nodes','one','checklist','first','done'],value:true}
  ]);
  assert.equal(n.checklist.first.order,1);
});
