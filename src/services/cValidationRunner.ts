import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {matchesCBaselineReceipt} from './cValidationReceipt';
import {createCValidationPreparation} from './cValidationPreparation';
import {createAccountIdentityResolver,createSupabaseAccountAuthPort,type SupabaseAccountAuthLike} from './accountIdentity';
import {createCourseCompletionRepository,type CourseCompletionStorage} from './courseCompletionRepository';
import {createReleaseIdentityPersonalizationRuntime} from './releaseIdentityPersonalizationRuntime';
import {createAccountCompletionWritePort,createDwellSamplePort} from './releaseIdentitySupabasePorts';
import {buildReleaseOneStopRepresentativeCourseV1} from '../engine';
import {deriveDwellPersonalizationV1,type DwellPersonalizationSampleV1} from '../engine/dwellPersonalization';

export type CValidationId = Readonly<{runId:string;completionId:string;eventId:string}>;
export type CValidationPlan = Readonly<{executionId:string;owner:string;ids:readonly CValidationId[];clockMs:number}>;
export type CBaselineReceipt = Readonly<{executionId:string;owner:string;ids:readonly CValidationId[];baselineCaptured:true}>;
type SampleRow = {id:string;user_id:string;completion_event_id:string;course_run_id:string;category:string;sub_category:string;actual_dwell_min:number;completed_at:string;content_id:string};
type Stage='idle'|'awaiting_baseline'|'running'|'verified'|'stopped';
type Reason='unavailable'|'consent_required'|'consent_changed'|'owner_changed'|'expired_existing_samples'|'baseline_too_large'|'id_collision'|'clock_stale'|'runtime_failed'|'sync_failed'|'sample_mismatch'|'baseline_changed'|'interrupted';
class Halt extends Error {constructor(readonly reason:Reason){super(reason);}}
const place={contentId:'poi_1158',title:'히떼로스터리',category:'카페',subCategory:'커피전문점',plannedStayMin:30,actualDwellMin:40};

