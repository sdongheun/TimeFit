# U-LIVE-ACTIVITY-01 — iOS 17 Live Activity·도착/출발 확인·권한 설정

## 현재 최우선 실행 — 남은 길찾기 연결 2건 진단·수정 (2026-09-06)

상태: **첫 Activity 즉시 표시와 Live Activity `이제 출발해요` → TimeFit → 카카오맵 다음 길찾기 모두 `.5` 사용자 실기기 통과·수락**. 앞선 진단 전용 명령의 “제품 코드 수정 금지”는 이번 두 결함 범위에 한해 대체했다. 기존 결함 기록은 원인 이력으로 보존하며 아래 현행 결론이 우선한다.

### 결정 세션용 현행 결론 — 2026-09-06

- 최종 사용자 관찰: 새 코스의 첫 길찾기 직후 Live Activity가 앱 복귀 없이 표시됐고, 잠금화면 `도착했어요`로 체류 상태가 반영됐으며, `이제 출발해요` 1회 뒤 TimeFit이 활성화된 다음 추가 앱 버튼 없이 목적지 카카오맵 길찾기가 열렸다. 상태: **실기기 PASS·현행 수락**.
- 수락 artifact: main/extension/JS 진단 식별값 `ula-button-diagnostic-2026-09-06.5`. 앱 삭제나 서버 변경 없이 새 native build 덮어 설치로 확인했다.
- 현행 실행 계약: 첫 route는 검증 snapshot으로 Live Activity를 foreground에서 준비한 뒤 외부 handoff하며 실패 시 exact rollback한다. 출발은 Intent가 동일 run/stop/revision을 검증하고 receipt+pending을 내구 저장한 뒤 TimeFit이 같은 snapshot의 다음 travel을 1회 소비한다. route 성공 전에는 `routeOpened=false`다.
- 보안·정책: pending과 진단에는 좌표·URL·장소명·사용자 ID를 저장하지 않는다. 다른 활성 run은 충돌로 보존하고 종료 run의 orphan pending만 교체한다. 서버 개인화·DB·추천 엔진·외부 API 계약은 이 해결에서 바꾸지 않았다.

| 반환 단계 | 실제 최초 실패 | 교체한 방식 | 최종 상태 |
| --- | --- | --- | --- |
| 첫 길찾기와 Activity 시작 | 외부 handoff 뒤 JS suspend/browser dismiss까지 Activity 준비가 지연 | foreground에서 Activity를 먼저 준비하고 외부 전체 실패만 exact rollback | 실기기 PASS |
| 도착 → 출발 revision | `Activity.update` 직후 stale `activity.content.state`를 동기 검증해 target revision 저장 중단 | 단일 writer의 next state로 update 완료 뒤 exact target revision 저장, 다음 Intent에서 재검증 | `.4`에서 도착 경계 PASS |
| 출발 pending 저장 | 종료된 과거 run의 단일 pending 파일이 새 departure를 `pending_write_failed`로 차단 | 활성 run 집합과 대조해 orphan만 atomic 교체, 활성 충돌·같은 run 중복은 거절 | `.5` 실기기 PASS |
| TimeFit 복귀 뒤 route 실행 | 외부 suspend 동안 남은 boolean route lock이 pending 소비를 거절할 수 있음 | 시도별 token lease와 실제 background→active에서 이전 소유권만 폐기 | 자동 회귀 PASS·최종 흐름에 포함 |

> 판독 기준: 이 문서 하단의 `실기기 수락 전`, `미확인`, `수락 보류` 표기는 각 진단·보완 시점의 역사 기록이다. 결정 세션은 이를 미완료 현행 상태로 해석하지 않고, 위 `.5` 사용자 실기기 PASS와 현행 실행 계약을 최종 상태로 사용한다.

### 근거·목표·불변

- 사용자 실기기: Live Activity 도착했어요 → 머무는 중 전환은 성공했다. 이 경로는 유지하고 회귀만 확인한다.
- 초기 잔여 A(해결): 이제 출발해요 → TimeFit만 열리고 앱 길찾기 재탭 필요. `.3`에서는 target revision 단절, `.4`에서는 orphan pending 충돌이 실기기 진단으로 순차 확인됐고 `.5`에서 최종 통과했다.
- 초기 잔여 B(해결): 첫 길찾기에서 브라우저 경유 카카오맵을 연 뒤 TimeFit으로 돌아와 브라우저를 닫아야 Activity가 시작됐다. 최초 route의 rollback 가능한 foreground Activity 준비로 교체해 사용자 실기기에서 앱 복귀 전 표시를 확인했다.
- 진단 작업 중 확인한 Foundation의 atomic+withoutOverwriting 비지원 옵션 조합은 별도 실제 결함이며 이미 수정됐다. 이를 target membership 가설과 혼동하거나 다시 도입하지 않는다.
- 이번 작업은 상태 공유와 기존 사용자 요청 실행 연결 보완이다. 앱/Live Activity 양쪽 버튼을 유지하고 동일 상태·중복 방지 경계를 사용한다. 서버 개인화/알림 UX/추천 정책 변경은 하지 않는다.

### UIUX 실행 명령

```text
U-LIVE-ACTIVITY-01의 “남은 길찾기 연결 2건 진단·수정” 전체를 수행해. 진단만 작성하고 종료하지 말고, 근거가 확보된 결함은 수정·자동 검증까지 완료해. 단, 정책 변경이나 실기기 증거가 필요한 경계는 미확정으로 반환해.

0. AGENTS.md, docs/README.md, 이 절, 최신 진단 저장 오류 수정 인계, DEC-LIVE-ACTION-HANDOFF-01, kakao-route-handoff-contract.md를 읽어. 최신 코드와 설치 native/JS revision을 구분한다. 기존 진단 수집·조회 기능을 재사용하고 새 진단 체계를 또 만들지 않는다. 이미 성공한 도착 동작을 다른 구조로 재설계하지 않는다.

1. 잔여 A: 출발 자동 길찾기
- 현재 진단 또는 고정 하네스로 departure receipt 생성 → pending 저장 → 시스템 앱 활성화 → 코스/receipt 복구 → 현재 화면에서 pending 관찰 → claim → adapter 호출 → 성공 반영을 추적한다. 마지막 성공/최초 실패를 먼저 기록한다.
- 특히 main/Home에서만 처리되는지, CourseConfirm이 이미 열린 warm resume인지, 다른 탭인지, cold start인지, foreground callback이 Intent 저장보다 먼저 발생하는지 구분한다. 가설을 실제 호출 순서 fixture로 검증한다.
- 앱이 활성화돼 있어도 pending가 뒤늦게 저장될 수 있다. readiness/event 처리 경계로 해결하고 임의 sleep·상시 polling·앱 재탭으로 대신하지 않는다.
- 어디서 복귀하든 승인된 동일 run의 pending 요청을 하나의 소비 경계에서 처리한다. navigation 준비·snapshot 및 receipt 복구가 끝난 뒤 확정된 다음 travel만 연다. Home을 반드시 거쳐야 하거나 CourseConfirm을 중복 push하지 않게 한다.
- 출발 버튼의 명시 시각은 1회 기록, 외부 성공은 별도다. 실패/불명확 결과만 기존 앱 CTA로 명시 재시도한다. 정상 성공 경로에는 추가 CTA를 요구하지 않는다.
- 같은 action의 cold/warm callback·중복 탭은 외부 실행1회, stale/변조/완료/교체 요청은0회다. 성공 여부가 불명확한 외부 실행을 무조건 재호출하지 않는다. 기존 single-writer와 cleanup을 유지한다.

2. 잔여 B: 첫 Activity 시작 지연
- canOpenApp/app-open/HTTPS/browser 분기와 route result/Activity request의 순서를 안전 enum으로 관찰한다. 왜 설치된 카카오맵인데 browser fallback에 도달하는지 확인한다. 공식 scheme·현재 URL 조립·query 설정·실행 오류를 대조하고 API 키 부족 같은 무관한 추측으로 확장하지 않는다.
- iOS openBrowserAsync의 Promise는 dismissal 시 반환할 수 있다. 취소/닫힘을 카카오맵 실제 실행 성공으로 간주하거나 그 시점을 routeOpenedAt으로 사용하는 경계를 제거한다.
- 외부 URL 실행 수락, browser presentation/dismissal, 실제 목적 앱 내부 길찾기 여부를 구분한다. Linking 성공도 목적 앱에서 사용자가 길찾기를 시작했다는 증거는 아니다. 기존 handoff 계약 수준 이상의 성공을 주장하지 않는다.
- 가능한 정상 경로는 기존 app scheme/외부 HTTPS handoff 수락을 즉시 처리해 앱/브라우저 복귀 전에 Activity를 시작하도록 연결한다. iOS foreground 실행 제약까지 실제 검증한다.
- 브라우저에 대한 독립 실행 수락 신호가 없거나 handoff 이후 백그라운드 Activity request가 OS에 거절되면 시작 시점 정책을 임의 바꾸지 않는다. “handoff 전 미리 시작”이나 “버튼 탭만으로 성공 처리”로 숨기지 말고, 가능한 대안·정책 영향·필요 사용자 결정을 반환한다.
- Promise의 await를 단순 제거하거나 타이머를 추가해 fire-and-forget 성공으로 처리하지 않는다. 전체 실패는 Activity0, 이미 성공한 외부 전환은 Activity 실패로 취소하지 않는다.
- 공유 helper 변경이 필요하면 src/ui/execution/schedule.ts 및 UI handoff 호출부만 이 작업의 단일 작성자가 담당한다. 모든 기존 호출자(A3/Execution/CourseConfirm 포함)의 의미와 테스트를 대조한다. 외부 route provider/서버 adapter/cache는 변경하지 않는다. 과거 kakao-route-handoff 계약과 의미 충돌이 생기면 문서 변경안을 인계하고 조용히 덮어쓰지 않는다.

3. 실패 선행 fixture
A: 앱 CourseConfirm이 이미 열림, Home, 다른 탭, cold start 각각에서 pending가 foreground 전/후 도착하는 경우; receipt 늦은 복구; 중복 callback; 잠금 해제 취소; snapshot 없음; 교체/완료; adapter 실패·불명확.
기대: 유효 출발은 추가 탭 없이 올바른 다음 구간1회, 무효0회. 1곳 최종 목적지/2곳 다음 방문지 및 최종 목적지/왕복 모두 포함한다.
B: app 성공, app 실패→외부 HTTPS 성공, browser Promise가 열린 동안 계속 pending, browser 취소/닫힘, 모든 외부 실패, Activity 거절. fake browser를 즉시 resolve하는 테스트만 만들지 않는다. 제품 entry를 실행해 browser 닫힘을 성공/시각 기준으로 오인하지 않는지 확인한다.
공통: 잠금화면 도착1회와 앱 도착1회가 같은 상태에 반영되고 중복 시각이 생기지 않음; snooze1회; departedAt 불변; 완료기록1건·pending/Activity/알림 exact cleanup; 서버/API 회귀 호출0.

4. 검증
npm run test:typecheck, npm run test:ui, npm test, iOS export, git diff --check. native 변경이면 main/extension compile 및 plugin 재생성 정합성을 추가한다. 기존 실패 삭제/skip 금지. 진단/Swift harness/compile와 실제 잠금화면 동작을 구분한다.
엔진/DB/catalog/env/서버 개인화/원격 push/GPS/알림 발화 UX/commit/push는 변경하지 않는다. 새 dependency·권한·entitlement가 필요하면 먼저 보고한다.

5. 실기기 요청은 수정 후 1회 흐름으로 최소화
- 새 native가 필요한지 명시하고 필요 시 앱 삭제 없이 internal Release를 설치한다. 버전 식별값을 함께 전달한다.
- 일반 현재시각/부산 수동 입력 1곳 코스 → 첫 길찾기 → TimeFit이나 브라우저로 돌아가지 않고 Activity 표시 확인.
- 잠금화면 도착1회 → 머무는 중 → 출발1회 → 필요한 잠금 해제 → 추가 탭 없이 최종 목적지 Kakao 확인.
- 앱 버튼을 대신 눌러 성공 처리하지 않는다. 실패 시 해당 흐름 진단만 복사하며 재설치/반복 추천을 요구하지 않는다. 2곳 순서의 자동 회귀 후 남은 OS 특이점이 있을 때만 추가 기기 확인을 요청한다.
- Simulator 수동 순회/운영 API 반복 호출은 하지 않는다.

6. 완료 반환
각 결함별로 관찰 → 확정 원인과 코드 위치 → 수정 방식/이유 → 자동 테스트 → 실기기 성공/실패/미확인을 기록한다. 추정은 별도 표시한다. 변경 파일/유지 공개 계약/명령과 결과/남은 위험·결정 네 항목을 남긴다.
자동 통과만으로 “완료 수락”이라고 쓰지 않는다. 사용자가 추가 앱 버튼 없이 성공했는지와 첫 Activity 표시 시점을 최종 구분한다. 정책 충돌이면 가능한 대안을 제시하고 해당 부분만 보류한다.
```

이전 방식 → 출발 자동 소비 누락 및 browser 종료에 시작 지연 → 진단으로 실패 경계를 확정한 뒤 단일 handoff lifecycle 수정 → 중복 조작 제거. 상태: **자동 구현·검증 완료 / 실기기 수락 전**, 도착 성공 경로는 보존.

### 완료 인수인계 — 남은 길찾기 연결 2건 진단·수정 (2026-09-06)

상태: **자동·native compile 완료 / internal Release 실기기 1회 확인 전 수락 보류**.

#### 결함별 관찰 → 원인 → 수정 → 검증

- 잔여 A, 출발 자동 길찾기
  - 관찰: 사용자 실기기에서는 `이제 출발해요` 뒤 TimeFit만 열리고 앱 길찾기 재탭이 필요했다. 앞선 Xcode 중단점은 receipt 저장에서 Foundation의 `.atomic + .withoutOverwriting` 비지원 오류를 보여 줬고, 그 catch가 같은 pending을 지우는 기존 경로가 직접 원인이었다. 해당 immutable receipt 쓰기는 앞선 `.2` 보완에서 staged atomic write → 같은 volume의 no-overwrite move로 교체된 상태를 유지했다.
  - 추가로 고정 호출 순서와 production source를 대조해, 기존 앱은 boot/foreground에서만 pending을 읽고 Intent 저장 완료를 알리는 경로가 없으며 Home 화면만 CourseConfirm 전환을 소유한다는 결함을 확인했다. 따라서 foreground callback이 receipt 저장보다 빠르거나 다른 탭/이미 열린 CourseConfirm에 복귀하면 durable pending이 있어도 소비가 시작되지 않았다.
  - 수정: departure의 **pending 저장 → receipt 저장 성공** 뒤 Darwin notification을 보낸다. main의 `RCTEventEmitter`가 `timeFitPendingNavigationAvailable`을 받아 동일 run reconcile → pending read를 직렬화한다. boot/foreground의 durable read도 유지해 cold/missed signal을 복구한다. 전역 `PendingNavigationRouteBridge`는 navigation 준비 뒤 Home/다른 탭에서 동일 active CourseConfirm으로 한 번만 이동하며, 이미 같은 CourseConfirm이면 push하지 않는다. 소비·claim·실패 재시도·success cleanup은 기존 단일 `pendingNavigationHandoffController`를 그대로 사용한다.
  - 검증: foreground 전/후에 해당하는 durable/event 경계, cold/no-current-route, Home/다른 탭/이미 열린 CourseConfirm, 중복 callback, 다른 run/완료 상태를 고정 fixture로 검증했다. 1곳 최종 목적지와 2곳 다음 장소/최종 목적지의 exact travel 1회, 손상·교체·완료·불명확 실행 0회 및 명시 재시도 시 departedAt 불변 회귀가 통과했다.
- 잔여 B, 첫 Activity 시작 지연
  - 관찰: production helper가 `await openBrowserAsync()`의 반환을 `browser_fallback_opened`로 취급했고 CourseConfirm은 그 뒤에야 `afterHandoff`를 호출했다. Expo browser Promise의 dismissal 완료가 route 수락과 Activity 시작 시각이 된 코드 결함을 확정했다.
  - 수정: app scheme과 외부 HTTPS `Linking.openURL`의 OS 수락은 즉시 성공으로 반환한다. browser fallback은 열기 시작과 dismiss를 분리하고, Promise가 열린 동안 앱의 background 전환이 관찰된 경우에만 독립 수락으로 반환한다. dismiss가 먼저 오면 `browser_fallback_cancelled`, throw는 failed이며 Activity는 0이다. timer와 fire-and-forget 성공은 없다. 각 분기는 `route` action의 비밀 없는 stage/result/error enum으로 `.3` 진단에 남는다. A3/Execution/CourseConfirm 호출자 모두 같은 결과 의미와 AppState observer를 사용한다.
  - 검증: app 성공, app 실패→HTTPS 성공, 열린 browser Promise→background 수락→dismiss 이전 Activity continuation, dismiss 선행, 전체 실패를 검증했다. 사용자의 설치된 카카오맵이 왜 app scheme 대신 browser까지 갔는지는 현재 소스의 공식 `kakaomap://route?sp=&ep=&by=` 조립과 query 설정만 정상 확인됐고, 설치 기기의 `.3` route 진단 전에는 **원인 미확정**이다. browser가 앱 background를 만들지 않는 OS presentation이라면 dismiss를 성공으로 과장하지 않고 실패/재시도 상태를 유지한다.
- 공통 보존: 잠금화면/앱 도착의 동일 local state, 최초 도착 시각, snooze 1회, 최초 departedAt, exact Activity·알림·pending cleanup 및 완료 기록 1건 계약은 변경하지 않았다. 서버/API/추천/DB/catalog/env/권한/entitlement는 변경하지 않았다.

#### 1. 변경 파일과 변경 목적

- `plugins/live-activity/TimeFitActivityAttributes.swift`, `TimeFitLiveActivityIntents.swift`, `TimeFitLiveActivityModule.swift`, `TimeFitLiveActivityModuleBridge.m`, `TimeFitLiveActivityDiagnostics.swift`: receipt 성공 뒤 pending signal, React Native event bridge, route 진단 enum과 native revision `.3`.
- `src/ui/AppFlowContext.tsx`, `src/ui/liveActivity/nativeLiveActivityPort.ts`: native pending signal 구독 및 동일 run reconcile/read 직렬화.
- `src/ui/liveActivity/PendingNavigationRouteBridge.tsx`, `pendingNavigationRouteModel.ts`, `App.tsx`, `src/ui/HomeScreen.tsx`: 화면별 Home effect를 전역 단일 navigation-ready 경계로 교체.
- `src/ui/execution/schedule.ts`, `src/ui/CourseConfirmScreen.tsx`, `src/ui/ExecutionScreen.tsx`, `src/ui/liveActivity/a3VerificationComposition.ts`, `a3VerificationModel.ts`, `liveActivityDiagnosticsModel.ts`: app/HTTPS/browser 수락 시점 분리, route 진단, 모든 호출자의 typed 성공 의미 정렬.
- `test/ui/execution-schedule.test.ts`, `live-activity-pending-navigation.test.ts`, `live-activity-config-plugin.test.mjs`, `live-activity-diagnostics.test.ts`, `place-course-screen-runtime.test.mjs`, `test/map-transport-ui-contract.test.mjs`: 실패 선행 및 호출 순서·native 생성·실제 CourseConfirm entry 회귀.
- `ios/mobile/*`, `ios/TimeFitLiveActivityExtension/*`: config plugin으로 위 native source를 재생성·동기화했다.

#### 2. 유지한 공개 계약·정책 경계

- 명시 departure receipt와 외부 handoff 성공은 분리하며, 성공 전 `routeOpened=false`다. 불명확 실행은 자동 재호출하지 않고 기존 CTA의 명시 재시도만 허용한다.
- 승인된 active snapshot/courseRunId만 재사용하고 좌표·URL을 pending payload나 진단에 저장하지 않는다. 다른 run/stale/손상/완료 요청은 adapter 0회다.
- 브라우저 dismiss를 성공으로 보지 않으며, handoff 전 Activity 선시작도 하지 않는다. 이미 수락된 외부 전환 뒤 Activity request 실패가 외부 전환 자체를 취소한 것으로 표시되지 않는 기존 계약을 유지한다.
- 일반 도착/출발 UI, 도착 성공 공유 상태, 추천 엔진·외부 provider 구현·DB·서버 개인화·미동의 표본·Live Activity 권한과 App Group은 변경하지 않았다.

#### 3. 실행한 테스트와 결과

