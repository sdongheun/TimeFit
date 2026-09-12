# U-SIGNUP-FAILURE-01 — 원인 추적·UI 보완·DB/API 계약 인계

2026-09-09 최신: **DB/API 확정 계약 소비·가입 CAPTCHA 연결·자동 검증/public iOS export 완료. 실제 회원가입은 사용자 정상 확인 완료. 메일 인증·재로그인은 별도 확인 대기.** 아래 1~4절의 계약 대기는 당시 이력이며 해제됐다. 최종 Archive·IPA는 이번에 생성하지 않았다. 구현 인계는 5절, 사용자 확인은 6절.

## 1. 변경 파일·확인된 원인

확인한 현재 호출:

`LoginScreen.submit → AuthContext.signUp → accountRegistrationRepository.signUpAccount → releaseIdentitySupabase deps.signUp → supabase.auth.signUp`

- Login은 비밀번호 로그인에만 CAPTCHA sheet를 연결하며 가입 submit은 직접 signUp 호출한다.
- `SignUpAccountInputV1` 및 `AccountRegistrationDependencies.signUp`에는 captchaToken 필드가 없다.
- `releaseIdentitySupabase.ts`의 Supabase 가입 options에는 data(metadata)만 있으며 **options.captchaToken 전달이 없다**. 가입 CAPTCHA 누락은 코드로 확인된 사실이다.
- 그러나 실제 해당 가입의 Supabase code/status 응답은 제공되지 않았다. 이번 실기기 실패가 captcha_failed였다는 확정은 하지 않는다. 비밀번호 정책·메일 제한·가입 trigger 실패도 현재 응답으로 구분할 수 없다.
- 오류 손실: service는 모든 Auth error를 `Error('signup_unavailable')`로 바꾸고, repository catch는 `{status:'rejected',reason:'signup_unavailable'}`로 합친다. 기존 AuthContext는 또 하나의 일반 Error로 합쳤다. 현재 signup_unavailable만으로 CAPTCHA/DB 원인을 추론하면 안 된다.

이전 일반 오류 → 코드·상태 소실로 실패 원인 식별 불가 → **UI에서 받은 안전한 사유만 보존/분류**하고 상위 손실은 소유자에게 인계 → 실제 증거 없는 원인 단정과 역할 밖 수정을 방지 → UI 부분 현행, 서버 계약 보완 전 전체 해결 미완료.

변경:

- `src/ui/signupFailureModel.ts`: allowlist code·유효 HTTP status만 갖는 SignupFailure, CAPTCHA/비밀번호/메일 제한/입력/동의/네트워크/서버/원인 불명 메시지. raw message/body/cause/email/password/token 복사·로그0. `signup_unavailable`은 원인 불명의 가입 불가이며 DB 오류로 단정하지 않는다.
- `src/ui/AuthContext.tsx`: 현재 repository가 실제 반환하는 rejected reason/retryable_failure를 UI 안전 오류로 전달. 서비스 API 변경0.
- `src/ui/LoginScreen.tsx`: 안전한 분류 메시지 표시, 동의/버전 사유는 기존 문서 재조회·동의 초기화. 재시도는 사용자의 가입 버튼으로만 수행하며 자동 반복0. 비밀번호 로그인 CAPTCHA 흐름은 변경0.
- `test/ui/signup-failure.test.ts`, `test/ui/signup-failure-screen.test.mjs`: allowlist/원문 제거/unknown 보존 및 실제 화면의 비밀번호·메일 제한·동의/일반 실패 안내/재시도6건.
- 본 문서. DB/API/공급자 설정·공개 문안·버전·서명·기존 다른 세션 변경은 수정하지 않았다.

## 2. 유지 계약·DB/API 담당 최소 요청

기본 미동의·만14세 이상 자기확인·문서 열기 성공·registry 제출 직전 재검증·서버 exact 동의 검증 유지. CAPTCHA/동의 비활성화·관리자 계정 생성·사용자 계정 재생성/비밀번호 초기화 없음.

**DB/API에 필요한 공개 계약(제안이며 없는 export를 구현한 것으로 가정하지 않음):**

