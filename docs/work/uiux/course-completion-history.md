# U-COMPLETION-HISTORY-01 — 비로그인 포함 명시 완료 기록·기록 탭 연결

> 상태: **구현 완료·후속 QA 인계**  
> 담당: **UIUX 세션 단독 writer**  
> 선행: `DB-COMPLETION-RECORD-01` 구현, `DEC-COMPLETION-RECORD-01`, `U-RUNTIME-GUARD-01`  
> 후속: 완료 UI 전용 QA 또는 `QA-LIVE-ACTIVITY-01`의 선행 게이트  
> 병렬: **다른 UIUX/Live Activity 작업과 병렬 금지** — active model, 진행, 기록, 내정보를 함께 수정한다.

## 1. 왜 Live Activity에서 분리하는가

후기 없는 완료 기록은 출시 필수 기본 흐름이고 Live Activity는 일정에 따라 축소 가능한 iOS 부가 기능이다. 둘을 한 작업에 묶으면 Live Activity 지연 때문에 `코스 마치기`와 기록 탭도 동작하지 않는다.

따라서 이번 작업은 다음만 먼저 완결한다.

`코스 시작 시 안정적 run 생성 → 명시 코스 마치기 → 로컬 repository 멱등 저장 → 기록 탭 표시`

App Group 영속 복구, ActivityKit, 도착/출발 알림과 실제 체류시간 측정은 `U-LIVE-ACTIVITY-01`에 남겨 같은 `courseRunId`와 repository를 재사용한다.

## 2. 먼저 읽을 파일

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/work/integration-decision/course-completion-record.md`
3. `docs/work/db-personalization/course-completion-record.md`의 완료 인수인계
4. `docs/work/uiux/runtime-course-auth-guard.md`의 완료본
5. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`
6. `src/services/courseCompletionRepository.ts`, `courseCompletionAsyncStorage.ts`, `placeFeedback.ts`
7. `src/ui/activeVerifiedCourseModel.ts`, `AppFlowContext.tsx`, `VerifiedCourseProgressScreen.tsx`, `ActivityRecordScreen.tsx`, `ProfileScreen.tsx`
8. `src/ui/activity/**`, runtime catalog와 관련 tests

작업 전 완료 저장·기록 화면 소비자를 `rg`로 다시 찾는다. `CourseCompletionRecordV1`과 같은 목적의 임시 key/repository가 생겼다면 중복 저장소를 만들지 말고 반환한다.

## 3. 확정 사용자·개인정보 규칙

- 일반 로그인 여부와 관계없이 사용자가 **명시 `코스 마치기`**를 누른 경우에만 로컬 완료 기록을 만든다.
- 장소 선택, 코스 확인, 코스 시작, Kakao 길찾기 실행/복귀, active 교체·취소는 완료가 아니다.
- 완료 기록은 이 기기 로컬 기록이다. anonymous Auth ID나 일반 계정 ID와 연결하거나 Supabase로 자동 업로드하지 않는다.
- 로그인/로그아웃만으로 이 기기 기록을 자동 삭제·병합·서버 전송하지 않는다. 기록 화면은 `이 기기의 완료 기록`이라는 의미가 오해되지 않게 표현한다.
- 현재 repository의 `clear()`는 새 completion key만 지우고 legacy 후기 key는 의도적으로 보존한다. 따라서 이번 UI 작업에서 `이 기기의 모든 기록 지우기`를 제공하거나 삭제 완료를 주장하지 않는다. 전체 로컬 기록 삭제는 두 저장소를 함께 다루는 별도 DB 개인정보 삭제 계약 뒤 연결한다.
- 서버 체류 개인화는 일반 로그인+별도 동의+향후 도착/출발 확인 표본만 사용한다. 이번 로컬 완료 전체를 개인화 표본으로 쓰지 않는다.
- 완료 당시 실제 체류 측정이 없으므로 `actualDwellMin: null`이다. 계획 체류를 실제 체류로 합성하지 않는다.

## 4. 안정적인 courseRunId

- 현재 process identity와 별도로 `courseRunId`를 active V1에 둔다.
- 새 코스를 실제 시작할 때 한 번만 만들고, Home 왕복·Kakao 복귀·완료 재시도 동안 같은 값을 유지한다.
- 같은 active snapshot 이어가기는 새 run을 만들지 않는다. 다른 코스로 명시 교체할 때만 새 run을 만든다.
- 장소명·course ID·좌표·시각·사용자 ID를 이어 붙여 만들지 않는다. cryptographic UUID 또는 동등한 opaque random ID를 사용하고 테스트에는 factory를 주입한다.
- 이번 작업은 process lifetime만 보장한다. force quit/relaunch 복구는 App Group이 연결되는 Live Activity 작업에서 같은 필드를 영속화한다.

