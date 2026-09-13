import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';

// Legacy screen save/replace is retired; keep the unchanged repository date contract
// explicitly separate from current screen behavior (no new repository wiring).
for(const remainingMin of [120,180]) for(const scenario of ['create','replace','missing','invalid','conflict','unavailable']) test(`UCOURSEDATE preserved repository ${remainingMin}/${scenario}`,async()=>{
 const started='2026-12-31T23:50:00+09:00',end=new Date(Date.parse(started)+remainingMin*60000).toISOString();
 const ctx={startedAtIso:started,startMin:1430,remainingMin,mode:'walk',modeLabel:'도보',appointment:null};
 if(scenario==='missing')delete ctx.startedAtIso;
 if(scenario==='invalid')ctx.startedAtIso='';
 if(scenario==='conflict')ctx.courseDateIssue='conflict';
 const rpc=[];
 const supabase={auth:{getUser:async()=>({data:{user:{id:'fixture-owner'}}})},from(){const q={select(){return q;},eq(){return q;},async maybeSingle(){return {data:scenario==='unavailable'?null:{starts_at:started,ends_at:end,recommendation_snapshot:{ctx}}};}};return q;},async rpc(name,args){rpc.push({name,args});return {data:[{id:'stored',created_at:started}]};}};
 const repo=screenRuntime({'./supabase':{supabase}}).load('src/services/courseRepository.ts');
 const params={origin:{lat:35.1,lon:129.1},ctx,course:{spots:[{contentId:'A',title:'A',lat:35.13,lon:129.13}],legs:[{label:'이동',min:5},{label:'체류',min:20},{label:'복귀',min:5}],totalMin:30}};
 const replacing=['replace','unavailable'].includes(scenario);
 const save=()=>replacing?repo.replaceCoursePlanInRepository('stored',params):repo.saveCourseToRepository(params);
 if(['create','replace'].includes(scenario)){
  const result=await save();assert.equal(result.ctx.startedAtIso,'2026-12-31T14:50:00.000Z');assert.equal(result.ctx.endsAtIso,end);
  assert.equal(rpc.length,1);assert.equal(rpc[0].name,replacing?'replace_course_plan':'create_course_plan');
  if(replacing){
   assert.equal('p_ends_at' in rpc[0].args,false);
   for(const elapsed of [15,30]){
    const changed=await repo.replaceCoursePlanInRepository('stored',{...params,ctx:{...result.ctx,remainingMin:remainingMin-elapsed}});
    assert.equal(changed.ctx.startedAtIso,result.ctx.startedAtIso);assert.equal(changed.ctx.endsAtIso,end);
   }
   assert.ok(rpc.every(c=>!('p_ends_at' in c.args)&&c.args.p_recommendation_snapshot.ctx.endsAtIso===end));
  }else assert.equal(rpc[0].args.p_ends_at,end);
 }else {await assert.rejects(save,e=>repo.isCourseDateError(e)&&e.code==='course_date_'+scenario);assert.equal(rpc.length,0);}
});

for(const remainingMin of [120,180]) for(const scenario of ['dated_review','repeat_review','expired_restore','expiry_during_reselection'])test(`UCOURSEDATE current CourseConfirm ${remainingMin}/${scenario}`,async()=>{
 const selected={...session,nowIso:'2026-12-31T14:50:00.000Z',remainingMin};
 const end=Date.parse(selected.nowIso)+remainingMin*60000;
 let now=Date.parse(selected.nowIso)+60000;
 class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 const calls=[];
 const overrides={__Date:Clock,'./PlacePicker':{PlacePicker:'PlacePicker'},'./MapPlacePicker':{MapPlacePicker:'MapPlacePicker'},
 '../services/kakaoLocationLabelAdapter':{createKakaoLocationLabelAdapter:()=>({})},
 '../services/courseRepository':{saveCourseToRepository(){calls.push('save');},replaceCoursePlanInRepository(){calls.push('replace');}}};
 const gate=scenario.includes('restore')||scenario.includes('reselection');
 if(gate)delete selected.manualLocation;
 // Explicitly omit proof for the old snapshot; never promote it by copying old coordinates.
 const input=gate?{nowIso:selected.nowIso,remainingMin,arrivalBufferMin:10,origin:selected.origin,destination:selected.destination}:selected;
 if(scenario==='expired_restore')now=end;
 const f=confirmFixture(course(['A']),overrides,input);
 if(gate){
  assert.ok(f.screen.get('manual-restore-gate'));
  for(const key of ['origin','destination']){
   f.screen.press('restore-'+key);f.screen.nodes(n=>n.type==='PlacePicker')[0].props.onConfirm({...selected[key],source:'provider'});f.screen.render();
  }
  now=end;f.screen.press('restore-submit');await settle();
  assert.ok(f.screen.get('restore-error'));assert.equal(f.flow.activeVerifiedCourse,null);
  assert.equal(f.screen.nodes(n=>n.props.testID==='verified-course-start').length,0);
 }else{
  assert.match(JSON.stringify(f.screen.get('course-deadline')),/1\/1/);
  const repeats=scenario==='repeat_review'?3:1;
  for(let i=0;i<repeats;i++){now+=60000;f.screen.render();assert.match(JSON.stringify(f.screen.get('course-deadline')),/1\/1/);}
  const start=f.screen.get('verified-course-start').props.onPress;start();start();await settle();
  assert.equal(f.calls.filter(c=>c==='start').length,1);assert.equal(f.flow.activeVerifiedCourse.session.nowIso,selected.nowIso);
  assert.equal(f.flow.activeVerifiedCourse.session.remainingMin,remainingMin);
 }
 assert.deepEqual(calls,[]);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0]==='route').length,0);f.screen.unmount();
});
