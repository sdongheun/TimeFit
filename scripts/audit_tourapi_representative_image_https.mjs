#!/usr/bin/env node
// 3-B-1: 고정 큐의 HTTPS 후보만 Range GET으로 검증한다. TourAPI 상세 API를 호출하지 않는다.
import fs from 'node:fs';

const QUEUE = 'data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증큐.json';
const OUTPUT = 'data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증결과.json';
const phase = process.env.TOURAPI_IMAGE_HTTPS_PHASE ?? 'sample';
const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
const sampleIds = new Set(queue.sampleContentIds);
const prior = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8')).data : [];
const priorById = new Map(prior.map((row) => [row.contentId, row]));
const targets = queue.data.filter((row) => phase === 'sample' ? sampleIds.has(row.contentId) : phase === 'remaining' ? !sampleIds.has(row.contentId) : true);
const data = [];
for (const target of targets) {
  try {
    const response = await fetch(target.httpsCandidateUrl, { headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    const contentType = response.headers.get('content-type') ?? '';
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    data.push({ ...target, finalUrl: response.url, status: response.status, contentType, contentLength, method: 'GET Range: bytes=0-0', accepted: response.ok && contentLength > 0 && response.url.startsWith('https://') && contentType.startsWith('image/') });
  } catch (error) {
    data.push({ ...target, status: 'request_failed', error: String(error), method: 'GET Range: bytes=0-0', accepted: false });
  }
}
const merged = [...priorById.values(), ...data].sort((left, right) => left.contentId.localeCompare(right.contentId));
fs.writeFileSync(OUTPUT, `${JSON.stringify({ meta: { generatedAt: new Date().toISOString(), source: QUEUE, phase, externalRequestsThisRun: data.length, validationPolicy: 'final HTTPS URL, HTTP success, image/* content type, non-empty Range response' }, summary: { queueTotal: queue.data.length, validated: merged.length, accepted: merged.filter((row) => row.accepted).length, rejected: merged.filter((row) => !row.accepted).length, byReason: merged.filter((row) => !row.accepted).reduce((counts, row) => { const key = row.status === 'request_failed' ? 'request_failed' : !String(row.finalUrl ?? '').startsWith('https://') ? 'unsafe_redirect' : !String(row.contentType ?? '').startsWith('image/') ? 'non_image_content_type' : 'empty_or_http_failure'; counts[key] = (counts[key] ?? 0) + 1; return counts; }, {}) }, data: merged }, null, 2)}\n`);
console.log(`대표 후보 TourAPI HTTPS ${phase} 검증: ${data.filter((row) => row.accepted).length}/${data.length}; 누적 ${merged.length}/${queue.data.length} -> ${OUTPUT}`);
if (phase === 'sample' && data.some((row) => !row.accepted)) process.exitCode = 2;
