# U-COURSE-DATE-01 — 공유 날짜 전달 경계

2026-09-08 최신: **DB 원본 종료 반환 수신·UI 최종 연결/집중 검증 완료, QA 인계 가능.** 전체 자동 게이트에는 QA 소유 기존 날짜 fixture2건 실패가 남으므로 출시 수락/전체 PASS는 아니다. 아래 대기 기록은 당시 이력이며 최신 상태는 문서 마지막 절을 따른다.

실행 기준: [DB 날짜·오류 공개 계약](../db-personalization/course-date-preservation.md), [FIX-LEGACY-COURSE-DATE-01](../integration-decision/legacy-course-date-preservation.md). DB는 아래 공유 타입을 사용해 repository 구현을 재개할 수 있다. 존재하지 않는 CourseDateError export를 복제하거나 임시 서비스 구현을 추가하지 않았다.

## 경로 확인·교체 이력

이전 날짜 없는 startMin/저장 시점 날짜 재생성 → 자정 이후 하루 밀림(QA/DB 재현) → 원래 날짜를 명시 필드로 전달하고 DB에서 원본 우선 검증 → 날짜 추측과 원본 덮어쓰기 방지 → **공유 전달 구현, 저장 검증 구현 전**.

- 신규 제품 입력: `TimeSetupScreen.startManualRecommendation`에서 최초 추천 시각을 `RecommendationSession.nowIso`로 캡처한다. 실제/개발 모두 날짜를 포함하고 Results→PlaceDetail→CourseConfirm은 같은 session을 보존한다. 저장 클릭 때 재생성하지 않는다. U-RELEASE-180-01의 날짜 포함 최초 입력 테스트를 그대로 유지한다.
- 현행 신규 V1 경로에는 PlanCtx 생성 또는 V1→legacy 저장 변환이 없다. 신규 입력에서 임의로 LegacyResults로 전환하거나 미사용 변환기를 연결하지 않았다. `nowIso`를 갖는 V1 저장/완료 계약도 이번 legacy repository 계약으로 변경하지 않았다.
- 기존 저장 경로: `listSavedCoursesFromRepository`가 복원할 `SavedCourse.ctx` → `AppFlowContext.refreshSavedCourses` → `MyCoursesScreen`의 Execution params → `ExecutionScreen` 변경 ctx → `LegacyResults(OneStopResultsScreen)` 저장 요청 → `AppFlowContext.saveCourse/replaceCourse` → repository. 최초 시작은 ctx.startedAtIso, 현재 재계산 시분은 ctx.startMin으로 분리한다.
- AppFlowContext는 ctx를 다시 구성하거나 날짜를 생성하지 않고 repository에 params를 전달한다. save가 reject하면 목록 추가에 도달하지 않는다. replace도 reject하면 후속 refresh/성공 반환에 도달하지 않는다. 해당 서비스 성공 후 반영 순서는 유지했다.
- MyCourses는 복원 ctx를 그대로 navigation에 전달한다. Execution의 변경은 현재 startMin/remainingMin만 갱신하며 최초 날짜와 issue는 유지한다. OneStop의 저장 요청 역시 같은 근거를 유지한다.

## DB에 공개된 구현 경계

`src/ui/nav.ts`의 기존 **단일 PlanCtx**에 아래 optional 필드 추가 완료:

```ts
startedAtIso?: string;
courseDateIssue?: 'missing' | 'invalid' | 'conflict';
```

- optional은 기존 날짜 없는 객체의 조회·전달 호환이며 저장 허용 의미가 아니다.
- `src/ui/courseDateContext.ts`의 `preserveCourseDateContext(source, updates)`는 재계산 중 두 필드의 원래 값을 고정한다. 빈 문자열/invalid/offset 문자열도 검증 전 원문 그대로 보존하고 현재 날짜·createdAt·startMin으로 대체하지 않는다. 날짜 해석·서버 원본 대조·정규화는 DB 소유다.
- 사용처: Execution 변경 params, OneStop 저장 요청. updates 타입에서는 날짜/issue 수정을 제외하고 구현도 source의 두 필드를 마지막에 고정한다. 신규 명시 시간 확정과 기존 계획 변경을 혼동하지 않는다.
- DB는 nav.ts를 수정하지 않고 위 타입으로 starts_at/ends_at 복원, 같은 instant 비교, conflict/missing/invalid issue, create/replace 검증과 오류 export를 구현하면 된다.

