import type {createAppCValidationRunner} from '../services/cValidationSupabase';
import type {CBaselineReceipt,CValidationPlan} from '../services/cValidationRunner';

type Runner=ReturnType<typeof createAppCValidationRunner>;
type Rejection='closed'|'busy'|'already_started'|'account_required'|'owner_changed'|'not_prepared'|'baseline_required';
type Stage='button_entered'|'controller_entered'|'execution_rejected'|'receipt_accepted'|'runner_called'|'runner_returned'|'runner_threw'|'result_discarded'|'result_displayed';
const safeStates=new Set(['idle','confirmed','awaiting_baseline','running','verified','stopped','unavailable','consent_required','consent_changed','owner_changed','account_required','session_expired','retired','cleanup_pending','already_started','expired_existing_samples','baseline_too_large','id_collision','baseline_required','baseline_changed','runtime_failed','sync_failed','sample_mismatch','interrupted','clock_stale']);
const safe=(value:unknown)=>typeof value==='string'&&safeStates.has(value)?value:'unavailable';
const keys=(value:object,expected:string[])=>Object.keys(value).sort().join(',')===expected.sort().join(',');
export function parseCBaselineReceipt(text:string):CBaselineReceipt|null {
  if(text.length>4000)return null;
  try {
    const r=JSON.parse(text);
    if(!r || !keys(r,['executionId','owner','ids','baselineCaptured']) || r.baselineCaptured!==true
      || typeof r.executionId!=='string' || typeof r.owner!=='string' || !Array.isArray(r.ids) || r.ids.length!==3)return null;
    if(!r.ids.every((id:Record<string,unknown>)=>id && keys(id,['runId','completionId','eventId']) && Object.values(id).every(v=>typeof v==='string' && /^[a-zA-Z0-9-]{1,120}$/.test(v))))return null;
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(r.executionId)||!/^[a-zA-Z0-9-]{1,80}$/.test(r.owner))return null;
    return r;
  }catch{return null;}
}

/** UI-only lifetime/confirmation guard. All Auth, isolated storage and writes remain in DB's runner. */
export function createCValidationControls(deps:{
  currentOwner():string|null;
  createExecutionId():string;
  createRunner(input:{executionId:string;currentAppOwner():string|null}):Runner;
  subscribeAuth(listener:(owner:string|null)=>void):()=>void;
}) {
  let owner:string|null=null,runner:Runner|null=null,busy=false,closed=false,started=false;
  let status='idle',cleanup:string|null=null,plan:CValidationPlan|null=null;
  let reason:string|null=null;
  let rejectionReason:Rejection|null=null,sequence=0;
  let trace:Readonly<{sequence:number;stage:Stage;reason?:Rejection}>[]=[];
  const record=(stage:Stage,why?:Rejection)=>{trace=[...trace,{sequence:++sequence,stage,...(why?{reason:why}:{})}].slice(-32);};
  const reject=(why:Rejection)=>{rejectionReason=why;record('execution_rejected',why);return {status:'rejected' as const,reason:why};};
  const guard=():Rejection|null=>closed?'closed':busy?'busy':started?'already_started':!owner?'account_required':!sameOwner()?'owner_changed':null;
  let report:Record<string,unknown>|null=null;
  const stop=async()=>{
    closed=true;plan=null;status='stopped';
    try{cleanup=runner?safe((await runner.stop()).status):null;}catch{cleanup='unavailable';}
  };
  const unsubscribe=deps.subscribeAuth(next=>{
    if(owner && next!==owner && !closed){reason??='owner_changed';runner?.notifyAuthChanged();void stop();}
  });
  const sameOwner=()=>!!owner && owner===deps.currentOwner();
  return {
    state(){return {status,reason,rejectionReason,trace,cleanupStatus:cleanup,plan,report,busy,closed,started,progress:runner?.getState()??null};},
    recordUiStage(stage:'button_entered'|'result_displayed'){record(stage);},
    confirmOwner(){if(closed||busy||runner)return;owner=deps.currentOwner();status=owner?'confirmed':'account_required';},
    async prepare(){
      const denied=guard();if(denied)return reject(denied);
      busy=true;plan=null;reason=null;rejectionReason=null;
      try {
        runner??=deps.createRunner({executionId:deps.createExecutionId(),currentAppOwner:deps.currentOwner});
        const result=await runner.prepare({expectedOwner:owner!});
        if(closed||!sameOwner()){record('result_discarded');return reject(closed?'closed':'owner_changed');}
        status=safe(result.status);
        if(result.status!=='awaiting_baseline')reason=status;
        if(result.status==='awaiting_baseline')plan=result.plan;
      }catch{if(!closed){status='unavailable';reason='unavailable';}}finally{busy=false;}
    },
    async run(text:string){
      record('controller_entered');
      const denied=guard();if(denied)return reject(denied);
      if(!runner||!plan)return reject('not_prepared');
      const receipt=parseCBaselineReceipt(text);
      if(!receipt || receipt.owner!==plan.owner || receipt.executionId!==plan.executionId || receipt.ids.length!==plan.ids.length
        || !receipt.ids.every((id,i)=>id.runId===plan!.ids[i].runId&&id.completionId===plan!.ids[i].completionId&&id.eventId===plan!.ids[i].eventId)){
        status='baseline_required';reason='baseline_required';return reject('baseline_required');
      }
      // Compare field values first; preserve array order and serialize validated IDs in
      // the runner's own plan key order for its existing transport comparison contract.
      const normalizedReceipt:CBaselineReceipt={...receipt,ids:plan.ids.map(id=>({...id}))};
      record('receipt_accepted');
      busy=true;started=true;status='running';reason=null;rejectionReason=null;
      try {
        record('runner_called');
        const result=await runner.run({baselineReceipt:normalizedReceipt});
        record('runner_returned');
        if(closed||!sameOwner()){record('result_discarded');return reject(closed?'closed':'owner_changed');}
        status=safe(result.status);
        if(result.status==='verified'){
          const r=result.report;cleanup=r.cleanup;
          report={completed:r.completed,submitted:r.submitted,existingSampleCount:r.existingSampleCount,observedSampleCount:r.observedSampleCount,changed:r.changed,
            beforeStayMin:r.before?.stayMin,afterStayMin:r.after?.stayMin};
        }else if(result.status==='stopped'){reason=safe(result.reason);cleanup=safe(result.cleanup);}
        else reason=status;
      }catch{record('runner_threw');reason='unavailable';await stop();}finally{busy=false;}
    },
    stop,
    async dispose(){unsubscribe();await stop();},
  };
}
