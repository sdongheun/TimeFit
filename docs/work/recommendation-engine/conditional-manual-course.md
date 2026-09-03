# 2-R — 사용자 확인 조건부 시장·거리 수동 코스

## 상태

수락. `DATA-MARKET-01`의 조건부 후보와 `2-Q`/`API-PAGE-01`의 receipt 경계를 소비하는 단일 수동 계산 entry와 시간·비용·비노출 fixture를 완료했다. 대표·검증 대안·continuation 정책은 바꾸지 않는다.

## 읽을 범위

`AGENTS.md` → `docs/README.md` → `docs/작업조정_보드.md` → `docs/03_product/추천로직.md` 1.5.1·1.6·1.10 → `docs/03_product/UIUX_공통규칙.md` 4-1 → 이 문서. 이전 탐색 엔진은 필요한 실제 receipt 평가 방식을 확인할 때만 읽는다.

## 목표

사용자가 카카오맵에서 운영시간을 직접 확인한 **조건부 시장·거리 한 곳만** 실제 도보·대중교통 경로와 체류·도착 여유로 계산한다. 이 계산은 운영시간 자동 검증을 복원하거나 후보를 `verified`/대표/검증 대안으로 승격하지 않는다.

## 공개 계약

엔진은 UI·카탈로그 provider를 import하지 않는 구조 타입과 단일 entry를 공개한다. 이름은 아래를 사용한다.

```ts
export type ConditionalManualCourseV1Input = Readonly<{
  now: Date;
  origin: CourseV1Point;
  destination: CourseV1Point | null;
  remainingMin: number;
  arrivalBufferMin: number;
  conditionalCandidates: readonly CourseV1Candidate[];
  selectedPlaceId: string;
  userConfirmedHours: true;
  receiptRoutes: CourseV1RouteReceiptAdapter;
}>;

export type ConditionalManualCourseV1Result =
  | Readonly<{
      state: 'conditional_manual_course';
      course: VerifiedCourseV1;
      hoursStatus: 'hours_confirmation_required_user_confirmed';
      receipt: CourseV1RouteReceiptSummary;
    }>
  | Readonly<{
      state: 'rejected';
      reason:
        | 'conditional_confirmation_required'
        | 'conditional_candidate_not_eligible'
        | 'conditional_display_window_unavailable'
        | 'time_budget_exceeded'
        | 'route_not_verified'
        | 'route_verification_unavailable';
      receipt: CourseV1RouteReceiptSummary;
    }>;

export async function buildConfirmedConditionalManualCourseV1(
  input: ConditionalManualCourseV1Input,
): Promise<ConditionalManualCourseV1Result>;
```

`CourseV1RouteReceiptSummary`는 기존 엔진의 adapter call·새 provider attempt·cache/session reuse 수치 타입을 재사용한다. 새 원시 API 오류, quota 값, 좌표, 사용자 ID, 카카오 운영시간 원문은 결과에 넣지 않는다.

## 구현 명령

