import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
const [host,port,mode]=process.argv.slice(2);
assert.match(host??'',/^\/private\/tmp\/timefit-release-identity\.[a-zA-Z0-9]+$/);
assert.ok(['digest-extensions','digest-public'].includes(mode));
const db=new pg.Client({host,port:Number(port),user:'postgres',database:'postgres'});await db.connect();
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const names=['write_account_course_completion','submit_dwell_completion_sample','import_guest_course_completions'];
const places=[{stopOrdinal:1,contentId:'fixture',title:'fixture',category:'카페',subCategory:'북카페'}];
let checks=0;
try{
 await db.query(`insert into public.signup_consent_documents(document_id,document_version,document_url,active,approved_at) values
 ('terms-of-service','fixture','https://fixture.invalid/terms',true,now()),('privacy-policy','fixture','https://fixture.invalid/privacy',true,now())`);
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[owner,JSON.stringify({signup_request_id:owner,required_consents:{terms:{document_id:'terms-of-service',document_version:'fixture',accepted:true},privacy:{document_id:'privacy-policy',document_version:'fixture',accepted:true}}})]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[owner,JSON.stringify({sub:owner,is_anonymous:false})]);
 await db.query("select * from public.set_dwell_personalization_consent('fixture-consent',true,0)");
 const minute=Number((await db.query('select floor(extract(epoch from now())/60) m')).rows[0].m);
 const write=(id,title='fixture')=>db.query('select public.write_account_course_completion($1,$2,$3,1,$4) status',[`completion-${id}`,`run-${id}`,minute,JSON.stringify([{...places[0],title}])]);
 const sample=(dwell=40)=>db.query(`select public.submit_dwell_completion_sample('event-seed','run-seed',1::smallint,'fixture','카페','북카페',$1,$2,$3,consent_epoch,revision) status from public.dwell_personalization_consents where user_id=$3`,[dwell,minute,owner]);
 const items=[{sourceCompletionId:'guest-fixture',courseRunId:'guest-run',completedAtMinute:minute,places}];
 const guest=(input=items)=>db.query('select * from public.import_guest_course_completions($1,$2)',['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',JSON.stringify(input)]);
 const snapshot=async()=>{
   const out={};
   for(const {tablename} of (await db.query("select tablename from pg_tables where schemaname in ('public') order by tablename")).rows)
     out[tablename]=(await db.query(`select to_jsonb(t) value from public.${tablename} t order by to_jsonb(t)::text`)).rows;
   out.auth=(await db.query('select to_jsonb(t) value from auth.users t order by id')).rows;return out;
 };
 // A synthetic existing completion enables reaching the sample hash independently of the broken writer.
 await db.query(`insert into public.account_course_completions(user_id,completion_id,course_run_id,completed_at,provenance,owner_generation,payload_hash)
 values($1,'completion-seed','run-seed',to_timestamp($2*60),'account_completed',1,decode('00','hex'))`,[owner,minute]);
 await db.query(`insert into public.account_course_completion_places(completion_id,stop_ordinal,content_id,title,category,sub_category)
 select id,1,'fixture','fixture','카페','북카페' from public.account_course_completions where completion_id='completion-seed'`);
 await db.query('select public.get_account_record_generation()');
 await db.query('set role authenticated');
 if(mode==='digest-extensions'){
   for(const [label,call] of [['completion',()=>write('red')],['sample',()=>sample()],['guest',()=>guest()]]){
     await assert.rejects(call,e=>e.code==='42883'&&/digest/.test(e.message));checks++;console.log(`RED reproduced ${label}: 42883`);
   }
 }else{assert.equal((await write('existing')).rows[0].status,'created');assert.equal((await sample()).rows[0].status,'accepted');assert.equal((await guest()).rows[0].status,'acknowledged');checks+=3;}
 await db.query('reset role');
 const before=await snapshot();
 const catalog=async()=> (await db.query(`select oid,proname,prosrc,proconfig,proacl,proowner,prosecdef,provolatile,prorettype,proargtypes::text from pg_proc where pronamespace='public'::regnamespace order by oid`)).rows;
 const prior=await catalog();
 const file=new URL('../supabase/migrations/202609080017_qualify_pgcrypto_digest.sql',import.meta.url);
 const migration=fs.readFileSync(file,'utf8');
 // Drift at the last target must abort even after the first two function replacements.
 await db.query('begin');
 const third=prior.find(x=>x.proname==='submit_dwell_completion_sample');
 const definition=(await db.query('select pg_get_functiondef($1) definition',[third.oid])).rows[0].definition;
 await db.query(definition.replace(third.prosrc,third.prosrc+'\n'));
 await assert.rejects(()=>db.query(migration),e=>/digest_target_source_mismatch/.test(e.message));
 await db.query('rollback');assert.deepEqual(await catalog(),prior);assert.deepEqual(await snapshot(),before);checks++;
 await db.query('begin');try{await db.query(migration);await db.query('commit');}catch(e){await db.query('rollback');throw e;}
 assert.deepEqual(await snapshot(),before);checks++;
 const after=await catalog(),schema=mode==='digest-extensions'?'extensions':'public';
 for(let i=0;i<prior.length;i++){
   const expected={...prior[i],prosrc:names.includes(prior[i].proname)?prior[i].prosrc.replaceAll('digest(',`${schema}.digest(`):prior[i].prosrc};
   assert.deepEqual(after[i],expected);
 }checks++;
 await db.query('set role authenticated');
 assert.equal((await write('green')).rows[0].status,'created');
 assert.equal((await write('green')).rows[0].status,'already_completed');
 assert.equal((await write('green','changed')).rows[0].status,'idempotency_conflict');checks+=3;
 assert.equal((await sample()).rows[0].status,mode==='digest-public'?'already_accepted':'accepted');
 assert.equal((await sample()).rows[0].status,'already_accepted');
 assert.equal((await sample(41)).rows[0].status,'idempotency_conflict');checks+=3;
 assert.equal((await guest()).rows[0].status,mode==='digest-public'?'already_acknowledged':'acknowledged');
 assert.equal((await guest()).rows[0].status,'already_acknowledged');
 await assert.rejects(()=>guest([{...items[0],courseRunId:'changed'}]),e=>/idempotency_conflict/.test(e.message));checks+=3;
 await db.query('reset role');
 const final=await snapshot();
 for(const table of Object.keys(before))for(const row of before[table]){
   // Sample submit refreshes profile timestamps by contract; compare unaffected existing tables exactly.
   if(table==='dwell_personalization_profiles')continue;
   assert.ok(final[table].some(x=>JSON.stringify(x)===JSON.stringify(row)),`existing row changed: ${table}`);
 }checks++;
 assert.equal((await db.query("select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto'")).rows[0].nspname,schema);checks++;
 console.log(`${mode}: ${checks} PASS; original function contracts/ACL/source except qualification preserved`);
}finally{await db.end();}
