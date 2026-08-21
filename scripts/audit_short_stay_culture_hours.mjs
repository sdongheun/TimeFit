#!/usr/bin/env node
// 문화시설 후보의 TourAPI 상세 운영시간을 재조회해 병렬 카탈로그의 수동 검토 근거로 저장한다.
import fs from 'node:fs';

const KEY = process.env.EXPO_PUBLIC_TOURAPI_KEY;
const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/부산_문화시설_TourAPI운영시간_검토.json';
const API = 'https://apis.data.go.kr/B551011/KorService2/detailIntro2';
const FIELD_BY_TYPE = { '14': 'usetimeculture', '12': 'usetime', '28': 'usetimeleports' };

if (!KEY) throw new Error('EXPO_PUBLIC_TOURAPI_KEY가 필요합니다.');

function clean(value) {
  return String(value ?? '').replace(/<br\s*\/?\s*>/gi, ' ').replace(/\s+/g, ' ').trim();
}

function classify(hours) {
  if (!hours) return '시간미기재';
  if (/행사별\s*상이|프로그램별\s*상이|매장별\s*상이|홈페이지\s*참조/.test(hours)) return '조건부안내';
  if (/24시간|상시|(?:\d{1,2}:\d{2}|\d{1,2}시)\s*(?:~|∼|-)\s*(?:\d{1,2}:\d{2}|\d{1,2}시)/.test(hours)) return '시간범위확인';
  return '시간범위미확인';
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const targets = [...catalog.matched.data, ...catalog.unmatched.data]
  .filter((place) => place.category === '문화시설' && place.tourapiContentId && FIELD_BY_TYPE[place.tourapiContentTypeId])
  .map((place) => ({
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    tourapiContentId: place.tourapiContentId,
    tourapiContentTypeId: place.tourapiContentTypeId,
    currentHours: place.operatingHours ?? [],
  }));

async function detail(target) {
  const params = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: 'ETC',
    MobileApp: 'TimeFit',
    _type: 'json',
    contentId: target.tourapiContentId,
    contentTypeId: target.tourapiContentTypeId,
  });
  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const raw = json?.response?.body?.items?.item;
  return Array.isArray(raw) ? raw[0] : raw ?? null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rows = [];
for (const [index, target] of targets.entries()) {
  try {
    const item = await detail(target);
    const hours = clean(item?.[FIELD_BY_TYPE[target.tourapiContentTypeId]]);
    rows.push({
      ...target,
      status: classify(hours),
      officialHours: hours || null,
      officialHolidays: clean(item?.restdateculture ?? item?.restdate ?? item?.openperiod) || null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    rows.push({ ...target, status: '조회실패', error: error instanceof Error ? error.message : String(error), checkedAt: new Date().toISOString() });
  }
  if ((index + 1) % 20 === 0) console.error(`[culture-hours] ${index + 1}/${targets.length}`);
  await sleep(80);
}

const byStatus = rows.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {});
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString(),
    source: 'TourAPI KorService2 detailIntro2',
    status: 'review_only_not_runtime',
    policy: '시간범위확인만 시설형 자투리 후보의 운영시간 근거로 사용한다. 전시·프로그램별 상이는 직접 추천 시간 계산에 사용하지 않는다.',
  },
  summary: { queried: rows.length, byStatus },
  data: rows,
}, null, 2)}\n`);
console.log(`문화시설 운영시간 재조회: ${rows.length}건 -> ${OUTPUT}`);
