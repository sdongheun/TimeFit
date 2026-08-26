# 외부 API 작업기록

> 외부 API 어댑터 역할의 상세 지시와 완료 기록만 남긴다. 추천 순위·화면·원본 장소 데이터·DB 정책은 수정하지 않는다.

## 2026-08-26 — 통합·결정 지시 API-S-5: 카카오 단일 위치검색·TTL cache 계약

### 사용자 행동과 범위

- 사용자가 위치 선택 화면에 장소명 또는 주소를 입력하면 Kakao의 알맞은 검색만 먼저 호출한다. 장소·주소 API와 TMAP을 동시에 호출하지 않는다.
- 같은 정규화 검색어를 반복하면 10분 동안 기기 메모리 cache를 재사용하고, 같은 요청이 진행 중이면 하나로 합친다. 검색어·정밀 위치·선택 이력은 서버나 영구 저장소에 남기지 않는다.
- 이 작업은 내부 지도 UI·추천 경로·DB를 수정하지 않는다.

### 실제 경로와 구현 항목

```text
입력 분류(place | address)
  → Kakao 우선 검색 1회
  → 결과 0건일 때만 반대 Kakao 검색 1회
  → 메모리 TTL/in-flight cache
  → UIUX 공개 검색 결과·호출 진단
```

1. 숫자·도로명/길·번지·동/리 같은 주소 신호와 일반 장소명 신호의 순수 분류기를 만든다. 애매한 입력은 장소 우선으로 두고, 0건일 때만 주소 fallback한다. 주소/장소 API 병렬 호출은 금지한다.
2. Kakao keyword POI와 Kakao address 결과를 공통 위치 제안 타입으로 변환한다. 각 결과의 `kind: place | address`, provider 원본 label·좌표·주소 근거를 보존한다. TMAP 장소 검색은 이 흐름에서 호출하지 않는다.
3. 정규화한 `mode + query`를 key로 하는 기기 메모리 LRU TTL cache(기본 10분)와 in-flight request 합치기를 만든다. 고정 clock/Promise fixture로 TTL hit·만료·동시 10회 요청을 검증한다. cache key·값을 로그·DB·AsyncStorage에 쓰지 않는다.
4. adapter 진단은 provider별 장소/주소 요청 수, cache hit/miss, fallback 수만 제공한다. 검색어·주소·좌표·키·응답 원문은 로그에 넣지 않는다.
5. 실제 API 호출 없이 raw Kakao fixture → 실제 변환 → cache → 공개 결과의 전 경로를 검증한다. 최소: 장소 우선 성공, 주소 우선 성공, 장소→주소/주소→장소 1회 fallback, 양쪽 0건, 같은 검색 10회 1요청, TTL 만료 재요청, TMAP 0요청.

### 완료 판정

완료 기록에는 사용자 행동별 provider 요청 수, cache 결과, 실제 adapter 경로 테스트명, UIUX 소비 타입, 실제 API 0회를 표로 남긴다. fixture에 cache 결과를 직접 주입하거나 provider 두 개를 병렬 호출하면 완료가 아니다. `npm run test:typecheck`, 관련 adapter 테스트, `npm test`, `git diff --check`를 실행한다.

**완료 기준:** 같은 검색어 10회가 TTL 안에서 Kakao 1회 이하이고, 하나의 입력이 장소/주소·Kakao/TMAP을 동시에 호출하지 않으며, U-1-F-R6이 소비할 공통 위치 제안 계약이 있다.

## 2026-08-26 — 통합·결정 지시 API-4-B: 카카오 대중교통 전환·이중 도보 제공사 계약

**우선순위 2 / 선행 조건:** 없음. 장소명 UI 보완(U-1-F-R4)은 독립이며, 현재 역할 세션에서는 그 완료 뒤 순차 수행한다.

**목표:** ODsay를 자동 추천의 대중교통 실제 경로 제공사에서 안전하게 제외하고, API-4-A의 서버 전환 전에 카카오 대중교통·카카오/TMAP 도보를 같은 route 결과 계약으로 고정한다.

1. 경로 adapter에 provider-neutral 입력/출력 타입을 만든다. 최소 `provider`, `mode(walk|transit)`, 방향 있는 출발/도착 identity, 총 소요 분, 구간/step, 성공·제한·실패 이유를 포함한다. 키·Authorization·정밀 GPS·원문 응답은 타입·로그·fixture에 넣지 않는다.
2. 카카오 REST **대중교통** adapter와 **도보** adapter의 요청 생성·응답 변환을 구현하거나, API-4-A가 소비할 수 있는 독립 모듈로 분리한다. 고정 fixture에서 총 시간·구간·빈/형식 오류·401/403/429·timeout을 검증한다. 추가 실제 API 조사는 금지한다.
3. TMAP은 도보 adapter로만 유지한다. ODsay는 legacy fixture 호환 경계를 제외하고 새 자동 route 선택에서 `disabled` 상태가 되게 한다. TMAP 대중교통을 fallback으로 가정하거나 호출하지 않는다.
4. 도보 선택 정책을 순수 함수와 fixture로 고정한다. 유효 cache hit가 있으면 그 provider 결과를 재사용한다. miss는 각 제공사의 `used / softLimit`이 낮은 쪽을 고르고, 동률은 **방향·mode·공개 POI identity·route version** 기반 결정적 키로 나눈다. 균형 확인을 위한 동시 이중 호출은 금지한다. 선택 provider 실패/timeout일 때만 다른 provider에 1회 fallback하며 두 호출 모두 비용·출처를 남긴다.
5. 대중교통은 카카오만 선택한다. 카카오 한도/실패면 `transit unavailable`을 반환하며 도보를 대중교통 결과로 가장하거나 근사 시간으로 통과시키지 않는다.
6. 일일 hard limit과 그보다 앞선 configurable soft limit(기본 비율 90%, 값은 서버 설정에서 주입)의 타입·fixture를 만든다. 이 단계에서는 client 공개 키를 새 호출 경로에 추가하지 않고, API-4-A의 서버 proxy 경계를 위한 의존성 주입으로 둔다.
7. 변경 파일, ODsay와 UI/엔진/DB에 손대지 않은 경계, 테스트 명령별 결과, API-4-A로 넘길 타입을 이 문서에 기록한다. 최소 `npm run test:typecheck`, 관련 adapter 테스트, `npm test`, `git diff --check`를 실행한다.

