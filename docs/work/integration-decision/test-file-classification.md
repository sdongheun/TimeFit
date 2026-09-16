# 테스트 파일 필요성 분류 — 2026-09-14

## 결론과 범위

기준: `a2c2993` 이후 현재 작업 트리. 미커밋 UI 심볼 정리·QA 이관도 반영한 **정적 1차 분류**다. 출시 IPA의 테스트 커버리지 보고서가 아니다.

- `test/`의 파일 227개를 목록화했다. 이 중 `*.test.ts` / `*.test.mjs`는 **200개**, 실행기·fixture·지원 파일은 **27개**다.
- 모든 테스트 파일의 import·검증 대상·테스트 제목/참조를 훑고, 과거 기능 의심 파일은 본문과 제품 호출 지점을 추가 대조했다.
- 보존 판정은 “현재 또는 보존 중인 계약을 지키므로 삭제 근거가 없다”는 뜻이다. 모든 assertion의 중복·품질·실기기 정확성까지 인증한 것이 아니다.
- 이번에는 **테스트·기능 코드·실행 명령을 수정하거나 삭제하지 않았다.** 전체 회귀·운영 API·DB·실기기 실행도 하지 않았다.

| 판정 | 파일 수 | 처리 원칙 |
| --- | ---: | --- |
| 현행·공통 보존 | 147 | 기능·데이터·인증·저장·출시 설정 검증 유지 |
| 재발 방지 보존 | 13 | 제거한 기능이나 공급자가 다시 연결되지 않는지 검사 |
| 개발·진단 보존 | 15 | 내부 도구가 남아 있는 동안 안전성·출시 미노출 검증 유지 |
| 이관 검토 | 13 | 과거 정책·현행 공통 검증 혼재. case별 이관 후 정리 |
| 별도 확인 | 7 | 도구·서버 함수·공통 코드의 보존 범위 확정 전 삭제 금지 |
| 조건부 정리 | 4 | 사용자 기능 연결이 없는 대상 함수와 함께 판단 |
| 불필요 | 1 | 실행 assertion 없는 skip 전용 파일. 삭제 후보 |

**파일 수를 테스트 케이스 수나 현재 기능 검증률로 해석하지 않는다.** 유지 175개도 서로 중복이 전혀 없다는 뜻은 아니다.

## 바로 구분할 수 있는 사항

### 실행 검증이 없는 파일

`test/ui/course-v1-journey.test.ts`는 철회 이력을 남긴 `test.skip` 한 건뿐이다. 이력은 문서·Git으로 보존할 수 있으므로 현재 자동 검증 파일로는 불필요하다. 다만 삭제 시 `package.json`의 명시 목록도 갱신해야 한다.

지원 파일 `test/ui/support/reselectLegacy.mjs`도 `test/src/scripts` 및 저장소 검색에서 선언 외 호출·참조가 발견되지 않았다. 이는 아래 200개 테스트 수에 포함하지 않은 **별도 지원 파일 정리 후보 1개**다. 실제 삭제 직전 동적 참조를 다시 확인한다.

### 파일 전체를 지금 삭제하면 안 되는 사례

- `location-picker-recovery-model.test.ts`: 앞부분의 GPS label/helper 검증은 과거지만 `pickerInitialCenter`는 현재 TimeSetup에서 사용한다. GPS라는 테스트 제목은 실제 GPS 취득이 남았다는 증거가 아니다.
- `location-label-display-model.test.ts`: `displayLocationLabel`은 MapPlacePicker에서 사용한다. `applyLatestLocationLabel`의 사용 여부와 분리해야 한다.
- `course-v1-route-geometry.test.ts`: 현행 release entry와 과거 representative entry가 섞여 있다. 경로 선 보존 검증 자체는 필요하다.
- `course-replan-contract.test.mjs`: 보존된 migration009 SQL 2건과 현행 수동 위치 복원 gate 1건이 섞여 있다.
- `execution-schedule.test.ts`: 이름은 과거 일정 생성기처럼 보이지만 현재 내용은 Kakao URL·앱/웹 fallback 검증이다. **보존**한다.
- `activity-summary.test.ts`: 과거 `summarizeCompletedActivities`만 검증한다. 현재 `loadCompletionHistory/summarizeActivityVisits`와 다른 함수다. 이 파일의 정리 후보 판정을 과거 기록 호환 전체 삭제로 확대하지 않는다.

### 과거 엔진 테스트를 현행 검증으로 오해하지 않기

현재 `v1Session.ts` 공개 경로는 `buildReleaseOneStopRepresentativeCourseV1`, 이어보기 및 명시 2곳 선택 흐름이다. 내부 B12는 별도 분기다.

반면 일부 테스트는 `buildRepresentativeCourseV1`, `buildLimitedRepresentativeCourseV1`, `continueLimitedRepresentativeCourseV1`의 자동 1·2·3곳 조합을 검증한다. 이들의 통과를 출시 최대 2곳 흐름의 검증으로 계산하면 안 된다. 그러나 같은 엔진 안에 운영시간·예산·중복 검증이 남아 있으므로 파일을 일괄 제거하지 않는다.

## 실행 목록에서 발견한 문제

`package.json`의 `test:qa:v1` 명령은 현재 존재하지 않는 `test/ui/course-v1-results-list.test.ts`를 참조한다. 경로 존재 검사로 확인했으며 명령 자체를 이번에 실행하지는 않았다.

- 이 경로와 skip 전용 journey 파일을 현행 테스트 목록에 맞춰 정리할 필요가 있다.
- 이것만으로 `npm test`나 `test:ui`가 현재 실패한다고 단정하지 않는다. 별도 실행 경로다.
- `test/index.js`는 TypeScript loader를 사용하는 테스트 발견 실행기이므로 보존한다.
- `screenRuntime.mjs`는 실제 TSX 이벤트를 고정 포트로 실행하는 테스트 지원 도구다. iOS/Yoga 렌더러가 아니므로 드래그·레이아웃의 실기기 검증을 대체하지 않는다.

## 파일별 분류

경로는 저장소 기준이다. “보존” 그룹의 근거는 검사 대상이며, import가 없을 때는 소스·SQL·설정 파일을 읽는 계약 검사일 수 있다. 폴더명 `ui`, 파일명 `legacy`만으로 판정하지 않았다.

### 불필요 — 1개

| 파일 | 판단 근거·후속 처리 |
| --- | --- |
| [test/ui/course-v1-journey.test.ts](../../../test/ui/course-v1-journey.test.ts) | 5줄 파일에 철회 시나리오 test.skip 한 건만 존재. 실행 assertion 없음. package.json 목록도 함께 정리 필요. |

### 조건부 정리 — 4개

