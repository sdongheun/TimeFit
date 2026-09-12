# U-RELEASE-BUILD-01 — 공개 빌드 준비·점검 인수인계

2026-09-08. 실행 기준: `../integration-decision/release-execution-wave.md`, `../qa-release/release-candidate-audit.md`, `../external-api/release-facts-final.md`.

**표시명·iPhone·공개 입력 격리 구현 및 로컬 서명 Release 검증 완료. Store Archive/제출 수락은 미완료.** UI 디자인/기능 작업을 재개하지 않았다. 사용자 확인된 Live Activity 흐름과 ‘5분 뒤’ 제거를 유지했다.

## 1. 변경 파일 / 목적

이전 `mobile` 표시명·iPad 지원·로컬 internal flag를 그대로 사용하는 Release → QA가 제출 입력 혼합을 확인 → 표시명만 짜투리로 지정, main/extension iPhone 전용 및 별도 public 실행 입력으로 교체 → 내부 개발 설정을 지우지 않으면서 제출 준비를 재현하기 위함 → 현행(로컬 검증 완료, 최종 Archive 전).

- `app.json`: `ios.infoPlist.CFBundleDisplayName=짜투리`, `supportsTablet=false`, 명시 buildNumber1. 기술 프로젝트명/name·slug는 mobile로 유지하며 사용자 표시명과 구별한다.
- `plugins/withTimeFitLiveActivity.cjs`: main/extension device family1 및 config에서 동일 version/build 전달. 기존 Extension에 재적용되며 새 target 중복 생성 없음.
- `plugins/live-activity/TimeFitLiveActivityExtension-Info.plist`: Extension 표시명 짜투리.
- 생성 iOS `mobile/Info.plist`, `mobile.xcodeproj/project.pbxproj`, Extension Info.plist를 prebuild로 동기화. 기존 Swift 템플릿/공유 상태 로직은 변경하지 않음. package/lock 변경 없음.
- `scripts/release-build.cjs`: public 전용 check/prebuild/export/build. `.env` 파일은 메모리에서 파싱하며 수정하지 않음. public 변수 allowlist, 미검토 변수 거절, diagnostics/C/B12/CAPTCHA 진단 false, proxy true, NODE_ENV production, EXPO_NO_DOTENV1을 **병합 후** 고정. Expo가 이후 `.env.local`로 다시 덮지 못하게 한다. 서버 전용 credential 환경변수는 자식 프로세스에서 제외한다. Supabase publishable/anon 형식만 허용, HTTPS 및 로컬 호스트 기본 검사, credential 값 출력0.
- `scripts/audit-release-artifact.cjs`: 산출물 읽기 전용 검사. 알려진 로컬 서버 전용 값·개인키 패턴과 공개 provider alias를 구별하고 개수만 출력. endpoint 값은 출력하지 않고 입력값의 번들 포함 여부만 확인. plist/manifest/번들 SHA256 출력. 전체 침투검사나 App Store 수락 도구가 아니다.
- `test/ui/release-build-config.test.mjs`, `test/ui/unified-time-route-setup.test.mjs`: 실패 선행 config/환경 fixture, 실제 TimeSetup와 C 실행·복구 컴포넌트의 public 비노출/호출0 검증.

## 2. 유지한 계약 / 실제 빌드 사실

| 점검 | 새 로컬 Release 결과 |
| --- | --- |
| main/extension 표시명 | 둘 다 짜투리 |
| 식별자 | main `com.dongheun.mobile`, extension `com.dongheun.mobile.liveactivity` 유지 |
| App Group / Team | 양쪽 `group.com.dongheun.mobile.timefit` / `642X5R37S7`, 실제 서명 entitlement에서도 일치 |
| version/build/OS/device | 양쪽 1.0.0(1), MinimumOSVersion17.0, UIDeviceFamily `[1]` |
| 확장 포함 | `PlugIns/TimeFitLiveActivityExtension.appex`, widgetkit-extension 포함, NSSupportsLiveActivities main=true |
| 권한 | main foreground 위치 설명문만, background mode 없음, push entitlement 없음. Extension 추가 사용권한 없음 |
| 위치 문구 | 현위치의 도로명 주소와 주변 장소를 보여주기 위해 위치를 사용합니다. |
| ATS | arbitrary loads=false, local networking=true 기존값 유지. 개발 서버 접속 성공이라는 의미 아님 |
| 로컬 서명 | deep/strict codesign verify PASS, 양쪽 get-task-allow=true인 development 서명. App Store 배포 서명/프로필 검증을 대신하지 않음 |
| 아이콘 | 기존 assets/icon.png, 1024×1024·alpha 없음. 디자인 변경0, 최종 사용자 승인 여부 미확인 |
| 내부 도구 | public 입력으로 실제 TimeSetup 개발 시계/QA/A3/LA 진단 버튼0, 일반 계정 C 실행/복구 mount에서 runner/조회/구독0. 기존 internal true 회귀는 유지 |

