# U-TEST-CLOCK-01 — 테스트 시각 추천 실패 진단

상태: 2026-09-08 UIUX 진단 실행 가능. U-GUEST-IMPORT-01 자동·사용자 실기기 수락 후 두 번째 작업이다.

## 목적·관계

사용자 관찰은 ‘현재 테스트 시각으로 장소 추천 테스트가 불가능하다’이다. 정확한 입력 시각/오류/발생 단계는 아직 미확인이다. 기존 개발 시각 입력 및 추천 session 고정 계약의 결함 진단이며 120분 상한·조건부 시장 정책 변경이 아니다.

이전 개발 시각으로 추천/구조화 운영시간 계산 → 관찰: 추천 테스트 불가 → 이번: UI 입력부터 공개 추천 entry까지 각 시계의 사용처를 고정 입력으로 대조 → 이유: 실제 시각 노출 정책과 버그를 구분 → 진단 전. 원인 없이 실제 시각을 모두 테스트 시각으로 교체하지 않는다.

## 읽기·확정 관찰

AGENTS.md, docs/README.md, 본 문서와 테스트.md의 개발 시각/조건부 노출 규칙을 읽는다. 과거 archive는 읽지 않는다.

- TimeSetupScreen.tsx는 resolveTimeSetupClock(realNow,testNowMin), captureRecommendationNowIso(new Date(),testNowMin), endMin-startMinuteForRecommendation(nowIso)를 사용한다. validation/run guard/CAPTCHA 전후 두 입력 검증과 session 생성 시각을 함께 추적한다.
- src/ui/timeSetup/testClock.ts, src/ui/recommendation/recommendationSessionTime.ts, v1Session.ts, 기존 test-clock/session-time/통합 설정 fixture를 우선 읽는다. v1Session에는 확인 시각과 session.nowIso로 elapsedMin을 구하는 별도 경계도 있다. 초기 추천 실패와 상세/코스 확인 시 만료를 혼동하지 않는다.
- 개발 테스트 시각 직접 설정과 ‘출시 추천 QA’ launcher는 서로 다른 입력 경로다. 어느 쪽이 실패하는지 각각 확인한다.
- 조건부 시장/거리의 정보 영역은 실제 기기 시각 10:00 이상18:00 미만 노출이라는 기존 정책이다. 일반 구조화 운영시간 후보의 추천 시각과 구분한다. 조건부만 안 보이는 경우 이를 전체 추천 실패로 보고하지 않는다.

## 작업 순서·반례

1. 코드/기존 fixture로 재현 가능한 부분부터 조사한다. 필요하면 사용자에게 실제 시각, 설정한 테스트 시각·도착 시각, 출발/목적 장소, 실패 문구와 단계(버튼 비활성/오류/0개/코스 확인)를 한 번에 짧게 질문한다. 답이 없어도 무호출 진단은 진행한다. 계정/키/토큰/원본 로그 전문은 요구하지 않는다.
2. 실제 시각02:00·테스트15:00·도착17:00·여유10분·부산 고정 좌표를 기본으로 한다. 해당 테스트 시간에 열리고 실제 시간에는 닫힌 일반 장소 fixture와 조건부 시장 fixture를 분리한다. 실제20:00→테스트15:00, 테스트 미래/과거, 23시대/자정 경계, 실제 시각 복원, CAPTCHA 대기 후 재개, 연타를 검증한다. 현재 지원하지 않는 자정 넘김은 정책 확인 후 결과를 기록하고 임의 확장하지 않는다.
3. 입력 UI 표시 → validation → session.nowIso/remainingMin → 엔진 now → provider 시간 계약 → 결과/더보기/2곳/코스 확인의 만료 경계를 추적한다. Date.now/new Date의 사용이 잘못됐다는 추정만으로 바꾸지 말고 각 시계의 목적을 기록한다. 전체 Date mocking으로 다른 시간 경계까지 통과시킨 결과만 제출하지 않는다.
4. 실제 Auth 만료·receipt 유효기간·API 예산/캐시 TTL·Live Activity/알림·학습 증거·DB 보유기간은 추천 테스트 시각과 별개다. 시험을 통과시키려고 안전 검증을 해제하거나 과거시각 증거를 운영 학습으로 넣지 않는다.
5. 정상·빈 응답·실패 adapter fixture를 주입해 API 장애와 시계 혼용을 구분한다. 실제 API 반복 호출·운영 DB 쓰기·Simulator 버튼 순회·앱 삭제/무조건 Metro clear는 금지한다. native/env 변경 없는 코드 문제에 새 Xcode 빌드를 관성적으로 요구하지 않는다.

## 진단 완료 기준·역할 경계

이번은 **진단 및 재현 테스트 작성**이다. 제품 수정은 원인 검토 후 같은 문서의 후속 명령으로 진행한다. UIUX는 src/ui 관련 테스트/본 문서만 변경한다. 엔진/API 원인이면 정확한 entry·입력·관찰값·예상값을 소유 세션에 인계한다. 시간 상한 확장/시장 카드 디자인/심사 전용 데모 추가는 범위 밖이다.

