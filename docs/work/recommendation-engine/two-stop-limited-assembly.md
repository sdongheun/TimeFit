# 2-Y — 최대 2곳 제한 조립 엔진과 누적 예산 상태

## 담당과 병렬 실행

- 담당: 추천 엔진 세션
- 상태: 추천 엔진 구현·순수 회귀 완료, UI port 연결 및 합동 게이트 대기
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

---

# 2-Z — 검증된 one-stop leg 재사용과 첫 B 지연 축소

## 담당·상태·병렬 경계

- 담당: 추천 엔진 세션
- 상태: 작업 가능
- UIUX의 `U-TWO-STOP-03` 동일 화면 구조 보완과 병렬 시작할 수 있다.
- 단, UIUX 세션은 이 작업이 확정하는 runtime 입력 필드 이름을 임의로 만들지 않는다. `2-Z` export가 작업 트리에 들어온 뒤에만 최종 port 연결과 통합 typecheck를 끝낸다.
- 단일 작성자: `src/engine/twoStopSelectionV1.ts`, 필요 시 `src/engine/index.ts`, 추천 엔진 전용 순수 테스트

작업 시작 시 `AGENTS.md`, `docs/README.md`, `docs/03_product/추천로직.md`, `docs/작업조정_보드.md`, 이 파일의 `2-Y` 계약과 이 `2-Z` 절만 읽는다. archive와 다른 완료 작업 파일 전체를 다시 읽지 않는다.

## 1. 목적과 사용자 관찰

실기기에서 one-stop 카드 A를 선택하면 선택 tray와 한 곳 CTA는 나타나지만 첫 exact B가 보이기까지 오래 걸렸다. 화면을 먼저 그리지 못한 문제만이 아니다. 현재 pair 엔진은 한 B마다 다음 두 순서를 순차 검증한다.

```text
O → A → B → D
O → B → A → D
```

fresh cache 기준으로 두 순서에 필요한 directed leg는 최대 여섯 개다. 그러나 A와 화면에 이미 표시된 one-stop B는 같은 recommendation session에서 각각 `O→장소→D`가 exact 검증된 상태다. 이 네 leg를 버리고 다시 adapter에 묻는 것은 정확성을 높이지 않으면서 첫 결과만 늦춘다.

성공하면 화면에 이미 있던 검증 one-stop B를 우선 확인할 때 다음이 성립해야 한다.

1. `O→A`, `A→D`, `O→B`, `B→D`는 기존 exact snapshot을 재사용한다.
2. 새 adapter call은 `A→B`, `B→A` 두 directed leg만 필요하다.
3. 두 교차 leg가 도착한 뒤에는 기존과 동일하게 두 방문 순서의 운영시간·최소 체류·도착 여유를 다시 계산한다.
4. 첫 유효 B는 전체 page 완료를 기다리지 않고 기존 `candidate_verified` event로 즉시 전달한다.

## 2. 확정 원인과 미확정 가설

### 확정된 원인

- `verifyPage`는 candidate를 순차 처리한다.
- 각 candidate에서 A-first 검증이 끝난 다음 B-first를 검증한다.
- 현재 함수 지역 `receiptCache`는 pair 작업 중 새로 요청한 동일 directed leg만 재사용하며, 이미 검증된 one-stop course leg로 초기화되지 않는다.
- 따라서 첫 표시 B 전까지 후보에 따라 여러 adapter call과 신규 provider attempt를 기다릴 수 있다.

### 이번 작업에서 가정하지 않는 것

- 네트워크 병렬화가 반드시 더 빠르다고 가정하지 않는다. 먼저 이미 가진 exact leg를 재사용한다.
- one-stop B가 검증됐으므로 pair도 가능하다고 가정하지 않는다. `A↔B` exact leg와 pair 도착 시각 기준 운영시간·체류·여유 검증이 별도로 필요하다.
- 고정 fixture 실행 시간을 실제 네트워크 SLA로 해석하지 않는다. 이번 완료값은 첫 seeded B의 adapter call과 provider attempt 수로 판정한다.

## 3. 현행·교체 이력

- 이전 방식: pair 한 후보의 두 순서를 각각 완전 검증하며, page 내부에서 새로 얻은 receipt만 재사용했다.
- 관찰된 문제: 화면에 이미 exact 검증된 one-stop A/B의 endpoint leg도 다시 adapter 경계를 통과해 첫 B가 늦었다.
- 교체 방식: 같은 UI recommendation session에서 표시가 완료된 exact one-stop course를 **runtime-only route seed**로 전달하고 유효한 endpoint leg만 pair의 지역 receipt cache에 미리 넣는다.
- 교체 이유: 시간·운영시간·실경로 정확성을 낮추지 않고 중복 adapter/provider 작업만 제거할 수 있다.
- 상태: 구현 전. `2-Y` 공개 결과·continuation·예산은 유지하며 이 절만 보완한다.

## 4. 공개 입력과 runtime seed 계약

