import test from 'node:test';
import assert from 'node:assert/strict';
import {screenRuntime} from './support/screenRuntime.mjs';
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(inspect:any=async()=>({status:'found',phase:'pending',runClaimed:true,pendingRequests:1,storedKeyCount:2}),enabled=true){
  let listener:any,calls=0;
  const runtime=screenRuntime({__process:{env:{EXPO_PUBLIC_C_VALIDATION_INTERNAL:enabled?'true':'false'}},
    './AuthContext':{useAuth:()=>({authKind:'account',accountSession:{user:{id:'fixture-owner'}}})},
    '../services/supabase':{supabase:{auth:{onAuthStateChange(fn:any){listener=fn;return {data:{subscription:{unsubscribe(){}}}};}}}},
    '../services/cValidationSupabase':{inspectAppCValidationExecution:async(input:any)=>{calls++;assert.equal(input.executionId,'old-execution-id');assert.equal(input.expectedOwner,'fixture-owner');return inspect(input);},createAppCValidationRunner(){throw Error('new runner forbidden');}},
  });
  const {CValidationRecoveryPanel}=runtime.load('src/ui/CValidationRecoveryPanel.tsx');
  const screen=runtime.mount(CValidationRecoveryPanel,{});
  return {screen,calls:()=>calls,change(){listener('SIGNED_OUT',null);listener('SIGNED_IN',{user:{id:'fixture-owner',is_anonymous:false}});}};
}
test('recovery only inspects supplied old ID once; returns safe snapshot, no runner/prepare/stop',async()=>{
  let resolve:any;const f=fixture(()=>new Promise(r=>resolve=r));
  assert.equal(f.calls(),0);f.screen.get('c-recovery-id').props.onChangeText('old-execution-id');
  const press=f.screen.get('c-recovery-inspect').props.onPress;press();press();assert.equal(f.calls(),1);
  resolve({status:'found',phase:'pending',runClaimed:true,pendingRequests:1,storedKeyCount:2,token:'private-fixture',owner:'private-owner'});await tick();
  const text=f.screen.get('c-recovery-result').props.children;assert.match(text,/pending/);assert.doesNotMatch(text,/private|old-execution/);
  assert.equal(f.screen.nodes((n:any)=>['c-prepare','c-run','c-stop'].includes(n.props.testID)).length,0);f.screen.unmount();
});
test('recovery discards late result after auth A-B-A or unmount; never retries',async()=>{
  for(const action of ['auth','unmount']){
    let resolve:any;const f=fixture(()=>new Promise(r=>resolve=r));f.screen.get('c-recovery-id').props.onChangeText('old-execution-id');f.screen.press('c-recovery-inspect');
    if(action==='auth')f.change();else f.screen.unmount();resolve({status:'found',phase:'retired',runClaimed:true,pendingRequests:0,storedKeyCount:0});await tick();
    assert.equal(f.calls(),1);if(action==='auth'){assert.doesNotMatch(f.screen.get('c-recovery-result').props.children,/retired/);f.screen.unmount();}
  }
});
test('recovery preserves not_found/corrupt/unavailable; normal builds inert',async()=>{
  for(const status of ['not_found','corrupt','unavailable','account_required','session_expired','owner_changed']){
    const f=fixture(async()=>({status}));f.screen.get('c-recovery-id').props.onChangeText('old-execution-id');f.screen.press('c-recovery-inspect');await tick();assert.match(f.screen.get('c-recovery-result').props.children,new RegExp(status));f.screen.unmount();
  }
  const f=fixture(undefined,false);assert.equal(f.screen.nodes((n:any)=>n.props.testID==='c-recovery-inspect').length,0);assert.equal(f.calls(),0);f.screen.unmount();
});
