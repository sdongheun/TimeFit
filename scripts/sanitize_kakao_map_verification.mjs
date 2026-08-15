#!/usr/bin/env node
// 카카오 키워드 검색이 장소 본체 대신 같은 단지의 주차장·보관함 등을 반환한 경우를 정정한다.
import fs from 'node:fs';

const CATALOG_FILE = 'src/data/busan_poi_catalog.json';
const REPORT_FILE = 'data/processed/review/카카오_보조시설_매칭정정.json';
const AUXILIARY_NAME = /물품보관함|주차장|공중화장실|화장실|전기차충전소|충전소|관리사무소|ATM|현금인출|주유소|정비소/;
const HOLD_UNVERIFIED_WORSHIP = new Set(['남부산교회', '초량교회', '한국 이슬람 부산성원']);

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const corrected = [];
const held = [];

for (const group of [catalog.matched, catalog.unmatched]) {
  group.data = group.data.map((place) => {
    const verification = place.mapVerification;
    let next = place;
    if (verification?.matchedName && AUXILIARY_NAME.test(verification.matchedName)) {
      corrected.push({
        contentId: place.contentId,
        title: place.title,
        category: place.category,
        matchedName: verification.matchedName,
        previousStatus: verification.status,
        distanceM: verification.distanceM,
      });
      // 본체 장소가 존재한다는 위치 단서는 남기되, 잘못된 상세 URL을 추천 근거·외부 링크로 쓰지 않는다.
      const { placeId, placeUrl, ...rest } = verification;
      next = {
        ...next,
        mapVerification: {
          ...rest,
          status: 'weak',
          reason: '카카오 키워드 검색 결과가 장소 본체가 아닌 보조시설로 확인됨',
        },
      };
    }

    if (next.category === '자연관광지' && HOLD_UNVERIFIED_WORSHIP.has(next.title)) {
      held.push({ contentId: next.contentId, title: next.title });
      next = {
        ...next,
        availabilityProfile: 'hold',
        normalizationNote: '운영시간·관광 활동 근거 미확인 종교시설은 자연관광지 폴백으로 자동 추천하지 않음',
      };
    }
    return next;
  });
  group.byContentId = Object.fromEntries(group.data.map((place) => [String(place.contentId), place]));
}

const all = [...catalog.matched.data, ...catalog.unmatched.data];
catalog.summary.mapVerification = all.reduce((counts, place) => {
  const status = place.mapVerification?.status ?? 'unverified';
  counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}, {});

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    rule: '카카오 키워드 검색 결과가 보조시설이면 weak으로 낮추고 잘못된 Place URL을 제거',
  },
  summary: { corrected: corrected.length, held: held.length },
  data: { auxiliaryMapMatches: corrected, heldWorshipFacilities: held },
};

fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
