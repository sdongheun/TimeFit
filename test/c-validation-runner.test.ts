import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createCValidationRunner} from '../src/services/cValidationRunner';

// Node20 has no WebSocket; SDK initializes a constructor but C must never open realtime.
if(!globalThis.WebSocket) globalThis.WebSocket=class {constructor(){throw Error('unexpected_realtime');}} as any;

function fixture() {
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',values=new Map<string,string>();
  const calls:string[]=[],samples:any[]=[],visits:any[]=[];let actor:string|null=owner,enabled=true,fail=false,revision=1;
  let release:()=>void=()=>{},entered:()=>void=()=>{},waiting:Promise<void>|null=null;
  const now=Date.UTC(2026,8,7,12),token='fixture-normal-session';
  const transport:typeof fetch=async(input,init)=>{
    const url=new URL(String(input)),name=url.pathname.split('/').at(-1)!;
    const headers=new Headers(init?.headers);assert.equal(headers.get('authorization'),`Bearer ${token}`);
    const body=init?.body?JSON.parse(String(init.body)):null;calls.push(name);
    if(name==='write_account_course_completion' && waiting){entered();await waiting;}
    if(name==='user')return new Response(JSON.stringify({id:actor,is_anonymous:false,aud:'authenticated'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(fail && name==='write_account_course_completion')return new Response(JSON.stringify({message:'fixture-offline'}),{status:503});
    let result:any;
    switch(name) {
      case 'dwell_personalization_consents': result={enabled,consent_epoch:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',revision,updated_at:'fixture'};break;
      case 'dwell_completion_samples': result=samples;break;
      case 'account_course_completions': result=visits;break;
      case 'get_account_record_generation':result=1;break;
      case 'write_account_course_completion':visits.push({completion_id:body.p_completion_id,course_run_id:body.p_course_run_id});result='created';break;
      case 'submit_dwell_completion_sample':
        assert.ok(visits.some(v=>v.course_run_id===body.p_course_run_id));
        samples.push({id:`sample-${samples.length}`,user_id:owner,completion_event_id:body.p_completion_event_id,course_run_id:body.p_course_run_id,
          category:body.p_category,sub_category:body.p_sub_category,actual_dwell_min:body.p_actual_dwell_min,
          completed_at:new Date(body.p_completed_at_minute*60000).toISOString(),content_id:body.p_content_id});result='accepted';break;
      case 'read_dwell_personalization_samples':result=samples.map(s=>({category:s.category,sub_category:s.sub_category,dwell_min:s.actual_dwell_min}));break;
      default:throw Error(`unexpected_fixture_request:${name}`);
    }
    return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const sdk=createClient('https://fixture.supabase.co','fixture-public',{global:{fetch:transport},auth:{persistSession:false,autoRefreshToken:false}});
  const deps={auth:{async getSession(){return {data:{session:actor?{access_token:token,expires_at:9999999999}:null},error:null};},getUser:(t:string)=>sdk.auth.getUser(t)},
    currentAppOwner:()=>actor,storage:{async getItem(k:string){return values.get(k)??null;},async setItem(k:string,v:string){values.set(k,v);},async removeItem(k:string){values.delete(k);}},
    executionId:'fixture-c-runner-01',url:'https://fixture.supabase.co',publicKey:'fixture-public',fetch:transport,now:()=>now,
    createToken:(()=>{let n=0;return ()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;})()};
  return {deps,owner,calls,samples,visits,values,actor(v:string|null){actor=v;},disable(){enabled=false;},fail(){fail=true;},changeConsent(){revision++;},
    block(){waiting=new Promise<void>(r=>release=r);return new Promise<void>(r=>entered=r);},release(){release();}};
}
const receipt=(plan:any)=>({executionId:plan.executionId,owner:plan.owner,ids:plan.ids,baselineCaptured:true as const});
test('C receipt: object key order is irrelevant; values and array order remain strict',async()=>{
  const f=fixture(),r=createCValidationRunner(f.deps),p=await r.prepare({expectedOwner:f.owner});
  if(p.status!=='awaiting_baseline')throw Error('fixture');
  const original=receipt(p.plan);
  const bad=[{...original,owner:'different'},{...original,executionId:'different'},
    {...original,ids:[...original.ids].reverse()}, {...original,ids:original.ids.slice(1)},
    ...['runId','completionId','eventId'].map(key=>({...original,ids:original.ids.map((x:any,i:number)=>i===1?{...x,[key]:'different'}:x)}))];
  const calls=f.calls.length;
  for(const value of bad)assert.equal((await r.run({baselineReceipt:value})).status,'baseline_required');
  assert.equal(f.calls.length,calls);
  const reordered={baselineCaptured:true as const,ids:original.ids.map((x:any)=>({eventId:x.eventId,completionId:x.completionId,runId:x.runId})),owner:original.owner,executionId:original.executionId};
  assert.equal((await r.run({baselineReceipt:reordered})).status,'verified');
});
test('C runner: SDK transport + shared production adapter + real evidence/runtime + engine',async()=>{
  const f=fixture(),r=createCValidationRunner(f.deps);
  const prep=await r.prepare({expectedOwner:f.owner});assert.equal(prep.status,'awaiting_baseline');if(prep.status!=='awaiting_baseline')throw Error('fixture');
  assert.equal(f.visits.length,0);assert.equal(f.samples.length,0);
  const result=await r.run({baselineReceipt:receipt(prep.plan)});
  assert.equal(result.status,'verified');if(result.status!=='verified')throw Error('fixture');
  assert.equal(f.visits.length,3);assert.equal(f.samples.length,3);
  assert.equal(result.report.before.stayMin,30);assert.equal(result.report.after.stayMin,40);
  assert.equal(result.report.after.personalization.state,'applied');
  assert.equal(result.report.cleanup,'retired');
  assert.equal((await r.run({baselineReceipt:receipt(prep.plan)})).status,'already_started');
  assert.equal(f.calls.filter(x=>x==='write_account_course_completion').length,3);
  assert.equal(f.calls.filter(x=>x==='submit_dwell_completion_sample').length,3);
  assert.equal([...f.values.values()].some(v=>v.includes('fixture-normal-session')),false);
  assert.equal((await createCValidationRunner(f.deps).prepare({expectedOwner:f.owner})).status,'retired');
});
test('C runner: off consent / absent baseline / mismatched receipt cannot write',async()=>{
  const f=fixture(),r=createCValidationRunner(f.deps);f.disable();
  assert.equal((await r.prepare({expectedOwner:f.owner})).status,'consent_required');assert.equal(f.visits.length,0);
  const g=fixture(),s=createCValidationRunner(g.deps);const p=await s.prepare({expectedOwner:g.owner});if(p.status!=='awaiting_baseline')throw Error('fixture');
  assert.equal((await s.run({baselineReceipt:{...receipt(p.plan),owner:'wrong'}})).status,'baseline_required');assert.equal(g.visits.length,0);
});
test('C runner: failed sync stops at first local completion, no new IDs or retry',async()=>{
  const f=fixture(),r=createCValidationRunner(f.deps);const p=await r.prepare({expectedOwner:f.owner});if(p.status!=='awaiting_baseline')throw Error('fixture');f.fail();
  const result=await r.run({baselineReceipt:receipt(p.plan)});assert.equal(result.status,'stopped');
  assert.equal(f.calls.filter(x=>x==='write_account_course_completion').length,1);assert.equal(f.samples.length,0);
  assert.equal(r.getState().completed,1);
  assert.deepEqual(r.getExecutionDiagnostics(),{entered:true,claim:'claimed',failureReason:'sync_failed'});
});
test('C runner: auth transition before run stops writes; no admin credential or cleanup entry',async()=>{
  const f=fixture(),r=createCValidationRunner(f.deps);const p=await r.prepare({expectedOwner:f.owner});if(p.status!=='awaiting_baseline')throw Error('fixture');
  f.actor(null);r.notifyAuthChanged();await r.stop();
  assert.notEqual((await r.run({baselineReceipt:receipt(p.plan)})).status,'verified');assert.equal(f.visits.length,0);
});
test('C runner: pending server response keeps local completion observable and stop fences late sample',async()=>{
  const f=fixture(),r=createCValidationRunner(f.deps);const p=await r.prepare({expectedOwner:f.owner});if(p.status!=='awaiting_baseline')throw Error('fixture');
  const entered=f.block(),running=r.run({baselineReceipt:receipt(p.plan)});await entered;
  assert.equal(r.getState().completed,1);assert.equal((await r.stop()).status,'cleanup_pending');
  f.release();assert.equal((await running).status,'stopped');assert.equal(f.visits.length,1);assert.equal(f.samples.length,0);
  assert.equal((await r.stop()).status,'retired');
});
test('C runner: changed consent/expired existing sample/colliding IDs stop before writes',async()=>{
  const f=fixture(),r=createCValidationRunner(f.deps);const p=await r.prepare({expectedOwner:f.owner});if(p.status!=='awaiting_baseline')throw Error('fixture');f.changeConsent();
  const changed=await r.run({baselineReceipt:receipt(p.plan)});assert.equal(changed.status,'stopped');if(changed.status==='stopped')assert.equal(changed.reason,'consent_changed');assert.equal(f.visits.length,0);
  const g=fixture();g.samples.push({user_id:g.owner,completed_at:'2020-01-01T00:00:00Z'});
  assert.equal((await createCValidationRunner(g.deps).prepare({expectedOwner:g.owner})).status,'expired_existing_samples');
  const h=fixture();h.visits.push({completion_id:'collision'});
  assert.equal((await createCValidationRunner(h.deps).prepare({expectedOwner:h.owner})).status,'id_collision');
});
test('C runner: preexisting personalization is preserved; unchanged stay is not forced to change',async()=>{
  const f=fixture();for(let i=0;i<3;i++)f.samples.push({id:`old-${i}`,user_id:f.owner,completion_event_id:`old-event-${i}`,course_run_id:`old-run-${i}`,
    category:'카페',sub_category:'커피전문점',actual_dwell_min:40,completed_at:'2026-09-07T10:00:00Z',content_id:'poi_1158'});
  const old=JSON.stringify(f.samples),r=createCValidationRunner(f.deps),p=await r.prepare({expectedOwner:f.owner});if(p.status!=='awaiting_baseline')throw Error('fixture');
  const result=await r.run({baselineReceipt:receipt(p.plan)});assert.equal(result.status,'verified');if(result.status!=='verified')throw Error('fixture');
  assert.equal(result.report.changed,false);assert.equal(result.report.existingSampleCount,3);assert.equal(JSON.stringify(f.samples.slice(0,3)),old);
});
test('C runner: two prepared instances share an atomic one-time execution claim',async()=>{
  const f=fixture(),a=createCValidationRunner(f.deps),b=createCValidationRunner(f.deps);
  const p=await a.prepare({expectedOwner:f.owner});await b.prepare({expectedOwner:f.owner});if(p.status!=='awaiting_baseline')throw Error('fixture');
  const results=await Promise.all([a.run({baselineReceipt:receipt(p.plan)}),b.run({baselineReceipt:receipt(p.plan)})]);
  assert.deepEqual(results.map(r=>r.status).sort(),['already_started','verified']);assert.equal(f.visits.length,3);
  assert.deepEqual([a.getExecutionDiagnostics().claim,b.getExecutionDiagnostics().claim].sort(),['already_started','claimed']);
});
