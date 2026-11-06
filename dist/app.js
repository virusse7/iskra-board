const $=id=>document.getElementById(id);
const palette=['#f5edb4','#e2ebd1','#e8dff2','#f6dfcd','#dcebf0'];
let color=palette[0],mode='move',selected=null,source=null,drag=null,resizing=null;
let data={title:'Wspólna burza mózgów',nodes:[],edges:[]};
try{data=JSON.parse(localStorage.getItem('iskra-board-v1'))||data}catch{}
function save(){
  try{localStorage.setItem('iskra-board-v1',JSON.stringify(data));$('saved').textContent='● Zapisano w przeglądarce'}catch{toast('Brak miejsca na lokalną kopię. Użyj eksportu.')}
  stats();
}
function stats(){const text=data.nodes.length+' pomysłów';$('count').textContent=text+' · '+data.edges.length+' połączeń';$('stats').textContent=text}
function toast(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(window.tt);window.tt=setTimeout(()=>$('toast').style.display='none',3000)}
function lines(){
  $('lines').replaceChildren();
  data.edges.forEach(([a,b],index)=>{
    a=data.nodes.find(n=>n.id===a);b=data.nodes.find(n=>n.id===b);if(!a||!b)return;
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');
    const x=a.x+(a.width??230)/2,y=a.y+(a.height??194)/2,xx=b.x+(b.width??230)/2,yy=b.y+(b.height??194)/2;
    p.setAttribute('d',`M ${x} ${y} C ${x} ${(y+yy)/2}, ${xx} ${(y+yy)/2}, ${xx} ${yy}`);
    p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label','Usuń połączenie');
    const remove=e=>{e.stopPropagation();data.edges.splice(index,1);save();lines();toast('Usunięto połączenie')};
    p.addEventListener('dblclick',remove);p.addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Enter')remove(e)});
    // Touch-friendly removal when the dedicated eraser tool is active.
    p.addEventListener('click',e=>{if(mode==='erase')remove(e)});
    $('lines').append(p);
  });
}
function choose(id){selected=id;document.querySelectorAll('.card').forEach(el=>el.classList.toggle('selected',el.dataset.id===id))}
function link(id){
  if(!source){source=id;choose(id);toast('Teraz dotknij drugiej karteczki');return}
  if(source!==id&&!data.edges.some(edge=>edge.includes(source)&&edge.includes(id))){data.edges.push([source,id]);save();lines()}
  source=null;choose(null);
}
const cardElement=id=>document.querySelector(`[data-id="${id}"]`);
function positionCard(id,x,y){
  const n=data.nodes.find(n=>n.id===id),position=IskraCore.freePosition(n,data.nodes,x,y);if(!position)return;
  Object.assign(n,position);const el=cardElement(id);el.style.left=n.x+'px';el.style.top=n.y+'px';lines();
}
function sizeCard(id,width,height){
  const n=data.nodes.find(n=>n.id===id),size=IskraCore.fitSize(n,data.nodes,width,height);Object.assign(n,size);
  const el=cardElement(id);el.style.width=n.width+'px';el.style.height=n.height+'px';lines();
}
function checklist(n,content,footer){
  const items=IskraCore.checklistItems(n),wrapper=document.createElement('div');wrapper.className='checklist';
  const progress=document.createElement('span');progress.className='checklist-progress';progress.setAttribute('aria-live','polite');
  function updateProgress(){const p=IskraCore.progress(n);progress.textContent=p.total?`${p.done}/${p.total} ukończonych`:''}
  function addTask(){
    n.checklist??={};const id=crypto.randomUUID();n.checklist[id]={text:'',done:false,order:Date.now()};
    if(!items.length)sizeCard(n.id,n.width??230,Math.max(n.height??194,320));
    save();render();cardElement(n.id).querySelector(`[data-task-id="${id}"] input[type="text"]`).focus();
  }
  for(const [id,item] of items){
    const row=document.createElement('div');row.className='checklist-row'+(item.done?' done':'');row.dataset.taskId=id;
    const check=document.createElement('input');check.type='checkbox';check.checked=item.done;check.setAttribute('aria-label','Zadanie ukończone');
    check.onchange=()=>{item.done=check.checked;row.classList.toggle('done',item.done);updateProgress();save()};
    const text=document.createElement('input');text.type='text';text.value=item.text;text.maxLength=2000;text.placeholder='Nowe zadanie…';text.setAttribute('aria-label','Treść zadania');
    text.oninput=()=>{item.text=text.value;save()};
    text.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addTask()}};
    const remove=document.createElement('button');remove.type='button';remove.className='task-delete';remove.textContent='×';remove.setAttribute('aria-label','Usuń zadanie');
    remove.onclick=()=>{n.checklist[id]=null;save();render()};
    row.append(check,text,remove);wrapper.append(row);
  }
  const add=document.createElement('button');add.type='button';add.className='checklist-add';add.textContent=items.length?'＋ Zadanie':'☑ Dodaj checklistę';add.onclick=addTask;
  wrapper.append(add);content.append(wrapper);footer.append(progress);updateProgress();
}
function render(){
  $('title').value=data.title;$('cards').replaceChildren();
  data.nodes.forEach((n,index)=>{
    const card=document.createElement('article');card.className='card';card.dataset.id=n.id;
    card.style.cssText=`left:${n.x}px;top:${n.y}px;background:${n.color};width:${n.width??230}px;height:${n.height??194}px`;
    const top=document.createElement('div');top.className='top';
    const grip=document.createElement('span');grip.className='card-grip';grip.textContent='⠿';grip.title='Przeciągnij karteczkę';grip.setAttribute('aria-hidden','true');
    const title=document.createElement('input');title.type='text';title.className='card-title';title.maxLength=120;title.value=n.title??'';
    title.placeholder='POMYSŁ '+String(index+1).padStart(2,'0');title.setAttribute('aria-label','Nazwa pomysłu '+(index+1));
    title.oninput=()=>{n.title=title.value;save()};
    const remove=document.createElement('button');remove.className='card-delete';remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Usuń pomysł '+(index+1));
    remove.onclick=()=>{data.nodes=data.nodes.filter(item=>item.id!==n.id);data.edges=data.edges.filter(edge=>!edge.includes(n.id));save();render()};
    top.append(grip,title,remove);
    const content=document.createElement('div');content.className='card-content';
    const text=document.createElement('textarea');text.value=n.text;text.setAttribute('aria-label','Treść pomysłu '+(index+1));text.placeholder='Zapisz pomysł…';
    text.oninput=()=>{n.text=text.value;save()};content.append(text);
    const footer=document.createElement('div');footer.className='card-footer';
    const badge=document.createElement('small');badge.textContent='✦ POMYSŁ';footer.append(badge);
    card.append(top,content,footer);$('cards').append(card);
    checklist(n,content,footer);
    const handle=document.createElement('button');handle.type='button';handle.className='resize-handle';handle.textContent='◢';handle.setAttribute('aria-label','Zmień rozmiar pomysłu '+(index+1));
    handle.title='Przeciągnij, aby zmienić rozmiar. Strzałki: 10 px, Shift: 50 px';
    handle.onkeydown=e=>{const d={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]}[e.key];if(!d)return;e.preventDefault();const step=e.shiftKey?50:10;sizeCard(n.id,(n.width??230)+d[0]*step,(n.height??194)+d[1]*step);save()};
    card.append(handle);
  });
  applyMode();lines();stats();choose(selected);
}
function add(x,y){
  if(mode!=='move')setMode('move');
  const center=boardView.toWorld(viewport.getBoundingClientRect().left+viewport.clientWidth/2,viewport.getBoundingClientRect().top+viewport.clientHeight/2);
  const n={id:crypto.randomUUID(),x:x??center.x-115,y:y??center.y-97,text:'',color};
  const position=IskraCore.freePosition(n,data.nodes);if(!position){toast('Brak miejsca na tablicy');return}
  Object.assign(n,position);data.nodes.push(n);save();render();choose(n.id);closeTools();cardElement(n.id).querySelector('textarea').focus();
}
function applyMode(){
  document.querySelectorAll('.card-title,.card textarea,.checklist input[type="text"]').forEach(input=>input.readOnly=mode!=='move');
  document.querySelectorAll('.checklist button,.checklist input[type="checkbox"]').forEach(input=>input.disabled=mode!=='move');
  $('board').dataset.mode=mode;
}
function setMode(value){
  mode=value;source=null;choose(null);
  for(const name of ['move','connect','erase'])$(name).classList.toggle('active',name===mode);
  $('mode').textContent=mode==='move'?'Przeciągnij tło lub uchwyt karteczki':mode==='connect'?'Dotknij dwóch karteczek, aby je połączyć':'Dotknij linii, aby ją usunąć';
  applyMode();closeTools();
}
const toolMedia=window.matchMedia('(max-width:800px)');
function refreshTools(){const open=document.body.classList.contains('tools-open');$('tools').inert=!!($('accessOverlay')&&!$('accessOverlay').hidden)||(toolMedia.matches&&!open);$('toolsToggle').setAttribute('aria-expanded',String(open))}
function closeTools(){document.body.classList.remove('tools-open');refreshTools()}
window.IskraTools={refresh:refreshTools};toolMedia.addEventListener('change',refreshTools);
const viewport=$('viewport'),board=$('board');
const boardView=IskraViewport.mount({viewport,board,world:$('world'),getMode:()=>mode,getNode:id=>data.nodes.find(n=>n.id===id),
  onSelect:choose,onLink:link,onMove:positionCard,onResize:sizeCard,onCommit:save,
  onRollback:(id,original)=>{const n=data.nodes.find(n=>n.id===id);if(n){Object.assign(n,original);const el=cardElement(id);el.style.left=n.x+'px';el.style.top=n.y+'px';el.style.width=(n.width??230)+'px';el.style.height=(n.height??194)+'px';lines()}},
  onInteraction:active=>{drag=active?{}:null;if(!active)document.dispatchEvent(new Event('boardidle'))}
});window.IskraView=boardView;
viewport.addEventListener('boardadd',e=>add(e.detail.x,e.detail.y));
$('add').onclick=()=>add();
for(const name of ['move','connect','erase'])$(name).onclick=()=>setMode(name);
$('toolsToggle').onclick=()=>{document.body.classList.toggle('tools-open');refreshTools()};
$('toolsBackdrop').onclick=closeTools;
$('title').oninput=e=>{data.title=e.target.value;save()};
palette.forEach(c=>{const b=document.createElement('button');b.className='swatch'+(c===color?' active':'');b.style.background=c;b.setAttribute('aria-label','Kolor '+c);b.onclick=()=>{color=c;document.querySelectorAll('.swatch').forEach(el=>el.classList.toggle('active',el===b));if(selected){data.nodes.find(n=>n.id===selected).color=c;save();render()}};$('colors').append(b)});
$('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='iskra-tablica.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
$('importBtn').onclick=()=>$('import').click();
$('import').onchange=async e=>{
  try{
    const next=JSON.parse(await e.target.files[0].text());
    if(typeof next.title!=='string'||!Array.isArray(next.nodes)||next.nodes.length>500||!next.nodes.every(IskraCore.validNode)||!Array.isArray(next.edges)||!next.edges.every(edge=>Array.isArray(edge)&&edge.length===2&&edge.every(id=>next.nodes.some(n=>n.id===id))))throw Error();
    // Imported tasks get new identities, so an intentional restore does not revive deletion tombstones.
    for(const n of next.nodes)if(n.checklist)n.checklist=Object.fromEntries(IskraCore.checklistItems(n).map(([,task])=>[crypto.randomUUID(),task]));
    data=next;selected=null;source=null;save();render();closeTools();toast('Wczytano tablicę');
  }catch{toast('Nieprawidłowy plik tablicy')}
  e.target.value='';
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMode('move');closeTools()}});
render();
refreshTools();
