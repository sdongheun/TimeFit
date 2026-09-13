# U-LEGACY-SCREENS-REMOVE-01 — C 구현 인수인계

2026-09-13. **UIUX 구현 완료·QA 통합 검증 대기.** 전체 자동 통과·실기기 수락·출시 반영 완료가 아니다.

기준: [R1 명령](../qa-release/legacy-four-screen-removal-command.md), [B 준비/소유 대응표](../qa-release/legacy-four-screen-removal-prep.md). A 복구 기준 `955931e`, 착수 HEAD `8c57a9cedade6836720a93dfb35c79982f84fbdf`. 제품 미커밋 변경0을 확인했다. B의 신규 문서/테스트와 `output/`는 그대로 보존했으며 stage/commit/push하지 않았다.

## 1. 변경·삭제 파일과 목적

- 삭제: `src/ui/OneStopResultsScreen.tsx`, `MyCoursesScreen.tsx`, `ExecutionScreen.tsx`, `FeedbackScreen.tsx`. 기준 커밋에 원본이 있으며 데이터 삭제가 아니다.
- `App.tsx`: 네 import와 LegacyResults/MyCourses/Execution/Feedback 등록, Execution 전용 header·Feather/Pressable/reset helper import 제거. 현재 화면 등록·탭 전환 유지.
- `src/ui/mainTabNavigation.ts`: `resetToBasket/resetToMyCourses` 제거. 나머지 네 탭 reset 유지.
- `src/ui/HomeScreen.tsx`, `activeVerifiedCourseModel.ts`: legacy activeCourse/Execution 이어가기 제거. 공개 함수는 **`homeActiveCourseProjection(activeVerifiedCourse, resolvePlaceTitle)`** 두 인자다. 결과는 verified(CourseConfirm)/placeholder만 있다. 현재 courseRunId·장소 순서·progress 변경 없음.
- `src/ui/AppFlowContext.tsx`: legacy repository import, activeCourse/savedCourses와 refresh/save/replace/remove 전용 상태·함수·노출값 및 전용 인증 guard 제거. latestResults·현재 진행과 모든 복원/동기화 effect 보존.
- `src/ui/nav.ts`: 보존 코드가 사용하는 과거 타입을 비실행 호환 타입으로 명시. 특히 Execution은 courseRepository용으로 보존하며 Stack.Screen에는 등록하지 않는다.
- UI 테스트7개: `active-verified-course-resume.test.ts`, `course-date-screen-boundary.test.mjs`, `main-stack-navigation.test.mjs`, `manual-location-restore.test.mjs`, `odsay-removal-screen.test.mjs`, `place-course-screen-runtime.test.mjs`, `release-exit-logs.test.mjs`. 신규 `test/ui/fixtures/currentConfirm.mjs`는 실제 CourseConfirm hook host 실행용 고정 포트다.
- 본 문서. QA 소유 테스트·B 문서·작업 보드·중앙 규칙 변경0.

이전 네 화면 등록과 전용 메모리/저장소 연결 잔존 → 신규 진입점 없는 과거 경로가 현재 정책과 혼재 → 지정 실행 연결만 제거 → 현재 동작을 보호하면서 혼동·불필요 의존 축소 → **C 현행, D/E 미수락**. 이전 자동조회 제거 작업의 명시 refresh 보존은 이번 전용 API 제거 결정으로 대체됐다. 과거 데이터/저장소 보존은 대체하지 않는다.

## 2. 유지 계약과 남겨둔 의존성

- `src/services/courseRepository.ts`, DB 테이블/migration/기존 AsyncStorage 기록 미수정. 저장소용 Execution/PlanCtx 등 타입을 즉시 삭제하지 않았다. 독립 DTO 분리 및 사용하지 않는 호환 타입 정리는 DB/통합 후속이다.
- `execution/schedule.ts`, 공유 길찾기, courseCompletionRepository/activitySummary, ownedCourseLifecycle, 기록·개인화·GuestImportPanel 유지.
- activeVerifiedCourseStorage의 read/write/clear 및 manualLocation 복원, Live Activity foreground/pending/알림·완료/학습 동기화는 수정하지 않았다.
- 하위 표시 컴포넌트·placeFeedback·로컬 후기·엔진 helper는 연쇄 삭제하지 않았다. orphan 여부 확인과 추가 정리는 별도 승인 범위다.
- 신규 화면에 과거 save/replace나 날짜 DTO를 새로 연결하지 않았다. 미확인 체류 학습·운영 API/DB 쓰기0.

## 3. 테스트 대응표·검증 결과

### C 소유 교체

