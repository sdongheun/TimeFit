# DEC-KAKAO-ROUTE-01 — V1·legacy 카카오맵 구간 길찾기 연결 계약

## 발생한 문제와 확정 근거

2026-08-31 실기기에서 `카카오맵에서 길찾기`와 체류 뒤 `다음 장소 길찾기`가 모두 `카카오맵을 열지 못했어요`로 끝났다.

- iOS query whitelist는 원인이 아니다. `app.json`과 생성된 `ios/mobile/Info.plist` 모두 `LSApplicationQueriesSchemes = [kakaomap]`을 포함하고, 사용자는 새 Xcode build도 설치했다.
- 현재 `kakaomap://route?ep=<목적지>&by=<수단>`에는 공식 길찾기 scheme의 필수 출발지 `sp`가 없다. 또한 HTTP(S) fallback은 `link/to`라서 길찾기가 아니라 목적지만 연다.
- 카카오의 현재 공식 URL Scheme은 route에 `sp`, `ep`, `by`를 사용하며, 지원 수단은 `car`, `publictransit`, `foot`, `bicycle`이다. 웹 길찾기 링크는 `link/by/<수단>/<출발지>/<도착지>` 형식을 지원한다. [Kakao iOS URL Scheme](https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/), [Kakao Web API Guide](https://apis.map.kakao.com/web/guide/)

따라서 이 문제는 API 키·Route Proxy·추천 엔진·iOS whitelist가 아니라 **공유 길찾기 URL 조립 계약의 결함**이다.

## 현행 교체 규칙

| 이전 방식 | 문제 | 교체 방식 | 상태 |
| --- | --- | --- | --- |
| 목적지만 담은 `kakaomap://route?ep=...` | 카카오 route action의 입력이 불완전하다 | 각 travel은 검증 snapshot의 `from`과 `to` 좌표를 함께 보존해 `kakaomap://route?sp=<from.lat>,<from.lon>&ep=<to.lat>,<to.lon>&by=<foot|publictransit|car>`로 연다 | 구현·fixture 수락, 실기기 대기 |
| `https://map.kakao.com/link/to/...` fallback | 지도 목적지 보기일 뿐 구간 길찾기가 아니다 | `https://map.kakao.com/link/by/<walk|traffic|car>/<출발명>,<lat>,<lon>/<도착명>,<lat>,<lon>`를 사용한다 | 구현·fixture 수락, 실기기 대기 |
| app scheme·외부 HTTPS 실패를 같은 `failed`로만 처리 | 실기기 원인과 재시도 경계를 구분할 수 없다 | app scheme → 외부 HTTPS → 시스템 browser의 **한 번** 순서로 시도한다. 화면에는 일반 오류만 보이고, internal build에서만 `invalid_stage`/`app_unavailable`/`external_failed` 같은 비밀 없는 enum을 확인할 수 있다 | 구현·fixture 수락, 실기기 대기 |

`traffic`은 웹 링크의 대중교통 값이고, app scheme에는 `publictransit`을 유지한다. 이 변경은 길찾기 handoff 표현만 바꾸며 실제 route provider 결과·시간표·순서·체류를 다시 계산하지 않는다.

## UIUX 구현 지시

1. 공유 `openKakaoRouteWithFallback`의 입력을 출발지와 목적지가 모두 있는 구간 타입으로 바꾼다. `kakaomap://route`에는 `sp`와 `ep`를 반드시 넣는다. 좌표가 숫자·범위 조건을 만족하지 않으면 외부 URL을 만들거나 열지 말고 typed `invalid_stage`로 끝낸다.
2. V1 `VerifiedCourseProgressStep`의 모든 travel에 `from`을 추가한다. 첫 travel은 `session.origin`, 이후 travel은 바로 앞 장소, 마지막 travel은 마지막 장소를 사용한다. 런타임 카탈로그 외 재조회·현재 GPS 추정·추천 재계산은 금지한다.
3. 같은 helper를 쓰는 legacy `ExecutionScreen`도 이전 stop을 출발지로 전달한다. 한쪽만 바꿔 legacy URL을 다시 깨뜨리지 않는다.
4. app scheme은 `Linking.canOpenURL` 뒤 `Linking.openURL`로 한 번 시도한다. 미설치·거부·throw면 웹 route 링크를 `Linking.openURL`로 한 번 시도하고, 그것도 throw면 `WebBrowser.openBrowserAsync`로 같은 웹 route 링크를 한 번 연다. 어떤 단계가 성공해도 V1은 성공으로 처리한다. 동일 탭 lock·실패 시 체류 단계 유지 규칙은 보존한다.
5. production 화면·로그·receipt에는 URL, 좌표, provider raw error를 노출하지 않는다. internal diagnostics가 이미 켜진 build에서만 결과 enum을 노출할 수 있다.
6. `test/ui/execution-schedule.test.ts`, `test/ui/verified-course-progress.test.ts`, `test/map-transport-ui-contract.test.mjs`를 갱신한다.
   - walk/transit/car의 scheme에 `sp`·`ep`와 각각 `foot`/`publictransit`/`car`가 들어감
   - web fallback은 `link/by/walk|traffic|car`이며 `link/to`가 아님
   - 1·2·3곳, 왕복/도착지에서 정확한 이전 지점이 source가 됨
   - app 성공, app 실패→HTTPS 성공, app+HTTPS 실패→browser 성공, 전부 실패, 잘못된 좌표, same-tick 중복을 고정 fixture로 검증
   - Route Proxy·Kakao REST·추천 엔진·DB 호출은 0회
7. `UIUX_공통규칙.md`, `UIUX_테스트명세.md`, `verified-course-progress.md`에 이전 방식→문제→교체 방식→이유→상태와 새 실기기 확인을 기록한다.

## 완료·실기기 게이트

- 최소 `npm run test:typecheck`, 관련 fixture, `npm run test:ui`, `npm test`, `git diff --check`를 통과한다.
- 새 internal build에서 카카오맵 설치 기기로 1곳과 2곳 코스 각각 첫 구간과 체류 뒤 다음 구간을 확인한다. 앱이 열리면 출발·도착이 모두 채워진 길찾기 화면이어야 한다.
- 카카오맵을 제거하거나 mock으로 app·HTTPS 실패를 만든 경우, browser fallback 또는 현재 체류 단계의 오류·재시도 CTA가 남아야 한다. 이 검증은 실제 route API 추가 호출을 만들지 않는다.

### 수락 기록 (2026-09-01)

새 iOS internal build에서 길찾기 handoff를 확인했다. 카카오맵 route 화면에 출발·도착이 모두 전달됐으며, 기존 `ep`만 있는 scheme 실패는 재현되지 않았다. 고정 fixture·타입 검사와 함께 이 계약을 **수락**한다. browser fallback의 실제 미설치 경로는 외부 앱을 제거하지 않고 mock으로만 유지 검증한다.

## 경계

- 소유: UIUX (`src/ui/`, UI 테스트, UIUX 문서). 이 결정 문서는 통합·결정의 계약이다.
- 제외: Kakao REST/API 키, Route Proxy, 추천 후보/시간 정책, GPS 자동 위치, Live Activity, DB 저장/완료 기록.
