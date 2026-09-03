# DB-ROUTE-GEOMETRY-01 — 공개 구간 형상 캐시 보존

## 상태와 목적

로컬 구현·통합 수락, **운영 적용 완료·재확인 수락**. `DEC-COURSE-GEOMETRY-01`의 공개 장소↔장소 형상만 기존 Route Proxy 캐시에 보존한다. 새 사용자 위치 테이블이나 추천 이력 저장을 만들지 않는다. 2026-09-03 사용자가 실제 앱에서 출발지·목적지 marker만 보이고 경로선은 보이지 않는 것을 확인해 운영 반영을 승인했다.

## 확정 구현 명령

1. 새 Supabase migration 하나로 기존 `route_proxy_cache.steps`와 RPC를 확장한다. 테이블을 새로 만들거나 기존 migration을 수정하지 않는다.
2. 현재 `route_proxy_put_route`가 `min/distanceM/instruction`만 재구성하면서 path를 제거하는 동작을 교체한다. 기존 `p_steps jsonb` signature는 유지해 Edge 배포와 RPC 호출 형태를 깨지 않는다.
3. 각 저장 step은 기존 필드 외에 선택 `paths`를 허용한다. `paths`는 WGS84 `[lon, lat]` 좌표쌍의 배열들이다. path 최대 32개, route 전체 점 최대 512개, path당 최소 2점을 검증한다.
4. 모든 좌표는 숫자·finite, `lon -180..180`, `lat -90..90`이어야 한다. 문자열 숫자, 객체 좌표, 추가 임의 필드, 과도한 중첩, 한도 초과는 `invalid_route_result`로 거절한다.
5. 저장 시 허용 필드만 새 JSON으로 재구성한다. provider raw body, URL, 사용자 ID, token, private origin/destination, 검색어는 저장하지 않는다.
6. 기존 path 없는 cache row와 `steps=[]`는 계속 읽혀야 한다. `route_proxy_get_route`와 `route_proxy_complete_fetch_lease`의 인자·권한·RLS·service-role 경계는 유지한다.
7. private request는 기존처럼 이 테이블과 lease를 사용하지 않는다는 API 계약을 DB 테스트에도 명시한다.

## 실패 우선 검증

- 유효한 2개 path가 put→get 후 좌표 순서까지 동일하다.
- 기존 path 없는 step과 빈 steps가 회귀 통과한다.
- 점 513개, path 33개, NaN/문자열/범위 밖 좌표, 임의 raw 객체는 저장 실패한다.
- anon/authenticated 직접 table/RPC 접근은 기존처럼 거부되고 service role만 동작한다.
- migration 재적용 가능성과 기존 함수 signature 불변을 계약 테스트로 확인한다.

## 소유 경계와 완료

- 수정: `supabase/migrations/`, DB migration 계약 테스트, 이 문서.
- 금지: `src/engine/`, `src/services/`, `src/ui/`, Edge handler, 데이터 카탈로그, 기준 정책 문서, 작업 보드.
- 원격 DB push/deploy는 통합 수락 전 수행하지 않는다. 완료 기록에는 migration 파일, 이전 row 호환, 권한 테스트, 로컬 검증 결과를 남긴다.

## 완료 기록 — 2026-09-03

### 이전 방식 → 문제 → 교체 방식 → 이유 → 상태

