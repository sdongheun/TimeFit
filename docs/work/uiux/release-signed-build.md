# U-RELEASE-SIGNED-BUILD-01

**최신 상태: 2026-09-10 가입 CAPTCHA 수정본 public Archive 및 App Store 배포 서명 IPA 재생성·로컬 검증 완료. 09-09 후보는 수정 전 이력으로 보존. 업로드는 통합 담당 인계, 이번 빌드 담당의 업로드/심사 미실행. 마지막 완료 절을 적용한다.**

## 2026-09-09 사전 확인 — 사용자 확인·서명 권한 대기

### 1. 변경 파일

본 문서만 추가. 최신 공유 dirty 변경을 보존했으며 제품/버전/빌드 번호/서명 설정/Pods 변경 없음. 최신 공개 링크 인계와 QA ODsay 제거 인계를 확인했다. 과거 GPS·ODsay·internal 빌드 기록은 재실행 기준으로 사용하지 않았다.

### 2. 실행 명령·확인 결과

- `node scripts/release-build.cjs check`: PASS (`public_build_input_valid; internal_flags=off; route_proxy=on; values=redacted`).
- 프로젝트 main/extension: version **1.0.0**, build **1**, Team **642X5R37S7**, 기존 자동 서명. 번호 변경0.
- `security find-identity -v -p codesigning`의 종류별 개수만 확인: 승인된 sandbox 외 조회 **Apple Development1 / Apple Distribution0**. 최초 sandbox 결과0은 실제 자격 부재로 해석하지 않았다. 개인키/인증서 원문 내보내기0.
- `cmp -s ios/Podfile.lock ios/Pods/Manifest.lock`: 일치. 이번 prebuild 전 상태이며 이후 필요한 경우만 Pods 동기화한다.
- `ios/Podfile.lock`, main Info.plist에서 ExpoLocation/NSLocation 미검출. `src`에서 ODsay URL/키 이름 미검출. 이는 아직 새 Archive/IPA 검사 결과가 아니다.
- Login/Profile의 registry 문서 읽기 및 지원 URL 연결 소스 확인. 직전 LINKS 작업의 typecheck/UI771 PASS+기존1skip/core461 PASS/public export 근거 재사용. 이번 제품 코드 변경0이므로 전체 테스트 반복0.

### 3. 서명·산출물 상태와 유지 계약

Connect 기존 build 목록과 Xcode 온라인 계정 유효성을 아직 확인하지 못했다. 로컬 Distribution identity0만으로 cloud signing 가능 여부까지 단정하지 않는다. 신규 인증서/프로필 생성·갱신 승인은 아직 받지 않았다.

**prebuild·새 Archive·배포 IPA export는 미실행**. 따라서 새 산출물 경로/hash, Archive/IPA 동일 JS, 실제 배포 서명/entitlement 검증 결과는 아직 없다. 기존 development Archive를 배포 완료로 재사용하지 않는다.

Bundle ID/App Group·기존 인증서/개인키·GPS 미사용·ODsay 신규 요청 제거·public guard 유지. 운영 DB/가입/메일/탈퇴·업로드·온라인 Validate·심사 제출·출시·commit/push0.

### 4. 필요한 사용자 확인과 다음 실행

1. App Store Connect에서 **1.0.0(1)이 기존 업로드와 중복되지 않는지** 사용자 확인. 중복이면 사용할 번호를 사용자가 지정한다. 임의 증가하지 않는다.
2. Xcode Settings → Accounts에서 Team642X5R37S7 로그인 유효성 확인. 로그인/MFA가 필요하면 사용자가 직접 수행한다.
3. 배포 자격이 필요한 경우 승인 대상은 **Team642X5R37S7의 Apple Distribution 서명 자격과 main `com.dongheun.mobile` / extension `com.dongheun.mobile.liveactivity`의 App Store 배포 프로필 생성·갱신**으로 한정한다. 기존 자격이 있으면 재사용하며, 기존 인증서 취소·개인키 export·Bundle/App Group 변경·Upload/Validate는 제외한다. 해당 승인을 받기 전 `-allowProvisioningUpdates`를 추가하지 않는다.

