#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  buildOfficialDetailDescriptionPlan,
  detailDescriptionFromRaw,
} from './build_place_detail_description.mjs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const SOURCE_CATALOG = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const BASELINE = 'data/processed/review/장소상세_공식설명_기준선.json';
const OUTPUT = 'data/processed/review/장소상세_공식설명_감사.json';
const OFFICIAL_SOURCES = {
  busan_attraction: 'data/processed/부산시_명소정보.json',
  busan_shopping: 'data/processed/부산시_쇼핑정보.json',
  busan_food: 'data/processed/부산시_맛집정보.json',
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const rowsOf = (payload) => Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
const catalogRows = (catalog) => [...catalog.matched.data, ...catalog.unmatched.data];
const isRepresentative = (place) => ['representative_core', 'representative_standard'].includes(place.classification);
const present = (value) => Array.isArray(value) ? value.length > 0
  : typeof value === 'string' ? value.trim().length > 0 : value != null;

function metrics(rows) {
  return Object.fromEntries(['category', 'subCategory', 'addr1', 'operatingHours', 'imageUrl', 'mapVerification', 'detailDescription'].map((field) => {
    const count = rows.filter((row) => present(row[field])).length;
    return [field, { present: count, missing: rows.length - count, rate: Number((count / rows.length * 100).toFixed(1)) }];
  }));
}

function semanticCatalog(catalog) {
  const strip = (place) => Object.fromEntries(Object.entries(place).filter(([key]) => key !== 'detailDescription'));
  return {
    meta: Object.fromEntries(Object.entries(catalog.meta).filter(([key]) => key !== 'generatedAt')),
    summary: catalog.summary,
    matched: { summary: catalog.matched.summary, data: catalog.matched.data.map(strip), byContentId: Object.fromEntries(Object.entries(catalog.matched.byContentId).map(([id, place]) => [id, strip(place)])) },
    unmatched: { summary: catalog.unmatched.summary, data: catalog.unmatched.data.map(strip), byContentId: Object.fromEntries(Object.entries(catalog.unmatched.byContentId).map(([id, place]) => [id, strip(place)])) },
    categoryDwell: catalog.categoryDwell,
  };
}

const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function officialMaps() {
  return Object.fromEntries(Object.entries(OFFICIAL_SOURCES).map(([source, file]) => [
    source,
    new Map(rowsOf(read(file)).map((row) => [String(row.UC_SEQ), row])),
  ]));
}

function assertNormalizationFixtures() {
  assert.equal(detailDescriptionFromRaw('  <p>첫 문장입니다.\n  다음 내용</p><p>둘째 문단</p>  '), '첫 문장입니다. 다음 내용');
  const complete = detailDescriptionFromRaw(`${'가'.repeat(100)}. ${'나'.repeat(180)}`);
  assert.equal(complete, `${'가'.repeat(100)}.`);
  const noSentence = detailDescriptionFromRaw('😀'.repeat(260));
  assert.equal(Array.from(noSentence).length, 240);
  assert.ok(noSentence.endsWith('…'));
  assert.equal(detailDescriptionFromRaw('\u0000 <br>  '), '');
  assert.equal(detailDescriptionFromRaw('&lt;b&gt;안내&lt;/b&gt;'), '안내');
  assert.equal(detailDescriptionFromRaw('같은 입력\n\n둘째'), detailDescriptionFromRaw('같은 입력\n\n둘째'));
}

assertNormalizationFixtures();

const catalog = read(CATALOG);
const rows = catalogRows(catalog);
const representatives = rows.filter(isRepresentative);
const sourcePlaces = read(SOURCE_CATALOG).data.filter((place) => ['representative_core', 'representative_standard', 'conditional_more'].includes(place.classification));
const plan = buildOfficialDetailDescriptionPlan(sourcePlaces, officialMaps());
const baselineValue = {
  sourceCatalogGeneratedAt: catalog.meta.generatedAt,
  total: rows.length,
  representative: representatives.length,
  protectedSemanticSha256: hash(semanticCatalog(catalog)),
  all: metrics(rows),
  representatives: metrics(representatives),
};

if (process.argv.includes('--write-baseline')) {
  if (fs.existsSync(BASELINE)) throw new Error(`${BASELINE} already exists`);
  write(BASELINE, baselineValue);
  console.log(`장소 상세 기준선 기록: ${BASELINE}`);
}

const baseline = read(BASELINE);
assert.equal(rows.length, baseline.total);
assert.equal(representatives.length, baseline.representative);
assert.equal(hash(semanticCatalog(catalog)), baseline.protectedSemanticSha256, 'detailDescription 외 카탈로그 계약이 변경됨');

for (const place of rows) {
  const expected = plan.descriptions.get(place.contentId)?.detailDescription;
  assert.equal(place.detailDescription, expected, `${place.contentId}: 공식 설명 snapshot 불일치`);
  if (place.detailDescription) {
    assert.ok(Array.from(place.detailDescription).length <= 240, `${place.contentId}: 240 code point 초과`);
    assert.doesNotMatch(place.detailDescription, /<[^>]*>|[\u0000-\u001f\u007f-\u009f]/u, `${place.contentId}: HTML/제어문자 잔존`);
  }
}

const current = { all: metrics(rows), representatives: metrics(representatives) };
const described = rows.filter((place) => present(place.detailDescription));
const describedRepresentatives = described.filter(isRepresentative);
const byOfficialSource = described.reduce((counts, place) => {
  const sourceName = plan.descriptions.get(place.contentId)?.source ?? 'unknown';
  counts[sourceName] = (counts[sourceName] ?? 0) + 1;
  return counts;
}, {});
const audit = {
  meta: {
    sourceCatalog: SOURCE_CATALOG,
    runtimeCatalog: CATALOG,
    officialSources: OFFICIAL_SOURCES,
    policy: 'sourceEvidence source+sourceId exact UC_SEQ only; first meaningful paragraph; max 240 Unicode code points; duplicate description omitted',
  },
  baseline,
  result: {
    total: rows.length,
    representative: representatives.length,
    exactOfficialCandidates: plan.candidateCount,
    duplicateDescriptionGroupsOmitted: plan.duplicateDescriptionCount,
    duplicatePlacesOmitted: plan.duplicatePlaceCount,
    descriptions: described.length,
    representativeDescriptions: describedRepresentatives.length,
    fallbackNoDescription: rows.length - described.length,
    representativeFallbackNoDescription: representatives.length - describedRepresentatives.length,
    byOfficialSource,
    maxDescriptionCodePoints: Math.max(0, ...described.map((place) => Array.from(place.detailDescription).length)),
    current,
  },
};
write(OUTPUT, audit);
console.log(`장소 상세 공식 설명 감사: ${described.length}/${rows.length}, 대표 ${describedRepresentatives.length}/${representatives.length}, fallback ${rows.length - described.length}`);