| 이전 케이스 | 현재 대응 |
| --- | --- |
| active resume의 legacy-only Execution 기대 | 현재 없음=placeholder/있음=CourseConfirm. 나머지 진행/identity/접근성14건 유지, 두 인자 호출로 변경 |
| manual restore의 Execution mount1건 | 현재 CourseConfirm review의 manual gate 전 지도/route/notification0. 기존 active 복원·proof·pending 케이스 유지 |
| 날짜120/180 × legacy create/replace/날짜오류 | 보존 repository 직접 fixture12건: 신규/교체 날짜·4종 오류·RPC0·반복 교체의 원본 종료시각 유지. **현재 화면이 legacy repository를 호출한다는 기대는 철회** |
| 날짜120/180 × expired/opening_expired/save_late/repeat | 현재 CourseConfirm8건: 자정경과 deadline·반복 review/중복 시작, 복원 시 이미 만료/재선택 중 만료의 차단. legacy 저장 대기 자체가 없어졌으므로 그 타이밍을 현행 save로 합성하지 않음 |
| ODsay save/replace × exact/missing/lost_before_save6건 | 현재 CourseConfirm 신규/기존run × 검증snapshot/legs누락/비유한구간6건. 시작 가능/차단·기존run 유지, ODsay 요청/key읽기·legacy 저장0. 기존 basket 단위 테스트는 그대로 |
| Execution catch raw 로그1건 | 실제 CourseConfirm 공통 길찾기 throw→복구·오류, 취소→이동 상태 유지·거짓 오류0, raw 로그/화면 유출0 |
| main-stack MyCourses 가상 route | 현재 탭·상세·뒤로가기 fixture 유지, 과거 route만 제외 |
| place-course runtime의 Home projection/mock | 두 인자로 조정하고 사용하지 않는 resetToMyCourses mock 제거. 기존 실제 화면/지도/완료/LA 케이스 유지 |

### 실행 결과

- 변경 전: 제거 목표 **0 PASS/5 FAIL** (`/private/tmp/legacy-c-red.log`), 보존 **14/14 PASS** (`/private/tmp/legacy-c-baseline.log`). B 원본 기대값을 수정하지 않았다.
- 변경 후 제거 목표 **5/5 PASS**. 지정 C 테스트8파일 집중 **112/112 PASS**, skip0 (`/private/tmp/legacy-c-focus-final.log`). 첫 집중 명령에서 `.ts` 파일에 loader 없이 Node를 사용한1건은 `ERR_UNKNOWN_FILE_EXTENSION` 실행 환경 오류였고 `node --import tsx --test ...`로 재실행해 통과했다. 기대값/skip로 숨기지 않았다.
- `npm run test:typecheck`: PASS (`/private/tmp/legacy-c-types-final.log`).
- `npm run test:ui`: **807건 / 801 PASS / 5 FAIL / 기존 skip1** (`/private/tmp/legacy-c-ui.log`). 실패5건은 아래 QA 소유 교체 대기다.
- `npm test`: **485건 / 476 PASS / 9 FAIL / skip0** (`/private/tmp/legacy-c-all.log`). top-level 파일 로딩 실패 때문에 발견된 케이스 수가 줄었으며 통과 비율/전체 무손상으로 해석하지 않는다. 탐색 설정을 바꾸지 않았다.
- `git diff --check`: PASS. 전체 회귀 후 반복 날짜 교체 fixture를 보강하고 최종 집중112건을 다시 통과했다. D는 최종 diff로 전체 명령을 재실행해야 한다.
- `node scripts/release-build.cjs export`: PASS(exit0). public iOS 번들 `/private/tmp/timefit-public-export/_expo/static/js/ios/index-5690d0c04b2f1e4d4a7241ac282c36e3.hbc` 생성 (`/private/tmp/legacy-c-export.log`). Archive·IPA·서명·실기기 검증은 수행하지 않았다.

### D QA에 반환할 실패 — 제품 재등록으로 해결 금지

| QA 소유 파일 | 실패/필요 변경 |
| --- | --- |
| `test/ui/current-flow-refactor-safety.test.mjs` | 1/2곳 projection2건: 두 인자로 변경. 기존 title/order/run/progress 기대 유지. 나머지8건은 통과 |
| `test/ui/legacy-course-auto-query.test.mjs` | 명시 refresh1건: API가 제거되어 함수 없음. B 표대로 API 부재/repository0으로 교체. 로그인/복원/owner3건 통과 |
| `test/ui/qa-odsay-removal-execution.test.mjs` | geometry유무2건: 삭제 Execution 로딩 실패. 현재 snapshot/공유 route와 보존 reader fixture로 이관 |
| `test/course-replan-contract.test.mjs` | top-level Execution read ENOENT. 보존 repository/SQL 날짜·교체 검증 유지, legacy GPS 분기 기대 이관 |
| `test/map-transport-ui-contract.test.mjs` | top-level 삭제 화면 read ENOENT. 현재 PlaceDetail/CourseConfirm/공통 schedule 기대 유지 |
| `test/mixed-travel-contract.test.mjs` | top-level 삭제 화면 read ENOENT. 보존 엔진 helper·repository/schedule 계약과 현재 화면 표현 분리 |
| `test/index.js`의 loader aggregate | 위 하위 실패를 상위 실패로 보고한 것. loader/발견 범위를 변경할 필요 없음 |

