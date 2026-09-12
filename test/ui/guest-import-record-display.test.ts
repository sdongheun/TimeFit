import test from 'node:test';
import assert from 'node:assert/strict';
import {screenRuntime} from './support/screenRuntime.mjs';
import {mergeOwnedRecords,summarizeOwnedRecords} from '../../src/ui/ownedRecordsModel';
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const record=(id:string)=>({completionId:id,courseRunId:id,completedAtMinute:1,provenance:'guest_import',learningEligible:false,places:[{contentId:'same-place',title:'가져온 장소',category:'카페',stopOrdinal:1}]});
test('account records render statistics with unmeasured visits and no duplicate sibling purpose keys',async()=>{
  const rows=[record('one'),record('two')];
  const ports=async()=>({supabaseAccountIdentityResolver:{resolve:async()=>({status:'account',identity:{subject:'A'}})},readOwnedDeviceCourseCompletions:async()=>({status:'empty',records:[]}),supabaseAccountCourseCompletionRepository:{readAccountCourseCompletions:async()=>({status:'ok',records:rows})}});
  const r=screenRuntime({'./GuestImportPanel':{GuestImportPanel:'Import'},'./HistorySwipeRow':{HistorySwipeRow:'HistorySwipeRow'},'./OwnedDeletionPanel':{OwnedDeletionPanel:'Delete'},'./CompletedPlacesMapButton':{CompletedPlacesMapButton:'Map'},'../CompletedPlacesMapButton':{CompletedPlacesMapButton:'Map'},'./ActivityDonut':{ActivityDonut:'Donut'}});
  const {AccountRecordsPanel}=r.load('src/ui/AccountRecordsPanel.tsx');const s=r.mount(AccountRecordsPanel,{subject:'A',getPorts:ports});await tick();
  try{
    const serialized=JSON.stringify(s.render());
    const before=s.get('account-completion-history').props.children.flat(Infinity).filter((x:any)=>x&&typeof x==='object'&&x.key!=null);
    assert.deepEqual([!serialized.includes('activity-summary')?'missing_statistics':null,new Set(before.map((x:any)=>x.key)).size!==before.length?'sibling_key_collision':null].filter(Boolean),[]);
    assert.doesNotMatch(serialized,/활용한 시간|활동 유형/);
    const summary=s.get('activity-summary');assert.match(JSON.stringify(summary),/카페 2/);
    assert.deepEqual(s.nodes((x:any)=>x.type==='Text')[0].props.children,['방문 ',2,'회']);
    const children=s.get('account-completion-history').props.children.flat(Infinity).filter((x:any)=>x&&typeof x==='object'&&x.key!=null);
    assert.equal(new Set(children.map((x:any)=>x.key)).size,children.length);
    assert.equal(s.nodes((x:any)=>x.type==='Import').length,1);assert.equal(s.nodes((x:any)=>x.type==='Delete').length,1);
  }finally{s.unmount();}
});
test('merged completion IDs count once, repeat places count visits, imports never supply dwell even with accidental values',()=>{
  const imported=record('one');imported.places[0]={...imported.places[0],actualDwellMin:90} as any;
  const local={completionId:'local',courseRunId:'local',completedAt:60000,places:[{contentId:'same-place',title:'local',category:'카페',actualDwellMin:12}]} as any;
  const rows=mergeOwnedRecords([local,{...local,completionId:'one'}],[imported as any,record('two') as any]);
  const summary=summarizeOwnedRecords(rows);assert.equal(summary.completedPlaceCount,3);assert.equal(summary.completedDwellMin,12);assert.equal(summary.measuredCount,1);assert.equal(summary.unmeasuredCount,2);assert.equal(summary.dwellPresentation.kind,'partial');
  assert.equal(summary.categories[0].ratio,100);assert.equal(summarizeOwnedRecords([]).dwellPresentation.kind,'empty');
});
test('account changes discard late stats/map; import/delete callbacks refresh without performing mutations',async()=>{
  let subject='A',rows:any[]=[record('one')],remoteStatus='ok';const pending=new Map<string,(v:any)=>void>();let delay=true;
  const ports=async()=>({supabaseAccountIdentityResolver:{resolve:async()=>({status:'account',identity:{subject}})},readOwnedDeviceCourseCompletions:async()=>({status:'empty',records:[]}),supabaseAccountCourseCompletionRepository:{readAccountCourseCompletions:()=>delay?new Promise(r=>pending.set(subject,r)):Promise.resolve({status:remoteStatus,records:rows})}});
  const r=screenRuntime({'./GuestImportPanel':{GuestImportPanel:'Import'},'./HistorySwipeRow':{HistorySwipeRow:'HistorySwipeRow'},'./OwnedDeletionPanel':{OwnedDeletionPanel:'Delete'},'../CompletedPlacesMapButton':{CompletedPlacesMapButton:'Map'},'./ActivityDonut':{ActivityDonut:'Donut'}});
  const {AccountRecordsPanel}=r.load('src/ui/AccountRecordsPanel.tsx');const s=r.mount(()=>AccountRecordsPanel({subject,getPorts:ports}),{});
  try{
    await tick();subject='B';s.render();await tick();pending.get('A')!({status:'ok',records:[{...record('secret'),places:[{title:'A-private',category:'카페',contentId:'secret'}]}]});pending.get('B')!({status:'ok',records:rows});await tick();
    assert.doesNotMatch(JSON.stringify(s.render()),/A-private/);s.get('activity-summary');
    delay=false;rows=[record('one'),record('two')];s.nodes((x:any)=>x.type==='Import')[0].props.onChanged();s.render();await tick();assert.match(JSON.stringify(s.get('activity-summary')),/카페 2/);
    rows=[];s.nodes((x:any)=>x.type==='Delete')[0].props.onChanged();s.render();await tick();assert.equal(s.nodes((x:any)=>x.props.testID==='activity-summary').length,0);assert.equal(s.nodes((x:any)=>x.type==='Map').length,0);
    remoteStatus='unavailable';s.nodes((x:any)=>x.type==='Delete')[0].props.onChanged();s.render();await tick();assert.match(JSON.stringify(s.render()),/계정 기록을 확인하지 못했어요/);assert.equal(s.nodes((x:any)=>x.type==='Map').length,0);
  }finally{s.unmount();}
});
test('logout unmount discards late account response and leaves the guest summary isolated',async()=>{
  let resolve:any;
  const ports=async()=>({supabaseAccountIdentityResolver:{resolve:async()=>({status:'account',identity:{subject:'A'}})},readOwnedDeviceCourseCompletions:async()=>({status:'empty',records:[]}),supabaseAccountCourseCompletionRepository:{readAccountCourseCompletions:()=>new Promise(r=>resolve=r)}});
  const r=screenRuntime({'./GuestImportPanel':{GuestImportPanel:'Import'},'./HistorySwipeRow':{HistorySwipeRow:'HistorySwipeRow'},'./OwnedDeletionPanel':{OwnedDeletionPanel:'Delete'},'../CompletedPlacesMapButton':{CompletedPlacesMapButton:'Map'},'./ActivityDonut':{ActivityDonut:'Donut'}});
  const {AccountRecordsPanel}=r.load('src/ui/AccountRecordsPanel.tsx');const account=r.mount(AccountRecordsPanel,{subject:'A',getPorts:ports});await tick();account.unmount();
  const {ActivityStatistics}=r.load('src/ui/activity/ActivityStatistics.tsx');
  const guest=r.mount(ActivityStatistics,{summary:{completedPlaceCount:1,completedDwellMin:0,measuredCount:0,unmeasuredCount:1,dwellPresentation:{kind:'unmeasured'},categories:[{category:'공원',count:1,dwellMin:0,ratio:100}]},completedPlaces:[{contentId:'guest',title:'guest-only'}],mapKey:'guest',scope:'이번 달 기기 완료 기록'});
  resolve({status:'ok',records:[record('late-account')]});await tick();const output=JSON.stringify(guest.render());assert.match(output,/guest-only/);assert.doesNotMatch(output,/가져온 장소|카페|late-account/);guest.unmount();
});
