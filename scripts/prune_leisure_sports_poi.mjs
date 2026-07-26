import fs from 'node:fs';

const KEEP_IDS = new Set([
  '2991028', // 광안리 해양레포츠센터
  '2789488', // 미포정거장
  '2557807', // 송도 구름산책로
  '2381567', // 문탠로드
  '2755696', // 구포무장애숲길
  '2784356', // 송도해안볼레길
  '2708164', // 해안누리길 몰운대길
  '2663187', // 회동수원지 둘레길
  '3080317', // 부산광역시 부산실내빙상장
  '3080310', // 삼락강변체육공원인라인스케이트장
]);

const REASON_BY_KEYWORD = [
  [/요트|서핑|SUP|수상레포츠|해양레포츠|서프/i, '예약/장비/준비시간이 필요한 체험형 레저'],
  [/카라반|캠핑|야영|글램핑|캠프/i, '캠핑/숙박형 활동으로 자투리 시간 목적과 맞지 않음'],
  [/골프|컨트리클럽/i, '장시간 예약형 활동'],
  [/사격장/i, '목적형 체험시설로 범용 자투리 추천과 맞지 않음'],
  [/교육원|수련관/i, '교육/수련 시설로 일반 추천 장소와 맞지 않음'],
  [/바다낚시|낚시/i, '장시간 체험형 활동'],
];

const files = [
  'data/processed/부산_매칭장소.json',
  'data/processed/부산_미매칭_TourAPI장소.json',
  'src/data/busan_poi_catalog.json',
];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function isLeisure(place) {
  return place.category === '레저/스포츠' || String(place.contentTypeId) === '28';
}

function shouldExclude(place) {
  return isLeisure(place) && !KEEP_IDS.has(String(place.contentId));
}

function reasonFor(place) {
  const title = String(place.title ?? '');
  if (place.matchType === 'coord' && place.aihubName && !similar(title, place.aihubName)) {
    return `좌표 기반 매칭 의심: AI-Hub=${place.aihubName}`;
  }
  for (const [pattern, reason] of REASON_BY_KEYWORD) {
    if (pattern.test(title)) return reason;
  }
  return '자투리 시간 추천 우선순위에서 제외한 레저/스포츠';
}

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\[[^\]]*]|\([^)]*\)/g, '')
    .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function similar(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return !!na && !!nb && (na.includes(nb) || nb.includes(na));
}

function rebuildByContentId(section) {
  section.byContentId = Object.fromEntries(section.data.map((place) => [String(place.contentId), place]));
}

function countByType(data, type) {
  return data.filter((place) => String(place.contentTypeId) === String(type)).length;
}

function updateProcessedMatched(json) {
  json.summary.tourCandidates = json.data.length + unmatched.data.length;
  json.summary.matched = json.data.length;
  if (json.summary.byType?.['28']) {
    json.summary.byType['28'].total = KEEP_IDS.size;
    json.summary.byType['28'].matched = countByType(json.data, 28);
    json.summary.byType['28'].rate = round1((json.summary.byType['28'].matched / Math.max(1, json.summary.byType['28'].total)) * 100);
  }
}

function updateProcessedUnmatched(json, matchedCount) {
  json.summary.tourCandidates = matchedCount + json.data.length;
  json.summary.matched = matchedCount;
  json.summary.unmatched = json.data.length;
  if (json.summary.byType?.['28']) {
    json.summary.byType['28'].total = KEEP_IDS.size;
    json.summary.byType['28'].matched = matchedCountForType28;
    json.summary.byType['28'].unmatched = countByType(json.data, 28);
    json.summary.byType['28'].rate = round1((json.summary.byType['28'].matched / Math.max(1, json.summary.byType['28'].total)) * 100);
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
  if (catalog.matched.summary.byType?.['28']) {
    catalog.matched.summary.byType['28'].total = KEEP_IDS.size;
    catalog.matched.summary.byType['28'].matched = countByType(catalog.matched.data, 28);
    catalog.matched.summary.byType['28'].rate = round1((catalog.matched.summary.byType['28'].matched / KEEP_IDS.size) * 100);
  }
  if (catalog.unmatched.summary.byType?.['28']) {
    catalog.unmatched.summary.byType['28'].total = KEEP_IDS.size;
    catalog.unmatched.summary.byType['28'].matched = countByType(catalog.matched.data, 28);
    catalog.unmatched.summary.byType['28'].unmatched = countByType(catalog.unmatched.data, 28);
    catalog.unmatched.summary.byType['28'].rate = round1((catalog.unmatched.summary.byType['28'].matched / KEEP_IDS.size) * 100);
  }
}

function categoryCounts(data) {
  return data.reduce((acc, place) => {
    acc[place.category] = (acc[place.category] ?? 0) + 1;
    return acc;
  }, {});
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

const removed = [];
let matchedCountForType28 = 0;

const matched = readJson('data/processed/부산_매칭장소.json');
const unmatched = readJson('data/processed/부산_미매칭_TourAPI장소.json');
const catalog = readJson('src/data/busan_poi_catalog.json');

for (const file of ['data/processed/부산_매칭장소.json', 'data/processed/부산_미매칭_TourAPI장소.json']) {
  const json = file.includes('matched_poi') ? matched : unmatched;
  const kept = [];
  for (const place of json.data) {
    if (shouldExclude(place)) {
      removed.push({ ...place, sourceFile: file, excludeReason: reasonFor(place) });
    } else {
      kept.push(place);
    }
  }
  json.data = kept;
  rebuildByContentId(json);
}

catalog.matched.data = catalog.matched.data.filter((place) => !shouldExclude(place));
catalog.unmatched.data = catalog.unmatched.data.filter((place) => !shouldExclude(place));

matchedCountForType28 = countByType(matched.data, 28);
updateProcessedMatched(matched);
updateProcessedUnmatched(unmatched, matched.data.length);
updateCatalogSummary(catalog);

const excluded = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: files,
    category: '레저/스포츠',
    policy: '자투리 시간에 바로 들르기 쉬운 산책/짧은 체험형 장소만 유지하고, 예약/장비/장시간/저신뢰 매칭 장소는 추천 카탈로그에서 제외',
    keptContentIds: [...KEEP_IDS],
  },
  summary: {
    excluded: removed.length,
    bySourceFile: removed.reduce((acc, place) => {
      acc[place.sourceFile] = (acc[place.sourceFile] ?? 0) + 1;
      return acc;
    }, {}),
  },
  data: removed.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko')),
  byContentId: Object.fromEntries(removed.map((place) => [String(place.contentId), place])),
};

writeJson('data/processed/부산_제외_레저스포츠.json', excluded);
writeJson('data/processed/부산_매칭장소.json', matched);
writeJson('data/processed/부산_미매칭_TourAPI장소.json', unmatched);
writeJson('src/data/busan_poi_catalog.json', catalog);

console.log(JSON.stringify({
  excluded: excluded.summary,
  processedMatched: matched.data.length,
  processedUnmatched: unmatched.data.length,
  catalogMatched: catalog.matched.data.length,
  catalogUnmatched: catalog.unmatched.data.length,
  catalogLeisure: {
    matched: countByType(catalog.matched.data, 28),
    unmatched: countByType(catalog.unmatched.data, 28),
  },
}, null, 2));
