# REC-LIVE-MULTISOURCE-01 — 다중 원천 엔진 세션 조정기

2026-09-22. 부모: `DEC-LIVE-PUBLIC-DATA-01` 마스터 계획 §3.3~3.5, 단계 B의 부분 결과 규칙. 사용자 위임 명령 `REC-LIVE-MULTISOURCE-01`에 따른 **엔진 구현·고정 fixture 검증**이다. 직전 `2-LIVE-MULTISOURCE-ORCHESTRATOR-03`은 조사 후 중단됐으며 완료 근거로 사용하지 않는다. 이번 문서 위치는 위임에서 지정한 경로를 따른다.

상태: **엔진 내부 구현 완료 / public UI·서비스 연결 및 운영 활성화 전**. App Store 현행 추천 경로는 변경하지 않았다.

최신 후속: **REC-LIVE-RUNTIME-BRIDGE-02**는 아래 §9를 따른다. §4~8의 pair/cache bridge 미구현 설명은 MULTISOURCE-01 완료 당시 이력이며, bridge 자체는 §9에서 구현했다. 실제 public UI 등록은 계속 미실행이다.

## 1. 목적·변경 이력

- 이전: Tour 전용 점진 planner와 다중 원천 projection이 따로 있고, route 예산/캐시를 유지하는 실행 조정기가 없었다. 목표4 미달의 부분 결과는 UI 연결 결정으로 남아 있었다.
- 문제: batch마다 신규 CourseV1 builder를 그대로 호출하면 초기8회가 반복 부여될 수 있고, Tour 전용 후보만 사용하면 부산-only93을 누락한다. 1~3개 검증 코스를 전체 실패로 표시해서도 안 된다.
- 교체: 실제 `projectMultiSourceLiveCatalog` 계약을 주입받는 세션 조정기에서 동일 snapshot의 정규화 입력을 고정하고, 상세 예약·구조화 후보·기존 CourseV1 계산·누적 receipt cache/ledger·부분 결과를 관리한다.
- 이유: 원천의 field ownership은 데이터 역할에 유지하고 엔진이 새 parser/결합 정책을 만들지 않으며, 보충 batch로 비용 상한이 재설정되지 않게 한다.
- 상태: 아래 순수 엔진 포트 구현 현행, public 연결 전. 과거03의 조사 상태를 이번 코드 성과로 소급하지 않는다.

## 2. 변경 파일

1. `src/engine/liveMultiSourceOrchestrator.ts` 신규: projection snapshot 검증 helper 및 단일 writer 세션 조정기. data/service는 type-only import이며 외부 호출 구현·환경 읽기·로그·영속 저장 없음. projector와 receipt port를 외부에서 주입한다.
2. `test/live-multisource-orchestrator.test.ts` 신규: 실제 데이터 projection·실제 CourseV1 계산과 고정 원천/receipt fixture를 사용하는17건.
3. 본 문서: 상태·계약·검증·활성화 조건.

기존 dirty `src/engine/courseV1.ts`, 이전 snapshot/progressive 산출물, 앱 설정·의존성·타 역할 문서/데이터는 수정하지 않았다. `index.ts`, App/UI, services, DB, env, 보드, 중앙 추천 정책은 변경0. stage/commit/push0.

## 3. 엔진 입력·호출 순서

### projection 순수 경계

`LiveMultiSourceInput = Parameters<typeof projectMultiSourceLiveCatalog>[0]`, `LiveMultiSourceProjector = typeof projectMultiSourceLiveCatalog`로 실제 데이터 소유 타입을 그대로 사용한다.

`projectLiveSessionSources(input, projector)`는 다음을 검증하고 `accepted + projection`, `snapshot_mismatch`, `invalid_projection`만 반환한다.

- Tour catalog와 부산 응답에 있는 non-null snapshot ID 일치.
- ID 없는 Tour 입력은 unavailable이고 active candidate가 없어야 한다. ID 없는 실패를 다른 공급자의 성공으로 위장하지 않는다.
- 모든 supplement의 snapshot ID와 place/source ID가 해당 Tour candidate와 일치하며 중복 supplement가 없어야 한다.
- projector가 반환한 snapshot ID도 검증한다. 예외 원문은 노출하지 않는다.

