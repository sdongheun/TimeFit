# DATA-BUSAN-LIVE-MAPPING-01 — 부산 공식 3개 원천 실시간 exact mapping 계약

상태: **저장 근거·exact mapping·필드 결합 fixture 완료 / API operation 검증 대기**
기준: `DEC-LIVE-PUBLIC-DATA-01`, `DATA-LIVE-SOURCE-INVENTORY-01`, `DATA-LIVE-MAPPING-CONTRACT-02`
작성일: 2026-09-22
외부 API·운영 DB 호출: **0회**

## 1. 결론

부산 공식 명소·맛집·쇼핑 원천에 이미 연결된 132곳/133개 source link를 `provider + UC_SEQ` exact key로 실시간 전환 manifest에 고정했다. 이름·주소·좌표 유사도로 새 연결을 만들지 않는다.

- 전체: 명소 85곳/85링크, 맛집 18곳/19링크, 쇼핑 29곳/29링크
- 대표 후보: 109곳/110링크
  - 부산-only 93곳
  - TourAPI+부산 16곳
  - 명소 68곳/68링크, 맛집 18곳/19링크, 쇼핑 23곳/23링크
- 전체 TourAPI+부산 중복: 기존 계약과 동일한 20곳
- 전통시장 표준-only: 118곳, 이번 3개 원천 범위 밖 유지

기계 판독 계약은 `data/processed/review/busan_live_mapping_manifest.json`, 회귀 입력은 `data/processed/review/busan_live_mapping_fixture.json`, 감사 결과는 `data/processed/review/busan_live_mapping_audit.json`이다.

## 2. 저장 입력과 원래 서비스 근거

서비스명·operation·endpoint는 각 저장 입력의 `meta.source`와 `meta.endpoint`에서 확인했다. 저장소 전체를 검색했지만 아래 세 파일을 최초 생성한 수집 스크립트는 찾지 못했다. 따라서 수집기 이름은 `unknown`이다.

| provider | 저장 입력 | 저장 행 | 확인된 서비스/operation | 확인된 endpoint |
| --- | --- | ---: | --- | --- |
| `busan_attraction` | `data/processed/부산시_명소정보.json` | 213 | 부산광역시 부산명소정보 서비스 / `getAttractionKr` | `https://apis.data.go.kr/6260000/AttractionService/getAttractionKr` |
| `busan_food` | `data/processed/부산시_맛집정보.json` | 437 | 부산광역시 부산맛집정보 서비스 / `getFoodKr` | `https://apis.data.go.kr/6260000/FoodService/getFoodKr` |
| `busan_shopping` | `data/processed/부산시_쇼핑정보.json` | 55 | 부산광역시 부산쇼핑정보 서비스 / `getShoppingKr` | `https://apis.data.go.kr/6260000/ShoppingService/getShoppingKr` |

공공데이터포털 서비스 페이지는 저장소 근거가 있는 명소 `15063481`, 맛집 `15063472`만 기록했다. 쇼핑 서비스 페이지 URL은 저장소 근거가 없어 `unknown`이다.

## 3. 호출·pagination·수정·삭제 계약

세 저장 schema 모두 identity 필드 `UC_SEQ`를 제공하지만, endpoint가 `UC_SEQ` 단건 조회 파라미터를 지원한다는 근거와 pagination 파라미터명은 저장소에 없다. 이를 관행으로 추정하지 않고 모두 `unknown`으로 기록했다.

API 역할은 세 원천 모두 **완결 목록 수집**으로 구현해야 한다.

1. 모든 page를 성공적으로 받았다는 증명, 중복 없는 `UC_SEQ`, 단일 `liveSourceSnapshotId`를 제공한다.
2. 완결 목록 안의 `UC_SEQ`는 `active`, 완결 목록에서 빠진 기존 mapped ID만 해당 provider의 `inactive`로 판정한다.
3. page 실패·partial·timeout·파싱 오류에서 빠진 ID는 `unknown`이다. 삭제로 보지 않는다.
4. 저장 schema에 행별 `modified`와 `deleted` 필드가 없으므로, 수정은 provider별 정규화 field digest의 완결 snapshot 간 차이로 판정한다.
5. 조회 시각은 원천 행의 수정 시각이 아니다. TourAPI `modifiedtime`과 부산 조회 시각을 비교해 부산 값이 더 최신이라고 주장하지 않는다.

