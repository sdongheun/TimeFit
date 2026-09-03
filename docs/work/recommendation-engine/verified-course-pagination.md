# 2-Q — 검증 대안 이어보기·조건부 발견 엔진 계약

## 상태

수락. `DATA-MARKET-01` 전제 아래 continuation 공개 entry·초기 cursor·페이지 검증과 추가 보완 fixture를 완료했다. API-PAGE-01은 이 문서의 마지막 인계 계약만 사용해 진행한다.

## 읽을 범위

`AGENTS.md` → `docs/README.md` → `docs/작업조정_보드.md` → `docs/03_product/추천로직.md`의 1.4·1.5.1·1.6·1.10 → `docs/테스트.md` REC-21·26~29 → 이 문서. 과거 `explore-result-contract.md`는 철회된 무경로 목록의 이력이 필요할 때만 읽는다.

## 목적과 정책 경계

이전 2-P의 “대표 1개 + 무경로 장소 탐색 목록”은 **철회**됐다. 결과의 대안은 반드시 실제 경로·운영시간·최소 체류·도착 여유를 통과한 1~3곳 코스여야 한다. 2-Q는 데이터 범위(대표 190개, 공간 선별 최대 18곳), 순수 엔진과 UI/API 소유 경계를 바꾸지 않고 검증 큐와 이어보기 상태만 만든다.

## 구현 명령

1. 현재 사전 선별 뒤 생성하는 후보를 결정적 순서의 미검증 코스 큐로 만든다. 동일 ordered `stopIds`와 같은 장소 집합의 순서만 바꾼 중복은 한 번만 다루되, `A`, `A→B`, `A→B→C`처럼 **장소 수가 다른 부분집합 코스는 서로 다른 후보로 유지**한다. 18개 장소 선별은 **결과 수 상한이 아니라 공간 비용 상한**으로 그대로 유지한다.
2. 아래 공개 타입·entry 이름을 그대로 구현한다. 이 계약은 2-Q 완료 전 변경하지 않는다.

   ```ts
   export type CourseV1Continuation = Readonly<{
     version: 1;
     cursor: number;
     candidatePlaceIds: readonly string[];
     candidateSetSignature: string;
     attemptedCourseSignatures: readonly string[];
     rejectedCourseSignatures: readonly string[];
     verifiedCourseSignatures: readonly string[];
     routeReceiptKeys: readonly string[];
     stopReason?: CourseV1ContinuationStopReason;
   }>;

   export type CourseV1ContinuationStopReason =
     | 'candidate_queue_exhausted'
     | 'provider_daily_limit'
     | 'provider_unavailable'
     | 'continuation_unavailable';

   export type CourseV1ContinuationInput = CourseV1LimitedInput & {
     continuation: CourseV1Continuation;
   };

   export type CourseV1ContinuationResult = Readonly<{
     appendedCourses: readonly VerifiedCourseV1[];
     continuation: CourseV1Continuation;
     pageState: 'more_available' | 'exhausted' | 'provider_unavailable' | 'continuation_unavailable';
     outcomeReasons: readonly CourseV1OutcomeReason[];
     diagnostics: CourseV1LimitedDiagnostics;
   }>;

   export async function continueLimitedRepresentativeCourseV1(
     input: CourseV1ContinuationInput,
   ): Promise<CourseV1ContinuationResult>;
   ```

   `CourseV1ContinuationInput`은 첫 계산과 같은 `now·origin·destination·remainingMin·arrivalBufferMin·provider·routes·receiptRoutes`를 **호출 때 다시 받는 방식**이다. 엔진은 UI의 `RecommendationSession`을 import하지 않는다. continuation은 독립 재실행 토큰이 아니며, `candidateSetSignature`과 route receipt key는 좌표를 복원할 수 없는 opaque 값이다. continuation에는 위치 정밀값·사용자 ID·입력 시각 원문·provider 객체·함수·API key·비직렬 runtime context를 넣지 않는다.
