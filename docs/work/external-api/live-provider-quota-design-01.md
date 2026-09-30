# API-LIVE-QUOTA-DESIGN-01 — live 원천 전역 호출 예산

2026-09-22 조사·설계. **2026-09-22 통합 결정 반영:** 첫 구현은 공급자 HTTP **시도마다** DB의 원자적 **rolling 24시간 전역 cap**을 예약하는 데 한정한다. 이전 초안의 replay digest ledger·Tour detail CAS·catalog 안정 ID·초당 bucket·공급자 자정 bucket은 첫 구현 범위에서 제외하고 후속 강화로 남긴다. 이 문서는 설계·API 인계만이며 제품 코드·DB·운영 설정·배포는 변경하지 않았다.

공급자 quota 수치와 운영 승인 범위는 추측하지 않는다. 과거 문서의 개발계정 `1,000회`를 운영 설정이나 실제 잔여량으로 간주하지 않는다.

후속 상태: DB migration이 공유 작업트리에 추가된 뒤 API의 HTTP 직전 예약 연결은 [`API-LIVE-QUOTA-CONNECT-02`](live-provider-quota-connect-02.md)에 기록했다. 아래 §7은 이 설계 시점의 인계 기록이며, 원격 적용·운영 설정·배포 완료를 뜻하지 않는다.

## 1. 현재 코드에서 확인한 위험

| 경계 | 확인 사실 | 첫 구현에서 보완할 점 |
| --- | --- | --- |
| Tour catalog | `tourapi-live/handler.ts`가 인증·입력 검증 후 `areaBasedList2` 최대 2페이지 호출 | 인스턴스·기기 전체의 24시간 합계 없음 |
| Tour detail | 서명 budget token으로 첫 12·후속 6·누적 30, 동시성 3 | token은 비저장이라 replay/분기된 요청의 세션 한계를 전역으로 강제하지 못함 |
| 부산 live | `busan-live/handler.ts`의 메모리 cap은 invocation당 6, 원천별 최대 2페이지 | 다른 invocation·기기의 호출을 합산하지 못함 |
| 인증 | 두 Edge `index.ts`는 Supabase JWT를 `auth.getUser`로 확인 | 인증 사용자 수가 늘면 같은 공급자 credential quota를 함께 소모 |
| route-proxy | 별도 Kakao/TMAP budget table·RPC가 존재 | live 원천 scope·operation과 무관; 재사용·확장하지 않음 |

근거: `supabase/functions/tourapi-live/{handler,index}.ts`, `supabase/functions/busan-live/{handler,index}.ts`, `supabase/migrations/202608270010_route_proxy_store.sql`, `docs/work/external-api/{tourapi-live-progressive-03,busan-live-adapter-02}.md`. 기존 `request_budget_exhausted`는 세션/함수 cap의 안전 코드이지 전역 quota가 구현됐다는 뜻이 아니다.

## 2. 첫 구현 확정 범위 — rolling 24시간 전역 예약

### 2.1 scope·설정

- DB counter는 실제 quota를 공유하는 **공급자 credential/account scope**를 기준으로 한다. TourAPI와 부산 원천을 route-proxy 및 서로로부터 분리한다. 부산 명소·맛집·쇼핑의 동일 key가 하나의 계정 총량인지 확인 전에는 세 endpoint에 독립적인 quota를 각각 부여하지 않는다.
- 계정 소유자의 승인 근거로 scope별 안전한 앱 상한을 확정해 server-only DB 설정에 등록한다. **설정 없거나 0/손상/비활성화면 provider 호출 0**이다. Edge/client 요청이 cap·시각·scope의 실값을 제출하거나 확대할 수 없다. 공급자 승인·실제 허용량 확인 전에는 public 활성화하지 않는다.
- 같은 credential을 다른 앱/콘솔 작업도 사용한다면 DB는 그 외 사용량을 알 수 없다. 확정 공급자 한도보다 보수적 여유폭 또는 전용 credential이 필요하다. `429` 이후 자동 재시도는 하지 않는다.
- rolling 24시간은 DB 서버의 timestamp `t`에 대해 `(t - 24h, t]` 구간의 모든 예약 성공 건수를 제한한다. 달력 날짜·KST/UTC 자정·DST reset을 가정하지 않는다. 공급자 공식 quota가 별도의 reset 규칙을 따른다면 rolling cap과 동일한 보증이라고 주장하지 않으며 활성화 전에 차이·여유폭을 계정 소유자가 결정한다.

