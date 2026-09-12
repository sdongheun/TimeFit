# U-LEGACY-COURSE-AUTO-QUERY-01 — UIUX 인계

2026-09-12. 사용자 승인: 현재 상태 보존 테스트 확보 후 과거 자동 조회 정리 진행.

**최신 상태: UIUX 최소 수정·집중11건·전체 회귀·public iOS 번들 검증 완료.** 아래 실패 기록은 수정 전 재현 근거다. 테스트 기대값/skip 변경 없이 통과했으며 출시 배포·실기기 확인은 수행하지 않았다. 최종 인계는 문서 하단.

## 확인한 실패

`test/ui/legacy-course-auto-query.test.mjs`에서 실제 AppFlowProvider를 실행하고 외부 의존성은 메모리 포트로 대체했다. 로그인 복원 및 비로그인→로그인에서 `listSavedCoursesFromRepository`가 각 1회 실행된다. 기대값은 0회다.

테스트 결과: 4개 중 2개 통과, 위 2개 실패. 테스트를 skip하거나 기대값을 1회로 바꾸지 않는다. 이 파일이 포함된 전체 테스트는 기능 수정 전까지 실패하는 red 상태이며 완료/병합 가능한 상태가 아니다.

## UIUX 세션 작업 명령

U-LEGACY-COURSE-AUTO-QUERY-01을 진행하라.

1. 위 테스트를 실행하여 로그인 자동 조회 실패 2건을 먼저 확인한다.
2. `src/ui/AppFlowContext.tsx`의 `refreshSavedCourses` 의존 effect가 수행하는 자동 조회를 제거한다. 현재 코드에서는 `useEffect(() => { void refreshSavedCourses(); }, [refreshSavedCourses]);` 블록이다.
3. 이번에는 `refreshSavedCourses` 함수와 명시 호출, save/replace/remove 계약 및 과거 화면을 삭제하지 않는다. MyCourses의 명시 조회는 별도 제거 단계 전까지 보존한다.
4. 현재 `activeVerifiedCourseStorage.read/write/clear`, Live Activity foreground/pending/알림 동기화, owner lifecycle 재개, GuestImportPanel, 현재 계정 기록/개인화는 변경하지 않는다.
5. 신규 4개 테스트, `current-flow-refactor-safety.test.mjs` 7개, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. React effect 변경이므로 기존 고정 fixture의 화면 실행 검증을 유지하고 iOS 번들 또는 E2E도 확인한다.
6. 변경 파일·테스트 결과·남은 과거 코드 범위를 인계한다. 기능 추가/DB 변경/기존 데이터 삭제/공개 배포는 하지 않는다.

## 이번 세션 인계

- 변경 파일: 신규 테스트와 본 작업 명령만 작성. 앞선 문서/테스트 변경을 보존했다.
- 미변경 계약: 제품 코드·운영 DB·저장 payload·권한·출시 설정 불변.
- 실행: `node --test test/ui/legacy-course-auto-query.test.mjs` → 2 PASS/2 FAIL(기대된 자동 조회 실패). `git diff --check` 확인.
- 다음: 기능 파일 소유자인 UIUX가 위 최소 수정 후 회귀 검증. QA가 실패를 없애기 위해 제품 코드 또는 기대값을 임의 수정하지 않는다.

## UIUX 완료 인수인계 — 2026-09-12

### 1. 변경 파일과 목적

- `src/ui/AppFlowContext.tsx`: `refreshSavedCourses` 의존 effect 4줄만 제거했다. 함수 본문/명시 호출/공개 값과 다른 effect는 변경하지 않았다.
- 본 인계 문서: 수정 전/후 검증과 남은 과거 코드 범위를 기록했다. QA 작성 테스트2개와 다른 세션의 문서/파일 변경은 그대로 보존했다.
- 이전: 로그인 복원·로그인/계정 변경으로 callback이 바뀔 때 legacy 저장 코스 목록을 자동 조회 → 실제 provider fixture에서 기대0/실제1로 2건 실패 → 자동 effect만 제거 → 신규 진행 흐름과 무관한 조회 제거, 기존 명시 계약 보존 → **현행 구현·자동 검증 완료**.

### 2. 유지한 계약

- `refreshSavedCourses`, save/replace/remove 및 MyCourses 진입 조회·당겨서 새로고침·다시 불러오기 유지. replace 후 목록 갱신도 유지했다.
- `activeVerifiedCourseStorage.read/write/clear`, Live Activity foreground/pending/알림 동기화, owner lifecycle 재개, GuestImportPanel, 현재 계정 기록·개인화·계정 격리 변경 없음.
- 과거 화면/저장 데이터 삭제, DB·API·추천 정책·공개 배포·commit/push 없음.

### 3. 실행한 테스트와 결과

- 수정 전 `node --test test/ui/legacy-course-auto-query.test.mjs`: **2 PASS / 2 FAIL**. 로그인 복원/비로그인→로그인에서 각 legacy 조회1회 재현.
- 수정 후 `node --test test/ui/legacy-course-auto-query.test.mjs test/ui/current-flow-refactor-safety.test.mjs`: **11/11 PASS**. 신규4건과 보존7건 원본 기대값 유지. 로그인 복원·계정전환·신규로그인 조회0, 로컬 복원/owner 재개 유지, 명시 조회1회, 1/2곳 이어가기·Live Activity bridge·완료 실패/재시도 연결 확인.
- `npm run test:typecheck`: exit0. `/private/tmp/legacy-auto-query-types.log`.
- `npm run test:ui`: **799건 중798 PASS / 0 FAIL / 기존 skip1**. `/private/tmp/legacy-auto-query-ui.log`.
- `npm test`: **495/495 PASS**, skip0. `/private/tmp/legacy-auto-query-all.log`.
- `node scripts/release-build.cjs export`: public iOS Hermes export exit0. `/private/tmp/legacy-auto-query-export.log`, 산출물 `/private/tmp/timefit-public-export/_expo/static/js/ios/index-e7a5b38e350d928c16f49718871f07bd.hbc`. 설치용 IPA/Archive 생성이나 배포 서명 검증은 아니다.
- `git diff --check`: PASS. 실제 화면/provider handler는 메모리 fixture로 실행했으며 운영 DB/API 호출·실기기/Simulator 실행0.

### 4. 남은 과거 코드·다음 확인

- 과거 savedCourses 상태와 명시 refresh, MyCourses/LegacyResults/Execution/Feedback 및 save/replace/remove 호환 경로는 이번 제거 대상이 아니므로 남겼다. 로그인 시 자동 목록 조회만 제거한 것이며 legacy 전체 제거 완료가 아니다.
- QA는 본11건 및 전체 게이트를 근거로 최소 수정 수락을 검토한다. 후속 과거 코드 제거는 별도 승인/보존 테스트 뒤 진행한다.
- 실기기는 미실행. 필요 시 기존 진행 코스가 있는 기기에서 로그인 전후 홈 이어가기 및 Live Activity 복귀가 유지되는지 확인하되, 이번 변경을 출시 앱에 반영하려면 별도 업데이트 빌드·배포 절차가 필요하다. 본 작업에는 포함하지 않았다.
