const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
test('theme uses system preference, toggles and remembers local choice',()=>{
  const attrs={},root={dataset:{}},button={setAttribute(k,v){attrs[k]=v}};
  const store=new Map();
  const context={document:{documentElement:root,getElementById:()=>button},window:{matchMedia:()=>({matches:true,addEventListener(){}})},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};
  vm.runInNewContext(readFileSync('dist/theme.js','utf8'),context);
  assert.equal(root.dataset.theme,'dark');assert.equal(attrs['aria-pressed'],'true');
  button.onclick();assert.equal(root.dataset.theme,'light');assert.equal(store.get('iskra-theme'),'light');
  button.onclick();assert.equal(root.dataset.theme,'dark');
});
