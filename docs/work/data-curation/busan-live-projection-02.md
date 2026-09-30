# DATA-BUSAN-LIVE-PROJECTION-02 — 부산·TourAPI 다중 원천 live projection

상태: **R1 필드 소유 보완·순수 projection·fixture 완료 / 추천 orchestrator 연결 대기**
기준: `DEC-LIVE-PUBLIC-DATA-01`, `DATA-BUSAN-LIVE-MAPPING-01`, `API-BUSAN-LIVE-ADAPTER-02`
작성일: 2026-09-22
외부 API·운영 DB 호출: **0회**

## 1. 결과

`src/data/busanLiveProjection.ts`에 TourAPI catalog projection과 부산 3원천 adapter 결과를 같은 `liveSourceSnapshotId`에서 결합하는 순수 projection을 추가했다. `src/data/busanLiveOpeningNormalizer.ts`는 부산 `openingText/closedText`를 기존 검토 근거와 exact 비교하거나 공통 안전 문법으로 파싱한다.

369개 mapping record와 앱 파생 정책은 항상 보존한다. 추천 candidate는 대표 분류이며 다음 조건을 모두 만족할 때만 생성한다.

1. 기존 `provider + source ID` exact mapping
2. 같은 세션 snapshot
3. 적어도 한 mapped provider가 active
4. source ID/type/alias/compound identity gate 통과
5. 3.5 필드 소유 규칙이 선택한 원천의 구조화 운영시간 통과

신규 source ID, 전통시장 표준-only 118곳, `conditional_more`는 대표 candidate로 승격하지 않는다. 결과는 내부 순서로 결정적으로 정렬하고 deep freeze한다. provider 원문 body와 운영시간·휴무 원문은 출력하지 않는다.

## 2. 기준선과 예상 후보 분포

| 대표 mapping 분할 | 장소 | 보존 방식 |
| --- | ---: | --- |
| TourAPI-only | 82 | TourAPI catalog identity와 별도 detail opening이 모두 통과해야 active candidate |
| 부산-only | 93 | 부산 exact live record와 부산 opening gate가 통과해야 active candidate |
| TourAPI+부산 | 16 | 양쪽 lifecycle을 따로 보존하고 active facts를 필드별 결합 |
| 합계 | 191 | 기존 `representative_core/standard` 불변 |

전체 런타임은 369개다. 전체 TourAPI mapping 139, 부산 mapping 132곳/133링크, 전체 양쪽 원천 20곳도 바뀌지 않는다. 위 82/93/16은 **대표 191곳의 분할**이며 API 응답 성공 수가 아니다.

동등한 전체 live fixture에서는 대표 191개가 모두 active candidate로 보존된다. 양쪽 16곳의 정상적인 제목 표기·주소·5~178m 좌표·설명·운영시간 차이는 필드 소유 규칙으로 해결하며 그 차이만으로 제외하지 않는다. 다만 실제 source ID/type 불일치, 미등록 제목과 1km 이상 이동의 compound identity, TourAPI projection의 `identity_conflict`는 여전히 후보에서 제외한다.

## 3. lifecycle 결합표

| mapped provider 상태 | 장소 상태 | 정적 fallback |
| --- | --- | --- |
| 하나 이상 active + 나머지 inactive | active 원천 facts로 계속 판정 | 없음 |
| 하나 이상 active + 나머지 unavailable | active 원천 facts로 계속 판정 | 없음 |
| 모든 mapped provider complete inactive | `inactive` | 금지 |
| active 없음 + 하나 이상 unavailable | `source_unavailable` | 금지 |
| provider identity conflict | `review_required` | 금지 |
| 서로 다른 non-null snapshot ID | `review_required / snapshot_mismatch` | 금지 |

부산 top-level `partial` 자체로 장소를 제외하지 않는다. 세 source result 중 `ready/complete`인 원천의 active·inactive만 사용하고 unavailable 원천은 미확정으로 유지한다. 특정 부산 원천의 complete 목록에 없는 exact ID만 해당 provider inactive다.

## 4. 다중 원천 필드 소유표 — R1 현행

공급자 전체를 한쪽으로 고정하지 않고 **필드별 소유**를 적용한다. 모든 값은 exact identity gate를 먼저 통과해야 한다.

