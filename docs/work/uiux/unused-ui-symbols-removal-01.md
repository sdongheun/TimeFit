# U-UNUSED-UI-SYMBOLS-REMOVE-01 UIUX 인수인계

2026-09-14 / 기준 `19732ca` / UIUX 구현·집중 검증 완료, **QA 소유 테스트 이관 대기**. 전체 통과·통합 수락으로 보고하지 않는다.

실행 기준: `docs/work/qa-release/unused-ui-symbols-removal-01.md`. 이전 미사용 UI·알림 삭제를 다시 수행하지 않았다.

## 1. 변경 파일과 목적

이전: 현재 파일 안에 과거 화면 route·일정 생성·추천 wrapper 선언을 보관 → 관찰: 제품·스크립트·서버에서 호출이 없지만 현재 Kakao 타깃과 continuation 저장소에는 공유 의존성이 존재 → 교체: 미사용 심볼만 제거하고 공유 경계를 분리/보존 → 이유: 현행 동작 변경 없이 폐기된 흐름 혼동을 줄임 → 상태: 구현 완료, QA 이관 대기. 과거 선언 보존 방식은 철회이며 화면 복원 근거가 아니다.

| 파일 | 변경 |
| --- | --- |
| `src/ui/nav.ts` | LegacyResults/MyCourses/Execution/Feedback, modeIcon, deviceLocationSnapshot 선택 선언, 소비자가 사라진 PlanCtx와 관련 import 제거 |
| `src/ui/execution/schedule.ts` | buildExecutionSchedule/currentMinuteOfDay 및 ExecutionScheduleInput/ExecutionSchedule/ExecutionStop 제거. KakaoRouteTarget을 동일한 `{ name: string; point: LatLon }`로 독립 |
| `src/ui/recommendation/v1Session.ts` | 탐색 page/verify/message wrapper, continueRecommendationSession, requestConditionalManualCourse와 전용 타입·주입 속성·import 제거 |
| `test/ui/unused-ui-symbols-removal.test.mjs` | AST 식별자로 제거 대상 부재·현행 필수 심볼·타깃 구조 검사 3건 추가 |
| `test/ui/execution-schedule.test.ts` | 폐기된 일정 누적 테스트 1건 제거, 현재 Kakao URL/fallback 2건은 직접 타깃 fixture로 유지 |
| `test/ui/exploration-results.test.ts` | 제거 wrapper 전용 4건 파일 삭제 |
| `test/ui/conditional-manual-ui.test.ts` | 제거 wrapper 전용 2건 파일 삭제 |
| `test/ui/test-clock-recommendation-diagnosis.test.ts` | 폐기된 conditional wrapper 결함 기록 1건만 제거. 실제/개발/QA 시각 전달·경로 응답·120/180분·익일·CAPTCHA 날짜 경계 4건 유지 |
| `test/ui/place-detail-and-optimized-course-flow.test.ts` | 추가 필드가 있는 과거 객체를 구조적 호환 fixture로 표현. 과거 좌표 마커 제외 검증 유지 |
| `test/ui/manual-location-restore.test.mjs` | 기존 저장 왕복 검사에 과거 deviceLocationSnapshot 및 알 수 없는 추가 필드 fixture 보강. 복원 거절/수동 출처 승격이 없음을 확인 |
| 이 문서 | 변경 및 QA 인계 |

제품·스크립트·plugins·supabase 참조 검색에서 제거 기호의 외부 제품 소비자가 없음을 확인했다. 타입 검사와 public bundling으로 정적 import/export 연결을 추가 확인했다. `Appointment`는 **TimeSetupScreen의 현재 useState 소비자가 있으므로 보존**했다. 삭제한 테스트 파일은 Git 기준 커밋에서 복구 가능하다.

## 2. 유지한 공개 계약·정책

- RecommendationSession의 현재 시간/출발/도착/예산 구조, 현행 route, fmtHM, Appointment 유지. 저장 validator와 repository는 수정하지 않음. 선택 필드 제거는 과거 데이터가 GPS임을 판정하거나 저장 데이터를 삭제하는 조치가 아님.
- Kakao 앱/HTTPS/browser URL, 수단, 반환값, 취소/오류 판정, 이벤트와 현재 이동 의사 선저장/도착 확인/Live Activity 흐름 유지.
- continuationInputs, runRecommendationSession, continueReleaseRecommendationSession, 대표/2곳 선택·seed·receipt·lock·공유 호출 예산·개인화 scope·internal B12·테스트 시각 유지.
- 기준 커밋과 TypeScript AST의 남은 선언 비교: schedule에서 달라진 선언은 KakaoRouteTarget만, v1Session은 RecommendationRuntimeDependencies의 전용 주입 속성만. **남은 함수 본문은 모두 동일**. nav의 변경된 남은 선언은 RecommendationSession/RootStackParamList뿐이다.
- 엔진 동명 기능/타입, API·DB·카탈로그·네이티브·정책, QA 소유 파일, 보드·중앙 문서 수정 없음. 기존 미추적 `output/`과 QA 명령 문서 보존. commit/push/배포 없음.

