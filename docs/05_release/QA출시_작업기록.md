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

---

## 2026-08-26 — 통합·결정 지시 QA-03: 생활권별 추천 공급과 다양성 측정

**선행 조건:** QA-02 완료. **목표:** 장소 부족, 후보 선별 부족, 실제 경로 실패를 수치로 구별한다.

1. QA-02 시나리오마다 대표 존재율, 0개 상태 사유, 검증 코스 수, 비중첩 대안 수, 1/2/3곳 분포, `wideSingleCandidateId`의 실제 검증/통과 여부, cache hit/miss 구간 수를 측정한다.
2. 자동 측정은 fixture·현재 엔진 진단만 쓴다. 실제 API는 생활권별 대표 시나리오의 제한 수동 확인으로만 분리하고, 제공사·호출 수·시각을 기록한다.
3. 결과를 생활권·시간 예산별 표와 0개율/대안 수 요약으로 남긴다. 장소를 추가하거나 엔진 기준을 수정해 수치를 좋게 만들지 않는다.
4. 결과에는 다음 두 결정을 위한 선택지를 제시한다: (a) 넓은 한 곳 탐색 구간의 의미 있는 범위, (b) 서버 Route Proxy의 제공사별 일일 새 구간 요청 예산. 통합·결정과 사용자 확정 전에는 구현값으로 승격하지 않는다.

**완료 기준:** 측정 원본·집계·재현 명령·호출 수가 남고, 위 두 선택에 필요한 근거가 준비된다.

---

## 2026-08-26 — 통합·결정 지시 QA-04: 실기기 추천 체감 게이트

**선행 조건:** U-1-F, 2-J 완료와 iOS 시뮬레이터 또는 실기기 사용 가능. 1/2/3곳·넓은 한 곳·대안 목록·긴 장소명·남는 시간 rail·VoiceOver·사진 없음·카카오맵 전환을 고정 fixture로 실행한다. 시나리오 ID, 기기, 입력, 캡처/로그, 성공/실패를 기록하며 외부 API 반복 호출은 금지한다.
