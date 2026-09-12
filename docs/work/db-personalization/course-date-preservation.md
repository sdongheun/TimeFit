# DB-COURSE-DATE-01 — 날짜 포함 시작시각 보존

2026-09-08. **최신: UIUX 공유 타입 인계 수신·repository 구현 완료 / UI 오류 소비·QA 결합 검증 대기.** 아래 구현 전/선행 대기는 당시 이력이다. 최신 실행·실패 게이트는 문서 마지막 절을 따른다.

> 종료시각 추가 계약도 구현했다. `PlanCtx.endsAtIso`의 실제 동작과 최신 테스트 결과는6절을 따른다. 아래 ‘종료 필드 미제공’ 문구는 보완 전 이력이다.

기준: [FIX-LEGACY-COURSE-DATE-01](../integration-decision/legacy-course-date-preservation.md). [QA 반환](../qa-release/release-three-hour-validation.md)과 [UIUX 공유 전달 인계](../uiux/course-date-preservation.md)를 따른다. repository 구현 완료를 전체 날짜 흐름/출시 수락으로 해석하지 않는다.

## 1. 재현·호출 경로

`MyCoursesScreen → ExecutionScreen → LegacyResults(OneStopResultsScreen) → AppFlowContext.saveCourse/replaceCourse → courseRepository`를 읽기 전용으로 확인했다. `listSavedCoursesFromRepository`는 이미 courses.starts_at/ends_at을 조회하지만 `paramsFromRows`는 ctx로 돌려주지 않는다. `saveCourseToRepository`는 `dateAtMinute(ctx.startMin)`에서 저장 당일에 시분을 붙인다. replace는 서버 최초 starts_at/ends_at을 유지하면서 snapshot만 변경한다.

`node --import tsx --test test/ui/qa-release-three-hour-save-date.test.mjs`: **0 PASS /2 FAIL**, exit1. 120/180분 모두09-08 23:50 시작 기대가09-09 23:50으로 하루 밀린다. 실제 repository와 fixture Auth/RPC를 사용했으며 운영 호출0. 테스트의 originalStart는 기대값에만 있고 제품 입력은 날짜 없는 startMin이다. 현재 코드를 날짜 추정으로 고쳐 이 테스트만 통과시키지 않는다.

이전 저장 당일+시분 재생성 → 자정 이후 하루 밀림 → 원본 저장 instant/명시 시작 instant 전달 및 날짜 부족 거절 → 추정 제거·원본 보호 → **아래 계약 확정 인계, 구현 전**.

## 2. UIUX에 먼저 전달할 공유 계약

UIUX는 `src/ui/nav.ts`의 기존 `PlanCtx`에 아래 필드를 추가한다. DB는 nav.ts를 수정하거나 별도 PlanCtx 타입을 복제하지 않는다.

```ts
startedAtIso?: string;
courseDateIssue?: 'missing' | 'invalid' | 'conflict';
```

- `startedAtIso`: 원래 코스 시작의 날짜·시간대 포함 instant. 신규 입력에서 시작 날짜가 최초 확정되는 순간 생성하며 저장 버튼 클릭 시 다시 생성하지 않는다. `Z` 또는 명시 offset을 가진 완전한 ISO datetime을 받는다. 존재하지만 빈 문자열/잘못된 날짜/시간대 없는 날짜는 invalid이며 missing으로 취급해 fallback하지 않는다. 유효한 값은 같은 instant의 UTC ISO로 정규화할 수 있다.
- `startMin`: 기존 화면/계산용 분. 날짜 복원의 근거가 아니다. 변경 코스에서 startMin이 현재 재계산 시분으로 바뀌어도 startedAtIso는 원본 시작으로 보존한다. `remainingMin`은 기존 재계산 의미를 유지하며 변경 시 원본 전체 기간과 같아야 한다고 새 제약을 만들지 않는다.
- optional은 날짜 없는 기존 객체를 조회·보존하기 위한 호환성이다. 신규 저장을 날짜 없이 허용한다는 뜻이 아니다.
- `courseDateIssue`: repository가 조회 복원 시 발견한 미확정/불일치 상태를 화면 이동 중 유지하는 표식. 기록은 목록에 남기고 저장/변경만 차단한다. 기존 객체에서 표식만 지워 우회하지 않는다. 사용자가 명시적으로 새 시간 입력을 확정한 별도 새 계획만 새 startedAtIso와 함께 이 상태를 해소할 수 있다. 기존 원본 자동 덮어쓰기0.