- App/nav/controller·DB·추천/API 정책·데이터·180분/2곳·당시 학습 증거·계정 격리·운영 설정 불변. 중앙 문서/보드/사용자 `.env.local` 수정0.
- `__DEV__`만 false라고 판정하지 않았다. native Release + NODE_ENV production과 별도로 exact 공개 internal flag4개를 false 고정했다. 개발 시계/QA의 기존 dev gate는 유지하고 실제 제출 입력으로 실행했다. public 명령에 Debug/start/dev 옵션은 없다.
- API 최신 인계와 대조: proxy 활성의 추천은 Edge→Kakao이며 실패 시 legacy 자동 우회 없음. Kakao Local REST/지도 JS 등 기존 클라이언트 키는 유지. 등록된 legacy 화면/기존 저장 코스의 TMAP/ODsay 도달성은 남아 있으므로 키를 임의 제거하지 않는다.
- export와 native 번들에서 Supabase/CAPTCHA effective 입력이 포함됨을 값 없이 확인. 원격 HTTPS 형식 확인은 **승인된 운영 프로젝트/Worker인지 또는 실제 가용성의 검증이 아니다**. API 인계의 원격 미확인은 유지한다.
- 두 산출물의 알려진 서버 전용 credential 값 일치0/개인키 패턴0. `TMAP_APP_KEY`·`TOURAPI_KEY`는 기존 EXPO_PUBLIC alias와 같은 provider 값이므로 각각 일치, 서버 전용 누출0과 분리했다. 클라이언트 공급자 키를 ‘바이너리에서 비밀 유지’한다고 표현하지 않는다. 원격 서버키와 비교한 검사가 아니며 공급자 제한/legacy 도달성은 API/QA 최종 점검 사항이다.

## 3. 검증 결과 / 재현

| 실행 | 결과 / 로그 |
| --- | --- |
| 실패 선행 | 기존 표시명/iPad 및 public 입력 모듈 부재로 실패. `/private/tmp/timefit-release-build-red.log` |
| 실제 화면·public fixture 집중 | 46/46 PASS, `/private/tmp/timefit-public-focus.log` |
| typecheck | PASS, `/private/tmp/timefit-public-type.log` |
| UI 전체 | 700건: 699 PASS, 실패0, 기존1 skip. `/private/tmp/timefit-public-ui.log` |
| core 전체 | 366/366 PASS, `/private/tmp/timefit-public-core.log` |
| public prebuild/export | PASS, `/private/tmp/timefit-public-{prebuild,export}.log` |
| public signed native Release | BUILD SUCCEEDED, `/private/tmp/timefit-public-build.log` |
| artifact 검사 | export37파일/native105파일, `/private/tmp/timefit-public-{export,native}-audit.log` |
| 서명·공백 | codesign deep/strict PASS, git diff --check PASS |

core 최초 실행에서 새 mjs 실행형 테스트의 TS loader 등록이 빠져 1건 실패했다. 테스트에 기존 방식 `tsx/cjs` 등록을 추가한 뒤 전체366/366 재실행 통과. 제품 실패를 skip으로 바꾸지 않았다. 기존 UI skip은 ‘철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다’이다.

자식 환경의 production override를 포함한 명령:

```sh
node scripts/release-build.cjs check
node scripts/release-build.cjs prebuild
node scripts/release-build.cjs export
node scripts/release-build.cjs build
node scripts/audit-release-artifact.cjs /private/tmp/timefit-public-export
node scripts/audit-release-artifact.cjs /private/tmp/timefit-public-release/Build/Products/Release-iphoneos/mobile.app
codesign --verify --deep --strict /private/tmp/timefit-public-release/Build/Products/Release-iphoneos/mobile.app
```

입력 우선순위: `.env` → `.env.production` → `.env.local` → `.env.production.local` → shell → **public 강제값**. 새 public 환경변수는 검토 전 fail closed. public의 값 출력/파일 보관 없음. prebuild/export/native 로그에서도 로컬 credential 값 일치0 확인.

internal은 기존 `.env.local`과 기존 Expo/Xcode 개발 절차를 유지한다. **일반 Xcode Run/Archive나 npx expo export는 public으로 간주하지 않는다.** Archive는 최종 QA 때 같은 public 환경 경계를 사용하도록 승인된 로컬 Archive 명령을 추가하거나 별도 export 절차를 확정해야 한다. Metro clear/앱 삭제 불필요. 표시명·기기 범위·Extension 변경 때문에 native rebuild/install 필요.

