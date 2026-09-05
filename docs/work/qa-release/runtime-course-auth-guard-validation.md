# QA-RUNTIME-GUARD-01 — 활성 코스 교체·익명 Auth 표시 회귀 게이트

> 상태: **완료 — 자동 게이트 및 제한 수동 확인 A·B 통과**  
> 담당: **QA·출시 세션**  
> 제품 코드 수정: **금지**  
> 후속: 통과 뒤 `U-COMPLETION-HISTORY-01`

## 1. 목적

`U-RUNTIME-GUARD-01`이 기존 진행 코스 이어가기를 깨지 않으면서 다음 두 문제를 실제 의미대로 해결했는지 검증한다.

1. 다른 코스 시작 전 사용자가 기존 진행을 유지·재개·교체 중 선택할 수 있다.
2. Route Proxy anonymous session은 내부 인증으로 재사용되지만 일반 로그인·계정 저장·개인화로 표시되지 않는다.

QA는 실패를 화면 문자열 변경으로 고치거나 제품 코드를 수정하지 않고 UIUX 소유 작업으로 반환한다.

## 2. 먼저 읽을 파일

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/테스트.md`, `docs/03_product/UIUX_테스트명세.md`
3. `docs/work/uiux/runtime-course-auth-guard.md`의 완료 인수인계
4. `docs/work/qa-release/progress-resume-validation.md`
5. 새/변경된 fixture와 허용 제품 파일 diff

과거 archive 전체와 실제 사용자/운영 데이터는 읽거나 사용하지 않는다.

## 3. 시작 게이트

- `U-RUNTIME-GUARD-01`에 인수인계 4항목과 실제 테스트 수가 있어야 한다.
- 변경 파일이 UIUX 허용 목록을 벗어나거나 추천/API/DB/완료 repository를 수정했다면 실행하지 말고 통합 세션에 반환한다.
- raw session과 account session을 같은 값으로 다시 합쳤거나, anonymous를 sign-out해 화면만 guest로 만든 구현은 즉시 실패다.

## 4. 자동 검증

고정 session·navigation·Alert·repository port를 사용해 다음을 확인한다.

1. `null`, anonymous, account, loading Auth 분류.
2. anonymous Profile은 로그인 UI, account Profile은 계정 UI, 빈 이메일 추정 분기 없음.
3. anonymous session에서도 기존 Route Proxy session 재사용, CAPTCHA·anonymous sign-in 추가 0회.
4. anonymous에서 계정 전용 saved-course read/write와 서버 개인화 호출 0회.
5. active 없음과 같은 snapshot 재진입에는 확인창 0회.
6. 다른 active에서 선택 전 무변경, `취소` 무변경, `기존 코스 이어가기` 기존 identity/progress 유지, `새 코스로 시작`만 교체.
7. 교체는 이전 코스를 완료/기록/후기로 만들지 않는다.
8. 빠른 중복 tap/action에도 Alert·active 생성·navigation이 계약 횟수를 넘지 않는다.
9. 기존 `QA-PROGRESS-RESUME-01`의 Home 카드, routeOpened/stepIndex, Kakao 복귀, 완료 제거 fixture가 그대로 통과한다.
10. 추천 엔진·provider·Supabase 원격·completion repository 호출 0회다.

최소 실행:

```bash
npx tsx --test test/ui/active-verified-course-resume.test.ts test/ui/runtime-course-auth-guard.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

## 5. 제한 수동 확인

QA 세션이 Simulator 버튼을 하나씩 탐색하지 않는다. 자동 게이트가 통과하면 사용자에게 아래 두 묶음만 요청하고 결과를 기록한다.

### A. 익명 세션 표시 1회

1. 일반 계정에서 로그아웃한다.
2. 비로그인 상태로 추천을 한 번 실행해 Route Proxy anonymous session이 필요한 흐름을 통과한다.
3. 내정보로 이동한다.
4. `로그인됨`, 빈 이메일, 로그아웃 버튼이 아니라 로그인/회원가입 UI가 보이는지 확인한다.

### B. 활성 코스 교체 1회

1. 코스 A를 시작하고 한 단계 이상 진행한다.
2. 메인에서 새 추천을 탐색해 코스 B의 `코스 시작하기`를 누른다.
3. 확인창에서 `취소` 후 A가 유지되는지 확인한다.
4. 다시 열어 `기존 코스 이어가기` 후 A의 직전 단계인지 확인한다.
5. 다시 B를 열어 `새 코스로 시작` 후 B만 활성이고 A 완료 기록이 생기지 않았는지 확인한다.

