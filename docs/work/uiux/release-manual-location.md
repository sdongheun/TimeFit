# U-RELEASE-MANUAL-LOCATION-01 — UIUX 인수인계

최신 후속: 아래 **U-MANUAL-LOCATION-RESTORE-01 인수인계** 참조. 선행의 출처 불명 자동 전송 위험은 공통 재선택 경계로 차단했다. 좌표가 달라진 동일 run 재검증/복원은 확장하지 않고 원본 보존·실행 차단의 최소 대안으로 반환한다. 전체 수락·최종 QA 완료를 뜻하지 않는다.

2026-09-09. 실행 기준: [수동 장소 선택 전환 결정](../integration-decision/release-manual-location.md).

**신규 자동 측위·권한 entry 제거와 집중 검증 완료. 과거 출처 불명 활성/저장 코스의 재전송 처리 결정은 통합 대기. 전체 출시 전환·QA·실기기 PASS가 아니다.**

## 1. 변경 파일과 목적

이전: 허용 GPS로 시간 설정 출발지/주변 기준점 자동 채움, 검색의 현위치 선택, 지도 카메라 GPS 요청, 내정보 위치 권한 조회, legacy GPS 재추천 → 관찰: 검색/핀만 사용하는 출시 결정과 충돌하고 이미 허용된 기기에서도 자동 조회됨 → 교체: 명시 검색/핀 선택만 입력으로 사용, 선택 좌표 카메라, 위치 권한/모듈 제거 → 이유: 자동 측위 없는 출시 입력 경계 → **현행 구현, 과거 GPS 기대값 철회**.

### 제품/UI

- `src/ui/TimeSetupScreen.tsx`: 허용 권한 조회/초기 GPS와 주소 역조회 제거. 출발 미선택 시 추천 불가, device 출처 입력 거절, 신규 session에 deviceLocationSnapshot을 생성하지 않음. 목적지/출발지 선택 분리와 취소/재선택 유지.
- `src/ui/PlacePicker.tsx`: 현위치 버튼/요청 제거, 검색 아래 지도 선택이 남은 행 폭 사용. 과거 device draft는 확정 CTA를 노출하거나 부모에 전달하지 않음. 일반 검색·주소·수동 확정 유지.
- `src/ui/locationPickerRecoveryModel.ts`: 지도 초기 중심은 해당 수동 선택(목적지 없음이면 출발지) 또는 부산 기본 보기. 출발지 미선택을 다른 좌표로 암묵 확정하지 않음.
- `src/ui/MapPlacePicker.tsx`: 기본 지도 중심은 보기일 뿐. GPS 카메라 버튼 제거, 핀의 명시 확정/주소 실패 시 좌표 확정 경계 유지.
- `src/ui/MapCameraButton.tsx`, `src/ui/KakaoRouteMap.tsx`: 공급된 선택 장소로 지도만 이동. 유효 점이 없으면 버튼 없음. 위치 API/권한/위치 실패 팝업 없음. embedded 지도 상단 배치 유지.
- `src/ui/NearbyBrowseScreen.tsx`: 기준점 없는 초기 상태, 자동 조회/현위치 재조회 제거. 수동 선택 이후만 3km 목록/지도 생성. 카메라는 선택 기준점만 이동. 빈 목록의 선택 버튼도 상단 검색과 같은 draft 시작 handler를 사용하도록 수정(기존 handler는 closed draft를 열기만 함). 시트 드래그·플로팅 탭바 배치 유지.
- `src/ui/profileSettingsPort.ts`, `src/ui/ProfileScreen.tsx`: 위치 권한 조회/표시 제거, 알림·Live Activity 권한은 유지.
- `src/ui/ExecutionScreen.tsx`: 기존 GPS 재추천 본문/의존 제거. 코스 변경 entry는 현재 코스를 보존하며 메인의 수동 시간 설정을 안내하고, GPS/엔진 호출·LegacyResults 전환을 하지 않음. 새 legacy 재추천 기능을 만들지 않음.
- `src/ui/placeDetailModel.ts`, `src/ui/PlaceDetailScreen.tsx`: 과거 `deviceLocationSnapshot`을 현재위치 마커로 지도에 재전달하지 않음. GPS 실패 설명 제거. 선택 출발지/장소 마커 유지, 원본 저장 데이터 삭제 없음.

