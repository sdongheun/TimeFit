# QA-RELEASE-MANUAL-LOCATION-01 — GPS 미사용 출시 후보 검증

2026-09-09 · 기준: [`../integration-decision/release-manual-location.md`](../integration-decision/release-manual-location.md)

**자동 게이트와 동일 입력 Release Simulator 빌드·설치·기동은 PASS다. 최종 iPhone 실기기 화면 흐름은 사용자 확인 대기다.** 이 판정은 위치기반서비스 신고 면제나 법적 적합성 판단이 아니다.

## 후보와 실행 경계

- 브랜치/HEAD: `main` / `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f`
- 제품 소스 digest(`App.tsx`, app/package/plugins/src/supabase): `3932084d09ff8cf1132c7c6dfc017292d515d85855c0c7aa2a7df9359caadb72`
- 공개 빌드 입력: `node scripts/release-build.cjs check` PASS. internal flag off, route proxy on, 값은 기록하지 않음.
- 빌드: `ios/mobile.xcworkspace`, scheme `mobile`, `Release`, `iphonesimulator`, `CODE_SIGNING_ALLOWED=NO` PASS.
- 산출물: `/private/tmp/timefit-manual-qa-release-20260909/Build/Products/Release-iphonesimulator/mobile.app`
- JS bundle SHA-256: `f4f655131e5619f6493318eb57408aa84bcc3a221977903590b1d0e1ca85cdc8`
- 실행 대상: iPhone 17 Pro Max Simulator, iOS 26.5, UDID `37D18200-C8AC-4F34-9240-FD4D19ABEA25`.
- 사용자가 해당 기기의 진행 중·완료된 테스트 코스를 모두 삭제했다고 확인했다. QA는 앱 데이터·운영 데이터를 추가 삭제하지 않았다. 새 빌드는 기존 앱 위에 설치했고 `com.dongheun.mobile` 기동 PID를 확인했다. 앱 제거를 동반하는 완전 초기 설치는 수행하지 않았다.

공유 작업 폴더에는 다른 역할의 미커밋 변경이 함께 있다. 위 digest와 bundle hash가 이번 판정의 고정점이며, 이후 제품 파일이 바뀌면 해당 변경을 포함한 최종 후보에서 다시 판정해야 한다.

## GPS 호출·권한과 네이티브 설정

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 신규 화면·권한 상태별 GPS/권한 호출 | PASS, 호출0 | 실제 `TimeSetupScreen` runtime에 `expo-location` trap을 주입한 fixture에서 granted/denied/undetermined 모두 read0. 수동 출발 전 추천 호출0, 수동 선택 뒤에만 진행 |
| 로그인/guest | PASS | 동일 수동 입력·완료 경로, guest의 외부 학습0과 계정 완료/동의 경계를 실행형 fixture로 확인 |
| WebView·지도·딥링크·legacy | PASS | 검색/핀 adapter, 지도 취소·재선택, 앱→HTTPS→browser 길찾기, legacy GPS 재추천 차단과 복원 gate를 실제 화면/port fixture로 확인 |
| 앱 위치 권한 문자열 | PASS, 0개 | 빌드 `Info.plist`에 `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` 없음 |
| 백그라운드 위치 | PASS, 없음 | 빌드 `Info.plist`에 `UIBackgroundModes` 없음 |
| 위치 모듈 | PASS, 없음 | package/config/runtime import 감사와 산출물 파일 감사에서 `expo-location` 실행 모듈 없음. 테스트 trap·권한 제거 plugin의 문자열만 존재 |
| Live Activity | PASS, 설정 존재 | main `NSSupportsLiveActivities=true`; main/extension 모두 버전 `1.0.0(1)`, iPhone family1, 최소 iOS17.0, privacy manifest 존재 |
| 암호화 설정 | PASS | main `ITSAppUsesNonExemptEncryption=false` |

artifact 감사 결과 server-only secret·private key match0이다. 공개 Supabase/Challenge endpoint는 예상대로 포함되고, shared provider credential match2는 기존 공개 클라이언트 입력 분류다. 이 검사는 침투 테스트나 App Privacy 법적 판정을 대신하지 않는다.

## 기능·회귀 결과

