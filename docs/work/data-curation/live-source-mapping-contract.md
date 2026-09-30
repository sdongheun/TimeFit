# DATA-LIVE-MAPPING-CONTRACT-02 — 다중 원천 필드 결합·동일성 검토 계약

상태: **데이터 계약·20곳 전수 검토·fixture 완료 / 통합 수락 요청**
기준: `docs/work/integration-decision/live-public-data-transition-master-plan.md` 단계 A2 후속
작성일: 2026-09-21
외부 API·운영 DB 호출: **0회**

## 1. 결론

TourAPI와 부산 공식 원천에 모두 연결된 20곳을 전수 확인했다. 현재 런타임의 제목·주소·좌표·TourAPI 유형은 20곳 모두 저장된 기존 TourAPI snapshot과 일치한다. 부산 공식 원천은 21개 ID 링크이며, 제목은 현재 제목과 정규화 일치 13개·기존 검토 별칭 일치 8개다. 좌표 차이는 19개 링크가 100m 이하, 2개가 100m 초과 250m 이하이고 최댓값은 178m다.

이 결과로 공급자 전체에 하나의 우선순위를 주지 않았다. TourAPI 1차에서는 완결된 부산 활성 목록에서 확인한 활성/비활성 membership, 수정 사실과 공통 필드만 동일성 gate 뒤 세션 snapshot에 적용한다. 부산 설명처럼 부산에만 있는 기존 검토 필드는 그대로 보존하지만, 저장된 부산 원천을 `최신`이라고 표기하지 않는다. 분류·세부분류·체류·추천 등급·동일 단지 관계·사진 권리 상태는 원천 실시간 값으로 바꾸지 않는다.

기계 판독 기준은 `data/processed/review/live_source_overlap_field_contract.json`, 테스트 입력은 `data/processed/review/live_source_mapping_transition_fixture.json`, 재현 감사 결과는 `data/processed/review/live_source_mapping_contract_audit.json`이다.

## 2. 중복 20곳 전수 결과

아래 거리는 현재 런타임/TourAPI 저장 좌표와 부산 저장 좌표의 차이다. 이는 서로 다른 공급자의 **저장 snapshot 비교**이며, 현재 시점의 실제 이동이나 최신성 증거가 아니다. `alias`는 런타임의 기존 검토 별칭에 정확히 포함된 명칭이다.

| 내부 ID | 현재 제목 | TourAPI ID | 부산 원천 ID | 부산 제목 관계 | 최대 좌표 차이 |
| --- | --- | --- | --- | --- | ---: |
| `poi_13` | 부산 자갈치시장 | `132190` | shopping:412 | alias | 5m |
| `poi_177` | 부산 치유의 숲 | `2660770` | attraction:848 | exact | 57m |
| `poi_187` | 색채마을 | `3064931` | attraction:2106 | exact | 6m |
| `poi_19` | 동백공원 | `128810` | attraction:2274 | alias | 34m |
| `poi_225` | 친환경 스카이웨이 전망대(이바구길) | `2656194` | attraction:1868 | alias | 133m |
| `poi_237` | 화명수목원 | `2756696` | attraction:457 | exact | 178m |
| `poi_245` | 누리마루 APEC하우스 | `1918263` | attraction:2121 | exact | 7m |
| `poi_25` | 부산시립미술관 | `130166` | attraction:289 | exact | 38m |
| `poi_287` | 구포시장 | `1250885` | shopping:363 | exact | 61m |
| `poi_3` | 신세계백화점 센텀시티점 | `767084` | shopping:548 | exact | 64m |
| `poi_4` | 부평깡통시장 | `1878218` | shopping:400 | exact | 69m |
| `poi_403` | 모모스커피 본점 | `2832729` | food:127, food:1634 | alias, alias | 6m |
| `poi_427` | 브레이크인커피 | `2853145` | food:1464 | exact | 10m |
| `poi_70` | 벡스코(BEXCO) | `130668` | attraction:420 | alias | 16m |
| `poi_78` | 고래서이뻐 | `3336600` | shopping:2581 | exact | 3m |
| `poi_89` | 범어사 성보박물관 | `2554111` | attraction:402 | alias | 53m |
| `poi_90` | 부산 영화의 전당 | `2456837` | attraction:421 | alias | 29m |
| `poi_92` | 부산근현대역사관 본관 | `3083767` | attraction:1881 | exact | 22m |
| `poi_94` | 부산타워 | `1277679` | attraction:550 | exact | 5m |
| `poi_96` | 부전마켓타운 | `132188` | shopping:327 | exact | 39m |

