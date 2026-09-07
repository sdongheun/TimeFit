# U-PUBLIC-API-PHOTO-01 — 공식 API 사진 표시 복구

상태: **데이터 101건 인계 반영·UI 표시 연결 및 자동 검증 완료, 실제 기기 이미지 로딩/시각 확인 전**. 조건 미확인 102건은 보류한다. UI 준비만으로 끝낸 상태와 구분하며 아래 2026-09-07 UIUX 인수인계를 따른다.

## 목적·현행 결정

추천 카드·장소 상세·코스·주변 목록·지도 마커에서 공식 API 사진을 조건에 맞게 표시한다. 원형 마커 디자인은 유지한다. 사진이 없거나 로드 실패하면 기존 기본 이미지/아이콘을 유지한다.

이전: 개별 사진의 변경 허용 증명이 없으면 전부 비노출 → 관찰: 공식 API 단위 이용허락을 충분히 반영하지 않아 허용목록이 비고 URL이 생성되지 않음 → 교체: API 단위 허락도 유효한 근거로 인정하되 사진의 정확한 원천 연결과 적용 조건을 보존 → 이유: 사용 가능한 공공 사진을 불필요하게 배제하지 않음 → 상태: 결정 확정·데이터/표시 구현 전. 별도 허락서를 사진마다 받도록 요구하지 않는다. 모든 사진의 무조건 변경 허용을 의미하지 않는다.

확인 근거(2026-09-07):

- 부산 명소 API: https://www.data.go.kr/data/15063481/openapi.do — 이미지 포함, 이용허락범위 제한 없음.
- 부산 맛집 API: https://www.data.go.kr/data/15063472/openapi.do — 이미지 포함, 이용허락범위 제한 없음.
- TourAPI: https://www.data.go.kr/data/15101578/openapi.do — 앱 활용 가능, 사진 공공누리1·3유형, CI/BI 등 제한 명시.
- 유형: https://www.kogl.or.kr/info/faqList.do?dataGroup=2&mstIdx=KOGL_005 — 1유형 출처표시/변경 가능, 3유형 출처표시/변경금지.
- 부산 쇼핑 API는 원천 확인됐으나 이번 조사에서 라이선스 페이지 확인은 미완료다. 명소·맛집 조건을 자동 전용하지 않는다.

## 원인과 소유 경계

`scripts/runtime_image_permission.mjs`는 exact 허용목록과 modificationAllowed=true를 요구한다. `data/processed/review/사진_이용허락_허용목록.json`이 비어 있어 generator가 공개 imageUrl을 생략한다. 따라서 UI Image 스타일만 고쳐서는 복구되지 않는다. 이는 확인된 데이터 단계 원인이며, 네트워크/스타일 문제는 허용 URL 연결 뒤 별도로 판별한다.

UIUX는 src/ui와 해당 테스트만 수정한다. 원천/카탈로그/generator/허용목록/provider는 데이터 세션 소유다. UI가 legacy 이미지·imageEvidence의 미승인 URL을 우회 사용하거나 원천 API를 화면에서 직접 호출하지 않는다. 추천 정책·장소 수/ID·시간·DB·Live Activity·env·서버 배포는 변경하지 않는다.

## 데이터 세션에 전달할 선행 계약

1. 저장된 원천과 URL을 재사용해 사진별 API/sourceId/정확한 URL 연결을 검증한다. 공식 API 이용조건을 공통 증거로 저장하고 각 사진에 연결할 수 있다. 기관 호스트만 일치하는 URL이나 같은 장소의 다른 사진을 일괄 승인하지 않는다.
2. 부산 명소/맛집은 위 API 허락과 별도 예외 유무를 확인하고 허용 목록을 생성한다. 쇼핑은 해당 서비스 조건을 먼저 확인한다. TourAPI는 해당 사진의 유형/출처 근거를 확인한다. 미확인 유형을 1유형으로 추정하지 않는다.
3. 우선 현재 계약으로 표시 가능한 변경 허용 사진을 복원한다. 3유형의 전체 원본 표시를 지원하려면 modificationAllowed=false 및 표시 조건이 provider까지 전달되는 계약안을 먼저 UIUX에 인계한다. 기존 true-only 게이트를 단순 삭제하거나 false를 true로 위조하지 않는다. 확인 전 사진은 기본 이미지 유지.
4. generator로 재생성하며 보호 필드/후보 수 불변을 검증한다. 현재 허용 수·유형별 수·미확인 수, 최종 공개 필드와 출처표시 조건을 본 작업에 인계한다. 모든 사진을 확인할 때까지 이미 허용된 사진 복원을 막지 않는다.

