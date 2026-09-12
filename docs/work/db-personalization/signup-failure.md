# DB-SIGNUP-FAILURE-01 — 가입 CAPTCHA·안전 오류 계약

2026-09-09. **repository 구현·집중 검증 완료. API/Auth composition 및 UI CAPTCHA 연결은 다음 담당 범위.** [UIUX 인수인계](../uiux/signup-failure.md)를 기준으로 한다. 실제 사용자 가입 실패 원인을 CAPTCHA라고 확정하지 않으며 실제 가입/메일 발송/운영 데이터 변경0.

## 1. 변경 이력·소유 경계

이전: 가입 입력/dependency에 CAPTCHA 필드 없음, registry/Auth 오류는 일반 실패로 소실 → 실패 fixture에서 토큰 전달/누락 차단/오류 관찰14건 FAIL → transient token 전달과 allowlist 오류 projection 추가 → 원문 유출 없이 실패 단계 구별 및 누락 요청 차단 → **repository 현행, production end-to-end 연결 미완료**.

변경 파일:

- `src/services/accountRegistrationRepository.ts`: 공개 타입·sanitizer·token 검증/전달·registry/Auth 실패 정보.
- `test/signup-repository-failure.test.ts`: 신규 고정15건.
- `test/release-account-contract.test.ts`: 기존 정상 가입 fixture에 합성 CAPTCHA1개 추가. 기존 동의/버전/나이 metadata 제외 assertion 유지.
- 이 문서. `releaseIdentitySupabase.ts` composition과 UI 파일은 API/UI 소유자 연결을 위해 수정하지 않았다. schema/RPC/trigger/운영 registry는 변경하지 않았다.

## 2. 정확한 공개 타입·입력

모든 export는 `src/services/accountRegistrationRepository.ts`에서 제공한다.

| export | 계약 |
| --- | --- |
| `SignUpAccountInputV1` | 기존 requestId/email/password/requiredConsents + `captchaToken?: string`. optional은 기존 UI의 단계적 타입 연결을 허용하는 **입력 경계 표현**일 뿐 CAPTCHA 없이 가입 허용이 아님 |
| `AccountRegistrationDependencies` | `signUp({email,password,captchaToken,metadata})`에서 `captchaToken: string` **필수**. 반환은 기존 `Promise<{sessionReady:boolean}>`. 실패 시 아래 safe object를 throw 가능 |
| `SignupFailureStageV1` | `'registry' \| 'auth'`. stage는 catch 위치에서 repository가 지정, 외부 error.stage 신뢰0 |
| `SignupFailureCodeV1` | 아래 allowlist 문자열 union |
| `SignupFailureInfoV1` | `Readonly<{code:SignupFailureCodeV1;httpStatus:number\|null;stage:SignupFailureStageV1}>` |
| `sanitizeSignupFailure(error:unknown, stage)` | code allowlist·HTTP400~599 정수만 투영한 frozen 새 객체 반환. message/body/cause/stack/name/추가 필드 복사0. API가 미리 정제한 `httpStatus`와 SDK의 숫자 `status`를 수용 |

allowlist: `captcha_required`, `captcha_failed`, `weak_password`, `over_email_send_rate_limit`, `over_request_rate_limit`, `email_address_invalid`, `email_address_not_authorized`, `validation_failed`, `user_already_exists`, `email_exists`, `signup_disabled`, `email_provider_disabled`, `unexpected_failure`, `request_timeout`, `23505`, `23503`, `23514`, `42501`, `P0001`, `PGRST301`, `unrecognized`.

이는 앱이 허용하는 관찰 코드 목록이지 모든 코드가 실제 운영에서 발생했다는 목록이 아니다. 모르는 code/문자열 error는 `unrecognized`, 유효 HTTP가 없으면 null. HTTP500이나 `unexpected_failure`/`P0001`만으로 signup trigger 결함을 단정하지 않는다. code 속성 없는 Error의 message에서 원인을 추출하지 않는다.

입력 순서: 기존 requestId/email/password 검사 → 필수 동의 → 최신 registry 조회/문서 존재·exact version 검사 → CAPTCHA 비어 있거나 trim 불일치면 거절 → dependency signUp **최대1회**. CAPTCHA 없이 registry 조회는 가능하지만 Auth 요청은0. 토큰을 trim/재발급/캐시/자동 재사용하지 않는다. **토큰이 이번 challenge의 fresh token인지 서버 검증 전 로컬에서 증명할 수는 없다.** UI가 가입 시도별 발급·한 번 소비·실패/이탈 시 폐기해야 한다.

metadata는 기존 `signup_request_id`와 `required_consents.{terms,privacy}.{document_id,document_version,accepted:true}`만 조립한다. CAPTCHA는 dependency 최상위 입력에만 있으며 DB·동의 metadata·AsyncStorage·result·로그에 추가하지 않는다.

## 3. 반환 상태·API/UI 소비

