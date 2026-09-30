# U-LIVE-PUBLIC-DATA-SURFACES-02 — 추천 화면 live 표시 연결

2026-09-22. 상태: **UI 연결·고정 fixture 완료 / 기본 OFF / 실제 공급자·실기기 미확인**.

## 이전 방식 → 관찰 → 교체 방식 → 이유

- 이전: 추천 계산은 sealed live 세션을 사용할 수 있어도 Results·장소 상세·코스 확인은 번들 `busan_poi_catalog.json`의 표시 이름·좌표·설명·사진을 다시 읽었다.
- 관찰: 같은 장소 ID의 오래된 사실이 화면과 경로/시간 계산 사이에 섞이고, 동적 상세·2곳 선택·더보기가 정적 성공처럼 보일 수 있었다.
- 현행: flag ON의 최종 live projection에서 화면용 사실만 뽑아 메모리의 추천 `session`에 결속한다. 세 화면은 같은 resolver를 사용한다. 진행 코스의 기기 로컬 복구에는 선택한 1~2곳의 ID·이름·좌표·카테고리/활동 유형만 보존한다. 주소·설명·운영시간·사진/출처는 영속 저장하지 않으며 cold restore에서는 해당 부가 정보를 새 원천 사실인 양 복구하지 않는다. live 장소가 없으면 정적 카탈로그로 대체하지 않는다. flag OFF는 기존 정적 조회를 유지한다.
- 이유: 살아 있는 추천 세션에서는 결과→상세→선택→코스 확인→진행의 장소 사실을 같은 조회 snapshot에 고정하고, 프로세스 종료 뒤에는 경로·완료 기록의 필수 정체성만 복구하기 위해서다. 공급자 원응답·인증 토큰·전체 후보 목록·상세 표시 원문은 영속 저장하지 않는다.
- 상태: **구현·자동 검증**. 실제 Edge/API·실기기는 미검증이다.

## 변경 파일과 목적

