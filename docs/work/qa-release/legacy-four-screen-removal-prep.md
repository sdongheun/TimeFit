# QA-LEGACY-REMOVE-PREP-01 — B 준비 인계

2026-09-13. **B 준비 완료: 제거 목표 RED 5건, 현재 보존 GREEN 14건. 제품 삭제 미실행.** C/D/E 완료나 출시 무손상 수락이 아니다.

## 1. 기준점·범위

기준: `legacy-four-screen-removal-command.md` R1 B, `legacy-four-screen-removal-review.md`, `current-flow-refactor-safety.md`, `legacy-course-auto-query-handoff.md`.

- A 복구 기준 `955931e` 확인. 현재 HEAD `8c57a9cedade6836720a93dfb35c79982f84fbdf`는 A 완료 근거를 기록한 후속 문서 커밋이다.
- `git diff 955931e --stat`에서 작업 명령 문서1개만 변경. 제품/테스트 추가 diff 없음. 착수 당시 untracked는 `output/`뿐이며 보존했다. 기준점과 겹치는 미커밋 제품 변경 없음.
- QA는 B만 수행. 화면 삭제·AppFlow/nav/Home 수정, 저장소/DB/데이터 정리, stage/commit/push, Simulator·실기기·운영 호출 없음.

## 2. 신규 제거 목표와 RED 재현

신규 `test/ui/legacy-four-screen-removal.test.mjs`는 TypeScript AST로 실제 소스의 import/JSX 등록/식별자를 조사한다. 가상 route 목록만 수정해 통과시키지 않는다. 현재 동작 보존은 별도 실행형14건으로 확인한다.

| 예상 실패 이름 | 현재 실패 근거 | C의 목표 |
| --- | --- | --- |
| LEGACY-REMOVE-01 actual App has no retired screen imports | 네 과거 screen import 존재 | 해당 import만 제거 |
| LEGACY-REMOVE-02 actual App has no retired Stack.Screen registrations/header | LegacyResults/MyCourses/Execution/Feedback 등록 존재 | 네 등록·Execution 전용 header 제거, Results/CourseConfirm 유지 |
| LEGACY-REMOVE-03 retired reset helpers and four exclusive screen files are absent | resetToBasket/resetToMyCourses와 네 파일 존재 | 지정 helper·네 파일 제거 |
| LEGACY-REMOVE-04 Home/projection no longer consumes legacy activeCourse or returns Execution | Home activeCourse/legacy 분기·projection Execution 반환 존재 | verified/placeholder만 유지 |
| LEGACY-REMOVE-05 AppFlow removes legacy repository imports/state/actions only | legacy repository import 및 active/saved/refresh/save/replace/remove 전용 식별자 존재 | 전용 상태·action 제거, latestResults/activeVerifiedCourse 유지 |

`node --test test/ui/legacy-four-screen-removal.test.mjs` → **0 PASS/5 FAIL/0 SKIP**, `/private/tmp/qa-legacy-prep-red.log`. assertion 실패5건이며 로더·환경 오류가 아니다. 현재 기능의 신규 장애가 아니라 승인된 제거 목표의 선행 실패다. C 전까지 이 테스트를 포함한 전체 게이트는 RED가 정상이며 skip/탐색 제외로 숨기지 않는다.

## 3. 보존 GREEN

`node --test test/ui/current-flow-refactor-safety.test.mjs test/ui/legacy-course-auto-query.test.mjs` → **14/14 PASS, 실패/skip0**, `/private/tmp/qa-legacy-prep-preserve.log`.

- 실제 Home guest/account 진입·현재 verified1/2곳 이어가기·순서/run/진행 상태 보존.
- 실제 bridge의 준비 전 대기/중복·다른 run·종료 무시, 현재 stack 상세/코스 왕복·탭 reset.
- 완료 composition·실패 유지·동일 run 재시도·중복 완료·기록 종료 경계.
- 로그인 복원/계정 전환/새 로그인에서 과거 자동 조회0 및 현재 복원·owner 재개.
- 명시 legacy refresh1회는 **B 현재 baseline만** 통과. C에서 API 제거 뒤에는 아래 대응표대로 교체하며 이 기대를 복원하지 않는다.

`git diff --check` PASS. B는 테스트 준비 단계여서 전체 회귀·타입 검사·public export를 새로 실행하지 않았다. 전체 및 번들 최종 검증은 D 명령이다. A 당시 타입 PASS를 이번 실행으로 계산하지 않는다.

## 4. 케이스 대응표 — 아직 기존 테스트 수정하지 않음

분류는 현재 기능 보존 / 과거 전용 철회 / 현재 경로로 이관 / 시그니처 조정이다. 담당은 **C UIUX, D QA**로 순차 분리한다. 같은 파일에 여러 분류가 있으면 케이스별로 분리하며 파일 전체 삭제 금지.

