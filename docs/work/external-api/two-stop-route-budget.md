# API-TWO-STOP-01 — 2곳 route receipt·public store·예산 재사용 계약

## 담당과 병렬 실행

- 담당: 외부 API 어댑터 세션
- 상태: fixture 판별·클라이언트 국소 교정 완료, 일반 사용자 활성화 차단
- 병렬 가능: `2-Y`, `U-TWO-STOP-01`, `QA-TWO-STOP-01`
- 목적: 새 정책을 설계하는 것이 아니라 현재 adapter/Edge 경계가 확정된 3-leg·36회 ledger를 정확히 지원하는지 먼저 판별하고, 확인된 국소 결함만 보완한다.

시작 시 `AGENTS.md`, `docs/README.md`, `docs/work/integration-decision/two-stop-limited-assembly.md`, `docs/work/external-api/README.md`, 이 파일만 읽는다. 필요할 때만 `multistop-receipt-reason-mapping.md`, `public-route-store-readiness-audit.md`, `verified-course-page-budget.md`, `route-geometry.md`의 현재 계약 부분을 읽고 archive 전체는 열지 않는다.

## 현재 사실과 미확정

확정된 사실:

- mobile→Edge receipt는 exact/no_route/unavailable과 safe reason, `newProviderAttemptCount`, reuse를 전달한다.
- public 대표 장소 간 directed leg는 서버 cache/lease/store 경계를 사용하고 private endpoint leg는 장기 저장하지 않는다.
- 과거 실기기 mixed multi-stop은 첫 candidate-to-candidate leg에서 `store` unavailable을 보였다.
- remote migration·secret 이름·RPC signature/권한 읽기 감사에서는 단일 국소 결함을 찾지 못했다.

미확정:

- 현재 코드의 고정 Edge handler fixture에서 public A→B exact/cache/no_route/store failure가 새 pair-only 소비자가 요구하는 receipt로 모두 종결되는지
- 한 recommendation session의 여러 engine call이 전달하는 remaining budget을 adapter가 초과하지 않는지
- 취소된 client 요청 이후 Edge에서 시작된 provider attempt를 환불한 것으로 오인하는 경계가 있는지

원격 장애 원인을 추측해 배포하거나 secret/migration을 바꾸지 않는다. 먼저 고정 fixture로 판별한다.

## 감사·구현 순서

1. `CourseV1ReceiptRoutePort`와 `createCourseV1ProxyRouteAdapter`의 입력 예산이 leg당 남은 attempt 0/1/2를 실제로 제한하는지 확인한다.
2. 공개 A→B와 B→A가 방향이 다른 cache key이며 public catalog identity/version 검증을 통과할 때만 store를 사용하는지 확인한다.
3. private O→A, B→D와 public A↔B를 같은 fixture에서 호출해 scope가 섞이지 않는지 확인한다.
4. exact·no_route·limited·store·provider·transport·rejected·in_flight를 mobile safe reason으로 변환하고, cache/server/in-flight hit이 attempt 0인지 확인한다.
5. 한 engine stage가 남은 예산보다 큰 `maxNewProviderAttemptCount`를 요청해도 adapter가 0~2의 leg 한도와 실제 receipt 값을 넘겨 보고하지 않는지 확인한다.
6. client abort/응답 무시가 이미 Edge에서 시작한 호출을 0회로 바꾸지 않는다는 계약 테스트를 추가한다. transport cancel을 자동 재시도하지 않는다.
7. 결함이 기존 adapter 변환·cache key·fixture 누락이면 이 작업에서 최소 수정한다. 새 DB schema, 새 provider, fallback, quota 변경, Edge 배포가 필요하면 코드 변경을 중단하고 정확한 차단점을 기록한다.

## 유지해야 하는 호출·캐시 계약