- 실패 선행: browser Promise 미종료 fixture와 native pending event/RCTEventEmitter fixture는 구현 전 실패를 확인했다. 구현 중 전체 UI의 과거 schedule mock 5건과 정적 route 계약 1건이 새 typed export/lifecycle 경계를 반영하지 못해 실패했고 fixture 계약을 갱신한 뒤 재실행했다. 기존 실패를 삭제하거나 skip하지 않았다.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: PASS — 488개 중 487 pass, 기존 1 skip.
- `npm test`: PASS — 236/236.
- 대상 회귀: execution+pending 9/9, config plugin 8/8, production CourseConfirm screen 19/19 PASS.
- `npx expo export --platform ios`: PASS.
- `npx expo prebuild --platform ios --no-install`: 2회 PASS; 생성 main/extension source가 template과 `.3` signal/diagnostic을 동일하게 포함함을 확인했다.
- `xcodebuild ... -configuration Debug -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO build`: PASS.
- `xcodebuild ... -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO build`: PASS. main 앱과 `TimeFitLiveActivityExtension` 모두 컴파일됐으며 AppIntents metadata 추출도 성공했다.
- `git diff --check`: PASS.
- Simulator 및 운영 API는 실행하지 않았다.

#### 4. 다음 결정·위험·실기기 재현 조건

- native/JS 식별값은 `ula-button-diagnostic-2026-09-06.3`이다. 앱 삭제 없이 이 source의 **internal Release 새 빌드**를 덮어 설치해야 한다.
- 실기기 미확인 1회 흐름: 일반 현재시각/부산 수동 입력 1곳 코스 → 첫 길찾기 → TimeFit/브라우저로 돌아가거나 browser를 닫지 않은 채 잠금화면 Activity 표시 확인 → 잠금화면 도착 1회로 즉시 머무는 중 확인 → 출발 1회 → 필요한 잠금 해제 → 앱 CTA 추가 탭 없이 최종 목적지 Kakao 길찾기 확인.
- 위 흐름에서 실패하면 반복 실행하지 말고 `Live Activity 버튼 진단`을 한 번 복사한다. `.3`의 `route app_check_started/app_unavailable/app_open_failed/web_open_failed/browser_*`와 `pending_signal_received/app_reconcile_completed/pending_consume_result` 순서로 설치 카카오맵이 browser에 도달한 최초 실패 경계와 background Activity request의 실제 OS 허용 여부를 판별한다.
- 자동 검증은 외부 URL의 OS 수락과 dismiss 이전 continuation까지만 증명한다. 실제 카카오맵 내부 길찾기 표시, background 상태의 Activity 생성, 잠금 해제 후 자동 전환 성공은 실기기 확인 전 **미확인**이며 이 문서는 완료 수락으로 표시하지 않는다.

### 추가 반환 보완 — 첫 길찾기 즉시 Live Activity 준비 (2026-09-06)

상태: **첫 번째 문제 구현·자동/Release compile·사용자 실기기 확인 완료**. 사용자가 지시한 순서에 따라 이 보완에서는 출발 자동 길찾기를 수정하지 않았고, 이후 아래 반환 보완에서 별도로 수정했다.

이전 방식 → 카카오 app/HTTPS/browser 전환 수락 뒤 `afterHandoff`에서 로컬 진행 저장과 `Activity.request`를 실행했다. 실제 iOS에서는 외부 앱 전환 직후 JS가 background/suspend되어 로컬 상태만 먼저 저장되고 Activity 생성이 실패하거나 중단될 수 있었다. foreground reconcile은 새 receipt가 있을 때만 Activity update를 시도하므로 앱 복귀만으로 누락 Activity를 복구하지 못했고, 앱의 `도착했어요`가 revision을 바꿀 때 update→not_found→start가 실행되어 그제야 Activity가 나타났다. 상태: **철회**.

교체 방식 → 최초 travel CTA의 동기 lock 안에서 알림 선택을 마친 뒤 검증 snapshot으로 로컬 진행과 Live Activity를 foreground에서 먼저 준비하고, 그 완료 뒤 카카오 handoff를 실행한다. 외부 handoff가 실패하면 이 시도에서 새로 만든 initial local/Activity/알림만 `cancelled` cleanup으로 되돌린다. 좌표가 유효하지 않으면 준비 전에 거절한다. `routeOpened=true`는 계속 외부 handoff 성공 뒤에만 기록한다. 교체 이유: iOS 외부 전환이 JS를 suspend하기 전에 `Activity.request`를 끝내면서도 실패한 길찾기에 Activity가 남지 않게 하기 위함이다. 이 사용자 반환 결정은 위 명령의 `handoff 전 Activity 선시작 금지`를 **최초 travel의 rollback 가능한 준비에 한해서만 대체**하며 다음 travel과 일반 route 성공 판정에는 확장하지 않는다. 상태: **현행 구현 / 실기기 수락 전**.

#### 1. 변경 파일과 변경 목적

- `src/ui/CourseConfirmScreen.tsx`: 첫 구간에서 `Activity 준비 → 카카오 전환` 순서를 적용하고, 외부 실패 시 exact initial run cleanup을 연결했다. 다음 구간·Live Activity 출발 pending 소비 코드는 변경하지 않았다.
- `src/ui/execution/schedule.ts`: Activity 준비 전에도 같은 좌표 유효성 계약을 사용할 수 있도록 순수 `isValidKakaoRouteStage` 경계를 공개했다.
- `test/ui/place-course-screen-runtime.test.mjs`: production CourseConfirm을 실행해 기존 `route → Activity` 순서를 실패 선행으로 재현하고, `Activity → route → 실패 rollback`, invalid 좌표 준비0, 성공 시 진행 전이를 검증했다.

#### 2. 유지한 공개 계약·정책 경계

- 최초 Activity 준비는 검증된 동일 `courseRunId`·snapshot만 사용한다. 추천 엔진, 외부 provider/API 구현, DB, 서버 개인화, 좌표 저장, App Group, 권한 및 도착/출발 Intent 계약은 변경하지 않았다.
- 외부 handoff 실패/invalid에서는 `routeOpened=false`와 현재 화면을 유지한다. Activity 실패가 카카오 길찾기를 막지 않는 기존 fail-open 계약도 유지한다.
- 정상 동작한 잠금화면 도착과 앱/Activity 공유 상태는 유지했다. 두 번째 문제인 `이제 출발해요 → TimeFit만 열림`의 pending/foreground 경계는 사용자 지시에 따라 후속 작업으로 남겼다.

#### 3. 실행한 테스트와 결과

- 실패 선행: 새 production 화면 fixture가 구현 전 실제 호출 순서 `route`만 관찰하여 기대 `activity → route → rollback`으로 실패했다. 구현 후 동일 fixture PASS.
- 대상 화면 회귀 `node --test test/ui/place-course-screen-runtime.test.mjs`: 20/20 PASS.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: 237/237 PASS, skip 0.
- `npm test`: PASS — 전체 테스트 발견 경계 1/1.
- `npx expo export --platform ios`: PASS — iOS bundle 생성.
- `xcodebuild ... -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO build`: PASS — main과 Live Activity extension 포함. Simulator는 실행하지 않았다.

#### 4. 다음 결정·위험·재현 조건

- JS bundle 순서가 바뀌었으므로 앱 삭제 없이 새 internal Release를 덮어 설치해야 한다. 일반 1곳 코스에서 `코스 시작 → 카카오맵에서 길찾기`를 한 번 누르고, 카카오맵을 닫거나 TimeFit으로 복귀하지 않은 상태에서 잠금화면 Live Activity가 보이는지 확인한다.
- 자동 검증은 Activity 호출이 외부 handoff보다 앞서고 실패 시 cleanup되는 것까지 증명한다. 사용자가 실기기에서 첫 카카오맵 길찾기 직후 앱으로 복귀하지 않아도 Live Activity가 표시되는 것을 확인했다.
- 첫 문제의 실기기 확인은 **PASS**다. 두 번째 출발 자동 길찾기는 아래 별도 반환 보완과 새 internal Release 확인 대상으로 이어진다.

### 추가 반환 보완 — Live Activity 출발 뒤 카카오맵 자동 연결 (2026-09-06)

상태: **잠금 결함 구현·자동/Release compile 완료 / 새 internal Release 실기기 실패 / 단독 원인 판정 철회·수락 반려**.

이전 방식 → 첫 카카오맵 handoff가 앱을 background/suspend한 동안 `openTravel`의 boolean 화면 lock을 비동기 `finally`까지 유지했다. Live Activity의 `이제 출발해요`가 TimeFit을 활성화하고 유효 pending을 전달해도, 이미 열린 CourseConfirm의 소비기가 `pending → executing`으로 claim한 뒤 이 lock에서 거절됐다. 따라서 카카오맵 adapter는 0회였고 사용자는 TimeFit 화면만 보았다. 상태: **철회**.

교체 방식 → route lock을 시도별 token lease로 바꾸고 실제 `background → active` 복귀에서 이전 외부 handoff의 lease만 무효화한다. Live Activity pending 소비는 복귀한 같은 CourseConfirm에서 잠금 없이 정확한 snapshot 다음 구간을 연다. 이전 handoff의 늦은 `finally`는 자기 token만 반환할 수 있어 새 출발 시도의 lock을 해제하지 못한다. 권한 대화상자의 `inactive → active`에는 reset하지 않으므로 일반 중복 탭 방지는 유지한다. 상태: **현행 구현 / 실기기 수락 전**.

#### 1. 변경 파일과 변경 목적

- `src/ui/recommendation/verifiedCourseProgressModel.ts`: boolean lock을 token lease로 교체하고 외부 앱 복귀 시 이전 소유권만 폐기하는 `resetForExternalReturn()` 경계를 추가했다.
- `src/ui/CourseConfirmScreen.tsx`: 실제 `background → active`를 관찰해 중단된 최초 길찾기 lock과 표시 중 상태를 복구한 뒤 기존 pending 소비기가 다음 route를 자동 실행하게 했다.
- `test/ui/verified-course-progress.test.ts`: 늦은 이전 `finally`가 새 시도의 lock을 풀 수 없는 소유권 회귀를 추가했다.
- `test/ui/place-course-screen-runtime.test.mjs`: 첫 카카오 route Promise가 suspend된 production 화면에서 Live Activity 출발 pending을 주입해 추가 CTA 없이 2곳의 다음 장소와 1곳의 최종 목적지 route가 각각 정확히 1회 열리는 실패 선행/회귀 fixture를 추가했다.

#### 2. 유지한 공개 계약·정책 경계

- `이제 출발해요`의 명시 departure receipt, 동일 `courseRunId`, 승인된 snapshot, pending claim/success/cleanup과 `routeOpened=true` 전이는 기존 계약을 그대로 사용한다. 다른 run, stale/손상/완료 pending의 adapter 0회 계약도 바꾸지 않았다.
- 카카오 app-scheme → HTTPS/browser fallback, 좌표와 다음 travel 선택, 정상 동작한 도착 버튼 및 앱·Live Activity 공유 상태를 변경하지 않았다.
- 추천 엔진, 외부 API/provider, DB repository, 서버 개인화, 미동의 표본, App Group·entitlement·native Intent를 변경하지 않았다. 화면 문구와 별도 앱 CTA도 추가하지 않았다.

#### 3. 실행한 테스트와 결과

- 실패 선행: 첫 카카오 route Promise를 의도적으로 미완료 상태로 둔 실제 CourseConfirm fixture에서 Live Activity departure pending을 소비하면 두 번째 route가 열리지 않고 첫 route만 남는 실패를 구현 전에 확인했다.
- 구현 후 동일 회귀: 2곳 `첫 장소 → 다음 장소`와 1곳 `첫 장소 → 최종 도착지` 모두 TimeFit 활성화 뒤 추가 화면 탭 없이 route 1회, pending cleanup, 다음 travel의 `routeOpened=true`를 확인했다.
- `npx tsx --test test/ui/verified-course-progress.test.ts`: PASS — 13/13.
- `npx tsx --test test/ui/live-activity-pending-navigation.test.ts test/ui/verified-course-progress.test.ts test/ui/execution-schedule.test.ts`: PASS — 22/22.
- `node --test test/ui/place-course-screen-runtime.test.mjs`: PASS — 22/22.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: PASS — 492개 중 491 pass, 기존 1 skip.
- `npm test`: PASS — 저장소 전체 테스트 발견 경계 1/1.
- `npx expo export --platform ios`: PASS.
- `xcodebuild -workspace ios/mobile.xcworkspace -scheme mobile -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO build`: PASS — main 앱과 Live Activity Extension 포함.
- `git diff --check`: PASS. Simulator·실기기 자동 조작·운영 API는 실행하지 않았다.

#### 4. 다음 결정·위험·실기기 재현 조건

- 이번 변경은 native source/entitlement가 아니라 앱 JS bundle 변경이다. 앱 삭제는 필요 없지만 수정 bundle을 포함한 **새 internal Release 덮어 설치**가 필요하다. native 진단 식별값 `.3`은 그대로다.
- 제한 실기기 확인: 일반 현재시각 1곳 코스 → 첫 카카오맵 길찾기 → 잠금화면에서 `도착했어요` → 체류 완료 뒤 `이제 출발해요` 1회 → 필요한 잠금 해제 → TimeFit 화면에서 아무 버튼도 누르지 않고 최종 목적지 카카오맵 길찾기가 자동 표시되는지 확인한다.
- 자동 검증은 production 화면의 suspended Promise와 background/active 순서를 재현해 adapter 호출·상태 전이까지 증명한다. iOS가 실제 잠금화면 Intent에서 앱을 활성화한 뒤 Kakao scheme을 연속 허용하는지는 새 internal Release 실기기 확인 전 **미확인**이다.
- 실패하면 앱 길찾기 CTA를 대신 누르거나 반복하지 않고 `Live Activity 버튼 진단`을 한 번 복사한다. `pending_consume_result`와 route stage 순서로 pending claim 이후 OS URL 실행 단계의 새 실패 여부를 구분한다.

#### 사용자 실기기 반환 — 2026-09-06

- 관찰: 새 internal Release에서도 Live Activity의 `이제 출발해요`를 누르면 TimeFit은 열리지만 카카오맵 길찾기는 자동으로 열리지 않았다. 따라서 앞서 재현한 suspend lock은 실제 결함이지만 **실기기 현상의 단독 원인은 아니다**. 자동 fixture 통과를 실기기 해결로 승격한 판단은 철회한다.
- 현재 분기: `pending_claim_requested` 또는 `pending_consume_result`가 없다면 receipt/pending 복구·화면 소비 전 실패다. route의 `app_check_started` 이후 기록이 있다면 소비는 도달했고 app scheme의 OS 실행 단계 실패다. `app_open_accepted`인데 화면 전환이 없다면 OS 수락 반환과 실제 앱 전환의 불일치다.
- 다음 근거: 동일 실패 직후 internal 화면의 `Live Activity 버튼 진단 → 진단 조회 → 진단 복사` 결과 한 건으로 마지막 성공/최초 실패를 확정한다. 좌표·URL·사용자 ID가 없는 enum만 포함하므로 공개 계약을 바꾸지 않는다. 그 전에는 timer, 임의 재호출, 추가 앱 CTA 또는 native route 저장을 넣지 않는다.

#### 완료 인수인계 — 실기기 진단 기반 native revision 연속성 보완 (2026-09-06)

상태: **실기기 원인 확정·`.4` 구현·자동/native Release 검증 완료 / 새 internal Release의 새 코스 실기기 확인 전**.

관찰 → 사용자가 제공한 `.3` 진단에서 도착은 `receipt_write_after=succeeded`, `activity_update_requested=started`까지 성공했지만, 직후 동일 `Activity` 인스턴스의 content가 아직 `traveling/revision 1`이라 `activity_update_observed=failed`로 기록됐다. Intent는 여기서 실패해 `target_write_before`에 도달하지 않았다. 앱은 receipt를 정상 수락해 `dwelling/revision 2`로 복구했지만 target record는 revision 1에 머물렀다. 이어진 출발 Intent는 revision 2로 진입한 뒤 `target_lookup=target_record_mismatch`에서 거절됐고 `pending_write_before`조차 없었다. `openAppWhenRun`만 적용되어 TimeFit만 열린 현상과 정확히 일치한다. 첫 route의 `app_unavailable → web_open_failed → browser_background_observed`는 별도 fallback 경로이며 이번 출발 실패보다 앞선 정상 Activity 시작 시도다.

이전 방식 → `await activity.update(...)` 반환 직후 기존 `activity.content.state`가 새 phase/revision인지 동기 검증했다. ActivityKit snapshot 반영이 지연되면 실제 update 요청과 도착 receipt가 정상이어도 실패로 오판하여 다음 Intent가 필요한 target revision 저장을 건너뛰었다. 상태: **철회**.

교체 방식 → 단일 writer가 만든 `next`를 update 요청의 확정 입력으로 사용하고 `await activity.update` 반환을 `activity_update_completed`로 기록한 뒤 exact identity의 target record를 다음 revision으로 저장한다. 다음 버튼은 그 target record와 자신이 가진 run/stop/revision을 다시 엄격히 비교한다. 임의 sleep, 느슨한 revision 비교, 첫 Activity 임의 선택 또는 앱 버튼 대체는 없다. 상태: **현행 구현 / 실기기 수락 전**.

##### 1. 변경 파일과 변경 목적

- `plugins/live-activity/TimeFitLiveActivityIntents.swift`: update 직후 stale snapshot 동기 검증을 제거하고 다음 revision target 저장을 끊김 없이 수행하도록 수정했다. 진단 단계는 실제 의미에 맞춰 `activity_update_completed`로 교체했다.
- `plugins/live-activity/TimeFitLiveActivityDiagnostics.swift`, `src/ui/liveActivity/liveActivityDiagnosticsModel.ts`: native/JS 식별값을 `ula-button-diagnostic-2026-09-06.4`로 올렸다.
- `ios/mobile/TimeFitLiveActivityIntents.swift`, `ios/TimeFitLiveActivityExtension/TimeFitLiveActivityIntents.swift`, 양 target의 diagnostics 생성물: config plugin prebuild로 원본과 동기화했다.
- `test/ui/live-activity-config-plugin.test.mjs`, `test/ui/live-activity-diagnostics.test.ts`: stale snapshot guard가 target 저장을 막지 않는 실패 선행 계약과 `.4` 식별값을 반영했다.

##### 2. 유지한 공개 계약·정책 경계

- courseRunId/stopId/revision exact target 검증, 단일 Activity 소유권, immutable receipt, departure pending 저장·claim·cleanup, 같은 snapshot의 다음 travel 선택을 완화하지 않았다.
- 도착/출발 시각 멱등성, 정상 도착 UI, 카카오 app-scheme → HTTPS/browser fallback, 화면 자동 소비와 token route lock을 유지했다.
- 좌표·URL을 native pending/진단에 추가하지 않았다. 추천 엔진, 외부 API/provider, DB, 서버 개인화, 알림 동의, App Group/entitlement는 변경하지 않았다.

##### 3. 실행한 테스트와 결과

- 실패 선행: native Intent 원본에 `await activity.update` 직후 stale `activity.content.state` guard가 존재하고 `activity_update_completed` 뒤 target 저장 계약이 없어 새 테스트가 실패하는 것을 확인했다. 구현 후 동일 테스트 PASS.
- `node --test test/ui/live-activity-config-plugin.test.mjs`: PASS — 9/9.
- `npx tsx --test test/ui/live-activity-diagnostics.test.ts`: PASS — 2/2. 일반 Node로 `.ts`를 잘못 호출한 1회는 loader 오류로 시작 전에 실패했고 올바른 저장소 loader로 재실행했다.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: PASS — 493개 중 492 pass, 기존 1 skip. 첫 병렬 실행은 sandbox의 tsx IPC `EPERM`으로 시작 전에 중단됐고 단독 동일 명령은 통과했다.
- `npm test`: PASS — 전체 테스트 발견 경계 1/1.
- `npx expo prebuild --platform ios --no-install`: PASS — main/extension 모두 `.4`와 `activity_update_completed` 동기화 확인.
- `npx expo export --platform ios`: PASS.
- `xcodebuild -workspace ios/mobile.xcworkspace -scheme mobile -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO build`: PASS — main 앱, Live Activity Extension, AppIntents metadata 포함.
- `git diff --check`: PASS. Simulator·실기기 자동 조작·운영 API는 실행하지 않았다.

##### 4. 다음 결정·위험·실기기 재현 조건

- native Intent가 바뀌었으므로 `.4`를 포함한 새 internal Release를 앱 삭제 없이 덮어 설치해야 한다. 진단의 build line에서 `native=ula-button-diagnostic-2026-09-06.4`, `js=... .4`를 확인한다.
- `.3`에서 이미 도착 처리한 기존 Activity는 target record가 revision 1에 멈춘 손상 run이므로 이번 수정으로 소급 복구하지 않는다. 설치 후 기존 코스를 명시 종료하고 **새 1곳 코스와 새 Activity**로 한 번 검증한다.
- 기대 순서: 도착 Intent의 `activity_update_completed → target_write_before → target_write_after → perform_completed`, 출발 Intent의 `target_lookup=succeeded → pending_write_after → receipt_write_after → activity_update_completed → target_write_after → perform_completed`, 앱의 `pending_claim_requested → route app_check_started → pending_consume_result`이다. 사용자는 `이제 출발해요` 이후 TimeFit에서 추가 버튼을 누르지 않고 카카오맵 최종 목적지 길찾기를 확인한다.
- 자동/native compile은 revision 연속성과 pending 소비 경계를 검증하지만 실제 iOS 연속 앱 전환은 새 `.4` 실기기 확인 전 **미확인**이다. 실패하면 해당 새 run의 진단만 한 번 복사한다.

