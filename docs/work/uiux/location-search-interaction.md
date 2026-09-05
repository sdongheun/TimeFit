# U-LOCATION-SEARCH-01 — 위치 검색·키보드·선택 상태 정리

## 최종 사용자 판정 — 2026-09-05

**지정 범위 수락·키보드 시간차는 비차단 잔여사항으로 보류.** 사용자는 보완 후에도 input 재포커스 시 확정 버튼이 키보드보다 늦게 올라오지만 지금 추가 수정하지 않고 진행하기로 결정했다. 시간차가 해결된 것으로 기록하지 않는다. 나머지 수정(지도 하단 검색 제거·노선 별도 줄 제거·결과 구분선)은 사용자 실기기 정상 확인이다. 기존 출발/도착 분리·현위치 확인도 유지한다. 이전의 시간차 native 확인 전 수락 금지는 이 명시적 사용자 결정으로 부분 대체한다. 가림/터치 불가 등 기능 실패가 새로 발생하면 별도로 재검토한다. 제품 코드 변경·테스트 재실행 없이 사용자 결과를 기록했다.

## 최신 실기기 반환 보완 — 2026-09-05 (이 절 우선)

상태: **네 항목 구현·자동 회귀 완료 / 키보드 동기화 체감의 사용자 native 확인 대기**. 기존 완료 기록은 이전 버전의 증거다. 아래 명령은 최초 명령의 하단 검색 대안/노선 줄 유지 부분을 부분 대체한다.

- 사용자 확인: 검색·선택 기능은 정상이나 선택 후 재포커스 시 키보드가 먼저 올라오고 확정 버튼이 늦게 따라온다. 출발/도착 분리와 현위치 주소 흐름은 정상 확인됐다. 이미 통과한 동작을 재설계하지 않는다.
- 수정 전 코드 근거: PlacePicker는 KeyboardAvoidingView와 별도로 keyboardDidShow/DidHide로 footer 하단 여백을 변경했다. 이 두 단계 경로를 fixture로 재현했으며 전체 실기기 지연 원인이 이것 하나라고 단정하지 않는다. 현행은 KAV 없이 하나의 keyboard layout 경계에서 iOS will-frame/show/hide와 시스템 animation 정보를 사용한다. 선택 행 reveal은 측정된 목록 viewport에서 필요한 최소 스크롤만 하며 footer 여백을 수정하지 않는다.
- 변경 이력: 키보드 뒤늦은 footer 보정 → 사용자 지연 관찰 → 키보드와 동일 전환으로 footer 동기화 → 시각적 2단계 이동 제거 목적 → 구현·이벤트 회귀 완료, native 체감 미수락.
- 변경 이력: 지도 하단 검색으로 선택 유지 → 뒤로가기와 동일 귀환의 중복 → 하단 검색 버튼 제거, 뒤로가기로 동일 draft 복원 → 중복 행동 축소 → 구현 현행. 지도 실패/주소 실패도 뒤로가기 검색 대안을 유지한다.
- 변경 이력: 장소명/주소 외 노선 전용 줄 → 장소명에 있는 정보 중복 → 장소명+주소만 표시, 선택됨은 상태 표시로 유지 → 결과 밀도·가독성 향상 → 구현 현행. provider 데이터 자체는 삭제하지 않는다.
- 변경 이력: 미선택 행 경계가 투명 → 버튼인지 인식 어려움 → 결과 사이 얇고 식별 가능한 구분선 → 터치 대상 구분 → 구현 현행. 선택 배경/테두리·누름 반응 유지, 무거운 박스 테두리 중첩 금지.

### UIUX에 전달할 보완 명령