| 실행 | 결과 | 확인 범위 |
| --- | --- | --- |
| 수동 위치·복원·주변·1/2곳·길찾기·Live Activity·완료/기록·동의/guest 집중 suite | **191/191 PASS**, fail/skip0 | 실제 화면 handler와 합성 위치/네트워크/저장 port. GPS·운영 API·운영 DB 호출0 |
| `node --test test/map-transport-ui-contract.test.mjs` | **14/14 PASS** | 출시 화면 계약에서 철회된 위치 권한 조회 기대를 제거하고 GPS/권한 API 부재를 검사 |
| `npm run test:typecheck` | PASS | TypeScript 전체 |
| `npm run test:ui` | PASS | 기존 UI 전체 자동 테스트, exit0 |
| `npm test` | PASS | 전체 discovery runner exit0 |
| `node scripts/release-build.cjs check` | PASS | 공개 입력·내부 flag 격리 |
| 동일 입력 Release Simulator build | PASS | `** BUILD SUCCEEDED **`; 산출물 plist/privacy/identity 감사 포함 |
| Simulator install/launch | PASS | bundle `com.dongheun.mobile` 설치, app container 확인, launch 성공 |

첫 `npm test`에서는 과거 GPS 사용 시절의 `Location.getForegroundPermissionsAsync()`를 요구하는 QA 계약 한 건이 실패했다. 제품 구현을 되돌리지 않고 `test/map-transport-ui-contract.test.mjs`를 현행 결정인 위치 API/권한 요청 부재 계약으로 교체했다. 해당 파일 14/14와 전체 test가 이후 PASS했다.

보존 로그는 `/private/tmp/timefit-manual-qa-core.log`(철회된 기대 실패 재현)와 `/private/tmp/timefit-manual-qa-core-final.log`(수정 후 전체 discovery PASS)다. 집중191·typecheck·UI·Release build·artifact 감사·설치/기동 결과는 이번 QA 도구 실행 기록과 위 산출물/hash로 식별한다. `git diff --check`도 PASS했다.

집중 fixture가 확인한 사용자 흐름은 다음과 같다.

1. 출발지와 최종 목적지는 검색 또는 지도 핀으로 각각 명시 선택한다. 지도 취소·검색 복귀·재선택이 확정된 다른 필드를 덮지 않는다.
2. 기준점 없는 주변 화면은 장소 목록/가까운 순 결과를 만들지 않는다. 수동 기준점 뒤에만 거리 정렬과 목적지 전용 외부 길찾기를 연다.
3. 1곳/2곳 추천, CourseConfirm, 앱/웹 구간 길찾기, 앱과 Live Activity의 도착·출발·완료가 같은 run/stop 순서와 멱등 경계를 유지한다.
4. 명시 완료 뒤 기기 기록을 만들며 로그인 완료 저장·동의 개인화·guest 가져오기 계약을 유지한다. 장소 기록은 센서 기반 방문 인증으로 표현하지 않는다.

## 과거 코스 fixture와 알려진 제한

실사용 과거 코스는 사용자가 이미 삭제했다고 확인했으므로 다시 만들거나 삭제하지 않았다. 합성 fixture에서 다음을 확인했다.

- 새 수동 코스는 `manualLocation.version=1` 증명이 정확한 출발/목적 좌표에 결합되고, 저장→cold read 뒤 추가 확인 없이 같은 코스를 이어간다.
- 표식이 없거나 변조된 과거 active/legacy 코스는 `ManualLocationRestoreGate` 앞에서 지도·connector·외부 길찾기·Live Activity pending consume를 실행하지 않는다. 기본 지도에도 과거 좌표를 전달하지 않으며 자동 재전송0이다.
- 사용자가 출발지와 최종 목적지를 모두 다시 선택하고 두 좌표가 원본과 정확히 같으며 종료시각이 유효할 때만 원본 run을 이어간다. 취소·실패·만료·unknown 종료시각·다른 좌표에서는 전송과 실행을 계속 막고 원본을 삭제하거나 완료 처리하지 않는다.
- 직접 pending consume 우회도 `manual_location_required`로 차단하고 pending을 보존한다.
- **알려진 제한:** 과거 코스에서 좌표를 바꿔 동일 run의 남은 구간을 재계산하는 기능은 없다. 변경 좌표는 허용하지 않으며, 과거 코스의 자유로운 좌표 변경·재계산·완료 복원이 된 것으로 판정하지 않는다. 이는 이번 작업에서 확장하지 않은 명시적 출시 경계다.