보고는 (1) 확인된 실패 단계와 재현 여부 (2) 설정 누락/정상 정책/코드 결함/API 제약 중 근거 있는 판정 (3) 최소 수정 파일·담당·유지 계약 (4) 실행한 테스트/결과·다음 사용자 확인으로 작성한다. 실패 테스트는 회귀 목적을 명시하고 기존 제품 테스트 통과로 위장하지 않는다. 재현하지 못하면 원인 미확정과 부족한 입력을 기록하고 수정 완료로 표시하지 않는다. commit/push0.

남은 순서: 본 원인 판정/필요 수정 → 조건부 시장 카드 UI 통일 → 3/4시간 확대 영향 조사·사용자 결정. 가져오기/C 재실행0.

## 2026-09-08 UIUX 진단 인수인계 — 제품 수정 없음

### 1. 확인된 실패 단계·재현 및 변경 파일

- 추가: `test/ui/test-clock-recommendation-diagnosis.test.ts` — 명시적 KST Date·부산 좌표·14~18시 구조화 운영시간 장소·exact/no_route/unavailable receipt adapter를 사용한 진단 5건. 수정: 본 문서만. 제품 코드 변경0.
- **일반 추천 실패는 재현되지 않았다.** 실제02:00/20:00에 테스트15:00·도착17:00·여유10분을 적용하면 `runRecommendationSession` → 실제 출시 엔진 → 주입 provider가 모두 같은15:00을 받고 장소 snapshot을 생성한다. JSON 직렬화 후 CourseConfirm의 실제 표시 모델도 유효하다. 실제02:00/20:00로 복원한 같은 장소는 닫혀 추천되지 않는다. manual/QA 두 경로 모두 확인했다. 화면 전체 실기기 성공이나 운영 API 성공을 뜻하지 않는다.
- **조건부 확인의 시계 혼용은 재현됐다.** 실제17:00에 테스트15:00으로 세션을 만든 직후 `requestConditionalManualCourse`에 실제17:00을 넘기면 `remainingMin=120-120=0`을 조건부 엔진 경계로 전달한다. 실제 기다림0분이어도 테스트 오프셋120분을 차감한다. 실제10:00/테스트15:00이면 음수 경과를0으로 clamp해120분을 그대로 전달한다. 진단 fixture의 조건부 builder는 입력을 관찰하는 stub이며, 시장 운영 API 성공·실패를 주장하지 않는다.
- 원인 위치: `src/ui/recommendation/v1Session.ts`의 `requestConditionalManualCourse`: `confirmedAt - session.nowIso`. `session.nowIso`는 가상 추천 기준 시각이지 별도로 저장한 실제 생성 시각이 아니다. 기존 일반 시각 세션에서는 올바른 차감이지만 테스트 시각 세션에서는 의미가 다르다. 이 진단 테스트는 현행 관찰값을 고정한 것이며 원하는 수정 결과로 위장하지 않는다.

### 2. 시각 전달·판정과 유지 계약

| 경계 | 현행 시계·관찰 | 판정 |
| --- | --- | --- |
| 개발 wheel 표시/적용 | `resolveTimeSetupClock`이 분/hourBucket만 대체하고 날짜 유형은 유지. 적용 시 도착 시각도 +120분, 최대23:59로 재설정 | 설정/현행 계약 |
| 버튼 검증 | 출발 위치 필수, 도착-시작 1~120분. manual CAPTCHA 완료 후 `startManualRecommendation`에서 다시 캡처/검증 | 정상, 상한 변경 없음 |
| session 생성 | `captureRecommendationNowIso`는 캡처 날짜의 로컬 시/분을 교체. null이면 실제 시각. manual은 CAPTCHA 뒤, QA는 시나리오 선택 시 생성 | 경로 차이 |
| 출시 QA | 수동 wheel/도착 입력과 독립. 같은 날짜15:00, 각 시나리오45~120분, 여유10분. dev와 diagnostics='true' 모두 필요 | Release에서 버튼 부재는 설정 게이트이며 추천 시간 결함 아님 |
| 최초 추천/provider | session ISO → `buildRecommendationEngineInput.now` → 출시 엔진/provider. 운영시간은 엔진 input.now 기반. 실제 data provider의 근거 검토기한 필터도 전달받은 now의 UTC 날짜 문자열 사용 | 고정 fixture 정상. 날짜까지 가상으로 바꾸는 도구는 아님 |
| 결과/더보기/2곳 | 최초 input을 continuationInputs/runtime에 보관. 더보기는 originalInput, 2곳 port는 같은 input을 전달. scope/session·예산 검증은 별개 | 시간만 실제 시각으로 다시 덮는 코드 없음(코드 추적). 신규 fixture에서 2곳 전체 화면을 별도 실행한 것은 아님 |
| 일반 CourseConfirm review | exact snapshot의 순서·합계/장소 존재 검증. 표시 모델에는 실제 시각 경과로 만료시키는 검증 없음 | 코스 확인 표시 실패와 조건부 CTA 예산 차감은 별개 |
| 조건부 정보 노출 | Results의 `conditionalActualNow=new Date()`, foreground/경계 타이머 갱신, 10:00 이상18:00 미만 | **02시/20시에 테스트15시여도 비노출은 정상 정책** |
| 조건부 명시 확인 | 실제 확인 시각 사용 + 가상 session 시각부터 경과 차감 | 테스트 모드 시계 혼용 재현. 일반 추천 전체 실패의 원인이라고 확정할 수 없음 |