### 날짜 출처·우선순위

1. 서버 원본이 있는 기록: RLS로 조회한 `courses.starts_at/ends_at`이 원본이다. 둘 다 유효하고 종료>시작이어야 한다. snapshot.startedAtIso가 없으면 원본 시작을 ctx에 복원한다. created_at은 생성 메타데이터이지 시작시각 대체값이 아니다.
2. 원본과 명시 snapshot 시작이 모두 있으면 문자열 모양이 아니라 epoch instant를 비교한다. 다르면 conflict. 손상된 원본을 현재 날짜나 snapshot으로 조용히 덮지 않는다. 해당 행은 표시 가능한 기존 항목으로 보존하고 courseDateIssue를 전달한다.
3. 신규/로컬 기록은 명시 startedAtIso를 사용한다. 원본 날짜도 명시 날짜도 없으면 missing. 현재 날짜, createdAt, startMin의 대소 비교로 전날/당일을 추정하지 않는다.
4. 생성 RPC의 종료는 검증한 시작 epoch + remainingMin *60000. 유효한 양의 정수 기간과 유효 종료 instant를 검사하며 월말/연말/익일은 epoch 연산으로 보존한다. 기존120/180 모두 허용한다.
5. replace는 서버 원본을 먼저 조회·대조한 후 최초 starts_at/ends_at을 그대로 유지한다. 날짜 복구를 위해 원본 조회가 필요한데 실패하면 명확히 중단한다. 변경 snapshot에는 복원한 원본 시작을 유지한다. 원본 종료와 줄어든 remainingMin의 합이 다르다는 이유만으로 conflict를 만들지 않는다. 최초 시간 보존 RPC 계약은 그대로다.

### 저장·변경 실패의 공개 계약 (DB 구현 예정)

기존 성공 반환 형태(`SavedCourse`, `ExecutionParams`)를 유지한다. 날짜 실패는 반환 객체를 가짜 성공으로 만드는 대신 **Promise reject**한다. repository에서 `CourseDateError` 및 안전 판별 `isCourseDateError(error)`를 export하며, 오류의 `.code`는 아래 값만 전달한다. 원문 날짜/계정/SQL/토큰은 오류 메시지에 넣지 않는다.

| code | 의미 | UIUX 처리 |
| --- | --- | --- |
| `course_date_missing` | 원본·명시 시작 날짜 모두 없음 | 기록 유지, 시간을 다시 설정하는 명시 행동 제공 |
| `course_date_invalid` | ISO/원본 기간/입력 기간이 유효하지 않음 | 기록 유지, 시간 재설정 안내 |
| `course_date_conflict` | 원본 시작과 snapshot/전달 시작의 instant 불일치 | 기존 기록 유지, 저장 중단 및 재조회/재설정 안내 |
| `course_date_unavailable` | 필요한 원본 날짜 조회 실패·원본 확인 불가 | 성공 표시 없이 중단, 임의 신규/로컬 생성 금지 |

날짜 검증은 guest/local 성공 분기와 쓰기 RPC보다 앞에 둔다. 원본 조회가 필요한 경우 읽기만 허용하며 **날짜 오류 시 create/replace RPC0, local 성공0**. 기존 광범위 catch가 CourseDateError를 삼키지 않게 DB에서 분리한다. UIUX는 AppFlowContext에서 성공한 결과만 목록에 추가/이동하고, 화면의 catch에서 이 오류를 소비한다. 그 외 기존 계정 격리·동일 request ID 재시도·삭제 정책을 이번 날짜 수정으로 확대하지 않는다.

