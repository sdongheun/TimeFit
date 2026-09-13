# U-UNUSED-NOTIFICATIONS-REMOVE-01 — UIUX 인계

2026-09-14. 상태: **담당 알림 제거·집중검증 완료 / QA 서비스 제거 통합 검증 대기**. 전체 서비스 제거 수락을 의미하지 않는다.
기준: [미연결 서비스 제거 명령 3절](../qa-release/unused-services-removal-01.md).

## 1. 변경 파일·근거

시작 HEAD `232a45d4c8ab43c704177d64ec46bc221eb99141`. 시작 당시 REMOVE-03의19개 UI 삭제/테스트·QA map 계약 변경, API5개 서비스 삭제 및 API 테스트, DB courseRepository 삭제 및 DB 테스트/README 변경이 이미 있었다. 관련 untracked 역할 인계/테스트/명령과 output/도 보존했다. 이번 작업에서 다른 역할 변경을 재실행하거나 수정하지 않았다.

- **삭제 `src/services/courseNotifications.ts`**: 이번 명령에서 UIUX 단일 작성자로 명시한1개 파일만 삭제했다. App/index/src/scripts/supabase/plugins의 import/reexport/문자열 literal import()/require()를 AST로 조사해 집합 밖 유입0 확인. rg 이름·키 검색에서도 해당 모듈을 사용하는 제품 호출은 없었다. 테스트의 비실행 mock1개와 금지 정규식은 실제 앱 호출과 구분했다. 임의 조합 문자열·모든 네이티브 동적 로딩까지 무사용을 증명하는 검사는 아니다.
- **추가 `test/ui/unused-notifications-removal.test.mjs`**: 유입0·파일 부재2건, 실제 현재 알림 모듈의 권한 요청/예약/run별 취소·폐기 키 접근0을 고정 메모리/native 포트와 고정 clock으로 검증하는1건.
- **수정 `test/ui/manual-location-restore.test.mjs`**: 폐기 `scheduleCourseNotifications` mock만 제거하고, 기존 `prepareLiveCourseNotifications` mock에 `notification` 호출 계수를 연결했다. 수동 재확정 전 알림0 assertion이 실제 현재 경계를 감시하도록 이관했다. 케이스 삭제0.
- 본 문서. 폐기 모듈 자체를 검증하는 독립 테스트는 발견되지 않아 제거한 테스트 파일/케이스는 없다. 신규3건, 기존 skip 변화0.

제품 파일은 기준 HEAD에서 복구 가능하다. 기존 예약/저장 키/운영 데이터는 삭제하지 않았다.

## 2. 보존 계약·초기화 경계

현재 경로는 `CourseConfirmScreen`의 첫 명시 길찾기 → `prepareLiveCourseNotifications`, `courseProgressComposition` → `liveCourseNotificationPort`, `AppFlowContext` → `addNotificationResponseReceivedListener`/`localProgressEventFromNotificationResponse`다. 해당 파일은 이번 작업에서 미수정이다.

삭제 모듈에는 import 시 `Notifications.setNotificationHandler`를 설정하는 코드가 있었지만 그 import 자체가 현재 진입점에서 없었다. 조사 범위에서 다른 `setNotificationHandler` 호출은 발견되지 않았다. 이를 현재 동작 중인 초기화로 오인해 이동하거나 새 handler를 추가하지 않았다. 권한 설명/요청·예약·취소와 응답 listener 경로는 기존 구현 그대로다. 화면 표시/OS 정책까지 이번 정적 조사만으로 보장하지 않는다.

`@timefit/course-notification-ids`를 실제 기기에서 읽거나 취소·삭제·이전하지 않았다. 새 fixture는 해당 이름의 **가상 메모리 키**를 넣어 현재 알림 경로가 접근하지 않고 원본 값을 유지함을 검증한다. 현재 live-course-notifications v1/v2 registry·권한 설명 키·run/revision 소유권·부분 예약 실패/정확 취소/Live Activity 종료를 보존했다. GPS/180분/2곳·학습·기록·복원·계정/동의·DB/native·공급자 정책 미수정.