3. 첫 요청은 새 provider attempt 최대 8회로 대표 포함 검증 코스 4개를 목표로 한다. 정확히 4개를 얻었거나 큐가 끝났거나 전역 provider/daily-limit 실패면 멈춘다. 8회 뒤 검증 코스가 4개 미만이고 **같은 사전 선별 큐에 아직 시도하지 않은 후보가 있을 때만** 전체 최대 16회까지 보충한다. 목표 수를 채우기 위한 새 후보 생성·무한 호출은 금지한다.
4. 이어보기는 `continueLimitedRepresentativeCourseV1({ ...originalInput, continuation })`만 사용한다. UI 컨테이너가 기존 메모리의 `RecommendationSession`으로 `originalInput`을 다시 조립하고, 같은 대표 candidate provider·카탈로그로 `candidatePlaceIds`를 로컬 재수화한다. 재수화한 ID 집합 또는 `candidateSetSignature`이 continuation과 다르거나 ID 하나라도 없으면 **route adapter 호출 0회**로 `pageState: 'continuation_unavailable'`을 반환한다. API 서버는 continuation·추천 세션·후보 큐를 저장하거나 재수화하지 않는다. 이미 보인 결과를 재정렬·교체하지 않고 다음 미검증 후보만 새 provider attempt 최대 8회 검증한다. 새 검증 코스는 최대 3개를 `appendedCourses`로 반환하며, UI가 기존 목록 뒤에 붙일 수 있어야 한다. 큐 소진·전역 한도·provider 실패는 위 `pageState`와 typed 종료 reason으로 반환한다.
5. route cache hit, 같은 세션의 in-flight/receipt 재사용은 새 provider attempt가 아니다. 이미 탈락한 course/segment도 다시 호출하지 않는다. Kakao 실패·한도는 TMAP·ODsay·근사값 fallback으로 우회하지 않는다.
6. 후보 우선순위는 첫 근거리 1곳만 연속 소진하지 않는다. 유효한 N1을 먼저 시도한 뒤 가능한 N2를 초기 큐에 교차 배치하고, N3은 낮은 우선순위지만 큐에 남긴다. `A`, `A→B`, `A→B→C`는 시간 적합성이 있으면 모두 검증 대상이며, 대표는 1~2곳을 우선하고 3곳은 대안에서 동등하게 노출한다. 3곳을 자동으로 대표로 밀어 올리거나, 같은 장소·같은 순서의 체류시간 변형을 별도 코스로 만들지 않는다.
7. `conditional_visit` 데이터는 대표/검증 대안 후보 큐에 절대 넣지 않는다. UI의 명시 확인 뒤 별도 조건부 수동 계산 entry가 필요하면 운영시간 확인 상태를 입력·출력 모두에 유지하고, 성공해도 `verified`나 대표 후보로 바꾸지 않는다. 카카오맵 화면의 운영시간을 읽거나 추정하지 않는다.

## 필수 고정 fixture·테스트

- 6개 생활권 × 짧음/중간/김 × 복귀/도착지 중 기존 기준 fixture를 재사용해 첫 8회, 조건부 16회 진입, 8회에서 정확히 4개여서 16회 미진입을 검사한다.
- 후보가 4개보다 적어도 큐가 끝났을 때 추가 호출 0, candidate 없음·운영 종료·global limit·provider failure의 typed reason을 검사한다.
- 이어보기 두 페이지에서 각 페이지 새 attempt ≤8, 새 코스 ≤3, 기존 순서 불변, 전체 표시 개수 상한 없음, shown/rejected signature 재호출 0, cache receipt 재사용을 검사한다. continuation 직렬값에 lat/lon·사용자 ID·Date·함수/provider 객체가 없고, `candidateSetSignature` 불일치·후보 ID 누락에서는 `continuation_unavailable`과 route 호출 0을 반환하는 fail-closed fixture를 추가한다.
- N1/N2/N3, 1/2/3곳, 권장/짧게 가능, 동일 sequence/순서만 바꾼 집합 중복 차단과 `A`·`A→B`·`A→B→C` 부분집합 보존, 조건부 후보 대표 제외를 고정 fixture로 검사한다.
- 기존 2-P 무경로 탐색 반환이 공개 결과에 남지 않고, API/React 없이 순수 엔진 entry만 테스트한다.

## 수정 범위와 금지

`src/engine/`, 엔진 순수 테스트, 이 작업 기록만 수정한다. `src/ui/`, API client/proxy, 데이터 카탈로그, 제품 기준 문서, 보드는 수정하지 않는다. 기존 8/16 quota 값은 UI 문구로 노출하지 않는다.

## 완료 인계

변경 파일·continuation 공개 타입·기존 호환 경계·실행 테스트·수치, API-PAGE-01에 넘길 입력/출력 계약, 남은 실기기 위험을 이 문서 끝에 기록한다.

---

## 2026-08-31 — 통합 검토: 2-Q 보완 지시