확인 후 wrapper check→prebuild→새 절대경로 archive, Archive audit→승인 범위의 local App Store Connect export(Internal Only 아님)→실제 IPA 추출·서명/Team/App Group/버전/기기/아이콘/manifest/암호화/GPS·ODsay/secret/JS hash 비교를 진행한다. 실패 시 검사를 완화하지 않고 해당 최소 조치만 요청한다.

## 2026-09-09 승인 후 실행 완료

### 1. 승인·변경 파일·실행 명령

사용자가 Connect에 1.0.0(1) 업로드 이력 없음, Xcode Team 로그인 정상임을 확인했다. Team642X5R37S7 및 두 기존 App ID의 배포 서명 자격/프로필 생성·갱신을 필요한 경우 승인했고 기존 자격 우선 재사용을 지시했다. 번호 증가·인증서 취소·개인키 내보내기·Bundle/AppGroup 변경·업로드 제외를 유지했다.

- 제품 코드/의존성/버전·빌드 번호/공개 문안 변경0. public 비clean prebuild만 실행했다. package.json은 no changes, Podfile.lock과 Pods/Manifest.lock 일치이므로 pod install/update는 불필요했다. 기존 dirty 변경 보존.
- 본 문서와 임시 export 옵션/읽기 전용 검증기만 작성: `/private/tmp/timefit-signed-20260909-export-options.plist`, `/private/tmp/timefit-signed-verify.cjs`.
- export 옵션: method=`app-store-connect`, destination=`export`, signingStyle=`automatic`, teamID=`642X5R37S7`, manageAppVersionAndBuildNumber=false, testFlightInternalTestingOnly=false.

```sh
node scripts/release-build.cjs check
node scripts/release-build.cjs prebuild
node scripts/release-build.cjs archive /private/tmp/timefit-signed-20260909-final01.xcarchive
node scripts/audit-release-artifact.cjs /private/tmp/timefit-signed-20260909-final01.xcarchive
node /private/tmp/timefit-signed-verify.cjs /private/tmp/timefit-signed-20260909-final01.xcarchive/Products/Applications/mobile.app
```

배포 export는 Node에서 기존 wrapper `publicEnvironment(loadInputs())`/`assertPublicNativeEnvironment(env)`를 적용한 자식 환경으로 다음 명령을 실행했다. 사용자 승인 이후에만 provisioning updates를 사용했다.

```sh
xcodebuild -exportArchive -archivePath /private/tmp/timefit-signed-20260909-final01.xcarchive -exportPath /private/tmp/timefit-signed-20260909-export01 -exportOptionsPlist /private/tmp/timefit-signed-20260909-export-options.plist -allowProvisioningUpdates
ditto -x -k /private/tmp/timefit-signed-20260909-export01/mobile.ipa /private/tmp/timefit-signed-20260909-ipa01
node /private/tmp/timefit-signed-verify.cjs /private/tmp/timefit-signed-20260909-ipa01/Payload/mobile.app distribution
node scripts/audit-release-artifact.cjs /private/tmp/timefit-signed-20260909-ipa01/Payload/mobile.app
```

Archive/export/추출은 기존에 없는 새 경로를 사용했다. 기존 Archive 삭제/덮어쓰기0. 일반 Xcode Archive, SKIP_BUNDLING, Upload/Validate 사용0.

### 2. 실제 산출물·hash·서명

