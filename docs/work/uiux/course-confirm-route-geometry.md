# U-COURSE-GEOMETRY-01 — 코스 확인 실제 경로 지도

## 상태와 선행 조건

`U-COURSE-GEOMETRY-01`의 snapshot 지도는 수락됐다. 다만 transit 선이 하차지점에서 끊기는 실기기 문제가 확인되어, 사용자가 선택한 코스 상세에서만 private walk connector를 보충하는 `U-COURSE-GEOMETRY-02`가 후속 현행 작업이다. 아래 최초 명령의 “상세 API 0회”는 과거 계약이며, 추천·transit 재조회 0회만 유지한다.

## 사용자 관찰 결과

코스 카드를 누르면 상단 지도에서 설정 출발지→추천 장소→설정 목적지/복귀의 실제 이동 경로를 한눈에 본다. 아래 세로 순서는 기존처럼 이동 시간과 장소 방문을 설명한다.

## 확정 구현 명령

1. `CourseConfirmScreen`은 선택한 `VerifiedCourseV1.legs[].geometry`만 `KakaoRouteMap`에 전달한다. 상세 진입·뒤로가기·재렌더에서 engine/Route Proxy/Kakao REST 호출은 0회다.
2. 지도는 leg 순서대로 모든 path를 별도 polyline으로 그린다. 도보와 대중교통은 색 또는 선 패턴으로 구분하고 작은 범례를 제공한다. `실경로/약식/직선 추정` 같은 과거 quality 범례로 실제 형상을 혼동시키지 않는다.
3. 출발, 순번 장소, 목적지/복귀 marker를 경로선 위에 유지한다. 왕복은 출발·복귀 의미를 한 marker로 표현하되 왕복 두 geometry는 모두 그린다.
4. 전체 geometry와 marker가 보이도록 bounds를 맞추며 safe area/header/하단 CTA에 가리지 않게 padding을 둔다. 경로를 보기 위해 지도를 자동으로 현재 GPS로 이동시키지 않는다.
5. 일부 leg geometry가 없으면 그 구간을 직선으로 대체하지 않는다. 유효한 다른 leg만 그리고 지도 안에 `일부 경로선을 표시하지 못했어요`를 한 번 표시한다. 전부 없으면 marker-only fallback과 같은 문구를 쓰며 세로 순서·코스 시작은 유지한다.
6. 손상 snapshot은 현재 안전 경계를 유지한다. 좌표·geometry 원문, provider 이름, URL을 사용자 오류나 로그에 출력하지 않는다.
7. 결과 카드·추천 수·더 보기·시간/체류·조건부 시장·길찾기 handoff·진행 화면은 변경하지 않는다.

## 필수 UI fixture

- 별도 목적지 one-stop: 두 geometry, 세 marker, 올바른 leg 순서.
- 왕복 one-stop: 출발·복귀 marker 하나와 서로 다른 왕복 두 선.
- walk+walk, walk+transit, transit+walk의 선 스타일·범례·접근성 label.
- 일부 geometry 없음, 전부 없음, 빈 path, 1점 path, 범위 밖 좌표에서 직선 0·오류 문구 1·CTA 유지.
- 긴 geometry의 bounds/padding 입력과 상세 열기/뒤로가기 route 호출 0.
- 지도 WebView 실패에서도 세로 상세와 `코스 시작하기`가 유지된다.

## 소유 경계와 완료

- 수정: `src/ui/`, 관련 UI 테스트, 이 문서.
- 금지: engine/API/migration/data, 추천 순위·호출 상한, 환경값, 작업 보드.
- 타입 검사·관련 UI 묶음·전체 UI/core 테스트·diff check를 실행하고 결과를 기록한다. Simulator 조작은 완료 조건이 아니다.

## 완료 인계 — 2026-09-03

상태: **구현 완료, QA 실기기 확인 대기**

### 변경 파일과 변경 목적

