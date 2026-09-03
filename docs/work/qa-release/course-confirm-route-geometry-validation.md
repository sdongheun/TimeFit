# QA-COURSE-GEOMETRY-01 — 코스 확인 실제 경로선 검증

## 상태와 시작 조건

`QA-COURSE-GEOMETRY-01`은 운영 smoke에서 **transit 선이 하차역에서 끊기고 추천 장소까지 마지막 도보선이 없는 것**을 확인하고 종료했다. 해당 관찰은 아래 `QA-COURSE-GEOMETRY-02`로 후속한다. `API-ROUTE-GEOMETRY-03`과 `U-COURSE-GEOMETRY-02`가 수락되기 전에는 재실행하지 않는다.

## 자동 검증 명령

1. 고정 walk/transit provider 응답→sanitized cache→client adapter→engine exact route→verified course legs→CourseConfirm map segments를 한 하네스에서 실행한다.
2. provider miss와 public cache hit의 geometry·totalMin·mode가 동일하고, 두 번째 실행의 새 provider attempt가 0인지 확인한다.
3. private origin/destination은 geometry가 화면까지 오지만 public cache/lease/로그/geometry DB write가 0인지 spy로 확인한다. 비식별 provider quota 예약 RPC는 기존 계약대로 허용한다.
4. one-stop 왕복·별도 목적지·혼합 수단의 두 leg가 올바른 순서와 marker/bounds를 만드는지 snapshot 구조로 비교한다.
5. 일부/전체 geometry 없음·손상·상한 초과·지도 실패에서 직선/근사선 0, 시간표·CTA 유지, 추가 route 호출 0을 확인한다.
6. 추천 initial/page 8회, 고유 장소 누적, 조건부 시장, 카카오맵 길찾기, CAPTCHA/Proxy, navigation 직렬화 회귀를 함께 실행한다.

## 합격 기준

- 실제 Kakao fixture의 두 leg가 각각 2점 이상의 precise path로 화면 model에 도달한다.
- 화면 geometry는 추천 시간 계산에 사용한 route index·mode와 동일하다.
- 상세 진입 및 왕복에서 신규 route/API 호출 0이다.
- public cache hit shape 보존, private 영속 write 0, 민감 좌표 로그 0이다.
- geometry 실패가 추천 실패나 직선 표시로 바뀌지 않는다.
- 타입·전체 UI·core 테스트 실패 0, 기존 명시 skip만 유지한다.

## 수동 smoke

자동 게이트 수락 뒤 통합·결정 세션이 운영 반영을 별도로 승인한다. 적용 순서는 `202609030014_route_proxy_geometry_cache.sql` migration 성공 확인 → Route Proxy Edge 배포다. 그 뒤 사용자가 새 출시 후보 internal build의 실기기에서 one-stop 한 건만 확인한다. 코스 확인 지도에 출발→장소와 장소→목적지/복귀 두 선이 보이고, 세로 이동 분·수단과 선 스타일이 대응하며, 코스 시작 뒤 카카오맵 길찾기가 기존대로 열리는지만 본다. 반복 API 호출·여러 장소 캡처는 요구하지 않는다.

## 소유 경계

QA는 기능 코드를 수정하지 않는다. fixture·통합 하네스·출시 문서·이 문서만 수정하며 Simulator를 직접 버튼별로 반복 조작하지 않는다.

---

## 2026-09-03 — 자동 통합 검증 완료 인계

### 1. 변경 파일과 변경 목적

- `test/qa-course-geometry-integration.test.ts`: 로컬 Route Proxy handler, 메모리 cache, client adapter, release one-stop engine, CourseConfirm 지도/marker model을 한 흐름으로 연결했다. public provider miss→cache hit, private 왕복, 손상 geometry의 세 고정 fixture를 추가했다.
- `docs/work/qa-release/course-confirm-route-geometry-validation.md`: 자동 통합 결과, 유지 경계, 출시 판정과 다음 단계를 기록했다.

기능 코드, migration, Edge Function, 카탈로그, 환경값과 `docs/작업조정_보드.md`는 수정하지 않았다.

### 2. 자동 통합 구조화 결과

