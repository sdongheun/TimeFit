# DATA-LIVE-HISTORY-LOCATION-SNAPSHOT-PREP-07 — 과거 기록 표시용 위치 참조 분리 감사

상태: **읽기 전용 감사·최소 계약 제안 / 산출물 생성·UI 연결 전**  
작성일: 2026-09-23  
근거: `docs/work/db-personalization/live-history-cutover-audit-02.md`  
외부 API·운영 DB·Simulator 호출: **0회**

## 결론과 이력

이전 방식 → `CompletedPlacesMapButton`, `BusanVisitVectorMap`, `AccountRecordsPanel`이 `src/data/busan_poi_catalog.json` 전체를 직접 import하고, 저장 완료의 `contentId`로 현재 번들 주소·좌표·Kakao 확인값을 조회한다.

관찰 → 계정 완료 장소 테이블과 기기 완료 DTO에는 `contentId/title/category/subCategory`가 있지만 주소·좌표·원천 ID는 없다. 목록·방문 횟수는 완료 자체로 보존되나 지도·지역 필터·Kakao 열기는 카탈로그에 의존한다. 현재 번들 좌표를 기록 당시 실제 방문 위치로 해석할 수 없고, 추천 live 원천으로 바꿔 끼우면 과거 ID의 동일성·좌표 이동 문제가 생긴다.

교체 제안 → **기록 표시 전용의 불변 ID→위치 참조 snapshot**을 승인된 현재 카탈로그 기준선에서 별도 생성한다. 추천 live projection·시장 browse snapshot·원천 최신 사실과 별개로 관리하고, 완료 행은 수정하지 않는다. UI 연결은 UI 역할에서 별도 검증 후 수행한다.

교체 이유 → 번들 전체 원천 사실 import를 제거할 준비를 하면서 기존 완료 목록과 지도 보조 기능을 삭제 없이 유지하기 위해서다.

상태 → **제안/구현 전**. 이번 작업은 코드·JSON을 생성·삭제하거나 화면을 바꾸지 않았다.

## 소비자별 실제 필드

| 소비자 | 완료 행에서 오는 값 | 현재 카탈로그에서 읽는 값 | 위치 참조가 없을 때 |
| --- | --- | --- | --- |
| `completedPlaceMarkers` → `CompletedPlacesMapButton` | `contentId`, marker label용 완료 `title` | `contentId`, `lat`, `lon` | 점만 제외, 방문 기록 유지. 중복 ID는 1점 |
| `buildBusanVisitMap` → `BusanVisitVectorMap` | `contentId`, 표시 `title`, 방문 횟수 | `addr1`에서 구군·동네 파싱, `lat`, `lon`, 화면 분류 `category`, Kakao용 `mapVerification` | `unlocatedCount`로 보존, 지역 필터/카카오 목록에서 제외 |
| `AccountRecordsPanel.openPlace` | 완료 `contentId/title` | 위 `buildBusanVisitMap`으로 주소·좌표·분류·Kakao 값 | 완료 목록은 남고 카카오 열기만 실패 상태 |
| `openCompletedPlaceInKakao` | 완료 title로 source title 덮어씀 | 상세 주소, 좌표, `mapVerification.status/placeId/placeUrl` | 검증 URL → 상세 주소 검색 → 좌표 보기 순으로 선택; 불충분하면 열기 실패 |

현재 `buildBusanVisitMap`의 `category`는 번들 값이지만, 완료 행에도 category가 저장돼 있다. 장기 계약은 **저장된 완료 category를 사용**하는 편이 정확하다. UI를 바꾸기 전 완전한 동일 동작을 유지하려면 snapshot에 category가 필요하며, 이 중복 필드 소유는 UI/DB 역할과 결정해야 한다. snapshot의 `title`은 필요하지 않다. 현재 코드가 항상 완료 title로 덮어쓴다. `subCategory`, 운영시간, 설명, 사진, 체류, 추천 등급, 원천별 live ID는 세 소비자의 위치 표시 계약에 불필요하다.

## 최소 snapshot 제안과 생성 기준

