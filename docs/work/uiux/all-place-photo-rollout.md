# U-PLACE-PHOTO-ALL-01-R1 — 전체 장소 사진 UI 적용

상태: **UIUX 구현 및 자동 검증 완료 / 실기기 육안 확인 대기**  
완료일: 2026-09-16

## 변경 이력

- 이전 방식: 검증 사진 101개만 표시하고, 지도에서는 사진 URL을 받아 이미지 마커로 표시했으며 카드 사진은 `cover`와 둥근 clip을 사용했다.
- 관찰된 문제: 데이터가 추가 공개한 `operator_approved` 102개가 UI에서 누락됐고, 지도 사진 마커와 `cover`가 작은 화면에서 식별성과 원본 보존을 해쳤다. 운영자 승인 사진에 확인되지 않은 라이선스 링크를 만들 위험도 있었다.
- 교체한 방식: 카드·상세는 `verified` 101개와 `operator_approved` 102개를 구분해 총 203개를 소비하고 모든 실제 사진을 중립 배경의 `contain`으로 표시한다. 지도는 사진 URL·사진 마커 호환 코드를 제거하고 일반 핀·선택 강조·label·cluster만 사용한다.
- 교체 이유: 데이터 인계의 승인 수준을 정확히 보존하면서 사진 원본 전체를 보여 주고, 지도 조작의 일관성과 가독성을 유지하기 위해서다.
- 상태: **현행**. 과거의 지도 사진 마커 유지·`cover` 표시는 **철회**이며 복원하지 않는다.

## 완료 인수인계

### 1. 변경 파일과 변경 목적

- `src/ui/placePhotoModel.ts`, `src/ui/PlacePhoto.tsx`
  - 101개 `verified`와 102개 `operator_approved`를 분리해 소비한다.
  - 운영자 승인 사진은 실제 attribution만 표시하며 라이선스 이름·출처 링크·이용조건 링크를 합성하지 않는다.
  - 비HTTPS와 최종 URL 불일치는 fallback으로 닫는다. `imageSource` 공급 계열과 evidence 원천 데이터셋은 서로 다른 필드이므로 동일하다고 추정하지 않는다.
  - 사진을 `contain`·중앙 정렬·중립 배경으로 표시하고 사진/frame의 둥근 clip을 제거했다. 실패와 12초 timeout은 기존 fallback을 사용한다.
- `src/ui/NearbyBrowseMap.tsx`, `src/ui/KakaoRouteMap.tsx`
  - WebView payload에서 사진 관련 필드를 제거하고 이미지 마커 분기를 삭제했다. Kakao route 경계는 호출자가 남긴 추가 사진 필드도 전달 직전에 제거한다.
  - 일반 장소 핀, 선택 강조, label, cluster, route geometry는 유지했다.
- `src/ui/placeDetailModel.ts`, `src/ui/recommendation/courseV1CardDetailModel.ts`, `src/ui/PlaceDetailScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`
  - `photoMarkerFields`, `usePhotoMarkers` 및 지도 사진 전달 경계를 제거했다.
- `src/ui/NearbyBrowseScreen.tsx`, `src/ui/recommendation/CourseV1SummaryCard.tsx`, `src/ui/recommendation/CourseV1VerticalDetail.tsx`, `src/ui/recommendation/TwoStopSelectionPanel.tsx`, `src/ui/recommendation/TwoStopSelectionTray.tsx`
  - 주변 목록·상세, 추천 카드, 함께 갈 장소, 선택 tray, 코스 상세의 사진 슬롯에서 둥근 clip을 제거하고 같은 무자르기 계약을 사용한다.
- `test/ui/place-photo-all-r1.test.ts`, `test/ui/public-api-photo.test.ts`, `test/ui/public-api-photo-screen.test.ts`, `test/ui/nearby-browse-map-document.test.mjs`, `test/ui/place-course-screen-runtime.test.mjs`
  - 203개 exact 집계, 승인 등급·표시 문구, 가로/세로/정사각형 contain, 불일치 fallback, 지도 사진 0개, 일반 핀 및 기존 화면 흐름을 고정했다.

### 2. 유지한 공개 계약·정책 경계

- 추천 eligibility·순서·상태, 장소 분류·운영시간·체류, 개인화 및 저장 계약은 변경하지 않았다.
- 카드 선택, 장소 상세 진입, 카카오 길찾기, 코스 진행, 지도 route geometry 및 선택·cluster 행동은 유지했다.
- 기존 101개의 검증된 attribution·라이선스 링크는 유지했다. 신규 102개는 `verified`로 승격하거나 확인되지 않은 권리 정보를 만들지 않았다.
- 데이터 원본·엔진·외부 API·DB·중앙 기준 문서는 수정하지 않았다.

