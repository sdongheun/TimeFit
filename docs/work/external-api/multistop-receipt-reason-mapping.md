# API-MULTISTOP-RECEIPT-02 — 다장소 unavailable 안전 reason 전달

## 상태

구현 전. `2-T`가 수락된 뒤 수행하는 [통합 관찰 계약](../integration-decision/multistop-receipt-observability-contract.md)의 2단계다.

## 목적

Route Proxy가 이미 반환하는 typed `unavailable` 상태를, 원문·식별자 없이 엔진의 safe enum으로 한 번만 전달한다. 다음 internal A8 QA가 2곳 `route_verification_unavailable`의 경계를 구분할 수 있게 한다.

이 작업은 다장소 실패를 고치거나 추천 수를 늘리는 구현이 아니다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. [통합 관찰 계약](../integration-decision/multistop-receipt-observability-contract.md), [2-T](../recommendation-engine/receipt-unavailable-reason-contract.md), [과거 감사](multistop-receipt-unavailable-audit.md)
3. `src/services/routeProxyClientAdapter.ts`, `src/services/routeProxyProductionReceipt.ts`, `src/services/routeProxyActivatedCourseAdapter.ts`
4. `supabase/functions/route-proxy/handler.ts`, `test/route-proxy-production-ports.test.ts`, `test/activated-route-proxy-adapter.test.ts`, `test/route-proxy-edge-contract.test.mjs`

## 현재 사실과 반드시 지킬 매핑

- Edge receipt에는 현재 `limited | transport | store | provider | invalid_response | rejected`가 있으며, `in_flight`은 response `status`와 `reuse: 'in_flight_reuse'`로 표현된다. 현 handler의 `in_flight` receipt가 기본 `transport`로 평탄화될 수 있으므로, **response status가 `in_flight`이면 `in_flight`이 우선**해야 한다.
- engine의 허용 enum은 정확히 `limited | in_flight | store | provider | transport | invalid_response | rejected | unknown`이다.
- exact/no_route에는 reason을 붙이지 않는다. receipt 누락·오염, 지원하지 않는 status, 로컬 예산 0/소진, route adapter 내부 transport 예외는 `unknown`으로만 전달하거나 기존 fail-closed 처리한다. 원문 Error/message/body로 추론하지 않는다.
- `status`·receipt reason이 모두 있을 때는 위 `in_flight` 예외를 제외하고 유효한 receipt reason을 사용한다. 유효하지 않은 reason은 `unknown`이다.

## 작업 명령

1. `routeProxyClientAdapter`의 `getRouteReceipt`/`engineReceipt` 경계에, unavailable 결과만 engine `CourseV1RouteUnavailableReason`으로 변환하는 작은 순수 mapper를 둔다. public/private scope, 좌표 전송, walk→transit 순서, receipt attempt/reuse 산식은 그대로 둔다.
2. `RouteProxyReceipt` 및 production receipt validator가 `in_flight` 안전 값도 수용하도록 필요한 타입·검증을 맞춘다. Edge handler가 실제 `in_flight` receipt를 새 값으로 바꾸는 것은 이 작업 범위가 아니다. 클라이언트 mapper가 response status로 구분한다.
3. 응답 receipt가 없어 발생하는 unavailable, budget 0 또는 walk가 attempt를 모두 소진한 뒤 생기는 local unavailable에는 API 원인처럼 보이는 값을 만들지 말고 `unknown`을 준다.
4. 아래 고정 fixture 계약을 추가·유지한다.
   - `limited/store/provider/transport/invalid_response/rejected` receipt → 같은 engine reason
   - `status: in_flight` + 기존 `transport` receipt → `in_flight`
   - reason 누락/오염, receipt 없음, local budget → `unknown`
   - exact/no_route는 reason 없음
   - 기존 `rejected` stale snapshot, server cache/in-flight reuse attempt 0, non-2xx receipt 복원, public scope 좌표 비전송을 유지
5. API task의 완료는 **local unit/contract test와 타입 검사**까지다. 실제 Edge 배포, secret 변경, cache 삭제, 실제 Kakao 호출, 사용자 QA 재실행은 하지 않는다.

## 수정 경계

