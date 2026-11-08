const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');

test('description autosizes up to 900px and grows the card by missing height',()=>{
  const src=readFileSync('dist/app.js','utf8');
  const fn=src.match(/function adjustTextarea\(text,grow=false\)\{[\s\S]*?\n\}/);
  assert.ok(fn,'autosize function must exist');
  const calls=[];
  const content={scrollHeight:320,clientHeight:170};
  const card={dataset:{id:'note'}};
  const textarea={style:{},scrollHeight:280,closest:selector=>
    selector==='.card-content'?content:selector==='.card'?card:null};
  const context={text:textarea,data:{nodes:[{id:'note',width:310,height:220}]},
    sizeCard:(...args)=>calls.push(args)};
  vm.runInNewContext(fn[0]+';adjustTextarea(text,true)',context);
  assert.equal(textarea.style.height,'280px');
  assert.deepEqual(calls, [['note',310,378]]);
  textarea.scrollHeight=1500;
  vm.runInNewContext(fn[0]+';adjustTextarea(text,false)',context);
  assert.equal(textarea.style.height,'900px');
  assert.equal(calls.length,1);
});
test('field growth is bound to input and redraw without changing node schema',()=>{
  const src=readFileSync('dist/app.js','utf8');
  assert.match(src,/text\.oninput=\(\)=>\{n\.text=text\.value;adjustTextarea\(text,true\);save\(\)\}/);
  assert.match(src,/card\.append\(handle\);adjustTextarea\(text\)/);
  assert.match(src,/check\.onchange=\(\)=>\{[^\n]+reorderRows\(\);save\(\)/);
  assert.match(src,/onCommit:\(\)=>save\(\)/);
});
