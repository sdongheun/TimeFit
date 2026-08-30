# QA·출시 작업기록

> QA·출시 역할의 상세 지시와 완료 기록만 남긴다. 제품 정책은 수정하지 않으며, 정책 충돌은 통합·결정에 인계한다.

## 2026-08-25 — 통합·결정 지시 QA-01: 현행 V1 회귀 게이트와 레거시 테스트 분리

**선행 조건:** 추천 엔진 `2-I-R`, UIUX `U-1-E-R` 완료·수락 뒤 수행한다.

### 관찰

현재 `npm run test:ui`와 `npm test`는 통과하지만, 출력에 자유 장바구니·사용자 이동수단 선택·차량 후보·단일 장소 정밀화 등 철회한 정책의 테스트가 함께 남아 있다. 이 테스트들은 과거 기능의 보존 여부를 알려 줄 수는 있어도, 현행 V1이 정책대로 동작한다는 출시 게이트로 해석하면 안 된다.

### 작업 지시

1. `test/` 전체를 아래 셋으로 인벤토리화한다. 각 파일·테스트명·현재 실행 명령·정책 상태·조치 근거를 표로 기록한다.
   - 현행 V1 회귀: 1~3곳 엔진 코스, 권장 체류·남는 시간, 실제 도보/대중교통 route, 대표+대안 목록, 운영시간·등급 게이트, 직렬화·사진·카카오 CTA.
   - 호환/격리 대상: legacy 화면 또는 저장 흐름을 아직 유지하기 위한 테스트. 현행 추천 품질 합격 수에 포함하지 않는다.
   - 철회 대상: 자유 장바구니 조립, 사용자 구간 수단 선택, 차량을 자동 추천 통과 수단으로 쓰는 테스트처럼 현행 정책과 충돌하는 테스트.
2. 철회 대상은 무단 삭제하지 않는다. 테스트명·설명·디렉터리 또는 명시적 skip 사유를 통해 현행 V1 회귀와 분리한다. 실제로 연결되지 않은 legacy 코드의 제거 여부는 통합·결정에 선택지로 인계한다. `src/ui/`, `src/engine/`, 제품 정책 문서는 수정하지 않는다.
3. 현행 V1 전용 게이트를 추가 또는 정리한다. 최소 fixture는 다음을 포함한다.
   - 78분 같은 분 단위 입력과 120·180분, 왕복·도착지 각각에서 권장 체류·도착 여유 뒤 남는 시간이 음수가 아닌 코스
   - 1·2곳 우선 대표, 3곳은 가능한 대안, 1곳 넓은 탐색 lane, 비중첩 대안
   - 상단 대표와 하단 대안 목록, 목록 선택 중 route/engine 추가 호출 0회, 최대 체류 미노출, 남는 시간 단일 표시
   - 운영시간 미확인/hold 제외, 경로 실패·대안 없음, 사진 없음·카카오맵 실패, `nowIso` 직렬화
4. 테스트는 외부 API·실제 GPS·실제 DB를 호출하지 않고 고정 fixture만 쓴다. 실제 iOS 확인은 U-1-E-R의 캡처/기록을 인용하며, QA가 임의로 외부 API 대량 호출을 추가하지 않는다.
5. 최소 `npm run test:typecheck`, `npm run test:ui`, `npm test`, `npx expo export --platform ios`, `git diff --check`를 실행한다. 완료 기록에는 **현행 V1 통과 수와 격리/철회 수를 분리**해 쓴다. 전체 통과 수만으로 출시 가능이라고 결론내리지 않는다.

### 완료 기준

- 현행 V1 회귀 게이트와 레거시/철회 테스트가 문서와 실행 결과에서 구별된다.
- 자유 장바구니·차량·사용자 수단 선택 테스트가 현행 추천 정책의 통과 근거로 남아 있지 않다.
- 변경 파일 / 수정하지 않은 정책·기능 코드 경계 / 명령별 결과 / iOS 수동 확인 인용 / 출시 전 남은 위험을 이 파일에 기록한다.

### QA-01 진행 기록 — 2026-08-25

#### 테스트 인벤토리와 실행 경계

`npm test`와 `npm run test:ui`는 이전 테스트를 호환 확인 목적으로 계속 실행한다. 이 두 명령의 총 통과 수는 현행 V1 출시 판정에 사용하지 않는다. 현행 V1 판정은 새 `npm run test:qa:v1`만 사용한다. 모든 항목은 외부 API·GPS·DB 없이 fixture 또는 정적 계약으로 실행한다.

| 정책 상태 | 파일 · 테스트명(요약) | 현재 명령 | 조치 근거 |
|---|---|---|---|
| 현행 V1 회귀 | `test/course-v1.test.ts` — 45분 왕복 제외, 90분 도착지, 180분 1/2/3곳, 운영시간·관계 제외, 빈 결과, 1~180분 경계 | `npm run test:qa:v1` | 1~3곳 엔진 기본 계약 |
| 현행 V1 회귀 | `test/course-v1-limited-integration.test.ts` — ENG-2E/2G/2H/2I/2I-R: 45·78·90·120·180분, 왕복·도착지, 대표·비중첩 대안, 3곳 대안, 최대 4코스 정확 route, 조건부/hold 제외 | `npm run test:qa:v1` | V1 후보 사전선정·실제 route·남는 시간 스냅샷 |
| 현행 V1 회귀 | `test/course-v1-route-adapter.test.ts` — TMAP 도보 성공, ODsay/전체 실패, 성공·실패 TTL, 세션 cache, 동시 요청, cache key | `npm run test:qa:v1` | 실제 도보·대중교통 어댑터 fixture와 재호출 방지 |
| 현행 V1 회귀 | `test/course-v1-candidate-provider.test.ts` — DATA-2D-1 대표 190개 변환·조건부/내부/만료 제외 | `npm run test:qa:v1` | 대표 후보 등급 게이트 |
| 현행 V1 회귀 | `test/ui/course-v1-results-list.test.ts` — 1/2/3곳 대표·대안, 넓은 1곳, 선택 시 engine/route 0회, VoiceOver 요약 | `npm run test:qa:v1` | 상단 대표·하단 대안 목록과 선택 스냅샷 |
| 현행 V1 회귀 | `test/ui/course-v1-journey.test.ts` — 1/2/3곳 legs/stops/buffer/remaining 순서, 계약 불일치 거부. `순차 새 추천`은 `test.skip` 철회 이력 | `npm run test:qa:v1` | 시간 여정과 철회 정책의 명시 분리 |
| 현행 V1 회귀 | `test/ui/course-v1-place-preview.test.ts` — 사진/placeholder, HTTPS 카카오 URL, Linking 실패, 1/2/3곳 CTA | `npm run test:qa:v1` | 사진 없음·카카오맵 실패 |
| 현행 V1 회귀 | `test/ui/course-v1-discovery-context.test.ts`, `test/ui/recommendation-session-time.test.ts` — 근거 기반 맥락, `nowIso` UTC 직렬화·복원·navigation JSON | `npm run test:qa:v1` | 발견성 문구·세션 직렬화 |
| 현행 V1 회귀 | `test/map-transport-ui-contract.test.mjs` — V1 진입, 대표/대안·빈 상태, V1만 route 호출, 권장 체류·단일 남는 시간·최대 체류 미노출 | `npm run test:qa:v1` | 레거시 화면 호출 차단과 표시 계약 |
| 현행 V1 회귀 | `test/busan-poi-catalog.test.mjs`, `test/recommendation-data-contract.test.mjs`, `test/short-stay-catalog.test.mjs`, `test/evidence-profile-classification.test.mjs` — 활동/등급/운영시간/hold/사진/공급 fixture | `npm run test:qa:v1` | 운영시간·등급·직렬화·사진 원천 게이트 |
| 호환/격리 | `test/ui/activity-summary.test.ts`, `course-progress-contract.test.mjs`, `execution-schedule.test.ts`, `route-segments.test.ts`, `course-replan-contract.test.mjs` | `npm test` 또는 `npm run test:ui` | 기록·진행·저장 호환 계약. 현행 추천 품질 합격 수에서 제외 |
| 호환/격리 | `test/area-availability-policy.test.mjs`, `opening-hours-audit.test.mjs`, `tourapi-representative-image-https.test.mjs` | `npm test` | V1 입력 데이터의 감사 보조. V1 전용 실행은 상단 카탈로그 게이트가 담당 |
| 철회 대상 | `test/planner-policy.test.mjs`, `test/mixed-travel-contract.test.mjs` — 세 수단 OR, 단일 장소 자동 수단 조합 | `npm test` | 차량 OR·단일 경유지 정책 이력. 결과는 현행 V1 통과 근거에서 제외 |
| 철회 대상 | `test/ui/one-stop-*.test.ts`, `test/ui/basket-*.test.*`, `test/ui/candidate-*.test.*` — 한 곳 대표, 자유 장바구니, 사용자 수단·후보 평가 | `npm run test:ui` | 1~3곳 엔진 코스·읽기 전용 확인으로 대체 |
| 철회 대상 | `test/ui/actual-route-*.test.ts`, `test/ui/route-baseline-service.test.ts`, `test/ui/recommendation-sheet-layout.test.ts`, `test/ui/map-controls-contract.test.mjs`, `test/ui/local-opening-gate.test.ts` | `npm run test:ui` | 이전 지도 우선/기준 경로/시트 탐색 흐름. 기능 코드 제거 여부는 통합·결정 소관 |

철회 대상은 삭제하지 않았다. V1 결과 진입점이 legacy 차량·baseline·장바구니를 호출하지 않는지 `map-transport-ui-contract.test.mjs`에서 별도로 검사한다. 실제로 연결되지 않은 legacy 화면·엔진 코드의 삭제 판단은 통합·결정에 인계한다.

#### 실행 결과

| 명령 | 결과 | V1 출시 판정 포함 여부 |
|---|---|---|
| `npm run test:qa:v1` | 2026-08-25: 100개 중 99 통과, 1 skip (`철회 이력: 순차 새 추천`) | 포함. skip은 철회 이력이며 통과 수에 넣지 않음 |
| `npm run test:typecheck` | 통과 | TypeScript 회귀 |
| `npm run test:ui` | 82개 중 81 통과, 1 skip. legacy·철회 테스트 포함 | 전체 통과 수는 V1 합격 수로 사용하지 않음 |
| `npm test` | 73개 통과 | 전체 통과 수는 V1 합격 수로 사용하지 않음 |
| `npx expo export --platform ios` | 통과. iOS bundle 1개·asset 35개 생성 | V1 번들 게이트 |
| `git diff --check` | 통과 | 변경 형식 검사 |

#### 경계·잔여 위험

- 변경: `package.json`에 V1 전용 명령, `test/map-transport-ui-contract.test.mjs`에 권장 체류·남는 시간·최대 체류 표시 계약, 이 작업기록의 인벤토리를 추가했다.
- 수정하지 않음: `src/engine/`, `src/ui/`, 데이터 원천, 제품 정책 문서. 정책·기능 구현의 소유 경계를 유지했다.
- iOS 수동 확인: U-1-E-R의 캡처/기록이 이 작업 트리에 없으므로 인용할 수 없다. QA는 외부 API·실기기 대량 호출을 수행하지 않았다.
- 출시 위험: V1은 고정 fixture 회귀만 통과했으며, iOS 실제 화면/권한/외부 카카오맵 복귀와 출시 체크리스트의 계정·개인정보·법적 게이트는 미확인이다.

---

## 2026-08-26 — 통합·결정 지시 QA-02: 추천 체감 고정 시나리오 하네스

**선행 조건:** U-1-F 완료. **목표:** 출발지 검색 오선택·실시간 시각·외부 API 변동과 추천 품질 문제를 분리한다.

1. 고정 `nowIso`, 출발지 좌표/라벨, 도착지/복귀, 45·78·120·180분, 도착 여유를 가진 최소 시나리오 fixture를 만든다. 서면·사상·남포·해운대 등 장소 밀집/희소 생활권을 모두 포함하되, 장소 수나 통과 결과를 미리 정답으로 만들지 않는다.
2. 각 시나리오에 사용자가 직접 재현할 입력 순서와 기록 항목을 둔다: 결과 상태, 대표 장소 수, 대안 수, 장소 집합 중첩 여부, 실제 route 요청/캐시 hit 수, 남는 시간, 검색 확정 출발지.
3. 외부 실경로는 고정 route fixture와 제한 수동 실행을 분리한다. 자동 테스트가 실제 API를 반복 호출하거나 일일 한도를 소모하지 않게 한다.
4. `test/`, fixture, QA 문서만 수정한다. 엔진 순위·UI·adapter·데이터·DB를 고치지 않는다.

**완료 기준:** 누구나 같은 입력으로 동일한 엔진/표시 계약을 재현할 수 있고, QA-03이 바로 소비할 fixture·측정 스키마·수동 기록표를 남긴다.

### 제공사 전환 후 실행 조건 정정 (2026-08-26)

QA-02는 U-1-F-R4와 엔진 2-J 완료 뒤 시작한다. 고정 route fixture는 카카오 대중교통, 카카오 도보, TMAP 도보의 성공·한도·timeout·fallback·cache hit/miss를 구분하되 실제 API를 호출하지 않는다. ODsay 성공 fixture는 과거 호환 검증으로 격리하고 현행 V1 합격 수에 포함하지 않는다. 도보가 두 제공사를 동시에 호출하지 않고 결정적으로 하나를 고른 뒤 실패에만 1회 fallback하는지, 대중교통 한도 초과가 검증 불가로 나타나는지도 시나리오 기록 항목에 추가한다.

### QA-02 진행 기록 — 2026-08-27

#### 고정 시나리오 fixture와 재현 명령

