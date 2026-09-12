import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from 'expo-modules-core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { createAccountIdentityResolver, createSupabaseAccountAuthPort } from './accountIdentity';
import { createAccountRegistrationRepository, sanitizeSignupFailure, type RequiredConsentDocumentId } from './accountRegistrationRepository';
import { createAccountProfileRepository } from './accountProfileRepository';
import { createAccountDeletionRepository, type DeleteAccountResultV1 } from './accountDeletionRepository';
import { createAccountCourseCompletionRepository, type AccountCompletionOwnerSnapshotStore, type AccountCourseCompletionRemote, type AccountCourseCompletionV1 } from './accountCourseCompletionRepository';
import { createGuestCompletionImportRepository, type GuestImportStore, type PendingGuestCompletionImportV1 } from './guestCompletionImportRepository';
import { courseCompletionRepository } from './courseCompletionAsyncStorage';
import { createDwellPersonalizationRepository } from './dwellPersonalizationRepository';
import { createDwellOutbox, type DwellOutboxStorage, type StoredDwellOutboxItemV1 } from './dwellPersonalizationOutbox';
import { createReleaseIdentityPersonalizationRuntime, withCourseRunCaptureInvalidation } from './releaseIdentityPersonalizationRuntime';
import { createLearningEvidenceAuthObserver } from './liveLearningEvidence';
import type { CourseCompletionStorage } from './courseCompletionRepository';
import { createAccountCompletionWritePort, createDwellSamplePort } from './releaseIdentitySupabasePorts';

const OWNER_KEY = '@timefit/account-completion-owner-snapshots-v1';
const IMPORT_KEY = '@timefit/guest-completion-import-pending-v1';
const DWELL_OUTBOX_KEY = '@timefit/dwell-sample-outbox-v1';

const releaseDeviceStorage: CourseCompletionStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const supabaseAccountIdentityResolver = createAccountIdentityResolver(createSupabaseAccountAuthPort(supabase.auth));

export const supabaseAccountRegistrationRepository = createAccountRegistrationRepository({
  async readDocuments() {
    try {
      const { data, error, status } = await supabase.rpc('get_signup_consent_documents');
      // PostgREST carries HTTP status on the response, not on its error body.
      if (error) throw sanitizeSignupFailure({ code: error.code, status }, 'registry');
      return (data ?? []).map((row: Record<string, unknown>) => ({ documentId: row.document_id as RequiredConsentDocumentId, documentVersion: String(row.document_version), url: String(row.document_url) }));
    } catch (error) { throw sanitizeSignupFailure(error, 'registry'); }
  },
  async signUp(input) {
    try {
      const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password, options: { data: input.metadata, captchaToken: input.captchaToken } });
      if (error) throw sanitizeSignupFailure(error, 'auth');
      return { sessionReady: Boolean(data.session) };
    } catch (error) { throw sanitizeSignupFailure(error, 'auth'); }
  },
});
export const readSignupConsentDocuments = supabaseAccountRegistrationRepository.readSignupConsentDocuments;

export const supabaseAccountProfileRepository = createAccountProfileRepository({
  identity: supabaseAccountIdentityResolver,
  async readProfile(subject) {
    const { data, error } = await supabase.from('profiles').select('nickname,nickname_updated_at').eq('id', subject).maybeSingle();
    if (error) throw new Error('profile_unavailable');
    return data ? { nickname: data.nickname ?? null, nicknameUpdatedAt: data.nickname_updated_at ?? null } : null;
  },
  async updateNickname(nickname, mutationId) {
    const { data, error } = await supabase.rpc('update_account_nickname', { p_mutation_id: mutationId, p_nickname: nickname }); const row = data?.[0];
    if (error || !row) throw new Error('profile_unavailable');
    return { nickname: row.nickname ?? null, nicknameUpdatedAt: row.nickname_updated_at ?? null };
  },
});

const ownerStore: AccountCompletionOwnerSnapshotStore = {
  async read(courseRunId) { const values = JSON.parse((await AsyncStorage.getItem(OWNER_KEY)) ?? '{}'); return values[courseRunId] ?? null; },
  async write(snapshot) { const values = JSON.parse((await AsyncStorage.getItem(OWNER_KEY)) ?? '{}'); values[snapshot.courseRunId] = snapshot; await AsyncStorage.setItem(OWNER_KEY, JSON.stringify(values)); },
  async remove(courseRunId) { const values = JSON.parse((await AsyncStorage.getItem(OWNER_KEY)) ?? '{}'); delete values[courseRunId]; await AsyncStorage.setItem(OWNER_KEY, JSON.stringify(values)); },
};