```text
U-LOCATION-SEARCH-01의 최신 실기기 반환 보완을 진행해. 이 절이 과거 하단 검색 대안·노선 줄 유지 명령보다 우선한다. 기존 완료 기록만 보고 생략하지 말고 아래 네 항목을 같은 작업에서 완료해.

1. 선택 후 검색창 재포커스에서 키보드와 확정 footer의 시간차를 제거한다. KeyboardAvoidingView, keyboardDidShow/DidHide 뒤 padding 변경, revealSelection의 layout/scroll 순서를 먼저 조사하고 재현 기록을 남겨. iOS keyboard will-change-frame/show/hide 및 시스템 duration/curve와 기존 RN keyboard layout 동기화 수단을 검토해 한 경계가 이동을 책임지게 해. 기존 KAV와 수동 keyboard 높이를 이중 적용하지 마. 고정 timeout/duration/키보드 높이, input focus 시 임의 높이 추정으로 가리지 마. 선택 상태와 단일 CTA는 유지하며 열림/닫힘/빠른 재포커스/interactive dismissal/keyboard frame 변경에도 뒤늦은 두 번째 점프가 없어야 한다. footer safe area도 같은 전환에서 보정한다. 새 native 의존성/설정은 승인 없이 추가하지 않는다. mock은 이벤트 순서 검증일 뿐 실제 동기화 체감은 native 확인 대상으로 분리한다.

2. MapPlacePicker 하단 검색으로 선택 버튼을 제거한다. 상단 검색 버튼도 계속 없어야 한다. 지도 뒤로가기는 같은 편집의 검색어·결과·선택·목록 위치를 복원한다. 최종 picker 닫기와 혼동하지 마. 지도 로딩 실패/주소 실패 안내는 제거된 버튼을 요구하지 않도록 뒤로가서 검색할 수 있다는 문구로 맞춘다. 재시도·좌표 확정·명시 확정 및 pending 주소 guard는 유지한다. onSearch prop/callback/testID는 모든 호출부 검색 후 실제 불필요한 것만 제거하고 QA 소유 테스트 수정이 필요하면 인계해.

3. 결과의 장소명·주소만 정보로 표시하고 별도의 1호선·2호선 등 providerLineLabels 줄/장식 배지는 제거한다. 장소명에 들어 있는 노선명은 임의로 지우지 마. 선택됨 상태와 accessibilityState.selected는 유지한다. VoiceOver도 장소명에 이미 포함된 같은 노선을 반복해서 읽지 않게 한다. 원본 provider 데이터/검색 순위/검색 결과 identity는 변경하지 않는다.

4. 결과와 결과 사이에 얇은 구분선을 둔다. 다크 배경에서 식별 가능하되 장소명보다 강조하지 마. 마지막 결과 아래 불필요한 중복선은 피한다. 기존 행 전체 Pressable/최소44pt/누름 애니메이션·선택 상태를 유지하고 일반 햅틱은 추가하지 않는다. 큰 글씨의 줄바꿈·주소 읽기·화면 폭을 보존한다.

변경 전 실패 fixture를 추가한다: keyboard 종료 후 추가 footer 보정 없음/동기화 이벤트 및 빠른 전환; 지도 상하 검색 버튼0/뒤로가기 draft 복원/실패 안내; 노선 별도 줄0/장소명·주소·선택 상태 보존; 결과 간 구분선·터치 영역. 기존 검색/출발도착 분리/현위치/확정 연타/stale GPS·주소/통합 입력 회귀도 실행해. 실제 외부 API/DB/GPS 자동 호출과 Simulator 수동 순회는0. 제품 변경 범위는 기존 UIUX 소유 파일과 UI 테스트이며 엔진/API/DB/env/통합 화면 배치/개발 버튼은 불변이다.

집중 location-search 및 unified-time-route-setup 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check, iOS export를 실행한다. 제거한 UI만 기대값을 현행화하고 테스트 삭제/skip으로 회귀를 숨기지 마. 실패 시 원인/소유 경계를 인계한다.

이 문서 상단 현행 규칙도 이번 결정에 맞춰 갱신하고 이전 방식은 이력으로 남겨. 변경 파일/유지 계약/실패 선행·최종 테스트 수치와 로그/남은 native 확인을 기록한다. 키보드 체감은 사용자에게 선택→재포커스→키보드 닫기를 짧은 화면 녹화 1회 또는 직접 확인으로 요청하고 자동 테스트만으로 시간차 해결을 수락하지 마. 나머지 정상 확인 항목의 전면 반복 검사는 요구하지 않는다. 중앙 문서·보드·타 역할 코드를 수정하거나 커밋하지 마.
```

상태: **2026-09-05 구현·자동 회귀 완료 / QA·사용자 native keyboard smoke 대기**

## 목적과 근거

사용자 관찰: 자동 검색 결과를 선택해도 키보드가 남아 확정하기 어렵고, 돋보기를 누르면 선택이 해제된다. 출발지 검색 상태가 도착지에 남으며 검색 중 지도 버튼이 사라진다.

착수 전 코드 근거(과거): PlacePicker 결과 onPress는 setSel만 수행했다. onSubmitEditing과 검색 버튼은 search를 호출하고 매번 선택을 초기화했다. 지도 버튼은 !q.trim() 조건부였으며 visible/필드 변경 초기화가 없었다. 이 방식은 아래 구현 및 반환 보완으로 대체됐다.

관계: 기존 위치 선택 계약·U-SETUP-UNIFIED-01 보완. 추천 결과 장소 상세 B의 선택 UX와는 별개인 **출발/도착 위치 picker** 작업이다.

## 확정 동작 — 추가 수정 포함 현행

아래 규칙은 최신 실기기 반환까지 합친 현재 기준이다. 하단 완료 기록의 과거 표기·기기 카드·공통 지도 header·하단 검색 버튼·노선 전용 줄은 이력이며 복원하지 않는다.