## DB 구현 뒤 UI가 이어서 마감할 항목

확인 시 `src/services/courseRepository.ts`에 `CourseDateError`/`isCourseDateError` export는 아직 없다. 오류 code만 보고 임의 duck typing 하거나 같은 이름의 임시 클래스를 만들지 않았다.

1. DB 공개 `isCourseDateError(error)`로 `course_date_missing`, `course_date_invalid`, `course_date_conflict`, `course_date_unavailable`만 안전하게 분기한다. 날짜/계정/SQL/토큰 원문 출력0.
2. **OneStopResultsScreen.startCourse의 기존 catch→로컬 성공 fallback은 날짜 오류까지 삼킬 수 있다. 현재 단계에서 해결 완료로 주장하지 않는다.** DB export 연결 시 날짜 오류는 반드시 즉시 중단하고 setActiveCourse/Execution 이동/가짜 local 성공0으로 바꾼다. 편집 ID 전달과 save/replace 실제 선택도 함께 검증한다(현재 OneStop은 editingCourseId를 읽지 않고 save만 호출함).
3. missing/invalid: 기록을 유지하고 ‘시간을 다시 설정해 주세요’ + 기존 TimeSetup으로 가는 명시 버튼. conflict: 기존 원본 유지·재조회/별도 새 시간 입력. unavailable: 성공 표시/임의 신규·local 생성 없이 재시도 안내. issue 표식만 삭제하는 재설정 금지.
4. Execution 변경의 기존 `endMin - currentMinuteOfDay()`는 날짜 없는 레거시 유효성 판정이다. shared startedAtIso는 **최초 시작**이므로, 줄어든 remainingMin을 다시 더해 최초 종료를 추정해서도 안 된다. DB가 원본 시작/종료를 보존한 뒤 이 경로의 만료·재변경 반례를 함께 검증한다. 현재 단계에서 날짜 전달을 만료된 코스 실행 허용으로 확대하지 않았다.
5. 최종 오류 fixture: 네 code에서 create/replace RPC0·목록 유지·실행 이동0·로그 원문0, 명시 별도 새 입력만 issue 해소, 기존120/180·월말/연말·서버 offset 동일 instant·충돌·원본 조회 실패. DB가 날짜를 주입한 성공만으로 생산자/화면 전체 수락을 대신하지 않는다.

## 인수인계 네 항목

### 1. 변경 파일

- `src/ui/nav.ts`: 공유 필드 계약.
- `src/ui/courseDateContext.ts`: 날짜/issue를 변경 입력에서 보호하는 순수 경계.
- `src/ui/ExecutionScreen.tsx`, `src/ui/OneStopResultsScreen.tsx`: 변경·저장 요청의 명시 보존 연결.
- `test/ui/course-date-context.test.ts`: 120/180, offset/연말/빈 값/invalid 및 issue 네 상태, 줄어든 기간·JSON 왕복·원본 불변·missing 비추정.
- `test/ui/course-date-screen-boundary.test.mjs`: 실제 MyCourses→navigation→OneStop 선택/확인→save callback 전달 검증. repository-restored ctx는 고정 fixture이며 실제 DB 복원/날짜 검증 완료를 뜻하지 않는다. 서비스 성공 stub이 conflict를 받는 것은 표식 전달 확인용이지 실제 conflict 저장 허용 규칙이 아니다.
- 본 인계 문서. 서비스/DB/엔진/보드/중앙 문서 변경0.

### 2. 유지 계약

startedAtIso는 원본 instant, startMin은 표시·재계산 분, remainingMin은 기존 변경 의미. 원본 starts_at/ends_at 대조/보존 및 오류 클래스는 DB 단일 소유. 계정 격리/삭제/멱등성/개인화/3시간·2곳/Live Activity 변경0. 신규 V1 입력·기존 180 날짜 연결 회귀 유지. 운영 데이터·실제 API·Simulator·commit/push0.

### 3. 검증