#### 완료 인수인계 — `.4` 실기기 orphan pending 충돌 보완 (2026-09-06)

상태: **원인 확정·`.5` 구현·자동/native Release 검증·사용자 실기기 확인 완료 / 수락**.

관찰 → `.4` 도착 Intent는 `activity_update_completed → target_write_after → perform_completed`로 revision 2를 정상 연결했다. 출발 Intent도 `target_lookup=succeeded`였지만 `pending_write_after=pending_write_failed`에서 중단됐다. 앱에는 `pending_claim_requested`가 없었으므로 카카오 adapter 이전 실패다. 기존 단일 pending 파일이 다른 action/run을 담고 있었고, 새 run 시작 시 Activity 충돌은 정리됐어도 orphan pending은 남아 `create`의 fail-closed 충돌을 일으켰다. 상태: **실기기 확정**.

이전 방식 → pending slot에 어떤 기존 action이든 있으면 동일 action 외의 새 departure를 모두 거절했다. 종료된 run의 orphan과 아직 활성인 run의 실제 충돌을 구분하지 못했다. 상태: **철회**.

교체 방식 → pending 생성 시 현재 `course_progress` Activity들의 run 집합을 확인한다. 기존 pending의 run이 아직 활성이라면 계속 거절하고, 요청과 동일 action/run이면 멱등 재사용한다. 기존 pending의 run에 활성 Activity가 없는 경우에만 orphan으로 판정해 새 pending을 atomic write로 교체하고 `pending_orphan_replaced`를 기록한다. 같은 run의 다른 action은 중복 방지를 위해 계속 거절한다. 상태: **현행 구현 / 사용자 실기기 수락**.

##### 1. 변경 파일과 변경 목적

- `plugins/live-activity/TimeFitNativeIntentPolicy.swift`: reuse / replaceOrphan / reject의 순수 pending 생성 결정을 추가했다.
- `plugins/live-activity/TimeFitActivityAttributes.swift`: 활성 run 집합을 받아 종료 run orphan만 교체하는 pending store 경계를 구현했다.
- `plugins/live-activity/TimeFitLiveActivityIntents.swift`: Activity inventory를 pending 생성에 전달하고 orphan 교체를 비밀 없는 진단 단계에 남겼다.
- `plugins/live-activity/TimeFitLiveActivityDiagnostics.swift`, `src/ui/liveActivity/liveActivityDiagnosticsModel.ts`: native/JS revision을 `ula-button-diagnostic-2026-09-06.5`로 올렸다.
- `ios/mobile/*`, `ios/TimeFitLiveActivityExtension/*`: config plugin으로 policy/store/Intent/diagnostics를 양 target에 동기화했다.
- `test/ui/fixtures/TimeFitNativeIntentPolicyHarness.swift`, `test/ui/live-activity-native-policy.test.mjs`, `test/ui/live-activity-config-plugin.test.mjs`, `test/ui/live-activity-diagnostics.test.ts`: orphan 교체, 활성 run 충돌 보존, 동일 action 멱등, 같은 run 다른 action 거절을 실패 선행 및 native harness로 검증했다.

##### 2. 유지한 공개 계약·정책 경계

- 활성 다른 run의 pending은 덮어쓰지 않고 충돌로 유지한다. 같은 run의 중복 action도 교체하지 않는다.
- courseRunId/stopId/revision exact target, immutable receipt, pending claim/success/failure/cleanup, 다음 snapshot travel 1회 및 `routeOpened` 성공 후 전이를 유지했다.
- 좌표·URL·장소/사용자 ID를 pending 또는 진단에 추가하지 않았다. 추천, 외부 API/provider, DB, 서버 개인화, App Group/entitlement와 화면 UI는 변경하지 않았다.

##### 3. 실행한 테스트와 결과

- 실패 선행: config 계약은 active run 집합과 orphan 교체가 없어 실패했고, native Swift harness는 `pendingCreation` 부재로 compile 실패했다. 구현 후 동일 테스트 통과.
- config plugin 10/10, native Swift policy harness 2/2, diagnostics+pending targeted 8/8 PASS.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: PASS — 494개 중 493 pass, 기존 1 skip.
- `npm test`: PASS — 241/241.
- `npx expo prebuild --platform ios --no-install`: PASS.
- `npx expo export --platform ios`: PASS.
- `xcodebuild -workspace ios/mobile.xcworkspace -scheme mobile -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO build`: PASS — main/Extension/AppIntents metadata 포함.
- `git diff --check`: PASS. Simulator·실기기 자동 조작·운영 API는 실행하지 않았다.

##### 4. 다음 결정·위험·최종 실기기 결과

- `.5` native build를 앱 삭제 없이 덮어 설치하고 새 코스로 확인했다. 사용자는 Live Activity의 `이제 출발해요` 뒤 TimeFit이 열린 다음 추가 앱 CTA 없이 목적지 카카오맵 길찾기가 열리는 것을 확인했다. 상태: **PASS**.
- `pending_orphan_replaced`는 orphan이 실제 존재할 때만 나타나는 조건부 정상 단계다. 없다는 이유만으로 실패로 판정하지 않으며, 신규 slot은 바로 `pending_write_after=succeeded`로 진행한다.
- 결정 세션은 `.3`의 즉시 Activity snapshot 검증과 모든 기존 pending을 무조건 거절하는 `.4` 방식을 복원하지 않는다. active run 충돌을 느슨하게 덮어쓰는 방식도 금지한다.
- 남은 별도 위험: 초기 route 진단에서 카카오 app check와 HTTPS가 실패해 browser fallback으로 간 관찰이 있었다. 최종 사용자 기대인 카카오맵 길찾기 표시는 통과했지만, 설치된 카카오맵의 app-scheme 판정 실패가 반복된다면 이 수락과 분리해 route adapter/config 작업으로 다룬다.


## 과거 실행 명령 — U-LIVE-ACTIVITY-01 잠금화면 버튼 진단 (2026-09-06, 완료·대체됨)

상태: **완료·상단 현행 결론으로 대체됨**. 아래 내용은 `.3` 이전의 진단 명령과 당시 미확정 상태를 보존한 이력이다. 현재 실행 기준이나 수락 상태로 사용하지 않는다.

### 당시 사용자 재현과 분리했던 문제

- Debug/Release 모두 잠금화면 도착했어요가 무반응이다. 앱의 도착했어요는 Activity를 머무는 중으로 바꾼다.
- Release의 이제 출발해요는 앱을 열지만 원하는 상태 처리/자동 길찾기 성공은 확인되지 않았다. 앱 열림 자체는 Intent 업무 처리 성공의 증거가 아니다.
- 브라우저 fallback 체크 버튼으로 닫은 뒤에야 Activity가 시작되는 별도 현상이 있다. openBrowserAsync 완료 시점과 시작 호출의 결합 문제는 별도 항목으로 기록하고 이번 진단에서 무단 변경하지 않는다.
- 예정 도착 시각 전 도착을 허용하는 정책은 유지한다. 앱 재확인/반복 탭/앱 삭제/빌드 모드 변경으로 문제를 우회하지 않는다.

### UIUX 진단 실행 명령

```text
U-LIVE-ACTIVITY-01의 “잠금화면 버튼 진단 (2026-09-06)”을 수행해.

1. 범위와 시작점
AGENTS.md, docs/README.md, 본 절과 최신 Intent 보완 인계, DEC-LIVE-ACTION-HANDOFF-01을 읽어. 실제 설치 후보의 main/extension bundle version·native source revision·JS bundle 식별값을 확인할 방법을 마련해. 생성 소스와 plugin, main/extension target membership·AppIntents metadata·entitlement·서명을 읽기 전용으로 대조해. 키/서명 비밀/프로파일 원문을 출력하지 마. 기존 membership 누락 수정만으로 해결되지 않았다는 사용자 결과를 기준으로 시작해.

2. 관찰 가능성부터 보완
현재 진단은 마지막 1건 파일을 app_reconcile이 덮고 readIntentDiagnostic의 앱 표시 연결이 없다. 기능 정책을 바꾸지 않는 범위에서 다음 진단만 구현해.
- Intent 실행 진입, target lookup 결과, receipt 쓰기 전/후, Activity update 요청/관찰 결과, target 저장 전/후, perform 완료/실패를 구분한다.
- 앱 boot/foreground, receipt 읽기/수락/거절 사유, 화면 진행 반영, pending action 소비 결과를 Intent 기록과 별도 스트림으로 남긴다. 복귀 기록이 버튼 기록을 덮지 않게 한다.
- 단일 마지막 값 대신 짧은 유한 이력을 사용한다. 예: 스트림당 최근 32건. main/extension의 동시 쓰기에도 기록이 유실되지 않는 저장 방법을 사용한다. 진단 쓰기 실패가 업무 로직을 실패시키지 않게 한다.
- 로그 필드는 schema/build 식별, action 종류, attempt 상관관계용 불투명 ID, stage/result/error enum, phase/revision 및 동일성 비교 boolean으로 제한한다. 실제 run ID·장소 ID/명칭·좌표·주소·사용자 ID·원시 도착출발 시각·토큰·전체 payload는 노출하지 않는다.
- App Group 진단 쓰기 자체가 실패할 가능성을 구분한다. 비밀 없는 native unified log 등 독립 진단 경로를 준비한다. 진단 없음만으로 perform 미진입을 단정하지 않는다.
- internal에서 읽기 전용 “Live Activity 버튼 진단”을 제공하고 조회 실패/진단 없음/현재 빌드/기록을 구분한다. 복사 기능은 허용된 필드만 전달한다. 새 env를 임의 요구하지 말고 기존 internal 경계를 재사용하되 Release 검증 빌드에서 조회 가능한지 실제 확인한다.
- 새 관찰 시작 또는 진단 초기화는 진단만 대상으로 한다. 실제 Activity/receipt/pending/course/history를 지우거나 자동 버튼을 대신 실행하지 않는다.
- 진단용 main/extension 표시가 실제 배포 빌드에 노출되지 않는 기준을 명시한다. 상세 로그는 bounded·로컬 전용이며 서버 전송0이다.

3. 판별 기준
A. perform 진입이 확인되지 않음: 먼저 진단 저장/읽기 경로의 생존을 독립 확인한 뒤 실제 설치 artifact의 AppIntent discovery/metadata/target, OS 실행 로그를 확인한다. UI에 버튼이 있다는 것과 Intent 등록은 구분한다.
B. perform 진입 후 target 거절: Activity inventory와 저장 target의 run/stop/revision 비교 결과로 어떤 비교가 어긋나는지 식별한다. 비교를 풀거나 첫 Activity를 대신 선택하지 않는다.
C. receipt 쓰기 실패: App Group 접근·파일 보호·decode/schema·쓰기 실패를 구분한다. 전체 초기화 금지.
D. receipt 성공/Activity 미변경: update 호출 여부와 후속 상태를 따로 관찰한다. 업데이트 요청 직후 조회가 다르다는 것만으로 최종 실패를 단정하지 말고 OS 반환/유한 후속 관찰을 사용한다. 임의 sleep을 제품 해결책으로 넣지 않는다.
E. Activity 변경/앱 미반영: receipt 조회, reducer 거절 사유, revision, 상태 복구/화면 선택 단계까지 대조한다.
F. 출발 앱 열림/후속 미실행: pending 내구 저장, receipt 선복구, 앱 활성화, 요청 claim, adapter 호출/결과를 추적한다. 추가 실제 handoff 시험은 도착 원인 확인 후 필요한 경우에만 요청한다.

4. 실패 선행과 자동 검증
진단 append/상한/스트림 분리/조회 연결/비밀 필드 제외/진단 저장 실패에도 제품 동작 불변을 fixture로 먼저 검증한다. main/extension 동시 기록·앱 복귀 이후 Intent 기록 보존을 포함한다. 진단 주입은 실제 버튼 테스트와 구분하며 fake perform 성공을 실기기 버튼 성공으로 기록하지 않는다.
npm run test:typecheck, npm run test:ui, npm test, iOS export, 변경 native main+extension 빌드, plugin 재생성 정합성, git diff --check를 실행하고 결과를 남긴다. 실패 skip/삭제 금지. 소스 정규식 검사/컴파일만으로 실제 Intent 실행을 통과 처리하지 않는다.

5. 사용자에게 요청할 제한 실기기 절차
새 진단 포함 internal Release 빌드를 앱 삭제 없이 설치하고 식별값 확인 → 일반 현재시각/부산 수동 장소로 한 곳 코스 생성 → 실제 Activity 이동 중 표시까지 확보 → 잠금화면 도착했어요 딱 1회 → Activity 상태 확인 → 앱에 들어와 도착 버튼을 누르지 말고 진단 화면을 조회/복사.
기존 활성 코스를 재사용할 수 있으면 불필요한 추천/API 재호출을 피한다. 이전 빌드 Activity인지 구분이 안 되면 기존 앱의 정상 취소 후 1회만 새 코스를 만든다. 시뮬레이터 수동 순회나 수차례 삭제/재빌드는 요구하지 않는다. 사용자 결과가 필요하면 진단 준비 완료까지만 보고하고 대기한다.

6. 완료 인수인계
변경 파일/유지 계약/실행 결과/남은 위험 네 항목과 함께 아래를 작성한다.
- 사용자 관찰, 설치 빌드, 마지막 성공 경계, 최초 실패 경계, 관련 코드 위치.
- 확정 원인과 아직 가능한 가설을 분리하고 각각 근거를 붙인다.
- 원인에 맞는 최소 수정안과 영향 경계·필요 회귀를 제안한다. 진단 부재나 실기기 미확인은 “원인 미확정”으로 반환한다.
제품 기능/상태 정책/카카오 adapter/엔진/DB/catalog/env 변경, 새로운 권한·entitlement 변경, 실제 payload 수집, 원격 배포, commit/push는 하지 않는다. 진단 코드 외 수정이 필요하면 먼저 보고한다.
```

이번 완료 기준은 **진단을 읽을 수 있고 실패 경계를 증거로 설명하는 것**이다. 원인 수정 및 최종 실기기 수락과 혼동하지 않는다.


## 현재 실행 명령 — 잠금화면 도착 복구·출발 자동 길찾기 (2026-09-06)

상태: **실행 가능·구현 전**. 상위 DEC-LIVE-ACTION-HANDOFF-01 사용자 확정. 아래 B 보완 완료 결과를 보존하고 이번 범위를 이어서 수행한다. B 보완 재구현/서버 개인화 확장은 금지한다.

### 관찰과 목적

실기기에서 Live Activity 도착했어요를 눌러도 화면과 앱이 이동 중으로 남았다. 앱에서 같은 버튼을 누르자 Activity는 머무는 중으로 갱신됐다. 앱→Activity 경로 성공은 확인됐으나 Intent 실행/receipt 저장/reconcile 중 어느 경계의 실패인지는 미확정이다. 예정시각 전 확인 금지로 해결하지 않는다. 출발은 이제 출발해요 한 번으로 잠금 해제 후 다음 카카오맵까지 이어져야 한다.

이력: 잠금화면 확인 뒤 앱 재확인/출발 뒤 앱 길찾기 재탭 → 중복 행동과 네이티브 무반응 → 단일 도착 확정 및 명시 출발+pending handoff → 사용자 재조작 제거. 상태: 확정·구현 전. 기존 B의 “명시 출발만으로 handoff 성공으로 표시하지 않음”은 계속 유효하며, “자동 handoff를 요청하지 않음”만 대체한다.

### UIUX 세션 실행 명령

```text
U-LIVE-ACTIVITY-01의 “잠금화면 도착 복구·출발 자동 길찾기” 전체를 수행해.

1. AGENTS.md, docs/README.md, 상위 live-activity-dwell-personalization.md의 DEC-LIVE-ACTION-HANDOFF-01과 본 절, 최신 B 보완 인계를 읽는다. 변경 중인 파일과 네이티브 빌드 revision을 확인한다. 기존 로컬 run·receipt·single writer·completion 계약을 재사용한다.

2. 도착 무반응을 먼저 조사한다.
- Intent perform 진입, exact target 대조, receipt 내구 저장, Activity update, 앱 reconcile 각 경계의 성공/실패를 비밀 없는 error code로 구분한다. 키/좌표/주소/사용자 ID와 원시 체류 시각을 로그에 넣지 않는다.
- main/extension target membership, AppIntent 실행 프로세스, App Group entitlement, 잠금 상태 데이터 접근, run/stop/revision 불일치를 증거로 판별한다. 임의 sleep·시각 gate 제거·전체 초기화·앱 버튼 재탭을 해결책으로 쓰지 않는다.
- 현재 iOS17+ AppIntent/앱 활성화 API 지원은 공식 Apple 문서와 실제 native build로 확인한다. 단순 JS 테스트로 잠금화면 성공을 주장하지 않는다.
- 첫 유효 도착은 예정시각 전이어도 receipt를 보존하고 즉시 머무는 중으로 갱신한다. 앱이 정지돼 있어도 동작해야 하며 다음 앱 복귀에서 도착 버튼 재확인을 요구하지 않는다.
- 연속 탭/다른 채널/old revision은 도착 시각을 덮어쓰지 않는다. 실패 시 진단이 남아야 하며 예외를 조용히 삼켜 완료처럼 표시하지 않는다.

3. 이제 출발해요 → 잠금 해제 → 다음 길찾기를 구현한다.
- 유효한 현재 run/stop의 명시 출발을 최초 1회 기록하고 최소 pending navigation action을 내구 저장한다. actionId·run·stop·revision으로 연계하며 좌표/임의 URL을 공개 deep link에 넣지 않는다.
- 시스템이 요구하는 인증/잠금 해제를 거쳐 TimeFit을 활성화한다. 구현상 가능한 native 진입 순서를 먼저 검증하며 잠금 해제를 우회하거나 extension에서 임의 외부 앱 실행을 보장하지 않는다.
- cold start에서도 저장된 코스 복구 및 receipt 적용 완료 후에만 요청을 소비한다. 현재 승인된 immutable snapshot의 다음 구간을 기존 route adapter 입력으로 재수화한다. 현재 GPS나 추천 API로 다시 계산하지 않는다.
- 1곳은 최종 목적지/복귀, 2곳 첫 방문은 다음 방문지, 마지막 방문은 최종 목적지다. 담은 순서/URL 파라미터로 목적지를 임의 결정하지 않는다.
- 앱에서 길찾기 버튼을 다시 누르지 않아도 기존 Kakao fallback 경로를 한 번 시도한다. 앱 활성화 이벤트 자체를 무조건 자동 길찾기 trigger로 삼지 않는다.
- pending/실행 중/성공/실패/성공 불명확을 분리한다. cold/warm start 및 foreground 중복 callback, 동일 action 재전달에서 중복 외부 실행을 차단한다. 실행 시도 후 프로세스 종료로 성공 여부를 모르면 자동 반복하지 않고 재시도를 제공한다.
- 명시 departedAt은 버튼 최초 처리 시각이다. handoff 실패나 재시도는 이를 변경하거나 체류를 재시작하지 않는다. routeOpened와 다음 이동 성공 상태는 adapter 성공 때만 갱신한다. 일반 앱 길찾기의 기존 성공 시 출발 계약은 유지한다.
- 잠금 해제를 취소하거나 복구 실패하면 자동 성공 표시하지 않는다. 앱에 돌아왔을 때 보류/실패 상태 및 필요한 경우 한 번의 재시도를 제공한다. 사용자가 기존 코스를 취소/완료/교체했다면 이전 요청을 실행하지 않는다.
- public deep link는 자동 실행의 권한 근거가 아니다. native가 발행한 유효 요청과 현재 로컬 run을 검증한다. 변조/오래된 요청은 무시한다.
- 완료·취소·교체 cleanup에서 해당 pending action도 정리한다. 다른 run/fixture/unknown은 보존한다.

4. 먼저 실패하는 고정 fixture를 만들고 공개 entry로 검증한다.
- 예정 17:04/도착 16:48: native 도착 확인 후 즉시 dwelling, 앱 재진입도 동일, 도착 시각 1회.
- 앱 정지/종료 상태의 Intent, cold/warm launch, 중복 도착/출발, 늦은 receipt와 old revision.
- 출발 1회 → 활성화/복구 → 올바른 다음 구간 adapter 1회. 한 곳/두 곳/최종 복귀 모두 검증.
- 잠금 해제 취소, snapshot 없음/손상, 다른 run으로 교체, final completed, 변조 요청에서 잘못된 adapter 호출0.
- 외부 실패 및 재시도: 명시 출발 시각 불변, 성공 전 routeOpened=false; 중단으로 불명확하면 자동 재호출0.
- 기존 snooze1회, cleanup 부분 실패 복구, floor 체류시간, 완료 기록1건, 알림 거절·Activity 실패 회귀.

5. 검증/소유 경계.
- UIUX 소유 runtime/화면 연결/native plugin/관련 테스트만 수정한다. App.tsx/nav.ts가 필요하면 이 작업을 단일 작성자로 유지한다. 엔진/API 구현/DB schema/catalog/env/서버 개인화·원격 push·GPS는 변경하지 않는다.
- npm run test:typecheck, npm run test:ui, npm test, iOS export, main+extension native Debug/Release 검증, plugin 재생성 멱등성, git diff --check. Swift 정책 동작은 native 실행 하네스 또는 제한 기기로 검증하고 컴파일과 구분한다.
- 실제 API 반복 호출/Simulator 수동 순회는 하지 않는다. native 변경을 생성 ios에만 남기지 않는다. 권한·entitlement 추가가 필요하면 범위와 이유를 먼저 반환한다. commit/push하지 않는다.
- 변경 파일/원인과 유지 계약/실행 결과/실기기 미확인·제약을 인계한다. 실기기 사용자는 새 native build에서 “도착 1회→즉시 머무는 중→앱 상태 동일”, “출발1회→잠금 해제→추가 탭 없이 올바른 Kakao 구간”만 우선 확인하게 한다. 앱 삭제를 요구하지 않는다.
- 잠금 해제 취소부터 앱 재진입까지 실제 행동과 관찰값을 구체적으로 기록한다. 원인 미확정 또는 OS 경계 미검증이면 완료가 아니라 해당 경계를 보류로 반환한다.
```

