#!/usr/bin/env node
// 보류 발견장소 140개를 이미 보존한 공식 부산관광 원문으로 다시 판정한다.
// 이 스크립트는 외부 호출을 하지 않는다. 원문이 없는 TourAPI 항목은 근거 부재를 결과에 남긴다.
import fs from 'node:fs';

const PROFILE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const QUEUE = 'data/processed/review/활동근거_재검토큐.json';
const OUTPUT = 'data/processed/review/보류_발견장소_재검토_결과.json';
const SOURCES = [
  ['busan_attraction', 'data/processed/부산시_명소정보.json'],
  ['busan_shopping', 'data/processed/부산시_쇼핑정보.json'],
];

// 원문에 활동 단위와 시간 범위가 함께 있고, 넓은 권역·예약·프로그램 의존이 아닌 경우만 승격했다.
const STANDARD = new Set([
  'poi_187', 'poi_237', 'poi_245', 'poi_614', 'poi_619', 'poi_636', 'poi_650', 'poi_694',
  'poi_705', 'poi_744', 'poi_746', 'poi_751', 'poi_759', 'poi_761', 'poi_78', 'poi_783',
  'poi_785', 'poi_817', 'poi_819', 'poi_821', 'poi_822', 'poi_823', 'poi_824', 'poi_94',
]);
// 활동은 확인됐지만 운영 가능 시간의 적용 범위를 구조화할 수 없는 야외 짧은 구간이다.
const CONDITIONAL = new Set(['poi_177', 'poi_722']);

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const clean = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const profileById = new Map(read(PROFILE).data.map((row) => [row.id, row]));
const queue = read(QUEUE).data;
const officialByKey = new Map();
for (const [source, file] of SOURCES) {
  const payload = read(file); const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
  for (const row of rows) officialByKey.set(`${source}:${row.UC_SEQ}`, { source, row });
}

function official(place) {
  for (const item of place.sourceEvidence ?? []) {
    const found = officialByKey.get(`${item.source}:${item.sourceId}`);
    if (found) return { ...found, sourceId: String(item.sourceId) };
  }
  return null;
}
function template(place) {
  const type = place.category === '문화시설' ? 'compact_culture' : place.category === '상업지구' ? 'quick_browse' : 'scenic_pause';
  return { type, source: 'AI-Hub 활동 유형 체류 템플릿', sourceIdOrUrl: `activity_template:${type}`, sourceText: `${type} 검토 템플릿: 최소 20분, 권장 30분, 최대 ${type === 'compact_culture' ? 120 : 60}분`, retrievedAt: '2026-08-24', appliesTo: 'place' };
}
function holdReason(place, source) {
  if (!source) return '보존된 원천에는 장소 ID·좌표만 있고 공식 소개 원문과 운영 범위가 없어 활동·짧은 방문을 판정할 수 없다.';
  if (/예약|프로그램|공연|체험/.test(clean(source.row.ITEMCNTNTS))) return '공식 원문이 예약·회차·프로그램 의존 또는 장기 체험을 보여 주어 20~60분 독립 방문으로 안전하게 한정할 수 없다.';
  if (/가게별 상이|상시$|홈페이지 참조/.test(clean(source.row.USAGE_DAY_WEEK_AND_TIME))) return '공식 원문은 일부 활동을 설명하지만 운영 가능 시간 또는 넓은 장소의 짧은 방문 구간을 구조화하지 못한다.';
  return '공식 원문만으로는 입구·전망점·짧은 산책 구간 또는 독립된 20~60분 방문 단위를 특정할 수 없다.';
}

const data = queue.map(({ placeId }) => {
  const place = profileById.get(placeId); if (!place) throw new Error(`profile missing ${placeId}`);
  const found = official(place); const item = found?.row;
  const outcome = STANDARD.has(placeId) ? 'representative_standard' : CONDITIONAL.has(placeId) ? 'conditional_more' : 'hold';
  if (outcome !== 'hold' && !item) throw new Error(`${placeId}: promotion requires retained official text`);
  const activity = item ? {
    source: found.source, sourceIdOrUrl: found.sourceId, sourceText: clean(item.ITEMCNTNTS), retrievedAt: '2026-08-24', appliesTo: place.placeKind === 'area' ? 'area' : 'place',
  } : null;
  const availability = item ? {
    source: found.source, sourceIdOrUrl: found.sourceId, sourceText: clean(item.USAGE_DAY_WEEK_AND_TIME), retrievedAt: '2026-08-24', appliesTo: place.placeKind === 'area' ? 'area' : 'place',
  } : null;
  const stayTemplate = template(place);
  const scope = outcome === 'hold'
    ? '공식 원문만으로 짧은 방문 범위를 특정하지 않음'
    : place.placeKind === 'area' ? '공식 소개가 가리키는 대표 권역의 산책·벽화·거리 감상 범위' : '공식 소개가 가리키는 독립 시설 또는 소품·전시 관람 범위';
  return {
    placeId, title: place.title, category: place.category, previousClassification: 'hold', outcome,
    sourceReviewStatus: item ? 'retained_busan_official_text_reviewed' : 'official_text_not_retained_no_external_query',
    officialEvidence: item ? { activity, stayTemplate, availability } : { activity: null, stayTemplate, availability: null },
    activityReview: { description: outcome === 'hold' ? '활동·짧은 방문을 확정하지 않음' : `${stayTemplate.type} 활동으로 20~60분 범위를 적용`, activityType: outcome === 'hold' ? null : stayTemplate.type },
    scopeReview: { placeKind: place.placeKind, reason: scope },
    accessReview: { value: outcome === 'hold' ? 'unknown' : 'open', reason: outcome === 'hold' ? '승격 근거로 사용하지 않음' : '공식 관광 소개의 공개 관람·산책·소품 탐색 설명에 한정' },
    decisionReason: outcome === 'representative_standard'
      ? '보존된 부산시 공식 소개가 독립된 관람·산책·전시·소품 탐색 활동을 설명하고, 공식 시간 범위가 있어 activity template 기반 대표 후보로 재분류한다.'
      : outcome === 'conditional_more'
        ? '보존된 부산시 공식 소개는 짧은 산책 활동을 설명하지만 운영 시간의 적용 범위를 구조화하지 못해 더보기 전용으로 둔다.'
        : holdReason(place, found),
    reviewDueAt: outcome === 'conditional_more' ? '2026-11-21' : outcome === 'representative_standard' ? '2026-11-21' : '2026-11-21',
    nextReviewAction: outcome === 'hold' ? '공식 관리 주체 원문에서 입구·짧은 구간·운영 또는 예약 범위를 확인한 뒤 다시 판정한다.' : null,
  };
}).sort((a, b) => a.placeId.localeCompare(b.placeId, 'en'));

const summary = Object.fromEntries(['representative_standard', 'conditional_more', 'hold'].map((key) => [key, data.filter((row) => row.outcome === key).length]));
fs.writeFileSync(OUTPUT, `${JSON.stringify({ meta: { generatedAt: '2026-08-24', source: [PROFILE, QUEUE, ...SOURCES.map(([, file]) => file)], externalRequests: 0, policy: '보존된 공식 원문이 없는 장소는 근거 없이 승격하지 않는다.' }, summary: { total: data.length, ...summary }, data }, null, 2)}\n`);
console.log(`보류 발견장소 재검토: ${data.length}개 ${JSON.stringify(summary)} -> ${OUTPUT}`);
