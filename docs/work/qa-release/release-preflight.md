# QA-RELEASE-PREFLIGHT-01 — Release 사전 감사

기준일: 2026-09-07. 상태: **감사 완료 / 제출 가능 판정 보류 / 추가 실패 fixture 1건 UIUX 반환**.

## 범위·증거

- 현행 기준: `docs/05_release/release-readiness-2026-09.md` 및 출시준비 체크리스트의 2026-09-07 절. Live Activity 로컬 기능은 유지하고 서버 체류 개인화 확장은 보류한다.
- HEAD `e1f803e439e5cada825cc025f9c99fc475cc39ae`, dirty worktree. App/app.json, Live Activity·CourseConfirm·Profile·TimeSetup과 관련 테스트의 미커밋 변경을 포함한다. HEAD만으로 이번 실행물을 재현했다고 주장하지 않는다.
- 실제 API·운영 Supabase·Simulator 조작·앱 삭제·설치·원격 게시·서명 변경·Archive·commit/push는 수행하지 않았다. 비밀 env 값과 사용자 데이터를 읽거나 출력하지 않았다.
- 임시 로그: `/private/tmp/timefit-release-preflight-RmIwiN/`. 기존 export/build 인수인계는 과거 증거이며 이번 자동 실행과 구분한다.

## 자동 회귀와 신규 반례

| 명령 | 결과 | 로그 |
| --- | --- | --- |
| `npm run test:typecheck` | PASS, exit0 | `typecheck.log` |
| `npm run test:ui` — 신규 반례 추가 전 | 494 total / PASS493 / FAIL0 / 기존 SKIP1 | 실행 출력 확인; 최종 재실행으로 동일 로그 갱신 |
| `npm test` | PASS241 / FAIL0 / SKIP0 | `core.log` |
| `node --test test/ui/release-preflight-handoff.test.mjs` | FAIL1, 실제 screen handler의 갱신 복구 누락 재현 | `handoff-repro.log` |
| `npm run test:ui` — 신규 반례 포함 최종 | 495 total / PASS493 / FAIL1 / 기존 SKIP1 | `ui-approved.log` |

기존 skip은 `철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다` 1개 그대로다. 삭제/새 skip으로 수를 맞추지 않았다. 9/5 setup 게이트(UI352/core161)보다 증가했으며 이후 Live Activity·알림·복구·주변/설정 fixture를 포함한다. 회귀 이름과 기존 파일을 유지했다. UI 최초 실행은 tsx IPC의 sandbox `listen EPERM`으로 시작 전 차단됐고 승인 후 같은 명령으로 실행했다(`ui.log`). 신규 fixture 초기 구성의 RN module override 누락은 QA fixture에서 보완했으며 최종 실패는 revision 기대값이다.

### P0 — 실패 handoff에서 성공 상태가 남는 경계

- 담당: UIUX, 기존 `U-LIVE-ACTIVITY-01`의 foreground handoff 연결. 엔진/API 조건을 완화해서 해결하지 않는다.
- 근거: `src/ui/CourseConfirmScreen.tsx:175`의 `applyLiveHandoff`가 `afterHandoff({opened:true})`를 호출한다. `openTravel`은 external open 전에 이 callback을 실행한다(`:165`, `:203`). runtime `courseProgressRuntimeModel.ts:189`는 이를 `handoff_succeeded` 이벤트로 만들어 영속/Activity/알림을 갱신한다. 외부 실패 때 `:206`의 cleanup은 `started/started_without_activity`만 포함하고 `updated`는 제외한다.
- 재현: 기존 local 상태 revision1 → production screen의 길찾기 handler → fake runtime `updated`/revision2 → fake Kakao `failed`. 앱 progress.routeOpened는 false지만 local revision2가 남는다. 기대는 외부 실패 뒤 준비 전 revision1 보존(또는 성공 상태와 분리된 준비 상태); actual revision2. `test/ui/release-preflight-handoff.test.mjs:43`에서 실패한다.
- 이 fixture는 실제 화면 handler와 fake runtime/adapter 경계를 실행한다. 네이티브에서 실제 유령 이동을 관찰했다고 주장하지 않는다. runtime의 성공 이벤트 저장은 별도로 소스를 대조했다. 기존 screen fixture는 신규 `started` rollback만 검증해 이 반례를 놓쳤다.
- 합격조건: foreground Activity 준비는 허용하되 실제 handoff 성공/체류 출발 기록과 분리하고, 기존 state 갱신 실패·신규 시작 실패·재시도·중복·cold 복구에서 성공 기록이 남지 않게 한다. 위 실패 fixture와 기존 회귀 통과 후 출시 판정을 재개한다. QA는 제품 코드를 수정하지 않았다.

