import assert from 'node:assert/strict';
import pg from 'pg';
import { captureCManifest, sealCManifest, cleanupCManifest, createCBaselineReceipt } from './lib/cValidationCleanup.mjs';

// No URL, env loading, TCP, or remote fallback. Only the disposable harness socket.
const [host, port] = process.argv.slice(2);
assert.match(host ?? '', /^\/private\/tmp\/timefit-release-identity\.[a-zA-Z0-9]+$/);
const config = { host, port: Number(port), user: 'postgres', database: 'postgres' };
const db = new pg.Client(config); await db.connect();
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let checks = 0;
try {
  await db.query(`insert into public.signup_consent_documents(document_id,document_version,document_url,active,approved_at) values
    ('terms-of-service','fixture','https://fixture.invalid/terms',true,now()),
    ('privacy-policy','fixture','https://fixture.invalid/privacy',true,now())`);
  for (const id of [owner, other]) {
    await db.query(`insert into auth.users(id,raw_user_meta_data) values($1,$2)`, [id, JSON.stringify({ signup_request_id: id, required_consents: {
      terms: {document_id:'terms-of-service',document_version:'fixture',accepted:true},
      privacy: {document_id:'privacy-policy',document_version:'fixture',accepted:true},
    } })]);
  }
  async function actor(client, id = owner) {
    await client.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`, [id, JSON.stringify({sub:id,is_anonymous:false})]);
  }
  await actor(db);
  await db.query(`select * from public.set_dwell_personalization_consent('fixture-enable',true,0)`);
  await db.query(`select public.get_account_record_generation()`);
  async function visit(client, id, sub = '북카페', dwell = 30, subject = owner) {
    const places = [{stopOrdinal:1,contentId:'fixture-place',title:'fixture',category:'카페',subCategory:sub}];
    const result = await client.query(`select public.write_account_course_completion($1,$2,floor(extract(epoch from now())/60)::bigint,1,$3) status`, [`completion-${id}`,`run-${id}`,JSON.stringify(places)]);
    assert.equal(result.rows[0].status,'created');
    const sample = await client.query(`select public.submit_dwell_completion_sample($1,$2,1::smallint,'fixture-place','카페',$3,$4,floor(extract(epoch from now())/60)::bigint,$5,consent_epoch,revision) status from public.dwell_personalization_consents where user_id=$5`, [`event-${id}`,`run-${id}`,sub,dwell,subject]);
    assert.equal(sample.rows[0].status,'accepted');
  }
  for (let i=0;i<3;i++) { await visit(db,`old-${i}`); await visit(db,`other-key-${i}`,'커피전문점',40); }
  await actor(db,other);await db.query(`select * from public.set_dwell_personalization_consent('fixture-other-enable',true,0)`);
  await visit(db,'other-owner','북카페',25,other);await actor(db);
  const ids = [1,2,3].map(i=>({runId:`run-c-${i}`,completionId:`completion-c-${i}`,eventId:`event-c-${i}`}));
  const baseline = await captureCManifest(db,{owner,ids});
  const receipt=createCBaselineReceipt({...baseline,executionId:'fixture-cleanup-01'});
  assert.deepEqual(receipt,{executionId:'fixture-cleanup-01',owner,ids,baselineCaptured:true});
  assert.equal('baseline' in receipt,false);checks++;
  await assert.rejects(()=>captureCManifest(db,{owner,ids:[...ids,ids[0]]})); checks++;
  await assert.rejects(()=>captureCManifest(db,{owner,ids:[{runId:'run-old-0',completionId:'completion-old-0',eventId:'event-old-0'}]})); checks++;
  for(let i=1;i<=3;i++) await visit(db,`c-${i}`,'북카페',50+i);
  const manifest = await sealCManifest(db,baseline);
  await db.query(`update public.dwell_personalization_consents set revision=revision+1 where user_id=$1`,[owner]);
  await assert.rejects(()=>cleanupCManifest(db,manifest));
  await db.query(`update public.dwell_personalization_consents set revision=revision-1 where user_id=$1`,[owner]); checks++;
  const digest = async()=> (await db.query(`select jsonb_build_object('c',(select jsonb_agg(to_jsonb(t) order by id) from public.account_course_completions t),'s',(select jsonb_agg(to_jsonb(t) order by id) from public.dwell_completion_samples t),'p',(select jsonb_agg(to_jsonb(t) order by user_id,category,sub_category) from public.dwell_personalization_profiles t),'t',(select jsonb_agg(to_jsonb(t) order by user_id,course_run_id) from public.account_completion_tombstones t)) value`)).rows[0].value;
  const before = await digest();
  await assert.rejects(()=>cleanupCManifest(db,{...manifest,owner:other}));
  assert.deepEqual(await digest(),before); checks++;
  const bad = structuredClone(manifest); bad.rows.samples.pop();
  await assert.rejects(()=>cleanupCManifest(db,bad));
  assert.deepEqual(await digest(),before); checks++;
  // Fail *after* DELETEs to demonstrate transaction rollback, not just validation refusal.
  let injected = false;
  const fault = {query:async(sql,args)=>{ if(sql.startsWith('insert into public.dwell_personalization_profiles')) {injected=true;throw Error('fixture_failure');} return db.query(sql,args); }};
  await assert.rejects(()=>cleanupCManifest(fault,manifest));
  assert.equal(injected,true); assert.deepEqual(await digest(),before); checks++;
  // A normal writer arrives after cleanup locks: must wait, then commit without loss.
  const writer = new pg.Client(config); await writer.connect(); await actor(writer);
  const lateWriter=new pg.Client(config);await lateWriter.connect();await actor(lateWriter);
  let pending, latePending, entered = false, finished = false;
  const concurrent = {query:async(sql,args)=>{
    const result = await db.query(sql,args);
    if(sql.startsWith('lock table public.account_course_completions')) {
      entered=true;
      pending=visit(writer,'concurrent','북카페',35).then(()=>{finished=true;});
      latePending=lateWriter.query(`select public.write_account_course_completion('completion-c-1','run-c-1',floor(extract(epoch from now())/60)::bigint,1,'[{"stopOrdinal":1,"contentId":"fixture-place","title":"fixture","category":"카페","subCategory":"북카페"}]') status`);
      // Wait until PostgreSQL reports lock wait rather than relying on a sleep race.
      for(let i=0;i<100;i++) {
        const q=await db.query(`select wait_event_type from pg_stat_activity where pid=$1`,[writer.processID]);
        if(q.rows[0]?.wait_event_type==='Lock') break;
        if(i===99) throw Error('writer_did_not_wait');
      }
      assert.equal(finished,false);
    }
    if(sql.startsWith('select to_jsonb(t) value from public.dwell_personalization_profiles') && entered) {
      // Final profile SELECT is still protected by cleanup's transaction locks.
      const profile=result.rows.map(x=>x.value).find(x=>x.sub_category==='커피전문점');
      if(profile && !result.rows.some(x=>x.value.sub_category==='북카페' && x.value.sample_count===6))
        assert.deepEqual(profile,baseline.baseline.profiles.find(x=>x.sub_category==='커피전문점'));
    }
    return result;
  }};
  await cleanupCManifest(concurrent,manifest); await pending; await writer.end();
  assert.equal((await latePending).rows[0].status,'stale_generation');await lateWriter.end();
  assert.equal(entered && finished,true); checks++;
  assert.equal((await db.query(`select count(*)::int n from public.dwell_completion_samples where completion_event_id like 'event-c-%'`)).rows[0].n,0);
  assert.equal((await db.query(`select count(*)::int n from public.dwell_completion_samples`)).rows[0].n,8);
  const profile=(await db.query(`select sample_count,median_dwell_min from public.dwell_personalization_profiles where user_id=$1 and sub_category='북카페'`,[owner])).rows[0];
  assert.equal(profile.sample_count,4);assert.equal(Number(profile.median_dwell_min),30);
  assert.equal((await db.query(`select count(*)::int n from public.dwell_completion_samples where user_id=$1`,[other])).rows[0].n,1);
  checks++;
  // Tombstones reject stale completion retries after local retirement/restart.
  const retry=await db.query(`select public.write_account_course_completion('completion-c-1','run-c-1',floor(extract(epoch from now())/60)::bigint,1,'[{"stopOrdinal":1,"contentId":"fixture-place","title":"fixture","category":"카페","subCategory":"북카페"}]') status`);
  assert.equal(retry.rows[0].status,'stale_generation'); checks++;
  const after=await digest(); await assert.rejects(()=>cleanupCManifest(db,manifest)); assert.deepEqual(await digest(),after); checks++;
  // A partial C run can have a completion but zero accepted samples.
  const partial=await captureCManifest(db,{owner,ids:[{runId:'run-partial',completionId:'completion-partial',eventId:'event-partial'}]});
  await db.query(`select public.write_account_course_completion('completion-partial','run-partial',floor(extract(epoch from now())/60)::bigint,1,'[{"stopOrdinal":1,"contentId":"fixture-place","title":"fixture","category":"카페","subCategory":"북카페"}]')`);
  const partialSealed=await sealCManifest(db,partial);
  assert.equal(partialSealed.rows.samples.length,0);
  assert.deepEqual(await cleanupCManifest(db,partialSealed),{status:'cleaned',completions:1,samples:0,tombstones:1});checks++;
  // Existing normal writer lock: bounded failure leaves exact pre-cleanup data intact.
  const blocked=await captureCManifest(db,{owner,ids:[{runId:'run-blocked',completionId:'completion-blocked',eventId:'event-blocked'}]});
  const blocker=new pg.Client(config);await blocker.connect();
  await blocker.query('begin; lock table public.dwell_completion_samples in share row exclusive mode');
  const blockedBefore=await digest();
  try {await assert.rejects(()=>cleanupCManifest(db,{...blocked,rows:{completions:[],samples:[],places:[],tombstones:[]}}),e=>e.code==='55P03');}
  finally {await blocker.query('rollback');await blocker.end();}
  assert.deepEqual(await digest(),blockedBefore);checks++;
  console.log(`C cleanup local PASS: ${checks} checks; synthetic DB only`);
} finally { await db.end(); }
