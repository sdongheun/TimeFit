import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf-8');
const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf-8');
const candidateList = fs.readFileSync('src/ui/recommendation/CandidateList.tsx', 'utf-8');
const recommendationTypes = fs.readFileSync('src/ui/recommendation/types.ts', 'utf-8');
const transportGlyph = fs.readFileSync('src/ui/recommendation/TransportGlyph.tsx', 'utf-8');
const candidateDetail = fs.readFileSync('src/ui/recommendation/CandidateDetail.tsx', 'utf-8');
const candidateEvaluation = fs.readFileSync('src/ui/recommendation/candidateEvaluation.ts', 'utf-8');
const mapControls = fs.readFileSync('src/ui/recommendation/MapControls.tsx', 'utf-8');
const sheetLayout = fs.readFileSync('src/ui/recommendation/sheetLayout.ts', 'utf-8');
const kakaoMap = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf-8');

test('시간 입력은 이동수단을 미리 선택하지 않고 비교용 후보 지도를 연다', () => {
  assert.doesNotMatch(setup, /const \[mode, setMode\]/);
  assert.match(setup, /candidateModes: \['walk', 'transit', 'car'\]/);
  assert.match(setup, /getActualRouteBaselines\(origin, destination\)/);
  assert.doesNotMatch(setup, /@react-native-community\/slider/);
  assert.match(setup, /radiusM: 8000/);
  assert.match(setup, /mapExploration: true/);
  assert.match(setup, /routeBaselines: baseline\?\.baselines/);
  assert.match(setup, /modeLabel: '이동수단 비교'/);
});