- 자정 반례:23:30 적용은 도착23:59,29분이다. 다음날01:00은 `60-1410<0`으로 거절한다. 자정 넘김 지원을 임의 추가하지 않았다.
- CAPTCHA 자정 대기:23:59 선택 후 다음날00:01 완료 시 manual은 다음날15:00을 생성하지만 QA는 전날15:00 세션을 유지한다. 생성 함수 고정 fixture와 실제 handler 코드로 확인한 날짜 차이이며, 날짜가 바뀌는 기기 E2E를 실행했다는 뜻은 아니다. 같은 날 대기 시 두 경로의 테스트 시/분은 동일하다. 실제 시각 복원 후 manual은 재검증하므로 대기 중 도착 시각이 지나면 거절될 수 있다.
- 성공/빈 경로/서비스 unavailable fixture는 같은15:00을 유지한 채 각각 코스 있음/없음/없음으로 나뉜다. 따라서 결과0개만으로 시계 결함이나 운영 API 장애를 확정할 수 없다.
- 120분 상한, 조건부 실제10~18시 노출, 실제 확인 시각 정책을 모두 유지했다. 인증 만료·receipt 유효기간·캐시 TTL·호출 예산·계정 scope·학습 증거·Live Activity/알림 시각을 테스트 시계로 바꾸지 않았다. 엔진/API/data/DB/중앙 문서/보드 수정0.

### 3. 자동 검증 결과

- 신규 진단5건 통과. 초기 작성 중 validation 정상 반환을 null로 가정한 assertion 및 fixture 타입 오류를 수정했다. 이를 제품 실패 재현으로 집계하지 않는다.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`:599건 중598통과·기존 skip1·실패0. 기존 production TimeSetup handler fixture의 CAPTCHA 취소/늦은 검증/성공/동일 tick 중복 차단, 테스트 시각 적용/복원과 QA8건 실행도 포함한다. `/private/tmp/timefit-clock-ui.log`.
- `npm test`:274통과·실패0. `/private/tmp/timefit-clock-core.log`.
- `npx tsx --test test/release-one-stop-verified-course.test.ts test/conditional-manual-course.test.ts test/course-v1-candidate-provider.test.ts`:17통과·실패0. `/private/tmp/timefit-clock-engine.log`.
- tsx IPC 권한 제한으로 시작 실패한 명령은 승인된 권한 확장으로 재실행했다. 전역 Date mock 없이 새 진단 실행. iOS 번들/네이티브 빌드/Simulator/실기기/API/운영 DB 실행0(제품·네이티브 변경 없는 진단). 추가 가져오기/C 재검증/commit/push0.

### 4. 최소 수정 범위·담당 및 다음 확인

- **UIUX 후속 결정 후보(구현 전):** 추천 가상 시각과 실제 생성 기준 시각을 구분할지 확정해야 한다. 단순히 조건부의 실제 `confirmedAt`을 테스트 시각으로 바꾸면 현행 조건부 정책을 깨므로 금지. 실제 경과 기준을 분리한다면 `TimeSetupScreen.tsx`/`qaReleaseOneStopLauncherModel.ts`의 캡처 시점, `v1Session.ts`의 저장·차감 및 관련 UI fixture가 최소 범위다. 직렬화 session 필드가 필요하면 단일 작성자 `nav.ts` 계약 변경 승인도 필요하다. 새 기준을 임의 도입하지 않았다.
- QA CAPTCHA 자정 넘김은 세션 캡처를 언제 고정할지 UIUX 결정 대상으로 인계한다. 일반 실시간 세션 차감과 인증/학습 시계를 함께 바꾸지 않는다. 엔진/API 정책 수정 근거는 현재 없다.
- 사용자의 **일반 추천 불가 원인은 아직 미확정**이다. 한 번의 기존 실패 사례에 대해 실제 시각·개발 직접 입력/QA 중 경로·테스트/도착 시각·출발/목적 장소·멈춘 단계와 표시 문구만 확인하면 정상 정책/입력 거절/API 제약/코드 결함으로 좁힐 수 있다. 계정 원문·토큰·전체 진단 로그는 필요 없다. 운영 재실행이나 Xcode 재빌드를 선행 요구하지 않는다.
- 변경 이력: 가상 추천 시각을 조건부 경과 기준에도 재사용(현행) → 기다림 없이 예산이 차감되는 고정 입력 관찰 → 이번에는 진단 기록/재현 테스트만 추가 → 실제 시각 노출과 학습 검증을 손상시키지 않고 별도 수정 결정을 받기 위함 → **진단 완료, 일반 실패 원인 미확정·제품 수정 미실행**.