const accountCompletionRemote: AccountCourseCompletionRemote = {
    ...createAccountCompletionWritePort(supabase),
    async read() {
      const { data, error } = await supabase.from('account_course_completions').select('completion_id,course_run_id,completed_at,provenance,account_course_completion_places(stop_ordinal,content_id,title,category,sub_category)').order('completed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any): AccountCourseCompletionV1 => ({ completionId: row.completion_id, courseRunId: row.course_run_id, completedAtMinute: Math.floor(new Date(row.completed_at).getTime() / 60_000), provenance: row.provenance, learningEligible: false, places: (row.account_course_completion_places ?? []).sort((a: any,b: any) => a.stop_ordinal-b.stop_ordinal).map((place: any) => ({ stopOrdinal: place.stop_ordinal, contentId: place.content_id, title: place.title, category: place.category, subCategory: place.sub_category })) }));
    },
    async deleteOne(completionId, requestId) { const { data, error } = await supabase.rpc('delete_account_course_completion', { p_completion_id: completionId, p_request_id: requestId }); if (error) throw error; return { status: data as 'deleted' | 'not_found', generation: Number(await accountCompletionRemote.readGeneration()) }; },
    async deleteAll(requestId) { const { data, error } = await supabase.rpc('delete_all_account_course_completions', { p_request_id: requestId }); if (error) throw error; return { status: 'deleted', generation: Number(data) }; },
};

export const supabaseAccountCourseCompletionRepository = createAccountCourseCompletionRepository({
  identity: supabaseAccountIdentityResolver, owners: ownerStore, remote: accountCompletionRemote,
});

const importStore: GuestImportStore = {
  serializationKey: releaseDeviceStorage,
  async read() { const raw = await AsyncStorage.getItem(IMPORT_KEY); return raw ? JSON.parse(raw) as PendingGuestCompletionImportV1 : null; },
  async write(value) { await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify(value)); },
  async clear() { await AsyncStorage.removeItem(IMPORT_KEY); },
};

const guestImportRemote = { async import(input) { const { data, error } = await supabase.rpc('import_guest_course_completions', { p_import_id: input.importId, p_items: input.items }); const row = data?.[0]; if (error || !row) throw new Error('import_unavailable'); return { status: row.status, importId: input.importId, acceptedSourceIds: row.accepted_source_ids ?? [], rejectedSourceIds: row.rejected_source_ids ?? [] }; } } satisfies Parameters<typeof createGuestCompletionImportRepository>[0]['remote'];

export const supabaseGuestCompletionImportRepository = createGuestCompletionImportRepository({
  createImportId: () => uuid.v4(),
  identity: supabaseAccountIdentityResolver, pending: importStore,
  source: { async removeByIds(ids) { const result = await courseCompletionRepository.removeByCompletionIds(ids); if (result.status !== 'removed') throw new Error('source_cleanup_failed'); } },
  remote: guestImportRemote,
});

// Only this endpoint's documented combinations cross into the UI/runtime. Never
// forward an SDK Error, arbitrary response fields, or infer deletion from HTTP 2xx.
function accountDeletionResponse(body: unknown, httpStatus: number, requestId: string): DeleteAccountResultV1 {
  const fallback: DeleteAccountResultV1 = { status: 'retryable_failure', stage: 'database' };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fallback;
  const value = body as Record<string, unknown>;
  if (httpStatus === 200 && value.status === 'deleted' && value.requestId === requestId && value.localCleanupRequired === true)
    return { status: 'deleted', requestId, localCleanupRequired: true };
  if (httpStatus === 403 && value.status === 'reauth_required' && value.method === 'password_sign_in')
    return { status: 'reauth_required', method: 'password_sign_in' };
  if (value.status === 'rejected') {
    if (httpStatus === 401 && value.reason === 'account_required') return { status: 'rejected', reason: 'account_required' };
    if ((httpStatus === 400 || httpStatus === 405) && value.reason === 'invalid_request') return { status: 'rejected', reason: 'invalid_request' };
  }
  if (value.status === 'retryable_failure') {
    if (httpStatus === 409 && value.stage === 'database') return fallback;
    if (httpStatus === 503 && (value.stage === 'storage' || value.stage === 'auth' || value.stage === 'verification' || value.stage === 'database'))
      return { status: 'retryable_failure', stage: value.stage };
  }
  return fallback;
}

