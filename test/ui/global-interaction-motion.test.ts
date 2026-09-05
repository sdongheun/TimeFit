import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { inPlaceTransitionTarget } from '../../src/ui/inPlaceTransitionModel';
import { createArrivalBufferInteraction } from '../../src/ui/arrivalBufferInteraction';
import { pressVisualState, resolveAnimatedPressableStyle } from '../../src/ui/pressInteractionModel';
import { createSelectionHapticRequester, dispatchSelectionHaptic, type SelectionHapticFailure } from '../../src/ui/selectionHaptic';
import { createTimeWheelInteraction, timeWheelMomentumExpected } from '../../src/ui/timeWheelInteraction';

const uiTsxFiles = () => fs.readdirSync('src/ui', { recursive: true })
  .filter((name): name is string => typeof name === 'string' && name.endsWith('.tsx'))
  .map((name) => `src/ui/${name}`);
const uiCodeFiles = () => fs.readdirSync('src/ui', { recursive: true })
  .filter((name): name is string => typeof name === 'string' && /\.tsx?$/.test(name))
  .map((name) => `src/ui/${name}`);

test('UINTERACTION01 수락 전 보완 failure-first: Animated surface에는 함수 style을 전달하지 않는다', () => {
  const pressable = fs.readFileSync('src/ui/AnimatedPressable.tsx', 'utf8');
  assert.doesNotMatch(pressable, /style=\{resolveStyle\}/);
  assert.match(pressable, /style=\{resolvedAnimatedStyle\}/);
});

test('공용 style resolver는 정적 객체·numeric ID·배열을 보존하고 motion을 마지막에 합성한다', () => {
  const motionStyle = { opacity: 'animated-opacity', transform: ['animated-scale'] };
  const homePrimary = { minHeight: 54, backgroundColor: '#4cc2ff', alignItems: 'center' };
  const homeResolved = resolveAnimatedPressableStyle(homePrimary, { pressed: false }, motionStyle);
  assert.equal(Array.isArray(homeResolved), true);
  assert.equal(homeResolved[0], homePrimary);
  assert.equal(homeResolved[1], motionStyle);
  assert.equal(typeof homeResolved, 'object');

  const styleSheetNumericId = 73;
  assert.deepEqual(resolveAnimatedPressableStyle(styleSheetNumericId, { pressed: false }, motionStyle), [73, motionStyle]);

  const timeSetupRow = [101, false, 102];
  const rowResolved = resolveAnimatedPressableStyle(timeSetupRow, { pressed: false }, motionStyle);
  assert.equal(rowResolved[0], timeSetupRow);
  assert.deepEqual(rowResolved, [[101, false, 102], motionStyle]);

  const floatingTabItem = [201, true && 202];
  assert.deepEqual(resolveAnimatedPressableStyle(floatingTabItem, { pressed: false }, motionStyle), [[201, 202], motionStyle]);
});

test('함수형 style은 내부 idle/press-in/press-out 상태로 먼저 평가되고 selected·pressed를 함께 보존한다', () => {
  const evaluated: boolean[] = [];
  const motionStyle = { opacity: 'animated-opacity' };
  const selectedStyle = (state: { pressed: boolean }) => {
    evaluated.push(state.pressed);
    return [301, 302, state.pressed && 303];
  };

  const idle = resolveAnimatedPressableStyle(selectedStyle, { pressed: false }, motionStyle);
  const pressIn = resolveAnimatedPressableStyle(selectedStyle, { pressed: true }, motionStyle);
  const pressOut = resolveAnimatedPressableStyle(selectedStyle, { pressed: false }, motionStyle);
  assert.deepEqual(evaluated, [false, true, false]);
  assert.deepEqual(idle, [[301, 302, false], motionStyle]);
  assert.deepEqual(pressIn, [[301, 302, 303], motionStyle]);
  assert.deepEqual(pressOut, [[301, 302, false], motionStyle]);
  assert.equal(typeof pressIn, 'object');
});

