# 2-Y — 최대 2곳 제한 조립 엔진과 누적 예산 상태

## 담당과 병렬 실행

- 담당: 추천 엔진 세션
- 상태: 작업 가능
- 병렬 가능: `API-TWO-STOP-01`, `U-TWO-STOP-01`, `QA-TWO-STOP-01`
- 단일 작성자: `src/engine/types.ts`, `src/engine/index.ts`, 새 pair-only 엔진 모듈과 엔진 전용 순수 테스트

작업 시작 시 `AGENTS.md`, `docs/README.md`, `docs/03_product/추천로직.md`, `docs/work/integration-decision/two-stop-limited-assembly.md`, 이 파일만 먼저 읽는다. 과거 archive 전체와 unrelated work 파일을 읽지 않는다. 현재 primitive 확인이 필요할 때만 `release-one-stop-verified-course.md`, `release-one-stop-pagination.md`, `release-two-stop-readiness-audit.md`의 공개 symbol 표를 참고한다.

## 목적과 사용자 관찰

현재 release entry는 one-stop만 검증한다. 사용자는 검증된 장소 A를 고른 경우에만 A와 함께 시간 안에 갈 수 있는 B를 보고 최대 2곳 코스를 선택하려 한다. 과거 mixed 1~3곳 queue를 production에 다시 연결하지 않고 pair-only entry를 분리해야 한다.

성공하면 다음이 관찰돼야 한다.

1. A 선택 직후 exact 성공 B가 하나씩 전달된다.
2. B마다 A→B와 B→A를 모두 검증하고 더 짧은 유효 순서를 반환한다.
3. 기본 3개 목표·부족 허용, 누적 최대 6개, route provider attempt session 최대 36을 넘지 않는다.
4. 취소·재선택 뒤 늦은 결과가 현재 선택에 섞이지 않고 예산이 초기화되지 않는다.

## 확정 계약과 교체 이력

- 이전 mixed `buildLimitedRepresentativeCourseV1`/`continueLimitedRepresentativeCourseV1`는 1·2·3곳, 자동 보충, mixed continuation을 함께 포함하므로 이 작업의 release entry로 재사용하지 않는다.
- release one-stop의 후보 선별·실제 two-leg 검증·single continuation은 유지한다.
- 새 흐름은 자동 pair 추천이 아니라 one-stop A를 입력받는 pair-only 조립이다.
- 방문 순서는 사용자가 고치지 않는다. 두 exact 순서 중 세 leg 이동합이 짧은 것을 쓰며 동률은 `O→A→B→D`다.
- A/B 각 최소 20분, 도착별 구조화 운영시간, 최종 도착 여유를 통과해야 한다. 권장 체류는 우선순위/상태이고 max 체류로 남는 시간을 채우지 않는다.

## 공개 entry·타입

다른 역할이 이름을 추측하지 않도록 다음 export를 고정한다. 기존 export는 삭제·변경하지 않는다.

- `beginReleaseTwoStopSelectionV1`
- `continueReleaseTwoStopSelectionV1`
- `ReleaseTwoStopSelectionInput`
- `ReleaseTwoStopSelectionContinuation`
- `ReleaseTwoStopSelectionResult`
- `ReleaseTwoStopProgressEvent`
- `ReleaseTwoStopAttemptLedger`

타입의 필수 의미는 다음과 같다. 현재 엔진 관례에 맞춰 필드 이름을 세분화할 수 있으나 이 의미를 누락하거나 UI 전용 문자열을 넣지 않는다.

### 시작 입력

- 기존 `CourseV1LimitedInput`과 동일한 now/origin/destination/remainingMin/arrivalBuffer/provider/route receipt port
- 정확히 한 stop이며 현재 입력에서 검증된 `firstCourse` snapshot
- 첫 결과와 첫 장소 목록 더보기에 이미 사용한 attempt를 나타내는 ledger
- 현재 UI request epoch를 opaque 문자열로 되돌려 줄 `requestId`
- runtime 전용 `onProgress?`와 선택적 abort signal. callback/signal은 continuation이나 navigation에 저장하지 않는다.

`firstCourse`의 stop이 1개가 아니거나 현재 provider의 candidate ID로 재수화되지 않거나 입력 signature가 다르면 route 호출 0으로 typed rejection한다. 임의 place ID를 새 A로 승격하지 않는다.

