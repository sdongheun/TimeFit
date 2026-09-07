import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('B-remediation native harness: 같은 stop snooze는 채널/새 revision과 무관하게 1회, 다음 stop은 독립 허용한다', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'timefit-native-policy-'));
  const output = path.join(directory, 'policy-harness');
  execFileSync('xcrun', ['swiftc',
    'plugins/live-activity/TimeFitNativeProgressPolicy.swift',
    'test/ui/fixtures/TimeFitNativeProgressPolicyHarness.swift',
    '-o', output,
  ], { cwd: process.cwd(), stdio: 'pipe', env: { ...process.env, CLANG_MODULE_CACHE_PATH: path.join(directory, 'module-cache') } });
  const result = execFileSync(output, [], { encoding: 'utf8' }).trim();
  assert.equal(result, 'PASS native snooze policy');
});

test('ULA lock handoff native harness: 예정시각 gate 없이 첫 도착을 적용하고 pending 실행은 역행하지 않는다', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'timefit-native-intent-policy-'));
  const output = path.join(directory, 'intent-policy-harness');
  execFileSync('xcrun', ['swiftc',
    'plugins/live-activity/TimeFitNativeIntentPolicy.swift',
    'test/ui/fixtures/TimeFitNativeIntentPolicyHarness.swift',
    '-o', output,
  ], { cwd: process.cwd(), stdio: 'pipe', env: { ...process.env, CLANG_MODULE_CACHE_PATH: path.join(directory, 'module-cache') } });
  assert.equal(execFileSync(output, [], { encoding: 'utf8' }).trim(), 'PASS native intent policy');
});
