# DB-LIVE-LEARNING-EVIDENCE-01 — 로컬 학습 증거 계약·구현

통합 수락 기록(2026-09-07): 6절 실제 DTO/서비스/production exports 검토, 집중96/96 및 typecheck 직접 재실행 PASS. **UI/native 소비 계약 수락·UI 구현 실행 승인**. 아래 통합 확인 대기는 해제됐다. 기존 UI diagnostic 1 FAIL은 직접 재현했으며 UI 후속 명령에서 성공 회귀로 전환한다. 앱 전체/네이티브/원격/출시 수락은 아니다. 다음 명령: `../uiux/live-learning-evidence-integration.md`.

상태: **DB 서비스·production export 구현 및 자동 fixture 검증 완료·통합 계약 확인 대기**. 담당 DB·개인화 단일 writer. 사용자 결정 DEC-LIVE-LEARNING-EVIDENCE-01의 첫 구현 작업이다. 이번 결과는 UI/native 연결을 위한 서비스 인수인계이며 앱 학습 전체/출시 완료가 아니다. 최신 결과와 소비 순서는 아래 6절이다.

## 1. 읽기 순서와 근거

AGENTS.md → docs/README.md → DB README·데이터베이스설계.md → release-personalization-account.md의 DEC-LIVE-LEARNING-EVIDENCE-01 → release-identity-personalization.md의 공유 잠금/cold 조회 완료 인수인계 → uiux/live-activity-learning-evidence.md의 조사 결과를 읽는다. 상대 경로는 docs/work 기준으로 찾고 archive 전체를 읽지 않는다.

현재: 앱 도착만 stop 적격성을 캡처하고 native receipt에는 당시 계정·동의 근거가 없다. 복귀 때 현재 동의를 조회해 과거 도착에 붙이는 방법은 금지다. 교체: 시작 당시 확정 상태에 연결된 로컬 참조를 발급하고 확인 순간 증거를 로컬에서 검증한 뒤 기존 완료 표본 경계로 넘긴다. 교체 이유는 재탭 없이 native 학습을 지원하면서 소급 수집을 막기 위함이다. 상태는 정책 확정·구현 전이며 기존 보호 조건은 소비자 전환 전 유지한다.

## 2. 소유 범위와 불변

- DB services/repositories·DB 소유 테스트·이 문서만 수정한다. 기존 runtime/production composition을 재사용한다. src/ui, App.tsx, plugins/Swift, 엔진·카탈로그·중앙 정책 문서는 수정하지 않는다.
- 이전 세 보완과 공유 잠금/cold 조회 수락을 유지한다. 원격 조회를 storage lock 안에 넣지 않는다. 필수 local 완료는 학습·원격 대기를 기다리지 않는다.
- 회원+별도 동의의 새 적격 코스만 학습한다. guest/anonymous/unverified/import/구형 증거/일반 알림 액션은 제외한다. 앱과 native의 새 유효 증거는 동일 소비 계약을 사용한다. 기존 null을 현재 동의로 승격하지 않는다.
- 방문 ack→표본 제출, 최초 기준7일/최대32건, 서버180일, owner/generation/epoch·멱등 ID·최소 payload를 유지한다. 신규 원격 endpoint/서버 receipt·GPS·권한·보유기간은 추가하지 않는다. 원격 적용·운영 데이터·commit/push 금지. SQL 변경 필요성이 발견되면 범위·이유를 인계하고 임의 확장하지 않는다.

## 3. 공개 계약을 먼저 고정하고 같은 작업에서 구현

조사 문서의 함수명/DTO는 제안이다. 실제 기존 타입·entry와 비교해 재사용/신규를 정하고, **정확한 export·입출력 union·실패·부수효과·순서·소비 예제**를 본 문서에 먼저 적은 뒤 로컬 구현한다. 단순 문서 제안으로 끝내지 않는다. 승인된 정책 안의 기술 명명은 결정 가능하나 정책 확대가 필요하면 해당 부분만 질문한다.

필요 기능:

1. **증거 준비:** 기존 immutable run과 실제 stopId↔ordinal에 연결한 불투명 참조/schema/generation 준비. account ID·JWT·이메일·동의 원문은 native projection에 넣지 않는다. 참조를 서버 인증이나 방문 증명이라고 표현하지 않는다. missing run 생성0, runEligibility null 승격0, 원격 호출0. 새 begin 확정 직후 허용할 발급 창과 이를 닫는 시점, cold 재발급/중복 준비의 멱등성을 명시한다. 늦은 로그인/on으로 이미 시작한 코스에 증거를 추가하지 않는다.
2. **publication 확인:** DB prepared와 native 저장 ack를 구분한다. native projection 저장과 DB ack 사이 crash/확인이 발생하는 순서를 고정하고, 당시 publication 근거 없이 나중 ack만으로 과거 확인을 승인하지 않는다. 기존 ref/generation과 exact run, 취소·삭제·전환의 유효성을 재검증한다. native 저장은 주입 port/ack로만 모델링하고 실제 Swift는 수정하지 않는다.
3. **확인 증거 소비:** receipt run/stop/event/type/source/baseRevision와 optional evidence를 검증해 stop eligibility·최초 소비 판정을 원자적으로 저장한다. accepted/already_accepted/excluded/conflict/unavailable을 구분한다. app/native는 같은 entry; 일반 알림 제외. progress reducer에서 실제 적용된 최초 확인과 단순 stale를 구분하기 위해 UI가 전달할 최소 적용 근거를 명시한다. 현재 동의 조회·raw 시각 복제로 이를 대체하지 않는다.
4. **멱등 복구:** 진행 저장 직후 종료, 증거 저장 직후 receipt ack 전 종료를 모두 지원한다. 같은 최초 event는 재처리 가능하지만 다른 event로 null/제외 상태를 덮어쓰지 않는다. DB 소비가 실패하면 ack 성공을 합성하지 않는다. 소비 상태 저장/receipt ack의 소유 경계와 cleanup 후 missing 동작을 UI에 정확히 인계한다.
5. **무효화:** Auth 전환·off/reset/delete·코스 종료의 로컬 generation과 참조 차단을 기존 production 이벤트/동의 wrapper에 연결한다. native 제거 실패에도 DB가 옛 참조 수용을 거절한다. 다른 기기 철회는 기존 서버 최종 검증으로 거절한다. pending 발급·consume·publication의 늦은 응답이 삭제 상태를 복구하지 못하게 한다. 로그아웃과 필수 진행은 학습 실패로 막지 않는다.
6. **완료·정리:** 적격 확인을 기존 최소 표본/복구 가능한 대기로 안전하게 투영한 뒤 활성 ref/receipt 관련 메타데이터를 정리할 공개 순서를 제공한다. 원격 ack를 기다리며 활성 증거를 무기한 유지하지 않는다. 기존 retry가 참조하는 owner/run-stop 최소 정보와 제거 가능한 활성 증거를 구분해, 정리 후 cold retry도 정상 작동하게 한다. 완료 시 증거 저장 미확정이면 학습은 terminal 제외하고 local 완료 유지. 완료 후 callback 재생성0. 취소/만료/교체는 표본 없이 exact 활성 증거 정리. 별도 영구 receipt/장기 보유기간 금지.

