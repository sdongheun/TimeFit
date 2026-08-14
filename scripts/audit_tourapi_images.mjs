#!/usr/bin/env node
// 현재 런타임 카탈로그의 TourAPI 원본 장소에서 대표 이미지 제공 여부를 점검한다.
// 사용: set -a && source .env && set +a && TOURAPI_IMAGE_LIMIT=20 node scripts/audit_tourapi_images.mjs

import fs from 'node:fs';

const key = process.env.TOURAPI_KEY ?? process.env.EXPO_PUBLIC_TOURAPI_KEY;
if (!key) throw new Error('TOURAPI_KEY 또는 EXPO_PUBLIC_TOURAPI_KEY가 필요합니다.');

const limit = Number(process.env.TOURAPI_IMAGE_LIMIT ?? 20);
const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data]
  .filter((row) => row.tourapiContentId)
  .slice(0, limit);
const endpoint = 'https://apis.data.go.kr/B551011/KorService2/detailCommon2';

async function detail(row) {
  const query = new URLSearchParams({
    serviceKey: key,
    MobileOS: 'ETC',
    MobileApp: 'TimeFit',
    _type: 'json',
    contentId: String(row.tourapiContentId),
  });
  const response = await fetch(`${endpoint}?${query}`);
  const json = await response.json();
  const header = json?.response?.header;
  if (header?.resultCode && header.resultCode !== '0000') {
    throw new Error(`${header.resultCode}: ${header.resultMsg ?? 'TourAPI 오류'}`);
  }
  const item = json?.response?.body?.items?.item;
  return {
    item: Array.isArray(item) ? item[0] : item,
    totalCount: json?.response?.body?.totalCount ?? null,
    responseShape: Object.keys(json?.response ?? {}),
    bodyShape: Object.keys(json?.response?.body ?? {}),
    resultCode: header?.resultCode ?? null,
    resultMsg: header?.resultMsg ?? null,
    rawPreview: JSON.stringify(json).slice(0, 300),
  };
}

const samples = [];
for (const row of rows) {
  try {
    const result = await detail(row);
    const item = result.item;
    samples.push({
      contentId: row.contentId,
      title: row.title,
      tourapiContentId: row.tourapiContentId,
      image: item?.firstimage ?? item?.firstimage2 ?? null,
      response: item
        ? 'ok'
        : `empty (code=${result.resultCode}; message=${result.resultMsg}; totalCount=${result.totalCount}; body=${result.bodyShape.join(',')})`,
      rawPreview: item ? undefined : result.rawPreview,
    });
  } catch (error) {
    samples.push({ contentId: row.contentId, title: row.title, tourapiContentId: row.tourapiContentId, image: null, response: String(error) });
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const withImage = samples.filter((sample) => sample.image).length;
const report = {
  checked: samples.length,
  withImage,
  withoutImage: samples.length - withImage,
  samples,
};

if (process.env.TOURAPI_IMAGE_SUMMARY === '1') {
  console.log(JSON.stringify({
    checked: report.checked,
    withImage: report.withImage,
    withoutImage: report.withoutImage,
  }));
} else {
  console.log(JSON.stringify(report, null, 2));
}
