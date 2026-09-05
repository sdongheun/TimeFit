# U-SETUP-UNIFIED-01 — 출발·도착·시간 통합 입력

상태: **2026-09-05 UIUX 구현·자동 검증 완료 / QA 자동 게이트·사용자 실기기 smoke 대기**

## 결정 게이트

- 부모: 출시 UIUX 체크리스트 C의 `경로와 시간의 한 화면 병합`, REC-01/18의 120분·도착 여유, 공통 규칙 3-2의 위치 선택 계약.
- Q-SETUP-01 확정: 출발지(현재 위치 포함)·목적지 버튼, 상시 노출 도착 시간 휠, 남길 시간 slider, 하단 할 일 찾기를 같은 화면에 배치한다. 지도/검색은 위치 버튼을 누를 때만 기존 선택기로 연다.
- 개발 테스트 시각·출시 추천 QA 버튼은 삭제하거나 기능을 끄지 않는다. 이 두 버튼이 없는 일반 사용자 영역을 기준으로 기본 글자 크기의 세로 화면에서 본문 스크롤 없이 다섯 요소가 보이도록 비율을 맞춘다. internal 개발 영역 때문에 발생하는 추가 높이는 일반 화면의 크기 산정에서 제외한다.
- 이전 권장인 시간 휠 sheet/modal은 철회한다. 위치와 시간의 확인·수정을 한 화면에서 끝내고 중간 왕복을 줄이기 위한 결정이다. 작은 화면/접근성 큰 글씨에서는 터치·읽기 크기를 희생하지 않고 본문 overflow를 허용하는 안전 예외를 둔다.
- 다크/파란색, 현재 시각 기준 최대 120분, 여유 기본 10분·5~30분/5분 단위, 목적지 미설정=출발지 복귀는 이번에 다시 결정하지 않는다.

## 현재 코드 근거·변경 범위

- `TimeSetupScreen.tsx`의 `page='setup'`에서 `route-setup`으로 이동한 뒤 출발/도착 picker를 연다. `route-apply`로 setup에 돌아온다. 출발·도착 state는 이미 같은 컨테이너에 있다. 새 route/session/store를 만들 필요가 없다.
- `pickers()`의 두 onConfirm은 `setPage('route-setup')`을 호출한다. 중간 화면만 지우면 선택 후 사라진 분기로 돌아갈 수 있으므로 반환 경로까지 함께 교체해야 한다.
- 자동 GPS effect는 `page === 'route-setup'`에 묶였다. 삭제만 하면 이미 허용된 GPS 초기 적용이 사라지고, setup의 매 재렌더로 옮기면 반복 조회·수동 선택 덮어쓰기가 생길 수 있다. 초기화와 stale 응답 무효화를 함께 다룬다.
- 도착 wheel은 현재 전용 page, 여유 slider는 setup 안, 추천 CTA는 ScrollView 안에 있다. 화면 통합은 추천/Auth/CAPTCHA 경계를 재구현하는 작업이 아니다.
- 시간의 최초 기준은 mount 시 고정하고 추천 직전은 실제 시각을 다시 읽는 기존 경계가 있다. 장시간 편집·자정의 불일치는 먼저 fixture로 확인한다. 이번 UI 작업에서 다음 날 지원이나 자동 종료시각 연장을 임의로 도입하지 않는다.

## 이력·기존 요구 관계

`경로 설정 한 버튼→별도 경로 요약→picker→경로 적용→시간 화면`이 기존 현행이다. 필드 편집에 중간 화면 왕복이 필요하다는 사용자 관찰에 따라 `통합 입력의 출발/도착 직접 진입·도착 시각·여유·하단 추천 CTA`를 제안했다. 관계는 위치 선택·REC-01/18의 **보완**, 중간 경로 화면은 승인 시 **부분 대체**다. 검색/지도/권한 의미는 유지한다. 상태는 **사용자 확정·구현 전**이며 과거 카카오맵식 위치 선택 자체를 철회하지 않는다.

## 확정 작업 명령

