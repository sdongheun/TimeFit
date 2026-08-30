# DB·개인화 작업기록

## 2026-08-26 — 통합·결정 지시 DB-1: V1 검증 코스 저장 계약

**선행 조건:** API-4-A·2-J·QA-04 수락 뒤 시작한다. 검증된 코스만 저장하며, 장소 순서·실제 legs·권장 체류·도착 여유·남는 시간·엔진/카탈로그 버전 스냅샷과 RLS를 설계한다. 사용자 ID와 정밀 GPS를 공용 Route Cache·호출량 집계에 결합하지 않는다. migration·repository·RLS fixture만 수정하고 화면·엔진 순위·원본 데이터를 수정하지 않는다.

## 2026-08-27 — 통합·결정 지시 DB-RP-1: Route Proxy 공용 cache·원자 예산 store

**선행 조건:** API-4-A의 `RouteProxyStore`·`RouteProxyRequest` 공개 타입을 소비한다. 이 작업은 코스 저장(DB-1)과 독립이며, 그 스키마를 섞지 않는다.

### 목표와 금지 범위

Supabase에서 공개 POI↔POI의 성공한 경로만 짧게 재사용하고, 제공사 호출 예산을 원자적으로 예약한다. **사용자 ID, 로그인 정보, IP, 원본 GPS 좌표, 검색어, provider 원문 응답, API key는 어떤 테이블·뷰·RPC 인자·로그에도 저장하지 않는다.** 개인 GPS 출발/도착 요청은 DB cache를 전혀 거치지 않는다.

### 구현 지시

1. `supabase/migrations/`에 Route Proxy 전용 테이블을 만든다.
   - cache key 구성요소는 `provider`, `mode`, `from_poi_id`, `to_poi_id`, `catalog_version`뿐이다. A→B와 B→A는 별도 행이다.
   - 값은 성공 상태의 최소 route 결과(`total_min`, 필요한 공개 step 요약, `expires_at`, 생성/갱신 시각)만 둔다. 좌표·사용자 식별자·원문 body는 열로 만들지 않는다.
   - provider/date bucket의 일일 사용량과 provider/date/second bucket의 초당 사용량은 별도 budget 테이블로 관리한다. route 결과 테이블과 user/profile 테이블 사이 foreign key를 만들지 않는다.
2. service role 전용 RPC 또는 transaction으로 다음 store 포트를 구현한다: `getRoute`, 성공 결과만의 `putRoute`, `readBudget`, **원자적** `reserveBudget`.
   - `reserveBudget`은 한 SQL 문/트랜잭션에서 hard limit과 per-second limit을 검사·증가한다. 단순 read 후 update는 금지한다.
   - TTL 만료 cache는 get 시 무효로 취급하고, 안전한 정리 함수/스케줄 후보를 남긴다. cache hit는 예산을 증가시키지 않는다.
3. RLS를 켠다. anon/authenticated는 cache·budget 테이블과 RPC를 직접 읽거나 쓰지 못한다. Edge Function의 service role만 RPC를 호출한다. API key/secret은 migration, SQL fixture, 오류 메시지에 넣지 않는다.
4. `RouteProxyStore`의 production repository는 API 세션이 구현한다. DB 세션은 Supabase RPC request/response의 최소 타입·오류(`limited`, `store_unavailable`)와 테스트 fixture를 문서에 인계하되 `src/services/`를 수정하지 않는다.
5. 고정 DB 테스트 또는 SQL fixture로 다음을 검증한다: 같은 공개 구간 hit, 방향/version/TTL miss, 실패 route write 거절, private GPS 인자의 schema 부재, hard/second limit 동시 예약, cache hit 예산 0증가, anon/authenticated 거절, service-role RPC 허용. 운영 DB·실사용 데이터·실제 provider 호출은 사용하지 않는다.

### 완료 기록과 경계

- 변경 파일, 열/인덱스/RPC 이름, RLS 결과, TTL 정리 방식, 테스트 명령·결과를 이 문서에 남긴다.
- UI, 추천 순위, 카탈로그 원본, Edge Function, `src/services/`, DB-1 저장 스키마는 수정하지 않는다.
- `npm run test:typecheck`, 관련 DB/RLS 테스트, `npm test`, `git diff --check`를 실행한다.

**완료 기준:** public segment만 cache되고 private GPS가 스키마·RPC·진단 어디에도 들어가지 않으며, 동시 `reserveBudget`이 한도를 넘기지 않고 RLS가 직접 접근을 막아야 한다. API-4-A-R이 소비할 RPC 계약이 파일 경로와 함께 인계돼야 한다.

