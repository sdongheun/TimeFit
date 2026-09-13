import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmFixture,course,settle } from './fixtures/currentConfirm.mjs';
test('EXIT03 current CourseConfirm route failure/cancel never logs raw errors or revives legacy hydration',async t=>{
 const logs=[];
 t.mock.method(console,'warn',(...args)=>logs.push(args));
 t.mock.method(console,'error',(...args)=>logs.push(args));
 t.mock.method(globalThis,'fetch',()=>assert.fail('network forbidden'));
 const error=new Error('synthetic-private token=fixture lat=35.1 body=private');
 let fail=true;
 const f=confirmFixture(course(['A']),{'./execution/schedule':{
  isKakaoRouteOpenSuccess:r=>r==='app_opened',isValidKakaoRouteStage:()=>true,
  async openKakaoRouteWithFallback(){if(fail)throw error;return 'browser_fallback_cancelled';}
 }});
 f.screen.press('verified-course-start');const original=f.flow.activeVerifiedCourse;
 f.screen.press('verified-progress-primary');await settle();await settle();
 assert.equal(f.flow.activeVerifiedCourse.identity,original.identity);
 assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened,false);
 assert.match(JSON.stringify(f.screen.render()),/열지 못했어요/);
 fail=false;f.screen.press('verified-progress-primary');await settle();await settle();
 assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened,true);
 assert.equal(f.flow.activeVerifiedCourse.progress.stepIndex,0);
 assert.doesNotMatch(JSON.stringify(f.screen.render()),/열지 못했어요/);
 assert.doesNotMatch(JSON.stringify(logs),/synthetic-private|token=|lat=|body=/);
 assert.doesNotMatch(JSON.stringify(f.screen.render()),/synthetic-private/);
 f.screen.unmount();
});
