# 비밀번호 로그인 CAPTCHA 연결 보완

## 실행 기준과 상태 — 2026-09-07

- 사용자 명령 및 [DB의 최신 B 이후 앱 로그인 진단](../db-personalization/personalization-finalization.md)을 기준으로 수행했다.
- 상태: **UI 연결 및 자동 검증 완료 / 변경 반영 앱의 사용자 실제 로그인 1회 미확인**. B 재작업이나 C 검증 완료를 의미하지 않는다.
- 이전 방식 → 비밀번호 로그인에서 CAPTCHA 없이 SDK 호출, 오류를 일반 Error/안내로 평탄화.
- 관찰 → DB 진단의 비밀번호 인증 요청이 HTTP 400 `captcha_failed`. `GET /user` 성공은 비밀번호 로그인 성공의 증거가 아니다.
- 교체 방식 → 기존 CAPTCHA 화면에서 새로 검증한 토큰을 해당 제출의 `signInWithPassword.options.captchaToken`에만 전달하고, 안전한 오류 분류를 표시.
- 이유 → 서버 Turnstile 계약을 유지하면서 누락된 UI 연결을 복구한다. 서버 비활성화·익명 토큰 재사용·자동 재시도는 해결책으로 사용하지 않는다.
- 상태: 이전 누락 호출 방식은 철회, 새 연결은 현행 구현이며 실기기 수락 대기.

## 동작 및 예외 계약

- 입력 검증 후 CAPTCHA를 열고 검증 성공 전에는 비밀번호 인증을 호출하지 않는다. 취소·실패·만료는 인증을 호출하지 않으며 사용자의 명시적 재시도만 새 확인을 시작한다.
- 동기 제출 잠금과 시도 세대로 같은 순간 중복 제출, 중복 토큰 callback, 이전 WebView의 늦은 응답, 화면 이탈 후 응답을 차단한다. 검증 이후의 늦은 닫기 callback도 진행 중 인증을 해제하지 않는다.
- 토큰은 SDK 호출 인자로만 전달한다. 상태·저장소·로그·진단에 보존하지 않는다. 익명 인증과 일반 계정 인증의 분류 및 계정 확인 후 원래 화면으로 한 번 복귀하는 계약을 유지한다.
- 허용된 서버 오류 코드는 그대로, HTTP 상태는 100~599 또는 네트워크 상태 0을 보존한다. 알 수 없는 코드는 `unrecognized`, 유효하지 않은 상태는 null로 정규화한다. 원문 message/cause/body는 복사하지 않는다.
- CAPTCHA, 입력 오류, 이메일 미인증, 네트워크, 서버, 요청 제한, 계정 이용 불가, 알 수 없는 오류를 정적 사용자 문구로 분리한다.
- 진단은 기존 `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS=true`에서만 표시한다. operation·시각·stage·허용 code·status·kind·토큰 제공 여부 boolean만 포함하며 비밀번호·토큰·계정 원문은 포함하지 않는다.
- 현행 challenge 메시지 계약은 Turnstile 만료와 widget 실패를 모두 `error`로 보낸다. UI는 실패/만료로 안내하고 자동 재시도하지 않는다. 정확한 widget 원인을 추정하지 않으며, 세부 구분이 필요하면 API 소유 계약의 별도 확장이 필요하다.

## 완료 인수인계

### 1. 변경 파일과 목적

- `src/ui/passwordLoginModel.ts`: 새 CAPTCHA 필수 SDK 호출 경계, 비밀 없는 오류 정규화와 사용자 안내.
- `src/ui/AuthContext.tsx`: UI가 소유한 비밀번호 로그인 호출에 새 토큰 전달. 공개 signIn 인자에 선택적 captchaToken 추가; 토큰 누락은 SDK 호출 전 실패로 닫는다.
- `src/ui/LoginScreen.tsx`: 기존 CAPTCHA 재사용, 제출/전환 잠금, 취소·이탈·중복 응답 보호, 안전한 오류 표시.
- `src/ui/CaptchaVerificationSheet.tsx`: 로그인 용도 문구, 시도 세대/종료 보호, 취소 callback 처리. 기존 추천용 기본 문구와 신뢰 origin 검증 유지.
- `test/ui/password-login-captcha.test.ts`, `test/ui/password-login-screen.test.ts`: 실패 선행 및 실제 화면/provider/공유 sheet handler 실행 fixture.
- `test/ui/profile-settings-screen.test.mjs`, `test/ui/owned-account-screen-flow.test.mjs`: 기존 화면 회귀의 CAPTCHA 의존 mock 및 새 확인 단계 반영.
- 이 문서: 원인·교체 이력·자동 검증·사용자 확인·남은 범위 인계.

