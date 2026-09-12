# U-LEGACY-SCREENS-REMOVE-01 — 과거 네 화면 제거

작성일: 2026-09-13. 개정: R1. 상태: **A 기준점 확보 완료, B QA 준비 대기. 삭제 미실행.**

### A 완료 근거 — 2026-09-13

- 복구 기준 SHA: `955931e` (관련 제품·테스트·문서 변경 포함).
- 역할별 커밋: UIUX `0858431`, QA `06c8139`, 통합 문서 `955931e`.
- 집중 회귀14/14 PASS, `npm run test:typecheck` PASS, `git diff --check` PASS. 이번 커밋 단계에서는 전체 회귀를 재실행하지 않았으며 기존 결과는 검토서에 구분 보존한다.
- 제외: untracked `output/`의 이미지13개. 파일은 삭제하지 않았다. 관련 제품/테스트 변경의 미커밋 잔여 없음.
- push·제품 화면 삭제·DB 변경 없음. 다음 실행은 B `QA-LEGACY-REMOVE-PREP-01`이며 C 직접 시작은 금지한다.

## R1 실행 순서 — 아래 순서가 기존 본문의 담당/완료 조건보다 우선

이전 명령은 기준점 커밋 선행 작업의 담당과 QA 인계 순서를 충분히 명시하지 않았다. 이를 아래 순차 단계로 교체한다. 삭제 범위·DB 보존 정책은 변경하지 않는다. 각 담당자는 자기 단계만 실행하며, 앞 단계의 완료 근거가 없으면 `선행 작업 대기`와 필요한 항목을 보고한다. 대기 상태를 작업 완료로 표시하지 않는다.

| 순서 | 작업 ID | 담당 | 시작 조건 | 완료·인계 조건 |
| --- | --- | --- | --- | --- |
| A | INT-LEGACY-REMOVE-BASELINE-01 | 통합 | 사용자 기준점 커밋 승인 | 관련 변경 역할별 커밋·기준 SHA·보존 테스트 결과 |
| B | QA-LEGACY-REMOVE-PREP-01 | QA | A 기준 SHA 확인 | 삭제 검증 red 재현·보존 테스트 green·교체 케이스 목록 |
| C | U-LEGACY-SCREENS-REMOVE-01 | UIUX | B 준비 완료 | 지정 제품/UI 테스트 변경·타입/집중 검증·QA 인계 |
| D | QA-LEGACY-REMOVE-VERIFY-01 | QA | C 변경 인계 | 범위 밖 관련 테스트 교체·전체 회귀·번들 결과 |
| E | INT-LEGACY-REMOVE-ACCEPT-01 | 통합·사용자 | D 자동 검증 통과 | 실기기 확인 결과와 최종 수락 |

### A. 통합 세션 명령

`INT-LEGACY-REMOVE-BASELINE-01을 진행하라.`

- 문서 정리, 보존 테스트, 자동 조회 제거의 현재 diff와 소유 범위를 확인한다. 확인되지 않은 변경을 임의로 포함하지 않는다.
- 관련 보존 테스트를 실행하고 검토된 문서/QA/UIUX 변경을 역할별 한국어 커밋으로 보존한다. output/과 무관한 변경·비밀값은 제외한다. push는 하지 않는다.
- 마지막 커밋 SHA와 남겨둔 미커밋 파일을 기록한다. 삭제 대상과 겹치는 미커밋 변경이 남으면 소유자 확인 전 B/C를 시작하지 않는다.
- A는 복구 기준점 확보이지 네 화면 삭제가 아니다.

### B. QA 준비 명령

`QA-LEGACY-REMOVE-PREP-01을 진행하라. 기준 SHA는 A 인계에서 확인하라.`

- 기존 보존 테스트가 통과하는지 확인한다.
- 실제 App.tsx 등록/import 및 전용 실행 연결의 제거 목표를 테스트로 작성하고, 현재 코드에서 예상 실패를 확인한다. 제품 코드를 수정하지 않는다.
- 검토서의 기존 테스트를 케이스별로 분류한다: 현재 기능 보존 / 과거 전용 철회 / 현재 경로로 이관 / 시그니처 조정. 수정 담당을 UIUX 또는 QA로 명시한다.
- 신규 제거 검증의 예상 실패 이름과 보존 테스트 통과 결과를 UIUX에 인계한다. **이 단계의 red는 준비 완료이며 제품 삭제 완료가 아니다.**

### C. UIUX 구현 명령

`U-LEGACY-SCREENS-REMOVE-01을 진행하라. A/B 완료 근거를 확인하고 아래 §3의 지정 범위만 제거하라.`