이전: 과거 진행 알림 코드와 전용 저장 키가 남음 → 실제 진입/호출 부재 재확인 → 모듈1개와 비실행 mock만 제거, 현재 알림 경계 검증 강화 → 기존 예약을 건드리지 않고 코드 역할을 정리 → **담당 구현 현행 / 전체 QA 대기**. 저장 키 정리 도구를 새로 만드는 결정이 아니다.

## 3. 실행 검증

- 삭제 전 유입/부재 목표: **1 PASS /1 FAIL**, `/private/tmp/unused-notifications-red.log`.
- 삭제 전 현재 알림·진행·종료·수동 복원: **31/31 PASS**, `/private/tmp/unused-notifications-before.log`.
- 삭제 후 집중5파일: **34/34 PASS, skip0**, `/private/tmp/unused-notifications-focus.log`. `node --import tsx --test`로 unused-notifications-removal/live-activity-notification-ownership/live-activity-course-runtime/live-activity-terminal-cleanup/manual-location-restore 실행.
- `npm run test:typecheck`: PASS(exit0), `/private/tmp/unused-notifications-types.log`.
- `npm run test:ui`: **799건 /780 PASS /18 FAIL /기존 skip1**, `/private/tmp/unused-notifications-ui.log`. 날짜 repository12건·QA ODsay reader2건·QA180분 legacy save/date-less4건 모두 삭제된 courseRepository 참조 오류다. 알림 전용 실패는 없다.
- `npm test`: **548건 /527 PASS /21 FAIL /skip0**, `/private/tmp/unused-notifications-all.log`. 위18건 + `test/course-replan-contract.test.mjs`, `test/mixed-travel-contract.test.mjs` top-level repository 읽기 실패2건 + 하위 집계1건. 파일 로딩 실패 때문에 발견 수가 달라졌으므로 통과 비율로 전체 무손상을 주장하지 않는다.
- `node scripts/release-build.cjs export`: PASS(exit0), `/private/tmp/unused-notifications-export.log`. public iOS 번들 생성이며 서명·실기기 검증을 대신하지 않는다.
  - 산출물: `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`.
- `git diff --check`: PASS, 최종 인계 포함. 추가3건 외 테스트 삭제·skip·탐색 설정 변경0.

## 4. QA 인계·미확인

이번 알림 모듈에 대한 QA 직접 read/import 잔여는 발견되지 않았다. `map-transport-ui-contract`의 `scheduleCourseNotifications` 금지 정규식은 파일을 로딩하지 않는 회귀 assertion이므로 유지했다.

전체 회귀에서 다른 세션이 제거한 `courseRepository.ts`를 읽는 UI/QA 참조가 나타났다. 알림 제거 결함으로 분류하지 않으며 DB 인계와 대조하여 QA가 정리한다. UIUX는 이번 단일 알림 작업을 날짜·저장소 정리로 확장하지 않았다. `course-date-screen-boundary`의 폐기 repository12건과 실제 현재 CourseConfirm8건은 혼합되어 있으므로 통째로 삭제하지 않는다. QA ODsay 과거 reader 검증은 DB/API 인계대로 삭제된 reader 의존과 현재 API/경로 불변을 구별한다. loader/발견 범위/skip 변경으로 실패를 숨기지 않는다.

`test/ui/qa-release-three-hour-save-date.test.mjs`의 QA180분 legacy save/date-less4건도 폐기 repository 소비와 현행180분/자정/만료/Live Activity 계약을 구별해 이관한다. root course-replan/mixed-travel 파일은 repository 소스 읽기만 정리하고 보존 SQL/현재 화면/각 leg mode 검증을 유지한다. 알림 파일 제거를 되돌려 이 실패들을 해결하려 하지 않는다.

자동 통합 게이트 통과 뒤 수정 빌드의 명시 길찾기→알림 권한·도착/출발·종료 및 Live Activity 공유를 최소 확인한다. 이번 실제 알림 허용/예약/취소, Simulator/실기기·실제 API·운영 DB·Archive/IPA·스토어는 미실행이다. 기존 예약을 검사 목적으로 지우지 않으며 commit/push/배포도 하지 않았다.