1. DB repository의 `SignUpAccountInputV1` 및 deps.signUp 입력에 **이번 가입 시도의 captchaToken** 전달 필드 추가. 토큰은 Auth options 전용이며 metadata/DB/AsyncStorage/request receipt/로그에 포함하지 않는다. 기존 requestId·동의 payload·문서 재검증/서버 trigger 불변.
2. API composition `releaseIdentitySupabase`에서 `supabase.auth.signUp({email,password,options:{data:metadata,captchaToken}})`로 연결. fresh token만 허용하며 익명/로그인 토큰 재사용0. 누락 시 Auth 요청 전 안전 거절 계약을 명시한다.
3. 오류를 원문 없이 **안전 code/status + 실패 stage(registry/auth)**로 반환하는 discriminated result를 수락·export한다. captcha_failed, weak_password, over_email_send_rate_limit, 입력 오류, 문서 stale/누락, registry 조회 실패를 분리한다. 서버 500/예상 밖 오류를 곧바로 동의 trigger 오류로 분류하지 않는다. DB trigger 원인은 안전한 서버 근거로 입증할 때만 구분한다.
4. 고정 fixture: metadata/동의 보존·token이 options에만 존재·missing token 요청0·CAPTCHA 실패/메일 제한/비밀번호 정책/registry/trigger 오류 code/status 보존·raw 원문 미출력. 실제 가입·메일을 테스트로 자동 실행하지 않는다.

**계약 수락 후 UI 후속:** 기존 CaptchaVerificationSheet/captchaVerificationModel을 재사용하여 가입 버튼마다 새 challenge를 열고 검증 token을 단 한 번 위 계약으로 전달한다. 취소/실패/만료/이탈/재시도는 이전 token 폐기, duplicate callback/연타 차단. CAPTCHA 후에도 나이/동의/최신 문서를 검사한다. 현재 token을 수집해도 서비스가 버리므로 sheet만 먼저 붙이는 가짜 연결은 하지 않았다.

이번 UI 모델의 CAPTCHA/비밀번호/메일 오류 분기는 **합성 fixture에서의 소비 준비**다. 상위 서비스가 해당 code를 아직 전달하지 않으므로 운영에서 모두 구분된다고 보고하지 않는다. 추가 토큰 필드를 cast하거나 service를 우회해 auth.signUp을 직접 호출하지 않았다.

## 3. 검증

- 실패 fixture를 제품 변경 전에 작성: 모델 export 부재로 실패(`/private/tmp/signup-failure-red.log`), 구현 뒤 순수/실제 화면 **6/6 PASS**(`/private/tmp/signup-focus.log`).
- typecheck PASS(`/private/tmp/signup-types.log`).
- 중간 UI773 PASS/1기존skip, 전체461 PASS. 실제 화면 fixture 추가 후 최종 전체 재실행 결과는 아래 마감 기록에 남긴다.
- **최종:** `npm run test:ui` 778건 중777 PASS/0fail/1기존skip(`/private/tmp/signup-ui-final.log`), `npm test` **465/465 PASS**(`/private/tmp/signup-all-final.log`). `git diff --check` PASS. 신규 skip 없음. 기존 로그인 CAPTCHA·가입 문서·연령 회귀 포함.
- 실제 Supabase 가입 응답 조회/가입/메일 발송·인증/로그인·운영 DB 쓰기·실기기/Simulator 실행0. 실제 오류는 확보하지 못했다는 점을 자동 fixture 통과와 구분한다.

## 4. 남은 확인·출시 빌드

- 다음 담당은 DB/API 소유 계약 보완이다. 해당 계약이 수락되면 같은 작업에서 UI CAPTCHA 연결과 callback/만료/재시도 회귀를 마감한다. 실제 실패 원인은 그 뒤 사용자의 **명시적 가입 확인1회**에서 안전한 code/status/stage로 확인하거나, 사용자가 제공한 비민감 오류 근거로 확정한다. 이메일·비밀번호·token·계정 응답 원문을 요청/기록하지 않는다.
- 사용자 실기기: 새 CAPTCHA 확인→문서/나이 동의→가입, 인증 메일 수신/인증→로그인은 후속 확인이며 이번 미실행. 메일 제한이면 자동 재시도하지 않고 기다린 뒤 명시 재시도한다.
- **출시 빌드 재생성 필요.** 앞선 signed 1.0.0(1) IPA에는 이번 UI 오류 보완이 없으며, 특히 현재 가입 CAPTCHA 문제 해결본이라고 사용할 수 없다. DB/API·UI 전체 연결을 마감한 뒤 public Archive/배포 export·새 hash/동일 JS 검증을 다시 수행해야 한다. 기존 IPA는 삭제하지 않고 이전 후보로 보존한다. 빌드 번호 변경·업로드는 이번 작업에서 하지 않았다.

