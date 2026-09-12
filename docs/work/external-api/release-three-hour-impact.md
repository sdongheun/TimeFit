# API-RELEASE-180-CHECK — 180분·2곳 API 영향 확인

2026-09-08 · [DEC-RELEASE-180-01](../integration-decision/release-three-hour-two-stop.md) 인수인계.

상태: **읽기 전용 조사 완료. 180분을 막는 API 입력 상한 없음. 날짜 지정 대중교통 검증의 기존 한계는 통합에 반환.** 코드·API 계약·설정 변경 0.

## 경계별 결과

| 확인 대상 | 코드 근거 | 판정 |
| --- | --- | --- |
| 실제 출시 요청 | `src/ui/recommendation/v1Session.ts:recommendationPortsFor` → `routeProxyActivatedCourseAdapter.ts` → `routeProxyClientAdapter.ts` → `routeProxyProductionPorts.ts` → `supabase/functions/route-proxy/handler.ts` | proxy 활성 분기의 출시 경로. 최종 Release flag/운영 배포 일치는 이번에 확인하지 않음 |
| 요청 validator | `RouteProxyFunctionRequest`, handler `requestShape` | mode, scope, allowance 0/1, public ID/version 또는 private 좌표를 검증. remainingMin/출발일/도착일이 없으므로 120분 거절·180분 clamp 없음. public 문자열 길이는 handler 160자이며 시간과 무관 |
| 응답 시간 validator | `routeProxyClientAdapter.ts:exact`, `routeProxyProductionReceipt.ts`, handler `minute` | 양의 분/정수·응답/receipt 일치를 검사. 120분 상한 없음. 주입한 transit 180분도 exact로 반환됨. 코스 전체 180분 내 체류/여유 포함 여부는 엔진 책임 |
| 시간·날짜 전달 | `v1Session.ts`는 nowIso를 Date로 파싱하고 remainingMin을 엔진에 전달. `getRouteReceipt(from,to,budget)`는 시간 인자를 받지 않음 | 엔진 시간과 provider 시간은 별개. API가 같은 날로 바꾸거나 23:59로 잘라내는 코드는 없음. **예정 출발·도착 날짜 자체가 provider까지 전달되지 않음** |
| Kakao 요청 | `supabase/functions/route-proxy/kakaoRouteRequest.ts:buildKakaoRouteRequest` | walk/publictraffic 요청은 양 끝 x/y와 입력·출력 좌표계만 query로 구성. JWT·코스 남은 시간·개발 테스트 시각·예정 이동 날짜를 보내지 않음 |
| public cache/lease key | handler `keyArgs`, cache/lease RPC | provider+mode+방향성 from/to 장소 ID+catalogVersion. 120/180분, 예정 출발 날짜는 key에 없음. private은 이 public 영속 cache 대상 아님 |
| 로컬 cache key | `privateWalkConnector.ts:keyOf`, `courseV1RouteAdapter.ts:courseV1RouteCacheKey`, `routeBaselineService.ts:routeBaselineKey` | 좌표 쌍/수단/namespace 중심. 입력 남은 시간 상한과 무관. legacy baseline 영속 보유 문제는 [기존 안전성 인계](release-safety-remediation.md)의 별도 결정이며 이번에 전환/정리하지 않음 |
| TTL·자정 | handler는 server `deps.now()` epoch에 TTL을 더해 ISO expiry 생성. connector 및 legacy adapter도 epoch 차이로 TTL 판정 | KST 자정에서 음수/23:59 clamp 없음. 기본 public 15분, connector 10분, legacy success/baseline 24시간은 재사용 기간이며 코스 시간 상한이 아님. 실제 TTL override는 미확인 |
| quota 날짜 | handler `new Date(deps.now()).toISOString().slice(0,10)` 및 epoch second | 서버 실행시각의 **UTC** 일별 quota다. KST 00시 초기화나 입력 도착일 기반 초기화가 아님. 기존 의미를 유지하며 180분 입력에 비례해 budget을 늘리지 않음 |
| timeout | `supabase/functions/route-proxy/deadline.ts` | lease 1,000~30,000ms, provider deadline은 lease보다 최소 250ms 짧아야 함. 일반 timeout의 12,000ms 등은 HTTP 대기시간이며 120분 상한 아님. 180분 코스라고 확대할 이유 없음 |
| provider attempt | client leg allowance 0/1/2 → Edge mode별 0/1. `twoStopSelectionV1.ts`의 16/12/36 ledger 및 initial/page 8 계약 | 시간 길이로 API allowance를 확대하는 경계 없음. public remaining0 cache-only/provider0 및 private remaining0 호출0 유지. 더 긴 시간의 후보 증가가 무제한 호출을 허용하지 않음 |
| RPC 읽기 계약 | route store/geometry migration: `catalog_version` 길이 1~120, `total_min` 1~1440 | 120은 문자열 길이, 1440은 구간 분 범위. 180분을 거절하지 않음. DB 저장·개인화/코스 snapshot 제약 전체는 DB-RELEASE-180-CHECK 담당 |

## 익일 대중교통의 기존 한계 — 오류 확정과 구분