- `src/ui/recommendation/livePublicDataSession.ts`, `src/ui/recommendation/v1Session.ts`: 세션 최종 projection을 sealed 결과와 함께 확인하고 live 표시 정보를 등록한다. 막힌 원천은 기존대로 실패로 닫는다.
- `src/ui/recommendation/livePlacePresentation.ts`: live 표시 사실의 단일 조회 경계, 정적 fallback 금지, 선택 장소의 최소 경로/완료 정체성만 active 코스 복구에 보존한다. 구조화 운영시간만 요일/시간으로 표시하고 미확인은 확인 필요로 둔다.
- `src/ui/ResultsScreen.tsx`, `src/ui/PlaceDetailScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: 카드·상세·마커·도보 연결·진행 단계·완료 기록의 장소 조회를 같은 session resolver로 통일한다.
- `src/ui/placePhotoModel.ts`, `src/ui/PlacePhoto.tsx`: 현재 URL과 정확히 일치하는 승인된 부산 live 사진 증거만 표시하고 출처를 제공한다. 권리/URL 불일치 및 이미지 로딩 실패는 기본 이미지다.
- `test/ui/live-public-data-surfaces.test.ts`: RED 모듈 부재 확인 후 live 우선·정적 재승격 금지·선택 장소 복구·OFF 호환·사진 승인/불일치 fixture를 추가했다.

## 유지한 계약

- `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED === 'true'` 외에는 OFF. 기존 공개 화면/화면 문구/정적 추천/개인화/경로 예산/선택 intent는 변경하지 않았다.
- 새 provider 호출, 세션 재조회, 추천/DB/엔진 정책 변경, 원시 API 응답·토큰·전체 후보 목록의 navigation 저장, 운영 데이터 변경은 없다. active 복구에는 선택한 장소 1~2곳의 최소 ID·이름·좌표·카테고리/활동 유형만 저장한다. 이는 지도 경로와 완료 기록에 필요한 기존 선택 코스 정체성이지 TourAPI 원본 응답 저장이 아니다. 부가 표시 정보를 재시작 뒤에도 원형 그대로 유지하려면 3.5의 별도 보존 승인/수명 결정이 선행되어야 한다.
- 승인되지 않은 새 사진은 URL 존재만으로 허용하지 않는다. 출처 표시와 기본 이미지 fallback을 유지한다.

## 검증 결과·다음 결정 및 위험

- 실패 선행: 새 UI 표시 경계가 없어 `Cannot find module`로 RED 확인. 이어서 선택 코스에 설명·주소·사진/운영시간을 과다 직렬화하는 반례를 RED로 확인하고 최소 정체성만 남기도록 수정했다.
- 집중 UI fixture 15/15 PASS. `npm run test:typecheck` PASS. `npm run test:ui` 838 PASS / 0 FAIL / 기존 1 SKIP (총 839). `npm test` 591/591 PASS. 샌드박스의 `tsx` IPC `EPERM` 때문에 UI 명령은 허용된 테스트 환경에서 동일 명령을 재실행했다.
- 최소 복구 수정 후 `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED=false npx expo export --platform ios --output-dir /private/tmp/timefit-live-surfaces-minimal.LvWXrj` PASS. Hermes bundle `index-98680ccc7abec7fceae322aa0ed6628a.hbc` SHA-256 `f2376b8b41e06d98becf02eecfe5d56201835935415074e88698e14facf3754a`. 실제 API, Simulator, 실기기, 배포, commit/push는 실행하지 않았다.
- **NearbyBrowseScreen 보류:** 주변 둘러보기는 약속 시간·추천 세션과 무관하게 사용자가 기준 장소를 선택하는 별도 3km 진입이다. 현재 sealed 추천 snapshot을 재사용하면 선택 위치/시각뿐 아니라 운영시간이 없는 Tour-only 장소의 표시 자격도 틀릴 수 있다. 탭 진입마다 새 facade를 만들면 초기 Tour catalog 1회 + Busan snapshot 1회(내부 최대 3개 원천)와 필요 시 Tour 상세 최대 4배치를 추가한다. 즉 한 진입이 대략 3~6회 이상 공급자 조회·연속 지연으로 이어질 수 있고, 추천의 30곳 상세/경로 예산과 별도 수명을 설계해야 한다. 마스터 계획도 주변용 `locationBasedList2`는 개인정보·호출량 검토 후로 조건을 걸었다. 통합 인계에 따라 데이터 역할의 별도 browse read model 감사·계약을 기다린다. 그 전에는 지도 pan마다 재호출하거나 source 없는 시장-only를 정적 live 성공으로 포장하지 않는다. 기준 위치 전송 범위, 새 세션 캐시/TTL·일일 호출량, 부분 장애·재시도 UX와 사진 정책이 다음 결정 항목이다.
- 위 Nearby 보류는 당시 상태의 이력이다. 이후 별도 초기 snapshot read model 계약이 제공되어 지도 pan/재선택 호출0의 화면 연결을 [`live-nearby-connect.md`](live-nearby-connect.md)에서 구현했다. 당시 비로그인 no-session은 미수락이었으며 2026-09-22의 U-LIVE-NEARBY-GUEST-AUTH-04에서 명시적 CAPTCHA 경로로 보완했다. 운영 활성화·실기기 검증은 여전히 미수락이다.
- QA/실기기: flag ON에서 실제 1·2곳/더보기의 세 화면 장소 사실과 카카오맵 좌표가 일치하는지, 이미지 로딩 실패·출처 링크, active cold restore 후 경로/완료 기록 및 부가 정보의 안전한 미표시, 원천 업데이트 중 화면 불변, OFF 회귀를 확인한다. live Edge 배포·승인 전 flag를 켜지 않는다.

## U-LIVE-STATIC-FACT-AUDIT-05 — 남은 번들 사실 노출 감사 (2026-09-22)

### 이전 방식 → 관찰 → 교체 방식 → 이유

- 이전: Home의 진행 중 코스 제목은 `placeIds`를 무조건 번들 카탈로그 이름으로 풀었다.
- 관찰: live ON에서 선택한 장소 이름을 세션에 보존했어도 Home으로 돌아오면 같은 ID의 오래된 이름이 다시 보였다. cold restore에서도 선택한 최소 정체성의 제목은 이용할 수 있다.
- 교체: Home은 `resolveRecommendationPlace(active.session, id, staticLookup)`로 현재 active 코스가 가진 live 이름을 먼저 사용한다. live 선택 정보가 손상·누락되면 번들 이름으로 재승격하지 않고 일반 `현재 V1 코스`를 표시한다. OFF는 원래 번들 이름을 유지한다.
- 이유: 진행 코스에 이미 보존된 표시값만 사용해 원천 사실 혼합을 막기 위해서다. 상태: **현행 UI 수정·자동 검증 완료**.

### 1. 변경 파일과 목적

- `src/ui/HomeScreen.tsx`: active live session의 선택 장소 이름 사용, OFF 정적 경로 유지. 새 원천 호출이나 저장 필드 추가 없음.
- `test/ui/live-static-fact-audit.test.mjs`: 실제 Home 화면 실행 fixture로 live 이름 우선, OFF 번들 유지, live 정체성 누락 시 stale 이름 미노출을 고정했다. 첫 사례는 수정 전 실패했다.

### 2. 유지한 계약 및 감사에서 보류한 경로

- `ResultsScreen`, `PlaceDetailScreen`, `CourseConfirmScreen`은 이미 같은 session resolver를 사용한다. `NearbyBrowseScreen`은 ON의 별도 live 목록, OFF의 번들 목록으로 분기한다. `TimeSetupScreen`의 번들 `qaPlaceNames`는 `__DEV__ && EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'`에서만 열리는 내부 QA receipt용이며 공개 추천 장소 표시가 아니다. 이번에는 변경하지 않았다.
- `AccountRecordsPanel`의 목록 이름은 완료 기록 자체의 `place.title`을 사용하므로 현재 번들 이름을 새 기록명으로 덮어쓰지 않는다. 다만 기록의 카카오맵 링크와 `ActivityStatistics`/`BusanVisitVectorMap`/`CompletedPlacesMapButton`의 지도·구 분류는 `contentId`로 현재 번들 좌표를 재조회한다. 계정 완료 기록 계약은 `contentId/title/category/subCategory`만 보존하고 과거 좌표나 기준 버전이 없다. 같은 ID의 좌표가 바뀐 경우 실제 방문 당시 위치를 판정할 근거가 없으므로 추측 변경하지 않았다. 데이터/DB·통합 결정에는 과거 좌표·이름의 의미, 기존 기록의 표시/링크 처리와 새 기록 최소 snapshot 계약이 필요하다.
- 추천/DB 정책, 기록·복원 구조, 원본 데이터, 외부 API, 사진 승인, 개인정보 경계는 변경하지 않았다. 과거 기록을 live 현재 위치로 덮어쓰거나 새로운 위치로 승격하지 않았다.

### 3. 실행 테스트와 결과

- Home 실행 fixture RED 1건 확인 후 3/3 PASS. `npm run test:typecheck` PASS, `npm run test:ui` **861 PASS / 기존 skip 1 / 실패 0**, `npm test` **602/602 PASS**. 실제 API·시뮬레이터·실기기·운영 데이터·flag 설정 변경 없음.

### 4. 다음 결정·위험·재현 조건

- 실기기에서 live ON 코스 시작→Home 이어서 하기 제목→앱 재시작 뒤 제목이 선택 당시 이름으로 유지되는지 확인한다. 같은 ID의 번들 이름과 live 이름이 다른 고정 fixture는 자동 검증됐다.
- 과거 완료 기록은 `contentId`가 현재 번들 좌표와 달라졌을 때 지도·카카오 링크가 과거 방문 위치를 나타낸다고 보장할 수 없다. 데이터/DB 계약 없이 UI가 원천을 임의 선택하지 않는다. 결정 후 기록 지도/링크와 새 완료 snapshot을 별도 작업으로 검증해야 한다.