- 실패 선행: `npx tsx --test test/ui/course-date-context.test.ts`에서 미구현 경계 모듈 실패 확인 (`/private/tmp/timefit-course-date-failure.log`). 첫 EPERM은 테스트 결과가 아니며 허용 후 실행해 구분했다.
- 구현 뒤 새 순수2건/실제 화면2건 통과. 전체 자동 결과는 아래 최종 실행 결과에 기록한다.
- iOS export 성공: `/private/tmp/timefit-course-date-ios`, 로그 `/private/tmp/timefit-course-date-export.log`.

최종 실행 결과(2026-09-08):

- `npm run test:typecheck`: 통과 (`/private/tmp/timefit-course-date-typecheck.log`).
- `npm run test:ui`: 642건, 639 PASS / 2 FAIL / 기존1 SKIP (`/private/tmp/timefit-course-date-ui.log`). 두 실패는 DB가 이미 재현한 `qa-release-three-hour-save-date.test.mjs`의120/180 날짜 없는 입력 저장 사례다. 신규 전달 테스트 실패0.
- `npm test`: 305건, 302 PASS / 3 FAIL (`/private/tmp/timefit-course-date-all.log`). 위 같은 QA2건과 이를 포함하는 전체 발견 wrapper1건 실패. 독립 신규 결함3건으로 해석하지 않는다. repository 구현 전이므로 **전체 PASS 아님**.
- `git diff --check`: 통과. QA 실패를 변경/skip해 숨기지 않았다. 서비스 구현 뒤 명시 날짜 성공/날짜 없는 거절 계약으로 QA 담당이 갱신하고 전체 게이트 재실행 필요.

### 4. 다음 담당·중단 지점

**DB는 공유 타입·UI 전달 인계 대기를 해제하고 repository 구현을 진행할 수 있다.** UIUX는 export가 생긴 뒤 위 오류 소비·명시 재설정·편집/만료 반례를 마감한다. QA의 기존 날짜 없는 저장 성공 fixture는 이번 단계에서 수정/삭제/skip하지 않는다. 타입 인계를 전체 날짜 버그 수정 완료로 해석하지 않는다.

## 후속 오류 소비·편집 연결 — 2026-09-08

DB 문서 최신 repository 구현 결과 전체와 실제 export를 확인했다. CourseDateError export 대기는 해제됐다. 이전 화면의 catch→임의 local 성공 → 날짜 오류를 포함해 저장 실패인데 실행으로 이동 → repository 성공 반환만 활성화, 날짜 오류는 안전 안내 → 잘못된 실행·기존 기록 덮어쓰기 방지 → **구현 완료**.

### 1. 변경 파일 / 목적

- `src/ui/OneStopResultsScreen.tsx`: 실제 `isCourseDateError` 연결. 네 날짜 code에서 local ID fallback·setActiveCourse·Execution 이동0. missing/invalid는 시간 재설정, conflict는 기존 기록 유지 안내, unavailable은 재시도/명시 시간 재설정을 제공한다. 일반 오류도 원문 대신 안전 문구를 표시한다. repository의 기존 정상 날짜 local 반환 정책은 건드리지 않되 UI가 reject를 가짜 성공으로 만들지 않는다.
- `editingCourseId` 있음→`flow.replaceCourse(id, params)`, 없음→`flow.saveCourse(params)`. 반환된 정규화 ctx를 포함한 params로만 활성화한다. 새 날짜/가짜 로컬 ID를 저장 탭에서 만들지 않는다. ref 잠금으로 async 중 중복 제출을 막고 finally에서 해제한다. 명시 TimeSetup 이동은 기존 기록 삭제/issue 제거/자동 저장 없이 별도 입력 화면을 연다.
- `src/ui/nav.ts`, `src/ui/courseDateContext.ts`: 아래 **DB 요청용** `endsAtIso?: string` 추가 및 변경 중 원본 끝시각 보존. `courseReplanTiming`은 명시 UTC 원본 종료에서 현재 epoch를 뺀다. 최초 시작+줄어든 remainingMin 및 시분 차이로 종료를 추정하지 않는다.
- `src/ui/ExecutionScreen.tsx`: 원본 종료 부재/issue는 변경을 중단하고 명시 재설정을 안내한다. GPS 대기 뒤에도 실제 현재 epoch로 만료를 재검사한다. **현 DB가 endsAtIso를 반환하지 않으므로 정상 저장 코스도 재변경은 현재 확인불가로 중단된다. 이것을 전체 기능 완료라고 해석하면 안 된다.**
- `test/ui/course-date-screen-boundary.test.mjs`: 이전 서비스 성공 stub을 실제 repository export 결합으로 교체. `test/ui/course-replan-date.test.ts` 추가, `test/course-replan-contract.test.mjs`의 철회한 시분 차이 문자열 기대를 날짜 경계 호출 기대값으로 교체. DB/QA 소유 파일 변경0.

