import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';

// Legacy save/replace is retired. Exercise fresh review and preservation of an existing run.
for(const existing of [false,true]) for(const scenario of ['exact','missing','lost_before_start']) {
 test(`ODSAY current CourseConfirm ${existing?'existing-run':'new'}/${scenario}`,async t=>{
  const requests=[],keys=[],writes=[];
  t.mock.method(globalThis,'fetch',async url=>{requests.push(String(url));throw Error('network forbidden');});
  const env=new Proxy({}, {get(_target,key){if(String(key).includes('ODSAY'))keys.push(key);return undefined;}});
  const snapshot=course(['A']);
  if(scenario==='missing')snapshot.legs=[];
  if(scenario==='lost_before_start')snapshot.legs[0].min=Infinity;
  const f=confirmFixture(snapshot,{__process:{env},
    '../services/courseRepository':{saveCourseToRepository(){writes.push('save');},replaceCoursePlanInRepository(){writes.push('replace');}},
  });
  const original=existing?{identity:'previous',courseRunId:'previous-run',session,course:course(['B']),progress:{stepIndex:1,routeOpened:false,finished:false}}:null;
  f.flow.activeVerifiedCourse=original;
  const start=f.screen.nodes(n=>n.props.testID==='verified-course-start')[0];
  if(scenario==='exact'){
    assert.ok(start);
    let buttons;f.native.Alert.alert=(_title,_copy,b)=>buttons=b;
    start.props.onPress();await settle();
    if(existing){assert.equal(f.flow.activeVerifiedCourse,original);buttons.find(b=>b.style==='cancel').onPress?.();assert.equal(f.flow.activeVerifiedCourse,original);}
    else {assert.equal(f.flow.activeVerifiedCourse.course,snapshot);assert.ok(snapshot.legs.every(l=>Number.isFinite(l.min)));assert.equal(f.calls.filter(c=>c==='start').length,1);}
  } else {
    assert.equal(start,undefined);assert.equal(f.flow.activeVerifiedCourse,original);
    assert.equal(f.calls.filter(c=>c==='start').length,0);
  }
  assert.deepEqual(requests,[]);assert.deepEqual(keys,[]);assert.deepEqual(writes,[]);
  assert.ok(!JSON.stringify(f.flow.activeVerifiedCourse).includes('ODsay'));
  f.screen.unmount();
 });
}