실제 projector의 active representative만 route 후보로 사용한다. identity conflict, Tour active opening 누락/needs_review는 부산 opening으로 우회하지 않는다. Tour unavailable일 때 부산 active109, 부산 unavailable일 때 Tour active98을 fixture에서 보존했다. 기존 field ownership과 상세 parser를 재작성하지 않았다.

### 세션 순서

1. `createMultiSourceLiveSession({sources:{tour,busan}, context, projector, receiptRoutes})`를 명시 새 추천 세션마다 한 번 만든다. context는 `now/origin/destination/remainingMin/arrivalBufferMin/dwellPersonalizationSamples`이며 복사해 고정한다. 남은 시간1~180·정수, 도착 여유1 이상/남은 시간 미만, 날짜·좌표 유효성을 검사한다. 기존 caller 입력을 변경하지 않는다.
2. 초기 sources에는 이미 조회한 supplement를 받지 않는다. 상세는 반드시 아래 예약을 거친다. projection 전체191 fixture는 분할·타입 동등성 검증이지 세션에서98개 상세 호출을 허용하는 예외가 아니다.
3. `reserveDetails()`가 초기최대12, 이후최대6, 누적최대30을 예약한다. 반환 reservation은 snapshot/순번/내부 place ID/content ID/type만 포함하며 사용자 좌표·API token은 없다. pending 중에는 추가 예약하지 않는다. active Tour identity와 최신 좌표의 기존 공간 부담 점수/core 동점/ID 순서를 사용하고 상세 이전18 사전절단은 하지 않는다.
4. API 소유자가 예약에 signed token을 붙여 조회하고, 데이터 소유 normalizer 결과를 `TourLiveFieldSupplement[]`로 전달한다. 이 엔진은 HTTP나 token을 다루지 않는다. 반환받았던 **동일 reservation 객체**로 `acceptDetails(reservation, supplements, {nextBatchMax})`를 호출한다. 원천 실패/누락 ID는 빈 supplement로 settle하며 stale/재응답/복제 reservation은 수락하지 않는다. API의 낮은 nextBatchMax(0 포함)를 보존한다. 생략 시 로컬6/hard30 상한이며 public adapter 연결에서는 실제 응답 허용량을 전달해야 한다.
5. `evaluate()`는 초기 Tour queue가 있으면 첫 상세 settle을 요구한다. 부산만 먼저 평가해서 route18을 독점하는 호출 순서를 허용하지 않는다. 원천 입력 배열 순서와 무관하게 기존 one-stop 선별 함수의 운영시간/공간/동일단지/wide lane을 재사용하고 세션 누적 route 후보는 최대18이다. 이전 route slot을 뒤 batch가 몰래 교체하지 않는다.
6. 실제 `buildReleaseOneStopRepresentativeCourseV1`로 검증한다. async 평가 중 두 번째 평가·상세 예약은 차단한다. `acceptDetails` 후 평가 전 다음 상세 예약도 차단하여 오래된 충분성으로 호출하지 않는다.
7. 목표4 충족, 상세30, queue 소진, route 예산 소진, 공급자 제한/실패에서 종료한다. 충분하지 않고 stopReason이 없을 때만 다음 배치를 예약한다. 실패·검토 원천을 오래된 번들 사실로 채우지 않는다.

조정기는 상태를 가진 메모리 객체이지만 모든 계산/상태 전이는 주입된 fixture와 포트로 실행 가능하고 자체 I/O는 없다. 전역 singleton이나 영속 cache는 없으며 세션 소유자가 종료 시 객체 참조를 해제한다. 예약 객체는 직렬화해서 복원하는 계약이 아니다.

## 4. 경로 ledger·cache와 유지 정책