1. 2글자/400ms 자동 검색 유지. 결과 선택은 키보드를 닫고 후보 선택만 한다. 명시 확정 버튼만 부모 입력에 적용한다. 미선택 시 확정 버튼은 숨기고 목록 안내를 둔다.
2. 키보드 돋보기/화면 검색은 키보드를 닫는다. 동일 검색어의 성공 결과/선택을 유지하고 불필요한 재검색을 하지 않는다. 같은 검색이 진행 중이면 중복 요청하지 않는다. 실패한 같은 검색은 명시 재시도 가능하다. 실제 검색어 수정만 선택을 해제한다. 포커스만으로 해제하지 않는다.
3. 선택 상태에서 검색창을 다시 열면 동일 확정 버튼이 키보드와 같은 전환으로 위로 이동한다. iOS will-change-frame/show/hide에서 실제 겹침량과 footer safe area를 함께 갱신하고 `Keyboard.scheduleLayoutAnimation`에 시스템 duration/easing을 전달한다. KAV·수동 키보드 높이의 이중 적용이나 did-show/hide 종료 후 추가 여백 보정은 하지 않는다. 키보드가 없으면 safe area 위 하단에 둔다. 미선택 CTA는 숨기고, 선택 행은 실측 viewport에 필요한 최소 스크롤만 허용한다. 실제 동기화 체감은 native 확인 전까지 미수락이다.
4. 새 출발/도착 편집 진입은 빈 검색 draft로 시작한다. 이미 부모에 확정한 좌표/라벨은 초기화하지 않는다. 같은 편집 중 검색→지도→취소/검색 복귀는 검색어·결과·임시 선택·목록 위치를 복원한다. 지도 취소는 검색으로, 검색창 최종 닫기는 통합 입력으로 돌아간다. 지도 확정은 기존 확정 경로로 적용하고 편집을 종료한다. 다른 필드 진입/편집 종료 뒤 이전 draft와 비동기 응답은 폐기한다.
5. 검색창 아래 동일 너비 `현위치` / `지도에서 선택` 두 버튼을 항상 가로로 표시한다. 검색/결과/선택 상태와 무관하며 키보드가 열린 상태에서도 접근할 수 있다. 현위치는 키보드를 닫고 조회 중 상태를 보이며, GPS 성공 뒤 기존 공유 주소 adapter의 **도로명 우선 주소를 input에 표시**한다. 도로명 없음은 기존 지번/지역명 fallback, 주소 조회 실패는 `현위치`와 안내를 제공한다. input 아래 기기 주소 카드는 표시하지 않는다. 좌표는 임시 선택으로 유지하고 명시 확정만 부모에 적용한다. 주소 자동 채움은 장소 재검색을 유발하지 않으며 늦은 주소도 session/request guard로 차단한다. 권한 거절/GPS 실패는 검색·지도 대안을 막지 않는다.
6. 다크/파랑 유지. 결과 정보는 장소명과 읽기 쉬운 보조색 주소만 표시하며 별도 providerLineLabels 줄/배지는 제거한다. 장소명에 포함된 노선명은 보존하고 VoiceOver에서 별도 노선 정보를 반복하지 않는다. provider 원본·검색 순위·후보 identity는 불변이다. 검색 결과 행의 선택은 은은한 파란 배경/테두리와 선택됨 텍스트 및 accessibilityState.selected로 표시한다. 결과 사이에는 얇은 구분선 하나를 두되 마지막 행 아래는 생략한다. 무거운 박스 중첩·기기 주소 카드·일반 햅틱을 추가하지 않는다. 행 전체 누름 애니메이션·최소44pt·큰 글씨 줄바꿈을 유지한다.
7. 지도 상단 우측 및 하단 검색 버튼은 모두 표시하지 않는다. 뒤로가기와 중앙 `출발지 선택`/`도착지 선택` 제목은 **서로 독립된 박스**로 두고 전체를 하나의 배경으로 묶지 않는다. 제목 자체의 불투명 다크 배경으로 밝은 지도 위 대비를 유지한다. 뒤로가기가 동일 편집의 검색 draft를 복원하며 지도/주소 실패 안내도 `뒤로가서 검색`으로 맞춘다. 재시도·좌표 확정·명시 확정과 pending 주소 guard는 유지한다.

## 최초 작업 명령 — 이력 (최신 실기기 반환 절이 우선)

