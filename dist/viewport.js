(function(root){
  const clampZoom=value=>Math.max(.25,Math.min(2.5,value));
  function zoomAt(view,scale,x,y){
    scale=clampZoom(scale);const ratio=scale/view.scale;
    return {scale,left:Math.max(0,(view.left+x)*ratio-x),top:Math.max(0,(view.top+y)*ratio-y)};
  }
  const worldPoint=(x,y,view)=>({x:(view.left+x)/view.scale,y:(view.top+y)/view.scale});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function mount({viewport,board,world,onMove,onResize,onCommit,onRollback,onSelect,onLink,getMode,getNode,onInteraction}){
    let scale=1,gesture=null,pinch=null,safariPinch=null,suppressTap=false;
    const points=new Map();
    const read=()=>({scale,left:viewport.scrollLeft,top:viewport.scrollTop});
    const local=(x,y)=>{const r=viewport.getBoundingClientRect();return {x:x-r.left,y:y-r.top}};
    const toWorld=(x,y)=>{const p=local(x,y);return worldPoint(p.x,p.y,read())};
    function apply(next){
      scale=next.scale;world.style.width=4800*scale+'px';world.style.height=3600*scale+'px';
      board.style.transform=`scale(${scale})`;viewport.scrollLeft=next.left;viewport.scrollTop=next.top;
      document.getElementById('zoomValue').textContent=Math.round(scale*100)+'%';
      viewport.style.backgroundSize=22*scale+'px '+22*scale+'px';
      document.getElementById('zoomOut').disabled=scale<=.25;
      document.getElementById('zoomIn').disabled=scale>=2.5;
    }
    function zoom(value,x=viewport.clientWidth/2,y=viewport.clientHeight/2){apply(zoomAt(read(),value,x,y))}
    function finish(cancel=false){
      if(gesture&&['move','resize'].includes(gesture.kind)){
        if(cancel)onRollback(gesture.id,gesture.original);else if(gesture.changed)onCommit();
      }
      gesture=null;onInteraction(false);board.style.cursor='grab';
    }
    function startPinch(){
      document.activeElement?.blur?.();
      finish(true);safariPinch=null;suppressTap=true;
      const [a,b]=[...points.values()],center=local((a.x+b.x)/2,(a.y+b.y)/2);
      pinch={distance:Math.max(1,distance(a,b)),scale,anchor:worldPoint(center.x,center.y,read())};
      for(const id of points.keys())try{viewport.setPointerCapture(id)}catch{}
      onInteraction(true);
    }
    viewport.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      if(e.pointerType==='touch')points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(points.size>=2){e.preventDefault();startPinch();return}
      suppressTap=false;
      const card=e.target.closest('.card'),resize=e.target.closest('.resize-handle');
      if(card&&getMode()==='connect'&&!e.target.closest('button')){
        gesture={kind:'link',id:card.dataset.id,pointer:e.pointerId,x:e.clientX,y:e.clientY};
      }else if(resize){
        const node=getNode(card.dataset.id);gesture={kind:'resize',id:node.id,pointer:e.pointerId,start:toWorld(e.clientX,e.clientY),original:structuredClone(node)};
      }else if(e.target.closest('input,textarea,button,.checklist')){
        if(e.pointerType==='touch'&&e.target.closest('.card-content')){
          const editor=e.target.closest('textarea');const scroll=editor&&editor.scrollHeight>editor.clientHeight?editor:e.target.closest('.card-content');
          gesture={kind:'content',pointer:e.pointerId,x:e.clientX,y:e.clientY,scroll,startScroll:scroll.scrollTop};onInteraction(true);
        }
        return;
      }else if(card){
        const node=getNode(card.dataset.id);gesture={kind:'move',id:node.id,pointer:e.pointerId,start:toWorld(e.clientX,e.clientY),original:structuredClone(node)};
      }else if(e.target.closest('path')&&getMode()==='erase'){
        return;
      }else{
        gesture={kind:'pan',pointer:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
      }
      document.activeElement?.blur?.();
      if(gesture.id)onSelect(gesture.id);
      viewport.setPointerCapture(e.pointerId);onInteraction(true);e.preventDefault();board.style.cursor='grabbing';
    },{capture:true});
    viewport.addEventListener('pointermove',e=>{
      if(points.has(e.pointerId))points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch&&points.size>=2){
        e.preventDefault();const [a,b]=[...points.values()],center=local((a.x+b.x)/2,(a.y+b.y)/2);
        const next=clampZoom(pinch.scale*distance(a,b)/pinch.distance);
        apply({scale:next,left:Math.max(0,pinch.anchor.x*next-center.x),top:Math.max(0,pinch.anchor.y*next-center.y)});return;
      }
      if(!gesture||gesture.pointer!==e.pointerId)return;
      if(gesture.kind==='content'){
        if(Math.abs(e.clientY-gesture.y)>8){e.preventDefault();gesture.scroll.scrollTop=gesture.startScroll+gesture.y-e.clientY;viewport.setPointerCapture(e.pointerId)}return;
      }
      if(gesture.kind==='link'){if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)suppressTap=true;return}
      e.preventDefault();
      if(gesture.kind==='pan'){
        viewport.scrollLeft=gesture.left+gesture.x-e.clientX;viewport.scrollTop=gesture.top+gesture.y-e.clientY;return;
      }
      const p=toWorld(e.clientX,e.clientY),dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;
      if(gesture.kind==='move')onMove(gesture.id,gesture.original.x+dx,gesture.original.y+dy);
      else onResize(gesture.id,(gesture.original.width??230)+dx,(gesture.original.height??194)+dy);
      gesture.changed=true;
    },{capture:true});
    function up(e){
      points.delete(e.pointerId);
      if(pinch){
        if(points.size<2){pinch=null;gesture=null;onInteraction(false);suppressTap=true}return;
      }
      if(gesture?.pointer===e.pointerId){
        if(gesture.kind==='link'&&!suppressTap&&e.type!=='pointercancel')onLink(gesture.id);
        finish(e.type==='pointercancel');
      }
      if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
    }
    viewport.addEventListener('click',e=>{if(suppressTap){e.preventDefault();e.stopImmediatePropagation();suppressTap=false}},{capture:true});
    viewport.addEventListener('pointerup',up,{capture:true});viewport.addEventListener('pointercancel',up,{capture:true});
    viewport.addEventListener('lostpointercapture',e=>{if(gesture?.pointer===e.pointerId)finish(false)});
    viewport.addEventListener('wheel',e=>{
      e.preventDefault();
      const unit=e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1;
      const dy=e.deltaY*unit;
      if(safariPinch||pinch)return;
      if(!e.ctrlKey&&(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))){
        viewport.scrollLeft+=(e.deltaX||e.deltaY)*unit;return;
      }
      // Scroll a focused editor or its card only while it can consume the wheel.
      if(!e.ctrlKey&&e.target.closest('.card-content')?.contains(document.activeElement)){
        for(const scroll of [e.target.closest('textarea'),e.target.closest('.card-content')]){
          if(!scroll)continue;
          const before=scroll.scrollTop;scroll.scrollTop+=dy;
          if(scroll.scrollTop!==before)return;
        }
      }
      const p=local(e.clientX,e.clientY);zoom(scale*Math.exp(-dy*(e.ctrlKey ? 0.008 : 0.002)),p.x,p.y);
    },{passive:false});
    // Safari trackpads may emit GestureEvents instead of Ctrl+wheel.
    function gestureCenter(e){
      return Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)
        ? local(e.clientX,e.clientY):{x:viewport.clientWidth/2,y:viewport.clientHeight/2};
    }
    viewport.addEventListener('gesturestart',e=>{
      e.preventDefault();
      if(pinch||points.size>=2)return;
      const center=gestureCenter(e);
      safariPinch={scale,anchor:worldPoint(center.x,center.y,read())};
    },{passive:false});
    viewport.addEventListener('gesturechange',e=>{
      e.preventDefault();
      if(!safariPinch||pinch||!Number.isFinite(e.scale))return;
      const center=gestureCenter(e),next=clampZoom(safariPinch.scale*e.scale);
      apply({scale:next,left:Math.max(0,safariPinch.anchor.x*next-center.x),top:Math.max(0,safariPinch.anchor.y*next-center.y)});
    },{passive:false});
    viewport.addEventListener('gestureend',e=>{e.preventDefault();safariPinch=null},{passive:false});
    document.getElementById('zoomIn').onclick=()=>zoom(scale*1.2);
    document.getElementById('zoomOut').onclick=()=>zoom(scale/1.2);
    document.getElementById('resetView').onclick=()=>apply({scale:1,left:0,top:0});
    viewport.addEventListener('dblclick',e=>{
      if(e.target.closest('.card,path'))return;
      const p=toWorld(e.clientX,e.clientY);viewport.dispatchEvent(new CustomEvent('boardadd',{detail:p}));
    });
    apply({scale:1,left:0,top:0});
    return {toWorld,zoom,read,isInteracting:()=>!!pinch||!!gesture};
  }
  root.IskraViewport={clampZoom,zoomAt,worldPoint,mount};
  if(typeof module!=='undefined')module.exports=root.IskraViewport;
})(globalThis);
