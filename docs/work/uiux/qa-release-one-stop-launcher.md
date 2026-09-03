# U-QA-HARNESS-01 — 출시 1곳 추천 개발용 빠른 시나리오 실행기

## 상태와 실행 순서

**통합 수락 (2026-09-02).** 사용자가 진행 중이던 버튼별 수동 QA는 철회 상태로 유지한다. 아래 UIUX fixture와 전체 회귀를 통합·결정이 독립 재검증했다. QA fixture가 이 launcher의 고정 좌표와 일치하는지 보완한 뒤 `QA-RELEASE-ONESTOP-01`의 실제 단계 B/C를 진행한다.

관계: `TEST-04`, `REC-30`, `UXV-02`, `UXV-03`의 **보완**. 제품 추천 정책이나 출시 화면을 바꾸는 작업이 아니라, 개발 빌드에서만 반복 입력을 줄이는 QA 도구다.

## 1. 목적과 사용자 관찰

### 이전 방식

- QA가 시나리오마다 `경로 설정하기 → 출발지 검색 → 도착지 검색/복귀 → 테스트 시각 휠 → 도착 시각 휠 → 추천 실행 → 결과 스크롤`을 반복했다.
- 같은 8개 입력을 다시 검증할 때도 버튼을 처음부터 눌러야 했고, 입력 실수와 결과 기록 누락을 사람이 판별했다.

### 발생한 문제

- 현재 QA의 핵심은 장소 검색 UX가 아니라, 고정된 생활권·시간에서 출시 one-stop 엔진이 실제 Route Proxy로 만드는 대표·대안과 호출 집계를 확인하는 것이다.
- UX와 추천 엔진이 아직 바뀔 수 있어 같은 회귀를 여러 번 수행할 가능성이 높다. 수동 조작 시간은 검증 가치보다 크다.
- 기존 `test:qa:scenario`는 180분·다장소 정책을 포함한 과거 fixture라 120분·한 장소 출시 경로의 대체물이 아니다.

### 교체 방식

- 개발 빌드의 시간 설정 화면에서만 8개 고정 시나리오를 한 번에 선택할 수 있는 `출시 추천 QA` 진입점을 제공한다.
- 시나리오 실행은 장소 검색과 시간 휠만 건너뛰며, 현행 인증/CAPTCHA gate, `runRecommendationSession`, Route Proxy, release one-stop builder, Results navigation은 그대로 통과한다.
- 실행 결과는 비밀과 정밀 좌표를 제외한 한 줄짜리 구조화 로그로 남겨 QA가 화면을 읽어 옮기지 않게 한다.

상태: **현행 QA 가속 방식**. Maestro 전면 도입은 이 작업의 선행 조건이 아니며 배포 전 필수 범위에도 넣지 않는다.

## 2. 먼저 읽을 파일

1. 루트 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/work/uiux/README.md`
3. [출시 1곳 추천 UI 연결](release-one-stop-results.md)
4. [QA 출시 1곳 검증](../qa-release/release-one-stop-simulator-validation.md)
5. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`
6. `src/ui/TimeSetupScreen.tsx`, `src/ui/nav.ts`, `src/ui/recommendation/v1Session.ts`
7. 관련 UI 테스트만 읽는다. 역할 archive와 다장소/B12 과거 기록은 읽지 않는다.

## 3. 고정 시나리오 계약

모든 시나리오는 실제 날짜의 요일을 유지하되, 같은 날짜의 개발 테스트 시각 `15:00`, 도착 전 여유 `10분`을 사용한다. `nowIso`는 문자열이며 `Date`, 함수, provider, route adapter를 navigation params에 넣지 않는다.

| ID | 출발지 → 도착지 | 입력 시간 | 좌표 기준 |
| --- | --- | ---: | --- |
| SIM-ONE-01 | 서면역 → 출발지 복귀 | 45분 | 서면역 `35.1578, 129.0594` |
| SIM-ONE-02 | 서면역 → 출발지 복귀 | 120분 | 서면역 `35.1578, 129.0594` |
| SIM-ONE-03 | 사상역 → 서면역 | 90분 | 사상역 `35.1622, 128.9848` / 서면역 `35.1578, 129.0594` |
| SIM-ONE-04 | 부산역 → 남포역 | 120분 | 부산역 `35.1152, 129.0422` / 남포역 `35.0976, 129.0347` |
| SIM-ONE-05 | 광안리해수욕장 → 출발지 복귀 | 75분 | 광안리해수욕장 `35.1532, 129.1187` |
| SIM-ONE-06 | 센텀시티역 → 해운대역 | 120분 | 센텀시티역 `35.1691, 129.1305` / 해운대역 `35.1631, 129.1588` |
| SIM-ONE-07 | 동래역 → 출발지 복귀 | 60분 | 동래역 `35.2057, 129.0785` |
| SIM-ONE-08 | 다대포해수욕장역 → 출발지 복귀 | 120분 | 다대포해수욕장역 `35.0484, 128.9658` |