### 2.2 호출 순서와 실패

Edge는 JWT 인증, secret 존재, strict 입력, Tour signed token/active exact ref, 기존 invocation cap을 먼저 확인한다. 그 뒤 **각 실제 provider `fetch` 직전** DB RPC에 1건을 원자적으로 예약한다. 허가 응답이 확정된 경우에만 provider URL을 만들고 HTTP를 시도한다.

- Tour catalog page1/page2, Tour detail의 각 ID, 부산 명소·맛집·쇼핑의 각 page가 각각 1 slot이다. 요청 전체 최대치를 선예약하지 않는다. 첫 page 실패로 다음 page를 시도하지 않으면 다음 slot도 소모하지 않는다.
- 예약 성공 뒤 HTTP timeout·네트워크 오류·provider 거절·응답 파싱 실패·Edge 종료가 나도 환불하지 않는다. 공급자 도달 여부가 불확실하기 때문이다. 예약 직후 죽어 실제 HTTP를 안 해도 보수적으로 1 slot을 소모할 수 있다.
- DB timeout/오류/RPC 손상·응답 없음/설정 없음/한도 초과이면 해당 HTTP는 0회다. 원문 DB 오류는 로그·앱 응답으로 내보내지 않고 기존 typed unavailable 경계로 닫는다. 자동 retry0을 유지한다.
- 두 Edge invocation이 남은 한 slot을 동시에 요청하면 transaction/lock 아래 **한 건만 허가**된다. 부산 한 원천/페이지의 예약 실패는 이미 ready인 다른 원천을 지우지 않으며 불완전 원천을 inactive 근거로 삼지 않는다. Tour catalog 페이지 불완전은 기존 unavailable, detail ID 실패는 기존 partial 안전 상태로 처리한다.

### 2.3 이 구현이 **보장하지 않는 것**

전역 rolling cap은 동일 호출의 **중복 실행 자체를 막지 않는다**. 같은 Tour signed token replay, 서로 다른 ref 집합으로의 token 분기, 같은 부산 snapshot 재요청, 앱 재진입 시 새 facade 생성은 각각 새 전역 slot을 예약할 수 있다. 다만 어느 경로도 DB가 정한 rolling 24시간 총량을 초과해서 provider에 도달해서는 안 된다. replay를 `provider 0`으로 차단하거나 Tour 세션 누적 30을 분기 간 강제했다고 주장하지 않는다.

이 차이를 검증하는 테스트를 둔다: 동일 요청을 두 번 보냈을 때 **둘 다 cap 안이면 두 slot을 소모할 수 있고**, 남은 slot이 하나라면 정확히 한 HTTP만 허가된다. 앱 수준 중복 억제·자동 retry0은 유지하되 서버 전역 replay 방지로 표현하지 않는다.

## 3. DB·개인화 역할 인계 — 첫 구현 RPC 요구

DB 세션에 migration을 인계했다. 실제 함수명·서명은 DB 역할 산출물을 읽고 API 역할에서 맞춘다. 의미상 필요한 최소 포트는 다음과 같다.

```text
reserve_live_provider_attempt(
  server_allowlisted_credential_scope,
  server_allowlisted_operation
) -> { granted: boolean, reason: granted | limit | unconfigured, safe_used?: integer }
```