| fixture | provider/cache receipt | engine leg snapshot | CourseConfirm map/marker | 판정 |
| --- | --- | --- | --- | --- |
| public 별도 목적지, walk+transit | 첫 실행 provider 3회·cache 3건·attempt 3, 두 번째 provider 추가 0·attempt 0·leg reuse 2 | `origin→place` walk 5분, `place→destination` transit 7분; 두 leg 모두 3점 precise geometry, miss/hit leg 완전 동일 | leg 순서대로 walk/transit segment 2개, 출발·장소·목적지 marker 3개, bounds 입력에 두 끝점 포함 | 통과 |
| private 왕복, walk+transit | provider fixture 3회, public cache 0, cache get/put·lease 0, geometry DB write 0, 로그 0; 예산 reserve만 기존 계약대로 수행 | `origin→place` walk, `place→origin` transit의 서로 다른 geometry 보존 | segment 2개, `출발·복귀` 단일 marker+장소 marker로 총 2개 | 통과 |
| private 손상 geometry | 정확 시간 receipt는 유지, provider fixture 3회 뒤 상세 model 추가 호출 0 | geometry만 제거하고 one-stop course와 `totalMin=52` 유지 | segment/직선 0, marker 2개·`일부 경로선을 표시하지 못했어요`·상세/CTA 계약 유지 | 통과 |

- 첫 실행은 QA 하네스 기대값의 계층이 잘못되어 2/3이었다. public cache hit은 하위 Proxy 응답 3개를 재사용하지만 엔진 diagnostics는 두 **leg receipt**를 기준으로 reuse 2를 집계한다. 공개 진단 의미에 맞춰 QA 기대값만 교정한 뒤 3/3을 재현했다. 기능 코드는 변경하지 않았다.
- 기존 fixture에서 일부/전체 geometry 누락, 빈/한 점 path, 범위 밖 좌표, 32/33 paths, 512/513 points, WebView 실패 모두 직선 fallback·추천 탈락·상세 route 재호출 없이 안전 종료됨을 함께 재확인했다.

### 3. 유지한 공개 계약·정책 경계

- geometry는 추천 시간에 사용한 동일 route index·mode의 선택 snapshot이며 추천 ID·순위·시간·attempt·continuation을 바꾸지 않는다.
- public cache는 정제된 WGS84 geometry만 기존 key/TTL/lease 경계로 재사용한다. private origin/destination geometry는 응답과 in-memory course 밖에 저장·기록하지 않는다.
- geometry 누락·손상은 추천 실패가 아니다. CourseConfirm은 marker·세로 시간표·`코스 시작하기`를 유지하며 직선이나 새 route 요청으로 보정하지 않는다.
- 요청형 initial/page 8회, 고유 장소 누적, 조건부 시장, 카카오맵 handoff, CAPTCHA/Proxy, navigation JSON 계약을 변경하지 않았다.
- 실제 Kakao·GPS·Supabase·운영 Edge 호출은 0회다. Simulator·실기기·Metro·Xcode와 운영 배포를 실행하거나 조작하지 않았다.

### 4. 실행한 테스트와 결과

- `npx tsx --test test/qa-course-geometry-integration.test.ts`: 최종 3/3 통과.
- geometry 전 계층 + one-stop page + 조건부 시장 + 카카오맵/CAPTCHA/Proxy/navigation 관련 고정 fixture 묶음: 133/133 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 117/117 통과, 실패·skip 0.
- `npm run test:ui`: 198건 중 197 통과, 기존 명시 skip 1, 실패 0.
- `git diff --check`: 통과.

### 5. 출시 판정과 다음 단계

- **QA-COURSE-GEOMETRY-01 자동 통합 게이트 통과. 자동 단계 기준 출시 차단 없음.**
- 운영 DB migration과 Edge 배포는 이번 작업 범위에서 수행하지 않았다. 통합·결정이 별도로 승인할 경우에만 `202609030014_route_proxy_geometry_cache.sql` 적용 성공 확인 후 Route Proxy Edge 순서로 진행해야 한다.
- 운영 반영 뒤의 출시 후보 실기기 one-stop 1건은 별도 수동 단계다. 이번 자동 검증 결과로 Simulator나 실기기 조작을 시작하지 않는다.

## 2026-09-03 — 통합 검토

### 판정