**완료 기준:** 카카오 대중교통과 두 도보 provider를 fixture만으로 같은 계약에서 구분·선택할 수 있고, 도보 cache miss의 균형이 중복 호출이 아닌 결정적 사용률 배정임이 테스트로 증명된다. API-4-A가 이 계약을 받아 서버 proxy를 구현할 수 있어야 한다.

### API-4-A 수행 순서 정정 (2026-08-26)

API-4-A는 API-4-B 완료 뒤 수행한다. 기존 문서의 `ODsay·TMAP 일일 호출량`은 `카카오 대중교통, 카카오 도보, TMAP 도보의 각각의 일일 호출량`으로 읽는다. 서버 구현 시 API-4-B의 provider-neutral 타입과 도보 선택 함수를 재구현하지 않고 소비한다.

---

## 2026-08-26 — 통합·결정 지시 API-S-4: 교통 수식어 검색의 제공사 조회·근거 계약

**발생한 문제:** API-S-3/U-1-F-R4는 제공사 결과 이름이 이미 `사상역 부산2호선`처럼 노선 수식어를 포함할 때만 표기 변형을 매칭한다. 사용자는 `사상역`을 입력했을 때 정확 일치 하나가 아니라 `사상역 ~`의 관련 제안을, `사상역 2호선`을 입력했을 때 실제 표기가 달라도 그 뉘앙스에 맞는 노선별 제안을 기대한다. 단순 문자열 완화는 주소·무관 상호를 섞고, 단순 `사상역` 표시는 노선 의도를 전달하지 못한다.

**목표:** 장소명 검색을 정확 일치 필터가 아니라 관련성 순 제안으로 전환한다. `사상역`에는 관련 역·출구·장소를, `사상역 2호선`에는 근거 있는 같은 역·노선 제안을 보여 주되 주소·무관 상호와 근거 없는 노선 표기는 막는 adapter 계약을 만든다.

1. API-S-3의 query를 `고유 장소명`과 `교통 수식어`로 구조화하는 순수 query-plan을 adapter에 둔다. 원문 query를 첫 요청으로 유지하고, 원문이 `ok`이나 관련 장소명 POI 0개일 때만 고유 장소명으로 **한 번** fallback 조회한다. 고유 장소명만 있는 `사상역` 검색은 제공사에서 받은 이름 관련 결과를 정확/접두/포함·교통 유형 순으로 충분히 보존한다. 입력 중 실시간 호출을 추가하지 않으며 검색 버튼/submit 한 번당 fallback 수와 provider별 호출 수를 진단의 개수로만 남긴다.
2. Kakao·TMAP 원문 응답에서 공식 장소 유형/카테고리·노선 정보(있다면)를 최소 공개 `Poi` metadata로 안전하게 매핑할 수 있는지 고정 fixture와 문서로 확인한다. 키·원문 응답·검색어·좌표를 결과/로그/fixture에 넣지 않는다.
3. base-name fallback 결과는 **구조화된 역/정류장/교통 POI 유형**과 고유 장소명의 정확 일치가 함께 입증될 때만 `base_transit_place`로 반환한다. 제공사가 이미 준 장소명·유형·카테고리만 보존하며, 별도 역·노선 데이터 조인이나 추천 카탈로그 변경은 하지 않는다.
4. query의 수식어와 제공사 노선 metadata가 실제로 일치하면 해당 POI를 우선 반환한다. `사상역` query에는 같은 이름의 복수 교통 POI·출구/관련 장소를 관련성 순으로 반환한다. 원문 query가 비어 base fallback만 성공하면 같은 역 교통 POI를 보조 제안으로 반환하되, 제공사가 주지 않은 `2호선` 라벨을 합성하지 않는다. 불일치 노선·주소형 이름·무관 상호·수식어 단독은 계속 제외한다.
5. `Poi` 공개 타입 확장이 필요하면 기존 장소 검색·엔진 호출자의 호환성을 유지하고, UIUX에 `direct | transit_variant | base_transit_place | none`과 표시 가능한 label의 출처를 인계한다. 추천 엔진·카탈로그·경로 provider·DB는 수정하지 않는다.
6. fixture로 원문 직접 결과, 원문 0→base fallback의 구조화 역 성공, base 이름이지만 일반 상호/주소인 실패, 노선 metadata 일치/불일치, 두 provider 실패, 호출 수 상한을 검증한다. 실제 API는 이 작업에서 반복 호출하지 않는다.
7. 변경 파일, 변경하지 않은 UI/엔진/데이터 경계, provider별 fallback 호출 수, 테스트 결과, U-1-F-R5 인계 계약을 이 파일에 기록한다. `npm run test:typecheck`, 관련 adapter 테스트, `npm test`, `git diff --check`를 실행한다.

**완료 기준:** `사상역`은 이름 관련 복수 제안을, `사상역 2호선`은 근거 있는 노선별 제안을 반환하며, 보조 제안도 유형·이름 근거를 남긴다. 문자열 추측이나 주소 결과로 문제를 가리는 것은 완료가 아니다.

## 2026-08-26 — 통합·결정 지시 API-4-A: 서버 Route Proxy와 공용 구간 캐시

