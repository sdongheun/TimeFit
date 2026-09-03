# 2-X — 출시 2곳 코스 재도입 준비 감사

## 상태

**완료·통합 수락, 구현 미개시.** 이 작업은 2곳 추천을 구현하거나 출시 entry에 노출하지 않고, 현재 one-stop 출시 경계를 유지한 채 보존된 다장소 엔진의 재사용 범위와 실제 재도입을 막는 계약·비용·위험을 증거로 정리했다.

`API-ROUTE-GEOMETRY-03`과 병렬 수행할 수 있다. 이 작업은 `src/engine/`을 포함한 제품 코드를 수정하지 않고 이 문서에만 조사 결과를 기록하므로 외부 API 세션의 `src/services/` 작업과 작성자 충돌이 없다.

## 목적과 사용자 관찰

- 출시 기본은 현재 실제 검증 one-stop이다. 대표 1개와 검증 single 대안, 요청형 `다른 장소 더 보기`는 이미 수락됐다.
- 사용자는 지도 경로 완결 작업과 별개로, 앱 완성 뒤 2곳 코스까지 확장할 수 있는지를 미리 판단하고 싶어 한다.
- 과거 A8 실기기에서는 2곳 후보가 없었던 것이 아니라 `후보 153 / 시도 1 / 검증 0 / store unavailable 1`로 중단됐다. `API-PUBLIC-STORE-01`은 migration·secret 이름·RPC signature/권한의 명백한 국소 결함을 찾지 못했다.
- 따라서 “기존 다장소 코드를 다시 켜면 된다”, “호출량만 늘리면 된다”, “public store 문제는 해결됐다” 중 어느 것도 현재 확정 사실이 아니다.

## 현행 불변 계약

1. 일반 사용자 출시 entry는 계속 `buildReleaseOneStopRepresentativeCourseV1`과 one-stop continuation만 사용한다.
2. 최대 입력 시간 120분, 최소 체류 20분, 구조화 운영시간, 실제 경로, 도착 여유, 대표 카탈로그 분류 규칙을 낮추지 않는다.
3. 2곳은 `출발 → A → B → 목적지/출발 복귀`의 **세 실제 leg**를 모두 통과해야 한다. 근사 시간·직선·운영시간 미확인 후보·체류시간 임의 연장으로 성공시키지 않는다.
4. 3곳 코스는 이번 조사 대상이 아니다.
5. 현재 코스 상세 endpoint walk 보충은 one-stop의 최대 두 transit leg를 전제로 최대 4개다. 2곳은 최대 세 transit leg라 단순 확장 시 endpoint connector가 최대 6개가 될 수 있으며, 이를 현행 계약으로 승인됐다고 간주하지 않는다.
6. production entry·feature flag·환경값·UI·API·DB·카탈로그·제품 기준 문서는 변경하지 않는다. 실제 Kakao·Supabase·GPS·Auth 호출은 0회다.

## 시작 시 읽을 범위