### UIUX 연결 순서

1. nav.ts 위 공유 필드 추가.
2. 최초 날짜를 가진 입력 → ctx → LegacyResults/Execution/AppFlowContext 전달 보존. 저장 시점 날짜 캡처0. 원본 조회가 복원한 ctx와 issue를 보존한다.
3. 위 오류 소비와 명시 재설정 동작 연결. 날짜 보존은 이미 만료된 코스 실행을 허용하는 예외가 아니며 기존 실행 유효성 검증을 유지한다.
4. `docs/work/uiux/course-date-preservation.md`에 연결 export/경로와 완료 상태를 인계한다. **DB는 그 타입·전달 인계를 확인한 뒤** repository 구현에 진입한다.

## 3. UI 연결 후 DB 구현·검증 예정 범위

- 실제 repository export에 고정 clock/Auth/RPC를 주입하는 실패 우선 테스트 추가. 명시 날짜120/180,23:50→익일00:05 저장, 월말/연말 시작의 정확한 create payload 확인.
- 원본 starts_at/ends_at 복원, 다른 offset의 동일 instant 허용, 서로 다른 instant 충돌, invalid ISO/기간, 날짜 없음, 원본 조회 실패에서 쓰기RPC0/local 성공0 확인.
- 날짜 부족·충돌 행이 다른 정상 행과 함께 조회되어 보존되는지, replace가 최초 날짜를 보존하는지, 기존120 기록·계정·멱등성 회귀 확인.
- QA 소유 기존 실패 테스트는 삭제/skip하지 않는다. QA가 명시 날짜 성공 + 날짜 없는 거절의 두 계약으로 보완하고 실제 생산자→save 결합을 검증한다. DB 테스트에서 날짜를 주입한 성공만으로 UI 전달 완료를 주장하지 않는다.
- 구현 뒤 typecheck/test:ui/npm test. QA의 기존 날짜 없는 성공 기대는 새 계약 반영 전 계속 실패할 수 있으며 숨기지 않고 구분한다.

## 4. 이번 인수인계·중단 지점

1. 변경 파일: 본 문서와 DB README 링크만. 제품 코드/타입/테스트/migration은 수정하지 않았다.
2. 유지 경계: 최초 starts_at/ends_at, 기존 기록 조회·보존,120/180·2곳, RLS·개인화·정리 정책 불변. 운영 쓰기/백업/migration/C 반복/commit/push0.
3. 실행 결과: 기존 QA 날짜 재현2개 모두 FAIL(위 재현 확인). 문서 diff 검사 외 전체 게이트는 미실행이며 구현 완료/PASS로 기록하지 않는다.
4. 다음 담당/조건: 당시 nav.ts에 startedAtIso/courseDateIssue가 없고 UIUX 날짜 인계 파일도 없음을 확인했다. 순서 지시에 따라 repository 수정 전 멈췄다. 이 선행 대기는 아래 구현 재개 시 해제됐다.

## 5. repository 구현 결과 — 2026-09-08 (최신)

### 변경 파일·목적

- `src/services/courseRepository.ts`: 합의한 PlanCtx를 그대로 소비한다. `dateAtMinute` 제거, 날짜·시간대가 명시된 ISO의 실제 달력 유효성 검사, 원본 조회·복원/instant 대조, 날짜 오류 export를 구현했다. Date.parse가02-30 등을 다음 달로 정규화하는 것도 invalid로 차단한다. offset이 다른 동일 instant는 허용한다.
- `test/course-date-repository.test.mjs`: 실제 repository export + 고정 Date/Auth/Supabase transport fixture의 신규6개 그룹. 최초6개 모두 RED → 구현 후6개 PASS. 배열/문자열 검사만으로 RPC payload 검증을 대신하지 않았다.
- 본 문서와 DB README: 구현·정확한 오류 연결·잔여 게이트 기록. UI/nav/QA 기존 fixture/migration은 수정하지 않았다.