**목표:** 대표·대안의 표시 전 실제 경로 검증은 유지하면서, 여러 사용자·여러 코스가 공유하는 공개 장소 구간을 재사용하고 ODsay·TMAP 일일 호출량을 통제한다.

1. 현 앱 실행 메모리 캐시와 진단 카운터를 대체·확장할 서버 Route Proxy 계약을 설계한다. API 키는 클라이언트에 두지 않으며, 제공사별 요청·성공·실패·cache hit/miss·동시 요청 합치기를 관찰한다.
2. 공용 장기 캐시는 `provider + mode + directed from/to public POI identity + catalog/route version`의 장소↔장소 구간만 저장한다. 코스 전체를 캐시 키로 쓰지 않는다. TTL·무효화·방향 분리·좌표와 POI ID 불일치 방어를 명시한다.
3. 현재 GPS처럼 개인 위치를 포함하는 출발/도착 구간은 요청 범위 또는 짧은 휘발성 세션에서만 공유하고, 사용자 ID·정밀 GPS·IP를 DB·장기 공용 캐시·운영 분석에 기록하지 않는다. 호출량 집계는 `provider + date bucket + count` 같은 개인 비식별 합계만 저장한다.
4. 제공사별 일일 예산과 초당 제한을 서버에서 원자적으로 적용한다. 한도 근처에서는 cache hit 코스만 우선 검증하고, 새 요청 예산을 초과하면 실제 경로를 추정값으로 바꾸지 말고 명시적 제한/재시도 결과를 반환한다. **정정:** ODsay Basic은 현행 30/일이므로 1,000/일 가정을 사용하지 않는다. 대중교통 제공사·출시 범위 결정 전에는 API-4-A를 구현 시작하지 않는다.
5. 코스 엔진이 코스 수가 아니라 **새 구간 cache miss 수**를 비용으로 보고, 대표+비중첩 대안을 확보하면 검증을 중단할 수 있도록 공개 adapter 계약을 제안한다. 이 단계에서 추천 순위·4개 상한을 임의로 바꾸지 말고, 필요한 엔진 변경은 계약·fixture로만 인계한다.
6. 고정 fixture로 동일 POI 구간의 재사용, 방향/수단 분리, 동시 요청 합치기, TTL 만료, 제공사별 일일 예산 소진, GPS 구간 비영속, 키 미노출, 실제 경로 실패 시 근사값 승격 금지를 검증한다. 실제 API 대량 호출은 금지한다.

**완료 기준:** 구현/설계 경계에 따라 변경 파일, 캐시 키·TTL·보존 정책, 제공사별 예산 동작, 테스트 결과, 엔진·DB에 필요한 계약 변경을 이 문서에 기록한다. `npm run test:typecheck`, 관련 계약 테스트, `npm test`, `git diff --check`가 통과해야 한다.

---

## 2026-08-26 — 통합·결정 지시 API-S-1: 장소명 검색 실패 원인 노출 계약

**관찰 및 사전 검증:** 2026-08-26에 키 값은 출력하지 않고 `.env`의 공개 Kakao REST 설정으로 `사상역` 단건을 조회했다. HTTP `200`, 결과 `15개`, 첫 결과는 `사상역`이었다. 따라서 “실제 Kakao POI가 없다”는 가설은 기각한다. 반면 앱의 `kakaoGet()`은 키 부재·HTTP 401/403/429·응답 형식 오류·네트워크 오류를 전부 빈 배열로 바꾼다. UI는 이 상태와 실제 0개를 구별할 수 없다.

**목표:** 키나 사용자 검색어를 노출하지 않으면서, 앱 번들에서 장소명 검색이 실패한 정확한 단계와 제공사 결과를 UI가 구별할 수 있는 공개 어댑터 계약을 만든다.

1. Kakao·TMAP 장소명 검색의 반환을 빈 배열 하나로 축소하지 않는다. 최소한 `ok`, `unconfigured`, `http_error`(상태 코드), `network_error`, `invalid_response`와 `provider`를 구분하는 결과 타입/오류 타입을 만든다. API 키·Authorization 헤더·원문 응답·정밀 사용자 좌표는 결과/로그/테스트 산출물에 넣지 않는다.
2. 기존 `Poi[]` 공개 호출자를 한 번에 깨지 않도록 호환 wrapper를 유지하거나, 호출자 변경 범위를 명시한다. 장소명 검색 호출자가 원인 상태를 읽을 수 있는 새 계약을 제공하되 추천 경로 adapter·추천 순위·카탈로그는 건드리지 않는다.
3. Expo 앱 런타임에서 `EXPO_PUBLIC_KAKAO_REST_API_KEY`와 TMAP 공개 키가 실제 bundle에 주입되는지 키 값 없이 검증한다. `.env` 수정 뒤 Metro 재시작/캐시 초기화가 필요한지 재현 절차에 명시하고, `npx expo export --platform ios` 또는 동등한 번들 검증을 실행한다.
4. 고정 fetch fixture로 Kakao 성공(`사상역` 같은 이름 관련 POI), 401/403, 429, 네트워크 실패, 문서 배열 누락, 키 미설정, TMAP fallback 성공/실패를 검증한다. 실제 API는 사전 검증 외 추가 반복 호출하지 않는다.
5. 개발 환경에서만 제공사별 요청 시작·종료와 **상태/결과 수**를 관찰 가능하게 한다. 실제 사용자 검색어·좌표·키는 콘솔에도 남기지 않는다. 프로덕션에서는 진단 로그를 기본 비활성으로 둔다.
6. UIUX가 사용할 상태 계약을 인계한다: 양 제공사가 성공하고 이름 필터 뒤 0개일 때만 `장소명 결과가 없어요`; 설정·권한·쿼터·네트워크 오류는 재시도 가능한 별도 안내가 되어야 한다. 이 단계에서는 `PlacePicker` 화면 문구를 직접 수정하지 않는다.

