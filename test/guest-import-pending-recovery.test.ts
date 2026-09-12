import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuestCompletionImportRepository,createMemoryGuestImportStore} from '../src/services/guestCompletionImportRepository';
const old='import-1788800000000-abc123xyz',fresh='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',owner='owner-a';
const items=[{sourceCompletionId:'source',courseRunId:'run',completedAtMinute:29700000,places:[{stopOrdinal:1 as const,contentId:'place',title:'fixture',category:'카페',subCategory:null}]}];
const initial=()=>({importId:old,targetSubject:owner,state:'prepared' as const,items,acceptedSourceIds:[] as string[]});
function setup(){let actor:string|null=owner,generated=0,calls=0;const backing=createMemoryGuestImportStore(),key={},removed:string[]=[];
 const store={...backing,serializationKey:key};
 const deps={identity:{async resolve(){return actor?{status:'account',identity:{subject:actor}}:{status:'account_required'};}} as any,pending:store,createImportId:()=>{generated++;return fresh;},source:{async removeByIds(ids:readonly string[]){removed.push(...ids);}},remote:{async import(input:any){calls++;assert.equal(input.importId,fresh);assert.deepEqual(input.items,items);assert.deepEqual(Object.keys(input).sort(),['importId','items']);return {status:'acknowledged' as const,importId:fresh,acceptedSourceIds:['source'],rejectedSourceIds:[]};}}};
 return {backing,store,deps,removed,counts:()=>({generated,calls}),actor:(x:string|null)=>actor=x};}