`test/fixtures/qa02-recommendation-scenarios.fixture.ts`는 QA-03이 `runQa02Scenario()`과 `Qa02ScenarioRecord`를 그대로 소비할 수 있게 입력·측정 스키마를 공개한다. fixture는 장소 수·통과 결과를 사전 정답으로 고정하지 않고, 같은 입력이 같은 엔진 결과와 route 관찰값을 내는지만 검사한다.

| ID | 고정 입력 | 사용자가 재현할 입력 순서 |
|---|---|---|
| QA02-01 | 2026-08-27 10:15 KST, 서면역, 현재 위치 복귀, 45분, 여유 5분 | `경로 설정하기` → 출발지 `서면역` 검색·확정 → 도착지 비움 → 45분/5분 설정 → 결과 기록 |
| QA02-02 | 11:10 KST, 사상역 → 사상시외버스터미널, 78분, 여유 8분 | 두 위치를 각각 검색·확정 → 78분/8분 설정 → 검색 확정 출발지와 결과 기록 |
| QA02-03 | 12:30 KST, 남포역, 현재 위치 복귀, 120분, 여유 10분 | 출발지 `남포역` 검색·확정 → 도착지 비움 → 120분/10분 설정 → 대표/대안 집합 기록 |
| QA02-04 | 18:20 KST, 해운대역 → 동백역, 180분, 여유 10분 | 두 위치를 각각 검색·확정 → 180분/10분 설정 → provider·cache·한도/timeout과 결과 기록 |

자동 재현은 `npm run test:qa:scenario`을 사용한다. 이 명령은 실제 GPS·DB·외부 API를 호출하지 않는다. 각 route fixture는 Kakao 대중교통, Kakao/TMAP 도보의 결정적 선택, 도보 1회 fallback, 제한/timeout 상태와 cache hit/miss를 관찰값으로 남긴다.

#### QA-03용 측정 스키마·수동 기록표

| 기록 항목 | 자동 fixture 값 | 제한 수동 실행 시 기록할 값 |
|---|---|---|
| 입력 식별 | `scenarioId`, `nowIso`, 도착지/복귀, 시간·여유 | 같은 값과 기기·앱 빌드 |
| 검색 확정 출발지 | `confirmedOrigin.id/label/lat/lon` | 검색 결과에서 사용자가 확정한 라벨·좌표. GPS 원문은 기록하지 않음 |
| 결과 체감 | `resultState`, `representativePlaceCount`, `alternativeCount`, `alternativeOverlapsRepresentative` | 화면의 대표 장소 수·대안 수·중첩 여부·빈 상태 문구 |
| 시간 안전 | `remainingAfterCourseMin` | 대표/선택 대안의 남는 시간과 음수 여부 |
| route 관찰 | `requests`, `misses`, `cacheHits`, `walkProviderAttempts`, `transitProviderAttempts`, `outcomes` | 제공사별 새 구간 요청 수·cache hit/miss·한도/timeout/실패 상태. API 키·좌표 원문은 기록하지 않음 |

#### 제공사 연결 점검 및 인계

현행 V1 화면 세션 `src/ui/recommendation/v1Session.ts`은 아직 `createCourseV1RouteAdapter()`를 직접 사용하며, 이 adapter는 TMAP 도보·ODsay 대중교통을 허용한다. 반면 제공사 전환 후 기준은 Kakao 대중교통과 Kakao/TMAP 도보의 결정적 선택·1회 fallback이며, 해당 정책은 `routeProviderAdapter`/`routeProxyClientAdapter` 경계에 구현돼 있다. QA-02 fixture는 새 제공사 정책으로 기록하지만 화면 세션 연결을 바꾸지 않았다. 이는 QA 역할 경계를 넘는 통합 작업이므로 통합·결정/외부 API 어댑터에 인계한다. 이 연결이 완료되기 전에는 QA-02의 자동 하네스를 **현행 화면의 provider 통합 통과 근거로 쓰지 않는다.**

#### 실행 결과와 잔여 위험

- `npm run test:qa:scenario`: 3개 통과. 45·78·120·180분과 서면·사상·남포·해운대 입력, 동일 결과 재현, cache hit 증가, 제공사 attempt 규칙을 확인했다.
- 변경: `test/fixtures/qa02-recommendation-scenarios.fixture.ts`, `test/qa02-recommendation-harness.test.ts`, `package.json`, 이 작업기록. 엔진·UI·adapter·데이터·DB·제품 정책은 수정하지 않았다.
- 제한 수동 실행은 아직 수행하지 않았다. 수행 시 위 표에 시나리오 ID, 제공사·새 요청 수, 시각, 결과·캡처 위치를 남기며 반복 호출로 일일 한도를 소모하지 않는다.
- 남은 위험: route fixture가 화면 세션의 구형 ODsay 경계를 대체하지 않는다. 실제 입력 검색의 오선택·실기기 지도/권한과 새 Route Proxy 연결은 QA-04 및 통합 작업에서 별도 확인해야 한다.

## 2026-08-27 — 통합·결정 지시 QA-02-R: 현행 제한 엔진 기준 시나리오 보정

**발견:** 현재 `runQa02Scenario()`은 `buildRepresentativeCourseV1()`을 호출하고 시나리오 후보도 1~3개다. 그러나 실제 화면은 `buildLimitedRepresentativeCourseV1()`을 사용하며, 대표 후보 풀에서 사전선정한 최대 4개 코스만 실경로 검증한다. 따라서 현 QA-02는 45·78·120·180분의 재현·cache 틀은 제공하지만, 현재 사용자가 체감하는 후보 풀·4회 상한·넓은 한 곳·대표/대안 상태를 측정하지 못한다.

1. QA fixture runner를 `buildLimitedRepresentativeCourseV1()`과 같은 `CourseV1RepresentativeCandidateProvider` 계약으로 바꾼다. 실제 네트워크·GPS·DB·카탈로그 변경은 금지하며, 시나리오별 고정 provider를 주입한다.
2. 각 생활권 fixture에는 사전선정 한계와 분류/관계 제외를 관찰할 수 있을 만큼의 후보를 둔다. 1~3개 장소만으로 통과시키지 말고, 대표/조건부·동일 관계·시간상 불가 후보를 포함한다. 장소·통과 코스 결과를 목표값으로 조작하지 않는다.
3. `Qa02ScenarioRecord`에 현행 제한 엔진의 `resultState`, `alternativeState`, `providerCandidateCount`, `preselectionCandidateCount`, `candidatePoolCount`, `generatedOrderedCourseCount`, `exactCourseAttemptCount`, `wideSingleCandidateId`, `preselectedCourseIds`, `routeRejected/openingRejected/budgetRejected/relationshipRejected`를 보존한다. 대표/대안의 1·2·3곳 분포와 남는 시간도 원본 결과에서만 집계한다.
4. 고정 테스트는 (a) 동일 입력의 결정성, (b) 정확 route 검증 최대 4회, (c) 후보 없음과 상한 내 검증 실패 상태 구분, (d) 넓은 한 곳 lane 관찰, (e) 대표·대안의 subset/superset 제거, (f) 재실행 cache hit 증가를 검증한다. Kakao/TMAP 선택·fallback은 API adapter 계약의 검증 대상이며 이 QA fixture의 metadata만으로 실제 provider 호출을 증명했다고 기록하지 않는다.
5. `npm run test:qa:scenario`, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. QA-03은 이 작업이 수락된 뒤에만 시작한다.

**소유 경계:** `test/`, `test/fixtures/`, `package.json`, QA 문서만 수정한다. `src/engine/`, `src/ui/`, API adapter, DB·원본 데이터·제품 정책은 수정하지 않는다.

**완료 기준:** QA-02 결과가 실제 화면과 동일한 제한 엔진의 후보 사전선정·실경로 상한·대표/대안 상태를 측정하며, 추천 엔진 세션이 수치 기반으로 후보 다양성/0개 상태를 보완할 입력을 받는다.

---

## 2026-08-26 — 통합·결정 지시 QA-03: 생활권별 추천 공급과 다양성 측정

**선행 조건:** QA-02 완료. **목표:** 장소 부족, 후보 선별 부족, 실제 경로 실패를 수치로 구별한다.

1. QA-02 시나리오마다 대표 존재율, 0개 상태 사유, 검증 코스 수, 비중첩 대안 수, 1/2/3곳 분포, `wideSingleCandidateId`의 실제 검증/통과 여부, cache hit/miss 구간 수를 측정한다.
2. 자동 측정은 fixture·현재 엔진 진단만 쓴다. 실제 API는 생활권별 대표 시나리오의 제한 수동 확인으로만 분리하고, 제공사·호출 수·시각을 기록한다.
3. 결과를 생활권·시간 예산별 표와 0개율/대안 수 요약으로 남긴다. 장소를 추가하거나 엔진 기준을 수정해 수치를 좋게 만들지 않는다.
4. 결과에는 다음 두 결정을 위한 선택지를 제시한다: (a) 넓은 한 곳 탐색 구간의 의미 있는 범위, (b) 서버 Route Proxy의 제공사별 일일 새 구간 요청 예산. 통합·결정과 사용자 확정 전에는 구현값으로 승격하지 않는다.

**완료 기준:** 측정 원본·집계·재현 명령·호출 수가 남고, 위 두 선택에 필요한 근거가 준비된다.

### 2026-08-27 — 통합·결정 실행 기준 정정: 공모전 배포 기준선 측정

**이전 순서:** QA-02-R을 별도 수락한 뒤 QA-03을 시작하도록 두었다. 이는 현행 제한 엔진 기준선이 없다는 문제는 해결하지만, 공모전 배포 판단에 필요한 측정을 불필요하게 지연시킨다.

**교체 방식:** QA-03은 지금 시작한다. 첫 단계에서 QA-02-R의 `buildLimitedRepresentativeCourseV1`·고정 candidate provider·사전선정/최대 4회 정확 route 진단 보정을 흡수한 뒤, 동일 산출물로 현재 기준선을 측정한다. QA-02-R은 별도 대기가 아니라 QA-03의 첫 완료 항목이다. 엔진·UI·API·원본 데이터는 수정하지 않는다.

**배포 판단 경계:**

- **출시 전 수정 대상:** 음수 시간·도착 여유 위반, 운영 불가 장소를 검증 코스로 표기, 고정 재현에서 비결정 결과, 핵심 추천 흐름의 crash/차단, 개인 데이터·API 비용 보호 경계의 실제 우회. 이들은 “더 나은 추천”이 아니라 신뢰성 결함이다.
- **측정 후 사용자 결정 대상:** 생활권별 0개율, 대안 수·장소 다양성, 1/2/3곳 비율, 넓은 한 곳의 선호도, 특정 생활권의 장소 부족. 수치를 숨기거나 임의의 합격률로 바꾸지 않고, 공모전 제출 전 보완할지·완성 후 backlog로 둘지를 통합·결정이 사용자에게 선택지와 함께 인계한다.
- **완성 후 개선 대상:** provider 실제 활성화 전 성능 미세 조정, cache 효율 고도화, 장기 개인화·분석, 추가 생활권/장소 확장. 단, 해당 항목이 위 출시 전 수정 대상을 유발하면 우선순위를 올린다.

1. QA-02-R의 보정 결과와 함께 QA02-01~04를 현행 제한 엔진으로 실행해 `resultState` 원인, 후보 풀·사전선정·정확 route 시도 수, 대표/대안 1·2·3곳 분포, 남는 시간, 넓은 한 곳, 중첩/다양성, cache hit/miss를 표로 기록한다.
2. 각 행을 `출시 전 수정`, `사용자 결정`, `완성 후 개선` 중 하나로 분류한다. 분류 근거는 고정 fixture·코드 계약·제한 수동 재현만 쓰며, 실제 API를 반복 호출해 수치를 만들지 않는다.
3. 결과 문서에는 “현재 공모전 배포 가능 여부”를 단정하지 말고, 출시 전 수정 대상의 존재 여부와 사용자 결정이 필요한 수치만 짧게 요약한다. 사용자 결정 전에는 엔진 순위·상한·장소 데이터를 변경하지 않는다.

**상태:** 현행. QA-03 완료 결과가 있으면 통합·결정이 사용자와 함께 공모전 배포 기준의 보완 범위를 확정한다.

### QA-03 측정 결과 — 2026-08-27

QA-02의 기존 1~3개 후보 측정값은 제한 엔진의 공급·다양성 판단에 사용하지 않는다. QA-02-R 보정을 QA-03 첫 단계로 흡수해, 고정 candidate provider와 `buildLimitedRepresentativeCourseV1()`으로 다시 측정했다. 자동 실행은 실제 GPS·DB·외부 API를 호출하지 않는다.

| ID | 시간/여유 | 결과 사유 | provider → 사전선정 → 풀 / 정확 route | 대표·대안 (1/2/3곳)·남는 시간 | 넓은 한 곳 | cache (첫 실행 miss / 재실행 hit) | 분류·근거 |
|---|---:|---|---|---|---|---|---|
| QA02-01 서면 | 45/5분 | `no_verified_course_within_limit`; 4개 모두 시간 예산 탈락 | 26 → 24 → 18 / 4 | 0·0 (0/0/0), 해당 없음 | preselect, 미검증 통과 | 8 / 8 | **사용자 결정** — 짧은 시간대 0개율 및 사전선정 범위의 수용 여부 |
| QA02-02 사상 | 78/8분 | `verified`, 대안 있음 | 27 → 25 → 18 / 4 | 대표 1, 대안 1 (2/0/0), 28분 | preselect·통과 | 10 / 10 | **사용자 결정** — 1곳 위주 대안 수의 체감 수용 여부 |
| QA02-03 남포 | 120/10분 | `verified`, 대안 있음 | 28 → 26 → 18 / 4 | 대표 2, 대안 2 (2/1/0), 32분 | preselect·통과 | 8 / 8 | **사용자 결정** — 2곳 대표와 1곳 대안 혼합의 선호도 |
| QA02-04 해운대 | 180/10분 | `verified`, 대안 있음 | 28 → 26 → 18 / 4 | 대표 1, 대안 1 (2/0/0), 128분 | preselect·통과 | 9 / 9 | **사용자 결정** — 긴 시간에도 1곳 코스가 선택되는 기준의 수용 여부 |

