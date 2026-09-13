import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { screenRuntime } from './support/screenRuntime.mjs';

export const removedUi = ['src/services/courseNotifications.ts'];
const normalized = file => path.resolve(file).replace(/\.(tsx?|m?js|cjs)$/, '');
const targets = new Set(removedUi.map(normalized));
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : /\.(tsx?|m?js|cjs)$/.test(e.name) ? [path.join(dir,e.name)] : []); }

test('unused UI has no local imports/reexports/literal dynamic loads from retained app, server or scripts', () => {
  const incoming = [];
  for (const file of ['App.tsx','index.ts', ...['src','scripts','supabase','plugins'].flatMap(files)]) {
    if (targets.has(normalized(file))) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      const literal = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') ? node.arguments[0] : undefined;
      if (literal && ts.isStringLiteralLike(literal) && literal.text.startsWith('.')) {
        const target = normalized(path.resolve(path.dirname(file), literal.text));
        if (targets.has(target)) incoming.push(`${file} -> ${literal.text}`);
      }
      ts.forEachChild(node,visit);
    }
    visit(source);
  }
  assert.deepEqual(incoming, []);
});
for (const file of removedUi) test(`retired UI removed: ${file}`, () => assert.equal(fs.existsSync(file),false));

test('current notification permission/schedule/exact cancellation never reads or migrates retired IDs', async () => {
  const legacyKey = '@timefit/course-notification-ids';
  const values = new Map([[legacyKey, '["old-notification"]']]);
  const touched = [], scheduled = [], cancelled = [];
  let granted = false, permissionRequests = 0;
  const host = screenRuntime({
    __Date: class Clock extends Date { static now() { return 0; } },
    '@react-native-async-storage/async-storage': {
      async getItem(key) { touched.push(key); return values.get(key) ?? null; },
      async setItem(key, value) { touched.push(key); values.set(key,value); },
      async removeItem(key) { touched.push(key); values.delete(key); },
    },
    'expo-notifications': {
      SchedulableTriggerInputTypes: { DATE: 'date' },
      async getPermissionsAsync() { return { granted, status: granted ? 'granted' : 'undetermined' }; },
      async requestPermissionsAsync() { permissionRequests++; granted = true; return { granted }; },
      async setNotificationCategoryAsync() {},
      async scheduleNotificationAsync(value) { scheduled.push(value); return 'current-notification'; },
      async cancelScheduledNotificationAsync(id) { cancelled.push(id); },
    },
  });
  const module = host.load('src/ui/liveActivity/courseProgressNotifications.ts');
  await module.prepareLiveCourseNotifications(async () => true);
  await module.prepareLiveCourseNotifications(async () => { assert.fail('no second prompt'); });
  assert.equal(permissionRequests, 1);
  await module.liveCourseNotificationPort.sync({ courseRunId: 'current-run', revision: 1, phase: 'traveling', activeStopId: 'A', route: { targetTitle: 'Fixture', arrivalPromptAtMs: 1000, nextBoundaryAtMs: 2000 } });
  assert.equal(scheduled.length, 1);
  await module.liveCourseNotificationPort.cancelOwned('another-run');
  assert.deepEqual(cancelled, []);
  await module.liveCourseNotificationPort.cancelOwned('current-run');
  assert.deepEqual(cancelled, ['current-notification']);
  assert.equal(touched.includes(legacyKey), false);
  assert.equal(values.get(legacyKey), '["old-notification"]');
});