검사 시 git `d3ac8f7` + 공유 dirty worktree. 운영 데이터/원격 API/Simulator/실기기/설치/Archive/업로드/commit/push0. 생성 빌드는 개발 서명된 **로컬 Release**, 고정 제출 후보 아님.

- export bundle SHA256: `75acb0df4a2fe30d324e8f5b80b8eaad6152d7f88a089d780cf1af98d2de73b5`
- native main.jsbundle SHA256: `73647c88271cb8ab870e0a872b20e5d330bb019097e66e0dca86ee8cfefcf154`
- 아이콘 SHA256: `119462bb78eb240a65c869fc067ee599639b3cb5a41953f25c07b17d2a8c7e0f`

## 4. 다음 결정 / 최종 Archive에 남는 항목

1. **privacy manifest 수락 보류:** native app/SDK에 manifest10개가 포함되고 main은 FileTimestamp C617.1, UserDefaults CA92.1, SystemBootTime35F9.1이다. Extension 자체 manifest는 없다. 공유 `TimeFitLiveActivityDiagnostics.swift:89`가 `DispatchTime.now().uptimeNanoseconds`를 이벤트 파일 순서 이름으로 사용한다. [Apple required-reason 목록](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons?language=objc)의35F9.1은 경과시간/타이머,8FFB.1은 이벤트 절대시각 목적이다. 현재 정렬용 사용을 어느 이유에 충족한다고 임의 선언하거나 main manifest가 Extension을 충분히 대신한다고 수락하지 않았다. **통합/native 후속:** 이 진단용 clock 사용의 적합성·실제 심볼/Extension 신고 범위를 확인하여 최소 clock 보완 또는 정확한 manifest를 config plugin resource로 연결. 현재 정상 도착/출발/완료 상태 로직은 수정 금지. 수집 데이터/App Privacy 최종 선언은 DB/API/DOCS 사실표와 합쳐야 하며 manifest의 빈 수집 배열이 앱 전체 ‘수집 없음’ 증거는 아니다.
2. **최종 아이콘 승인:** 현재 파일 규격은 확인했으나 사용자 최종 디자인 승인은 미확인. 새 아이콘을 임의 제작하지 않았다.
3. **Store Archive:** 현 결과는 development 서명(get-task-allow=true). 최종 public Archive에서 distribution 서명·프로필·version/build 중복·확장 포함·권한·privacy를 다시 검증하고 사용자가 승인한 뒤에만 업로드한다. 로컬 빌드 PASS를 심사 제출 가능으로 올리지 않는다.
4. **운영 endpoint/공개 링크:** API의 운영 project/Worker·도메인 제한·가용성 미확인 유지. RELEASE-LINKS-01의 실제 공개 URL 승인/registry/UI 연결은 본 작업에서 하지 않았다. 법적 공개 조건도 별도 통합 게이트다.
5. **최소 실기기:** 최종 후보 설치 후 홈 표시명/아이콘, TimeSetup·내정보 내부 도구0, cold start·위치 거절 수동 입력/지도·Kakao 전환·LA 도착/출발/최종완료만 변경 영향 smoke로 한 번 확인. 이전 FINAL-02 사용자 PASS를 새 public 빌드의 결과로 복사하지 않는다. C 실행/계정 삭제 반복이나 Simulator 조작은 요구하지 않는다.

인계 판정: QA 후보 감사의 표시명/iPhone/internal 환경 P0에 대한 **로컬 구현·자동 근거 제공 완료**. 동일 최종 Archive·실기기·privacy 이유·공개 링크·운영/법적 확인이 남아 있으므로 전체 제출/공개 수락은 하지 않는다.

## U-RELEASE-NATIVE-02 — 개인정보 명세·공개 Archive 보완 인수인계 (2026-09-09)

2026-09-08 착수, 09-09 인계. `release-minimal-followup.md`의 명령 수행. **진단 clock/Extension manifest 보류 해소·로컬 공개 환경 Archive 검증 완료. 배포 서명·온라인 Validate·업로드는 미실행.** 위01의 privacy 보류는 아래 근거로 교체하며 이력은 삭제하지 않는다.

### 1. 변경 파일 / 교체 이유

