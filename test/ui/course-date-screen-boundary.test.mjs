import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';

for(const remainingMin of [120,180]) for(const scenario of ['dated_review','repeat_review','expired_restore','expiry_during_reselection'])test(`UCOURSEDATE current CourseConfirm ${remainingMin}/${scenario}`,async()=>{
 const selected={...session,nowIso:'2026-12-31T14:50:00.000Z',remainingMin};
 const end=Date.parse(selected.nowIso)+remainingMin*60000;
 let now=Date.parse(selected.nowIso)+60000;
 class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 const calls=[];
 const overrides={__Date:Clock,'./PlacePicker':{PlacePicker:'PlacePicker'},'./MapPlacePicker':{MapPlacePicker:'MapPlacePicker'},
 '../services/kakaoLocationLabelAdapter':{createKakaoLocationLabelAdapter:()=>({})},
 './courseCompletionComposition':{courseCompletionRepository:{async complete(){calls.push('complete');return {status:'storage_unavailable'};}}}};
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