## UIUX 실행 순서

1. AGENTS.md, docs/README.md, UIUX 공통 규칙, 본 문서를 읽는다. 기존 추천/상세/코스/주변 목록/마커의 이미지 소비와 provider→snapshot 전달을 추적한다. 데이터 없음과 로드 실패를 구분하는 고정 fixture를 먼저 만든다.
2. 허용된 URL·출처·표시 조건만 전달받아 렌더링한다. 허용 metadata가 snapshot 변환에서 유실되면 해당 UI 소유 변환을 보완하고, 다른 역할 경계는 인계한다. 과거 저장 코스의 URL은 현행 허락으로 재확인 없이 신뢰하지 않는다.
3. 변경 허용 사진은 기존 카드 크롭/원형 마커를 유지한다. 변경금지 또는 유형 미확인 사진은 원형 사진 크롭에 넣지 않고 기본 원형 아이콘을 사용한다. 변경금지 사진을 허용된 전체 이미지 방식으로 표시하는 계약이 확정된 경우에만 해당 화면에서 원본 구도 보존·비율 유지·필터/잘라내기 없이 표시한다. 원형 마스킹의 법적 적합성을 구현자가 임의 확정하지 않는다.
4. 필요한 출처·유형과 원문 링크는 사용자가 확인 가능한 장소 상세에 표시하고, 원천별 추가 표시 조건을 따른다. 접근성 label만 출처표시로 간주하지 않는다. 좁은 마커에 긴 출처를 강제로 넣는 대신 연결된 상세에서 확인하도록 하되 해당 라이선스 조건과 대조한다.
5. 로딩/404/timeout/오프라인/이미지 없는 장소는 기본 이미지로 안정적으로 전환한다. 실패 시 무한 재시도나 레이아웃 붕괴, 카드 선택·지도 제스처 회귀가 없어야 한다. HTTPS 실패를 ATS 전체 예외나 무조건 HTTP로 우회하지 않는다.

## 검증·완료 기준

- fixture: 허용 이미지 정상, URL 없음, 로드 실패, 미허용 과거 URL, 변경 허용 원형, 변경금지 원형 fallback, 출처 metadata 전달, 목록/상세/코스/지도 소비 일치. 공개 entry 동작을 검증하고 문자열 검사만으로 완료하지 않는다.
- 변경 후 npm run test:typecheck, npm run test:ui, npm test 및 iOS bundle 검증. 데이터 세션은 generator 결정성·허용목록·보호 필드 회귀를 실행한다. 외부 API 반복 호출0.
- 자동 검증 후 사용자 실기기 최소 목록: 추천 카드 사진, 상세 사진/출처, 코스 사진, 주변 목록/원형 마커, 이미지 없는 장소/실패 fallback. 시뮬레이터 수동 클릭 반복을 필수로 추가하지 않는다.
- 데이터 인계 전이면 UI fixture 준비 완료/실제 복구 대기를 구분한다. 최종 공개 URL 수가0인데 전체 복구 완료로 적지 않는다. 허용 가능한 사진만 복구하고 미확인 사진은 정확한 잔여로 보고한다.
- 인수인계: 변경 파일·목적 / 유지 계약 / 테스트 결과와 실제 확인 여부 / 허용·제한·미확인 사진 수 및 다른 역할 잔여. 중앙 정책/출시 문서의 전부 불허·옛406건 표기 정정은 통합·출시 세션에 반환한다. commit/push/원격 게시0.

