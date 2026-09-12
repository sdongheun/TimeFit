# QA-RELEASE-180-01 — 최종 자동 검증·날짜 저장 경로 반환

2026-09-08. **최신: 날짜 계약 보완 후 최종 자동 재검증 PASS. 실기기 미확인 조건은 별도 유지.** 아래 최초 FAIL은 이력이며 마지막 재검증 절이 현재 판정이다. 제품 수정0. 운영 DB 쓰기·개인화 C 재실행·Simulator 조작·commit/push0.

## 인수인계 대조

- [확정 결정](../integration-decision/release-three-hour-two-stop.md): 최대180분·최대2곳, 체류/호출 예산 불변.
- [엔진](../recommendation-engine/release-three-hour-verification.md): single/pair 정수1~180,181 무호출 거절, 날짜별 운영시간, 기존120 tier는 입력 상한 아님.
- [API](../external-api/release-three-hour-impact.md): 180분 차단 없음. 예정 출발 instant 미전달 한계 유지.
- [UIUX](../uiux/release-three-hour-time-setup.md): 날짜 포함 휠/session/복구·알림 연결 완료. 그 문서의 DB 근거 미도착은 아래 인계로 해소됐으며 구현 대기로 멈추지 않고 최종 실행했다.
- [DB](../db-personalization/release-three-hour-impact.md): epoch 완료/표본 및 SQL timestamptz는180/익일 허용. legacy courseRepository 날짜 유실 가능성은 별도 추적 필요.

## 실제 저장 경로 추적·실패 반환

신규 출시 경로 `Home → TimeSetup → Results → CourseConfirm`에서는 flow.saveCourse를 호출하지 않는다. 그러나 등록된 호환 경로는 실제 접근 가능하다:

`MyCoursesScreen 저장 카드 → ExecutionScreen → 코스 변경 → LegacyResults(OneStopResultsScreen) → startCourse → AppFlowContext.saveCourse → saveCourseToRepository → dateAtMinute → create_course_plan RPC`.

근거: MyCoursesScreen.tsx95, ExecutionScreen.tsx279, OneStopResultsScreen.tsx93, AppFlowContext.tsx220, courseRepository.ts38/150/168. 신규 V1 코스가 모두 이 경로로 저장된다는 뜻은 아니다. 기존 저장 코스 보존/복구가 출시 범위에 있으므로 죽은 코드로 제외할 수 없다.

재현 fixture `test/ui/qa-release-three-hour-save-date.test.mjs`:

- 자정 전 열린 legacy snapshot: 2026-09-08 23:50 시작, remainingMin120 또는180. 화면이 열린 채 날짜가 바뀌고09-09 00:05 저장.
- 실제 repository export를 실행하고 Date/auth/Supabase RPC만 고정 port로 대체. RPC 정확히1회 호출과 create_course_plan payload를 확인하여 guest/local fallback을 PASS로 오인하지 않는다. 운영 네트워크0.
- 기대120: 시작09-08 23:50→끝09-09 01:50. 실제: 시작09-09 23:50→끝09-10 01:50.
- 기대180: 시작09-08 23:50→끝09-09 02:50. 실제: 시작09-09 23:50→끝09-10 02:50.
- 원인: PlanCtx에는 원래 날짜가 없고 dateAtMinute가 저장 당일 new Date에 시·분을 붙인다. startsAt/endsAt이 함께24시간 밀린다. 위 표기는 KST 실행 기준이며 fixture는 로컬 Date를 사용한다.
- **반환 담당: DB/repository 소유 세션 + UIUX/nav 날짜 전달 계약, 통합 결정.** 기존 DB-RELEASE-180-CHECK 인계와 U-RELEASE-180-01에서 해결 범위를 조율한다. 원래 날짜 전달·날짜 없는 legacy 호환 의미를 결정하고 회귀 통과 후 QA 재검증. 추정으로 제품/타입/migration을 고치지 않았다. 단순히 실패 기대값을 하루 뒤로 바꾸거나 skip 처리하지 않는다.

## 자동 결과

대상 HEAD `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f` + 기존 공유 미커밋 트리. clean commit 단독 검증이 아니며 다른 세션 변경을 되돌리지 않았다. 아래는 이번 실제 실행 결과다.

| 게이트 | 결과 | 로그 |
| --- | --- | --- |
| npm run test:typecheck | PASS | /private/tmp/qa180-type.log |
| 집중 엔진/UI180/API/DB/복구14파일 | 100/100 PASS | /private/tmp/qa180-focus.log |
| 신규 날짜 보존 fixture | 0 PASS/2 FAIL | /private/tmp/qa180-date.log |
| npm run test:ui 최종(새 fixture 포함) | 638건:635 PASS/2 FAIL/기존1 skip | /private/tmp/qa180-ui-final.log |
| npm test | 301/301 PASS | /private/tmp/qa180-core.log |
| CI=1 npx expo export --platform ios --output-dir /private/tmp/qa180-ios-export | PASS, Hermes iOS export | /private/tmp/qa180-export.log |

