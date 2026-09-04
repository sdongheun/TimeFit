# U-TWO-STOP-01 — 한 곳 선택 뒤 두 번째 장소를 고르는 화면 상태

## 담당과 병렬 실행

- 담당: UIUX 세션
- 상태: 작업 가능
- 병렬 가능: `2-Y`, `API-TWO-STOP-01`, `QA-TWO-STOP-01`
- 단일 작성자: `src/ui/`, `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`, UI 전용 테스트

시작 시 `AGENTS.md`, `docs/README.md`, `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`의 UXV-47, `docs/work/integration-decision/two-stop-limited-assembly.md`, 이 파일만 읽는다. 과거 UI archive 전체는 읽지 않는다. 기존 컴포넌트 확인에는 `course-card-and-vertical-detail.md`, `release-one-stop-more-results.md`, `course-confirm-route-geometry.md`의 현재 계약만 참고한다.

## 목적과 사용자 관찰

현재 결과 카드는 전체 tap으로 one-stop CourseConfirm을 열고, `다른 장소 더 보기`는 single을 누적한다. 새 흐름은 이 단순성을 깨뜨리지 않으면서 사용자가 선택한 검증 장소 A를 기준으로 실제로 함께 갈 수 있는 B만 보여 줘야 한다.

성공한 사용자 흐름:

1. one-stop 카드 tap → 기존 세로 CourseConfirm
2. 보조 행동 `한 곳 더 고르기` → Results의 A 선택 상태
3. A 고정 + 확인 중 → exact B가 1개씩 점진 표시
4. B 카드 tap → 엔진이 정한 순서의 2곳 CourseConfirm
5. A 선택 취소 → A 선택 전 Results 목록·순서·더보기·스크롤 그대로 복원

## 화면 행동 고정

### one-stop 상세

- 카드 전체 tap 의미는 바꾸지 않는다.
- 현재 primary `코스 시작하기`를 유지한다.
- `한 곳 더 고르기`는 명확한 secondary action이다. 카카오맵 확인·길찾기와 혼동되는 아이콘만 사용하지 않는다.
- firstCourse가 exact one-stop이 아니거나 새 엔진 port가 없으면 secondary action을 숨기고 기존 상세를 그대로 사용한다.

### A 선택 Results 상태

- 선택한 A는 화면 상단 또는 목록 첫 고정 영역에 사진·장소명·활동 카테고리·기존 one-stop 코스 요약을 유지해 보여 준다.
- 제목은 `선택한 장소`, 상태는 `A와 함께 갈 수 있는 장소 확인 중`으로 표현한다. `첫 번째 방문 장소`라고 단정하지 않는다. 엔진이 B→A를 선택할 수 있기 때문이다.
- `선택 취소`를 항상 접근 가능하게 둔다. 로딩·부분 성공·오류 중에도 취소할 수 있어야 한다.
- exact 성공 B를 받은 순서대로 append하고 이미 보인 카드를 재정렬하거나 skeleton 위치와 바꾸지 않는다.
- 진행 중에는 현재 성공 수와 `확인 중`만 보여 주며 내부 attempt 수·provider명·store 원문은 production에 표시하지 않는다.

### B 카드와 2곳 상세

- B 카드는 `A와 함께 가능한 장소`이고, 사진·장소명·활동 카테고리·두 장소 전체의 `약 N분 코스`만 간결히 표시한다.
- B 카드 tap은 이미 전달된 exact `VerifiedCourseV1` snapshot의 CourseConfirm을 연다. 추천/route API 재호출은 0이다.
- CourseConfirm 지도와 세로 순서는 엔진의 실제 방문 순서대로 `출발→장소→장소→도착/복귀`와 세 legs를 표시한다. 사용자가 A/B 순서를 드래그·편집하지 않는다.
- 현재 geometry 보충은 one-stop 4회에서 2곳 최대 6회로 소비자 상한만 확장하되, 상세을 먼저 렌더하고 connector는 동시 최대 2·10분 메모리 재사용·부분 실패 유지 계약을 따른다. 보충 분을 추천 시간에 더하지 않는다.

## 원래 화면 snapshot과 취소

A 선택 직전에 다음을 하나의 UI-owned serializable/view snapshot으로 보존한다.

- 대표와 모든 현재 one-stop 카드 ID·순서
- 이미 사용자가 연 single 더보기 결과와 single continuation 참조
- more/terminal/부족 상태
- 조건부 영역의 현재 표시 상태는 실제 시각 규칙대로 별도 유지
- ScrollView/FlatList offset
- 현재 선택 카드가 있다면 그 UI focus

취소하면 pair results/loading/error/continuation을 폐기하고 위 snapshot을 복원한다. 새 추천·route·장소 API는 호출하지 않는다. navigation params에 Date, callback, provider, engine input 객체를 넣지 않고 화면/session store의 직렬화 가능한 값과 runtime ref를 분리한다.

각 pair 요청에 `requestId(epoch)`와 `firstPlaceId`를 붙인다. 취소·다른 A 선택 시 epoch를 바꾸고 현재 값과 다른 progress/final 응답은 setState하지 않는다. abort는 best effort이며 이미 쓴 attempt를 UI에서 환불하거나 ledger를 되돌리지 않는다.

## 더보기·수량·오류

- 기본 B 목표 3, 0~2 허용, 누적 최대 6
- B가 하나라도 오면 즉시 표시하고 나머지 확인 상태를 유지
- pair `더 보기`는 continuation과 공유 expansion ledger가 있을 때만 표시
- A 선택 전 single 더보기와 pair 더보기가 공유 12회를 소비한다. 남은 수가 0이면 네트워크를 호출하지 않고 소진 안내
- 연타는 같은 epoch에서 한 요청만 실행
- 0개/일부 성공/terminal failure에서도 A의 one-stop `코스 시작하기`와 취소를 유지

safe reason 문구 예시는 다음 의미만 사용한다. 정확한 문장은 기존 tone에 맞춰 한 곳에서 매핑한다.

- 근처 다음 장소 부족
- 남은 시간 안에 두 곳을 안전하게 연결하기 어려움
- 이용 가능한 시간이 맞지 않음
- 실제 경로를 확인하지 못함
- 경로 확인이 잠시 어려움
- 이번 추천의 추가 확인 횟수 소진

## 엔진과의 병렬 연결

UI는 엔진 공개 타입 파일을 수정하지 않는다. `2-Y`가 고정한 `beginReleaseTwoStopSelectionV1`, `continueReleaseTwoStopSelectionV1`를 소비하는 UI-owned adapter/port를 둔다. 2-Y가 아직 작업 중이면 먼저 fixture port로 view model·component·state tests를 완성하고, export가 보이는 즉시 **같은 U-TWO-STOP-01 작업 안에서** production adapter를 연결한다. 새 `-R` 작업으로 넘기지 않는다.

일반 사용자 entry 활성화는 이 작업에서 하지 않는다. 개발/테스트 주입 경계에서 새 흐름을 자동 검증할 수 있게 만들고, Wave 2 통합 수락 때 기존 Results 진입점 전환을 한 번 결정한다. 새 `.env` flag를 추가하지 않는다.

## 필수 UI fixture

1. one-stop 상세 secondary action 존재/부재와 primary 불변
2. A 선택 직후 로딩, progress `1→2→3`, partial 1/2, zero
3. 늦은 후보가 와도 기존 B 순서 불변
4. B card tap이 2곳 상세를 열고 engine/route 0
5. 엔진이 B→A를 고른 경우 화면·지도·세로 순서가 B→A이고 A를 `첫 방문`으로 표기하지 않음
6. A 선택 전 더보기 2회 등 긴 목록에서 취소 후 동일 ID/order/more/offset 복원
7. 취소 직전 pending success/failure가 뒤늦게 와도 화면 변화 0
8. A→취소→같은 A/다른 A 재선택과 ledger 미초기화
9. shared expansion 12 소진, pair 누적 6, 연타 1회
10. no candidate/time/closed/no-route/provider/store/limit에서 A one-stop 유지
11. navigation state에 Date/function/provider/AbortSignal 없음
12. one-stop Results/CourseConfirm/진행/카카오맵/조건부 영역 회귀

## 검증과 수정 금지

- 새 UI 전용 테스트와 기존 Results/CourseConfirm/geometry/navigation 테스트
- `npm run test:ui`
- `npm run test:typecheck`
- `git diff --check`

실제 API·DB·GPS·Simulator·실기기는 0회다. UI fixture에서 외부 adapter는 전부 주입 mock을 사용한다.

수정 금지: `src/engine/`, `src/services/`, Edge/migration/data, `.env*`, 제품 기준 문서, 보드, 다른 역할 테스트. 추천 정책·candidate order·attempt 계산을 UI에서 재구현하지 않는다.

완료 시 변경 파일/유지 계약/테스트 수/남은 native 위험을 이 문서 아래에 기록한다. 2-Y export 미완료로 wiring이 남으면 UI 완료로 쓰지 말고 같은 작업의 미완료 항목으로 유지한다. commit·push는 사용자 요청 전 금지한다.

## 완료 인계 — 2026-09-03

상태: **UI fixture·2-Y 공개 export adapter 연결 완료 / 일반 사용자 entry 활성화 전**. fixture port를 먼저 고정한 뒤 같은 작업에서 `beginReleaseTwoStopSelectionV1`·`continueReleaseTwoStopSelectionV1` adapter까지 연결했다. Wave 2 자동 통합 수락 전에는 기존 Results/CourseConfirm 진입을 바꾸지 않는다.

### 1. 변경 파일과 변경 목적

- `src/ui/recommendation/twoStopSelectionModel.ts`: exact one-stop gate, 직렬화 snapshot, request epoch·A identity stale 차단, progress 순서 append, B 중복 제거·누적 6, same-tick continuation lock, 취소 원상 복원, safe reason 단일 매핑을 추가했다.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`: A 고정/취소/기존 one-stop 시작, 점진 상태, B 카드, pair 더보기와 주입 gate용 secondary action을 표시 전용 컴포넌트로 분리했다.
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`: 2-Y 공개 begin/continue·progress·continuation·ledger를 UI port로 정규화했다. engine context와 AbortSignal은 closure에 두고 continuation만 JSON-safe 값으로 화면 상태에 전달하며, 취소 시 ledger를 환불·초기화하지 않는다.
- `src/ui/recommendation/courseV1RouteGeometryModel.ts`: 기존 one-stop을 유지하면서 exact 2곳/3 legs도 검증하고 50m 초과 transit endpoint connector 소비자 상한을 최대 6으로 확장했다. 동시성 2와 부분 실패 정책은 유지했다.
- `test/ui/two-stop-selection.test.ts`: loading/progress 1→2→3, partial 1/2/zero, stale·취소 복원, 재선택 ledger 지속, 누적 6·중복·연타, B→A, safe reason, JSON snapshot, secondary gate, 실제 2-Y adapter fixture를 추가했다.
- `test/ui/course-v1-route-geometry.test.ts`: 2곳 세 transit legs의 endpoint 6개와 방문 순서 fixture를 추가했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- `src/engine/`, `src/services/`, API/DB/data, `.env*`, 제품 기준 문서, `App.tsx`, navigation 타입과 작업조정 보드는 수정하지 않았다.
- one-stop 카드 전체 tap, CourseConfirm primary `코스 시작하기`, 진행·카카오맵·조건부 영역은 그대로다. production Results/CourseConfirm에는 `한 곳 더 고르기`를 노출하지 않았다.
- 후보 순서·양방향 exact 판정·3/6개 목표·16/12/36 attempt 계산은 UI에서 재구현하지 않고 2-Y 결과와 continuation을 소비한다.
- B tap 계약은 전달받은 `VerifiedCourseV1` identity와 엔진 방문 순서를 그대로 CourseConfirm에 넘기는 표시 경계이며 추천/route 재호출을 만들지 않는다.
- 이전 one-stop connector의 자연 상한 4, 50m 경계, 상세 선렌더, 동시 2, singleton/10분 재사용, 부분 실패와 추천 시간 불산입 계약을 유지했다.

### 3. 실행한 테스트와 결과

- 실패 우선: 신규 two-stop model 부재, panel 부재, 2곳 connector 요청 0개를 각각 확인한 뒤 구현했다.
- `npx tsx --test test/ui/two-stop-selection.test.ts test/ui/course-v1-route-geometry.test.ts`: **25/25 통과**.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **216/217 통과, 실패 0, 기존 skip 1**.
- `npm test`: **117/117 통과**.
- `git diff --check`: **통과**.
- 실제 API·DB·GPS·Simulator·실기기 호출: **0회**.

### 4. 다음 결정·위험·재현 조건

- 다음 결정은 Wave 2 통합 게이트에서 fixture-injected port를 앱 session composition의 공유 one-stop/pair ledger에 붙이고, 그때만 CourseConfirm secondary → Results A 선택 entry를 활성화할지 수락하는 것이다. 새 환경 flag는 만들지 않는다.
- 이번 작업은 일반 사용자 entry를 의도적으로 열지 않았으므로 현재 배포 화면에서 새 secondary action이 보이지 않는 것이 정상이다. 자동 게이트 전에 노출하면 single/pair 공유 12회 ledger의 composition 소유가 불명확해진다.
- native 위험은 2곳 상세의 실제 Kakao 지도 geometry/connector 부분 실패와 긴 목록 취소 후 scroll/focus 복원이다. Wave 2 자동 gate 후 iOS 실기기에서 B→A·왕복·외부 카카오맵을 별도 확인해야 한다.
- 공유 작업트리의 보드에는 다른 세션 변경이 이미 존재했으나 이 작업에서는 보드를 편집하지 않았다.

## 2026-09-03 통합 검토 — 같은 U-TWO-STOP-01 안의 필수 보완

상태: **표시·상태·엔진 port 구현 확인 / 사용자 활성화 전 보완 필요**. 새 `-R` 작업을 만들지 않고 아래 항목을 이 작업의 남은 완료 기준으로 흡수한다.

### 확인된 문제

1. `TwoStopSelectionPanel`과 접근성 문구가 내부 설계 기호인 `A`를 사용자에게 그대로 보여 준다. `A와 함께 가능한 장소`가 아니라 선택한 실제 장소명 또는 `선택한 장소와 함께 가능한 곳`처럼 처음 쓰는 사람도 이해할 문구를 사용한다. 엔진이 B→A를 선택할 수 있으므로 `첫 번째 장소`라고 바꾸면 안 된다.
2. 엔진은 목표 3개를 성공해도 그 전에 탈락한 후보 reason이나 후보 소진 stop reason을 함께 반환할 수 있다. 현재 controller/port는 이를 그대로 보존해 **성공 3개를 모두 보여 주면서** `실제 경로를 확인하지 못했어요` 또는 `근처 장소가 부족해요`를 표시할 수 있다.
3. 누적 6개 표시 상한 도달을 엔진 내부 `attempt_limit_reached`로 닫는 경우에도 실제 provider 예산이 소진된 것처럼 안내할 수 있다. 결과 상한 도달은 오류 문구를 표시하지 않고 더보기만 종료해야 한다.
4. production `ResultsScreen`·`CourseConfirmScreen`·session composition은 아직 새 panel/controller/port를 호출하지 않는다. 현재 앱에서 `한 곳 더 고르기`가 보이지 않는 것은 의도된 활성화 전 상태이지 기능 완료가 아니다.

### 구현 지시

- 후보 카드·로딩·접근성 문구는 `firstSummary.place.title` 또는 중립적인 `선택한 장소`를 사용하고, literal `A`를 production copy에서 제거한다.
- 현재 page에서 exact 성공이 목표 3개에 도달하면 이전 candidate rejection과 후보 소진 reason을 사용자 오류로 남기지 않는다.
- 1~2개 partial 또는 0개일 때만 안전한 부족 사유를 표시한다. provider/store처럼 전체 흐름을 중단한 terminal은 성공 수와 무관하게 중립적인 일시 실패 안내를 허용한다.
- 누적 6개 도달은 정상 완료다. 실제 shared/provider attempt가 소진된 경우에만 `추가 확인 횟수 소진` 문구를 표시한다.
- 위 표시 보완 뒤에도 production entry는 아직 켜지 않는다. `API-TWO-STOP-02`와 `QA-TWO-STOP-01` 자동 통합 게이트가 통과한 뒤 Wave 2 활성화에서 한 번만 session ledger와 CourseConfirm secondary → Results 선택 상태를 연결한다.

### 추가 fixture

1. 첫 후보 no-route 뒤 B 3개 성공: 카드 3개, 사용자 실패/부족 문구 0
2. 후보 소진과 동시에 B 3개 성공: 카드 3개, `근처 부족` 문구 0
3. B 1개 또는 2개 뒤 후보 소진: 성공 카드는 유지하고 안전한 부족 설명 1개
4. 누적 6개 도달·provider 예산 잔여: 더보기 숨김, `횟수 소진` 문구 0
5. 실제 shared attempt 12 소진: 현재 카드 유지, 소진 안내 1개, 추가 호출 0
6. 표시 문자열·접근성 문자열에 독립 기호 `A`/`B`와 `첫 번째 장소`가 없음

## U-TWO-STOP-01 추가 작업 명령 — 표시 사유 정규화

- 담당: UIUX 세션
- 상태: **지금 실행**
- 목적: 이미 구현된 2곳 선택 모듈의 사용자 문구와 완료 상태를 교정한다. production 화면 연결이나 추천 정책 변경 작업이 아니다.
- 선행 확인: `2-Y`와 `API-TWO-STOP-02`의 로컬 코드·계약 테스트는 통과했다. 따라서 다른 역할의 미완성을 이유로 typecheck 실패를 허용하지 않는다.

### 먼저 재현할 현재 결함

다음 코드 상태를 읽고, 아래 증상을 새 fixture에서 먼저 실패시킨다.

1. `src/ui/recommendation/TwoStopSelectionPanel.tsx`의 section/loading/card eyebrow가 내부 식별자 `A`를 그대로 표시한다.
2. `src/ui/recommendation/twoStopSelectionModel.ts`의 `candidate_rejected` progress가 임시 탈락 사유를 곧바로 영속 화면 상태에 넣는다.
3. 같은 controller의 completed/result 처리에서 새 reason이 없으면 이전 reason을 제거하지 않아 성공 뒤에도 과거 오류가 남는다.
4. `src/ui/recommendation/twoStopSelectionEnginePort.ts`가 성공 수와 무관하게 `reasons[0]` 또는 `continuation.stopReason`을 사용자 표시 사유로 전달한다. 이 때문에 최초 목표 3개 또는 누적 상한 6개를 채워도 부족·탈락·횟수 소진 문구가 함께 나타날 수 있다.