모든 행에서 조건부·보류 후보 2개가 분류 제외됐고, 시간 탈락은 각 4/2/1/2건이었다. route 거부·운영시간 거부·대표/대안 중첩은 0건이며, 정확 route 시도는 모두 상한 4회 이하였다. 0개율은 1/4, 검증된 7개 코스의 장소 수 분포는 1곳 6개·2곳 1개·3곳 0개, 대표가 있는 세 행의 비중첩 대안은 각각 1·2·1개다. 따라서 고정 재현에서 음수 시간·도착 여유 위반·운영 불가 코스·비결정 결과는 발견하지 못했다.

#### 사용자 결정이 필요한 수치

1. **넓은 한 곳 lane:** 네 행 모두 `wideSingleCandidateId`가 사전선정됐고 3/4에서 검증 코스로 남았다. 현행처럼 사전선정 풀의 넓은 단일 후보 1개만 유지할지, 짧은 시간대 0개를 줄이기 위해 lane 수/거리 의미를 조정할지는 통합·결정과 사용자가 선택해야 한다. 이 측정만으로 엔진 상한이나 순위를 바꾸지 않았다.
2. **Route Proxy 일일 새 구간 예산:** cold run은 시나리오당 새 구간 8·10·8·9건(최대 10건), 즉 동일 사용 흐름의 재실행은 같은 수만큼 cache hit였다. 실제 제공사 비용/한도와 활성 사용자 수를 아직 측정하지 않았으므로 일일 예산은 확정하지 않았다. 결정 시 `예상 일일 신규 추천 실행 수 × 최대 10개 새 구간`을 출발 상한으로 두고, 제공사별 실패·cache 비율을 제한 수동 실행에서 확인해야 한다.

#### 출시 전 수정 대상과 인계

- 이 고정 fixture 기준의 **출시 전 수정 대상은 없음**이다. 이는 실제 provider 호출·화면 흐름·실기기 권한을 통과했다는 뜻은 아니다.
- `v1Session`의 구형 route adapter와 새 Route Proxy 제공사 정책의 연결은 여전히 별도 통합 위험이다. fixture metadata는 실제 Kakao/TMAP 호출을 증명하지 않으므로, 통합·외부 API 어댑터가 연결한 뒤 QA-04 제한 수동/실기기 시나리오에서 호출 수·시각·캡처를 남겨야 한다.

#### 실행·변경·인계

- 실행: `npm run test:qa:scenario` 5/5 통과, `npm run test:qa:supply` 1/1 통과, `npm run test:typecheck` 통과, `npm run test:ui` 103 통과·1 의도된 skip, `npm test` 92/92 통과, `git diff --check` 통과.
- 변경: `test/fixtures/qa02-recommendation-scenarios.fixture.ts`, `test/qa02-recommendation-harness.test.ts`, `test/qa03-supply-diversity.test.ts`, `package.json`, 이 작업기록. 엔진·UI·API adapter·원본 데이터·DB·제품 정책은 수정하지 않았다.
- 다음 세션 결정: 위 넓은 한 곳 lane과 일일 새 구간 예산을 사용자와 확정하기 전에는 후보 순위·상한·장소 데이터를 변경하지 않는다.

---

## 2026-08-28 — 통합·결정 지시 QA-03-R: 실제 대표 후보 기준 사전선정 진단

### 이전 측정과 이번 작업의 목적

- **이전 방식:** QA-03은 생활권별 제한 엔진의 결정성·4회 정확 경로 상한·cache 관찰을 보려는 목적으로, 시나리오마다 26~28개의 합성 후보와 고정 route fallback을 주입했다.
- **발생한 문제:** 그 결과의 `1/4 코스 없음`, 검증 7개 중 `1곳 6·2곳 1·3곳 0`은 실제 런타임 `representative_core / representative_standard` 190개 후보의 공급·사전선정 품질을 뜻하지 않는다. 합성 후보의 위치·체류·fallback이 현행 후보 풀과 다르므로 이를 근거로 후보 상한·순위·장소 데이터를 바꾸면 안 된다.
- **교체 방식:** 실제 `createCourseV1CandidateProvider()`가 반환하는 현행 대표 후보를 고정 시각으로 읽고, `buildLimitedRepresentativeCourseV1()`의 사전선정 진단을 **네트워크 없는 route adapter**와 함께 측정한다. 이 작업은 “어떤 실제 장소가 최대 18개 풀과 최대 4개 정확 검증 후보에 들어가는가”를 밝히는 진단이지, 실제 경로 통과율·대표/대안 공급량을 다시 주장하는 작업이 아니다.
- **상태:** 현행 지시. 결과가 수락되기 전까지 QA-03의 합성 후보 분포를 실제 앱의 0개율·1/2/3곳 비율로 해석하지 않는다.

### 담당·소유 경계

**담당:** QA·출시 세션. `test/`, `test/fixtures/`, `package.json`, 이 작업기록만 수정한다.

`src/engine/`, `src/data/`, 카탈로그 JSON, UI, API adapter, DB, 추천 정책 문서는 수정하지 않는다. 현재 카탈로그 수나 엔진 상한을 맞추기 위해 fixture·정렬·후보를 조작하지 않는다.

### 입력과 실행 경계

1. 현행 `createCourseV1CandidateProvider()`를 직접 사용한다. 별도 26~28개 합성 후보, `routeFallback`, 임의 장소 추가·삭제를 쓰지 않는다. 현재 시각은 QA-02와 같은 고정 `now`를 사용해 결과를 재현한다.
2. 입력은 QA02-01~04의 출발·도착/복귀·`45/5`, `78/8`, `120/10`, `180/10`분을 그대로 쓴다. 실제 GPS·현재 시각·사용자 위치를 읽지 않는다.
3. route adapter는 모든 요청을 기록한 뒤 `null`만 반환하는 명시적 무네트워크 spy로 만든다. 실제 Kakao·TMAP·ODsay·Route Proxy를 호출하거나, 고정된 성공 시간·fallback으로 통과 코스를 만들어서는 안 된다.
4. 이 어댑터 때문에 모든 최종 결과가 `no_verified_course_within_limit`일 수 있다. 이를 추천 0개·실제 공급 실패로 집계하거나 QA-03의 0개율과 합치지 않는다. 이 작업의 route 호출 수는 정확 경로 후보 선택을 관찰하는 내부 호출 수일 뿐, 제공사 호출 수는 항상 0이어야 한다.

### 측정·기록 항목

각 시나리오별로 아래 원본값을 표와 기계 판독 가능한 fixture/테스트 출력으로 남긴다.

1. provider가 반환한 대표 후보 수, 분류/운영시간 사전 제외 수가 공개 계약상 관찰 가능하면 그 값, 후보 풀 수(최대 18), 생성 순서 코스 수(최대 5,220), `wideSingleCandidateId`, `preselectedCourseIds`, 정확 검증 시도 수(최대 4)를 기록한다.
2. 후보 풀·넓은 lane·정확 검증 후보에 든 **실제 장소 ID와 제목**을 원본 provider 결과에서 대응시킨다. 좌표·지역·활동 유형이 기존 공개 후보 속성에 있으면 설명용으로만 함께 기록하되, 새 추정 분류를 만들지 않는다.
3. 네 시나리오 간 후보 풀과 정확 검증 후보의 중복, 넓은 lane이 풀/정확 검증 후보에 실제로 포함됐는지, 45분 서면에서 실제 후보가 사전선정에 들어갔는지를 기록한다. “어떤 후보가 시간에 맞는다”는 route 성공 근거 없이 쓰지 않는다.
4. 기존 QA-03 합성 측정과 나란히 `측정 대상이 다름`을 명시한다. 두 결과의 0개율·1/2/3곳 분포·cache miss를 평균·합산·비교해 결론 내리지 않는다.

### 필수 회귀와 완료 기준

1. 같은 고정 입력을 두 번 실행해 provider 후보 ID·후보 풀 ID·넓은 lane·사전선정 코스 ID·정확 시도 수가 동일함을 검증한다.
2. 네 시나리오 모두 실제 대표 provider에서만 후보를 읽고, 합성 후보 ID·`routeFallback`이 사용되지 않으며, 외부 provider 호출은 0회임을 검증한다.
3. 후보 풀은 18 이하, 생성 순서 코스는 5,220 이하, 정확 검증 시도는 4 이하, 넓은 lane이 있으면 풀과 사전선정 결과에 일관되게 반영됨을 검증한다. 현재 엔진의 한계로 lane이 최종 route 실패한 것은 실패로 만들지 않는다.
4. QA-03의 기존 5개 시나리오 테스트와 새 진단 테스트, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 네트워크를 쓴 테스트는 금지한다.
5. 이 문서 끝에 변경 파일 / 수정하지 않은 엔진·데이터·API 정책 경계 / 실행 결과 / 다음 결정 필요 사항을 남긴다. 다음 결정에는 최소한 (a) 실제 190 후보에서 후보 부족인지 사전선정 부족인지, (b) 실제 경로를 제한 수동 확인할 필요가 있는지와 허용 가능한 호출 상한을 분리한다.

**완료 기준:** 실제 190개 대표 후보를 사용한 재현 가능한 사전선정 진단이 남고, QA-03 합성 수치가 실제 공급 수치로 오해되지 않으며, 외부 API 호출 없이 다음 추천 엔진 보완의 원인을 후보 공급·사전선정·실경로 미확인으로 분리한다.

### QA-03-R 실행 결과 — 2026-08-28

`test/fixtures/qa03r-real-provider-preselection.fixture.ts`는 현행 `createCourseV1CandidateProvider()`를 직접 사용한다. QA-02와 같은 고정 입력만 복사하며, 합성 `qa02-*` 후보·`routeFallback`·성공 route 시간은 사용하지 않는다. route adapter는 요청 쌍을 기록하고 `null`만 반환하는 spy이므로, 아래 `no_verified_course_within_limit`은 실제 추천 0개나 실제 장소 공급 실패가 아니라 **실경로 미확인 상태**다. 외부 Kakao·TMAP·ODsay·Route Proxy 호출은 모든 행에서 0건이다.

| ID | 대표 provider | 사전선정 가능 / 제외 | 후보 풀·생성 코스·정확 시도 | 넓은 한 곳 | null-spy 내부 요청 | 결과 |
|---|---:|---:|---|---|---:|---|
| QA02-01 서면 45/5 | 190 | 155 / 35 | 18 / 5,220 / 4 | `poi_239` 황령산 전망대 (풀·사전선정 포함) | 4 | `no_verified_course_within_limit` |
| QA02-02 사상 78/8 | 190 | 155 / 35 | 18 / 5,220 / 4 | `poi_743` 망양로 산복도로 전시관 (풀·사전선정 포함) | 3 | `no_verified_course_within_limit` |
| QA02-03 남포 120/10 | 190 | 155 / 35 | 18 / 5,220 / 4 | `poi_165` 민주공원 (풀·사전선정 포함) | 3 | `no_verified_course_within_limit` |
| QA02-04 해운대 180/10 | 190 | 112 / 78 | 18 / 5,220 / 4 | `poi_125` 경상좌수영성지 (풀·사전선정 포함) | 3 | `no_verified_course_within_limit` |

`제외`는 공개 제한 엔진 진단의 `classificationExcluded` 값으로, 분류 또는 고정 시각에 시작 가능하지 않은 후보를 합친 사전선정 제외다. 새 분류나 운영시간 판정을 만들지 않았다. 45분 서면도 실제 provider 장소 4개 코스가 사전선정에 들어갔다. route spy가 모두 `null`을 반환해 정확 route 시도는 4회이나, route 통과·체류 가능·대표/대안·0개율은 이 결과에서 계산하지 않는다.

#### 원본 장소 대응

