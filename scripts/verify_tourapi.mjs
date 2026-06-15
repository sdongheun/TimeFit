#!/usr/bin/env node
// TourAPI 라이브 검증 — V1/V2: detailIntro2 시간필드 채움률, V3: 집중률(15128555) 실체 프로빙
// 사용: TOURAPI_KEY=... node scripts/verify_tourapi.mjs
// 키는 환경변수로만 주입(파일 하드코딩 금지).

const KEY = process.env.TOURAPI_KEY;
if (!KEY) { console.error('TOURAPI_KEY env 없음'); process.exit(1); }

const KOR = 'https://apis.data.go.kr/B551011/KorService2';
const COMMON = { serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json' };

// contentTypeId -> detailIntro2에서 확인할 시간 관련 필드들
const TIME_FIELDS = {
  12: ['usetime', 'restdate'],                       // 관광지 (spendtime 없음으로 추정)
  14: ['usetimeculture', 'restdateculture', 'spendtime'], // 문화시설
  25: ['taketime', 'distance', 'schedule'],          // 여행코스
  28: ['usetimeleports', 'openperiod'],              // 레포츠
  38: ['opentime', 'restdateshopping'],              // 쇼핑
  39: ['opentimefood', 'restdatefood'],              // 음식점
};
const TYPE_NAME = { 12: '관광지', 14: '문화시설', 25: '여행코스', 28: '레포츠', 38: '쇼핑', 39: '음식점' };
// 표본 지역(전국 대표): 1=서울 6=부산 39=제주 31=경기 32=강원
const AREAS = [1, 6, 39, 31, 32];
const SAMPLE_PER_TYPE = 30; // 타입별 detailIntro2 호출 표본 수

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(base, op, params) {
  const qs = new URLSearchParams({ ...COMMON, ...params }).toString();
  const url = `${base}/${op}?${qs}`;
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { return { ok: false, status: res.status, raw: text.slice(0, 300) }; }
  const header = json?.response?.header;
  const code = header?.resultCode;
  if (code && code !== '0000') return { ok: false, code, msg: header?.resultMsg, raw: text.slice(0, 200) };
  const body = json?.response?.body;
  let items = body?.items?.item;
  if (items && !Array.isArray(items)) items = [items];
  return { ok: true, items: items || [], total: body?.totalCount };
}

function nonEmpty(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '-' && s.toLowerCase() !== 'null';
}

async function gatherContentIds(typeId) {
  const ids = [];
  for (const areaCode of AREAS) {
    const r = await call(KOR, 'areaBasedList2', {
      contentTypeId: typeId, areaCode, numOfRows: 20, pageNo: 1, arrange: 'C',
    });
    if (!r.ok) { console.error(`  areaBasedList2 type=${typeId} area=${areaCode} 실패:`, r.code || r.status, r.msg || ''); continue; }
    for (const it of r.items) if (it.contentid) ids.push({ contentid: it.contentid, title: it.title, areaCode });
    await sleep(120);
  }
  return ids;
}

async function verifyFillRates() {
  console.log('\n=== V1/V2: detailIntro2 시간필드 채움률 (전국 표본) ===\n');
  const report = {};
  for (const typeId of Object.keys(TIME_FIELDS).map(Number)) {
    const fields = TIME_FIELDS[typeId];
    const counts = Object.fromEntries(fields.map((f) => [f, 0]));
    let listFail = false;
    let ids = await gatherContentIds(typeId);
    if (ids.length === 0) { listFail = true; }
    // 셔플 후 표본
    ids = ids.sort(() => 0.5 - 0.5).slice(0, SAMPLE_PER_TYPE);
    let n = 0;
    for (const { contentid } of ids) {
      const r = await call(KOR, 'detailIntro2', { contentId: contentid, contentTypeId: typeId });
      await sleep(120);
      if (!r.ok || r.items.length === 0) continue;
      const item = r.items[0];
      n++;
      for (const f of fields) if (nonEmpty(item[f])) counts[f]++;
    }
    const rates = Object.fromEntries(fields.map((f) => [f, n ? +(counts[f] / n * 100).toFixed(1) : null]));
    report[typeId] = { name: TYPE_NAME[typeId], sampled: n, listFail, rates };
    const rateStr = fields.map((f) => `${f}=${rates[f]}%(${counts[f]}/${n})`).join('  ');
    console.log(`[${typeId} ${TYPE_NAME[typeId]}] n=${n} ${listFail ? '(목록조회 실패!)' : ''}\n   ${rateStr}`);
  }
  return report;
}

async function probeCongestion() {
  console.log('\n=== V3: 집중률 15128555 프로빙 (오퍼레이션/응답 추정) ===\n');
  // 카탈로그상 오퍼레이션/파라미터 미확인 → 후보 경로/오퍼레이션 best-effort 프로빙
  const candidates = [
    { base: 'https://apis.data.go.kr/B551011/TatsCnctrRateService', op: 'tatsCnctrRatedList' },
    { base: 'https://apis.data.go.kr/B551011/TatsCnctrRateService1', op: 'tatsCnctrRatedList1' },
    { base: 'https://apis.data.go.kr/B551011/DataLabService', op: 'tarRlteTarService' },
  ];
  const results = [];
  for (const c of candidates) {
    const qs = new URLSearchParams({ ...COMMON, numOfRows: 3, pageNo: 1 }).toString();
    let status, snippet;
    try {
      const res = await fetch(`${c.base}/${c.op}?${qs}`);
      status = res.status;
      snippet = (await res.text()).slice(0, 160).replace(/\s+/g, ' ');
    } catch (e) { status = 'ERR'; snippet = String(e).slice(0, 120); }
    console.log(`  ${c.base}/${c.op} -> ${status} | ${snippet}`);
    results.push({ ...c, status, snippet });
    await sleep(150);
  }
  return results;
}

// 간이 테스트(규칙4): 검증 자체가 회귀로 재사용되도록 핵심 가정을 assert
function runAssertions(report) {
  console.log('\n=== 테스트(가정 점검) ===\n');
  const checks = [];
  const add = (name, pass, detail) => { checks.push({ name, pass, detail }); console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`); };
  // 가정A: 관광지(12)에 spendtime류 체류시간 필드가 응답에 없다(=설계상 자체 테이블 필요)
  const t12 = report[12];
  if (t12 && t12.sampled > 0) add('관광지(12) 체류시간 필드 부재 → 자체 테이블 필요', !('spendtime' in t12.rates), 'detailIntro2 관광지 응답에 spendtime 없음');
  // 가정B: 운영시간(usetime)이 모든 POI에 다 차있지 않다(파서+fallback 필요)
  if (t12 && t12.sampled > 0 && t12.rates.usetime !== null) add('관광지 usetime 채움률 < 100% → fallback 필요', t12.rates.usetime < 100, `usetime=${t12.rates.usetime}%`);
  return checks;
}

(async () => {
  const auth = await call(KOR, 'areaCode2', { numOfRows: 1 });
  if (!auth.ok) { console.error('인증/기본 호출 실패 — 키 또는 활용신청 확인:', auth.code, auth.msg, auth.raw); process.exit(2); }
  console.log('인증 OK (areaCode2 호출 성공)');
  const report = await verifyFillRates();
  const congestion = await probeCongestion();
  runAssertions(report);
  console.log('\n=== JSON 요약 ===');
  console.log(JSON.stringify({ report, congestion }, null, 2));
})();