- 외부 receipt 요청은 세션 하나의 wrapper만 사용한다. 새 batch에서 CourseV1 내부 평가가 다시 수행돼도 wrapper의 `attempts/adapterCalls/cache`는 초기화되지 않는다.
- 방향·내부ID·정확 live 좌표를 포함한 session-local key로 exact/no-route receipt를 재사용한다. 재사용은 `newProviderAttemptCount:0`으로 전달하며 실패 unavailable은 성공 cache에 넣지 않는다. unavailable이면 이 자동 단계는 중단하고 raw 오류를 버린다.
- 각 요청 allowance는 기존 최초 one-stop8의 잔여와 port의 최대2 중 작은 값이다. 누적 adapter 호출24도 유지한다. exception/손상 count는 요청 직전 허용량을 보수적으로 소비하고 중단한다. adapter가 약속한 allowance 밖에서 실제 HTTP를 수행하지 않는다는 기존 포트 책임은 그대로다.
- view의 `ReleaseTwoStopAttemptLedger`는 최초 single 사용량을 보존하며 automatic pair/shared expansion은0이다. 자동 상세 보충이 pair16/shared12/총36을 빌려 쓰지 않는다.
- 이번 신규 API는 **자동 one-stop 추천 준비 조정기**다. 기존 pair-only 엔진/선택 흐름을 교체하거나 새2곳 자동조립을 만들지 않았다. public pair/더보기 연결 시 이 ledger와 같은 세션의 adapter/cache owner를 사용하도록 별도 연결 검증해야 하며 새 최초8로 재시작하면 안 된다. 이번 객체의 내부 cache를 직렬화하거나 타 세션으로 복사하는 공개 API는 만들지 않았다.
- 체류·개인화·운영시간·자정/익일·도착 여유는 기존 CourseV1 계산을 그대로 실행한다. 최대180분/최대2곳 정책, 기존 public single/pair 예산·카탈로그 정책 불변. 새 조정기가 반환하는 초기 코스는 one-stop뿐이며 과거3곳 전략에 연결하지 않는다.

## 5. UIUX 인계 계약 — 아직 연결하지 말 것

`view()`와 `evaluate()` 결과는 복사·깊은 동결된 `LiveMultiSourceView`다.

| state | 의미 | nextAction |
| --- | --- | --- |
| loading | 아직 평가 전/결과0이며 보충 가능 | continue |
| ready | 실제 검증 distinct course4 확보 | show_results |
| partial | 실제 검증1~3개. 종료 사유와 무관하게 보존 | show_results |
| empty | 정상 종료 후 검증0 | edit_inputs |
| unavailable | snapshot 결합 실패/전체 원천 실패/route provider 장애, 결과0 | retry |

- `partial + stopReason 없음`은 다음 배치를 더 검증할 수 있다는 뜻이다. `partial + stopReason 있음`은 해당 부분 결과로 자동 단계를 마감한다. 결과 수 미달만으로 empty로 바꾸지 않는다.
- `stopReason`: sufficient/detail_cap/queue_exhausted/route_budget_exhausted/provider_unavailable/detail_provider_limit/unavailable. `sourceFailure`는 snapshot_mismatch/invalid_projection의 안전 분류만 제공한다.
- `courses`는 기존 `VerifiedCourseV1`이며 화면이 별도 성공 시간/geometry를 추정하지 않는다. `routeCandidates`는 운영 gate를 통과한 누적 후보이고 검증 성공 코스와 구분한다.
- diagnostics는 provider/sourceId/reason/count만 포함한다. 원문 opening/description/body/error, 사용자 좌표·ID·token을 진단 필드에 넣지 않는다.
- 별도 활성화 flag를 새로 만들거나 기존 flag를 켜지 않았다. engine barrel·public v1Session·App 진입 변경0. 연결 flag/취소/세션 수명·pair/cache owner·signed token/nextBatchMax binding의 통합 계약은 public 활성화 전에 확인해야 한다.

## 6. 실패 선행·검증 결과

- RED: 구현 전에 신규 fixture 작성·실행 → 모듈 부재로 **파일1 FAIL / PASS0**. 구현 후 초회8 PASS/1 FAIL: 상세30 소진·코스0을 projection review 상태 때문에 unavailable로 표시했다. 정상 소진은 empty, 실제 provider/결합 실패는 unavailable로 구분하여 수정했다. 중간 typecheck의 readonly availability/fixture union 오류도 타입 복사 경계를 맞춰 해소했다.
- 최종 신규17건: 실제191=82/93/16 분할·순서 결정성, catalog/supplement mismatch, 공급자 장애 격리, identity conflict·Tour opening 실패,12+6+6+6, 예약 재응답/중복/변조, 부분1/2/3,0개 소진, session ledger/cache, 동시 writer 차단, route18/attempt8/adapter24 상한, raw 오류 비노출, 초기 상세 필수, provider nextBatchMax0,120/121/180/181, public 미연결.
- 집중 실행: `node --import tsx --test test/live-multisource-orchestrator.test.ts test/live-progressive-orchestrator.test.ts test/busan-live-projection.test.ts test/live-opening-normalizer.test.ts test/release-three-hour-engine.test.ts test/release-two-stop-selection.test.ts test/dwell-personalization-course.test.ts` → **99/99 PASS**, skip0. `/private/tmp/rec-live-multisource-focus.log`.
- 전체 회귀의 최종 결과는 아래 마감 기록에 남긴다. `npm test`는 기존 discovery로 새 `.ts`17건을 자동 집계하지 않으므로 집중99와 별도로 해석하고 고유 테스트 수로 합산하지 않는다.

