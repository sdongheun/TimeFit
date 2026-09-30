# DATA-LIVE-CATALOG-PROJECTION-03 — TourAPI catalog 추천 입력 projection

상태: **순수 projection·fixture 감사 완료 / 추천 orchestrator 연결 대기**
기준: `DEC-LIVE-PUBLIC-DATA-01` 단계 B, `API-TOUR-LIVE-PROGRESSIVE-03`
작성일: 2026-09-21
외부 API·운영 DB 호출: **0회**

## 1. 결과

`src/data/liveCatalogProjection.ts`에 TourAPI `catalog` 결과와 검토된 로컬 장소 정책을 결합하는 순수 projection을 추가했다. 입력은 이미 정규화된 `TourLiveCatalogResult`이며 HTTP, 사용자 좌표, 운영시간 상세, 추천 순위, route 계산을 소유하지 않는다.

현재 369개 런타임 카탈로그 감사 결과는 다음과 같다.

| 항목 | 수 | projection 처리 |
| --- | ---: | --- |
| 전체 검토 장소 | 369 | 전부 결정적 상태 record 보존 |
| 대표 추천 분류 | 191 | 기존 등급 불변 |
| TourAPI exact 연결 | 139 | `contentId + contentTypeId` exact join만 허용 |
| TourAPI exact 연결 대표 | 98 | 기존 대표 기준 불변 |
| TourAPI 미연결 | 230 | `provider_out_of_scope`, live 후보 미승격 |
| 전통시장-only | 118 | `traditional_market_provider_out_of_scope`, 자동 연결·승격 금지 |

동일한 현재 원천 사실을 139개 TourAPI 연결에 넣은 fixture에서 `active_catalog 139 / provider_out_of_scope 230 / identity_conflict 0`이 나왔고, active 중 대표는 정확히 98개였다.

## 2. 변경 이력

- **이전 방식:** 번들 카탈로그가 원천 사실과 앱 파생 정책을 함께 들고 있고, progressive TourAPI `catalog` 결과를 369개 정책 장소에 투영하는 데이터 경계가 없었다.
- **발생한 문제:** 추천 orchestrator가 직접 원천 ID 결합·최신 제목/좌표 선택·분류/체류 보존을 모두 맡으면 이름/좌표 자동 매칭, 번들 사실 fallback, AI-Hub identity 재사용이 섞일 수 있다.
- **교체한 방식:** 데이터 계층에서 exact mapping, 동일성 이상 판정, live 사실 allowlist, 로컬 정책 projection을 순수·불변 결과로 만든다.
- **교체 이유:** 최신 원천 사실과 앱 파생 정책의 책임을 분리하고, 엔진은 검증된 `active_catalog` 후보만 소비하도록 하기 위해서다.
- **상태:** 현행 데이터 projection 구현 완료. public provider/orchestrator 연결은 추천 엔진 역할의 후속 작업이다.

## 3. 입력·출력 계약

### 입력

로컬 입력은 369개 장소에서 다음만 projection한다.

- 내부 ID와 순서
- exact TourAPI `contentId + contentTypeId` mapping 또는 provider 범위 밖 상태
- 기존 공식 장소 제목·검토 별칭·원천 좌표: live 동일성 이상 판정에만 사용
- 앱 파생 category/subCategory, 추천 분류, 장소 성격, 활동 유형, 최소·권장·최대 체류, 발견 eligibility, 재검토 기한
- `siteGroupId`, `siteRole`, `mergedPlaceIds`

AI-Hub 이름·좌표·장소별 체류값은 입력 타입과 출력에 없다. 카테고리 체류 근거가 이미 정제한 `shortStay` 정책만 보존된다.

live 입력은 `catalogPlaces`, `candidateStates`, `liveSourceSnapshotId`, `fetchedAt`, `unreviewedCount`만 읽는다. 원본 응답, 키, 사용자 정보, 사용자 출발·도착 좌표를 받거나 기록하지 않는다.

### 출력

- `candidates`: exact mapping과 동일성 gate를 통과한 `active_catalog`만 포함한다.
- `records`: 369개 전부에 `active_catalog | inactive | identity_conflict | provider_out_of_scope | source_unavailable` 중 하나를 결정적으로 기록한다.
- `facts`: live `title/address?/lat/lon/modifiedAt?` allowlist만 포함한다.
- `policy`: 로컬 category/subCategory, 분류, 체류, 장소 성격, 발견 eligibility, 재검토 기한을 그대로 보존한다.
- `relations`: 로컬 동일 단지·내부 역할·병합 ID를 그대로 보존한다.
- 결과 전체는 깊게 freeze되고 내부 ID/검토 순서로 정렬된다.

## 4. 필드 누락과 동일성 규칙

live `address`나 `modifiedAt`이 없으면 출력 필드도 없다. 번들 주소·수정일로 채우지 않는다. 추천 좌표와 표시에 필수인 `title/lat/lon`이 누락·무효이면 번들 값으로 복구하지 않고 `identity_conflict`로 제외한다.

승인된 현행 규칙을 그대로 적용했다.

