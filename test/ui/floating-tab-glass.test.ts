import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  resolveFloatingTabIndexAtX,
  resolveFloatingTabIndexFromDrag,
  resolveFloatingTabMaterial,
} from '../../src/ui/floatingTabGlassModel';

test('floating tab uses native liquid glass only when every iOS capability is available', () => {
  assert.equal(resolveFloatingTabMaterial({ platform: 'ios', liquidGlassAvailable: true, glassApiAvailable: true, reduceTransparency: false }), 'liquid');
  assert.equal(resolveFloatingTabMaterial({ platform: 'ios', liquidGlassAvailable: true, glassApiAvailable: false, reduceTransparency: false }), 'blur');
  assert.equal(resolveFloatingTabMaterial({ platform: 'ios', liquidGlassAvailable: false, glassApiAvailable: true, reduceTransparency: false }), 'blur');
});

test('floating tab respects reduced transparency and keeps non-iOS output deterministic', () => {
  assert.equal(resolveFloatingTabMaterial({ platform: 'ios', liquidGlassAvailable: true, glassApiAvailable: true, reduceTransparency: true }), 'solid');
  assert.equal(resolveFloatingTabMaterial({ platform: 'web', liquidGlassAvailable: false, glassApiAvailable: false, reduceTransparency: false }), 'solid');
});

test('floating tab connects glass and blur surfaces without changing navigation or haptic boundaries', () => {
  const tab = readFileSync(new URL('../../src/ui/FloatingTabBar.tsx', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

  assert.ok(pkg.dependencies['expo-glass-effect']);
  assert.ok(pkg.dependencies['expo-blur']);
  assert.match(tab, /GlassView/);
  assert.match(tab, /BlurView/);
  assert.match(tab, /isReduceTransparencyEnabled/);
  assert.match(tab, /reduceTransparencyChanged/);
  assert.match(tab, /onLayout=\{\(\{ nativeEvent \}\) => onFrame\?\.\(nativeEvent\.layout\)\}/);
  assert.match(tab, /TABS\.map/);
  assert.doesNotMatch(tab, /Haptics|selectionAsync/);
});

test('native liquid glass owns the tab content and reacts to touch instead of acting as a dark backdrop', () => {
  const tab = readFileSync(new URL('../../src/ui/FloatingTabBar.tsx', import.meta.url), 'utf8');
  const glassStart = tab.indexOf('<GlassView');
  const glassEnd = tab.indexOf('</GlassView>', glassStart);
  const content = tab.indexOf('{tabContent}', glassStart);

  assert.ok(glassStart >= 0, 'GlassView must be rendered');
  assert.match(tab.slice(glassStart, glassEnd), /isInteractive/);
  assert.ok(glassEnd > glassStart, 'GlassView must contain the tab controls');
  assert.ok(content > glassStart && content < glassEnd, 'tab controls must be children of GlassView');
  assert.doesNotMatch(tab, /tintColor="rgba\(17, 28, 43, 0\.46\)"/);
});

test('floating tab drag resolves the nearest of four equal slots and clamps outside movement', () => {
  assert.equal(resolveFloatingTabIndexAtX(-40, 360, 4, 6), 0);
  assert.equal(resolveFloatingTabIndexAtX(50, 360, 4, 6), 0);
  assert.equal(resolveFloatingTabIndexAtX(120, 360, 4, 6), 1);
  assert.equal(resolveFloatingTabIndexAtX(220, 360, 4, 6), 2);
  assert.equal(resolveFloatingTabIndexAtX(340, 360, 4, 6), 3);
  assert.equal(resolveFloatingTabIndexAtX(440, 360, 4, 6), 3);
  assert.equal(resolveFloatingTabIndexAtX(10, 0, 4, 6), 0);
});

test('a second drag starts from the currently pressed tab instead of treating child-local x as the first tab', () => {
  assert.equal(resolveFloatingTabIndexFromDrag(3, 0, 360, 4, 6), 3);
  assert.equal(resolveFloatingTabIndexFromDrag(3, -90, 360, 4, 6), 2);
  assert.equal(resolveFloatingTabIndexFromDrag(2, 90, 360, 4, 6), 3);
  assert.equal(resolveFloatingTabIndexFromDrag(1, -500, 360, 4, 6), 0);
  assert.equal(resolveFloatingTabIndexFromDrag(2, 500, 360, 4, 6), 3);
});

test('floating tab keeps screen navigation on release while the selection lens follows drag', () => {
  const tab = readFileSync(new URL('../../src/ui/FloatingTabBar.tsx', import.meta.url), 'utf8');

  assert.match(tab, /PanResponder\.create/);
  assert.match(tab, /floating-tab-selection-lens/);
  assert.match(tab, /onMoveShouldSetPanResponder/);
  assert.match(tab, /onPanResponderMove/);
  assert.match(tab, /onPanResponderRelease/);
  assert.match(tab, /onPanResponderTerminate/);
  assert.match(tab, /gesture\.dx/);
  assert.match(tab, /useNativeDriver: true/);
});

test('a regular tap records and lifts on press-in but leaves position animation to the next mounted tab bar', () => {
  const tab = readFileSync(new URL('../../src/ui/FloatingTabBar.tsx', import.meta.url), 'utf8');
  const pressIn = tab.match(/onPressIn=\{\(\) => \{[\s\S]*?\n\s*\}\}\n\s*onPressOut=/)?.[0] ?? '';

  assert.match(pressIn, /pressedTabIndexRef\.current = tabIndex/);
  assert.match(pressIn, /setLensLifted\(true\)/);
  assert.doesNotMatch(pressIn, /settleLens\(tabIndex\)/);
  assert.match(tab, /lensPosition\.setValue\(dragStartIndexRef\.current\)/);
});
