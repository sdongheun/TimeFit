#!/usr/bin/env node
// 3-B-1: 부산시 공식 이미지가 없는 자동 대표 후보의 TourAPI HTTPS 검증 대상을 고정한다.
import fs from 'node:fs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const AUDIT = 'data/processed/review/현재사용_TourAPI_대표이미지_감사.json';
const OUTPUT = 'data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증큐.json';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const catalog = read(CATALOG);
const auditById = new Map(read(AUDIT).samples.map((row) => [row.contentId, row]));
const rows = [...catalog.matched.data, ...catalog.unmatched.data]
  .filter((place) => ['representative_core', 'representative_standard'].includes(place.classification))
  .filter((place) => !place.imageUrl || place.imageSource === 'tourapi')
  .map((place) => {
    const audit = auditById.get(place.contentId);
    if (!audit || !audit.image || String(audit.tourapiContentId) !== String(place.tourapiContentId)) return null;
    const original = new URL(audit.image);
    // 전체 URL 문자열을 치환하지 않고, TourAPI가 사용한 고정 CDN host의 http 항목만 HTTPS 후보로 만든다.
    const candidate = original.protocol === 'https:' ? original : original.hostname === 'tong.visitkorea.or.kr' && original.protocol === 'http:'
      ? new URL(`https://${original.hostname}${original.pathname}${original.search}`) : null;
    if (!candidate) return null;
    return { contentId: place.contentId, tourapiContentId: String(place.tourapiContentId), classification: place.classification, originalUrl: audit.image, httpsCandidateUrl: candidate.href };
  })
  .filter(Boolean)
  .sort((left, right) => left.contentId.localeCompare(right.contentId));
const sample = [
  ...rows.filter((row) => row.classification === 'representative_core').slice(0, 6),
  ...rows.filter((row) => row.classification === 'representative_standard').slice(0, 6),
].sort((left, right) => left.contentId.localeCompare(right.contentId));
if (rows.length !== 72) throw new Error(`expected 72 TourAPI representative image candidates, got ${rows.length}`);
if (sample.length !== 12 || !sample.some((row) => row.classification === 'representative_core') || !sample.some((row) => row.classification === 'representative_standard')) throw new Error('stratified sample is incomplete');
fs.writeFileSync(OUTPUT, `${JSON.stringify({ meta: { generatedAt: new Date().toISOString(), source: [CATALOG, AUDIT], policy: '부산시 공식 이미지가 없는 representative_core/standard만; ID와 TourAPI content ID 동시 일치; tong.visitkorea HTTP는 allowlisted HTTPS 후보로만 검증' }, summary: { total: rows.length, sampleTotal: sample.length, byClassification: Object.fromEntries(['representative_core', 'representative_standard'].map((kind) => [kind, rows.filter((row) => row.classification === kind).length])) }, sampleContentIds: sample.map((row) => row.contentId), data: rows }, null, 2)}\n`);
console.log(`대표 후보 TourAPI HTTPS 검증 큐: ${rows.length}개 (표본 ${sample.length}) -> ${OUTPUT}`);