**자동 통합 단계 수락.** public provider miss→cache hit, private 왕복, 손상 geometry의 세 흐름이 실제 handler→client adapter→release one-stop engine→CourseConfirm model을 통과했다. geometry 누락은 코스를 탈락시키거나 직선으로 바뀌지 않았고, private geometry의 cache/lease/로그/DB write와 상세 model의 추가 route 호출은 모두 0이었다.

첫 public 실행의 provider 3회는 두 leg 중 하나가 기존 수단 선택 규칙에 따라 `도보 확인 → 14분 초과 → 대중교통 확인`을 수행한 결과다. 상세 화면의 추가 호출이 아니다. 하위 Proxy cache hit 3개와 엔진의 leg receipt reuse 2개는 서로 다른 계층의 관찰값이므로, QA 기대값을 `cacheOrSessionReuseCount=2`로 교정한 것은 타당하다.

### 통합 세션 재검증

- `npx tsx --test test/qa-course-geometry-integration.test.ts` — 3/3 성공.
- `npm run test:typecheck` — 성공.
- `git diff --check` — 성공.
- 완료 기록의 전체 core 117/117, UI 197 성공·기존 skip 1·실패 0을 확인했다.

### 남은 출시 게이트

자동 QA는 끝났지만 기능의 운영 반영은 아직 끝나지 않았다. 다음은 기존 작업을 새 ID로 분기하지 않고 순서대로 이어간다.

1. DB 역할이 `DB-ROUTE-GEOMETRY-01`의 운영 반영 단계로 `202609030014_route_proxy_geometry_cache.sql`을 적용하고 remote migration 상태와 RPC signature를 확인한다.
2. 1번 성공 뒤 외부 API 역할이 `API-ROUTE-GEOMETRY-01`의 운영 반영 단계로 Route Proxy Edge를 배포하고 비밀 없는 health/계약 확인을 한다.
3. 새 internal build 또는 새 JS bundle이 반영된 출시 후보 실기기에서 사용자가 one-stop 1건의 두 실제 선·수단 스타일·marker·카카오맵 길찾기를 확인한다.

운영 DB와 Edge 적용은 원격 상태 변경이므로 사용자의 명시 진행 지시 전에는 수행하지 않는다.

## 운영 smoke 실행 지시 — 1회만 수행

### 목적과 준비

- 목적은 추천을 통과시킨 동일 두 leg의 실제 geometry가 실기기 코스 확인 지도까지 도달하는지 확인하는 것이다. 추천 다양성·장소 공급량·점수는 이번 판정 대상이 아니다.
- 이번 변경은 TypeScript와 Edge/DB뿐이며 native dependency·entitlement 변경이 없다. 최신 코드를 Metro dev client로 실행 중이면 Xcode 재빌드·앱 삭제는 필요 없다. 앱이 Metro와 분리된 과거 packaged internal build라면 그 build로 판정하지 말고 최신 JS가 포함된 internal build 한 번만 사용한다.
- `EXPO_PUBLIC_ROUTE_PROXY_ENABLED=true`는 유지한다. CAPTCHA·추천 진단·B12 flag나 운영 시각을 이번 smoke를 위해 바꾸지 않는다. cache 삭제도 하지 않는다.

### 사용자 실행 시나리오

1. 가능하면 출발지와 목적지를 서로 다른 위치로 정하고, 정상 one-stop 대표 코스가 나오는 입력 하나만 실행한다. 왕복도 허용하지만 두 leg가 겹쳐 한 선처럼 보일 수 있으므로 별도 목적지가 관찰에 유리하다.
2. 대표 코스 카드를 열어 `코스 확인` 상세로 이동한다.
3. 지도에서 출발·추천 장소·목적지 marker와 함께 다음을 확인한다.
   - 출발지 → 추천 장소 실제 경로선
   - 추천 장소 → 목적지 실제 경로선
   - 각 선의 도보/대중교통 스타일과 세로 구간 정보의 수단이 대응
4. `코스 시작하기` 후 첫 구간의 카카오맵 길찾기가 기존처럼 열리는지만 확인한다.
5. 한 번의 코스 생성과 상세 확인으로 종료한다. `다른 장소 더 보기`, cache 삭제, 같은 입력 반복, 임의 provider 재호출은 하지 않는다.

### 기록 형식과 판정

