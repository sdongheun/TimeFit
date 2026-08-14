#!/usr/bin/env node
// 자연관광지로 분류됐지만 AIHub 성격이 다른 장소를 시설·상권·야외 후보로 나눈다.
import fs from 'node:fs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/자연관광지_분류불일치_검토.json';
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];

const naturalSignals = /해변|해수욕장|공원|수변|숲|산|항$|산책로|그린레일|광장/;
const facilitySignals = /롯데월드|아쿠아리움|키자니아|온천센터|타워|과학관|박물관|전당|자료실|체험|크루즈/;
const commercialSignals = /시장|거리|골목|패션|특구/;
const excludedSignals = /열차|S-train/;

function classify(place) {
  const text = `${place.title} ${place.subCategory ?? ''}`;
  if (excludedSignals.test(text)) return { action: '제외검토', reason: '교통수단 또는 운행 서비스 성격' };
  if (facilitySignals.test(text)) return { action: '시설형재분류', reason: '입장·프로그램·운영시간이 필요한 시설 성격' };
  if (commercialSignals.test(text)) return { action: '상권형재분류', reason: '상점·상권 중심의 거리 또는 관광특구 성격' };
  if (naturalSignals.test(text)) return { action: '야외유지검토', reason: '공원·숲·항구·산책로 등 야외 접근 성격' };
  return { action: '수동판단필요', reason: '이름만으로 야외·시설 여부를 확정할 수 없음' };
}

const data = rows
  .filter((place) => place.category === '자연관광지')
  .filter((place) => place.aihubCategory && !/자연|공원|해변|산|관광지|문화마을|거리|골목/.test(place.aihubCategory))
  .map((place) => ({
    contentId: place.contentId,
    title: place.title,
    address: place.addr1,
    aihubCategory: place.aihubCategory,
    mapVerification: place.mapVerification?.status ?? 'unverified',
    operatingHours: place.operatingHours ?? [],
    ...classify(place),
  }));

const byAction = Object.fromEntries([...data.reduce((counts, row) => {
  counts.set(row.action, (counts.get(row.action) ?? 0) + 1);
  return counts;
}, new Map()).entries()]);
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString(),
    purpose: '새벽 게이트를 우회할 수 있는 자연관광지 오분류 후보를 검토한다.',
    rule: '시설형·상권형으로 확정한 장소는 자연관광지 예외를 제거하고 운영시간 게이트 대상이 된다.',
  },
  summary: { total: data.length, byAction },
  data,
}, null, 2)}\n`);
console.log(`자연관광지 분류 불일치 감사: ${data.length}건 -> ${OUTPUT}`);
