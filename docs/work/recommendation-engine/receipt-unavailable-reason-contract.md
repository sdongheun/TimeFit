# 2-T — 다장소 receipt unavailable 안전 원인 보존

## 상태

구현 완료·인계 대기. [통합 관찰 계약](../integration-decision/multistop-receipt-observability-contract.md)의 1단계인 safe reason 정규화와 형태별 집계를 완료했다.

## 목적

production A8에서 다장소가 `unavailable`로 중단될 때, API 원문 없이 형태별 safe enum 건수만 다음 internal QA로 전달한다. 이 작업은 원인을 고치거나 다장소 결과를 늘리지 않는다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. [통합 관찰 계약](../integration-decision/multistop-receipt-observability-contract.md)
3. `src/engine/courseV1.ts`, `test/course-v1-pagination.test.ts`

## 작업 명령

1. `CourseV1RouteReceipt`의 `result: 'unavailable'` variant에만 contract enum을 optional로 추가한다. 외부에서 누락·오염된 값은 engine `normalizeReceipt`에서 `unknown`으로 정규화한다.
2. `CourseV1ShapeDiagnostics`에 1/2/3곳별 `unavailableReasonCounts`를 추가한다. 기존 queue/시도/검증·시간·경로 집계와 결과 선택은 불변이다.
3. `verifyContinuationPage`에서 실제 unavailable receipt가 만든 `route_verification_unavailable`만 해당 reason을 같은 장소 수에 한 번 집계한다. local adapter/attempt 상한이 만든 unavailable은 `unknown`으로 집계한다.
4. 고정 fixture로 `limited`, `provider`, 누락 reason→`unknown`, exact/no_route 무집계를 검증한다. 2-S-R의 첫 N2 실패·두 번째 N2 성공, all multi-stop failure, 8→16·adapter24 한계를 유지한다.

## 경계

- 수정 가능: `src/engine/`, 순수 엔진 tests, 이 문서.
- 수정 금지: `src/services/`, Edge, UI, 데이터, DB, `.env*`, 제품 정책·보드.
- 실제 API/GPS/DB 호출은 0회다.

## 완료 기준

- 관련 엔진 test, `npm run test:typecheck`, `npm test`, `git diff --check`를 기록한다.
- API가 아직 reason을 전달하지 않는 현재 상태에서도 compile·기존 동작이 유지됨을 기록한다.
- 다음 API 단계에 필요한 공개 타입·매핑 규칙만 인계한다.

---

## 2026-09-02 — 2-T 완료 인계

### 1. 변경 파일과 목적

- `src/engine/courseV1.ts`: `CourseV1RouteUnavailableReason` (`limited | in_flight | store | provider | transport | invalid_response | rejected | unknown`)을 `result: 'unavailable'` receipt에만 optional으로 추가했다. `normalizeReceipt`은 누락·오염·비정상 receipt를 `unknown`으로 fail-closed한다. `CourseV1ShapeDiagnostics`는 장소 수별 `unavailableReasonCounts`만 추가 집계한다.
- `src/engine/index.ts`: 다음 API 매핑 단계가 사용할 safe reason 타입을 barrel에 공개했다.
- `test/course-v1-pagination.test.ts`: `limited`, `provider`, 누락, 오염 reason의 2곳 형태 집계와 exact/no_route 무집계를 추가했다.

### 2. 유지한 공개 계약·정책 경계

- queue 순서·후보/결과 선택, 18개 풀·8→16 provider attempt·adapter 24 상한은 바꾸지 않았다. safe reason은 `route_verification_unavailable`이 실제 발생한 형태에 한 번만 집계한다.
- local adapter/attempt 상한이 만든 unavailable은 API 원인으로 추정하지 않고 `unknown`으로만 집계한다.
- 집계에는 장소명/ID·좌표·주소·URL·응답 원문·cache key·JWT/token·사용자 ID·카카오 키를 넣지 않는다. UI/API/Edge/데이터/DB는 수정하지 않았다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`: 52/52 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 165 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- API-MULTISTOP 후속 단계는 Route Proxy의 `unavailable`만 위 enum으로 매핑해야 하며, exact/no_route에는 reason을 붙이면 안 된다. 누락·새 값·원문 오류는 engine이 `unknown`으로 처리한다.
- 다음 internal QA 한 번에서 1/2/3곳 `unavailableReasonCounts`와 기존 attempt/call/reuse 합계만 읽는다. 이 관찰은 원인을 고치거나 결과·호출량을 바꾸는 근거가 아니며, 실제 Edge/카카오 원인은 API/QA 경계에서 판정한다.
