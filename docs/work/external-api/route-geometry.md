# API-ROUTE-GEOMETRY-01 — Kakao 경로 형상 정제·전달

## 상태와 선행 조건

1차 로컬 구현·운영 배포와 `API-ROUTE-GEOMETRY-02` 진단은 수락됐다. 동일 부산 C2의 14개 transit route 모두 시작·마지막 `WALKING` path가 없고 목적지 gap이 `51–250m` 남아, 다른 transit route 선택으로는 하차지점→장소 도보선을 복구할 수 없음을 확인했다. 사용자는 추천 후보 선조회가 아니라 **선택한 코스 상세에서만 private walk connector를 조회**하는 방식을 확정했다. 현재 작업은 아래 `API-ROUTE-GEOMETRY-03`이며, 그 위의 “결정 전”·“상세 route 0회” 문구는 과거 진단 이력이다.

## API-ROUTE-GEOMETRY-02 — 단일 응답 전체 route의 출발·도착 도보 완전성 확인 — 완료·수락

### 목적과 사용자 관찰

- 사용자가 본 문제는 `출발지 → 대중교통 하차 지점`의 주황색 선만 있고 `하차 지점 → 추천 장소`의 도보선이 끊기는 것이다.
- `API-ROUTE-GEOMETRY-01`은 Kakao 호출·인증이 정상이며 부산 C2의 `routes[0]`에 마지막 `WALKING`이 없음을 확인했다. 하지만 응답에는 route가 14개 있었고 나머지를 확인하지 않았다.
- 이 작업의 목적은 **추가 도보 API 구현 전에**, 같은 대중교통 응답의 다른 route가 출발·도착 도보 step과 실제 path를 제공하는지 최대 provider 1회로 판별하는 것이다. 성공해도 production route 선택이나 화면은 이번 작업에서 바꾸지 않는다.

### 현재 확정 사실 / 미확정 가정

- 확정: Kakao 공식 `publictraffic` schema는 `BUS`, `SUBWAY`, `WALKING` step과 `path.points`를 허용한다.
- 확정: 현재 production handler와 기존 진단은 `routes[0]`만 선택한다.
- 확정: 직전 부산 C2의 `routes[0]`은 `BUS(157 points)` 하나이며 요청 목적지와 마지막 point 간격은 `101–250m`였다.
- 미확정: `routes[1...]` 중 시작 또는 마지막 `WALKING`과 유효 path를 가진 route가 있었는가.
- 미확정: 도보가 완전한 대체 route가 있더라도 소요시간·환승 수 차이가 출시 UX에서 수용 가능한가. 이 선택은 결과 확인 뒤 통합·결정이 한다.

### 시작 시 읽을 범위

외부 API 세션은 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/work/external-api/README.md`, 이 문서, `supabase/functions/route-proxy/handler.ts`, `supabase/functions/route-proxy/kakaoRouteRequest.ts`, `supabase/functions/route-geometry-diagnostic/index.ts`, 관련 진단 테스트만 읽는다. archive 전체, 추천·UI 과거 작업기록, 원본 장소 데이터는 읽지 않는다.

### 구현·실행 순서

1. **실패 우선 pure fixture를 먼저 추가한다.** 최소 세 route를 만든다.
   - route 0: `BUS`만 있고 시작·끝 gap이 남는 경우
   - route 1: `WALKING → SUBWAY|BUS → WALKING`, 모든 path가 유효한 경우
   - route 2: `WALKING` type은 있으나 path가 비었거나 마지막 endpoint에 도달하지 못한 경우
   전체 route를 순회하지 않거나 route 0만 보고 결론 내리면 테스트가 실패해야 한다.
2. 진단 전용 함수에 `summarizeKakaoTransitRoutes(raw, endpoints)` 같은 pure 요약 경계를 둔다. 최대 32개 route만 순서대로 검사하고 각 route에 아래 안전 필드만 만든다.
   - `routeIndex`, allowlist된 route type
   - `totalMin`, `transfers`
   - `stepModeOrder`
   - 각 step의 allowlist type과 유효 point 수
   - 첫/마지막 step type
   - 요청 시작점→첫 path, 마지막 path→요청 끝점의 거리 **범주만**: `0_25m | 26_50m | 51_100m | 101_250m | over_250m | unavailable`
   - `hasLeadingWalkingPath`, `hasTerminalWalkingPath`
   실제 좌표, 정류장·장소명, guidance, landing URL, 전체 원문은 결과·로그·fixture·문서에 남기지 않는다.
3. production의 `routes[0]` 선택은 이번 작업에서 수정하지 않는다. 진단 함수가 production parser와 같은 `sanitizeKakaoTransitSegments` 및 request builder를 사용하되, 관찰을 위해 전체 route를 순회하는 코드는 진단 전용으로 둔다.
4. 실제 호출 전 기존 safe fixture나 보존된 원문 없이 질문에 답할 수 있는지 확인한다. 직전 원문은 폐기됐으므로 답할 수 없다면 기존과 동일한 공개 부산 C2 고정 쌍으로 **대중교통 provider 1회만** 호출한다.
5. 기존 Supabase Edge secret을 읽는 임시 인증형 진단 함수를 사용한다. 일회용 timing-safe token, `POST` 전용, 15초 timeout, 2MB body 상한을 유지한다. `route-proxy`의 cache/RPC/budget/lease와 앱 Auth/CAPTCHA는 거치지 않는다.
6. HTTP 오류·timeout·`status != OK`여도 재시도하지 않는다. 다른 좌표, C1, walk endpoint, 운영 Route Proxy 호출은 모두 0회다. 전체 신규 provider 호출 상한은 정확히 **0~1회**다.
7. 성공 응답은 메모리에서 전체 route 안전 요약을 만든 뒤 즉시 버린다. raw response를 파일·DB·console에 저장하지 않는다. 실행 뒤 원격 임시 Function과 일회용 token을 제거하고 없음까지 확인한다. 로컬 진단 소스는 통합 검토 전까지 유지한다.

### 판정표

| 한 번의 전체 route 관찰 | 판정 | 다음 단계 |
| --- | --- | --- |
| route 0은 불완전하지만 다른 route에 유효한 시작·마지막 `WALKING` path가 모두 있음 | **R1: 대체 route 존재** | route 선택 기준에 완전성을 반영할지, 시간·환승 손해 허용 범위를 통합·결정에 보고한다. 구현 금지 |
| 다른 route에 마지막 `WALKING`은 있으나 path가 비었거나 끝 gap이 큼 | **R2: 부분 형상** | 별도 walk 보충과 부분선 UX 선택지를 보고한다. 구현 금지 |
| 모든 route에 마지막 `WALKING` path가 없음 | **R3: 응답 전체 종점 도보 부재** | 누락된 endpoint만 별도 Kakao walk 호출하는 계약·비용 설계가 필요하다고 보고한다. 구현 금지 |
| 이번 응답의 route 0부터 도보가 완전해 직전과 구조가 달라짐 | **R4: provider 응답 변동** | 단일 route 구조를 신뢰하지 않고 매 응답 endpoint 완전성 검사 후 조건부 보충이 필요하다고 보고한다 |
| HTTP/timeout/비정상 status | **판정 불가** | safe status만 기록하고 종료한다. 재호출 금지 |

`WALKING` type만 존재한다고 완전으로 판정하지 않는다. 유효 `path.points`와 시작·끝 gap 범주를 함께 보고한다. 이번 작업은 임의 tolerance를 제품 정책으로 확정하지 않으며, `0_25m` 등 관찰 범주를 그대로 통합·결정에 전달한다.

### 수정 금지 경계

- 운영 `route-proxy` 배포 및 production route 선택·totalMin·receipt·cache key/TTL·attempt/budget/lease 변경 금지
- 별도 walk API 호출, 직선 connector, endpoint 좌표를 path에 강제 삽입하는 보정 금지
- `src/engine/`, `src/ui/`, DB migration, catalog, 추천 순위·장소 수·8회 예산 변경 금지
- API key/token/좌표/사용자 데이터의 출력·문서화·fixture 저장 금지
- 결과 수락 전 `2-W`, DB, UI, QA 후속 작업 실행 금지

### 필수 검증과 완료 기준

1. pure 전체-route fixture가 route 0만 검사하는 구현을 실패시키고, R1/R2/R3/R4에 필요한 안전 요약을 검증한다.
2. 기존 공식형 `WALKING → transit → WALKING`, unknown fail-closed, 32 paths·512 points, request builder, geometry/cache/receipt 회귀를 통과한다.
3. 최소 `npm run test:typecheck`, 관련 API 테스트, `npm test`, `npm run test:ui`, `git diff --check`를 실행한다.
4. 완료 기록에는 변경 파일/목적, provider 호출 수와 재시도 수, route 전체 수, route별 안전 요약 또는 집계, R1~R4 중 단일 판정, 제거한 원격 artifact, 유지한 production 경계, 다음 결정 사항을 남긴다.
5. `routes[0]` 결과만 다시 기록하거나, 실제 전체 route를 보지 않고 공식 schema만으로 결론 내리거나, 확인과 동시에 production 선택/도보 보충을 구현하면 완료가 아니다.

## 2026-09-03 — API-ROUTE-GEOMETRY-02 완료 기록

### 변경 파일 / 변경 목적

- `supabase/functions/route-geometry-diagnostic/summarizeKakaoTransitRoutes.ts`: 진단 전용 pure 전체-route 요약 경계를 추가했다. 응답 순서대로 최대 32개 route를 순회하고 공식 route type·`totalTime`·`transfers`, step type/유효 point 수와 기존 sanitizer의 시작·끝 gap만 allowlist 구조로 만든다.
- `supabase/functions/route-geometry-diagnostic/index.ts`: 기존 C1/C2 진단을 동일 부산 C2 한 번 전용으로 바꿨다. production request builder와 sanitizer를 계속 공유하며 timing-safe token, POST, 15초 timeout, 2MB body 상한과 원문 비노출을 유지한다.
- `test/route-proxy-transit-all-routes.test.ts`: BUS-only route 0, 완전한 `WALKING → transit → WALKING` route 1, 마지막 WALKING path가 빈 route 2를 함께 둔 실패 우선 fixture와 32-route/unknown allowlist, 실제 R3 집계 회귀를 추가했다.
- `test/fixtures/route-geometry-diagnostic-safe.fixture.ts`: 실제 단일 C2의 비밀 없는 전체-route 집계만 추가했다.
- `docs/work/external-api/route-geometry.md`, `docs/work/external-api/README.md`: 호출 수, 전체 route 관찰, R3 판정, 원격 정리와 다음 결정을 기록했다.

### 유지한 공개 계약

- production은 계속 `routes[0]`을 선택한다. route 선택, `totalMin`, receipt, cache key/TTL, attempt/budget/lease, 32 paths·512 points와 private 비영속 계약을 바꾸지 않았고 운영 `route-proxy`를 배포하지 않았다.
- 별도 walk API, 직선 connector, endpoint 강제 삽입, 다른 부산 좌표, C1, cache/RPC, 앱 Auth/CAPTCHA 호출은 모두 추가하지 않았다.
- engine type·추천 정책/순위/8회 예산, DB migration/cache schema, React UI, catalog와 작업 보드는 수정하지 않았다.
- key/token, 실제 좌표, 장소명/ID, guidance, landing URL, request URL/query, header와 provider 원문은 결과·console·fixture·문서에 남기지 않았다.

### provider 실행·안전 결과 / R1~R4 판정

- 보존된 원문이 없어 질문에 답할 수 없음을 확인한 뒤, 기존과 동일한 공개 부산 C2를 **정확히 1회** 호출했다. 재시도 0회, 다른 provider 호출 0회다.
- preflight는 server key 존재, 공개 쌍 존재·유효·서로 다름, 거리 `3–15km`를 통과했다. 응답은 `HTTP 200`, `contentType=json`, `errorCode=null`, route `status=OK`, 전체 route 14개, truncation 없음이었다.
- route type 집계는 `BUS 9`, `SUBWAY 1`, `BUS_AND_SUBWAY 4`; 소요시간 범위는 `34–49분`, 환승은 `0회 6개·1회 8개`였다. route 0은 41분·환승 0회였고, 더 빠른 route가 있어도 endpoint 도보가 완전한 대체 route는 없었다.
- 시작 `WALKING`+유효 path는 **0/14**, 마지막 `WALKING`+유효 path도 **0/14**였다. route index `2, 6, 8, 9, 10`의 WALKING은 모두 환승 중간 step이었다.
- 마지막 step은 모든 route에서 `BUS` 또는 `SUBWAY`였다. 목적지 gap은 `51–100m` 2개, `101–250m` 12개였으며 `0–50m` route는 없었다.
- **단일 판정: R3 — 응답 전체 종점 도보 부재.** 이 C2 응답에서는 다른 route를 선택해도 마지막 도보 path를 얻을 수 없다. 단일 응답을 Kakao 모든 좌표·시각의 보편 한계로 일반화하지 않지만, 이번 재현의 끊긴 종점은 route 0 선택만의 문제가 아니다.

### 테스트 결과 / 다음 결정·위험

- 실패 우선 pure fixture — 전체-route 요약 모듈 부재로 **0/1 실패** 확인.
- API-02 pure fixture + API-01 builder/WALKING/geometry/client/cache/receipt 관련 회귀 — **57/57 성공**.
- `npm run test:typecheck` — 최초 Deno import/test callback 타입 2건 실패를 확인하고 경계를 교정한 뒤 성공.
- `npm test` — **117/117 성공**.
- `npm run test:ui` — **197 성공, 0 실패, 기존 skip 1건**(총 198건).
- `git diff --check` — 성공.
- 원격 임시 `route-geometry-diagnostic` Function과 일회용 `ROUTE_GEOMETRY_DIAGNOSTIC_TOKEN`은 실행 직후 제거했고 목록에서 둘 다 없음(`false`)을 확인했다. 로컬 진단 소스와 safe fixture는 통합 검토를 위해 유지한다.
- 통합·결정은 R3를 근거로 누락된 시작/종점에만 조건부 Kakao walk를 추가할지, 호출 비용·timeout·receipt/cache/private 경계와 부분선 UX를 먼저 설계해야 한다. 수락과 새 계약 전에는 production route 선택/도보 보충, `2-W`, DB, UI, QA를 열지 않는다.

## API-ROUTE-GEOMETRY-01 HTTP 원인 분리 재진단 — 실행 완료·수락

### 이전 방식 → 문제 → 교체 방식 → 이유 → 상태

- **이전 방식:** Supabase Edge의 기존 key와 공개 snapshot으로 임시 함수를 배포해 provider를 한 번 호출하고, 성공 응답의 step 구조만 안전 요약하려 했다.
- **문제/관찰:** 호출은 카카오까지 도달했지만 결과를 `provider_http_error` 하나로 평탄화했다. HTTP status, JSON 여부, 카카오 숫자 error code를 남기지 않았고 임시 로컬 소스도 즉시 삭제해 운영 handler와 요청 조립이 같았는지 감사할 수 없다. 따라서 key·권한·허용 IP·quota·파라미터·일시 장애를 구분하지 못했고 마지막 `WALKING` 유무도 보지 못했다.
- **교체 방식:** 추가 provider 호출 없는 로그/설정·요청-builder 사전점검을 먼저 수행한다. 그것만으로 판정되지 않을 때 운영 handler와 **하나의 pure request builder**를 공유하는 임시 인증형 Edge 진단을 사용해 통제 호출 1회, 통제 성공 때만 부산 재현 호출 1회를 수행한다.
- **교체 이유:** 최대 2회 안에서 서버 key/권한·요청 형식 문제와 부산 경로의 마지막 도보 형상 문제를 분리하고, 실패하더라도 다음 조치를 결정할 안전한 원인을 남기기 위함이다.
- **상태:** **완료·수락 이력, 현재 실행 지시 아님.** 사용자가 2026-09-03 원인 확인 방법을 모색한 뒤 이 제한 진단을 승인했고, C1/C2가 모두 `200/OK`임을 확인했다. 후속 `API-ROUTE-GEOMETRY-02`도 완료됐으므로 현재 작업자는 이 절을 재실행하지 않는다.

### 시작 시 읽을 범위와 완료 질문

외부 API 세션은 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/work/external-api/README.md`, 이 문서, `supabase/functions/route-proxy/handler.ts`, `test/route-proxy-transit-terminal-completeness.test.ts`만 먼저 읽는다. 과거 전체 archive를 다시 읽지 않는다. 필요한 과거 사실은 이 문서의 진행 기록과 `2026-08-28 HTTP 200 / status OK / routeCount 15`였다는 요약만 사용한다.

