# DATA-LIVE-SOURCE-INVENTORY-01 — 실시간 원천 전환 A1 조사 인계

상태: **A1 조사·manifest·최소 fixture 완료 / 통합 수락 요청**  
기준: `docs/work/integration-decision/live-public-data-transition-master-plan.md` 단계 A1  
작성일: 2026-09-21  
시작/종료 HEAD: `96c5512` / `96c5512`  
외부 API·운영 DB 호출: **0회**

## 1. 조사 범위와 현재 경로

현재 공개 추천은 `src/ui/recommendation/v1Session.ts`가 매 추천 시작 때 `createCourseV1CandidateProvider()`를 만들고, provider가 번들 `src/data/busan_poi_catalog.json`과 별도 구조화 운영시간 파일을 동기식으로 결합한다. 장소 상세·주변 둘러보기·결과·코스 확인·홈·활동 기록 화면도 번들 카탈로그를 직접 import한다. Route Proxy의 공개 좌표 snapshot도 같은 번들 카탈로그의 대표 장소 ID·좌표로 만들어진다.

따라서 실시간 전환 시 추천 provider만 바꾸면 상세·주변·코스 확인이 같은 세션 snapshot을 보지 못할 수 있다. 이 사실은 구조 변경 요구가 아니라 A2/B/C 단계가 함께 해결해야 할 소비 경계 위험으로 기록한다.

## 2. 369개 장소 원천 ID 전수 매핑

전수 행은 `data/processed/review/live_source_place_mapping_manifest.json`에 내부 ID, 분류, TourAPI ID, 부산 명소·맛집·쇼핑 ID 배열, 전통시장 표준 ID, 원천 조합, 결합 처분을 기록했다. 이름·좌표 유사도로 새 연결을 만들지 않았으며 현재 연결 ID의 공급자 내 재사용은 0건이다.

| 항목 | 정확한 수 | 해석 |
| --- | ---: | --- |
| 런타임 장소 / 고유 내부 ID | 369 / 369 | 누락·중복 내부 ID 0 |
| TourAPI 연결 장소 / 고유 content ID | 139 / 139 | `tourapi_aihub` 32, `tourapi_fallback` 107 |
| 부산 공식 연결 장소 | 132 | 명소 85곳, 맛집 18곳, 쇼핑 29곳; 공급자 간 장소 중복 포함 |
| 부산 공식 ID 링크 | 133 | 명소 85, 맛집 19, 쇼핑 29. `poi_403`만 맛집 ID `127`, `1634` 두 개를 보존 |
| TourAPI와 부산 공식 모두 연결 | 20 | ID exact 결합은 가능하나 필드 충돌 우선순위 미확정 |
| TourAPI 또는 부산 공식 연결 합집합 | 251 | TourAPI 1차 또는 부산 2차 실시간 후보 |
| 전통시장 표준만 연결 | 118 | 이번 TourAPI/부산 전환 공급자 범위 밖, 검토 필요 |
| 원천 identity가 전혀 없는 장소 | 0 | 현재 369개 전부 sourceEvidence 보유 |

결합 처분은 다음과 같다.

| 처분 | 수 | 의미 |
| --- | ---: | --- |
| `auto_join_exact_tourapi` | 119 | TourAPI ID 하나로 exact 결합 가능 |
| `auto_join_exact_busan_phase2` | 112 | 부산 공식 ID로 exact 결합 가능, 단계 F 전까지 실시간화하지 않음 |
| `auto_join_exact_multi_source_conflict_policy_pending` | 20 | 양쪽 ID는 exact지만 원천 사실 충돌 규칙 확정 전 자동 필드 병합 금지 |
| `review_required_provider_out_of_scope` | 118 | 전통시장 표준만 연결. 현 단계 자동 실시간 결합 대상 아님 |
| `forbidden_missing_source_identity` | 0 | 현재 없음. 이후 신규 ID는 이 상태가 아니라 신규 검토 대기로 분리 |

부산 공식 ID는 저장된 명소 213행·맛집 437행·쇼핑 55행의 `UC_SEQ`에 모두 존재한다. TourAPI 런타임 `tourapiContentId` 139개는 각 행의 `tourapi_aihub|tourapi_fallback` sourceEvidence와 모두 일치한다.

## 3. 런타임 필드 provenance

분류 값은 전환 뒤 책임 기준이다. 현재 상태는 모든 필드가 `bundled_snapshot`이며 아직 실시간이 아니다. 기계 판독 표는 `data/processed/review/live_source_field_provenance_manifest.json`에 생성 스크립트·입력·소비자·전환 규칙과 함께 있다. 현재 존재하는 top-level 필드 37개 전부를 분류했고, 현재 0건인 optional `siteRole`까지 포함해 manifest 행은 38개다.

