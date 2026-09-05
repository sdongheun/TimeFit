# U-RUNTIME-GUARD-01 — 활성 코스 교체 확인·일반 로그인/익명 Auth 분리

> 상태: **수락 — QA-RUNTIME-GUARD-01 자동·수동 게이트 통과**  
> 담당: **UIUX 세션 단독 writer**  
> 선행: `U-PROGRESS-RESUME-01`, `QA-PROGRESS-RESUME-01` 수락  
> 후속: `QA-RUNTIME-GUARD-01`, 통과 뒤 `U-COMPLETION-HISTORY-01`  
> 병렬: **UIUX 작업과 병렬 금지** — `AuthContext`, `AppFlowContext`, `CourseConfirmScreen`, `ProfileScreen`을 한 작업이 함께 소유한다.

## 1. 목적과 확인된 원인

이번 작업은 추천·경로·DB를 바꾸는 작업이 아니라, 실기기 QA 뒤 발견된 두 runtime 상태 오류를 같은 UI 상태 경계에서 해결한다.

1. 현재 `CourseConfirmScreen`은 `코스 시작하기`를 누르면 기존 `activeVerifiedCourse` 유무를 확인하지 않고 새 상태로 교체한다. 기존 문서와 fixture도 silent replace를 허용했으므로 단순 누락이 아니라 **기존 계약을 사용자 보호 확인으로 교체**하는 작업이다.
2. Route Proxy는 비로그인 추천을 위해 Supabase anonymous session을 만든다. 현재 `ProfileScreen`과 `AppFlowContext`는 `session !== null`만으로 일반 로그인을 판단해 anonymous session을 `로그인됨`으로 표시하고 계정 전용 저장 경계를 열 수 있다. 이는 Dashboard 설정 문제가 아니라 **클라이언트 Auth 의미 분류 오류**다.

## 2. 먼저 읽을 파일

아래만 읽고 archive 전체는 열지 않는다.

