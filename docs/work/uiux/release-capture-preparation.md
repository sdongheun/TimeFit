# U-RELEASE-CAPTURE-PREP-01 — 촬영 환경·고정 시나리오 인수인계

## 2026-09-09 후속 실행 — 로컬 Release Simulator 후보

이 절이 아래 과거 준비 전용/9월15일 고정 시나리오보다 우선한다. 사용자 후속 승인으로 지정 Simulator 부팅·로컬 빌드·설치/촬영만 허용됐다. **현재 시각/실제 반환 후보를 사용하는 수동 촬영**으로 교체하며 강제 후보·테스트 시계·가짜 지도/동의·새 하네스는 만들지 않는다. 공개 URL 전이므로 제출 최종본이 아니다.

### 1. 변경 파일 / 목적

- `app.json`의 `expo.ios.config.usesNonExemptEncryption=false`, `test/ui/release-encryption-config.test.mjs`: API-RELEASE-ENCRYPTION-01 완료 인계를 받은 뒤에만 반영. 비면제 여부 boolean이며 HTTPS/ATS/로그인·UI 변경 아님. 기존 prebuild 생성 경계 사용, native plist 직접 수정0.
- 이 문서와 `release-build-final.md`: 촬영용 산출물·수동 순서·암호화 인계. 기존 wrapper의 exported publicEnvironment/loadInputs/assertPublicNativeEnvironment를 그대로 재사용해 xcodebuild에 전달했다. wrapper 제품 파일 변경0.
- 촬영용 derivedData `/private/tmp/timefit-capture-release-20260909`, 대상 iPhone17 Pro Max `37D18200-C8AC-4F34-9240-FD4D19ABEA25`만 사용. build 인자 Release/iphonesimulator/해당 destination/CODE_SIGNING_ALLOWED=NO, Archive/exportArchive/provisioning 업데이트 없음.

### 2. 유지 경계 / 실제 촬영 전 조건

- App.tsx/nav·UI 디자인·추천·DB·LA·권한·아이콘·version/build 불변. 지정 Simulator의 기존 데이터 삭제/실기기 덮어쓰기0. 부팅/설치와 앱 실행은 별개다.
- 운영 연결0을 보장하는 native network fixture가 없으므로 자동 앱 실행 전 Mac의 Wi-Fi·유선/VPN 등 네트워크 차단 확인이 필요하다. 상태바 비행기 아이콘이나 fetch mock만으로 WebView까지 오프라인이라고 가정하지 않는다. 사용자에게 오프라인 준비 확인을 요청했다. 연결이 유지된 상태에서는 앱을 자동 실행하지 않는다.
- 인터넷 연결 후 실제 검색·지도·추천은 사용자 수동만 수행한다. guest로 촬영하며 로그인/개인화 동의/운영 학습 표본 생성을 촬영 전제로 요구하지 않는다.

### 3. 사용자 직접 촬영 순서 — 실제 화면6장

