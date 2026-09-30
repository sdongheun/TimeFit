# RELEASE-UPDATE-01 — 1.1.0(2) 공개 빌드 기준

## 2026-09-29 후속 — 실시간 공공데이터 전환 빌드

- **이전 방식:** `1.1.0(2)`는 정적 공공데이터 기반 업데이트 후보였으며, 당시 생성한 Archive는 개발 서명 상태로 App Store Connect 제출 완료 근거가 아니었다.
- **발생한 문제/관찰:** 공개 추천과 주변 둘러보기를 TourAPI·부산 공공데이터 실시간 조회로 전환했으므로, 기존 빌드와 구분되는 새 TestFlight 검증 대상이 필요하다.
- **교체한 방식:** 마케팅 버전은 `1.1.0`으로 유지하고 iOS build를 `3`으로 증가한다. 공개 경로는 실시간 원천만 성공 데이터로 사용하며, 번들 카탈로그 성공 폴백은 허용하지 않는다.
- **교체 이유:** App Store Connect 빌드 번호 중복을 피하고, 실시간 전환 산출물을 이전 Archive와 명확히 구분하기 위함이다.
- **상태:** 현행. `1.1.0(3)` Archive·감사·TestFlight 실기기 검증 완료 전에는 배포 완료로 기록하지 않는다.
- **빌드 재현성 보완:** Xcode 27에서 prebuild 후 메인 앱 target의 개발팀이 누락되어 Archive가 실패한 것을 확인했다. Live Activity 확장에만 있던 `DEVELOPMENT_TEAM`·자동 서명 설정을 메인 앱 target에도 같은 config plugin에서 적용하도록 교체했다. 일회성 Xcode 수동 설정은 현행 방식으로 사용하지 않는다.
- **Archive 결과:** `/private/tmp/timefit-public-1.1.0-3-20260929.xcarchive` 생성 성공. 앱과 Live Activity 확장은 모두 `1.1.0(3)`, iOS 17+, iPhone 전용이며 위치 권한 문구가 없다.
- **산출물 감사:** 서버 전용 비밀·개인키 검출 0건, 공개 Supabase·CAPTCHA endpoint 포함, `tourapi-live`·`busan-live`·실시간 실패 타입 포함, 폐기한 `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED` 미포함을 확인했다. 앱·확장 Privacy Manifest도 모두 존재한다.
- **검증:** `npm run test:typecheck` PASS, `npm run test:ui` 863건 중 862 PASS·의도적 1 SKIP, `npm test` 602/602 PASS, `git diff --check` PASS.
- **남은 게이트:** 현재 Archive는 Apple Development 서명이다. App Store Connect 업로드 시 Xcode Organizer의 `Distribute App` 단계에서 App Store 배포 서명으로 다시 서명해야 하며, 업로드·TestFlight 실기기 확인 전에는 출시 후보 수락으로 기록하지 않는다.

날짜: 2026-09-17
상태: 구현·자동 검증·개발 서명 Archive 감사 완료 / App Store 배포 재서명·실기기·업로드 전

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

### 2026-09-17 Archive 감사

- `pod install`: PASS. 생성 iOS workspace와 98개 dependency/97개 pod 설치를 확인했다.
- `node scripts/release-build.cjs archive /private/tmp/timefit-public-1.1.0-2-20260917.xcarchive`: `ARCHIVE SUCCEEDED`.
- `node scripts/audit-release-artifact.cjs <archive>`: 서버 전용 비밀값 0건, private key 0건, 필수 공개 endpoint 2종 포함, main app·Live Activity extension의 개인정보 매니페스트 포함을 확인했다.
- 번들에 포함된 공유 공급자 credential 2건은 공개 클라이언트 입력으로 분류된 `TOURAPI_KEY`, `TMAP_APP_KEY`다. 감사 스크립트의 실패 대상인 서버 전용 비밀값에는 해당하지 않으며 값 자체는 출력하지 않았다.
- main app: `com.dongheun.mobile`, `1.1.0(2)`, iOS 17, iPhone 전용, 위치 권한 description 0건, Live Activity 지원 확인.
- extension: `com.dongheun.mobile.liveactivity`, `1.1.0(2)`, iOS 17, 위치 권한 description 0건 확인.
- `xcrun codesign -d --entitlements -`: main/extension 모두 Team `642X5R37S7`, App Group `group.com.dongheun.mobile.timefit` 일치 확인.
- 이 Archive의 현재 서명은 `Apple Development`이고 `get-task-allow=true`다. 따라서 소스·네이티브 설정 검증용 기준점이며 App Store 업로드용 IPA로 간주하지 않는다. Organizer의 `Distribute App` 단계에서 App Store 배포 프로필로 재서명해야 한다.

## 4. 다음 결정·위험·재현 조건

- 개발 서명 Archive는 생성했지만 새 Distribution IPA를 만들거나 App Store Connect에 업로드하지 않았다. `1.1.0(2)` 제출 성공으로 기록하면 안 된다.
- 공개 Archive는 반드시 `node scripts/release-build.cjs archive <절대경로.xcarchive>` 경로로 생성한다. Xcode 직접 Release는 공개 환경 변수가 갖춰지지 않으면 의도적으로 실패한다.
- 내부 Release가 정말 필요한 경우에만 `TIMEFIT_BUILD_PROFILE=internal`을 명시한다. 이 프로필 산출물을 App Store 후보로 사용하지 않는다.
- Archive의 main app/Live Activity extension version·build·App Group 및 공개 번들은 감사했다. 다음 단계는 App Store 배포 재서명 후 업로드하고, 변경된 사진/UI 및 Live Activity를 TestFlight 실기기에서 확인하는 것이다.
- Expo SDK 57 major upgrade와 SDK 56 patch 정렬은 이번 업데이트에 섞지 않았다. 별도 유지보수 범위로 진행한다.