`poi_225` 133m와 `poi_237` 178m는 양쪽 공급자의 저장 좌표 차이다. 이를 TourAPI content ID 재사용으로 판정하지 않았고, 부산 좌표로 자동 교체하지도 않았다. 이후 같은 TourAPI ID의 live 좌표가 기존 TourAPI 좌표에서 100m를 넘겨 이동하면 별도의 검토 규칙을 적용한다.

부산 21개 행 중 운영시간 원문은 20개, 설명 원문은 21개에 있다. 이는 부산 2차 live 가용성을 뜻하지 않는다. 단계 1에서는 기존에 정확한 source ID로 연결·정제된 설명 등 부산 전용 snapshot 필드만 보존한다.

## 3. 필드별 결합 계약

| 필드군 | TourAPI 1차 | 부산 저장 snapshot | 충돌 처리 |
| --- | --- | --- | --- |
| `availability/deleted/modifiedAt` | 완결 목록 membership에서 활성/비활성을 판정하고 수정 시각 적용 | 최신성 신호로 사용 금지 | 완결 목록에서 비활성으로 확인된 장소는 세션 제외, 정적 값으로 부활 금지 |
| `title/addr1/lat/lon` | 동일성 gate 통과 후 응답에 있는 필드만 overlay | provenance와 함께 보존 | 단계 1 세션 공통값은 TourAPI live, 부산 값은 `static_snapshot` |
| TourAPI content type | 응답에 있으면 동일성 gate 후 적용 | 해당 없음 | 유형 변경이면 검토 대기, 앱 category 자동 변경 금지 |
| `operatingHours` | 선택 오퍼레이션이 현재 값을 돌려줄 때만 사용 | 저장 원문 보존, 최신 주장 금지 | 두 원문을 합치거나 제품 창으로 대체 금지 |
| `detailDescription` | 삭제·합성하지 않음 | 기존 exact-ID 검토값 보존 | TourAPI 공통 필드와 독립 유지 |
| `category/subCategory` | 유지 | 유지 | 장소명·유형 변경으로 자동 재분류 금지 |
| 체류·AI-Hub 근거 | 유지 | 유지 | 기본값 합성·교체 금지 |
| 추천 등급·발견 계약 | 유지 | 유지 | 신규·수정 사실로 자동 승격 금지. 단, 삭제/동일성 충돌은 세션 제외 가능 |
| `aliases/mergedPlaceIds/siteGroupId/siteRole` | 동일성 검토 입력으로 사용하고 유지 | 유지 | 다른 내부 관계를 가리키면 재연결하지 않고 검토 |
| 사진 URL·근거 | exact 권리 연결 URL만 유지 | exact 권리 연결 URL만 유지 | 새/변경 URL은 권리를 추정하지 않고 기본 이미지 |
| `mapVerification` | 유지 | 유지 | TourAPI·부산 사실로 덮지 않음 |

빈 optional 필드는 삭제 지시가 아니다. live 응답에 없는 필드는 저장값을 지우지 않는다. 완결된 활성 목록에서 해당 승인 ID가 없다고 확인된 경우만 비활성으로 보고 세션에서 제외하며, `detailIntro2` 실패나 partial snapshot 누락은 삭제로 해석하지 않는다.