기존 export와 호출 형태는 삭제하지 않는다. `ReleaseTwoStopRuntimeInput`에 다음 optional 의미를 추가해 begin과 continue 양쪽이 같은 계약을 쓴다.

```ts
verifiedOneStopCourses?: readonly VerifiedCourseV1[]
```

- 값은 현재 Results session 메모리에서 실제 사용자에게 표시된 exact one-stop course snapshot이다.
- 배열 순서는 사용자가 선택 전에 보던 카드 순서다. 엔진은 유효 seed B를 기존 pair 후보 pool과 교집합한 뒤 그 순서로 우선 검토하고, 나머지 기존 결정적 후보를 뒤에 중복 없이 붙인다.
- `firstCourse`는 계속 별도 필수 입력이다. `verifiedOneStopCourses`에 A가 없더라도 `firstCourse`의 유효 leg는 seed할 수 있다.
- 이 배열과 그 course/leg 본문은 runtime-only다. 공개 continuation, navigation params, DB, 로그, API request, route cache key에 직렬화하지 않는다.
- optional 값이 없거나 빈 배열이면 `2-Y`의 기존 후보 순서와 검증 동작으로 돌아간다.

### seed 유효성

각 seed course는 다음을 모두 만족할 때만 사용한다. 하나라도 어기면 해당 seed만 무시하고 route 0 실패로 전체 branch를 닫지 않는다.

1. `placeIds.length === 1`, `stops.length === 1`, `legs.length === 2`
2. `O→place`, `place→D`의 from/to ID가 현재 input의 origin/target과 정확히 일치
3. place ID가 현재 provider의 representative candidate이고 conditional/hold가 아니며 현재 pair 공간 pool에도 존재
4. leg의 mode가 현행 허용 수단이고 min이 유한한 양의 정수이며 geometry가 있으면 기존 정규화 상한을 만족
5. `travelMin`, `stayMin`, `totalMin`, `arrivalBufferMin`이 두 leg와 stop의 산술·현재 input 경계에 맞음
6. 같은 place ID가 여러 번 오면 첫 번째 유효 snapshot만 사용

seed가 무효여도 그 장소 자체를 pair 후보에서 제거하지 않는다. 기존 미검증 후보 순서에 남겨 정상 adapter 검증이 가능해야 한다. 위조·손상 seed가 exact 결과로 승격되는 경우는 0이어야 한다.

## 5. 구현 순서

### 5.1 branch 후보 순서 동결

1. 기존 `prepare`의 representative·공간·동일 siteGroup·시간 하드 게이트를 먼저 실행한다.
2. 유효 seed B의 ID를 caller 순서로 뽑되 기존 pair pool에 포함된 ID만 앞에 둔다.
3. 나머지 기존 pool을 기존 결정 순서로 이어 붙이고 place ID 중복을 제거한다.
4. 이 최종 `orderedCandidateIds`와 `candidateSetSignature`가 continuation의 branch 동결값이다.
5. continue에는 begin 때와 같은 runtime seed snapshot을 다시 전달한다. seed 목록이 이후 one-stop 더보기 때문에 늘어나더라도 진행 중인 A branch 순서와 signature는 바뀌면 안 된다. UI port가 A branch 최초 begin 시 배열을 동결해 재전달할 책임을 갖는다.
6. continuation의 후보 ID/signature가 현재 동결 branch와 다르면 기존처럼 route 0 `continuation_unavailable`이다. 좌표나 course 본문을 continuation에 넣어 이를 해결하지 않는다.

### 5.2 exact receipt cache seed

유효 one-stop의 각 `CourseV1Leg`를 다음 의미의 지역 receipt로 변환한다.

```ts
{
  result: 'exact',
  route: { mode: leg.mode, min: leg.min, exact: true, geometry: leg.geometry },
  newProviderAttemptCount: 0,
  reused: true,
}
```

- key는 기존과 동일한 directed `fromId>toId`다.
- 같은 key에 서로 다른 mode/min이 들어오면 임의 선택하지 않고 그 seed key만 버려 정상 adapter 검증으로 돌린다.
- seed hit은 adapter call과 ledger를 모두 증가시키지 않는다.
- `routeReceiptKeys`에는 이미 provider/store에서 새로 얻은 것처럼 허위 key를 추가하지 않는다. continuation에 필요한 식별은 기존 candidate/pair signature를 사용한다.
- geometry는 있으면 그대로 보존하되 geometry 없음은 exact 시간 재사용을 막지 않는다.

### 5.3 pair 검증

표시된 exact B 한 곳에 대해서는 정상적으로 다음 순서가 된다.

```text
A-first: O→A(seed) → A→B(new) → B→D(seed)
B-first: O→B(seed) → B→A(new) → A→D(seed)
```