- 성공: `두 leg 실제 선 표시 / marker 정상 / 수단 대응 / 카카오 길찾기 열림` 네 항목과 코스 확인 화면 캡처 한 장을 기록한다.
- 실패하면 즉시 종료하고 다음 셋 중 하나만 기록한다.
  - `두 선 모두 없음`: marker는 있으나 geometry segment가 0으로 보임
  - `한 leg만 없음`: 두 구간 중 어느 방향이 없는지 명시
  - `지도 자체 실패`: 지도 tile/marker 자체가 표시되지 않음
- 비밀 없는 내부 로그에서 geometry 존재 여부와 route mode 정도만 첨부할 수 있다. 좌표·사용자 식별자·token·provider 원문은 기록하지 않는다.
- 성공하면 `DEC-COURSE-GEOMETRY-01` 출시 기능 게이트를 닫는다. 실패하면 QA가 기능 코드를 고치지 않고 통합 세션이 분류 결과에 따라 API 전달 또는 UI 표시 중 한 역할에만 후속을 연다.

## 2026-09-03 — 운영 smoke 1회 결과

### 실행 결과와 판정

- 사용자가 실기기에서 운영 smoke를 **1회만** 수행했다. QA는 실기기를 조작하거나 같은 입력을 재실행하지 않았다.
- 관찰: `사상역 → 대중교통 하차역`의 주황색 선은 표시됐지만 **선 자체가 하차역에서 끝났고, 하차역 → 서면 근처 추천 장소의 마지막 도보선은 없었다.** 단순 색상 오류가 아니라 목적 장소까지 형상이 완결되지 않은 상태다.
- 판정: **실패 — 수단 대응 불충족(대중교통 leg의 도보 연결 구간 누락)**. 실제 선의 유무만으로는 합격할 수 없으며, 합격 기준의 “세로 이동 분·수단과 선 스타일 대응”을 충족하지 못했다.
- 이번 보고로 smoke를 종료했다. 동일 입력 재시도, cache 삭제, provider 재호출은 수행하지 않는다.
- 이번 관찰에서는 marker 정상 여부와 `코스 시작하기` 후 카카오맵 길찾기 성공 여부를 별도로 확정하지 않는다.

### 인계 경계

- QA는 기능 코드·추천 정책·운영 데이터·Route Proxy를 수정하지 않았다.
- 통합·결정 역할은 원인을 외부 API 경계로 분류했다. 현재 API가 transit의 `steps[].path.points`만 읽고 하위 mode를 보존하지 않으므로 외부 API 역할의 구조 진단이 먼저다.
  - 각 leg에 도보 연결 subsegment와 대중교통 subsegment가 모두 존재하는데 화면만 대중교통으로 합쳐 표시하면 **UIUX 역할**로 인계한다.
  - 운영 응답이 leg 전체를 `transit` 하나로만 제공해 도보 연결 subsegment 자체가 없으면 **외부 API 어댑터 역할**로 인계한다.
- 좌표·사용자 식별자·token·provider 원문 없이 mode/subsegment 존재 여부만 확인한다. 원인 분류 전 임의의 표시 보정이나 직선 fallback을 추가하지 않는다.
- `DEC-COURSE-GEOMETRY-01` 출시 기능 게이트는 닫지 않는다.
- `API-ROUTE-GEOMETRY-01` 결과와 downstream 보완이 수락되기 전에는 실기기 smoke를 반복하지 않는다.

### 세션 종료 인수인계

1. 변경 파일과 목적: 이 문서에 운영 smoke 1회 관찰, 실패 판정, 재실행 금지와 담당 분류 경계를 기록했다.
2. 변경하지 않은 경계: 공개 추천 계약, geometry/cache 정책, 기능 코드, 운영 DB·Edge, 보드와 기준 문서는 변경하지 않았다.
3. 실행한 테스트: 자동 테스트와 추가 운영 호출은 실행하지 않았다. 사용자 실기기 smoke 1회 결과만 수령했다.
4. 다음 결정·위험·재현 조건: 통합·결정이 안전한 receipt에서 leg 내부 subsegment mode 존재 여부를 확인해 UIUX 또는 외부 API 어댑터 한 역할로 후속을 열어야 한다. 현재 위험은 실제 복합 이동이 대중교통 단일 수단처럼 보여 경로 이해와 신뢰를 떨어뜨리는 것이다.

## QA-COURSE-GEOMETRY-02 — 선택 후 walk connector 통합 검증

