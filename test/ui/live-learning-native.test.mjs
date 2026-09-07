import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('production Swift projection: prepared/active/double prepare/exact close/late activation', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'timefit-learning-native-'));
  const output = path.join(root, 'harness');
  execFileSync('xcrun', ['swiftc', 'plugins/live-activity/TimeFitLearningEvidence.swift', 'test/ui/fixtures/TimeFitLearningEvidenceHarness.swift', '-o', output],
    { stdio: 'pipe', env: { ...process.env, CLANG_MODULE_CACHE_PATH: path.join(root, 'cache') } });
  assert.equal(execFileSync(output, [], { encoding: 'utf8' }).trim(), 'PASS learning projection');
});