다음만 읽는다.

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md`의 현행 one-stop 출시 규칙
3. `docs/work/integration-decision/release-multistop-timebox.md`
4. `docs/work/recommendation-engine/release-one-stop-verified-course.md`
5. `docs/work/recommendation-engine/release-one-stop-pagination.md`
6. `docs/work/recommendation-engine/verified-course-shape-diversity.md`
7. `docs/work/external-api/public-route-store-readiness-audit.md`의 완료 판정
8. `src/engine/courseV1.ts`, `src/engine/courseV1.testOnly.ts`, `src/engine/index.ts`
9. `test/release-one-stop-verified-course.test.ts`, `test/release-one-stop-pagination.test.ts`, `test/course-v1-pagination.test.ts`, `test/course-v1-limited-integration.test.ts`

archive 전체, UI 구현 파일, Edge handler, migration, 원본 장소 데이터는 읽지 않는다. 필요한 사실이 위 현재 문서와 코드에 없으면 추정하지 말고 `미확인`으로 기록한다.

## 조사 명령

### A. 현재 호출 경로와 재사용 가능 코드 지도

1. 아래 공개·내부 entry가 현재 어느 후보 선별기, queue, 검증 함수, 결과 선택기를 호출하는지 함수 단위로 표를 만든다.
   - `buildReleaseOneStopRepresentativeCourseV1`
   - `continueReleaseOneStopRepresentativeCourseV1`
   - `buildLimitedRepresentativeCourseV1`
   - `continueLimitedRepresentativeCourseV1`
   - test-only/internal B12 entry
2. 각 symbol을 `그대로 재사용 가능 / 2곳 전용으로 분리 필요 / 출시에서 사용 금지 / 미확인`으로 판정하고 파일·함수 근거를 적는다.
3. 보존된 다장소 코드가 현재 production one-stop entry에서 실제로 도달 불가능한지 확인한다. “테스트가 존재한다”와 “출시 runtime이 호출한다”를 구분한다.
4. 조사 중 발견한 오래된 주석·문서 표현은 직접 수정하지 않고 위치와 영향만 기록한다.

### B. 2곳 후보와 시간 계약 감사

1. 대표 공간 후보 상한 18개에서 2곳 후보가 어떻게 만들어지고 중복·역순·동일 `siteGroupId`가 어디서 제거되는지 확인한다. 기존 진단의 153개가 `18 choose 2`와 같은 의미인지 코드로 판정한다.
2. 2곳 검증의 leg를 왕복과 별도 목적지로 나눠 적는다.
   - 왕복: `origin → A → B → origin`
   - 목적지: `origin → A → B → destination`
3. 운영시간은 A와 B 각각의 도착·체류 구간에서 검사되는지, 최소 체류 20분과 선택 체류가 남은 시간 안에 어떻게 반영되는지 함수 근거를 남긴다.
4. 45·78·120분, 왕복·별도 목적지의 기존 고정 receipt fixture에서 2곳이 `후보 없음 / 시간 탈락 / 운영 탈락 / route 탈락 / exact 성공` 중 어디까지 재현되는지 기존 테스트만으로 표를 만든다. 근거가 없는 칸은 성공으로 추정하지 않는다.

### C. 호출량·cache·실패 경계 산정

1. 한 2곳 코스는 논리 leg 3개다. 현재 receipt adapter가 각 leg에 허용하는 최대 신규 provider attempt, 한 코스의 이론상 최소·최대 attempt, 전체 8/12/16 및 adapter-call 상한에서 완결 검증 가능한 2곳 코스 수를 **현재 코드 기준**으로 계산한다.
2. cache/session reuse가 있는 경우와 없는 경우를 분리한다. reuse를 신규 provider attempt로 세거나, cache hit을 항상 존재한다고 가정하지 않는다.
3. endpoint↔장소의 private leg와 장소 A↔B의 public leg가 어느 cache/lease/store 경계를 사용하는지 구분한다. 과거 `store unavailable`이 정확히 어느 RPC에서 발생했는지는 미확인이므로 특정 RPC를 원인으로 단정하지 않는다.
4. 호출 상한 증가는 해결안으로 확정하지 않는다. 첫 public leg가 store에서 fail-closed라면 8→12/16도 결과를 늘리지 못한다는 반례를 표에 포함한다.
5. 코스 상세 endpoint walk 보충은 one-stop 최대 4회와 2곳 이론 최대 6회의 차이를 별도 위험으로 기록한다. 이 호출은 추천 receipt attempt와 다른 상세 선택 후 비용임을 섞지 않는다.

### D. 제품 계약 충돌 목록

2곳을 실제로 활성화할 때 반드시 다시 결정해야 하는 항목을 다음 형식으로 정리한다.

| 결정 항목 | 현행 one-stop | 2곳 활성화 시 필요한 선택 | 영향 역할 | 활성화 차단 여부 |
| --- | --- | --- | --- | --- |

최소 아래를 포함한다.

- 대표가 1곳과 2곳 중 무엇을 우선하는지
- one-stop `다른 장소 더 보기`와 2곳 결과를 같은 목록에서 어떻게 중복 제거·페이지 처리하는지
- 2곳 continuation을 one-stop continuation과 분리할지
- A와 B가 기존 single 결과에 포함돼도 `A→B`를 별도 코스로 보여 줄 수 있는지
- 3-leg 실제 경로의 호출 예산과 public A→B store 실패 처리
- 코스 상세의 marker·세로 순서·세 geometry와 endpoint connector 최대치
- 한 leg 실패 시 2곳 전체를 탈락시키고 one-stop으로 자동 변형할지 여부. 자동 변형은 현행 승인 사항이 아니므로 별도 선택으로 둔다.

### E. 변경 예상표와 작업 순서 제안

기능을 구현하지 말고 아래 표를 작성한다.

| 역할 | 그대로 재사용 | 변경 예상 파일/공개 계약 | 선행 조건 | 난이도(S/M/L) | 주요 실패 위험 |
| --- | --- | --- | --- | --- | --- |

추천 엔진, 외부 API, DB, UIUX, QA를 모두 포함하되 다른 역할의 구현 방식을 대신 확정하지 않는다. 파일은 확인 가능한 경로만 적고, 불확실하면 모듈 수준으로 적는다.

실행 순서는 최소 다음 게이트로 나눈다.

1. 순수 엔진 internal 2곳 entry와 fixture
2. public A→B receipt의 재현 가능한 원인/복구 또는 대체 계약
3. 호출 예산·continuation·대표 선정에 대한 사용자 결정
4. UI 카드·상세 3-leg 표시
5. 자동 통합 후 소수 실기기 smoke

각 단계가 실패하면 다음 단계로 넘어가지 않는 중단 조건을 적는다.

## 필수 판정 결과

완료 기록에는 다음 결론을 모호하지 않게 제시한다.

1. **엔진 재사용성:** 현재 보존 코드로 2곳 전용 internal entry를 분리하는 것이 가능한가.
2. **런타임 차단점:** 엔진 밖의 public A→B store 문제가 실제 활성화 전에 반드시 해결돼야 하는가.
3. **호출 비용:** one-stop 대비 2곳 한 후보의 논리 leg와 신규 provider attempt 상한이 얼마나 증가하는가.
4. **지도 영향:** 현행 상세 walk connector 최대 4개 계약을 유지할 수 있는가, 별도 결정이 필요한가.
5. **권장 판정:** `지금 구현 진행 가능 / 선행 API 원인 규명 후 가능 / 공모전 이후 권장` 중 하나와 근거.

판정은 “코드가 남아 있다”만으로 `진행 가능`이 될 수 없다. 실제 출시 경로, public store, 호출 예산, UI/QA 변경량을 함께 근거로 삼는다.

## 검증과 완료 기준

- 제품 코드와 기존 테스트를 수정하지 않는다. 조사 결과는 이 문서 아래에만 append한다.
- 기존 고정 fixture의 현재 사실을 확인하기 위해 다음만 실행한다.
  - `npx tsx --test test/release-one-stop-verified-course.test.ts test/release-one-stop-pagination.test.ts`
  - `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`
- `API-ROUTE-GEOMETRY-03`이 동시에 작업 중이면 전체 `npm test`, `npm run test:ui`, `npm run test:typecheck`, 전체 worktree `git diff`를 완료 근거로 요구하지 않는다. 다른 세션의 중간 변경을 2-X 결함으로 판정하지 않는다.
- 실제 외부 API·Supabase·GPS·Auth·Simulator·실기기 호출은 0회다.
- 완료 인수인계는 반드시 다음 네 항목을 포함한다.
  1. 읽고 분석한 파일과 조사 목적
  2. 변경하지 않은 production one-stop·API·DB·UI 계약
  3. 실행한 고정 테스트와 결과, 표로 정리한 확인/미확인 근거
  4. 다음 결정 사항·단계별 예상 작업량·중단 조건
- 조사 결과만으로 production flag를 켜거나 다음 구현 작업을 자동 생성하지 않는다. 통합·결정 세션이 사용자와 결과를 검토한 뒤 다음 작업을 연다.
- 사용자 요청 전 commit·push하지 않는다.

## 수정 경계

- 수정 가능: 이 문서의 완료 기록만.
- 수정 금지: `src/engine/`, `src/services/`, `src/ui/`, `src/data/`, `test/`, Edge, migration/DB, `.env*`, `docs/03_product/*`, `docs/테스트.md`, `docs/작업조정_보드.md`, 다른 역할 작업 문서.

---

## 2026-09-03 — 2-X 조사 결과

### A. 현재 호출 경로와 재사용 가능 코드 지도

| entry/symbol | 실제 호출 지도 | 판정 | 근거와 영향 |
| --- | --- | --- | --- |
| `buildReleaseOneStopRepresentativeCourseV1` | `selectReleaseOneStopCandidates` → `verifyReleaseOneStopPage(target=4)` → `compareRepresentativeCourses` | 출시에서 2곳 용도로 사용 금지 | production one-stop 전용이다. single pool만 만들며 `candidate→candidate` leg, 다장소 queue, 자동 8→16 보충을 만들지 않는다. 이 entry를 넓히면 수락된 출시 계약이 암묵적으로 바뀐다. |
| `continueReleaseOneStopRepresentativeCourseV1` | one-stop 후보 집합/signature 재검증 → `verifyReleaseOneStopPage(target=3)` | 출시에서 2곳 용도로 사용 금지 | continuation이 candidate ID 단위의 attempted/rejected/verified 상태만 가진다. `A→B` course signature나 partial 3-leg 상태를 표현할 수 없다. |
| `buildLimitedRepresentativeCourseV1` | 공통 `preselectLimitedCourseV1`; receipt가 있으면 `buildInitialContinuationCourseV1` → `verifyContinuationPage(target=4, 8→조건부 16)` → `selectContinuationCourseSet`, receipt가 없으면 최대 4개 `candidateCourses` → `verifyCourse` → `selectRepresentativeCourseSetV1` | 2곳 전용으로 분리 필요 | 보존 다장소 계산은 동작하지만 1·2·3곳을 함께 만들고 검증한다. 기존 symbol을 production에 직접 연결하면 3곳, 16회 보충, mixed continuation까지 같이 재활성화된다. |
| `continueLimitedRepresentativeCourseV1` | 전체 다장소 preselection 재생성/signature 확인 → `verifyContinuationPage(target=3, 8)` → `selectContinuationCourseSet` | 2곳 전용으로 분리 필요 | 안전한 재수화·중복 방지 primitive는 재사용 가능하지만 continuation queue가 1·2·3곳 혼합이다. one-stop continuation과도 타입·상태가 다르다. |
| `buildLimitedRepresentativeCourseV1ForInternalB12` | 공통 preselection → `buildReceiptBudgetedRepresentativeCourseV1(B12)` → `N1→N2→N1→W→T` → `selectRepresentativeCourseSetV1` | 출시에서 사용 금지 | internal diagnostics 전용 고정 B12이며 attempt 12와 queue order B를 동시에 바꾼다. 2곳 단독 효과나 production 정책의 근거로 직접 쓸 수 없다. |
| `buildLimitedRepresentativeCourseV1ForTestOnlyReceiptEvaluation` | 주입한 A/B × 8/12/16 정책 → 같은 budgeted verifier/tier 선택 | 출시에서 사용 금지 | `courseV1.testOnly.ts`를 통해서만 의도된 matrix fixture 경계다. 정책 비교 증거에는 쓸 수 있지만 production export/entry가 되어서는 안 된다. |
| `selectSpatialCandidatePool`·`canPossiblyOpen` | representative/구조화 운영시간/체류 범위 → 공간 정렬·`siteGroupId` 중복 제거·18개 상한 | 그대로 재사용 가능 | one-stop과 다장소가 이미 공유하는 route 호출 전 순수 후보 경계다. |
| `preselectLimitedCourseV1` | 18개 pool → 1~3곳 순서 조합 → 관계 충돌 제거 → legacy 4-slot, tier queue, canonical continuation queue | 2곳 전용으로 분리 필요 | 공간 정렬과 pair 생성은 재사용할 수 있으나 반환 전체를 쓰면 1·3곳 queue까지 생성된다. 2곳 projection과 전용 진단이 필요하다. |
| `verifyCourseWithReceipts`·`selectStayPlan` | 주어진 장소 순서의 모든 leg receipt → 장소별 실제 도착 운영시간/최소 체류 → 권장 체류 시도 → 총시간/도착 여유 | 그대로 재사용 가능 | 장소 배열 길이에 종속되지 않아 2곳의 세 leg와 두 stop을 이미 검증한다. exact가 아닌 한 leg라도 전체 코스를 fail-closed한다. |
| `selectRepresentativeCourseSetV1`·`selectContinuationCourseSet` | 1·2곳을 3곳보다 대표 우선, 이동/체류 부담 정렬, nested set 제거 | 2곳 전용으로 분리 필요 | 현재 mixed 1/2/3 정책이다. single과 pair 중 무엇을 대표로 둘지, `A`와 `A→B`를 함께 보여 줄지는 사용자 결정 전 재사용할 수 없다. |

보존 다장소 함수가 `src/engine/index.ts`에 export되어 있고 테스트가 존재하는 사실은 production 도달성의 증거가 아니다. 수락된 출시 entry는 `buildReleaseOneStopRepresentativeCourseV1`와 single continuation이며, 20개 후보 fixture에서도 `generatedOrderedCourseCount=0`, 다장소 진단 없음, 모든 결과 `placeIds.length=1`, candidate-to-candidate receipt 0으로 확인된다. 일반 production one-stop에서 보존 `preselectLimitedCourseV1`·`verifyContinuationPage`·B12/test-only entry로 이어지는 호출은 없다. internal diagnostics에서 명시적으로 고정 B12를 선택하는 경계만 별도 보존돼 있다.

직접 수정하지 않은 오래된 표현은 두 곳이다.

- `src/engine/courseV1.ts`의 release 주석은 “continuation을 만들지 않는다”고 적어, 2-V 이후 single continuation이 생긴 현행과 맞지 않는다. 동작에는 영향이 없지만 새 entry 설계 시 잘못된 전제로 읽힐 수 있다.
- `src/engine/courseV1.testOnly.ts`는 production/UI가 A8 또는 B12를 소비한다고 적어 release one-stop 기본 entry를 누락한다. test-only export 경계는 맞지만 production 도달성 설명은 낡았다.

### B. 2곳 후보와 시간 계약 감사

#### 후보 수와 중복

- 18개 pool의 순서 조합 생성 수는 1곳 `18`, 2곳 `18×17=306`, 3곳 `18×17×16=4,896`, 합계 `5,220`이다. `generatedOrderedCourseCount`는 관계 충돌 제거 뒤 남은 **순서 조합** 수이므로 모든 장소가 서로 다른 group이면 5,220이다.
- `siteGroupId` 중복은 먼저 `selectSpatialCandidatePool`에서 같은 group의 후속 장소를 pool에서 제거하고, 조합 단계에서도 `hasRelationshipConflict`가 한 코스 안의 동일 group을 다시 차단한다.
- 다장소 continuation의 `setKeyOf`는 place ID를 정렬하므로 `A→B`와 `B→A` 중 공간 점수가 앞선 한 순서만 남긴다. 따라서 관계 충돌이 없는 18개 pool에서 shape diagnostics의 2곳 queue `153`은 `18 choose 2`이며, 306개 방향 조합 전체가 아니다. 방향 반대 코스는 현재 별도 검증하지 않는다.

#### 실제 검증과 체류

| 구분 | 2곳 leg |
| --- | --- |
| 왕복 | `origin → A → B → origin` |
| 별도 목적지 | `origin → A → B → destination` |

`verifyCourseWithReceipts`는 각 leg가 exact인지 순서대로 확인한다. A 도착 시 A의 최소 체류 운영시간과 중간 예산을 검사한 뒤에만 `A→B`를 요청하고, B 도착 시 B의 최소 체류 운영시간과 중간 예산을 검사한 뒤 마지막 leg를 요청한다. 세 leg와 도착 여유까지 최소 체류로 통과한 뒤 `selectStayPlan`이 같은 exact legs에서 A, B 순서로 권장 체류를 올려 보고, 실패한 장소만 최소 체류로 되돌린다. `totalMin = 세 leg 합 + 두 선택 체류 합 + arrivalBufferMin`이며 최대 체류는 남는 시간을 채우는 용도로 사용하지 않는다.

#### 기존 fixture가 증명하는 범위

| 시간·형태 | 후보/실패 재현 | exact 2곳 재현 | 판정 한계 |
| --- | --- | --- | --- |
| 45분 왕복 | M-04 receipt matrix는 N2 검증 0과 route fallback을 재현한다. 현행 최소 20분×2, 양의 정수 세 leg, buffer 5분이면 이론 최소가 48분이므로 현행 계약의 exact 2곳은 시간 탈락이다. | 없음 | ENG-2K-01은 one-stop 성공만 확인한다. M-04는 체류 1분짜리 matrix라 현행 20분 성공 근거가 아니다. |
| 45분 별도 목적지 | M-04에서 N2 route 실패 경로가 존재한다. 같은 최소식 때문에 buffer 5분 기준 exact 2곳은 48분 이상이다. | 없음 | 목적지형 현행 20분 receipt 전용 시간 경계 fixture는 없다. |
| 78분 왕복 | M-04 receipt는 N2 route 실패를 재현한다. | route-only ENG-2K-02에서 exact 세 leg의 2곳 성공은 확인됨. receipt exact 성공은 미확인. | 엔진 시간/운영 primitive 재사용 근거는 되지만 public A→B store 성공 근거는 아니다. |
| 78분 별도 목적지 | M-04 receipt에서 N2 route 실패는 재현됨. | 미확인 | 현행 체류값의 별도 목적지 exact 2곳 receipt fixture가 없다. |
| 120분 왕복 | 2-S-R receipt에서 첫 N2 route 탈락 뒤 두 번째 N2 시도·성공을 재현한다. | 확인 | 해당 pagination fixture의 체류는 5분이므로 현행 최소 20분 공급량을 증명하지 않는다. route-only ENG-2K-04에는 20+30분 pair 성공이 있다. |
| 120분 별도 목적지 | 2-S-R receipt에서 첫 N2 route 탈락 뒤 두 번째 N2 성공을 재현한다. | 확인 | 역시 5분 체류 fixture다. route-only 시간 snapshot은 2곳 세 leg와 buffer 계산을 별도로 확인한다. |

추가로 기존 fixture는 운영시간 측면에서 첫 장소가 최소 체류를 통과하지 못하면 downstream receipt를 호출하지 않는 것, 왕복 80분의 두 장소가 각각 `short/recommended`로 선택되는 것을 확인한다. 그러나 45·78·120 × 왕복·목적지 여섯 칸 모두에 대해 `후보 없음/시간/운영/route/exact` 다섯 상태를 완전한 receipt matrix로 고정한 것은 아니다. 위 표의 `미확인`은 성공이나 실패로 추정하지 않는다.

### C. 호출량·cache·실패 경계 산정

한 2곳 코스는 논리 leg 3개이며, 각 `getRouteReceipt`에는 남은 전역 예산 안에서 최대 신규 provider attempt 2회가 허용된다. 한 leg는 도보 exact가 바로 선택되면 보통 1회, 도보 뒤 transit까지 가면 최대 2회다.

| 조건 | 코스당 신규 provider attempt | adapter call | 의미 |
| --- | --- | --- | --- |
| 세 leg 모두 cache/session/in-flight 재사용 | 0 | 최대 3개의 새 route key에 대해 3; 엔진 receipt cache에 이미 있으면 더 적음 | 재사용은 attempt로 세지 않지만 항상 존재한다고 가정할 수 없다. |
| 재사용 없음·각 leg 첫 provider에서 exact | 최소 3 | 3 | 8/12/16 예산에서 각각 최대 2/4/5개 완결 가능. |
| 재사용 없음·각 leg가 최대 2회 사용 | 최대 6 | 3 | 8/12/16 예산에서 각각 최대 1/2/2개 완결 가능. 남은 2/0/4회만으로 다음 worst-case 코스 완결은 보장되지 않는다. |

adapter-call 상한 24만 놓고 서로 겹치지 않는 세 leg 코스만 계산하면 최대 8개다. 다만 현재 initial continuation은 결과 목표 4개, page는 3개에서 먼저 멈추고, tier queue의 N2는 가까운 pair 최대 3개뿐이다. 반대로 여러 코스가 같은 endpoint leg를 공유하면 엔진 receipt cache로 adapter call이 줄 수 있다. 따라서 위 숫자는 “2곳만 연속 검증하고 모두 exact”라는 용량 산정이며 실제 반환 보장값이 아니다. one-stop은 코스당 2 logical legs, 비재사용 신규 attempt 최소 2·최대 4이므로 2곳은 코스당 logical leg가 `2→3`(50% 증가), 최대 attempt가 `4→6`(50% 증가)한다.

- `origin→A`와 `B→origin/destination`은 사용자 endpoint 정밀 좌표를 포함하는 private leg다. public POI cache/lease에 저장하지 않고 request 범위에서 budget 경계를 사용한다.
- `A→B`는 대표 카탈로그의 두 장소 사이 public leg이므로 public cache 조회·lease·budget·store 경계에 진입한다.
- 과거 `store unavailable`은 이 public store 경계에서 fail-closed됐다는 것까지만 확인됐다. migration, Function secret 이름, RPC signature와 service-role 권한은 준비돼 있었지만 어떤 RPC가 실패했는지와 현재 복구 여부는 미확인이다.
- 첫 `A→B`가 typed store unavailable이면 verifier가 그 코스를 중단하고 현재 budgeted/continuation 경계도 provider unavailable로 멈출 수 있다. 그러므로 8을 12/16으로 올려도 실패 지점을 우회하거나 결과 수를 늘린다는 보장이 없다.
- 추천 receipt 비용과 코스 상세 connector 비용은 별개다. one-stop의 transit leg 최대 2개는 시작·끝 gap을 각각 보충할 때 connector 최대 4회지만, 2곳의 transit leg 최대 3개는 이론상 최대 6회다. 현행 4회 상한으로 세 leg 모두의 양끝을 보장할 수 없으므로 별도 제품/API 결정을 거쳐야 한다.

### D. 제품 계약 충돌 목록

| 결정 항목 | 현행 one-stop | 2곳 활성화 시 필요한 선택 | 영향 역할 | 활성화 차단 여부 |
| --- | --- | --- | --- | --- |
| 대표 우선순위 | single 중 이동/체류 부담으로 대표 선정 | single 우선, pair 우선, 또는 동일 비교 중 하나를 확정하고 카드 수 목표도 정한다. | 통합·결정, 추천 엔진, UIUX, QA | 예 |
| mixed 결과와 pagination | single continuation이 새 single 최대 3개를 기존 뒤에 append | one-stop 더보기와 pair 결과를 한 목록/탭/별도 영역 중 어디에 두고 페이지별 목표·총량을 어떻게 둘지 정한다. | 통합·결정, 추천 엔진, UIUX | 예 |
| continuation 타입 | candidate ID 단위 single continuation | pair course signature, 순서, partial 3-leg, attempted/rejected/verified 상태를 one-stop과 분리할지 결정한다. | 통합·결정, 추천 엔진, UIUX | 예 |
| 부분집합 중복 | 서로 다른 single ID만 중복 제거 | single `A`, single `B`가 이미 보여도 `A→B`를 별도 가치로 보여 줄지, nested set으로 숨길지 결정한다. | 통합·결정, 추천 엔진, UIUX, QA | 예 |
| 3-leg 호출 예산 | 2 legs, initial/page attempt 각 8 | pair당 3~6 attempt와 public `A→B` 실패를 고려해 전체 budget·중단 상태를 정한다. 단순 12/16 상향은 승인안이 아니다. | 통합·결정, 추천 엔진, 외부 API, DB, QA | 예 |
| public A→B store | one-stop은 candidate-to-candidate 0이라 해당 경계를 회피 | 특정 실패 stage의 재현 가능한 원인과 복구 또는 별도 fail-closed UX를 확정한다. | 외부 API, DB, 통합·결정, QA | 예 |
| 카드·상세·지도 | 장소 1개, stops 1개, legs/geometry 최대 2개, connector 최대 4개 | A/B marker와 세로 시간 순서, 세 geometry mode, connector 최대 6개 또는 제한 정책을 정한다. | 통합·결정, UIUX, 외부 API, QA | 예 |
| 한 leg 실패 | 해당 single 전체 탈락 | pair 전체 탈락만 할지, 검증된 일부를 single로 자동 변형할지 결정한다. 자동 변형은 현재 승인되지 않았다. | 통합·결정, 추천 엔진, UIUX, QA | 예 |
| 입력 시간 | 최대 120분, 최소 20분 one-stop | 120분 안에서만 pair를 허용할지와 45분처럼 구조적으로 불가능한 입력의 표시를 정한다. 180분 복원은 별도 결정이다. | 통합·결정, UIUX, 추천 엔진 | 예 |

### E. 변경 예상표와 단계별 작업 순서

| 역할 | 그대로 재사용 | 변경 예상 파일/공개 계약 | 선행 조건 | 난이도 | 주요 실패 위험 |
| --- | --- | --- | --- | --- | --- |
| 추천 엔진 | 공간 후보/운영 사전 gate, pair 생성, `verifyCourseWithReceipts`, `selectStayPlan`, exact/geometry snapshot | `src/engine/courseV1.ts`, 필요 시 `courseV1.testOnly.ts`와 `src/engine/index.ts`; 2곳 전용 internal entry·결과/진단·continuation 계약, 기존 두 엔진 test 묶음 | 대표 우선순위·중복·예산 결정 전에는 internal 조사 entry까지만 | M | 기존 mixed entry를 재연결해 3곳·16회·nested 제거 정책까지 우발 활성화 |
| 외부 API | private endpoint와 public POI scope 분리, typed unavailable receipt | Route Proxy public store/receipt adapter 모듈; public `A→B` stage 관찰·재현 계약 | 비식별 재현으로 특정 store stage 확인 | L | 원인 미확인 상태에서 호출 상향·재시도로 비용만 늘고 동일 fail-closed 반복 |
| DB | 기존 public cache/lease/budget RPC 설계와 service-role 경계 | public route cache/lease/budget 계약·migration 모듈(구체 변경 필요 여부 미확인) | API 재현이 DB stage를 특정할 때만 | M(미확인) | 정상 schema를 불필요하게 변경하거나 private 좌표를 저장하는 회귀 |
| UIUX | `VerifiedCourseV1` legs/stops/geometry snapshot과 one-stop 카드 기반 | 결과 목록/continuation/코스 상세 지도·세로 여정 모듈; 2곳 카드와 세 leg·두 stop 표시 계약 | 대표·혼합 목록·connector 상한 결정 | L | single만 가정한 화면에서 B/중간 leg 누락, 기존 결과 재정렬, 자동 fallback 오해 |
| QA | 현재 고정 receipt harness, shape diagnostics, one-stop 회귀 | 순수 2곳 matrix, public store fixture, mixed pagination 통합, 3-leg 지도/E2E 및 마지막 소수 실기기 시나리오 | 각 앞 단계 수락 | L | route-only fixture를 public 성공으로 오판하거나 실제 API 반복 호출로 quota 소비 |

제안 순서와 중단 조건은 다음과 같다. 이는 작업 자동 생성이나 구현 승인이 아니다.

1. **순수 엔진 internal 2곳 entry와 fixture:** production export/flag 없이 pair-only 후보·세 leg·20분·운영시간·120분·진단을 고정한다. 45·78·120 × 왕복/목적지 matrix, 3곳 0, one-stop 불변을 증명하지 못하면 중단한다.
2. **public A→B receipt 재현:** 비식별 fixture 또는 승인된 안전 stage 관찰로 store 실패 RPC/단계를 재현하고 최소 복구 또는 대체 계약을 제시한다. 원인이 계속 미확인이거나 두 번째 복구 cycle·새 provider/fallback/대규모 schema가 필요하면 중단한다.
3. **사용자 결정:** 3-leg budget, single/pair 대표 우선순위, mixed 중복, 전용 continuation, 한 leg 실패 처리, connector 상한을 확정한다. 하나라도 미확정이면 공개 entry·flag 작업으로 넘어가지 않는다.
4. **UI 카드·상세:** 결정된 계약으로 두 stop, 세 leg/mode/geometry, 남는 시간과 실패 상태를 고정 fixture에서 표시한다. 직선 fallback, route 재계산, single 결과 재정렬, connector 무제한 호출이 발생하면 중단한다.
5. **자동 통합 후 소수 실기기 smoke:** fixture에서 provider/cache/engine/UI 전체를 먼저 통과한 뒤 승인된 소수 public A→B와 2곳 실기기 시나리오만 실행한다. store unavailable 재발, attempt/connector 상한 초과, private geometry 영속 흔적이 있으면 출시 활성화를 중단하고 one-stop을 유지한다.

### 필수 판정

1. **엔진 재사용성 — 가능하되 전용 분리 필요.** pair 생성, 세 leg exact 검증, 두 장소 운영시간·체류·총시간 snapshot은 보존 코드로 재사용할 수 있다. 그러나 기존 multi entry는 1·2·3곳과 8→16·혼합 continuation을 함께 가지므로 2곳 전용 internal entry 없이 출시 재연결할 수 없다.
2. **런타임 차단점 — 해결 필수.** public `A→B` store 문제는 one-stop이 우회하는 엔진 밖 경계다. 특정 RPC 원인과 복구는 아직 미확인이며, 실제 활성화 전에 재현 가능한 원인/복구 또는 사용자가 승인한 대체 계약이 필요하다.
3. **호출 비용 — 코스당 50% 증가.** one-stop 2 legs·최대 4 attempt에서 2곳 3 legs·최대 6 attempt로 증가한다. 비재사용 exact 기준 최소도 2→3 attempt이고, cache가 전부 재사용되면 0이지만 이를 공급량 근거로 가정할 수 없다.
4. **지도 영향 — 현행 최대 4개 유지 불가 가능성.** 세 transit leg의 양끝 gap을 모두 보충하려면 이론 최대 6 connector가 필요하다. 4개로 제한할 우선순위나 6개 허용 여부를 별도 결정해야 한다.
5. **권장 판정 — 공모전 이후 권장.** 엔진 primitive만 보면 internal 준비가 가능하지만 public store 원인 미확인, 호출 예산·continuation·대표 정책 미결정, 3-leg UI와 QA 변경량이 남아 있다. 현재 one-stop 출시를 위험에 노출하면서 바로 구현·활성화할 근거가 없으며, 공모전 이후 위 게이트 순서로 재개하는 것이 타당하다.

## 2-X 완료 인수인계

### 1. 읽고 분석한 파일과 조사 목적

- `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/03_product/추천로직.md`의 one-stop 현행 절을 기준으로 출시 불변선을 확인했다.
- `release-multistop-timebox.md`, `release-one-stop-verified-course.md`, `release-one-stop-pagination.md`, `verified-course-shape-diversity.md`, `public-route-store-readiness-audit.md`의 완료 판정으로 과거 중단 이유와 현재 미확인 범위를 분리했다.
- `src/engine/courseV1.ts`, `courseV1.testOnly.ts`, `index.ts`와 지정된 테스트 네 파일에서 production one-stop과 보존 multi entry의 함수 도달성, pair 수, 시간·운영 검증, attempt/cache 경계를 조사했다.

### 2. 변경하지 않은 production one-stop·API·DB·UI 계약

- 조사 결과만 이 문서에 append했다. 제품 코드, 기존 테스트, production entry/flag, 환경값, API/DB/UI/카탈로그/기준 문서와 작업 보드는 수정하지 않았다.
- one-stop의 120분·최소 20분·두 exact legs·initial/page 각 attempt 8·single 결과·조건부 분리 계약을 유지했다. 2곳이나 3곳을 활성화하지 않았다.
- 실제 Kakao, Supabase, GPS, Auth, Simulator, 실기기 호출은 모두 0회다.

### 3. 실행한 고정 테스트와 확인·미확인 근거

- `npx tsx --test test/release-one-stop-verified-course.test.ts test/release-one-stop-pagination.test.ts` — **11/11 성공**.
- `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts` — **52/52 성공**.
- 전체 `npm test`, UI, typecheck는 API-ROUTE-GEOMETRY-03 병렬 작업 가능성과 조사 명령에 따라 완료 근거로 실행하지 않았다.
- 확인: multi code의 pair 생성/세 leg/운영·체류/시간 검증, 120분 왕복·목적지 receipt pair 성공, route failure와 continuation 불변, one-stop의 다장소 도달 0.
- 미확인: 78분 목적지 및 현행 20분 기반의 전체 receipt pair matrix, 실제 public `A→B` store 성공, 특정 실패 RPC, 실제 공급량, connector 4/6 사용자 선택.

### 4. 다음 결정·예상 작업량·중단 조건

- 권장 시점은 **공모전 이후**다. 먼저 순수 엔진 M, API L, DB M(원인에 따라 미확인), UIUX L, QA L 정도의 작업을 위 5개 게이트 순서로 검토한다.
- 통합·결정 세션은 대표 우선순위, mixed 중복·목록, 2곳 전용 continuation, 3-leg attempt, 한 leg 실패, connector 최대치를 사용자와 확정해야 한다.
- public store 원인이 재현되지 않거나 새 설계·두 번째 복구 cycle이 필요하면 API 단계에서 중단한다. 이후 어느 단계든 one-stop 계약 회귀, 3곳 유입, 근사/직선 fallback, 상한 초과, private 데이터 영속화가 나오면 다음 단계로 넘어가지 않는다.

---

## 2026-09-03 통합 검토 — 수락

- production one-stop과 보존 multi entry의 실제 도달성을 구분했고, 2곳 primitive 재사용 가능성과 2곳 전용 entry 분리 필요성을 함수 근거로 제시했다.
- 18개 pool의 pair queue 153, 세 logical leg, 코스당 신규 provider attempt 최소 3·최대 6, one-stop 대비 최대 비용 50% 증가 계산이 현재 코드와 일치한다.
- 기존 fixture가 증명하는 route-only/receipt/현행 20분 범위를 구분했으며, public `A→B` store 성공과 일부 시간·목적지 조합을 미확인으로 남겨 과장하지 않았다.
- 통합 세션이 지정 테스트를 독립 실행해 one-stop **11/11**, multi/limited **52/52** 통과를 재확인했다. 실제 외부 API·DB·GPS·실기기 호출은 0회다.
- `공모전 이후 권장`은 자동 확정 정책이 아니라 현재 위험·작업량에 따른 기본 권고다. 사용자가 출시 전 재개를 선택하더라도 먼저 pair-only internal engine fixture와 public A→B store의 재현 가능한 원인 규명 게이트를 통과해야 한다.
- 2-X 완료로 production entry·UI·API·DB·호출 상한은 바뀌지 않았다. 다음 활성 제품 작업은 `U-COURSE-GEOMETRY-02`이며, 2곳 구현 작업은 별도 사용자 결정 전 열지 않는다.