### 2. 유지 계약

- 최초 starts_at/ends_at·줄어든 remainingMin 의미, 120/180·최대2곳, 인증·계정 격리·기존 목록·개인화·삭제/멱등성 유지.
- 같은 repository export를 직접 판별하며 임시 오류 클래스/문자열 오류 승격 없음. 알림/Live Activity·V1 진행 흐름 변경0.
- 운영 DB/API/Simulator/서비스 파일/migration/commit/push0. 날짜 원문·계정·토큰 로그0.

### 3. 검증 결과

- 실패 선행 실제 화면→repository12건 RED → 구현 후12/12 PASS. 120/180 × create/replace/missing/invalid/conflict/unavailable. 고정 Auth/Supabase transport만 대체하며 제품 repository의 검증·RPC 조립을 실행한다.
- 정상 create의 p_starts_at/p_ends_at epoch 및 replace의 최초 endpoint RPC 인수 미전달 확인. 날짜 오류4종에서 쓰기RPC0·활성화0·Execution 이동0·기존 목록 유지, 시간 재설정 탭만 TimeSetup 이동. AppFlowContext 자체는 기존 reject-before-list-update 순서를 유지했으며 테스트 flow callback이 실제 repository에 위임한다.
- 재변경 순수 실패 선행1건 RED → PASS: 최초23:50/원본종료익일02:50/현재01:00/직전 remainingMin30에서도110분, 정확 마감은 expired, 끝시각 부재/issue는 unavailable. 실제 DB 복원 endsAtIso의 성공은 아직 검증할 수 없다.
- 신규 집중15/15 PASS (`/private/tmp/timefit-course-date-close-focused.log`).
- typecheck PASS (`/private/tmp/timefit-course-date-close-typecheck.log`). UI653건:650 PASS / 기존 날짜 QA2 FAIL / 기존1 SKIP (`/private/tmp/timefit-course-date-close-ui.log`). QA 두 사례는 원본조회 fixture 없는 날짜 없는 입력이며 현재 CourseDateError로 거절된다. 삭제/skip하지 않았다.
- iOS export 성공 `/private/tmp/timefit-course-date-close-ios` (`/private/tmp/timefit-course-date-close-export.log`). diff check PASS.
- `npm test` 최종321건:318 PASS /3 FAIL (`/private/tmp/timefit-course-date-close-all.log`). 위 기존 QA2건 및 이들을 포함하는 전체 발견 wrapper1건이다. 시분 차이 기대를 교체한 UI 계약 테스트는 통과. 전체 PASS 아님.

### 4. DB 최소 추가 계약 요청 / QA 전 차단점

공유 필드 **`PlanCtx.endsAtIso?: string`**을 UI 단일 작성자로 준비했다. 의미는 ‘재계산 시각의 예상 종료’가 아니라 **원래 코스의 검증된 종료 instant, 정규화 UTC ISO**다. DB 승인·population은 아직 아니다. 다음 최소 변경을 DB에 요청한다.

