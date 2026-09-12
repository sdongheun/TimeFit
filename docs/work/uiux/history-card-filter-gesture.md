# U-HISTORY-POLISH-02 — 기록 카드·전체 삭제 위치·필터·드래그 보완

2026-09-08 사용자 요구. UIUX 실행 가능. 기존 U-HISTORY-SWIPE-01 자동 통과는 실기기 드래그 수락을 뜻하지 않는다.

## 근거·이력

- 기존 하단 구분선만 있는 행 → 사용자가 조작 가능한 기록으로 인식하기 어려움 → 둥근 테두리 카드와 둥근 삭제 버튼 → 상단 통계 박스와 시각 통일 → 구현 전.
- 하단 전체 삭제 → 접근이 어려움 → 기록 섹션 제목 오른쪽 전체 삭제 → 대상과 행동을 같은 위치에 제공 → 구현 전.
- 전체 기록 나열 → 카테고리별 조회 필요 → 목록 필터 추가 → 관심 활동 탐색 → 구현 전.
- HistorySwipeRow는 move마다 setOffset으로 React 렌더하고 release에서 offset=null로 끝 위치를 즉시 적용한다. grant 기준은 실제 표시 위치가 아니라 open boolean의 0/-64다. 이것은 확인된 코드 구조다. 사용자의 끊김과 정확히 같은 원인인지는 재현 전 단정하지 않는다. 과거 시트 문제와 증상이 비슷하다고 동일 원인으로 확정하지 않는다.

## 읽기·소유 경계

AGENTS.md, docs/README.md, UIUX 공통 규칙 UX-COLOR-01, 본 문서 및 nearby-handoff-and-history-polish.md의 B 완료 인수인계를 읽는다. AccountRecordsPanel.tsx, HistorySwipeRow.tsx, OwnedDeletionPanel.tsx, ActivityStatistics.tsx와 관련 테스트를 확인한다. 필요하면 nearby-simple-directions.md에 연결된 기존 시트 gesture 수정의 실제 코드/검증만 참고한다.

src/ui/관련 테스트/본 문서만 수정. DB·추천·학습·원본 데이터·주변 시트 코드는 변경하지 않는다. 동일 UIUX 세션이 한 작성자로 진행한다.

## 1. 기록 카드와 삭제 영역

- 각 완료 기록 행에 borderWidth1·기존 C.line·패널 배경·내부 padding·행 간격을 적용한다. 모서리는 현재 상단 ActivityStatistics의 카드와 같은 **14pt**를 사용한다. 삭제 버튼도 같은 radius로 맞추고 부모 clipping 때문에 끝 모서리가 사각형으로 보이지 않게 한다. 열린 카드와 삭제 버튼 사이에도 구분 가능한 여백을 둔다. 노출 폭은 버튼 폭+여백을 포함해 gesture 계산과 일치시킨다.
- 방향은 기존대로 **왼쪽으로 밀어 오른쪽 휴지통 노출**, 오른쪽 이동은 닫기다. 요청 첫 문장의 ‘오른쪽으로 넘김’을 양방향 삭제 도입으로 해석하지 않는다. full swipe 즉시 삭제0, 휴지통→기존 확인→서비스 유지.
- 테두리만으로 스와이프가 알려진다고 완료 처리하지 않는다. 제목 아래 `왼쪽으로 밀어 삭제`를 작고 읽을 수 있게 한 번만 제공한다(행마다 반복하지 않음). VoiceOver 삭제 행동은 유지한다. 새 버튼 햅틱/장식 아이콘은 추가하지 않는다.

## 2. 전체 삭제 위치

- `내 계정의 방문 기록`과 `전체 삭제`를 같은 헤더 행의 양 끝(space-between)에 둔다. 기존 위 여백24pt 유지, 제목은 flex/minWidth0, 오른쪽 행동은 충분한 터치 영역과 고정된 가독성을 확보한다. 큰 글자에서 겹치면 제목 줄바꿈을 허용한다.
- OwnedDeletionPanel의 기존 전체 삭제 controller/confirm을 헤더로 노출한다. 삭제 실행을 새로 복제하지 않으며 하단 중복 버튼만 제거한다. 실패/정리 대기의 재시도 안내, 같은 requestId, 탈퇴 화면의 별도 행동은 유지한다.
- 필터가 선택돼 있어도 **전체 삭제는 계정의 전체 방문 기록**이다. 확인창에 `카테고리 필터와 관계없이 이 계정의 모든 방문 기록을 삭제합니다`를 명시한다. 필터 결과만 삭제하도록 기존 서비스를 바꾸지 않는다. 빈 전체 목록에서는 비활성/미표시한다. 조회된 개수만으로 서버 전체 삭제 개수를 단정하지 않는다.

