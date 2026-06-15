#!/usr/bin/env node
// TourAPI areaBasedList2(부산, areaCode=6) ↔ AI-Hub 동부권 체류시간 데이터 매칭
// 부산 필터: AI-Hub는 주소 '부산' / TourAPI는 areaCode=6
// 매칭: 정규화 이름 일치 OR 좌표 근접(<150m)
// 사용: TOURAPI_KEY=... node scripts/match_busan.mjs
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const KEY = process.env.TOURAPI_KEY;
if (!KEY) { console.error('TOURAPI_KEY 없음'); process.exit(1); }
const BASE = 'https://apis.data.go.kr/B551011/KorService2/areaBasedList2';
const COMMON = { serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json', areaCode: 6 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) => (s || '').replace(/\s+/g, '').replace(/[()\[\]{}・·.,'"`’]/g, '').toLowerCase();
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, t = (d) => d * Math.PI / 180;
  const dLat = t(lat2 - lat1), dLon = t(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---- 1. TourAPI 부산 전체 POI (콘텐츠 타입별) ----
const TYPES = { 12: '관광지', 14: '문화시설', 15: '축제', 25: '여행코스', 28: '레포츠', 32: '숙박', 38: '쇼핑', 39: '음식점' };
async function fetchTourAPI() {
  const all = [];
  const byType = {};
  for (const tid of Object.keys(TYPES)) {
    let pageNo = 1, total = Infinity, got = 0;
    while (got < total) {
      const qs = new URLSearchParams({ ...COMMON, contentTypeId: tid, numOfRows: 1000, pageNo, arrange: 'A' }).toString();
      const res = await fetch(`${BASE}?${qs}`);
      let j; try { j = JSON.parse(await res.text()); } catch { break; }
      const body = j?.response?.body;
      total = body?.totalCount ?? 0;
      let items = body?.items?.item; if (items && !Array.isArray(items)) items = [items];
      if (!items || !items.length) break;
      for (const it of items) all.push({ title: it.title, x: parseFloat(it.mapx), y: parseFloat(it.mapy), type: tid });
      got += items.length; pageNo++;
      if (pageNo > 40) break;
      await sleep(80);
    }
    byType[tid] = total;
  }
  return { all, total: all.length, byType };
}

// ---- 2. AI-Hub 부산 고유 POI (체류시간) ----
function loadAihubBusan() {
  const files = [
    'data/aihub_donbu/training/tn_visit_area_info_방문지정보_F.csv',
    'data/aihub_donbu/validation/tn_visit_area_info_방문지정보_F.csv',
  ];
  const pois = new Map(); // normName -> {name, xs, ys, dwell[]}
  let visitRecords = 0;
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf-8').split(/\r?\n/);
    const hdr = txt[0].split(',');
    const ix = (n) => hdr.indexOf(n);
    const [iNm, iX, iY, iRes, iType, iRoad, iLot] =
      ['VISIT_AREA_NM', 'X_COORD', 'Y_COORD', 'RESIDENCE_TIME_MIN', 'VISIT_AREA_TYPE_CD', 'ROAD_NM_ADDR', 'LOTNO_ADDR'].map(ix);
    for (let i = 1; i < txt.length; i++) {
      const c = txt[i].split(',');
      if (c.length < hdr.length) continue;
      const addr = (c[iRoad] || c[iLot] || '').trim();
      if (!addr.startsWith('부산')) continue;
      const type = (c[iType] || '').trim();
      if (['21', '22', '23', '24', ''].includes(type)) continue; // 집/숙소/사무실 제외
      const nm = (c[iNm] || '').trim();
      const dwell = parseFloat(c[iRes]);
      if (!nm) continue;
      visitRecords++;
      const k = norm(nm);
      if (!pois.has(k)) pois.set(k, { name: nm, xs: [], ys: [], dwell: [] });
      const p = pois.get(k);
      const x = parseFloat(c[iX]), y = parseFloat(c[iY]);
      if (!isNaN(x)) p.xs.push(x); if (!isNaN(y)) p.ys.push(y);
      if (!isNaN(dwell) && dwell > 0 && dwell <= 1440) p.dwell.push(dwell);
    }
  }
  return { pois, visitRecords };
}

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

(async () => {
  console.log('TourAPI 부산 POI 수집 중...');
  const { all: tour, total, byType } = await fetchTourAPI();
  console.log(`TourAPI 부산(areaCode=6) 총 ${total}건`);
  console.log('  타입별:', Object.entries(byType).map(([t, n]) => `${TYPES[t]} ${n}`).join(' / '));
  const tourNames = new Map();
  for (const t of tour) { const k = norm(t.title); if (k && !tourNames.has(k)) tourNames.set(k, t); }
  const tourCoords = tour.filter((t) => !isNaN(t.x) && !isNaN(t.y));

  const { pois, visitRecords } = loadAihubBusan();
  console.log(`\nAI-Hub 부산: 방문 레코드 ${visitRecords}건, 고유 POI ${pois.size}개\n`);

  // --- 방향1: AI-Hub 체류 POI → TourAPI 존재 여부 ---
  let byName = 0, byCoord = 0, byEither = 0;
  const matched = [];
  const aihubPts = [];
  for (const [k, p] of pois) {
    const nameHit = tourNames.has(k);
    const px = median(p.xs), py = median(p.ys);
    if (px != null && py != null) aihubPts.push({ x: px, y: py });
    let coordHit = false;
    if (px != null && py != null) {
      for (const t of tourCoords) { if (haversine(py, px, t.y, t.x) < 150) { coordHit = true; break; } }
    }
    if (nameHit) byName++;
    if (coordHit) byCoord++;
    if (nameHit || coordHit) { byEither++; matched.push({ name: p.name, n: p.dwell.length, dwell: median(p.dwell), how: nameHit ? (coordHit ? '이름+좌표' : '이름') : '좌표' }); }
  }
  const N = pois.size;
  console.log('=== 방향1: AI-Hub 체류 POI(부산 고유) → TourAPI 매칭 ===');
  console.log(`전체 ${N}개 중`);
  console.log(`  이름 일치 ${byName} / 좌표<150m ${byCoord} / 둘 중 하나 ${byEither} (${(100 * byEither / N).toFixed(1)}%)`);
  console.log(`  → 측정한 부산 체류 POI의 ${(100 * byEither / N).toFixed(1)}%가 TourAPI에도 존재`);

  // --- 방향2: TourAPI POI → AI-Hub 체류 데이터 존재 여부 (직접 체류 부여 가능률) ---
  let tourWithDwell = 0;
  for (const t of tourCoords) {
    for (const a of aihubPts) { if (haversine(t.y, t.x, a.y, a.x) < 150) { tourWithDwell++; break; } }
  }
  console.log('\n=== 방향2: TourAPI 부산 POI → AI-Hub 체류 데이터 매칭 ===');
  console.log(`TourAPI 부산 ${total}개 중 AI-Hub 체류 보유(좌표<150m): ${tourWithDwell} (${(100 * tourWithDwell / total).toFixed(1)}%)`);
  console.log(`  → TourAPI 후보의 ${(100 * tourWithDwell / total).toFixed(1)}%는 직접 체류시간, 나머지 ${(100 * (total - tourWithDwell) / total).toFixed(1)}%는 카테고리 폴백`);

  console.log('\n=== 매치된 부산 POI 상위 15 (방문수) ===');
  const top = matched.sort((a, b) => b.n - a.n).slice(0, 15);
  top.forEach((m) => console.log(`  ${m.name}  방문 ${m.n}, 체류중앙 ${m.dwell}분 [${m.how}]`));

  fs.writeFileSync('data/aihub_donbu/busan_match.json', JSON.stringify({
    tourTotal: total, tourByType: byType, aihubVisitRecords: visitRecords, aihubUniquePOI: N,
    dir1_matchedByName: byName, dir1_matchedByCoord: byCoord, dir1_matchedEither: byEither,
    dir2_tourWithDwell: tourWithDwell,
    topMatched: matched.sort((a, b) => b.n - a.n).slice(0, 40),
  }, null, 2));
  console.log('\n저장: data/aihub_donbu/busan_match.json');
})();