## 7. 남은 위험·활성화 조건

- 191은 동등한 live fixture의 잠재 대표 풀이다. 현실의 운영시간 needs_review, 상세30, route18/attempt8 제한으로 실제 결과 수를 보장하지 않는다. stale 원천 fallback으로 수를 늘리지 않는다.
- 입력/결과는 실제 타입과 actual projection으로 검증했으나 HTTP 응답→normalizer→supplement/token 연결, 앱 취소·background/deadline 수명, pair/명시 더보기 예산 연결은 이 내부 엔진 작업에 포함되지 않는다. source/caller는 새 세션을 자동으로 반복 생성하여 예산을 우회하면 안 된다.
- 실제 공급자 API0, DB0, env/secret 접근·변경0, 배포0, public 활성화0. fixture 통과는 개발계정 운영 한도·공급자 가용성·실기기·출시 artifact 검증을 대체하지 않는다.

## 8. 최종 완료 인계 — 2026-09-22

1. **변경 파일:** 신규 엔진 `liveMultiSourceOrchestrator.ts`, 신규 순수 fixture `live-multisource-orchestrator.test.ts`, 본 문서3개. 기존 타 세션 변경 보존. 조사만으로 완료 판정하지 않았으며 실제 신규17건을 실행했다.
2. **유지 계약:** 실제 다중 원천 projection·field ownership, active representative,180분/최대2곳, 체류/개인화/운영시간/공간/도착여유, route18·initial8·adapter24 및 기존 pair/shared/총36 정책 유지. public/API/DB/env/중앙 문서/보드 변경0.
3. **테스트:** 신규17건 포함 집중 **99/99 PASS**. 최종 `npm run test:typecheck` **PASS(exit0)**. `npm test` **587/587 PASS(exit0)**, `/private/tmp/rec-live-multisource-core-final.log`. `npm run test:ui`는 tsx IPC의 sandbox `EPERM`으로 시작 전 실패했으며, 같은 glob을 `node --import tsx --test test/ui/*.test.ts test/ui/*.test.mjs`로 실행해 **824건 중823 PASS/0 FAIL/기존1 SKIP(exit0)**, `/private/tmp/rec-live-multisource-ui-final.log`. 원래 npm 명령 성공으로 기재하지 않는다. `git diff --check`와 신규3파일 whitespace 검사 **PASS**. 실패 은폐용 skip/테스트 설정 수정 없음.
4. **다음 결정·위험:** 이 조정기의 공개 연결/활성화는 미실행이다. UIUX는 §5의 typed state와 partial 보존을 소비하고, API는 §3의 예약 객체·snapshot·token/nextBatchMax 바인딩을 연결해야 한다. 기존 pair/더보기 cache owner와 ledger의 통합은 public 연결 게이트다. 실제 API/운영 한도·배포·secret·DB·실기기·릴리스 산출물 검증 완료를 주장하지 않는다.

## 9. REC-LIVE-RUNTIME-BRIDGE-02 — 2026-09-22

### 9.1 목적·이력·범위

- 이전: live session은 초기 single 결과·initial8 cache만 제공하고 pair runtime으로 넘길 경계가 없었다.
- 문제: 그대로 public UI에 연결하면 결과 타입이 다르고, pair에서도 initial8 소진으로 요청이 차단되거나 다른 adapter를 새로 만들어 cache/ledger가 갈라질 수 있다.
- 교체: 초기 계산을 확정한 뒤 한 번만 `sealRuntime()`하고, 동일 receipt owner의 캐시·단계별8/16/12·총36 방어와 기존 UI pair port 입력을 bridge로 전달한다.
- 이유: 기존 pair/time/운영시간/개인화 계산을 교체하지 않고 runtime 연결만 가능하게 한다.
- 상태: **엔진 bridge 구현·실행형 fixture 완료, public 미연결**. `createTwoStopSelectionEnginePort`는 테스트에서 실제 import/실행했으며 engine production은 UI를 import하지 않는다.