- **이전 방식:** `route_proxy_put_route(..., p_steps jsonb, ...)`는 step에서 `min`, `distanceM`, `instruction`만 재구성해 공개 경로 응답의 `paths`를 제거했다.
- **문제:** 추천 검증에 이미 사용한 실제 경로 형상을 public POI cache hit에서 복원할 수 없어, 상세 화면이 같은 검증 경로선을 추가 호출 없이 그릴 수 없었다. 반대로 provider 원문이나 private origin/destination을 그대로 저장하면 최소 보관 경계를 침범한다.
- **교체 방식:** `supabase/migrations/202609030014_route_proxy_geometry_cache.sql`에서 기존 함수 시그니처와 `route_proxy_cache.steps` 열을 유지한 채 put 함수만 교체했다. 각 step은 `min`, 선택 `distanceM`, `instruction`, `paths`만 허용하며 새 JSON으로 재구성한다. `paths`는 WGS84 `[lon, lat]` 숫자쌍으로만 구성하고 route 전체 path 32개·점 512개, path당 최소 2점, 경도 `-180..180`, 위도 `-90..90`을 강제한다. JSONB가 비유한수를 문자열로 직렬화하는 경우를 포함해 숫자형이 아닌 좌표, 객체·과도한 중첩·추가 필드·한도 초과는 `invalid_route_result`로 닫힌다.
- **교체 이유:** 공개 POI 구간의 TTL cache에서 검증 당시 형상만 재사용하면서 RPC 호출 형태, cache key/TTL, lease complete 경로와 개인정보 비영속 경계를 그대로 유지하기 위함이다.
- **상태:** 구현 완료·통합 수락 대기. 원격 Supabase push와 Edge/API/엔진/UI 변경은 수행하지 않았다.

### 변경 파일과 목적

- `supabase/migrations/202609030014_route_proxy_geometry_cache.sql`: 기존 `route_proxy_put_route(text, text, text, text, text, integer, jsonb, timestamptz)`를 geometry 검증·정제 구현으로 교체한다. `route_proxy_get_route`와 `route_proxy_complete_fetch_lease`의 시그니처는 변경하지 않았다.
- `test/route-proxy-geometry-migration-contract.test.mjs`: additive migration, 기존 시그니처, 한도·좌표·허용 필드·service-role 경계를 정적 계약으로 고정한다.
- `test/fixtures/route-proxy-geometry-db-contract.sql`: 실제 PostgreSQL에서 유효 geometry 왕복, legacy/빈 steps 호환, invalid payload 거절, 권한과 private 열 부재를 재현한다.

### 변경하지 않은 공개 계약·정책 경계

- cache key `(provider, mode, from_poi_id, to_poi_id, catalog_version)`, 24시간 이내 TTL, 성공 결과만 저장, fetch lease complete→put 호출과 기존 RPC 인자·반환형을 유지했다.
- user/session/device/IP, private origin/destination 좌표, 검색어, provider 원문·URL·credential 열이나 로그를 추가하지 않았다. private route가 cache/lease를 호출하지 않는 API 소유 계약도 변경하지 않았다.
- `src/engine/`, `src/services/`, `src/ui/`, Edge handler, 카탈로그, 기준 정책 문서와 작업 보드는 수정하지 않았다.

### 검증 결과

- 실패 우선: migration 추가 전 geometry 계약 4건이 파일 부재로 실패함을 확인했다.
- `node --test test/route-proxy-geometry-migration-contract.test.mjs test/route-proxy-store-migration-contract.test.mjs test/route-proxy-fetch-lease-migration-contract.test.mjs` — 12 passed, 0 failed.
- 격리 PostgreSQL migration chain `010→011→014→014`와 DB fixture — passed. 유효한 2개 path 좌표/순서 왕복, path 없는 기존 step과 `steps=[]`, 513점·33 paths·NaN·문자열·범위 밖·객체 좌표·1점 path·추가 raw 객체 거절, 기존 put/complete signature, anon/authenticated execute 거절, service-role execute 허용, private 열 부재를 확인했다. 임시 클러스터는 검증 뒤 삭제했다.
- `npm run test:typecheck` — passed. `npm test` — passed(1/1 discovery gate). `npm run test:ui` — 191 passed, 1 known skip, 0 failed.
- `git diff --check` — passed.

### 다음 세션 인계

