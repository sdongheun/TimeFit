import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf-8');
const home = fs.readFileSync('src/ui/HomeScreen.tsx', 'utf-8');
const results = fs.readFileSync('src/ui/OneStopResultsScreen.tsx', 'utf-8');
const resultEntry = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf-8');
const mapPicker = fs.readFileSync('src/ui/MapPlacePicker.tsx', 'utf-8');
const kakaoMap = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf-8');

test('메인은 한 가지 시작 행동과 진행 중 코스 진입점만 둔다', () => {
  assert.match(home, /지금 남는 시간을\{`\\n`\}정해볼까요\?/);
  assert.match(home, /자투리 시간 설정하기/);
  assert.match(home, /도착 시간에 늦지 않도록/);
  assert.match(home, /진행 중인 코스/);
});

test('시간 설정은 위치·도착지·분 단위 시각과 여유를 분리해서 입력한다', () => {
  assert.match(setup, /type Page = 'setup' \| 'origin-choice' \| 'location-permission' \| 'destination-choice' \| 'time-picker' \| 'test-clock' \| 'loading'/);
  assert.match(setup, /현재 위치/);
  assert.match(setup, /도착지\/복귀/);
  assert.match(setup, /도착 시각/);
  assert.match(setup, /현재 위치로 돌아오기/);
  assert.match(setup, /minimumValue=\{5\} maximumValue=\{30\} step=\{5\}/);
  assert.match(setup, /const \[arrivalBufferMin, setArrivalBufferMin\] = useState\(10\)/);
  assert.match(setup, /TimeWheel values=\{HOURS_12\}/);
  assert.match(setup, /TimeWheel values=\{MINUTES\}/);
  assert.match(setup, /const MAX_MINUTES = 120/);
  assert.match(setup, /const SHOW_TEST_CLOCK = typeof __DEV__ !== 'undefined' && __DEV__/);
  assert.match(setup, /testID="dev-test-clock"/);
  assert.match(setup, /테스트 현재 시각/);
});

test('위치 권한은 내 위치 사용 행동 뒤에만 요청하고 지도 직접 선택을 제공한다', () => {
  assert.match(setup, /onPress=\{\(\) => setPage\('location-permission'\)\}/);
  assert.match(setup, /Location\.requestForegroundPermissionsAsync\(\)/);
  assert.match(setup, /지도에서 직접 선택/);
  assert.match(setup, /<MapPlacePicker/);
  assert.match(mapPicker, /onMapTap=\{setPoint\}/);
  assert.match(kakaoMap, /onMapTap\?: \(point: LatLon\) => void/);
});

test('추천 계산은 차량을 후보 수단으로 넣지 않고 실제 계산 단계를 표시한다', () => {
  assert.match(setup, /candidateModes: \['walk', 'transit'\]/);
  assert.match(setup, /getActualRouteBaselines\(origin, target\)/);
  assert.match(setup, /현재 위치와 도착지 확인/);
  assert.match(setup, /이동 가능한 범위 계산/);
  assert.match(setup, /짧게 들를 장소 찾기/);
  assert.match(setup, /운영 상태 확인/);
});

test('결과 진입점은 이전 다중 장소 화면을 포함하지 않고 단일 장소 화면으로 위임한다', () => {
  assert.match(resultEntry, /return <OneStopResultsScreen \{\.\.\.props\} \/>/);
  assert.doesNotMatch(resultEntry, /LegacyResultsScreen|BasketPanel|candidateRadiusKm/);
});

test('결과는 대표 한 곳, 새 추천, 지도 보조 탐색, 상태 유지 상세를 제공한다', () => {
  assert.match(results, /type Page = 'results' \| 'map' \| 'detail' \| 'hours' \| 'confirm'/);
  assert.match(results, /지금 할 수 있는 한 가지/);
  assert.match(results, /setRecommendationIndex\(\(value\) => value \+ 1\)/);
  assert.match(results, /지도에서 더 보기/);
  assert.match(results, /KakaoRouteMap/);
  assert.match(results, /status === 'recommended' \? '추천' : status === 'short' \? '빠듯' : '불가'/);
  assert.match(results, /운영시간 확인 필요/);
  assert.match(results, /카카오맵에서 장소 확인/);
  assert.match(results, /TimeJourney/);
  assert.match(results, /buildTimeJourney/);
  assert.match(results, /이곳 선택하기/);
  assert.match(results, /길찾기 시작/);
});
