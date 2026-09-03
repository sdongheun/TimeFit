# API-MULTISTOP-RECEIPT-01 — 다장소 receipt unavailable 원인 감사

## 상태

구현 전·읽기 전용 감사. `QA-SHAPE-01`의 production A8 두 입력에서 같은 관찰이 나왔다.

- 1곳: queue 18 / 시도 1 / 검증 1
- 2곳: queue 153 / 시도 1 / 검증 0 / `경로 확인 불가` 1
- 3곳: queue 816 / 시도 0 / 검증 0
- 결과: 대표 1곳만, 대안 없음

따라서 2곳 후보 부족·queue 미배정·표시 누락은 현재 관찰과 맞지 않는다. 첫 2곳의 정확 경로 receipt가 `unavailable`로 끝난 뒤 엔진이 fail-closed로 중단한 상태다.

## 목적

호출 상한, B12 전환, 엔진 queue, 장소 분류를 바꾸기 전에 Route Proxy가 해당 `unavailable`을 어떤 **안전 typed 상태**로 반환했는지 확인한다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `src/services/routeProxyClientAdapter.ts`, `routeProxyActivatedCourseAdapter.ts`
3. `supabase/functions/route-proxy/handler.ts`
4. [QA-SHAPE-01](../qa-release/production-shape-diagnosis.md), [API-PAGE-01](verified-course-page-budget.md)

## 1단계 — 배포·로그 읽기 전용 확인

1. 현재 배포된 `route-proxy`가 현행 대표 snapshot과 같은 버전으로 동작하는지, Kakao route secret·abuse guard·anonymous auth의 **존재 여부만** 확인한다. 값은 절대 읽거나 기록하지 않는다.
2. QA-SHAPE-01 직후의 가장 좁은 Edge 로그/관찰 창에서 `route-proxy` 응답을 안전하게 집계한다.
   - mode별 `ok`, `no_route`, `limited`, `in_flight`, `store_unavailable`, `http_error`, `network_error`, `invalid_response`, `rejected` 건수
   - receipt의 새 provider attempt 0/1과 reuse 종류 건수
3. 좌표, 장소 ID·명, URL query, Authorization/JWT, CAPTCHA token, API key, 원문 provider body, 개별 cache key는 화면·문서·테스트 출력에 기록하지 않는다.
4. 로그가 없거나 두 QA 실행과 연관 지을 안전한 방법이 없으면, 추정하지 말고 `관찰 불가`로 끝낸다. 이 단계에서 배포·환경값·코드를 바꾸지 않는다.

## 판정

- `limited`/`in_flight` → rate/cache·동시성 경계가 원인 후보. 호출 상한을 바로 올리지 않고 해당 상태의 재현 fixture를 먼저 만든다.
- `store_unavailable` → Supabase store/RPC 경계가 원인 후보.
- `http_error`/`network_error`/`invalid_response` → Kakao 제공사·응답 변환 경계가 원인 후보.
- `rejected` → snapshot/Auth/request 계약 불일치 후보.
- 연관 로그가 모두 `ok`인데 앱은 unavailable → mobile adapter 변환 경계가 원인 후보.
- 관찰 불가 → 한 번의 internal-only 안전 reason 관찰 계약을 별도 제안한다. 본 작업에서 임의 구현하지 않는다.

## 경계와 완료 기준

- 수정 금지: 추천 엔진·UI·카탈로그·DB schema·환경값·호출 상한·배포.
- 실제 사용자 요청을 추가 실행하지 않는다. QA-SHAPE-01의 이미 발생한 두 실행만 읽는다.
- 변경 파일, 상태 집계, 판정, 실행하지 않은 변경을 이 문서에 인계한다.
- 관련 existing contract test를 읽기 전용으로 확인할 수 있으나, 실제 API 재호출 회귀 테스트는 만들지 않는다.

---

## 2026-09-02 감사 인계 — API-MULTISTOP-RECEIPT-01

### 변경 파일

- `docs/work/external-api/multistop-receipt-unavailable-audit.md`: 이미 발생한 QA-SHAPE-01의 2곳 `unavailable`에 관한 읽기 전용 배포·상태 감사 결과를 기록했다. 코드·설정·배포·secret은 변경하지 않았다.

### 상태 집계와 판정

- 현재 local public snapshot은 `representative-a4a72930`/191 points이며, remote에서는 `route-proxy` Function 존재와 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`, Kakao route key, abuse guard, anonymous Auth secret **이름의 존재만** 확인했다. secret 값·remote snapshot 본문은 읽지 않았다.
- native Supabase CLI의 제공 Function 명령에는 로그 조회 subcommand가 없었다. 작업 묶음과 연결 QA 기록에는 두 실행의 정확한 로그 창·요청 식별자가 없어, 직접 읽을 수 있는 로그가 있더라도 두 실행과 안전하게 연관 지을 방법이 없다.
- 안전 상태 집계: `ok`, `no_route`, `limited`, `in_flight`, `store_unavailable`, `http_error`, `network_error`, `invalid_response`, `rejected`, receipt attempt 0/1, reuse 종류 모두 **관찰 불가**. 이 작업에서는 실제 request를 추가하지 않았으므로 그 공백을 새 호출로 메우지 않았다.
- 판정: 2곳 receipt `unavailable`의 원인은 **관찰 불가**다. `limited`/store/provider/`rejected`/mobile 변환 중 어느 하나로도 귀속하지 않는다. 특히 local snapshot과 secret 이름 존재만으로 remote secret version 일치나 QA 당시 응답 상태를 증명할 수 없다.

### 유지한 계약

- public/private scope, cache·lease·budget, Kakao-only provider, typed receipt와 stale snapshot의 `route_proxy_rejected` 경계는 변경하지 않았다.
- 추천 엔진 queue·호출 상한·B12·카탈로그·UI·DB schema·CAPTCHA·anonymous Auth·환경값과 모든 Edge 배포는 변경하지 않았다. Kakao/Supabase provider 재호출, cache 삭제, 실제 사용자 요청 재실행은 0회다.

### 테스트 결과

- `npx tsx --test test/route-proxy-production-ports.test.ts test/activated-route-proxy-adapter.test.ts test/route-proxy-edge-contract.test.mjs` — 18 passed.
- fixture는 typed non-2xx receipt 복원, `rejected`의 안전 enum 분리, store/provider/transport fail-closed 경계를 확인한다. 실제 API·Edge log 조회·provider 호출은 0회다.

### 다음 결정·위험

- 이 감사만으로 API 원인을 고정하거나 호출 상한·재시도·adapter를 바꾸면 안 된다. `limited`/store/provider/`rejected`/mobile 변환을 분리하려면 별도 작업에서 한 번의 internal-only 안전 reason 관찰 계약(시각 창과 상태 enum만 기록, 원문·식별자·좌표 비기록)을 먼저 통합·결정해야 한다.
- 작업 조정 보드의 QA-SHAPE-01 요약과 연결된 QA 작업 파일의 최신 기록이 서로 다른 관찰 상태를 담고 있다. 이 역할은 QA 문서를 수정하지 않으므로, 통합·결정/QA가 어느 두 실행·시각 창을 감사 대상으로 확정해야 한다.