## 2026-08-27 — 통합·결정 지시 DB-PRIV-01: 익명 Auth 최소 보관·30일 정리

**부모 결정 `SEC-RP-01-R`:** 로그인 없는 추천을 위해 자동 생성하는 Supabase 익명 Auth 계정도 개인정보로 취급한다. 추천 접근 제어 이외의 목적에는 쓰지 않으며, 마지막 사용 뒤 30일이 지난 익명 계정은 삭제한다. 이 작업은 기존 “비로그인 체험의 개인 행동 데이터는 서버에 저장하지 않는다” 원칙의 예외를 최소화하고 명시하는 작업이다.

### 허용·금지 경계

1. 허용 서버 보관물은 Supabase Auth의 익명 계정과 접근 제어에 필요한 세션뿐이다. 익명 계정에는 `profiles`, 저장 코스, 후기, 개인화 이벤트, 추천 이력, GPS/출발·도착 좌표, 검색어, route cache/lease/budget의 user 연결을 만들지 않는다.
2. 마지막 사용 기준은 Auth에서 안전하게 확인 가능한 인증·세션 갱신 시각으로 정의한다. 앱의 추천 요청·GPS·검색어를 별도 활동 로그로 만들어 이 시각을 갱신하거나 보관하지 않는다.
3. 30일 경과 후보라도 **현재도 anonymous인 계정만** 대상이다. 이메일/소셜 등 영구 identity를 연결한 계정, 일반 로그인 계정, 30일 이내 세션은 삭제하지 않는다. 후보에 연결된 사용자 소유 행이 발견되면 자동 삭제하지 않고 실패로 기록·조사 대상으로 남긴다.
4. 삭제는 서비스 역할 전용의 정리 경로에서 Auth Admin 삭제를 한 번만 수행한다. 클라이언트·anon/authenticated 역할은 후보 조회·삭제 RPC에 접근할 수 없다. 삭제 대상 ID·개별 시각·IP·좌표·검색어·코스 내용은 일반 로그·진단·테스트 fixture에 남기지 않는다.
5. 실행은 일 1회 이하의 서버 스케줄로 제한하며, 정리 작업의 운영 감사는 날짜별 후보/삭제/건너뜀/실패 **개수**와 코드화한 실패 사유만 짧게 보관한다. 배포 전 개인정보 처리방침에는 익명 접근 세션의 목적, 30일 보유 기간, 자동 파기, 로그인 전환 시 제외를 명시한다.

### 구현·검증 지시

1. `docs/04_backend/데이터베이스설계.md`의 비로그인 체험·수집 최소화 문구를 위 정책과 정합화한다. 이전 “서버에 저장하지 않는다”와 이번 Auth 예외, 문제, 교체 이유, 상태를 함께 남긴다.
2. migration/RLS와 격리 fixture로 후보 선별과 삭제 권한을 검증한다. Auth 삭제가 DB migration만으로 안전히 완료되지 않으면, DB는 service-role 전용 후보 계약과 권한만 제공하고 실제 Admin 삭제 scheduler의 공개 계약·소유자를 API-4-A-R2에 인계한다. DB trigger로 user 활동·위치·추천 데이터를 수집하는 방식은 금지한다.
3. 고정 fixture에 (a) 30일 미만 익명 유지, (b) 30일 이상 익명 삭제 후보, (c) 영구 identity 연결 뒤 제외, (d) 연결 데이터 발견 시 보류, (e) anon/authenticated 직접 접근 거절, (f) ID·좌표·원문 로그 부재를 포함한다. 운영 Auth 사용자·실제 위치·실제 provider 호출은 사용하지 않는다.

**소유 경계:** `supabase/migrations/`, DB/RLS fixture, `docs/04_backend/데이터베이스설계.md`, 이 문서만 수정한다. 모바일 익명 로그인, Edge Function scheduler 구현, route adapter, UI, 엔진·카탈로그는 수정하지 않는다.

**완료 기준:** 익명 Auth 이외의 비로그인 개인 데이터가 서버 스키마에 없고, 삭제 후보는 30일 미사용·익명 상태·연결 데이터 부재를 모두 통과해야 하며, 일반 로그인/전환 계정의 삭제 경로가 없음을 RLS·격리 fixture로 재현해야 한다. API-4-A-R2가 소비할 후보/실행/실패 계약과 개인정보 처리방침 반영 항목을 인계해야 한다.

### 2026-08-27 — DB-PRIV-01 완료: 익명 Auth 최소 보관·30일 정리 계약

