# Live Activity 학습 증거 조사 — B 연결 후속

최신 사용자 결정: **DEC-LIVE-LEARNING-EVIDENCE-01 확정**. 로컬 참조 기반 app/native 학습, 활성 종료 경계 정리(최소 표본 안전 저장 선행), 일반 알림 학습 제외 유지가 승인됐다. 회원/별도 동의·guest 과거 학습0·기존 보유기간 유지. 아래 결정 요청은 답변 완료 이력이다. 단, 제안 DTO/entry는 구현된 계약이 아니므로 DB 정확한 계약 인계 후 native 구현하며 기능 수락은 별도다.

상태: **DB 두 보완과 병렬 조사 가능·제품 구현은 계약 검토 뒤**. 담당은 기존 UIUX 세션이다. 같은 UI 파일을 별도 UI/native 세션과 동시에 편집하지 않는다.

## 목적·이력

사용자 목표는 앱 버튼과 Live Activity 확인을 공유하여 추가 앱 탭 없이 적격 체류를 개인화에 반영하는 것이다. 현재 `courseProgressRuntimeModel.ts`는 app_action 도착만 callback을 보내고 native/notification은 과거 계정·동의 증거가 없어 제외한다. 진행 복구는 유지되지만 Live Activity 중심 사용에서는 학습이 누락된다. 이 제외는 안전한 임시 제한이지 출시 목표 충족이 아니다. 상태: 조사·계약 수립 전, 현행 보호 조건은 유지.

## 이번 조사 명령

1. 현재 App Intent→App Group receipt→JS reconcile→DB eligibility→완료 sample 경로를 실제 파일·함수와 DTO 기준으로 추적한다. iOS 강제 종료/잠금/복귀 전 확인과 앱 확인의 차이를 명시한다. 코드·native 설정·DB schema는 이번 조사에서 수정하지 않는다.
2. run 시작 당시 증거, 도착 확인 당시 증거, 제출 직전 유효성 검증을 구분한다. DB immutable owner/run-stop epoch/revision과 현재 receipt eventId/runId/stopId/revision에서 재사용할 필드를 표로 작성한다. receipt 수신 시각을 도착 시각 또는 당시 동의로 쓰지 않는다.
3. 최소 증거 전달안을 제시한다. 필요시 App Group에 전달할 비밀 아닌 불투명 참조/버전과 만료·철회·삭제·구형 receipt 처리까지 명시하되 JWT/refresh token/이메일/좌표·불필요한 개인정보를 추가 저장하지 않는다. 새 서버 receipt·영구 보유·GPS·APNs는 임의 도입하지 않는다.
4. 계정 전환, 동의 off→on/reset, 다른 기기 철회, 네트워크 단절, 증거 전달 실패, 도착/출발 후 앱 종료, 중복/stale/구형 receipt, 삭제와 늦은 응답을 검토한다. 당시 증거를 입증할 수 없으면 진행은 유지하고 학습만 제외하며, 다시 앱 도착 버튼을 누르게 하지 않는다.
5. 앱/native 중 어느 곳에서 증거를 캡처·보관·검증할지, DB에 필요한 정확한 추가 entry와 UI/native 변경 소유 파일, 기존 진행 latency에 미치는 영향을 제시한다. DB 공유 잠금·readonly 보완과 접점은 조기에 문서로 인계하고 해당 DB 파일을 직접 수정하지 않는다.
6. 기존 fixture 확장 계획을 작성한다: 새 적격 native 확인 3건→완료 저장→다음 추천 실제 보정, guest/import0, 불명확 증거0, app/native 혼합 확인 중복0, 최초 Activity/잠금화면 다음 길찾기 회귀. 이 조사에서는 구현/실기기 성공을 주장하지 않는다.

## 완료 인수인계

이 문서에 현재 사실/미확인, 권장안과 대안의 비용·보안·학습 누락 차이, 최소 DTO/상태 전이, DB/UI/native 소유 경계, 테스트 계획과 사용자 결정 필요 여부를 남긴다. DB 두 보완 완료를 기다리지 않고 조사 결과를 반환한다. **통합이 증거 계약을 확인한 뒤** DB 소비 계약과 UI/native 구현 명령을 확정한다. 권한 확대나 보유기간 등 새 정책은 사용자 승인 없이 확정하지 않는다.