통합 검토 후 기존 QA-LIVE-LOCAL-01에 본 결정의 반례와 실기기 관찰을 적용한다. 화면 전환/체류 동기화가 한 경계이므로 별도 UIUX 세션과 동시 수정하지 않는다.


## 현재 실행 명령 — B1~B6 수락 전 보완 (2026-09-06)

상태: **구현 보고 검토 후 보완 필요·최종 수락 보류**. 아래 명령이 다음 실행 대상이다. 하단 A/R/B 완료 기록은 보존하되 이 보완을 생략하는 근거로 사용하지 않는다. 새로운 서버 개인화 단계가 아니라 기존 B 범위의 결함 수정이다.

요구사항 관계: `COURSE-13`, `UX-19`, `DEC-LIVE-LOCAL-FIRST-01`의 **보완**. snooze 1회·종료 정리·실제 체류 분 내림이라는 확정 정책은 변경하지 않는다.

### 검토 근거와 교체 이력

- 네이티브 snooze: TS는 stop의 `snoozeUsed`를 검사하지만 Swift Intent/ContentState는 사용 여부 없이 revision만 증가시키며 `5분 뒤` 버튼을 계속 제공한다. 앱이 정지된 동안 반복 처리한 receipt를 앱 reducer가 거절할 수 있다. 기존 구현 → 동일 stop의 채널 간 1회 제한 누락 → 네이티브 실행 경계와 복귀 reducer가 같은 정책을 적용 → 상태 불일치 방지. 상태: 수정 전, 정적 코드 확인이며 실기기 재현을 주장하지 않는다.
- 종료 정리: controller는 terminal 실패 상태를 남기지만 AppFlow의 시작/복귀 reconcile은 활성 코스에 의존하고 완료/취소 화면은 이를 제거한다. 알림 취소 함수도 개별 실패를 삼킨다. 기존 구현 → 종료 대상 또는 실패 알림 ID를 재시도할 경로 단절 → 활성 화면과 독립적인 exact cleanup 복구 → 종료 후 잔존 Activity/알림 방지. 상태: 수정 전, 실패 주입 테스트로 먼저 재현한다.
- 실제 체류: `courseProgressRuntimeModel.ts`의 `Math.round`는 상위 결정의 `floor((departedAt-arrivedAt)/60000)`와 다르다. 반올림 → 경계 초과 집계 → 내림 → 확정 측정 단위 준수. 상태: 수정 전. 개인화 중앙값의 5분 반올림 규칙은 별개이며 변경하지 않는다.

### 실행 지시

```text
U-LIVE-ACTIVITY-01의 “B1~B6 수락 전 보완 (2026-09-06)” 전체를 수행해.

0. AGENTS.md, docs/README.md, 본 절, 최신 B 인수인계와 연결된 live-activity-local-first.md / live-activity-dwell-personalization.md 현행 로컬 규칙을 읽는다. A/R을 재구현하거나 과거 DB 선행 대기 상태로 되돌리지 않는다. 먼저 아래 세 결함의 실패 fixture를 작성하고 현재 코드에서 실패함을 확인한 뒤 수정한다. 구현과 검증을 한 묶음으로 완료한다.

1. snooze 1회 경계를 TS와 Swift에서 일치시킨다.
   - 1회는 revision마다가 아니라 같은 courseRunId의 같은 방문 stopId 전체에 적용한다. 두 번째 방문 stop은 독립적으로 1회 허용한다.
   - 잠금화면 Intent만 실행되고 React가 정지된 상태에서도 두 번째 snooze를 거절한다. 버튼 숨김/비활성만으로 완료하지 말고 native 실행 경계도 검사한다.
   - AppIntent·알림·앱 action이 교차하거나 같은 action이 중복돼도 공유된 상태/receipt 소유 경계에서 판정한다. TS/Swift가 독립적으로 같은 진행 JSON을 덮어쓰는 구조를 만들지 않는다.
   - 다음 경계를 넘는 snooze, 이전 run/stop/revision, 이미 도착·출발·종료한 action은 상태·알림·시각을 바꾸지 않는다. receipt 복귀 후 Activity와 앱의 revision/단계/시각이 일치해야 한다.
   - 기존 native payload 호환성을 확인한다. 필드 추가 시 이전 payload의 decode/migration 기준을 명시하고 미지원/손상 상태를 임의 초기화하지 않는다. 실제 예약 알림도 최초 snooze와 일치하는지 확인하며 JS 중단 중 불가능한 동작을 구현 완료로 주장하지 않는다. 정책 변경이 필요하면 근거와 함께 반환한다.

2. 종료 정리를 활성 코스 화면과 독립적으로 복구한다.
   - 완료/취소/incomplete/교체 시 exact 종료 대상을 내구 저장한 뒤 부수효과를 실행한다. 활성 코스 snapshot이 없어도 앱 시작 및 foreground에서 보류된 종료 작업을 읽고 재시도할 수 있어야 한다.
   - Activity 종료와 각 알림 취소의 성공/실패를 구분한다. 실패 notification ID는 보존하고 성공한 대상은 다시 생성하지 않는다. 모든 대상 정리 성공 전에 완료 처리하거나 registry를 삭제하지 않는다.
   - 취소 일부 성공 후 실패, 예약 일부 성공 후 실패/프로세스 종료에도 이미 생성된 소유 알림을 추적할 수 있는지 함께 확인한다. 이 기능 전체 알림 삭제로 해결하지 않는다.
   - 이전 run cleanup 대기 중 새 run이 시작되더라도 이전 대상을 덮어쓰거나 새 run을 종료하지 않는다. 기존 exact run conflict/직렬 lifecycle 계약을 유지하고 종료 재시도는 완료 repository를 다시 실행하지 않는다.
   - terminal 정리용 최소 identity와 소유 ID만 보존하고 원시 도착/출발 시각을 재시도 목적으로 불필요하게 남기지 않는다. 손상/unknown 데이터는 무차별 삭제하지 않는다.
   - 시작/복귀 중복 호출에도 멱등 처리한다. 무한 재시도 루프·상시 timer는 추가하지 않는다. 정리 실패가 이미 성공한 Kakao 전환이나 기존 앱 진행을 취소해서는 안 된다.

3. actualDwellMin을 확정 공식의 내림으로 수정한다.
   - 명시 도착과 출발이 모두 유효하고 departedAt >= arrivedAt일 때 floor((departedAt-arrivedAt)/60000)를 사용한다. 미응답·예상 시각으로 누락 값을 합성하지 않는다.
   - 0초→0, 59초→0, 60초→1, 100초→1, 119초→1, 120초→2를 검증한다. 누락·역순·비정상 시각은 유효 체류값으로 저장하지 않는다.
   - 완료 input까지 같은 값이 전달되는 통합 테스트를 포함한다. DB 공개 payload/repository 멱등 계약, 개인화 중앙값 계산, 추천용 계획 체류는 변경하지 않는다. 기존 상한/유효성 정책과 추가 충돌이 보이면 임의 변경하지 않고 반환한다.

4. 필수 회귀 fixture를 실행 가능한 entry로 검증한다.
   - React 정지 상태 native snooze 두 번, 첫 snooze 뒤 다른 채널 재시도, 다음 stop snooze 허용, receipt 복귀 후 후속 도착/출발 정상 처리.
   - 활성 snapshot=null + terminal 정리 대기에서 cold start/foreground 재시도.
   - Activity 종료 실패, 알림 2개 중 1개 취소 실패, 부분 예약 실패, 재시작 후 실패 대상만 정리.
   - 이전 run 보류+새 run/fixture/unknown/무관 알림 보존, 완료 기록 정확히 1건.
   - 체류 초 단위 경계와 완료 input, 기존 실제 1/2곳 handoff 실패·강제 종료 복구 회귀.
   - 네이티브 정책은 실제 Swift 실행 테스트 또는 실행 가능한 native 하네스로 확인한다. Swift 문자열 검사나 컴파일 성공만으로 반복 Intent 동작을 통과 처리하지 않는다. TS와 Swift에 동일 입력/기대값을 적용한다.

5. 검증과 인수인계.
   - 기존 집중 24개를 유지하고 위 실패 fixture를 추가한다. npm run test:typecheck, npm run test:ui, npm test, iOS export, 변경 native의 Debug/Release compile, plugin prebuild 재생성 멱등성, git diff --check를 실행한다. 실패 삭제/skip으로 우회하지 않는다.
   - prebuild 전 기존 native 변경을 확인하고 plugin 원본에서 재현한다. ios 생성물만 직접 수정하지 않는다. 새 dependency/entitlement/서명 변경이 필요하면 먼저 이유를 반환한다.
   - 수정 범위는 기존 UIUX liveActivity runtime·알림·앱 lifecycle 연결·native plugin과 관련 테스트다. 엔진/API/catalog/DB/env/중앙 정책 수정, 서버 표본·업로드 큐·GPS·원격 push 추가, commit/push는 하지 않는다. 같은 파일을 다른 세션과 동시에 편집하지 않는다.
   - 문서에 변경 파일/유지 계약/실패 선행 및 최종 테스트 결과/실기기 미확인과 위험 네 항목을 남긴다. B 전체를 최종 수락이라고 기록하지 않는다.
   - 실기기 확인은 새 native build 필요 여부와 설치 방법, 잠금화면 snooze 1회/앱 복귀 상태 일치/실제 1곳·2곳 종료를 사용자에게 짧게 인계한다. 앱 삭제로 복구 데이터를 지우지 않는다. 강제 실패는 fake 포트로 검증하고 사용자에게 외부 길찾기를 임의로 실패시키라고 요구하지 않는다. 운영 API 반복 호출 및 느린 Simulator 수동 순회는 하지 않는다.
```

보완 후 통합 검토 → QA-LIVE-LOCAL-01 및 제한 실기기 확인 순서다. 기존 자동 24/24 통과나 A3 실기기 확인을 이 보완·실제 B 코스 검증의 대체 근거로 쓰지 않는다.

## 최신 보완 명령 — U-LIVE-ACTIVITY-01-R: 테스트/실제 run 분리

2026-09-06 상태: **실행 가능·B 연결 전 필수**. A2 구성·A3 active 시점 생성 확인은 유지한다. 이번 명령은 실제 코스 B 전체 구현이 아니라 fixture 정리 및 lifecycle 공개 경계를 마련한다.

확인 근거: `TimeFitLiveActivityModule.swift`의 `Activity.activities.first`는 run 비교 없이 `already_active`를 반환하고, payload 누락은 `a3-fixture-run`/테스트 장소로 대체한다. 앱 module과 extension에 attributes 정의가 중복돼 있다. 기존 테스트 Activity가 남으면 실제 run을 시작하지 않고 테스트 것을 반환할 수 있다.

이전 첫 Activity 무조건 재사용·fixture 기본값 → 테스트/실제 run 혼동 및 잔존 → 명시 용도와 run identity 검증·정확한 대상 cleanup → 정상 진행 보존 → **구현 전**. 모든 Activity 종료/화면 제목으로 식별/앱 삭제를 정리 수단으로 쓰는 방식은 채택하지 않는다.

```text
U-LIVE-ACTIVITY-01-R을 수행해. AGENTS.md, docs/README.md, 이 문서 최신 보완 절과 A2/A3 인계, docs/work/integration-decision/live-activity-local-first.md를 읽어. A3 fixture·native module·attributes·Intent receipt writer·plugin·nativeLiveActivityPort를 먼저 조사한다. 기존 native 빌드 성공을 실제 코스 연동 완료로 해석하지 마.

1. 실패 선행 테스트를 추가한다. fixture Activity 존재 중 실제 run 요청이 잘못 already_active가 되는 경우, 다른 실제 run 재사용, payload 누락의 fixture fallback, cleanup이 다른 run을 건드리는 경우를 production-used lifecycle policy/주입 native boundary로 검증한다. 문자열 검사만으로 분기 동작 검증을 대신하지 않는다.

2. 명시 purpose(test_fixture/course_progress), courseRunId, schemaVersion을 최소 식별 계약으로 정하고 activityId와 함께 대조한다. optional purpose 또는 명시 decoder로 기존 A3 schema를 읽을 수 있게 한다. 기존 정확한 fixture run ID는 실제 호출부에서 조사한 allowlist만 legacy fixture로 인정한다. prefix·장소명·배열 첫 항목으로 판정하지 않는다. 분류 불가 legacy Activity는 unknown으로 반환하고 자동 종료하지 않는다. 향후 실제 run은 fixture 예약 ID를 사용할 수 없다.

3. startFixture와 실제용 start/update/end entry를 분리한다. 실제용은 유효 run/stop/revision/시간 payload가 없으면 invalid_input으로 실패하며 테스트 장소/고정15·45분 기본값으로 채우지 않는다. 같은 purpose/run만 재사용하고 더 오래된 revision은 무시한다. 다른 실제 run이 있으면 conflict로 반환한다. 실제 교체는 B의 기존 사용자 교체 확인 뒤 이전 정확한 run 종료→새 run 시작 순서로만 한다. 이번 작업에서 자동 교체/production 화면 연결은 하지 않는다. serial native lifecycle로 concurrent start/cleanup/restart를 보호한다.

4. internal A3 실행기에 '테스트 Live Activity 종료'를 제공한다. list/분류→확인된 fixture의 activityId+runId 재검증→정확한 대상 end 순서이며 실제 run/unknown은 건드리지 않는다. 비동기 end 완료를 기다린 뒤 남은 대상 존재를 확인한다. 이미 없으면 already_ended, 부분 실패면 실패 대상을 남겨 재시도 가능하게 한다. native 성공 전에 UI만 제거 완료로 표시하지 않는다. 새로 시작은 이전 fixture 종료 성공 후에만 가능하며 A3 handoff 성공 이후 시작 순서를 유지한다. 테스트 cleanup/start entry는 JS 화면뿐 아니라 native에서도 Debug/internal gate로 차단하고 production에서 호출 불가로 검증한다.

5. 종료한 fixture의 App Group receipt/알림이 있다면 decode한 정확한 purpose/run 범위만 제거한다. 현재 A3가 예약하지 않는 알림을 있다고 가정하지 않는다. 파일명 패턴만으로 전체 폴더 삭제, 전체 notification 취소, AsyncStorage 전체 clear 금지. Swift Intent는 종료/불일치 fixture의 늦은 action을 거절하도록 live target/identity를 재확인하고 receipt 재생성 경합을 막는다. 파일 경로는 검증된 ID 또는 안전한 파생 키로 만들고 사용자 입력을 경로로 직접 쓰지 않는다. 서버/완료 기록/다른 run은 write0이다.

6. main/extension attributes 및 event schema의 중복 정의를 한 shared source 또는 동일성 검증 가능한 생성 경계로 정리한다. plugin 재생성 후도 일치해야 한다. 기존 A3 decode 호환, shared type module identity·Swift compile을 확인한다. iOS17/App Group/서명/withoutPushEntitlement/권한 설명을 보존한다. generated ios만 수동 고치지 않는다.

7. 회귀: fixture만 있음/실제만 있음/둘 다/unknown/없음, 같은 run 반복, 다른 run conflict, old revision, 동시 시작2회, cleanup 연타, end 실패/부분 실패, 종료 중 늦은 Intent, cleanup 뒤 새 fixture 생성, release build 테스트 entry 차단을 검증한다. 실제 course entry는 fake handoff 성공 event를 입력으로만 테스트하며 A3 fixture를 실제 snapshot으로 승격하지 않는다. runtime Activity 실패가 Kakao 진행을 취소하지 않는 기존 계약도 유지한다.

8. 집중 TS/Swift 또는 native policy tests, npm run test:typecheck, npm run test:ui, npm test, iOS export와 main+extension native build, 별도 임시 복사본 plugin 재생성/idempotence, git diff --check를 실행한다. 원본 ios clean 삭제·새 의존성·push·GPS·서버 저장·env 변경 금지. 새 native build 설치가 필요함을 사용자에게 알리고 앱 삭제를 요구하지 않는다.

9. 사용자는 새 빌드에서 기존 테스트 Activity 종료→잠금화면에서 사라짐→A3 재실행 새 생성→다시 종료만 짧게 확인한다. 실제 코스 보존은 아직 B 미구현이므로 주입 fixture로 검증했다고 명시한다. 미확인 항목은 통과로 쓰지 않는다. 장시간 Simulator 수동 순회0. 변경 파일/보존 계약/테스트와 native 결과/새 공개 entry 타입·오류·B 연결 순서를 이 문서에 인계한다. 중앙 정책·DB·추천·catalog·실제 완료 기록·commit/push는 변경하지 않는다. 이 보완 수락 후 B를 진행한다.
```

## 최신 실행 명령 — 로컬 우선 A→B (2026-09-06)

상태: **A 시작 가능 / B는 A 기술 게이트 후 / 서버 개인화 연결 대기**. [최신 순서](../integration-decision/live-activity-local-first.md)가 아래 과거 일괄 대기보다 우선한다. 완료 기록은 수락됐고 2-AB는 구현됐으며 DB-DWELL은 미구현이다. 아래 과거 11번의 수집 동의·초기화 연결은 서버 단계에 한정한다.