### 진행 이벤트

- `started`: A와 후보 queue가 유효함
- `candidate_verified`: exact 2곳 course 한 개와 현재 누적 receipt
- `candidate_rejected`: 사용자에게 raw place/route를 노출하지 않는 집계 reason
- `completed`: page state, continuation, 누적 ledger

모든 이벤트는 `requestId`와 `firstPlaceId`를 포함한다. 한 candidate의 양방향 검증 도중 중간 순서를 `가능`으로 내보내지 않고 최종 선택 순서가 확정된 뒤 `candidate_verified`를 한 번만 보낸다. 이미 전달한 course 순서는 완료 시 재정렬하지 않는다.

### 결과와 continuation

- 상태는 최소 `verified | partial | no_candidate | exhausted | unavailable | continuation_unavailable`을 구분한다.
- 시작 page는 새 exact B 최대 3개, 전체 branch는 누적 최대 6개다.
- continuation에는 version, firstPlaceId, cursor, ordered candidate IDs/signature, attempted/rejected/verified pair signature, cumulative attempt ledger, opaque route receipt keys와 typed terminal reason만 둔다.
- continuation에 좌표·사용자 ID·입력 시각 원문·provider/함수/AbortSignal/API key를 넣지 않는다.
- 이어보기는 original input을 다시 받고 현재 provider의 후보를 ID로 재수화한다. signature 불일치는 route 0으로 종료한다.

## 후보·순서 검증 구현 순서

1. `selectSpatialCandidatePool`과 대표/운영/관계 primitive를 재사용해 최대 18개 결정적 pool을 만든다.
2. A를 제외하고 동일 place ID·동일 siteGroup·구조화 운영 불가·두 최소 체류와 도착 여유만으로도 불가능한 B를 route 0으로 제거한다. 직선/공간 값은 검증 순서를 정할 뿐 exact 가능 판정에 사용하지 않는다.
3. B마다 `O→A→B→D`와 `O→B→A→D`를 각각 `verifyCourseWithReceipts`와 같은 정확 규칙으로 완결한다. 첫 순서 성공만으로 반대 순서를 생략하지 않는다.
4. 두 순서 중 유효 1개면 그것을, 둘 다 유효면 세 leg `route.min` 합이 작은 것을 선택한다. 합이 같으면 A-first를 선택한다.
5. place set이 같은 역순을 두 카드로 반환하지 않는다. 선택된 B place ID도 branch 결과에서 한 번만 나타난다.
6. 목표 3개, 현재 stage 예산 소진, candidate 소진, terminal unavailable 중 먼저 도달한 조건에서 멈춘다.

## 누적 예산 ledger

- 전체 hard cap: 36 new route provider attempts
- 최초 one-stop: 최대 8
- A 선택 자동 pair stage: 최대 16을 보호
- 명시 확장 shared pool: 최대 12. A 선택 전 one-stop page 사용량과 A 선택 후 pair page 사용량의 합
- 상세 geometry connector 6은 엔진 추천 ledger에 넣지 않고 별도 소비자 계약으로 남긴다.

엔진은 각 receipt의 `newProviderAttemptCount`만 합산하고 cache/session/in-flight reuse 0을 유지한다. 이미 시작된 attempt는 abort/cancel 뒤에도 ledger에서 빼지 않는다. 시작/continue entry마다 임의로 새 16/12를 만들지 않고 전달된 ledger와 continuation을 검증한다. 숫자가 음수·NaN·상한 초과·signature 불일치면 route 0으로 fail-closed한다.

기존 one-stop page가 shared pool을 소비할 수 있도록 기존 release page entry를 깨뜨리지 않는 별도 ledger adapter 또는 optional budget 입력을 설계한다. optional 값이 없는 현재 production caller는 REC-31의 기존 page 최대 8 동작을 그대로 유지해야 한다. 새 two-stop-enabled caller에서만 shared 12의 남은 값 이하로 제한한다.

## 취소·재선택 경계