## 조사 결과 — 2026-09-07 UIUX

상태: **저장소 경로 조사 완료·아래 계약은 제안/구현 전·통합 검토 대기**. 제품 코드, DB, native 설정, 보드 변경 없음. 아래 사실은 조사 시점의 소스 관찰이며 DB 병렬 보완 완료를 의미하지 않는다.

### 1. 결론과 정책 관계

- 누락 지점은 Live Activity 도착 확인 자체가 아니라 **확인 당시 적격성을 DB stop snapshot으로 전달하는 경계**다. 기존 native receipt로 진행·체류 시각은 복구하지만 계정/동의는 입증하지 못한다.
- `captureOwnedStopEligibility`를 복구 시 호출하는 것만으로 해결하면 안 된다. 이 함수는 호출 시점의 identity/동의를 조회한다. 과거 receipt를 현재 계정·동의로 채우는 소급 수집 위험이 있다.
- 권장: 코스 시작 때 확정된 DB 소유권/동의에 결합한 **기기 로컬 불투명 증거 참조**를 준비하고, native 확인 순간에 읽어 receipt에 고정한다. JS는 이를 로컬에서 검증·멱등 소비하고, 제출 직전 서버의 현재 적격성을 별도로 검증한다. 추가 도착 탭은 없다.
- 관계: `DB-08/09/11`, `REC-34`, `COURSE-13`, `DEC-RELEASE-PERSONALIZATION-01`의 **보완**이다. guest/import 학습 제외, 일반 로그인+별도 동의, 사용자 확인 기반·GPS 미사용 정책은 변경하지 않는다.
- 이력: app_action만 적격성 캡처/나머지 제외(현행) → Live Activity 중심 이용의 학습 누락 관찰 → 확인 순간 증거 참조와 전용 소비 계약(제안·구현 전) → 소급 수집 없이 동일 확인을 재사용하기 위함. 현행 제외 조건은 계약 수락·회귀 전 제거하지 않는다. 현재 동의로 과거 receipt 승격/사용자 재탭 방안은 채택하지 않는다.

### 2. 현재 production 경로와 정확한 공백

저장소 루트 기준 경로다. 함수명은 실제 코드 기준이며 아래 제안 entry와 구분한다.

