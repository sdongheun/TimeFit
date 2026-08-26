# TourAPI 대표 이미지 런타임 병합 감사

## 입력과 조회 범위

- 입력 감사: `data/processed/review/현재사용_TourAPI_대표이미지_감사.json`
- 대상: 현행 런타임 368개 중 TourAPI 원천 ID가 있는 138개
- TourAPI `detailCommon2` 전수 감사: 이미지 있음 127개, 없음 11개
- 추가 네트워크 검증: 원문 그대로 HTTPS인 4개 URL만 GET 범위 요청으로 재확인했다. HEAD는 서버가 405로 거부해 사용하지 않았다.

## HTTPS 검증과 병합 결과

HTTPS 4개는 리다이렉트 뒤에도 HTTPS이며 `image/jpg` 응답이었다. `http` URL 123개는 HTTPS로 임의 치환하지 않았고, 후속 별도 원천 검증 전까지 런타임에 병합하지 않았다.

| 결과 | 수 | 처리 |
| --- | ---: | --- |
| 검증 HTTPS URL | 4 | `현재사용_TourAPI_대표이미지_HTTPS검증.json`에 상태·콘텐츠 유형 보존 |
| 부산시 공식 이미지 우선 유지 | 3 | 벡스코, 부산타워, 부산 치유의 숲 |
| TourAPI 보완 이미지 병합 | 1 | 놀이마루(`poi_41`)에만 `imageSource: 'tourapi'`로 연결 |
| 이미지 없는 TourAPI 응답 | 11 | 대체하지 않음 |

런타임 전체 이미지 수는 부산시 공식 129개와 TourAPI 1개로 총 130개다. 자동 대표 후보 190개의 이미지 보유 수는 106개로 변함없다. 새 TourAPI 이미지는 `conditional_more`인 놀이마루에만 해당한다.

## 추적성과 경계

TourAPI 이미지는 `imageEvidence.source`, TourAPI content ID, TourAPI 감사 시각, HTTPS 검증 시각을 함께 저장한다. 병합은 현재 카탈로그 ID와 `tourapiContentId`가 모두 감사와 일치할 때만 가능하며, 제목 유사도는 사용하지 않는다.

이미지 병합은 분류·좌표·체류·운영시간을 변경하지 않는다. 원격 파일을 앱 번들로 복제하지 않았고, 앱 실행 중 TourAPI 이미지 재조회도 추가하지 않았다. React UI, 추천 엔진, 외부 API adapter, DB는 수정하지 않았다.

## 재현과 검증

1. `node scripts/audit_tourapi_image_https_sample.mjs` — HTTPS 표본 4개의 GET 범위 검증
2. `node scripts/build_runtime_poi_catalog.mjs` — 카탈로그 재생성
3. `node --test test/busan-poi-catalog.test.mjs` — ID 일치·부산시 우선·추적 필드·URL 계약

## 3-B-1 확대 검증 (2026-08-25)

### 이전 방식 → 관찰 → 교체 방식

| 항목 | 내용 |
| --- | --- |
| 이전 방식 | 원문부터 HTTPS인 4개만 표본 검증해, 부산시 공식 이미지가 없는 조건부 장소 1개만 TourAPI 이미지로 병합했다. |
| 관찰 | 자동 대표 후보는 부산시 공식 106개·TourAPI 0개·없음 84개로 그대로여서, TourAPI가 제공한 72개 대표 후보 이미지를 안전하게 활용하지 못했다. |
| 교체 방식 | 부산시 공식 이미지가 없고, 런타임 ID와 TourAPI content ID가 감사와 모두 일치한 대표 후보 72개를 고정 큐로 만든 뒤, 12개 층화 표본 → 남은 60개 순으로 HTTPS Range GET을 각각 한 번만 검증했다. |
| 교체 이유 | HTTP URL을 전역 문자열 치환하지 않고, CDN별 실제 HTTPS 응답·최종 URL·`image/*` 콘텐츠·비어 있지 않은 응답을 확인한 개별 장소만 병합하기 위해서다. |
| 상태 | 현행 |

### 3-B-1 결과

| 단계 | 외부 검증 수 | 성공 | 실패 |
| --- | ---: | ---:| ---: |
| `representative_core`·`standard` 층화 표본 | 12 | 12 | 0 |
| 남은 고정 대상 | 60 | 60 | 0 |
| 합계 | 72 | 72 | 0 |

모든 성공 항목은 `tong.visitkorea.or.kr`의 원본 HTTP URL과 별도로 검증한 HTTPS 최종 URL을 보존한다. TourAPI 상세 API 재호출이나 신규 장소 수집은 하지 않았다.

| 대표 후보 이미지 원천 | 3-B 전 | 3-B-1 후 |
| --- | ---: | ---: |
| 부산시 공식 | 106 | 106 |
| TourAPI | 0 | 72 |
| 없음 | 84 | 12 |

전체 런타임 368개 기준은 부산시 공식 129개, TourAPI 73개(기존 조건부 1개 포함), 이미지 없음 166개다. 새 manifest는 [HTTPS 검증 큐](../../data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증큐.json)와 [검증 결과](../../data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증결과.json)에 보존한다.

### 재현·수동 확인

1. `node scripts/build_tourapi_representative_image_https_queue.mjs`
2. `TOURAPI_IMAGE_HTTPS_PHASE=sample node scripts/audit_tourapi_representative_image_https.mjs`
3. 표본 성공 시 `TOURAPI_IMAGE_HTTPS_PHASE=remaining node scripts/audit_tourapi_representative_image_https.mjs`
4. `node scripts/build_runtime_poi_catalog.mjs`

iOS에서는 TourAPI 대표 표본 몇 개의 실제 표시·리다이렉트·오프라인 실패 플레이스홀더를 수동 확인한다. 자동 회귀는 원격 URL을 호출하지 않는다.