- UI 취소 자체는 엔진 entry를 호출하지 않는다.
- abort signal은 미시작 작업을 중단하는 최적화일 뿐 비용 환불 수단이 아니다.
- 같은 A 재선택 시 이미 검증한 branch continuation/result를 UI session이 전달하면 exact 결과와 receipt cache를 재사용하고 중복 candidate provider attempt를 만들지 않는다.
- 다른 A는 attempted pair signature를 A별 namespace로 분리하되 cumulative ledger는 공유한다.
- 예산이 없으면 route 0으로 `exhausted`를 반환하고 검증된 firstCourse를 없애지 않는다.

## typed 부족·실패

최종 사용자 문구를 만들지 말고 최소 다음 reason을 안전 enum으로 반환한다.

- `no_nearby_second_candidate`
- `insufficient_time_for_two_stops`
- `second_place_closed`
- `no_exact_route`
- `provider_unavailable`
- `store_unavailable`
- `attempt_limit_reached`
- `continuation_unavailable`

raw provider 오류·좌표·내부 budget 숫자를 reason 문자열에 넣지 않는다. 한 B의 일반 no-route는 다음 B를 계속 확인할 수 있지만 provider/store/limit처럼 현행 adapter에서 terminal로 분류한 상태는 page를 중단한다.

## 필수 failure-first fixture

새 엔진 전용 테스트 파일을 만들고 기존 QA/UI/API 테스트 파일을 수정하지 않는다.

1. A-first만 유효, B-first만 유효, 둘 다 유효하며 A-first 빠름, B-first 빠름, 이동합 동률 A-first
2. 두 운영시간 중 A/B 각각 닫힘, 두 장소 최소 20분 시간 초과, final buffer 경계
3. exact success 점진 `1→2→3`, success 0/1/2 종료, 누적 결과 6 상한
4. initial 8 + auto 16 + shared 12 = 36 경계와 37번째 provider attempt 0
5. one-stop page가 shared 8을 쓴 뒤 pair more에 4만 남는 경우
6. cache/session reuse는 adapter call이 있어도 attempt 0, 동일 directed leg 중복 요청 0
7. A 취소를 가정한 abort 뒤 이미 시작된 attempt 유지, stale requestId가 별도 event로 식별됨
8. 같은 A 재선택 result reuse, 다른 A branch 분리, ledger 공통
9. malformed/tampered continuation·다른 provider·다른 input signature에서 route 0
10. 3곳 생성 0, 조건부 candidate 0, per-candidate live place API 0
11. 기존 release one-stop initial/page 결과·호출량 snapshot 불변

## 검증 명령과 합격값

- 새 2-Y 순수 테스트
- `npx tsx --test test/release-one-stop-verified-course.test.ts test/release-one-stop-pagination.test.ts`
- 관련 기존 `course-v1` 순수 테스트
- `npm run test:typecheck`
- `git diff --check`

실제 Kakao/Supabase/GPS/Simulator/실기기 호출은 0회다. 전체 `npm test`는 다른 세션이 동시에 수정 중이면 이 작업 완료 판정으로 강제하지 않고 Wave 2 통합 게이트에 남긴다.

## 수정 금지

- `src/ui/`, `App.tsx`, navigation
- `src/services/`, Edge Function, migration, data/catalog, `.env*`
- `docs/03_product/*`, `docs/테스트.md`, `docs/작업조정_보드.md`, 다른 역할 문서
- production one-stop caller 활성화, 3곳, 자유 장바구니, 사용자 순서 편집

## 완료 인수인계

이 문서 아래에 변경 파일/유지 계약/테스트 결과/남은 위험의 네 항목을 기록한다. 각 공개 export와 상태·attempt 표, 실제 테스트 수를 적는다. 기준을 충족하지 못하면 완료로 쓰지 말고 막힌 공개 계약과 재현 fixture를 남긴다. commit·push는 사용자가 요청하기 전 수행하지 않는다.

---

## 2026-09-03 완료 인계

### 1. 변경 파일과 변경 목적

