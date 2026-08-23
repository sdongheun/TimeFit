#!/usr/bin/env node
// 활성 런타임 장소의 운영시간을 TourAPI 실시간 상세와 부산시 원본 레코드로 대조한다.
import fs from 'node:fs';
import path from 'node:path';
import { classifyHoursText, cleanHoursText, countBy } from './lib/openingHoursAudit.mjs';

const CATALOG_FILE = 'src/data/busan_poi_catalog.json';
const OUTPUT_FILE = 'data/processed/review/사용중_장소_운영시간_원천감사.json';
const REPORT_FILE = 'docs/02_data/사용중_장소_운영시간_감사.md';
const TOURAPI_BASE = 'https://apis.data.go.kr/B551011/KorService2/detailIntro2';
const TOURAPI_KEY = process.env.EXPO_PUBLIC_TOURAPI_KEY || process.env.TOURAPI_KEY || '';
const CONCURRENCY = Math.max(1, Number(process.env.OPENING_HOURS_CONCURRENCY ?? 3));
const USE_EXISTING_TOURAPI = process.env.OPENING_HOURS_USE_CACHE === '1';
const TYPE_HOUR_FIELD = { 12: 'usetime', 14: 'usetimeculture', 15: 'usetimefestival', 28: 'usetimeleports', 38: 'opentime', 39: 'opentimefood' };
const TYPE_HOLIDAY_FIELD = { 12: 'restdate', 14: 'restdateculture', 15: 'eventenddate', 28: 'openperiod', 38: 'restdateshopping', 39: 'restdatefood' };
const OFFICIAL_FILES = {
  busan_attraction: 'data/processed/부산시_명소정보.json',
  busan_shopping: 'data/processed/부산시_쇼핑정보.json',
  busan_food: 'data/processed/부산시_맛집정보.json',
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, payload) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
};

function sourceMaps() {
  return Object.fromEntries(Object.entries(OFFICIAL_FILES).map(([source, file]) => {
    const payload = read(file);
    const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
    return [source, new Map(rows.map((row) => [String(row.UC_SEQ), row]))];
  }));
}

function officialEvidence(place, maps) {
  return (place.sourceEvidence ?? [])
    .filter((evidence) => maps[evidence.source])
    .map((evidence) => {
      const row = maps[evidence.source].get(String(evidence.sourceId));
      const hours = cleanHoursText(row?.USAGE_DAY_WEEK_AND_TIME);
      return {
        source: evidence.source,
        sourceId: String(evidence.sourceId),
        found: Boolean(row),
        title: row?.MAIN_TITLE ?? row?.TITLE ?? null,
        hours: hours || null,
        hoursStatus: classifyHoursText(hours).status,
        usageDay: cleanHoursText(row?.USAGE_DAY) || null,
        holidays: cleanHoursText(row?.HLDY_INFO) || null,
        imageUrl: row?.MAIN_IMG_NORMAL ?? row?.MAIN_IMG_THUMB ?? null,
      };
    });
}

async function fetchTourApi(place) {
  if (!place.tourapiContentId || !place.tourapiContentTypeId) return { status: 'not_applicable', hours: null };
  const params = new URLSearchParams({
    serviceKey: TOURAPI_KEY,
    MobileOS: 'ETC',
    MobileApp: 'TimeFit',
    _type: 'json',
    contentId: String(place.tourapiContentId),
    contentTypeId: String(place.tourapiContentTypeId),
  });
  try {
    const response = await fetch(`${TOURAPI_BASE}?${params}`);
    if (!response.ok) return { status: 'request_failed', hours: null, error: `HTTP ${response.status}` };
    const json = await response.json();
    let item = json?.response?.body?.items?.item;
    if (Array.isArray(item)) item = item[0];
    if (!item) return { status: 'empty', hours: null };
    const type = Number(place.tourapiContentTypeId);
    const hours = cleanHoursText(item[TYPE_HOUR_FIELD[type]]);
    return {
      status: 'queried',
      hours: hours || null,
      hoursStatus: classifyHoursText(hours).status,
      holidays: cleanHoursText(item[TYPE_HOLIDAY_FIELD[type]]) || null,
      field: TYPE_HOUR_FIELD[type] ?? null,
    };
  } catch (error) {
    return { status: 'request_failed', hours: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }));
  return results;
}