이전 날짜 추정·날짜 오류의 로컬 성공 가능성 → 명시/원본 instant 검사·원본 날짜 복원·날짜 전용 reject → **repository 구현 완료**. 기록 삭제·일괄 날짜 변환은 하지 않았다.

### 정확한 export·입출력·동작

```ts
// src/services/courseRepository.ts
export type CourseDateErrorCode =
  | 'course_date_missing' | 'course_date_invalid'
  | 'course_date_conflict' | 'course_date_unavailable';
export class CourseDateError extends Error { readonly code: CourseDateErrorCode; }
export function isCourseDateError(error: unknown): error is CourseDateError;
```

클래스 constructor 입력은 위 code 하나이며 message도 안전한 code뿐이다. UI는 같은 서비스 export의 `isCourseDateError`로 검사한다. 임의 문자열 message 검사나 일반 Error를 날짜 오류로 승격하지 않는다. 손상된 courseDateIssue의 예상 밖 값은 invalid로 닫으며 원문을 오류에 넣지 않는다.

- `saveCourseToRepository(params)`: 기존 성공 SavedCourse 반환 형태 유지. `params.courseId`가 원격 기존 ID이면 RLS 적용 courses 단건에서 원본 날짜/snapshot을 읽어 대조한다. 원본 없는 신규/`local-` 입력은 ctx.startedAtIso를 사용한다. 정규화한 ctx가 성공 반환과 recommendation_snapshot에 동일하게 들어간다. 검증은 local/guest 성공 분기와 create RPC보다 앞이며 날짜 오류는 reject한다.
- `listSavedCoursesFromRepository()`: 원본 starts_at/ends_at이 유효하면 snapshot의 누락 시작을 복원한다. 충돌·날짜 누락·손상인 날짜는 ctx.courseDateIssue로 표시하여 **해당 행과 다른 정상 행을 목록에 보존**한다. raw 서버 record를 수정하지 않는다. 날짜 외 기존 snapshot/장소 decode 실패 정책은 이번 범위에서 바꾸지 않았다.
- `replaceCoursePlanInRepository(courseId, params)`: 서버 ID는 원본을 조회한 뒤 snapshot/입력 시작과 대조한다. 줄어든 remainingMin은 최초 전체 기간과 비교하지 않는다. RPC에 p_starts_at/p_ends_at을 추가하지 않아 원본 최초 종료를 그대로 유지한다. 반환 ctx에는 정규화 원본 시작을 사용한다. 원본 조회 실패/행 부재/인증으로 확인 불가면 unavailable이며 replace 호출0.
- 날짜 실패는 기존 광범위 catch/local fallback에 들어가기 전에 reject하고, catch 내부에서도 CourseDateError를 재throw한다. 정상 날짜의 기존 네트워크 fallback·동일 request ID로1회 재시도 정책은 별도 계약으로 유지했다. 모든 서버 오류를 날짜 오류로 잘못 분류하지 않는다.

### 실제 검증 결과

| 실행 | 결과 |
| --- | --- |
| `node --import tsx --test test/course-date-repository.test.mjs` | 수정 전0 PASS/6 FAIL → 수정 후6/6 PASS |
| `npm run test:typecheck` | PASS |
| `npm run test:ui` | 642건:639 PASS /2 FAIL /기존1 SKIP |
| `npm test` | 311건:308 PASS /3 FAIL |
| `git diff --check` | PASS |

신규 fixture 범위:120/180×익일/월말/연말 create 정확한 날짜 payload, 누락/빈값/잘못된 달력/시간대 없음/잘못된 기간/issue, 계정·guest/local 가짜 성공0, 원본 복원·날짜 손상 행 포함 조회 보존, offset 동일 instant, snapshot/입력 충돌, 원본 조회 실패·행 부재, replace 종료 인수 미전달·줄어든 기간 유지, 정상 create 응답 유실 시 같은 request ID 재사용.