- `A→B`, `B→A`는 각각 기존 receipt adapter와 남은 budget을 사용한다.
- 첫 seeded B의 adapter call은 최대 2회다.
- adapter 한 번의 기존 provider attempt 상한 2를 유지하므로 첫 seeded B의 신규 provider attempt는 최대 4다. cache/server reuse면 더 작을 수 있다.
- 한 방향이 no-route여도 반대 방향은 기존 결정대로 검증한다. terminal provider/store/limit은 기존 typed 중단 규칙을 유지한다.
- 두 순서의 이동합 비교·동률 A-first, 도착 시각별 구조화 운영시간, 각 최소 20분, stay plan, 최종 buffer는 반드시 현재 입력으로 다시 계산한다.
- 성공 B는 두 순서 비교가 끝난 즉시 `candidate_verified` 한 번을 보낸다. 미검증 skeleton이나 seed one-stop 자체를 B 성공으로 emit하지 않는다.
- 이번 작업에서 후보 간 병렬 요청, speculative prefetch, A 선택 전 pair 계산은 추가하지 않는다.

### 5.4 seed가 없는 후보와 fallback

- seed B가 모두 실패하거나 3개 목표를 못 채우면 이어지는 기존 pool 후보를 `2-Y` 방식으로 정확 검증한다.
- automatic 16, shared 12, session 36과 adapter call 상한은 그대로다.
- seed 재사용으로 절약된 attempt는 아직 검증되지 않은 다음 후보를 확인하는 데 사용할 수 있지만, 목표 3/누적 6을 넘기거나 조건부 후보를 끌어오면 안 된다.
- abort, stale requestId, 같은 A 결과 reuse, 다른 A branch 분리는 기존 계약을 유지한다.

## 6. 변경 금지 경계

- `src/ui/`, UI test, `src/services/`, Edge Function, Supabase migration, DB, data/catalog, `.env*`
- `App.tsx`, navigation params, CourseConfirm, 카카오맵·geometry connector
- 대표 후보 등급·공간 pool 최대 18·최소 체류·운영시간·실경로 exact·도착 여유
- 기본 B 목표 3·누적 6·automatic 16/shared 12/session 36
- 3곳, 자유 장바구니, 사용자 순서 편집, 검증 전 B 노출
- 실제 API·GPS·Simulator·실기기 호출과 원격 배포

## 7. failure-first 필수 fixture

엔진 소유 테스트에 먼저 실패 fixture를 추가한 뒤 구현한다. 문자열 존재 검사가 아니라 공개 begin/continue entry를 호출하고 반환 course·event·adapter call·attempt ledger를 비교한다.

1. 유효 A+B seed: 두 방문 순서를 비교하면서 adapter call이 정확히 `A→B`, `B→A` 2회이고 endpoint 4개 호출은 0
2. 두 새 receipt가 각 2 attempt인 최악에도 첫 seeded B 신규 attempt ≤4, ledger는 실제 반환 attempt만 증가
3. A-first만 유효 / B-first만 유효 / 둘 다 유효하고 각 방향이 빠름 / 동률 A-first
4. seed 순서가 기존 pool과 달라도 유효 seed B가 caller 표시 순서로 먼저 검증되고 나머지는 기존 순서 유지
5. 중복 seed, pool 밖 장소, 다른 origin/target, 잘못된 산술, 비정상 leg, conditional seed는 exact로 신뢰하지 않으며 false verified 0
6. 무효 seed B는 후보 자체에서 사라지지 않고 정상 adapter fallback으로 검증 가능
7. one-stop 때 열렸어도 pair의 새 도착 시각에는 닫히는 B는 `second_place_closed`; seed로 운영시간을 건너뛰지 않음
8. seed의 mode/min/geometry가 최종 pair leg에 보존되고 pair stay plan·total은 현재 입력으로 재계산됨
9. seed 없음/빈 배열에서 기존 `2-Y` 결과 순서·호출·ledger snapshot 불변
10. begin→continue가 같은 동결 seed로 이어지고, 외부 표시 one-stop 목록이 나중에 늘어도 기존 branch signature/순서 불변
11. 다른 seed 배열로 continuation을 위조하거나 누락해 branch signature가 달라지면 route 0 `continuation_unavailable`
12. 첫 B exact event는 두 교차 leg 검증 뒤 page completed 전 발생하고, 검증 전 event/선택 가능 B는 0
13. seeded B 실패 뒤 non-seeded 후보 성공, 목표 3/누적 6, 16/12/36 경계 불변
14. abort/stale/same-A reuse/different-A namespace의 기존 테스트 불변
15. 기존 release one-stop initial/page와 production one-stop 호출 수·결과 불변

## 8. 검증 명령과 합격값

```bash
npx tsx --test test/release-two-stop-selection.test.ts
npx tsx --test test/release-one-stop-verified-course.test.ts test/release-one-stop-pagination.test.ts
npm run test:typecheck
npm test
npm run test:ui
git diff --check
```

합격값:

