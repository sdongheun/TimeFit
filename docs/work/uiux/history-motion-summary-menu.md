# U-HISTORY-FINAL-03 — 드래그 우선 복구 → 지도 요약·삭제 메뉴

## 최신 사용자 보완 — 2026-09-08, 아래 기존 B2보다 우선

- `⋯` 메뉴 버튼 → 사용자가 열 수 있음을 인지하는 `>` chevron으로 교체. 과거 `>` 금지 명령은 이 사용자 결정으로 철회한다.
- `>` 탭은 삭제 팝업이 아니라 **카드를 왼쪽으로 열어 휴지통을 노출**한다. 열린 상태에서 다시 눌러도 닫는 토글이 아니라 열린 상태를 유지한다. 휴지통→기존 삭제 확인→기존 서비스는 유지한다. 길게 누르기의 기존 메뉴는 이번 요청에서 철회하지 않았으므로 유지한다.
- 손을 대고 좌우로 움직일 때는 연속 위치 추적, 손을 뗐을 때만 정착한다. 내부 Pressable 이전 capture 단계에서 수평 입력을 획득하며, 수직 우세 입력은 부모 ScrollView에 남긴다. 획득한 수평 드래그는 방향 반전 중 부모에 양도하지 않는다. OS 강제 terminate/busy/계정 전환 시 기존 정리는 유지한다.

2026-09-08 사용자 확정·구현 전. UIUX 단일 세션이 A→B 순서로 수행한다. AGENTS.md, docs/README.md, UIUX 공통 규칙 UX-COLOR-01, 본 문서와 history-card-filter-gesture.md 최신 완료 인수인계를 읽는다. 과거 구현 전체를 다시 실행하지 않는다.

## 결정·교체 이력

- U-HISTORY-POLISH-02는 Animated.Value/native spring/실제 표시 위치 기준 및 지연 callback fixture까지 구현됐다. 과거 setOffset 매 프레임/즉시 스냅을 **현재 코드의 원인으로 재주장하지 않는다.** 사용자 잔여 부자연스러움 → 현재 responder/애니메이션/스크롤 협상 원인 재현 → 검증한 원인 수정 → A 구현 전.
- `왼쪽으로 밀어 삭제` 상시 안내 → 사용자 설명문 없는 조작 요구 → 날짜 옆 `⋯` 메뉴와 길게 누르기, 기존 swipe 병행 → 발견성과 간결함 → 확정. 이전 안내 문구 및 제안만 했던 첫 사용 자동 swipe 시연은 철회/미채택이며 구현하지 않는다.
- 상단4개 통계 박스 → 사용자가 기록을 한눈에 이해하기 어려움 → 지도·큰 방문 횟수·짧은 카테고리 정보 → 방문 경험 중심 → 확정. 시간/도넛/활동 유형을 각각 큰 박스로 반복하지 않는다.

## 역할·불변 경계

UIUX src/ui/관련 테스트/본 문서만 변경한다. App/nav는 불가피한 경우 단일 작성자 여부를 확인해 인계. API·DB·카탈로그·추천·학습·삭제 서비스 계약 변경0. 운영 데이터 생성/삭제·C 재검증·commit/push0. 기존 계정 격리, guest 이관 동의, completionId 삭제 단위, requestId 재시도, pending cleanup, 관련 invalidation은 보존한다.

## A. 드래그 잔여 원인 진단 및 수정 — 먼저 마감

