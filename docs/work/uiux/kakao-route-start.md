# U-KAKAO-ROUTE-START-02 — 코스 길찾기 클릭의 이동 시작 처리

## 2026-09-09 현재 상태

사용자 확정 명령에 따른 구현·자동 회귀·공개 환경 iOS Simulator Release 빌드 완료. 사용자 **시뮬레이터 직접 테스트 수행 보고**가 있으며, 어떤 빌드에서 어떤 결과를 확인했는지 상세 답변은 아직 없다. 이를 실기기 또는 모든 시나리오 PASS로 간주하지 않는다. 에이전트의 Simulator 화면 조작 권한은 미승인되어 자동 UI 조작/캡처는 실행하지 않았다.

## 1. 변경 파일과 목적

- `src/ui/CourseConfirmScreen.tsx`: 첫/다음/최종 구간과 native pending의 공통 `openTravel` 경계에서 이동 의사를 먼저 저장하고 Activity 시작/갱신을 시도한 뒤 외부 길찾기를 연다. `이동 중`, `도착했어요`, `길찾기 다시 보기`를 연결했다. 정상 웹 종료는 중립이며, 실제 전체 열기 실패만 이번 시도의 복구를 시도한다. late failure의 다른 run/도착/완료 오류 덮어쓰기도 차단한다.
- `src/ui/liveActivity/courseProgressRuntimeModel.ts`: `beginRouteIntent` / `rollbackRouteIntent` 추가. 동일 이동 재열기는 저장/시각/Activity/알림 초기화 없이 `reused`; 신규 의사는 native 공유 storage write → Activity start/update → notification sync 순서. Activity 실패는 진행 실패로 전파하지 않는다. rollback은 run·revision·phase·시작 시각·event ID를 비교하고 receipt를 먼저 적용한다. 복구 revision은 증가시켜 과거 attempt revision을 재사용하지 않는다.
- `src/ui/ExecutionScreen.tsx`: 공유 길찾기 함수를 소비하는 legacy 화면도 클릭 시 이동 표시, 정상 웹 종료 유지, 재열기, 연속 호출 잠금, 단계/종료 변경 후 늦은 실패 억제를 적용했다. 기존 legacy 날짜·저장·알림 계약과 화면 흐름은 유지하며 새로운 Live Activity 연결을 만들지 않았다.
- `test/ui/course-route-start.test.mjs`: 새 runtime의 cold read, Activity 거절, 재열기, 실패 복구/재시도, 늦은 도착·terminal·다른 run·receipt, 다음/최종 구간 및 native 출발 보존 fixture.
- `test/ui/place-course-screen-runtime.test.mjs`: 실제 CourseConfirm와 controller/adapter handler 실행형 검증. 1·2곳, 외부 결과 전 버튼/공유 상태, 웹 종료, 전부 실패, 중복·재열기, 도착/완료/다른 run 뒤 지연 실패, native pending 자동/재시도와 기존 완료 회귀.
- `test/ui/release-preflight-handoff.test.mjs`: 기존 failed handoff 복구 검증을 내용 복구+단조 revision으로 갱신. `test/ui/release-exit-logs.test.mjs`: 기존 비민감 로그 검증을 보존하며 legacy 웹 종료/재열기/실패 검증 추가.
- `test/ui/simulator/route-start-app.jsx`, `route-start-ports.jsx`, `route-start-catalog.json`, `route-start-metro.cjs`: 실제 CourseConfirm를 사용하는 별도 Simulator fixture 진입/ports/고정 장소/명시 Metro config. production `index.ts` / `App.tsx`에서 연결하지 않는다. 실제 카카오 웹을 가장하지 않고 fixture 표시·네트워크 금지를 적용한다. 번들 생성만 확인했으며 Simulator 설치/조작 성공은 미확인이다.
- 이 문서와 `kakao-web-return.md`: 새 결정 및 과거 계약의 교체 범위 기록. 기존 다른 세션 변경은 보존했다.

## 2. 이전/현행 결정과 유지 계약

### 교체 이력

이전 방식: `U-RELEASE-PERSONALIZATION-01 A`에서 foreground 준비 후 실제 외부 열기 수락/브라우저 background 확인 때 이동 확정. `U-KAKAO-WEB-RETURN-01`은 정상 브라우저 닫기의 거짓 오류만 제거하고 비성공/미확정 상태는 유지했다.