```text
U-SETUP-UNIFIED-01을 진행해. Q-SETUP-01은 2026-09-05 사용자 승인으로 확정됐다. AGENTS.md, docs/README.md, docs/work/uiux/README.md, UIUX 공통 규칙 3-2 및 시간/햅틱 절, docs/테스트.md의 REC-01/18과 이 문서를 읽어. 시간 휠을 별도 sheet로 여는 과거 초안은 구현하지 마.

목표는 TimeSetup 한 화면에서 출발·도착·도착 시각·도착 여유를 확인하고 수정하는 것이다. 새 추천 정책·장소 검색 provider·저장소는 만들지 않는다. 기존 코드를 먼저 확인하고 실패하는 production 연결 fixture를 추가한 뒤 구현해.

1. 통합 입력 화면
상단 제목과 현재 기준 시각 안내 아래에 출발지, 도착지, 도착 시각을 독립적인 필드로 배치하고 그 아래 기존 여유 slider를 둔다. 출발·도착은 가까이 묶되 터치 영역과 여백을 구분한다. 출발지는 현재 위치/검색/지도 선택의 실제 확정값을 표시하고 미선택일 때 선택 행동을 안내한다. 도착지는 미선택이면 “출발지로 돌아오기”를 명확히 표시한다. 임의 목적지나 부산 중심 좌표를 입력값으로 확정하지 마.
route-setup 중간 요약 화면과 route-apply의 production 진입을 제거하고 각 필드에서 기존 PlacePicker/MapPlacePicker를 직접 연다. 선택 완료는 기존 통합 setup으로 돌아와 해당 필드만 갱신한다. 닫기/interactive back은 미확정 후보를 적용하지 않고 다른 입력을 보존한다. 이미 설정한 목적지에서 “출발지로 돌아오기”로 바꾸는 명시 행동을 제공하고, 복귀 모드의 출발지 변경은 목적지 null 계약으로 새 출발지 복귀를 따르게 한다. 명시 목적지는 출발지 변경으로 지우지 않는다.

2. 시간 편집·하단 행동
기존 TimeWheel을 도착 시각 제목 아래에 상시 노출한다. 별도 시간 설정 진입/적용 버튼은 제거한다. 휠에서 정착한 값은 같은 setup 입력 상태에 즉시 반영하며 전체 화면 뒤로가기/추천 실행의 기존 계약을 유지한다. 시간 변경만으로 추천을 호출하지 않는다. wheel 관성·새 행 selection haptic과 slider 사용자 5분 변화 haptic을 유지하며 programmatic 복원은 진동 0이다. 일반 필드/CTA에는 햅틱을 추가하지 않는다.
“이 시간에 할 일 찾기”는 setup의 유일한 주요 실행 CTA로 ScrollView 밖 하단 safe area 위에 둔다. 본문 끝이 fixed 영역에 가리지 않게 실제 footer 높이와 inset을 반영한다. 위치 picker/CAPTCHA가 열려 있거나 실행 중에는 배경 CTA로 추천을 중복 실행할 수 없어야 한다. 오류 이유는 관련 입력 근처 또는 CTA 앞에서 읽을 수 있게 하고 disabled 색만으로 알리지 마. 일반 사용자 영역은 safe area와 footer를 뺀 실제 가용 높이를 기준으로 배치한다. 출발/목적지는 compact한 2행(각 터치 높이 최소 44pt), 휠은 선택 행과 위아래 행이 읽히는 높이, slider는 라벨/값/손잡이 터치 영역을 유지하고 CTA는 최소 48pt로 둔다. 장식 여백·중복 안내문부터 줄이고 전체 scale transform이나 폰트 축소로 억지로 맞추지 않는다. 기본 세로 375×812, 390×844, 402×874pt/fontScale=1에서 개발 영역을 제외한 본문 contentHeight ≤ viewportHeight, 다섯 요소와 CTA 가림 0을 합격 기준으로 삼는다. 더 작은 화면/접근성 큰 글씨/오류 메시지가 커지는 경우만 본문 overflow를 허용하고 CTA 접근을 보장한다. 휠 자체의 관성 스크롤은 금지 대상이 아니다.
개발 버튼은 기존 gate·기능·진입을 유지한다. internal에서는 일반 입력 다음의 개발 영역 때문에 필요한 본문 스크롤을 허용하며, 개발 버튼까지 끼워 넣으려고 일반 입력을 축소하지 않는다. 테스트에서는 개발 영역 비노출 fixture로 일반 화면 높이를 검증하고 internal fixture에서는 두 개발 버튼의 접근·동작을 별도로 검증한다.

3. GPS·비동기·추천 경계 보존
이미 허용된 위치이고 출발지를 아직 정하지 않은 경우만 기존 자동 GPS/라벨 초기화를 통합 화면 최초 진입에 연결한다. 새 권한 prompt는 명시 “현재 위치” 행동에서만 허용한다. 거절·미결정·GPS 실패면 수동 검색/지도를 계속 사용할 수 있게 한다. 실패 뒤 매 렌더 자동 재시도하지 마. 수동 출발지 선택/화면 이탈 뒤 늦은 GPS/역지오코딩 응답이 좌표나 라벨을 덮어쓰지 않도록 request identity를 확인해. 실제 devicePoint와 사용자 지정 origin을 혼동하지 않는다.
기존 검색 debounce/provider, 지도 확정 시 라벨 조회·fallback, Auth/anonymous 구분, CAPTCHA token 전달, executeRecommendation, recommendation session builder와 loading progress를 재사용한다. 입력 열기/닫기/편집만으로 추천·route 계산·저장을 하지 않는다. 기존 위치 검색/명시 지도 확정의 허용 호출은 fake adapter로 별도 계측한다. 추천 실행은 실제 시각 재검증 후 딱 한 번이며 실패/CAPTCHA 취소는 확정 입력을 유지한다. 새 입력 화면 진입만으로 진행 중 코스를 취소하지 않고 교체 확인은 기존 최종 코스 시작 시점에 둔다.

4. 개발 도구와 코드 범위
기존 테스트 시각·8개 QA launcher와 진단 gate를 보존한다. production에서는 기존 gate대로 비노출이어야 하며 배포 flag·.env를 바꿔 가리는 것으로 끝내지 않는다. 개발 도구를 내정보로 옮기는 작업은 이번 범위가 아니다. obsolete page·callback은 실제 참조를 검색한 뒤 이번 경계에서만 정리하고 broad cleanup은 하지 않는다.
소유 파일은 TimeSetupScreen, UI 하위 표시/편집 model, 필요한 기존 UI picker 연결, UI 테스트다. 상태/API/navigation을 컨테이너에 두고 표시·draft/검증 계산을 UI 전용 모듈로 분리한다. 엔진·API adapter/Edge·데이터·DB/repository·Results/PlaceDetail/CourseConfirm/Live Activity·탭 구조·native 의존성을 변경하지 않는다. nav/App 변경이 필요하면 근거와 최소 범위를 먼저 인계한다.

5. 필수 검증
실제 production handler/사용하는 controller를 fake clock/GPS/검색/navigation/Auth/CAPTCHA/engine port로 실행해. source 문자열만 비교하거나 선언한 0 카운터로 완료하지 않는다.
- 출발/도착 확정·취소·닫기·검색↔지도 전환 뒤 같은 setup과 다른 필드 보존
- 목적지→복귀 전환, 복귀 중 출발지 변경, 명시 목적지 유지
- 이미 허용된 GPS 1회, 거절/실패 수동 입력, 수동 선택 뒤 늦은 자동 좌표/라벨 무시
- 상시 시간 휠 값 반영·다른 필드 보존·별도 적용 불필요, wheel/slider 사용자 vs programmatic 햅틱 구분
- 미선택·0분·1분·120분·121분 및 실행 전 시간 경과 재검증, 자정 전후 기존 계약 불변
- CAPTCHA 성공/취소/실패·인증 준비 중·빠른 연타, 추천 중복 0, 실패 복귀 입력 유지
- production 개발 도구 없음/internal launcher 유지, 작은 화면/큰 글씨/키보드/modal과 footer 가림 없음
자정 또는 장시간 편집에서 기존 결함이 발견되면 재현값과 소유 경계를 인계하고 범위를 조용히 확대하지 않는다. 120분을 180분으로 되돌리거나 날짜를 임의 이월하지 않는다.
집중 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check와 iOS 번들 또는 고정 fixture E2E를 실행한다. 과거 중간 화면을 강제하는 UI assertion은 승인 범위로 교체하되 삭제/skip으로 통과시키지 마. QA 소유 파일은 수정하지 않는다. 실제 외부 호출/운영 DB/Simulator 수동 순회는 0이다.
완료 후 이 파일에 변경 파일·목적, 보존 계약, 실패 선행/최종 테스트 수치, fixture entry/testID, 실기기에서만 남은 키보드·제스처·햅틱·safe area 항목을 기록해. 커밋하지 마. QA 자동 게이트 후 사용자 실기기 smoke 한 번으로 마무리한다.
```

