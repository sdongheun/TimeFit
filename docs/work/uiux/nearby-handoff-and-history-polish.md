# U-NEARBY-HANDOFF-02 / U-HISTORY-SWIPE-01

2026-09-08 사용자 요청·실행 명령. UIUX 단일 세션에서 A → B 순서로 수행한다. 제품 코드 구현은 해당 세션 소유다. 본 문서는 작업 지시이며 검증 완료 기록이 아니다.

## 선행 확인·범위

AGENTS.md, docs/README.md, UIUX_공통규칙.md의 UX-COLOR-01, 본 문서를 읽는다. U-NEARBY-SIMPLE-01 완료 인수인계는 nearby-simple-directions.md 끝에 있다. 자동 검증 완료 보고와 별개로 사용자가 외부 길찾기 실행 뒤 오류 문구를 관찰했다. 따라서 외부 handoff 전체 수락으로 처리하지 않는다.

이력: 주변 상단 편집 아이콘·성공 후 실패 안내 관찰 → 명시 `검색` 텍스트와 반환 결과 구분으로 교체 → 행동 이해·오류 안내 신뢰 개선 → 구현 전. 기록 하단의 `N번째 방문 기록 삭제` 나열 → 정보 중복과 삭제 대상 파악 어려움 → 해당 행 왼쪽 스와이프 후 휴지통으로 개별 삭제 진입 → 대상이 명확한 간결한 기록 UI → 구현 전.

## A. U-NEARBY-HANDOFF-02 — 검색 버튼·외부 반환 진단/수정

1. NearbyBrowseScreen의 우측 `nearby-change-location`을 편집 아이콘 대신 흰색 계열 `검색` 텍스트 버튼으로 바꾼다. 검색 동작/기준 위치 편집 계약은 유지하고 접근성 이름도 검색으로 명확히 한다. 현위치 버튼과 높이·수직 정렬을 맞추고 텍스트 폭/좌우 padding에 맞춰 헤더 gap·제목 가용 폭을 조정한다. 작은 iPhone/긴 위치명/큰 글자에서 버튼 겹침·잘림 없이 제목 쪽을 줄이거나 말줄임한다. 아이콘 전용 고정 폭/variant를 그대로 남기지 않는다.
2. 우선 재현한다. 현재 nearbyDirections.ts는 openExternal reject 후 openBrowser로 fallback하며 browser result.type=cancel을 failed로 바꾼다. 화면은 failed일 때 상단 오류를 띄운다. 이것은 원인 후보이며 실제 기기 반환 증거 없이 확정하지 않는다. openExternal resolve/reject, browser 반환 type/예외, 앱 foreground/background, 요청 순서만 민감정보 없이 조사한다. 좌표·URL·키·계정 데이터는 로그에 넣지 않는다. 새 재현 fixture를 먼저 실패시킨다.
3. 외부 요청 수락, 실제 예외, 사용자의 브라우저 닫기/취소, 외부 전환 이후 복귀를 구분한다. browser cancel/dismiss만으로 ‘길찾기를 열지 못함’을 단정하지 않고, 반대로 실제 카카오맵 길찾기 성공으로 합성하지도 않는다. 필요하면 UI 소유 helper에 neutral/cancelled 결과를 추가하고 소비처/테스트를 함께 갱신한다. 실제 열기 실패에는 짧은 오류·재시도를 유지한다. 근거 없이 지연 timer, 오류 전면 숨김, 무조건 opened 처리로 해결하지 않는다.
4. 이전 요청의 늦은 결과가 새 장소/새 요청에 오류를 덮어쓰지 않게 한다. 연타 잠금·finally 해제·실패/복귀 시 선택과 탐색 기준 보존을 유지한다. 별도 경로 API를 호출하거나 성공 확인 목적으로 카카오맵을 두 번 열지 않는다.
5. 목적지는 선택 장소, 출발지는 카카오맵의 현위치/사용자 선택 계약을 유지한다. 주변 길찾기에서 코스·기록·체류·학습·알림·Live Activity 쓰기/진행 변경0. API/service 수정이 필요하면 UIUX가 직접 넘지 말고 원인과 최소 계약을 해당 역할로 인계한다.