### 설정/네이티브

- `app.json`: expo-location plugin 제거, `plugins/withoutLocationPermissions.cjs` 연결.
- `plugins/withoutLocationPermissions.cjs`: non-clean prebuild에서도 과거 NSLocation usage key 4종과 background `location`만 제거. 다른 background mode/Live Activity 설정 보존, 멱등.
- `package.json`, `package-lock.json`: expo-location 의존만 제거(각 1줄/13줄 삭제). npm이 보고한 설치 트리 재구성은 lock의 다른 버전 변경으로 반영되지 않음.
- 로컬 iOS 생성물(기존 ignored 경로): `ios/mobile/Info.plist`, `ios/Podfile.lock`, `ios/Pods` 프로젝트/지원 파일 및 `ExpoModulesProvider.swift`를 공개 prebuild와 pod install로 동기화. 기존 앱/Widget Swift·App Group·서명 정책 변경 없음. 이 생성물이 새 설치용 앱 빌드를 의미하지는 않음.

### 화면 테스트

신규 `test/ui/release-manual-location.test.mjs` 및 다음 기존 화면 fixture를 현행 결정으로 갱신:

`location-search-interaction`, `unified-time-route-setup`, `nearby-browse-screen`, `main-map-polish`, `profile-settings-screen`, `place-detail-and-optimized-course-flow`, `place-course-screen-runtime`, `release-exit-logs`, `live-activity-config-plugin`, `course-date-screen-boundary`, `location-picker-recovery-model` (`test/ui/` 아래).

`test/course-replan-contract.test.mjs`는 혼합 파일 중 Execution 화면의 GPS 재추천 기대만 수동 입력 안내/실행 차단으로 갱신했다. migration/repository 계약 테스트 2개는 변경하지 않았다.

legacy 날짜 반복 변경 fixture는 GPS 실행을 다시 살리지 않는다. 실제 Execution의 변경 거절을 검증한 뒤 명시 주입한 결과로 LegacyResults→repository replace/원본 종료시각 회귀를 계속 검증한다. 공개 날짜 계약은 변경하지 않았다.

## 2. 유지 계약·소유 경계

- 추천 엔진/180분·2곳·운영시간·체류·도착 여유/호출 예산·API cache 및 인증 변경0.
- 수동 핀의 기존 역지오코딩과 수동 경로 API 사용 유지. Wi-Fi/기지국/IP 측위 대체0. 주변 길찾기는 목적지-only, 코스/기록/학습 생성 없음.
- 코스 길찾기 클릭 시 이동 의사 저장→Live Activity 시도→앱/웹 열기, 취소/복귀 상태 유지, 실제 전체 열기 실패만 조건부 복구, 재열기 멱등 계약 유지.
- 앱/Live Activity 도착·출발 공유 진행, 명시 도착 이후 체류·학습 증거, 계정 격리/동의/기록/guest 가져오기/완료 멱등/삭제 유지. AppGroup 상태/receipt를 지우지 않음.
- API/DB 인계 전체를 읽고 대조했으나 API·repository·스키마·운영 데이터·중앙 문서·보드 수정0. commit/stage/push/업로드0.
- 호환 순수 타입/도우미의 `gps`/`device` 명칭 일부는 남아 있지만 위치 취득 API가 아니고 제품 GPS 실행 caller는 제거됨. `nav.ts`의 과거 선택 snapshot 필드를 지우거나 기존 데이터 의미를 재분류하지 않음.

## 3. 검증 결과

### 실패 선행

