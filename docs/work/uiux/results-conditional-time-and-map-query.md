# U-RESULTS-04 — 조건부 실제 시각 노출·카카오 주소 확인

## 상태

수락. QA-RESULTS-01의 새 iOS 실기기 관찰로 두 문제를 확인했다. 조건부 시장 카드는 추천 시작 시각이 17:59이면 실제 18:00 이후에도 남았고, verified Kakao Place ID가 없는 카드의 browser fallback은 `장소명 + 좌표` 검색으로 장소를 찾지 못했다. 이는 엔진·카탈로그·Route Proxy의 실패가 아니라 결과 UI의 시간/외부 전환 경계다.

## 목적과 확정 계약

1. `운영시간 확인 후 들러볼 곳`은 대표 추천·검증 대안이 아닌 **정보 확인용 조건부 발견 영역**이다. 구조화 운영시간을 보장하지 않으며, 카카오맵에서 사용자가 직접 확인한 뒤에만 그 한 곳의 실제 경로 계산을 요청할 수 있다.
2. 조건부 영역의 렌더링 기준은 `session.nowIso`나 개발용 테스트 시각이 아니라 **기기의 실제 현재 시각**이다. `10:00 ≤ actualNow < 18:00`에만 카드·더 보기·수동 계산 CTA를 보인다. 18:00 경계를 넘거나 앱이 foreground로 돌아온 뒤 범위를 벗어나면 이미 표시한 카드도 즉시 숨긴다.
3. 대표·검증 대안의 고정 입력, 실제 시간표, continuation, 조건부 수동 계산의 경과 시간 차감은 변경하지 않는다. CTA 자체의 실제 시각 gate와 18:00 이후 route 0 규칙은 유지한다.
4. 장소 확인은 다음 우선순위다.
   - verified Kakao Place URL/숫자 Place ID가 있으면 기존 공식 URL/scheme.
   - 없으면 카탈로그 `addr1`의 상세 주소만으로 Kakao HTTPS 검색.
   - 주소가 없거나 행정구역 수준으로 넓으면 좌표는 **검색어가 아닌 지도 위치 보기** URL로만 사용.
   - 장소명과 위도·경도를 하나의 검색어로 결합하는 fallback은 폐기한다.

## 수정 범위와 금지

- 수정 가능: `src/ui/`, UI 순수 model/계약 테스트, 이 문서와 UIUX README의 현재 작업 링크.
- 수정 금지: `src/engine/`, `src/data/`, 카탈로그 원본, Route Proxy/API adapter, Supabase, 제품 정책 문서, `docs/작업조정_보드.md`.
- 카카오 REST 재조회, 주소를 이름으로 추정·보정, 운영시간 수집, route/receipt 호출, navigation/DB에 runtime context 저장을 추가하지 않는다.

## 구현 명령

### 1. 조건부 표시 시각을 추천 세션에서 분리

1. `verifiedCourseResultsModel`의 조건부 페이지/표시 모델이 `session.nowIso`를 직접 노출 판정에 쓰지 않게 바꾼다. 표시 시각은 테스트에서 주입 가능한 `actualNow: Date`로 받는다. 후보의 거리 정렬 기준과 `session`의 출발/도착 좌표, 카탈로그의 기준 날짜 필터는 그대로 유지한다.
2. Results 화면은 실제 시각 상태를 별도로 관리한다. 화면 진입, 앱이 `active`로 복귀할 때, 그리고 다음 10:00 또는 18:00 경계에서 갱신한다. 1분 interval을 상시 실행하지 말고 다음 경계까지의 단일 timer와 AppState listener를 정리(cleanup)한다.
3. 실제 시각이 범위 밖이면 기존 `conditionalPlaces`, cursor, 수동 결과 state가 메모리에 남아 있어도 `ConditionalVisitSection` 전체와 그 안의 더 보기/CTA를 렌더하지 않는다. `showMoreConditionalPlaces`도 같은 실제 시각 gate 밖에서는 state 변경 0이어야 한다.
4. 18:00 직전 CTA가 시작되어 18:00 이후 완료되는 비동기 결과는 기존 2-R/3-C의 안전한 상태 처리만 쓴다. 새 route 재시도·자동 승격·대표/대안 병합을 만들지 않는다.