실제 Kakao provider 호출 수를 늘리기 위한 반복 시나리오는 금지한다. 기존 internal fixture/이미 생성한 결과를 사용할 수 있으면 우선 사용한다.

## 6. 실패 반환 기준

| 실패 | 반환 |
| --- | --- |
| 익명/일반 account 분류·Profile·saved course gate | `U-RUNTIME-GUARD-01` |
| active 교체 확인·중복 action·navigation | `U-RUNTIME-GUARD-01` |
| 기존 Home 이어가기/단계 복구 회귀 | `U-RUNTIME-GUARD-01` |
| Route Proxy session 재사용/재인증 회귀 | 통합 세션이 재현 후 외부 API 소유 여부 결정; QA가 API 코드를 수정하지 않음 |
| 문서 정책 충돌 | 통합·결정 세션 |

## 7. 완료 인수인계

이 문서 하단에 다음만 남긴다.

1. 변경 파일 — 원칙적으로 이 문서와 QA fixture만
2. 변경하지 않은 제품/추천/API/DB/완료 저장 경계
3. 명령별 통과 수, side-effect 횟수, 수동 A/B 결과
4. 실패가 있으면 재현 단계와 반환 작업 ID

## 8. 2026-09-05 실행 기록 — 자동 게이트 및 수동 A·B 통과

### 1. 변경 파일과 변경 목적

- 이 작업 문서만 수정해 시작 게이트 감사, 자동 검증 결과와 제한 수동 확인 상태를 기록했다.
- 제품 코드와 QA fixture는 수정하지 않았다. 공유 작업 트리의 다른 역할 변경도 되돌리거나 이번 QA 변경으로 포함하지 않았다.

### 2. 변경하지 않은 제품·추천/API/DB/완료 저장 경계

- raw anonymous session은 Route Proxy 재사용 경계에 그대로 남고, 화면의 account 의미만 guest와 분리되는 계약을 유지했다. anonymous를 sign-out하거나 이메일 유무로 계정 상태를 추정하지 않았다.
- 추천 엔진·후보·시간·one/two-stop, Kakao/Route Proxy adapter, Supabase/Auth 설정, saved-course repository, completion repository, App Group·Live Activity를 수정하지 않았다.
- 실제 Supabase·Kakao·CAPTCHA·Simulator·실기기·운영 데이터는 자동 검증에 사용하지 않았다. stage·commit·push도 수행하지 않았다.

### 3. 자동 명령 결과와 side effect 횟수

- `npx tsx --test test/ui/active-verified-course-resume.test.ts test/ui/runtime-course-auth-guard.test.ts` — **26/26 통과**.
- `npm run test:typecheck` — **통과**.
- `npm run test:ui` — **290개 중 289 통과, 기존 의도 skip 1, 실패 0**.
- `npm test` — **117/117 통과**.
- `git diff --check` — **통과**.
- 고정 fixture에서 기존 anonymous raw session 재사용 시 CAPTCHA 요청 **0회**, anonymous sign-in **0회**, anonymous saved-course read/write 및 서버 개인화 **0회**를 확인했다.
- 다른 active의 선택 전·취소·기존 코스 이어가기에서 새 active 생성 및 완료 저장 **0회**, 새 코스로 시작에서 active 생성·progress 초기화·navigation은 각각 **1회**, 기존 코스 완료 저장은 **0회**였다. 전체 분기에서 추천 엔진·provider·원격 Supabase·completion repository 호출은 **0회**였다.

### 4. 제한 수동 확인 결과

- A. 익명 내정보 표시: **통과**. 일반 계정 로그아웃 후 비로그인 추천으로 anonymous Route Proxy 흐름을 통과한 상태에서도 내정보는 로그인/회원가입 UI를 표시하고 일반 계정 상태로 오표시되지 않음을 사용자가 확인했다.
- B. 진행 중 코스 교체: **통과**. 진행 중 코스 A가 있는 상태에서 코스 B 시작 확인의 `취소`, `기존 코스 이어가기`, `새 코스로 시작` 행동이 각각 기존 A 유지, A 직전 단계 복귀, 완료 기록 없는 B 교체로 정상 동작함을 사용자가 확인했다.

QA-RUNTIME-GUARD-01은 **완료**다. 자동 게이트와 제한 수동 확인 A·B가 모두 통과했으며 `U-RUNTIME-GUARD-01`로 반환할 실패는 없다. 후속 작업은 문서에 지정된 `U-COMPLETION-HISTORY-01`이다.
