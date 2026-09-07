#!/usr/bin/env node
import fs from 'node:fs';

const SOURCE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const FOOD = 'data/processed/부산시_맛집정보.json';
const ATTRACTION = 'data/processed/부산시_명소정보.json';
const OUTPUT = 'data/processed/review/카페문화시설_세부분류_감사.json';
const ACTIVE = new Set(['representative_core', 'representative_standard', 'conditional_more']);
// 부산시 맛집정보 SUBTITLE에서 장소 유형으로 직접 쓰인 기존 공식 어휘만 허용한다.
// 메뉴/상품(예: 케이크), 장소명 반복, 빈 값은 분류로 사용하지 않는다.
const ACCEPTED_CAFE_SUBTITLES = new Set(['베이커리', '디저트카페', '커피전문점']);

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const source = read(SOURCE).data;
const official = {
  busan_food: new Map(read(FOOD).data.map((row) => [String(row.UC_SEQ), row])),
  busan_attraction: new Map(read(ATTRACTION).data.map((row) => [String(row.UC_SEQ), row])),
};
const target = source.filter((place) => ACTIVE.has(place.classification) && ['카페', '문화시설'].includes(place.category));

function existingSubCategory(place) {
  const value = place.scope?.kind;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function officialRefs(place) {
  return (place.sourceEvidence ?? []).flatMap((evidence) => {
    const row = official[evidence.source]?.get(String(evidence.sourceId));
    return row ? [{ source: evidence.source, sourceId: String(evidence.sourceId) }] : [];
  });
}

function review(place) {
  const previousSubCategory = existingSubCategory(place);
  const refs = officialRefs(place);
  if (previousSubCategory) return {
    contentId: place.id,
    title: place.title,
    category: place.category,
    classification: place.classification,
    previousSubCategory,
    newSubCategory: previousSubCategory,
    decision: 'preserve_existing',
    officialEvidence: refs,
    decisionReason: '기존 유효 subCategory를 변경하지 않는다.',
  };

  if (place.category === '카페') {
    const candidates = refs.flatMap((ref) => {
      if (ref.source !== 'busan_food') return [];
      const subtitle = String(official.busan_food.get(ref.sourceId)?.SUBTITLE ?? '').trim();
      return ACCEPTED_CAFE_SUBTITLES.has(subtitle)
        ? [{ ...ref, field: 'SUBTITLE', sourceText: subtitle }]
        : [];
    });
    const values = [...new Set(candidates.map((candidate) => candidate.sourceText))];
    if (values.length === 1) return {
      contentId: place.id,
      title: place.title,
      category: place.category,
      classification: place.classification,
      previousSubCategory: null,
      newSubCategory: values[0],
      decision: 'assign_exact_official_subtitle',
      officialEvidence: candidates,
      decisionReason: '정확히 연결된 부산시 맛집정보의 구조화 SUBTITLE이 허용된 장소 유형 어휘와 일치한다.',
    };
    return {
      contentId: place.id,
      title: place.title,
      category: place.category,
      classification: place.classification,
      previousSubCategory: null,
      newSubCategory: null,
      decision: values.length > 1 ? 'hold_ambiguous_official_subtitle' : 'hold_missing_existing_taxonomy_evidence',
      officialEvidence: refs,
      decisionReason: values.length > 1
        ? '정확한 공식 SUBTITLE이 서로 달라 단일 분류로 투영하지 않는다.'
        : '허용된 구조화 장소 유형이 없다. 장소명·메뉴·설명으로 세부분류를 추정하지 않는다.',
    };
  }

  return {
    contentId: place.id,
    title: place.title,
    category: place.category,
    classification: place.classification,
    previousSubCategory: null,
    newSubCategory: null,
    decision: 'hold_missing_existing_taxonomy_evidence',
    officialEvidence: refs,
    decisionReason: '현행 부산시 명소/TourAPI 연결에는 재사용 가능한 구조화 문화시설 세부유형 필드가 없다. 이름·서술문으로 새 taxonomy를 만들지 않는다.',
  };
}

const data = target.map(review).sort((left, right) => left.contentId.localeCompare(right.contentId, 'en'));
const changed = data.filter((row) => row.decision === 'assign_exact_official_subtitle');
const payload = {
  meta: {
    taskId: 'DATA-RELEASE-PERSONALIZATION-01-cafe-culture-followup',
    generatedAt: '2026-09-07',
    sources: [SOURCE, FOOD, ATTRACTION],
    policy: 'exact official structured subtype only; no title/menu/description inference',
  },
  summary: {
    total: data.length,
    changed: changed.length,
    byCategory: Object.fromEntries(['카페', '문화시설'].map((category) => {
      const rows = data.filter((row) => row.category === category);
      return [category, {
        total: rows.length,
        previousApplicable: rows.filter((row) => row.previousSubCategory).length,
        finalApplicable: rows.filter((row) => row.newSubCategory).length,
        remainingMissing: rows.filter((row) => !row.newSubCategory).length,
        changed: rows.filter((row) => row.decision === 'assign_exact_official_subtitle').length,
      }];
    })),
    assignedValues: Object.fromEntries([...new Set(changed.map((row) => row.newSubCategory))].sort()
      .map((value) => [value, changed.filter((row) => row.newSubCategory === value).length])),
  },
  data,
};

if (data.length !== 98 || changed.length !== 5) throw new Error(`unexpected cafe/culture audit counts: ${data.length}/${changed.length}`);
write(OUTPUT, payload);
console.log(`카페·문화시설 세부분류 감사: 대상 ${data.length} / 보완 ${changed.length} / 남은 누락 ${data.filter((row) => !row.newSubCategory).length}`);
