# API-LIVE-QUOTA-CONNECT-02 — live 공급자 HTTP 직전 전역 예약 연결

2026-09-22. DB 소유 migration `202609220018_live_provider_budget.sql`의 `reserve_live_provider_attempt(p_credential_scope, p_operation)` 계약을 TourAPI·부산 live Edge에 연결했다.

2026-09-28 운영 연결 상태: migration 018·019와 `tourapi=800`, `busan_public_data=8000` rolling 24h 상한이 원격에 적용됐다. 사용자가 두 API가 같은 공공데이터포털 일반 인증키를 사용한다고 확인해, 값을 출력하지 않고 `TOURAPI_KEY`·`BUSAN_PUBLIC_DATA_SERVICE_KEY` 비밀 이름으로 등록했다. `busan-live` 버전 1과 `tourapi-live` 버전 2는 `verify_jwt=true`, `ACTIVE`다. 공개키만 사용한 비로그인 요청은 두 함수 모두 401 `unauthorized`였다. 로그인 제한 호출에서 부산은 명소·맛집·쇼핑 각 1회, 총 3회 `ready`였고 승인 ID 132개 활성·명소 1개 비활성을 반환했다. 부산 전체 단일 Tour 목록이 2,000건을 넘는 문제는 `12 관광지·14 문화시설·28 레포츠·38 쇼핑·39 음식점` 유형별 최대 2페이지 조회로 교체했다. `39`는 승인된 exact mapping 카페 15곳만 교집합으로 사용하며 일반 음식점을 편입하지 않는다. `15 축제·25 여행코스·32 숙박`은 호출하지 않는다. 재배포 후 로그인 개발 세션에서 목록 `ready`·승인 후보 12곳 활성과 상세 1건 `ready`를 확인했다. 첫 시도는 병렬 예산 예약 하나의 일시 실패로 fail-closed됐고 별도 명시 재호출에서 성공했다. 운영 어댑터부터 코스 생성까지 연결한 내부 고정 흐름에서는 활성 후보 58곳→경로 후보 18곳→실제 adapter 호출 6회 뒤 검증 코스 2개를 생성해 `resultState=verified`였다. 두 번의 통합 실행 뒤 최근 24시간 누적 예약은 Tour `catalog_page=21`, `detail_intro=25`, 부산 세 operation 각 3건이다. 타입 검사, 핵심 603/603, UI 863 PASS·기존 1 SKIP이다. **시뮬레이터 화면 수동 흐름과 공개 flag 전환은 아직 수행하지 않았다.**

## 변경 파일 / 목적

| 파일 | 목적 |
| --- | --- |
| `supabase/functions/_shared/liveProviderBudget.ts` | service-role RPC의 단일 행 `granted=true/reason=granted`만 HTTP 허가로 인정하는 typed port. 오류·손상·다중 행은 fail-closed. |
| `supabase/functions/tourapi-live/{handler,index}.ts` | JWT·입력·세션 cap 검사 후 catalog의 각 page와 detail의 각 ID `fetch` 직전에 `tourapi/catalog_page`, `tourapi/detail_intro`를 예약. |
| `supabase/functions/busan-live/{handler,index}.ts` | 원천/페이지별 `fetch` 직전에 `busan_public_data/attractions_page`, `food_page`, `shopping_page` 예약. 거절 건은 `providerCalls`에 포함하지 않음. |
| `test/live-provider-budget-connect.test.ts` | RPC shape, 설정 없음/거절/오류, Tour page별·detail별, 부산 3원천 partial·호출 수·클라이언트 quota 주입 차단의 고정 fixture. |
| `test/tourapi-live-{handler,progressive}.test.ts`, `test/busan-live-handler.test.ts` | 기존 정상 공급자 fixture에 승인된 예약 port를 주입해 기존 계약 회귀를 유지. |
| `test/{tourapi,busan}-live-safety.test.mjs` | 허용된 서버 예산 RPC만 예외로 두고 비저장·비로그·비공개키 경계를 유지. |
| `test/activated-route-proxy-adapter.test.ts` | 대표 ID가 같아도 live 좌표가 snapshot과 다르면 private 요청에 실제 live 좌표를 전달하는 고정 fixture 1건. |
| 본 문서 | 검증과 활성화 전 위험 인계. |

DB migration 자체는 읽기만 했고 수정하지 않았다.

## 유지 계약과 실패 의미