1. Simulator에서 **iPhone17 Pro Max**를 선택해 설치된 ‘짜투리’를 직접 실행한다. 한국어·세로·기본 글씨로 두고 로그인/현위치 권한 없이 수동 장소 입력을 사용한다. **실제 현재 시각에서3시간 이내** 도착 시각을 선택한다. 아래 장소는 입력 예시이며 영업/반환을 보장하지 않는다.
2. 출발지 `서면역` 또는 `롯데백화점 부산본점`, 목적지는 출발지 복귀로 설정. 최대180분을 보여줄 수 있을 때180분으로 설정하고 키보드를 닫은 입력 화면을 `01-time-setup.png`로 저장한다. 23:59/익일 표시는 실제 화면대로 두고 기기 날짜나 앱 시계를 조작하지 않는다.
3. 추천 버튼을 **한 번** 누르고 로딩 완료 후 실제 반환 한 장소 추천을 `02-one-stop-results.png`로 저장한다. 결과가 없으면 강제 후보를 만들거나 연속 재시도하지 말고 낮 시간 또는 실제 영업 중인 다른 부산 출발지로 한 번 변경해 확인한다. 그래도 없으면 해당 컷 미촬영으로 남긴다.
4. 반환된 카드 하나를 눌러 실제 장소 상세·지도 로딩이 완료되면 `03-place-detail.png`. 지도 하단 저작권/출처와 표시 패널을 자르지 않는다. 실제 표시된 장소명을 작업 기록에 남긴다.
5. A를 명시 선택하고 추가 가능한 실제 B가 반환된 경우 선택한다. 최종 코스 확인에서 지도·세로 장소 순서가 보이는 위치로 스크롤해 `04-two-stop-confirm.png`. B가 없으면2곳 컷을 꾸미지 않는다. A/B ID·이름·최종 순서·총시간·현재/종료시각을 비민감 촬영 메모에 남긴다.
6. 진행/길찾기는 사용자가 직접 실행한다. 같은 코스의 실제 앱 진행 화면을 `05-course-progress.png`로 저장한다. Simulator에 카카오맵이 없으면 실제 HTTPS fallback 상태를 확인하고 실기기 성공으로 쓰지 않는다. LA OS 화면이 정상 제공될 때만 별도 보조컷으로 저장한다. Simulator에서 실제 방문한 것처럼 도착/체류를 조작해 학습시키지 않는다.
7. 기록6번은 기존 **기기 로컬 비식별 촬영용 기록**이 있거나, 별도 승인된 guest 시연으로 생성한 로컬 기록이 있을 때만 `06-visit-history.png`로 촬영한다. 이번 자동 작업은 가상 기록을 제품 저장소에 심지 않는다. 기록이 없으면 미촬영으로 남기고 기존 사용자/운영 계정 기록을 가져오지 않는다. 서버 저장/개인화 표본이 필요한 경우 중단한다.

각 화면 준비 후 Simulator **File → Save Screen**(일반적으로 ⌘S) 또는 아래 명령으로 저장한다. Mac 창 전체/Simulator 테두리를 포함한 스크린캡처 대신 원본 화면 PNG를 보낸다. 메뉴 단축키가 다르면 File 메뉴의 실제 항목을 따른다.

```sh
xcrun simctl io 37D18200-C8AC-4F34-9240-FD4D19ABEA25 screenshot --type=png /private/tmp/timefit-capture-busan-01/01-time-setup.png
```

출력 폴더 존재·동일 파일 부재를 먼저 확인하고 각 컷의 파일명만 바꾼다. 캡처 후1320×2868/불투명·키보드/내부 도구/이메일/실제 알림 내용0을 확인한다. 사용자 제공 PNG만 후속 검수한다. 아직 없는 컷을 촬영 완료로 기록하지 않는다.

### 4. 검증·산출물 마감값

암호화 설정 전 계약 fixture는 누락된 config에서 실패, 반영 뒤1/1 PASS. API 인계의 package.json/package-lock/Podfile.lock SHA 세 값 모두 현재와 일치했다. 전체 테스트는 이번 설정 변경 때문에 실행했으며 기존 QA 결과를 무의미하게 반복한 것이 아니다. 최종 빌드/캡처 결과는 아래에 덧붙인다.

**실행 마감:**