실제 production exports까지 연결하고 read/reset/delete/outbox 기존 소비자와 충돌을 검사한다. UI가 임의 DB 저장소를 만들 필요가 없는 것이 완료 기준이다. 최소 표본 저장과 활성 증거 정리가 여러 저장소라면 원자적이라고 주장하지 말고 단계별 crash 복구와 보수적 제외를 명시한다.

## 4. 실패 우선 fixture

### 구현 전 고정 공개 계약 — 2026-09-07

아래 이름으로 같은 작업에서 구현한다. UI용 export는 `src/services/releaseIdentitySupabase.ts`, DTO/port는 `src/services/liveLearningEvidence.ts`다. UI/native 연결은 통합 확인 뒤이며 새 receipt는 기존 DTO에 optional evidence를 붙인다.

- `prepareOwnedRunLearningEvidence({courseRunId,stops:[{stopId,stopOrdinal:1|2,contentId}]})`: `prepared {projection}` / `excluded {reason}` / `conflict` / `unavailable`. 새 begin이 **같은 runtime에서 처음 captured**된 직후부터 최초 확인·window_closed·완료/취소/교체·Auth/동의 변경 전까지 발급한다. cold는 기존 동일 prepared mapping만 재사용하고 새 발급0. missing/guest/unverified/null/legacy는 excluded. 현재 인증·동의 조회0, owner 생성0.
- projection: `{schemaVersion:1,courseRunId,evidenceRef:string,captureGeneration:number,publicationToken:string|null}`. 참조·토큰은 random UUID, generation은 기기 로컬 단조 경계다. 계정 ID/JWT/이메일/동의 원문/좌표/시각 없음. null token은 prepared이며 확인 당시 증거로 사용할 수 없다.
- `confirmOwnedRunEvidencePublication({projection,nativePreparedAck:projection})`: exact 준비 저장 ack 후 `authorized {projection}` / `excluded {reason}` / `conflict` / `unavailable`. DB에 **새 publicationToken을 저장한 뒤** 반환한다. 준비 단계에는 이 token이 없으므로 뒤늦은 DB ack가 과거 확인을 승인하지 못한다. 동일 준비 ack 재시도는 같은 token을 반환한다.
- `publishOwnedRunLearningEvidence({projection},port)`: port의 `storePrepared(projection):Promise<projection>` → 위 confirm → `activate(authorizedProjection):Promise<projection>` → exact 확인 뒤 `published {projection}` / `excluded {reason}` / `conflict` / `unavailable`. native 대기는 공유 저장 잠금 밖이다. `authorized`는 DB 활성화 허가, `published`는 native activate ack까지 관찰함이다. activation 저장 뒤 응답 유실이어도 **확인 순간 실제 token을 읽은 receipt**만 소비 가능하며, 원격/파일 다중 트랜잭션이라고 표현하지 않는다.
- `acceptOwnedConfirmationEvidence({receipt,application})`: receipt는 `{courseRunId,stopId,eventId,baseRevision,type,source,evidence?:{schemaVersion,evidenceRef,captureGeneration,publicationToken}}`; application은 `{courseRunId,stopId,stopOrdinal,firstArrivalEventId,arrivalBaseRevision,source,outcome:'applied'|'replayed_first'|'stale'}`. UI가 기존 reducer의 **최초 적용 도착 event와 stop 대응을 진행 상태와 함께 저장**해야 한다. processedEventIds 포함/낮은 revision/수신 시각만으로 replayed_first를 합성하면 안 된다. accepted / already_accepted / excluded {reason} / conflict / unavailable. app_action/live_activity_intent의 arrival_confirmed만 허용한다. stop eligibility와 최초 소비 결론을 같은 owner envelope write로 저장한다. 다른 event는 첫 null/제외를 덮어쓰지 않는다.
- `closeOwnedRunLearningEvidence({courseRunId,reason:'completed'|'cancelled'|'expired'|'replaced'|'window_closed'})`: `closed {courseRunId}` / `excluded {reason}` / `unavailable`. local-only exact run 활성 참조/consumption metadata 정리. completed는 실제 local 완료 확인 후만 허용한다. 최소 stop eligibility/learning은 완료 retry를 위해 유지하며 raw receipt/active 참조를 outbox로 복제하지 않는다. 다른 종료는 학습 제외, 방문 이력 삭제0. native exact projection 제거는 UI 책임이며 이 호출 성공이 native 삭제 성공은 아니다.
- `invalidateOwnedLearningEvidence()`: 즉시 메모리 차단 후 durable local generation 증가·active 참조 폐기, `invalidated` / `unavailable`. Auth/동의 wrapper·reset/delete에도 자동 연결한다. native 제거 실패와 무관하게 DB의 이전 ref 승인0. 기존 완료 pending은 기존 owner/epoch/7일 서버 검증으로만 재시도한다.