- **QA02-01 후보 풀:** `poi_801` 롯데백화점 부산본점, `poi_823` 포셋 전포, `poi_817` 아비베르컴퍼니, `poi_1051` 커피스가모 인 서면, `poi_711` 서면미술관, `poi_821` 오브젝트 서면점, `poi_77` 희와제과, `poi_689` 부산커피박물관, `poi_819` 페이퍼가든, `poi_93` 부산전자종합시장, `poi_735` 부산 수학문화관, `poi_1071` 히떼로스터리 전포점, `poi_1158` 히떼로스터리, `poi_656` 부산시민공원, `poi_213` 전포 삼거리, `poi_694` 부산신발이야기, `poi_302` 부산 자유도매시장, `poi_239` 황령산 전망대. **정확 검증 후보:** `poi_801` 롯데백화점 부산본점 / `poi_239` 황령산 전망대 / `poi_711` 서면미술관 → `poi_817` 아비베르컴퍼니 / `poi_817` 아비베르컴퍼니 → `poi_821` 오브젝트 서면점 → `poi_823` 포셋 전포.
- **QA02-02 후보 풀:** `poi_304` 부산새벽시장, `poi_185` 사상근린공원, `poi_264` 부산점자도서관, `poi_266` 사상문화원, `poi_800` 롯데면세점 김해공항점, `poi_713` 대저생태공원, `poi_287` 구포시장, `poi_252` 부산 강서문화원, `poi_1070` 연화제과, `poi_265` 북구문화예술회관 공연장, `poi_735` 부산 수학문화관, `poi_225` 친환경 스카이웨이 전망대(이바구길), `poi_1051` 커피스가모 인 서면, `poi_257` 부산광역시립 시민도서관, `poi_744` 닥밭골 벽화마을, `poi_801` 롯데백화점 부산본점, `poi_168` 범일 이중섭거리, `poi_743` 망양로 산복도로 전시관. **정확 검증 후보:** `poi_304` 부산새벽시장 / `poi_743` 망양로 산복도로 전시관 / `poi_185` 사상근린공원 → `poi_266` 사상문화원 / `poi_185` 사상근린공원 → `poi_304` 부산새벽시장 → `poi_266` 사상문화원.
- **QA02-03 후보 풀:** `poi_285` 광복 지하도상가, `poi_290` 남포동 지하도상가, `poi_16` 용두산 자갈치 관광특구, `poi_94` 부산타워, `poi_615` 한성1918 부산생활문화센터, `poi_773` BNK부산은행 아트시네마 모퉁이극장, `poi_614` 백산기념관, `poi_766` 갤러리 플레이리스트, `poi_69` 만물의거리, `poi_11` 아리랑거리, `poi_92` 부산근현대역사관 본관, `poi_1065` 그리다부부, `poi_661` 40계단, `poi_1141` 백구당, `poi_107` 영도봉래시장, `poi_187` 색채마을, `poi_745` 대청스카이전망대, `poi_165` 민주공원. **정확 검증 후보:** `poi_285` 광복 지하도상가 / `poi_165` 민주공원 / `poi_16` 용두산 자갈치 관광특구 → `poi_290` 남포동 지하도상가 / `poi_285` 광복 지하도상가 → `poi_614` 백산기념관 → `poi_615` 한성1918 부산생활문화센터.
- **QA02-04 후보 풀:** `poi_78` 고래서이뻐, `poi_811` 해운대 선물가게, `poi_789` 해운대시장, `poi_1` 해운대 관광특구, `poi_1152` 머그디저트랩, `poi_22` 해운대 동백섬, `poi_174` 부산 영화의 거리, `poi_37` 미포항, `poi_7` 청사포 기찻길, `poi_802` 롯데백화점 센텀시티점, `poi_3` 신세계백화점 센텀시티점, `poi_211` 장산 (부산 국가지질공원), `poi_151` 대천공원, `poi_806` NC백화점 해운대점, `poi_724` KF아세안문화원, `poi_79` 광안리해변 테마거리, `poi_75` 해운대 그린레일웨이 (미포~송정 구간), `poi_125` 경상좌수영성지. **정확 검증 후보:** `poi_78` 고래서이뻐 / `poi_125` 경상좌수영성지 / `poi_789` 해운대시장 → `poi_811` 해운대 선물가게 / `poi_789` 해운대시장 → `poi_811` 해운대 선물가게 → `poi_78` 고래서이뻐.

#### 중복·해석 경계

- 후보 풀의 생활권 간 중복은 사상과 서면의 `poi_735`, `poi_1051`, `poi_801` 세 곳뿐이었다. 네 시나리오의 정확 검증 후보 장소 집합에는 서로 중복이 없었다.
- 위 수치와 QA-03의 합성 route fixture 수치는 **측정 대상이 다르다**. 두 결과의 0개율·1/2/3곳 분포·cache miss를 평균·합산·우열 비교하지 않는다.

#### 실행·인계

- 변경 파일: `test/fixtures/qa03r-real-provider-preselection.fixture.ts`, `test/qa03r-real-provider-preselection.test.ts`, `package.json`, 이 작업기록.
- 유지한 경계: 엔진·카탈로그/원본 데이터·UI·API adapter·DB·추천 정책을 수정하지 않았다. 실제 API·GPS·DB·현재 시각도 읽지 않았다.
- 실행 결과: `npm run test:qa:real-preselection` 1/1 통과(같은 입력 두 번의 결과 동일), `npm run test:qa:scenario` 5/5 통과, `npm run test:qa:supply` 1/1 통과, `npm run test:typecheck` 통과, `npm run test:ui` 103 통과·1 의도된 skip, `npm test` 92/92 통과, `git diff --check` 통과.
- 다음 결정: 이 진단은 실제 190 후보의 **공급 부족을 보이지 않는다**(모든 행 18개 풀 도달). 다만 18개 풀과 4개 사전선정 후보가 실제 경로·시간을 통과하는지는 미확인이다. 통합·결정은 (a) 18개/넓은 한 곳/4개 사전선정이 부족한지 엔진 보완을 검토할지, (b) 제한 수동 경로 확인을 할지와 시나리오당 허용할 실제 새 구간 호출 상한을 별도로 정해야 한다.

### 2026-08-28 — 통합·결정 검토: QA-03-R 수락·실경로 판정 보류

- **수락:** 실제 `createCourseV1CandidateProvider()`의 고정 190개 후보만 사용했고, 합성 후보·성공 fallback·GPS·DB·외부 API 없이 결과가 결정적으로 재현된다. 네 입력 모두 사전선정 가능 후보가 112~155개, 후보 풀은 18개, 생성 순서 코스는 5,220개, 정확 검증 시도는 4개 이하였으며 넓은 한 곳 lane도 풀과 사전선정에 포함됐다. 전체 회귀도 통과했다.
- **확인된 사실:** 서면 45분을 포함한 네 시나리오에서 후보 풀은 모두 상한 18개에 도달했다. 따라서 현재 관찰된 빈 추천을 “대표 장소가 애초에 부족해서”라고 단정할 근거는 없다. 사전선정 후보에는 생활권별 서로 다른 실제 장소가 들어가며, 정확 검증 후보 간 생활권 중복도 없었다.
- **판정하지 않은 사항:** null route spy는 첫 구간에서 중단하므로 실제 도보·대중교통 시간, 왕복/도착 구간, 운영시간 최종 통과, 대표·대안 수와 0개율을 증명하지 않는다. 특히 18개 풀·넓은 한 곳 한 개·정확 4개가 실제 경로 상황에서 충분한지, 또는 구형 ODsay adapter가 빈 추천의 주원인인지는 이 결과만으로 결정할 수 없다.
- **상태:** 현행 후보 데이터와 사전선정의 무네트워크 진단은 수락한다. 후보 순위·18개 풀·4개 상한·장소 분류는 변경하지 않는다. 다음 검증은 API 호출량 상한을 먼저 확정한 뒤, 실제 route adapter 또는 활성화된 Proxy로 한정해야 한다. 현재 190이라는 고정 수는 이번 카탈로그 기준선이며, 데이터 확장 시 진단 기록과 기대값을 함께 갱신한다.

---

## 2026-08-26 — 통합·결정 지시 QA-04: 실기기 추천 체감 게이트

**선행 조건:** U-1-F, 2-J 완료와 iOS 시뮬레이터 또는 실기기 사용 가능. 1/2/3곳·넓은 한 곳·대안 목록·긴 장소명·남는 시간 rail·VoiceOver·사진 없음·카카오맵 전환을 고정 fixture로 실행한다. 시나리오 ID, 기기, 입력, 캡처/로그, 성공/실패를 기록하며 외부 API 반복 호출은 금지한다.

### 2026-08-28 — 통합·결정 정정: QA-04 0단계 Route Proxy 활성화 smoke

**이전 순서 → 문제:** QA-04를 `2-J` 뒤의 전체 체감 게이트로만 두었다. 그러나 Route Proxy가 실제로 CAPTCHA·anonymous Auth·Kakao와 연결되는지는 2-J보다 먼저 알아야 하며, 그렇지 않으면 추천 엔진 작업의 입력 경로 자체가 확정되지 않는다.

**교체 방식:** QA-04 안에 별도 suffix 없이 **0단계 제한 smoke**를 둔다. 0단계 수락 뒤에만 2-J을 시작하고, 기존의 전체 체감 검증은 QA-04 1단계로 유지한다.

#### QA-04 0단계 수행 지시

1. 선행 조건은 `API-4-A-ACT-04-B C-1`의 `route-proxy` 제한 배포와 사용자 완료 Cloudflare/Turnstile/Supabase Auth 설정이다. 앱에는 정확한 HTTPS Worker root URL과 Proxy flag를 **내부 test build에만** 주입한다. key·Turnstile secret·JWT·좌표·실사용 GPS·주소·약속은 환경값·캡처·기록에 넣지 않는다.
2. 내부 iOS 실기기에서 신규 session 한 번과 기존 anonymous session 재실행 한 번만 검사한다. 첫 실행은 widget 완료 → anonymous sign-in 1회 → authenticated Proxy 요청, 재실행은 CAPTCHA/sign-in 0회 → authenticated Proxy 요청이어야 한다. API 호출을 늘리기 위한 반복 추천은 금지한다.
3. 경로 입력은 공개 representative fixture만 사용한다. 실제 현재 위치 권한·개인 장소 검색·개인 약속은 사용하지 않는다. 확인 항목은 widget 렌더링/닫기/재시도, 결과 또는 typed failure, legacy TMAP·ODsay fallback 0, Kakao walk/transit provider attempt와 cache/budget 상태의 최소 진단이다. token·JWT·좌표·key는 화면/terminal/capture에서 마스킹한다.
4. 성공은 UI가 Proxy 결과를 수신하고 두 흐름 모두 예상 횟수로 끝나는 경우다. `limited`·`network_error`·widget 실패도 legacy로 우회하지 않고 안전한 오류 문구로 끝나면 관찰 결과를 남긴다. 실패한 경우에는 public Proxy flag를 즉시 제거하거나 false로 둔 채 중단하며, ODsay 제거·2-J·추가 provider 호출을 하지 않는다.
5. 기록에는 앱 build, Worker hostname(필요하면 일부 마스킹), snapshot version, 신규/기존 session 결과, CAPTCHA/sign-in/Proxy/provider attempt/cache 결과, 캡처 경로, 성공·실패만 남긴다. 비밀값과 개인정보는 0개다.

#### QA-04 0단계 완료 기준

실기기에서 실제 Turnstile WebView와 Route Proxy 연결을 최소 호출로 확인하고, legacy fallback이 없음을 재현 가능하게 남긴다. 이 결과는 전체 추천 품질 수락이 아니라 **2-J을 시작할 수 있는 Route Proxy 활성화 근거**다.

#### QA-04 0단계 제한 smoke 실행 기록 — 2026-08-28

**상태: 실패·활성화 차단.** 내부 iOS 실기기에서 신규 익명 session 1회를 시도했다. 공개 fixture로 추천 시작 뒤 화면은 `안전 확인을 열지 못했어요. 다시 시도해 주세요.`라는 안전 오류로 끝났다. CAPTCHA widget 완료·anonymous sign-in·JWT 발급·authenticated Route Proxy·Kakao provider 단계에는 도달하지 못했다. 재시도는 하지 않았고, 기존 anonymous session 재실행도 수행하지 않았다.

| 항목 | 기록 |
|---|---|
| 앱 build | `com.dongheun.mobile` 1.0.0 (1), 내부 test build |
| Worker hostname / snapshot version | widget 실패 전이므로 화면·기록에 남기지 않음 |
| 신규 session | CAPTCHA widget 실패 1회, CAPTCHA 완료 0회, anonymous sign-in 0회, Proxy 요청 0회 |
| 기존 session | 신규 세션이 생성되지 않아 **미실행** |
| Kakao walk/transit / cache·budget | Proxy 단계 미도달로 0회 / 관찰 불가 |
| legacy TMAP·ODsay fallback | 오류가 추천 세션 시작 전 종료되어 UI상 fallback 0회. 별도 네트워크 로그로 독립 검증하지는 못함 |
| 캡처 | 개인정보·token 노출을 피하기 위해 별도 캡처를 저장하지 않음; 사용자 관찰 문구만 기록 |

실패 후 실기기 앱 process를 종료했고, 추가 추천·provider 호출·ODsay 제거·2-J 시작을 하지 않았다. 설치된 build의 Proxy flag는 컴파일 시 주입된 내부 test 설정이라 QA 세션에서 안전하게 원격 false 전환할 수 없다. 다음 실행 전 build/활성화 담당은 해당 내부 build의 Proxy flag를 false 또는 Worker root 제거 상태로 되돌리고, Turnstile challenge root의 HTTPS 응답·WebView 허용 URL·Supabase anonymous CAPTCHA 설정을 비밀값 없이 점검해야 한다.

**유지한 경계:** 엔진·UI·API adapter·DB·카탈로그와 `.env.local`을 수정하지 않았다. 실제 위치·개인 장소·개인 약속·token·JWT·key·좌표를 기록하지 않았다.

#### 2026-08-29 — 통합·결정 검토: QA-04 0단계 실패 판정

- **판정:** 수락하지 않는다. 실패는 Route Proxy·Supabase anonymous Auth·Kakao provider보다 앞선 CAPTCHA WebView 구간에서 발생했다. 따라서 이 결과로 Kakao 키, route-proxy 배포, 캐시/예산, 추천 엔진을 수정하거나 ODsay를 되돌릴 근거는 없다.
- **원인 정정:** Turnstile Hostname Management에는 실제 Worker hostname이 이미 정확히 등록되어 있었다. 공개 root `https://timefit-captcha.sdongheun.workers.dev/`를 비밀값 없이 확인한 결과는 `HTTP 200`, `Content-Type: text/plain`, 본문 `Hello World!`였다. 즉 배포된 endpoint는 repository의 CAPTCHA Worker artifact가 아니라 Cloudflare 기본 Worker다. 이 사실만으로 QA의 일반 오류 문구가 난 모든 UI 원인을 단정할 수는 없지만, widget이 렌더링될 수 없는 선행 배포 결함은 확정이다.
- **정상화 순서:** (1) repository `cloudflare/captcha-worker` artifact를 위 Worker에 배포한다. (2) 배포 Worker에 `TURNSTILE_SITE_KEY`가 **Turnstile public site key**로 존재하는지 값 없이 확인한다. (3) root가 `200 text/html`, `Cache-Control: no-store`, Turnstile script marker를 반환하는지만 확인한다. `503`이면 Worker secret 누락이므로 public site key만 Cloudflare Worker secret으로 추가한다. (4) 이미 설치한 internal build에서 신규 session 1회만 다시 실행한다. 이 변경들은 app URL을 바꾸지 않으므로 앱 재빌드는 필요 없다. (5) 여전히 실패하면 URL 설정 유효성, WebView navigation/error 원인을 **범주 코드만** 남겨 분리한다. 이 단계에서도 anonymous Auth·Proxy·Kakao 호출은 금지한다.
- **다음 게이트:** CAPTCHA widget 완료가 확인된 뒤에만 신규 anonymous Auth와 authenticated Proxy의 제한 smoke를 이어서 수행한다. 그 전 `2-J`, Proxy 기본 전환, ODsay 제거는 계속 보류한다.

