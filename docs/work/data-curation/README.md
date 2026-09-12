# 데이터 정제 현재 작업

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
