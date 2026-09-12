import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
test('native diagnostics no longer use a system clock for ordering', () => {
  const code = fs.readFileSync('plugins/live-activity/TimeFitLiveActivityDiagnostics.swift', 'utf8');
  assert.doesNotMatch(code, /uptimeNanoseconds|mach_absolute_time|systemUptime/);
  assert.match(code, /TimeFitDiagnosticFileOrder.withNextLocation/);
});
test('extension manifest declares only app-group file metadata, not a fabricated clock/defaults reason', () => {
  const p = require('@expo/plist').default.parse(fs.readFileSync('plugins/live-activity/PrivacyInfo.xcprivacy', 'utf8'));
  assert.equal(p.NSPrivacyTracking, false);
  assert.deepEqual(p.NSPrivacyAccessedAPITypes.map(value => ({ ...value })), [{ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] }]);
  const order = fs.readFileSync('plugins/live-activity/TimeFitDiagnosticFileOrder.swift', 'utf8');
  assert.match(order, /fstat\(fd, &metadata\)/);
  assert.doesNotMatch(order, /Date\(|DispatchTime|UserDefaults|systemUptime/);
});
test('native order preserves legacy filenames and serializes independent concurrent processes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'timefit-native-order-'));
  const executable = path.join(root, 'harness');
  execFileSync('xcrun', ['swiftc', 'plugins/live-activity/TimeFitDiagnosticFileOrder.swift', 'test/ui/fixtures/TimeFitDiagnosticFileOrderHarness.swift', '-o', executable], { env: { ...process.env, CLANG_MODULE_CACHE_PATH: path.join(root, 'cache') }, stdio: 'pipe' });
  const folder = path.join(root, 'events'); fs.mkdirSync(folder);
  const legacy = '00000001234567890000-legacy.json'; fs.writeFileSync(path.join(folder, legacy), '{}');
  await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(executable, [folder], { stdio: 'pipe' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error('native order failed')));
  })));
  const names = fs.readdirSync(folder).filter(x => x.endsWith('.json')).sort();
  assert.equal(names.length, 81); assert.equal(names[0], legacy);
  assert.equal(new Set(names.map(x => x.slice(0, 20))).size, 81);
  assert.equal(BigInt(names.at(-1).slice(0, 20)), 1234567890000n + 80n);
});
test('archive uses the same production environment without remote signing or upload flags', () => {
  const { buildCommand } = require('../../scripts/release-build.cjs');
  const [cmd, args] = buildCommand('archive');
  assert.equal(cmd, 'xcodebuild'); assert.ok(args.includes('archive'));
  assert.ok(args.includes('Release')); assert.ok(args.includes('-archivePath'));
  assert.doesNotMatch(args.join(' '), /allowProvisioning|upload|exportArchive|Debug/);
  assert.ok(buildCommand('archive', '/private/tmp/fixture-next.xcarchive')[1].includes('/private/tmp/fixture-next.xcarchive'));
  assert.throws(() => buildCommand('archive', 'relative.xcarchive'), /absolute_xcarchive_path_required/);
});
test('native bundle refuses a local override after public inputs were resolved', () => {
  const { publicEnvironment, assertPublicNativeEnvironment } = require('../../scripts/release-build.cjs');
  const env = publicEnvironment({ EXPO_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_fixture', EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL: 'https://fixture.example/', EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture' });
  assert.doesNotThrow(() => assertPublicNativeEnvironment(env));
  for (const change of [{ EXPO_PUBLIC_C_VALIDATION_INTERNAL: 'true' }, { EXPO_NO_DOTENV: '0' }, { NODE_ENV: 'development' }, { SKIP_BUNDLING: '1' }]) assert.throws(() => assertPublicNativeEnvironment({ ...env, ...change }), /public_native_environment_changed/);
});