## 5. 실패 우선 fixture

### 5.1 시작·완료 side effect

1. 1곳/2곳 코스 시작은 `courseRunId`를 각각 한 번 만들고 방문 순서를 유지한다.
2. Home/외부 지도 왕복·진행 갱신·같은 snapshot 이어가기는 run ID를 바꾸지 않는다.
3. 다른 코스 교체는 이전 완료 저장 0, 새 run 1개다.
4. route open·취소·뒤로가기·앱 background는 repository `complete` 0회다.
5. 명시 완료 한 번은 `complete` 1회이며 빠른 연타/재시도는 같은 run ID로 repository 멱등 결과를 받는다.
6. `created`와 `already_completed`는 완료 성공으로 처리하되 기록을 중복 표시하지 않는다.
7. `invalid_input/storage_unavailable/storage_corrupt`를 성공으로 표시하지 않는다.
8. 저장 실패에는 `다시 시도`와 `기록 없이 마치기`를 제공한다. 다시 시도 전 active/run을 유지하고, 기록 없이 마치기를 선택하면 완료 저장 성공을 주장하지 않은 채 active를 종료한다.
9. 성공 후 active clear와 최상위 navigation은 한 번이다.

### 5.2 payload와 기록 화면

1. completion input의 places는 course stop 순서이며 catalog의 `contentId/title/category/subCategory`와 stop의 `stayMin`, `actualDwellMin: null`만 사용한다.
2. catalog 누락·stop 불일치는 typed UI failure이며 임의 제목/category나 30분을 합성하지 않는다.
3. 이번 달 completion과 legacy feedback을 기존 service projection으로 합치되 legacy rating/추정 체류는 실제 체류로 승격하지 않는다.
4. 이번 달 경계는 고정 `now`로 검증하고 이전 달 기록은 이번 달 수치에 포함하지 않는다.
5. 카테고리 비율은 완료 장소 **개수 기준**이다. 실제 체류 미측정 때문에 모든 비율이 0%가 되면 안 된다.
6. 완료 기록이 있고 측정 표본 0개면 `0분 활동`이 아니라 `체류시간 미측정`을 표시한다.
7. 일부 측정 표본이 있으면 측정된 시간만 합하고 미측정 장소 수를 함께 구분한다.
8. completion storage 손상/읽기 실패는 빈 기록으로 위장하지 않고 복구 가능한 오류 안내를 표시한다.
9. 모든 흐름에서 Supabase·Auth user ID·Route Proxy·Kakao·추천 엔진 호출 0회다.

## 6. 구현 순서

1. `activeVerifiedCourseModel`에 주입 가능한 opaque run ID factory와 `courseRunId` 필드를 추가한다. 기존 UI identity 역할과 합치지 않는다.
2. `AppFlowContext`의 실제 새 active 생성에서만 run ID를 만들고, `U-RUNTIME-GUARD-01`의 same/different/replace 판정을 유지한다.
3. catalog와 verified course를 `CompleteCourseInput`으로 바꾸는 순수 UI projection을 만든다. service repository 타입을 복제하거나 엔진 타입을 수정하지 않는다.
4. `VerifiedCourseProgressScreen`의 단일 명시 finish action을 async controller로 분리해 repository 결과별 UI와 clear/navigation을 결정한다. 빠른 연타 lock은 실패 재시도를 막지 않게 상태 전이형으로 보완한다.
5. 성공 시 기록 탭으로 이동해 방금 완료가 보이게 한다. 저장 실패 후 `기록 없이 마치기`를 선택한 경우에는 기록 성공처럼 강조하지 않는다.
6. `ActivityRecordScreen`을 `courseCompletionRepository.read()` + legacy `readPlaceFeedback()`의 read model로 전환한다. 이번 달 필터, count 기반 category 비율, measured/unmeasured 표시를 순수 helper로 분리한다.
7. 기존 `ActivityDonut`이 시간 비율만 가정한다면 count 기반 명시 view model로 좁혀 접근성 문구도 `카테고리별 완료 장소 비율`로 교체한다.
8. 내정보에는 device-local 기록의 의미만 정확히 안내한다. legacy까지 함께 지울 공개 계약이 없으므로 삭제 버튼을 직접 AsyncStorage key에 연결하거나 일부 삭제를 전체 삭제처럼 표시하지 않는다.

## 7. 수정 허용 파일

- `src/ui/activeVerifiedCourseModel.ts`
- `src/ui/AppFlowContext.tsx`
- `src/ui/VerifiedCourseProgressScreen.tsx`
- `src/ui/ActivityRecordScreen.tsx`
- `src/ui/ProfileScreen.tsx` — 로컬 기록 의미 안내가 필요한 최소 표시만
- `src/ui/activity/**`
- 새 UI projection/controller helper (`src/ui/**`)
- 관련 `test/ui/**`
- 이 작업 문서 완료 인수인계