전체 FAIL은 기존 `test/ui/qa-release-three-hour-save-date.test.mjs`의 날짜 없는120/180 입력2개 및 npm test의 이를 포함하는 전체 발견 wrapper1개다. 현재 이 fixture는 courseId도 지정하지만 원본 조회 port를 제공하지 않으므로 새 구현에서 **course_date_unavailable로 중단**한다. 예전의 하루 밀린 저장 대신 확인 불가를 거절하는 결과다. QA는 기존 명령대로 원본 조회/명시 시작 성공 사례와 날짜 없음 거절 사례를 분리해야 한다. fixture 삭제/skip/날짜를 하루 미루는 기대 변경은 하지 않았다. 전체 PASS로 기록하지 않는다.

### 유지 계약·다음 담당

계정/RLS·저장/변경 RPC signature·최초 starts_at/ends_at·기존120 코스·180분/2곳·체류/개인화·삭제/정리 정책을 유지한다. 신규 migration·원격 조회/쓰기·백업·017·C 재실행·commit/push0. 현재 소스와 mock transport를 검증한 것이지 운영 날짜 정정/실기기 성공이 아니다.

**UIUX 다음 작업:** 위 export를 OneStopResultsScreen catch에 연결해 날짜 오류에서 setActiveCourse/Execution 이동/가짜 local 성공을 즉시 막는다. AppFlowContext는 reject 시 이미 성공 반영 전 멈추므로 그 순서를 유지한다. editingCourseId로 save/replace 선택을 정확히 연결한다. 원본 종료는 서버에서 유지되지만 ctx에는 별도 종료 필드를 추가하지 않았으므로, UI의 만료/재변경 처리에서 최초 startedAtIso + 줄어든 remainingMin을 원본 종료로 추정하지 않는다. 필요한 원본 종료 전달 경계는 UIUX/통합이 별도 명시해 조율한다.

**QA 다음 작업:** 실제 원본 조회/화면 이동→repository 결합과 만료 처리까지 연결 후 기존 실패 fixture를 계약에 맞게 보완하고 전체 게이트를 재실행한다. DB 주입 fixture만으로 사용자 흐름 성공이라고 수락하지 않는다.

## 6. 원본 종료시각 전달 보완 — 2026-09-08 (최신)

UIUX 문서의 ‘DB 최소 추가 계약 요청 / QA 전 차단점’을 읽고 이미 준비된 `PlanCtx.endsAtIso?: string`을 소비했다. nav.ts는 수정하지 않았다.

이전 원본 종료는 DB에 보존되지만 반환 ctx에 미제공 → UI가 재변경·만료를 안전히 계산할 근거 부족 → 검증된 원본 종료를 같은 ctx/snapshot/RPC 날짜 계약으로 연결 → 줄어든 remainingMin으로 최초 종료를 재생성하지 않도록 함 → **DB 구현 완료, UI 결합/QA 수락은 별도**.

### 1. 변경 파일

- `src/services/courseRepository.ts`: datedContext가 시작과 종료를 함께 정규화한다. 최초 신규/기존 서버/기존 local 출처를 구분하고 종료를 검증한다. create RPC도 정규화 ctx.endsAtIso를 사용한다.
- `test/course-date-repository.test.mjs`: 종료 전용3개 그룹 추가(전체9개). 수정 전 기존6 PASS/신규3 FAIL을 확인했다.
- 본 문서: 종료 계약과 결과 인계. UI·타입·QA 기존 테스트·SQL 변경0.

### 2. 정확한 공개 계약·유지 경계