- Kakao 도보·대중교통 단일 provider, ODsay/TMAP fallback 0
- public cache 기본 TTL 15분, 방향·mode·catalog/route version 분리
- private 좌표·사용자 ID·IP·추천 session을 public cache/DB/log에 저장하지 않음
- 선택 단계 live place provider 호출 0
- 추천 36회 계산은 엔진 ledger 책임이며 API는 receipt를 거짓 없이 제공
- 상세 geometry connector는 추천 ledger 밖이며 2곳 최대 6회 예약. connector 자체의 10분/64개 process memory·in-flight 재사용은 유지
- cache/RPC/Auth/adapter call은 provider attempt와 별도 관찰

## 필수 계약 fixture

새 API 전용 테스트 파일을 사용해 엔진·UI·QA 새 파일과 겹치지 않는다.

1. public A→B exact provider attempt 1과 server cache hit 0
2. A→B와 B→A 방향 cache 분리
3. public A→B no_route와 store unavailable의 typed receipt, store 실패 시 provider fallback 0
4. private O→A/B→D는 public store RPC 0, public A↔B만 store 경계 사용
5. walk exact 후 transit 조건부 호출을 포함해 한 leg 최대 attempt 2
6. remaining 0이면 provider 0, remaining 1이면 최대 1, cache hit은 remaining 0이어도 재사용 가능
7. in-flight reuse attempt 0과 중복 provider 호출 0
8. abort/consumer stale 처리 뒤 이미 시작한 provider attempt 계수 유지, 자동 retry 0
9. malformed receipt가 exact로 승격되지 않고 safe `invalid_response/unknown`
10. private geometry connector 6개 요청의 동시/TTL 재사용 가능성과 7번째를 UI/소비자가 차단할 수 있는 공개 receipt 유지

## 검증 명령과 중단 조건

- 관련 route proxy client/production/page budget/timeout/geometry/private connector 테스트
- 새 API-TWO-STOP-01 계약 테스트
- `npm run test:typecheck`
- `git diff --check`

실제 Kakao·Supabase 원격 호출, migration push, secret 변경, Edge deploy, cache 삭제는 0회다. 고정 fixture에서도 public A→B가 typed exact/no_route로 도달할 수 없고 새 schema가 필요하다고 확인되면 `활성화 차단`으로 기록하되 다른 병렬 작업을 되돌리지 않는다. 일반 사용자 연결만 Wave 2에서 보류한다.

## 수정 금지와 인수인계

- 수정 금지: `src/engine/`, `src/ui/`, `App.tsx`, data/catalog, migration, 제품 기준 문서, 보드, `.env*`
- 추천 후보 수·순서·36회 배분·부족 reason 정책을 API 세션이 바꾸지 않는다.
- 완료 기록은 변경 파일/유지 계약/테스트 수/남은 runtime 위험을 이 문서 아래에 남긴다. 실제 원격 성공을 fixture 성공으로 주장하지 않는다. commit·push는 사용자 요청 전 금지한다.

## 2026-09-03 완료 인계 — fixture 판별과 활성화 차단

### 변경 파일 / 변경 목적

- `test/api-two-stop-route-budget.test.ts`: public A→B/B→A directed cache, exact/cache/no-route/store receipt, public/private scope, leg 0/1/2 attempt, in-flight reuse, stale consumer 비환불, malformed receipt, connector 6회 소비 경계를 고정 fixture로 추가했다.
- `src/services/routeProxyClientAdapter.ts`: receipt의 result/count/reuse 구조를 검증하고, `status=ok` exact와 `receipt.result`가 불일치하면 exact로 승격하지 않고 `invalid_response`로 닫도록 국소 교정했다. walk/transit 한 leg의 기존 최대 2 attempt 중단 순서는 유지했다.
- 이 문서: 통과한 계약과 원격 활성화 전 해결해야 할 두 차단점을 기록했다.

### 유지한 계약

