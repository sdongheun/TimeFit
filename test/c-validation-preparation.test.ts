import test from 'node:test';
import assert from 'node:assert/strict';
import { createCValidationPreparation } from '../src/services/cValidationPreparation';
import { createReleaseIdentityPersonalizationRuntime } from '../src/services/releaseIdentityPersonalizationRuntime';
import { createCourseCompletionRepository } from '../src/services/courseCompletionRepository';
import { evidenceConfirmation } from './fixtures/liveLearningEvidenceFixture';

function fixture() {
  const values=new Map<string,string>([['existing-user-storage','preserve']]);
  const storage={async getItem(k:string){return values.get(k)??null;},async setItem(k:string,v:string){values.set(k,v);},async removeItem(k:string){values.delete(k);}};
  let owner:string|null='account-a',serverOwner='account-a',error=false,anonymous=false;
  const auth={
    async getSession(){return {data:{session:owner?{access_token:'fixture-secret',expires_at:9999999999}:null},error:error?{code:'fixture_error'}:null};},
    async getUser(token:string){assert.equal(token,'fixture-secret');return {data:{user:{id:serverOwner,is_anonymous:anonymous}},error:null};},
  };
  const dependencies={auth,storage,currentAppOwner:()=>owner,executionId:'fixture-c-01',createOwnerClient:(_token:string)=>({fixture:true})};
  return {values,storage,dependencies,setOwner(v:string|null){owner=v;},setServerOwner(v:string){serverOwner=v;},setError(){error=true;},setAnonymous(){anonymous=true;}};
}
test('C preparation: server-verified owner; safe failures never expose token or call work',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);
  assert.deepEqual(await p.prepare({expectedOwner:'account-a'}),{status:'ready',owner:'account-a'});
  assert.equal(JSON.stringify(await p.prepare({expectedOwner:'account-a'})).includes('fixture-secret'),false);
  f.setServerOwner('account-b');assert.equal((await p.prepare({expectedOwner:'account-a'})).status,'owner_changed');
  let called=false;assert.equal((await p.withVerifiedOwner({expectedOwner:'account-a'},async()=>{called=true;})).status,'owner_changed');assert.equal(called,false);
  f.setError();assert.equal((await p.prepare({expectedOwner:'account-a'})).status,'unavailable');
});
test('C preparation: missing/anonymous/session transition excluded',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);
  f.setOwner(null);assert.equal((await p.prepare({expectedOwner:'account-a'})).status,'owner_changed');
  f.setOwner('account-a');f.setAnonymous();assert.equal((await p.prepare({expectedOwner:'account-a'})).status,'account_required');
});
test('C preparation: A→B→A during work remains owner_changed, pinned client is not app session',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);await p.prepare({expectedOwner:'account-a'});
  const r=await p.withVerifiedOwner({expectedOwner:'account-a'},async(client)=>{
    assert.deepEqual(client,{fixture:true});p.notifyAuthChanged();p.notifyAuthChanged();return 'safe';
  });
  assert.equal(r.status,'owner_changed');
});
test('C preparation: durable retirement clears only isolated outbox/evidence/ack and rejects cold writes',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);
  await p.prepare({expectedOwner:'account-a'});
  for(const key of ['outbox','evidence','ack']) await p.scopedStorage.setItem(key,'fixture');
  assert.deepEqual(await p.retire(),{status:'retired'});
  const cold=createCValidationPreparation(f.dependencies);
  assert.equal((await cold.prepare({expectedOwner:'account-a'})).status,'retired');
  await assert.rejects(()=>cold.scopedStorage.setItem('outbox','late'));
  await assert.rejects(()=>cold.scopedStorage.getItem('ack'));
  assert.equal(f.values.get('existing-user-storage'),'preserve');
  assert.ok([...f.values.values()].every(v=>!v.includes('fixture-secret')));
});
test('C preparation: pending operation blocks admin cleanup; retirement survives restart and late callback',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);await p.prepare({expectedOwner:'account-a'});
  let finish!:()=>void,entered!:()=>void;
  const started=new Promise<void>(r=>entered=r),wait=new Promise<void>(r=>finish=r);
  const work=p.withVerifiedOwner({expectedOwner:'account-a'},async()=>{entered();await wait;await p.scopedStorage.setItem('ack','late');});
  await started; assert.deepEqual(await p.retire(),{status:'cleanup_pending'});
  assert.deepEqual(await createCValidationPreparation(f.dependencies).retire(),{status:'cleanup_pending'});
  finish(); assert.equal((await work).status,'unavailable');
  assert.deepEqual(await p.retire(),{status:'retired'});
});
test('C preparation: storage corruption/failure fails closed, no fresh namespace replacement',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);await p.prepare({expectedOwner:'account-a'});
  const key=[...f.values.keys()].find(k=>k!=='existing-user-storage')!;f.values.set(key,'{bad');
  assert.equal((await p.retire()).status,'unavailable');
  assert.equal((await p.prepare({expectedOwner:'account-a'})).status,'unavailable');
  assert.equal(f.values.get(key),'{bad');
});
test('C preparation: failed durable retirement never authorizes admin cleanup',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);await p.prepare({expectedOwner:'account-a'});
  const original=f.storage.setItem;f.storage.setItem=async()=>{throw Error('fixture_disk_failure');};
  assert.equal((await p.retire()).status,'unavailable');f.storage.setItem=original;
  assert.equal((await p.retire()).status,'retired');
});
test('C preparation: real runtime local completion/queue/ack cannot resubmit after namespace retirement',async()=>{
  const f=fixture(),p=createCValidationPreparation(f.dependencies);await p.prepare({expectedOwner:'account-a'});
  let writes=0,submits=0,token=0;
  const guarded=async<T>(fn:()=>Promise<T>):Promise<T>=>{
    const r=await p.withVerifiedOwner({expectedOwner:'account-a'},fn);if(r.status!=='completed')throw Error('blocked');return r.value;
  };
  const deps={storage:p.scopedStorage,identity:{async resolve(){return {status:'account' as const,identity:{kind:'account' as const,subject:'account-a'},accessToken:'fixture-only'};}},
    legacyCompletions:createCourseCompletionRepository(p.scopedStorage),
    accountRemote:{async readGeneration(){return 1;},async write(){return guarded(async()=>{writes++;return {status:'created' as const};});},async read(){return [];},async deleteOne(){throw Error('forbidden');},async deleteAll(){throw Error('forbidden');}},
    dwellRemote:{async readConsent(){return {enabled:true,consentEpoch:'fixture-epoch',revision:1,updatedAt:'now'};},async setConsent(){throw Error('forbidden');},async reset(){throw Error('forbidden');},async submit(){return guarded(async()=>{submits++;return {status:'accepted' as const};});},async readSamples(){return []; }},
    guestRemote:{async import(){throw Error('forbidden');}},now:()=>Date.UTC(2026,8,7,12),createCompletionId:()=> 'fixture-completion',createDeviceScopeId:()=> 'fixture-device',
    createEvidenceToken:()=>`00000000-0000-4000-8000-${String(++token).padStart(12,'0')}`,isEvidenceAuthReady:()=>true};
  const runtime=createReleaseIdentityPersonalizationRuntime(deps);
  await runtime.beginCourseRun({courseRunId:'fixture-run'});
  const prepared=await runtime.prepareRunLearningEvidence({courseRunId:'fixture-run',stops:[{stopId:'stop-1',stopOrdinal:1,contentId:'poi_1158'}]});
  assert.equal(prepared.status,'prepared');if(prepared.status!=='prepared')throw Error('fixture_prepare');
  const published=await runtime.publishRunLearningEvidence(prepared,{async storePrepared(p){return p;},async activate(p){return p;}});
  assert.equal(published.status,'published');if(published.status!=='published')throw Error('fixture_publish');
  const confirmation=evidenceConfirmation('fixture-run',published.projection,'app_action');
  assert.equal((await runtime.acceptConfirmationEvidence(confirmation)).status,'accepted');
  assert.equal((await runtime.completeCourseRun({courseRunId:'fixture-run',completedAt:Date.UTC(2026,8,7,11),trigger:'explicit_course_finish',places:[{contentId:'poi_1158',title:'히떼로스터리',category:'카페',subCategory:'커피전문점',plannedStayMin:30,actualDwellMin:30}]})).status,'completed');
  await runtime.retryCourseRunSync({courseRunId:'fixture-run'});
  assert.equal(writes,1);assert.equal(submits,1);
  await p.retire();
  const cold=createReleaseIdentityPersonalizationRuntime({...deps,storage:createCValidationPreparation(f.dependencies).scopedStorage});
  await cold.retryCourseRunSync({courseRunId:'fixture-run'});
  assert.notEqual((await cold.acceptConfirmationEvidence(confirmation)).status,'accepted');
  assert.equal(writes,1);assert.equal(submits,1);assert.equal(f.values.get('existing-user-storage'),'preserve');
});