```text
U-LOCATION-SEARCH-01을 진행해. AGENTS.md, docs/README.md, docs/work/uiux/README.md, 이 문서와 U-SETUP-UNIFIED-01 최종 인수인계, 공통 규칙/테스트명세의 위치 선택 및 이번 확정 절을 읽어. 오래된 route-setup/time sheet를 복구하지 마.

먼저 실제 PlacePicker와 TimeSetup의 mount/visible/target/지도 전환 lifecycle을 조사하고 위 사용자 재현을 production handler fixture로 실패시켜. 단순 Keyboard.dismiss 추가로 끝내지 말고 검색 상태와 편집 세션 경계를 분리해.

상태는 부모에 확정한 위치와 일시적인 편집 draft를 분리한다. draft는 editing session/target에 귀속되며 같은 세션의 지도 왕복에서만 유지된다. 새 target 또는 최종 닫기에서는 초기화한다. 검색/GPS/지도 주소 응답은 세션·target·request identity를 확인하고 오래된 결과를 무시한다. 검색 시작 당시의 배열 index만으로 새 응답의 다른 장소가 선택되지 않게 안정적인 후보 identity를 사용한다. pending debounce/진행 중 요청이 선택 후 결과를 교체하거나 중복 검색하지 않도록 한다. 닫힌 picker의 늦은 응답은 다음 편집에 적용하지 마.

키보드 submit·화면 검색·자동 debounce의 동작을 구분하되 같은 검색 실행 경계를 재사용한다. 자동 검색은 키보드를 닫지 않고 명시 검색은 닫는다. 동일 query 성공/진행 중/실패 상태별 유지·중복 방지·재시도를 구현한다. 확정은 연타해도 부모에 한 번만 전달한다.

키보드-aware footer는 선택 시 하나만 렌더하고 실제 키보드/safe area를 반영한다. 고정 키보드 높이나 footer 이중 offset을 쓰지 않는다. UI 기존 의존성으로 구현 가능 여부를 먼저 확인하고 새 native 라이브러리 도입은 승인 없이 하지 마. 미선택 목록은 버튼 공백을 상시 예약하지 않는다. 선택 행 가시성·목록 위치를 지키되 필요할 때 최소 스크롤만 허용한다. 현위치/지도 50:50 보조 행동은 검색 중에도 유지한다. 긴 텍스트/큰 글씨에서 잘라 조작불가로 만들지 마.

사용자 추가 수정도 같은 작업에 포함한다. 현위치 조회 후 도로명 우선 주소를 input에 채우고 중복 기기 주소 카드는 만들지 마. 기존 주소 fallback·명시 확정·stale 차단을 유지하고 programmatic 주소 채움으로 장소 검색을 호출하지 마. 지도 상단 우측 검색을 제거하고 뒤로가기/제목은 독립 배경으로 분리해. 제목 자체의 다크 대비와 하단 검색 대안·지도 취소 복원을 유지해.

소유 범위는 PlacePicker, 필요한 TimeSetup picker 연결, MapPlacePicker의 취소/검색 복귀 연결, UI 전용 순수 상태/표시 모듈 및 UI 테스트다. 공개 Props 변경 시 모든 호출부를 검색해 같은 변경에서 호환시켜. 통합 입력 일반 영역의 수락된 무스크롤 배치·개발 버튼·시간 휠·slider는 변경하지 마. 추천 엔진/API adapter·검색 provider/TTL/2글자400ms·DB·카탈로그·권한 정책·Results/장소상세 B·코스진행·App/nav·Live Activity·env는 변경하지 않는다. 지도 라벨 adapter와 기존 request guard를 중복 재구현하지 말고 보완한다.

필수 fixture는 실제 production handler/production-used model로 검증한다:
- 자동 검색→결과 선택: 선택 유지, dismiss1, 확정 전 부모 호출0, 확정1.
- 미선택 submit: 키보드 닫기·첫 결과 자동선택0·CTA 없음.
- 선택 후 같은 query 검색/포커스: 선택 보존·추가 provider0, 편집 시 해제.
- 동일 query 진행 중 중복0·실패 재시도 가능·늦은 검색/빠른 입력/stale 응답 무시.
- 출발 확정→도착 열기: 빈 draft/출발 확정값 유지. 닫기·재열기·빠른 target 전환 교차 오염0.
- 같은 target 검색→지도→취소/검색 복귀: draft/선택/목록 위치 복원, 늦은 주소 무시. 지도 확정은1회.
- GPS 성공은 임시 선택, 거절/실패는 대안 유지. GPS 대기 중 검색/지도/target 변경 뒤 늦은 GPS 덮어쓰기0.
- 현위치 도로명 우선 input·주소 fallback·늦은 주소 차단, 자동 채움 후 검색0/확정 전 부모0, 기기 주소 카드0.
- 지도 상단 검색0·뒤로/제목 독립 배경·밝은 지도 대비, 하단 검색 대안 유지.
- 선택/미선택×키보드 열림/닫힘 footer 계약, 큰 글씨/짧은 viewport, 가로 보조 버튼 항상 존재, 접근성 선택 상태.
- 편집만으로 추천/저장/코스취소0. 기존 통합 입력26개 및 지도 계약 회귀 유지.

기존 충분한 테스트는 재사용한다. 과거 항상 보이는 비활성 CTA/조건부 지도 버튼 assertion만 현행 기대값으로 교체하고 skip/삭제로 통과시키지 마. QA 소유 테스트 변경이 필요하면 인계한다. 집중 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check 및 iOS export를 실행해. 실제 운영 API/GPS/DB 및 Simulator 버튼 순회는0. mock keyboard/style 테스트를 native 키보드 검증으로 보고하지 마.

완료는 변경 파일·목적 / 유지 계약 / 실패 선행과 최종 테스트 수치·명령·로그 / 다음 QA·native 위험 네 항목으로 이 파일에 기록해. 동일 기능의 별도 work 이름을 늘리지 마. 중앙 문서·보드·다른 세션 수정분을 변경하거나 commit/push하지 마. 마지막 사용자 확인은 실제 키보드 열림→선택→닫힘→재포커스→확정, 출발/도착 분리, 지도 왕복을 한 번의 짧은 smoke로 묶어 인계해.
```

## 이력·실행 순서

기존 선택 후 키보드 유지·재검색마다 해제·target 간 draft 공유·검색 중 지도 숨김 → 사용자 확정/재검색 혼란 → 위 6개 확정 규칙 → 일관된 검색/임시선택/명시확정 → **사용자 승인·구현 전**. 이전 무조건 동일 query 재검색/항상 비활성 CTA/지도 조건부 숨김은 철회다. 같은 target 지도 취소 복원은 전체 picker 닫기와 구분한다.

UIUX 단일 작성자가 구현 후 QA로 인계한다. TimeSetup/PlacePicker/MapPlacePicker를 다른 세션이 동시에 수정하지 않는다. 별도 엔진·DB 작업은 해당 파일/계약을 건드리지 않는 경우 병렬 가능하다.

## 완료 인수인계 — 2026-09-05 / U-LOCATION-SEARCH-01

### 1. 변경 파일·목적

