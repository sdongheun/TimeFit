# U-PROGRESS-RESUME-01 — V1 활성 코스의 메인 이어가기 연결

> 상태: **수락 — QA-PROGRESS-RESUME-01 자동·비로그인 실기기 통과**  
> 담당: **UIUX 세션 단독 writer**  
> 선행: `U-RELEASE-VISUAL-01` 자동 검증 완료  
> 후속: `QA-PROGRESS-RESUME-01`, 이후 `U-LIVE-ACTIVITY-01`

## 1. 목적과 사용자 관찰

최신 internal build에서 추천 카드 밀도와 코스 확인의 full-bleed 지도·세로 순서는 확인됐지만, V1 코스를 시작한 뒤 메인으로 돌아가면 `진행 중인 코스`가 표시되지 않았다. 사용자가 카카오맵을 열었다가 돌아오거나 앱 안에서 메인으로 이동했을 때 진행하던 코스를 잃은 것처럼 보이는 문제다.

성공하면 로그인 여부와 관계없이 다음 흐름이 관찰돼야 한다.

1. `코스 확인 → 코스 시작하기`로 V1 진행을 시작한다.
2. 카카오맵 foreground handoff·앱 background/foreground 또는 앱 안의 메인 이동 뒤에도 활성 코스가 유지된다.
3. 메인의 `진행 중인 코스` 카드는 현재 V1 코스의 장소와 이어가기 행동을 보여 준다.
4. 카드를 누르면 새 코스를 만들거나 첫 단계로 초기화하지 않고 마지막으로 확정된 진행 단계에서 이어진다.
5. 명시 완료 또는 명시 취소 때만 활성 V1 상태가 사라진다.

이 작업의 `앱을 나감`은 **같은 앱 프로세스가 살아 있는 background/foreground와 외부 카카오맵 전환**을 뜻한다. 강제 종료·OS eviction·기기 재부팅 뒤 복구는 App Group이 필요한 `U-LIVE-ACTIVITY-01` 범위이며, 이번 작업이 지원한다고 표시하지 않는다.

## 2. 현재 원인과 근거

확정된 원인은 다음과 같다.

- `CourseConfirmScreen`의 V1 시작 CTA는 `VerifiedCourseProgress`로 navigation만 하고 활성 코스를 등록하지 않는다.
- `VerifiedCourseProgressScreen`의 `stepIndex`, `routeOpened`, `finished`는 화면 로컬 state라 화면이 제거되면 복구할 수 없다.
- `AppFlowContext.activeCourse`는 legacy `ExecutionParams` 전용이고 초기값이 `null`이다. V1 `RecommendationSession + VerifiedCourseV1`과 진행 state를 받을 계약이 없다.
- `HomeScreen`은 legacy `activeCourse`만 읽어 `Execution`으로 이동한다. V1 코스를 시작해도 이 값은 바뀌지 않는다.
- `DB-COMPLETION-RECORD-01`은 명시 완료 뒤 이력을 누적하는 repository다. 활성 진행 상태나 진행 단계 복구 저장소로 재사용하면 안 된다.

원인이 확정됐으므로 임의 timeout, navigation focus 시 재추천, legacy `Course` 변환, 로그인 여부 분기로 가리지 않는다.

### 작업 성격 판정

이 문제는 단순한 카드 표시/간격 버그가 아니다. 화면·상태·navigation을 잇는 **UI 애플리케이션 상태 통합 문제**다. 다만 이번 프로세스 내 복구에는 추천 엔진, 외부 API, DB, 로그인 정책 변경이 필요하지 않으므로 소유 역할은 UIUX가 맞다. 강제 종료 뒤 복구까지 포함하면 App Group·ActivityKit과 안정적인 `courseRunId`가 필요해 `U-LIVE-ACTIVITY-01`의 네이티브/저장 통합 문제가 된다.

## 3. 현행 계약과 변경 이력

| 상태 | 내용 |
| --- | --- |
| 이전 방식 | V1 진행 snapshot과 단계는 `VerifiedCourseProgressScreen` 메모리에만 있고 Home은 legacy `activeCourse`만 읽었다. |
| 발생한 문제 | V1 진행 중 메인으로 이동하면 활성 카드가 없고, 다시 들어갈 V1 entry가 없어 진행 맥락이 끊겼다. |
| 교체 방식 | legacy와 분리한 UI runtime `activeVerifiedCourse`를 AppFlow에 한 건만 두고 V1 시작·단계 변경·이어가기·완료/취소를 같은 상태 경계로 연결한다. |
| 교체 이유 | 비로그인도 사용할 수 있는 현재 세션 이어가기를 먼저 완결하고, 영속 복구·Live Activity·서버 개인화와 혼합하지 않기 위함이다. |
| 상태 | **현행 제품 결정·구현 전**. 프로세스 생존 중 복구만 이번 작업, 강제 종료 복구는 `U-LIVE-ACTIVITY-01`. |