1. `conditionalCandidates` 중 `selectedPlaceId`와 정확히 일치하는 한 후보만 사용한다. 후보는 `classification === 'conditional_more'`, 조건부 시장/거리 표식, 최소·권장 체류와 유효 좌표를 모두 가져야 한다. 시설·개별 점포·도매/새벽 전용·장기 이용 등 DATA-MARKET-01에서 제외한 후보, 임의로 조립한 객체, representative 후보는 `conditional_candidate_not_eligible`이며 receipt 호출 0회다.
2. 이 entry의 `now`는 최초 추천 시각이 아니라 **사용자가 명시 확인 CTA를 누른 실제 확인 시각**이다. UI는 `confirmedAt - session.nowIso`의 경과 분을 올림 처리해 `remainingMin`에서 차감하고, 차감 뒤 값과 `confirmedAt`을 이 entry에 넘긴다. 엔진은 현지 시각 **10:00 이상 18:00 미만**에서만 계산한다. 범위 밖, 명시 확인 값 누락/false, 후보 미선택, 차감 뒤 최소 입력 범위 미달은 각각 typed rejection·receipt 호출 0회다. 이 창은 영업 보장으로 쓰지 않으며, 입력의 `userConfirmedHours: true`가 구조화 운영시간 gate를 대체하는 유일한 수동 확인 근거다.
3. `출발 → 선택 조건부 장소 → 도착/복귀`의 모든 구간을 existing receipt adapter로 정확 검증한다. 근사·차량·no route는 `route_not_verified`, adapter typed unavailable은 `route_verification_unavailable`이다. 경로가 통과해도 최소 체류·권장 체류·도착 여유를 기존 코스 시간식으로 검사한다. 권장 체류가 가능하면 권장, 불가능하지만 최소 체류가 가능하면 `짧게 가능`을 반환한다. 남는 시간은 채우지 않는다.
4. 한 번의 명시 계산은 선택 장소 한 곳만 다루며, 새 provider attempt는 최대 4회로 제한한다. 같은 구간 receipt cache hit/in-flight 재사용은 0회다. 이 entry에는 continuation, 후보 보충, 새로고침, 2·3곳 조립, fallback provider를 넣지 않는다.
5. 성공 결과는 항상 `hoursStatus: 'hours_confirmation_required_user_confirmed'`를 유지한다. `VerifiedCourseV1`의 실제 legs·stops는 시간표 표시용일 뿐, 반환 이름·UI mapping에서 `verified`, `추천`, 대표 또는 자동 저장 가능으로 표현하지 않는다. 대표/대안 result와 타입을 섞지 않는다.
6. `src/engine/`, 순수 엔진 테스트, 이 문서만 수정한다. UI/API adapter/카탈로그/DB/제품 기준 문서/보드는 수정하지 않는다.

## 필수 고정 fixture

- 추천 시작 시각의 09:59/10:00/17:59/18:00 노출 경계는 UI fixture로, 실제 확인 시각의 09:59/10:00/17:59/18:00·확인 전/후·경과 분 차감은 이 엔진 fixture로 분리해 receipt 0/허용 경계를 증명한다.
- market/street의 한 곳 성공: 실제 두 legs·권장 체류·도착 여유와 `hours_confirmation_required_user_confirmed`를 보존한다.
- 권장 불가·최소 가능, 최소 체류도 불가, no route, typed unavailable을 구분한다.
- representative/시설/제외 conditional·선택 ID 없음은 route 0이며 대표/대안 결과에 영향을 주지 않는다.
- 동일 구간 cache hit/in-flight와 provider attempt ≤4, raw 운영시간/사용자 ID/좌표가 공개 결과에 없음을 확인한다.
- `npm run test:typecheck`, 관련 엔진 테스트, `npm test`, `git diff --check`를 실행한다.

## 완료 인계

변경 파일, 대표/대안에서 분리한 공개 타입, 실제 receipt 수치, 운영시간 수동 확인의 한계, `U-RESULTS-03`가 CTA와 상태를 연결하기 위한 입력/출력 예시를 네 항목 인계에 기록한다.

---

## 2026-08-31 — 2-R 완료 인계

### 1. 변경 파일과 목적

- `src/engine/courseV1.ts`: `ConditionalManualCourseV1Input/Result`, `CourseV1RouteReceiptSummary`, `buildConfirmedConditionalManualCourseV1`을 추가했다. `conditional_more + conditionalVisit(market_or_street)`인 선택 장소 한 곳만 10:00–18:00 실제 확인 시각에서 두 receipt leg로 계산한다.
- `src/engine/index.ts`: UI 컨테이너가 사용할 수 있도록 위 entry와 타입을 barrel에 공개했다.
- `test/conditional-manual-course.test.ts`: 시간 창/명시 확인/후보 자격의 route 0 경계, 권장·짧게 체류, 예산·no-route·unavailable rejection, receipt 수치를 고정했다.