`src/services/courseCompletionRepository.ts`와 AsyncStorage adapter는 DB 작업의 수락 대상이므로 수정하지 않고 소비한다. 공개 계약 결함이 확인되면 임의 수정하지 말고 `DB-COMPLETION-RECORD-01`에 재현을 반환한다.

## 8. 수정 금지 경계

- `src/engine/**`, 추천 결과·체류·1/2곳·route snapshot
- `src/data/**` 원본/런타임 catalog 내용 변경
- 외부 API·Kakao·Route Proxy·cache·환경변수
- Supabase migration/RLS/table, anonymous Auth 정책
- App Group·Widget Extension·ActivityKit·notification·GPS
- 완료 기록 서버 동기화·계정 병합
- legacy 후기 삭제/변형 또는 계획 체류의 실제 체류 승격
- 중앙 기준 문서/보드와 사용자 요청 없는 commit/push

## 9. 검증과 완료 조건

최소 실행:

```bash
npx tsx --test test/course-completion-repository.test.ts test/ui/course-completion-history.test.ts
npx tsx --test test/ui/active-verified-course-resume.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

합격하려면 비로그인/account 고정 fixture가 같은 로컬 완료 결과를 만들고, 익명·일반 user ID가 payload/storage에 없으며, 성공/중복/실패/재시도/기록 없이 마치기와 이번 달/미측정/손상 read 상태가 모두 관찰 가능해야 한다.

실제 Kakao·Supabase·Simulator 조작은 구현 완료 판정 근거가 아니다. 수동 확인은 후속 QA에서 비로그인 1곳 완료→기록 표시와, 필요 시 2곳 순서 표시만 제한한다. 전체 로컬 삭제 확인은 별도 DB 삭제 계약 이후로 미룬다.

## 10. 완료 인수인계

1. 변경 파일과 각 파일의 상태/표시/저장 책임
2. 수정하지 않은 DB repository·추천/API/App Group/개인화 경계
3. fixture별 repository/clear/navigation/외부 호출 횟수와 전체 회귀 결과
4. 후속 Live Activity가 영속화할 `courseRunId`, 실제 체류 입력 연결점, 수동 QA 항목

## 11. 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 각 파일의 책임

- `src/ui/activeVerifiedCourseModel.ts`: process identity와 별도인 `courseRunId`를 active V1에 추가했다. 주입 가능한 opaque UUID factory를 사용해 실제 새 시작에서만 한 번 만들며 progress 갱신·같은 snapshot 이어가기에는 그대로 보존한다.
- `src/ui/AppFlowContext.tsx`: Expo native UUID v4를 앱 composition에서 run ID factory에 주입하고, 새 active 생성 시에만 소비한다. 기존 same/different/replace guard는 그대로 사용한다.
- `src/ui/courseCompletionUiModel.ts`: verified stop 순서와 runtime catalog의 `contentId/title/category/subCategory`, stop의 계획 체류만 `CompleteCourseInput`으로 좁힌다. `actualDwellMin`은 항상 `null`이며 누락 catalog·불일치는 `invalid_snapshot`으로 fail-closed한다. async finish controller는 저장 중 연타, created/already completed, typed 실패, 동일 run 재시도, 기록 없이 종료를 직렬화한다.
- `src/ui/courseCompletionComposition.ts`: 진행 화면이 AsyncStorage 구현명에 직접 결합되지 않도록 수락된 production repository singleton을 UI container에 조립한다.
- `src/ui/VerifiedCourseProgressScreen.tsx`: 마지막 `도착 후 코스 마치기`/완료 상태의 명시 action에서만 repository `complete`를 호출한다. 성공은 active clear 후 기록 탭, 실패는 active/run 유지와 `다시 시도`·`기록 없이 마치기`를 제공한다.
- `src/ui/activity/activitySummary.ts`, `ActivityDonut.tsx`: completion+legacy service projection을 이번 달로 필터하고 완료 장소 개수 기준 category 비율을 만든다. 측정/미측정 수와 측정된 실제 체류만 분리하며 donut 접근성 의미를 `카테고리별 완료 장소 비율`로 교체했다.
- `src/ui/ActivityRecordScreen.tsx`: 새 completion read와 legacy 후기를 함께 읽는다. 정상 empty와 storage corrupt/unavailable을 구분하고, 미측정 전체는 `0분` 대신 `체류시간 미측정`, 일부 측정은 측정 시간과 미측정 장소 수를 표시한다.
- `src/ui/ProfileScreen.tsx`: 로그인 상태와 무관하게 완료 기록이 이 기기에만 저장되고 자동 업로드되지 않는다는 안내만 추가했다. 전체 삭제 UI는 만들지 않았다.
- `test/ui/course-completion-history.test.ts`: run 생성/유지/교체, 1·2곳 순서, payload, 명시 완료 side effect, 비완료 event 0회, 멱등 성공·실패·재시도·기록 없이 종료, 이번 달/count 비율/미측정/read 오류/로그인 독립 fixture 14개를 추가했다.

### 2. 유지한 DB repository·추천/API/App Group/개인화 경계

- 수락된 `src/services/courseCompletionRepository.ts`, `courseCompletionAsyncStorage.ts`의 key/schema/멱등/typed 결과와 legacy 후기 저장소를 수정하지 않았다. `clear()`도 UI에 연결하지 않아 일부 key 삭제를 전체 기록 삭제로 표시하지 않는다.
- completion payload/storage에는 Auth·anonymous/일반 user ID, 출발·도착 좌표/주소, geometry/receipt/provider URL/token을 넣지 않으며 Supabase 업로드·계정 병합을 추가하지 않았다. 비로그인과 일반 로그인은 동일한 device-local 흐름이다.
- 추천 엔진·runtime catalog 내용·Kakao/Route Proxy·DB migration/RLS/repository·Live Activity/App Group/ActivityKit/notification/GPS를 수정하지 않았다.
- 계획 체류는 `plannedStayMin`으로만 보존하고 실제 체류로 승격하지 않았다. legacy 후기의 합성 체류 역시 service projection의 `actualDwellMin: null` 계약대로 완료 시간·개인화 표본에서 제외한다.

### 3. 테스트 결과와 side effect 계수

- 실패 우선: UI helper 구현 전 `npx tsx --test test/ui/course-completion-history.test.ts`가 `courseCompletionUiModel` 부재로 `0 pass / 1 fail`인 것을 확인했다.
- `npx tsx --test test/ui/course-completion-history.test.ts`: **14/14 통과**.
- `npx tsx --test test/course-completion-repository.test.ts test/ui/course-completion-history.test.ts`: **27/27 통과**.
- `npx tsx --test test/ui/active-verified-course-resume.test.ts`: **14/14 통과**.
- `node --test test/map-transport-ui-contract.test.mjs`: **14/14 통과**. 첫 core 실행에서 진행 화면 import 문자열이 기존 AsyncStorage 직접 결합 금지 assertion을 2곳에서 중복 실패시켰고, UI composition 경계로 교체한 뒤 통과했다.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **304개 중 303 pass / 기존 의도 skip 1 / fail 0**.
- `npm test`: **117/117 통과**.
- `git diff --check`: 통과.
- fixture 계수: 새 1곳/2곳 시작은 run 생성 각 1회, 같은 active 왕복/갱신은 추가 생성 0, 다른 코스 교체는 이전 completion 0·새 run 1이다. route open·교체 취소·뒤로가기·background는 `complete/clear/navigation` 모두 0이다. created/already completed와 빠른 연타는 `complete/clear/navigation` 각 1회다. 첫 저장 실패는 `complete 1 / clear 0 / navigation 0`, 같은 run 재시도 성공 뒤 누적 `complete 2 / clear 1 / navigation 1`, 기록 없이 종료는 저장 성공 주장 없이 `clear/navigation` 각 1회다. Supabase·Auth ID·추천·Kakao/Route Proxy·DB·Live Activity 호출은 0이다.

### 4. 후속 연결·위험·수동 QA

- `U-LIVE-ACTIVITY-01`은 현재 `ActiveVerifiedCourse.courseRunId`를 App Group 활성 상태에 영속화해 force quit/relaunch 뒤에도 같은 값을 복구해야 한다. 새 identity나 course ID/좌표/시각 기반 ID로 대체하면 repository 멱등성이 깨진다.
- 실제 도착·출발 확인이 모두 생기는 후속에서만 `buildCompleteCourseInput`의 `actualDwellMin: null` 입력 지점을 사용자 확인 측정값으로 좁혀 연결한다. 계획 체류나 legacy 추정값을 대신 넣으면 안 된다.
- 후속 수동 QA는 비로그인 1곳 `코스 마치기 → 기록 탭 즉시 표시 → 체류시간 미측정`, 일반 로그인 동일 로컬 동작, 필요 시 2곳 완료 순서와 category count 비율을 확인한다. 저장 실패 fixture의 retry/기록 없이 종료는 자동 검증됐고 실제 storage 장애 조작은 필수 완료 근거가 아니다.
- process lifetime run 보존만 구현했다. 강제 종료 복구는 아직 보장하지 않으며, 전체 로컬 기록 삭제는 legacy key까지 함께 다루는 별도 DB 개인정보 삭제 계약 전에는 추가하면 안 된다. 사용자 요청 전 commit/push하지 않았다.
