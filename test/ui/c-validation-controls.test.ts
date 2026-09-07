import test from 'node:test';
import assert from 'node:assert/strict';
import {createCValidationControls,parseCBaselineReceipt} from '../../src/ui/cValidationControls';

const plan={executionId:'fixture-execution',owner:'owner-a',clockMs:1,ids:[1,2,3].map(i=>({runId:`run-${i}`,completionId:`completion-${i}`,eventId:`event-${i}`}))};
const receipt={executionId:plan.executionId,owner:plan.owner,ids:plan.ids,baselineCaptured:true};
function fixture(){
  let owner:string|null='owner-a',listener:(owner:string|null)=>void=()=>{},prepared=0,ran=0,notified=0,stopped=0;
  let prepare=async()=>({status:'awaiting_baseline',plan});
  let run=async()=>({status:'verified',report:{completed:3,submitted:3,cleanup:'retired'}});
  const runner={prepare:async()=>{prepared++;return prepare();},run:async(input:any)=>{assert.deepEqual(input.baselineReceipt,receipt);ran++;return run();},notifyAuthChanged(){notified++;},stop:async()=>{stopped++;return {status:'retired'};},getState:()=>({stage:'idle',completed:0,submitted:0})};
  const controls=createCValidationControls({currentOwner:()=>owner,createRunner:()=>runner as any,subscribeAuth(fn){listener=fn;return()=>{};},createExecutionId:()=>plan.executionId});
  return {controls,counts:()=>({prepared,ran,notified,stopped}),change(next:string|null){owner=next;listener(next);},prepare(fn:any){prepare=fn;},run(fn:any){run=fn;}};
}
test('C requires explicit account confirmation, operator receipt and single run; no automatic receipt',async()=>{
  const f=fixture();await f.controls.prepare();assert.equal(f.counts().prepared,0);
  f.controls.confirmOwner();await f.controls.prepare();assert.equal(f.counts().prepared,1);
  await f.controls.run('');assert.equal(f.counts().ran,0);
  await Promise.all([f.controls.run(JSON.stringify(receipt)),f.controls.run(JSON.stringify(receipt))]);
  assert.equal(f.counts().ran,1);assert.equal(f.controls.state().status,'verified');
});
test('C rejects anonymous, changed owner and A-B-A including late prepare',async()=>{
  const f=fixture();f.change(null);f.controls.confirmOwner();await f.controls.prepare();assert.equal(f.counts().prepared,0);
  const g=fixture();let resolve:any;g.prepare(()=>new Promise(r=>resolve=r));g.controls.confirmOwner();const pending=g.controls.prepare();
  g.change('owner-b');g.change('owner-a');resolve({status:'awaiting_baseline',plan});await pending;
  await g.controls.run(JSON.stringify(receipt));assert.equal(g.counts().ran,0);assert.equal(g.counts().notified,1);
});
test('C consent OFF does not run or enable consent; explicit preparation retry only',async()=>{
  const f=fixture();f.prepare(async()=>({status:'consent_required'}));f.controls.confirmOwner();await f.controls.prepare();
  assert.equal(f.controls.state().status,'consent_required');assert.equal(f.counts().ran,0);assert.equal(f.counts().prepared,1);
});
test('C stop/unmount blocks continuation; unsafe errors and receipt extras are never exposed',async()=>{
  assert.equal(parseCBaselineReceipt(JSON.stringify({...receipt,access_token:'private-fixture'})),null);
  const f=fixture();f.prepare(async()=>{throw Error('private-fixture');});f.controls.confirmOwner();await f.controls.prepare();
  assert.doesNotMatch(JSON.stringify(f.controls.state()),/private-fixture/);
  await f.controls.dispose();await f.controls.run(JSON.stringify(receipt));assert.equal(f.counts().ran,0);assert.ok(f.counts().stopped);
});
test('C token refresh keeps same owner; logout during run rejects late verified result and never retries',async()=>{
  const f=fixture();f.controls.confirmOwner();await f.controls.prepare();
  f.change('owner-a');assert.equal(f.counts().notified,0);
  let resolve:any;f.run(()=>new Promise(r=>resolve=r));const pending=f.controls.run(JSON.stringify(receipt));
  f.change(null);assert.equal(f.counts().notified,1);
  resolve({status:'verified',report:{completed:3,submitted:3,cleanup:'retired'}});await pending;
  assert.equal(f.controls.state().status,'stopped');assert.equal(f.controls.state().report,null);
  await f.controls.run(JSON.stringify(receipt));assert.equal(f.counts().ran,1);
});
test('C failure reason survives stop and empty controller never claims previous execution retired',async()=>{
  const empty=fixture();await empty.controls.stop();assert.equal(empty.controls.state().cleanupStatus,null);
  const f=fixture();f.controls.confirmOwner();await f.controls.prepare();
  f.run(async()=>({status:'stopped',reason:'clock_stale',completed:0,submitted:0,cleanup:'retired'}));
  await f.controls.run(JSON.stringify(receipt));assert.equal(f.controls.state().reason,'clock_stale');
  await f.controls.stop();assert.equal(f.controls.state().reason,'clock_stale');
});