```text
U-LIVE-ACTIVITY-01의 로컬 우선 A→B 작업을 수행해. AGENTS.md, docs/README.md, docs/work/integration-decision/live-activity-local-first.md와 live-activity-dwell-personalization.md, 이 파일을 읽어. 최신 코스 단일 화면/controller/run ID, 내정보 권한 port, 기존 알림 코드, app.json/plugins/ios를 조사한다. 오래된 화면 메모리-only 설명을 현재 구현으로 단정하지 마. 서버 개인화/가입/닉네임/계정 삭제는 이번 범위가 아니다.

A1. 고정 clock·1/2곳 immutable snapshot·fake handoff/activity/notification/storage 포트로 상태/일정/중복 행동을 실패 선행 테스트한다. UI와 native 공통 state schema/version, courseRunId/stopId/eventId/revision, event source, 상태 전이·단일 writer/직렬화·중복/오래된 event 처리·migration/손상 fallback을 문서화한다. App Group read-modify-write를 React와 Intent가 경쟁하게 두지 않는다. 가변 화면 index를 stop identity로 쓰지 않는다.
A2. 프로젝트 로컬 config plugin/Swift bridge로 iOS17 main/extension deployment, Widget Extension, App Group, ActivityKit 설정을 구성한다. 기존 패키지/target이 있으면 먼저 조사하고 중복 생성하지 않는다. 기존 withoutPushEntitlement plugin과 충돌하지 않으며 push/APNs/background GPS를 추가하지 않는다. 서명 Team/App Group 식별자는 실제 프로젝트 값만 사용한다. capability 등록 권한이 필요하면 요청하고 가짜 값으로 통과하지 마. prebuild 재현은 별도 임시 작업 복사본에서 검증하고 원본 ios를 clean 삭제하지 않는다.
A3. fake snapshot으로 Lock Screen/Island preview와 native build를 검증한 뒤 사용자에게 딱 한 가지 기술 확인을 요청한다: 실제 Kakao handoff 성공 후 Live Activity 시작 여부. 성공 Promise 뒤 app background 경합, 시작 실패, 전체 handoff 실패 부수효과0을 기록한다. Activity 시작을 성공 전으로 옮기거나 pending 준비 화면을 사용자 승인 없이 추가하지 않는다. iOS17 foreground 시작 제약으로 현행 계약이 불가능하면 대안/증거를 반환하고 B를 중지한다. 시뮬레이터 장시간 수동 순회 대신 테스트 harness와 사용자 제한 확인을 사용한다. Expo Go로 검증하지 않고 새 native development/internal build 설치 경로를 안내한다.

B1. A 통과 뒤 기존 코스 화면 review→active 흐름과 handoff 성공 event에만 연결한다. 여행 목적지(약속/복귀)와 방문 stop을 구분한다. 최종 약속 도착을 새 방문 체류로 기록하지 않는다. 현재 snapshot의 최적 순서만 쓰고 새 route 요청0이다. 반복 handoff/arrival/departure/snooze는 멱등이며 길찾기 실패는 departure가 아니다. Intent의 명시 이제 출발해요는 명시 departure이고 실제 외부 handoff 성공을 가장하지 않는다. 다음 길찾기 순서와 기존 현재 구간 CTA를 유지한다.
B2. arrivalGrace=clamp(round(moveMin*.2),3,10), arrivalPrompt=routeOpenedAt+moveMin+grace, departureReminder=최종 도착시각-여유-남은 이동합-이후 stop 체류합-5분을 단일 계산 경계로 사용한다. 단위/타임존/자정/과거 시각/도착이 출발 알림보다 늦은 경우와 snooze가 다음 단계/종료를 넘어서는 경우를 정의한다. 과거 reminder는 즉시 안내 한 번, 무응답은 도착/출발 추정 금지다. UI/Swift 계산이 분리되면 같은 golden fixtures로 동일성을 증명한다.
B3. 처음 실제 길찾기 전 목적 설명과 명시 알림 권한 요청을 하고 허용 여부와 무관하게 길찾기는 계속한다. Profile은 조회만 한다. 기존 알림 helper의 process 캐시가 설정 변경을 무시하지 않는지 확인한다. 변경 필요 시 이 작업의 알림 전용 adapter로 범위를 격리하고 legacy 알림과 같은 run에 중복 예약하지 않는다. 예약/취소 식별자는 이 기능 소유만 사용하며 다른 알림 전체 삭제 금지다.
B4. 잠금화면/Island에 목적 장소·진행·시간과 도착했어요/1회 5분 다시 알림/명시 출발을 제공한다. React JS가 정지해도 native Intent와 알림 action이 동일 durable event 경계에서 처리되는지 확인한다. 알림 delivery만으로 JS timer나 Activity update를 보장하지 않는다. 필요한 잠금 해제는 OS 규칙을 따르고 버튼 눌림을 실제 방문 증거 이상으로 해석하지 않는다. 액션 stale run/stop/revision은 무시한다.
B5. 앱 시작/복귀에 단일 활성 state를 복구·reconcile한다. 코스 교체는 기존 확인 후 이전 run의 알림/Activity만 정리하고 새 run 생성. 명시 완료 controller를 재사용해 기록 정확히1회, 취소/만료/incomplete는 완료를 합성하지 않는다. 종료 상태/처리 receipt를 먼저 멱등 보존하고 exact 시각 payload 정리 순서를 테스트한다. OS 실행 중단으로 cleanup이 지연될 수 있음을 인계하며 재실행 시 stale 데이터/알림을 정리한다. App Group 손상은 기존 기록을 지우지 않고 안전 fallback한다.
B6. 로컬 stage는 서버 표본 전송/개인화 적용/나중 업로드 큐0이다. 현재 Profile에서 위치/알림 상태에 Live Activity 실제 지원/허용 상태를 추가하고, 아직 DB 동의가 없으므로 체류 수집 토글/초기화를 가짜로 만들지 않는다. 기존 방문 완료 기록과 exact 활성 상태를 분리한다. GPS/원격 push/사용자 ID·좌표·route geometry의 Activity payload 삽입은 금지한다. 복구에 필요한 기존 snapshot은 앱 전용 저장소와 minimal shared state 사이의 참조/복구 경계를 설계하고 중복 대용량 저장을 피한다.

검증: 집중 상태/일정/포트 테스트, npm run test:typecheck, npm run test:ui, npm test, iOS export와 실제 native build, plugin 재생성/idempotence, git diff --check. Swift compile/Intent/entitlement는 JS export로 대체하지 않는다. Activity 실패·알림 거절·저장 실패에도 기존 길찾기/앱 진행이 가능해야 한다. 실패 skip/삭제 금지. 변경 파일/공개 로컬 schema/명령 및 결과/실기기 최소 단계/남은 제약을 이 문서에 남긴다. 중앙 문서·DB schema·추천 정책·catalog·env·원격 배포·commit/push 금지. 실제 계정/메일/서버 표본 생성0. A/B 로컬 수락을 서버 개인화 완성으로 보고하지 마.
```

> 상태: **대기 — U-COMPLETION-HISTORY-01 및 DB-DWELL-01·2-AB 공개 계약 필요**
> 상위 결정: [DEC-LIVE-DWELL-01](../integration-decision/live-activity-dwell-personalization.md)

## 목적과 사용자 관찰

카카오맵 길찾기 뒤 앱을 다시 열지 않는 사용자도 예상 도착·안전 출발 시각을 놓치지 않고, 잠금화면/Dynamic Island에서 낮은 마찰로 도착과 출발을 확인하게 한다.

## 구현 전 원인 확인

- 기본 명시 완료 저장과 기록 탭은 `U-COMPLETION-HISTORY-01`에서 먼저 연결한다. 이 작업은 그 `courseRunId`와 repository를 재사용해 App Group 복구·도착/출발 확인으로 확장한다.
- 현재 `app.json` deployment target은 16.4이고 Widget Extension/App Group/ActivityKit bridge가 없다.
- 현재 iOS Info.plist에는 기능과 맞지 않는 generic Always location 문구가 생성돼 있으나 이번 결정은 background/Always GPS를 금지한다.
- 기존 `expo-notifications`에는 legacy 출발 5분 전·정시 알림이 있으므로 그대로 중복 예약하지 말고 새 진행 상태 기준으로 교체/분리해야 한다.

## 구현 명령

1. `U-COMPLETION-HISTORY-01`이 만든 `courseRunId`, 명시 완료 controller와 repository 소비를 다시 구현하거나 다른 ID로 교체하지 않는다. 같은 run ID를 App Group 활성 진행에 보존·복구하고, Live Activity의 실제 도착/출발이 확인된 경우에만 기존 완료 input의 `actualDwellMin` 연결점을 확장한다.
2. 먼저 고정 clock과 fake Activity/notification/repository port로 실패하는 상태 전이·부수효과 테스트를 만든다. 화면에서 ActivityKit·Notifications·Supabase를 직접 호출하지 않는다.
3. iOS deployment target을 17.0으로 일관되게 전환하고 Expo prebuild 재생성에도 유지되는 config plugin/설정을 만든다. Xcode 수동 편집만으로 끝내지 않는다.
4. 제3자 패키지의 암묵적 target 생성에 의존하지 않는다. 프로젝트 로컬 Expo config plugin과 Swift native bridge로 Widget Extension, App Group, `NSSupportsLiveActivities`, ActivityKit attributes/content state를 생성·연결하고, clean prebuild 뒤에도 target·entitlement·shared type이 재현되는지 검사한다. 한 번에 활성 Live Activity는 하나다.
5. 길찾기 handoff 성공 뒤에만 `traveling`을 시작한다. 실패/중복 tap은 activity·알림·저장 0회다.
6. 상위 결정의 20%·3~10분 도착 유예와 `latestSafeDepartureAt - 5분` 공식을 단일 순수 schedule helper에서 사용한다. 화면마다 다시 계산하지 않는다.
7. 도착 알림 action은 `도착했어요`, `5분 뒤 다시 알림` 두 개다. snooze는 1회이고 무시/미응답으로 activity를 종료하지 않는다.
8. iOS 17 LiveActivityIntent로 도착·출발 행동을 처리하고 App Group의 최소 상태를 idempotent하게 갱신한다. 잠긴 기기 인증, 앱 foreground/background, 중복 action을 안전 처리한다.
9. 도착 확인 뒤 `dwelling`, 출발 5분 전 `departure_due` 맥락을 보여 준다. 다음/목적지/복귀 Kakao handoff 성공 또는 앱의 명시 완료가 같은 departure event를 사용한다.
10. 강제 종료/재실행은 App Group의 활성 코스 하나만 복구한다. 취소·완료·만료 때 pending notification과 Live Activity를 함께 종료하고 local exact timestamps를 정리한다.
11. 내 정보에는 실제 앱 토글 `맞춤 추천을 위한 체류 기록`, `개인화 데이터 초기화`를 추가한다. 알림·위치·Live Activity는 시스템 상태와 `설정에서 변경` 행으로 구현하고 앱이 시스템 권한을 직접 끈 것처럼 표현하지 않는다.
12. 최초 개인화 활성화 때만 수집 목적을 설명한다. 알림 권한은 첫 실행이 아니라 첫 `카카오맵에서 길찾기` handoff 직전에 도착·출발 알림 목적을 설명한 뒤 요청하고, 응답과 무관하게 handoff를 계속한다. 거절 후 내 정보의 시스템 상태 행에서 설정 앱으로 갈 수 있으며, 개인화 활성화 이전 기록은 전송하지 않는다.
13. GPS/background location 코드를 추가하지 않는다. Always usage description/background location mode가 이번 앱 기능에 필요하지 않으면 생성 원인을 제거하고 When In Use 위치 선택 설명만 실제 기능과 맞춘다.
14. ActivityKit 시작 실패, 알림 거절, 개인화 미동의, repository 실패에도 추천·기존 진행·Kakao handoff를 막지 않는다.
15. 원격 push token/APNs/Edge Function을 추가하지 않는다. Live Activity 때문에 Route Proxy/Kakao API를 재호출하지 않는다.

## 수정 금지 경계

- 추천 후보·순위·체류 계산, route snapshot, API cache/attempt, 카탈로그를 수정하지 않는다.
- 엔진이 제공한 `moveMin`, 남은 legs/stops, 도착 여유를 UI가 임의 연장하지 않는다.
- 일반 버튼 haptic 0과 TimeWheel 전용 haptic, 2곳 인라인 선택/취소 상태를 유지한다.
- 시스템 알림/위치 권한을 실제 앱 토글처럼 위장하지 않는다.

## 필수 반례 fixture

- 10/30/60분 이동의 유예 3/6/10분과 clamp 경계.
- 일찍 도착, 정시+유예 도착, snooze 1회, 미응답.
- last stop과 2곳 첫 stop의 남은 일정 공식, 이미 지난 출발 5분 전 시각.
- Kakao app/web/browser 각각 성공과 전체 실패, 중복 tap.
- arrival 중복, departure 중복, route 실패 시 departure 미기록.
- 비로그인, anonymous Auth, 로그인 미동의/동의/철회.
- 알림 거절, Live Activity disabled/start failure, 앱 강제 종료 복구, 취소·완료 cleanup.
- Dynamic Island/Lock Screen 각 presentation과 긴 장소명·VoiceOver·Reduce Motion.

## 검증과 완료 인수인계

- 최소 `npm run test:typecheck`, `npm run test:ui`, `npm test`, iOS bundle/build, `git diff --check`를 실행한다.
- SwiftUI preview/fixture로 Lock Screen·Dynamic Island compact/minimal/expanded를 검증한다. 실제 알림·App Intent·잠금 상태는 QA 실기기 게이트로 남긴다.
- 변경 파일과 목적 / 유지 계약 / 자동 테스트 결과 / 실제 기기에서만 가능한 항목을 이 문서에 기록한다.
- 사용자 요청 전 commit·push하지 않는다. 보드를 수정하지 않는다.

## 로컬 우선 A1 인수인계 — 2026-09-06

상태: **A1 완료 / A2 capability 확인 대기 / A3·B 미시작**

### 변경 이력과 공개 로컬 schema

- 이전 방식: 코스 진행은 React 화면 상태와 앱 전용 활성 코스 저장만 사용했고, ActivityKit/Intent와 공유할 versioned local progress schema 및 직렬 writer가 없었다.
- 관찰: 화면 index를 identity로 사용하거나 React와 Intent가 App Group JSON을 각각 read-modify-write하면 재정렬·동시 action에서 다른 stop 갱신과 revision 유실이 가능하다. 외부 handoff 실패 전에 상태를 만들면 길찾기가 열리지 않아도 알림과 Activity가 시작될 수 있다.
- 교체 방식: `schemaVersion=1`의 immutable 1/2곳 snapshot과 순수 reducer/coordinator 경계를 추가했다. 모든 event는 `courseRunId`, stable `stopId`, `eventId`, `baseRevision`, `source`, epoch millisecond `occurredAtMs`를 사용한다. 상태는 `idle/traveling/arrival_pending/dwelling/departure_due/completed/cancelled/expired/incomplete`이고, 처리 receipt는 최근 64개 event ID로 제한한다. 외부 handoff가 `true`를 반환한 뒤에만 단일 직렬 coordinator가 저장 → Activity → 이 기능 소유 알림 순으로 실행한다. 중복, 다른 run, 오래된 revision, terminal 이후 event는 저장과 부수효과 없이 무시한다.
- migration/fallback: 인식 가능한 prototype v0는 v1로 명시 migration한다. JSON 손상과 미지원 version은 기존 값을 덮어쓰거나 지우지 않고 `storage_unreadable`로 중단한다. A2의 App Group writer는 React와 Intent가 경쟁하는 구조로 만들지 않고, native serial writer가 동일 reducer/event receipt 계약의 유일한 shared-state writer가 되어야 한다.
- 일정: 도착 유예는 `clamp(round(moveMin×0.2), 3, 10)`, 도착 확인 시각은 `routeOpenedAt + moveMin + grace`, 출발 알림은 `finalArrival - arrivalBuffer - remainingMove - laterStay - 5분`이다. 계산 결과가 과거면 현재 epoch에 즉시 한 번만 안내하고, snooze는 1회이며 다음 단계/종료 경계를 넘으면 허용하지 않는다.
- 이유와 상태: 외부 전환 성공을 진행 시작의 원자적 선행 조건으로 고정하고, UI/native가 같은 identity·revision·시간 단위를 소비하게 하기 위함이다. **현행 A1 계약**이며 A2 native 구현은 이 schema를 Swift mirror/golden fixture로 검증해야 한다.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `src/ui/liveActivity/localProgressModel.ts`: versioned local state/event schema, 1/2곳 snapshot 검증, 일정 helper, reducer, 손상/migration decode, fake-port 주입 가능한 handoff 이후 직렬 coordinator를 추가했다.
   - `test/ui/live-activity-local-progress.test.ts`: 고정 clock과 1/2곳 fixture, fake handoff/activity/notification/storage로 유예·자정 안전 epoch·출발 시각·snooze·stable identity·duplicate/stale/wrong-run·migration/손상·handoff 실패 부수효과 0을 실패 선행으로 고정했다. 최초 실행은 모듈 부재로 실패했고 구현 후 통과했다.
2. 유지한 계약·정책 경계
   - 기존 `courseRunId`, 코스 review/active 화면, 현재 Kakao app-scheme→HTTPS fallback, 완료 repository, 추천/route/API/DB 계약을 수정하거나 연결하지 않았다.
   - 서버 개인화, 사용자 ID·좌표·route geometry 저장/전송, 미동의 표본/업로드 큐, push/APNs/background GPS, 체류 동의 UI를 추가하지 않았다. 중앙 문서와 작업 보드는 수정하지 않았다.
3. 테스트 결과
   - `npx tsx --test test/ui/live-activity-local-progress.test.ts`: PASS, 6/6.
   - `npm run test:typecheck`: PASS.
   - `npm run test:ui`: PASS.
   - `npm test`: PASS.
   - `git diff --check`: PASS.
4. 다음 결정·위험·재현 조건
   - 현재 native 프로젝트는 Team `642X5R37S7`, app bundle `com.dongheun.mobile`, deployment target `16.4`만 확인되며 Widget Extension, ActivityKit plist key, App Group entitlement가 없다. 확인된 provisioning entitlement에도 application group이 없어 실제 등록 ID를 추정해 넣을 수 없다.
   - A2는 등록된 App Group 식별자 제공 또는 Team에 신규 App Group 등록 승인 후 진행한다. 그 전에는 iOS 17 main/extension 설정, plugin idempotence, Swift compile/preview/native build를 통과했다고 보고할 수 없다.
   - A3의 실제 Kakao handoff 성공 후 Activity 시작 검증 전까지 B 화면 연결·권한 요청·Profile 표시·복구를 시작하지 않는다. 따라서 현재 변경은 production 화면에 노출되지 않는다.

## 로컬 우선 A2 완료 인수인계 — 2026-09-06

상태: **A2 완료 / A3 실기기 기술 게이트 대기 / B 미시작**

### 변경 이력

- 이전 방식: iOS main target은 16.4였고 Widget Extension, ActivityKit plist key, App Group entitlement와 재생성 가능한 native bridge가 없었다. `expo-location` 자동 설정은 사용하지 않는 Always 위치·Motion 설명까지 생성했다.
- 관찰: 수동 Xcode target만 추가하면 Expo prebuild에서 사라지고, Swift class가 현재 React Native target에서 `RCTBridgeModule`을 직접 구현하면 bridge protocol을 찾지 못해 전체 앱 compile이 실패했다. Extension과 앱이 서로 다른 shared schema를 쓰면 `arrival_snoozed` receipt가 reducer에서 무시될 수 있었다.
- 교체 방식: 프로젝트 로컬 config plugin이 iOS 17 main/extension target, Widget sources, plist, App Group entitlement와 Swift/Objective-C bridge registration을 매번 생성한다. native receipt와 UI reducer 모두 `arrival_snoozed` 및 `nextBoundaryAtMs`를 사용하고, 5분 연장이 다음 경계를 넘거나 이미 사용된 경우 적용하지 않는다. 위치 권한은 foreground 도로명 주소·주변 장소 목적의 When In Use 설명만 남긴다.
- 교체 이유와 상태: clean/repeated prebuild와 실제 서명 빌드에서 같은 target·bundle·entitlement를 재현하고, React와 Intent가 stable run/stop/revision receipt 경계로 이어지게 하기 위함이다. **현행 A2 계약**이다.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `app.json`: iOS deployment target을 17.0으로 올리고 Team `642X5R37S7`, Extension bundle `com.dongheun.mobile.liveactivity`, App Group `group.com.dongheun.mobile.timefit`을 로컬 plugin 입력으로 고정했다. `expo-location`은 When In Use만 생성하고 Always/background/Motion 권한 설명을 제거하도록 명시했다.
   - `plugins/withTimeFitLiveActivity.cjs`: main/extension target·sources·plist·entitlement·build settings를 중복 없이 생성하고 undefined project field를 제거하는 idempotent config plugin을 추가했다.
   - `plugins/live-activity/*`: Activity attributes/content state, Lock Screen/Dynamic Island Widget, 도착·1회 snooze·출발 Intent receipt writer, ActivityKit 시작/support Swift bridge와 Objective-C registration을 추가했다.
   - `src/ui/liveActivity/localProgressModel.ts`, `test/ui/live-activity-local-progress.test.ts`: native `arrival_snoozed` receipt를 동일 v1 event schema로 수용하고 다음 경계·1회 제한을 reducer 수준에서 실패 선행 검증했다.
   - `test/ui/live-activity-config-plugin.test.mjs`: 실제 식별자, iOS 17, target/bridge/App Group 생성, push/background API 부재 계약을 고정했다.
   - 생성된 `ios/` 산출물은 plugin 재생성·Pod 동기화·native build 확인에만 사용했으며 원본 iOS 디렉터리를 clean 삭제하지 않았다.
2. 유지한 공개 계약·정책 경계
   - 기존 `courseRunId`, 완료 repository, 코스 review/active 화면, Kakao app-scheme→HTTPS/browser handoff, 추천·route/API·DB 계약을 수정하거나 production 화면에 Live Activity를 연결하지 않았다.
   - push/APNs, Background Modes/GPS, 사용자 ID·좌표·route geometry, 서버 개인화·미동의 표본·업로드 큐를 추가하지 않았다. 기존 `withoutPushEntitlement` 뒤에도 `aps-environment`는 생성되지 않는다.
   - 작업 보드·중앙 정책 문서·엔진·catalog를 수정하지 않았고 commit/push하지 않았다.
