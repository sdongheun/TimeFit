import test from 'node:test';
import assert from 'node:assert/strict';
import {createCValidationControls,parseCBaselineReceipt} from '../../src/ui/cValidationControls';
import {screenRuntime} from './support/screenRuntime.mjs';
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const plan={executionId:'diagnostic-fixture',owner:'fixture-owner',clockMs:0,ids:[1,2,3].map(i=>({runId:`run-${i}`,completionId:`completion-${i}`,eventId:`event-${i}`}))};
const receipt={executionId:plan.executionId,owner:plan.owner,ids:plan.ids,baselineCaptured:true};
// Normal acceptance expectations replacing the former diagnostic defect assertions.
test('same-owner TOKEN_REFRESHED preserves receipt and execution records safe stages',async()=>{
  let listener:any,calls=0;
  const runner={prepare:async()=>({status:'awaiting_baseline',plan}),run:async()=>{calls++;return {status:'baseline_required'};},stop:async()=>({status:'retired'}),notifyAuthChanged(){},getState:()=>({stage:'awaiting_baseline',completed:0,submitted:0})};
  const r=screenRuntime({__process:{env:{EXPO_PUBLIC_C_VALIDATION_INTERNAL:'true'}},'./AuthContext':{useAuth:()=>({authKind:'account',accountSession:{user:{id:plan.owner}}})},'expo-modules-core':{uuid:{v4:()=>plan.executionId}},'../services/cValidationSupabase':{createAppCValidationRunner:()=>runner},'../services/supabase':{supabase:{auth:{onAuthStateChange(fn:any){listener=fn;return {data:{subscription:{unsubscribe(){}}}};}}}}});
  const {CValidationPanel}=r.load('src/ui/CValidationPanel.tsx');const s=r.mount(CValidationPanel,{});
  try{
    s.press('c-confirm-owner');s.press('c-prepare');await tick();s.get('c-receipt').props.onChangeText(JSON.stringify(receipt));
    assert.equal(s.get('c-run').props.disabled,false);
    listener('TOKEN_REFRESHED',{user:{id:plan.owner,is_anonymous:false}});
    assert.equal(s.get('c-receipt').props.value,JSON.stringify(receipt));assert.equal(s.get('c-run').props.disabled,false);
    const state=JSON.parse(s.get('c-status').props.children);assert.equal(state.status,'awaiting_baseline');assert.equal(state.reason,null);
    s.press('c-run');await tick();assert.equal(calls,1);
    const output=s.get('c-status').props.children;assert.match(output,/button_entered/);assert.match(output,/runner_called/);assert.match(output,/result_displayed/);assert.doesNotMatch(output,/fixture-owner|diagnostic-fixture|run-1/);
  }finally{s.unmount();}
});
function controls(){
  let owner:string|null=plan.owner,calls=0;
  const c=createCValidationControls({currentOwner:()=>owner,createExecutionId:()=>plan.executionId,subscribeAuth:()=>()=>{},createRunner:()=>({prepare:async()=>({status:'awaiting_baseline',plan}),run:async(input:any)=>{assert.equal(JSON.stringify(input.baselineReceipt.ids),JSON.stringify(plan.ids),'existing runner transport comparison receives normalized validated IDs');calls++;return {status:'baseline_required'};},stop:async()=>({status:'retired'}),notifyAuthChanged(){},getState:()=>({stage:'awaiting_baseline',completed:0,submitted:0})}) as any});
  return {c,calls:()=>calls,change(){owner=null;}};
}
test('current owner mismatch returns and displays safe rejection without calling runner',async()=>{
  const f=controls();f.c.confirmOwner();await f.c.prepare();f.change();
  assert.deepEqual(await f.c.run(JSON.stringify(receipt)),{status:'rejected',reason:'owner_changed'});assert.equal(f.calls(),0);
  assert.equal(f.c.state().rejectionReason,'owner_changed');await f.c.dispose();
});
test('run guards expose account/not-prepared/already-started/closed without extra runner calls',async()=>{
  const f=controls();assert.deepEqual(await f.c.run(''),{status:'rejected',reason:'account_required'});
  f.c.confirmOwner();assert.deepEqual(await f.c.run(''),{status:'rejected',reason:'not_prepared'});
  await f.c.prepare();await f.c.run(JSON.stringify(receipt));
  assert.deepEqual(await f.c.run(JSON.stringify(receipt)),{status:'rejected',reason:'already_started'});
  await f.c.stop();assert.deepEqual(await f.c.run(JSON.stringify(receipt)),{status:'rejected',reason:'closed'});assert.equal(f.calls(),1);await f.c.dispose();
});
test('equivalent object keys reach runner but changed ID array order is rejected',async()=>{
  const f=controls();f.c.confirmOwner();await f.c.prepare();
  const reordered={...receipt,ids:plan.ids.map(x=>({eventId:x.eventId,completionId:x.completionId,runId:x.runId}))};
  assert.ok(parseCBaselineReceipt(JSON.stringify(reordered)));
  await f.c.run(JSON.stringify(reordered));assert.equal(f.calls(),1);await f.c.dispose();
  const g=controls();g.c.confirmOwner();await g.c.prepare();await g.c.run(JSON.stringify({...receipt,ids:[...receipt.ids].reverse()}));assert.equal(g.calls(),0);assert.equal(g.c.state().reason,'baseline_required');await g.c.dispose();
});
