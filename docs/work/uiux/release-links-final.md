# U-RELEASE-DOCS-LINK-01 — 공개 문서 연결·출시 디버그 진입 확인

2026-09-09. 기준: DB `release-docs-link.md` §3·§5 및 출시 문서 세션의 `RELEASE-PUBLIC-DOCS-PUBLISH-01` 게시 완료 인계. **UI 연결·자동 검증·public iOS export 완료 / 사용자 실기기 링크 확인 대기**.

## 1. 변경 파일과 목적

- `src/ui/publicDocuments.ts`: 기존 `readSignupConsentDocuments()`를 호출하는 읽기 경계. 정확한 문서 ID 두 개·HTTPS·version 유효성을 확인하고, 재조회 결과를 ID/version/URL 값으로 비교한다. privacy/terms URL이나 version1.0을 fallback으로 고정하지 않는다. 지원 안내만 승인된 `https://jjaturi-docs.pages.dev/support/` 상수 사용.
- `src/ui/LoginScreen.tsx`: registry에서 받은 문서 열기에 성공한 뒤 해당 문서 동의를 활성화한다. 열기 시작/실패 시 그 문서의 기존 동의를 해제하고, 모드 전환·문서 변경 시 동의/열기 상태를 초기화한다. 제출 직전 같은 읽기 계약으로 문서를 재조회하고 변경·누락·실패 시 signUp 호출 전에 차단한다. 누락/조회 실패의 명시 `문서 다시 확인` 추가. 기존 행 스타일과 화면 구성 유지.
- `src/ui/ProfileScreen.tsx`: 앱 안내의 준비 중 행을 개인정보처리방침·이용약관·지원 안내 링크로 연결. 앞의 두 링크는 누를 때 registry 조회, 지원은 승인된 URL 사용. 열기/조회 실패는 안전한 오류와 같은 행 재시도, 연속 실행 잠금. 기존 card/infoRow 스타일 재사용, 레이아웃 재설계 없음.
- `test/ui/release-links-final.test.mjs`: 실제 로그인·내정보 handler에서 registry URL 사용, 기본 미동의, 열기 실패·문서 누락/조회 실패·stale·제출 직전 조회 예외·성공 및 내정보 실패 안내 검증.
- `test/ui/release-age-check.test.mjs`, `test/ui/owned-account-screen-flow.test.mjs`: 성공 가입 fixture에 문서 열기 성공 후 명시 동의 절차 추가. 연령·payload·중복 제출·모드 격리 기대는 유지.
- 본 문서. DB·공개 문안·공급자 설정·보드·중앙 문서·스토어 설정은 수정하지 않았다. 기존 다른 세션 변경 보존, commit/push 없음.

### 이전 → 관찰 → 교체 → 이유 → 상태

가입 URL 자체는 이미 registry를 사용했지만, 열기 실패는 Alert만 표시하고 checkbox는 활성 상태였다. 내정보에는 실제 링크 대신 준비 중 안내가 남아 있었다. 이를 registry 문서 열기 성공/명시 동의와 제출 직전 현재 문서 대조, 내정보 실제 링크로 교체했다. 문서 열기 실패 또는 과거 문서 동의로 가입하는 우회를 막고 게시된 안내를 앱에서 접근 가능하게 하기 위함이다. **현행 구현**.

DB registry privacy-policy/terms-of-service 버전1.0 운영 연결은 §5의 완료 근거를 사용한다. 본 작업에서 운영 registry를 다시 쓰거나 실제 가입해 입증하지 않았다. `Linking.openURL` 성공은 OS가 열기를 수락했다는 의미이지 문서를 끝까지 읽었거나 원격 HTML 로딩까지 완료했음을 증명하지 않는다. 명시 동의와 실제 기기 문서 확인을 별도로 유지한다.

## 2. 유지한 계약·출시 디버그 판정

- 기본 미동의·만14세 이상 자기확인과 화면 이탈/모드 전환 초기화 유지. 가입 payload에는 생년월일/나이/문서 URL을 새로 넣지 않음. `signUpAccount`의 가입 직전 exact version 재조회 및 서버 검증은 그대로 유지하며 UI 사전 대조가 이를 대체하지 않는다.
- not_configured/unavailable/stale/open failure에서 고정 privacy/terms URL로 우회하거나 가입 성공을 합성하지 않는다. 정상 비밀번호 로그인·CAPTCHA·사용자 오류 안내/재시도와 계정/개인화/탈퇴 계약 불변.
- public wrapper는 이미 `NODE_ENV=production`, `EXPO_NO_DOTENV=1`, `TIMEFIT_BUILD_PROFILE=public`, 내부4종 플래그=false를 강제한다. 이번에는 wrapper/앱 navigation/debug 제품 코드를 중복 수정하지 않았다.
- 기존 실행형 테스트 재검증: 실제 TimeSetup의 개발 시각·QA·A3·진단 진입0 및 실행0, 장소 미리보기는 App/nav 연결 없음·production 직접 렌더도 null, 일반 계정에서도 C 실행/복구 패널 비노출·runner/조회 실행0. 개발 도구 소스 보존은 공개 진입 허용이 아니다. 비활성 분기의 문자열이 bundle에 존재하는 것과 사용자 접근 가능성을 구분한다.
- Kakao/TMAP·추천·Live Activity 실제 사용자 진행·수동 위치/과거 좌표 차단과 기존 기록 변경 없음. 운영 가입·메일 발송·삭제·DB 쓰기·공급자 호출 없음.

