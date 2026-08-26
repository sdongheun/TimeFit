import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const queue = JSON.parse(fs.readFileSync('data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증큐.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증결과.json', 'utf8'));

test('3-B-1: TourAPI HTTPS manifest는 고정한 대표 후보 72개만 정확한 ID·content ID로 검증한다', () => {
  assert.equal(queue.summary.total, 72);
  assert.equal(queue.summary.sampleTotal, 12);
  assert.deepEqual(queue.summary.byClassification, { representative_core: 11, representative_standard: 61 });
  assert.equal(manifest.summary.validated, 72);
  assert.deepEqual(manifest.data.map((row) => row.contentId), queue.data.map((row) => row.contentId));
  for (const row of manifest.data) {
    assert.match(row.httpsCandidateUrl, /^https:\/\/tong\.visitkorea\.or\.kr\//);
    assert.equal(row.accepted, true, `${row.contentId}: HTTPS image validation`);
    assert.match(row.finalUrl, /^https:\/\//);
    assert.match(row.contentType, /^image\//);
    assert.ok(row.contentLength > 0);
  }
});
