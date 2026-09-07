import type {CBaselineReceipt,CValidationPlan} from './cValidationRunner';

/** Pure UI/runner shared comparison. Array order matters; object key order does not. */
export function matchesCBaselineReceipt(receipt:CBaselineReceipt,plan:CValidationPlan):boolean {
  return receipt?.baselineCaptured===true && receipt.owner===plan.owner && receipt.executionId===plan.executionId
    && Array.isArray(receipt.ids) && receipt.ids.length===plan.ids.length
    && plan.ids.every((expected,i)=>{
      const actual=receipt.ids[i];
      return !!actual && Object.keys(actual).length===3
        && actual.runId===expected.runId && actual.completionId===expected.completionId && actual.eventId===expected.eventId;
    });
}