## B. U-HISTORY-SWIPE-01 — 계정 방문 기록 간소화·행 삭제

1. AccountRecordsPanel의 `내 계정의 방문 기록` 위에 통계 영역과 분명히 구분되는 여백을 둔다(기존 간격 규격 기준 약24pt부터 화면 확인). 기록은 장소명·날짜 중심으로 정리한다. 매 행 `코스 완료 기록` 같은 반복 문구는 줄이되 동기화 대기·실패 등 조치가 필요한 상태, guest 이관 승인, 실제 측정/통계 범위 의미는 왜곡하지 않는다. 통계/계정 조회 범위를 바꾸지 않는다.
2. 계정 기록 한 행을 왼쪽으로 스와이프하면 오른쪽에 휴지통 버튼을 노출한다. full swipe 자체로 즉시 삭제하지 않는다. 휴지통 탭 → 기존 한 번의 삭제 확인 → 삭제 서비스 실행 흐름을 유지한다. 별도 상세/관리 페이지를 거치지 않는다. 파괴적 버튼은 빨간 배경+흰 휴지통 등 의미색 예외를 적용할 수 있다. VoiceOver에 `방문 기록 삭제` 행동을 제공하여 스와이프만 강제하지 않는다.
3. 삭제 단위는 현행 completionId 한 기록 행이다. 두 장소 코스도 한 완료 기록 단위이며 장소 하나씩 쪼개서 삭제하지 않는다. UI 행 번호가 아닌 안정적 completionId와 계정 subject를 사용한다. 열리는 행은 한 번에 하나, 세로 스크롤과 충돌하지 않으며 재정렬/다시 조회/계정 변경 시 잘못된 행이 삭제되지 않아야 한다.
4. **기존 삭제 서비스가 이미 있다.** OwnedDeletionPanel의 확인/요청 잠금/동일 requestId 재시도/계정 변경 guard와 deleteOwnedAccountRecord를 재사용한다. 화면용 controller/hook으로 분리할 수 있으나 해당 로직을 행마다 복사하지 않는다. 목록만 숨기는 가짜 삭제나 새 직접 Supabase delete는 금지한다. 개인화 invalidation, 소유권 검증, pending/evidence 정리 등 기존 계약은 유지한다.
5. AccountRecordsPanel 아래의 `N번째 방문 기록 삭제` 중복 목록은 행 행동으로 교체한다. 전체 삭제/계정 탈퇴는 이번 요구와 별개이며 기존 수단·재인증·처리를 삭제하거나 약화하지 않는다. 비로그인 기록 삭제 정책/서비스를 새로 만들지 않는다. 공용 컴포넌트 변경 시 내정보 탈퇴 화면은 회귀만 확인한다.
6. 삭제 중 중복 탭을 막고 실제 결과에 따라 목록과 지도/통계를 갱신한다. deleted/not_found 외에 cleanup.local_cleanup_pending도 확인한다. 서버 삭제와 기기 정리 완료를 혼동하지 않고 미완료면 짧은 상태/동일 요청 재시도를 제공한다. 실패/인증 변경/오프라인에 성공처럼 사라지게 하지 않는다. 다른 계정/guest/무관한 진행 코스는 불변이다. 서비스 계약 결함 발견 시 DB 역할에 근거를 반환하고 UI에서 삭제 정책을 임의 확장하지 않는다.

## 검증 및 종료

