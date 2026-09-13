import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const removed = 'src/services/courseRepository.ts';
const symbols = /\bcourseRepository\b|\bsaveCourseToRepository\b|\breplaceCoursePlanInRepository\b|\blistSavedCoursesFromRepository\b|\bisCourseDateError\b|\bCourseDateError\b/;
function files(root) {
  if (!fs.existsSync(root)) return [];
  if (fs.statSync(root).isFile()) return [root];
  return fs.readdirSync(root).flatMap(name => files(path.join(root, name)));
}
test('unused course repository: no runtime import, reexport, dynamic path or symbol outside removal set', () => {
  const incoming = [];
  for (const file of ['App.tsx', 'index.ts', 'index.js', 'src', 'scripts', 'supabase', 'plugins'].flatMap(files)) {
    if (file === removed || !/\.(?:[cm]?[jt]sx?|json)$/.test(file)) continue;
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, fs.readFileSync(file, 'utf8'));
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if (symbols.test(scanner.getTokenText())) incoming.push(file);
    }
  }
  assert.deepEqual([...new Set(incoming)], []);
});
test('unused course repository: obsolete file absent, live storage services retained', () => {
  assert.equal(fs.existsSync(removed), false);
  for (const name of ['courseCompletionRepository', 'releaseIdentityPersonalizationRuntime', 'accountCourseCompletionRepository', 'guestCompletionImportRepository', 'dwellPersonalizationRepository']) {
    assert.equal(fs.existsSync(`src/services/${name}.ts`), true, name);
  }
});
