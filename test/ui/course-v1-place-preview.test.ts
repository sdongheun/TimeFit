import assert from 'node:assert/strict';
import test from 'node:test';
import { approvedPhotoEvidence } from './fixtures/approvedPhoto.mjs';
import { buildKakaoMapAppUrl, buildKakaoPlaceSearchUrl, buildKakaoPlaceUrl, getPlacePreviewKind, hasDetailedKakaoSearchAddress, openKakaoPlace, openKakaoPlaceWithAppFallback, openKakaoPlaceWithBrowserFallback, type CourseV1DisplayPlace } from '../../src/ui/recommendation/courseV1PlacePreviewModel';

const withImage: CourseV1DisplayPlace = { title: '놀이마루', lat: 35.1564, lon: 129.0629, addr1: '부산광역시 부산진구 전포대로 208', imageUrl: 'https://tong.visitkorea.or.kr/image.jpg', imageSource: 'tourapi', mapVerification: { status: 'verified', placeId: '1567103628', placeUrl: 'https://place.map.kakao.com/1567103628' } };
const withoutImage: CourseV1DisplayPlace = { title: '부산 자갈치시장', lat: 35.0967, lon: 129.0306, addr1: '부산광역시 중구 자갈치해안로 52' };
withImage.imageEvidence = approvedPhotoEvidence;

test('사진 유무와 로드 실패는 같은 장소 행동을 유지하고 표현만 바꾼다', () => {
  assert.deepEqual(getPlacePreviewKind(withImage, false), { kind: 'image', sourceLabel: 'TourAPI 제공 사진' });
  assert.deepEqual(getPlacePreviewKind(withImage, true), { kind: 'placeholder' });
  assert.deepEqual(getPlacePreviewKind(withoutImage, false), { kind: 'placeholder' });
  assert.equal(buildKakaoPlaceUrl(withImage), 'https://place.map.kakao.com/1567103628');
  assert.equal(buildKakaoPlaceUrl(withoutImage), 'https://map.kakao.com/link/search/%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%20%EC%A4%91%EA%B5%AC%20%EC%9E%90%EA%B0%88%EC%B9%98%ED%95%B4%EC%95%88%EB%A1%9C%2052');
});

test('URESULTS04: 검증 URL이 아니면 상세 addr1만 검색하고 title·좌표를 검색어에 붙이지 않는다', () => {
  const expected = 'https://map.kakao.com/link/search/%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%20%EB%B6%80%EC%82%B0%EC%A7%84%EA%B5%AC%20%EC%A0%84%ED%8F%AC%EB%8C%80%EB%A1%9C%20208';
  assert.equal(buildKakaoPlaceUrl({ ...withImage, mapVerification: { placeUrl: 'http://place.map.kakao.com/1567103628' } }), expected);
  assert.equal(buildKakaoPlaceUrl({ ...withImage, mapVerification: { status: 'weak', placeUrl: 'https://place.map.kakao.com/1567103628' } }), expected);
  assert.equal(buildKakaoPlaceUrl({ ...withImage, mapVerification: { status: 'verified', placeUrl: 'https://example.com/place' } }), expected);
  assert.equal(decodeURIComponent(expected.split('/').at(-1)!), withImage.addr1);
  assert.equal(expected.includes(encodeURIComponent(withImage.title)), false);
  assert.equal(expected.includes(`${withImage.lat},${withImage.lon}`), false);
  assert.equal(hasDetailedKakaoSearchAddress('부산광역시 부산진구'), false);
  assert.equal(hasDetailedKakaoSearchAddress(''), false);
  assert.equal(buildKakaoPlaceUrl({ title: '좌표 없음', lat: Number.NaN, lon: 129.0 }), null);
});

test('URESULTS04: 빈·광역시/구 수준 주소는 검색 대신 좌표 지도 보기를 사용한다', () => {
  assert.equal(buildKakaoPlaceSearchUrl({ title: '주소 없음', lat: 35.1, lon: 129.0 }), 'https://map.kakao.com/link/map/%EC%A3%BC%EC%86%8C%20%EC%97%86%EC%9D%8C,35.1,129');
  assert.equal(buildKakaoPlaceSearchUrl({ title: '넓은 주소', lat: 35.1, lon: 129.0, addr1: '부산광역시 부산진구' }), 'https://map.kakao.com/link/map/%EB%84%93%EC%9D%80%20%EC%A3%BC%EC%86%8C,35.1,129');
});

test('카카오맵 연결 실패는 조용히 무시하지 않고 실패 상태로 반환한다', async () => {
  const opened: string[] = [];
  assert.equal(await openKakaoPlace(withImage, async (url) => { opened.push(url); }), 'opened');
  assert.deepEqual(opened, ['https://place.map.kakao.com/1567103628']);
  assert.equal(await openKakaoPlace(withoutImage, async () => { throw new Error('linking failed'); }), 'failed');
});

test('iOS 외부 전환 실패 때만 같은 장소의 안전한 주소 확인 URL을 브라우저 시트로 한 번 연다', async () => {
  const externalUrls: string[] = [];
  const browserUrls: string[] = [];
  const fallback = await openKakaoPlaceWithBrowserFallback(withImage, {
    openExternal: async (url) => { externalUrls.push(url); throw new Error('handoff failed'); },
    openBrowser: async (url) => { browserUrls.push(url); },
  });
  assert.equal(fallback, 'browser_fallback_opened');
  assert.deepEqual(externalUrls, ['https://place.map.kakao.com/1567103628']);
  assert.deepEqual(browserUrls, ['https://map.kakao.com/link/search/%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%20%EB%B6%80%EC%82%B0%EC%A7%84%EA%B5%AC%20%EC%A0%84%ED%8F%AC%EB%8C%80%EB%A1%9C%20208']);
});

