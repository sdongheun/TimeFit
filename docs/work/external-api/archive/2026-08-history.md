# 외부 API 작업기록

> 외부 API 어댑터 역할의 상세 지시와 완료 기록만 남긴다. 추천 순위·화면·원본 장소 데이터·DB 정책은 수정하지 않는다.

## 2026-08-26 — 통합·결정 지시 API-S-7: GPS 주소 표시·해안 지도 핀 지역 fallback·메모리 cache

**결정 변경:** 기존 API-S-6은 핀을 명시 확정할 때만 주소를 찾았다. 사용자는 `경로 설정하기`를 연 직후에도 이미 허용된 기기 위치의 **주소**를 봐야 하고, 해운대해수욕장처럼 도로명/지번이 없는 지도 좌표도 선택할 수 있어야 한다. 따라서 역지오코딩은 `핀 확정`뿐 아니라 `이미 허용된 GPS 출발지의 주소 라벨`에도 사용한다. 지도 이동 중 0회라는 원칙은 유지한다.

**목표:** API-S-6의 단발 함수 대신, 앱 실행 중에만 유지되는 Kakao 위치 라벨 adapter를 제공한다. 도로명/지번 주소를 우선하고, 성공 응답이지만 주소가 비어 있을 때만 Kakao `coord2regioncode`를 한 번 보조 호출해 provider 행정구역을 돌려준다. 이것은 해변·공원 등 주소 없는 좌표의 선택 가능성을 높이되, 장소명을 추측하거나 키워드/다른 제공사를 호출하지 않는다. Kakao는 좌표→주소와 좌표→행정구역 API를 별도로 제공하며, 도로명 주소가 좌표에 따라 없을 수 있다. [Kakao Local API 문서](https://developers.kakao.com/docs/en/kakaomap/rest-api)

### 공개 계약과 호출 상한

1. `createKakaoLocationLabelAdapter()` 같은 공개 factory를 `src/services/`에 둔다. UI가 호출할 entry는 `resolve(point, purpose: 'gps_auto' | 'pin_confirm')` 하나다. `purpose`는 요청·로그·DB·진단에 주소/좌표를 남기지 않는 제어 값일 뿐, 결과 순위나 제공사를 바꾸지 않는다.
2. 결과에는 `provider: 'kakao'`, 기존 typed status, `label?`, `address?`, `source: 'address' | 'region' | 'unresolved'`, 안전한 요청 수(`address: 0|1`, `region: 0|1`, `tmap: 0`, cache 상태)만 둔다. 주소는 provider가 준 도로명/지번만 `source: 'address'`로 표기한다. 지역 fallback은 provider `address_name`만 사용하고, UI가 `인근`을 붙일 수 있도록 `source: 'region'`으로 명확히 구분한다.
3. 한 cache miss에서 주소 API는 최대 1회다. 주소가 `ok`인데 label이 없을 때만 region API를 최대 1회 추가한다. HTTP/권한/네트워크/형식 오류에는 region·키워드·TMAP fallback을 하지 않는다. region도 없으면 typed `ok + source: 'unresolved'`로 끝낸다.
4. 성공한 address/region/unresolved 결과만 앱 프로세스 메모리 LRU(최대 64, 10분 TTL)와 같은 진행 요청 합치기에 넣는다. key는 정밀 좌표를 외부에 내보내지 않는 내부 정규화 좌표이며 AsyncStorage·서버·DB·로그·fixture 출력에 저장하지 않는다. 실패 결과는 cache하지 않는다. 같은 GPS/핀 위치의 반복 진입은 cache/in-flight를 재사용한다.
5. `gps_auto`와 `pin_confirm`의 결과 타입은 같지만 UI는 다음 원칙으로 소비한다: GPS에는 address/region label을 출발지 라벨로 바로 표시하고 실패에는 `현재 위치`를 유지한다. 핀은 명시 확정에서만 호출하며 address/region이면 선택을 완료하고, unresolved/typed 실패면 좌표 선택·검색 대안을 유지한다. 이 소비는 U-1-F-R8의 UI 소유다.
6. raw Kakao fixture → 실제 주소/region 변환 → 공개 adapter 경로로 최소를 검증한다: 주소 성공, 주소 없음→region 성공, 주소 없음→region 없음, 401/429, network/키 없음/형식 오류, 10분 hit·만료, 같은 좌표 10개 in-flight, 실패 재요청. fixture에는 실제 사용자 좌표·키·원문 진단을 넣지 않고 실제 외부 API도 호출하지 않는다.

**금지·소유 경계:** UI, `src/ui/`, 추천 엔진, 카탈로그, DB를 수정하지 않는다. 해변 좌표에 임의로 `해운대해수욕장` 같은 POI 이름을 붙이거나 Kakao keyword search/TMAP을 fallback으로 호출하지 않는다.

**완료 기준:** UI가 GPS 자동 라벨과 핀 확정을 같은 안전한 공개 adapter로 소비할 수 있고, 지도 이동 0회·새 좌표당 최대 address 1 + 조건부 region 1·TMAP 0·성공 TTL/in-flight 재사용·실패 재요청을 fixture로 증명한다.

## 2026-08-26 — 외부 API 어댑터 완료: API-S-7 GPS 주소·핀 지역 fallback·메모리 cache

### 교체 기록과 변경 파일

- **이전 방식:** API-S-6은 핀 확정에서만 단발 Kakao 주소 조회를 했고, 주소 없는 성공 좌표를 typed `ok`로만 반환했다.
- **문제/관찰:** GPS 출발지의 주소 라벨을 같은 경계로 재사용할 수 없고, 해변·공원처럼 도로명/지번이 없는 좌표에는 provider 행정구역을 보조 라벨로 쓸 계약이 없었다.
- **교체 방식:** `src/services/kakaoLocationLabelAdapter.ts`의 `createKakaoLocationLabelAdapter().resolve(point, purpose)`를 추가했다. 주소 API가 `ok`이면서 주소가 비어 있을 때만 Kakao region API를 한 번 호출한다. 성공 address/region/unresolved만 프로세스 메모리 LRU(64개, 10분 TTL) 및 in-flight로 재사용하고 실패는 저장하지 않는다.
- **교체 이유:** GPS 자동 라벨과 핀 확정을 단일 안전 경계로 통합하되, POI 이름·키워드 검색·다른 provider를 추측 fallback으로 사용하지 않기 위해서다.
- **상태:** 현행. 실제 외부 API 호출은 0회다.

- `src/engine/kakao.ts`: `kakaoRegionCodeResult()`를 추가했다. Kakao `coord2regioncode` 원문의 `address_name`만 provider 지역 라벨로 변환한다.
- `src/services/kakaoLocationLabelAdapter.ts`: `gps_auto | pin_confirm` 공용 factory, 상태형 address→조건부 region 순서, 성공 전용 LRU/TTL/in-flight 경계를 제공한다. 내부 정규화 좌표 key는 메모리에만 존재하며 결과·진단·로그·저장소에는 포함하지 않는다.
- `test/kakao-location-label-adapter.test.ts`: raw Kakao fixture → 실제 address/region 변환 → 공개 adapter 전체 경로를 검증한다.

### UIUX 공개 결과와 호출 상한

| 항목 | 계약 | 합성·호출 금지 경계 |
| --- | --- | --- |
| entry | `resolve(point, purpose: 'gps_auto' | 'pin_confirm')` | purpose는 제어값일 뿐 provider·결과·cache key를 바꾸지 않음 |
| result | `provider`, typed `status`, 선택적 `label/address`, `source: address | region | unresolved` | address는 도로명/지번, region은 provider `address_name`만 사용 |
| 진단 | `address: 0|1`, `region: 0|1`, `tmap: 0`, `cache: miss | hit | shared_in_flight` | 좌표·key·검색 이력·원문·키 미노출 |
| 새 cache miss | address 최대 1회; 주소가 `ok`이고 비어 있을 때만 region 최대 1회 | HTTP/권한/network/형식 오류 때 region·keyword·TMAP fallback 금지 |

`gps_auto`는 `address/region` label을 출발지에 바로 표시하고 실패면 `현재 위치`를 유지한다. `pin_confirm`은 명시 확정시에만 호출한다. `unresolved` 또는 typed 실패는 좌표 선택·검색 대안을 유지하며 provider 주소로 위장하지 않는다. 지도 이동·탭·드래그 0회 / confirm 호출은 U-1-F-R8 UIUX fixture의 소유다.

### 실제 변환 fixture·cache 결과

| ID | 실제 경로 | 결과 |
| --- | --- | --- |
| APIS7-01 | Kakao 도로명 원문 → address 변환 → adapter | `source: address`, address 1 / region 0 / TMAP 0 |
| APIS7-02 | 주소 없는 `ok` 원문 → region 원문 변환 → adapter | `source: region`, address 1 / region 1 / TMAP 0 |
| APIS7-03 | 주소·region 모두 없는 성공 원문 | `ok + source: unresolved`, 이름·주소 합성 없음 |
| APIS7-04 | address 401/429·network·키 없음·형식 오류 | typed failure, region·다른 provider 0회, cache 저장 없음 |
| APIS7-05 | 성공 address/region/unresolved, 동일 좌표 10개 동시, TTL 만료 | in-flight 1회 + shared 9회, 10분 hit, 만료 뒤 miss 재요청 |
| APIS7-06 | 같은 좌표 실패 뒤 GPS/핀 재resolve | 두 번 모두 miss, 실제 address 요청 2회 |

### 검증·유지 경계·다음 인계

- `npx tsx --test test/kakao-location-label-adapter.test.ts` — 6/6 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 97 통과 / 기존 철회 이력 1 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과

UI, 추천 엔진, 카탈로그, DB·AsyncStorage는 수정하지 않았다. U-1-F-R8은 앱 화면 수명 동안 이 factory 인스턴스를 재사용하고, 지도 이동 중 호출하지 않으며 GPS 권한 확정·핀 confirm에서만 `resolve()`를 호출해야 한다. 실제 Kakao/TMAP API 호출은 0회다.

## 2026-08-26 — 통합·결정 지시 API-S-6: 지도 핀 확정용 Kakao 역지오코딩 계약

**발생한 문제:** U-1-F-R6은 지도 이동·핀 드래그 중 주소 요청을 0회로 유지했지만, 핀을 `이 위치로 선택`할 때도 주소 확인이 0회다. 좌표만 확정하면 이후 출발/도착 라벨이 `선택 위치`처럼 의미를 잃는다. UI가 `src/engine/kakao.ts`를 직접 호출하면 API-S-5의 공개 adapter·실패 관찰 경계를 우회한다.

**목표:** 지도 핀을 명시 확정할 때만 Kakao 역지오코딩을 정확히 한 번 수행하는 공개 adapter 계약을 만든다. 지도 이동 중에는 호출하지 않으며, 좌표·검색 이력은 영구 저장하거나 로그에 남기지 않는다.

1. 외부 API 소유 모듈에 좌표 입력과 상태형 결과를 분리한다. 최소 결과는 `provider: 'kakao'`, `status(ok|unconfigured|http_error|network_error|invalid_response)`, provider가 준 `label/address` 또는 실패 이유이며, UI가 주소를 추측할 필요가 없어야 한다. 키·Authorization·원문 응답·좌표는 로그·진단·DB·fixture 산출물에 넣지 않는다.
2. `reverseGeocodeSelection(lat, lon)` 같은 단일 공개 진입점을 제공한다. 이것은 핀 확정시에만 UI가 호출할 계약이며, 지도 탭/드래그·마커 이동에는 호출하지 않는다는 호출자 책임을 문서화한다. TMAP·장소/주소 검색 fallback을 추가하지 않는다.
3. Kakao 응답의 도로명/지번 중 provider가 준 실제 주소만 라벨로 사용한다. 성공하되 주소가 없거나 실패하면 typed 결과를 반환한다. UI는 이 경우 좌표 선택을 취소시키지 않고, 좌표 기반 임시 라벨 또는 검색 대안을 선택할 수 있게 한다. 임시 라벨은 제공사 주소로 위장하지 않는다.
4. 고정 raw Kakao fixture → 실제 변환 → 공개 결과의 성공, 주소 없음, 401/429, 네트워크, 키 미설정, 형식 오류를 검증한다. adapter 자체는 호출될 때 요청을 정확히 한 번 만들고 중복 재시도하지 않는다는 fixture를 둔다. `map move 0회 / confirm 1회`은 지도 상태를 아는 UIUX 소유의 U-1-F-R7 fixture가 검증한다. 실제 API 호출은 0회다.
5. UI, 추천 엔진, 카탈로그, DB를 수정하지 않는다. U-1-F-R7에 넘길 타입·성공/실패 표시 원칙·한 confirm당 한 요청이라는 경계를 이 문서에 기록한다.

**완료 기준:** UIUX가 핀 확정에서만 공통 adapter를 한 번 호출해 provider 주소 또는 typed 실패를 받을 수 있고, 지도 이동 중 요청 0회·TMAP 0회·개인 좌표 비영속이 fixture로 검증된다.

## 2026-08-26 — 외부 API 어댑터 완료: API-S-6 지도 핀 확정용 Kakao 역지오코딩 계약

### 변경 파일과 공개 계약

- `src/engine/kakao.ts`
  - `kakaoReverseGeocodeResult()`를 추가했다. Kakao 원문 `road_address`를 우선하고 그 다음 지번 주소만 `label/address`로 반환한다.
  - 상태는 기존 `ok | unconfigured | http_error | network_error | invalid_response`와 HTTP 실패의 `statusCode`를 보존한다. 성공했지만 provider 주소가 없으면 주소를 추측하지 않는 `ok` 결과를 반환한다.
  - 기존 `kakaoReverseGeocode(): Promise<string | null>` 호환 wrapper는 유지했다.
- `src/services/kakaoReverseGeocodeAdapter.ts`
  - UIUX 공개 진입점 `reverseGeocodeSelection(lat, lon)`을 추가했다. 이는 **지도 핀 명시 확정에서만** 호출하며, 재시도·장소/주소 검색 fallback·TMAP 호출을 추가하지 않는다.
  - `ReverseGeocodeSelectionResult`는 provider, status, 선택적 provider 원본 `label/address`, source, 안전한 요청 수 진단만 반환한다. 좌표·키·Authorization·원문 응답은 결과·진단·로그에 넣지 않는다.
- `test/kakao-reverse-geocode-adapter.test.ts`
  - raw Kakao fixture → 실제 역지오코딩 변환 → 공개 adapter의 전체 경로를 검증한다.

| 결과 상태 | UIUX 처리 원칙 | 요청/표시 경계 |
| --- | --- | --- |
| `ok` + `label/address` | provider 원본 주소를 핀 선택 라벨로 표시 | confirm 1회에 Kakao 1회, TMAP 0회 |
| `ok` + 주소 없음 | 좌표 선택은 유지하고, provider 주소로 위장하지 않는 임시 좌표 라벨 또는 검색 대안을 UI가 선택 | 추가 역지오코딩·검색 없음 |
| `unconfigured`, `http_error`, `network_error`, `invalid_response` | 선택을 취소하지 않고 재시도/검색 대안을 안내 | typed 상태만 소비, 주소 추측 없음 |

### fixture 결과·유지 경계

| ID | 실제 adapter 경로 | 결과 |
| --- | --- | --- |
| APIS6-01 | Kakao 원문 도로명/지번 → `kakaoReverseGeocodeResult()` → `reverseGeocodeSelection()` | 도로명 우선 provider label/address, fetch 1회 |
| APIS6-02 | 주소 없는 성공 원문 → 실제 변환 | label/address 없는 typed `ok`, 합성 없음 |
| APIS6-03 | 401/429 원문 응답 → 실제 변환 | `http_error`와 statusCode, retry/fallback 없음 |
| APIS6-04 | network·키 미설정·형식 오류 → 실제 변환 | typed failure, label/address·좌표·원문 미노출 |

- `npx tsx --test test/kakao-reverse-geocode-adapter.test.ts` — 4/4 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 92 통과 / 기존 철회 이력 1 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과
- 실제 Kakao/ TMAP API 호출은 0회다.

UI, 추천 엔진, 카탈로그, DB·영구 저장소는 수정하지 않았다. U-1-F-R7은 지도 이동·탭·핀 드래그에서 이 adapter를 호출하지 않고, 사용자가 `이 위치로 선택`을 누른 한 번의 confirm에서만 `reverseGeocodeSelection()`을 호출해야 한다. 지도 이동 0회 / confirm 1회는 UIUX fixture의 소유 범위다.

## 2026-08-26 — 통합·결정 지시 API-S-5-R: 위치검색 실패 재시도·노선 근거 보완

**발생한 문제:** API-S-5는 Kakao 단일 검색, 10분 메모리 TTL, 동일 요청 합치기를 구현했지만 두 공개 계약이 U-1-F-R6의 완료 기준에 미달한다.

- 현재 adapter는 `network_error`, `http_error`, `unconfigured`, `invalid_response` 같은 실패 결과도 TTL cache에 넣는다. 따라서 UI가 재시도를 안내해도 같은 검색어는 최대 10분 동안 실제 재요청 없이 이전 실패를 돌려줄 수 있다.
- 기존 `Poi.providerMetadata.lineLabels`가 새 `LocationSuggestion` 변환에서 소실된다. UI는 provider가 준 노선 라벨을 보존해야 하지만, 이를 추측하거나 별도 검색할 수 없다.

**목표:** 성공 검색만 10분 TTL로 재사용하고, 제공사가 준 노선 라벨만 공통 위치 제안에 보존한다. 이 작업은 UI 화면 구현이 아니라 U-1-F-R6의 안전한 소비 계약 보완이다.

### 구현 범위

1. `createKakaoLocationSearchAdapter()`의 cache 정책을 다음처럼 고정한다.
   - 첫 검색 및 필요한 반대 유형 fallback의 **모든 attempt가 `ok`**인 결과만 TTL LRU에 저장한다. 성공했지만 제안이 0개인 결과도 cache할 수 있다.
   - `unconfigured`, `http_error`, `network_error`, `invalid_response`가 한 attempt라도 있으면 완료 뒤 cache에 저장하지 않는다. 다음 명시 검색은 실제 Kakao 요청을 다시 할 수 있어야 한다.
   - 동일 실패 요청이 진행 중인 동안에는 기존처럼 in-flight Promise 하나를 공유한다. 완료 뒤에는 해당 in-flight key를 반드시 제거한다.
   - 오류 결과를 성공 결과로 바꾸거나, 오류 때 반대 유형 fallback을 추가 호출하지 않는다. fallback은 계속 `첫 attempt === ok && 0건`일 때만 한 번이다.
2. `LocationSuggestion`에 provider가 실제 준 `lineLabels`를 선택적으로 보존한다. 라벨이 없으면 필드를 생략하고, UI가 `2호선` 등 문자열을 합성할 여지를 주지 않는다. 라벨의 출처가 provider임을 타입/필드 이름으로 명확히 한다.
   - `kind`, `label`, `address`, 좌표 및 privacy 경계는 API-S-5 계약을 유지한다.
   - API-S-4-R의 `Poi.providerMetadata.lineLabels` 이외의 추천용 내부 분류·점수는 새 위치 제안 계약에 넣지 않는다.
3. UI, `src/ui/`, 추천 엔진 정책, TMAP 장소 검색, 카탈로그, DB·영구 저장소는 수정하지 않는다. 실제 Kakao API는 호출하지 않는다.

### 필수 fixture·검증

원문 Kakao fixture → 기존 실제 Kakao 변환 → 위치 adapter 공개 결과의 경로로 아래를 검증한다. cache 결과나 line label을 fixture에 직접 주입해서는 안 된다.

| ID | 고정 행동 | 기대 계약 |
| --- | --- | --- |
| APIS5R-01 | 같은 검색이 일시 `network_error` 후 다시 검색 | 두 검색 모두 cache `miss`, Kakao 실제 요청 2회. 완료된 실패는 TTL hit가 아님 |
| APIS5R-02 | `http_error` 또는 fallback 중 오류 뒤 다시 검색 | 실패 attempt가 포함된 결과는 저장되지 않으며, fallback 상한·요청 순서가 API-S-5와 동일 |
| APIS5R-03 | 성공 장소/주소 검색 및 성공 0건 | 성공 결과만 TTL hit로 재사용. 기존 10분·LRU·정규화 key 계약 유지 |
| APIS5R-04 | 같은 실패 검색 10회 동시 실행 | 진행 중에는 Kakao 1회와 `shared_in_flight` 9회, 완료 뒤 새 검색은 다시 실제 요청 |
| APIS5R-05 | Kakao 원문 category에 노선 정보 있음/없음 | 실제 `Poi` 변환을 거친 `LocationSuggestion`에 provider 근거 `lineLabels`만 보존하거나 생략. 문자열 추측·추가 API 0회 |

`npx tsx --test test/kakao-location-search-adapter.test.ts`, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 완료 기록에는 변경 파일, cacheable/non-cacheable 상태 표, 노선 라벨 공개 타입, UI/엔진/데이터/DB를 바꾸지 않은 경계와 결과를 남긴다.

**완료 기준:** 실패 뒤의 명시 재검색이 실제 요청을 재개하고, 성공 TTL/in-flight 절감은 유지하며, U-1-F-R6이 provider 근거 노선 라벨을 추가 호출·추측 없이 소비할 수 있다. 이 기준 전에는 U-1-F-R6을 화면 검색 연결까지 완료 처리하지 않는다.

## 2026-08-26 — 외부 API 어댑터 완료: API-S-5-R 위치검색 실패 재시도·노선 근거 보완

### 교체 기록·변경 파일

- **이전 방식:** API-S-5는 완료 결과를 상태와 무관하게 TTL cache에 넣었고, `Poi.providerMetadata.lineLabels`는 `LocationSuggestion`으로 변환할 때 빠졌다.
- **문제/관찰:** 일시 네트워크·HTTP·설정·형식 오류가 최대 10분 hit로 반복될 수 있어 UI의 명시 재시도가 실제 요청을 재개하지 못했다. 또한 UI가 제공사 노선 근거를 소비할 공개 필드가 없었다.
- **교체 방식:** 모든 attempt가 `ok`인 결과만 TTL LRU에 저장한다. 하나라도 `unconfigured | http_error | network_error | invalid_response`이면 in-flight 완료 뒤 제거하고 cache에 넣지 않는다. `LocationSuggestion.providerLineLabels?`는 API-S-4-R의 실제 `Poi.providerMetadata.lineLabels`만 복사한다.
- **교체 이유:** 성공 0건의 비용 절감은 유지하면서 실패 재시도를 막지 않고, 노선 라벨을 UI가 추측·추가 호출 없이 표시하게 하기 위해서다.
- **상태:** 현행. 실제 Kakao 호출은 하지 않았다.

변경 파일은 `src/services/kakaoLocationSearchAdapter.ts`, `test/kakao-location-search-adapter.test.ts`, 이 작업기록이다. UI, 추천 엔진, TMAP 장소 검색, 카탈로그, DB·AsyncStorage는 수정하지 않았다.

### cache 상태와 공개 노선 계약

| attempt 조합 | TTL LRU 저장 | 다음 명시 검색 | fallback |
| --- | --- | --- | --- |
| 첫 검색 `ok`, 결과 있음 | 저장 | hit 재사용 가능 | 없음 |
| 첫 검색 `ok` 0건 + 반대 검색 `ok` (0건 포함) | 저장 | hit 재사용 가능 | 최대 1회 |
| `unconfigured` / `http_error` / `network_error` / `invalid_response`가 하나라도 있음 | 저장 안 함 | 실제 Kakao 요청 재개 | 첫 검색이 `ok` 0건일 때만 기존 상한으로 1회 |
| 같은 key 진행 중 (성공·실패 모두) | 완료 cache와 별개 | Promise 공유 | 추가 호출 없음 |

`LocationSuggestion.providerLineLabels?: string[]`는 provider 원문 카테고리에서 기존 변환이 이미 확인한 노선 label만 담는다. 필드가 없으면 UI는 노선 문자열을 합성하지 않는다. `kind`, provider 원본 `label`, `address`, 좌표, `labelSource/addressSource`와 기존 privacy 경계는 유지했다.

### 실제 변환 경로 fixture·결과

| ID | 실제 경로 | 결과 |
| --- | --- | --- |
| APIS5R-01 | Kakao `network_error` 변환 → adapter → 재검색 | 두 번 모두 `miss`, 실제 Kakao 요청 2회 |
| APIS5R-02 | 첫 `ok` 0건 → Kakao address `http_error` → 재검색 | cache 저장 없음, place→address 순서와 fallback 1회 상한 유지 |
| APIS5R-03 | 성공 장소/주소 및 성공 0건 → adapter TTL | 정규화 동일 key가 `miss → hit`, 성공만 재사용 |
| APIS5R-04 | 같은 실패 raw fetch 10개 동시 실행 → 완료 뒤 재검색 | 1회 실제 요청 + `shared_in_flight` 9회, 완료 뒤 실제 요청 재개 |
| APIS5R-05 | Kakao 원문 category → `kakaoPoiSearchMultiResult()` → `Poi` → `LocationSuggestion` | token이 있으면 `providerLineLabels` 보존, 없으면 필드 생략, 추가 API·TMAP 0회 |

### 검증·다음 인계

- `npx tsx --test test/kakao-location-search-adapter.test.ts` — 11/11 통과 (APIS5R-01~05 포함)
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 89 통과 / 기존 철회 이력 1 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과

U-1-F-R6은 단일 adapter 인스턴스를 화면 수명 동안 재사용하고, `providerLineLabels`가 존재할 때만 그대로 표시할 수 있다. 실패 `attempts`는 재시도 안내에 사용하되, UI가 cache·노선·주소를 추측하거나 별도 TMAP/Kakao 검색을 추가하면 안 된다.

## 2026-08-26 — 외부 API 어댑터 완료: API-S-5 카카오 단일 위치검색·TTL cache 계약

### 변경 파일과 교체 기록

- **이전 방식:** 위치 선택 화면은 Kakao 장소 검색, 주소 geocode, TMAP 검색을 화면에서 조합할 수 있어 하나의 입력에 여러 제공사·검색 유형을 병렬로 호출할 여지가 있었다.
- **문제/관찰:** 장소명과 주소의 우선순위, 빈 결과의 fallback 상한, 기기 메모리 재사용과 진행 중 요청 합치기 경계가 공개 계약으로 고정되지 않았다.
- **교체 방식:** `src/services/kakaoLocationSearchAdapter.ts`에 단일 Kakao 위치검색 adapter를 추가했다. 순수 분류기 `classifyLocationQuery()`가 주소 신호(도로명/길/번지/동·리)를 주소 우선으로, 나머지·애매한 입력을 장소 우선으로 분류한다. 첫 Kakao 결과가 `ok`이면서 0건일 때만 반대 검색을 한 번 호출한다.
- **교체 이유:** 장소·주소·TMAP 병렬 호출을 막고, UI가 하나의 결과·진단 계약만 소비하게 하기 위해서다.
- **상태:** 현행. 기기 메모리 전용 10분 TTL LRU(기본 100개)와 동일 key in-flight 합치기를 사용하며, 검색어·정밀 위치·선택 이력은 AsyncStorage/DB/로그에 저장하지 않는다.

- `src/engine/kakao.ts`: `kakaoAddressSearchResult()`를 추가해 주소 검색도 기존 keyword 검색과 동일한 상태형 Kakao 변환·실패 계약으로 제공한다. `kakaoGeocodeAddr(): Promise<Poi[]>` 호환 wrapper는 유지했다.
- `test/kakao-location-search-adapter.test.ts`: 원문 Kakao fixture → 실제 keyword/address 변환 → cache → 공개 위치 제안의 전체 경로를 검증한다.

### UIUX 공개 계약

| 타입/함수 | UIUX 소비 | 비밀·합성 경계 |
| --- | --- | --- |
| `createKakaoLocationSearchAdapter().search(query)` | 단일 위치검색 진입점 | Kakao만 호출하며 TMAP을 이 흐름에서 호출하지 않음 |
| `LocationSuggestion` | `kind: place | address`, provider 원본 `label`, `lat/lon`, `address`, 각 source를 사용해 목록·선택 payload를 구성 | UI는 노선·주소·좌표를 추측하거나 추가 검색으로 보정하지 않음 |
| `KakaoLocationSearchResult.attempts` | 제공사 상태별 재시도 안내에 사용 | key·Authorization·검색어·원문 응답은 포함하지 않음 |
| `LocationSearchDiagnostics` | provider별 place/address 요청 수, `fallbackCount`, `cache: miss | hit | shared_in_flight`만 관찰 | cache key/값·검색어·좌표·선택 이력은 노출·저장하지 않음 |

### 사용자 행동별 fixture 결과·호출량

| ID / 행동 | 실제 adapter 경로 | Kakao 요청 | cache | TMAP / 실제 API |
| --- | --- | --- | --- | --- |
| APIS5-01 일반 장소명 | raw POI → `kakaoPoiSearchMultiResult()` → `LocationSuggestion(place)` | place 1, address 0, fallback 0 | miss | 0 / 0회 |
| APIS5-02 주소 신호 | raw address → `kakaoAddressSearchResult()` → `LocationSuggestion(address)` | place 0, address 1, fallback 0 | miss | 0 / 0회 |
| APIS5-03 첫 검색 0건 | 실제 결과 변환 뒤에만 place→address 또는 address→place fallback | place 1, address 1, fallback 1 | miss | 0 / 0회 |
| APIS5-04 양쪽 0건 | 두 실제 Kakao 변환 결과가 빈 제안 | place 1, address 1, fallback 1 | miss | 0 / 0회 |
| APIS5-05 동일 검색 10회 | 첫 raw POI 변환 Promise를 10개 호출이 공유 | place 1, address 0 | miss 1 / shared in-flight 9 | 0 / 0회 |
| APIS5-06 정규화 동일 query·TTL | 10분 안 재사용, 만료 뒤 실제 변환 재요청 | place 2 (첫 요청·만료 후), address 0 | miss → hit → miss | 0 / 0회 |

### 검증·유지 경계·다음 인계

- `npx tsx --test test/kakao-location-search-adapter.test.ts` — 6/6 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 89 통과 / 기존 철회 이력 1 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과

UI, 추천 엔진, TMAP 장소검색 경로, 카탈로그, DB는 수정하지 않았고 실제 API 호출은 0회다. U-1-F-R6은 기존 화면의 직접 Kakao/주소/TMAP 조합을 우회하지 말고 이 adapter 한 인스턴스를 화면 수명 동안 재사용해야 한다. 입력 변경 시 이전 Promise 결과를 확정에 쓰지 않는 stale 처리와 지도·현위치 선택은 UIUX 소유 범위다.

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

**우선순위 1 / 선행 조건:** 장소 검색·선택은 현 범위에서 수락됐다. 이 작업은 추천 엔진의 다음 고도화보다 먼저, 단 서버 proxy 전체 구현(API-4-A)보다 앞서 수행한다.

**목표:** ODsay를 자동 추천의 대중교통 실제 경로 제공사에서 안전하게 제외하고, API-4-A의 서버 전환 전에 카카오 대중교통·카카오/TMAP 도보를 같은 route 결과 계약으로 고정한다.

### 착수 순서와 중단 게이트

이 작업은 API를 새로 많이 호출해 문제를 푸는 작업이 아니다. 아래 순서를 반드시 지킨다.

1. **제공사 사실 게이트:** 공식 문서·현재 계정 설정에서 카카오 대중교통과 카카오/TMAP 도보 각각의 실제 공개 endpoint, 인증 주체, 상업 이용/응답 보관 조건, 무료 한도 또는 요금 상태를 확인한다. 문서 URL·확인일·키를 제외한 상태만 기록한다. 대중교통 endpoint 또는 권한이 확인되지 않으면 추측한 REST adapter·fixture를 만들지 말고 `transit_provider_unavailable`이라는 차단 결론과 대안 후보만 인계한다. 단일 허가된 smoke 확인 외 반복·대량 실제 호출은 금지한다.
2. **계약 게이트:** 제공사 확인 결과에 맞춰 provider-neutral 타입, 실패·예산 상태, cache hit/miss 진단만 만든다. 이 단계에서 추천 순위·4코스 상한·UI·DB·카탈로그를 바꾸지 않는다.
3. **fixture 게이트:** 실제 네트워크 없이 raw 응답 fixture에서 변환·선택·fallback·일일 예산을 검증한다. 여기까지 수락된 공개 타입만 API-4-A와 추천 엔진에 인계한다.
4. **다음 작업 경계:** API-4-A가 서버 cache/budget을 구현한 뒤에만 추천 엔진 2-J가 이를 소비한다. 엔진은 제공사 조사·cache 키 재구현·ODsay 직접 호출을 하지 않는다.

1. 경로 adapter에 provider-neutral 입력/출력 타입을 만든다. 최소 `provider`, `mode(walk|transit)`, 방향 있는 출발/도착 identity, 총 소요 분, 구간/step, 성공·제한·실패 이유를 포함한다. 키·Authorization·정밀 GPS·원문 응답은 타입·로그·fixture에 넣지 않는다.
2. 제공사 사실 게이트를 통과한 경우에만 카카오 **대중교통** adapter와 **도보** adapter의 요청 생성·응답 변환을 구현하거나, API-4-A가 소비할 수 있는 독립 모듈로 분리한다. 고정 fixture에서 총 시간·구간·빈/형식 오류·401/403/429·timeout을 검증한다. 게이트를 통과하지 못하면 이 항목을 구현하지 않고 실패 타입·차단 근거만 남긴다.
3. TMAP은 도보 adapter로만 유지한다. ODsay는 legacy fixture 호환 경계를 제외하고 새 자동 route 선택에서 `disabled` 상태가 되게 한다. TMAP 대중교통을 fallback으로 가정하거나 호출하지 않는다.
4. 도보 선택 정책을 순수 함수와 fixture로 고정한다. 유효 cache hit가 있으면 그 provider 결과를 재사용한다. miss는 각 제공사의 `used / softLimit`이 낮은 쪽을 고르고, 동률은 **방향·mode·공개 POI identity·route version** 기반 결정적 키로 나눈다. 균형 확인을 위한 동시 이중 호출은 금지한다. 선택 provider 실패/timeout일 때만 다른 provider에 1회 fallback하며 두 호출 모두 비용·출처를 남긴다.
5. 대중교통은 카카오만 선택한다. 카카오 한도/실패면 `transit unavailable`을 반환하며 도보를 대중교통 결과로 가장하거나 근사 시간으로 통과시키지 않는다.
6. 일일 hard limit과 그보다 앞선 configurable soft limit(기본 비율 90%, 값은 서버 설정에서 주입)의 타입·fixture를 만든다. 이 단계에서는 client 공개 키를 새 호출 경로에 추가하지 않고, API-4-A의 서버 proxy 경계를 위한 의존성 주입으로 둔다.
7. 변경 파일, ODsay와 UI/엔진/DB에 손대지 않은 경계, 테스트 명령별 결과, API-4-A로 넘길 타입을 이 문서에 기록한다. 최소 `npm run test:typecheck`, 관련 adapter 테스트, `npm test`, `git diff --check`를 실행한다.

**완료 기준:** 제공사 사실 게이트의 확인 또는 차단 결론이 먼저 기록돼야 한다. 확인된 제공사만 fixture로 같은 계약에서 구분·선택할 수 있고, 도보 cache miss의 균형이 중복 호출이 아닌 결정적 사용률 배정임이 테스트로 증명돼야 한다. API-4-A가 이 계약을 받아 서버 proxy를 구현할 수 있어야 한다. 대중교통 제공사 미확인을 도보·근사값·ODsay 재사용으로 숨기면 완료가 아니다.

### API-4-A 수행 순서 정정 (2026-08-26)

API-4-A는 API-4-B 완료 뒤 수행한다. 기존 문서의 `ODsay·TMAP 일일 호출량`은 `카카오 대중교통, 카카오 도보, TMAP 도보의 각각의 일일 호출량`으로 읽는다. 서버 구현 시 API-4-B의 provider-neutral 타입과 도보 선택 함수를 재구현하지 않고 소비한다.

## 2026-08-26 — 외부 API 어댑터 완료: API-4-B 카카오 대중교통·이중 도보 제공사 계약

### 제공사 사실 게이트

2026-08-26에 키 값·실사용 좌표·실제 route 응답을 출력하거나 호출하지 않고 문서와 기존 adapter 경계를 확인했다.

| 제공사 / 수단 | 공개 endpoint·인증 확인 | 요금·운영 확인 상태 | API-4-A 활성화 전 조건 |
| --- | --- | --- | --- |
| Kakao 도보 | `GET /v2/routing/walk`, REST API key의 `Authorization: KakaoAK …` | Kakao Map은 첫 활성 앱에만 무료 quota가 적용되고 초과/추가 앱은 Biz Wallet·유료 API 설정이 필요함 | 배포 앱의 Kakao Map 활성화, quota·Biz Wallet 상태와 응답 보관 허용 범위를 서비스 계정에서 확인 |
| Kakao 대중교통 | `GET /v2/routing/publictraffic`, 동일한 REST API 인증 | 위 Kakao Map quota/유료 설정에 따름 | 위 조건을 충족하기 전에는 `transit` 실제 호출을 켜지 않음 |
| TMAP 도보 | 기존 `travel.ts`의 `POST /tmap/routes/pedestrian`, `appKey` header 경계 확인 | 이 저장소에는 현재 서비스 계정의 상업 이용·응답 보관·quota 증빙이 없음 | TMAP 계약/관리 콘솔에서 상업 이용, 일일 한도, 공용 cache 보관 가능 기간을 확인 |

Kakao의 Map REST 제공 수단·endpoint와 활성화/유료 전환 조건은 [Kakao Map Concepts](https://developers.kakao.com/docs/en/kakaomap/common), REST 인증·응답 형식은 [Kakao Map REST API](https://developers.kakao.com/docs/en/kakaomap/rest-api), quota/가격 체계는 [Kakao quota](https://developers.kakao.com/docs/en/getting-started/quota) 및 [Paid API](https://developers.kakao.com/docs/en/app-setting/paid-api)에서 확인했다. **결론은 조건부 통과**다. Kakao 대중교통 endpoint는 문서로 확인되어 추측 adapter를 만들지 않았으며, 모든 실제 키는 API-4-A 서버 proxy의 의존성 주입 전까지 사용하지 않는다. 다만 TMAP 상업/보관 조건과 각 서비스 계정의 유료 활성화 상태는 로컬에서 증명할 수 없으므로, 이를 확인하기 전 실제 호출·장기 cache 배포는 차단한다.

### 교체 기록과 공개 계약

- **이전 방식:** `courseV1RouteAdapter`의 legacy ODsay 경로와 기존 TMAP 보행 경로는 공통 provider 결과·일일 예산·선택 규칙 없이 별도 경계에 있었다.
- **문제/관찰:** ODsay를 새 자동 선택에 그대로 두거나, 도보 두 제공사의 균형 확인을 병렬 호출로 처리하면 quota와 실패 출처를 통제할 수 없다.
- **교체 방식:** `src/services/routeProviderAdapter.ts`에 `ProviderRouteRequest`, `ProviderRouteResult`, `ProviderRouteStep`, `ProviderBudget` 및 Kakao/TMAP client factory를 추가했다. 결과는 provider, `walk | transit`, 방향 있는 공개 장소 ID, 분 단위 시간, 선택적 step, typed 상태만 내보낸다. 키, Authorization, 원문 body, 로그와 영속 cache는 계약에 없다.
- **교체 이유:** API-4-A가 provider별 server key/budget/cache를 주입하고, 엔진은 제공사별 구현을 모르도록 하기 위해서다.
- **상태:** 현행 계약/fixture 단계. 실제 route API 호출 0회이며, `courseV1RouteAdapter`의 legacy ODsay 소비를 이 작업에서 변경하지 않았다.

`chooseWalkProvider()`는 유효 cache provider를 먼저 재사용한다. cache miss면 `used / softLimit`이 더 작은 제공사를 하나만 고르고(기본 `hardLimit`의 90%), 동률은 `fromId | toId | walk | routeVersion`의 결정적 hash로 나눈다. `resolveWalkRoute()`는 선택 provider의 실패 때에만 반대 도보 provider를 최대 한 번 시도한다. `resolveTransitRoute()`는 Kakao만 호출하고 한도/실패를 `limited`/typed 실패로 보존한다. `disabledRouteProvider()`는 새 자동 경로에서 ODsay와 TMAP transit이 호출 대상이 아님을 명시한다.

### fixture 검증·보존 경계

| ID | 고정 경로 | 결과 |
| --- | --- | --- |
| API4B-01 | Kakao 도보·대중교통, TMAP 도보 raw fixture → neutral 변환 | 각 provider/mode와 5·11·4분 total을 보존 |
| API4B-02 | 401·429·형식 오류·network fixture | 근사 시간 없이 `http_error`/`invalid_response`/`network_error` 반환 |
| API4B-03 | cache miss의 서로 다른 사용률·동률 fixture | 낮은 `used/softLimit` 선택, 동일 입력의 결정적 선택, 실제 호출 1회 |
| API4B-04 | Kakao 도보 실패, TMAP 도보 성공, Kakao transit 실패 | 도보만 1회 fallback, transit은 Kakao 실패 그대로; ODsay·TMAP transit `disabled` |
| API4B-05 | 양쪽 hard limit, 유효 TMAP cache hit, transit hard limit | 새 도보 요청 제한, cache 결과 무호출 재사용, transit 무호출 제한 |

- `npx tsx --test test/route-provider-adapter.test.ts` — 5/5 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip
- `npm test` — 74/74 통과
- `git diff --check` — 통과

변경 파일은 `src/services/routeProviderAdapter.ts`, `test/route-provider-adapter.test.ts`, 이 작업기록이다. UI·추천 엔진 정책·카탈로그·DB·`courseV1RouteAdapter` legacy 경로는 변경하지 않았다. 다음 API-4-A는 이 타입과 선택 결과를 소비해 서버 측 key 주입, provider별 원자 예산, TTL/무효화, 공용 POI 구간만의 cache 및 동시 요청 합치기를 구현해야 한다. 그 전에 Kakao/TMAP 서비스 계정의 상업 이용·응답 보관·실제 quota 상태를 승인해야 한다.

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

**API-4-B 인계 보완:** `cachedProvider`는 provider 이름만으로 cache hit가 될 수 없다. API-4-A는 같은 방향·mode·public POI identity·route version을 만족하며 `status: ok`인 유효 `cachedResult`가 함께 있을 때만 hit로 재사용한다. 그 외에는 cache miss로 예산 선택을 다시 수행한다. 현 `courseV1RouteAdapter`의 ODsay 소비는 API-4-B에서 의도적으로 유지됐으므로, API-4-A의 서버 adapter 연결 전에는 ODsay 전환 완료라고 기록하지 않는다.

**완료 기준:** 구현/설계 경계에 따라 변경 파일, 캐시 키·TTL·보존 정책, 제공사별 예산 동작, 테스트 결과, 엔진·DB에 필요한 계약 변경을 이 문서에 기록한다. `npm run test:typecheck`, 관련 계약 테스트, `npm test`, `git diff --check`가 통과해야 한다.

## 2026-08-26 — 외부 API 어댑터 완료: API-4-A 서버 Route Proxy 계약·공용 구간 cache

### 교체 기록과 변경 파일

- **이전 방식:** 앱 실행 메모리 cache와 provider별 route adapter가 분리돼 있어, 여러 사용자/코스 사이의 공개 구간 재사용과 서버 원자 예산을 표현할 계약이 없었다.
- **문제/관찰:** 클라이언트 cache만으로는 provider key를 숨기거나 일일/초당 한도를 원자적으로 보장할 수 없고, GPS 좌표를 공용 장기 cache에 넣을 위험이 있었다.
- **교체 방식:** `src/services/routeProxyAdapter.ts`에 서버 전용 `createServerRouteProxy()`와 `RouteProxyStore` 포트를 추가했다. provider client/key는 서버에서만 주입하며, fixture용 `createMemoryRouteProxyStore()`는 배포 저장소가 아니다.
- **교체 이유:** API-4-B의 neutral route 결과를 그대로 소비하면서, API-4-A가 실제 DB/Edge Function을 연결할 때 cache·budget·privacy 정책을 재구현하지 않게 하기 위해서다.
- **상태:** 현행 계약/fixture 단계. 실제 provider 호출, API key, DB migration, Edge Function 배포는 수행하지 않았다.

### cache·개인정보·예산 계약

| 구분 | 현행 계약 |
| --- | --- |
| 공용 장기 cache key | `provider | mode | directed fromPoiId | toPoiId | catalogVersion`; 코스 전체·좌표·사용자 ID는 key/값/진단에 없음 |
| 공용 저장 조건 | `cacheScope: public_segment`이고 route의 방향 ID와 `catalogVersion`이 모두 일치하며 `status: ok`인 결과만 TTL 동안 저장 |
| 무효화·방향 | TTL 만료 시 삭제, catalog/route version 변경 시 별도 key, A→B와 B→A는 별도 key |
| 개인 GPS 구간 | `private_request`는 장기/공용 cache와 in-flight 공유에 넣지 않는다. user ID·정밀 GPS·IP·원문 body를 store/진단에 넣지 않는다 |
| 동시 요청 | 같은 공개 cache miss만 proxy 내부 Promise 하나를 공유한다. private 요청은 다른 사용자와 공유하지 않는다 |
| 예산 | store의 `reserveBudget()`가 provider+date bucket+second bucket을 원자적으로 예약한다. hard limit 또는 rate limit이면 실제 호출/근사 대체 없이 `limited` 반환 |
| 수단 | transit은 Kakao만 호출한다. walk는 API-4-B의 사용률 선택 후 선택 provider 실패 때만 반대 provider를 1회 시도한다. ODsay/TMAP transit fallback은 없다 |

`RouteProxyStore`의 production 구현은 DB transaction/RPC로 `getRoute`, `putRoute`, `readBudget`, `reserveBudget`을 제공해야 한다. 특히 `reserveBudget`은 읽기-증가를 분리하지 않는 원자 연산이어야 한다. 이는 DB·개인화 역할의 migration/RLS 소유 경계를 침범하지 않기 위한 명시적 인계다.

### fixture 결과·다음 인계

| ID | 고정 검증 | 결과 |
| --- | --- | --- |
| API4A-01 | 동일 공개 POI 구간과 역방향 구간 | 동일 provider/mode/direction/version만 hit, 역방향은 miss |
| API4A-02 | TTL 만료·version 변경 | 모두 새 provider 요청, 성공 결과만 공용 cache write |
| API4A-03 | 동일 public miss 동시 2개 | provider 실제 호출 1회만 공유 |
| API4A-04 | hard limit·초당 limit·transit | 각각 `limited`, transit의 Kakao 외 fallback 0회 |
| API4A-05 | private GPS scope·public ID 불일치 | private 장기 cache 0회, ID/version 불일치는 typed 거절 |
| API4A-06 | 도보 provider 연속 실패 | 성공하지 않은 결과 cache 0회, 도보만 1회 fallback, 근사 route 승격 없음 |

변경 파일은 `src/services/routeProxyAdapter.ts`, `test/route-proxy-adapter.test.ts`, 이 작업기록이다. UI·추천 엔진·카탈로그·DB migration·legacy `courseV1RouteAdapter`는 변경하지 않았다. 다음 DB/배포 인계는 (1) `RouteProxyStore`의 server DB schema와 atomic RPC, (2) route provider key를 Deno/서버 secret으로 주입하는 Edge Function, (3) Kakao/TMAP 서비스 계정의 상업 이용·응답 보관 승인, (4) 엔진 2-J가 `RouteProxyResponse.diagnostics`의 cache miss 수만 비용으로 소비하는 연결이다.

## 2026-08-27 — 통합·결정 지시 API-4-A-R: Route Proxy 실구현과 legacy ODsay 전환

**선행 조건:** DB-RP-1의 migration/RPC/RLS가 수락돼야 한다. 서비스 계정의 Kakao·TMAP quota, 상업 이용, 응답 보관 허용 기간은 사용자 또는 계정 관리자에게 확인받아 기록한다. 확인 전에는 실제 provider 호출·Edge Function 배포·legacy 경로 제거를 활성화하지 않는다.

### 목표

API-4-A의 fixture 전용 `RouteProxyStore`를 Supabase Edge Function의 실제 server adapter로 연결하고, 앱의 V1 정확 경로 요청이 더 이상 ODsay를 직접 호출하지 않게 한다. 공개 POI 구간은 server cache/예산을 사용하고, 개인 GPS 구간은 저장·공유 없이 요청 수명에서만 처리한다.

### 구현 지시

1. `supabase/functions/`에 route proxy Edge Function을 만든다. provider key는 Deno/서버 secret만 읽고, `EXPO_PUBLIC_*` 변수·모바일 번들·응답 payload·로그에 넣지 않는다. 현재 장소 검색에 쓰이는 공개 Kakao 키를 route provider secret으로 재사용하지 않는다.
2. Edge Function은 DB-RP-1 RPC만 통해 `RouteProxyStore`를 구현한다. migration SQL을 복제하거나 client에서 budget/cache를 계산하지 않는다. RPC 오류는 typed `store_unavailable`으로, budget 거절은 `limited`로 반환한다.
3. public segment는 클라이언트 좌표를 cache 권위로 쓰지 않는다. server가 신뢰한 현재 카탈로그 snapshot의 `poiId + catalogVersion`으로 출발/도착 좌표를 해석·검증하고, ID/version/좌표가 불일치하면 호출·cache write 없이 typed 거절한다. private request 좌표는 provider 요청에만 잠시 사용하고 DB/RPC/cache/진단에 전달하지 않는다.
4. `src/services/`에 모바일용 proxy client adapter를 추가한다. 앱의 V1 `courseV1RouteAdapter` 또는 그 교체 adapter만 이 client를 소비하게 연결한다. 응답은 기존 엔진의 `{ mode: walk | transit, min, exact: true } | null` 계약으로 변환하며 `ok`가 아닌 모든 상태·근사값·차량은 `null`이다.
   - transit은 Kakao만, walk는 proxy가 선택한 Kakao/TMAP만 쓴다.
   - ODsay와 TMAP transit의 새 호출 경로를 제거한다. legacy 코드 삭제는 실제 proxy 경로 fixture와 one-request smoke가 성공한 뒤에만 한다.
5. 고정 fixture로 Edge Function request validation, secret 미노출, public hit/miss, private 비저장, budget limited, store unavailable, Kakao transit 실패, walk 1회 fallback, ODsay/TMAP transit 0호출, legacy adapter 미사용을 검증한다. 실제 API는 승인된 단일 smoke 이외 반복 호출하지 않는다.
6. 승인 후에만 별도 개발 환경에서 한 번의 제한된 smoke를 실행한다. provider·mode·status·cache hit/miss·예산 변화의 **개수만** 기록하며, 키·좌표·장소명·원문 body는 기록하지 않는다. 실패하면 legacy를 제거하지 않고 typed 실패 결과와 재현 조건만 남긴다.

### 소유 경계와 완료 기준

- 수정: `supabase/functions/`의 route proxy, `src/services/` client/adapter, API 계약 테스트, 이 작업기록. 수정 금지: `supabase/migrations/`, UI, 추천 순위·엔진 정책, 원본 카탈로그, DB-1 코스 저장.
- `npm run test:typecheck`, 관련 adapter/Edge Function contract test, `npm test`, `git diff --check`를 실행한다.
- 완료 기록에는 변경 파일, DB-RP-1 RPC 소비 방식, 실제 호출 0회 또는 승인된 단일 smoke의 비식별 수치, ODsay 제거 여부, 남은 계정/배포 위험을 남긴다.

**완료 기준:** 앱 V1 정확 경로가 server proxy만 거쳐 Kakao transit·Kakao/TMAP walk를 사용하고, public cache/예산은 DB-RP-1 원자 RPC만 사용하며, private GPS와 key가 영속·로그·응답에 남지 않아야 한다. 서비스 계정 승인이 없거나 smoke가 실패하면 `조건부 완료`로 기록하고 기존 runtime을 제거하지 않는다.

## 2026-08-27 — 외부 API 어댑터 조건부 완료: API-4-A-R Route Proxy 실구현 경계

### 교체 기록과 변경 파일

- **이전 방식:** API-4-A는 fixture용 `RouteProxyStore`와 메모리 store만 제공했고, V1 실제 경로는 `courseV1RouteAdapter`가 TMAP 보행/ODsay 대중교통을 직접 호출했다.
- **문제/관찰:** public POI cache에 client 좌표를 권위로 쓰거나 mobile bundle이 provider key를 가지면 개인정보·quota·보관 정책을 보장할 수 없다. 또한 현 `CourseV1Point`는 `id/lat/lon`만 있어 public POI인지와 catalog version을 독립적으로 증명하지 못한다.
- **교체 방식:** `supabase/functions/route-proxy/index.ts`를 추가했다. Function은 `SUPABASE_SERVICE_ROLE_KEY`, `KAKAO_ROUTE_REST_API_KEY`, `TMAP_ROUTE_APP_KEY` 및 server-owned `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`만 읽는다. DB-RP-1의 `route_proxy_get_route`, `put_route`, `read_budget`, `reserve_budget` RPC만으로 cache/예산을 소비한다. `src/services/routeProxyClientAdapter.ts`는 public scope에서 좌표를 payload에서 생략하고 private scope에서만 request 수명 좌표를 전달하며, `ok` exact walk/transit만 기존 엔진 계약으로 바꾼다.
- **교체 이유:** provider key·원문·private 좌표를 mobile/DB/cache/diagnostic에서 분리하면서, Kakao transit 및 Kakao/TMAP walk만 server proxy로 연결할 준비를 하기 위해서다.
- **상태:** **조건부 완료.** 실제 provider 호출 0회, Edge Function 배포 0회, smoke 0회다. 서비스 계정 quota/상업 이용/응답 보관 승인과 catalog snapshot 배포가 아직 없어 legacy runtime을 삭제·기본 전환하지 않았다.

### 실제 server 경계

| 구분 | 구현 계약 |
| --- | --- |
| public segment | client는 `poiId + catalogVersion`만 보낸다. Edge Function이 server-owned snapshot에서 좌표를 해석하고, version/ID 미확인 시 provider/RPC/cache write 없이 `rejected` |
| private request | 요청 body의 좌표는 provider call에만 사용한다. cache key·RPC 인자·DB·진단·응답에는 넣지 않으며 public in-flight도 공유하지 않음 |
| cache/budget | DB-RP-1 RPC 오류는 `store_unavailable`, reserve 거절은 `limited`; Edge Function이 read-then-write budget을 만들지 않음 |
| provider/secret | `EXPO_PUBLIC_*`와 현재 장소검색 공개 키를 읽지 않는다. Kakao route/TMAP route server secret이 없으면 reserve 전 `unconfigured` 반환 |
| route 변환 | transit Kakao만; walk는 soft-limit 사용률과 public ID/version hash로 한 provider를 선택하고 실패 때만 반대 provider 1회. non-`ok`, 차량, 근사 route는 client adapter에서 `null` |

### fixture·검증과 인계

| ID | 검증 | 결과 |
| --- | --- | --- |
| API4AR-01 | public mobile payload | 좌표 없이 전송, `ok` walk만 `{ mode, min, exact: true }` |
| API4AR-02 | private payload·실패 | 좌표는 request 수명에만, 실패/제한은 `null` |
| API4AR-03 | Edge secret/RPC | `EXPO_PUBLIC_*` 0회, server secret·DB-RP-1 RPC만 참조 |
| API4AR-04 | public/private 개인정보 | server catalog snapshot으로만 public 좌표 해석, RPC 인자에 좌표 없음 |
| API4AR-05 | 제공사 전환 | transit Kakao 단독, walk 결정적 선택·1회 fallback, ODsay/TMAP transit 0회 |

- `npx tsx --test test/route-proxy-client-adapter.test.ts` — 2/2 통과
- `node --test test/route-proxy-edge-contract.test.mjs test/route-proxy-store-migration-contract.test.mjs` — 7/7 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip
- `npm test` — 81/81 통과

변경 파일은 `supabase/functions/route-proxy/index.ts`, `src/services/routeProxyClientAdapter.ts`, `test/route-proxy-client-adapter.test.ts`, `test/route-proxy-edge-contract.test.mjs`, 이 작업기록이다. DB-RP-1 migration, UI, 추천 엔진 정책, 카탈로그 원본, `courseV1RouteAdapter` legacy runtime은 수정하지 않았다.

다음 활성화 조건은 (1) 서비스 계정의 Kakao/TMAP quota·상업 이용·응답 보관 승인 기록, (2) 현재 catalog에서 생성한 server-owned snapshot과 version 배포, (3) Edge Function secret 설정/배포, (4) 비식별 한 번의 smoke 성공이다. 네 조건 뒤에만 `courseV1RouteAdapter`의 default fetcher를 proxy client로 전환하고 ODsay 직접 호출 경로를 제거할 수 있다. smoke가 실패하면 legacy를 유지하고 `provider/mode/status/cache hit·miss/budget delta`의 개수만 기록한다.

### 통합·결정 검토 — API-4-A-R 미수락 (2026-08-27)

고정 client/Edge contract와 전체 회귀 테스트는 통과했으나, 다음 이유로 실제 proxy 전환 및 추천 엔진 2-J의 선행 조건을 아직 충족하지 못했다.

1. **다중 instance 중복 miss:** `route-proxy/index.ts`는 cache 조회 뒤 각 Edge Function instance에서 바로 budget을 예약·provider를 호출한다. 같은 public segment 요청이 서로 다른 instance로 동시에 들어오면 DB cache miss를 공유하는 lease/in-flight 원자 연산이 없어 여러 provider 호출·여러 budget 예약이 발생할 수 있다. fixture의 process-memory `inFlight`는 실제 Edge Function 간 공유가 아니다.
2. **호출자 남용 경계:** Function 코드와 배포 설정에 caller authentication/authorization·익명 사용 정책·요청 rate limit이 명시되지 않았다. public endpoint가 되면 제3자가 provider quota를 소진시킬 수 있다. cache·budget에 GPS/user ID를 저장하지 않는 것과 endpoint 남용 방지는 별도 문제다.
3. **운영 활성화 미완료:** 대상 Supabase migration/Function 배포, server secret·server catalog snapshot 설정, 서비스 계정의 quota·상업 이용·응답 보관 승인, 비식별 one-request smoke가 모두 미실행이다. 따라서 실제 앱은 아직 `courseV1RouteAdapter`의 TMAP/ODsay legacy 경로를 사용한다.

**판정:** API-4-A-R은 코드·fixture 산출물만 조건부 완료이며, 런타임 전환은 미수락이다. 다음 보완은 DB가 public segment fetch lease/완료·실패 해제의 원자 RPC를 제공하고, 외부 API가 이를 Edge Function에서 소비해야 한다. 호출자 정책은 통합·결정과 사용자가 정한 뒤에만 구현한다. 그 전에는 ODsay 제거·실제 다량 호출·2-J 전환을 하지 않는다.

## 2026-08-27 — 통합·결정 지시 API-4-A-R2: 익명 JWT와 cross-instance lease

**부모 결정 `SEC-RP-01`:** 추천을 위해 로그인 화면을 강제하지 않는다. 앱은 추천 요청 전 익명 Supabase 세션을 자동으로 확보하고 JWT를 Route Proxy에 보낸다. 익명 user ID는 요청 authorization에만 사용하며 provider 요청, cache key/value, DB budget, lease, 진단, 로그에는 저장·전달하지 않는다.

**정책 정정 `SEC-RP-01-R`:** 익명 Auth 계정도 개인정보로 취급한다. DB-PRIV-01이 수락한 후보 계약만 사용해 마지막 사용 뒤 30일이 지난 **여전히 익명이고 연결 데이터가 없는** 계정만 서버 정리 경로에서 삭제한다. 영구 identity를 연결한 계정과 일반 로그인 계정은 대상이 아니며, 익명 계정의 추천·위치·코스·행동·프로필 저장은 계속 금지한다.

**선행 조건:** DB-RP-2가 service-role 전용 public fetch lease RPC와 bounded wait/retry 계약을 완료해야 한다.

1. 앱의 인증 경계에서 익명 session이 없을 때만 한 번 생성·재사용한다. 네트워크/인증 실패는 로그인 강제가 아닌 `route_proxy_unavailable`로 처리하고, provider 직접 호출·ODsay fallback으로 우회하지 않는다.
2. Edge Function은 JWT 검증을 명시적으로 켜고, authenticated 또는 anonymous JWT 외 요청을 거절한다. 배포 설정·테스트에 anon key/service role/provider key를 넣지 않는다.
3. Edge Function은 DB-RP-2 lease를 소비한다. public cache miss 후 선택 provider의 key만 claim하며, claim 실패 시 bounded wait 뒤 cache 재조회한다. 여전히 결과가 없으면 typed `in_flight`/재시도 상태로 끝내고 provider·budget을 추가 호출하지 않는다. 성공·실패·timeout에는 반드시 complete/release한다.
4. endpoint 남용 방지는 user ID를 저장하지 않고 JWT 검증 + Edge Function 단위의 짧은 요청 rate limit으로 처리한다. rate-limit key/카운터는 식별자를 영속 저장하지 않으며, 한도 초과는 `limited` 또는 `route_proxy_unavailable`로 반환한다. 정확한 limit 값은 환경 설정으로 주입하고 문서에 비식별 정책만 기록한다.
5. fixture로 익명 JWT 없음/있음/만료, anonymous session 생성 실패, same public miss의 lease wait 0 provider call, success/failure/timeout release, rate limit, private GPS 비저장, ODsay/TMAP transit 0호출을 검증한다.
6. DB migration 적용, Edge secret·catalog snapshot 설정, Kakao/TMAP 서비스 계정 승인 뒤에만 제한된 one-request smoke를 한다. 성공 전에는 `courseV1RouteAdapter`의 default 전환과 ODsay 제거를 하지 않는다.
7. DB-PRIV-01 수락 뒤에만 service-role 전용 익명 Auth 정리 scheduler/Edge 경로를 구현한다. 클라이언트 호출이나 일반 Route Proxy 요청으로 삭제를 유발해서는 안 되며, 후보의 Auth 상태·마지막 사용·연결 데이터 조건을 다시 검증한 뒤에만 Auth Admin 삭제를 한 번 수행한다. 삭제 대상 식별자, 위치, 검색어, 코스·추천 원문은 로그·진단에 남기지 않고 날짜별 성공/건너뜀/실패 **개수**와 코드화한 사유만 운영 감사로 남긴다.
8. 자동 익명 로그인은 Auth 설정에서 허용된 뒤에만 활성화한다. CAPTCHA/요청 한도 등 익명 가입 남용 방어가 배포 설정에 없거나 검증되지 않으면 fail-closed로 `route_proxy_unavailable`을 반환하고, 무인증 proxy나 provider 직접 호출로 우회하지 않는다.

**소유 경계:** `supabase/functions/`, `src/services/` API/auth adapter, API 계약 테스트, 이 문서만 수정한다. migration/RLS·UI·추천 엔진 정책·카탈로그 원본은 수정하지 않는다.

**완료 기준:** 인증되지 않은 proxy 호출은 차단되고, 익명 사용자는 로그인 없이 추천을 요청할 수 있으며, 여러 instance의 같은 public miss는 provider 호출 하나만 만들고 private GPS/user identity는 DB/cache/diagnostic에 남지 않아야 한다. DB-PRIV-01의 30일 정리 경로는 일반 로그인·전환 계정을 삭제하지 않고, 익명 개인 데이터가 없는 조건에서만 실행돼야 한다. 이후에만 실제 activation·ODsay 제거·2-J 진입을 검토한다.

## 2026-08-27 — 외부 API 어댑터 조건부 완료: API-4-A-R2 익명 JWT·cross-instance lease·정리 scheduler

### 교체 기록과 변경 파일

- **이전 방식:** API-4-A-R Function은 어떤 호출자 인증도 검증하지 않았고, public cache miss가 여러 Edge instance에서 동시에 발생하면 중복 budget 예약·provider 호출을 막지 못했다. 익명 Auth의 재사용/실패 경계와 30일 정리 실행자는 없었다.
- **문제/관찰:** DB-RP-2 lease 없이 process-memory in-flight만 쓰면 instance 간 중복 호출이 남는다. 익명 user ID를 route/cache/diagnostic에 기록하지 않아도 무인증 endpoint는 quota 남용에 취약하다.
- **교체 방식:** `route-proxy`가 Bearer JWT를 `auth.getUser()`로 검증하고, 인증되지 않은 요청은 `rejected`로 끝낸다. 익명 session은 `ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED`와 `ROUTE_PROXY_ABUSE_GUARD_APPROVED`가 모두 명시된 경우만 허용하고, 단기 메모리의 token hash rate limit도 환경 한도로 제한한다. public miss는 DB-RP-2의 claim→bounded wait→cache 재조회→`in_flight` 또는 provider 호출→complete/release 순서로 소비한다. `anonymous-auth-cleanup`은 scheduler secret 전용으로 DB-PRIV-01 후보/재검증 RPC 뒤 Admin delete를 한 번 수행하고 집계만 응답/감사한다.
- **교체 이유:** 무인증·중복 miss·무기한 익명 account 보관을 동시에 막되, user/GPS를 provider/cache/budget/lease/진단에 저장하지 않기 위해서다.
- **상태:** **조건부 완료·비활성.** 현재 `supabase/config.toml`은 `enable_anonymous_sign_ins = false`이며 CAPTCHA도 활성화되지 않았다. 따라서 `ensureRouteProxyAnonymousSession()`은 기본 비활성에서 `route_proxy_unavailable`으로 fail-closed하며, 실제 익명 가입·Function 배포·provider 호출·scheduler 호출은 0회다.

### 현행 인증·lease·보관 경계

| 구분 | 계약 |
| --- | --- |
| 모바일 익명 Auth | 기존 session만 재사용하고 없을 때는 명시 `anonymousAuthEnabled`일 때만 1회 생성 시도. 실패/비활성은 direct provider/ODsay fallback 없이 `route_proxy_unavailable` |
| Edge JWT | `Authorization: Bearer`와 Supabase `auth.getUser()`가 없거나 유효하지 않으면 401 `rejected`. user ID는 route input, RPC, cache, budget, lease, 진단에 넣지 않음 |
| 남용 방지 | JWT hash는 Edge process의 1분 rate window에만 두고 만료 entry를 제거한다. DB·로그·응답에 식별자/원문을 쓰지 않으며 환경 limit/guard 미설정은 429 `route_proxy_unavailable` |
| public lease | 선택 provider key만 DB-RP-2 claim. 다른 instance가 보유하면 최대 2초 wait 후 cache 재조회, miss면 `in_flight`로 종료하고 provider/budget 추가 호출 0회 |
| complete/release | 성공은 `route_proxy_complete_fetch_lease`로 cache write와 lease 제거를 원자 처리. provider HTTP/network/형식 실패 및 예외는 release. fallback은 실제 HTTP/network/형식 실패 때만 반대 walk provider 1회 |
| anonymous cleanup | 일반 Route Proxy/클라이언트에서 호출 불가. scheduler secret + service role만 후보 조회→재검증→Auth Admin 삭제; 날짜별 outcome/reason/count만 남기고 삭제 대상 ID는 반환/로그하지 않음 |

### fixture·검증·다음 활성화 조건

| ID | 고정 검증 | 결과 |
| --- | --- | --- |
| API4AR2-01 | 기존 익명 session/비활성/생성 실패 | 재사용 1회, 비활성·실패는 `route_proxy_unavailable`, provider 직접 fallback 0회 |
| API4AR2-02 | authenticated invoker | JWT만 Edge header에 전달, provider key payload 0개 |
| API4AR2-03 | JWT·abuse guard | Bearer 검증/익명 승인/rate env 누락은 fail-closed, user ID·console log 0개 |
| API4AR2-04 | DB-RP-2 lease | public claim/wait/cache re-read/complete-release, private lease 0회, ODsay/TMAP transit 0회 |
| API4AR2-05 | DB-PRIV-01 cleanup | scheduler secret·후보 재검증·Admin delete·집계 audit만 사용 |

- `npx tsx --test test/route-proxy-client-adapter.test.ts` — 4/4 통과
- `node --test test/route-proxy-r2-edge-contract.test.mjs test/route-proxy-fetch-lease-migration-contract.test.mjs test/anonymous-auth-cleanup-migration-contract.test.mjs` — 11/11 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip
- `npm test` — 92/92 통과
- `git diff --check` — 통과

변경 파일은 `src/services/routeProxyAnonymousAuth.ts`, `src/services/routeProxyClientAdapter.ts`, `supabase/functions/route-proxy/index.ts`, `supabase/functions/anonymous-auth-cleanup/index.ts`, `test/route-proxy-client-adapter.test.ts`, `test/route-proxy-r2-edge-contract.test.mjs`, 이 작업기록이다. migration/RLS, UI, 추천 엔진 정책, 카탈로그 원본, legacy `courseV1RouteAdapter` runtime은 수정하지 않았다.

실제 활성화 전에는 (1) Auth anonymous signup + CAPTCHA/요청 한도 배포 설정 수락, (2) `ROUTE_PROXY_*` abuse/lease/secret/catalog 설정, (3) Kakao/TMAP quota·상업 이용·응답 보관 승인, (4) DB migration/Edge Function 배포, (5) 비식별 one-request smoke, (6) scheduler secret과 운영 주기 승인을 확인해야 한다. 하나라도 불충족하면 default proxy 전환·ODsay 제거·2-J 진입을 하지 않는다.

## 2026-08-27 — 통합·결정 지시 API-4-A-R2-R: lease 만료 전 provider 요청 중단

**발견:** API-4-A-R2는 public fetch lease를 최대 5초(설정 시 1~30초)만 보유하지만 Kakao·TMAP `fetch`에 deadline/`AbortSignal`이 없다. 느리거나 멈춘 provider 요청이 lease 만료 뒤에도 실행되면 다른 Edge instance가 같은 key lease를 재claim해 중복 provider 호출·예산 예약을 만들 수 있다. 이는 DB-RP-2의 “같은 공개 segment에 instance 간 provider 호출 하나” 보장을 무너뜨린다.

1. `route-proxy`에서 유효한 lease TTL과 provider request deadline을 한 함수로 정규화한다. deadline은 반드시 TTL보다 안전 여유만큼 짧아야 하며, TTL·deadline 설정이 범위를 벗어나거나 이 관계를 만족하지 않으면 **provider 호출 전** typed `route_proxy_unavailable` 또는 `store_unavailable`으로 fail-closed 한다. 임의의 긴 기본 timeout은 두지 않는다.
2. Kakao 도보·대중교통과 TMAP 도보의 request 및 body parse 전체에 같은 deadline을 적용한다. deadline 도달 시 `AbortController`로 요청을 중단하고 typed 실패로 반환한다. lease release는 abort/HTTP/parse/예외 모든 경로에서 정확히 한 번 실행되며, release 뒤에는 해당 provider 요청이 계속 살아 있을 수 없다.
3. public lease의 owner가 timeout된 뒤에는 같은 request에서 오직 정책상 허용된 도보 반대 provider fallback 한 번만 가능하다. transit은 Kakao를 재시도하거나 ODsay/TMAP transit으로 우회하지 않는다. waiter는 기존처럼 한 번의 bounded wait·cache 재조회 뒤 `in_flight`로 종료한다.
4. 단위/계약 fixture에 다음을 추가한다: (a) 유효 TTL 대비 deadline 경계, (b) 잘못된 TTL/deadline은 provider `fetch` 0회, (c) Kakao·TMAP timeout abort와 release 1회, (d) timeout 뒤 expired lease를 다른 instance가 claim해도 원래 요청이 계속되지 않음, (e) transit timeout fallback 0회, (f) walk timeout의 반대 provider fallback 최대 1회, (g) private request에는 DB lease 0회. 실제 provider·실제 DB·secret을 쓰지 않는다.

**소유 경계:** `supabase/functions/route-proxy/`, API adapter/fixture와 이 작업기록만 수정한다. migration/RLS, 익명 cleanup 정책, UI·엔진·카탈로그·legacy runtime은 수정하지 않는다.

**완료 기준:** 어떤 공개 provider 호출도 owner lease보다 오래 지속되지 않으며, timeout·예외 뒤 lease가 해제되고 동일 공개 segment의 cross-instance 중복 호출 경로가 fixture로 재현 불가능해야 한다. 이후에만 API-4-A-R2를 조건부 수락으로 재검토한다. 배포/활성화·ODsay 제거·2-J 진입은 여전히 별도 게이트다.

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

---

## 2026-08-28 — 통합·결정 지시 API-LEGACY-01: V1 실경로 호출 예산·관찰 계약

### 배경과 목표

- **이전 상태:** 현행 앱은 `courseV1RouteAdapter`에서 TMAP 도보를 먼저 요청하고, 도보가 14분 초과하거나 실패하면 ODsay 대중교통을 추가 요청한다. 엔진의 4개 코스 상한은 있으나, 추천 요청 하나의 제공사 호출 수와 ODsay retry 수는 별도 관찰·제한하지 않는다.
- **문제:** 1곳·넓은 1곳·2곳·3곳 코스를 모두 끝까지 검증하면 다리는 최대 `2 + 2 + 3 + 4 = 11`개다. cache가 없고 모든 도보가 장거리/실패이면 TMAP 논리 조회 최대 11회와 ODsay 논리 조회 최대 11회가 발생한다. `precompute` 내부 retry가 있으면 실제 HTTP attempt는 이 논리 조회 수와 다를 수 있다. 그러므로 “4개 코스”만으로 ODsay 30건/일에 안전하다고 판단하면 안 된다.
- **교체 목표:** 실 API 없이 논리 구간·adapter fetch·provider HTTP attempt·cache hit·예산 초과를 분리해 관찰·제한하는 adapter 계약을 만든다. 다음 제한 수동 검증은 이 수치로 한 번의 실행 범위를 정한다.

### 담당과 경계

**담당:** 외부 API 어댑터 세션. `src/services/courseV1RouteAdapter.ts`, API 호출 관찰에 필요한 최소 legacy client 경계, adapter 계약 테스트와 이 작업기록만 수정한다.

후보 정책·4코스 상한·점수(`src/engine/courseV1.ts`), UI 화면/세션, 카탈로그, DB/Route Proxy 활성화, ODsay 제거, API 키·quota 설정은 수정하지 않는다. `src/engine/travel.ts`에 HTTP attempt 관찰 hook이 필요하면 후보 계산·근사/시간 판정을 바꾸지 않는 최소 관찰 코드만 예외적으로 추가하고 공개 계약을 기록한다.

### 구현 지시

1. 다음을 별도 수치로 정의한다.
   - `logicalSegment`: `adapter.getRoute(from, to)`의 방향 있는 구간 하나
   - `adapterFetch`: `walk` 또는 `transit` fetcher 경계의 한 시도
   - `providerHttpAttempt`: TMAP/ODsay 실제 HTTP 요청 횟수. retry는 각각 센다.
   `adapterFetch`를 HTTP 호출 수로 표기하거나 세 값을 하나의 `requests` 수로 합치지 않는다.
2. 추천 요청 수명용 `RouteRequestBudget`/scope 계약을 추가한다. fixture 주입값으로 logical segment 11, walk fetch 11, transit fetch 11을 표현할 수 있어야 한다. provider별 HTTP attempt 상한은 별도 주입값이며 임의 기본값을 정하지 않는다. 기존 방향·수단 cache key, 성공 24시간/실패 5분 TTL, in-flight 공유를 유지한다.
3. cache hit과 shared in-flight은 logical 요청으로만 기록하고 새 adapter fetch·HTTP attempt 예산에는 넣지 않는다. 예산이 소진된 새 경로는 `null` 또는 명시 `limited` 진단으로 종료하며, 근사·차량·이전 성공 값으로 통과시키지 않는다. cache된 정확 결과는 재사용 가능하다.
4. 새 scope를 현재 UI runtime 기본 경로에는 아직 연결하지 않는다. 이 작업은 관찰·안전 계약이며 Proxy 전환·ODsay 제거·실 API 호출은 포함하지 않는다.
5. diagnostics/개발 로그는 provider·mode·hit/miss/shared-in-flight/limited와 집계 수만 둔다. 좌표·장소명·검색어·키·JWT·사용자 ID를 기록하지 않는다.

### 필수 fixture·완료 기준

1. 공유하지 않는 1·1·2·3곳 검증 fixture로 logical 11, walk 11, 모든 도보가 장거리/실패일 때 transit 11 상한을 검증한다. 이는 HTTP retry 상한이 아니라 adapter 경계 상한임을 명시한다.
2. transport fixture로 walk/transit 성공·timeout·retry 한 번을 만들어 `providerHttpAttempt`와 `adapterFetch`가 다를 수 있음을 검증한다. ODsay retry 수를 추측하거나 실 API를 호출하지 않는다.
3. 같은 scope 재실행·동시 같은 구간은 cache hit/shared in-flight로 새 adapter fetch·HTTP attempt가 증가하지 않아야 한다. 낮은 예산 fixture에서는 해당 구간이 `limited`/`null`이고 추천 통과로 승격되지 않아야 한다.
4. 기존 TTL, 자동 도보 14분 전환, 방향/수단 cache key, exact source 회귀를 유지한다. 관련 adapter 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`를 통과시키며 실 API는 0회여야 한다.
5. 완료 기록에는 변경 파일 / 유지한 엔진·UI·DB·Proxy 경계 / 세 수치의 fixture 결과 / 실제 `사상역 → 서면역` 수동 실행 전에 사용자가 정할 provider별 새 HTTP attempt 상한을 남긴다.

**완료 기준:** 한 추천 요청의 비용이 11개 다리·TMAP/ODsay 논리 조회·실제 HTTP attempt로 구분되어 재현되고, 예산 초과가 근사 추천으로 바뀌지 않음이 fixture로 증명된다. 통합·결정 수락 전에는 실제 수동 추천을 실행하지 않는다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-LEGACY-01 V1 실경로 호출 예산·관찰 계약

### 교체 기록과 변경 파일

- **이전 방식:** `courseV1RouteAdapter`는 cache miss마다 fetch만 집계했다. 추천 1회의 directed 구간 수, walk/transit adapter fetch, 제공사 HTTP retry attempt 및 예산 소진을 구분할 공개 계약이 없었다.
- **문제/관찰:** 4개 코스의 최대 11개 다리가 장거리이거나 실패하면 TMAP과 ODsay adapter fetch가 각각 11회까지 될 수 있으며, transport retry가 있으면 provider HTTP attempt는 그 수와 다를 수 있다.
- **교체 방식:** `src/services/courseV1RouteAdapter.ts`에 `RouteRequestBudget`, `createCourseV1RouteRequestScope()`, `CourseV1RouteTransportObserver`를 추가했다. 진단은 `logicalSegments`, mode별 `adapterFetches`, provider별 `providerHttpAttempts`, cache/shared in-flight, `limited`를 별도 집계한다. transport는 실제 HTTP 직전에 `recordProviderHttpAttempt()`를 호출하고, 거절된 attempt가 하나라도 있으면 어댑터는 결과를 exact route로 승격하지 않는다.
- **교체 이유:** fixture에서 retry 비용을 재현 가능하게 제한하되, 기존 direct legacy client가 관찰 hook을 아직 지원하지 않는 상황에서 실제 HTTP 수를 허위로 표기하지 않기 위해서다.
- **상태:** 현행 관찰·안전 계약. 새 scope는 UI runtime 기본 adapter에 연결하지 않았고 실제 외부 API 호출은 0회다.

- 변경: `src/services/courseV1RouteAdapter.ts`, `test/course-v1-route-adapter.test.ts`, 이 작업기록.
- 유지: `src/engine/courseV1.ts`의 후보·4코스·점수, `src/engine/travel.ts`의 시간/근사 정책, UI·세션, 카탈로그, DB, Route Proxy와 ODsay 제거 범위는 변경하지 않았다.

### 세 수치·예산·cache 공개 계약

| 항목 | 정의·집계 | 예산/제한 시 처리 |
| --- | --- | --- |
| `logicalSegment` | `adapter.getRoute(from, to)` 한 번. cache hit/shared in-flight도 포함 | scope `logicalSegments`를 넘는 새 요청은 `null`, `limited.logicalSegments` 증가 |
| `adapterFetch` | cache miss의 `walk` 또는 `transit` fetcher 경계 한 번 | `walkFetches`/`transitFetches`를 넘으면 fetch·HTTP 없이 `null` |
| `providerHttpAttempt` | transport가 실제 TMAP/ODsay HTTP 직전에 observer로 보고한 한 번; retry도 매번 별도 | provider별 상한은 호출자가 명시 주입하며, 거절된 attempt가 있으면 exact 결과로 통과시키지 않음 |
| cache/shared in-flight | 기존 방향·수단 key의 정확 결과 또는 진행 중 promise 재사용 | logical 수만 증가하고 새 adapter fetch·HTTP attempt 예산은 소비하지 않음 |

**철회(LEGACY-01 당시):** direct `defaultCourseV1RouteFetcher`는 transport observer를 호출하지 않아 `providerHttpAttemptsObserved: false`였다. API-LEGACY-01-R에서 실제 TMAP/ODsay HTTP 직전 observer 연결로 교체했으며, 이 과거 상태를 현재 구현 기준으로 사용하지 않는다.

### fixture 증거와 검증

| fixture | 결과 | 실제 API |
| --- | --- | --- |
| 공유하지 않는 11개 directed 구간 | logical 11회가 walk adapter fetch 11회와 transit adapter fetch 11회로 분리됨. 12번째는 `limited`/`null` | 0회 |
| walk timeout → retry 성공 | adapter fetch 1회, TMAP HTTP attempt 2회 | 0회 |
| 장거리 walk 성공 → transit timeout/retry 성공 | walk/transit adapter fetch 각 1회, TMAP 1회·ODsay 2회 HTTP attempt | 0회 |
| 낮은 TMAP attempt 예산 + cache/shared in-flight | cache hit/shared는 새 fetch·attempt 0회; 새 구간의 제한된 결과는 `null`, 근사값으로 승격하지 않음 | 0회 |

- `npx tsx --test test/course-v1-route-adapter.test.ts` — 11/11 통과
- `npm run test:typecheck` — 통과
- `npm test` — 92/92 통과
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip
- `git diff --check` — 통과

### 다음 결정 필요 사항·재현 조건

**철회된 다음 결정(LEGACY-01 당시):** legacy transport observer 연결 필요 조건은 API-LEGACY-01-R에서 충족했다. 다만 실제 `사상역 → 서면역` 수동 추천과 UI runtime budget scope 연결은 여전히 금지되며, 사용자는 그 전에 TMAP·ODsay provider HTTP attempt 상한을 각각 정해야 한다.

### 2026-08-28 — 통합·결정 검토: API-LEGACY-01 조건부·보완 필요

관찰 타입·무네트워크 fixture·11개 논리 구간의 상한 분리는 수락한다. 그러나 실제 추천 요청을 안전하게 제한하는 구현으로는 아직 수락하지 않는다.

1. `defaultCourseV1RouteFetcher`는 새 `CourseV1RouteTransportObserver`를 사용하지 않는다. 따라서 legacy 기본 경로에서 `providerHttpAttemptsObserved: false`이고 provider별 budget도 실제 HTTP 직전에 적용되지 않는다. 수치가 0이 아니라 “미관찰”임을 기록한 것은 맞지만, 이 상태로는 ODsay 30건/일 보호 장치가 아니다.
2. 현재 `getRoute()`은 walk의 provider attempt가 제한되어 `null`이 된 뒤에도 transit `getExactRoute()`을 시도한다. transit fixture가 exact 결과를 주면 동일 logical segment가 성공할 수 있다. 통합·결정 지시의 “어느 예산이 소진되면 해당 새 경로는 null/limited”와 충돌하며, 현 fixture는 transit도 null로 만들어 이 반례를 검증하지 못한다.

#### 보완 명령 API-LEGACY-01-R: budget 우회 차단·실제 transport 관찰 연결

**담당·경계:** 외부 API 어댑터 세션. `courseV1RouteAdapter`와 실제 TMAP/ODsay 호출 직전의 최소 client 관찰 경계, adapter 테스트, 이 작업기록만 수정한다. 엔진 후보·4코스 정책, UI runtime 연결, 카탈로그, DB/Proxy 활성화, ODsay 제거, 실 API 호출은 금지한다.

1. 하나의 새 `logicalSegment`에서 logical/walk/transit/provider HTTP attempt 예산 중 하나라도 거절되면 그 segment는 `null`/`limited`로 끝낸다. 특히 walk의 fetch 또는 TMAP HTTP attempt가 거절된 뒤 ODsay transit이 성공해도 exact route를 반환하거나 ODsay HTTP를 시작해서는 안 된다. 기존 cache된 exact result와 같은 in-flight은 예산 소진 뒤에도 재사용 가능하다.
2. fetcher가 provider attempt를 관찰 가능한지 명시하는 계약을 추가한다. provider HTTP budget이 설정됐는데 fetcher/transport가 미관찰이면, 새 외부 호출 전에 fail-closed `limited`로 끝낸다. `providerHttpAttempts: 0`, `observed: false`를 비용 0으로 해석하지 않는다.
3. legacy default TMAP/ODsay transport가 실제 HTTP 요청 **직전마다** observer를 호출하게 연결한다. retry가 있으면 retry마다 호출하며, observer가 false를 반환하면 그 HTTP 요청과 후속 fallback을 시작하지 않는다. 이 변경은 `travelMin`·근사 fallback·추천 판단을 바꾸지 않는 호출 관찰/취소 경계여야 한다.
4. 실패 fixture를 먼저 추가한다.
   - TMAP attempt가 거절되지만 ODsay transit은 성공 응답을 줄 수 있는 경우: 결과 null, ODsay 호출 0회.
   - unobserved fetcher + provider budget: fetcher 호출 0회, `limited`, HTTP attempt 미관찰 유지.
   - observed TMAP/ODsay retry와 cache/shared-in-flight: 상한 전까지 정확 결과, 상한 뒤 새 HTTP 0회, cache/in-flight exact은 재사용.
   - 실제 legacy client 경계 fixture: walk/transit 각 HTTP 직전 observer가 호출되고, 거절 뒤 request 함수 자체가 실행되지 않음.
5. 기존 11개 logical segment·walk/transit 11회 상한, TTL, 방향/수단 cache, exact source 회귀를 유지한다. 관련 adapter 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다.

**완료 기준:** provider budget이 실제 legacy HTTP 요청 전에 fail-closed로 적용되고, 어떤 예산 거절도 다른 mode/provider의 exact 성공으로 우회되지 않음이 fixture로 증명돼야 한다. 이 수락 뒤에도 UI runtime 연결과 실제 수동 호출 상한 결정은 별도 단계다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-LEGACY-01-R budget 우회 차단·실제 transport 관찰

### 교체 기록과 변경 파일

- **이전 방식:** API-LEGACY-01 scope는 fixture observer를 집계했지만 기본 legacy fetcher는 observer를 실제 TMAP/ODsay HTTP 경계에 연결하지 않았다. walk attempt 거절 뒤 `getRoute()`이 transit exact 결과를 반환할 수도 있었다.
- **문제/관찰:** provider budget을 실제 호출 전에 강제하지 못하고, 한 logical segment가 다른 mode 성공으로 예산 제한을 우회할 수 있었다.
- **교체 방식:** `CourseV1RouteFetcher.providerHttpAttemptsObserved`를 명시 계약으로 추가했다. provider HTTP budget이 있고 새 cache miss fetcher가 이를 `true`로 선언하지 않으면 호출 전에 fail-closed `limited`로 종료한다. `RouteLookup.limited`를 walk/transit 사이에 전달해 fetch·provider attempt·logical 제한 중 하나라도 거절된 segment는 transit fallback을 시작하지 않고 `null`로 끝낸다. `src/engine/travel.ts`의 `attemptLegacyRouteHttp()`를 TMAP·ODsay 실제 `fetch` 직전에 연결했고, observer 거절이면 usage 기록과 request 함수도 실행하지 않는다.
- **교체 이유:** `providerHttpAttempts: 0`/`observed: false`를 실제 비용 0으로 오해하지 않고, budget이 어떤 provider/mode의 exact route로도 우회되지 않게 하기 위해서다.
- **상태:** 현행 legacy 관찰·차단 계약. UI runtime 기본 연결, Proxy 전환, ODsay 제거 및 실제 API 호출은 수행하지 않았다.

- 변경: `src/services/courseV1RouteAdapter.ts`, `src/engine/travel.ts`, `test/course-v1-route-adapter.test.ts`, 이 작업기록.
- 유지: `src/engine/courseV1.ts`의 후보·4코스·점수, `travelMin`·근사 fallback·추천 판단, UI·카탈로그·DB·Proxy 활성화는 변경하지 않았다.

### fixture 증거

| fixture | 결과 | 실제 API |
| --- | --- | --- |
| TMAP attempt 거절 + transit exact 가능 응답 | 결과 `null`, transit adapter fetch/ODsay HTTP 0회 | 0회 |
| 미관찰 fetcher + provider budget | fetcher 0회, `limited.providerHttpAttempts` 증가, observed false 유지 | 0회 |
| observed retry + cache/shared in-flight | 상한 전 exact 반환, cache/shared는 새 HTTP 0회, 상한 뒤 새 구간은 `null` | 0회 |
| legacy TMAP/ODsay HTTP 경계 | 각 provider의 observer가 HTTP 직전에 호출됨; 거절된 ODsay request 함수 0회 | 0회 |

`defaultCourseV1RouteFetcher`는 `providerHttpAttemptsObserved: true`이고 `precompute`/`precomputeTransit`에 observer를 전달한다. 같은 transport에 retry가 추가되면 모든 실제 HTTP attempt가 `attemptLegacyRouteHttp()`을 다시 통과하므로 retry마다 별도 budget 판정이 적용된다.

### 검증과 다음 결정

- `npx tsx --test test/course-v1-route-adapter.test.ts` — 13/13 통과
- `npm run test:typecheck` — 통과
- `npm test` — 92/92 통과
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip
- `git diff --check` — 통과

실제 `사상역 → 서면역` 수동 추천과 UI runtime scope 연결은 여전히 금지한다. 통합·결정 세션은 실제 호출 허용 전에 TMAP·ODsay별 provider HTTP attempt 상한을 결정해야 하며, 이 작업은 그 상한을 임의로 정하지 않는다.

### 2026-08-28 — 통합·결정 검토: API-LEGACY-01-R 수락·runtime 연결 대기

**수락 범위:** 소스와 13개 adapter fixture를 다시 대조했다. 기본 legacy fetcher가 `providerHttpAttemptsObserved: true`를 선언하고 `precompute`/`precomputeTransit`으로 observer를 전달한다. TMAP·ODsay의 실제 HTTP 직전 `attemptLegacyRouteHttp()`이 budget을 판정하며, 거절하면 request 함수와 사용량 기록을 실행하지 않는다. cache/shared in-flight은 재사용하되, 새 miss의 제한 결과는 cache하지 않는다. 또한 walk 단계가 제한되면 transit fallback을 시작하지 않으므로, provider·mode를 바꿔 exact route를 얻는 우회가 없다.

**검증 재확인:** `npx tsx --test test/course-v1-route-adapter.test.ts` 13/13, `npm run test:typecheck`, `npm run test:ui` 103 통과/기존 철회 이력 1 skip, `npm test` 92/92, `git diff --check` 통과를 확인했다. 이 작업에서는 실제 provider 요청이 수행되지 않았다.

**수락하지 않은 범위:** 현재 앱 세션은 여전히 예산 없는 전역 legacy adapter를 사용한다. 따라서 이 수락은 **scope를 명시적으로 주입한 adapter 계약**에 한정되며, 실제 사용자의 ODsay 30건/일을 보호하는 runtime 정책 수락은 아니다. UI runtime 연결, Proxy 기본 전환, ODsay 제거, 실제 `사상역 → 서면역` 호출은 여전히 구현 전이다.

**다음 결정:** 첫 제한 실경로 진단을 시작하기 전에 한 추천 실행당 TMAP·ODsay HTTP attempt 상한을 확정해야 한다. 상한은 재시도도 각각 1건으로 세며, cache hit/in-flight 재사용에는 소비되지 않는다. 상한 확정 뒤에만 별도 UI/API 연결 작업과 한 건의 고정 수동 시나리오를 지시한다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-R2-R lease 만료 전 provider 요청 중단

### 교체 기록과 변경 파일

- **이전 방식:** public fetch lease TTL은 있었지만 Kakao·TMAP request와 response body parse에 deadline/AbortSignal이 없었다. lease가 만료된 뒤에도 최초 Edge instance의 provider 요청이 남아 다른 instance의 re-claim과 중복될 수 있었다.
- **문제/관찰:** 기존 TTL fallback은 설정 오류를 안전하게 막지 못했고, timeout 상태가 도보 fallback 사유나 lease release 경계로 명시되지 않았다.
- **교체 방식:** `supabase/functions/route-proxy/deadline.ts`에 lease TTL(1~30초)·provider deadline·250ms 안전 여유의 단일 정규화 계약을 추가했다. 두 환경값 중 하나가 없거나 범위/관계가 맞지 않으면 Edge Function은 provider fetch 전 `route_proxy_unavailable`으로 fail-closed한다. `withinProviderDeadline()`이 Kakao·TMAP의 HTTP와 `response.json()`을 동일 AbortSignal로 묶으며, timeout 결과는 `deadline_exceeded`다. public owner는 `releaseOnce()`로 timeout·HTTP·parse·예외의 실패 lease를 한 번만 release한다.
- **교체 이유:** provider 요청이 owner lease보다 길어지는 경우를 차단하고, lease 만료 후 cross-instance 중복 provider 호출 경로를 만들지 않기 위해서다.
- **상태:** 구현·무네트워크 fixture 완료. 배포·proxy 기본 전환·ODsay 제거·2-J 진입은 여전히 금지다.

- 변경: `supabase/functions/route-proxy/index.ts`, `supabase/functions/route-proxy/deadline.ts`, `test/route-proxy-deadline.test.ts`, `test/route-proxy-r2-edge-contract.test.mjs`, `test/route-proxy-edge-contract.test.mjs`, 이 작업기록.
- 유지: DB migration/RLS·lease RPC, 익명 cleanup, UI, 추천 엔진·카탈로그, legacy runtime은 변경하지 않았다.

### deadline·lease·fallback 계약

| 경우 | 처리 | provider/lease 경계 |
| --- | --- | --- |
| TTL/deadline 누락·범위 오류·안전 여유 미달 | `route_proxy_unavailable` | provider fetch 0회 |
| Kakao·TMAP HTTP 또는 body parse timeout | `AbortController.abort()` 후 `deadline_exceeded` | public owner lease는 `releaseOnce()`로 1회 release |
| public timeout 뒤 도보 | 반대 provider fallback 최대 1회 | 새 provider는 별도 lease; 원래 provider 요청은 AbortSignal 종료 뒤 계속 사용하지 않음 |
| public transit timeout | Kakao 결과로 종료 | 재시도·TMAP/ODsay transit fallback 0회 |
| private request | 같은 provider deadline 적용 | DB lease claim/release 0회 |
| waiter | 기존 bounded wait 1회 후 cache 재조회 또는 `in_flight` | 새 provider 호출 0회 |

실제 활성화 시 `ROUTE_PROXY_FETCH_LEASE_TTL_MS`와 `ROUTE_PROXY_PROVIDER_DEADLINE_MS`를 함께 설정해야 한다. deadline은 1ms 이상이며 TTL보다 최소 250ms 짧아야 한다. 이 작업은 값의 기본값을 임의로 정하지 않는다.

### fixture·검증

| fixture | 결과 | 실제 provider/DB |
| --- | --- | --- |
| 유효/무효 TTL·deadline | 5,000ms TTL/4,750ms deadline만 경계 통과; 범위·관계 오류는 null | 0회 |
| deadline abort | AbortSignal 전달, timeout 뒤 늦은 provider 결과 미사용 | 0회 |
| Edge source contract | Kakao/ TMAP fetch와 body parse에 동일 deadline signal, release once, transit fallback 없음, 도보 1회 fallback | 0회 |

- `npx tsx --test test/route-proxy-deadline.test.ts` — 2/2 통과
- `node --test test/route-proxy-r2-edge-contract.test.mjs test/route-proxy-edge-contract.test.mjs` — 7/7 통과
- `npm run test:typecheck` — 통과
- `npm test` — 93/93 통과
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip
- `git diff --check` — 통과

### 다음 결정 필요 사항

실제 배포·활성화 전에는 Kakao/TMAP quota·상업/응답 보관 승인, Auth/CAPTCHA/abuse 설정, DB migration 적용을 확인해야 한다. 이 변경만으로 실제 provider 호출을 승인하지 않으며, 실제 환경 설정값이나 secret을 기록·검증 입력으로 사용하지 않았다.

### 2026-08-28 — 통합·결정 검토: API-4-A-R2-R 조건부 수락·배포 전 행동 검증 대기

**수락 범위:** `resolveRouteProxyDeadlineConfig()`은 TTL 1~30초, 250ms 안전 여유, 누락·범위 오류 fail-closed를 실제 Edge 진입 전에 적용한다. Kakao 도보·대중교통과 TMAP 도보의 `fetch` 및 `response.json()`은 같은 `AbortSignal`을 받고, `deadline_exceeded`는 public lease의 `releaseOnce()`와 도보 1회 fallback의 실패 사유에 포함된다. transit은 Kakao 외 fallback이 없다. 직접 재실행한 deadline 단위 2/2, Edge 계약 7/7, typecheck, 전체 테스트 93/93, diff 검사는 통과했다.

**조건부 사유:** 현재 2개 deadline 단위 fixture는 AbortSignal과 늦은 결과 미사용을 검증하고, 나머지는 Edge 소스 계약 검사다. 실제 Edge handler를 가짜 provider와 가짜 RPC로 실행하여 `timeout → abort → release 정확히 1회 → 다음 claim`, 도보 반대 provider 최대 1회, transit fallback 0회를 관찰하는 행동 fixture는 아직 없다. 코드의 구조적 연결은 확인됐지만, 이 마지막 시험 없이 배포 환경에서 provider 호출을 활성화하지 않는다.

**다음 게이트:** 위 행동 fixture와 별개로 카카오·TMAP 계정의 quota/상업 이용/응답 보관 승인, anonymous Auth·CAPTCHA·abuse 설정, DB migration·Edge secret·catalog snapshot 배포, 비식별 단일 smoke가 필요하다. 모두 충족하기 전에는 Proxy 기본 전환·ODsay 제거·추천 엔진 2-J 진입을 하지 않는다.

---

## 2026-08-28 — 통합·결정 지시 API-4-A-R2-RB: Route Proxy timeout 행동 fixture

### 목적

API-4-A-R2-R은 deadline 계산과 실제 `fetch`/`response.json()` signal 연결을 구현했지만, Edge Function 전체를 실행하는 고정 행동 fixture는 없다. 이 작업의 목적은 배포·실 API 없이 timeout된 owner 요청이 lease를 정확히 한 번 해제하고, 늦은 provider 결과가 cache/완료로 승격되지 않으며, 다음 owner가 안전하게 claim할 수 있음을 증명하는 것이다.

### 담당·변경 경계

외부 API 어댑터 세션은 `supabase/functions/route-proxy/`의 테스트 가능한 handler 경계, API 계약 테스트와 이 작업기록만 수정한다. 필요하면 현재 `Deno.serve()` 호출에서 순수 또는 의존성 주입 가능한 handler factory를 추출하되, production entry는 동일 factory만 호출하게 유지한다.

다음은 변경 금지다: DB migration/RLS·RPC 의미, Auth/익명 cleanup 정책, 카탈로그, 추천 엔진과 후보 수, UI, 앱 runtime adapter, ODsay 제거, Supabase 배포/secret 설정, 실제 Kakao·TMAP·DB 호출. `fetch`·clock·환경값·Supabase RPC는 fixture에서 모두 가짜 구현을 주입한다.

### 구현 요구

1. Edge handler가 테스트에서 다음 의존성을 주입받을 수 있게 최소 경계를 만든다: 환경값 조회, 시각/대기, provider `fetch`, 인증 결과, RPC 결과. production에서는 기존 Deno 환경·`fetch`·Supabase client만 같은 경계로 연결한다. 비밀값·토큰·좌표·provider 원문을 fixture 출력·로그에 넣지 않는다.
2. `withinProviderDeadline()`의 기존 정책을 바꾸지 않는다. timeout fixture의 fake provider는 `AbortSignal`을 받은 뒤 abort가 발생해야만 해제되며, abort 뒤 의도적으로 늦은 성공 값을 반환할 수 있어야 한다. handler는 이를 `deadline_exceeded`로 처리하고 `complete`/cache 성공을 호출하지 않아야 한다.
3. public lease fake store는 claim 소유 token, release/complete 횟수, 현재 lease 상태만 추적한다. 실제 RPC 이름·입출력 계약은 유지하되, fixture는 동일 공개 key의 다음 호출이 첫 owner release 뒤 새 token으로 claim될 수 있음을 보여야 한다. 원래 provider promise가 늦게 끝나도 두 번째 claim 뒤 다시 provider 호출하거나 첫 token으로 complete하면 실패다.
4. handler 행동 fixture는 source 문자열 검사만으로 대체하지 않는다. 최소 아래 사례를 실제 handler 반환값·fake fetch/RPC 호출 순서·횟수로 검증한다.

| ID | 고정 입력 | 필수 기대 결과 |
| --- | --- | --- |
| API4AR2RB-01 | 유효 인증/public scope, TTL 5,000ms·deadline 4,750ms, 첫 Kakao provider가 timeout 뒤 늦은 성공 | signal abort 관찰, 응답 `deadline_exceeded`, 해당 lease release 정확히 1회, complete/cache 성공 0회 |
| API4AR2RB-02 | RB-01 직후 같은 public key의 새 요청 | 새 lease token claim 가능; 첫 요청의 늦은 성공은 새 provider/complete를 만들지 않음 |
| API4AR2RB-03 | walk의 첫 provider timeout, 반대 도보 provider 성공 | provider 호출 최대 2회, 각 claim/release 또는 complete가 자기 token에만 대응; fallback은 정확히 한 번 |
| API4AR2RB-04 | transit Kakao timeout | Kakao provider 1회, release 1회, TMAP·ODsay provider 호출과 fallback 0회 |
| API4AR2RB-05 | private scope provider timeout | abort와 `deadline_exceeded`는 같고, claim/complete/release RPC 0회 |
| API4AR2RB-06 | TTL/deadline 누락·관계 오류 | provider fetch·budget reserve·claim/complete/release 0회, `route_proxy_unavailable` |

5. 기존 source 계약 테스트는 보조 회귀로 유지하되 위 행동 fixture를 통과해야 완료다. 실제 HTTP·DB/Edge 배포, 카카오·TMAP key/secret, 실제 사용자·GPS·검색어를 사용하지 않는다.

### 검증·완료 기준

- 관련 행동 fixture, 기존 route-proxy contract fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다.
- 완료 기록에는 변경 파일, production과 fixture 주입 경계, 실제 API/DB 0회, 각 ID의 결과와 변경하지 않은 정책 경계를 남긴다.
- **완료 기준:** timeout된 provider는 lease TTL 전에 AbortSignal로 중단되고 늦은 성공이 어떤 cache/complete/provider 재호출도 만들지 않으며, release 뒤의 새 owner와 도보 1회 fallback·transit fallback 0회·private lease 0회가 행동 fixture로 재현돼야 한다. 이것을 수락해도 계정 승인·배포·one-request smoke·runtime 전환은 별도 게이트다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-R2-RB Route Proxy timeout 행동 fixture

- **이전 방식 → 문제:** deadline은 단위/소스 계약만 있어, 동일 handler에서 timeout 후 release 한 번·늦은 성공 미승격·다음 owner claim을 증명할 수 없었다.
- **교체 방식:** `createRouteProxyHandler()` factory에 env·clock/wait·deadline scheduler·fetch·인증·RPC를 주입하고 production `index.ts`도 이 factory만 호출하게 했다. 가짜 provider는 AbortSignal 뒤 늦은 성공을 반환하고, fake RPC store는 lease token·claim/release/complete 횟수만 추적한다.
- **교체 이유·상태:** 실제 provider/DB/배포 없이 timeout 경쟁을 행동으로 검증하기 위해서이며, 현행 구현·fixture 완료 상태다.

| ID | handler 행동 결과 | 실제 API/DB |
| --- | --- | --- |
| API4AR2RB-01 | public transit timeout: abort, `deadline_exceeded`, lease-1 release 1회, complete 0회 | 0회 |
| API4AR2RB-02 | 같은 key 후속 요청: release 뒤 lease-2 새 claim, 첫 늦은 성공 complete/re-call 0회 | 0회 |
| API4AR2RB-03 | walk Kakao timeout → TMAP 성공: provider 2회, fallback 1회, token별 release/complete | 0회 |
| API4AR2RB-04 | transit timeout: Kakao 1회, release 1회, TMAP·ODsay fallback 0회 | 0회 |
| API4AR2RB-05 | private timeout: abort/`deadline_exceeded`, lease RPC 0회 | 0회 |
| API4AR2RB-06 | deadline 누락: `route_proxy_unavailable`, provider·budget·lease RPC 0회 | 0회 |

- 변경: `supabase/functions/route-proxy/{handler,index,deadline}.ts`, `test/route-proxy-timeout-behavior.test.ts`, Route Proxy contract tests, 이 작업기록.
- 유지: DB migration/RLS·RPC 의미, Auth/cleanup 정책, 카탈로그, 추천 엔진·UI·runtime adapter, ODsay 제거·배포/secret 설정은 변경하지 않았다.
- `npx tsx --test test/route-proxy-timeout-behavior.test.ts` — 5/5 통과
- `node --test test/route-proxy-edge-contract.test.mjs test/route-proxy-r2-edge-contract.test.mjs` — 7/7 통과
- `npm run test:typecheck` — 통과
- `npm test` — 93/93 통과
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip
- `git diff --check` — 통과

Proxy 기본 전환·ODsay 제거·2-J 진입은 계정 quota/상업·보관 승인, anonymous Auth/CAPTCHA/abuse, migration/Edge secret/catalog snapshot 배포와 비식별 smoke가 끝나기 전까지 금지한다.

### 2026-08-28 — 통합·결정 검토: API-4-A-R2-RB 수락·활성화 게이트 대기

`createRouteProxyHandler()`가 production `Deno.serve()`에서 그대로 소비되는 handler factory임을 확인했다. 새 행동 fixture는 가짜 환경·clock·deadline scheduler·provider fetch·인증·RPC로 이 공개 handler를 실행한다. public transit timeout의 abort·release 1회·complete 0회와 새 lease token claim, walk의 Kakao timeout 뒤 TMAP 한 번 성공, transit의 fallback 없음, private의 lease RPC 없음, deadline 누락의 provider/budget/lease 0회를 실제 반환값과 호출 순서로 확인한다.

재실행 결과는 `test/route-proxy-timeout-behavior.test.ts` 5/5, 기존 Edge 계약 7/7, typecheck, 전체 테스트 93/93, `git diff --check` 통과다. 실제 Kakao·TMAP·Supabase·secret·사용자 데이터는 사용하지 않았다.

따라서 API-4-A-R2-R의 timeout/lease 구현과 API-4-A-R2-RB의 행동 검증은 수락한다. 남은 것은 코드 보완이 아니라 카카오·TMAP quota/상업 이용/응답 보관 승인, anonymous Auth/CAPTCHA/abuse 설정, migration·Edge secret·catalog snapshot 배포, 비식별 단일 smoke라는 활성화 게이트다. 이들이 충족되기 전에는 Proxy 기본 전환·ODsay 제거·추천 엔진 2-J를 시작하지 않는다.

---

## 2026-08-28 — 통합·결정 지시 API-4-A-ACT-01: Route Proxy 활성화 사전점검

### 목표와 상태 범위

Route Proxy의 코드·deadline·lease 행동 fixture는 수락됐다. 다음 단계는 실제 카카오 경로로 전환할 수 있는 **계정·배포 준비도 판정**이다. 이 작업은 위험한 활성화를 수행하는 명령이 아니다. 필요한 승인을 비밀값 없이 확인하고, 가능한 항목과 사용자/계정 관리자 승인 없이는 할 수 없는 항목을 하나의 매트릭스로 확정한다.

**이번 작업에서 금지:** Supabase migration 적용, Edge Function 배포, secret 설정·출력, Auth/CAPTCHA 설정 변경, 실제 Kakao/TMAP provider 호출, 비식별 smoke, 앱 기본 adapter 전환, ODsay 코드 제거, UI·엔진·카탈로그·DB migration 수정. 현재 작업의 결과가 `ready`여도, 위 변경은 사용자의 별도 명시 승인 뒤 다음 작업에서만 수행한다.

### 담당·소유 경계

외부 API 어댑터 세션은 이 작업기록과 안전한 배포 준비도 검사 스크립트/fixture(필요한 경우에만)를 수정할 수 있다. DB migration/RLS와 Auth 정책 자체는 DB·개인화 소유이므로 변경하지 않는다. 계정 콘솔에서만 알 수 있는 사실을 문서나 코드로 추측해 채우지 않는다.

### 사전점검 항목

아래 각 항목은 `ready`, `blocked`, `unknown` 중 하나로 판정한다. `ready`는 증거 위치·확인일·담당 주체만 남기며 API key, token, secret 값, 사용자 ID, GPS, 원문 provider 응답은 기록하지 않는다. 콘솔을 볼 권한이 없으면 `unknown`이 아니라 **승인 대기 blocked**로 기록한다.

| ID | 점검 항목 | `ready` 조건 | 허용된 확인 방법 | 차단 시 다음 주체 |
| --- | --- | --- | --- | --- |
| ACT-01 | Kakao route 권한·quota | 배포할 Kakao 앱에서 Map REST의 도보와 대중교통 endpoint 사용 가능, quota/유료 전환 상태 확인 | 공식 콘솔·공식 문서의 상태 화면을 값 없이 확인 | 사용자 또는 Kakao 앱 관리자 |
| ACT-02 | Kakao 상업·응답 보관 | 공모전 배포 형태의 상업/비상업 적용 조건과 route 응답의 공용 cache 보관 허용 기간 확인 | 공식 약관/관리자 확인의 링크·확인일 | 사용자 또는 Kakao 계약 담당 |
| ACT-03 | TMAP 도보 권한·quota | 배포 appKey의 도보 route 이용 가능, 일일/초당 제한과 상업·cache 보관 조건 확인 | 공식 콘솔·계약/문서, 값 미기록 | 사용자 또는 TMAP 관리자 |
| ACT-04 | 대상 Supabase migration | route cache/lease/privacy migration 세 개가 **대상 프로젝트**에 적용돼 있고 service-role RPC만 공개됨 | migration 목록·schema 상태의 migration ID만 확인 | 사용자 또는 Supabase 배포 담당 |
| ACT-05 | Auth·abuse 설정 | anonymous sign-in, CAPTCHA, 요청 제한을 활성화할 책임자·설정값 결정이 있고, 미승인 기본값은 fail-closed | 설정 존재 여부/승인 상태만 확인 | 사용자 |
| ACT-06 | Edge 운영 설정 | route proxy와 cleanup에 필요한 secret 이름, abuse/rate, lease/deadline, provider budget, catalog snapshot **항목 목록**이 확정됨 | 값 없이 required-name checklist 대조 | 사용자 또는 Supabase 배포 담당 |
| ACT-07 | 관찰·중단 기준 | smoke 1회에서 기록할 비식별 집계(provider/mode/status/cache/budget delta)와 실패 시 즉시 legacy 유지·배포 중단 담당이 정해짐 | 이 문서의 고정 smoke 계획 대조 | 통합·결정 + 사용자 |

### 안전한 점검 절차

1. 먼저 저장소의 migration ID, Edge Function 이름, 필요한 환경변수 **이름**, catalog snapshot schema/version 요구사항을 정적 검사로 목록화한다. `.env*` 파일 내용, `supabase secrets list`의 값, API key, access token은 출력·복사·문서화하지 않는다.
2. Supabase 대상 프로젝트에 접근 권한이 이미 있고 사용자가 제공한 안전한 배포 연결이 있는 경우에도, 이번에는 읽기 전용 migration 상태만 확인한다. 대상 프로젝트 식별자·URL·사용자 정보는 결과에 쓰지 않고 `대상 프로젝트 / migration ID 일치 여부`만 기록한다. 접근/승인이 없으면 명령을 우회하거나 새 로그인·secret 설정을 시도하지 않는다.
3. Kakao·TMAP은 공식 문서와 권한 있는 계정 화면에서 **ACT-01~03의 상태만** 확인한다. endpoint에 실제 요청을 보내거나 trial quota를 소비하지 않는다. 문서만으로 계정별 quota/권한을 알 수 없는 경우 `blocked`로 둔다.
4. ACT-05~07은 사용자의 정책·배포 권한이 필요한 항목이다. 기존 코드가 fail-closed라는 사실과 “활성화 승인 여부”를 혼동하지 않는다. 값이 미정이면 합리적 기본값을 넣지 않고 blocked로 남긴다.
5. 결과를 아래 표로 기록한다. `ready`가 하나라도 아닌 경우 배포 명령을 제안하거나 실행하지 않는다. 모든 항목이 ready여도 최종 행의 사용자 명시 승인 없이는 다음 단계로 가지 않는다.

| 게이트 | 상태 | 비밀 없는 증거/차단 이유 | 다음 행동/담당 |
| --- | --- | --- | --- |
| ACT-01 |  |  |  |
| ACT-02 |  |  |  |
| ACT-03 |  |  |  |
| ACT-04 |  |  |  |
| ACT-05 |  |  |  |
| ACT-06 |  |  |  |
| ACT-07 |  |  |  |
| 사용자 배포 승인 | blocked (초기값) | 이 작업은 승인 요청 전 점검만 수행 | 사용자 |

### 다음 단계의 고정 범위 (이번에는 수행하지 않음)

모든 ACT가 `ready`이고 사용자가 **배포와 단일 smoke를 명시 승인**한 경우에만 다음 별도 작업을 지시한다. 그 작업은 migration 적용 여부 재확인 → secret 설정 → Auth/CAPTCHA/abuse 설정 → Edge 배포 → provider를 한 번만 쓰는 비식별 public-segment smoke → 결과 확인 → 실패 시 즉시 기본 adapter 유지의 순서를 한 작업 안에 묶는다. smoke 성공 자체로 앱 default 전환이나 ODsay 삭제를 자동 수행하지 않는다.

### 완료 기준

ACT-01~07과 사용자 배포 승인을 구분한 매트릭스, 변경하지 않은 경계, 실행한 읽기 전용 확인과 결과를 기록하면 완료다. 이 작업의 유효한 결과는 `배포 준비`, `승인/정보 대기`, `차단` 중 하나이며, 어느 경우에도 실제 provider 호출·DB 변경·배포·런타임 전환은 0회여야 한다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-01 Route Proxy 활성화 사전점검

### 판정

**최종 상태: 차단.** 배포·secret 설정·Auth/CAPTCHA 변경·Edge 배포·실 provider 호출·smoke·기본 adapter 전환은 모두 0회로 유지했다.

| 게이트 | 상태 | 비밀 없는 증거/차단 이유 | 다음 행동/담당 |
| --- | --- | --- | --- |
| ACT-01 | blocked | 배포 대상 Kakao 앱의 route endpoint 권한·quota·유료 전환 상태는 계정 콘솔 권한 없이 확인 불가 | 사용자 또는 Kakao 앱 관리자 |
| ACT-02 | blocked | Kakao 공모전 배포의 상업/비상업 적용 및 공용 route cache 보관 허용 기간에 대한 계정·계약 확인 없음 | 사용자 또는 Kakao 계약 담당 |
| ACT-03 | blocked | 배포 대상 TMAP appKey의 도보 권한·일일/초당 quota·상업/보관 조건 확인 없음 | 사용자 또는 TMAP 관리자 |
| ACT-04 | blocked | 읽기 전용 대상 migration 목록에서 `202608270010`, `202608270011`, `202608270012`은 local만 존재하고 remote 적용 값은 비어 있음 | 사용자 또는 Supabase 배포 담당이 세 migration 적용 후 재점검 |
| ACT-05 | blocked | 저장소 local Supabase config는 anonymous sign-in 비활성이며, 대상 프로젝트의 anonymous Auth·CAPTCHA와 abuse 설정/승인 상태를 확인하지 못함 | 사용자 |
| ACT-06 | blocked | required-name 목록은 정적 확인했으나 실제 secret·abuse/rate·lease/deadline·provider budget·catalog snapshot 값과 책임자 승인이 없음 | 사용자 또는 Supabase 배포 담당 |
| ACT-07 | blocked | 실패 시 legacy 유지 원칙은 문서화됐지만 비식별 smoke 집계의 운영 담당·중단 책임자 승인 없음 | 통합·결정 + 사용자 |
| 사용자 배포 승인 | blocked | 이번 작업은 승인 전 읽기 전용 점검만 수행 | 사용자 |

### 읽기 전용 증거와 유지 경계

- 정적 확인: `supabase/migrations/202608270010_route_proxy_store.sql`, `202608270011_route_proxy_fetch_lease.sql`, `202608270012_anonymous_auth_cleanup_contract.sql`; route-proxy와 cleanup Edge 함수; `ROUTE_PROXY_*`, provider key 이름, catalog snapshot schema/version 요구사항을 값 없이 대조했다.
- 대상 migration 읽기 전용 확인: migration 목록 조회는 성공했으며 위 세 migration이 대상 remote에 아직 적용되지 않은 것을 확인했다. 대상 URL·project ID·DB URL·token·secret 값은 기록하지 않았다.
- local config 참고: `supabase/config.toml`의 anonymous sign-in은 false이나, 이는 대상 Supabase Auth/CAPTCHA 설정 증거가 아니므로 ACT-05를 ready로 올리지 않았다.
- 변경하지 않음: DB migration/RLS·Auth 정책·secret·배포·Edge 활성화·UI·추천 엔진·runtime adapter·ODsay 제거. 실제 Kakao·TMAP provider와 실제 사용자/GPS/검색어 호출은 0회다.

### 다음 승인 게이트

ACT-04의 세 migration 적용과 ACT-01~03 계정 조건 확인, ACT-05~07 운영 승인, **사용자의 배포 및 단일 비식별 smoke 명시 승인**이 모두 완료되기 전에는 다음 명령을 제안하거나 실행하지 않는다. 이 점검은 Route Proxy 코드 수락과 별개이며, 현재 앱은 legacy 기본 경로를 유지한다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-01 수락·활성화 차단 확정

사전점검의 목적은 준비 상태를 억지로 `ready`로 만드는 것이 아니라, 계정·배포 권한이 없는 조건에서 안전한 판정을 남기는 것이다. ACT-01~03을 콘솔/계약 증거 없이 `unknown`이나 문서 추정으로 통과시키지 않고 `blocked`로 처리했고, local anonymous 설정을 대상 프로젝트 설정의 증거로 오인하지 않았다. 또한 대상 remote에 세 migration이 아직 적용되지 않았다는 읽기 전용 확인을 남겼다.

따라서 이 작업은 **차단 결론으로 수락**한다. 추가 API 코드 보완·legacy ODsay 예산 연결·실 provider 호출은 시작하지 않는다. 활성화 차단은 Route Proxy runtime 전환에만 적용하며, 추천 엔진의 순수 계산·고정 fixture·UIUX 체감 개선은 이제 이 API 작업을 기다리지 않고 진행한다. 나중에 사용자가 계정 조건과 배포·단일 smoke를 명시 승인할 때에만, 현 매트릭스를 다시 열어 활성화 작업을 한 번에 지시한다.

### 2026-08-28 — 통합·결정 보완: 카카오 대중교통 제공사 가능성 확정·계정 활성화 대기

사용자 지적에 따라 “계정 활성화 차단”과 “대중교통 제공사 자체의 부재”를 분리해 재확인했다. 현재 로컬 설정 파일에는 TMAP 키 이름만 있고 Route Proxy가 요구하는 서버 전용 `KAKAO_ROUTE_REST_API_KEY`는 없다. 따라서 이 저장소에서 Kakao 대중교통 endpoint를 실제 호출해 계정 권한을 확인할 수는 없다.

그러나 Kakao 공식 REST 문서는 `GET /v2/routing/publictraffic`를 REST API 키 인증으로 제공하며, 대중교통 경로와 도보 경로를 각각 지원한다. 공식 쿼터 문서는 카카오맵 REST API의 대중교통·도보 경로 조회에 일 1,000건을 표시한다. 단, 무료 쿼터는 개발자 계정에서 첫 번째로 활성화한 카카오맵 앱에 적용된다는 조건이 있으므로, 이것을 이 프로젝트 계정의 실제 quota/권한 증거로 읽어서는 안 된다. [Kakao Map REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api), [Kakao quota](https://developers.kakao.com/docs/ko/getting-started/quota)

**제품 결정:** 대중교통은 추천 엔진·제품 범위에서 유지한다. 현재 차단은 기술적 제공사 부재가 아니라 계정·운영 설정 대기다. 사용자가 Kakao Developers에서 배포할 앱의 REST API 키와 첫 지도 활성 앱/quota 상태를 확인하고, server secret으로 설정·배포하는 것을 명시 승인하면 한 번의 제한된 활성화 작업에서 public transit smoke로 계정 가용성을 검증한다. 이 승인 전에는 키를 문서·채팅·모바일 번들에 넣거나 실제 요청하지 않는다.

### 2026-08-28 — 통합·결정 확정: 카카오 대중교통 실호출 가능, Proxy 활성화는 별도 차단

사용자가 현재 REST API 키 등록을 확인한 뒤 허용한 단일 검증으로, 고정 공개 출발·도착 좌표에 Kakao `publictraffic` endpoint를 한 번 호출했다. 결과는 **HTTP 200 / Kakao status `OK` / routeCount 15**였다. 키 값·Authorization·좌표·응답 원문은 출력·기록하지 않았다. 따라서 이 계정은 적어도 현재 시점에 Kakao 대중교통 경로를 실제 반환하며, “대중교통 제공사 불가” 가설은 기각한다.

**제품 결정:** 추천 엔진은 대중교통을 포함한다. 도보 전용으로 축소하거나 ODsay 30건/일을 제품 기준으로 유지하지 않는다. 이 실호출은 제품 범위 결정을 위한 단발 확인이며, Proxy 배포·앱 runtime 전환·반복 테스트를 승인하는 것은 아니다.

**남은 활성화 경계:** 현재 키는 `EXPO_PUBLIC_` 환경변수로 모바일 번들에 노출되는 경로이므로 Route Proxy의 server-only provider secret으로 그대로 재사용하지 않는다. 실제 Proxy 전환 전에는 별도 server-only key를 발급/교체해 서버 secret으로만 주입하고, 공개 번들·문서·로그에서 제거할 보안 전환이 필요하다. 그 외 원격 migration 3개, Auth/CAPTCHA/abuse, Edge 설정·배포, 사용자 배포 승인도 여전히 남아 있다. 이들은 대중교통 추천 정책을 막지 않지만 Proxy 활성화 전제다.

---

## 2026-08-28 — 통합·결정 지시 API-4-A-ACT-02: ODsay 기본 경로의 안전한 Route Proxy 전환

**상태:** 사용자 키 분리 결정 대기. Kakao 대중교통 provider 자체는 단일 smoke로 가능함을 확인했고, Route Proxy·timeout·lease·budget 코드도 준비됐다. 그러나 현재 mobile bundle에 공개된 키를 Edge provider secret으로 재사용하는 전환은 허용하지 않는다. 이 작업은 전제 없이 실행하면 안 되는 실제 배포 작업의 정확한 범위를 미리 고정한다.

### 초기 선택지 (2026-08-28 결정으로 선택 1 철회)

당시 Proxy는 대중교통에 Kakao, 도보에 Kakao·TMAP 이중화를 사용했다. 아래는 당시의 선택지이며, 뒤의 "사용자 결정: Kakao 단일 경로 제공사"로 선택 1은 철회되고 선택 2가 현행이 됐다.

1. **철회 — 이중 도보 유지:** Kakao와 TMAP 각각에 대해 mobile public key와 다른 server-only route key를 발급·교체하고, 해당 값은 Supabase Edge secret에만 제공하는 방안이었다.
2. **현행 — Kakao 도보 단일화:** server-only Kakao route key만 확보하고, TMAP 도보 provider 선택·fallback을 코드와 계약에서 제거한다.

어느 선택에서도 실제 key 값은 채팅, `docs/`, `.env*`, 모바일 bundle, 테스트 fixture, 로그에 넣지 않는다. 키 발급/교체 뒤 사용자는 “서버 secret 설정과 배포 승인”만 알려 주고, secret 값은 배포 시스템의 secret 입력 경로로만 전달한다.

### `EXPO_PUBLIC_*` 변수의 정확한 경계

`EXPO_PUBLIC_KAKAO_REST_API_KEY`가 존재하는 것 자체는 금지가 아니다. Expo는 이 값을 앱 번들에 넣으므로, 현재처럼 기기에서 직접 수행하는 장소명·주소 검색과 역지오코딩의 **client API key**로만 취급한다. 이 값으로 호출되는 기능은 앱 안의 TTL/in-flight cache와 UI 입력 debounce로 호출량을 줄일 수는 있어도, 키 값 자체를 비밀로 보호할 수는 없다.

반대로 추천의 실제 도보·대중교통 경로는 호출당 비용·예산·공용 cache·abuse guard를 서버에서 통제해야 한다. 그러므로 `KAKAO_ROUTE_REST_API_KEY`는 `EXPO_PUBLIC_` 접두사 없이 Supabase Edge Function secret에만 두며, mobile code·navigation payload·로그·fixture는 이 값을 읽거나 전달하지 않는다. **같은 공개 key를 두 변수에 복사하는 것은 분리가 아니다.**

권장 발급 절차는 Kakao Developers의 현재 서비스 앱에서 REST API key를 추가해 `route-proxy` 용도로 구분하고, 해당 새 key만 Edge secret에 넣는 것이다. 별도 Kakao "앱"을 새로 만들면 Map 무료 quota의 첫 활성 앱 조건을 다시 검토해야 하므로, 별도 앱 생성은 이 단계의 기본 선택이 아니다. Kakao는 앱 관리 화면에서 platform key를 추가할 수 있고 REST API key에는 allowed IP 설정을 제공한다. 단, Supabase Edge의 고정 egress IP를 공식적으로 확보하지 못했다면 추정 IP를 allowlist에 등록해 배포를 막지 않으며, 가능한 네트워크 제한 방식은 배포 환경의 공식 근거를 확인한 뒤 적용한다.

장기적으로 장소 검색·역지오코딩도 Route Proxy와 같은 인증·rate-limit 경계로 옮기기로 결정하면 그때 `EXPO_PUBLIC_KAKAO_REST_API_KEY`를 제거할 수 있다. 이는 현재 API-S-5~7의 앱 내 검색 기능을 바꾸는 별도 작업이며, ODsay 대중교통 전환의 선행 조건으로 강제하지 않는다.

### 2026-08-28 — 사용자 결정: Kakao 단일 경로 제공사

사용자는 TMAP server key를 추가 등록하지 않고, Kakao server-only REST key만 Supabase Edge secret에 등록했다. 이에 따라 대중교통뿐 아니라 도보도 Kakao 단일 provider로 전환한다. 이 결정은 앱 내 장소 검색의 public Kakao client key를 없애는 결정이 아니며, TMAP 위치 검색은 기존에도 사용하지 않았다.

### API-4-A-ACT-02-K — 외부 API 어댑터 세션 지시: Kakao-only Route Proxy 전환

**담당·소유 경계:** 외부 API 어댑터 세션은 Route Proxy handler·provider selection·client adapter·adapter 계약/행동 fixture·이 작업기록만 수정한다. 추천 후보/점수, UI, 카탈로그, DB migration/RLS, `docs/03_product/추천로직.md`, `docs/테스트.md`는 수정하지 않는다. 실제 Supabase migration 적용, Auth/CAPTCHA 설정 변경, key 값 출력, 실 provider 호출, Edge 배포, ODsay 코드 삭제는 이 작업에서 금지한다.

1. `walk`와 `transit` 모두 Kakao를 유일 provider로 선택하도록 production provider selection을 바꾼다. TMAP의 일일/초당 budget, key 읽기, provider 선택, timeout 뒤 fallback, response 변환 경로가 production Route Proxy 경로에서 남지 않게 한다. 단, 다른 역사적 adapter/fixture 파일을 일괄 삭제하지 않으며 사용하지 않는 코드 제거는 실제 runtime observer 전환 작업으로 분리한다.
2. Edge handler가 요구하는 provider secret은 `KAKAO_ROUTE_REST_API_KEY` 하나만으로 충분해야 한다. 누락 시 두 수단 모두 `unconfigured` 또는 기존 fail-closed 계약을 반환하고, mobile public key·직접 Kakao 호출·ODsay/근사 fallback으로 우회하지 않는다.
3. cache key와 budget은 `mode=walk|transit`을 계속 분리한다. 같은 공개 segment·같은 mode의 cache hit는 provider HTTP 0회, miss는 Kakao HTTP 최대 1회다. 도보와 대중교통 budget·soft limit은 서로 독립이며, 엔진에 provider 이름·잔여예산 정책을 넘기지 않는다.
4. 실제 공개 handler를 주입 fixture로 실행해 아래를 먼저 실패시키고 구현 뒤 통과시킨다.
   - `walk` 성공은 Kakao 1회·TMAP 0회이며 mode=walk cache/budget으로 귀결한다.
   - `transit` 성공은 Kakao 1회·TMAP/ODsay 0회다.
   - Kakao walk/transit timeout·HTTP 오류·한도 초과는 각각 provider HTTP 최대 1회 뒤 fail-closed이며 fallback 0회, lease release 정확히 1회다.
   - Kakao secret 누락과 anonymous/Auth·abuse gate 미승인은 provider·budget·lease 호출 0회다.
   - 동일 public segment·mode cache hit, private request lease 비사용, deadline 누락의 기존 행위 회귀를 유지한다.
5. 기존 provider-neutral client response 형식과 엔진 route contract는 보존한다. UI가 Kakao/키/예산을 알거나, UI 테스트가 실제 API를 호출하도록 만들지 않는다.
6. 최소 관련 route proxy·legacy observer·client adapter tests, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 완료 기록에는 변경 파일, 유지한 공개 계약, 위 fixture별 provider/budget/lease 호출 횟수, 실제 배포 전에 남은 migration/Auth/CAPTCHA·rate·Edge deploy·비식별 smoke 조건을 기록한다.

**완료 뒤의 판정:** 이 작업은 Kakao-only 코드/fixture 수락까지만 목표로 한다. 대상 migration 세 개 적용과 Auth/CAPTCHA/abuse 승인, Edge secret 적용 확인, 비식별 smoke가 아직 없으면 앱 기본 adapter와 ODsay legacy는 유지한다. 모두 충족하고 사용자가 배포를 다시 승인한 다음 단계에서만 실제 runtime 전환·ODsay 제거를 수행한다.

### Kakao-only 코드/fixture 수락 뒤의 단일 배포 실행 범위

외부 API 어댑터는 DB·개인화 담당이 소유한 기존 migration을 새로 고치지 않는다. 담당자는 아래 완료 조건을 한 번에 만족할 수 있는지 먼저 확인하고, 하나라도 안 되면 외부 provider를 호출하지 않고 즉시 중단·기록한다.

1. 대상 Supabase에 `202608270010_route_proxy_store.sql`, `202608270011_route_proxy_fetch_lease.sql`, `202608270012_anonymous_auth_cleanup_contract.sql`가 적용돼 있는지 migration ID만 확인한다.
2. user가 승인한 anonymous Auth, CAPTCHA/abuse guard, 요청 제한, cleanup scheduler의 운영 값을 확인한다. 값이 없거나 Auth가 fail-closed이면 proxy default를 바꾸지 않는다.
3. Edge에 `KAKAO_ROUTE_REST_API_KEY`, service-role key, catalog snapshot/version, 도보·대중교통별 Kakao budget, lease/deadline, abuse 관련 secret/config가 **서버 전용**으로 설정됐는지 이름·설정 성공 여부만 확인한다. public `EXPO_PUBLIC_*` 값과 동일한 route key이면 실패로 처리한다.
4. Route Proxy를 배포하고, 고정 공개 catalog segment 하나를 통해 대중교통 1회, 필요한 경우 도보 1회만 요청하는 비식별 smoke를 수행한다. raw 좌표·key·사용자 ID·응답 원문은 남기지 않고 `provider/mode/status/cache hit·miss/budget delta` 집계만 기록한다.
5. smoke가 성공해도 즉시 ODsay 코드를 삭제하지 않는다. 먼저 앱의 `courseV1RouteAdapter` 기본 fetcher를 proxy client로 전환해 고정 fixture에서 transit=Kakao, walk=Kakao 결과만 소비하는지 검증한다. app runtime에서 ODsay HTTP attempt가 0임을 observer로 확인한 뒤에만 legacy ODsay 직접 호출 경로를 제거한다.
6. 한 단계라도 실패하면 proxy 기본 전환·ODsay 제거·2-J 시작을 하지 않고 legacy를 유지한다. provider 직접 호출, 근사 시간 성공 처리, 공개 key 재사용, 복수 provider 동시 호출은 fallback이 아니다.

### 완료 기준

- 실제 route provider secret은 모바일 공개 변수와 분리돼 있고, DB migration·Auth/abuse·Edge 설정이 승인된 대상 환경에 적용됐다.
- 비식별 smoke가 대중교통 Kakao와 도보 정책을 각각 한 번 이내로 검증하며, 실패 시 legacy가 유지된다.
- 앱 기본 경로가 proxy client를 사용하고 runtime observer에서 ODsay attempt가 0이며, fixture에서 대중교통·도보 모두 Kakao 단일 provider, cache-first, provider fallback 0회 계약이 유지된다.
- 최소 `npm run test:typecheck`, 관련 route proxy·legacy/adapter fixture, `npm test`, `git diff --check` 결과와 변경 파일·미변경 정책을 기록한다.
- 이 완료 뒤에만 추천 엔진 `2-J`가 cache hit/miss·예산을 소비할 수 있다. `2-K` 순수 엔진 보정은 이와 병렬로 진행할 수 있다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-02-K Kakao-only Route Proxy 전환

### 변경과 판정

- **이전 방식 → 문제:** production Route Proxy는 transit에 Kakao, walk에 Kakao·TMAP 선택과 timeout/오류 fallback을 함께 두고 TMAP key·일일/초당 budget·응답 변환 경로를 유지했다. TMAP server secret을 등록하지 않는 사용자 결정과 맞지 않고, 한 요청이 복수 제공사 호출로 이어질 수 있었다.
- **교체 방식:** `supabase/functions/route-proxy/handler.ts`의 provider를 `kakao` 하나로 축소했다. walk와 transit 모두 `KAKAO_ROUTE_REST_API_KEY`만 읽어 Kakao의 `walk`/`publictraffic` endpoint를 한 번만 호출하며, TMAP key·budget·선택·응답 변환·fallback 경로를 production handler에서 제거했다.
- **교체 이유·상태:** server-only Kakao secret 하나로 호출량·공용 cache·budget·lease를 통제하고 누락/실패 시 우회 없이 fail-closed하기 위해서다. **Kakao-only 코드·고정 fixture 수락 완료**이며, 실제 활성화는 아래 게이트가 남아 있어 아직 수행하지 않았다.

### 유지한 공개 계약과 fixture 결과

`{ provider, mode, status, totalMin?, steps? }` provider-neutral client 응답과 엔진 route contract는 유지했다. UI·모바일 코드에는 provider key·budget을 전달하지 않았고, legacy adapter/ODsay fixture는 삭제하지 않았다.

| ID | 고정 fixture 결과 | provider / budget / lease |
| --- | --- | --- |
| API4ACT02K-01/02 | source 계약: Edge는 server-only Kakao key만 읽고 walk·transit 모두 Kakao endpoint·cache/budget/lease 경계를 사용 | TMAP·ODsay·fallback source 0개 |
| API4ACT02K-03 | walk Kakao timeout은 abort 뒤 `deadline_exceeded` | Kakao HTTP 1, fallback 0, release 1 |
| API4ACT02K-04 | walk·transit 성공 | 각 mode Kakao HTTP 1, 해당 mode cache/budget, complete 1 / release 0 |
| API4ACT02K-05 | walk·transit HTTP 오류와 budget limited | HTTP 오류: Kakao 1, fallback 0, release 1; limited: Kakao 0, release 1 |
| API4ACT02K-06 | secret 누락, Auth 거절, anonymous 미승인, abuse 미승인 | provider HTTP·budget·lease 0, `unconfigured` 또는 기존 fail-closed |
| API4ACT02K-07 | 같은 public segment·같은 mode cache hit | provider HTTP·budget·lease 0 |
| API4AR2RB-01/02/04/05/06 | 기존 transit timeout/new claim, private lease 비사용, deadline 누락 회귀 | 유지; provider fallback 0, private lease 0 |

### 변경 파일·검증

- 변경: `supabase/functions/route-proxy/handler.ts`, `test/route-proxy-timeout-behavior.test.ts`, `test/route-proxy-edge-contract.test.mjs`, `test/route-proxy-r2-edge-contract.test.mjs`, 이 작업기록.
- 관련 route proxy·legacy observer·client adapter·migration contract fixture — 39/39 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 93/93 통과.
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip.
- `git diff --check` — 통과.
- 실제 Kakao/TMAP/ODsay 호출, Supabase migration·Auth/CAPTCHA·secret 변경, Edge 배포, runtime adapter 기본 전환은 모두 **0회**다.

### 다음 세션의 게이트와 미변경 경계

DB migration 세 개의 대상 환경 적용, anonymous Auth/CAPTCHA/abuse 및 rate 운영 승인, Edge secret·catalog snapshot·mode별 budget/lease/deadline 설정 확인, 사용자 배포 승인과 비식별 단일 smoke가 남아 있다. 이들이 완료되기 전에는 `courseV1RouteAdapter` 기본 전환, 실제 runtime observer에 의한 ODsay attempt 0 확인, legacy ODsay 제거, 추천 엔진 `2-J` 활성화를 진행하지 않는다. DB migration/RLS·Auth 정책·추천 정책·UI·카탈로그는 변경하지 않았다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-02-K 조건부 미수락

Kakao-only handler는 Kakao secret만 읽고 walk/transit endpoint를 각각 한 번만 호출하며, timeout·HTTP 오류·secret/Auth/abuse 실패에서 TMAP·ODsay·근사 fallback 없이 fail-closed한다. 실제 handler fixture와 전체 회귀도 통과했다. 이 부분은 수락한다.

그러나 handler는 `ROUTE_PROXY_KAKAO_DAILY_LIMIT`과 `ROUTE_PROXY_KAKAO_PER_SECOND_LIMIT` 하나를 두 mode에 공통으로 넘기고, DB-RP-1의 provider-only budget RPC를 호출한다. 따라서 `walk` 사용량이 `transit` quota를 소진시키며, `route_proxy_read_budget()` 호출값도 사용하지 않아 configurable soft limit이 실제 시행되지 않는다. 이는 현행 제품 정책의 "도보·대중교통 수단별 독립 soft/hard 예산" 및 이 작업 지시 3항과 충돌한다.

**판정:** Kakao-only provider 축소는 수락하지만, API-4-A-ACT-02-K 전체는 **조건부 미수락**이다. DB-RP-3와 아래 API 보완이 통과하기 전에는 실제 배포·기본 adapter 전환·ODsay 제거·2-J를 진행하지 않는다.

### API-4-A-ACT-02-K-R — 외부 API 어댑터 세션 지시: mode별 Kakao budget 소비 보완

**선행 조건:** DB-RP-3가 mode 포함 atomic RPC와 fixture를 완료·인계한 뒤 시작한다.

**소유 경계:** `supabase/functions/route-proxy/`, route proxy client/adapter가 실제 RPC 타입을 가져야 한다면 그 경계, adapter 행동 fixture, 이 작업기록만 수정한다. DB migration/RLS, 추천 정책·엔진, UI, 카탈로그, 실제 secret/배포/provider 호출은 수정·실행하지 않는다.

1. handler의 Kakao budget 설정을 `walk`와 `transit`으로 분리한다. 이름은 수단이 드러나는 server config (`ROUTE_PROXY_KAKAO_WALK_*`, `ROUTE_PROXY_KAKAO_TRANSIT_*`)만 사용하며, 각 mode에 daily hard, daily soft, per-second limit이 있어야 한다. soft가 누락·0·hard 초과이면 안전한 default(명시된 hard의 90%) 또는 fail-closed 중 하나를 결정적으로 적용하고 fixture로 검증한다. mobile `EXPO_PUBLIC_*`는 읽지 않는다.
2. 새 DB RPC에 `p_mode=input.mode`과 mode별 soft/hard/rate를 넘긴다. provider-only `read_budget` 호출과 반환값을 사용하지 않는 관찰성 호출은 제거한다. cache hit·private request·Auth/abuse/secret/deadline fail-closed 경계는 budget RPC를 호출하지 않는 기존 계약을 유지한다.
3. 실제 공개 handler 주입 fixture로 먼저 실패시키고 보완 뒤 통과시킨다.
   - walk가 soft limit에 도달하면 추가 walk는 Kakao HTTP 0회·`limited`이고, 같은 날짜 transit은 자체 soft 한도까지 reserve/call 가능하다. 반대 방향도 검증한다.
   - hard limit과 per-second limit의 reason은 DB typed 결과를 안전한 route status로 바꾸며, fallback/provider 재시도/lease 누수는 0회다.
   - mode별 cache hit는 각자 provider·budget·lease 0회이며 다른 mode cache와 섞이지 않는다.
   - Kakao-only timeout·HTTP 오류·secret/Auth/abuse/deadline·public/private lease 행동 fixture가 계속 통과한다.
4. 엔진·UI에 remaining budget/provider 이름을 전달하지 않는다. 실제 Kakao·Supabase 호출, migration 적용, Edge deploy, ODsay legacy 제거는 0회로 유지한다.
5. 관련 DB contract를 포함한 route proxy fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행하고, mode별 budget reason·provider HTTP·lease 횟수를 기록한다.

**완료 기준:** 같은 Kakao provider라도 walk/transit의 soft/hard/rate 예산이 DB부터 handler까지 분리되고, 어떤 mode의 한도·실패도 다른 mode의 quota 또는 fallback을 건드리지 않는 것이 실제 handler fixture에서 관찰되어야 한다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-02-K-R mode별 Kakao budget 소비 보완

### 변경과 현행 계약

- **이전 방식 → 문제:** Kakao-only handler가 provider-only `route_proxy_read_budget`을 관찰용으로만 호출하고, `ROUTE_PROXY_KAKAO_DAILY_LIMIT`/`PER_SECOND_LIMIT` 한 쌍을 walk·transit에 공통 전달했다. 한 mode의 소비가 다른 mode quota에 영향을 주고 soft limit은 시행되지 않았다.
- **교체 방식:** handler가 `ROUTE_PROXY_KAKAO_WALK_*`와 `ROUTE_PROXY_KAKAO_TRANSIT_*`에서 각 mode의 daily hard·daily soft·per-second limit을 만들고, mode 포함 `route_proxy_reserve_budget`에 `p_mode`, `p_soft_limit`, `p_hard_limit`, `p_per_second_limit`을 함께 전달한다. 구형 provider-only `read_budget` 호출은 제거했다.
- **안전 규칙·상태:** soft 값이 누락·0·hard 초과면 해당 hard의 내림 90%(최소 1)를 결정적으로 적용한다. DB typed `soft_limit`/`daily_limit`/`rate_limit`만 공개 route status `limited`로 변환하며, 그 외 응답은 store fail-closed로 처리한다. **현행 구현·fixture 수락 완료**다.

### fixture 관찰 결과

| ID | 입력/결과 | provider HTTP / budget / lease |
| --- | --- | --- |
| API4ACT02KR-01 | walk `soft_limit` 뒤 transit 허용 | walk HTTP 0, transit HTTP 1; reserve는 각각 `walk: 9/10/3`, `transit: 18/20/4`(soft/hard/rate); walk release 1, transit complete 1 |
| API4ACT02KR-02 | walk `daily_limit`, transit `rate_limit` | 각 HTTP 0, 재시도/fallback 0, 각 lease release 1·complete 0 |
| API4ACT02KR-03 | source 계약 | `EXPO_PUBLIC_*`·provider-only `read_budget` 0, mode-aware reserve와 Kakao server secret만 존재 |
| 기존 API4ACT02K·API4AR2RB | cache hit, private, timeout/HTTP, secret/Auth/abuse/deadline 경계 | 기존 결과 유지; cache/private/fail-closed에서 budget RPC 0 |

### 변경 파일·검증·인계

- 변경: `supabase/functions/route-proxy/handler.ts`, `test/route-proxy-timeout-behavior.test.ts`, `test/route-proxy-edge-contract.test.mjs`, 이 작업기록.
- 관련 route proxy·legacy/client adapter·DB-RP-1/2/3 migration contract — 45/45 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 97/97 통과.
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip.
- `git diff --check` — 통과.
- 실제 Kakao/Supabase 호출, migration 적용, secret/Auth/CAPTCHA 변경, Edge 배포, UI·엔진 변경, ODsay legacy 삭제는 모두 **0회**다.

다음 단계에도 대상 migration 적용, anonymous Auth/CAPTCHA/abuse·rate 운영 승인, Edge server config와 catalog snapshot 확인, 사용자 배포 승인 및 비식별 smoke가 필요하다. 이 게이트 전에는 runtime adapter 기본 전환·ODsay 제거·2-J 활성화를 진행하지 않는다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-02-K-R 수락

DB-RP-3의 mode 포함 RPC와 handler를 함께 확인했다. public walk가 `soft_limit`일 때 Kakao HTTP 호출 없이 `limited`로 끝나고, 같은 fixture의 transit은 독립 budget으로 한 번 호출·완료한다. 반대로 typed `daily_limit`·`rate_limit`도 다른 mode나 fallback을 건드리지 않고 lease를 한 번만 해제한다. handler는 server-only Kakao secret과 mode-aware `reserve_budget`만 사용하며, cache hit·private·Auth/abuse/secret/deadline fail-closed 경계의 budget 호출 0회 계약도 유지한다.

통합 재검증으로 route proxy/DB contract·handler behavior 18/18, `npm run test:typecheck`, `git diff --check`를 통과했다. 따라서 **API-4-A-ACT-02-K-R은 수락**한다.

이는 배포 수락이 아니다. 원격 migration 적용, anonymous Auth/CAPTCHA·abuse/rate 운영 설정, Edge server config·catalog snapshot 확인, Edge 배포, 승인된 비식별 단일 smoke가 남아 있다. 이 게이트가 완료되기 전에는 runtime 기본 adapter 전환, ODsay 제거, 추천 엔진 2-J를 시작하지 않는다.

---

## 2026-08-28 — 통합·결정 지시 API-4-A-ACT-03: Route Proxy 활성화 전 호출량·snapshot 안전 보완

### 이 작업이 필요한 이유

`API-4-A-ACT-02-K-R`은 **수단별** Kakao budget을 올바르게 분리했다. 하지만 현재 handler는 public segment만 reserve하고 `private_request`는 cache·lease뿐 아니라 provider budget도 건너뛴다. 익명 사용자가 임의 좌표로 반복 호출하면 Kakao 호출량을 전역 hard limit으로 막을 수 없다. 또한 Edge의 token hash rate limiter는 instance memory이므로 여러 Edge instance 전체를 보장하는 quota 경계가 아니다. 이 상태에서 `ROUTE_PROXY_ABUSE_GUARD_APPROVED=true`로 배포하면 안 된다.

Kakao 공식 quota는 도보와 대중교통 경로를 각각 일 1,000건으로 안내한다. 다만 앱별 첫 활성화·유료 전환·현재 콘솔 quota는 별도 확인 대상이므로, 이 작업은 수치를 실제 환경에 설정하거나 provider를 호출하지 않는다. [Kakao Map quota](https://developers.kakao.com/docs/ko/getting-started/quota)

### 담당·소유 경계

외부 API 어댑터 세션은 `supabase/functions/route-proxy/`, `src/services/routeProxy*`, Route Proxy fixture, route-proxy snapshot 생성 helper, 이 작업기록만 수정한다. 카탈로그 원본·분류·추천 정책·UI·DB migration/RLS·`docs/작업조정_보드.md`는 수정하지 않는다. 실제 Kakao/Supabase 호출, secret 출력·설정, Auth/CAPTCHA 변경, migration 적용, Edge 배포, 앱 기본 adapter 전환, ODsay 제거는 모두 금지한다.

### 수행 순서

1. **private request의 전역 quota 경계 보완**
   - `walk`과 `transit` 모두 public/private 구분 없이 provider HTTP 직전에 같은 `provider + mode + date + second` reserve RPC를 정확히 한 번 호출한다. public cache hit과 public `in_flight` 비소유자는 계속 reserve 0회다.
   - private request는 여전히 cache read/write·fetch lease 0회이며, origin/destination 좌표·user ID·JWT 원문·검색어를 DB/RPC/로그/진단에 저장하지 않는다. reserve 입력에는 기존의 provider/mode/time limit만 들어가야 한다.
   - `soft_limit`/`daily_limit`/`rate_limit`이면 public/private 모두 Kakao HTTP 0회·fallback 0회·`limited`다. public lease owner만 release 1회, private lease는 0회여야 한다.
   - instance-local token burst limiter는 보조 방어임을 주석과 작업 기록에 명시한다. 전역 비용 상한의 근거는 DB atomic provider/mode budget이며, limiter를 전역 abuse 방어라고 표현하지 않는다.
2. **배포 가능한 public snapshot 산출 계약**
   - 대표 후보(`representative_core`, `representative_standard`)만 사용해 `{ version, points }` 형태의 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON`을 **결정적으로** 생성하는 helper와 검증을 추가한다. 정렬·version 산출은 place ID와 좌표의 결정적 hash에 기반해야 하며, conditional/hold·운영시간/근거 정책을 새로 해석하지 않는다.
   - 생성 결과의 point 수는 현재 representative 후보 수와 같아야 하고, 모든 ID/좌표는 유효해야 한다. 같은 입력은 같은 JSON/version, ID 또는 좌표 변경은 다른 version을 만들어야 한다. 생성 artifact에는 API key·JWT·사용자 위치가 절대 포함되지 않는다.
   - 이후 runtime adapter가 public scope에 쓰게 될 version을 코드에서 참조할 수 있도록 export하되, 이번 작업에서 기본 adapter·엔진·UI를 전환하지 않는다. snapshot을 Edge secret에 올리는 것은 다음 배포 작업의 책임이다.
3. **fixture를 먼저 추가하고 구현한다.** 최소 아래를 공개 handler factory로 관찰한다.
   - private walk/transit success: 각 reserve 1·Kakao HTTP 1·cache/lease 0.
   - private `soft_limit`/`daily_limit`/`rate_limit`: Kakao HTTP 0·cache/lease 0·fallback 0.
   - public cache hit/in-flight: reserve 0이며 기존 cache/lease 계약 유지.
   - public 제한: reserve 1 뒤 HTTP 0·release 1; 다른 mode quota는 독립.
   - snapshot: 190개 현행 representative 기준의 결정성·분류 제외·version drift 검증. 숫자를 fixture에 하드코딩하기보다 현재 provider summary와 대조한다.
4. 관련 route proxy handler/client/snapshot fixture, `npm run test:typecheck`, `npm test`, `npm run test:ui`, `git diff --check`를 실행한다. 실 provider·remote DB·Edge·secret은 0회여야 한다.

### 완료 기준과 다음 인계

private/public 어느 경로도 Kakao provider HTTP 전에 같은 전역 provider-mode hard/soft/rate budget을 우회하지 않고, private 좌표가 저장되지 않으며, 배포할 snapshot의 version·point 집합을 재현할 수 있어야 한다. 완료 기록에는 변경 파일, public/private별 provider/budget/cache/lease 횟수, snapshot point 수·version 산출 방식, 실행 결과와 미변경 경계를 남긴다.

이 작업이 수락되어도 배포는 자동 진행하지 않는다. 다음은 `DB-RP-4`의 대상 migration 적용 확인과, CAPTCHA 선택·Edge 설정·배포/단일 smoke를 다루는 별도 활성화 작업이다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-03 Route Proxy 활성화 전 호출량·snapshot 안전 보완

### 변경과 현행 계약

- **이전 방식 → 문제:** private request는 cache/lease를 쓰지 않는다는 이유로 mode-aware reserve도 건너뛰어, 임의 좌표 호출이 Kakao 전역 quota를 우회할 수 있었다. public snapshot은 배포할 point 집합/version을 재현하는 코드 계약이 없었다.
- **교체 방식:** public miss와 private request 모두 Kakao HTTP 직전에 한 번만 같은 provider+mode atomic reserve를 수행하도록 handler를 변경했다. public cache hit과 public in-flight 비소유자는 계속 reserve 0회이며, private는 cache read/write·lease·좌표 DB/RPC 저장 없이 reserve의 provider/mode/time limit만 사용한다.
- **snapshot 방식:** `src/services/routeProxyCatalogSnapshot.ts`가 runtime catalog의 이미 분류된 `representative_core`/`representative_standard`만 ID 순으로 정렬해 `{ version, points }` JSON을 만든다. canonical points JSON의 결정적 FNV-1a hash가 version이며, `ROUTE_PROXY_CATALOG_SNAPSHOT_VERSION`으로 후속 runtime adapter가 참조할 값을 export한다. helper는 운영시간·근거 정책을 다시 해석하지 않고, 배포 secret 설정도 수행하지 않는다.

### fixture 관찰 결과

| ID | 입력/결과 | provider / budget / cache / lease |
| --- | --- | --- |
| API4ACT03-01 | private walk·transit 성공 | 각 reserve 1, Kakao HTTP 1, cache 0, lease 0 |
| API4ACT03-02 | private soft/daily/rate limit | Kakao HTTP 0, fallback 0, cache 0, lease 0, `limited` |
| API4ACT03-03 | public cache hit·in-flight 비소유 | reserve 0, 기존 cache/lease 계약 유지 |
| API4ACT03-04 | 현행 representative snapshot | 현재 provider summary와 같은 190 points, ID 정렬·동일 입력 JSON/version 동일 |
| API4ACT03-05 | ID/좌표 drift 및 민감값 경계 | ID 또는 좌표 변경 시 version 변경, conditional 제외, key/token/JWT/user/origin/destination 필드 0 |
| API4ACT03-06 | rate limiter 역할 | instance-local burst 보조 방어로만 명시; 전역 비용 상한은 DB atomic provider+mode budget |

### 변경 파일·검증·다음 게이트

- 변경: `supabase/functions/route-proxy/{handler,index}.ts`, `src/services/routeProxyCatalogSnapshot.ts`, `test/route-proxy-timeout-behavior.test.ts`, `test/route-proxy-catalog-snapshot.test.ts`, `test/route-proxy-r2-edge-contract.test.mjs`, 이 작업기록.
- 관련 route proxy·snapshot·legacy/client adapter·DB-RP-1/2/3 contract — 51/51 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 98/98 통과.
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip.
- `git diff --check` — 통과.
- 실제 Kakao/Supabase 호출, migration 적용, secret/Auth/CAPTCHA 변경, Edge 배포, 기본 adapter 전환, ODsay 제거는 모두 **0회**다.

이 수락은 배포 수락이 아니다. 다음은 DB-RP-4 대상 migration 안전 적용 확인과 CAPTCHA 선택, Edge server config/snapshot 주입, 사용자 배포 승인 및 비식별 단일 smoke를 별도 작업으로 진행해야 한다. 그 전에는 runtime adapter 기본 전환·ODsay 제거·2-J 활성화를 시작하지 않는다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-03 수락

handler를 확인해 private/public 모두 Kakao HTTP 직전에 mode-aware reserve를 한 번만 수행함을 확인했다. private는 cache·lease와 좌표 영속 경로를 계속 사용하지 않고, public cache hit·in-flight 비소유자는 reserve 0회다. `soft_limit`/`daily_limit`/`rate_limit`의 private fail-closed와 수단별 분리도 handler fixture에서 관찰됐다.

대표 후보만 ID 순으로 snapshot을 만들고 ID/좌표 hash로 version을 만드는 계약도 현재 provider의 representative 수와 대조해 검증한다. 통합 재실행 결과는 route proxy/DB/snapshot fixture **35/35 통과**, `npm run test:typecheck`, `git diff --check` 통과다. 따라서 **API-4-A-ACT-03을 수락**한다.

다음 `API-4-A-ACT-04`는 코드 보완이 아니라 운영 배포 결정이다. 현재 anonymous session 생성은 CAPTCHA token을 전달하지 않으므로, CAPTCHA를 실제로 켤지 또는 앱 클라이언트 CAPTCHA 연동을 먼저 구현할지에 대한 사용자 결정을 받은 뒤에만 Edge 설정·배포·단일 smoke 범위를 지시한다. 기본 adapter 전환·ODsay 제거·2-J는 계속 금지다.

---

## 2026-08-28 — 통합·결정 지시 API-4-A-ACT-04-A: 최소 Turnstile 익명 세션 계약

### 확정 범위

**비로그인 추천은 유지**한다. CAPTCHA는 저장 session이 없는 사용자가 첫 추천을 실행할 때 anonymous session을 만들기 직전 한 번의 Turnstile token을 얻는 용도만 가진다. 기존 session이면 CAPTCHA 0회이며, token 취소·오류·만료는 anonymous sign-in과 Route Proxy를 fail-closed한다.

Cloudflare는 native mobile에서 WebView challenge 페이지를 권장하고, Supabase JS는 `signInAnonymously({ options: { captchaToken } })`를 지원한다. [Cloudflare mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/), [Supabase anonymous sign-in](https://supabase.com/docs/reference/javascript/auth-signinanonymously)

### 소유 경계

외부 API 어댑터 세션은 `src/services/routeProxyAnonymousAuth.ts`, `supabase/functions/captcha-challenge/`(새 Edge Function), API fixture와 이 작업기록만 수정한다. UI·엔진·DB migration/RLS·카탈로그·`docs/작업조정_보드.md`는 수정하지 않는다. 실제 Cloudflare/Supabase 설정, secret 출력·설정, Auth 변경, Edge 배포, provider 호출, 기본 route adapter 전환은 0회다.

### 구현 지시

1. anonymous auth port에 `CaptchaTokenProvider.requestToken(): Promise<string | null>`을 명시한다. 기존 session은 token 없이 반환하되, 새 anonymous sign-in은 non-empty token 없이는 호출하지 않는다. token은 `supabase.auth.signInAnonymously({ options: { captchaToken } })`에만 한 번 전달하며 storage·로그·DB·Route Proxy payload에는 넣지 않는다.
2. token 취소·오류·공백·만료는 `route_proxy_unavailable`으로 끝나며 sign-in 재시도·직접 Kakao/ODsay fallback은 0회다.
3. `captcha-challenge` Edge Function은 GET만 허용하고 `Cache-Control: no-store`와 제한 CSP의 최소 HTML을 반환한다. `TURNSTILE_SITE_KEY`(공개 site key)로 Managed widget을 렌더링하고, WebView에는 token/error/cancelled typed event만 `postMessage`한다. user ID/GPS/검색어/route 좌표/JWT/provider key/Turnstile secret은 HTML·URL·로그에 0개다. token 검증은 다음 배포 단계의 Supabase Auth CAPTCHA 설정이 수행하므로 자체 Siteverify는 추가하지 않는다.
4. fixture: existing session은 CAPTCHA/sign-in 0회, valid token은 sign-in 1회와 `options.captchaToken` 전달, null/blank/error token은 sign-in/fallback 0회, challenge page는 GET 외 거절·no-store/CSP·secret/JWT/좌표 0·typed message만 허용을 검증한다.
5. 관련 fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 외부 호출·설정·배포는 0회다.

### 완료 기준

새 anonymous session은 CAPTCHA token 없이는 생성되지 않고 token은 Supabase Auth에만 한 번 전달되어야 한다. UIUX가 다음 `U-1-CAP-01`에서 이 port를 소비한 뒤에만 실제 Cloudflare/Supabase 설정·Edge 배포·비식별 smoke를 시작한다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-04-A 최소 Turnstile 익명 세션 계약

### 변경과 현행 계약

- **이전 방식 → 문제:** 새 anonymous session은 CAPTCHA token 없이 생성될 수 있었고, native WebView가 안전하게 로드할 server-owned challenge page 계약이 없었다. CAPTCHA를 켜면 비로그인 추천이 조용히 실패하거나 직접 provider 경로로 우회할 위험이 있었다.
- **교체 방식:** `CaptchaTokenProvider.requestToken()` port를 추가하고, 기존 session은 token 요청 없이 그대로 재사용한다. 새 anonymous sign-in은 non-empty token이 있을 때만 `signInAnonymously(captchaToken)`으로 한 번 실행하며, Supabase JS 구현 경계에서 `options.captchaToken`으로 전달하도록 명시했다.
- **challenge 방식:** 새 `captcha-challenge` Edge Function은 GET만 허용하고 `TURNSTILE_SITE_KEY`로 Managed widget을 렌더링한다. `no-store`와 제한 CSP를 설정하고 WebView에는 `token`/`error`/`cancelled` typed message만 전달한다. Siteverify는 중복 구현하지 않으며, 실제 검증은 다음 단계의 Supabase Auth CAPTCHA 설정이 담당한다.

### fixture 결과와 유지 경계

| ID | 고정 fixture 결과 | 호출/민감정보 경계 |
| --- | --- | --- |
| API4ACT04A-01 | 기존 session은 CAPTCHA·sign-in 0회, 새 유효 token은 sign-in 1회 | token은 Auth port에만 한 번 전달 |
| API4ACT04A-02 | null·공백·예외 token은 `route_proxy_unavailable` | sign-in·provider fallback 0회 |
| API4ACT04A-03 | GET page는 `no-store`·CSP 및 세 typed event 제공 | HTML/URL/log에 JWT·user ID·좌표·provider key·Turnstile secret 0개 |
| API4ACT04A-04 | POST와 site key 누락은 fail-closed | 외부 Cloudflare/Supabase 요청 0회 |

- 변경: `src/services/routeProxyAnonymousAuth.ts`, `supabase/functions/captcha-challenge/{handler,index}.ts`, `test/route-proxy-client-adapter.test.ts`, `test/captcha-challenge-handler.test.ts`, 이 작업기록.
- 관련 CAPTCHA·Route Proxy·client/legacy adapter·DB contract fixture — 55/55 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 98/98 통과.
- `npm run test:ui` — 103 통과 / 기존 철회 이력 1 skip.
- `git diff --check` — 통과.

실제 Cloudflare widget/Supabase CAPTCHA 설정, site key·secret 설정/출력, Auth 변경, Edge 배포, provider 호출, 기본 adapter 전환과 ODsay 제거는 모두 **0회**다. 다음은 UIUX 소유 `U-1-CAP-01`이 이 token port를 소비하는 최소 sheet 계약이며, 그 수락과 사용자의 별도 배포 승인 뒤에만 `API-4-A-ACT-04-B`에서 CAPTCHA 설정·Edge 배포·비식별 smoke를 진행할 수 있다.

---

## 2026-08-28 — 통합·결정 검토 및 지시 API-4-A-ACT-04-A-R: Turnstile WebView 보조 연결 허용

### 검토 결론

`API-4-A-ACT-04-A`의 익명 Auth token port와 fail-closed 경계는 수락한다. 다만 `captcha-challenge`의 현 CSP는 `default-src 'none'` 아래 `connect-src`가 없고, Turnstile 보조 문서가 쓰는 `about:blank`/`about:srcdoc`도 명시하지 않는다. UI의 동일 URL-only navigation과 합치면 고정 fixture는 통과해도 실제 Managed widget이 Cloudflare 연결을 하지 못할 수 있다.

Cloudflare의 native WebView 요구사항은 `challenges.cloudflare.com` 연결과 `about:blank`·`about:srcdoc` 허용을 포함한다. 이 수정은 token 검증이나 외부 호출을 추가하는 것이 아니라, **server-owned 최상위 challenge와 제한된 Turnstile 보조 자원**을 구분하는 최소 호환성 보완이다. [Cloudflare Mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/)

### 소유 범위

외부 API 어댑터 세션은 `supabase/functions/captcha-challenge/`, 그 fixture, 이 작업기록만 수정한다. `src/ui/`, Auth/session·route adapter, DB migration/RLS, 카탈로그, 배포 설정·secret·Cloudflare/Supabase Dashboard, `docs/작업조정_보드.md`는 수정하지 않는다. UI navigation 보완은 병렬 작업 `U-1-CAP-01-R`의 소유다.

### 정확한 구현 계약

#### 1. handler가 바꿀 수 있는 것

`supabase/functions/captcha-challenge/handler.ts`의 **성공 GET 응답 CSP만** 아래 의미와 정확히 같게 보완한다. directive 순서는 자유지만, 기존의 더 넓은 fallback을 남기거나 추가하면 안 된다.

| directive | 허용 값 | 이유 |
| --- | --- | --- |
| `default-src` | `'none'` | 선언하지 않은 모든 자원 fail-closed |
| `script-src` | `'unsafe-inline'` + `https://challenges.cloudflare.com` | server-owned inline bootstrap과 Turnstile API script만 허용 |
| `connect-src` | `https://challenges.cloudflare.com` | widget 검증 중 Cloudflare 연결만 허용 |
| `frame-src` | `https://challenges.cloudflare.com` + `about:` | Turnstile frame과 `about:blank`/`about:srcdoc` 보조 문서만 허용 |
| `style-src` | `'unsafe-inline'` | 현재 server-owned 최소 sheet의 inline style만 허용 |
| `base-uri` | `'none'` | `<base>` 주입 차단 |
| `form-action` | `'none'` | form 전송 차단 |

`img-src`, `worker-src`, `media-src`, `font-src`, `object-src`는 새로 열지 않는다. 실제 widget 검증 전에 추측으로 source를 넓히지 않는다. Cloudflare 공식 예시도 script/connect/frame을 필요한 CSP 경계로 제시한다. 첫 실제 iOS smoke에서 이 목록 때문에 차단이 재현될 때만, **차단된 directive와 origin을 token·URL query·개인정보 없이 기록한 뒤** 통합·결정에 재판단을 요청한다.

#### 2. 반드시 유지할 동작·보안 경계

1. `GET`만 HTML을 반환하고, 다른 method는 JSON `405`로 끝낸다. site key가 비어 있으면 HTML을 만들지 않고 `503`·`Cache-Control: no-store`로 끝낸다.
2. HTML에는 `TURNSTILE_SITE_KEY`라는 **public site key 값만** 안전한 문자열 리터럴로 주입한다. `KAKAO_ROUTE_REST_API_KEY`, Turnstile secret, Supabase service/anon key, JWT, user ID, IP, GPS, 출발·도착 좌표, 검색어, route/cache/budget payload는 HTML·URL·header 진단·console log에 0개다.
3. `window.ReactNativeWebView.postMessage`로 보낼 수 있는 payload는 지금과 같은 `token`(non-empty string), `error`, `cancelled` 세 종류뿐이다. 자체 `siteverify`, token 서버 저장, token 재발급, token 재사용, anonymous sign-in 호출은 이 handler에 추가하지 않는다. 실제 token 검증은 다음 단계에서 Supabase Auth CAPTCHA 설정이 수행한다.
4. `Cache-Control: no-store`와 `Content-Type: text/html; charset=utf-8`를 성공 응답에 유지한다. CORS 완화, wildcard CSP, 다른 CDN·analytics·redirect endpoint·popup script를 추가하지 않는다.

#### 3. fixture를 먼저 보강한 뒤 구현

`test/captcha-challenge-handler.test.ts`에 다음을 관찰 가능한 assertion으로 추가·정리한다. 정규식으로 단순 문자열 존재만 보지 말고, CSP를 directive 단위로 비교하거나 동등한 파서 helper를 테스트 안에 둬 허용 목록의 누락·확장을 모두 잡는다.

| ID | 고정 입력 | 기대 결과 |
| --- | --- | --- |
| API4ACT04AR-01 | site key가 있는 GET | 위 표의 모든 directive/값 존재, `connect-src`는 Cloudflare 하나, `frame-src`는 Cloudflare+`about:`뿐, `default-src/base-uri/form-action` 유지 |
| API4ACT04AR-02 | site key가 있는 GET HTML | Turnstile script와 typed `token/error/cancelled`만 존재; public site key 외 secret/JWT/user/좌표/provider/cache/budget 식별자 0개 |
| API4ACT04AR-03 | CSP/HTML 전체 | `*`, `http:`, `https:` scheme wildcard, `data:`, `blob:`, Kakao·TMAP·ODsay·Supabase Auth URL·analytics·다른 CDN origin 0개 |
| API4ACT04AR-04 | POST/PUT 및 site key 누락 GET | 각각 `405` 또는 `503`, HTML 없음, `no-store` 유지 |
| API4ACT04AR-05 | 기존 auth port fixture 재실행 | valid token만 sign-in 1회, null/blank/error는 sign-in·provider fallback 0회라는 ACT-04-A 경계 회귀 없음 |

fixture에는 실제 site key·secret·JWT·사용자 좌표를 넣지 않는다. `public-site-key` 같은 가짜값만 쓴다.

#### 4. 실행과 인계

1. 최소 `npx tsx --test test/captcha-challenge-handler.test.ts test/route-proxy-client-adapter.test.ts`, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다.
2. 변경 파일·변경 목적, 수정하지 않은 API 공개 계약, 테스트 명령/결과, 다음 수동 smoke에서 확인할 CSP 위험을 작업기록에 남긴다.
3. 실제 Cloudflare widget/Supabase Auth CAPTCHA 설정, secret 읽기·출력, Edge deploy, Auth 설정 변경, Kakao 호출, route adapter 기본 전환, ODsay 제거는 **0회**여야 한다. 하나라도 필요해 보이면 실행하지 말고 `API-4-A-ACT-04-B` 배포 단계로 인계한다.

### 완료·인계 기준

Managed Turnstile이 필요한 연결만 CSP 차원에서 가능하고, 보안 경계가 느슨해지지 않았음을 API4ACT04AR-01~05 fixture로 증명해야 한다. 이 작업은 UI의 navigation을 바꾸지 않으며, 이 작업만으로 CAPTCHA 활성화나 Route Proxy 전환을 허용하지 않는다. `U-1-CAP-01-R`도 수락된 뒤에만 `API-4-A-ACT-04-B`를 시작할 수 있다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-04-A-R Turnstile WebView 보조 연결 CSP 보완

### 변경과 보안 경계

- **이전 방식 → 문제:** challenge page CSP에는 `connect-src`가 없고 `frame-src`의 `about:` 보조 문서가 빠져 Managed Turnstile의 WebView 연결/보조 frame을 차단할 위험이 있었다. POST/PUT 오류 응답도 `no-store`를 명시하지 않았다.
- **교체 방식:** 성공 GET CSP를 정확히 `default-src 'none'`, Cloudflare 전용 `script-src`/`connect-src`, Cloudflare와 `about:`만의 `frame-src`, inline style, `base-uri 'none'`, `form-action 'none'`으로 제한했다. GET 외 JSON 405에도 `Cache-Control: no-store`를 추가했다.
- **유지:** wildcard/scheme wildcard, `data:`/`blob:`, 다른 CDN·analytics·Kakao/TMAP/ODsay/Supabase source, CORS 완화, Siteverify, token 저장/재발급, Auth·UI navigation 변경은 추가하지 않았다.

### fixture·검증 결과

| ID | 결과 |
| --- | --- |
| API4ACT04AR-01~03 | CSP directive 단위 비교: Cloudflare connect 1개, Cloudflare+`about:` frame만 허용; 확장 source 0개 |
| API4ACT04AR-04 | POST/PUT은 JSON 405, site key 누락 GET은 503; 모두 HTML 없음·`no-store` |
| API4ACT04AR-05 | 기존 Auth port 회귀: 유효 token만 sign-in 1회, null/공백/오류는 sign-in·provider fallback 0회 |

- 변경: `supabase/functions/captcha-challenge/handler.ts`, `test/captcha-challenge-handler.test.ts`, 이 작업기록.
- `npx tsx --test test/captcha-challenge-handler.test.ts test/route-proxy-client-adapter.test.ts` — 10/10 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- 실제 Cloudflare/Supabase/Auth 설정, secret 읽기·출력, Edge 배포, Kakao 호출, route adapter 기본 전환, ODsay 제거는 모두 **0회**다.

다음 실제 iOS smoke에서 Turnstile이 막히면, 막힌 CSP directive와 origin만 token·URL query·개인정보 없이 기록해 통합·결정에 재판단을 요청한다. `U-1-CAP-01-R` 수락과 별도 사용자 배포 승인 전에는 `API-4-A-ACT-04-B`의 설정·배포·smoke를 시작하지 않는다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-04-A-R 수락

`captcha-challenge` 성공 GET CSP가 지시한 정확한 allowlist(`challenges.cloudflare.com` connect, Cloudflare+`about:` frame)만 포함하고, `default-src 'none'`, no-store, typed message 및 민감정보 비노출 경계를 유지함을 확인했다. GET 외 405와 site key 누락 503도 HTML 없이 no-store로 끝난다.

통합 재실행에서 CAPTCHA handler·route proxy client fixture **10/10 통과**, `npm run test:typecheck`, `git diff --check`가 통과했다. 따라서 **API-4-A-ACT-04-A-R을 수락**한다. 이는 Cloudflare/Supabase 설정이나 배포 수락이 아니며, UI의 `U-1-CAP-01-R` 수락 전에는 `API-4-A-ACT-04-B`를 계속 시작하지 않는다.

---

## 2026-08-28 — 통합·결정 지시 API-4-A-ACT-04-B: Cloudflare Worker 기반 CAPTCHA·Kakao Proxy 제한 활성화

### 배포 구조와 이전안 교체

**현행 결정:** 비로그인 추천은 유지하되, 첫 추천 전에 Managed Turnstile을 거쳐 Supabase 익명 session을 만든다. 공개 앱의 기본 경로는 최종적으로 `앱 → Cloudflare CAPTCHA Worker → Supabase anonymous Auth → Supabase Route Proxy → Kakao`가 된다.

**이전안 → 문제:** `captcha-challenge` Supabase Edge Function이 HTML을 직접 반환하는 방식은 Supabase 기본 프로젝트 도메인에서 HTML 응답이 `text/plain`으로 처리될 수 있어 실제 WebView widget 배포 근거가 약하다.

**교체안:** site key를 Worker secret으로 주입하는 **Cloudflare Worker**가 server-owned CAPTCHA HTML을 반환한다. Workers `*.workers.dev` HTTPS URL을 Turnstile hostname과 앱의 exact challenge URL로 사용한다. Pages 정적 파일 build·custom domain·DNS를 추가하지 않는다. Worker는 CAPTCHA 페이지 하나만 제공하고 Kakao·Supabase·DB에는 직접 요청하지 않는다.

Cloudflare Workers Free의 100,000 requests/day는 CAPTCHA 페이지 요청에만 적용되며, Kakao route의 일일 1,000 한도와 별개다. 이 앱은 첫 session 생성에서만 CAPTCHA를 열므로 이 운영 한도로 충분하다. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

### 단계와 단일 작성자 경계

이 작업은 외부 API 어댑터가 아래 **A·C**만 소유한다. UI의 공개 URL 소비는 `U-1-CAP-02`가 소유하며, DB migration/RLS·추천 엔진·카탈로그·`docs/작업조정_보드.md`는 수정하지 않는다.

| 단계 | 담당 | 완료 전 금지 |
| --- | --- | --- |
| A. Worker artifact·계약 | 외부 API | Cloudflare/Supabase 설정·deploy·Kakao 호출·기본 adapter 전환 |
| B. 앱 URL 소비 | UIUX (`U-1-CAP-02`) | Worker/secret/Dashboard 수정·route adapter 전환 |
| C. 사용자 Dashboard 설정·제한 배포·smoke | 외부 API, 사용자 운영 권한 | ODsay 제거·2-J 활성화는 smoke 수락 전 금지 |

### A. Worker artifact 구현 지시

1. Cloudflare Worker source를 `cloudflare/captcha-worker/` 아래에 추가한다. repository 외부의 개인 script, 편집기 paste-only code, 새 Cloudflare API token은 만들지 않는다. 코드에는 `TURNSTILE_SITE_KEY`만 Worker 환경값으로 받고, site key가 없으면 HTML 없이 `503`·`Cache-Control: no-store`로 끝낸다.
2. 성공 `GET`의 HTML·CSP·typed message는 `captcha-challenge`와 같은 공개 계약을 사용한다.
   - GET만 `text/html; charset=utf-8`·`Cache-Control: no-store` HTML을 반환한다. 다른 method는 JSON `405`·no-store다.
   - CSP는 정확히 `default-src 'none'`, Cloudflare-only `script-src`/`connect-src`, Cloudflare+`about:` `frame-src`, inline `style-src`, `base-uri 'none'`, `form-action 'none'`이다. wildcard, `data:`, `blob:`, popup, analytics, Kakao/TMAP/ODsay/Supabase origin을 열지 않는다.
   - `postMessage` payload는 non-empty `token`, `error`, `cancelled`만 가능하다. Siteverify, token 저장·재사용·로그, Supabase/Kakao HTTP, route 좌표·JWT·user ID/IP/검색어 삽입은 0개다.
3. Worker URL은 코드·문서에 확정값으로 박지 않는다. 배포 뒤 Cloudflare가 부여한 HTTPS `https://<worker>.<subdomain>.workers.dev/`를 운영 설정값으로만 사용한다. local/preview URL을 production allow-list에 넣지 않는다.
4. Worker unit fixture를 새로 둔다. GET CSP allowlist, missing key 503, POST/PUT 405, typed message, 민감정보·외부 origin 부재를 검증한다. fixture에는 `public-site-key` 같은 가짜값만 쓴다.
5. `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 이 단계의 Cloudflare/Supabase deploy·secret·real API 호출은 0회다.

### B. UI 공개 URL 계약 (별도 U-1-CAP-02 선행)

1. 앱은 Supabase base URL에서 CAPTCHA URL을 조립하지 않는다. production build에만 `EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL`의 HTTPS exact URL을 주입한다. 이는 public URL이며 API key·Turnstile secret·JWT가 아니다.
2. 누락·HTTP·잘못된 path/origin은 sheet를 열지 않고 `안전 확인을 열지 못했어요`로 fail-closed한다. Worker URL의 최상위 exact match와 Cloudflare/about 보조 frame message 경계는 U-1-CAP-01-R 계약을 그대로 유지한다.
3. 개발/테스트 build에는 production Worker URL을 추측·대입하지 않는다. 설정이 없으면 실제 anonymous sign-in·Route Proxy 요청은 0회다.

### C. 사용자 운영 작업 및 배포 순서

이 단계는 A와 B의 fixture 수락 뒤, 사용자가 Cloudflare/Supabase Dashboard에서만 수행한다. **site key와 secret을 채팅·Git·`.env`·테스트·로그에 보내거나 기록하지 않는다.**

1. Cloudflare account의 **Workers & Pages → Create → Worker**에서 `timefit-captcha` 같은 새 Worker를 만든다. A의 Worker artifact만 먼저 deploy하고, `workers.dev` URL이 활성화된 것을 확인한다. 이 시점에는 site key가 없으므로 Worker가 `503`을 반환해도 정상이다. URL 전체가 아니라 hostname만 다음 Turnstile 설정에 쓴다.
2. Cloudflare **Turnstile → Add widget**에서 이름은 `TimeFit CAPTCHA production`, mode는 **Managed**, hostname은 Worker URL의 hostname만 입력한다. 예: URL이 `https://timefit-captcha.<subdomain>.workers.dev/`이면 `timefit-captcha.<subdomain>.workers.dev`만 입력한다. `https://`, path, port, wildcard, localhost, preview host는 넣지 않는다. 생성 후 site key는 다음 Worker secret에, **secret key는 그 다음 Supabase 설정에만** 쓴다.
3. Worker **Settings → Variables and Secrets**에서 `TURNSTILE_SITE_KEY`를 secret으로 추가한다. 이 값은 2단계 Turnstile widget의 public site key다. public 값이더라도 Worker 설정으로 한 곳에서 관리하며 repository에는 넣지 않는다.
4. Supabase Dashboard **Project Settings → Auth → Bot and Abuse Protection**에서 CAPTCHA protection을 켜고 provider를 Cloudflare Turnstile로 선택한다. Turnstile **secret key만** 입력해 저장한다. 또한 Auth 일반 설정에서 anonymous sign-ins를 켠다. 이 앱은 anonymous user profile·추천·위치·코스·행동을 연결 저장하지 않고, 기존 30일 cleanup 계약을 유지한다.
5. Supabase Edge Secrets에 기존 Kakao route key와 함께 다음 값만 설정한다. 값 자체를 출력·문서화하지 않는다: representative catalog snapshot/version, route proxy walk/transit budget 및 deadline/lease/cache 값, `ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED=true`, `ROUTE_PROXY_ABUSE_GUARD_APPROVED=true`. CAPTCHA secret은 Edge secret으로 중복 저장하지 않는다.
6. `captcha-challenge`, `route-proxy`, anonymous cleanup function을 deploy하고, 앱 production build에 Worker exact URL을 설정한 뒤 internal iOS device에서 **한 번만** smoke한다. synthetic representative public segment만 쓰며 실제 사용자 GPS·검색어·주소·개인 약속은 쓰지 않는다. 성공 조건은 widget 완료 → anonymous session 1회 → Proxy JWT 요청 → Kakao route 1회 → typed route success 및 budget/cache 진단 정상이다. 실패면 캡처에서 token·key·좌표를 지우고 기본 legacy adapter를 유지한다.

### 완료·중단 기준

ACT-04-B는 Worker artifact와 UI URL contract가 모두 수락되고, 사용자가 C의 Dashboard 설정·배포를 명시 승인한 뒤에만 smoke까지 진행한다. smoke 성공은 곧바로 ODsay 삭제나 추천 엔진 `2-J` 활성화를 뜻하지 않는다. 그 결과를 통합·결정이 검토해 별도 runtime 전환 작업을 지시한다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-04-B A단계 Cloudflare CAPTCHA Worker artifact

### 변경과 계약 경계

- **이전 방식 → 문제:** `captcha-challenge` Edge Function의 HTML 응답은 Supabase 기본 도메인에서 WebView MIME 처리 근거가 약해, Managed Turnstile의 server-owned 최상위 페이지로 쓰기 어렵다.
- **교체 방식:** `cloudflare/captcha-worker/`에 CAPTCHA page만 제공하는 Worker artifact를 추가했다. 성공 `GET`은 `text/html; charset=utf-8`와 `Cache-Control: no-store`, 정확한 Cloudflare-only CSP를 반환하고, `postMessage`는 non-empty `token`·`error`·`cancelled`만 전송한다. `TURNSTILE_SITE_KEY`가 없으면 HTML 없이 JSON `503`, GET 외 method는 JSON `405`으로 `no-store` 처리한다.
- **유지:** Worker URL/hostname·site key·secret·JWT·좌표·사용자/IP/검색어는 코드와 문서에 기록하지 않았다. Siteverify, token 저장·로그·재사용, Supabase/Kakao HTTP, route adapter 기본 전환, ODsay 제거, 추천 정책 변경은 추가하지 않았다.

### fixture·검증 결과

| ID | 결과 |
| --- | --- |
| API4ACT04B-A01 | GET의 HTML/no-store/CSP directive를 정확히 비교하고 typed message 및 Kakao·TMAP·ODsay·Supabase·JWT·좌표 등 민감 origin/식별자 부재를 확인 |
| API4ACT04B-A02 | site key 누락 GET은 HTML 없는 503, POST/PUT은 JSON 405이며 모두 no-store임을 확인 |

- 변경: `cloudflare/captcha-worker/src/index.ts`, `cloudflare/captcha-worker/wrangler.toml`, `test/captcha-worker.test.ts`, 이 작업기록.
- `npx tsx --test test/captcha-worker.test.ts test/captcha-challenge-handler.test.ts test/route-proxy-client-adapter.test.ts` — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `npm run test:ui` — 109 통과 / 기존 철회 이력 1 skip.
- `git diff --check` — 통과.

### 다음 단계와 보류 조건

이 기록은 **A단계 artifact만 완료**한 것이다. Cloudflare/Supabase Dashboard 설정, Worker/Edge deploy, site key·secret 설정, production URL 주입, 실제 API 호출 및 iOS smoke는 모두 **0회**이며 수행하지 않았다. `U-1-CAP-02`의 Worker exact URL 소비 fixture가 수락되고, 사용자가 C단계 Dashboard 설정·제한 배포·비식별 smoke를 명시 승인한 뒤에만 외부 API 어댑터가 C단계를 진행한다. 그 수락 전에는 기존 route adapter·ODsay·추천 엔진 `2-J` 공개 계약을 변경하지 않는다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-04-B A단계 수락

`cloudflare/captcha-worker`는 `TURNSTILE_SITE_KEY` 외 환경값·provider 호출을 갖지 않으며, 키 누락 GET 503·GET 외 405·no-store·정확한 CSP allowlist·typed message 경계를 확인했다. Worker URL·site key·secret·JWT·좌표가 source와 fixture에 고정되지 않았다.

통합 재실행에서 Worker와 CAPTCHA UI fixture **8/8 통과**, `npm run test:typecheck`, `git diff --check`가 통과했다. 따라서 **ACT-04-B A단계를 수락**하고 사용자 Dashboard 설정(C단계)을 진행할 수 있다. 이 수락은 deploy·secret 설정·실제 provider 호출·기본 adapter 전환 수락이 아니다.

---

## 2026-08-28 — 통합·결정 지시 API-4-A-ACT-04-B-R: Proxy runtime Auth·adapter 조립 보완

### 발견한 배포 차단 결함

Worker artifact와 URL 소비는 완료됐지만 현재 `src/ui/recommendation/v1Session.ts`는 `createCourseV1RouteAdapter()`를 직접 사용하며, `TimeSetupScreen`의 `onVerified(_token)`은 token을 폐기한 뒤 legacy 추천을 시작한다. 따라서 지금 Dashboard만 설정하면 Turnstile·anonymous Auth·Kakao Proxy가 실제 추천 요청에 연결되지 않고 TMAP/ODsay가 계속 호출된다.

이 작업은 그 누락된 **서비스 경계**만 만든다. UI는 `U-1-CAP-03`에서 one-shot token을 함수 인자로만 전달하고, 이 API 작업은 token으로 session을 얻어 Kakao Proxy adapter를 조립한다. 두 작업은 소유 경로가 달라 병렬 가능하지만, 둘 다 수락되기 전에는 Dashboard 설정·deploy·smoke를 금지한다.

### 소유 범위

외부 API 어댑터 세션은 `src/services/routeProxy*.ts`, 필요한 service fixture, 이 작업기록만 수정한다. `src/ui/`, `src/engine/`, 카탈로그·DB migration/RLS, Worker artifact, dashboard/secret/deploy, `docs/작업조정_보드.md`는 수정하지 않는다.

### 정확한 공개 계약

1. 서비스에 `createActivatedCourseV1RouteAdapter(input)` 같은 factory를 둔다. 입력은 (a) `enabled: boolean`, (b) one-shot `captchaToken?: string`, (c) 주입 가능한 Supabase Auth/Edge invoke port, (d) catalog snapshot scope resolver다. 실제 Supabase client는 별도 production factory에서만 감싸며, provider key는 입력·출력·로그에 0개다.
2. `enabled === false`면 기존 legacy adapter를 반환하는 것은 UI 조립 경계의 결정이며, 이 factory는 Proxy 활성 어댑터를 만들지 않는다. `enabled === true`이면 existing Supabase session을 먼저 재사용하고, session이 없을 때만 받은 non-empty token으로 `signInAnonymously({ options: { captchaToken } })`를 정확히 한 번 호출한다.
3. 활성 Proxy 경로에서 token 누락·취소·Auth 실패·Edge 비정상 응답·unconfigured/limited/network 실패는 typed `RouteProxyUnavailableError` 또는 동등한 명시 오류로 끝낸다. TMAP·ODsay·직접 Kakao·근사 시간 fallback은 **0회**다. 이 오류는 UI가 구분해 재시도 문구를 낼 수 있어야 하며 token·JWT·좌표를 포함하지 않는다.
4. session을 얻으면 `createAuthenticatedRouteProxyInvoker`와 `createCourseV1ProxyRouteAdapter`만 사용한다. 공개 representative↔representative 구간은 현재 `ROUTE_PROXY_CATALOG_SNAPSHOT_VERSION`과 일치할 때만 `public_segment` ID scope(좌표 0)를 사용하고, origin/destination 등 snapshot 밖 구간만 request 수명 private scope(좌표는 Edge HTTP body에만)를 사용한다. private 좌표는 DB/cache/diagnostic/log에 넣지 않는다.
5. 별도 `EXPO_PUBLIC_ROUTE_PROXY_ENABLED`를 API service가 직접 읽지 않는다. public build flag 판정은 UI 조립(`U-1-CAP-03`)의 책임이며, API service는 boolean 의존성만 받는다. 이렇게 해야 test/preview에 우연히 Proxy가 켜지지 않는다.

### fixture와 완료 기준

아래를 fake Auth/Edge/route ports로 검증한다. 실제 Supabase/Kakao/Worker 호출은 0회다.

| ID | 입력 | 기대 결과 |
| --- | --- | --- |
| API4ACT04BR-01 | existing session + token 없음 | anonymous sign-in 0, JWT Edge header만 사용 |
| API4ACT04BR-02 | no session + valid token | anonymous sign-in 1회·`captchaToken` 정확히 1회 전달, 이후 Proxy invoke |
| API4ACT04BR-03 | null/blank/cancelled token·Auth 실패 | Proxy/legacy/provider invoke 0, typed unavailable |
| API4ACT04BR-04 | Proxy `limited`/network/invalid | ODsay/TMAP/direct Kakao fallback 0, typed unavailable |
| API4ACT04BR-05 | snapshot 안/밖 route | public은 ID/version만·좌표 0, private만 request body 좌표, DB/cache/진단 좌표 0 |
| API4ACT04BR-06 | Worker/CAPTCHA/Proxy 설정 없는 상태 | service가 config를 추측하거나 external call 하지 않음 |

`npx tsx --test`의 관련 route proxy fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 변경 파일·서비스 공개 계약·수정하지 않은 UI/engine/DB 경계·테스트 결과를 작업기록에 남긴다.

### 중단 기준

이 작업은 배포·실행 전 계약이다. Worker/Turnstile/Supabase setting, Edge secret, Edge deploy, 실제 Auth/Kakao 호출, default adapter 전환, ODsay 삭제는 0회다. `U-1-CAP-03` 수락 뒤 통합 검토가 두 adapter 조립을 확인할 때까지 Dashboard C단계를 시작하지 않는다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-04-B-R Proxy runtime Auth·adapter 조립

### 변경 파일과 목적

- `src/services/routeProxyActivatedCourseAdapter.ts`: UI가 전달한 `enabled`와 one-shot `captchaToken`만 받는 비동기 Proxy adapter factory를 추가했다. 기존 session을 우선 재사용하고, 없을 때만 non-empty token으로 anonymous sign-in을 정확히 한 번 시도한다. 활성 경로의 Auth·Edge·응답 형식 실패는 token/JWT/좌표/provider 상세가 없는 `RouteProxyUnavailableError`로 fail-closed한다.
- `src/services/routeProxyProductionPorts.ts`: 실제 Supabase client를 별도 production port에만 감쌌다. API service factory는 client·public build flag·provider key를 직접 읽지 않는다.
- `test/activated-route-proxy-adapter.test.ts`: existing/new session, token/Auth 실패, Edge limited/network/invalid, public/private snapshot scope, Worker/build 설정 미추측을 fake port로 고정했다.

### 유지한 공개 계약·정책 경계

- `enabled === false`의 legacy 선택은 UI 조립 경계(`U-1-CAP-03`)에 남아 있으며, 이 factory는 Proxy adapter를 만들지 않고 typed unavailable로 끝낸다.
- 활성 adapter는 `createAuthenticatedRouteProxyInvoker`와 `createCourseV1ProxyRouteAdapter`만 조립한다. TMAP·ODsay·직접 Kakao·근사 시간 fallback은 0회다.
- 현재 주입 snapshot에 좌표까지 일치하는 representative↔representative만 `public_segment` ID/version scope를 사용한다. 그 밖은 request 수명 `private_request`로만 좌표를 Edge body에 전달하며, 이 service는 private 좌표를 DB/cache/diagnostic/log에 보관하지 않는다.
- UI·엔진·카탈로그·DB migration/RLS·Worker artifact·Dashboard/secret/deploy·`docs/작업조정_보드.md`는 수정하지 않았다.

### fixture·검증 결과

| ID | 결과 |
| --- | --- |
| API4ACT04BR-01 | existing session은 sign-in 0회, JWT header를 통한 Proxy request만 발생 |
| API4ACT04BR-02 | 유효 one-shot token은 anonymous sign-in에 정확히 1회 전달된 뒤 Proxy 호출 |
| API4ACT04BR-03 | disabled/null/blank/Auth 실패는 Proxy·legacy provider 호출 0회와 typed unavailable |
| API4ACT04BR-04 | limited/network/invalid Edge body는 fallback 없이 typed unavailable |
| API4ACT04BR-05 | snapshot 안은 public ID/version·좌표 0, 밖은 private request body 좌표만 사용 |
| API4ACT04BR-06 | `EXPO_PUBLIC_ROUTE_PROXY_ENABLED`, Worker URL, provider 이름/키를 service가 읽거나 추측하지 않음 |

- `npx tsx --test test/activated-route-proxy-adapter.test.ts test/route-proxy-client-adapter.test.ts` — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 통과.
- `npm run test:ui` — 112 통과 / 기존 철회 이력 1 skip.
- `git diff --check` — 통과.

### 다음 결정·재현 조건

실제 Worker/Turnstile/Supabase 설정, Edge secret·deploy, 실제 anonymous Auth/Kakao 호출, default adapter 전환, ODsay 삭제는 모두 **0회**다. `U-1-CAP-03`이 one-shot token을 이 factory로만 전달하고 Proxy flag false에서 legacy를 유지하는 fixture를 수락한 뒤, 통합·결정이 UI/API 조립을 검토해야 한다. 그 수락과 사용자의 명시 Dashboard 운영 승인 전에는 `API-4-A-ACT-04-B` C단계 배포·비식별 smoke를 시작하지 않는다.

### 작업 식별자 정리

`API-4-A-ACT-04-B-R`은 별도 후속 단계가 아니다. Worker artifact가 만들어진 뒤 발견한 runtime 조립 누락을 원래 배포 전환 작업인 **`API-4-A-ACT-04-B`의 필수 범위로 통합**한 기록이다. 이후 외부 API 세션은 `API-4-A-ACT-04-B` 하나만 활성 작업명으로 사용한다. `-R` 표기는 이력 추적용으로만 남기며, 새 작업·새 완료 게이트로 취급하지 않는다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-04-B runtime 조립 수락

`API-4-A-ACT-04-B-R`에 기록된 구현은 활성 작업 `API-4-A-ACT-04-B`의 필수 범위로 수락한다. 기존 Supabase session은 CAPTCHA·anonymous sign-in 없이 재사용하고, session이 없을 때만 UI가 전달한 non-empty one-shot token을 `signInAnonymously`에 한 번 전달한다. 활성 Proxy는 authenticated Edge adapter만 조립하며, token/Auth/Edge 응답 실패에서 TMAP·ODsay·직접 Kakao·근사시간 fallback은 없다.

통합 재실행에서 activated Proxy fixture **6/6**, CAPTCHA/Worker·UI 경계 fixture를 포함한 선택 검증 **19/19**, `npm run test:typecheck`, `npm run test:ui` **114 통과·1 skip**, `npm test` **99 통과**, `git diff --check`가 통과했다. 아직 수행하지 않은 Cloudflare/Turnstile/Supabase Dashboard 설정·Edge deploy·실제 Auth/Kakao 호출·비식별 smoke는 **사용자 운영 작업**으로 남는다. 그 smoke를 수락하기 전에는 default adapter 전환·ODsay 제거·추천 엔진 `2-J`를 시작하지 않는다.

---

## API-4-A-ACT-04-B C-1 — Edge snapshot 주입·Route Proxy 제한 배포

### 시작 조건과 단일 작업 범위

사용자는 Cloudflare Worker/Turnstile, Supabase CAPTCHA·anonymous sign-in, 그리고 Route Proxy server config의 이름·값 입력을 완료했다. 이 C-1은 기존 활성 작업 `API-4-A-ACT-04-B` 안에서 **대표 snapshot을 안전하게 주입하고 `route-proxy`를 제한 배포**하는 단계다. 새 suffix 작업을 만들지 않는다.

외부 API 세션은 `supabase/functions/route-proxy/`, `src/services/routeProxyCatalogSnapshot.ts`, 필요한 adapter fixture, 이 작업기록만 다룬다. UI·엔진·카탈로그 원본·DB migration/RLS·Cloudflare Worker·Turnstile/Supabase Auth 설정·`docs/작업조정_보드.md`는 수정하지 않는다.

### 수행 지시

1. 현재 `routeProxyCatalogSnapshot`에서 생성한 `{ version, points }` JSON을 사용한다. representative 수·ID·좌표가 mobile snapshot과 결정적으로 동일한지 로컬 fixture로 재검증한 뒤 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON` Edge Secret에만 주입한다. JSON 전체, 좌표 목록, API key, JWT, secret 값을 terminal·작업기록·Git·`.env`·임시 파일에 출력하거나 남기지 않는다. 완료 기록에는 snapshot **version과 point 수**만 남긴다.
2. Secret 값은 읽어 검증할 수 없으므로 이름/digest 존재만 확인하고, 실제 값 검증은 handler의 제한 smoke로 한다. `KAKAO_ROUTE_REST_API_KEY`, anonymous/abuse flag, lease/deadline, cache, per-user rate, walk/transit hard·soft·per-second 설정의 **존재 여부만** 기록한다. Turnstile secret·site key는 읽거나 Edge Secret에 중복 저장하지 않는다.
3. hosted Supabase의 기본 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`를 덮어쓰지 않는다. `captcha-challenge`는 Cloudflare Worker 방식으로 철회됐으므로 deploy하지 않는다. anonymous cleanup은 scheduler·cleanup secret의 별도 출시 게이트가 있으므로 이번 core smoke에 deploy·invoke하지 않는다.
4. `route-proxy`만 배포한다. 배포 전후 `npm run test:typecheck`, route proxy fixture, `npm test`, `git diff --check`를 실행한다. 배포 명령 출력에 secret/Authorization header/request body가 나오지 않게 하고, 실제 Kakao 요청은 이 단계에서 0회여야 한다.
5. 완료 기록에는 변경/배포 대상, 유지한 공개 계약, 테스트 결과, Secret 이름 존재 여부, snapshot version·point 수, provider 호출 0회를 남긴다. secret 값·digest 원문·좌표·사용자 정보는 남기지 않는다.

### 완료 기준과 다음 인계

`route-proxy`가 현재 대표 snapshot과 함께 배포되고, 공개 설정·provider key가 mobile bundle에 추가되지 않아야 한다. 이것은 Proxy 기본 활성화나 ODsay 제거가 아니다. 완료 뒤 QA-04의 **0단계 제한 실기기 smoke**에 Worker root URL과 snapshot version만 인계한다.

---

## 2026-08-28 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B C-1 배포 전 검증 완료, 원격 권한 대기

### 확인한 변경·계약

- 현재 mobile representative snapshot은 로컬 정합성 fixture와 별도 구조 검증에서 **`representative-49c293a2` / 190 points**임을 확인했다. JSON 본문·좌표 목록은 출력·파일 기록·Git 추가를 하지 않았다.
- `route-proxy` handler의 public/private scope, JWT/auth, mode별 Kakao budget·lease·deadline fail-closed 계약을 다시 검증했다. 공개 설정·provider key는 mobile bundle에 추가하지 않았고, `captcha-challenge`·anonymous cleanup·기본 adapter·ODsay·2-J은 변경하지 않았다.

### 실행 결과와 중단 사유

- Route Proxy 관련 fixture — 30/30 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- `.env.local`의 기존 인증 환경을 사용해 project-ref를 내부적으로만 해석하고 Supabase secret 목록을 **이름만** 조회하려 했으나, CLI 응답은 `authentication_or_permission` 범주 오류였다. secret 값·digest·원문 오류 메시지는 출력하지 않았다.

따라서 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON` 주입과 `route-proxy` 제한 배포는 **0회**이며, 실제 Kakao 요청도 **0회**다. 기존 secret의 존재/값을 읽거나 덮어쓰지 않았다. C-1 재개에는 대상 Supabase 프로젝트의 Edge Function deploy 및 secret list/set 권한이 있는 `SUPABASE_ACCESS_TOKEN` 또는 해당 권한을 가진 로그인 세션이 필요하다. 권한이 확보되면 snapshot version·point 수만 기록하는 방식으로 secret을 주입하고 `route-proxy`만 배포한다.

---

## 2026-08-28 — 외부 API 어댑터 완료: API-4-A-ACT-04-B C-1 snapshot 주입·Route Proxy 제한 배포

### 변경·배포 대상

- Supabase CLI **native 로그인 세션만** 사용했다. `.env.local`은 source하거나 읽지 않았다.
- 로컬 `routeProxyCatalogSnapshot`의 현재 representative snapshot을 `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON` Edge Secret에 주입했다. 기록 가능한 검증값은 **`representative-49c293a2` / 190 points**뿐이며, JSON 본문·좌표·secret 값·digest는 출력·기록하지 않았다.
- TimeFit 원격 프로젝트에 **`route-proxy`만** 배포했다. `captcha-challenge`, anonymous cleanup, Worker artifact는 배포하지 않았다.

### 유지한 공개 계약·경계

- 필수 Route Proxy server secret은 값/digest 없이 이름 존재만 확인했다. CAPTCHA site/secret은 Edge Secret에 읽거나 중복 저장하지 않았다.
- 공개 설정·provider key를 mobile bundle에 추가하지 않았고, Proxy 기본 활성화·legacy adapter 변경·ODsay 제거·추천 엔진 `2-J` 활성화는 하지 않았다.
- 실제 anonymous Auth/Route Proxy invocation 및 Kakao provider 요청은 모두 **0회**다. C-1의 배포는 QA-04 0단계 제한 smoke를 위한 server 준비일 뿐이다.

### 검증 결과

- 배포 전/후 Route Proxy fixture — 30/30 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- 배포 CLI는 `route-proxy` 단일 Function upload/deploy 완료를 반환했고, 이후 snapshot secret 이름 존재를 재확인했다.

### 다음 인계

QA-04 0단계는 production Worker root URL과 위 snapshot version을 입력으로, 신규 anonymous session과 기존 session을 각각 1회로 제한해 CAPTCHA → JWT → Route Proxy → Kakao를 검증한다. 이 smoke가 수락되기 전에는 기본 adapter 전환·ODsay 제거·`2-J`를 시작하지 않는다.

### 2026-08-28 — 통합·결정 검토: API-4-A-ACT-04-B C-1 수락

사용자가 갱신한 native Supabase CLI 인증으로 이전 `authentication_or_permission` 차단이 해소됐다. 현재 앱과 서버 snapshot은 **`representative-49c293a2` / 190 points**로 일치하며, `ROUTE_PROXY_CATALOG_SNAPSHOT_JSON` 주입 뒤 `route-proxy`만 배포된 것을 확인했다. 공개 endpoint의 인증 헤더 없는 `HEAD` 요청은 **401 `UNAUTHORIZED_NO_AUTH_HEADER`**로 끝나므로 배포된 endpoint가 무인증 provider 호출을 허용하지 않는다.

통합 재실행에서 `npm run test:typecheck`, `npm test` **99 통과**, `git diff --check`를 통과했다. 따라서 **API-4-A-ACT-04-B C-1을 수락**한다. 이는 실제 CAPTCHA/anonymous Auth/Kakao 호출의 수락이 아니다. 다음은 `QA-04 0단계`의 제한 실기기 smoke이며, smoke 수락 전 Proxy 기본 활성화·ODsay 제거·2-J은 계속 금지한다.

---

## 2026-08-29 — 통합·결정 지시 API-4-A-ACT-04-B: Worker artifact 활성화

### 발견과 목표

QA-04 실패 뒤 실제 공개 root `https://timefit-captcha.sdongheun.workers.dev/`를 비밀값 없이 조회했다. 응답은 `HTTP 200`, `Content-Type: text/plain`, 본문 `Hello World!`였고 CAPTCHA HTML·`no-store`·CSP·Turnstile script가 없었다. Turnstile hostname은 이미 이 hostname으로 등록되어 있다. 따라서 현 Worker는 repository `cloudflare/captcha-worker`가 아니라 Cloudflare 기본 artifact를 실행 중이다.

이 작업은 새 suffix가 아니라 기존 활성 작업 **`API-4-A-ACT-04-B` 안의 Worker 배포 누락 정상화**다. 목표는 위 URL이 CAPTCHA HTML을 반환하게 하는 것뿐이다. Turnstile token 완료, anonymous Auth, Supabase route-proxy, Kakao provider, ODsay 제거, 기본 adapter 전환, 추천 엔진 `2-J`은 범위 밖이며 모두 0회로 유지한다.

### 소유 범위와 수행 지시

1. `cloudflare/captcha-worker/`의 현재 artifact와 `test/captcha-worker.test.ts`만 기준으로 사용한다. Dashboard에서 임의 HTML을 붙여넣거나 Worker 이름/공개 hostname을 바꾸지 않는다. `wrangler.toml`의 `name = "timefit-captcha"`가 현재 공개 endpoint와 일치하는지 먼저 확인한다.
2. Cloudflare 인증이 가능한 상태에서 해당 디렉터리에서 Worker artifact를 deploy한다. deploy 전후 `npx tsx --test test/captcha-worker.test.ts`와 관련 CAPTCHA UI fixture를 실행한다. API token, Turnstile secret, site key, 배포 credential은 terminal·문서·Git에 출력하거나 기록하지 않는다.
3. deploy 직후 **GET만**으로 public root를 확인한다. 성공 조건은 `200`, `Content-Type: text/html`, `Cache-Control: no-store`, Cloudflare Turnstile script/`보안 확인` marker다. 응답 본문 전문·site key 값은 남기지 않는다. GET 외 method는 `405`인지 별도 fixture로만 확인하며, 운영 endpoint에 반복 호출하지 않는다.
4. root가 `503`이면 artifact 배포는 성공이고 `TURNSTILE_SITE_KEY`가 Worker 환경에 없다는 뜻이다. 이 경우 사용자에게 Cloudflare Worker의 **Settings → Variables and Secrets**에서 `TURNSTILE_SITE_KEY`라는 secret을 추가하도록 요청한다. 값은 Turnstile의 **public site key**이며 Turnstile **secret key가 아니다**. 값을 요청·출력·문서화하지 않는다. 설정 뒤 root GET을 1회만 재확인한다.
5. root가 올바른 CAPTCHA HTML을 반환한 뒤에만 QA-04 0단계의 새 anonymous session 1회 재시험을 인계한다. QA가 앱 URL을 바꾸지 않는 한 internal build 재생성은 필요 없다. 여전히 WebView 실패이면 error 원인을 `invalid_config`/`http_status`/`navigation_blocked`/`widget_error`처럼 비밀 없는 범주로만 분리한다.

### 완료 기록·수락 기준

변경/배포한 artifact, 공개 root의 상태·content type·정책 marker, `TURNSTILE_SITE_KEY` 존재 여부만 기록한다. site key/secret/JWT/좌표/사용자 정보/provider 요청은 0개다. CAPTCHA root의 성공은 Route Proxy 활성화 수락이 아니며, **QA-04 신규 session에서 widget 완료가 확인되어야만** 그 다음 anonymous Auth/Proxy smoke를 시작한다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B Worker artifact 배포 완료, public site key 설정 대기

### 변경·배포 대상

- `cloudflare/captcha-worker/`의 현재 artifact를 기존 **`timefit-captcha`** Worker에 배포했다. Worker 이름·공개 hostname은 바꾸지 않았고 Dashboard HTML을 직접 편집하지 않았다.
- 배포 전 `test/captcha-worker.test.ts`와 CAPTCHA UI 경계 fixture를 실행해 **11/11 통과**했으며, `git diff --check`도 통과했다.

### 공개 root 단일 확인 결과

- 배포 직후 공개 root에 **GET 1회만** 보냈다. 결과는 `503`, `Content-Type: application/json`, `Cache-Control: no-store`였으며 CAPTCHA marker와 Turnstile script는 없었다. 응답 본문 전문·site key는 출력하거나 기록하지 않았다.
- 이는 artifact 배포 실패가 아니라 Worker runtime에서 `TURNSTILE_SITE_KEY`가 없을 때의 의도된 fail-closed 응답이다. 현재 Worker 환경에 이 값이 **없음**을 확인했다.

### 다음 사용자 운영 조치·유지한 경계

Cloudflare Worker **Settings → Variables and Secrets**에서 `TURNSTILE_SITE_KEY`라는 secret을 추가해야 한다. 값은 해당 Worker hostname에 등록된 Turnstile의 **public site key**이며 Turnstile secret key가 아니다. 값 자체를 채팅·Git·문서·로그에 보내지 않는다. 설정 후 공개 root GET을 1회만 재확인한다.

Turnstile 완료, Supabase anonymous Auth, Route Proxy, Kakao provider 요청, ODsay 제거, 기본 adapter 전환, 추천 엔진 `2-J`는 모두 **0회**이며 수행하지 않았다. CAPTCHA HTML 확인 전 QA-04 신규 session smoke를 재개하지 않는다.

### 2026-08-29 — 통합·결정 검토: Worker artifact 배포 조건부 수락

공개 root를 독립적으로 한 번 확인한 결과가 `HTTP 503`, `Content-Type: application/json`, `Cache-Control: no-store`였다. 기존의 `200 text/plain` 기본 `Hello World!` 응답은 사라졌으므로, repository Worker artifact가 올바른 `timefit-captcha` endpoint에 배포됐다는 부분은 수락한다.

`503`은 source가 정의한 `TURNSTILE_SITE_KEY` 부재의 fail-closed 상태다. 이는 배포 실패나 Turnstile hostname 오류가 아니며, Worker environment에 Turnstile **public site key**를 secret 이름 `TURNSTILE_SITE_KEY`로 한 번 설정해야 해소된다. secret key·값 원문은 어떤 기록에도 넣지 않는다. 설정 뒤 root가 `200 text/html`·`Cache-Control: no-store`·Turnstile marker를 반환하는지 GET 1회로 확인한 뒤에만 QA-04 신규 session smoke를 재개한다.

### 2026-08-29 — 통합·결정 재확인: production binding 미적용

사용자가 Dashboard 입력을 확인한 뒤에도 root GET은 계속 `503`이었다. Cloudflare CLI로 **`timefit-captcha` Worker의 secret 이름만** 조회한 결과도 빈 목록이었으며 `TURNSTILE_SITE_KEY`는 존재하지 않았다. 값·digest는 조회하지 않았다.

따라서 입력 폼의 값이 실행 중인 production Worker binding으로 배포되지 않았거나, 다른 Worker/environment에 저장된 상태다. `timefit-captcha → Settings → Variables and Secrets`의 production 범위에서 `TURNSTILE_SITE_KEY` secret을 다시 추가한 뒤 **Deploy**로 100% production version을 만들어야 한다. secret 목록에 해당 이름이 확인되고 root가 200 HTML로 바뀌기 전에는 QA 재시도를 금지한다.

### 2026-08-29 — 통합·결정 확인: Worker production 정상화 수락

Cloudflare version deployment로 public site key를 포함한 최신 Worker version을 production 100%로 전환했다. 공개 root GET 1회의 결과는 `HTTP 200`, `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store` 및 제한 CSP였고, Turnstile·React Native bridge·`보안 확인` marker가 확인됐다. key 값·token·JWT·좌표·provider 요청은 확인·출력하지 않았다.

따라서 CAPTCHA **페이지 배포/설정 경계만 수락**한다. 이는 실제 widget 완료나 Supabase anonymous Auth·Route Proxy·Kakao 성공을 뜻하지 않는다. 다음 단일 작업은 QA-04 0단계에서 현재 internal build로 신규 anonymous session을 정확히 1회 실행해 widget 완료까지 확인하는 것이다. 그 결과 전에는 Proxy 기본 전환·ODsay 제거·`2-J`를 계속 시작하지 않는다.

---

## 2026-08-29 — 통합·결정 지시 API-4-A-ACT-04-B: Turnstile widget 관찰 가능성 보완

### 관찰과 우선순위

공개 Worker root는 `200 text/html`과 Turnstile script marker를 반환하지만, 같은 URL을 일반 브라우저로 열면 Worker의 `취소` 버튼만 보이고 Turnstile widget 영역은 비어 있다. 이는 Worker HTML·inline DOM은 로드됐으나 Turnstile 외부 script 로드, explicit render, 또는 widget 설정 오류가 사용자에게 드러나지 않았다는 뜻이다. 아직 이를 hostname/site key 오류로 단정하지 않는다.

현재 HTML은 `async defer` script와 `window.onload`에 의존하고, script load 실패·`turnstile` 전역 부재·`render()` 예외·Turnstile `error-callback`을 모두 보이지 않는 일반 `{ type: 'error' }`로만 처리한다. 이 상태로 앱 WebView 진단만 먼저 추가하면 동일한 원인을 두 번 좇게 된다. 따라서 **먼저 Worker page에서 원인을 안전하게 보이게 하고 explicit render 순서를 견고하게 만든다.**

### 범위와 금지 경계

외부 API 세션은 `cloudflare/captcha-worker/src/index.ts`, `test/captcha-worker.test.ts`, 필요한 CAPTCHA UI 계약 fixture, 이 작업기록만 수정한다. Turnstile Dashboard의 hostname/site key/secret 값, Supabase, UI 화면, 엔진, DB, 카탈로그, `docs/작업조정_보드.md`는 수정하지 않는다.

Turnstile site/secret key, token, JWT, URL query, IP, GPS, provider key/request는 source·화면·console·문서·fixture에 기록하지 않는다. anonymous Auth·Route Proxy·Kakao·ODsay 호출은 0회다.

### 구현 계약

1. Worker page에서 Turnstile boot function을 먼저 정의하고, Turnstile script 태그의 `onload`로만 explicit `render()`를 시작한다. `async/defer`와 `window.onload` 간의 순서 경쟁을 제거한다. script `onerror`, 전역 부재, `render()` throw는 별도의 안전 상태로 처리한다.
2. `#status` 같은 최소 상태 영역을 둔다. 정상 render 전에는 `보안 확인을 불러오는 중이에요.`를 보이고, 아래 **고정 진단 코드만** 보여 준다. 오류 message/stack/URL/key/token을 넣지 않는다.
   - `widget_script_load_failed`
   - `widget_api_unavailable`
   - `widget_render_failed`
   - `widget_error_<Cloudflare_numeric_code>` (숫자 코드만 허용; 값이 없거나 비숫자면 `widget_error_unknown`)
3. `error-callback`에는 Cloudflare error code 인자를 받고, 브라우저 상태 영역에는 위 코드만 표시한다. React Native에는 기존처럼 `{ type: 'error' }`만 `postMessage`한다. token/cancelled 계약과 cancel 버튼은 유지한다.
4. CSP는 필요한 Cloudflare origin 외에 넓히지 않는다. `default-src 'none'`, script/connect/frame의 `https://challenges.cloudflare.com`, 현재 about frame 허용, no-store, GET 200/키 없음 503/POST 405 경계를 유지한다.
5. fixture는 (a) script onload 경로의 render 호출, (b) script error/API 없음/render throw/error numeric·unknown의 상태 코드와 error message, (c) token/cancelled, (d) key/secret/token/raw URL 미포함, (e) 기존 status/CSP/method 경계를 검증한다.

### 배포·검증 순서

1. `npx tsx --test test/captcha-worker.test.ts`와 관련 UI fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 통과시킨다.
2. 기존 `timefit-captcha` Worker에만 deploy한다. production public site key binding을 지우거나 새 값으로 덮어쓰지 않는다. deploy 후 root가 다시 503이면 중단하고 binding 복구 문제만 기록한다.
3. root가 200 HTML인 것을 확인한 뒤 일반 브라우저에서 1회만 연다. widget이 보이면 다음 QA가 가능하다. 상태 코드가 보이면 코드만 기록하고, 설정 변경·앱 QA·Auth/Proxy 호출은 하지 않는다.

### 완료 기준과 인계

일반 브라우저에서 blank screen 대신 widget 또는 하나의 안전 진단 코드가 보이고, Worker 정책이 유지돼야 한다. widget이 정상 렌더링된 다음에만 `U-1-CAP`의 iOS WebView failure enum 작업과 QA 신규 session 1회를 진행한다. 이 작업은 추천엔진·2-J·ODsay 제거를 열지 않는다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B Turnstile widget 관찰 가능성 보완

### 변경 파일과 목적

- `cloudflare/captcha-worker/src/index.ts`: `async defer`·`window.onload` 의존을 제거했다. DOM 준비 뒤 boot function을 먼저 등록하고 Turnstile script의 `onload`만으로 explicit `render()`를 시작한다.
- 최소 `#status` 영역은 render 전 `보안 확인을 불러오는 중이에요.`를 표시한다. script load/API 부재/render 예외 및 Cloudflare numeric error code는 각각 `widget_script_load_failed`, `widget_api_unavailable`, `widget_render_failed`, `widget_error_<number>` 또는 `widget_error_unknown`만 표시한다.
- React Native bridge는 기존 `token`/`error`/`cancelled` typed event를 유지했다. 상태에는 오류 원문·stack·URL·site key·token을 넣지 않았다.
- `cloudflare/captcha-worker/wrangler.toml`: `keep_vars = true`만 추가해 deploy가 Dashboard의 `TURNSTILE_SITE_KEY` binding을 삭제하지 않도록 했다. Worker 이름·hostname·secret 값은 바꾸지 않았다.
- `test/captcha-worker.test.ts`: onload boot 순서, 상태 코드 정상화, 오류 원문/민감정보 미노출 및 기존 CSP/method 계약을 검증하는 `API4ACT04B-W01` fixture를 추가했다.

### 검증·배포 결과

- `npx tsx --test test/captcha-worker.test.ts test/ui/captcha-recommendation-gate-model.test.ts test/ui/captcha-verification-model.test.ts` — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- 기존 `timefit-captcha`에 `--keep-vars`로 code artifact만 배포했다. strict deploy는 Dashboard binding을 충돌로 보고 업로드 전에 중단됐으며, binding을 보존하는 deploy로 재시도했다.
- 공개 root GET 1회는 `200`, `text/html; charset=utf-8`, `no-store`, Turnstile script·loading marker·안전 상태 wiring을 반환했다. 응답 본문 전문과 site key는 출력하지 않았다.

### 유지한 경계·다음 관찰

Turnstile Dashboard/secret·Supabase·앱 UI·엔진·DB·카탈로그는 변경하지 않았고, Turnstile 완료·anonymous Auth·Route Proxy·Kakao·ODsay 호출은 모두 **0회**다. 이 환경에는 실제 브라우저 UI를 관찰할 제어 수단이 없어 widget 또는 안전 진단 코드의 시각 확인은 아직 하지 못했다. 다음 일반 브라우저 1회 관찰에서는 widget이 보이면 QA-04 신규 session smoke로, 안전 코드가 보이면 그 코드만 기록해 원인을 분리한다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B `widget_api_unavailable` callback 보완

### 변경·유지한 경계

- `cloudflare/captcha-worker/src/index.ts`의 Turnstile script URL을 정확히 `render=explicit&onload=__timefitTurnstileBoot` callback 방식으로 전환했다. DOM `onload` attribute는 제거하고 network failure용 `onerror`와 `defer`만 유지했다.
- boot function은 script 이전에 계속 정의하며, `widget_api_unavailable` guard와 고정 안전 상태 코드·typed `token/error/cancelled` bridge·CSP/no-store/GET·405·503 경계를 유지했다.
- Worker setting/secret, Turnstile Dashboard, Supabase, 앱 UI, 엔진, DB, 카탈로그는 변경하지 않았다. `keep_vars` 배포로 기존 binding을 보존했고 설정값을 읽거나 출력하지 않았다.

### 검증·배포 결과

- 구현 전 callback fixture는 기존 DOM `onload`에서 의도대로 실패했다.
- Worker/CAPTCHA UI fixture — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- 기존 `timefit-captcha`에 `--keep-vars`로 code artifact만 배포했다.
- production root GET 1회: `200`, `text/html; charset=utf-8`, `no-store`, explicit callback URL·DOM onload 제거·`defer`를 확인했다. 본문 전문·site key는 출력하지 않았다.

### 브라우저 관찰과 다음 조건

widget 또는 안전 코드의 일반 브라우저 1회 관찰을 시도했으나, 이 환경의 Chrome UI 제어 native pipe가 시작되지 않아 실행하지 못했다. 이 실패는 Worker/Turnstile 상태가 아니라 관찰 도구 문제로만 기록한다. Turnstile 완료·anonymous Auth·Route Proxy·Kakao·ODsay·QA 앱 실행은 모두 **0회**다. 다음 실제 브라우저 1회에서 widget이 보이면 QA-04를, 안전 코드가 보이면 그 코드만 기록한 뒤 원인 분리를 진행한다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B explicit API 철회·implicit rendering 적용

### 변경·유지한 경계

- `cloudflare/captcha-worker/src/index.ts`에서 `render=explicit`, `window.turnstile`, 직접 `render()` 호출, API availability/render-failure guard를 제거했다.
- container는 `cf-turnstile` 및 `data-sitekey`·success/error/expired callback 이름을 사용하는 implicit rendering으로 교체했다. callback 함수는 container parsing 전에 정의하며, success는 non-empty token만 기존 typed `token`으로 전달한다.
- implicit script는 정확한 `https://challenges.cloudflare.com/turnstile/v0/api.js`를 `async defer`로 사용한다. script load failure, widget numeric/unknown error, expired는 안전 상태 코드와 typed `error`만 보낸다.
- `keep_vars`로 기존 site key binding을 보존하고 code artifact만 배포했다. Worker setting/secret, Supabase, 앱 UI, 엔진, DB, 카탈로그는 변경하지 않았다.

### 검증·배포 결과

- 구현 전 implicit fixture는 explicit HTML에서 의도대로 실패했다.
- Worker/CAPTCHA UI fixture — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- production root GET 1회: `200`, `text/html; charset=utf-8`, `no-store`, implicit container/script 존재 및 explicit API 의존 부재를 확인했다. 응답 본문 전문·site key는 출력하지 않았다.

### 브라우저 관찰·다음 조건

일반 브라우저에서 widget 또는 error code를 한 번 관찰하려 했으나 Chrome UI 제어 native pipe가 다시 시작되지 않아 실행하지 못했다. 이는 Worker 결과가 아니라 관찰 도구 제한이다. Turnstile 완료·anonymous Auth·Route Proxy·Kakao·ODsay·QA 앱 실행은 모두 **0회**다. 다음 실제 브라우저 1회에서 widget 또는 numeric `widget_error_<number>`가 확인되기 전에는 앱 QA와 downstream 활성화를 시작하지 않는다.

### 2026-08-29 — 통합·결정 검토 및 즉시 보완: `widget_api_unavailable`

일반 브라우저 관찰 결과가 `widget_api_unavailable`이었다. 이는 Worker HTML과 script fetch event까지는 진행했지만, 현재 script 태그의 DOM `onload` 시점에 `window.turnstile` API가 준비되지 않았다는 뜻이다. site key 유효성·hostname 검증은 `turnstile.render()` 이전 단계이므로 이 코드로 판단할 수 없으며, Turnstile Dashboard 값을 다시 입력하거나 Supabase/앱 QA를 재시도해서는 안 된다.

Cloudflare의 explicit rendering 공식 방식은 `api.js?render=explicit&onload=<callback>` query callback이다. 현재 DOM attribute `onload="__timefitTurnstileBoot()"`은 이 방식과 다르고 API 준비 순서를 보장하지 않는다. 아래 보완은 새 작업이 아니라 동일한 **`API-4-A-ACT-04-B` 안의 한 번의 코드 수정**이다.

1. boot 함수를 script보다 먼저 정의한 상태를 유지한다.
2. script URL을 정확히 `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__timefitTurnstileBoot`로 바꾸고, DOM `onload` attribute는 제거한다. script network failure 진단용 `onerror`만 유지한다. `async`는 추가하지 않고 Cloudflare 예시와 같이 `defer`를 사용한다.
3. `widget_api_unavailable` guard는 실패 관찰 경계로 유지하되, 정상 환경에서는 Cloudflare API callback 뒤에 `turnstile.render()`가 실행됨을 fixture에서 검증한다. root HTML에 site/secret key, token, raw error가 보이지 않는 경계와 CSP/no-store/GET·405·503은 유지한다.
4. 관련 fixture·전체 회귀를 실행하고 `keep_vars`를 유지한 채 code artifact만 deploy한다. deploy 후 503이면 중단한다. root 200 확인 뒤 일반 브라우저에서 1회 열어 widget 또는 다음 안전 코드만 관찰한다. Auth/Proxy/Kakao/ODsay/QA 앱 실행은 0회다.

이 보완 이후에도 `widget_api_unavailable`이면 Cloudflare script가 현재 브라우저에서 비정상 응답/차단되는 환경 문제로 분리한다. `widget_error_<number>`가 나오면 그 숫자 코드에만 대응한다. widget이 렌더링된 뒤에만 UIUX `U-1-CAP`과 QA-04를 재개한다.

### 2026-08-29 — 통합·결정 전환: explicit API 호출 철회·implicit rendering 적용

callback URL 전환 뒤에도 일반 브라우저에서 `widget_api_unavailable`이 재현됐다. 공개 HTML marker와 Cloudflare deployment history를 다시 확인해 최신 callback artifact가 production 100%임을 확인했다. 즉 캐시·구형 Worker·site key 미주입이 아니라, 이 정적 CAPTCHA page에서 explicit `window.turnstile` API를 직접 호출하는 방식 자체가 동작하지 않는 상태다.

이 페이지는 동적 widget lifecycle·다중 widget·실행 시점 제어가 필요 없다. Cloudflare도 단순 정적 페이지에는 implicit rendering을 권장한다. 따라서 explicit `turnstile.render()`/`render=explicit`/API availability guard를 더 보완하는 방식을 **철회**하고, 아래 단일 구현으로 전환한다.

1. Turnstile container를 `class="cf-turnstile"`와 `data-sitekey`로 만든다. HTML parsing 전에 성공/error/expired callback을 `window.__timefit...` 함수로 정의하고, data callback attribute에는 함수명만 둔다.
2. script는 Cloudflare의 정확한 implicit URL `https://challenges.cloudflare.com/turnstile/v0/api.js`를 `async defer`로 불러온다. `render=explicit`, `onload` query, `window.turnstile`, 직접 `render()` 호출은 모두 제거한다.
3. success는 기존처럼 non-empty token만 React Native에 typed `token`으로 전달한다. error/expired/script load failure는 status의 고정 진단 코드와 typed `error`만 전달한다. numeric Cloudflare error code·unknown, cancel, no-store/CSP/GET 200·키 없음 503·다른 method 405와 민감정보 0 경계를 유지한다.
4. fixture는 implicit script exact URL, `cf-turnstile`, callback 명칭, explicit API 호출 0, script error·widget error·token/cancelled 경계, site/secret/token/raw URL 미노출 및 CSP를 검증한다.
5. `keep_vars`로 binding을 보존해 code artifact만 production에 배포한다. root가 503으로 되돌아가면 중단한다. 일반 브라우저에서 widget 또는 다음 안전 코드 한 번만 관찰하며, Auth/Proxy/Kakao/ODsay/앱 QA는 0회다.

**완료 기준:** 일반 브라우저가 widget을 렌더링하거나 Cloudflare widget error code를 표시해야 한다. 이후에도 blank/API unavailable이면 Cloudflare script가 브라우저에서 차단된 환경 문제로 판정하고, 설정 추측·앱 QA 반복 대신 브라우저 network/extension 분리를 사용자에게 요청한다.

### 2026-08-29 — 통합·결정 검토: implicit artifact 조건부 수락

로컬 source와 production root는 모두 `cf-turnstile` container, 정확한 implicit `api.js` URL, explicit API 의존 0, `200 text/html`·`no-store`를 만족한다. fixture 12/12 및 전체 회귀도 통과했다. 따라서 **코드/배포 부분은 수락**한다.

단, 이 방식의 완료 기준은 실제 일반 브라우저에서 widget 또는 widget error code가 보이는 것이다. API 세션은 브라우저 UI 관찰을 수행하지 못했으므로, 설정 성공·앱 QA 가능으로 수락하지 않는다. 다음 단일 검증은 사용자가 같은 root를 새로 열어 widget 또는 안전 코드를 1회 관찰하는 것이다. 그 결과가 widget이면 U-1-CAP과 QA-04로, code면 그 code의 원인만 후속 처리한다.

### 2026-08-29 — 통합·결정 검토 및 즉시 보완: implicit scan 시점

사용자 browser console의 비밀 없는 관찰값은 `scriptCount: 1`, `turnstileType: 'object'`, `frameCount: 0`, status loading이다. 즉 `api.js`는 한 번만 로드되어 API object를 만들었지만, `cf-turnstile` container를 iframe으로 변환하는 implicit auto scan은 실행되지 않았다. 이는 site key/hostname 검증 단계보다 앞선 상태이므로 Dashboard 값을 다시 넣거나 앱 QA를 재시도할 근거가 없다.

현재 Worker는 implicit `api.js`를 body 끝에서 `async defer`로 불러온다. 작은 문서에서는 DOMContentLoaded 이후에 async script가 도착할 수 있어 auto scan을 놓칠 수 있다. 다음 수정은 같은 활성 `API-4-A-ACT-04-B` 안의 **load-order 보완**이다.

1. success/error/expired/script-error callback 정의는 `<head>`에 먼저 둔다.
2. implicit `api.js` script를 `<head>` 안에서 callback 정의 뒤에 배치하고, `async`를 제거한 **`defer`만** 사용한다. body의 `cf-turnstile` container는 그대로 유지한다. 이렇게 하면 script는 HTML parsing 뒤·DOMContentLoaded 전에 실행되어 container를 결정적으로 scan한다.
3. implicit URL·data callback·no-store/CSP·진단 코드·typed bridge·keep_vars·민감정보 0·외부 호출 0 경계를 유지한다. explicit API와 직접 render 호출을 다시 넣지 않는다.
4. fixture에는 (a) script가 body/container보다 앞선 head에 존재, (b) `defer` 존재와 `async` 부재, (c) implicit container/data callbacks, (d) explicit 의존 0을 추가한다. 전체 회귀 뒤 code artifact만 deploy한다.
5. 브라우저에서 새 탭 1회만 열어 console의 `frameCount`가 1 이상인지 또는 numeric `widget_error_<number>`가 보이는지만 확인한다. 둘 다 아니면 browser state 값을 다시 기록하고 추가 구현은 중단한다.

**완료 기준:** iframe이 생성돼 widget이 보이거나 widget error code가 표시되어 site key/hostname 단계로 넘어갈 수 있어야 한다. 그 전 앱 QA·Auth/Proxy/Kakao/ODsay·2-J은 0회다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B implicit scan load-order 보완

### 변경 파일과 목적

- `cloudflare/captcha-worker/src/index.ts`: success/error/expired/script-error callback을 정의하는 inline script 뒤에, implicit Turnstile `api.js`를 `<head>`에서 `defer`만 사용해 배치했다. body 끝의 script와 `async`를 제거해 HTML parsing 완료 뒤·DOMContentLoaded 전의 implicit auto scan 순서를 고정했다.
- `test/captcha-worker.test.ts`: Turnstile script가 `</head>` 및 `cf-turnstile` container보다 앞에 있고, 정확한 implicit URL·`defer`·`async` 부재를 유지하는 fixture로 보강했다.

### 유지한 공개 계약·경계

- `cf-turnstile`, 기존 `data-sitekey` binding, success/error/expired callback, typed `token/error/cancelled` bridge와 numeric/unknown 안전 코드, cancel, no-store·CSP·GET 200/키 없음 503/그 외 method 405를 유지했다.
- explicit API 호출, `render=explicit`, `window.turnstile`, 직접 `render()`는 다시 추가하지 않았다. Worker setting/secret·Supabase·앱 UI·엔진·DB·카탈로그는 변경하지 않았다.

### 검증·배포 결과

- 변경 전 head/defer fixture는 body `async defer` artifact에서 의도대로 실패했다.
- Worker/CAPTCHA UI fixture — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- 기존 `timefit-captcha`에 `--keep-vars`로 code artifact만 배포했다. 배포 version ID·binding 값·site key는 기록하지 않는다.
- production root GET 1회: `200`, `text/html; charset=utf-8`, `no-store`, implicit container 및 head `defer` script·`async` 부재를 확인했다. 응답 본문 전문과 site key는 출력하지 않았다.

### 브라우저 관찰·다음 조건

새 탭 1회 관찰을 위해 Chrome UI 제어를 시도했으나, 이 환경의 native pipe가 시작되지 않아 `frameCount`/widget/error code는 얻지 못했다. 이는 Worker/Turnstile 관찰값이 아니라 도구 제한이다. Turnstile 완료·anonymous Auth·Route Proxy·Kakao·ODsay·QA 앱 실행은 모두 **0회**다.

다음 실제 브라우저 1회에서는 `frameCount >= 1` 또는 numeric `widget_error_<number>`만 확인한다. 둘 다 아니면 그 browser state만 기록하고 추가 구현·설정 추측·앱 QA는 시작하지 않는다.

---

## 2026-08-29 — 통합·결정 지시 API-4-A-ACT-04-B: 검증된 implicit Worker 코드 동기화와 QA-04 인계

### 결정과 현재 관찰

사용자가 Cloudflare production Worker에 표준 implicit Turnstile 구조를 적용한 뒤, 일반 브라우저에서 **`인증이 완료되었습니다.`** 상태를 확인했다. 이는 Worker HTML 응답, Turnstile script, iframe 생성, widget token callback까지가 실제로 동작했다는 직접 관찰이다. 이전 explicit `turnstile.render()` 실험은 `window.turnstile` object는 있었지만 `render`/`ready`가 `undefined`인 시점에 직접 호출해 `widget_render_failed`로 끝났다. 이 정적 단일-widget 페이지에는 explicit lifecycle 제어가 필요하지 않으므로 그 방식은 **철회**한다.

현재 Cloudflare Dashboard 수동 편집본과 repository `cloudflare/captcha-worker/` source는 다를 수 있다. 이 상태를 그대로 두면 다음 Wrangler deploy가 정상 Worker를 과거 artifact로 덮어쓴다. 이 작업의 유일한 목적은 **실제로 성공한 implicit 구조를 repository source·fixture·production artifact에 동일하게 고정**하는 것이다.

### 소유 범위

외부 API 세션은 다음만 수정한다.

- `cloudflare/captcha-worker/src/index.ts`
- `test/captcha-worker.test.ts`
- 본 작업기록의 완료 기록

Cloudflare Turnstile widget/hostname/site key/secret, Worker 이름·URL, Supabase Auth 설정, 앱 UI, Edge Function, DB, 추천 엔진, 카탈로그, `docs/작업조정_보드.md`는 수정하지 않는다. public site key·Turnstile secret·token·JWT·좌표·검색어·provider key·raw error/URL은 source·fixture·console·작업기록에 절대 기록하지 않는다.

### 구현 계약

1. **implicit 방식만 사용한다.** `<head>`에서 Cloudflare의 정확한 표준 URL `https://challenges.cloudflare.com/turnstile/v0/api.js`를 `async defer`로 한 번만 로드한다. `render=explicit`, query/DOM `onload` callback, `window.turnstile`, `turnstile.render()`, polling/retry loop은 0개여야 한다.
2. body에는 한 개의 `class="cf-turnstile"` container와 `data-sitekey`, success/error/expired callback 이름만 둔다. `siteKey`는 HTML attribute를 깨지 않는 방식으로 주입한다. 이 값은 Worker binding에서만 오며 repository 상수로 복사하지 않는다.
3. callback은 parsing 전에 정의한다.
   - success: 비어 있지 않은 token만 `{ type: 'token', token }`으로 bridge한다. 빈 token은 고정 상태 코드와 `{ type: 'error' }`로 끝낸다.
   - error: numeric code만 `widget_error_<number>`, 그 외는 `widget_error_unknown`으로 status에 표시하고 `{ type: 'error' }`만 bridge한 뒤 `true`를 반환한다.
   - expired/script load failure: 각각 고정 상태 코드와 `{ type: 'error' }`만 bridge한다.
   - cancelled: `{ type: 'cancelled' }`만 bridge한다.
   React Native message에는 error 원문·numeric code·site key·token 외의 진단값을 추가하지 않는다.
4. `GET 200`, 키 없음 `503`, 그 외 method `405`, 모든 응답의 `Cache-Control: no-store`, 현재의 최소 CSP(`script/connect/frame` Cloudflare origin 및 필요한 `about:` frame), 민감정보 0 경계를 유지한다. 임의 origin·analytics·provider/Supabase 연결을 추가하지 않는다.
5. Dashboard에서 직접 편집한 내용을 source-of-truth로 인정하지 않는다. repository source를 위 계약에 맞춘 뒤 기존 `timefit-captcha`에 **binding을 보존하는 code-only deploy**를 한다. `keep_vars`를 유지하며 site key binding을 지우거나 새 값으로 덮어쓰지 않는다.

### 검증과 중단 기준

1. 구현 전에 explicit/defer-only artifact가 위 fixture에서 실패함을 확인하고, fixture가 standard `async defer` implicit script·container·callback·CSP·no-store·GET/405/503·민감정보 부재를 검증하게 한다. fixture는 실제 site key/token을 쓰지 않는다.
2. `npx tsx --test test/captcha-worker.test.ts`, 관련 CAPTCHA UI fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다.
3. `--keep-vars`로 code artifact만 deploy한 뒤 root GET **1회**에서 `200`, `text/html`, `no-store`, implicit script/container marker만 확인한다. 본문 전문이나 site key 값은 출력하지 않는다. `503`이면 즉시 중단하고 binding 복구만 인계한다.
4. 사용자 브라우저의 기존 성공은 사전 근거로 기록하되, deploy 직후 새 탭에서 **한 번만** widget 표시 또는 token-success 상태를 확인한다. token·site key·console 원문을 기록하지 않는다. 실패 시 보이는 고정 status와 iframe 개수만 인계하며 다시 explicit 방식으로 되돌리지 않는다.
5. 이 단계에서 anonymous Auth, Route Proxy, Kakao, ODsay, 추천 요청은 **0회**다. Worker가 위 검증을 통과하면 외부 API 세션은 구현을 종료하고, QA-04가 신규 anonymous session 1회로 전체 흐름을 확인하도록 인계한다.

### 완료 기준

repository source와 production Worker가 같은 implicit 구조이며, production root 정책과 browser widget/token-success가 확인돼야 한다. 그 결과 전에는 QA-04를 재개하지 않는다. 이 작업은 Proxy 기본 전환·ODsay 제거·추천 엔진 `2-J` 수락을 의미하지 않는다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B 검증된 implicit Worker 코드 동기화

### 변경 파일과 목적

- `cloudflare/captcha-worker/src/index.ts`: Cloudflare 표준 implicit script를 callback 정의 뒤 `<head>`에서 정확한 `api.js` URL의 `async defer`로 한 번만 로드하도록 동기화했다. explicit query/DOM onload·`window.turnstile`·직접 render·polling/retry는 추가하지 않았다.
- error callback은 numeric/unknown 안전 상태와 typed `error`만 bridge한 뒤 `true`를 반환한다. success의 non-empty token, expired/script failure, cancelled 및 site key binding 방식은 유지했다.
- `test/captcha-worker.test.ts`: head의 표준 `async defer` script 1개, container보다 앞선 callback, error callback `true`, explicit API 의존 0을 검증하도록 바꿨다.

### 검증·배포 결과

- 구현 전 fixture는 기존 `defer` 단독 artifact에서 의도대로 실패했다.
- Worker/CAPTCHA UI fixture — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- 기존 `timefit-captcha`에 `--keep-vars`로 code artifact만 배포했다. site key binding/Worker 이름/URL/설정값은 읽거나 변경하지 않았다.
- production root GET 1회는 `200`, `text/html; charset=utf-8`, `no-store`를 반환했다. 응답 marker 판독은 이 호출의 비본문 검사에서 확인되지 않아, 추가 GET으로 재시도하지 않았다. 응답 본문·site key는 출력하지 않았다.

### 유지한 경계·남은 인계

- anonymous Auth·Route Proxy·Kakao·ODsay·추천 요청은 모두 **0회**다. Supabase·앱 UI·DB·엔진·카탈로그·Turnstile Dashboard 설정은 변경하지 않았다.
- 배포 후 새 탭 1회 관찰을 시도했지만 Chrome UI 제어 native pipe가 시작되지 않아 widget/token-success·고정 status·iframe 수를 얻지 못했다. 실제 브라우저에서 widget 또는 token-success를 1회 확인하기 전에는 QA-04를 재개하지 않는다.

---

## 2026-08-29 — 통합·결정 정정 지시 API-4-A-ACT-04-B: 사용자 검증 Worker artifact를 정확히 source로 승격

### 정정 사유

직전 `keep_vars` code-only deploy 뒤 사용자는 widget 회귀를 확인했고, Dashboard Worker source가 repository의 단순화 artifact로 다시 교체된 것을 확인했다. `keep_vars`는 binding만 보존하며 Worker code는 보존하지 않는다. 직전 source는 generic implicit 구조라는 점만 맞췄을 뿐, 사용자가 직접 token-success를 확인한 artifact의 CSP·상태 callback·markup을 정확히 보존하지 않았다. 또한 배포 후 browser 관찰 없이 수락한 것은 잘못이었다.

이번 작업은 새 구현·보안 강화·표준화 작업이 아니다. 아래 **사용자 검증 artifact**를 Worker 성공 HTML의 기준으로 승격하는 단일 정정 작업이다. API 세션은 이 내용을 축약·치환·명시 렌더링 전환·추가 진단으로 바꾸지 않는다.

### 기준 artifact — 성공 GET HTML의 필수 동작

1. `<head>`의 inline callback 정의 뒤, 정확히 `https://challenges.cloudflare.com/turnstile/v0/api.js`를 `async defer`로 1회 로드한다. `render=explicit`, query/DOM `onload`, `window.turnstile`, 직접 `render`, `onerror` 보완 script, polling/retry는 추가하지 않는다.
2. body는 중앙 정렬된 단일 `cf-turnstile` element를 둔다. `data-sitekey`, success/error/expired callback 이름과 cancel button을 아래의 사용자 검증 구조와 동등하게 유지한다.
3. 성공 callback은 `인증이 완료되었습니다.`를 status에 표시한 뒤 non-empty token만 `{ type: 'token', token }`으로 전달한다. error callback은 `인증 오류가 발생했습니다.`를 표시하고 `{ type: 'error', code }`를 전달한 뒤 `true`를 반환한다. expired는 `인증이 만료되었습니다.`를 표시한다. cancelled는 `{ type: 'cancelled' }`다.
4. 성공 응답 CSP는 정확히 `default-src 'none'`, Cloudflare-only `script-src`/`connect-src`, Cloudflare+`about:` `frame-src`, `img-src https://challenges.cloudflare.com data:`, `'unsafe-inline'` `style-src`, `base-uri 'none'`, `form-action 'none'`을 포함한다. 이는 사용자 검증 artifact와 동등해야 하므로 `img-src`를 제거하거나 임의 origin으로 넓히지 않는다.
5. `siteKey`는 `TURNSTILE_SITE_KEY` Worker binding에서만 가져와 success HTML에 넣는다. 실제 key/secret/token은 source·fixture·작업기록·로그에 넣지 않는다. GET 외 `405`, key 없음 `503`, 모든 응답 `no-store`, Worker 이름/URL/secret binding 유지 경계는 그대로 둔다.

### 정확히 반영할 기준 코드

아래 코드는 public site key가 런타임 `siteKey` 변수로만 주입되는 사용자 검증 artifact다. TypeScript source의 type annotation·공통 `reply()` helper 사용은 허용하되, success HTML·CSP·callback 의미는 바꾸지 않는다.

```ts
const challengePage = (siteKey: string) => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>보안 확인</title>
  <script>
    const send = (event) => window.ReactNativeWebView?.postMessage(JSON.stringify(event));
    window.__timefitTurnstileSuccess = (token) => {
      const status = document.getElementById('status');
      if (status) status.textContent = '인증이 완료되었습니다.';
      if (typeof token === 'string' && token.trim()) send({ type: 'token', token });
    };
    window.__timefitTurnstileError = (code) => {
      const status = document.getElementById('status');
      if (status) status.textContent = '인증 오류가 발생했습니다.';
      send({ type: 'error', code });
      return true;
    };
    window.__timefitTurnstileExpired = () => {
      const status = document.getElementById('status');
      if (status) status.textContent = '인증이 만료되었습니다.';
    };
  </script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:100vh; margin:0; font-family:sans-serif; background-color:#f9fafb;">
  <main style="text-align:center;">
    <p id="status" role="status" style="margin-bottom:16px;">보안 확인을 진행 중입니다...</p>
    <div class="cf-turnstile" data-sitekey="${siteKey}" data-callback="__timefitTurnstileSuccess" data-error-callback="__timefitTurnstileError" data-expired-callback="__timefitTurnstileExpired"></div>
    <button id="cancel" type="button" style="margin-top:16px; padding:6px 16px; cursor:pointer;">취소</button>
  </main>
  <script>document.getElementById('cancel').onclick = () => send({ type: 'cancelled' });</script>
</body>
</html>`;
```

### 수행·검증·중단 기준

1. 먼저 `test/captcha-worker.test.ts`를 위 artifact의 `async defer`, status 세 문구, `img-src` CSP, callback return true, token/error/cancelled, 200/405/503/no-store를 검증하도록 고친다. 실제 key/token을 fixture에 넣지 않는다.
2. `cloudflare/captcha-worker/src/index.ts`를 기준 artifact와 동등하게 바꾸고, `npx tsx --test test/captcha-worker.test.ts` 및 관련 CAPTCHA UI fixture, `npm run test:typecheck`, `npm test`, `git diff --check`를 통과시킨다.
3. 기존 `timefit-captcha` Worker에만 `keep_vars`로 code-only deploy한다. Worker binding·hostname·Turnstile Dashboard·Supabase는 바꾸지 않는다. root GET 1회에서 `200`, HTML, `no-store`만 확인한다.
4. **사용자가 새 탭에서 widget을 완료해 `인증이 완료되었습니다.`를 한 번 확인할 때까지 이 작업은 완료가 아니다.** 성공하면 repository와 production 동기화를 수락한다. 실패하면 status·iframe 수만 기록하고 code를 다시 추정 변경하지 않는다.
5. 이 작업에서는 anonymous Auth, Siteverify 직접 호출, Route Proxy, Kakao, ODsay, 추천 요청을 모두 0회로 유지한다. browser-success 뒤에만 QA-04가 신규 anonymous session 1회로 Supabase Auth의 CAPTCHA 검증을 확인한다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B 사용자 검증 artifact source 승격

### 변경 파일과 목적

- `cloudflare/captcha-worker/src/index.ts`: 사용자 검증 artifact의 HTML/CSP/callback 의미를 source에 그대로 승격했다. head의 Cloudflare implicit `api.js`는 `async defer`로 한 번만 로드하며, 중앙 정렬 container·세 상태 문구·cancel bridge·error `{ type: 'error', code }`와 `true` 반환을 보존했다.
- 성공 CSP에 artifact와 동일한 `img-src https://challenges.cloudflare.com data:`를 포함했다. explicit render/query/DOM onload·`window.turnstile`·직접 render·onerror/polling은 추가하지 않았다.
- `test/captcha-worker.test.ts`: 사용자 검증 artifact의 `async defer`, 상태 문구, 단일 container, error/cancel bridge, `img-src` CSP 및 기존 GET/405/503/no-store 경계를 검증하도록 갱신했다.

### 검증·배포 결과

- 구현 전 fixture는 기존 축약 artifact에서 CSP `img-src`와 사용자 검증 status/bridge 계약으로 의도대로 실패했다.
- Worker/CAPTCHA UI fixture — 12/12 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 99/99 통과.
- `git diff --check` — 통과.
- 기존 `timefit-captcha`에 `--keep-vars`로 code artifact만 배포했다. Worker 이름/URL/binding/Turnstile Dashboard/Supabase는 변경하거나 읽지 않았다.
- production root GET 1회: `200`, `text/html; charset=utf-8`, `no-store`를 확인했다. 본문 전문·site key는 출력하지 않았다.

### 유지한 경계·수락 대기

- anonymous Auth·Siteverify 직접 호출·Route Proxy·Kakao·ODsay·추천 요청은 모두 **0회**다.
- 배포 후 새 탭 token-success 관찰을 1회 시도했으나 Chrome UI 제어 native pipe가 시작되지 않아 실제 widget/status/iframe 값을 얻지 못했다. 사용자가 새 탭에서 `인증이 완료되었습니다.`를 한 번 확인하기 전에는 이 작업을 수락하거나 QA-04를 재개하지 않는다.

---

## 2026-08-29 — 통합·결정 재개 지시 API-4-A-ACT-04-B: 익명 Auth·Route Proxy fail-closed 원인 코드 계약

### 관찰과 목표

QA-04에서 Worker URL 오타를 수정한 뒤 CAPTCHA 화면은 열렸고, 신규 session은 `RouteProxyUnavailableError`의 일반 UI 문구로 종료했다. 신규 session·Proxy flag true 흐름에서 이 문구까지 도달하려면 UI가 CAPTCHA token callback 뒤 `startRecommendation(token, true)`를 시작해야 한다. 따라서 Worker→WebView token bridge는 통과했으나, 현재 adapter는 **Supabase 익명 sign-in 실패**와 **인증 뒤 route-proxy 응답 실패**를 같은 error로 변환해 다음 설정 수정 대상을 판별할 수 없다.

목표는 token/JWT/좌표/provider key/raw HTTP body·상태 코드·Supabase 원문 오류를 노출하지 않고, internal diagnostics build의 다음 QA-04 한 번에서 익명 Auth와 Route Proxy 실패 단계를 구분하는 typed 계약을 만드는 것이다. Worker·Cloudflare·Supabase Dashboard·Edge 배포·provider 호출은 이 작업에서 바꾸거나 실행하지 않는다.

### 소유 범위

외부 API 어댑터 세션은 `src/services/routeProxyActivatedCourseAdapter.ts`, `src/services/routeProxyClientAdapter.ts`, 필요한 API 계약 test, 이 작업기록만 수정한다. `src/ui/`, Worker/Cloudflare, Supabase Auth/Edge 함수·secret, 엔진, DB, 카탈로그, `.env*`, `docs/작업조정_보드.md`는 수정하지 않는다.

### 공개 계약

1. 기존 `RouteProxyUnavailableError`는 유지하되, 아래의 **고정·비밀 없는** `reason`만 보유하도록 확장한다. raw `Error`, URL, HTTP code/body, provider key, token/JWT, 좌표, user ID를 property/message/cause에 넣지 않는다.

   - `captcha_token_missing`
   - `anonymous_auth_failed`
   - `route_proxy_transport_failed`
   - `route_proxy_rejected`
   - `route_proxy_limited`
   - `route_proxy_in_flight`
   - `route_proxy_unconfigured`
   - `route_proxy_store_unavailable`
   - `route_proxy_provider_failed`
   - `route_proxy_invalid_response`

2. 신규 session에서 token이 비었으면 `captcha_token_missing`, `signInAnonymously`가 throw하거나 access token 없이 끝나면 `anonymous_auth_failed`여야 한다. 기존 session이 있으면 CAPTCHA/sign-in은 0회이며 이 reason을 만들지 않는다.
3. authenticated Edge invoke의 transport error/null data와 예상 밖 throw는 `route_proxy_transport_failed`로, Edge의 typed status는 위 대응 reason으로 변환한다. `ok`인데 요청 mode·양의 정수 totalMin 계약을 어기면 `route_proxy_invalid_response`다. 성공 route 계약과 도보→대중교통 순서, private/public scope, cache/budget/lease, legacy fallback 금지는 바꾸지 않는다.
4. API layer는 reason을 console/analytics/DB·route request payload에 기록하지 않는다. production UI의 일반 문구도 이 세션이 바꾸지 않는다.

### 필수 fixture·완료 기준

1. 고정 fake auth/edge로 기존 session 재사용, token 없음, anonymous sign-in throw/null, Edge transport/null, 각 typed Edge status, malformed `ok`를 검증한다. 각 경우 reason만 비교하며 실제 Supabase/Kakao/Cloudflare/DB 호출은 0회다.
2. 이전 `RouteProxyUnavailableError` 호출자는 reason 없이도 안전한 기본값을 가지며, legacy fallback이 0회임을 회귀한다.
3. `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 변경 파일/유지 경계/결과/다음 UI 계약만 작업기록에 남긴다.

**다음 인계:** 이 API 계약 수락 뒤에만 UIUX가 같은 `U-1-CAP`에서 diagnostics flag true일 때 `RouteProxyUnavailableError.reason`만 표시한다. UI는 token·raw error를 읽지 않는다. 그 뒤 QA-04 신규 session을 한 번만 실행한다.

---

## 2026-08-29 — 외부 API 어댑터 진행 기록: API-4-A-ACT-04-B 익명 Auth·Route Proxy fail-closed reason 계약

### 변경 파일과 목적

- `src/services/routeProxyActivatedCourseAdapter.ts`: `RouteProxyUnavailableError`에 고정된 비밀 없는 `reason` union과 안전 기본값을 추가했다. 신규 session의 token 없음은 `captcha_token_missing`, anonymous sign-in throw/빈 access token은 `anonymous_auth_failed`로 분리한다. 기존 session은 CAPTCHA/sign-in 없이 기존 JWT 경로를 계속 사용한다.
- authenticated Edge의 typed status는 limited/in-flight/unconfigured/store/provider/rejected/invalid response reason으로 변환하고, 예상 밖 throw·transport error·null data는 `route_proxy_transport_failed`로 fail-closed한다. `ok`의 mode/양의 정수 `totalMin` 위반은 `route_proxy_invalid_response`다.
- `src/services/routeProxyClientAdapter.ts`: Edge invoke의 원문 error/null data를 보관·전달하지 않는 내부 transport boundary를 추가했다.
- `test/activated-route-proxy-adapter.test.ts`: 고정 fake auth/edge로 기존 session 재사용, token 없음, Auth throw/null, Edge throw/null, 모든 typed status, malformed `ok`, reason 없는 기존 오류 생성과 legacy fallback 0 경계를 검증했다.

### 유지한 공개 계약·경계

- `RouteProxyUnavailableError`의 기존 일반 message와 reason 없는 호출자의 안전 기본값을 유지했다. raw Error/URL/HTTP code/body/provider key/token/JWT/좌표/user ID는 error property/message/cause·console·analytics·DB·route payload에 넣지 않았다.
- 성공 route, 도보→대중교통 순서, private/public scope, cache/budget/lease 및 Proxy 실패 뒤 legacy fallback 금지는 변경하지 않았다. Worker/Cloudflare·Supabase Dashboard/Edge 배포·앱 UI·엔진·DB·카탈로그는 수정하지 않았다.

### 검증 결과와 다음 인계

- API/UI 관련 focused fixture — 16/16 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 100/100 통과.
- `git diff --check` — 통과.
- Supabase anonymous Auth·Edge invoke·Worker·Kakao·ODsay·DB 실호출은 모두 **0회**다.

다음은 UIUX가 internal diagnostics flag에서만 `RouteProxyUnavailableError.reason`을 표시하는 계약 작업이다. UI는 token/raw error를 읽지 않으며, 그 작업이 수락된 뒤에만 QA-04 신규 session 1회로 실제 실패 단계를 관찰한다.

---

## 2026-08-29 — 통합·결정 검토: API-4-A-ACT-04-B 수락

- **수락:** `RouteProxyUnavailableError`는 공개된 고정 reason만 보유하고, token/JWT·좌표·URL·HTTP 원문·provider key·사용자 식별자를 보관하거나 전달하지 않는다. 신규 익명 Auth 실패와 인증 뒤 proxy 실패를 처음으로 안전하게 구분할 수 있다.
- **검증:** API 구현의 fake auth/edge fixture 16/16, `npm run test:typecheck`, 전체 `npm test` 100/100, `git diff --check`를 통합·결정에서 재실행해 통과했다. 실제 Supabase/Edge/Cloudflare/Kakao/ODsay/DB 호출과 legacy fallback은 이 검증에서 0회다.
- **다음 작업:** UIUX는 `U-1-CAP`에서 internal diagnostics flag일 때만 `CAPTCHA 진단: <reason>`을 일반 오류 아래에 표시한다. 그 작업 수락 전에는 QA-04를 실행하지 않는다.

---

## 2026-08-29 — 통합·결정 지시 API-4-C: Route Proxy cache·provider attempt receipt 계약

### 목표

추천 엔진 2-J는 추천 세션당 실제 Kakao provider 새 호출을 최대 8회로 제한하고, cache hit는 비용 없이 다음 후보를 보충해야 한다. 그러나 현재 mobile route adapter는 `ExactRoute | null`만 반환하여 server cache hit, 실제 Kakao 호출, provider 검증 불가를 구분하지 못한다. API-4-C는 이 차이만을 provider-neutral·비밀 없는 receipt로 전달한다.

### 소유 범위와 금지 경계

외부 API 어댑터 세션은 Route Proxy Edge response/handler, `src/services/routeProxy*`, 필요한 adapter 계약 테스트와 이 작업기록만 수정한다. `src/engine/`의 2-J 선택 정책, React/UIUX, 카탈로그·원본 데이터, DB schema/RPC, Cloudflare/Supabase Dashboard 설정, `.env*`, 작업조정 보드는 수정하지 않는다. 실제 Kakao/Cloudflare/Supabase 호출은 0회다.

### 공개 receipt 계약

1. 각 route mode 요청은 아래의 안전 정보만 mobile adapter에 전달한다.

   - 결과: `exact | no_route | unavailable`
   - `newProviderAttemptCount`: `0 | 1` (Edge 한 mode 요청이 실제 Kakao HTTP를 시작했을 때만 1)
   - 재사용: `session_hit | server_cache_hit | provider_attempt | in_flight_reuse`
   - unavailable reason: `limited | transport | store | provider | invalid_response | rejected` 중 하나

2. mobile `walk → transit` 조합은 두 mode receipt를 합산해 `0 | 1 | 2` attempt로 엔진 port에 제공한다. route를 찾지 못한 정상 응답과 provider unavailable을 같은 `null`로 뭉개지 않는다.
3. provider name, HTTP status/body, URL, Authorization/key, token/JWT, 좌표, user ID, IP, cache key, 남은 quota·lease ID는 Edge response·mobile type·error·console·analytics·DB에 절대 넣지 않는다.
4. server cache hit와 in-flight 재사용은 Kakao HTTP 0회다. public/private scope, 방향·mode cache key, DB budget/lease, Kakao 단일 provider·fallback 0·deadline/abort의 현행 행동은 바꾸지 않는다.

### fixture·완료 기준

1. 고정 fake RPC/fetch로 server cache hit, private request, public cache miss→Kakao 1회, in-flight reuse, walk hit→transit provider attempt, walk provider attempt→transit provider attempt, no-route, limited, transport/store/provider/invalid/rejected을 실제 handler→client adapter 변환 경로에서 검증한다.
2. 각 fixture는 receipt attempt 합계와 재사용 상태만 비교하며 원문 민감정보를 출력하지 않는다. cache hit/in-flight가 0, provider 시작이 정확히 1로 보장되어야 한다.
3. 기존 `ExactRoute | null` 소비자는 2-J engine port 전환 전까지 호환되며, 이 작업이 추천 순위·후보 선택을 바꾸지 않는다.
4. `npm run test:typecheck`, 관련 API fixture, `npm test`, `git diff --check`를 실행한다. 변경 파일·유지 경계·결과·2-J가 소비할 type/entry만 기록한다.

---

## 2026-08-29 — 외부 API 어댑터 완료: API-4-C Route Proxy cache·provider attempt receipt 계약

### 변경 파일과 목적

- `supabase/functions/route-proxy/handler.ts`: Edge 응답에서 provider 이름을 제거하고, 결과·새 provider attempt(0/1)·재사용 상태·고정 unavailable reason만 담은 receipt를 추가했다. cache hit은 0/`server_cache_hit`, in-flight 재사용은 0/`in_flight_reuse`, 실제 HTTP 시작 뒤 성공·no-route·실패는 1/`provider_attempt`로 기록한다.
- `src/services/routeProxyClientAdapter.ts`: `RouteProxyReceipt`와 `RouteProxyRouteReceipt`를 추가하고, 기존 `getRoute(): ExactRoute | null` 호환을 유지하면서 2-J가 사용할 `getRouteReceipt()`로 walk→transit receipt 및 0~2 attempt 합계를 노출한다.
- API fixture: fake RPC/fetch를 통한 handler receipt(cache/in-flight/no-route)와 mobile walk hit→transit attempt 합계·기존 ExactRoute 소비를 검증했다.

### 유지한 경계

- provider name, HTTP 원문·URL, Authorization/key, token/JWT, 좌표, user ID, IP, cache key, quota·lease ID는 Edge receipt·mobile type·error에 넣지 않았다.
- public/private scope, 방향·mode cache key, DB budget/lease, Kakao 단일 provider·fallback 0·deadline/abort와 추천 엔진/UI/DB schema는 바꾸지 않았다. 실제 Kakao/Cloudflare/Supabase 호출은 **0회**다.

### 검증 결과·2-J 인계

- 관련 adapter/handler fixture — 22/22 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 101/101 통과.
- `git diff --check` — 통과.

추천 엔진 2-J는 `createCourseV1ProxyRouteAdapter(...).getRouteReceipt(from, to)`의 `receipts`와 `newProviderAttemptCount`만 소비한다. `ExactRoute | null` 기존 entry는 호환을 위해 유지되며, 이 작업은 후보 선택·순위·UI를 변경하지 않는다.

---

## 2026-08-29 — 통합·결정 검토: API-4-C 수락 보류·같은 작업 내 공개 계약 보완

### 확인된 부분

- `route-proxy` handler와 mobile adapter가 cache hit·in-flight 재사용·실제 provider 시작을 각각 `0/0/1` attempt로 구분하고, walk→transit을 `0~2`로 합산한다.
- 관련 고정 fixture 32/32, `git diff --check`가 통과했다. provider 원문·key·좌표·사용자 식별자는 receipt에 넣지 않았다.

### 수락 전 반드시 보완할 한 가지

현재 `RouteProxyFunctionResponse.status`에는 handler가 실제 반환하는 정상 `no_route`가 없다. 또한 valid request 뒤의 store/auth/abuse/deadline/secret 구성 실패는 receipt 없이 `{ status }`만 반환한다. 이 상태에서 2-J는 `route: null`을 받더라도 **정상 경로 없음**과 **검증 불가**를 모든 경우에 구조적으로 구분할 수 없고, REC-26의 실패 근거도 안정적으로 만들 수 없다.

이는 새 작업 ID가 아니라 **API-4-C 완료 범위의 계약 보완**이다. 추천 엔진·UI·DB·실제 외부 호출은 수정하지 않는다.

1. client response union에 `no_route`를 추가하고, `getRouteReceipt()`이 `no_route`를 정상 미경로 receipt로 보존하는 fixture를 둔다.
2. shape 검증을 통과한 요청의 모든 fail-closed 반환(store/auth/anonymous disabled/abuse/deadline/secret/config)은 provider HTTP 0회와 함께 안전한 `unavailable` receipt를 반환한다. reason은 기존 허용 enum 중 정확한 값만 쓴다(`store`, `limited`, `rejected`, `transport`, `provider`, `invalid_response`).
3. malformed request처럼 mode조차 신뢰할 수 없는 입력은 기존 generic rejection을 유지해도 되지만, mobile adapter가 만드는 정상 request와 섞이지 않는다는 fixture를 둔다.
4. cache hit·in-flight·provider attempt의 attempt 수와 기존 `getRoute(): ExactRoute | null` 호환을 바꾸지 않는다.

완료 시 handler→client adapter fixture로 `no_route`, `store`, `rejected`, `limited`, `transport` 각각을 검증하고, 관련 테스트·`npm run test:typecheck`·`npm test`·`git diff --check` 결과를 같은 API-4-C 완료 기록에 추가한다. 이 보완이 수락되면 2-J를 바로 시작한다.

---

## 2026-08-29 — 외부 API 어댑터 보완 완료: API-4-C `no_route`·fail-closed receipt 완결

### 변경·유지한 계약

- `RouteProxyFunctionResponse.status`에 `no_route`를 추가했고, handler는 provider가 정상 응답했지만 경로가 없을 때 `result: no_route`·attempt 1 receipt를 반환한다. activated adapter는 이를 unavailable로 바꾸지 않고 walk→transit 조합에 그대로 전달한다.
- shape 검증을 통과한 request의 store/auth/anonymous disabled/abuse/deadline/secret 구성 실패도 mode가 있는 `unavailable` receipt와 attempt 0으로 반환한다. reason은 `store`·`rejected`·`limited`·`transport`·`provider`만 사용한다.
- malformed request는 mode를 신뢰할 수 없으므로 기존 generic rejection으로 유지했다. cache/in-flight/provider attempt 수, `getRoute(): ExactRoute | null` 호환, DB·provider·엔진·UI 경계는 바꾸지 않았다.

### 검증 결과·다음 인계

- handler→client fixture에서 no-route, store, rejected, limited, transport 및 provider HTTP 0회 fail-closed 경계를 추가 검증했다. 관련 fixture — 24/24 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 101/101 통과.
- `git diff --check` — 통과.
- 실제 Kakao/Cloudflare/Supabase 호출은 **0회**다.

2-J는 `getRouteReceipt()`의 `no_route`와 `unavailable` receipt를 분리해 소비할 수 있다. 이 API-4-C 보완은 추천 순위·후보 선택·UI를 직접 변경하지 않는다.

### 통합·결정 수락 (2026-08-29)

보완 뒤 실제 handler 구현에서 `no_route`가 client union에 포함되고, valid request의 store/auth/anonymous/abuse/deadline/secret 차단이 모두 attempt 0의 안전 receipt를 반환함을 확인했다. 통합 확인으로 관련 fixture 33/33과 `npm run test:typecheck`, `git diff --check`가 통과했다. **API-4-C를 수락하며, 다음 작업은 추천 엔진 2-J다.**

---

## 2026-08-29 — 통합·결정 지시 API-4-D: 2-J receipt runtime adapter 연결

### 목적

2-J는 순수 엔진에서 새 Kakao provider attempt 8회·adapter call 24회를 통제하지만, 현재 활성 Route Proxy adapter는 `getRoute()`만 UI에 제공한다. 이 작업은 API-4-C의 mode별 receipt를 2-J의 `CourseV1RouteReceiptAdapter`로 **정확히 변환하고, 한 논리 구간 안에서도 남은 attempt보다 많은 Kakao 요청을 시작하지 않게 한다.** 추천 후보 순위·UI·DB는 바꾸지 않는다.

### 소유 범위와 금지 경계

외부 API 어댑터 세션은 `src/services/routeProxyClientAdapter.ts`, `src/services/routeProxyActivatedCourseAdapter.ts`, 필요한 API adapter fixture와 이 작업기록만 수정한다. `src/engine/`, `src/ui/`, Route Proxy Edge handler·migration, 카탈로그, Cloudflare/Supabase 설정, `.env*`, 작업조정 보드는 수정하지 않는다. 실제 Kakao·Supabase·Cloudflare 호출은 0회다.

### 구현 계약

1. 활성 Proxy factory는 기존 `CourseV1RouteAdapter`와 함께 `CourseV1RouteReceiptAdapter`를 만족하는 단일 route port를 반환한다. UI가 이 포트를 그대로 2-J에 주입할 수 있어야 하며, 새 provider key·JWT·좌표·cache key·provider 원문을 공개 타입·오류·로그에 추가하지 않는다.
2. engine의 `getRouteReceipt(from, to, { maxNewProviderAttemptCount })` 요청을 받아 **그 요청 안에서** Kakao provider HTTP 시작 수가 최대값을 넘지 않게 한다. `0`이면 Edge 요청 0회, `1`이면 walk 뒤 transit을 추가 시작하지 않으며, `2`에서만 walk→transit 두 mode를 허용한다. Edge cache hit/in-flight reuse는 0회로 계산한다.
3. mode receipts를 엔진 receipt로 결정적으로 합친다.
   - 선택된 exact route가 있으면 `exact`와 실제 합산 attempt 수를 반환한다.
   - provider가 정상적으로 경로를 주지 않은 경우는 `no_route`다.
   - limited/store/transport/provider 등 하나라도 검증 불가이거나, 남은 예산 때문에 다음 mode를 시작하지 않은 경우는 `unavailable`이다.
   - `reused`는 새 Kakao 시작이 전혀 없고 실제 route 판단이 cache/session/in-flight 결과만으로 끝난 경우에만 `true`다.
   - 기존 `getRoute()`의 exact/null 호환은 유지하되, Proxy 활성 경로에서 receipt를 버리고 legacy/근사/ODsay/TMAP으로 fallback하지 않는다.
4. `createRequiredRouteProxyInvoker`는 구조가 유효한 fail-closed Edge receipt를 `RouteProxyUnavailableError`로 먼저 바꿔 버리지 않는다. malformed response·transport·인증 세션 생성 실패만 기존 안전 오류로 끝내고, typed `no_route`/`unavailable`은 2-J가 reason으로 처리하게 보존한다.

### 필수 fixture와 완료 기준

- fake invoker로 short walk exact, walk cache hit→transit provider 1회, walk provider 1회 뒤 남은 예산 0으로 transit 미시작, `max=0`, walk/transit 각 provider attempt, no-route, unavailable, in-flight/cache reuse를 실제 활성 adapter entry에서 검증한다.
- 각 fixture는 Edge invoke 횟수와 `newProviderAttemptCount`가 같고 상한을 넘지 않음을 비교한다. typed fail-closed receipt가 엔진 port까지 보존되고 malformed response만 `RouteProxyUnavailableError`가 되는지도 확인한다.
- `npm run test:typecheck`, 관련 API fixture, `npm test`, `git diff --check`를 실행한다. 완료 기록에는 변경 파일·유지 경계·각 mode 호출 수·다음 UI 주입 계약을 남긴다.

**다음 인계:** API-4-D 수락 뒤 UIUX `U-1-REC-01`이 Proxy 활성 추천 세션에 이 port를 주입한다. 사용자 설정·대시보드·키 작업은 필요 없다.

---

## 2026-08-29 — 외부 API 어댑터 완료: API-4-D 2-J receipt runtime port 연결

### 변경 파일과 목적

- `src/services/routeProxyClientAdapter.ts`: 활성 Proxy adapter가 기존 `getRoute()` 호환과 함께 `getRouteReceipt()`를 제공하도록 했다. 요청별 0/1/2 provider attempt 예산을 walk 시작 전과 transit 시작 전에 확인하며, cache·session·in-flight만으로 종료한 경우에만 `reused: true`를 만든다. 예산으로 다음 mode를 시작하지 못하면 `unavailable`로 끝난다.
- `src/services/routeProxyActivatedCourseAdapter.ts`: factory 반환 타입을 `CourseV1RouteAdapter & CourseV1RouteReceiptAdapter`로 고정했다. 구조가 유효한 `no_route`·`unavailable` Edge receipt는 엔진 port까지 보존하고, receipt가 없거나 형태가 틀린 응답·transport·Auth 실패만 기존 안전 typed 오류로 끝낸다.
- `test/activated-route-proxy-adapter.test.ts`: 실제 활성 factory entry에서 max=0/1/2의 Edge mode 호출 수, cache walk→transit 1회 provider attempt, no-route, fail-closed unavailable, in-flight/cache reuse를 고정 fixture로 검증했다.

### 유지한 경계

- 기존 `getRoute(): ExactRoute | null` 호환을 유지했고, legacy·근사·ODsay·TMAP fallback을 추가하지 않았다.
- 추천 엔진·UI·Edge handler·migration·카탈로그·Worker/Supabase 설정과 `.env*`는 수정하지 않았다. key/JWT/좌표/cache key/provider 원문을 공개 타입·오류·로그에 추가하지 않았다.
- 실제 Kakao·Supabase·Cloudflare 호출은 **0회**다.

### 검증 결과·다음 인계

- 활성 adapter 계약 fixture — 16/16 통과. `max=0`은 Edge 0회, `max=1`은 walk 1회 후 transit 0회, `max=2`는 walk·transit 각 1회만 시작함을 확인했다.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 118 통과, 1 skip.
- `npm test` — 101/101 통과.
- `git diff --check` — 통과.

다음 UIUX `U-1-REC-01`은 `createActivatedCourseV1RouteAdapter()`의 단일 반환값을 2-J의 `CourseV1RouteReceiptAdapter` port로 주입하면 된다. 이 작업은 후보 선택·순위·표시 정책을 변경하지 않는다.

### 통합·결정 수락 (2026-08-29)

API-4-D를 수락한다. 활성 adapter는 `CourseV1RouteAdapter & CourseV1RouteReceiptAdapter`를 함께 반환하며, 통합 확인 fixture에서 `max=0`은 Edge 0회, `max=1`은 walk만 1회, `max=2`는 walk·transit 최대 각 1회로 제한됐다. typed `no_route`·`unavailable` receipt도 engine port까지 보존되고, malformed/transport/Auth 실패만 안전 typed 오류로 끝난다. 관련 API fixture 33/33, `npm run test:typecheck`, `git diff --check`를 통과했다. **다음 작업 U-1-REC-01을 진행한다.**

---

## 2026-08-29 — 통합·결정 지시 API-4-E: 최신 Route Proxy receipt 계약 production 배포

### 발생 관찰과 판정

실기기 첫 추천에서 internal diagnostics가 `route_proxy_invalid_response`를 표시했다. 이는 CAPTCHA 실패가 아니라 CAPTCHA/익명 Auth 뒤 Route Proxy의 응답이 mobile의 현재 receipt 계약을 통과하지 못했다는 뜻이다. 제한 배포(`API-4-A-ACT-04-B C-1`)는 2026-08-28에 이뤄졌고, `API-4-C`의 `receipt`·`no_route`·fail-closed shape과 `API-4-D`의 소비 계약은 그 다음 2026-08-29에 추가됐다. 따라서 **최신 handler가 production Edge에 배포되지 않아 이전 `{ status, mode, totalMin }` 응답이 receipt 부재로 거절되는 것이 현재 최우선 가설**이다.

이 작업은 그 가설을 한 번의 code-only 배포와 제한된 재검증으로 판정한다. 앱 UI·추천 순위·카탈로그·DB migration·Cloudflare/Turnstile·Supabase Auth 설정을 바꾸지 않는다.

### 소유 범위와 금지 경계

외부 API 어댑터 세션은 `supabase/functions/route-proxy/`의 현재 artifact, 관련 API contract fixture, 이 작업기록만 다룬다. `src/engine/`, `src/ui/`, `src/data/`, migration/RPC 의미, `.env*`와 모든 Dashboard secret 값은 수정·출력하지 않는다. 새 Kakao/ODsay/TMAP 키·fallback·근사 경로를 추가하지 않는다.

### 수행 순서

1. 로컬 handler가 현재 `RouteProxyFunctionResponse` 계약을 만족하는지 고정 fixture로 먼저 확인한다. 모든 정상 Edge 응답은 `mode`, `status`, `receipt`를 가지며, `ok`는 양의 정수 `totalMin`과 `receipt.result = exact`, 정상 미경로는 `status = no_route`와 `receipt.result = no_route`, 설정·store·한도·provider 실패는 attempt 0 또는 1의 `receipt.result = unavailable`을 가져야 한다.
2. 대상 Supabase 프로젝트의 기존 `route-proxy` Function에 **현재 code artifact만** 배포한다. 기존 server secret, catalog snapshot, Function의 인증 설정은 보존하며 값·URL·token·provider key를 읽거나 기록하지 않는다. `anonymous-auth-cleanup`과 다른 Function은 배포하지 않는다.
3. 배포 CLI 성공만 기록한다. 새 provider 요청을 만들기 위한 curl·대량 smoke·cache 삭제는 금지한다.
4. 사용자가 같은 실기기·기존 anonymous session에서 공개 고정 입력을 **정확히 한 번** 다시 실행한다. 결과는 (a) 추천/검증 불가 UI 또는 (b) 비밀 없는 diagnostics enum만 기록한다. `route_proxy_invalid_response`가 사라지면 API-4-E의 receipt 배포를 수락한다. 계속 나오면 재시도하지 않고, 다음 작업에서 공개 synthetic segment의 Kakao 응답 **구조 키와 결과 상태만** 한 번 확인해 parser 계약을 보완한다. raw body·좌표·token·key·URL query는 기록하지 않는다.

### 완료 기준

- 관련 handler→mobile receipt fixture, `npm run test:typecheck`, `npm test`, `git diff --check`가 통과한다.
- 최신 `route-proxy` code artifact만 production에 배포됐고 secret/snapshot/auth 설정은 변경하지 않았음을 기록한다.
- 실기기 재검증은 기존 session 1회만 허용한다. 이 작업은 실제 provider 정확도·cache/budget 통계·ODsay 코드 제거·Proxy flag 기본값 변경의 수락이 아니다.

---

## 2026-08-29 — 외부 API 어댑터 완료: API-4-F non-2xx receipt 보존·원인 분리

### 변경 파일과 목적

- `src/services/routeProxyProductionReceipt.ts`: `FunctionsHttpError.context.json()`을 한 번만 읽고, 허용된 mode/status/receipt와 exact/no-route/unavailable 조합을 모두 통과한 body만 복원하는 좁은 production boundary를 추가했다. 손상·미지 status·receipt 부재·parse 실패는 `null`로 남긴다.
- `src/services/routeProxyProductionPorts.ts`: 복원된 safe typed non-2xx response만 `{ data, error: null }`로 activated adapter에 전달한다. relay/network/context 없음/손상 body는 기존 `data: null` 경로로 남아 `route_proxy_transport_failed`가 된다. error 원문은 로그·UI·throw message에 넣지 않는다.
- `supabase/functions/route-proxy/handler.ts`: 유효 request 처리의 최종 store/RPC 예외도 bare status 대신 입력 mode와 `store_unavailable` unavailable receipt를 반환하도록 보완했다.
- `test/route-proxy-production-ports.test.ts`: 401 rejected·429 limited·503 store unavailable 복원, context 없음·parse/shape 손상·relay/network 차단, handler 최종 catch, activated receipt port 보존을 고정 fixture로 추가했다.

### 관찰·유지한 경계

- Supabase CLI stable 채널에는 해당 Edge 요청을 body 비열람 상태로 status 범주만 조회하는 로그 subcommand가 없어, 2026-08-29 18:59 KST 단일 관찰은 **로그 접근 불가**로 기록한다. 요청/응답 원문·JWT·user ID·좌표·URL query·provider 정보는 조회하거나 기록하지 않았다.
- 추천 엔진·UI·카탈로그·migration/RPC 의미·`.env*`·Dashboard secret/URL/token·Cloudflare/Turnstile은 수정하지 않았다. 새 provider 호출·cache 삭제·ODsay fallback·실기기 반복 실행도 0회다.

### 검증·배포·다음 게이트

- API adapter/handler 고정 fixture — 31/31 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 101/101 통과.
- `git diff --check` — 통과.
- 최신 artifact를 production의 **`route-proxy` Function 하나만** code-only 배포했다(`index.ts`, `handler.ts`, `deadline.ts`). secret·snapshot·Auth 설정과 다른 Function은 변경·배포하지 않았다.

이제 사용자는 기존 anonymous session과 같은 공개 고정 입력으로 **정확히 한 번만** 재실행할 수 있다. 성공 화면 또는 안전 enum만 기록한다. 다시 `route_proxy_transport_failed`면 반복하지 않고 Edge runtime/relay 원인으로 별도 판정하며, typed `limited`/`rejected`/`store_unavailable`면 transport가 아닌 안전 검증 불가로 처리된 것을 수락한다.

---

## 2026-08-29 — 외부 API 어댑터 진행: API-4-E 최신 Route Proxy receipt artifact 배포

### 수행 결과

- 현재 `route-proxy` handler의 receipt 계약을 고정 fixture로 먼저 확인했다. 정상 `ok`는 `mode`·양의 정수 `totalMin`·`receipt.result = exact`, 정상 미경로는 `status = no_route`·`receipt.result = no_route`, valid request의 fail-closed 상태는 `receipt.result = unavailable`을 반환한다.
- Supabase CLI native 로그인 상태에서 production의 **`route-proxy` Function 하나만** 현재 code artifact로 배포했다. 업로드 대상은 `index.ts`, `handler.ts`, `deadline.ts`였으며, 배포 CLI가 성공을 반환했다.
- secret·catalog snapshot·Function Auth 설정·migration/RPC·Cloudflare/Turnstile·앱 UI·추천 엔진은 변경하거나 조회하지 않았다. `anonymous-auth-cleanup` 등 다른 Function도 배포하지 않았다.

### 검증 결과와 제한

- handler→mobile/API adapter 고정 fixture — 35/35 통과.
- 정적 Edge 계약 fixture — 8/8 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 101/101 통과.
- `git diff --check` — 통과.
- curl·cache 삭제·대량 smoke 및 새 Kakao/ODsay/TMAP provider 요청은 **0회**다.

### 남은 제한 재검증 (사용자 실기기 1회)

같은 실기기의 기존 anonymous session에서 공개 고정 입력으로 추천을 **정확히 한 번** 실행해야 한다. 결과는 추천/검증 불가 UI 또는 비밀 없는 diagnostics enum만 전달한다. `route_proxy_invalid_response`가 사라지면 API-4-E receipt 배포를 수락한다. 계속 표시되면 재시도하지 않고, 다음 작업에서 공개 synthetic segment의 Kakao 응답 구조 키·결과 상태만 1회 확인한다. raw body·좌표·token·key·URL query는 기록하지 않는다.

### 2026-08-29 — 통합·결정 검토: API-4-E 배포 조건부 수락

- **수락:** 최신 `route-proxy` artifact가 단일 Function으로 배포됐고, 현 handler의 `ok`/`no_route`/fail-closed receipt 형태와 관련 fixture 35/35, 정적 Edge 계약 8/8, typecheck·전체 테스트·diff 검사가 통과했다. secret·snapshot·Auth·Cloudflare·UI/엔진/DB를 바꾸지 않은 범위도 적절하다.
- **아직 수락하지 않은 것:** 최초 실기기 오류가 최신 production artifact로 해소됐는지는 아직 관찰되지 않았다. 따라서 API-4-E 전체 완료·Proxy 기본 활성화·ODsay 제거로 승격하지 않는다.
- **다음 한 번:** 같은 iPhone의 **기존 anonymous session**에서 서면역 복귀·개발 테스트 시각 15:00·도착 15:50이라는 기존 공개 입력을 한 번만 다시 실행한다. 결과 화면이 열리거나 `route_proxy_invalid_response`가 아닌 안전한 검증 불가 상태면 화면 문구/비밀 없는 enum만 기록한다. 같은 `route_proxy_invalid_response`면 즉시 중단하고 재시도하지 않는다. CAPTCHA 재인증·로그인·새 GPS/개인 장소 입력은 필요 없다.

### 2026-08-29 — 통합·결정 관찰: API-4-E 제한 재검증 실패

- 같은 기존 anonymous session의 허용된 한 번의 실기기 재검증에서 `route_proxy_invalid_response`는 사라졌지만, 대신 `route_proxy_transport_failed`가 표시됐다.
- 이는 CAPTCHA 토큰/익명 Auth/receipt 형식 자체의 실패로 확정하지 않는다. `supabase.functions.invoke()`는 HTTP 2xx가 아닌 Function 응답을 `data: null`과 `FunctionsHttpError`로 반환한다. 현재 production port는 이 경우 응답 본문을 읽지 않고 무조건 transport로 변환한다. 반면 Route Proxy는 `limited`(429), `rejected`(401), `store_unavailable`(503) 같은 **정상적인 typed receipt 응답**을 의도적으로 non-2xx로 반환한다. 따라서 실제 Edge가 계약대로 typed 실패를 반환했어도 mobile은 원인을 잃고 `route_proxy_transport_failed`로 오표시할 수 있다.
- 아직 확정하지 않은 부분은 해당 요청이 typed non-2xx였는지, Function 예외/relay/network 실패였는지다. 이 구분은 Edge의 해당 요청 로그에서 상태 범주만 확인해야 한다. token, 좌표, URL query, provider 응답 원문, secret은 조회·기록하지 않는다.
- API-4-E의 artifact 배포 사실은 유지하되, 실기기 runtime 수락은 보류한다. 추가 실기기 재시도는 금지하고 아래 API-4-F의 계약 보완 뒤 **한 번만** 새로 허용한다.

---

## 2026-08-29 — 통합·결정 지시 API-4-F: non-2xx Route Proxy receipt 보존과 원인 분리

### 목표

실기기의 `route_proxy_transport_failed`를 더 이상 CAPTCHA/네트워크 일반 오류로 뭉뚱그리지 않는다. Supabase Function의 계약상 typed non-2xx 응답은 검증된 `RouteProxyFunctionResponse`로 복원해 기존의 안전 reason(`limited`, `rejected`, `store_unavailable` 등)으로 전달하고, 실제 relay/network/예외/손상 응답만 `route_proxy_transport_failed`로 남긴다. 이 작업은 추천 순위·카탈로그·예산값·UI 문구·Auth 정책을 바꾸지 않는다.

### 소유 범위와 금지 경계

외부 API 어댑터 세션은 `src/services/routeProxyProductionPorts.ts`, `supabase/functions/route-proxy/handler.ts`, 관련 adapter/Edge contract test, 이 작업기록만 수정한다. `src/engine/`, `src/ui/`, `src/data/`, migration/RPC 구현, `.env*`, Dashboard secret/URL/token, Cloudflare/Turnstile 설정은 수정·출력하지 않는다. 새 provider 호출, cache 삭제, ODsay fallback, 대량 실기기 재시도도 금지한다.

### 수행 순서

1. **변경 경계·겹침 감사부터 수행:** 아래 흐름을 한 표로 작성하고, 각 연결에 대해 `변경 전 기대`, `이번 수정이 건드리는가`, `회귀 시험`을 명시한다. 이 표 없이 코드부터 고치지 않는다.

   `Cloudflare implicit widget → WebView token message → Supabase anonymous sign-in(신규 session만) → 기존 session 재사용 → Supabase Functions invoke → 2xx/non-2xx HTTP 변환 → authenticated Route Proxy invoker → receipt adapter → 2-J engine`

   특히 다음을 확인한다.
   - 이미 browser에서 성공한 CAPTCHA Worker의 implicit widget artifact·exact URL·WebView token bridge는 **수정 대상이 아니며**, API-4-F 배포가 Worker를 덮어쓰지 않는다.
   - 기존 anonymous session은 CAPTCHA/sign-in을 다시 호출하지 않고, 새 session만 one-shot CAPTCHA token을 Auth에 전달한다.
   - API-4-C/D/E가 추가한 receipt shape와 API-4-A-ACT-04-B의 typed reason 분기가 동시에 적용될 때, non-2xx HTTP가 `data: null`로 바뀌는 SDK 경계를 명시한다.
   - Proxy flag·route-proxy function name·Authorization 전달은 현재 수락된 UI runtime 계약 그대로이며, 이번 수정으로 legacy/ODsay fallback이 생기지 않는다.

   소스/현재 배포 이력에서 이 네 항목 중 불일치가 발견되면 수정 전에 `원인 후보·영향 범위·수정 필요 소유자`만 기록하고 통합·결정에 인계한다. secret·URL query·JWT·좌표·provider 원문은 표에 넣지 않는다.
2. **이미 발생한 단일 요청의 원인 분류:** Supabase Edge logs에서 실기기 재검증 시각(2026-08-29 약 18:59 KST)의 `route-proxy` 요청을 찾아 HTTP 상태 범주와 Function 예외 유무만 기록한다. 허용되는 기록은 `2xx / 401 / 429 / 503 / 5xx·relay·network` 중 하나와 예외 존재 여부뿐이다. 요청/응답 원문, 헤더, JWT, user id, 좌표, URL query, provider 정보는 열람·기록하지 않는다. 로그 접근이 불가하면 그 사실만 기록하고, 코드 계약 보완은 계속한다.
3. **production port 보완:** `supabase.functions.invoke()`의 `error`가 `FunctionsHttpError`이고 그 context가 JSON body를 제공하는 경우에만, body를 메모리에서 한 번 읽고 `RouteProxyFunctionResponse`의 허용 status/mode/receipt 형태로 좁게 검증한다. 검증을 통과한 typed response는 `{ data, error: null }`로 adapter에 넘긴다. context가 없거나 JSON 파싱/shape 검증에 실패하면 기존처럼 `data: null`을 반환해 transport로 fail-closed한다. error 원문을 로그·UI·throw message에 넣지 않는다.
4. **handler 예외 계약 보완:** 유효한 요청 처리의 최종 store/RPC 예외 catch도 bare `{ status: 'store_unavailable' }`가 아니라 입력 `mode`와 `receipt.result = unavailable`을 갖는 `routeResult(..., 'store_unavailable')`를 반환한다. 잘못된 method/body/request shape의 초기 4xx는 request mode가 확정되지 않으므로 typed receipt 복원을 요구하지 않는다.
5. **고정 계약·회귀 테스트:** 실제 Supabase/Kakao/DB 없이 다음을 추가한다.
   - 401 rejected, 429 limited, 503 store_unavailable의 `FunctionsHttpError.context.json()` safe body가 각각 typed data로 복원되고 activated adapter의 기존 안전 reason으로 매핑된다.
   - context 없음, JSON parse 실패, 허용하지 않은 status, receipt 누락/손상, relay/network throw는 모두 `route_proxy_transport_failed`다.
   - handler의 최종 catch는 `store_unavailable` receipt와 입력 mode를 보존한다.
   - 기존 session은 CAPTCHA/Auth 0회·authenticated invoke 1회, 신규 session은 one-shot token→Auth 1회 뒤 invoke 1회라는 기존 runtime fixture가 계속 통과한다. CAPTCHA Worker·WebView source를 수정하지 않아도 이 경계를 확인하는 기존 UI/API fixture를 함께 실행한다.
   - receipt `exact`/`no_route`/`unavailable`과 2-J의 attempt 0/1/2 보존 fixture가 계속 통과해, 이번 non-2xx 보완이 호출량 상한·후보 보충을 바꾸지 않음을 확인한다.
   - error body·token·좌표가 assertion output/로그에 나타나지 않는다.
6. `npm run test:typecheck`, 관련 API·UI·engine fixture, `npm test`, `git diff --check`를 실행한다. 새 provider HTTP 호출은 0회여야 한다.
7. 통과 후 **`route-proxy` code artifact 하나만** 배포한다. secret, catalog snapshot, Auth/Function 설정, migration, Cloudflare Worker와 다른 Function은 변경·배포하지 않는다.

### 완료·다음 게이트

- 위 고정 계약과 전체 테스트가 통과하고, 배포가 현재 `route-proxy` 하나에만 이뤄졌음을 기록한다.
- 단일 로그의 상태 범주가 기록되거나 로그 접근 불가가 명시된다. 이 작업은 provider 정확도·추천 품질·quota·ODsay 제거의 수락이 아니다.
- 완료 기록에는 `변경 파일`, `수정하지 않은 경계`, `겹침 감사 표의 결과`, `각 회귀 fixture 결과`, `새 provider 호출 수`를 반드시 같이 남긴다. 단순히 “테스트 통과”만 기록하면 완료로 보지 않는다.
- 완료 뒤에만 사용자가 기존 anonymous session으로 같은 공개 고정 입력을 **정확히 한 번** 실행한다. 화면 성공 또는 안전 enum을 기록하고, 다시 transport가 나오면 반복 실행하지 않고 Edge log/Function runtime을 별도 원인으로 판정한다.

---

## 2026-08-29 — 외부 API 어댑터 보완 완료: API-4-F 겹침 감사·회귀 게이트

### 변경 경계·겹침 감사

| 연결 | 변경 전 기대 | 이번 수정 | 회귀 확인 |
| --- | --- | --- | --- |
| Cloudflare implicit widget → WebView token message | exact Worker URL·implicit widget·top-level token bridge를 유지 | 수정하지 않음. Worker 배포도 0회 | `npm run test:ui` UCAP-01~08 통과 |
| WebView token → Supabase anonymous sign-in | 기존 session은 CAPTCHA/Auth 0회, 신규만 one-shot token 1회 | 수정하지 않음 | activated adapter API4ACT04BR-01/02 통과 |
| existing session → Functions invoke | 기존 JWT로 `route-proxy`만 호출 | non-2xx typed receipt 복원만 추가 | UREC/QA05 proxy runtime fixture 통과 |
| Functions 2xx/non-2xx → authenticated invoker | 2xx는 data, non-2xx typed receipt는 SDK error로 평탄화됨 | schema-valid `FunctionsHttpError` body만 data로 복원 | API4F-01/02/05 통과 |
| invoker → receipt adapter → 2-J | 동일 port의 attempt 0/1/2·no-route/unavailable 보존, legacy fallback 없음 | 수정하지 않음 | API4D·QA05 48 fixture 및 8 attempt/24 adapter 상한 통과 |

감사 결과 CAPTCHA Worker/WebView·Proxy flag·Function name·Authorization 전달·legacy/ODsay fallback에는 불일치나 수정 필요 소유자가 발견되지 않았다. 이번 artifact 배포는 `route-proxy`만 대상으로 하므로 Worker를 덮어쓰지 않았다.

### 추가 회귀 결과

- `npm run test:ui` — 122 통과, 1 skip. 기존 session CAPTCHA/Auth 0회, 신규 one-shot token 경계 및 WebView 안전 경계를 포함한다.
- Proxy 활성 UI→2-J runtime 및 API adapter fixture — 19/19 통과. 48 고정 입력, 최대 provider attempt 8회·adapter call 24회, cache/session 재사용, no-route 뒤 보충, legacy fallback 0을 포함한다.
- API-4-F 완료 기록의 31/31 adapter/handler fixture, typecheck, `npm test` 101/101, `git diff --check`, 신규 provider HTTP 0회 및 `route-proxy` 단독 code-only 배포는 앞선 동일 작업 기록대로 유지한다.

### 다음 한 번

기존 anonymous session의 같은 공개 고정 입력을 사용자가 **정확히 한 번** 실행한다. 성공 또는 안전 enum만 기록하며, 다시 `route_proxy_transport_failed`이면 재시도하지 않고 Edge runtime/relay로 별도 원인 판정한다.

### 2026-08-29 — 통합·결정 검토: API-4-F 조건부 수락

- **수락:** `FunctionsHttpError`의 schema-valid typed non-2xx body만 복원하고, context 없음·relay·network·손상 body는 transport로 fail-closed하는 경계가 구현됐다. 최종 store/RPC catch도 mode와 unavailable receipt를 보존한다.
- **겹침 확인:** CAPTCHA Worker/WebView, 신규 one-shot Auth, 기존 session 재사용, Proxy flag·Authorization, legacy/ODsay fallback, receipt attempt 0/1/2와 2-J 상한을 수정하지 않았으며, 해당 연결의 회귀 fixture가 통과했다.
- **통합 재검증:** API-4-F·activated adapter·QA-05 핵심 fixture 19/19, `npm run test:typecheck`, `npm test`, `npm run test:ui`(122 통과·1 skip), `git diff --check`를 통과했다. 실제 provider 호출은 새로 만들지 않았다.
- **남은 게이트:** 실제 production `route-proxy` code-only 배포가 실기기에서 이 SDK 경계를 통과하는지는 아직 한 번도 확인하지 않았다. 기존 anonymous session의 같은 공개 고정 입력으로 **정확히 한 번** 실행한다. 성공이면 API-4-F runtime을 수락한다. 안전 enum `route_proxy_limited`/`route_proxy_rejected`/`route_proxy_store_unavailable`이면 transport 평탄화는 해소된 것으로 수락하되 해당 상태의 운영 원인은 별도 기록한다. 다시 `route_proxy_transport_failed`이면 반복하지 않고 Function runtime/relay 원인으로 분리한다.