공통 excluded reason은 `invalid_input | not_found | ineligible | window_closed | stale_generation | not_published | invalid_evidence | not_first_arrival | unsupported_source | terminal | completion_not_saved`다. 손상/로컬 read/write 실패는 unavailable이며 완료/receipt ack 성공을 합성하지 않는다. conflict는 exact run/stop/mapping/event/ack가 다른 경우이며 UI는 진행의 최초 event를 보존하고 충돌 receipt만 진단·제외한다. accepted/already_accepted/excluded만 학습 처리 완료로 receipt ack 가능; unavailable은 같은 receipt/적용 근거를 활성 수명 내 재시도한다.

구현 전 저장 경계 보완: 위 초안의 **owner envelope에 증거 소비까지 같은 write**는 철회한다. optional 증거 write 자체가 무응답이면 공유 완료 lock을 다시 점유하는 반례 때문이다. 활성 증거는 `@timefit/live-learning-evidence-v1/<encoded runId>`에 별도 직렬화한다. 이 단일 active record에 최초 소비 결론과 적격 stop mapping을 원자 저장하고, write ack된 메모리 snapshot만 필수 완료에서 owner envelope의 기존 최소 stop/learning으로 투영한다. 둘 사이 전체 atomic 보장은 하지 않는다. cold는 같은 receipt+최초 적용 근거를 accept로 복구한 뒤 완료하며, 복구 미확정 상태에서 먼저 완료하면 학습은 제외한다. 필수 완료는 optional read/write를 await하지 않는다. 생성/폐기 generation과 run 종료 marker는 기존 owner envelope에 둔다.

`closeOwnedRunLearningEvidence`의 closed 응답에는 `activeCleanup:'pending'`을 추가한다. 먼저 owner run 수집을 닫고 optional 파일 제거는 비차단 시작한다. `purgeOwnedRunLearningEvidence({courseRunId})`는 `purged` / `excluded {reason}` / `unavailable`로 exact optional 파일 삭제를 재시도한다. 이 함수는 optional 저장 큐를 기다릴 수 있어 필수 cleanup 앞에서 await하지 않는다. 종료 marker가 파일 제거 실패/늦은 optional write와 무관하게 재승인을 거절한다.

`retryOwnedLearningEvidenceCleanup()`은 owner envelope의 닫힌 run을 내부에서 열거해 exact optional 삭제를 재시도하며 `{status:'cleaned'|'pending',purgedCount,pendingCount}` 또는 `{status:'unavailable'}`을 반환한다. ID/owner를 외부에 열거하지 않고 다른 활성 run은 건드리지 않는다. boot/foreground의 비차단 정리 entry로 제공하여 UI가 별도 영구 cleanup 목록을 만들지 않게 한다.

계정 삭제로 owner snapshot을 제거할 때는 삭제와 같은 envelope commit에 `evidenceCleanupRunIds`(미정리 exact ID만)를 남긴다. optional 파일 삭제 성공 뒤 이 짧은 cleanup 작업 목록에서도 제거한다. 이것은 영구 receipt 이력이 아니며 삭제 실패 때문에 참조 파일이 발견 불가능한 orphan이 되는 것을 막는 crash 복구 메타데이터다.

호출: 새 begin 확정→prepare→publish를 선택 작업으로 실행; action-time projection 고정→진행 최초 적용/저장→accept→receipt ack. 필수 완료는 위 Promise를 기다리지 않고 기존 preserveUnverified→complete→exact active cleanup/close→별도 sync를 사용한다. close는 network/native/optional 증거 큐를 기다리지 않는다. 완료 전에 소비가 확정되지 않은 학습은 제외하며 완료 후 새 표본을 만들지 않는다. native receipt/진행 storage 변경은 후속 UI writer 책임이다.

- 새 회원+동의 run의 app/native 확인→완료→방문 ack→표본 저장→조회→기존 엔진3개 적용. 독립 코스3건, 같은 세부 카테고리, baseline과 다른 유효 stay를 사용한다. 1/2건 기본·3건 실제 보정, 중복 제출 증가0. production factory에 storage/native publication/identity/remote만 주입하고 실외부 호출0.
- guest/import/미동의/unverified/null/구형/일반 알림0. 늦은 로그인/on/현재시각 대체0. app/native 경쟁은 최초 동일 stop1건만 반영.
- prepared 전·native 저장 전·저장 후 DB ack 전·published 후 확인을 나누고 exact publication 불일치/증거 손상/다른 run·stop·generation을 검사한다. 여러 파일 atomic write만으로 cross-process 보장을 주장하지 않는다.
- 진행 적용 후 crash/증거 저장 후 ack 전 crash/중복 receipt/cold replay에서 원래 확인 보존·표본1회. stale 또는 과거 제외는 승격0.
- 발급/소비 중 A→B→A, off→on/reset/delete, active 교체, native 제거 실패, 늦은 ack에서 신규 학습 부활0·다른 owner cleanup0.
- unresolved remote 및 publication/증거 저장 실패 중 local 명시 완료 비차단. 늦은 증거가 완료 후 표본을 생성하지 않음. local 저장 자체 실패는 성공으로 위장하지 않음.
- 활성 증거 정리 뒤 offline→cold sync 성공, 최초7일/32건 제거 표본 부활0, 서버180일 유지. 증거 정리가 방문 기록을 삭제하지 않음.