function sourceKind(place) {
  const sources = new Set((place.sourceEvidence ?? []).map((evidence) => evidence.source));
  if (sources.has('traditional_market_standard')) return '전국전통시장표준데이터';
  if ([...sources].some((source) => OFFICIAL_FILES[source])) return '부산시 관광 원천';
  return 'TourAPI';
}

function finalStatus(row) {
  const values = [row.tourapi.hoursStatus, ...row.busanOfficial.map((source) => source.hoursStatus)];
  if (values.includes('structured')) return '구조화된_시간확인';
  if (values.includes('conditional')) return '시간범위_조건부';
  if (values.includes('ambiguous')) return '시간문구_모호';
  if (row.tourapi.status === 'request_failed') return 'TourAPI_조회실패';
  return '운영시간_미확인';
}

function report(payload) {
  const { summary } = payload;
  const lines = [
    '# 사용 중 장소 운영시간 원천 감사',
    '',
    `- 생성: ${payload.meta.generatedAt}`,
    `- 대상: 런타임 카탈로그 ${summary.total}개`,
    `- TourAPI 상세 재조회: ${summary.tourapiQueried}개`,
    `- 부산시 원천 대조: ${summary.busanOfficialLinked}개`,
    `- 현재 카탈로그 시간 기재: ${summary.currentCatalogHours}개`,
    `- 원천에 구조화된 시간이 있으나 카탈로그가 비어 있는 장소: ${summary.sourceStructuredButCatalogEmpty}개`,
    `- 현재값과 원천값의 원문이 다른 장소: ${summary.differentRawHours}개`,
    '',
    '## 결과',
    '',
    '| 판정 | 개수 | 의미 |',
    '| --- | ---: | --- |',
    ...Object.entries(summary.byFinalStatus).map(([status, count]) => `| ${status} | ${count} | ${status === '구조화된_시간확인' ? '시간 범위가 원천 중 하나에 명시됨' : status === '시간범위_조건부' ? '시간 범위는 있으나 매장·점포별 상이 등 조건이 있음' : status === '시간문구_모호' ? '상시·매일 등 시간 범위 없는 문구만 있음' : '원천에 시간 정보가 없거나 TourAPI 요청 실패'} |`),
    '',
    '## 원천별 범위',
    '',
    '| 원천 | 장소 수 | 구조화된 시간 | 조건부 시간 | 모호/미확인 |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary.bySourceKind).map(([source, value]) => `| ${source} | ${value.total} | ${value.structured} | ${value.conditional} | ${value.other} |`),
    '',
    '## 해석',
    '',
    '- 이 감사는 원천 데이터의 시간 문구 존재 여부를 대조한 결과다. 실제 영업 여부, 임시 휴무, 행사 운영은 보장하지 않는다.',
    '- 현재 런타임 카탈로그는 시간 값의 공급 원천을 필드 단위로 저장하지 않는다. 따라서 이 감사 JSON을 기준으로 다음 카탈로그 빌드에서 `openingHoursEvidence`를 보존해야 한다.',
    '- 원문 차이는 자동 충돌로 단정하지 않는다. 상위 장소와 내부 시설의 시간, 계절·요일·입장마감 정보 차이일 수 있으므로 장소 단위 검토 뒤 반영한다.',
    '- 전국전통시장표준데이터는 운영시간 필드를 제공하지 않아, 해당 장소는 별도 TourAPI·부산시 원천이 연결되지 않으면 운영시간 미확인으로 남는다.',
    '',
    `상세 행과 원문 시간은 [사용중_장소_운영시간_원천감사.json](/Users/shindongheun/Desktop/myProject/TimeFit/${OUTPUT_FILE})에서 확인한다.`,
  ];
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${lines.join('\n')}\n`);
}

if (!TOURAPI_KEY) throw new Error('EXPO_PUBLIC_TOURAPI_KEY 또는 TOURAPI_KEY가 필요합니다. .env를 불러온 뒤 실행하세요.');

const catalog = read(CATALOG_FILE);
const places = [...catalog.matched.data, ...catalog.unmatched.data];
const maps = sourceMaps();
const previousTourApiByContentId = USE_EXISTING_TOURAPI && fs.existsSync(OUTPUT_FILE)
  ? new Map(read(OUTPUT_FILE).data.map((row) => [row.contentId, row.tourapi]))
  : new Map();
const tourApiResults = await pool(places, (place) => previousTourApiByContentId.get(place.contentId) ?? fetchTourApi(place));
const data = places.map((place, index) => {
  const busanOfficial = officialEvidence(place, maps);
  const row = {
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    subCategory: place.subCategory ?? null,
    sourceKind: sourceKind(place),
    sourceEvidence: place.sourceEvidence ?? [],
    currentCatalogHours: place.operatingHours ?? [],
    currentCatalogHoursStatus: classifyHoursText((place.operatingHours ?? []).join(' ')).status,
    tourapi: tourApiResults[index],
    busanOfficial,
  };
  return { ...row, finalStatus: finalStatus(row) };
}).sort((a, b) => a.title.localeCompare(b.title, 'ko'));

const sourceSummary = Object.fromEntries(Object.entries(countBy(data, (row) => row.sourceKind)).map(([source]) => {
  const rows = data.filter((row) => row.sourceKind === source);
  return [source, {
    total: rows.length,
    structured: rows.filter((row) => row.finalStatus === '구조화된_시간확인').length,
    conditional: rows.filter((row) => row.finalStatus === '시간범위_조건부').length,
    other: rows.filter((row) => !['구조화된_시간확인', '시간범위_조건부'].includes(row.finalStatus)).length,
  }];
}));

function rawHourValues(row) {
  return [
    ...row.currentCatalogHours,
    ...(row.tourapi.hours ? [row.tourapi.hours] : []),
    ...row.busanOfficial.map((source) => source.hours).filter(Boolean),
  ].map((value) => cleanHoursText(value));
}

const sourceStructuredButCatalogEmpty = data.filter((row) => row.currentCatalogHours.length === 0 && row.finalStatus === '구조화된_시간확인');
const differentRawHours = data.filter((row) => {
  const values = rawHourValues(row);
  return values.length > 1 && new Set(values).size > 1;
});

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    catalog: CATALOG_FILE,
    tourapiEndpoint: 'TourAPI KorService2 detailIntro2',
    busanSources: OFFICIAL_FILES,
    purpose: '현재 런타임 추천 장소의 운영시간을 TourAPI 상세 응답과 부산시 원천 레코드로 재대조한다.',
    tourapiRefresh: USE_EXISTING_TOURAPI ? '기존 감사 결과 재사용' : '실시간 detailIntro2 재조회',
    caution: '운영시간은 원천 문구를 보존한 감사값이다. 추천 허용 시간대 정책을 자동으로 변경하지 않는다.',
  },
  summary: {
    total: data.length,
    tourapiQueried: data.filter((row) => row.tourapi.status !== 'not_applicable').length,
    tourapiRequestFailed: data.filter((row) => row.tourapi.status === 'request_failed').length,
    busanOfficialLinked: data.filter((row) => row.busanOfficial.length > 0).length,
    currentCatalogHours: data.filter((row) => row.currentCatalogHours.length > 0).length,
    sourceStructuredButCatalogEmpty: sourceStructuredButCatalogEmpty.length,
    sourceStructuredButCatalogEmptyBySource: countBy(sourceStructuredButCatalogEmpty, (row) => row.sourceKind),
    differentRawHours: differentRawHours.length,
    byFinalStatus: countBy(data, (row) => row.finalStatus),
    byCategory: countBy(data, (row) => row.category),
    bySourceKind: sourceSummary,
  },
  data,
};

write(OUTPUT_FILE, payload);
report(payload);
console.log(`운영시간 원천 감사 완료: ${data.length}개, TourAPI ${payload.summary.tourapiQueried}개 -> ${OUTPUT_FILE}`);
