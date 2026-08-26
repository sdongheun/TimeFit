import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf-8');
const home = fs.readFileSync('src/ui/HomeScreen.tsx', 'utf-8');
const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf-8');
const resultEntry = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf-8');
const mapPicker = fs.readFileSync('src/ui/MapPlacePicker.tsx', 'utf-8');
const kakaoMap = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf-8');
const placePicker = fs.readFileSync('src/ui/PlacePicker.tsx', 'utf-8');

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
  assert.match(setup, /const MAX_MINUTES = 180/);
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

test('출발지 검색은 관련성 순서만 제시하고 사용자의 명시 선택 전에는 확정하지 않는다', () => {
  assert.match(placePicker, /searchPlaceSuggestions/);
  assert.match(placePicker, /diagnosePlaceSearchSuggestions/);
  assert.match(placePicker, /placeSearchDisplayStateFromResults/);
  assert.match(placePicker, /placeSuggestionLineLabel/);
  assert.match(placePicker, /setSel\(initialPlaceSearchSelection\)/);
  assert.doesNotMatch(placePicker, /setMsg\(''\); setSel\(0\)/);
  assert.match(placePicker, /목록에서 위치를 선택하세요/);
  assert.match(placePicker, /onChangeText=\{changeQuery\}/);
  assert.match(placePicker, /장소명 결과가 없어요/);
  assert.doesNotMatch(placePicker, /kakaoGeocodeAddr\(query|geocodeAddr\(query/);
});

test('추천 계산은 V1 실제 경로 세션만 시작하고 legacy 차량·baseline을 호출하지 않는다', () => {
  assert.match(setup, /runRecommendationSession\(session\)/);
  assert.doesNotMatch(setup, /candidateModes: \['walk', 'transit'\]|getActualRouteBaselines\(origin, target\)|planTimeFit\(/);
  assert.match(setup, /현재 위치와 도착지 확인/);
  assert.match(setup, /이동 가능한 범위 계산/);
  assert.match(setup, /짧게 들를 장소 찾기/);
  assert.match(setup, /운영 상태 확인/);
});

test('결과 진입점은 V1 대표 코스와 읽기 전용 확인 화면을 사용한다', () => {
  assert.match(resultEntry, /CourseV1Journey/);
  assert.match(resultEntry, /CourseConfirm/);
  assert.doesNotMatch(resultEntry, /OneStopResultsScreen|BasketPanel|candidateRadiusKm/);
});

test('결과는 대표 1~3곳, 검증 대안, 두 빈 상태를 제공한다', () => {
  assert.match(results, /result\.representativeCourse/);
  assert.match(results, /no_representative_candidates/);
  assert.match(results, /no_verified_course_within_limit/);
  assert.match(results, /CourseV1PlacePreview/);
  assert.match(results, /openKakaoPlace/);
  assert.doesNotMatch(results, /지도에서 더 보기/);
  assert.match(results, /이 시간에 가능한 다른 코스/);
  assert.match(results, /buildCourseV1AlternativeList/);
  assert.doesNotMatch(results, /advanceVerifiedAlternative|새 추천/);
  assert.doesNotMatch(results, /representative\.remainingAfterCourseMin/);
  assert.doesNotMatch(results, /길찾기 시작|장바구니|buildBasketCourse/);
});

test('V1 결과는 엔진의 권장 체류와 단일 남는 시간 스냅샷만 표시하며 최대 체류를 새로 만들지 않는다', () => {
  const journey = fs.readFileSync('src/ui/recommendation/CourseV1Journey.tsx', 'utf-8');
  const preview = fs.readFileSync('src/ui/recommendation/CourseV1PlacePreview.tsx', 'utf-8');
  const listModel = fs.readFileSync('src/ui/recommendation/courseV1ResultListModel.ts', 'utf-8');

  assert.match(preview, /stayMin\?: number/);
  assert.doesNotMatch(`${results}\n${journey}\n${preview}`, /maxStay|minStay|최대\s*체류/);
  assert.match(listModel, /remainingAfterCourseMin/);
  assert.doesNotMatch(listModel, /remainingAfterArrivalBufferMin/);
});