제안 schema: `contentId`(고유 키), `addr1?`, `lat`, `lon`, `mapVerification? { status, placeId?, placeUrl? }`, UI 변경 전의 임시 호환 `category?`; 파일 metadata에는 `purpose=historical_display_reference`, `baselineCatalogHash`, `generatedAt/기준 revision`, `notVisitTimeLocation=true`를 둔다. 원천별 최신성·영업 여부를 나타내는 필드는 넣지 않는다. Kakao 확인값은 `verified`이고 숫자 placeId·HTTPS `place.map.kakao.com` 링크가 실제로 유효한 행만 좁혀 보존하는 방안을 권장한다. 나머지는 주소 검색/좌표 보기 fallback 계약으로 분리한다.

생성기는 승인된 `src/data/busan_poi_catalog.json`의 `matched.data + unmatched.data` 369개를 결정적으로 ID 정렬하고, ID 중복·비유한/범위 밖 좌표·Kakao URL/ID 형식·필드 누출을 fail-fast 검증해야 한다. 원본 카탈로그 삭제나 현행 화면 import 교체 전에 snapshot 대조 테스트를 둔다. 기존 기록에 카탈로그 외 ID가 있어도 신규 장소를 이름·좌표 유사도로 매칭하지 않는다. 해당 완료는 계속 목록에 남기고 위치만 미확인 처리한다. snapshot은 client-visible 번들 자료이지 DB 백필·실제 방문 좌표가 아니다.

현행 기준선의 읽기 전용 집계: 369개 행/고유 ID 369, 유효 좌표 369, 비어 있지 않은 주소 367, 현행 구군 parser가 해석하는 주소 366(`poi_790`, `poi_797`, `poi_816` 제외), category 369, Kakao status `verified 178 / weak 29 / unverified 162`; verified 178개는 숫자 placeId와 검증 호스트 HTTPS URL을 가진다. `placeUrl`이 369개 있어도 검증되지 않은 191개를 확인된 Kakao 장소 링크로 승격하지 않는다. 이 수치는 **현재 카탈로그의 커버리지**이지 실제 계정/guest 완료의 지도 표시율이 아니다. 실제 기록 ID 분포는 원격 조회하지 않았다.

## 정확성 한계와 인계

- 좌표·주소는 기록 당시가 아닌 검토 카탈로그 기준선이다. 장소 이전·폐업·명칭 변경 뒤에는 지금의 길찾기 대상으로도 부정확할 수 있다. 화면에는 “기록 당시 위치”라고 쓰지 말고, 필요하면 “저장된 장소 위치 참조”로 구분한다.
- 추천 live 원천에서 같은 `contentId`의 최신 위치를 얻더라도 이를 과거 완료 좌표로 소급하지 않는다. live 추천 stale fallback 금지를 완화하거나 snapshot을 추천 후보·시간 계산에 섞지 않는다.
- 기존 완료 title/category/subCategory와 snapshot의 category가 다를 수 있다. 표시 분류는 완료 당시 값 우선이 권장되며, 현재 UI의 catalog category 사용은 교체 시 별도 테스트가 필요하다.
- 정확한 위치가 없거나 ID가 매칭되지 않으면 지도 점·구군 필터·카카오 CTA만 미확인/비활성화하고 완료 목록·시각·횟수·owner/guest provenance는 보존한다. 완료 기록 삭제나 DB 백필은 필요하지 않다.
- 첫 후속 검증: 고정 fixture에서 369개 exact ID의 기존 지도 점·구군·Kakao 동작과 새 참조를 비교하고, ID 누락·주소 없음·검증되지 않은 Kakao URL·이동 장소를 fail-closed로 확인한다. 이후 UI 역할이 세 direct import를 교체하고 기본 OFF/ON 및 guest/account 기록을 회귀한다.

변경 파일은 본 문서 하나다. 추천 정책, 엔진, 화면, 원본/런타임 JSON, DB schema·기록, API adapter는 변경하지 않았다. `npx tsx -e` 로컬 정적 집계와 UI/DB 코드 대조만 수행했고 외부 호출·commit/push는 하지 않았다. 생성 방식·분류 소유·위치 불명확 표시 문구는 후속 UI/통합 결정이 필요하다.
