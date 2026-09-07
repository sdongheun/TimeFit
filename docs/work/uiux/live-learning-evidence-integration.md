# U-LIVE-LEARNING-EVIDENCE-01 — 앱·Live Activity 학습 증거 연결

상태: **2026-09-07 DB 서비스 계약 통합 수락·UIUX 구현 실행 승인, 구현/QA 전**. UIUX 단일 writer가 JS와 네이티브를 함께 담당한다. DB 완료는 앱 전체 학습 완료가 아니다.

## 1. 읽기 순서·현행 기준

AGENTS.md → docs/README.md → UIUX README·공통규칙·테스트명세 → 본 문서 → DB `live-learning-evidence-contract.md` 6절과 실제 `liveLearningEvidence.ts` DTO/`releaseIdentitySupabase.ts` exports → `release-personalization-integration.md` 최신 B 잔여 연결 → `live-activity-learning-evidence.md` 조사 순서로 읽는다. 사용자 정책은 DEC-LIVE-LEARNING-EVIDENCE-01이다. 조사 문서의 함수명/DTO 제안과 과거 구현 대기는 아래 구현된 계약으로 대체되며 과거 제한을 재도입하지 않는다.

이전: 앱 도착만 학습 가능, native는 당시 동의 증거가 없어 제외 → Live Activity 중심 사용자의 학습 누락 → 동일 행동 시점 증거를 앱/native 공통 소비로 연결 → 재탭 없이 학습하고 소급 수집을 방지. 상태: 정책 현행·이번 구현 전. 일반 알림 액션은 여전히 학습 제외다.

## 2. 소유 범위·유지 경계

- 수정: `src/ui/`와 관련 UI 테스트, `App.tsx` 연결, `plugins/live-activity/`, `plugins/withTimeFitLiveActivity.cjs` 및 필요한 네이티브 생성 설정, 본 작업 인수인계. 생성 iOS 파일만 고치고 prebuild 원본을 빠뜨리지 않는다.
- 수정 금지: DB 서비스/migration, 엔진 정책·공개 타입·카탈로그, 중앙 정책 문서, 원격 배포/운영 데이터, 임의 commit/push. DB 계약 공백은 정확한 재현/필요 계약으로 반환한다.
- 회원+별도 동의의 새 적격 run만 학습. guest 기능/진행/기록은 유지하며 guest 가져오기는 방문 기록만 이전. 기존 run null/legacy를 현재 동의로 승격하지 않는다. 3개/최근5개 중앙값, 기존 상·하한/32건·7일·180일과 추천 세션 고정 정책은 바꾸지 않는다.
- 최초 길찾기에서 앱 재복귀 없이 Activity 생성, 잠금화면 도착 한 번으로 머무는 중, 출발 한 번으로 잠금해제 후 다음 카카오맵 연결, 앱/native 상태 공유를 보존한다. 증거 작업 때문에 네트워크 대기나 추가 탭을 넣지 않는다.

## 3. 구현 순서 — 동일 UI writer가 수행

### A. 기존 B 잔여 연결 먼저 마감

`ownedCourseLifecycle.ts`에는 완료 앞 `await starts`가 남아 있다. DB 서비스 lock 해소와 UI 대기 해소를 혼동하지 않는다. 시작/Auth 조회가 영원히 미응답인 fixture를 먼저 추가한다. 현재 동일 active run의 명시 완료만 `preserveUnverifiedOwnedCourseRun` → `completeOwnedCourseRun` 실제 local 성공 → exact UI/Activity/알림 cleanup → 별도 sync로 연결한다. 증거 prepare/publish/consume·원격 응답을 필수 완료 앞에서 기다리지 않는다. local 저장 실패를 완료 성공으로 위장하지 않는다.

cold 소유권은 `readOwnedCourseRunOwnership` readonly 결과와 `canCleanupOwnedCourseRun` proof를 소비한다. 조회용 begin/owner 생성 금지. 삭제 등 await 후 현재 account/active run/proof를 다시 확인한 exact cleanup만 허용한다. 기존 B 구현은 재작성하지 않고 누락 연결만 보완한다.

구형 `owned-course-lifecycle.test.ts`의 DB 잠금 diagnostic은 삭제/skip하지 말고 원격 미응답 중 local 완료 성공을 검증하는 회귀로 교체한다. 실제 UI lifecycle을 거치는 별도 테스트로 `await starts` 재발도 막는다.

### B. 준비·발행과 행동 시점 증거

