import test from 'node:test';
import assert from 'node:assert/strict';
import { screenRuntime } from './ui/support/screenRuntime.mjs';

const start = '2026-09-08T23:50:00+09:00';
const course = { spots: [{ contentId:'place',title:'fixture',category:'문화시설',lat:35,lon:129,dwell:20,dwellSrc:'fixture' }], legs:[{label:'도보',min:10},{label:'체류',min:20},{label:'도보',min:10}],bufferLeftMin:10 };
const ctx = (startedAtIso=start, remainingMin=120) => ({startedAtIso,startMin:1430,remainingMin,mode:'walk',modeLabel:'도보',appointment:null});
const params = (context=ctx()) => ({course,origin:{lat:35,lon:129},ctx:context});
const row = (overrides={}) => ({id:'saved',status:'saved',origin_lat:35,origin_lon:129,destination_label:null,mode:'walk',starts_at:start,ends_at:'2026-09-09T01:50:00+09:00',created_at:'2026-09-09T00:05:00+09:00',recommendation_snapshot:{course,ctx:ctx(undefined)},...overrides});
function setup({rows=[row()], readError=false, account=true, lost=false}={}) {
 const calls=[];const savedAt=Date.parse('2026-09-09T00:05:00+09:00');
 class FixedDate extends Date {constructor(...a){super(...(a.length?a:[savedAt]));}static now(){return savedAt;}}
 const supabase={auth:{async getUser(){return {data:{user:account?{id:'fixture-owner',is_anonymous:false}:null},error:null};}},
  from(table){const q={select(){return q;},eq(){return q;},in(){return q;},order(){return q;},async maybeSingle(){return {data:rows[0]??null,error:readError?{}:null};},then(resolve,reject){return Promise.resolve({data:table==='courses'?rows:[],error:readError?{}:null}).then(resolve,reject);}};return q;},
  async rpc(name,args){calls.push({name,args});if(lost&&calls.length===1)return {error:{},data:null};return {data:[{id:'saved',created_at:new Date(savedAt).toISOString()}],error:null};}};
 return {...screenRuntime({__Date:FixedDate,'./supabase':{supabase}}).load('src/services/courseRepository.ts'),calls};
}
test('dated create 120/180 crosses midnight, month and year with exact RPC instants',async()=>{
 for(const date of [start,'2026-09-30T23:50:00+09:00','2026-12-31T23:50:00+09:00'])for(const minutes of [120,180]){
  const f=setup();const saved=await f.saveCourseToRepository(params(ctx(date,minutes)));
  assert.equal(saved.id,'saved');assert.equal(f.calls.length,1);
  assert.deepEqual([f.calls[0].args.p_starts_at,f.calls[0].args.p_ends_at],[new Date(date).toISOString(),new Date(Date.parse(date)+minutes*60000).toISOString()]);
 }
});
test('missing, invalid and flagged dates reject before account or guest local success',async()=>{
 for(const account of [true,false])for(const [context,code] of [
  [{...ctx(),startedAtIso:undefined},'missing'],[ctx(''),'invalid'],[ctx('2026-02-30T23:50:00Z'),'invalid'],[ctx('2026-09-08T23:50:00'),'invalid'],[ctx(start,0),'invalid'],[{...ctx(),courseDateIssue:'conflict'},'conflict'],[{...ctx(),courseDateIssue:'unexpected-value'},'invalid']]){
  const f=setup({account});await assert.rejects(f.saveCourseToRepository(params(context)),e=>f.isCourseDateError(e)&&e.code===`course_date_${code}`);assert.equal(f.calls.length,0);
 }
});
test('read restores original start; missing, corrupt and conflicting dates keep all records',async()=>{
 const noDate={...ctx(),startedAtIso:undefined};
 const rows=[row({recommendation_snapshot:{course,ctx:noDate}}),row({id:'missing',starts_at:null,ends_at:null,recommendation_snapshot:{course,ctx:noDate}}),row({id:'conflict',recommendation_snapshot:{course,ctx:ctx('2026-09-09T23:50:00+09:00')}}),row({id:'invalid',ends_at:'broken'})];
 const f=setup({rows});const result=await f.listSavedCoursesFromRepository();assert.equal(result.length,4);
 assert.equal(result[0].ctx.startedAtIso,new Date(start).toISOString());
 assert.deepEqual(result.map(x=>x.ctx.courseDateIssue),[undefined,'missing','conflict','invalid']);assert.equal(f.calls.length,0);assert.equal(rows[0].recommendation_snapshot.ctx.startedAtIso,undefined);
});
test('save existing source recovers dated origin; conflict, source lookup failure and missing row do not write',async()=>{
 const noDate={...ctx(),startedAtIso:undefined};const f=setup({rows:[row({recommendation_snapshot:{course,ctx:noDate}})]});
 await f.saveCourseToRepository({...params(noDate),courseId:'saved'});assert.equal(f.calls[0].args.p_starts_at,new Date(start).toISOString());
 for(const [options,context,code] of [[{},ctx('2026-09-09T23:50:00+09:00'),'conflict'],[{readError:true},ctx(),'unavailable'],[{rows:[]},ctx(),'unavailable']]){
  const g=setup(options);await assert.rejects(g.saveCourseToRepository({...params(context),courseId:'saved'}),e=>g.isCourseDateError(e)&&e.code===`course_date_${code}`);assert.equal(g.calls.length,0);
 }
});
test('replace validates server original and preserves endpoints with reduced remaining minutes',async()=>{
 const f=setup();const result=await f.replaceCoursePlanInRepository('saved',params(ctx('2026-09-08T14:50:00Z',30)));
 assert.equal(result.ctx.startedAtIso,'2026-09-08T14:50:00.000Z');assert.equal(f.calls[0].name,'replace_course_plan');
 assert.equal('p_starts_at' in f.calls[0].args,false);assert.equal('p_ends_at' in f.calls[0].args,false);
 assert.equal(f.calls[0].args.p_recommendation_snapshot.ctx.remainingMin,30);
 for(const options of [{readError:true},{rows:[]},{rows:[row({starts_at:'broken'})]}]){const g=setup(options);await assert.rejects(g.replaceCoursePlanInRepository('saved',params()),e=>g.isCourseDateError(e));assert.equal(g.calls.length,0);}
 const g=setup();await assert.rejects(g.replaceCoursePlanInRepository('saved',params(ctx('2026-09-09T14:50:00Z'))),e=>e.code==='course_date_conflict');assert.equal(g.calls.length,0);
 const local=setup({account:false});await assert.rejects(local.replaceCoursePlanInRepository('local-old',params({...ctx(),startedAtIso:undefined})),e=>e.code==='course_date_missing');assert.equal(local.calls.length,0);
});
test('dated create response loss keeps request UUID; exported date errors contain safe codes only',async()=>{
 const f=setup({lost:true});await f.saveCourseToRepository(params());assert.equal(f.calls.length,2);assert.equal(f.calls[0].args.p_request_id,f.calls[1].args.p_request_id);
 const e=new f.CourseDateError('course_date_missing');assert.equal(e.message,'course_date_missing');assert.equal(f.isCourseDateError(e),true);assert.equal(f.isCourseDateError(new Error('course_date_missing')),false);
});
test('end instant is identical in create RPC, snapshot and result across 120/180 calendar boundaries',async()=>{
 for(const date of [start,'2026-09-30T23:50:00+09:00','2026-12-31T23:50:00+09:00'])for(const min of [120,180]){
  const f=setup(),result=await f.saveCourseToRepository(params(ctx(date,min)));
  const end=new Date(Date.parse(date)+min*60000).toISOString();
  assert.equal(result.ctx.endsAtIso,end);assert.equal(f.calls[0].args.p_ends_at,end);assert.deepEqual(f.calls[0].args.p_recommendation_snapshot.ctx,result.ctx);
 }
});
test('original end survives read, reduced-duration replace and save from source',async()=>{
 const end='2026-09-08T16:50:00.000Z',f=setup();
 assert.equal((await f.listSavedCoursesFromRepository())[0].ctx.endsAtIso,end);
 const input={...ctx(start,30),endsAtIso:'2026-09-09T01:50:00+09:00'};
 const replaced=await f.replaceCoursePlanInRepository('saved',params(input));
 assert.equal(replaced.ctx.endsAtIso,end);assert.deepEqual(f.calls[0].args.p_recommendation_snapshot.ctx,replaced.ctx);assert.equal('p_ends_at' in f.calls[0].args,false);
 const saved=await f.saveCourseToRepository({...params(input),courseId:'saved'});
 assert.equal(saved.ctx.endsAtIso,end);assert.equal(f.calls[1].args.p_ends_at,end);assert.deepEqual(f.calls[1].args.p_recommendation_snapshot.ctx,saved.ctx);
 const local=setup({account:false});assert.equal((await local.replaceCoursePlanInRepository('local-old',params(input))).ctx.endsAtIso,end);
 await assert.rejects(local.replaceCoursePlanInRepository('local-old',params(ctx(start,30))),e=>e.code==='course_date_missing');
});
test('end conflict, invalid, original snapshot damage and lookup failure reject without writes',async()=>{
 for(const [end,code] of [['2026-09-09T02:50:00+09:00','conflict'],['broken','invalid'],[start,'invalid'],['2026-09-08T22:00:00+09:00','invalid']]){
  for(const existing of [false,true]){const f=setup();await assert.rejects(f.saveCourseToRepository({...params({...ctx(),endsAtIso:end}),...(existing?{courseId:'saved'}:{})}),e=>e.code===`course_date_${code}`);assert.equal(f.calls.length,0);}
 }
 for(const end of ['broken','2026-09-09T02:50:00+09:00']){
  const f=setup({rows:[row({recommendation_snapshot:{course,ctx:{...ctx(),endsAtIso:end}}})]});
  const records=await f.listSavedCoursesFromRepository();assert.equal(records.length,1);assert.equal(records[0].ctx.courseDateIssue,end==='broken'?'invalid':'conflict');
  await assert.rejects(f.replaceCoursePlanInRepository('saved',params()),e=>f.isCourseDateError(e));assert.equal(f.calls.length,0);
 }
 const f=setup({readError:true});await assert.rejects(f.replaceCoursePlanInRepository('saved',params({...ctx(),endsAtIso:'2026-09-09T01:50:00+09:00'})),e=>e.code==='course_date_unavailable');assert.equal(f.calls.length,0);
});