- 위 15개 의미 fixture가 모두 통과한다.
- 유효 A+B seed 첫 후보는 adapter call 2 이하, 신규 provider attempt 4 이하이고 두 값이 테스트 receipt와 ledger에서 일치한다.
- seed hit 자체의 adapter call·attempt·routeReceiptKey 증가는 0이다.
- seed가 없을 때 기존 결과와 호출 계약이 변하지 않는다.
- 전체 회귀의 기존 skip 외 새 실패가 0이다.
- 실제 API/DB/GPS/Simulator/실기기 호출과 원격 배포는 0회다.

## 9. 완료 인수인계

이 절 아래에 다음 네 항목을 남긴다.

1. 변경 파일과 seed 검증·후보 우선순위·receipt 재사용 책임
2. 변경하지 않은 pair 정확성·호출 상한·UI/API/DB/data 경계
3. failure-first와 최종 명령별 테스트 수, 첫 seeded B의 실제 adapter call/attempt 계수
4. 남은 UI port 연결 조건, seed가 없는 실제 입력의 latency 위험, 원격 배포·실기기 미수행 사실

기준을 하나라도 충족하지 못하면 완료로 쓰지 말고 정확한 fixture와 차단 계약을 기록한다. commit·push는 사용자가 요청하기 전 금지한다.

### 2026-09-04 2-Z 추천 엔진 완료 인계

#### 1. 변경 파일과 변경 목적

- `src/engine/twoStopSelectionV1.ts`
  - begin/continue 공통 runtime 입력에 optional `verifiedOneStopCourses`를 공개했다.
  - 현재 provider의 representative pair pool과 현재 입력의 origin/target·시간·여유에 맞는 one-stop snapshot만 검증한다. 표시 배열의 첫 유효 장소 순서를 앞세우고 나머지 기존 pool 순서를 중복 없이 유지한다.
  - 유효 A/B의 endpoint leg를 `newProviderAttemptCount: 0`, `reused: true`인 지역 exact receipt로 바꿔 page cache를 seed한다. mode/min 충돌 key는 버리며 seed hit은 adapter call·ledger·`routeReceiptKeys`를 늘리지 않는다.
  - runtime seed fingerprint를 opaque candidate signature에 결합해 begin의 동결 배열과 다른 continue 입력을 route 0 `continuation_unavailable`로 닫는다. course/leg/좌표 본문은 continuation에 넣지 않았다.
- `src/engine/index.ts`
  - UI port가 자체 필드명을 만들지 않도록 `ReleaseTwoStopRuntimeInput`과 기존 continuation 입력 타입을 barrel에서 공개했다.
- `test/release-two-stop-selection.test.ts`
  - 공개 begin/continue entry 기준 failure-first 및 seed 유효성·순서·fallback·양방향·운영시간·geometry·event·continuation 회귀 fixture를 추가했다.
- `docs/work/recommendation-engine/two-stop-limited-assembly.md`
  - 2-Z 구현 상태와 이 완료 인계를 기록했다.

#### 2. 유지한 공개 계약·정책 경계

- pair는 계속 `O→A→B→D`와 `O→B→A→D`를 모두 확인하고 이동합이 작은 순서를 선택하며 동률은 A-first다. 교차 leg 두 개는 반드시 기존 exact receipt adapter를 통과하고, 두 순서의 도착 시각별 구조화 운영시간·각 장소 최소 체류·stay plan·도착 여유를 현재 입력으로 다시 계산한다.
- 표시 B 목표 3·누적 6, automatic 16/shared 12/session 36, adapter 한 호출당 provider attempt 최대 2, 공간 pool 최대 18, typed terminal·abort·stale requestId·same-A reuse·different-A namespace를 바꾸지 않았다.
- `verifiedOneStopCourses`가 없거나 빈 배열이면 seed/signature를 적용하지 않아 2-Y 후보 순서·6 directed-leg 검증·ledger가 그대로다. 무효 seed는 해당 snapshot만 무시하고 장소는 정상 adapter fallback 후보로 유지한다.
- continuation에는 runtime seed, course/leg 본문, geometry/좌표, 사용자·비밀값을 직렬화하지 않는다. UI/navigation/API/DB/data/catalog/환경값/원격 Edge를 수정하지 않았고 2곳 추천을 production에서 새로 활성화하지 않았다.

#### 3. failure-first 및 테스트 결과