- `src/ui/recommendation/courseV1RouteGeometryModel.ts`: `VerifiedCourseV1.legs[].geometry`를 leg/path 순서의 지도 선으로만 투영하고, 32 path·전체 512점·WGS84 범위·path당 2점 경계를 UI에서도 fail-closed했다. 누락·손상 leg는 선을 만들지 않고 고정 안내 한 건으로 합쳤다.
- `src/ui/CourseConfirmScreen.tsx`: 출발·순번 장소·목적지/출발 복귀 marker와 검증 geometry를 함께 표시하고, 도보/대중교통 범례·접근성 label·누락 안내·확장된 하단 bounds padding을 연결했다. 지도 실패에서도 세로 상세와 `코스 시작하기`를 유지한다.
- `src/ui/KakaoRouteMap.tsx`, `src/ui/map/routeSegments.ts`: 명시적 빈 `segments`를 직선 fallback으로 바꾸지 않게 했고, 선택적 `mode`가 있을 때 도보 파란 실선/대중교통 주황 점선으로 렌더한다. 기존 화면의 quality 표현은 mode가 없을 때 그대로 유지한다. 코스 확인 화면에서만 provider·URL·원문을 숨기는 안전 오류 표현을 선택할 수 있게 했다.
- `test/ui/course-v1-route-geometry.test.ts`, `test/ui/course-v1-card-detail.test.ts`: 별도 목적지/왕복 marker 계약, walk/transit 조합, 다중 path 순서, 일부·전체 누락, 빈 path·1점·범위 밖·512점, 직선 0, 범례/접근성, bounds, route 호출 0, WebView 실패 시 상세/CTA 유지 계약을 고정했다.

### 유지한 계약·정책 경계

- 이전 방식: 코스 확인 지도는 marker만 넘기고 빈 임시 segment를 사용했다. → 관찰: 검증에 사용한 실제 경로 형상을 확인할 수 없었다. → 교체: 같은 `VerifiedCourseV1` snapshot geometry만 별도 polyline으로 표시한다. → 이유: 화면 진입이나 재렌더에서 재조회 없이 추천 근거와 표시를 일치시키기 위해서다. → 상태: **현행**.
- geometry 누락 시 marker 사이 직선으로 보정하는 방식은 사용하지 않는다. 유효한 다른 leg만 남기며 전부 없으면 marker-only다. 상태: **현행**.
- engine/API/Route Proxy/Kakao REST·GPS·DB를 호출하거나 수정하지 않았다. 결과 카드 수·더 보기·시간/체류·조건부 시장·외부 길찾기·진행 화면 계약도 변경하지 않았다.
- `실경로/약식/직선 추정` quality 범례는 코스 확인 화면에서 계속 숨기며, 다른 기존 지도 화면의 기본 동작은 유지한다.

### 테스트 결과

- 선행 실패 재현: 신규 모듈 부재와 marker-only 연결로 관련 묶음 2건 실패 확인 후 구현했다.
- `npx tsx --test test/ui/course-v1-route-geometry.test.ts test/ui/course-v1-card-detail.test.ts`: **13/13 통과**.
- `npx tsx --test test/course-v1-route-geometry.test.ts`: **5/5 통과** — 수락된 2-W snapshot 계약 재확인.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **197 통과 / 1 skip / 0 실패** (총 198).
- `npm test`: **117/117 통과**.
- `git diff --check`: **통과**.
- Simulator/실기기 조작과 외부 API 호출: **수행하지 않음**.

### 다음 결정·위험

- QA는 실제 geometry가 포함된 고정/내부 build에서 별도 목적지와 왕복을 각각 열어 선 순서, marker 중첩, 도보 실선/대중교통 점선의 명암 대비, 긴 경로 bounds와 상·하단 overlay 가림을 확인해야 한다.
- WebView 실패 fixture에서는 안전한 일반 오류만 보이고 세로 상세와 시작 CTA가 계속 동작하는지 확인한다.
- 실제 결과에 geometry가 없다면 UI가 재조회하지 않는 것이 정상이다. 이때 `일부 경로선을 표시하지 못했어요`와 marker-only가 보이며, 원인은 API/engine 소유 작업에서 확인한다.

## 통합 검토 — 2026-09-03

**수락.** 코스 확인은 verified leg의 모든 path를 순서대로 표시하고 도보·대중교통을 구분한다. 일부/전체 geometry 누락·손상에서는 직선을 만들지 않고 안내·marker·세로 상세·시작 CTA를 유지한다. 상세 진입 route 호출과 GPS 재계산은 추가하지 않았다.