## 5. 검증과 다음 세션 인수인계

신규 집중 테스트 + 기존 identity lock/priority/device/dwell 계약 + `npm run test:typecheck`, `npm test`, `npm run test:ui`, `git diff --check`를 실행한다. 현재 UI의 구형 lock 진단 실패는 정확히 분리 보고하며 DB가 UI assertion을 변경하지 않는다. 다른 실패는 숨기거나 skip 처리하지 않는다. UI 병렬 작업 중 전체 게이트 실행 시점을 조정하고 실제 실행값을 기록한다. native 빌드/실기기는 이번 DB 작업 범위가 아니다.

완료 기록: (1) 변경 파일·목적/교체 이력 (2) 유지한 계약·정확한 exports/DTO/schema/직렬화 예제 (3) 최초 실패와 최종 테스트·미검증 (4) UI/native의 준비→publish→action-time receipt→consume→ack→완료/정리→sync 호출표, invalidation/cold/오류 대응·남은 위험.

UI/native와 공유할 계약표는 구현이 안정되는 즉시 중간 인수인계하되, UI 실제 연결 시작은 통합 계약 확인 뒤다. 기존 진행 버튼에 추가 탭을 요구하거나 보안상 불명확한 표본을 허용하는 대안은 채택하지 않는다.

## 6. 완료 인수인계 — 2026-09-07

### 1. 변경 파일·목적 / 교체 이력

- `src/services/liveLearningEvidence.ts`: 4절에서 먼저 고정한 DTO·결과 union·publication port와 실제 로컬 서비스를 구현했다. 정확한 alias는 다음 항목과 production 파일에 있다. app/native source를 같은 consume에서 처리하고, 원격 consent/identity lookup을 소비 함수 안에 넣지 않았다. generation·exact run/stop/content mapping·event/baseRevision/source·최초 적용 근거·publicationToken을 검사한다. 유효한 첫 event와 eligibility 투영용 mapping/결론은 한 active record에 write하며 동일 event 재처리는 `already_accepted`, 다른 event/source/revision은 `conflict`다.
- `src/services/releaseIdentityPersonalizationRuntime.ts`: 기존 begin의 신규 commit 직후에만 메모리 준비 창을 열고, 기존 snapshot 재조회/cold begin에는 열지 않는다. 증거 prepare가 owner envelope에 `evidenceMode:'active'`, `evidenceScopeGeneration`을 먼저 기록한다. `evidenceGeneration`은 로컬 수집 경계의 단조 generation이다. 완료/종료는 `evidenceMode:'closed'`로 닫는다. 이전 owner·stop schema는 호환 유지하며 새 mode가 없는 기존 app callback 경로는 보존했다. **새 evidence run에서 구형 capture로 fallback하여 현재 동의를 채우는 것은 금지**다.
- 이전 설계 초안: 증거 소비까지 owner envelope의 같은 lock/write → optional 증거 storage 무응답이 필수 완료를 다시 막는 반례 → optional run별 별도 key/queue와 ack된 메모리 투영으로 교체 → 완료는 optional 큐를 await하지 않고, 이미 확정된 mapping만 기존 owner stop/learning에 저장한다. 여러 저장소 전체 atomic 보장은 철회했다. 상태: **교체 구현·실패 경계 fixture 통과**.
- `completeCourseRun`은 호출 순간 해당 run의 늦은 승인부터 메모리에서 차단한다. owner-local 완료 저장 뒤 확정 mapping의 contentId와 실제 완료 장소 ordinal을 다시 비교한다. 증거가 미확정/손상/다른 content이면 학습만 제외한다. 기존 최소 stop `confirmationEventId/eligibility/learning` 외 active ref/token/application proof는 outbox/서버에 복제하지 않는다. owner metadata write 실패도 local 기록 성공은 유지하고 learning 제외로 반환한다.
- 완료·취소·만료·교체·수집 무효화는 활성 파일 purge를 비차단 시작한다. account snapshot 제거와 같은 commit에 아직 지워야 할 exact `evidenceCleanupRunIds`를 보존하여 삭제 실패/종료 뒤 orphan을 cold cleanup에서 발견한다. cleanup 목록은 파일 삭제 확인 뒤 제거하며 별도 receipt 이력/장기 보유기간이 아니다.
- `src/services/releaseIdentitySupabase.ts`: 신규 8개 UI export, 기존 실제 consent mutation wrapper 및 Auth observer를 production runtime에 연결했다. native UUID는 이미 설치된 Expo Modules Core `uuid.v4()`를 주입하며 시각/Math.random 대체는 없다. native bridge import/Swift 변경 없이 실제 port를 UI가 넘길 함수까지 구현했다.
- `test/fixtures/liveLearningEvidenceFixture.ts`, `test/live-learning-evidence.test.ts`: 실제 identity/완료/dwell/runtime factory와 고정 storage/native ack/remote를 조합했다. cold 일부는 새로운 storage port 객체를 만들어 process-local WeakMap에 의존하지 않고 persisted generation/종료 marker/receipt 복구로 확인했다.
- 이 작업 문서: 구현 전 계약과 변경 이유, 아래 실제 인수인계를 기록했다. 중앙 정책·보드·다른 역할 문서는 수정하지 않았다.

### 2. 유지 계약 / 실제 exports·schema

아래 이름은 **구현된 export**이며 `src/services/releaseIdentitySupabase.ts`에서 가져온다. DTO/port와 explicit result union은 `src/services/liveLearningEvidence.ts`에 있다. 아래 반환에 없는 성공을 UI가 합성하지 않는다.

