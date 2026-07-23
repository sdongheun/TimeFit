#!/usr/bin/env node
// TourAPI 부산 장소 ↔ AI-Hub 부산 방문지 매칭 후보 마스터 생성
// 산출:
//   - data/processed/busan_matched_poi.json
//   - src/data/busan_matched_poi.json
// 사용: TOURAPI_KEY=... node scripts/build_busan_matched_poi.mjs
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.TOURAPI_KEY || process.env.EXPO_PUBLIC_TOURAPI_KEY;
if (!KEY) {
  console.error('TOURAPI_KEY 또는 EXPO_PUBLIC_TOURAPI_KEY 없음');
  process.exit(1);
}

const ROOT = path.resolve('data/aihub_donbu');
const OUT_PROCESSED = path.resolve('data/processed/busan_matched_poi.json');
const OUT_UNMATCHED = path.resolve('data/processed/busan_unmatched_tourapi.json');
const OUT_APP = path.resolve('src/data/busan_matched_poi.json');
const BASE = 'https://apis.data.go.kr/B551011/KorService2/areaBasedList2';
const COMMON = { serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json', areaCode: 6 };
const MATCH_RADIUS_M = 150;
const POI_THRESHOLD = 3;
const INCLUDE_FOOD = process.env.INCLUDE_FOOD === '1';
const DRY_RUN = process.env.DRY_RUN === '1';

// MVP 추천 후보: 둘러보기/쇼핑/문화/자연 중심. 음식점·숙박·축제·여행코스 제외.
const TOUR_TYPES = {
  12: '관광지',
  14: '문화시설',
  28: '레포츠',
  38: '쇼핑',
  ...(INCLUDE_FOOD ? { 39: '음식점' } : {}),
};

const TOUR_CATEGORY = {
  12: '자연관광지',
  14: '문화시설',
  28: '레저/스포츠',
  38: '상업지구',
  39: '식당/카페',
};
const FOODISH_TITLE_RE = /먹자골목|음식|식당|맛집|푸드|카페|커피|베이커리|제과|디저트|브런치/i;

// AI-Hub VIS 코드 중 자투리 시간에 둘러볼 후보만 허용.
// 제외: 9 역/터미널, 11 식당/카페, 21 집, 22 지인집, 23 사무실, 24 숙소, 8 축제
const AIHUB_VIS = {
  1: '자연관광지',
  2: '역사/유적/종교',
  3: '문화시설',
  4: '상업지구',
  5: '레저/스포츠',
  6: '테마시설',
  7: '산책로/둘레길',
  10: '상점',
  13: '체험활동관광지',
  ...(INCLUDE_FOOD ? { 11: '식당/카페' } : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (x) => {
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
};
const norm = (s) => (s || '')
  .replace(/\s+/g, '')
  .replace(/[()\[\]{}・·.,'"`’]/g, '')
  .toLowerCase();
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const quantile = (a, q) => {
  if (a.length < 2) return a[0] ?? null;
  const s = [...a].sort((x, y) => x - y);
  const p = (s.length - 1) * q;
  const lo = Math.floor(p), hi = Math.ceil(p);
  return s[lo] + (s[hi] - s[lo]) * (p - lo);
};
const r0 = (x) => x == null ? null : Math.round(x);

function haversineM(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const t = (d) => d * Math.PI / 180;
  const dLat = t(bLat - aLat), dLon = t(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(aLat)) * Math.cos(t(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function parseCSV(file) {
  const text = fs.readFileSync(file, 'utf-8');
  const rows = [];
  let row = [], cur = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const header = rows.shift()?.map((h) => h.replace(/^﻿/, '')) ?? [];
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function fetchTourBusan() {
  const out = [];
  for (const tid of Object.keys(TOUR_TYPES)) {
    let pageNo = 1, total = Infinity, got = 0;
    while (got < total) {
      const qs = new URLSearchParams({
        ...COMMON,
        contentTypeId: tid,
        numOfRows: 1000,
        pageNo,
        arrange: 'A',
      }).toString();
      const res = await fetch(`${BASE}?${qs}`);
      if (!res.ok) throw new Error(`TourAPI ${tid} HTTP ${res.status}`);
      let j;
      try { j = JSON.parse(await res.text()); }
      catch { throw new Error(`TourAPI ${tid} JSON 파싱 실패`); }
      const body = j?.response?.body;
      total = body?.totalCount ?? 0;
      let items = body?.items?.item;
      if (items && !Array.isArray(items)) items = [items];
      if (!items?.length) break;
      for (const it of items) {
        const lat = num(it.mapy), lon = num(it.mapx);
        if (lat == null || lon == null) continue;
        out.push({
          contentId: String(it.contentid ?? ''),
          contentTypeId: String(it.contenttypeid ?? tid),
          title: String(it.title ?? '').trim(),
          addr1: String(it.addr1 ?? '').trim(),
          lat,
          lon,
          dist: it.dist ? num(it.dist) : null,
        });
      }
      got += items.length;
      pageNo++;
      if (pageNo > 50) break;
      await sleep(80);
    }
  }
  return out.filter((p) => p.contentId && p.title && (INCLUDE_FOOD || !FOODISH_TITLE_RE.test(p.title)));
}

function loadAihubBusanPois() {
  const files = [
    path.join(ROOT, 'training/tn_visit_area_info_방문지정보_F.csv'),
    path.join(ROOT, 'validation/tn_visit_area_info_방문지정보_F.csv'),
  ];
  const pois = new Map();
  let busanRows = 0, usedRows = 0;

  for (const file of files) {
    for (const r of parseCSV(file)) {
      const addr = (r.ROAD_NM_ADDR || r.LOTNO_ADDR || '').trim();
      if (!addr.startsWith('부산')) continue;
      busanRows++;

      const cd = parseInt(r.VISIT_AREA_TYPE_CD, 10);
      const category = AIHUB_VIS[cd];
      if (!category) continue;

      const dwell = num(r.RESIDENCE_TIME_MIN);
      if (dwell == null || dwell <= 0 || dwell > 1440) continue;

      const lat = num(r.Y_COORD), lon = num(r.X_COORD);
      if (lat == null || lon == null) continue;

      const name = String(r.VISIT_AREA_NM || r.POI_NM || '').trim();
      if (!name) continue;

      usedRows++;
      const key = norm(name);
      if (!pois.has(key)) {
        pois.set(key, {
          key,
          name,
          category,
          dwell: [],
          lats: [],
          lons: [],
          aliases: new Set(),
        });
      }
      const p = pois.get(key);
      p.dwell.push(dwell);
      p.lats.push(lat);
      p.lons.push(lon);
      p.aliases.add(name);
      if (r.POI_NM) p.aliases.add(String(r.POI_NM).trim());
    }
  }

  const list = [];
  for (const p of pois.values()) {
    if (p.dwell.length < POI_THRESHOLD) continue;
    list.push({
      key: p.key,
      name: p.name,
      category: p.category,
      lat: median(p.lats),
      lon: median(p.lons),
      dwell: {
        count: p.dwell.length,
        median: r0(median(p.dwell)),
        p25: r0(quantile(p.dwell, 0.25)),
        p75: r0(quantile(p.dwell, 0.75)),
        mean: r0(mean(p.dwell)),
      },
      aliases: [...p.aliases].filter(Boolean).slice(0, 8),
    });
  }

  return { list, busanRows, usedRows };
}

function bestMatch(tour, aihub) {
  const tkey = norm(tour.title);
  let bestName = null;
  for (const a of aihub) {
    if (a.key === tkey || a.aliases.some((x) => norm(x) === tkey)) {
      const d = haversineM(tour.lat, tour.lon, a.lat, a.lon);
      bestName = { poi: a, matchType: d <= MATCH_RADIUS_M ? 'name+coord' : 'name', distanceM: r0(d), score: d <= MATCH_RADIUS_M ? 0 : 1000 + d };
      break;
    }
  }

  let bestCoord = null;
  for (const a of aihub) {
    const d = haversineM(tour.lat, tour.lon, a.lat, a.lon);
    if (d <= MATCH_RADIUS_M && (!bestCoord || d < bestCoord.distanceM)) {
      bestCoord = { poi: a, matchType: 'coord', distanceM: r0(d), score: d };
    }
  }

  if (bestName && bestCoord && bestName.poi.key === bestCoord.poi.key) {
    return { ...bestCoord, matchType: 'name+coord' };
  }
  const candidates = [bestName, bestCoord].filter(Boolean).sort((a, b) => a.score - b.score);
  return candidates[0] ?? null;
}

function assertOutput(payload) {
  let fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) console.log(`  PASS ${name}`);
    else { console.log(`  FAIL ${name} ${detail}`); fail++; }
  };

  const rows = payload.data;
  ok('매칭 후보 1개 이상', rows.length > 0, `count=${rows.length}`);
  ok('모든 후보 부산 주소', rows.every((r) => r.addr1.startsWith('부산')), '부산 외 주소 포함');
  ok(
    INCLUDE_FOOD ? '숙박/축제/여행코스 제외' : '음식점/숙박/축제/여행코스 제외',
    rows.every((r) => (INCLUDE_FOOD ? ['12', '14', '28', '38', '39'] : ['12', '14', '28', '38']).includes(r.contentTypeId)),
  );
  ok('체류 중앙값 10~1440분', rows.every((r) => r.dwell.median >= 10 && r.dwell.median <= 1440));
  ok(`AI-Hub 표본 count>=${POI_THRESHOLD}`, rows.every((r) => r.dwell.count >= POI_THRESHOLD));
  ok('contentId 중복 없음', new Set(rows.map((r) => r.contentId)).size === rows.length);

  return fail;
}

const tour = await fetchTourBusan();
const { list: aihub, busanRows, usedRows } = loadAihubBusanPois();
console.log(`TourAPI 부산 후보 ${tour.length}건 / AI-Hub 부산 후보 POI ${aihub.length}개`);

const matched = [];
const unmatched = [];
const byType = {};
for (const t of tour) {
  byType[t.contentTypeId] ||= { total: 0, matched: 0 };
  byType[t.contentTypeId].total++;
  const m = bestMatch(t, aihub);
  if (!m) {
    unmatched.push({
      contentId: t.contentId,
      title: t.title,
      contentTypeId: t.contentTypeId,
      contentTypeName: TOUR_TYPES[t.contentTypeId],
      category: TOUR_CATEGORY[t.contentTypeId],
      addr1: t.addr1,
      lat: t.lat,
      lon: t.lon,
      reason: `AI-Hub 부산 후보 POI와 ${MATCH_RADIUS_M}m 이내 좌표 매칭 또는 이름 매칭 없음`,
    });
    continue;
  }
  byType[t.contentTypeId].matched++;
  matched.push({
    contentId: t.contentId,
    title: t.title,
    contentTypeId: t.contentTypeId,
    contentTypeName: TOUR_TYPES[t.contentTypeId],
    category: TOUR_CATEGORY[t.contentTypeId],
    addr1: t.addr1,
    lat: t.lat,
    lon: t.lon,
    aihubName: m.poi.name,
    aihubCategory: m.poi.category,
    matchType: m.matchType,
    matchDistanceM: m.distanceM,
    dwell: m.poi.dwell,
  });
}

matched.sort((a, b) => {
  if (b.dwell.count !== a.dwell.count) return b.dwell.count - a.dwell.count;
  return a.title.localeCompare(b.title, 'ko');
});

const typeSummary = Object.fromEntries(Object.entries(byType).map(([tid, s]) => [
  tid,
  {
    name: TOUR_TYPES[tid],
    total: s.total,
    matched: s.matched,
    rate: s.total ? Math.round((s.matched / s.total) * 1000) / 10 : 0,
  },
]));

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    targetRegion: '부산',
    targetUser: '출장/여행 중 약속 전 자투리 시간이 있는 직장인',
    maxGapMin: 240,
    maxSpotsPerCourse: 2,
    source: 'TourAPI KorService2 areaBasedList2(areaCode=6) + AI-Hub 국내여행로그 동부권 training/validation',
    matchRadiusM: MATCH_RADIUS_M,
    poiThreshold: POI_THRESHOLD,
    includedTourContentTypes: TOUR_TYPES,
    excluded: INCLUDE_FOOD
      ? ['숙박(32)', '축제공연행사(15)', '여행코스(25)', 'AI-Hub 역/터미널(9)']
      : ['음식점(39)', '숙박(32)', '축제공연행사(15)', '여행코스(25)', 'AI-Hub 식당/카페(11)', 'AI-Hub 역/터미널(9)'],
    excludedTitleKeywords: INCLUDE_FOOD ? [] : ['먹자골목', '음식', '식당', '맛집', '푸드', '카페', '커피', '베이커리', '제과', '디저트', '브런치'],
    note: 'AI-Hub 원본 미탑재. 부산 TourAPI 장소 중 AI-Hub 부산 방문지와 매칭된 둘러보기 후보만 앱 번들용 집계 파라미터로 사용.',
  },
  summary: {
    tourCandidates: tour.length,
    aihubBusanRows: busanRows,
    aihubUsedRows: usedRows,
    aihubCandidatePois: aihub.length,
    matched: matched.length,
    byType: typeSummary,
  },
  data: matched,
  byContentId: Object.fromEntries(matched.map((p) => [p.contentId, p])),
};

const unmatchedPayload = {
  meta: {
    generatedAt: payload.meta.generatedAt,
    targetRegion: payload.meta.targetRegion,
    source: payload.meta.source,
    matchRadiusM: MATCH_RADIUS_M,
    includedTourContentTypes: TOUR_TYPES,
    note: 'TourAPI 부산 후보 중 현재 AI-Hub 부산 방문지와 매칭되지 않아 추천 후보에서 제외된 장소 목록.',
  },
  summary: {
    tourCandidates: tour.length,
    matched: matched.length,
    unmatched: unmatched.length,
    byType: Object.fromEntries(Object.entries(typeSummary).map(([tid, s]) => [
      tid,
      { ...s, unmatched: s.total - s.matched },
    ])),
  },
  data: unmatched,
  byContentId: Object.fromEntries(unmatched.map((p) => [p.contentId, p])),
};

console.log('\n=== 검증 ===');
const fail = assertOutput(payload);
if (fail > 0) {
  console.error(`\n${fail}건 실패`);
  process.exit(1);
}

if (!DRY_RUN) {
  fs.mkdirSync(path.dirname(OUT_PROCESSED), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_APP), { recursive: true });
  fs.writeFileSync(OUT_PROCESSED, JSON.stringify(payload, null, 2));
  fs.writeFileSync(OUT_UNMATCHED, JSON.stringify(unmatchedPayload, null, 2));
  fs.writeFileSync(OUT_APP, JSON.stringify(payload, null, 2));
}

console.log('\n=== 산출 ===');
if (DRY_RUN) {
  console.log('  DRY_RUN=1 — 파일 저장 안 함');
} else {
  console.log(`  ${OUT_PROCESSED}`);
  console.log(`  ${OUT_UNMATCHED}`);
  console.log(`  ${OUT_APP}`);
}
console.log(`  매칭 ${matched.length}/${tour.length}건`);
console.log(`  미매칭 ${unmatched.length}/${tour.length}건`);
for (const [tid, s] of Object.entries(typeSummary)) {
  console.log(`  ${tid} ${s.name}: ${s.matched}/${s.total} (${s.rate}%)`);
}