1. 새 `beginOwnedCourseRun` captured 뒤 같은 runtime에서 `prepareOwnedRunLearningEvidence({courseRunId,stops})`를 선택 작업으로 연결한다. stops는 최적화된 실제 방문 순서의 immutable stopId/stopOrdinal/contentId다. 담은 순서나 화면 index로 임의 교체하지 않는다.
2. `publishOwnedRunLearningEvidence({projection}, nativePort)`의 실제 `LearningEvidencePublicationPort`를 구현한다. storePrepared exact null-token ack → DB authorization → activate durable active token ack 순서를 지킨다. 활성 projection의 중복 준비는 token을 null로 덮지 않는다. 늦은 activate는 exact run/ref/generation/종료 상태를 검증하고 새 run이나 삭제된 projection을 되살리지 않는다.
3. App Group projection은 DB schemaVersion/courseRunId/evidenceRef/captureGeneration/publicationToken만 사용한다. 실제 token/계정/JWT/이메일/좌표/동의 원문을 로그·fixture에 노출하지 않는다. native 파일 잠금·atomic replace·실기기 잠금 접근 가능성을 기존 구조와 대조한다. JS/Swift/DB 전체가 하나의 트랜잭션이라는 가정 금지.
4. 앱과 Intent 모두 **확인 행동 순간**의 active projection을 receipt optional evidence에 고정한다. 오래된 버튼 parameter나 앱 복귀 시 token·현재 consent로 채우지 않는다. 준비 중/null/손상/읽기 실패/구형 receipt도 진행은 허용하고 학습만 제외한다. 일반 알림은 증거가 있어 보이더라도 학습 제외를 유지한다.
5. 시작 bootstrap이 미발급으로 끝나거나 미발급 첫 확인이면 window_closed를 연결하여 늦은 승인으로 소급 발급하지 않는다. 이미 정상 published인 run의 첫 도착에 window_closed를 호출해 2번째 stop 학습을 닫지 않는다. 첫 Activity/Kakao 시작은 publication Promise를 기다리지 않는다.

### C. 공통 소비·재시작·ack

1. reducer 최초 arrival event의 run/stop/ordinal/eventId/baseRevision/source를 진행 상태와 함께 durable 저장한다. 스키마 이전 시 구형 상태에 최초 근거를 조작하여 생성하지 않는다.
2. 실시간 receive와 cold/foreground reconcile 양쪽에서 같은 `acceptOwnedConfirmationEvidence({receipt,application})`를 사용한다. 새 최초 적용은 applied, 저장된 동일 최초 이벤트 재생만 replayed_first다. stale/processedEventIds 포함만으로 최초 도착을 추정하지 않는다.
3. accepted/already_accepted/확정 excluded 뒤 exact receipt ack. unavailable은 ack하지 않고 활성 수명 내 동일 payload/근거로 재시도한다. conflict는 성공으로 바꾸지 않는다. 경쟁 receipt는 진행 reducer 기준으로 구분하고 최초 event 교체 없이 처리·정리 근거를 테스트/인계에 남긴다.
4. 증거 저장 지연은 진행 상태 표시/다음 카카오 전환/필수 완료를 막지 않는다. 진행 저장 후 consume 전 종료, consume 후 ack 전 종료 모두 복구한다. UI에 별도 영구 evidence/owner/outbox를 만들지 않는다.
5. ack 후 cold active 복구는 동일 mapping의 prepare로 기존 durable 결론만 복원한다. 없는 record 재발급0. 복구보다 명시 완료가 먼저면 완료 유지·미확정 학습 제외. 새 evidence run에서 구형 captureOwnedStopEligibility로 fallback 금지.

### D. 종료·철회·재시도

- 실제 완료 저장 이후 `closeOwnedRunLearningEvidence(...completed)` 및 exact native projection/receipt 정리. DB complete의 비차단 purge와 중복돼도 멱등이어야 한다. close의 activeCleanup:pending을 native 제거 완료로 보고하지 않는다. 기존 최소 완료 sample/pending은 활성 증거와 구분하여 보존한다.
- 취소/만료/교체는 exact run close + native 정리, 표본 새 생성0. 늦은 receipt/activate/consume가 다시 생성하지 못하게 한다.
- Auth/off/reset/delete는 DB production 무효화 연결을 재사용하고 native projection 정리를 연결한다. INITIAL_SESSION/same-owner refresh와 실제 계정 전환을 구분한다. 다른 active run을 지우지 않는다. boot/foreground에 비차단 retryOwnedLearningEvidenceCleanup 및 기존 pending sync를 연결한다.
- 전체 저장 실패/무효화 durable 실패 후 process 소멸은 보장 불가 경계다. 성공으로 합성하지 말고 학습 제외/미확인으로 인계한다. 다른 기기 철회는 서버 제출 검증 경계를 유지한다.

