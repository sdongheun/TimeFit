#!/usr/bin/env node
// AI-Hub 동부권 여행로그 → 시간-적합 엔진 파라미터 산출
//   - category_dwell.json   : 카테고리별 체류시간(median/p25/p75/mean)  [식당↔카페 분리]
//   - congestion_matrix.json: 카테고리 × 요일타입 × 시간대 혼잡 배수(방문빈도 기반)
//   - poi_dwell.json        : 표본 충분(count>=THRESH) 개별 POI 체류시간
// 규칙4: 산출 후 자체 검증(assert) 통과해야 종료코드 0.
// 사용: node scripts/build_dwell.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('data/aihub_donbu');
const OUT = path.resolve('data/processed');
fs.mkdirSync(OUT, { recursive: true });

// ---------- CSV 파서 (따옴표 인지) ----------
function parseCSV(file) {
  const text = fs.readFileSync(file, 'utf-8');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* skip */ }
    else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const hdr = rows.shift();
  return rows.filter((r) => r.length === hdr.length).map((r) => Object.fromEntries(hdr.map((h, i) => [h.replace(/^﻿/, ''), r[i]])));
}

// ---------- VIS 코드표 (tc_codeb cd_a='VIS') ----------
const VIS = { 1: '자연관광지', 2: '역사/유적/종교', 3: '문화시설', 4: '상업지구', 5: '레저/스포츠', 6: '테마시설', 7: '산책로/둘레길', 8: '지역축제/행사', 9: '역/터미널/휴게소', 10: '상점', 11: '식당/카페', 12: '기타', 13: '체험활동관광지', 21: '집', 22: '친구/친지집', 23: '사무실', 24: '숙소' };
const EXCLUDE = new Set([21, 22, 23, 24]); // 추천 대상 아님
// 식당↔카페 분리 키워드
const CAFE_RE = /카페|커피|coffee|cafe|베이커리|제과|디저트|빵|브런치|로스터리|티라미수|티하우스|아이스크림|빙수/i;