1. 원본 courses.starts_at/ends_at 검사 성공 시 `datedContext`/list/save(existing source)/replace 반환 및 snapshot에 서버 원본 `ends_at`을 정규화해 전달한다. replace 때 줄어든 remainingMin으로 새 종료를 만들지 않는다. 변경 RPC signature/서버 원본 시간은 그대로 유지한다.
2. 최초 신규 create는 이미 검증한 시작+최초 remainingMin으로 계산하는 기존 RPC 종료값과 동일한 endsAtIso를 성공 반환/snapshot에 넣는다. 기존 local 변경은 원래 명시 종료를 보존하고 없으면 현재 날짜나 변경 remainingMin으로 재생성하지 않는다.
3. 원본과 전달 종료가 둘 다 있으면 epoch 동일성 검사, 다른 offset 같은 instant 허용, 불일치 conflict, malformed/종료≤시작 invalid, 원본 조회 실패 unavailable. issue 표식을 지우지 않는다. 새 code/export는 불필요하다.
4. DB 인계 뒤 UI 실제 Execution→변경→재변경/만료→LegacyResults→replace 결합 fixture를 마감한다. OneStop 확인 중 마감 경과까지 원본 종료로 검사한다. 이 단계 전에는 현재 원본 종료 미제공으로 재변경이 fail-closed 되는 제한이 남는다.
5. **전체 연결 완료 전이므로 QA 최종 인계는 보류한다.** DB endsAtIso 계약 구현·UI 결합 완료 후 QA가 기존 날짜 없는 기대를 명시 성공/날짜 없음 거절로 나누고 전체 자동 게이트·제한 수동 확인을 수행한다. 실기기 확인도 아직 실행하지 않았다.

## 최종 연결 검증·QA 인수인계 — 2026-09-08