### 현재 확인 사실

- `src/engine/courseV1.ts`에는 `CourseV1Continuation*` **타입만** 추가됐다. 필수 `continueLimitedRepresentativeCourseV1` 함수 구현과 `src/engine/index.ts` export가 없다.
- 첫 계산의 `CourseV1LimitedResult`에 continuation이 없으므로 UI가 안전한 이어보기 참조값을 받을 방법이 없다.
- receipt 기본 경로는 여전히 A8 단일 evaluation이며, `8회 → 검증 코스 4개 미만·동일 큐 잔여일 때만 전체 16회` stage 전환을 구현하지 않았다. 기존 B12/12·16 fixture 비교는 internal 관찰용이므로 production 기본을 대신하지 않는다.
- `buildReceiptBudgetedRepresentativeCourseV1`와 `selectNonNestedCourseV1`은 `hasNestedPlaceSet`으로 `A`와 `A→B` 같은 부분집합을 제거한다. 이는 현행 1.5.1의 “장소 수가 다른 부분집합은 서로 다른 선택지”와 충돌한다.
- continuation/이어보기 이름의 고정 fixture가 없다. 따라서 현 통과 테스트는 기존 A8·체류 범위 회귀만 증명한다.

### 반드시 수행할 보완

1. 첫 계산의 공개 결과가 직렬화 가능한 `CourseV1Continuation`을 반환하게 하고, barrel에서 `CourseV1Continuation*` 타입과 `continueLimitedRepresentativeCourseV1`을 export한다. legacy route-only 호출자의 호환을 깨지 말되, continuation을 만들 수 없는 경로는 `undefined`를 조용히 쓰지 말고 결과 상태/호출 경계를 명시한다.
2. `continueLimitedRepresentativeCourseV1({ ...originalInput, continuation })`을 실제 구현한다. 현재 provider의 representative 후보에서 `candidatePlaceIds`를 다시 만들고 `candidateSetSignature`을 비교한다. ID 누락·집합/signature 불일치면 route/receipt 호출 **0회**, `pageState: 'continuation_unavailable'`, 빈 `appendedCourses`를 반환한다. continuation에 좌표·Date·함수·provider 객체를 넣지 않는다.
3. 18개 공간 선별 안에서 결정적 전체 후보 큐를 보존한다. 동일 ordered stop sequence 및 순서만 다른 같은 장소 집합은 한 후보로 합치되, `A`, `A→B`, `A→B→C`는 제거하지 않는다. 따라서 `hasNestedPlaceSet` 기반의 검증 전 skip·결과 selection 차단을 동일 집합 판정으로 교체하고, 부분집합 보존 fixture를 추가한다. 첫 페이지의 소수 N1/N2 슬롯은 우선순위일 뿐 이어보기 큐의 총량을 잘라서는 안 된다.
4. 첫 계산은 새 provider attempt 8회 후 **검증 코스가 4개 미만이고 같은 큐의 미시도 후보가 남을 때만** 동일 receipt cache를 유지해 전체 16회까지 계속 검증한다. 정확히 4개·큐 소진·provider daily/global stop이면 16회를 열지 않는다. 이어보기 한 번은 cursor 이후의 미시도 후보만 새 attempt 최대 8회, 새 검증 코스 최대 3개로 제한한다. 이미 attempted/rejected/verified signature와 receipt cache hit는 새 attempt가 아니다.
5. `conditionalVisit`/`conditional_more`는 representative provider 결과만 소비하는 이 큐에 넣지 않는다. 2-Q의 수정 범위 밖인 UI/API/data를 바꾸지 않는다.

### 필수 통과 증거

- 첫 결과: 8회 종료, 조건부 8→16 진입, 정확히 4개라 16회 미진입, 큐 소진·provider stop에서 추가 호출 0.
- 이어보기 두 페이지: 페이지당 새 attempt ≤8·새 코스 ≤3, 기존 결과 불변, shown/rejected 재검증 0, cache reuse는 attempt 0, 총 결과는 3개 고정 상한 없음.
- `A`/`A→B`/`A→B→C` 보존과 순서만 다른 같은 집합 중복 0.
- continuation JSON 금지 필드 검사, provider 후보 ID 누락과 signature 불일치의 `continuation_unavailable`·route 0.
- `npm run test:typecheck`, 관련 순수 엔진 테스트, `git diff --check` 결과를 완료 인계 네 항목으로 기록한다.

