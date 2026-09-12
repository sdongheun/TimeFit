# ENGINE-RELEASE-180-01 — 출시 3시간 엔진 검증

부모: [DEC-RELEASE-180-01](../integration-decision/release-three-hour-two-stop.md). 2026-09-08 엔진 범위 완료. UI 연결·출시 통합 완료를 의미하지 않는다.

## UIUX 선행 인계

- 엔진 one-stop `validateInput`과 pair `prepare`는 이미 정수 1~180분을 지원한다. 181분에서 one-stop은 RangeError, pair는 continuation_unavailable 결과로 종료한다. route 호출 전 경계다. UI의 `releaseTimeBoundary.ts` 120분은 별도 입력 제한이며 UI 소유다.
- 시간은 날짜를 포함한 `now: Date`와 `remainingMin`으로 주입한다. 최종 기준시각은 `now + remainingMin * 60000`이며 `totalMin = travelMin + stayMin + arrivalBufferMin`, `remainingAfterCourseMin = remainingMin - totalMin`이다. 23:59로 자르지 말고 ISO snapshot의 익일 날짜를 표시해야 한다.
- release one-stop/pair entry를 유지한다. legacy planner 공간 분기와 courseV1의 120분 tier 분기는 상한이 아니므로 변경하지 않는다. 긴 입력을 legacy mixed 1~3곳 entry로 연결하지 않는다.
- 운영시간은 기기 로컬 날짜/요일 기준이다. 익일 휴무와 자정 통과의 실제 fixture 결과는 아래 완료 인계에서 확정한다.

## 완료 인계 — 2026-09-08, 선행 인계 이후

### 1. 변경 파일과 목적

- `src/engine/courseV1.ts`: `isAvailable`의 alwaysAccessible 방문도 도착부터 퇴장 직전까지 모든 날짜의 dayTypes를 확인한다. 상한·체류 계산은 수정하지 않았다.
- `test/release-three-hour-engine.test.ts`: 공개 출시 one-stop/더보기/pair entry에 고정 시각·장소·exact receipt를 주입하는 순수 fixture 6건 추가. 실제 네트워크와 legacy route는 사용하지 않는다.
- 본 문서: UI 선행 시간 계약, 조사 근거와 완료 인계 기록.

변경 이력: 도착일만 확인 → 금요일 23:55 도착 후 토요일 00:25까지 평일 전용 장소 체류를 허용하는 실패 재현 → 방문 구간 `[arrival, departure)`의 모든 날짜 확인 → 익일 휴무 침범을 막되 정확히 자정에 나가는 방문은 허용 → 현행 구현·회귀 통과. 최초 신규 5개 테스트 중 해당 반례 1개 실패, 수정 후 통과했으며 이후 pair 익일 fixture를 추가했다. 이는 긴 입력만의 문제가 아니며 짧은 입력에서도 잘못 허용되던 휴무 침범을 바로잡는다.

### 2. 유지한 계약과 조사 근거

| 위치 | 판정·유지 이유 |
| --- | --- |
| `src/ui/timeSetup/releaseTimeBoundary.ts` | 조사 시 RELEASE_MAX_MINUTES=120. UI 입력 상한이며 엔진 역할에서 수정하지 않음. UI 세션이 180/181 및 복구 입력 경계를 연결해야 함. |
| `src/engine/courseV1.ts`의 `validateInput` | 기존 정수 1~180 허용. 181은 RangeError, route 0. buffer는 양의 정수이며 remainingMin보다 작아야 함. 불필요한 상한 수정 없음. |
| `src/engine/twoStopSelectionV1.ts`의 `prepare` | 기존 180 허용, 181은 continuation_unavailable, route 0. 공개 실패 형태 유지. |
| `src/engine/planner.ts`의 <=120 공간 분기 및 >=180 limit | legacy planner 범위 분기이지 입력 상한이 아님. 실제 출시 V1 one-stop/pair 호출 경로와 분리되어 있으므로 변경 없음. |
| `src/engine/courseV1.ts`의 <=120 tier 분기 | 기존 tier 검증 정책으로 출시 전용 single/pair entry가 사용하는 입력 상한이 아님. 변경 없음. |