- `src/ui/locationSearchDraft.ts` 추가: 확정된 부모 좌표와 별개인 편집 세션/target/epoch 및 검색·GPS request identity. 빈 draft 시작, 종료 폐기, 지도 pause/resume, 동일 query 성공/진행 중 중복0·실패 명시 재시도, 배열 index 대신 후보 identity 선택, 1회 확정 claim, 목록 offset과 선택 행 최소 스크롤 계산을 분리했다. 외부 provider cache나 저장소를 새로 만들지 않았다.
- `src/ui/PlacePicker.tsx`: 실제 검색/명시 submit/자동 debounce/GPS handler를 같은 draft 경계에 연결했다. 자동 검색은 키보드를 유지하고, 결과 선택·명시 검색·현재위치·지도 행동은 키보드를 닫는다. 선택 전 확정 CTA/빈 footer가 없고, 선택 때만 동일 CTA 하나를 렌더한다. 항상 가로 50:50 현재위치/지도, 주소 보조색·provider 노선·은은한 파란 선택 배경/테두리·선택됨 및 accessibilityState.selected를 적용했다. 일반 haptic은 추가하지 않았다.
- 키보드는 설치된 React Native의 `KeyboardAvoidingView` 구현을 확인해 재사용했다. 실제 keyboard frame 대비 겹침량 처리는 KAV에 맡기고, footer는 키보드 닫힘 시 safe-bottom·열림 시 내부 여백만 적용한다. 고정 keyboard 높이/추가 keyboard inset을 사용하지 않는다. 검색·결과는 스크롤 가능한 영역에 있고 CTA는 그 바깥에 둔다. 긴 장소명/주소/CTA에 1줄 잘림 제한을 두지 않았다. 행/버튼 최소44pt, CTA52pt를 유지한다.
- `src/ui/TimeSetupScreen.tsx`: optional `editingSession` Props의 유일한 실제 호출부를 연결했다(전체 TSX 참조 검색). 새 필드 열기만 draft.start, 최종 닫기/확정/이탈은 end, 지도 취소·검색 복귀는 resume. 기존 pickerRequest guard와 함께 늦은 주소를 차단한다. **일반 영역의 viewport 배치·개발 영역·휠·slider·하단 CTA의 JSX/style은 변경하지 않았다.**
- `src/ui/MapPlacePicker.tsx`: 기존 confirmVersion/pointVersion을 보완해 닫기·검색 복귀·visible/center 변경에서 pending 주소를 무효화하고, 동기 lock/terminal 확인으로 같은 tick과 닫힌 지도에서 늦게 전달된 확정 이벤트의 추가 조회를 막았다. adapter rejection은 기존 좌표/검색 대안으로 표시한다.
- `test/ui/location-search-interaction.test.mjs` 추가, `test/ui/unified-time-route-setup.test.mjs`에 실제 부모+선택기 연결 2개 추가, `test/ui/support/screenRuntime.mjs`에 native mock 표면 추가. `test/map-transport-ui-contract.test.mjs`의 index 선택 초기화 문자열 단언은 production-used identity draft 단언으로 교체했다. 기존 테스트 삭제/skip 추가0.
- 이 작업 문서만 완료 인계. 중앙 문서·보드 및 다른 세션 변경은 수정/복원하지 않았다.

이력: 선택 후 키보드 잔류·무조건 재검색/선택 해제·필드 간 draft 공유·항상 비활성 CTA·조건부 지도 → 최초 실패 fixture 및 사용자 관찰 → session별 검색/임시선택/명시확정과 조건부 keyboard-aware footer·상시 보조 행동 → 부모 확정값 보존과 선택·확정 혼란 방지 → **구현 현행**. 지도 확정 중/종료 뒤 지연 이벤트 추가 주소 조회 → request guard에 동기 lock과 terminal 유지 보완 → 확정 및 adapter 호출 중복 방지 → **구현 현행**. 이전 방식은 위 본문 이력으로 보존하며 다시 실행 기준으로 사용하지 않는다.

### 2. 유지한 계약

- 2글자/400ms 자동 검색, Kakao 단일 검색 adapter/provider/fallback/TTL, 명시 현재위치에서만 권한 요청, GPS 성공도 임시 선택 후 확정. 새 세션/입력 수정/지도 전환으로 이전 검색·GPS 응답을 무효화한다.
- 명시 부모 확정 전 입력/지도 편집의 추천·저장·진행 코스 취소0. TimeSetup의 origin/devicePoint 구분, 목적지 null 복귀, 120분·여유·Auth/CAPTCHA·추천 session/호출 예산 계약 불변.
- 같은 편집의 지도 왕복만 query/결과/선택/목록 위치 유지. 출발 확정→도착 열기, 최종 닫기→재열기는 빈 draft이며 부모 출발지는 보존한다.
- App/nav/Results/장소상세 B/진행/Live Activity, 엔진·API adapter·DB·카탈로그·env·native 의존성 변경0. 일반 입력 무스크롤/개발 버튼 배치 보완을 되돌리지 않았다. stage/commit/push0.

### 3. 실패 선행·최종 테스트 결과

