# DEC-COURSE-GEOMETRY-01 — 코스 확인 실제 경로선

## 상태

2026-09-03 사용자 확정. `API-ROUTE-GEOMETRY-01/02`에서 Kakao 호출은 정상이지만 부산 응답의 14개 route 모두 시작·마지막 WALKING path 없이 endpoint에서 `51–250m` 떨어져 끝남을 확인했다. 사용자는 추천 후보를 모두 선조회하지 않고 **코스 카드를 눌러 상세를 열 때만 누락된 endpoint walk를 보충**하는 방식을 확정했다. 상태: **API·UI·자동 QA·실기기 1회 완료, 출시 게이트 닫힘**.

## 이전 방식 → 문제 → 교체 방식

- **이전 방식:** `VerifiedCourseV1`은 구간별 수단·분만 보존했다. 코스 확인 지도는 출발·장소·도착/복귀 마커만 표시하고, 실제 형상이 없으므로 선을 그리지 않았다.
- **문제:** 사용자는 코스 카드를 선택해도 어느 방향과 경로로 이동하는지 한눈에 파악할 수 없다. 반대로 좌표 사이 직선이나 상세 진입 시 새로 조회한 다른 경로를 그리면, 추천을 통과시킨 실제 시간과 지도선이 달라진다.
- **교체 방식:** 추천 검증에 사용한 같은 Kakao 도보·대중교통 응답의 `path.points`만 provider-neutral 형상으로 정제해 구간 snapshot에 보존한다. 코스 확인 지도는 `설정 출발지 → 추천 장소 → 설정 목적지/출발지 복귀`의 두 실제 구간을 순서대로 그린다. 상세 진입 자체의 route 호출은 0회다.
- **교체 이유:** 추가 API 비용 없이 추천 시간과 지도 경로의 동일성을 지키고, 사용자가 장소의 위치뿐 아니라 전체 동선을 즉시 이해하게 하기 위함이다.

## 확정 계약

> 이 절은 최초 snapshot-only 계약의 이력이다. 아래 `2026-09-03 최종 선택`이 상세 route 0회와 별도 조회 금지에 관한 3·9번을 교체하며, 나머지 snapshot 정확성·비영속 원칙은 유지한다.

1. `현재 위치`는 실시간으로 다시 읽는 GPS가 아니라 추천 요청 때 사용자가 확정한 `session.origin`이다. 사용자가 검색·지도 선택으로 출발지를 바꿨다면 그 위치를 쓴다.
2. 한 곳 출시 코스는 `origin → place`, `place → destination` 두 구간을 그린다. `destination === null`이면 두 번째 구간은 `place → origin`이다.
3. 각 선은 해당 `CourseV1Leg`을 검증한 동일 route receipt의 WGS84 형상이다. 직선 연결, 근사 geometry, 별도 Kakao route 재조회, 외부 카카오맵 landing URL의 다른 경로를 사용하지 않는다.
4. 형상은 provider 원문 전체가 아니라 좌표만 남긴다. 각 path는 `[lon, lat]`를 앱의 `{ lat, lon }`으로 변환하고, 범위 밖·NaN·중복 좌표는 제거한다. 단계 안내문·provider 원문·키·URL은 course snapshot에 넣지 않는다.
5. payload는 결정적으로 제한한다. 한 route의 path 최대 32개, 전체 점 최대 512개를 기준으로 실제 선 위에서 단순화한다. 시작·끝점과 path 분리는 보존하며 제한을 맞추기 위해 두 지점을 직선으로 대체하지 않는다.
6. 공개 장소↔장소 형상만 기존 Route Proxy TTL과 같은 기간 서버 캐시에 둘 수 있다. 사용자의 정밀 origin/destination이 포함된 private route 형상은 응답과 앱 메모리에서만 사용하고 DB·로그·분석·완료 기록에 저장하지 않는다.
7. 시간 검증은 기존 `totalMin` 계약을 유지한다. 형상이 없거나 손상됐다는 이유만으로 시간상 유효한 추천을 버리지 않는다. 해당 구간 선만 숨기고 `일부 경로선을 표시하지 못했어요`를 지도 안에 짧게 표시하며, 마커·세로 시간표·코스 시작은 유지한다.
8. 지도는 구간 순서와 수단을 구분한다. 도보와 대중교통은 서로 다른 색/패턴과 작은 범례를 사용하되 버스·지하철 세부 수단을 근거 없이 추정하지 않는다.
9. 코스 확인 진입·뒤로가기·지도 재렌더는 추천/Route Proxy 호출 0회다. 경로선은 navigation의 직렬화 가능한 검증 snapshot만 사용한다.
10. 기존 one-stop 추천 수, 순위, 8회 예산, 더보기, 체류·운영시간, 카카오맵 길찾기 handoff는 바꾸지 않는다.