- geometry·카드 상세 묶음 13/13 성공.
- 전체 UI 197 성공·기존 skip 1·실패 0, core 117/117 성공.
- 타입 검사와 `git diff --check` 성공.
- Simulator/실기기 및 운영 API 호출은 수행하지 않았으므로 실제 선의 가독성·bounds는 QA의 출시 후보 smoke에서 한 번 확인한다.

## U-COURSE-GEOMETRY-02 — 상세 선택 후 누락 도보선 표시

### 상태·선행 게이트

**선행 충족·수행 가능.** `API-ROUTE-GEOMETRY-03`은 통합 수락됐다. `src/services/privateWalkConnectorProduction.ts`의 `createSupabasePrivateWalkConnectorPort()`를 앱 composition에서 프로세스 수명에 한 번 만들고, `PrivateWalkConnectorPort.getConnector(from, to)`만 사용한다. 렌더마다 factory를 다시 호출해 10분/in-flight 재사용을 무효화하지 않는다.

### 목표

코스 카드 tap으로 `CourseConfirm` 화면을 즉시 연다. 기존 snapshot 선을 먼저 그린 뒤, transit 선이 실제 endpoint에서 50m를 초과해 끊긴 경우만 누락된 실제 walk geometry를 파란 실선으로 이어 보인다. 하차지점→추천 장소가 필수 관찰 대상이고, 동일 기준의 시작 endpoint gap도 같이 보충한다.

### 실패 우선 표시 모델

1. `VerifiedCourseV1` 자체를 수정하지 않는 순수 모델을 `src/ui/recommendation/` 아래에 둔다. 입력은 `course`, 직렬화된 `RecommendationSession`, 런타임 카탈로그 좌표, 선택적 connector geometry다.
2. one-stop 구간의 기대 endpoint를 다음처럼 결정한다: leg 0은 `session.origin → 추천 장소`, leg 1은 `추천 장소 → session.destination`, destination이 null이면 `추천 장소 → session.origin`. `fromId/toId`, stops, catalog 순서가 맞지 않으면 추정하지 않고 connector 0개로 닫는다.
3. `mode=walk`인 leg나 geometry가 없거나 손상된 transit leg는 connector 요청을 만들지 않는다. transit geometry의 첫 유효 점과 기대 시작점, 마지막 유효 점과 기대 종점의 haversine gap만 계산한다.
4. **50m 이하는 호출 0회, 50m 초과는 connector 1개**다. 시작 connector는 endpoint→geometry 첫 점, 종점 connector는 geometry 마지막 점→endpoint 순서로 만든다. endpoint를 기존 transit path에 직선으로 삽입하지 않는다.
5. 유효한 one-stop은 transit leg 최대 2개×endpoint 2개로 **화면 진입 당 connector 최대 4개**다. 조건을 넘는 항목이 4개보다 많으면 fail-closed하고 5번째를 호출하지 않는다.

### `CourseConfirmScreen` 연결

1. 카드 tap은 현재처럼 즉시 navigate한다. 화면은 기존 `course.legs[].geometry`로 지도·마커·세로 상세·`코스 시작하기`를 먼저 렌더한다. connector 응답 전에 전체 화면 spinner나 빈 지도로 막지 않는다.
2. 보충 대상이 있을 때만 지도 내부에 `도보 연결을 확인하는 중이에요`를 한 번 표시한다. 성공 즉시 성공한 connector 선만 기존 segment 앞·뒤에 합성하고 bounds를 다시 맞춘다.
3. connector는 도보 파란 실선, transit은 기존 주황 구분선으로 표시한다. 범례는 실제로 표시된 mode만 중복 없이 읽는다. connector의 `totalMin`은 화면에 새 분 수로 표시하지 않고 기존 이동시간·총시간을 바꾸지 않는다.
4. 동시 요청은 최대 2개로 제한한다. component 언마운트 후 setState를 막고, 돌아오는 순서가 달라도 leg·start/end key로 결과를 결정적으로 배치한다.
5. 일부/전부 실패하면 성공한 선은 보이고, 누락은 `일부 도보 경로선을 표시하지 못했어요`로 한 번만 안내한다. 로그인·CAPTCHA 모달을 열지 않고, 상세·카카오맵 장소 확인·코스 시작 CTA를 계속 사용할 수 있다.
6. proxy 활성화가 false이거나 실행 port가 없으면 connector 호출 0회로 기존 부분 선 UX를 유지한다. 이 기능 때문에 새 Expo env·native dependency·navigation param을 추가하지 않는다.
7. `VerifiedCourseV1`, `RecommendationSession`, 진행 화면에 보충 geometry를 다시 써넣지 않는다. 상세 표시 상태로만 유지해 navigation JSON 직렬화와 추천 snapshot identity를 유지한다.

