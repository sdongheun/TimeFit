# 2-U — 출시용 1곳 실제 검증 전환

## 상태

수락. `DEC-RELEASE-MULTISTOP-01`에 따라 다장소 원인 추적을 재개하지 않고, release one-stop entry에서 기존 다장소 사전선별 호출까지 제거했다. 출시 경로는 single 후보 풀만 생성·검증하며 기존 A8/B12·continuation·다장소 관찰은 그대로 보존한다.

> **후속 교체 범위:** 이 작업에서 확정했던 `release continuation 없음`만 2026-09-02 `DEC-ONE-STOP-MORE-01`과 [2-V](release-one-stop-pagination.md)로 교체한다. single-only, 첫 attempt 8회, candidate-to-candidate receipt 0과 나머지 안전 계약은 유지한다. 아래 기록은 2-U 완료 당시의 감사 이력이다.

## 목적

공모전 출시 자동 추천을 “다장소가 실패해도 우연히 1곳이 남는 기존 A8 결과”가 아니라, **처음부터 1곳만 조립·실제 경로 검증하는 명시적 entry**로 바꾼다. 결과는 `출발 → 한 장소 → 도착/복귀`의 실제 도보·대중교통 receipt, 구조화 운영시간, 최소 체류, 도착 여유를 모두 통과해야 한다.