- **이전 방식:** 비로그인 체험은 서버 비저장으로만 정의돼 있었고, 자동 익명 Auth를 도입할 때 계정의 30일 보관·삭제 기준과 기존 `handle_new_user` profile trigger의 익명 처리 경계가 없었다.
- **문제/관찰:** 익명 JWT를 authorization에 쓰더라도 기존 trigger가 profile을 만들면 비로그인 개인화 데이터가 생긴다. 반대로 DB가 Auth Admin 삭제를 직접 수행하면 재검증·실패 감사·scheduler 소유 경계가 불명확해진다.
- **교체 방식:** `supabase/migrations/202608270012_anonymous_auth_cleanup_contract.sql`에서 익명 Auth user의 profile 생성을 건너뛰고, service-role 전용 cleanup run·candidate/recheck·집계 audit·complete RPC를 제공한다.
  - `claim_anonymous_auth_cleanup_run(current_date)`는 날짜별 1회만 `claimed` token을 반환한다. 중복 실행은 `already_claimed`로 끝나며, scheduler가 중복 Auth Admin 삭제를 시작할 수 없다.
  - `list_anonymous_auth_cleanup_candidates(run_date, run_token, inactive_before, limit)`와 `recheck_anonymous_auth_cleanup_candidate(...)`는 Auth의 `last_sign_in_at`(없으면 `created_at`)이 30일 이상 경과하고 현재도 `is_anonymous = true`이며 `profiles`·`courses`·`course_feedback`·`recommendation_events` 연결 행이 없는 user만 허용한다. 재검증은 Admin delete 직전에 다시 수행한다.
  - `record_anonymous_auth_cleanup_audit(...)`는 날짜/결과/코드화 사유/개수만 upsert한다. 대상 ID·개별 시각·IP·좌표·검색어·코스/추천 원문을 audit에 저장하지 않는다. `complete_anonymous_auth_cleanup_run(...)`으로 실행을 닫는다.
  - **실제 Auth 삭제는 이 migration에 없다.** API-4-A-R2 소유의 service-role Edge Function scheduler가 후보별 recheck 성공 후 Supabase Auth Admin API를 한 번 호출하고, 성공/건너뜀/실패 집계를 기록해야 한다. 일반 client·anon/authenticated와 일반 Route Proxy 요청은 후보 조회·삭제 RPC에 접근할 수 없다.
- **교체 이유:** anonymous JWT를 로그인 강제 없는 접근 제어로만 사용하면서, 계정 보관을 30일로 제한하고 영구 identity/연결 데이터가 있는 계정을 오삭제하지 않기 위함이다.
- **검증:** `test/anonymous-auth-cleanup-migration-contract.test.mjs` 고정 계약 4건 및 격리 `/private/tmp` PostgreSQL을 실행했다. 31일 익명 무연결 후보만 선택되고 29일 세션·profile/event 연결·영구 identity는 제외됐으며, identity 전환 뒤 pre-delete recheck가 false, 익명 profile 생성 0, 날짜별 중복 run 거절, anon table read/authenticated candidate RPC 거절을 확인했다.
- **문서:** `docs/04_backend/데이터베이스설계.md`에 Auth-only 예외, 30일 정리 세 조건, scheduler/집계 감사 및 개인정보 처리방침 반영 항목을 현행 정책과 변경 이력으로 반영했다.
- **상태:** 현행·API-4-A-R2 선행 조건 충족. 모바일 anonymous session 생성, Edge scheduler/Admin delete, Route Proxy 인증/lease 소비, 실제 배포·provider 호출은 수정·실행하지 않았다.

## 2026-08-27 — 통합·결정 지시 DB-RP-2: public fetch lease

**부모 결정:** `SEC-RP-01` — 추천은 로그인 강제가 아니라 앱 시작 시 자동 생성하는 익명 Supabase 세션의 JWT로 보호한다. 익명 user ID는 authorization에만 쓰고 Route cache·budget·진단에는 저장하지 않는다.

**문제:** DB-RP-1의 cache와 예산 reservation은 원자적이지만, 서로 다른 Edge Function instance가 같은 public segment cache miss를 동시에 처리할 때 provider 호출 하나를 공유할 lease가 없다.

1. `supabase/migrations/`에 public segment key(`provider`, `mode`, `from_poi_id`, `to_poi_id`, `catalog_version`)만 가진 짧은 lease store 또는 동등한 RPC를 추가한다. user ID·IP·좌표·원문·key는 열/인자/진단에 넣지 않는다.
2. service-role 전용 원자 RPC를 제공한다.
   - `claim`: cache miss 뒤 최초 요청 하나만 lease owner가 된다.
   - `read/wait`: 이미 진행 중이면 provider를 호출하지 않고 bounded 재확인 또는 typed `in_flight`를 받는다.
   - `complete`: 성공 cache write와 lease 해제를 안전하게 수행한다.
   - `fail/release`: provider 실패·timeout 때 lease를 해제해 다음 요청이 영구 대기하지 않게 한다.
   - lease TTL 만료 뒤에는 다음 요청이 다시 claim할 수 있다.
