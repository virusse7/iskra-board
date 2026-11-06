(function (root) {
  const validToken = value => /^[a-f0-9]{64}$/.test(value || '');
  function parseRoom(value) {
    value = value.trim();
    if (validToken(value)) return value;
    const url = new URL(value);
    if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw Error('Invalid protocol');
    const token = new URLSearchParams(url.hash.slice(1)).get('room');
    if (!validToken(token)) throw Error('Invalid room');
    return token;
  }
  function boardLink(base,token){
    if(!validToken(token))throw Error('Invalid board key');
    const url=new URL(base);if(!['https:','http:'].includes(url.protocol))throw Error('Invalid link');
    url.hash='room='+token;return url.href;
  }
  const normalize = d => ({title:d.title,nodes:Object.fromEntries(d.nodes.map(n=>[n.id,n])),edges:Object.fromEntries(d.edges.map(e=>[[...e].sort().join('_'),e]))});
  const validSize = n => (n.width===undefined||(Number.isFinite(n.width)&&n.width>=210&&n.width<=1200))&&(n.height===undefined||(Number.isFinite(n.height)&&n.height>=194&&n.height<=1200));
  const clampSize=(width,height,x=0,y=0)=>({width:Math.max(210,Math.min(1200,4800-x,width)),height:Math.max(194,Math.min(1200,3600-y,height))});
  const validTask = task => task && Object.keys(task).every(key=>['text','done','order'].includes(key)) && typeof task.text==='string' && task.text.length<=2000 && typeof task.done==='boolean' && Number.isFinite(task.order) && task.order>=0 && task.order<=Number.MAX_SAFE_INTEGER;
  const checklistItems = node => Object.entries(node.checklist||{}).filter(([,task])=>validTask(task)).sort((a,b)=>a[1].order-b[1].order||(a[0]<b[0]?-1:1));
  const validChecklist = list => list===undefined||(list!==null&&typeof list==='object'&&!Array.isArray(list)&&Object.entries(list).every(([id,task])=>/^[a-zA-Z0-9_-]{1,80}$/.test(id)&&(task===null||validTask(task))));
  const progress = node => {const items=checklistItems(node);return {done:items.filter(([,item])=>item.done).length,total:items.length}};
  const validNode = n => n && validChecklist(n.checklist) && validSize(n) && typeof n.id==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(n.id) && typeof n.text==='string' && (n.title===undefined||(typeof n.title==='string'&&n.title.length<=120)) && Number.isFinite(n.x) && Number.isFinite(n.y) && ['#f5edb4','#e2ebd1','#e8dff2','#f6dfcd','#dcebf0'].includes(n.color);
  const denormalize = d => ({title:typeof d.title==='string'?d.title:'Wspólna tablica',nodes:Object.values(d.nodes||{}).filter(validNode),edges:Object.values(d.edges||{}).filter(e=>Array.isArray(e)&&e.length===2&&e.every(id=>Object.hasOwn(d.nodes,id)&&validNode(d.nodes[id])))});
  function diff(before, after) {
    const ops=[];
    if(before.title!==after.title)ops.push({path:['title'],value:after.title});
    for(const group of ['nodes','edges'])for(const id of new Set([...Object.keys(before[group]),...Object.keys(after[group])])) {
      const a=before[group][id],b=after[group][id];
      if(JSON.stringify(a)===JSON.stringify(b))continue;
      if(group==='edges'||!b)ops.push({path:[group,id],value:b||null});
      else for(const key of ['id','text','x','y','color','title','width','height'])if((!['title','width','height'].includes(key)||b[key]!==undefined||a?.[key]!==undefined)&&(!a||a[key]!==b[key]))ops.push({path:['nodes',id,key],value:key==='title'?(b[key]??''):key==='width'?(b[key]??230):key==='height'?(b[key]??194):b[key]});
      if(b){
        const previous=a?.checklist||{},next=b.checklist||{};
        for(const taskId of new Set([...Object.keys(previous),...Object.keys(next)])){
          const old=previous[taskId],task=next[taskId];
          if(JSON.stringify(old)===JSON.stringify(task))continue;
          const path=['nodes',id,'checklist',taskId];
          if(!task){if(old)ops.push({path,value:null})}
          else if(!old)ops.push({path,value:task});
          else for(const field of ['text','done'])if(old[field]!==task[field])ops.push({path:[...path,field],value:task[field]});
        }
      }
    }
    return ops;
  }
  function selectBatch(pending,maxBytes=750000,maxOps=500){
    const batch=[];let bytes=2;const encoder=new TextEncoder();
    for(const op of pending){
      const size=encoder.encode(JSON.stringify(op)).length+1;
      if(batch.length&&(bytes+size>maxBytes||batch.length>=maxOps))break;
      batch.push(op);bytes+=size;
    }
    return batch;
  }
  function overlay(state,ops) {
    for(const op of ops){
      let target=state;
      for(const key of op.path.slice(0,-1)){
        if(!Object.hasOwn(target,key)||!target[key])Object.defineProperty(target,key,{value:{},writable:true,enumerable:true,configurable:true});
        target=target[key];
      }
      Object.defineProperty(target,op.path.at(-1),{value:op.value,writable:true,enumerable:true,configurable:true});
    }
    return state;
  }
  const CARD_GAP=16;
  const rect=n=>({...n,width:n.width??230,height:n.height??194});
  function overlaps(a,b){
    a=rect(a);b=rect(b);
    return a.x<b.x+b.width+CARD_GAP&&a.x+a.width+CARD_GAP>b.x&&a.y<b.y+b.height+CARD_GAP&&a.y+a.height+CARD_GAP>b.y;
  }
  function freePosition(node,nodes,x=node.x,y=node.y){
    node=rect(node);
    const others=nodes.filter(n=>n.id!==node.id).map(rect);
    x=Math.max(0,Math.min(4800-node.width,x));y=Math.max(0,Math.min(3600-node.height,y));
    const candidates=[[x,y],[0,0]];
    for(const b of others){
      const left=b.x-node.width-CARD_GAP,right=b.x+b.width+CARD_GAP;
      const top=b.y-node.height-CARD_GAP,bottom=b.y+b.height+CARD_GAP;
      candidates.push([left,y],[right,y],[x,top],[x,bottom],[left,top],[right,top],[left,bottom],[right,bottom]);
    }
    candidates.sort((a,b)=>((a[0]-x)**2+(a[1]-y)**2)-((b[0]-x)**2+(b[1]-y)**2));
    for(const [cx,cy] of candidates){
      if(cx<0||cy<0||cx+node.width>4800||cy+node.height>3600)continue;
      if(!others.some(b=>overlaps({...node,x:cx,y:cy},b)))return {x:cx,y:cy};
    }
    // Search remaining rows when the nearest obstacle corners are crowded.
    for(let cy=0;cy+node.height<=3600;cy+=16){
      let cx=0;
      for(const b of others.filter(b=>cy<b.y+b.height+CARD_GAP&&cy+node.height+CARD_GAP>b.y).sort((a,b)=>a.x-b.x)){
        if(cx+node.width+CARD_GAP<=b.x)break;
        cx=Math.max(cx,b.x+b.width+CARD_GAP);
      }
      if(cx+node.width<=4800)return {x:cx,y:cy};
    }
    return null;
  }
  function fitSize(node,nodes,width,height){
    const target=clampSize(width,height,node.x,node.y),start=rect(node);
    const blocked=size=>nodes.some(n=>n.id!==node.id&&overlaps({...node,...size},n));
    if(!blocked(target))return target;
    let lo=0,hi=1;
    for(let i=0;i<24;i++){
      const t=(lo+hi)/2,size={width:start.width+(target.width-start.width)*t,height:start.height+(target.height-start.height)*t};
      if(blocked(size))hi=t;else lo=t;
    }
    return {width:start.width+(target.width-start.width)*lo,height:start.height+(target.height-start.height)*lo};
  }
  function separateCards(nodes){
    const placed=[];let changed=false;
    for(const node of [...nodes].sort((a,b)=>a.id.localeCompare(b.id))){
      if(placed.some(n=>overlaps(node,n))){
        const position=freePosition(node,placed);
        if(position){node.x=position.x;node.y=position.y;changed=true}
      }
      placed.push(node);
    }
    return changed;
  }
  root.IskraCore = {validToken,parseRoom,boardLink,normalize,denormalize,diff,overlay,clampSize,CARD_GAP,overlaps,freePosition,fitSize,separateCards,validChecklist,checklistItems,progress,validNode,selectBatch};
  if(typeof module!=='undefined')module.exports=root.IskraCore;
})(globalThis);
