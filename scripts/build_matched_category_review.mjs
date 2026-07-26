import fs from 'node:fs';

const INPUT = 'data/processed/부산_매칭장소.json';
const OUT_GROUPED = 'data/processed/review/부산_매칭장소_카테고리별.json';
const OUT_COMMERCIAL = 'data/processed/review/부산_매칭상업지구_검토.json';

const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const rows = data.data ?? [];

const COMMERCIAL_RULES = [
  { subCategory: '아울렛', pattern: /아울렛|프리미엄\s*아울렛/i, confidence: 'high' },
  { subCategory: '백화점/쇼핑몰', pattern: /백화점|쇼핑몰|몰\b|센텀시티|르네시떼|씨파크/i, confidence: 'high' },
  { subCategory: '지하상가', pattern: /지하도상가|지하상가/i, confidence: 'high' },
  { subCategory: '전문상가', pattern: /전자|가구|수산물|건어물|농산물|도매|종합시장/i, confidence: 'medium' },
  { subCategory: '전통시장', pattern: /시장|마켓타운|새벽시장|재래시장/i, confidence: 'high' },
  { subCategory: '거리/골목상권', pattern: /거리|골목|로데오|카페거리|먹자골목/i, confidence: 'high' },
  { subCategory: '개별상점', pattern: /공방|제작소|상점|수제|공예|가옥|이뻐|아래모래/i, confidence: 'low' },
];

function classifyCommercial(place) {
  const haystack = [
    place.title,
    place.addr1,
    place.aihubName,
    ...(place.aliases ?? []),
  ].filter(Boolean).join(' ');

  const hits = COMMERCIAL_RULES.filter((rule) => rule.pattern.test(haystack));
  if (!hits.length) {
    return {
      subCategory: '미분류',
      confidence: 'low',
      reviewStatus: 'REVIEW',
      reason: '키워드 자동 분류 실패',
    };
  }

  const selected = hits[0];
  const nameMismatch = place.matchType === 'coord' && place.aihubName && !isSimilarName(place.title, place.aihubName);
  const multiHit = new Set(hits.map((hit) => hit.subCategory)).size > 1;
  const lowSample = (place.dwell?.count ?? 0) < 5;
  const categoryMismatch = place.aihubCategory && !['상업지구', '상점'].includes(place.aihubCategory);

  const clearByTitle = selected.confidence === 'high' && selected.pattern.test(String(place.title ?? ''));
  const needsReview = clearByTitle
    ? !!categoryMismatch
    : selected.confidence !== 'high' || nameMismatch || multiHit || lowSample || categoryMismatch;
  const reasons = [];
  if (selected.confidence !== 'high') reasons.push(`자동분류 신뢰도 ${selected.confidence}`);
  if (nameMismatch) reasons.push(`TourAPI/AH 이름 불일치: ${place.title} vs ${place.aihubName}`);
  if (multiHit) reasons.push(`복수 후보: ${hits.map((hit) => hit.subCategory).join(', ')}`);
  if (lowSample) reasons.push(`AI-Hub 표본 적음 n=${place.dwell?.count ?? 0}`);
  if (categoryMismatch) reasons.push(`AI-Hub 카테고리 불일치: ${place.aihubCategory}`);

  return {
    subCategory: selected.subCategory,
    confidence: selected.confidence,
    reviewStatus: needsReview ? 'REVIEW' : 'PASS',
    reason: !needsReview && clearByTitle ? '명확한 장소명 키워드 분류' : reasons.join(' / ') || '명확한 키워드 분류',
    candidates: hits.map((hit) => hit.subCategory),
  };
}

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\[[^\]]*]|\([^)]*\)/g, '')
    .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function isSimilarName(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return !!na && !!nb && (na.includes(nb) || nb.includes(na));
}

function slim(place) {
  const extra = place.category === '상업지구' ? classifyCommercial(place) : {};
  return {
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    contentTypeId: place.contentTypeId,
    contentTypeName: place.contentTypeName,
    addr1: place.addr1,
    lat: place.lat,
    lon: place.lon,
    aihubName: place.aihubName,
    aihubCategory: place.aihubCategory,
    matchType: place.matchType,
    matchDistanceM: place.matchDistanceM,
    dwell: place.dwell,
    ...extra,
  };
}

const categories = {};
for (const place of rows) {
  categories[place.category] ??= [];
  categories[place.category].push(slim(place));
}

for (const list of Object.values(categories)) {
  list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));
}

const commercial = categories['상업지구'] ?? [];
const commercialSummary = commercial.reduce((acc, place) => {
  acc.bySubCategory[place.subCategory] = (acc.bySubCategory[place.subCategory] ?? 0) + 1;
  acc.byReviewStatus[place.reviewStatus] = (acc.byReviewStatus[place.reviewStatus] ?? 0) + 1;
  return acc;
}, { total: commercial.length, bySubCategory: {}, byReviewStatus: {} });

const grouped = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: INPUT,
    purpose: 'matched 장소를 카테고리별로 사람이 검토하기 쉽게 묶은 파일',
    note: '상업지구는 키워드 기반 세부 카테고리 후보와 REVIEW/PASS 상태를 함께 제공한다.',
  },
  summary: {
    total: rows.length,
    byCategory: Object.fromEntries(Object.entries(categories).map(([category, list]) => [category, list.length])),
  },
  categories,
};

const commercialReview = {
  meta: {
    generatedAt: grouped.meta.generatedAt,
    source: INPUT,
    purpose: '상업지구 matched 장소 세부 카테고리 검토용',
    reviewGuide: {
      PASS: '자동 분류를 그대로 써도 될 가능성이 높음',
      REVIEW: '사용자가 장소명을 보고 세부 카테고리 확정 필요',
    },
  },
  summary: commercialSummary,
  data: commercial,
  contentIds: commercial.map((place) => String(place.contentId)),
};

fs.writeFileSync(OUT_GROUPED, `${JSON.stringify(grouped, null, 2)}\n`);
fs.writeFileSync(OUT_COMMERCIAL, `${JSON.stringify(commercialReview, null, 2)}\n`);

console.log(JSON.stringify({
  grouped: OUT_GROUPED,
  commercial: OUT_COMMERCIAL,
  summary: grouped.summary,
  commercialSummary,
}, null, 2));