| 항목 | 결과 |
| --- | --- |
| 버전/빌드 | main/extension **1.0.0(1)** 동일, 자동 번호 변경 없음 |
| Archive | `/private/tmp/timefit-signed-20260909-final01.xcarchive` |
| IPA | `/private/tmp/timefit-signed-20260909-export01/mobile.ipa` |
| IPA SHA256 | `21ff6139190cecbb4457c663c307a9cdea5baa772ad5a7bfc0985282c7dccc33` |
| Archive 내용 manifest SHA256 | `3b33afa5d73fcdb742f297f568231a8112fa46e0a752adb87d9afec31a9c9e7b` |
| Archive 및 IPA 실제 main.jsbundle SHA256 | **양쪽 동일** `3e1c3fcbb314b4cbfbc69409163ab5bb508c9ffae3da35f6a9c1cb997cb4c251` |
| Archive 서명 | 기존 개발 프로필, get-task-allow=true. 이것만으로 배포 완료 판정하지 않음 |
| IPA 서명 | 양쪽 **Apple Distribution: dongheun shin (642X5R37S7)** → Apple WWDR → Apple Root CA |
| IPA 프로필 | 양쪽 App Store 유형: ProvisionedDevices/ProvisionsAllDevices 없음, get-task-allow=false, 만료 `2027-09-09T14:06:46Z` |
| 공통 식별 | main `com.dongheun.mobile`, extension `com.dongheun.mobile.liveactivity`; Team642X5R37S7 / group.com.dongheun.mobile.timefit |

Archive는 디렉터리라 단일 파일 hash가 아니다. 위 manifest hash는 일반 파일 경로를 정렬하여 각 `상대경로 + NUL + 파일 SHA256`을 newline으로 연결한 내용의 SHA256이다. xattr/디렉터리 메타데이터/심볼릭 링크는 포함하지 않는다. IPA는 파일 자체 SHA256이다.

export 후 로컬 keychain 종류별 개수는 여전히 Development1/Distribution0이다. **IPA 실제 Distribution 서명이 검증됐다는 사실과 로컬 identity 개수는 구분한다.** 자동 서명이 기존 원격/cloud 자격을 사용했는지 새 인증서를 생성했는지 export 성공/개수만으로 단정하지 않는다. 개인키 export/기존 인증서 취소 명령은 실행하지 않았다. 신규 원격 자격 생성 여부 전수 조회도 하지 않았다.

### 3. 검증 결과·한계

