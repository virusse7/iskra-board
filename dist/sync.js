// Synchronizacja co sekundę. Zapisujemy zmienione pola, zamiast całej tablicy.
(() => {
  const cfg = window.ISKRA_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.publishableKey) return;
  const params = new URLSearchParams(location.hash.slice(1));
  let token = params.get('room');
  if (!/^[a-f0-9]{64}$/.test(token || '')) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    history.replaceState(null, '', '#room=' + token);
  }
  const status = document.getElementById('saved');
  const normalize = d => ({title:d.title,nodes:Object.fromEntries(d.nodes.map(n=>[n.id,n])),edges:Object.fromEntries(d.edges.map(e=>[[...e].sort().join('_'),e]))});
  const validateNode = n => n && typeof n.id==='string' && typeof n.text==='string' && Number.isFinite(n.x) && Number.isFinite(n.y) && palette.includes(n.color);
  const denormalize = d => ({title:typeof d.title==='string'?d.title:'Wspólna tablica',nodes:Object.values(d.nodes||{}).filter(validateNode),edges:Object.values(d.edges||{}).filter(e=>Array.isArray(e)&&e.length===2&&e.every(id=>validateNode(d.nodes[id])))});
  let baseline, pending = [], busy = false, ready = false;
  const cacheKey = 'iskra-room-' + token;
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
  function overlay(state,ops){
    for(const op of ops){let target=state;for(const key of op.path.slice(0,-1)){if(!target[key])target[key]={};target=target[key]}target[op.path.at(-1)]=op.value}
    return state;
  }
  function cache(){try{localStorage.setItem(cacheKey,JSON.stringify({data,pending}))}catch{}}
  const localSave=save;
  save=function(){
    const next=normalize(data);pending.push(...diff(baseline,next));baseline=structuredClone(next);
    localSave();cache();status.textContent='◌ Synchronizowanie…';
  };
  // Nowy pokój zaczyna się pusty. Dotychczasowy zapis lokalny pozostaje do eksportu.
  const previousLocalData=structuredClone(data);
  data={title:'Wspólna burza mózgów',nodes:[],edges:[]};
  try{const c=JSON.parse(localStorage.getItem(cacheKey));if(c){data=c.data;pending=c.pending||[]}}catch{}
  baseline=normalize(data);render();
  const migrate=document.createElement('button');migrate.className='tool';migrate.textContent='＋ Przenieś lokalne pomysły';
  migrate.onclick=()=>{if(!ready)return;const ids=new Map();for(const n of previousLocalData.nodes){const id=crypto.randomUUID();ids.set(n.id,id);data.nodes.push({...n,id})}for(const e of previousLocalData.edges)data.edges.push(e.map(id=>ids.get(id)));save();render();migrate.remove()};
  document.querySelector('aside').insertBefore(migrate,document.querySelector('.hint'));
  let staged = null;
  function applyRemote(state){
    if(drag||['TEXTAREA','INPUT'].includes(document.activeElement?.tagName)){staged=state;return}
    const next=denormalize(overlay(structuredClone(state),pending));
    if(JSON.stringify(data)!==JSON.stringify(next)){data=next;baseline=normalize(data);render();setMode(mode)}
    staged=null;cache();
  }
  async function sync(){
    if(busy)return;busy=true;
    const batch=pending.slice(0,500);
    try{
      const response=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/iskra_sync',{
        method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},
        body:JSON.stringify({room_token:token,operations:batch}),signal:AbortSignal.timeout(15000)
      });
      if(!response.ok)throw Error('HTTP '+response.status);
      const remote=await response.json();pending.splice(0,batch.length);ready=true;
      applyRemote(remote);cache();status.textContent=pending.length?'◌ Synchronizowanie…':'● Wspólna tablica · połączono';
    }catch{status.textContent='○ Brak połączenia · ponawiam';}
    finally{busy=false;setTimeout(sync,1000)}
  }
  document.addEventListener('focusout',()=>setTimeout(()=>{if(staged)applyRemote(staged)},0));
  document.getElementById('board').addEventListener('pointerup',()=>{if(staged)applyRemote(staged)});
  status.textContent='◌ Łączenie ze wspólną tablicą…';sync();
})();
