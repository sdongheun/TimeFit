# 2-P — 대표 코스·장소 탐색 이중 결과 계약

## 목적과 선행 조건

대표 코스의 실제 경로 정확성을 유지하면서, 후보가 많은 지역에서도 여러 장소를 발견할 수 있게 결과를 `대표 코스 1개 + 고유 장소 탐색 목록`으로 분리한다. **DATA-AREA-01의 발견 자격 계약이 수락되기 전에는 구현을 시작하지 않는다.** 이 작업은 `src/engine/`과 순수 엔진 테스트만 수정한다. UI, 카탈로그 원본, Route Proxy/어댑터, 보드는 수정하지 않는다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md` 1.4~1.5.1, `docs/테스트.md` `REC-25~28`, `DATA-25`
3. `docs/work/data-curation/area-discovery-candidates.md`의 수락된 공개 필드와 이 문서만

## 고정 결과 계약

1. 기존 `representativeCourse` 계산은 정확 경로를 거친 상단 1개이며, 1~3곳·체류·운영시간/접근시간·도착 여유·A8/B12 provider 상한을 바꾸지 않는다.
2. 새 `exploration` 결과는 서로 다른 **장소** 목록이다. 코스 순열이나 `A→B`, `A→C` 같은 조합 카드를 만들지 않는다. 동일 place ID·동일 `siteGroupId`는 한 세션에서 한 번만 나온다.
3. 탐색 목록의 생성, 정렬, 페이지/커서 소비는 순수·로컬이어야 하며 route port/provider를 **0회** 호출한다. 목록은 제품상 3개 상한이 없고, UI의 한 화면 묶음 크기는 엔진의 총 후보 제한이 아니다.
4. 탐색 후보는 `representative`와 `area_access`만 받을 수 있다. `conditional`은 결과에 섞지 않는다. `area_access`는 `accessWindow`/근거 상태를 보존하고, `facility`가 섞이면 fail-closed로 제외한다.
5. 사용자가 탐색 장소 하나를 선택했을 때만 `출발 → 선택 장소 → 도착/복귀` 1곳 코스를 현재 route port로 실경로 검증한다. 성공 반환은 기존 시간 여정 스냅샷 형식과 호환되어야 한다. 실패 반환은 `route_not_verified` / `time_budget_exceeded` / `access_window_unavailable` 등 근거 코드를 보존하며, 기존 primary·exploration 배열을 변경하지 않는다.
6. 선택 검증은 다른 탐색 장소를 자동 추가하거나 대표 코스를 대체하지 않는다. 사용자가 새 세션을 시작하지 않는 한 재시도·다음 후보 자동 조회도 하지 않는다.

## 수행 순서

1. DATA-AREA-01이 제공하는 최소 타입을 읽고, 엔진 입력 타입·출력 snapshot 타입을 추가한다. 타입 이름은 구현 세부보다 역할(`DiscoveryEligibility`, `ExplorationPlace`, `SelectedExplorationResult` 등)을 드러내며 UI가 근사 시간을 계산할 여지를 주지 않는다.
2. 기존 V1의 18개 사전선정·N1/N2/W/T 정확 경로 큐는 대표 계산 경로로 격리한다. `exploration`을 추가했다는 이유로 18/8/12/24 상한·큐 순서·대표 선택 우선순위를 변경하지 않는다.
3. 순수 탐색 후보 생성기를 구현한다. 공간·기본 시간예산·발견 자격의 1차 게이트, 안정적인 순위, place/siteGroup 중복 제거, 페이지 소비를 처리한다. 이 단계에서 실제 이동 시간·도착 가능 시간을 계산하거나 반환하지 않는다.
4. 명시 선택 전용 1곳 검증 엔트리를 구현한다. 기존 route receipt/cache port를 재사용하며, 동일 좌표쌍·수단의 cache hit는 새 provider attempt가 아님을 보존한다. 선택 1회가 만드는 adapter/provider 호출 상한을 결과 receipt에 명시한다. 현재 1곳 왕복의 두 구간·수단 조합을 넘어 무제한 탐색하지 않는다.
5. typed failure를 UI가 설명할 수 있게 반환한다. 단, 엔진이 한국어 문구나 화면 상태를 만들지 않는다.

## 필수 고정 fixture

- 탐색 후보 20개 이상의 고정 입력에서 첫 묶음·다음 묶음 전체를 소비해도 route port 호출 0회, 장소/siteGroup 중복 0, 안정 순서.
- `representative` 1개 + `area_access` 시장/해변 + `conditional` 거리 + `facility` 무시간 후보: 앞의 두 유형만 탐색에 남고, 권역 접근 창/근거 상태가 보존되며 뒤의 둘은 제외.
- 상단 대표가 성공해도 탐색 목록은 대표 장소를 중복하지 않고, 대표가 `no_verified_course_within_limit`이어도 탐색 목록은 반환 가능.
- 탐색 장소 선택 성공: 1곳 스냅샷이 실제 legs·선택 체류·여유를 가지며 기존 primary가 변하지 않음.
- 선택 실패 3종(route/time/access): primary·목록 불변, 선택 장소 자동 재시도 0, reason code 정확.
- 목록 스크롤/더 보기와 선택 전후 cache hit/miss에서 A8/B12/adapter 상한이 기존 대표 계산과 합쳐져 깨지지 않음. 현행 전체 세션 상한과 명시 선택 행동의 상한은 receipt로 분리해 검사한다.

## 금지

- 탐색 목록을 “검증 대안 코스”로 이름만 바꾸거나, 표시 수를 늘리려고 모든 장소에 실경로를 호출하는 방식.
- 1곳 선택에 임의 2·3곳을 자동 조립하거나, 사용자의 선택으로 대표 코스를 바꾸는 방식.
- `conditional` 및 근거 없는 시장·거리·시설을 탐색 자동 후보로 넣는 방식.
- UI가 쓸 근사 이동시간, 사용자 문구, 카카오 링크를 엔진에서 생성하는 방식.

## 완료 기준과 인계

관련 순수 엔진 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 기존 2-O 체류·REC-26 A8/B12 fixture가 깨지지 않아야 한다. 인계에는 (1) 변경 파일·목적, (2) 불변인 대표 큐/상한·어댑터 경계, (3) 테스트 결과, (4) UI가 연결할 공개 타입·선택 상한·남은 위험을 기록한다. 보드는 수정하지 않는다.

---

## 2026-08-31 — 2-P 완료 인계

### 변경 파일·목적

- `src/engine/courseV1.ts`
  - `CourseV1DiscoveryCandidate`, `ExplorationPlace`, `CourseV1ExplorationPage`, `SelectedExplorationResult`와 `buildExplorationPageV1`/`verifySelectedExplorationPlaceV1`을 추가했다.
  - 탐색 페이지는 로컬 입력만으로 안정 순서·page cursor·place/siteGroup 중복 제거를 수행하며 route/provider port를 받거나 호출하지 않는다. 상단 대표가 이미 포함한 ID는 `excludedPlaceIds`로 탐색과 선택 양쪽에서 제외한다.
  - `representative`와 근거·접근 창·`area|outdoor` placeKind가 완비된 `area_access`만 통과시켰다. `conditional`, facility `area_access`, 누락 근거/창/범위는 선택 전 fail-closed한다.
  - 명시 선택은 한 장소의 incoming/final receipt 두 구간만 검증한다. 성공은 기존 `VerifiedCourseV1` 시간 여정 snapshot이고, 실패는 `route_not_verified`, `route_verification_unavailable`, `time_budget_exceeded`, `access_window_unavailable` 등의 typed code만 반환한다. area_access는 권역 접근 창과 최소 체류(현재 20분)를 통과할 때만 `short` snapshot으로 반환한다.
  - 선택 receipt 관찰값을 결과에 분리하고 adapter ≤ 2회, 새 provider attempt ≤ 4회 상한을 공개 상수로 명시했다.
- `src/engine/index.ts`
  - UI 조립이 사용할 탐색/선택 함수·타입·선택 상한만 barrel로 export했다.
- `test/course-v1-exploration.test.ts`
  - 20개 이상 페이지 소비, route 0회 구조, place/siteGroup 중복 제거, discovery 자격/근거 보존, 대표 제외·대표 없음 독립 반환, facility fail-closed, 선택 성공 및 route/time/access 실패·자동 재시도 없음 fixture를 추가했다.
- 이 현재 작업 묶음에 완료 인계를 추가했다. UI·카탈로그 원본·data provider·Route Proxy/adapter·보드는 수정하지 않았다.

### 유지한 공개 계약

- 기존 대표 `buildLimitedRepresentativeCourseV1`의 18개 사전선정, N1/N2/W/T queue, A8/B12 provider attempt, adapter 24회, 1~3곳·체류·운영시간·도착 여유와 대표 선택은 변경하지 않았다.
- 탐색 페이지는 실제 이동 시간·도착 가능·검증 완료를 계산하거나 반환하지 않으며, 탐색/더 보기만으로 receipt/provider 호출을 만들지 않는다.
- 선택은 대표 코스를 대체하거나 다른 탐색 장소를 조립·자동 재시도하지 않는다. 대표 계산의 세션 상한과 선택 행동의 `2 adapter / 4 provider attempt` 상한은 별도 receipt로 관찰한다.

### 테스트 결과

- `npx tsx --test test/course-v1-exploration.test.ts` — 6/6 통과.
- `npx tsx --test test/course-v1-exploration.test.ts test/course-v1-limited-integration.test.ts test/course-v1.test.ts` — 51/51 통과. 2-O 체류와 REC-26 A8/B12 fixture를 포함한다.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 통과.
- `npm test` — 105/105 통과.
- `git diff --check` — 통과.
- 실제 API·GPS·Auth·DB 호출 — 0회.

### 다음 결정·위험

- **DATA-AREA-01 보완 필요:** 카탈로그에는 `evidenceProfile.placeKind`가 있으나 현재 `listDiscoveryCandidates()` 공개 candidate에는 이를 전달하지 않는다. 엔진은 시설 승격을 막기 위해 `area_access`의 `placeKind: area|outdoor` 누락을 fail-closed하므로, 현 상태로 런타임을 연결하면 두 `area_access`가 탐색에서 빠진다. 데이터 정제 역할이 해당 필드를 provider에 투영하고 계약 테스트를 보완해야 한다. 이 작업은 data 소유라 여기서 수정하지 않았다.
- UIUX는 `buildExplorationPageV1`에 상단 대표의 `placeIds`를 `excludedPlaceIds`로 넘기고, `ExplorationPlace`를 실제 시간표/검증 완료로 표현하지 않아야 한다. `area_access`는 `accessEvidence`/`accessWindow`를 그대로 표시 근거로만 사용한다.
- UIUX 선택 동작은 `verifySelectedExplorationPlaceV1`을 한 번만 호출하고 `SelectedExplorationResult`의 typed reason을 화면 문구로 매핑해야 한다. 실패 시 기존 대표·탐색 page state를 유지한다.