## 실행 순서와 병렬

1. Q-SETUP-01 사용자 확정 및 기준 갱신 완료 → UIUX 구현 허용.
2. UIUX 단일 작성자가 구현. 같은 TimeSetup을 다른 UIUX/QA가 동시에 수정하지 않는다.
3. QA는 UI entry 확정 전 제품 테스트를 선점하지 않고 fixture 설계만 가능. UIUX 인계 뒤 최종 검증.
4. 주변 둘러보기 기준 조사·DB 체류 계약 확인은 별도 역할에서 가능하지만 이 작업의 시작 조건은 아니다.

## 결정 변경 이력 — 2026-09-05

시간 휠을 별도 sheet로 열기(초안) → 사용자에게 반복 진입이 필요하고 개발 버튼 제거 후 일반 화면 공간을 활용하지 못함 → 위치 2필드+상시 휠+slider+하단 CTA, 일반 영역 기본 화면 무스크롤 → 입력 전체를 한눈에 조작 → **확정·구현 전**. 개발 버튼 삭제는 승인하지 않았으며 그대로 유지한다. 접근성 overflow는 축소/가림 방지 예외이지 기본 화면의 스크롤을 허용하는 근거로 사용하지 않는다.

## 완료 인수인계 — 2026-09-05 / U-SETUP-UNIFIED-01