- `/private/tmp/timefit-manual-red.log`: 변경 전 선택 점 카메라 기대 실패, production GPS import 잔존 실패. 같은 실행의 profile fixture는 __DEV__ 환경 오류였으므로 그 실패를 권한 결함 재현 근거로 사용하지 않음. 변경 후 실제 port 테스트에서 주입된 위치 권한 read0을 검증.
- `/private/tmp/timefit-manual-marker-red.log`: 과거 device snapshot이 지도 마커로 전달됨(`expected false / actual true`) 재현 후 제외.
- `/private/tmp/timefit-manual-empty-red.log`: 주변 빈 상태의 선택 버튼에서 draft start 호출0(기대1) 재현 후 공용 handler 연결.

### 집중 자동 검증

```sh
node --import tsx --test test/ui/release-manual-location.test.mjs test/ui/location-search-interaction.test.mjs test/ui/unified-time-route-setup.test.mjs test/ui/nearby-browse-screen.test.mjs test/ui/main-map-polish.test.mjs test/ui/profile-settings-screen.test.mjs test/ui/place-detail-and-optimized-course-flow.test.ts test/ui/place-course-screen-runtime.test.mjs test/ui/release-exit-logs.test.mjs test/ui/live-activity-config-plugin.test.mjs test/ui/course-date-screen-boundary.test.mjs test/ui/location-picker-recovery-model.test.ts test/ui/course-route-start.test.mjs test/ui/release-build-config.test.mjs test/ui/release-native-privacy.test.mjs
```

**215/215 PASS, fail/skip0** (`/private/tmp/timefit-manual-final-focused.log`). 실제 화면 handler와 고정 provider/GPS trap 사용. granted/denied/undetermined에서 setup/picker GPS/권한0, 미선택 추천0, 명시 수동 추천, 주변 기준점 없는 목록0, 선택 카메라, 취소/검색/핀 복귀, 사진/상세·날짜/앱·웹 길찾기 회귀 포함. 이전 집중 실행107 PASS/연결97 PASS는 중간 결과이며 합산하지 않음.

- `npm run test:typecheck`: PASS (`/private/tmp/timefit-manual-type.log`). 기능 변경의 타입 점검이며 QA 최종 동일 후보 검증 대체 아님.
- `git diff --check` 대상 UI/화면 테스트/설정: PASS.
- `node --test test/course-replan-contract.test.mjs`: 3/3 PASS (`/private/tmp/timefit-manual-legacy-contract.log`), GPS 재추천의 철회된 화면 기대를 현행으로 갱신. 위215개와 별도.
- 실제 API·GPS·운영 DB 호출, Simulator/실기기 조작 없음.

### 네이티브 생성 점검(빌드 아님)

- `node scripts/release-build.cjs prebuild`: PASS, 공개 환경 재사용/non-clean/no-install (`/private/tmp/timefit-manual-prebuild.log`). Expo 권장 버전 차이 안내는 있으나 이번 의존 버전 업그레이드 없음.
- `pod install`: 제한 환경 실패 후 승인된 재실행 PASS. `Removing ExpoLocation`, 96 dependencies/95 pods (`/private/tmp/timefit-manual-pods.log`).
- 생성 Info.plist: NSLocation key0, background location0, `NSSupportsLiveActivities=true`, `CFBundleDisplayName=짜투리`, `kakaomap` query 유지, 비면제 암호화false.
- Podfile.lock/ExpoModulesProvider에서 ExpoLocation0. Xcode 앱/확장 iOS17·device family1·Team 유지. 공개 입력 검증 internal flags off/PASS(값 출력 없음).
- **새 iOS build/export/Archive 미실행. 이전 촬영/Simulator 앱은 이번 위치 모듈 제거 후보가 아니므로 QA 빌드 후 재설치 필요.** 명령상 전체 `test:ui`/`npm test`와 최종 iOS 빌드는 QA 단일 실행자에게 인계.

## 4. 잔여 위험·통합 결정·QA 재현

### 과거 좌표: 완료라고 기록하면 안 되는 경계

[API 인계](../external-api/release-manual-location.md)와 [DB 인계](../db-personalization/release-manual-location.md)를 대조했다.

