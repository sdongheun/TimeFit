# 과거 네 화면 제거 범위 검토

2026-09-12 / 상태: 검토·보존 테스트 보강 완료, 제품 삭제 미실행.

## 근거와 권장 범위

현재 신규 진입은 Home→TimeSetup→Results→PlaceDetail/CourseConfirm이다. LegacyResults의 reset helper에 제품 호출자가 없고, MyCourses/Execution/Feedback는 서로 연결된다. 홈의 legacy 분기는 메모리 activeCourse가 필요하지만 setter는 과거 화면들에만 있다. NavigationContainer에 초기 저장 navigation state 또는 legacy 딥링크 등록은 없다. Live Activity bridge는 CourseConfirm으로만 이동한다. 자동 과거 조회는 U-LEGACY-COURSE-AUTO-QUERY-01로 제거됐다.

### 다음 UIUX 단계에서 제거할 실행 경계

- `OneStopResultsScreen.tsx`, `MyCoursesScreen.tsx`, `ExecutionScreen.tsx`, `FeedbackScreen.tsx` 네 화면.
- `App.tsx`의 해당 import/Stack.Screen 및 Execution 전용 header와 그 전용 import.
- `mainTabNavigation.ts`의 resetToBasket/resetToMyCourses.
- HomeScreen의 과거 activeCourse 소비·legacy 버튼 분기, activeVerifiedCourseModel의 legacy projection 분기. 현재 verified/placeholder 동작은 보존.
- AppFlowContext의 과거 activeCourse/savedCourses 및 전용 refresh/save/replace/remove 상태·함수·repository import. 현재 latestResults, verified 진행/복원·owner lifecycle·Live Activity·GuestImportPanel 보존.

### 이번 화면 제거와 분리할 의존성

- `courseRepository.ts`가 `RootStackParamList['Execution']`을 사용한다. UI route 타입을 먼저 없애면 보존하는 저장소가 타입 오류를 낸다. **이번에는 해당 타입 선언을 비실행 호환 타입으로 명시해 남기고**, 후속 DB·저장소 세션에서 독립 DTO로 분리한 뒤 제거한다. 타입 존치가 실제 Stack.Screen 재등록을 뜻하지 않는다.
- `courses/course_stops/course_legs/course_feedback` 및 관리·탈퇴 SQL 참조와 기존 데이터: 삭제하지 않는다. 과거 저장소 실행 코드 제거도 DB 역할의 별도 작업이다.
- `execution/schedule.ts`: 현재 CourseConfirm이 길찾기 함수를 사용하므로 파일/폴더 일괄 삭제 금지.
- courseCompletionRepository/activitySummary/ownedCourseLifecycle/개인화 및 activeVerifiedCourseStorage: 현재 사용 중이므로 보존.
- placeFeedback 서비스/기존 로컬 후기, 기존 완료 기록의 호환 reader, ManualLocationRestoreGate: 이번에 데이터 정리 또는 공통 호환 제거로 확대하지 않는다.
- 과거 화면의 하위 표시 컴포넌트·엔진 helper는 우선 보존한다. orphan이라는 추정만으로 연쇄 삭제하지 않는다.

## 기존 테스트 교체 대상

- `active-verified-course-resume.test.ts`의 legacy 단독 Execution 기대: 제거 결정 후 현재 verified/placeholder 기대와 새 API 시그니처에 맞게 교체. 현재 진행 보존 케이스는 유지.
- `legacy-course-auto-query.test.mjs`의 명시 refresh 유지 케이스: 이전 자동 조회 제거 단계 한정 계약이다. 전용 API 제거 후에는 provider의 legacy port 접근 0회/현재 복원·owner 재개 보존 검증으로 교체.
- 아래 파일은 과거 화면 직접 실행·문자열 검사가 섞여 있으므로 테스트 파일 전체를 삭제하지 말고 해당 케이스만 분리한다:
  `manual-location-restore.test.mjs`, `course-date-screen-boundary.test.mjs`, `odsay-removal-screen.test.mjs`, `qa-odsay-removal-execution.test.mjs`, `release-exit-logs.test.mjs`, `mixed-travel-contract.test.mjs`, `course-replan-contract.test.mjs`, `map-transport-ui-contract.test.mjs`.
- `main-stack-navigation.test.mjs`의 가상 route 목록에서 MyCourses 제거. 현재 추천·상세·뒤로가기·탭 검증 유지.
- 타입 변경에 따라 실제 시그니처 호출은 수정할 수 있지만, 실패를 숨기기 위한 skip/현재 동작 기대값 완화 금지.

## 이번 테스트 보강

`test/ui/current-flow-refactor-safety.test.mjs`에 3건 추가(기존7→10).

1. guest Home을 실제 TSX hook host로 실행: 과거 상태 필드 없이 설정·현재 코스·로그인·주변/기록/내정보 이동.
2. account Home의 같은 경계와 프로필 이동.
3. 과거 네 route를 등록하지 않은 실제 StackRouter에서 현재 상세/코스 확인 왕복과 네 탭 reset.

모두 현재 코드에서 통과하는 보존 테스트다. **실제 App.tsx에서 네 화면이 제거됐음을 검증한 것은 아니다.** 구현 직전에 삭제 목표의 등록/import 부재 검증을 먼저 추가하고 red→green을 확인해야 한다. 실제 기기 재시작/잠금화면 동작은 별도 실기기 확인이다.

## 인계

- 검증: 보존 테스트10/10, 타입 검사 통과, UI801 PASS/기존 skip1、실패0, 기본498 PASS/실패0, git diff --check 통과. 전체 테스트 숫자는 서로 합산하지 않는다. 운영 호출·실기기 실행 없음.
- 변경: 테스트 보강 및 본 검토 문서. 제품 코드·DB·기존 미커밋 문서 변경 보존.
- 정책: 현재 추천·계정·기록·Live Activity 동작 불변. 신규 저장소/DB 삭제 승인으로 확대하지 않음.
- 결정 필요: 위 실행 화면·전용 상태 제거 범위로 UIUX 구현 시작 승인. 운영 데이터 보유 여부는 이번 정적 검사로 판정하지 않았다.
- 위험: 전용 타입과 공유 함수까지 일괄 삭제하거나 과거 화면 테스트 파일 전체를 지우면 현재 회귀 보호를 잃는다.