// ---------- 통계 헬퍼 ----------
const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : null; };
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (a, q) => { if (a.length < 2) return a[0] ?? null; const s = [...a].sort((x, y) => x - y); const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r0 = (x) => x == null ? null : Math.round(x);

// ---------- 1. 데이터 적재 ----------
function loadVisits() {
  const rows = [];
  for (const sub of ['training', 'validation']) {
    const f = fs.readdirSync(path.join(ROOT, sub)).find((n) => n.startsWith('tn_visit_area_info'));
    if (f) rows.push(...parseCSV(path.join(ROOT, sub, f)));
  }
  return rows;
}
function loadArrivalHours() {
  // 복합키 (TRAVEL_ID|END_VISIT_AREA_ID) -> 도착 hour
  // ※ VISIT_AREA_ID는 여행 내 순번이라 단독으론 여행자 간 충돌 → TRAVEL_ID 포함 필수
  const map = new Map();
  for (const sub of ['training', 'validation']) {
    const f = fs.readdirSync(path.join(ROOT, sub)).find((n) => n.startsWith('tn_move_his'));
    if (!f) continue;
    for (const r of parseCSV(path.join(ROOT, sub, f))) {
      const aid = (r.END_VISIT_AREA_ID || '').trim();
      const dt = (r.END_DT_MIN || '').trim();
      if (aid && dt.includes(' ')) { const h = parseInt(dt.split(' ')[1].split(':')[0], 10); if (Number.isFinite(h)) map.set(`${r.TRAVEL_ID}|${aid}`, h); }
    }
  }
  return map;
}

// ---------- 2. 카테고리 분류 (식당/카페 분리) ----------
function categoryOf(cd, name) {
  if (cd === 11) return CAFE_RE.test(name || '') ? '카페' : '식당';
  return VIS[cd] || `코드${cd}`;
}
const HOUR_BUCKET = (h) => h == null ? null : (h < 11 ? '아침' : h < 14 ? '점심' : h < 17 ? '오후' : h < 21 ? '저녁' : '야간');
const BUCKETS = ['아침', '점심', '오후', '저녁', '야간'];
const dayType = (ymd) => { const d = new Date(ymd); const w = d.getDay(); return (w === 0 || w === 6) ? '주말' : '평일'; };

// ---------- 메인 ----------
const visits = loadVisits();
const arrival = loadArrivalHours();
console.log(`방문 레코드 ${visits.length} / 도착시각 매핑 ${arrival.size}`);

const catDwell = {};          // category -> dwell[]
const congestion = {};        // category -> {평일|주말 -> {bucket -> count}}
const poiAgg = new Map();     // normName -> {name, cat, dwell[], xs, ys}
const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();

let used = 0;
for (const v of visits) {
  const cd = parseInt(v.VISIT_AREA_TYPE_CD, 10);
  if (!Number.isFinite(cd) || EXCLUDE.has(cd)) continue;
  const t = num(v.RESIDENCE_TIME_MIN);
  if (t == null || t <= 0 || t > 1440) continue;
  used++;
  const cat = categoryOf(cd, v.VISIT_AREA_NM);
  (catDwell[cat] ||= []).push(t);

  // 혼잡: 요일타입 × 시간대 방문빈도
  const h = arrival.get(`${v.TRAVEL_ID}|${(v.VISIT_AREA_ID || '').trim()}`);
  const bucket = HOUR_BUCKET(h);
  if (bucket && v.VISIT_START_YMD) {
    const dt = dayType(v.VISIT_START_YMD);
    ((congestion[cat] ||= {})[dt] ||= {});
    congestion[cat][dt][bucket] = (congestion[cat][dt][bucket] || 0) + 1;
  }

  // POI 집계
  const k = norm(v.VISIT_AREA_NM);
  if (k) {
    if (!poiAgg.has(k)) poiAgg.set(k, { name: v.VISIT_AREA_NM, cat, dwell: [], xs: [], ys: [] });
    const p = poiAgg.get(k);
    p.dwell.push(t);
    const x = num(v.X_COORD), y = num(v.Y_COORD);
    if (x != null) p.xs.push(x); if (y != null) p.ys.push(y);
  }
}

// ---- category_dwell.json ----
const categoryDwell = {};
for (const [cat, arr] of Object.entries(catDwell)) {
  categoryDwell[cat] = { count: arr.length, median: r0(median(arr)), p25: r0(quantile(arr, 0.25)), p75: r0(quantile(arr, 0.75)), mean: r0(mean(arr)) };
}

// ---- congestion_matrix.json (배수: 셀빈도 / 균등기대, clamp 0.8~1.8) ----
const CLAMP = (x) => Math.max(0.8, Math.min(1.8, x));
const congestionMatrix = {};
for (const [cat, byDay] of Object.entries(congestion)) {
  congestionMatrix[cat] = {};
  for (const [dt, cells] of Object.entries(byDay)) {
    const total = Object.values(cells).reduce((a, b) => a + b, 0);
    const expected = total / BUCKETS.length;
    congestionMatrix[cat][dt] = {};
    for (const b of BUCKETS) {
      const c = cells[b] || 0;
      congestionMatrix[cat][dt][b] = c === 0 ? null : Math.round(CLAMP(c / expected) * 100) / 100;
    }
  }
}

// ---- poi_dwell.json (count>=THRESH) ----
const THRESH = 5;
const poiDwell = {};
for (const [k, p] of poiAgg) {
  if (p.dwell.length < THRESH) continue;
  poiDwell[k] = { name: p.name, category: p.cat, count: p.dwell.length, median: r0(median(p.dwell)), p25: r0(quantile(p.dwell, 0.25)), p75: r0(quantile(p.dwell, 0.75)), x: median(p.xs), y: median(p.ys) };
}

const meta = { source: 'AI-Hub 국내여행로그 동부권(2023구축)', generatedFrom: 'training+validation', visitRecords: visits.length, usedRecords: used, poiThreshold: THRESH, note: 'CC-BY-SA-4.0 — 집계 파라미터(앱 내장용). 출처표시 필수.' };
fs.writeFileSync(path.join(OUT, 'category_dwell.json'), JSON.stringify({ meta, data: categoryDwell }, null, 2));
fs.writeFileSync(path.join(OUT, 'congestion_matrix.json'), JSON.stringify({ meta, buckets: BUCKETS, data: congestionMatrix }, null, 2));
fs.writeFileSync(path.join(OUT, 'poi_dwell.json'), JSON.stringify({ meta, count: Object.keys(poiDwell).length, data: poiDwell }, null, 2));

console.log(`\n산출:`);
console.log(`  category_dwell.json  (${Object.keys(categoryDwell).length} 카테고리, used ${used})`);
console.log(`  congestion_matrix.json (${Object.keys(congestionMatrix).length} 카테고리)`);
console.log(`  poi_dwell.json (${Object.keys(poiDwell).length} POI, count>=${THRESH})`);

console.log('\n=== category_dwell 미리보기 (건수순) ===');
Object.entries(categoryDwell).sort((a, b) => b[1].count - a[1].count).forEach(([c, s]) => console.log(`  ${c.padEnd(14)} n=${String(s.count).padStart(5)}  median ${s.median}분 (p25 ${s.p25}/p75 ${s.p75})`));

// ================= 규칙4: 자체 검증 =================
console.log('\n=== 검증 테스트 ===');
let fail = 0;
const ok = (name, cond, detail = '') => { if (cond) console.log(`  PASS ${name}`); else { console.log(`  FAIL ${name} ${detail}`); fail++; } };

ok('used 레코드 20,000+ (집/숙소 제외 후)', used > 20000, `used=${used}`);
ok('도착시각 매핑 충분(15,000+)', arrival.size > 15000, `map=${arrival.size}`);
ok('식당/카페 분리됨(둘 다 존재)', categoryDwell['식당'] && categoryDwell['카페'], `식당=${!!categoryDwell['식당']} 카페=${!!categoryDwell['카페']}`);
ok('주요 카테고리 누락 없음', ['자연관광지', '식당', '카페', '역사/유적/종교', '문화시설'].every((c) => categoryDwell[c]?.count > 0));
const ranges = Object.entries(categoryDwell).every(([, s]) => s.median >= 5 && s.median <= 480);
ok('모든 median 5~480분 범위', ranges);
const ordered = Object.entries(categoryDwell).every(([, s]) => s.p25 <= s.median && s.median <= s.p75);
ok('p25 <= median <= p75', ordered);
const exclude = !['집', '숙소', '사무실', '친구/친지집'].some((c) => categoryDwell[c]);
ok('집/숙소/사무실 제외됨', exclude);
let multOk = true;
for (const cat of Object.values(congestionMatrix)) for (const dt of Object.values(cat)) for (const m of Object.values(dt)) if (m != null && (m < 0.8 || m > 1.8)) multOk = false;
ok('혼잡 배수 0.8~1.8 범위', multOk);
ok('식당 점심 혼잡 >= 평일 평균(피크 반영)', (congestionMatrix['식당']?.['주말']?.['점심'] ?? 1) >= 1.0, `=${congestionMatrix['식당']?.['주말']?.['점심']}`);
ok('poi_dwell 전부 count>=THRESH', Object.values(poiDwell).every((p) => p.count >= THRESH));

console.log(fail === 0 ? '\n✅ 전체 검증 통과' : `\n❌ ${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
