// Local UI fixture only. Never deployed; no Supabase connection or board key.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const fixture={title:'Iskra — test interfejsu',nodes:[
  {id:'one',title:'Plan prototypu',text:'Lokalne dane do testów interfejsu.',x:40,y:40,width:320,height:400,color:'#f5edb4',checklist:{a:{text:'Zarys mechaniki',done:true,order:1},b:{text:'Prototyp sterowania',done:false,order:2},c:{text:'Pierwszy playtest',done:false,order:3}}},
  {id:'two',title:'Pomysły',text:'Przeciągnij uchwyt albo dodaj checklistę.',x:440,y:100,width:300,height:300,color:'#e8dff2'}
],edges:[['one','two']]};
const allowed=['index.html','app.js','board-core.js','viewport.js','interaction.css','theme.js'];
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  res.setHeader('Cache-Control','no-store');
  if(name==='fixture-sync.js'){
    res.setHeader('Content-Type','text/javascript');
    res.end("window.addEventListener('storage',e=>{if(e.key==='iskra-board-v1'&&e.newValue){data=JSON.parse(e.newValue);render()}});");return;
  }
  if(!allowed.includes(name)){res.writeHead(404);res.end();return}
  let body=await readFile(new URL('../dist/'+name,import.meta.url),'utf8');
  if(name==='index.html')body=body.replace(/<script src="(?:config|realtime|rooms|sync)\.js"><\/script>/g,'').replace('</body>','<script src="fixture-sync.js"></script></body>');
  if(name==='app.js')body=body.replace("let data={title:'Wspólna burza mózgów',nodes:[],edges:[]};",'let data='+JSON.stringify(fixture)+';');
  res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(body);
});
server.listen(31390,'127.0.0.1',()=>console.log('Local UI fixture: http://localhost:31390'));