- public representative A↔B는 좌표 없이 `catalogVersion + directed from/to POI ID + mode`로 분리되고, private O→A/B→D만 요청 수명 좌표를 사용한다.
- Kakao 단일 provider, public cache 15분 기본값, cache/lease/store, private 비영속, typed safe reason, ODsay/TMAP/직선 fallback 0, 자동 retry 0을 바꾸지 않았다.
- 추천 session 총 36회 ledger와 connector 최대 6회 차단은 엔진/UI 소비자 책임으로 남겼다. API는 한 leg receipt의 실제 0~2만 보고하고 connector 내부에 새 course 상한을 넣지 않았다.
- `supabase/functions/route-proxy/handler.ts`, DB schema/migration, secret/quota, Auth/CAPTCHA, 엔진/UI/App/data/catalog, 보드는 수정하거나 배포하지 않았다. 실제 Kakao·Supabase·Cloudflare 호출과 cache 삭제는 모두 0회다.

### 테스트 결과

- failure-first 신규 fixture: 최초 8개 중 6개 통과, 2개 예상 실패. 실패는 (1) provider 성공 뒤 store 완료 실패가 `newProviderAttemptCount: 0`으로 평탄화되는 현행 Edge receipt, (2) `status=ok`와 `receipt.result=no_route` 불일치를 exact로 승격하는 client 변환이었다.
- client 국소 교정 후 `npx tsx --test test/api-two-stop-route-budget.test.ts` — 8/8 통과. 첫 A→B miss 1, 같은 방향 cache hit 0, B→A miss 1을 확인했고 fixture provider 시작은 총 2회였다.
- 관련 API 회귀 `test/api-two-stop-route-budget.test.ts`, client/page/timeout/geometry/private connector 묶음 — 52/52 통과. 더 넓은 activated/production 포함 실행도 67개 중 API 동작 67/67 통과했다.
- `git diff --check` — 통과.
- `npm run test:typecheck` — **통합 미통과**. 이 API 파일의 타입 오류는 교정했지만, 병렬 Wave의 아직 없는 `beginReleaseTwoStopSelectionV1`, `continueReleaseTwoStopSelectionV1`, `ReleaseTwoStopAttemptLedger`를 먼저 참조한 엔진 테스트 때문에 전체 검사가 중단됐다. 해당 역할 산출물이 합쳐진 뒤 Wave 2에서 재실행해야 한다.

### 다음 결정·위험

- **활성화 차단 1 — remaining 0 cache-only 부재:** 현재 `getRouteReceipt(..., { maxNewProviderAttemptCount: 0 })`는 Edge를 0회 호출해 provider 초과는 막지만, 이미 존재하는 server cache hit도 조회할 수 없다. 반대로 현 요청을 보내면 cache miss에서 provider가 시작될 수 있다. 따라서 “remaining 0에서도 hit 재사용”을 안전하게 만족하려면 Edge가 명시적인 cache-only/attempt-0 요청을 받아 miss에서 provider를 시작하지 않는 공개 계약이 필요하다.
- **활성화 차단 2 — store 완료 실패의 비환불 위반:** public provider 응답을 받은 뒤 `route_proxy_complete_fetch_lease`가 실패하면 현 handler의 최종 catch가 `store_unavailable + newProviderAttemptCount: 0`을 반환한다. fixture에서는 provider 1회가 실제 시작됐으므로 session ledger가 이를 환불하면 36회 상한을 넘을 수 있다. handler가 요청 단위의 provider-started 상태를 안전 receipt에 보존하는 교정과 별도 배포 승인이 필요하다.
- 위 두 항목은 Edge 요청/응답 계약과 운영 배포가 필요하므로 이번 “원격 호출·배포 0” 작업에서 임의 수정하지 않았다. 해결 전에는 pair-only 일반 사용자 진입을 켜지 않고 one-stop fallback을 유지한다.
- `2-Y`·`U-TWO-STOP-01` 산출물이 합쳐지면 전체 typecheck와 QA-TWO-STOP-01 단일 자동 통합 게이트를 실행한다. fixture 성공을 실제 public store 운영 성공으로 해석하지 않는다.

---

# API-TWO-STOP-02 — cache-only 조회와 provider attempt 비환불 Edge 계약

## 상태·담당·선행 결과

