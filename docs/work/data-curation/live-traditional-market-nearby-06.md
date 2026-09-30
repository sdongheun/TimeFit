# DATA-LIVE-TRADITIONAL-MARKET-NEARBY-06 — 전통시장 정적 원천의 주변 정보 탐색

상태: **데이터 read model·고정 fixture 완료 / UI 표시 provenance·실기기 확인 후속**  
기준일: 2026-09-23  
실제 API·Simulator·운영 DB 호출: **0회**

## 결정과 교체 이력

이전 방식 → live ON 주변 read model은 TourAPI·부산 exact 연결 251곳만 후보로 내고, `traditional_market_only` 118곳은 모두 `provider_out_of_scope`로 표시했다. OFF 경로는 기존 번들 369곳을 사용했다.

관찰 → 118곳에는 TourAPI·부산 exact live mapping 및 검증된 운영시간이 없지만, 기존 검토 카탈로그에 `traditional_market_standard` 원천 ID·제목·주소·좌표가 있다. 이들을 두 live 공급자의 사실이나 자동 추천 후보로 다루는 것은 잘못이다.

교체한 방식 → 검토 카탈로그에서 118곳의 최소 장소 사실(`placeId/sourceId/title/address/lat/lon`)만 별도 결정적 `traditional_market_browse_snapshot.json`으로 추출한다. live ON **주변 둘러보기 read model**에서만 `sourceKind=traditional_market_standard_static`, `operatingHoursStatus=unverified`, `informationOnly=true`, `provenance=traditional_market_standard`, provider state `static_snapshot`으로 결합한다. 사진·설명·운영시간 값은 스냅샷에 넣지 않는다. exact 251곳은 계속 live 사실만 사용한다.

교체 이유 → 시장의 정보 확인·길찾기 접근성을 보존하면서, 저장 사실을 live 공급자 응답이나 영업 중 확신으로 위장하지 않기 위해서다.

상태 → **데이터 구현 현행**. 추천 적격성 확대·시장 118곳 대표 승격·사용자 기록 저장은 **구현하지 않음**.

## 재현 가능한 집계와 실패 계약

| 고정 입력/상태 | live 사실 후보 | 정적 시장 정보 후보 | 합계/상태 |
| --- | ---: | ---: | --- |
| TourAPI·부산 전부 active | 251 | 118 | 369 / ready |
| TourAPI 장애, 부산 active | 132 | 118 | 250 / partial |
| 부산 장애, TourAPI active | 139 | 118 | 257 / partial |
| 두 live 공급자 장애, facade snapshot은 유효 | 0 | 118 | 118 / partial |
| snapshot 불일치·facade 초기화 실패 | 0 | 0 | unavailable/failed, 재시도 필요 |

시장 118곳은 모두 `conditional_more`, 기존 `operatingHours` 0곳, TourAPI·부산 exact 연결 0곳이다. 별도 정적 스냅샷은 118개 고유 내부 ID와 118개 고유 원천 ID를 보존하고, photo/hours 필드는 0개다. 이는 시장 영업이나 접근 경로의 현재 상태를 검증했다는 뜻이 아니다. 기존 `conditionalVisit.displayWindow` 10:00–18:00은 정보 확인용 범위이며 실제 영업시간으로 사용하지 않는다.

`src/ui/nearbyLiveSession.ts`는 유효한 facade snapshot의 `partial` 결과를 소비한다. 두 live 공급자 모두 unavailable인 고정 fixture에서 read model은 정적 시장 118개만 내고, 현재 UI catalog adapter도 정확히 118개를 전달한다(운영시간·사진 값 0). facade 자체 실패·snapshot 불일치는 기존 UI의 실패·명시 재시도 화면을 유지하며, 이때 정적 시장만으로 성공 화면을 꾸미지 않는다. `partial`은 **live 성공이 아니라 정적 시장만 표시할 수 있는 부분 결과**다. UI 역할은 시장 행에 **“전국전통시장표준데이터 저장 정보 · 운영시간 확인 필요”**와 정적 정보임을 표시하고, 길찾기 전 영업·출입을 사용자에게 확인하도록 안내해야 한다. 현재 UI adapter는 provenance를 표시 필드로 전달하지 않으므로 이 문구는 아직 화면에 구현되지 않았다. UI가 이를 연결할 때까지 원천 표시 수락 조건은 미완료다.

## 변경 파일과 보존 경계

- `scripts/build_traditional_market_browse_snapshot.mjs`: 기존 검토 카탈로그와 exact mapping에서 118곳만 추출하고 source ID·분류·운영시간 부재·중복을 fail-fast 검증한다.
- `src/data/traditional_market_browse_snapshot.json`: 데이터 최소 정적 원천. 원본 전체 카탈로그를 대체하거나 삭제하지 않는다.
- `src/data/liveNearbyReadModel.ts`: live ON 정보 탐색 projection에만 정적 시장을 분리 결합한다. snapshot 거부 시에는 후보 0개로 닫는다.
- `test/live-nearby-read-model.test.ts`: exact ID·원천·미확인 운영시간·부분/전체 공급자 장애·identity 충돌을 고정한다.
- 본 문서: 결과·UI 인계·잔여 위험 기록.

추천 엔진, 코스/체류/저장·과거 기록, OFF 주변 경로, 운영시간·대표 등급·사진 권리, UI·DB·외부 API adapter와 중앙 정책 문서는 변경하지 않았다. 특히 118곳을 TourAPI/부산 ID에 이름·좌표 유사도로 자동 연결하지 않았다.

## 검증과 후속 위험

- 실패 우선: read model 고정 테스트 6건 중 신규 1건 `251 !== 369`으로 RED 확인.
- 구현 후 read model 고정 테스트 8/8 통과. 생성 스냅샷 SHA-256 재실행 동일 (`0763c3ea86cb51fda7bc6d1daaf5eb03f87906c15c6ad71c177728d77056c5e0`).
- `npm run test:typecheck` 통과. `npm run test:ui` 861 통과·1 skip·실패 0. `npm test` 602/602 통과. `git diff --check` 통과.
- UI 세션은 먼저 이 문서와 `src/data/liveNearbyReadModel.ts`를 읽고, 첫 검증으로 live ON 화면의 시장 1곳에서 정적 출처·운영시간 미확인·길찾기·사진 fallback을 확인한다. OFF와 추천 결과에 시장 118곳이 새로 유입되지 않는 것도 fixture로 검사한다.
- 정적 시장 이름·주소·좌표는 검토 당시 snapshot으로, live 수정·폐지에 자동 동기화되지 않는다. 원천 갱신/삭제 주기 및 실경로·접근시간 검증 없이 자동 추천으로 승격하면 안 된다.
