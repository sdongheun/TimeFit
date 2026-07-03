// Phase A 보조 — 타임라인 재구성 가능성 프로브 (Phase B 실현성 확인)
import fs from 'node:fs';
const parse = (l) => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const gi = (a, n) => a.indexOf(n);

const mv = fs.readFileSync('data/aihub_donbu/training/tn_move_his_이동내역_F.csv', 'utf-8').split(/\r?\n/);
const mh = parse(mv[0]);
console.log('move 헤더:', mh.join(' | '));
for (let i = 1; i < 5; i++) console.log('  ', parse(mv[i]).join(' | '));

const va = fs.readFileSync('data/aihub_donbu/training/tn_visit_area_info_방문지정보_F.csv', 'utf-8').split(/\r?\n/);
const vh = parse(va[0]);
console.log('\nvisit VISIT_START_YMD 샘플:', [2, 3, 4].map((i) => parse(va[i])[gi(vh, 'VISIT_START_YMD')]).join(' , '));

// 도착시각 맵: TRAVEL|END_VISIT_AREA -> END_DT_MIN
const iT = gi(mh, 'TRAVEL_ID'), iE = gi(mh, 'END_VISIT_AREA_ID'), iED = gi(mh, 'END_DT_MIN');
const arr = new Map();
for (let i = 1; i < mv.length; i++) { if (!mv[i]) continue; const c = parse(mv[i]); const a = (c[iE] || '').trim(), d = (c[iED] || '').trim(); if (a && d.includes(' ')) arr.set(c[iT] + '|' + a, d); }
console.log('도착시각 매핑 수:', arr.size);

const jT = gi(vh, 'TRAVEL_ID'), jA = gi(vh, 'VISIT_AREA_ID'), jO = gi(vh, 'VISIT_ORDER'),
  jR = gi(vh, 'RESIDENCE_TIME_MIN'), jX = gi(vh, 'X_COORD'), jY = gi(vh, 'Y_COORD');
const trav = new Map();
for (let i = 1; i < va.length; i++) {
  if (!va[i]) continue; const c = parse(va[i]); const t = c[jT];
  if (!trav.has(t)) trav.set(t, []);
  trav.get(t).push({ aid: (c[jA] || '').trim(), ord: +c[jO], res: parseFloat(c[jR]), x: parseFloat(c[jX]), y: parseFloat(c[jY]) });
}

const toMin = (s) => { const [d, t] = s.split(' '); const [Y, M, D] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return Date.UTC(Y, M - 1, D, h, mi) / 60000; };
let pairs = 0, pairsTime = 0, posTravel = 0, pairsCoord = 0;
const travels = [...trav.values()].filter((v) => v.length >= 2).length;
for (const [t, vs] of trav) {
  vs.sort((a, b) => a.ord - b.ord);
  for (let i = 0; i + 1 < vs.length; i++) {
    pairs++; const A = vs[i], B = vs[i + 1];
    const aA = arr.get(t + '|' + A.aid), aB = arr.get(t + '|' + B.aid);
    if (aA && aB && Number.isFinite(A.res)) { pairsTime++; const tr = toMin(aB) - toMin(aA) - A.res; if (tr > 0 && tr < 600) posTravel++; }
    if (Number.isFinite(A.x) && Number.isFinite(B.x)) pairsCoord++;
  }
}
console.log('\n여행 수(방문≥2):', travels, '/ 전체 여행:', trav.size);
console.log('총 인접 방문쌍:', pairs);
console.log('도착+체류로 이동시간 재구성 가능 쌍:', pairsTime, `(${(100 * pairsTime / pairs).toFixed(1)}%)`);
console.log('  그중 이동시간 양수(0~600분) 유효:', posTravel, `(${(100 * posTravel / pairs).toFixed(1)}%)`);
console.log('양끝 좌표 보유 쌍(거리 대조 가능):', pairsCoord, `(${(100 * pairsCoord / pairs).toFixed(1)}%)`);
