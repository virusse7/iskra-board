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
  const normalize = d => ({title:d.title,nodes:Object.fromEntries(d.nodes.map(n=>[n.id,n])),edges:Object.fromEntries(d.edges.map(e=>[[...e].sort().join('_'),e]))});
  const validNode = n => n && typeof n.id==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(n.id) && typeof n.text==='string' && Number.isFinite(n.x) && Number.isFinite(n.y) && ['#f5edb4','#e2ebd1','#e8dff2','#f6dfcd','#dcebf0'].includes(n.color);
  const denormalize = d => ({title:typeof d.title==='string'?d.title:'Wspólna tablica',nodes:Object.values(d.nodes||{}).filter(validNode),edges:Object.values(d.edges||{}).filter(e=>Array.isArray(e)&&e.length===2&&e.every(id=>Object.hasOwn(d.nodes,id)&&validNode(d.nodes[id])))});
  function diff(before, after) {
    const ops=[];
    if(before.title!==after.title)ops.push({path:['title'],value:after.title});
    for(const group of ['nodes','edges'])for(const id of new Set([...Object.keys(before[group]),...Object.keys(after[group])])) {
      const a=before[group][id],b=after[group][id];
      if(JSON.stringify(a)===JSON.stringify(b))continue;
      if(group==='edges'||!b)ops.push({path:[group,id],value:b||null});
      else for(const key of ['id','text','x','y','color'])if(!a||a[key]!==b[key])ops.push({path:['nodes',id,key],value:b[key]});
    }
    return ops;
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
  root.IskraCore = {validToken,parseRoom,normalize,denormalize,diff,overlay};
  if(typeof module!=='undefined')module.exports=root.IskraCore;
})(globalThis);
