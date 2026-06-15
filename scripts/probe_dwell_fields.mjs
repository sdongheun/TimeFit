#!/usr/bin/env node
// per-POI 체류시간 정밀 프로빙: detailIntro2 전체 필드 덤프 + 시간표현 스캔 + detailInfo2(코스 구성지점)
// 목적: areaBasedList2로 나온 개별 관광지 각각에 "체류시간" 신호가 TourAPI 어딘가에 존재하는지 결정적으로 확인.
// 사용: TOURAPI_KEY=... node scripts/probe_dwell_fields.mjs

const KEY = process.env.TOURAPI_KEY;
if (!KEY) { console.error('TOURAPI_KEY env 없음'); process.exit(1); }
const KOR = 'https://apis.data.go.kr/B551011/KorService2';
const COMMON = { serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json' };
const TYPE_NAME = { 12: '관광지', 14: '문화시설', 25: '여행코스', 28: '레포츠', 38: '쇼핑', 39: '음식점' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(op, params) {
  const qs = new URLSearchParams({ ...COMMON, ...params }).toString();
  const res = await fetch(`${KOR}/${op}?${qs}`);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { return { ok: false, raw: text.slice(0, 200) }; }
  const h = json?.response?.header;
  if (h?.resultCode && h.resultCode !== '0000') return { ok: false, code: h.resultCode, msg: h.resultMsg };
  let items = json?.response?.body?.items?.item;
  if (items && !Array.isArray(items)) items = [items];
  return { ok: true, items: items || [] };
}

// 시간/소요 표현 탐지: "분", "시간", "소요", "약 N분", "N~M시간" 등
const TIME_RE = /(소요|체류|관람|소요시간|약\s*\d|\d+\s*분|\d+\s*시간|\d+\s*~\s*\d+)/;

async function dumpType(typeId, nPoi = 3) {
  console.log(`\n========== [${typeId} ${TYPE_NAME[typeId]}] ==========`);
  const list = await call('areaBasedList2', { contentTypeId: typeId, areaCode: 1, numOfRows: nPoi, pageNo: 2, arrange: 'C' });
  if (!list.ok) { console.log('  목록 실패:', list.code, list.msg); return; }
  for (const poi of list.items) {
    console.log(`\n● ${poi.title} (contentid=${poi.contentid})`);
    const intro = await call('detailIntro2', { contentId: poi.contentid, contentTypeId: typeId });
    await sleep(120);
    if (!intro.ok || !intro.items[0]) { console.log('   detailIntro2 없음'); continue; }
    const item = intro.items[0];
    // 전체 필드 중 값이 있는 것만, 시간표현 탐지 표시
    const keys = Object.keys(item).filter((k) => !['contentid', 'contenttypeid'].includes(k));
    for (const k of keys) {
      const v = String(item[k] ?? '').trim();
      if (!v) continue;
      const hit = TIME_RE.test(v) ? '  ⏱TIME?' : '';
      console.log(`   ${k}: ${v.slice(0, 90)}${hit}`);
    }
  }
}

async function dumpCourseInfo() {
  console.log(`\n========== 여행코스(25) detailInfo2 — 구성지점별 소요 확인 ==========`);
  const list = await call('areaBasedList2', { contentTypeId: 25, areaCode: 1, numOfRows: 2, pageNo: 1, arrange: 'C' });
  if (!list.ok) { console.log('  목록 실패'); return; }
  for (const poi of list.items) {
    console.log(`\n● 코스: ${poi.title} (contentid=${poi.contentid})`);
    const info = await call('detailInfo2', { contentId: poi.contentid, contentTypeId: 25 });
    await sleep(120);
    if (!info.ok) { console.log('   detailInfo2 실패:', info.code, info.msg); continue; }
    info.items.slice(0, 6).forEach((sub, i) => {
      const keys = Object.keys(sub).filter((k) => String(sub[k] ?? '').trim());
      console.log(`   [${i}] ${keys.map((k) => `${k}=${String(sub[k]).slice(0, 40)}`).join(' | ')}`);
    });
  }
}

(async () => {
  for (const t of [12, 14, 25, 28, 38, 39]) { await dumpType(t, 3); await sleep(150); }
  await dumpCourseInfo();
  console.log('\n=== 해석 가이드 ===');
  console.log('⏱TIME? 표시가 spendtime/taketime 외 필드에 붙으면, 그 필드가 per-POI 체류시간 후보.');
  console.log('관광지(12)/음식점(39) 등에서 ⏱가 운영시간(usetime/opentimefood)에만 붙으면 → per-POI 체류시간은 TourAPI 부재 확정.');
})();