| 필드 | 책임 | 현재 생성 근거 | 주요 소비자·유지 규칙 |
| --- | --- | --- | --- |
| `contentId` | 앱 파생 | 검토 카탈로그 내부 ID | provider·화면 lookup·route snapshot; 원천 ID와 분리 유지 |
| `title` | 원천 실시간 | 정제 원천 snapshot | 상세·주변·결과; 세션 최신명 사용 |
| `contentTypeId` | 혼합 | TourAPI legacy 또는 category fallback | legacy engine; 원천값과 fallback 분리 필요 |
| `contentTypeName` | 혼합 | TourAPI legacy 또는 앱 문구 | legacy engine; 실제 소비 필요성 재확인 |
| `category` | 앱 파생 | 활동·개인화 검토 분류 | provider·UI; 실시간 응답으로 자동 변경 금지 |
| `subCategory` | 앱 파생 | scope/검토된 공식 subtitle | provider·UI; 이름 추정 금지 |
| `availabilityProfile` | 앱 파생 | 장소 성격 규칙 | legacy gate; 시설/권역/야외 의미 유지 |
| `addr1` | 원천 실시간 | 정제 공식 주소 snapshot | 상세·주변·Kakao fallback |
| `lat`, `lon` | 원천 실시간 | 정제 공식 좌표 snapshot | provider·경로·지도; 급변은 충돌 대기 |
| `aliases` | 앱 파생 | 중복 정제 별칭 | identity 감사; 최신 이름으로 자동 삭제 금지 |
| `mergedPlaceIds` | 앱 파생 | 병합 이력 | identity 감사; 유지 |
| `siteGroupId`, `siteRole` | 앱 파생 | 동일 단지·부모/자식 검토 | provider·중복 gate; 내부 장소 자동 추천 금지 |
| `sourceEvidence` | 앱 파생 | 내부 ID↔원천 ID·근거 | live exact join·감사 단일 기준 |
| `detailDescription` | 원천 실시간 | 부산 공식 설명 정규화 snapshot | 상세·주변; 미연결·누락이면 설명 없음 |
| `tourapiContentId` | 앱 파생 | 내부 ID↔TourAPI ID 매핑 | live join; 신규 ID 자동 승격 금지 |
| `tourapiContentTypeId` | 혼합 | TourAPI legacy snapshot | legacy engine; 실시간값/fallback 우선순위 필요 |
| `matchScope` | 앱 파생 | 직접/권역/fallback 검토 | legacy engine; 실시간으로 완화 금지 |
| `dwellSourceName` | 앱 파생 | AI-Hub/정책 근거명 | legacy engine; 유지 |
| `openingHoursSourceName` | 앱 파생 | 장소명 기반 근거 연결 | legacy engine; live provenance와 분리 검토 |
| `openingHoursReliability` | 앱 파생 | 시간 존재·장소 성격 판정 | planner; 원천 누락을 direct로 합성 금지 |
| `operatingHours` | 원천 실시간 | 공식 시간 원문 snapshot | provider availability·상세·운영 gate |
| `mapVerification` | 앱 파생 | Kakao 별도 검증 snapshot | Kakao 이동·legacy engine; TourAPI로 덮지 않음 |
| `shortStay` | 앱 파생 | AI-Hub 분포+제품 체류 정책 | provider·엔진·UI; 기본값 합성 금지 |
| `classification` | 앱 파생 | 대표/조건부 검토 | provider·주변; 신규/수정으로 자동 승격 금지 |
| `classificationReason` | 앱 파생 | 검토 사유 | 감사; 유지 |
| `discovery` | 앱 파생 | 권역형 발견 감사 | provider·exploration; 누락은 conditional |
| `conditionalVisit` | 앱 파생 | 시장·거리 감사 | provider·조건부 흐름; 영업시간 아님 |
| `evidenceProfile` | 앱 파생 | 동일성·활동·체류·재검토 근거 | provider review gate; 날짜 포함 유지 |
| `aihubName`, `aihubCategory` | 앱 파생 | AI-Hub exact 분석 연결 | legacy engine; 실시간 분류로 교체 금지 |
| `matchType`, `matchDistanceM` | 앱 파생 | AI-Hub 매칭 감사 | legacy engine; 유지 |
| `dwell` | 앱 파생 | AI-Hub 장소별 통계 | legacy engine; 실시간 응답으로 교체 금지 |
| `imageUrl` | 혼합 | 원천 URL+사진 gate | 카드·상세·지도; 권리 상태 없으면 fallback |
| `imageSource` | 앱 파생 | 실제 사진 공급자 표식 | 사진 gate; 원천과 exact 유지 |
| `imageEvidence` | 혼합 | 원천 ID+도달성+권리/운영자 승인 | 사진 gate·출처; URL과 분리 유지 |

