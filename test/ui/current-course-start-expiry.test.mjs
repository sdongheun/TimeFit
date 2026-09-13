import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';
const require = createRequire(import.meta.url);
const { createActiveVerifiedCourseStartController } = require('../../src/ui/activeVerifiedCourseModel.ts');

test('existing identical run resumes without new-start clock check or side effects', () => {
  const snapshot = course(['A']);
  const existing = { identity: 'old', courseRunId: 'old-run', session, course: snapshot, progress: { stepIndex: 2, routeOpened: true } };
  let navigated;
  const controller = createActiveVerifiedCourseStartController({
    canStart() { assert.fail('continuing is not starting'); },
    start() { assert.fail('no new run'); }, confirm() { assert.fail('no replacement'); },
    navigate(value) { navigated = value; },
  });
  controller.request(existing, { session, course: snapshot });
  assert.equal(navigated, existing);
});

for (const minutes of [120, 180]) for (const choice of ['late', 'valid', 'continue']) test(`expiry replacement ${minutes}/${choice}`, async () => {
  const selected = { ...session, nowIso: '2026-12-31T14:50:00.000Z', remainingMin: minutes };
  const end = Date.parse(selected.nowIso) + minutes * 60000;
  let now = end - 1;
  class Clock extends Date { static now() { return now; } }
  const f = confirmFixture(course(['A']), { __Date: Clock }, selected);
  const original = { identity: 'old', courseRunId: 'old-run', session, course: course(['B']), progress: { stepIndex: 1, routeOpened: true, finished: false } };
  f.flow.activeVerifiedCourse = original;
  let buttons;
  f.native.Alert.alert = (_title, _message, actions) => { buttons = actions; };
  try {
    const click = f.screen.get('verified-course-start').props.onPress;
    click(); click();
    assert.ok(buttons);
    now = choice === 'valid' ? end - 1 : end + 1;
    const action = buttons.find(b => b.text === (choice === 'continue' ? '기존 코스 이어가기' : '새 코스로 시작')).onPress;
    action(); action(); await settle(); f.screen.render();
    assert.equal(f.calls.filter(c => c === 'start').length, choice === 'valid' ? 1 : 0);
    assert.equal(f.calls.includes('clear'), false);
    assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === 'route').length, 0);
    if (choice !== 'valid') assert.equal(f.flow.activeVerifiedCourse, original);
    if (choice === 'late') {
      f.screen.get('course-start-reset-time').props.onPress();
      assert.ok(f.calls.some(c => Array.isArray(c) && c[0] === 'replace' && c[1] === 'TimeSetup'));
      assert.equal(f.flow.activeVerifiedCourse, original);
    }
  } finally { f.screen.unmount(); }
});

for (const invalid of [{ nowIso: 'invalid' }, { remainingMin: NaN }, { remainingMin: 0 }, { remainingMin: 181 }]) test(`invalid start ${JSON.stringify(invalid)}`, () => {
  const f = confirmFixture(course(['A']), {}, { ...session, ...invalid });
  try {
    f.screen.get('verified-course-start').props.onPress(); f.screen.render();
    assert.equal(f.calls.includes('start'), false);
    assert.ok(f.screen.get('course-start-reset-time'));
  } finally { f.screen.unmount(); }
});