**완료 기준:** iOS 번들에서 `사상역` 장소명 검색 성공 fixture가 목록까지 전달되는 경로, 각 실패 상태의 비밀 비노출, 키 주입 재현 절차, 테스트 결과를 이 문서에 기록한다. UIUX에 넘길 타입·상태표가 있어야 하며 `npm run test:typecheck`, 관련 계약 테스트, `npm test`, `git diff --check`를 통과해야 한다.

---

## 2026-08-26 — 통합·결정 지시 API-S-2: 성공하지만 검색어와 무관한 POI 응답의 원인 검증

**확정 관찰:** 사용자 시뮬레이터에서 장소명 입력 후 완료 진단은 다음과 같았다: Kakao `ok`, TMAP `ok`, raw POI `6`, 정확/접두/포함 이름 일치 `0`, 주소형/상호 제외 `0`, 최종 `0`, stale 응답 `false`. 즉 UI 필터나 늦은 응답이 아니라, 두 제공사가 반환한 POI의 `name`이 입력 이름과 직접 관련되지 않았다. UI는 주소·무관 상호를 허용해 이 문제를 가려서는 안 된다.

1. Kakao·TMAP의 실제 요청 생성 경로를 점검한다: 입력 keyword가 URL의 query/searchKeyword에 그대로 전달되는지, 중심좌표·반경·정렬/검색 유형 파라미터가 keyword 검색 결과를 주변 일반 POI로 바꾸지 않는지, `toPoi`/TMAP 매핑이 제공사 장소명 필드를 주소/다른 필드로 잘못 읽지 않는지를 확인한다.
2. 개인정보 없는 고정 공개 검증으로 `사상역` 같은 대표 역 이름을 각 제공사에 **최대 한 번씩** 실제 호출하거나, 이미 확보한 안전한 응답 fixture로 수행한다. 출력은 키·사용자 입력·좌표·응답 원문·장소명 원문 없이 `원본 수 / 직접 이름 일치 수 / 매핑 후 수 / provider 상태`만 남긴다. 반복 수집·대량 호출은 금지한다.
3. TMAP의 반경/`searchtypCd` 조합이 keyword와 무관한 근처 장소를 반환한다면, 장소명 선택기 경로에서는 그 파라미터를 제거·분리하거나 제공사 문서에 맞는 keyword 검색 모드로 고친다. 경로·추천용 주변 POI 검색의 파라미터는 바꾸지 않는다.
4. Kakao가 동일 키·동일 고정 query에서 관련 결과를 반환하는데 앱 경로에서만 0개라면, UI가 전달한 query의 정규화 길이/요청 시점만 안전하게 추적할 수 있는 계약을 제안한다. 실제 사용자 검색어는 로그에 남기지 않는다. UI가 query를 임의 대체하는 문제가 증명될 때만 UIUX에 인계한다.
5. provider별로 `rawPoiCount`, `directNameMatchCount`, `mappingValidCount`의 개수 계약을 제공한다. `ok`는 HTTP 성공일 뿐 검색어 관련성 보장이 아니라는 점을 문서화한다. UI는 directNameMatchCount 0을 정직한 빈 상태로 표시한다.
6. 고정 fixture로 keyword 보존, 관련 결과 매핑, 관련성 없는 근처 POI, malformed 응답, Kakao/ TMAP 한쪽 실패를 검증한다. API 키·추천 엔진·카탈로그·DB·UI 필터 정책은 변경하지 않는다.

**완료 기준:** 6개 무관 POI의 원인이 요청 파라미터/매핑/런타임 query 전달 중 어느 것인지 근거로 확정되고, 해당 소유 경계에서만 수정 또는 인계된다. `사상역` 같은 고정 장소명은 적어도 한 제공사에서 이름 관련 POI로 매핑되거나, 제공사 제약이면 그 제약과 정직한 UX 상태가 기록돼야 한다.

---

## 2026-08-26 — 통합·결정 지시 API-S-3: 교통 장소명 표기 변형 매칭 계약

**관찰:** API-S-2 이후 `사상역`은 검색되지만 `사상역 2호선`은 비어 있다. 제공사 표기가 `사상역 부산2호선`처럼 도시명 삽입·공백·단어 순서 차이를 가질 수 있는데, 현재 directNameMatch는 정규화한 전체 문자열의 정확/접두/포함만 비교한다.

1. 장소명 검색 어댑터에 공유 가능한 순수 의미 매칭 계약을 둔다. 한글·숫자 정규화 뒤 고유 장소명 토큰과 교통 수식어(예: `2호선`, 경전철)를 분리하고, 제공사 도시 접두어·공백·순서 차이를 무시해 **두 토큰이 모두** 일치하면 관련으로 판정한다.
2. `사상역 2호선 → 사상역 부산2호선`, `부산2호선 사상역 → 사상역 부산2호선`, `사상역 경전철` 같은 고정 fixture를 통과시킨다. 고유 장소명 없이 `2호선`만 입력한 경우에는 이 확장 규칙을 적용하지 않아 전체 역/정류장으로 넓어지지 않게 한다.
3. 주소 문자열·무관 상호·추천 장소 카탈로그에는 이 규칙을 적용하지 않는다. 제공사 `name` 및 공식 별칭/유형이 후속 계약으로 있을 때만 대상으로 하며, UI가 주소를 대신 추측하는 식의 보정은 금지한다.
4. `PlaceSearchResult.metrics.directNameMatchCount`도 같은 계약을 사용해 UI의 최종 필터 수와 진단 의미가 어긋나지 않게 한다. 키·사용자 검색어·좌표·원문 응답은 로그에 넣지 않는다.
5. UIUX가 소비할 순수 함수·타입·fixture를 인계하고, UI 화면은 직접 수정하지 않는다. `npm run test:typecheck`, 관련 adapter 테스트, `npm test`, `git diff --check`를 실행한다.