현재 adapter/Edge/provider request는 예정 이동 시각을 구별할 수 없다. 같은 양 끝·수단으로 오늘 밤 출발과 익일 출발을 요청해도 같은 요청 구조와 public cache identity다. 따라서 다음 주장은 코드만으로 확정할 수 없다.

- 개발 시계/입력 nowIso에 대응하는 운행편을 provider가 검증했다.
- 두 번째 장소에서 자정 이후 출발할 때에도 현재 받은 transit 경로가 운행한다.
- cache TTL 안의 hit이 막차/첫차 경계를 고려했다.

이는 120→180에서 새로 생긴 validator 결함이 아니라 기존 비시간지정 경로 계약의 한계다. provider가 실제 어떤 기준시각으로 운행 가능성을 계산하는지는 이번 코드 감사/fixture로 확인하지 않았다. 실제 막차 오류가 발생했다고 단정하지 않는다. 엔진의 날짜 포함 운영시간 검증은 이 한계를 자동으로 해결하지 않는다.

### 재현 fixture와 최소 변경 인계

1. 고정 public A→B transit, 동일 catalogVersion, 별도 엔진 입력 `2026-09-08 23:00 KST + 180분`과 익일 이동시각을 준비한다. invoker spy로 mode/scope/allowance가 동일하고 date field가 없음을 확인한다. `buildKakaoRouteRequest` query key 집합도 start/end x/y 및 좌표계 여섯 개뿐이다. 원격 호출 불필요.
2. fake clock을 KST 23:55에 두고 15분 expiry를 계산하면 익일 00:10이 된다. 현 TTL 산술은 이 경계를 통과한다. 이 산술 검증은 운영 DB 만료 job 검증이 아니다.
3. 날짜 지정 운행 보장이 이번 정책의 필수 조건이라면 통합이 먼저 지원 의미를 확정해야 한다. 필요 최소 계약은 leg 예정 출발 instant/timezone을 엔진→adapter→provider까지 연결하고 public cache의 시간별 재사용 경계를 정하는 것이다. 해당 provider의 공식 지원 파라미터/허용 계약 확인 전에 필드를 임의 추가하지 않는다. provider가 지원하지 않으면 미검증 시간대의 결과 취급을 엔진/UI와 결정해야 하며 이 감사가 자동 제한/근사 fallback을 승인하지 않는다.
4. 180분 입력 허용만을 위한 API 변경은 필요 없다. UI의 최대 입력·익일 표시 및 엔진의 운영시간은 각 소유 세션에서 검증한다. API의 “exact”는 현행 provider 경로 receipt이며 날짜 지정 운행 보장의 새로운 의미로 확장하지 않는다.

## 네 항목 인수인계

### 변경 파일

- 이 보고서만 신규 기록. 코드·테스트 파일·보드·타 역할 파일 변경 0. 조사 대상은 현재 소스이며 운영 revision을 동일하다고 추정하지 않았다.

### 유지 계약

- provider, 공개 요청/응답, 날짜/캐시 key, TTL/timeout, 첫/page/pair 호출 예산, public/private 격리 불변. 키/환경 값 열람·출력, API 실호출, 배포, cache 삭제, commit/push 0.

### 테스트 / 증거

- 기존 fixture 실행: `npx tsx --test test/api-two-stop-route-budget.test.ts test/route-proxy-page-budget.test.ts test/route-proxy-deadline.test.ts test/route-proxy-timeout-behavior.test.ts test/private-walk-connector.test.ts test/route-proxy-geometry-migration-contract.test.mjs` — **45/45 통과**, skip 0. page 테스트명의 과거 조건부16은 현행 자동 보충을 재활성화하는 근거로 사용하지 않는다.
- 일회성 inline fixture: 실제 `createCourseV1ProxyRouteAdapter`에 mock invoker를 주입. walk180 뒤 transit180 반환 → exact180/attempt2, 요청 필드는 mode/scope/allowance/origin/destination만 존재함을 확인. 실제 builder의 query 필드 여섯 개와 KST 자정 통과 epoch expiry도 assert 통과. 키는 고정 fixture 문자열만 사용했고 URL/좌표/header를 출력하지 않았다. provider HTTP **0회**.
- 기능 코드 변경이 없어 전체 UI/core/typecheck를 재실행하지 않았다. 위 검증은 180분 코스의 엔진·UI 전체 합격 판정이나 익일 운행 검증이 아니다.

### 다음 위험 / 담당

- 통합·엔진·UI: 비시간지정 provider 경로의 익일 운행 한계를 수락할 수 있는지, 별도 날짜 지정 운행 계약이 필요한지 판단. API 입력 상한 교정은 불필요.
- QA: 119/120/121/179/180/181 및 익일 장소 운영시간·휴무·기존 진행 복구는 ENGINE/U-RELEASE-180 완료 후 고정 revision으로 확인. API 45건 통과를 이 전체 게이트 PASS로 대체하지 않는다.
- 운영: Release flag/handler 배포·TTL·UTC quota 정책/계정 권한은 별도 미확인. 이번 작업은 운영 확인 실행 승인으로 해석하지 않는다.
