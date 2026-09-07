import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = JSON.parse(fs.readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
const plugin = fs.readFileSync(new URL('../../plugins/withTimeFitLiveActivity.cjs', import.meta.url), 'utf8');
const extension = fs.readFileSync(new URL('../../plugins/live-activity/TimeFitLiveActivityExtension.swift', import.meta.url), 'utf8');
const intents = fs.readFileSync(new URL('../../plugins/live-activity/TimeFitLiveActivityIntents.swift', import.meta.url), 'utf8');
const attributes = fs.readFileSync(new URL('../../plugins/live-activity/TimeFitActivityAttributes.swift', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../../plugins/live-activity/TimeFitLiveActivityModule.swift', import.meta.url), 'utf8');
const bridgeRegistration = fs.readFileSync(new URL('../../plugins/live-activity/TimeFitLiveActivityModuleBridge.m', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../../plugins/live-activity/TimeFitLiveActivityDiagnostics.swift', import.meta.url), 'utf8');
const entitlements = fs.readFileSync(new URL('../../plugins/live-activity/TimeFitLiveActivityExtension.entitlements', import.meta.url), 'utf8');

test('A2 failure-first: iOS 17과 실제 App Group을 로컬 config plugin 한 곳에서 재생성한다', () => {
  assert.equal(app.expo.ios.deploymentTarget, '17.0');
  assert.deepEqual(app.expo.plugins[0], [
    './plugins/withTimeFitLiveActivity.cjs',
    {
      appGroupIdentifier: 'group.com.dongheun.mobile.timefit',
      developmentTeam: '642X5R37S7',
      extensionBundleIdentifier: 'com.dongheun.mobile.liveactivity',
    },
  ]);
  assert.deepEqual(app.expo.plugins.find(([name]) => name === 'expo-location')?.[1], {
    locationWhenInUsePermission: '현위치의 도로명 주소와 주변 장소를 보여주기 위해 위치를 사용합니다.',
    locationAlwaysAndWhenInUsePermission: false,
    locationAlwaysPermission: false,
    motionUsagePermission: false,
    isIosBackgroundLocationEnabled: false,
  });
  assert.match(plugin, /withEntitlementsPlist/);
  assert.match(plugin, /NSSupportsLiveActivities/);
  assert.match(plugin, /TimeFitLiveActivityExtension/);
  assert.match(plugin, /findNativeTarget/);
  assert.match(plugin, /removeUndefined/);
  assert.match(plugin, /IPHONEOS_DEPLOYMENT_TARGET/);
  assert.doesNotMatch(plugin, /UIBackgroundModes|CLLocation|pushToken/);
});

test('A2 failure-first: Widget와 bridge는 ActivityKit 및 immutable receipt 경계를 공유한다', () => {
  assert.match(extension, /ActivityConfiguration\(for: TimeFitActivityAttributes\.self\)/);
  assert.match(extension, /DynamicIsland/);
  assert.match(intents, /LiveActivityIntent/);
  assert.match(attributes, /TimeFitLocalProgressEventReceipt/);
  assert.match(attributes, /nextBoundaryAtMs: Double\?/);
  assert.match(attributes, /Data\.write|\.write\(to:/);
  assert.doesNotMatch(extension, /URLSession|CoreLocation|CLLocation|pushToken/);
  assert.match(bridge, /Activity<TimeFitActivityAttributes>\.request/);
  assert.match(bridge, /ActivityAuthorizationInfo\(\)\.areActivitiesEnabled/);
  assert.match(bridgeRegistration, /RCT_EXTERN_MODULE\(TimeFitLiveActivityModule, RCTEventEmitter\)/);
  assert.match(bridgeRegistration, /RCT_EXTERN_METHOD\(startFixture/);
  assert.doesNotMatch(bridge, /URLSession|CoreLocation|CLLocation|Supabase/);
  assert.match(entitlements, /__APP_GROUP_IDENTIFIER__/);
});

test('A3: native fixture는 단일 Activity와 전환 시 앱 상태를 보고하고 네 가지 Preview를 제공한다', () => {
  assert.match(bridge, /TimeFitActivityIdentityPolicy\.purpose/);
  assert.match(bridge, /"status": "cleanup_required"/);
  assert.match(bridge, /UIApplication\.shared\.applicationState/);
  assert.match(bridge, /"applicationState": self\.applicationStateName\(\)/);
  assert.equal((extension.match(/#Preview\(/g) ?? []).length, 4);
  assert.match(extension, /\.dynamicIsland\(\.expanded\)/);
  assert.match(extension, /\.dynamicIsland\(\.compact\)/);
  assert.match(extension, /\.dynamicIsland\(\.minimal\)/);
});

test('ULA-R: shared attributes와 Debug-only fixture 및 실제 course lifecycle entry를 생성한다', () => {
  assert.match(plugin, /APP_FILES = \[\s*'TimeFitActivityAttributes\.swift'/);
  assert.match(attributes, /let purpose: String\?/);
  assert.match(attributes, /legacyFixtureRunIds: Set<String> = \["a3-fixture-run"\]/);
  assert.match(attributes, /permitsCourseReceipt/);
  assert.match(attributes, /receipt\.purpose == "test_fixture"/);
  assert.match(attributes, /guard attributes\.schemaVersion == schemaVersion else \{ return "unknown" \}/);
  assert.match(bridgeRegistration, /#if DEBUG[\s\S]*RCT_EXTERN_METHOD\(startFixture[\s\S]*RCT_EXTERN_METHOD\(endFixtureExact[\s\S]*#endif/);
  assert.match(bridgeRegistration, /RCT_EXTERN_METHOD\(startCourseProgress/);
  assert.match(bridgeRegistration, /RCT_EXTERN_METHOD\(updateCourseProgress/);
  assert.match(bridgeRegistration, /RCT_EXTERN_METHOD\(endCourseProgress/);
  assert.match(bridge, /conflictingRunId/);
  assert.match(bridge, /ignored_old_revision/);
  assert.match(bridge, /activity\.content\.state\.revision == revision/);
  assert.doesNotMatch(bridge, /\?\? "a3-fixture-run"|\?\? "부산시민공원"/);
});

test('ULA lock handoff failure-first: LiveActivityIntent는 app+extension target에 공유되고 출발만 앱을 활성화한다', () => {
  assert.match(plugin, /APP_FILES = \[[\s\S]*'TimeFitLiveActivityIntents\.swift'/);
  assert.match(plugin, /EXTENSION_FILES = \[[\s\S]*'TimeFitLiveActivityIntents\.swift'/);
  assert.match(intents, /struct TimeFitArrivalIntent: LiveActivityIntent/);
  assert.match(intents, /struct TimeFitDepartureIntent: LiveActivityIntent/);
  assert.match(intents, /static var openAppWhenRun: Bool \{ true \}/);
  assert.match(intents, /TimeFitPendingNavigationActionStore\.create/);
  assert.match(intents, /TimeFitLiveActivityDiagnosticStore\.record/);
  assert.doesNotMatch(intents, /CoreLocation|URLSession|kakaomap:\/\/|https:\/\//);
});

test('ULA button diagnostics failure-first: intent/app 분리 bounded 이력과 internal Release 조회·복사를 생성한다', () => {
  assert.match(plugin, /APP_FILES = \[[\s\S]*'TimeFitLiveActivityDiagnostics\.swift'/);
  assert.match(plugin, /EXTENSION_FILES = \[[\s\S]*'TimeFitLiveActivityDiagnostics\.swift'/);
  assert.match(diagnostics, /case intent, app/);
  assert.match(diagnostics, /maximumEntries = 32/);
  assert.match(diagnostics, /TimeFitLiveActivityDiagnostics-v2/);
  assert.match(diagnostics, /diagnostic_store_failed/);
  assert.doesNotMatch(diagnostics, /courseRunId|stopId|targetTitle|latitude|longitude|occurredAtMs|token|payload/);
  assert.match(bridgeRegistration, /RCT_EXTERN_METHOD\(readLiveActivityDiagnostics/);
  assert.match(bridgeRegistration, /RCT_EXTERN_METHOD\(copyLiveActivityDiagnostics/);
  assert.match(bridgeRegistration, /RCT_EXTERN_METHOD\(clearLiveActivityDiagnostics/);
  assert.doesNotMatch(bridgeRegistration, /#if DEBUG\s*RCT_EXTERN_METHOD\(readLiveActivityDiagnostics/);
  assert.match(intents, /receipt_write_before/);
  assert.match(intents, /receipt_write_after/);
  assert.match(intents, /activity_update_requested/);
  assert.match(intents, /activity_update_completed/);
  assert.match(intents, /perform_failed/);
});

test('ULA native file writes failure-first: atomic과 withoutOverwriting을 같은 Data.write에 결합하지 않는다', () => {
  assert.doesNotMatch(diagnostics, /options:\s*\[\s*\.atomic\s*,\s*\.withoutOverwriting\s*\]/);
  assert.doesNotMatch(attributes, /options:\s*\[\s*\.atomic\s*,\s*\.withoutOverwriting\s*\]/);
  assert.match(diagnostics, /write\(to:\s*location,\s*options:\s*\.atomic\)/);
  assert.match(attributes, /write\(to:\s*staged,\s*options:\s*\.atomic\)/);
  assert.match(attributes, /moveItem\(at:\s*staged,\s*to:\s*destination\)/);
});

test('ULA remaining handoff failure-first: native pending event와 browser lifecycle 수락 경계를 연결한다', () => {
  assert.match(intents, /receipt_write_after[\s\S]*TimeFitPendingNavigationSignal\.post\(\)/);
  assert.match(bridge, /RCTEventEmitter/);
  assert.match(bridge, /timeFitPendingNavigationAvailable/);
  assert.match(bridgeRegistration, /RCT_EXTERN_MODULE\(TimeFitLiveActivityModule, RCTEventEmitter\)/);
});

test('ULA device return failure-first: Activity.update 직후 stale content를 동기 검증해 다음 revision target 저장을 막지 않는다', () => {
  assert.match(intents, /await activity\.update\([\s\S]*activity_update_completed[\s\S]*target_write_before/);
  assert.doesNotMatch(intents, /await activity\.update\([\s\S]*guard activity\.content\.state\.revision == revision \+ 1/);
  assert.doesNotMatch(intents, /activity_update_observed/);
});

test('ULA .4 return failure-first: 이전 종료 run의 orphan pending만 교체하고 활성 run 충돌은 보존한다', () => {
  assert.match(intents, /activeCourseRunIds/);
  assert.match(intents, /TimeFitPendingNavigationActionStore\.create\(pending, activeCourseRunIds:/);
  assert.match(intents, /pending_orphan_replaced/);
  assert.match(attributes, /replaceOrphan/);
});