## 3. 실행 테스트와 결과

- 실패 선행: `node --test test/ui/unused-ui-symbols-removal.test.mjs` → **0 PASS / 3 FAIL**, 제거 전 실제 기호 존재로 실패. `/private/tmp/unused-symbols-before-failure.log`.
- 제품 변경 전 `npm run test:ui` → 기존 **786 PASS / skip 1**, 새 기대 실패 3건만 FAIL(총790). `/private/tmp/unused-symbols-before-ui.log`. 최초 sandbox 실행은 tsx IPC EPERM으로 막혀 권한 승인 후 재실행했다.
- 제거 후 동일 집중 검사 → **3 PASS**, `/private/tmp/unused-symbols-after-focused.log`.
- `npm run test:typecheck` → **PASS**, `/private/tmp/unused-symbols-typecheck.log`.
- 최종 `npm run test:ui` → **781 PASS / 0 FAIL / skip 1**, 총782. `/private/tmp/unused-symbols-final-ui.log`.
  - 기존786 − 전용8(일정1+탐색4+conditional2+시각 혼합파일의 폐기 wrapper1) + 새3 = 781.
  - 혼합 Kakao 2건, 날짜/시각 4건 보존. 저장 복원 기존1건에 반례 추가. 기존 skip은 `course-v1-journey.test.ts`의 철회된 순차 대표 교체 이력1건으로 변경 없음.
  - 현재 실행형 화면, 추천/더보기·2곳 선택, 앱/웹 취소·실패, Live Activity 최종 pending, 수동 위치 복원 관련 기존 UI 검증도 포함하여 통과.
- `npm test` → **FAIL**, 외부 러너 총545 / 543 PASS / 2 FAIL. `/private/tmp/unused-symbols-full.log`, 권한 확장 재실행 `/private/tmp/unused-symbols-full-unrestricted.log`도 동일.
  - 직접 실패는 `test/mixed-travel-contract.test.mjs:36`의 삭제된 `incomingMode: leg.mode ?? ctx.mode` 소스 요구 **1건**.
  - `test/index.js`의 하위 전체 발견 검사도 같은 실패를 전달하여 외부 요약에서2건으로 집계됨. 내부는545 / 544 PASS / 1 FAIL. 서로 다른 제품 결함2건이 아님. 권한 확장으로도 동일하여 sandbox 원인으로 판정하지 않는다.
  - 문서의 이전 기본542 PASS를 이번 통과 수치로 대체하지 않았다. 이번 기본 발견에는 새 `.test.mjs`3건도 포함된다.
- `node scripts/release-build.cjs export` → **PASS**, public iOS Hermes bundle 생성. `/private/tmp/unused-symbols-export.log`, 산출물 `/private/tmp/timefit-public-export`.
  - bundle: `_expo/static/js/ios/index-7f21034153650cc645b6bbcfe5a94652.hbc`
  - SHA-256: `4e8ccffebde7d1ea71d6e81749d69127357b989ad16b6ba5f2e0ddd0773d21a2`
  - 스크립트 기본 export 디렉터리 사용. Archive/IPA/서명/설치 검증 아님.
- `git diff --check` → PASS. 실제 공급자·운영 DB 호출, Simulator·실기기 실행 없음.

## 4. 다음 결정·위험·실기기 확인

**QA-UNUSED-UI-SYMBOLS-REMOVE-01 인계:** `test/mixed-travel-contract.test.mjs`의 마지막 테스트만 현행 계약으로 이관할 필요가 있다. 삭제된 legacy 일정 누적 코드 문자열 대신 `KakaoRouteTarget` 직접 fixture와 현재 verifiedCourseProgressModel의 leg/lastLeg mode → CourseConfirm openKakaoRouteWithFallback 전달을 검증한다. 같은 테스트의 현재 화면·progress mode 검사는 유지한다. UIUX의 `execution-schedule.test.ts`에는 walk/transit/car URL 및 app→HTTPS→browser 결과 검증이 이미 유지되어 있다. QA 파일을 수정하거나 skip/loader 완화로 실패를 숨기지 않았다.

QA 이관 후 typecheck/UI/전체/export/diff를 재실행하고 통합 수락한다. 그 전에는 전체 연결 완료/출시 준비 완료가 아니다. 추가 제품 삭제 필요 없음. 수정 번들의 실기기 추천→더보기→선택, Kakao 설치/미설치 길찾기·복귀, 진행/기록/재시작 복원은 미확인이다. 이 작업에서는 자동 고정 fixture만 확인했으며 기존 정상 실기기 동작을 이번 수정본 검증으로 대신 기록하지 않는다.
