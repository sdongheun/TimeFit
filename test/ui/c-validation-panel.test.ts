import test from 'node:test';
import assert from 'node:assert/strict';
import {screenRuntime} from './support/screenRuntime.mjs';

const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('production internal panel confirms account then prepare/receipt/run; auth event stops even without React render',async()=>{
  let callback:any,prepared=0,runs=0,stops=0,invalidations=0,created=0,ids=0;
  const plan={executionId:'fixture-execution',owner:'owner-a',clockMs:1,ids:[1,2,3].map(i=>({runId:`run-${i}`,completionId:`completion-${i}`,eventId:`event-${i}`}))};
  const runner={getState:()=>({stage:'idle',completed:0,submitted:0}),prepare:async(input:any)=>{assert.equal(input.expectedOwner,'owner-a');prepared++;return {status:'awaiting_baseline',plan};},run:async(input:any)=>{assert.equal(input.baselineReceipt.baselineCaptured,true);runs++;return {status:'stopped',reason:'sync_failed',cleanup:'retired'};},stop:async()=>{stops++;return {status:'retired'};},notifyAuthChanged(){invalidations++;}};
  const r=screenRuntime({__process:{env:{EXPO_PUBLIC_C_VALIDATION_INTERNAL:'true'}},
    './AuthContext':{useAuth:()=>({authKind:'account',accountSession:{user:{id:'owner-a',email:'fixture@example.test'}}})},
    'expo-modules-core':{uuid:{v4:()=>{ids++;return plan.executionId;}}},
    '../services/cValidationSupabase':{createAppCValidationRunner:(input:any)=>{created++;assert.equal(input.executionId,plan.executionId);return runner;}},
    '../services/supabase':{supabase:{auth:{onAuthStateChange(fn:any){callback=fn;return {data:{subscription:{unsubscribe(){}}}};}}}},
  });
  const {CValidationPanel}=r.load('src/ui/CValidationPanel.tsx');const s=r.mount(CValidationPanel,{});
  try {
    assert.equal(prepared,0);assert.equal(created,0);assert.equal(ids,0);s.press('c-confirm-owner');assert.equal(ids,0);s.press('c-prepare');await tick();assert.equal(prepared,1);assert.equal(runs,0);assert.equal(ids,1);assert.equal(created,1);
    s.get('c-receipt').props.onChangeText(JSON.stringify({executionId:plan.executionId,owner:plan.owner,ids:plan.ids,baselineCaptured:true}));
    s.press('c-run');s.press('c-run');await tick();assert.equal(runs,1);
    assert.match(s.get('c-status').props.children,/"reason":"sync_failed"/);
    callback('SIGNED_OUT',null);assert.equal(invalidations,1);assert.equal(stops,1);
    assert.doesNotMatch(s.get('c-status').props.children,/fixture@example|owner-a/);
  }finally{s.unmount();}
});
test('normal release hides C controls and never constructs runner or subscribes',()=>{
  const r=screenRuntime({__process:{env:{}},'./AuthContext':{useAuth:()=>({authKind:'anonymous',accountSession:null})}});
  const {CValidationPanel}=r.load('src/ui/CValidationPanel.tsx');const s=r.mount(CValidationPanel,{});
  assert.equal(s.nodes((n:any)=>n.props.testID==='c-validation-panel').length,0);s.unmount();
});
