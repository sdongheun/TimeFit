# DATA-RELEASE-ASSETS-01 — 출시 사진 자산 최종 감사

상태: **데이터 자산 감사 완료 / 데이터 기준 제출 차단 없음**. 2026-09-08 현재 작업트리의 공개 카탈로그를 직접 집계했다. 미확인 사진 전량 확보를 출시 조건으로 확대하지 않았으며 원본·allowlist·런타임 카탈로그·UI·엔진은 수정하지 않았다.

## 판정 요약

| 상태 | 전체 런타임 | 대표 후보 | 판정 |
| --- | ---: | ---: | --- |
| 공개 허용 사진 | 101/369 | 84/191 | 카드 crop·원형 마커 사용 가능 |
| 기본 이미지 | 268/369 | 107/191 | URL 없음 또는 조건 미확인 |
| 조건 미확인 사진 후보 | 102 | - | 부산 쇼핑 29·TourAPI 73, 공개하지 않음 |
| 저장 사진 후보 없음 | 166 | - | 기본 이미지 |

공개 101개는 장소 ID 101개·URL 101개로 모두 고유하며 호스트는 `www.visitbusan.net`이다. 허용목록과 런타임의 `contentId/source/sourceId/imageUrl` exact 연결 위반은 0건이다. 원천별 공개 수는 `busan_attraction` 85, `busan_food` 16이며 `busan_shopping`과 `tourapi` 공개 수는 0이다. 과거 101/369를 복사하지 않고 `src/data/busan_poi_catalog.json`과 `data/processed/review/사진_이용허락_허용목록.json`에서 다시 계산했다.

## 사용 근거·크롭·출처 표시

- 부산 명소 API: `https://www.data.go.kr/data/15063481/openapi.do`. 제공 정보에 이미지 URL이 포함되고 이용허락범위는 `제한 없음`이다.
- 부산 맛집 API: `https://www.data.go.kr/data/15063472/openapi.do`. 여행사진·이미지 정보를 제공하고 이용허락범위는 `제한 없음`이다.
- allowlist 101개 전부가 `basis=api_service`, `rightsHolder=부산광역시`, `commercialUseAllowed=true`, `modificationAllowed=true`, `attributionRequired=false`와 HTTPS 원문·라이선스 링크, 출처 문구, 표시 조건을 가진다. 기록 확인일은 전부 `2026-09-07`이며 2026-09-08 공식 페이지 재확인에서 조건 변경은 관찰되지 않았다.
- 카드·상세 이미지는 `PlacePhoto`의 `resizeMode="cover"`, 추천 카드의 cover frame을 사용한다. 추천·상세 지도와 주변 지도는 원형 frame의 `object-fit:cover`를 사용한다. 즉 비율 유지 전체 표시가 아니라 잘라내기·원형 마스킹이 발생하지만, 공개 101개는 모두 변경 이용 가능으로 확인된 사진이므로 현재 표현과 충돌하지 않는다.
- `PlacePhotoCredit`은 `사진 제공: 부산광역시 부산명소정보 서비스` 또는 `사진 제공: 부산광역시 부산맛집정보 서비스`와 `이용허락범위 제한 없음`을 가시 텍스트로 표시한다. 상세·추천 카드에서 공식 출처와 이용조건 HTTPS 링크를 열 수 있다. 접근성 label만 출처표시로 간주하지 않는다.
- 지도 마커 자체에는 긴 출처 문구를 넣지 않지만 동일 장소 상세에서 출처·조건 링크를 제공한다. 현재 허용 사진은 `attributionRequired=false`이므로 이 표시 위치가 허락 조건을 위반하지 않는다.
- TourAPI 공식 페이지는 사진이 공공누리 1·3유형으로 섞여 있음을 명시한다. 사진별 유형이 현행 저장 근거에 없고 3유형은 변경금지이므로 원형/crop 가능 사진으로 추정하지 않았다. 부산 쇼핑도 서비스 이용조건 미확인 상태라 명소·맛집 조건을 전용하지 않았다.

## 기본 이미지·실패 처리

