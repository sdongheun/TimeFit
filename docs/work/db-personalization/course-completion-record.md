# DB-COMPLETION-RECORD-01 — 후기와 분리한 로컬 코스 완료 기록

> 상태: **구현 완료·통합 수락 대기**  
> 담당 역할: **DB·개인화 세션**  
> 선행 결정: [DEC-COMPLETION-RECORD-01](../integration-decision/course-completion-record.md)  
> 후속: `U-LIVE-ACTIVITY-01`의 완료 연결, 이후 제한 QA

## 1. 이 작업의 목적

진행 화면에서 사용자가 `코스 마치기`를 눌렀을 때 후기 없이도 기록 탭에 남길 수 있는 **로컬 완료 사실 저장소**를 만든다. 현재 `placeFeedback` 후기 저장과 완료 사실이 결합돼 있고 V1 진행 상태는 메모리뿐이므로, 후기·활성 진행·서버 체류 표본과 분리된 멱등 repository가 필요하다.

이 작업은 저장 경계를 만드는 작업이다. React 화면에서 버튼을 연결하거나 Live Activity/App Group을 구현하거나 Supabase migration을 적용하는 작업이 아니다.

## 2. 시작 전에 읽을 파일

다음만 먼저 읽고, 과거 archive 전체는 열지 않는다.

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/작업조정_보드.md`
4. `docs/04_backend/데이터베이스설계.md`
5. `docs/work/db-personalization/README.md`
6. `docs/work/integration-decision/course-completion-record.md`
7. `docs/work/db-personalization/verified-course-storage.md`
8. `docs/work/db-personalization/live-activity-dwell-storage.md`
9. 코드 기준선: `src/services/placeFeedback.ts`, `src/services/activitySummary.ts`, `src/services/courseRepository.ts`, `src/ui/VerifiedCourseProgressScreen.tsx`, 관련 테스트

작업 전 `rg`로 완료·후기·기록 저장 경로를 다시 찾고, 이 문서에 적히지 않은 저장소나 migration이 이미 생겼다면 중복 구현하지 말고 충돌을 먼저 기록한다.

## 3. 현재 확인된 기준선

- `VerifiedCourseProgressScreen`의 진행 상태는 현재 React 메모리이며 완료 시 리셋된다.
- `placeFeedback`은 `@timefit/place-feedback-v1`에 선택 후기와 체류분을 저장한다. 완료 이력 저장소로 이름과 계약이 적합하지 않다.
- `ActivityRecordScreen`/`activitySummary`는 후기 데이터를 이번 달 완료처럼 집계한다.
- legacy `courseRepository`의 guest 성공 반환·Supabase 실패 시 local 성공 반환은 V1 완료 저장에 재사용하지 않는다.
- DB에는 `courses.status/completed_at` 및 `recommendation_events.course_completed` 흔적이 있지만, 이번 비로그인 우선 완료 이력의 공개 repository나 RLS 계약으로 구현돼 있지 않다.
- 기존 applied migration은 수정·삭제하지 않는다.

## 4. 먼저 추가할 실패 테스트

구현 전에 production adapter가 아닌 주입 가능한 memory storage fixture로 아래 테스트를 실패 상태로 만든다.

1. 1곳·2곳 완료를 순서 그대로 저장하고 다시 읽는다.
2. 같은 `courseRunId`를 순차 두 번 호출하면 한 건만 존재하고 두 번째 결과는 `already_completed`다.
3. 같은 `courseRunId`를 `Promise.all`로 동시에 호출해도 한 건만 저장된다.
4. 서로 다른 `courseRunId`로 같은 장소를 다른 날 완료하면 두 활동으로 남는다.
5. 장소가 0개 또는 3개 이상, 빈 run ID/content ID, 잘못된 시각·음수 체류분은 `invalid_input`으로 거절하고 기존 저장값을 바꾸지 않는다.
6. `trigger !== 'explicit_course_finish'`인 코스 선택·보기·길찾기·취소 입력은 저장할 수 없다.
7. 사용자 확인 체류가 없으면 `actualDwellMin: null`을 보존하며 `plannedStayMin`으로 대체하지 않는다.
8. 직렬화 결과에 좌표·주소·geometry·receipt·provider URL·user ID·token이 없다.
9. 손상된 JSON/schema를 읽었을 때 `storage_corrupt`를 반환하고 손상 데이터를 빈 배열로 조용히 덮어쓰지 않는다.
10. storage unavailable/read/write 실패는 typed failure이며 완료 성공으로 위장하지 않는다.
11. 최대 1,000건 초과 시 가장 오래된 기록부터 결정적으로 정리하고 같은 run의 멱등성은 유지한다.
12. 기존 `@timefit/place-feedback-v1` 데이터는 삭제·변형되지 않고 호환 read model에서 계속 읽힌다. rating이 없다고 기본값을 만들지 않고, 기존 계획 체류×tempo 기반 `actualDwellMin`을 새 실제 체류시간으로 집계하지 않는다.
13. repository 단위 테스트에서 Supabase·fetch·외부 API 호출은 0회다.

## 5. 구현할 공개 계약

프로젝트 명명 규칙에 맞추되 의미는 아래와 같아야 한다. `src/engine/types.ts`나 추천 public type을 수정하지 말고 DB/service 소유 타입으로 둔다.

```ts
type CourseCompletionPlaceV1 = Readonly<{
  contentId: string;
  title: string;
  category: string;
  subCategory: string | null;
  plannedStayMin: number;
  actualDwellMin: number | null;
}>;