### 허용 수정 파일

- `src/ui/recommendation/twoStopSelectionModel.ts`
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`
- `test/ui/two-stop-selection.test.ts`
- 이 작업 문서의 완료 인계

이 목록 밖 파일이 필요하면 직접 수정하지 말고 정확한 계약 차단점을 인계한다. 특히 `src/engine/`, `src/services/`, Supabase/DB, data/catalog, `.env*`, `App.tsx`, `ResultsScreen.tsx`, `CourseConfirmScreen.tsx`, navigation, 제품 기준 문서와 작업조정 보드는 수정하지 않는다.

### 구현 계약

1. **사용자 문구**
   - section 제목은 `선택한 장소와 함께 가능한 곳`으로 통일한다.
   - loading은 `함께 갈 수 있는 장소 확인 중 · 현재 n곳`처럼 쓴다.
   - 후보 카드 eyebrow는 `함께 둘러볼 장소`처럼 중립 문구를 쓴다.
   - 후보 접근성 문구는 `선택한 장소와 함께 가능한 곳, {후보 장소명}, ...`으로 만든다.
   - 표시 및 접근성 문자열에 독립 설계 기호 `A`, `B`, `첫 번째 장소`를 넣지 않는다. 엔진은 B→A 순서를 선택할 수 있으므로 사용자가 먼저 고른 장소를 실제 방문 순서의 첫 장소라고 단정하지 않는다.

2. **진행 이벤트와 최종 표시 사유 분리**
   - `candidate_rejected`는 진행 관찰값일 뿐이다. 카드 탐색이 계속되는 동안 이를 영속 사용자 오류로 저장하지 않는다.
   - 사용자가 볼 reason은 완료 result에서 한 번 정규화한다. UI가 새로운 추천 정책이나 engine reason enum을 만들지 않는다.
   - 새로운 완료 결과에 표시할 reason이 없으면 이전 `state.reason`을 반드시 제거한다. 조건부 spread로 과거 reason을 보존하지 않는다.

3. **성공 개수별 정규화**
   - 최초 page가 고유 B 카드 3개를 채웠으면 `no_nearby_second_candidate`, `insufficient_time_for_two_stops`, `second_place_closed`, `no_exact_route`와 후보 소진 사유를 표시하지 않는다.
   - 이어보기까지 고유 B 카드가 누적 6개이면 정상 상한 도달이다. `attempt_limit_reached`나 `후보 소진`을 사용자 오류로 표시하지 않고 더보기만 닫는다.
   - 최초/추가 page가 1~2개 partial 또는 0개로 끝났을 때만 안전한 부족 사유 한 개를 표시할 수 있다. 이미 성공한 카드는 제거하지 않는다.
   - `provider_unavailable`, `store_unavailable`, `continuation_unavailable`처럼 요청 자체를 끝낸 terminal은 중립적인 일시 실패 문구를 허용한다. 같은 terminal을 progress와 result에서 중복 표시하지 않는다.
   - 실제 공유 attempt가 소진된 partial 결과에만 `attempt_limit_reached`를 표시한다. 단순히 UI 누적 상한 6개에 도달한 경우와 혼동하지 않는다.

4. **상태·호출 불변 조건**
   - 카드 순서, 최대 3/누적 6, B 중복 제거, 취소 snapshot/scroll/focus 복원, stale request 무시, 연타 잠금은 그대로 유지한다.
   - 표시 사유 정규화를 위해 엔진·route adapter를 다시 호출하지 않는다.
   - production Results/CourseConfirm entry는 아직 켜지 않는다. 이 보완과 `QA-TWO-STOP-01` 자동 게이트를 통과한 뒤 Wave 2에서 session ledger와 함께 한 번만 연결한다.

### failure-first 필수 fixture

1. 첫 후보 `no_exact_route` 뒤 서로 다른 B 3개 성공 → 카드 3, 사용자 실패/부족 문구 0
2. 후보 소진 stop reason과 동시에 B 3개 성공 → 카드 3, 부족 문구 0
3. B 1개 및 2개 뒤 후보 소진 → 성공 카드 유지, 안전한 부족 설명 1개
4. 누적 B 6개 도달·provider 예산 잔여 → 더보기 닫힘, 횟수 소진 문구 0
5. 실제 shared attempt 12 소진·카드 6개 미만 → 현재 카드 유지, 소진 안내 1개, 추가 호출 0
6. 이전 page의 rejection reason 뒤 다음 완료 result에 reason 없음 → `state.reason`이 `undefined`
7. panel source와 candidate 접근성 문자열에 사용자 노출용 독립 `A`/`B`, `첫 번째 장소`가 없음
8. 기존 취소/stale/연타/순서/누적 6 fixture는 변경 없이 통과

### 검증 명령과 완료 기준

다음을 순서대로 실행한다.

```bash
npx tsx --test test/ui/two-stop-selection.test.ts
npx tsx --test test/ui/two-stop-selection.test.ts test/ui/course-v1-route-geometry.test.ts
npm run test:ui
npm run test:typecheck
git diff --check
```

실제 API·DB·GPS·Simulator·실기기는 이 국소 보완에서 호출하지 않는다. 모든 명령이 통과하고 위 8개 fixture가 관찰 가능한 기대값을 검증해야 완료다. 실패를 skip하거나 문자열 source 검사만으로 상태 정규화를 대체하지 않는다.

완료 시 이 문서 아래에 반드시 다음 네 항목을 남긴다.

1. 변경 파일과 각 변경 목적
2. 변경하지 않은 engine/API/production 활성화 계약
3. failure-first 결과와 최종 명령별 테스트 수·결과
4. `QA-TWO-STOP-01`에 넘길 남은 위험·재현 조건

## 추가 작업 완료 인계 — 표시 사유 정규화 (2026-09-03)

### 1. 변경 파일과 각 변경 목적

- `src/ui/recommendation/twoStopSelectionModel.ts`: `candidate_rejected`를 사용자 오류 상태에 저장하지 않도록 분리했다. 최종 result를 받을 때마다 이전 reason을 명시적으로 제거하고, 고유 카드 3개 성공의 부족/탈락 사유와 누적 6개 정상 상한의 `attempt_limit_reached`를 숨긴다. terminal은 유지하고 0~2개 partial의 안전 사유는 보존한다.
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`: engine 완료 reason을 한 번만 정규화한다. provider/store/continuation terminal을 우선 보존하고, 최초 목표 3개와 누적 verified 6개는 정상 완료로 처리하며, shared stage ledger가 실제 12회에 도달한 경우에만 `attempt_limit_reached`를 전달한다. completed progress에는 표시 reason을 싣지 않는다.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`: 사용자 노출 문구를 `선택한 장소와 함께 가능한 곳`, `함께 갈 수 있는 장소 확인 중`, `함께 둘러볼 장소`로 교체했다. 취소 접근성 문구도 방문 순서를 단정하지 않는 표현으로 바꿨다.
- `test/ui/two-stop-selection.test.ts`: rejection 뒤 3개 성공, 후보 소진과 3개 성공, partial 1/2, 누적 6 정상 종료, 실제 shared 12회 소진, 다음 완료의 과거 reason 제거, adapter 단계별 정규화, 표시·접근성 문자열 fixture를 추가했다.

### 2. 변경하지 않은 engine/API/production 활성화 계약

- `src/engine/`, `src/services/`, API/DB/Supabase/data, `.env*`는 수정하지 않았고 엔진의 후보 순서·reason enum·3/6 상한·16/12/36 attempt 계산을 바꾸거나 UI에서 재계산하지 않았다.
- `App.tsx`, `ResultsScreen.tsx`, `CourseConfirmScreen.tsx`, navigation, 제품 기준 문서와 작업조정 보드는 수정하지 않았다. production `한 곳 더 고르기` entry는 계속 비활성이다.
- 카드 순서·B 중복 제거·취소 snapshot/scroll/focus·stale request 차단·same-tick 잠금·route 재호출 0 계약은 유지했다.
- 실제 API·DB·GPS·Simulator·실기기 호출은 0회다.

### 3. failure-first 결과와 최종 명령별 테스트 수·결과

- failure-first `npx tsx --test test/ui/two-stop-selection.test.ts`: **15개 중 5개 실패**를 확인했다. 실패는 내부 `A` 문구, 3개 성공 뒤 과거 탈락 reason 잔존, 누적 6 뒤 횟수 소진 오표시, 다음 완료 뒤 이전 reason 잔존이었다.
- 보완 후 `npx tsx --test test/ui/two-stop-selection.test.ts`: **16/16 통과**.
- `npx tsx --test test/ui/two-stop-selection.test.ts test/ui/course-v1-route-geometry.test.ts`: **30/30 통과**.
- `npm run test:ui`: **221/222 통과, 실패 0, 기존 skip 1**.
- `npm run test:typecheck`: **통과**.
- `git diff --check`: **통과**.

### 4. QA-TWO-STOP-01에 넘길 남은 위험·재현 조건

- QA 자동 gate는 첫 후보 `no_exact_route` 뒤 성공 3개, 성공 3개와 후보 소진 동시 완료, partial 1/2, 누적 6, shared ledger 정확히 12회를 engine→API fixture→UI port 관통 상태로 재현해야 한다. 사용자 reason은 각각 `없음`, `없음`, `안전 사유 1개`, `없음`, `소진 안내 1개`여야 한다.
- terminal 우선순위는 provider/store/continuation만 중립 오류로 표시하며 candidate rejection과 completed progress에서는 표시가 없어야 한다. 같은 terminal이 중복 렌더되지 않는지 확인한다.
- production entry는 QA 수락 뒤 Wave 2에서 session ledger와 함께 한 번만 연결한다. 그 전 앱에서 secondary action이 보이지 않는 것은 정상이며, 이번 국소 작업만으로 실기기 화면 완료를 주장하지 않는다.
- 실제 화면 연결 뒤에는 VoiceOver가 내부 설계 기호나 방문 순서를 읽지 않는지, 긴 목록 취소가 scroll/focus를 그대로 복원하는지 iOS 실기기에서 확인해야 한다.

## 2026-09-03 통합·결정 재검증

- 표시 사유 정규화 코드와 인계를 대조했고 `candidate_rejected` 비영속화, 새 완료 결과의 과거 reason 제거, 성공 3개·누적 6개 정상 종료, 실제 shared 12회 소진 partial 분리가 작업 계약과 일치함을 확인했다.
- 통합 재실행: two-stop UI+geometry **30/30**, 전체 UI **221 통과·기존 skip 1·실패 0**, 전체 일반 테스트 **117/117**, typecheck와 `git diff --check`가 통과했다.
- `U-TWO-STOP-01` 모듈 작업은 **수락**한다. production 비노출은 누락이 아니라 자동 게이트 전 안전 경계다. 다음은 `QA-TWO-STOP-01`이며, 통과 전 Results/CourseConfirm/session composition을 연결하거나 Edge를 배포하지 않는다.

## QA-TWO-STOP-01 반환 보완 명령 — 동일 선택 session reuse

- 담당: UIUX 세션
- 상태: **보완 필요**
- 원인 확정: QA TS-12에서 A 선택 완료 → 취소 → 같은 A 재선택 시 provider attempt는 0이지만 Proxy adapter가 10회 다시 호출됐다. 엔진 `beginReleaseTwoStopSelectionV1`은 `reuse: { courses, continuation }`을 검증해 route 0으로 재사용할 수 있으나, `createTwoStopSelectionEnginePort`가 `reuse`를 context에서 제외하고 완료 결과를 session 안에 보관하지 않는다.
- 영향: Kakao 신규 호출량은 늘지 않아도 Edge 호출·응답 지연·배터리·실패 표면이 불필요하게 증가한다. 다른 장소 C를 선택하는 독립 branch와 누적 ledger는 유지해야 한다.

### 허용 수정 파일

- `src/ui/recommendation/twoStopSelectionEnginePort.ts`
- `test/ui/two-stop-selection.test.ts`
- 이 작업 문서의 완료 인계

QA fixture와 engine/API 코드를 통과시키기 위해 수정하지 않는다. `src/engine/`, `src/services/`, `test/qa-two-stop-integration.test.ts`, 다른 UI 파일, App/navigation, Edge/DB/data, `.env*`, 제품 기준 문서와 보드는 금지한다.

### 구현 계약

1. `createTwoStopSelectionEnginePort`의 closure 안에 **현재 Results session 수명만 갖는** first-place별 reuse 저장소를 둔다. navigation params, AsyncStorage, DB, 전역 singleton에는 저장하지 않는다.
2. `begin`이 정상 완료한 raw engine 결과의 검증된 course들과 continuation을 first place branch별로 보관한다. 같은 A를 다시 `begin`하면 이를 엔진의 기존 `reuse` 입력으로 전달한다. 서명·입력·provider·firstCourse 유효성 판정은 엔진에 맡기고 UI가 재구현하지 않는다.
3. 재사용이 유효하면 engine이 route/Proxy adapter 0회로 같은 검증 카드와 continuation을 반환해야 한다. ledger는 현재 session 누적값으로 전진하고 취소로 환불·초기화하지 않는다.
4. `continue`가 성공한 경우 기존 저장 course와 새 page course를 두 번째 장소 ID 기준으로 중복 없이 합쳐 최신 continuation과 보관한다. 누적 6개 뒤 취소·동일 A 재선택도 카드 6개를 route 0으로 복원해야 한다.
5. 다른 C 선택은 A 결과를 섞지 않는 독립 branch다. C를 계산한 뒤 다시 A를 선택해도 A cache를 사용할 수 있으며 session 전체 ledger는 단조 증가한다.
6. abort된 요청, stale 결과, malformed/서명 불일치 결과는 reuse로 승격하지 않는다. `provider_unavailable`, `store_unavailable`, `continuation_unavailable`처럼 재시도 가치가 있는 transient terminal 0개 결과를 고정 cache로 만들어 같은 오류를 영구 재생하지 않는다.
7. reuse가 엔진 검증에서 거절되면 기존 fail-closed 또는 정상 재계산 결과를 그대로 따른다. UI가 stale course를 먼저 그리거나 가짜 exact로 승격하지 않는다.
8. 기존 취소 snapshot/scroll/focus 복원, request epoch, continue 연타 잠금, 3/6 상한, 표시 reason 정규화와 production 비활성 경계를 유지한다.

### failure-first fixture

1. A 완료 → 취소 → 같은 A 재선택: 두 번째 adapter/route call 증가 0, course ID/order/continuation 동일
2. A에서 pair 더보기까지 누적 6 → 취소 → 같은 A: 6개 복원, 추가 route 0
3. A 완료 → 취소 → C 선택: C는 별도 branch로 계산되고 A course가 섞이지 않음
4. A → C → A: 마지막 A는 기존 A 검증 결과를 0회로 재사용, 전체 ledger는 감소하지 않음
5. A pending 중 취소/abort 후 같은 A: 미완료 결과를 reuse하지 않고 늦은 결과 화면 반영 0
6. 같은 place ID라도 firstCourse/input signature가 달라 엔진 reuse 검증이 실패하면 stale 카드 표시 0
7. transient terminal 0개 완료 뒤 재선택: 고정 오류 cache로 즉시 종료하지 않음
8. 기존 reason 정규화·B→A 순서·continue 누적·취소 fixture 불변

### 검증과 완료 조건

먼저 전용 UI 테스트에서 실패를 확인하고 구현 후 다음을 실행한다.

```bash
npx tsx --test test/ui/two-stop-selection.test.ts
npx tsx --test test/ui/two-stop-selection.test.ts test/release-two-stop-selection.test.ts
npm run test:typecheck
git diff --check
```

이 단계에서 QA 파일을 수정하거나 production entry를 연결하지 않는다. 완료 인계에는 변경 파일/불변 계약/failure-first와 최종 수치/QA TS-12 재현에 넘길 위험을 네 항목으로 기록한다. 완료 뒤 QA 세션이 원본 TS-12와 전체 17개를 다시 실행한다.

## QA 반환 보완 완료 인계 — 동일 선택 session reuse (2026-09-03)

상태: **구현·전용 회귀 완료 / 전체 typecheck는 QA 소유 fixture 오류로 차단**. 새 작업 ID를 만들지 않고 U-TWO-STOP-01의 반환 보완으로 기록한다.

### 1. 변경 파일과 변경 목적

- `src/ui/recommendation/twoStopSelectionEnginePort.ts`: Results session 수명의 first-place별 raw engine `courses + continuation` 저장소를 port closure에 추가했다. 같은 선택의 다음 `begin`에는 엔진의 기존 `reuse` 입력으로 전달하고, `continue` 성공은 두 번째 장소 ID로 중복 없이 합쳐 최대 6개와 최신 continuation을 보존한다.
- 같은 adapter에서 요청별 ledger 증가분만 session ledger에 반영해 취소·다른 branch·늦은 완료가 이미 반영된 attempt를 되돌리지 않게 했다. reuse 서명과 input/provider/firstCourse 유효성 판정은 엔진에 맡겼다.
- 저장 승격은 request/first-place 일치, non-aborted, non-transient 완료, `courses.length === continuation.verifiedCount`를 만족할 때만 허용한다. provider/store/continuation terminal과 abort 결과는 기존 정상 branch를 덮지 않는다.
- `test/ui/two-stop-selection.test.ts`: 동일 선택 재선택 route 0과 course/continuation 동일성, pair 더보기 누적 6 복원, 선택→다른 선택→선택 branch 격리, abort·transient 비저장, 같은 place ID의 firstCourse signature 변경 시 엔진 재검증을 추가했다.

### 2. 변경하지 않은 engine/API/production 활성화 계약

- `src/engine/`, `src/services/`, API/Edge/DB/data, QA fixture, `.env*`, 제품 기준 문서와 작업조정 보드는 수정하지 않았다.
- `App.tsx`, `ResultsScreen.tsx`, `CourseConfirmScreen.tsx`, navigation을 수정하지 않았고 production `한 곳 더 고르기` entry는 계속 비활성이다.
- UI는 engine signature를 재구현하거나 cache hit을 스스로 exact로 승격하지 않는다. 저장된 raw 결과는 항상 `beginReleaseTwoStopSelectionV1`의 `reuse` 검증을 다시 통과해야 표시된다.
- 취소 snapshot/scroll/focus, request epoch·stale 차단, continue 연타 잠금, 카드 순서·3/6 상한, 표시 reason 정규화는 유지했다. 실제 API·DB·GPS·Simulator·실기기 호출은 0회다.

### 3. failure-first와 최종 테스트 수·결과

- failure-first `npx tsx --test test/ui/two-stop-selection.test.ts`: 동일 선택 두 번째 `begin`에서 adapter 누적 호출이 **6→12**로 증가해 **16개 중 1개 실패**를 확인했다. 기대 증가분은 0이었다.
- 구현 후 `npx tsx --test test/ui/two-stop-selection.test.ts`: **20/20 통과**.
- `npx tsx --test test/ui/two-stop-selection.test.ts test/release-two-stop-selection.test.ts`: **35/35 통과**.
- `git diff --check`: **통과**.
- `npm run test:typecheck`: **실패 1건**. 수정 금지된 `test/qa-two-stop-integration.test.ts:244`의 connector unavailable fixture가 `PrivateWalkConnectorResult` 필수 `reason`과 `receipt`를 제공하지 않는다. UI adapter 및 UI 테스트 타입 오류는 없으며 요청에 따라 QA 파일을 수정하지 않았다.

### 4. QA TS-12 재현에 넘길 남은 위험·조건

- QA는 원본 TS-12에서 동일 session-scoped port/controller로 선택 A 완료→취소→같은 A 재선택을 실행해 두 번째 adapter call 증가 **0**, course ID/order/continuation 동일을 확인한다. 이후 C 선택은 별도 계산되고 C→A 복귀는 A branch를 0회로 재사용해야 한다.
- 누적 6 fixture에서도 더보기 완료→취소→같은 선택이 6개를 복원하고 route/Proxy 증가 0이어야 한다. provider attempt와 session ledger는 감소하지 않아야 한다.
- abort pending·provider/store/continuation terminal 0개 결과는 cache되지 않아 재선택 때 정상 재시도가 발생해야 한다. 동일 place ID라도 input/provider/firstCourse signature가 달라지면 엔진 reuse가 거절되고 stale 카드 선표시 없이 재계산 또는 fail-closed해야 한다.
- QA 전체 게이트 전 먼저 QA 소유 `test/qa-two-stop-integration.test.ts:244` fixture의 타입 계약을 복구해야 한다. 그 뒤 TS-12와 전체 시나리오를 재실행하고, 통과 전 production 연결·원격 Edge 배포를 진행하지 않는다.

## 2026-09-03 통합·결정 재검증 — session reuse

- `createTwoStopSelectionEnginePort`가 Results session 수명의 first-place별 raw result를 보관하고, 같은 선택의 `begin`에서 engine `reuse` 검증을 거쳐 route 0으로 복원하는 것을 확인했다. 누적 6, A→C→A 분리, abort·transient 비저장, firstCourse signature 변경 재검증도 구현 계약과 일치한다.
- 통합 재실행: UI+engine 전용 **35/35 통과**, 수정하지 않은 원본 `QA-TWO-STOP-01` **17/17 통과**. 과거 TS-12의 동일 A 재선택 adapter 증가 10은 0으로 해소됐다.
- 전체 typecheck의 유일한 실패는 QA 소유 `test/qa-two-stop-integration.test.ts:244`가 `PrivateWalkConnectorResult`의 필수 `reason`·`receipt`를 누락한 fixture 타입 오류다. UI 소유 코드 오류가 아니므로 `U-TWO-STOP-01`은 **수락**하고 QA에 반환한다.
- production entry와 원격 Edge는 계속 비활성이다. QA가 fixture 타입을 복구하고 전체 지정 회귀를 통과하기 전에는 Wave 2 연결을 시작하지 않는다.

---

# U-TWO-STOP-02 — 최대 2곳 선택 production session 연결

## 작업 상태와 목적

- 담당: **UIUX 세션 단독**
- 상태: **작업 가능**
- 선행 조건: `2-Y`, `API-TWO-STOP-02`, `U-TWO-STOP-01`, `QA-TWO-STOP-01` 자동 게이트 수락 완료
- 목적: 이미 자동 검증한 pair-only 엔진·route receipt port·UI controller를 실제 `ResultsScreen → CourseConfirmScreen → ResultsScreen → 2곳 CourseConfirm` 흐름에 **한 번만 연결**한다.
- 현재 앱에서 `한 곳 더 고르기`가 보이지 않는 것은 기존 안전 차단 상태다. 이번 작업은 버튼만 노출하는 작업이 아니라 동일 recommendation session의 runtime input, attempt ledger, 취소 snapshot과 화면 수명을 함께 연결하는 production composition 작업이다.

이번 작업 뒤에도 사용자가 자동으로 2곳을 추천받는 구조가 아니다. 실제 검증 one-stop 상세에서 사용자가 명시적으로 `한 곳 더 고르기`를 눌렀을 때만 최대 2곳 선택 모드가 시작된다. 자유 장바구니, 수동 순서 변경, 3곳 추천은 계속 금지한다.

## 시작 시 읽을 범위

다음만 읽고 과거 archive 전체를 다시 읽지 않는다.

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`의 `UXV-47`
3. `docs/테스트.md`의 `COURSE-03`, `COURSE-10`, `COURSE-12`
4. 이 파일의 `U-TWO-STOP-01` 현행 계약과 완료 인계
5. `docs/work/qa-release/two-stop-limited-assembly-validation.md`의 최종 수락 결과
6. 현재 코드 `ResultsScreen.tsx`, `CourseConfirmScreen.tsx`, `recommendation/v1Session.ts`, `twoStopSelectionModel.ts`, `twoStopSelectionEnginePort.ts`, `TwoStopSelectionPanel.tsx`

