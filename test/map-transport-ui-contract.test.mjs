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
const recommendationLoading = fs.readFileSync('src/ui/recommendation/RecommendationLoadingProgress.tsx', 'utf-8');
const explorationCard = fs.readFileSync('src/ui/recommendation/ExplorationPlaceCard.tsx', 'utf-8');
const courseConfirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf-8');
const legacyResults = fs.readFileSync('src/ui/OneStopResultsScreen.tsx', 'utf-8');
const execution = fs.readFileSync('src/ui/ExecutionScreen.tsx', 'utf-8');
const executionSchedule = fs.readFileSync('src/ui/execution/schedule.ts', 'utf-8');
const verifiedProgress = courseConfirm;
const courseConfirmV1 = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf-8');

test('메인은 한 가지 시작 행동과 진행 중 코스 진입점만 둔다', () => {
  assert.match(home, /약속 전 남는 시간,\{`\\n`\}어디 들러볼까요\?/);
  assert.match(home, /자투리 시간 설정하기/);
  assert.doesNotMatch(home, /TIMEFIT|도착 시간에 늦지 않도록/); // U-MAIN-COURSE-POLISH-01: redundant copy retired.
  assert.match(home, /진행 중인 코스/);
});

test('시간 설정은 통합 필드와 상시 분 단위 휠·여유를 입력한다', () => {
  assert.match(setup, /type Page = 'setup' \| 'test-clock'/);
  assert.match(setup, /UnifiedSetupInputs/);
  assert.doesNotMatch(setup, /route-setup|route-apply|time-picker/);
  assert.match(setup, /출발지로 돌아오기/);
  assert.match(setup, /도착 시각/);
  assert.doesNotMatch(setup, /현재 위치로 돌아오기/);
  assert.match(setup, /minimumValue=\{5\} maximumValue=\{30\} step=\{5\}/);
  assert.match(setup, /const \[arrivalBufferMin, setArrivalBufferMin\] = useState\(10\)/);
  assert.match(setup, /TimeWheel[^>]*values=\{MERIDIEMS\}/);
  assert.match(setup, /TimeWheel[^>]*values=\{HOURS_12\}/);
  assert.match(setup, /TimeWheel[^>]*values=\{MINUTES\}/);
  assert.match(setup, /releaseTimeSetupValidation/);
  assert.match(setup, /최대 3시간/);
  assert.match(setup, /const SHOW_TEST_CLOCK = typeof __DEV__ !== 'undefined' && __DEV__/);
  assert.match(setup, /testID="dev-test-clock"/);
  assert.match(setup, /테스트 현재 시각/);
});

test('수동 출발·도착 필드는 picker를 직접 열고 위치 권한·GPS를 요청하지 않는다', () => {
  const inputs = fs.readFileSync('src/ui/timeSetup/UnifiedSetupInputs.tsx', 'utf8');
  assert.match(inputs, /testID="route-origin-field"/);
  assert.match(inputs, /testID="route-destination-field"/);
  assert.match(inputs, /testID="route-return-origin"/);
  assert.match(setup, /testID="setup-footer"/);
  assert.doesNotMatch(setup, /expo-location|Location\.|getForegroundPermissionsAsync|requestForegroundPermissionsAsync|getCurrentPositionAsync|watchPositionAsync|navigator\.geolocation/);
  assert.doesNotMatch(setup, /origin-choice|location-permission|destination-choice/);
  assert.match(setup, /<MapPlacePicker/);
  assert.match(mapPicker, /onMapCenterChange=\{updateCenter\}/);
  assert.match(mapPicker, /labelAdapter: ReturnType<typeof createKakaoLocationLabelAdapter>/);
  assert.match(mapPicker, /labelAdapter\.resolve\(selected, 'pin_confirm'\)/);
  assert.match(kakaoMap, /onMapCenterChange\?: \(point: LatLon\) => void/);
});