### 상태·시작 조건

**`API-ROUTE-GEOMETRY-03`과 `U-COURSE-GEOMETRY-02` 통합 수락 후에만 수행.** QA가 직접 기능 코드·추천 정책·운영 데이터를 수정해 통과시키지 않는다. 고정 fixture 자동 검증이 선행이며 QA 세션이 Simulator의 버튼을 하나씩 자율 조작하는 방식은 사용하지 않는다.

### A. 자동 통합 하네스

1. 현재 운영 관찰과 같은 `transit 선 끝→추천 장소` gap을 51~250m로 만든다. 상세 진입 전 connector 호출 0, 진입 후 walk-only 1, transit 재조회 0, 성공 후 파란 walk 선이 장소 marker에 닿는지 확인한다.
2. gap 50m와 50m 초과, walk leg, transit geometry 없음/손상, 앞·뒤 connector, 두 transit leg의 최대 4개, 의도적 5번째 차단을 독립 fixture로 고정한다.
3. 동시 연타·재렌더·뒤로갔다 재진입에서 서비스 in-flight/메모리 재사용이 작동해 같은 endpoint의 provider 새 호출이 0인지 확인한다. 10분 만료·64개 상한·reset은 API 단위 테스트 결과를 재사용하고 불필요하게 중복하지 않는다.
4. 세션 없음은 CAPTCHA·anonymous sign-in·Edge·provider 0회여야 한다. no route·timeout·transport·malformed 응답·한 connector만 성공에서도 부분 선·마커·세로 상세·코스 시작 CTA를 유지하고 직선을 만들지 않는다.
5. connector 좌표·geometry는 DB·public cache·lease·AsyncStorage·분석·console에 저장되지 않아야 한다. public cache/lease/geometry write는 0회지만 기존 비식별 provider quota 예약 RPC는 허용한다. 테스트 출력에도 좌표·JWT·token·provider body가 없어야 한다.
6. 보충 walk의 `totalMin`이 달라도 `VerifiedCourseV1` ID·placeIds·stops·legs의 기존 min·travelMin·totalMin·arrivalBuffer·순위·initial/page attempt·진행 snapshot이 byte-equivalent하게 유지되는지 확인한다.
7. 기존 추천 initial/page·다른 장소 더 보기·조건부 시장·CAPTCHA/Proxy·카카오맵 handoff·navigation JSON 회귀를 같이 실행한다.

### B. 자동 합격 기준

- 관련 connector/API/UI 통합 fixture 전부 통과.
- `npm run test:typecheck`, `npm test`, `npm run test:ui`, `git diff --check` 실패 0.
- 실제 Kakao·Supabase·GPS 호출 0, Simulator 자율 조작 0.
- 이 게이트가 통과하기 전에 실기기를 열거나 같은 운영 코스를 반복 호출하지 않는다.

### C. 사용자 실기기 smoke — 자동 게이트 통과 후 1회

1. 새 native dependency·entitlement가 없으면 앱 삭제·Xcode clean을 먼저 요구하지 않는다. 현재 개발 client가 최신 Metro bundle을 읽는지만 확인한다.
2. 사용자가 transit one-stop이 나오는 입력 하나를 1회만 실행하고 대표 또는 대안 카드 하나를 연다.
3. 지도에서 `transit 하차지점 → 파란 도보선 → 추천 장소 marker`가 실제로 이어지는지 확인한다. 누락 시에는 동일 입력을 재실행하지 말고 코스 확인 캡처 1장과 내부 안전 receipt의 connector 요청/성공/실패 개수만 남긴다.
4. 로딩 중에 기존 경로·상세·CTA가 유지되는지, 도보/대중교통 범례가 일치하는지, `코스 시작하기`와 카카오맵 길찾기가 기존처럼 되는지 함께 확인한다.

### D. 판정·인수인계

- 성공하면 `DEC-COURSE-GEOMETRY-01`의 도보 완결성 출시 게이트를 닫는다.
- 실패하면 `요청 0 / 요청했으나 실패 / geometry 성공했으나 표시 실패`중 하나로만 분류해 해당 역할 하나에게 인계한다. 새 작업 ID를 연속으로 만들거나 같은 smoke를 반복하지 않는다.
- 수정 범위는 `test/`, fixture, 이 문서뿐이다. engine/API/UI/DB/data/작업 보드를 수정하지 않고, 사용자 명령 전 commit·push를 하지 않는다.

