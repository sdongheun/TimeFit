import test from 'node:test';
import assert from 'node:assert/strict';
import {screenRuntime} from './ui/support/screenRuntime.mjs';
import {createGuestCompletionImportRepository,createMemoryGuestImportStore} from '../src/services/guestCompletionImportRepository';
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const record={schemaVersion:1 as const,completionId:'fixture-legacy',courseRunId:'fixture-run',completedAt:1788790000000,trigger:'explicit_course_finish' as const,places:[{contentId:'fixture-place',title:'fixture',category:'카페',subCategory:'북카페',plannedStayMin:30,actualDwellMin:40}]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const identity={async resolve(){return {status:'account' as const,identity:{subject:owner}};}} as any;
async function withoutCrypto(work:()=>Promise<void>){const prior=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});try{await work();}finally{if(prior)Object.defineProperty(globalThis,'crypto',prior);else delete (globalThis as any).crypto;}}
test('guest default without secure UUID must not persist an unusable request',async()=>withoutCrypto(async()=>{
 const pending=createMemoryGuestImportStore();
 const repo=createGuestCompletionImportRepository({identity,pending,source:{async removeByIds(){throw Error('unexpected delete');}},remote:{async import(){throw Error('unexpected RPC');}}});
 assert.equal((await repo.prepareGuestCompletionImport({records:[record]})).status,'unavailable');
 assert.equal(await pending.read(),null);
}));
test('production factory supplies native UUID to standalone and runtime without global crypto',async()=>withoutCrypto(async()=>{
 const values=new Map<string,string>();let ids=0,rpcs=0,removed=0;
 const storage={async getItem(k:string){return values.get(k)??null;},async setItem(k:string,v:string){values.set(k,v);},async removeItem(k:string){values.delete(k);}};
 const legacy={async read(){return {status:'ok',records:[record]};},async removeByCompletionIds(){removed++;return {status:'removed'};}};
 const supabase={auth:{async getSession(){return {data:{session:{access_token:'fixture-token',expires_at:9999999999}},error:null};},async getUser(){return {data:{user:{id:owner,is_anonymous:false}},error:null};},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},
 async rpc(name:string,input:any){assert.equal(name,'import_guest_course_completions');rpcs++;if(!uuid.test(input.p_import_id))return {data:null,error:{code:'22P02'}};assert.equal(input.p_items[0].completedAtMinute,Math.floor(record.completedAt/60000));assert.doesNotMatch(JSON.stringify(input),/actualDwell|plannedStay/);return {data:[{status:'acknowledged',accepted_source_ids:[record.completionId],rejected_source_ids:[]}],error:null};}};
 const load=()=>screenRuntime({'@react-native-async-storage/async-storage':storage,'expo-modules-core':{uuid:{v4:()=>{ids++;return id;}}},'./supabase':{supabase},'./courseCompletionAsyncStorage':{courseCompletionRepository:legacy}}).load('src/services/releaseIdentitySupabase.ts');
 let app=load();
 const p=await app.approveGuestCompletionImport({sourceCompletionIds:[record.completionId]});
 assert.equal(p.status,'prepared');assert.equal(p.importId,id);assert.equal(ids,1);
 app=load(); // Restore exact durable pending, not a replacement request.
 assert.equal((await app.approveGuestCompletionImport({sourceCompletionIds:[record.completionId]})).importId,id);assert.equal(ids,1);
 assert.equal((await app.continueGuestCompletionImport({importId:id})).status,'source_removed');assert.equal(rpcs,1);assert.equal(removed,1);
 const direct=await app.supabaseGuestCompletionImportRepository.prepareGuestCompletionImport({records:[record]});assert.equal(direct.importId,id);assert.equal(ids,2);
 // Actual production stores must share the same serialization identity; the UI still holds the old ID.
 const key='@timefit/guest-completion-import-pending-v1',old='import-1788800000000-abc123xyz';
 const saved=JSON.parse(values.get(key)!);values.set(key,JSON.stringify({...saved,importId:old}));
 app=load();
 assert.equal((await app.approveGuestCompletionImport({sourceCompletionIds:[record.completionId]})).importId,old);
 assert.equal(ids,2); // Preparation alone must not recover.
 const results=await Promise.all([
  app.supabaseGuestCompletionImportRepository.importGuestCourseCompletions({importId:old}),
  app.continueGuestCompletionImport({importId:old}),
 ]);
 assert.equal(results[0].status,'acknowledged');assert.equal(results[1].status,'source_removed');
 assert.equal(ids,3);assert.equal(rpcs,2);assert.equal(removed,2);assert.equal(values.has(key),false);
}));
test('existing malformed pending is preserved unchanged, never assigned a replacement ID',async()=>withoutCrypto(async()=>{
 const pending=createMemoryGuestImportStore(),old={importId:'import-legacy-invalid',targetSubject:owner,state:'prepared' as const,items:[],acceptedSourceIds:[]};await pending.write(old);
 let generated=0;
 const repo=createGuestCompletionImportRepository({identity,pending,createImportId:()=>{generated++;return id;},source:{async removeByIds(){throw Error('unexpected delete');}},remote:{async import(){throw Error('22P02 fixture');}}});
 assert.equal((await repo.prepareGuestCompletionImport({records:[record]})).status,'prepared');
 assert.equal((await repo.importGuestCourseCompletions({importId:old.importId})).status,'unavailable');
 assert.deepEqual(await pending.read(),old);assert.equal(generated,0);
}));
test('secure default UUID, same pending after response loss, partial ack and cleanup failure preserve sources',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{value:{randomUUID:()=>id},configurable:true});
 try{
 const pending=createMemoryGuestImportStore(),sources=new Set([record.completionId,'rejected']);let calls=0,cleanupFails=true;
 const deps={identity,pending,source:{async removeByIds(ids:readonly string[]){if(cleanupFails)throw Error('storage fixture');for(const x of ids)sources.delete(x);}},remote:{async import(input:any){assert.equal(input.importId,id);calls++;if(calls===1)throw Error('response lost');return {status:'already_acknowledged' as const,importId:id,acceptedSourceIds:[record.completionId],rejectedSourceIds:['rejected']};}}};
 const repo=createGuestCompletionImportRepository(deps);
 const input={records:[record,{...record,completionId:'rejected',courseRunId:'rejected-run'}]};
 assert.equal((await repo.prepareGuestCompletionImport(input)).importId,id);
 assert.equal((await repo.importGuestCourseCompletions({importId:id})).status,'unavailable');
 assert.equal(sources.size,2);
 const cold=createGuestCompletionImportRepository(deps);
 assert.equal((await cold.prepareGuestCompletionImport(input)).importId,id);
 assert.equal((await cold.importGuestCourseCompletions({importId:id})).status,'already_acknowledged');
 assert.equal((await cold.finalizeGuestCompletionImport({importId:id})).status,'cleanup_pending');
 assert.equal((await pending.read())?.state,'acknowledged');assert.equal(sources.size,2);
 cleanupFails=false;assert.equal((await cold.finalizeGuestCompletionImport({importId:id})).status,'source_removed');
 assert.deepEqual([...sources],['rejected']);assert.equal(await pending.read(),null);
 }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete (globalThis as any).crypto;}
});
test('inflight import account switch or logout never authorizes source cleanup',async()=>{
 for(const next of ['other',null]){
 let subject:string|null=owner,release:()=>void=()=>{};
 const pending=createMemoryGuestImportStore();let removed=0;
 const gate=new Promise<void>(r=>release=r);
 const repo=createGuestCompletionImportRepository({identity:{async resolve(){return subject?{status:'account',identity:{subject}}:{status:'account_required'};}} as any,pending,createImportId:()=>id,
 source:{async removeByIds(){removed++;}},remote:{async import(){await gate;return {status:'acknowledged',importId:id,acceptedSourceIds:[record.completionId],rejectedSourceIds:[]};}}});
 await repo.prepareGuestCompletionImport({records:[record]});
 const running=repo.importGuestCourseCompletions({importId:id});await new Promise(r=>setImmediate(r));subject=next;release();await running;
 assert.notEqual((await repo.finalizeGuestCompletionImport({importId:id})).status,'source_removed');assert.equal(removed,0);
 assert.equal((await pending.read())?.targetSubject,owner);
 }
});