| 상태·필드 | 선택 원천 | fallback·제외 |
| --- | --- | --- |
| 양쪽 active — title/address/lat/lon | TourAPI live | TourAPI optional address가 없을 때만 부산 active address |
| 양쪽 active — opening/closed | TourAPI live detail만 검증 | 부산 문자열로 보충·연결 금지. Tour detail 누락/검토 필요면 fail-closed |
| 양쪽 active — description/부산 고유 정보 | Busan live | 부산 description이 없을 때만 TourAPI live description |
| TourAPI inactive/unavailable + 부산 active | 부산 live 공통 사실·운영시간 | bundled 원천값 fallback 금지 |
| 부산 inactive/unavailable + TourAPI active | TourAPI live 사실·운영시간 | bundled 원천값 fallback 금지 |
| photo | adapter가 기존 exact evidence와 현재 URL 일치를 승인한 사진 | 없음·변경·충돌 URL은 기본 이미지, 장소는 유지 |
| category/subCategory/classification/체류/site/개인화 | 로컬 앱 파생 정책 | 원천 사실로 재분류·완화 금지 |

좌표·주소·제목·운영시간의 원천 간 표현 차이는 R1에서 충돌 사유가 아니다. 부산 자체에 여러 exact link가 있고 선택 원천 내부 값이 충돌하는 경우는 계속 review한다. 부산 원천에는 비교 가능한 행별 modified timestamp가 없으며 retrieval 시각을 최신성으로 사용하지 않는다.

### 철회된 R0 방식

- **이전 방식:** 양쪽 active 값이 정규화 동등하지 않으면 `title/address/coordinate/opening/description_conflict`로 장소 전체를 제외했다.
- **발생한 문제:** 이미 exact mapping·identity가 검토된 동일 장소도 5~178m 좌표 차이와 공급자별 표기·설명 차이 때문에 양쪽 대표 16곳이 정상 fixture에서 탈락했다.
- **교체한 방식:** 최신 마스터 3.5의 필드 소유 규칙으로 TourAPI 공통 사실·운영시간과 부산 설명을 선택한다.
- **교체 이유:** 정상적인 원천 차이는 필드 소유로 해결하고 실제 identity 충돌만 검토하기 위해서다.
- **상태:** R0 동등성 강제는 철회, R1 필드 소유가 현행이다.

## 5. 부산 운영시간 감사

대표 부산 mapping은 109곳/110링크다. 저장된 `USAGE_DAY_WEEK_AND_TIME || USAGE_DAY`와 `HLDY_INFO`를 adapter 정규화 입력으로 재현한 결과다.

| provider | 링크 | exact 검토 재사용 | 안전 새 파싱 | `needs_review` |
| --- | ---: | ---: | ---: | ---: |
| 맛집 | 19 | 13 | 2 | 4 |
| 쇼핑 | 23 | 9 | 0 | 14 |
| 명소 | 68 | 14 | 19 | 35 |
| 합계 | 110 | 36 | 21 | 53 |

검토 필요 이유는 실제 휴무·특정 요일 등 `closed_text_requires_review` 46, 복수·예외 문법 6, 운영시간 없음 1이다. 이 분포는 저장 원문이 그대로 live로 돌아온다는 fixture 예상치이며 운영 API의 미래 성공률이 아니다.

### exact reuse

아래가 모두 같을 때만 기존 `StructuredAvailability`를 재사용한다.

- 내부 place ID
- 부산 source key와 `UC_SEQ`
- 정규화 live opening과 저장 부산 opening
- 정규화 live closed와 저장 부산 closed
- 구조화 운영시간 row 전체 `sourceText`와 해당 부산 availability evidence

복합 sourceText나 다른 source link를 근거로 만든 windows는 한 링크의 exact reuse로 재사용하지 않는다. 원문이 달라지면 안전 문법으로 새로 파싱하거나 review한다.

### 안전 새 파싱과 fail-closed

TourAPI normalizer의 `normalizeLiveOpeningSourceText`와 `parseSafeLiveOpeningText`를 공개 순수 함수로 재사용했다. 기존 TourAPI provenance·event/source 계약은 바꾸지 않았다.

- 허용: 명시 상시·24시간, 단일 명확 범위, 표현 가능한 weekday/weekend, 매일 자정 넘김
- 검토: 특정 요일·복수 범위·문의·상이·예약·입장 마감·마지막 주문·실제 휴무/휴관
- 맛집 `closedText` 부재는 `연중무휴` provenance를 만들지 않는다. opening 범위가 안전하면 그 범위만 구조화하며 `alwaysAccessible`로 합성하지 않는다.