관련 요구사항은 `UX-19`, `UX-30`, `UXV-30`이다. 추천 결과·시간·경로 snapshot은 다시 계산하지 않는다.

## 4. 로그인·개인정보 경계

- 일반 로그인, Route Proxy anonymous Auth, 비로그인 모두 같은 로컬 runtime 이어가기를 사용한다.
- 사용자 로그인을 요구하거나 로그인 화면으로 보내지 않는다.
- 일반 로그인 여부와 체류 기록 동의는 서버 개인화 저장에만 영향을 준다.
- 이번 작업은 AsyncStorage, App Group, Supabase, completion repository, 로그 파일에 활성 snapshot을 저장하지 않는다.
- 정확한 출발·도착 좌표가 포함된 `RecommendationSession`은 이미 navigation 메모리에 존재하는 범위에서만 사용하며 console/analytics/error 문구에 출력하지 않는다.

## 5. 구현 계약과 순서

### 5.1 V1 전용 활성 상태

`AppFlowContext`에 legacy `activeCourse`를 바꾸거나 합치는 대신 별도의 V1 전용 상태를 추가한다. 이름은 의미가 같은 범위에서 조정할 수 있지만 다음 값은 명시적으로 가져야 한다.

- 원본 `RecommendationSession`
- 원본 `VerifiedCourseV1`
- `VerifiedCourseProgressState`
- 같은 runtime 안에서 코스를 식별할 안전한 UI identity

UI identity는 장소명이나 좌표 문자열을 로그·저장용 ID로 합성하지 않는다. 이번 작업에서는 프로세스 메모리 비교에만 쓰며 서버·completion `courseRunId` 계약으로 승격하지 않는다. 안정적인 영속 `courseRunId` 생성은 `U-LIVE-ACTIVITY-01`이 담당한다.

다음 action을 제공한다.

- V1 시작: 활성 V1 한 건을 초기 단계로 등록한다.
- 진행 갱신: 같은 identity의 현재 단계만 갱신한다.
- 명시 완료/취소: 같은 identity일 때만 제거한다.
- 다른 V1 코스 명시 시작: 이전 runtime 활성 코스를 새 코스로 교체한다.

legacy `activeCourse`, `savedCourses`, `Execution`, legacy repository의 타입과 동작은 유지한다. 양쪽 상태가 동시에 있으면 Home에서는 사용자가 마지막으로 명시 시작한 V1을 우선 표시하되 legacy 데이터를 삭제하거나 변환하지 않는다.

### 5.2 코스 시작 연결

`CourseConfirmScreen`의 `코스 시작하기` 한 번의 행동에서 다음 순서를 지킨다.

1. 전달받은 `session/course`를 그대로 사용해 V1 runtime active state를 초기화한다.
2. 성공적으로 active state를 만든 뒤 기존 `VerifiedCourseProgress`로 이동한다.
3. 추천 엔진, Route Proxy, Kakao API, DB, Auth 호출은 0회다.
4. 빠른 중복 탭으로 서로 다른 active 상태나 navigation push를 두 번 만들지 않는다.

추천 snapshot의 장소 순서, legs, stay, geometry, 시간, 도착 여유를 수정하거나 재검증하지 않는다.

### 5.3 진행 화면을 단일 상태 경계로 연결

`VerifiedCourseProgressScreen`은 화면 로컬 state와 AppFlow state가 서로 다른 진실이 되지 않게 한다.

- 코스 시작 entry와 Home 이어가기 entry 모두 같은 활성 V1 진행 state를 읽는다.
- `routeOpened`와 `stepIndex`는 기존 `verifiedCourseProgressModel`의 순수 전이 결과가 성공한 뒤에만 동기화한다.
- 카카오맵 open 실패, invalid stage, 중복 tap은 현재 활성 단계도 바꾸지 않는다.
- 외부 카카오맵에서 foreground로 돌아왔다는 사실만으로 도착·체류·다음 단계로 자동 전이하지 않는다.
- header 뒤로가기, 앱 background, 일반 navigation 이탈은 취소가 아니므로 active state를 지우지 않는다.
- 기존 명시 완료 CTA가 성공적으로 끝난 경우에만 active state를 제거한다. 완료 repository 호출은 `U-LIVE-ACTIVITY-01` 전까지 새로 만들지 않는다.

