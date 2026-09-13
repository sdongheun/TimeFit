import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

export const removedUi = [
  'src/ui/recommendation/CandidateList.tsx', 'src/ui/recommendation/CandidateDetail.tsx',
  'src/ui/recommendation/BasketPanel.tsx', 'src/ui/execution/CourseProgress.tsx',
  'src/ui/activity/ActivityDonut.tsx', 'src/ui/Chip.tsx',
  'src/ui/recommendation/TimeJourney.tsx', 'src/ui/recommendation/ExplorationPlaceCard.tsx',
  'src/ui/currentPlacePhoto.ts', ...['TransportGlyph.tsx','types.ts','candidateModel.ts','candidateEvaluation.ts','basketPlanner.ts','timeJourneyModel.ts','oneStop.ts','useRecommendationSheet.ts','sheetLayout.ts'].map(f => `src/ui/recommendation/${f}`),
];
const normalized = file => path.resolve(file).replace(/\.(tsx?|m?js|cjs)$/, '');
const targets = new Set(removedUi.map(normalized));
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : /\.(tsx?|m?js|cjs)$/.test(e.name) ? [path.join(dir,e.name)] : []); }

test('unused UI has no local imports/reexports/literal dynamic loads from retained app, server or scripts', () => {
  const incoming = [];
  for (const file of ['App.tsx','index.ts', ...['src','scripts','supabase'].flatMap(files)]) {
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