| 파일 | 판단 근거·후속 처리 |
| --- | --- |
| [test/conditional-manual-course.test.ts](../../../test/conditional-manual-course.test.ts) | 현재 UI 소비가 없는 전용 엔진 기능의 단위 테스트. 해당 함수가 남아 있으므로 함수 보존 여부와 함께 결정; 지금 테스트만 삭제하지 않음. |
| [test/course-v1-exploration.test.ts](../../../test/course-v1-exploration.test.ts) | 현재 UI 소비가 없는 전용 엔진 기능의 단위 테스트. 해당 함수가 남아 있으므로 함수 보존 여부와 함께 결정; 지금 테스트만 삭제하지 않음. |
| [test/ui/activity-summary.test.ts](../../../test/ui/activity-summary.test.ts) | summarizeCompletedActivities만 검증. src에서는 선언 외 호출 미발견. 현행 loadCompletionHistory/summarizeActivityVisits 및 과거 기록 호환 자체와는 별개; 함수와 함께 판단. |
| [test/ui/one-stop-route-service.test.ts](../../../test/ui/one-stop-route-service.test.ts) | 현재 UI 소비가 없는 전용 엔진 기능의 단위 테스트. 해당 함수가 남아 있으므로 함수 보존 여부와 함께 결정; 지금 테스트만 삭제하지 않음. |

### 이관 검토 — 13개

| 파일 | 판단 근거·후속 처리 |
| --- | --- |
| [test/course-replan-contract.test.mjs](../../../test/course-replan-contract.test.mjs) | 앞 2건은 보존된 과거 migration009, 마지막은 현행 수동 위치 복원 gate. 현재 기능과 DB 호환 검증을 분리; 전체 삭제 금지. |
| [test/course-v1-candidate-provider.test.ts](../../../test/course-v1-candidate-provider.test.ts) | 현재 대표 후보 공급 검증은 유지. buildExplorationPageV1 및 과거 탐색 공급 검증만 분리 검토. |
| [test/course-v1-limited-integration.test.ts](../../../test/course-v1-limited-integration.test.ts) | 과거 limited·정책 비교/testOnly 검증과 내부 B12 관련 경계가 혼재. 내부 진단까지 포함해 case 단위 분리 필요. |
| [test/course-v1-pagination.test.ts](../../../test/course-v1-pagination.test.ts) | 과거 자동 다장소/limited entry 또는 해당 fixture를 검증. 출시 single→명시 pair entry와 다름. 시간·예산·중복 등 유효 검증을 현행 entry로 옮긴 후 정리. |
| [test/course-v1-route-geometry.test.ts](../../../test/course-v1-route-geometry.test.ts) | 현행 release entry와 과거 buildRepresentativeCourseV1가 혼재. geometry 검증을 삭제하지 말고 과거 entry 사용 case 이관. |
| [test/course-v1.test.ts](../../../test/course-v1.test.ts) | 과거 자동 다장소/limited entry 또는 해당 fixture를 검증. 출시 single→명시 pair entry와 다름. 시간·예산·중복 등 유효 검증을 현행 entry로 옮긴 후 정리. |
| [test/qa-results-verified-course-harness.test.ts](../../../test/qa-results-verified-course-harness.test.ts) | 과거 자동 다장소/limited entry 또는 해당 fixture를 검증. 출시 single→명시 pair entry와 다름. 시간·예산·중복 등 유효 검증을 현행 entry로 옮긴 후 정리. |
| [test/qa02-recommendation-harness.test.ts](../../../test/qa02-recommendation-harness.test.ts) | 과거 자동 다장소/limited entry 또는 해당 fixture를 검증. 출시 single→명시 pair entry와 다름. 시간·예산·중복 등 유효 검증을 현행 entry로 옮긴 후 정리. |
| [test/qa03-supply-diversity.test.ts](../../../test/qa03-supply-diversity.test.ts) | 과거 자동 다장소/limited entry 또는 해당 fixture를 검증. 출시 single→명시 pair entry와 다름. 시간·예산·중복 등 유효 검증을 현행 entry로 옮긴 후 정리. |
| [test/qa03r-real-provider-preselection.test.ts](../../../test/qa03r-real-provider-preselection.test.ts) | 과거 자동 다장소/limited entry 또는 해당 fixture를 검증. 출시 single→명시 pair entry와 다름. 시간·예산·중복 등 유효 검증을 현행 entry로 옮긴 후 정리. |
| [test/qa05-proxy-runtime-integration.test.ts](../../../test/qa05-proxy-runtime-integration.test.ts) | 과거 limited·정책 비교/testOnly 검증과 내부 B12 관련 경계가 혼재. 내부 진단까지 포함해 case 단위 분리 필요. |
| [test/ui/location-label-display-model.test.ts](../../../test/ui/location-label-display-model.test.ts) | displayLocationLabel은 MapPlacePicker에서 사용. applyLatestLocationLabel은 src에서 선언 외 사용 미발견. GPS 문구와 미사용 case만 정리 검토. |
| [test/ui/location-picker-recovery-model.test.ts](../../../test/ui/location-picker-recovery-model.test.ts) | pickerInitialCenter는 TimeSetup에서 사용. GPS label/shared adapter와 상태 helper는 UI 호출이 발견되지 않음. 현행 수동 중심 선택 검증 보존. |

### 별도 확인 — 7개

| 파일 | 판단 근거·후속 처리 |
| --- | --- |
| [test/captcha-challenge-handler.test.ts](../../../test/captcha-challenge-handler.test.ts) | 현재 앱은 Cloudflare CAPTCHA Worker 사용. Supabase captcha-challenge의 실제 배포·외부 소비 여부는 소스만으로 확정 불가. 서버 함수와 함께 판단. |
| [test/planner-policy.test.mjs](../../../test/planner-policy.test.mjs) | 과거 planner/공통 엔진 경계. 현행 화면과는 분리되지만 scripts 및 travel/공통 함수 연결이 남음. 유지보수 도구 범위 확정 전 보존. |
| [test/ui/actual-route-scenarios.test.ts](../../../test/ui/actual-route-scenarios.test.ts) | 과거 planner/공통 엔진 경계. 현행 화면과는 분리되지만 scripts 및 travel/공통 함수 연결이 남음. 유지보수 도구 범위 확정 전 보존. |
| [test/ui/actual-route-search-scope.test.ts](../../../test/ui/actual-route-search-scope.test.ts) | 과거 planner/공통 엔진 경계. 현행 화면과는 분리되지만 scripts 및 travel/공통 함수 연결이 남음. 유지보수 도구 범위 확정 전 보존. |
| [test/ui/local-opening-gate.test.ts](../../../test/ui/local-opening-gate.test.ts) | 과거 planner/공통 엔진 경계. 현행 화면과는 분리되지만 scripts 및 travel/공통 함수 연결이 남음. 유지보수 도구 범위 확정 전 보존. |
| [test/ui/one-stop-recommendation.test.ts](../../../test/ui/one-stop-recommendation.test.ts) | 과거 planner/공통 엔진 경계. 현행 화면과는 분리되지만 scripts 및 travel/공통 함수 연결이 남음. 유지보수 도구 범위 확정 전 보존. |
| [test/ui/route-baseline-service.test.ts](../../../test/ui/route-baseline-service.test.ts) | 과거 planner/공통 엔진 경계. 현행 화면과는 분리되지만 scripts 및 travel/공통 함수 연결이 남음. 유지보수 도구 범위 확정 전 보존. |

