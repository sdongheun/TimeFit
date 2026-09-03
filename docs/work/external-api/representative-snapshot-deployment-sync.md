# API-SNAPSHOT-SYNC-01 — 대표 카탈로그 Route Proxy 배포 동기화

## 목적

`DATA-SUPPLY-01`이 자동 대표를 190개에서 191개로 바꾼 뒤, 모바일의 공개 구간 scope와 Supabase `route-proxy` 서버 snapshot이 같은 버전인지 복구·검증한다. `QA-SUPPLY-01`의 첫 실행은 결과 화면 전에 일반 안전 오류로 끝났으며, 이 작업이 수락되기 전에는 공급량 QA를 다시 실행하지 않는다.

## 문제와 고정 원인 가설

모바일은 런타임 카탈로그에서 결정적으로 만든 `ROUTE_PROXY_CATALOG_SNAPSHOT_VERSION`을 `public_segment.catalogVersion`으로 보낸다. 서버는 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`의 version과 다르면 공개 좌표를 해석하지 않고 요청을 거절한다.

- 데이터 작업은 API secret을 변경하지 않는 경계였으므로, 기존 190-point snapshot이 서버에 남아 있을 가능성이 높다.
- 현재 handler는 이 불일치를 request shape 실패로 처리해 receipt 없는 400 `rejected`를 반환할 수 있다. Supabase SDK는 이 non-2xx를 transport처럼 보이게 할 수 있어, UI에는 구체 원인 없이 `안전 확인 또는 경로 연결…`만 남는다.
- 이는 **확정된 remote 원인이라고 단정하지 않는다.** 로컬 191-point snapshot과 서버 secret/배포 동기화 여부를 값 노출 없이 먼저 확인하고, 불일치라면 이번 배포로 복구한다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. 이 문서, `route-proxy-activation.md`, `src/services/routeProxyCatalogSnapshot.ts`
3. `test/route-proxy-catalog-snapshot.test.ts`, `test/route-proxy-production-ports.test.ts`, `test/route-proxy-edge-contract.test.mjs`

과거 archive는 이 문서가 지시한 경우에만 열며, CAPTCHA/익명 Auth 설정을 다시 바꾸지 않는다.

## 소유 범위

- `src/services/routeProxyCatalogSnapshot.ts`, `supabase/functions/route-proxy/`, `src/services/routeProxyProduction*`, API 계약 테스트, 이 작업 문서
- Supabase Edge secret **`ROUTE_PROXY_CATALOG_SNAPSHOT_JSON` 한 개**와 `route-proxy` Function의 제한 배포

수정하지 않는다: `src/data/`, `scripts/build_*`, `src/engine/`, `src/ui/`, DB migration/RPC, Cloudflare/Turnstile, Auth 설정, `.env*`, `docs/작업조정_보드.md`.

## 수행 순서

1. 로컬 snapshot을 재생성하지 않고 현재 런타임 카탈로그로 결정적으로 계산한다. 다음만 기록 가능하다: **snapshot version, point 수(191), secret 이름 존재 여부, deploy 성공 여부**. JSON 본문·좌표 목록·secret 값·JWT·API key는 stdout, 파일, 문서, Git에 남기지 않는다.
2. 기존 `route-proxy`가 server snapshot version이 다른 공개 scope를 받으면 어떻게 응답하는지 fixture로 먼저 고정한다.
   - 정상 형식의 `walk` public request인데 version/point 해석이 불일치하면 `{ status: 'rejected', mode: 'walk', receipt: { result: 'unavailable', unavailableReason: 'rejected', newProviderAttemptCount: 0, reuse: 'session_hit' } }` 또는 동등한 **typed receipt**를 반환해야 한다.
   - 형식 자체가 망가진 요청은 계속 400 `rejected`여도 된다. 이 작업은 공개 오류 상세·좌표·provider 원문을 노출하지 않는다.
   - production receipt 복원과 activated adapter가 위 typed non-2xx를 `route_proxy_rejected`로 전달하고, `route_proxy_transport_failed`로 평탄화하지 않는 테스트를 추가한다.
3. 현재 191-point snapshot을 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`에 안전하게 주입하고 `route-proxy`만 배포한다.
   - secret을 셸 출력·작업 기록·임시 파일에 쓰지 않는 script/CLI 경로를 사용한다.
   - 다른 secret을 읽거나 수정하지 않는다. 카카오 provider 직접 호출, cache 삭제, budget 변경, CAPTCHA/anonymous Auth 변경은 0회다.