3. lease key는 provider까지 포함한다. 도보 provider 선택 전의 코스 전체나 private GPS 요청에는 lease를 만들지 않는다. Edge Function이 선택한 public provider의 segment만 claim한다.
4. RLS/RPC 권한은 DB-RP-1과 같이 service_role 전용이다. anon/authenticated가 직접 claim·조회·해제할 수 없다.
5. 고정 DB/SQL fixture로 동시 claim 하나만 승인, wait 중 provider 0회, success/failure release, TTL 탈취, 방향·mode·version 분리, private/user/GPS schema 부재, anon/authenticated 거절을 검증한다.

**소유 경계:** migration·RLS·DB fixture·이 문서만 수정한다. Edge Function, 모바일 익명 로그인, `src/services/`, 엔진·UI·카탈로그는 수정하지 않는다.

**완료 기준:** 다중 Edge instance를 가정한 같은 public key의 claim이 하나만 성공하고 실패/TTL 뒤 복구되며, API-4-A-R2가 소비할 RPC 타입·오류·대기 상한이 인계돼야 한다.

### 2026-08-27 — DB-RP-1 완료: Route Proxy 공용 cache·원자 예산 store

- **이전 방식:** API-4-A에는 fixture 전용 메모리 `RouteProxyStore`만 있었고, 공개 구간의 영속 cache·동시 호출 예산·서버 전용 DB 경계가 없었다.
- **관찰/문제:** read-then-update 예산은 동시 Edge Function 호출에서 hard/per-second limit을 넘길 수 있고, route 원문이나 개인 좌표를 그대로 저장하면 개인정보·제공사 응답 보관 범위를 침범한다.
- **교체 방식:** `supabase/migrations/202608270010_route_proxy_store.sql`에 아래 server-only 계약을 추가했다.
  - `route_proxy_cache`: `(provider, mode, from_poi_id, to_poi_id, catalog_version)` 방향성 복합키와 `total_min`, 정규화한 공개 step 요약, TTL 시각만 저장한다. 성공 결과를 받는 `route_proxy_put_route`는 허용 키만 재조립하고, 잘못된 결과는 `invalid_route_result`로 거절한다.
  - `route_proxy_daily_budget`, `route_proxy_second_budget`: provider·일자 및 provider·일자·epoch-second별 사용량만 저장한다. `route_proxy_reserve_budget`은 provider/day advisory transaction lock 아래에서 두 한도를 검사·증가하고 `{ granted, used, reason }`을 반환한다. 거절 사유는 `daily_limit` 또는 `rate_limit`이며 cache hit는 이 RPC를 호출하지 않는 API-4-A 계약을 유지한다.
  - RPC: `route_proxy_get_route(provider, mode, from_poi_id, to_poi_id, catalog_version, now)`, `route_proxy_put_route(...)`, `route_proxy_read_budget(provider, date_bucket)`, `route_proxy_reserve_budget(provider, date_bucket, second_bucket, hard_limit, per_second_limit)`, `route_proxy_purge_expired_routes(before)`. 만료 행은 get에서 먼저 miss이며 purge는 서비스 역할 스케줄 작업 후보로만 남겼다.
  - 세 테이블은 RLS를 활성화하고 anon/authenticated의 table·RPC 권한을 모두 회수했다. 해당 RPC와 table 권한은 `service_role`에만 부여했다. user/login/IP/GPS 좌표/검색어/provider 원문/API key 컬럼·RPC 인자·오류 문구는 추가하지 않았다.
- **교체 이유:** 공용 POI 구간만 재사용하면서 private GPS 요청을 영속 경로에서 분리하고, DB의 원자 연산으로 실제 제공사 호출 상한을 보장하기 위함이다.
- **검증:** `test/route-proxy-store-migration-contract.test.mjs`의 고정 계약 4건, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 통과했다. 격리 `/private/tmp` PostgreSQL에서 migration을 실제 적용해 step 정규화, daily 동시 5회 중 3회 승인·2회 `daily_limit`, per-second 동시 3회 중 2회 승인·1회 `rate_limit`, anon table read 및 authenticated RPC 호출 거절을 확인했다. 설치된 Supabase CLI의 `db lint --local`은 저장소 `config.toml`의 최신 키를 해석하지 못해 SQL 실행 전 중단됐으므로, lint 성공으로 기록하지 않는다.
- **상태:** 현행·API-4-A-R 인계 가능. `src/services/`, Edge Function, provider secret·quota/상업/응답 보관 승인, DB-1 코스 저장 스키마는 수정하지 않았다.