#### QA-04 0단계 재시험 기록 — 2026-08-29

**상태: 실패·활성화 차단 유지.** Worker artifact 정상화 뒤, 같은 internal build에서 허용된 신규 흐름을 한 번만 다시 실행했다. 공개 fixture 추천 시작 후 동일한 `안전 확인을 열지 못했어요. 다시 시도해 주세요.` 오류로 끝났다. CAPTCHA widget 완료 전 실패했으므로 anonymous Auth session은 생성되지 않았고, 기존 session 검증은 실행하지 않았다. 재시도·추가 추천·legacy fallback은 하지 않았으며 실기기 앱 process를 종료했다.

| 단계 | 결과 |
|---|---|
| CAPTCHA widget | 실패 — WebView/UI 일반 오류 문구만 관찰, 원시 URL·token·key 미기록 |
| anonymous Auth / JWT | 0회 — widget 완료 전 미도달 |
| Route Proxy / Kakao walk·transit | 0회 — Auth 전 미도달 |
| cache·budget | 관찰 불가 — Proxy 요청 0회 |
| legacy TMAP·ODsay | UI 흐름상 0회 — 별도 네트워크 로그 독립 검증은 없음 |
| 기존 anonymous session | 미실행 — 신규 흐름 성공 뒤에만 허용되는 조건을 충족하지 못함 |

다음 조치는 앱 build의 CAPTCHA WebView에서 발생한 오류를 `URL 설정 유효성`, `최상위 navigation 차단`, `보조 frame navigation 차단`, `WebView network/HTTP` 중 하나의 **비밀 없는 범주 코드**로 관찰 가능하게 만드는 UIUX/API 활성화 작업이다. 이 원인이 분리되고 새 승인 뒤에만 신규 흐름을 다시 실행한다. 이 QA 세션은 엔진·UI·API adapter·DB·카탈로그·환경값을 수정하지 않았다.

#### QA-04 0단계 제한 smoke 재시도 결과 — 2026-08-29

**상태: 실패·활성화 차단 유지.** `API-4-A-ACT-04-B`의 표준 implicit Worker 정상화 뒤 허용된 내부 build 신규 흐름을 1회 실행했으나, 공개 fixture 추천 시작 후 동일한 CAPTCHA widget 일반 오류로 종료했다. CAPTCHA 완료 이전에 끝났으므로 anonymous Auth·JWT·Route Proxy·Kakao walk/transit은 모두 0회이며, 기존 session은 실행하지 않았다. 추가 재시도·legacy TMAP/ODsay fallback·2-J 진행은 하지 않았고 실기기 앱 process를 종료했다.

| 관찰 단계 | 결과 |
|---|---|
| CAPTCHA widget | 실패 — UI 일반 오류만 관찰. URL·token·key·좌표·주소 미기록 |
| anonymous Auth / JWT / Route Proxy | 0회 — widget 완료 전 미도달 |
| Kakao walk/transit, cache·budget | 0회 / 관찰 불가 |
| legacy TMAP·ODsay | UI 흐름상 0회, 독립 네트워크 로그는 없음 |
| 기존 anonymous session | 미실행 — 신규 흐름 성공 후에만 허용 |

이번 반복 실패는 Worker artifact만으로 원인이 분리되지 않음을 보인다. QA가 다시 실행할 근거는 없으며, UIUX/API 활성화 담당은 실제 WebView의 `top-level URL`, `subframe navigation`, `HTTP/network`, `message source` 중 실패한 범주를 비밀 없는 enum으로 남길 수 있게 보완한 뒤 새 승인해야 한다. 엔진·UI·API adapter·DB·카탈로그·환경값은 수정하지 않았다.

#### QA-04 0단계 진단 신규 session 결과 — 2026-08-29 (U-1-CAP transport 보정 후)

**상태: 실패·활성화 차단 유지.** `U-1-CAP`의 WebView transport whitelist 보정이 수락된 diagnostics 설정에서, 내부 iOS 실기기 신규 anonymous session을 정확히 1회 실행했다. 공개 representative fixture로 추천을 시작하고 CAPTCHA 화면에서 사용자가 완료를 시도했으나, 비밀 없는 visible enum `webview_network_error`로 끝났다. CAPTCHA 완료 전 실패했으므로 anonymous Auth·JWT·Route Proxy·Kakao walk/transit은 모두 0회이며, 성공 뒤에만 허용되는 기존 anonymous session은 실행하지 않았다.

| 항목 | 결과 |
|---|---|
| 기기 / 앱 build | iPhone (iOS 26.6) / `com.dongheun.mobile` 1.0.0 (1), internal diagnostics build |
| 시나리오 | QA-04 0단계 신규 anonymous session 1회, 공개 representative fixture |
| CAPTCHA | 실패 — `webview_network_error`; token·JWT·주소·좌표·key 미기록 |
| anonymous Auth / Route Proxy / Kakao | 0회 / 0회 / 0회 — CAPTCHA 완료 전 미도달 |
| legacy TMAP·ODsay fallback | UI 흐름상 0회; 별도 네트워크 로그로 독립 검증하지 않음 |
| 기존 anonymous session | 미실행 — 신규 흐름 성공 조건 미충족 |
| 캡처·로그 | 민감정보 노출 방지를 위해 저장하지 않음; visible enum과 시나리오만 기록 |

실패 직후 iPhone의 앱 process를 종료했다. 추가 CAPTCHA 재시도·추천·provider 호출·기존 session 실행은 하지 않았다. 이 결과는 `about:*` transport 보정 이후에도 WebView network/HTTP 경계가 남아 있음을 보일 뿐이며, CAPTCHA 성공 여부·Auth·Proxy·Kakao·cache/budget이나 legacy provider transport을 판정하지 않는다. 다음 실행 전 UIUX/API 활성화 담당은 `webview_network_error`의 비밀 없는 원인을 분리·수정하고 새 diagnostics build와 수락 상태를 제공해야 한다. QA는 그 수락 뒤에만 새 신규 session 1회를 실행한다.

#### QA-04 0단계 진단 신규 session 결과 — 2026-08-29 (Worker URL 수정 후)

**상태: 실패·활성화 차단 유지.** 중복 hostname URL 오타를 수정하고 Metro cache를 재시작한 diagnostics 설정에서, 내부 iOS 실기기 신규 anonymous session을 정확히 1회 실행했다. 공개 representative fixture로 추천을 시작하자 `보안 확인 진행 중` 화면은 표시됐으나, 곧 `안전 확인 또는 경로 연결을 완료하지 못했어요. 다시 시도해주세요.`라는 안전 오류로 끝났다. CAPTCHA 완료, anonymous Auth, Route Proxy, Kakao provider의 각 실제 시도/성공 여부는 이 UI 문구만으로 분리할 수 없어 **관찰 불가**로 기록한다. 기존 session은 신규 흐름 성공 뒤에만 허용되므로 실행하지 않았다.

| 항목 | 결과 |
|---|---|
| 기기 / 앱 build | iPhone (iOS 26.6) / `com.dongheun.mobile` 1.0.0 (1), internal diagnostics build |
| 시나리오 | QA-04 0단계 신규 anonymous session 1회, 공개 representative fixture |
| CAPTCHA UI | `보안 확인 진행 중` 표시 후 안전 오류. token·JWT·주소·좌표·key 미기록 |
| Auth / Route Proxy / Kakao | 관찰 불가 — UI 오류 문구가 단계별 진단을 제공하지 않음 |
| legacy TMAP·ODsay fallback | UI 흐름상 0회; 별도 네트워크 로그로 독립 검증하지 않음 |
| 기존 anonymous session | 미실행 — 신규 흐름 성공 조건 미충족 |

실패 직후 iPhone의 앱 process를 종료했고, 추가 CAPTCHA 재시도·추천·provider 호출·기존 session 실행은 하지 않았다. URL 오타 수정은 WebView의 최초 진입을 복구했지만, 이 오류는 anonymous Auth와 Route Proxy를 구분하지 못하는 관찰성 결함을 남긴다. UIUX/API 활성화 담당은 CAPTCHA 완료 여부, Auth 결과, Proxy typed failure를 비밀 없는 서로 다른 enum으로 노출·검증하고 새 diagnostics build를 수락해야 한다. 그 전에는 QA-04 추가 신규 session, Proxy 기본 활성화, ODsay 제거, 2-J 진행을 하지 않는다.

#### QA-04 0단계 진단 신규 session 결과 — 2026-08-29 (Auth/Proxy reason 표시 후)

**상태: 실패·활성화 차단 유지.** Auth/Proxy diagnostics가 수락된 internal build에서 신규 anonymous session을 정확히 1회 실행했다. 공개 representative fixture로 추천을 시작해 CAPTCHA를 완료한 뒤, 화면은 일반 안전 문구와 함께 비밀 없는 visible reason `anonymous_auth_failed`를 표시했다. 계약상 이는 Supabase anonymous Auth CAPTCHA/anonymous 경계의 실패이며, Route Proxy·Kakao 단계는 진행하지 않았다. 기존 session은 신규 흐름 성공 뒤에만 허용되므로 실행하지 않았다.

| 항목 | 결과 |
|---|---|
| 기기 / 앱 build | iPhone (iOS 26.6) / `com.dongheun.mobile` 1.0.0 (1), internal diagnostics build |
| 시나리오 | QA-04 0단계 신규 anonymous session 1회, 공개 representative fixture |
| CAPTCHA / Auth | CAPTCHA 완료 후 `anonymous_auth_failed`; token·JWT·주소·좌표·key 미기록 |
| Route Proxy / Kakao | 0회 — anonymous Auth 실패 뒤 fail-closed |
| legacy TMAP·ODsay fallback | UI 흐름상 0회; 별도 네트워크 로그로 독립 검증하지 않음 |
| 기존 anonymous session | 미실행 — 신규 흐름 성공 조건 미충족 |

실패 직후 iPhone의 앱 process를 종료했다. 추가 CAPTCHA 재시도·추천·provider 호출·기존 session 실행은 하지 않았다. 이 결과로 WebView URL/transport 문제가 아니라 Supabase anonymous Auth의 CAPTCHA/anonymous 설정 경계가 다음 수정 대상임을 확인했다. Route Proxy·Kakao·cache/budget·legacy transport의 정상성은 이 실행으로 판정하지 않는다. Supabase Auth 담당이 `anonymous_auth_failed`를 수정·수락한 새 diagnostics build를 제공할 때까지 QA-04 신규 session을 재실행하지 않는다.

#### QA-04 0단계 제한 smoke 완료 기록 — 2026-08-29 (Supabase Turnstile secret 교정 후)

**상태: 제한 smoke 통과.** Supabase CAPTCHA 설정을 동일 widget의 Turnstile Secret key로 교정한 internal diagnostics build에서, 공개 representative fixture로 실기기 iPhone의 신규 anonymous session 1회와 기존 session 재실행 1회를 각각 수행했다. 신규 흐름은 CAPTCHA 완료 뒤 결과 화면까지 도달했고, 이어서 앱을 종료·로그아웃하지 않은 상태의 기존 session에서 같은 fixture를 한 번만 다시 실행했다. 두 번째 실행은 CAPTCHA를 표시하지 않고 결과가 동작했다.

| 항목 | 신규 anonymous session | 기존 anonymous session 재실행 |
|---|---|---|
| 실행 횟수 | 정확히 1회 | 정확히 1회 |
| CAPTCHA | 완료 후 결과 동작 | 0회 — 재표시 없음 |
| anonymous Auth / JWT | 인증 흐름 완료 후 결과 동작; 값 미기록 | 0회 — 기존 session 재사용 |
| Route Proxy 결과 | 결과 화면 도달 | 결과 화면 도달 |
| Kakao / cache·budget | Proxy 결과에 대한 제공사 attempt·cache/budget 세부값은 화면에서 관찰 불가 | 동일 — 별도 provider 로그 미수집 |
| legacy TMAP·ODsay fallback | UI 흐름상 0회; 독립 네트워크 로그로는 검증하지 않음 | UI 흐름상 0회; 독립 네트워크 로그로는 검증하지 않음 |

- 기기 / 앱 build: iPhone (iOS 26.6) / `com.dongheun.mobile` 1.0.0 (1), internal diagnostics build.
- 민감정보: token·JWT·주소·좌표·key·raw URL·raw error를 기록하거나 저장하지 않았다.
- 종료: 두 허용 실행을 마친 직후 iPhone의 앱 process를 종료했으며, 추가 추천·CAPTCHA 재시도·provider 호출은 하지 않았다.

**수락 범위:** 실제 iOS WebView CAPTCHA → anonymous Auth → authenticated Route Proxy 결과와, 기존 session의 CAPTCHA/Auth 0회 재사용을 최소 호출로 확인했다. 이는 전체 추천 품질이나 Kakao provider의 새 HTTP attempt, cache/budget 상태를 독립 검증한 결과는 아니다. legacy fallback은 UI 경로에서 관찰되지 않았으나 transport observer 로그가 없으므로 독립 증거로 과장하지 않는다. Proxy 기본 활성화·ODsay 제거·2-J은 별도 활성화 게이트의 결정 사항으로 남는다.