1. 현재 HistorySwipeRow.tsx/historySwipeMotion.ts와 실제 부모 AccountRecordsPanel/ScrollView를 읽고 재현한다. 느린 좌우 이동·방향 반전·손 떼기·정착 중 재잡기·닫힌/열린 행의 시작·다른 행 열기·세로 스크롤·필터/계정 변경을 구분한다.
2. 원인 후보를 증거로 좁힌다: responder 임계치 도달 전 누적 dx가 grant 후 더해져 첫 프레임이 튀는지, stopAnimation 지연 입력 처리, grant의 onOpen→부모 effect sync 경쟁, native spring과 JS setValue 전환, 리스트/지도 리렌더 부하, release 목표/속도 반영. 모두 실제 원인이라고 단정하지 않는다. 고정 fixture ID·gesture 단계·표시/목표 위치·시간만 기록하고 사용자 정보/좌표 로그0.
3. 현재 코드에서 실패하는 재현 테스트를 먼저 만든 뒤 수정한다. 기존 지연 stop/중단/epoch 방어를 제거하지 않는다. 이미 Animated로 바뀐 코드를 또 Animated로 교체했다는 것으로 해결을 선언하지 않는다. 근거 없는 spring 수치 조정·timer·전체 세로 스크롤 차단으로 가리지 않는다. 기존 의존으로 해결 가능한지 확인하고 새 네이티브 의존/재빌드가 필요하면 이유와 영향부터 인계한다.
4. 자동 acceptance: 손가락 이동에 연속 반응, grant/regrab 위치 점프0, 오래된 callback 덮어쓰기0, 닫는 방향 자연스럽게 복귀, 한 행만 열림, 미노출 휴지통 터치0, full swipe 삭제0, 세로 스크롤 유지. 제어 가능한 애니메이션 중간값/비동기 callback fixture와 실제 컴포넌트 결합 검증을 사용한다.
5. **A 게이트:** 원인·재현·수정·집중 회귀 결과를 기록한 뒤에만 B를 진행한다. 원인이 미확정이거나 회귀가 실패하면 외형 변경으로 섞어 덮지 말고 최소 추가 기기 재현 조건을 요청한다. 자동 통과는 실제 기기 프레임 부드러움 확인과 구분한다. 사용자가 삭제 없이 좌우 drag/재잡기/세로 scroll로 확인할 수 있는 짧은 체크리스트를 남긴다.

## B1. 상단 요약 — 지도 + 방문 횟수 + 카테고리

### A 게이트 완료 — 2026-09-08 (B 변경 전)

- 고정 base+누적 dx clamp는 끝점 초과 이동 뒤 반전 시 초과량을 되돌릴 때까지 반응하지 않는 코드 결함이다. 표시 -72에서 누적 dx -120→-119로 반전해도 이전 공식은 계속 -72이며 수정 후 -71로 즉시 반응한다.
- grant dx=-15 → move=-16의 합성 fixture도 -16 !== -1로 실패했으나, 후속 설치된 React Native `PanResponder.js:459` 확인에서 실제 grant는 dx/dy를 0으로 초기화함을 확인했다. 따라서 **임계치 누적량 후보는 이 runtime의 실기기 원인에서 제외**한다. 비영점 grant 대응은 경계 방어 테스트이며 실제 발생 증거로 인계하지 않는다. 이전 중간 설명의 원인 확정 표현은 이 확인으로 정정한다.
- `historySwipeMotion`은 grant dx를 기준으로 제외하고 이후 증분만 표시 위치에 적용한다. 매 이동마다 clamp 기준도 갱신해 끝점 반전 즉시 반응한다. `HistorySwipeRow`가 실제 grant dx를 전달한다. 기존 stop 지연 입력/release 보관·epoch·native spring·busy/terminate는 유지했다. spring 수치/의존/전체 ScrollView는 변경하지 않았다.
- `npx tsx --test test/ui/history-polish.test.ts test/ui/history-swipe.test.mjs`: 최초 신규 재현 실패(-16 !== -1), 수정 후 8/8 통과. 느린 이동·끝점 방향 반전·중간 위치 재잡기·지연 stop·stale callback·세로 우세 입력 미획득·다른 행·필터/계정 guard를 확인했다. 이 결과로 A 코드/집중 회귀 게이트를 마감하고 B에 진입한다.
- 실제 기기 프레임 부하/JS↔native 전달 지연이 남은 체감에 기여하는지는 미확인이다. 과거 setOffset/즉시 스냅을 현행 원인으로 재주장하지 않는다. 삭제 없이 느린 좌우 이동→끝점 반전→정착 중 재잡기→세로 스크롤로 확인한다.