## 데이터 선행 계약 인계 — 2026-09-07

### 변경 파일과 목적

- `scripts/build_public_api_photo_permissions.mjs`: 저장된 런타임 원천에서 실제 선택될 사진을 다시 계산하고, 확인된 API 서비스 단위 허락을 정확한 `contentId/source/sourceId/imageUrl` 연결 row로 생성한다. 사진별 별도 허락서를 요구하지 않는다.
- `data/processed/review/사진_이용허락_허용목록.json`: 계약 version 2. 부산 명소·맛집 API의 공통 이용허락 근거와 사진 101개의 정확한 연결, 원천별 허용·보류·사진 없음 집계를 보존한다.
- `scripts/runtime_image_permission.mjs`: `permissionBasis=api_service`와 서비스명·공식 원문·이용조건이 완전하고 단일 사진 연결이 정확할 때만 공개한다. URL/기관 호스트만 같은 경우, 중복 row, 다른 원천 ID는 계속 차단한다.
- `scripts/build_runtime_poi_catalog.mjs`, `src/data/busan_poi_catalog.json`: 생성기를 통해 허용 사진 101개를 공개 카탈로그에 복원했다.
- `scripts/audit_release_personalization_data.ts`, `data/processed/review/출시_사진개인화_데이터_감사.json`, `test/data-release-personalization.test.mjs`, `test/busan-poi-catalog.test.mjs`: 허용 원천·수량, 보류 원천, 기본 이미지 수와 보호 필드 불변을 감사·회귀한다.

### 공식 근거와 현재 허용 범위

- 부산 명소 API `https://www.data.go.kr/data/15063481/openapi.do`: 이미지 URL 필드를 명시하며 이용허락범위는 `제한 없음`. 정확히 연결된 85개를 허용했다.
- 부산 맛집 API `https://www.data.go.kr/data/15063472/openapi.do`: 여행사진·이미지 정보를 제공하며 이용허락범위는 `제한 없음`. 정확히 연결된 16개를 허용했다.
- 두 서비스 모두 공개 runtime의 `imageSource`는 `busan_official`이다. `imageEvidence.source`는 각각 `busan_attraction`/`busan_food`, `sourceId`는 공식 `UC_SEQ`다.
- 공개 metadata 계약은 `imageUrl`, `imageSource`, `imageEvidence.source`, `imageEvidence.sourceId`, `imageEvidence.usagePermission`이다. `usagePermission`에는 `basis=api_service`, `serviceName`, `rightsHolder=부산광역시`, `sourcePageUrl`, `licenseName=이용허락범위 제한 없음`, `licenseUrl`, `attribution`, `attributionRequired=false`, `displayConditions`, `commercialUseAllowed=true`, `modificationAllowed=true`, `verifiedAt=2026-09-07`이 들어간다.
- 법적 필수 출처표시 조건은 없는 것으로 연결했지만, UI가 사용자에게 보여줄 출처 문구는 각각 `사진 제공: 부산광역시 부산명소정보 서비스`, `사진 제공: 부산광역시 부산맛집정보 서비스`로 제공한다. 원문 링크도 함께 전달되므로 장소 상세에서 표시할 수 있다.

| 상태 | 전체 | 대표 후보 | 처리 |
| --- | ---: | ---: | --- |
| 공개 허용 | 101/369 | 84/191 | 명소 85 + 맛집 16 |
| 기본 이미지 | 268/369 | 107/191 | URL 없음 또는 조건 미확인 |
| 조건 미확인 사진 후보 | 102 | 별도 집계는 허용목록 참조 | 부산 쇼핑 29 + TourAPI 73 |
| 저장 사진 후보 없음 | 166 | - | 기존 기본 이미지 |

TourAPI 공식 페이지는 사진이 공공누리 1·3유형으로 섞여 있음을 명시한다. 저장 근거에는 각 사진의 유형이 없어 1유형으로 추정하지 않았고 73개 모두 보류했다. 3유형은 변경금지라 현재 crop 가능한 UI의 `modificationAllowed=true` 게이트에도 들어갈 수 없다. 부산 쇼핑 API 29개도 해당 서비스 이용조건을 확인하지 못했으므로 명소·맛집 조건을 전용하지 않았다.