type CourseCompletionRecordV1 = Readonly<{
  schemaVersion: 1;
  completionId: string;
  courseRunId: string;
  completedAt: number;
  trigger: 'explicit_course_finish';
  places: readonly CourseCompletionPlaceV1[];
}>;
```

- `courseRunId`는 코스 시작부터 완료 재시도까지 유지되는 opaque ID다. repository가 매 완료 tap마다 새 run ID를 만들면 안 된다. 이번 작업에서는 호출자가 제공하도록 하고, UI/App Group 생성·보존은 후속에 명시한다.
- `completionId`는 최초 저장 시 한 번 생성하고 동일 run 재시도에서는 기존 값을 반환한다.
- `places`는 출시 범위인 1~2개만 허용하고 엔진 snapshot 순서를 보존한다.
- `actualDwellMin`은 사용자 확인 도착·출발이 모두 있는 경우에만 숫자다. 그 외는 반드시 `null`이다.
- 화면에서 쓰던 자유 문자열을 그대로 신뢰하지 말고 runtime validation을 둔다.

repository 공개 결과는 예외 문자열을 화면에 노출하지 않도록 최소한 아래를 구분한다.

```ts
type CompleteCourseResult =
  | { status: 'created'; record: CourseCompletionRecordV1 }
  | { status: 'already_completed'; record: CourseCompletionRecordV1 }
  | { status: 'invalid_input' }
  | { status: 'storage_unavailable' }
  | { status: 'storage_corrupt' };