**완료 기준:** 교통 수식어를 포함한 고유 장소명 검색이 제공사 표기 차이에도 관련 결과를 반환하고, 수식어 단독·주소·무관 상호를 넓히지 않는 계약과 테스트가 남아야 한다.

---

## 2026-08-26 — 외부 API 어댑터 완료: API-S-1 장소명 검색 실패 원인 노출

### 변경 파일과 공개 계약

- `src/engine/kakao.ts`
  - `PlaceSearchResult`를 추가했다. 반환은 `provider`, `status`, `pois`, HTTP 실패일 때만 `statusCode`이며, 상태는 `ok | unconfigured | http_error | network_error | invalid_response`다.
  - 새 `kakaoPoiSearchMultiResult()`가 상태형 계약을 제공한다. 기존 `kakaoPoiSearchMulti(): Promise<Poi[]>`는 결과의 `pois`만 반환하는 호환 wrapper로 유지했다.
  - API 키·Authorization·검색어·좌표·응답 원문은 결과 및 진단에 포함하지 않는다.

- `src/engine/travel.ts`
  - `tmapPoiSearchMultiResult()`에 같은 상태형 계약을 추가했다. 기존 `poiSearchMulti()`는 변경하지 않았다.
  - Kakao/TMAP 모두 개발 환경에서만 `provider / status / resultCount`만 콘솔 관찰하며, 프로덕션 기본 로그는 비활성이다.

- `test/place-search-adapter.test.ts`
  - Kakao `사상역` 성공 fixture, 401/403/429, 네트워크·응답 형식 오류, 키 미설정과 TMAP fallback 성공/429를 검증한다. fixture에는 실키·실검색어·실좌표를 넣지 않는다.

`src/engine/index.ts`는 단일 작성자 경계라 수정하지 않았다. UIUX는 위 모듈의 상태형 함수를 직접 import하거나, 통합 세션이 index export를 조정한 뒤 소비해야 한다.

### UIUX 인계 상태표

| 제공사 시도 결과 | UI 상태 |
| --- | --- |
| 시도한 Kakao·TMAP가 모두 `ok`, 이름 필터 후 결과 0개 | `장소명 결과가 없어요` |
| 어느 한 제공사라도 `unconfigured`, `http_error`(401/403/429 포함), `network_error`, `invalid_response` | 결과 없음과 구별되는 재시도 안내 |
| 한 제공사 `ok` 결과가 있으면 다른 제공사 오류 | 성공 결과는 유지하고, 오류 안내/재시도는 UI 정책으로 별도 표시 |

UI는 `statusCode`를 사용자에게 그대로 노출하지 않고, 401/403은 설정/권한, 429는 잠시 후 재시도, 네트워크/형식 오류는 연결 재시도라는 범주형 안내로 변환한다.

### 키 주입 재현·번들 검증

1. `.env.local` 또는 `.env`에 `EXPO_PUBLIC_KAKAO_REST_API_KEY`, `EXPO_PUBLIC_TMAP_APP_KEY`를 설정한다. 값은 로그·문서·fixture에 넣지 않는다.
2. 변경 뒤 실행 중 Metro를 완전히 종료하고 `npx expo start --clear`로 캐시를 비운 뒤 다시 실행한다. 네이티브 빌드를 사용 중이면 새 번들로 재빌드한다.
3. `npx expo export --platform ios`를 실행해 iOS 번들 단계에서 두 공개 키 이름이 로드되는지 확인한다. 이번 실행은 `.env.local`, `.env`를 로드하고 iOS bundle export에 성공했으며 키 값은 출력하지 않았다.

### 검증과 유지 경계

- `npx tsx --test test/place-search-adapter.test.ts` — 3/3 통과
- `npm run test:typecheck` — 통과
- `npx expo export --platform ios` — 성공 (`dist` 생성, 키 값 미출력)
- `npm run test:ui` — 84 통과 / 1 기존 철회 이력 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과
- 실제 Kakao/TMAP 추가 호출은 하지 않았다.

추천 경로 adapter·추천 순위·카탈로그·PlacePicker 화면·DB 스키마는 변경하지 않았다. 다음 UIUX 세션은 상태표를 소비해 “진짜 0개”와 재시도 가능한 제공사 실패를 구분해야 한다.

---

## 2026-08-26 — 외부 API 어댑터 완료: API-S-2 무관 POI 응답 원인 분리

### 원인과 교체

- **관찰:** 상태형 장소명 요청은 keyword를 `query`/`searchKeyword`로 전달하고, Kakao는 `place_name`, TMAP은 `name`을 우선 매핑한다. 따라서 UI 필터나 매핑이 이름을 주소로 치환한 것이 원인은 아니다.
- **원인:** 장소명 선택기에서 호출하는 상태형 Kakao·TMAP 요청이 중심좌표·반경·주변 정렬을 함께 보냈다. 특히 TMAP의 `searchtypCd=R`과 `radius` 조합은 keyword 관련성보다 주변 POI를 우선시할 수 있어, HTTP `ok`인데 직접 이름 일치가 0인 관찰과 일치한다.
- **교체:** `kakaoPoiSearchMultiResult()` 및 `tmapPoiSearchMultiResult()`의 장소명 검색에서 중심좌표·반경·정렬/검색유형 파라미터를 제거했다. keyword·페이지 크기·좌표계만 보낸다. 기존 `poiSearchMulti()` 등 경로/주변 탐색용 legacy 경계는 변경하지 않았다.
- **상태:** 현행. 실제 API 반복 수집은 하지 않았으며, 제공사별 1회 이하 실제 호출 또는 안전 fixture라는 지시에 따라 고정 fixture로 요청·매핑 계약을 검증했다.

