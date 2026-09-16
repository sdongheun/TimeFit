# QA-PLACE-PHOTO-ALL-01 — 전체 장소 사진 출시 검증

상태: **자동 게이트 PASS / 수정 빌드 실기기 육안 확인 대기**  
검증일: 2026-09-16  
기준: `docs/work/integration-decision/all-place-photo-rollout.md`

## 판정

데이터·UI 인계의 고정 fixture와 현재 public iOS export를 대조한 결과 자동 범위는 통과했다. 런타임 369곳은 사진 표시 가능 203곳과 fallback 166곳으로 정확히 나뉘며, 지도용 사진 마커는 현재 두 지도 구현 모두 0개다. `operator_approved`는 표시 결정으로만 소비되고 검증된 이용허락으로 승격되지 않는다.

자동 검증은 실제 네트워크 이미지의 렌더링 품질이나 수정 빌드의 물리 화면을 대신하지 않는다. 따라서 최종 수락은 아래 최소 실기기 육안 확인 뒤 판정한다.

## 1. 변경 파일과 목적

- QA가 변경한 파일: 이 문서만 추가했다.
- 기존 고정 fixture가 수락 조건을 중복 없이 모두 포함하므로 제품 코드와 테스트 코드는 수정하지 않았다.
- 다른 역할의 미커밋 데이터·UI·테스트 변경 및 기존 `output/`을 보존했다. stage/commit/push·배포는 수행하지 않았다.

## 2. 검증한 계약과 결과

- 런타임 exact 집계: 전체 369, 사진 203, fallback 166.
- 원천별 사진: 부산 명소 85, 부산 맛집 16, 부산 쇼핑 29, TourAPI 73.
- 승인 등급: 기존 101 `verified`, 신규 102 `operator_approved`.
- 연결 무결성: 사진 contentId 203개와 URL 203개가 각각 고유하며 allowlist의 `contentId/source/sourceId/imageUrl` 집합과 정확히 일치한다. HTTP URL과 ID/최종 URL 불일치는 표시하지 않는다.
- 권리 사실 경계: 기존 verified의 승인 metadata를 유지하고, operator-approved에는 rights holder·license·commercial/modification 허용 값을 합성하지 않는다. TourAPI HTTPS 검증은 URL 도달성 근거로만 유지한다.
- 원천별 화면 fixture: 명소 `poi_19`, 맛집 `poi_1047`, 쇼핑 `poi_13`, TourAPI `poi_1`을 카드·상세 모델에 전달해 사진을 확인했다. 추천 카드의 선택 행동과 상세/주변 전달은 유지된다.
- 실패 경계: 사진 없음, 미승인, 비HTTPS, URL 불일치, onError, 12초 timeout은 Image를 제거하고 기존 fallback으로 닫힌다. 늦은 load 성공도 실패 상태를 되돌리지 않는다.
- 사진 표현: 세로·가로·정사각형 fixture 모두 `contain`, 원본 비율 유지, blur 없음, 사진/frame 둥근 clip 없음, 카드와 같은 어두운 중립 여백을 사용한다.
- 지도: `NearbyBrowseMap`과 `KakaoRouteMap` 실제 WebView bridge에서 imageUrl/imageSource/imageEvidence를 제거한다. 주변·상세·추천·코스 확인이 이 두 공용 지도 경계를 사용하며 일반 핀·선택·label·cluster·경로선 계약은 유지된다.
- 사진 변경은 추천 eligibility·장소 ID·분류·운영시간·체류·개인화·저장 계약을 바꾸지 않는다.

## 3. 실행한 테스트

| 명령 | 결과 | 로그 |
| --- | --- | --- |
| 사진 데이터·UI 집중 7파일 | **95/95 PASS** | `/private/tmp/place-photo-all-focus.log` |
| `npm run test:typecheck` | **PASS** | `/private/tmp/place-photo-all-typecheck.log` |
| `npm run test:ui` | **821 PASS / 0 FAIL / 기존 skip 1** (총 822) | `/private/tmp/place-photo-all-ui.log` |
| `npm test` | **572/572 PASS** | `/private/tmp/place-photo-all-all.log` |
| `node scripts/release-build.cjs export` | **PASS** | `/private/tmp/place-photo-all-export.log` |
| export 폐기 문자열 검사 | `photo-marker`, `photo-frame`, `usePhotoMarkers` **0건** | public iOS Hermes bundle |
| `git diff --check` | **PASS** | 오류 없음 |

집중 명령은 `busan-poi-catalog`, `data-release-personalization`, `place-photo-all-r1`, `public-api-photo`, `public-api-photo-screen`, `nearby-browse-map-document`, `place-course-screen-runtime`을 함께 실행했다. 기존 skip 1건은 철회된 순차 대표 교체 이력이며 사진 작업과 무관하다.

public iOS 산출물:

- `/private/tmp/timefit-public-export/_expo/static/js/ios/index-b38200ca46e0d6fb7df66540ddf473c1.hbc`
- SHA-256: `0fc6d32ec1cb9f3e3a6f6c48e0dd99cae22bebb986573db3f75b46e286bf93a0`

이는 public JS/Hermes export 성공이며 Archive·IPA·서명·설치 또는 출시본 동등성 판정은 아니다. 실제 공급자 API와 운영 DB는 호출하지 않았고 Simulator·실기기도 조작하지 않았다.

## 4. 남은 위험과 최소 실기기 확인

수정 빌드에서 한 번만 다음을 확인한다.

1. 추천 카드에서 세로·가로 비율의 실제 사진이 잘리지 않고 어두운 여백과 함께 표시된다.
2. 운영자 승인 사진 장소에는 실제 attribution만 보이고, 확인되지 않은 `사진 출처`·`이용조건` 링크가 나타나지 않는다.
3. 주변 지도와 코스 확인 지도에는 일반 핀·선택 강조·label·cluster·경로선만 보이고 사진 마커는 없다.
4. 네트워크가 느리거나 사진이 실패해도 fallback이 나타나며 카드 선택·상세 진입·카카오 길찾기를 계속할 수 있다.

실기기에서 crop·흰/회색 띠·사진 마커·허위 링크·사진 실패로 인한 흐름 차단이 발견되면 `U-PLACE-PHOTO-ALL-01-R1`에 화면과 장소 ID, 네트워크 조건을 함께 반환한다. 사진 수·ID/URL·승인 metadata 문제라면 `DATA-PLACE-PHOTO-ALL-01`에 반환한다.