`createAccountRegistrationRepository(deps).signUpAccount(input)`:

| 조건 | 반환 |
| --- | --- |
| 성공 | 기존 `{status:'account_session_ready'}` 또는 `{status:'email_confirmation_pending'}` |
| 입력/동의/버전/registry 누락 | 기존 rejected reason `invalid_input / consent_required / document_version_stale / signup_unavailable`, failure 없음. 로컬 검증 결과와 서버 오류를 구분 |
| 토큰 누락/빈 값/공백 포함 양끝 | `{status:'rejected',reason:'captcha_required',failure:{code:'captcha_required',httpStatus:null,stage:'auth'}}` |
| 제출 직전 registry 조회 throw | `{status:'retryable_failure',failure:{code,httpStatus,stage:'registry'}}` |
| Auth dependency throw | `{status:'rejected',reason:'signup_unavailable',failure:{code,httpStatus,stage:'auth'}}`. **reason만 보지 말고 failure 우선 소비**. 이전 reason은 호환 분기용이며 실제 오류 정보는 소실하지 않음 |

`readSignupConsentDocuments()`는 기존 ok/not_configured 유지. 조회 throw는 `{status:'unavailable',documents:[],failure:{code,httpStatus,stage:'registry'}}`.

### API 담당 연결

`releaseIdentitySupabase.ts`의 기존 두 오류 래핑은 아직 원문을 일반 Error로 합치므로 다음처럼 연결해야 production에서 관찰 가능하다.

```ts
// readDocuments의 RPC error:
if (error) throw sanitizeSignupFailure(error, 'registry');
// signUp dependency:
const { data, error } = await supabase.auth.signUp({
  email: input.email,
  password: input.password,
  options: { data: input.metadata, captchaToken: input.captchaToken },
});
if (error) throw sanitizeSignupFailure(error, 'auth');
return { sessionReady: Boolean(data.session) };
```

registry SDK error가 HTTP status를 error 자체에 제공하지 않고 별도 응답 필드로 제공한다면, 확인된 숫자 상태만 sanitizer 입력에 넣는다. 상태를 추정하지 않는다. raw 객체를 저장/로그하지 않는다. API는 실제 adapter fixture에서 options token·data 민감정보 제외·오류 code/status 보존을 검증한다. 이 예시는 인수인계이며 composition을 이번에 수정했다고 주장하지 않는다.

### UIUX 담당 연결

기존 sheet로 시도별 CAPTCHA → 나이/문서 동의 재확인 → `signUpAccount({...기존입력,captchaToken})`. 취소/만료/중복 callback/이탈·연타 및 명시 재시도에서 이전 토큰 폐기. repository 자동 재시도 없음.

AuthContext는 failure가 있으면 `{code:result.failure.code,status:result.failure.httpStatus}`를 기존 `safeSignupFailure`로 변환하고, `stage`는 비민감 관찰 상태로 별도 보존한다. 현재 모델은 `httpStatus`/중첩 failure를 자동 해석하지 않고 stage도 보존하지 않으므로 **결과 전체를 그대로 넘기면 안 됨**. failure 없는 로컬 rejected는 기존 reason 처리 유지. unknown/500을 동의 trigger 오류로 표시하지 않는다.

## 4. 검증·남은 작업

- 실패 선행: 신규15개 중1 PASS/14 FAIL. 토큰 undefined 전달, 누락 token Auth 실행, 오류 정보 소실을 재현했다.
- 구현 후 `node --import tsx --test test/signup-repository-failure.test.ts test/release-account-contract.test.ts`: **20/20 PASS**, skip0. 합성 token·metadata exact·결과 원문 제외·missing/blank·동의/UUID/stale·registry/Auth code/status·unknown 및 no-retry 검증.
- `npm run test:typecheck`: PASS.
- `npm test`: **465/465 PASS**, skip0. `/private/tmp/timefit-signup-db-core.log`.
- `npm run test:ui`: **777 PASS / 0 FAIL / 기존 skip1** (총778). 첫 시도는 sandbox tsx IPC EPERM으로 테스트 시작 전 실패, 같은 명령을 권한 허용 후 성공했다. `/private/tmp/timefit-signup-db-ui.log`. 신규 skip0.
- `git diff --check`: PASS.
- 실제 계정 생성/메일 발송/운영 DB·migration 변경/개인화 C/Simulator 실행0. 네이티브/UI 의존 변경0으로 이번 iOS 빌드 미실행. 최종 앱 연결 뒤 출시 빌드는 UIUX/QA 후속이다.

네 항목 인계: (1)1절 변경 파일 (2)requestId·필수 동의·최신 문서/서버 trigger·계정/기록 불변 (3)위 실패→성공 fixture/기본 게이트 (4)API composition과 UI sheet/안전 오류 소비 연결 필요. **이번 완료는 repository 계약이며 실제 가입 문제 해결 확인이나 production CAPTCHA 연결 완료가 아니다.**