### 유지한 계약·정책 경계

- 런타임 369, 대표 191, `conditional_more` 178, discovery 369, 조건부 시장·거리 142를 유지했다. 사진 때문에 장소를 추가·제외하거나 등급을 바꾸지 않았다.
- 사진 필드·빌드 시각·승인된 세부분류 외 보호 의미 hash는 기대값 `9944c5a86051d7d63c8b29d10da069690ff613e211e2ce623731bdb390b79820`과 일치한다. 장소 ID·좌표·주소·category/subCategory·운영시간·체류 기준·Kakao 계약은 불변이다.
- 사진 로드 성공 여부를 운영 네트워크로 101회 반복 확인하지 않았다. HTTPS 원천 URL만 투영했고, 로드 실패는 기존 UI fallback 계약에 맡긴다.
- 추천 정책·UI 구현·엔진·API/cache·DB/migration·중앙 정책 문서는 수정하지 않았다. public route snapshot은 대표 ID·좌표 불변이므로 재동기화가 필요 없다.

### 검증 결과와 UIUX 잔여

- 실패 우선 데이터 fixture는 복원 전 허용 사진 `0 != 101`과 새 API 단위 permission metadata 누락을 재현했다.
- 데이터·provider·route snapshot·UI 사진 계약 집중 회귀: 22/22 통과.
- 허용목록 생성기와 런타임 생성기를 연속 두 번 실행했다. 허용목록은 byte 동일, 런타임은 `meta.generatedAt` 제외 byte 동일이었다.
- `npm run test:typecheck`: 병렬 UI 파일 `test/ui/public-api-photo-screen.test.ts:38,44`의 `openURL` mock 타입 오류 2건으로 실패했다. 데이터 코드 타입 오류는 없다.
- `npm run test:ui`: 561개 중 559 통과·기존 skip 1·실패 1. 병렬 UI의 `place-course-screen-runtime.test.mjs:67` 카드 배열 기대 불일치다. `npm test` 실행도 같은 UI 작업 중 fixture 오류로 실패했다. 데이터 역할은 이를 수정하지 않았다.
- `npx tsx scripts/audit_release_personalization_data.ts`: 공개 101, 기본 이미지 268, 개인화/후보/보호 hash 불변으로 통과했다.
- UIUX의 첫 검증은 실제 카탈로그의 허용 명소 1개·맛집 1개·보류 쇼핑 1개·보류 TourAPI 1개를 고정 fixture로 사용해 목록/상세/코스/마커의 사진·출처·fallback을 확인하는 것이다. 이용조건 전체 row는 `사진_이용허락_허용목록.json`을 읽는다.
- 실제 API 반복 호출·이미지 다운로드·DB·Simulator·원격 쓰기·commit/push는 하지 않았다.

## UIUX 완료 인수인계 — 2026-09-07

### 1. 변경 파일·목적