### 2. 유지한 공개 계약·정책 경계

- 성공 상태는 `conditional_manual_course`이며 `hours_confirmation_required_user_confirmed`를 항상 보존한다. 대표·검증 대안·continuation에 추가하거나 `verified`/추천/자동 저장 가능으로 승격하지 않는다.
- 엔진은 UI, 카탈로그 provider, 카카오 원문 운영시간을 import·저장하지 않는다. `now`와 이미 차감된 `remainingMin`은 CTA를 누른 실제 확인 시각의 UI 입력이다.
- 조건부 표식이 없는 후보, representative/시설 등은 receipt 0회로 거절한다. route adapter는 최대 두 구간·새 provider attempt 최대 4회이며 fallback provider는 없다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/conditional-manual-course.test.ts`: 3/3 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 140 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- `U-RESULTS-03`는 카카오맵 외부 확인 뒤의 CTA 시각을 `now`로, 경과 시간을 차감한 `remainingMin`으로 전달하고 성공 상태를 `운영시간 확인 필요(사용자 확인)`으로만 표시해야 한다. 대표/대안 목록에 병합하면 안 된다.
- 실제 카카오 운영시간의 정확성은 이 엔진이 증명하지 않는다. 사용자의 확인이 틀렸거나 이후 변경된 경우에도 이 결과는 사용자 확인 상태로 남으며, 실기기에서 외부 전환→복귀→CTA의 시각 차감 흐름을 확인해야 한다.

---

## 2026-08-31 — 통합 재검토 보완 명령 (같은 2-R)

### 보완 이유

현재 3개 fixture는 정상 두-leg 계산, 09:59/18:00 거절, 기본 no-route/unavailable을 확인한다. 그러나 최초 완료 기준에 있던 **17:59 허용**, 선택 ID 없음, 최대 새 provider attempt, receipt 재사용 수치, 공개 반환값 비노출은 아직 직접 검증하지 않는다. 구현을 바꾸기 위한 명령이 아니라, 현재 공개 entry가 비용·시간 경계를 실제로 지키는지를 고정하는 보완이다.

### 수정 범위

`src/engine/`, `test/conditional-manual-course.test.ts`, 이 문서만 수정한다. UI/API adapter/카탈로그/DB/제품 기준 문서/보드는 수정하지 않는다. 카탈로그 원천의 시설·도매·장기 이용 제외는 `DATA-MARKET-01`과 provider 계약의 책임이다. 엔진은 그 provider가 전달한 구조 후보의 `conditional_more + conditionalVisit(market_or_street)` 자격을 fail-closed로 확인하는 경계만 유지한다.

### 완료 명령

1. 공개 entry를 변경하지 않고 다음 실제 확인 시각을 한 fixture 군으로 고정한다.
   - 09:59와 18:00은 `conditional_display_window_unavailable`, receipt adapter 호출 0회.
   - 10:00과 17:59는 같은 유효 후보·충분한 차감 후 예산에서 성공하며 각각 두 정확 receipt leg만 사용한다.
   - `selectedPlaceId`가 후보 목록에 없거나 `userConfirmedHours`가 true가 아니면 `conditional_candidate_not_eligible` 또는 `conditional_confirmation_required`, receipt 0회다.
2. 실제 provider 비용 상한을 증명한다. 두 leg가 각각 `newProviderAttemptCount: 2`를 반환하는 adapter fixture에서 총 4를 반환하고, adapter가 받은 각 budget 및 결과 receipt가 한 번의 수동 계산에서 새 provider attempt 4를 넘지 않음을 검증한다. `reused: true`, 새 provider attempt 0인 fixture도 `cacheOrSessionReuseCount`를 보존하고 총 attempt 0임을 검증한다.
3. 성공 반환 JSON에는 입력 후보 배열, 후보 좌표(`lat`/`lon`), 카카오 운영시간 원문, 사용자 ID가 섞이지 않고, 조건부 상태는 오직 `state: 'conditional_manual_course'`와 `hoursStatus: 'hours_confirmation_required_user_confirmed'`로만 표현됨을 검증한다. `VerifiedCourseV1`의 `placeIds`·시간표 식별자는 허용한다.
4. `remainingMin`은 이미 UI가 실제 CTA 시각 기준으로 차감한 값이라는 경계를 시험 이름·fixture 주석에 명시한다. 이 엔진이 최초 추천 시각 또는 경과 시간을 다시 계산하거나 후보 보충·continuation을 시작하지 않음을 검증한다.
5. `npm run test:typecheck`, `npx tsx --test test/conditional-manual-course.test.ts`, `npm test`, `npm run test:ui`, `git diff --check`를 실행한다. 완료 인계에는 변경 파일, 대표/대안과 분리한 경계, 각 fixture의 adapter call/attempt 수치, UI 연결 전 남은 조건을 네 항목으로 기록한다.

---

## 2026-08-31 — 2-R 보안·비용 경계 보완 완료 인계

### 1. 변경 파일과 목적

- `test/conditional-manual-course.test.ts`: 실제 CTA 시각 10:00·17:59 허용과 09:59·18:00 route 0, 선택 ID 없음·확인값 false route 0, 두 leg의 provider attempt 2+2=4, reused receipt 0 attempt/2 reuse, JSON 비노출을 고정했다.
- `docs/work/recommendation-engine/conditional-manual-course.md`: 시간·비용 fixture 보완 결과와 UI 연결 계약을 append-only로 기록했다.

### 2. 유지한 공개 계약·정책 경계

- 공개 entry·결과 타입·대표/대안/continuation 분리 경계는 변경하지 않았다. 성공 상태는 계속 `conditional_manual_course`와 `hours_confirmation_required_user_confirmed`뿐이다.
- 엔진은 최초 추천 시각이나 경과 시간을 재계산하지 않는다. UI가 실제 CTA 확인 시각과 이미 차감한 `remainingMin`을 입력해야 하며, 후보 보충·저장·fallback provider는 없다.
- 입력 후보 배열, 후보 좌표, 카카오 원문 운영시간, 사용자 ID는 반환 JSON에 포함하지 않는다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/conditional-manual-course.test.ts`: 6/6 통과. 허용 시각 성공은 각각 adapter 2회, 일반 receipt 1+1 attempt=2; 비용 상한 fixture는 adapter 2회, 2+2=4 attempt; reuse fixture는 adapter 2회, attempt 0/reuse 2다.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 144 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- `U-RESULTS-03`는 외부 카카오맵 확인 후 복귀한 실제 탭 시각을 사용하고, session 시작 시각과의 경과 분을 올림 차감해 이 entry에 전달해야 한다. 18:00 이후에는 entry 호출 자체를 하지 않아야 한다.
- 이 엔진은 사용자의 외부 확인을 신뢰 경계로만 기록하며, 카카오 실제 운영시간의 진실성·화면 전환 실패·복귀 지연은 증명하지 않는다. UI/API 연결 뒤 실기기에서 외부 전환→복귀→시각 차감→수동 결과 상태를 확인해야 한다.

---

## 2026-08-31 — 통합 수락

2-R을 수락한다. 통합 재실행에서 `test/conditional-manual-course.test.ts` 6/6, 타입 검사, 전체 테스트 144 pass/기존 skip 1, UI 테스트 144 pass/기존 skip 1, `git diff --check`를 확인했다. 다음 변경은 엔진이 아니라 `U-RESULTS-03-C`의 UI 컨테이너 연결이다. UI는 결과 화면 메모리의 동일 receipt port를 사용하되, 실제 CTA 시각 차감·18:00 이후 route 0·조건부 상태 분리를 지켜야 한다.