### 2. 변경하지 않은 공개 계약·정책 경계

- 인증 SDK 호출부가 UI 소유 `AuthContext`에 있어 API 서비스 소유 파일 수정은 필요하지 않았다. API·DB repository·스키마·서버 CAPTCHA 설정·추천 엔진·Live Activity·개인화 B 로직은 수정하지 않았다.
- 기존 익명 인증 CAPTCHA, 일반 로그인 판정, 가입 동의/회원가입 repository 및 계정 복귀 계약을 유지했다. 익명 토큰을 재사용하지 않았다.
- 계정 생성/재생성·비밀번호 초기화·서버 설정 변경·C 테스트 쓰기·실제 인증 요청·Simulator 실행·앱 삭제·stage/commit/push를 하지 않았다. 다른 세션의 기존 변경은 유지했다.

### 3. 실행한 테스트와 결과

- 실패 선행: 새 모델/연결 구현 전 fixture 실행이 누락 구현으로 실패함을 확인한 뒤 구현했다.
- 신규 집중 테스트 10개 통과; 프로필 화면을 포함한 집중 회귀 17개 통과. 새 토큰 options 전달, 토큰 누락 0호출, 취소/만료/실패, 이전 시도 응답, 중복 제출, 계정 복귀, 안전한 오류 분기, 익명 세션과의 분리를 검증했다.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 575개 중 574 통과, 기존 skip 1, 실패 0. 로그: `/private/tmp/timefit-login-captcha-ui.log`.
- `npm test`: 274개 통과, 실패 0. 로그: `/private/tmp/timefit-login-captcha-core.log`.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-login-captcha-export`: 통과. 로그: `/private/tmp/timefit-login-captcha-export.log`. 이는 iOS JS 번들 검증이며 실기기 로그인 성공 증거가 아니다.
- 자동 검증은 fixture 기반이며 실제 API 호출·실기기/Simulator 조작은 수행하지 않았다.

### 4. 다음 결정·위험·사용자 확인

- 사용자에게 **변경이 반영된 앱에서 실제 비밀번호 로그인 1회**를 요청한다. 내정보의 로그인 화면에서 본인이 입력하고 안전 확인을 완료한 후 일반 계정 상태와 원래 화면 복귀를 확인한다. internal Release가 이전 JS를 내장했다면 새 번들을 반영한 빌드가 필요하다.
- 실패 시 안전한 오류 코드·상태·시각만 공유한다. 비밀번호·CAPTCHA 토큰·세션·계정 원문이나 요청 전체를 보내지 않는다. 필요할 때 담당 세션이 해당 시각의 비밀번호 인증 결과를 읽기 전용으로 대조한다. 실제 결과를 받기 전에는 로그인 성공/실기기 수락으로 기록하지 않는다.
- `OwnedDeletionPanel`의 계정 삭제 재인증도 `auth.signIn(email, password)` 소비자이지만 이번 로그인 화면 범위 밖이므로 수정하지 않았다. 현재는 누락 토큰을 로컬 `captcha_required`로 차단한다. 이 경로에는 별도 새 CAPTCHA 연결이 필요하며, 토큰 선택 인자 호환성만으로 삭제 재인증이 완료됐다고 보아서는 안 된다. 기존 서버도 토큰 없는 인증을 거부한 상태다.
- 회원가입 CAPTCHA 연결이나 widget 만료의 별도 wire enum은 이번 완료 범위가 아니다. 필요하면 각각 승인된 계약으로 후속 작업한다. B 완료 상태는 유지하고 C 검증/쓰기를 시작하지 않는다.