- `src/ui/placePhotoModel.ts`: 데이터의 공개 `imageUrl` 및 `imageEvidence.usagePermission` 검증 경계. 확인된 상업/변경 허용, 출처/라이선스/원문/검증일과 HTTPS를 확인한다. URL만 존재하거나 변경금지/미확인이면 fallback이다. 별도 허락서를 요구하거나 API 단위 근거를 거절하지 않는다.
- `src/ui/PlacePhoto.tsx`: 실제로 여러 화면이 공유하는 이미지 로딩/성공/실패 처리. 로딩 중 기본 이미지를 유지하고 404/오프라인/onError 및 12초 timeout은 fallback으로 정착한다. 늦은 성공이 timeout을 뒤집지 않고 자동 재시도하지 않는다. URL/허락 문구 변경은 새 keyed 요청이다. `PlacePhotoCredit`은 보이는 출처·라이선스와 상세의 원문/이용조건 링크, 링크 실패 안내를 제공한다.
- `src/ui/currentPlacePhoto.ts`: legacy/과거 저장 장소는 contentId로 현행 공개 카탈로그만 재조회한다. 저장된 과거 URL/허락 정보를 그대로 재사용하지 않는다.
- `src/ui/recommendation/{CourseV1SummaryCard,TwoStopSelectionPanel,TwoStopSelectionTray,CourseV1VerticalDetail,CourseV1PlacePreview,ExplorationPlaceCard,CandidateDetail}.tsx`: 공용 이미지/fallback 소비. 추천 카드와 코스에 출처 표시, 상세에 출처 링크 연결. 선택 tray는 이미 확인한 장소 상세의 출처와 연결된 compact 표시다.
- `src/ui/{PlaceDetailScreen,NearbyBrowseScreen,OneStopResultsScreen}.tsx`: 상세·주변 목록/상세·legacy 코스 사진을 동일 경계에 연결한다. 원래 제목/CTA/카카오 동작을 유지한다.
- `src/ui/{nearbyBrowseModel,placeDetailModel}.ts`, `src/ui/recommendation/{courseV1PlacePreviewModel,courseV1CardDetailModel}.ts`: 공개 metadata 전달 및 마커 사진 누락 보완.
- `src/ui/ResultsScreen.tsx`: A/B tray에 URL뿐 아니라 imageSource/imageEvidence를 전달한다. `src/ui/CourseConfirmScreen.tsx`: 기존 실제 경로 지도에 사진 마커 옵션을 연결한다. 진행·handoff는 바꾸지 않았다.
- `src/ui/{KakaoRouteMap,NearbyBrowseMap}.tsx`: WebView 전달 직전 이용조건 재검사, 허용 사진만 기존 원형 마커 유지. 기본 마커를 로딩/실패/timeout 동안 보존한다. 미확인 URL은 bridge에서 제거한다. 주변 지도는 로딩 성공 뒤에만 사진을 노출한다.
- 새 UI 테스트 `public-api-photo.test.ts`, `public-api-photo-screen.test.ts`, `fixtures/approvedPhoto.mjs`; 기존 `course-v1-place-preview.test.ts`, `place-course-screen-runtime.test.mjs`, `nearby-browse-{screen,map-document}.test.mjs`를 현행 사진 fixture에 맞춰 보완했다.

### 2. 유지 계약·전달 경로와 교체 이력

- 이전 URL만 검사하는 화면과 화면별 실패 상태 → 미허용 URL 표시 가능·출처 누락·코스 마커 사진 전달 누락·오래 유지되는 실패 상태 → 공용 허락/로딩 경계와 명시 metadata 전달로 교체 → 화면별 차이를 줄이고 허용 사진만 복구하기 위함 → **현행 구현**.
- V1 provider/engine snapshot은 장소 ID·경로/시간을 전달한다. UI는 해당 ID로 **현재 공개 카탈로그**를 조회하여 추천 summary/상세/코스에 원문 metadata를 그대로 사용한다. 엔진 snapshot에 사진 권한을 새 저장하거나 엔진 타입/정책을 변경할 필요가 없었다.
- 변경금지 사진의 전체 이미지 표시 계약은 아직 인계되지 않았으므로 새로 구현/추정하지 않는다. 변경금지·미확인 사진의 원형 마스킹은 하지 않는다. 현재 공개된 101건은 모두 변경 허용이다.
- 원천·generator·provider·허용목록·카탈로그는 데이터 세션 변경을 읽기만 했다. UI가 `imageEvidence` 안의 다른 URL이나 과거 사진을 우회 사용하지 않는다.
- 장소 수/ID·운영시간·추천/session 예산·DB·Live Activity·앱 인증·env/ATS·지도 경로/제스처·플로팅 탭바·시트 배치 불변. 중앙 문서/보드 수정, stage/commit/push/원격 게시 없음.

### 3. 검증 결과와 실제 복구 구분

