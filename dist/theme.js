(() => {
  const root=document.documentElement;
  const toggle=document.getElementById('themeToggle');
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try{preference=localStorage.getItem('iskra-theme')}catch{}
  function apply(dark){
    root.dataset.theme=dark?'dark':'light';
    toggle.setAttribute('aria-pressed',String(dark));
    toggle.setAttribute('aria-label',dark?'Włącz jasny motyw':'Włącz ciemny motyw');
    toggle.textContent=dark?'☀ Jasny':'☾ Ciemny';
  }
  apply(preference==='dark'||(preference!=='light'&&system.matches));
  toggle.onclick=()=>{
    const dark=root.dataset.theme!=='dark';preference=dark?'dark':'light';
    try{localStorage.setItem('iskra-theme',preference)}catch{}
    apply(dark);
  };
  system.addEventListener('change',event=>{if(!['light','dark'].includes(preference))apply(event.matches)});
})();