이번 변경4파일:

1. `src/engine/liveRuntimeBridge.ts` 신규: 단일 receipt/cache owner, initial/automatic/shared 단계 예산, 정확 ledger 대조, 단일 runtime operation, frozen input/provider/결과.
2. `src/engine/liveMultiSourceOrchestrator.ts`: 기존 초기 receipt 처리를 owner로 이관하고 `initialResult()`·`sealRuntime()` 추가. 원천 결합·상세12/6/30·공간 선별 정책 불변.
3. `test/live-runtime-bridge.test.ts` 신규17건: 실제 기존 UI pair port와 CourseV1 이어보기를 연결하는 고정 fixture.
4. 본 문서 최신 절. 기존17개 multisource fixture나 UI·data·services·App·DB·env·보드·중앙 문서 변경 없음. 공유 dirty 변경 보존, stage/commit/push0.

### 9.2 초기 결과와 seal 계약

- `session.initialResult(): CourseV1ReleaseOneStopResult`는 대표+최대3대안을 반환한다. partial1/2/3도 `resultState: verified`이며 `alternativeState`는 기존 계약을 따른다.
- 후보0은 `no_representative_candidates/no_candidates`; 후보는 있으나 검증0은 `no_verified_course_within_limit/no_alternative_verified_course`; source/route unavailable은 후자에 `primaryOutcomeReason: route_verification_unavailable`을 붙인다. 실제 live 상태의 partial/empty/unavailable 구분은 기존 `view()`와 함께 사용한다.
- 마지막 실제 CourseV1 평가의 안전 diagnostics·continuation을 보존하고 `newProviderAttemptCount`/`adapterCallCount`는 전체 initial 단계의 실제 누계로 교체한다. provider body/원천 원문/URL/token을 result에 복사하지 않는다. receipt도 명시 허용 필드만 반환하여 adapter가 잘못 첨부한 raw 필드를 제거한다.
- `sealRuntime()`는 초기 계산을 마친 종료 조건에서 한 번만 가능하다. evaluate 진행 중, detail pending, detail 수락 후 아직 미평가, 초기 계산 전 또는 보충 가능한 미확정 상태는 `initial_not_final`이다. 두 번째 seal은 `session_sealed`다.
- seal 후 evaluate는 예외, reserveDetails/acceptDetails는 `session_sealed` 반환으로 차단한다. 초기 결과 열람은 허용하지만 초기 호출/상세 재개는 없다.
- bridge의 `input`은 기존 context와 세션에서 확정한 active+structured route pool(최대18·same-site 중복 제거)을 그대로 제공한다. 기존 시간·공간 선별을 다시 완화하지 않는다. origin/destination·정책·표본은 복사/동결하고, `now` getter는 매번 Date 복사본을 반환하여 caller의 setTime/setFullYear가 세션을 바꾸지 않는다.
- `input.provider`는 결정적 frozen candidate 복사본, `input.receiptRoutes`는 같은 방향/정확 좌표 cache, 필수 `input.routes`는 항상 null인 fail-closed port다. legacy HTTP fallback0. bridge/port는 navigation·DB에 직렬화하지 않는다.

### 9.3 예산·single writer·ledger 대조