- **데이터 인계 전**: 기존 공개 URL 0건 상태에서 fixture로 UI를 준비했다. 최초 실패 재현 3건은 미허용 URL이 image로 분류됨, 변경금지 사진이 image로 분류됨, marker의 이용조건 누락이었다.
- **데이터 인계 후**: 같은 문서의 데이터 인계 및 허용목록 v2/감사 산출물을 확인했다. 실제 공개 101개 모두 현재 카탈로그 조회·추천/상세/주변 변환에서 같은 허용 사진으로 해석되는 것을 자동 확인했다. 따라서 현재는 UI 준비만 완료/URL 0 대기가 아니라 **공개 101건의 앱 표시 경로 복구 완료**다. 서버의 실제 이미지 응답 성공이나 실기기 화면 확인을 의미하지 않는다.
- 고정 인계 사례: `poi_19` 동백공원(명소 허용), `poi_1047` 웨이브온커피(맛집 허용), `poi_13` 부산 자갈치시장(쇼핑 보류), `poi_1` 해운대 관광특구(TourAPI 보류). 추천 summary·장소 상세·코스 상세/마커·주변 데이터의 허용/fallback 일치 확인.
- production TSX handler 실행: 추천 카드 사진 성공/실패 후 선택 유지, timeout/late success/재요청 없음, 출처 링크 성공/실패, 주변 목록→상세 사진/출처/실패→목록 복귀 확인. 두 production WebView bridge에 정상/미허용/변경금지를 넣어 허용 URL만 전달됨을 검증했다. 기존 실제 CourseConfirm review→active 카드/사진/지도/길찾기와 지도 HTML 파싱·실행 회귀도 유지했다.
- 최종 `npm run test:typecheck` PASS, `npm run test:ui` **565건 중 564 PASS·기존 skip 1·FAIL 0**, `npm test` **274/274 PASS**, `git diff --check` PASS. 데이터 인계의 중간 `openURL` mock 타입 오류 및 사진 출처 링크 추가에 따른 기존 카드 배열 기대 오류는 수정했고 위 최종 전체 회귀로 대체한다.
- iOS Expo bundle PASS: `/private/tmp/timefit-photo-export`. 로그 `/private/tmp/timefit-photo-ui.log`, `/private/tmp/timefit-photo-core.log`, `/private/tmp/timefit-photo-export.log`.
- 운영 API/이미지 다운로드·DB 호출 0. Simulator·실기기 자동 조작 0. 이미지 `onLoad/onError`는 fixture 주입이며 실제 로딩 결과로 보고하지 않는다.

### 4. 현재 허용·제한·미확인 및 남은 확인

- 데이터 인계 기준: **허용 101(명소 85·맛집 16)**, 조건 미확인 **102(쇼핑 29·TourAPI 73)**, 저장 사진 없음 **166**. 기본 이미지 총 **268**. 대표 후보 사진은 **84/191**이다. TourAPI의 개별 1/3유형 수는 미확인이므로 변경금지 확정 건수를 임의로 집계하지 않는다.
- 데이터 후속: 쇼핑 서비스 조건, TourAPI 사진별 유형/출처 근거를 확인하고 공개 URL/표시 계약을 인계한다. 미확인 전체를 변경 허용으로 올리거나 다른 서비스 조건을 전용하지 않는다.
- 사용자 실기기 최소 확인: (1) 허용 명소/맛집 추천 사진과 카드 tap (2) 장소 상세 사진·출처/이용조건 링크 (3) 1·2곳 코스 review/active의 사진과 원형 마커 (4) 주변 목록/마커/상세 연결 (5) 보류/사진 없음 기본 아이콘 (6) 오프라인/로드 실패 시 기본 이미지와 카드·지도 조작 유지. iOS 네트워크 응답·작은 화면 출처 가독성은 미확인이다.
- 통합/출시 세션 반환: 과거 문서의 사진 전체 비노출·406건/URL 0 표기는 이 결정과 **101/369** 현행 인계로 정정하되, 미확인 사진 보류와 실기기 검증 전 상태는 유지한다.