| 단계 | 실제 파일·함수/DTO | 현재 동작과 증거 한계 |
| --- | --- | --- |
| 코스 시작 | `src/ui/AppFlowContext.tsx` → `ownedCourseLifecycle.begin` → `src/services/releaseIdentitySupabase.ts::beginOwnedCourseRun` | stable run을 `beginCourseRun`에 전달. DB envelope에 immutable owner, ownerGeneration, runEligibility 저장. UI 메모리 owner map만으로 cold 소유권 증명 불가 |
| native 확인 | `plugins/live-activity/TimeFitLiveActivityIntents.swift::applyProgressIntent` | exact Activity/run/stop/baseRevision·phase 확인. UUID eventId와 `Date()` occurredAtMs 생성. 계정/동의 조회 없음 |
| receipt 저장 | `TimeFitActivityAttributes.swift::TimeFitLocalProgressEventReceipt`, `TimeFitLocalProgressReceiptWriter.write` | schemaVersion=1, purpose, courseRunId, stopId, eventId, baseRevision, source, type, occurredAtMs, optional nextBoundaryAtMs/notificationId. staged file→동일 inbox move로 불변 이벤트 저장. 학습 증거 필드 없음 |
| Activity/길찾기 | `applyProgressIntent`, `TimeFitPendingNavigationActionStore` | 출발은 pending(actionId=eventId)을 먼저 저장, receipt 성공 후 signal, Activity revision+1·target 갱신. 이 동작은 학습 저장의 성공 조건으로 바꾸지 않음 |
| bridge | `TimeFitLiveActivityModule.swift`, `src/ui/liveActivity/nativeLiveActivityPort.ts` | receipt `{receiptId,raw}` 목록과 exact ack 전달. 계정·동의 참조 전달 entry 없음 |
| JS 복구 | `courseProgressRuntimeModel.ts::parseReceipt/reconcile/receive` | 같은 run 이벤트를 revision 순으로 reduce하고 시각/phase 복구. 적용 또는 stale/처리 완료 이벤트 ack. `receive`는 handoff 내부에서도 소비하므로 reconcile만 수정하면 누락됨 |
| 앱 확인 | 같은 파일 `apply/confirmArrival` → `courseProgressComposition.ts::onConfirmedArrival` → `ownedCourseLifecycle.captureArrival` | app_action arrival 적용 후 callback만 실행. native/notification callback 0. callback도 비동기 DB 조회라 클릭 순간의 durable 증거와 동일하지 않음 |
| DB stop 적격성 | `releaseIdentityPersonalizationRuntime.ts::captureStopPersonalizationEligibility` | 입력 runId/stopOrdinal/confirmationEventId. 현재 계정이 원래 owner이고 현재 consent epoch/revision이 run과 같아야 stop eligibility 고정. 동일 stop/event 멱등·다른 event conflict. historical evidence 입력 없음 |
| 완료 | `CourseConfirmScreen.tsx` → `courseCompletionComposition.ts` → `completeOwnedCourseRun` | 실제 확인 체류 분과 명시 완료를 owner namespace에 저장. 적격 run+stop, actualDwellMin/subCategory가 있는 항목만 learning pending. 완료만으로 미확정 stop을 승격하지 않음 |
| 전송 | runtime `syncRun` → account completion write/ack → outbox → `dwellPersonalizationRepository.ts::submitDwellCompletionSample` | 원래 owner·방문 generation 경계, run/stop consent와 현재 identity/consent 검증. SQL `202609070016…::submit_dwell_completion_sample`은 auth.uid, consent epoch/revision, account_completed 방문/장소/분류/완료 분 일치·멱등 검사. 서버는 native 클릭 당시 로그인 상태를 독립 입증하지 않음 |
| 다음 추천 | `src/ui/personalizationComposition.ts`, `personalizationSessionModel.ts` | owned samples read→추천 시작의 frozen snapshot→기존 엔진 적용. 새 receipt 추가만으로 기존 추천 session을 다시 계산하지 않음 |

추가 관찰:

- `reconcile`은 진행 저장 후 receipt를 ack한다. 향후 학습 증거를 별도 비동기 callback으로만 추가하면 **진행 저장→ack→증거 저장 전 종료**에서 증거가 소실된다. stale 처리에도 학습 처리 여부는 별도 확인해야 한다.
- 잠금/외부 앱/JS 중단 동안 native Intent가 실행되어 receipt 저장에 성공하면 앱 복귀 전에 증거를 남길 위치가 있다. JS 구동을 전제로 한 callback만으로는 이 시점을 보장하지 못한다.
- 강제 종료/재부팅 뒤 Intent 실행 가능 여부, 잠긴 상태의 파일 접근·갱신, 앱/Intent 동시 쓰기 순서는 이번에 실기기 검증하지 않았다. **Intent가 실행되지 않거나 파일이 읽히지 않으면 증거를 만들지 못한다**는 실패 분기를 포함해야 한다. 실행 성공을 OS 보장으로 주장하지 않는다.
- `courseProgressNotifications.ts::localProgressEventFromNotificationResponse`는 `occurredAtMs=Date.now()`를 기본 사용한다. 지연 전달된 알림 응답의 JS 처리 시각을 실제 클릭 시각/당시 동의 증거로 재해석하면 안 된다. notification 학습은 별도 action-time 증거 확보 전 계속 제외한다. 이번 조사로 기존 진행 시각 정책까지 변경하지 않는다.

### 3. 세 시점과 재사용 가능한 필드