1. 큰 방문 횟수와 지도 미리보기, 짧은 카테고리별 횟수를 한 요약 영역으로 구성한다. 다크·흰색 텍스트·파란 강조 유지. 기존4박스를 새 박스 여러 개로 다시 만들지 않는다. 제목/큰 숫자→지도→짧은 범례 순으로 읽히게 하며 기록 목록을 지나치게 아래로 밀지 않도록 작은 iPhone에서 높이를 확인한다.
2. 방문 횟수는 기존 완료 기록의 places 합계(반복 방문 포함)를 `방문 N회`로 표시한다. 코스2곳은 방문2회, 동일 장소 재방문도 별도 회수다. 고유 장소 수나 GPS 방문 확인값으로 표현하지 않는다. pending/remote 중복은 기존 병합 결과를 사용하고 guest_import도 기존 방문 통계 계약을 따른다.
3. 지도는 기존 완료 장소 지도/마커 경계를 재사용한다. 실제 좌표가 있는 완료 장소만 표시하고 탭하면 기존 큰 지도로 연다. 같은 위치는 기존 중복/묶음 처리를 유지하며 방문 횟수와 지도 핀 수가 다를 수 있다. 실제 이동 궤적처럼 선을 연결하지 않는다. 좌표 누락/지도 실패에도 횟수/카테고리/기록/삭제는 사용 가능하게 한다. 새 위치 권한·경로 API·GPS 수집0.
4. 카테고리는 기존 category별 방문 횟수를 `카페 6 · 문화 4` 같은 실제 분류명으로 짧게 표시한다. 많으면 줄바꿈/보조 펼침으로 대응하되 존재하지 않는 활동명으로 임의 재분류하지 않는다. 별도 큰 도넛/활동 유형 박스는 제거한다. 체류시간을 큰 대표 지표로 사용하지 않고 미측정값을0 또는 추정치로 채우지 않는다.
5. 상단은 전체 조회 기록 범위, 아래 카테고리 필터는 목록만 변경한다. 현재 조회가 전체 서버 이력을 보장하지 않으면 ‘계정 평생 전체’ 등으로 표시하지 않는다. 미동기화/오류 안내는 필요한 때만 짧게 유지한다. 공용 ActivityStatistics 변경 시 비로그인에서도 같은 시각 구조를 적용하되 기존 guest 집계 기간/저장/접근 권한은 그대로 보존한다. 계정/guest 집계 범위를 새로 통일하지 않는다.

## B2. 카드 날짜·메뉴·길게 누르기

1. 카드 오른쪽에 날짜와 `⋯` 메뉴를 배치한다. `>`는 상세 이동으로 오해할 수 있으므로 사용하지 않는다. 장소명과 날짜/메뉴가 작은 화면·긴2곳 제목·큰 글자에서도 겹치지 않게 한다. 카드/노출 휴지통 radius14 유지, 흰색 텍스트/보조 날짜 회색, 최소44pt 메뉴 터치 영역.
2. `⋯` 탭과 카드 길게 누르기는 **같은 삭제 메뉴**를 연다. 길게 눌렀다는 사실만으로 삭제하지 않는다. 메뉴의 `삭제` → 기존 대상 장소명 확인창 → 기존 서비스로 연결한다. swipe 휴지통과 VoiceOver도 같은 controller를 사용한다. 한 번에 하나의 메뉴/확인창만 열고 연타/계정 변경/필터 변경/삭제 중 상태를 방어한다.
3. horizontal drag/vertical scroll을 시작하면 long press는 취소된다. 메뉴 버튼 탭이 부모 long press나 swipe로 함께 처리되지 않게 하고, 길게 누른 뒤 손을 움직여 메뉴/삭제가 중복 실행되지 않게 한다. B의 새 터치 핸들러가 A의 responder 동작을 다시 깨지 않는 결합 회귀를 필수로 실행한다.
4. `왼쪽으로 밀어 삭제` 문구를 제거한다. 자동 시연·상시 방향 화살표를 추가하지 않는다. 기존 카테고리 필터와 제목 오른쪽 전체 삭제는 유지한다. 전체 삭제는 필터와 무관한 계정 전체임을 확인창에서 유지한다. 개별 삭제는 두 장소여도 completionId 한 코스 기록 전체이며 한 장소만 삭제된다고 표시하지 않는다.

## 최종 검증·인수인계