## 2026-09-03 실기기 관찰에 따른 계약 보완

### 이전 방식 → 발생한 문제/관찰 → 교체 방식 → 이유 → 상태

- **이전 방식:** 한 `CourseV1Leg`에 `walk` 또는 `transit` 하나만 두고, transit 응답의 경로 path도 모두 leg의 `transit` 스타일로 표시했다.
- **문제/관찰:** 실기기에서 `사상역 → 대중교통 하차역`의 주황색 선은 보였지만, 하차역에서 서면 근처 추천 장소까지의 도보선이 실제로 끊겼다. 이는 색상만 잘못된 상태가 아니라 목적 장소까지 형상이 도달하지 않는 불완전 경로다.
- **교체 방식:** 대중교통 leg는 provider가 제공한 순서의 하위 구간을 `도보 → 대중교통 → 필요 시 환승 도보/대중교통 → 마지막 도보`로 보존한다. 각 하위 구간은 최소 `mode(walk|transit)`와 실제 좌표 path를 가지며, leg의 정확 총 이동시간은 기존 검증값을 그대로 쓴다.
- **이유:** 출발지·도착지까지 이어지지 않는 선을 완전한 실제 경로처럼 보여 주면 사용자가 하차 뒤 이동 방향을 알 수 없고 추천 신뢰도도 떨어진다.
- **상태:** **현행 정책 확정, 원인 진단 구현 전.** 현재 Kakao endpoint 응답에 마지막 도보 형상이 들어 있는지는 아직 확인되지 않았으므로 API 진단 결과 없이 UI가 선을 추정하거나 별도 호출을 추가하지 않는다.

### 추가 확정 경계

1. 지도 형상의 완전성은 각 leg의 요청 시작점부터 요청 끝점까지 provider가 제공한 실제 하위 구간이 순서대로 이어지는 상태다. 단순히 geometry path가 하나 이상 있다는 이유로 완전하다고 판정하지 않는다.
2. 하위 구간 mode는 provider의 명시 필드로만 판정한다. 배열의 첫 항목·마지막 항목이라는 이유만으로 도보라고 추정하지 않는다.
3. provider 응답에 마지막 도보 형상이 없다면 직선, 임의 도보선, 카카오맵 landing URL의 선으로 보충하지 않는다. 두 번째 route 호출이나 endpoint 교체도 사용자 결정 없이 추가하지 않는다.
4. geometry가 불완전해도 기존 정확 총 이동시간과 추천 적합 판정은 유지한다. 다만 화면에서 부분 선을 완전한 경로처럼 표시하지 않도록 `geometryComplete=false`에 해당하는 공개 상태를 다음 계약 단계에서 정의한다.
5. 지도는 도보를 파랑 실선, 대중교통을 주황 계열 구분선으로 표시한다. 세로 요약은 최소 `도보 → 대중교통 → 도보 · 총 N분`처럼 실제 하위 구간 순서를 전달하되, 하위 구간별 시간이 provider에서 신뢰성 있게 제공되지 않으면 임의 분 수를 만들지 않는다.
6. 이 변경은 recommendation 순위·장소 수·호출 예산·캐시 TTL·CAPTCHA·인증·카카오맵 길찾기 handoff를 바꾸지 않는다. 상세 진입 route 호출은 계속 0회다.

## 보완 실행 순서 이력 — 최종 선택으로 종료

1. **완료·수락:** `API-ROUTE-GEOMETRY-01`은 공식 예제와 부산 C2를 각각 1회 호출해 둘 다 `200/OK`임을 확인했다. 첫 실패 원인은 수동 진단 host 불일치였고 key·권한·quota 문제는 아니다. 부산 `routes[0]`은 마지막 WALKING 없이 목적지에서 `101–250m` 떨어져 끝났다.
2. **완료·수락:** `API-ROUTE-GEOMETRY-02`는 동일 공개 C2를 1회 호출해 14개 route 전체를 검사했다. 시작·마지막 WALKING path는 0/14, 목적지 gap은 모두 `51–250m`여서 R3로 판정했다.
3. **당시 결정 대기·현재 종료:** 누락 endpoint의 Kakao walk를 추천 후보 검증 중 미리 보충할지, 사용자가 특정 코스 상세를 열 때만 보충할지 비교했다. 최종적으로 후자를 선택했다.
4. 위 선택을 확정한 뒤에만 조건부 walk의 API 호출·timeout·receipt·cache/private 계약을 작성하고 추천 엔진 `2-W`, API production, DB, UI 후속을 역할별로 연다. 기존 migration `014`는 수정하지 않는다.
3. 위 계약과 저장 경계가 수락된 뒤 UIUX `U-COURSE-GEOMETRY-01`을 열어 지도·세로 요약을 갱신한다.
4. 마지막으로 QA가 고정 fixture를 먼저 검증하고, 출시 후보 실기기 1회에서 선이 실제 추천 장소까지 이어지는지 확인한다.
5. 전체-route 결과가 provider 자체 형상 누락이면 후속 구현을 시작하지 않고, 조건부 추가 도보 호출·부분선 표시 중 선택지를 비용과 함께 사용자에게 보고한다.

