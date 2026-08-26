import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCourseDiscoveryContext, getPlaceDiscoveryContext } from '../../src/ui/recommendation/courseV1DiscoveryContext';

const places: Map<string, { addr1?: string; shortStay?: { type?: string } }> = new Map([
  ['coast', { addr1: '부산광역시 해운대구 해운대해변로', shortStay: { type: 'scenic_pause' } }],
  ['culture', { addr1: '부산광역시 중구 용두산길', shortStay: { type: 'compact_culture' } }],
  ['unknown-region', { shortStay: { type: 'quick_browse' } }],
  ['unknown-activity', { addr1: '부산광역시 수영구 광안해변로', shortStay: { type: 'unreviewed' } }],
]);

test('UXV-40 / UX-24: 카탈로그의 주소와 활동 근거가 모두 있을 때만 지역명과 사용자 친화 활동 유형을 표시한다', () => {
  assert.equal(getPlaceDiscoveryContext(places.get('coast')), '해운대구 · 풍경 감상');
  assert.equal(getPlaceDiscoveryContext(places.get('culture')), '중구 · 문화 공간 관람');
});

test('지역 또는 활동 근거가 없으면 추정 문구 대신 발견 맥락을 생략한다', () => {
  assert.equal(getPlaceDiscoveryContext(places.get('unknown-region')), null);
  assert.equal(getPlaceDiscoveryContext(places.get('unknown-activity')), null);
  assert.equal(getPlaceDiscoveryContext(undefined), null);
});

test('대표 코스 맥락은 방문 순서의 사실 기반 정보만 연결하며 입력을 바꾸지 않는다', () => {
  const placeIds = ['coast', 'unknown-region', 'culture'];
  const before = [...placeIds];
  const context = buildCourseDiscoveryContext(placeIds, (id) => places.get(id));
  assert.equal(context, '해운대구 · 풍경 감상 → 중구 · 문화 공간 관람');
  assert.doesNotMatch(context ?? '', /처음 가보는|숨은|인기/);
  assert.deepEqual(placeIds, before);
});