| export | 실제 성공 | 그 밖의 결과 |
| --- | --- | --- |
| `prepareOwnedRunLearningEvidence` | `{status:'prepared',projection}` | `EvidenceFailure` |
| `confirmOwnedRunEvidencePublication` | `{status:'authorized',projection}` | `EvidenceFailure` |
| `publishOwnedRunLearningEvidence` | `{status:'published',projection}` | `EvidenceFailure` |
| `acceptOwnedConfirmationEvidence` | `{status:'accepted'|'already_accepted'}` | `EvidenceFailure` |
| `closeOwnedRunLearningEvidence` | `{status:'closed',courseRunId,activeCleanup:'pending'}` | `EvidenceFailure` |
| `purgeOwnedRunLearningEvidence` | `{status:'purged'}` | `EvidenceFailure` |
| `retryOwnedLearningEvidenceCleanup` | `{status:'cleaned'|'pending',purgedCount,pendingCount}` | `{status:'unavailable'}` |
| `invalidateOwnedLearningEvidence` | `{status:'invalidated'}` | `EvidenceFailure` |

`EvidenceFailure = {status:'excluded',reason:LearningEvidenceExclusion} | {status:'conflict'|'unavailable'}`. 입력과 reason 전체는 4절/실제 타입을 따른다. 신규 함수의 손상·storage 실패는 `unavailable`로 수렴시키며 raw 오류/token을 반환하지 않는다. 계정 소유권 조회는 종전 `readOwnedCourseRunOwnership`의 found/not_found/corrupt/unavailable 계약을 계속 사용한다.

projection/receipt의 직렬화 예(모두 fixture, 실제 토큰 로그 금지):

```json
{
  "schemaVersion": 1,
  "courseRunId": "fixture-run",
  "evidenceRef": "00000000-0000-4000-8000-000000000001",
  "captureGeneration": 4,
  "publicationToken": "00000000-0000-4000-8000-000000000002"
}
```

prepared에서는 마지막 값이 `null`이다. native가 확인 순간 위 projection을 읽고 receipt의 optional `evidence`에 schemaVersion/ref/generation/token을 고정한다. evidence의 courseRunId는 생략 가능하고, 있으면 receipt run과 같아야 한다. 계정/JWT/이메일/동의 원문/GPS/raw 시각을 붙이면 증거 검증이 거절한다. native Intent의 버튼 parameter에 오래 박힌 ref나 복귀 시 현재 token으로 채우지 않는다.

publication 세부 불변:

1. `storePrepared` ack는 exact null-token 준비 identity의 저장 증거다. 같은 ref의 중복 준비는 이미 활성인 native projection을 null로 내려 쓰지 않는 멱등 port여야 한다.
2. DB `authorized` commit 후 처음 발급된 publicationToken을 `activate`로 전달한다. native 확인은 실행 순간 그 active token이 실제 저장돼 있을 때만 receipt에 넣는다. activate 저장 뒤 ack가 유실돼도 그 token을 실제 읽은 receipt는 cold에서 검증 가능하다.
3. 준비 저장 전/준비만 저장됨/DB authorization 전 확인은 token이 없으므로 나중 ack로 승인되지 않는다. 처음 excluded가 저장된 stop을 나중 token으로 다시 제출해도 제외를 유지한다. native 파일 write/receipt write/DB write를 하나의 process 간 트랜잭션이라고 하지 않는다.

회원·별도 동의·소급 학습0·guest/import/legacy 제외·원래 generation/epoch·최소 payload·방문 ack→sample, outbox 최초 7일(정확한 경계 포함)/32건 terminal 비재등록·서버 180일·엔진3개/최근5개/기본±10분 정책은 변경하지 않았다. 새 원격 endpoint/migration은 없다.

### 3. 실패 우선·최종 검증 / 미검증

- 최초 새 공개 runtime fixture **2 FAIL**: prepare/export 미구현으로 app/native 학습 경로와 publication 무응답 분리 모두 실패했다. 동일 테스트를 구현 후 통과시켰다.
- 추가 publication 전 확인 fixture에서 **1 FAIL**: consume가 제외를 반환했지만 fresh 준비 창을 닫지 않아 나중 prepare가 성공함을 발견했다. 최초 확인의 제외 때 owner 창도 닫도록 고쳐 동일 fixture가 통과했다.
- receipt ack 후 종료 fixture에서 **1 FAIL**(durable accepted는 남았으나 cold 완료 cache 복구 누락)을 추가 재현했다. 동일 mapping의 중복 prepare가 기존 accepted 결론만 읽어 cache에 복원하도록 고쳤다. 새 참조/증거/receipt를 생성하거나 null을 승인하지 않는다.
- 신규 증거 fixture **42/42 PASS**. 기존 lock18/priority12/device8/dwell5/owned6/account5를 합친 집중 **96/96 PASS**, fail/skip0.
- 실행: `npx tsx --test test/live-learning-evidence.test.ts test/release-identity-lock-ownership.test.ts test/release-identity-priority-remediation.test.ts test/release-identity-device-flow.test.ts test/dwell-storage-contract.test.ts test/release-owned-completion.test.ts test/release-account-contract.test.ts`.
- `npm run test:typecheck` PASS. `npm test` **267/267 PASS**. `npm run test:ui` **520 PASS / 기존 skip1 / FAIL1**. 유일 실패는 `test/ui/owned-course-lifecycle.test.ts:82`의 구형 DB lock diagnostic이며, 기대 false와 달리 원격 응답 전에 local 완료가 true가 된다. 이 assertion은 UI 소유라 수정/skip하지 않았다. 이 작업의 기능 실패나 전체 UI PASS로 바꾸어 보고하지 않는다.
- 실제 엔진 entry에서 독립 native 완료1/2개→30분 기본, 3개→40분 실제 stay를 검증했다. 같은 이벤트 재처리 표본 증가0, 2stop exact content/mapping, swapped content0, guest/anonymous/인증 실패0, notification/legacy/증거 손상/현재시각 대체0, publication 전후/cold first replay/ack 유실/경쟁 이벤트, A→B→A/off→on/reset/delete/취소·만료·교체/늦은 prepare·consume·activate, optional write 무응답 중 필수 완료, 활성 증거 삭제 후 cold sync, 새 경로의 33개 상한/7일 초과 비부활, 삭제 orphan 복구와 다른 활성 run 보존을 검증했다.
- `git diff --check` 및 이번 untracked 파일들의 `git diff --no-index --check /dev/null <file>`: whitespace 진단0. 후자의 exit1은 신규 파일 차이 존재다.
- 실외부 API/운영 DB 호출0. SQL/원격 migration/배포/commit/push, UI/native 수정0. native 빌드·실기기·App Group cross-process 파일 lock/OS 잠금 접근은 이번에 실행하지 않았으며 후속 UI/native·QA 게이트다.