## 현재 공개 계약 — 변경하지 말 것

- 엔진 entry는 `beginReleaseTwoStopSelectionV1` / `continueReleaseTwoStopSelectionV1`이며 UI가 후보 순서·양방향 비교·시간·운영시간 판정을 다시 구현하지 않는다.
- 기본 B 목표 3개, partial 0~2개 허용, 명시적 더보기 뒤 누적 최대 6개다.
- 신규 provider attempt 상한은 최초 one-stop 최대 8 + 자동 pair 최대 16 + 명시적 확장 공유 최대 12 = session 최대 36이다.
- 공유 12회는 one-stop `다른 장소 더 보기`와 pair `함께 갈 장소 더 보기`가 같이 사용한다. 취소·뒤로가기·같은 장소 재선택으로 초기화하거나 환불하지 않는다.
- B 선택은 이미 받은 exact `VerifiedCourseV1` snapshot을 열며 추천·route 호출은 0이다.
- 2곳 상세 geometry connector는 최대 6·동시 2이고 추천 시간 계산에는 더하지 않는다.
- 조건부 시장·거리, 미검증 후보, 근사 route는 B로 승격하지 않는다.
- 새 환경변수나 feature flag를 만들지 않는다.

## 허용 수정 경계

필요한 최소 범위에서 다음을 수정할 수 있다.

- `src/ui/ResultsScreen.tsx`
- `src/ui/CourseConfirmScreen.tsx`
- `src/ui/recommendation/v1Session.ts`
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`
- `src/ui/recommendation/twoStopSelectionModel.ts`
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`
- 필요할 경우 `src/ui/recommendation/` 아래 production composition 전용 파일 1개
- UI 소유 테스트와 이 작업 문서의 완료 인계

`App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`는 아래 session intent 방식이면 수정하지 않는다. 정말 필요하다고 판단되면 먼저 현재 방식으로 해결할 수 없는 타입·navigation 차단점을 인계하고 임의 수정하지 않는다.

수정 금지:

- `src/engine/`, `src/services/`, Supabase Edge/migration, DB, data/catalog, `.env*`
- QA 전용 `test/qa-two-stop-integration.test.ts`
- 제품 기준 문서와 작업조정 보드
- API 호출이 더 잘 나오게 하려는 후보 순서·상한·실패 사유 변경

## 1. recommendation session runtime을 한 곳에서 소유

현재 `v1Session.ts`의 `continuationInputs`가 같은 `RecommendationSession` 객체를 키로 원래 `CourseV1LimitedInput`을 메모리에 보관한다. 이를 무관한 전역 상태나 navigation payload로 복제하지 말고, 같은 WeakMap 기반 session runtime 경계에서 아래를 함께 소유한다.

- 최초 추천에 사용한 원본 input의 provider, route port, receipt route port
- session attempt ledger
- 동일 session에서 한 번만 만드는 `TwoStopSelectionPort`
- CourseConfirm에서 Results로 넘길 **일회성 pair selection intent**

WeakMap key가 사라지면 함께 해제되는 화면 수명 메모리여야 한다. AsyncStorage·DB·navigation params·전역 무제한 `Map`에 provider, 함수, `AbortSignal`, 좌표가 포함된 runtime input이나 pair 결과를 넣지 않는다.

초기 ledger는 최초 결과의 실제 `diagnostics.newProviderAttemptCount`를 0~8 범위에서 사용한다. 값이 없거나 비정상이면 적게 센 것으로 가정하지 말고 상한 8로 fail-closed한다. `totalNewProviderAttempts`는 항상 세 구간의 합과 같아야 한다.

`createTwoStopSelectionEnginePort`의 내부 ledger가 별도 복사본으로 갈라지지 않게 UI-owned read/commit 경계를 추가한다. one-stop 더보기와 pair begin/continue가 모두 같은 session ledger의 최신값을 읽고 실제 새 provider attempt만 단조 증가시켜야 한다. 동일 receipt·cache/session reuse는 새 attempt로 세지 않는다.

## 2. 기존 one-stop 더보기를 공유 12회 예산에 연결

`continueReleaseRecommendationSession`의 현재 기본 8회 page 계약을 production pair-enabled session에서 그대로 반복하면 공유 상한을 우회할 수 있다. 다음을 구현한다.

1. 호출 직전 공유 잔여를 `12 - sharedExpansionAttempts`로 계산한다.
2. 그 page의 `pageProviderAttemptLimit`은 `min(8, 공유 잔여)`다.
3. 잔여가 0이면 엔진·adapter·Edge를 호출하지 않고 현재 목록을 유지하며 `이번 추천의 추가 확인 횟수를 모두 사용했어요`에 해당하는 UI-owned 종료 상태를 반환한다.
4. 완료 뒤 page diagnostics의 실제 `newProviderAttemptCount`만 ledger에 반영한다. timeout·store 실패 뒤 provider가 이미 시작된 receipt를 0으로 되돌리지 않는다.
5. 단일 page의 화면 append 최대 3, 기존 순서·중복 제거·자동 다음 page 호출 금지는 그대로 유지한다.

one-stop 더보기와 pair 작업이 동시에 같은 잔여 예산을 예약하지 못하게 동일 session의 provider-starting operation을 직렬화하거나 명시적인 단일 in-flight lease로 보호한다. 단순 React state만으로 같은 tick 중복 호출을 막았다고 간주하지 않는다.

기존 one-stop 더보기 요청 중 사용자가 카드를 눌러 CourseConfirm으로 이동하는 경합도 fixture로 고정한다. 가장 작은 안전 해법은 해당 요청 동안 카드 선택을 busy/disabled 처리하고, press 시점의 session lease도 다시 검사하는 것이다. 어느 해법이든 pair가 오래된 ledger로 시작하거나 두 요청이 공유 잔여를 중복 소비하면 실패다.

## 3. CourseConfirm의 production entry

exact one-stop 상세에서만 기존 primary `코스 시작하기`를 유지하고, 그 아래 또는 같은 행동 영역에 명확한 secondary `한 곳 더 고르기`를 표시한다.

- `canOfferTwoStopSelection(course, port)`가 true이고 같은 session runtime에 receipt route port가 있을 때만 표시한다.
- 2곳 course, 조건부 수동 course, 손상된 snapshot, session runtime 재수화 실패, route-only legacy에서는 숨긴다.
- 누르면 API를 호출하지 않는다. 같은 session runtime에 `{선택한 exact one-stop course}`를 일회성 intent로 기록하고 `navigation.goBack()`으로 기존 Results 인스턴스에 돌아간다.
- callback, provider, Date, engine input, controller를 navigation params에 넣지 않는다. `CourseConfirm`에 원본 result 전체를 복제하거나 같은 Results route를 새로 push하지 않는다.
- intent 기록이 실패하거나 session이 달라졌으면 이동하지 않고 `이 결과에서는 한 곳을 더 확인할 수 없어요`처럼 안전하게 안내하며 기존 one-stop 시작은 유지한다.

## 4. Results의 선택 모드 연결

Results가 다시 focus될 때 같은 session의 pair intent를 **한 번만 consume**한다. 재렌더·focus 반복으로 `begin`을 두 번 호출하지 않는다.

intent를 받는 순간 현재 화면을 `TwoStopSelectionSnapshot`으로 보존한다.

- 대표와 현재까지 누적한 모든 one-stop 대안의 exact course와 ID·순서
- one-stop continuation과 page/terminal 상태
- 현재 more loading/종료 표현에 필요한 값
- scroll offset
- 사용자가 상세로 들어갔던 course ID(접근성 focus 복원용)

그 다음 `createTwoStopSelectionController`와 동일 session의 `TwoStopSelectionPort`를 사용해 begin한다. 선택 모드 중에는 일반 one-stop 목록·one-stop 더보기·조건부 영역을 같이 노출하지 말고 `TwoStopSelectionPanel`만 주 결과 영역에 표시해 사용자가 어느 흐름을 조작하는지 분명하게 한다. 상단 헤더·남은 시간 맥락은 유지할 수 있다.

- B는 exact 성공 순서대로 1개씩 나타난다.
- B 카드 tap은 전달받은 2곳 course snapshot으로 기존 `CourseConfirm`을 연다. 추가 추천/route 호출은 0이다.
- pair CourseConfirm 뒤로가기는 같은 A 선택 화면과 B 목록으로 돌아온다.
- panel의 `선택한 장소 코스 시작하기`는 A의 exact one-stop snapshot으로 `VerifiedCourseProgress`를 연다. pair 계산을 다시 하지 않는다.
- pair 더보기는 controller의 기존 continue를 사용하고 공유 잔여가 있을 때만 동작한다.
- 0개·partial·terminal에서도 A one-stop 시작과 `선택 취소`를 항상 유지한다.

취소 시 controller를 abort하고 저장했던 one-stop 목록·순서·continuation·page state·스크롤을 **호출 0회로** 복원한다. 완료되지 않은 늦은 progress/result는 request epoch가 달라 화면에 반영되지 않아야 한다. 가능하면 복원 직후 기존 course 카드에 접근성 focus를 되돌리되, focus 실패가 목록 재계산의 이유가 되어서는 안 된다.

같은 A 재선택은 수락된 session reuse를 사용해 adapter 증가 0으로 기존 B 결과와 continuation을 복원한다. 다른 C 선택은 별도 branch이며 A 결과와 섞지 않는다. A→C→A에서도 ledger는 줄지 않는다.

## 5. 화면·상태 구조 원칙

- `ResultsScreen`에 API·ledger·stale 조건을 직접 계속 누적하지 않는다. session runtime 조립과 화면 전환을 담당하는 작은 UI-owned coordinator/hook으로 분리하고, 기존 표시 컴포넌트와 controller를 재사용한다.
- React 화면 컨테이너는 subscribe/unsubscribe, snapshot, navigation만 담당한다.
- 사용자 문구에 내부 `A`/`B`, provider명, attempt 수, receipt/store 원문을 표시하지 않는다.
- 결과 3개 또는 누적 6개 정상 도달 때 실패·횟수 소진 문구를 함께 보이지 않는다.
- no candidate/time/closed/no route와 provider/store/continuation terminal 정규화는 `U-TWO-STOP-01`을 그대로 사용한다.
- 개발 diagnostics가 켜져 있어도 pair production 상태를 바꾸거나 API를 추가 호출하지 않는다.

## failure-first 필수 시나리오

구현 전에 production 미연결을 재현하는 실패 테스트를 추가한다. 파일 문자열 포함 여부만 검사하지 말고 session runtime과 controller/화면 adapter의 관찰 결과를 검증한다.

1. exact one-stop CourseConfirm: primary 유지, secondary 노출; secondary tap은 route 0, 기존 Results로 돌아가 intent 1회 소비
2. 2곳·조건부·runtime/receipt port 부재: secondary 미노출
3. Results intent 소비: begin 정확히 1회, 진행 성공 `1→2→3`, 일반 one-stop/조건부 목록 비노출
4. B 선택: exact 2곳 ID·engine order 그대로 CourseConfirm, 추가 adapter/provider 0
5. pair 상세 뒤로가기: 같은 A와 B 목록·pair continuation 유지
6. A one-stop 시작: 원본 one-stop snapshot으로 Progress 이동, pair 재호출 0
7. 취소: 대표/누적 대안 ID·순서, single continuation/page state, scroll/focus 복원, 호출 0
8. pending 취소·화면 unmount·다른 session: 늦은 응답 반영 0, intent 교차 소비 0
9. 같은 A 재선택 및 A→C→A: A 재진입 adapter 증가 0, branch 혼합 0, ledger 감소 0
10. initial attempt 8 + one-stop 더보기 8 + pair 자동 16 뒤 pair 더보기: 공유 잔여 4만 허용하고 session 총 36 이하
11. pair 더보기로 공유 12 소진 뒤 one-stop으로 취소·복원하여 더보기: provider/adapter 호출 0, 소진 안내 1개
12. one-stop 더보기와 pair 시작 same-tick 경합: 공유 예산 중복 예약 0, 실제 신규 attempt 합 12 이하
13. cache/session reuse만 있는 page: shared attempt 증가 0
14. pair 결과 3개·누적 6개: 정상 종료, 실패/소진 문구 0
15. navigation state JSON 검사: Date/function/provider/route port/controller/AbortSignal 없음
16. 기존 one-stop 카드 tap·더보기·조건부 영역·CourseConfirm 지도·진행·카카오맵 회귀 불변

