import fs from 'node:fs';

const REVIEW = 'data/processed/review/부산_매칭상업지구_검토.json';
const MATCHED = 'data/processed/부산_매칭장소.json';
const CATALOG = 'src/data/busan_poi_catalog.json';
const EXCLUDED = 'data/processed/부산_제외_상업지구검토.json';

const VALID_SELECT = new Set([
  '전통시장',
  '거리/골목상권',
  '백화점/쇼핑몰',
  '아울렛',
  '지하상가',
  '전문상가',
  '개별상점',
  '폐기',
]);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function rebuildByContentId(section) {
  section.byContentId = Object.fromEntries(section.data.map((place) => [String(place.contentId), place]));
}

function countByType(data, type) {
  return data.filter((place) => String(place.contentTypeId) === String(type)).length;
}

function categoryCounts(data) {
  return data.reduce((acc, place) => {
    acc[place.category] = (acc[place.category] ?? 0) + 1;
    return acc;
  }, {});
}

function updateMatchedSummary(json, catalog) {
  json.summary.tourCandidates = catalog.matched.data.length + catalog.unmatched.data.length;
  json.summary.matched = json.data.length;
  if (json.summary.byType?.['38']) {
    json.summary.byType['38'].total = countByType(catalog.matched.data, 38) + countByType(catalog.unmatched.data, 38);
    json.summary.byType['38'].matched = countByType(json.data, 38);
    json.summary.byType['38'].rate = round1((json.summary.byType['38'].matched / Math.max(1, json.summary.byType['38'].total)) * 100);
  }
}

function updateCatalogSummary(catalog) {
  rebuildByContentId(catalog.matched);
  rebuildByContentId(catalog.unmatched);
  catalog.summary.matched = catalog.matched.data.length;
  catalog.summary.unmatched = catalog.unmatched.data.length;
  catalog.summary.categories = categoryCounts([...catalog.matched.data, ...catalog.unmatched.data]);
  catalog.matched.summary.matched = catalog.matched.data.length;
  catalog.unmatched.summary.matched = catalog.matched.data.length;
  catalog.unmatched.summary.unmatched = catalog.unmatched.data.length;
  if (catalog.matched.summary.byType?.['38']) {
    catalog.matched.summary.byType['38'].total = countByType(catalog.matched.data, 38) + countByType(catalog.unmatched.data, 38);
    catalog.matched.summary.byType['38'].matched = countByType(catalog.matched.data, 38);
    catalog.matched.summary.byType['38'].rate = round1((catalog.matched.summary.byType['38'].matched / Math.max(1, catalog.matched.summary.byType['38'].total)) * 100);
  }
  if (catalog.unmatched.summary.byType?.['38']) {
    catalog.unmatched.summary.byType['38'].total = countByType(catalog.matched.data, 38) + countByType(catalog.unmatched.data, 38);
    catalog.unmatched.summary.byType['38'].matched = countByType(catalog.matched.data, 38);
    catalog.unmatched.summary.byType['38'].unmatched = countByType(catalog.unmatched.data, 38);
    catalog.unmatched.summary.byType['38'].rate = round1((catalog.unmatched.summary.byType['38'].matched / Math.max(1, catalog.unmatched.summary.byType['38'].total)) * 100);
  }
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

const review = readJson(REVIEW);
const matched = readJson(MATCHED);
const catalog = readJson(CATALOG);

const selections = new Map();
for (const place of review.data ?? []) {
  if (!place.select) continue;
  if (!VALID_SELECT.has(place.select)) {
    throw new Error(`Unknown select "${place.select}" for ${place.title}`);
  }
  selections.set(String(place.contentId), place.select);
}

const decisions = new Map();
for (const place of review.data ?? []) {
  const selected = selections.get(String(place.contentId));
  if (selected) {
    decisions.set(String(place.contentId), selected);
  } else if (place.reviewStatus === 'PASS' && place.subCategory) {
    decisions.set(String(place.contentId), place.subCategory);
  }
}

const excluded = new Map();
for (const place of review.data ?? []) {
  const select = decisions.get(String(place.contentId));
  if (!select) continue;
  if (selections.has(String(place.contentId))) place.reviewStatus = 'APPLIED';
  place.appliedSubCategory = select;
  if (select !== '폐기') {
    place.subCategory = select;
    place.reason = `사용자 검토 반영: ${select}`;
  } else {
    place.reason = '사용자 검토 반영: 추천 카탈로그에서 제외';
  }
}

function applyToList(list, sourceName) {
  const out = [];
  for (const place of list) {
    const select = decisions.get(String(place.contentId));
    if (select === '폐기') {
      excluded.set(String(place.contentId), { ...place, sourceName, excludeReason: '사용자 상업지구 검토에서 폐기 선택' });
      continue;
    }
    if (select) {
      out.push({ ...place, subCategory: select, subCategorySource: 'manual_commercial_review' });
    } else {
      out.push(place);
    }
  }
  return out;
}

matched.data = applyToList(matched.data, MATCHED);
catalog.matched.data = applyToList(catalog.matched.data, CATALOG);

for (const place of review.data ?? []) {
  if (decisions.get(String(place.contentId)) === '폐기') {
    excluded.set(String(place.contentId), { ...place, sourceName: REVIEW, excludeReason: '사용자 상업지구 검토에서 폐기 선택' });
  }
}

rebuildByContentId(matched);
updateCatalogSummary(catalog);
updateMatchedSummary(matched, catalog);

const appliedSummary = review.data.reduce((acc, place) => {
  const key = place.reviewStatus;
  acc.byReviewStatus[key] = (acc.byReviewStatus[key] ?? 0) + 1;
  if (place.subCategory) acc.bySubCategory[place.subCategory] = (acc.bySubCategory[place.subCategory] ?? 0) + 1;
  return acc;
}, { total: review.data.length, bySubCategory: {}, byReviewStatus: {} });
review.summary = appliedSummary;

const excludedFile = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: [REVIEW, MATCHED, CATALOG],
    purpose: '상업지구 검토에서 폐기 선택된 matched 장소 보관',
  },
  summary: {
    excluded: excluded.size,
  },
  data: [...excluded.values()],
  byContentId: Object.fromEntries([...excluded.values()].map((place) => [String(place.contentId), place])),
};

writeJson(REVIEW, review);
writeJson(MATCHED, matched);
writeJson(CATALOG, catalog);
writeJson(EXCLUDED, excludedFile);

console.log(JSON.stringify({
  selections: selections.size,
  decisions: decisions.size,
  excluded: excluded.size,
  matched: matched.data.length,
  catalogMatched: catalog.matched.data.length,
  catalogCommercialMatched: countByType(catalog.matched.data, 38),
  reviewSummary: review.summary,
}, null, 2));
