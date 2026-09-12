# U-RELEASE-EXIT-03 — 기록 없는 종료·안전 로그 인수인계

2026-09-09. RELEASE-DEPLOY-PREP-01 보완. **구현·자동 회귀·public iOS export 완료. 실기기 미확인.** SIGNING-PREP-03은 이 작업 완료 후 순차 진행한다.

## 1. 변경 파일 / 이전 방식과 교체 이유

- `src/ui/CourseConfirmScreen.tsx`: recorded=false → courses → MyCourses였던 과거 종료 경로가 현행 메인 복귀와 불일치했다. 명시적인 ‘기록 없이 마치기’만 home → resetToMain으로 교체했다. 성공은 record → ActivityRecord 유지. 종료 코스를 뒤로가기로 다시 여는 일을 막기 위해 Home 하나만 남기는 기존 reset 경계를 사용한다. 상태: 현행.
- `src/ui/ExecutionScreen.tsx`: hydration·알림·재계산 catch에서 원본 Error를 console에 전달하던 방식 → 민감한 내용을 포함할 수 있는 오류의 원문 전파 위험 → 각각 execution_hydration_failed / execution_notifications_failed / execution_replan_failed 고정 코드만 출력. 재계산 Alert도 원문 대신 고정 재시도 문구 사용. 실제 정보 유출이 발생했다는 판정이 아니라 합성 fixture로 확인한 경계 보완이다.
- `test/ui/place-course-screen-runtime.test.mjs`: 기존 기록 없는 종료 기대값 갱신 및 실제 mainTabNavigation reset 인자를 실행하는 실패 선행 fixture 추가.
- `test/ui/release-exit-logs.test.mjs`: 실제 Execution handler의 세 실패를 합성 오류로 실행해 로그·Alert 원문 비노출 검증.
- `test/map-transport-ui-contract.test.mjs`: 폐기된 resetToMyCourses 소스 기대값을 resetToMain 존재/legacy reset 부재로 갱신. 다른 계약은 유지.

## 2. 유지한 공개 계약 / 정책 경계

- 저장 실패 자체로 종료·이동하지 않는다. active를 유지하고 재시도 또는 현재 화면 대기가 가능하다. 기존 성공·재시도·LA 완료 경로와 표시 디자인은 유지한다.
- 명시적인 기록 없는 종료는 terminal=incomplete, active 정리, 완료 기록 추가 없음, 학습 완료 sync 없음. 중복 탭은 한 번만 처리한다. Home 단일 reset의 routes에는 종료 화면이 없고 active도 비워 뒤로가기로 복원할 대상이 없다.
- App.tsx/nav.ts/mainTabNavigation.ts, DB/repository, 추천·외부 API·개인화·native/LA 코드는 이 작업에서 수정하지 않았다. legacy 화면/저장 코스/provider를 전역 삭제하지 않았다.

## 3. 테스트 / 결과

- 실패 선행: 이전 목적지가 MyCourses인 실제 reset과 기존 no-record 기대값에서 실패(`/private/tmp/timefit-exit03-red.log`). 합성 민감 오류가 console 인자로 전달되는 실패도 재현(`/private/tmp/timefit-exit03-logs-red.log`). Execution fixture는 courseId와 정규 UTC 종료시각을 제공하도록 바로잡은 뒤 세 handler 모두 실행했다.
- 실제 화면 fixture: 저장 실패 후 active/화면 유지 → 명시적 no-record 중복 탭 → Home 단일 RESET 1회, terminal=incomplete 1회, active=null, 완료 학습 sync=0. 기존 1·2곳 성공/실패/재시도 및 LA 최종 완료 fixture도 전체 UI 회귀에서 통과.
- `npm run test:typecheck` PASS (`/private/tmp/timefit-exit03-type.log`).
- `npm run test:ui`: 707건, 706 PASS·기존 1 skip·실패0 (`/private/tmp/timefit-exit03-ui.log`).
- `npm test`: 최종 373/373 PASS (`/private/tmp/timefit-exit03-core-final.log`). 초회에 과거 resetToMyCourses 소스 기대값이 남아 실패하여 현행 계약으로 갱신 후 전체 재실행했다.
- `node scripts/release-build.cjs export`: public iOS export PASS (`/private/tmp/timefit-exit03-export.log`). `/private/tmp/timefit-public-export` 감사: 37파일, 알려진 서버 전용 credential0·개인키 패턴0, 기존 공개 provider alias2 별도 분류, Supabase/CAPTCHA endpoint 포함 확인(값 비출력). bundle SHA256 `ce0df091d5d673fc1768e92bb75bdb41ebbcb2d1a9963a6c88ee594505f5b670`.
- `git diff --check` PASS. 운영 쓰기/API 호출·Simulator·설치·commit/push0. JS export는 App Store IPA 또는 새 native Archive 완료를 의미하지 않는다. NATIVE-02의 이전 Archive에는 이번 JS 변경이 포함되지 않는다.

## 4. 다음 결정 / 위험 / API·QA 인계

- API: 공개 CourseConfirm의 명시적 기록 없는 종료 → MyCourses 경로는 닫혔다. 하지만 legacy MyCourses/Execution 등록과 Execution의 파라미터 부재 시 MyCourses 복귀 버튼 등 별도 entry는 남는다. 모든 legacy 도달 불가 또는 TMAP/ODsay 전송0으로 확대 해석하지 않는다. 공급자 고지는 API 사실표와 별도 검토한다.
- QA: 최종 공개 후보에서 저장 실패 후 대기/재시도, 명시적인 기록 없는 종료 후 메인·뒤로가기, 성공 시 기록 탭을 제한 확인한다. 운영 기록을 일부러 손상시키거나 신규 코스를 반복 생성하지 않고 고정 실패 harness 또는 승인된 제한 확인을 사용한다. 이번 자동 검증을 실기기 PASS로 기록하지 않는다.
- 다음 작업은 U-RELEASE-SIGNING-PREP-03. Distribution 자격·공개 링크/아이콘·최종 후보 QA는 별도이며 동일 Development Archive를 반복 생성하지 않는다.