- 통합·결정 세션이 migration과 격리 결과를 수락한 뒤에만 대상 Supabase 적용 여부를 정한다.
- API-ROUTE-GEOMETRY-01은 Kakao 응답을 이 `steps[].paths: Array<Array<[lon, lat]>>` 형식으로 정제해 기존 `p_steps`에 전달해야 한다. private route는 응답 메모리에서만 geometry를 전달하고 put/lease/cache를 호출하지 않아야 한다.
- geometry 누락은 cache write와 시간상 유효한 추천을 실패시키지 않는다. API는 path가 없는 기존 step/빈 steps 호환을 유지해야 하며, 추가 provider 호출로 보완하지 않는다.

## 통합 검토 — 2026-09-03

### 판정

**수락.** 새 migration 하나로 기존 `p_steps jsonb` RPC 시그니처와 cache key·TTL·lease 경계를 유지하면서, 허용된 `steps[].paths`만 새 JSON으로 재구성한다. path 최대 32개·전체 512점·path당 최소 2점과 WGS84 숫자 범위를 실제 함수에서 검사하며, 사용자 식별자·private 출발/도착 좌표·provider 원문을 위한 열이나 payload를 추가하지 않았다.

### 통합 세션 재검증

- 정적 migration 계약 12/12 성공.
- 별도 임시 PostgreSQL에서 `010 → 011 → 014 → 014` migration chain과 DB fixture 성공. 유효 geometry put→get 순서 보존, legacy/빈 steps, 33 paths·513 points·잘못된 좌표 거절, service-role 권한과 재적용을 확인했다.
- `git diff --check` 성공.
- 운영 Supabase push·Edge 배포·실제 외부 API 호출은 수행하지 않았다.

### 다음 경계

- 로컬 DB 계약은 확정됐다. 운영 migration 적용은 `API-ROUTE-GEOMETRY-01`의 배포/통합 검증 직전에 **DB migration 먼저, Edge/API 다음** 순서로 수행한다.
- `API-ROUTE-GEOMETRY-01`은 별도 선행인 `2-W` 보완까지 수락된 뒤 시작한다. `2-W`의 현재 보완과 DB 재작업은 연결하지 않는다.

## 운영 적용 단계 — 실행 지시

### 목적과 현재 관찰

- 자동 통합에서는 handler → cache → adapter → engine → map까지 실제 geometry 전달이 통과했다.
- 현재 실기기에서는 출발지와 목적지 marker는 보이지만 경로선이 없다. 이 관찰은 UI가 선을 그리지 못한다는 증거가 아니라, 운영 Route Proxy가 아직 새 geometry 계약으로 배포되지 않은 상태와 일치한다.
- 이 단계의 목적은 새 기능 추가가 아니라 이미 수락된 `202609030014_route_proxy_geometry_cache.sql` **한 건만** 연결된 운영 Supabase DB에 반영하는 것이다.

### 실행 순서와 중단 기준

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, 이 문서만 읽는다. migration·RPC·테스트 코드를 다시 수정하지 않는다.
2. `.env.local`의 `DATABASE_URL`이 비어 있지 않고 저장소가 올바른 Supabase 프로젝트에 link되어 있는지만 확인한다. URL·project ref·token·key 값은 터미널 출력이나 문서에 복사하지 않는다.
3. 아래 사전 검증을 실행한다.
   - `node --test test/route-proxy-geometry-migration-contract.test.mjs test/route-proxy-store-migration-contract.test.mjs test/route-proxy-fetch-lease-migration-contract.test.mjs`
   - `git diff --check`
   - `.env.local`을 shell에 로드한 뒤 `npx supabase@latest migration list --db-url "$DATABASE_URL"`
4. migration list에서 기존 운영 이력과 로컬 이력이 동일하고 `202609030014`만 미적용인 경우에만 다음 명령으로 push한다.
   - `set -a && source .env.local && set +a && npx supabase@latest db push --db-url "$DATABASE_URL"`
5. 다음 중 하나면 push하지 말고 그대로 중단한다.
   - 연결 대상이 예상 프로젝트인지 확인할 수 없음
   - `DATABASE_URL` 누락·권한 거절
   - `014`보다 앞선 migration이 운영에서 빠졌거나 로컬/운영 이력이 갈라짐
   - `014` 외의 예상하지 않은 migration도 함께 적용된다고 표시됨
   - CLI가 migration repair, reset, pull 또는 기존 이력 변경을 요구함