## 실행 명령과 완료 기준

먼저 가장 좁은 production composition 테스트의 실패를 확인하고 구현한다. 구현 뒤 다음을 실행한다.

```bash
npx tsx --test test/ui/two-stop-selection.test.ts
npx tsx --test test/qa-two-stop-integration.test.ts
npx tsx --test test/ui/two-stop-selection.test.ts test/ui/release-one-stop-more-results.test.ts test/ui/course-v1-card-detail.test.ts test/ui/course-v1-route-geometry.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

완료 조건:

- 위 16개 production composition 시나리오와 기존 QA 17개가 모두 통과한다.
- 기존 one-stop 결과·더보기·상세·진행 회귀가 0이다.
- session 신규 provider attempt 36, pair 카드 3/6, connector 6·동시 2 상한을 넘지 않는다.
- 취소/재선택/B 선택에서 불필요한 route 호출이 없다.
- 일반 사용자 화면에 secondary와 선택 모드가 실제 연결돼 있고, `.env` flag나 테스트 전용 launcher에 의존하지 않는다.

이 작업에서는 Simulator·실기기·실제 API·원격 Edge·DB를 호출하지 않는다. UI 자동 검증을 actual network로 대체하지 않는다. 원격 Edge 배포와 실기기 smoke는 이 작업 수락 뒤 별도 한 번만 진행한다.

## 완료 인수인계 형식

이 문서 아래에 반드시 다음 네 항목을 남긴다.

1. 변경 파일과 각각의 production 연결 목적
2. 변경하지 않은 engine/API/DB/data/navigation/정책 경계
3. failure-first 재현과 명령별 테스트 수·결과
4. 원격 Edge 배포 전 남은 위험, 실기기에서 확인할 최소 2개 흐름과 정확한 재현 조건

테스트를 통과하지 않은 항목을 “실기기에서 보면 됨”으로 넘기지 않는다. 반대로 자동 fixture로 확인한 16개 흐름을 Simulator에서 반복 조작하지 않는다. commit·push는 사용자 요청 전 금지한다.

## U-TWO-STOP-02 완료 인수인계 — 2026-09-03

### 1. 변경 파일과 각각의 production 연결 목적

- `src/ui/recommendation/v1Session.ts`: 기존 `RecommendationSession` WeakMap 수명에 원본 input, fail-closed 초기 attempt, 공유 ledger, session당 한 `TwoStopSelectionPort`, 직렬 operation lease, 노출된 exact one-stop allowlist, 일회성 pair intent를 함께 소유하도록 확장했다. one-stop page는 공유 잔여 `min(8, 12-used)`만 전달하고 실제 신규 attempt만 단조 반영하며, 잔여 0에서는 provider를 호출하지 않는다. 내부 B12와 route-only runtime에는 pair port를 만들지 않는다.
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`: 독립 ledger 복사본 대신 UI session runtime의 최신 ledger를 read/commit할 수 있는 선택적 경계를 추가했다. 기존 독립 fixture port 계약은 유지했다.
- `src/ui/CourseConfirmScreen.tsx`: 같은 session에 실제 노출된 exact one-stop snapshot이고 receipt port가 있을 때만 primary 아래 `한 곳 더 고르기`를 표시한다. tap은 route 호출 없이 intent를 기록하고 기존 Results로 `goBack()`하며, race로 기록에 실패하면 현재 상세와 안전 문구를 유지한다.
- `src/ui/ResultsScreen.tsx`: focus에서 같은 session intent를 한 번만 consume해 controller begin을 한 번 실행한다. 선택 직전 대표·누적 대안·continuation/page 상태·scroll/focus ID를 snapshot으로 보존하고, 선택 중에는 일반 one-stop·조건부 영역 대신 `TwoStopSelectionPanel`만 표시한다. exact pair 선택과 선택 장소 시작은 받은 snapshot을 그대로 navigation에 전달하며, 취소는 API 호출 없이 목록·상태·offset을 복원한다. one-stop/pair 동시 provider operation은 session lease로 막고 공유 소진 문구를 Results 로컬 상태로 표시한다.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`: production에서도 controller 표시 전용이라는 현행 책임을 주석에 명확히 했다.
- `test/ui/two-stop-production-session.test.ts`: WeakMap runtime, fail-closed 8, exact allowlist, 다른 session intent 차단, route-only 비노출, same-tick 직렬화, 공유 8+4와 소진 뒤 호출 0을 production composition fixture로 고정했다.
- `test/ui/two-stop-selection.test.ts`: 자동 게이트 전 비노출 문자열 기대를 production entry 연결 기대와 controller 위임 계약으로 교체했다.

### 2. 변경하지 않은 engine/API/DB/data/navigation/정책 경계

- `src/engine/`, `src/services/`, Supabase Edge/migration, DB, data/catalog, `.env*`, `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`, QA 전용 fixture와 작업조정 보드는 수정하지 않았다.
- engine의 후보 순서·양방향 비교·운영시간·시간 판정, B 기본 3/partial 허용/누적 6, initial 8 + automatic 16 + shared 12 = session 최대 36, B 선택 route 0, connector 최대 6·동시 2 계약을 바꾸지 않았다.
- provider·route port·함수·Date·AbortSignal·controller는 navigation params나 저장소에 넣지 않았다. 새 env flag, 자동 추천, 자유 장바구니, 3곳 조립도 추가하지 않았다.
- Simulator·실기기·Metro·Xcode·실제 API·원격 Edge·DB 호출은 0회다.

### 3. failure-first 재현과 명령별 테스트 수·결과

- failure-first `npx tsx --test test/ui/two-stop-production-session.test.ts`: 구현 전 **0/3 통과**. session API 부재 2건과 공유 소진 뒤 provider 재호출 1건을 재현했다. 최초 sandbox 실행은 TSX IPC socket `EPERM`으로 시작하지 못해 승인된 로컬 실행으로 기능 실패를 확인했다.
- 최종 `npx tsx --test test/ui/two-stop-production-session.test.ts`: **4/4 통과**.
- `npx tsx --test test/ui/two-stop-selection.test.ts`: **20/20 통과**.
- `npx tsx --test test/qa-two-stop-integration.test.ts`: **17/17 통과**. TS-01~16과 machine-readable receipt gate가 모두 통과했다.
- `npx tsx --test test/ui/two-stop-selection.test.ts test/ui/release-one-stop-more-results.test.ts test/ui/course-v1-card-detail.test.ts test/ui/course-v1-route-geometry.test.ts`: **49/49 통과**.
- production session까지 포함한 관련 묶음 6파일 실행: **70/70 통과**.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **229 통과 / 0 실패 / 기존 skip 1**. skip은 철회된 순차 새 추천 이력이다.
- `npm test`: **117/117 통과**.
- `git diff --check`: **통과**.

### 4. 원격 Edge 배포 전 남은 위험과 실기기 최소 확인 흐름

- 자동 fixture 범위의 미해결 실패는 없다. 남은 위험은 production receipt 응답 지연 중 foreground/background 전환, 실제 카탈로그에서 pair partial/0개가 나오는 빈도, VoiceOver focus 복원의 체감이다. scroll offset은 자동 계약으로 복원되지만 카드 node의 VoiceOver 강제 focus는 추가하지 않았으므로 실기기에서 확인한다.
- **왕복 1건:** route proxy가 활성화된 새 iOS internal build에서 현재 위치 복귀·120분으로 exact one-stop을 받은 뒤 카드 → `한 곳 더 고르기` → 점진 후보 → 후보 상세 → 뒤로가기 → `선택 취소`를 실행한다. primary 유지, secondary 1개, 같은 선택 장소/후보 목록 유지, 취소 뒤 기존 카드 순서·scroll 복원과 VoiceOver 읽기 위치를 확인한다.
- **별도 목적지 1건:** 출발지와 서로 다른 목적지·120분으로 one-stop `다른 장소 더 보기`를 1회 실행한 뒤 추가된 exact 카드 → `한 곳 더 고르기` → `함께 갈 장소 더 보기`를 실행한다. pair 상세의 실제 방문 순서·세 leg 지도, 뒤로가기 시 같은 후보, 공유 잔여 소진 시 중립 안내 1개와 반복 tap의 새 로딩 없음, 선택 장소 one-stop 진행 진입을 확인한다.
- 원격 Edge 배포와 위 실기기 2건은 이 자동 결과의 통합 수락 뒤 별도 한 번만 수행한다. 운영 호출량은 그 smoke에서만 기록하며 이번 작업에서는 배포하지 않았다.

## U-TWO-STOP-02 통합 반환 보완 — secondary eligibility gate

- 상태: **보완 필요 / 새 작업 ID를 만들지 않음**
- 통합 재검증 결과: production session 4/4, 기존 QA 17/17, 관련 UI 묶음 49/49, typecheck, 전체 UI 229 통과·기존 skip 1, core 117/117, diff check는 모두 통과했다.
- 반환 이유: 자동 테스트가 runtime의 `recordTwoStopSelectionIntent()` 거절은 검증했지만, 실제 `CourseConfirmScreen`의 **버튼 노출 조건**은 검증하지 않았다. 현재 `canSelectOneMore`는 `canOfferTwoStopSelection(course, twoStopPort)`만 사용한다. 따라서 구조상 exact one-stop이고 session에 pair port만 있으면, Results allowlist에 없는 복제/stale/조건부 one-stop도 secondary가 먼저 보이고 tap 뒤 `recordTwoStopSelectionIntent()`에서야 실패한다. 이는 “실제 Results에 노출된 exact one-stop에서만 secondary 표시” 계약과 맞지 않고 사용자가 고장으로 인식할 수 있다.

### 수정 범위

- `src/ui/recommendation/v1Session.ts`
- `src/ui/CourseConfirmScreen.tsx`
- `test/ui/two-stop-production-session.test.ts`
- 필요하면 기존 `test/ui/two-stop-selection.test.ts`의 production 연결 assertion
- 이 문서의 보완 완료 인계

이 외 파일은 수정하지 않는다. 특히 engine/API/Edge/DB/data/env/navigation/QA fixture와 호출 예산은 건드리지 않는다.

### 정확한 보완 계약

1. `v1Session.ts`에 mutation 없는 조회 함수(예: `canRecordTwoStopSelectionIntent(session, course)`)를 둔다.
2. 이 함수는 같은 session runtime에 pair port가 있고, operation이 시작 중이 아니며, `eligibleOneStopCourses`에 **동일한 실제 exact snapshot**으로 등록된 course일 때만 true다. Results 최초 대표·대안과 성공적으로 append된 one-stop만 eligible이다.
3. `recordTwoStopSelectionIntent()`도 같은 predicate를 사용해 조회와 기록 조건이 갈라지지 않게 한다. 조회 함수가 intent를 만들거나 지우면 안 된다.
4. `CourseConfirmScreen`의 secondary `available`은 기존 구조 검증 `canOfferTwoStopSelection()`과 새 session eligibility predicate를 모두 통과할 때만 true다.
5. 결과 allowlist에 없는 구조상 one-stop, 다른 session course, 동일 필드의 복제 객체, 조건부 수동 course, route-only/B12, 2곳 course에서는 버튼을 숨긴다. 눌러 본 뒤 오류를 표시하는 방식으로 대신하지 않는다.
6. 버튼 렌더 뒤 same-tick operation race가 생기면 기존 `recordTwoStopSelectionIntent()`의 최종 재검사를 유지한다. 이때만 현재 안전 오류를 사용할 수 있다.
7. 정상 exact one-stop의 primary, 정상 secondary tap→intent 1회→goBack, B 선택 route 0, 공유 ledger는 그대로 유지한다.

### failure-first 및 검증

먼저 아래 실패 fixture를 추가해 현재 노출 누락을 확인한다.

- 같은 session·실제 노출 exact course: eligibility true, secondary 표시
- 같은 필드이지만 새 객체인 복제 course: false, secondary 미표시
- allowlist에 없는 조건부/임의 exact one-stop: false
- 다른 session course, route-only/B12, 2곳 course: false
- 조회를 여러 번 해도 intent는 생기지 않으며, 정상 record 뒤 consume은 정확히 1회

수정 후 다음을 처음부터 실행한다.

```bash
npx tsx --test test/ui/two-stop-production-session.test.ts
npx tsx --test test/ui/two-stop-selection.test.ts
npx tsx --test test/qa-two-stop-integration.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

완료 인계에는 변경 파일, predicate의 정확한 true/false 경계, 테스트별 수치, 원격 Edge/실기기 미검증 상태를 네 항목으로 기록한다. 실제 API·Simulator·실기기·원격 배포는 하지 않는다. 이 보완 통과 전 `U-TWO-STOP-02`를 production 수락으로 표시하지 않는다.

## U-TWO-STOP-02 통합 반환 보완 완료 인수인계 — secondary eligibility gate (2026-09-03)

### 1. 변경 파일과 목적

- `src/ui/recommendation/v1Session.ts`: mutation 없는 `canRecordTwoStopSelectionIntent(session, course)`를 추가하고 `recordTwoStopSelectionIntent()`도 같은 predicate를 사용하도록 통합했다. 최초 allowlist는 `releaseOneStopDisplayResult()`가 실제 표시하는 대표와 중복 제거된 대안 최대 3개로 만들고, continuation은 화면 append 계약과 같은 page 앞 3개·single·place 중복 제거 결과만 등록한다.
- `src/ui/CourseConfirmScreen.tsx`: secondary의 `available`을 기존 one-stop 구조 검사와 새 session eligibility predicate의 교집합으로 변경했다. 렌더 뒤 operation이 시작되는 same-tick race에는 기존 record 단계 재검사와 안전 오류를 유지한다.
- `test/ui/two-stop-production-session.test.ts`: 실제 allowlist identity true, 반복 조회 무변이, 복제·임의/조건부 역할·다른 session·route-only·B12·2곳 false, 최초 대안 표시 상한 3, 성공 page append 상한 3, operation 중 false, 정상 record/consume 1회를 고정했다.
- `test/ui/two-stop-selection.test.ts`: CourseConfirm production 연결 assertion에 렌더 eligibility predicate 사용을 추가했다.
- 이 작업 문서: 반환 원인, 보완 경계와 검증 결과를 같은 U-TWO-STOP-02 이력으로 남겼다.

### 2. predicate의 정확한 true/false 경계와 유지 계약

- **true:** 같은 `RecommendationSession` WeakMap runtime에 pair port가 있고 provider-starting operation이 0이며, 실제 Results에 표시된 최초 대표·대안 또는 성공 page에서 실제 append 가능한 one-stop의 **동일 객체 snapshot**일 때만 true다.
- **false:** 같은 필드의 복제 객체, allowlist 밖 임의·조건부 역할 one-stop, 다른 session에서 온 course, route-only runtime, 내부 B12, 2곳 course, 표시 상한 밖 최초 4번째 대안/page 4번째 결과, operation 진행·대기 중에는 false다. 조회 반복은 intent를 만들거나 지우지 않는다.
- 정상 exact one-stop primary, secondary tap 뒤 intent 1회와 `goBack()`, B 선택 route 0, 공유 12·session 36 ledger, pair 3/6, connector 6·동시 2는 변경하지 않았다.
- `ResultsScreen`, engine/API/Edge/DB/data/env/navigation/QA fixture와 작업조정 보드는 수정하지 않았다.

### 3. failure-first 및 최종 테스트 결과

- failure-first `npx tsx --test test/ui/two-stop-production-session.test.ts`: **5개 중 4 통과·1 실패**. 새 mutation-free eligibility 함수 부재를 재현했고 기존 session/ledger 4개는 통과했다.
- 최종 `npx tsx --test test/ui/two-stop-production-session.test.ts`: **6/6 통과**.
- `npx tsx --test test/ui/two-stop-selection.test.ts`: **20/20 통과**.
- `npx tsx --test test/qa-two-stop-integration.test.ts`: **17/17 통과**.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **231 통과 / 0 실패 / 기존 skip 1**.
- `npm test`: **117/117 통과**.
- `git diff --check`: **통과**.

### 4. 다음 결정·위험과 미검증 상태

- 자동 fixture 범위에서 secondary 선노출 누락은 해소됐다. 복제/stale/조건부 역할 snapshot은 tap 후 오류가 아니라 렌더 단계에서 숨겨지며, 정상 snapshot만 기존 흐름을 유지한다.
- 실제 API, Simulator, 실기기, 원격 Edge 배포, DB 호출은 모두 0회다. 이 보완의 통합 수락 전에는 production 수락이나 원격 배포로 표시하지 않는다.
- 수락 뒤 기존 U-TWO-STOP-02 인계의 최소 실기기 2건에서 정상 exact secondary가 보이는지와, foreground 복귀·요청 경합 동안 stale 상세에 secondary가 선노출되지 않는지만 추가 관찰한다. 호출량·pair 결과 정확성 검증 범위는 기존 자동 게이트를 반복하지 않는다.

## U-TWO-STOP-02 통합 수락 — secondary eligibility gate (2026-09-03)

- 통합·결정 재검증에서 `canRecordTwoStopSelectionIntent()`가 같은 session의 실제 표시 allowlist 객체와 operation 0 상태만 허용하고, `CourseConfirmScreen`의 secondary 표시와 최종 intent 기록이 이 predicate를 함께 사용하는 것을 확인했다.
- 복제 객체·allowlist 밖 조건부/임의 course·다른 session·route-only·B12·2곳 course·표시 상한 밖 결과는 렌더 단계에서 제외된다. 정상 snapshot의 반복 조회는 상태를 바꾸지 않고, record/consume은 한 번만 성립한다.
- 독립 재실행 결과 production session **6/6**, selection **20/20**, QA integration **17/17**, typecheck, UI **231 통과·기존 skip 1**, core **117/117**, diff check가 모두 통과했다.
- 따라서 `U-TWO-STOP-02` 로컬 production 연결을 **수락**한다. 원격 Edge 배포와 출시 후보 실기기 2건은 수행하지 않았으므로 운영 활성화 완료로 해석하지 않는다.

# U-TWO-STOP-03 — 추천 화면 인라인 선택·sticky tray·fixed CTA