1. `activeVerifiedCourseStorage.ts`는 전체 session/origin을 직렬화·복원한다. `AppFlowContext.tsx` bootstrap read→runtime reconcile→active 복원에 출처 증명이 없다. `deviceLocationSnapshot`의 직접 마커 전달만 이번에 차단했고, `origin`과 같은 좌표라는 이유로 GPS라고 단정하지 않았다.
2. 복원→`CourseConfirmScreen.tsx`의 connector effect는 gap이 있으면 `loadCourseV1WalkConnectors`로 기존 origin/destination을 자동 전송할 수 있다. 상세 지도에도 기존 경로 좌표가 전달된다. 새 GPS 조회0과 과거 좌표 재전송0은 다르다.
3. 코스/Live Activity pending 길찾기는 복원된 session으로 구간을 만들어 명시 출발 후 앱/웹에 전달한다. AppGroup `LocalProgressState`/receipt/pending action 자체는 시간·run/stop/단계 중심이며 새 GPS 취득/좌표 필드를 추가하지 않았다. 그러나 JS의 별도 active snapshot에 남은 좌표 사용 가능성까지 없어진 것은 아니다.
4. `App.tsx`에 MyCourses/Execution legacy stack 등록은 남아 있고 NavigationContainer에 직접 linking 설정은 없다. 정상 탭은 Nearby/기록/내정보지만 legacy MyCourses 행→Execution과 LegacyResults 저장→Execution은 코드에 존재한다. Execution mount의 누락 geometry hydration→precompute/precomputeTransit는 과거 origin/왕복 target 자동 요청 가능. **GPS 재추천 entry는 차단했지만 모든 legacy 복원 요청 비도달을 입증한 것은 아니다.**
5. 완료 기록/guest 가져오기/학습 outbox는 DB 인계대로 최소 명시 기록을 유지하며 일반 기록 삭제 사유가 아니다.

**통합 결정 요청(미구현):** 출처 불명 기존 코스의 표시/진행/완료 기록은 보존하고, 자동 geometry 보충 및 과거 origin/destination을 재전송할 행동 앞에서 수동 재확인을 요구할지 결정한다. 기존 경로/시간 일치와 왕복 마지막 구간에 영향이 있으므로 UI가 새 위치로 임의 교체·강제 종료/초기화하지 않았다. 새 공통 provenance 타입/DB 필드를 임의 추가하지 않았다. 이 결정이 닫히기 전 “과거 GPS 자동 재전송0” 및 전체 출시 전환은 **미완료**다.

### QA·사용자 확인

- 통합 결정 반영 후 동결 후보에서 전체 typecheck/UI/전체 테스트·공개 iOS 빌드 단일 실행.
- 신규 설치와 기존 위치 권한 허용/거절 모두 위치 팝업0·자동 조회0. 로그인/guest 모두 수동 검색/핀, 취소 후 복귀/재선택, 목적지 변경이 출발지를 덮지 않음.
- 미선택 출발 추천0, 미선택 주변은 안내만; 지도 부산 기본 보기를 확정하지 않고 취소하면 미선택 유지. 핀 명시 확정 뒤에만 기준점/목록 생성.
- 1/2곳·최대180분·앱 설치/미설치 길찾기 클릭 시작, 웹 종료 거짓 실패0, 도착/출발/완료와 Live Activity 공유 진행. 주변 목적지 길찾기에서 기록/진행 생성0.
- 과거 active/legacy 코스는 실제 사용자 데이터 대신 합성 fixture로 전송 포트 기록, 통합이 정한 재확인/차단 기대값 검증. 일반 기록/표본 보존.
- 최종 iPhone 위치 팝업 없음/지도/외부 앱 전환/Live Activity는 **실기기 미확인**. 법적 신고 제외·App Privacy 위치항목 전부 아니오를 기술 변경만으로 확정하지 않는다.

---

## U-MANUAL-LOCATION-RESTORE-01 인수인계 — 2026-09-09