| 구분 | 재사용 | 추가로 필요한 근거 | 대체할 수 없는 것 |
| --- | --- | --- | --- |
| run 시작 | `CourseRunPersonalizationSnapshotV1.owner/ownerGeneration/runEligibility`, `DwellEligibilitySnapshotV1.ownerSubject/consentEpoch/consentRevision` | 시작에 확정된 사실의 durable 저장과 생성 없는 조회 | 복귀 후 begin으로 새 owner 생성 금지 |
| 도착 확인 순간 | receipt `eventId/courseRunId/stopId/baseRevision/source/type/occurredAtMs` | 당시 유효했던 참조+로컬 수집 generation, DB의 immutable 참조 매핑, run/stop 대응 | progress revision은 consentRevision도 계정 전환 generation도 아님. 수신 시각/현재 토글은 과거 증거 아님 |
| 제출 직전 | 기존 identity·consent 재조회, 방문 generation/ack, 표본 idempotency | 위 과거 증거의 검증 결과와 revoke/delete 이후 stale 결과 차단 | 현재 동의는 과거 증거의 대체가 아니라 **추가 거절 게이트** |

`stopOrdinal`은 receipt stopId를 해당 immutable snapshot의 실제 방문 순서에 매핑해 1/2로 얻는다. 화면 선택 순서나 현재 카드 index로 추정하지 않는다. arrival eventId를 기존 confirmationEventId/표본 completionEventId로 유지한다. departure는 체류 경계이지 두 번째 표본 ID가 아니다.

### 4. 최소 로컬 증거 계약 권장안 — 미구현

#### DTO와 책임

다음 명칭은 **DB 요청용 제안**이며 현재 export가 아니다.

```ts
// App Group 투영: 인증 자격증명/계정 ID/동의 원문 없음
type LearningEvidenceProjectionV1 = {
  schemaVersion: 1;
  courseRunId: string;
  evidenceRef: string;            // 추측 어려운 run 한정 불투명 참조
  captureGeneration: number;      // 로컬 계정/수집 경계 변경에 단조 증가
};
// 기존 progress receipt에 optional 추가, 없으면 legacy learning 제외
type ConfirmationLearningEvidenceV1 = {
  schemaVersion: 1;
  evidenceRef: string;
  captureGeneration: number;
};
```

DB 소유 local envelope에만 `evidenceRef → {courseRunId, immutable owner/ownerGeneration, runEligibility, captureGeneration, 허용 stopId↔ordinal, publication 상태}`를 결합한다. 기존 필드는 참조하고 중복 계정 저장을 줄인다. 원격 검증 실패/guest/unverified/null runEligibility에서는 참조를 발급하지 않는다. 참조는 앱 내부 상관키이지 로그인 권한이나 서버 서명 증거가 아니며 일반 로그·진단 복사에서 노출하지 않는다.

- native는 버튼 parameter에 오래 고정된 참조를 믿지 않고 **Intent 실행 순간** 현재 App Group 투영을 읽는다. exact target 검증 후 같은 run·captureGeneration의 증거를 receipt와 함께 고정한다. 읽기 실패/충돌이면 증거 없이 진행 receipt를 저장한다. 학습 파일 실패로 도착/출발/길찾기를 거절하지 않는다.
- 앱 확인도 action-time 투영/로컬 증거를 먼저 고정해 동일 소비 경계에 넣는 것을 권장한다. `await begin`/원격 조회 뒤 현재 동의로 대체하지 않는다. 과거 app_action 기록을 일괄 재승격하지 않는다.
- 증거는 도착 시 확정한다. 출발과 명시 완료는 기존 진행 계약을 그대로 사용한다. 도착 이후 동의/계정이 변경되면 제출 게이트가 차단한다. 출발 receipt에 같은 참조를 남길 수 있지만 출발 시 새 참조로 과거 도착을 보충하지 않는다.
- 이미 시작한 run에 증거가 없으면 뒤늦은 로그인/on/조회 성공으로 발급하지 않는다. 시작 시 로컬 적격성이 확정됐어도 **publication 완료 전 확인**은 제외한다. 준비가 늦으면 학습 누락을 허용하고 첫 Activity/Kakao 전환을 기다리게 하지 않는다.

#### DB에 필요한 정확한 entry 의미