좌표는 QA 고정 입력이며 장소 검색 API의 반환 정확도 검증에 사용하지 않는다. UIUX 세션이 임의로 검색을 다시 수행해 좌표나 이름을 바꾸지 않는다. 중대한 좌표 오류를 발견하면 수정하지 말고 근거와 함께 통합·결정에 인계한다.

## 4. 구현 명령

### 4.1 개발 전용 노출 경계

1. 별도 공개 환경변수를 추가하지 않는다.
2. 실행기 노출은 순수 판정 함수에서 `dev === true && diagnostics === 'true'`일 때만 `true`여야 한다.
3. `__DEV__`가 false이거나 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS`가 정확히 `'true'`가 아니면 버튼, 접근성 노드, 시나리오 상수 import에 따른 부수효과가 없어야 한다.
4. production/default 사용자 화면의 문구·레이아웃·navigation route를 바꾸지 않는다.

### 4.2 화면 구조

1. `TimeSetupScreen`의 기존 `개발 테스트 시각` 주변에 `출시 추천 QA` 버튼 하나를 둔다.
2. 버튼을 누르면 같은 화면 안의 개발 전용 패널 또는 modal에 8개 시나리오를 ID·경로·분으로 표시한다. 새 public Stack screen은 만들지 않는다.
3. 각 항목에는 안정적인 `testID="qa-scenario-SIM-ONE-XX"`를 부여한다.
4. `다음 시나리오`는 마지막 성공/실패 ID 다음 항목을 가리키되 자동으로 API를 연속 호출하지 않는다. 실제 호출은 QA가 명시적으로 한 번 탭할 때만 시작한다.
5. 실행 중에는 모든 시나리오 버튼을 잠그고 같은 ID의 중복 탭이 두 번째 추천 요청을 만들지 않게 한다.

### 4.3 추천 호출 경계

1. 수동 입력과 QA preset이 공통으로 사용하는 private 실행 함수를 추출한다. `runRecommendationSession`을 복제하거나 별도의 엔진 entry를 만들지 않는다.
2. QA 항목 탭 시 위 표로 직렬화 가능한 `RecommendationSession`을 만들고 기존 `recommendationGateDecision`을 거친다.
3. 익명 세션이 없으면 기존 CAPTCHA sheet를 한 번 표시하고, 성공 token은 그때 선택한 시나리오 한 건에만 전달한다. CAPTCHA를 우회하거나 token을 저장·로그·navigation에 넣지 않는다.
4. 익명 세션이 있으면 기존 proxy 시작 경로를 그대로 사용한다.
5. 성공 시 기존 `flow.setLatestResults`와 같은 `Results` params 계약을 사용한다. 일반 사용자 실행은 기존 `navigation.replace`를 유지하고, QA launcher에서 시작한 경우에만 `navigation.navigate('Results', params)`로 TimeSetup을 아래 stack에 남겨 결과 화면의 기존 뒤로 가기 한 번으로 launcher에 복귀하게 한다. 이를 위해 navigation params에 QA 전용 값이나 함수를 추가하지 않는다.
6. 실패 시 기존 사용자 오류 문구와 diagnostic enum 경계를 유지하고 QA 패널로 돌아갈 수 있어야 한다.
7. 실제 날짜가 자정을 넘나드는 계산을 새로 만들지 않는다. 현행 `captureRecommendationNowIso`/시간 helper로 같은 날짜 15:00을 만들고 `remainingMin`은 표의 값으로 직접 고정한다.

### 4.4 자동 결과 receipt

개발 모드에서 추천 한 건이 성공하거나 실패할 때 아래 prefix로 JSON 한 줄만 출력한다.

```text
[qa-release-one-stop] { ... }
```

허용 필드:

- `scenarioId`
- `status`: `verified | empty | failed`
- `resultState`, `alternativeState`
- 대표의 장소 ID·표시명 또는 `null`
- 대안의 장소 ID·표시명 배열
- 반환 course별 `placeIds.length`
- `newProviderAttemptCount`, `adapterCallCount`, `cacheOrSessionReuseCount`
- 공개 diagnostics에 이미 존재하는 집계형 탈락 사유
- 비밀 없는 실패 enum

금지 필드:

- 출발·도착·장소의 위경도
- CAPTCHA token, JWT, Supabase session/user ID, API key
- 전체 URL·query·request/response body
- 함수·adapter·provider 객체

로그 변환은 순수 함수로 분리해 fixture로 검증한다. production에서는 이 receipt를 출력하지 않는다.

## 5. 변경하지 않을 경계

- 출시 계약: 최대 120분, 실제 검증 한 장소, 대표 1+서로 다른 대안 최대 3, provider 신규 attempt 최대 8.
- 엔진·데이터·API 구현: `src/engine/`, `src/data/`, Route Proxy/cache/auth 코드.
- 조건부 시장 실제 시각 gate, 체류 분 비노출, `가볍게 둘러보기` 표시 기준.
- `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`는 새 route 없이 구현할 수 있으므로 수정하지 않는다.
- `.env*`, Supabase/Cloudflare 설정, native entitlement를 수정하지 않는다.
- 기존 장소 검색·지도 선택·수동 시간 입력 흐름은 삭제하지 않는다.

## 6. 필수 반례 fixture

UIUX 세션은 네트워크 없는 UI/순수 테스트로 최소 다음을 고정한다.

1. `dev=true + diagnostics='true'`에서만 launcher가 노출된다.
2. `dev=false`, diagnostics false/누락/대소문자 오입력에서 launcher와 receipt가 모두 비노출이다.
3. 8개 ID가 정확히 한 번씩 존재하고 입력 시간이 `1~120`, 여유가 10분이며 좌표가 유한하다.
4. 왕복은 destination `null`, 편도는 서로 다른 고정 destination을 만든다.
5. preset session의 `nowIso`는 문자열이고 navigation payload가 JSON 직렬화 가능하다.
6. 한 번 탭은 추천 실행 한 번, 빠른 중복 탭은 여전히 한 번이다.
7. 첫 CAPTCHA 성공은 선택했던 scenario에만 이어지고 취소·만료·실패는 추천 호출 0회다.
8. 늦게 도착한 이전 scenario 응답이 더 최근 실행 상태나 결과를 덮지 않는다.
9. 대표 없음, 대안 0개, route/proxy throw도 receipt 한 줄과 기존 오류 상태로 종료된다.
10. receipt sanitizer가 token·좌표·URL·사용자 ID를 포함하지 않는다.

## 7. 검증 명령과 합격값

최소 실행:

```bash
npx tsx --test test/ui/qa-release-one-stop-launcher.test.ts test/ui/recommendation-runtime-boundary.test.ts test/ui/time-setup-clock.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