---

## 2026-08-29 — 통합·결정 지시 QA-05: Proxy 활성 2-J runtime 통합 검증

### 수행 결과

**상태: 수락.** `test/qa05-proxy-runtime-integration.test.ts`에 실제 Edge/Provider가 아닌 고정 Proxy route+receipt port를 주입하는 runtime 하네스를 추가했다. `buildRecommendationLimitedInput()`의 Proxy 활성 공개 조립 entry가 동일 port를 `routes`와 `receiptRoutes`에 전달하는지 확인한 뒤, 고정 후보/receipt만으로 엔진을 실행했다. 실제 Kakao·Supabase·Cloudflare·CAPTCHA·GPS·DB 호출은 모두 **0회**다.

| 검증 ID | 입력·경계 | 결과 |
|---|---|---|
| QA05-01 | 사상·서면·부산역·남포·광안리·해운대 × 45/78/120/180분 × 복귀/도착지 = 48 고정 입력 | 48/48 결과 검증. 매 행 `newProviderAttemptCount ≤ 8`, `adapterCallCount ≤ 24`, legacy factory 0회, route-only port 0회. |
| QA05-02 | 앞 네 후보 `no_route`, 뒤 후보 보충, 동일 구간 `reused` receipt | 뒤 후보가 대표로 보충됐고 새 attempt 4회, 재사용 receipt가 2회 이상이며 adapter 상한 이내. |
| QA05-03 | 9개 후보의 `no_route` receipt | 8번째 새 attempt에서 `route_verification_unavailable`으로 fail-closed. receipt 호출 8회, 추가 adapter/provider 호출 없음. |
| QA05-04 | 다섯 빈 결과 reason | `no_eligible_candidates`, `no_open_candidates`, `time_budget_exceeded`, `route_not_verified`, `route_verification_unavailable`가 Results UI의 provider·HTTP·quota·URL·좌표·token/JWT·cache key 없는 고정 문구로 매핑됨. |

### 실행 검증

- `npx tsx --test test/qa05-proxy-runtime-integration.test.ts` — 4/4 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 118 통과, 1 의도된 skip.
- `npm test` — 101/101 통과.
- `git diff --check` — 통과.

### 변경·경계·인계

- 변경 파일: `test/qa05-proxy-runtime-integration.test.ts`, 이 작업기록. Proxy 활성 UI→engine 조립·receipt 예산·보충·빈 상태만 고정 fixture로 검증했다.
- 변경하지 않은 경계: `src/engine/`, `src/services/`, `src/ui/`, 카탈로그/원본 데이터, DB, 환경 설정, `docs/작업조정_보드.md`를 수정하지 않았다. API key·token·JWT·개인 위치·실사용자 데이터도 사용하거나 기록하지 않았다.
- 다음 결정: 이 수락은 runtime 계약의 고정 fixture 통합 근거다. 실제 Kakao provider 정확도, cache/budget/legacy transport 관찰, 실기기 추천 품질은 별도 제한 수동 계획에서 세션별 호출 상한과 공개 fixture를 확정한 뒤 검증한다. Proxy 기본 활성화·ODsay 제거는 이 테스트만으로 자동 승인되지 않는다.

### 2026-08-29 — 통합·결정 검토: QA-05 보완 필요(같은 작업 안에서 종료)

- **확인된 통과 범위:** 통합·결정에서 `npx tsx --test test/qa05-proxy-runtime-integration.test.ts`를 재실행해 4/4 통과, `npm run test:typecheck`와 `git diff --check` 통과를 확인했다. Proxy 활성 48 입력, 8 attempt/24 adapter call 상한, 8번째 이후 중단, 다섯 빈 상태 문구와 실제 외부 호출 0회는 근거가 있다.
- **누락:** QA05-02는 앞선 네 후보가 모두 `no_route`인 경우만 검증한다. 완료 지시의 “`no_route`/운영 종료/시간 초과 뒤 뒤 후보 보충” 중 운영 종료와 실제 route 뒤 시간 초과가 **같은 Proxy 활성 UI→engine 조립 경계**에서 뒤 후보를 살리는지 검증하지 않았다. 전체 `npm test`에 포함된 기존 U-1-REC 회귀는 Proxy 비활성 legacy와 Proxy 생성 실패의 fallback 0을 이미 다루지만, 이 누락을 대체하지 않는다.
- **보완 지시(새 작업 ID 금지):** `QA05-02`를 확장하거나 같은 파일에 고정 시나리오 1개만 추가한다. 하나의 Proxy 활성 `buildRecommendationLimitedInput()` 경계에서 (a) 운영 종료 후보는 receipt 요청 0회로 제외되고, (b) 실제 exact route를 받은 후보가 남은 시간/복귀 또는 도착 구간 때문에 시간 초과로 탈락하며, (c) `no_route` 후보가 탈락한 뒤, (d) 뒤의 열려 있는 exact 후보가 대표 코스로 보충되어야 한다. 새 attempt와 adapter call은 각각 8/24 이하, legacy factory·route-only `getRoute()`은 0회여야 한다. 실제 API/GPS/DB/현재시각 호출은 계속 0회다.
- **완료:** 이 한 fixture를 추가한 뒤 QA05 단일 테스트, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check` 결과를 이 작업기록에 추가한다. 그때 QA-05 전체를 수락하고 제한 실기기 추천 품질 검토 계획으로 넘어간다.

### 2026-08-29 — QA-05 보완 완료: 혼합 탈락 뒤 후보 보충 fixture

**상태: 수락.** `QA05-02-R`을 같은 `test/qa05-proxy-runtime-integration.test.ts`에 추가했다. Proxy 활성 `buildRecommendationLimitedInput()` 공개 조립 entry에서 고정 activated route+receipt port 하나를 주입하고, 단일 45분 복귀 시나리오를 실행했다.

- 운영 종료 후보는 사전 운영시간 gate에서 제외되어 receipt 요청이 **0회**였다.
- 다음 후보는 exact route를 받았지만 왕복·체류·여유 합계가 45분을 넘어 `time_budget_exceeded`로 탈락했다.
- 이어진 후보는 `no_route`로 `route_not_verified` 탈락이 기록됐다.
- 뒤의 열린 exact 후보가 대표 1곳으로 보충됐다.
- Proxy factory 1회·legacy factory 0회·route-only `getRoute()` 0회, 새 provider attempt ≤8·adapter call ≤24를 확인했다. 실제 API·GPS·DB·현재 시각 호출은 0회다.

**재검증:** `npx tsx --test test/qa05-proxy-runtime-integration.test.ts` 5/5 통과, `npm run test:typecheck` 통과, `npm run test:ui` 118 통과·1 의도된 skip, `npm test` 101/101 통과, `git diff --check` 통과.

**변경·경계:** 변경 파일은 `test/qa05-proxy-runtime-integration.test.ts`와 이 작업기록뿐이다. 엔진·API adapter·UI·카탈로그·DB·환경 설정·작업조정 보드는 수정하지 않았다. token·JWT·좌표·주소·provider key·실사용자 정보도 사용·기록하지 않았다.

**다음 인계:** QA-05의 고정 runtime 통합 검증은 완료다. 다음 제한 실기기 추천 품질 검토는 별도 계획에서 공개 fixture, 신규/기존 session별 최대 실행 횟수, Kakao/cache/budget 및 legacy transport observer의 기록 범위를 먼저 확정해야 한다. 이 수락만으로 Proxy 기본 활성화나 ODsay 제거를 자동 승인하지 않는다.

### 2026-08-29 — 통합·결정 수락: QA-05 Proxy 활성 2-J runtime 통합

- **수락:** 통합·결정에서 보완 뒤 `test/qa05-proxy-runtime-integration.test.ts`를 재실행해 5/5 통과했다. 48 고정 입력과 8 attempt/24 adapter call 상한, cache/session 재사용, 8번째 뒤 request 중단, 다섯 빈 상태의 비밀 없는 문구를 확인했다.
- **보충 검증:** 운영 종료 후보는 receipt 요청 0회로 먼저 제외되고, exact route 뒤 시간 초과 및 `no_route` 후보가 탈락해도 뒤의 열린 exact 후보가 대표로 보충된다. Proxy factory만 1회 사용하며 legacy factory와 route-only port는 0회였다.
- **회귀:** `npm run test:typecheck`, `npm run test:ui` 122 통과·1 의도된 skip, `npm test` 101/101, `git diff --check`를 통합 재실행해 통과했다. 실제 Kakao·Supabase·Cloudflare·CAPTCHA·GPS·DB 호출은 이 QA에서 0회다.
- **다음 경계:** 실제 제공사 응답의 정확도·cache/budget·legacy transport 관찰은 아직 이 고정 fixture의 범위 밖이다. 새 실제 호출 작업은 공개 fixture와 신규/기존 session별 상한을 먼저 확정한 제한 실기기 검토로만 진행한다.

#### 2026-08-29 — 통합·결정 판정: QA-04 Auth 게이트

- **확정:** `anonymous_auth_failed`는 CAPTCHA token이 Worker→WebView 경계를 통과한 뒤 `supabase.auth.signInAnonymously({ options: { captchaToken } })`가 session을 주지 않은 경우다. 이 QA에서 Route Proxy·Kakao·캐시·legacy provider는 0회이므로 이 결과로 수정하지 않는다.
- **확인 대상:** 대상 Supabase 프로젝트에서 (1) Anonymous sign-in 허용, (2) CAPTCHA protection 활성화, (3) provider가 Turnstile이며 secret이 현 Worker widget과 쌍인 해당 Turnstile secret key, (4) 앱의 Supabase URL·publishable/anon key가 그 프로젝트와 일치함을 **값 미노출로** 점검한다.
- **중단 기준:** 확인 전에 새 신규 session·provider 실행은 하지 않는다. 설정이 확인된 뒤에만 QA-04를 신규 session 1회로 다시 실행한다.

#### 2026-08-29 — 사용자 설정 확인: Supabase Turnstile secret 교정

- Anonymous sign-in과 CAPTCHA protection은 활성화되어 있고, provider도 Cloudflare Turnstile이다.
- `anonymous_auth_failed` 발생 시 Supabase CAPTCHA 설정에는 public Site key가 들어 있었다. 현 Worker에 렌더되는 같은 Turnstile widget의 **Secret key**로 교체했다. 값은 기록하지 않는다.
- 이 설정은 server-side Auth 검증 설정이므로 앱 재빌드는 필요 없다. 기존 CAPTCHA token은 재사용하지 않고 QA-04를 새 anonymous session 1회로만 재개한다.

#### 2026-08-29 — 통합·결정 수락: QA-04 0단계 Route Proxy 제한 smoke

- **수락 근거:** Secret key 교정 뒤 실기기의 신규 anonymous session 1회는 CAPTCHA→anonymous Auth→Proxy 결과 화면까지 도달했고, 기존 session 1회는 CAPTCHA·Auth 0회로 결과가 동작했다. 신규/ 기존 흐름의 추가 재시도는 없었다.
- **실제 원인 연쇄:** (1) Cloudflare Worker가 초기에 repository CAPTCHA artifact가 아닌 기본 `Hello World!`를 반환해 widget을 렌더할 수 없었고, (2) 앱의 Worker URL에 `.workers.dev`가 중복돼 WKWebView network 실패가 났으며, (3) 최종적으로 Supabase CAPTCHA에 public Site key를 넣어 anonymous Auth가 token을 검증하지 못했다. 모두 교정됐다.
- **관찰성·호환 보완:** 일반 안전 오류 문구가 Auth와 Proxy를 구분하지 못해 `RouteProxyUnavailableError.reason`을 internal build에서만 표시했다. WebView의 `about:` transport whitelist도 Turnstile 보조 문서를 위해 보완했으나, 최종 navigation/message 신뢰 범위는 exact Worker·Cloudflare/about 예외로 제한했다.
- **판정 외:** Kakao provider의 개별 HTTP attempt, cache/budget 상태, legacy TMAP·ODsay transport 0회는 독립 observer로 측정하지 않았다. 이 smoke는 인증·Proxy 연결 수락일 뿐, 전체 추천 품질의 수락은 아니다.

---

## 2026-08-29 — 통합·결정 지시 QA-05: Proxy 활성 2-J runtime 통합 검증

### 목적과 경계

API-4-C·API-4-D·2-J·U-1-REC-01이 연결된 현재 상태에서, Proxy 활성 추천이 실제로 receipt 예산 경로를 쓰는지 검증한다. 이 작업은 **고정 fixture만** 사용하며 실제 Kakao·Supabase·Cloudflare·CAPTCHA·GPS·DB 호출은 0회다. 실제 provider 정확도나 iPhone 수동 smoke는 이 작업의 완료 조건이 아니다.

QA 세션은 `test/`와 이 작업기록만 수정한다. `src/engine/`, `src/services/`, `src/ui/`, 데이터, DB, 설정, 작업조정 보드는 수정하지 않는다.

### 필수 시나리오

1. Proxy 활성 route factory가 `CourseV1RouteAdapter & CourseV1RouteReceiptAdapter`를 반환하는 고정 fake Edge/adapter를 `runRecommendationSession` 또는 UI→engine 공개 조립 entry로 주입한다. receipt port 미주입 Proxy는 legacy·engine route 호출 0회와 안전 오류여야 한다.
2. 사상·서면·부산역·남포·광안리·해운대 × 45/78/120/180분 × 복귀/도착지의 48 입력을 시간·운영상태·route receipt까지 고정한다. 각 결과는 attempt ≤8, adapter call ≤24, provider fallback 0, navigation/session에 민감정보 0을 확인한다.
3. 앞선 네 후보의 `no_route`/운영 종료/시간 초과 뒤 뒤 후보가 보충되는 1개 이상 시나리오를 UI→engine 조립 경계에서 검증한다. cache 또는 세션 동일 구간은 attempt 0이며, 8번째 attempt 뒤 Edge/adapter 요청이 더 시작되지 않아야 한다.
4. `no_eligible_candidates`, `no_open_candidates`, `time_budget_exceeded`, `route_not_verified`, `route_verification_unavailable`의 다섯 빈 결과를 Results UI contract에서 확인한다. 문구에 Kakao/provider, quota, HTTP, URL, 좌표, token/JWT, cache key가 없는지 검사한다.
5. Proxy 비활성 local 경로가 기존 legacy fixture를 보존하는 회귀와, Proxy 활성 실패가 legacy fallback 없이 안전 오류로 끝나는 회귀를 함께 실행한다.

### 완료 기준

- 고정 runtime fixture에서 48 시나리오와 보충·8회 경계·다섯 빈 상태가 모두 통과한다.
- `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다.
- 완료 기록에는 변경 테스트 파일, API/UI/엔진을 바꾸지 않은 경계, 시나리오별 attempt/call 최대값과 이유 표시 결과, 실제 외부 호출 0회를 남긴다.
- 이 QA가 수락된 뒤에만 실기기에서 신규 또는 기존 session을 **각각 최대 한 번** 사용하는 제한 수동 추천 품질 검토를 별도 계획한다. 이번 작업에서 실기기·실제 호출을 반복하지 않는다.