| 제안 entry | 입력·결과·불변 조건 |
| --- | --- |
| `prepareOwnedRunLearningEvidence` | 기존 runId와 immutable stop mapping. 기존 확정 run 증거만으로 로컬 `prepared(projection)` / `ineligible(reason)` / `not_found` / `unavailable` 반환. owner 생성·현재 동의로 null 승격·원격 대기 금지. prepared는 native publication 성공과 별개 |
| `confirmOwnedRunEvidencePublication` | ref/generation의 native 저장 ack를 exact 비교하여 published 확정. 취소/삭제/계정 변경 뒤 늦은 ack는 폐기. 확인 순간 이전 publication만 허용하는 순서/상태 계약 필요 |
| `acceptOwnedConfirmationEvidence` | 기존 receipt의 run/stop/event/baseRevision/source/type와 optional evidence, production reducer의 실제 적용/동일 이벤트 재처리 판정. 반환 `accepted` / `already_accepted` / `excluded(reason)` / `conflict` / `unavailable`. 로컬에서만 검증·stop eligibility 및 소비 결과 원자 저장. 과거 owner 생성/현재 consent 캡처/원격 쓰기 금지 |
| `invalidateOwnedLearningEvidence` | 원래 owner/run 범위와 계정 전환·off·reset·삭제 사유, expected generation. 로컬 generation 증가/새 수집 차단을 먼저 commit하고 native 투영 제거를 exact 동기화. 늦은 발급/소비 응답이 부활하지 않음 |
| 생성 없는 조회·삭제 proof | 진행 중인 DB cold readonly 보완 entry를 재사용할 것. run owner/증거 found, missing, corrupt, unavailable 구분. UI가 begin으로 빈 증거를 채우지 않음. 삭제 proof는 immutable run/owner generation에 결합하고 실행 직전 다시 비교 |

`excluded`는 durable 결론이며 재로그인/재동의로 승격하지 않는다. `unavailable`는 저장 결과가 확정되지 않았으므로 성공/ack로 합성하지 않는다. 원격 검증은 기존 `retryOwnedCourseRunSync` 경계에 남긴다. DB 두 보완의 핵심인 **원격 대기 밖의 짧은 직렬 read/commit**, late response generation 검증을 이 entry들에도 적용한다. UI에서 DB 공유 잠금 문제를 별도 저장소로 우회하지 않는다.

#### 복구·ack·삭제 순서

1. native: exact target→증거 읽기→불변 receipt 저장→기존 Activity 갱신/출발 pending signal. 참조와 무효화의 동시 접근은 process 간 일관된 generation 판정이 필요하다. 파일 `.atomic`만으로 여러 파일 간 트랜잭션을 보장한다고 가정하지 않는다.
2. JS: receipt→기존 reducer/진행 저장→**네트워크 없는 증거 소비의 durable accepted/excluded 기록**→exact ack. 진행 표시·길찾기는 증거 소비 완료를 기다리지 않는다. handoff `receive`와 `reconcile` 모두 같은 소비 경계를 써야 한다.
3. 진행만 저장한 뒤 종료해도 같은 event 재수신에서 학습 소비를 재개한다. 단순 stale revision이면 적격으로 인정하지 않는다. 실제 최초 적용 이벤트와 stop 연결이 입증되지 않으면 제외한다. 기존 processedEventIds만으로 stop의 최초 확인을 영구 입증할 수 있는지 확인하고 필요한 최소 event↔stop 소비 상태를 DB 소유 경계에 둔다.
4. 명시 완료에서는 준비된 적격 stop만 기존 완료/전송 큐로 변환한다. 증거 저장 장애로 완료가 먼저 끝난 경우 **학습 제외를 terminal로 확정**하며 필수 local 완료/cleanup을 막지 않는다. 완료 후 늦은 callback으로 새 표본을 만들지 않는다. 정상 로컬 소비가 완료 전에 정착하는 경로는 재시작 fixture로 입증한다.
5. 계정 전환/off/reset/delete는 로컬 수집 차단을 먼저 반영한다. native 제거 실패 시 DB invalidation으로 오래된 참조의 수용을 차단한다. 차단 commit도 실패하면 새 증거 활성화를 금지하고 복구 시 상태 불명확 표본을 제외한다. 사용자 로그아웃이나 로컬 진행을 학습 오류로 막지 않는다.
6. 완료/취소/만료/교체 시 App Group 투영 및 raw 확인 시각은 기존 활성 cleanup 대상으로 정리한다. 삭제 시 매핑 제거 후 도착한 ref는 not_found→학습 제외이고 절대 begin하지 않는다. queued 최소 표본만 기존 **최대32건·최초 기준7일**, 서버 표본 **완료 기준180일**을 따른다. receipt를 새 영구 학습 이력으로 남기지 않는다.