### 4. UI/native 호출표 / 복구·오류·남은 경계

| 시점 | 호출 / 기다릴 것 | 실패·재시작 처리 |
| --- | --- | --- |
| 새 적격 run 시작 | 새 `beginOwnedCourseRun`의 captured 후 same-runtime `prepareOwnedRunLearningEvidence` → `publishOwnedRunLearningEvidence(prepared, nativePort)`를 **선택 작업**으로 실행 | 기존 immutable stopId/실제 방문 ordinal/contentId를 준다. 기존 run을 begin으로 재발급0. 시작 bootstrap이 증거 없이 끝났거나 **미발급 상태에서** 첫 확인이 발생하면 `close(...window_closed)`; 이미 published인 정상 run의 첫 확인에는 close하지 않는다. 늦은 로그인/on/조회 성공으로 재발급하지 않는다. 첫 Activity/Kakao/필수 진행은 publication Promise를 기다리지 않는다. |
| app/native 확인 순간 | exact active projection을 즉시 고정하여 receipt에 optional evidence로 저장 | prepared/null/읽기 오류면 증거 없이 진행. 알림은 항상 학습 제외. 현재 시각/복귀 때 token/현재 consent로 채우지 않는다. |
| receive와 reconcile 양쪽 | reducer 최초 적용 event↔stop↔baseRevision↔source를 **진행 상태와 함께** 저장 → `acceptOwnedConfirmationEvidence({receipt,application})` | 최초 event 저장 직후 종료해도 같은 receipt에 `replayed_first`를 전달해 복구. 단순 processedEventIds/stale/낮은 revision만으로 최초 적용을 합성하지 않는다. 이 최소 UI progress schema 연결은 후속 writer 책임이다. |
| receipt ack | accepted/already_accepted 또는 확정 excluded 뒤 exact receipt ack | unavailable은 ack 금지·활성 수명 내 동일 payload/최초 적용 근거 재시도. conflict는 성공 아님; 별도 reducer 판단 없이 경쟁 receipt를 최초 event로 교체하지 않는다. 증거 write 후 ack 전 종료는 already_accepted로 수렴. |
| ack 완료 후 cold active 복구 | 동일 immutable stop mapping으로 `prepareOwnedRunLearningEvidence` 재호출 | 기존 active record가 있을 때만 같은 ref와 durable accepted 결론을 메모리에 복원한다(storage write0). receipt를 재생성하지 않는다. record가 없으면 새 발급0. 복구가 미확정인데 사용자가 먼저 완료하면 필수 완료를 막지 않고 학습만 제외한다. |
| 명시 완료 | 종전 `preserveUnverifiedOwnedCourseRun` → `completeOwnedCourseRun`의 실제 local completed → exact UI/Activity/알림 cleanup | **증거/publication/consume Promise를 완료 앞에서 await하지 않는다.** cache에 durable accepted가 없으면 해당 학습 제외. cold에서 receipt를 아직 replay하지 않고 먼저 완료한 경우도 제외; 원격 방문 이력은 유지된다. 완료 뒤 callback 승격0. |
| 완료 직후 | 선택 정리 `closeOwnedRunLearningEvidence({courseRunId,reason:'completed'})`; 기존 별도 retry sync | complete 자체도 owner mode를 닫고 purge 시작. close의 pending은 native 제거 성공 아님. 표본 전송이 늦어도 active ref를 유지하지 않는다. 기존 최소 owner stop/learning만 cold sync에 필요하다. |
| 취소/만료/교체 | exact run으로 close(reason) 후 UI가 native projection/receipt exact 제거 | 다른 active ID를 지우지 않는다. DB close가 unavailable이어도 진행에 재탭/로그인 강요0; 학습은 메모리 차단, durable 정리 재시도. native 제거 실패에도 성공한 DB 종료 marker/generation이 이전 ref를 거절한다. |
| Auth/off/reset/delete | production observer/mutation wrapper가 즉시 memory fence를 올리고 local generation·active 폐기를 시작 | Auth callback은 네트워크 await0. INITIAL_SESSION은 같은 owner의 cold 증거를 보존하되 다른 owner면 무효화한다. 초기 local 확인 완료 전은 evidence unavailable. 같은 account token refresh/반복 SIGNED_IN은 전환으로 오해하지 않고, 실제 전환/로그아웃은 폐기한다. |
| boot/foreground | 비차단 `retryOwnedLearningEvidenceCleanup()` + 기존 `readPendingOwnedCourseRunSyncs`/retry | UI 자체 영구 owner/evidence/outbox/cleanup 목록 생성0. pending purge는 다음 기회 재시도. 삭제로 run이 없어져도 DB cleanup ID manifest가 optional orphan을 정리한다. |

