import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = path => readFileSync(new URL(`../../src/ui/${path}`, import.meta.url), 'utf8');
function identifiers(path) {
  const names = new Set();
  const tree = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return names;
}

test('UNUSED-SYMBOLS: retired navigation declarations are absent; active routes and Appointment remain', () => {
  const names = identifiers('nav.ts');
  for (const name of ['LegacyResults', 'MyCourses', 'Execution', 'Feedback', 'modeIcon', 'PlanCtx', 'deviceLocationSnapshot']) assert.equal(names.has(name), false, name);
  for (const name of ['Appointment', 'RecommendationSession', 'CourseConfirm', 'Results', 'fmtHM']) assert.equal(names.has(name), true, name);
});

test('UNUSED-SYMBOLS: Kakao target is independent of retired execution schedule', () => {
  const names = identifiers('execution/schedule.ts');
  for (const name of ['ExecutionScheduleInput', 'ExecutionSchedule', 'ExecutionStop', 'buildExecutionSchedule', 'currentMinuteOfDay', 'PlanCtx']) assert.equal(names.has(name), false, name);
  assert.match(source('execution/schedule.ts'), /KakaoRouteTarget\s*=\s*\{\s*name:\s*string;\s*point:\s*LatLon\s*\}/);
  for (const name of ['kakaoRouteUrl', 'kakaoWebFallback', 'openKakaoRouteWithFallback']) assert.equal(names.has(name), true);
});

test('UNUSED-SYMBOLS: retired recommendation wrappers removed without removing shared continuation', () => {
  const names = identifiers('recommendation/v1Session.ts');
  for (const name of ['buildRecommendationExplorationPage', 'verifyRecommendationExplorationPlace', 'explorationSelectionMessage', 'explorationUnavailable', 'continueRecommendationSession', 'requestConditionalManualCourse', 'ConditionalManualUiResult', 'buildConditionalManual']) assert.equal(names.has(name), false, name);
  for (const name of ['continuationInputs', 'runRecommendationSession', 'continueReleaseRecommendationSession', 'sessionRuntimes', 'runSessionOperation']) assert.equal(names.has(name), true, name);
});
