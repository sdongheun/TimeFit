import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKakaoPlaceUrl, getPlacePreviewKind, openKakaoPlace, type CourseV1DisplayPlace } from '../../src/ui/recommendation/courseV1PlacePreviewModel';

const withImage: CourseV1DisplayPlace = { title: '놀이마루', lat: 35.1564, lon: 129.0629, imageUrl: 'https://tong.visitkorea.or.kr/image.jpg', imageSource: 'tourapi', mapVerification: { placeUrl: 'https://place.map.kakao.com/1567103628' } };
const withoutImage: CourseV1DisplayPlace = { title: '부산 자갈치시장', lat: 35.0967, lon: 129.0306 };

test('사진 유무와 로드 실패는 같은 장소 행동을 유지하고 표현만 바꾼다', () => {
  assert.deepEqual(getPlacePreviewKind(withImage, false), { kind: 'image', sourceLabel: 'TourAPI 제공 사진' });
  assert.deepEqual(getPlacePreviewKind(withImage, true), { kind: 'placeholder' });
  assert.deepEqual(getPlacePreviewKind(withoutImage, false), { kind: 'placeholder' });
  assert.equal(buildKakaoPlaceUrl(withImage), 'https://place.map.kakao.com/1567103628');
  assert.equal(buildKakaoPlaceUrl(withoutImage), 'https://map.kakao.com/link/search/%EB%B6%80%EC%82%B0%20%EC%9E%90%EA%B0%88%EC%B9%98%EC%8B%9C%EC%9E%A5%2035.0967%2C129.0306');
});

test('검증 URL이 안전하지 않으면 제목과 좌표가 있는 카카오 검색 URL로만 대체한다', () => {
  assert.equal(buildKakaoPlaceUrl({ ...withImage, mapVerification: { placeUrl: 'http://place.map.kakao.com/1567103628' } }), 'https://map.kakao.com/link/search/%EB%86%80%EC%9D%B4%EB%A7%88%EB%A3%A8%2035.1564%2C129.0629');
  assert.equal(buildKakaoPlaceUrl({ title: '좌표 없음', lat: Number.NaN, lon: 129.0 }), null);
});

test('카카오맵 연결 실패는 조용히 무시하지 않고 실패 상태로 반환한다', async () => {
  const opened: string[] = [];
  assert.equal(await openKakaoPlace(withImage, async (url) => { opened.push(url); }), 'opened');
  assert.deepEqual(opened, ['https://place.map.kakao.com/1567103628']);
  assert.equal(await openKakaoPlace(withoutImage, async () => { throw new Error('linking failed'); }), 'failed');
});

test('1·2·3곳 fixture의 모든 stop은 같은 카카오맵 행동과 접근성 문구를 만든다', () => {
  for (const count of [1, 2, 3]) {
    const stops = Array.from({ length: count }, (_, index) => ({ ...withoutImage, title: `장소 ${index + 1}`, lat: 35.1 + index / 100, lon: 129.0 + index / 100 }));
    assert.equal(stops.every((place) => Boolean(buildKakaoPlaceUrl(place))), true);
    assert.deepEqual(stops.map((place) => `${place.title} 카카오맵에서 장소 보기`), Array.from({ length: count }, (_, index) => `장소 ${index + 1} 카카오맵에서 장소 보기`));
  }
});