집계는 앱 파생 27개, 원천 실시간 6개, 혼합 5개, 필드 소유 자체가 미확정인 항목 0개다. 다만 혼합 필드의 공급자 우선순위와 20개 다중 원천 충돌 해소 방식은 별도 미확정 결정이다.

## 4. 현재 기준 수치와 마스터 기준선 차이

현재 작업트리 재집계는 런타임 369, `representative_core` 28, `representative_standard` 163, `conditional_more` 178, TourAPI 139, 설명 127, 사진 203으로 마스터 기준선과 같다. `subCategory`는 236, `siteGroupId` 보유 장소는 6개/그룹 3개, 재검토 기한은 369개 전부에 있다.

운영시간은 한 숫자로 합치면 안 된다.

- 사용자 표시 원문 `operatingHours` 보유: 122개
- 별도 provider 구조화 availability가 `structured`: 170개
- 둘 중 하나 이상 보유: 206개
- 구조화 availability 전체 369행은 `structured 170 / needs_review 199`

따라서 마스터의 “구조화 또는 표시용 운영시간 보유 122개”는 실제로는 **표시 원문만 122개**다. OR 의미라면 206개이므로 통합 세션이 문구를 정정해야 한다. 구조화 170개와 표시 원문 122개는 서로 대체 가능한 동일 필드가 아니다.

## 5. 자동 결합 가능·검토 필요·금지

자동 결합 가능 범위는 현재 manifest에 exact ID가 있는 기존 장소뿐이다. TourAPI 단일 119개는 A2가 반환한 동일 content ID에 결합할 수 있다. 부산 단일 112개는 단계 F 이후 각 부산 어댑터와 결합할 수 있다. 다중 원천 20개는 ID 확인까지만 자동이며, 필드별 우선순위 없이는 자동 값 선택이 금지된다.

검토 필요는 전통시장 표준만 있는 118개, 새로운 source ID, 동일 source ID의 명칭·좌표 급변, 한 공급자 삭제/다른 공급자 유지, 사진 URL 변경이다.

다음은 금지한다.

- 이름·좌표 유사도만으로 내부 ID와 실시간 ID를 자동 연결
- 새 source ID에 category·체류·대표 등급 기본값을 합성해 추천
- 삭제·비공개 콘텐츠를 번들 값으로 되살리기
- ID 재사용 의심을 기존 장소 수정으로 자동 처리
- HTTPS 도달성만으로 사진 이용허락·변형 허용 추정
- 원천 operatingHours를 조건부 제품 창이나 권역 접근 시간으로 대체

## 6. 최소 fixture/manifest 범위

`data/processed/review/live_source_transition_minimal_fixture.json`은 API raw 응답을 복제하지 않고 A2 adapter 이후 정규화 경계를 대상으로 하는 비밀 없는 6개 fixture다.

| fixture | 기대 결과 |
| --- | --- |
| `LIVE-SOURCE-UNCHANGED-01` | exact ID 결합, 앱 파생 필드 유지 |
| `LIVE-SOURCE-MODIFIED-01` | 최신 원천 사실만 갱신, 분류·체류 유지 |
| `LIVE-SOURCE-DELETED-01` | 세션 후보 제외, 로컬 fallback 금지 |
| `LIVE-SOURCE-NEW-01` | 신규 검토 대기, 자동 승격·체류 합성 금지 |
| `LIVE-SOURCE-ID-REUSE-01` | 충돌 대기, 자동 결합 금지, 임계값 결정 필요 |
| `LIVE-SOURCE-IMAGE-RIGHTS-01` | 장소는 유지하되 권리 미연결 새 사진은 fallback |

fixture에는 운영키·실사용자 좌표·실제 API 응답이 없고 `example.invalid` 및 가상 ID만 사용한다. A2가 실제 오퍼레이션 schema를 확정하면 raw 성공·빈 응답·삭제·오류 fixture를 별도로 추가하고 이 정규화 fixture는 B 결합 계약에서 재사용한다.

## 7. 실시간화 뒤 반드시 유지할 로컬 근거