6. push 뒤 migration list를 다시 실행해 `202609030014`가 local/remote 양쪽에 존재하는지 확인한다. 이미 적용된 것으로 확인되면 재적용하지 않고 `기적용 확인`으로 기록한다.
7. 운영 데이터 행을 삭제하거나 cache를 비우거나 실제 route RPC를 호출하지 않는다. 이 단계는 Kakao 호출 0회, 사용자 데이터 조회 0회여야 한다.

### 완료 기준과 인수인계

- 완료 판정: `014`가 운영 migration 이력에 존재하고 사전 계약 테스트가 모두 통과한다.
- 기록할 항목: 변경 파일 `없음` 여부, migration ID, `적용/기적용` 상태, 테스트 통과 수, 실제 API·DB 데이터 호출 0회, 다음 작업이 `API-ROUTE-GEOMETRY-01 운영 배포`라는 사실.
- 기록 금지: DB URL, project ref 전체값, access token, service-role key, 실제 사용자·좌표·cache row.
- 이 완료 기록을 통합·결정 세션이 확인하기 전에는 외부 API 세션이 Edge Function을 배포하지 않는다. DB와 Edge를 병렬로 실행하지 않는다.

## 2026-09-03 — 운영 적용 완료 인수인계

- **변경 파일:** migration·RPC·테스트 코드 변경 없음. 이 문서에 운영 적용 결과만 기록했다.
- **대상 확인:** `.env.local`의 앱/DB 연결과 저장소 Supabase link가 같은 승인 대상임을 식별값 출력 없이 확인했다.
- **migration 상태:** preflight에서 기존 local/remote history가 모두 일치하고 `202609030014`만 미적용이었다. 정상 CLI migration 경로로 `202609030014_route_proxy_geometry_cache.sql` 한 건을 **적용**했으며, postflight에서 `202609030014`가 local/remote 양쪽에 존재함을 확인했다.
- **운영 DB 계약 확인:** 시스템 카탈로그 읽기만으로 기존 `route_proxy_put_route(text, text, text, text, text, integer, jsonb, timestamptz)`와 `route_proxy_complete_fetch_lease(text, text, text, text, text, uuid, integer, jsonb, timestamptz)` 시그니처, `paths` 허용 필드, path 32개·점 512개 제한, service-role 전용 put 권한을 확인했다.
- **사전 검증:** Route Proxy store/fetch lease/geometry migration 계약 **12/12 통과**, `git diff --check` 통과.
- **변경하지 않은 경계:** cache row 조회·삭제·초기화, route RPC 호출, 사용자 데이터 조회, Kakao/provider 호출, Edge Function·API 배포, secret/JWT/Auth 설정 변경은 모두 0회다. DB URL·project ref·token·key·사용자·좌표·cache 내용은 출력하거나 기록하지 않았다.
- **다음 작업:** 통합·결정 세션이 이 완료 기록을 확인한 뒤에만 외부 API 역할이 `API-ROUTE-GEOMETRY-01` 운영 배포를 순차 진행한다. DB 운영 적용은 완료됐으며 Edge 배포는 아직 수행되지 않았다.

## 2026-09-03 — 운영 적용 통합 재확인

- **판정:** 수락. 완료 기록의 범위와 중단 기준을 충족했다.
- 통합·결정 세션이 `npx supabase@latest migration list --db-url "$DATABASE_URL"`를 읽기 전용으로 재실행했고, `202608110001`부터 `202609030014`까지 모든 local/remote migration ID가 일치함을 확인했다.
- 예상 밖 migration, 이력 분기, 누락된 선행 migration은 없었다. 실제 Kakao 호출·cache 삭제·사용자 데이터 조회·추가 DB 쓰기는 수행하지 않았다.
- 이에 따라 `API-ROUTE-GEOMETRY-01`의 기존 `route-proxy` 운영 배포 단계를 진행할 수 있다.