## 3. 검증 결과

- 제품 수정 전 새 실패 fixture를 먼저 작성·실행: `/private/tmp/release-links-red.log`. 초기 7건 중2 pass/5 fail. 이 중 signup effect를 렌더하기 전 조회한 fixture와 Profile navigation mock 누락도 있었으므로 **5건 모두 제품 결함으로 집계하지 않는다**. 하네스 호출 순서/주입을 정정한 뒤 실제 열기 실패·stale·registry 부재에서 signUp0을 검증했다. 제품 원인 근거는 위 기존 checkbox/오류 handler 경계다.
- 초기 연결 집중(링크·연령·기존 계정 화면): **16/16 PASS**, `/private/tmp/release-links-focus.log`.
- 최종 링크·public 설정·실제 통합 입력/디버그 경계 집중: **58/58 PASS**, `/private/tmp/links-focus-final.log`.
- `npm run test:typecheck`: **PASS**, `/private/tmp/links-type.log`.
- `npm run test:ui`: **772건 중771 PASS/0 fail/1 기존 철회 skip**, `/private/tmp/links-ui.log`. 기존 tsx IPC 제한 때문에 승인된 sandbox 외 실행 사용.
- `npm test`: **461/461 PASS**, `/private/tmp/links-all.log`.
- `node scripts/release-build.cjs export`: **PASS**, `/private/tmp/links-public-export.log`. public 입력 필터와 내부 flags=false를 적용한 실제 iOS Hermes export. `.env` 출력/수정 없음.
- `node scripts/audit-release-artifact.cjs /private/tmp/timefit-public-export`: **PASS**, `/private/tmp/links-artifact-audit.log`. 서버 전용 비밀 매치0·개인키0, 공개 Supabase/CAPTCHA endpoint 포함 확인. 공개 클라이언트 허용값과 동일한 provider 자격 매치2는 audit의 분리 항목이며 서버 전용 비밀 매치로 바꾸어 기록하지 않는다. 값 원문은 출력하지 않음.
- `git diff --check`: **PASS**.
- Simulator/실기기·운영 가입/메일/탈퇴·새 Archive/업로드는 실행하지 않았다. DB의 운영 연결 및 문서 세션의 HTTPS200/hash 확인을 재사용했다. export에는 native target이 없어 서명/Extension manifest/실기기 설치 검증을 대신하지 않는다.

## 4. 실기기 링크 3개 확인·최종 빌드 인계

수정 JS가 포함된 **public 설정 빌드**에서 로그인하지 않아도 내정보 → 앱 안내로 진입한다.

1. **개인정보처리방침**: 문서가 열리고 `https://jjaturi-docs.pages.dev/privacy/`, 버전1.0·시행일2026-09-09가 보이는지 확인 후 앱 복귀.
2. **이용약관**: `https://jjaturi-docs.pages.dev/terms/`, 버전1.0·시행일2026-09-09 확인 후 복귀.
3. **지원 안내**: `https://jjaturi-docs.pages.dev/support/`의 지원 내용·문의 경로가 보이는지 확인. 메일을 실제 발송할 필요 없음.

추가 화면 확인: 회원가입 모드에서 나이/필수 동의가 기본 미선택인지, 문서 읽기 후에만 각 동의가 가능한지 확인한다. **실제 가입 제출은 이 체크에 필요하지 않다.** 홈/입력/내정보에서 테스트 시각·QA·장소 미리보기·Live Activity 테스트·C 패널이 보이지 않아야 한다. 일반 오류/재시도는 유지한다. 오프라인 링크 실패 시 앱 오류와 재시도 가능 여부는 확인하되 운영 registry를 비우거나 version을 바꾸어 재현하지 않는다.

최종 빌드 담당:

- export 위치: `/private/tmp/timefit-public-export`
- bundle: `_expo/static/js/ios/index-975297babb9189e0ea17f52d720f7392.hbc`
- SHA256: `d29feefb8d6a625655355d53eb9d9498ddb258fc28f6c936bdb7ae616755a8a2`
- 고정 `/private/tmp` 경로는 다음 export가 교체할 수 있으므로 인수 시 hash를 다시 확인한다. 본 산출물은 설치용 ipa/Archive가 아니다.
- Distribution Archive는 동일 public wrapper 환경으로 생성하고, 실제 포함 JS의 공개 링크·디버그 진입 차단·서명/LA Extension·privacy manifest를 최종 후보에서 재검증한다. 기존 internal JS를 재사용하거나 `SKIP_BUNDLING`으로 혼합하지 않는다. 업로드/제출은 이번 승인에 포함하지 않는다.
- 사용자 실기기 3개 링크 결과가 오면 본 문서에 별도 추가한다. 자동 통과를 실기기 완료나 최종 스토어 수락으로 승격하지 않는다.