사용자의 후속 명령(새 수동 코스 무확인 복원, 과거 코스 좌표 재전송 전 수동 재확정, 큰 재검증 흐름 변경은 최소 대안 인계) 적용. **신규 수동 복원/과거 전송 차단 구현·집중 테스트 완료. 좌표 변경 동일 run 재검증은 미구현·최소 대안 판단 요청.** 최종 QA/출시 문서 갱신 전이다.

이전: GPS 제거 후에도 raw active/legacy snapshot을 그대로 화면에 복원하여 지도·connector/handoff가 과거 좌표 사용 → 관찰: source 증명이 없고 단순 저장만으로 수동 선택 여부 판별 불가 → 교체: 수동 입력 생성 시에만 로컬 입력 버전 표식을 붙이고, 표식 없는 코스는 네트워크 효과가 있는 화면을 mount하기 전에 재선택 → 이유: 새 코스의 이어가기를 반복 확인으로 방해하지 않으면서 과거 원본 보존 → **공통 차단은 현행 구현**, 변경 좌표의 동일 run 이동 재검증은 아래 최소 대안 상태.

### 1. 변경 파일·목적

- `src/ui/manualLocationRestoreModel.ts` 신규: `manualLocation.version=1`과 선택 origin/destination 값에 결합된 **로컬 입력 표식**. null destination(왕복)도 별도로 결합한다. 변조/변경된 좌표·알 수 없는 버전·표식 없음은 자동 허용하지 않음. GPS 분류나 방문/학습 증거가 아니다.
- `src/ui/TimeSetupScreen.tsx`: 새 수동 입력 session을 만들 때만 표식 추가. 이미 있는 추천 session·active 저장본을 읽거나 저장한다고 표식을 붙이지 않는다.
- 기존 `activeVerifiedCourseStorage.ts`의 동일 키/raw serialization 계약을 재사용(파일 수정0). version 표식은 session과 함께 로컬에 보존되므로 새 수동 코스는 cold read 후에도 추가 선택 없이 이어간다. 표식 없는 과거 데이터를 write→read해도 계속 미확정이다. 이전 GPS 제거 빌드에서 만들어졌어도 표식이 없는 코스는 출처 불명으로 취급하며 임의 승격하지 않는다.
- `src/ui/ManualLocationRestoreGate.tsx` 신규: 장소명과 보존 안내만 먼저 표시. 기존 PlacePicker/MapPlacePicker를 사용하여 **출발/최종 목적지를 각각 새로 검색 또는 핀 선택**해야 한다. 과거 좌표/검색어로 미리 채우지 않고 지도는 부산 기본 보기에서 시작한다. 왕복도 최종 복귀점을 별도 선택해야 함. 단순 ‘기존 좌표 승인’ 버튼 없음. 취소·실패·변경 좌표는 삭제/완료/경로 실행0.
- `src/ui/CourseConfirmScreen.tsx`: wrapper가 표식을 검사하고, 과거 코스는 기존 지도·connector·pending/handoff 효과를 가진 content를 mount하지 않음. Home 이어가기/기존 코스 이어가기/LA pending 진입/직접 CourseConfirm 진입이 같은 경계를 사용. 정상 새 session은 기존 content 그대로 실행.
- `src/ui/activeVerifiedCourseModel.ts`, `src/ui/AppFlowContext.tsx`: 현재 identity와 원본 session이 같은지 다시 확인하고, 종료시각 전·새로 선택한 양 끝이 정확히 같은 경우만 session에 표식 부여. courseRunId·course/선택 장소·progress 객체·도착/체류는 유지. 동일 active의 상태 갱신과 기존 로컬 persistence effect를 재사용하며 새 코스를 시작하거나 이전 run을 종료하지 않음.
- `src/ui/ExecutionScreen.tsx`: legacy route params/flow 복원도 content mount 전 같은 gate. repository가 제공한 원본 endsAtIso만 사용. 끝 시각 불명/만료 시 활성 좌표 실행을 허용하지 않음. exact 재선택 후에만 기존 hydration/화면을 실행하며 GPS 재추천 entry 차단은 유지. legacy 재확정 허용은 해당 화면 instance의 동일 params에 한정(서버 반환 데이터에 수동 provenance를 새로 저장하지 않음).
- `src/ui/liveActivity/pendingNavigationHandoffModel.ts`: UI 우회 직접 consume/retry도 표식 없으면 `manual_location_required`로 거절. native pending 상태 claim/clear, open/onOpened 실행 이전에 차단. pending는 보존되며 기존 route bridge는 안전한 CourseConfirm gate로 연결.
- `test/ui/manual-location-restore.test.mjs` 신규. 기존 실제 새 수동 session fixture에 표식을 명시한 파일: `place-course-screen-runtime.test.mjs`, `release-preflight-handoff.test.mjs`, `live-activity-pending-navigation.test.ts`; `unified-time-route-setup.test.mjs`에는 production 입력 표식 생성 assertion 추가.
- `test/ui/course-date-screen-boundary.test.mjs`, `release-exit-logs.test.mjs`, `support/reselectLegacy.mjs`: 실제 gate에서 두 번 새 picker 선택 후 legacy 회귀. 만료 코스는 gate 유지·호출0.
- `test/ui/support/screenRuntime.mjs`: 동일 tree 위치에서 컴포넌트 type/key가 바뀔 때 기존 hook slot/cleanup을 유지하던 하네스 결함 수정. gate→Execution 전환에서 문자열 slot을 ref로 오인하는 오류가 재현됐으며 React의 remount 경계대로 분리. 제품의 조건부 hook 문제를 숨기는 변경 아님(wrapper/content는 별도 컴포넌트).