- A 재현 fixture + B 지도 실패/빈 기록/좌표 누락/반복 방문/2곳/import/pending·중복 병합/계정 전환/필터 전환, 메뉴/long press/swipe 충돌·확인 취소·삭제 실패/정리 대기/같은 requestId 재시도·전체 삭제 범위 회귀.
- npm run test:typecheck, npm run test:ui, npm test, git diff --check, 경량 iOS export. 제품 지도 캡처/gesture 체감은 자동 fixture와 구분한다. 운영 API 반복/실사용자 삭제로 테스트하지 않는다.
- 변경 파일·목적 / 유지 계약 / 실행 테스트와 결과 / A 실제 원인 및 남은 실기기 확인을 이 문서에 기록한다. B 완료 후에도 A gesture 회귀를 재실행한다. 실제 삭제 없이 메뉴·확인 취소와 swipe를 검증할 수 있도록 인계한다.

## 최종 완료 인수인계 — 2026-09-08

### 1. 변경 파일·목적

- A: `src/ui/historySwipeMotion.ts`, `src/ui/HistorySwipeRow.tsx`, `test/ui/history-polish.test.ts`, `test/ui/history-swipe.test.mjs`. 누적 이동의 끝점 초과분 때문에 반전이 늦어지는 결함을 증분 clamp로 교체했다. 실제 표시 위치로 재잡기, 지연 stop/release 및 오래된 callback 무효화는 보존했다. 상단 A 게이트를 기록한 후 B를 진행했다.
- B: `src/ui/activity/ActivityStatistics.tsx`의 네 박스·도넛·시간 대표 지표를 `방문 N회 → 150pt 지도 미리보기 → 실제 카테고리별 횟수` 한 요약으로 교체했다. 범위 문구를 유지하고 카테고리는 줄바꿈한다. 공용 화면이므로 guest도 같은 시각 구조이며 집계 기간은 기존 이번 달이다.
- `src/ui/CompletedPlacesMapButton.tsx`: 기존 방문 마커/큰 지도 경계에 미리보기를 추가했다. 중복 핀 처리와 좌표 누락 제외, 빈 선/안전한 지도 실패 표시를 유지하며 미리보기 탭은 기존 큰 지도를 연다. 미리보기 WebView는 터치를 가져가지 않는다. 동일 기록 입력의 markers/points/빈 line을 안정화해 행 열림·메뉴 등에서 불필요한 지도 setRoute 주입을 유발하지 않게 했다.
- `src/ui/AccountRecordsPanel.tsx`: 기존 전체 통계/지도 입력을 memoize하고, 날짜는 오른쪽에 전달하며 ⋯/길게 누르기를 동일 메뉴에 연결했다. 필터와 제목 우측 전체 삭제를 유지하고 상시 swipe 설명은 제거했다.
- `src/ui/OwnedDeletionPanel.tsx`: 하나의 메뉴/확인 guard와 interaction scope를 추가했다. `메뉴 삭제 → 전체 장소명 확인 → 기존 perform`이다. 오래된 메뉴 dismiss가 새 확인을 해제하지 않도록 overlay 세대를 구분하며 필터/계정 변경 뒤 callback은 실행하지 않는다. 삭제 service 구현 자체는 변경하지 않았다.
- 테스트: 위 A 테스트 외 `test/ui/history-final.test.mjs`, `test/ui/completed-map-screen.test.ts`, `test/ui/guest-import-record-display.test.ts`, `test/ui/course-completion-history.test.ts`. 메뉴/길게 누르기/세로 이동 취소·계정 패널·새 요약·미리보기 회귀를 추가하고 철회된 네 박스/미측정 시간 문구 기대값만 새 표시 계약으로 갱신했다. 본 문서 외 보드/중앙 문서는 수정하지 않았다.

이력: U-HISTORY-POLISH-02의 실제 위치 기반 spring은 유지하되 끝점 초과량을 되갚는 누적 clamp는 철회→증분 clamp 현행. 네 박스와 상시 swipe 안내는 사용자 확정으로 철회→지도 요약/⋯/길게 누르기 현행 구현. 자동 swipe 시연·새 햅틱·새 의존은 추가하지 않았다.

### 2. 유지 계약

