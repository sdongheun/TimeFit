import assert from 'node:assert/strict';
import test from 'node:test';
import type { MultiSourceLiveProjection } from '../../src/data/busanLiveProjection';
import { attachLivePlaceSnapshot, preserveSelectedLivePlaces, resolveRecommendationPlace, type LiveDisplayPlace } from '../../src/ui/recommendation/livePlacePresentation';
import type { RecommendationSession } from '../../src/ui/nav';
import { approvedPlacePhoto } from '../../src/ui/placePhotoModel';

const session = (): RecommendationSession => ({ nowIso: '2026-09-22T05:00:00.000Z', origin: { id: 'origin', lat: 35.1, lon: 129.1, label: '출발지' }, destination: null, remainingMin: 120, arrivalBufferMin: 10 });
const projection = { liveSourceSnapshotId: 'snapshot-fixture', status: 'ready', candidates: [{ id: 'live-1', state: 'active', facts: { title: '실시간 장소', address: '부산광역시 중구 실제길 1', lat: 35.11, lon: 129.11, description: '현재 설명', availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 600, endMin: 1080 }] }, photo: { status: 'approved', url: 'https://example.org/live.jpg', attribution: '부산 공공데이터', sourcePageUrl: 'https://example.org/source', licenseName: '이용허락범위 제한 없음', commercialUseAllowed: true, modificationAllowed: true, verifiedAt: '2026-09-22' } }, policy: { category: '관광지', subCategory: '전시', activityType: 'museum' } }] } as unknown as MultiSourceLiveProjection;

test('live display removes only terminal language lists and preserves the name through restore', () => {
  for (const [raw, expected] of [
    ['해운대 선물가게(한,영,중간,중번,일)', '해운대 선물가게'],
    ['해운대시장 (한, 영, 중간, 중번, 일) ', '해운대시장'],
    ['카페(부산점)(한,영)', '카페(부산점)'],
    ['카페(부산점)', '카페(부산점)'],
    ['전시관(한,영,특별전)', '전시관(한,영,특별전)'],
    ['전시관(한,영) 별관', '전시관(한,영) 별관'],
    ['(한,영)', '(한,영)'],
  ]) {
    const current = session();
    const input = { ...projection, candidates: [{ ...projection.candidates[0], facts: { ...projection.candidates[0].facts, title: raw } }] };
    attachLivePlaceSnapshot(current, input);
    assert.equal(resolveRecommendationPlace(current, 'live-1', () => undefined)?.title, expected);
    assert.equal(input.candidates[0].facts.title, raw);
    assert.equal(preserveSelectedLivePlaces(current, ['live-1']), true);
    assert.equal(resolveRecommendationPlace(JSON.parse(JSON.stringify(current)), 'live-1', () => undefined)?.title, expected);
  }
});

test('sealed live display facts win over stale static catalog on all UI surfaces', () => {
  const current = session();
  attachLivePlaceSnapshot(current, projection);
  const place = resolveRecommendationPlace(current, 'live-1', () => ({ contentId: 'live-1', title: '오래된 이름', lat: 0, lon: 0 })) as LiveDisplayPlace;
  assert.equal(place?.title, '실시간 장소');
  assert.equal(place?.addr1, '부산광역시 중구 실제길 1');
  assert.equal(place?.lat, 35.11);
  assert.equal(place?.detailDescription, '현재 설명');
  assert.deepEqual(place?.operatingHours, ['평일 10:00–18:00']);
  assert.equal(place?.imageUrl, 'https://example.org/live.jpg');
  assert.equal(approvedPlacePhoto(place)?.attribution, '부산 공공데이터');
  assert.equal(approvedPlacePhoto(place)?.sourcePageUrl, 'https://example.org/source');
  assert.equal(approvedPlacePhoto({ ...place, imageUrl: 'https://example.org/changed.jpg' }), null);
  assert.equal(resolveRecommendationPlace(current, 'static-only', () => ({ contentId: 'static-only', title: '정적 성공', lat: 0, lon: 0 })), undefined);
});

test('selected live places survive active restore without copying whole projection or secrets', () => {
  const current = session();
  attachLivePlaceSnapshot(current, projection);
  assert.equal(preserveSelectedLivePlaces(current, ['live-1']), true);
  const restored = JSON.parse(JSON.stringify(current)) as RecommendationSession;
  const restoredPlace = resolveRecommendationPlace(restored, 'live-1', () => undefined);
  assert.equal(restoredPlace?.title, '실시간 장소');
  assert.equal(approvedPlacePhoto(restoredPlace)?.url, 'https://example.org/live.jpg');
  assert.equal(resolveRecommendationPlace(restored, 'static-only', () => ({ contentId: 'static-only', title: '정적 성공', lat: 0, lon: 0 })), undefined);
  assert.equal(JSON.stringify(restored).includes('현재 설명'), false);
  assert.equal(JSON.stringify(restored).includes('실제길'), false);
  assert.equal(JSON.stringify(restored).includes('live.jpg'), true);
  assert.equal(JSON.stringify(restored).includes('operatingHours'), false);
  assert.equal(JSON.stringify(restored).includes('tourSupplements'), false);
  assert.equal(JSON.stringify(restored).includes('approvedSourceIds'), false);
});

test('OFF session still resolves the existing static place; missing live photo stays a fallback', () => {
  const current = session();
  assert.equal(resolveRecommendationPlace(current, 'static', () => ({ contentId: 'static', title: '기존 장소', lat: 1, lon: 2 }))?.title, '기존 장소');
  const noPhoto = { ...projection, candidates: [{ ...projection.candidates[0], facts: { ...projection.candidates[0].facts, photo: undefined } }] } as unknown as MultiSourceLiveProjection;
  attachLivePlaceSnapshot(current, noPhoto);
  assert.equal(resolveRecommendationPlace(current, 'live-1', () => undefined)?.imageUrl, undefined);
  assert.equal(approvedPlacePhoto(resolveRecommendationPlace(current, 'live-1', () => undefined)), null);
});

test('live facts may reuse only the same reviewed local place photo without falling back to stale place facts', () => {
  const current = session();
  const reviewedPhotoProjection = {
    liveSourceSnapshotId: 'snapshot-photo-compatibility',
    status: 'ready',
    candidates: [{
      id: 'poi_801',
      state: 'active',
      facts: {
        title: '실시간 롯데백화점 부산본점',
        address: '실시간 주소',
        lat: 35.15665,
        lon: 129.05655,
        availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 600, endMin: 1200 }] },
      },
      policy: { category: '쇼핑', subCategory: '백화점', activityType: 'shopping' },
    }],
  } as unknown as MultiSourceLiveProjection;

  attachLivePlaceSnapshot(current, reviewedPhotoProjection);
  const place = resolveRecommendationPlace(current, 'poi_801', () => undefined) as LiveDisplayPlace;
  assert.equal(place.title, '실시간 롯데백화점 부산본점');
  assert.equal(place.addr1, '실시간 주소');
  assert.match(place.imageUrl ?? '', /visitbusan\.net/);
  assert.equal(approvedPlacePhoto(place)?.status, 'operator_approved');

  assert.equal(preserveSelectedLivePlaces(current, ['poi_801']), true);
  const restored = JSON.parse(JSON.stringify(current)) as RecommendationSession;
  const restoredPlace = resolveRecommendationPlace(restored, 'poi_801', () => undefined);
  assert.equal(restoredPlace?.title, '실시간 롯데백화점 부산본점');
  assert.equal(approvedPlacePhoto(restoredPlace)?.status, 'operator_approved');
  assert.equal(JSON.stringify(restored).includes('실시간 주소'), false);
});