추가 잔여: 정상 수동 proof가 있는 현재 CourseConfirm의 시작 handler는 이번 제거 전후 모두 `startController.request`를 사용하며, legacy 저장 직전 wall-clock 만료 검사와 같은 로직은 아니다. 이번8건으로 **모든 현재 review 만료 차단**을 입증했다고 주장하지 않는다. D/통합은 기존 현재 코스의 시계·만료 계약과 대조하여 별도 보완 필요 여부를 결정해야 한다. 삭제된 화면의 save_late 검사를 새 현재 저장 호출로 복원하지 않는다.

## 4. 다음 단계·실기기 확인

D는 위 QA 케이스 교체 후 제거5건/보존 테스트·typecheck·UI·전체·diff·public iOS 번들을 재검증한다. 전용 API 제거에 따른 실패를 C 제품 결함으로 오인해 과거 화면을 복원하지 않는다. 실제 기능 회귀가 발견되면 UIUX로 반환한다.

E 사용자 확인은 **미실행**이다. 기존 앱 데이터를 지우거나 새 설치하지 않고 수정 전 현재 진행 코스의 재실행/이어가기, guest/회원 추천→1/2곳→카카오 앱/웹→완료/기록, LA 도착·출발·완료 공유, 로그인 전환 후 기록 격리/동의를 확인한다. public JS 번들은 설치용 빌드나 실기기 검증을 대신하지 않는다. 운영 DB 정리·스토어 업데이트·push는 수행하지 않았다.

## 2026-09-13 D 반환 — 만료 검사 보완 인계

상태: **UIUX 만료 수정·집중 검증 통과 / 전체 게이트 QA fixture 1건 남음 / 마감 보류**. 실패가 남아 있으므로 `UIUX 만료 보완 완료·QA D 재검증 대기`로 최종 완료 표시하지 않는다. [보완 명령](legacy-removal-expiry-fix-command.md)을 기준으로 수행했다. 기존 C 및 QA D 변경은 그대로 보존했다.

### 1. 변경 파일·원인·교체 방식

- `src/ui/timeSetup/datedSetupTime.ts`: 기존 `parseRecommendationNowIso`와 `RELEASE_MAX_MINUTES`를 재사용하는 순수 `canStartRecommendationSession(session, nowMs)` 추가. 원본 `nowIso + remainingMin × 60000`보다 현재 시각이 **작을 때만** 신규 시작 가능하다. 정규 UTC ISO 파싱 실패, 비유한 clock, 비정수/0 이하/180 초과 입력은 거절한다. 기기 날짜 덧붙이기·마감 재부여 없음.
- `src/ui/activeVerifiedCourseModel.ts`: 시작 controller에 필수 `canStart(request): boolean`, 선택 `onExpired()` 포트를 추가했다. 신규 start 호출 직전 검사, 다른 코스 교체창을 열기 전 검사, 교체 승인 콜백의 start 직전 재검사. 만료 거절은 token/lock을 정리하고 start/navigate를 실행하지 않는다. 같은 원본 코스의 이어가기와 이미 열린 교체창의 기존 코스 이어가기는 신규 시작 guard를 통과할 필요가 없다.
- `src/ui/CourseConfirmScreen.tsx`: 클릭 시 `Date.now()`를 판정 포트에 전달한다. 만료 안내 `설정한 시간이 지났어요. 시간을 다시 설정해 주세요.` 및 `시간 다시 설정하기` → `navigation.replace('TimeSetup')` 연결. 확인/재설정만으로 기존 run·기록을 지우지 않는다.
- `test/ui/current-course-start-expiry.test.mjs` 신규11건: 120/180 자정·연도 경과 교체 대기/정상 직전/기존 이어가기, 중복 승인·연타, 잘못된 입력4종, 같은 원본 이어가기, 재설정 navigation 검증.
- `test/ui/fixtures/currentConfirm.mjs`, `test/ui/place-course-screen-runtime.test.mjs`: 일반 성공 fixture는 원본 session+1분의 고정 clock을 사용하고 명시 `__Date` override를 보존. 만료 검사를 mock 성공으로 우회하지 않는다.
- `test/ui/runtime-course-auth-guard.test.ts`, `test/ui/course-completion-history.test.ts`: 기존 identity/완료 단위 controller fixture에 `canStart` 포트 추가. 시간 판단은 신규 실제 화면 fixture와 QA 6건에서 별도로 검증한다.