## 1차 실행 순서 이력 — 완료, 현재 실행 지시 아님

> 아래 A~D는 단일 leg-mode geometry를 처음 연결한 이력이다. 현재는 위 `보완 실행 순서`가 우선하며, API 진단 결과 전 병렬 작업을 시작하지 않는다.

- **A 병렬:** `DB-ROUTE-GEOMETRY-01`과 `2-W`는 이 문서의 형식·제한을 기준으로 서로 다른 소유 경로에서 진행할 수 있다.
- **B 병렬:** A 수락 뒤 `API-ROUTE-GEOMETRY-01`과 `U-COURSE-GEOMETRY-01`을 진행할 수 있다. UI는 고정 geometry fixture를 사용하며 실제 API를 호출하지 않는다.
- **C:** 네 구현이 수락된 뒤 `QA-COURSE-GEOMETRY-01`로 통합한다.
- **D:** 자동 게이트 통과 뒤 출시 후보 실기기에서 실제 한 곳 코스 1회만 확인한다.

## 근거

Kakao 공식 도보·대중교통 응답은 route step의 `path.points`를 `[x, y]`, 즉 WGS84 요청 시 `[lon, lat]`로 제공하고 대중교통 step type에 `WALKING`을 허용한다. 그러나 `API-ROUTE-GEOMETRY-02`에서 부산 C2의 14개 route 모두 시작·마지막 WALKING path가 없음을 확인했다. 따라서 완전한 실제 선에는 누락 endpoint의 조건부 walk 조회가 필요하며, 아래 최종 선택이 위의 `상세 route 0회`·`결정 전`이라는 과거 문구를 교체한다.

## 2026-09-03 최종 선택 — 코스 상세에서만 endpoint walk 보충

### 이전 방식 → 관찰 문제 → 교체 방식 → 이유 → 상태

- **이전:** 추천 검증 snapshot만 표시하고 코스 상세의 route 호출을 0회로 고정했다.
- **문제:** provider가 transit endpoint walk를 주지 않아 선이 하차지점에서 끊기며, 다른 route 선택으로도 해결되지 않았다.
- **교체:** 추천 중에는 추가 호출하지 않고, 사용자가 특정 코스를 선택한 뒤 transit leg의 실제 endpoint와 snapshot geometry 끝이 **50m를 초과**해 끊긴 경우만 private Kakao walk geometry를 보충한다.
- **이유:** 선택되지 않은 후보의 호출량은 늘리지 않으면서, 사용자가 실제로 검토하는 코스의 하차 후 도보 동선을 보여 줄 수 있다.
- **상태:** **현행 확정·구현 대기.** 이 절이 위의 실행 시점 미확정, 별도 route 금지, 상세 호출 0회 문구를 교체한다.

### 확정 계약

1. 기존 snapshot 선·마커·세로 상세를 먼저 즉시 표시하고 connector 로딩으로 화면을 막지 않는다.
2. 대상은 `mode=transit`이고 유효한 geometry가 있는 leg이다. 실제 leg 시작점→geometry 첫 점, geometry 마지막 점→실제 leg 종점 간격이 각각 50m를 초과할 때만 조회한다. 50m 이하는 제공자 snapping 허용 구간으로 본다.
3. 출시 one-stop의 transit leg는 최대 2개이므로 상세 한 번의 connector는 합계 **최대 4개**다. 추천 initial/page의 8회 provider attempt 예산과 분리하고, 자동 prefetch·다음 코스 선조회를 금지한다.
4. 같은 코스·endpoint의 연타, 재렌더, 뒤로갔다 재진입은 in-flight와 결과를 앱 프로세스 메모리에서 재사용한다. 영속 cache·AsyncStorage·DB에 저장하지 않는다.
5. 보충 요청은 기존 익명/로그인 Auth 세션을 재사용한다. 상세에서 새 익명 계정을 만들거나 CAPTCHA를 다시 열지 않는다. 세션이 없으면 provider 호출 0회로 안전 종료한다.
6. endpoint 좌표와 connector geometry는 `private_request`로만 전송하고 기존 비영속 경계를 적용한다. DB·서버 TTL cache·분석·console·완료 문서에 좌표를 남기지 않는다. 비식별 provider 호출량을 보호하는 기존 `route_proxy_reserve_budget` 집계는 허용하지만 public route cache/lease와 geometry 저장은 0회다. DB migration `014`를 수정하지 않는다.
7. walk 응답의 geometry만 파란 실선으로 기존 transit 선 앞·뒤에 붙인다. walk의 `totalMin`은 표시 선 보완용이며 기존 검증 `travelMin/totalMin`, 운영시간, 순위, 코스 ID, 진행 snapshot을 수정하지 않는다.
8. 보충 실패·timeout·no route·세션 부재·손상 geometry는 추천 실패로 승격하지 않는다. 성공한 connector만 보이고 `일부 도보 경로선을 표시하지 못했어요`를 한 번 표시하며 마커·상세·CTA를 유지한다.
9. 새로운 추천 엔진 type이나 DB 작업은 없다. 이 보충은 외부 API service와 UI 표시 상태로만 구현한다.