활성 run 증거의 wall-clock 최대 수명은 현재 승인 문서에 별도 값이 없다. 임의 24시간/7일을 새로 정하지 않는다. active 종료 경계와 기존 queue 정리로 충분한지, 별도 만료 상한이 필요한지는 통합 검토 사항이다. 장애 receipt 재시도도 기존 active 수명을 넘겨 무제한 보관하는 설계를 채택하지 않는다.

### 5. 반례·보장 한계

| 입력/순서 | 진행 | 학습 판정·필수 증거 |
| --- | --- | --- |
| account A+동의 시작→native 도착/출발→복귀 | 기존 확인을 그대로 복구 | published 참조/원래 owner/epoch 및 실제 완료·제출 재검증 모두 충족 시 적격 |
| guest/anonymous 시작→로그인/on, guest import | 정상 진행·승인 방문 import 유지 | 원래 runEligibility 없음: 0건. 새 ref 소급 발급0 |
| A→B→A, 로그아웃 중 확인 | 어느 계정도 진행 재탭 요구 없음 | 계정 전환 generation으로 **전환 중/후 오래된 ref 확인** 제외. 전환 전 이미 확정된 적격 pending은 기존 본인 재로그인/epoch/7일 계약으로만 재시도, B 귀속0 |
| off→on 또는 reset→on | 동일 진행 유지 | epoch/revision 변경으로 이전 증거/대기 제외, 기존 run null을 새 on으로 채우지 않음 |
| 다른 기기에서 off/reset/delete | 로컬은 즉시 인지 못할 수 있음 | 서버 조회/submit에서 epoch/generation 불일치 거절. offline 투영을 전역 현재 동의의 증명이라고 주장하지 않음 |
| 도착 당시 offline·세션 만료/불명확 | receipt로 진행 복구 | 시작의 확정 증거+유효 로컬 참조가 있어도 제출 검증 전 업로드0. 과거 인증/참조 유효성이 입증 불가하면 제외. 현재 로그인 성공만으로 빈 증거 복구0 |
| 증거 publication 지연/실패·잠금 파일 읽기 실패 | 첫 Activity/길찾기·확인 유지 | 증거 없음으로 제외. 학습 준비를 기다리거나 도착 재탭 유도0 |
| native 도착+출발→JS 실행 전 종료/재시작 | 원래 event 시각·revision 순 복구 | durable ref 매핑과 receipt가 남아 있으면 소비 재개. 현재 계정 캡처 금지. OS에서 Intent 미실행이면 성공 합성0 |
| 진행 저장 직후 종료/증거 저장 직후 ack 전 종료 | 재처리로 진행 중복0 | 전자는 실제 최초 이벤트 증명 뒤 소비, 후자는 already_accepted 후 ack. 중복 표본0 |
| 동일 receipt 반복/다른 event 같은 stop/app+native 경쟁 | 최초 유효 확인만 유지 | `(run,stop)` 최초 확인과 eventId 둘 다 멱등 확인. 두 번째 event로 첫 증거의 null을 덮어쓰기0 |
| stale/다른 run·stop/손상/구형 receipt | 기존 parser/reducer에서 가능한 진행만 유지 | evidence 없음/불일치0. 낮은 baseRevision만으로 학습 수락0, legacy 마이그레이션으로 당시 증거 생성0 |
| 삭제/계정 탈퇴→늦은 publish·receipt·sync 응답 | exact 소유 run만 기존 cleanup | generation 재검사·missing 참조 거절, 삭제 run/표본 부활0. 다른 계정 진행 삭제0 |
| 증거 소비 무응답·완료·cleanup 경쟁 | local 완료/종료 반환 보장 | 완료에 확정되지 않은 학습은 제외. late capture 승격0. 유효 queue의 최초 기준시각 재설정0 |

