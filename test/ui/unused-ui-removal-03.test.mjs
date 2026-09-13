import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

export const removedUi = [
  "src/ui/courseDateContext.ts",
  "src/ui/mapPinConfirmationModel.ts",
  "src/ui/placeSearchRanking.ts",
  "src/ui/placeSearchStateModel.ts",
  "src/ui/placeSearchSuggestionModel.ts",
  "src/ui/routeSetupModel.ts",
  "src/ui/tokens.ts",
  "src/ui/recommendation/MapControls.tsx",
  "src/ui/recommendation/courseV1DwellStateModel.ts",
  "src/ui/recommendation/courseV1ResultListModel.ts",
  "src/ui/recommendation/oneStopSearchScope.ts",
  "src/ui/recommendation/v1ResultState.ts",
  "src/ui/recommendation/verifiedCourseResultsModel.ts",
  "src/ui/dev/ConditionalPlacePreview.tsx",
  "src/ui/dev/conditionalPlacePreviewFixtures.ts",
  "src/ui/recommendation/ConditionalVisitSection.tsx",
  "src/ui/recommendation/CourseV1Journey.tsx",
  "src/ui/recommendation/CourseV1PlacePreview.tsx",
  "src/ui/recommendation/courseV1JourneyModel.ts"
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