## 4. 검증 — 실패 재현 후 구현

고정 시각/owner/consent/native publication/receipt/storage/remote fixture로 실제 production composition을 통과한다. 단순 문자열 존재 테스트만으로 수락하지 않는다.

1. 앱/native 혼합 및 native-only 독립 완료 3건 → 방문 ack → 표본 → 다음 추천 실제 보정. 1/2건 기본, 3건 보정; 활성 추천 불변; 중복 표본0. 2곳 최적화 순서의 정확한 mapping도 검증.
2. guest/무동의/import/legacy/일반 알림/구형·손상·미발행 증거는 진행 정상·학습0.
3. 준비 전/준비만/activate ack 유실, 첫 확인과 늦은 준비, 중복 준비, 진행 저장 후 crash/consume 후 ack 전 crash/ack 후 cold 복구를 검증.
4. A→B→A, off→on/reset/delete, complete/cancel/expire/replace 뒤 늦은 응답 승인0·다른 run 보존. 재시작 purge 및 cold pending sync 보존.
5. 원격 begin·optional storage·publication·consume 미응답 중 실제 UI local 완료/화면 진행 가능. 필수 local 저장 실패는 성공0.
6. 기존 최초 Activity와 잠금화면 arrival/departure→Kakao 경로 회귀. 신규 학습을 위해 앱에서 또 누를 필요0.

실행: 관련 focused tests → `npm run test:typecheck` → `npm run test:ui` → `npm test` → iOS 번들 및 네이티브 Release 빌드(가능한 서명 범위 명시) → diff check. 기존 실패를 숨기지 않는다. 시뮬레이터 반복 클릭으로 회귀를 대체하지 않는다. 운영 API/DB 반복 호출0.

실기기는 새 internal build에서 사용자에게 최소 목록만 요청한다: 회원+동의 새 코스 시작/앱 복귀 없이 Activity, 잠금화면 도착 즉시 상태 공유, 출발 잠금해제→Kakao 재탭0, 완료 기록·중복0, 앱 재시작 복구. 서버/개인화 보정 성공은 실제 확인된 범위와 fixture를 분리하여 보고한다.

## 5. 인수인계 필수

변경 파일/목적, 변경하지 않은 정책·공개 계약, 실행 명령/결과/로그, 남은 결정·위험·실기기 조건 네 항목을 본 문서에 기록한다. A~D별 완료 여부와 실제 JS→Swift→receipt→DB entry 연결표를 남긴다. 일부만 완료했는데 전체 완료로 기록하지 않는다. QA는 이 결과 통합 검토 뒤 진행하며 원격 배포/출시 수락은 별도다.

## 6. 구현 인수인계 — 2026-09-07 UIUX

상태: **A~D 소비 연결 구현·자동/unsigned native 검증 완료, 통합 검토 및 새 internal build 실기기 확인 전**. 원격 배포·출시 수락 완료가 아니다.

### 1. 변경 파일과 변경 목적