- 최초 production PlacePicker fixture **0 pass / 2 fail**: 자동 검색 결과 선택 시 dismiss0, 미선택 confirm CTA1 재현. `/private/tmp/timefit-location-first.log`.
- 추가 지도 terminal fixture **27 pass / 1 fail**: 닫힌 지도에 남은 확정 callback을 실행했을 때 label adapter가 2→3회 호출됨을 재현 후 수정. `/private/tmp/timefit-location-map-terminal-first.log`.
- 집중 `node --test test/ui/location-search-interaction.test.mjs test/ui/unified-time-route-setup.test.mjs`: **44/44 pass**(검색16 + 기존 통합26 + 부모/지도 연결2). `/private/tmp/timefit-location-focused.log`.
  - 자동 검색/명시 submit/동일 query·포커스·실제 수정, 399/400ms, 진행 중 중복·실패 throw/응답 재시도·빈 성공·빠른 query 교체와 stale 결과를 실행했다.
  - GPS 성공 임시선택/거절/실패, GPS 대기 중 편집·지도·새 target·명시 검색으로 늦은 좌표 차단. 부모 target별 draft 분리와 검색↔지도 취소/복귀의 임시 선택·170pt 목록 offset 복원, 지도 확정 adapter 중복0·늦은 주소/종료 이벤트 차단을 실행했다.
  - 선택/미선택×keyboard show/hide의 CTA 개수0/1, KAV 설정과 safe-bottom 전환, 측정 viewport 축소 시 필요한 250pt 이동만 발생하고 같은 layout/키보드 닫힘은 추가 점프0을 검증했다. 큰 행/짧은 viewport 최소 스크롤, 긴 텍스트 잘림 제한 없음, 50:50 보조 행동·44pt/선택 상태/노선 VoiceOver 라벨도 확인했다.
- `npm run test:typecheck`: **pass**. `/private/tmp/timefit-location-types.log`.
- `npm run test:ui`: **370 pass / fail0 / 기존 skip1**, 총371. skip은 기존 철회 이력 테스트 그대로다. `/private/tmp/timefit-location-ui.log`.
- `npm test`: **179/179 pass**. `/private/tmp/timefit-location-all.log`.
- `node --test test/map-transport-ui-contract.test.mjs`: **14/14 pass**. `/private/tmp/timefit-location-map.log`.
- `git diff --check`: **pass**.
- iOS export **pass**, `npx expo export --platform ios --output-dir /private/tmp/timefit-location-ios`. Hermes bundle 생성, 로그 `/private/tmp/timefit-location-ios.log`.
- 실제 운영 API/GPS/DB·Simulator 순회0. fixture fetch는 호출 즉시 실패하도록 교체하고 종료 시0을 확인했으며 검색/GPS/주소는 fake adapter 호출로만 계측했다. mock keyboard/style/frame 테스트는 native 키보드 검증을 대체하지 않는다.

주요 entry/testID: `route-origin-field`, `route-destination-field`, `location-search-input`, `location-search-submit`, `location-alternatives`, `location-current`, `location-map`, `location-suggestion-*`, `device-location-selection`, `location-results`, `location-keyboard-layout`, `location-footer`, `location-confirm`, `location-close`, 기존 `map-confirm`/`map-search-alternative`/`map-coordinate-confirm`.

### 4. 다음 QA·native 위험

- QA 자동 게이트 후 사용자 smoke 한 번: 출발 검색 열기→400ms 결과→행 선택(키보드 닫힘/부모 미적용)→재포커스(선택/단일 확정 CTA 유지·키보드 위)→동일 검색(선택 유지)→확정→도착 열기(빈 draft/출발값 보존)→검색·선택·목록 스크롤→지도→취소/검색 복귀(같은 draft/목록)→최종 닫기. 지도 확정·GPS 거절 대안도 같은 짧은 흐름에서 확인한다.
- 실제 iOS keyboard 애니메이션/interactive dismiss, safe area·선택 행 가시성·목록 offset, 큰 글씨와 짧은 viewport의 검색창/보조 행동/CTA 접근성은 실기기 수락 전 항목이다. 특히 지도 modal 왕복의 native focus 및 키보드 frame 이벤트는 mock으로 수락하지 않는다.
- 기존 통합 입력의 일반 영역/개발 버튼 배치는 회귀26개를 보존해 검증했다. 새 라이브러리 설치나 native 설정 변경 없이 실행했으며 실기기 설치/실제 API 검증은 수행하지 않았다.

## 사용자 반환 보완 — 현위치 주소·지도 제목 대비 / 2026-09-05

### 1. 변경 파일·목적

- `PlacePicker.tsx`: 보조 버튼을 `현재위치`→`현위치`로 변경. 명시 GPS 성공 뒤 기존 공유 label adapter로 도로명 우선 주소를 받아 input과 기기 위치 임시 선택에 표시한다. 주소를 채우는 것만으로 검색/부모 확정을 실행하지 않는다. `TimeSetupScreen.tsx`는 기존 GPS/지도 label adapter를 optional prop으로 전달하며 일반 입력 배치는 불변이다.
- `locationSearchDraft.ts`: 주소를 programmatic query와 선택 label로 함께 적용하고 동일 query 자동/명시 재검색을 방지한다. 늦은 주소도 기존 GPS request identity 검사 대상이며, 입력 수정/지도 전환/종료 뒤 덮어쓰지 않는다.
- `MapPlacePicker.tsx`: 지도 상단 중앙 흰 제목 뒤에 불투명 다크 header panel을 제공한다. 밝은 지도 타일과 무관한 대비를 확보하고 minHeight를 사용해 제목 줄바꿈을 허용한다.
- `test/ui/location-search-interaction.test.mjs`: 주소 채움/검색0·확정 전 부모0, 주소 stale/실패 fallback, 지도 header 대비 fixture 추가. 이 문서에 같은 ID 인계.

이력: 현위치 좌표만 임시 선택되어 input이 비어 있음·흰 제목이 밝은 지도에 묻힘 → 사용자 관찰 → 도로명 우선 기존 주소 경계 재사용·독립 다크 header 배경 → 입력값 확인과 지도 제목 가독성 확보 → **구현·자동 검증 완료**.

### 2. 유지한 계약