## 4. 기존 ID 제목·좌표 이동 검토 규칙

다음은 adapter 계약 테스트에 쓰기 위한 **데이터 세션 제안값**이다. 제품 추천 정책이 아니며 UI·엔진·API adapter·DB 코드에는 넣지 않았다.

자동 overlay는 모두 충족할 때만 허용한다.

1. 공급자 source ID가 기존 검토 mapping과 exact 일치한다.
2. live 제목 정규화값이 현재 제목 또는 기존 검토 별칭과 일치한다.
3. 좌표가 반환됐다면 유효하고 기존 mapped 장소에서 100m 이하이다.
4. content type이 반환됐다면 기존 값과 같다.
5. source ID가 같은 내부 ID를 계속 가리키며 다른 `mergedPlaceIds`/`siteGroupId` 관계로 옮겨가지 않는다.

하나라도 어기면 `review_required`이고 충돌 live overlay는 세션에 넣지 않는다. 특히 미등록 제목과 250m 초과 이동의 결합, 제목 유지 여부와 무관한 1km 초과 이동, 유형 변경에 제목·좌표 변화가 함께 있으면 `probable_id_reuse` 신호를 남긴다. 검토 중에는 기존 mapping을 자동 재연결하지 않는다.

제목 정규화는 NFKC, 소문자화, 공백·문장부호·기호 제거만 사용한다. 토큰 유사도나 이름 일부 일치로 별칭을 새로 만들지 않는다. 거리는 haversine meter다.

## 5. fixture 보강

정규화 경계 fixture 9개를 만들었다. 실제 API 응답·키·사용자 위치는 포함하지 않는다.

| fixture | 검증 |
| --- | --- |
| `LIVE-MAP-NEW-01` | 신규 ID 검토 대기, 자동 분류·체류 합성 금지 |
| `LIVE-MAP-DELETED-01` | 완결 목록에서 비활성/삭제 확인 시 세션 제외, 정적 부활 금지 |
| `LIVE-MAP-TITLE-ALIAS-01` | 검토 별칭으로 제목 변경 시 제한 overlay |
| `LIVE-MAP-TITLE-UNKNOWN-01` | 미등록 제목 변경 검토 대기 |
| `LIVE-MAP-COORD-SMALL-01` | 100m 이하 좌표 변경 제한 overlay |
| `LIVE-MAP-COORD-LARGE-01` | 100m 초과 좌표 변경 검토 대기 |
| `LIVE-MAP-ID-REUSE-01` | 제목·좌표·유형 복합 급변 ID 재사용 의심 |
| `LIVE-MAP-BOTH-CONFLICT-01` | TourAPI live 공통 필드와 부산 저장 전용 필드의 필드별 결합 |
| `LIVE-MAP-PHOTO-RIGHTS-01` | 권리 mapping 없는 새 사진 URL 기본 이미지 |

## 6. 118개 전통시장-only 경계

전통시장 표준 원천만 연결된 118개는 `review_required_provider_out_of_scope`를 그대로 유지한다. TourAPI 단계 1 최신성 대상으로 표시하지 않으며, 신규 TourAPI ID를 이름·좌표로 찾아 자동 연결하지 않는다. 추천 등급·운영시간·사진 상태도 이번 작업에서 바꾸지 않았다.

## 7. 최소 API·엔진 인계 계약

현재 작업트리의 어댑터는 `areaBasedList2 + detailIntro2`, `ready|partial|unavailable`, 그리고 장소별 `contentId/contentTypeId/title/address?/lat/lon/modifiedAt?/opening`을 제공한다. 데이터 작업에서는 이 코드나 타입을 변경하지 않았다.