- RPC가 **DB 서버 시각**과 DB의 scope별 설정값으로 rolling 24시간 사용량을 계산한다. Edge가 limit, timestamp, date bucket, timezone을 넘기지 않는다. service-role-only이며 anon/authenticated가 table·RPC를 직접 호출하지 못한다.
- 같은 credential scope에 대한 check-and-increment는 transaction 잠금으로 원자적이다. 최초 row 경합도 포함한다. DB는 예약 시각과 scope/operation의 안전 집계만 보관한다. provider key, JWT, 사용자 ID, 좌표, content ID, URL/query, 원문 응답·오류는 저장하지 않는다.
- operation별 집계는 가능하지만 한도 판정은 **credential scope 전체**다. 부산 세 endpoint가 동일 credential이면 별도 quota 세 개로 증식시키지 않는다. route-proxy Kakao/TMAP table·RPC와도 분리한다.
- `granted`가 commit된 후에만 Edge가 `fetch`한다. DB 연결 실패·복수 행·손상 enum은 RPC의 성공 reason이 아니라 Edge의 안전 실패 매핑이다. `safe_used`는 server-side 선택적 진단일 뿐 앱에 잔여 quota 수치를 새로 노출하지 않는다.
- 오래된 예약 행 정리는 rolling 24시간 판단에 필요한 구간을 절대 일찍 지우지 않도록 DB 역할이 정한다. 예약 증거의 보존/삭제 근거와 운영 집계 기간도 DB 소유다.

## 4. API 역할 구현 준비 — DB RPC 계약 수락 후에만

1. DB migration/RPC의 실제 시그니처·RLS/권한·safe reason을 읽고, Tour/Busan `index.ts`에서 server-side service-role 예약 port를 각 handler에 주입한다. 설정 누락과 RPC 장애는 provider 호출 0으로 닫는다.
2. Tour handler 공통 `call()`과 Busan `callPage()`에서 **각 `fetch` 직전** 예약을 수행한다. 기존 Tour 2페이지·12→6·누적30, 부산 최대6·원천별2, timeout·인증·strict input 순서를 보존한다. 원문 DB error/공급자 URL/key를 로그·반환하지 않는다.
3. 예약 실패의 안전 코드가 기존 `request_budget_exhausted`와 DB unavailable을 구별해야 하는지 RPC/adapter typed contract에서 최소 변경을 결정한다. provider를 호출하지 않은 ref/page를 성공으로 합성하지 않는다. 이미 성공한 부산 원천/상세 ref는 partial로 보존한다.
4. fixture로 예약 port가 없거나 설정이 없을 때 모든 신규 live HTTP가 0인지 검증한다. 네트워크 fixture만 사용하고 운영 API·실제 키·배포는 호출하지 않는다.
5. public 활성화·운영 수치·실호출·배포는 별도 승인이다. 이 준비 문서만으로 Edge handler를 지금 수정하지 않는다.

## 5. 첫 구현 fixture 목록

| ID | 입력/경쟁 조건 | 기대 결과 |
| --- | --- | --- |
| Q1-01 | 설정 없음/DB timeout/RPC malformed, 첫 원천 page | provider fetch 0, 안전 unavailable, 원문 비노출 |
| Q1-02 | rolling 창의 남은 slot 1에 서로 다른 두 Edge invocation 동시 예약 | 정확히 1 grant·1 fetch, 사용량 1 증가 |
| Q1-03 | 24시간 경계 직전/직후의 예약과 동시성 | DB 시계 구간 기준으로 계산, 초과 grant 0; 달력 자정 초기화 없음 |
| Q1-04 | 같은 요청 replay 2회, 두 slot 여유 / 한 slot 여유 | 전자는 2회 허가될 수 있음을 명시, 후자는 최대 1회; replay 차단이라고 오판하지 않음 |
| Q1-05 | Tour 첫 page 성공 후 다음 page의 cap 거절 | 미시도 HTTP 0, catalog unavailable, 사용한 slot만 유지 |
| Q1-06 | Tour detail 일부 예약 허가·일부 거절/timeout | 시도한 ref만 소모, partial/안전 실패, 누적 cap 확대 없음 |
| Q1-07 | 부산 세 원천 동시, 한 원천 두 번째 page cap 거절 | 총 cap 이내, 기존 ready 원천 보존, 불완전 원천 inactive 0 |
| Q1-08 | 예약 성공 후 provider timeout/Edge 종료 | 예약 환불 0, 자동 retry 0 |
| Q1-09 | route-proxy Kakao/TMAP과 live 예산 동시 | 저장소·counter 독립, 기존 route 예산 불변 |
| Q1-10 | anon/authenticated 직접 RPC/table 접근·client limit/time 주입 | 거절, provider 0 |