- failure-first: 유효 A+B seed fixture를 먼저 추가했고 구현 전 **15/16 통과, 1 실패**를 확인했다. 실제 호출은 endpoint 네 개를 포함한 6회(`O→A`, `A→B`, `B→D`, `O→B`, `B→A`, `A→D`)여서 기대한 교차 leg 2회와 달랐다.
- 구현 후 `npx tsx --test test/release-two-stop-selection.test.ts`: **25/25 통과**. 첫 유효 seeded B의 실제 adapter call은 정확히 `A→B`, `B→A` **2회**, 각 receipt 2회인 최악 신규 provider attempt는 **4**, automatic ledger 증가는 **4**, seed 자체 route receipt key 증가는 **0**이고 새 교차 key만 **2**였다.
- 위 25개에는 상세 명령의 15개 의미 경계가 포함된다. seeded 양방향 한쪽/양쪽 유효·빠른 방향·동률, 표시 seed 우선순위, 중복/손상 산술/다른 endpoint/비정상 mode·geometry/conditional 거절, 무효 seed fallback, pair 도착시각 폐점, leg 보존과 stay 재계산, no-seed 불변, frozen begin→continue와 변조 route 0, 교차 검증 뒤 단일 event, seeded 실패 뒤 non-seeded 성공, 3/6·16/12/36·abort/reuse namespace를 검증했다.
- `npx tsx --test test/release-one-stop-verified-course.test.ts test/release-one-stop-pagination.test.ts`: **11/11 통과**.
- `npm run test:typecheck`: 통과.
- `npm test`: **117/117 통과**.
- `npm run test:ui`: **235개 중 234 통과, 기존 skip 1, 실패 0**.
- `git diff --check`: 통과.
- 테스트는 고정 fixture만 사용했다. 실제 API·DB·GPS·Simulator·실기기 호출과 원격 배포는 **0회**다.

#### 4. 다음 결정·위험

- `U-TWO-STOP-03`은 A branch begin 시 화면에 실제 표시 완료된 exact one-stop 배열을 한 번 동결해 `verifiedOneStopCourses`로 전달하고, 같은 branch의 continue마다 동일 snapshot을 다시 전달해야 한다. 이후 one-stop 더보기로 목록이 늘어도 진행 중 branch 입력을 교체하면 안 된다.
- seed가 없거나 UI가 이 runtime field를 연결하지 않은 실제 입력은 정확성을 잃지는 않지만 첫 B마다 기존 최대 6 directed adapter call 지연이 남는다. 무효·손상 seed도 의도적으로 같은 fallback 비용을 낸다.
- 후보 간 병렬화·speculative prefetch·A 선택 전 pair 계산은 하지 않았다. 실기기 첫 B 체감 지연과 실제 cache/server reuse 계수는 UI port 연결, 원격 Edge 배포 상태 확인, `QA-TWO-STOP-01` 합동 자동 게이트 뒤 별도로 측정해야 한다.
- 일반 사용자 2곳 활성화 여부는 이 엔진 완료만으로 확정할 수 없다. UI/API/QA 계약과 원격 배포가 함께 수락되기 전에는 one-stop production fallback을 유지한다.

### 2026-09-04 통합·결정 독립 검토

- **판정:** `2-Z` 수락. `U-TWO-STOP-03` 진행 가능.
- 통합 세션이 공개 export와 runtime-only 직렬화 경계를 확인하고 `release-two-stop-selection + release-one-stop` 관련 **36/36**, `npm run test:typecheck`, `git diff --check`를 독립 재실행해 모두 통과했다.
- 유효 A+B seed에서 endpoint 네 구간의 adapter/provider 증가는 0이고 새 교차 구간은 `A→B`, `B→A` 두 adapter call, 최악 신규 provider attempt 4로 고정됐다. seed가 없으면 기존 6 directed-leg 검증으로 돌아간다.
- 실제 체감 지연이 항상 짧아진다는 뜻은 아니다. 표시 완료 B가 없거나 seed가 무효이면 fallback 비용이 남는다. 다음 UI는 현재 표시 완료 one-stop 배열을 A branch별로 동결해 begin/continue/reuse에 반드시 전달해야 하며, 그 연결 뒤 최소 실기기에서 첫 B 체감을 한 번 확인한다.

## 2-AA — 동일 세션 exact pair 역선택 재사용

### 1. 목적과 사용자 관찰

같은 서면 120분 결과에서 `포셋 전포`를 A로 선택하면 `롯데백화점 부산본점`이 B로 exact 표시되지만, A를 취소하고 `롯데백화점 부산본점`을 선택하면 `포셋 전포`가 나타나지 않는 비대칭이 관찰됐다. pair 검증은 두 방문 순서를 모두 비교하므로 동일 session/input에서 이미 성공한 `{포셋, 롯데}`의 시간·경로 적합성은 첫 선택 장소 이름에 따라 사라져서는 안 된다.

성공 시 사용자는 같은 세션에서 어느 쪽을 기준 장소로 다시 골라도 이미 exact 확인한 상대 장소를 즉시 볼 수 있다. 실제 방문 순서는 기존 검증 snapshot을 유지하고 새 경로 호출은 없어야 한다.

### 2. 현재 확정 사실과 먼저 판별할 원인

- `verifyOrderedPair()`는 후보 하나에 두 방문 순서를 모두 확인하므로, 같은 입력에서 한쪽 선택만 물리적으로 가능한 것으로 판정하는 정책은 없다.
- production reuse는 현재 `reuseByFirstPlace`로 A별 namespace를 사용한다. 같은 A 재선택은 재사용하지만 역선택 branch는 같은 pair course를 직접 받지 않는다.
- 후보 loop는 첫 exact 3개에서 멈추고 automatic 16회는 session에서 환불되지 않는다. 그래서 역선택 누락은 `후보가 뒤에 있음`, `앞의 3개 성공`, `남은 automatic budget 0`, `A별 reuse 누락` 중 하나 또는 조합일 수 있다.