도로명 우선 처리는 기존 `kakaoReverseGeocodeResult`의 `road_address.address_name` 우선순위를 읽어 확인했으며 API adapter/엔진은 수정하지 않았다. 도로명 없음은 기존 지번/지역명 fallback, 조회 전체 실패는 `현위치`와 안내를 표시하고 좌표 확정/검색·지도 대안을 유지한다. 실제 조회 없이 도로명 주소를 만들어 넣지 않는다. 명시 확정·device source·권한 정책·검색 provider/TTL·통합 배치·개발 버튼·추천/저장 계약 불변, 보드/중앙 문서 및 다른 세션 수정분 변경0, commit/push0.

### 3. 테스트 결과

- 실패 선행 16 pass/2 fail: `현위치` 표기·주소 input 및 대비 header 부재 재현. `/private/tmp/timefit-location-address-first.log`.
- 집중 **47/47**, UI **373 pass/0 fail/기존 skip1**, 전체 **182/182**, map transport **14/14**, typecheck/diff check **pass**.
- iOS export **pass**, `/private/tmp/timefit-location-address-ios`. 로그 `/private/tmp/timefit-location-address-{focused,types,ui,all,map,ios}.log`.
- fake GPS/label만 실행, 실제 API/GPS/DB/Simulator 호출0. native 캡처를 수행한 것으로 보고하지 않는다.

### 4. 다음 확인·위험

실기기에서 현위치→도로명 input→명시 확정, 주소 조회 중 입력 수정, 주소 없는 위치의 fallback을 확인한다. 지도 밝은 타일에서 중앙 제목/뒤로/검색 대비와 큰 글씨를 기존 검색 smoke에 함께 확인한다. 도로명 자체가 없는 좌표에서는 지번·지역명 또는 현위치 안내가 표시될 수 있다.

## 사용자 반환 보완 — 중복 기기 카드 제거·지도 상단 분리 / 2026-09-05

1. **변경 파일·목적:** `PlacePicker.tsx`에서 input 아래 기기 주소 카드를 제거했다. 주소 input과 명시 확정은 유지한다. `MapPlacePicker.tsx`는 상단 우측 검색 버튼과 전체 묶음 배경을 제거하고 뒤로가기/제목에 독립 배경을 제공한다. 제목의 다크 대비는 유지하며 반대쪽 비시각 spacer로 중앙 정렬한다. `test/ui/location-search-interaction.test.mjs`, `test/map-transport-ui-contract.test.mjs`는 카드 비노출·입력 주소/좌표 source·독립 제목 배경·상단 행동1개·하단 검색 대안을 검증한다.
2. **유지 계약:** 현위치 주소 조회/임시 선택·명시 확정·stale 응답, 검색 draft와 지도 취소/검색 복귀, 하단 검색 대안, 통합 입력 배치/개발 버튼, API/엔진/DB 정책 불변. 보드/중앙 문서·다른 세션 변경은 수정하지 않았고 commit/push0.
3. **테스트:** 선행 17 pass/2 fail(기기 카드 존재·공통 header 배경 재현), 최종 집중47/47·UI373 pass/기존 skip1·전체182/182·지도계약14/14·typecheck/diff check pass. iOS export pass(`/private/tmp/timefit-location-simplify-ios`). 로그 `/private/tmp/timefit-location-simplify-{first,focused,types,ui,all,map,ios}.log`.
4. **다음 확인·위험:** 실기기에서 input 주소→확정과 지도 뒤로가기/중앙 제목의 분리·밝은 지도 대비를 확인한다. 실제 API/GPS/DB/Simulator 실행0. 기존 기기 주소 카드 및 상단 공통 배경/우측 검색 방식 → 사용자 중복·묶음 제거 요청 → input 단일 표시·상단 독립 컨트롤 → 정보 중복 축소·제목 대비 유지 → **구현 현행**. 이전 기록은 이력으로 유지한다.

## 추가 수정의 현행 기준 반영 — 2026-09-05

1. **변경 파일:** 이 문서의 확정 동작·복사할 작업 명령·필수 fixture에 현위치 주소 input, 기기 카드 제거, 지도 상단 검색 제거·독립 박스를 통합했다. 반환 보완 하단에만 남아 최초 명령과 다르게 읽힐 수 있던 문제를 해소했다. 상태는 구현 현행이며 과거 구현 설명은 이력으로 보존한다.
2. **유지 계약:** 제품 코드·보드·중앙 문서 변경0. 기존 주소 fallback/명시 확정/검색·지도 복원·통합 입력 배치 불변.
3. **검증:** 문서 변경만 수행하고 `git diff --check` 통과. 제품 테스트는 재실행하지 않았으며 직전 기록의 집중47/47·UI373 pass/기존 skip1·전체182/182·지도14/14·iOS export 통과를 그대로 유지한다.
4. **다음 확인:** QA와 사용자 실기기 smoke는 이 문서 상단의 추가 수정 포함 현행 규칙을 사용한다. 과거 `device-location-selection` 카드·상단 우측 검색·공통 header 배경을 복원하지 않는다.

## 최신 실기기 반환 네 항목 완료 인수인계 — 2026-09-05

### 1. 변경 파일·재현 근거