- 담당: 외부 API 어댑터 세션
- 상태: 완료 — 로컬 구현·fixture 회귀 통과, 원격 배포 전
- 선행: 위 `API-TWO-STOP-01`의 국소 client 교정과 두 활성화 차단 fixture
- 병렬 가능: `2-Y`, `U-TWO-STOP-01`; `QA-TWO-STOP-01`은 fixture 준비만 가능하고 최종 통합 실행은 이 작업 완료 뒤
- 단일 작성자: `src/services/routeProxyClientAdapter.ts`, `supabase/functions/route-proxy/handler.ts`, 이 기능의 API 계약 테스트

이 작업은 새 원인을 탐색하는 감사가 아니다. 이미 재현된 아래 두 결함을 **한 번에 구현·회귀 고정**한다.

1. 남은 신규 provider 예산이 0일 때 public server cache를 읽을 방법이 없다.
2. provider가 실제 시작된 뒤 store/lease 완료가 실패하면 최종 receipt가 attempt 0으로 평탄화된다.

시작 시 `AGENTS.md`, `docs/README.md`, `docs/work/integration-decision/two-stop-limited-assembly.md`, `docs/work/external-api/README.md`, 이 파일의 `API-TWO-STOP-01 완료 인계`와 이 절만 읽는다. 과거 API archive와 unrelated work 문서를 다시 읽지 않는다.

## 확정 공개 요청 계약

`RouteProxyFunctionRequest`에 다음 선택 필드를 추가한다.

```ts
maxNewProviderAttemptCount?: 0 | 1
```

- 한 번의 Edge 요청은 하나의 mode·provider만 다루므로 허용 값은 `0 | 1`이다. 엔진 leg 전체의 `0 | 1 | 2`와 혼동하지 않는다.
- 필드 생략은 기존 호출과 호환되는 `1`이다. 이미 배포된 caller를 깨뜨리지 않는다.
- `0`은 **cache-only**다. 인증·public snapshot 검증·기존 server cache 조회는 허용하지만 budget reserve, fetch lease claim/wait, Kakao provider fetch, 자동 retry는 모두 0회다.
- cache-only public hit은 기존 exact receipt `newProviderAttemptCount: 0`, `reuse: server_cache_hit`으로 반환한다.
- cache-only public miss와 private request의 `0`은 기존 safe unavailable 계열로 반환한다. 사용자에게 새 문구나 내부 cache miss를 노출하지 않으며 `newProviderAttemptCount: 0`이어야 한다.
- `0` 요청을 cache miss 뒤 `1`로 자체 승격하거나 다른 provider/mode fallback으로 바꾸지 않는다.
- 좌표가 없는 public scope와 요청 수명 좌표를 쓰는 private scope 경계는 그대로다.

새 status/reason/reuse enum은 이 결함을 고치는 데 꼭 필요하다는 실패 테스트가 없는 한 만들지 않는다. cache-only miss는 현행 `limited` safe 경계로 닫아 엔진의 `attempt_limit_reached` 해석을 유지한다. raw `cache_miss`·RPC 오류·provider명은 앱으로 보내지 않는다.

## client adapter 구현 규칙

`createCourseV1ProxyRouteAdapter().getRouteReceipt()`는 다음처럼 동작해야 한다.

1. `maxNewProviderAttemptCount > 0`인 기존 walk→조건부 transit 순서와 구간당 최대 2 attempt를 유지한다. 각 Edge 요청에는 그 시점의 mode별 허용값 `1`을 명시한다.
2. 전체 남은 값이 `0`이면:
   - public segment만 walk cache-only를 조회한다.
   - walk cache hit이 14분 이하 exact면 즉시 반환한다.
   - walk가 exact지만 14분 초과이거나 cache-only miss/no-route이면 transit cache-only를 확인할 수 있다.
   - 두 mode 모두 miss이면 unavailable/limited·attempt 0으로 종료한다.
   - private request는 영속 server cache 대상이 아니므로 invoker·Edge·provider 모두 0회로 즉시 종료한다.