구현 전에 고정 fixture로 각 원인을 따로 계측한다. 현재 실패를 설명하기 위해 후보 순서나 예산을 임의로 늘리지 않는다.

### 3. 현행/교체 계약

| 이전 방식 | 문제 | 교체 방식 | 이유 | 상태 |
| --- | --- | --- | --- | --- |
| exact pair 결과를 A별 branch에만 보관 | `{A,B}`를 검증했어도 B를 새 A로 고르면 A가 다시 탐색 대상이 되어 누락·재호출 가능 | 같은 session/input의 exact pair를 순서 없는 key로 runtime seed화 | 이미 지불하고 검증한 결과를 선택 관점만 바꿔 재사용 | 추천 엔진 구현 완료·UI 연결 전 |
| A 취소 뒤 사용한 예산을 복구하지 않음 | 다른 A 탐색량이 줄 수 있음 | 예산 비환불은 유지하되 exact pair seed는 budget 0에서도 0-call로 소비 | 비용 상한을 깨지 않고 이미 검증한 결과만 보존 | 현행 유지 |
| 새 세션에서도 대칭 결과를 기대 | 모든 pair 선검증 없이는 보장 불가 | 새 session·다른 input의 미검증 pair는 보장하지 않음 | 호출량과 첫 결과 지연 방지 | 범위 제외 |

### 4. 구현 명령

1. 공개 pair begin/continue runtime 입력에 선택적 exact pair seed를 추가한다. 이름은 기존 `verifiedOneStopCourses`와 혼동되지 않게 `verifiedPairCourses` 또는 동등하게 명확한 이름을 사용한다.
2. seed course는 다음을 모두 만족할 때만 유효하다.
   - 정확히 두 고유 representative place이며 현재 선택 A를 한 번 포함한다.
   - 상대 장소가 현재 18개 pair pool과 site-group/조건부/최소 체류 gate를 통과한다.
   - 세 legs가 `origin → placeIds[0] → placeIds[1] → target`에 일치하고 exact mode/min 산술·total·buffer·stop 시각이 현재 input과 일치한다.
   - 현재 provider/catalog/input signature와 같은 recommendation session에서 확정된 snapshot이다.
3. 유효 seed는 실제 `placeIds` 방문 순서를 바꾸지 않은 채 현재 A의 상대 B 후보로 먼저 emit한다. 사용자가 B를 먼저 눌렀다는 이유로 course를 B-first로 다시 쓰지 않는다.
4. seeded pair는 현재 branch의 initial 목표 3과 누적 6에 한 건으로 포함한다. 그 뒤 남은 자리만 기존 후보 순서와 남은 예산으로 검증한다.
5. seed pair signature는 attempted/verified set에 먼저 반영해 후보 loop가 같은 조합을 다시 adapter에 보내지 않게 한다. 기존 cursor의 다른 후보를 건너뛰지 않는다.
6. automatic budget이 이미 16이어도 유효 exact pair seed는 adapter/provider 0회로 반환할 수 있어야 한다. 미검증 후보는 budget 0에서 새로 확인하지 않는다.
7. begin→continue에는 해당 A branch 최초의 pair seed snapshot/signature를 동결한다. 중간에 다른 A에서 새 pair가 검증돼도 이미 열린 continuation의 candidate signature를 몰래 바꾸지 않는다.
8. seed 배열·course 본문·좌표·provider 객체는 continuation/navigation/DB/log에 직렬화하지 않는다. continuation에는 필요하면 opaque signature만 둔다.
9. invalid/stale/abort 중 결과, provider/store/continuation terminal 결과는 seed로 승격하지 않는다. seed 불일치는 false verified가 아니라 무시 또는 route 0 `continuation_unavailable` 중 기존 안전 계약과 일치하는 한 방식으로 고정한다.
10. 새 session/input에서 모든 pair를 대칭 노출하거나 B 목표·예산을 늘리는 코드는 추가하지 않는다.

### 5. 수정 허용·금지 경계

허용: `src/engine/twoStopSelectionV1.ts`, 필요한 `src/engine/types.ts`·`src/engine/index.ts`, `test/release-two-stop-selection.test.ts`, 이 작업 문서.

금지: `src/ui/`, API/service/Edge, DB/migration, data/catalog, `.env*`, navigation, 18개 pool, B 3/6, automatic 16/shared 12/session 36, 최소 체류·운영시간·양방향 비교, 실제 API·Simulator·원격 배포.

### 6. failure-first·상태 기계 필수 fixture