## 3. 카테고리 필터

- 헤더 아래 `전체`와 현재 계정 기록에 실제 있는 카테고리 버튼을 둔다. 기본 전체, 기존 category 값/표시명 재사용, 같은 카테고리 중복 버튼0. 카테고리 순서는 고정하고 매 렌더마다 변경하지 않는다. 많으면 가로 스크롤로 수용한다. 흰색 텍스트, 선택 배경/테두리는 파란 강조, 접근성 selected를 제공한다.
- 필터는 **방문 목록만** 대상으로 한다. 통계/지도는 기존 전체 조회 기록 범위를 유지한다. 추가 API 조회·서버 저장·학습 분류 변경0. 계정 전환 시 전체로 초기화, 삭제 후 카테고리가 없어지면 전체로 복귀하고 열린 swipe를 닫는다.
- 기존 삭제 단위인 completionId 한 완료 기록을 보존한다. 두 장소 기록은 선택 카테고리의 장소가 하나라도 포함되면 해당 코스 기록을 한 번 표시하고 두 장소 이름을 유지한다. 장소 단위로 행을 복제하거나 한 장소만 삭제된다고 표현하지 않는다. 삭제 확인은 해당 기록의 전체 장소명을 보여준다. **사용자가 ‘선택 카테고리의 장소만 개별 표시/삭제’를 원하면 이는 현재 단위와 다른 결정이므로 구현하지 말고 인계한다.**
- guest_import 및 동기화 대기 계정 기록도 같은 표시 필터를 적용하되 학습 적격성은 바꾸지 않는다. 비로그인 기록 화면까지 기능 확장하지 않는다.

## 4. 드래그 진단 후 수정

- 기존 실패 재현부터 작성: 천천히 열기/닫기, 방향 반전, 손을 뗀 뒤 정착, 정착 도중 재잡기, 다른 행 열기, 세로 스크롤 경쟁, 필터/계정/목록 변경 중 drag, busy 전환/terminate. 동작 trace에는 row fixture ID·dx·표시 위치·target·grant/release/cancel 순서만 사용한다.
- 실제 화면에 표시 중인 위치를 grant 시작값으로 삼는다. React state를 매 프레임 갱신하는 구조와 release 순간 target으로 점프하는 구조를 개선하고 표시 좌표·부모 열린 행 상태·gesture 소유를 분리한다. Animated 등 기존 의존으로 연속 이동과 정착 애니메이션을 구현한다. 안정적인 responder/latest ref는 유지하되 그것만으로 부드러움을 증명하지 않는다.
- 정착 중 재잡기는 이전 애니메이션을 멈추고 실제 위치에서 이어간다. 비동기 stop callback 전에 움직인 입력 손실/초기 점프, 오래된 animation completion의 새 행 상태 덮어쓰기, 다른 행 강제 닫힘과 현재 gesture 경쟁을 검증한다. 삭제 버튼 노출 폭과 clamp/threshold를 같은 값에서 파생한다. 이유 없는 timeout이나 전체 ScrollView 비활성화로 가리지 않는다.
- 한 행만 열림, 세로 스크롤 정상, 미노출 휴지통 터치0, 확인 취소/연타/진행 중 삭제 guard, full swipe 삭제0을 유지한다. 단순 즉시 완료 animation mock만으로 통과시키지 말고 진행 중 위치·지연 callback·중단을 제어하는 fixture를 추가한다.

## 검증·인수인계

실패 fixture → 수정 → 집중 회귀 → npm run test:typecheck / npm run test:ui / npm test / git diff --check / iOS export. 실사용자 기록 삭제·운영 DB/API 호출0, commit/push0.