### 2. 유지 계약

- 서버 schema/migration·API 어댑터·추천 정책/예산·DB repository·운영 데이터 변경0. 로컬 표식은 `buildRecommendationEngineInput`의 명시 투영에 포함되지 않으며 학습/방문 evidence로 사용하지 않음.
- 일반 완료 기록/체류 표본/동의/계정 격리·로그인·완료 멱등·삭제 서비스 변경0. 과거 코스/장소/기록/receipt/pending 삭제0, 강제 종료0. 도착/출발 시간 재생성0.
- 새 수동 코스의 Home 이어가기, 앱/웹 클릭 이동 시작, 재열기/늦은 실패 복구, Live Activity 기존 공유 진행은 유지.
- native Swift/AppGroup schema, app.json/Pods/서명/패키지 이번 후속 변경0. 중앙 문서·보드·출시 문서 변경0. stage/commit/push/배포/스토어 작업0.

### 3. 테스트 결과

실패 선행:

- `/private/tmp/timefit-restore-red.log`: 실제 CourseConfirm/legacy Execution이 `manual-restore-gate` 없이 mount됨을 재현 후 wrapper 차단. 초기 하네스 의존 mock 오류는 보완했으며 최종 red의 두 실패는 gate 부재 assertion이다.
- `/private/tmp/timefit-restore-pending-red.log`: 직접 pending consume가 안전 사유 `manual_location_required`를 반환하지 않음 재현 후 실행기 차단.

집중 실행:

```sh
node --import tsx --test test/ui/manual-location-restore.test.mjs test/ui/place-course-screen-runtime.test.mjs test/ui/release-preflight-handoff.test.mjs test/ui/unified-time-route-setup.test.mjs test/ui/active-verified-course-resume.test.ts test/ui/course-completion-history.test.ts test/ui/course-route-start.test.mjs test/ui/course-date-screen-boundary.test.mjs test/ui/release-exit-logs.test.mjs test/ui/live-activity-pending-navigation.test.ts test/ui/release-manual-location.test.mjs test/ui/course-v1-route-geometry.test.ts test/ui/runtime-course-auth-guard.test.ts
```

**198/198 PASS, fail/skip0**, `/private/tmp/timefit-restore-focused.log`. 신규 복원 fixture10개 포함. GPS/실제 네트워크/운영 DB 없음. 새 수동 raw 저장/읽기와 무확인 화면, 과거 raw 재저장 비승격, 양 끝 결합/왕복, 재선택 취소·changed/expired·stale identity/session, 중복 submit·승인 실패, 기본 지도에 과거 좌표 전달0, LA pending→gate/직접 consume 우회 차단, 기존 날짜/완료/길찾기 회귀.