- A: 작은 화면/긴 제목/큰 글자 헤더, external 수락, reject→browser, browser cancel/dismiss, 양쪽 예외, 연타, 늦은 응답, 앱 복귀를 고정 fixture로 확인. 실제 성공 후 오류 문구0과 진짜 실패의 오류 유지 둘 다 필요하다.
- B: 두 행 중 정확한 행 스와이프, 세로 스크롤, 열림 행 교체, 휴지통 확인 취소/실행, 연타, 삭제 성공/실패/정리 대기, 같은 요청 재시도, remote+local/pending/guest_import 계정 행, 계정 변경 중 응답, 마지막 행 삭제 후 빈 목록/통계/지도 갱신. 접근성 삭제 경로와 기존 전체 삭제/탈퇴 회귀를 포함한다.
- 실패 fixture 먼저 추가하고 npm run test:typecheck, npm run test:ui, npm test, git diff --check 및 iOS export를 실행한다. 실행하지 못한 것은 성공으로 기록하지 않는다. 실제 사용자 기록 삭제·운영 API/DB 호출은 하지 않는다. 시뮬레이터 반복 수동 조작 대신 fixture로 검증하고 실기기 외부 전환·스와이프 체감은 사용자 확인 목록으로 남긴다.
- A 완료 후 B로 이어서 진행하며 새로운 기능/개인화 C/운영 migration은 추가하지 않는다. 두 작업의 변경 파일·유지 계약·테스트 결과·남은 위험/실기기 확인을 이 문서에 각각 기록한다. commit/push는 별도 요청 전 금지한다.

## 2026-09-08 A — U-NEARBY-HANDOFF-02 인수인계

### 변경 파일과 원인

- `src/ui/nearbyDirections.ts`: 실패 선행 fixture에서 external reject → browser `{type:'cancel'}`가 `failed`로 반환됨을 확인했다. cancel/dismiss는 `cancelled`, 알 수 없는/locked 반환은 `unconfirmed`, 외부 요청 수락/명시 opened는 `opened`, 실제 throw·유효하지 않은 목적지는 `failed`로 구분한다. 어느 상태도 실제 경로 계산 완료를 입증하지 않는다.
- `src/ui/NearbyBrowseScreen.tsx`: `검색` 흰색 텍스트/접근성 이름, 현위치와 같은 최소높이48·폭56/padding10, 헤더 gap6, 제목 minWidth0/한 줄 말줄임. 아이콘 variant 제거. 요청 epoch를 목적지/기준위치 변경·상세 닫기에 무효화하고 늦은 failed는 새 상세에 표시하지 않는다. mounted/epoch 검사는 보조 장소 열기에도 적용했다.
- `test/ui/nearby-directions.test.ts`, `test/ui/nearby-browse-screen.test.mjs`: cancel/dismiss/locked 반환, 정상 수락, 실제 예외, 검색 버튼 계약, 늦은 실패 후 새 선택 보존 fixture 추가.

### 유지 계약

- 목적지 전용 URL·출발지 미주입·단일 요청 잠금·finally 해제·동일 목적지 browser fallback 유지. 추가 카카오 호출/성공 확인용 재호출 없음. 취소를 실패로 단정하지도, 성공으로 합성하지도 않는다. 진짜 실패에는 오류와 같은 상세 재시도를 유지한다.
- 외부 반환만 수정했고 코스·기록·체류·학습·알림·Live Activity·DB 변경0. 기준 위치와 선택 상태는 복귀만으로 초기화하지 않는다. 키/URL/좌표/계정 원문을 담는 제품 진단 로그 추가0.

### 검증 결과

- 수정 전 cancel fixture 실패(actual failed, expected cancelled) → 수정 후 cancel/dismiss 중립 통과. 양쪽 throw의 failed와 오류 안내는 기존 fixture 및 전체 회귀에서 유지한다. 알 수 없는 반환은 unconfirmed로 성공 합성 차단.
- 자동 화면 fixture에서 외부 fallback 취소 뒤 실패 문구0, 이전 장소 요청의 늦은 예외 뒤 새 상세 오류0, 동기 연타1회 및 선택 유지 확인.
- 아래 공통 검증 마감의 typecheck/UI/전체/iOS export 통과. 브라우저의 실제 foreground/background 순서·사용자 기기 반환값 수집은 하지 않았다.

