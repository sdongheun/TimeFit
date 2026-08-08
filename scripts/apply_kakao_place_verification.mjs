#!/usr/bin/env node
// 부산 POI catalog의 TourAPI 장소명이 Kakao Local에 존재하는지 사전 검증한다.
import fs from 'node:fs';
import path from 'node:path';

const KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY
  ?? process.env.KAKAO_REST_API_KEY
  ?? process.env.KaKao_REST_API_KEY;

if (!KEY) {
  console.error('EXPO_PUBLIC_KAKAO_REST_API_KEY 또는 KAKAO_REST_API_KEY 또는 KaKao_REST_API_KEY 없음');
  process.exit(1);
}

const MATCHED_FILE = path.resolve('data/processed/부산_매칭장소.json');
const UNMATCHED_FILE = path.resolve('data/processed/부산_미매칭_TourAPI장소.json');
const CATALOG_FILE = path.resolve('src/data/busan_poi_catalog.json');
const REPORT_FILE = path.resolve('data/processed/카카오_장소검증.json');
const CONCURRENCY = Math.max(1, Number(process.env.KAKAO_VERIFY_CONCURRENCY ?? 8));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const norm = (s = '') => String(s)
  .toLowerCase()
  .replace(/\[[^\]]*]|\([^)]*\)/g, '')
  .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
  .replace(/[^0-9a-z가-힣]/g, '');