- 이전 main/extension 공용 진단이 uptime 값을 파일명 순서로 사용 → 경과시간/타이머 측정이 아닌 순서·고유성 목적이라 시스템 시간 reason을 임의 선언할 수 없었음 → `TimeFitDiagnosticFileOrder.swift`의 App Group 폴더별 파일 잠금·증가 순번·UUID로 교체 → 시스템 clock 불필요, 기존 진단 읽기/정렬 보존 → 현행.
- `plugins/live-activity/TimeFitDiagnosticFileOrder.swift` 신규: 각 stream `.order.lock`을 O_NOFOLLOW로 열고 fstat으로 일반 파일 여부만 검증, flock EX를 순번 할당부터 atomic JSON 쓰기/trim 완료까지 유지. 기존20자리 숫자-UUID.json의 최대 숫자+1 사용. 기존 uptime 파일도 변환 없이 먼저 읽고 그 이후에 신규 진단이 정렬된다. 동시 프로세스/스레드의 별도 fd를 직렬화하며 실패/종료 시 OS lock 해제. UInt64 포화는 가짜 성공 없이 오류 반환. 시간 변경/재부팅으로 순서가 역행하지 않는다. lock 파일은 기존 진단 파일과 같은 first-unlock 보호 설정 사용.
- `TimeFitLiveActivityDiagnostics.swift`: 파일명 생성·write/trim 경계만 위 helper로 연결. JSON schema2/stream 분리/최대32개/읽기/복사/clear/API·비민감 필드 및 기존 오류 경계 유지. app/extension에 같은 소스가 컴파일되며 arrival/departure/completion receipt 의미는 바꾸지 않음.
- `plugins/live-activity/PrivacyInfo.xcprivacy` 신규: Extension의 App Group 내부 파일 메타데이터 사용 C617.1만 선언. tracking=false, 별도 네트워크 수집 없음. 이 Extension 명세를 앱 전체 데이터 수집 없음으로 해석하지 않는다.
- `plugins/withTimeFitLiveActivity.cjs`: helper를 main/extension Sources에 각각1회, Extension manifest를 해당 Resources에1회 추가. main은 Expo PrivacyInfo merge로 C617.1을 보장하고 기존 SDK 이유/수집 선언을 덮어쓰지 않음. Resources 그룹이 없는 기존 프로젝트도 생성 가능하게 처리. public bundle phase 최종 native 실행 직전 환경 guard1개를 추가해 `.xcode.env.local` 재로딩 이후 내부 flag/production/proxy/dotenv/bundling 상태를 검사한다.
- `scripts/release-build.cjs`: 기존 public 환경을 재사용하는 `archive [절대경로.xcarchive]`, `assert-native` 추가. Archive 기본 경로는 `/private/tmp/timefit-public-native02.xcarchive`. 이미 존재하면 덮어쓰지 않고 실패. public native 플래그가 바뀌었으면 번들링 전 중단. 원격 provisioning/업로드 옵션 없음.
- `scripts/audit-release-artifact.cjs`: xcarchive 내부 앱 경로 지원, main/extension 각각 privacy manifest 존재 여부 보고 및 누락 시 실패.
- `test/ui/release-native-privacy.test.mjs`, `test/ui/fixtures/TimeFitDiagnosticFileOrderHarness.swift`: clock 제거/manifest reason/legacy 숫자·4프로세스 동시 작성/Archive 인자·public override 거절 fixture. 생성 iOS source·resource·project는 prebuild로 동기화.

### 2. 유지 계약 / 공식 근거