### 남은 위험·최소 실기기 확인

- **확인된 것은 코드 결함/반환값 재현이며 사용자 기기의 실제 반환 원인은 미확정**이다. cancel은 사용자 닫기뿐 아니라 외부 앱 전환에 따른 종료로도 관찰될 가능성이 있으나 이번 기기 증거 없이 단정하지 않는다.
- 작은 iPhone/큰 글씨/긴 기준 위치명에서 검색·현위치가 겹치지 않는지, 목적지 길찾기를 열고 돌아온 뒤 허위 실패 문구가 없는지 확인한다. 실제 열기 실패 때 오류와 재시도가 남는지 확인한다. 화면/네이티브 레이아웃의 최종 측정은 미실행이다.
- 이력: cancel을 failed로 단일 분류(철회) → fixture에서 닫기 이후 오류 재현 → cancelled/unconfirmed/accepted/failed 구분(현행) → 외부 동작의 불확실성을 성공·실패로 꾸미지 않기 위함.

## 2026-09-08 B — U-HISTORY-SWIPE-01 인수인계

### 변경 파일

- `src/ui/HistorySwipeRow.tsx`: 완료 기록당 안정적 ID를 가진 행. 수평12pt 및 세로 이동 대비1.5배 기준으로 responder 획득, 최대64pt 휴지통 노출, full swipe 삭제0. 터치 휴지통·VoiceOver `방문 기록 삭제`가 같은 callback으로 연결된다. drag responder를 메모화하고 최신 상태/handler는 ref로 읽는다. terminate는 닫는다.
- `src/ui/AccountRecordsPanel.tsx`: 제목 위24pt·아래8pt, 장소명/날짜 중심의 행, 동기화 대기/직접 이관 표시 유지. 한 번에 열린 completionId 하나만 보관하며 계정/조회 목록 변경 시 닫는다. key는 subject+completionId. 기존 `OwnedDeletionPanel`의 render callback을 통해 같은 삭제 controller를 모든 행에서 공유한다. 재조회 때문에 삭제 controller가 unmount되어 요청 ID를 잃지 않도록 같은 subject의 컴포넌트를 유지한다. 성공 후 기존 onChanged/reload로 통계·지도 입력·목록 갱신.
- `src/ui/OwnedDeletionPanel.tsx`: 행용 `{busy, confirm}` render callback, 중복 확인창 잠금과 확인 이후 계정 scope guard, pending/실패 때 같은 대상 요청을 확인할 `삭제 결과 다시 확인` 행동 추가. 행용 callback 사용 시 하단 N번째 개별 삭제 목록만 제거. 동일 기존 perform·requestId·identity 확인·deleteOwnedAccountRecord·personalization invalidation·소유권 cleanup을 사용한다. 오래된 계정의 catch 메시지도 차단한다.
- `test/ui/history-swipe.test.mjs`: 실제 행·AccountRecordsPanel·OwnedDeletionPanel 결합 fixture. `test/ui/guest-import-record-display.test.ts`, `test/ui/release-personalization-panels.test.mjs`는 통계/조회 격리 테스트의 새 행 컴포넌트를 host stub으로 격리했다. 실제 swipe/삭제 동작은 신규 결합 fixture에서 별도로 실행한다.

### 유지 계약