DB fixture는 목록 조회만으로 write/route 호출0임을 확인하고, repository의 명시 replace가 전달받은 좌표를 그대로 쓰는 기존 계약도 보존한다. 따라서 자동 전송 차단은 UI 복원 gate에서 검증했으며 DB에서 좌표 출처를 임의 분류하거나 삭제하지 않았다.

## 사용자 iPhone 확인 목록 — 대기

Simulator 설치·기동만으로 실제 iPhone의 권한 팝업, 외부 카카오맵 전환, 잠금 화면 Live Activity를 확인했다고 기록하지 않는다. 최종 iPhone에 같은 출시 후보를 설치한 뒤 아래 한 흐름만 확인하면 된다.

1. 앱 첫 실행과 시간 설정 진입에서 위치 권한 팝업이 나타나지 않고 자동 현재위치 표시·현재위치 버튼이 없는지 확인한다.
2. 출발지와 최종 목적지를 각각 검색/지도 핀으로 선택한다. 한 번 취소 후 복귀하고 다시 선택했을 때 두 필드가 섞이지 않는지 확인한다.
3. 추천을 실행해 1곳 또는 2곳 코스를 시작하고, 구간 길찾기에서 카카오맵 앱 또는 웹 fallback이 올바른 출발·도착으로 열리는지 확인한다.
4. 코스 진행 중 앱을 강제 종료한 뒤 다시 열어 수동 장소 재확인 없이 동일 진행 화면을 이어가는지 확인한다.
5. Live Activity에서 도착→출발을 실행하고 앱으로 돌아왔을 때 같은 run/stop 단계인지 확인한다. 마지막 완료 후 Live Activity가 끝나는지 확인한다.
6. 앱에서 명시 완료하고 기록 탭에 장소 수·분류·체류 측정 상태가 맞게 남는지 확인한다. 로그인 상태라면 동의 상태의 기존 개인화 계약, guest라면 계정 로그인 뒤 기존 가져오기 안내도 한 번 확인한다.
7. 위 흐름 전체에서 iOS 설정의 짜투리 권한 목록에 위치 항목이 새로 생기지 않았는지 확인한다.

보고 형식: `기기/OS · 위치 팝업0 · 수동 선택/취소/재선택 · 추천 장소 수 · 재시작 무확인 복원 · 외부 길찾기 · Live Activity 도착/출발/완료 · 기록 · 설정 위치 항목 없음 · 실패 단계/화면 문구`.

## 완료 인수인계

1. **변경 파일과 목적:** 본 문서를 신규 작성했고 `test/map-transport-ui-contract.test.mjs`의 철회된 GPS 권한 기대를 현행 GPS API 부재 계약으로 갱신했다. 제품 코드·DB·중앙 정책·공개 문서·Connect는 수정하지 않았다.
2. **변경하지 않은 계약:** 수동 좌표의 서버/API 전송, 검색어/핀 주소 처리, 180분·최대2곳, 명시 버튼 기반 도착·출발·완료, 기록/동의/소유권/guest 가져오기/삭제 정책을 유지했다. 과거 좌표의 동일 run 변경·재계산을 추가하지 않았다.
3. **검증:** 집중191, map 계약14, typecheck/UI/core 전체, 공개 입력 검사, Release Simulator build, artifact/native 설정 감사, 설치·기동 PASS. 실제 API 반복 호출·운영 DB 쓰기·운영 데이터 삭제·배포·게시·스토어 업로드/제출0.
4. **다음 결정·위험·재현:** 기술 자동 판정은 PASS이며 최종 출시는 위 iPhone 7단계 결과를 받아야 한다. 후보 제품 파일이나 빌드 입력이 바뀌면 digest를 새로 고정하고 관련 자동 게이트/산출물 감사를 다시 수행한다. 위치 신고 면제 여부는 이 QA 결과로 확정하지 않는다.