- **기존 서버 코스:** list/save(existing source)/replace는 `courses.ends_at`을 원본으로 삼는다. 시작·종료의 유효성 및 종료>시작을 검사한 뒤 ctx.endsAtIso에 UTC ISO를 채운다. DB snapshot 또는 호출 입력의 종료가 존재하면 원본과 epoch instant를 비교한다. offset만 다르면 허용, instant가 다르면 conflict, 잘못된 날짜/종료≤시작은 invalid다.
- **최초 신규 저장:** 원본 courseId가 없는 입력만 최초 시작+remainingMin으로 종료를 계산한다. 입력 endsAtIso가 이미 있다면 이 계산값과 일치해야 한다. 성공 반환 ctx, recommendation_snapshot.ctx, create RPC p_ends_at은 같은 정규화 종료를 사용한다.120/180·익일·월말·연말을 유지한다.
- **기존 local 코스:** local- 원본 ID로 save/replace할 때 명시 종료를 그대로 검증·보존한다. 없으면 missing으로 중단한다. 줄어든 remainingMin이나 현재 날짜로 새 종료를 만들지 않는다. 최초 신규 guest/local 반환에는 계산된 종료가 포함된다.
- **변경:** 줄어든 remainingMin은 변경 계산값으로 남지만 원본 종료를 결정하지 않는다. replace RPC는 시작/종료 인수를 새로 전달하지 않아 서버의 최초 시간 보존 계약을 유지한다. 기존 서버 원본에서 새 저장으로 이어지는 경로도 검증된 원본 종료와 동일한 p_ends_at/snapshot/반환값을 사용한다.
- **오류:** 기존 `CourseDateError`/`isCourseDateError`와4개 code 그대로다. 종료 근거 부재 missing, 손상 invalid, 원본 불일치 conflict, 필요한 원본 조회 실패 unavailable. 날짜 오류에서는 쓰기RPC0/local 성공0. 기존 issue 표식을 지우지 않고, 조회에서는 문제 행을 보존한다.
- RLS/소유권/멱등성/최초 시간/120분 기존 기록/180분·2곳/개인화 정책 불변. 신규 migration·원격 조회/쓰기·017·백업·개인화 C 재실행·commit/push0.

### 3. 검증

`node --import tsx --test test/course-date-repository.test.mjs`: **9/9 PASS**.120/180×익일/월말/연말의 RPC·snapshot·반환 종료 동일성, 원본 list 복원, reduced remainingMin replace/save(existing), local 원본 종료 보존/누락 거절, offset 동일 instant, 입력 및 snapshot 종료 충돌·손상·종료≤시작, 원본 조회 실패를 포함한다. 고정 메모리 transport이며 운영 실행 증거가 아니다.

최종 실행 기록: `npm run test:typecheck` **PASS**. `npm run test:ui` **653건/650 PASS/2 FAIL/기존1 SKIP**. `npm test` **324건/321 PASS/3 FAIL**. 실패는 여전히 QA의 날짜 없는120/180 저장 성공 기대2건(`course_date_unavailable`)과 기본 테스트에서 이를 포함하는 전체 발견 wrapper1건이다. 이번 종료 전용 fixture 실패0이며 QA 소유 fixture를 변경/skip하지 않았다. `git diff --check` **PASS**. 전체 PASS로 표시하지 않는다.

### 4. UIUX/QA 다음 순서

UIUX는 조회 및 save/replace 반환 `ctx.endsAtIso`를 원래 종료 근거로 사용한다. `startedAtIso + 변경 remainingMin`으로 재계산하지 않는다. Execution→변경→재변경/만료→LegacyResults→replace 결합 fixture와 OneStop 확인 중 마감 경과를 마감한다. 최초 신규 입력의 종료와 원본 코스 변경의 종료를 혼동하지 않는다. 기존4개 오류에서 성공 이동을 막는 계약은 그대로다. 이후 QA가 날짜 없는 기존 성공 기대를 명시 날짜 성공/근거 없음 거절로 분리하고 전체 게이트를 수락한다.