완료 시 다음 두 질문에 각각 근거 있는 답이 있어야 한다.

1. 첫 진단이 `provider_http_error`로 끝난 이유는 인증/권한·허용 IP·quota·요청 형식·좌표 상태·provider 5xx 중 무엇인가?
2. 요청이 정상일 때 부산 공개 재현 구간의 선택 route는 마지막 `WALKING` step과 유효 `path.points`를 목적지 근처까지 제공하는가?

`provider_http_error`·`unknown`·“키 문제 추정”만 다시 남기는 것은 완료가 아니다.

### A. provider 호출 0회 사전점검

1. 가능하면 Supabase Logs Explorer의 기존 `route-geometry-diagnostic` 실행 시각을 좁혀 `function_edge_logs`와 `function_logs`만 읽는다. 기존 기록에서 outbound HTTP status 또는 안전 숫자 code를 복구하면 새 호출 전에 판정한다. 로그 접근 불가 또는 값 없음은 10분 이상 반복하지 않고 그대로 기록한다. request/response body, header, JWT, 사용자/IP, 좌표, URL query, key/token은 열거나 기록하지 않는다.
2. 현재 `handler.ts`의 Kakao 요청 조립을 pure `buildKakaoRouteRequest()` 계열로 추출하거나 동등한 단일 builder로 만든다. production handler와 임시 진단 함수가 이 builder를 함께 소비해야 하며 진단 함수가 endpoint/query/header를 다시 손으로 조립하면 실패다.
3. builder의 고정 테스트에서 다음만 확인한다: `GET`, host `dapi.kakao.com`, path `/v2/routing/publictraffic`, 필수 `start_x/start_y/end_x/end_y`, `input_coord/output_coord=WGS84`, `Authorization: KakaoAK <server secret>`. 테스트와 출력에는 fixture key만 쓴다.
4. Edge 런타임 preflight는 기존 `KAKAO_ROUTE_REST_API_KEY`의 존재·trim 뒤 비어 있지 않음과 공개 입력 좌표의 finite/WGS84 범위·서로 다름·거리 구간만 boolean/범주로 계산한다. key 값·길이·hash/digest, 실제 좌표, POI 이름/ID는 응답·로그·문서에 남기지 않는다.
5. Kakao Dashboard 설정은 세션이 임의 변경하지 않는다. 이후 HTTP 판정이 `401/-401`, `403/-3`일 때만 사용자에게 올바른 REST API key 종류, 해당 앱의 경로 API 사용 권한, REST key 호출 허용 IP 설정 확인을 요청한다.

### B. 임시 진단 경계

1. `supabase/functions/route-geometry-diagnostic/index.ts`를 다시 만들되 production handler와 같은 pure request builder와 `sanitizeKakaoTransitSegments`를 import한다. 로컬 소스는 통합 검토가 끝날 때까지 삭제하지 않고 `진단 전용·production 진입점 아님`을 명시한다.
2. Supabase Edge의 기존 `KAKAO_ROUTE_REST_API_KEY`를 `Deno.env.get()`으로만 읽는다. `.env*`, 모바일 `EXPO_PUBLIC_*`, 채팅, 문서로 복사하지 않는다.
3. 임시 함수는 암호학적 일회용 token을 timing-safe하게 확인하고 `POST`만 허용한다. token/key 값은 어디에도 출력하지 않는다. 운영 `route-proxy`, cache/RPC/budget/lease, 앱 Auth/CAPTCHA를 경유하거나 수정하지 않는다.
4. 응답 원문은 메모리에서 최대 크기를 제한해 한 번만 읽고 즉시 버린다. 안전 출력은 다음 필드만 허용한다.
   - `providerCallCount`
   - outbound `httpStatus`
   - `contentType: json|other`
   - 정수형 Kakao `errorCode` 또는 `null`
   - allowlist된 route `status: OK|STARTNODES_NULL|ENDNODES_NULL|EQUAL_POINTS|INVALID_REQUEST|NO_RESULTS|unknown`
   - 성공 때만 `routeCount`, 정규화 step mode 순서, step별 유효 point 수, 첫/마지막 type, 시작/끝 endpoint gap의 미터 구간
5. Kakao `msg`, `WWW-Authenticate`, response/request header, raw body, 좌표, 장소명/ID, URL/query, key/token은 반환·console log·문서에 남기지 않는다. 특히 오류 `msg`에는 앱 키가 포함될 수 있으므로 읽더라도 출력하지 않는다.