3. cache-only Edge 호출 수는 adapter call/HTTP 관찰값일 뿐 provider attempt에 합산하지 않는다.
4. cache-only 결과도 `status`, `receipt.result`, `newProviderAttemptCount`, `reuse`가 서로 일치할 때만 exact로 사용한다. 손상 응답은 `invalid_response`로 fail-closed한다.
5. 기존 API-TWO-STOP-01의 exact/receipt 불일치 교정을 되돌리지 않는다.

## Edge handler 구현 규칙

`supabase/functions/route-proxy/handler.ts`는 다음 순서를 보장한다.

1. 요청 shape에서 `maxNewProviderAttemptCount`를 검증한다. 생략은 `1`, `0 | 1` 이외 값·NaN·문자열은 provider 0으로 `rejected`한다.
2. 기존 method/body/public catalog/Auth/anonymous abuse guard 검증은 유지한다.
3. public 요청은 directed cache를 먼저 조회한다. cache hit이면 allowance와 무관하게 exact attempt 0을 반환한다.
4. cache miss이고 allowance가 `0`이면 provider key 확인, quota reserve, lease claim/wait, provider fetch 전에 typed unavailable attempt 0으로 종료한다.
5. private 요청의 allowance `0`도 provider key/quota/lease/fetch 전에 종료한다.
6. allowance `1`일 때만 기존 deadline·Kakao key·quota·lease·provider 경계를 진행한다.

요청 단위로 실제 provider fetch가 시작됐는지를 나타내는 내부 `0 | 1` 계수를 둔다. 이 값은 로그나 공개 식별자가 아니라 최종 safe receipt를 정확히 만들기 위한 로컬 상태다.

- Kakao fetch를 실제 시작하기 직전에 1로 바꾼다.
- provider 결과 이후 `route_proxy_complete_fetch_lease`, release 또는 다른 store/lease 후처리가 실패해 바깥 catch로 이동해도 최종 `store_unavailable` receipt에 이 계수를 보존한다.
- provider 전에 cache/RPC/Auth/config가 실패하면 0이다.
- timeout/network/http/invalid/no-route의 기존 count 1을 유지한다.
- store 실패 뒤 성공 route를 그대로 반환하거나 재호출하지 않는다. typed unavailable + 실제 count만 반환한다.
- 같은 요청에서 어떤 실패 경로도 1을 초과해 보고하지 않는다.

`route_proxy_complete_fetch_lease` RPC signature나 DB schema는 바꾸지 않는다. 이 작업에 migration은 필요하지 않아야 한다. 정말 migration이 필요하다고 확인되면 임의로 만들지 말고 해당 실패 fixture와 이유를 남겨 통합·결정 세션에 반환한다.

## failure-first 필수 fixture

기존 `test/api-two-stop-route-budget.test.ts`의 차단 fixture를 삭제하거나 정상 현상처럼 바꾸지 말고, 먼저 새 기대값으로 실패하게 만든 뒤 구현한다.

1. 필드 생략 legacy public miss → provider 1, exact/no-route 기존 동작
2. public cache-only exact hit → provider/reserve/claim/complete 0, attempt 0, server cache reuse
3. public cache-only miss → provider/reserve/claim/wait/complete 0, typed unavailable attempt 0
4. private allowance 0 → invoker/Edge 또는 최소 provider 0이라는 client·handler 양쪽 경계
5. client remaining 0에서 public walk cache hit 사용
6. client remaining 0에서 walk miss 뒤 transit cache hit 사용, 총 provider 0
7. client remaining 0에서 두 mode miss → provider 0·exact 승격 0
8. public exact provider 1 뒤 complete store 실패 → `store_unavailable`, attempt 1, fallback/retry 0
9. public no-route provider 1 뒤 release 실패 → `store_unavailable`, attempt 1, fallback/retry 0
10. provider 전 cache/store RPC 실패 → `store_unavailable`, attempt 0
11. `maxNewProviderAttemptCount` 손상값 → rejected, provider 0
12. 기존 A→B/B→A directed cache, in-flight reuse, malformed receipt, one-stop page, Auth/CAPTCHA 회귀 불변