test('출발지 검색은 관련성 순서만 제시하고 사용자의 명시 선택 전에는 확정하지 않는다', () => {
  assert.match(placePicker, /createKakaoLocationSearchAdapter/);
  assert.match(placePicker, /locationSearch\.search\(query\)/);
  assert.doesNotMatch(placePicker, /providerLineLabels/);
  assert.match(placePicker, /onOpenMap/);
  const draft = fs.readFileSync('src/ui/locationSearchDraft.ts', 'utf8');
  assert.match(draft, /selectedId: null/);
  assert.match(draft, /locationCandidateId/);
  assert.doesNotMatch(placePicker, /setMsg\(''\); setSel\(0\)/);
  assert.match(draft, /목록에서 위치를 선택하세요/);
  assert.match(placePicker, /onChangeText=\{changeQuery\}/);
  assert.match(placePicker, /setTimeout\(\(\) => \{[\s\S]*\}, 400\)/);
  assert.match(placePicker, /testID="location-search-input"/);
  assert.match(placePicker, /testID="location-confirm"/);
  assert.match(placePicker, /deviceLocation/);
  assert.match(placePicker, /value=\{state\.query\}/);
  assert.match(draft, /source: 'device'/);
  assert.doesNotMatch(placePicker, /testID="device-location-selection"/);
  assert.doesNotMatch(placePicker, /provider: 'kakao', label: '현재 위치'/);
  assert.match(draft, /장소 또는 주소 결과가 없어요/);
  assert.doesNotMatch(placePicker, /searchPlaceSuggestions|tmapPoiSearchMultiResult|kakaoGeocodeAddr\(query|geocodeAddr\(query/);
  assert.match(mapPicker, /testID="map-fixed-pin"/);
  assert.match(mapPicker, /onMapReady=\{\(\) => setMapReady\(true\)\}/);
  assert.match(mapPicker, /onMapError=\{\(\) => \{ setMapFailed\(true\); setMapReady\(false\); \}\}/);
  assert.match(mapPicker, /testID="map-retry"/);
  assert.doesNotMatch(mapPicker, /map-search-alternative|onSearch/);
  assert.match(mapPicker, /뒤로가서 검색/);
  assert.match(mapPicker, /initialCenter=\{center\}/);
  assert.match(mapPicker, /labelAdapter\.resolve\(selected, 'pin_confirm'\)/);
  assert.match(kakaoMap, /initialCenter\?: LatLon/);
  assert.doesNotMatch(mapPicker, /kakaoReverseGeocode\(/);
});

test('추천 계산은 V1 실제 경로 세션만 시작하고 legacy 차량·baseline을 호출하지 않는다', () => {
  assert.match(setup, /runRecommendationSession\(session, \{[\s\S]*routeProxyEnabled: input\.proxyEnabled,[\s\S]*captchaToken: input\.captchaToken,[\s\S]*onProgress:/);
  assert.doesNotMatch(setup, /candidateModes: \['walk', 'transit'\]|getActualRouteBaselines\(origin, target\)|planTimeFit\(/);
  assert.match(setup, /RecommendationLoadingProgress/);
  assert.match(recommendationLoading, /recommendationProgressItems\(stage\)/);
  assert.match(recommendationSession, /emitProgress\('input_ready'\)/);
  assert.match(recommendationSession, /emitProgress\('route_port_ready'\)/);
  assert.match(recommendationSession, /emitProgress\('verifying'\)/);
  assert.match(recommendationSession, /emitProgress\('complete'\)/);
});

test('UCAP-03: Proxy 활성화 때만 CAPTCHA·활성 경로를 사용하고 token을 화면 state·로그에 남기지 않는다', () => {
  assert.match(setup, /const \{ session: authSession, isLoading: isAuthLoading \} = useAuth\(\)/);
  assert.match(setup, /const routeProxyEnabled = process\.env\.EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true';/);
  assert.match(setup, /recommendationGateDecision\(\{ routeProxyEnabled, hasSession: Boolean\(authSession\), hasValidChallengeUrl: Boolean\(captchaChallengeUrl\) \}\)/);
  assert.match(setup, /resolveCaptchaChallengeUrl\(process\.env\.EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL\)/);
  assert.doesNotMatch(setup, /functions\/v1\/captcha-challenge|EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(setup, /<CaptchaVerificationSheet visible=\{captchaVisible\}/);
  assert.match(setup, /onVerified=\{verifiedCaptcha\}/);
  assert.doesNotMatch(setup, /useState[^\n]*(captchaToken|token)|setCaptchaToken/);
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
  assert.doesNotMatch(setup, /reason\.(message|cause)|console\.(log|warn|error)/);
  assert.match(setup, /if \(line\) console\.info\(line\)/);
  assert.doesNotMatch(setup, /console\.info\((?!line\))/);
});

test('URECDIAG01: 추천량 진단은 exact internal flag일 때만 Results 최하단에 표시하며 행동을 추가하지 않는다', () => {
  assert.match(results, /recommendationDiagnosticsEnabled\(process\.env\.EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS\)/);
  assert.match(results, /<RecommendationInternalDiagnosticsPanel diagnostics=\{recommendationInternalDiagnosticsModel\(engineResult, renderedCourseCount\)\} policy=\{recommendationInternalPolicyForEnvironment\(/);
  assert.doesNotMatch(results, /navigate\([^\n]*추천 진단|console\.(log|info|warn).*진단|fetch\([^\n]*진단/);
});

test('결과 진입점은 V1 대표 코스와 읽기 전용 확인 화면을 사용한다', () => {
  assert.doesNotMatch(resultEntry, /ConditionalVisitSection/); // U-RELEASE-UI-CLEANUP-01 retires Results entry only.
  assert.match(fs.readFileSync('src/ui/recommendation/ConditionalVisitSection.tsx', 'utf8'), /CourseV1Journey/);
  assert.match(resultEntry, /CourseConfirm/);
  assert.doesNotMatch(resultEntry, /OneStopResultsScreen|BasketPanel|candidateRadiusKm/);
});

test('URELEASEONESTOP01/UONEMORE01: 결과는 single 대표·누적 대안을 유지하고 폐기된 조건부 진입은 제거한다', () => {
  assert.match(results, /moreState\.representativeCourse/);
  assert.match(results, /no_representative_candidates/);
  assert.match(results, /courseV1OutcomeMessage\(result.primaryOutcomeReason\)/); // MAP02: empty resultState alone no longer asserts a cause.
  assert.match(fs.readFileSync('src/ui/recommendation/ConditionalVisitSection.tsx', 'utf8'), /CourseV1PlacePreview/);
  assert.match(results, /이 시간에 가능한 다른 장소/);
  assert.match(results, /releaseOneStopDisplayResult/);
  assert.match(results, /testID="verified-course-more"/);
  assert.match(results, /다른 장소 더 보기/);
  assert.match(results, /continueReleaseRecommendationSession/);
  assert.match(recommendationSession, /continueReleaseOneStopRepresentativeCourseV1/);
  assert.doesNotMatch(results, /continueRecommendationSession|continueLimitedRepresentativeCourseV1|다른 검증 코스 더 보기|검증 대안/);
  assert.match(fs.readFileSync('src/ui/recommendation/ConditionalVisitSection.tsx', 'utf8'), /운영시간 확인 후 들러볼 곳/);
  assert.match(fs.readFileSync('src/ui/recommendation/ConditionalVisitSection.tsx', 'utf8'), /운영시간을 카카오맵에서 확인해 주세요/);
  assert.doesNotMatch(results, /conditionalVisitPage/);
  assert.doesNotMatch(results, /AppState\.addEventListener/);
  assert.doesNotMatch(results, /millisecondsUntilConditionalVisibilityBoundary/);
  assert.doesNotMatch(results, /conditionalVisible \? <ConditionalVisitSection/);
  assert.doesNotMatch(results, /openKakaoPlace/);
  assert.doesNotMatch(results, /Linking\.canOpenURL/);
  assert.doesNotMatch(results, /WebBrowser\.openBrowserAsync/);
  assert.match(courseConfirm, /WebBrowser\.openBrowserAsync/);
  assert.match(courseConfirm, /Linking\.canOpenURL/);
  assert.doesNotMatch(results, /createCourseV1CandidateProvider\(\)\.listConditionalVisitCandidates/);
  assert.doesNotMatch(results, /runConditionalManualAction/);
  assert.match(fs.readFileSync('src/ui/recommendation/ConditionalVisitSection.tsx', 'utf8'), /확인했어요, 이 장소로 코스 계산/);
  assert.match(fs.readFileSync('src/ui/recommendation/ConditionalVisitSection.tsx', 'utf8'), /운영시간 확인 필요\(사용자 확인\)/);
  assert.doesNotMatch(results, /conditionalManualLocks\.tryLock/);
  assert.match(fs.readFileSync('src/ui/recommendation/ConditionalVisitSection.tsx', 'utf8'), /testID="conditional-visit-more"/);
  assert.doesNotMatch(results, /buildRecommendationExplorationPage|verifyRecommendationExplorationPlace|ExplorationPlaceCard/);
  assert.doesNotMatch(results, /지도에서 더 보기/);
  assert.doesNotMatch(results, /길찾기 시작|장바구니|buildBasketCourse/);
});

test('UKAKAO-DEEPLINK01: 활성·레거시 장소와 길찾기는 canOpenURL 확인 뒤 앱 우선으로 연다', () => {
  assert.match(legacyResults, /openKakaoPlaceWithAppFallback/);
  assert.match(legacyResults, /canOpenApp: Linking\.canOpenURL/);
  assert.match(legacyResults, /openBrowser: WebBrowser\.openBrowserAsync/);
  assert.doesNotMatch(legacyResults, /Linking\.openURL\(spot\.kakaoPlaceUrl/);
  assert.match(execution, /openKakaoRouteWithFallback/);
  assert.match(execution, /canOpenApp: Linking\.canOpenURL/);
  assert.match(execution, /openBrowser: WebBrowser\.openBrowserAsync/);
  assert.match(executionSchedule, /sp=\$\{from\.lat\},\$\{from\.lon\}/);
  assert.match(executionSchedule, /link\/by\/\$\{kakaoWebRouteMode\(mode\)\}/);
  assert.match(executionSchedule, /ports\.openBrowser\(webUrl\)/);
  assert.match(executionSchedule, /browser_background_observed/);
  assert.match(executionSchedule, /browser_fallback_cancelled/);
});

test('URELEASEONESTOP01: 새 V1 흐름은 체류 분을 숨기고 short 의미만 숫자 없이 표시한다', () => {
  const journey = fs.readFileSync('src/ui/recommendation/CourseV1Journey.tsx', 'utf-8');
  const preview = fs.readFileSync('src/ui/recommendation/CourseV1PlacePreview.tsx', 'utf-8');
  const listModel = fs.readFileSync('src/ui/recommendation/courseV1ResultListModel.ts', 'utf-8');

  assert.doesNotMatch(preview, /stayMin|stayState|courseV1StopDwellLabel/);
  assert.match(journey, /segment\.stayState === 'short'/);
  assert.match(journey, /가볍게 둘러보기/);
  assert.doesNotMatch(`${results}\n${journey}\n${preview}\n${courseConfirmV1}\n${verifiedProgress}`, /짧게 가능|활동 \$\{segment\.min\}분|분 머물기|출발 예정/);
  assert.doesNotMatch(`${results}\n${journey}\n${preview}`, /maxStay|minStay|최대\s*체류/);
  assert.doesNotMatch(`${results}\n${journey}\n${preview}`, /Slider|체류시간.*(수정|조절)|setStay/);
  assert.match(listModel, /remainingAfterCourseMin/);
  assert.doesNotMatch(listModel, /remainingAfterArrivalBufferMin/);
});

test('UPROGRESS01: V1 진행은 검증 snapshot과 명시 단계 전환만 사용하고 legacy 자동화 경계를 호출하지 않는다', () => {
  const progressModel = fs.readFileSync('src/ui/recommendation/verifiedCourseProgressModel.ts', 'utf-8');
  const progressContract = `${verifiedProgress}\n${progressModel}`;
  assert.match(verifiedProgress, /buildVerifiedCourseProgressSteps/);
  assert.match(verifiedProgress, /openKakaoRouteWithFallback/);
  assert.match(verifiedProgress, /카카오맵에서 길찾기/);
  assert.match(progressContract, /다음 장소 길찾기/);
  assert.match(progressContract, /도착지 길찾기/);
  assert.match(progressContract, /복귀 길찾기/);
  assert.match(verifiedProgress, /도착 후 코스 마치기/);
  assert.match(verifiedProgress, /requestNextVerifiedCourseRoute/);
  assert.match(verifiedProgress, /routeOpenLock\.tryLock/);
  assert.match(courseConfirmV1, /코스 시작하기/);
  assert.doesNotMatch(courseConfirmV1, /코스 시작 · 첫 장소 길찾기/);
  assert.match(verifiedProgress, /resetToMain/);
  assert.doesNotMatch(verifiedProgress, /resetToMyCourses/);
  assert.doesNotMatch(verifiedProgress, /expo-location|Location\.|useAppFlow|scheduleCourseNotifications|planTimeFit|Route Proxy|Live Activity|AsyncStorage|supabase/);
});
