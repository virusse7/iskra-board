(() => {
  const configured = Boolean(window.ISKRA_CONFIG?.supabaseUrl && window.ISKRA_CONFIG?.publishableKey);
  const sidebar = document.querySelector('aside');
  sidebar.style.overflowY = 'auto';
  document.querySelector('.hint').style.position = 'static';
  document.querySelector('.hint').style.marginTop = '24px';
  const section = document.createElement('section');
  section.innerHTML = `<div class="label">WSPÓLNA TABLICA</div>
    <button class="tool" id="shareRoom">↗ Kopiuj link do tablicy</button>
    <button class="tool" id="joinRoom">⌁ Dołącz przez link</button>
    <button class="tool" id="newRoom">＋ Nowa wspólna tablica</button>
    <p id="roomState"></p>`;
  sidebar.insertBefore(section, document.querySelector('.hint'));
  document.getElementById('roomState').textContent = configured ? 'Bez logowania. Każdy z pełnym linkiem może edytować.' : 'Tryb lokalny · wspólny zapis czeka na podłączenie Supabase.';
  const dialog = document.createElement('dialog');
  dialog.style.cssText='border:1px solid #dce1d9;border-radius:18px;padding:28px;max-width:460px;width:calc(100% - 32px);color:#26332e;box-shadow:0 20px 80px #26332e30';
  dialog.innerHTML=`<form id="roomForm"><h2 style="margin-top:0">Dołącz do tablicy</h2><p>Wklej pełny link otrzymany od wspólnika.</p><label for="roomLink">Link do tablicy</label><input id="roomLink" type="url" required placeholder="https://…/#room=…" style="display:block;width:100%;padding:12px;border:1px solid #ccd4c5;border-radius:8px;margin:10px 0"><p id="roomError" role="alert" style="color:#a64432;font-size:13px"></p><div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" id="cancelRoom">Anuluj</button><button class="primary" type="submit">Otwórz tablicę</button></div></form>`;
  document.body.append(dialog);
  const missing = () => toast('Najpierw podłącz Supabase, aby korzystać ze wspólnej tablicy');
  document.getElementById('joinRoom').onclick=()=>{document.getElementById('roomError').textContent='';dialog.showModal();document.getElementById('roomLink').focus()};
  document.getElementById('cancelRoom').onclick=()=>dialog.close();
  document.getElementById('roomForm').onsubmit=e=>{
    e.preventDefault();
    try {
      const url=new URL(document.getElementById('roomLink').value.trim());
      const token=new URLSearchParams(url.hash.slice(1)).get('room');
      if(!['https:','http:','file:'].includes(url.protocol)||!/^[a-f0-9]{64}$/.test(token||''))throw Error();
      if(!configured){document.getElementById('roomError').textContent='Link jest poprawny, ale ta strona wymaga jeszcze konfiguracji Supabase.';return}
      location.hash='room='+token;location.reload();
    } catch {document.getElementById('roomError').textContent='Wklej pełny link zawierający #room= i identyfikator tablicy.'}
  };
  document.getElementById('shareRoom').onclick=async()=>{
    if(!configured)return missing();
    try{await navigator.clipboard.writeText(location.href);toast('Skopiowano link. Wyślij go wspólnikowi.')}
    catch{window.prompt('Skopiuj pełny link do tablicy:',location.href)}
  };
  document.getElementById('newRoom').onclick=()=>{
    if(!configured)return missing();
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    location.hash='room='+token;location.reload();
  };
})();
