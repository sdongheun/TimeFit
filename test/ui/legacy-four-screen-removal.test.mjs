import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// B preparation: intentionally red until C removes the authorized execution edges.
// AST checks inspect the real files, not a fabricated router registration list.
const parse = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const collect = (root, predicate) => {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
  visit(root); return found;
};
const retiredRoutes = new Set(['LegacyResults', 'MyCourses', 'Execution', 'Feedback']);
const retiredScreens = ['OneStopResultsScreen', 'MyCoursesScreen', 'ExecutionScreen', 'FeedbackScreen'];

test('LEGACY-REMOVE-01 actual App has no retired screen imports', () => {
  const imports = collect(parse('App.tsx'), ts.isImportDeclaration).map(n => n.moduleSpecifier.text);
  assert.deepEqual(imports.filter(path => retiredScreens.some(name => path === `./src/ui/${name}`)), []);
});
test('LEGACY-REMOVE-02 actual App has no retired Stack.Screen registrations/header', () => {
  const root = parse('App.tsx');
  const names = collect(root, n => (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(root) === 'Stack.Screen')
    .flatMap(n => n.attributes.properties.filter(a => ts.isJsxAttribute(a) && a.name.getText(root) === 'name').map(a => a.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : '<dynamic>'));
  assert.ok(names.includes('CourseConfirm') && names.includes('Results'), 'current registrations must remain');
  assert.deepEqual(names.filter(name => retiredRoutes.has(name) || name === '<dynamic>'), []);
});
test('LEGACY-REMOVE-03 retired reset helpers and four exclusive screen files are absent', () => {
  const root = parse('src/ui/mainTabNavigation.ts');
  const helpers = collect(root, ts.isFunctionDeclaration).map(n => n.name?.text);
  const remaining = retiredScreens.filter(name => fs.existsSync(`src/ui/${name}.tsx`));
  assert.deepEqual({ helpers: helpers.filter(n => ['resetToBasket', 'resetToMyCourses'].includes(n)), files: remaining }, { helpers: [], files: [] });
});
test('LEGACY-REMOVE-04 Home/projection no longer consumes legacy activeCourse or returns Execution', () => {
  const findings = [];
  for (const file of ['src/ui/HomeScreen.tsx', 'src/ui/activeVerifiedCourseModel.ts']) {
    const root = parse(file);
    for (const node of collect(root, n => ts.isIdentifier(n) && n.text === 'activeCourse' || ts.isStringLiteral(n) && ['legacy', 'Execution'].includes(n.text))) findings.push(`${file}:${node.getText(root)}`);
  }
  assert.deepEqual(findings, []);
});
test('LEGACY-REMOVE-05 AppFlow removes legacy repository imports/state/actions only', () => {
  const root = parse('src/ui/AppFlowContext.tsx');
  const retired = new Set(['activeCourse', 'setActiveCourse', 'setActiveCourseState', 'savedCourses', 'setSavedCourses', 'savedCoursesScope', 'setSavedCoursesScope', 'refreshSavedCourses', 'saveCourse', 'replaceCourse', 'removeSavedCourse']);
  const identifiers = collect(root, ts.isIdentifier).map(n => n.text);
  const imports = collect(root, ts.isImportDeclaration).map(n => n.moduleSpecifier.text).filter(s => s.endsWith('/courseRepository'));
  assert.ok(identifiers.includes('activeVerifiedCourse') && identifiers.includes('latestResults'), 'current state must remain');
  assert.deepEqual({ identifiers: [...new Set(identifiers.filter(n => retired.has(n)))].sort(), imports }, { identifiers: [], imports: [] });
});