- check/prebuild PASS, **ARCHIVE SUCCEEDED**, bundle 직전 `public_native_environment_verified` 확인. **EXPORT SUCCEEDED**. 로그: `/private/tmp/signed-build-prebuild.log`, `signed-build-archive.log`, `signed-export.log`.
- Archive/IPA 각각 앱·확장 존재, 타깃별 strict와 앱 deep/strict codesign 검증 PASS. 실제 entitlement의 Team/application-identifier/AppGroup, 프로필 Team/AppGroup 및 유효기간 확인. 결과 `/private/tmp/signed-archive-verify.json`, `signed-ipa-verify.json`.
- 양쪽 앱/확장 짜투리, iPhone family[1], MinimumOSVersion17.0, main NSSupportsLiveActivities=true, widgetkit extension, main ITSAppUsesNonExemptEncryption=false 확인.
- main/extension 각 PrivacyInfo.xcprivacy 포함, 전체11개 manifest. Extension은 FileTimestamp C617.1, main은 FileTimestamp C617.1/UserDefaults CA92.1/SystemBootTime35F9.1. manifest 존재·값 검사이지 모든 SDK 실제 행동이나 법적 신고 전체의 수락은 아니다.
- 승인 아이콘 원본 `assets/jjaturi-icon-blue.png` SHA256 `edab386a6107dc37d9ddca6eed5cbba919ba9bcede6591016e94d1d7215a4593`, 생성 AppIcon1024 SHA256 `4afe82d0ee52e4c45784fb0aab7803bb9fc7a08e72a3d92d03da8bd79679b4a0`가 승인 인계와 일치. 실제 Info.plist AppIcon 참조·Assets.car 존재와 Archive→IPA Assets.car 바이트 동일 확인. **설치 후 홈 아이콘 시각 재확인은 미실행**이며 컴파일 asset의 모든 rendition 픽셀을 추출 비교하지 않았다.
- 양쪽 main/extension NSLocation 권한키 없음. Pods/Manifest에 ExpoLocation 없음, IPA Frameworks/실행파일/JS에서 ExpoLocation 미검출. background GPS 재도입0.
- 실제 Archive와 IPA JS에서 api.odsay.com, EXPO_PUBLIC_ODSAY_API_KEY, ODSAY_API_KEY, ODSAY_USAGE, markOdsay, odsayTransit 미검출. 전체 문자열 ODsay를 무조건 금지하지 않음: 과거 snapshot/disabled 호환은 QA 인계대로 보존. 이 정적 검색만으로 모든 네트워크 행동을 새로 동적 증명하지 않으며 QA의 HTTP/key-read/new-write0 fixture와 결합한다.
- IPA JS에서 registry RPC명·privacy/terms ID·승인 support URL 포함. 고정 privacy/terms URL fallback으로 registry를 우회하지 않는 실제 handler 검증은 LINKS의 자동 테스트를 재사용. **실기기 링크 열기 미확인**.
- public wrapper/native guard + Archive/IPA JS 바이트 동일 + 기존 public 실행형 fixture로 디버그 진입 차단 근거 연결. 비활성 개발 코드 문자열을 접근 가능한 UI로 오인하지 않으며, 이번 IPA를 기기에서 실행하여 모든 화면을 순회한 것은 아니다.
- 실제 두 artifact의 audit PASS: 알려진 로컬 서버 전용 비밀 매치0, 개인키 패턴0, 기존 허용 public provider alias2 별도 분류, 공개 Supabase/CAPTCHA 입력 포함. 결과 `/private/tmp/signed-archive-audit.json`, `signed-ipa-audit.json`. 알려지지 않은 모든 비밀에 대한 전수 보안 증명은 아니다.
- 검증기 최초 sandbox codesign 실패는 승인된 외부 읽기 검증으로 해결. 그 다음 profile의 Date/Data를 JSON 변환하지 못한 plutil 파싱 실패는 기존 @expo/plist 파서로 교체 후 PASS. 검사 기준 완화0. 제품 결함으로 분류하지 않음.
- 제품 코드 변경0: 직전 typecheck PASS/UI771 PASS+1skip/core461 PASS를 재사용, 전체 회귀 재실행하지 않음. `git diff --check` PASS.

### 4. 남은 사용자 조작·최종 담당

**로컬 배포 서명 산출물까지 완료**, 업로드/온라인 Validate/심사 제출/공개 출시 완료가 아니다. App Store IPA를 일반 개발 기기에 직접 설치 가능한 파일로 안내하지 않는다.

- 사용자/QA: 별도 설치 가능한 동일 코드 public 후보에서 공개 문서3개·디버그 비노출·수동 위치/지도·Kakao/Live Activity 제한 smoke를 확인. 이전 링크 자동 PASS를 실기기 완료로 복사하지 않는다.
- 최종 빌드/출시 담당: 위 IPA/hash와 ExportOptions·DistributionSummary를 보존하고 이후 별도 승인된 전달/업로드 경로를 사용한다. 현재 파일을 다시 export/번호 변경하면 새로운 hash·서명 검증이 필요하다. 임시 디렉터리이므로 정리 전에 보존 위치를 결정한다.
- Connect 업로드 이력 없음/Xcode 로그인 정상은 사용자 확인 근거다. 이번 Apple 접근은 승인된 배포 서명 export뿐이며 Connect 업로드·온라인 Validate·심사·운영 DB/가입/메일/탈퇴·commit/push는 실행하지 않았다.

## 2026-09-10 가입 수정본 재생성 완료

### 1. 변경·교체 이유

이전 09-09 Archive/IPA → 이후 가입 CAPTCHA·안전 오류 계약 수정이 반영되지 않음 → 사용자 가입·로그아웃 후 재로그인 성공 보고 후 최신 공유 소스로 새 public Archive/IPA 생성 → 심사 후보에 실제 수정 반영 → **로컬 검증 완료, 업로드 통합 담당 인계**.