- UI 디자인·표시명·iPhone·iOS17·bundle ID/App Group·권한·개인화/DB·진행/도착/출발/최종완료 의미 불변. 기존 ‘5분 뒤’ 비노출 유지. Diagnostics의 schema/build revision을 기능 revision으로 임의 바꾸지 않고 이번 산출물은 아래 hash로 식별한다.
- custom native 전체 검색에서 UserDefaults/systemUptime/mach_absolute_time 및 파일 timestamp 직접 사용은 없고, 제거 전 uptimeNanoseconds는 Diagnostics 공용 파일1곳이었다. 현재 직접 required-reason 호출은 helper의 **fstat**: 앱/Extension 동일 App Group 내부 lock 파일의 mode 검증. 사용자/타 앱 경로 메타데이터를 읽거나 외부 전송하지 않는다. `Date`를 쓰는 실제 도착·출발 wall clock은 유지하며 system boot time API와 혼동하지 않는다.
- Extension 바이너리 undefined symbols에 `_fstat` 확인, `mach_absolute_time`/`systemUptime` 직접 심볼 미검출. 이는 OS 프레임워크 내부까지 system clock이 전혀 없다는 주장이 아니다.
- main의 SDK SystemBootTime35F9.1·UserDefaultsCA92.1 등 기존 선언은 SDK 때문에 유지한다. App Group을 사용한다는 이유만으로 쓰지 않는 UserDefaults1C8F.1을 추가하지 않았다. 개인정보 선언은 target별 실제 목적 기준이다.
- Apple 공식 확인 2026-09-08: [required-reason API 이유](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons?language=objc), [manifest 파일/target Resources](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [manifest 번들 위치](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk). C617.1은 앱/App Group 파일 메타데이터 범위에 해당하며, 이번에는 부적합한 clock 이유를 추가하지 않고 호출을 제거했다. Extension의 Resources와 `.appex/PrivacyInfo.xcprivacy`를 직접 검사해 main이 자동 대체한다고 가정하지 않았다.
- App Privacy의 계정·위치·기록·학습 수집표는 DB/API/DOCS 인계와 별개로 마감해야 한다. required-reason 보완이 법적 고지/수집표 수락을 뜻하지 않는다.

### 3. 실행 테스트 / 산출물

- 실패 선행: 기존 uptime 호출·helper 부재·Archive 공개 entry 부재에서 실패(`/private/tmp/timefit-native02-red.log`). 최소 구현 뒤 집중5/5 PASS(`/private/tmp/timefit-native02-focus-final.log`).
- 실제 Swift helper를 swiftc로 컴파일하고 독립 프로세스4개×20건 실행: 기존 legacy1개 보존, 총81개, 순번81개 고유, 최종 숫자=기존최대+80, 충돌/덮어쓰기0. Simulator가 아닌 macOS 명령행 native harness다.
- typecheck PASS(`/private/tmp/timefit-native02-type.log`), 최종 UI705건 중704 PASS·기존1 skip·실패0(`/private/tmp/timefit-native02-ui-final.log`), 전체371/371 PASS(`/private/tmp/timefit-native02-core-final.log`). 이전 기능 회귀를 유지했다. 추가 manifest fixture의 plist null-prototype 비교 실패는 필드 객체로 정규화 후 전체 재실행했으며 제품 실패를 skip으로 바꾸지 않음.
- public prebuild/반복 prebuild PASS. project SHA256 양쪽 `012b8e60585e1b6521dadbcd92a45f7d8e12559b7da2c38a09b6f0ab07859113` 동일, target별 manifest1개·public guard1개. 초회 Resources 그룹 부재로 prebuild 실패한 것은 plugin에서 보완 후 재실행. 로그 `/private/tmp/timefit-native02-prebuild{,-repeat}.log`.
- public iOS export PASS(`/private/tmp/timefit-native02-export.log`). **로컬 Archive native Release 컴파일/서명까지 ARCHIVE SUCCEEDED**(`/private/tmp/timefit-native02-archive.log`), 번들 생성 직전 `public_native_environment_verified` 확인. 일반 Xcode Archive를 public으로 간주한 결과가 아니다.
- Archive: `/private/tmp/timefit-public-native02.xcarchive`, 내부 `Products/Applications/mobile.app`. main/extension 짜투리·1.0.0(1)·iOS17·device family1, App Group/Team 동일, push/background 추가0. main/extension manifest 모두 존재(총 manifest11개). secret 감사 앱106파일: 알려진 서버 전용 credential0/개인키 패턴0, 기존 공개 provider alias2개는 별도 분류. endpoint 입력 일치 true, 값 비출력. `/private/tmp/timefit-native02-archive-audit.log`.
- codesign deep/strict verify PASS. main/extension 둘 다 get-task-allow=true, **Apple Development 서명**. 승인된 로컬 키체인 조회는 Development1/Distribution0만 출력했고 개인키·인증서 원문은 내보내지 않음. sandbox 조회의0/0은 승인 후 실제 키체인 결과로 교체했다.
- Archive bundle SHA256: `8600d385c1a6c84b5a93e193f416d853d997fb55fc700ee1f88ceaabce1423fe`. Extension executable SHA256: `65cd3db79ef615b21cd74c8faa8876f56d10d02bc8d73b4eed4dcf92829f6145`.
- Archive 로그 credential 원문 일치0, diff check PASS. 원격 쓰기/실제 API/계정 작업/온라인 Validate/업로드/Simulator/기기 설치/commit/push0.

### 4. Archive 재현 / 배포 서명 준비 / 다음 인계

```sh
node scripts/release-build.cjs check
node scripts/release-build.cjs prebuild
node scripts/release-build.cjs archive /private/tmp/timefit-public-next.xcarchive
node scripts/audit-release-artifact.cjs /private/tmp/timefit-public-next.xcarchive
codesign --verify --deep --strict /private/tmp/timefit-public-next.xcarchive/Products/Applications/mobile.app
```

새 경로를 지정하고 기존 Archive는 보존한다. wrapper는 Release/proxy true/internal4개 false/EXPO_NO_DOTENV1을 유지하며 native 최종 단계에서 한 번 더 검사한다. 사용자 internal env/일반 Xcode 작업 환경은 변경하지 않는다. URL/최종 아이콘/계정 문서 연결 전이므로 이 Archive는 **최종 제출 후보가 아니다**.

배포 단계 준비(지금 실행 안 함):

1. 사용자가 App Store Connect의 기존 build 번호와 중복 여부를 확인하고 version/build를 확정. config version/ios.buildNumber는 plugin이 main/extension에 동일하게 전달한다. 업로드 때 임의 자동 증가하지 않도록 export 옵션 `manageAppVersionAndBuildNumber=false` 사용.
2. 현재 유효한 Apple Distribution 로컬 자격0. 승인된 배포 인증서+private key와 main/extension 각각의 App Store 프로비저닝 프로필이 필요하다. 두 Bundle ID·Team·App Group 포함을 확인한다. 이 작업은 자동 인증서 생성/취소/원격 프로필 생성을 하지 않았다.
3. 자격 준비·별도 승인 후 로컬 `xcodebuild -exportArchive` 옵션을 마련한다. 설치된 Xcode `-help` 확인값: `method=app-store-connect`, `destination=export`, `signingStyle=manual`, `signingCertificate=Apple Distribution`, `teamID=642X5R37S7`, `provisioningProfiles`는 두 Bundle ID→**실제로 승인된 프로필 이름/UUID**. 미확정 프로필을 가짜 값으로 저장하지 않았다. `-allowProvisioningUpdates`·`destination=upload`는 사용하지 않는다.
4. 로컬 export IPA의 재서명 결과/get-task-allow=false·entitlement·manifest·버전·번들을 재검사. Development Archive를 그대로 distribution 완료로 표시하지 않는다. 온라인 Validate·업로드·심사 제출은 별도 승인이다.
5. QA에는 기존 출시 체크리스트에 새 manifest 포함·public guard·최종 distribution 서명 검사만 추가 인계. 이번에는 사용자 실기기 반복 확인을 요청하지 않는다. 마지막 공개 후보에서 정상 LA 공유 흐름의 변경 영향 smoke를 기존 목록에 합친다.

판정: 이번 native API 사용 목적/manifest 범위의 미확정 추정은 제거했고 공개 Archive 재현·로컬 검증까지 완료했다. 남은 사항은 배포 서명 자격/최종 링크·아이콘/최종 후보 QA·온라인 검증 승인이다. 동의·DB·추천·UI를 확대 수정하지 않는다.

## U-RELEASE-SIGNING-PREP-03 — App Store 서명·export 준비 (2026-09-09)

**EXIT-03 구현·전체 검증·release-exit-final.md 인계 후 착수. 절차 준비 완료 / 배포 서명 실행·IPA 생성·온라인 Validate·업로드 미실행.**

### 1. 변경 파일 / 현행 절차와 근거

이번 단계는 이 문서만 수정했다. 기존 release-build/audit 스크립트는 재사용하며 새로운 서명 자동 실행 entry는 만들지 않았다. NATIVE-02의 main/extension manifest·clock 보완과 Development Archive 근거는 재사용한다.

이전 인계가 수동 profile 매핑만 제시 → 로컬 Distribution0을 수동 인증서 생성 필수로 오해할 수 있음 → **기존 자동 서명 유지 + Xcode Organizer의 App Store Connect 로컬 export를 권장** → 개인 Team의 현재 자동 서명 구성에 맞고 키 내보내기/프로필 수동 유지 부담을 줄임 → 준비 기준 현행. 수동 방식은 자동 방식의 권한/조직 정책 제약이 확인된 경우에만 별도 승인으로 선택한다.

- [Apple 배포 절차](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases): Archive의 배포 과정에서 서명을 선택한다. Development Archive가 export 때 배포 서명으로 재서명되는 것은 가능하지만, 실제 export 성공과 같지 않다.
- [Apple cloud-managed certificates](https://developer.apple.com/help/account/certificates/cloud-managed-certificates/): Organizer 배포에서 로컬 배포 인증서가 없으면 cloud signing을 사용할 수 있다. 따라서 로컬 Distribution0이 곧 계정의 cloud 인증서0 또는 배포 불가능이라는 뜻은 아니다. 원격 자격 존재/사용 권한은 이번에 조회하지 않았다.
- [Apple App Store profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile): 자동 서명은 Xcode가 배포 프로필을 관리하는 경로다. 수동 선택 시에는 실제 App ID에 맞는 배포 프로필이 필요하다. 공식 문서 확인일 2026-09-09.

### 2. 유지 계약 / 승인 후 실행 절차

Team `642X5R37S7`, main `com.dongheun.mobile`, extension `com.dongheun.mobile.liveactivity`, App Group `group.com.dongheun.mobile.timefit` 유지. 인증서 취소/키 export/Bundle ID 변경/App Group 재생성은 하지 않는다. 로그인/MFA는 사용자가 수행하며 비밀번호를 요청하거나 기록하지 않는다.

**사용자 확인·승인:**

1. Xcode Settings → Accounts에서 기존 Team 로그인이 유효한지 사용자 확인. App Store Connect의 앱/기존 build와 version/build 중복 여부 확인. 현재 `1.0.0(1)`의 중복 여부는 미확인이다. 임의 자동 증가 금지.
2. 최종 공개 URL/아이콘/가입 연결 및 통합 수락 이후 아래 wrapper로 새 경로에 Archive를 만든다. 기존 NATIVE-02 Archive는 EXIT-03 이전 코드이므로 최종 후보로 재사용하지 않는다. 이번에는 새 Archive를 만들지 않았다.
3. **별도 승인 후에만** 해당 Archive를 Organizer에서 Distribute App → Custom의 App Store Connect 방식 → Export(Upload 아님)로 진행한다. 자동 서명을 유지하고 build 자동 관리 옵션을 끈다. Xcode 버전에 따라 화면명이 달라도 export 목적과 아래 옵션을 기준으로 한다. 배포 인증서/프로필 생성·갱신 또는 cloud signing 접근은 원격 작업임을 설명하고 승인 범위를 확인한다. 다른 App ID/권한 변경을 요구하면 중단한다. Upload/Validate 선택은 이번 승인의 일부가 아니다.

**공개 환경 Archive 경계:**

```sh
node scripts/release-build.cjs check
node scripts/release-build.cjs prebuild
node scripts/release-build.cjs archive /private/tmp/timefit-public-signing03.xcarchive
node scripts/audit-release-artifact.cjs /private/tmp/timefit-public-signing03.xcarchive
```

이미 존재하는 경로는 덮어쓰지 않고 새 승인 경로를 정한다. 일반 Xcode Product → Archive로 바꾸지 않는다. wrapper의 production/EXPO_NO_DOTENV=1/proxy=true/internal4개=false와 최종 native bundle guard를 유지한다. exportArchive는 검증된 Archive를 재서명·패키징하며 다른 환경에서 JS를 다시 빌드하는 단계가 아니다.

**로컬 export 옵션 명세(아직 파일 생성/실행하지 않음):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>642X5R37S7</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
```

승인된 자격이 준비된 뒤 위 내용으로 `/private/tmp/timefit-signing03-export-options.plist`를 생성하고, CLI를 선택할 경우 기존 public 환경 함수를 그대로 사용한다:

```sh
node -e 'const r=require("./scripts/release-build.cjs"); const env=r.publicEnvironment(r.loadInputs()); r.assertPublicNativeEnvironment(env); const p=require("node:child_process").spawnSync("xcodebuild",["-exportArchive","-archivePath","/private/tmp/timefit-public-signing03.xcarchive","-exportPath","/private/tmp/timefit-signing03-export","-exportOptionsPlist","/private/tmp/timefit-signing03-export-options.plist"],{env,stdio:"inherit"}); process.exitCode=p.status??1;'
```

이 명령은 **준비 예시이며 실행 안 함**. CLI가 cloud signing을 Organizer와 동일하게 사용할 수 있다고 가정하지 않는다. 자격/프로필이 부족하면 중단하고 승인된 Organizer 준비로 돌아간다. `-allowProvisioningUpdates`는 인증서/App ID/profile 원격 변경을 허용하므로 몰래 추가하지 않는다. 기본 절차에 authentication key/관리자 자격을 넣지 않는다. 수동 대안은 실제 승인 프로필 두 개의 이름/UUID를 확인한 뒤에만 `signingStyle=manual`, `signingCertificate=Apple Distribution`, Bundle ID별 provisioningProfiles를 작성한다. 가짜 UUID나 credential은 작성하지 않았다.

### 3. 읽기 전용 확인 / 검증 결과

- 로컬 유효 signing identity 재확인: **Development1 / Distribution0**. 승인된 키체인 접근에서 종류별 수만 출력, 인증서·개인키 원문/내보내기0.
- Xcode 로컬 profile 두 개: main/extension 각각 development, 조회 시 유효, Team/App Group 일치 true. 일치하는 로컬 App Store profile0. 초기 sandbox/파서 import 조회 실패는 프로필 부재로 해석하지 않고 올바른 default parser·승인된 접근으로 재확인, 최종 decodeFailures0. 프로필 원문·인증서 데이터·기기 UDID·개인정보는 출력/저장하지 않았다.
- project의 기존 Automatic/Team 설정 유지. 설치된 `xcodebuild -help`에서 method=app-store-connect, destination=export, signingStyle=automatic 지원 및 build 자동관리 기본 YES 확인; 명세에는 false를 명시했다.
- 스크립트/제품 변경 없이 문서 준비만 했으므로 전체 테스트/Archive를 반복하지 않았다. 바로 앞 EXIT-03의 typecheck PASS·UI706 PASS/1 skip·core373 PASS·public iOS export PASS는 해당 코드 검증이며 배포 서명 검증이 아니다.
- Simulator·실기기 설치·운영 API·원격 Apple 변경·인증서 생성/취소·IPA export·Validate·upload·commit/push0.

### 4. 다음 결정 / export 후 자동 검사 / 최종 후보 조건

- 승인 요청 범위: 기존 Team·두 App ID의 자동 배포 자격 및 프로필 준비/로컬 export. 인증서 취소·App ID/App Group 재생성·업로드는 제외. 실제 provisioning 변경 화면의 대상이 다르면 중단. 사용자가 승인하기 전 실행하지 않는다.
- 자격 준비 후 자동화 가능: public wrapper 새 Archive, audit, 승인된 로컬 export, IPA를 새 임시 폴더에 추출 후 Payload의 실제 `.app` 경로를 확정하여 기존 audit 실행. 압축 해제를 위해 기존 자료를 삭제하지 않는다.
- IPA 검사: main/extension 각각 distribution authority·서명 유효성(codesign --verify --deep --strict), get-task-allow가 true가 아님, profile 유효/App Store 유형(ProvisionedDevices/ProvisionsAllDevices 없음)·Team/application-identifier/App Group 일치, extension 포함·iOS17·iPhone family1·짜투리 표시명·version/build 동일, target별 PrivacyInfo 포함. entitlement/profile은 필요한 필드만 요약하고 전체 credential/certificate를 로그에 내보내지 않는다.
- 기존 audit로 서버 전용 값/개인키0·endpoint 입력 포함 확인. **audit만으로 internal flag 의미를 모두 검사했다고 하지 않는다.** Archive의 public_native_environment_verified 근거와 IPA main.jsbundle SHA가 검증된 Archive bundle SHA와 동일한지 함께 확인한다. 불일치하면 공개 설정 증거가 끊긴 것으로 중단하고 원인을 조사한다. 코드 서명 때문에 변경되는 전체 app hash와 JS bundle hash를 혼동하지 않는다.
- 최종 후보 진입: 공개 URL/registry/가입 연결·아이콘 수락, 운영/API/DB 출시 사실 수락, Connect build 중복 해소, 배포 IPA 감사, 제한 실기기/최종 QA 완료. App Store용 IPA 자체를 임의 기기 설치용으로 간주하지 않는다. TestFlight 업로드/온라인 Validate는 별도 승인 후 진행한다.
- **준비 완료를 배포/심사 수락으로 올리지 않는다.** 원격 계정 자격과 실제 IPA 서명 결과·최종 실기기는 미확인으로 인계한다.

## 2026-09-09 촬영 후속 / API 암호화 선언 연결

1. **변경 파일·목적:** API-RELEASE-ENCRYPTION-01 완료 인계 전체 확인 후 `app.json`의 expo.ios.config.usesNonExemptEncryption=false와 `test/ui/release-encryption-config.test.mjs` 추가. public 비clean prebuild로 main Info.plist 생성. generated 파일만 직접 수정하지 않았다. 기존 public 환경 함수를 재사용해 Release Simulator 빌드/증분 빌드·지정 기기 설치 완료. 상세는 `release-capture-preparation.md`의 후속 절.
2. **유지 계약:** HTTPS 사용/ATS·권한·UI·LA·Bundle/Team/AppGroup/아이콘/version/build·추천/개인화/DB 불변. 비면제 암호화 미사용 선언이지 ‘암호화 없음’이 아니다. API가 검토한 package/lock/Pods hash3개 일치. extension 별도 변경0. Distribution Archive/IPA·계정/서명 자격·Connect 입력·업로드0.
3. **검증:** 설정 전 누락 fixture 실패→반영 후1/1 PASS. typecheck PASS/UI713 PASS+기존1skip/core402 PASS/public iOS export PASS. 최종 Simulator BUILD SUCCEEDED, native public guard PASS, 생성/최종 main plist boolean false. `/private/tmp/timefit-capture-release-20260909/Build/Products/Release-iphonesimulator/mobile.app`; bundleSHA `064269a88ffd6fcf675d827f5bd6620ac47add19529b2b8295c124bedf3d7076`. 앱116파일 감사 known server-only0/private key0/기존 public alias2/target manifest 양쪽 포함. iPhone17 Pro Max에만 설치했고 앱은 자동 실행하지 않았다. 홈 아이콘/명칭 보조 캡처1장, Store 앱6장0.
4. **다음:** 네트워크 차단 확인 뒤 가능한 앱 화면 또는 사용자의 수동 실제 지도/추천 캡처 검수. 최종 링크 연결 뒤 새 후보 생성 시 동일 declaration/실제 포함 framework 확인; 예상하지 않은 암호 SDK 추가 시에만 API 재판정. 기존 Distribution0은09-09 SIGNING-PREP 조회 근거를 재사용하며 재조회/신규 승인 추정0. 이번 Simulator 산출물을 실기기 설치/Store 제출본으로 사용하지 않는다.