문제/관찰: 사용자가 실기기에서도 웹 길찾기를 사용한 뒤 돌아오면 버튼이 바뀌지 않는다고 보고했다. 내장 브라우저의 정상 이용·종료는 background/외부 앱 수락 증거를 주지 않으며 카카오 웹 내부 길찾기 버튼 클릭을 앱이 전달받는 연결도 없다.

현행 방식(사용자 확정): **코스의 길찾기 클릭 자체를 이동 시작 의사로 저장** → 공유 이동 상태 → Activity 시도 → 카카오 앱/외부 웹/브라우저 열기. 별도 이동 시작 버튼·웹 내부 클릭 추적 없이 웹 이용/팝업 취소/닫기/복귀에도 상태를 유지한다. 모든 열기가 실제 실패하면 이번 신규 의사만 소유권 확인 후 복구한다.

교체 이유: 카카오맵 설치 여부에 따른 코스 진행 차단을 없애되 클릭을 실제 도착/방문 증거로 오인하지 않기 위해서다. 이전의 코스 시작 확정 조건은 **철회**, adapter 자체의 외부 열기 결과 enum과 주변의 독립 정보 탐색 의미는 **유지**한다.

### 유지·구분 사항

- `openKakaoRouteWithFallback` / `isKakaoRouteOpenSuccess`는 수정하지 않았다. `browser_fallback_cancelled`를 adapter 성공으로 바꾸지 않는다. 코스 consumer의 boolean은 ‘이동 의사 유지’이며, 외부 열기 성공 증거와 다르다. 기존 pending controller의 `opened/success` 상태명도 소비 완료를 나타내는 호환 경계로 유지한다.
- 새 runtime은 기존 로컬 `handoff_succeeded` event/route 구조를 재사용한다. 이 코스 진입에서 event의 의미는 명시적인 이동 의사이며, 카카오 웹 내부 클릭 또는 실제 방문의 증거가 아니다. 새로운 DB/schema/event 업로드는 없다.
- 명시 도착 확인부터 기존 체류 측정/학습 증거 경로를 사용한다. 클릭 시 arrival event/firstArrival/계정·동의 증거를 만들지 않는다. 앱/Live Activity 도착·출발과 최종 목적지 완료 확인은 기존 공유 경로를 유지한다.
- 이미 native 출발로 확인된 departedAt은 길찾기 전체 실패 때도 지우지 않는다. 복구 범위는 그 뒤 앱이 추가한 경로 시작 부분뿐이며, 재시도 가능성을 남긴다.
- 재열기 전체 실패는 오류·재시도를 제공하지만 기존 이동 시각·알림·Activity·진행은 복구/초기화하지 않는다. 새로운 도착/완료 뒤의 늦은 오류는 화면에 덮어쓰지 않는다.
- cold restart는 이미 저장한 이동 의사를 복원한다. 외부 열기 결과를 알 수 없다는 이유로 자동으로 실패 처리하거나 외부 앱을 다시 열지 않는다.
- 주변 `openNearbyDirections`는 별도 경계이며 수정하지 않았다. 주변 길찾기에서 코스/기록/체류/학습/Activity 생성 없음은 기존 fixture 회귀로 유지한다.
- 추천, DB repository/schema, 개인화 정책, 운영 데이터, 서명/공개 설정, native plugin 구현은 변경하지 않았다. 스토어 업로드·commit/push 없음.

### 역할 밖 문서 변경 요청

통합·결정 세션은 `UIUX_공통규칙.md`, `UIUX_테스트명세.md`, 사용자 요구사항/보드 및 최신 Live Activity 결정 문서에 위 코스 클릭 기준을 반영해야 한다. 이전 ‘외부 성공 전에는 이동 미확정’ 문구를 현행으로 다시 적용하지 말고, 외부 열기 결과와 이동 의사의 차이·전부 실패 복구·학습 제외를 함께 기록한다. 이 세션은 중앙 문서를 직접 수정하지 않았다.

## 3. 테스트·빌드 결과

