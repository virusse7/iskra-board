(() => {
  const sidebar=document.querySelector('aside');
  sidebar.style.overflowY='auto';
  document.querySelector('.hint').style.position='static';
  document.querySelector('.hint').style.marginTop='24px';
  const section=document.createElement('section');
  section.innerHTML=`<div class="label">WSPÓLNA TABLICA</div><button class="tool" id="shareRoom">↗ Kopiuj prywatny link</button><p>Jedna tablica. Dostęp wyłącznie przez prywatny link.</p>`;
  sidebar.insertBefore(section,document.querySelector('.hint'));
  const fromHash=new URLSearchParams(location.hash.slice(1)).get('room');
  let token=fromHash;
  if(!location.hash){try{token=localStorage.getItem('iskra-active-room')}catch{}}
  if(!IskraCore.validToken(token))token=null;
  if(token&&!location.hash)history.replaceState(null,'','#room='+token);
  const overlay=document.createElement('div');overlay.id='accessOverlay';overlay.setAttribute('role','status');
  overlay.innerHTML='<div><h2>Iskra — wspólna tablica</h2><p id="accessMessage"></p></div>';
  document.body.append(overlay);
  const controls=()=>[document.querySelector('header'),sidebar,document.getElementById('viewport')];
  window.ISKRA_ACCESS={token,
    lock(message){overlay.hidden=false;document.getElementById('accessMessage').textContent=message;controls().forEach(el=>el.inert=true)},
    unlock(){overlay.hidden=true;controls().forEach(el=>el.inert=false);try{localStorage.setItem('iskra-active-room',token)}catch{}}
  };
  window.ISKRA_ACCESS.lock(token?'Sprawdzanie dostępu do tablicy…':'Otwórz prywatny link do Waszej tablicy. Na nowym urządzeniu potrzebujesz pełnego linku od wspólnika.');
  document.getElementById('shareRoom').onclick=async()=>{
    if(!token)return;
    const target=IskraCore.boardLink(window.ISKRA_CONFIG?.shareBaseUrl||location.href,token);
    try{await navigator.clipboard.writeText(target);toast('Skopiowano prywatny link. Każdy jego posiadacz może edytować tablicę.')}
    catch{window.prompt('Skopiuj prywatny link:',target)}
  };
})();