- 초기 Simulator Release 빌드 성공 뒤 API 인계의 설정을 public 비clean prebuild1회로 생성하고, 동일 derivedData 캐시에서 증분 빌드 성공. 두 번째 빌드는 설정 반영 때문이며 Distribution Archive 반복이 아니다. `/private/tmp/timefit-capture-build{,-final}.log`, `/private/tmp/timefit-capture-prebuild.log`. 최종 native bundle phase `public_native_environment_verified` 확인. main 생성/최종 app Info.plist 둘 다 ITSAppUsesNonExemptEncryption boolean false.
- 최종 앱: `/private/tmp/timefit-capture-release-20260909/Build/Products/Release-iphonesimulator/mobile.app`. 지정 Simulator 설치 성공, 앱 실행0·기존 데이터 삭제0. main/extension 짜투리1.0.0(1), iOS17/family1, 기존 Bundle ID/manifest/ATS 유지. 서명 없는 Simulator 산출물이며 실기기 IPA가 아니다.
- artifact 감사(`/private/tmp/timefit-capture-artifact-audit.json`):116파일, manifest11개/양 target 존재, 알려진 서버 전용 credential0·개인키 패턴0·기존 public alias2 별도 분류, endpoint 포함 true(원문 비출력). JS SHA256 `064269a88ffd6fcf675d827f5bd6620ac47add19529b2b8295c124bedf3d7076`. 서버 전용 키가 없다는 감사와 모든 internal UI의 실화면 확인은 구분한다.
- typecheck PASS, UI714건 중713 PASS·기존1 skip, core402/402 PASS. `/private/tmp/timefit-capture-{type,ui,core}.log`. public iOS export PASS(`/private/tmp/timefit-capture-export.log`), export JS SHA256 `5dd5ac4ba8d73ade311ab471962152ee010e798214e2ce9296f0ac52f89388d1`. diff check PASS.
- **실제 캡처1장:** `/private/tmp/timefit-capture-busan-01/00-install-check.png`,1320×2868. 직접 열어 SpringBoard의 새 파란 시계/짜투리 명칭 확인, 사용자 이메일·계정·알림 원문 없음. OS 홈 화면 보조 증거이며 Store 앱 화면6장에 포함하지 않음. PNG alpha 채널 있음으로 제출용 규격 PASS 처리하지 않았고 이미지 수정0.
- **앱 화면6장 미촬영**: 오프라인 준비 확인이 없어 자동 실행하지 않았다. 내부 도구 비노출은 public 환경/기존 자동 회귀 근거만 있고 이번 앱 실화면 관찰은 미확인.3시간/2곳·레이아웃·지도/LA·기록은 위 사용자 수동 순서로 촬영 후 검수한다. 기존 고정9월15일 강제 입력·가상 기록 주입 요구는 후속에서 철회했다.
- 현재 소스 HEAD `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f`+dirty, 추적 제품 경로(src/plugins/app.json/package/lock) diff SHA256 `fe290411df25b542ffecbaa2a21ccbb546cdc5e0390ed7797ebd4ad84b1107c5`(미추적 전체 포함 digest는 아님). 정확한 실행 산출물 식별은 위 bundle hash 사용. 공개 링크 반영 후 새 최종 후보/암호화 plist·아이콘·내부 도구·해당 UI/기능 QA 필요. 제출 최종본/Store 검증 완료 아님.

2026-09-09. RELEASE-PARALLEL-VERIFY-01 UIUX 절. **촬영 준비 완료 / 실제 캡처0 / 제출본0.** 제품 UI·새 Archive·설치·업로드 없음. 촬영 가능한 격리 native renderer가 현재 연결되어 있지 않아 아래 입력/승인 경계에서 멈춘다. 기존 준비를 새 빌드로 반복하지 않는다.

## 1. 변경 파일 / 준비 범위

이 문서만 생성했다. SIGNING-PREP-03·ICON-01과 DOCS-08의6장 목록을 재사용했다. 이전에는 화면 목록만 존재 → native 촬영 가능한 fixture와 테스트용 hook host를 구분할 필요 → 기기/고정 입력/촬영 순서/중단 조건 명시 → 가짜 지도나 개발용 화면을 제출 이미지로 오인하지 않도록 함 → 준비 현행, 촬영 미실행.

### 빌드 입력 읽기 전용 대조