| 단계 | 변경 파일 | 구현·교체 이유 / 상태 |
| --- | --- | --- |
| A | `src/ui/ownedCourseLifecycle.ts` | 완료 앞 `await starts` → 시작 원격 조회 무응답이면 필수 완료도 멈춤 → 명시 `explicit_course_finish`에서만 preserveUnverified→실제 local complete로 교체. optional capture/증거/publication은 완료의 선행 await가 아님. 구현·실패→통과 |
| A | `src/ui/OwnedDeletionPanel.tsx` | 메모리 ownerFor로 cold 삭제 차단 → 생성 없는 readonly ownership/proof 조회와 현재 subject/active run 재검증으로 교체. 삭제 응답 뒤, native finish await 뒤 각각 exact 확인. 구현·실제 화면 fixture 통과 |
| B/D | `src/ui/liveActivity/learningEvidenceCoordinator.ts`, `learningEvidenceComposition.ts` | DB의 수락된 prepare/publish/consume/close/purge/retry를 주입 가능한 선택 작업으로 연결. UI 영구 owner/증거/outbox 없음. 첫 미발행 확인은 window_closed, 정상 published 첫 확인은 닫지 않음. active scope와 exact close로 늦은 bootstrap/activate 차단 |
| B/D | `src/ui/AppFlowContext.tsx`, `AuthContext.tsx`, `AccountPersonalizationPanel.tsx` | 새 run의 native scope 설정→같은 begin captured 뒤 실제 course stop 순서로 bootstrap. cold restore는 begin 없이 동일 mapping prepare. boot/foreground cleanup/pending sync. Auth 초기/same-owner refresh는 보존, 실제 전환/off/reset은 DB production 무효화와 native 정리 연결 |
| B/C/D | `src/ui/liveActivity/nativeLiveActivityPort.ts`, `courseProgressComposition.ts` | synchronous action-time native read와 prepared/activate Promise ack 경계 연결. production의 구형 onConfirmedArrival fallback 제거. 앱/native 공통 consume 주입, native projection과 terminal receipt exact 정리/재시도 |
| C | `src/ui/liveActivity/localProgressModel.ts`, `courseProgressRuntimeModel.ts` | 최초 arrival의 eventId/baseRevision/source/occurredAtMs/optional evidence를 해당 stop 진행과 함께 저장. schema1의 additive optional 필드이며 legacy에 근거 생성0. 손상된 최초 근거는 학습에서 제외하고 진행은 보존. receive/reconcile 모두 공통 비차단 소비. active state에 저장된 앱 확인도 cold replay 가능 |
| B/D native | `plugins/live-activity/TimeFitLearningEvidence.swift` | App Group의 최소 projection 및 별도 exact UI run scope. process 간 nonblocking flock, atomic write, iOS 최초 잠금 해제 후 접근 protection. prepared 중복은 active token을 null로 내리지 않음. exact scope 제거 후 늦은 store/activate 거절 |
| B/C native | `TimeFitActivityAttributes.swift`, `TimeFitLiveActivityIntents.swift` | receipt optional evidence. Intent 실행 순간 current projection 복사, 미발행이면 native scope도 닫아 늦은 발행 차단. 손상 optional evidence의 decode 실패로 정상 progress receipt 전체를 버리지 않음 |
| B native bridge | `TimeFitLiveActivityModule.swift`, `TimeFitLiveActivityModuleBridge.m` | set/read scope·read projection synchronous bridge, prepared/activate/clear Promise bridge. 내부 오류는 비밀 없는 learning_unavailable, 실제 ref/token 로그0 |
| 생성 | `plugins/withTimeFitLiveActivity.cjs`, 생성된 `ios/mobile/`·`ios/TimeFitLiveActivityExtension/` 해당 소스와 `ios/mobile.xcodeproj/project.pbxproj` | 앱/extension 양쪽 동일 template source를 등록·prebuild 재생성. 생성물만 수기 수정하지 않았으며 소스 parity 확인 |
| 테스트 | `test/ui/owned-course-lifecycle.test.ts`, `fixtures/ownedCoursePorts.ts`, `owned-account-screen-flow.test.mjs`, `live-activity-course-runtime.test.ts`, `live-learning-integration.test.ts`, `live-learning-native.test.mjs`, `fixtures/TimeFitLearningEvidenceHarness.swift`, `release-personalization-panels.test.mjs` | 구형 실패 진단을 성공 회귀로 교체, 실제 UI lifecycle/화면·DB factory·Swift 저장 실행으로 검증. 화면 harness에는 새 native 선택 경계 mock만 추가하고 production 경계는 별도 실행형 fixture로 검사 |

이전 native 학습 무조건 제외는 legacy/미발행/불명확/일반 알림에만 유지한다. 수락된 action-time projection이 있는 앱/native 최초 도착은 같은 계약으로 소비한다. 증거 없이 현재 로그인/on만 보고 채우거나 앱 도착을 다시 누르는 방식은 구현하지 않았다.

### 2. 유지한 공개 계약과 실제 연결표

DB 서비스·migration·엔진·데이터·중앙 문서·보드는 수정하지 않았다. 기존 미커밋 변경을 되돌리지 않았으며 commit/push·운영 API/DB 호출·원격 배포·Simulator/실기기 조작0. guest/anonymous 로컬 진행·방문 기록, 승인 guest import의 학습0, 일반 로그인+별도 동의, 실제 방문 순서, stable courseRunId, actualDwellMin/명시 완료, 방문 ack 선행, 최초32건/7일·서버180일, 표본3개/최근5개·추천 session freeze·호출 예산 유지.