- `src/engine/twoStopSelectionV1.ts`
  - one-stop A를 입력받는 pair-only 엔진을 새 모듈로 분리했다.
  - 아래 공개 export를 구현했다.
    - `beginReleaseTwoStopSelectionV1`
    - `continueReleaseTwoStopSelectionV1`
    - `ReleaseTwoStopSelectionInput`
    - `ReleaseTwoStopSelectionContinuation`
    - `ReleaseTwoStopSelectionResult`
    - `ReleaseTwoStopProgressEvent`
    - `ReleaseTwoStopAttemptLedger`
  - A-first/B-first를 모두 exact 검증하고 세 leg 이동합이 작은 유효 순서를 선택한다. 동률은 A-first다.
  - exact 성공은 완료 순서대로 `candidate_verified`를 한 번씩 전달하며 완료 시 재정렬하지 않는다.
  - continuation에는 장소 ID·opaque signature·cursor·검증 상태·opaque receipt key·ledger·typed stop reason만 둔다. 입력 좌표·시각 원문·provider·callback·signal은 넣지 않는다.
- `src/engine/courseV1.ts`
  - 새 pair 모듈이 현행 one-stop 후보 선별·운영시간·체류·receipt 정규화 정책을 복제하지 않도록 barrel 비노출 내부 재사용 함수만 추가했다.
  - `continueReleaseOneStopRepresentativeCourseV1`에 선택적 `pageProviderAttemptLimit: 0..8`을 추가했다. 값이 없으면 기존 8회이며, two-stop enabled session만 shared 12 잔여를 제한할 수 있다. 잘못된 값은 route 0으로 `continuation_unavailable`이다.
- `src/engine/index.ts`
  - 위에서 고정한 2-Y 공개 entry/type 7개만 barrel에 추가했다. 내부 재사용 함수는 barrel에 노출하지 않았다.
- `test/release-two-stop-selection.test.ts`
  - 2-Y 전용 failure-first 순수 fixture 15건을 추가했다. 양방향 선택, 운영시간·체류·buffer, 점진 1→2→3, 부족 0/1/2, 누적 6, 실제 8+16+12 ledger 소비, 37번째 호출 0, shared 잔여 4, reuse 0 attempt, abort 비환불, stale requestId, 같은 A reuse, 다른 A namespace, tamper/provider/input 불일치, conditional·3곳·live place API 0, typed terminal reason, one-stop optional page budget을 고정했다.
- `docs/work/recommendation-engine/two-stop-limited-assembly.md`
  - 이 완료 인계를 추가했다.

### 2. 유지한 공개 계약·정책 경계

- production one-stop caller와 일반 사용자 entry는 활성화하지 않았다. 기존 initial/page의 기본 신규 attempt 상한은 각각 8회로 유지된다.
- pair branch의 ledger는 다음과 같다.

| 구간 | hard cap | 검증 근거 |
| --- | ---: | --- |
| 최초 one-stop | 8 | 입력 ledger가 `0..8`만 허용 |
| A 선택 자동 pair | 16 | begin은 기존 소비량을 뺀 잔여만 사용 |
| 명시 확장 shared | 12 | one-stop page와 pair continue가 공유하며 단조 증가만 허용 |
| session 신규 route provider attempt | 36 | 세 구간 합과 total이 다르거나 36 초과면 route 0 |
| pair 결과 | 기본 새 성공 최대 3, 누적 최대 6 | begin/continue와 continuation `verifiedCount`에서 함께 제한 |

- cache/session/in-flight reuse의 `newProviderAttemptCount=0`은 ledger를 소비하지 않는다. abort 뒤 이미 반환된 신규 attempt는 ledger에서 빼지 않는다.
- 같은 A의 유효한 result/continuation 재사용은 route 0이며, 다른 A는 first-course/pair signature namespace가 분리되고 전달된 session ledger는 초기화하지 않는다.
- `conditional_more`, 동일 place/siteGroup, endpoint와 같은 후보, 3곳, 자유 장바구니, 사용자 순서 편집은 pair branch에 들어오지 않는다. 후보별 live place API도 없다.
- typed failure는 `no_nearby_second_candidate`, `insufficient_time_for_two_stops`, `second_place_closed`, `no_exact_route`, `provider_unavailable`, `store_unavailable`, `attempt_limit_reached`, `continuation_unavailable`만 반환한다.
- `src/ui/`, `App.tsx`, navigation, `src/services/`, Edge, DB/migration, data/catalog, 환경값, `docs/03_product/*`, `docs/테스트.md`, `docs/작업조정_보드.md`는 이 작업에서 수정하지 않았다.

### 3. 실행한 테스트와 결과