- 체류: `shortStay` 최소·권장·최대, `dwellSourceName`, `dwell`, AI-Hub category 통계
- 추천 자격: `classification`, `classificationReason`, `availabilityProfile`, `matchScope`
- 개인화: `category`, nullable `subCategory`
- 중복·관계: `contentId`, `aliases`, `mergedPlaceIds`, `siteGroupId`, optional `siteRole`
- 검토: `sourceEvidence`, `evidenceProfile`의 동일성·활동·가용성·`verifiedAt/reviewDueAt`
- 발견: `discovery`와 공식 접근 근거·창, `conditionalVisit`의 제품 창 의미
- 운영시간: 원천 최신 시간과 별개인 구조화 상태·신뢰도·fail-closed 규칙
- 사진: 기존 `verified 101 / operator_approved 102`, 원천 ID·URL exact 연결, 출처·변형 제한·기본 이미지 처리
- 지도: TourAPI와 별개인 `mapVerification`과 Kakao 링크 상태

## 8. 변경·검증·다음 결정

### 변경 파일과 목적

- `scripts/build_live_source_inventory.mjs`: 카탈로그·부산 저장 원천을 읽어 장소 mapping, 필드 provenance, 최소 fixture, 감사 결과를 결정적으로 생성·검증한다.
- `data/processed/review/live_source_place_mapping_manifest.json`: 369개 전수 ID mapping과 처분.
- `data/processed/review/live_source_field_provenance_manifest.json`: 필드별 소유·생성·소비·전환 규칙.
- `data/processed/review/live_source_transition_minimal_fixture.json`: 신규·수정·삭제·ID 재사용·사진 권리 최소 fixture 설계.
- `data/processed/review/live_source_inventory_audit.json`: exact 수와 SHA-256 재현 결과.
- 이 문서: A1 결과와 통합 결정 필요 사항.

### 변경하지 않은 경계

`src/data/busan_poi_catalog.json`, 원천·운영시간·분류·체류·사진 데이터 값, UI, 추천 엔진, API adapter, DB, 중앙 정책, 마스터 체크박스를 수정하지 않았다. stage/commit/push하지 않았고 실제 외부 호출은 0회다.

### 재현 명령과 결과

- `node scripts/build_live_source_inventory.mjs` — 통과. 369개, TourAPI 139, 부산 공식 장소 132, 합집합 251, 전통시장-only 118, 미연결 0, 재사용 source ID 0, 필드 미분류 0, fixture 6개.
- 생성 스크립트 연속 2회 — 네 산출물 SHA-256 동일.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 824건 중 823 통과·1 skip·실패 0.
- `npm test` — 574/574 통과.
- `git diff --check` — 통과.

### 통합 세션이 결정할 항목

1. 20개 TourAPI+부산 중복 장소의 이름·주소·좌표·시간·설명 공급자 우선순위. 영향: B snapshot 값과 부산 단계 F 충돌 처리.
2. TourAPI 1차 동안 전통시장-only 118개를 번들 정보 탐색으로 유지할지, live 추천 후보에서 제외할지, 별도 표준시장 adapter를 계획할지. 영향: 후보 공급량·최신성 표시.
3. ID 재사용/급변 판정의 명칭·거리 임계값. 현재 fixture는 임계값을 발명하지 않고 `conflict_review`만 고정했다.
4. `contentTypeId/contentTypeName/tourapiContentTypeId`를 live snapshot 공개 계약에 유지할지 legacy 소비 제거 뒤 제외할지.
5. 마스터 운영시간 기준선 문구를 표시 원문 122로 명시할지, 구조화 170 또는 OR 206을 별도 표기로 정정할지.
6. live 좌표 변경 시 정적 `routeProxyCatalogSnapshot`과 상세·주변 화면의 직접 catalog import를 같은 snapshot으로 어떻게 일치시킬지. API/엔진/UI 공동 계약이 필요하다.

### 마스터 체크리스트 갱신 요청 근거

- 완료 근거 있음: 369개 ID 전수 mapping, 필드 provenance, 기계 판독 manifest, 신규·수정·삭제·ID 재사용 fixture, 사진 권리 분리, 기준 수치 차이, 제품/UI/엔진/API/DB 미수정.
- 조건부: 다중 원천 20개의 **ID mapping**은 완료했지만 필드 충돌 자동 결합은 정책 결정 전 미완료.
- 미완료: 실제 운영 API schema·호출·원본 fixture는 A2 소유이며 이번 A1 근거로 완료 처리하면 안 된다.