### 추가 공개 계약

- `PlaceSearchResult.metrics`는 `rawPoiCount`, `directNameMatchCount`, `mappingValidCount`를 제공한다. 값은 개수만 가지며 검색어·좌표·장소명 원문·키를 포함하지 않는다.
- `ok`는 HTTP/응답 형식 성공일 뿐 관련성 성공이 아니다. `directNameMatchCount: 0`이면 UI는 무관 장소를 보완해 표시하지 않고 정직한 빈 결과로 처리한다.
- 현재 UI 완료 진단은 provider 상태와 전체 필터 계수를 보존한다. 후속 UIUX가 provider별 `metrics`를 표시·집계할 필요가 있으면 검색어가 아닌 수치만 사용한다.

### 변경 파일·검증

- `src/engine/kakao.ts`: 장소명 요청의 중심좌표 기반 거리 정렬을 제거하고, Kakao raw/매핑/직접 이름 일치 계수를 반환한다.
- `src/engine/travel.ts`: 상태형 TMAP 장소명 요청에서 `centerLat`, `centerLon`, `radius`, `searchtypCd`를 제거하고 같은 계수를 반환한다.
- `test/place-search-adapter.test.ts`: keyword URL 보존, Kakao·TMAP 주변 정렬 파라미터 미전송, 관련/무관 POI 계수, malformed·한 제공사 실패 fixture를 검증한다.
- `npx tsx --test test/place-search-adapter.test.ts` — 4/4 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 87 통과 / 1 기존 철회 이력 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과

UI 필터 정책·추천 엔진·카탈로그·DB는 수정하지 않았다. 실제 기기 재현 시에는 개발 진단의 provider 상태와 수치만 확인하며, 사용자 입력·좌표·장소명 원문은 기록하지 않는다.

---

## 2026-08-26 — 외부 API 어댑터 완료: API-S-3 교통 장소명 표기 변형 매칭

### 제공 계약

- `src/services/placeNameSemanticMatch.ts`
  - `matchPlaceNameQuery(query, providerName)`은 제공사 장소명 전용의 순수 함수이며 `direct | transit_variant | none`을 반환한다.
  - 한글·숫자 정규화 뒤 고유 장소명과 교통 수식어(`N호선`, `경전철`)를 분리한다. 고유 장소명과 수식어가 모두 일치할 때만 도시 접두어 `부산`, 공백, 단어 순서 차이를 허용한다.
  - 수식어만 입력한 경우에는 확장하지 않는다. 주소·무관 상호·추천 카탈로그에는 적용하지 않는다.

- `src/engine/kakao.ts`, `src/engine/travel.ts`
  - `PlaceSearchResult.metrics.directNameMatchCount`가 위 의미 매칭 함수를 사용한다. 따라서 제공사 표기 `사상역 부산2호선`은 `사상역 2호선` 및 `부산2호선 사상역`과 관련으로 계수화된다.

- `test/place-search-adapter.test.ts`
  - 도시 접두·순서·공백 변형 3건, 수식어 단독 및 무관 상호 차단, Kakao 결과 계수의 동일 적용을 고정 fixture로 검증한다.

### UIUX 인계

현재 `src/ui/placeSearchRanking.ts`의 최종 목록 필터는 UIUX 소유라 수정하지 않았다. UIUX 세션은 이 순수 함수를 같은 제공사 `name` 필터에 사용해야 목록 결과와 `directNameMatchCount`의 의미가 일치한다. 주소/상호 보정이나 수식어 단독 확장은 추가하지 않는다.

### 검증·유지 경계

- `npx tsx --test test/place-search-adapter.test.ts` — 5/5 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 87 통과 / 1 기존 철회 이력 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과

UI 화면·추천 엔진·카탈로그·DB와 실제 API 호출은 변경하지 않았다.

---

## 2026-08-26 — 외부 API 어댑터 완료: API-S-4 교통 장소명 제안·fallback 계약

### 변경 파일과 공개 계약

- `src/services/placeNameSemanticMatch.ts`
  - `planTransitPlaceQuery()`가 고유 장소명·교통 수식어·fallback 가능 여부를 순수하게 분리한다.
- `src/services/placeSearchSuggestionAdapter.ts`
  - `searchPlaceSuggestions()`는 각 provider에 원문 query를 먼저 한 번 요청한다. 원문 결과가 `ok`이고 관련 POI가 0개이며 교통 수식어가 있는 경우에만 base-name fallback을 provider별 한 번 추가한다.
  - 결과 `match`는 `direct | transit_variant | base_transit_place | none`이며, `label`은 항상 제공사 `name`이고 `labelSource: 'provider_name'`이다. 노선 라벨을 합성하지 않는다.
  - base fallback은 `providerMetadata.placeType === 'transit_place'`, base 이름 관련성, 요청 노선과 제공사 `lineLabels` 일치가 모두 있어야 한다. 일반 상호·주소·수식어 단독·불일치 노선은 제외한다.
  - 진단은 provider별 `providerCalls`, `fallbackCalls` 개수만 반환하며 query·좌표·키·원문 응답은 담지 않는다.
- `src/engine/kakao.ts`, `src/engine/travel.ts`
  - `Poi.providerMetadata`에 제공사 카테고리 근거로만 `transit_place`를 보존한다. Kakao `category_group_code/category_name`, TMAP `poiCateName/categoryName` 외 별도 데이터 조인은 하지 않는다.
