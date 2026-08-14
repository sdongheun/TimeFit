#!/usr/bin/env node
// 앱 런타임 카탈로그에서 운영시간이 비어 있는 후보를 검토용으로 추출한다.
import fs from 'node:fs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/현재사용_운영시간미확인장소.json';

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const sources = [
  ...catalog.matched.data.map((place) => ({ ...place, candidateGroup: 'AIHub_매칭' })),
  ...catalog.unmatched.data.map((place) => ({ ...place, candidateGroup: 'AIHub_미매칭_카테고리체류시간' })),
];

const missing = sources
  .filter((place) => !place.operatingHours?.length)
  .map((place) => ({
    contentId: place.contentId,
    title: place.title,
    candidateGroup: place.candidateGroup,
    category: place.category,
    subCategory: place.subCategory ?? null,
    matchScope: place.matchScope,
    openingHoursReliability: place.openingHoursReliability,
    holidays: place.holidays ?? [],
    sourceEvidence: (place.sourceEvidence ?? []).map((source) => source.source),
    mapVerificationStatus: place.mapVerification?.status ?? 'unverified',
    kakaoPlaceUrl: place.mapVerification?.placeUrl ?? null,
    reviewGroup: place.category === '자연관광지'
      ? '자연관광지_야간허용여부검토'
      : '운영시간미확인_새벽추천제외후보',
  }))
  .sort((a, b) => a.category.localeCompare(b.category, 'ko') || a.title.localeCompare(b.title, 'ko'));

const countBy = (items, select) => Object.fromEntries(
  [...items.reduce((counts, item) => {
    const key = select(item) ?? '미분류';
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort((a, b) => b[1] - a[1]),
);

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    sourceCatalog: CATALOG,
    purpose: '현재 추천 후보 중 운영시간이 비어 있는 장소를 분류해 새벽 추천 정책을 정하기 위한 검토 자료',
    rule: '자연관광지가 아닌 장소는 운영시간이 확인되기 전 새벽 추천 제외 후보로 분류한다. 자연관광지도 시설형 여부를 별도 검토한다.',
  },
  summary: {
    total: missing.length,
    byCandidateGroup: countBy(missing, (place) => place.candidateGroup),
    byCategory: countBy(missing, (place) => place.category),
    bySubCategory: countBy(missing, (place) => place.subCategory),
    byReviewGroup: countBy(missing, (place) => place.reviewGroup),
  },
  data: missing,
};

fs.mkdirSync('data/processed/review', { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`운영시간 미확인 장소: ${missing.length}개 -> ${OUTPUT}`);