**한계:** 로컬 참조는 정상 앱 경로의 당시 상태를 연결하는 최소 근거이지 위변조 불가능한 서버 인증 이력이나 실제 현장 방문 증명이 아니다. 다른 기기의 철회를 offline에서 즉시 관측하는 보장은 이 설계로 제공하지 않는다. 서버의 단조 consent revision/epoch 검증은 중간 off→on을 현재 on만 보고 허용하는 것을 막지만, 당시 세션의 전역 유효성까지 별도로 보증하지 않는다. 더 강한 보장이 필요하면 네트워크/서버 증거 계약을 새로 결정해야 하며 이번 범위에서는 불명확 표본을 제외한다.

### 6. 대안 비교·결정 요청

| 안 | 비용·보안 | 학습 누락/판정 |
| --- | --- | --- |
| 현행 app_action 한정 유지 | 변경 최소, native에 계정 데이터0 | native 중심 사용 학습 누락 지속. 안전 임시 상태이나 출시 목표 미충족 |
| **로컬 참조+세 시점 검증(권장)** | DB local 매핑/무효화·native projection/receipt·멱등 소비 추가. 인증 비밀 추가0, 원격 확인을 진행 critical path에 추가0 | 정상 native 학습 가능. 전달 실패·불명확 과거는 의도적으로 제외. 계약·race fixture 수락 필요 |
| 시각만 비교/복귀 때 현재 consent 캡처 | 구현 적지만 과거 계정 전환과 off/on을 증명 못함 | 소급 수집 위험으로 부적합 |
| 서버 서명 증거/클릭 때 원격 조회 | 서버 endpoint·가용성·보유/보안 설계 증가, 잠금/offline latency 위험 | 새 범위이므로 채택하지 않음. 완전한 전역 시점 증명을 원할 때만 별도 결정 |

통합에 요청: (1) 최소 로컬 증거+서버 최종 거절을 허용 가능한 제품 근거로 수락할지, (2) 참조/소비 메타데이터의 정확한 정리 시점과 활성 만료 상한 필요 여부, (3) notification은 action-time 증거 제공 전 제외 유지할지 확인한다. 기존 일반 로그인+별도 동의의 목적 안에서 구현하며 새 권한·추가 서버 기록은 제안하지 않는다. 보유기간/새 수집 정책 확장이 필요해지면 사용자 승인 후 진행한다.

### 7. 후속 변경 소유 범위·검증 계획

- **DB 담당:** `src/services/releaseIdentityPersonalizationRuntime.ts`, `releaseIdentitySupabase.ts`와 DB 계약 테스트. 위 로컬 entry, immutable 매핑·소비 상태·무효화, readonly proof를 제공. shared lock 보완과 함께 unresolved remote 중 local 완료를 보장한다. 기존 SQL/서버 payload 유지가 기본이며 schema 필요성은 DB가 별도 판정·인계한다.
- **UIUX/native 단일 writer:** `src/ui/ownedCourseLifecycle.ts`, `src/ui/liveActivity/{courseProgressRuntimeModel,courseProgressComposition,nativeLiveActivityPort,localProgressModel}.ts`, 계정/동의/삭제 lifecycle 연결부. native template `plugins/live-activity/{TimeFitActivityAttributes,TimeFitLiveActivityIntents,TimeFitLiveActivityModule}.swift`, 필요 시 config plugin 생성 연결. 실제 iOS 산출물은 template 재생성으로 동기화하고 수기 분기하지 않는다. `AppFlowContext/AuthContext` 등 단일 작성자 파일은 명시 배정 후 작업한다. 화면에 재확인 버튼/새 단계 추가 없음.
- **QA:** 아래 실패 선행 fixture를 승인된 DB export와 production handler로 실행한다. 기존 B callback 테스트의 native 무조건0을 단순 삭제하지 않고 **구형/불명확0 + 새 적격 참조만 성공**으로 분리한다.

검증 순서/합격값(이번에는 계획만 작성):