---

## 2026-08-30 — 통합·결정 지시 RD-01~03: 2-L 가까운 대안 실기기 재검증

### 목적

2-L이 기존 정적 `근접 → 넓은 한 곳 → 2곳 → 3곳` 검증 순서를 `N1 가까운 단일 → N2 가까운 2곳 → W 넓은 단일 → T 3곳`으로 바꾼 뒤, 이전 실기기 관찰에서 너무 적었던 서면·사상/서면 결과가 실제로 어떻게 달라졌는지 확인한다. 이 작업은 추천 수를 목표치에 맞춰 합격시키는 작업이 아니라, **가까운 대안 부족의 원인을 실제 결과로 분리**하는 제한 관찰이다.

### 담당·소유 경계

- **담당:** QA·출시가 시나리오·기록을 관리하고, 사용자가 실제 iPhone에서 실행·체감 코멘트를 남긴다.
- **수정 가능:** `docs/05_release/실기기_추천검증.md`의 아래 “2-L 재검증 코멘트” 영역과 이 작업기록의 완료 기록만 수정한다.
- **수정 금지:** `src/engine/`, `src/ui/`, `src/services/`, API/Cloudflare/Supabase 설정, 카탈로그·DB, 제품 정책 문서, 작업조정 보드. 관찰 중 문제를 발견해도 즉시 코드·설정·캐시를 바꾸지 않는다.

### 실행 전 확인

1. 2-L이 포함된 최신 internal build 또는 최신 개발 번들인지 확인한다. 이전 build 결과는 기준선으로만 쓰며 재검증 결과로 기록하지 않는다.
2. 가능하면 이미 생성된 anonymous 또는 로그인 session을 그대로 사용한다. 로그인 여부는 추천 품질 판정 기준이 아니다. session이 없어 CAPTCHA가 표시되면 **한 번만** 완료를 시도하고, token·JWT·key·raw URL은 기록하지 않는다.
3. 개발 테스트 시각은 `15:00`, 도착 전 남길 시간은 `10분`으로 고정한다. GPS가 아닌 검색 결과에서 아래 장소를 명시 선택한다.
4. 각 시나리오에서 “이 시간에 할 일 찾기”는 정확히 **한 번** 누른다. 새 추천, 뒤로 가서 재실행, 캐시 삭제, 앱 재설치, 설정 변경은 하지 않는다.

### 실행 순서와 고정 입력

| 순서 | 시나리오 | 출발 / 도착 | 테스트 시각 / 도착 | 이번 확인점 |
| --- | --- | --- | --- | --- |
| 1 | RD-01 | `서면역 부산1호선` / 출발지 복귀 | 15:00 / 16:30 | 80분 유효 시간에서 가까운 1곳 대안이 이전의 롯데백화점 단일 결과보다 늘었는지 |
| 2 | RD-02 | `서면역 부산1호선` / 출발지 복귀 | 15:00 / 17:00 | 110분 유효 시간에서 가까운 1·2곳 대안이 먼 한 곳보다 먼저, 이해 가능한 목록으로 보이는지 |
| 3 | RD-03 | `사상역 2호선` / `서면역 2호선` | 15:00 / 17:00 | 이동 축 위의 서로 다른 장소가 실제 도보/대중교통 시간과 함께 보이는지 |

각 실행 후 앱을 종료하거나 session을 바꾸지 말고 다음 시나리오로 이동한다. 단, 아래 중단 조건이면 즉시 멈춘다.

- `route_proxy_transport_failed`, 앱 종료/멈춤, 출발·도착이 다른 장소로 적용됨, 도착 시각을 넘는 코스
- CAPTCHA/Auth/Proxy 오류가 같은 실행에서 반복되어 추천 화면에 도달하지 못함

`route_proxy_limited`, `route_proxy_rejected`, `route_proxy_store_unavailable` 등 안전 enum은 해당 시나리오에 기록하되, 같은 입력 재시도는 금지한다. 다음 시나리오 실행 여부는 enum과 화면 상태를 기록한 뒤 사용자 판단에 맡긴다.

### 시나리오별 기록 형식

`실기기_추천검증.md`의 해당 시나리오에 기존 사용자 코멘트를 지우지 않고, 아래 다섯 항목을 **“2-L 재검증 코멘트”**로 이어 쓴다.

1. 판정: `개선 관찰 / 변화 없음 / 정직한 결과 없음 / 검증 불가 / 결함`
2. 대표와 대안의 총 코스 수, 각 코스의 장소명·장소 수
3. 각 코스의 이동수단·총 소요·남는 시간 중 납득되지 않는 값
4. 가까운 장소가 보였는지, 먼 한 곳 또는 3곳이 가까운 대안을 밀어낸 것으로 보이는지
5. diagnostics enum 하나(표시된 경우만)와 검색·경로 설정의 어려움

“개선 관찰”은 단순 코스 수 증가가 아니라, 이전보다 가까운 서로 다른 선택지가 늘었고 시간표가 납득 가능한 경우다. 하나만 실제 검증됐다면 그것을 실패로 꾸미지 않고 “변화 없음” 또는 “정직한 결과 없음”으로 기록한다. 화면에 없는 API attempt·cache hit·provider 오류 원인을 추정해 적지 않는다.

### 완료·인계 기준

- RD-01~03은 각각 최대 1회 실행하고, 위 기록 형식이 모두 채워져야 한다. 외부 API 호출 수는 이 작업에서 최대 세 추천 세션이며 재시도는 0회다.
- QA는 이전 기준선과 새 결과를 비교해 `코스 수`, `가까운 장소 여부`, `시간표 모순`, `diagnostics`만 요약한다. “카탈로그 부족”, “8회 상한 부족”, “Kakao 경로 품질 문제” 중 하나로 확정하지 않는다.
- 통합·결정은 이 기록을 읽고 다음 중 하나만 결정한다: (a) 2-L 효과가 실기기에서도 확인되어 다음 UX 품질 단계로 진행, (b) 고정 receipt/안전 diagnostics를 추가해 원인 분리, (c) 8회 상한 변경 여부를 사용자 결정으로 상정. 이 단계만으로 엔진/API 정책을 재수정하지 않는다.

### 2026-08-30 — RD-01~03 실기기 재검증 완료

**상태: 완료·원인 판정 보류.** iPhone (iOS 26.6), 최신 internal build에서 기존 session을 유지한 채 RD-01~03을 수행했다. 고정 입력·결과 상세는 [실기기 추천 검증](../real-device-recommendation.md)의 각 2-L 재검증 코멘트에 기록했다. token·JWT·key·raw URL·좌표·실사용 GPS는 기록하지 않았고, 화면에 표시되지 않은 provider attempt/cache·budget/legacy transport은 추정하지 않았다.

| 시나리오 | 고정 입력 준수 | 관찰 결과 | 판정 / diagnostics |
|---|---|---|---|
| RD-01 | 교정 실행에서 15:00→16:30, 서면역 부산1호선 복귀, 여유 10분 | 대표 롯데백화점 부산본점 58분·남는 시간 32분, 가까운 1곳 대안 포셋 전포 64분·26분 및 아비베르컴퍼니 65분·25분 | 개선 관찰 / 미표시 |
| RD-02 | 15:00→17:00, 서면역 부산1호선 복귀, 여유 10분 | 대표 롯데백화점 부산본점 58분·62분, 가까운 1곳 대안 포셋 전포 64분·56분 및 아비베르컴퍼니 65분·55분 | 개선 관찰(2곳 코스는 미관찰) / 미표시 |
| RD-03 | 15:00→17:00, 사상역 2호선→서면역 2호선, 여유 10분 | 대표 부산 수학문화관: 대중교통 18분·활동 30분·대중교통 7분, 총 65분·55분. 대안 사상문화원 95분·25분 | 변화 없음(이전과 같은 2개 코스) / 미표시 |

- **입력 이탈 이력:** 최초 RD-01은 16:50 도착으로 실행되어 검증 불가로 보존했다. 사용자 승인으로 16:30 고정 입력의 교정 실행 1회를 추가했다. 따라서 실제 추천 실행은 RD-01 교정 전 관찰 1회·교정 1회·RD-02 1회·RD-03 1회, 총 4회이며 그 뒤 앱 process를 종료했다. 교정 실행 외 재시도·캐시 삭제·앱 재설치·코드/API 설정 변경은 0회다.
- **비교 요약:** 서면 두 시나리오에서는 이전 롯데백화점 단일 결과와 달리 가까운 서로 다른 1곳 대안 두 개가 함께 표시됐다. RD-02의 2곳 코스와 RD-03의 가까움/순위 증가는 관찰만으로 입증되지 않았으므로 과장하지 않았다. 화면에 시간표 모순·앱 멈춤·`route_proxy_transport_failed`는 나타나지 않았다.
- **변경 파일 / 유지 경계 / 다음 결정:** `docs/05_release/실기기_추천검증.md`와 이 작업기록만 갱신했다. 엔진·UI·services·API/Cloudflare/Supabase 설정·카탈로그·DB·제품 정책·작업조정 보드는 수정하지 않았다. 통합·결정은 이 관찰을 근거로 (a) 다음 UX 품질 단계, (b) 고정 receipt/진단 원인 분리, (c) 8회 상한 변경 여부 중 하나를 별도로 결정해야 하며, 이 QA 기록만으로 엔진/API 정책을 바꾸지 않는다.

### 2026-08-30 — RD-DIAG-01/02 실행 결과: diagnostics build 미노출

**상태: 검증 불가·RD-DIAG-02 미실행.** RD-DIAG-01의 고정 입력(서면역 부산1호선 복귀, 15:00→17:00, 여유 10분)을 기존 session에서 정확히 1회 실행했다. 결과 화면은 대표 롯데백화점 부산본점 58분·남는 시간 62분과 대안 포셋 전포 64분·56분, 아비베르컴퍼니 65분·55분을 표시했다. 그러나 대안 목록 아래 끝까지 확인해도 internal 전용 `개발용 추천 진단` panel이 렌더링되지 않았다.