| 시점 | 실제 호출 |
| --- | --- |
| 새 run | AppFlow→`liveLearningEvidence.start`→Swift `setLearningEvidenceRun`(scope만), `ownedCourseLifecycle.begin`→`beginOwnedCourseRun`→coordinator bootstrap→`prepareOwnedRunLearningEvidence` |
| 발행 | `publishOwnedRunLearningEvidence`→native `storePreparedLearningEvidence`→DB authorization→native `activateLearningEvidence`. 원래 DB projection 다섯 필드만 저장, active ack 유실에도 실제 저장 token을 읽은 receipt만 유효 |
| 앱 도착 | `confirmArrival` 진입 시 sync `capture`→`readLearningEvidence`→event evidence 고정→reducer/persistUpdate. 다른 async 작업 뒤 현재 token으로 보충하지 않음 |
| 잠금화면 도착 | Swift `applyProgressIntent`→exact target→`TimeFitLearningEvidenceStore.readActive`→immutable receipt write→기존 Activity/target update. 학습 읽기 실패는 optional omission이며 도착 자체 실패로 바꾸지 않음 |
| 공통 소비 | `receive/reconcile/apply`→진행에 firstArrival 저장→별도 consume 작업에서 동일 mapping restore→`acceptOwnedConfirmationEvidence({receipt,application})`. 새 최초 applied, 저장된 동일 최초만 replayed_first |
| ack/재시작 | accepted/already_accepted/확정 excluded 뒤 exact ack. unavailable/conflict는 성공으로 합성하지 않음. reducer로 최초가 아님이 확정된 경쟁 이벤트는 별도 reject/ack 경로이며 DB의 첫 stop 결론을 교체하지 않음. 진행만 저장/ack 실패 뒤 replay, ack 완료 뒤 cold prepare로 durable 결론 복구 |
| 완료 | 명시 finish→preserveUnverified(기존 owner 불변)→complete local 성공→기존 UI/Activity/알림 cleanup→별도 sync. 완료 시점 미확정 증거는 학습 제외하고 늦은 소비로 승격0 |
| 종료/철회 | runtime.finish/terminal 복구→비차단 `closeOwnedRunLearningEvidence` + native exact clear. completed/cancelled/expired는 receipt 정리, window_closed는 진행 receipt 유지. close의 DB activeCleanup:pending과 nativeCleaned를 구분 |
| 정리 재시도 | boot/foreground→DB purge 판정으로 무효 projection exact 제거→현재 진행에 속하지 않는 종료 receipt만 정리→`retryOwnedLearningEvidenceCleanup`. 삭제 실패를 성공으로 삼키지 않고 재시도. 다른 active run과 최소 완료 학습 queue는 보존 |

publication·진행·DB write는 하나의 트랜잭션이 아니다. Swift flock은 해당 native projection/scope 접근만 직렬화한다. 학습 consume/restore 미응답은 UI 진행 직렬 큐와 분리되어 길찾기·필수 완료를 막지 않는다. 시작 시 발급 실패, 첫 확인에 증거가 없던 경우, cleanup/무효화 전체 저장 실패는 학습 성공을 합성하지 않는다.

### 3. 실패 선행·검증 결과