- `src/ui/locationKeyboardLayout.tsx` 추가, `PlacePicker.tsx` 연결: KAV와 did-show/hide footer 보정을 제거했다. full-screen Modal의 실제 root frame과 keyboard end frame으로 겹침량을 계산하고, **같은 iOS will-change-frame/show/hide callback에서 root padding과 footer safe padding을 함께 변경**한다. `Keyboard.scheduleLayoutAnimation(event)`에 원본 시스템 duration/easing을 전달한다. 고정 timeout/duration/키보드 높이·포커스 추정·새 native 의존성 없음. 동일 geometry 이벤트는 무시하고 hidden picker의 늦은 이벤트는 cleanup identity로 차단한다. Android는 해당 플랫폼의 did 이벤트를 같은 단일 경계로 처리하며 iOS 종료 이벤트는 구독하지 않는다.
- 순서 조사: 수정 전 `KAV keyboardWillShow→KAV 이동→keyboardDidShow→footer padding 16→8→목록 viewport 재측정/reveal` 경로가 있었다. fixture에서 will-frame 동기화 구독 부재와 이전 did-event footer 보정을 확인했다. 수정 후 `will event→시스템 layout animation 예약→겹침량+safe padding 원자적 갱신→목록 실측 최소 reveal`이다. reveal은 footer 높이/여백을 바꾸지 않는다. **이 코드 경로가 전체 실기기 지연의 유일한 원인이라고 주장하지 않는다.**
- `src/ui/MapPlacePicker.tsx`: 하단 검색 버튼/`onSearch` Props 제거, 지도·주소 실패 문구를 `뒤로가서 검색`으로 변경. `TimeSetupScreen.tsx`의 유일한 실제 호출부도 `onClose`만 연결했다. 기존 뒤로가기 동일 draft 복원, 재시도·좌표 확정·1회 확정·pending guard는 유지한다.
- `src/ui/PlacePicker.tsx`: providerLineLabels 전용 Text/VoiceOver 덧붙임 제거. 장소명·주소·선택됨은 유지하며 행 사이에만 1pt 보조 구분선을 둔다. Fragment를 사용해 행 좌표의 추가 부모 wrapper를 만들지 않았다. 검색 provider 원본·identity는 변경하지 않았다.
- UI 테스트 `location-search-interaction.test.mjs`, `unified-time-route-setup.test.mjs`, `support/screenRuntime.mjs`와 화면 계약 `test/map-transport-ui-contract.test.mjs`를 현행 이벤트·뒤로가기·노선 줄 비노출 기대값으로 갱신했다. 테스트 삭제/skip 추가0. 이 문서의 상단 현행 규칙을 갱신하고 최초 하단 검색 유지 명령은 이력으로 명시했다.

### 2. 유지한 계약

정상 확인된 검색·선택/동일 query 재검색 방지·출발/도착 분리·현위치 도로명 input·명시 확정·stale GPS/주소를 유지했다. 일반 입력 viewport 배치/개발 버튼/시간 휠/slider·API/DB/엔진/provider 데이터·검색 순위/identity·env·native 설정 불변. 일반 햅틱 추가0, 실제 API/GPS/DB/Simulator 순회0, 보드/중앙 문서·타 역할 코드 변경0, commit/push0.

### 3. 실패 선행·최종 검증

- 실패 선행: **18 pass/3 fail**. will-frame 동기화 부재, 노선 전용 Text 추가, 하단 검색 버튼 잔류를 production handler fixture로 재현했다. `/private/tmp/timefit-location-latest-first.log`.
- 집중 `node --test test/ui/location-search-interaction.test.mjs test/ui/unified-time-route-setup.test.mjs`: **51/51 pass**. will-frame/show 중복1회, hide→빠른 refocus→늦은 didHide 무시, duration0 interactive frame, 숨은 picker stale event, 단일 CTA/safe area, 실측 최소 스크롤과 did 종료 후 추가 보정0을 확인했다. 지도 상하 검색0·뒤로 복원·지도/주소 실패 문구·좌표 확정1, 노선 Text0/장소명 내 노선 보존/VoiceOver 중복0, 결과 간 선1/마지막 선0·44pt·선택 상태를 확인했다. 기존 통합26개를 보존했다.
- `npm run test:typecheck`: **pass**. `npm run test:ui`: **377 pass/0 fail/기존 skip1**(총378). `npm test`: **186/186 pass**. `node --test test/map-transport-ui-contract.test.mjs`: **14/14 pass**. `git diff --check`: **pass**.
- iOS export **pass**, `npx expo export --platform ios --output-dir /private/tmp/timefit-location-latest-ios`. 로그 `/private/tmp/timefit-location-latest-{focused,types,ui,all,map,ios}.log`.
- 이벤트 fixture는 keyboardWillChangeFrame에 screenY544/height300/duration237을 주입해 이동량300과 footer8이 함께 갱신됨을 확인했다. 이는 **native 프레임 타이밍·실제 애니메이션 체감 검증이 아니다**.

### 4. 남은 native 확인

사용자에게 **검색 결과 선택→input 재포커스→키보드 닫기**만 짧은 화면 녹화1회 또는 직접 확인을 요청한다. 키보드와 확정 footer가 같은 전환으로 움직이고 끝난 뒤 두 번째 점프가 없는지 확인받기 전에는 시간차 해결을 최종 수락하지 않는다. 이미 정상 확인된 출발/도착 분리와 현위치 주소 등 전체 smoke 재실행은 요구하지 않는다. 지도/노선/구분선 보완은 자동 검증 완료이며 native 녹화 중 보이는 범위에서 확인할 수 있다.
