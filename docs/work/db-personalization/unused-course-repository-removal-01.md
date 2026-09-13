# DB-UNUSED-COURSE-REPOSITORY-REMOVE-01

2026-09-14. **DB 소스 제거·담당 검증 완료 / UI·QA 혼합 테스트 이관 필요. 전체 회귀 미통과.** [승인 작업 명령](../qa-release/unused-services-removal-01.md)의 DB 범위만 수행했다.

## 1. 제거 근거·변경 파일

시작 HEAD `232a45d`. 기존 API5개 및 UI 다수 삭제/테스트 수정·output/ 미추적 변경은 사용자/다른 세션 소유로 보존했다. 이 작업의 삭제 대상3파일과 수정 migration 계약 테스트는 시작 시 변경이 없었다.

이전 저장 호환용 courseRepository 보존 → 기존 UI 제거 뒤 제품 호출 없음 → 사용자 승인에 따라 미연결 repository만 제거 → 실행되지 않는 코드를 현행 저장 계약으로 오인하지 않도록 정리 → **소스 제거 완료, 전체 QA 이관 대기**. 기존 DB 데이터 삭제나 과거 기능 재활성화가 아니다.

- 삭제 `src/services/courseRepository.ts` 354줄. App/index/src/scripts/supabase/plugins에서 import/reexport·문자열 경로·함수명 재검색: 제품 유입0. `src/ui/nav.ts:76` 설명 주석만 남음. nav 타입·주석은 지시대로 미수정.
- 삭제 `test/course-date-repository.test.mjs` 9그룹: ①120/180 자정·월말·연말 create RPC ②날짜누락/손상 local fallback 거절 ③원본 날짜 read 복원 ④원본 조회/충돌 ⑤replace 원본시각 ⑥create 응답유실 UUID 재시도 ⑦create 종료값 동등성 ⑧read/replace/save 종료 보존 ⑨종료충돌/손상/조회실패. **전부 폐기 repository DTO/RPC 호출 전용**이므로 제거. 현재 snapshot 날짜·완료시각 검증은 별도 유지.
- 삭제 `test/db-manual-location-contract.test.mjs` 2건: 폐기 repository의 origin read 보존과 replace 전달 감사. 과거 좌표의 데이터/테이블 삭제 승인으로 확대하지 않음.
- 수정 `test/release-identity-migration-contract.test.mjs`: 폐기 repository의 anonymous guard/create RPC 재시도 문자열 검사1건만 제거. 나머지6건의 migration/RLS/동의/삭제·guest/180일 계약 유지.
- 신규 `test/db-unused-course-repository.test.mjs`: 삭제 집합 밖 유입0·파일 부재와 현행 서비스 존재2건. 토큰 스캔으로 import/문자열/식별자까지 검사하고 주석을 제외한다. 이 정적 검사를 현재 저장 동작의 runtime 증거로 대신하지 않는다.
- 이 문서와 DB README 링크. 전용 테스트 제거12건·신규2건이며 공유 트리의 다른 역할 테스트 수 감소와 합산해 DB 변경으로 보고하지 않는다.

삭제한 파일은 Git HEAD에 있는 추적 파일이어서 이력으로 복구 가능하다. 실제 기기 저장소/서버 행·백업은 삭제하지 않았다.

## 2. 유지한 저장 계약

현재 완료는 `courseCompletionComposition → ownedCourseLifecycle → releaseIdentitySupabase → releaseIdentityPersonalizationRuntime` 경계다. `courseCompletionRepository`, `accountCourseCompletionRepository`, `guestCompletionImportRepository`, 체류 repository/outbox, 기존 기록 read/import/delete를 그대로 보존했다.

owner 격리·명시 guest 가져오기·동의 epoch/revision·완료 멱등·로컬 손상/실패·민감정보 제외·기존 기록 보존 정책 불변. `courses/course_stops/course_legs`와 SQL/RLS/기존 행·원격 create/replace 함수도 그대로다. 제거된 앱 파일의 부재는 운영 함수나 저장 데이터가 없다는 뜻이 아니다. 엔진/카탈로그·GPS 미사용·180분/2곳·진행/LA/알림·권한도 미변경.

## 3. 테스트 대응표 — QA/UI에 반환

아래 파일은 다른 역할 소유이므로 이번에 직접 수정하지 않았다. 파일 전체 삭제나 테스트 skip으로 통과시키지 않는다.