/** No implicit execution, no admin capability. UI calls prepare, then run with operator baseline receipt. */
export function createCValidationRunner(deps:Readonly<{
  auth:SupabaseAccountAuthLike;currentAppOwner():string|null;storage:CourseCompletionStorage;executionId:string;
  url:string;publicKey:string;createToken():string;now?:()=>number;fetch?:typeof fetch;
}>) {
  const now=deps.now??Date.now;
  const preparation=createCValidationPreparation({...deps,createOwnerClient:(token:string)=>createClient(deps.url,deps.publicKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{Authorization:`Bearer ${token}`},...(deps.fetch?{fetch:deps.fetch}:{})},
  })});
  let stage:Stage='idle',completed=0,submitted=0,interrupted=false,started=false,preparing=false;
  let entered=false,claimStatus:'not_attempted'|'pending'|Awaited<ReturnType<typeof preparation.claimExecution>>['status']='not_attempted';
  let failureReason:string|null=null;
  let plan:CValidationPlan|null=null,baseline:SampleRow[]=[],consentSignature='';
  let runtime:ReturnType<typeof createReleaseIdentityPersonalizationRuntime>|null=null;
  const check=()=>{if(interrupted)throw new Halt('interrupted');if(!plan || deps.currentAppOwner()!==plan.owner)throw new Halt('owner_changed');if(started && now()-plan.clockMs>300000)throw new Halt('clock_stale');};
  async function request<T>(work:(client:SupabaseClient)=>Promise<T>):Promise<T> {
    check();const result=await preparation.withVerifiedOwner({expectedOwner:plan!.owner},async client=>{
      try{check();return {ok:true as const,value:await work(client)};}
      catch(e){return {ok:false as const,reason:e instanceof Halt?e.reason:'unavailable' as const};}
    });
    if(result.status!=='completed')throw new Halt(result.status==='owner_changed'?'owner_changed':'unavailable');
    check();if(!result.value.ok)throw new Halt(result.value.reason);return result.value.value;
  }
  async function readConsent(client:SupabaseClient) {
    const {data,error}=await client.from('dwell_personalization_consents').select('enabled,consent_epoch,revision,updated_at').eq('user_id',plan!.owner).maybeSingle();
    if(error)throw new Halt('unavailable');
    if(!data?.enabled || !data.consent_epoch)throw new Halt('consent_required');
    const signature=JSON.stringify([data.consent_epoch,Number(data.revision)]);
    if(consentSignature && signature!==consentSignature)throw new Halt('consent_changed');
    return {enabled:true,consentEpoch:String(data.consent_epoch),revision:Number(data.revision),updatedAt:String(data.updated_at)};
  }
  async function readRows(client:SupabaseClient) {
    const {data,error}=await client.from('dwell_completion_samples').select('id,user_id,completion_event_id,course_run_id,category,sub_category,actual_dwell_min,completed_at,content_id')
      .eq('user_id',plan!.owner).order('id').range(0,999);
    if(error)throw new Halt('unavailable');
    const rows=(data??[]) as SampleRow[];
    if(rows.length>=1000)throw new Halt('baseline_too_large');
    // Ten-minute headroom prevents read RPC's expiry purge crossing the short C window.
    if(rows.some(s=>!Number.isFinite(Date.parse(s.completed_at)) || Date.parse(s.completed_at)<now()-180*86400000+600000))throw new Halt('expired_existing_samples');
    if(rows.some(s=>s.user_id!==plan!.owner))throw new Halt('owner_changed');
    return rows;
  }
  async function snapshot() {
    return request(async(client)=>{
      const consent=await readConsent(client),samples=await readRows(client);
      const {data,error}=await client.from('account_course_completions').select('completion_id,course_run_id').eq('user_id',plan!.owner)
        .or(`completion_id.in.(${plan!.ids.map(x=>x.completionId).join(',')}),course_run_id.in.(${plan!.ids.map(x=>x.runId).join(',')})`);
      if(error)throw new Halt('unavailable');return {consent,samples,completions:data??[]};
    });
  }
  const recommendation=async(samples:readonly DwellPersonalizationSampleV1[])=>{
    const result=await buildReleaseOneStopRepresentativeCourseV1({
      now:new Date(plan!.clockMs),origin:{id:'c-origin',lat:35.15,lon:129.06},destination:{id:'c-destination',lat:35.16,lon:129.07},remainingMin:80,arrivalBufferMin:10,
      provider:{listRepresentativeCandidates:()=>[{id:place.contentId,title:place.title,lat:35.151,lon:129.061,category:place.category,subCategory:place.subCategory,
        classification:'representative_standard',minStayMin:20,recommendedStayMin:30,maxStayMin:60,
        availability:{status:'structured',alwaysAccessible:true,dayTypes:['weekday','weekend'],windows:[]}}]},
      routes:{async getRoute(){throw new Halt('runtime_failed');}},
      receiptRoutes:{async getRouteReceipt(){return {result:'exact',route:{mode:'walk',min:5,exact:true},newProviderAttemptCount:0,reused:true};}},
      dwellPersonalizationSamples:samples,
    });
    const course=result.representativeCourse;if(!course?.stops[0])throw new Halt('runtime_failed');
    const personalization=deriveDwellPersonalizationV1({category:place.category,subCategory:place.subCategory,minStayMin:20,recommendedStayMin:30,maxStayMin:60,samples});
    return {stayMin:course.stops[0].stayMin,personalization,course};
  };
  const deny=async():Promise<never>=>{throw new Halt('runtime_failed');};
  function makeRuntime() {
    const rawIdentity=createAccountIdentityResolver(createSupabaseAccountAuthPort(deps.auth));
    let nextCompletion=0;
    return createReleaseIdentityPersonalizationRuntime({
      storage:preparation.scopedStorage,legacyCompletions:createCourseCompletionRepository(preparation.scopedStorage),
      identity:{async resolve(){const r=await rawIdentity.resolve();return r.status==='account' && r.identity.subject===plan!.owner && !interrupted && deps.currentAppOwner()===plan!.owner?r:{status:'unavailable'};}},
      accountRemote:{readGeneration:()=>request(c=>createAccountCompletionWritePort(c).readGeneration()),write:input=>request(c=>createAccountCompletionWritePort(c).write(input)),read:deny,deleteOne:deny,deleteAll:deny},
      dwellRemote:{readConsent:()=>request(readConsent),setConsent:deny,reset:deny,
        submit:input=>request(c=>createDwellSamplePort(c).submit(input)),
        readSamples:()=>request(async c=>{await readConsent(c);await readRows(c);return createDwellSamplePort(c).readSamples();})},
      guestRemote:{import:deny},now:()=>plan!.clockMs,createDeviceScopeId:()=>deps.executionId,
      createCompletionId:()=>{const id=plan!.ids[nextCompletion++];if(!id)throw new Halt('runtime_failed');return id.completionId;},
      createEvidenceToken:deps.createToken,isEvidenceAuthReady:()=>!interrupted,
    });
  }
  return {
    getState(){return {stage,completed,submitted};},
    getExecutionDiagnostics(){return {entered,claim:claimStatus,failureReason};},
    notifyAuthChanged(){interrupted=true;preparation.notifyAuthChanged();runtime?.notifyCourseRunAuthChanged();},
    async stop(){interrupted=true;stage='stopped';return preparation.retire();},
    async prepare(input:Readonly<{expectedOwner:string}>) {
      if(started || preparing)return {status:'already_started' as const};
      if(interrupted)return {status:'stopped' as const};preparing=true;
      try {
        const ready=await preparation.prepare(input);if(ready.status!=='ready')return ready;
        if(await preparation.scopedStorage.getItem('runner-started'))return {status:'already_started' as const};
        plan={executionId:deps.executionId,owner:input.expectedOwner,clockMs:Math.floor(now()/60000)*60000,
          ids:[1,2,3].map(i=>({runId:`c-${deps.executionId}-${i}`,completionId:`c-${deps.executionId}-${i}-completion`,eventId:`c-${deps.executionId}-${i}-arrival`}))};
        const snap=await snapshot();
        if(snap.samples.length>996)throw new Halt('baseline_too_large');
        if(snap.completions.length || snap.samples.some(s=>plan!.ids.some(x=>x.eventId===s.completion_event_id || x.runId===s.course_run_id)))throw new Halt('id_collision');
        consentSignature=JSON.stringify([snap.consent.consentEpoch,snap.consent.revision]);baseline=snap.samples;
        stage='awaiting_baseline';return {status:'awaiting_baseline' as const,plan:{...plan,ids:plan.ids.map(id=>({...id}))},existingSampleCount:baseline.length};
      }catch(e){return {status:(e instanceof Halt?e.reason:'unavailable') as Reason};}
      finally{preparing=false;}
    },
    async run(input:Readonly<{baselineReceipt:CBaselineReceipt}>) {
      entered=true;
      if(started)return {status:'already_started' as const};
      const receipt=input?.baselineReceipt;
      if(!plan || stage!=='awaiting_baseline' || !matchesCBaselineReceipt(receipt,plan)){failureReason='baseline_required';return {status:'baseline_required' as const};}
      started=true;stage='running';
      failureReason=null;claimStatus='pending';
      const claim=await preparation.claimExecution();
      claimStatus=claim.status;
      if(claim.status!=='claimed'){stage='stopped';failureReason=claim.status;return claim;}
      try {
        check();if(now()-plan.clockMs>300000)throw new Halt('clock_stale');
        const beforeSnapshot=await snapshot();
        if(beforeSnapshot.completions.length)throw new Halt('id_collision');
        if(JSON.stringify(beforeSnapshot.samples)!==JSON.stringify(baseline))throw new Halt('baseline_changed');
        runtime=makeRuntime();
        const baseRead=await runtime.readDwellPersonalizationSamples();
        if(baseRead.status!=='ok' && baseRead.status!=='empty')throw new Halt('runtime_failed');
        const before=await recommendation(baseRead.samples);
        for(let i=0;i<plan.ids.length;i++) {
          check();const id=plan.ids[i];
          const begun=await runtime.beginCourseRun({courseRunId:id.runId});if(begun.status!=='captured')throw new Halt('runtime_failed');
          const prepared=await runtime.prepareRunLearningEvidence({courseRunId:id.runId,stops:[{stopId:'c-stop',stopOrdinal:1,contentId:place.contentId}]});
          if(prepared.status!=='prepared')throw new Halt('runtime_failed');
          const published=await runtime.publishRunLearningEvidence(prepared,{async storePrepared(p){return p;},async activate(p){return p;}});
          if(published.status!=='published')throw new Halt('runtime_failed');
          const accepted=await runtime.acceptConfirmationEvidence({
            receipt:{courseRunId:id.runId,stopId:'c-stop',eventId:id.eventId,baseRevision:2,type:'arrival_confirmed',source:'app_action',evidence:published.projection},
            application:{courseRunId:id.runId,stopId:'c-stop',stopOrdinal:1,firstArrivalEventId:id.eventId,arrivalBaseRevision:2,source:'app_action',outcome:'applied'},
          });if(accepted.status!=='accepted')throw new Halt('runtime_failed');
          check();const local=await runtime.completeCourseRun({courseRunId:id.runId,completedAt:plan.clockMs-(3-i)*60000,trigger:'explicit_course_finish',places:[place]});
          if(local.status!=='completed' || local.record.completionId!==id.completionId)throw new Halt('runtime_failed');completed++;
          // Count local response before any optional remote sync. Never generate a replacement ID.
          check();const sync=await runtime.retryCourseRunSync({courseRunId:id.runId});
          if(sync.status!=='synced' || sync.submittedSampleCount!==1)throw new Halt('sync_failed');submitted++;
        }
        const read=await runtime.readDwellPersonalizationSamples();if(read.status!=='ok')throw new Halt('runtime_failed');
        const afterRows=await request(readRows);
        const sampleValues=(rows:readonly DwellPersonalizationSampleV1[])=>rows.map(s=>JSON.stringify([s.category,s.subCategory,s.dwellMin])).sort().join('\n');
        if(sampleValues(read.samples)!==sampleValues(afterRows.map(s=>({category:s.category,subCategory:s.sub_category,dwellMin:Number(s.actual_dwell_min)}))))throw new Halt('baseline_changed');
        for(const old of baseline)if(!afterRows.some(s=>JSON.stringify(s)===JSON.stringify(old)))throw new Halt('baseline_changed');
        for(const id of plan.ids) {
          const matches=afterRows.filter(s=>s.completion_event_id===id.eventId && s.course_run_id===id.runId && s.content_id===place.contentId
            && s.category===place.category && s.sub_category===place.subCategory && s.actual_dwell_min===40);
          if(matches.length!==1)throw new Halt('sample_mismatch');
        }
        const after=await recommendation(read.samples);
        const cleanup=await preparation.retire();if(cleanup.status!=='retired')throw new Halt('unavailable');
        stage='verified';return {status:'verified' as const,report:{before,after,completed,submitted,existingSampleCount:baseline.length,
          observedSampleCount:afterRows.length,changed:before.stayMin!==after.stayMin,cleanup:'retired' as const}};
      }catch(e){stage='stopped';interrupted=true;failureReason=e instanceof Halt?e.reason:'unavailable';const cleanup=await preparation.retire();return {status:'stopped' as const,reason:e instanceof Halt?e.reason:'unavailable' as const,completed,submitted,cleanup:cleanup.status};}
    },
  };
}