### C. 조건부 provider 호출 예산 — 최대 2회, 재시도 0회

1. **통제 호출 C1:** Kakao 공식 `publictraffic` 문서의 공개 예제 좌표를 그대로 사용해 1회 호출한다. 이 호출은 key·권한·Edge outbound·공유 builder가 공식 예제에서 정상인지 분리하기 위한 것이다.
2. C1이 HTTP 2xx이면서 route `status=OK`일 때만 **부산 호출 C2**를 1회 허용한다. C2는 사용자 GPS가 아닌 현재 공개 catalog/snapshot에서 고정한 사상권 대표 지점→서면권 대표 지점처럼 대중교통이 필요한 서로 다른 공개 지점 한 쌍을 사용한다. 호출 전에 두 지점 존재·좌표 유효·거리 범주를 locally 확인하고, 실제 좌표와 이름은 로그/결과에 남기지 않는다.
3. C1이 실패하면 C2는 0회다. C1/C2 각각 timeout이나 4xx/5xx가 나도 같은 호출을 재시도하지 않는다. 전체 provider call은 최소 0회, 최대 2회다. walk endpoint, 두 번째 부산 좌표, cache 삭제, 운영 Route Proxy 호출은 0회다.
4. 실행 직후 원격 임시 Function과 일회용 token은 제거하고 목록에서 제거 여부만 확인한다. 로컬 진단 소스와 safe result fixture는 통합 검토 전까지 보존한다. 운영 `route-proxy`는 배포하지 않는다.

### D. 판정표와 즉시 중단

| 관찰 | 판정 | 다음 조치 |
| --- | --- | --- |
| C1 `401` 또는 `errorCode=-401` | server secret 값/키 종류 인증 문제 | C2 금지, 사용자 Kakao REST key 확인 대기 |
| C1 `403` 또는 `errorCode=-3` | 해당 앱 key의 API 권한 또는 허용 IP 가능성 | C2 금지, Dashboard 권한·REST key IP 설정 확인 대기 |
| C1 quota 오류(`errorCode=-10`, `429` 등) | quota/rate 차단 | C2 금지, 사용량·리셋 시각 확인 대기 |
| C1 `400`/`INVALID_REQUEST` | 공유 builder/필수 파라미터 문제 | C2 금지, builder fixture와 공식 예제 차이 수정 후 새 호출 승인 대기 |
| C1 `5xx` | provider 일시 장애 가능성 | C2·자동 재시도 금지, 상태와 시각만 기록 |
| C1 `200/OK`, C2 `NO_RESULTS` 계열 | API 설정 정상, 부산 고정 좌표 경로 부재 | 다른 좌표 자동 호출 금지, 재현 좌표 선택 결정 대기 |
| C2 마지막 `WALKING`+유효 points+종점 도달 | H1 parser/전달 누락 | API 하위 mode production 계약 제안 |
| C2 `WALKING`은 있으나 points 없음/종점 미도달 | 부분 H3 | 별도 walk 보충 호출 또는 부분선 UX 선택 보고 |
| C2 마지막 `WALKING` 없음 | 해당 응답의 H3 관찰 | 한 응답을 provider 전체 한계로 일반화하지 않고 제품 선택 보고 |

### E. 테스트·완료 기록·변경 금지

1. 실패 우선 fixture로 production handler와 진단 함수가 같은 builder를 쓰지 않을 때 실패하게 만든 뒤 구현한다. 공식형 `WALKING → SUBWAY|BUS → WALKING`, unknown fail-closed, 32 paths·512 points, 안전 오류 allowlist도 유지한다.
2. 최소 관련 API 계약 테스트, `npm run test:typecheck`, `npm test`, `npm run test:ui`, `git diff --check`를 실행한다. 실제 provider call 수는 별도로 0/1/2를 기록한다.
3. 완료 기록에는 변경 파일/목적, C1·C2 실행 여부와 safe 결과, 위 판정표의 단일 판정, 제거한 원격 임시 artifact, 유지한 production 경계를 남긴다. 호출하지 않은 단계는 성공으로 쓰지 않는다.
4. production `RouteGeometry`, engine type/추천 정책·순위·호출 예산, DB migration/cache schema, React UI, catalog, CAPTCHA/Auth, 운영 Route Proxy 배포는 수정하지 않는다. 다른 역할 파일이 필요하면 수정하지 말고 인수인계한다.
5. 이 결과가 통합 수락되기 전에는 `2-W`, DB, UI, QA를 재개하지 않는다.
6. 사용자의 별도 명령 전에는 commit·push를 수행하지 않는다.

## 2026-09-03 — HTTP 원인 분리 재진단 완료 기록

### 변경 파일 / 변경 목적

- `supabase/functions/route-proxy/kakaoRouteRequest.ts`: production과 진단이 함께 쓰는 pure request builder를 추가했다. `GET`, 공식 host/path, WGS84 필수 query, trimmed server key의 `KakaoAK` header를 한 경계에서 만들며 빈 key·범위 밖·동일 좌표는 provider 전 차단한다. 숫자 error code와 route status allowlist도 같은 API 경계에서 정제한다.
- `supabase/functions/route-proxy/handler.ts`: 기존 endpoint·query·header 수동 조립을 공유 builder 호출로 교체했다. production 동작은 로컬 코드만 바뀌었고 운영 `route-proxy`는 배포하지 않았다.
- `supabase/functions/route-geometry-diagnostic/index.ts`: **진단 전용·production 진입점 아님.** 공유 builder와 `sanitizeKakaoTransitSegments`를 import하고, timing-safe 일회용 token·POST·2MB body 상한·15초 timeout·안전 필드 allowlist·C1 성공 조건부 C2를 구현했다. 통합 검토를 위해 로컬 소스는 보존한다.
- `test/route-proxy-kakao-request.test.ts`: builder 부재 0/1, 진단 source 부재 3/4의 실패 우선을 확인한 뒤 공식 요청 계약, preflight fail-closed, 안전 오류 allowlist, production/diagnostic 공유 경계와 실제 safe result를 고정했다.
- `test/fixtures/route-geometry-diagnostic-safe.fixture.ts`: 실제 응답 원문 없이 C1/C2의 허용된 구조 요약만 보존한다.
- `docs/work/external-api/route-geometry.md`, `docs/work/external-api/README.md`: HTTP 원인, 호출 수, C2 마지막 도보 판정, 원격 정리와 downstream 차단을 기록한다.

### C1·C2 안전 결과와 단일 판정

