#!/usr/bin/env node
// 시장·거리·골목·문화마을을 실제 운영시간과 권역 추천 가능 시간대로 분리한다.
import fs from 'node:fs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const AVAILABLE_OUTPUT = 'data/processed/권역형장소_추천시간대.json';
const REVIEW_OUTPUT = 'data/processed/review/권역형장소_운영시간근거_검토.json';
const AREA_TYPES = new Set(['시장', '거리·골목', '문화마을']);

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const places = [...catalog.matched.data, ...catalog.unmatched.data]
  .filter((place) => AREA_TYPES.has(place.subCategory));

function sourceSummary(place) {
  return (place.sourceEvidence ?? []).map((source) => ({
    provider: source.source,
    sourceId: source.sourceId,
  }));
}

function classify(place) {
  const rawHours = (place.operatingHours ?? []).join(' ').trim();
  const hasClock = /\d{1,2}:\d{2}/.test(rawHours);
  const ambiguous = /가게별\s*상이|프로그램별\s*상이/.test(rawHours);
  const isIndividualBusiness = ['식당', '카페'].includes(place.category);
  if (isIndividualBusiness) return '개별시설_권역정책제외';
  if (hasClock && !ambiguous) return '공식시간_추천가능시간대초안';
  if (rawHours) return '시간문구_대표안내추가확인';
  return '운영시간미기재_공식근거탐색';
}

function priority(place, status) {
  if (status === '공식시간_추천가능시간대초안') return '즉시적용검토';
  if (place.sourceEvidence?.some((source) => source.source === 'busan_attraction' || source.source === 'busan_shopping')) return '1순위';
  if (place.category === '상업지구') return '1순위';
  return '2순위';
}

const rows = places.map((place) => {
  const status = classify(place);
  return {
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    subCategory: place.subCategory,
    address: place.addr1,
    currentOperatingHours: place.operatingHours ?? [],
    currentHolidays: place.holidays ?? [],
    sourceEvidence: sourceSummary(place),
    kakaoPlaceUrl: place.mapVerification?.placeUrl ?? null,
    status,
    priority: priority(place, status),
    requiredEvidence: status === '공식시간_추천가능시간대초안'
      ? '원본 공식 API의 시간 문구를 재확인한 뒤 추천 게이트에 반영'
      : status === '개별시설_권역정책제외'
        ? '개별 시설 운영시간 정책으로 처리'
        : '부산시 관광·구청·상인회·대표 안내시설의 공식 페이지 또는 TourAPI 상세 정보',
    availability: status === '공식시간_추천가능시간대초안'
      ? { status: 'candidate', raw: place.operatingHours, source: 'current_official_dataset' }
      : null,
  };
}).sort((a, b) => a.status.localeCompare(b.status, 'ko') || a.title.localeCompare(b.title, 'ko'));

function countBy(values, select) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    const key = select(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort((a, b) => b[1] - a[1]));
}

const candidate = rows.filter((row) => row.status === '공식시간_추천가능시간대초안');
const meta = {
  generatedAt: new Date().toISOString(),
  sourceCatalog: CATALOG,
  purpose: '시장·거리·골목·문화마을의 핵심 경험이 가능한 시간대를 공식 근거로만 관리하기 위한 자료',
  rule: '가게별 상이·상시·시간 미기재는 자동 추천 게이트의 통과 근거가 아니다. 개별 식당·카페는 권역형 장소가 아니라 개별 시설 운영시간 정책으로 처리한다.',
};

fs.writeFileSync(AVAILABLE_OUTPUT, `${JSON.stringify({
  meta,
  summary: { total: candidate.length, bySubCategory: countBy(candidate, (row) => row.subCategory) },
  data: candidate,
}, null, 2)}\n`);
fs.mkdirSync('data/processed/review', { recursive: true });
fs.writeFileSync(REVIEW_OUTPUT, `${JSON.stringify({
  meta,
  summary: { total: rows.length, byStatus: countBy(rows, (row) => row.status), byPriority: countBy(rows, (row) => row.priority) },
  data: rows,
}, null, 2)}\n`);

console.log(`권역형 장소 ${rows.length}개: 공식 시간 초안 ${candidate.length}개, 검토 대기 ${rows.length - candidate.length}개`);
