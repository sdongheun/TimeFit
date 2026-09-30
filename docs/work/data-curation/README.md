# 데이터 정제 현재 작업

## 최신 완료 요청 — DATA-LIVE-NEARBY-READMODEL-01

[주변 둘러보기 비저장 live read model](live-nearby-read-model-01.md). 단일 facade snapshot과 exact 연결만으로 정보 탐색용 최대 251곳을 순수 투영하고, 전통시장-only 118곳은 `provider_out_of_scope`로 유지한다. 추천의 시간·운영시간 gate나 저장 사실 fallback을 적용하지 않는다. UI 연결·독립 세션 수명/재시도 UX는 후속 결정이다.

## 최신 완료 요청 — DATA-LIVE-SESSION-BRIDGE-03

[facade token-free 결과의 데이터 projection bridge](live-session-bridge-03.md). exact 승인 입력 `Tour 139 / 부산 ID 85·19·29 / verified 사진 85·16·0`을 결정적으로 만들고, catalog `ready/partial/unavailable`, Tour 불가 fallback snapshot, detail `ready/failed/missing/review`를 기존 projection·normalizer에 연결한다. 원천 운영시간 값과 token은 출력하지 않으며 public controller는 아직 연결하지 않았다.

## 최신 완료 요청 — DATA-BUSAN-LIVE-PROJECTION-02-R1

[부산·TourAPI 다중 원천 live projection](busan-live-projection-02.md). 대표 분할 `TourAPI-only 82 / 부산-only 93 / 양쪽 16`을 보존하고, 양쪽 active에서는 TourAPI 공통 사실·운영시간과 부산 설명을 선택한다. 5~178m 좌표·표기 차이는 더 이상 제외 사유가 아니며 source ID/type/alias/1km compound identity 충돌만 review한다. 부산 운영시간 저장 감사 `exact reuse 36 / safe parse 21 / needs_review 53`과 stale fallback 금지는 유지한다.

## 최신 완료 요청 — DATA-BUSAN-LIVE-MAPPING-01

[부산 공식 3개 원천 live exact mapping 계약](busan-live-mapping-01.md). 명소·맛집·쇼핑 132곳/133링크와 대표 109곳(부산-only 93, TourAPI 중복 16)을 `provider + UC_SEQ`로 고정했다. 저장 근거가 없는 단건 조회·pagination 세부는 `unknown`으로 남기고, 완결 목록 삭제 판정과 TourAPI+부산 20곳의 필드별 충돌 계약을 API 역할에 인계했다.

## 최신 완료 요청 — DATA-LIVE-OPENING-NORMALIZER-04

[TourAPI live 운영시간 보수 정규화](live-opening-normalizer-04.md). 대표 TourAPI 연결 98개의 저장 근거를 전수 감사해 `exact-reviewed reuse 76 / safe runtime parse 6 / needs_review 16`을 산출했다. live 원문이 exact 검토 근거와 같을 때만 기존 windows를 재사용하고, 명확한 상시·단일 시간/요일·매일 자정 넘김만 새로 구조화한다. 문의·상이·복수 예외·휴무 충돌·행사기간 밖은 fail-closed하며 public openingGate 연결은 추천 엔진 후속 작업이다.

## 최신 완료 요청 — DATA-LIVE-CATALOG-PROJECTION-03

[TourAPI catalog 추천 입력 projection](live-catalog-projection-03.md). 정규화된 catalog 최신 사실을 369개 검토 장소와 exact `contentId + contentTypeId`로만 결합하고, 대표 191개·TourAPI 연결 대표 98개·전통시장-only 118개 기준선을 고정했다. 제목/좌표 일반 수정은 허용하되 유형 변경 또는 미등록 제목+1km 이동 복합 이상은 `identity_conflict`로 제외하며, live 누락 필드를 번들 사실로 채우지 않는다. public provider/orchestrator 연결은 추천 엔진 역할의 후속 작업이다.

## 최신 완료 요청 — DATA-LIVE-MAPPING-CONTRACT-02

[다중 원천 필드 결합·동일성 검토 계약](live-source-mapping-contract.md). TourAPI+부산 중복 20곳을 전수 확인하고 단일 공급자 우선순위가 아닌 필드별 단계 1 계약을 만들었다. 기존 ID 제목·좌표 이동/ID 재사용 검토선과 신규·삭제·양쪽 원천 충돌 fixture를 추가했으며, 전통시장-only 118개는 provider out-of-scope로 유지했다. 마스터 체크박스는 통합 역할 수락 전까지 변경하지 않는다.

