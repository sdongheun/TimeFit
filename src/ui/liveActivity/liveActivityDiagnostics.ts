import { NativeModules, Platform } from 'react-native';
import { createDiagnosticAttemptId, liveActivityDiagnosticsEnabled, summarizeLiveActivityDiagnostics, type DiagnosticAction, type DiagnosticError, type DiagnosticResult } from './liveActivityDiagnosticsModel';
export { createDiagnosticAttemptId, liveActivityDiagnosticsEnabled, summarizeLiveActivityDiagnostics } from './liveActivityDiagnosticsModel';
type NativeDiagnosticModule = Readonly<{
  readLiveActivityDiagnostics?: () => Promise<unknown>;
  copyLiveActivityDiagnostics?: () => Promise<unknown>;
  clearLiveActivityDiagnostics?: () => Promise<void>;
  recordAppDiagnostic?: (value: Readonly<{ action: DiagnosticAction; attemptId: string; stage: string; result: DiagnosticResult; error: DiagnosticError; phase?: string; revision?: number }>) => Promise<boolean>;
}>;

const module = (NativeModules.TimeFitLiveActivityModule as NativeDiagnosticModule | undefined) ?? null;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export async function readLiveActivityDiagnosticReport(): Promise<Readonly<{ status: 'unavailable' | 'empty' | 'ready' | 'failed'; lines: readonly string[] }>> {
  if (Platform.OS !== 'ios' || !module?.readLiveActivityDiagnostics) return { status: 'unavailable', lines: [] };
  try {
    return summarizeLiveActivityDiagnostics(await module.readLiveActivityDiagnostics());
  } catch { return { status: 'failed', lines: [] }; }
}

export async function copyLiveActivityDiagnosticReport(): Promise<Readonly<{ status: 'copied' | 'unavailable' | 'failed'; entryCount: number }>> {
  if (Platform.OS !== 'ios' || !module?.copyLiveActivityDiagnostics) return { status: 'unavailable', entryCount: 0 };
  try {
    const value = await module.copyLiveActivityDiagnostics();
    if (!isObject(value) || value.status !== 'copied' || !Number.isInteger(value.entryCount)) return { status: 'failed', entryCount: 0 };
    return { status: 'copied', entryCount: value.entryCount as number };
  } catch { return { status: 'failed', entryCount: 0 }; }
}

export async function clearLiveActivityDiagnosticReport(): Promise<void> {
  if (Platform.OS !== 'ios' || !module?.clearLiveActivityDiagnostics) throw new Error('live_activity_diagnostics_unavailable');
  await module.clearLiveActivityDiagnostics();
}

export async function recordLiveActivityAppDiagnostic(value: Readonly<{ action: DiagnosticAction; attemptId: string; stage: string; result: DiagnosticResult; error?: DiagnosticError; phase?: string; revision?: number }>): Promise<void> {
  if (Platform.OS !== 'ios' || !module?.recordAppDiagnostic) return;
  await module.recordAppDiagnostic({ ...value, error: value.error ?? 'none' });
}