다만 현재 `snapshot.places`에는 활성 승인 ID 중 `detailIntro2`까지 성공한 장소만 있고, `partial.failures`는 실패한 content ID를 전달하지 않는다. 따라서 결합 계층은 partial에서 빠진 승인 ID가 실제 비활성인지, 활성이나 상세 조회만 실패했는지 구분할 수 없다. 구현 연결 전 아래 둘 중 하나가 필요하다.

- 완결 목록에서 얻은 `activeApprovedIds`와 content-ID별 상세 실패를 별도 제공한다.
- 승인 ID마다 `active_ready | active_detail_failed | inactive` 상태를 제공한다.

정규화된 `LIVE-MAP-DELETED-01`은 위 구분이 끝난 뒤의 `inactive`를 뜻하며, partial 상세 실패를 삭제로 간주하라는 fixture가 아니다. API adapter는 그 밖에도 공급자, 조회 시점, 실제 필드 존재 여부를 보존해야 한다. 빈 optional 필드와 빈 문자열을 구분해야 한다.

결합 계층은 source ID exact mapping과 위 동일성 진단 결과, 필드별 provenance(`tourapi_live|busan_static_snapshot|app_derived`), review disposition을 세션 snapshot에 남겨야 한다. 추천 엔진은 기존 `contentId`, category/subCategory, 체류, classification, discovery, 관계 필드를 그대로 받고, 비활성 확인·충돌 장소가 세션 후보에서 제외됐다는 결과만 소비하면 된다. 엔진이 공급자 우선순위나 ID 재사용 임계값을 알아서는 안 된다.

## 8. 변경·검증·인계

### 변경 파일과 목적

- `scripts/build_live_mapping_contract.mjs`: 중복 20곳 전수 비교, 필드 계약, 검토 규칙, fixture, 기준선 보존을 결정적으로 생성·검증.
- `data/processed/review/live_source_overlap_field_contract.json`: 20곳/21개 부산 링크의 필드별 비교와 단계 1 결합 계약.
- `data/processed/review/live_source_mapping_transition_fixture.json`: 신규·삭제·제목·좌표·ID 재사용·양쪽 원천 충돌·사진 권리 fixture 9개.
- `data/processed/review/live_source_mapping_contract_audit.json`: 수치·불변 조건·SHA-256 재현 결과.
- 이 문서와 데이터 작업 README: 결과와 후속 계약 인계.

### 변경하지 않은 공개 계약·정책 경계

런타임 카탈로그 369개, 내부 ID, category/subCategory, 체류, 등급, 좌표, 운영시간, 설명, 사진과 권리 상태를 수정하지 않았다. UI, 추천 엔진, API adapter, DB, 중앙 정책 문서, 마스터 체크박스도 수정하지 않았다. 실제 외부 호출·stage·commit·push는 하지 않았다.

### 실행 명령과 결과

- `node scripts/build_live_mapping_contract.mjs` — 통과. 중복 20곳/부산 링크 21개, 필드 계약 13행, fixture 9개, 전통시장-only 118개 유지, 외부 호출 0회.
- 생성 스크립트 연속 실행 및 산출물 SHA-256 비교 — 세 파일 모두 동일, 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 824건 중 823 통과·1 skip·실패 0.
- `npm test` — 575/575 통과.
- `git diff --check` — 통과.

### 통합 세션 결정 필요 사항

1. 100m 일반 검토선, 250m 복합 ID 재사용 신호, 1km 단독 강한 신호를 adapter 계약 테스트 기준으로 수락할지 결정.
2. API adapter가 완결 목록의 비활성 ID와 content-ID별 상세 실패를 구분하도록 위 최소 계약 중 하나를 선택하고 fixture를 연결.
3. 부산 2차 live adapter를 시작할 때 같은 필드 계약을 유지하되, 부산 live와 TourAPI live가 동시에 최신인 경우의 조회 시점·필드별 충돌 로그 정책을 별도 확정.
4. 전통시장-only 118개는 별도 공급자 범위가 생기기 전까지 provider out-of-scope로 유지.
