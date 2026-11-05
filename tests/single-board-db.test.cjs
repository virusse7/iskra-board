const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const migration=readFileSync('supabase/migrations/20261106_single_board.sql','utf8');
const hash=key=>createHash('sha256').update(key).digest('hex');

test('PostgreSQL migration preserves all records and restricts RPC to exactly one existing board',async()=>{
  const {PGlite}=await import('@electric-sql/pglite');
  const db=new PGlite();
  const chosen='a'.repeat(64),other='b'.repeat(64),unknown='c'.repeat(64);
  const state={title:'Existing',nodes:{one:{id:'one',text:'Saved idea',x:47,y:89,width:420,height:320,color:'#f5edb4'}},edges:{}};
  try{
    await db.exec('create role anon; create role authenticated;');
    await db.exec(readFileSync('supabase/schema.sql','utf8'));
    await db.query('insert into public.iskra_rooms(token_hash,state) values ($1,$2),($3,$2)',[hash(chosen),JSON.stringify(state),hash(other)]);
    const before=(await db.query('select token_hash,state,updated_at from public.iskra_rooms order by token_hash')).rows;
    await db.query("select set_config('iskra.allowed_board_hash',$1,false)",[hash(chosen)]);
    await db.exec(migration);
    assert.deepEqual((await db.query('select token_hash,state,updated_at from public.iskra_rooms order by token_hash')).rows,before);
    await db.exec('set role anon');
    const read=await db.query('select public.iskra_sync($1,$2) as state',[chosen,'[]']);assert.deepEqual(read.rows[0].state,state);
    for(const key of [unknown,other,null,'invalid']){
      await assert.rejects(db.query('select public.iskra_sync($1,$2)',[key,'[]']),e=>e.code==='42501');
      await assert.rejects(db.query('select public.iskra_sync($1,$2)',[key,JSON.stringify([{path:['title'],value:'Unauthorized'}])]),e=>e.code==='42501');
    }
    await assert.rejects(db.query('select * from public.iskra_rooms'),e=>e.code==='42501');
    await assert.rejects(db.query('select * from public.iskra_active_board'),e=>e.code==='42501');
    const changed=await db.query('select public.iskra_sync($1,$2) as state',[chosen,JSON.stringify([{path:['nodes','one','title'],value:'New name'},{path:['nodes','one','width'],value:500}])]);
    assert.equal(changed.rows[0].state.nodes.one.title,'New name');
    assert.equal(changed.rows[0].state.nodes.one.width,500);
    assert.equal(changed.rows[0].state.nodes.one.x,47);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as n from public.iskra_rooms')).rows[0].n,2);
    assert.deepEqual((await db.query('select state from public.iskra_rooms where token_hash=$1',[hash(other)])).rows[0].state,state);
    assert.equal((await db.query('select count(*)::int as n from public.iskra_rooms where token_hash=$1',[hash(unknown)])).rows[0].n,0);
  }finally{await db.close()}
});

test('migration with no selected board fails atomically before changing application data',async()=>{
  const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
  try{
    await db.exec('create role anon; create role authenticated;');
    await db.exec(readFileSync('supabase/schema.sql','utf8'));
    await assert.rejects(db.exec(migration));await db.exec('rollback');
    assert.equal((await db.query("select to_regclass('public.iskra_active_board') as name")).rows[0].name,null);
  }finally{await db.close()}
});