test('iOS 카카오맵 opener는 외부 성공·두 단계 실패·URL 불가를 typed 결과로 분리한다', async () => {
  let browserCalls = 0;
  assert.equal(await openKakaoPlaceWithBrowserFallback(withImage, { openExternal: async () => {}, openBrowser: async () => { browserCalls += 1; } }), 'external_opened');
  assert.equal(browserCalls, 0);
  assert.equal(await openKakaoPlaceWithBrowserFallback(withImage, { openExternal: async () => { throw new Error('handoff failed'); }, openBrowser: async () => { throw new Error('browser failed'); } }), 'failed');
  assert.equal(await openKakaoPlaceWithBrowserFallback({ title: '좌표 없음', lat: Number.NaN, lon: 129 }, { openExternal: async () => { throw new Error('must not run'); }, openBrowser: async () => { throw new Error('must not run'); } }), 'unavailable');
});

test('카카오맵 설치 기기는 verified 숫자 Place ID를 공식 place scheme으로 직접 연다', async () => {
  const calls: string[] = [];
  const result = await openKakaoPlaceWithAppFallback(withImage, {
    canOpenApp: async (url) => { calls.push(`can:${url}`); return true; },
    openApp: async (url) => { calls.push(`app:${url}`); },
    openExternal: async (url) => { calls.push(`https:${url}`); },
    openBrowser: async (url) => { calls.push(`browser:${url}`); },
  });
  assert.equal(result, 'app_opened');
  assert.deepEqual(calls, ['can:kakaomap://place?id=1567103628', 'app:kakaomap://place?id=1567103628']);
});

test('약한 장소 정보와 좌표만 있는 장소는 공식 look scheme만 만들고 Place ID를 추정하지 않는다', async () => {
  const weakPlace = { ...withImage, mapVerification: { status: 'weak', placeId: '1567103628', placeUrl: 'https://place.map.kakao.com/1567103628' } };
  assert.equal(buildKakaoMapAppUrl(weakPlace), 'kakaomap://look?p=35.1564,129.0629');
  assert.equal(buildKakaoMapAppUrl({ ...weakPlace, lat: 91 }), null);
  const calls: string[] = [];
  const result = await openKakaoPlaceWithAppFallback(weakPlace, { canOpenApp: async (url) => { calls.push(url); return true; }, openApp: async (url) => { calls.push(url); }, openExternal: async () => { throw new Error('must not use https'); }, openBrowser: async () => { throw new Error('must not use browser'); } });
  assert.equal(result, 'app_opened');
  assert.deepEqual(calls, ['kakaomap://look?p=35.1564,129.0629', 'kakaomap://look?p=35.1564,129.0629']);
});

test('카카오맵 미설치 또는 scheme open 실패는 HTTPS와 browser fallback을 각각 한 번만 사용한다', async () => {
  const unavailableCalls: string[] = [];
  const unavailable = await openKakaoPlaceWithAppFallback(withImage, { canOpenApp: async (url) => { unavailableCalls.push(`can:${url}`); return false; }, openApp: async () => { throw new Error('must not open app'); }, openExternal: async (url) => { unavailableCalls.push(`https:${url}`); }, openBrowser: async () => { throw new Error('must not use browser'); } });
  assert.equal(unavailable, 'external_opened');
  assert.deepEqual(unavailableCalls, ['can:kakaomap://place?id=1567103628', 'https:https://place.map.kakao.com/1567103628']);

  const fallbackCalls: string[] = [];
  const fallback = await openKakaoPlaceWithAppFallback(withImage, { canOpenApp: async () => true, openApp: async () => { throw new Error('scheme failed'); }, openExternal: async (url) => { fallbackCalls.push(`https:${url}`); throw new Error('https failed'); }, openBrowser: async (url) => { fallbackCalls.push(`browser:${url}`); } });
  assert.equal(fallback, 'browser_fallback_opened');
  assert.deepEqual(fallbackCalls, ['https:https://place.map.kakao.com/1567103628', 'browser:https://map.kakao.com/link/search/%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%20%EB%B6%80%EC%82%B0%EC%A7%84%EA%B5%AC%20%EC%A0%84%ED%8F%AC%EB%8C%80%EB%A1%9C%20208']);
});

test('카카오맵 app·HTTPS·browser가 모두 실패하거나 URL이 없으면 typed 오류만 반환한다', async () => {
  assert.equal(await openKakaoPlaceWithAppFallback(withImage, { canOpenApp: async () => true, openApp: async () => { throw new Error('scheme failed'); }, openExternal: async () => { throw new Error('https failed'); }, openBrowser: async () => { throw new Error('browser failed'); } }), 'failed');
  assert.equal(await openKakaoPlaceWithAppFallback({ title: '좌표 없음', lat: Number.NaN, lon: 129 }, { canOpenApp: async () => { throw new Error('must not query'); }, openApp: async () => { throw new Error('must not open'); }, openExternal: async () => { throw new Error('must not open'); }, openBrowser: async () => { throw new Error('must not open'); } }), 'unavailable');
});

test('1·2·3곳 fixture의 모든 stop은 같은 카카오맵 행동과 접근성 문구를 만든다', () => {
  for (const count of [1, 2, 3]) {
    const stops = Array.from({ length: count }, (_, index) => ({ ...withoutImage, title: `장소 ${index + 1}`, lat: 35.1 + index / 100, lon: 129.0 + index / 100 }));
    assert.equal(stops.every((place) => Boolean(buildKakaoPlaceUrl(place))), true);
    assert.deepEqual(stops.map((place) => `${place.title} 카카오맵에서 장소 보기`), Array.from({ length: count }, (_, index) => `장소 ${index + 1} 카카오맵에서 장소 보기`));
  }
});