1. `AGENTS.md`
2. `docs/README.md`, `docs/작업조정_보드.md`
3. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`
4. `docs/work/uiux/active-verified-course-resume.md`
5. `docs/work/integration-decision/release-uiux-checklist.md` — 읽기 전용
6. `src/ui/AuthContext.tsx`, `ProfileScreen.tsx`, `AppFlowContext.tsx`, `CourseConfirmScreen.tsx`, `HomeScreen.tsx`, `activeVerifiedCourseModel.ts`, `TimeSetupScreen.tsx`
7. 관련 `test/ui/**`, Route Proxy anonymous-session client fixture

작업 시작 시 `rg "useAuth\\(|session|is_anonymous|startActiveVerifiedCourse" src test`로 모든 소비자를 다시 확인한다. 문서에 없는 새 소비자가 있으면 일반 계정용인지 Proxy용 raw session인지 먼저 분류하고 일부 화면만 문자열로 가리는 수정을 하지 않는다.

## 3. 확정 제품 규칙

### 3.1 활성 코스가 있을 때 새 코스 시작

- 새 추천 탐색, 시간 설정, 결과 확인, 코스 확인 화면 진입은 기존 활성 코스를 제거하거나 경고하지 않는다.
- **다른 코스의 최종 `코스 시작하기`를 누른 순간에만** 다음 확인을 표시한다.
  - 제목: `진행 중인 코스가 있어요`
  - 설명: `새 코스를 시작하면 기존 진행 상태가 종료됩니다.`
  - 행동 1: `취소` — 현재 코스 확인 화면 유지, 기존 active 불변
  - 행동 2: `기존 코스 이어가기` — 새 상태 생성 0회, 기존 `VerifiedCourseProgress`의 identity/session/course로 이동
  - 행동 3: `새 코스로 시작` — 파괴적 스타일, 기존 active를 완료로 기록하지 않고 새 active 한 건으로 교체한 뒤 이동
- 사용자 문구에 `기존 기록 삭제`를 사용하지 않는다. 진행 상태 종료와 완료 이력 삭제는 다른 사실이다.
- 현재 `CourseConfirm`이 같은 active의 원본 `session/course` snapshot을 다시 받은 경우에는 경고·초기화 없이 기존 진행으로 이동한다.
- 같은 course ID더라도 다른 추천 session/input snapshot이면 같은 진행으로 간주하지 않는다.
- 빠른 연타, Alert action 중복 전달, 화면 refocus는 active 생성·교체·navigation을 두 번 실행하지 않는다.

### 3.2 Auth 상태 분리

- Supabase의 raw `Session | null`은 Route Proxy가 anonymous JWT를 재사용할 수 있도록 유지한다.
- 사용자에게 보이는 계정 상태는 다음 세 가지로 중앙 분류한다.
  - `loading`: 초기 세션 확인 중
  - `guest`: session 없음 또는 `session.user.is_anonymous === true`
  - `account`: session이 있고 `is_anonymous !== true`인 일반 계정
- 이메일 존재 여부로 anonymous를 추정하지 않는다. Supabase가 제공하는 `is_anonymous`를 기준으로 한다.
- `AuthContext`는 raw session과 함께 최소 `authKind` 및 `accountSession` 또는 의미가 같은 공개 값을 제공한다.
- `TimeSetupScreen`과 Route Proxy adapter는 raw session을 계속 사용한다. anonymous를 UI상 guest로 바꿨다는 이유로 세션을 sign-out하거나 CAPTCHA를 다시 요청하지 않는다.
- `ProfileScreen`, 저장 코스 조회/저장, 서버 개인화·체류 동의는 `account`만 일반 로그인으로 인정한다.
- anonymous 상태의 내정보는 로그인/회원가입 UI를 보이며 `로그인됨`, 테스트 계정 연결, 빈 이메일, 로그아웃 버튼을 표시하지 않는다.
- 일반 계정 로그아웃 뒤 anonymous 추천을 수행해 새 anonymous session이 생겨도 내정보는 계속 guest다.
- 이 작업은 로그인 전환 자체, 이메일 인증, anonymous cleanup, Supabase 정책을 바꾸지 않는다.

## 4. 실패 우선 fixture

제품 코드 전에 다음 실패를 고정한다.

1. raw session이 null이면 `guest`, `is_anonymous: true`면 `guest`, 일반 계정이면 `account`, 초기 확인 중이면 `loading`이다.
2. anonymous session이 존재해도 Profile projection은 로그인 폼이며 이메일·로그아웃을 노출하지 않는다.
3. 일반 계정만 Profile account 카드와 저장 코스 repository 소비가 가능하다.
4. anonymous raw session은 TimeSetup/Route Proxy에 그대로 전달되어 anonymous sign-in·CAPTCHA 재요청이 0회다.
5. active 없음 → 새 코스 시작은 경고 0, active 생성·navigation 각 1회다.
6. 같은 active snapshot → 경고·초기화 0, 기존 identity와 progress로 navigation 1회다.
7. 다른 active → 확인 모델 한 번, 사용자 선택 전 active/navigation/완료 저장 0회다.
8. `취소` → 기존 active 불변, navigation 0회다.
9. `기존 코스 이어가기` → 기존 identity/progress navigation 1회, 새 active·완료 저장 0회다.
10. `새 코스로 시작` → 새 active 한 건, 기존 active 완료 기록 0, 새 progress 초기화 1회, navigation 1회다.
11. 빠른 tap과 Alert action 중복에서도 위 side effect가 한 번을 넘지 않는다.
12. active 교체와 Auth 분류 전체에서 추천 엔진·Kakao/Route Proxy provider·DB·completion repository 호출은 0회다.

문자열 `rg`만으로 통과시키지 말고 Auth/코스 시작 결정을 순수 projection/controller로 분리해 입력과 action 결과를 실행 검증한다. 화면 source 계약은 실제 Alert wiring과 accessibility label 확인에만 보조로 쓴다.

## 5. 구현 순서

1. `AuthContext`에 raw session과 사용자 계정 의미를 분리하는 순수 helper/type을 추가한다.
2. 모든 `useAuth` 소비자를 감사해 Proxy와 UI/account 소비자를 분리한다. `TimeSetupScreen`의 raw session 경계는 유지한다.
3. `ProfileScreen`과 `AppFlowContext`의 저장 코스 조회 gate를 일반 account 기준으로 교체한다. 저장 action 자체도 anonymous에서 성공처럼 보이지 않게 기존 typed 실패 계약을 유지한다.
4. `activeVerifiedCourseModel`에 `none/same/different` 시작 판정과 기존 진행 navigation projection을 추가하거나 동등한 순수 경계를 만든다.
5. `CourseConfirmScreen`의 최종 CTA에만 확인 UI를 연결한다. 일반 버튼 햅틱은 추가하지 않고 기존 `AnimatedPressable`/start lock을 유지한다.
6. 기존 `U-PROGRESS-RESUME-01`의 Home 이어가기, 단계/routeOpened, legacy 우선순위, 강제 종료 미지원 범위를 그대로 유지한다.

## 6. 수정 허용 파일

- `src/ui/AuthContext.tsx`
- `src/ui/ProfileScreen.tsx`
- `src/ui/AppFlowContext.tsx`
- `src/ui/CourseConfirmScreen.tsx`
- `src/ui/activeVerifiedCourseModel.ts`
- `src/ui/TimeSetupScreen.tsx` — raw/account session 소비 구분에 필요한 최소 변경만
- 관련 `test/ui/**`와 기존 anonymous client 계약 테스트의 fixture 보완
- 이 작업 문서의 완료 인수인계

새 순수 helper는 `src/ui/` 아래에 둔다. 위 목록 밖 파일이 필요하면 먼저 이 문서에 이유와 공개 계약 영향을 기록하고 통합 세션으로 반환한다.

## 7. 수정 금지 경계

- `src/engine/**`, 추천 후보·순위·1/2곳·호출량
- `src/data/**`, 장소 카탈로그·운영시간
- Route Proxy/Cloudflare/Edge Function·Supabase Auth 설정·secret·migration
- `courseCompletionRepository`, `ActivityRecordScreen`, 완료 기록 생성
- App Group·ActivityKit·notification·강제 종료 복구
- 중앙 기준 문서와 `docs/작업조정_보드.md`
- 사용자가 요청하지 않은 commit/push

## 8. 검증과 완료 조건

최소 실행:

```bash
npx tsx --test test/ui/active-verified-course-resume.test.ts test/ui/runtime-course-auth-guard.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

합격 조건은 두 문제를 문구로만 숨기지 않고, anonymous raw session 재사용과 account UI 차단, active 교체 3개 행동의 side effect 수가 fixture로 증명되는 것이다. 실제 Supabase·Kakao·CAPTCHA·Simulator는 호출하지 않는다.

## 9. 완료 인수인계

이 문서 하단에 반드시 남긴다.

1. 변경 파일과 변경 목적
2. 유지한 raw session·추천/API/DB/완료 기록 계약
3. 테스트별 통과 수와 anonymous 재인증/외부 호출 횟수 0 증거
4. QA가 확인할 정확한 guest/account 화면과 active 교체 세 행동

## 10. 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `src/ui/authStateModel.ts`: raw Supabase session을 `loading/guest/account`로 분류하고 account session만 반환하는 순수 경계와 `AccountSessionRequiredError`를 추가했다. 이메일 유무는 분류 근거로 사용하지 않는다.
- `src/ui/AuthContext.tsx`: 기존 raw `session`을 유지하면서 `authKind`, `accountSession`을 함께 공개한다.
- `src/ui/ProfileScreen.tsx`: `account`만 내정보 카드·이메일·로그아웃을 표시하고 null/anonymous는 동일한 로그인·회원가입 화면을 표시한다.
- `src/ui/AppFlowContext.tsx`: 저장 코스 조회와 저장·교체·삭제 action을 `accountSession`으로 제한한다. guest action은 repository를 호출하기 전에 typed `AccountSessionRequiredError`로 종료한다.
- `src/ui/activeVerifiedCourseModel.ts`: active `none/same/different` 판정과 Alert 선택/빠른 tap/중복 callback을 한 번으로 직렬화하는 순수 시작 controller를 추가했다.
- `src/ui/CourseConfirmScreen.tsx`: 최종 `코스 시작하기` CTA에만 `취소 / 기존 코스 이어가기 / 새 코스로 시작` Alert를 연결했다. 새 시작만 destructive이고 같은 원본 session/course snapshot은 Alert 없이 기존 identity와 progress로 이어간다.
- `test/ui/runtime-course-auth-guard.test.ts`: Auth 4상태, Profile/저장 gate, anonymous raw session 재사용, active 시작·동일·교체 3행동과 중복/refocus 방지의 실패 우선 fixture 12개를 추가했다.

### 2. 유지한 공개 계약·정책 경계

- `TimeSetupScreen`은 계속 `session: authSession` raw 값을 읽고 `Boolean(authSession)`으로 Route Proxy/CAPTCHA 결정을 한다. anonymous를 guest로 표시해도 sign-out하거나 CAPTCHA·anonymous sign-in을 다시 요청하지 않는다.
- 기존 active course의 identity·session·course·progress 원본 snapshot과 Home 이어가기, 단계/`routeOpened`, legacy 우선순위, 명시 완료 전 메모리 유지 계약을 바꾸지 않았다.
- 새 코스로 교체할 때 기존 코스를 완료로 저장하거나 삭제하지 않는다. `courseCompletionRepository`, Live Activity, 추천 엔진, Kakao/Route Proxy adapter, DB repository 구현·정책은 수정하지 않았다.
- 화면 문구·Alert 외 일반 버튼 햅틱을 추가하지 않았고 `AnimatedPressable` 경계를 유지했다. 중앙 문서와 작업조정 보드도 수정하지 않았으며 commit/push하지 않았다.

### 3. 테스트 결과와 0회 증거

- 실패 우선: 제품 helper 구현 전 `npx tsx --test test/ui/runtime-course-auth-guard.test.ts`가 `authStateModel` 부재로 `0 pass / 1 fail`인 것을 확인했다.
- `npx tsx --test test/ui/runtime-course-auth-guard.test.ts`: `12/12` 통과.
- `npx tsx --test test/ui/active-verified-course-resume.test.ts test/ui/runtime-course-auth-guard.test.ts`: `26/26` 통과.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: `290`개 중 `289 pass / 1 skip / 0 fail`.
- `npm test`: `117/117` 통과.
- `git diff --check`: 통과.
- 실행 fixture에서 기존 anonymous session 재사용 시 CAPTCHA 요청 `0`, anonymous sign-in `0`; 교체 확인 전/취소/기존 이어가기에서 새 active 및 progress 초기화 `0`; 모든 분기에서 완료 저장·추천 엔진·Kakao/Route Proxy provider·DB 호출 `0`을 검증했다. 실제 Supabase·Kakao·CAPTCHA·Simulator는 호출하지 않았다.

### 4. 다음 결정·위험·QA 재현 조건

- QA는 anonymous raw session이 이미 있는 상태에서 내정보가 `로그인` 제목과 로그인/회원가입 폼을 보이고 `로그인됨`, 테스트 계정 연결 문구, 이메일, 로그아웃을 보이지 않는지 확인한다. 일반 계정에서는 반대로 `내정보`와 계정 카드가 보여야 한다.
- 진행 중 코스 A에서 다른 snapshot B의 코스 확인 CTA를 누르면 지정 Alert가 한 번 보여야 한다. `취소`는 A와 현재 화면 유지, `기존 코스 이어가기`는 A의 기존 단계/routeOpened로 이동, `새 코스로 시작`은 완료 기록 없이 B의 0단계로 교체 후 이동해야 한다.
- 동일한 A 원본 snapshot의 CTA는 Alert 없이 A로 이어가야 하며, 같은 course id라도 session 또는 course 객체가 다르면 교체 Alert가 보여야 한다. 빠른 CTA 연타와 Alert action 중복은 navigation/생성을 한 번만 발생시켜야 한다.
- 자동 fixture만 완료한 상태다. 다음 게이트 `QA-RUNTIME-GUARD-01`에서 실제 UI Alert 순서와 guest/account 표시를 확인해야 하며, 작업 시작 전부터 존재한 다른 세션의 dirty 변경은 되돌리거나 포함 판단하지 않았다.
