import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf8'));
const KEY = process.env.EXPO_PUBLIC_TOURAPI_KEY || '';
const KOR = 'https://apis.data.go.kr/B551011/KorService2';

const HOUR_FIELDS = {
  12: 'usetime',
  14: 'usetimeculture',
  15: 'usetimefestival',
  28: 'usetimeleports',
  38: 'opentime',
  39: 'opentimefood',
};

const REST_FIELDS = {
  12: 'restdate',
  14: 'restdateculture',
  28: 'openperiod',
  38: 'restdateshopping',
  39: 'restdatefood',
};

const EXCLUDED_CATEGORIES = new Set(['자연관광지']);

const places = [
  ...catalog.matched.data.map((p) => ({ ...p, group: 'matched' })),
  ...catalog.unmatched.data.map((p) => ({ ...p, group: 'unmatched' })),
].filter((p) => !EXCLUDED_CATEGORIES.has(p.category));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clean(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOpen(text) {
  const value = clean(text);
  if (!value) return false;
  if (/24시간|상시|always/i.test(value)) return true;
  return /(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/.test(value);
}

function initBucket() {
  return {
    total: 0,
    detail: 0,
    hourField: 0,
    hourNonEmpty: 0,
    parseable: 0,
    restNonEmpty: 0,
    examplesMissing: [],
    examplesUnparseable: [],
  };
}

function addExample(list, example) {
  if (list.length < 5) list.push(example);
}

function bucket(summary, key) {
  summary[key] ??= initBucket();
  return summary[key];
}

async function detailIntro(place) {
  const qs = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: 'ETC',
    MobileApp: 'TimeFit',
    _type: 'json',
    contentId: String(place.contentId),
    contentTypeId: String(place.contentTypeId),
  });
  const res = await fetch(`${KOR}/detailIntro2?${qs}`);
  const json = await res.json().catch(() => ({}));
  let item = json?.response?.body?.items?.item;
  if (Array.isArray(item)) item = item[0];
  return item || null;
}

function compact(summary) {
  return Object.fromEntries(
    Object.entries(summary)
      .sort()
      .map(([key, value]) => [
        key,
        {
          total: value.total,
          detail: value.detail,
          hourNonEmpty: value.hourNonEmpty,
          parseable: value.parseable,
          restNonEmpty: value.restNonEmpty,
          examplesMissing: value.examplesMissing,
          examplesUnparseable: value.examplesUnparseable,
        },
      ]),
  );
}

async function main() {
  if (!KEY) throw new Error('EXPO_PUBLIC_TOURAPI_KEY is missing');

  const summary = {
    byGroup: {},
    byCategory: {},
    byGroupCategory: {},
    byType: {},
  };

  for (const [index, place] of places.entries()) {
    const type = String(place.contentTypeId);
    const item = await detailIntro(place);
    const buckets = [
      bucket(summary.byGroup, place.group),
      bucket(summary.byCategory, place.category),
      bucket(summary.byGroupCategory, `${place.group}|${place.category}|${type}`),
      bucket(summary.byType, type),
    ];

    for (const b of buckets) b.total += 1;
    if (item) for (const b of buckets) b.detail += 1;

    const hourField = HOUR_FIELDS[type];
    const restField = REST_FIELDS[type];
    const hour = clean(hourField ? item?.[hourField] : '');
    const rest = clean(restField ? item?.[restField] : '');

    if (hourField) for (const b of buckets) b.hourField += 1;
    if (hour) for (const b of buckets) b.hourNonEmpty += 1;
    if (hour && parseOpen(hour)) for (const b of buckets) b.parseable += 1;
    if (rest) for (const b of buckets) b.restNonEmpty += 1;

    const baseExample = {
      title: place.title,
      contentId: place.contentId,
      type,
      category: place.category,
      group: place.group,
    };
    if (!hour) {
      for (const b of buckets) addExample(b.examplesMissing, baseExample);
    } else if (!parseOpen(hour)) {
      for (const b of buckets) addExample(b.examplesUnparseable, { ...baseExample, hour: hour.slice(0, 120) });
    }

    if ((index + 1) % 50 === 0) {
      console.error(`[opening-hours] ${index + 1}/${places.length}`);
    }
    await sleep(40);
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    excludedCategories: [...EXCLUDED_CATEGORIES],
    total: places.length,
    summary: {
      byGroup: compact(summary.byGroup),
      byCategory: compact(summary.byCategory),
      byGroupCategory: compact(summary.byGroupCategory),
      byType: compact(summary.byType),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
