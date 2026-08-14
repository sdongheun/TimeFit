#!/usr/bin/env node
// 권역형 장소 중 TourAPI 원본이 있는 후보의 detailIntro2 운영시간을 재확인한다.
import fs from 'node:fs';

const KEY = process.env.EXPO_PUBLIC_TOURAPI_KEY;
if (!KEY) throw new Error('EXPO_PUBLIC_TOURAPI_KEY가 필요합니다. .env를 불러온 뒤 실행하세요.');

const REVIEW = 'data/processed/review/권역형장소_운영시간근거_검토.json';
const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/권역형장소_TourAPI상세운영시간_검토.json';
const API = 'https://apis.data.go.kr/B551011/KorService2/detailIntro2';
const FIELD_BY_TYPE = { '12': 'usetime', '14': 'usetimeculture', '15': 'usetimefestival', '28': 'usetimeleports', '38': 'opentime', '39': 'opentimefood' };

function classifyOfficialHours(hours) {
  if (!hours) return '상세시간미기재';
  const hasTimeRange = /(?:\d{1,2}:\d{2}|\d{1,2}시)\s*(?:~|∼|-)\s*(?:\d{1,2}:\d{2}|\d{1,2}시)/.test(hours);
  const hasConditionalNotice = /점포|매장|매장별|가게|전화문의|상이|문의/.test(hours);
  if (!hasTimeRange) return hasConditionalNotice ? '조건부안내' : '시간범위미확인';
  return hasConditionalNotice ? '시간범위+조건부' : '시간범위확인';
}

const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const byContentId = new Map([...catalog.matched.data, ...catalog.unmatched.data].map((place) => [place.contentId, place]));
const targets = review.data
  .filter((row) => row.priority === '1순위')
  .map((row) => ({ row, place: byContentId.get(row.contentId) }))
  .filter(({ place }) => place?.tourapiContentId && place?.tourapiContentTypeId);

async function detail(place) {
  const params = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: 'ETC',
    MobileApp: 'TimeFit',
    _type: 'json',
    contentId: place.tourapiContentId,
    contentTypeId: place.tourapiContentTypeId,
  });
  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const item = json?.response?.body?.items?.item;
  return Array.isArray(item) ? item[0] : item ?? null;
}

async function pool(items, limit, worker) {
  const result = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor++];
      result.push(await worker(current));
    }
  }));
  return result;
}

const rows = await pool(targets, 3, async ({ row, place }) => {
  try {
    const item = await detail(place);
    const field = FIELD_BY_TYPE[place.tourapiContentTypeId];
    const officialHours = item?.[field] ? String(item[field]).replace(/<br\s*\/?/gi, ' ').trim() : '';
    return {
      contentId: row.contentId,
      title: row.title,
      tourapiContentId: place.tourapiContentId,
      tourapiContentTypeId: place.tourapiContentTypeId,
      status: classifyOfficialHours(officialHours),
      officialHours: officialHours || null,
      officialHolidays: item?.restdate ?? item?.restdateculture ?? item?.restdateleports ?? item?.restdatefood ?? null,
      homepage: item?.homepage ?? null,
      contact: item?.infocenter ?? item?.infocenterculture ?? item?.infocenterleports ?? item?.infocenterfood ?? null,
      existingHours: row.currentOperatingHours,
    };
  } catch (error) {
    return {
      contentId: row.contentId,
      title: row.title,
      tourapiContentId: place.tourapiContentId,
      tourapiContentTypeId: place.tourapiContentTypeId,
      status: '조회실패',
      error: error instanceof Error ? error.message : String(error),
      existingHours: row.currentOperatingHours,
    };
  }
});

rows.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
const summary = Object.fromEntries([...rows.reduce((counts, row) => {
  counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return counts;
}, new Map()).entries()]);
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString(),
    source: 'TourAPI KorService2 detailIntro2',
    purpose: '권역형 장소의 추천 가능 시간대에 사용할 공식 원문 운영시간을 재확인한다.',
    note: '시간 문구가 있다고 즉시 자동 추천에 반영하지 않는다. 가게별 상이·야시장·투어 조건·휴무일을 검토해 별도 확정한다.',
  },
  summary: { queried: rows.length, byStatus: summary },
  data: rows,
}, null, 2)}\n`);
console.log(`TourAPI 상세 운영시간 확인: ${rows.length}건 -> ${OUTPUT}`);