- completionId **한 완료 기록**이 삭제 단위. 두 장소 기록도 한 행/한 ID로 삭제하며 개별 장소로 쪼개지 않는다. UI에서 직접 Supabase delete/가짜 행 삭제 없음.
- 기존 전체 삭제·탈퇴·비밀번호 재인증·동일 requestId 재시도·계정 guard·개인화 invalidation·소유권 proof 기반 진행 정리 계약 유지. DB/API/engine 파일 변경0. guest 삭제 정책 신설0, 서버 삭제와 local_cleanup_pending을 동일 성공으로 취급하지 않는다.
- 정리 대기에서는 결과 안내와 재시도를 유지하며 해당 요청 완료 전 임의 성공/목록 숨김0. 조회가 갱신돼 행이 사라진 경우에도 패널의 같은 요청 다시 확인 행동을 사용할 수 있다. 서비스 호출이 성공 정리 완료를 반환해야 onChanged를 실행한다.

### 검증 결과

- 전용 행 파일 없는 상태에서 실패 선행 확인 후 구현. 수평/세로 판별, full swipe 실행0, 휴지통/접근성 동작, 두 행 중 한 행만 열림, 확인 취소0회/확인창 중복0, 정확한 completionId(두 장소 포함) 삭제, pending→cleaned 같은 requestId, offline→재시도 같은 requestId, 중복 service 요청0을 실행했다.
- 계정 전환 전 만든 확인 callback은 새 계정에서 서비스0회. 마지막 기록 삭제 후 통계 영역0·빈 기록 문구 확인. pending/local·remote·guest_import 합산/조회 격리는 기존 merge/통계 회귀를 유지한다. 실제 map WebView 갱신은 실행하지 않았으며 기록 갱신에 따라 통계/지도에 전달하는 입력이 갱신되는 코드 경계와 기존 회귀를 사용한다.
- 기존 탈퇴 재인증/unknown 실패/다른 진행 코스 불변·cold ownership 삭제 회귀 포함. 원격 서비스는 고정 port이며 운영 계정/기록 삭제0.

### 남은 위험·최소 실기기 확인

- 기록 탭에서 제목 위 간격과 긴 두 장소 제목을 확인한다. 행 하나를 왼쪽으로 밀어 휴지통을 드러낸 뒤 우선 **확인 취소**로 안전하게 체감을 확인한다. 세로 스크롤 때 가로 이동이 과하게 잡히지 않는지, 다음 행을 열면 이전 행이 닫히는지, VoiceOver 삭제가 확인창을 여는지 확인한다.
- 실제 삭제 확인은 사용자가 삭제해도 되는 기록을 별도로 선택할 때만 진행한다. 이번 자동 작업에서 운영 데이터 삭제를 수행하지 않았다. 작은 화면/큰 글씨·실기기 gesture 경쟁·네이티브 map 화면은 미확인이다.
- 이력: 행 번호 기반 하단 중복 행동(계정 기록 화면에서 철회) → 대상 이해 어려움 → 해당 행의 휴지통→기존 확인/서비스(현행) → 삭제 대상을 안정적인 completionId로 명확히 연결하기 위함. 전체 삭제·탈퇴는 철회 대상이 아니다.

## 공통 자동 검증 마감

- `npm run test:typecheck`: 통과.
- `npm run test:ui`:610건 중609통과·기존 skip1·실패0 (`/private/tmp/timefit-handoff-history-ui.log`). 초기 새 icon import에 대한 test host 설정 누락4건은 host stub을 보완한 뒤 재실행했다. 제품 실패로 숨기거나 해당 테스트를 삭제하지 않았다.
- `npm test`:283통과·실패0 (`/private/tmp/timefit-handoff-history-core.log`).
- iOS export: `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-handoff-history-ios` 성공 (`/private/tmp/timefit-handoff-history-export.log`). 헤더 최종 gap 반영 후 재생성도 성공했다. 두 장소 완료 기록 assertion을 보강한 최종 집중 회귀4/4와 typecheck도 통과했다.
- `git diff --check` 통과. Simulator·운영 API/DB·실사용자 삭제·C 재검증·commit/push0. 전체 Date 조작·오류 로그 원문 수집0. 제품 코드 변경은 UIUX 소유 경로만, 문서는 본 문서만 수정했다.