## 5. 남은 연결 마감 — 2026-09-09

### 변경 파일·목적

- `src/ui/LoginScreen.tsx`: 가입 제출도 기존 CAPTCHA sheet를 먼저 연다. 성공 callback에서 시도 세대를 즉시 소비한 뒤 나이/동의 및 최신 registry를 재확인하고 `signUp({...input,captchaToken})`을 한 번 호출한다. 토큰은 callback/호출 지역 인자로만 사용하며 state/ref/저장소/로그에 넣지 않는다. 취소·blur·unmount의 세대 무효화, 중복 callback·늦은 close 차단, 사용자 명시 재시도의 새 challenge를 적용했다. 문서 변경은 동의를 초기화하고 가입0회. 이메일 확인 대기는 별도 안내/비밀번호 정리, account-ready는 실제 AuthContext account 전환에서만 원래 화면 복귀한다.
- `src/ui/CaptchaVerificationSheet.tsx`: 기존 검증/실패/만료/재시도 경계는 그대로 재사용하고 signup 목적 안내만 추가했다. 위젯 만료/error 뒤 늦은 token은 폐기하며 사용자가 다시 시도해야 새 WebView 시도가 열린다.
- `src/ui/signupFailureModel.ts`: repository의 중첩 `failure`를 호환 reason보다 먼저 소비한다. code·httpStatus·registry/auth stage만 안전하게 보존하고 CAPTCHA/비밀번호/메일 제한/입력/기존 계정/가입 비가용/서버 안내로 분리한다. 500/DB 코드만으로 trigger 결함을 단정하지 않는다. `AuthContext.tsx`의 기존 `safeSignupFailure(result)` 연결은 재수정 없이 실제 provider fixture로 검증했다.
- 신규 `test/ui/signup-captcha-flow.test.mjs`; 보완 `signup-failure-screen.test.mjs`, `signup-failure.test.ts`, `release-age-check.test.mjs`, `release-links-final.test.mjs`, `owned-account-screen-flow.test.mjs`(모두 `test/ui/`). 기존 가입 성공 fixture도 CAPTCHA 완료를 명시하도록 변경했다.
- 본 문서. 다른 세션의 변경·서비스 파일·보드·중앙 문서 수정0.

이전 가입 직접 호출/오류 정보 소실 → 실패 선행4건에서 CAPTCHA 이전 가입 호출 확인 → 수락된 DB/API 계약에 새 challenge 단일 소비와 nested safe failure 연결 → 보안 게이트 유지와 안전한 오류 안내 → **구현/자동 검증 현행, 운영 성공 미확인**. 당시 실제 실패 응답이 없으므로 기존 실기기 오류가 반드시 CAPTCHA였다고 확정하지 않는다.

### 유지한 계약

- [DB 확정 계약](../db-personalization/signup-failure.md), [API 구현 인계](../external-api/signup-failure.md) 전체와 실제 export/composition을 확인했다. API는 `options.captchaToken`만 사용하며 repository가 최신 문서·동의·입력을 다시 검증한다. UI가 SDK 직접 호출·없는 export·service 우회 없음.
- 만14세 자기확인·기본 미동의·문서 열기 성공·exact version 재검증·requestId/동의 metadata 유지. 토큰을 동의 metadata에 저장하거나 로그인/익명 인증 token을 재사용하지 않는다.
- 비밀번호 로그인·anonymous/account 구분·일반 코스/Live Activity·기록·개인화 계약 불변. CAPTCHA/동의 비활성화, 관리자 가입, 운영 계정 생성/초기화/삭제, 운영 메일 발송0.

### 테스트 결과