- 수정 가능: `src/services/routeProxy*`, 관련 API adapter/contract tests, 이 문서.
- 수정 금지: `src/engine/`, `supabase/functions/route-proxy/`, UI, 데이터, DB, `.env*`, route 한도·cache TTL·CAPTCHA·anonymous auth·배포 설정, 제품 정책·보드.
- 어떤 로그·테스트 출력에도 좌표, 장소명/ID, URL/query, JWT/token, API key, 원문 provider body, cache key를 넣지 않는다.

## 완료 기준과 인계

- 기존 다장소 결과와 A8 8→조건부16, adapter 24 상한이 코드상 불변임을 기록한다.
- API contract test, `npm run test:typecheck`, 관련 회귀, `git diff --check` 결과를 기록한다.
- 다음 UIUX 단계가 표시할 수 있도록 safe enum 타입의 출처와 `shapeDiagnostics.unavailableReasonCounts`에 도달하는 경로만 인계한다. 일반 사용자 UI나 internal build는 아직 수정하지 않는다.

---

## 2026-09-02 완료 인계 — API-MULTISTOP-RECEIPT-02

### 변경 파일

- `src/services/routeProxyClientAdapter.ts`: typed `unavailable` response만 `CourseV1RouteUnavailableReason`으로 변환하는 순수 mapper를 추가했다. `in_flight` response status는 receipt의 기존 `transport`보다 우선하며, receipt 누락·오염·지원하지 않는 status와 local budget/attempt 종료는 `unknown`으로 반환한다.
- `src/services/routeProxyProductionReceipt.ts`: production non-2xx validator가 안전 `in_flight` receipt value를 수용하도록 확장했다.
- `src/services/routeProxyActivatedCourseAdapter.ts`: 일반 `getRoute`의 stale snapshot `route_proxy_rejected` fail-closed 동작은 유지하면서, engine용 `getRouteReceipt`는 typed rejected receipt를 보존해 `reason: 'rejected'`로 전달하도록 분리했다.
- `test/route-proxy-client-adapter.test.ts`, `test/route-proxy-production-ports.test.ts`, `test/activated-route-proxy-adapter.test.ts`: 기존 typed 여섯 reason, `in_flight` status 우선, missing/오염/local `unknown`, exact/no_route 무reason, stale rejected 및 receipt/cache 재사용을 고정했다.

### 유지한 계약

- engine이 정의한 enum `limited | in_flight | store | provider | transport | invalid_response | rejected | unknown`만 전달한다. raw Error/message/body, 장소·좌표·URL·token·cache key를 새로 해석하거나 기록하지 않는다.
- public/private scope·좌표 전송, walk→transit 순서, receipt attempt/reuse 산식, A8 첫 8→조건부 16과 adapter 24 상한은 변경하지 않았다. exact/no_route에는 reason을 붙이지 않는다.
- Edge handler·배포·secret·cache TTL·quota·CAPTCHA·anonymous Auth 및 UI/엔진/데이터/DB는 변경하지 않았다. 실제 Edge/Kakao 호출, 사용자 QA 재실행, cache 삭제는 0회다.

### 테스트 결과

- `npx tsx --test test/route-proxy-client-adapter.test.ts test/route-proxy-production-ports.test.ts test/activated-route-proxy-adapter.test.ts test/route-proxy-edge-contract.test.mjs test/route-proxy-page-budget.test.ts` — 31 passed.
- `npm run test:typecheck` 통과, `npm run test:ui` 통과 (165 passed, 기존 skip 1), `npm test` 통과 (113 passed), `git diff --check` 통과.

### 다음 결정·위험

- UIUX 다음 단계는 engine `CourseV1RouteReceipt.reason`이 `verifyContinuationPage`를 거쳐 `shapeDiagnostics.unavailableReasonCounts`에 누적된 값만 exact internal diagnostics에 표시할 수 있다. 일반 사용자 UI와 internal build/환경값은 이 작업에서 바꾸지 않았다.
- 새 internal A8 QA는 통합 관찰 계약대로 각 고정 입력을 한 번만 실행하고 형태별 safe reason 집계와 기존 attempt/call/reuse 합계만 기록해야 한다. `unknown`은 local/누락 경계이며 API 원인으로 단정하거나 호출 상한·재시도를 바꾸는 근거가 아니다.