| 파일·케이스 | 폐기 참조 | 유지/이관할 검증 |
| --- | --- | --- |
| `test/course-replan-contract.test.mjs` | 파일 상단 repository read와 2번째 테스트의 replace RPC 문자열 | 기존 migration 최초 starts/ends 불변·원자적 graph 교체 assertions 보존. 현재 CourseConfirm 수동 복원 gate/원본 deadline assertions 보존 |
| `test/mixed-travel-contract.test.mjs` | 상단 repository read 및 마지막 케이스 저장 mode 문자열 | 현재 mixedTravel/travel 모드, schedule incomingMode, 확인 길찾기 및 verified progress의 각 leg mode 보존 |
| `test/ui/course-date-screen-boundary.test.mjs` | `preserved repository` 120/180×create/replace/missing/invalid/conflict/unavailable 12건 | 뒤쪽 현재 CourseConfirm 120/180×dated_review/repeat_review/expired_restore/expiry_during_reselection 8건 유지. 비실행 repository mock은 제거해도 현재 runtime 검증 약화 금지 |
| `test/ui/qa-release-three-hour-save-date.test.mjs` | legacy account save2·date-less reject2, 총4건 전용 로더 | 폐기된 DTO 성공을 재현하려고 서비스 복원 금지. 최초 자정 경과 의도는 **현재 verified snapshot nowIso·원본 종료·완료 시각** 공개 경계 fixture로 이관; 시분에 현재 날짜를 붙이도록 기대값 변경 금지 |
| `test/ui/qa-odsay-removal-execution.test.mjs` | geometry 있음/없음2건 중 첫 legacy list reader 호출 | ODsay precomputeTransit 신규요청/키읽기0, 현재 CourseConfirm의 기존 active 보존·교체취소 및 네트워크/쓰기0 유지. reader 부분만 분리 |
| `test/ui/odsay-removal-screen.test.mjs`, `legacy-course-auto-query.test.mjs` | 비실행 repository mock | mock 문자열 자체가 실제 저장 보존 증거는 아님. 현재 호출 counters/flow 상태 검증 목적을 유지하면서 정리 |
| `test/ui/legacy-four-screen-removal.test.mjs` | 삭제 repository import가 없다는 AST 검사 문자열 | 부재 guard로 유효하므로 제품 유입으로 오인하거나 제거할 필요 없음 |

DB schema/개인화/guest에 남은 현재 기능은 DB 집중 fixture로 별도 실행했다. 현재 동작을 커버할 다른 테스트가 있다는 이유만으로 QA의 자정/종료시각 원래 검증 의도를 삭제하라고 요청하지 않는다.

## 4. 검증 결과

- 삭제 전 신규 gate: **1 PASS/1 FAIL**. 제품 유입0은 통과, 파일 부재는 실제 파일 존재로 예상 실패.
- 삭제 전 현재 기능: `node --import tsx --test test/course-completion-repository.test.ts test/release-owned-completion.test.ts test/guest-import-pending-recovery.test.ts test/guest-import-release-fix.test.ts test/ui/owned-course-lifecycle.test.ts` → **37/37 PASS**. `/private/tmp/db-unused-before.log`.
- 삭제 후 위37건+신규 gate2건 → **39/39 PASS**, `/private/tmp/db-unused-after.log`.
- migration 계약6건+신규 gate2건 별도 → **8/8 PASS**. migration SQL 변경0.
- `npm run test:typecheck`: PASS, `/private/tmp/db-unused-type.log`.
- `npm run test:ui`: **777 PASS/18 FAIL/기존 skip1** (796), `/private/tmp/db-unused-ui.log`. 처음 sandbox tsx IPC EPERM으로 시작 실패 후 권한 허용해 실행. 실패18건은 위 repository12+QA날짜4+ODsay reader2. 신규 skip0.
- 기본 최초 실행: **524 PASS/22 FAIL** (546), `/private/tmp/db-unused-core.log`. 위18건+혼합파일 load2+제거 전 DB 문자열케이스1+자식 실패를 집계하는 `test/index.js` wrapper1. DB 문자열케이스 제거 후 최종 실행 결과는 아래에 기록한다. loader/discovery 설정을 변경하지 않았다.
- 현재 수동 복원·원본 deadline 집중 및 최종 기본 결과는 아래 마감 기록 참조. 실제 API·운영 DB·C·알림 취소·데이터 정리·배포·commit/push0. export/최종 후보 전체 수락은 QA 담당.

## 5. 인수인계

최종 마감: `npm test` **524 PASS/21 FAIL** (545, skip0), exit1, `/private/tmp/db-unused-core-final.log`. 前述DB 전용케이스1건 제거를 반영했으며 잔여는 QA/UI18+혼합파일 load2+wrapper1이다. `node --import tsx --test test/ui/manual-location-restore.test.mjs test/ui/current-course-start-expiry.test.mjs test/ui/qa-current-course-expiry.test.mjs` **27/27 PASS**, `/private/tmp/db-unused-current.log`. 현재 수동 복원·120/180 원본 deadline·만료/이탈·날짜 경계의 runtime 검증을 유지한다. `git diff --check` PASS.

1. **변경/목적:**1절의 제품1파일 및 전용테스트2파일 삭제, DB 혼합테스트의 폐기 케이스1개만 삭제, 부재/유입 gate 및 문서 추가.
2. **보존:** 현재 완료/기록/guest/학습/복원, schema·RLS·기존 데이터·nav 타입·다른 세션 diff/output 전부 유지.
3. **실행:** 실패 선행과 현재 기능 전후 PASS, typecheck PASS. 전체 UI/core는 남은 UI/QA 과거 참조 때문에 FAIL이며 전체 성공으로 기록하지 않음.
4. **다음:** UIUX 알림 모듈 작업은 해당 단일 작성자에게 유지. QA가3절 케이스별 정리·현재 runtime 이관 후 모든 역할 변경이 합쳐진 동일 후보의 전체 게이트/export 실행. 중앙 DB 설계/현재 구조 문서의 과거 courseRepository 존재 설명은 통합·문서 담당이 이번 제거 근거로 정정할 사항이며 직접 편집하지 않았다.