### 2026-08-27 — DB-RP-2 완료: public fetch lease

- **이전 방식:** DB-RP-1은 cache와 예산만 원자화했다. 서로 다른 Edge instance가 같은 공개 segment를 동시에 miss하면 각 instance가 provider 호출과 예산 예약을 시작할 수 있었다.
- **문제/관찰:** process-memory in-flight 공유는 instance 경계를 넘지 못한다. 단, user/JWT/GPS를 lease owner·key로 쓰면 중복 호출 방지와 무관한 개인정보를 영속화하게 된다.
- **교체 방식:** `supabase/migrations/202608270011_route_proxy_fetch_lease.sql`에 provider를 포함한 공개 segment 복합키의 `route_proxy_fetch_lease`와 service-role 전용 RPC를 추가했다. `lease_id`는 DB가 생성하는 짧은 capability UUID이며 user/session/device 식별자와 연결되지 않는다.
  - `route_proxy_claim_fetch_lease(provider, mode, from_poi_id, to_poi_id, catalog_version, lease_ttl_ms)`는 `1000~30000ms` TTL에서 최초/만료 lease만 `claimed`로 반환한다. 이미 보유된 lease는 owner token을 숨긴 `in_flight`와 최대 **2000ms** `retry_after_ms`만 반환하며 provider 호출을 허용하지 않는다. 이 값이 API-4-A-R2의 bounded wait 상한이다.
  - `route_proxy_read_fetch_lease(...)`는 cache 재조회 뒤 `in_flight` 또는 `idle`만 반환한다. waiter는 한 번의 bounded wait 뒤 cache 재조회하고, 결과가 없으면 typed `in_flight`으로 종료해야 하며 budget/provider를 추가 호출하면 안 된다.
  - `route_proxy_complete_fetch_lease(..., lease_id, total_min, steps, cache_expires_at)`는 유효 owner만 DB-RP-1의 route cache write와 lease 해제를 같은 transaction에서 수행하고 `completed`/`lost`를 반환한다. `route_proxy_release_fetch_lease(..., lease_id)`는 실패·timeout에서 `released`/`lost`를 반환한다. TTL 만료 행은 다음 claim이 탈취할 수 있고 purge는 service-role 스케줄 후보일 뿐이다.
  - 테이블/RPC는 RLS와 권한 회수로 anon/authenticated 직접 호출을 막고 service_role만 허용한다. user ID, IP, 좌표, 검색어, provider 원문/API key는 열·인자·진단에 넣지 않았다.
- **교체 이유:** public provider segment 하나에 instance 간 provider 호출 하나만 허용하면서 private GPS 및 authorization identity를 cache·lease·budget 저장 경로와 분리하기 위함이다.
- **검증:** `test/route-proxy-fetch-lease-migration-contract.test.mjs` 고정 계약 4건과 격리 `/private/tmp` PostgreSQL 실제 migration chain(010→011)을 실행했다. 동일 key 동시 claim 5개는 `claimed` 1 / `in_flight` 4, 완료 뒤 cache 행 1·lease 해제, 실패 release 뒤 재claim, 1초 TTL 만료 뒤 새 token claim, anon table read/authenticated RPC 거절을 확인했다.
- **상태:** 현행·API-4-A-R2 인계 가능. Edge Function·모바일 anonymous JWT·`src/services/`·UI/엔진/카탈로그는 수정하지 않았다. Route provider 실제 호출·배포·서비스 계정 승인도 수행하지 않았다.

---

## 2026-08-28 — 통합·결정 지시 DB-RP-3: Kakao 도보·대중교통별 원자 예산 계약

### 발생한 충돌과 목표

Kakao-only Route Proxy는 도보와 대중교통을 모두 Kakao로 호출한다. 제품 정책은 두 API의 일일/초당 예산과 soft limit을 **수단별로 독립 관리**한다. 그러나 현 DB-RP-1의 `route_proxy_daily_budget`, `route_proxy_second_budget`, `read_budget`, `reserve_budget` 키는 `provider`와 시각 bucket만 사용해 `kakao walk`와 `kakao transit`을 하나의 사용량으로 합친다. 이는 보수적으로 호출을 줄일 수는 있어도, 수단별 quota·soft limit 정책과 API-4-A-ACT-02-K의 완료 조건을 충족하지 못한다.