UI 최초 sandbox IPC EPERM 후 승인 실행. 신규 fixture 전 전체 UI는636건635 PASS/기존1 skip이었다. 최종2실패는 위 날짜 반례이며 숨기지 않았다. 기존 skip은 course-v1-journey의 철회된 순차 대표교체 이력1건. export는 서명/설치/ActivityKit OS 성공이 아니다.

집중 명령:

```sh
node --import tsx --test test/release-three-hour-engine.test.ts test/ui/release-three-hour-time.test.ts test/ui/release-three-hour-progress.test.mjs test/api-two-stop-route-budget.test.ts test/route-proxy-page-budget.test.ts test/route-proxy-deadline.test.ts test/route-proxy-timeout-behavior.test.ts test/private-walk-connector.test.ts test/route-proxy-geometry-migration-contract.test.mjs test/course-completion-repository.test.ts test/release-owned-completion.test.ts test/dwell-personalization.test.ts test/dwell-storage-contract.test.ts test/ui/active-verified-course-resume.test.ts
node --import tsx --test test/ui/qa-release-three-hour-save-date.test.mjs
```

확인 범위:119/120 및121~180,181 route 전 거절·직접 session 거절, single1/pair2 및 pair-only3곳 비조립 회귀, 짧은 입력·여유 포함 합계·더보기/선택취소/호출 예산, 자정 정확 종료·익일 휴무, 실제/개발 날짜, 기존120 복구와181 복구 거절. 120/180×1/2곳 복구→실제 progress composition→Activity payload·notification sync는 날짜 epoch·기존3분 유예/5분 출발 경계를 검증한다. 저장 날짜 실패와 이 정상 V1 snapshot 경계를 구분한다.

## 별도 한계·최소 실기기 목록

대중교통 route port/provider/cache에는 예정 이동 시각이 전달되지 않는다. 엔진 nowIso와 실제 provider 운행 기준시각은 동일하다고 보장하지 않는다. 익일·막차/첫차 운행 가능성을 자동 게이트 PASS로 주장하지 않는다. 다음날만 여는 장소의 사전 선별 누락, 밤샘 windows·기기 시간대/공휴일 정책 한계도 기존 엔진 인계대로 남는다. 새 근사 fallback이나 API 예산 확대는 하지 않는다.

날짜 결함 반환·재검증 후 아래 미확인 native 항목만 사용자에게 한 묶음 요청한다. 현재 수동 반복 실행은 요청하지 않는다.

1. 작은 화면/큰 글씨에서 오늘·내일 휠과 CTA 접근,180 허용/181 오류, 자정 넘는 결과·코스 확인의 실제 날짜 표시.
2. 기존120분 진행 이어가기 유지와180분 2곳의 방문 순서·첫 카카오 전환/복귀·Live Activity 연결. 기존 동일 빌드 증거가 있으면 재사용.
3. 잠금화면/OS에서 익일 알림 날짜·현재 장소 행동·최종 목적지 전환 및 완료 후 Activity/알림 정리. 개발 시계로 만든 예정 시각을 실제 운행/체류 학습 증거로 쓰지 않는다.

## 변경·유지 계약·다음 담당

변경: QA 날짜 재현 테스트와 이 문서만 신규. 제품·DB schema·엔진·UI 동작 변경0. 최대2곳·체류·여유·예산·동의/소유권·기존 기록 보존 유지. 날짜 반례 소유 세션 반환 후 같은 명령으로 재검증해야 하며, **최종 출시 수락은 보류**다. DB migration 적용 또는 개인화 C 성공과 별개의 판정이다.

## 날짜 보존 최종 재검증 — 2026-09-08

**자동 게이트 PASS.** DB `course-date-preservation.md` 6절과 UIUX 같은 이름 문서의 ‘최종 연결 검증·QA 인수인계’를 대조했다. 원본 종료 미제공/오류 소비 미연결이라는 과거 대기는 해소됐다. QA는 제품 코드 없이 기존 재현을 공개 계약에 맞게 보완했다.

### 이전 실패 → 보완한 검증

최초 실패는 저장 당일+시분 재생성으로 시작·종료가 하루 밀리는 문제였다. DB가 날짜 없는 입력을 fail-closed하도록 수정한 뒤에는, 원본 조회 port가 없는 기존 QA 입력이 `course_date_unavailable`로 거절됐다. 이를 성공으로 위장하지 않고 다음4개 사례로 분리했다.