테스트는 handler의 provider call뿐 아니라 reserve/claim/wait/complete/release RPC 이름별 횟수도 검증한다. `8/8 통과`처럼 차단 현상을 기대하는 테스트가 남아 있으면 완료가 아니다. 두 기존 `활성화 차단 fixture`는 정상 기대값으로 전환되어야 한다.

## 실행할 검증

최소 다음을 한 번에 수행한다.

- `npx tsx --test test/api-two-stop-route-budget.test.ts`
- route proxy client/activated/page-budget/production-port/timeout/deadline/geometry 관련 계약 테스트
- Edge contract 및 fetch-lease/store migration **읽기 계약** 테스트
- `npm run test:typecheck`
- `git diff --check`

병렬 `2-Y`/UI 작업 중 타입 검사가 그 역할의 일시적 미완성 symbol 때문에 실패하면 API 소유 파일의 타입 오류가 0인지 별도로 증명하고, 전체 typecheck는 Wave 2 대기로 정확히 기록한다. 이를 API-TWO-STOP-02의 Edge 결함 미해결로 혼동하지 않는다.

## 이번 작업의 금지선

- 실제 Kakao·Supabase 원격 호출, Edge 배포, secret/env 변경, migration push, cache 삭제 금지
- ODsay/TMAP/차량/근사 fallback, 자동 retry, provider 변경 금지
- `src/engine/`, `src/ui/`, `App.tsx`, data/catalog, 제품 기준 문서, 보드 수정 금지
- 36회 배분, B 수량·순서·후보 정책, geometry connector 6회 정책 변경 금지
- client cache-only 결과를 로컬 exact로 조작하거나 store 실패를 no-route로 바꾸는 처리 금지
- commit·push는 사용자 요청 전 금지

## 완료 기준과 인수인계

아래를 모두 만족해야 `API-TWO-STOP-02 완료`로 기록한다.

1. public remaining 0 cache hit 재사용과 miss provider 0이 client→handler fixture에서 확인된다.
2. provider 이후 store/lease 실패 receipt가 실제 attempt 1을 보존한다.
3. provider 전 실패는 attempt 0이고 모든 실패에서 fallback/retry 0이다.
4. 생략 caller 호환과 기존 one-stop/API 회귀가 통과한다.
5. 실제 원격 성공이나 배포 완료를 주장하지 않는다.

이 문서 아래에 변경 파일과 목적, 변경하지 않은 계약, 명령별 테스트 수·결과, 남은 원격 배포 위험을 네 항목으로 기록한다. 기준 하나라도 미충족이면 완료로 쓰지 말고 정확한 fixture ID와 차단점을 남긴다. 이 작업이 수락된 뒤 통합·결정 세션이 다른 역할 결과와 함께 Wave 2 자동 게이트 및 **단 한 번의 Edge 배포 시점**을 결정한다.

## API-TWO-STOP-02 완료 인계

### 변경 파일과 변경 목적

- `src/services/routeProxyClientAdapter.ts`: Edge 요청의 mode별 `maxNewProviderAttemptCount?: 0 | 1` 계약을 추가했다. 생략 caller는 기존 1회 허용을 유지하고, public remaining 0은 walk→필요 시 transit cache-only 조회를 수행하며 private remaining 0은 invoker 없이 종료한다. cache-only exact는 attempt 0과 `server_cache_hit`이 함께 맞을 때만 사용한다.
- `supabase/functions/route-proxy/handler.ts`: allowance 생략값 1과 `0 | 1` shape 검증, public cache 선조회, allowance 0의 provider 전 차단을 추가했다. provider fetch 시작 상태를 요청 로컬 계수로 보존해 complete/release/store 후처리 실패도 실제 attempt 1을 반환한다.
- `test/api-two-stop-route-budget.test.ts`: legacy 생략 호환, cache-only public hit/miss, private 0, walk miss→transit hit, 양쪽 miss, 손상 응답, allowance 손상값, provider 전/후 실패 및 directed/in-flight/connector 회귀 fixture를 failure-first로 고정했다.
- `test/activated-route-proxy-adapter.test.ts`, `test/route-proxy-client-adapter.test.ts`, `test/route-proxy-timeout-behavior.test.ts`: cache-only Edge 조회와 cache 선조회 순서에 맞춰 기존 외부 API 계약 fixture를 갱신했다.
- `docs/work/external-api/two-stop-route-budget.md`: 구현 결과와 검증·배포 위험을 이 완료 인계로 기록했다.