- §3 제품 변경과 UIUX 소유 화면 테스트를 수정한다. QA 소유 테스트는 직접 수정하지 않고 필요한 변경과 실패 원인을 케이스별 인계한다.
- 저장소 호환 Execution 타입과 §4의 공유 코드·DB·기존 데이터는 보존한다.
- 타입 검사와 담당 집중 테스트를 실행한다. 전체 테스트도 실행해 실패를 실제 결함/과거 기대/환경 문제로 분류한다.
- 제품 결함은 수정하고, QA 소유 테스트의 과거 파일 참조 등은 D에 인계한다. 전체 통과를 위해 테스트를 일괄 삭제하거나 다른 역할 경계를 넘지 않는다.
- 완료 표시는 **UIUX 구현 완료·QA 통합 검증 대기**다. 자동 검증 전체 완료 또는 최종 수락으로 표시하지 않는다.

### D. QA 검증 명령

`QA-LEGACY-REMOVE-VERIFY-01을 진행하라. B의 케이스 대응표와 C 인계를 기준으로 검증하라.`

- QA 소유 테스트의 과거 화면 의존 케이스를 교체한다. 현재 기능 검증은 현재 경로에서 유지한다. UI 테스트에 문제가 있으면 UIUX에 인계하고 순차 수정 후 재검증한다.
- 신규 제거 검증, 보존 테스트, 타입 검사, 전체 UI/기본 테스트, git diff --check, public iOS 번들을 §6 명령으로 실행한다.
- 실제 기능 실패는 UIUX에 되돌린다. 기대값 완화·skip 증가·탐색 범위 축소로 통과시키지 않는다.
- 모두 통과하면 **자동 검증 완료·실기기 수락 대기**로 기록한다. 실행하지 못한 항목은 명시한다.

### E. 통합 수락 명령

`INT-LEGACY-REMOVE-ACCEPT-01을 진행하라.`

- 삭제 diff·테스트 대응표·D 로그를 검토하고 사용자에게 §6의 실기기 체크리스트를 제공한다.
- 수정 빌드를 제공할 수 없는 경우 실기기 대기로 남긴다. public JS export만으로 실기기 검증했다고 표시하지 않는다. 설치 빌드 준비는 별도 범위를 확인해 진행한다.
- 실기기 결과까지 확인한 뒤 현행 문서와 수락 상태를 갱신한다. 이 명령은 운영 DB 정리·스토어 업데이트·push를 포함하지 않는다.

현재 실행할 것은 **B**다. A 기준점은 위 완료 근거를 사용한다. 이후 추가 변경이 있다면 기준점 이후 diff를 확인하고 소유자 변경을 보존한다.

## 목적과 기준

현재 출시 기능을 바꾸지 않고 정상 진입점이 없는 과거 네 화면 및 전용 실행 연결을 제거한다. [범위 검토](legacy-four-screen-removal-review.md), [보존 테스트](current-flow-refactor-safety.md), [자동 조회 제거 완료](legacy-course-auto-query-handoff.md)를 먼저 읽는다.

이전: 네 화면 및 전용 상태가 현재 화면과 함께 등록 → 정상 신규 진입점 없이 과거 분기·테스트·저장소 연결만 잔존 → 아래 실행 경계만 제거 → 현재 기능과 과거 구현의 혼동을 줄이기 위함 → **구현 전**. 이전 단계의 명시 refresh 보존은 이번 전용 상태 제거 범위에서는 대체한다. DB 데이터 보존 결정은 대체하지 않는다.

## 1. 시작 전 복구 기준점

- 현재 미커밋 문서·테스트·AppFlowContext 변경이 있으므로 바로 삭제하지 않는다. 역할별 검토된 변경이 커밋되어 있는지 확인하고 기준 SHA를 기록한다.
- 기준 커밋이 없으면 통합 세션에 기준점 커밋을 요청한 뒤 삭제를 시작한다. 다른 역할 파일을 일괄 stage하거나 output/·비밀값·실사용자 데이터를 커밋하지 않는다.
- 이후 추가된 사용자 변경을 보존한다. 복구가 필요해도 reset --hard/일괄 checkout/강제 push하지 않는다. 커밋 제목과 본문은 한국어로 작성한다.
- 단일 작성자 파일 App.tsx/AppFlowContext/nav/mainTabNavigation 동시 편집을 금지한다.

## 2. 삭제 전에 테스트 — B 담당

- `node --test test/ui/current-flow-refactor-safety.test.mjs test/ui/legacy-course-auto-query.test.mjs`로 현재 baseline 확인.
- 실제 App.tsx의 네 화면 등록/import 부재, Home/provider의 전용 legacy 실행 연결 부재를 검증하는 테스트를 먼저 추가해 실패를 확인한다. 문자열 검색만으로 현재 동작 보존을 대신하지 않는다.
- 기존 과거 화면 테스트에서 교체할 케이스와 이유를 목록으로 남긴다. 현재 기능 검증은 유지한다.

## 3. 허용 변경