## 작업 상태와 목적

- 담당: **UIUX 세션 단독**
- 상태: **작업 가능**
- 선행 조건: `U-TWO-STOP-02`와 secondary eligibility gate 통합 수락 완료
- 목적: 현재 `Results 카드 → CourseConfirm → 한 곳 더 고르기 → Results 선택 모드`의 화면 왕복을 없애고, 추천 카드를 누른 즉시 같은 Results 화면에서 장소를 선택·비교한 뒤 고정 CTA로만 CourseConfirm을 여는 흐름으로 교체한다.
- 제품 관계: 기존 `COURSE-10`, `COURSE-12`, `UXV-47`의 진입 방식을 **교체**한다. 최대 2곳·exact 검증·엔진 결정 순서·취소 복원은 보완하며, 자유 장바구니·3곳·사용자 순서 편집은 계속 철회 상태다.

이 작업은 UI 진입과 표시 상태를 바꾸는 작업이다. pair 후보 계산식, 후보 순서, route/cache/receipt, 호출 예산을 다시 설계하지 않는다. 새 원격 배포나 실제 API 호출도 하지 않는다.

## 시작 시 읽을 범위

다음만 읽고 archive와 과거 작업 전체를 다시 읽지 않는다.

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/UIUX_공통규칙.md`의 코스 만들기 결과 카드·고정 CTA 현행 규칙
3. `docs/03_product/UIUX_테스트명세.md`의 `UXV-47`
4. `docs/테스트.md`의 `COURSE-10`, `COURSE-12`
5. `docs/work/integration-decision/two-stop-limited-assembly.md`의 2026-09-04 UX 결정
6. 이 파일의 `U-TWO-STOP-02` 완료 인계와 secondary eligibility gate 수락
7. 현재 코드 `ResultsScreen.tsx`, `CourseConfirmScreen.tsx`, `TwoStopSelectionPanel.tsx`, `twoStopSelectionModel.ts`, `v1Session.ts`

## 이전 방식 → 관찰 → 교체 방식

| 구분 | 내용 | 상태 |
| --- | --- | --- |
| 이전 방식 | one-stop 카드를 누르면 CourseConfirm을 열고, 상세의 `한 곳 더 고르기`로 Results에 돌아와 B를 고른다 | `U-TWO-STOP-02`에서 구현·자동 검증 완료, production UX로는 교체 예정 |
| 문제/관찰 | 장소 비교 중 화면을 왕복하고, 사용자가 선택한 장소와 새 후보가 한 화면에서 연결돼 보이지 않는다. 카드 tap이 선택인지 상세인지도 단계마다 달라진다 | 사용자 확인 완료 |
| 교체 방식 | Results 카드 tap에서 A를 선택하고 상단 sticky tray에 축약한다. 아래는 B 후보로 전환하고, 선택 후에만 하단 fixed CTA를 띄운다. CTA에서만 선택된 전체 코스의 CourseConfirm을 연다 | 이번 작업 |
| 교체 이유 | 선택 맥락을 계속 보존하고, 한 장소만 갈지 두 장소를 연결할지 같은 화면에서 판단하게 한다 | 확정 |

## 변경하지 않는 공개 계약

- A는 Results에 실제 표시된 exact one-stop **동일 snapshot**이어야 한다. 복제·stale·조건부·다른 session course를 pair 시작에 사용하지 않는다.
- pair engine entry, 양방향 검증, 엔진 결정 방문 순서, B 기본 목표 3·partial 0~2·누적 6을 바꾸지 않는다.
- 신규 provider attempt는 최초 one-stop 8 + pair 자동 16 + one-stop/pair 공유 확장 12 = session 최대 36이다. cache/session hit은 attempt가 아니다.
- A 선택 전 one-stop 더보기와 A 선택 후 pair 더보기는 동일 shared ledger를 쓴다. UI 변경으로 예산을 초기화·환불·중복 예약하지 않는다.
- B 선택과 CTA tap은 추천/transit route 호출 0이다. CourseConfirm의 endpoint walk connector 계약만 기존대로 유지한다.
- conditional 시장·거리, B12/route-only, 내부 diagnostics, CAPTCHA, 카카오맵·진행·geometry 계약을 바꾸지 않는다.
- 새 `.env` flag, DB 저장, AsyncStorage 장바구니, navigation callback/provider/Date/AbortSignal을 추가하지 않는다.

## 1. Results의 단일 선택 상태 모델

Results에 아래 세 시각 상태만 둔다. API와 화면 조건을 JSX에 중복해서 만들지 말고 작은 UI-owned model/coordinator로 분리한다.

1. `idle`: 선택 없음. 기존 대표·대안·one-stop 더보기·조건부 영역을 그대로 보인다. 하단 고정 CTA와 선택 tray는 없다.
2. `first_selected`: exact one-stop A가 선택됨. 선택 직전 Results snapshot을 보존하고 pair begin을 최대 1회 시작한다. 상단 tray에는 A만, 하단 CTA는 `이 장소로 코스 보기`다.
3. `pair_selected`: A와 exact pair course에서 파생한 B가 선택됨. tray에는 A와 B, 하단 CTA는 `선택한 2곳 코스 보기`다. 실제 방문 순서는 pair course snapshot 안의 engine order를 따르며 tray 행 순서로 단정하지 않는다.

`selectedPairCourse`는 이미 검증된 `VerifiedCourseV1` 객체 identity를 보존해야 한다. title/place ID만으로 새 course를 합성하지 않는다. B 후보가 추가로 도착해도 선택한 pair snapshot을 다른 객체로 교체하지 않는다.

## 2. initial 카드 tap을 A 선택으로 교체

- 대표·초기 대안·one-stop 더보기로 실제 append된 카드 전체 tap은 CourseConfirm으로 즉시 navigate하지 않고 해당 원본 one-stop을 A로 선택한다.
- tap 순간 현재 one-stop 목록 ID·순서, 대표, continuation/page/terminal, 이미 연 더보기, scroll offset과 focus ID를 기존 `TwoStopSelectionSnapshot`으로 보존한다.
- 같은 session에서 `canRecordTwoStopSelectionIntent()`가 true인 snapshot만 pair begin을 호출한다. 함수 이름은 과거 intent 용도라도 identity/operation gate로 재사용하거나 의미에 맞는 mutation-free 별칭으로 좁게 정리할 수 있다.
- pair port가 없는 route-only/B12 또는 pair를 시작할 수 없는 안전 상태에서도 A 선택과 one-stop CTA는 동작해야 한다. 이 경우 pair 후보를 조작 가능하게 보이지 않고 `이 장소는 한 곳 코스로 확인할 수 있어요` 수준의 중립 안내만 표시한다.
- one-stop 더보기 같은 provider-starting operation 중에는 카드 선택을 disabled/busy 처리하고 press 시점에 session operation을 다시 확인한다. 낡은 ledger로 pair를 시작하지 않는다.
- A 선택 순간 화면 전체를 비우거나 새 Results를 push하지 않는다. A tray와 CTA는 즉시 나타나고, 아래 영역만 `함께 갈 수 있는 장소 확인 중` 상태로 전환한 뒤 성공 B를 도착 순서대로 append한다.

## 3. 상단 sticky 선택 tray

- safe-area와 기존 Results 헤더 아래, 스크롤 목록 위에 둔다. 선택 중 스크롤해도 viewport에 남아야 한다. 화면 위에 겹쳐 카드 내용을 가리지 말고 레이아웃 공간을 차지한다.
- 최대 두 개의 compact row만 사용한다. 각 row는 필요 최소 정보인 작은 이미지/placeholder, 장소명, 활동 카테고리와 오른쪽 끝의 `×`를 가진다. 긴 장소명은 1줄 말줄임 처리하되 접근성 레이블에는 전체 이름을 제공한다.
- tray 명칭은 `선택한 장소`로 하고 장바구니·담기·1번/2번 방문 같은 용어를 쓰지 않는다. A와 B의 표시 순서는 사용자의 선택 관계일 뿐 실제 방문 순서를 뜻하지 않는다는 점을 화살표·번호로 암시하지 않는다.
- A `×`의 접근성 레이블은 `○○ 선택 취소`, B `×`는 `○○만 선택 취소`처럼 대상을 구분한다. 터치 영역은 최소 44×44다.
- A `×`: 진행 중 pair를 abort하고 B 선택까지 제거하며 선택 전 snapshot을 route/provider 호출 0으로 복원한다.
- B `×`: A, 현재 B 후보 목록·loading·reason·continuation·scroll을 유지하고 선택한 B만 제거해 `first_selected`로 돌아간다.

## 4. 아래 B 후보 목록과 선택 교체

- 선택 중에는 기존 대표/대안/one-stop 더보기/조건부 영역을 함께 보이지 않고 현재 A와 함께 가능한 B 영역만 보인다.
- 현재 `TwoStopSelectionPanel` 안의 `선택한 장소 코스 시작하기` inline 버튼은 제거한다. one-stop/pair 확인 행동은 화면 하단 fixed CTA 하나로만 제공해 중복 주요 행동을 만들지 않는다.
- B 카드를 누르면 상세로 이동하지 않고 그 exact pair course를 `selectedPairCourse`로 선택한다. 추가 추천/route 호출은 0이다.
- 선택한 B 카드는 목록에서 제거하거나 순서를 바꾸지 않는다. 기존 위치에서 선택 테두리·check와 `선택됨` 상태를 표시한다. 다른 B를 누르면 추가 호출 없이 기존 B를 교체한다.
- B가 선택된 뒤에도 이미 진행 중인 정상 pair 응답이나 명시적 `함께 갈 장소 더 보기`가 도착하면 기존 안정 순서 뒤에 append할 수 있다. 선택한 B snapshot과 CTA 대상은 사용자가 다시 고르기 전까지 바뀌지 않는다.
- 0개·partial·no-route·provider/store/limit에서도 A tray와 one-stop CTA는 유지한다. 내부 reason·attempt/provider명은 노출하지 않고 기존 안전 문구를 재사용한다.
- pair `더 보기`는 B 선택 여부와 무관하게 기존 continuation·공유 잔여 조건에서만 표시한다. 반복 tap·same-tick 중복 호출을 만들지 않는다.

## 5. 하단 fixed CTA와 CourseConfirm 진입

- `idle`에서는 CTA를 렌더하지 않는다.
- `first_selected`에서는 `이 장소로 코스 보기`, `pair_selected`에서는 `선택한 2곳 코스 보기`를 표시한다.
- CTA는 `ScrollView` 밖에서 화면 하단 safe-area 위에 고정한다. 목록의 마지막 카드/더보기가 버튼에 가리지 않도록 CTA 실제 높이 + safe-area + 여백만큼 scroll content bottom padding을 준다.
- 키보드가 없는 결과 화면에서 무의미한 화면 이동을 만들지 않고, 작은 기기·큰 글자에서도 문구가 잘리지 않아야 한다. CTA 터치 영역은 현행 주요 버튼 52px 이상이다.
- CTA tap만 CourseConfirm을 연다. A만 선택했으면 원본 exact one-stop snapshot, B도 선택했으면 선택한 exact 2곳 snapshot을 넘긴다. 두 경우 모두 CTA tap 자체 추천/transit route 호출은 0이다.
- CourseConfirm은 기존 상단 지도, engine order의 `출발 → 장소(들) → 도착/복귀`, 실제 이동 구간, `코스 시작하기`를 유지한다. tray에 A가 먼저 보였더라도 pair snapshot이 B→A이면 상세는 B→A로 표시한다.
- CourseConfirm 뒤로가기는 같은 Results 인스턴스의 같은 A/B 선택·후보·continuation·scroll로 돌아온다.
- 기존 CourseConfirm의 `한 곳 더 고르기` secondary는 production 화면에서 제거한다. 한 화면에 새 인라인 entry와 과거 secondary를 동시에 남기지 않는다. primary `코스 시작하기`와 지도/경로는 유지한다.

## 6. 뒤로가기·복원·비동기 경합

- Results에서 선택 중 헤더 뒤로가기, iOS swipe/back, Android hardware back에 remove 이벤트가 발생하면 화면을 바로 이탈하지 않고 우선 A 전체 취소와 snapshot 복원을 수행한다. 복원 후 다시 뒤로갈 때만 시간 설정 화면으로 이동한다.
- A 취소/unmount 뒤 late progress·success·error는 epoch가 달라 화면에 반영되지 않는다.
- CourseConfirm으로 forward navigation하는 정상 CTA는 선택 취소로 가로채지 않는다.
- 같은 A를 취소 후 다시 선택하면 기존 session branch reuse를 유지해 새 adapter 증가 0이어야 한다. 다른 A는 독립 branch이며 후보/선택 B가 섞이면 안 된다.
- selected B를 제거·교체하거나 CourseConfirm을 열고 돌아오는 동작은 ledger를 초기화하지 않는다.

## 7. 전환 느낌·접근성·구조

- 카드 tap 뒤 screen-level spinner나 흰 화면을 띄우지 않는다. tray와 fixed CTA는 즉시 나타내고 B 영역만 기존 250ms 이내의 가벼운 fade/layout 전환과 live status를 사용한다. 새 animation library는 추가하지 않는다.
- `reduce motion` 사용자는 의미 없는 이동 애니메이션 없이 즉시 상태가 바뀌어야 한다.
- A 선택 시 `○○ 선택됨. 함께 갈 장소를 확인합니다`, B 선택 시 `○○ 추가 선택됨`, 취소 시 복원된 섹션 제목을 접근성 live region/focus로 전달한다. 중복 announcement loop를 만들지 않는다.
- 색상만으로 B 선택을 표현하지 말고 check/텍스트와 `accessibilityState.selected`를 함께 쓴다.
- 화면 컨테이너는 session 연결·navigation만 담당하고, tray/고정 CTA/B 카드 표시와 순수 파생 모델을 컴포넌트로 분리한다. 다만 실제 두 곳 이상에서 재사용되지 않는 전역 디자인 시스템을 새로 만들지 않는다.

## 허용 수정 경계

- `src/ui/ResultsScreen.tsx`
- `src/ui/CourseConfirmScreen.tsx`
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`
- `src/ui/recommendation/twoStopSelectionModel.ts`
- `src/ui/recommendation/v1Session.ts`
- 필요하면 `src/ui/recommendation/` 아래 선택 tray/CTA 표시 전용 파일 최대 2개
- 관련 `test/ui/` 테스트와 이 문서의 완료 인계

수정 금지:

- `src/engine/`, `src/services/`, Supabase functions/migrations, DB, data/catalog, `.env*`
- `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`
- QA 소유 `test/qa-two-stop-integration.test.ts`
- 제품 기준 문서·작업조정 보드
- pair 후보 수·순서·시간·운영시간·호출 상한·connector 수 변경

navigation 타입 변경이 정말 필요하면 `RootStackParamList`를 직접 확장하기 전에 현재 `CourseConfirm`의 기존 `{course, session}` snapshot 전달로 해결할 수 없는 구체적 타입 차단점을 인계한다. 이번 결정상 새 params는 필요하지 않아야 한다.

## failure-first 필수 시나리오

구현 전에 가장 좁은 표시/model 테스트를 추가해 현재 상세 선진입 동작이 새 계약과 다름을 확인한다. 단순 파일 문자열 검사만으로 완료하지 않는다.

1. idle: 기존 대표·대안 표시, sticky tray 0, fixed CTA 0
2. 실제 표시 exact 카드 tap: CourseConfirm navigation 0, A 선택 1, pair begin 최대 1
3. 선택 직후: A tray와 one-stop CTA 즉시 표시, 아래 B loading 상태; 전체 화면 blank 0
4. A only CTA: 원본 one-stop identity로 CourseConfirm 1회, 추천/transit route 0
5. B progress 1→2→3: 기존 순서 append, selected B 없음, A tray 유지
6. B tap: navigation 0, exact pair identity 선택, CTA 문구 2곳으로 변경
7. pair CTA: 선택한 pair identity와 engine order로 CourseConfirm 1회, route 0
8. B→A engine order: tray가 순서를 단정하지 않고 CourseConfirm만 B→A 표시
9. 다른 B tap: 호출 0, 기존 B를 교체하며 목록 순서 유지
10. B `×`: 호출/abort 0, A·후보·continuation·loading/reason 유지, one-stop CTA 복귀
11. A `×`: pending abort, A/B 제거, 원래 대표·대안·더보기·page state·scroll/focus 복원, 호출 0
12. 선택 중 헤더/hardware/swipe back: 최초 back은 A 취소만 하고 화면 유지, 다음 back만 이전 화면 이동
13. CourseConfirm 뒤로가기: 같은 A/B, 후보·continuation·scroll 복원, pair begin 재호출 0
14. B 0/partial/no-route/provider/store/limit: A CTA와 취소 유지, 안전 reason 하나, 미검증 B 합성 0
15. pair port 없음/route-only/B12: A 선택·one-stop CTA 가능, pair 후보/더보기 비활성, 오류성 secondary 0
16. same-tick one-stop more와 A tap: 이중 provider 예약 0, operation 중 카드 disabled/recheck
17. A 취소 후 late event·다른 session event: 화면 반영 0; 같은 A 재선택 session reuse adapter 증가 0
18. fixed layout: 선택 전 CTA 미점유, 선택 후 safe-area 위 고정, scroll bottom padding으로 마지막 카드 접근 가능
19. accessibility: X 대상 레이블, B selected state, live status, 44px/52px 터치 영역을 표시 모델/컴포넌트 계약으로 확인
20. 회귀: one-stop 더보기, 조건부 영역 복원, CourseConfirm 지도·geometry, 코스 시작·카카오맵, shared 12/session 36 불변

## 실행 명령과 완료 기준

구현 전 failure-first 결과와 구현 후 결과를 모두 인계에 남긴다. 구현 후 다음을 실행한다.