목표는 공개 segment cache·lease와 개인정보 경계를 바꾸지 않고, Kakao의 `walk`/`transit` 예산만 mode별로 원자 분리하는 것이다.

### 담당·수정 경계

DB·개인화 세션은 `supabase/migrations/`, DB contract/격리 fixture, `docs/04_backend/데이터베이스설계.md`의 Route Proxy 예산 설명, 이 작업기록만 수정한다. Edge handler·client adapter·추천 엔진·UI·카탈로그·실 환경 migration 적용은 수정하거나 실행하지 않는다.

### 구현 지시

1. 기존 010 migration은 이미 협업 이력으로 보존하고, 그 뒤에 실행되는 **새 additive migration**을 만든다. `route_proxy_daily_budget`와 `route_proxy_second_budget`의 논리 키를 각각 `(provider, mode, date_bucket)`, `(provider, mode, date_bucket, second_bucket)`로 바꾼다. `mode`는 `walk|transit`만 허용한다.
2. 이미 사용량 행이 존재하는 환경도 안전해야 한다. 이전 provider 단일 사용량은 어느 수단에 속했는지 알 수 없으므로, 변환 중 삭제·0 초기화·한 수단으로 임의 귀속하지 않는다. 두 mode에 같은 기존 used를 보수적으로 반영하거나, 동등하게 두 quota를 초과시키지 않는 명시적 이관 규칙을 migration 주석과 fixture로 보인다. 현재 remote가 미적용인 사실을 이 규칙의 생략 근거로 쓰지 않는다.
3. service-role 전용 RPC를 아래 mode 포함 계약으로 교체한다. 이전 시그니처는 권한을 회수하거나 제거해 handler가 provider-only 사용량으로 되돌아가지 않게 한다.
   - `readBudget(provider, mode, dateBucket)`
   - `reserveBudget(provider, mode, dateBucket, secondBucket, softLimit, hardLimit, perSecondLimit)`
4. `reserveBudget`은 provider·mode·date의 advisory lock 안에서 daily soft/hard 및 mode별 per-second limit을 검사·증가한다. soft limit은 hard limit보다 작거나 같아야 하며, soft 도달 시 `soft_limit`, hard 도달 시 `daily_limit`, 초당 한도 시 `rate_limit`의 typed reason을 반환한다. cache hit는 이 RPC를 호출하지 않는다.
5. RLS는 그대로 service_role만 RPC/table 접근이 가능해야 한다. mode 분리를 위해 user ID, anonymous JWT, GPS, 좌표, 검색어, provider 원문, key를 어떤 열·RPC 인자·로그에도 추가하지 않는다.
6. 고정 DB/격리 PostgreSQL fixture로 최소 아래를 검증한다.
   - 같은 Kakao라도 walk 한도를 소진해도 transit reserve는 독립적으로 가능하고, 반대도 성립한다.
   - 같은 mode의 동시 reserve는 soft/hard/per-second를 초과하지 않는다.
   - 기존 provider-only used 행의 이관은 두 mode의 quota를 과대 허용하지 않는다.
   - cache key/lease는 기존처럼 provider+mode+방향+version으로 분리되고, private GPS schema 부재와 anon/authenticated 직접 거절이 유지된다.
7. 관련 DB contract/격리 fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 실제 Supabase migration, provider 호출, Edge deployment는 0회여야 한다.

### 완료 기준

Kakao 도보·대중교통 사용량이 DB와 RPC에서 원자적으로 분리되고, soft/hard/rate가 mode별로 관찰 가능하며, 이전 단일 사용량 이관이 안전하고 재현 가능해야 한다. 완료 기록에는 migration/RPC 시그니처, RLS·이관 규칙, fixture 결과, API 세션에 넘길 정확한 request/response 계약을 남긴다.

### 2026-08-28 — DB-RP-3 완료: Kakao 도보·대중교통별 원자 예산 계약

