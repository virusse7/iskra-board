(function(root){
  const worldPoint=(x,y,view)=>({x:view.left+x,y:view.top+y});
  function mount({viewport,board,world,onMove,onResize,onCommit,onRollback,onSelect,onLink,getMode,getNode,onInteraction}){
    let gesture=null,suppressTap=false;
    const read=()=>({left:viewport.scrollLeft,top:viewport.scrollTop});
    const local=(x,y)=>{const r=viewport.getBoundingClientRect();return {x:x-r.left,y:y-r.top}};
    const toWorld=(x,y)=>{const p=local(x,y);return worldPoint(p.x,p.y,read())};
    function finish(cancel=false){
      if(gesture&&['move','resize'].includes(gesture.kind)){
        if(cancel)onRollback(gesture.id,gesture.original);else if(gesture.changed)onCommit();
      }
      gesture=null;onInteraction(false);board.style.cursor='grab';
    }
    viewport.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      if(gesture){if(e.pointerType==='touch')suppressTap=true;return}
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
      const editor=e.target.closest('textarea');
      const scroll=editor&&editor.scrollHeight>editor.clientHeight?editor:e.target.closest('.card-content');
      if(scroll&&!e.ctrlKey&&scroll.scrollHeight>scroll.clientHeight){
        e.preventDefault();scroll.scrollTop+=e.deltaY;return;
      }
      e.preventDefault();
      if(e.ctrlKey)return; // Pinch gestures do not change zoom.
      const unit=e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1;
      if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){
        viewport.scrollLeft+=(e.deltaX||e.deltaY)*unit;return;
      }
      viewport.scrollTop+=e.deltaY*unit;
    },{passive:false});
    viewport.addEventListener('dblclick',e=>{
      if(e.target.closest('.card,path'))return;
      const p=toWorld(e.clientX,e.clientY);viewport.dispatchEvent(new CustomEvent('boardadd',{detail:p}));
    });
    return {toWorld,read,isInteracting:()=>!!gesture};
  }
  root.IskraViewport={worldPoint,mount};
  if(typeof module!=='undefined')module.exports=root.IskraViewport;
})(globalThis);
