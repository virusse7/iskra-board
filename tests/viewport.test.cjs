const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {worldPoint}=require('../dist/viewport.js');
test('world coordinates use a fixed 100% scale',()=>{
  assert.deepEqual(worldPoint(200,150,{left:400,top:300}),{x:600,y:450});
  assert.doesNotMatch(readFileSync('dist/index.html','utf8'),/id="(?:zoomIn|zoomOut|zoomValue|resetView)"/);
});
function harness(mode='move'){
  const listeners={},controls={};const captures=new Set();
  const viewport={scrollLeft:0,scrollTop:0,clientWidth:1000,clientHeight:700,style:{},getBoundingClientRect:()=>({left:0,top:0}),addEventListener(name,fn){listeners[name]=fn},setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),dispatchEvent(){}};
  const context={Map,Math,structuredClone,CustomEvent:class{},document:{getElementById:id=>controls[id]??=( {textContent:'',disabled:false})}};
  vm.runInNewContext(readFileSync('dist/viewport.js','utf8'),context);
  const node={id:'one',x:100,y:100},board={style:{}},world={style:{}};let commits=0;
  const view=context.IskraViewport.mount({viewport,board,world,getNode:()=>node,getMode:()=>mode,onMove:(id,x,y)=>Object.assign(node,{x,y}),onResize:(id,width,height)=>Object.assign(node,{width,height}),onCommit(){commits++},onRollback:(id,original)=>Object.assign(node,original),onSelect(){},onLink(){},onInteraction(){}});
  function event(type,x,y,id=1,target={closest:()=>null},pointerType='touch'){
    const e={type,clientX:x,clientY:y,pointerId:id,pointerType,button:0,target,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){}};
    listeners[type](e);return e;
  }
  return {view,node,board,controls,viewport,event,listeners,commits:()=>commits};
}
test('one finger pans while second finger cannot zoom',()=>{
  const h=harness();h.viewport.scrollLeft=300;h.viewport.scrollTop=300;
  h.event('pointerdown',100,100);h.event('pointermove',150,120);h.event('pointerup',150,120);
  assert.equal(h.viewport.scrollLeft,250);assert.equal(h.viewport.scrollTop,280);
  h.event('pointerdown',100,100,1);h.event('pointerdown',200,100,2);h.event('pointermove',300,100,2);
  assert.equal(h.viewport.scrollLeft,250);h.event('pointerup',200,100,2);h.event('pointerup',100,100,1);
  assert.equal(h.view.read().scale,undefined);assert.equal(h.board.style.transform,undefined);
});
test('dragging a card uses unchanged coordinates and saves',()=>{
  const h=harness(),card={dataset:{id:'one'}},target={closest:s=>s==='.card'?card:null};
  h.event('pointerdown',200,200,1,target,'mouse');h.event('pointermove',300,260,1,target,'mouse');
  h.event('pointerup',300,260,1,target,'mouse');
  assert.equal(h.node.x,200);assert.equal(h.node.y,160);assert.equal(h.commits(),1);
});
test('touch card move and resize preserve actual distances',()=>{
  const h=harness(),card={dataset:{id:'one'}},target={closest:s=>s==='.card'?card:null};
  h.event('pointerdown',50,50,1,target);h.event('pointermove',100,100,1,target);h.event('pointerup',100,100,1,target);
  assert.equal(h.node.x,150);assert.equal(h.node.y,150);
  const resize={closest:s=>s==='.card'?card:s==='.resize-handle'?{}:null};
  h.event('pointerdown',500,500,2,resize);h.event('pointermove',580,540,2,resize);h.event('pointerup',580,540,2,resize);
  assert.equal(h.node.width,310);assert.equal(h.node.height,234);
});
test('mouse wheel pans and trackpad pinch does not zoom',()=>{
  const h=harness();h.viewport.scrollTop=100;h.viewport.scrollLeft=40;
  const wheel=(dy,opts={})=>{
    const e={deltaX:0,deltaY:dy,deltaMode:0,ctrlKey:!!opts.ctrlKey,shiftKey:!!opts.shiftKey,
      target:{closest:()=>null},preventDefault(){this.prevented=true}};
    h.listeners.wheel(e);return e;
  };
  assert.equal(wheel(60).prevented,true);assert.equal(h.viewport.scrollTop,160);
  wheel(20,{shiftKey:true});assert.equal(h.viewport.scrollLeft,60);
  wheel(-200,{ctrlKey:true});assert.equal(h.viewport.scrollTop,160);
});
test('eraser lets users tap links',()=>{
  const h=harness('erase'),path={},target={closest:s=>s==='path'?path:null};
  assert.equal(h.event('pointerdown',100,100,1,target,'mouse').defaultPrevented,undefined);
});
