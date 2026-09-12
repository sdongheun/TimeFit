# U-RELEASE-180-01 — 날짜를 보존하는 최대 180분 입력

2026-09-08 UIUX 구현·자동 검증 완료. 실행 기준: [DEC-RELEASE-180-01](../integration-decision/release-three-hour-two-stop.md). 최종 출시 QA/실기기 수락 완료를 뜻하지 않는다.

## 선행 마감·실패 재현

- U-PROFILE-AUTH-POLISH-02의 구현·자동 검증 마감을 [해당 문서](profile-management-auth-polish.md#작업-마감--2026-09-08)에 먼저 기록했다. 이후 프로필/인증 파일은 수정하지 않았다. 두 작업의 동시 편집 없음.
- 이전: 최대 120분, 실제/개발 도착 시각을 23:59로 clamp, 제출은 날짜 없는 `endMin - 현재 분` → 관찰: 23:59 + 180분이 잘리고 자정 후 제출은 잘못된 차이가 됨 → 교체: 180분 상한, 명시적인 오늘/내일 휠, 기준 날짜에 도착 분을 적용한 ISO 마감과 제출 ISO의 epoch 차이 → 이유: 월말/연말/자정도 동일 경계로 처리 → **현행**. 120분 상한·23:59 clamp는 철회, 120분 입력/fixture는 유지.
- 제품 수정 전 실제 TimeSetupScreen handler fixture를 추가했다. `/private/tmp/timefit-180-failure.log`: 34건 중 기존 33 통과, 신규 자정/180 표시 1 실패. 구현 뒤 성공으로 전환했다.
- 회귀에서 과거 121분 거절·23:59 clamp·최대 2시간을 고정한 테스트가 실패하여, 기존 120분 사례를 유지하고 현행 180/181 및 날짜 보존 기대값으로 교체했다. UI 밖 엔진 테스트는 수정하지 않았다.

## 확인한 엔진·API 인계

- [ENGINE-RELEASE-180-01](../recommendation-engine/release-three-hour-verification.md) 완료 인계 확인: 출시 one-stop/pair 입력 정수 1~180, `now: Date`, 마감 `now + remainingMin`, ISO snapshot 익일 보존. 181 거절, 최대 2곳, 여유 포함 합산·기존 provider 예산 유지. UI는 이 공개 계약을 소비한다.
- [API-RELEASE-180-CHECK](../external-api/release-three-hour-impact.md): 180/익일을 막는 요청·cache TTL 상한 없음. **공개 route port에 예정 출발 날짜/시각이 없으므로 익일 대중교통 운행·막차를 보장하지 않는 기존 한계**는 남아 있다. UI가 임의 날짜 인자를 추가하거나 운행 보장을 표시하지 않았다.
- 이번 확인 시 DB-RELEASE-180-CHECK 완료 인계는 찾지 못했다. DB 전체 제약 감사·QA-RELEASE-180-01 최종 고정 revision 검증은 통합 세션 확인 사항이다. UI 자동 검증 완료와 전체 출시 수락을 구분한다.

## 완료 인수인계

### 1. 변경 파일과 목적

- `src/ui/timeSetup/releaseTimeBoundary.ts`: 최대 180분·3시간 오류, 정수 입력 검증. preset 기본/상한 180.
- `src/ui/timeSetup/testClock.ts`: 개발 기본 도착값 now+180, 23:59 clamp 제거.
- `src/ui/timeSetup/datedSetupTime.ts`: 날짜 포함 deadline, epoch 기반 잔여 분, 익일/날짜 표시 순수 경계.
- `src/ui/TimeSetupScreen.tsx`: 오늘/내일 열을 기존 상시 휠 안에 연결(추가 세로 영역 없음), 24시 이상 오전/오후 정상화, 실제 클릭 시각 재검증, 개발 시각의 적용 날짜 고정, 실제 시각 복원 시 현재 날짜 새 캡처. loading/최대 3시간 표시. 개발 도구·기존 QA 8개 입력은 유지.
- `src/ui/recommendation/v1Session.ts`: 직접 추천 session도 1~180 검증을 personalization/auth/route port 준비 전에 수행.
- `src/ui/activeVerifiedCourseStorage.ts`: 복구 session의 정수 1~180 검증, 기존 120 코스 및 저장 형식 유지.
- `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: 같은 session의 날짜/마감 표시(예: `1/1 2:59 (익일)`). 복귀 후에도 상대적인 ‘내일’만으로 오해하지 않도록 실제 월/일 병기.
- `src/ui/recommendation/TimeJourney.tsx`: 기존 시간 여정에도 익일 분 오프셋 표시 유지.
- 테스트: `test/ui/release-three-hour-time.test.ts`, `test/ui/release-three-hour-progress.test.mjs` 신규. `test/ui/time-setup-clock.test.ts`, `test/ui/test-clock-recommendation-diagnosis.test.ts`, `test/ui/unified-time-route-setup.test.mjs`, `test/ui/place-course-screen-runtime.test.mjs`, `test/map-transport-ui-contract.test.mjs` 확장/현행 기대값 반영.
- 이 문서만 새 180 작업 인계로 작성. 기존 작업 파일의 다른 세션 변경은 보존했으며 보드·중앙 정책 문서를 수정하지 않았다.

### 2. 변경하지 않은 계약·정책

- 최대 2곳, 체류·최소 체류·개인화 배정, 도착 여유 기본10/범위5~30/step5 유지. 출발 5분 전, snooze 5분/1회, 이동별 도착 유예 3~10분을 늘리지 않았다.
- Live Activity/알림 제품 구현, App Intent/receipt/공유 상태, 실제 카카오맵 handoff 성공·실패·복구 계약은 변경0. 180 snapshot을 기존 연결부가 그대로 소비함을 고정 fixture로 확인했다.
- 엔진/API/DB/repository/카탈로그/계정·동의·학습 실제 시각 검증 변경0. 개발 테스트 시각을 인증·학습 시각으로 승격하지 않았다. 조건부 장소 실제10~18시 정책 유지.
- 기존 QA launcher 8개/120분 fixture, 120분 진행 코스 저장 schema·courseRunId·stop 순서 유지. 기존120 문자열길이/padding/timeout/tier 일괄 치환 없음.
- 운영 데이터/실제 API/Simulator/실기기 자동 실행0. stage/commit/push0.

### 3. 검증 결과

- 실제 화면 handler: 0/1/120/121/179/180/181 경계, 자정 후 제출(23:59→00:00 잔여179), 개발23:59+180→익월1일02:59, 실제 날짜가 바뀌어도 개발 기준 날짜 고정, CAPTCHA 대기 후 잔여 재검증, 실제 시각 복원/QA 8개 기존 경로 통과.
- 순수 경계: 월말/연말 익일, 마감 경과 음수 정상 거절, 직접181 session은 personalization 읽기0, 날짜 표시 통과. 분 단위 엔진 계약에 맞춰 제출의 남은 초는 **내림**하여 선택 마감을 넘기지 않는다(예: 정확180분에서 1초 경과하면179분; 유예를 더하지 않음).
- 120/180 × 1/2곳 4 fixture: 실제 active decoder 복구 및181 거절 → buildLiveCoursePlan → 로컬 상태 → **실제 composition의 Activity payload 변환/실제 notification sync** 실행. 네이티브/예약 포트만 메모리 대체. 익년 날짜 epoch 일치, 체류20/도착여유10 유지, 이동10 알림 유예3 유지, 남은 이동·이후 체류·여유·5분을 한 번씩 빼는 출발 예약 확인. 실기기 ActivityKit 표시/OS 알림 전달 검증과는 다르다.
- 실제 CourseConfirm 컴포넌트의 익일 표시 테스트 통과. 기존 지도·세로 카드·선택·복귀·진행/삭제/인증 회귀 유지.
- `npm run test:typecheck`: 통과 (`/private/tmp/timefit-180-typecheck.log`).
- `npm run test:ui`: 636건, 635 통과·기존1 skip·실패0 (`/private/tmp/timefit-180-ui.log`).
- `npm test`: 301건 통과, 실패0 (`/private/tmp/timefit-180-all.log`).
- `git diff --check`: 통과.
- `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-180-final-ios`: 성공 (`/private/tmp/timefit-180-export.log`). JS/Hermes export이며 네이티브 재빌드·실기기 수락으로 표기하지 않는다.

### 4. 다음 결정·위험·최소 실기기 확인

1. 작은 화면/큰 글씨에서 오늘·내일/오전·오후/시/분 휠의 폭·선택 접근성과 기존 footer 접근 확인. 실제 현재 시각 기준 180분 허용/181분 오류, 23:59→익일02:59 입력 및 결과·확인 날짜 표시 확인. 개발 테스트 시각은 기존 개발 영역에서 설정하며 실제 동선/학습 검증에 사용하지 않는다.
2. 기존 실제120분 진행 코스 이어가기 유지. 새 실제180분 1곳/2곳 코스에서 첫 길찾기→Activity 시작, 도착 확인, 출발→카카오맵 자동 연결, 익일 알림 날짜/최종 목적지/종료 정리의 제한 실기기 확인. 자동 테스트만으로 OS 외부 전환·잠금화면 전달 성공을 주장하지 않는다.
3. 180을 만들기 위해 체류·유예를 늘리지 않는다. 남는 입력이 늘어도 추천 다양성/야간 운행을 보장하지 않는다. 추천 엔진 인계의 다음날만 운영 장소 보수적 누락/예정시각 없는 route port 한계는 통합 판단 대상이다.
4. DB 영향 인계 도착 및 QA 최종 대상 revision 고정 후 통합 수락. 기존 프로필 시각 보완의 실기기 미확인도 별도 유지한다.