## Release 설정·산출물 감사

| 항목 | 확인 사실 | 판정·담당/합격조건 |
| --- | --- | --- |
| 앱 표시명 | app.json name/slug와 main Info.plist DisplayName=`mobile`; extension 표시명=TimeFit | P1 사용자·통합: 최종 표시명 결정 후 UIUX/native 동기화 |
| 지원 기기 | supportsTablet=true, main/extension family=`1,2`, iPad 가로 orientation 포함 | P0 제출 판단 미확인: iPhone 전용 결정 또는 iPad 레이아웃/스토어 증거 필요. 임의로 끄지 않음 |
| 최소 OS | app.json 및 Xcode main/extension Release deployment target17.0. 소스 plist의 LSMinimumSystemVersion12.0은 최종 iOS MinimumOSVersion 증거가 아님 | 소스 일치. 최종 archive의 MinimumOSVersion 확인 필요 |
| 버전·서명 | main plist1.0.0(1), extension MARKETING_VERSION1.0.0/build1, 동일 team·App Group. main build setting MARKETING_VERSION1.0과 literal plist1.0.0 차이 있음 | P1 단일 버전 원천 정리 권장. 최종 main/embedded extension 버전·배포 provisioning·서명 일치 미확인(P0 제출 게이트) |
| 개발 도구 | TimeSetup SHOW_TEST_CLOCK은 __DEV__. QA/진단은 기존 internal diagnostics flag로 Release에서도 활성화 가능; 진단 native bridge도 Release 포함 | production 비노출은 flag가 꺼진 artifact에서 확인해야 함. 현재 Release env/서명 artifact 미확인. internal Release 성공을 public Release 비노출 증거로 쓰지 않음 |
| 고정 시각·fixture | production 숨김 기존 실행형 테스트 PASS, QA launcher와 A3 native debug fixture 경계 테스트 포함 | 소스/fixture PASS, 최종 JS bundle의 실제 public env·진입 불가 증거는 미확인 |
| JS export | 기존 `timefit-live-handoff-export.TO7QKZ/metadata.json`은 9/6 17:52 KST. CourseConfirm 변경은 같은 날20:52로 이후 | 해당 export를 현행 전체 Release 증거로 승격하지 않음. 신규 export/빌드 미실행; 실패 경계 반환 후 최종 artifact 생성 필요 |
| native build | UIUX 인수인계에 과거 Debug/Release 컴파일 PASS와 generic iOS build PASS 존재 | 배포 Archive·Validate·TestFlight 증거와 다름. 현재 dirty revision에 대응하는 서명 Archive 미확인 |
| privacy manifest | ios/mobile/PrivacyInfo.xcprivacy 존재: FileTimestamp C617.1, UserDefaults CA92.1, SystemBootTime35F9.1; tracking=false, collected types 빈 배열. Pods SDK manifests도 존재 | 존재만 PASS. SDK 전체와 shared App Group 사용 reason 적합성, 최종 병합 archive/required-reason API 감사는 미확인. 빈 배열을 앱 실제 수집0으로 해석하지 않음. DB/API 사실표와 대조 필요 |
| 공개 안내·지원 | ProfileScreen:99~100 개인정보/위치 안내·문의가 `준비 중`이며 공개 링크 없음 | P0 통합/운영자→UIUX: 실제 공개 URL·연락처 확정과 앱 연결·접근 확인 |
| 계정·서버 | 로그인 화면 존재; 로컬 Live Activity composition은 native/AsyncStorage와 알림만 연결, 서버 업로드 port 없음 | 원격 삭제/RLS/전체 데이터 흐름/개인화 비활성 최종 판정은 RELEASE-DATA-AUDIT-01 담당. 단순 검색 부재로 전 앱 서버 전송0을 선언하지 않음 |
| 스토어·암호화 | 현재 확인한 app.json/plist에 export compliance 선언 없음; Connect/스토어 자산/심사 계정은 확인하지 않음 | P0 제출 증거 미확인: 운영자가 Connect 응답·자산·심사 입력·공개 URL과 서명 artifact 확보. 선언 부재 자체를 법규 위반으로 단정하지 않음 |

외부 정책의 최종 적합성/법률 판정은 이번 로컬 감사 범위가 아니다. 최신 공식 기준 재확인은 출시 계획의 최종 제출 단계로 남긴다.

