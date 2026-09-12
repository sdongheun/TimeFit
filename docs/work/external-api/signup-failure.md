# API-SIGNUP-FAILURE-01 — 가입 CAPTCHA·안전 오류 연결

2026-09-09. **DB 선행 조건 확인 후 API composition 구현·자동 검증 완료. UI fresh CAPTCHA 연결·실제 가입 원인 확인은 후속.** 실제 가입/메일/운영 변경 없음.

선행: [DB-SIGNUP-FAILURE-01](../db-personalization/signup-failure.md), [U-SIGNUP-FAILURE-01](../uiux/signup-failure.md). DB 인계의 타입·구현을 직접 확인하고 repository/기존 동의 계약 테스트 **20/20 PASS**를 재확인한 뒤 진행했다. transient captchaToken 필수 dependency 전달, 누락 시 Auth0, allowlist code·HTTP400~599·registry/auth stage 반환에 누락/충돌을 발견하지 않았다. 입력 token optional은 단계적 UI 연결 표현이며 무토큰 가입 허용이 아니다.

## 1. 변경 파일

- `src/services/releaseIdentitySupabase.ts`: 가입 dependency의 `options.captchaToken` 연결. 기존 `options.data` 동의 metadata는 불변. Auth 반환 오류와 throw를 DB 소유 `sanitizeSignupFailure`로 정제한다. registry RPC는 실제 response의 숫자 `status`와 `error.code`만 투영하고, throw도 registry stage로 정제한다. 다른 account/delete/personalization 코드의 기존 변경은 보존했다.
- `test/signup-api-failure.test.mjs`: 실제 composition + 실제 repository를 합성 Supabase/native storage port로 실행하는 신규10건. 외부 네트워크·계정 생성 없음.
- 본 문서. DB repository·UI·보드·공개 문서·환경 설정·SDK 버전은 변경하지 않았다.

이력: DB 계약은 완성됐지만 API는 CAPTCHA를 버리고 오류를 일반 Error로 합침 → 신규10건 중7건 실패(전달·오류 보존) → Auth options 연결 및 두 단계 sanitizer 적용 → 신규10건 통과. 원문 노출 없이 사용자 관찰 가능한 원인을 전달하기 위한 현행 교체이며 실제 운영 실패 원인을 CAPTCHA로 확정한 것은 아니다.

## 2. 유지한 계약

- requestId·이메일/비밀번호 입력 검증·명시 필수 동의·제출 직전 registry와 exact version 검증 순서 불변. 무토큰/빈 token은 repository가 Auth 전에 차단한다.
- token은 이번 호출의 Auth options에만 전달한다. metadata·DB·AsyncStorage·결과·로그·receipt에 추가하지 않는다. 재발급·자동 재시도·캐시·기존 로그인/anonymous token 재사용 없음. API는 freshness를 로컬 증명하지 않으며 UI challenge 수명과 서버 검증이 담당한다.
- 반환은 DB 공개 계약 그대로다: 성공 session-ready/email-confirmation-pending, registry retryable_failure, Auth rejected/signup_unavailable + failure. failure는 allowlist code/유효 httpStatus 또는 null/신뢰된 stage만 포함한다. unknown은 unrecognized이며 raw message/body/cause/stack을 전달하지 않는다. 500/P0001/unexpected_failure를 trigger 원인으로 단정하지 않는다.
- 설치된 SDK 근거: `@supabase/postgrest-js/src/types/types.ts`의 response base에 status가 있고 PostgrestError와 별도다. `@supabase/auth-js/src/GoTrueClient.ts`의 email signUp은 options.data와 options.captchaToken을 별도 data/gotrue_meta_security 입력으로 처리한다. SDK 변경·운영 설정 조회는 하지 않았다.
- 기존 계정·개인화·탈퇴·비밀번호 로그인 CAPTCHA 계약 변경 없음.

## 3. 테스트 결과

- DB 선행 재검증: `node --import tsx --test test/signup-repository-failure.test.ts test/release-account-contract.test.ts` → **20/20 PASS**.
- 신규 API fixture 구현 전 **3 PASS / 7 FAIL** → 구현 후 **10/10 PASS**. 정확한 token/options/data, 두 성공 상태, 누락 token Auth0, captcha_failed400/weak_password422/메일제한429/서버500/P0001/unknown, registry403·Auth0, thrown unknown·no-retry를 검증했다. 합성 token/password/email은 결과에 없고 storage write0이다.
- 집중: `node --import tsx --test test/signup-api-failure.test.mjs test/signup-repository-failure.test.ts test/release-account-contract.test.ts test/delete-account-adapter.test.mjs` → **52/52 PASS**.
- `npm run test:typecheck`: exit0.
- `npm test`: **475/475 PASS**, skip0. `/private/tmp/timefit-signup-api-core.log`.
- `npm run test:ui`: **총778 / PASS777 / FAIL0 / 기존 skip1**. 기존 tsx IPC sandbox 제약에 따라 승인된 권한으로 실행. `/private/tmp/timefit-signup-api-ui.log`.
- `git diff --check`: PASS. 실제 가입·메일 발송·로그인·운영 DB/설정·배포·Simulator·commit/push0.

## 4. 다음 결정·위험 / UIUX 인계

- API와 DB 계약은 준비됐다. UI는 기존 CAPTCHA sheet를 가입 시도마다 새로 열고 token을 단 한 번 전달해야 한다. 취소/실패/만료/이탈/명시 재시도 시 이전 token 폐기, 연타/중복 callback 차단, CAPTCHA 후 나이/동의/문서 재검증을 유지한다.
- AuthContext는 중첩 failure를 우선 소비해 `{code: failure.code, status: failure.httpStatus}`를 UI safeSignupFailure로 전달하고 registry/auth stage도 안전하게 보존한다. result 전체를 기존 모델에 그대로 넘기거나 reason만 읽어 정보를 다시 잃지 않는다. failure 없는 로컬 rejected는 기존 reason 처리.
- UI 연결 전 end-to-end 가입 해결로 표시하지 않는다. 실제 해당 실패 원인은 아직 미확인이다. 연결 후 사용자 명시 확인1회 또는 비민감 code/status/stage 근거로만 확인하며 자동 가입·메일 재시도는 하지 않는다.
- 최종 API/UI 연결을 포함한 public Archive/export·새 hash/동일 JS 검증은 UIUX/QA 후속. 기존 IPA는 삭제하지 않으며 새 수정본으로 간주하지 않는다. 이번 작업은 빌드 번호 변경·업로드·가입 보안 설정 완화를 승인하지 않는다.
