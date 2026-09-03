# U-KAKAO-DEEPLINK-01 — 설치된 카카오맵 앱 직접 열기

## 목적

QA-EXPLORE-01은 웹 전환·browser fallback·앱 복귀를 수락했다. 그러나 HTTPS 웹 링크는 설치된 카카오맵 앱에서 “웹에서 앱으로 이동” 확인을 한 번 더 보일 수 있다. 이 작업은 설치된 앱에는 공식 scheme으로 바로 전환하고, 미설치 기기에는 현행 웹 fallback을 유지한다.

## 공식 계약

카카오 공식 URL scheme 기준으로 앱 6.0.0 이상은 `kakaomap://place?id={placeId}`로 장소를, `kakaomap://look?p={lat},{lon}`으로 좌표를 연다. 앱이 없을 때는 모바일웹 scheme 또는 HTTPS 웹 전환을 사용한다. 이 프로젝트는 앱스토어 설치 유도를 하지 않고 현재 HTTPS/browser fallback을 유지한다.

## 수행 범위

1. iOS의 `LSApplicationQueriesSchemes`에 `kakaomap`만 추가한다. Expo 설정 원본과 생성 iOS 설정을 동기화한다.
2. UI 전용 opener가 먼저 `Linking.canOpenURL`로 `kakaomap://` 가능 여부를 확인한다.
   - `mapVerification.status === verified`이고 숫자 Place ID가 있으면 `kakaomap://place?id={id}`를 쓴다.
   - 그 외에는 유효 좌표만 가진 `kakaomap://look?p={lat},{lon}`를 쓴다. `weak` 상세 URL이나 이름 추정으로 place ID를 만들지 않는다.
3. 가능·성공이면 `app_opened`으로 끝낸다. 미설치(`canOpenURL=false`) 또는 scheme open 실패는 기존 `openKakaoPlaceWithBrowserFallback`의 HTTPS 외부→browser fallback으로 정확히 한 번만 이어 간다.
4. Results 탐색/대표와 CourseConfirm의 모든 장소 링크가 같은 opener를 쓴다. `ExecutionScreen`의 길찾기 scheme도 `canOpenURL` 확인 뒤 앱→HTTPS fallback을 같은 원칙으로 처리한다. `LegacyResults`가 배포 경로에 남아 있으면 raw HTTPS 장소 링크를 공통 opener로 교체하거나, 비활성 경로임을 코드·네비게이션에서 증명한다. Kakao REST, route/receipt, 추천·선택 상태, 카탈로그는 수정하지 않는다.

## 금지

- `canOpenURL` 확인 없이 `kakaomap://`를 열어 앱스토어 설치 화면을 강제하는 것.
- app 미설치를 오류로 표현하거나 Kakao 앱 설치를 요구하는 것.
- raw URL·좌표·예외를 사용자·로그·internal diagnostics에 노출하는 것.
- 링크 행동에서 경로 검증, 추천 재계산, provider 호출을 만드는 것.

## 필수 검증

- installed direct place / coordinate direct / app open 실패→HTTPS / app 미설치→HTTPS / HTTPS 실패→browser / 모두 실패를 mock으로 검증한다.
- 모든 링크 분기에서 route·receipt·선택 검증 0회, 선택 CTA의 기존 호출 수 불변을 검증한다.
- `npm run test:typecheck`, `npm run test:ui`, 관련 UI 테스트, `git diff --check`를 실행한다.
- **새 internal build**에서 카카오맵 설치 실기기는 다대포 verified place를 직접 앱으로 열고 복귀한다. 카카오맵이 없는 시뮬레이터/기기는 browser fallback을 확인한다.

## 인계

변경 파일·iOS native sync 결과·테스트·installed/uninstalled 실기기 결과를 기록한다. 보드는 수정하지 않는다.

## 완료 인계 — 2026-08-31

### 1. 변경 파일·목적