1. 같은 session/input에서 A→B exact 성공 후 B를 새 A로 시작하면 A가 첫 후보에 있고 adapter/provider 증가 0.
2. 원 snapshot의 실제 순서가 B→A여도 역선택 재사용 시 순서·legs·stop 시각을 바꾸지 않음.
3. automatic ledger 16 소진 상태에서도 valid seed 1개는 반환하고 미검증 후보 호출 0.
4. seed 1개 뒤 새 exact 2개를 더해 initial 최대 3, 이미 반환한 pair 중복 0.
5. pair seed가 3개 이상이면 기존 결정 순서의 앞 3개만 initial에 있고 continue 포함 누적 6 이하.
6. 다른 recommendation session 또는 now/origin/destination/remaining/buffer/provider/catalog signature 변경은 seed 재사용 0.
7. abort 전 미완료·stale request·terminal 결과는 seed 0.
8. pool 밖/조건부/same site group/손상 legs·total·arrival course는 false verified 0.
9. 같은 A 기존 reuse와 verified one-stop endpoint seed가 함께 있어도 호출·verified count를 중복하지 않음.
10. 순서 없는 pair key 충돌 없이 `{A,B}`와 `{A,C}`를 분리하고 `{A,B}`/`{B,A}`만 동일 집합으로 취급.
11. 새 세션에서 B를 처음 선택한 경우 A의 첫 3개 노출을 강제하지 않고 기존 후보 순서·예산 snapshot 유지.
12. 기존 2-Z, one-stop initial/page, 3/6·16/12/36·continuation 위변조 회귀 불변.

### 7. 검증과 합격값

```bash
npx tsx --test test/release-two-stop-selection.test.ts
npx tsx --test test/release-one-stop-verified-course.test.ts test/release-one-stop-pagination.test.ts
npm run test:typecheck
npm test
git diff --check
```

합격은 failure-first가 현재 역선택 누락을 실제로 재현하고, 구현 후 위 12개 의미 fixture와 기존 테스트가 모두 통과하는 것이다. 역선택 seed의 adapter call/new provider attempt는 정확히 0이어야 한다. 실제 API·DB·GPS·Simulator·원격 배포는 0회다.

### 8. 완료 인수인계

변경 파일 / 확인한 실제 원인 / pair seed 검증·동결 계약 / 테스트별 수와 0-call 계측 / U-TWO-STOP-04가 소비할 export / 남은 위험을 기록한다. 조건을 충족하지 못하면 완료가 아니라 재현 결과와 차단 지점을 남긴다. commit·push는 사용자 요청 전 금지한다.

### 2026-09-04 2-AA 추천 엔진 완료 인계

#### 1. 변경 파일과 변경 목적

- `src/engine/twoStopSelectionV1.ts`
  - begin/continue 공통 runtime 입력에 `recommendationSessionToken`과 `verifiedPairCourses`를 추가했다.
  - pair seed는 정확히 두 고유 representative 장소, 현재 A 1회 포함, 상대 B의 현재 18개 pair pool·site-group·조건부·최소 체류 gate 통과, 세 leg endpoint/mode/min/geometry, stop 순서·도착/출발 시각·운영시간, travel/stay/total/buffer/remaining 산술을 모두 통과해야 한다.
  - 유효 seed를 adapter 예산 검사보다 먼저 `attempted/verified`에 반영하고 실제 snapshot 순서 그대로 `candidate_verified`로 전달한다. initial 3·누적 6의 한 자리로 세며, 남은 자리만 기존 cursor와 잔여 예산으로 검증한다.
  - pair key는 place ID를 정렬한 순서 없는 signature라서 `{A,B}`와 `{B,A}`만 합치고 `{A,C}`는 분리한다.
- `src/engine/index.ts`
  - `ReleaseTwoStopSessionToken`, `ReleaseTwoStopVerifiedPairSeed`, 기존 runtime/continuation 입력 타입을 공개 export했다.
- `test/release-two-stop-selection.test.ts`
  - 역선택 재현과 session/input/provider scope, budget 0, 3/6, 순서 보존, invalid seed, same-A reuse, continuation 동결을 공개 entry 상태 기계 fixture로 추가했다.
- `docs/work/recommendation-engine/two-stop-limited-assembly.md`
  - 교체 상태와 이 완료 인계를 기록했다.

#### 2. 확인한 실제 원인

- failure-first에서 A branch가 exact `{A,B}`를 반환한 뒤 B를 새 A로 시작해 같은 course를 전달해도 기존 엔진은 pair seed 입력을 소비하지 않아 adapter를 다시 호출했다. 구현 전 결과는 **26개 중 25 통과, 역선택 1 실패**였고 실패 stack은 `verifyOrderedPair → getRouteReceipt`의 신규 호출이었다.
- pair 정책은 이미 두 방문 순서를 모두 비교하므로 물리적 가능성의 방향 비대칭이 원인이 아니었다. production runtime의 `reuseByFirstPlace`가 A별 namespace이고, 첫 3개에서 loop가 멈추며 automatic 16회 사용분을 환불하지 않는 조합 때문에 반대 A branch가 기존 exact pair를 직접 소비하지 못하는 것이 원인이었다.
- 제3의 미검증 후보가 있으면 seed 1개 뒤 목표 3의 남은 자리를 기존 예산으로 검증하는 것이 정상이다. 따라서 역선택 자체의 0-call 계측은 `{A,B}`만 있는 fixture와 automatic 16 소진 fixture로 분리했다.