```bash
npx tsx --test test/ui/two-stop-production-session.test.ts
npx tsx --test test/ui/two-stop-selection.test.ts
npx tsx --test test/ui/release-one-stop-more-results.test.ts
npx tsx --test test/ui/course-v1-card-detail.test.ts test/ui/course-v1-route-geometry.test.ts
npx tsx --test test/qa-two-stop-integration.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

완료 조건:

- 위 20개 시나리오가 행동/상태 fixture로 통과한다.
- initial 카드 tap과 B 카드 tap 모두 CourseConfirm을 즉시 열지 않는다.
- 선택 후에만 상단 sticky tray와 하단 fixed CTA가 나타난다.
- CTA가 고정돼도 마지막 B 카드·더보기·안내를 스크롤로 읽고 누를 수 있다.
- A/B 취소, 뒤로가기, CourseConfirm 왕복에서 snapshot identity·scroll·ledger가 보존된다.
- 기존 CourseConfirm secondary는 production에서 제거되고 primary/지도/순서는 유지된다.
- 엔진/API/DB/data/env/navigation 계약과 호출 상한 변경이 0이다.

Simulator·실기기·실제 API·원격 Edge·DB 호출은 하지 않는다. 자동 회귀가 모두 통과한 뒤 통합·결정 세션이 수락 여부를 판단하고, 다음 QA에는 고정 fixture와 출시 후보 실기기 왕복/별도 목적지 각 1건만 넘긴다.

## 완료 인수인계 형식

이 문서 아래에 다음 네 항목을 반드시 기록한다.

1. 변경 파일과 각 파일의 상태/표시 책임
2. 변경하지 않은 engine/API/DB/data/navigation/호출 예산 계약
3. failure-first 재현과 명령별 테스트 수·결과
4. 자동 검증으로 확인하지 못한 native sticky/fixed/back gesture 위험과 최소 실기기 확인 조건

commit·push는 사용자가 요청하기 전 금지한다.

## U-TWO-STOP-03 완료 인수인계 (2026-09-04, UIUX)

### 1. 변경 파일과 상태/표시 책임

- `src/ui/recommendation/twoStopSelectionModel.ts`: `idle → first_selected → pair_selected` 인라인 coordinator를 추가했다. A 선택은 동기적으로 먼저 반영하고 pair begin은 eligibility가 통과한 경우 최대 1회만 위임한다. B는 controller가 보유한 exact course 객체만 선택·교체하며, B 해제는 pair 상태를 보존하고 A 해제는 원본 `TwoStopSelectionSnapshot`을 반환하며 pending을 취소한다.
- `src/ui/ResultsScreen.tsx`: 실제 표시 one-stop 카드 tap을 상세 이동 대신 A 선택으로 교체했다. 선택 중에는 기존 one-stop/조건부 목록을 숨기고 safe area 아래 헤더와 tray, B 영역, ScrollView 밖 fixed CTA를 표시한다. CTA만 원본 one-stop 또는 선택한 pair identity로 `CourseConfirm`을 열고, `beforeRemove`는 forward CTA를 제외한 첫 back/remove에서 snapshot 복원만 수행한다. provider operation 중 카드는 busy/disabled 처리하고 press 시점도 재검사한다.
- `src/ui/recommendation/TwoStopSelectionTray.tsx`(신규): 최대 2개 compact row, 이미지/placeholder, 전체 이름 접근성 레이블을 가진 44×44 대상별 `×`, A/B live 안내와 safe-area fixed 52px CTA를 표시한다. tray 행은 번호·화살표·방문 순서를 표현하지 않는다.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`: 과거 A inline 시작/취소 영역을 제거하고 B loading·안전 사유·후보·더보기만 표시한다. 선택 B는 기존 위치와 exact identity를 유지하면서 테두리, check/`선택됨`, `accessibilityState.selected`를 함께 표시한다. pair 비활성 branch는 후보/더보기 대신 중립 one-stop 안내만 보인다.
- `src/ui/CourseConfirmScreen.tsx`: 과거 `한 곳 더 고르기` secondary와 intent 기록 연결만 제거했다. 지도·engine order 상세·도보 connector·카카오맵·`코스 시작하기` primary는 유지했다.
- `test/ui/two-stop-selection.test.ts`: 실패 우선 3건과 production 표시 계약을 추가/교체했다. A 즉시 선택/연타 begin 1회, exact B 선택·교체·해제 identity, pending abort/snapshot 복원, route-only one-stop 진입을 행동 상태로 검증하고 tray/CTA/접근성/과거 secondary 제거 연결도 확인한다.

### 2. 유지한 공개 계약

- `src/engine/`, API adapter/service, Supabase/DB, data/catalog, `.env*`, `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`, QA fixture와 작업조정 보드는 수정하지 않았다.
- A는 Results에 실제 표시된 동일 one-stop 객체, B와 CTA 대상은 controller가 반환한 동일 pair 객체다. B→A를 포함한 engine 방문 순서, 기본 B 3/partial/누적 6, exact 검증, endpoint connector 계약을 재계산하거나 합성하지 않는다.
- session ledger와 port를 그대로 재사용하므로 최초 8 + pair 자동 16 + 공유 확장 12 = 최대 36, one-stop/pair shared 12, cache/session hit 비과금, 동시 operation gate 계약은 바뀌지 않았다. B tap·B 해제·CTA tap 자체의 추천/transit route 호출은 추가하지 않았다.
- navigation param은 기존 `{ session, course }` 그대로 사용하며 callback/provider/AbortSignal 같은 비직렬화 값을 넣지 않았다. 저장·장바구니·자동 위치·새 animation 의존성도 추가하지 않았다.

### 3. failure-first와 자동 테스트 결과

- 구현 전 `npx tsx --test test/ui/two-stop-selection.test.ts`: 기존 20건 통과, 새 인라인 상태 3건은 `createInlineTwoStopSelectionController is not a function`으로 실패해 상세 선진입 구현과 새 계약 차이를 재현했다.
- 구현 후 필수 20개 시나리오는 인라인 coordinator 행동 fixture, 기존 pair progress/reason/reuse fixture, production 표시 계약을 함께 매핑해 통과했다. `npx tsx --test test/ui/two-stop-selection.test.ts` **23/23**, `test/ui/two-stop-production-session.test.ts` **6/6**, `release-one-stop-more-results.test.ts` **8/8**, `course-v1-card-detail.test.ts` + `course-v1-route-geometry.test.ts` **21/21**, QA 소유 파일을 수정하지 않고 `test/qa-two-stop-integration.test.ts` **17/17** 통과했다.
- `npm run test:typecheck` 통과, `npm run test:ui` **234 통과·기존 skip 1**, `npm test` **117/117**, `git diff --check` 통과했다.
- Simulator·실기기·실제 API·원격 Edge·DB 호출은 작업 지시대로 실행하지 않았다.

### 4. 다음 결정·위험과 최소 실기기 확인 조건

- 자동 테스트는 React Native 실제 viewport의 tray 높이, 큰 글자에서의 1줄 말줄임, 홈 인디케이터 위 CTA 간격, 긴 B 목록 마지막 카드/더보기의 터치 가능 여부를 픽셀 단위로 확인하지 못했다. 출시 후보 iPhone의 작은 화면과 큰 글자 1회씩 A/B 선택 후 최하단까지 스크롤해 겹침이 없는지 확인해야 한다.
- `beforeRemove` 계약은 production wiring과 상태 복원을 자동 검증했지만 iOS interactive swipe 취소 감각과 Android hardware back 이벤트는 네이티브에서 재현하지 않았다. 최소 실기기 조건은 왕복/별도 목적지 fixture 각 1건에서 `(A 선택 → swipe/back: 화면 유지·A 취소 → 두 번째 back: 이탈)`과 `(A/B 선택 → CTA → CourseConfirm → back: 같은 A/B·후보·scroll 유지)`를 확인하는 것이다.
- VoiceOver에서 A/B 대상별 `×` 레이블, A/B live announcement가 한 번만 읽히는지, B 카드의 check·선택됨 상태가 색상 없이 이해되는지도 위 두 시나리오에서 확인해야 한다. 확인 전에는 네이티브 상호작용까지 최종 수락된 것으로 해석하지 않는다.
- 이 세션은 커밋·push를 수행하지 않았다. 통합·결정 세션은 위 자동 결과와 최소 실기기 확인 결과를 근거로 최종 수락 여부를 판단한다.

## U-TWO-STOP-03 사용자 실사용 반환 (2026-09-04)

- **관찰:** A 카드 tap 뒤 실제 navigation 호출은 없었지만 `ResultsScreen`이 선택 전 ScrollView를 제거하고 선택 전용 전체 화면 트리를 새로 반환했다. 헤더 아래 본문·스크롤 맥락·카드 구성이 한 번에 바뀌어 사용자는 페이지 전환으로 인식했다.
- **자동 테스트 누락:** 기존 source/모델 테스트는 `navigation.navigate` 0과 tray/CTA 존재만 확인했고, 같은 React 화면 트리·같은 ScrollView identity·같은 scroll offset에서 부분 상태만 바뀌는지는 검증하지 않았다.
- **별도 관찰:** `선택한 장소와 함께 가능한 곳`의 첫 exact B까지 대기가 길다. 이는 UI spinner만의 문제가 아니며 현재 엔진이 후보별로 `O→A→B→D`와 `O→B→A→D`를 순차 검증하고 첫 성공 전 여러 directed receipt를 기다리는 구조와 연결된다.
- **판정:** 최종 수락 철회. 원격 Edge 배포와 출시 smoke로 넘어가지 않는다. UI는 동일 Results 트리 보존을 보완하고, 추천 엔진은 검증된 one-stop leg 재사용으로 첫 B까지의 실제 검증량을 줄이는 별도 작업을 수행해야 한다. 검증 전 B를 선택 가능하게 표시하거나 양방향 exact·운영시간·최소 체류·도착 여유를 완화하지 않는다.

## U-TWO-STOP-03 사용자 반환 보완 작업 명령 — 같은 카드 영역 교체

> 2026-09-04 통합 확인: 선행 `2-Z`가 수락됐다. `ReleaseTwoStopRuntimeInput.verifiedOneStopCourses`와 begin/continue seed signature가 공개됐으므로 화면 구조와 branch별 seed 동결·port 연결을 모두 수행할 수 있다.

### 담당·상태·의존성

- 담당: UIUX 세션
- 상태: 작업 가능
- 추천 엔진 `2-Z`와 병렬로 화면 구조·loading·복원 테스트를 먼저 구현할 수 있다.
- 최종 완료는 `2-Z`가 추가하는 `verifiedOneStopCourses` runtime 입력 계약을 현재 UI session/port에 연결하고 통합 회귀가 통과한 뒤에만 선언한다.
- 새 `U-TWO-STOP-03-R` ID를 만들지 않는다. 실사용에서 반환된 원래 작업의 누락 완료 기준으로 이 절을 이어 수행한다.

작업 시작 시 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`, 이 파일의 `U-TWO-STOP-03` 원 명령·완료 인계·사용자 반환과 이 보완 절만 읽는다. archive 전체와 unrelated UI 작업 파일을 읽지 않는다.

### 1. 목적과 확정된 사용자 행동

사용자가 선택한 방식은 다음과 같다.

```text
선택 전
  같은 Results 화면
  └─ 기존 대표·대안·더보기 one-stop 카드 영역

A 카드 tap
  같은 Results 화면 / 같은 헤더 / 같은 시간 요약 / 같은 ScrollView
  ├─ 상단 compact 선택 tray: A + ×
  ├─ 기존 one-stop 카드가 있던 바로 그 영역
  │   └─ B loading skeleton → exact B 후보 목록
  └─ 화면 하단 fixed CTA: 이 장소로 코스 보기

A × 또는 선택 중 첫 back
  같은 영역을 선택 전 one-stop 카드 목록과 scroll/focus로 복원
```

A를 선택한 뒤 기존 one-stop 카드들을 아래에 계속 남기는 안은 **철회**한다. 같은 카드가 A 변경 후보인지 B 추가 후보인지 혼동되기 때문이다. 새 화면으로 push하거나 선택 전 ScrollView를 없애는 방식도 철회한다. 바뀌는 것은 기존 카드 영역의 content mode와 선택 tray/CTA뿐이다.

### 2. 현재 원인과 확인 근거

확정된 UI 원인은 `ResultsScreen.tsx`가 `inlineState.mode !== 'idle'`일 때 선택 전 렌더와 별개의 최상위 return을 사용한다는 점이다. 이 분기에서 별도의 `ScrollView`와 본문을 새로 만들기 때문에 navigation 호출은 0이어도 사용자는 화면 전환으로 느끼고 scroll identity가 사라진다.

첫 B 지연은 UI 단독 원인이 아니다. 현재 pair 엔진이 후보별 두 방문 순서를 순차 exact 검증하는 비용이 포함된다. UI는 검증되지 않은 B를 먼저 보여 주거나 fake timer로 성공처럼 보이게 하지 않는다. `2-Z`는 이미 표시된 exact one-stop leg를 재사용해 첫 seeded B의 새 adapter call을 A↔B 두 개로 줄인다. UI의 책임은 A 선택을 즉시 반영하고, B 영역에 국소 skeleton을 보인 뒤 exact progress를 같은 자리에 점진 반영하는 것이다.

### 3. 화면 구조 구현 명령

#### 3.1 하나의 Results tree와 하나의 ScrollView

- `inlineState.mode`에 따른 **선택 전용 최상위 early return을 제거**한다.
- idle/first_selected/pair_selected 모두 동일한 화면 root, 동일한 header/time summary, 동일한 `ScrollView` 인스턴스와 ref를 사용한다.
- ScrollView를 상태별로 서로 다른 JSX 위치에 두거나 `key`를 바꿔 remount하지 않는다.
- header/time summary/budget 안내는 A 선택으로 다시 생성·깜빡임·위치 점프가 없어야 한다.
- 선택 tray가 생길 때 ScrollView 자체가 교체되지 않게 root 안에 안정된 tray slot을 둔다. idle에서는 접근성 tree와 시각 영역을 점유하지 않고, selected에서 safe-area 아래 sticky/고정 영역으로 나타낸다.
- CTA는 기존과 같이 ScrollView의 sibling으로 safe-area 위에 고정하되 selected일 때만 나타난다. content bottom padding은 CTA 높이와 safe-area를 반영해 마지막 B 카드·더보기·안내를 가리지 않는다.

#### 3.2 같은 결과 영역의 mode 교체

결과 카드 영역에 순수한 표시 mode를 둔다.

```ts
type ResultsCourseRegionMode = 'one_stop' | 'pair_loading' | 'pair_results' | 'pair_terminal';
```

필드 이름은 현재 UI 모델 규칙에 맞게 다듬을 수 있지만 의미는 하나여야 한다.

- `one_stop`: 기존 대표·대안·one-stop 더보기·조건부 영역의 현행 순서와 행동을 그대로 표시한다.
- A tap 직후 동기적으로 `pair_loading`: **기존 one-stop 카드 영역을 같은 자리에서** B skeleton 2~3개와 `함께 갈 장소를 확인하고 있어요` 상태로 바꾼다. 기존 one-stop 카드는 동시에 렌더하지 않는다.
- 첫 exact `candidate_verified`: 같은 region에서 skeleton을 제거하거나 남은 slot만 유지하고 검증 B 카드를 도착 순서대로 표시한다.
- `pair_results`: exact B만 선택 가능하다. 이미 표시된 B의 순서는 이후 progress/completed로 바꾸지 않는다.
- `pair_terminal`: B가 0개이거나 실패해도 A tray와 `이 장소로 코스 보기` CTA를 유지하고 safe reason 하나를 같은 영역에 표시한다.
- 조건부 시장·거리와 one-stop 더보기는 A 선택 중 보이지 않는다. A 취소 시 snapshot에서 그대로 복원한다.

loading skeleton은 카드와 비슷한 높이로 레이아웃 점프를 줄이되 장소명·이미지·가능 상태를 위조하지 않는다. skeleton은 press·accessibility button이 아니며 `함께 갈 장소 확인 중`이라는 하나의 live status만 제공한다. screen-level spinner, 흰 화면, 모달, 별도 route는 금지한다.

#### 3.3 선택·CTA·복원

- A card tap은 navigation 0이며, 현재 one-stop snapshot과 scroll/focus를 먼저 저장하고 A tray·A-only CTA·pair loading을 같은 commit에서 즉시 표시한다.
- pair begin promise가 완료될 때까지 CTA를 막지 않는다. 사용자는 B를 기다리지 않고 A만으로 코스 확인을 열 수 있다.
- B tap은 exact pair snapshot identity만 선택하고 navigation·route 0이다.
- CTA에서만 A one-stop 또는 선택 B pair의 기존 `{session, course}` snapshot으로 CourseConfirm을 연다.
- A `×`와 선택 중 첫 back은 pending을 abort/epoch invalidate하고 저장한 one-stop region·더보기/terminal 상태·scroll/focus를 복원한다. 두 번째 back만 이전 화면으로 나간다.
- CourseConfirm에서 돌아오면 같은 A/B·B 목록·continuation·scroll을 유지하며 pair begin을 다시 호출하지 않는다.
- A 취소 뒤 늦은 progress/completed, 다른 A requestId, 이전 session event는 반영하지 않는다.

### 4. `2-Z` verified one-stop seed 연결

현재 `RecommendationSessionRuntime.eligibleOneStopCourses`는 initial 대표·대안과 사용자가 one-stop `다른 장소 더 보기`로 실제 표시한 exact one-stop을 이미 보관한다. 새 카탈로그나 UI 계산을 만들지 않고 이 map을 사용한다.

1. pair branch가 A로 처음 시작하는 순간 `eligibleOneStopCourses`의 유효 one-stop 배열을 현재 표시 순서로 복사해 **그 A branch의 frozen runtime seed**로 저장한다.
2. `createTwoStopSelectionEnginePort`가 begin/continue 양쪽에 같은 배열을 `verifiedOneStopCourses`로 전달한다.
3. A branch 진행 중 one-stop 목록이 나중에 늘어나도 frozen seed를 바꾸거나 continuation signature를 무효화하지 않는다.
4. A를 취소하고 같은 A를 재선택해 cached branch를 재사용할 때도 최초 frozen seed를 사용한다. 새 adapter call은 0이어야 한다.
5. 아직 branch가 없는 다른 A를 선택하면 그 시점의 현재 표시 exact one-stop을 새로 동결한다.
6. seed/callback/provider/AbortSignal/course 본문을 navigation params·continuation JSON·DB·로그에 넣지 않는다.
7. `2-Z` export가 아직 작업 트리에 없으면 타입을 UI에서 복제하거나 `as any`로 우회하지 않는다. 화면 구조 테스트까지만 진행하고 final wiring은 export가 나타난 뒤 이어서 한 작업으로 완료한다.

### 5. 불변·수정 금지 경계

허용:

- `src/ui/ResultsScreen.tsx`
- `src/ui/recommendation/TwoStopSelectionTray.tsx`
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`
- `src/ui/recommendation/twoStopSelectionModel.ts`
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`
- `src/ui/recommendation/v1Session.ts`
- 관련 `test/ui/`와 이 문서의 완료 인계

금지:

- `src/engine/`와 엔진 테스트, `src/services/`, Edge, Supabase/DB/migration, data/catalog, `.env*`
- `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`
- 제품 기준 문서, `docs/테스트.md`, 작업조정 보드, QA 소유 테스트
- pair 후보 수·순서·공간 gate·운영시간·체류·양방향 exact·ledger 16/12/36 변경
- 검증 전 B 카드, A 선택 전 pair prefetch, 자동 pair 생성, 3곳, 자유 순서 편집
- 새 animation/state/network library

### 6. failure-first 필수 fixture

구현 전에 현재의 별도 selected tree가 아래 계약을 깨는 실패 fixture를 추가한다. source 문자열만 찾지 말고 가능한 부분은 controller/presentation model/public session port의 상태와 부수효과로 검증한다.

1. idle→A 선택에서 screen identity와 scroll identity는 같고 region mode만 `one_stop→pair_loading`
2. A 선택 전후 header·time summary·budget model identity/값 불변, 전체 화면 blank 상태 0
3. A 선택 후 기존 one-stop card ID는 selected region에 0개, B skeleton 2~3개는 disabled/non-button
4. A tap 동기 직후 tray와 A-only CTA가 있고 unresolved pair promise를 기다리지 않음
5. 첫 exact B progress가 같은 region의 skeleton을 B 카드로 교체하고 page completed 전 표시됨
6. progress 1→2→3에서 기존 B 순서·선택 pair identity 불변
7. B tap/교체/`×`는 navigation·route 0이고 CTA course만 exact pair/one-stop으로 전환
8. A `×`는 original one-stop IDs/order, 더보기 page/terminal, 조건부 영역, scroll/focus를 복원
9. 선택 중 첫 back은 A 취소·화면 유지, 두 번째 back만 이탈
10. CourseConfirm 왕복은 같은 Results instance의 A/B·B list·continuation·scroll을 보존하고 begin 재호출 0
11. pending abort 뒤 late event, 다른 A requestId, 다른 session event 반영 0
12. pair port 없음/route-only에서는 A-only CTA는 사용 가능하고 가짜 B/skeleton 무한 대기 0
13. B 0/partial/provider/store/limit에서 A CTA 유지와 안전 reason 하나, 미검증 B 0
14. one-stop more로 표시된 course까지 seed snapshot에 포함되고 current display order를 유지
15. 같은 A branch begin/continue/reuse에 같은 frozen seed identity/IDs를 전달하고 later one-stop append로 변하지 않음
16. 다른 A 최초 선택만 새 seed snapshot을 만들며 callback/provider/좌표가 직렬 state로 유출되지 않음
17. 선택 전 CTA 공간 미점유, 선택 후 fixed CTA가 마지막 B/더보기 접근을 가리지 않음
18. 접근성: A/B `×` 대상 레이블, B selected state, 단일 loading live status, reduce-motion에서 의미 없는 이동 0
19. 기존 one-stop 더보기·조건부 영역·CourseConfirm geometry/카카오맵/진행 flow 회귀 불변
20. initial 8 + automatic pair 16 + shared 12 = session 36과 operation serialization 불변

### 7. 검증 명령과 합격값

```bash
npx tsx --test test/ui/two-stop-selection.test.ts
npx tsx --test test/ui/two-stop-production-session.test.ts
npx tsx --test test/ui/release-one-stop-more-results.test.ts
npx tsx --test test/ui/course-v1-card-detail.test.ts test/ui/course-v1-route-geometry.test.ts
npx tsx --test test/qa-two-stop-integration.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

