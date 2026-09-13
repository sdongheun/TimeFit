# 미연결 서비스7개 제거·검증 명령

2026-09-14 / 최신 상태: **QA 자동 검증 PASS / 사용자 정상 확인·통합 최종 수락 완료**. 아래 구현 전·확인 대기 문구는 당시 이력이다.

## 2026-09-14 통합 수락

QA 결과와 담당 인계를 검토하고 관련33건을 재실행해 모두 통과했다. QA 로그의 UI786 PASS·기존 skip1, 기본542 PASS를 확인했다. 사용자가 이후 “문제없다”고 보고하여 서비스7개 제거를 수락한다. 기기/빌드 번호·개별 시나리오 로그까지 확보했다고 확대하지 않는다. 제품 코드·DB 데이터·현재 기능 계약 추가 변경 없음. 이번에는 본 문서 상태만 갱신하며 git diff --check로 확인한다. commit/push·배포는 미실행이다.

## 결정

앞선 UI 제거 후 후보7개를 설명했고 사용자가 제거 후 테스트를 요청했다. 이전에는 저장 호환/정리 도구 목적 때문에 별도 판단 대상으로 보존 → 앱 및 서버·스크립트 호출 부재 조사 → 이번 승인으로 미연결 소스만 제거 → 실행 코드와 검증 목적 정합성 확보 → 구현 전. DB 데이터·기존 알림 취소·캐시 삭제를 승인한 것은 아니다.

현재 HEAD232a45d 이후 수락된 U-UNUSED-UI-REMOVE-03 변경은 아직 미커밋이다. 시작 시 이 diff를 별도로 기록하고 보존한다. output/ 보존, 기존 사용자 변경 초기화 금지. 전체 회귀 기준은 UI795 PASS·기존 skip1, 기본555 PASS이며 이전 결과를 이번 실행으로 대체하지 않는다.

## 공통 실행 규칙

- 담당 후보마다 App/index/src/scripts/supabase/plugins의 import/reexport·문자열 동적 호출 및 이름 참조를 재확인한다. 테스트 참조와 제품 참조를 구분하고, 제품 호출이 발견되면 그 파일만 제외해 보고한다. 호출자를 삭제해 미사용으로 만들지 않는다.
- 삭제 집합 밖 유입0·파일 부재 테스트를 먼저 추가해 삭제 전 예상 실패를 확인한다. 현재 기능 보존 테스트도 삭제 전 통과를 확인한다.
- 파일 단위로 명시된 후보만 제거한다. 공유 엔진 함수·서비스·타입·UI 분기까지 연쇄 제거하지 않는다.
- 폐기 코드 전용 테스트는 케이스별 이유를 기록해 정리한다. 혼합 테스트는 현재 기능 계약을 보존한다. 타입 검사나 테스트 통과를 위해 과거 코드를 다시 실행 경로에 연결하지 않는다.
- 담당 계약 테스트와 타입 검사를 실행하고 QA 소유 파일에 남은 참조/기대값은 명시 인계한다. 다른 세션 파일을 직접 수정하지 않는다.

## 1. API-UNUSED-SERVICES-REMOVE-01 — API 세션

아래 src/services/ 파일5개를 위 규칙에 따라 제거한다.

1. kakaoReverseGeocodeAdapter.ts
2. placeSearchSuggestionAdapter.ts
3. routeProxyAdapter.ts
4. routeProviderAdapter.ts
5. legacyRouteBaselineCleanup.ts

현재 검색/지도 확정 서비스와 Supabase route-proxy handler/production ports를 대조한다. 특히 routeProxyAdapter는 현재 운영 handler와 다른 파일이므로 운영 handler를 삭제하지 않는다. baseline 정리 함수를 삭제하더라도 함수를 실행하거나 AsyncStorage를 정리하지 않는다. 현재 API 키·환경변수·공급자·요청 경로·캐시 정책 불변.

test/api-release-safety.test.ts는 혼합 파일이므로 삭제 도구 전용 케이스 외 안전성 검증을 반드시 보존한다. API 계약 테스트 이외 QA 소유 테스트 변경은 인계한다.

## 2. DB-UNUSED-COURSE-REPOSITORY-REMOVE-01 — DB 세션

src/services/courseRepository.ts만 제거한다. 현재 완료 저장 경로인 courseCompletionRepository 및 releaseIdentityPersonalizationRuntime, 기존 기록 read/import/delete 경로와 구별한다.

