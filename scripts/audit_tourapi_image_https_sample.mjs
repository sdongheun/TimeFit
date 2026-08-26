#!/usr/bin/env node
// TourAPI가 이미 반환한 HTTPS 대표 이미지만 GET 범위 요청으로 표시 가능성을 재확인한다.
import fs from 'node:fs';

const INPUT = 'data/processed/review/현재사용_TourAPI_대표이미지_감사.json';
const OUTPUT = 'data/processed/review/현재사용_TourAPI_대표이미지_HTTPS검증.json';
const audit = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const candidates = audit.samples.filter((sample) => typeof sample.image === 'string' && sample.image.startsWith('https://'));
const data = [];
for (const sample of candidates) {
  try {
    const response = await fetch(sample.image, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
    const contentType = response.headers.get('content-type') ?? '';
    data.push({ contentId: sample.contentId, tourapiContentId: sample.tourapiContentId, image: sample.image, finalUrl: response.url, status: response.status, contentType, accepted: response.ok && response.url.startsWith('https://') && contentType.startsWith('image/') });
  } catch (error) {
    data.push({ contentId: sample.contentId, tourapiContentId: sample.tourapiContentId, image: sample.image, status: 'request_failed', error: String(error), accepted: false });
  }
}
fs.writeFileSync(OUTPUT, `${JSON.stringify({ meta: { generatedAt: new Date().toISOString(), source: INPUT, request: 'GET Range: bytes=0-0; redirects followed' }, summary: { checked: data.length, accepted: data.filter((item) => item.accepted).length, rejected: data.filter((item) => !item.accepted).length }, data }, null, 2)}\n`);
console.log(`TourAPI HTTPS 이미지 검증: ${data.filter((item) => item.accepted).length}/${data.length} -> ${OUTPUT}`);