## 일반 production 흐름과 기존 fixture 매핑

| 흐름·반례 | 기존 실행형 테스트 | 자동/실기기 구분 |
| --- | --- | --- |
| 수동 위치·시간·권한 거절/GPS 실패·늦은 응답 | unified-time-route-setup, location-picker-recovery-model, location-search-interaction | PASS; setup 1~4 및 검색 후속 사용자 수락 유지 |
| 추천1/2곳·A 취소·역선택·빈 결과·route 실패 | two-stop-production-session, verified-course-results, release-one-stop-more-results, recommendation-runtime-boundary | 기존 PASS; 추가 handoff 실패1 별도 |
| 장소 상세→선택→코스/지도→길찾기 | place-course-screen-runtime, place-detail-and-optimized-course-flow, course-v1-route-geometry | 기존 PASS; QA-PLACE-COURSE-FLOW-01/GEOMETRY-02 기존 사용자 수락 유지 |
| 도착/출발·snooze·stale·중복·종료·알림 소유권 | live-activity-course-runtime/local-progress/pending-navigation/terminal-cleanup/notification-ownership | 기존 PASS; OS 실제 발화/잠금/권한은 fixture와 구분 |
| 완료1건·저장 실패·기록·계정 전환 | course-completion-history, runtime-course-auth-guard, profile-settings-screen | PASS; 기존 비로그인 완료·A/B guard 사용자 수락 유지 |
| 주변 둘러보기·지도/시트·실패 대안 | nearby-browse/nearby-browse-screen/nearby-browse-sheet-layout, location-selection-model | PASS; release-uiux-checklist의 지도/시트 사용자 수락 유지 |
| 재실행·진행 복구·terminal 정리 | active-verified-course-resume, live-activity-terminal-cleanup/pending-navigation | PASS; 최종 Release cold 복구 OS 관찰은 미확인 |

파일명은 `test/ui/` 기준이다. 기존 통과를 최종 Release artifact의 native 전수 검증으로 확대하지 않는다.

## 실기기 미확인 — 수정·최종 artifact 뒤 한 묶음만

출시 체크리스트 9/7의 `.5` 핵심 Live Activity 사용자 통과와 setup·지도·장소/코스·완료의 기존 수락을 유지한다. 과거 QA-LIVE-LOCAL 문서의 `미실행`을 근거로 전부 다시 요청하지 않는다. 현재는 P0 반례가 있어 아래 절차를 즉시 요청하지 않는다.

1. 동일 최종 Release에서 **미회수인 항목만**: 2곳 다음 구간/잠금 action→Kakao 복귀→완료1건과 Activity/알림 잔존 없음. `.5`에서 이미 확인된 동일 항목은 재사용한다.
2. 알림 또는 Activity 거절에서도 길찾기 계속, 잠금 상태 알림/snooze 실제 발화와 1회 제한. 강제 backend 장애는 재현하지 않는다.
3. 앱 종료→cold 복귀의 동일 코스/단계와 완료 후 재실행 cleanup. 앱 삭제하지 않는다.
4. Kakao 미설치 환경의 HTTPS/browser fallback과 돌아오기, 실제 네트워크 단절·지도 실패·위치 거절의 수동 대안. 기존 설치된 Kakao 성공은 반복하지 않는다. 미설치 기기가 없으면 미확인으로 유지한다.

P1: 작은 화면/큰 글씨/VoiceOver·키보드 미세 타이밍·iPad(지원 유지 시 필수)의 별도 증거. 후속 개선: 오래된 QA README/보드의 setup `실행 가능`·Live Activity 전체 서버 게이트 상태를 통합 담당이 현행 인수인계와 동기화. 무스크롤 수락 배치 재설계 요구 없음.

## 완료 인수인계

- 변경: 이 감사 보고서와 `test/ui/release-preflight-handoff.test.mjs`(빠진 실패 반례)만 추가.
- 불변: 제품/엔진/API/DB/카탈로그/설정/기존 UIUX 테스트/중앙 기준과 사용자 수락을 보존했다.
- 검증: 기존 회귀 PASS, 신규 실패1을 skip 없이 보존. 최종 UI는 FAIL1이므로 출시 자동 게이트 **미통과**다. `git diff --check` 확인.
- 다음 담당: UIUX는 handoff 준비/성공 분리와 기존 updated 실패를 보완, DB/API는 데이터 사실표, 통합/사용자는 표시명·지원기기·공개 URL과 최종 제출 증거를 결정한다. 승인 없는 배포·Archive·계정 변경은 하지 않았다.