1. `test/ui/live-activity-course-runtime.test.ts`, `owned-course-lifecycle.test.ts`, DB runtime fixture에 native 증거→stop 적격성 미연결 실패를 먼저 재현. 위 표의 각 race를 deferred storage/identity/consent·고정 clock으로 통제한다. production `receive`와 `reconcile` 양쪽 실행, 문자열 검사만으로 대체하지 않는다.
2. **독립 run 3건**의 새 적격 native 도착/출발→명시 완료→방문 ack→표본→실제 다음 추천 entry를 연결한다. 같은 category+subCategory에서 1/2건 기본, 3건부터 실제 선택 체류 보정 및 엔진 metadata 일치. 목표가 기본과 다른 feasible fixture 사용. 추천 session 중간 도착은 기존 frozen 결과 불변, 다음 session에만 반영. 계정/복합 키 격리, guest/import/미동의/불명확/미완료0, app/native 중복 증가0.
3. 1곳·2곳의 실제 stop mapping, 마지막 출발/복귀, handoff 실패→상태 복구, 첫 카카오 전환 전에 필요한 Activity 준비와 실제 열기 성공 분리, 잠금화면 출발→TimeFit→Kakao 자동 전환을 기존 production harness로 회귀. 학습 저장 실패/원격 무응답에서도 추가 앱 탭0·추가 route provider attempt0·필수 완료 지연0.
4. native 순수 정책/직렬화 테스트: legacy optional decode, ref 없음/다른 run, publication·invalidate interleaving, receipt 저장 실패, 중복 event, 파일 protection 실패를 주입. Swift와 JS schema 동일성, config plugin 재생성, iOS native build 검증. 두 파일의 atomic write만 검사하고 cross-process race 통과라고 하지 않는다.
5. 구현 후 최소 `npm run test:typecheck`, `npm run test:ui`, `npm test`, iOS bundle/native build, `git diff --check`. fixture의 실제 API/운영 DB/GPS 호출0. 필요 DB SQL 검증은 DB 담당의 격리 환경에서 수행.
6. 자동 통과 뒤 **사용자 수행 실기기**: 동일 native/JS revision 확인→로그인/동의 1곳·2곳→잠금 도착→잠금 출발 자동 지도→명시 완료→다음 추천. 재시작·offline/철회 최소 반례를 추가하고 비밀 없는 enum/개수만 수집. Simulator는 사용자 금지 유지, 앱 삭제 금지. 이번 조사에서 실제 기기·native 빌드 성공을 주장하지 않는다.

### 8. 네 항목 완료 인수인계

1. **변경 파일/목적:** 이 문서만 갱신. App Intent→receipt→JS 두 소비 경로→DB 적격성→완료/표본/다음 추천의 사실과 빈 계약, 최소 DTO/entry, 반례·검증 계획을 기록했다.
2. **유지한 계약:** 제품/native/DB/엔진/데이터·보드·중앙 문서 무수정. 현재 정상 도착·Activity·자동 카카오 전환, anonymous 세션 유지, guest/import 학습0, 소급 동의0, 방문 ack 선행, 32건/7일·180일 및 기존 추천 안전/호출 예산 유지. commit/push 없음.
3. **검증 결과:** 소스·현행 공개 타입·SQL·기존 fixture의 정적 대조만 수행. 이번 조사에서 자동 기능 테스트·native build·Simulator·실기기·실제 API/DB 실행 없음. 문서 diff 공백 검사 수행. 기존 테스트 완료 기록을 이번 제안의 통과 근거로 사용하지 않았다.
4. **다음 결정/위험:** 통합은 6절의 증거 수준·정리 수명·notification 범위를 검토하고 DB entry를 확정해야 한다. DB는 공유 잠금/cold 조회 보완과 본 제안의 접점만 우선 반영하여 계약 인계, UIUX는 수락 전 구현하지 않는다. 가장 큰 반례는 publication/invalidation race, 진행 저장과 receipt ack 사이 crash, 완료/삭제 뒤 late capture, 다른 기기 철회다. 입증 불가 시 진행 유지·학습만 제외하며 사용자의 도착 재탭을 해결책으로 삼지 않는다.