### 보존(개발·진단) — 15개

| 파일 | 판단 근거·후속 처리 |
| --- | --- |
| [test/c-validation-preparation.test.ts](../../../test/c-validation-preparation.test.ts) | 내부 C 검증 도구의 계정 소유·승인·재시도·출시 비활성 경계. 사용자 화면 미노출만으로 삭제 불가. |
| [test/c-validation-recovery.test.ts](../../../test/c-validation-recovery.test.ts) | 내부 C 검증 도구의 계정 소유·승인·재시도·출시 비활성 경계. 사용자 화면 미노출만으로 삭제 불가. |
| [test/c-validation-runner.test.ts](../../../test/c-validation-runner.test.ts) | 내부 C 검증 도구의 계정 소유·승인·재시도·출시 비활성 경계. 사용자 화면 미노출만으로 삭제 불가. |
| [test/course-v1-route-adapter.test.ts](../../../test/course-v1-route-adapter.test.ts) | v1Session의 createLegacyRoutes로 연결된 비활성/개발 분기와 cache·timeout 계약. 출시 proxy 테스트와 분리하되 해당 분기 존재 중 보존. |
| [test/route-proxy-transit-all-routes.test.ts](../../../test/route-proxy-transit-all-routes.test.ts) | 내부 fixture·진단/테스트 시각 도구 검증. 공개 기능 회귀와 구분. 내부 도구 및 미노출·안전 경계가 남아 있으므로 보존. |
| [test/ui/c-validation-controls.test.ts](../../../test/ui/c-validation-controls.test.ts) | 내부 C 검증 도구의 계정 소유·승인·재시도·출시 비활성 경계. 사용자 화면 미노출만으로 삭제 불가. |
| [test/ui/c-validation-failure-diagnosis.test.ts](../../../test/ui/c-validation-failure-diagnosis.test.ts) | 내부 C 검증 도구의 계정 소유·승인·재시도·출시 비활성 경계. 사용자 화면 미노출만으로 삭제 불가. |
| [test/ui/c-validation-panel.test.ts](../../../test/ui/c-validation-panel.test.ts) | 내부 C 검증 도구의 계정 소유·승인·재시도·출시 비활성 경계. 사용자 화면 미노출만으로 삭제 불가. |
| [test/ui/c-validation-recovery-panel.test.ts](../../../test/ui/c-validation-recovery-panel.test.ts) | 내부 C 검증 도구의 계정 소유·승인·재시도·출시 비활성 경계. 사용자 화면 미노출만으로 삭제 불가. |
| [test/ui/live-activity-a3-verification.test.ts](../../../test/ui/live-activity-a3-verification.test.ts) | 내부 fixture·진단/테스트 시각 도구 검증. 공개 기능 회귀와 구분. 내부 도구 및 미노출·안전 경계가 남아 있으므로 보존. |
| [test/ui/live-activity-diagnostics.test.ts](../../../test/ui/live-activity-diagnostics.test.ts) | 내부 fixture·진단/테스트 시각 도구 검증. 공개 기능 회귀와 구분. 내부 도구 및 미노출·안전 경계가 남아 있으므로 보존. |
| [test/ui/qa-release-one-stop-launcher.test.ts](../../../test/ui/qa-release-one-stop-launcher.test.ts) | 내부 fixture·진단/테스트 시각 도구 검증. 공개 기능 회귀와 구분. 내부 도구 및 미노출·안전 경계가 남아 있으므로 보존. |
| [test/ui/recommendation-internal-diagnostics-model.test.ts](../../../test/ui/recommendation-internal-diagnostics-model.test.ts) | 내부 fixture·진단/테스트 시각 도구 검증. 공개 기능 회귀와 구분. 내부 도구 및 미노출·안전 경계가 남아 있으므로 보존. |
| [test/ui/test-clock-recommendation-diagnosis.test.ts](../../../test/ui/test-clock-recommendation-diagnosis.test.ts) | 내부 fixture·진단/테스트 시각 도구 검증. 공개 기능 회귀와 구분. 내부 도구 및 미노출·안전 경계가 남아 있으므로 보존. |
| [test/ui/time-setup-clock.test.ts](../../../test/ui/time-setup-clock.test.ts) | 내부 fixture·진단/테스트 시각 도구 검증. 공개 기능 회귀와 구분. 내부 도구 및 미노출·안전 경계가 남아 있으므로 보존. |

### 보존(재발 방지) — 13개