## 2026-09-03 — QA-COURSE-GEOMETRY-02 자동 통합 완료

### 1. 변경 파일과 변경 목적

- `test/qa-course-geometry-connector-integration.test.ts`: 실제 Route Proxy handler의 private scope → mobile private walk port → connector request/load → CourseConfirm route geometry model을 연결하는 고정 fixture 통합 하네스를 추가했다.
- `docs/work/qa-release/course-confirm-route-geometry-validation.md`: 자동 검증 결과와 남은 사용자 실기기 1회 조건을 기록했다.

기능 코드, 추천 정책, 운영 데이터, DB/Edge, 환경값과 `docs/작업조정_보드.md`는 수정하지 않았다.

### 2. 자동 통합 구조화 결과

| fixture | 호출·비영속 관찰 | 화면 geometry·불변 계약 | 판정 |
| --- | --- | --- | --- |
| transit 두 leg, 장소 양쪽 endpoint gap 120m | 상세 선택 전 provider 0, 선택 후 private walk 2, transit 재조회 0. RPC는 비식별 `route_proxy_reserve_budget` 2회뿐이며 public cache/lease/geometry write 0 | 기존 transit 두 선 사이에 `0:end`, `1:start` 파란 walk connector를 순서대로 합성하고 두 선 모두 장소 좌표에 닿음. 재진입 provider 추가 0, 원본 course JSON byte-equivalent | 통과 |
| 동일 course, Auth session 없음 | Edge/provider/RPC 0, sign-in/CAPTCHA 경계 진입 없음 | connector 없이 기존 transit 두 선 유지, 직선 fallback 0, 원본 course 불변 | 통과 |
| 두 transit leg의 4 endpoint + 의도적 5번째, 1건 no-route | 호출 4로 제한, 동시 최대 2, 5번째 provider 전달 0 | 성공 connector 3개와 기존 transit 2개 유지, 부분 실패+상한 차단 2건 집계, 직선 fallback 0 | 통과 |

- 최초 집중 실행은 22건 중 새 성공 fixture 1건이 하네스의 `ROUTE_PROXY_FETCH_LEASE_TTL_MS` 누락으로 provider 진입 전에 닫혔다. 기능 문제로 보정하지 않고 운영 Edge 계약과 같은 fixture 환경값을 추가한 뒤 22/22 통과했다.
- 50m/51m, walk/transit, 왕복/목적지, 손상 geometry, no-route·malformed·transport, in-flight/10분 메모리 재사용, 64개 상한, console 비노출은 수락된 API/UI 단위 fixture를 같은 집중 명령에 포함해 재확인했다.

### 3. 실행한 테스트와 결과

- connector 신규 통합 + API/UI 집중 묶음: 22/22 통과.
- 기존 geometry + 출시 one-stop/더보기 + 조건부 시장 + 진행/카카오 handoff 회귀: 39/39 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 117/117 통과, 실패·skip 0.
- `npm run test:ui`: 205건 중 204 통과, 기존 명시 skip 1, 실패 0. 요약 수집용 병렬 재실행 1회가 샌드박스 임시 IPC `EPERM`으로 테스트 시작 전에 중단됐으나 단독 재실행은 같은 204+1 결과로 통과했다.
- `git diff --check`: 통과.
- 실제 Kakao·Supabase·GPS 호출 0, Simulator·실기기·Metro·Xcode 조작 0.

### 4. 자동 게이트 판정과 남은 1회

- **QA-COURSE-GEOMETRY-02 자동 통합 게이트 통과.** 자동 단계 기준 차단 없음.
- 남은 항목은 사용자가 최신 bundle이 연결된 실기기에서 수행할 **transit one-stop 1건**뿐이다. 같은 입력 반복, cache 삭제, Xcode clean과 여러 장소 비교는 요구하지 않는다.
- 확인 핵심은 코스 확인 지도에서 `주황 transit 하차지점 → 파란 도보 connector → 추천 장소 marker`가 끊김 없이 이어지는지다. 로딩 중 기존 경로·상세·CTA 유지, 도보/대중교통 범례 대응, `코스 시작하기`와 카카오 길찾기도 같은 1회 안에서 함께 본다.
- 성공 보고: `하차지점→파란 도보선→장소 marker 연결 / 로딩 중 상세·CTA 유지 / 범례 대응 / 카카오 길찾기 열림`과 코스 확인 캡처 1장.
- 실패 보고: 같은 입력을 재실행하지 않고 캡처 1장과 안전 진단의 connector `요청/성공/실패` 개수만 남긴다. 판정은 `요청 0 / 요청했으나 실패 / geometry 성공했으나 표시 실패` 중 하나로 제한한다.