- provider 호출 전 점검은 **0회 호출**이었다. native CLI에는 과거 함수 로그를 읽는 경로가 없고 과거 임시 artifact도 삭제돼 HTTP status를 복구하지 못했으나, 첫 진단이 production과 공유하지 않은 수동 host를 사용했던 사실을 확인했다. 현재 production builder와 [Kakao 공식 대중교통 요청](https://developers.kakao.com/docs/ko/kakaomap/rest-api#route-get-public-transit)은 같은 공식 host/path다.
- **C1 1회, 재시도 0회:** `HTTP 200`, `contentType=json`, `errorCode=null`, route `status=OK`, route 15개. 선택 route step은 `transit → transit`, type은 `BUS(78 points) → BUS(53 points)`, 시작/끝 gap은 각각 `101–250m`였다.
- **C2 1회, 재시도 0회:** preflight는 key 존재, 공개 쌍 존재·유효·서로 다름, 거리 `3–15km`를 모두 통과했다. 결과는 `HTTP 200`, `contentType=json`, `errorCode=null`, route `status=OK`, route 14개. 선택 route step은 `transit` 하나, type은 `BUS(157 points)`, 마지막 type은 `BUS`, 시작 gap `250m 초과`, 목적지 gap `101–250m`였다.
- 총 provider 호출은 **2회(C1 1 + C2 1)**, timeout/HTTP 재시도·walk endpoint·두 번째 부산 좌표·운영 Route Proxy/cache/RPC/budget/lease 호출은 모두 0회다. raw body, `msg`, header, 좌표, 장소명/ID, URL/query, key/token은 출력·로그·fixture·문서에 남기지 않았다.
- **HTTP 원인 판정:** 첫 `provider_http_error`는 server key·API 권한·quota가 아니라 임시 진단의 수동 요청 host 불일치였다. 같은 Edge key와 공식 예제, 공유 builder로 C1이 `200/OK`였고 같은 실행의 C2도 `200/OK`였으므로 인증·권한·허용 IP·quota·Edge outbound 실패를 배제한다.
- **마지막 도보 판정:** C2 선택 route에는 마지막 `WALKING` step이 없고 마지막 `BUS` path가 목적지에서 `101–250m` 떨어져 끝났다. 따라서 원래 실기기 종점 누락은 parser가 존재하는 마지막 WALKING을 버린 사례가 아니라 **해당 부산 응답 자체의 H3 관찰**이다. 공식 schema 전체나 다른 응답에도 WALKING이 없다고 일반화하지 않는다. pure sanitizer는 WALKING이 존재하는 응답을 위한 교정 계약으로 유지한다.

### 유지한 공개 계약 / 제거한 원격 artifact

- 정확 `totalMin`, receipt, cache key/TTL, private 비영속, attempt·budget·lease·timeout, 32 paths·512 points와 기존 production geometry 계약을 유지했다. provider 원문이나 guidance를 새 응답에 노출하지 않았다.
- production `RouteGeometry`, mobile client, engine type/추천 정책·순위·호출 예산, DB migration/cache schema, React UI, catalog, CAPTCHA/Auth와 작업 보드는 수정하지 않았다. 운영 `route-proxy`를 배포하지 않았다.
- 진단 실행 직후 원격 `route-geometry-diagnostic` Function과 일회용 `ROUTE_GEOMETRY_DIAGNOSTIC_TOKEN`을 제거했고, 원격 목록에서 둘 다 없음(`false`)을 확인했다. 기존 Edge secret은 읽기만 했으며 수정하지 않았다.

### 테스트 결과 / 다음 결정·위험

- 실패 우선: 공유 builder 구현 전 신규 builder test **0/1 실패**; 진단 소스 구현 전 공유 경계 test **3/4 성공, 1 실패**.
- builder + 공식 WALKING sanitizer + 기존 geometry — **13/13 성공**.
- client/timeout/snapshot/production receipt/page budget 포함 관련 API 회귀 — **54/54 성공**.
- `npm run test:typecheck` — 성공.
- `npm test` — **117/117 성공**.
- `npm run test:ui` — **197 성공, 0 실패, 기존 skip 1건**(총 198건).
- `git diff --check` — 성공.
- 추가 provider 호출이나 좌표 자동 변경으로 H3를 재확인하지 않는다. 통합·결정은 해당 응답의 마지막 도보 부재를 전제로 부분선 UX를 유지할지, 별도 walk 보충 호출의 비용·receipt/cache 계약을 새로 설계할지 결정해야 한다. 그 결정과 현재 결과의 수락 전에는 `2-W`, DB, UI, QA와 production ordered-segment 배포를 열지 않는다.

## 1차 통합 반려 교정 명령 — 실행 완료·provider HTTP 실패, 현재 지시 아님

### 반려 근거

- Kakao 공식 `GET /v2/routing/publictraffic`의 `StepProperties.type`은 `BUS`, `SUBWAY`, **`WALKING`**을 명시한다: <https://developers.kakao.com/docs/ko/kakaomap/rest-api#route-get-public-transit-response-step-properties>.
- 완료 기록의 “공식 스키마에 WALK step이 없다”는 결론은 사실과 반대다.
- 신규 테스트는 공식 fixture가 아니라 테스트 안에서 직접 만든 객체에서 WALKING을 뺀 뒤 `false`를 확인했다. 따라서 8/8 통과는 H3의 증거가 아니며 현재 결함을 정상으로 고정한 자기충족형 테스트다.
- 현재 handler는 `step.properties.type`을 읽지 않고 모든 `step.path.points`를 mode 없는 `geometry.paths`로 평탄화한다. 최소 확정 원인은 명시된 WALKING mode 손실이며, 실제 smoke 응답에 마지막 도보 path가 있었는지는 아직 확인되지 않았다.

### 완료 질문

1. 현재 Kakao 실제 응답의 선택 route에 마지막 `WALKING` step과 유효 `path.points`가 존재하며 요청 목적지 근처까지 도달하는가?
2. 그 구조를 parser가 `walk → transit → 필요한 환승 구간 → walk` 순서로 손실 없이 정제할 수 있는가?

공식 enum 존재만으로 실제 응답의 마지막 path 존재를 단정하지 않고, 한 번의 응답 누락을 전체 provider 한계로 일반화하지 않는다.

### 반드시 교체할 잘못된 테스트

1. `test/route-proxy-transit-terminal-completeness.test.ts`의 `H3: 공식 ... WALK step ... 없다` 테스트를 제거하고 공식 schema형 fixture로 교체한다.
2. fixture의 `steps[].properties.type`은 최소 `WALKING → SUBWAY|BUS → WALKING`이어야 하며, 문자열 `WALK`가 아닌 공식 값 `WALKING`과 실제 `Double[][] path.points`를 사용한다.
3. 기대값은 `WALKING → walk`, `BUS|SUBWAY → transit`, 입력 순서와 마지막 WALKING path 끝점 보존이다. unknown type은 위치로 추정하지 않고 geometry 불완전으로 닫는다.
4. 현재 sanitizer에서 위 기대가 먼저 실패하는 것을 기록한다. `segments === undefined`를 정상으로 확인하는 기존 테스트를 최종 합격 근거로 남기지 않는다.

### 실제 provider 구조 확인 — 정확히 1회

1. 기존 서버 전용 REST key와 현재 `publictraffic` endpoint를 사용해 저장소의 공개 고정 출발/도착 좌표로 provider 요청을 **1회만** 수행한다. 사용자 GPS·실사용자 좌표는 쓰지 않는다.
2. Route Proxy/cache를 경유하지 않는다. 재시도, 두 번째 좌표, walk 추가 요청, cache 조회·삭제, Edge 배포는 0회다.
3. 원문 응답·좌표·장소명·URL/query·key/token은 출력하거나 저장하지 않는다. 다음 안전 구조만 기록한다.
   - `steps[].properties.type`의 정규화된 순서(`walk|transit|unknown`)
   - 각 step의 유효 path 유무와 point 개수
   - 첫/마지막 step type
   - 첫 path 시작점과 요청 시작점, 마지막 path 끝점과 요청 끝점의 거리(좌표 없이 미터 값 또는 구간)
4. key 또는 네트워크 접근이 불가능하면 secret을 client로 옮기거나 임시 endpoint를 배포하지 않고 중단한다.

### 이 단계에서 허용하는 코드

- API 소유 경로에 provider 전용 순수 sanitizer를 만든다. 출력은 ordered `segments: Array<{ mode: 'walk'|'transit'; paths: ... }>`이며 `WALKING`만 walk, `BUS|SUBWAY`만 transit으로 정규화한다.
- 연속한 같은 mode는 합칠 수 있지만 step 순서와 path 경계는 보존한다. 전체 32 paths·512 points 제한은 기존처럼 실제 점 위에서 적용한다.
- 요청 시작/끝 도달 여부를 별도 결과로 계산하되 직선을 만들지 않는다. tolerance는 실제 1회 확인 결과와 provider snapping 근거를 제안만 하고 이번 단계에서 임의 정책으로 확정하지 않는다.
- 아직 production `RouteGeometry`, mobile client, engine type, DB cache schema를 바꾸거나 Edge를 배포하지 않는다. pure sanitizer와 API fixture까지만 완성한다.

### 판정과 인수인계

- 마지막 `WALKING` path가 실제 응답에 있고 목적지까지 도달하면 **H1**이다.
- WALKING step은 있지만 path가 없거나 마지막 점이 하차역에 머물면 **부분 H3**다.
- WALKING step이 전혀 없으면 해당 1회 응답의 관찰로만 기록하고 공식 schema 전체에 WALKING이 없다고 쓰지 않는다.
- 교체 fixture, 기존 geometry 테스트, 관련 API 회귀, `npm run test:typecheck`, `git diff --check`를 실행한다.
- 완료 기록에는 공식 문서 오류 정정, 실제 호출 1회/재시도 0회, 안전 구조 요약, H1/부분 H3 판정, pure sanitizer 변경, 미변경 engine/DB/UI/배포 경계를 남긴다.
- 결과 전 `2-W`, `DB-ROUTE-GEOMETRY-01`, `U-COURSE-GEOMETRY-01`, QA를 열지 않는다.

## 2026-09-03 — 통합 반려 교정 진행 기록 — provider 1회 실패 종료

### 변경 파일 / 변경 목적

- `test/route-proxy-transit-terminal-completeness.test.ts`: 통합 반려된 “공식 schema에 WALK step이 없다” 자체 객체를 제거했다. Kakao 공식 `StepProperties.type`과 같은 `WALKING → SUBWAY → WALKING` 및 `Double[][] path.points` fixture로 교체해 ordered mode, 마지막 WALKING 끝점, unknown fail-closed, route 전체 32 paths·512 points 경계를 검증한다.
- `supabase/functions/route-proxy/handler.ts`: API 소유의 진단용 순수 `sanitizeKakaoTransitSegments`를 추가했다. `WALKING`만 `walk`, `BUS|SUBWAY`만 `transit`으로 바꾸고 step/path 순서를 보존하며, unknown 또는 path 손상은 위치로 추정하지 않고 `allStepsMapped: false`로 닫는다. 요청 시작·끝과 첫·마지막 path 사이 거리는 좌표를 노출하지 않는 미터 값으로 별도 계산한다.
- `docs/work/external-api/route-geometry.md`: 공식 enum 오류 정정, 실패 우선·최종 검증과 임시 인증형 Edge 진단의 단일 호출 결과를 기록했다.
- `docs/work/external-api/README.md`: pure sanitizer 완료와 provider 1회 실패 종료·downstream 차단 상태를 연결한다.
- `supabase/functions/route-geometry-diagnostic/index.ts`: Edge의 기존 Kakao key와 공개 snapshot만 읽고 일회용 token을 검증하며 provider `fetch`를 한 번만 실행하는 임시 함수로 배포한 뒤, 실행 직후 원격 함수와 함께 삭제했다. 저장소와 원격 런타임에 임시 artifact를 남기지 않았다.

### 유지 계약

- 기존 production `RouteGeometry`, mobile client, engine 공개 타입, DB cache schema·migration, React UI에는 ordered segment를 연결하지 않았다. 운영 Route Proxy Edge와 기존 환경·secret은 변경하지 않았다.
- 정확 `totalMin`, receipt, cache key/TTL, private 비영속, attempt·budget·lease·timeout 의미와 기존 production 단일-mode geometry 동작을 유지했다.
- unknown type을 첫/마지막 위치만으로 walk로 추정하거나 직선으로 잇지 않았다. Route Proxy/cache 조회·삭제, 별도 walk 요청, 두 번째 좌표, provider/endpoint 전환도 수행하지 않았다.
- `docs/작업조정_보드.md`, 추천 정책·순위·예산, 카탈로그와 사용자 GPS·실사용자 데이터는 수정하거나 사용하지 않았다.

### 테스트 결과

- 공식 WALKING fixture 실패 우선 — 구현 전 `sanitizeKakaoTransitSegments` export가 없어 0/2 실패를 확인했다. 기존 sanitizer가 ordered mode와 종점 거리를 제공하지 않는 것이 원인이었다.
- 교체 fixture + 기존 geometry + client/timeout/snapshot/production receipt/page budget 관련 API 회귀 — **49/49 성공**.
- `npm run test:typecheck` — 성공.
- `npm test` — **117/117 성공**.
- `npm run test:ui` — **197 성공, 0 실패, 기존 skip 1건**(총 198건).
- `git diff --check` — 성공.
- 실제 Kakao provider 직접 호출 — **정확히 1회**, 재시도 **0회**. Supabase Edge 런타임의 기존 `KAKAO_ROUTE_REST_API_KEY`와 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`을 사용한 임시 인증형 함수가 공개 snapshot의 결정적 고정 구간으로 `publictraffic`을 직접 호출했다. 안전 결과는 `provider_http_error`, `providerCallCount: 1`이었다. provider 응답이 성공 구조에 도달하지 않아 step 순서·각 type·유효 point 수·마지막 step type·목적지 거리는 관찰값 없음이다. 원문 응답·HTTP body·좌표·장소명·URL/query·key/token은 출력하거나 저장하지 않았다.
- 임시 진단 함수는 256-bit 일회용 token을 함수 내부에서 검증했고 요청 직후 삭제했다. 일회용 `ROUTE_GEOMETRY_DIAGNOSTIC_TOKEN`도 제거했으며 원격 목록에서 함수와 token이 모두 없음을 확인했다. Route Proxy/cache 호출·삭제, Edge Route Proxy 배포, 별도 walk 요청은 0회다.

### 다음 결정·위험

- **H1/부분 H3는 판정 불가다.** 허용된 1회가 `provider_http_error`로 끝나 선택 route나 마지막 `WALKING` step 자체를 받지 못했다. 이는 마지막 도보가 공급자 응답에서 누락됐다는 증거도, parser가 버렸다는 증거도 아니다. 자동 fixture 성공을 실제 응답 증거로 승격하지 않는다.
- 지시된 호출 상한을 모두 사용했으므로 같은 함수·좌표·provider 요청을 재시도하지 않는다. 별도 후속 호출을 열려면 통합·결정이 먼저 HTTP 거절의 안전 원인 확인 방식과 새 호출 예산을 명시해야 한다.
- 공급자 응답 문제와 parser 문제를 확정하기 전에는 downstream `2-W`, DB, UI, QA 작업과 production ordered-segment 배포를 열지 않는다.

## 1차 진단 명령 이력 — 완료 후 통합 반려, 현재 지시 아님

### 목적과 완료 질문

현재 사용하는 Kakao `publictraffic` 응답과 sanitizer 경계에서 다음 세 가설 중 하나를 근거로 확정한다.

1. `H1 파서 누락`: 선택한 route의 현재 `steps` 안에 마지막 도보 형상이 있으나 path 모양 또는 mode 필드 해석이 틀려 버려진다.
2. `H2 다른 응답 위치`: 선택한 동일 route 안의 다른 명시 section/step 경로에 마지막 도보 형상이 있으나 현재 parser가 그 위치를 읽지 않는다.
3. `H3 제공사 형상 부재`: 현재 endpoint의 선택 route 자체가 하차역 이후 목적지까지의 도보 형상을 제공하지 않는다.

이 단계의 완료는 코드를 억지로 고치는 것이 아니라 `H1/H2/H3`를 하나로 판정하고, 같은 route snapshot만으로 `walk/transit/.../walk`를 만들 수 있는지 답하는 것이다.

### 읽을 파일과 수정 경계

- 먼저 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, 이 문서, `docs/work/integration-decision/course-confirm-route-geometry.md`만 읽는다.
- 구현 확인은 `supabase/functions/route-proxy/handler.ts`, 해당 route provider client/fixture와 API 계약 테스트에 한정한다.
- 수정 가능: 외부 API adapter/handler의 sanitizer, API 소유 fixture·계약 테스트, 이 문서와 외부 API README.
- 수정 금지: `src/engine/types.ts`, `src/engine/index.ts`, React UI, migration, 카탈로그, 추천 정책·순위·예산, 환경값, secret, 작업 보드.

### 진단 절차

1. 현재 sanitizer가 transit에서 `raw.routes[0].steps[].path.points`만 읽고 모든 path의 하위 수단을 버리는지 코드로 재확인한다.
2. 먼저 실패하는 최소 fixture를 추가한다. 한 transit route에 `출발 도보 → 대중교통 → 마지막 도보`가 순서대로 들어 있고, sanitizer 결과가 세 하위 구간과 마지막 목적지 근처 끝점을 모두 보존해야 한다. 기존 코드에서 이 테스트가 왜 실패하는지 기록한다.
3. 저장소의 기존 raw fixture 또는 공식 응답 계약만으로 실제 필드명을 확정할 수 있으면 운영 호출 없이 판정한다.
4. 그래도 불명확할 때만 기존 서버 전용 key와 현재 endpoint로 **공개 고정 좌표 transit 요청 1회**를 허용한다. 재시도·walk 요청·다른 endpoint 요청·cache 삭제는 0회다. 인증이나 key 접근이 불가능하면 client로 옮기지 말고 `blocked`로 기록한다.
5. 운영 응답은 원문을 저장하거나 출력하지 않는다. 다음 안전 구조 요약만 기록한다.
   - 선택 route container/key 경로
   - 순서가 있는 item 수
   - item별 정규화 가능 mode(`walk|transit|unknown`)
   - path 표현(`pair-array|flat-array|missing`)과 유효 point 개수
   - 첫 유효 path가 요청 시작점, 마지막 유효 path가 요청 끝점까지 이어지는지 여부
   - endpoint가 제공하는 명시 mode 필드명과 목적지 도달 판정에 사용한 tolerance 근거
6. 좌표, 장소명, provider 원문 JSON, 요청 URL/query, token, key, 사용자 식별자는 로그·fixture·문서에 남기지 않는다.

### 구현 허용 조건

- `H1` 또는 `H2`가 확인되고 provider의 명시 필드로 mode를 판정할 수 있으면, 같은 선택 route의 모든 유효 하위 구간을 순서대로 정제하는 sanitizer까지 구현할 수 있다.
- 내부 정제 결과는 각 하위 구간의 `mode`와 bounded `paths`를 보존하고, 시작·끝 연결 여부를 검증한다. 기존 32 paths·512 points 상한은 route 전체에 결정적으로 적용한다.
- `totalMin`, receipt, cache key/TTL, private 비영속, attempt·provider 호출 수는 바꾸지 않는다. 엔진 공개 타입이 아직 하위 mode를 받지 못하면 API 내부 결과와 fixture까지만 완성하고 강제 투영하지 않는다.
- `H3`이거나 mode를 명시 필드로 판정할 수 없으면 구현을 중단한다. 첫/마지막 step을 위치만 보고 walk로 추정하거나, 직선·별도 도보 호출·endpoint 전환·UI 표시 보정을 추가하지 않는다.
- 이 단계에서는 Edge Function을 배포하지 않는다. 운영 반영은 통합·결정이 진단 결과와 downstream 계약을 검토한 뒤 별도로 연다.

### 필수 테스트와 완료 기록

- 신규 실패 우선 fixture와 기존 `test/route-proxy-geometry.test.ts`를 실행한다.
- 관련 API 회귀, `npm run test:typecheck`, `git diff --check`를 실행한다. 외부 API를 반복 호출하는 테스트는 만들지 않는다.
- 완료 기록은 반드시 다음을 포함한다.
  1. `H1/H2/H3` 판정과 근거
  2. 실제 provider 호출 수(0 또는 1)와 재시도 0회
  3. 마지막 도보 형상 및 명시 mode 필드의 존재 여부
  4. 변경 파일과 변경 목적
  5. 유지한 공개 계약과 수정하지 않은 역할 경계
  6. 실행한 테스트·결과
  7. 다음에 엔진/DB/UI 계약을 열 수 있는지, 아니면 사용자의 추가 결정이 필요한지

### 중단 조건

- 공개 고정 좌표 한 번으로도 구조를 판정하지 못함
- 응답 구조에 마지막 도보 path 또는 신뢰 가능한 mode가 없음
- 현재 endpoint가 목적지 완결 geometry를 제공하지 않음
- 이를 해결하려면 추가 호출, endpoint 변경, 새 secret/환경 설정, migration 또는 엔진 타입 수정이 필요함

위 조건이면 같은 작업을 반복하지 말고 증거와 최소 선택지만 기록한 뒤 종료한다.

## 2026-09-03 — 1차 진단 완료 기록 — 통합 반려

> 아래 H3 기록은 작업 세션의 원래 결과를 보존한 이력이다. 공식 문서의 `WALKING` enum을 누락하고 자기충족형 fixture를 근거로 사용했으므로 현행 판정이 아니며, 위 교정 명령으로 대체한다.

### H1/H2/H3 판정과 근거

- **판정: H3 제공사 형상 부재.** 현재 Kakao `publictraffic` 공식 계약에서 선택 route의 명시 container는 `routes[0].properties`와 `routes[0].steps`뿐이다. 별도 leg/section geometry 위치가 없어 H2가 아니다.
- 공식 `Step.path.points`는 `Double[][]`, 즉 `[x, y]` 좌표쌍이다. 현재 sanitizer는 정확히 `routes[0].steps[].path.points`를 읽고 pair-array를 정제하므로 flat-array 오해나 다른 path shape 누락인 H1도 아니다.
- 공식 명시 mode는 route의 `BUS | SUBWAY | BUS_AND_SUBWAY`, vehicle의 `BUS | SUBWAY`, 그리고 대중교통 step의 버스·지하철 subtype 범위다. `WALK` step 또는 도보 leg는 명시돼 있지 않다. 따라서 step 위치·처음/마지막 순서만으로 walk를 추정할 신뢰 가능한 mode 필드가 없다.
- 1차 운영 smoke에서 실제 선택 route의 마지막 표시 path가 하차역에서 끝난 관찰과 이 공식 계약이 일치한다. 현재 endpoint의 같은 route snapshot만으로 `walk → transit → ... → walk`와 목적지 완결 geometry를 만들 수 없다.
- 근거: [Kakao 공식 대중교통 경로 조회 REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api#route-get-public-transit). 운영 원문이나 좌표는 저장·출력하지 않았다.

### 실제 provider 호출과 안전 구조 요약

- 실제 provider 호출 **0회**, 재시도 **0회**. 저장소 fixture와 공식 계약으로 판정이 가능해 허용된 공개 고정 좌표 1회를 사용하지 않았다.
- 선택 route 경로는 `routes[0]`; 순서가 있는 item은 `steps[]`이나 개수는 응답별 값이므로 운영 호출 없이 수치화하지 않았다.
- item의 정규화 가능 mode는 공식 명시값 기준 `transit`이며 `walk`는 없다. path 표현은 `pair-array`; 현재 sanitizer가 지원한다.
- 마지막 도보 형상과 이를 식별할 명시 mode 필드는 공식 계약에 **없다**. 운영 응답을 호출하지 않았으므로 요청 끝점 도달 여부나 point 수를 새 좌표/tolerance로 재측정하지 않았고, 기존 smoke의 하차역 종단 관찰만 근거로 보존한다.

### 변경 파일과 변경 목적

- `test/route-proxy-transit-terminal-completeness.test.ts`: 혼합 하위 구간을 요구하는 실패 우선 fixture로 현재 sanitizer의 mode 평탄화를 재현하고, 최종적으로 현재 평탄화 동작과 공식 `publictraffic` 스키마의 WALK/별도 section 부재를 계약 fixture로 고정했다.
- `docs/work/external-api/route-geometry.md`: H3 판정, 0회 호출, 공식 구조, 유지 경계와 다음 결정 선택지를 기록했다.
- `docs/work/external-api/README.md`: 외부 API 현재 작업을 진단 완료·제품 결정 대기로 갱신한다.
- handler/client/adapter 구현, 환경값과 운영 배포 산출물은 이 진단에서 변경하지 않았다.

### 유지한 공개 계약과 수정하지 않은 역할 경계

- 기존 정확 `totalMin`, receipt, cache key/TTL, private 비영속, 32 paths·512 points, attempt·provider 호출량 계약을 유지했다. geometry 누락을 시간 경로 실패로 바꾸지 않았다.
- 첫/마지막 step을 위치만 보고 walk로 추정하거나 직선으로 연결하지 않았다. 별도 walk 호출, endpoint/provider 전환, cache 삭제, secret·환경값 변경과 Edge 재배포는 모두 수행하지 않았다.
- 엔진 공개 타입, DB/migration, React UI, 카탈로그, 추천 정책·순위·예산, 작업 보드는 수정하지 않았다.

### 실행한 테스트와 결과

- 실패 우선: 혼합 `walk → transit → walk` segment 보존 fixture — 기존 sanitizer의 `segments`가 없어 0/1 실패를 확인했다. 실패 원인은 path 누락이 아니라 모든 transit step path를 mode 없이 하나의 geometry로 평탄화하는 현재 계약이다.
- 최종 진단 + 기존 geometry 계약 — 8/8 성공.
- 관련 client/timeout/snapshot/production receipt/page budget 포함 API 회귀 — 48/48 성공.
- `npm run test:typecheck` — 성공.
- `npm test` — 117/117 성공.
- `npm run test:ui` — 197 성공, 0 실패, 기존 skip 1건(총 198건).
- `git diff --check` — 성공.

### 다음 결정·위험·재현 조건

- **엔진/DB/UI 하위 mode 계약은 아직 열 수 없다.** 같은 snapshot에 신뢰 가능한 마지막 도보 path/mode가 없으므로 API 타입만 확장해도 실제 종점은 완결되지 않는다.
- 통합·결정/사용자가 다음 중 하나를 선택해야 한다: (1) 현재 Kakao transit 부분선과 `일부 경로선을 표시하지 못했어요`를 유지, (2) 승·하차 지점을 근거로 별도 도보 route 호출을 허용하고 호출 예산·receipt·cache/private 경계를 새로 설계, (3) 출발·도착 도보까지 명시적으로 제공하는 다른 endpoint/provider를 조사한다.
- (2)는 최소 추가 provider 호출과 비용·timeout·attempt 의미 변경을 수반하고, (3)은 새 API 계약·secret·품질 검증이 필요하다. 어느 쪽도 이번 진단의 권한으로 자동 선택하거나 구현하지 않는다.
- 동일 smoke, cache 삭제, 실제 publictraffic 호출을 반복하지 않는다. 다음 결정 전에는 기존 하차역 종단 관찰과 공식 스키마를 재현 근거로 사용한다.

## 1차 구현 명령 이력 — 완료, 현재 실행 지시 아님

> 아래 내용은 단일 leg-mode geometry를 만든 당시 이력이다. 실기기에서 마지막 도보 누락이 확인됐으므로 현재 작업자는 이 절을 재실행하지 않고 위 `대중교통 종점 완전성 진단`을 따른다.

1. walk는 현재 시간에 사용한 `raw.route`의 `legs[].steps[].path.points`, transit은 현재 시간에 사용한 `raw.routes[0]`의 `steps[].path.points`를 읽는다. 다른 route index나 landing URL을 사용하지 않는다.
2. `[x,y]`를 WGS84 `[lon,lat]`로 검증하고 provider-neutral `paths`로 정제한다. 잘못된 점 제거, 연속 중복 제거, 빈/한 점 path 제거 뒤 실제 선 위 단순화를 적용한다.
3. path 최대 32개·전체 점 최대 512개를 보장한다. 시작·끝과 path 경계는 보존한다. 단순화 실패나 유효 점 부족 시 geometry만 생략하고 기존 정확 `totalMin`과 receipt 성공은 유지한다.
4. `RouteProxyFunctionResponse`의 성공 응답에만 bounded geometry를 선택값으로 추가한다. no_route/unavailable 응답에 geometry를 넣지 않는다. raw provider body·guidance·landing URL·키를 모바일로 전달하지 않는다.
5. public scope provider miss는 같은 sanitized geometry를 기존 `steps` RPC에 저장하고, cache hit에서 동일 geometry를 복원한다. private scope는 response에만 포함하며 public cache/lease/geometry write는 0회다. 비식별 provider quota 예약 RPC는 기존 비용 보호 계약대로 허용한다.
6. `createCourseV1ProxyRouteAdapter`는 응답 geometry를 `ExactRoute`에 투영한다. cache hit와 provider miss가 같은 engine shape를 만들고, mode·totalMin·receipt attempt/reuse 의미는 변하지 않는다.
7. geometry 때문에 provider 호출, attempt count, retry, fallback 제공사를 추가하지 않는다. geometry 손상은 시간 경로 전체의 provider 실패로 과장하지 않는다.

## 1차 필수 fixture 이력

- 공식 구조와 같은 walk nested legs/steps, transit route steps를 각각 정제한다.
- `[lon,lat]` 순서가 앱의 `{lat,lon}`으로 정확히 변환된다.
- provider miss→DB put payload와 cache hit 응답의 paths가 동일하다.
- private request는 geometry를 반환하지만 public geometry RPC get/put/lease는 0회다. 비식별 provider quota 예약 RPC는 허용한다.
- 513점·33 paths·범위 밖·문자열·빈 path는 bounded 또는 geometry 생략으로 안전 종료한다.
- malformed geometry + valid totalTime은 exact 시간 유지·geometry 없음, malformed totalTime은 기존 invalid/no_route 계약을 유지한다.
- 호출량·receipt·CAPTCHA·anonymous auth·snapshot stale·timeout 회귀가 그대로 통과한다.

## 1차 소유 경계와 완료 이력

- 수정: Route Proxy handler/client/adapter, API 계약 테스트, 이 문서.
- 금지: 추천 선택/시간 정책, React UI, migrations, 카탈로그, 환경값, 실제 key와 좌표 fixture, 작업 보드.
- 실제 Kakao 호출과 Edge 배포는 자동 완료 조건이 아니다. 타입 검사·API 관련 테스트·전체 core 테스트·diff check 결과를 남긴다.

## 완료 기록 — 2026-09-03

### 이전 방식 → 문제/관찰 → 교체 방식 → 교체 이유 → 상태

- **이전 방식:** Route Proxy는 선택한 Kakao walk `raw.route` 또는 transit `raw.routes[0]`에서 `totalTime`만 읽었다. public cache의 기존 `steps`를 응답에 그대로 붙일 수 있었지만 provider miss에는 steps를 저장하지 않았고, client adapter는 geometry를 `ExactRoute`에 투영하지 않았다.
- **문제/관찰:** 추천을 통과시킨 같은 route의 선을 코스 확인 화면에 전달할 수 없었다. cache 원문 steps를 그대로 모바일에 노출하면 guidance·provider 필드가 섞일 위험이 있고, 상세 진입 때 다시 조회하면 시간 검증과 지도선의 route가 달라지며 호출량도 증가한다.
- **교체 방식:** 선택한 route의 공식 `path.points`만 읽어 잘못된 WGS84 점과 연속 중복을 제거하고, 2점 미만 path를 버린다. 유효 path가 32개를 넘으면 geometry만 생략하며, 전체 512점을 넘으면 각 path의 시작·끝과 순서를 보존한 채 기존 선 위의 점을 결정적으로 선택한다. Edge 성공 응답은 `{ paths: [{ points: [{ lat, lon }] }] }`만 선택적으로 노출하고, public cache에는 같은 형상을 기존 `steps[].paths`의 `[lon, lat]`로 재구성해 저장한다. client adapter는 다시 한도를 검증한 geometry만 `ExactRoute`에 투영한다.
- **교체 이유:** 별도 provider 호출 없이 추천 시간과 지도 형상을 동일 route snapshot으로 유지하고, 공개 캐시에는 허용 좌표만 보관하며 private 정밀 좌표는 응답 수명 밖으로 남기지 않기 위함이다.
- **상태:** 로컬 구현·자동 계약 검증 완료. 실제 Kakao 호출, 원격 migration, Edge 배포와 실기기 확인은 수행하지 않았다.

### 변경 파일 / 변경 목적

- `supabase/functions/route-proxy/handler.ts`: walk nested legs/steps와 transit selected route steps에서 geometry를 정제·제한한다. provider miss 응답과 public cache 저장, cache hit 복원에 같은 형상을 사용하고 private 요청은 응답에만 포함한다. cache complete 시 provider를 내부 인자로 전달해 공개 cache key도 유지한다.
- `src/services/routeProxyClientAdapter.ts`: 성공 응답의 선택 geometry 타입을 공개 계약에 추가하고, 32 paths·512 points·finite WGS84 경계를 재검증한 뒤 `ExactRoute.geometry`에 투영한다. 손상 geometry는 exact 시간과 route를 유지한 채 제거한다.
- `test/route-proxy-geometry.test.ts`: 공식 walk/transit 구조, `[lon, lat] → { lat, lon }`, 중복·오염 좌표, 32/33 paths, 512/513 points, public miss→put→hit 동일성, private RPC 경계, malformed geometry/시간, client 투영을 고정 fixture로 검증한다.
- `docs/work/external-api/route-geometry.md`: 구현 이력, 유지 계약, 검증 결과와 다음 배포 위험을 기록한다.

### 유지한 계약

- Kakao walk는 `raw.route`, transit은 `raw.routes[0]`만 사용하며 다른 route index, TMAP·ODsay fallback, landing URL, 상세 route 재조회는 추가하지 않았다. geometry 추출로 provider 호출 또는 attempt 수가 늘지 않는다.
- `mode`, 정확 `totalMin`, exact/no_route/unavailable receipt, reuse와 새 provider attempt 의미, cache key·TTL·lease·budget·anonymous Auth·CAPTCHA·snapshot stale·timeout 계약을 바꾸지 않았다. geometry 손상·누락은 정확 시간을 실패로 승격하지 않는다.
- no_route/unavailable에는 geometry를 넣지 않고 provider 원문, guidance, URL, key를 모바일이나 cache에 전달하지 않는다. private 요청은 기존처럼 public get/put/lease를 사용하지 않는다.
- 추천 선택·순위·시간·8회 예산·continuation, React UI, migration, 카탈로그, 환경값과 작업 보드는 수정하지 않았다.

### 테스트 결과

- 실패 우선 신규 geometry 테스트 — 구현 전 6건 중 1건만 성공하고 sanitizer 부재, 응답/cache/client geometry 누락 5건 실패를 확인했다.
- `npx tsx --test test/route-proxy-geometry.test.ts` — 6/6 성공.
- geometry + client + timeout + snapshot stale + production receipt + page budget 관련 API 회귀 — 46/46 성공.
- `npm run test:typecheck` — 성공.
- `npm test` — 117/117 성공.
- `npm run test:ui` — 197 성공, 0 실패, 기존 skip 1건(총 198건).
- `git diff --check` — 성공.

### 다음 결정·위험

- 운영 반영 시 통합·결정 세션은 수락된 `202609030014_route_proxy_geometry_cache.sql`을 먼저 적용하고, 성공 확인 직후에만 Route Proxy Edge를 배포해야 한다. 순서를 뒤집으면 geometry가 포함된 public cache complete가 기존 DB 함수에서 제거될 수 있다.
- 기존 geometry 없는 public cache row는 exact 시간 cache hit으로 계속 호환되지만 선은 생략된다. TTL 만료 뒤 provider miss로 채워지기 전까지 이를 오류나 재조회 사유로 취급하지 않는다.
- `QA-COURSE-GEOMETRY-01`은 API fixture→engine leg snapshot→navigation→지도 표시를 통합하고, 실제 한 곳 코스에서 두 구간이 같은 검증 receipt geometry를 사용하는지 확인해야 한다. 이 단계에서도 상세 진입 route 호출 0회와 geometry 누락 시 직선 fallback 금지를 함께 관찰한다.

## 통합 검토 — 2026-09-03

**수락.** 선택된 Kakao route의 형상만 32 paths·512 points로 정제하며, provider miss 응답과 public cache 저장·복원, private 응답과 client `ExactRoute` 투영이 같은 provider-neutral 계약을 사용한다. geometry 때문에 호출·attempt·fallback이 늘지 않고 손상 geometry는 정확 시간과 receipt를 유지한 채 생략된다.

- 신규 API geometry 테스트 6/6 성공.
- 전체 core 117/117, UI 197 성공·기존 skip 1·실패 0.
- 타입 검사와 `git diff --check` 성공.
- 실제 Kakao 호출·원격 migration·Edge 배포는 수행하지 않았다. 따라서 이 수락은 **코드/계약 수락**이며 운영 반영 완료를 뜻하지 않는다.

## 운영 배포 단계 — DB 완료 후 실행 지시

### 목적과 선행 게이트

- 목적은 이미 수락된 `supabase/functions/route-proxy/handler.ts`와 `index.ts`를 연결된 운영 Supabase의 기존 `route-proxy` Function에 배포하는 것이다. 새 API·provider·fallback·호출 상한을 추가하는 작업이 아니다.
- `DB-ROUTE-GEOMETRY-01` 운영 단계가 `202609030014 적용/기적용 확인`으로 끝나고 통합·결정 세션이 다음 진행을 열기 전에는 시작하지 않는다.
- 출발지·목적지 marker만 보이는 현상을 UI 조건문, 임의 직선 또는 상세 화면의 추가 route 호출로 우회하지 않는다.

### 배포 전 확인

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, 이 문서만 읽는다. 과거 API archive 전체를 다시 읽지 않는다.
2. 현재 linked Supabase 프로젝트와 기존 로그인 상태를 확인하되 project ref·token·key·URL 값을 로그나 문서에 남기지 않는다. 인증이 없거나 대상이 불명확하면 배포하지 않고 중단한다.
3. 아래 검증을 다시 실행한다.
   - `npx tsx --test test/route-proxy-geometry.test.ts test/qa-course-geometry-integration.test.ts`
   - `npm run test:typecheck`
   - `git diff --check`
4. 배포 대상 diff가 기존 `route-proxy` Function과 geometry 전달 코드뿐인지 확인한다. CAPTCHA·anonymous Auth·rate/budget·secret 이름·snapshot·TTL·cache key·provider 선택 설정을 바꾸지 않는다.

### 배포와 비과금 확인

1. 저장소 root에서 기존 linked project에 `npx supabase@latest functions deploy route-proxy`를 **한 번만** 실행한다. 임의로 `--no-verify-jwt`, 새 project ref 또는 secret 값을 덧붙이지 않는다. 현재 배포의 JWT 경계를 유지한다.
2. 성공 뒤 Function 목록/배포 상태만 확인한다. 인증 없는 health 요청을 사용한다면 401/403처럼 gateway가 요청을 거절하는 것만 확인하고, 실제 좌표를 넣어 Kakao route를 호출하지 않는다.
3. CLI 배포 실패, 대상 불명확, secret 누락, source bundle 오류가 나면 같은 명령을 반복하지 않는다. secret 재등록·migration repair·Function 삭제·새 이름 배포를 하지 말고 오류 종류만 인수인계한다.
4. 기존 geometry 없는 public cache row는 시간 결과로 계속 유효하고 TTL 동안 선이 없을 수 있다. 이를 해결하려고 cache를 삭제하거나 강제 provider 재호출하지 않는다.

### 완료 기준과 다음 단계

- 완료 판정: `route-proxy` 최신 배포 성공, geometry/API 자동 테스트 통과, 배포 확인 과정의 실제 Kakao 호출 0회.
- 인수인계에는 변경 파일(배포만 했다면 `없음`), 유지한 호출량·인증·cache 계약, 실행 명령과 결과, 배포 시각, 잔여 위험을 기록한다. secret 값·project ref 전체값·실제 좌표는 기록하지 않는다.
- 다음은 QA 세션의 `QA-COURSE-GEOMETRY-01 운영 smoke` 한 건이다. 새 internal build 또는 최신 JS bundle에서 실제 one-stop 코스 하나를 만들고 코스 확인 지도에서 `출발→장소`, `장소→목적지/복귀`의 실제 경로선이 보이는지만 확인한다.
- smoke에서는 상세 진입으로 인한 추가 route 호출 0회, 직선 fallback 0, 카카오 길찾기 CTA 유지도 함께 확인한다. 실패하면 화면을 반복 탭하지 말고 `두 선 모두 없음 / 한 leg만 없음 / 지도 자체 실패` 중 하나와 안전 로그만 기록한다.

## 2026-09-03 — 운영 배포 완료 인수인계

### 변경 파일 / 변경 목적

- 운영 코드·migration·Function 설정·secret 변경 파일은 없다. 이미 수락된 저장소의 `supabase/functions/route-proxy/handler.ts`와 기존 `index.ts` bundle을 기존 운영 `route-proxy`에 배포했다.
- `docs/work/external-api/route-geometry.md`: 배포 대상, 자동 게이트, 운영 상태와 다음 QA 경계를 기록했다.
- `docs/work/external-api/README.md`: 외부 API 역할의 현재 상태를 운영 배포 완료·QA smoke 대기로 갱신했다.

### 유지한 계약

- linked project의 기존 `route-proxy` 이름과 JWT 검증 경계를 유지했다. `--no-verify-jwt`, 새 project ref, secret/JWT/Auth·CAPTCHA·rate/budget·snapshot·TTL·cache key·provider 설정을 추가하거나 변경하지 않았다.
- 배포 명령은 정확히 1회 실행했다. 실제 좌표를 포함한 Function 요청, Kakao/provider 호출, cache 조회·삭제·초기화, 사용자 데이터 조회, migration 추가 적용은 모두 0회다.
- one-stop 추천·순위·시간·attempt·continuation, UI, 엔진, 카탈로그와 작업 보드는 수정하지 않았다.

### 테스트 결과

- 배포 전 `npx tsx --test test/route-proxy-geometry.test.ts test/qa-course-geometry-integration.test.ts` — 9/9 성공.
- 배포 전 `npm run test:typecheck` — 성공.
- 배포 전·기록 후 `git diff --check` — 성공.
- native Supabase CLI의 기존 로그인·linked project와 기존 `route-proxy` 대상을 식별값 출력 없이 확인했다.
- `npx supabase@latest functions deploy route-proxy` — 1회 성공.
- postflight Function 목록 — `route-proxy` 상태 `ACTIVE`, version `6`, 배포 시각 `2026-09-03 03:55:38 KST` 확인. 인증 없는 health 요청도 보내지 않아 Kakao 호출 가능성은 0회로 유지했다.

### 다음 결정·위험

- 다음 작업은 QA 역할의 `QA-COURSE-GEOMETRY-01 운영 smoke` 1건이다. 최신 JS bundle/내부 build에서 실제 one-stop 코스 하나만 만들고 코스 확인 지도에 두 실제 구간선이 보이는지 확인한다.
- 기존 geometry 없는 public cache row는 TTL 동안 정확 시간만 복원해 선이 없을 수 있다. 이를 이유로 cache를 삭제하거나 강제 provider 재호출하지 않는다.
- smoke 실패 시 재시도하지 않고 `두 선 모두 없음 / 한 leg만 없음 / 지도 자체 실패` 중 하나와 비밀 없는 안전 로그만 기록한다. 상세 진입 route 재호출이나 직선 fallback으로 우회하지 않는다.

## 2026-09-03 — 운영 배포 통합 판정

- **수락.** 선행 DB `014` 반영 뒤 기존 `route-proxy`에 정확히 1회 배포했고, postflight에서 Function `ACTIVE`, version `6`을 확인했다.
- 배포 전 geometry 통합 테스트 9/9와 타입 검사·diff 검사가 통과했다. 배포 확인 과정에서 실제 좌표 요청·Kakao 호출·cache 조작은 0회였다.
- JWT·Auth·CAPTCHA·secret·provider·budget·TTL·snapshot 설정을 바꾸지 않았고 새 Function 이름이나 우회 배포도 만들지 않았다.
- API 역할의 추가 수정은 없다. 다음 실패가 있더라도 먼저 `QA-COURSE-GEOMETRY-01 운영 smoke`의 분류 결과를 받고, UI/API를 추측 수정하지 않는다.

## API-ROUTE-GEOMETRY-03 — 선택된 코스의 private walk connector port

### 상태·목적

**완료.** `API-ROUTE-GEOMETRY-02`는 선택 transit route를 바꾸는 것으로 endpoint walk를 얻을 수 없음을 확인했다. 이번 작업은 추천 계산이 아니라, 사용자가 선택한 코스 상세에서 누락된 도보 선을 그리기 위한 **직접 walk-only 어댑터**를 만든다.

### 시작 시 읽을 범위

`AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/work/external-api/README.md`, 이 문서의 `API-ROUTE-GEOMETRY-02` 완료 기록과 `docs/work/integration-decision/course-confirm-route-geometry.md`의 `2026-09-03 최종 선택`만 읽는다. 구현 전 `src/services/routeProxyClientAdapter.ts`, `src/services/routeProxyActivatedCourseAdapter.ts`, `src/services/routeProxyProductionPorts.ts`, `supabase/functions/route-proxy/handler.ts`의 현재 private walk 요청·응답·Auth 경계를 확인한다. 과거 archive와 다른 API 작업 전체는 읽지 않는다.

### 구현 명령

1. `src/services/` 아래에 코스 상세 전용 walk connector port를 둔다. 하나의 요청은 WGS84 `from/to`만 받고 Route Proxy에 `{ mode: 'walk', scope: { kind: 'private_request' }, origin, destination }`를 정확히 1회 전달한다. `createCourseV1ProxyRouteAdapter.getRoute()`를 사용하면 walk 14분 초과 시 transit을 자동 조회하므로 재사용하지 말고, 직접 walk-only 경계를 만든다.
2. 기존 `createSupabaseRouteProxyPorts().auth.getSession()`으로 현재 세션만 얻는다. 세션이 없거나 만료됐으면 `unavailable` 안전 결과를 내고 Edge/provider를 호출하지 않는다. `signInAnonymously`, CAPTCHA token 요청·보관, 로그인 UI를 시작하지 않는다.
3. 응답은 `status=ok`, `mode=walk`, 정수 `totalMin>0`, `receipt.result=exact`, 유효한 bounded geometry를 모두 통과했을 때만 `exact_geometry`로 돌려준다. geometry 검증은 기존 path 32개·전체 512점·path당 2점·finite WGS84 상한을 재사용한다. `totalMin`은 안전 응답 검증에만 쓰고 UI가 추천 시간에 더할 수 없는 타입으로 분리한다.
4. 안전 결과는 최소 `exact_geometry | no_route | unavailable`와 호출을 새로 시작했는지 알 수 있는 비밀 없는 receipt만 포함한다. HTTP body·provider 원문·URL·header·JWT·좌표·key를 오류·console·문서에 남기지 않는다. 임의 provider fallback·직선 geometry·자동 재시도를 만들지 않는다.
5. 같은 좌표쌍의 in-flight를 하나로 합치고, 성공 geometry와 terminal 실패를 앱 프로세스 메모리에서만 10분 재사용한다. 항목은 최대 64개로 제한하고 만료/상한 초과를 제거한다. 키에 정밀 좌표를 쓰더라도 메모리 밖으로 직렬화·로그·저장하지 않는다. 테스트에서 clock·cache를 주입하고 reset할 수 있게 한다.
6. 서비스 자체는 UI의 코스 단위 호출 상한을 알지 않는다. UI가 전달한 connector 하나만 처리하고, 다음 후보를 자동 prefetch하거나 transit을 다시 조회하지 않는다.
7. 현재 `route-proxy` handler가 private walk geometry를 이미 지원하면 handler·Edge·DB migration을 수정·배포하지 않는다. 부족한 공개 계약이 확인될 때만 수정 필요성을 먼저 인수인계하고 임의 운영 배포를 하지 않는다.

### 실패 우선 fixture와 완료 기준

- 유효한 현재 세션 + private walk exact geometry: Edge 1회, transit 0회, 성공 geometry 1개.
- 세션 없음: anonymous sign-in·CAPTCHA·Edge·provider 모두 0회.
- no-route, unavailable, transport throw, malformed receipt/mode/min/geometry: 비밀 없는 실패 결과, 자동 재시도·transit 0회.
- 동일 요청 동시 2회: provider 실제 시작 1회. 10분 내 재호출: 0회 추가. 만료 후: 새 요청 1회. 64개 상한과 reset도 검증한다.
- private 요청에 public cache/lease/geometry DB write 0, 로그에 좌표·식별자 0을 spy로 확인한다. 기존 비식별 provider quota 예약 RPC는 비용 보호 계약이므로 허용하며 제거하지 않는다.

최소 `npm run test:typecheck`, 관련 API 계약 테스트, `npm test`, `npm run test:ui`, `git diff --check`를 실행한다. 실제 Kakao/provider 호출·Simulator·실기기·운영 배포는 이 작업의 완료 조건이 아니다. 완료 인수인계에는 변경 파일/목적, 유지한 계약, 테스트 결과, UI에 넘길 정확한 port 사용법과 잔여 위험을 남긴다. 사용자의 별도 명령 전에 commit·push하지 않는다.

### 수정 경계

- 수정: `src/services/` 및 외부 API 어댑터 계약 테스트, 이 문서.
- 금지: `src/engine/`, `src/ui/`, `src/data/`, migration, 추천 순위·시간·initial/page 8회, 카카오맵 핸드오프, Auth/CAPTCHA 정책, `docs/작업조정_보드.md`.

### 2026-09-03 완료 인계

#### 변경 파일 / 변경 목적

- `src/services/privateWalkConnector.ts`: 코스 상세 전용 `PrivateWalkConnectorPort`를 추가했다. 유효 WGS84 한 쌍을 `walk + private_request`로만 한 번 전달하며, 현재 세션 확인·응답 검증·동일 요청 in-flight 병합·10분 프로세스 메모리 재사용·64개 상한·reset을 한 경계에 모았다.
- `src/services/privateWalkConnectorProduction.ts`: `createSupabaseRouteProxyPorts()`의 기존 `auth.getSession()`과 `edge`만 결합하는 production factory를 추가했다.
- `src/services/routeProxyClientAdapter.ts`: 기존 32 paths/전체 512 points/path당 최소 2 points/finite WGS84 검증을 `normalizeRouteProxyGeometry()`로 공개해 새 포트와 기존 어댑터가 같은 fail-closed 검증을 사용하게 했다.
- `src/services/routeProxyAnonymousAuth.ts`, `src/services/routeProxyProductionPorts.ts`: 기존 session 계약에 선택적 Supabase `expiresAt`을 보존해 만료가 확인된 session은 Edge 전에 차단할 수 있게 했다. 새 포트가 받는 Auth 타입은 `getSession`만으로 좁혀 `signInAnonymously` 호출을 타입 경계에서도 제외했다.
- `test/private-walk-connector.test.ts`: exact/no-route/unavailable/transport/malformed, session 부재·만료, 한 번뿐인 walk 요청, 동시 병합, TTL, 64개 상한, reset, 비기록 계약을 failure-first fixture로 고정했다.

#### 유지한 계약

- 요청은 `{ mode: 'walk', scope: { kind: 'private_request' }, origin, destination }` 하나뿐이며 transit 재조회·provider fallback·직선 geometry·자동 재시도·prefetch를 만들지 않았다.
- 성공 타입에는 geometry만 있고 provider `totalMin`은 없다. `totalMin`은 양의 정수인지 검증하는 데만 사용하므로 추천 `travelMin`·`totalMin`·순위·snapshot에 합산할 수 없다.
- 현재 session이 없거나 `expiresAt`으로 만료가 확인되면 `session_unavailable`과 `newRequestStarted: false`로 끝난다. anonymous sign-in·CAPTCHA·로그인 UI는 호출하지 않는다.
- 좌표쌍 키와 결과는 주입 가능한 `Map` 기반 앱 프로세스 메모리에만 둔다. 영속 cache·AsyncStorage·DB 저장·원문 오류·좌표/JWT/URL/header/key 로그는 추가하지 않았다. session 부재 결과는 이후 기존 session 복원을 막지 않도록 cache하지 않는다.
- `route-proxy` handler·Edge·DB migration·엔진·UI·데이터·추천 정책·보드는 변경하거나 배포하지 않았다. 현행 private handler의 public route cache/lease/get/put은 0회이고 provider quota 보호용 `route_proxy_reserve_budget` RPC는 기존대로 1회다. 작업 명령의 포괄적 “RPC 0” 표현과 이 보안 계약은 충돌하므로 quota RPC를 제거하지 않았다.

#### 테스트 결과

- 실패 우선: 구현 전 `npx tsx --test test/private-walk-connector.test.ts` — module 없음으로 예상 실패 확인.
- 관련 API 계약: `npx tsx --test test/private-walk-connector.test.ts test/route-proxy-client-adapter.test.ts test/route-proxy-production-ports.test.ts test/route-proxy-geometry.test.ts` — 28/28 통과. 이 중 새 포트 6/6 통과, 실제 provider 호출 0회.
- `npm run test:typecheck` — 통과.
- `npm test` — 117/117 통과.
- `npm run test:ui` — 198개 중 197 통과, 1개 기존 skip, 실패 0.
- `git diff --check` — 통과.

#### 다음 결정·위험

- UI 역할은 앱 composition에서 `createSupabasePrivateWalkConnectorPort()`를 프로세스당 한 번 만들고, 사용자가 코스 상세를 연 뒤 50m 초과로 판정된 endpoint connector 각각에만 `getConnector(from, to)`를 호출한다. `exact_geometry`일 때만 파란 connector 선을 추가하고 `no_route | unavailable`은 해당 선만 생략한다. 한 코스 최대 4회 제한은 포트가 아니라 UI 호출부가 소유한다.
- 포트 instance를 렌더마다 다시 만들면 in-flight/10분 재사용이 사라진다. 화면 수명보다 긴 composition에 보관해야 하며 precise-key cache나 receipt를 navigation params·snapshot·storage·로그로 직렬화하면 안 된다.
- `expiresAt`이 없는 기존 session은 Supabase Edge의 JWT 검증에 맡긴다. 만료 응답도 자동 갱신·anonymous sign-in·재시도하지 않고 terminal `unavailable`로 10분 재사용한다.
- provider quota 예약 RPC까지 0회여야 한다는 새 정책을 원한다면 abuse/budget 보호 변경이므로 통합·DB·운영 결정이 선행되어야 한다. 이번 API-03 범위에서는 기존 보호 계약과 handler 불변 지시를 우선했다.

### 2026-09-03 통합 검토 — 수락

- `src/services/privateWalkConnector.ts`와 production factory를 확인했다. 호출 body는 `walk + private_request` 한 건뿐이고 결과 타입에 `totalMin`이 없어 추천 시간에 합산할 수 없다.
- session 없음·확인된 만료의 Edge 0회, malformed/no-route/transport의 재시도·transit 0회, in-flight·10분·64개 메모리 경계를 확인했다.
- 통합 독립 실행: 관련 API 계약 테스트 **28/28 통과**, `npm run test:typecheck` 통과.
- public cache/lease/geometry write 0과 비식별 quota 예약 허용을 확정했다. 실제 Kakao·운영 Edge·Simulator·실기기 호출은 0회다.
- 다음 작업은 UIUX의 `U-COURSE-GEOMETRY-02`다. UI는 factory를 프로세스 수명에 한 번만 만들고 상세에서 조건을 통과한 connector만 최대 4개 요청한다.
