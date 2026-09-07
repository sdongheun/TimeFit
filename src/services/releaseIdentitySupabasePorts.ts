import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountCourseCompletionRemote } from './accountCourseCompletionRepository';
import type { DwellPersonalizationRemote } from './dwellPersonalizationRepository';

/** Shared by the production singleton and the owner-pinned C runner. No alternate SQL path. */
export function createAccountCompletionWritePort(client: SupabaseClient): Pick<AccountCourseCompletionRemote,'readGeneration'|'write'> {
  return {
    async readGeneration() {
      const {data,error}=await client.rpc('get_account_record_generation');if(error)throw Error('generation_unavailable');return Number(data);
    },
    async write(input) {
      const {data,error}=await client.rpc('write_account_course_completion',{
        p_completion_id:input.completionId,p_course_run_id:input.courseRunId,p_completed_at_minute:input.completedAtMinute,
        p_owner_generation:input.ownerGeneration,p_places:input.places,
      });if(error)throw Error('completion_unavailable');return {status:data};
    },
  };
}
export function createDwellSamplePort(client: SupabaseClient): Pick<DwellPersonalizationRemote,'submit'|'readSamples'> {
  return {
    async submit(input) {
      const {data,error}=await client.rpc('submit_dwell_completion_sample',{
        p_completion_event_id:input.completionEventId,p_course_run_id:input.courseRunId,p_stop_ordinal:input.stopOrdinal,
        p_content_id:input.contentId,p_category:input.category,p_sub_category:input.subCategory,p_actual_dwell_min:input.actualDwellMin,
        p_completed_at_minute:input.completedAtMinute,p_owner_subject:input.ownerSubject,p_consent_epoch:input.consentEpoch,p_consent_revision:input.consentRevision,
      });if(error)throw Error('sample_unavailable');return {status:data};
    },
    async readSamples() {
      const {data,error}=await client.rpc('read_dwell_personalization_samples');if(error)throw Error('samples_unavailable');
      return (data??[]).map((row:any)=>({category:row.category,subCategory:row.sub_category,dwellMin:Number(row.dwell_min)}));
    },
  };
}