### 변경하지 않은 공개 계약·정책 경계

- Kakao 단일 provider, walk→조건부 transit 순서, public/private 좌표 경계, directed 15분 server cache, Auth·anonymous·abuse guard를 유지했다.
- cache-only miss는 새 enum 없이 기존 `limited` safe unavailable·attempt 0으로 닫았다. 자동 retry, provider/mode 자체 승격, 차량·근사 fallback을 추가하지 않았다.
- 36회 배분, B 후보 수량·순서, geometry connector 6회, one-stop fallback 정책을 바꾸지 않았다.
- RPC signature·DB schema·migration, `src/engine/`, `src/ui/`, `App.tsx`, data/catalog, 제품 기준 문서와 작업조정 보드는 수정하지 않았다.
- 실제 Kakao·Supabase 호출, Edge 배포, secret/env 변경, migration push와 cache 삭제는 수행하지 않았다.

### 실행한 테스트와 결과

- failure-first `npx tsx --test test/api-two-stop-route-budget.test.ts`: 구현 전 **11개 중 6 통과·5 실패**, 두 차단점이 정상 기대값에서 실패함을 확인했다.
- 구현 후 같은 명령: **11/11 통과**.
- API-TWO-STOP, route proxy client/activated/page-budget/production-port/timeout/deadline/geometry, private connector 및 Edge·migration 읽기 계약을 묶은 `npx tsx --test ...`: **88/88 통과**.
- `npm run test:typecheck`: 통과.
- `npm test`: **117/117 통과**.
- `npm run test:ui`: **216 통과·1 기존 skip·0 실패**.
- `git diff --check`: 통과.

### 다음 결정·위험

- client→handler의 두 활성화 차단점은 로컬 계약과 fixture에서 모두 해소됐다. public remaining 0은 cache hit을 재사용하고 miss에서는 provider/reserve/lease/fetch가 0회이며, provider 이후 complete/release 실패는 attempt 1을 보존한다.
- Edge는 아직 배포하지 않았다. 운영 handler가 이 변경을 받기 전에는 cache-only 요청에서 provider 0을 보장할 수 없으므로 pair-only 일반 사용자 진입을 활성화하지 않고 one-stop fallback을 유지해야 한다.
- 통합·결정 세션이 `2-Y`, `U-TWO-STOP-01`, QA 결과와 함께 Wave 2 자동 게이트를 확인한 뒤 단 한 번의 Edge 배포 시점을 결정해야 한다. fixture 성공을 실제 public store 운영 성공으로 해석하지 않는다.

## 2026-09-03 통합·결정 확인

- 공유 작업트리에서 `RouteProxyFunctionRequest.maxNewProviderAttemptCount?: 0 | 1`, client의 public cache-only 조회, handler의 allowance 검증·provider 전 차단·provider 시작 후 attempt 보존 구현을 확인했다.
- 통합 세션 재검증: API-TWO-STOP 및 client/activated/timeout 관련 테스트 **49/49**, `npm run test:typecheck`, `git diff --check` 통과.
- 코드·fixture 기준 `API-TWO-STOP-02`는 수락한다. 실제 원격 Edge 배포와 운영 cache hit은 아직 수행하지 않았으므로 원격 활성화 성공으로 해석하지 않는다.
- 원 담당 세션의 필수 네 항목 완료 인계 누락을 확인했고, 위 `API-TWO-STOP-02 완료 인계`에 변경 파일/유지 계약/전체 실행 수/원격 미배포 위험을 보충했다. 같은 구현을 다시 하지 않는다.
