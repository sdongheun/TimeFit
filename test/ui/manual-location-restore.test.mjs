import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
const session = { nowIso:'2026-09-09T03:00:00Z', remainingMin:180, arrivalBufferMin:10, origin:{id:'origin',label:'출발',lat:35.1,lon:129.1}, destination:null };
const course = {id:'one',placeIds:['A'],stops:[{placeId:'A',stayMin:20}],legs:[{mode:'walk',min:5},{mode:'walk',min:5}]};
const active = {identity:'active',courseRunId:'run',session,course,progress:{stepIndex:1,routeOpened:true,finished:false}};
const settle = async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const {withManualLocationProof,hasManualLocationProof,manualReselectionResult}=require('../../src/ui/manualLocationRestoreModel.ts');
const {reconfirmActiveCourseLocations}=require('../../src/ui/activeVerifiedCourseModel.ts');
function hostFixture() {
 const calls=[];
 class Clock extends Date { constructor(...args){super(...(args.length?args:['2026-09-09T03:10:00Z']));} static now(){return new Clock().getTime();} }
 const host=screenRuntime({
  __Date:Clock,
  '@react-navigation/native':{usePreventRemove(){}},
  './AppFlowContext':{useActiveVerifiedCourseFlow:()=>({activeVerifiedCourse:active}),useAppFlow:()=>({activeCourse:null,setActiveCourse(){calls.push('clear');}})},
  '../data/busan_poi_catalog.json':{matched:{data:[]},unmatched:{data:[]}},
  './recommendation/courseV1CardDetailModel':{buildCourseV1DetailModel:()=>null,buildCourseV1DetailMarkers:()=>null},
  './privateWalkConnectorComposition':{appPrivateWalkConnectorPort:{request(){calls.push('connector');}}},
  './courseCompletionComposition':{courseCompletionRepository:{}},
  './ownedCourseLifecycle':{ownedCourseLifecycle:{}},
  './mainTabNavigation':{},
  './KakaoRouteMap':{KakaoRouteMap:'KakaoRouteMap',buildRouteMapSegments:()=>[]},
  './liveActivity/courseProgressNotifications':{prepareLiveCourseNotifications:async()=>true},
  './liveActivity/liveActivityDiagnostics':{createDiagnosticAttemptId:()=> 'fixture',recordLiveActivityAppDiagnostic:async()=>{}},
  './liveActivity/courseProgressComposition':{liveCourseProgressRuntime:{}},
  './liveActivity/nativeLiveActivityPort':{nativePendingNavigationPort:{}},
  './personalizationComposition':{personalizationSession:{subscribe:()=>()=>{}},isPersonalizationScopeCurrent:()=>true},
  './PlacePicker':{PlacePicker:'PlacePicker'},'./MapPlacePicker':{MapPlacePicker:'MapPlacePicker'},
  '../services/kakaoLocationLabelAdapter':{createKakaoLocationLabelAdapter:()=>({resolve(){calls.push('label');}})},
  '../engine/travel':{precompute(){calls.push('route');return Promise.resolve();},precomputeTransit(){calls.push('route');return Promise.resolve();}},
  '../engine':{travelGeo:()=>[],timeContext:()=>({})},
  '../services/courseNotifications':{scheduleCourseNotifications(){calls.push('notification');return Promise.resolve({});}},
  './execution/CourseProgress':{CourseProgress:'CourseProgress'},'./FloatingTabBar':{FloatingTabBar:'FloatingTabBar'},
 });
 return {host,calls};
}
test('RESTORE old Home/LA CourseConfirm mounts only manual gate, never map or route content',async()=>{
 const {host,calls}=hostFixture();
 const screen=host.mount(host.load('src/ui/CourseConfirmScreen.tsx').CourseConfirmScreen,{route:{params:{session,course,activeId:'active'}},navigation:{addListener:()=>()=>{},goBack(){}}});
 await settle(); assert.ok(screen.get('manual-restore-gate'));
 assert.equal(screen.nodes(n=>n.type==='KakaoRouteMap').length,0);assert.deepEqual(calls,[]);screen.unmount();
});
test('RESTORE current review cannot hydrate, notify or map before manual re-selection',async()=>{
 const {host,calls}=hostFixture();
 const screen=host.mount(host.load('src/ui/CourseConfirmScreen.tsx').CourseConfirmScreen,{route:{params:{session,course}},navigation:{goBack(){}}});await settle();
 assert.ok(screen.get('manual-restore-gate'));assert.deepEqual(calls,[]);assert.equal(screen.nodes(n=>n.type==='KakaoRouteMap').length,0);screen.unmount();
});
test('RESTORE storage round trip keeps new manual proof; old write/read never promotes unknown source',async()=>{
 let raw=null;
 const host=screenRuntime({'@react-native-async-storage/async-storage':{__esModule:true,default:{async getItem(){return raw;},async setItem(k,v){raw=v;},async removeItem(){throw Error('must not clear');}}}});
 const {activeVerifiedCourseStorage:store}=host.load('src/ui/activeVerifiedCourseStorage.ts');
 for(const input of [active,{...active,session:withManualLocationProof(session)}]){
  await store.write(input);const restored=await store.read();
  assert.equal(hasManualLocationProof(restored.session),input!==active);assert.deepEqual(restored.progress,active.progress);assert.equal(restored.courseRunId,'run');
 }
 const stamped=withManualLocationProof(session);
 assert.equal(hasManualLocationProof({...stamped,origin:{...stamped.origin,lat:36}}),false);
 assert.equal(hasManualLocationProof({...stamped,destination:session.origin}),false);
});
test('RESTORE fresh manual CourseConfirm needs no gate after cold restoration',()=>{
 const {host}=hostFixture();const fresh=JSON.parse(JSON.stringify({...active,session:withManualLocationProof(session)}));
 const screen=host.mount(host.load('src/ui/CourseConfirmScreen.tsx').CourseConfirmScreen,{route:{params:{session:fresh.session,course:fresh.course}},navigation:{addListener:()=>()=>{},goBack(){}}});
 assert.equal(screen.nodes(n=>n.props.testID==='manual-restore-gate').length,0);screen.unmount();
});
for(const roundTrip of [true,false])test(`RESTORE ${roundTrip?'round trip':'destination'} requires two fresh picks and rejects changed/expired state without mutation`,()=>{
 const input={...session,destination:roundTrip?null:{id:'destination',label:'D',lat:36,lon:128}};
 const before=JSON.stringify(input),o={...input.origin,source:'provider'},d={...(input.destination??input.origin),source:'map'};
 const end=Date.parse(input.nowIso)+180*60000;
 assert.equal(manualReselectionResult(input,o,null,end,end-1),'missing');
 assert.equal(manualReselectionResult(input,o,{...d,lat:d.lat+.1},end,end-1),'changed');
 assert.equal(manualReselectionResult(input,o,d,end,end),'expired');
 assert.equal(manualReselectionResult(input,o,d,end,end-1),'ready');
 assert.equal(JSON.stringify(input),before);
 const a={...active,session:input};
 assert.equal(reconfirmActiveCourseLocations(a,'other',input,o,d,end-1),null);
 const next=reconfirmActiveCourseLocations(a,a.identity,input,o,d,end-1);
 assert.equal(next.progress,a.progress);assert.equal(next.course,a.course);assert.equal(next.courseRunId,a.courseRunId);assert.equal(hasManualLocationProof(next.session),true);assert.equal(hasManualLocationProof(input),false);
});
function gateFixture(onConfirm=()=>true){
 const {host,calls}=hostFixture();let cancelled=0;
 const screen=host.mount(host.load('src/ui/ManualLocationRestoreGate.tsx').ManualLocationRestoreGate,{...session,endsAtMs:Date.parse(session.nowIso)+180*60000,titles:['A'],onConfirm,onCancel(){cancelled++;}});
 const pick=(target,p)=>{screen.press(`restore-${target}`);const picker=screen.nodes(n=>n.type==='PlacePicker')[0];assert.deepEqual(picker.props.center,{lat:35.1578,lon:129.0594});picker.props.onConfirm({...p,source:'provider'});};
 return {screen,pick,calls,cancelled:()=>cancelled};
}
test('RESTORE gate cancellation preserves run; changed point refuses any route/authorization',async()=>{
 let grants=0;const f=gateFixture(()=>{grants++;return true;});
 f.pick('origin',session.origin);f.pick('destination',{...session.origin,lat:36});f.screen.press('restore-submit');await settle();
 assert.match(f.screen.get('restore-error').props.children,/다시 검증/);assert.equal(grants,0);assert.deepEqual(f.calls,[]);
 f.screen.press('restore-cancel');assert.equal(f.cancelled(),1);f.screen.unmount();
});
test('RESTORE gate map starts at default not old coordinates; both new selections authorize once; authorization failure stays gated',async()=>{
 let finish,calls=0;const f=gateFixture(()=>{calls++;return new Promise(r=>{finish=r;});});
 f.pick('origin',session.origin);f.screen.press('restore-destination');f.screen.nodes(n=>n.type==='PlacePicker')[0].props.onOpenMap();
 const map=f.screen.nodes(n=>n.type==='MapPlacePicker')[0];assert.deepEqual(map.props.center,{lat:35.1578,lon:129.0594});
 map.props.onConfirm({point:session.origin,label:'복귀',source:'map'});
 const submit=f.screen.get('restore-submit').props.onPress;submit();submit();assert.equal(calls,1);finish(false);await settle();
 assert.ok(f.screen.get('restore-error'));assert.ok(f.screen.get('manual-restore-gate'));f.screen.unmount();
});
test('RESTORE Live Activity pending route targets the same protected CourseConfirm without consuming action',async()=>{
 const {pendingNavigationRouteTarget}=require('../../src/ui/liveActivity/pendingNavigationRouteModel.ts');
 const pending={schemaVersion:1,purpose:'course_progress_navigation',courseRunId:'run',state:'pending',actionId:'departure',stopId:'stop:0:A',baseRevision:2};
 const target=pendingNavigationRouteTarget(active,pending,{name:'Home'});
 const {host,calls}=hostFixture();const screen=host.mount(host.load('src/ui/CourseConfirmScreen.tsx').CourseConfirmScreen,{route:{params:target},navigation:{goBack(){},addListener:()=>()=>{}}});await settle();
 assert.ok(screen.get('manual-restore-gate'));assert.deepEqual(calls,[]);assert.equal(pending.state,'pending');assert.deepEqual(active.progress,{stepIndex:1,routeOpened:true,finished:false});screen.unmount();
});
test('RESTORE direct pending controller refuses old coordinates before claiming native action',async()=>{
 const {createPendingNavigationHandoffController}=require('../../src/ui/liveActivity/pendingNavigationHandoffModel.ts');
 const calls=[];const controller=createPendingNavigationHandoffController({async transition(){calls.push('claim');return true;},async clear(){calls.push('clear');}});
 const result=await controller.consume({active,action:{state:'pending'},local:{},steps:[],open:async()=>{calls.push('open');return true;},onOpened:async()=>{}},'automatic');
 assert.equal(result.status,'manual_location_required');assert.deepEqual(calls,[]);
});
