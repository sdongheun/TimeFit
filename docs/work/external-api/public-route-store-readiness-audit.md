# API-PUBLIC-STORE-01 — 대표 구간 Route Proxy 저장소 준비 상태 감사

## 상태

구현 전·읽기 전용. `QA-MULTISTOP-RECEIPT-01`에서 A8의 서로 다른 두 입력이 모두 첫 다장소 receipt에서 `경로 저장소`로 중단된 뒤의 다음 단계다.

## 관찰 근거와 목적

두 A8 실행은 모두 다음을 보였다.

- 1곳: queue 18 / 시도 1 / 검증 1
- 2곳: queue 153 / 시도 1 / 검증 0 / `경로 저장소` 1
- 3곳: queue 816 / 시도 0

따라서 A8의 8회 provider attempt 상한이 소진된 것이 아니다. 2곳 첫 receipt가 store 경계에서 fail-closed로 중단됐다.

특히 출발/도착 같은 private 구간은 cache RPC를 거치지 않지만, 다장소 내부의 대표→대표 public segment는 `route_proxy_get_route`→lease/budget RPC를 사용한다. 이 감사는 remote Route Proxy가 해당 public store 경로를 실행할 준비가 됐는지 확인한다. Kakao 호출·추천 정책·상한을 바꾸지 않는다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. [다장소 원인 실기기 판정](../qa-release/multistop-receipt-reason-device-validation.md), [API-MULTISTOP-RECEIPT-02](multistop-receipt-reason-mapping.md)
3. `supabase/functions/route-proxy/handler.ts`, `supabase/functions/route-proxy/index.ts`
4. `supabase/migrations/202608270010_route_proxy_store.sql`, `202608270011_route_proxy_fetch_lease.sql`, `202608280013_route_proxy_mode_budget.sql`
5. `test/route-proxy-production-ports.test.ts`, `test/route-proxy-store-migration-contract.test.mjs`, `test/route-proxy-fetch-lease-migration-contract.test.mjs`, `test/route-proxy-mode-budget-migration-contract.test.mjs`

## 작업 명령 — 배포/호출 없이 한 번에 확인