이전: proof 있는 review의 실행 직전 마감 검사 없음 → QA가 오래 열린 화면의 정확 마감/직후 신규 run 생성을 재현 → 절대 마감 검사와 교체 승인 재검사를 provider start **앞에** 배치 → 이미 만료된 추천으로 신규 진행·교체 부수효과를 만들지 않음 → **현행 구현, 전체 수락 보류**. 삭제 화면 복원이나 추천 정책 변경으로 처리하지 않았다.

### 2. 유지한 계약·부수효과 순서

판정 → 허용된 경우에만 기존 scope 검사/provider start → 기존 lifecycle·학습 시작 연결 → active 화면 이동 순서다. 만료 시 provider start 자체0이므로 이 호출에서 파생되는 새 run·교체·학습 초기화를 시작하지 않는다. fixture로 실제 원격 쓰기가 수행됐다고 주장하지 않는다. 길찾기는 기존의 별도 명시 동작이며 만료 클릭에서 호출0이다.

기존 run 이어가기·Live Activity 진행 정책, 완료/기록·개인화·동의·계정 격리, manual proof/과거 좌표 차단, 최대180분·2곳, DB/repository/DTO, 네 legacy 화면 제거 상태를 유지했다. QA 소유 테스트·보드·중앙 문서를 이번 보완에서 변경하지 않았다. 서버/API·Simulator·실기기·Archive/IPA·업로드·commit/push 없음.

### 3. 검증 결과

- 변경 전 QA 만료6건: **2 PASS / 4 FAIL**, `/private/tmp/expiry-red.log`.
- 변경 전 UIUX 추가10건: **4 PASS / 6 FAIL**, `/private/tmp/expiry-extra-red.log`. 이후 기존 동일 run 이어가기1건 추가.
- 변경 후 만료·교체17건 및 제거/보존/날짜·경로/controller·완료 집중 합계 **86/86 PASS, skip0**, `/private/tmp/expiry-focus.log` (`node --import tsx --test`로 해당11파일 실행). QA 만료6건 기대값 변경0.
- `npm run test:typecheck`: PASS(exit0), `/private/tmp/expiry-types.log`.
- 최종 `npm run test:ui`: **824건 / 822 PASS / 1 FAIL / 기존 skip1**, `/private/tmp/expiry-ui.log`. 실패는 아래 QA 소유 clock fixture1건이다.
- `npm test`: **521건 / 519 PASS / 2 FAIL / skip0**, `/private/tmp/expiry-all.log`. 아래 QA fixture1건과 이를 포함한 `test/index.js` 하위 테스트 집계1건이다. loader 결함으로 해석하지 않는다.
- `node scripts/release-build.cjs export`: PASS(exit0), `/private/tmp/expiry-export.log`. `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`. public 번들 생성일 뿐 설치·서명·실기기 검증이 아니다.
- UI 최초 실행의 tsx IPC `EPERM`은 sandbox 환경 오류로 승인 후 재실행했다. 일반 성공 fixture의 과거 날짜/실제 clock 혼용으로 발생한 실패는 UIUX fixture의 명시 clock으로 수정했으며 테스트 삭제·skip 추가·탐색 제외 없음.
- `git diff --check`: PASS(보완 인계 포함).

### 4. QA에 필요한 최소 후속·잔여 위험

`test/ui/release-preflight-handoff.test.mjs`의 **QA release: failed handoff must restore an existing Live Activity update**가 남았다. 이 fixture는 `nowIso='2026-09-07T06:00:00Z'`로 신규 review를 시작하면서 screenRuntime에 clock을 주입하지 않는다. 새 guard는 기존 정규 ISO parser를 사용하므로 `.000Z` 형식이 필요하며, 실제 9/13 clock에서도 이미 만료다. 시작 차단 때문에 `verified-progress-primary`가 없어 handoff rollback assertion에 도달하지 않는다. Live Activity rollback 자체의 실패로 단정하지 않는다.

담당 QA: 해당 입력을 canonical `2026-09-07T06:00:00.000Z`로 맞추고 `screenRuntime.__Date`에 session 시작+1분의 `Date.now()`를 주입하라. 나머지 prepare→외부 실패→기존 Activity 내용 복구/revision/알림 기대값은 유지한다. QA 소유 파일을 UIUX가 직접 수정하지 않았다. 새 `canStart` 포트를 mock으로 생략하거나 항상 성공으로 바꾸어 화면 guard를 우회하지 않는다.

이 fixture 보완 후 QA D는 최종 diff로 typecheck·UI·전체·제거/보존·public export를 다시 실행한다. 통과 후에만 E로 인계한다. 실기기는 미확인이며 최소 확인은 마감 후 시작 안내/시간 재설정, 마감 전 교체창→마감 후 승인 시 기존 코스 보존, 기존 진행 이어가기·Live Activity 유지다. 운영 데이터 삭제나 반복 실제 API 검증은 필요하지 않다.