3. 실행한 테스트와 결과
   - 실패 선행: main Swift bridge의 직접 `RCTBridgeModule` 구현 compile 실패와 `arrival_snoozed` reducer 미적용을 각각 재현한 뒤 경계를 교체했다.
   - `npx tsx --test test/ui/live-activity-local-progress.test.ts`: PASS 6/6.
   - `node --test test/ui/live-activity-config-plugin.test.mjs`: PASS 2/2.
   - `npm run test:typecheck`: PASS.
   - `npm run test:ui`: PASS 440, SKIP 1, FAIL 0.
   - `npm test`: PASS 222/222.
   - `npx expo export --platform ios`: PASS.
   - 원본 `npx expo prebuild --platform ios --no-install` 연속 2회: PASS. 별도 `/private/tmp/timefit-live-a2-repro.fRhn1L` 복사본 clean prebuild 후 재실행: PASS, target은 `mobile`과 `TimeFitLiveActivityExtension` 각 1개.
   - `pod install`: PASS, 97 dependencies/96 pods 동기화.
   - Widget Extension iOS Simulator build 및 main+Extension iOS 17 Simulator workspace build: PASS.
   - automatic signing 실제 iPhoneOS generic device build: PASS. 완성 앱과 `.appex` 모두 Team `642X5R37S7` 및 `group.com.dongheun.mobile.timefit` embedded entitlement 확인.
   - `git diff --check`: PASS.
4. 다음 결정·위험·재현 조건
   - Apple Developer에서 main `com.dongheun.mobile`과 Extension `com.dongheun.mobile.liveactivity` 모두 App Groups 1개가 활성화되고 `group.com.dongheun.mobile.timefit`만 선택된 것을 읽기 전용으로 확인했다. 중복 그룹은 어느 App ID에도 연결되지 않았다.
   - A3는 Expo Go가 아닌 새 development/internal build를 iOS 17+ 실기기에 설치하고, fake snapshot으로 Lock Screen/Island presentation을 먼저 확인한다. 그 다음 실제 Kakao 길찾기 handoff가 성공해 앱이 background로 전환된 뒤 Live Activity가 시작되는지 한 가지를 사용자에게 확인받는다.
   - A3에서는 handoff 성공 Promise 전 Activity 시작 금지, 전체 app/web/browser 실패 시 Activity·알림·저장 0, 시작 실패가 기존 길찾기/진행을 막지 않음을 검증한다. 이 실기기 게이트 전에는 B 화면 연결·Profile 상태·권한 요청·복구를 시작하지 않는다.

## 로컬 우선 A3 완료 인수인계 — 2026-09-06

상태: **A3 완료 / B 시작 가능·미시작**

### 변경 이력

- 이전 방식: native `startFixture`는 호출 즉시 새 Activity를 만들었고, 실제 Kakao handoff와 연결된 실행 경계·동시 탭 잠금·앱 전환 상태 진단·Lock Screen/Island preview fixture가 없었다.
- 관찰: handoff 성공 전에 Activity를 만들면 카카오맵 전환 실패에도 잠금 화면이 남을 수 있고, 연타는 여러 Activity를 만들 수 있다. 첫 native 재빌드에서는 `activitySupport` Promise를 main queue closure가 캡처하면서 non-escaping compile 오류가 실제 재현됐다.
- 교체 방식: 개발 진단 build에서만 보이는 고정 `서면역 → 부산시민공원` A3 실행기를 추가했다. Activity 지원/허용 확인 → 기존 Kakao app-scheme/HTTPS/browser handoff 성공 Promise → native Activity 요청 순서를 고정하고, 전체 handoff 실패는 시작 0회로 닫는다. JS controller와 native `Activity.activities.first`가 각각 동일 tick과 프로세스 내 중복을 차단한다. native 응답은 비밀 없는 `active/inactive/background/unknown` 앱 상태만 반환한다. SwiftUI에는 Lock Screen과 Dynamic Island expanded/compact/minimal 고정 preview를 추가했다. Promise parameter를 escaping으로 고쳐 실제 iPhoneOS compile 오류를 해소했다.
- 교체 이유와 상태: 외부 전환 성공을 Activity 시작의 원자적 선행 조건으로 실제 포트에서 확인하고, iOS foreground/background 경합 여부를 단 한 번의 실기기 관찰로 판정하기 위함이다. 연결된 iPhone 17에서 실제 전환 후 native `started`와 요청 시 `active`가 관찰되어 **A3 통과·현행**이다.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `src/ui/liveActivity/a3VerificationModel.ts`: 지원 상태, handoff 결과, native 시작을 순서화하고 busy/disabled/unsupported/handoff 실패/start 실패를 분리하는 주입 가능 controller를 추가했다.
   - `src/ui/liveActivity/nativeLiveActivityPort.ts`, `a3VerificationComposition.ts`: React Native bridge와 고정 Kakao 도보 길찾기 fixture를 앱 포트로 연결했다.
   - `src/ui/TimeSetupScreen.tsx`: `__DEV__`와 추천 diagnostics가 모두 켜진 internal build에만 A3 실행 버튼과 비밀 없는 결과 상태를 표시했다. production 화면과 코스 active 흐름은 연결하지 않았다.
   - `plugins/live-activity/TimeFitLiveActivityModule.swift`: main queue 실행, 앱 상태 진단, 프로세스당 기존 Activity 재사용을 추가했다.
   - `plugins/live-activity/TimeFitLiveActivityExtension.swift`: Lock Screen 및 Dynamic Island expanded/compact/minimal preview fixture 4개를 추가했다.
   - `test/ui/live-activity-a3-verification.test.ts`, `test/ui/unified-time-route-setup.test.mjs`, `test/ui/live-activity-config-plugin.test.mjs`: handoff 이후 순서, 실패 부수효과 0, 중복 탭, production 비노출, 실제 화면 handler와 native/preview 계약을 고정했다.
2. 유지한 공개 계약·정책 경계
   - 기존 Kakao app-scheme → HTTPS → browser fallback 구현을 그대로 호출하며 새 외부 API·추천·route 요청을 추가하지 않았다. `courseRunId`/완료 repository/코스 review·active 상태, 엔진·DB·Profile·알림은 수정하거나 B에 연결하지 않았다.
   - push/APNs, Background Modes/GPS, 사용자 ID·좌표·서버 개인화·미동의 표본을 추가하지 않았다. 실패한 Activity가 길찾기를 취소하거나 진행 상태를 만드는 동작도 없다.
   - 작업 보드와 중앙 문서는 수정하지 않았고 commit/push하지 않았다.
3. 실행한 테스트와 결과
   - 실패 선행: `a3VerificationModel` 부재 `MODULE_NOT_FOUND`, 이후 실제 iPhoneOS build의 non-escaping Promise capture 오류를 각각 재현하고 수정했다.
   - `npx tsx --test test/ui/live-activity-a3-verification.test.ts test/ui/unified-time-route-setup.test.mjs`: PASS 32/32.
   - `npx tsx --test test/ui/live-activity-config-plugin.test.mjs test/ui/live-activity-a3-verification.test.ts`: PASS 6/6.
   - `npm run test:typecheck`: PASS.
   - `npm run test:ui`: PASS 445, SKIP 1, FAIL 0 (총 446).
   - `npm test`: PASS 224/224.
   - `npx expo export --platform ios`: PASS.
   - `npx expo prebuild --platform ios --no-install`: 반복 PASS.
   - automatic signing generic iPhoneOS Debug build: PASS. 연결된 iPhone 17에 `com.dongheun.mobile` 설치 및 launch: PASS.
   - 실기기 A3 1회: PASS. iPhone 미러링의 실제 TimeFit 화면에서 `Live Activity 시작됨 · 전환 시 앱 active`를 관찰했다. 즉 Kakao handoff 성공 결과 뒤 `Activity.request`가 성공했고 요청 시점은 background가 아닌 active였다. 도구가 제공한 화면 관찰을 사용했으며 별도 로컬 캡처 생성은 macOS display capture 제한으로 실패했다.
   - 완성 앱과 Extension codesign entitlement: PASS. Team `642X5R37S7`, 각 application identifier, `group.com.dongheun.mobile.timefit` 일치.
   - `git diff --check`: PASS.
4. 다음 결정·위험·재현 조건
   - A3 기술 게이트가 통과했으므로 다음 UIUX 세션은 B1의 실제 코스 handoff 연결을 시작할 수 있다. 다만 현재 internal fixture 결과를 production 진행 상태로 승격하거나 재사용하지 않는다.
   - 실제 잠금 화면/Dynamic Island의 긴 장소명·VoiceOver·잠금 상태 Intent 조작은 B 화면 연결 이후 QA 실기기 게이트다. A3에서는 4개 SwiftUI preview compile과 실제 Activity 생성까지만 수락했다.
   - 현재 internal fixture는 Activity를 종료하지 않으므로 반복 확인은 `기존 Live Activity 유지`로 보고한다. 재시작 확인은 OS/앱에서 기존 Activity를 종료한 뒤 수행한다.

## U-LIVE-ACTIVITY-01-R 완료 인수인계 — 2026-09-06

상태: **구현·자동 검증 완료 / 새 internal build 실기기 확인 대기 / B 연결 차단 유지**

### 변경 이력과 공개 lifecycle 계약

- 이전 방식: native가 `Activity.activities.first`를 용도·run 대조 없이 재사용했고 누락 payload를 A3 기본값으로 채웠다. 종료 entry와 exact cleanup이 없어 이전 테스트 Activity를 안전하게 정리할 수도 없었다.
- 관찰: 테스트 Activity가 실제 코스 start를 가로채고, 다른 실제 run도 `already_active`가 될 수 있었다. 이전 실제 A3 호출부는 `a3-${Date.now()}`처럼 매번 다른 run을 만들었으므로 그 카드는 정확한 allowlist로 증명할 수 없으며 prefix로 테스트라 간주해 종료하면 안 된다.
- 교체 방식: `purpose=test_fixture|course_progress`, `schemaVersion=1`, `courseRunId`, native `activityId`, `revision`을 명시 identity로 사용한다. 새 테스트 fixture는 예약 run `timefit-a3-fixture-v1`, 실제 호출부에서 확인된 고정 legacy fallback은 `a3-fixture-run`만 허용한다. 그 밖의 과거 schema/run은 `unknown`이고 자동 종료하지 않는다. 실제 코스 start는 같은 run만 재사용하고 다른 실제 run은 `conflict`, 누락·예약 ID·잘못된 시간은 `invalid_input`, 이전 revision update는 `ignored_old_revision`이다. 모든 list/start/update/end/cleanup은 JS와 native에서 직렬화한다.
- cleanup 방식: internal 버튼은 list·분류 후 현재 `activityId+purpose+run+schemaVersion+revision`을 native에서 다시 대조해 그 Activity만 즉시 종료하고, 다시 list하여 사라진 뒤에만 완료를 표시한다. 실제 run과 unknown은 보존하고, 실패 ID만 남겨 재시도한다. receipt는 decode 결과가 `purpose=test_fixture`이면서 정확한 예약 run인 경우에만 제거한다. Intent receipt는 살아 있는 동일 실제 Activity/run/stop/revision과 native target이 모두 맞아야 쓴다.
- 이유와 상태: 테스트와 실제 진행의 lifecycle 충돌을 fail-closed로 제거하고 향후 B가 실제 코스 identity를 명시 연결할 수 있게 하기 위함이다. **현행 R 공개 경계**이며 production 코스 화면 연결은 아직 하지 않았다.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `src/ui/liveActivity/lifecyclePolicy.ts`: fixture/actual identity·strict payload·exact cleanup·same-run reuse·different-run conflict·old revision 무시·직렬 lifecycle controller를 추가했다.
   - `src/ui/liveActivity/nativeLiveActivityPort.ts`, `a3VerificationModel.ts`, `a3VerificationComposition.ts`: 검증된 native inventory/응답 변환, 고정 A3 fixture, 기존 fixture 선행 cleanup gate와 exact cleanup controller를 연결했다.
   - `src/ui/TimeSetupScreen.tsx`: internal 환경에만 `테스트 Live Activity 종료`를 추가하고 native 확인 결과에 따라 종료/없음/부분 실패를 구분해 표시한다.
   - `plugins/live-activity/TimeFitActivityAttributes.swift`, `TimeFitLiveActivityModule.swift`, `TimeFitLiveActivityModuleBridge.m`, `TimeFitLiveActivityExtension.swift`, `plugins/withTimeFitLiveActivity.cjs`: main/extension shared attributes 한 원천 생성, optional legacy decode와 exact allowlist, strict actual entries, exact end/receipt/Intent gate, native serial queue, Debug-only fixture entry를 구현했다.
   - `test/ui/live-activity-lifecycle-policy.test.ts`, `live-activity-a3-verification.test.ts`, `live-activity-config-plugin.test.mjs`, `unified-time-route-setup.test.mjs`: 실패 선행 lifecycle 반례와 실제 화면 cleanup handler, release 비노출/Debug native gate를 고정했다. 생성된 `ios/`는 plugin 출력으로만 동기화했다.
2. 변경하지 않은 공개 계약·정책 경계
   - A3의 Kakao app-scheme→HTTPS/browser 성공 Promise 이후 시작, 전체 handoff 실패 시 Activity 0, Activity 실패가 이미 열린 Kakao 흐름을 취소하지 않는 계약을 유지했다.
   - 실제 코스 review/active/progress 화면과 완료 repository에는 새 entry를 연결하지 않았다. B의 자동 교체·복구·권한/Profile·알림 연결도 시작하지 않았다.
   - 추천 엔진, route/API/cache, DB·서버 개인화, 사용자 ID·좌표, 카탈로그, push/APNs/background GPS, 중앙 문서와 작업 보드는 수정하지 않았다. 전체 notification/receipt/AsyncStorage 삭제도 없고 commit/push하지 않았다.
3. 실행한 테스트와 결과
   - 실패 선행: lifecycle policy 모듈 부재로 `MODULE_NOT_FOUND`를 재현한 뒤 구현했다. fixture+actual 혼동, 다른 run 재사용, 누락/예약 payload, actual/unknown 오종료, old revision, 동시 start/cleanup, native reject·부분 실패를 동작 테스트로 고정했다.
   - 집중 동작: `npx tsx --test test/ui/live-activity-lifecycle-policy.test.ts test/ui/live-activity-a3-verification.test.ts` PASS 12/12. config + 실제 setup handler 집중 회귀 PASS 33/33.
   - `npm run test:typecheck`: PASS. `npm run test:ui`: PASS 455, SKIP 1, FAIL 0 (총 456). `npm test`: PASS 225/225. `npx expo export --platform ios`: PASS. `git diff --check`: PASS.
   - 원본 `npx expo prebuild --platform ios --no-install`: 반복 PASS. 별도 `/private/tmp/timefit-live-r-prebuild.ZwekCI` clean 생성 후 prebuild 2회 PASS이며 main/extension shared Swift와 원본 생성물이 byte-identical이다. App Group entitlement `group.com.dongheun.mobile.timefit`도 양 target에서 유지됐다.
   - automatic signing generic iPhoneOS main+extension Debug build: PASS. Release build: 단독 재실행 PASS. 최초 Debug/Release 병렬 실행의 Release 1회 실패는 두 빌드가 같은 Pods Hermes 산출물을 교체한 경합으로 분리했으며 제품 compile 오류가 아니었다. 최종 Release bridge object에는 실제 course start/end selector 2개만 있고 Debug에만 fixture start/end selector 2개가 추가됨을 확인했다.
4. 다음 결정·위험·재현 조건
   - 새 native build 설치가 필요하다. 현재 검증 시점에는 CoreDevice가 iPhone을 찾지 못해 새 Debug 앱 설치와 잠금 화면 확인을 수행하지 못했으며 이를 통과로 기록하지 않는다. 앱 삭제는 필요하지 않다.
   - iPhone을 연결한 뒤 새 internal build에서 `(1) 테스트 Live Activity 종료 → 잠금 화면에서 대상이 사라짐, (2) Live Activity A3 → 카카오맵 전환 뒤 새 카드 생성, (3) 앱 복귀 → 테스트 Live Activity 종료 → 잠금 화면에서 다시 사라짐`만 확인한다. 버튼 결과가 부분 실패면 같은 버튼만 다시 누르고, 실제 코스 Activity가 보이더라도 종료되면 안 된다.
   - R 이전에 실제로 생성된 동적 `a3-<시각>` Activity는 exact legacy allowlist로 증명할 수 없어 `unknown`으로 보존된다. 해당 과거 카드가 남아 있으면 사용자가 잠금 화면에서 한 번 직접 닫고, 새 고정 fixture부터 위 3단계를 검증한다. 이를 위해 앱 삭제나 prefix 기반 자동 종료를 도입하지 않는다.
   - 위 사용자 확인과 보완 수락 전에는 B 화면 연결을 진행하지 않는다. B는 기존 사용자 교체 확인 뒤 `이전 exact actual run end → 새 actual run start`, handoff 성공 event에 `startCourseProgress`, stop/revision 변화에 exact update, 완료/취소에 exact end 순서로 연결해야 한다.

## 로컬 우선 B1~B6 완료 인수인계 — 2026-09-06

상태: **B1~B6 구현·자동/네이티브 검증 완료 / 실제 1곳·2곳 제한 실기기 확인 대기 / 서버 개인화 미연결**

### 변경 이력과 현행 로컬 계약

- 이전 방식: A 단계의 고정 테스트 Activity는 실제 코스의 immutable snapshot, `courseRunId`, 화면 진행·완료 repository와 분리되어 있었다. 코스가 background/강제 종료되면 React 화면 진행만 남았고, 도착·출발 Intent receipt, 이 기능 전용 로컬 알림과 exact 종료 정리를 실제 코스에서 사용할 수 없었다.
- 발생한 문제/관찰: 테스트 fixture를 실제 run으로 재사용하면 서로 다른 코스를 같은 Activity로 오인할 수 있다. 다음 길찾기 실패를 출발로 기록하거나 Intent의 명시 출발을 외부 handoff 성공으로 해석하면 화면 단계가 앞서간다. 앱 전용 snapshot과 App Group 상태가 손상됐을 때 새 상태로 덮어쓰면 복구 근거도 사라진다.
- 교체 방식: review에서 승인된 실제 1/2곳 `ActiveVerifiedCourse`와 검증된 travel/stay step만 immutable local plan으로 만들고 기존 안정적 `courseRunId`를 그대로 사용한다. 첫 Kakao handoff 성공 뒤에만 actual Activity·알림·공유 진행을 시작하며, 이후 handoff 성공만 명시 departure와 다음 travel을 함께 기록한다. 도착은 화면/Live Activity/알림 action으로 명시 확인하고, Live Activity의 명시 출발만으로 다음 길찾기를 열었다고 표시하지 않는다. final destination은 visit stop이 아니므로 체류로 기록하지 않는다.
- 일정/복구 방식: 도착은 `routeOpenedAt + moveMin + clamp(round(moveMin×0.2), 3, 10)`, 출발 안내는 `finalArrival - arrivalBuffer - remainingMove - laterStay - 5분`을 순수 경계에서 계산한다. 과거 시각은 로컬 알림을 즉시 한 번 예약하고, snooze는 같은 stop/revision에서 1회이며 다음 경계를 넘지 않는다. native Intent는 exact run/stop/revision receipt를 먼저 App Group에 남기고 Activity를 갱신한다. 앱 시작·foreground·알림 action 복귀 시 receipt를 revision 순으로 reconcile하고 앱 전용 실제 코스 snapshot으로 화면을 복구한다.
- 종료/저장 방식: 명시 코스 완료는 기존 completion controller/repository의 exactly-once 결과를 확인한 뒤, 도착과 출발이 모두 명시 확인된 stop의 실제 체류 분만 기존 완료 input에 전달한다. 완료·취소·incomplete·코스 교체는 해당 `courseRunId`의 Activity와 이 기능 소유 알림만 정리한다. terminal 상태는 먼저 보존하고 cleanup 실패 시 다음 앱 복귀에 같은 대상을 재시도한다. App Group 손상·미지원 version은 덮거나 지우지 않고 `storage_unreadable`로 fail-closed한다.
- 이유와 상태: 테스트 기술 검증을 실제 사용자 코스 lifecycle에 섞지 않으면서 외부 전환, native action, React 복귀가 하나의 stable identity와 직렬 writer를 사용하게 하기 위함이다. 이 규칙은 **현행 B1~B6 로컬 계약**이다. 서버 개인화·표본 저장은 구현하지 않았다.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `src/ui/liveActivity/courseProgressRuntimeModel.ts`, `courseProgressComposition.ts`: 실제 1/2곳 snapshot/route plan, serialized actual run controller, handoff·도착·receipt·복구·완료·exact cleanup을 연결했다.
   - `src/ui/liveActivity/courseProgressNotifications.ts`: 첫 실제 길찾기 전 1회 목적 설명/권한 요청, 도착·1회 snooze·출발 category/action, 이 기능 소유 notification ID registry와 exact 취소를 추가했다. 거절·오류는 Kakao handoff를 막지 않는다.
   - `src/ui/activeVerifiedCourseStorage.ts`, `src/ui/AppFlowContext.tsx`: 개인정보 없는 실제 코스 snapshot을 앱 전용 저장소에 보존하고, boot/foreground/notification action에서 App Group receipt와 단일 활성 run을 reconcile한다. 코스 교체 시 이전 exact run 정리를 새 run 시작보다 먼저 직렬화한다.
   - `src/ui/CourseConfirmScreen.tsx`, `courseCompletionUiModel.ts`: 첫/다음 실제 Kakao handoff 성공, 명시 `도착했어요`, 실제 체류 분 completion input, 완료·취소·incomplete cleanup을 기존 review/active 세로 카드와 CTA 흐름에 연결했다.
   - `src/ui/ProfileScreen.tsx`, `profileSettingsPort.ts`: 체류 동의 토글을 만들지 않고 시스템의 Live Activity 지원/허용 상태만 읽기 전용 `실시간 현황` 행에 표시한다.
   - `src/ui/liveActivity/localProgressModel.ts`, `lifecyclePolicy.ts`, `nativeLiveActivityPort.ts`: 실제 route 일정 필드, actual payload phase, shared state/receipt bridge를 확장했다.
   - `plugins/live-activity/TimeFitActivityAttributes.swift`, `TimeFitLiveActivityModule.swift`, `TimeFitLiveActivityModuleBridge.m`, `TimeFitLiveActivityExtension.swift`: minimal shared state와 receipt read/write/ack, exact actual lifecycle, iOS 17 Intent 도착·snooze·출발, Lock Screen/Dynamic Island 목적지·단계·시간 표시를 구현했다. `plugins/withTimeFitLiveActivity.cjs`가 같은 native 산출물을 재생성한다.
   - `test/ui/live-activity-course-runtime.test.ts`, `place-course-screen-runtime.test.mjs`, `profile-settings-screen.test.mjs`: 실제 1/2곳, 성공/실패 handoff, 중복/stale action, 강제 종료 복구, 손상 상태, 완료/정리와 실제 화면 호출·선택·복귀 계약을 실패 선행으로 고정했다.