### 2. 카카오 장소 확인 fallback을 주소 중심으로 교체

1. `CourseV1DisplayPlace`와 결과/코스 확인에서 전달되는 장소 표현에 `addr1?: string | null`을 보존한다. 런타임 카탈로그의 원본 주소를 화면에서 버리지 않는다.
2. 공통 opener의 URL 생성은 순수 함수로 분리/갱신한다.
   - verified Kakao URL은 그대로 최우선이다.
   - 상세 주소는 `https://map.kakao.com/link/search/{encodeURIComponent(addr1)}` 형식의 검색 query 하나만 쓴다. title·lat·lon은 붙이지 않는다.
   - 상세 주소 판정은 빈 값/광역시·구처럼 세부 위치가 없는 행정구역을 주소 검색으로 가장하지 않도록 명시적인 순수 predicate로 둔다. 원천 주소를 수정하거나 도로명 주소를 발명하지 않는다.
   - 상세 주소가 없으면 `https://map.kakao.com/link/map/{encodeURIComponent(title)},{lat},{lon}` 같은 좌표 **지도 보기**를 사용한다. title은 지도 레이블일 뿐 검색 query가 아니다.
   - `kakaomap://look?p=lat,lon`의 설치 앱 우선 동작은 계속 허용한다. `kakaomap://place?id=`는 verified 숫자 ID에만 쓴다.
3. `openKakaoPlaceWithAppFallback`의 app-first → HTTPS → browser fallback 횟수(각 최대 한 번), 성공 enum, 일반 오류 문구와 route/receipt/추천 상태 0 호출 계약을 유지한다. weak Place URL을 verified URL처럼 직접 열거나 Place ID를 추정하지 않는다.

## 필수 고정 검증

1. 조건부 actual clock fixture:
   - 동일 `session.nowIso=17:59`에서 actual 17:59는 카드 8개 이하/더 보기 규칙을 보이고, actual 18:00은 카드·더 보기·CTA 0이다.
   - actual 09:59/10:00/17:59/18:00 경계, 17:59에 렌더 뒤 18:00 timer 갱신, background→18:00 foreground 복귀를 고정한다.
   - 범위 밖 `showMoreConditionalPlaces`는 cursor·렌더 목록·route/API 호출을 바꾸지 않는다. 기존 조건부 수동 CTA의 18:00 route 0 fixture를 유지한다.
   - 대표/검증 대안, continuation, diagnostics 및 개발용 추천 시작 시각은 위 표시 갱신으로 바뀌지 않는다.
2. Kakao opener fixture:
   - verified URL/verified Place ID, 상세 `addr1`, 빈 주소, 광역시·구 수준 넓은 주소, invalid coordinate, app available/unavailable/open throw, HTTPS throw→browser의 각 URL과 호출 순서를 검사한다.
   - 상세 주소 분기는 주소만 decode하여 비교하고, URL에 title 뒤 위도·경도 검색 문자열이 없는지 검사한다.
   - 넓은/없는 주소 좌표 fallback은 search URL이 아니라 map view URL이어야 한다. route/receipt/선택 검증은 모든 링크 분기에서 0회다.
3. `npm run test:typecheck`, 관련 `npx tsx --test` UI fixture, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 실제 Kakao/Route Proxy/Supabase 요청은 0회여야 한다.

## 완료 인계

변경 파일과 각 변경 목적, 유지한 대표/대안/조건부 상태 경계, 실행 테스트 결과, 새 iOS internal build에서 QA-RESULTS-01이 한 번 확인할 실제 시각/주소 fallback 시나리오를 이 문서에 네 항목으로 남긴다. 보드는 수정하지 않는다.

### U-RESULTS-04 완료 인계 (2026-08-31)