- failure-first 최초 실행: `npx tsx --test test/release-two-stop-selection.test.ts` — 공개 entry 부재로 **0/1, 예상 실패** (`beginReleaseTwoStopSelectionV1 is not a function`).
- 최종 2-Y 순수 fixture: 같은 명령 — **15/15 성공**.
- 관련 one-stop/course-v1 회귀: `release-one-stop-verified-course`, `release-one-stop-pagination`, `course-v1`, `course-v1-pagination`, `course-v1-limited-integration` — **70/70 성공**.
- UI의 공개 2-Y adapter 소비 계약: `npx tsx --test test/ui/two-stop-selection.test.ts` — **11/11 성공**.
- `npm run test:typecheck` — 성공.
- `node --test --test-reporter=dot test` — **117/117 성공**.
- `npm run test:ui` — **216 성공 / 실패 0 / 기존 skip 1**. 최초 sandbox 실행은 tsx IPC socket `EPERM`이어서 권한 승인된 동일 명령으로 재실행해 통과했다.
- `git diff --check` — 성공.
- 실제 Kakao/Supabase/GPS/Simulator/실기기 호출 — **0회**.

### 4. 다음 결정·위험·재현 조건

- `API-TWO-STOP-01`이 실제 adapter에서 public A↔B store, private/public scope, receipt attempt/reuse, abort 비환불을 계약 fixture로 수락해야 한다. `store_unavailable`이면 이 엔진은 terminal로 중단하며 one-stop fallback을 유지한다.
- `U-TWO-STOP-01`의 session port가 최초 one-stop diagnostics와 one-stop 더보기 사용량을 같은 `ReleaseTwoStopAttemptLedger`에 누적하고, one-stop page에는 shared 잔여 이하의 `pageProviderAttemptLimit`을 전달해야 한다. ledger를 줄이거나 total과 세 구간 합이 다르면 continuation은 route 0으로 닫힌다.
- pair continuation은 실제 receipt 본문을 저장하지 않는다. 페이지 사이 partial directed leg 재사용은 adapter session/cache가 `reused: true`, `newProviderAttemptCount: 0`을 지키는 것에 의존한다.
- 결과 3·6개는 목표/상한이지 보장이 아니다. 양방향 검증 중 stage 예산이 끝나면 같은 candidate cursor에서 멈추며 다음 명시 continue에서 adapter cache를 재사용해 완결해야 한다.
- 상세 geometry connector 최대 6은 이 추천 ledger 밖의 API/UI 소비자 계약이다. 이번 엔진은 connector를 호출하거나 추천 시간·순위에 합산하지 않는다.
- production 활성화는 2-Y 단독 완료가 아니라 `API-TWO-STOP-01`, `U-TWO-STOP-01`, `QA-TWO-STOP-01` 합동 자동 게이트 이후 결정해야 한다.

## 2026-09-03 통합·결정 검토

- **판정:** `2-Y` 엔진 모듈은 수락한다. 일반 사용자 활성화는 수락하지 않는다.
- 통합 세션이 `test/release-two-stop-selection.test.ts`와 UI/geometry 관련 테스트를 함께 재실행해 총 **40/40** 통과를 확인했다.
- 출시 UI의 120분 입력 상한은 그대로다. 엔진의 기존 `CourseV1LimitedInput` 180분 호환 범위와 180분 운영시간 fixture는 사용자 입력 상한을 확장한 것으로 해석하지 않는다. production composition은 121분 이상을 이 entry에 전달하면 안 된다.
- pair 엔진은 아직 `ResultsScreen`, `CourseConfirmScreen`, `App.tsx`에서 호출되지 않는다. `API-TWO-STOP-02`와 UI 보완, QA 자동 통합을 통과하기 전에는 현행 one-stop fallback을 유지한다.
- 첫 통합 확인 중에는 API 병렬 테스트가 요구하는 `RouteProxyFunctionRequest.maxNewProviderAttemptCount`가 아직 합쳐지지 않아 typecheck가 일시 실패했다. 이후 `API-TWO-STOP-02` 코드가 합쳐진 상태에서 `npm run test:typecheck`를 다시 실행해 통과했다. 이는 원격 Edge 배포 완료를 뜻하지 않으며 Wave 2 자동 게이트는 별도로 남는다.
