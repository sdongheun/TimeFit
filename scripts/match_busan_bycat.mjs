#!/usr/bin/env node
// 부산 매칭 카테고리별 분해: TourAPI 부산 POI 중 AI-Hub 체류시간 매칭 여부를 콘텐츠타입별로 집계
// (match_busan.mjs 로더 재사용, 방향2를 타입별로 쪼갬)
// 사용: TOURAPI_KEY=... node scripts/match_busan_bycat.mjs
import fs from 'node:fs';

const KEY = process.env.TOURAPI_KEY;
if (!KEY) { console.error('TOURAPI_KEY 없음'); process.exit(1); }
const BASE = 'https://apis.data.go.kr/B551011/KorService2/areaBasedList2';
const COMMON = { serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json', areaCode: 6 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { 12: '관광지', 14: '문화시설', 15: '축제공연행사', 25: '여행코스', 28: '레포츠', 32: '숙박', 38: '쇼핑', 39: '음식점' };
const norm = (s) => (s || '').replace(/\s+/g, '').replace(/[()\[\]{}・·.,'"`’]/g, '').toLowerCase();
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, t = (d) => d * Math.PI / 180;
  const dLat = t(lat2 - lat1), dLon = t(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

async function fetchTourAPI() {
  const all = [];
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
  }
  return all;
}

function loadAihubBusanPts() {
  const files = [
    'data/aihub_donbu/training/tn_visit_area_info_방문지정보_F.csv',
    'data/aihub_donbu/validation/tn_visit_area_info_방문지정보_F.csv',
  ];
  const pois = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf-8').split(/\r?\n/);
    const hdr = txt[0].split(',');
    const ix = (n) => hdr.indexOf(n);
    const [iNm, iX, iY, iType, iRoad, iLot] =
      ['VISIT_AREA_NM', 'X_COORD', 'Y_COORD', 'VISIT_AREA_TYPE_CD', 'ROAD_NM_ADDR', 'LOTNO_ADDR'].map(ix);
    for (let i = 1; i < txt.length; i++) {
      const c = txt[i].split(',');
      if (c.length < hdr.length) continue;
      const addr = (c[iRoad] || c[iLot] || '').trim();
      if (!addr.startsWith('부산')) continue;
      const type = (c[iType] || '').trim();
      if (['21', '22', '23', '24', ''].includes(type)) continue;
      const nm = (c[iNm] || '').trim(); if (!nm) continue;
      const k = norm(nm);
      if (!pois.has(k)) pois.set(k, { xs: [], ys: [] });
      const p = pois.get(k);
      const x = parseFloat(c[iX]), y = parseFloat(c[iY]);
      if (!isNaN(x)) p.xs.push(x); if (!isNaN(y)) p.ys.push(y);
    }
  }
  const pts = [];
  for (const p of pois.values()) { const px = median(p.xs), py = median(p.ys); if (px != null && py != null) pts.push({ x: px, y: py }); }
  return pts;
}

(async () => {
  console.log('TourAPI 부산 수집...');
  const tour = await fetchTourAPI();
  const aihubPts = loadAihubBusanPts();
  console.log(`TourAPI ${tour.length}건, AI-Hub 부산 좌표 POI ${aihubPts.length}개\n`);

  // 타입별 매칭/미매칭 집계
  const stat = {}; // tid -> {total, matched}
  for (const t of tour) {
    if (!stat[t.type]) stat[t.type] = { total: 0, matched: 0, noCoord: 0 };
    stat[t.type].total++;
    if (isNaN(t.x) || isNaN(t.y)) { stat[t.type].noCoord++; continue; }
    let hit = false;
    for (const a of aihubPts) { if (haversine(t.y, t.x, a.y, a.x) < 150) { hit = true; break; } }
    if (hit) stat[t.type].matched++;
  }

  let gTot = 0, gMatch = 0;
  const rows = [];
  for (const tid of Object.keys(TYPES)) {
    const s = stat[tid] || { total: 0, matched: 0, noCoord: 0 };
    gTot += s.total; gMatch += s.matched;
    const unmatched = s.total - s.matched;
    rows.push({ tid, name: TYPES[tid], total: s.total, matched: s.matched, unmatched, rate: s.total ? +(100 * s.matched / s.total).toFixed(1) : 0 });
  }

  console.log('=== 카테고리별 매칭(체류시간 실측 부여 가능) ===');
  console.log('타입\t\t전체\t매칭\t미매칭\t매칭률');
  for (const r of rows.sort((a, b) => b.unmatched - a.unmatched))
    console.log(`${r.name}\t${r.name.length < 4 ? '\t' : ''}${r.total}\t${r.matched}\t${r.unmatched}\t${r.rate}%`);
  console.log(`\n합계\t\t${gTot}\t${gMatch}\t${gTot - gMatch}\t${(100 * gMatch / gTot).toFixed(1)}%`);

  console.log('\n=== 미매칭(카테고리 폴백 의존) 41% 구성 ===');
  const unTot = gTot - gMatch;
  for (const r of rows.sort((a, b) => b.unmatched - a.unmatched))
    if (r.unmatched > 0) console.log(`  ${r.name}: ${r.unmatched}건 (미매칭 전체의 ${(100 * r.unmatched / unTot).toFixed(1)}%)`);

  fs.writeFileSync('data/aihub_donbu/busan_match_bycat.json', JSON.stringify({ tourTotal: gTot, matched: gMatch, rows }, null, 2));
  console.log('\n저장: data/aihub_donbu/busan_match_bycat.json');
})();