- `test/place-search-adapter.test.ts`
  - 원문 0→base fallback, 구조화 교통 POI와 노선 근거, provider별 fallback 1회 상한, 수식어 단독·무관 결과 차단을 고정 fixture로 검증한다.

### U-1-F-R5 인계

UIUX는 `searchPlaceSuggestions`의 suggestion만 관련성 순으로 표시하고, `label`을 원본 표시값으로 사용한다. `base_transit_place`도 제공사 유형·이름·노선 metadata 근거가 있을 때만 보조 제안으로 표시한다. UI가 주소·상호·카탈로그로 노선 정보를 보정하거나 추가 조회해서는 안 된다.

### 검증과 유지 경계

- `npx tsx --test test/place-search-adapter.test.ts` — 6/6 통과
- `npm run test:typecheck` — 통과
- `npm test` — 74/74 통과
- `git diff --check` — 통과
- 실제 API 반복 호출, UI 화면, 추천 엔진, 카탈로그, DB는 변경하지 않았다.

### 통합 재검토: 완료 기준 미충족 (2026-08-26)

`test/place-search-adapter.test.ts`의 fallback fixture는 `providerMetadata.lineLabels: ['2호선']`를 직접 주입해 통과한다. 그러나 현재 Kakao·TMAP의 실제 `toPoi` 변환은 `category_group_code/category_name`, `poiCateName/categoryName`으로 `placeType`만 만들고 `lineLabels`를 추출하지 않는다. 따라서 실제 provider 응답이 `사상역`만 주는 경우 `sameLines(requestedLines, undefined)`가 거짓이 되어 `base_transit_place`가 반환되지 않는다. API-S-4는 자동 fixture 계약만 완료했으며 실제 adapter 경로의 완료 기준은 충족하지 못했다.

---

## 2026-08-26 — 외부 API 어댑터 완료: API-S-4-R 실제 제공사 노선 metadata 변환 검증

### 교체 기록과 변경 파일

- **이전 방식:** `searchPlaceSuggestions()` 테스트가 `Poi.providerMetadata.lineLabels`를 직접 주입했다.
- **문제/관찰:** Kakao·TMAP 원문 변환은 노선 metadata를 만들지 않아, 실제 fallback 경로에서 요청 노선 일치가 항상 실패했다.
- **교체 방식:** `lineLabelsFromProviderCategoryFields()`가 제공사 카테고리 원문 필드에 실제로 들어 있는 `N호선`·`경전철`만 정규화하여 보존한다. Kakao는 `category_name/category_group_code`, TMAP은 `poiCateName/categoryName`만 전달한다. token이 없으면 `lineLabels`를 생략한다.
- **교체 이유:** 장소명·사용자 query·주소·외부 역 인덱스를 근거로 특정 노선을 합성하지 않고, `base_transit_place`가 실제 adapter 변환 결과에서만 만들어지게 하기 위해서다.
- **상태:** 현행. 실제 제공사 호출은 하지 않았고, 고정 원문 fixture로만 검증했다.

변경 파일은 `src/services/placeNameSemanticMatch.ts`, `src/engine/kakao.ts`, `src/engine/travel.ts`, `test/place-search-adapter.test.ts`, 이 작업기록이다. UI, 추천 엔진, 카탈로그, DB, 별도 역 데이터 인덱스는 수정하지 않았다.

### 실제 변환 경로 증거

| ID | test/function evidence | 결과 | provider metadata 한계 |
| --- | --- | --- | --- |
| APIS4R-01 | Kakao 원문 `category_name` → `kakaoPoiSearchMultiResult()` → `Poi.providerMetadata.lineLabels` → `searchPlaceSuggestions()` | 통과: `base_transit_place`, label `사상역`, `provider_name` | `category_name/category_group_code`의 literal token만 보존 |
| APIS4R-02 | TMAP 원문 `poiCateName` → `tmapPoiSearchMultiResult()` → `Poi.providerMetadata.lineLabels` → `searchPlaceSuggestions()` | 통과: `base_transit_place`, label `사상역`, `provider_name` | `poiCateName/categoryName`의 literal token만 보존 |
| APIS4R-03 | 노선 token 없는 Kakao 교통 카테고리 → 실제 변환·fallback | 통과: suggestion 없음, `lineLabels` 및 `2호선` 합성 없음 | `transit_place`만으로는 요청 노선을 통과하지 않음 |
| APIS4R-04 | 다른 노선 Kakao 교통 카테고리와 일반 상호 TMAP 카테고리 → 실제 변환·fallback | 통과: suggestion 없음 | 이름·주소·query에 있는 token은 metadata로 사용하지 않음 |

| 공개 계약 | type/function | UI 소비 가능 여부 | 합성 금지 한계 |
| --- | --- | --- | --- |
| 제공사 노선 근거 | `Poi.providerMetadata.lineLabels?: string[]` | 가능. `searchPlaceSuggestions()` 결과의 `poi`에서 읽을 수 있음 | 카테고리 원문에 literal `N호선`·`경전철`가 없으면 필드 생략 |
| 노선 추출 | `lineLabelsFromProviderCategoryFields()` | adapter 내부 경계에서 사용 | 장소명·검색어·주소·카탈로그·외부 인덱스를 입력으로 받지 않음 |
| 제안 표시 | `searchPlaceSuggestions()`의 `suggestion(match, label, labelSource)` | 가능. label은 provider 원본 이름 | `base_transit_place`는 교통 유형·base 이름·노선 metadata가 모두 일치할 때만 반환 |

### 호출량·검증

| 구분 | fixture diagnostic | provider별 원문/fallback 호출 | 실제 API |
| --- | --- | --- | --- |
| APIS4R-01/02 성공 fixture | `providerCalls: { kakao: 2, tmap: 2 }`, `fallbackCalls: { kakao: 1, tmap: 1 }` | 각 제공사 원문 1회 + base fallback 1회 | 0회 |
| APIS4R-03/04 차단 fixture | 원문 관련 결과 0일 때만 같은 상한 적용 | 각 제공사 최대 원문 1회 + fallback 1회 | 0회 |

