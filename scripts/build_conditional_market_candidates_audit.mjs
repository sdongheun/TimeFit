#!/usr/bin/env node
// 조건부 시장·거리의 정보 확인용 자격만 감사한다. 운영시간·등급을 새로 만들지 않는다.
import fs from 'node:fs';

const SOURCE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const OUTPUT = 'data/processed/review/조건부_시장거리_발견후보_감사.json';
const MARKET_OR_STREET = new Set(['시장', '거리·골목']);
const WHOLESALE_OR_DAWN = /도매|새벽|축산|어패류|회타운|수산|유통|산업용재/;

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const countBy = (rows, selector) => rows.reduce((result, row) => {
  const key = selector(row) ?? 'unknown';
  result[key] = (result[key] ?? 0) + 1;
  return result;
}, {});

function exclusionReason(place) {
  if (place.placeKind !== 'area') return 'not_area_place_kind';
  if (!MARKET_OR_STREET.has(place.scope?.kind)) return 'not_market_or_street_scope';
  if (WHOLESALE_OR_DAWN.test(place.title)) return 'wholesale_or_dawn_specialized';
  if (!['quick_browse', 'compact_culture'].includes(place.shortStayType)) return 'not_market_or_street_activity';
  if (place.reservationRequired !== false) return 'reservation_or_long_visit_uncertain';
  if (place.entryExitFriction === 'high') return 'high_access_friction';
  if (place.siteRole === 'internal') return 'internal_place';
  return null;
}

const source = read(SOURCE);
const conditional = source.data.filter((place) => place.classification === 'conditional_more');
const data = conditional.map((place) => {
  const reason = exclusionReason(place);
  return {
    contentId: place.id,
    title: place.title,
    previousClassification: place.classification,
    placeKind: place.placeKind,
    areaCharacter: place.scope?.kind ?? null,
    shortStayType: place.shortStayType,
    siteRole: place.siteRole ?? null,
    reservationRequired: place.reservationRequired,
    accessFriction: place.entryExitFriction,
    sourceEvidence: place.sourceEvidence,
    decision: reason ? 'excluded' : 'conditional_visit',
    ...(reason ? { exclusionReason: reason } : {
      conditionalVisit: {
        kind: 'market_or_street',
        displayWindow: { start: '10:00', end: '18:00' },
        requiresUserHoursConfirmation: true,
      },
    }),
  };
}).sort((left, right) => left.contentId.localeCompare(right.contentId));

const eligible = data.filter((row) => row.decision === 'conditional_visit');
write(OUTPUT, {
  meta: {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    method: '보존된 conditional_more 근거 프로필만 사용한 무호출 감사',
    policy: 'conditional_visit의 10:00–18:00은 제품 탐색 창이며 공식 운영시간·안전시간·자동 추천 근거가 아니다.',
  },
  summary: {
    reviewedConditionalTotal: data.length,
    eligibleConditionalVisitTotal: eligible.length,
    excludedTotal: data.length - eligible.length,
  },
  breakdown: {
    eligibleByAreaCharacter: countBy(eligible, (row) => row.areaCharacter),
    excludedByReason: countBy(data.filter((row) => row.decision === 'excluded'), (row) => row.exclusionReason),
  },
  data,
});

console.log(`조건부 시장·거리 감사: ${data.length}개 / conditional_visit ${eligible.length} / 제외 ${data.length - eligible.length}`);