## 최신 완료 요청 — DATA-LIVE-SOURCE-INVENTORY-01

[실시간 원천 전환 A1 조사 인계](live-source-inventory.md). 런타임 369개를 내부/TourAPI/부산 공식/전통시장 원천 ID로 전수 매핑하고, 필드 provenance manifest와 신규·수정·삭제·ID 재사용 최소 fixture를 만들었다. 마스터 체크박스는 통합 역할 수락 전까지 변경하지 않는다.

## 최신 완료 — DATA-PLACE-PHOTO-ALL-01

[저장된 장소 사진 203개 데이터 인계](all-place-photo-rollout.md). 기존 `verified` 101개를 그대로 보존하고 부산 쇼핑 29개·TourAPI 73개를 `operator_approved`로 분리해 런타임 카탈로그에 전달했다. 권리·라이선스 검증으로 승격하지 않았으며, 화면 표시는 후속 `U-PLACE-PHOTO-ALL-01`이 필요하다.

## 최우선 — DATA-RELEASE-ASSETS-01

[출시 실행 명령](../integration-decision/release-execution-wave.md)의 해당 절 실행. 현행 사진 근거·표시·fallback 감사만 수행. 미확인 사진 전량 확보와 카탈로그 재설계를 출시 선행조건으로 만들지 않는다.

## 최신 실행 — DATA-PLACE-PHOTO-RECHECK-01

[보류 사진 권리 재조사](place-photo-recheck.md). 약70여개라는 과거 수를 현재 대상으로 재집계하고 카드/원형 지도 마커별 조건을 공식 근거로 확인한다. 안전하게 표현 가능한 허용 사진만 기존 빌드로 반영한다. UI 최종 다듬기와 병렬 가능, 미확인 허용 금지.

## 2026-09-07 최신 작업

최신 후속: [카페·문화시설 세부분류](release-personalization-data.md)의 후속 실행 절은 **DB B와 병렬 실행 가능**. 기존 사진/키 전달 완료 재사용, 근거 있는 missing 보완만 시행한다.

[DATA-RELEASE-PERSONALIZATION-01](release-personalization-data.md): **지금 실행 가능**. 권리 미확인 사진 안전 비노출·기본 이미지 fallback, 정확한 복합 카테고리 provider 투영. 원본 재분류 추정 금지.

[DATA-PLACE-DETAIL-01 — 장소 상세용 공식 설명 snapshot](place-detail-snapshot.md)은 **실행 가능**이다. 전체 지도형 상세가 live API 0회로 사용할 optional `detailDescription?: string`만 기존 공식 sourceEvidence의 정확한 연결에서 결정적으로 생성한다. 설명이 없으면 필드를 생략하고 UI는 `상세 설명 없음`을 표시한다. UI 구현과 병렬 가능하지만 `src/data/busan_poi_catalog.json`은 이 데이터 세션만 수정한다.

현재 데이터 보강 작업 [DATA-SUPPLY-01 — 부족 생활권 대표 후보 제한 보강](targeted-representative-supply.md)은 수락됐다. 기존 비대표 22개를 공식 근거로 재검토해, 부평깡통시장 1개만 `representative_standard`로 제한 승격했다. 현재 런타임 369개는 `representative` 191·`area_access` 2·`conditional` 176이며, 이 결과가 네 생활권의 공급 부족을 해결했는지는 [QA-SUPPLY-01](../qa-release/targeted-supply-recheck.md)에서 별도로 판단한다. [DATA-MARKET-01 — 조건부 시장·거리 발견 계약](conditional-market-candidates.md)은 수락됐다. `conditional_more` 178개를 감사해 시장·거리 권역형 142개에만 `conditionalVisit`을 투영했고, 36개는 시설·도매/새벽·장기 이용 등으로 제외했다. 이 필드는 10:00–18:00 정보 확인 창일 뿐 대표 등급·운영시간·실제 경로 추천을 바꾸지 않는다. [DATA-AREA-01 — 권역형 발견 후보·접근시간 계약](area-discovery-candidates.md)도 수락됐다. provider는 `area|outdoor|facility` 장소 성격까지 명시 전달한다. 새 작업 전에는 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, 관련 `docs/02_data/` 근거 문서와 `docs/03_product/추천로직.md`의 데이터 절만 읽는다.

B12 internal 비교는 카탈로그·분류·운영시간을 변경하지 않는다.