- 실패 선행: 새 runtime 계약 fixture 7개가 구현 전 `beginRouteIntent is not a function`으로 실패. `/private/tmp/timefit-route-start-red.log`. 이후 구현 및 실제 화면 fixture의 결과 대기 기대값을 새 결정으로 교체했다.
- runtime 집중 7/7 PASS, 실제 화면 집중 50/50 PASS. `/private/tmp/timefit-route-start-focus-final.log`.
- `npm run test:typecheck`: PASS. `/private/tmp/timefit-route-start-type-final.log`.
- `npm run test:ui`: 732개 중 **731 PASS / 기존 skip 1 / fail 0**. `/private/tmp/timefit-route-start-ui-final.log`.
- `npm test`: **421/421 PASS**. `/private/tmp/timefit-route-start-core-final.log`. 중간 실행에서는 Simulator 전용 `.js` JSX 파일이 Node 테스트로 발견되어 실패했으나 `.jsx`로 분리 후 최종 전체 통과했다.
- iOS Release Simulator native build: **BUILD SUCCEEDED**, public environment guard 유지. `/private/tmp/timefit-route-start-build-final.log`.
- 별도 fixture JS bundle 생성 PASS: `/private/tmp/timefit-route-start-fixture-bundle.log`. 실행 명령: `EXPO_NO_DOTENV=1 npx expo export:embed --entry-file test/ui/simulator/route-start-app.jsx --platform ios --dev false --config test/ui/simulator/route-start-metro.cjs --bundle-output /private/tmp/timefit-route-start-fixture.jsbundle --assets-dest /private/tmp/timefit-route-start-fixture-assets`.
- `git diff --check`: PASS. production main.jsbundle에서 begin/rollback entry 포함, fixture 전용 표시/네트워크 차단 문자열 미포함 확인.
- 자동 fixture는 외부 API/운영 쓰기 없이 실행했다. 실제 WebBrowser/iOS 팝업이나 ActivityKit 실기기 성공으로 해석하지 않는다.

## 4. 재설치할 빌드·남은 확인

### 빌드 식별

- 최신 **제품용 Simulator Release 앱**: `/private/tmp/timefit-capture-release-20260909/Build/Products/Release-iphonesimulator/mobile.app`.
- 대상: iPhone 17 Pro Max Simulator, UDID `37D18200-C8AC-4F34-9240-FD4D19ABEA25`. 앱 버전/빌드 번호는 기존 `1.0.0(1)`이므로 번호만으로 최신 반영을 판별하지 않는다.
- 제품 `main.jsbundle` SHA-256: `dfe921c6c52e037bebd941fe2b54bc205146143a60882946da47ec6c1e4d8656`.
- 별도 fixture bundle: `/private/tmp/timefit-route-start-fixture.jsbundle`, SHA-256 `7e202ece5e0d39a29869651ebe44e9dc586bbbdcebe8d3e726c9ba0a31c614bc`. **제품 앱/스토어 배포에 넣지 않는다.** fixture 설치형 앱 포장은 아직 하지 않았다.
- 이번 세션에서 설치/앱 삭제/Archive/업로드는 하지 않았다. 실제 iPhone에는 Simulator `.app`을 설치할 수 없으며, 현재 소스로 iPhone 대상 public Release를 Xcode에서 빌드·재설치해야 한다. 기존 설치된 Release 앱의 정적 JS는 자동 갱신되지 않는다.

### 확인 목록

사용자 직접 Simulator 테스트 수행 보고만 접수했으며, 최신 코드 반영 여부 및 아래 결과는 답변 확인 후 갱신한다.

1. 1곳 코스: 길찾기 클릭 → 이동 중/도착했어요 → 웹 팝업 취소 또는 설치없이 보기 → 닫고 복귀. 버튼 유지·거짓 실패 문구 없음.
2. 이동 중 재열기 및 연속 탭: 외부 화면 중복 실행 없음, 시각·Activity·알림 초기화 없음.
3. 2곳 및 최종 구간: 명시 도착 → 체류 → 다음 길찾기 클릭 → 다음 이동. 마지막은 기존 도착 후 코스 마치기로 완료.
4. 전체 열기 실패 fixture: 신규 이동만 복구·오류/재시도 유지. 도착/완료/다른 run 이후 늦은 실패는 상태 보존.
5. 실제 iPhone에서 카카오 앱 설치/미설치 각각 1회. Activity 허용/거절, 앱과 잠금화면 도착/출발 상호 반영, 최종 완료 정리 확인. Simulator로 이 실기기 항목을 대체하지 않는다.

상태 저장 자체가 불가하거나 다른 활성 run과 충돌하면 안전한 오류로 차단한다. Activity 권한 거절/시작 실패와 공유 상태 저장 실패를 같은 오류로 묶지 않는다. 실기기 검증과 중앙 문서 수락이 남았으므로 출시 수락을 자동 선언하지 않는다.