- `src/ui/recommendation/courseV1PlacePreviewModel.ts`: `buildKakaoMapAppUrl`과 `openKakaoPlaceWithAppFallback`을 추가했다. `verified` 숫자 Place ID는 공식 `kakaomap://place`, 그 밖의 유효 좌표는 `kakaomap://look`을 사용하고, 앱 분기 실패 뒤에만 기존 HTTPS/browser 흐름으로 넘긴다.
- `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: 대표·탐색·코스 확인의 모든 기존 장소 링크를 공통 deep-link opener에 연결했다.
- `test/ui/course-v1-place-preview.test.ts`, `test/map-transport-ui-contract.test.mjs`: installed place/coordinate, 미설치, scheme open 실패→HTTPS/browser, 모든 단계 실패·URL 불가와 두 화면 공통 연결을 고정했다.
- `app.json`, `ios/mobile/Info.plist`: Expo iOS 원본과 생성 plist의 `LSApplicationQueriesSchemes`에 `kakaomap`만 추가했다.

### 2. 유지한 계약·정책 경계

- `canOpenURL` 확인 없이 app scheme을 열지 않는다. 미설치는 오류·설치 유도로 표현하지 않고 현행 HTTPS/browser fallback을 유지한다.
- `weak` URL·이름으로 Place ID를 추정하지 않는다. browser fallback은 항상 안전한 HTTPS 검색 URL을 한 번만 사용한다.
- link 분기는 route adapter·receipt·선택 검증·추천 재계산·카탈로그·완료 기록을 호출하거나 바꾸지 않는다. 보드·엔진·데이터·Route Proxy는 수정하지 않았다.

### 3. 테스트·iOS 동기화 결과

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과 (139 pass, 기존 철회 시나리오 1 skip).
- `npm test` 통과 (105 tests).
- `plutil -lint ios/mobile/Info.plist` 통과.
- `git diff --check` 통과.
- iOS Simulator Debug build의 산출물 생성 확인: `/private/tmp/timefit-kakao-deeplink-build/Build/Products/Debug-iphonesimulator/mobile.app`. 기존 RN dependency warning 외 빌드 차단 오류는 없었다.
- 모든 자동 검증은 mock만 사용했으며 실제 카카오맵·route API·CAPTCHA·Supabase 호출은 0회다.

### 3-1. 통합 확인 보완 — 2026-08-31

현재 `ResultsScreen`과 `CourseConfirmScreen`은 공통 app-first opener를 사용한다. 반면 `ExecutionScreen`은 직접 `kakaomap://route`를 열지만 `canOpenURL` guard가 없고, `LegacyResults`는 raw HTTPS 장소 링크를 유지한다. 사용자가 어느 화면에서든 설치된 카카오맵을 우선 열어야 한다는 제품 요구에 맞추려면 위 수행 범위 4를 보완한 뒤에만 최종 수락한다. 이 보완은 새 작업 ID를 만들지 않고 U-KAKAO-DEEPLINK-01에 포함한다.

### 3-2. 실기기 fallback 원인 판별 — 필수

새 native internal build에서도 Safari의 `applink.map.kakao.com`이 먼저 보이면, 이는 common opener가 `kakaomap://…`을 성공적으로 연 것이 아니라 `canOpenURL=false` 또는 scheme open 실패 뒤 HTTPS fallback으로 들어간 것이다. 다음을 internal build에서 한 번만 확인한다.

1. 실제 설치 binary의 `Info.plist`에 `LSApplicationQueriesSchemes = kakaomap`이 있는지 확인한다.
2. 설치된 카카오맵에서 `kakaomap://open` 및 실제 place/look URL의 `canOpenURL` 결과와 open 결과를 비밀 없는 `app_scheme_available` / `app_scheme_unavailable` / `app_scheme_open_failed` enum으로만 내부 진단에 남긴다.
3. source·테스트에서 scheme이 맞더라도 위 두 값 중 실패한 지점을 고친다. HTTPS를 먼저 여는 우회나 앱 설치 안내는 해결책이 아니다.

**진단 보류 기준:** enum은 URL·좌표·원시 예외를 포함하지 않아야 한다. 다만 공모전 현재 단계에서는 새 진단 UI를 추가하지 않는다. 아래 실기기 관찰처럼 카카오 제공사/iOS가 applink 페이지와 `카카오맵에서 열겠습니까?` 확인을 거친 뒤 정상 앱 전환하는 경우는 fallback 실패가 아니라 허용 가능한 외부 handoff로 기록한다. 이후 앱 전환 자체가 실패하거나 사용성 문제가 확인될 때만 `app_scheme_unavailable` / `app_scheme_open_failed` 내부 진단을 재개한다.

