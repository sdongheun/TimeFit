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

test('장소 목록은 탐색용이며 경로·체류·담기 판단은 선택 패널에서만 제공한다', () => {
  assert.match(results, /onPress=\{\(\) => openCandidateFromSheet\(item\)\}/);
  assert.doesNotMatch(results, /카카오맵에서 장소 자세히 보기/);
  assert.doesNotMatch(results, /이곳 들르기/);
  assert.match(results, /장바구니에 담기/);
});

test('장소 목록은 현재 위치 거리와 도보·버스·차량 가능 상태를 먼저 보여준다', () => {
  assert.match(results, /function distanceFromOriginLabel/);
  assert.match(results, /현재 위치 \$\{km\.toFixed\(1\)\}km/);
  assert.match(results, /MaterialCommunityIcons/);
  assert.match(results, /name="walk"/);
  assert.match(results, /name="bus"/);
  assert.match(results, /name="car"/);
  assert.match(results, /item\.availableModes\.includes\(mode\)/);
  assert.doesNotMatch(results, /출발지 근처/);
});

test('사진 없는 장소는 카카오 기본 핀과 이름 라벨을, 현재 위치는 빨간 위치 점을 사용한다', () => {
  assert.match(kakaoMap, /function currentLocationImage/);
  assert.match(kakaoMap, /kind === 'origin'\) options\.image = currentLocationImage/);
  assert.match(kakaoMap, /kind !== 'spot'\) options\.image = colorPinImage/);
  assert.match(kakaoMap, /이미지가 없는 장소는 카카오 SDK 기본 마커를 그대로 사용한다/);
  assert.match(kakaoMap, /function addSpotLabel/);
  assert.match(kakaoMap, /transform:translateY\(8px\)/);
  assert.match(kakaoMap, /yAnchor: 0/);
  assert.match(kakaoMap, /fill="#ef4444"/);
});

test('선택한 장소의 마커와 이름 라벨은 다른 지도 요소보다 위에 표시된다', () => {
  assert.match(kakaoMap, /zIndex: active \? 100 : 10/);
  assert.match(kakaoMap, /zIndex: active \? 110 : 30/);
  assert.match(kakaoMap, /addSpotLabel\(m, point, i, data\.showMarkerLabels, !!m\.active\)/);
  assert.match(kakaoMap, /zIndex: m\.active \? 100 : 10/);
});

test('후보 지도와 장바구니 지도는 현재 위치로 다시 중심 이동할 수 있다', () => {
  assert.match(kakaoMap, /function focusMap\(point, offsetY\)/);
  assert.match(kakaoMap, /function focusCenter\(point, offsetY\)/);
  assert.match(kakaoMap, /containerPointFromCoords\(point\)/);
  assert.match(kakaoMap, /coordsFromContainerPoint/);
  assert.match(kakaoMap, /map\.panTo\(focusCenter\(ll\(point\), offsetY\)\)/);
  assert.match(kakaoMap, /recenterPoint\?: LatLon/);
  assert.match(kakaoMap, /recenterOffsetY\?: number/);
  assert.match(results, /mapFocusRequest/);
  assert.match(results, /const requestMapFocus = useCallback/);
  assert.match(results, /현재 위치로 지도 이동/);
  assert.match(results, /recenterToken=\{mapFocusRequest\.token\}/);
  assert.match(results, /const mapFocusOffsetY/);
  assert.match(results, /Math\.round\(expandedSheetHeight \* 0\.5\)/);
  assert.match(results, /Math\.round\(defaultSheetHeight \* 0\.5\)/);
  assert.match(results, /Math\.round\(\(insets\.bottom \+ 82\) \* 0\.5\)/);
  assert.match(results, /recenterOffsetY=\{mapFocusOffsetY\}/);
});

test('지도 마커 탭은 장소 카드를 포커스할 뿐 이동수단 패널을 바로 열지 않는다', () => {
  const focusCandidate = results.match(/function focusCandidate\(markerIndex: number\)[\s\S]*?\n  }\n\n  const candidateMapPoints/);
  assert.ok(focusCandidate);
  assert.match(focusCandidate[0], /setFocusedSpotId\(contentId\)/);
  assert.match(focusCandidate[0], /moveSheet\("default"\)/);
  assert.match(focusCandidate[0], /candidateListRef\.current\?\.scrollTo/);
  assert.doesNotMatch(focusCandidate[0], /openTransportPicker/);
});

test('시트의 장소 카드 탭은 같은 장소를 지도에 포커스한 뒤 상세 패널을 연다', () => {
  const sheetSelection = results.match(/function openCandidateFromSheet\(evalItem: CandidateEval\)[\s\S]*?\n  }\n\n  function addSpotWithTransport/);
  assert.ok(sheetSelection);
  assert.match(sheetSelection[0], /setFocusedSpotId\(evalItem\.spot\.contentId\)/);
  assert.match(sheetSelection[0], /requestMapFocus\(evalItem\.spot\)/);
  assert.doesNotMatch(sheetSelection[0], /moveSheet\(/);
  assert.match(sheetSelection[0], /setTimeout\(\(\) => openTransportPicker\(evalItem\), 220\)/);
  assert.match(results, /onPress=\{\(\) => openCandidateFromSheet\(item\)\}/);
});

test('선택 장소로 지도 중심은 즉시 점프하지 않고 부드럽게 이동한다', () => {
  assert.match(kakaoMap, /map\.panTo\(focusCenter\(ll\(point\), offsetY\)\)/);
  assert.match(kakaoMap, /hasInitialRoute/);
  assert.match(results, /active: !focusedSpotId/);
  assert.match(results, /setMapFocusRequest\(\(previous\) => \(\{ \.\.\.previous, token: previous\.token \+ 1 \}\)\)/);
});
