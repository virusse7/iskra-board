// RPC remains the source of truth; Realtime only requests a fresh authorized read.
(() => {
  const cfg = window.ISKRA_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.publishableKey) return;
  const status = document.getElementById('saved');
  if (!cfg.publishableKey.startsWith('sb_publishable_')) {
    status.textContent='Błąd konfiguracji: wymagany publiczny klucz publishable';
    return;
  }
  const {validToken,normalize,denormalize,diff,overlay} = IskraCore;
  let token = new URLSearchParams(location.hash.slice(1)).get('room');
  if (!validToken(token)) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    history.replaceState(null, '', '#room=' + token);
  }
  const cacheKey = 'iskra-room-' + token;
  let baseline, pending=[], busy=false, ready=false, realtimeConnected=false;
  let timer, requested=false, applyingDeferred=false, lastError=false, stopped=false;
  const previousLocalData=structuredClone(data);
  data={title:'Wspólna burza mózgów',nodes:[],edges:[]};
  try {
    const c=JSON.parse(localStorage.getItem(cacheKey));
    if(c){data=denormalize(normalize(c.data));pending=c.pending||[]}
  } catch { /* Broken browser cache must not prevent reading the server. */ }
  baseline=structuredClone(normalize(data));render();
  function cache(){
    try{localStorage.setItem(cacheKey,JSON.stringify({data,pending}))}
    catch{toast('Brak miejsca na lokalną kopię. Wyeksportuj tablicę przed zamknięciem.')}
  }
  function updateStatus(){
    status.textContent=lastError?'○ Brak połączenia · zmiany czekają na wysłanie':
      !ready?'◌ Łączenie ze wspólną tablicą…':pending.length?'◌ Synchronizowanie…':
      applyingDeferred?'● Zmiany zdalne — zakończ edycję, aby je zobaczyć':
      realtimeConnected?'● Połączono · Realtime':'● Połączono · tryb zapasowy (5 s)';
  }
  function requestSync(delay=0){
    if(stopped)return;
    if(busy){requested=true;return}
    clearTimeout(timer);timer=setTimeout(sync,delay);
  }
  save=function(){
    const next=normalize(data);
    pending.push(...diff(baseline,next));baseline=structuredClone(next);
    cache();stats();updateStatus();requestSync(150);
  };
  const migrate=document.createElement('button');migrate.className='tool';migrate.textContent='＋ Przenieś lokalne pomysły';
  migrate.onclick=()=>{
    if(!ready){toast('Poczekaj na połączenie z bazą');return}
    const ids=new Map();
    for(const n of previousLocalData.nodes){const id=crypto.randomUUID();ids.set(n.id,id);data.nodes.push({...n,id})}
    for(const e of previousLocalData.edges)if(e.every(id=>ids.has(id)))data.edges.push(e.map(id=>ids.get(id)));
    save();render();migrate.remove();
  };
  document.querySelector('aside').insertBefore(migrate,document.querySelector('.hint'));
  function applyRemote(state){
    const active=document.activeElement;
    if(drag||active?.tagName==='TEXTAREA'||active?.classList?.contains('card-title')||active?.id==='title'){
      // Do not retain a stale snapshot: after blur, read the latest server state.
      applyingDeferred=true;return;
    }
    const next=denormalize(overlay(structuredClone(state),pending));
    if(JSON.stringify(data)!==JSON.stringify(next)){
      data=next;baseline=structuredClone(normalize(data));render();
      // Preserve the selected connection endpoint and current tool mode.
      document.querySelectorAll('textarea,.card-title').forEach(t=>t.readOnly=mode==='connect');
    }
    applyingDeferred=false;
  }
  let realtime;
  async function sync(){
    if(busy||stopped)return;busy=true;requested=false;
    const batch=pending.slice(0,500);
    try{
      const response=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/iskra_sync',{
        method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},
        body:JSON.stringify({room_token:token,operations:batch}),signal:AbortSignal.timeout(15000)
      });
      if(!response.ok)throw Error('RPC request failed');
      const remote=await response.json();
      if(!remote||typeof remote!=='object'||!remote.nodes||!remote.edges)throw Error('Invalid response');
      pending.splice(0,batch.length);ready=true;lastError=false;
      applyRemote(remote);cache();
      if(batch.length)realtime?.notify();
    }catch{lastError=true;cache()}
    finally{
      busy=false;updateStatus();
      requestSync(lastError?3000:requested||pending.length?150:5000);
    }
  }
  // Separate domain from database key hashes. No access key or board data is broadcast.
  crypto.subtle.digest('SHA-256',new TextEncoder().encode('iskra-realtime-v1:'+token)).then(bytes=>{
    if(stopped)return;
    const topic='iskra-'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    realtime=IskraRealtime.connectRealtime({url:cfg.supabaseUrl,key:cfg.publishableKey,topic,
      onChange:()=>requestSync(),onStatus:connected=>{realtimeConnected=connected;updateStatus()}});
  }).catch(()=>{realtimeConnected=false;updateStatus()});
  document.addEventListener('focusout',()=>{if(applyingDeferred)requestSync()});
  document.getElementById('board').addEventListener('pointerup',()=>{if(applyingDeferred)requestSync()});
  window.addEventListener('online',()=>requestSync());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestSync()});
  window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);cache();realtime?.close()});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
  updateStatus();requestSync();
})();