navigation params는 `session/course`의 기존 직렬화 가능한 공개 계약을 유지한다. provider, route port, 함수, Auth session을 params나 active state에 넣지 않는다.

### 5.4 Home 이어가기

`HomeScreen`은 다음 우선순위로 표시한다.

1. `activeVerifiedCourse`가 있으면 V1 `진행 중인 코스` 카드
2. 없고 기존 legacy `activeCourse`가 있으면 기존 legacy 카드
3. 둘 다 없으면 현재 placeholder

V1 카드 tap은 `Execution`이 아니라 `VerifiedCourseProgress`로 이동하고 같은 active identity/state를 이어 쓴다. 카드에는 최소한 `진행 중인 코스`, 현재 코스의 장소명 또는 다음 행동을 이해할 짧은 문구, 이어가기 접근성 레이블을 제공한다. 좌표·provider 상태·진단 값은 노출하지 않는다.

기존 Home CTA와 active/placeholder 그룹 간격 26px, 다크·파란 테마, `AnimatedPressable` 눌림 효과를 유지한다. 일반 Home 카드 tap에는 새 햅틱을 추가하지 않는다.

## 6. 불변·수정 금지 경계

- `src/engine/**`, 추천 후보·순위·1/2곳 정책, 호출 예산을 수정하지 않는다.
- `src/data/**`, 카탈로그, 운영시간을 수정하지 않는다.
- 외부 API adapter·cache·Edge Function·환경변수를 수정하지 않는다.
- `supabase/**`, RLS, `courseCompletionRepository`, `courseCompletionAsyncStorage`를 수정하지 않는다.
- App Group, Widget Extension, ActivityKit, 알림 권한, 로컬 알림을 미리 구현하지 않는다.
- AsyncStorage에 임시 active-course key를 만들지 않는다. 이후 App Group과 이중 저장소가 되는 임시 영속 구현을 금지한다.
- force quit/relaunch 복구를 지원하는 것처럼 문구·테스트·인수인계에 기록하지 않는다.
- legacy `Execution`을 V1 snapshot으로 위장하거나 V1을 legacy `Course`로 손실 변환하지 않는다.
- 중앙 문서와 `docs/작업조정_보드.md`는 UIUX 세션이 수정하지 않는다.

## 7. 필수 선행 실패 fixture와 반례

제품 코드 수정 전에 아래 현재 실패를 재현하는 UI fixture를 추가한다.

1. V1 시작 뒤 Home model이 placeholder를 반환하는 현재 실패.
2. 진행 2단계에서 Home을 거쳐 재진입하면 0단계로 초기화되는 현재 실패.

구현 뒤 최소 다음을 모두 고정한다.

1. 비로그인 context에서 V1 시작 → Home 활성 카드 → 같은 단계 이어가기.
2. 일반 로그인 context에서도 동일하며 로그인 여부에 따른 화면·상태 차이 0.
3. legacy active만 있을 때 기존 Home 카드와 `Execution` 이동 유지.
4. V1과 legacy가 함께 있을 때 V1 우선, legacy 삭제·변환 0.
5. 첫 시작은 `initialVerifiedCourseProgressState`를 정확히 한 번 사용.
6. route open 성공 뒤 `routeOpened` 유지, 실패·invalid·same-tick 중복은 전이 0.
7. stay → 다음 route 성공 뒤 갱신된 `stepIndex`를 Home 왕복 후 유지.
8. header back·navigation blur·background/foreground는 active clear 0.
9. 명시 완료는 active clear 1회, 빠른 완료 연타도 안전하게 한 번만 제거.
10. 새 V1 코스를 명시 시작하면 이전 코스 대신 새 코스 한 건만 활성.
11. 손상된/mismatched identity·course params는 다른 활성 코스 state를 덮어쓰지 않고 안전하게 초기화 또는 오류 화면으로 닫힘.
12. active 상태 변화 전체에서 엔진·Kakao/Route Proxy·Supabase·AsyncStorage·completion repository 호출 0.
13. Home 카드 접근성 레이블, 기존 26px 간격, 일반 tap 햅틱 0 유지.