2. 유지한 공개 계약·정책 경계
   - 추천 엔진·장소/route snapshot 산출·외부 API/cache·DB repository schema·기존 completion 멱등 계약을 수정하지 않았다. Live Activity 때문에 route/API를 다시 호출하지 않으며 현재 snapshot 순서만 소비한다.
   - 서버 개인화 저장, 사용자 ID·좌표·route geometry, 미동의 표본, 나중 업로드 큐, push/APNs, GPS/background location을 추가하지 않았다. Profile에 가짜 체류 동의/초기화 토글도 만들지 않았다.
   - 알림 거절, Activity disabled/start 실패, 저장/정리 지연은 이미 성공한 Kakao 전환과 기존 화면 진행을 취소하지 않는다. 다른 앱 알림, 테스트 fixture Activity, unknown/다른 실제 run을 전체 삭제하지 않는다.
   - 중앙 문서·작업 보드·엔진·API·DB·catalog는 수정하지 않았고 commit/push하지 않았다.
3. 실행한 테스트와 결과
   - 실패 선행/집중: `npx tsx --test test/ui/live-activity-course-runtime.test.ts test/ui/live-activity-lifecycle-policy.test.ts test/ui/live-activity-local-progress.test.ts test/ui/live-activity-a3-verification.test.ts` PASS 24/24. 실제 화면+Profile 집중 회귀 PASS 24/24.
   - `npm run test:typecheck`: PASS.
   - `npm run test:ui`: PASS 461, SKIP 1, FAIL 0 (총 462).
   - `npm test`: PASS 225/225.
   - `npx expo export --platform ios`: PASS.
   - `npx expo prebuild --platform ios --no-install` 연속 2회: PASS. Extension/main Swift와 양 target entitlement의 5개 checksum이 두 실행에서 동일해 plugin 재생성 멱등성을 확인했다.
   - `xcodebuild` iOS Simulator: Widget Extension Debug PASS, Widget Extension Release PASS, main+Extension Debug PASS. JS export로 Swift/Intent compile을 대체하지 않았다.
   - `git diff --check`: 아래 최종 실행 결과를 기준으로 PASS.
4. 다음 결정·위험·재현 조건
   - OS가 종료 중 앱 실행을 중단하면 terminal cleanup이 다음 실행까지 지연될 수 있다. 같은 run terminal 상태를 보존하므로 앱 재실행 시 exact Activity·알림만 다시 정리하는 것이 정상 fallback이다. 손상된 App Group 값은 자동 삭제하지 않는다.
   - 실제 알림 delivery 시각, 잠금 상태 Intent, Dynamic Island, 앱 강제 종료 뒤 복구는 자동/Simulator 빌드만으로 수락하지 않는다. 아래 제한 절차를 새 internal build가 설치된 iOS 17+ 실기기에서 각 코스 1회만 확인한다.

### 실제 1곳·2곳 제한 실기기 검증 절차

사전 조건: Expo Go가 아닌 이번 native internal build를 기존 앱 위에 설치한다. 테스트 Activity가 남아 있으면 internal `테스트 Live Activity 종료`로 test fixture만 정리한다. 알림 허용/거절은 한 조건씩만 사용하며 실제 외부 API 호출은 아래 Kakao handoff 외에 추가하지 않는다.

1. **실제 1곳 코스 1회**: review에서 코스를 시작하고 첫 `카카오맵에서 길찾기`를 누른다. 알림 목적 설명이 최초 1회만 보이고 허용/거절과 무관하게 Kakao 전환이 성공하는지 확인한다. 잠금 화면에 첫 장소명·이동 중·도착 예정 시간이 표시되는지 본다.
2. 잠금 화면 또는 앱의 `도착했어요`를 한 번 누른 뒤 앱으로 돌아와 같은 세로 카드가 체류 단계로 복구되는지 확인한다. 같은 action을 다시 눌러도 단계·완료 기록·알림이 중복되지 않아야 한다. 알림에서 `5분 뒤`를 사용했다면 같은 stop에서 두 번째 snooze가 적용되지 않아야 한다.
3. 체류 단계의 다음 길찾기를 한 번 실패시켜 현재 체류·재시도 상태와 미출발이 유지되는지 확인하고, 재시도 성공 시에만 최종 목적지 travel로 전환되는지 확인한다. 최종 목적지는 별도 방문/체류로 생성되면 안 된다. `코스 마치기` 후 Live Activity와 해당 run 알림이 사라지고 기록이 정확히 1건인지 확인한다.
4. **실제 2곳 코스 1회**: 새 코스를 시작하고 첫 장소 도착 확인 후 앱을 강제 종료했다가 다시 실행한다. 같은 `courseRunId`의 첫 장소 체류와 카드 위치가 복구되고 새 Activity가 추가 생성되지 않는지 확인한다.
5. 첫 장소의 다음 Kakao handoff 성공 뒤에만 두 번째 장소 travel로 넘어가고, 첫 장소 실제 체류가 도착→출발 확인 구간으로 보존되는지 확인한다. 두 번째 장소에서도 도착·출발을 각각 한 번 확인하고, A→B→최종 목적지 순서와 하나의 Live Activity가 유지되는지 본다.
6. 마지막 `코스 마치기`를 누른 뒤 Activity·해당 run 알림·활성 진행이 정리되고 완료 기록은 1건인지 확인한다. 도착 또는 출발 확인이 빠진 장소에는 추정 체류 분이 생성되지 않아야 한다. 테스트 fixture/다른 알림은 영향을 받지 않아야 하며, Profile의 `실시간 현황`은 실제 시스템 지원/허용 상태만 보여야 한다.

실기기 반환 시에는 `1곳 PASS/FAIL`, `2곳 PASS/FAIL`, 실패 단계 번호, 화면의 비밀 없는 상태 문구만 남긴다. 사용자 ID·좌표·실제 주소·서버 payload는 캡처하거나 기록하지 않는다.

## B1~B6 수락 전 보완 완료 인수인계 — 2026-09-06

상태: **세 보완 구현·자동/네이티브 검증 완료 / 실기기 미확인 / B 최종 수락 보류**

### 변경 이력과 현행 보완 계약

- 이전 native snooze: Activity ContentState가 revision만 올리고 같은 stop의 사용 여부를 갖지 않아 새 revision의 두 번째 snooze가 가능했다. → 같은 `courseRunId+stopId` 방문 전체의 `snoozeUsed`를 ContentState와 공유 진행에 보존하고 native 실행 경계에서 phase·사용 여부·저장 boundary를 함께 검사한다. → React가 정지돼도 두 번째 Intent를 거절하고 TS 복귀 reducer와 같은 1회 정책을 유지하기 위함이다. **현행**. 이전 native payload에 필드가 없으면 명시 decoder가 `false`로 migration하며 손상/미지원 App Group 진행 JSON은 초기화하지 않는다.
- 이전 종료 정리: terminal shared state에 의존해 Activity와 알림을 한 번 취소했고, 활성 코스 snapshot 삭제 뒤에는 재시도 entry가 없었다. 알림 개별 취소 실패도 삼켰다. → 별도 versioned terminal cleanup queue가 exact Activity identity와 소유 notification ID만 부수효과 전에 저장하고, 앱 cold start/foreground에서 활성 snapshot과 무관하게 재시도한다. 성공 대상은 즉시 queue에서 제거하고 실패 대상만 남긴다. → 완료 repository 재실행 없이 부분 실패와 프로세스 종료를 복구하기 위함이다. **현행**. queue 손상/unknown은 무차별 삭제하지 않는다.
- 이전 알림 소유: 단일 v1 registry를 최종 예약 뒤 한 번 저장해 두 번째 예약 실패 시 첫 ID가 유실될 수 있었다. → run별 v2 registry에 예약 ID를 하나 생성할 때마다 즉시 기록하고 취소 성공 ID만 제거한다. native snooze가 만든 pending request도 `purpose=course_progress+courseRunId`를 대조해 exact cleanup 대상에 합친다. legacy v1은 읽기 migration하며 다른 run·무관 알림은 보존한다. **현행**.
- 이전 실제 체류: `(departedAt-arrivedAt)`을 `Math.round`해 59초·100초 같은 불완전 분을 올림할 수 있었다. → 두 시각이 finite이고 순서가 유효할 때만 `floor(delta/60000)`를 사용한다. → 상위 확정 측정 단위를 정확히 따르기 위함이다. **현행**. 계획 체류와 개인화 중앙값의 5분 반올림은 변경하지 않았다.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `src/ui/liveActivity/terminalCleanupModel.ts`: 여러 run을 덮어쓰지 않는 최소 exact 종료 queue, target resolution, Activity/알림별 부분 성공 보존, cold-start 멱등 재시도를 추가했다.
   - `src/ui/liveActivity/courseProgressRuntimeModel.ts`, `courseProgressComposition.ts`, `src/ui/AppFlowContext.tsx`: terminal 부수효과 전 queue 준비, 활성 state 부재 시에도 same-run 정리, boot/foreground 전역 재시도, actual dwell 내림을 production lifecycle에 연결했다.
   - `src/ui/liveActivity/courseProgressNotifications.ts`: v1 읽기 호환 v2 다중-run ownership registry, 예약 직후 ID 기록, 개별 취소 결과 보존, native pending request exact 대조를 구현했다.
   - `src/ui/liveActivity/lifecyclePolicy.ts`: actual payload의 optional `snoozeUsed`를 검증해 기존 호출 호환을 유지했다.
   - `plugins/live-activity/TimeFitNativeProgressPolicy.swift`: TS와 동일 입력으로 실행 가능한 native snooze 정책을 분리했다.
   - `plugins/live-activity/TimeFitActivityAttributes.swift`, `TimeFitLiveActivityExtension.swift`, `TimeFitLiveActivityModule.swift`: 이전 payload decode 기본값, same-stop native snooze 1회, 버튼 비노출과 실행 경계 이중 검사, native snooze 로컬 알림과 ownership metadata를 연결했다.
   - `plugins/withTimeFitLiveActivity.cjs`: 새 native 정책 source가 Extension target에 반복 prebuild로 생성되게 했다.
   - `test/ui/live-activity-course-runtime.test.ts`, `live-activity-terminal-cleanup.test.ts`, `live-activity-native-policy.test.mjs`, `fixtures/TimeFitNativeProgressPolicyHarness.swift`, `live-activity-notification-ownership.test.mjs`, `place-course-screen-runtime.test.mjs`: 세 결함과 교차 채널·부분 실패·완료 input을 실행형 fixture로 고정했다.
2. 유지한 공개 계약·정책 경계
   - 동일 stop snooze 1회, 다음 stop 독립 1회, 다음 boundary 초과 거절, handoff 성공만 출발, final destination 비체류, 기존 `courseRunId`와 completion repository exactly-once 계약을 유지했다.
   - 추천 엔진·계획 체류·개인화 중앙값·외부 API/cache·DB repository/schema·catalog·env를 수정하지 않았다. 서버 개인화, 미동의 표본, 업로드 queue, GPS/background location, push/APNs를 추가하지 않았다.
   - terminal queue에는 run과 Activity identity·notification ID만 있으며 원시 도착/출발 시각을 복제하지 않는다. 다른 run/fixture/unknown Activity와 무관 알림을 전체 삭제하지 않는다.
   - 작업 보드·중앙 정책 문서를 수정하지 않았고 commit/push하지 않았다.
3. 실패 선행 및 최종 자동·네이티브 검증 결과
   - 실패 선행: 59초가 `1분`으로 저장되는 assertion failure, `terminalCleanupModel` 부재, native policy source 부재를 각각 재현했다. 알림 두 번째 예약 실패 시 첫 ID 보존 fixture도 추가한 뒤 production-used registry에 연결했다. 실패 test를 삭제하거나 skip하지 않았다.
   - 집중 TS 전체: 기존 Live Activity 24건을 보존한 `npx tsx --test test/ui/live-activity-*.test.ts` PASS 30/30.
   - native 실행 하네스+알림 소유+config+실제 CourseConfirm: PASS 25/25. `xcrun swiftc`로 같은 stop 두 번째 snooze 거절, boundary 거절, 다음 stop 독립 허용을 실제 실행했다. 완료 화면은 내림된 `actualDwellMin=1`을 기존 completion input에 정확히 1회 전달했다.
   - `npm run test:typecheck`: PASS.
   - `npm run test:ui`: PASS 471, SKIP 1, FAIL 0 (총 472; 기존 intentional skip 유지).
   - `npm test`: PASS 229/229.
   - `npx expo export --platform ios`: PASS.
   - `npx expo prebuild --platform ios --no-install` 연속 2회: PASS. 새 policy를 포함한 main/Extension Swift와 entitlement 6개 checksum 동일.
   - `xcodebuild` main+embedded Extension iOS Simulator Debug: PASS. Release: PASS. Swift/AppIntent/UserNotifications compile을 JS export로 대체하지 않았다.
   - `git diff --check`: 최종 실행 PASS.
4. 실기기 미확인·위험·다음 확인
   - **자동/네이티브 compile로 확인됨:** TS/Swift 동일 snooze 결정, 이전 ContentState decode fallback, exact cleanup 부분 실패·cold-start 재시도, 예약 ID 즉시 보존, 초 단위 floor, 1/2곳 기존 화면/완료 회귀.
   - **실기기 미확인:** 잠금 상태에서 첫 native snooze가 실제 로컬 알림으로 다시 발화하는 시각, 같은 stop의 두 번째 잠금화면 action 거절 표면, 앱 복귀 뒤 Activity/React revision·단계·시각 일치, OS 중단 뒤 실제 Activity/알림 cleanup 재시도, 실제 1곳·2곳 종료 후 잔존 여부. 이 항목은 PASS로 기록하지 않는다.
   - Extension ContentState와 native notification 동작이 바뀌었으므로 **새 native internal build가 필요하다**. 앱을 삭제하지 말고 기존 앱 위에 설치해 로컬 복구 데이터를 유지한다.
   - 제한 확인은 `(1) 실제 1곳 첫 이동에서 잠금화면 5분 뒤 1회→두 번째 거절→앱 복귀 상태 일치→완료 후 Activity/해당 알림 없음`, `(2) 실제 2곳에서 첫 stop snooze 사용 후 두 번째 stop snooze 1회 허용→완료 후 동일 정리`만 각 1회 수행한다. 강제 Activity/알림 실패와 외부 handoff 실패는 fake port에서 검증했으므로 실기기에서 임의 실패를 만들지 않는다.
   - 반환은 `1곳 PASS/FAIL`, `2곳 PASS/FAIL`, 실패 단계와 비밀 없는 화면 상태만 기록한다. 이 확인과 QA-LIVE-LOCAL-01 통합 검토 전까지 B 전체를 최종 수락으로 승격하지 않는다.

## 잠금화면 도착 복구·출발 자동 길찾기 완료 인수인계 — 2026-09-06

상태: **구현·자동 회귀·네이티브 Debug/Release 빌드 검증 완료 / 새 internal build 실기기 확인 전 / 최종 수락 보류**

### 실패 원인 재확인과 현행 계약