fake DB/clock과 local DB 동시 transaction fixture를 분리한다. 운영 API 반복 호출로 회귀를 돌리지 않는다. 안전 집계는 scope·operation·count만 사용하고 secret·좌표·원문은 남기지 않는다.

## 6. 후속 강화 — 이번 첫 구현에서 **보류**

이전 초안은 replay digest ledger, Tour detail session version CAS, catalog 사전 opaque ID, 초당 제한, provider reset timezone별 일일 bucket을 한 번에 제안했다. 통합 결정은 첫 구현의 복잡도와 소유 범위를 줄여 **rolling 24시간 전역 cap만 먼저 구현**하는 것이다. 이전 제안은 철회된 보장이 아니라 **별도 승인·설계가 필요한 후속 항목**으로 남긴다.

- Tour signed token은 현재 비저장·명시 만료 없음. 동일 이전 token의 서로 다른 detail branch는 세션 내 30 제한을 우회할 수 있으나 각 HTTP가 전역 cap 1 slot을 소비한다. 세션별 불변 30과 replay 0이 필요한지 실제 남용/비용 근거로 결정한다.
- catalog는 첫 HTTP 전에 안정적인 request ID가 없고 부산 snapshot도 replay 가능하다. 동일 요청 HTTP 0을 보장하려면 서버 저장 ledger 또는 결과 cache/lease 정책이 별도로 필요하다. 원본 응답 비저장 원칙과 충돌하지 않게 설계해야 한다.
- 공급자 초당 제한이 확인되면 별도 rate gate를 검토한다. rolling 24시간 cap은 초당 burst를 막지 못한다.
- 공급자 공식 reset 시간대/달력 quota가 rolling cap과 달라 운영 여유폭으로 충분하지 않다면 provider 기준 bucket을 별도 결정한다. 시각·할당량을 임의로 정하지 않는다.

## 7. 완료 인계

1. **변경 파일 / 목적:** 본 문서만 통합 결정에 맞춰 갱신했다. handler·adapter·DB는 수정하지 않았다.
2. **유지 계약:** route-proxy 예산, Tour 2페이지·12→6·30, 부산 원천별2·snapshot6, 자동 retry0, exact ID, 비저장 원본, public OFF 유지. 제품 코드·DB·설정·secret·배포·키·실제 공급자 호출·commit/push 0.
3. **테스트 결과:** 문서 설계/준비라 제품 테스트·실제 공급자 호출은 실행하지 않았다. `git diff --check` 통과, 신규 문서 trailing whitespace 0. 현재 workspace에는 live quota migration이 아직 확인되지 않아 RPC 연결 검증은 미실행이다.
4. **다음 결정·위험:** DB 역할 RPC 수락 후 §4의 최소 연결과 §5 fixture를 API 소유 경로에서 수행한다. 공급자 실제 quota·credential 공유 scope·rolling cap 여유폭이 확정되기 전에는 운영 설정/활성화 금지. replay 0·세션 분기 차단·초당 제한은 §6의 후속 결정이며 첫 구현 완료 주장에 포함하지 않는다.
