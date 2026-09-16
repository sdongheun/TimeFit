# RELEASE-UPDATE-01 — 1.1.0(2) 공개 빌드 기준

날짜: 2026-09-16  
상태: 구현·자동 검증 완료 / 서명 Archive·실기기·App Store 업로드 전

## 변경 이력과 목적

App Store에 공개된 `1.0.0(1)` 이후 사진·UI 변경을 업데이트하려면 새 버전과 빌드 번호가 필요하다. 기존 공개 빌드 wrapper는 내부 진단 플래그를 강제로 끄고 있었지만, Xcode에서 Release Archive를 직접 실행하면 공개 환경 검사 자체가 생략될 수 있었다.

이전 방식 → 공개 wrapper 실행 때만 `assert-native` 수행 → 직접 Release Archive에서 로컬 내부 플래그가 번들될 수 있는 우회 가능성 → 명시적으로 `TIMEFIT_BUILD_PROFILE=internal`인 내부 Release만 예외로 두고 나머지 모든 Release에 공개 환경 검사를 강제 → 개발·QA·Live Activity 진단·C 검증 UI가 App Store 업데이트에 포함되는 실수를 빌드 단계에서 차단 → **현행**.

## 1. 변경 파일과 변경 목적

- `app.json`: 공개 업데이트 버전을 `1.1.0`, iOS build를 `2`로 증가했다.
- `package.json`, `package-lock.json`: 프로젝트 package version을 `1.1.0`으로 맞췄다. 기존 dependency 변경은 보존했다.
- `plugins/withTimeFitLiveActivity.cjs`: 모든 비-internal Release의 React Native bundle 단계에 공개 환경 검사를 강제하고, prebuild 재실행 시 기존 guard도 교체하도록 idempotent하게 만들었다. 앱과 Live Activity target은 계속 같은 `config.version`/`ios.buildNumber`를 사용한다.
- `test/ui/release-build-config.test.mjs`, `test/ui/release-icon.test.mjs`: `1.1.0(2)` 단일 원천과 Release guard 회귀를 고정했다.
- 생성된 `ios/`: prebuild로 main/extension 모두 `MARKETING_VERSION=1.1.0`, `CURRENT_PROJECT_VERSION=2`, 새 guard를 확인했다. 저장소 정책상 ignored 생성 산출물이며 커밋 변경 목록에는 포함되지 않는다.
- `docs/테스트.md`: 이번 업데이트 게이트와 남은 수동 검증을 기록했다.

## 2. 변경하지 않은 공개 계약·정책 경계

- 최대180분·최대2곳, 추천 순서·호출 예산·운영시간·체류 및 개인화 정책을 변경하지 않았다.
- 장소 카탈로그·사진 자격·DB schema/RLS·API 요청 및 cache 계약을 변경하지 않았다.
- Bundle ID `com.dongheun.mobile`, Live Activity extension ID, App Group, Team, scheme, iPhone 전용·iOS17 기준을 변경하지 않았다.
- 내부 Release 진단 기능을 삭제하지 않았다. 필요할 때만 빌드 담당자가 명시적으로 `TIMEFIT_BUILD_PROFILE=internal`을 설정해야 한다.
- `.env`와 `.env.local`의 사용자 개발 설정 및 비밀값은 수정·출력하지 않았다.

## 3. 실행한 테스트와 결과

- 실패 선행: 새 버전/빌드 계약과 모든 비-internal Release guard 테스트가 기존 `1.0.0(1)` 및 public-only 조건에서 각각 실패함을 확인했다.
- `node --test test/ui/release-build-config.test.mjs test/ui/release-native-privacy.test.mjs`: 10/10 PASS.
- `node --test test/ui/release-icon.test.mjs test/ui/release-build-config.test.mjs`: 7/7 PASS.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: 824개 중 823 PASS, 실패 0, 기존 skip 1.
- `npm test`: 76/76 PASS.
- `node scripts/release-build.cjs check`: 공개 입력 유효, 내부 플래그 off, route proxy on. 값은 출력하지 않음.
- `npx expo prebuild --platform ios --no-install`: PASS. 생성 Xcode project의 main/extension `1.1.0(2)`와 guard 일치 확인.
- `node scripts/release-build.cjs export`: 공개 환경 iOS Hermes export PASS, 산출물 `/private/tmp/timefit-public-export`.
- `git diff --check`: PASS.

## 4. 다음 결정·위험·재현 조건

- 아직 새 Distribution Archive/IPA를 만들거나 App Store Connect에 업로드하지 않았다. `1.1.0(2)` 제출 성공으로 기록하면 안 된다.
- 공개 Archive는 반드시 `node scripts/release-build.cjs archive <절대경로.xcarchive>` 경로로 생성한다. Xcode 직접 Release는 공개 환경 변수가 갖춰지지 않으면 의도적으로 실패한다.
- 내부 Release가 정말 필요한 경우에만 `TIMEFIT_BUILD_PROFILE=internal`을 명시한다. 이 프로필 산출물을 App Store 후보로 사용하지 않는다.
- 새 Archive에서 main app/Live Activity extension의 version·build·서명·App Group 일치와 내부 UI 비노출을 감사한 뒤, 변경된 사진/UI 및 Live Activity를 실기기에서 확인해야 한다.
- Expo SDK 57 major upgrade와 SDK 56 patch 정렬은 이번 업데이트에 섞지 않았다. 별도 유지보수 범위로 진행한다.