- **이전 방식:** `route_proxy_daily_budget`/`route_proxy_second_budget`와 budget RPC가 provider-only key를 사용해 Kakao walk와 transit의 사용량·soft limit·quota를 합쳤다.
- **문제/관찰:** provider 하나로 축소해도 API 수단별 quota는 합쳐지지 않는다. provider-only used를 한 mode로 귀속하거나 0으로 초기화하면 반대 수단의 과거 호출을 과대 허용하게 된다.
- **교체 방식:** `supabase/migrations/202608280013_route_proxy_mode_budget.sql`에서 budget 논리 키를 `(provider, mode, date_bucket)` 및 `(provider, mode, date_bucket, second_bucket)`으로 바꾸고 `mode in ('walk', 'transit')`을 강제했다.
  - 기존 provider-only 행은 먼저 `walk`로 표시한 뒤 같은 `used`를 `transit` 행에 복제한다. 이는 과거 수단을 알 수 없는 경우 양쪽 quota를 보수적으로 소진된 것으로 처리하는 안전한 이관이며, 삭제·0 초기화·임의 귀속이 아니다.
  - 기존 `route_proxy_read_budget(text, date)`와 `route_proxy_reserve_budget(text, date, bigint, integer, integer)`는 권한을 회수한 뒤 제거했다. 새 service-role RPC는 `route_proxy_read_budget(provider, mode, date_bucket)`과 `route_proxy_reserve_budget(provider, mode, date_bucket, second_bucket, soft_limit, hard_limit, per_second_limit)`이다.
  - reserve는 provider/mode/day advisory lock에서 hard → soft → same-mode per-second를 검사한다. `{ granted, used, reason }`에서 거절 reason은 `daily_limit`, `soft_limit`, `rate_limit`이며 cache hit는 API handler가 reserve를 호출하지 않는 기존 경계를 유지한다.
- **교체 이유:** Kakao 단일 provider에서도 walk/transit의 실제 예산을 독립적으로 적용하고, 이관 환경에서 실제보다 많은 호출을 허용하지 않기 위함이다.
- **검증:** `test/route-proxy-mode-budget-migration-contract.test.mjs` 고정 계약 4건과 격리 `/private/tmp` PostgreSQL 실제 migration chain(010→011→013)을 실행했다. legacy `used=2`가 walk/transit 양쪽 `2`로 이관됐고, walk soft 도달 뒤 transit은 독립 reserve에 성공했다. 같은 mode 동시 reserve는 soft 2/3 승인·rate 2/3 승인으로 제한됐으며 hard=`soft=2`에서 `daily_limit`, anon table read/authenticated RPC는 거절됐다.
- **상태:** 현행·API-4-A-ACT-02-K-R 인계 가능. Edge handler/client adapter·엔진·UI·카탈로그·remote migration·provider 호출·Edge 배포는 수정/실행하지 않았다.

### 2026-08-28 — 통합·결정 검토: DB-RP-3 수락

새 migration은 기존 provider-only budget 행을 삭제·0 초기화하지 않고 양 mode에 보수적으로 이관하며, provider·mode·date advisory lock과 mode 포함 RPC로 Kakao `walk`/`transit`의 atomic soft/hard/rate 경계를 분리했다. 공개 cache/lease key와 private GPS·identity 비저장, service-role 전용 RLS도 유지한다. DB contract와 격리 PostgreSQL 결과, 관련 고정 회귀를 확인해 DB-RP-3를 수락한다.

이는 DB 계약 수락이지 대상 Supabase 적용이 아니다. 다음 작업은 외부 API의 `API-4-A-ACT-02-K-R`이며, 새 RPC를 handler가 mode별 환경 설정으로 소비하는 fixture를 수락하기 전에는 Edge 배포·기본 adapter 전환·ODsay 제거를 진행하지 않는다.

---

## 2026-08-28 — 통합·결정 지시 DB-RP-4: Route Proxy migration의 대상 Supabase 안전 적용

### 목표·권한·범위

Route Proxy의 local migration `202608270010`, `202608270011`, `202608270012`, `202608280013`을 **사용자가 승인한 대상 Supabase 프로젝트**에 순서대로 적용하고, migration history와 service-role 전용 DB 경계가 실제 대상에 존재함을 비밀값 없이 확인한다.

DB·개인화 세션은 위 네 migration, Supabase migration history, DB/RPC 권한 확인, 이 작업기록만 다룬다. Edge Function·secret·Auth/CAPTCHA 콘솔·route provider·앱/UI/엔진/카탈로그·`docs/작업조정_보드.md`는 수정하지 않는다. 이 작업은 원격 DB 변경을 포함하므로 대상 프로젝트가 현재 공모전 프로젝트인지와 배포 연결이 명확할 때만 실행한다. 프로젝트 식별자, DB URL, access token, service key, 사용자 ID, 좌표는 출력·문서화하지 않는다.

### 수행 순서