카테고리 단일/복합2곳/unknown·가져온 기록·pending, 필터 중 개별/전체 삭제 확인 취소, 성공/실패/정리 대기/계정 변경, 카드·삭제 영역 radius 일치와 작은 화면 레이아웃을 포함한다. 필터 중 전체 삭제가 전체 계정 범위임을 반드시 자동 검증한다.

실기기 최소 확인은 사용자가 기록을 삭제하지 않고도 수행할 수 있게 둥근 카드/검색 아닌 필터 선택/천천히 열고 닫기/정착 중 재잡기/세로 스크롤/휴지통 확인 취소/전체 삭제 확인 취소 순서로 제공한다. 자동 검증과 실제 부드러움 수락은 구분한다.

변경 파일·변경 목적 / 유지한 저장·삭제·개인화 계약 / 실행 테스트·결과 / 실제 원인과 남은 실기기 조건 네 항목을 본 문서에 남긴다. 과거 즉시 스냅 방식은 교체 이력으로 남기고 복원하지 않는다.

## 완료 인수인계 — 2026-09-08

### 1. 변경 파일·변경 목적

- `src/ui/HistorySwipeRow.tsx`, `src/ui/historySwipeMotion.ts`: 통계와 같은 14pt 둥근 테두리 카드/삭제 버튼, 64pt 버튼+8pt 간격의 72pt reveal. move의 React offset state와 release 즉시 스냅을 Animated.Value 연속 이동/native spring 정착으로 교체했다. grant는 stopAnimation의 실제 표시 위치를 읽고, 지연된 callback 이전 move/release를 보관한다. epoch로 오래된 완료/stop callback을 무효화한다. 다른 행·busy·terminate는 닫기로 정착, filter/계정 변경 시 행을 재마운트해 이전 gesture를 폐기한다. 휴지통은 정착·노출 전 실행하지 않으며 VoiceOver의 명시적 삭제 행동은 유지한다.
- `src/ui/AccountRecordsPanel.tsx`, `src/ui/historyCategoryFilter.ts`: 제목 우측 전체 삭제, 제목 위 24pt 여백, 줄바꿈 가능한 제목과 최소 44pt 행동, 한 번만 표시하는 swipe 안내, 가로 스크롤 카테고리 필터. 실제 category를 중복 제거·고정 정렬하며 빈 값은 기타. 두 장소 코스는 하나라도 해당하면 전체 완료 기록을 한 번 표시한다. 통계/지도에는 필터 전 전체 records를 계속 전달한다. 계정 변경·카테고리 소멸은 전체 필터로 복귀한다.
- `src/ui/OwnedDeletionPanel.tsx`: 기존 controller의 confirmAll을 헤더에 전달하고 children 사용 시 하단 중복 전체 삭제를 제거했다. 전체 삭제 확인에 필터와 무관한 계정 전체 범위를 명시하고, 개별 완료 기록 확인에는 그 기록의 모든 장소명을 표시한다. standalone/탈퇴 패널의 행동은 보존했다.
- `test/ui/history-polish.test.ts`, `test/ui/history-swipe.test.mjs`: motion/filter 실패 선행 fixture와 실제 행 responder/계정 화면/기존 삭제 controller 연결 회귀를 추가·보완했다. 본 문서에 결과를 기록했다. 다른 세션의 기존 변경은 되돌리지 않았다.

교체 이력: 구분선 행·하단 전체 삭제·필터 없음·move마다 React 렌더/release 즉시 스냅(이전) → 조작 인지 부족 및 재잡기 기준 좌표/정착 연속성 결함 → 둥근 카드·헤더 행동·목록 전용 필터·표시 위치 기반 gesture와 spring(현행 구현). 과거 즉시 스냅 방식은 철회이며 복원하지 않는다. 상단의 구현 전 항목은 이 완료 기록으로 구현 상태를 갱신하되 실제 기기 부드러움 수락은 별도다.

### 2. 유지한 저장·삭제·개인화 계약

