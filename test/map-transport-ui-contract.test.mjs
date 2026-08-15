import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf-8');
const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf-8');
const kakaoMap = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf-8');

test('시간 입력은 이동수단을 미리 선택하지 않고 비교용 후보 지도를 연다', () => {
  assert.doesNotMatch(setup, /const \[mode, setMode\]/);
  assert.match(setup, /candidateModes: \['walk', 'transit', 'car'\]/);
  assert.match(setup, /radiusM: 8000/);
  assert.match(setup, /modeLabel: '이동수단 비교'/);
});

test('후보 지도는 전역 이동수단 필터 없이 장소 미리보기에서 구간 수단을 조정한다', () => {
  assert.doesNotMatch(results, /MAP_TRANSPORT_FILTERS/);
  assert.doesNotMatch(results, /availabilityByMode/);
  assert.match(results, /openTransportPicker/);
  assert.match(results, /compactModePicker/);
  assert.match(results, /코스 만들기 · \{ctx\.remainingMin\}분 남음/);
});

test('사진 없는 장소는 카카오 기본 핀과 이름 라벨을, 현재 위치는 빨간 위치 점을 사용한다', () => {
  assert.match(kakaoMap, /function currentLocationImage/);
  assert.match(kakaoMap, /kind === 'origin'\) options\.image = currentLocationImage/);
  assert.match(kakaoMap, /kind !== 'spot'\) options\.image = colorPinImage/);
  assert.match(kakaoMap, /이미지가 없는 장소는 카카오 SDK 기본 마커를 그대로 사용한다/);
  assert.match(kakaoMap, /function addSpotLabel/);
  assert.match(kakaoMap, /transform:translateY\(-43px\)/);
  assert.match(kakaoMap, /fill="#ef4444"/);
});

test('후보 지도와 장바구니 지도는 현재 위치로 다시 중심 이동할 수 있다', () => {
  assert.match(kakaoMap, /function focusMap\(point, offsetY\)/);
  assert.match(kakaoMap, /map\.setCenter\(ll\(point\)\)/);
  assert.match(kakaoMap, /map\.panBy\(0, Number\(offsetY\)\)/);
  assert.match(kakaoMap, /recenterPoint\?: LatLon/);
  assert.match(kakaoMap, /recenterOffsetY\?: number/);
  assert.match(results, /locationFocusToken/);
  assert.match(results, /현재 위치로 지도 이동/);
  assert.match(results, /recenterToken=\{locationFocusToken\}/);
  assert.match(results, /recenterOffsetY=\{[\s\S]*sheetPosition === "default"/);
});
