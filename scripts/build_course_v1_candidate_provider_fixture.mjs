#!/usr/bin/env node
// CourseV1 후보 변환 provider의 고정 입력·제외 경계를 스냅샷으로 보존한다.
import fs from 'node:fs';

const RUNTIME = 'src/data/busan_poi_catalog.json';
const PROFILE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const AVAILABILITY = 'data/processed/review/부산_장소_구조화_운영시간.json';
const OUTPUT = 'data/processed/review/코스V1_대표후보_provider_fixture.json';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const runtime = read(RUNTIME);
const allRuntime = [...runtime.matched.data, ...runtime.unmatched.data];
const profile = read(PROFILE).data;
const availabilityById = new Map(read(AVAILABILITY).data.map((row) => [row.placeId, row]));
const representative = allRuntime.filter((place) => ['representative_core', 'representative_standard'].includes(place.classification))
  .sort((left, right) => left.contentId.localeCompare(right.contentId));
const conditional = allRuntime.filter((place) => place.classification === 'conditional_more').map((place) => place.contentId).sort();
const hold = profile.filter((place) => place.classification === 'hold').map((place) => place.id).sort();
const internal = profile.filter((place) => place.scope?.type === '내부장소').map((place) => place.id).sort();

const data = representative.map((place) => {
  const availability = availabilityById.get(place.contentId);
  if (!availability) throw new Error(`${place.contentId}: availability missing`);
  return {
    id: place.contentId, title: place.title, lat: place.lat, lon: place.lon,
    classification: place.classification, minStayMin: place.shortStay.minStayMin,
    recommendedStayMin: place.shortStay.recommendedStayMin, siteGroupId: place.siteGroupId ?? null,
    reviewDueAt: place.evidenceProfile.reviewDueAt,
    availability: { status: availability.status, alwaysAccessible: availability.alwaysAccessible ?? false, dayTypes: availability.dayTypes ?? [], windows: availability.windows ?? [] },
  };
});

fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: { generatedAt: '2026-08-24', source: [RUNTIME, PROFILE, AVAILABILITY], purpose: 'CourseV1CandidateProvider 입력·제외 계약 고정 fixture' },
  summary: { runtimeTotal: allRuntime.length, representativeTotal: representative.length, conditionalTotal: conditional.length, holdTotal: hold.length },
  representativeCandidateIds: data.map((item) => item.id), conditionalCandidateIds: conditional, holdPlaceIds: hold,
  internalPlaceIds: internal, expiredAt20261122CandidateIds: data.filter((item) => item.reviewDueAt < '2026-11-22').map((item) => item.id), data,
}, null, 2)}\n`);
console.log(`CourseV1 후보 provider fixture: 대표 ${representative.length} / 조건부 ${conditional.length} / hold ${hold.length}`);