합격값:

- 신규 fixture 전부 통과, 기존 테스트 신규 실패 0.
- 테스트 중 실제 Kakao/TMAP/Supabase/CAPTCHA/GPS 호출 0회.
- 테스트에서 추천 runner 최대 호출 1, 중복 탭 반례에서도 1.
- production 비노출 네 조합을 문자열 검사가 아니라 공개 model/화면 경계 호출로 증명한다.
- 실제 Simulator 검증은 이 작업에서 수행하지 않는다. 통합·결정 수락 뒤 QA 역할이 수행한다.

## 8. 완료 인수인계

현재 문서 아래에 다음 네 항목을 기록한다.

1. 변경 파일과 목적
2. 유지한 공개 계약과 production 비노출 근거
3. 실행한 테스트·통과 수·실제 외부 호출 0회 근거
4. 남은 위험과 `QA-RELEASE-ONESTOP-01`이 사용할 정확한 버튼·로그 prefix

완료 기준 하나라도 충족하지 못하면 `완료`라고 쓰지 않는다. UIUX 세션은 `docs/작업조정_보드.md`를 수정하거나 QA 실제 8회 결과를 대신 기록하지 않는다.

## 9. 완료 인계 (2026-09-02)

### 1. 변경 파일과 목적

- `src/ui/qaReleaseOneStopLauncherModel.ts`: 8개 `SIM-ONE-01~08` 고정 입력, dev+exact diagnostics 노출 판정, 같은 날짜 15:00 session 직렬화, 다음 시나리오 계산, 중복·CAPTCHA 취소·stale 응답을 막는 one-shot controller, 허용 필드만 새 객체로 만드는 receipt sanitizer를 추가했다.
- `src/ui/TimeSetupScreen.tsx`: 기존 `개발 테스트 시각` 주변에 `출시 추천 QA` 진입점과 같은 화면의 8개 버튼 패널을 연결했다. 수동/QA가 같은 `executeRecommendation`과 기존 `recommendationGateDecision`·`runRecommendationSession`을 사용한다. 일반 실행은 기존 `navigation.replace`, QA 성공만 `navigation.navigate`를 사용해 Results 뒤로 가기 한 번으로 launcher에 복귀한다.
- `test/ui/qa-release-one-stop-launcher.test.ts`: production 비노출 네 반례, 8개 고정 입력·왕복/편도·JSON session, 중복 runner 1회, CAPTCHA 취소 후 늦은 token 차단, stale 완료 차단, verified/empty/failed receipt, 좌표·token·URL·사용자 식별자 제거, 새 route 미추가를 고정했다.
- `test/map-transport-ui-contract.test.mjs`: 공통 실행 함수 추출 뒤에도 기존 CAPTCHA one-shot과 V1 runtime 경계를 유지하고, 유일하게 허용된 `console.info(line)`이 sanitizer 결과 한 줄만 받도록 정적 계약을 보완했다.