- 방문 수는 병합된 완료 기록의 places 합계이며 반복 방문과 2곳 코스의 각 장소를 센다. 핀 수/고유 장소 수/GPS 방문 판정으로 바꾸지 않았다. import/pending·동일 completion 병합·guest 이번 달·계정 현재 조회 범위는 유지한다. 시간 추정이나 학습 적격성 변경0.
- 기존 확인·서비스·completionId 단위·requestId 재시도·pending cleanup·invalidation·삭제 실패 보존·소유권 guard 유지. swipe 휴지통/VoiceOver는 기존 확인 controller, ⋯/길게 누르기는 같은 메뉴를 거쳐 그 controller를 사용한다. full swipe 즉시 삭제0, 메뉴 진입만으로 삭제0. 전체 삭제는 필터와 관계없는 계정 전체다.
- 장소 원본/DB/API/엔진/개인화/Live Activity/App/nav/주변 화면 변경0. 운영 데이터 생성·삭제·API 호출·C 검증·Simulator·commit/push0. 다른 세션 변경은 보존했다.

### 3. 검증 결과

- A 최초 합성 grant 경계 실패 후 수정, 집중 8/8 통과. 실제 runtime grant 초기화 확인에 따른 원인 정정은 A 게이트에 명시했다. 최종 제어 가능한 중간 위치·지연 stop·release 이전/이후·stale completion·끝점 방향 반전·terminate·busy·세로 우세 입력·한 행만 열림 테스트를 B 추가 후 재실행했다.
- 집중 회귀: `history-final`, `history-polish`, `history-swipe`, `guest-import-record-display`, `completed-map-screen`, `global-interaction-motion`, `course-completion-history` **46/46 통과**. B 신규 fixture도 구현 전 실패했다(초기 요약 fixture의 RN 로더 오류는 기능 증거에서 제외). 메뉴와 긴 누름의 같은 진입·중복 차단·수직/수평 이동 시 long press 취소·필터 뒤 stale 메뉴·확인 취소·삭제 실패/정리 대기/동일 요청·계정 변경·전체 삭제 서비스 범위를 검증했다.
- 기존 guest 집계의 체류 미추정 순수 테스트는 유지했고 바뀐 시각 문구만 갱신했다. 지도는 기존 안전한 오류 표현 경계/좌표 누락·중복·빈 선·미리보기→큰 지도 왕복을 fixture로 검증했다. 실제 지도 SDK의 네트워크 실패나 제품 지도 캡처를 실행한 것은 아니다.
- `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`, iOS export의 최종 결과는 아래 확정 로그 항목으로 기록한다. 최초 전체 회귀에서 철회된 시간 문구 기대값, native Pressable 직접 사용, npm 전체 실행의 tsx 로더 누락을 발견하여 각각 새 시각 기대값/기존 공용 AnimatedPressable/테스트 로더 연결로 보완했다. 공용 눌림 정책을 완화하지 않았다.
- 최종 확정: typecheck 통과, UI **619건 중 618 통과·기존 1 skip·실패0**, 전체 **286/286 통과**, diff check 통과, `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-history-final-ios` 통과. 로그는 `/private/tmp/timefit-history-final-typecheck.log`, `/private/tmp/timefit-history-final-ui.log`, `/private/tmp/timefit-history-final-all.log`, `/private/tmp/timefit-history-final-export.log`이며 iOS 산출물은 `/private/tmp/timefit-history-final-ios`다.

### 4. 남은 실기기 확인·위험

- 코드로 확인한 실제 결함은 **끝점 초과량이 반전을 지연시키는 clamp**다. grant 누적 임계량은 RN의 dx=0 초기화 때문에 이 runtime 원인에서 제외했다. JS 부하/native 전달/ScrollView 협상의 기기 프레임 영향은 자동 fixture로 확정하지 않는다. 새 long press는 기존 Pressable 취소 동작과 추가 이동 guard를 사용하며 최종 촉감은 기기에서 확인해야 한다.
- 삭제 없이 최소 확인: (1) 천천히 열기/닫기와 끝점에서 1~2pt 방향 반전 (2) 정착 중 재잡기·다른 행 열기 (3) 카드/⋯ 근처에서 세로 스크롤하며 메뉴가 우발적으로 열리지 않음 (4) ⋯ 및 길게 누르기→삭제 메뉴→전체 장소명 확인 후 **취소** (5) 필터 전환 후 통계/지도 불변, 전체 삭제의 계정 전체 안내 후 **취소** (6) 지도 미리보기→큰 지도→닫기 (7) 작은 화면·큰 글자·긴2곳 제목에서 날짜/44pt 메뉴 겹침 없음 및 VoiceOver 메뉴/삭제 행동.
- 확인되지 않은 항목: 실제 iPhone 드래그 부드러움, 지도 SDK 실패 시 제품 화면, 작은 폭/큰 글자 시각 배치, VoiceOver 사용감. 자동 통과를 사용자 체감 수락으로 대신하지 않는다. 새 네이티브 의존/Pod 변경은 없다.