## 6. opening gate·orchestrator 인계

1. TourAPI와 부산 호출에는 같은 `liveSourceSnapshotId`를 전달한다.
2. 먼저 기존 `projectTourLiveCatalog()`와 부산 adapter 검증 결과를 만든다.
3. TourAPI active 장소의 detail opening 결과를 `TourLiveFieldSupplement`로 같은 snapshot에 전달한다. supplement 부재는 로컬 운영시간 fallback 근거가 아니다.
4. `projectMultiSourceLiveCatalog()`의 `active` 대표 candidate만 opening gate 이후 route 대상으로 보낸다.
5. `inactive`, `review_required`, `source_unavailable`, `provider_out_of_scope`는 route 전에 제외한다.
6. candidate의 category/subCategory, classification, 체류, discovery, site 관계는 projection 값을 그대로 사용한다.
7. 진단에는 typed state/reason과 provider/source ID만 남기고 raw opening/closed/description/provider body는 남기지 않는다.

public provider·추천 엔진 연결은 이번 데이터 작업에 포함하지 않았다.

## 7. 변경 이력

- **이전 방식:** TourAPI catalog projection과 부산 adapter는 각각 검증됐지만 lifecycle·필드·운영시간을 같은 세션에서 합치는 데이터 경계가 없었다.
- **발생한 문제:** orchestrator가 직접 결합하면 한 원천 장애를 삭제로 오판하거나 공급자 전역 우선순위, 로컬 원천값 fallback, 운영시간 문자열 연결이 섞일 수 있었다.
- **교체한 방식:** 369개 exact mapping과 앱 파생 정책을 고정 입력으로 두고 provider별 lifecycle과 사진 evidence를 순수 projection에서 판정한다. R1에서는 마스터 3.5에 따라 필드별 소유를 적용한다.
- **교체 이유:** 부산-only 대표 93과 양쪽 대표 16의 정책을 보존하면서 정상 원천 차이는 허용하고 실제 identity 충돌·장애만 fail-closed하기 위해서다.
- **상태:** R1 데이터 projection 현행 구현 완료. 추천 엔진 다중 원천 orchestrator 연결 전이다.

## 8. 변경·검증·남은 위험

### 변경 파일과 목적

- `src/data/busanLiveProjection.ts`: 369개 exact mapping의 provider lifecycle과 다중 원천 field projection.
- `src/data/busanLiveOpeningNormalizer.ts`: 부산 exact reviewed reuse, 공통 안전 parser, 109곳/110링크 저장 감사.
- `src/data/liveOpeningNormalizer.ts`: 기존 TourAPI 동작을 유지하며 원문 정규화·안전 parser만 공개 재사용.
- `test/busan-live-projection.test.ts`: 기준선, lifecycle 조합, 필드 충돌, 운영시간, 사진, 신규 ID, 결정성 fixture.
- 이 문서와 데이터 역할 README: 결과와 opening gate 인계.

### 변경하지 않은 공개 계약·정책 경계

원본/processed JSON, 런타임 catalog, 추천 엔진, UI, services/Edge/API, DB, env/secret, 마스터 체크박스를 수정하지 않았다. category/subCategory, classification, 체류, site 관계, 사진 이용조건, 최대 장소·시간 정책을 변경하지 않았다. 실제 API 호출·배포·stage·commit·push도 하지 않았다.

### 실행 테스트

- R1 projection 12건과 기존 Tour projection·Tour opening 직접 회귀를 포함한 집중 검증 27/27 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 587/587 통과.
- `npm run test:ui` — 824개 중 823 통과, 기존 skip 1, 실패 0.
- `git diff --check` — 통과.

### 남은 위험

- 부산 stored audit 53링크는 현 타입이 특정 요일/휴무 예외를 손실 없이 표현하지 못해 review다. 문자열을 단순화해 후보 수를 늘리지 않는다.
- 부산 compound identity는 기존 제목/별칭과 모두 다르면서 기존 좌표에서 1km 이상 이동한 경우로 제한한다. 이 threshold 변경은 통합 역할의 별도 정책 결정이 필요하다.
- adapter가 승인 사진 evidence를 이미 검증한다는 경계를 전제로 한다. projection을 adapter 검증 없이 직접 호출하는 public 경로를 만들면 안 된다.