- 초기 자동 one-stop **8**, pair automatic **16**, single/pair shared expansion **12**, 총 **36**. 기존 상수를 import해 재사용한다. initial8 소진으로 automatic/shared를 막지 않고, 단계 전환으로 다른 단계 예산을 재설정하지 않는다.
- 초기 adapter-call24는 batch 전체 누적, seal 이후 adapter-call24는 기존과 같이 operation별 상한이다. 신규 provider 시도는 operation이 바뀌어도 단계별/전체 누적이다. 캐시 hit는 신규0이며 방향·ID·정확 좌표로만 재사용한다.
- `bridge.run('automatic' | 'shared', uiLedger, operation)` 안에서만 runtime receipt를 사용할 수 있다. 실행 중 다른 run은 `runtime_operation_in_progress`; run 밖 direct receipt와 scope 밖 좌표는 무호출 unavailable이다.
- `ledgerStore.read()`는 마지막으로 UI가 관찰해 확정한 ledger, `actualLedger()`는 adapter 내부 실제 누계다. `bridge.ledger`는 **초기 snapshot**이며 후속 작업의 최신 ledger로 재사용하면 안 된다.
- UI의 기존 진행 tracker가 `ledgerStore.commit(next)`를 부르면 내부 실제 누계와 version/initial/automatic/shared/total을 모두 정확히 대조한다. 카운터 clamp로 차이를 숨기지 않는다. run 시작과 완료에서도 UI/committed/actual 일치를 확인한다.
- 오래된 ledger, 누락 commit, 잘못된 단계/category, 변조 count는 `ledger_mismatch`로 fail-closed하고 후속 실행을 차단한다. 이미 쓴 호출 예산을 rollback하거나 새 session으로 자동 재시도하지 않는다. `actualLedger()`를 UI 기대값에 그대로 복사하여 차이를 숨기는 연결은 금지한다.
- 요청 전에 허용량을 예약하고 정상 receipt로 실제 사용량만 정산한다. exception/손상 receipt는 예약을 보수적으로 소비한다. 늦은 호출도 예산 소실 없이 기록하며, adapter가 allowance 밖 실제 HTTP를 하지 않는 기존 포트 책임은 유지한다.

### 9.4 UI 등록 방법 — UI 담당 구현, 이번에는 실행하지 않음

현재 `v1Session.ts`에는 외부 live bridge를 등록하는 공개 함수가 **없다**. 단순히 `buildRelease`만 바꾸면 provider/cache가 기존 정적 input에 남으므로 올바른 연결이 아니다. UI 담당은 live 승인 분기에서 다음 순서로 등록해야 한다.

1. 같은 source session에서 초기 progressive loop가 종료되면 `const bridge = live.sealRuntime()`를 한 번 호출한다. `result = bridge.result`, `input = bridge.input`을 사용한다. 별도의 legacy/proxy adapter나 정적 provider를 다시 생성하지 않는다.
2. 기존 private `createSessionRuntime(input, result, false)`로 기본 runtime/표시 one-stop map을 만들고 `runtime.ledger = bridge.ledger`로 시작한다. `runtime.isCurrent`와 기존 personalization scope/화면 취소 검사를 유지한다.
3. 기존 UI pair port에 다음과 같은 ledgerStore를 주입한다. UI 기존 `commitLedger`의 clamp 이전에 bridge 검사를 실행한다.

```ts
const ledgerStore = {
  read: () => runtime.ledger,
  commit(next: ReleaseTwoStopAttemptLedger) {
    bridge.ledgerStore.commit(next); // 관찰 ledger와 실제 시도 누계를 먼저 대조
    commitLedger(runtime, next);
  },
};
const enginePort = createTwoStopSelectionEnginePort({
  ...bridge.input,
  ledger: bridge.ledger,
  ledgerStore,
  onCompletedExact: result => commitVerifiedPairResult(runtime, result),
});
```

4. 기존 `createFrozenTwoStopSeedPort`로 displayed one-stop/pair seeds와 pairSessionToken을 연결한다. `runtime.twoStopPort.begin`은 기존 `runSessionOperation(runtime, () => bridge.run('automatic', runtime.ledger, () => seededPort.begin(request)))`, continue는 동일 구조에서 phase만 `shared`로 등록한다. 실제 fixture는 UI port begin/continue를 실행하여 이 계약을 검증했다.
5. 기존 `continuationInputs.set(session, bridge.input)`와 `sessionRuntimes.set(session, runtime)`에 보관하고 결과만 화면에 반환한다. 이 WeakMap들은 UI 소유 private 구현이며 새 engine export로 흉내 내지 않는다.
6. single 더보기도 기존 `runSessionOperation` 안에서 `bridge.run('shared', runtime.ledger, ...)`로 감싼다. 기존 `min(8, 12 - sharedExpansionAttempts)`와 CourseV1 continuation을 유지하고, page diagnostics의 관찰 사용량으로 만든 next ledger를 **bridge.ledgerStore.commit 검사 → UI commit** 순서로 반영한 뒤 run을 끝낸다. 기존 continuation을 새 initial builder로 대체하지 않는다.