- **실패 선행 A:** UI lifecycle에서 begin의 동의 Promise를 영원히 미해결로 둔 뒤 명시 완료를 실행. 기존 코드는 결과 undefined로 실패했다. 같은 fixture가 preserve→local complete 연결 후 원격 해제 전 created, 원격 방문/표본0으로 통과했다. 기존 DB lock diagnostic은 삭제/skip하지 않고 consent 해제 전 완료 true를 검사하도록 교체했다.
- **실패 선행 C:** native receipt 도착 뒤 firstArrival durable 근거/consume 입력이 없고 ack가 진행되던 상태를 재현했다. 수정 후 최초 근거 저장, unavailable이면 receipt 유지, progress dwelling 유지로 통과했다.
- 최초 전체 UI 회귀에서 새 native composition import를 기존 화면 harness가 처리하지 못한 실패와 APP_FILES 첫 항목 문자열 기대 실패를 확인했다. native mock 경계와 template 순서를 보완해 모두 통과했다. 실패를 skip하지 않았다.
- Swift harness 첫 컴파일에서 throwing guard 표현 오류가 발견돼 수정했다. 이후 실제 Swift prepared/active, 중복 준비, 다른 run clear, close 뒤 늦은 activate/store 거절, **별도 프로세스 lock 경합**을 실행해 통과했다. macOS 파일 동작이며 iPhone 잠금 테스트를 대체하지 않는다.
- `live-learning-integration.test.ts` **23/23 PASS**: 실제 UI controller/coordinator/DB factories→독립 native-only 및 mixed 3건→실제 추천 entry에서 1/2건30분·3건40분. 실제 도착/출발로 얻은 체류 분 사용. 2곳 q→p mapping/40분씩, guest/anonymous/알림/미발행/legacy/무효화0, unavailable replay, ack 실패 cold replay, 늦은 bootstrap/activate, A→B→A/off/reset, 경쟁 receipt, 종료 후 cleanup 재시도 포함.
- 집중 UI·DB 묶음 **108/108 PASS**(추가 경쟁/cleanup 2건 이전 실행): UI controller/lifecycle/실제 삭제 화면 + DB evidence42/lock18 회귀. 별도 실제 cold 삭제 화면은 current run 동일/교체 두 경우 모두 통과했다.
- `npm run test:typecheck` PASS. `npm test` **268/268 PASS**, fail/skip0. 최종 `npm run test:ui` **550건 중549 PASS / 기존skip1 / FAIL0**. 새 skip 없음. `git diff --check` 및 본 신규 문서 whitespace 검사 진단0.
- `npx expo prebuild --platform ios --no-install` PASS, package.json 변경 없음. template→생성 앱/extension source 문자열 parity PASS.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-learning-export` PASS.
- `xcodebuild -workspace ios/mobile.xcworkspace -scheme mobile -configuration Release -destination 'generic/platform=iOS' -derivedDataPath /private/tmp/timefit-learning-release CODE_SIGNING_ALLOWED=NO build` **BUILD SUCCEEDED**. 앱/Widget/bridge의 기기 대상 Release 컴파일·링크·JS 번들 확인. **unsigned이며 설치/서명/실기기 통과 증거는 아님**. 초기 sandbox IPC/workspace 접근 오류는 승인된 외부 실행으로 재검증했다.
- 로그: `/private/tmp/timefit-learning-focused.log`, `timefit-learning-ui.log`, `timefit-learning-core.log`, `timefit-learning-prebuild.log`, `timefit-learning-export.log`, `timefit-learning-native-build.log` (모두 같은 `/private/tmp/` 아래). 실제 증거 ref/token/계정 정보를 진단 로그에 추가하지 않았다.

### 4. 남은 결정·위험·실기기 확인

구현 인계는 A~D 모두 포함한다. 통합·QA 수락, 서명된 internal build 설치, 원격 저장/실기기 관찰은 별도다. DB 정책 변경이 필요한 새 공백은 이번 자동 검증에서 발견하지 않았다.

사용자가 새 소스로 서명·재빌드한 internal build에서 확인할 최소 목록:

1. 일반 로그인+동의 후 **새** 1곳 코스 시작. 첫 카카오 길찾기 때 TimeFit 재복귀 없이 Activity가 보이는지 확인한다.
2. 잠금화면 도착 한 번→머무는 중, 앱 복귀 후 같은 단계. 앱에서 도착을 다시 누르지 않는다.
3. 잠금화면 출발 한 번→잠금 해제→TimeFit→다음/목적지 카카오 길찾기 자동 전환, 추가 CTA0.
4. 명시 완료 기록1건·중복0, 재시작 복구. 2곳 코스는 최적화 방문 순서의 첫/둘째 장소 모두 같은 방식으로 확인한다.
5. 학습 서버 저장/다음 추천 적용은 해당 환경의 로그인·동의·방문 ack·표본 조회를 실제로 확인한 범위만 별도로 기록한다. 자동 fixture 3건 보정 성공을 실제 계정 서버 저장 성공으로 말하지 않는다. 기존 진단 버전 문자열만으로 이 변경 포함 여부를 판단하지 말고 **새 소스 빌드**를 사용한다.

미확인: iPhone 최초 잠금 해제 전/잠금 중 App Group 파일 접근, iOS17 App Intent와 동기 bridge의 실제 기기 스케줄링, 앱 강제 종료·재부팅의 OS 보존/실행 여부, 키체인/세션 초기화 경합. 다른 기기 철회는 기존 서버 제출 시 owner/epoch/generation 검증 경계다. 무효화 durable 저장이 한 번도 성공하지 못하고 프로세스까지 사라진 전체 저장 장애의 과거 상태를 보장하지 않는다. 이런 경우 진행 복구를 유지하고 불명확 학습은 제외하며, GPS·서버 영구 receipt·추가 권한·사용자 재탭으로 우회하지 않는다.