소비 예제(실제 함수명):

```ts
const consumed = await acceptOwnedConfirmationEvidence({
  receipt: { courseRunId, stopId, eventId, baseRevision,
    type: 'arrival_confirmed', source: 'live_activity_intent', evidence: receiptEvidence },
  application: { courseRunId, stopId, stopOrdinal,
    firstArrivalEventId: persistedFirstArrival.eventId,
    arrivalBaseRevision: persistedFirstArrival.baseRevision,
    source: persistedFirstArrival.source,
    outcome: reducerAppliedNow ? 'applied' : 'replayed_first' },
});
// 위 replayed_first는 persistedFirstArrival가 동일 최초 이벤트일 때만 사용한다.
if (['accepted', 'already_accepted', 'excluded'].includes(consumed.status)) {
  await nativeReceiptPort.acknowledge(receiptId);
}
// 이 작업을 필수 complete Promise의 선행 의존으로 묶지 않는다.
```

남은 한계·수락 조건:

- 서비스/production export는 구현됐지만 **실제 Swift projection/activate/receipt와 UI 최초 이벤트 저장/양쪽 소비 연결은 아직 없다**. 이 계약을 통합 확인한 뒤 UI writer가 구현하며, 앱 전체 학습·출시 완료는 아니다. raw receipt를 여전히 생성하는 일반 알림을 학습 대상으로 넓히지 않는다.
- optional 저장 무응답과 네트워크 무응답은 필수 완료에서 분리했다. **필수 owner storage 자체의 무응답/전체 기기 저장 실패까지 성공으로 위장하지 않는다.** generation write 실패는 unavailable+같은 storage port의 메모리 quarantine으로 새 증거를 막고 재시도한다. 성공한 durable 차단 이후의 진짜 cold 복구는 fixture로 검증했지만, 차단이 한 번도 저장되지 않은 채 프로세스까지 사라지는 전체 저장 장애는 local-only 증거만으로 과거 무효화를 복원했다고 보장할 수 없다. 이 상태에서 OS/native가 어떤 파일을 보존하는지는 실기기 실패 게이트로 남기며 무조건 cold 학습 성공으로 수락하지 않는다.
- 다른 기기의 철회/로그아웃은 offline 즉시 인지를 약속하지 않는다. 기존 서버 owner/generation/epoch·180일·방문 ack가 최종 거절 경계다. 로컬 ref는 서버 인증서/방문 위치 증명이 아니다.
- 증거 발급/무효화 포트와 native 저장의 정확한 순서·멱등성·같은 run 비교를 UI/native에서 지켜야 한다. native 저장 실패·ack 유실·중복 처리에서 진행과 카카오 전환을 막거나 도착 재탭을 요구하지 않는다. 새 권한/보유기간/서버 영구 receipt는 추가하지 않았다.

## 7. QA-LIVE-LEARNING-EVIDENCE-01 C 사전 점검·QA 인계 — 2026-09-07

판정: **로컬 계약 준비됨 / 실제 서버 학습 미확인 / C 실행 보류**. 이번에는 읽기 전용 로컬 점검만 수행했다. 이전 구현 대기 기록으로 현행 UI 통합을 다시 막지 않으며, QA의 A 통과·사용자 B 관찰을 C 성공으로 승격하지 않는다.

### 준비 상태

| 항목 | 분류 | 확인 근거·다음 조건 |
| --- | --- | --- |
| migration·서비스 계약 | 준비됨(소스) | `202609070015_release_account_identity_records.sql`, `202609070016_dwell_personalization_storage.sql` 및 `releaseIdentitySupabase.ts`의 방문/동의/표본 포트 존재. 적용 완료 증거와는 다르다. |
| 전용 검증 서버 | 미준비(식별·접속 증거 미제공) | `supabase/config.toml`의 로컬 API54321/DB54322 설정과 psql/Supabase CLI/Docker 실행 파일은 존재. `lsof`에서 해당 포트 LISTEN 결과 없음(exit1). 다른 환경의 부재까지 증명하지 않는다. 운영 또는 기존 연결 프로젝트를 대체 사용하지 않았다. |
| 실제 적용 migration | 권한 필요 | 전용 환경 지정 뒤 담당자가 읽기 전용 migration 이력·015/016 함수 정의/RLS/권한을 소스와 대조해야 한다. 현재 원격 적용 여부는 미확인이지, 미적용 확정이 아니다. |
| 테스트 계정·동의 | 미준비 / 생성·변경 권한 필요 | 전용 비익명 계정, 승인된 동의 상태, 검증 빌드의 동일 환경 연결 근거가 없다. 비로그인 관찰과 fixture auth 사용자는 대체 증거가 아니다. 이메일·키·토큰을 문서로 받지 않는다. |
| 방문·표본 조회 | 준비됨(구현) / 원격 권한 필요 | 방문 테이블과 연결 장소, 동의/표본/profile 테이블에 동일 계정 RLS SELECT 수단 존재. 실제 접근 성공은 미확인. |

주의: `get_dwell_personalization_consent`는 최초 행 INSERT, `read_dwell_personalization_samples`는 180일 초과 DELETE와 profile 갱신을 수행한다. 이름이 조회여도 이번 사전 점검에서 호출하지 않았다. 순수 점검은 승인된 전용 계정의 테이블 SELECT 또는 DB 담당의 read-only transaction 안의 한정 SELECT로 한다. 동의 OFF일 때 표본 RLS가 숨기므로 SELECT 0건을 물리 삭제 증명으로 쓰지 않는다.

