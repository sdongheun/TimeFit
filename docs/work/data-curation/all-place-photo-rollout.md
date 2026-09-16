# DATA-PLACE-PHOTO-ALL-01 — 저장된 장소 사진 203개 데이터 인계

상태: **데이터 구현·고정 fixture 검증 완료 / UI·QA 후속 필요**  
기준 결정: `docs/work/integration-decision/all-place-photo-rollout.md`  
기록일: 2026-09-16

## 결과와 교체 이력

이전 방식 → 부산 명소 85개·부산 맛집 16개만 `verified`로 런타임에 투영하고, 부산 쇼핑 29개·TourAPI 73개는 저장 후보가 있어도 기본 이미지로 닫았다.

발생한 문제/관찰 → 사용자 결정은 저장 후보 203개를 모두 표시하되, 추가 102개를 권리·라이선스 검증 완료로 오인하지 않는 별도 상태를 요구한다.

교체한 방식 → 기존 101개 행은 바이트 의미가 같은 `verified/api_service` 계약으로 보존하고, 쇼핑 29개와 TourAPI 73개를 정확한 `contentId/source/sourceId/imageUrl`의 `operator_approved/operator_decision` 행으로 추가했다. 런타임은 203개 사진과 166개 fallback을 생성한다.

교체 이유 → 표시 결정과 저작권 검증을 분리하면서 저장된 사진을 UI 후속 작업에 전달하기 위해서다.

상태 → **데이터 현행 / UI 소비 구현 전**. 현재 `src/ui/placePhotoModel.ts`는 `verified`만 소비하므로 새 102개는 `U-PLACE-PHOTO-ALL-01` 전까지 화면에 표시되지 않는다.

## 변경 파일과 목적

- `scripts/build_public_api_photo_permissions.mjs`: 203개 exact 연결과 `verified 101 / operator_approved 102` 계약을 결정적으로 생성한다.
- `scripts/runtime_image_permission.mjs`: 두 상태를 분리 투영한다. 운영자 승인 행에는 확인하지 않은 권리자·라이선스·상업/변경 허용 필드를 만들지 않는다.
- `scripts/build_runtime_poi_catalog.mjs`: `203 표시 / 166 fallback`과 원천별 `85/16/29/73`을 빌드 중 fail-fast 검증하고 summary에 기록한다.
- `scripts/audit_release_personalization_data.ts`: 새 상태별 집계와 권리 미확인 원천 집계를 소비한다.
- `data/processed/review/사진_이용허락_허용목록.json`: 203개 표시목록. 모든 ID/URL은 고유하고 HTTPS이며 exact key 중복은 0건이다.
- `data/processed/review/출시_사진개인화_데이터_감사.json`, `src/data/busan_poi_catalog.json`: 새 계약으로 재생성한 감사·런타임 산출물이다.
- `test/data-release-personalization.test.mjs`, `test/busan-poi-catalog.test.mjs`: 상태·원천별 exact 수, 연결 일치, 허위 권리 metadata 부재를 회귀로 고정한다.

## 변경하지 않은 공개 계약·정책 경계

- 기존 `verified` 101개 행은 변경 전후 SHA-256 `8c8b5927d9a723c6f8668377e38bc680dd93153a2b3bd71109d871c37c80d675`로 동일하다.
- 사진 필드를 제외한 369개 장소 행의 의미 SHA-256은 `cd4611c0a08bae3aee5bed56f2ac672ec05e59a705f18389f8daadb47fb20e92`로 동일하다. 추천 분류·등급·좌표·주소·운영시간·체류·개인화·Kakao 계약을 바꾸지 않았다.
- TourAPI 과거 HTTPS 검증은 URL 도달성 근거로만 보존했다. 사진별 공공누리 유형, 권리자, 라이선스, 크롭/변경 허용으로 승격하지 않았다.
- UI·추천 엔진·DB·외부 API adapter·중앙 정책 문서를 수정하지 않았다. 외부 API와 운영 DB 호출은 0회다.

## 실행한 검증

- 실패 우선 `npx tsx --test test/data-release-personalization.test.mjs test/busan-poi-catalog.test.mjs`: 변경 전 12건 중 3건 실패로 101/203 차이와 `operator_approved` 미지원 재현.
- 구현 후 같은 테스트: 12/12 통과.
- `npx tsx scripts/audit_release_personalization_data.ts`: 통과, `203 표시 / 166 fallback` 및 provider 수 유지.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 816건 중 815 통과·1 skip·실패 0.
- `npm test`: 572/572 통과.
- `git diff --check`: 통과.

## 다음 세션의 결정·위험·재현 조건

- UI 세션은 먼저 기준 결정 문서와 이 문서를 읽고 `approvedPlacePhoto`가 `verified`와 `operator_approved`를 구분해 소비하도록 구현한다. 새 상태에서 확인되지 않은 라이선스 이름·링크·변경 허용 문구를 표시하면 안 된다.
- 첫 검증은 런타임 203개 중 UI 허용 수가 203인지, 실패·timeout·비HTTPS·ID/URL 불일치 fixture가 기본 이미지로 닫히는지 확인한다.
- `operator_approved` 102개는 운영자 표시 결정일 뿐 개별 저작권 이용허락 검증이 아니다. 부산 쇼핑 서비스 조건과 TourAPI 사진별 공공누리 유형은 계속 미확인 위험으로 남는다.
- QA 세션은 원천별 1개와 실패 fixture를 카드·상세·추천 지도·주변 지도에서 확인하고 iOS 번들 검증을 별도로 수행한다.