### 3. 테스트 결과

- 실패 선행: 새 R1 집중 테스트 최초 실행에서 `101/203`, 운영자 승인 사진 미표시, 지도 사진 잔존, 사진 둥근 clip의 4개 실패를 재현했다.
- R1 및 관련 집중 회귀: **115/115 통과**.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **819 통과 / 1 skip / 실패 0**.
- `npm test`: **572/572 통과**.
- `git diff --check`: **통과**.
- iOS export: `/private/tmp/timefit-place-photo-r1.tspuin`, 성공.
  - Hermes bundle SHA-256: `b146bd725b67917d6ec8b293b13546db15dac99b8ed00d19f36d39f9fac43f10`
  - 번들에서 `photo-marker`, `photo-frame`, `usePhotoMarkers` 문자열 없음 확인.
- 시뮬레이터·실기기는 사용자 방침에 따라 실행하지 않았다.

### 4. 다음 결정·위험·실기기 확인

- 실기기에서 세로·가로·정사각형 대표 사진이 잘리지 않고 중립 여백과 함께 보이는지 확인한다.
- 주변 지도와 코스/상세 지도에 일반 핀만 보이고 선택 강조·label·cluster·경로선이 기존대로 동작하는지 확인한다.
- 각 원천의 `verified` 1개와 `operator_approved` 1개, 네트워크 실패 1개를 확인한다. 운영자 승인 사진에는 attribution만 보이고 사진 출처/이용조건 링크 버튼이 없어야 한다.
- 사진 로드가 느리거나 실패해도 카드 선택·상세·길찾기가 막히지 않는지 확인한다.
- 실기기 육안 확인 전에는 UIUX 자동 검증 완료와 최종 QA 수락을 구분한다.

## 사용자 반환 보완 — 추천 카드 사진 미표시 (2026-09-16)

### 확인된 원인과 수정

- 사진 데이터와 승인 판정은 추천 카드까지 정상 전달되고 있었다.
- 공용 `PlacePhoto`의 바깥 슬롯에 부모 영역을 채우는 크기 계약이 없어, 주변 상세처럼 너비·높이를 직접 준 화면은 보이지만 추천·코스 카드처럼 부모의 고정 미디어 영역을 사용하는 화면에서는 0 크기로 축소될 수 있었다.
- `PlacePhoto` 기본 슬롯에 `flex: 1`, `minWidth: 0`, `minHeight: 0`을 적용했다. 화면이 명시한 `flex: 0`과 고정 크기는 뒤쪽 style이 그대로 우선하므로 주변 목록·상세의 기존 크기는 유지된다.
- 추천 카드의 실제 공용 사진 슬롯을 실행하는 실패 선행 테스트를 추가했다. 수정 전 `flex`가 없어 실패했고 수정 후 운영자 승인 사진 Image와 채움 크기를 함께 확인했다.

### 사진 비율 여백 제안

- 현행 `contain`은 사진을 자르지 않아 원본과 이용 조건을 가장 안전하게 보존하지만, 세로 사진을 가로·정사각형 슬롯에 넣으면 좌우 여백이 생기는 것이 정상이다.
- **권장안:** `contain`은 유지하고 여백색을 회색 `C.panel2` 대신 카드와 같은 어두운 `C.panel` 또는 사진 전용 near-black 토큰으로 통일한다. 목록의 고정 높이와 스크롤 안정성을 유지하면서 여백 대비만 낮춘다.
- 상세 화면은 후속으로 원본 종횡비를 읽어 합리적인 최소·최대 높이 안에서 프레임 높이를 조절할 수 있다. 목록 카드는 높이가 흔들리지 않도록 고정 프레임을 유지한다.
- `cover`는 사진 일부를 자르고, 확대·흐림 복제 배경은 신규 102개의 변경 허용이 확인되지 않은 상태에서 가공으로 해석될 위험이 있어 적용하지 않는다.
- 사용자가 권장안을 확정해 공용 `PlacePhoto`의 슬롯과 내부 프레임 배경을 카드와 같은 `C.panel`로 변경했다. 사진은 계속 `contain`으로 표시하며 자르기·확대·흐림 가공은 추가하지 않았다.

### 보완 검증

- 추천 사진 집중 회귀: **22/22 통과**.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **820 통과 / 1 skip / 실패 0**.
- `npm test`: **572/572 통과**.
- `git diff --check`: **통과**.
- iOS export: `/private/tmp/timefit-place-photo-r1-followup.nxwUHC`, 성공.
  - Hermes bundle SHA-256: `5dcca94ad85c9feae6613d9fdf1147a78c083e041dd8ea841780d69154cde79a`