| 항목 | 현재 로컬 | Connect 사용자 보고와 대조 |
| --- | --- | --- |
| 표시명 | main/extension 짜투리 | 앱명 짜투리 보고와 일치 |
| main Bundle | com.dongheun.mobile | 앱 생성 보고와 일치 |
| extension Bundle | com.dongheun.mobile.liveactivity | 로컬 기존 계약 유지; Connect 별도 확인 보고 없음 |
| version/build | 양 target 1.0.0 / 1 | Connect 입력 미완료 보고, 중복 여부 미확인; 변경하지 않음 |
| Team/App Group | 642X5R37S7 / group.com.dongheun.mobile.timefit | 양 target 일치; Connect 보고로 증명할 대상 아님 |
| 아이콘 | assets/jjaturi-icon-blue.png | 승인 방향 적용, Store 실제 표시 미확인 |

main Info.plist·extension Info.plist의 build 변수는 project의 Release 설정으로 대조했다. Expo config/권한/테마 변경0. 아이콘 SHA256 `edab386a6107dc37d9ddca6eed5cbba919ba9bcede6591016e94d1d7215a4593`, 생성 iOS PNG `4afe82d0ee52e4c45784fb0aab7803bb9fc7a08e72a3d92d03da8bd79679b4a0`: ICON-01 인계와 동일.

SIGNING-PREP-03의 **2026-09-09 Development1/Distribution0, 로컬 development profile2** 근거 재사용. 키체인/계정 재조회0. 이것은 현재 원격 cloud signing 부재나 새로운 인증서 생성 승인을 뜻하지 않는다. NATIVE-02 Archive는 AGE/ICON 이전이므로 캡처용 최종 후보로 취급하지 않는다.

### 촬영 기기 확정

- 설치된 iOS26.5 **iPhone 17 Pro Max**, UDID `37D18200-C8AC-4F34-9240-FD4D19ABEA25`, 조회 시 Shutdown. 기기 profile의 mainScreenWidth1320/Height2868/Scale3 확인: 세로 **1320×2868 px**, 논리440×956pt. DOCS-08의6.9형 허용 규격과 일치.
- iPhone17은 이미 Booted였으나 조작/앱 조회/촬영하지 않았다. 대상을 `booted`로 지정하면 다른 기기를 촬영할 수 있으므로 항상 위 UDID를 사용한다.
- 기기 목록 읽기만 실행. 초회 sandbox CoreSimulator 접근 실패 후 승인된 목록 조회 성공. 부팅/종료/상태바·언어 설정 변경/앱 실행/테스트 없음. 사용자 기존 Simulator 테스트 금지 유지.
- 촬영 시 한국어·Asia/Seoul·세로·기본 글자 크기·다크 제품 테마, 키보드 닫힘, 터치 표시/디버그 오버레이 없음. 기본6장은 PNG 불투명, 프레임/문구 합성·늘이기·지도 재그리기 없음. 시스템 상태바 시간은 fixture와 일치시켜야 하며 상태바 override만으로 앱 Date가 바뀐다고 가정하지 않는다.

## 2. 유지 계약 / 고정 입력과 순서

제품 UI·App.tsx/nav/app.json/native project·DB/추천/LA 변경0. 운영 API/DB 요청·계정 생성/삭제·Computer Use 계정 확인·서명/게시/Connect/업로드/commit/push0. 실제 사용자 이메일·기록·사진·GPS는 촬영 입력으로 쓰지 않는다.

고정 시나리오 이름: `CAPTURE-BUSAN-01` (준비 입력이며 실제 추천 성립/방문 사실 주장이 아님).