이 순서는 UI 담당의 후속 수정 명세이며 이번 세션이 위 UI 등록을 완료했다는 뜻이 아니다. Results 렌더링은 기존 compatible result를 사용하며 partial 정상 코스를 빈 결과로 숨기지 않는다. flag/활성화 변경0.

### 9.5 검증·실패 선행

- RED: 새 fixture10건을 먼저 실행하여 `initialResult/sealRuntime` 부재·bridge 파일 부재로 **0 PASS/10 FAIL**을 확인했다.
- 구현 후 남은1건은 raw 비노출 fixture의 `/lat/`가 `relationshipRejected` 같은 정상 필드명까지 매칭한 테스트 오류였다. 정확한 JSON `lat/lon` key 검사로 바로잡았으며 제품 필드 은폐·skip은 하지 않았다.
- 신규 최종17건: partial1/2/3/ready4 호환, empty/no-route/unavailable, 실제 UI pair begin/continue, initial8→automatic16/shared12/총36, 최초→pair cache 재사용, 최대2·시간/closing, pending/evaluating/sealed lifecycle, double seal, caller mutation, 동시 실행, ledger 누락·오분류·stale, exact coordinate/direction binding, 기존 single continuation, raw receipt 제거, deterministic18/same-site, public 미연결.
- 집중: `node --import tsx --test test/live-runtime-bridge.test.ts test/live-multisource-orchestrator.test.ts test/live-progressive-orchestrator.test.ts test/release-three-hour-engine.test.ts test/release-two-stop-selection.test.ts test/dwell-personalization-course.test.ts test/qa-two-stop-integration.test.ts test/ui/two-stop-selection.test.ts` → **141/141 PASS**, skip0. `/private/tmp/rec-live-runtime-focused.log`.

### 9.6 보존 경계·남은 위험

- 최대180분/최대2곳·기존 체류/개인화·운영시간/도착여유·공간/중복·field ownership·상세12/6/30·기존 API 포트 정책 불변. 순수 engine budget ownership과 runtime 입력만 연결했다.
- data/services/UI/App/DB/env/중앙 문서/보드 수정0, actual API/배포/계정/secret 접근0, stage/commit/push0. 팀의 병렬 data/API facade 변경은 수정하거나 되돌리지 않았다.
- 공개 UI 등록, 취소/화면 복원·scope 만료의 실제 앱 연결, 실제 API/운영 한도/실기기·release artifact는 후속 활성화 검증이다. 이번 fixture가 운영 정확도나 출시 승인을 대신하지 않는다.

### 9.7 완료 인계·최종 테스트

1. **변경 파일:** §9.1의4파일. 새 bridge17건과 기존 multisource17건 모두 직접 실행했으며 이전 완료 숫자로 대체하지 않았다.
2. **보존 계약:** §9.2~9.4의 기존 compatible Results·pair/runtime·8/16/12/36·최대180분/2곳·순수 계산 경계. public 등록·flag 변경0.
3. **테스트:** focused **141/141 PASS**. 최종 `npm run test:typecheck` **PASS(exit0)**. `npm test` **589/589 PASS(exit0)** (`/private/tmp/rec-live-runtime-core.log`). `npm run test:ui`는 tsx IPC EPERM으로 시작 전 실패했고 동일 glob의 `node --import tsx --test test/ui/*.test.ts test/ui/*.test.mjs`로 **824건 중823 PASS/0 FAIL/기존1 SKIP(exit0)** (`/private/tmp/rec-live-runtime-ui-node.log`). npm UI 명령 자체의 성공으로 쓰지 않는다. `git diff --check`와 변경/신규 파일 whitespace 검사 **PASS**. core 숫자는 공유 tree의 당시 실행값이며 새 `.ts`17건은 집중 명령에서 따로 검증한다.
4. **UI 등록·다음 위험:** §9.4의 정확한 input/result·WeakMap·ledgerStore·run 단계 binding을 UI 소유 세션에서 구현해야 한다. bridge를 그냥 기존 builder만 교체하는 방식으로 연결하지 않는다. 실제 UI lifecycle·source/API facade 연결, 운영 호출·배포·실기기 검증은 미실행이다.