export const supabaseAccountDeletionRepository = createAccountDeletionRepository({
  identity: supabaseAccountIdentityResolver,
  async invoke(accessToken, requestId) {
    const { data, error } = await supabase.functions.invoke('delete-account', { body: { requestId }, headers: { Authorization: `Bearer ${accessToken}` } });
    if (!error) return accountDeletionResponse(data, 200, requestId);
    if (error instanceof FunctionsHttpError) {
      // SDK context is the non-2xx Response. Clone to leave it unconsumed for
      // SDK ownership; no raw body/error is logged or returned. RN supports text().
      const response = error.context;
      if (response && typeof response.clone === 'function' && [400, 401, 403, 405, 409, 503].includes(response.status)) {
        try {
          const text = await response.clone().text();
          if (text.length <= 4096) return accountDeletionResponse(JSON.parse(text), response.status, requestId);
        } catch { /* malformed/unreadable response uses the existing safe failure */ }
      }
    }
    return { status: 'retryable_failure', stage: 'database' };
  },
});

const dwellPersonalizationRemote = withCourseRunCaptureInvalidation({
    async readConsent() { const { data, error } = await supabase.rpc('get_dwell_personalization_consent'); const row = data?.[0]; if (error || !row) throw error; return { enabled: row.enabled, consentEpoch: row.consent_epoch, revision: Number(row.revision), updatedAt: row.updated_at }; },
    async setConsent(input) { const { data, error } = await supabase.rpc('set_dwell_personalization_consent', { p_request_id: input.requestId, p_enabled: input.enabled, p_expected_revision: input.expectedRevision }); const row = data?.[0]; if (error || !row) throw error; return row.status === 'conflict' ? { conflictRevision: Number(row.revision) } : { enabled: row.enabled, consentEpoch: row.consent_epoch, revision: Number(row.revision), updatedAt: row.updated_at }; },
    async reset(input) { const { data, error } = await supabase.rpc('reset_dwell_personalization', { p_request_id: input.requestId, p_expected_revision: input.expectedRevision }); const row = data?.[0]; if (error || !row) throw error; return row.status === 'conflict' ? { conflictRevision: Number(row.revision) } : { consent: { enabled: row.enabled, consentEpoch: row.consent_epoch, revision: Number(row.revision), updatedAt: row.updated_at }, deletedSampleCount: Number(row.deleted_sample_count) }; },
    ...createDwellSamplePort(supabase),
} satisfies Parameters<typeof createDwellPersonalizationRepository>[0]['remote'], () => supabaseReleaseIdentityPersonalizationRuntime.invalidatePendingCourseRunCaptures());

export const supabaseDwellPersonalizationRepository = createDwellPersonalizationRepository({
  identity: supabaseAccountIdentityResolver, remote: dwellPersonalizationRemote,
});