테스트는 문자열 존재만 확인하지 말고 공개 화면 container/action 또는 분리한 순수 projection/controller를 실행해 navigation target과 상태 전이를 검증한다.

## 8. 수정 허용 파일

UIUX 세션은 필요한 최소 범위에서만 다음을 수정한다.

- `src/ui/AppFlowContext.tsx`
- `src/ui/HomeScreen.tsx`
- `src/ui/CourseConfirmScreen.tsx`
- `src/ui/VerifiedCourseProgressScreen.tsx`
- `src/ui/nav.ts` — 기존 params 호환을 깨지 않는 최소 타입 보완만
- `src/ui/recommendation/verifiedCourseProgressModel.ts` — 화면 연결에 필요한 순수 helper만
- 관련 `test/ui/**`
- 이 작업 문서의 완료 인수인계 절

새 helper가 필요하면 `src/ui/` 아래에 두고, 범용 service/repository나 engine으로 확대하지 않는다. 위 목록 밖 제품 파일 변경이 필요하면 먼저 이 문서에 이유와 소유 충돌을 남기고 통합 세션에 반환한다.

## 9. 검증 명령과 합격 기준

최소 다음을 실행한다.

```bash
npx tsx --test test/ui/active-verified-course-resume.test.ts test/ui/verified-course-progress.test.ts test/ui/course-progress-contract.test.mjs test/ui/release-visual-polish.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

합격 기준은 다음과 같다.

- 새 실패 fixture와 위 13개 반례가 모두 통과한다.
- 기존 UI suite의 의도된 skip 외 실패 0.
- core test·typecheck·diff check 실패 0.
- 외부 API, Supabase, AsyncStorage, completion repository 호출 0.
- Simulator를 버튼 하나씩 탐색하지 않는다. 자동 fixture 통과 뒤 사용자에게는 아래 작은 smoke만 요청한다.

수동 smoke:

1. 비로그인 상태에서 V1 코스를 시작하고 첫 카카오 길찾기를 한 번 연다.
2. TimeFit으로 돌아와 앱 안에서 메인으로 이동한다.
3. 메인의 `진행 중인 코스` 카드를 눌렀을 때 이전 진행 단계와 CTA가 유지되는지 확인한다.
4. 코스를 명시 완료한 뒤 메인에서 활성 카드가 사라지는지 확인한다.

로그인 상태 재검증, 강제 종료, 실제 API 호출량 검증은 이 smoke에서 반복하지 않는다.

## 10. 완료 인수인계 형식

이 문서 끝에 다음 네 항목을 기록한다.

1. 변경 파일과 각 변경 목적
2. 유지한 legacy/추천/API/DB/로그인·개인정보 계약
3. 실패 fixture 선행 재현과 구현 후 정확한 테스트 수·결과
4. 남은 범위: 강제 종료/App Group/courseRunId/완료 repository/Live Activity는 `U-LIVE-ACTIVITY-01`, 사용자 수동 smoke 결과는 `QA-PROGRESS-RESUME-01`

완료 기준을 충족하지 못하면 `완료`라고 쓰지 말고 실패 fixture, 관찰값, 소유 역할을 그대로 반환한다. `-R`, `-R2` 작업명을 새로 만들지 않고 이 문서의 미충족 항목으로 보완한다.

## 11. 완료 인수인계 — 2026-09-05

### 1) 변경 파일과 각 변경 목적

- `src/ui/activeVerifiedCourseModel.ts`: 원본 `RecommendationSession`, 원본 `VerifiedCourseV1`, `VerifiedCourseProgressState`, 프로세스 메모리 전용 순번 identity를 가진 V1 활성 상태를 추가했다. identity 일치 갱신/제거, V1 우선 Home projection, 시작·완료 연타 lock을 순수 경계로 분리했다.
- `src/ui/AppFlowContext.tsx`: legacy `activeCourse`와 분리된 `activeVerifiedCourse` 한 건과 start/update/clear action을 추가했다. Progress/Confirm에는 legacy repository action이 보이지 않는 좁은 `useActiveVerifiedCourseFlow`만 제공한다.
- `src/ui/CourseConfirmScreen.tsx`: 유효한 `코스 시작하기`에서 V1 active를 먼저 한 번 등록한 뒤 같은 원본 snapshot과 UI identity로 `VerifiedCourseProgress`에 이동한다. 화면 재-focus 전 빠른 중복 시작은 차단한다.
- `src/ui/VerifiedCourseProgressScreen.tsx`: 로컬 progress 초기값을 제거하고 identity와 원본 params가 일치하는 AppFlow progress만 읽는다. 기존 순수 전이의 성공 결과만 갱신하고 route 실패·invalid·중복·mismatch는 유지하며, 명시 완료의 clear/navigation은 한 번만 실행한다.
- `src/ui/HomeScreen.tsx`: `activeVerifiedCourse → legacy activeCourse → placeholder` 우선순위를 적용했다. V1 카드는 카탈로그의 장소명과 이어가기 접근성 레이블을 표시하고 같은 active params로 `VerifiedCourseProgress`에 이동한다.
- `src/ui/nav.ts`: 기존 `session/course`를 유지하면서 직렬화 가능한 프로세스 UI `activeId`만 V1 progress params에 추가했다.
- `test/ui/active-verified-course-resume.test.ts`: 선행 실패 2건과 로그인/비로그인, V1/legacy 우선순위, 단계 보존, route 실패·중복, 완료 연타, 새 코스 교체, mismatch, 외부 호출 0, 접근성/간격/무햅틱, 실제 화면 wiring 반례를 실행 fixture로 고정했다.

변경 이력은 `화면 로컬 progress + Home legacy 전용 → Home에서 V1 소실·재진입 경로 없음 → AppFlow의 별도 V1 runtime 한 건과 identity 일치 전이 → 로그인/저장/추천 계약을 건드리지 않고 프로세스 생존 중 이어가기를 제공하기 위해 교체(현행)`이다.

### 2) 유지한 legacy/추천/API/DB/로그인·개인정보 계약

- legacy `activeCourse`, `Execution`, 저장 코스 repository와 legacy Home 이동을 삭제·변환하지 않았다. V1과 동시에 있으면 표시만 V1이 우선한다.
- 추천 snapshot의 장소/leg/stay/geometry/시간/여유, 추천 엔진과 1·2곳 정책·호출 예산을 수정하거나 재계산하지 않았다.
- active start/update/clear는 Kakao/Route Proxy/외부 API, Supabase, AsyncStorage, completion repository, Auth를 호출하지 않는다. 로그인 여부에 따른 V1 화면·상태 분기도 없다.
- active snapshot과 좌표를 console/analytics/error에 기록하지 않는다. identity는 `verified-runtime-N` 프로세스 순번이며 영속 `courseRunId`가 아니다.
- header back, navigation 이탈, background/foreground, 카카오맵 복귀는 clear action을 실행하지 않는다. 일반 Home tap 햅틱 0과 26px 그룹 간격을 유지했다.

### 3) 실패 fixture 선행 재현과 구현 후 테스트 결과

- 제품 코드 전 `npx tsx --test test/ui/active-verified-course-resume.test.ts`: 새 활성 모델 부재 `MODULE_NOT_FOUND`, **0/1 실패**로 V1 Home placeholder/2단계 초기화 계약의 미구현을 먼저 재현했다.
- 지정 집중 명령: **32/32 통과**. 이 중 U-PROGRESS-RESUME-01 신규 실행 fixture는 **14/14 통과**했다.
- 기존 root UI source contract: **14/14 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **278개 중 277 통과, 기존 의도 skip 1, 실패 0**.
- `npm test`: **117/117 통과**.
- `git diff --check`: 통과.
- 실제 API, Supabase, Simulator는 실행하지 않았다.

### 4) 다음 결정·위험·재현 조건

- 강제 종료·OS eviction·재부팅 뒤 복구, App Group, 안정적인 `courseRunId`, 완료 repository, Live Activity는 구현하지 않았으며 `U-LIVE-ACTIVITY-01` 범위다.
- `QA-PROGRESS-RESUME-01`에서 비로그인으로 `V1 시작 → 첫 카카오 길찾기 → TimeFit 복귀 → 메인 이동 → 활성 카드 → 같은 단계/CTA → 명시 완료 → 메인 카드 제거` 수동 smoke 한 번이 남았다.
- 이 구현은 같은 프로세스에서 React provider가 살아 있는 동안만 보존된다. 강제 종료 복구로 오해할 문구나 테스트를 추가하면 안 된다.
- 병렬 세션의 engine/DB/중앙 문서 및 기존 미커밋 변경은 되돌리거나 수정하지 않았다.