courses/course_stops 테이블·migration·RLS·기존 행은 그대로 둔다. DB 정리·원격 적용·테이블 삭제 금지. nav.ts의 과거 타입은 이 작업에서 수정하지 않는다. 코드 제거와 저장 데이터 삭제는 다른 작업이다.

날짜·수동 위치·원본 deadline 관련 테스트 중 폐기 repository 전용과 현재 진행/저장 계약을 구별한다. 현재 완료 저장·owner 격리·guest 가져오기·기록 유지 검증을 약화하지 않는다. UI/QA 테스트의 repository read 참조는 케이스별 인계하며 파일 전체 삭제를 요구하지 않는다.

## 3. U-UNUSED-NOTIFICATIONS-REMOVE-01 — UIUX 세션

src/services/courseNotifications.ts는 과거 진행 UI의 로컬 알림 전용 모듈이므로 이번 작업의 단일 작성자를 UIUX로 지정한다. 다른 services 파일 수정은 금지한다.

현재 Live Activity 및 courseProgressNotifications와 알림 handler 초기화 경로를 대조하고 미연결일 때만 파일을 제거한다. @timefit/course-notification-ids 키를 읽어 취소·삭제하거나 다른 모듈에 옮겨 실행하지 않는다. 현재 알림 권한·예약·취소·Live Activity 동작을 보존한다. UI 테스트의 비실행 mock은 실제 보존 목적을 확인한 뒤 정리하거나 QA에 인계한다.

## 4. QA-UNUSED-SERVICES-REMOVE-01 — QA 세션

앞선 세 역할 완료 후 실행한다. 미완료 범위가 있으면 전체 완료라고 하지 않는다.

각 삭제 파일의 테스트 대응표를 검토하고 QA 소유 혼합 계약을 현재 기능 기준으로 이관한다. repo DTO만 검증하던 테스트와 현재 기록/날짜/수동 위치 검증을 구별한다. 현재 기능에는 runtime 검증을 유지한다. 제거된 함수 이름만 금지하는 mock이 현재 기능 보존을 증명한다고 오인하지 않는다.

```sh
npm run test:typecheck
npm run test:ui
npm test
node scripts/release-build.cjs export
git diff --check
```

테스트 수 감소·추가·기존 skip을 설명한다. 발견 설정/loader/skip 변경으로 실패를 숨기지 않는다. 실제 API·운영 DB를 회귀 테스트 입력으로 쓰지 않는다. 기본 테스트에 포함되지 않는 담당 계약 테스트도 별도로 실행 근거를 확인한다.

## 보존·인계

courseV1.testOnly.ts는 의도적인 테스트 진입점이므로 유지한다. 현재 엔진·카탈로그·UI 흐름·GPS 미사용·180분/2곳·학습·기록·복원·동의·권한·외부 공급자 정책 불변.

각 역할은 변경 파일/목적, 보존 계약, 실행 테스트/로그, 남은 실패·결정 필요 사항을 인계한다. 순서는 API→DB→UIUX→QA로 진행해 공유 테스트의 중복 편집을 피한다. 자동 통과 후 통합 검토와 수정 빌드 정상 확인을 거친다. commit/push·스토어 업데이트·운영 데이터 정리는 포함하지 않는다.

통합 작성 결과: 본 명령 추가만 수행. 제품 제거와 삭제 후 테스트는 아직 미실행. git diff --check로 문서 형식을 확인한다.

## 2026-09-14 QA-UNUSED-SERVICES-REMOVE-01 최종 인계

### 선행 작업·범위 확인

[API5개 제거](../external-api/unused-services-removal-01.md), [DB repository 제거](../db-personalization/unused-course-repository-removal-01.md), [UIUX 알림 제거](../uiux/unused-notifications-removal-01.md)의 완료 근거·테스트 대응표를 대조했다. 각 파일별 제품 유입0·제거 전 red/보존 green 근거는 해당 문서에 보존되어 있으며 이번 QA에서 제거 gate와 현재 runtime을 다시 실행했다.

시작 HEAD `232a45d` 이후 REMOVE-03 및 세 역할의 미커밋 소스/테스트/문서 변경과 output/을 그대로 유지했다. QA 제품 수정·추가 서비스 삭제·캐시/기존 예약/운영 데이터 삭제0. App·엔진·services·DB·native·중앙 기준 문서 변경0, stage/commit/push0이다.

### QA 변경 파일·이관 근거