#### 3. pair seed 검증·동결 및 유지한 계약

- `ReleaseTwoStopVerifiedPairSeed`는 `course`, 원 결과 continuation의 `inputSignature`·`providerSignature`, 같은 UI session closure의 객체 identity인 `recommendationSessionToken`을 묶는다. 세 값이 현재 입력과 모두 일치해야 seed가 된다. token은 값 문자열이 아니라 객체 동일성으로 비교하므로 다른 recommendation session에서는 재사용되지 않는다.
- 유효 pair seed 배열의 순서와 course fingerprint는 기존 one-stop runtime seed와 함께 opaque `candidateSetSignature`에만 반영한다. begin 뒤 pair seed 누락·재정렬·추가는 continue에서 route 0 `continuation_unavailable`이며, 배열/course/legs/좌표/token/provider 객체는 continuation에 직렬화하지 않는다.
- 원 snapshot이 `B→A` 순서여도 `placeIds`, legs, stop 시각과 객체 identity를 바꾸지 않는다. 현재 사용자가 A를 먼저 선택했다는 이유로 방문 순서를 다시 작성하지 않는다.
- invalid/stale signature·다른 token·abort·pool 밖·조건부·same-site·손상 endpoint/total/arrival seed는 false verified 없이 무시한다. 미검증 후보는 기존 adapter와 잔여 예산 규칙으로만 검증한다.
- B 목표 3·누적 6, automatic 16/shared 12/session 36, one-stop endpoint seed, 양방향 exact 비교, 운영시간·최소 체류·도착 여유, typed terminal, same-A reuse, 새 session 후보 순서를 바꾸지 않았다. UI/API/service/Edge/DB/data/catalog/navigation/환경값/보드는 수정하지 않았다.

#### 4. 테스트 결과와 0-call 계측

- failure-first: 구현 전 `npx tsx --test test/release-two-stop-selection.test.ts` **25/26 통과, 역선택 1 실패**. 반대 A branch가 adapter를 호출해 재현됐다.
- 구현 후 `npx tsx --test test/release-two-stop-selection.test.ts`: **35/35 통과**.
  - 같은 session/input의 `{A,B}` 역선택: adapter call **0**, 신규 provider attempt **0**, ledger delta **0**.
  - automatic 16 소진 + seed 1 + 미검증 후보: seed 1개 반환, adapter/provider **0**, 미검증 후보 호출 **0**.
  - seed 1 + 신규 2는 initial 3, seed 6은 `3 + continue 3`, verified 누적 6을 지켰다.
  - 다른 token/signature·abort·손상 seed false verified 0, pair/continuation 본문 직렬화 0을 확인했다.
- `npx tsx --test test/release-one-stop-verified-course.test.ts test/release-one-stop-pagination.test.ts`: **11/11 통과**.
- `npm run test:typecheck`: 통과.
- `npm test`: **117/117 통과**.
- `git diff --check`: 통과.
- 실제 API·DB·GPS·Simulator·실기기 호출과 원격 배포는 **0회**다. commit·push도 수행하지 않았다.

#### 5. U-TWO-STOP-04가 소비할 export와 남은 위험

- UI session은 recommendation runtime마다 `ReleaseTwoStopSessionToken` 객체를 하나 만들고 외부에 직렬화하지 않는다. 완료된 non-stale/non-abort exact 결과만 `ReleaseTwoStopVerifiedPairSeed`로 만들며, `inputSignature`·`providerSignature`는 그 결과의 engine continuation 값에서 가져온다.
- session은 완료 pair를 순서 없는 장소 집합 key로 최대 한 번 저장한다. A branch 최초 begin 시 현재 A를 포함한 seed 배열을 기존 검증 결정 순서로 동결하고, begin/continue/same-A reuse에 같은 token·같은 배열을 전달해야 한다. 다른 A에서 pair가 추가돼도 이미 열린 branch 배열을 교체하면 안 된다.
- UI port는 seed course를 `placeIds` 첫 장소가 현재 A가 되도록 뒤집지 않고 엔진 반환 snapshot 그대로 표시해야 한다. seed event도 현재 `requestId/firstPlaceId` epoch 검사를 통과할 때만 반영한다.
- 객체 token과 wrapper는 신뢰 경계이지 암호학적 위조 방지 수단이 아니다. 제품 내부 UI port만 생성·전달해야 하며 navigation/DB/log/API로 내보내면 안 된다.
- 2-AA는 새 session의 미검증 pair를 첫 3개에 보장하지 않는다. 실제 사용자 역선택 0-call은 `U-TWO-STOP-04` 연결과 `QA-TWO-STOP-02` 자동 게이트 이후에만 production 완료로 판단한다.