- 기존120/180 성공2건 유지: 원래09-08 23:50 시작을09-09 00:05에 저장. 기존 courseId의 원본 starts_at/ends_at 조회 fixture를 제공하고 실제 repository export를 실행한다. 원본 조회 대상 ID, create RPC1회, 정확한 시작/종료, 반환 ctx와 RPC snapshot 동일성까지 확인한다. 원래 기대 종료120분01:50/180분02:50를 하루 미루지 않았다.
- 날짜 근거 없는120/180 거절2건 추가: 각 account/guest 입력을 실행해 `isCourseDateError`와 `course_date_missing`을 확인한다. Promise reject·쓰기RPC0으로 로컬 가짜 성공도 차단함을 검증한다. 날짜를 현재시각으로 합성하거나 skip하지 않았다.
- DB9그룹은 명시 신규 시작/종료, 월말·연말, 서버 원본 복원, local 원본, offset 동일 instant/충돌, 조회 실패, reduced remainingMin 및 종료 보존을 담당한다.
- UI20사례는 실제 화면→repository 연결, create/replace 분기, 네 날짜 오류, 반복 변경, CTA/운영시간 대기 중 만료, 저장 응답 지연 중 만료를 검증한다. 저장 전 만료는write0, 이미 보낸 응답 대기 중 만료는write1이 가능하나 활성화/Execution 이동0이라는 계약을 유지한다.

### 이번 최종 실행 결과

대상: HEAD `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f` + 최신 DB/UI 및 기존 공유 미커밋 트리. clean commit만의 검증이 아니며 이전 실행 수치를 재사용하지 않았다.

| 실행 | 최종 결과 | 로그 |
| --- | --- | --- |
| DB9 + UI20 + QA4 결합 | 33/33 PASS, skip0 | /private/tmp/qa180-recheck-focus.log |
| 엔진/UI180 경계·복구·알림3파일 | 12/12 PASS | /private/tmp/qa180-recheck-boundary.log |
| npm run test:typecheck | PASS | /private/tmp/qa180-recheck-type.log |
| npm run test:ui | 663건:662 PASS/0 FAIL/기존1 skip | /private/tmp/qa180-recheck-ui.log |
| npm test | 334/334 PASS, skip0 | /private/tmp/qa180-recheck-core.log |
| iOS export | PASS | /private/tmp/qa180-recheck-export.log |

```sh
node --import tsx --test test/ui/qa-release-three-hour-save-date.test.mjs test/course-date-repository.test.mjs test/ui/course-date-screen-boundary.test.mjs
node --import tsx --test test/release-three-hour-engine.test.ts test/ui/release-three-hour-time.test.ts test/ui/release-three-hour-progress.test.mjs
npm run test:typecheck
npm run test:ui
npm test
CI=1 npx expo export --platform ios --output-dir /private/tmp/qa180-recheck-ios
```

기존 skip은 `course-v1-journey.test.ts`의 철회된 순차 대표교체 이력1건이며 신규 skip0. 집중/전체 결과는 중복 포함이므로 합산하여 독립 테스트 수로 표시하지 않는다. iOS export는 Hermes bundle 검증이며 서명·설치·native OS 전달 성공을 뜻하지 않는다.

180 허용/181 거절, 최대2곳, 익일 운영시간·휴무, 기존120 snapshot 복구, 날짜 포함 Activity payload/알림 예약 연결의 기존 자동 게이트가 다시 통과했다. 예정 이동 시각이 provider에 전달되지 않는 대중교통 한계와 익일 운행/막차 보장 불가는 여전히 별도 미확인이다. 날짜 보존 수정이 이 API 한계를 해결하지 않는다.

### 남은 조건·최소 실기기 체크리스트

자동 수락과 분리하여, 승인된 검증 빌드/계정·격리 데이터가 준비된 뒤 한 묶음만 확인한다. 이번에는 실기기 조작·운영 DB 쓰기를 요청하거나 실행하지 않았다.

- [ ] 기존120분 및180분 저장 코스를 변경→재변경해 원래 종료 날짜·시각 유지와 안내/화면 이동을 확인. 동일 빌드 증거가 있으면 재사용한다.
- [ ] 확인 화면에서 마감이 지난 뒤 실행 차단·기존 기록 유지, 명시 ‘시간 다시 설정’ 이동 및 unavailable 재시도 안내 확인. 장애 주입을 위해 운영 설정을 바꾸지 않는다.
- [ ] 미확인 native 항목만: 오늘/내일 휠 폭·큰 글씨/CTA 접근, 익일 날짜 표시, 카카오맵 왕복·잠금화면 Activity/OS 알림 및 종료 정리. 자동 fixture를 반복 수동 순회하지 않으며 개발 시각을 실제 학습/운행 증거로 쓰지 않는다.

### 인수인계

1. 변경 파일: `test/ui/qa-release-three-hour-save-date.test.mjs`의 원본 날짜 성공/근거 없음 거절 분리와 이 문서의 최신 결과만 수정.
2. 유지 계약: 원래 시작·종료 instant, 근거 없는 날짜 비추정·명시 거절, 최대180/2곳·기존120·체류/예산·계정/RLS·개인화 경계 불변. 제품 코드/migration 변경0.
3. 최종 자동 결과: 위 전 게이트 PASS. 최초 실패 재현과 소유 역할 보완 이력은 삭제하지 않았다.
4. 다음 담당: 통합/QA가 자동 수락 근거로 사용하고 최소 native 확인만 별도 회수. 신규 제품 결함 반환 없음. 운영 배포·DB migration·개인화 C/실제 서버 학습 성공은 이번 판정에 포함하지 않는다. stage/commit/push0.