| 파일 | 판단 근거·후속 처리 |
| --- | --- |
| [test/api-odsay-removal.test.ts](../../../test/api-odsay-removal.test.ts) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/api-unused-services-removal.test.mjs](../../../test/api-unused-services-removal.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/db-unused-course-repository.test.mjs](../../../test/db-unused-course-repository.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/engine-odsay-removal.test.ts](../../../test/engine-odsay-removal.test.ts) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/legacy-course-auto-query.test.mjs](../../../test/ui/legacy-course-auto-query.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/legacy-four-screen-removal.test.mjs](../../../test/ui/legacy-four-screen-removal.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/odsay-removal-screen.test.mjs](../../../test/ui/odsay-removal-screen.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/qa-odsay-removal-execution.test.mjs](../../../test/ui/qa-odsay-removal-execution.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/release-manual-location.test.mjs](../../../test/ui/release-manual-location.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/unused-notifications-removal.test.mjs](../../../test/ui/unused-notifications-removal.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/unused-ui-removal-03.test.mjs](../../../test/ui/unused-ui-removal-03.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/unused-ui-removal.test.mjs](../../../test/ui/unused-ui-removal.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |
| [test/ui/unused-ui-symbols-removal.test.mjs](../../../test/ui/unused-ui-symbols-removal.test.mjs) | 폐기된 기능/공급자/GPS/자동 조회의 재도입을 막거나 현재 실행 보존을 검사. 없어진 기능을 다시 동작시키는 테스트가 아님. |

### 보존(현행·공통) — 147개

| 파일 | 판단 근거·후속 처리 |
| --- | --- |
| [test/activated-route-proxy-adapter.test.ts](../../../test/activated-route-proxy-adapter.test.ts) | 검사 대상: `src/services/routeProxyActivatedCourseAdapter`, `src/services/routeProxyClientAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/anonymous-auth-cleanup-migration-contract.test.mjs](../../../test/anonymous-auth-cleanup-migration-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/api-release-safety.test.ts](../../../test/api-release-safety.test.ts) | 검사 대상: `src/engine/routeBaselineService`, `src/services/kakaoLocationSearchAdapter`, `src/services/routeProxyClientAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/api-two-stop-route-budget.test.ts](../../../test/api-two-stop-route-budget.test.ts) | 검사 대상: `supabase/functions/route-proxy/handler`, `src/services/routeProxyActivatedCourseAdapter`, `src/services/routeProxyClientAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/area-availability-policy.test.mjs](../../../test/area-availability-policy.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/area-discovery-candidates.test.mjs](../../../test/area-discovery-candidates.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/busan-poi-catalog.test.mjs](../../../test/busan-poi-catalog.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/captcha-worker.test.ts](../../../test/captcha-worker.test.ts) | 검사 대상: `cloudflare/captcha-worker/src/index`. 현행/보존 계약 검증으로 유지. |
| [test/conditional-market-candidates.test.mjs](../../../test/conditional-market-candidates.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/course-completion-repository.test.ts](../../../test/course-completion-repository.test.ts) | 검사 대상: `src/services/courseCompletionRepository`. 현행/보존 계약 검증으로 유지. |
| [test/data-release-personalization.test.mjs](../../../test/data-release-personalization.test.mjs) | 검사 대상: `src/data/busan_poi_catalog.json`, `scripts/runtime_image_permission.mjs`. 현행/보존 계약 검증으로 유지. |
| [test/delete-account-adapter.test.mjs](../../../test/delete-account-adapter.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/delete-account-handler.test.ts](../../../test/delete-account-handler.test.ts) | 검사 대상: `supabase/functions/delete-account/handler`. 현행/보존 계약 검증으로 유지. |
| [test/dwell-personalization-course.test.ts](../../../test/dwell-personalization-course.test.ts) | 검사 대상: `src/engine`, `src/engine/dwellPersonalization`. 현행/보존 계약 검증으로 유지. |
| [test/dwell-personalization.test.ts](../../../test/dwell-personalization.test.ts) | 검사 대상: `src/engine/dwellPersonalization`. 현행/보존 계약 검증으로 유지. |
| [test/dwell-storage-contract.test.ts](../../../test/dwell-storage-contract.test.ts) | 검사 대상: `src/services/dwellPersonalizationRepository`, `src/services/dwellPersonalizationOutbox`, `src/services/accountIdentity`. 현행/보존 계약 검증으로 유지. |
| [test/evidence-profile-classification.test.mjs](../../../test/evidence-profile-classification.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/guest-import-pending-recovery.test.ts](../../../test/guest-import-pending-recovery.test.ts) | 검사 대상: `src/services/guestCompletionImportRepository`. 현행/보존 계약 검증으로 유지. |
| [test/guest-import-release-fix.test.ts](../../../test/guest-import-release-fix.test.ts) | 검사 대상: `src/services/guestCompletionImportRepository`. 현행/보존 계약 검증으로 유지. |
| [test/kakao-location-label-adapter.test.ts](../../../test/kakao-location-label-adapter.test.ts) | 검사 대상: `src/engine/kakao`, `src/services/kakaoLocationLabelAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/kakao-location-search-adapter.test.ts](../../../test/kakao-location-search-adapter.test.ts) | 검사 대상: `src/engine/kakao`, `src/services/kakaoLocationSearchAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/live-learning-evidence.test.ts](../../../test/live-learning-evidence.test.ts) | 검사 대상: `src/services/liveLearningEvidence`, `src/engine`, `src/services/releaseIdentityPersonalizationRuntime`. 현행/보존 계약 검증으로 유지. |
| [test/map-transport-ui-contract.test.mjs](../../../test/map-transport-ui-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/mixed-travel-contract.test.mjs](../../../test/mixed-travel-contract.test.mjs) | 검사 대상: `src/ui/execution/schedule.ts`, `src/ui/recommendation/verifiedCourseProgressModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/opening-hours-audit.test.mjs](../../../test/opening-hours-audit.test.mjs) | 검사 대상: `scripts/lib/openingHoursAudit.mjs`. 현행/보존 계약 검증으로 유지. |
| [test/place-search-adapter.test.ts](../../../test/place-search-adapter.test.ts) | 검사 대상: `src/engine/kakao`, `src/engine/travel`, `src/services/placeNameSemanticMatch`. 현행/보존 계약 검증으로 유지. |
| [test/private-walk-connector.test.ts](../../../test/private-walk-connector.test.ts) | 검사 대상: `src/services/privateWalkConnector`, `src/services/routeProxyClientAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/qa-course-geometry-connector-integration.test.ts](../../../test/qa-course-geometry-connector-integration.test.ts) | 검사 대상: `src/engine`, `src/services/privateWalkConnector`, `src/services/routeProxyClientAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/qa-course-geometry-integration.test.ts](../../../test/qa-course-geometry-integration.test.ts) | 검사 대상: `src/engine`, `src/services/routeProxyClientAdapter`, `src/services/routeProxyActivatedCourseAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/qa-release-one-stop-harness.test.ts](../../../test/qa-release-one-stop-harness.test.ts) | 검사 대상: `src/engine/courseV1`, `src/ui/timeSetup/releaseTimeBoundary`, `src/ui/qaReleaseOneStopLauncherModel`. 현행/보존 계약 검증으로 유지. |
| [test/qa-release-one-stop-more-results-harness.test.ts](../../../test/qa-release-one-stop-more-results-harness.test.ts) | 검사 대상: `src/engine`, `src/ui/recommendation/releaseOneStopMoreResultsModel`. 현행/보존 계약 검증으로 유지. |
| [test/qa-two-stop-integration.test.ts](../../../test/qa-two-stop-integration.test.ts) | 검사 대상: `src/engine`, `src/services/routeProxyClientAdapter`, `src/ui/recommendation/courseV1RouteGeometryModel`. 현행/보존 계약 검증으로 유지. |
| [test/recommendation-data-contract.test.mjs](../../../test/recommendation-data-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/release-account-contract.test.ts](../../../test/release-account-contract.test.ts) | 검사 대상: `src/services/accountIdentity`, `src/services/accountRegistrationRepository`, `src/services/accountProfileRepository`. 현행/보존 계약 검증으로 유지. |
| [test/release-identity-classification-contract.test.mjs](../../../test/release-identity-classification-contract.test.mjs) | 검사 대상: `src/data/busan_poi_catalog.json`. 현행/보존 계약 검증으로 유지. |
| [test/release-identity-device-flow.test.ts](../../../test/release-identity-device-flow.test.ts) | 검사 대상: `src/engine/dwellPersonalization`, `src/services/accountIdentity`, `src/services/courseCompletionRepository`. 현행/보존 계약 검증으로 유지. |
| [test/release-identity-lock-ownership.test.ts](../../../test/release-identity-lock-ownership.test.ts) | 검사 대상: `src/services/courseCompletionRepository`, `src/services/accountIdentity`, `src/services/releaseIdentityPersonalizationRuntime`. 현행/보존 계약 검증으로 유지. |
| [test/release-identity-migration-contract.test.mjs](../../../test/release-identity-migration-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/release-identity-priority-remediation.test.ts](../../../test/release-identity-priority-remediation.test.ts) | 검사 대상: `src/services/accountIdentity`, `src/services/courseCompletionRepository`, `src/services/dwellPersonalizationOutbox`. 현행/보존 계약 검증으로 유지. |
| [test/release-one-stop-pagination.test.ts](../../../test/release-one-stop-pagination.test.ts) | 검사 대상: `src/engine/courseV1`. 현행/보존 계약 검증으로 유지. |
| [test/release-one-stop-verified-course.test.ts](../../../test/release-one-stop-verified-course.test.ts) | 검사 대상: `src/engine/courseV1`. 현행/보존 계약 검증으로 유지. |
| [test/release-owned-completion.test.ts](../../../test/release-owned-completion.test.ts) | 검사 대상: `src/services/accountIdentity`, `src/services/accountCourseCompletionRepository`, `src/services/guestCompletionImportRepository`. 현행/보존 계약 검증으로 유지. |
| [test/release-three-hour-engine.test.ts](../../../test/release-three-hour-engine.test.ts) | 검사 대상: `src/engine`. 현행/보존 계약 검증으로 유지. |
| [test/release-two-stop-selection.test.ts](../../../test/release-two-stop-selection.test.ts) | 검사 대상: `src/engine`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-catalog-snapshot.test.ts](../../../test/route-proxy-catalog-snapshot.test.ts) | 검사 대상: `src/services/routeProxyCatalogSnapshot`, `src/data/courseV1CandidateProvider`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-client-adapter.test.ts](../../../test/route-proxy-client-adapter.test.ts) | 검사 대상: `src/services/routeProxyClientAdapter`, `src/services/routeProxyAnonymousAuth`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-deadline.test.ts](../../../test/route-proxy-deadline.test.ts) | 검사 대상: `supabase/functions/route-proxy/deadline`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-edge-contract.test.mjs](../../../test/route-proxy-edge-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/route-proxy-fetch-lease-migration-contract.test.mjs](../../../test/route-proxy-fetch-lease-migration-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/route-proxy-geometry-migration-contract.test.mjs](../../../test/route-proxy-geometry-migration-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/route-proxy-geometry.test.ts](../../../test/route-proxy-geometry.test.ts) | 검사 대상: `supabase/functions/route-proxy/handler`, `src/services/routeProxyClientAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-kakao-request.test.ts](../../../test/route-proxy-kakao-request.test.ts) | 검사 대상: `supabase/functions/route-proxy/kakaoRouteRequest`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-mode-budget-migration-contract.test.mjs](../../../test/route-proxy-mode-budget-migration-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/route-proxy-page-budget.test.ts](../../../test/route-proxy-page-budget.test.ts) | 검사 대상: `src/services/routeProxyClientAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-production-ports.test.ts](../../../test/route-proxy-production-ports.test.ts) | 검사 대상: `supabase/functions/route-proxy/handler`, `src/services/routeProxyProductionReceipt`, `src/services/routeProxyActivatedCourseAdapter`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-r2-edge-contract.test.mjs](../../../test/route-proxy-r2-edge-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/route-proxy-store-migration-contract.test.mjs](../../../test/route-proxy-store-migration-contract.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/route-proxy-timeout-behavior.test.ts](../../../test/route-proxy-timeout-behavior.test.ts) | 검사 대상: `supabase/functions/route-proxy/handler`. 현행/보존 계약 검증으로 유지. |
| [test/route-proxy-transit-terminal-completeness.test.ts](../../../test/route-proxy-transit-terminal-completeness.test.ts) | 검사 대상: `supabase/functions/route-proxy/handler`. 현행/보존 계약 검증으로 유지. |
| [test/short-stay-catalog.test.mjs](../../../test/short-stay-catalog.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/signup-api-failure.test.mjs](../../../test/signup-api-failure.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/signup-repository-failure.test.ts](../../../test/signup-repository-failure.test.ts) | 검사 대상: `src/services/accountRegistrationRepository`. 현행/보존 계약 검증으로 유지. |
| [test/targeted-representative-supply.test.mjs](../../../test/targeted-representative-supply.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/tourapi-representative-image-https.test.mjs](../../../test/tourapi-representative-image-https.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/active-verified-course-resume.test.ts](../../../test/ui/active-verified-course-resume.test.ts) | 검사 대상: `src/engine`, `src/ui/nav`, `src/ui/activeVerifiedCourseModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/captcha-recommendation-gate-model.test.ts](../../../test/ui/captcha-recommendation-gate-model.test.ts) | 검사 대상: `src/services/routeProxyActivatedCourseAdapter`, `src/ui/captchaRecommendationGateModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/captcha-verification-model.test.ts](../../../test/ui/captcha-verification-model.test.ts) | 검사 대상: `src/ui/captchaVerificationModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/completed-map-screen.test.ts](../../../test/ui/completed-map-screen.test.ts) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/course-completion-history.test.ts](../../../test/ui/course-completion-history.test.ts) | 검사 대상: `src/engine`, `src/services/courseCompletionRepository`, `src/ui/activeVerifiedCourseModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/course-date-screen-boundary.test.mjs](../../../test/ui/course-date-screen-boundary.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/course-route-start.test.mjs](../../../test/ui/course-route-start.test.mjs) | 검사 대상: `src/ui/liveActivity/courseProgressRuntimeModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/course-v1-card-detail.test.ts](../../../test/ui/course-v1-card-detail.test.ts) | 검사 대상: `src/engine`, `src/ui/nav`, `src/ui/recommendation/courseV1CardDetailModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/course-v1-discovery-context.test.ts](../../../test/ui/course-v1-discovery-context.test.ts) | 검사 대상: `src/ui/recommendation/courseV1DiscoveryContext`. 현행/보존 계약 검증으로 유지. |
| [test/ui/course-v1-outcome-message-model.test.ts](../../../test/ui/course-v1-outcome-message-model.test.ts) | 검사 대상: `src/ui/recommendation/courseV1OutcomeMessageModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/course-v1-place-preview.test.ts](../../../test/ui/course-v1-place-preview.test.ts) | 검사 대상: `src/ui/recommendation/courseV1PlacePreviewModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/course-v1-route-geometry.test.ts](../../../test/ui/course-v1-route-geometry.test.ts) | 검사 대상: `src/engine`, `src/ui/nav`, `src/services/privateWalkConnector`. 현행/보존 계약 검증으로 유지. |
| [test/ui/current-course-start-expiry.test.mjs](../../../test/ui/current-course-start-expiry.test.mjs) | 검사 대상: `src/ui/activeVerifiedCourseModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/current-flow-refactor-safety.test.mjs](../../../test/ui/current-flow-refactor-safety.test.mjs) | 검사 대상: `src/ui/activeVerifiedCourseModel.ts`, `src/ui/courseCompletionUiModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/execution-schedule.test.ts](../../../test/ui/execution-schedule.test.ts) | 검사 대상: `src/engine`, `src/ui/execution/schedule`. 현행/보존 계약 검증으로 유지. |
| [test/ui/global-interaction-motion.test.ts](../../../test/ui/global-interaction-motion.test.ts) | 검사 대상: `src/ui/inPlaceTransitionModel`, `src/ui/arrivalBufferInteraction`, `src/ui/pressInteractionModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/guest-import-record-display.test.ts](../../../test/ui/guest-import-record-display.test.ts) | 검사 대상: `src/ui/ownedRecordsModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/history-final.test.mjs](../../../test/ui/history-final.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/history-polish.test.ts](../../../test/ui/history-polish.test.ts) | 검사 대상: `src/ui/historySwipeMotion`, `src/ui/historyCategoryFilter`. 현행/보존 계약 검증으로 유지. |
| [test/ui/history-swipe.test.mjs](../../../test/ui/history-swipe.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/live-activity-action-display.test.mjs](../../../test/ui/live-activity-action-display.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/live-activity-config-plugin.test.mjs](../../../test/ui/live-activity-config-plugin.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/live-activity-course-runtime.test.ts](../../../test/ui/live-activity-course-runtime.test.ts) | 검사 대상: `src/ui/liveActivity/courseProgressRuntimeModel`, `src/ui/activeVerifiedCourseModel`, `src/ui/recommendation/verifiedCourseProgressModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/live-activity-final-native-port.test.mjs](../../../test/ui/live-activity-final-native-port.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/live-activity-final.test.ts](../../../test/ui/live-activity-final.test.ts) | 검사 대상: `src/ui/liveActivity/pendingCompletionModel`, `src/ui/liveActivity/completionAuthorization`, `src/ui/personalizationComposition`. 현행/보존 계약 검증으로 유지. |
| [test/ui/live-activity-lifecycle-policy.test.ts](../../../test/ui/live-activity-lifecycle-policy.test.ts) | 검사 대상: `src/ui/liveActivity/lifecyclePolicy`. 현행/보존 계약 검증으로 유지. |
| [test/ui/live-activity-local-progress.test.ts](../../../test/ui/live-activity-local-progress.test.ts) | 검사 대상: `src/ui/liveActivity/localProgressModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/live-activity-native-policy.test.mjs](../../../test/ui/live-activity-native-policy.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/live-activity-notification-ownership.test.mjs](../../../test/ui/live-activity-notification-ownership.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/live-activity-pending-navigation.test.ts](../../../test/ui/live-activity-pending-navigation.test.ts) | 검사 대상: `src/ui/manualLocationRestoreModel`, `src/ui/activeVerifiedCourseModel`, `src/ui/liveActivity/pendingNavigationHandoffModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/live-activity-terminal-cleanup.test.ts](../../../test/ui/live-activity-terminal-cleanup.test.ts) | 검사 대상: `src/ui/liveActivity/terminalCleanupModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/live-learning-integration.test.ts](../../../test/ui/live-learning-integration.test.ts) | 검사 대상: `src/ui/ownedCourseLifecycle`, `src/ui/liveActivity/learningEvidenceCoordinator`, `src/ui/liveActivity/courseProgressRuntimeModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/live-learning-native.test.mjs](../../../test/ui/live-learning-native.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/location-search-interaction.test.mjs](../../../test/ui/location-search-interaction.test.mjs) | 검사 대상: `src/ui/locationSearchDraft.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/location-selection-model.test.ts](../../../test/ui/location-selection-model.test.ts) | 검사 대상: `src/services/kakaoLocationSearchAdapter`, `src/ui/locationSelectionModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/main-course-polish.test.mjs](../../../test/ui/main-course-polish.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/main-map-polish.test.mjs](../../../test/ui/main-map-polish.test.mjs) | 검사 대상: `src/ui/recommendation/courseV1OutcomeMessageModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/main-stack-navigation.test.mjs](../../../test/ui/main-stack-navigation.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/manual-location-restore.test.mjs](../../../test/ui/manual-location-restore.test.mjs) | 검사 대상: `src/ui/manualLocationRestoreModel.ts`, `src/ui/activeVerifiedCourseModel.ts`, `src/ui/liveActivity/pendingNavigationRouteModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/nearby-browse-map-document.test.mjs](../../../test/ui/nearby-browse-map-document.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/nearby-browse-screen.test.mjs](../../../test/ui/nearby-browse-screen.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/nearby-browse-sheet-layout.test.ts](../../../test/ui/nearby-browse-sheet-layout.test.ts) | 검사 대상: `src/ui/nearbyBrowseSheetLayout`. 현행/보존 계약 검증으로 유지. |
| [test/ui/nearby-browse.test.ts](../../../test/ui/nearby-browse.test.ts) | 검사 대상: `src/ui/nearbyBrowseModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/nearby-directions.test.ts](../../../test/ui/nearby-directions.test.ts) | 검사 대상: `src/ui/nearbyDirections`. 현행/보존 계약 검증으로 유지. |
| [test/ui/owned-account-screen-flow.test.mjs](../../../test/ui/owned-account-screen-flow.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/owned-course-lifecycle.test.ts](../../../test/ui/owned-course-lifecycle.test.ts) | 검사 대상: `src/ui/ownedCourseLifecycle`, `src/engine/dwellPersonalization`, `src/ui/personalizedCourseLabel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/password-login-captcha.test.ts](../../../test/ui/password-login-captcha.test.ts) | 검사 대상: `src/ui/passwordLoginModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/password-login-screen.test.ts](../../../test/ui/password-login-screen.test.ts) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/place-course-screen-runtime.test.mjs](../../../test/ui/place-course-screen-runtime.test.mjs) | 검사 대상: `src/ui/activeVerifiedCourseModel.ts`, `src/ui/placeDetailModel.ts`, `src/services/privateWalkConnector.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/place-detail-and-optimized-course-flow.test.ts](../../../test/ui/place-detail-and-optimized-course-flow.test.ts) | 검사 대상: `src/engine`, `src/ui/nav`, `src/ui/placeDetailModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/profile-auth-polish.test.mjs](../../../test/ui/profile-auth-polish.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/profile-settings-screen.test.mjs](../../../test/ui/profile-settings-screen.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/public-api-photo-screen.test.ts](../../../test/ui/public-api-photo-screen.test.ts) | 검사 대상: `src/ui/nearbyBrowseModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/public-api-photo.test.ts](../../../test/ui/public-api-photo.test.ts) | 검사 대상: `src/ui/recommendation/courseV1PlacePreviewModel`, `src/ui/placeDetailModel`, `src/ui/nearbyBrowseModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/qa-current-course-expiry.test.mjs](../../../test/ui/qa-current-course-expiry.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/qa-release-three-hour-save-date.test.mjs](../../../test/ui/qa-release-three-hour-save-date.test.mjs) | 검사 대상: `src/ui/courseCompletionUiModel.ts`, `src/services/courseCompletionRepository.ts`, `src/ui/recommendation/verifiedCourseProgressModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/recommendation-runtime-boundary.test.ts](../../../test/ui/recommendation-runtime-boundary.test.ts) | 검사 대상: `src/ui/personalizationSessionModel`, `src/ui/recommendation/v1Session`, `src/engine`. 현행/보존 계약 검증으로 유지. |
| [test/ui/recommendation-session-time.test.ts](../../../test/ui/recommendation-session-time.test.ts) | 검사 대상: `src/ui/recommendation/recommendationSessionTime`, `src/ui/recommendation/v1Session`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-age-check.test.mjs](../../../test/ui/release-age-check.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/release-build-config.test.mjs](../../../test/ui/release-build-config.test.mjs) | 검사 대상: `scripts/release-build.cjs`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-encryption-config.test.mjs](../../../test/ui/release-encryption-config.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/release-exit-logs.test.mjs](../../../test/ui/release-exit-logs.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/release-icon.test.mjs](../../../test/ui/release-icon.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/release-links-final.test.mjs](../../../test/ui/release-links-final.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/release-native-privacy.test.mjs](../../../test/ui/release-native-privacy.test.mjs) | 검사 대상: `scripts/release-build.cjs`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-one-stop-more-results.test.ts](../../../test/ui/release-one-stop-more-results.test.ts) | 검사 대상: `src/engine`, `src/ui/recommendation/releaseOneStopMoreResultsModel`, `src/ui/recommendation/v1Session`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-personalization-panels.test.mjs](../../../test/ui/release-personalization-panels.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/release-personalization-runtime.test.ts](../../../test/ui/release-personalization-runtime.test.ts) | 검사 대상: `src/ui/personalizationSessionModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-preflight-handoff.test.mjs](../../../test/ui/release-preflight-handoff.test.mjs) | 검사 대상: `src/ui/activeVerifiedCourseModel.ts`, `src/ui/execution/schedule.ts`, `src/ui/liveActivity/courseProgressRuntimeModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-record-map.test.ts](../../../test/ui/release-record-map.test.ts) | 검사 대상: `src/ui/activity/completedPlaceMapModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-three-hour-progress.test.mjs](../../../test/ui/release-three-hour-progress.test.mjs) | 검사 대상: `src/ui/liveActivity/courseProgressRuntimeModel.ts`, `src/ui/liveActivity/localProgressModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-three-hour-time.test.ts](../../../test/ui/release-three-hour-time.test.ts) | 검사 대상: `src/ui/timeSetup/datedSetupTime`, `src/ui/recommendation/v1Session`. 현행/보존 계약 검증으로 유지. |
| [test/ui/release-visual-polish.test.ts](../../../test/ui/release-visual-polish.test.ts) | 검사 대상: `src/engine`, `src/ui/recommendation/recommendationLoadingModel`, `src/ui/recommendation/v1Session`. 현행/보존 계약 검증으로 유지. |
| [test/ui/route-segments.test.ts](../../../test/ui/route-segments.test.ts) | 검사 대상: `src/engine`, `src/ui/map/routeSegments`. 현행/보존 계약 검증으로 유지. |
| [test/ui/runtime-course-auth-guard.test.ts](../../../test/ui/runtime-course-auth-guard.test.ts) | 검사 대상: `src/engine`, `src/services/routeProxyAnonymousAuth`, `src/ui/authStateModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/signup-captcha-flow.test.mjs](../../../test/ui/signup-captcha-flow.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/signup-failure-screen.test.mjs](../../../test/ui/signup-failure-screen.test.mjs) | 현행 화면 이벤트·출시 설정·SQL 또는 데이터 근거의 계약 검사. 삭제 근거 없음; 소스 문자열 검사는 향후 동작 검증과 대조. |
| [test/ui/signup-failure.test.ts](../../../test/ui/signup-failure.test.ts) | 검사 대상: `src/ui/signupFailureModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/two-stop-production-session.test.ts](../../../test/ui/two-stop-production-session.test.ts) | 검사 대상: `src/engine`, `src/ui/recommendation/v1Session`, `src/ui/recommendation/twoStopSelectionModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/two-stop-selection.test.ts](../../../test/ui/two-stop-selection.test.ts) | 검사 대상: `src/engine`, `src/ui/recommendation/twoStopSelectionEnginePort`, `src/ui/recommendation/v1Session`. 현행/보존 계약 검증으로 유지. |
| [test/ui/unified-time-route-setup.test.mjs](../../../test/ui/unified-time-route-setup.test.mjs) | 검사 대상: `scripts/release-build.cjs`, `src/ui/manualLocationRestoreModel.ts`. 현행/보존 계약 검증으로 유지. |
| [test/ui/verified-course-progress.test.ts](../../../test/ui/verified-course-progress.test.ts) | 검사 대상: `src/engine`, `src/ui/recommendation/verifiedCourseProgressModel`. 현행/보존 계약 검증으로 유지. |
| [test/ui/verified-course-results.test.ts](../../../test/ui/verified-course-results.test.ts) | 검사 대상: `src/engine`, `src/ui/recommendation/releaseOneStopResultsModel`. 현행/보존 계약 검증으로 유지. |

## 실행기·fixture·지원 파일 27개

이 파일들은 독립 테스트 수에 합산하지 않는다. 사용하는 테스트를 없애기 전 fixture를 먼저 삭제하면 안 된다.

| 파일 | 분류·근거 |
| --- | --- |
| [test/fixtures/course-v1-route-adapter.fixture.ts](../../../test/fixtures/course-v1-route-adapter.fixture.ts) | 보존: 테스트 입력/지원 자료. 사용 테스트와 함께 관리. |
| [test/fixtures/db-release-identity-a-v1.json](../../../test/fixtures/db-release-identity-a-v1.json) | 보존·DB 검증: SQL/계정/경로 fixture. 로컬 DB 하네스와 함께 관리, 운영 실행 금지. |
| [test/fixtures/liveLearningEvidenceFixture.ts](../../../test/fixtures/liveLearningEvidenceFixture.ts) | 보존: 테스트 입력/지원 자료. 사용 테스트와 함께 관리. |
| [test/fixtures/qa02-recommendation-scenarios.fixture.ts](../../../test/fixtures/qa02-recommendation-scenarios.fixture.ts) | 이관 검토: 과거 limited/preselection 하네스의 공유 fixture. 해당 테스트 이관 전 보존. |
| [test/fixtures/qa03r-real-provider-preselection.fixture.ts](../../../test/fixtures/qa03r-real-provider-preselection.fixture.ts) | 이관 검토: 과거 limited/preselection 하네스의 공유 fixture. 해당 테스트 이관 전 보존. |
| [test/fixtures/release-migration-compat-after.sql](../../../test/fixtures/release-migration-compat-after.sql) | 보존·DB 검증: SQL/계정/경로 fixture. 로컬 DB 하네스와 함께 관리, 운영 실행 금지. |
| [test/fixtures/release-migration-compat-before.sql](../../../test/fixtures/release-migration-compat-before.sql) | 보존·DB 검증: SQL/계정/경로 fixture. 로컬 DB 하네스와 함께 관리, 운영 실행 금지. |
| [test/fixtures/release-migration-compat-catalog.sql](../../../test/fixtures/release-migration-compat-catalog.sql) | 보존·DB 검증: SQL/계정/경로 fixture. 로컬 DB 하네스와 함께 관리, 운영 실행 금지. |
| [test/fixtures/release-migration-compat-email.sql](../../../test/fixtures/release-migration-compat-email.sql) | 보존·DB 검증: SQL/계정/경로 fixture. 로컬 DB 하네스와 함께 관리, 운영 실행 금지. |
| [test/fixtures/release-migration-compat-privileges.sql](../../../test/fixtures/release-migration-compat-privileges.sql) | 보존·DB 검증: SQL/계정/경로 fixture. 로컬 DB 하네스와 함께 관리, 운영 실행 금지. |
| [test/fixtures/release-one-stop-scenarios.fixture.ts](../../../test/fixtures/release-one-stop-scenarios.fixture.ts) | 보존: 테스트 입력/지원 자료. 사용 테스트와 함께 관리. |
| [test/fixtures/route-geometry-diagnostic-safe.fixture.ts](../../../test/fixtures/route-geometry-diagnostic-safe.fixture.ts) | 보존: 테스트 입력/지원 자료. 사용 테스트와 함께 관리. |
| [test/fixtures/route-proxy-geometry-db-contract.sql](../../../test/fixtures/route-proxy-geometry-db-contract.sql) | 보존·DB 검증: SQL/계정/경로 fixture. 로컬 DB 하네스와 함께 관리, 운영 실행 금지. |
| [test/index.js](../../../test/index.js) | 필수 보존: npm test 발견 실행기. |
| [test/ui/fixtures/TimeFitDiagnosticFileOrderHarness.swift](../../../test/ui/fixtures/TimeFitDiagnosticFileOrderHarness.swift) | 보존: 네이티브 정책 검증용 Swift 하네스. |
| [test/ui/fixtures/TimeFitLearningEvidenceHarness.swift](../../../test/ui/fixtures/TimeFitLearningEvidenceHarness.swift) | 보존: 네이티브 정책 검증용 Swift 하네스. |
| [test/ui/fixtures/TimeFitNativeIntentPolicyHarness.swift](../../../test/ui/fixtures/TimeFitNativeIntentPolicyHarness.swift) | 보존: 네이티브 정책 검증용 Swift 하네스. |
| [test/ui/fixtures/TimeFitNativeProgressPolicyHarness.swift](../../../test/ui/fixtures/TimeFitNativeProgressPolicyHarness.swift) | 보존: 네이티브 정책 검증용 Swift 하네스. |
| [test/ui/fixtures/approvedPhoto.mjs](../../../test/ui/fixtures/approvedPhoto.mjs) | 보존: 테스트 입력/지원 자료. 사용 테스트와 함께 관리. |
| [test/ui/fixtures/currentConfirm.mjs](../../../test/ui/fixtures/currentConfirm.mjs) | 보존: 테스트 입력/지원 자료. 사용 테스트와 함께 관리. |
| [test/ui/fixtures/ownedCoursePorts.ts](../../../test/ui/fixtures/ownedCoursePorts.ts) | 보존: 테스트 입력/지원 자료. 사용 테스트와 함께 관리. |
| [test/ui/simulator/route-start-app.jsx](../../../test/ui/simulator/route-start-app.jsx) | 보존·수동 도구: route-start 시뮬레이터 하네스 구성. 자동 import 부재만으로 폐기하지 않음. |
| [test/ui/simulator/route-start-catalog.json](../../../test/ui/simulator/route-start-catalog.json) | 보존·수동 도구: route-start 시뮬레이터 하네스 구성. 자동 import 부재만으로 폐기하지 않음. |
| [test/ui/simulator/route-start-metro.cjs](../../../test/ui/simulator/route-start-metro.cjs) | 보존·수동 도구: route-start 시뮬레이터 하네스 구성. 자동 import 부재만으로 폐기하지 않음. |
| [test/ui/simulator/route-start-ports.jsx](../../../test/ui/simulator/route-start-ports.jsx) | 보존·수동 도구: route-start 시뮬레이터 하네스 구성. 자동 import 부재만으로 폐기하지 않음. |
| [test/ui/support/reselectLegacy.mjs](../../../test/ui/support/reselectLegacy.mjs) | 정리 후보: 선언 외 참조 미발견. 삭제 직전 재검색. |
| [test/ui/support/screenRuntime.mjs](../../../test/ui/support/screenRuntime.mjs) | 필수 보존: 여러 현행 화면 테스트가 사용하는 고정 React/native 포트 실행기. |

## test/ 밖에서 발견한 검증 파일

| 파일 | 분류 |
| --- | --- |
| `supabase/functions/delete-account/startup_test.ts` | 계정 삭제 함수의 Deno 시작 검증. 보존 |
| `scripts/test_release_identity_local_db.sh` | 격리 로컬 DB의 migration/RLS/기록/학습 검증 실행기. 보존 |
| `scripts/test_release_migration_cli.mjs`, `test_release_migration_age_boundary.mjs`, `test_digest_schema_compat.mjs`, `test_c_validation_cleanup.mjs` | 로컬 DB 계약·호환·정리 검증. 보존; 운영 DB에서 실행하지 않음 |
| `scripts/test_lazy_engine.ts`, `scripts/test_transit_engine.ts` | 과거 planTimeFit/차량·대중교통 감사 도구. 현행 출시 회귀와 분리하고 도구 보존 범위 확인 |
| `src/engine/courseV1.testOnly.ts` | 테스트가 호출하는 엔진 실험 경계이지 독립 테스트 파일이 아님. 내부 B12·정책 비교 테스트와 함께 판단 |
| `src/ui/timeSetup/testClock.ts` | 내부 테스트 시각 기능 코드. 독립 테스트 파일이 아님 |

파일명이 test/spec와 무관한 별도 운영 감사 도구 전체를 폐기 대상으로 조사한 것은 아니다.

## 다음 작업 권고와 인수인계

1. 불필요 skip 1개·미참조 지원 파일 1개·끊긴 명령 경로를 QA 범위로 먼저 정리할 수 있다. **이번에는 실행하지 않았다.**
2. 조건부 정리 4개는 대상 함수 보존 여부와 함께 확정한다. 사용자가 코드 삭제를 중단한 현재 결정하에서는 테스트만 먼저 제거하지 않는다.
3. 이관 검토 13개는 현행 entry로 옮길 case와 내부 진단으로 남길 case를 나눈다. 전체 파일 삭제 금지.
4. 별도 확인 7개 중 과거 planner/도구는 유지보수 범위, captcha-challenge는 서버 배포·외부 소비 여부가 필요하다. 모르는 운영 상태를 추측하지 않는다.
5. 승인된 수정 후 typecheck·UI·전체 테스트를 재실행한다. UI/네이티브 변경이 아니라 테스트만 정리하는 경우 매번 사용자에게 전체 실기기 E2E를 요구하지 않는다.

- 변경 파일: 이 분류 문서만 추가.
- 유지 경계: 제품 기능·추천 정책·DB·테스트 본문·package scripts·기존 다른 세션 변경 보존.
- 검증: 파일 목록/참조/선택한 함수 호출 지점, 실행 목록의 파일 존재 검사. 전체 테스트 미실행.
- 한계: assertion 단위 중복률·실행 커버리지 미측정. “보존”은 모든 내용이 최신 정책과 일치한다는 최종 수락이 아니다.

