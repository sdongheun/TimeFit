# U-UNUSED-UI-SYMBOLS-REMOVE-01

2026-09-14 / 최신 상태: UIUX 구현 후 QA 자동 게이트 PASS. 통합 수락·수정 빌드 실기기 확인은 별도. 아래 구현 전 명령은 이력으로 보존한다.

## 기준·변경 이유

복구 기준19732ca: 수락된 잔여 UI·서비스 제거를 UIUX/API/DB/QA/통합으로 커밋했다. output/은 제외·보존, push 없음.
이전에는 현재 사용 파일에 섞인 과거 함수·호환 타입을 보존 → 과거 화면·저장소 제거 후 외부 제품 호출 부재 확인 → 아래 기호만 제거 → 현재 실행 계약을 유지하며 과거 분기 혼동 해소 → 구현 전.

## UIUX 명령

`U-UNUSED-UI-SYMBOLS-REMOVE-01을 진행하라. 아래 의존성을 재확인하고 파일 전체가 아닌 미사용 기호만 제거하라.`

1. src/ui/nav.ts: LegacyResults/MyCourses/Execution/Feedback route 선언, modeIcon, deviceLocationSnapshot 선택 필드 제거 후보. deviceLocationSnapshot은 선언만 발견됐으며 GPS 실행 코드가 남아 있다는 뜻이 아니다. 기존 저장 객체의 추가 필드 때문에 복원 실패하도록 validator를 강화하지 않는다.
2. src/ui/execution/schedule.ts: buildExecutionSchedule/currentMinuteOfDay와 전용 ExecutionScheduleInput/ExecutionSchedule 제거. **KakaoRouteTarget이 Pick<ExecutionStop,'name'|'point'>를 사용 중**이므로 ExecutionStop을 무조건 삭제하지 않는다. 현재와 동일한 `{name:string;point:LatLon}` 구조로 KakaoRouteTarget을 독립시킨 뒤 다른 참조가 없을 때만 ExecutionStop 제거. 모든 현재 URL·앱/웹 fallback·모드·성공 판정·진행 이벤트 계약 유지.
3. 위 제거 후 PlanCtx/Appointment와 nav의 관련 engine import 참조를 다시 확인해 남은 소비자가 없을 때만 제거. 현재 RecommendationSession/RootStackParamList의 사용 route/fmtHM은 유지.
4. src/ui/recommendation/v1Session.ts: buildRecommendationExplorationPage/verifyRecommendationExplorationPlace/explorationSelectionMessage, continueRecommendationSession, requestConditionalManualCourse 제거 후보. 이 전용 explorationUnavailable/ConditionalManualUiResult/buildConditionalManual 주입 속성·미사용 import도 호출 부재 재확인 후 정리한다.
5. **continuationInputs는 현재 continueReleaseRecommendationSession도 사용하므로 보존**. runRecommendationSession/continueReleaseRecommendationSession/현재 대표·2곳 선택/개인화 범위/receipt/작업 lock·예산/개발 B12 및 테스트 시각 경계는 변경하지 않는다. 엔진의 동명 기능·타입은 이번에 제거하지 않는다. API·DB·카탈로그·네이티브·정책 변경 금지.

## 테스트·인계

- 삭제 전 기호별 앱/서버/스크립트/동적 참조를 확인하고 예상 제거 실패 테스트 및 현재 검색→추천/더보기→선택→진행·길찾기 보존 통과를 확보한다.
- 삭제 기호의 전용 테스트만 이유를 기록해 정리한다. 혼합 날짜/시각/경로/예산 검증은 현행 runtime으로 유지하며 파일 전체를 폐기하지 않는다. QA 소유 테스트는 필요한 변경을 인계한다.
- 현재 경로 타깃 타입 구조·앱/웹 URL·진행 상태와 저장 복원 shape가 바뀌지 않는지 검증한다. 같은 파일이라는 이유로 현재 함수를 함께 삭제하지 않는다.
- UIUX 집중 테스트와 타입 검사 후 전체 실행 결과를 보고한다. QA 참조 오류가 있으면 전체 완료가 아니라 QA 이관 대기로 표시한다.

## QA-UNUSED-UI-SYMBOLS-REMOVE-01

UIUX 인계 후 QA 소유 테스트를 현재 계약에 맞게 이관하고 아래 명령을 실행한다.

```sh
npm run test:typecheck
npm run test:ui
npm test
node scripts/release-build.cjs export
git diff --check
```

삭제/추가/이관 케이스 수·기존 skip을 설명한다. 이전 기준 UI786 PASS/skip1, 기본542 PASS를 이번 결과로 대신하지 않는다. 실제 공급자/운영 DB 호출 금지. 실패 은폐를 위한 loader/skip/정책 완화 금지.

변경 파일·기호별 이유, 보존 계약, 실행 결과·로그, 남은 위험과 실기기 미확인 항목을 인계한다. 통합 자동 검토 후 수정 빌드의 추천/더보기·카카오 앱/웹·진행/기록/복원을 확인한다. 추가 삭제·커밋·push·배포는 별도 범위다.

통합 이번 결과: 이전 수락 작업 커밋 및 본 명령 작성만 수행. 의존성 조사에서 발견한 KakaoRouteTarget/continuationInputs 공유 경계를 명시했다. 제품 기호 삭제와 삭제 후 전체 테스트는 아직 미실행. 문서 git diff --check 확인.