제품 코드·버전·빌드 번호 변경0. 기존 dirty 변경과 기존 산출물 보존. 비clean public prebuild 결과 package.json no changes, Pods lock 일치. 본 문서와 임시 export 실행기 `/private/tmp/timefit-signup-export-20260910.cjs`만 작성. 기존 public wrapper와 검증기 및 export options(method app-store-connect, destination export, internalOnly false, 자동 번호 변경 false) 재사용. Team/AppID/AppGroup 변경·인증서 취소·개인키 export0.

### 2. 산출물 및 검증

- Archive: `/private/tmp/timefit-signup-signed-20260910-final01.xcarchive`
- 배포 IPA: `/private/tmp/timefit-signup-signed-20260910-export01/mobile.ipa`
- IPA SHA256: `9c7df298e30ff21cdc4311abbf850f752e7853d40b5792e30de504f8adda3e9b`
- Archive/IPA main.jsbundle 바이트 동일: SHA256 `926cbf6e9143626584cf98a1ab6944031a13d80e6741712f052a49c61fa01035`. 기존 09-09 JS hash와 다름. Assets.car 바이트 동일.
- main/extension 모두 1.0.0(1), iPhone family1/iOS17, Team642X5R37S7, 기존 AppGroup 동일. IPA 양쪽 Apple Distribution 서명, get-task-allow=false, App Store 프로필(기기 목록 없음), 만료 2027-09-09T14:06:46Z. strict/deep codesign PASS. Archive의 개발 서명을 배포 서명으로 오인하지 않음.
- main ITSAppUsesNonExemptEncryption=false, Live Activity/확장/Privacy manifest/아이콘 참조 검증 PASS. 승인 원본 및 생성 AppIcon hash는 09-09 값과 일치.
- GPS 권한키/ExpoLocation framework 및 ODsay 금지 패턴 미검출. 각 artifact audit: server-only secret0/private-key0, 허용 공유 provider alias2 구분, public Supabase/CAPTCHA endpoint 포함. 기존 동적 fixture와 결합하며 정적 검사만으로 모든 네트워크 수집 부재를 주장하지 않음.
- public check/prebuild/ARCHIVE/EXPORT PASS. 로그 `/private/tmp/signup-signed-prebuild-20260910.log`, `signup-signed-archive-20260910.log`, `signup-signed-export-20260910.log`. Archive 로그 public_native_environment_verified 확인.
- 검증 결과 `/private/tmp/signup-signed-archive-verify.json`, `signup-signed-archive-audit.json`, `signup-signed-ipa-verify.json`, `signup-signed-ipa-audit.json`.
- 제품 코드 변경0이므로 가입 연결 작업의 typecheck/전체 테스트 재사용: `/private/tmp/signup-connect-ui-final.log` UI787 PASS/1기존skip, `/private/tmp/signup-connect-all.log` core483 PASS 로그 확인. `git diff --check` PASS.

### 3. 유지 경계·다음 담당

가입 CAPTCHA token의 Auth options 전용 전달, 나이 자기확인·필수 동의·registry 검증, 수동 위치/추천/학습/기록/Live Activity 계약 유지. 이메일 확인 설정을 새로 변경하지 않음. 사용자 가입·재로그인 성공은 사용자 보고이며 에이전트의 운영 가입 실행0.

통합 담당은 위 수정본 Archive로 승인된 업로드를 진행한다. 통합 담당이 Connect에서 빌드 없음 확인하여 1.0.0(1) 유지. 업로드 재export 시 포장/서명 hash가 달라질 수 있으므로 source Archive와 JS 동일성 기준을 연결한다. 이 문서의 빌드 담당은 업로드·온라인 Validate·심사 제출·공개 출시를 실행하지 않았다. 업로드 처리 후 TestFlight 실제 동일 빌드의 가입/로그인·문서·지도/Kakao/Live Activity smoke와 Connect 빌드 선택은 별도 단계다.