실제 adapter 구현 전에 공식 operation 문서 또는 제한된 계약 호출로 exact-ID 지원 여부, pagination 파라미터와 응답 `totalCount` 경계를 별도로 확인해야 한다.

## 4. 원천별 필드 계약

수치는 133개 기존 mapped link 중 비어 있지 않은 저장값이다. `schema 없음`은 live operation도 영구히 제공하지 않는다는 뜻이 아니라, 현재 확인 근거로 사용할 수 없다는 뜻이다.

| provider | title | address | lat/lon | opening | closed | description | image | modified/deleted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 명소 85링크 | 85 | 85 | 85/85 | 78 | 64 | 85 | 85 | schema 없음 |
| 맛집 19링크 | 19 | 19 | 19/19 | 19 | schema 없음 | 19 | 17 | schema 없음 |
| 쇼핑 29링크 | 29 | 27 | 29/29 | 26 | 18 | 29 | 29 | schema 없음 |

필드 source key와 앱 소비 경계는 다음과 같다.

- `title`: `MAIN_TITLE`, `PLACE`, `MAIN_PLACE`, `TITLE` — exact ID와 제목/별칭 identity gate 뒤 세션 사실
- `address`: `ADDR1`, `ADDR2`; 좌표: `LAT`, `LNG` — identity gate 뒤 사용, 급변은 검토
- `opening`: `USAGE_DAY_WEEK_AND_TIME`, `USAGE_DAY`; `closed`: `HLDY_INFO` — 원문을 제품 창으로 쓰지 않고 opening normalizer 입력으로만 전달
- `description`: `ITEMCNTNTS` — exact ID 연결 후 optional 상세 설명
- `image`: `MAIN_IMG_NORMAL`, `MAIN_IMG_THUMB` — URL별 이용조건 연결이 있는 경우만 공개하고 아니면 기본 이미지
- `modified`, `deleted`: 확인된 source field 없음 — snapshot digest와 완결 목록 membership으로만 파생

빈 optional 필드는 값 삭제 지시가 아니다. 특히 맛집에 `HLDY_INFO` schema가 없다는 사실을 `연중무휴`로 해석하지 않는다.

## 5. TourAPI+부산 20곳 결합 규칙

공급자 전체 우선순위를 두지 않는다. 양쪽 exact source ID와 각 provider identity gate가 통과한 뒤 아래 순서로 필드별 판정한다.

1. 같은 세션에서 성공한 live 응답의 실제 제공 필드만 후보로 삼는다.
2. 양쪽에 비교 가능한 행별 수정 시각이 있고 한쪽이 엄격히 최신이면 그 필드의 최신값을 사용한다.
3. 부산 schema에는 확인된 수정 시각이 없으므로 조회 시각만으로 2번을 적용하지 않는다.
4. 최신성을 비교할 수 없으면 정규화 동등성과 필드 존재 여부만으로 자동 결합한다.

자동 결합 가능:

- 제목·주소·운영·휴무·설명이 의미상 같음
- 한쪽만 값을 제공하고 그 provider identity가 승인됨
- 한쪽만 유효한 좌표쌍을 제공하고 기존 mapping identity 검증을 통과함
- 사진 URL이 별도 권리 manifest와 exact 일치함
- provider별 활성/비활성 상태 보존. 모든 mapped provider가 완결 목록에서 inactive일 때만 장소 전역 inactive

`review_required`:

- 양쪽 제목·주소·운영시간·휴무·설명이 다르고 비교 가능한 최신성도 없음
- 양쪽 좌표가 다르고 최신성 비교가 불가능함. 100m 초과는 identity conflict도 함께 기록
- 새/변경 사진 URL 또는 서로 다른 사진 URL. 검토 전 기본 이미지
- incomplete 목록 누락, ID 재사용 의심, identity gate 실패

운영시간 두 원문을 이어 붙이거나 TourAPI/부산 중 하나를 전역 우선 공급자로 정하지 않는다. 충돌 필드는 검토될 때까지 live overlay하지 않으며 category/subCategory·체류·추천 등급은 그대로 유지한다.