### 2. 유지한 공개 계약과 production 비노출 근거

- `src/engine/`, 엔진 테스트, `src/services/`, `src/data/`, `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`, 환경·native·DB·제품 기준 문서와 작업조정 보드는 수정하지 않았다. release one-stop, 120분, 대표 1+대안 최대 3, provider attempt 최대 8 계약도 바꾸지 않았다.
- launcher와 receipt line은 공개 순수 판정 `dev === true && diagnostics === 'true'`에서만 활성화된다. `dev=false`, diagnostics false/누락/`TRUE`에서는 버튼·receipt가 모두 null/비노출이며 새 navigation route도 없다.
- 장소 검색과 시간 휠만 고정 입력으로 대체했다. 기존 익명 Auth loading, CAPTCHA challenge, one-shot token callback, Route Proxy 선택, `flow.setLatestResults`, 사용자 오류/diagnostic enum을 그대로 통과한다. CAPTCHA token은 state·navigation·receipt·로그에 저장하지 않는다.
- receipt는 `scenarioId`, 상태, result/alternative state, 대표·대안 ID/표시명, course 장소 수, provider/adapter/reuse 수, 고정 탈락 집계, 안전 failure enum만 투영한다. 좌표, token/JWT/API key, session/user ID, URL·query·body, 함수·adapter·provider 객체는 복사하지 않는다.

### 3. 테스트 결과와 외부 호출 근거

- 필수 명령의 대상 fixture: 14/14 통과.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 177개 중 176 통과, 기존 철회 이력 1 skip, 실패 0.
- `npm test`: 113/113 통과, skip 0.
- 추가 정적 UI 계약 `test/map-transport-ui-contract.test.mjs`: 14/14 통과.
- `git diff --check`: 통과.
- 테스트는 주입 fixture와 source 계약만 실행했으며 실제 Kakao/TMAP/Supabase/CAPTCHA/GPS 호출은 0회다. controller fixture에서 한 탭 runner 1회, 같은 tick 중복 0회 추가, 취소·늦은 CAPTCHA·stale 완료의 추천/상태 덮어쓰기 0회를 확인했다.

### 4. 남은 위험과 QA 사용 계약

- 이번 UIUX 세션은 Simulator 실제 Proxy 8회와 화면 smoke를 실행하지 않았다. 통합·결정 수락 뒤 `QA-RELEASE-ONESTOP-01` 단계 B/C가 새 internal build에서 인증·WebView·navigation 복귀와 실제 공급량을 확인해야 한다.
- 환경은 `EXPO_PUBLIC_ROUTE_PROXY_ENABLED=true`, `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true`, `EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12=false`여야 한다. 시간 설정 화면에서 `출시 추천 QA`를 누른 뒤 `qa-scenario-SIM-ONE-01`부터 `qa-scenario-SIM-ONE-08`까지 각각 한 번만 탭한다. `qa-next-scenario`는 다음 ID 안내일 뿐 자동 실행하지 않는다.
- 각 성공·empty·실패 실행은 Metro에 정확히 한 줄의 `[qa-release-one-stop] { ... }`를 남긴다. 좌표·token·URL·사용자 ID가 한 줄이라도 보이거나 버튼/ID/시간이 다르면 남은 실제 호출을 중단하고 UIUX 결함으로 되돌린다.
- 시나리오 좌표는 작업 계약 그대로 사용했으며 장소 검색으로 재확인·보정하지 않았다. 실제 Proxy에서 endpoint scope 또는 좌표 근거 문제가 드러나면 UI에서 임의 변경하지 말고 통합·결정에 입력 ID와 안전 receipt를 인계한다.

## 10. 통합·결정 수락 (2026-09-02)

- 구현은 개발+exact diagnostics 비노출 경계, 8개 직렬화 session, 공통 인증/CAPTCHA·`runRecommendationSession`, 일반 `replace`/QA `navigate`, one-shot·stale 차단, 비밀 없는 receipt 계약과 일치한다.
- 통합·결정 재실행: 대상 fixture 14/14, `npm run test:typecheck` 통과, `npm run test:ui` 177개 중 176 통과·기존 1 skip, `npm test` 113/113, `git diff --check` 통과.
- 실제 외부 API·Supabase·CAPTCHA·GPS 호출은 이 재검증에서도 0회다.
- 판정: **수락**. 다음 담당은 QA·출시이며 [QA-RELEASE-ONESTOP-01](../qa-release/release-one-stop-simulator-validation.md)의 단계 A 고정 입력 동기화를 끝낸 뒤 B, C를 순서대로 수행한다.