[DB 문서 6. 원본 종료시각 전달 보완](../db-personalization/course-date-preservation.md#6-원본-종료시각-전달-보완--2026-09-08-최신)을 읽고 대기를 해제했다. DB의 기존 `ctx.endsAtIso` 반환/정규화 계약을 그대로 사용했다. 위 ‘DB 끝시각 미제공으로 정상 재변경도 중단’은 과거 상태이며 이번 실제 결합 검증으로 해소됐다.

이전: Execution 재변경은 날짜 근거를 기다리고 OneStop 확인 중 경과를 검사하지 않음 → DB 종료 전달 구현 후 반복 변경은 성공하나 확인 중 만료가 쓰기로 이어지는 것을 fixture에서 확인 → 원본 종료로 변경을 유지하고 최종 확인의 비동기 경계마다 만료를 재검사 → 마감 지난 코스의 저장/활성화를 방지 → **UI 연결 구현 완료, QA 수락 대기**.

### 1. 변경 파일 / 목적

- `src/ui/OneStopResultsScreen.tsx`: 남은 누락만 보완했다. 확인 CTA 진입, 운영시간 검증 응답 후/저장 전, 저장 응답 후/활성화 전의 만료 검사. 편집은 DB가 반환한 원본 endsAtIso만 사용한다. 최초 신규이며 종료 필드가 없는 입력만 원래 명시 시작+최초 입력 기간으로 처음 종료를 계산하며 저장 클릭 시 시작 날짜 생성0. 만료 시 기록을 유지하고 ‘시간 다시 설정’으로 별도 입력 화면을 제공한다.
- `src/ui/nav.ts`: endsAtIso의 DB 구현 대기 주석을 현행 검증된 원본 종료 주석으로 정리(타입 변경 없음).
- `test/ui/course-date-screen-boundary.test.mjs`: 기존12 사례에 실제 Execution 반복 변경, 확인 중 만료/운영시간 응답 중 만료/저장 응답 지연 만료를 120/180 각각 추가해20건으로 확장했다. 이미 구현된 Execution·save/replace·날짜 오류 분기를 중복 재작성하지 않았다.
- 본 작업 문서. DB/repository·추천 정책·운영 데이터·보드 수정0.

### 2. 유지 계약

- 원본 startedAtIso/endsAtIso 동일 instant 유지, 반복 변경에서 현재 startMin/remainingMin만 변경. 원본 시작+줄어든 remainingMin 또는 시분 차이로 종료를 재계산하지 않는다.
- DB의 새 코스 create/기존 코스 replace 분기, replace RPC의 최초 날짜 인수 미전달, 정규화 ctx 반환을 그대로 소비한다.
- 기존 네 CourseDateError의 쓰기RPC0·가짜 local 성공0·활성 코스 설정0·Execution 이동0·기존 목록 유지·명시 재설정 유지. 계정·개인화·체류·알림/Live Activity·120/180분·최대2곳 정책 변경0.
- 이미 마감 전에 전송한 RPC 응답을 기다리다가 만료되는 경우 서버에 완료된 쓰기를 UI가 소급 취소하지 않는다. 이 경우에도 반환된 만료 코스를 활성화/Execution 이동하지 않는다. **확인 CTA/운영시간 검증 중 이미 만료된 경우에는 저장 요청 자체0**이다. 서버 트랜잭션 취소/삭제 정책을 추가하지 않았다.

### 3. 실행한 검증 / 결과

- 제품 수정 전 `expired`, `opening_expired` 120/180 네 신규 fixture FAIL 확인 (`/private/tmp/timefit-date-final-red.log`). 기존 날짜 전달/네 오류/분기 사례는 유지했다.
- 집중 화면→repository 최종 **20/20 PASS** (`/private/tmp/timefit-date-final-focused.log`). 실제 OneStop/Execution 화면 및 실제 repository export를 실행하고 GPS/엔진/알림/Auth/Supabase transport만 고정 fixture로 대체한다. 실제 API/DB/OS 알림0.
- 반복 변경: 실제 repository 최초 저장 반환의 ctx.endsAtIso로 Execution 진입 → 23:50 시작 후 익일00:05 변경 → LegacyResults 확인/replace → 반환 ctx로 Execution 재진입 → 00:20 재변경 → LegacyResults/replace.120분은105→90,180분은165→150으로 감소하고, 두 번 모두 원래 시작/종료 유지. 두 write는 모두 replace_course_plan이며 p_ends_at 미전달·snapshot 끝시각 일치. 정확한 마감 시 추가 planTimeFit/변경 화면 이동/추가RPC0. 연말→익년 자정 경과 fixture다.
- 확인 중/운영시간 비동기 응답 중 마감 경과: 저장/replace 요청0·쓰기RPC0·활성화0·Execution 이동0. 저장 응답 지연 중 경과: 마감 전 전송된 replace1을 유지하되 활성화/Execution 이동0. 기존 missing/invalid/conflict/unavailable 8건 회귀 유지.
- `npm run test:typecheck`: PASS (`/private/tmp/timefit-date-final-typecheck.log`).
- `npm run test:ui`: 661건,658 PASS /2 FAIL /기존1 SKIP (`/private/tmp/timefit-date-final-ui.log`).
- `npm test`:332건,329 PASS /3 FAIL (`/private/tmp/timefit-date-final-all.log`).
- 남은 실패는 모두 기존 `test/ui/qa-release-three-hour-save-date.test.mjs`의 날짜 없는120/180 저장 성공 기대2건 및 전체 발견 wrapper1건이다. DB 원본조회 fixture가 없어 course_date_unavailable로 거절되는 기존 QA 인계 상태이며 삭제/skip하지 않았다. 새 연결 테스트 실패0. 전체 PASS로 표시하지 않는다.
- `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-date-final-ios`: 성공 (`/private/tmp/timefit-date-final-export.log`). `git diff --check`: PASS. Simulator·실기기 실행0, commit/push0.

### 4. QA 인계 / 남은 수락 조건

**UI 잔여 연결 차단점을 마감했으므로 QA-RELEASE-180-01 재검증을 진행할 수 있다.** 새 DB 구현을 기다리는 상태가 아니다.

1. QA는 기존 날짜 없는 성공 fixture를 원본조회/명시 시작·종료가 있는 성공과 근거 없는 입력의 명시 거절로 분리한다. 날짜를 하루 뒤로 미루거나 테스트를 삭제/skip하지 않는다. DB9개 그룹과 UI20개 결합 사례를 함께 고정 revision으로 검증한다.
2. 현재 전체 게이트의 위 QA 기대값 실패를 해결한 뒤 typecheck/UI/전체/iOS export를 재실행하고 최종 수락한다. UI 집중 PASS와 출시 전체 PASS를 구분한다.
3. 최소 수동: 기존120분 및180분 저장 코스 변경/재변경 후 원래 마감 유지, 확인 화면 대기 후 마감 시 실행 차단·기록 유지, 오류 안내의 명시 시간 재설정과 unavailable 재시도. 실제 기기·운영 데이터 쓰기는 이번 자동 검증에 포함하지 않았다.