const dwellOutboxStorage: DwellOutboxStorage = {
  async read() {
    const raw = await AsyncStorage.getItem(DWELL_OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('dwell_outbox_corrupt');
    return parsed as StoredDwellOutboxItemV1[];
  },
  async write(items) { await AsyncStorage.setItem(DWELL_OUTBOX_KEY, JSON.stringify(items)); },
};

export const supabaseDwellPersonalizationOutbox = createDwellOutbox(dwellOutboxStorage);

let evidenceAuthReady = false;
export const supabaseReleaseIdentityPersonalizationRuntime = createReleaseIdentityPersonalizationRuntime({
  storage: releaseDeviceStorage,
  identity: supabaseAccountIdentityResolver,
  legacyCompletions: courseCompletionRepository,
  accountRemote: accountCompletionRemote,
  dwellRemote: dwellPersonalizationRemote,
  guestRemote: guestImportRemote,
  createImportId: () => uuid.v4(),
  accountDeletion: supabaseAccountDeletionRepository,
  createEvidenceToken: () => uuid.v4(),
  isEvidenceAuthReady: () => evidenceAuthReady,
});

export const beginOwnedCourseRun = supabaseReleaseIdentityPersonalizationRuntime.beginCourseRun;
// The callback must remain synchronous: no Supabase queries inside an auth notification.
supabase.auth.onAuthStateChange(createLearningEvidenceAuthObserver({
  setReady: ready => { evidenceAuthReady = ready; },
  reconcile: supabaseReleaseIdentityPersonalizationRuntime.reconcileLearningEvidenceAccount,
  notifyChanged: supabaseReleaseIdentityPersonalizationRuntime.notifyCourseRunAuthChanged,
}));
export const prepareOwnedRunLearningEvidence = supabaseReleaseIdentityPersonalizationRuntime.prepareRunLearningEvidence;
export const confirmOwnedRunEvidencePublication = supabaseReleaseIdentityPersonalizationRuntime.confirmRunEvidencePublication;
export const publishOwnedRunLearningEvidence = supabaseReleaseIdentityPersonalizationRuntime.publishRunLearningEvidence;
export const acceptOwnedConfirmationEvidence = supabaseReleaseIdentityPersonalizationRuntime.acceptConfirmationEvidence;
export const closeOwnedRunLearningEvidence = supabaseReleaseIdentityPersonalizationRuntime.closeRunLearningEvidence;
export const purgeOwnedRunLearningEvidence = supabaseReleaseIdentityPersonalizationRuntime.purgeRunLearningEvidence;
export const retryOwnedLearningEvidenceCleanup = supabaseReleaseIdentityPersonalizationRuntime.retryLearningEvidenceCleanup;
export const invalidateOwnedLearningEvidence = supabaseReleaseIdentityPersonalizationRuntime.invalidateLearningEvidence;
export const preserveUnverifiedOwnedCourseRun = supabaseReleaseIdentityPersonalizationRuntime.preserveUnverifiedCourseRun;
export const readOwnedCourseRunOwnership = supabaseReleaseIdentityPersonalizationRuntime.readCourseRunOwnership;
export const canCleanupOwnedCourseRun = supabaseReleaseIdentityPersonalizationRuntime.canCleanupCourseRun;
export const captureOwnedStopEligibility = supabaseReleaseIdentityPersonalizationRuntime.captureStopPersonalizationEligibility;
export const completeOwnedCourseRun = supabaseReleaseIdentityPersonalizationRuntime.completeCourseRun;
export const retryOwnedCourseRunSync = supabaseReleaseIdentityPersonalizationRuntime.retryCourseRunSync;
export const readPendingOwnedCourseRunSyncs = supabaseReleaseIdentityPersonalizationRuntime.readPendingCourseRunSyncs;
export const readOwnedDeviceCourseCompletions = supabaseReleaseIdentityPersonalizationRuntime.readDeviceCourseCompletions;
export const readGuestCompletionImportSource = supabaseReleaseIdentityPersonalizationRuntime.readGuestImportSource;
export const dismissGuestCompletionImportOffer = supabaseReleaseIdentityPersonalizationRuntime.dismissGuestImportOffer;
export const approveGuestCompletionImport = supabaseReleaseIdentityPersonalizationRuntime.approveGuestCompletionImport;
export const continueGuestCompletionImport = supabaseReleaseIdentityPersonalizationRuntime.continueGuestCompletionImport;
export const readOwnedDwellPersonalizationSamples = supabaseReleaseIdentityPersonalizationRuntime.readDwellPersonalizationSamples;
export const resetOwnedDwellPersonalization = supabaseReleaseIdentityPersonalizationRuntime.resetDwellPersonalization;
export const cleanupAccountOwnedDeviceData = supabaseReleaseIdentityPersonalizationRuntime.cleanupAccountDeviceData;
export const deleteAllOwnedAccountRecords = supabaseReleaseIdentityPersonalizationRuntime.deleteAllAccountRecords;
export const deleteOwnedAccountRecord = supabaseReleaseIdentityPersonalizationRuntime.deleteAccountRecord;
export const deleteOwnedAccount = supabaseReleaseIdentityPersonalizationRuntime.deleteAccount;
export const recheckOwnedAccountDeletion = supabaseReleaseIdentityPersonalizationRuntime.recheckAccountDeletion;
