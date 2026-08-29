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
const captchaSheet = fs.readFileSync('src/ui/CaptchaVerificationSheet.tsx', 'utf-8');
const recommendationSession = fs.readFileSync('src/ui/recommendation/v1Session.ts', 'utf-8');

test('메인은 한 가지 시작 행동과 진행 중 코스 진입점만 둔다', () => {
  assert.match(home, /지금 남는 시간을\{`\\n`\}정해볼까요\?/);
  assert.match(home, /자투리 시간 설정하기/);
  assert.match(home, /도착 시간에 늦지 않도록/);
  assert.match(home, /진행 중인 코스/);
});

test('시간 설정은 단일 경로 설정과 분 단위 시각·여유를 분리해서 입력한다', () => {
  assert.match(setup, /type Page = 'setup' \| 'route-setup'/);
  assert.match(setup, /경로 설정하기/);
  assert.match(setup, /출발지로 돌아오기/);
  assert.match(setup, /도착 시각/);
  assert.doesNotMatch(setup, /현재 위치로 돌아오기/);
  assert.match(setup, /minimumValue=\{5\} maximumValue=\{30\} step=\{5\}/);
  assert.match(setup, /const \[arrivalBufferMin, setArrivalBufferMin\] = useState\(10\)/);
  assert.match(setup, /TimeWheel values=\{HOURS_12\}/);
  assert.match(setup, /TimeWheel values=\{MINUTES\}/);
  assert.match(setup, /const MAX_MINUTES = 180/);
  assert.match(setup, /const SHOW_TEST_CLOCK = typeof __DEV__ !== 'undefined' && __DEV__/);
  assert.match(setup, /testID="dev-test-clock"/);
  assert.match(setup, /테스트 현재 시각/);
});

test('경로 설정은 하나의 진입점에서 출발·도착을 함께 설정하고 권한은 명시 GPS 행동에서만 요청한다', () => {
  assert.match(setup, /testID="route-setup-entry"/);
  assert.match(setup, /testID="route-origin-field"/);
  assert.match(setup, /testID="route-destination-field"/);
  assert.match(setup, /testID="route-apply"/);
  assert.match(setup, /Location\.getForegroundPermissionsAsync\(\)/);
  assert.doesNotMatch(setup, /origin-choice|location-permission|destination-choice|requestForegroundPermissionsAsync/);
  assert.match(setup, /<MapPlacePicker/);
  assert.match(mapPicker, /onMapCenterChange=\{updateCenter\}/);
  assert.match(mapPicker, /labelAdapter: ReturnType<typeof createKakaoLocationLabelAdapter>/);
  assert.match(mapPicker, /labelAdapter\.resolve\(selected, 'pin_confirm'\)/);
  assert.match(kakaoMap, /onMapCenterChange\?: \(point: LatLon\) => void/);
});