- `npx tsx --test test/place-search-adapter.test.ts` — 9/9 통과 (APIS4R-01~04 포함)
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 88 통과 / 기존 철회 이력 1 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과

다음 UIUX 세션은 `searchPlaceSuggestions()`의 `label`을 그대로 표시하고, `base_transit_place`를 위 metadata 근거가 있는 경우에만 보조 제안으로 사용할 수 있다. 제공사 카테고리에 노선 token이 없는 결과는 원본 장소명만 표시 가능하며, UI가 노선을 보정하거나 합성해서는 안 된다. 통합·결정 세션은 이 증거를 바탕으로 API-S-4 보드 완료 여부만 판단한다.

---

## 2026-08-26 — 통합·결정 지시 API-S-4-R: 실제 제공사 노선 metadata 변환 검증

### 1. 사용자 행동과 범위

- **사용자 행동:** 사용자가 `사상역 2호선`을 검색하면, 제공사가 실제 노선 근거를 준 경우에만 관련 역 POI가 제안 계약으로 반환된다. 제공사가 노선 근거를 주지 않으면 앱은 `2호선`이라는 라벨을 지어내지 않는다.
- **이 작업의 끝:** UI 화면을 바꾸는 것이 아니라, UIUX가 그대로 소비할 `searchPlaceSuggestions()` 공개 결과가 실제 provider 원문 변환에서 위 행동을 만족함을 증명하는 것이다.
- **수정 범위:** API adapter·순수 서비스·adapter 테스트만 수정한다. UI, 추천 엔진, 카탈로그, 별도 역 데이터 인덱스, 실제 API 호출은 수정·추가하지 않는다.

### 2. 반드시 거쳐야 하는 실제 실행 경로

아래 전 경로를 하나의 고정 fixture로 실행해야 한다. `Poi.providerMetadata`나 `lineLabels`를 `searchPlaceSuggestions()`에 직접 넣는 fixture는 **증거로 인정하지 않는다.**

```text
제공사 원문 응답 fixture
  → kakaoPoiSearchMultiResult() 또는 tmapPoiSearchMultiResult()의 실제 변환
  → Poi.providerMetadata.lineLabels
  → searchPlaceSuggestions()
  → UIUX가 소비할 suggestion(match, label, labelSource)
```

### 3. 구현·검증 항목

1. Kakao `category_name/category_group_code`, TMAP `poiCateName/categoryName` 등 현재 실제 변환이 받는 **제공사 원문 필드만** 대상으로 `N호선`·`경전철` 토큰을 추출한다. 장소명·사용자 query·주소·외부 인덱스로 토큰을 추론하지 않는다.
2. token이 실제 원문 필드에 있을 때만 정규화한 `lineLabels`를 `Poi.providerMetadata`에 넣는다. token이 없으면 필드를 비우거나 생략한다. `placeType: transit_place`만으로 특정 노선을 통과시키지 않는다.
3. 최소 아래 네 증거 fixture를 실제 실행 경로로 추가한다.

| ID | 원문 입력 | 기대 공개 결과 |
| --- | --- | --- |
| APIS4R-01 | Kakao 노선 token 포함 교통 카테고리 | `사상역 2호선`의 `base_transit_place`, provider 원본 label |
| APIS4R-02 | TMAP 노선 token 포함 교통 카테고리 | 같은 결과 또는 TMAP 원본 label |
| APIS4R-03 | 교통 유형이나 노선 token 없음 | `base_transit_place` 없음, `2호선` 합성 없음 |
| APIS4R-04 | 일반 상호/주소 또는 다른 노선 token | 결과 없음 |

4. 해당 제공사의 문서화된 원문 필드에 노선 token이 없거나 고정 안전 fixture로 재현할 수 없다면, 해당 provider를 억지로 성공시키지 않는다. `APIS4R-03` 경로로 명시하고 UIUX에는 “원본 장소명만 표시 가능”이라고 인계한다.
5. 실제 API 추가 호출은 하지 않는다. provider별 원문 fixture·호출 횟수·fallback 상한은 테스트 내에서만 검증하며, query·좌표·키·원문 전문은 로그·완료 기록에 남기지 않는다.

### 4. 완료 판정과 인계 기록

완료 기록에는 반드시 아래 표를 채운다.

| 항목 | 근거 위치 | 결과 | 남은 제한 |
| --- | --- | --- | --- |
| APIS4R-01~04 | 테스트명·실제 adapter 함수 | 통과/실패 | provider별 metadata 범위 |
| 공개 계약 | 타입/함수 경로 | UIUX 소비 가능 여부 | 합성 금지 범위 |
| 호출량 | fixture 진단 | provider별 원문/fallback 수 | 실제 API 0회 |
| 테스트 | 실행 명령 | 결과 | 미실행 사유 |

- `npm run test:typecheck`, 관련 adapter 테스트, `npm test`, `git diff --check`를 실행한다.
- 네 항목 중 하나라도 fixture 직접 주입, 실제 adapter 미경유, 미실행이면 **완료로 기록하지 않는다.** 원인과 함께 `조건부 완료` 또는 `차단`으로 기록한다.
- 통합·결정 세션만 작업 조정 보드의 `완료` 상태를 확정한다. 이 세션은 구현·검증 결과와 위 표만 기록한다.

**완료 기준:** APIS4R-01~04가 실제 원문→adapter→suggestion 경로로 증명되고, U-1-F-R5가 소비할 provider별 `lineLabels` 보장 범위와 합성 금지 범위가 명시돼야 한다.
