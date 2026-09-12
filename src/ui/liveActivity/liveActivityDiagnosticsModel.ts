export const LIVE_ACTIVITY_DIAGNOSTIC_JS_REVISION = 'ula-final-2026-09-08.1';
const streams = ['intent', 'app'] as const;
const actions = ['arrival', 'snooze', 'departure', 'boot', 'foreground', 'receipt', 'screen', 'pending', 'route'] as const;
const results = ['started', 'succeeded', 'rejected', 'failed', 'observed', 'absent'] as const;
const errors = ['none', 'diagnostic_store_failed', 'target_record_mismatch', 'activity_missing', 'identity_mismatch', 'receipt_write_failed', 'pending_write_failed', 'activity_update_failed', 'target_update_failed', 'storage_unreadable', 'receipt_rejected', 'pending_rejected', 'native_unavailable', 'invalid_stage', 'app_unavailable', 'app_open_failed', 'web_open_failed', 'browser_dismissed', 'browser_open_failed', 'unknown'] as const;
export type DiagnosticAction = typeof actions[number];
export type DiagnosticResult = typeof results[number];
export type DiagnosticError = typeof errors[number];
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const includes = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => typeof value === 'string' && values.includes(value as T[number]);
const safeText = (value: unknown, pattern: RegExp) => typeof value === 'string' && value.length <= 100 && pattern.test(value) ? value : null;

export function liveActivityDiagnosticsEnabled(dev: boolean, existingInternalFlag: string | undefined): boolean {
  return dev === true || existingInternalFlag === 'true';
}

function decodeEvent(value: unknown) {
  if (!isObject(value) || value.schemaVersion !== 2 || !includes(streams, value.stream) || !includes(actions, value.action)
    || !includes(results, value.result) || !includes(errors, value.error)) return null;
  const attemptId = safeText(value.attemptId, /^[a-z0-9-]+$/);
  const stage = safeText(value.stage, /^[a-z0-9_]+$/);
  const build = safeText(value.build, /^[a-zA-Z0-9()._-]+$/);
  const nativeRevision = safeText(value.nativeSourceRevision, /^[a-zA-Z0-9._-]+$/);
  if (!attemptId || !stage || !build || !nativeRevision) return null;
  return { stream: value.stream, action: value.action, attemptId, stage, result: value.result, error: value.error,
    build, nativeRevision, phase: safeText(value.phase, /^[a-z_]+$/), revision: Number.isInteger(value.revision) ? value.revision as number : null };
}

export function summarizeLiveActivityDiagnostics(raw: unknown): Readonly<{ status: 'empty' | 'ready' | 'failed'; lines: readonly string[] }> {
  if (!isObject(raw) || !isObject(raw.build)) return { status: 'failed', lines: [] };
  const mainVersion = safeText(raw.build.mainVersion, /^[a-zA-Z0-9._-]+$/) ?? 'unknown';
  const mainBuild = safeText(raw.build.mainBuild, /^[a-zA-Z0-9._-]+$/) ?? 'unknown';
  const nativeRevision = safeText(raw.build.nativeSourceRevision, /^[a-zA-Z0-9._-]+$/) ?? 'unknown';
  const byStream = Object.fromEntries(streams.map(stream => [stream, Array.isArray(raw[stream]) ? raw[stream].map(decodeEvent).filter(Boolean) : []])) as Record<typeof streams[number], NonNullable<ReturnType<typeof decodeEvent>>[]>;
  const decoded = streams.flatMap(stream => byStream[stream]);
  const buildLine = `build=${mainVersion}(${mainBuild}) native=${nativeRevision} js=${LIVE_ACTIVITY_DIAGNOSTIC_JS_REVISION}`;
  if (!decoded.length) return { status: 'empty', lines: [buildLine] };
  const attempts = [...new Set(byStream.intent.map(item => item.attemptId))];
  const boundaries = attempts.map(attemptId => {
    const values = byStream.intent.filter(item => item.attemptId === attemptId);
    const firstFailure = values.find(item => item.result === 'failed' || item.result === 'rejected');
    const beforeFailure = firstFailure ? values.slice(0, values.indexOf(firstFailure)) : values;
    const lastSuccess = [...beforeFailure].reverse().find(item => item.result === 'succeeded' || item.result === 'observed' || item.result === 'started');
    return `boundary attempt=${attemptId} last_success=${lastSuccess?.stage ?? 'none'} first_failure=${firstFailure?.stage ?? 'none'} error=${firstFailure?.error ?? 'none'}`;
  });
  return { status: 'ready', lines: [buildLine, ...boundaries, ...streams.flatMap(stream => byStream[stream].map(item => `${item.stream} ${item.action} attempt=${item.attemptId} stage=${item.stage} result=${item.result} error=${item.error} phase=${item.phase ?? '-'} revision=${item.revision ?? '-'}`))] };
}

export function createDiagnosticAttemptId(): string {
  return `${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36)}-${Date.now().toString(36)}`;
}