1. **변경 파일 / 목적**
   - `src/ui/ResultsScreen.tsx`: 조건부 발견 영역의 표시 시각을 기기 실제 시각 상태로 분리했다. 화면 진입·foreground 복귀·다음 10:00/18:00 경계의 단일 timer에서만 갱신하며, 범위 밖에서는 기존 카드·더 보기·수동 CTA를 렌더하지 않고 더 보기 handler도 state 변경 없이 끝낸다.
   - `src/ui/recommendation/verifiedCourseResultsModel.ts`: `conditionalVisitPage`가 `session.nowIso` 대신 주입된 `actualNow`로 표시 여부를 판정하도록 바꾸고, 다음 경계까지의 순수 timeout 계산을 추가했다.
   - `src/ui/recommendation/courseV1PlacePreviewModel.ts`: `addr1`을 장소 표시 계약에 보존하고, verified Kakao URL/숫자 Place ID 다음에는 상세 주소 검색, 빈·광역시/구 수준 주소에는 제목 레이블과 좌표의 지도 보기 URL을 사용하도록 분리했다. `장소명 + 위도·경도` 검색 fallback은 제거했다.
   - `test/ui/verified-course-results.test.ts`, `test/ui/course-v1-place-preview.test.ts`, `test/map-transport-ui-contract.test.mjs`: actual clock 경계·foreground 동등 gate·주소만의 검색 query·좌표 지도 보기·app→HTTPS→browser 한 번씩의 fixture 및 화면 계약을 보완했다.

2. **유지한 계약·정책 경계**
   - 대표 추천/검증 대안, continuation, 조건부 후보의 카탈로그 기준일 필터와 출발·도착 거리 정렬, 조건부 수동 CTA의 기존 18:00 route 0 gate는 변경하지 않았다.
   - verified URL/verified 숫자 Place ID의 공식 Kakao URL/scheme 우선순위, app→HTTPS→browser 각 최대 1회와 typed 결과 enum을 유지했다. route·receipt·추천·DB/API 호출을 추가하지 않았고, 보드·엔진·카탈로그·외부 API 경로도 수정하지 않았다.

3. **실행 테스트 / 결과**
   - `npm run test:typecheck` — 통과.
   - `npx tsx --test test/ui/verified-course-results.test.ts test/ui/course-v1-place-preview.test.ts` 및 `node --test test/map-transport-ui-contract.test.mjs` — 29개 통과. 로컬 fixture만 사용, 외부 요청 0회.
   - `npm run test:ui` — 153개 중 152개 통과, 기존 철회 시나리오 1개 skip, 실패 0.
   - `npm test` — 109개 통과.
   - `git diff --check` — 통과.

4. **다음 결정·위험·재현 조건**
   - 새 iOS internal build에서 QA-RESULTS-01은 `session.nowIso=17:59` 결과를 실제 17:59에 열어 조건부 카드/더 보기/CTA가 보이는지, 18:00 경계 대기 또는 background 후 18:00 foreground 복귀 직후 전체가 사라지는지 1회 확인해야 한다.
   - verified ID 없는 상세 `addr1`은 브라우저 fallback에서 주소만 검색되는지, 빈 주소와 `부산광역시 부산진구` 같은 넓은 주소는 search가 아닌 좌표 지도 보기 URL인지 확인한다. 카카오맵 설치/미설치와 HTTPS 실패도 각각 app→HTTPS→browser 1회 규칙을 확인한다.

### 통합 수락 — 2026-08-31

- 완료 범위와 네 항목 인계를 대조했다. 실제 시각 gate는 `session.nowIso`와 분리되어 18:00 경계·foreground 복귀·더 보기 차단을 모두 갖고, 지도 fallback은 verified URL/ID 우선·상세 주소 검색·좌표 지도 보기의 세 경계를 지킨다.
- 재실행: `npm run test:typecheck`, 관련 UI fixture 16/16, 화면 계약 13/13, `npm run test:ui` 152 pass·기존 skip 1, `npm test` 109/109, `git diff --check` 모두 통과했다.
- 다음은 코드 보완이 아니라 QA-RESULTS-01의 새 iOS internal build 제한 실기기 게이트다. 카카오 실제 제공사 응답·주소 품질을 더 수집하거나 재시도하지 않는다.