- 이미지 URL 없음, 허용 metadata 누락, 원천/ID/URL 불일치, 변경 허용 false는 `approvedPlacePhoto`에서 모두 거부한다.
- native 사진은 로딩 전 fallback을 먼저 유지하고 404·오류 또는 12초 timeout이면 기본 이미지로 닫힌다. 재시도 루프나 장소 선택 행동 변경은 없다.
- 추천 지도 사진 overlay는 실패·timeout 시 제거되고 그 아래 기본 장소 marker가 유지된다. 주변 지도는 사진 오류 시 원형 기본 marker로 전환한다.
- 사진 부재·실패는 장소 ID, 추천 자격, 카드 선택, 상세 진입, 카카오맵 행동을 바꾸지 않는다. 따라서 미확인 102개와 사진 없음 166개는 출시 시 기능 손실 대신 기본 이미지로 표시된다.

## 공개 데이터·fixture 경계

- 공개 런타임 카탈로그에서 `example.test`, `example.org`, `test_fixture`, fixture 장소 ID, 테스트 이메일 표식 검색 결과는 0건이다.
- 공개 소비 경로는 `src/data/busan_poi_catalog.json`을 읽는다. 테스트 fixture는 `test/` 또는 internal UI source에 별도로 존재하며 이번 데이터 감사에서 공개 장소 데이터로 혼입된 증거는 없다.
- internal 도구의 최종 번들 비노출은 데이터 자산 계약이 아니라 `U-RELEASE-BUILD-01`의 제출 환경·artifact 검사 경계다.

## 유지한 공개 계약

- 런타임 369, 대표 191, 장소 ID·등급·좌표·주소·분류·운영시간·체류 기준·추천 자격을 변경하지 않았다.
- 미확인 사진을 허용하지 않았고 기본 이미지 정책을 해제하지 않았다. 사진 추가 확보, 원천 재호출, URL 다운로드, 카탈로그 재생성도 실행하지 않았다.
- UI·추천 엔진·API/cache·DB/migration·env·중앙 정책 문서는 수정하지 않았다. commit/push·원격 게시·운영 DB 쓰기는 0회다.

## 실행한 검증

- 현행 카탈로그/allowlist read-only exact 감사: 런타임 369, 공개 101, 기본 268, 대표 공개 84, exact 연결 위반 0, 공개 카탈로그 test marker 0 — PASS.
- `node --import tsx --test test/data-release-personalization.test.mjs test/busan-poi-catalog.test.mjs test/ui/public-api-photo.test.ts test/ui/public-api-photo-screen.test.ts test/ui/course-v1-place-preview.test.ts test/ui/nearby-browse-map-document.test.mjs test/ui/nearby-browse-screen.test.mjs`: 66/66 PASS.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: 699개 중 698 PASS, 실패 0, 기존 skip 1.
- `npm test`: 364/364 PASS.
- `git diff --check`: PASS.
- 외부 호출: 공식 공공데이터포털 상세 페이지 읽기 3건. 사진/API 데이터 호출·다운로드는 0건이다.

## 제출 차단 여부와 다음 담당

- **데이터 기준 제출 차단 없음.** 허용 사진 101개는 현재 crop·원형 표시와 이용조건이 맞고, 나머지는 fail-closed fallback이다. 미확인 102개 전량 확보는 제출 선행조건이 아니다.
- 최종 후보 QA는 실제 제출 빌드에서 명소 1개·맛집 1개·사진 없음 1개·미확인 원천 1개의 로딩/실패 fallback과 상세 출처 링크를 smoke 확인한다. 네트워크 로딩 성공을 데이터 권리 근거로 바꾸지 않는다.
- 향후 TourAPI를 확대하려면 사진별 공공누리 유형을 원천 ID·URL과 연결해야 한다. 1유형만 현재 crop 계약에 들어갈 수 있고 3유형은 원본 비율·무변형 표시 계약을 UIUX가 별도로 승인하기 전까지 보류한다. 부산 쇼핑은 해당 서비스 공식 이용조건 확인 전 계속 보류한다.