1. local migration과 remote migration list를 비교해 위 세 migration이 remote에 모두 적용됐는지 확인한다. 적용 누락이면 migration 이름만 기록하고 DB 역할에 인계한다. 이 작업에서 `db push`/migration 적용은 하지 않는다.
2. remote `route-proxy` Function에서 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`의 **secret 이름 존재 여부만** 확인한다. 값·digest·본문을 읽거나 문서화하지 않는다.
3. remote DB의 service-role 기준으로 아래 public segment store RPC가 존재하고, 현 handler가 호출하는 인자 signature와 execute 권한이 맞는지 **schema/권한 메타데이터만** 확인한다.
   - `route_proxy_get_route`
   - `route_proxy_reserve_budget`
   - `route_proxy_claim_fetch_lease`
   - `route_proxy_complete_fetch_lease`
   - `route_proxy_release_fetch_lease`
   실제 route key, 실제 장소 ID·좌표, cache key, Kakao 호출은 사용하지 않는다.
4. 가능하면 QA 실행 시각의 Edge observation에서 `store_unavailable`의 안전 집계만 읽는다. 정확한 QA 실행과 연관 짓지 못하면 `관찰 불가`로 기록하고 추정하지 않는다.
5. 고정 local fixture로 다음 두 경로를 분리해 existing tests를 보강한다.
   - private 구간은 store cache lookup 없이 budget RPC로 진행할 수 있음
   - public segment의 `route_proxy_get_route` 또는 이후 store RPC 하나가 실패하면 provider 호출 없이 `store_unavailable` receipt로 끝남
   fixture는 route/provider 원문·실제 식별자 없이 RPC **이름**과 attempt 0만 확인한다.

## 판정과 후속 경계

| 감사 결과 | 다음 작업 |
| --- | --- |
| migration/RPC/권한 누락 | DB 역할이 migration 적용 또는 최소 권한 복구 계획을 제시한다. 적용은 사용자 승인 뒤에만 한다. |
| Edge secret 이름 누락 | 외부 API 역할이 필요한 secret 이름과 등록 위치만 인계한다. 값은 기록하지 않는다. |
| remote 준비 상태 정상 + logs가 특정 RPC 실패를 보임 | API·DB가 그 RPC 한 곳의 failure fixture와 최소 수정안을 만든다. |
| remote 준비 상태 정상 + 안전 로그도 없음 | `store`를 더 세분화하기 전에, 재현 가능한 non-sensitive stage 관찰 계약을 통합·결정에 제안한다. |

## 수정 경계와 완료 기준

- 수정 가능: 이 문서, local API fixture/contract test만.
- 수정 금지: Edge handler·배포·secret·Supabase migration/DB data·route/cache 한도·엔진·UI·데이터·`.env*`·보드.
- actual Kakao/route provider 요청, cache 삭제, 사용자 QA 재실행은 0회다.
- 실제 `SUPABASE_URL`, key, JWT/token, 좌표, 장소명/ID, URL/query, provider body, cache key는 어떤 출력에도 기록하지 않는다.

---

## 2026-09-02 감사 인계 — API-PUBLIC-STORE-01

### 변경 파일

- `test/route-proxy-timeout-behavior.test.ts`: 고정 local store fixture에 RPC 이름 하나의 실패를 주입할 수 있게 하고, private 구간의 cache lookup 미사용과 public `route_proxy_get_route` 실패의 provider 0회·typed `store_unavailable` receipt를 추가로 고정했다.
- `docs/work/external-api/public-route-store-readiness-audit.md`: remote 준비 상태·관찰 불가 범위와 다음 결정 경계를 기록했다.

### remote 준비 상태

- native Supabase CLI migration list에서 `202608270010_route_proxy_store`, `202608270011_route_proxy_fetch_lease`, `202608280013_route_proxy_mode_budget`는 local/remote 모두 적용됨을 확인했다.
- remote `route-proxy` Function이 존재하고, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`의 secret **이름**이 모두 존재한다. 값·digest·본문은 읽거나 기록하지 않았다.
- remote public schema의 `route_proxy_get_route`, `route_proxy_reserve_budget`, `route_proxy_claim_fetch_lease`, `route_proxy_complete_fetch_lease`, `route_proxy_release_fetch_lease`는 현 handler가 호출하는 provider/mode/public segment argument identity와 일치하며, 모두 `service_role` execute 권한이 있다. DB data·route key·장소/좌표는 조회하지 않았다.
- QA 실행 시각에 안전하게 연결 가능한 Edge 로그 창은 없다. CLI Function 명령에는 로그 조회가 없고 QA 기록에도 상관 가능한 request 식별자가 없으므로 `store_unavailable`의 특정 RPC 집계는 **관찰 불가**다.

### 유지한 계약

- public cache/lease/budget RPC 순서, private 구간의 cache/lease 미사용·budget RPC 사용, typed receipt와 provider 호출 상한은 변경하지 않았다. 추천 엔진 A8 8→16·adapter 24, UI·데이터·DB schema·Edge handler·secret·quota도 불변이다.
- migration 적용, DB 권한 변경, Edge 배포, cache 삭제, Kakao/route provider 호출, 사용자 QA 재실행은 0회다.

### 테스트 결과

- `npx tsx --test test/route-proxy-timeout-behavior.test.ts test/route-proxy-production-ports.test.ts test/route-proxy-store-migration-contract.test.mjs test/route-proxy-fetch-lease-migration-contract.test.mjs test/route-proxy-mode-budget-migration-contract.test.mjs` — 37 passed.
- `npm run test:typecheck` 통과, `npm run test:ui` 통과 (165 passed, 기존 skip 1), `npm test` 통과 (113 passed), `git diff --check` 통과.

### 판정과 다음 결정·위험

- migration·Function·secret 이름·RPC signature/권한의 국소 준비 결함은 발견되지 않았다. 따라서 이번 감사만으로 DB migration/권한/secret을 복구하거나 두 번째 복구 cycle을 시작하지 않는다.
- 두 A8 실행의 `store`는 여전히 public store 경계까지만 가리킨다. 특정 RPC failure를 추정하지 말고, 통합·결정이 비식별 stage 관찰 계약을 승인할지 또는 `DEC-RELEASE-MULTISTOP-01`의 1곳 출시 경계로 전환할지 결정해야 한다.