수정 전 아래 혼합5파일 실행은 **28건 /8 PASS/20 FAIL**(`/private/tmp/services-qa-before.log`). 삭제 repository 전용12건 + QA 날짜4건 + ODsay reader2건 + root 파일 로딩2건이다. 현행 기능 회귀가 아니라 폐기된 소스 의존으로 분류했다.

| 변경 파일 | 처리·유지 검증 |
| --- | --- |
| `test/course-replan-contract.test.mjs` | repository read와 폐기 replace RPC 문자열1개만 제거. 기존 SQL의 최초 시각 불변·graph 원자 교체 및 현재 수동 복원/원본 deadline 3건 유지 |
| `test/mixed-travel-contract.test.mjs` | repository read·저장 mode 문자열만 제거하고 제목 정정. 엔진 혼합 이동·짧은 구간·현재 snapshot 차단/재계산0·상세 역할·schedule/현재 route의 leg mode 5건 유지 |
| `test/ui/course-date-screen-boundary.test.mjs` | 폐기 repository create/replace/날짜오류 전용12건 제거. 현재 CourseConfirm 날짜 표시·반복 review/중복 시작·기존 복원/재선택 만료8건과 기대값 유지. 저장 호출0 감시는 사라진 메서드 대신 실제 현재 completion composition 포트로 이관 |
| `test/ui/qa-release-three-hour-save-date.test.mjs` | 삭제 account RPC/DTO4건 → 현행120/180 verified 원본 날짜·Live Activity 마감·현재 완료 저장2건 및 날짜 없는 review 거절2건. 기존 전날 시작→익일 기록 의도를 유지하며 시분에 저장 날짜를 붙이지 않음 |
| `test/ui/qa-odsay-removal-execution.test.mjs` | 삭제 reader 실행/가상 서버 row 부분만 분리. 실제 travel precomputeTransit 재요청의 HTTP/key/cache0·Infinity/geometry없음, 현재 geometry 유/무 review의 기존 active 교체 취소·보존2건 유지. 저장0은 현행 completion 포트로 감시 |
| 본 작업 문서 | 최종 결과·테스트 수·미확인 경계 기록 |

혼합 테스트 전체를 삭제하지 않았다. `legacy-course-auto-query`/`odsay-removal-screen` 등의 비실행 repository mock·부재 guard는 기존 음성 회귀 장치로 남겼으나 **현재 저장 동작의 증거로 계산하지 않는다**. 현재 저장/owner/guest는 아래 실제 repository 및 lifecycle130건으로 별도 검증한다. API의 `searchPlaceSuggestions` 금지 regex도 삭제 파일을 import하지 않는 부재 guard로 유지했다.

### 날짜 이관의 정확한 의미

- 원본 시작은 canonical `2026-12-31T14:50:00.000Z`(KST12/31 23:50). 실제 CourseConfirm 시작 클릭은 고정 clock `2026-12-31T15:05:00.000Z`(익년1/1 00:05)로 실행한다. 120/180분 원본 session을 유지하고 `buildLiveCoursePlan`의 finalArrivalAtMs가 원본 시작+최초 기간과 같은지 검사한다.
- 현재 완료는 `buildCompleteCourseInput → createCourseCompletionRepository.complete/read`를 메모리 저장 포트로 실행한다. completedAt은 `2026-12-31T15:35:00.000Z`(KST1/1 00:35), 동일 run·최초 완료 저장1회·재완료 멱등·원본 시작/LA 마감 불변을 확인한다. 현재 완료 DTO에 과거 starts_at/ends_at 필드를 새로 요구하거나 저장 RPC를 복원하지 않는다.
- 날짜 없는 nowIso(undefined/빈 문자열)는 현재 review의 실제 시작 CTA를 눌러 신규 active0·길찾기0·completion0으로 거절됨을 확인한다. 날짜 근거를 현재 날짜로 생성해 성공시키지 않는다.
- 과거 account create RPC 성공을 현재 완료 로컬 fixture 성공이라고 바꿔 부르지 않는다. 회원 저장/owner 격리/guest 가져오기는 현행 release-owned-completion 및 guest 집중 계약에서 별도로 통과했으며 원격 서버 성공은 이번 검증 범위가 아니다.

### 최종 자동 검증

