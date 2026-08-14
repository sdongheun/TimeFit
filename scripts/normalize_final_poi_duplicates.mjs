#!/usr/bin/env node
// 최종 후보의 이름 차이 중복을 대표 장소 하나로 병합하고, 포괄-내부 장소 그룹을 부여한다.
import fs from 'node:fs';

const MATCHED_FILE = 'data/processed/부산_최종매칭장소.json';
const UNMATCHED_FILE = 'data/processed/부산_최종미매칭장소.json';

// keepId는 AI-Hub 매칭·공식 근거를 가장 잘 보존하는 레코드, titleFromId는 사용자에게 보일 대표명이다.
const DUPLICATE_GROUPS = [
  { keepId: 'poi_840', titleFromId: 'poi_840', mergeIds: ['poi_840', 'poi_1149'] },
  { keepId: 'poi_995', titleFromId: 'poi_995', mergeIds: ['poi_995', 'poi_1104'] },
  { keepId: 'poi_31', titleFromId: 'poi_31', mergeIds: ['poi_31', 'poi_838'] },
  { keepId: 'poi_861', titleFromId: 'poi_861', mergeIds: ['poi_861', 'poi_1107'] },
  { keepId: 'poi_42', titleFromId: 'poi_1086', mergeIds: ['poi_42', 'poi_1086'] },
  { keepId: 'poi_586', titleFromId: 'poi_1053', mergeIds: ['poi_586', 'poi_1053'] },
  { keepId: 'poi_460', titleFromId: 'poi_460', mergeIds: ['poi_460', 'poi_843'] },
  { keepId: 'poi_462', titleFromId: 'poi_462', mergeIds: ['poi_462', 'poi_1105'] },
  { keepId: 'poi_403', titleFromId: 'poi_403', mergeIds: ['poi_403', 'poi_1045'] },
  { keepId: 'poi_486', titleFromId: 'poi_874', mergeIds: ['poi_486', 'poi_874'] },
  { keepId: 'poi_300', titleFromId: 'poi_300', mergeIds: ['poi_300', 'poi_830'] },
];

const SITE_GROUPS = [
  { id: 'site_movie_hall', parentId: 'poi_90', childId: 'poi_108' },
  { id: 'site_busan_citizen_park', parentId: 'poi_656', childId: 'poi_752' },
  { id: 'site_busan_modern_history_museum', parentId: 'poi_709', childId: 'poi_91' },
  { id: 'site_busan_children_grand_park', parentId: 'poi_652', childId: 'poi_771' },
];

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const keyOf = (value) => JSON.stringify(value);

const matched = read(MATCHED_FILE);
const unmatched = read(UNMATCHED_FILE);
const all = [...matched.data, ...unmatched.data];
const byId = new Map(all.map((place) => [place.id, place]));
const removedIds = new Set();
const replacements = new Map();

function unique(values) {
  return [...new Map(values.filter(Boolean).map((value) => [keyOf(value), value])).values()];
}

for (const group of DUPLICATE_GROUPS) {
  const places = group.mergeIds.map((id) => byId.get(id));
  if (places.some((place) => !place)) throw new Error(`중복 그룹 장소 누락: ${group.mergeIds.join(', ')}`);
  const keep = byId.get(group.keepId);
  const titleSource = byId.get(group.titleFromId);
  const aihubSource = places.find((place) => place.aihubMatch && place.dwell);
  const merged = {
    ...keep,
    title: titleSource.title,
    aliases: unique(places.flatMap((place) => [place.title, ...(place.aliases ?? [])])),
    sourceEvidence: unique(places.flatMap((place) => place.sourceEvidence ?? [])),
    operatingHours: unique(places.flatMap((place) => place.operatingHours ?? [])),
    holidays: unique(places.flatMap((place) => place.holidays ?? [])),
    aihubMatch: keep.aihubMatch ?? aihubSource?.aihubMatch ?? null,
    dwellPolicy: keep.dwellPolicy === 'individual_dwell_from_aihub' || aihubSource
      ? 'individual_dwell_from_aihub'
      : keep.dwellPolicy,
    dwell: keep.dwell ?? aihubSource?.dwell ?? null,
    mergedPlaceIds: group.mergeIds.filter((id) => id !== group.keepId),
  };
  replacements.set(group.keepId, merged);
  group.mergeIds.filter((id) => id !== group.keepId).forEach((id) => removedIds.add(id));
}

let normalized = all
  .filter((place) => !removedIds.has(place.id))
  .map((place) => replacements.get(place.id) ?? place);
const normalizedById = new Map(normalized.map((place) => [place.id, place]));

for (const group of SITE_GROUPS) {
  const parent = normalizedById.get(group.parentId);
  const child = normalizedById.get(group.childId);
  if (!parent || !child) throw new Error(`포괄-내부 그룹 장소 누락: ${group.id}`);
  parent.siteGroupId = group.id;
  parent.siteRole = 'parent';
  parent.scope = { ...parent.scope, type: '포괄장소', parent: null };
  child.siteGroupId = group.id;
  child.siteRole = 'child';
  child.scope = { ...child.scope, type: '내부장소', parent: parent.title };
}

const nextMatched = normalized.filter((place) => place.aihubMatch && place.dwell);
const nextUnmatched = normalized.filter((place) => !(place.aihubMatch && place.dwell));
const summary = (items) => ({
  records: items.length,
  byCategory: Object.fromEntries([...items.reduce((map, place) => {
    map.set(place.category, (map.get(place.category) ?? 0) + 1);
    return map;
  }, new Map()).entries()]),
  byScope: Object.fromEntries([...items.reduce((map, place) => {
    const key = place.scope?.type ?? '미분류';
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map()).entries()]),
});

matched.data = nextMatched;
matched.summary = summary(nextMatched);
matched.meta.generatedAt = new Date().toISOString();
matched.meta.normalization = '동일 장소 11쌍을 대표명·별칭·출처·운영시간으로 병합하고 포괄-내부 4쌍에 siteGroupId를 부여했다.';
unmatched.data = nextUnmatched;
unmatched.summary = summary(nextUnmatched);
unmatched.meta.generatedAt = new Date().toISOString();
unmatched.meta.normalization = matched.meta.normalization;

write(MATCHED_FILE, matched);
write(UNMATCHED_FILE, unmatched);
console.log(`중복 병합 완료: ${all.length} -> ${normalized.length}개 (동일 장소 ${DUPLICATE_GROUPS.length}쌍 병합, 포괄-내부 ${SITE_GROUPS.length}쌍 그룹화)`);
