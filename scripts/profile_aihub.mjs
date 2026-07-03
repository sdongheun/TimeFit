#!/usr/bin/env node
// Phase A — AI-Hub 동부권 데이터셋 전수 프로파일링
// 14개 테이블(training+validation) 행수·컬럼·채움률·조인키·타임스탬프 채움률 집계
// 사용: node scripts/profile_aihub.mjs   → data/aihub_donbu/dataset_profile.json + 콘솔 요약
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'data/aihub_donbu';
const DIRS = ['training', 'validation'];

// 파일명(접두) → 한글 설명
const DESC = {
  tc_codea: '코드 마스터 A (분류 코드값 사전)',
  tc_codeb: '코드 마스터 B (분류 코드값 사전)',
  tc_sgg: '시군구 코드',
  tn_activity_consume_his: '활동 소비내역',
  tn_activity_his: '활동내역 (방문지에서 한 활동)',
  tn_adv_consume_his: '사전 소비내역 (여행 전 지출)',
  tn_companion_info: '동반자 정보',
  tn_lodge_consume_his: '숙박 소비내역',
  tn_move_his: '⭐ 이동내역 (구간 출발/도착 시각)',
  tn_mvmn_consume_his: '이동수단 소비내역',
  tn_tour_photo: '관광사진',
  tn_travel: '여행 마스터 (여행 단위)',
  tn_traveller_master: '여행객 마스터 (인구통계)',
  tn_visit_area_info: '⭐ 방문지정보 (체류·좌표·순서)',
};
// 검증에 중요한 필드(타임스탬프·조인키)
const TIME_FIELDS = new Set(['START_DT_MIN', 'END_DT_MIN', 'VISIT_START_YMD', 'VISIT_END_YMD']);
const KEY_FIELDS = new Set(['TRAVEL_ID', 'VISIT_AREA_ID', 'TRIP_ID', 'START_VISIT_AREA_ID', 'END_VISIT_AREA_ID', 'TRAVELER_ID']);

function prefixOf(fname) {
  const base = fname.replace(/\.csv$/, '');
  // tn_xxx_한글_F → tn_xxx  /  tc_xxx_한글 → tc_xxx
  const m = base.match(/^((?:tn|tc)_[a-z_]+?)(?:_[가-힣].*)?(?:_F)?$/);
  return m ? m[1].replace(/_$/, '') : base;
}

// 간단 CSV 파서(따옴표 내 콤마 대응)
function parseLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
}

function profileFile(fp) {
  const txt = fs.readFileSync(fp, 'utf-8');
  const lines = txt.split(/\r?\n/);
  const header = parseLine(lines[0]);
  const nCol = header.length;
  const filled = new Array(nCol).fill(0);
  let rows = 0;
  const busanIdx = header.findIndex((h) => h === 'ROAD_NM_ADDR');
  const lotIdx = header.findIndex((h) => h === 'LOTNO_ADDR');
  let busanRows = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = parseLine(lines[i]);
    if (c.length < 2) continue;
    rows++;
    for (let j = 0; j < nCol; j++) if (c[j] != null && c[j].trim() !== '') filled[j]++;
    if (busanIdx >= 0) { const a = (c[busanIdx] || c[lotIdx] || '').trim(); if (a.startsWith('부산')) busanRows++; }
  }
  const cols = header.map((h, j) => ({ name: h, fill: rows ? +(100 * filled[j] / rows).toFixed(1) : 0 }));
  return { rows, nCol, cols, busanRows: busanIdx >= 0 ? busanRows : null };
}

const tables = {};
for (const dir of DIRS) {
  const files = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.csv'));
  for (const f of files) {
    const pre = prefixOf(f);
    const prof = profileFile(path.join(ROOT, dir, f));
    if (!tables[pre]) tables[pre] = { prefix: pre, desc: DESC[pre] || '(설명미정)', files: {}, cols: prof.cols };
    tables[pre].files[dir] = { rows: prof.rows, busanRows: prof.busanRows };
    // 컬럼 채움률은 dir별로 합산 평균 대신 training 기준(대표) 유지, validation은 행수만
    if (dir === 'training') tables[pre].cols = prof.cols;
  }
}

// 요약 출력
const order = Object.keys(tables).sort();
console.log('\n===== AI-Hub 동부권 데이터셋 전수 프로파일 =====\n');
console.log('테이블'.padEnd(26), 'train행'.padStart(9), 'valid행'.padStart(9), '부산행'.padStart(8), '컬럼', ' 설명');
let totalTrain = 0, totalValid = 0;
for (const pre of order) {
  const t = tables[pre];
  const tr = t.files.training?.rows || 0, va = t.files.validation?.rows || 0;
  const bu = (t.files.training?.busanRows || 0) + (t.files.validation?.busanRows || 0);
  totalTrain += tr; totalValid += va;
  console.log(pre.padEnd(26), String(tr).padStart(9), String(va).padStart(9),
    (t.files.training?.busanRows != null ? String(bu) : '-').padStart(8), String(t.cols.length).padStart(4), ' ' + t.desc);
}
console.log('\n합계 train:', totalTrain.toLocaleString(), '/ valid:', totalValid.toLocaleString());

// ⭐ 검증 핵심: move_his / visit_area 타임스탬프·조인키 채움률
console.log('\n===== ⭐ 시간-적합 검증 필수 필드 채움률(training) =====');
for (const pre of ['tn_move_his', 'tn_visit_area_info']) {
  const t = tables[pre]; if (!t) continue;
  console.log(`\n[${pre}] ${t.desc}`);
  for (const c of t.cols) {
    const mark = TIME_FIELDS.has(c.name) ? '⏱' : KEY_FIELDS.has(c.name) ? '🔑' : '  ';
    const bar = '█'.repeat(Math.round(c.fill / 5)).padEnd(20, '░');
    console.log(`  ${mark} ${c.name.padEnd(22)} ${bar} ${c.fill}%`);
  }
}

fs.writeFileSync(path.join(ROOT, 'dataset_profile.json'), JSON.stringify({ tables, totalTrain, totalValid }, null, 2));
console.log('\n저장: data/aihub_donbu/dataset_profile.json');