| 실행 | 결과 | 로그 |
| --- | --- | --- |
| 수정한 혼합5파일 | **22/22 PASS**, skip0 | `/private/tmp/services-qa-focus.log` |
| API·DB·UIUX 담당 계약19파일 별도 실행 | **130/130 PASS**, skip0 | `/private/tmp/services-qa-owners-final.log` |
| `npm run test:typecheck` | **PASS**, exit0 | `/private/tmp/services-qa-types.log` |
| `npm run test:ui` | **786 PASS/FAIL0/기존 skip1**, 총787, exit0 | `/private/tmp/services-qa-ui.log` |
| `npm test` | **542/542 PASS**, skip0, exit0 | `/private/tmp/services-qa-all.log` |
| `node scripts/release-build.cjs export` | **public iOS PASS**, exit0 | `/private/tmp/services-qa-export.log` |
| `git diff --check` | **PASS**, 최종 문서 포함 | 로컬 검사 |

담당 계약130건은 API57(API gate6 포함) + DB39(DB gate2 포함) + UIUX34(알림 gate/runtime3 포함)다. 기본 runner에 포함되지 않는 TypeScript API 계약도 다음 명령으로 직접 실행했다.

```sh
node --import tsx --test test/api-unused-services-removal.test.mjs test/kakao-location-search-adapter.test.ts test/kakao-location-label-adapter.test.ts test/route-proxy-production-ports.test.ts test/route-proxy-client-adapter.test.ts test/route-proxy-kakao-request.test.ts test/api-release-safety.test.ts test/place-search-adapter.test.ts test/db-unused-course-repository.test.mjs test/course-completion-repository.test.ts test/release-owned-completion.test.ts test/guest-import-pending-recovery.test.ts test/guest-import-release-fix.test.ts test/ui/owned-course-lifecycle.test.ts test/ui/unused-notifications-removal.test.mjs test/ui/live-activity-notification-ownership.test.mjs test/ui/live-activity-course-runtime.test.ts test/ui/live-activity-terminal-cleanup.test.ts test/ui/manual-location-restore.test.mjs
```

최초 담당 명령은 notification-ownership 확장자를 `.ts`로 잘못 지정해 실행 전 중단됐다(`/private/tmp/services-qa-owners.log`). 실제 `.mjs` 경로를 확인해 위 최종 명령으로 실행했다. 테스트를 제외하거나 발견 설정을 바꾸지 않았다.

수 변화: 직전 UI796 → 알림 신규3 → repository 전용12 제거 =787. QA 날짜4/ODsay2/현재 날짜8은 유지·이관했고 기존 skip1 변화0. 기본555 → API gate6 + DB gate2 + 알림3 − DB 전용12 − UI repository 전용12 =542. API 전용 `.ts` 삭제/이관은 기본 수에서 차감하지 않으며 별도 API 대응표와57건으로 추적한다. 기존 loader 집계와 발견 패턴은 그대로다. 수정 전 root 로딩 실패는 정상3+5건으로 복구됐으며 최종 ENOENT/집계 실패0이다.

public 산출물은 실제 재생성된 `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`다. 직전과 동일 파일명은 미연결 제거의 보조 관찰이며 native/서명/실기기 동등성 증명이 아니다. Archive/IPA·설치·스토어 반영은 미실행이다.

### 유지 계약·다음 담당·남은 위험

현재 API 요청/키/캐시·운영 route-proxy handler, 180분/2곳·수동 위치·날짜/만료·완료/기록·owner·guest·동의/학습·복원·Live Activity/알림·권한, DB 스키마/RLS/기존 행을 변경하지 않았다. 삭제된 알림 키/예약과 baseline cache를 실제 장치에서 읽거나 정리하지 않았다. courseV1.testOnly 및 nav의 호환 타입도 그대로다.

**자동 통합 검증 완료 → 통합 문서/제거 범위 수락 → 수정 빌드 최소 정상 확인**으로 인계한다. 수동 검색/지도 선택→추천1/2곳→명시 길찾기→권한/도착·출발/종료·LA 공유→완료/기록, 기존 진행 복원과 계정/guest 기록 유지가 실기기 미확인이다. 이번에는 실제 공급자 API·운영 DB·Simulator·실기기 조작 및 반복 알림 취소를 실행하지 않았다. 자동 PASS를 실기기·서버 검증으로 대신하지 않는다.

현재 구조/DB 문서의 과거 repository 존재 설명과 nav 호환 DTO 후속은 통합·DB 담당이 별도 판단한다. 코드 제거로 운영 SQL 함수·테이블·기존 행까지 삭제됐다고 기록하지 않는다. commit/push·배포·운영 정리는 별도 승인 범위다.