합격 기준:

- 위 20개 의미 시나리오가 행동/상태 fixture로 통과한다.
- selected 전용 최상위 return과 두 번째 ScrollView가 없어 동일 ref/identity가 유지된다.
- A 선택 직후 화면 전체 대기 없이 tray·A-only CTA·국소 skeleton이 보인다.
- 기존 one-stop 카드는 selected region에서 0개이고 exact B만 선택 가능하다.
- A 취소와 back/CourseConfirm 왕복에서 snapshot·scroll·ledger를 잃지 않는다.
- `2-Z` seed가 branch별로 동결되어 begin/continue/reuse에 전달되며 navigation/continuation/DB 직렬화는 0이다.
- 기존 skip 외 새 회귀 실패가 0이다.
- Simulator 자동 조작, 실기기, 실제 API/DB, 원격 Edge 배포는 이 UI 작업에서 0회다.

### 8. 완료 인수인계

이 절 아래에 다음 네 항목을 기록한다.

1. 변경 파일과 동일 Results tree·region mode·tray/CTA·seed port 책임
2. 변경하지 않은 engine/API/DB/data/navigation/호출 예산 계약
3. failure-first 결과, 명령별 테스트 수, 동일 scroll identity와 seed 동결 fixture 결과
4. 자동 검증으로 확인하지 못한 실제 iOS sticky/fixed/back gesture·체감 첫 B 지연과 최소 실기기 조건

위 기준 중 하나라도 미충족이면 완료로 쓰지 말고 정확한 fixture·차단 지점을 남긴다. commit·push는 사용자가 요청하기 전 금지한다.

#### 2026-09-04 U-TWO-STOP-03 사용자 반환 보완 완료 인계

##### 1. 변경 파일과 동일 Results tree·region·seed 책임

- `src/ui/ResultsScreen.tsx`: selected 전용 최상위 return과 두 번째 `scrollRef` ScrollView를 제거했다. 대표가 유효한 Results는 상태와 무관하게 고정된 header/time summary → 빈 공간을 차지하지 않는 tray slot → 동일 `ScrollView` → 빈 공간을 차지하지 않는 CTA slot 순서를 유지한다. ScrollView 내부의 기존 course region만 `one_stop` 또는 pair loading/results/terminal로 교체하며, 선택 중 one-stop 카드·더보기·조건부 영역을 함께 렌더하지 않는다. A 선택 직후 같은 commit에서 tray/A-only CTA를 열고 region 시작점으로 이동하되, 취소 복원에는 선택 직전 offset/focus snapshot을 사용한다.
- `src/ui/recommendation/twoStopSelectionModel.ts`: `ResultsCourseRegionMode`와 순수 `resultsCourseRegionMode()`를 추가했다. pair port 없음은 즉시 terminal, unresolved/후보 0 loading은 local loading, 첫 exact progress부터 results, 완료 0건은 terminal 하나로 파생한다. UI port의 begin/continue runtime request에는 엔진이 공개한 optional `verifiedOneStopCourses`만 전달할 수 있게 연결했다.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`: 별도 화면처럼 보이던 즉시 빈 B 영역 대신 카드 크기의 비활성·비버튼 skeleton 3개와 단일 live status를 같은 course region에 표시한다. 첫 exact B부터 skeleton을 교체하고, 0건 terminal에는 A CTA를 유지한 채 비밀 없는 안내 하나를 표시한다.
- `src/ui/recommendation/v1Session.ts`: `createFrozenTwoStopSeedPort()`를 production session port에 합성했다. A branch의 첫 begin 실행 시 `eligibleOneStopCourses` 현재 표시 순서를 새 배열로 복사·동결하고, 같은 배열 identity를 begin/continue/동일 A reuse에 전달한다. 이후 one-stop 표시 목록 증가가 기존 branch seed를 바꾸지 않으며 다른 A만 최초 진입 시 새 seed를 만든다.
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`: UI port request의 같은 frozen seed를 2-Z `beginReleaseTwoStopSelectionV1`과 `continueReleaseTwoStopSelectionV1` runtime 입력에 전달한다. continuation/reuse payload에는 seed를 복사하지 않는다.
- `test/ui/two-stop-selection.test.ts`, `test/ui/two-stop-production-session.test.ts`: 동일 ScrollView/안정 slot/region mode, 동기 A loading, exact B 진행, 2-Z endpoint seed 재사용, 표시 순서·배열 identity의 A branch별 동결과 later append 불변 fixture를 추가했다.

##### 2. 유지한 공개 계약·정책 경계

- 수락된 2-Z 엔진 export만 소비했고 `src/engine/`, 엔진 테스트, API/service, Supabase/DB/migration, data/catalog, `.env*`, `App.tsx`, navigation 파일, 제품 기준 문서, QA 테스트와 `docs/작업조정_보드.md`는 수정하지 않았다. 작업 트리에 먼저 존재하던 타 역할 변경도 되돌리지 않았다.
- A/B exact snapshot identity, 두 방문 순서 비교와 동률 A-first, B 목표 3/partial/누적 6, 공간·운영시간·체류·도착 여유, abort/stale/typed terminal을 바꾸지 않았다. skeleton은 장소명·이미지·가능 상태를 만들지 않으며 exact progress 전 선택 가능한 B는 0개다.
- initial 8 + automatic pair 16 + shared 12 = session 36, one-stop/pair 공유 ledger, 한 adapter call의 실제 attempt 계수와 operation 직렬화를 유지했다. frozen seed hit은 endpoint adapter/attempt/key를 추가하지 않고 새 A↔B 교차 구간만 기존 adapter를 거친다.
- seed/course/provider/callback/AbortSignal은 navigation params·continuation JSON·DB·로그에 넣지 않았다. CourseConfirm의 기존 `{session, course}`, 지도·geometry·카카오맵·진행 계약과 route-only A-only fallback도 그대로다.

##### 3. failure-first와 자동 검증 결과

- failure-first `test/ui/two-stop-selection.test.ts`: **24개 중 기존 23 통과·신규 1 실패**. 기존 selected early return 때문에 `scrollRef` ScrollView가 2개여서 동일 identity 기준을 깨는 것을 확인했다.
- failure-first `test/ui/two-stop-production-session.test.ts`: **7개 중 기존 6 통과·신규 1 실패**. branch frozen seed port가 없어 begin/continue/reuse 전달 계약이 성립하지 않음을 확인했다.
- 구현 후 `npx tsx --test test/ui/two-stop-selection.test.ts` **25/25**, `test/ui/two-stop-production-session.test.ts` **7/7**, `release-one-stop-more-results.test.ts` **8/8**, `course-v1-card-detail.test.ts` + `course-v1-route-geometry.test.ts` **21/21**, 수정하지 않은 `test/qa-two-stop-integration.test.ts` **17/17** 통과했다.
- seed 통합 fixture에서 표시 A+B endpoint 4구간 adapter 증가는 **0**, 새 교차 구간 adapter call은 **2**, 결과 exact pair는 1개였다. 같은 A의 begin/continue/reuse는 동일 frozen 배열 identity와 `[A,B,C]` 순서를 유지했고, later D append 뒤 다른 A branch만 `[A,B,C,D]` 새 배열을 받았다.
- `npm run test:typecheck` 통과, `npm run test:ui` **238개 중 237 통과·기존 skip 1·실패 0**, `npm test` **117/117**, `git diff --check` 통과했다. 고정 fixture만 사용했으며 Simulator·실기기·실제 API/DB·원격 Edge 호출은 0회다.

##### 4. 다음 결정·위험과 최소 실기기 조건

- 자동 source/model fixture는 React reconciliation상 안정된 tray/CTA slot 사이에 같은 ScrollView JSX/ref가 한 번만 존재함을 확인하지만, 실제 iOS에서 A tap 때 native scroll view가 remount되지 않는지와 region 시작점 이동이 페이지 전환처럼 느껴지지 않는지는 측정하지 못했다. 출시 후보 작은 iPhone에서 중간/마지막 one-stop 카드를 각각 탭해 header/time이 깜빡이지 않고 같은 자리에서 카드 영역만 skeleton으로 바뀌는지 확인해야 한다.
- 실제 cache/네트워크에서 첫 seeded B 체감 지연은 자동 fixture가 보장하지 않는다. 왕복과 별도 목적지 각 1건에서 표시 완료 B seed가 있는 A를 선택해 skeleton → 첫 exact B가 page completed 전 나타나는지, 검증 전 가짜 B가 없는지, seed가 무효/없는 입력은 안전 terminal 또는 기존 fallback으로 끝나는지 관찰한다.
- 같은 두 시나리오에서 A `×` 및 첫 swipe/hardware back의 원래 목록·더보기·scroll/focus 복원, 두 번째 back 이탈, A/B → CTA → CourseConfirm → back의 같은 B list/selection/scroll과 begin 재호출 0을 확인한다. VoiceOver 단일 loading announcement, B selected, A/B 대상별 `×`, 홈 인디케이터 위 fixed CTA와 마지막 카드 접근도 함께 확인한다.
- 이 자동 결과만으로 원격 활성화나 실기기 UX를 최종 수락하지 않는다. 커밋·push는 수행하지 않았다.

## U-TWO-STOP-04 — 동일 세션 exact pair 역선택 연결

### 목적과 선행 조건

`2-AA`가 exact pair runtime seed 타입·검증 entry를 export한 뒤 시작한다. 같은 recommendation session에서 A 선택으로 exact 확인한 `{A,B}`를 A 취소 후 B 선택에서도 신규 route 없이 A 후보로 되돌려, 기준 장소 선택 방향 때문에 이미 확인한 조합이 사라지는 현상을 제거한다.

### 구현 명령

1. `RecommendationSessionRuntime`에 같은 input 수명에 한정된 순서 없는 exact pair store를 둔다. key는 정렬된 두 place ID와 현재 runtime 자체의 input/provider 경계이며 전역·AsyncStorage·DB에 저장하지 않는다.
2. 현재 requestId/firstPlaceId와 일치하고 abort되지 않은 engine의 최종 exact course만 store에 commit한다. progress만 받고 취소됐거나 terminal인 결과는 저장하지 않는다.
3. 새 A branch begin 시 store에서 A를 포함한 pair를 기존 검증 완료 순서로 복사·동결해 `2-AA` runtime seed로 전달한다. begin/continue/동일 A reuse는 같은 frozen 배열 identity를 사용한다.
4. 이미 `{A,B}`를 검증한 뒤 B를 A로 선택하면 A가 첫 exact 후보로 즉시 나타나며 adapter/provider 증가가 0이어야 한다. 실제 course `placeIds`·legs는 바꾸지 않는다.
5. seeded 후보는 engine 결과와 동일한 progress/result 경계를 통해 UI에 들어오게 한다. 화면에서 임의 카드를 합성하거나 검증 전 상태를 exact로 표시하지 않는다.
6. same-A 기존 `reuseByFirstPlace`, verified one-stop seed, session operation 직렬화, abort epoch와 중복되지 않게 한다. seed와 엔진 신규 결과가 같은 pair이면 카드 1개만 남긴다.
7. A 취소는 pair store와 소비한 ledger를 지우거나 환불하지 않는다. 새 `runRecommendationSession`은 새 runtime이므로 이전 store를 재사용하지 않는다.

### 경계

허용: `src/ui/recommendation/v1Session.ts`, `twoStopSelectionEnginePort.ts`, 필요한 UI recommendation 타입/테스트, 이 문서. `ResultsScreen` 시각 구조와 카드 문구는 변경하지 않는다.

금지: `src/engine/`, API/Edge/DB/data/env/navigation, 호출 상한 변경, 전역 pair cache, 미검증 pair 선노출, 실제 API/Simulator/원격 배포.

### failure-first와 합격값

- production session port에서 `A 선택 성공(B 포함) → 취소 → B 선택`을 실행해 현재 A 미노출 또는 추가 호출을 먼저 실패로 고정한다.
- 수정 후 reverse 후보 A가 첫 progress/result에 있고 adapter/provider delta 0, 실제 방문 순서 불변이어야 한다.
- 자동 budget 16 소진, initial 3 경계, 새 session, 입력 변경, stale/abort, same-A reuse, one-stop seed 동시 사용을 포함한다.

```bash
npx tsx --test test/ui/two-stop-production-session.test.ts
npx tsx --test test/ui/two-stop-selection.test.ts
npx tsx --test test/ui/release-one-stop-more-results.test.ts
npm run test:typecheck
npm run test:ui
git diff --check
```

완료 인계에는 변경 파일, store commit/동결 시점, failure-first, 역선택 0-call 계수, 보존 계약, QA-TWO-STOP-02 입력을 남긴다. commit·push는 사용자 요청 전 금지한다.

## U-TWO-STOP-04 완료 인수인계 (2026-09-04, UIUX)

### 1. 변경 파일과 변경 목적

- `src/ui/recommendation/twoStopSelectionModel.ts`: UI pair port의 runtime-only 입력에 2-AA가 공개한 `ReleaseTwoStopSessionToken`과 `ReleaseTwoStopVerifiedPairSeed`를 연결했다. navigation·continuation·표시 model에는 저장하지 않는다.
- `src/ui/recommendation/twoStopSelectionEnginePort.ts`: begin/continue에 같은 token·frozen pair seed를 전달하고, abort되지 않았으며 현재 requestId/firstPlaceId와 일치하는 최종 exact 결과만 session callback에 넘긴다. progress·stale·abort·빈 terminal은 commit하지 않는다.
- `src/ui/recommendation/v1Session.ts`: recommendation runtime마다 opaque token과 순서 없는 pair store를 한 번 생성했다. 완료 결과의 두 place ID를 정렬한 key로 최초 exact course와 현재 input/provider signature를 보존한다. 새 A branch의 첫 begin에서 A를 포함하는 seed를 검증 완료 순서로 복사·동결하며 begin/continue/같은 A reuse에 동일 배열 identity를 전달한다. A 취소는 store·ledger를 지우지 않고 새 `runRecommendationSession`은 새 runtime/store를 만든다.
- `test/ui/two-stop-production-session.test.ts`: token·pair seed의 branch별 동결 및 실제 production session의 `A 선택 성공 → B 역선택` 첫 후보 재사용 fixture를 추가했다.
- 이 문서: 구현 결과와 QA-TWO-STOP-02 인계를 기록했다. `ResultsScreen`·표시 컴포넌트·화면 문구와 디자인은 U-TWO-STOP-04에서 수정하지 않았다.

