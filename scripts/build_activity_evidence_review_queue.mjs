#!/usr/bin/env node
// 활동 유형을 공식 원문으로 판정하지 못해 hold인 장소의 사람 검토 큐를 만든다.
import fs from 'node:fs';

const PROFILE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const OUTPUT = 'data/processed/review/활동근거_재검토큐.json';
const REASON = 'activity_type_not_determinable_from_name_or_official_category; missing identity, activity, or stay evidence';

const profile = JSON.parse(fs.readFileSync(PROFILE, 'utf8'));
const data = profile.data
  .filter((place) => place.classification === 'hold' && place.classificationReason === REASON)
  .sort((left, right) => left.id.localeCompare(right.id, 'en'))
  .map((place) => ({
    placeId: place.id,
    canonicalName: place.canonicalName,
    title: place.title,
    category: place.category,
    placeKind: place.placeKind,
    coordinates: place.coordinates,
    sourceEvidence: place.sourceEvidence,
    currentClassification: place.classification,
    currentReason: place.classificationReason,
    currentReviewDueAt: place.reviewDueAt,
    requiredOfficialEvidence: [
      '공식 소개 원문의 실제 활동·방문 단위',
      '20~60분 짧은 방문 완결성 또는 공식 체류 근거',
      '시설·권역·야외·행사 범위와 접근·예약 부담',
      '운영시간 또는 상시 접근의 공식 적용 범위',
    ],
    allowedOutcomes: [
      'representative_core: 모든 필수 근거와 이용 가능성이 확인된 경우',
      'representative_standard: 활동 또는 체류가 검토된 템플릿 근거이고 이용 가능성이 확인된 경우',
      'conditional_more: 이용 가능성만 unknown인 경우',
      'hold: 공식 원문이 부족하거나 장기·예약·프로그램 의존인 경우',
    ],
    reviewStatus: 'pending_official_source_review',
  }));

const bySource = data.flatMap((row) => row.sourceEvidence.map((source) => source.source))
  .reduce((counts, source) => ({ ...counts, [source]: (counts[source] ?? 0) + 1 }), {});

fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString(),
    source: PROFILE,
    purpose: '140개 활동·짧은 방문 근거 미확정 hold의 공식 원문 사람 검토 큐',
    nonPromotionRule: '공식 원문·적용 범위 없이 분류를 승격하지 않는다.',
  },
  summary: { total: data.length, bySource },
  data,
}, null, 2)}\n`);

console.log(`활동 근거 재검토 큐: ${data.length}개 -> ${OUTPUT}`);