test('출발지 검색은 관련성 순서만 제시하고 사용자의 명시 선택 전에는 확정하지 않는다', () => {
  assert.match(placePicker, /createKakaoLocationSearchAdapter/);
  assert.match(placePicker, /locationSearch\.search\(query\)/);
  assert.match(placePicker, /providerLineLabels/);
  assert.match(placePicker, /onOpenMap/);
  assert.match(placePicker, /setSel\(initialPlaceSearchSelection\)/);
  assert.doesNotMatch(placePicker, /setMsg\(''\); setSel\(0\)/);
  assert.match(placePicker, /목록에서 위치를 선택하세요/);
  assert.match(placePicker, /onChangeText=\{changeQuery\}/);
  assert.match(placePicker, /setTimeout\(\(\) => \{[\s\S]*\}, 400\)/);
  assert.match(placePicker, /testID="location-search-input"/);
  assert.match(placePicker, /testID="location-confirm"/);
  assert.match(placePicker, /deviceLocation/);
  assert.match(placePicker, /기기 위치/);
  assert.doesNotMatch(placePicker, /provider: 'kakao', label: '현재 위치'/);
  assert.match(placePicker, /장소 또는 주소 결과가 없어요/);
  assert.doesNotMatch(placePicker, /searchPlaceSuggestions|tmapPoiSearchMultiResult|kakaoGeocodeAddr\(query|geocodeAddr\(query/);
  assert.match(mapPicker, /testID="map-fixed-pin"/);
  assert.match(mapPicker, /onMapReady=\{\(\) => setMapReady\(true\)\}/);
  assert.match(mapPicker, /onMapError=\{\(\) => \{ setMapFailed\(true\); setMapReady\(false\); \}\}/);
  assert.match(mapPicker, /testID="map-retry"/);
  assert.match(mapPicker, /testID="map-search-alternative"/);
  assert.match(mapPicker, /initialCenter=\{center\}/);
  assert.match(mapPicker, /labelAdapter\.resolve\(selected, 'pin_confirm'\)/);
  assert.match(kakaoMap, /initialCenter\?: LatLon/);
  assert.doesNotMatch(mapPicker, /kakaoReverseGeocode\(/);
});

test('추천 계산은 V1 실제 경로 세션만 시작하고 legacy 차량·baseline을 호출하지 않는다', () => {
  assert.match(setup, /runRecommendationSession\(session, \{ routeProxyEnabled: proxyEnabled, captchaToken \}\)/);
  assert.doesNotMatch(setup, /candidateModes: \['walk', 'transit'\]|getActualRouteBaselines\(origin, target\)|planTimeFit\(/);
  assert.match(setup, /현재 위치와 도착지 확인/);
  assert.match(setup, /이동 가능한 범위 계산/);
  assert.match(setup, /짧게 들를 장소 찾기/);
  assert.match(setup, /운영 상태 확인/);
});

test('UCAP-03: Proxy 활성화 때만 CAPTCHA·활성 경로를 사용하고 token을 화면 state·로그에 남기지 않는다', () => {
  assert.match(setup, /const \{ session: authSession, isLoading: isAuthLoading \} = useAuth\(\)/);
  assert.match(setup, /const routeProxyEnabled = process\.env\.EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true';/);
  assert.match(setup, /recommendationGateDecision\(\{ routeProxyEnabled, hasSession: Boolean\(authSession\), hasValidChallengeUrl: Boolean\(captchaChallengeUrl\) \}\)/);
  assert.match(setup, /resolveCaptchaChallengeUrl\(process\.env\.EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL\)/);
  assert.doesNotMatch(setup, /functions\/v1\/captcha-challenge|EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(setup, /<CaptchaVerificationSheet visible=\{captchaVisible\}/);
  assert.match(setup, /onVerified=\{\(token\) => \{ setCaptchaVisible\(false\); void startRecommendation\(token, true\); \}\}/);
  assert.match(recommendationSession, /if \(!options\.routeProxyEnabled\) return \{ routes: dependencies\.createLegacyRoutes\(\) \}/);
  assert.match(recommendationSession, /return \{ routes: activatedRoutes, receiptRoutes: activatedRoutes \}/);
  assert.match(recommendationSession, /throw new RouteProxyUnavailableError\(\)/);
  assert.match(recommendationSession, /createActivatedCourseV1RouteAdapter/);
  assert.match(recommendationSession, /if \(!dependencies\.createActivatedProxyRoutes\) throw new RouteProxyUnavailableError\(\)/);
  assert.match(captchaSheet, /onShouldStartLoadWithRequest/);
  assert.match(captchaSheet, /originWhitelist=\{captchaAllowedOrigins\(validChallengeUrl\)\}/);
  assert.match(captchaSheet, /captchaNavigationFailure\(request\.url, validChallengeUrl, request\.isTopFrame\)/);
  assert.match(captchaSheet, /isTrustedCaptchaMessageSource\(event\.nativeEvent\.url, validChallengeUrl\)/);
  assert.match(captchaSheet, /setSupportMultipleWindows=\{false\}/);
  assert.match(captchaSheet, /onMessage=/);
  assert.match(captchaSheet, /onVerified\(message\.token\)/);
  assert.doesNotMatch(captchaSheet, /console\.(log|info|warn).*token|useState\([^)]*token/i);
});

test('UCAP-08: CAPTCHA 진단은 internal flag에서만 enum을 보이고 raw WebView 오류를 표시·로그하지 않는다', () => {
  assert.match(captchaSheet, /captchaDiagnosticsEnabled\(process\.env\.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS\)/);
  assert.match(captchaSheet, /testID="captcha-diagnostic"/);
  assert.match(captchaSheet, /CAPTCHA 진단: \{diagnostic\}/);
  assert.doesNotMatch(captchaSheet, /nativeEvent\.(description|statusCode)|console\.(log|info|warn|error)/);
});

test('UCAP-09: Route Proxy reason은 internal diagnostics에서만 화면 state로 표시한다', () => {
  assert.match(setup, /const captchaDiagnosticsEnabled = process\.env\.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS === 'true';/);
  assert.match(setup, /recommendationFailureDisplay\(reason, captchaDiagnosticsEnabled\)/);
  assert.match(setup, /testID="route-proxy-diagnostic"/);
  assert.match(setup, /CAPTCHA 진단: \{captchaDiagnostic\}/);
  assert.doesNotMatch(setup, /reason\.(message|cause)|console\.(log|info|warn|error)/);
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