- 기준시각 `2026-09-15T05:00:00.000Z` = 한국14:00, 종료 `2026-09-15T08:00:00.000Z` =17:00, remaining180/도착 여유10. 기기 실제 시각 대신 주입 가능한 기존 clock 경계를 사용해야 한다. 운영 인증·학습 시각 검증은 바꾸지 않는다.
- 수동 출발: 롯데백화점 부산본점 `poi_801`,35.15665/129.05655. 목적지: 같은 출발지로 복귀. GPS 요청 없음. 이 좌표는 로컬 공개 장소 데이터이며 사용자 위치가 아니다. 화면에는 좌표 숫자 대신 장소명만 표시한다.
- 첫 선택A: 놀이마루 `poi_41`,35.1564089608/129.0628997796. 둘째 선택B: 희와제과 `poi_77`,35.1584310105/129.0658105816. 로컬 catalog의 실제 ID/명칭/좌표를 읽어 대조했다. 영업·사진 허락·경로 시간·추천 적격성을 이번 조회만으로 확정하지 않는다.
- 선택 순서A→B 고정, 최종 방문 순서는 **검증된 snapshot이 반환한 순서**로 고정한다. 임의로 최적 순서/총시간/도보 geometry를 만들어 넣지 않는다. 원본 snapshot/응답 fixture가 준비되면 ID·순서·각 leg·totalMin·남은 시간·경로 hash를 함께 기록한다. 이 값들은 현재 미확보다.
- 일반 계정 대신 guest, 닉네임 없음, 개인화OFF, 표본0. 격리 저장소에만 가상 완료 기록2건(위A/B), 가상 run `capture-busan-01-run`, 중복0. 실제 저장소 이관/삭제/서버 학습 없음. 체류 미측정 기록에는 시간을 추정해 넣지 않는다.

| 순서/파일명 | 실제 화면 목표 | 고정 상태·행동 |
| --- | --- | --- |
| 01-time-setup.png | 최대3시간·수동 위치 설정 | 14:00→17:00, 출발/복귀 위 장소,180분; 입력 화면 기존 layout·개발 도구 비노출 |
| 02-one-stop-results.png | 한 장소 추천 | 동일 session의 승인된 one-stop A 결과; 로딩 종료, 실제 카드/사진 fallback·출처 유지 |
| 03-place-detail.png | 장소 상세 지도 | 같은 결과A 카드→상세, 선택 전; 실제 지도 타일/장소 마커/현재 UI 패널, 가짜 지도 금지 |
| 04-two-stop-confirm.png | 최대 두 장소 코스 확인 | A 명시 선택→B 선택→같은 session의 exact snapshot review; 실제 최적 순서·총시간 표시 |
| 05-course-progress.png | 진행·Live Activity 흐름 | 동일 run 시작→fixture handoff 성공→snapshot 첫 stop 명시 도착, dwelling 단계. 앱 진행 화면을 기본컷으로 사용. LA를 보여줄 경우 실제 native Activity 렌더 컷으로 대체하고 OS 화면을 합성하지 않음 |
| 06-visit-history.png | 방문 기록 | 같은 run의 두 stop 도착/출발 및 마지막 복귀→명시 완료→격리 기록2건, 지도/목록·가상 방문 횟수. 이전 단계와 동일 장소 |

05에서 진행 완료와 활성 LA를 동시에 주장하지 않는다. 완료는06으로 연결하며 정상 종료된 Activity를 살려 촬영하지 않는다. 각 확인 이벤트 시각은 확보된 snapshot 계획에 맞춰 고정하고, 최종 종료17:00 이내인지 검사한 뒤 촬영한다. 과거 ‘5분 뒤’/조건부 추천/개발 미리보기는 제출 화면에 포함하지 않는다.

## 3. 검증 / 현재 캡처 불가 경계