- RPC 인자는 DB allowlist의 **고정 scope/operation 두 값만**이다. cap·시각·사용자 ID·좌표·공급자 key·전체 URL·원문 payload를 클라이언트나 RPC에 전달하지 않는다. Supabase service-role client는 Edge entry에만 있다.
- 예약 port가 없거나 RPC가 설정 없음, `limit`, `invalid_input`, 오류, 예외, 빈/복수/손상 행을 반환하면 `fetch`는 0이다. 허가가 확인된 후에만 provider URL을 구성한다. DB 에러 원문을 로그·응답으로 내보내지 않는다.
- 예약 거절은 기존 안전 `request_budget_exhausted`로 표현한다. 이는 현재 UI/API 공개 enum을 확대하지 않기 위한 최소 변경이며, 설정 없음과 실제 cap 도달을 앱에서 구별하지 못한다. 운영 구분이 필요하면 별도 승인된 서버 안전 집계가 필요하다.
- Tour catalog는 승인한 콘텐츠 유형 5개 각각 최대 2페이지(통상 5회·최악 10회), detail 첫12→후속6·누적30, 부산 원천별2페이지·snapshot6, 자동 retry0과 partial/inactive 계약을 유지한다. 예약 성공 후 HTTP 실패는 slot을 환불하지 않는다.
- route-proxy 예산·추천 엔진·UI·App·데이터·DB/RLS·env/secret은 변경하지 않았다. public live flag는 켜지 않았다.
- 이 첫 구현은 rolling 24h **총량 상한**만 보완한다. 동일 signed token replay·서로 다른 branch의 세션 cap 우회·동일 snapshot 재호출을 provider 0으로 차단하는 ledger/CAS는 없다. 동일 요청도 cap 안이면 별도 slot을 소모할 수 있다.
- Route Proxy의 `createRouteProxyCatalogScopeResolver`는 대표 ID뿐 아니라 **두 끝점의 좌표가 번들 snapshot과 exact 일치**할 때만 public cache scope를 사용한다. live 좌표가 변한 같은 ID는 안전하게 `private_request`로 내려가 실제 live 좌표를 요청 수명에만 전송한다. public cache hit 감소·Route Proxy 공급자 호출/예산 소모 증가 가능성이 있으나, 이번 live 원천 예산 RPC와는 **별도**다. public scope 일치 조건을 완화하거나 stale snapshot 좌표로 경로를 계산하지 않았다.

## 검증 결과

- RED: 신규 fixture 첫 실행은 shared 예약 port 모듈 부재로 **0 PASS / 1 파일 FAIL**.
- GREEN: 신규 예약 fixture **5/5 PASS**, 기존 Tour/Busan handler·progressive 집중 합계 **25/25 PASS**, 안전 회귀 **3/3 PASS**.
- live 좌표 drift의 private exact 전달 fixture **1/1 PASS** (Route Proxy adapter 고정 입력, 실제 호출0).
- `npm run test:typecheck`: **PASS**.
- `npm test`: **596/596 PASS**, fail0/skip0.
- `npm run test:ui`: sandbox의 tsx IPC `EPERM`으로 시작 전 실패. 동일 UI glob을 `node --import tsx --test`로 실행할 때 공유 작업트리 변동 중 최초 856건 중 2 FAIL이 관찰됐다. 이후 재실행은 **858건 중 857 PASS / 0 FAIL / 기존 1 SKIP**. 최초 실패 원인은 출력이 확보되지 않아 확정하지 않는다. UI 코드·테스트는 이 작업에서 수정하지 않았다.
- `git diff --check` **PASS**, 신규 파일 trailing whitespace **0**. 마지막 수정 후 `npm run test:typecheck` 재실행 **PASS**.
- 실제 공급자 API·원격 DB·Edge 호출/배포0. key/secret 값 열람·출력0, commit/push0.

## 다음 결정·위험

1. DB 소유자는 migration의 원격 적용, scope별 양의 상한 설정, service-role 전용 권한, rolling24h 경계·병렬 transaction 테스트를 별도 수락해야 한다. **설정 없이 배포해도 실제 provider 호출은0**이며 이를 장애가 아닌 의도된 fail-closed로 해석한다.
2. 운영 계정의 실제 quota·부산 세 서비스 credential 공유 범위·여유폭·공급자 reset/초당 제한을 확인하기 전에는 live public flag를 켜지 않는다. DB의 rolling24h cap을 공급자 달력 quota와 동일하다고 주장하지 않는다.
3. 한정된 배포/실호출 smoke는 별도 승인 후 수행한다. 이 fixture는 Supabase 원격 RPC/Edge 배포 동등성을 입증하지 않는다.
4. replay/세션 분기 방지는 [`API-LIVE-QUOTA-DESIGN-01`](live-provider-quota-design-01.md) §6의 후속 강화다. 전역 cap 연결 완료와 혼동하지 않는다.
5. live 좌표 변동 빈도에 따른 Route Proxy private 비율·cache hit율·별도 Route Proxy 예산 영향을 QA에서 안전 집계로 관찰해야 한다. 정확성/보안을 위해 현재 exact public scope gate는 유지한다.