---

## 2026-08-31 — 2-Q 보완 구현 완료 인계

### 1. 변경 파일과 목적

- `src/engine/courseV1.ts`: receipt 기반 첫 계산을 2-Q 전체 후보 큐/continuation 검증으로 연결했다. 18개 공간 후보 안에서 같은 장소 집합의 순서 변형은 하나로 합치고, 1·2·3곳 부분집합은 모두 유지한다. 첫 계산은 8회 뒤 4개 미만이며 동일 큐가 남을 때만 16회까지 보충하고, `continueLimitedRepresentativeCourseV1`은 다음 미시도 후보에서 페이지당 새 provider attempt 8회·새 코스 3개를 제한한다.
- `src/engine/index.ts`: continuation 타입과 이어보기 entry를 barrel에 공개했다.
- `test/course-v1-pagination.test.ts`: 부분집합/순서중복, JSON 안전 continuation, signature 불일치 route 호출 0, 이어보기 8/3 상한을 고정 fixture로 추가했다.

### 2. 유지한 공개 계약·정책 경계

- route-only legacy `buildLimitedRepresentativeCourseV1` 입력/출력은 유지한다. continuation은 receipt adapter가 있는 검증 경로에서만 생성하며, route-only 호출은 continuation을 만들 수 없는 경계로 남긴다.
- continuation에는 후보 ID·opaque signature·코스 signature·opaque receipt key만 저장한다. 좌표, 사용자 ID, 원문 시각, `Date`, provider/adapter/함수/API key는 저장하지 않는다.
- 재수화 provider의 18개 후보 ID 순서 또는 signature가 하나라도 다르면 receipt/route adapter를 호출하지 않고 `continuation_unavailable`으로 fail-closed한다. conditional 분류는 기존 representative provider 사전 선별에서 계속 제외된다.
- UI/API/data/보드와 제품 정책 문서는 수정하지 않았다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/course-v1-pagination.test.ts`: 3/3 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 140 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- API-PAGE-01은 UI 컨테이너가 같은 클라이언트 메모리 `RecommendationSession`의 original input과 provider/route ports를 다시 조립해 `continueLimitedRepresentativeCourseV1`만 호출해야 한다. continuation을 API/DB에 저장하거나 독립 재실행 토큰으로 취급하면 안 된다.
- 현재 receipt cache는 단일 엔진 호출 내에서만 실제 receipt를 보유한다. 페이지 간에는 adapter의 session/cache `reused` receipt를 사용해 새 provider attempt가 0인지 보장해야 하며, UI/API 구현 시 그 adapter 계약의 통합 fixture가 필요하다.
- 기존 2-L tier diagnostics는 internal B12/test-only 관찰 경로에 남아 있다. 공개 기본 경로는 2-Q pagination queue를 사용하므로 UI는 tier 세부값을 제품 계약으로 사용하면 안 된다.

---

## 2026-08-31 — 통합 재검토: 2-Q 추가 보완 필요

### 수락하지 않은 근거

`npm run test:typecheck`과 새 `test/course-v1-pagination.test.ts` 3건은 통과했지만, 아래 순수 엔진 회귀를 함께 실행하면 **43건 중 8건 실패**했다.

```text
npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts
```

- `REC-26`, `L-01~04`, `M-01`, `M-02~04`가 기본 공개 entry의 이전 A8/tier 결과를 그대로 기대해 실패한다. 2-Q로 대체된 production 정책과 internal B12/test-only tier 관찰을 분리하지 않은 상태다.
- 더 중요한 실제 문제로, `verifyContinuationPage`가 **로컬 페이지 attempt 상한**(첫 16회 또는 이어보기 8회)에 도달했을 때도 `provider_daily_limit`을 기록한다. 이는 Kakao 일일 한도/전역 실패가 아닌 정상적인 제품 예산 소진이다. 이 상태는 사용자가 다음 `더 보기`로 큐를 계속 검증할 수 있는 경우에도 UI에 provider 불가로 표시하게 만든다.
- 새 2-Q fixture에는 첫 8회 뒤 조건부 16회 진입, 정확히 4개를 얻어 16회 미진입, 전역 provider stop과 페이지 예산 소진의 구분이 없다. 따라서 핵심 정책을 아직 증명하지 못한다.

### 보완 명령

1. `verifyContinuationPage`에서 페이지/첫 결과의 **로컬 attempt budget 도달**을 `provider_daily_limit` 또는 `provider_unavailable`로 기록하지 않는다. 큐가 남으면 `stopReason`을 비워 `pageState: 'more_available'`로 반환하고, 다음 사용자 `더 보기`가 다음 cursor에서 최대 8회 새 검증을 시작할 수 있게 한다. 실제 adapter가 전역 한도/제공사 불가를 typed `unavailable`으로 반환한 경우만 provider 종료 상태를 쓴다.
2. 2-Q로 정책이 대체된 기존 테스트는 삭제하지 말고 의도를 보존해 옮긴다.
   - 이전 A8 고정 예산 assertion은 test-only A8 evaluation entry를 명시 호출해 internal 비교 fixture로 유지한다.
   - N1/N2/W/T tier 순서·diagnostics를 보는 `L-*`, `M-*`는 public 기본 entry가 아니라 `buildLimitedRepresentativeCourseV1ForTestOnlyReceiptEvaluation` 또는 고정 B12 entry를 호출한다.
   - public 기본 entry에는 별도 2-Q fixture를 추가해 8→조건부 16·첫 4개 목표·cursor/page 8·부분집합 보존만 검증한다.
3. 아래 새 fixture를 추가한다.
   - 8회에서 4개 미만 + 큐 잔여 → 첫 결과의 새 provider attempt가 9~16이며 continuation cursor가 전진한다.
   - 정확히 4개 → 새 attempt가 8 이하이고 16회 stage 미진입.
   - 첫 16회 또는 이어보기 8회 예산으로 멈췄지만 큐 잔여 → `pageState: 'more_available'`, provider 불가 문구/stopReason 없음.
   - 실제 typed provider unavailable → `pageState: 'provider_unavailable'`, 이후 cursor 행동을 명시한다.
4. 위 변경 뒤 `npm run test:typecheck`, `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`, `npm test`, `npm run test:ui`, `git diff --check`를 모두 통과시킨다. 완료 인계에는 각 실행 수와 production 기본/public test-only 경계를 다시 기록한다.

---

## 2026-08-31 — 2-Q 추가 보완 완료 인계

### 1. 변경 파일과 목적

- `src/engine/courseV1.ts`: local first/page attempt 또는 adapter-call 예산이 끝난 경우를 provider 일일 한도와 구분했다. 큐가 남으면 stop reason 없이 `more_available`을 유지하며, adapter가 실제 typed `unavailable`을 반환한 경우에만 provider 종료를 남긴다. provider 종료 continuation은 이후 호출에서도 receipt adapter를 다시 호출하지 않는다.
- `test/course-v1-pagination.test.ts`: 8→16 조건부 보충, 정확히 4개일 때 16회 미진입, 로컬 예산 소진의 `more_available`, typed provider unavailable을 고정했다.
- `test/course-v1-limited-integration.test.ts`: 기존 A8 및 N1/N2/W/T tier expectation은 삭제하지 않고 `buildLimitedRepresentativeCourseV1ForTestOnlyReceiptEvaluation`의 명시적 internal A8 fixture로 이전했다. 공개 기본 entry는 2-Q pagination 정책만 검증한다.

### 2. 유지한 공개 계약·정책 경계

- 공개 `buildLimitedRepresentativeCourseV1`의 receipt 경로는 2-Q continuation queue와 8→조건부 16 정책을 계속 사용한다. A8/B12 tier와 diagnostics는 production 결과 계약이 아닌 test-only/internal 관찰 경계다.
- 로컬 예산 소진은 제공사 장애가 아니므로 `provider_daily_limit`/`provider_unavailable`을 만들지 않는다. 실제 adapter typed unavailable만 provider 종료이며, 그 continuation은 cursor를 유지하고 재호출해도 새 route receipt를 요청하지 않는다.
- continuation의 JSON 안전성, provider 재수화 signature fail-closed, conditional 후보 제외, UI/API/data/보드 미수정 경계는 유지했다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`: 46/46 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 140 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- API-PAGE-01은 public pagination entry의 `more_available`과 typed provider 종료를 구분해 화면/API 계약으로 옮겨야 한다. tier diagnostics나 test-only entry는 사용하면 안 된다.
- 페이지 간 실제 receipt 재사용은 API adapter가 `reused: true, newProviderAttemptCount: 0`으로 제공해야 한다. 엔진은 continuation에 receipt 본문을 저장하지 않으므로, 이 점은 API 계약/통합 fixture에서 계속 검증해야 한다.