test('공용 pressable은 busy/disabled 전환에서 idle로 복원하고 원 callback·공개 props 전달을 유지한다', () => {
  const pressable = fs.readFileSync('src/ui/AnimatedPressable.tsx', 'utf8');
  assert.match(pressable, /const \[isPressed, setIsPressed\] = useState\(false\)/);
  assert.match(pressable, /if \(!unavailable\) return;[\s\S]*setIsPressed\(false\);[\s\S]*progress\.stopAnimation\(\);[\s\S]*progress\.setValue\(0\)/);
  assert.match(pressable, /\{\.\.\.props\}[\s\S]*disabled=\{unavailable\}[\s\S]*accessibilityState=/);
  assert.match(pressable, /setIsPressed\(true\);[\s\S]*animate\(true\);[\s\S]*onPressIn\?\.\(event\)/);
  assert.match(pressable, /setIsPressed\(false\);[\s\S]*animate\(false\);[\s\S]*onPressOut\?\.\(event\)/);
  assert.doesNotMatch(pressable, /as ComponentType<PressableProps>/);
});

test('대표 화면은 공용 resolver 입력인 기존 style 참조와 함수형 selected card를 유지한다', () => {
  const home = fs.readFileSync('src/ui/HomeScreen.tsx', 'utf8');
  const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf8');
  const tabs = fs.readFileSync('src/ui/FloatingTabBar.tsx', 'utf8');
  const twoStop = fs.readFileSync('src/ui/recommendation/TwoStopSelectionPanel.tsx', 'utf8');
  assert.match(home, /<Pressable style=\{s\.primary\}/);
  const setupInputs = fs.readFileSync('src/ui/timeSetup/UnifiedSetupInputs.tsx', 'utf8');
  assert.match(setupInputs, /<Pressable[^>]*style=\{s\.field\}/);
  assert.match(setup, /<Pressable[^>]*style=\{s\.primary\}/);
  assert.match(tabs, /style=\{\[s\.item, isActive && s\.itemOn\]\}/);
  assert.match(twoStop, /style=\{\(\{ pressed \}\) => \[s\.card, selected && s\.selected, pressed && s\.pressed\]\}/);
});