### 실행 순서

1. `API-ROUTE-GEOMETRY-03`: 기존 Auth로 private walk만 호출하는 재사용 가능 port와 메모리 dedupe를 구현한다.
2. `U-COURSE-GEOMETRY-02`: endpoint gap을 계산하고 코스 상세에서만 connector를 불러 지도에 합성한다.
3. `QA-COURSE-GEOMETRY-02`: 고정 fixture 통합 후 실기기 transit one-stop 1건만 확인한다.

`API-ROUTE-GEOMETRY-03`과 `U-COURSE-GEOMETRY-02`는 공유 서비스 계약 구현이 먼저 필요하므로 순차로 진행한다. 추천 엔진·DB·데이터 세션은 이 작업에 참여하지 않는다.

### 2026-09-03 API-ROUTE-GEOMETRY-03 통합 수락

- 현재 Auth session만 재사용하는 walk-only private connector port가 추가됐고, session 부재·확인된 만료에서는 anonymous sign-in·CAPTCHA·Edge 호출 없이 종료한다.
- exact geometry만 반환하고 provider `totalMin`은 결과 타입에서 제거했다. transit fallback·직선·재시도·prefetch는 없다.
- 동일 요청 in-flight 병합, 10분 프로세스 메모리 재사용, 최대 64개와 reset을 고정했다. 좌표·geometry는 로그·영속 cache·DB에 저장하지 않는다.
- 명령의 포괄적 `RPC 0회` 표현은 기존 비용 보호와 충돌했다. public cache/lease/geometry write 0회는 유지하고, 비식별 quota 예약 RPC는 허용하는 것으로 위 6번을 명확히 했다.
- 통합 재검증에서 관련 API 계약 **28/28**, typecheck가 통과했다. 실제 provider·실기기 검증은 하지 않았으며 다음 작업은 `U-COURSE-GEOMETRY-02`다.

### 2026-09-03 U-COURSE-GEOMETRY-02 통합 수락

- 코스 상세는 기존 snapshot·마커·세로 상세·CTA를 즉시 표시하고, 유효한 transit leg의 50m 초과 endpoint gap만 API-03 private walk port로 비동기 보충한다.
- port는 앱 모듈 수명에 한 번 생성되며 화면당 최대 4개·동시 최대 2개다. 성공한 connector만 파란 선으로 합성하고, 실패·세션 부재에도 기존 상세와 CTA를 유지한다.
- 통합 재검증에서 관련 계약 **29/29**, UI **204 통과·1 skip**, core **117/117**, typecheck와 diff check가 통과했다. 실제 외부 호출·실기기 확인은 수행하지 않았다.
- 구현은 수락하며 다음 작업은 `QA-COURSE-GEOMETRY-02`다. 50m 임계값은 현행으로 유지하고, 20m 변경안은 사용자 확정 전 구현하지 않는다.

### 2026-09-03 QA-COURSE-GEOMETRY-02 최종 수락

- 신규 handler→private walk port→UI geometry 통합 하네스와 기존 connector 계약을 통합 세션이 독립 실행해 **22/22**, typecheck와 diff check 통과를 확인했다.
- 사용자 실기기 transit one-stop 1회에서 주황 대중교통선의 하차 지점부터 파란 도보선이 추천 장소 marker까지 이어졌고, 기존 상세·CTA와 시간 snapshot이 유지됐다.
- `DEC-COURSE-GEOMETRY-01`은 완료다. 같은 입력의 반복 smoke는 하지 않으며, 다른 provider·장소 다양성·2곳 코스는 별도 작업으로 취급한다.