### 1. 변경 파일과 목적

- `src/ui/TimeSetupScreen.tsx`: route-setup/route-apply/time-picker 진입·복귀·obsolete style 제거. 출발/도착 직접 picker, 목적지→복귀, 상시 도착 휠, 기존 slider, ScrollView 바깥 safe-area footer 연결. 개발 시각과 QA 8개 진입·실행은 유지했다. footer/본문 viewport/content의 실제 layout callback으로 스크롤 필요 여부를 결정한다. GPS 최초 1회·수동/이탈 stale 차단, CAPTCHA부터 실행까지 동기 lock, picker 취소/전환/이탈의 늦은 확정 응답 차단을 연결했다.
- `src/ui/timeSetup/UnifiedSetupInputs.tsx`: 상태 없는 일반 입력 표시. 출발/도착 52pt, 인접 필드 간격 6pt, 그룹 간격 10pt. 큰 글씨에서는 긴 위치 이름의 줄 수 제한을 풀고 overflow로 접근한다.
- `src/ui/timeSetup/unifiedSetupModel.ts`: footer 예상/실측 가용 높이, 글자 크기에 따른 wheel 행 높이, 일회성 GPS request identity, 수동 실행 lock을 분리했다.
- `src/ui/TimeWheel.tsx`: 기본 44pt와 기존 관성/selection 정책을 유지하는 선택적 rowHeight. 큰 글씨에서 행 높이를 늘리며 programmatic 높이 동기화는 haptic 0이다.
- `test/ui/unified-time-route-setup.test.mjs`, `test/ui/support/screenRuntime.mjs`: 실제 TimeSetup/TimeWheel/선택기/CAPTCHA handler 실행 fixture와 Date·개발 환경 주입. fetch는 호출 시 실패하도록 교체하고 종료 시 0을 확인한다.
- `test/ui/global-interaction-motion.test.ts`, `test/map-transport-ui-contract.test.mjs`: 사라진 중간 경로 행을 강제하던 assertion을 공용 Pressable을 사용하는 통합 필드/상시 휠/직접 picker 계약으로 교체. 테스트 삭제나 skip 추가는 하지 않았다.
- 이 작업 문서만 인계 갱신. 보드·중앙 문서·App/nav·다른 세션 수정분은 편집/복원하지 않았다.

변경 이력: 분리 경로/시각 페이지와 본문 내부 CTA → 중간 왕복 및 최초 통합 진입 GPS 누락 → 직접 필드·상시 휠·실측 overflow·별도 footer → 확정된 한 화면 입력과 접근성 양립 → **구현 현행**. 추가 재현: 지도 확정 후 취소해도 늦은 주소가 목적지를 변경 → 컨테이너 picker request identity로 취소/전환/이탈 응답을 무효화 → 미확정 입력 보존 → **구현 현행**. 과거 별도 휠 sheet 초안 및 route-apply 흐름은 철회 상태를 유지한다.

### 2. 유지한 공개 계약·정책 경계