| 기존 파일·케이스 | 분류·교체 내용 | 담당 |
| --- | --- | --- |
| active-verified-course-resume: legacy 단독 Execution/V1 우선1건 | 과거 전용 철회+현재 경로 이관: legacy 단독 기대 제거, 현재 없음=placeholder/있음=CourseConfirm. 나머지 진행·identity·중복·접근성·화면 연결 유지, projection 인자만 조정 | UIUX |
| current-flow-refactor-safety: projection 호출·Home/bridge/완료/stack10건 | 현재 기능 보존+시그니처 조정. 장소 순서/run/단계·owner/실패·navigation 기대 완화 금지 | QA; C는 새 시그니처 인계 |
| legacy-course-auto-query: 비로그인/복원·전환/새 로그인3건 | 현재 기능 보존: 과거 repository 접근0, verified 복원·owner 재개 유지 | QA |
| legacy-course-auto-query: 명시 refresh1건 | 과거 전용 철회→전용 API 부재·repository 접근0 검증으로 교체 | QA |
| manual-location-restore: legacy Execution mount1건 | 과거 전용 철회→현재 CourseConfirm gate 이전 지도/route/notification0과 결합. 기존 CourseConfirm mount, storage 왕복, fresh proof, 왕복/편도, 취소·변경, 지도 초기점, LA pending/claim 케이스는 모두 보존 | UIUX |
| course-date-screen-boundary:120/180 × create/replace/missing/invalid/conflict/unavailable/expired/opening_expired/save_late/repeat | 현재 경로 이관: current Results/CourseConfirm의 원본 날짜·만료·실패·중복 보호로 대응. legacy save/replace 화면 호출 자체는 철회. 보존 repository 날짜 성공/명시 거절은 DB/QA fixture에서 유지. 없어진 legacy 저장을 current 화면에 새로 연결하지 않음 | UIUX, DB 제품 변경 필요 시 별도 인계 |
| odsay-removal-screen:save/replace × exact/missing/lost_before_save6건 | 현재 경로 이관: public Results/CourseConfirm actual route·실패 비저장/기존 run 보존·ODsay HTTP/key-read/new-write0. legacy 전용 builder 화면 연결은 철회; 독립 basket 테스트는 연쇄 삭제 금지 | UIUX |
| qa-odsay-removal-execution: geometry 유/무2건 | 현재 경로 이관: current snapshot/geometry 누락 경계의 신규 ODsay0. 과거 snapshot source/min/geo는 보존 reader/격리 데이터 fixture로 유지. 삭제 화면 렌더링 기대만 철회 | QA |
| release-exit-logs: Execution catch1건 | 현재 경로 이관: CourseConfirm/공유 길찾기의 실패·취소·복귀·진행 불변, 민감 오류 원문 비로그 검증으로 옮김. 삭제된 hydration catch 자체 보존 요구 없음 | UIUX |
| mixed-travel-contract: 자동 수단/짧은 근사2건 | 현재 기능 보존: 이번에 삭제하지 않는 엔진 helper 계약 유지 | QA |
| mixed-travel-contract: 단일 확정·장소 상세2건 | 현재 경로 이관: 현재 검증 수단/운영시간/장소 상세 표현으로 검증. 과거 최소·권장/legacy builder 연결 기대는 철회 | QA |
| mixed-travel-contract: 저장/실행 mode1건 | 현재 경로 이관+보존: repository/schedule mode 보존, Execution assertion은 현재 CourseConfirm 길찾기 소비로 교체. 상단 삭제 파일 read 제거로 무관2건의 로딩 실패 방지 | QA |
| course-replan-contract: 원본 날짜·원자적 교체2건 | 현재 기능 보존: SQL/repository가 삭제 대상이 아니므로 유지. top-level Execution read만 제거 | QA |
| course-replan-contract: legacy GPS 재추천 미실행1건 | 과거 전용 철회→현행 수동 입력/현재 코스 보존·자동 과거 실행0으로 대체 | QA |
| map-transport-ui-contract: UKAKAO-DEEPLINK01 | 현재 경로 이관: legacyResults/Execution assertion 제거, PlaceDetail/CourseConfirm 및 공통 schedule의 app/web/cancel 계약 유지 | QA |
| map-transport-ui-contract: 나머지 Home/설정/검색/proxy/CAPTCHA/결과/체류 비노출/진행 | 현재 기능 보존. 상단 과거 파일 read 제거, legacy 제외 문구만 현행 진입점에 맞춤 | QA |
| main-stack-navigation: STACK01 route 목록1건 | 시그니처/fixture 조정: MyCourses 제거. 현재 detail/review/back/terminal reset 결과 그대로 유지 | UIUX |

추가 참조 검색에서 `release-preflight-handoff.test.mjs`(QA)와 `place-course-screen-runtime.test.mjs`(UIUX)는 삭제 화면을 실행하는 것이 아니라 mock mainTabNavigation에 resetToMyCourses가 남아 있었다. 불필요 mock만 조정 가능하며 기존 LA rollback·current 실제 화면/완료/지도 테스트는 보존한다. 전용 API/projection 시그니처 참조는 C의 실제 diff를 기준으로 D에서 다시 조사한다. 이 목록을 테스트 탐색 범위 제한으로 사용하지 않는다.

## 5. C UIUX 인계·보존 경계

위 RED5와 GREEN14를 확인한 뒤 C를 별도 명령으로 진행한다. QA는 C를 시작하지 않았다. C가 QA 소유 파일의 과거 기대 실패를 발견하면 새 시그니처·기대 결과·실패 케이스를 D에 반환하고 직접 고치지 않는다.

보존: `courseRepository.ts` 및 필요한 `RootStackParamList['Execution']` 비실행 호환 타입, courses/course_stops/course_legs/course_feedback/migration/기존 AsyncStorage, `execution/schedule.ts`, 현재 완료/기록/개인화/owned lifecycle, activeVerifiedCourseStorage·수동 복원·LA foreground/pending/알림·GuestImportPanel·latestResults. 타입을 남긴다는 이유로 Stack.Screen을 재등록하지 않는다. 독립 DTO는 DB 후속이다.

변경 파일은 신규 제거 테스트와 본 문서뿐. 기존 테스트의 삭제/skip·제품 수정·DB 쓰기·빌드/배포 없음. **다음 담당 C UIUX → D QA 전체 회귀/번들 → E 사용자 실기기 수락**. B 준비 완료는 과거 네 화면 제거 완료가 아니다.
