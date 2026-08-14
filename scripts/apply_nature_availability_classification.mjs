#!/usr/bin/env node
// 자연관광지 오분류 검토 결과를 최종 후보에 반영한다.
import fs from 'node:fs';

const MATCHED_FILE = 'data/processed/부산_최종매칭장소.json';
const UNMATCHED_FILE = 'data/processed/부산_최종미매칭장소.json';
const EXCLUDED_FILE = 'data/processed/review/부산_오분류제외장소.json';

const CLASSIFICATIONS = {
  poi_9: { category: '상업지구', kind: '시장', profile: 'area', reason: '시장 상권 이용 성격' },
  poi_10: { category: '상업지구', kind: '거리·골목', profile: 'area', reason: '거리 상권 이용 성격' },
  poi_16: { category: '상업지구', kind: '관광특구', profile: 'area', reason: '관광특구·상권 이용 성격' },
  poi_17: { category: '레저/스포츠', profile: 'facility', reason: '운항·탑승 프로그램 시설' },
  poi_24: { category: '레저/스포츠', profile: 'facility', reason: '입장형 테마파크 시설' },
  poi_28: { profile: 'facility', reason: '입장 마감이 있는 관리형 숲' },
  poi_30: { category: '상업지구', kind: '거리·골목', profile: 'area', reason: '거리 상권 이용 성격' },
  poi_35: { category: '문화시설', profile: 'facility', reason: '입장형 아쿠아리움 시설' },
  poi_37: { profile: 'hold', reason: '항구 이용 가능 시간 근거 수동 확인 전 보류' },
  poi_46: { profile: 'outdoor', reason: '야외 수변공원 접근형 장소' },
  poi_56: { category: '레저/스포츠', profile: 'facility', reason: '입장형 체험 시설' },
  poi_75: { profile: 'outdoor', reason: '야외 산책로 성격. 카카오 미확인 상태라 별도 추천 제외 유지' },
  poi_76: { category: '레저/스포츠', profile: 'facility', reason: '온천 이용 시설' },
  poi_81: { profile: 'hold', reason: '장소 실체·이용 성격 수동 확인 전 보류' },
  poi_84: { profile: 'outdoor', reason: '상시 접근 가능한 야외 역사 유적' },
  poi_94: { category: '문화시설', profile: 'facility', reason: '전망대 입장 시설' },
  poi_97: { category: '문화시설', profile: 'facility', reason: '체험·역사관 시설' },
  poi_650: { category: '문화시설', profile: 'facility', reason: '과학관 관람 시설' },
  poi_660: { profile: 'outdoor', reason: '상시 개방 야외 공원' },
  poi_673: { category: '상업지구', kind: '거리·골목', profile: 'area', reason: '거리 상권 이용 성격' },
};
const EXCLUDE_IDS = new Set(['poi_65']);

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const countBy = (items, select) => Object.fromEntries([...items.reduce((counts, item) => {
  const key = select(item) ?? '미분류';
  counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}, new Map()).entries()]);
const summary = (items) => ({
  records: items.length,
  byCategory: countBy(items, (place) => place.category),
  byScope: countBy(items, (place) => place.scope?.type),
});

const matched = read(MATCHED_FILE);
const unmatched = read(UNMATCHED_FILE);
const all = [...matched.data, ...unmatched.data];
const byId = new Map(all.map((place) => [place.id, place]));

for (const [id, rule] of Object.entries(CLASSIFICATIONS)) {
  const place = byId.get(id);
  if (!place) throw new Error(`분류 대상 누락: ${id}`);
  if (rule.category) place.category = rule.category;
  if (rule.kind) place.scope = { ...place.scope, type: '포괄장소', kind: rule.kind, parent: null };
  place.availabilityProfile = rule.profile;
  place.availabilityReason = rule.reason;
}

const excluded = [...EXCLUDE_IDS].map((id) => {
  const place = byId.get(id);
  if (!place) throw new Error(`제외 대상 누락: ${id}`);
  return { ...place, exclusionReason: '관광 활동 장소가 아닌 철도 운행 서비스' };
});
matched.data = matched.data.filter((place) => !EXCLUDE_IDS.has(place.id));
unmatched.data = unmatched.data.filter((place) => !EXCLUDE_IDS.has(place.id));
matched.summary = summary(matched.data);
unmatched.summary = summary(unmatched.data);
matched.meta.generatedAt = new Date().toISOString();
unmatched.meta.generatedAt = new Date().toISOString();
matched.meta.availabilityClassification = '시설형·권역형·야외상시형·보류 성격을 명시해 운영시간 게이트에 사용한다.';
unmatched.meta.availabilityClassification = matched.meta.availabilityClassification;

write(MATCHED_FILE, matched);
write(UNMATCHED_FILE, unmatched);
write(EXCLUDED_FILE, {
  meta: { generatedAt: new Date().toISOString(), purpose: '자연관광지 오분류 정제에서 추천 대상 제외한 교통성 장소 보관' },
  summary: { records: excluded.length },
  data: excluded,
});
console.log(`오분류 정제 완료: 분류 ${Object.keys(CLASSIFICATIONS).length}개 / 제외 ${excluded.length}개`);
