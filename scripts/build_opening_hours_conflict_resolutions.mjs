#!/usr/bin/env node
// 2026-08-23 운영시간 감사에서 대표 후보로 남은 원문 충돌을 사람이 판정한 결과로 정규화한다.
// 표기 차이는 두 원문을 보존하고, 파서가 범위/조건을 안전하게 표현하지 못하는 충돌은 hold로 보낸다.
import fs from 'node:fs';

const AUDIT = 'data/processed/review/사용중_장소_운영시간_원천감사.json';
const PROFILE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const OUTPUT = 'data/processed/review/운영시간_충돌_처리결과.json';
const REVIEWED_AT = '2026-08-24';
const TARGET_IDS = new Set('poi_762,poi_27,poi_30,poi_129,poi_130,poi_608,poi_8,poi_671,poi_66,poi_248,poi_379,poi_801,poi_802,poi_88,poi_403,poi_740,poi_825,poi_89,poi_92,poi_700,poi_622,poi_25,poi_805,poi_4,poi_427,poi_3,poi_630,poi_2,poi_207,poi_641,poi_719,poi_616,poi_53,poi_225,poi_1060,poi_1051,poi_1059,poi_807,poi_806'.split(','));
const HOLD_IDS = new Set(['poi_27', 'poi_30', 'poi_129', 'poi_130', 'poi_8', 'poi_671', 'poi_66', 'poi_248', 'poi_379', 'poi_88', 'poi_4', 'poi_2', 'poi_207', 'poi_53']);
const TYPE_BY_ID = {
  poi_27: '범위 불일치', poi_30: '범위 불일치', poi_129: '시간 조건 차이', poi_130: '시간 조건 차이',
  poi_8: '시간 조건 차이', poi_671: '범위 불일치', poi_66: '시간 조건 차이', poi_248: '시간 조건 차이',
  poi_379: '시간 조건 차이', poi_88: '범위 불일치', poi_4: '시간 조건 차이', poi_2: '범위 불일치',
  poi_207: '시간 조건 차이', poi_53: '실질 충돌',
};
const PREVIOUS_HOLD_CLASSIFICATION = {
  poi_27: 'representative_core', poi_8: 'representative_core', poi_88: 'representative_core', poi_4: 'representative_core', poi_2: 'representative_core',
  poi_30: 'representative_standard', poi_129: 'representative_standard', poi_130: 'representative_standard', poi_671: 'representative_standard', poi_66: 'representative_standard', poi_248: 'representative_standard', poi_379: 'representative_standard', poi_207: 'representative_standard', poi_53: 'representative_standard',
};
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalized = (value) => String(value ?? '').replace(/[\s\-~∼]/g, '').replace(/라스트오더|마지막주문|입장마감|발권마감/g, '').toLowerCase();
const audit = read(AUDIT); const profile = read(PROFILE); const byId = new Map(profile.data.map((p) => [p.id, p]));
const values = (row) => [...row.currentCatalogHours, row.tourapi.hours, ...row.busanOfficial.map((s) => s.hours)].filter(Boolean);
const rows = audit.data.filter((row) => TARGET_IDS.has(row.contentId)).map((row) => {
  const place = byId.get(row.contentId); const raw = values(row);
  const hold = HOLD_IDS.has(row.contentId);
  const type = hold ? TYPE_BY_ID[row.contentId] : '표기 차이';
  return {
    placeId: row.contentId, canonicalName: row.title, previousClassification: PREVIOUS_HOLD_CLASSIFICATION[row.contentId] ?? place.classification,
    conflictType: type, sourceValues: [
      ...row.currentCatalogHours.map((sourceText) => ({ source: 'runtime_catalog_pre_reclassification', sourceIdOrUrl: row.contentId, sourceText, appliesTo: place.placeKind })),
      ...(row.tourapi.hours ? [{ source: 'tourapi_detailIntro2', sourceIdOrUrl: String(place.sourceEvidence?.find((s) => /tourapi/.test(s.source))?.sourceId ?? row.contentId), sourceText: row.tourapi.hours, appliesTo: place.placeKind }] : []),
      ...row.busanOfficial.filter((source) => source.hours).map((source) => ({ source: source.source, sourceIdOrUrl: String(source.sourceId), sourceText: source.hours, appliesTo: place.placeKind })),
    ],
    normalizedValues: [...new Set(raw.map(normalized))],
    decision: hold ? 'hold' : 'retain_representative',
    decisionReason: hold
      ? '원문 범위·요일·계절·프로그램 또는 장소 범위 차이를 현재 운영시간 파서가 안전하게 단일 규칙으로 표현하지 못한다. 임의 선택 없이 보류한다.'
      : '공백·줄바꿈·기호 또는 입장/주문 마감 부연만 다르고 기본 이용 시간 범위가 동일하다. 두 원문을 보존한다.',
    reviewedAt: REVIEWED_AT, reviewer: 'data-curation',
    newClassification: hold ? 'hold' : place.classification,
    nextReviewDueAt: hold ? REVIEWED_AT : place.reviewDueAt,
  };
});
if (rows.length !== TARGET_IDS.size) throw new Error(`대표 후보 충돌 수가 ${TARGET_IDS.size}가 아닙니다: ${rows.length}`);
if (rows.some((row) => row.decision === 'retain_representative' && row.conflictType !== '표기 차이')) throw new Error('대표 유지 충돌 유형 오류');
fs.writeFileSync(OUTPUT, `${JSON.stringify({ meta: { generatedAt: REVIEWED_AT, sourceAudit: AUDIT, policy: 'unresolved conflict never remains representative' }, summary: { total: rows.length, retainRepresentative: rows.filter((r) => r.decision === 'retain_representative').length, hold: rows.filter((r) => r.decision === 'hold').length }, data: rows }, null, 2)}\n`);
console.log(`운영시간 충돌 처리 결과: ${rows.length}개 (유지 ${rows.filter((r) => r.decision === 'retain_representative').length}, hold ${rows.filter((r) => r.decision === 'hold').length})`);