- panel이 없어 엔진/화면 코스 수, 후보·tier, 8/24, 재사용, 탈락 집계를 관찰·기록할 수 없다. 이 결과만으로 flag 누락, Metro bundle 갱신 누락, build 선택 오류 중 어느 하나를 확정하지 않는다.
- panel 미노출은 RD-DIAG-01의 완료 조건을 충족하지 못하므로 RD-DIAG-02는 실행하지 않았다. 추가 추천·CAPTCHA 재시도·캐시 삭제·앱 재설치·코드/API 설정 변경도 0회다.
- iPhone의 TimeFit 앱 process는 즉시 종료했다. token·JWT·key·URL·좌표·실사용 GPS·화면 밖 API/route/cache 정보는 기록하지 않았다.
- 다음 결정: UIUX/배포 담당은 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true`가 포함된 최신 internal build 또는 최신 개발 bundle임을 비밀 없는 방법으로 확인해야 한다. 그 build가 수락된 뒤에만 RD-DIAG-01과 RD-DIAG-02의 신규 제한 실행 범위(이미 소비된 RD-DIAG-01 1회 처리 포함)를 통합·결정이 다시 정한다.

### 2026-08-30 — RD-DIAG-01 교정 실행: 서면 복귀 diagnostics 관찰

**상태: 관찰 완료.** 새 internal diagnostics build에서 사용자 승인 아래 RD-DIAG-01을 교정 실행 1회 수행했다. 고정 입력은 서면역 부산1호선 복귀, 15:00→17:00, 도착 전 여유 10분이며 `개발용 추천 진단` panel이 표시됐다.

| 항목 | 화면 관찰값 |
|---|---:|
| 엔진 코스 / 화면 코스 | 3 / 3 |
| 원천 / 조건 통과 / 공간 후보 / 사전 제외 | 190 / 155 / 18 / 35 |
| 새 경로 확인 / adapter 호출 / 재사용 | 8 / 9 / 0 |
| N1 (후보 / 시도 / 검증 / 새 경로 확인) | 3 / 3 / 3 / 6 |
| N2 (후보 / 시도 / 검증 / 새 경로 확인) | 2 / 0 / 0 / 0 |
| W (후보 / 시도 / 검증 / 새 경로 확인) | 1 / 0 / 0 / 0; `N1 검증 대기` 1 |
| T (후보 / 시도 / 검증 / 새 경로 확인) | 816 / 2 / 0 / 2; `새 경로 확인 상한` 1, `경로 확인 불가` 2 |
| 결과 탈락 | `경로 확인 불가` 2 |

대표·대안의 화면 코스 수가 엔진 코스 수와 일치하며, panel 값은 8/24 상한 안에 있다. 이 숫자는 화면에 표시된 집계일 뿐이며 provider/HTTP/URL/cache key·token/JWT·좌표 또는 상한/카탈로그/경로 품질의 원인은 추정하지 않는다. 다음은 기존 session을 유지한 RD-DIAG-02 고정 입력 1회다.

### 2026-08-30 — RD-DIAG-02: 사상→서면 diagnostics 관찰 및 비교

**상태: 관찰 완료.** 같은 internal diagnostics build와 existing session에서 RD-DIAG-02(사상역 2호선→서면역 2호선, 15:00→17:00, 도착 전 여유 10분)를 정확히 1회 실행했다. `개발용 추천 진단` panel 관찰값은 다음과 같다.

| 항목 | 화면 관찰값 |
|---|---:|
| 엔진 코스 / 화면 코스 | 2 / 2 |
| 원천 / 조건 통과 / 공간 후보 / 사전 제외 | 190 / 155 / 18 / 35 |
| 새 경로 확인 / adapter 호출 / 재사용 | 8 / 4 / 0 |
| N1 (후보 / 시도 / 검증 / 새 경로 확인) | 3 / 2 / 2 / 8; `새 경로 확인 상한` 1 |
| N2 (후보 / 시도 / 검증 / 새 경로 확인) | 3 / 0 / 0 / 0; `새 경로 확인 상한` 1 |
| W (후보 / 시도 / 검증 / 새 경로 확인) | 1 / 0 / 0 / 0; `N1 검증 대기` 1 |
| T (후보 / 시도 / 검증 / 새 경로 확인) | 816 / 0 / 0 / 0; `새 경로 확인 상한` 1 |

#### 두 diagnostics 실행의 비교

- 두 시나리오 모두 원천 190·조건 통과 155·공간 18·사전 제외 35로 표시됐다. 화면이 후보 공급 자체를 0으로 보인 경우는 아니다.
- 서면 복귀(RD-DIAG-01)는 N1 3개가 3개 모두 검증돼 엔진/화면 코스 3개를 만들었다. N2/W는 N1 검증 대기였고, T는 2회 시도 후 새 경로 확인 상한·경로 확인 불가가 표시됐다.
- 사상→서면(RD-DIAG-02)는 N1에서 2개만 검증된 상태로 새 경로 확인 8회 상한이 표시돼 N2/W/T는 시도 0회였다. 따라서 **이 실행에서 화면의 2개 코스는 이후 tier를 시도하기 전에 새 경로 확인 예산이 소진된 상태와 함께 관찰됐다.**
- 이는 화면에 표시된 실행 경로의 설명일 뿐, 8회 상한을 변경해야 한다거나 Kakao·카탈로그·운영시간 중 어느 것이 근본 원인이라는 판정은 아니다. provider/HTTP/URL/cache key·token/JWT·좌표 및 화면 밖 값은 기록·추정하지 않았다.

**종료·인계:** RD-DIAG-01 교정 1회와 RD-DIAG-02 1회 후 iPhone의 앱 process를 종료했다. RD-DIAG-01의 처음 panel 미노출 실행은 이력으로 보존하며, 새 diagnostics build에서의 교정 실행 결과로 대체하지 않는다. 엔진·UI·API/Cloudflare/Supabase 설정·카탈로그·DB·제품 정책·작업조정 보드는 수정하지 않았다. 통합·결정은 이 비교를 읽고 고정 receipt/안전 diagnostics 추가, 8회 상한 변경의 사용자 결정 상정, 또는 현재 정책 유지 중 하나를 별도로 결정해야 한다.

### 2026-08-30 — 통합·결정 수락: RD-01~03 2-L 실기기 재검증

**상태: 수락·추천량 원인 판정 보류.** RD-01의 최초 입력 이탈은 2-L 판정에서 제외하고, 사용자 승인 아래 수행한 16:30 교정 실행을 유효 관찰로 수락한다. 이로 인해 총 추천 세션은 계획한 3회가 아니라 4회였지만, 교정 뒤 추가 재시도·캐시 삭제·설정 변경이 없고 네 실행 모두 결과 화면에 정상 도달했다.

- **2-L 효과:** 서면 왕복 RD-01과 RD-02는 기존 롯데백화점 단일(또는 먼 단일 포함) 결과에서, 롯데백화점·포셋 전포·아비베르컴퍼니의 가까운 서로 다른 1곳 코스 3개로 바뀌었다. 시간표 모순, `route_proxy_transport_failed`, 앱 멈춤, 먼 한 곳/3곳이 가까운 대안을 먼저 밀어낸 관찰은 없었다. 이는 2-L의 가까운 단일 우선 목적을 실기기에서 뒷받침한다.
- **남은 한계:** RD-02는 110분 유효 시간에도 2곳 코스가 없고, RD-03은 기존과 같은 2개 1곳 코스만 보였다. 그러나 화면에는 tier별 실제 receipt 탈락·attempt·cache 정보가 없으므로, 이를 8회 상한·카탈로그·운영시간·Kakao route 중 어느 하나의 문제로 단정할 수 없다.
- **제품 체감 판정:** 이전의 “한 코스만 나온다” 문제는 서면에서 개선됐지만, 사용자가 기대하는 여러 선택지 관점에서는 2~3개가 여전히 얇게 느껴질 수 있다. 이는 결함이 아니라 다음 추천 품질 결정 대상이다. 남는 시간을 억지로 채우거나 2/3곳을 강제하는 것은 현행 정책에 반한다.

다음 작업은 아직 생성하지 않는다. 통합·결정은 사용자와 함께 (a) 현재 1곳 중심의 안정된 결과를 유지하고 다른 UX 품질을 먼저 진행할지, 또는 (b) internal build에 안전한 tier/탈락 집계 관찰을 추가해 실제 대안 부족 원인을 분리할지를 결정해야 한다. 8→12/16 상한 변경은 이 기록만으로 진행하지 않는다.

### 후속 게이트 — U-1-REC-DIAG-01 수락 뒤 RD-DIAG-01/02

U-1-REC-DIAG-01은 수락됐다. 기존 anonymous/login session을 유지한 internal diagnostics build에서 아래 두 시나리오만 각 1회 실행한다. CAPTCHA가 필요하면 1회만 완료하며, 새 추천/재시도/캐시 삭제/설정 변경은 금지한다. 이 build에만 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true`를 포함하고 production build에는 포함하지 않는다.

| 시나리오 | 입력 | 기록할 값 |
| --- | --- | --- |
| RD-DIAG-01 | 서면역 부산1호선 복귀, 15:00→17:00, 여유 10분 | 엔진 코스/화면 코스, 원천·조건 통과·공간 후보, N1/N2/W/T 후보·시도·검증·중단, 새 경로 확인·adapter 호출·재사용·탈락 집계 |
| RD-DIAG-02 | 사상역 2호선→서면역 2호선, 15:00→17:00, 여유 10분 | 위와 동일 |

diagnostics panel에 없는 값, provider/HTTP/URL/좌표/cache key/token/JWT, 화면에 표시되지 않은 실제 원인은 기록하거나 추정하지 않는다. `route_proxy_transport_failed`, 앱 멈춤, 시간표 모순이면 즉시 중단한다. 두 결과를 비교한 뒤에만 통합·결정이 다음 조치를 하나로 정한다.

### 2026-08-30 — 통합·결정 수락: RD-DIAG-01/02 추천량 원인 관찰

**상태: 수락·다음 엔진 정책 결정 대기.** diagnostics가 없는 최초 RD-DIAG-01은 원인 판정에 쓰지 않고 이력으로 보존한다. 새 internal diagnostics build의 RD-DIAG-01 교정 1회와 RD-DIAG-02 1회는 고정 입력·한 번 실행·안전 기록 조건을 충족했으며, 화면 멈춤·시간표 모순·Proxy 오류는 없었다.

- **화면 제한 아님:** 서면은 엔진/화면 코스가 3/3, 사상→서면은 2/2였다. 현재 대안 카드가 엔진 결과를 숨기는 현상은 이 두 입력에서 관찰되지 않았다.
- **후보 공급 0 아님:** 두 입력 모두 원천 190·조건 통과 155·공간 후보 18·사전 제외 35였다. 따라서 이 관찰만으로 카탈로그 부족이나 운영시간 필터 과잉을 원인으로 확정할 수 없다.
- **실질 제약 관찰:** 사상→서면은 새 경로 확인 8회가 모두 소진됐고 N1 후보 3개 중 2개만 검증됐다. N2/W/T는 시작하지 못했으며 N1/N2/T에 새 경로 확인 상한이 기록됐다. `CourseV1RouteReceipt` 하나는 최대 두 provider attempt를 쓸 수 있으므로, adapter 호출 4회가 새 경로 확인 8회가 될 수 있다. 즉, **현재 8회 상한은 이 입력에서 후속 후보를 검증하지 못하게 한 직접 관찰 조건**이다.
- **정직한 한계:** 8회 상한을 12 또는 16으로 올리면 반드시 추가 코스가 검증된다고 이 기록만으로 보장할 수 없다. 추가 구간의 실제 route/시간/운영 결과는 아직 알 수 없고, 새 provider 호출량도 함께 늘어난다. 카탈로그 확대·UI 목록 확대는 이 결론에서 보류한다.
- **표현 보완 후보:** W의 `N1 검증 대기`는 실제로 “N1에서 하나 이상 검증되어 120분 이하에서는 넓은 한 곳을 의도적으로 열지 않음”을 뜻한다. 대기 상태로 오해될 수 있으므로, 다음 internal diagnostics 보완에서만 더 정확한 고정 표현으로 교체할 수 있다. 추천 정책·사용자 UI에는 영향이 없다.

다음은 추천 엔진이 고정 receipt fixture로 8/12/16 상한과 N1·N2 배분을 비교하는 정책 결정 작업이다. 실제 API를 추가 호출하지 않으며, 통합·결정과 사용자가 목표 호출량·다양성 우선순위를 확정한 뒤에만 엔진 값을 바꾼다.

---

## 2026-08-30 — 통합·결정 지시 RD-B12: internal B12 실기기 비교 게이트

### 선행 조건과 범위

`2-N`과 `U-1-REC-02`가 모두 수락된 **새 internal build**만 대상이다. 이 작업은 B12가 실제 경로 조건에서 A8보다 무조건 많은 코스를 만든다고 증명하는 실험이 아니라, B12가 안전 계약을 깨지 않고 사상 입력에서 N2 검증 기회를 실제로 여는지 관찰하는 제한된 두 번의 실행이다.

- 수정 소유: `docs/05_release/실기기_추천검증.md`, QA fixture/기록, 이 작업기록만.
- 수정 금지: 엔진 정책·상한, UI/API/Cloudflare/Supabase 설정, 캐시 삭제, 카탈로그, 사용자 계정 데이터.
- QA는 실행 전 두 시나리오 표와 기록 칸만 준비한다. 실제 iPhone 실행은 사용자 승인 후 사용자가 수행한다.

### 사용자 실행 — 정확히 두 번

기존 A8 기준을 다시 실행하지 않는다. B12 internal build에서 아래 입력마다 `이 시간에 할 일 찾기`를 정확히 한 번만 누른다.

| ID | 고정 입력 | 기존 A8 관찰 기준 | 기록할 값 |
| --- | --- | --- | --- |
| RD-B12-01 | 서면역 부산1호선, 복귀, 개발 테스트 15:00→17:00, 여유 10분 | 엔진/화면 3/3, N1 3개 검증 | diagnostics policy, 엔진/화면 코스, N1/N2/W/T 후보·시도·검증·중단, 새 경로 확인·adapter·재사용, 결과 안전성 |
| RD-B12-02 | 사상역 2호선→서면역 2호선, 개발 테스트 15:00→17:00, 여유 10분 | 엔진/화면 2/2, N1 2개 검증 뒤 8회 소진, N2 0 시도 | 위와 동일, 특히 N2 시도 여부와 1·2곳 결과 |

CAPTCHA가 필요하면 정상 흐름에서 한 번만 완료한다. 같은 입력 재시도·새 추천·캐시 삭제·앱 설정 변경은 금지한다. `route_proxy_transport_failed`, 시간표 모순, 앱 멈춤, 잘못된 출발/도착, 중복 장소가 생기면 즉시 멈추고 해당 ID만 기록한다.

### 판정 경계

1. B12 build임은 diagnostics의 고정 정책 label로만 확인한다. label이 A8이거나 표시되지 않으면 비교를 시작하지 않고 `구성 검증 실패`로 끝낸다.
2. RD-B12-02에서 N2가 시도되거나 1·2곳의 독립 코스가 안전하게 추가되면 B12의 실제 기회 확대 관찰로 기록한다. 결과 수가 같아도 time/no-route/운영시간 등 panel의 구조화 중단 사유가 납득 가능하면 실패로 단정하지 않는다.
3. cache/session reuse가 있으면 새 provider attempt 수는 A8 기록과 직접 수치 비교하지 않는다. 재사용 수와 tier 결과를 함께 남기고, cache를 지워 인위적으로 맞추지 않는다.
4. 두 실행만으로 production 전환을 자동 승인하지 않는다. 안전 결함 0, B12 label 확인, 두 결과의 tier/attempt 관찰을 통합·결정이 읽은 뒤 A8 유지·B12 확장·추가 원인 분리 중 하나를 결정한다.

### 완료 인계

QA는 `실기기_추천검증.md`에 입력·policy label·판정·화면상 수치·오류 유무만 기록한다. provider 원문, URL, 좌표, token/JWT, cache key, 사용자 식별자, 비밀값을 기록하지 않는다. 코드 자동 테스트는 `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`가 이미 U-1-REC-02에서 통과한 결과를 인용하되, 실기기 실행 자체는 자동 테스트로 대체하지 않는다.