- 시뮬레이터·실기기는 실행하지 않았다. 새 빌드에서 장소 추천 대표·다른 장소 카드의 사진 표시와 회색 여백 대비만 육안 확인한다.

## 사용자 확정 보완 — 사진 여백 어두운 배경 적용 (2026-09-16)

### 변경 파일과 목적

- `src/ui/PlacePhoto.tsx`: 서로 다른 사진 비율에서 생기는 회색 레터박스를 카드와 같은 어두운 표면으로 통일했다.
- `test/ui/place-photo-all-r1.test.ts`: 어두운 배경, `contain`, 비가공 표시를 실제 공용 컴포넌트 실행으로 고정했다. 수정 전에는 `C.panel2`가 반환되어 실패했고 변경 후 통과했다.

### 유지한 계약

- 추천 카드 사진의 채움 크기 보완과 승인된 사진 판정은 유지했다.
- 사진 원본 비율을 보존하고 `cover` 자르기, 확대, blur 배경을 적용하지 않았다.
- 지도 마커는 일반 핀을 유지하며 추천·DB·개인화 정책은 변경하지 않았다.

### 테스트 결과

- 사진 집중 회귀: **23/23 통과**.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **821 통과 / 1 skip / 실패 0**.
- `npm test`: **572/572 통과**.
- `git diff --check`: **통과**.
- iOS export: `/private/tmp/timefit-place-photo-r1-dark.C63S7n`, 성공.
  - Hermes bundle SHA-256: `ac941b8805bf7cd24a3d3e17b21a8de64b88d3e0457f90fcae2a31f2ce923ea5`

### 다음 결정·위험

- 사진 비율이 슬롯과 다르면 여백 자체는 남지만 회색 띠가 아니라 카드 배경으로 보인다. 여백을 완전히 없애려면 사진 자르기 또는 카드 높이 가변화라는 별도 UX 결정이 필요하다.
- 시뮬레이터·실기기는 실행하지 않는다. 새 빌드에서 세로 사진이 많은 추천 카드의 어두운 여백과 사진 표시를 사용자가 확인한다.

## 사용자 재확인 — 추천 카드 바깥 미디어색 일치 (2026-09-22)

### 변경 파일과 목적

- `src/ui/recommendation/CourseV1SummaryCard.tsx`, `TwoStopSelectionPanel.tsx`, `TwoStopSelectionTray.tsx`: 공용 사진 슬롯은 이미 `C.panel`이었지만 그 바깥 고정 미디어 영역은 `C.panel2`였다. 세 영역의 바깥 배경도 카드·사진 슬롯과 같은 `C.panel`로 맞춰 경계의 회색 띠를 없앴다.
- `test/ui/place-photo-all-r1.test.ts`: 바깥 미디어와 공용 사진 슬롯의 배경 일치를 실패 선행으로 고정했다. 변경 전 추천 대표 카드의 `C.panel2`에서 실패했고 변경 후 통과했다.

### 유지한 계약

- 승인 사진만 표시하는 `approvedPlacePhoto`와 출처·이용조건 판정, 로딩 실패 fallback을 유지했다. 원본 비율의 `contain`, 고정 카드 크기, 사진 무자르기·무가공, 지도 일반 마커도 유지했다.
- 추천 자격·순서·엔진, 데이터 원본, API, DB, 개인화, 코스 저장은 변경하지 않았다. 사진이 없는 166곳을 사진이 있는 것처럼 표시하지 않는다. live snapshot에 승인 사진이 없을 때 정적 카탈로그 사진을 섞어 넣지 않는다.

### 테스트 결과

- 사진·추천 표시 집중 15/15 통과. `npm run test:typecheck` 통과, `npm run test:ui` 853 통과·1 기존 skip·실패 0, `npm test` 596/596 통과.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-photo-seamless-20260922` 통과. 시뮬레이터·실기기 및 실제 외부 사진 URL 호출은 실행하지 않았다.

### 다음 확인·위험

- 새 빌드에서 실제 추천 장소 중 승인 사진이 있는 장소 ID를 골라 이미지 로딩과 어두운 여백을 육안 확인한다. 해당 장소가 사진 없음·미승인·live snapshot 사진 증거 없음·네트워크 실패 중 무엇인지 구분하려면 장소명 또는 ID와 화면 캡처가 필요하다.
- 원본 비율이 카드 96×96 슬롯과 다르면 사진 주변의 빈 공간 자체는 남는다. 이를 완전히 없애기 위한 crop·가공·가변 카드 높이는 현행 사진 결정과 충돌하므로 이 작업에서 도입하지 않았다.