실제 UI 연결은 `src/ui/recommendation/v1Session.ts`의 `buildReleaseOneStopRepresentativeCourseV1` 기본 선택과 `twoStopSelectionEnginePort.ts`의 `beginReleaseTwoStopSelectionV1`에서 확인했다. 내부 B12/legacy mixed 3곳 조립으로 연결을 바꾸지 않았다.

119/120 및 121~180의 모든 정수 입력에서 동일 fixture는 single 1곳·체류30분·receipt4회, pair 2곳·체류60분·여유 포함 총85분·single 포함 receipt10회다. 남는 시간이 커져도 체류 자동 연장이나 호출 증가가 없다. dense 12후보의 첫 요청8회·더보기 최대8회 및 single-only 결과를 검증했다. pair 자동16/전체36 attempt 상한, 기존 ledger·개인화·최소/권장 체류·최적 순서·공개 export와 snapshot 형태는 변경하지 않았다. fixture 호출 수는 고정 receipt당 provider attempt1의 검증값이며 실 API 평균 호출량 주장이 아니다.

### 3. 테스트 결과

- 신규 파일 단독: 6/6 통과. 119/120, 121~180 전체, 181 무호출 거절, dense 더보기, 자정·익일 휴무·정확한 자정 종료·pair 익일 날짜 포함.
- `node --import tsx --test test/release-three-hour-engine.test.ts test/dwell-personalization.test.ts test/dwell-personalization-course.test.ts test/release-two-stop-selection.test.ts test/release-one-stop-pagination.test.ts test/course-v1.test.ts test/course-v1-limited-integration.test.ts`: 110/110 통과. 기존 짧은 입력·개인화 fail-safe·호출 예산·선택형 pair 회귀 포함.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 624건 중 623 통과, 1 skip, 실패0.
- `npm test`: 291/291 통과.
- `git diff --check`: 통과.

운영 API 호출·DB 변경·stage/commit/push 없음. 다른 세션의 기존 변경분은 보존했다. 전체 테스트 수치는 현재 공유 작업 트리 기준이며 고정 revision 출시 QA를 대체하지 않는다.

### 4. 남은 위험과 다음 결정

- UI 상한·시간 휠·복구 입력·testClock의 23:59 clamp 제거·익일 표시·알림/Live Activity는 UI 소유 작업이다. 엔진은 Date/ISO의 익일 날짜를 유지하며 이를 같은 날로 축약하면 안 된다. UI·API/DB 영향 확인 및 최종 QA 전까지 3시간 출시 제공 완료로 표시하지 않는다.
- `canPossiblyOpen`은 현재 요일/시각으로 사전 선별한다. 예: 금요일 밤 요청에서 토요일에만 여는 장소는 실제 도착이 토요일이어도 사전 제외될 수 있다. 이는 보수적 누락이며 이번에 다음 날 탐색·후보/호출량 확대 정책으로 바꾸지 않았다.
- scheduled windows는 당일 분 단위 구간이며 자정 양쪽 구간을 이어 붙이지 않는다. 평일 `[0,1440]` fixture는 자정 정확 종료를 허용하고 초과 체류는 줄이거나 제외한다. 밤샘 영업의 일반적 지원은 데이터 표현·선별 계약 결정이 필요하다. 운영시간을 임의 완화하지 않았다.
- 요일 계산은 기기 로컬 Date 기준이다. 부산 시간대와 다른 기기 시간대, 공휴일·특정 날짜 휴무는 이번 weekday/weekend fixture가 보장하지 않는다. 시간대/캘린더 정책 확장은 별도 결정 항목이다.