### 5. 세션 종료 인수인계

1. 변경 파일과 목적: QA 소유 통합 fixture 1개와 이 완료 기록만 추가했다.
2. 유지한 계약: 50m 임계값, 최대 4회·동시 2회, private 비영속, 추천 snapshot·시간·순위·attempt·진행 계약, 실패 시 기존 상세/CTA 유지와 직선 금지를 변경하지 않았다.
3. 테스트 결과: 자동 게이트 전부 통과했으며 운영 외부 호출과 기기 조작은 0회다.
4. 다음 결정·위험·재현 조건: 사용자 transit one-stop 1회의 실제 endpoint 연결만 남았다. 실패하면 반복하지 않고 안전 count로 한 역할에만 인계하며, 성공 전에는 `DEC-COURSE-GEOMETRY-01` 도보 완결성 게이트를 닫지 않는다.

## 2026-09-03 — QA-COURSE-GEOMETRY-02 실기기 smoke 완료

### 실기기 1회 결과

- 사용자가 transit one-stop 한 건을 실기기에서 1회 확인하고 완료를 보고했다. 같은 입력 재실행, cache 삭제, 추가 provider 호출은 요구하거나 수행하지 않았다.
- 증빙 화면의 코스: `사상역 부산2호선 → 부산 수학문화관 → 목적지`, 약 55분 코스. 세로 상세에는 첫 leg `대중교통 18분`, 마지막 leg `대중교통 7분`이 유지됐다.
- 지도에는 주황 대중교통 경로와 파란 도보 경로 범례가 함께 표시됐다. 주황 transit 선의 하차 구간에서 파란 walk connector가 이어지고, 파란 선이 `부산 수학문화관` 장소 marker까지 도달했다.
- 기존 경로·장소 상세·CTA가 유지된 상태에서 connector가 합성됐으며, 사용자는 요청한 확인 절차가 완료됐다고 보고했다.
- 판정: **통과 — `geometry 성공 및 표시 성공`.** `요청 0`, `요청했으나 실패`, `geometry 성공했으나 표시 실패` 어느 실패 분기에도 해당하지 않는다.

### 최종 인수인계

1. 변경 파일과 목적: 이 QA 작업 문서에 실기기 transit one-stop 1회 성공 증거와 최종 판정을 추가했다.
2. 유지한 계약: 추천 snapshot·시간·순위, 50m 임계값, 최대 4회·동시 2회, private 비영속, 직선 fallback 금지와 기존 상세/CTA 계약을 변경하지 않았다.
3. 테스트 결과: 자동 통합 3/3, 집중 묶음 22/22, 관련 회귀 39/39, core 117/117, UI 204 통과·기존 skip 1, typecheck·diff check 통과 뒤 실기기 1/1을 완료했다.
4. 다음 결정·위험·재현 조건: **QA-COURSE-GEOMETRY-02 완료. `DEC-COURSE-GEOMETRY-01` 도보 완결성 출시 게이트를 닫을 수 있다.** 이번 성공 입력을 반복 검증하지 않는다. 다른 provider·장소 다양성은 이 작업의 범위가 아니다.

### 2026-09-03 통합 검토 — 최종 수락

- 통합 세션이 신규 QA 하네스와 API/UI connector 계약을 독립 실행해 **22/22**, typecheck와 diff check 통과를 재확인했다.
- 사용자 실기기 1회에서 대중교통 하차 지점부터 파란 도보선이 추천 장소 marker까지 이어졌다는 완료 기록을 수락한다. 기존 상세·CTA·시간 snapshot도 유지됐다.
- 상태: **최종 수락**. `DEC-COURSE-GEOMETRY-01` 출시 게이트를 닫고 동일 입력의 반복 smoke를 금지한다.