### 필수 fixture·회귀

- gap 정확히 50m는 0회, 50m 초과는 1회. 경계 fixture는 실제 좌표로 표현한다.
- walk+walk는 0회; transit+walk, walk+transit, transit+transit의 1~4개 connector와 순서를 검증한다.
- 보충 대상이 없는 코스는 connector 호출 0회다. 같은 코스 연타·뒤로갔다 재진입·지도 re-render는 외부 API port의 재사용 결과로 provider 추가 0회다.
- 사용자가 관찰한 재현 fixture는 `origin → transit 하차지점 → walk → 추천 장소 → destination/복귀`가 장소 marker에 실제로 닿는지 검증한다.
- no route·timeout·Auth 부재·손상 geometry·한 connector만 성공을 모두 검증하고, 이 경우에도 직선 0·transit 재조회 0·기존 CTA 유지를 고정한다.
- 상세 보충이 추천 initial/page attempt, 대표/대안 순서, 장소 더 보기, 체류·운영시간, 진행 snapshot, 카카오맵 handoff에 영향 0인지 확인한다.

최소 관련 UI 테스트, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. Simulator·실기기·실제 API 호출은 완료 조건이 아니다. 완료 인수인계 4항목을 이 문서 아래에 남기고, 사용자 명령 전 commit·push를 하지 않는다.

### 수정 경계

- 수정: `src/ui/`, 관련 UI 테스트, 이 문서.
- 금지: `src/services/`, `src/engine/`, `src/data/`, migration, 추천 정책·호출 예산, Auth/CAPTCHA, 작업 보드.

### 2026-09-03 완료 인계 — U-COURSE-GEOMETRY-02

상태: **UIUX 구현 완료, QA-COURSE-GEOMETRY-02 실기기 확인 대기**

#### 변경 파일 / 변경 목적

- `src/ui/privateWalkConnectorComposition.ts`: `EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true'`일 때만 수락된 `createSupabasePrivateWalkConnectorPort()`를 모듈 수명에 정확히 한 번 생성한다. 화면 재렌더·뒤로가기 후 재진입에서도 같은 프로세스 port의 in-flight·10분 메모리를 재사용한다.
- `src/ui/recommendation/courseV1RouteGeometryModel.ts`: one-stop의 `fromId/toId`, stop·catalog·session endpoint와 transit geometry를 먼저 검증한다. 첫/마지막 geometry 점과 기대 endpoint의 haversine gap이 `50m 초과`일 때만 start/end connector를 leg 순서로 만들고, 코스당 최대 4개·동시 최대 2개로 호출한다. 성공 geometry만 `walk` segment로 기존 transit 앞/뒤에 결정적으로 합성한다.
- `src/ui/CourseConfirmScreen.tsx`: 기존 snapshot·marker·세로 상세·CTA를 즉시 렌더한 뒤 connector를 비동기로 보충한다. 진행 중/부분 실패 문구를 지도 안에 한 번 표시하고, 언마운트 뒤 상태 갱신을 막았다. connector 반영 시 active marker 중심 고정을 끄고 전체 geometry+marker bounds를 다시 맞춘다.
- `test/ui/course-v1-route-geometry.test.ts`: 50m/51m, walk/transit 조합별 0~4개, 왕복/목적지, 구조 불일치·손상 geometry, 동시성 2, 역순 응답, 성공/부분/no-route/unavailable/throw, singleton composition과 non-blocking 화면 계약을 추가했다.

#### 유지한 계약