- 실패 선행: 기존 실제 가입 화면 fixture에 `CAPTCHA 전 가입0` assertion 추가 → **0 PASS / 4 FAIL** (`/private/tmp/signup-connect-red.log`). 수정 후 집중43/43 PASS (`/private/tmp/signup-connect-focus.log`). 이후 추가한 실제 AuthProvider 결합 포함 새 흐름 파일9/9 PASS (`/private/tmp/signup-connect-extra.log`).
- 새 흐름: email-pending/account-ready, 연타/중복 callback/늦은 close, 취소·blur·unmount, API CAPTCHA 실패/만료 후 새 인증, 문서 조회 중 이탈, 실제 sheet의 error/만료→명시 retry→새 token 1회 전달, 실제 AuthProvider의 nested failure 소비를 실행했다. 기존 문서 fixture에서 stale/조회 실패/열기 실패/문서 누락의 가입0, 기존 연령/로그인·익명 인증 회귀 유지.
- `npm run test:typecheck`: exit0 (`/private/tmp/signup-connect-typecheck.log`).
- `npm run test:ui`: 최종 **788건 / 787 PASS / 0 FAIL / 기존 skip1** (`/private/tmp/signup-connect-ui-final.log`). 추가 skip 없음.
- `npm test`: **483/483 PASS**, skip0 (`/private/tmp/signup-connect-all.log`). 공유 작업트리의 최신 DB/API 테스트 포함 결과이며 운영 호출 없음.
- `node scripts/release-build.cjs export`: exit0, public iOS Hermes bundle 생성 (`/private/tmp/signup-connect-export.log`). 경로 `/private/tmp/timefit-public-export/_expo/static/js/ios/index-fcf5d2e9e136d2d50a7aba6726e5ee4d.hbc`, SHA256 `1c9f228a1d0e19d2bc2cb7814bc8cc532f46e8fd74673554e54d268b3d420105`.
- `node scripts/audit-release-artifact.cjs /private/tmp/timefit-public-export`: exit0, 37파일, server-only secret 일치0/private key0, public Supabase/CAPTCHA endpoint 존재. 공개 환경과 공유 공급자 값 일치2는 서버 전용 비밀 유출과 구분한다. JS export에는 native identities/manifests가 없으므로 이번에 배포 서명·native manifest 검증까지 통과했다고 주장하지 않는다. `git diff --check` PASS.

### 남은 사용자 확인·출시 인계

1. **수정 코드가 반영된 로컬 앱**에서 회원가입으로 이동하고 본인의 정보를 직접 입력한다. 만14세 확인 → 두 문서를 열고 필수 동의 → 계정 만들기 → 새 안전 확인을 완료한다. 이메일·비밀번호·토큰을 진단/문서로 보내지 않는다.
2. 먼저 안전 확인을 한 번 닫아 가입이 진행되지 않는지 확인할 수 있다. 다시 계정 만들기를 눌러 새 확인 후 **실제 가입은1회** 수행한다. 서버 실패 시 표시 문구와 필요하면 비민감 code/status/stage만 공유하고 반복 메일 요청하지 않는다.
3. 이메일 확인 안내가 나오면 메일 인증을 직접 완료한 뒤 로그인 탭에서 새 CAPTCHA로 로그인한다. 메일 확인 대기와 로그인 완료가 혼동되지 않고 원래 화면/기존 코스가 유지되는지 확인한다. account-ready 응답이라면 메일 대기 안내 없이 계정 상태가 반영되는지 확인한다.
4. **실제 가입/메일 수신·인증/재로그인 성공은 아직 미확인.** 이번 public export는 설치용 IPA가 아니다. 기존 signed IPA에는 본 변경이 없으므로 그것으로 수정본을 검증하지 않는다. 사용자의 실제 가입·재로그인 확인 뒤 수정본의 public Archive/배포 IPA를 재생성하고 새 hash·서명을 검증해야 한다. 이번 최종 Archive·IPA 생성/업로드/Validate/버전 변경/commit·push0. 기존 산출물은 보존했다.

## 6. 사용자 회원가입 확인 — 2026-09-09

1. **변경 파일:** 본 문서만 갱신. 사용자의 “회원가입 확인했다” 보고를 실제 회원가입 정상 확인으로 기록한다. 위 5절의 가입 미확인은 당시 이력이며 이번 보고로 해제됐다.
2. **유지 계약:** 제품 코드·인증/동의·DB/API 계약 변경 없음. 계정 원문·비밀번호·토큰 수집 없음.
3. **검증 결과:** 실제 회원가입은 사용자 확인 완료. 자동 검증은 5절 결과를 재사용하며 문서 변경만으로 테스트를 재실행하지 않았다. 에이전트의 운영 가입·메일 발송·로그인 실행 없음.
4. **남은 확인:** 메일 수신·인증 및 재로그인까지 확인했다는 보고는 아직 없으므로 별도 확인 대기. 해당 확인 후 수정본 public Archive·배포 IPA 재생성/검증이 필요하다. 이번 기록 갱신에서 빌드 생성·업로드·commit/push는 하지 않았다.
