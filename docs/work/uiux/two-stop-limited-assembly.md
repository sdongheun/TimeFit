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