1. **읽기 전용 preflight**: 대상 migration history를 조회해 네 ID의 적용 상태와 local/remote history 불일치를 확인한다. 대상이 불명확하거나 history가 불일치하면 즉시 중단하고, `repair`, `reset`, 수동 SQL 재실행, `--include-all`, schema drop을 사용하지 않는다.
2. **순차 적용**: 누락된 ID만 CLI의 정상 migration 경로로 적용한다. 010→011→012→013 순서를 보장한다. 이미 적용된 migration을 재실행하지 않는다. 적용 중 한 단계라도 실패하면 다음 migration을 시도하지 않고 오류 분류와 마지막 확인 ID만 남긴다.
3. **읽기 전용 postflight**: migration history에서 네 ID가 모두 applied인지 재확인한다. 배포 연결이 허용하는 범위에서 다음 구조만 확인한다.
   - `route_proxy_cache`, fetch lease, daily/second budget, anonymous cleanup 계약이 존재한다.
   - budget table key가 `provider + mode + date` 및 `provider + mode + date + second`이고, mode은 `walk|transit`만 허용한다.
   - 구형 provider-only budget RPC signature가 없고, mode 포함 reserve/read RPC만 service role에 허용된다.
   - user/GPS/검색어/provider raw response 열을 새로 만들지 않았고, 실제 사용자·익명 계정·provider 호출을 만들지 않았다.
4. local migration contract test와 `git diff --check`를 재실행한다. 대상 DB에서 임의 budget row를 만들거나 cleanup Function을 호출해 검증하지 않는다. 실제 handler/Edge smoke는 다음 API 활성화 작업에서 한 번만 한다.

### 완료 기준·인계

네 migration ID의 대상 적용 상태와 구조/RLS 확인 결과를 비밀 없이 기록한다. 성공이어도 Edge 배포·secret 설정·anonymous Auth 활성화·runtime adapter 전환은 하지 않는다. 실패·대상 불명확·history 불일치면 DB를 더 바꾸지 않은 채 차단 사유와 재현 가능한 다음 확인만 남긴다.

### 완료 (2026-08-28)

- 변경 파일과 목적: 이 기록에 대상 Supabase 적용 결과를 남겼다. 원격 대상에는 정상 CLI migration 경로로 `202608270010` → `202608270011` → `202608270012` → `202608280013`을 순서대로 적용했다.
- 적용 전·후 확인: 앱 연결과 DB 연결의 프로젝트 참조 일치를 비밀값 출력 없이 확인했다. preflight에서는 기존 history가 일치하고 네 ID만 미적용이었으며, postflight에서는 네 ID가 모두 local/remote applied로 일치했다. 시스템 카탈로그에서 cache·fetch lease·daily/second mode budget·anonymous cleanup run/audit 구조, `provider, mode, date` 및 `provider, mode, date, second` 키, `walk|transit` 제약, 구형 provider-only RPC 부재, Route Proxy·cleanup table/RPC의 service-role 전용 권한, anonymous cleanup 다섯 RPC 및 금지 저장 열 부재를 읽기 전용으로 확인했다.
- 변경하지 않은 공개 계약·정책 경계: Edge Function 배포·secret 설정·Auth/CAPTCHA 콘솔·provider 호출·실사용자/익명 계정 생성·cleanup 실행·임의 budget row 생성은 하지 않았다. runtime adapter·앱/UI/엔진/카탈로그·작업조정 보드도 변경하지 않았다.
- 실행한 테스트와 결과: `node --test test/route-proxy-store-migration-contract.test.mjs test/route-proxy-fetch-lease-migration-contract.test.mjs test/anonymous-auth-cleanup-migration-contract.test.mjs test/route-proxy-mode-budget-migration-contract.test.mjs` — 16 passed, 0 failed. `git diff --check` — passed.
- 다음 세션의 결정 필요 사항·위험·재현 조건: API 활성화 세션은 이 DB history를 전제로 Edge handler 배포, server secret 연결, 익명 Auth 정책 활성화 여부와 한 번의 고정 fixture smoke 범위를 별도로 결정해야 한다. 이 DB 작업만으로 provider runtime 전환이나 anonymous Auth 계정 삭제가 실행되지는 않는다.

### 2026-08-28 — 통합·결정 검토: DB-RP-4 수락

대상 Supabase migration 목록을 읽기 전용으로 다시 확인했다. `202608270010`, `202608270011`, `202608270012`, `202608280013`이 모두 local/remote에 같은 ID로 적용돼 있다. 작업 기록의 구조·RLS 확인 범위도 Route Proxy/anonymous cleanup 계약에 한정됐고, provider 호출·실사용자/익명 계정 생성·cleanup 실행을 하지 않았다.

관련 migration contract fixture는 API 통합 재실행에서 통과했으며 `git diff --check`도 통과했다. 따라서 **DB-RP-4를 수락**한다. 이는 DB 준비 완료이지 Edge 배포 또는 runtime 사용 시작이 아니다.