## QA 최종 인수인계 — 2026-09-14

### 변경·재현·이관

- 기준: `19732ca` 이후 UIUX 인계의 미커밋 변경 위에서 검증. 기존 다른 역할 변경과 `output/` 보존.
- QA 변경 파일은 `test/mixed-travel-contract.test.mjs`와 이 문서뿐이다. 제품 코드·중앙 문서·API·DB·네이티브는 수정하지 않았다.
- 이전 마지막 검증은 삭제된 `buildExecutionSchedule` 내부 `incomingMode: leg.mode ?? ctx.mode` 문자열을 요구했다. 수정 전 고립 실행은 **4 PASS / 1 FAIL**로 동일 원인 재현(`/private/tmp/symbols-qa-before.log`). 현재 기능 실패가 아닌 제거된 일정 생성 계약의 잔존 참조다.
- 마지막 1건을 현재 `buildVerifiedCourseProgressSteps` → 실제 `CourseConfirmScreen` → `openKakaoRouteWithFallback` 경계로 이관했다. 앞선 엔진 혼합수단·짧은 구간 근사·검증 snapshot 비재계산·상세 화면 역할 4건 및 현재 `leg.mode`/`lastLeg.mode` 전달 검사는 유지했다. 파일 삭제·skip·loader 완화 없음.
- 2곳 고정 fixture 두 조합(`walk→transit→walk`, `transit→walk→transit`)으로 출발→A→B→목적지의 여섯 handoff를 검증한다. 각 현재 travel 상태를 주입하고 실제 화면 CTA를 실행해 개별 수단, 이름·좌표, 앱 URL의 `by/sp/ep`, 성공 후 routeOpened를 확인한다. 과거 일정 생성기나 전역 mode로 대체하지 않는다. 전체 도착/체류 순회 E2E라는 뜻은 아니다.
- `KakaoRouteTarget` 직접 타깃과 실제 URL 함수에 메모리 앱 포트를 연결했다. 실제 앱/공급자 호출은 없다. 기존 UIUX 앱→HTTPS→browser 취소·실패 검사와 walk/transit/car URL 2건은 전체 UI 게이트에서 그대로 실행됐다.

### 보존 계약

현재 session·route·Appointment·fmtHM, 추가 필드가 있는 기존 저장 객체 복원, 수동 출처 검증, continuationInputs 및 현행 더보기·2곳 선택·receipt·lock·예산·시각 경계를 유지했다. 이동 의사·도착·종료·Live Activity·완료 기록의 제품 정책이나 실패 판정을 변경하지 않았다. 폐기 기능 복원 및 추가 삭제 없음.

### 실행 결과

| 검증 | 결과 | 로그 |
| --- | --- | --- |
| `node --test test/mixed-travel-contract.test.mjs` | 5/5 PASS | `/private/tmp/symbols-qa-focus.log` |
| `npm run test:typecheck` | PASS, exit 0 | `/private/tmp/symbols-qa-types.log` |
| `npm run test:ui` | 782건: 781 PASS, FAIL 0, 기존 skip 1 | `/private/tmp/symbols-qa-ui.log` |
| `npm test` | 545/545 PASS, skip 0 | `/private/tmp/symbols-qa-all.log` |
| `node scripts/release-build.cjs export` | public iOS Hermes bundle PASS, exit 0 | `/private/tmp/symbols-qa-export.log` |
| `git diff --check` | PASS | 명령 출력 오류 없음 |

테스트 수: QA mixed 5건 중 1건 이관, 추가/삭제 0. UIUX 전용 8건 제거(일정 1·탐색 4·conditional 2·폐기 wrapper 시각 1)와 심볼 검사 3건 추가로 이전 UI 786 PASS → 781 PASS, 기존 skip 1 유지. 기본 게이트는 이전 542 + 새 mjs 3 = 545건. UIUX 인계 당시 외부 요약의 실패 2건은 동일 mixed 실패와 상위 발견 러너 전파였으며 이번 재실행에서 모두 해소됐다.

실제 생성 산출물: `/private/tmp/timefit-public-export/_expo/static/js/ios/index-7f21034153650cc645b6bbcfe5a94652.hbc`.
이번 SHA-256: `99ed12185067b673cce6daea8522e8a1898e55e64c0fd61b5c01b8b1e62ae844`.
UIUX 인계와 파일명은 같으나 이번 바이트 해시는 다르므로 동일 바이너리라고 판정하지 않는다. 이번 export 성공만 기록하며 Archive/IPA·서명·설치·출시본 동등성은 검증하지 않았다.

### 남은 조건·다음 담당

- 자동 게이트의 미해결 실패 없음. 통합·결정 역할이 변경 범위와 자동 결과를 수락한 뒤 수정 빌드 확인을 진행한다.
- 실기기 미확인: 추천→더보기→선택, Kakao 설치/미설치 앱·웹 길찾기와 앱 복귀, 진행→완료 기록, 재시작 시 기존 진행 복원. 기존 실기기 성공 보고를 이번 수정본 성공으로 대체하지 않았다.
- 실제 공급자 API·운영 DB·Simulator·실기기는 조작하지 않았다. stage/commit/push·배포도 수행하지 않았다.
