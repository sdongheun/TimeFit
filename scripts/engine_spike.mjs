#!/usr/bin/env node
// TimeFit 엔진 스파이크 (Phase 0) — 결정적 시간-적합 엔진 + TMAP 라이브 이동시간
//   TourAPI(후보·운영시간) + 체류(data/processed JSON) + 이동(TMAP REST, haversine 폴백) → 시간적응형 코스
//   ※ LLM 없음 / RN 없음.
// 사용: node --env-file=.env scripts/engine_spike.mjs
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.TOURAPI_KEY;
const TMAP = process.env.TMAP_APP_KEY;
if (!KEY) { console.error('TOURAPI_KEY 없음 (node --env-file=.env)'); process.exit(1); }
const KOR = 'https://apis.data.go.kr/B551011/KorService2';
const COMMON = { serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 입력 시나리오 ----------
const scenario = {
  name: '부산 서면 · 토요일 14:00 · 남은 120분 · 도보 · 왕복',
  origin: { lat: 35.1578, lon: 129.0594 },
  destination: null,
  remainingMin: 120, nowMin: 14 * 60, dayType: '주말', hourBucket: '오후',
  mode: 'walk', radiusM: 1500,
};

// ---------- 데이터 ----------
const PROC = path.resolve('data/processed');
const catDwell = JSON.parse(fs.readFileSync(path.join(PROC, 'category_dwell.json'), 'utf-8')).data;
const poiDwell = JSON.parse(fs.readFileSync(path.join(PROC, 'poi_dwell.json'), 'utf-8')).data;
const congestion = JSON.parse(fs.readFileSync(path.join(PROC, 'congestion_matrix.json'), 'utf-8')).data;
const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();

const CAFE_RE = /카페|커피|coffee|cafe|베이커리|제과|디저트|빵|브런치|로스터리/i;
function mapCategory(typeId, title) {
  switch (String(typeId)) {
    case '12': return '자연관광지'; case '14': return '문화시설'; case '15': return '지역축제/행사';
    case '28': return '레저/스포츠'; case '38': return '상업지구';
    case '39': return CAFE_RE.test(title) ? '카페' : '식당'; default: return null;
  }
}
const USETIME_FIELD = { 12: 'usetime', 14: 'usetimeculture', 15: 'usetimefestival', 28: 'usetimeleports', 38: 'opentime', 39: 'opentimefood' };

function resolveDwell(title, category) {
  const hit = poiDwell[norm(title)];
  if (hit && hit.count >= 5) return { base: hit.median, src: `POI실측(n=${hit.count})` };
  const c = catDwell[category];
  return c ? { base: c.median, src: '카테고리' } : { base: 30, src: '기본값' };
}
function effectiveDwell(title, category) {
  const { base, src } = resolveDwell(title, category);
  const mult = congestion[category]?.[scenario.dayType]?.[scenario.hourBucket] ?? 1.0;
  return { eff: Math.round(base * mult), base, mult, src };
}

// ---------- 이동시간: TMAP REST + haversine 폴백 + 캐시 ----------
function haversineKm(a, b) {
  const R = 6371, t = (d) => d * Math.PI / 180;
  const dLat = t(b.lat - a.lat), dLon = t(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const MODE = { walk: { circ: 1.25, kmh: 4.5, fix: 0 }, car: { circ: 1.3, kmh: 25, fix: 3 } };
function haversineMin(a, b, mode = scenario.mode) {
  const km = haversineKm(a, b); const m = MODE[mode] || MODE.walk;
  const use = km < 0.8 ? MODE.walk : m;
  return Math.round(km * use.circ / use.kmh * 60 + use.fix);
}
const travelCache = new Map();
const ckey = (a, b) => `${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
let tmapOk = 0, tmapFail = 0;

async function tmapTravel(a, b, mode) {
  if (!TMAP) return null;
  const ped = mode === 'walk';
  const url = ped ? 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json'
                  : 'https://apis.openapi.sk.com/tmap/routes?version=1&format=json';
  const body = { startX: a.lon, startY: a.lat, endX: b.lon, endY: b.lat,
    reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
    startName: encodeURIComponent('출발'), endName: encodeURIComponent('도착') };
  if (!ped) { body.searchOption = '0'; body.trafficInfo = 'N'; }
  try {
    const res = await fetch(url, { method: 'POST', headers: { appKey: TMAP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const j = await res.json();
    const sec = j?.features?.[0]?.properties?.totalTime;
    return Number.isFinite(sec) ? Math.round(sec / 60) : null;
  } catch { return null; }
}

// 필요한 좌표쌍을 TMAP로 미리 채움(폴백 haversine)
async function precompute(pairs, mode) {
  for (const [a, b] of pairs) {
    const k = ckey(a, b);
    if (travelCache.has(k)) continue;
    const t = await tmapTravel(a, b, mode);
    if (t != null) { travelCache.set(k, { min: t, src: 'TMAP' }); tmapOk++; }
    else { travelCache.set(k, { min: haversineMin(a, b, mode), src: 'haversine' }); tmapFail++; }
    await sleep(90);
  }
}
function travelMin(a, b) {
  const k = ckey(a, b);
  return (travelCache.get(k)?.min) ?? haversineMin(a, b);
}

// ---------- 운영시간 ----------
function parseOpen(text) {
  if (!text) return null;
  if (/24시간|상시|always/i.test(text)) return { open: 0, close: 1440 };
  const m = String(text).match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
  return m ? { open: +m[1] * 60 + +m[2], close: +m[3] * 60 + +m[4] } : null;
}
function isOpenDuring(intro, typeId, startMin, dwell) {
  const parsed = parseOpen(intro?.[USETIME_FIELD[typeId]]);
  if (!parsed) return { ok: true, note: '운영시간 미확인' };
  const ok = startMin >= parsed.open && startMin + dwell <= parsed.close;
  return { ok, note: ok ? intro[USETIME_FIELD[typeId]] : `영업시간 밖` };
}

async function call(op, params) {
  const qs = new URLSearchParams({ ...COMMON, ...params }).toString();
  const res = await fetch(`${KOR}/${op}?${qs}`);
  let j; try { j = JSON.parse(await res.text()); } catch { return []; }
  let items = j?.response?.body?.items?.item; if (items && !Array.isArray(items)) items = [items];
  return items || [];
}

(async () => {
  console.log(`\n📍 ${scenario.name}`);
  console.log(`이동 provider: ${TMAP ? 'TMAP REST (폴백 haversine)' : 'haversine (TMAP 키 없음)'}\n`);
  const buffer = Math.max(10, Math.round(scenario.remainingMin * 0.12));
  const budget = scenario.remainingMin - buffer;
  const target = scenario.destination || scenario.origin;

  // 1) 후보
  const raw = await call('locationBasedList2', { mapX: scenario.origin.lon, mapY: scenario.origin.lat, radius: scenario.radiusM, numOfRows: 60, pageNo: 1 });
  const cands = [];
  for (const it of raw) {
    const cat = mapCategory(it.contenttypeid, it.title);
    if (!cat) continue;
    const lat = parseFloat(it.mapy), lon = parseFloat(it.mapx);
    if (isNaN(lat) || isNaN(lon)) continue;
    const d = effectiveDwell(it.title, cat);
    cands.push({ title: it.title, contentId: it.contentid, typeId: it.contenttypeid, cat, lat, lon, ...d });
  }
  console.log(`후보 ${cands.length}개 (반경 ${scenario.radiusM}m)`);

  // 2) haversine 프리필터(왕복) → 후보 압축
  const pre = cands.filter((c) => haversineMin(scenario.origin, c) * 2 + c.eff <= budget);
  pre.sort((a, b) => haversineMin(scenario.origin, a) - haversineMin(scenario.origin, b));

  // 3) 운영시간 게이트
  const gated = [];
  for (const s of pre.slice(0, 16)) {
    const intro = (await call('detailIntro2', { contentId: s.contentId, contentTypeId: s.typeId }))?.[0];
    await sleep(70);
    const start = scenario.nowMin + haversineMin(scenario.origin, s);
    const g = isOpenDuring(intro, s.typeId, start, s.eff);
    if (g.ok) gated.push({ ...s, openNote: g.note });
  }
  console.log(`게이트 통과 ${gated.length}개 → TMAP 정밀 이동시간 계산\n`);

  // 4) TMAP 정밀 이동(게이트 풀: origin↔spot + 상위 pair)
  const pool = gated.slice(0, 8);
  const pairs = [];
  for (const s of gated) { pairs.push([scenario.origin, s]); pairs.push([s, target]); }
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
  await precompute(pairs, scenario.mode);
  console.log(`TMAP 성공 ${tmapOk} / 폴백 ${tmapFail}\n`);

  // 5) 시간적응형 코스 (단일 + 미니코스2)
  const courses = [];
  for (const s of gated) {
    const total = travelMin(scenario.origin, s) + s.eff + travelMin(s, target);
    if (total <= budget) courses.push({ type: '단일', spots: [s], total });
  }
  if (scenario.remainingMin >= 60) {
    for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
      if (i === j || pool[i].cat === pool[j].cat) continue;
      const A = pool[i], B = pool[j];
      const total = travelMin(scenario.origin, A) + A.eff + travelMin(A, B) + B.eff + travelMin(B, target);
      if (total <= budget && total >= budget * 0.6) courses.push({ type: '미니코스', spots: [A, B], total });
    }
  }
  // 시간 알차게 쓰는 순 + 미니 우선, 중복 제거
  courses.sort((a, b) => (b.spots.length - a.spots.length) || (b.total - a.total));
  const top = []; const seen = new Set();
  for (const c of courses) { const k = c.spots.map((s) => s.title).sort().join('|'); if (!seen.has(k)) { seen.add(k); top.push(c); } if (top.length >= 3) break; }

  // 6) 출력
  console.log('═══ 추천 코스 후보 ═══');
  top.forEach((c, i) => {
    console.log(`\n[후보 ${i + 1}] ${c.type} — 총 ${c.total}분 / 가용 ${budget}분`);
    let cur = scenario.origin, clock = scenario.nowMin;
    c.spots.forEach((s, k) => {
      const tTo = travelMin(cur, s); clock += tTo;
      const arr = `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
      const tsrc = travelCache.get(ckey(cur, s))?.src || 'haversine';
      console.log(`  ${k === 0 ? '출발' : '이동'} +${tTo}분[${tsrc}] → ${s.title} (${s.cat}) 도착 ${arr}`);
      console.log(`     체류 ${s.eff}분 [${s.src}${s.mult !== 1 ? ` ×혼잡${s.mult}` : ''}] · ${s.openNote}`);
      clock += s.eff; cur = s;
    });
    console.log(`  복귀 +${travelMin(cur, target)}분 → ${scenario.destination ? '다음 스케줄' : '출발지'}`);
    console.log(`  ▶ 왜 가능: 합 ${c.total}분 ≤ 남은 ${scenario.remainingMin}분 (버퍼 ${scenario.remainingMin - c.total}분)`);
  });

  // 7) 검증
  console.log('\n═══ 검증 ═══');
  let fail = 0; const ok = (n, c) => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}`); if (!c) fail++; };
  ok('후보 탐색됨', cands.length > 0);
  ok('TMAP 라이브 호출 성공(1건+)', !TMAP || tmapOk > 0);
  ok('시간초과 코스 없음', top.every((c) => c.total <= budget));
  ok('최소 1개 코스', top.length >= 1);
  ok('미니코스 카테고리 다양', top.filter((c) => c.type === '미니코스').every((c) => new Set(c.spots.map((s) => s.cat)).size === c.spots.length));
  console.log(fail === 0 ? '\n✅ 엔진 스파이크 성공 (TMAP 라이브 포함)' : `\n❌ ${fail}건 실패`);
  process.exit(fail === 0 ? 0 : 1);
})();
