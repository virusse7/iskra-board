const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {clampZoom,zoomAt,worldPoint}=require('../dist/viewport.js');
test('zoom is clamped and preserves the world point under the cursor',()=>{
  const before={scale:1,left:400,top:300},world=worldPoint(200,150,before);
  const after=zoomAt(before,2,200,150);
  assert.deepEqual(worldPoint(200,150,after),world);
  assert.equal(clampZoom(.01),.25);assert.equal(clampZoom(9),2.5);
  assert.equal((worldPoint(400,200,{scale:2,left:0,top:0})).x,200);
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
  return {view,node,controls,viewport,event,listeners,document:context.document,commits:()=>commits};
}
test('single-finger background pan and two-finger pinch do not change note coordinates',()=>{
  const h=harness();h.viewport.scrollLeft=300;h.viewport.scrollTop=300;
  h.event('pointerdown',100,100);h.event('pointermove',150,120);h.event('pointerup',150,120);
  assert.equal(h.viewport.scrollLeft,250);assert.equal(h.viewport.scrollTop,280);
  const original={...h.node};h.event('pointerdown',100,100,1);h.event('pointerdown',200,100,2);h.event('pointermove',300,100,2);
  assert.equal(h.view.read().scale,2);assert.deepEqual(h.node,original);
  h.event('pointerup',300,100,2);h.event('pointerup',100,100,1);
});
test('dragging at 200% converts screen distance into world distance',()=>{
  const h=harness();h.view.zoom(2,0,0);
  const card={dataset:{id:'one'}},target={closest:selector=>selector==='.card'?card:null};
  h.event('pointerdown',200,200,1,target,'mouse');h.event('pointermove',300,260,1,target,'mouse');h.event('pointerup',300,260,1,target,'mouse');
  assert.equal(h.node.x,150);assert.equal(h.node.y,130);assert.equal(h.commits(),1);
});
test('starting a pinch cancels an uncommitted card drag',()=>{
  const h=harness(),original={...h.node};
  const card={dataset:{id:'one'}},target={closest:selector=>selector==='.card'?card:null};
  h.event('pointerdown',100,100,1,target);h.event('pointermove',140,140,1,target);
  h.event('pointerdown',200,100,2);
  assert.deepEqual(h.node,original);assert.equal(h.commits(),0);
});

test('eraser leaves line taps available instead of capturing them as background drags',()=>{
  const h=harness('erase'),path={};const target={closest:selector=>selector==='path'?path:null};
  const event=h.event('pointerdown',100,100,1,target,'mouse');
  assert.equal(event.defaultPrevented,undefined);
});

test('touch dragging and resizing use world units at different zoom levels',()=>{
  const h=harness();h.view.zoom(.5,0,0);
  const card={dataset:{id:'one'}},target={closest:selector=>selector==='.card'?card:null};
  h.event('pointerdown',50,50,1,target);h.event('pointermove',100,100,1,target);h.event('pointerup',100,100,1,target);
  assert.equal(h.node.x,200);assert.equal(h.node.y,200);
  h.view.zoom(2.5,0,0);
  const grip={closest:selector=>selector==='.card'?card:selector==='.resize-handle'?{}:null};
  h.event('pointerdown',500,500,2,grip);h.event('pointermove',750,625,2,grip);h.event('pointerup',750,625,2,grip);
  assert.equal(h.node.width,330);assert.equal(h.node.height,244);
});

test('wheel zooms at the edge of a focused card scroller',()=>{
  const h=harness();h.document.activeElement={};
  let offset=0;
  const scroller={contains:()=>true,get scrollTop(){return offset},set scrollTop(value){offset=Math.min(100,Math.max(0,value))}};
  const e={clientX:100,clientY:100,deltaMode:0,deltaX:0,deltaY:100,target:{closest:s=>s==='.card-content'?scroller:null},preventDefault(){}};
  h.listeners.wheel(e);assert.equal(h.view.read().scale,1);
  h.listeners.wheel(e);assert.ok(h.view.read().scale<1);
});
test('Safari gesture zoom uses the starting scale and does not also process wheel',()=>{
  const h=harness(),e={clientX:0,clientY:0,preventDefault(){}};
  h.listeners.gesturestart(e);
  h.listeners.gesturechange({...e,scale:1.5});
  h.listeners.gesturechange({...e,scale:2});
  h.listeners.wheel({...e,ctrlKey:true,deltaMode:0,deltaY:-50,deltaX:0});
  assert.equal(h.view.read().scale,2);
  h.listeners.gestureend(e);
});
test('drag commit uses the current cloud save handler rather than the browser-only startup handler',()=>{
  const source=readFileSync('dist/app.js','utf8');
  const mountCall=source.match(/const boardView=IskraViewport\.mount\(\{[\s\S]*?\}\);window\.IskraView=boardView;/);
  assert.ok(mountCall,'viewport.mount callback must be present');
  const context={
    window:{result:[]},viewport:{},board:{},$:()=>({}),
    IskraViewport:{mount:({onCommit})=>({onCommit})},
    document:{dispatchEvent(){}},
    Event:class {}
  };
  vm.createContext(context);
  vm.runInContext(`
    let data={nodes:[]},mode='move',drag=null,resizing=null;
    function save(){window.result.push('local-only')}
    function positionCard(){}
    function sizeCard(){}
    function choose(){}
    function link(){}
    function lines(){}
    ${mountCall[0]}
    // Supabase replaces save after app initialization.
    save=function(){window.result.push('supabase')}
    window.IskraView.onCommit();
  `,context);
  assert.deepEqual(context.window.result,['supabase']);
});