- `test/ui/support/screenRuntime.mjs`는 native View/WebView/지도 등을 문자열로 대체하는 hook host다. 실제 Yoga/iOS 렌더러가 아니므로 이 출력으로 Store 스크린샷을 만들지 않는다.
- `test/ui/place-course-screen-runtime.test.mjs`의 고정 clock/port/네트워크0·화면 이벤트 경계를 재사용 대상으로 확인했다. 기존 A/B fixture는 합성 긴 이름·가상 URL·숫자 좌표/도보시간이며 Store 화면용 부산 추천 증거가 아니다.
- `src/ui/dev/ConditionalPlacePreview.tsx`는 개발 전용·합성 조건부 장소 미리보기다. 현행6장 플로우의 renderer도 아니고 공개 빌드 진입도 없으므로 사용하지 않는다. 현재 repo 검색에서6장 native 캡처를 조립하는 전용 실행 entry를 찾지 못했다.
- `KakaoRouteMap.tsx`는 실제 Maps JS SDK를 로드한다. hook host의 fetch 차단만으로 native WebView 네트워크까지 격리됐다고 볼 수 없다. 지도 타일/SDK를 임의 가짜 이미지로 대체하거나 실제 서버를 호출해 빈 경계를 메우지 않았다.
- 따라서 후보 PNG0, 개인정보/internal 도구/실제 UI 일치 **시각 검토 미실행**. 준비 문서 검증과 실제 촬영을 분리한다. 실패 화면/흰 지도/합성 mock을 제출 후보로 저장하지 않았다.
- 제품 미변경: 전체 typecheck/UI/core는 QA-RELEASE-PRELINK-01 단일 실행 결과를 소비한다. 이 세션에서는 반복 실행하지 않았다. 조회 시 `release-prelink-validation.md`는 아직 없으므로 QA 결과를 PASS로 선기록하지 않는다. 작업 기준 HEAD `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f`+공유 dirty tree, 고정 최종 후보 아님.

## 4. 촬영 명령 / 다음 필요한 입력 / 최종 후보 합류

다음 **미확보3항목**만 인계한다: (1) 기존 native 화면을 실제 렌더하는 격리 실행 entry와 clock/guest 저장소 주입 방법, (2) 위 부산 선택에 대한 승인된 exact snapshot·허용된 사진/지도 자원 fixture, (3) WebView 포함 운영 네트워크0을 증명할 경계. 새 프레임워크나 제품 수정이 필요하면 별도 범위 승인 후 진행하며 이번에 만들지 않는다. fixture 촬영이 불가능해 실제 지도 요청을 써야 한다면 호출 범위/예산을 별도로 승인받기 전 중단한다.

위 조건 및 **촬영 실행 승인 후에만** 기기 부팅/앱 실행과 시나리오 로딩을 수행한다. 현재는 실행 명령 준비만 했으며 아래 screenshot도 실행하지 않았다. 새 출력 디렉터리를 먼저 확보하고 파일을 덮어쓰지 않는다.

```sh
mkdir -p /private/tmp/timefit-capture-busan-01
xcrun simctl io 37D18200-C8AC-4F34-9240-FD4D19ABEA25 screenshot --type=png /private/tmp/timefit-capture-busan-01/01-time-setup.png
sips -g pixelWidth -g pixelHeight -g hasAlpha /private/tmp/timefit-capture-busan-01/01-time-setup.png
```

각 화면을 표 순서로 준비 후 파일명만02~06으로 바꿔 같은 명령을 실행한다. 모든 파일1320×2868/alpha 없음/키보드·이메일·실제 알림·정확 좌표·internal 표시0 확인, 원본 hash 기록 및 직접 시각 검토. 스크린샷은 리사이즈로 규격을 맞추지 않고 native 원본을 사용한다. 최종 앱과 다른 화면/제공되지 않는 상태가 있으면 해당 컷 폐기 판정(원본은 감사용 분리 보존).

최종 링크 연결 뒤 빌드 입력 체크: 승인된 URL/registry version·AGE 체크·ICON hash·양 target identity/권한·version/build 중복 확인·public wrapper 환경·내부 도구OFF·proxyON. 기존 `release-build-final.md` SIGNING-PREP-03 절차를 사용하며 이번에 Archive를 만들지 않는다. 사용자 실기기 정상 기능 보고와 이번 캡처 준비를 최종 public 후보 PASS로 합산하지 않는다. 운영 계정·서명·스토어 업로드 승인도 추정하지 않는다.