## 6. 변경 이력

- **이전 방식:** 부산 exact ID 132곳/133링크는 저장 inventory에 있었지만 실제 service operation, 완결 목록 필요성, 필드 제공 여부와 TourAPI 동시 live 충돌 규칙이 하나의 API 입력 계약으로 묶이지 않았다.
- **발생한 문제:** 부산 3개 원천을 live로 바꿀 때 단건 ID 조회를 추정하거나 partial 목록 누락을 삭제로 오판하고, 공급자 전역 우선순위로 서로 다른 운영시간·좌표를 덮을 수 있었다.
- **교체한 방식:** 저장 meta에서 확인된 endpoint/schema만 manifest에 기록하고 미확인 호출 세부는 `unknown`, lifecycle은 완결 목록, 값 결합은 최신성·존재·identity gate 순으로 고정했다.
- **교체 이유:** 부산-only 대표 93곳을 누락하지 않으면서 원천 충돌과 삭제를 fail-closed하기 위해서다.
- **상태:** 데이터 계약과 fixture는 현행. 실제 API adapter·공식 operation schema 검증은 구현 전이다.

## 7. 변경·검증·인계

### 변경 파일과 목적

- `scripts/build_busan_live_mapping.mjs`: 세 저장 원천·기존 exact mapping·중복 계약에서 manifest, fixture, audit을 결정적으로 생성·검증.
- `data/processed/review/busan_live_mapping_manifest.json`: 133개 source link, 서비스/요청/필드/충돌 계약.
- `data/processed/review/busan_live_mapping_fixture.json`: exact/new/partial/deleted/both-source conflict/시장 범위 fixture.
- `data/processed/review/busan_live_mapping_audit.json`: 불변 수치와 미확인 사실, 산출물 hash.
- `test/busan-live-mapping.test.mjs`: 대표 누락·전통시장 범위·필드·충돌 회귀.
- 이 문서와 데이터 역할 README: API 역할 인계.

### 변경하지 않은 공개 계약·정책 경계

원본·기존 processed JSON, 런타임 카탈로그, 추천 정책·엔진, UI, API adapter/Edge, DB, 마스터 체크박스를 수정하지 않았다. category/subCategory, 체류, 등급, 좌표, 운영시간, 사진 권리 정책을 바꾸지 않았다. 실제 API 호출·배포·stage·commit·push도 하지 않았다.

### API 역할의 정확한 입력

- provider allowlist: `busan_attraction | busan_food | busan_shopping`
- provider별 endpoint/operation과 source ID field `UC_SEQ`: manifest `services`
- 승인 source ID 133개와 내부 ID/classification/TourAPI 중복 여부: manifest `mappings`
- page 완결·중복 없음·snapshot ID·provider별 inactive 요구: `services[].requestContract`
- 필드 source key와 빈 값/권리/normalizer 경계: `services[].fieldContract`
- 양쪽 원천 충돌 처분: `overlapMergeContract`

### 실행 테스트

- `node scripts/build_busan_live_mapping.mjs` — 통과. 132곳/133링크, 대표 109곳/110링크, 부산-only 대표 93곳, 양쪽 원천 대표 16곳, 전체 양쪽 원천 20곳, 전통시장-only 118곳 범위 밖.
- 생성 스크립트 연속 2회와 SHA-256 비교 — manifest·fixture·audit 모두 동일.
- `node --test test/busan-live-mapping.test.mjs` — 5/5 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 585/585 통과.
- `npm run test:ui` — 824개 중 823 통과, 기존 skip 1, 실패 0.
- `git diff --check` — 통과.

### 남은 위험

- 저장 input 생성 스크립트, 쇼핑 서비스 페이지, exact-ID operation, pagination 파라미터는 `unknown`이다.
- 행별 수정 시각이 없어 변경 내용은 알 수 있지만 어느 공급자가 더 최신인지는 자동 판정할 수 없다.
- API 역할이 실제 operation schema를 확인하기 전에는 이 manifest의 source field 이름을 raw 응답 계약으로 확정하면 안 된다. 현재는 저장된 정규화 입력 schema의 계약이다.