- 1~120분, 여유 기본 10분/5~30분/5분 step, 목적지 null=변경된 출발지 복귀, 명시 목적지 보존. 실제 deviceLocationSnapshot과 사용자 지정 origin을 분리한다. 지도 초기 중심 fallback을 확정 입력으로 사용하지 않는다.
- 기존 검색 debounce/provider와 지도 pin_confirm 라벨 adapter, Auth loading/익명 Route Proxy 세션·CAPTCHA token 전달, session builder/추천 실행/loading progress를 그대로 소비한다. 편집에 따른 추천·저장·진행 코스 취소를 추가하지 않았다.
- 일반 필드/CTA haptic 0, wheel 사용자 새 행 및 slider 사용자 5분 변경만 기존 haptic. 개발 gate/실제 시각 복원/QA 8개 controller 계약 유지.
- 엔진·외부 API adapter/Edge·data·DB/repository·Results/PlaceDetail/CourseConfirm·Live Activity·탭·native 의존성은 이 작업에서 변경하지 않았다. 실제 API·운영 DB·Simulator 실행 0, stage/commit/push 0.

### 3. 실패 선행 및 최종 검증 결과

- 구현 전 최초 집중 fixture: **0 pass / 2 fail**. 통합 출발 필드 부재, 첫 setup GPS 조회 0회 재현. `/private/tmp/timefit-setup-first.log`.
- 실제 검색/지도 연결 추가 fixture: **23 pass / 1 fail**, 확정 중 닫은 지도 주소의 뒤늦은 목적지 적용 재현 후 request identity 보완. `/private/tmp/timefit-setup-pin-first.log`.
- 최종 집중 fixture: **25/25 pass**. 검색→지도→검색/확정/닫기/interactive remove, 목적지 null session, GPS 허용/거절/미결정/실패·늦은 좌표/라벨·이탈, wheel 관성/slider haptic, 미선택·0/1/120/121분, 실행 전 경과·자정, CAPTCHA 실제 WebView 실패→늦은 bridge 차단→재시도·중복 검증, auth loading/익명 proxy, 실행 실패 재시도, 개발 도구와 8개 시나리오를 검증했다. 실제 선택기 fixture의 fake search 1회/pin_confirm 2회, 이동만으로 라벨 호출 0, 편집 추천 0을 계측했다.
- `npm run test:typecheck`: **pass**.
- `npm run test:ui`: **351 pass / 0 fail / 기존 skip 1** (전체 352). skip은 기존 철회된 순차 대표 교체 이력 테스트이며 이번 작업에서 변경하지 않았다.
- `npm test`: **160/160 pass**.
- `node --test test/map-transport-ui-contract.test.mjs`: **14/14 pass**.
- `git diff --check`: **pass**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-setup-ios.ln4aZ6`: **pass**, Hermes iOS bundle 생성. native 의존성 변경 없음.
- 로그: `/private/tmp/timefit-setup-{focused,typecheck,ui,all,map,ios}.log`.
- 일반 영역 fixture(fontScale=1, safeTop=59/safeBottom=34): production style 기반 content budget **571.2pt**, footer **94pt**, viewport는 375×812에서 **659pt**, 390×844에서 **691pt**, 402×874에서 **721pt**. 세 경우 content≤viewport 및 scrollEnabled=false, CTA는 본문 밖이며 필드≥44pt/CTA≥48pt를 확인했다. 320×568/fontScale=2·200pt keyboard-sized viewport 주입에서는 overflow=true, footer 유지·위치명 줄 제한 해제·wheel 행≥56pt를 확인했다.
- 위 높이는 실행한 production tree/style의 결정적 예산 계산과 onLayout/onContentSizeChange 주입 검증이다. 이 hook host는 Yoga/iOS renderer가 아니므로 **실기기 실측·키보드 캡처 통과로 간주하지 않는다**.

fixture entry: `node --test test/ui/unified-time-route-setup.test.mjs`. 주요 testID: `setup-general-inputs`, `setup-scroll`, `setup-arrival-time`, `route-origin-field`, `route-destination-field`, `route-return-origin`, `setup-input-error`, `setup-footer`, `setup-recommend`, `setup-development-tools`, 기존 `dev-test-clock`/`qa-release-one-stop-launcher`/`qa-scenario-*`. 실제 선택기/보안 경계: `location-search-input`, `location-suggestion-0`, `location-confirm`, `location-map`, `map-confirm`, `captcha-webview`, `captcha-error`, `captcha-retry`.

### 4. 다음 결정·위험·실기기 재현 조건

- QA 자동 게이트 후 사용자 실기기 smoke 1회 대기: 일반 gate의 위 3개 크기에서 본문 content/viewport 실측·휠 위아래 행·다섯 요소·CTA 가림 0, 긴 위치명/큰 글씨 overflow, 검색 키보드 표시/닫기, 지도↔검색 취소와 iOS back gesture, CAPTCHA 뒤 배경 비활성, safe area/footer 및 실제 wheel/slider haptic을 확인한다. internal은 일반 영역을 축소하지 않은 상태로 두 개발 버튼과 8개 항목 접근을 별도 확인한다.
- 기존 시간 계약 한계 재현: 23:50 진입(종료 23:59)→다음 날 00:01 실행은 분 차이 1438로 120분 초과 차단된다. 12:00 진입(13:00 종료)→13:01 실행도 차단된다. 이는 mount 기준 안내와 실행 시 실제 시각 재검증의 기존 계약이며, 다음 날 날짜 선택·자동 연장을 도입하지 않았다. 장기간(날짜가 바뀐 채 같은 시간대) 유지된 입력의 날짜 의미는 별도 시간/session 정책 결정이 필요하다.
- 코드·자동 검증 완료와 실기기 수락은 구분한다. 실제 위치 권한/키보드/햅틱/WebView 네트워크 검증이나 새 빌드 설치는 이번 지시대로 수행하지 않았다.

## 사용자 반환 보완 — 개발 영역 제외 배치 / 2026-09-05

관계: Q-SETUP-01의 **보완**. 이전에는 일반 입력의 최소 높이(약 563pt)에 개발 버튼을 바로 이어 붙여 화면에 따라 두 개발 버튼까지 무스크롤로 보였다. 사용자 관찰에 따라 일반 입력만 `safe area·footer를 제외한 viewport` 전체를 기준으로 배치하고 남는 높이는 일반 그룹 사이에 분배한다. 개발 영역은 일반 영역 뒤에 추가되며 일반 영역의 높이나 간격을 줄이지 않는다. 상태: **구현·자동 검증 완료, 실기기 시각 확인 대기**. 위 최초 인계의 571.2pt 고정 content budget은 이 배치로 대체하며 이력으로 남긴다.

### 1. 변경 파일

- `src/ui/timeSetup/UnifiedSetupInputs.tsx`: 일반 영역에 viewport minHeight와 space-between 적용. 최소 gap/터치/폰트 크기는 유지하고 내용이 길면 자연스럽게 overflow한다.
- `src/ui/TimeSetupScreen.tsx`: footer를 제외한 실제 본문 viewport를 일반 영역에 전달. 개발 gate가 꺼진 경우 빈 개발 wrapper의 추가 여백도 제거한다. internal 개발 버튼은 일반 영역 다음에 그대로 유지한다.
- `test/ui/unified-time-route-setup.test.mjs`: production/internal 일반 영역이 동일하고, 일반 영역만 viewport를 사용하며 개발 영역은 추가 scroll 높이가 되는지 3개 크기에서 실행 검증. 이 문서에 같은 작업 ID로 인계한다.

### 2. 유지한 계약

개발 테스트 시각·8개 QA gate/기능, 상시 wheel·slider haptic, 위치 선택·GPS·CAPTCHA·추천/session/호출 예산, 하단 CTA와 접근성 overflow를 유지했다. 보드·중앙 문서·엔진/API/DB/native 의존성과 다른 세션 변경은 수정하지 않았고 commit/push하지 않았다.

### 3. 테스트 결과

- 실패 선행: 새 fixture에서 일반 영역 minHeight가 undefined여서 659pt 가용 높이를 사용하지 않는 실패를 재현(25 pass/1 fail). `/private/tmp/timefit-setup-dev-first.log`.
- 집중 **26/26 pass**, typecheck **pass**, UI **352 pass/0 fail/기존 skip 1**, 전체 **161/161 pass**, map transport **14/14 pass**, diff check **pass**.
- iOS export **pass**, `/private/tmp/timefit-setup-dev-ios`. 로그 `/private/tmp/timefit-setup-dev-{focused,types,ui,all,map,ios}.log`.
- 375×812/390×844/402×874에서 일반 영역 minHeight=각 659/691/721pt(safeTop59/footer94 fixture). production/internal의 일반 영역 tree/style 동일, 일반 화면 scroll=false, internal은 일반 영역+개발 영역 content 주입 후 scroll=true를 확인했다. 기존 작은 화면/큰 글씨 fixture도 통과했다. 실제 Yoga 측정이나 실기기 캡처 결과는 아니다.

### 4. 다음 결정·위험

실기기에서 일반 입력 그룹 간격과 고정 CTA를 확인하고, internal에서는 스크롤하여 개발 버튼에 접근하는지 확인한다. 실제 API/DB/Simulator는 실행하지 않았다. 기존 키보드·제스처·햅틱 실기기 확인 항목은 유지한다.