1. 아래 네 파일 삭제:
   - src/ui/OneStopResultsScreen.tsx
   - src/ui/MyCoursesScreen.tsx
   - src/ui/ExecutionScreen.tsx
   - src/ui/FeedbackScreen.tsx
2. App.tsx에서 네 화면 import/Stack.Screen, Execution 전용 header와 더 이상 사용하는 곳이 없는 해당 import 제거.
3. mainTabNavigation.ts의 resetToBasket/resetToMyCourses 제거.
4. HomeScreen과 activeVerifiedCourseModel에서 legacy 이어가기 분기 제거. 현재 verified/placeholder, 현재 코스 ID·장소 순서·진행 상태 유지.
5. AppFlowContext의 과거 activeCourse/savedCourses 및 refresh/save/replace/remove 전용 상태·함수·값·repository import 제거. 이들만 사용하던 인증 guard 등 import는 참조 확인 후 정리.
6. 관련 UI 테스트를 새 공개 함수 시그니처와 현재 화면으로 조정. nav.ts의 과거 타입은 아래 보존 경계를 지킨다.

## 4. 삭제 금지·소유 경계

- courses/course_stops/course_legs/course_feedback, migration, 운영 DB, AsyncStorage 기존 기록 삭제 금지.
- src/services/courseRepository.ts는 이번에 삭제/수정하지 않는다. RootStackParamList['Execution'] 참조 때문에 필요한 타입 선언은 **비실행 저장소 호환 타입**으로 주석을 남겨 임시 보존한다. 실제 화면 재등록은 금지. 독립 DTO 분리는 DB 세션 후속으로 인계한다.
- execution/schedule.ts와 현재 길찾기 공통 함수, courseCompletionRepository/activitySummary, ownedCourseLifecycle, 현재 기록·개인화는 보존.
- activeVerifiedCourseStorage와 수동 입력 복원 검증, Live Activity의 foreground/pending/알림·완료 처리, GuestImportPanel, latestResults 유지.
- placeFeedback 서비스·로컬 후기·공통 복원 게이트·과거 하위 컴포넌트·엔진 helper의 연쇄 삭제는 이번 범위 아님.
- UI 소유 밖 테스트/코드의 수정이 필요하면 구체적 케이스와 계약을 QA/DB에 인계한다. 타입 오류 해결을 이유로 범위 밖 파일을 임의 삭제하지 않는다.

## 5. 테스트 교체 원칙 — C/D 각 소유 범위에서 수행

- legacy 단독 Execution 유지 기대는 철회한다. 현재 코스가 있으면 CourseConfirm, 없으면 placeholder라는 관찰 결과로 교체.
- legacy-course-auto-query의 명시 refresh 유지 테스트는 전용 API 제거에 맞춰 교체하되 로그인/계정 변경의 과거 조회0·현재 복원/owner 재개 검증 유지.
- 삭제 파일을 직접 읽는 테스트는 해당 케이스만 교체한다. 현재 지도·날짜·ODsay 요청0·복원 안전·로그 경계 검증은 현재 사용 경로에 유지한다.
- 실패를 감추기 위한 파일 전체 삭제, skip 증가, 테스트 탐색 축소 금지. 변경 전후 케이스 대응표 기록.

## 6. 삭제 후 검증과 수락 — D 자동 검증 / E 실기기 수락

1. 신규 제거 검증과 보존 회귀 테스트 통과.
2. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check` 통과. 실패는 실제 손상/과거 기대/실행 환경 문제로 구분해 보고.
3. `node scripts/release-build.cjs export`로 public iOS 번들 확인. 번들은 서명 IPA 또는 실기기 검증을 대신하지 않음.
4. 사용자가 실기기에서 확인할 체크리스트 제공:
   - 수정 전 만든 현재 진행 코스를 수정 빌드에서 재실행해 이어가기. 데이터 삭제·새 설치로 대체하지 않음.
   - guest/회원의 추천→1/2곳 선택→코스→카카오맵 앱/웹→완료→기록.
   - Live Activity 도착·출발·완료와 앱 상태 공유.
   - 로그인/로그아웃/재로그인 후 계정·guest 기록 격리 및 개인화 동의 상태 유지.
5. 실기기 확인 전에는 **자동 검증 완료·실기기 수락 대기**로 기록한다. 실패가 있으면 삭제 완료/무손상으로 판정하지 않는다.

## 7. 최종 인계

변경/삭제 파일과 목적, 보존한 계약, 테스트 대응표·결과·빌드 로그, 실기기 미확인 항목, 남겨둔 타입·저장소 의존성을 기록한다. 통합 문서의 현행 상태 변경은 결과와 함께 통합 세션에 인계한다. DB 정리·추가 리팩터링·App Store 업데이트·push는 이 명령에 포함하지 않는다.