```

읽기 역시 `ok/empty`를 오류와 구분하고, 개인 정보 초기화 후속 연결을 위해 이 저장소만 지우는 typed clear entry를 제공한다.

## 6. 저장 구현 규칙

1. 새 versioned key(권장: `@timefit/course-completions-v1`)와 schema envelope를 사용한다. `placeFeedback`·legacy saved course·App Group key를 재사용하지 않는다.
2. storage adapter를 인터페이스로 주입하고 production adapter만 AsyncStorage에 연결한다. 테스트는 memory/failing/corrupt adapter를 사용한다.
3. 같은 프로세스의 read-modify-write를 module-level 직렬화 큐 또는 동등한 mutex로 보호해 연타 시 중복을 막는다.
4. 중복 판정은 표시명·장소 ID가 아니라 안정적인 `courseRunId`다.
5. 새 기록은 완료 시각 내림차순으로 읽히게 하거나 read model에서 명시적으로 정렬한다.
6. 최대 1,000개만 보유하고 초과분은 완료 시각이 가장 오래된 순서로 제거한다. 손상 데이터는 이 정리 과정으로 덮어쓰지 않는다.
7. 완료 저장소는 로컬 전용이다. Supabase session, anonymous Auth, network 상태에 의존하지 않는다.
8. 로그에는 ID·장소명·저장 payload를 출력하지 않는다. typed 상태만 호출자에 반환한다.

## 7. legacy 후기 호환과 집계 read model

- 기존 `placeFeedback` 저장 구조와 key는 유지한다. migration이라는 이름으로 삭제·초기화하지 않는다.
- 새 완료 기록의 장소 항목과 과거 후기 활동을 한 화면에서 읽을 수 있는 순수 projection/read 경계를 제공한다. 과거 후기는 `legacy-feedback:<기존 id>`처럼 안정적인 호환 ID를 사용하되 원본을 새 완료 key에 복제하지 않는다.
- 새 기록과 legacy 후기를 합칠 때 `rating` 기본값을 만들지 않는다. 이번 작업 뒤 새 완료 기록에는 rating이 없어도 정상이다.
- 현재 `FeedbackScreen`이 legacy `actualDwellMin`을 실제 timestamp 차이가 아니라 `spot.dwell × 0.75/1/1.3`으로 합성한다는 점을 테스트로 고정한다. 이 값은 호환 read model에서 `actualDwellMin: null`로 투영하고, 필요하면 별도 `legacyEstimatedDwellMin`에만 보존한다. 완료 활동 시간·DB-DWELL·2-AB 입력에 사용하지 않는다.
- 집계 projection에는 최소 `activityId`, `completedAt`, `contentId`, `category`, `subCategory`, `actualDwellMin | null`, `source: 'completion' | 'legacy_feedback'`를 제공한다.
- 장소 수·카테고리 분포는 완료 장소를 포함한다. 활동 시간 합계는 `actualDwellMin`이 유효한 항목만 포함하고, 함께 `measuredCount/unmeasuredCount`를 노출해 UI가 `0분`과 `미측정`을 구분할 수 있게 한다.
- 이 작업에서 `ActivityRecordScreen`, 탭 구조, 화면 문구를 수정하지 않는다. UI 소비 전환은 별도 UIUX 작업이다.

## 8. 문서 변경

- `docs/04_backend/데이터베이스설계.md`에 `이전 후기 기반 완료 → 후기 없는 완료 누락 → 명시 완료 로컬 저장 → 분리 이유 → 현행/구현 상태` 이력을 추가한다.
- 로컬 완료 기록과 서버 체류 표본의 차이, 비로그인 로컬 허용, 서버 자동 업로드 금지, 민감 정보 제외 필드를 명시한다.
- 작업을 끝낸 뒤 이 파일 하단에 인수인계 4항목을 추가한다. `docs/작업조정_보드.md`, `docs/테스트.md`, `추천로직.md`, UIUX 문서는 DB 세션이 수정하지 않는다.

## 9. 수정 금지 경계

- `src/ui/**`, `App.tsx`, navigation/tab 구성
- `src/engine/**`, 추천 순위·후보·체류 하드 조건
- 장소 카탈로그·외부 API·route cache
- Widget Extension, App Group, ActivityKit, notification scheduling
- Supabase migration/RLS/table/function와 원격 DB 적용
- 기존 applied migration 편집·삭제
- 사용자 요청 없는 commit/push

## 10. 완료 조건

- 위 13개 반례를 포함한 repository/집계 순수 테스트가 통과한다.
- 최소 `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다.
- 완료 기록 저장이 로그인·네트워크·후기 없이 동작하고, 실제 체류 미확인은 `null`로 남는 것을 테스트로 증명한다.
- 기존 후기 fixture와 기존 course repository 회귀가 통과한다.
- Supabase migration·운영 DB·실기기·외부 API를 건드리지 않는다.

## 11. 완료 인수인계 형식

작업 완료 시 이 문서에 아래 네 항목을 실제 파일명·테스트 수와 함께 기록한다.

1. 변경 파일과 변경 목적
2. 변경하지 않은 공개 계약·정책 경계
3. 실행한 테스트와 결과
4. 다음 세션이 결정하거나 연결할 사항·위험·재현 조건

특히 후속 UIUX에 `courseRunId` 생성/복구 책임, `코스 마치기` 단일 호출 위치, 저장 실패가 코스 완료 자체를 막지 않는 표시 정책을 명시한다.

## 12. 2026-09-04 — 완료 인수인계

### 1. 변경 파일과 변경 목적

- `src/services/courseCompletionRepository.ts`: `CourseCompletionRecordV1`, `CompleteCourseResult`, typed read/clear와 주입형 `CourseCompletionStorage`를 제공한다. `@timefit/course-completions-v1` envelope, `courseRunId` 멱등성, 동일 storage의 module-level 직렬화, 최신순 read와 최대 1,000건 정리를 구현했다.
- `src/services/courseCompletionAsyncStorage.ts`: production에서만 AsyncStorage를 연결하는 얇은 adapter와 repository singleton을 제공한다. 순수 repository는 React Native·로그인·Supabase·network에 의존하지 않는다.
- `test/course-completion-repository.test.ts`: 명세의 13개 반례를 memory/failing/corrupt storage로 고정했다.
- `docs/04_backend/데이터베이스설계.md`: 후기 기반 완료 누락에서 명시 완료 로컬 저장으로 바뀐 이력, 로컬 완료와 서버 체류 표본의 분리, 민감 필드·자동 업로드 금지와 legacy 합성 체류 비승격을 현행 계약으로 기록했다.
- `docs/work/db-personalization/README.md`, 이 문서: 현재 상태와 다음 소비 경계를 갱신했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- UI·navigation·`VerifiedCourseProgressScreen`, `src/engine/**`, 기존 `placeFeedback` key/구조, legacy `courseRepository`, App Group·ActivityKit·알림, 외부 API·Route Proxy를 변경하지 않았다.
- Supabase migration/RLS/table/function과 운영 DB는 변경하지 않았다. 완료 record는 로그인·anonymous Auth·user ID·network에 의존하거나 서버로 자동 업로드되지 않는다.
- 직렬화 payload에는 출발/도착 좌표·주소, geometry·receipt·provider URL, user/token/key를 넣지 않는다. 로그도 추가하지 않았다.
- legacy 후기의 계획 체류 기반 `actualDwellMin`은 새 실제 체류로 승격하지 않고 projection에서 `actualDwellMin: null`과 선택적 `legacyEstimatedDwellMin`으로 분리한다. rating 기본값이나 새 completion key 복제도 만들지 않았다.

### 3. 실행한 테스트와 결과

- 실패 우선: production repository 파일이 없는 상태에서 신규 테스트가 `MODULE_NOT_FOUND`로 실패함을 확인한 뒤 구현했다.
- `npx tsx --test test/course-completion-repository.test.ts` — **13/13 통과**. 1·2곳 순서, 순차/동시 멱등성, 같은 장소 다른 run, invalid input 무변경, explicit trigger, 미측정 null, 민감 필드 부재, corrupt/unavailable 경계, 1,000건 정리, legacy key·rating·합성 체류 분리, 외부 호출 0을 확인했다.
- `node --test test/course-replan-contract.test.mjs test/mixed-travel-contract.test.mjs` — **8/8 통과**. 기존 course repository 회귀를 확인했다.
- `npm run test:typecheck` — 통과.
- `npm test` — **117/117 통과**, 실패·skip 0.
- `npm run test:ui` — **258/259 통과**, 기존 명시 skip 1, 실패 0. 첫 재확인은 sandbox의 `tsx` IPC socket `EPERM`으로 실행 전 중단됐고, 동일 명령을 권한 확장해 통과했다.
- `git diff --check` — 통과. Supabase·fetch·외부 API·운영 DB·실기기 호출은 0회다.

### 4. 다음 세션의 결정·연결 사항과 위험·재현 조건

- `U-LIVE-ACTIVITY-01`은 코스 시작 시 stable opaque `courseRunId`를 한 번 생성하고 App Group 활성 진행에 보존·복구해야 한다. 완료 재시도와 앱 복구도 같은 ID를 사용하며 완료 tap마다 새 ID를 만들면 안 된다.
- 명시 `코스 마치기`의 단일 action 위치에서 production repository의 `complete`를 한 번 호출한다. 장소 선택·코스 보기·길찾기·취소·화면 재렌더에서는 호출하지 않는다.
- `created`와 `already_completed`는 같은 완료 사실로 표시할 수 있다. `invalid_input`, `storage_unavailable`, `storage_corrupt`는 기록 저장 실패로 구분하되 코스 완료 행위 자체나 화면 종료를 되돌리지 말고, 같은 `courseRunId`로 재시도할 수 있는 별도 안내를 결정해야 한다. 저장 성공으로 위장하거나 손상 storage를 자동 초기화하면 안 된다.
- 기록 탭 소비 작업은 repository read의 `ok/empty/error`를 구분하고 completion+legacy projection의 `measuredCount/unmeasuredCount`를 사용해야 한다. 미측정 완료를 `0분 활동`이나 개인화 표본으로 바꾸지 않는다.