- `npm run test:typecheck`: PASS, `/private/tmp/timefit-restore-type.log`.
- UI/테스트 대상 `git diff --check`: PASS.
- 중간129 PASS/30 PASS/9 PASS는 최종198에 합산하지 않음.
- **전체 test:ui/npm test·iOS bundle/build·Simulator·실기기 미실행**. 이번 작업 명령의 집중 검증/QA 단일 최종 실행 기준 유지.

### 4. 잔여 위험·최소 대안·다음 담당

**좌표 변경 동일 run 재검증은 미구현.** 기존 v1Session/2곳 엔진 entry는 추천 session에서 새 후보/새 계획을 검증하는 흐름이다. 진행 중 run의 도착/체류 receipt와 remaining route만 교체하는 공개 commit/rollback 계약은 확인되지 않았다. 임의로 새 추천 결과를 기존 courseRunId에 덮으면 이미 확정된 장소 순서·도착/체류·pending revision·알림/완료 입력과 충돌한다. 사용자의 ‘큰 흐름 변경이면 확장하지 말고 최소 대안 인계’에 따라 확장하지 않았다.

현재 최소 대안은:

1. 두 지점을 **새로 검색/핀 선택**했고 기존 양 끝과 정확히 같은 경우만 기존 검증 snapshot 그대로 이어간다. 좌표 오차 허용/근접 동일 추정 없음. 변하지 않은 진행 상태/시각을 보존한다.
2. 하나라도 달라지면 ‘경로를 다시 검증해야 함’ 안내와 원본 보존, 지도/경로/길찾기 실행 차단. 새 좌표로 옛 geometry/minutes를 재사용하지 않음. 메인에서 독립 새 코스를 만드는 기존 흐름은 사용 가능하나 gate가 자동으로 기존 run을 교체하지 않는다.
3. 종료시각 만료/불명도 원본 보존·차단. old legacy는 각 화면 복원 시 재확정이 필요하다. 새 수동 V1 및 재확정된 V1은 session 표식이 로컬 저장되면 다음 재시작 확인 없음. storage write 실패 때 무확인 복원을 보장하지 않고 기존 persistence 정책을 따름(자동 재승격 금지).
4. 표식 없는 이전 코스는 content 전체를 보류하므로 재확정 전 앱 내 도착/완료 및 pending completion 소비도 보류된다. native의 기존 기록/receipt 자체를 지우거나 학습 조건을 소급 변경하지 않는다. 특히 이미 만료된 old pending completion을 위치 재선택 없이 별도 안전하게 마감할지는 추가 결정이 필요하다. 새 수동 코스의 완료 경로는 기존 회귀 통과.

**통합에 요청:** 이 제한된 복원 대안을 출시 기준으로 수락할지, 변경 좌표에서 동일 run의 남은 구간만 재검증하는 별도 계약(원본 종료시각/이미 도착한 장소·체류 보존/알림·pending revision·stale rollback)을 먼저 정의할지 결정한다. 후자는 현재 작업에서 임의 구현하지 않았다. 따라서 본 결과를 모든 과거 코스의 자유로운 위치 변경·완료 복원까지 전부 완료했다고 기록하지 않는다.

**QA 인계:** 위 대안/만료 완료 처리 결정 이후 수정 동결 후보를 대상으로 전체 자동 게이트·공개 iOS 빌드와 최소 iPhone 확인. 새 수동 생성→강제 종료→Home 무확인 이어가기, 합성 old 활성/왕복→Home/LA/legacy 각 gate와 외부 전송0, 취소 원본 유지, exact 재선택 후 기존 단계 복원, changed/만료 실패 시 실행0, 앱/웹 길찾기와 LA 완료를 구분한다. 실제 사용자 코스/DB를 지우거나 운영 재현 표본을 만들지 않는다. 출시 문서는 QA 이후 DOCS 담당이 갱신한다.