### 3-3. 통합 보완 구현 — 2026-08-31

- `src/ui/execution/schedule.ts`, `src/ui/ExecutionScreen.tsx`: 길찾기를 `openKakaoRouteWithFallback`으로 분리했다. `kakaomap://route`는 `canOpenURL`이 true일 때만 열고, 미설치·scheme open 실패·확인 실패 때 기존 HTTPS 길찾기를 정확히 한 번 시도한다. 두 단계가 모두 실패한 경우에만 일반 오류를 표시하며, 성공한 handoff 뒤에만 진행 상태를 바꾼다.
- `src/ui/OneStopResultsScreen.tsx`: 배포 가능한 LegacyResults의 개별 장소 링크를 `openKakaoPlaceWithAppFallback` 공통 opener로 교체했다. `verified` 숫자 Place ID 또는 유효 좌표 앱 scheme과 HTTPS/browser fallback 계약은 Results·CourseConfirm과 동일하다.
- `test/ui/execution-schedule.test.ts`, `test/map-transport-ui-contract.test.mjs`: installed route, app 미설치 HTTPS fallback, 양쪽 실패 및 Execution/LegacyResults 공통 연결을 mock·정적 계약으로 고정했다.
- LegacyResults의 “주변 카페 찾기”는 특정 장소의 Place ID·좌표가 없는 탐색용 HTTPS 검색 행동이라 app scheme 추정을 하지 않는다. 이 링크는 route·추천 재계산·선택 검증을 호출하지 않는다.
- 검증: `npm run test:typecheck` 통과, `npx tsx --test test/ui/execution-schedule.test.ts` 3/3 통과, `node --test test/map-transport-ui-contract.test.mjs` 13/13 통과, `npm run test:ui` 140 pass·기존 skip 1, `npm test` 106/106 통과, `git diff --check` 통과. 실제 카카오맵·route API·CAPTCHA·Supabase 호출은 0회다.

### 4. 다음 결정·위험·재현 조건

- **새 internal build가 필요하다.** 카카오맵 설치 실기기에서 다대포 verified 카드 링크를 1회 실행해 앱으로 즉시 열리고 복귀하는지 확인한다.
- 카카오맵 미설치 시뮬레이터/기기에서는 같은 링크가 HTTPS 또는 browser fallback으로 열리고, 복귀 뒤 대표·탐색 목록·선택 버튼이 보존돼야 한다.
- 어느 분기에서도 경로 확인 시간표·추천 상태가 새로 생기거나 route 호출이 발생하면 회귀다.
- **실기기 수락은 아직 대기다.** 새 internal build에서 설치/미설치 각 1회와 `app_scheme_available` / `app_scheme_unavailable` / `app_scheme_open_failed`만 사용하는 내부 진단 확인이 필요하다. URL·좌표·원시 예외는 표시하거나 기록하지 않는다.

### 5. 제공사 applink handoff 수락 — 2026-08-31

- **관찰:** 새 Xcode 기기 build의 TimeFit 장소 링크와 Safari에서 입력한 `kakaomap://open` 모두 `applink.map.kakao.com` 화면과 iOS의 `카카오맵에서 열겠습니까?` 확인을 거쳐, 사용자가 `열기`를 누르면 설치된 카카오맵 앱으로 정상 전환했다.
- **판정:** 공식 scheme을 시도한 뒤에도 카카오 제공사/iOS가 이 중간 화면을 제어할 수 있다. TimeFit이 해당 확인을 제거하거나 자동으로 승인할 수는 없다. 설치 유도나 반복 링크 우회로 바꾸지 않는다.
- **결정:** 공모전 현재 단계에서는 설치된 카카오맵 앱으로 최종 전환되는 이 흐름을 수락한다. `카카오맵에서 장소 보기`는 외부 전환 행동으로만 표현하며 `즉시 앱 전환`을 약속하지 않는다. 실제 앱 전환 실패·복귀 손실이 재현될 때만 3-2의 내부 진단을 재개한다.