## 추가 요구 완료 인수인계 — chevron·직접 펼치기·연속 드래그

1. **변경 파일·목적:** `src/ui/HistorySwipeRow.tsx`의 ⋯를 chevron-right로 교체하고 접근성 이름을 `삭제 버튼 펼치기`로 변경했다. 탭은 motion sync+기존 열린 행 선택만 실행한다. 수평 획득 기준을 기존 이동 취소 기준과 같은 6pt로 맞추고 capture/bubble을 같은 판정으로 공유한다. 수평 획득 이후 termination request를 거절하여 좌우 반전의 소유권을 유지한다. `test/ui/history-swipe.test.mjs`에 실패 선행 fixture와 직접 펼치기·중간 위치 추적·세로 우세 미획득을 추가했다. 기존 메뉴 회귀는 실제 길게 누르기 진입으로 유지했다. 본 문서에 최신 결정과 인수인계를 기록했다.
2. **유지 계약:** 연속 move 계산·실제 표시 위치 재잡기·지연 stop/epoch·release 정착·한 행 열림·full swipe 삭제0·확인/서비스/requestId·계정 격리·개인화·전체 지도/통계는 유지한다. 새 네이티브 의존/운영 호출/실사용자 삭제/Simulator/commit/push0. 전체 세로 ScrollView를 잠그지 않는다. 종전 ⋯ 탭→메뉴는 철회, 길게 누르기→메뉴는 유지다.
3. **검증:** 신규 fixture는 기존 버튼에서 메뉴 1회(기대0)로 먼저 실패했다. 수정 뒤 집중 11/11 통과. 실제 행 handler에서 열린 위치 -72→-69→-63→-67→-57→-62를 손을 떼지 않고 추적하며, dx7/dy1 capture 획득·dx2/dy10 미획득·획득 후 소유권 유지·재잡기/지연 callback·삭제 guard를 검증했다. 전체 자동 결과는 아래에 확정한다.
4. **실기기 확인:** `>` 탭→팝업0/휴지통 표시→휴지통 확인 취소, 손을 대고 천천히 왕복/끝점 반전/정착 중 재잡기, 카드 제목 및 `>` 위에서 시작하는 수평·세로 제스처를 삭제 없이 확인한다. capture 부재와 12pt 이전 임계값은 코드 사실이나, 그 기여도를 실기기 프레임 측정 없이 잔여 부자연스러움의 유일 원인으로 확정하지 않는다. 실제 손가락 추적의 부드러움은 사용자 기기 확인이 남아 있다.

자동 확정: typecheck 통과, UI **620건 중619 통과·기존1 skip·실패0**, 전체 **287/287 통과**, diff check 및 iOS export 통과. 로그 `/private/tmp/timefit-history-chevron-{typecheck,ui,all,export}.log`, 번들 `/private/tmp/timefit-history-chevron-ios`. 실기기/Simulator는 실행하지 않았다.

## 사용자 확인 수락 — 2026-09-08

- 사용자 응답: “확인 완료됐다”. 직전 추가 보완인 `>` 표시·탭으로 휴지통 펼치기·연속 좌우 드래그의 사용자 실기기 확인 완료로 기록한다. 해당 범위의 실기기 대기는 해제한다.
- 변경 파일/목적: 본 문서에 사용자 확인 근거와 수락 범위만 추가했다. 제품 코드·삭제/계정/개인화 계약은 변경하지 않았다.
- 검증: 위 자동 검증 결과와 이번 사용자 확인을 구분해 보존한다. 문서만 변경했으므로 자동 테스트를 재실행하지 않았다.
- 남은 범위: 별도로 보고되지 않은 지도 SDK 실패·큰 글자/작은 폭·VoiceOver의 개별 시나리오까지 통과한 것으로 확대하지 않는다. 에이전트의 실기기/Simulator 실행 및 commit/push는 없다.