test('legacy prepared recovery once; old UI ID, competing stores, restart and exact cleanup',async()=>{
 const f=setup();await f.backing.write(initial());
 const a=createGuestCompletionImportRepository(f.deps),b=createGuestCompletionImportRepository({...f.deps,pending:{...f.store}});
 const results=await Promise.all([a.importGuestCourseCompletions({importId:old}),b.importGuestCourseCompletions({importId:old})]);
 assert.ok(results.every(x=>['acknowledged','already_acknowledged'].includes(x.status)));
 assert.equal(f.counts().generated,1);assert.equal(f.counts().calls,1);
 const p=await f.backing.read();assert.equal(p?.importId,fresh);assert.deepEqual(p?.items,items);
 assert.equal((await b.finalizeGuestCompletionImport({importId:'import-1788800000000-unrelated'})).status,'cleanup_pending');
 assert.equal((await createGuestCompletionImportRepository(f.deps).finalizeGuestCompletionImport({importId:old})).status,'source_removed');
 assert.deepEqual(f.removed,['source']);assert.equal(await f.backing.read(),null);
});
test('recovery write failure or write-then-throw never creates another ID or loses original',async()=>{
 for(const committed of [false,true]){
 const f=setup();await f.backing.write(initial());let fail=true;
 const pending={...f.store,async write(p:any){if(fail){if(committed)await f.backing.write(p);throw Error('storage');}await f.backing.write(p);}};
 const r=createGuestCompletionImportRepository({...f.deps,pending});
 assert.equal((await r.importGuestCourseCompletions({importId:old})).status,'unavailable');
 assert.equal(f.counts().calls,committed?1:0);assert.deepEqual((await f.backing.read())?.items,items);
 fail=false;
 assert.ok(['acknowledged','already_acknowledged'].includes((await r.importGuestCourseCompletions({importId:old})).status));
 assert.equal(f.counts().generated,committed?1:2);
 }
});
test('non-target prepared/acknowledged/corrupt/account pending never rewritten',async()=>{
 for(const mutate of [(p:any)=>({...p,importId:fresh}),(p:any)=>({...p,state:'acknowledged'}),(p:any)=>({...p,acceptedSourceIds:['source']}),(p:any)=>({...p,items:[{...items[0],places:[]}]}),(p:any)=>({...p,targetSubject:'other'}),(p:any)=>({...p,importId:'arbitrary'})]){
 const f=setup(),p=mutate(initial());await f.backing.write(p);
 const r=createGuestCompletionImportRepository({...f.deps,remote:{async import(){throw Error('offline');}}});
 await r.importGuestCourseCompletions({importId:p.importId});
 assert.equal(f.counts().generated,0);assert.deepEqual(await f.backing.read(),p);
 }
});
test('owner change at recovery commit or remote response prevents acknowledgement and cleanup',async()=>{
 for(const next of ['other',null])for(const boundary of ['write','remote']){
  const f=setup();await f.backing.write(initial());
  const r=createGuestCompletionImportRepository({...f.deps,
   pending:{...f.store,async write(p:any){await f.backing.write(p);if(boundary==='write')f.actor(next);}},
   remote:{async import(input:any){const reply=await f.deps.remote.import(input);if(boundary==='remote')f.actor(next);return reply;}}});
  assert.equal((await r.importGuestCourseCompletions({importId:old})).status,'account_changed');
  assert.equal(f.counts().calls,boundary==='write'?0:1);
  assert.equal((await f.backing.read())?.state,'prepared');
  assert.notEqual((await r.finalizeGuestCompletionImport({importId:old})).status,'source_removed');assert.deepEqual(f.removed,[]);
 }
});
test('ambiguous recovery commit and failed readback stop RPC; restart reuses persisted UUID',async()=>{
 const f=setup();await f.backing.write(initial());let unreadable=false;
 const r=createGuestCompletionImportRepository({...f.deps,pending:{...f.store,
  async write(p:any){await f.backing.write(p);unreadable=true;throw Error('ambiguous');},
  async read(){if(unreadable)throw Error('read failure');return f.backing.read();}}});
 assert.equal((await r.importGuestCourseCompletions({importId:old})).status,'unavailable');
 assert.deepEqual(f.counts(),{generated:1,calls:0});assert.deepEqual(f.removed,[]);
 assert.equal((await createGuestCompletionImportRepository(f.deps).importGuestCourseCompletions({importId:old})).status,'acknowledged');
 assert.deepEqual(f.counts(),{generated:1,calls:1});
});
test('recovered request response loss, partial acceptance and cleanup failure preserve rejected sources',async()=>{
 const f=setup(),second={...items[0],sourceCompletionId:'rejected',courseRunId:'second'};
 await f.backing.write({...initial(),items:[...items,second]});
 let calls=0,failCleanup=true;const remaining=new Set(['source','rejected']);
 const deps={...f.deps,remote:{async import(input:any){
  assert.equal(input.importId,fresh);assert.equal(input.items.length,2);calls++;
  if(calls===1)throw Error('response lost');
  return {status:'already_acknowledged' as const,importId:fresh,acceptedSourceIds:['source'],rejectedSourceIds:['rejected']};
 }},source:{async removeByIds(ids:readonly string[]){if(failCleanup)throw Error('cleanup');for(const id of ids)remaining.delete(id);}}};
 assert.equal((await createGuestCompletionImportRepository(deps).importGuestCourseCompletions({importId:old})).status,'unavailable');
 const cold=createGuestCompletionImportRepository(deps);
 assert.equal((await cold.importGuestCourseCompletions({importId:old})).status,'already_acknowledged');
 assert.equal(f.counts().generated,1);assert.equal(calls,2);
 assert.equal((await cold.finalizeGuestCompletionImport({importId:old})).status,'cleanup_pending');
 assert.equal(remaining.size,2);assert.equal((await f.backing.read())?.state,'acknowledged');
 failCleanup=false;
 assert.equal((await cold.importGuestCourseCompletions({importId:old})).status,'already_acknowledged');assert.equal(calls,2);
 assert.equal((await cold.finalizeGuestCompletionImport({importId:old})).status,'source_removed');
 assert.deepEqual([...remaining],['rejected']);assert.equal(await f.backing.read(),null);
});