`scripts/test_release_identity_local_db.sh`는 임시 PostgreSQL에 auth 대역·migration·fixture를 쓰고 종료 시 정리하는 하네스다. 이번에는 읽기만 했으며 실행하지 않았다. 과거 하네스 PASS는 지속적인 실제 Supabase 인증 환경이나 원격 migration 적용 증거가 아니다.

### 승인 후 최소 실행 절차(현재 미실행)

1. **환경 고정**: 운영과 분리된 환경 별칭, 담당자, 빌드/소스 버전, 적용 migration 목록을 확보한다. 전용 비익명 계정 1개와 테스트 데이터 전용임을 확인한다. 원격 migration이 필요하면 별도 승인·담당 작업으로 분리한다. 계정 생성도 별도 승인 없이는 하지 않는다.
2. **기준선**: 동일 계정의 방문·표본·동의 상태를 한정 조회한다. 실제 앱에서 학습 동의를 켜고 run 시작 전에 확정된 epoch/revision을 사용한다. 기록에는 상태·개수·동일 소유자 여부만 남기고 계정 식별자/토큰/원시 시각/좌표는 제외한다. exact 테스트 run/event ID는 정리용 제한된 실행 장부로만 관리한다.
3. **실제 연결 1건**: 앱/Live Activity의 적격 확인→명시 완료를 통해 실제 UI→DB runtime을 실행한다. `write_account_course_completion`의 ack 뒤 `submit_dwell_completion_sample`이 성공하고 동일 run/stop/content/category/subCategory/완료분의 `account_completed` 방문과 표본이 일치하는지 관측한다. local 완료 화면만으로 저장 성공 판정하지 않는다. API/SQL로 임의 표본을 직접 삽입하지 않는다. 조기 탭은 버튼 연결 검증이며 실제 여행 체류 근거가 아니다.
4. **동일 계정 read→추천**: 캐시만 읽은 결과와 구분해 실제 표본 read 후 동일 입력의 다음 추천 entry에서 적용 표본 수·체류값·경로 재계산 결과를 확인한다. 개인화 최소 표본 수를 충족하지 못하면 저장/read만 확인 가능하며 추천 반영 PASS는 보류한다. 이미 승인된 적격 기준 표본 2건이 있다면 신규 1건으로 최소3건을 충족한다. 없다면 별도 승인된 전용 환경의 고정 clock/route port 기반 실제 runtime 시나리오 3건으로 분리한다(외부 경로 API 반복 호출0, 실세계 체류 정확도 증명 아님). 사용자에게 실제3회 방문을 요구하거나 가짜 표본으로 운영 계정을 채우지 않는다.
5. **증거·중단**: 방문 ack·표본 저장·동일 계정 조회·실제 추천 적용을 각각 판정한다. RLS/owner/epoch 거절 또는 저장 실패 시 같은 동작을 반복해 성공시키지 않고 정확한 단계·sanitized 상태를 DB 담당에 반환한다. UI 증거 전달 결함은 UIUX, 정상 표본 read 후 미적용은 엔진 담당으로 구분한다. 익명/일반 알림 제외와 중복/계정전환 회귀는 기존 A fixture 증거를 재사용하며 운영 반복 검증하지 않는다.

### 정리 방법과 승인 범위

- 전용 계정의 **학습 데이터 전체 초기화** 승인을 받은 경우 `reset_dwell_personalization`의 revision 충돌 여부를 확인하고 동의 OFF/epoch 무효화·표본/profile 제거를 확인한다. 이는 계정 전체 초기화이므로 혼용 계정에서는 실행하지 않는다.
- exact 테스트 completion ID별 `delete_account_course_completion`로 방문을 정리한다. 방문 삭제만으로 표본이 제거된다고 가정하지 않는다. 계정 전체 방문 삭제·계정 삭제는 요청하지 않은 범위다.
- 해당 run의 Activity/projection/receipt 및 완료 outbox를 기존 종료·무효화 계약으로 정리하고, 늦은 재전송이 이전 epoch/generation으로 재생성되지 않는지 확인한다. 기기 전체 저장소나 다른 run은 지우지 않는다.
- 초기화 후 OFF RLS의 0건 대신 승인된 DB 담당의 해당 테스트 계정 한정 read-only 집계로 표본/profile 잔여0을 확인한다. mutation/삭제 멱등성 기록은 복구 방지 계약에 필요한 잔여로 명시한다. 완전한 계정 cascade 삭제가 필요하면 계정 삭제 승인을 별도로 받는다.

**다음 실행 조건**: 전용 환경·담당자 지정 → migration/RLS 읽기 권한 및 적용 증거 → 전용 계정/동의 준비 → 제한된 방문·표본 write와 부수 효과가 있는 sample read 승인 → 초기화/정리 승인 → C 실행. 프로젝트 연결·계정 생성·migration 적용·운영 API 호출은 이 승인에 자동 포함하지 않는다.

인수인계:

1. 변경 파일: 이 DB 작업 문서만 추가. C 준비 상태·순수 조회 주의·최소 절차·정리/승인 범위를 기록했다.
2. 유지 계약: 제품/엔진/UI/DB schema/중앙 기준 변경0. account-only·사전 동의·방문 ack·정확한 stop mapping·180일·멱등성·일반 알림 제외 유지.
3. 실행 결과: 소스/SQL/설정/실행 파일 존재와 로컬 포트만 읽기 점검. 자동 테스트 신규 실행0, 원격 조회/쓰기0, 계정 생성0, migration 적용0. 기존 A 테스트 수를 새 실행 결과로 재사용하지 않는다. stage/commit/push0.
4. QA 인계: C는 환경·권한 대기이며 제품 결함 판정 아님. 위 준비/승인 증거 확보 전 서버 학습 PASS 금지. DB 담당이 환경과 관측을 준비하고 QA가 네 단계 증거를 독립 집계한다.
