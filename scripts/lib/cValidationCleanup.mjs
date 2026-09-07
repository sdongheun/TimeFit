// One-off administrator procedure, NOT a deployed RPC or a credential/CLI entry.
// Caller must separately authorize remote use. All values stay in memory/protected manifest.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

// Never attach actual/expected account rows to an exception that a caller could log.
const same = (a,b) => { if(!isDeepStrictEqual(a,b)) throw Error('c_manifest_mismatch'); };
function validate(plan) {
  assert.match(plan.owner,/^[0-9a-f-]{36}$/i);
  assert.ok(Array.isArray(plan.ids) && plan.ids.length>=1 && plan.ids.length<=3,'c_id_limit');
  for(const key of ['runId','completionId','eventId']) {
    assert.equal(new Set(plan.ids.map(x=>x[key])).size,plan.ids.length,'c_duplicate_id');
    assert.ok(plan.ids.every(x=>typeof x[key]==='string' && x[key].length>0 && x[key].length<=200),'c_invalid_id');
  }
}
async function owned(db,owner) {
  const out={};
  for(const [key,table,order] of [
    ['completions','account_course_completions','id'],['samples','dwell_completion_samples','id'],
    ['profiles','dwell_personalization_profiles','category,sub_category'],['consent','dwell_personalization_consents','user_id'],
    ['tombstones','account_completion_tombstones','course_run_id'],
  ]) out[key]=(await db.query(`select to_jsonb(t) value from public.${table} t where user_id=$1 order by ${order}`,[owner])).rows.map(x=>x.value);
  out.places=(await db.query(`select to_jsonb(p) value from public.account_course_completion_places p join public.account_course_completions c on c.id=p.completion_id where c.user_id=$1 order by p.completion_id,p.stop_ordinal`,[owner])).rows.map(x=>x.value);
  return out;
}
function selected(all,ids) {
  const runs=new Set(ids.map(x=>x.runId)), comps=new Set(ids.map(x=>x.completionId)), events=new Set(ids.map(x=>x.eventId));
  const completions=all.completions.filter(x=>runs.has(x.course_run_id)||comps.has(x.completion_id));
  return {completions,samples:all.samples.filter(x=>runs.has(x.course_run_id)||events.has(x.completion_event_id)),
    places:all.places.filter(x=>completions.some(c=>c.id===x.completion_id)),tombstones:all.tombstones.filter(x=>runs.has(x.course_run_id))};
}
export async function captureCManifest(db,plan) {
  validate(plan);
  const baseline=await owned(db,plan.owner);
  const targets=selected(baseline,plan.ids);
  for(const rows of Object.values(targets)) same(rows,[]);
  assert.equal(baseline.consent.length,1,'c_consent_required');
  assert.equal(baseline.consent[0].enabled,true,'c_consent_required');
  return structuredClone({...plan,baseline});
}
/** Operator-only handoff after capture. No baseline rows, consent secret, or credentials. */
export function createCBaselineReceipt(manifest) {
  validate(manifest);
  assert.match(manifest.executionId,/^[a-zA-Z0-9-]{8,80}$/);
  assert.equal(manifest.baseline.consent.length,1,'c_baseline_required');
  assert.equal(manifest.baseline.consent[0].enabled,true,'c_baseline_required');
  for(const rows of Object.values(selected(manifest.baseline,manifest.ids)))same(rows,[]);
  return {executionId:manifest.executionId,owner:manifest.owner,ids:manifest.ids.map(x=>({...x})),baselineCaptured:true};
}
export async function sealCManifest(db,plan) {
  validate(plan);
  const current=await owned(db,plan.owner),rows=selected(current,plan.ids);
  same(current.consent,plan.baseline.consent);
  same(rows.tombstones,[]);
  // Every present row must match the planned tuple. Partial writes are explicit, never guessed.
  assert.ok(rows.completions.length<=plan.ids.length && rows.samples.length<=plan.ids.length);
  for(const c of rows.completions) {
    assert.ok(plan.ids.some(x=>x.runId===c.course_run_id && x.completionId===c.completion_id),'c_tuple_mismatch');
    assert.equal(c.provenance,'account_completed');
    assert.equal(rows.places.filter(p=>p.completion_id===c.id).length,1,'c_one_stop_only');
  }
  for(const s of rows.samples) {
    assert.ok(plan.ids.some(x=>x.runId===s.course_run_id && x.eventId===s.completion_event_id),'c_tuple_mismatch');
    const c=rows.completions.find(x=>x.course_run_id===s.course_run_id);
    const p=rows.places.find(x=>x.completion_id===c?.id);
    assert.ok(p && p.stop_ordinal===s.stop_ordinal && p.content_id===s.content_id && p.category===s.category && p.sub_category===s.sub_category,'c_sample_mismatch');
  }
  assert.ok(new Set(rows.samples.map(s=>JSON.stringify([s.category,s.sub_category]))).size<=1,'c_one_subcategory_only');
  return structuredClone({...plan,rows});
}
const groupKey=x=>JSON.stringify([x.category,x.sub_category]);
export async function cleanupCManifest(db,manifest) {
  validate(manifest);
  await db.query('begin');
  try {
    await db.query("set local lock_timeout='3s'; set local statement_timeout='10s'");
    // Take this FIRST: the completion writer reads tombstones without row locks.
    // A SHARE ROW EXCLUSIVE lock alone would let a late SELECT see absence and then
    // insert AFTER cleanup. ACCESS EXCLUSIVE fences that check until the marker commits.
    // A deadlock/timeout is an abort, not an automatic retry. No privileges or triggers change.
    await db.query('lock table public.account_completion_tombstones in access exclusive mode');
    await db.query(`lock table public.account_course_completions,public.account_course_completion_places,public.dwell_completion_samples,public.dwell_personalization_profiles,public.dwell_personalization_consents in share row exclusive mode`);
    const current=await owned(db,manifest.owner);
    same(current.consent,manifest.baseline.consent);
    // Revalidate the full tuple and baseline absence even for a loaded/modified manifest.
    for(const rows of Object.values(selected(manifest.baseline,manifest.ids))) same(rows,[]);
    same(selected(current,manifest.ids),manifest.rows);
    same((await sealCManifest(db,manifest)).rows,manifest.rows);
    for(const key of ['completions','places','samples','tombstones']) {
      for(const row of manifest.baseline[key]) assert.ok(current[key].some(x=>JSON.stringify(x)===JSON.stringify(row)),'c_existing_row_changed');
    }
    const sampleIds=manifest.rows.samples.map(x=>x.id),completionIds=manifest.rows.completions.map(x=>x.id);
    const removedSamples=await db.query('delete from public.dwell_completion_samples where user_id=$1 and id=any($2::uuid[])',[manifest.owner,sampleIds]);
    same(removedSamples.rowCount,sampleIds.length);
    const removedPlaces=await db.query('delete from public.account_course_completion_places where completion_id=any($1::uuid[])',[completionIds]);
    same(removedPlaces.rowCount,manifest.rows.places.length);
    const removedCompletions=await db.query('delete from public.account_course_completions where user_id=$1 and id=any($2::uuid[])',[manifest.owner,completionIds]);
    same(removedCompletions.rowCount,completionIds.length);
    for(const id of manifest.ids) {
      const r=await db.query('insert into public.account_completion_tombstones(user_id,course_run_id) values($1,$2)',[manifest.owner,id.runId]);
      same(r.rowCount,1);
    }
    const remaining=await owned(db,manifest.owner);
    const affected=new Set(manifest.rows.samples.map(groupKey));
    for(const key of affected) {
      const [category,sub]=JSON.parse(key);
      await db.query('delete from public.dwell_personalization_profiles where user_id=$1 and category=$2 and sub_category=$3',[manifest.owner,category,sub]);
      await db.query(`insert into public.dwell_personalization_profiles(user_id,category,sub_category,sample_count,window_sample_count,median_dwell_min,newest_completed_at)
        select $1,$2,$3,count(*)::int,least(count(*)::int,5),
        (select percentile_cont(0.5) within group(order by actual_dwell_min) from
          (select actual_dwell_min from public.dwell_completion_samples where user_id=$1 and category=$2 and sub_category=$3
           and completed_at>=timezone('utc',now())-interval '180 days' order by completed_at desc,completion_event_id desc limit 5) recent),max(completed_at)
        from public.dwell_completion_samples where user_id=$1 and category=$2 and sub_category=$3
        and completed_at>=timezone('utc',now())-interval '180 days' having count(*)>=3`,[manifest.owner,category,sub]);
    }
    // submit's existing refresh touches ALL owner aggregates. Restore untouched groups'
    // baseline timestamps only when both their samples and semantic aggregate are identical.
    for(const prior of manifest.baseline.profiles) {
      const key=groupKey(prior);
      if(affected.has(key)) continue;
      const oldSamples=manifest.baseline.samples.filter(x=>groupKey(x)===key);
      const newSamples=remaining.samples.filter(x=>groupKey(x)===key);
      if(JSON.stringify(oldSamples)!==JSON.stringify(newSamples)) continue;
      const now=remaining.profiles.find(x=>groupKey(x)===key);
      const semantic=({updated_at,profile_version,...x})=>x;
      if(!now || JSON.stringify(semantic(now))!==JSON.stringify(semantic(prior))) continue;
      await db.query('update public.dwell_personalization_profiles set updated_at=$4,profile_version=$5 where user_id=$1 and category=$2 and sub_category=$3',
        [manifest.owner,prior.category,prior.sub_category,prior.updated_at,prior.profile_version]);
    }
    const after=await owned(db,manifest.owner);
    same(after.consent,current.consent);
    for(const key of ['samples','completions','places']) {
      const removed=manifest.rows[key];
      same(after[key],current[key].filter(x=>!removed.some(r=>JSON.stringify(r)===JSON.stringify(x))));
    }
    await db.query('commit');
    return {status:'cleaned',completions:completionIds.length,samples:sampleIds.length,tombstones:manifest.ids.length};
  } catch(error) { await db.query('rollback'); throw error; }
}