test('탐색 반경은 지도에서만 조절하며 슬라이더 조작은 API를 다시 호출하지 않는다', () => {
  assert.match(results, /import Slider from ["']@react-native-community\/slider["']/);
  assert.match(results, /const DEFAULT_RADIUS_KM = 1/);
  assert.match(results, /const MAX_RADIUS_KM = 8/);
  assert.match(results, /const \[candidateRadiusKm, setCandidateRadiusKm\]/);
  assert.match(results, /createActualRouteSearchScope/);
  assert.match(results, /isPointInActualRouteSearchScope/);
  assert.match(results, /radiusM: candidateRadiusKm \* 1000/);
  const slider = results.match(/<Slider[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(slider, /onValueChange=\{\(value\) => setCandidateRadiusKm\(Math\.round\(value\)\)\}/);
  assert.doesNotMatch(slider, /getActualRouteBaselines|planTimeFit|fetch\(/);
});

test('후보 지도는 전역 이동수단 필터 없이 장소 미리보기에서 구간 수단을 조정한다', () => {
  assert.doesNotMatch(results, /MAP_TRANSPORT_FILTERS/);
  assert.doesNotMatch(results, /availabilityByMode/);
  assert.match(results, /openTransportPicker/);
  assert.match(candidateDetail, /modePicker/);
  assert.match(mapControls, /코스 만들기 · \{remainingMin\}분 남음/);
});

test('장소 후보 필터는 분위기·활동 대신 가로 스크롤 카테고리 칩으로 제공한다', () => {
  assert.match(recommendationTypes, /label: "음식점", category: "식당"/);
  assert.match(recommendationTypes, /label: "자연관광", category: "자연관광지"/);
  assert.match(candidateList, /horizontal/);
  assert.match(candidateList, /showsHorizontalScrollIndicator=\{false\}/);
  assert.match(candidateEvaluation, /spot\.category === categoryFilter/);
  assert.doesNotMatch(results, /MOODS\.map/);
  assert.doesNotMatch(results, /ACTS\.map/);
});

test('장소 후보 수는 기본·확장 시트에서 공통으로 표시한다', () => {
  assert.match(results, /sheetPosition !== "collapsed" && !pendingTransportItem/);
  assert.match(results, /장소 후보 \{filtered\.length\}/);
  assert.match(results, /sheetCandidateCount/);
  assert.doesNotMatch(results, /expandedHeader/);
  assert.match(results, /\{page === "recommend" \? \(\s*<View style=\{\[s\.mapTopBar/);
  assert.match(results, /mapTopBar:[\s\S]*zIndex: 6/);
  assert.match(results, /candidateSheetExpanded: \{ zIndex: 7 \}/);
});

test('장소 목록은 탐색용이며 확장 시트에서 경로·체류·담기 판단을 제공한다', () => {
  assert.match(results, /onCandidatePress=\{openCandidateFromSheet\}/);
  assert.doesNotMatch(results, /카카오맵에서 장소 자세히 보기/);
  assert.doesNotMatch(results, /이곳 들르기/);
  assert.match(candidateDetail, /장바구니에 담기/);
  assert.doesNotMatch(results, /<Modal/);
  assert.match(results, /function renderCandidateDetail\(\)/);
  assert.match(candidateDetail, /media:/);
  assert.match(candidateDetail, /카카오맵에서 보기/);
  assert.match(results, /function openKakaoPlace\(spot: Spot\)/);
});

test('장바구니 전환은 추천 목록의 이전 스크롤 위치를 이어받지 않는다', () => {
  assert.match(results, /<Animated\.View\s+\/\/ 추천 시트의 native translateY[\s\S]*key=\{page\}/);
});

test('장소 목록은 현재 위치 거리와 도보·버스·차량 가능 상태를 먼저 보여준다', () => {
  assert.match(candidateList, /function distanceFromOriginLabel/);
  assert.match(candidateList, /현재 위치 \$\{km\.toFixed\(1\)\}km/);
  assert.match(transportGlyph, /name="walk"/);
  assert.match(transportGlyph, /name="bus"/);
  assert.match(transportGlyph, /name="car"/);
  assert.match(candidateList, /item\.availableModes\.includes\(mode\)/);
  assert.doesNotMatch(candidateList, /출발지 근처/);
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
  assert.match(results, /recommendationSheetLayout\(/);
  assert.match(results, /mapFocusOffsetY\(\s*sheetLayout,\s*sheetPosition,\s*insets\.bottom/);
  assert.match(results, /recenterOffsetY=\{mapFocusOffsetYForSheet\}/);
  assert.match(results, /candidateListEndSpace\(\s*sheetLayout,\s*sheetPosition,\s*insets\.bottom/);
  assert.match(results, /height: page === "recommend" \? candidateListBottomSpace : 120/);
  assert.match(sheetLayout, /const EXPANDED_RATIO = 0\.9/);
  assert.match(sheetLayout, /const DEFAULT_RATIO = 0\.56/);
  assert.match(sheetLayout, /const COLLAPSED_CONTROL_HEIGHT = 82/);
});

test('지도 마커 탭은 장소 카드를 포커스할 뿐 이동수단 패널을 바로 열지 않는다', () => {
  const focusCandidate = results.match(/function focusCandidate\(markerIndex: number\)[\s\S]*?\n  }\n\n  const candidateMapPoints/);
  assert.ok(focusCandidate);
  assert.match(focusCandidate[0], /setFocusedSpotId\(contentId\)/);
  assert.match(focusCandidate[0], /moveSheet\("default"\)/);
  assert.match(focusCandidate[0], /candidateListRef\.current\?\.scrollTo/);
  assert.doesNotMatch(focusCandidate[0], /openTransportPicker/);
});

test('시트의 장소 카드 탭은 현재 시트 높이를 유지한 채 같은 장소 상세를 연다', () => {
  const sheetSelection = results.match(/function openCandidateFromSheet\(evalItem: CandidateEval\)[\s\S]*?\n  }\n\n  function closeCandidateDetail/);
  assert.ok(sheetSelection);
  assert.match(sheetSelection[0], /setFocusedSpotId\(evalItem\.spot\.contentId\)/);
  assert.match(sheetSelection[0], /requestMapFocus\(evalItem\.spot\)/);
  assert.doesNotMatch(sheetSelection[0], /moveSheet\(/);
  assert.match(sheetSelection[0], /openTransportPicker\(evalItem\)/);
  assert.match(results, /onCandidatePress=\{openCandidateFromSheet\}/);
  assert.match(candidateDetail, /name="chevron-down"/);
  assert.match(results, /function closeCandidateDetail\(\)/);
  assert.match(results, /detailTranslateY/);
  assert.match(results, /detailOpacity/);
  assert.match(results, /closeCandidateDetail\(\);/);
  assert.match(candidateDetail, /root: \{ padding: 18, paddingTop: 4, paddingBottom: 120 \}/);
  assert.match(candidateList, /card: \{[\s\S]*minHeight: 116/);
  assert.match(candidateList, /spotName: \{[\s\S]*marginTop: 6/);
  assert.match(candidateList, /modeAvailability: \{ flexDirection: "row", gap: 8, marginTop: 12 \}/);
  assert.match(candidateList, /cardChevron: \{ alignSelf: "center", marginTop: 10 \}/);
});

test('선택 장소로 지도 중심은 즉시 점프하지 않고 부드럽게 이동한다', () => {
  assert.match(kakaoMap, /map\.panTo\(focusCenter\(ll\(point\), offsetY\)\)/);
  assert.match(kakaoMap, /hasInitialRoute/);
  assert.match(results, /active: !focusedSpotId/);
  assert.match(results, /setMapFocusRequest\(\(previous\) => \(\{[\s\S]*token: previous\.token \+ 1[\s\S]*\}\)\)/);
});