- deletion 서비스, completionId 단위, 확인·취소·연타 guard, 동일 requestId 재시도, 정리 대기/오류 안내, 계정 전환 guard를 유지했다. 필터 중 전체 삭제는 `deleteAllOwnedAccountRecords({ requestId })`이며 category/표시 행 ID를 전달하지 않는다. 빈 전체 목록에서는 행동을 비활성화한다.
- 계정/비로그인 격리, guest_import 및 pending 표시, 측정 없는 체류시간 미추정, 학습 적격성, 기존 통계·지도 범위를 유지한다. 필터는 표시만 바꾸며 추가 조회/서버 저장을 하지 않는다.
- 탈퇴·전체 삭제·진행/Live Activity·개인화·DB·엔진 정책과 주변 시트/탭바는 변경하지 않았다. 운영 계정/표본 생성·실제 삭제·운영 API·Simulator·commit/push는 실행하지 않았다.

### 3. 실행 테스트·결과

- 선행 fixture는 새 motion/filter 경계가 없는 상태에서 실패한 뒤 구현했다. 기존 move setOffset/release offset 초기화/grant open boolean 기준은 코드로 확인한 결함이며, 실기기 프레임 성능 측정 결과로 표현하지 않는다.
- 집중 회귀 `npx tsx --test test/ui/history-polish.test.ts test/ui/history-swipe.test.mjs test/ui/owned-account-screen-flow.test.mjs test/ui/guest-import-record-display.test.ts`: **16/16 통과**. 단일/복합/빈 category·import/pending, 필터 중 취소/계정 전체 서비스 호출, 전체 장소명, 삭제 후 필터 복귀, 계정 전환, 정리 대기 동일 요청 재시도, 실패 보존, 마지막 기록 삭제 후 비활성화를 검증했다. 통계/지도 전달과 기존 계정 격리 회귀도 유지했다.
- 실제 production responder+제어 가능한 Animated fixture: 세로 우세 입력 미획득, 천천히 이동/방향 반전, full swipe 삭제0, 정착 중 재잡기, delayed stop 전 move/release, stale completion, terminate, busy, 노출 전 삭제0을 검증했다. 예: grant sample -60 / dx +12 → 표시 -48 / release target -72. 즉시 완료 mock만 사용하지 않았다. 다른 행 하나만 열림·필터 재마운트·계정 변경은 실제 계정 패널 fixture로 검증했다.
- `npm run test:typecheck`: 통과. `npm test`: **284/284 통과**. `npm run test:ui`: **615건 중 614 통과·기존 1 skip·실패0**. 최초 UI 실행은 sandbox의 tsx IPC EPERM으로 시작하지 못했고 승인된 실행 환경에서 재실행했다.
- `git diff --check`: 통과. `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-history-polish-ios`: 통과. 로그: `/private/tmp/timefit-history-polish-{typecheck,ui,all,export}.log`. iOS 번들 검증은 실기기 gesture 수락을 대신하지 않는다.

### 4. 실제 원인·남은 실기기 조건

- 확인된 코드 결함: release 순간 끝점 전환, 표시 좌표 대신 open boolean 사용, move마다 React state 업데이트. 표시 위치/입력/부모 선택을 분리하여 수정했다. 실제 사용자의 끊김에 JS 부하·리스트 렌더·네이티브 scroll 협상이 얼마나 기여했는지는 실기기 측정 전 미확정이다. PanResponder move는 JS 입력이므로 모든 상황의 프레임 성능을 보장한다고 기록하지 않는다.
- 삭제 없이 확인: (1) 작은 화면/큰 글자에서 제목·전체 삭제 겹침 없음과 14pt 카드·휴지통 모서리/8pt 간격 (2) 전체/카테고리 전환, 2곳 이름과 전체 통계·지도 유지 (3) 천천히 열기/닫기·방향 반전 (4) 정착 중 다시 잡아 점프 없음 (5) 세로 스크롤과 다른 행 전환 (6) 휴지통→전체 장소명 확인 후 취소 (7) 필터를 선택한 채 전체 삭제→계정 전체 안내 확인 후 취소. **실제 삭제 버튼을 확정할 필요 없음.**
- 실기기 미확인: 손가락 추적의 실제 부드러움, 큰 글자/좁은 폭 최종 시각 배치, VoiceOver 조작감. 기기에서 여전히 끊기면 해당 gesture trace/프레임 부하를 별도로 수집한다. 장소별 개별 삭제는 completionId 계약과 달라 이번 범위에 포함하지 않는다.