이 전환은 다장소 문제를 해결했다고 주장하지 않는다. 기존 A8/B12·continuation·다장소 진단은 배포 후 원인 재개를 위해 보존하되 출시 경로가 호출하지 않게 분리한다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md`의 2026-09-02 출시 범위와 `docs/테스트.md`의 `REC-30`
3. [출시 다장소 시간 상한](../integration-decision/release-multistop-timebox.md), [다장소 safe reason 계약](receipt-unavailable-reason-contract.md)
4. `src/engine/courseV1.ts`, `src/engine/index.ts`, `test/course-v1-pagination.test.ts`, `test/course-v1-limited-integration.test.ts`

## 작업 명령

1. `buildLimitedRepresentativeCourseV1`와 B12/test-only entry를 수정해 출시 정책을 암묵적으로 바꾸지 않는다. 별도의 공개 release one-stop entry(이름은 역할을 명확히 드러내야 함)를 `src/engine/`에 추가하고 barrel에서 공개한다.
2. 이 entry는 기존 대표 후보의 분류·공간·운영시간·최소/권장 체류 사전 게이트를 재사용하되, receipt 검증 queue에는 정확히 `[candidate]`만 넣는다. 2·3곳 조합·순서 변형·continuation queue를 만들거나 소비하지 않는다.
3. 한 후보는 `origin → candidate`, `candidate → destination/return` 두 leg 모두 `exact`일 때만 결과가 된다. 기존 `verifyCourseWithReceipts`의 시간 예산·운영시간·도착 여유·선택 체류 계산을 재사용하거나 동등한 순수 경계를 둔다. 최소 20분을 통과 하한으로 유지하고, 선택 체류가 권장 30분 미만인지 나타내는 기존 `stayState`를 결과 snapshot에 보존한다. 근사 시간, `no_route`, `unavailable`, 운영시간 불가, 최소 체류 미달은 모두 fail-closed한다.
4. 첫 계산은 대표 1개와 검증된 1곳 대안 최대 3개를 **목표**로 하되, 신규 provider attempt는 8회를 넘지 않는다. 후보·route가 부족하면 목표를 채우기 위한 16회 보충·provider fallback·체류 연장·조건부 자동 승격을 하지 않는다. 검증된 수가 1개여도 정상이므로 대안 수를 약속하지 않는다.
5. release one-stop entry는 `candidate → candidate` route receipt를 절대 요청하지 않는다. 따라서 public representative-to-representative cache/lease 경계에 진입하지 않는 것을 request fixture로 증명한다. 입력 endpoint identity가 후보 identity와 충돌해 이 보장을 만들 수 없는 경우에는 해당 후보를 route 호출 전에 제외하거나 안전하게 fail-closed한다. 기존 private 구간의 budget 정책은 API 역할 경계이므로 바꾸지 않는다.
6. release one-stop 결과에는 continuation을 만들지 않는다. 이후 “다른 검증 코스 더 보기”를 release UI에서 숨기는 작업은 UIUX 역할에 인계한다. 기존 multi-stop continuation API·타입·internal diagnostics는 삭제하거나 의미를 바꾸지 않는다.
7. 최소 고정 fixture를 추가한다.
   - 실제 exact 두 leg를 통과한 결과의 모든 `placeIds.length === 1`, `legs.length === 2`, 시간표/남는 시간/선택 체류가 유효하다.
   - 후보가 충분해도 adapter가 받는 모든 request가 endpoint↔candidate이고 candidate↔candidate 요청은 0회다.
   - 한 후보의 `no_route`/`unavailable(store 포함)`/운영시간 불가/시간 초과는 그 후보만 탈락시키고, 다른 single 후보를 검증할 수 있다. 다만 provider attempt ≤8, adapter call·재사용 계수는 실제 receipt와 일치해야 한다.
   - endpoint ID와 대표 candidate ID의 충돌 입력은 public segment 요청 없이 fail-closed한다.
   - 기존 production A8, internal B12, 2-S-R, continuation fixture의 반환·상한·다장소 진단은 변경되지 않는다.

## 수정 경계

- 수정 가능: `src/engine/`, 순수 엔진 tests, 이 작업 문서.
- 수정 금지: `src/ui/`, `src/services/`, Edge, Supabase migration/DB, 카탈로그, `.env*`, `docs/03_product/*`, `docs/테스트.md`, `docs/작업조정_보드.md`.
- 실제 API·GPS·DB·사용자 세션 호출은 0회다. provider attempt 수는 fixture receipt의 숫자만 사용한다.

## 완료 기준과 인계

- 새 fixture는 구현 전 기존 entry가 통과할 수 없거나, 명시적 one-stop entry가 없음을 보여야 한다. 구현 뒤에는 one-stop entry를 직접 호출해 위 결과·요청 경계를 검증한다.
- 최소 `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행하고 결과를 기록한다.
- 인계에는 변경 파일, 불변인 A8/B12/multi-stop 공개 계약, 테스트 결과, UIUX가 받아야 할 결과 계약(대안 최대 3/continuation 없음/카드 수 약속 없음/체류 분 비노출/20~29분만 `가볍게 둘러보기`)을 남긴다.
- UIUX는 이 작업이 수락된 뒤에만 release entry 연결·다장소 문구/더보기 제거를 수행한다. 새 internal build 및 실기기 검증은 그 UI 작업 뒤 QA 역할이 수행한다.

---

## 2026-09-02 — 2-U 완료 인계

### 1. 변경 파일과 목적

- `src/engine/courseV1.ts`: `buildReleaseOneStopRepresentativeCourseV1`과 `CourseV1ReleaseOneStopResult`를 추가했다. representative 후보를 한 곳씩만 `origin → candidate → destination/return` receipt로 검증하며 continuation·2/3곳 조립·8→16 보충을 만들지 않는다.
- `src/engine/index.ts`: release one-stop entry와 결과 타입을 barrel에 공개했다.
- `test/release-one-stop-verified-course.test.ts`: 정확 두 legs/time snapshot/short 체류, endpoint↔candidate 요청만 허용, 실패 후보 뒤 다른 single 검증, endpoint ID 충돌 route 0을 고정했다.

### 2. 유지한 공개 계약·정책 경계

- 기존 production A8, B12/test-only, continuation, multi-stop diagnostics와 safe unavailable reason 계약은 변경하지 않았다.
- one-stop은 구조화 운영시간·최소 20분·도착 여유·exact receipt를 모두 통과해야 하며, 후보 간 route·fallback provider·조건부 승격·체류 연장·continuation은 없다.
- 신규 provider attempt ≤8, adapter call ≤24를 유지한다. endpoint ID와 candidate ID가 충돌하면 public segment 요청 없이 제외한다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/release-one-stop-verified-course.test.ts`: 4/4 통과.
- `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`: 52/52 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 167 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- UIUX는 수락 뒤 이 entry만 release 자동 추천에 연결하고 다장소/더보기 문구를 제거해야 한다. 결과 계약은 대표 1개+검증 single 대안 최대 3개, continuation 없음, 카드 수 보장 없음, 체류 분 비노출이다. 20~29분은 `가볍게 둘러보기`로만 표현한다.
- 실제 Kakao receipt 품질, 사용자 권한/GPS, 외부 전환과 release UI 연결은 아직 검증하지 않았다. UI 연결 후 QA가 새 internal build와 실기기로 확인해야 한다.

---

## 2026-09-02 — 통합 검토 및 2-U 동일 작업 보완 지시

### 검토 결과

- 독립 실행: `test/release-one-stop-verified-course.test.ts`, `test/course-v1-pagination.test.ts`, `test/course-v1-limited-integration.test.ts` **56/56 통과**, `npm run test:typecheck` 통과.
- `buildReleaseOneStopRepresentativeCourseV1`의 receipt 요청은 `origin → candidate → destination/return`만 사용하고, `candidate → candidate` request는 만들지 않는다. 8회 provider 상한, endpoint ID 충돌의 route 0도 확인됐다.
- 그러나 release entry가 `preselectLimitedCourseV1`를 호출한다. 이 함수는 18개 후보 풀에서 1·2·3곳 `permutationsUpToThree`, `candidateQueue`, `continuationQueue`를 모두 생성한다. `generatedOrderedCourseCount`도 다장소 수(예: 816)를 기록한다. 이는 **실경로 호출이 없더라도** 작업 명령 2의 “2·3곳 조합·순서 변형·continuation queue를 만들거나 소비하지 않는다”와 충돌한다.

### 2-U 보완 작업 명령

1. `buildReleaseOneStopRepresentativeCourseV1`가 `preselectLimitedCourseV1`를 호출하지 않게 한다. 기존 A8/B12/continuation entry와 `preselectLimitedCourseV1`의 반환·순서·상한은 변경하지 않는다.
2. `courseV1.ts` 내부에 **release one-stop 전용의 가벼운 후보 선별 경계**를 둔다. 이 경계는 기존과 같은 representative 분류, `canPossiblyOpen`, origin/destination 공간 정렬, 18개 공간 후보 상한과 wide single 선택 규칙을 재사용할 수 있다. 단, 1곳 후보 배열만 반환하며 `permutationsUpToThree`, `ranked`, 2/3곳 `candidateCourses`, `candidateQueue`, `continuationQueue`를 생성하지 않는다.
3. release 결과 진단은 provider 후보 수·eligible 수·single candidate pool 수·분류 제외 수·wide single ID만 유지한다. 다장소 생성 수는 `0`이어야 하며, continuation/다장소 슬롯을 release 결과의 근거처럼 채우지 않는다. 기존 공통 타입의 선택 필드는 호환 목적의 빈 기본값을 쓸 수 있지만, 이를 위해 다장소 선별을 다시 호출해서는 안 된다.
4. receipt 검증 루프는 전용 single pool만 순회한다. 후보 하나당 endpoint↔candidate 두 leg만 허용하고, 실제 검증된 최대 4개(대표 1 + 대안 최대 3) 또는 신규 provider attempt 8에서 멈춘다. 16회 보충, candidate-to-candidate, continuation 생성/소비는 0이다.
5. 고정 테스트를 보완한다.
   - 18개 이상 후보 입력에서도 release diagnostics의 다장소 생성 수가 `0`이고, 반환된 모든 카드 `placeIds.length === 1`이다.
   - release entry가 기존 multi preselection/continuation을 소비하지 않는 것을 관찰 가능한 결과(생성 수 0, continuation 미존재, candidate-to-candidate receipt 0)로 고정한다.
   - 기존 2-U의 exact two-leg, 실패 후보 건너뛰기, endpoint 충돌 및 A8/B12/continuation 회귀는 계속 통과한다.
6. 수정 경계는 `src/engine/`, 순수 엔진 test, 이 작업 문서뿐이다. UI/API/DB/카탈로그/.env와 기준 정책 문서는 수정하지 않는다. 실제 외부 API 호출은 0회다.

### 수락 기준

- `npx tsx --test test/release-one-stop-verified-course.test.ts test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`, `npm run test:typecheck`, `git diff --check`를 실행해 결과를 기록한다.
- 위 조건을 만족하면 2-U를 수락하고, 그 뒤에만 UIUX가 release entry 연결 작업을 시작한다.

---

## 2026-09-02 — 2-U 보완 완료 인계

### 변경 파일

- `src/engine/courseV1.ts`: release entry의 `preselectLimitedCourseV1` 호출을 제거하고 내부 `selectReleaseOneStopCandidates`로 교체했다. 이 경계는 representative 분류, `canPossiblyOpen`, 최소 20분, origin/destination 공간 정렬, site group 중복 제거, 18개 상한과 wide single 규칙만 재사용한다. 진단의 `generatedOrderedCourseCount`는 항상 0이며 다장소 슬롯·shape·continuation을 채우지 않는다.
- `test/release-one-stop-verified-course.test.ts`: 20개 후보 fixture로 eligible 20, single pool 18, wide single 보존, 다장소 생성 0, 모든 반환 카드 1곳, continuation 미존재, candidate-to-candidate receipt 0, provider attempt 8 이하를 고정했다.
- `docs/work/recommendation-engine/release-one-stop-verified-course.md`: 보완 결과와 인계를 기존 2-U 안에 시간 순서대로 추가했다.

### 유지한 계약

- production A8, internal B12/test-only, `preselectLimitedCourseV1`, 2-Q continuation의 반환·정렬·상한·다장소 진단은 수정하지 않았다.
- release 결과는 exact 두 leg, 구조화 운영시간, 최소 체류 20분, 도착 여유를 모두 통과한 single만 대표 1개와 대안 최대 3개로 반환한다. 검증된 카드 수는 보장하지 않는다.
- 신규 provider attempt 8, adapter call 24 상한과 endpoint ID 충돌의 route 0을 유지했다. 16회 보충, 후보 간 receipt, provider fallback, 체류 연장, continuation 생성·소비는 없다.
- UI, 서비스/API, DB/migration, 카탈로그, 환경값, 제품 기준 문서와 `docs/작업조정_보드.md`는 수정하지 않았고 실제 외부 API·GPS·DB 호출은 0회다.

### 테스트 결과

- `npx tsx --test test/release-one-stop-verified-course.test.ts test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`: 57/57 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 113/113 통과.
- `npm run test:ui`: 167 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 남은 위험

- release UI는 아직 이 entry에 연결되지 않았다. 통합 수락 뒤 UIUX 역할이 대표 1개+single 대안 최대 3개, continuation 없음, 카드 수 약속 없음, 체류 분 비노출, 20~29분의 `가볍게 둘러보기` 표시 계약으로 연결해야 한다.
- 실제 Kakao receipt 품질, 위치 권한/GPS, 외부 지도 전환은 이번 순수 fixture 범위가 아니다. UI 연결 후 QA 역할이 새 internal build와 iOS 실기기에서 검증해야 한다.

---

## 2026-09-02 — 통합 수락

- release entry가 `preselectLimitedCourseV1`를 호출하지 않고 one-stop 전용 `selectReleaseOneStopCandidates`만 사용하는 것을 확인했다.
- 20개 입력에서 eligible 20, single pool 18, 다장소 생성 0, continuation/shape 슬롯 미생성, 모든 반환 결과 1곳, candidate-to-candidate receipt 0을 고정 fixture로 확인했다.
- 통합·결정 세션이 엔진 대상 회귀를 독립 재실행해 **57/57 통과**를 확인했다. UIUX가 병렬 편집 중이므로 그 중간 상태와 섞이는 전체 type/UI 검사는 반복하지 않았으며, 엔진 완료 인계에 기록된 typecheck·전체 113·UI 167(기존 skip 1) 통과 결과를 함께 수락 근거로 사용한다.
- 공개 release 계약은 대표 1개 또는 null, 검증된 서로 다른 single 대안 최대 3개, continuation 없음, provider attempt 최대 8회로 확정한다. 다음 활성 작업은 `U-RELEASE-ONESTOP-01`이며 UI 연결 뒤 통합 QA를 연다.