4. 배포 뒤에는 secret 이름 존재와 Function deploy 성공만 확인한다. 서버 snapshot이 현재 모바일 snapshot과 같은 version/191 points라는 것은 **주입한 로컬 산출물의 version·count**로만 기록한다. remote secret 원문을 읽어 비교하지 않는다.

## 필수 테스트

- stale public snapshot → typed `rejected` receipt → production restore → `route_proxy_rejected`
- matching snapshot의 기존 public/private scope, cache/lease/budget, receipt 계약 회귀
- `npx tsx --test test/route-proxy-catalog-snapshot.test.ts test/route-proxy-production-ports.test.ts test/activated-route-proxy-adapter.test.ts`
- 관련 Edge contract test, `npm run test:typecheck`, `npm test`, `git diff --check`

## 완료·다음 단계

완료는 (a) 모바일/서버 snapshot 동기화 배포, (b) stale-version typed failure 회귀, (c) secret 없는 deployment 기록까지다. server snapshot 동기화 자체는 현재 설치된 191-point internal build에도 즉시 적용되므로 `SUP-01`을 새로 1회 실행할 수 있다. 다만 stale receipt를 `route_proxy_rejected`로 구분하는 mobile adapter 코드도 바뀌므로, 다음 internal build에는 이 변경을 반드시 포함한다. 현재 build에서 다시 일반 오류가 나면 absence of enum을 원인 근거로 쓰지 말고 재시도하지 않는다.

`SUP-02~04`는 SUP-01이 결과 화면에 도달한 뒤에만 재개한다. 이 작업은 코스 수·공간 선별·8→16회 예산을 바꾸지 않으며, DATA-SUPPLY 효과를 판정하지 않는다.

---

## 2026-09-01 완료 인계 — API-SNAPSHOT-SYNC-01

### 변경 파일

- `supabase/functions/route-proxy/handler.ts`: 형식이 유효하지만 server snapshot으로 해석할 수 없는 `public_segment`를 receipt 없는 request-shape 오류와 분리했다. provider·Auth·store 호출 전에 400 typed `rejected` receipt로 종료한다.
- `src/services/routeProxyActivatedCourseAdapter.ts`: 복원된 typed `rejected` non-2xx를 generic transport로 평탄화하지 않고 안전 enum `route_proxy_rejected`로 전달한다.
- `test/route-proxy-production-ports.test.ts`, `test/route-proxy-catalog-snapshot.test.ts`: stale snapshot → typed receipt → production 복원 → activated adapter 안전 enum과 현행 191-point 결정적 snapshot을 고정했다.
- Supabase Edge secret `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON` 한 개에 현행 local snapshot을 주입하고 `route-proxy` Function만 배포했다. 주입 산출물은 `representative-a4a72930`, point 수는 191이다. JSON 본문과 secret 값은 기록하지 않았다.

### 유지한 계약

- public scope는 server snapshot만으로 좌표를 해석하고 private request만 좌표 body를 사용한다. stale public scope는 좌표·provider 원문·비밀을 노출하지 않으며 provider/auth/store/cache/lease/budget 작업을 시작하지 않는다.
- Kakao 직접 호출, cache 삭제, budget·CAPTCHA·anonymous Auth·DB·UI·엔진·카탈로그 및 다른 Edge secret 변경은 0회다. 기존 cache/lease/budget/receipt 계약과 `route_proxy_transport_failed`의 실제 transport 전용 의미를 유지했다.

### 테스트 결과

- local snapshot 결정 계산: version `representative-a4a72930`, 191 points. remote에서는 secret 이름 존재와 `route-proxy` deploy 존재만 확인했다.
- `npx tsx --test test/route-proxy-production-ports.test.ts test/route-proxy-catalog-snapshot.test.ts test/activated-route-proxy-adapter.test.ts test/route-proxy-edge-contract.test.mjs` — 20 passed.
- `npm run test:typecheck` 통과, `npm run test:ui` 통과 (140 passed, 1 skipped), `npm test` 통과 (113 passed), `git diff --check` 통과.

### 다음 결정·위험

- `QA-SUPPLY-01`은 현재 설치된 191-point internal build에서 `SUP-01`만 정확히 한 번 재개할 수 있다. 서버 snapshot 동기화에는 재빌드가 필요 없지만, 다음 internal build에는 이번 mobile adapter 진단 보완을 포함해야 한다.
- SUP-01이 다시 일반 안전 오류로 끝나면 재시도하지 않는다. 현재 build는 새 `route_proxy_rejected` mapping 전일 수 있으므로, 다음 internal diagnostics build에서 비밀 없는 enum 하나만 남겨 원인을 분리한다. SUP-02~04는 SUP-01이 결과 화면에 도달하기 전에는 진행하지 않는다.