- 같은 exact ID/type의 제목 변경만 또는 좌표 이동만 있으면 최신 일반 수정으로 허용한다.
- 새 제목이 기존 제목·검토 별칭과 달라도 좌표 이동이 1km 미만이면 일반 수정으로 허용한다.
- 검토 별칭이면 1km 이상 좌표 이동도 제목+좌표 복합 이상으로 보지 않는다.
- `contentTypeId` 변경은 항상 `review_required` 성격의 `identity_conflict`다.
- 미등록 제목과 1km 이상 좌표 이동이 함께 있으면 `compound_identity_change`로 제외한다.
- 공급자가 이미 `identity_conflict`로 판정한 장소, ambiguous/missing state, 중복 mapping도 추천 후보로 승격하지 않는다.
- `inactive`는 별도 상태로 보존하며 로컬 카탈로그로 되살리지 않는다.

신규 source ID는 이름·좌표 비교 자체를 하지 않는다. `unreviewedSourceCount` 안전 집계만 전달하고 새 ID의 제목 등 원천 내용은 projection 출력에 포함하지 않는다.

## 5. fixture·감사 범위

`test/live-catalog-projection.test.ts`의 비밀 없는 합성 fixture가 다음을 고정한다.

| fixture | 기대 결과 |
| --- | --- |
| 369개 실제 정책 기준선 | 전체369·대표191·TourAPI139·TourAPI 대표98·전통시장-only118 |
| 제목만 변경 | `active_catalog`, 최신 제목 사용 |
| 좌표만 변경 | `active_catalog`, 최신 좌표 사용 |
| 미등록 제목 + 1km 경계 | 999m 허용, 1000m부터 `compound_identity_change` |
| content type 변경 | `identity_conflict`, 후보 제외 |
| provider conflict | `identity_conflict`, 후보 제외 |
| inactive | `inactive`, 후보 제외, 번들 부활 금지 |
| 신규 source ID | 자동 매칭·승격 금지, 원천 제목 출력 금지 |
| optional live 필드 누락 | 필드 생략, 로컬 사실 fallback 금지 |
| 필수 live 필드 누락/무효 | fail-closed `identity_conflict` |
| 입력/API 순서 역전 | byte-equivalent 구조 결과, stable ordering |
| 불변성·AI-Hub 경계 | deep frozen, AI-Hub identity 출력 0 |
| unavailable | 후보 0, stale 원천 사실 반환 금지 |

## 6. 추천 세션 인계

추천 orchestrator는 다음 순서만 수행하면 된다.

1. `createRuntimeLiveCatalogInputs()`에서 exact 승인 참조 139개를 얻어 API `catalog` 요청 입력을 구성한다.
2. `projectTourLiveCatalog()` 결과의 `active_catalog` 후보에 있는 **live 좌표만** 사용자 수동 출발·도착 좌표와 메모리에서 비교해 상세 queue를 만든다.
3. `inactive`, `identity_conflict`, `provider_out_of_scope`, `source_unavailable`은 상세·route 대상으로 보내지 않는다.
4. category/subCategory, 체류, classification, site group은 projection 값을 그대로 다음 단계에 전달한다.
5. 운영시간은 이 projection에 없으므로 progressive `detail_batch` 결과로만 검증한다. 로컬 운영시간을 합성하지 않는다.
6. API가 반환한 순서나 `nextBatchMax`를 추천 순위·충분성으로 해석하지 않는다.

이 모듈은 public `CourseV1CandidateProvider`를 교체하거나 호출하지 않는다. 실제 연결 전까지 App Store/현재 public 추천 경로는 그대로다.

## 7. 변경·검증·남은 위험

### 변경 파일과 목적

- `src/data/liveCatalogProjection.ts`: 369개 로컬 정책 입력 생성과 TourAPI catalog 순수 exact projection.
- `test/live-catalog-projection.test.ts`: 실제 기준선과 제목·좌표·복합 이상·inactive·conflict·신규·누락·결정성 fixture.
- 이 문서와 데이터 작업 README: 데이터 계약과 추천 세션 인계.

### 변경하지 않은 공개 계약·정책 경계

`src/data/busan_poi_catalog.json`, 원본 JSON, UI, 추천 엔진, 외부 API adapter/Edge, DB, 배포, 중앙 정책·마스터 체크박스를 수정하지 않았다. 사용자 좌표·HTTP·운영시간 상세·추천 순위·route 계산을 추가하지 않았다. stage/commit/push와 실제 외부 호출도 하지 않았다.

### 실행 테스트

- `npx tsx --test test/live-catalog-projection.test.ts` — 7/7 통과.
- `npm run test:typecheck` — 병렬 추천 엔진 작업이 안정화된 뒤 재실행해 통과.
- `npm test` — 575/575 통과.
- `npm run test:ui` — 824건 중 823 통과·기존 skip 1·실패 0.
- `git diff --check` — 통과.

### 다음 결정·위험·재현 조건

- 추천 orchestrator는 이 projection과 별도 `detail_batch` 누적 결과를 같은 `liveSourceSnapshotId`로 묶어야 한다.
- `source_unavailable`일 때 현재 public UI가 stale 성공으로 복귀하지 않도록 typed 실패 연결이 필요하다.
- provider의 정규화 validator를 우회한 malformed fixture도 이 경계에서 fail-closed하지만, 운영 raw schema 정확성은 실제 제한 호출/QA가 별도로 확인해야 한다.
- 부산 live 전환 전에는 부산 전용 112개와 전통시장-only 118개를 이 TourAPI projection으로 최신화했다고 표시하면 안 된다.
