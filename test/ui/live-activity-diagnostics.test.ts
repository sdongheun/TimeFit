import assert from 'node:assert/strict';
import test from 'node:test';
import { liveActivityDiagnosticsEnabled, summarizeLiveActivityDiagnostics } from '../../src/ui/liveActivity/liveActivityDiagnosticsModel';

const event = (stream: 'intent' | 'app', stage: string, result: string, error = 'none') => ({
  schemaVersion: 2, nativeSourceRevision: 'ula-button-diagnostic-2026-09-06.5', build: '1.0.0(1)', stream,
  action: stream === 'intent' ? 'arrival' : 'foreground', attemptId: stream === 'intent' ? 'attempt-a' : 'attempt-b',
  stage, result, error, phase: 'traveling', revision: 1,
});

test('ULA button diagnostics: 앱 복귀 스트림은 Intent의 마지막 성공·최초 실패 경계를 덮지 않는다', () => {
  const report = summarizeLiveActivityDiagnostics({
    build: { mainVersion: '1.0.0', mainBuild: '1', nativeSourceRevision: 'ula-button-diagnostic-2026-09-06.5' },
    intent: [event('intent', 'intent_entered', 'started'), event('intent', 'target_lookup', 'succeeded'), event('intent', 'receipt_write_after', 'failed', 'receipt_write_failed')],
    app: [event('app', 'foreground_entered', 'started'), event('app', 'app_reconcile_completed', 'succeeded')],
  });
  assert.equal(report.status, 'ready');
  assert.match(report.lines.join('\n'), /last_success=target_lookup first_failure=receipt_write_after error=receipt_write_failed/);
  assert.match(report.lines.join('\n'), /intent arrival/);
  assert.match(report.lines.join('\n'), /app foreground/);
});

test('ULA button diagnostics: 허용 schema 밖의 식별·payload는 표시하지 않고 기존 exact internal flag만 허용한다', () => {
  const report = summarizeLiveActivityDiagnostics({
    build: { mainVersion: '1.0.0', mainBuild: '1', nativeSourceRevision: 'ula-button-diagnostic-2026-09-06.5' },
    intent: [{ ...event('intent', 'intent_entered', 'started'), courseRunId: 'secret-run', targetTitle: 'private-place' }], app: [],
  });
  assert.doesNotMatch(report.lines.join('\n'), /secret-run|private-place/);
  assert.equal(liveActivityDiagnosticsEnabled(false, 'true'), true);
  for (const flag of [undefined, '', 'TRUE', '1']) assert.equal(liveActivityDiagnosticsEnabled(false, flag), false);
});
