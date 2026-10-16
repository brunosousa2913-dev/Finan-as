// Install @electric-sql/pglite separately for this test; no production dependency.
const assert=require('node:assert/strict');const fs=require('node:fs');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{const pg=new PGlite();try{
await pg.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');`);
await pg.exec(fs.readFileSync('supabase/setup.sql','utf8'));await pg.exec(fs.readFileSync('supabase/setup.sql','utf8'));
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222',doc={version:1,entries:[],cards:[]};
async function as(id){await pg.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
await as(a);let saved=await pg.query('select * from public.save_meu_saldo($1::jsonb,0)',[JSON.stringify(doc)]);assert.equal(Number(saved.rows[0].revision),1);
await assert.rejects(()=>pg.query('select * from public.save_meu_saldo($1::jsonb,0)',[JSON.stringify(doc)]),e=>e.code==='40001');
await pg.query('select * from public.save_meu_saldo($1::jsonb,1)',[JSON.stringify({...doc,categories:['Pets']})]);
await assert.rejects(()=>pg.query('select * from public.save_meu_saldo($1::jsonb,1)',[JSON.stringify(doc)]),e=>e.code==='40001');
await as(b);assert.equal((await pg.query('select * from public.meu_saldo_accounts')).rows.length,0);await assert.rejects(()=>pg.query('update public.meu_saldo_accounts set revision=100'),e=>e.code==='42501');await pg.query('select * from public.save_meu_saldo($1::jsonb,0)',[JSON.stringify(doc)]);assert.equal((await pg.query('select user_id from public.meu_saldo_accounts')).rows[0].user_id,b);
await as(a);assert.equal((await pg.query('select user_id,revision from public.meu_saldo_accounts')).rows[0].user_id,a);assert.equal(Number((await pg.query('select revision from public.meu_saldo_accounts')).rows[0].revision),2);
await pg.exec('reset role;set role anon;');await assert.rejects(()=>pg.query('select * from public.meu_saldo_accounts'),e=>e.code==='42501');await assert.rejects(()=>pg.query('select * from public.save_meu_saldo($1::jsonb,0)',[JSON.stringify(doc)]),e=>e.code==='42501');
console.log('PASS SQL: idempotent setup, RLS isolates users, anonymous/direct writes denied, revision conflicts prevent overwrite.');
}finally{await pg.close();}})().catch(e=>{console.error(e);process.exit(1)});