function haversineM(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const t = (d) => d * Math.PI / 180;
  const dLat = t(bLat - aLat);
  const dLon = t(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(aLat)) * Math.cos(t(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function nameSimilar(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function isAreaLike(value) {
  return /시장|거리|골목|상권|마을|해수욕장|해변|공원|광장|지하상가|아울렛|백화점|마켓타운|먹자골목|로데오|수산물시장|종합시장|문화마을/.test(String(value ?? ''));
}

async function kakaoKeyword(place) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const qs = new URLSearchParams({
    query: place.title,
    x: String(place.lon),
    y: String(place.lat),
    radius: '20000',
    sort: 'distance',
    size: '10',
  });
  try {
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${qs}`, {
      headers: { Authorization: `KakaoAK ${KEY}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Kakao HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json?.documents) ? json.documents : [];
  } finally {
    clearTimeout(timeout);
  }
}

function classify(place, docs) {
  const candidates = docs
    .map((doc) => {
      const lat = Number(doc.y);
      const lon = Number(doc.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const distanceM = haversineM(place.lat, place.lon, lat, lon);
      return {
        placeId: doc.id || undefined,
        placeUrl: String(doc.place_url ?? '').replace(/^http:/, 'https:') || undefined,
        name: doc.place_name || doc.road_address_name || doc.address_name || '',
        address: doc.road_address_name || doc.address_name || '',
        distanceM,
        nameSimilar: nameSimilar(place.title, doc.place_name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.nameSimilar !== b.nameSimilar) return a.nameSimilar ? -1 : 1;
      return a.distanceM - b.distanceM;
    });

  const best = candidates[0];
  if (!best) {
    return { provider: 'kakao', status: 'not_found', checkedAt: new Date().toISOString() };
  }

  if (best.nameSimilar && best.distanceM <= 500) {
    return {
      provider: 'kakao',
      status: 'verified',
      placeId: best.placeId,
      placeUrl: best.placeUrl,
      matchedName: best.name,
      matchedAddress: best.address,
      distanceM: best.distanceM,
      checkedAt: new Date().toISOString(),
    };
  }

  if (best.nameSimilar && best.distanceM <= 1500) {
    return {
      provider: 'kakao',
      status: 'weak',
      placeId: best.placeId,
      placeUrl: best.placeUrl,
      matchedName: best.name,
      matchedAddress: best.address,
      distanceM: best.distanceM,
      checkedAt: new Date().toISOString(),
    };
  }

  if (best.distanceM <= 250) {
    return {
      provider: 'kakao',
      status: 'weak',
      placeId: best.placeId,
      placeUrl: best.placeUrl,
      matchedName: best.name,
      matchedAddress: best.address,
      distanceM: best.distanceM,
      checkedAt: new Date().toISOString(),
    };
  }

  const hasNear = candidates.some((item) => item.distanceM <= 300);
  const hasAreaContext = isAreaLike(place.title) || candidates.some((item) => isAreaLike(item.name));
  if ((hasNear || best.distanceM <= 900) && hasAreaContext) {
    return {
      provider: 'kakao',
      status: 'weak',
      placeId: best.placeId,
      placeUrl: best.placeUrl,
      matchedName: best.name,
      matchedAddress: best.address,
      distanceM: best.distanceM,
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    provider: 'kakao',
    status: 'not_found',
    matchedName: best.name,
    matchedAddress: best.address,
    distanceM: best.distanceM,
    checkedAt: new Date().toISOString(),
  };
}

function rewriteCollection(payload, verifications) {
  payload.data = (payload.data ?? []).map((place) => ({
    ...place,
    mapVerification: verifications.get(String(place.contentId)) ?? place.mapVerification,
  }));
  payload.byContentId = Object.fromEntries(payload.data.map((p) => [String(p.contentId), p]));
  payload.summary = {
    ...(payload.summary ?? {}),
    kakaoMapVerification: countBy(payload.data.map((p) => p.mapVerification?.status ?? 'unverified')),
  };
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function writeJson(file, payload) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

const matched = JSON.parse(fs.readFileSync(MATCHED_FILE, 'utf-8'));
const unmatched = JSON.parse(fs.readFileSync(UNMATCHED_FILE, 'utf-8'));
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
const rows = [...matched.data, ...unmatched.data];
const verifications = new Map();
let ok = 0;
let fail = 0;
let nextIndex = 0;

async function verifyPlace(index) {
  const place = rows[index];
  try {
    if (index === 0 || (index + 1) % 10 === 0) console.log(`Kakao 검증 진행 ${index + 1}/${rows.length}: ${place.title}`);
    const docs = await kakaoKeyword(place);
    const result = classify(place, docs);
    verifications.set(String(place.contentId), result);
    ok++;
    if ((index + 1) % 50 === 0) console.log(`Kakao 검증 ${index + 1}/${rows.length}`);
    await sleep(60);
  } catch (error) {
    fail++;
    verifications.set(String(place.contentId), {
      provider: 'kakao',
      status: 'unverified',
      error: error?.message ?? 'unknown',
      checkedAt: new Date().toISOString(),
    });
    await sleep(250);
  }
}

async function worker() {
  while (nextIndex < rows.length) {
    const index = nextIndex++;
    await verifyPlace(index);
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

rewriteCollection(matched, verifications);
rewriteCollection(unmatched, verifications);
catalog.matched = matched;
catalog.unmatched = unmatched;
catalog.summary = {
  ...(catalog.summary ?? {}),
  matchedKakaoMapVerification: matched.summary.kakaoMapVerification,
  unmatchedKakaoMapVerification: unmatched.summary.kakaoMapVerification,
};

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    provider: 'kakao',
    source: 'Kakao Local search keyword REST API',
    rule: 'verified=name similar and <=500m, weak=near/area context, not_found=exclude from recommendation',
  },
  summary: {
    total: rows.length,
    ok,
    fail,
    matched: matched.summary.kakaoMapVerification,
    unmatched: unmatched.summary.kakaoMapVerification,
  },
  data: rows.map((place) => ({
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    lat: place.lat,
    lon: place.lon,
    mapVerification: verifications.get(String(place.contentId)),
  })),
};

writeJson(MATCHED_FILE, matched);
writeJson(UNMATCHED_FILE, unmatched);
writeJson(CATALOG_FILE, catalog);
writeJson(REPORT_FILE, report);

console.log('카카오 장소 검증 완료');
console.log(report.summary);