### 2. 유지한 공개 계약·정책 경계

- 수락된 2-AA export만 소비했고 `src/engine/`, 엔진 테스트, API/Edge/service, Supabase/DB/migration, data/catalog, `.env*`, navigation, 작업조정 보드는 수정하지 않았다. 작업 트리에 먼저 있던 타 역할 변경도 되돌리지 않았다.
- exact course 객체 identity, engine 결정 방문 순서·legs·stop 시각, B 목표 initial 3/누적 6, one-stop seed와 same-A reuse, session operation 직렬화 및 abort epoch를 유지했다. unordered key는 AB/BA만 중복 제거하고 저장된 course 자체를 역순으로 합성하지 않는다.
- initial 8 + automatic pair 16 + shared 12 = session 최대 36 및 실제 provider attempt 계수는 그대로다. pair seed는 새 adapter 호출 없이 기존 progress/result 경계로만 나오며, 남은 예산이 있으면 engine이 initial 3을 채우기 위한 신규 후보 검증을 이어갈 수 있다.
- store/token/course/callback은 session 메모리 밖, JSON continuation, navigation params, DB, 로그로 유출하지 않았다. 화면 디자인·카드 순서 표현·안전 문구는 변경하지 않았다.

### 3. failure-first와 테스트 결과

- failure-first로 production-session 테스트 파일에 frozen pair seed 전달 계약을 먼저 추가했고, 구현 전 reverse B branch에서 `recommendationSessionToken`이 `undefined`라 신규 1건이 실패하는 것을 확인했다. 구현 뒤 같은 branch의 begin/continue가 동일 token과 동일 frozen 배열을 받았다.
- 실제 production session fixture에서 A branch가 완료한 exact `{A,B}`를 B branch가 첫 `candidate_verified` 및 결과 첫 항목으로 같은 course identity 그대로 반환했다. seed progress 시점의 receipt adapter 증가값은 **0**이며 `placeIds` 순서도 원 snapshot과 동일했다. 전체 B begin은 남은 자동 예산으로 initial 3을 채울 수 있으므로, 0-call 합격값은 seed가 첫 후보로 방출되는 시점의 delta로 측정했다.
- `npx tsx --test test/ui/two-stop-production-session.test.ts` **9/9**, `test/ui/two-stop-selection.test.ts` **25/25**, `test/ui/release-one-stop-more-results.test.ts` **8/8** 통과했다. 추가로 수정하지 않은 2-AA 계약 `test/release-two-stop-selection.test.ts` **35/35**에서 automatic 16 소진, initial 3/continue, 새 session, input/provider 변경, abort, same-A·one-stop seed 공존 및 unordered dedupe를 확인했다.
- `npm run test:typecheck` 통과, `npm run test:ui` **240개 중 239 통과·기존 skip 1·실패 0**, `npm test` **117/117**, `git diff --check` 통과했다. UI 재확인 1회는 sandbox의 `tsx` IPC socket `EPERM`으로 실행 전 중단됐고 동일 명령을 허용 환경에서 재실행해 위 합격값을 확인했다. 실제 API·Simulator·DB·원격 배포는 실행하지 않았다.

### 4. 다음 결정·위험·QA-TWO-STOP-02 입력

- QA-TWO-STOP-02는 같은 recommendation session의 실제 표시 one-stop A/B fixture를 사용한다. `A 선택 → exact pair {A,B} 완료 → A 취소 → B 선택` 순서로 실행하고, B branch의 첫 exact progress/result가 저장된 동일 course identity인지, 그 seed 방출까지 receipt/provider 증가가 0인지, 원 `placeIds`·legs·stop 시각이 유지되는지 확인한다.
- 같은 QA에서 automatic pair 16 소진 상태와 잔여 예산 상태를 분리한다. 소진 상태는 seed 1개만 0-call로 나오고, 잔여 상태는 seed 뒤 신규 검증으로 initial 3을 채울 수 있으므로 전체 begin 호출 수를 0으로 오판하지 않는다. A 취소가 ledger/store를 환불·삭제하지 않는지도 함께 본다.
- 별도 `runRecommendationSession`, 시각·남은 시간·출발/도착·도착 여유 변경, provider signature 변경, stale requestId, abort fixture에서는 이전 pair를 선노출하지 않아야 한다. 같은 A 재선택과 one-stop frozen seed가 동시에 있어도 카드 중복과 추가 seed 호출이 없어야 한다.
- 자동 fixture는 session 메모리 계약을 검증했지만 실제 네트워크/cache 조합은 실행하지 않았다. 출시 후보 실기기 확인이 필요하면 운영 호출량을 기록한 왕복·별도 목적지 각 1건으로 제한한다. 커밋·push는 수행하지 않았다.

## U-TWO-STOP-04 수락 전 보완 — terminal partial commit 차단

### 통합 검토에서 확인한 문제

정상 완료 경로의 동일 session 역선택은 구현됐고 독립 실행한 관련 테스트 77개도 통과했다. 그러나 `src/ui/recommendation/twoStopSelectionEnginePort.ts`의 begin/continue는 현재 `!signal.aborted + requestId/firstPlaceId 일치 + courses.length > 0`만으로 `onCompletedExact`를 호출한다. 반면 같은 파일의 `storeReusableResult()`는 `unavailable`·`continuation_unavailable` 상태와 `provider_unavailable`·`store_unavailable`·`continuation_unavailable` reason을 거절한다.

따라서 한 branch가 exact pair 한 개를 얻은 뒤 다음 후보에서 provider/store terminal로 종료하면 same-A reuse에는 저장되지 않지만 `onCompletedExact → commitVerifiedPairResult` 경로에는 들어갈 수 있다. 이는 작업 명령의 `provider/store/continuation terminal 결과는 pair seed로 승격하지 않는다`와 충돌한다. 일반 성공 테스트가 통과한 사실로 이 경계를 덮지 않는다.

### 수정 명령

1. 구현 전에 `test/ui/two-stop-production-session.test.ts` 또는 UI port 전용 테스트에 아래 failure-first를 추가한다.
   - 후보 `{A,B,C}`에서 `{A,B}` exact를 먼저 반환하고 다음 후보 검증 중 provider terminal이 발생한다.
   - engine result에 exact course가 일부 들어 있어도 `onCompletedExact` callback 호출은 0이어야 한다.
   - A 취소 후 B branch를 열 때 `{A,B}`가 unordered pair seed로 선노출되지 않아야 한다.
   - 같은 구조의 `store_unavailable`도 callback/store 0을 확인한다.
2. `twoStopSelectionEnginePort.ts`에 완료 결과 저장 자격을 판정하는 순수 predicate 하나를 만든다. begin·continue의 `onCompletedExact` 호출과 `storeReusableResult()`가 이 predicate를 공통 사용해 서로 다른 결과를 저장하지 않게 한다.
3. predicate는 다음을 모두 요구한다.
   - signal이 abort되지 않았고 requestId·firstPlaceId·continuation.firstPlaceId가 현재 요청과 일치한다.
   - exact course가 1개 이상 있다.
   - state가 `unavailable` 또는 `continuation_unavailable`이 아니다.
   - reasons에 `provider_unavailable`, `store_unavailable`, `continuation_unavailable`이 없다.
4. `attempt_limit_reached`만으로 끝난 `partial/exhausted` 결과의 이미 exact 검증된 course는 버리지 않는다. 호출 예산 소진은 provider/store 실패가 아니므로 기존 same-A reuse와 pair 재사용 자격을 유지한다.
5. callback을 받은 `v1Session.ts`의 unordered store 로직, session token, frozen 배열, 최초 exact identity, A 취소 비환불, 새 session 비재사용은 변경하지 않는다.
6. 사용자가 발견한 B 카드 시간 의미 오류도 같은 보완에서 수정한다.
   - 현재 `buildTwoStopCandidateCard()`는 `course.travelMin + course.stayMin`인 **A+B pair 전체 합계**를 B 카드의 `약 N분 코스`로 표시한다. A one-stop이 51분이고 pair가 88분이면 B 장소가 88분 걸리는 것처럼 읽히므로 잘못된 표현이다.
   - builder가 `firstPlaceId`만 받지 말고 선택한 exact `firstCourse` snapshot을 받아, `pairDisplayMin = pair.travelMin + pair.stayMin`, `firstDisplayMin = firstCourse.travelMin + firstCourse.stayMin`, `additionalMin = pairDisplayMin - firstDisplayMin`을 순수 계산한다. 두 값 모두 도착 여유·남는 시간은 제외한다.
   - `additionalMin > 0`이면 카드와 접근성 문구를 `함께 가면 약 N분 추가`로 표시한다. 실제 pair가 B→A 순서여도 snapshot의 전체 차이를 그대로 사용하며 장소 순서를 다시 계산하지 않는다.
   - `additionalMin <= 0`, firstCourse가 정확한 one-stop이 아님, pair에 first place가 정확히 한 번 포함되지 않음 등 snapshot 계약이 맞지 않으면 임의로 1분 이상으로 보정하거나 B 단독 시간으로 가장하지 않는다. 유효 pair 전체의 이동+체류 값으로 `선택 시 전체 약 N분`을 표시하는 명시 fallback을 사용한다.
   - B 단독 `origin→B→destination` 시간을 만들기 위한 adapter/provider 호출, one-stop 재검증, 엔진 계산은 0회다. 선택 후 CourseConfirm의 전체 2곳 시간·경로는 기존 exact snapshot 그대로 유지한다.
   - `TwoStopCandidateCard.courseMin`처럼 전체/추가 의미가 불명확한 필드는 `durationKind: 'additional' | 'total'`과 `durationMin` 또는 동등하게 타입으로 구분해 panel이 다시 전체 합계를 추가시간처럼 렌더하지 못하게 한다.
7. B 카드 시간 변경에 필요한 `twoStopSelectionModel.ts`, `TwoStopSelectionPanel.tsx`, `ResultsScreen.tsx`의 builder 인자와 관련 UI 테스트만 추가로 허용한다. 화면 구조·tray·CTA·카드 선택 동작은 바꾸지 않는다. `src/engine/`, API/Edge/DB/data/env/navigation, 3/6·16/12/36 상한은 수정하지 않는다.

### 필수 회귀

- 정상 exact 완료는 기존처럼 pair store에 1회만 commit되고 역선택 첫 seed까지 adapter/provider delta 0이다.
- exact 일부 뒤 provider/store terminal은 pair store 0이며 반대 branch에서 false verified 0이다.
- abort·stale·빈 결과·continuation invalid도 commit 0이다.
- attempt limit 뒤 이미 확정된 exact pair는 계속 재사용 가능하다.
- begin과 continue가 같은 저장 predicate를 사용한다.
- A one-stop 이동+체류 51분, pair 이동+체류 88분 fixture에서 B 카드 시각·접근성 문구가 `함께 가면 약 37분 추가`이고 `약 88분 코스`가 아니다.
- pair 방문 순서가 B→A여도 같은 snapshot 차이를 표시하며, 계산 때문에 route/adapter가 호출되지 않는다.
- 비양수 차이·잘못된 first snapshot은 숫자를 임의 보정하지 않고 `선택 시 전체 약 N분` fallback을 사용한다.
- CTA로 연 CourseConfirm은 기존 pair 전체 시간·방문 순서·legs를 그대로 사용한다.

```bash
node --import tsx --test test/ui/two-stop-production-session.test.ts test/ui/two-stop-selection.test.ts
node --import tsx --test test/release-two-stop-selection.test.ts test/ui/release-one-stop-more-results.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

완료 인계에는 failure-first 실패값, 공통 predicate 위치, provider/store terminal 각각의 callback/store 0, 정상 역선택 0-call, 전체 테스트 수를 기록한다. 이 보완을 통과한 뒤에만 `QA-TWO-STOP-02`를 시작한다. 사용자 요청 전 commit·push는 하지 않는다.

## U-TWO-STOP-04 수락 전 보완 완료 인수인계 (2026-09-04, UIUX)

### 1. 변경 파일과 변경 목적

- `src/ui/recommendation/twoStopSelectionEnginePort.ts`: `canStoreCompletedExactResult()` 순수 predicate를 추가하고 begin·continue의 `onCompletedExact`와 기존 same-A `storeReusableResult()`가 모두 이를 사용하게 했다. 현재 request/first/continuation identity, abort, exact 1개 이상, state와 terminal reason을 한 경계에서 판정한다.
- `src/ui/recommendation/twoStopSelectionModel.ts`: B 카드가 선택 A의 exact one-stop snapshot을 받아 pair 이동+체류에서 A 이동+체류를 뺀 추가시간을 계산하도록 교체했다. `courseMin`을 의미가 분리된 `durationKind: 'additional' | 'total'`과 `durationMin`으로 바꾸고 표시·접근성 공용 label 함수를 추가했다. 수정 금지된 기존 QA의 ID-only 호출은 추가시간으로 승격하지 않고 pair 전체시간 fallback만 반환한다.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`: B 카드 시간 한 줄을 공용 label 함수로 표시해 `함께 가면 약 N분 추가` 또는 `선택 시 전체 약 N분`만 렌더한다. 카드 구조·이미지·선택 상태·행동은 변경하지 않았다.
- `src/ui/ResultsScreen.tsx`: 기존 동일 Results/ScrollView에서 builder에 place ID 대신 현재 선택된 exact `firstCourse` identity를 전달한다. tray·CTA·navigation·selection state 구조는 바꾸지 않았다.
- `test/ui/two-stop-selection.test.ts`: provider/store terminal partial, begin/continue 공통 predicate, attempt-limit partial 유지, 역선택 seed 0, 51→88분 추가시간, B→A, 비양수·잘못된 first snapshot fallback과 panel 연결 회귀를 추가했다.

### 2. 유지한 공개 계약·정책 경계

- `src/engine/`, 엔진 테스트, API/Edge/service, Supabase/DB/migration, data/catalog, `.env*`, navigation, QA 파일과 `docs/작업조정_보드.md`는 수정하지 않았다. 작업 트리에 먼저 존재하던 타 역할 변경도 되돌리지 않았다.
- provider/store/continuation terminal만 저장에서 제외했다. `attempt_limit_reached` partial/exhausted에 이미 exact 검증된 course가 있으면 same-A reuse와 unordered pair store 자격을 유지한다. 정상 exact의 session token·frozen 배열·최초 identity·A 취소 비환불·새 session 비재사용도 그대로다.
- initial 3/누적 6, automatic 16/shared 12/session 36, adapter/provider attempt 계수와 operation 직렬화를 바꾸지 않았다. B 추가시간은 이미 받은 두 exact snapshot의 이동+체류 차이만 계산하며 route/adapter/provider·one-stop 재검증 호출은 0이다.
- B→A snapshot을 A→B로 뒤집지 않고 CourseConfirm에는 기존 pair 전체 시간·방문 순서·legs를 그대로 전달한다. 변경된 문구는 B 카드 시간 의미 한 줄뿐이며 화면 구조·tray·CTA·선택/취소 행동은 유지했다.

### 3. failure-first와 자동 검증 결과

- failure-first 집중 실행은 신규 2건 모두 실패했다. terminal fixture는 `{A,B}` exact 뒤 C에서 provider terminal이 발생했는데도 callback/store가 **1회**였고, 시간 fixture는 builder가 first ID만 받아 51→88분의 37분 추가 의미를 만들지 못해 card assertion이 실패했다.
- 보완 후 provider terminal과 store terminal 각각 begin result에 exact 1개가 있어도 callback **0**, unordered store **0**, B 역선택 frozen seed **0**이다. continue에서도 첫 정상 page 이후 exact 1개+terminal page가 와도 callback 수가 기존 **1→1**로 유지됐다. 반대로 automatic ledger 14→16의 attempt-limit partial은 exact 1개와 callback/store **1**을 유지했다.
- 정상 production `A → B 역선택`은 기존 exact course가 첫 progress/result에 같은 identity로 나오며 seed 방출까지 receipt/provider delta **0**이다. A 51분·pair 88분 fixture의 시각·접근성 label은 `함께 가면 약 37분 추가`이고 `약 88분 코스`는 남지 않았다. B→A도 같은 차이를 쓰며 비양수는 `선택 시 전체 약 50분`, 잘못된 first snapshot은 `선택 시 전체 약 88분`이다.
- 지정 명령 결과: production+selection **37/37**, 2-AA engine+one-stop more **43/43**, `npm run test:typecheck` 통과, `npm run test:ui` **243개 중 242 통과·기존 skip 1·실패 0**, `npm test` **117/117** 통과했다. 실제 API·Simulator·DB·원격 배포는 실행하지 않았다.

### 4. 다음 결정·위험·QA-TWO-STOP-02 입력

- QA-TWO-STOP-02에는 정상 완료 역선택 0-call과 함께 `{A,B,C}`에서 B exact 후 C provider/store terminal인 두 fixture를 전달한다. 두 terminal은 UI에 이미 도착한 partial 카드를 현재 branch에서 보여 줄 수는 있지만 same-A cache/unordered pair seed로 승격하지 않으며, 취소 후 B branch 첫 후보로 false verified 선노출되지 않아야 한다.
- attempt-limit fixture는 automatic 14에서 exact 교차 leg 두 번으로 16에 도달시켜, 확정 pair가 저장·역선택 재사용되는 반례를 함께 검증한다. abort·stale·빈 결과·continuation invalid도 callback/store 0을 유지한다.
- 카드 fixture는 A 이동+체류 51분, pair 이동+체류 88분과 B→A 순서를 사용한다. 카드·VoiceOver에는 37분 추가, CTA 뒤 CourseConfirm에는 원 pair 전체 88분과 원 legs/order가 보여야 하며 이 전환의 route 호출은 0이어야 한다.
- 자동 모델/source 회귀는 문구와 계산 경계를 확인했지만 실제 큰 글자·VoiceOver 줄바꿈은 확인하지 않았다. 출시 후보 실기기 smoke에서 B 카드의 추가시간 한 줄과 전체 CourseConfirm 시간의 의미가 구분되는지만 확인한다. 커밋·push는 수행하지 않았다.