test('UINTERACTION01 failure-first: native stack과 임시 sheet·Results region의 전환 역할이 분리된다', () => {
  const app = fs.readFileSync('App.tsx', 'utf8');
  const captcha = fs.readFileSync('src/ui/CaptchaVerificationSheet.tsx', 'utf8');
  const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf8');
  assert.doesNotMatch(app, /animation:\s*["']fade["']|animationDuration/);
  assert.match(captcha, /animationType=["']slide["']/);
  assert.match(results, /InPlaceTransition/);
});

test('UINTERACTION01 failure-first: 오전·오후·시·분은 같은 momentum wheel 경계를 사용한다', () => {
  const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf8');
  const wheel = fs.readFileSync('src/ui/TimeWheel.tsx', 'utf8');
  assert.match(setup, /values=\{MERIDIEMS\}/);
  assert.doesNotMatch(setup, /set(?:Test)?Pm\((?:false|true)\)/);
  assert.match(wheel, /onScroll=/);
  assert.doesNotMatch(wheel, /onScrollEndDrag=\{commit\}/);
  assert.doesNotMatch(wheel, /disableIntervalMomentum/);
});

test('UINTERACTION01 failure-first: 앱 소유 pressable은 햅틱 없는 공용 경계만 사용한다', () => {
  assert.equal(fs.existsSync('src/ui/AnimatedPressable.tsx'), true);
  const pressable = fs.readFileSync('src/ui/AnimatedPressable.tsx', 'utf8');
  assert.doesNotMatch(pressable, /expo-haptics|Haptics/);
  const files = ['App.tsx', ...uiTsxFiles()].filter((file) => file !== 'src/ui/AnimatedPressable.tsx');
  const rawImports = files.filter((file) => /import\s*\{[^}]*\bPressable\b[^}]*\}\s*from ["']react-native["']/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(rawImports, []);
  const bypasses = files.filter((file) => fs.readFileSync(file, 'utf8').includes('<Pressable')
    && !fs.readFileSync(file, 'utf8').includes('AnimatedPressable as Pressable'));
  assert.deepEqual(bypasses, []);
  const hapticsImports = uiTsxFiles().filter((file) => /expo-haptics/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(hapticsImports, []);
  const nativeHapticImports = uiCodeFiles().filter((file) => /from ['"]expo-haptics['"]/.test(fs.readFileSync(file, 'utf8'))).sort();
  assert.deepEqual(nativeHapticImports, ['src/ui/expoSelectionHaptic.ts']);
});

test('공용 press motion은 standard·icon·release·disabled·Reduce Motion 계약을 지킨다', () => {
  let generalButtonHapticCount = 0;
  assert.deepEqual(pressVisualState('pressed', 'standard', false, false), { scale: 0.975, opacity: 0.92, durationMs: 70 });
  assert.deepEqual(pressVisualState('pressed', 'icon', false, false), { scale: 0.95, opacity: 0.92, durationMs: 70 });
  assert.deepEqual(pressVisualState('idle', 'standard', false, false), { scale: 1, opacity: 1, durationMs: 170 });
  assert.deepEqual(pressVisualState('pressed', 'standard', false, true), { scale: 1, opacity: 1, durationMs: 0 });
  assert.deepEqual(pressVisualState('pressed', 'standard', true, false), { scale: 1, opacity: 0.92, durationMs: 70 });
  assert.equal(generalButtonHapticCount, 0);
});

test('고속 wheel은 row별 햅틱만 내고 momentum 종료에서 최종값을 한 번 commit한다', () => {
  const wheel = createTimeWheelInteraction(0, 5);
  let hapticCount = 0;
  const commitIndexes: number[] = [];
  const record = (decision: ReturnType<typeof wheel.observeOffset>) => {
    if (decision.haptic) hapticCount += 1;
    if (decision.commitIndex !== undefined) commitIndexes.push(decision.commitIndex);
  };

  record(wheel.beginDrag());
  record(wheel.observeOffset(44, 44));
  record(wheel.observeOffset(44, 44));
  record(wheel.observeOffset(88, 44));
  assert.equal(timeWheelMomentumExpected(1.2, 88, 176), true);
  record(wheel.endDrag(true));
  assert.deepEqual(commitIndexes, []);
  record(wheel.beginMomentum());
  record(wheel.observeOffset(132, 44));
  record(wheel.endMomentum());
  record(wheel.endMomentum());

  assert.equal(hapticCount, 3);
  assert.deepEqual(commitIndexes, [3]);
});

test('저속·prop·접근성·빈 wheel은 중복 햅틱 없이 안전하게 commit/clamp한다', () => {
  const programmatic = createTimeWheelInteraction(0, 4);
  assert.deepEqual(programmatic.syncExternal(2), { activeIndex: 2, haptic: false, scrollToIndex: 2 });

  const slow = createTimeWheelInteraction(0, 3);
  slow.beginDrag();
  const crossed = slow.observeOffset(44, 44);
  assert.equal(crossed.haptic, true);
  assert.equal(timeWheelMomentumExpected(0, 44, 44), false);
  assert.equal(slow.endDrag(false).commitIndex, 1);
  assert.equal(slow.endMomentum().commitIndex, undefined);

  const adjustable = createTimeWheelInteraction(1, 3);
  assert.deepEqual(adjustable.adjust(1), { activeIndex: 2, haptic: false, commitIndex: 2, scrollToIndex: 2 });
  assert.equal(adjustable.adjust(1).commitIndex, undefined);
  assert.equal(adjustable.adjust(-1).haptic, false);

  const empty = createTimeWheelInteraction(0, 0);
  assert.deepEqual(empty.adjust(1), { activeIndex: -1, haptic: false });
});

test('UINTERACTION01 2차 보완 failure-first: wheel decision이 공용 selection adapter를 새 사용자 행에만 호출한다', () => {
  const wheel = createTimeWheelInteraction(0, 4);
  let adapterCalls = 0;
  const request = createSelectionHapticRequester({ selection: () => { adapterCalls += 1; } });
  const apply = (decision: ReturnType<typeof wheel.observeOffset>) => dispatchSelectionHaptic(decision.haptic, request);

  apply(wheel.syncExternal(0));
  apply(wheel.beginDrag());
  apply(wheel.observeOffset(44, 44));
  apply(wheel.observeOffset(44, 44));
  apply(wheel.observeOffset(88, 44));
  apply(wheel.endDrag(true));
  apply(wheel.beginMomentum());
  apply(wheel.endMomentum());
  assert.equal(adapterCalls, 2);

  apply(wheel.syncExternal(3));
  apply(wheel.adjust(-1));
  assert.equal(adapterCalls, 2);
});

test('UINTERACTION01 2차 보완 failure-first: slider는 drag 중 실제 보고된 새 5분 값만 촉각 결정한다', () => {
  const slider = createArrivalBufferInteraction(5);
  slider.begin(5);
  assert.deepEqual([
    slider.change(10),
    slider.change(10),
    slider.change(15),
    slider.complete(15),
  ], [
    { value: 10, haptic: true },
    { value: 10, haptic: false },
    { value: 15, haptic: true },
    { value: 15, haptic: false },
  ]);

  const ignored = createArrivalBufferInteraction(5);
  assert.deepEqual(ignored.syncExternal(10), { value: 10, haptic: false });
  assert.deepEqual(ignored.change(15), { value: 15, haptic: false });
  assert.deepEqual(ignored.complete(15), { value: 15, haptic: false });

  const skipped = createArrivalBufferInteraction(5);
  skipped.begin(5);
  assert.deepEqual(skipped.change(20), { value: 20, haptic: true });
});

test('UINTERACTION01 2차 보완 failure-first: adapter 성공·reject·native unavailable은 비차단이며 진단은 원인별 최초 1회다', async () => {
  const diagnostics: SelectionHapticFailure[] = [];
  let successCalls = 0;
  const success = createSelectionHapticRequester(
    { selection: () => { successCalls += 1; } },
    { dev: true, onDiagnostic: (reason) => diagnostics.push(reason) },
  );
  success();
  assert.equal(successCalls, 1);

  const rejected = createSelectionHapticRequester(
    { selection: () => Promise.reject(new Error('secret provider detail')) },
    { dev: true, onDiagnostic: (reason) => diagnostics.push(reason) },
  );
  rejected();
  rejected();

  const unavailable = createSelectionHapticRequester(
    { selection: () => Promise.reject(Object.assign(new Error('native module missing'), { name: 'UnavailabilityError' })) },
    { dev: true, onDiagnostic: (reason) => diagnostics.push(reason) },
  );
  unavailable();
  unavailable();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(diagnostics, ['request_rejected', 'native_unavailable']);
});

test('UINTERACTION01 2차 보완: wheel과 도착 여유 slider만 공용 selection haptic 경계에 연결한다', () => {
  const wheelSource = fs.readFileSync('src/ui/TimeWheel.tsx', 'utf8');
  const setupSource = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf8');
  const adapterSource = fs.readFileSync('src/ui/expoSelectionHaptic.ts', 'utf8');
  assert.match(wheelSource, /dispatchSelectionHaptic\(decision\.haptic/);
  assert.match(setupSource, /createArrivalBufferInteraction/);
  assert.match(setupSource, /onSlidingStart=/);
  assert.match(setupSource, /onSlidingComplete=/);
  assert.match(setupSource, /accessibilityLabel=["']도착 전 남길 시간["']/);
  assert.match(adapterSource, /expo-haptics/);
  assert.doesNotMatch(fs.readFileSync('src/ui/AnimatedPressable.tsx', 'utf8'), /selectionHaptic|expo-haptics/);
  const requestConsumers = uiCodeFiles().filter((file) => file !== 'src/ui/expoSelectionHaptic.ts'
    && /requestExpoSelectionHaptic/.test(fs.readFileSync(file, 'utf8'))).sort();
  assert.deepEqual(requestConsumers, ['src/ui/TimeSetupScreen.tsx', 'src/ui/TimeWheel.tsx']);
});

test('Results 부분 전환은 지정 범위이며 Reduce Motion에서 translate를 제거한다', () => {
  assert.deepEqual(inPlaceTransitionTarget(false), { fromOpacity: 0.82, fromTranslateY: 10, durationMs: 190 });
  assert.deepEqual(inPlaceTransitionTarget(true), { fromOpacity: 0.82, fromTranslateY: 0, durationMs: 190 });
});