- 이전 방식: `LiveActivityIntent` 구현이 Widget Extension source에만 포함돼 있었고, 실행 실패를 사용자 취소 하나로 합쳐 처리했다. → 관찰: 실기기 잠금화면의 `도착했어요` 뒤 앱과 Activity가 이동 중에 머물렀으나 앱의 동일 동작은 정상 갱신됐다. → 교체: Apple의 현재 interactive Live Activity 실행 계약에 맞춰 동일 Intent source를 main app target과 Extension target에 모두 포함하고, `intent_entered → exact target 대조 → pending/receipt 저장 → Activity 갱신 → target 갱신 → completed` 경계를 비밀 없는 enum 진단으로 분리했다. → 이유: Intent는 앱 프로세스에서 실행될 수 있으므로 app target membership이 필요하고, 재발 시 실제 실패 경계를 식별해야 한다. → 상태: **현행·코드 결함 수정 완료**.
- 확정 가능 범위: main target membership 누락은 정적 구성과 Apple 실행 계약으로 확인한 실제 코드 결함이다. 다만 이전 설치 빌드에는 단계별 진단이 없었으므로 당시 버튼이 Intent 진입 전에 막혔는지, receipt/Activity 갱신 중 실패했는지는 사후 확정하지 않는다. 새 internal build에서 재현될 때 남는 enum만 실제 실기기 실패 경계의 근거로 사용한다.
- 첫 유효 도착은 예정시각 gate 없이 receipt를 먼저 보존하고 즉시 `dwelling`으로 Activity를 갱신한다. 동일 event, 다른 채널, old revision은 최초 도착 시각과 단계를 덮어쓰지 않는다. 실패는 `intent_entered`, `target_record_mismatch`, `activity_missing`, `target_identity_mismatch`, `receipt_write_failed`, `pending_write_failed`, `activity_update_failed`, `target_update_failed`, `completed`, 앱 reconcile 성공/실패로만 남긴다. 키·좌표·주소·사용자 ID·원시 체류 시각은 진단에 포함하지 않는다. **현행**.
- 이전 출발: 잠금화면에서 출발을 확인해도 앱에서 다음 길찾기를 다시 눌러야 했다. → 교체: 명시 출발 receipt와 최소 pending action을 같은 event identity로 내구 저장하고 `TimeFitDepartureIntent.openAppWhenRun`으로 앱을 활성화한다. 앱은 코스와 receipt 복구 뒤 immutable snapshot의 다음 travel만 기존 Kakao app-scheme→HTTPS adapter에 한 번 전달한다. → 이유: 잠금 해제 뒤 추가 앱 버튼 없이도 같은 사용자의 명시 동작을 이어가되 공개 deep link나 GPS/API 재계산을 권한 근거로 사용하지 않기 위함이다. → 상태: **현행·실기기 확인 전**.
- pending은 `pending/executing/success/failure`를 구분한다. adapter 성공 뒤에만 `routeOpened=true`와 다음 travel 단계로 전이한다. 알려진 실패는 기존 다음 길찾기 CTA로 한 번 재시도하며 `departedAt`을 바꾸지 않는다. 외부 전환 직후 프로세스가 끝나 `executing`으로 복구되면 성공 불명확으로 보고 자동 재호출하지 않는다. 완료·취소·교체는 exact run/action만 정리한다. **현행**.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `plugins/live-activity/TimeFitLiveActivityIntents.swift`: 도착·snooze·출발 Intent를 공유 source로 분리하고 main app/Extension 양 target에서 컴파일되게 했다. 도착 즉시 동기화, 출발 pending 생성, 앱 활성화, 단계별 내부 진단을 구현했다.
   - `plugins/live-activity/TimeFitActivityAttributes.swift`, `TimeFitLiveActivityModule.swift`, `TimeFitLiveActivityModuleBridge.m`, `TimeFitNativeIntentPolicy.swift`, `plugins/withTimeFitLiveActivity.cjs`: exact target/진단/pending 저장소와 bridge, 순수 native phase 정책, 양 target source membership 및 반복 가능한 prebuild 생성을 추가했다. 생성된 `ios/mobile/`, `ios/TimeFitLiveActivityExtension/`, `ios/mobile.xcodeproj/project.pbxproj`는 plugin 결과와 동기화했다.
   - `src/ui/liveActivity/pendingNavigationHandoffModel.ts`, `nativeLiveActivityPort.ts`, `src/ui/AppFlowContext.tsx`: 변조를 거절하는 최소 pending decoder, 원자적 상태 전이, cold/warm start의 코스·receipt 선복구, 실행 중 중복 차단과 성공 불명확 처리를 연결했다.
   - `src/ui/HomeScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: exact same run 요청만 기존 CourseConfirm으로 복구하고, 추가 CTA 없이 승인 snapshot의 1곳 최종 목적지/2곳 다음 방문·최종 목적지 구간을 기존 Kakao fallback에 전달했다. 실패와 성공 불명확은 기존 다음 길찾기 CTA의 재시도 상태로 남긴다.
   - `test/ui/live-activity-pending-navigation.test.ts`, `live-activity-config-plugin.test.mjs`, `live-activity-native-policy.test.mjs`, `fixtures/TimeFitNativeIntentPolicyHarness.swift`, `live-activity-course-runtime.test.ts`, `place-course-screen-runtime.test.mjs`: target membership 결함과 예정시각 전 도착, 중복/old revision, cold/warm 복구, 올바른 다음 구간 1회, 외부 실패/불명확, 변조·교체·완료 adapter 0을 실패 선행 fixture로 고정했다.
2. 유지한 공개 계약·정책 경계
   - 동일 `courseRunId`·stop·revision·receipt의 single-writer 및 완료 기록 exactly-once, 기존 snooze 1회·terminal cleanup queue·실제 체류 floor 계약을 유지했다.
   - 추천 엔진, immutable route snapshot 산출, 외부 API/cache, DB repository/schema, catalog/env, 서버 개인화·미동의 표본·push/APNs·GPS/background location을 수정하거나 추가하지 않았다. 공개 URL·좌표를 pending capability에 저장하지 않는다.
   - 일반 앱 길찾기의 성공 시 출발 계약과 기존 Kakao app-scheme→HTTPS fallback을 재사용했다. 별도 출발/재확인 버튼, 전체 Activity/알림 초기화, 앱 활성화 자체를 trigger로 하는 무조건 외부 실행은 추가하지 않았다.
   - 작업 보드와 중앙 정책 문서는 수정하지 않았고 commit/push하지 않았다.
3. 실패 선행 및 최종 자동·네이티브 검증 결과
   - 실패 선행에서 공유 Intent source와 app target membership 부재, pending handoff model 부재를 재현했다. 실제 화면 fixture 연결 중 native port 미주입으로 발생한 React Native import 실패 13건도 테스트 하네스 결함으로 분리해 production 화면 경계를 주입한 뒤 해결했다. 실패 test 삭제/skip으로 우회하지 않았다.
   - 집중 최종: `npm run test:typecheck && npx tsx --test test/ui/live-activity-*.test.ts test/ui/place-course-screen-runtime.test.mjs` PASS 55/55.
   - 실패 범위 재확인: typecheck 뒤 config plugin·native phase harness·pending handoff·실제 course runtime·실제 CourseConfirm 연결을 다시 실행해 PASS 41/41, FAIL 0을 확인했다. main target membership, 17:04 예정/16:48 도착, 중복·stale, 실패 재시도, 성공 불명확 자동 재호출 0, 변조/교체/완료 adapter 0이 모두 포함된다.
   - 전체 UI: `npm run test:ui` PASS 480, SKIP 1, FAIL 0 (총 481; 기존 실제 Supabase 통합 skip 유지). 전체 회귀: `npm test` PASS 232/232.
   - `npx expo export --platform ios`: PASS. `npx expo prebuild --platform ios --no-install`: PASS. plugin 대상 파일 checksum을 전후 비교해 project/main/Extension 생성물이 동일함을 확인했다.
   - main+embedded Extension `xcodebuild` iOS Simulator Debug PASS, Release PASS. `TimeFitLiveActivityIntents.swift`가 양 target Sources에 포함되고 Swift/AppIntent가 실제 compile되는 것을 확인했다. 순수 Swift 실행 하네스로 예정시각 전 도착 허용, 도착/출발 중복 거절과 비역행 전이를 검증했다.
   - `git diff --check`: PASS. 자동 테스트와 컴파일 결과를 잠금화면 실기기 성공으로 대신 기록하지 않는다.
4. 실기기 미확인·위험·다음 확인
   - 새 native internal build를 앱 삭제 없이 기존 설치 위에 올린 뒤 확인해야 한다. 이전 빌드는 main target Intent와 새 진단/pending bridge를 포함하지 않아 이번 수정의 검증 대상이 아니다.
   - 우선 1곳 코스에서 잠금화면 `도착했어요` 1회 → 즉시 `머무는 중` → 잠금 해제 뒤 같은 앱 단계·동일 최초 도착 시각을 확인한다. 앱에서 도착 버튼을 다시 누르지 않는다. 실패하면 내부 build의 마지막 비밀 없는 진단 enum과 화면 단계만 반환한다.
   - 이어 잠금화면 `이제 출발해요` 1회 → 시스템 인증/잠금 해제 → TimeFit 활성화 → 추가 앱 탭 없이 정확한 최종 목적지 Kakao 구간이 열리는지 확인한다. 2곳 코스는 첫 stop→둘째 stop과 마지막 stop→최종 목적지를 각각 확인한다. 성공 전 `routeOpened`/다음 travel 전이가 없어야 한다.
   - 잠금 해제를 취소한 경우 자동 성공이나 외부 실행이 없어야 한다. 다시 앱에 들어왔을 때 보류/실패 또는 성공 불명확 상태를 유지하고 기존 다음 길찾기 CTA만 재시도 수단이어야 한다. 이 실제 OS 행동과 Kakao 전환은 아직 확인하지 않았으므로 최종 수락은 보류한다.

## 잠금화면 버튼 진단 구현 인수인계 — 2026-09-06

상태: **진단 구현·자동 회귀·네이티브 Debug/Release 컴파일 완료 / 실기기 경계 증거 대기 / 원인·기능 수락 보류**

### 변경 이력과 현행 진단 계약

- 이전 방식: App Group의 단일 마지막 진단 파일을 Intent와 `app_reconcile`이 함께 덮어썼고, 네이티브 조회 bridge는 Debug에서만 컴파일됐으며 화면 연결이 없었다. → 발생한 문제: 앱 복귀 뒤 Intent 기록이 사라져 `perform` 진입, receipt 저장, Activity 갱신, 앱 반영 중 어디까지 성공했는지 증거로 구분할 수 없었다. → 교체한 방식: main/Extension이 공유하는 별도 `intent`/`app` 스트림에 이벤트별 원자 파일을 append하고 스트림당 최근 32건만 보존한다. internal Release에서 현재 build와 두 스트림을 읽고 허용 필드만 복사하며 진단만 초기화한다. → 교체 이유: 앱 복귀가 Intent 증거를 덮지 않게 하고 한 attempt의 마지막 성공과 최초 실패를 같은 상관관계로 판별하기 위함이다. → 상태: **현행·진단 준비 완료**.
- 진단 필드는 schema/native source/build, stream/action, 불투명 attempt ID, stage/result/error enum, phase/revision, target 동일성 boolean으로 제한한다. 실제 `courseRunId`, stop/place ID·명칭, 좌표·주소, 사용자 ID, 원시 도착·출발 시각, 토큰, 전체 payload는 기록·표시·복사하지 않는다. 상세 기록은 App Group 로컬 bounded 파일이며 서버 전송은 0이다. 진단 쓰기 실패는 독립 native unified log의 비밀 없는 `diagnostic_store_failed`만 남기고 제품 action의 성공/실패를 바꾸지 않는다. **현행**.
- 화면은 기존 internal 경계 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'` 또는 개발 빌드에서만 보인다. 새 env를 만들지 않았다. 일반 Release에서 해당 값이 없거나 정확히 `true`가 아니면 노출되지 않는다. native read/copy/clear bridge는 internal Release 번들에서 호출할 수 있도록 Release에도 컴파일하되, 제품 화면 노출은 위 JS 경계로 차단한다. **현행**.
- 이전 설치본에서 관찰된 `잠금화면 도착 무반응`, `Release 출발 뒤 앱 열림`은 입력 증거일 뿐, 어느 native stage가 실패했는지는 당시 기록으로 확정할 수 없다. 기존 main-target membership 누락 수정만으로 해결되지 않았다는 사용자 결과를 기준으로 삼았고, 이번 작업에서 phase 정책·target 비교·receipt 처리·Activity 갱신·pending handoff를 추측으로 완화하거나 변경하지 않았다. **원인 미확정**.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `plugins/live-activity/TimeFitLiveActivityDiagnostics.swift`: 두 독립 스트림, 이벤트별 원자 저장, 각 32건 상한, 파일 보호, 허용 enum/boolean projection, 독립 저장 실패 로그를 추가했다.
   - `plugins/live-activity/TimeFitLiveActivityIntents.swift`, `TimeFitActivityAttributes.swift`: 기존 단일 덮어쓰기 저장소를 제거하고 `intent_entered → target_lookup/phase_validation → pending/receipt write before·after → activity update requested·observed → target write before·after → perform completed/failed`를 동일 attempt ID로 기록한다.
   - `plugins/live-activity/TimeFitLiveActivityModule.swift`, `TimeFitLiveActivityModuleBridge.m`, `plugins/withTimeFitLiveActivity.cjs`: 앱 boot/foreground/reconcile 진단, main/embedded Extension build 식별, Release read/copy/clear bridge, main/Extension 양 target source membership과 반복 prebuild 생성을 연결했다. 생성된 `ios/mobile/`, `ios/TimeFitLiveActivityExtension/`, `ios/mobile.xcodeproj/project.pbxproj`도 plugin 결과와 동기화했다.
   - `src/ui/liveActivity/liveActivityDiagnosticsModel.ts`, `liveActivityDiagnostics.ts`, `courseProgressRuntimeModel.ts`, `courseProgressComposition.ts`, `src/ui/AppFlowContext.tsx`, `src/ui/CourseConfirmScreen.tsx`: 비밀 필드를 버리는 strict decode와 `last_success`/`first_failure` 요약, 앱의 boot/foreground·receipt read/accept/reject·screen apply·pending claim 결과를 별도 app stream에 연결했다.
   - `src/ui/TimeSetupScreen.tsx`: internal 전용 `Live Activity 버튼 진단` 조회 화면, 현재 build/조회 실패/진단 없음 구분, 허용 필드 native 복사, 제품 state에 손대지 않는 `새 관찰 시작`을 추가했다.
   - `test/ui/live-activity-diagnostics.test.ts`, `live-activity-config-plugin.test.mjs`, `unified-time-route-setup.test.mjs`, `place-course-screen-runtime.test.mjs`: app reconcile 뒤 Intent 보존, 스트림 상한·동시 append 구조, 비밀 필드 제외, Release 조회 연결과 화면 gate, 진단 실패 시 제품 동작 불변을 실패 선행 fixture로 고정했다.
2. 변경하지 않은 공개 계약·정책 경계
   - 도착·출발·snooze phase/revision 정책, exact same-run/stop target 비교, receipt/pending single-writer와 reducer, Activity 갱신 및 Kakao handoff 동작을 변경하지 않았다. 진단 결과가 제품 action 결과를 바꾸지 않는다.
   - 추천 엔진, 외부 API/adapter, DB repository/schema, catalog, 인증·개인화, 알림/Live Activity entitlement, App Group, 권한, 환경변수 계약을 추가·변경하지 않았다. 브라우저 fallback 종료와 Activity 시작 결합 문제도 별도 현상으로 보존했다.
   - 실제 Activity, receipt, pending, active course, 완료 history를 진단 초기화 대상으로 삼지 않았다. 앱 삭제·원격 배포·commit·push를 수행하지 않았다.
3. 실패 선행 및 자동·네이티브 검증 결과
   - 실패 선행: 공유 진단 source 부재로 config test가 실패했고, `__DEV__=false` internal Release fixture에서 진단 진입 행이 없어 화면 test가 실패했다. 단일 기록이 app reconcile에 덮이는 모델 반례와 허용 목록 밖 `courseRunId`/장소명이 표시되지 않는 fixture를 추가했다. 실패 test를 삭제하거나 skip하지 않았다.
   - 집중 진단/config/화면/runtime 검증 PASS. 최종 `npm run test:typecheck` PASS, `npm run test:ui` PASS 484·SKIP 1·FAIL 0(총 485), `npm test` PASS 234/234.
   - `npx expo export --platform ios` PASS(1,286 modules). `npx expo prebuild --platform ios --no-install` 연속 2회 PASS이며 main/Extension diagnostic Swift와 project checksum이 반복 실행 전후 동일했다.
   - main+embedded Extension `xcodebuild` Debug PASS, Release PASS. 처음 병렬 실행한 Release 1회는 동일 DerivedData lock 경합으로 exit 65였고 단독 재실행에서 성공했다. Swift/AppIntent와 Release bridge가 실제 compile되는 것까지 확인했으며 이를 잠금화면 Intent 실행 성공으로 기록하지 않는다.
   - `git diff --check` PASS. 사용자 지시 이후 Simulator 설치·실행·화면 조작은 수행하지 않았다. 지시 전에 Release 설치·launch까지만 1회 시도됐으나 화면 자동화 접근이 거부되어 관찰 증거는 없으며 수락 결과에 포함하지 않는다.
4. 남은 위험·증거 수집·다음 결정
   - 현재 사용자 관찰과 자동/컴파일 결과만으로는 실제 설치 빌드의 **마지막 성공 stage와 최초 실패 stage를 확정할 수 없다**. 새 internal Release에서 아래 제한 절차로 복사한 안전 보고가 필요하다. 따라서 root cause와 제품 수정, B 연결 수락은 모두 보류한다.
   - 앱을 삭제하지 않고 새 internal Release를 기존 설치 위에 올린다. `시간 설정 → Live Activity 버튼 진단`에서 main/Extension build와 native source revision을 먼저 확인하고 `새 관찰 시작`을 누른다. 이는 진단 기록만 지운다.
   - 기존 활성 코스가 현재 build의 Activity임이 확실하면 재사용한다. 불명확할 때만 기존 앱의 정상 취소 뒤 부산 수동 장소의 1곳 코스를 한 번 만든다. 이동 중 Activity를 확보하고 잠금화면 `도착했어요`를 정확히 1회 누른 뒤 Activity를 확인한다. 앱으로 돌아와 앱의 도착 버튼은 누르지 않고 진단 화면을 새로 조회해 `허용 필드만 복사` 결과를 반환한다.
   - 판별은 같은 attempt의 `boundary ... last_success=... first_failure=... error=...`로 한다. Intent 항목이 없으면 진단 저장/읽기 생존과 독립 unified log부터 확인한 뒤 AppIntent discovery/OS 실행 경계를 본다. `target_lookup` 실패면 identity 비교, receipt write 실패면 App Group·파일 보호/schema, Activity update 뒤 앱 미반영이면 app stream의 receipt read/reject·revision·screen apply, 출발이면 pending claim과 adapter 결과를 각각 다음 최소 수정 후보로 삼는다. 진단 없음만으로 `perform` 미진입을 단정하지 않는다.
   - 관련 구현 위치: `plugins/live-activity/TimeFitLiveActivityIntents.swift`의 Intent 단계 기록, `TimeFitLiveActivityDiagnostics.swift`의 저장 경계, `TimeFitLiveActivityModule.swift`의 Release 조회/복사, `src/ui/liveActivity/liveActivityDiagnosticsModel.ts`의 경계 요약, `src/ui/TimeSetupScreen.tsx`의 internal 화면이다. 실제 보고를 받은 뒤에만 확정 원인, 최소 수정안, 영향 회귀를 후속 결정한다.

## 잠금화면 버튼 진단 저장 오류 반환 보완 — 2026-09-06

상태: **확정 코드 결함 수정·자동/실기기 대상 컴파일 완료 / 새 실기기 build 재확인 필요**

### 증거와 교체 이력

- 사용자 Xcode 캡처에서 `TimeFitLiveActivityDiagnosticStore.record`의 `Data.write`가 `withoutOverwriting is not supported with atomic`을 반환하며 중단된 것을 확인했다. 이는 빌드 오류가 아니라 앱 boot 진단 저장 시 재현된 Foundation 런타임 오류다.
- 이전 방식: 진단 JSON과 실제 Intent receipt가 `Data.WritingOptions`의 `.atomic`과 `.withoutOverwriting`을 한 호출에 함께 사용했다. → 발생한 문제: Foundation이 이 조합을 지원하지 않아 진단은 항상 저장 실패하고, 동일 조합을 쓰는 도착 receipt도 저장 단계에서 실패할 수 있었다. → 교체한 방식: UUID 고유 이름의 진단 이벤트는 `.atomic`만 사용한다. immutable receipt는 UUID 임시 파일에 `.atomic`으로 완전 기록한 뒤 같은 디렉터리의 확정 목적지로 `FileManager.moveItem`하여 기존 event를 덮어쓰지 않는다. → 교체 이유: 완전 파일 공개와 중복 event 불변성을 동시에 보존하면서 금지된 옵션 조합을 제거하기 위함이다. → 상태: **현행·확정 결함 수정 완료**.
- native/JS diagnostic revision을 `ula-button-diagnostic-2026-09-06.2`로 올렸다. 이전 `.1` 설치본은 이번 수정 검증 대상이 아니며 삭제할 필요 없이 새 build를 덮어 설치한다.

### 완료 인수인계 4항목

1. 변경 파일과 변경 목적
   - `plugins/live-activity/TimeFitLiveActivityDiagnostics.swift`: UUID 이벤트 저장을 `.atomic` 단독으로 수정하고 native revision을 `.2`로 갱신했다.
   - `plugins/live-activity/TimeFitActivityAttributes.swift`: receipt를 같은 디렉터리의 고유 임시 파일에 원자 작성한 뒤 기존 목적지를 덮어쓰지 않는 move로 확정하도록 수정했다.
   - `src/ui/liveActivity/liveActivityDiagnosticsModel.ts`, `test/ui/live-activity-diagnostics.test.ts`: JS/native 표시 revision과 fixture를 `.2`로 맞췄다.
   - `test/ui/live-activity-config-plugin.test.mjs`: 두 native 저장 경로에서 금지 조합이 재도입되지 않고 진단 atomic·receipt staged move가 유지되는 실패 선행 계약을 추가했다.
   - `ios/mobile/`, `ios/TimeFitLiveActivityExtension/`: config plugin 재생성 결과를 동기화했다.
2. 유지한 공개 계약·정책 경계
   - 스트림별 32건, Intent/app 분리, 비밀 없는 필드, 진단 실패가 제품 action 결과를 바꾸지 않는 계약을 유지했다.
   - receipt의 immutable event ID와 중복 덮어쓰기 금지, exact run/stop/revision 검증을 유지했다. 도착·출발·snooze 정책이나 Activity 갱신 순서는 변경하지 않았다.
   - 엔진/API/DB/catalog/env/entitlement/App Group과 브라우저 fallback을 수정하지 않았다. 앱 삭제·Simulator 테스트·실제 API·commit/push를 수행하지 않았다.
3. 실패 선행 및 검증 결과
   - 새 config 계약이 기존 `.atomic + .withoutOverwriting` 두 경로에서 실패하는 것을 먼저 확인했다. 수정 뒤 PASS 7/7.
   - 진단/runtime 집중 회귀 PASS 12/12. macOS Foundation 실행 하네스에서 첫 staged move 성공, 같은 목적지 두 번째 move 거절, 첫 내용 보존을 확인했다: `atomic-stage-no-overwrite: PASS`.
   - `npm run test:typecheck` PASS. `npm run test:ui` exit 0(PASS 485, 기존 SKIP 1), `npm test` PASS 235/235.
   - `npx expo prebuild --platform ios --no-install` PASS. 실제 기기를 실행하지 않는 `generic/platform=iOS`, main+embedded Extension Debug build와 AppIntents metadata 추출 PASS.
   - 사용자 지시에 따라 Simulator 설치·실행·화면 조작은 수행하지 않았다. `git diff --check` 최종 PASS.
4. 다음 확인·위험
   - 현재 Xcode에 pause된 프로세스는 `.1` 바이너리이므로 Resume만 해서는 수정이 반영되지 않는다. Stop 후 새 `.2` build를 동일 실기기에 덮어 설치해야 한다. 앱 삭제는 하지 않는다.
   - 새 build에서 먼저 시간 설정의 `Live Activity 버튼 진단` build line이 `.2`인지 확인한다. 앱 boot에서 같은 exception breakpoint가 재발하지 않는지 확인한 뒤 기존 제한 절차의 잠금화면 `도착했어요` 1회와 진단 복사를 수행한다.
   - 저장 옵션 오류는 사용자 캡처로 확정돼 수정됐지만, 이것만으로 잠금화면 Intent의 최종 원인을 모두 확정하지 않는다. `.2` 보고의 `last_success`/`first_failure`를 받아 target lookup·receipt·Activity update·app reconcile 중 남은 최초 실패를 판별한다.