- 이전 방식: 선택한 코스의 transit snapshot이 provider가 준 하차 지점에서 끝나도 그대로 표시했다. → 문제/관찰: 하차 지점과 추천 장소 사이 `51–250m` 도보선이 보이지 않았다. → 교체 방식: 상세 선택 뒤 50m를 초과한 유효 transit 시작·종점만 private walk port로 보충한다. → 교체 이유: 추천 계산을 다시 하지 않고 사용자가 실제 마지막 도보 연결을 확인할 수 있게 하기 위해서다. → 상태: **현행**.
- 정확히 50m 이하는 호출하지 않는다. walk leg, geometry 없음·손상, one-stop identity 불일치는 추정하지 않고 connector 0개로 닫는다. endpoint를 transit path에 직선으로 삽입하지 않는다.
- `VerifiedCourseV1`, `RecommendationSession`, navigation payload, 기존 이동·총시간, 대표/대안 순서, 더 보기, 진행 snapshot과 카카오맵 handoff를 수정하지 않는다. connector 결과는 화면 state에만 존재하며 저장·로그하지 않는다.
- proxy flag false 또는 port 부재는 외부 호출 0회이며 부분 선·marker·세로 상세·CTA를 유지한다. 로그인·CAPTCHA·transit 재조회·자동 재시도·GPS는 시작하지 않는다.
- `src/services/`, `src/engine/`, `src/data/`, migration, `App.tsx`, 작업 보드는 수정하지 않았다.

#### 테스트 결과

- 실패 우선: 신규 request/loader와 composition 부재로 관련 UI fixture **6건 실패**를 확인한 뒤 구현했다.
- `npx tsx --test test/ui/course-v1-route-geometry.test.ts test/ui/course-v1-card-detail.test.ts test/private-walk-connector.test.ts test/qa-course-geometry-integration.test.ts`: **29/29 통과**. 실제 provider/API 호출 0회.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **204 통과 / 기존 1 skip / 0 실패** (총 205).
- `npm test`: **117/117 통과**.
- `git diff --check`: **통과**.
- Simulator·실기기·운영 API 호출: **수행하지 않음**.

#### 다음 결정·위험

- QA-COURSE-GEOMETRY-02에서 route proxy가 활성화되고 기존 Auth session이 있는 출시 후보로 transit one-stop 한 건을 열어, 주황 transit 하차 지점부터 장소 marker까지 파란 도보선이 실제로 닿는지 확인해야 한다.
- 실기기에서는 `도보 연결을 확인하는 중이에요`가 상세/CTA를 막지 않는지, 성공 뒤 bounds 재조정과 범례 대비가 적절한지, 뒤로갔다 같은 코스를 다시 열 때 provider 추가 호출 없이 메모리 reuse가 되는지 확인한다.
- session 부재·만료, no-route 또는 timeout이면 `일부 도보 경로선을 표시하지 못했어요`가 한 번 보이는 것이 정상이며, 추천 시간과 기존 transit 선은 그대로여야 한다.

### 2026-09-03 통합 검토 — U-COURSE-GEOMETRY-02 수락

- UI는 기존 snapshot·마커·상세·CTA를 먼저 렌더하고, 유효한 transit leg의 50m 초과 시작·종점 gap만 private walk connector로 비동기 보충한다. walk leg·손상 geometry·identity 불일치는 추가 호출 없이 닫힌다.
- 앱 모듈 수명 singleton, 화면당 최대 4개·동시 최대 2개, 응답 순서와 무관한 결정적 합성, 성공선만 파란 walk segment로 표시하는 계약을 코드에서 확인했다. 추천 snapshot·시간·순위·navigation payload는 수정하지 않는다.
- 통합 세션이 관련 계약 **29/29**, `npm run test:typecheck`, `npm run test:ui` **204 통과·1 skip**, `npm test` **117/117**, `git diff --check`를 독립 재확인했다. 실제 Kakao·Supabase·GPS 호출과 Simulator·실기기 조작은 하지 않았다.
- 상태: **수락**. 다음은 `QA-COURSE-GEOMETRY-02`의 자동 통합 하네스와 사용자 실기기 transit one-stop 1회다. 50m를 20m로 낮추는 안은 별도 사용자 결정 전에는 현행 계약을 바꾸지 않는다.
