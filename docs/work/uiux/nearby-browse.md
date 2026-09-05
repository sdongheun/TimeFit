# U-NEARBY-BROWSE-01 — 주변 지도·사진 마커·거리순 목록

## 통합 수락 — 2026-09-05

UI 수정 인계의 자동 회귀와 사용자의 실기기 드래그 매끄러움 확인을 근거로 U-NEARBY-SHEET-DRAG-01을 제한 수락한다. 사용자가 별도 QA 반복 생략을 결정했다. 아래 native 대기는 이 사용자 확인 범위에서 해소됐으며 모든 기기·큰 글씨·N1~N6 개별 항목 통과를 뜻하지 않는다. 지도 표시도 앞서 사용자 확인됐다. 별도 QA 세션은 실행하지 않았으며 미확인 접근성/작은 화면은 출시 최종 묶음에 남긴다.

## 최신 실행 명령 — U-NEARBY-SHEET-DRAG-01

상태: **UI 수정·자동 회귀 완료 / native 검증 전**. UX-34의 동작 보완이며 정책 변경은 없다. 아래 과거 진단의 제품 수정 금지는 진단 작업에만 적용된다. 이번 명령은 확인된 결함의 UI 수정만 허용한다.

이전 boolean 끝점 기준 move·측정 effect 즉시 reset → 중간 재잡기/측정 변경에서 높이 점프 재현 → 현재 높이 기반 gesture와 정착/측정 동기화 분리 → 손가락 이동의 연속성 보존 → **현행·자동 검증 완료, native 확인 대기**. 지도 복구와 하단 연결 시트·플로팅 탭바 결정은 현행으로 유지한다.

```text
U-NEARBY-SHEET-DRAG-01을 수행해. AGENTS.md와 docs/README.md, 이 파일 최신 실행 명령 및 시트 드래그 끊김 진단 인수인계를 읽어. 목적은 손잡이 드래그의 높이 점프를 제거하는 것이다. native의 모든 버벅임 원인이 확인됐다고 가정하지 마.

1. 기존 진단 snapshot을 정상 기대값의 회귀 테스트로 전환하고 제품 수정 전에 실패를 확인한다. 현재 버그 값 610/299를 기대하는 검사를 정상 합격으로 남기지 마. 중간 318 재잡기 dy=-8은326, drag377 중 summary80 변경은 범위 안에서377 유지가 기준이다. 상수는 해당 fixture 조건에 한정하고 다른 화면은 실제 layout으로 계산한다.

2. grant에서 현재 animated height를 확보하고 진행 animation을 중지해 gesture baseline을 기록한다. move는 baseline과 누적 dy로 계산한다. stopAnimation callback 전에 move/release/terminate가 오는 경우도 안전하게 처리한다. 오래된 callback이 새 gesture baseline을 덮지 않게 gesture/run identity를 사용한다. 현재 RN setValue는 animation을 중지하므로 두 animation 동시 실행 문제로 잘못 설명하지 마.

3. active drag 도중 측정값 변경은 최신 min/max와 padding에 반영하되 boolean 끝점으로 reset하지 않는다. 범위 안에서는 현재 높이를 유지하고 범위 밖일 때만 clamp한다. clamp 후 다음 move에서 재점프하지 않도록 baseline/누적 변위 기준도 일관되게 보정한다. 같은 측정 반복은 불필요한 height write를 만들지 않는다. responder 수명과 최신 geometry 참조를 안정화해 active gesture 도중 callback 재생성에 의존하지 않게 한다.

4. release/terminate를 공통 정착 경계로 모은다. release는 현재 높이·이동 방향·속도, terminate는 현재 높이를 바탕으로 유효 끝점에 정착시킨다. 기존 빠른 스와이프/접기·펼치기 버튼 의도를 유지한다. 새 grant, 버튼 연타, 상세 전환, unmount 뒤 stale completion이 상태/map inset을 바꾸지 않게 한다. 지도 inset은 정착 후 갱신하고 드래그 매 프레임 fitBounds하지 않는다.

5. 테스트는 연속 move/역방향, 접힘·펼침 양방향, spring 중 재잡기, grant 직후 release, 측정 변화/동일값/범위 축소, terminate, 버튼 연타, stale callback/unmount를 production-used handler로 검증한다. fake animation은 중간값·취소·완료를 구별한다. 목록 스크롤·마커/상세 전환·탭 터치 회귀도 유지한다. 손잡이 밖 전체 목록 드래그 확장이나 gesture 라이브러리 교체는 이번 범위가 아니다.

6. 수정 범위는 NearbyBrowseScreen, 필요한 UI gesture helper, 관련 UI 테스트다. 지도 HTML 복구, 시트 좌우0/하단0, floating tab frame/터치, 마지막 행·상세 CTA 접근, 3km/거리순/위치 기준을 보존한다. App/nav·엔진/API/DB/catalog/env·native 의존성·중앙 정책은 변경하지 마. 다른 세션 변경을 되돌리지 마.

7. npx tsx --test test/ui/nearby-browse-screen.test.mjs, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, npx expo export --platform ios, git diff --check를 실행한다. 실패를 skip/삭제하거나 타 역할 코드를 고쳐 숨기지 마. 자동 외부 API/GPS/DB 호출·Simulator 수동 순회는 하지 않는다.

8. 이 파일에 변경 파일/보존 계약/수정 전 실패와 수정 후 결과/남은 native 위험을 인계한다. 자동 통과와 실제 드래그 합격은 구분한다. 프레임 문제가 남을 경우에만 다음 QA의 제한 계측으로 연결한다. commit/push는 하지 마.
```

검증 후속: [QA-NEARBY-SHEET-DRAG-01](../qa-release/nearby-sheet-drag-validation.md). UI 구현과 QA는 같은 파일·테스트를 동시에 수정하지 않고 순차 실행한다.

## U-NEARBY-SHEET-DRAG-01 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `src/ui/NearbyBrowseScreen.tsx`: gesture별 run, grant baseline, 현재 높이, 마지막 누적 dy와 pending settle을 ref로 분리했다. grant에서 `stopAnimation()`의 합성 현재 높이를 받아 move 기준으로 사용하고, release/terminate를 공통 정착 경계로 연결했다.
- 같은 화면의 layout 동기화는 active drag 중 boolean 끝점으로 되돌리지 않는다. 현재 높이가 최신 범위 안이면 유지하고, 범위 밖이면 한 번만 clamp한 뒤 `baseline=current+lastDy`로 재기준화한다. PanResponder는 최신 layout ref를 읽는 안정된 callback으로 유지된다.
- `test/ui/nearby-browse-screen.test.mjs`: 기존 결함값 610/299 진단 snapshot을 정상 기대값 326/377로 전환했다. fake `stopAnimation`과 비동기 callback을 추가하고 양방향 재잡기, 연속/역방향 move, grant 직후 release, 측정 동일/변경/범위 clamp, terminate, 버튼 연타·stale completion, 상세/탭/unmount 회귀를 실행한다.

### 2. 유지한 공개 계약·정책 경계

- 지도 HTML·SDK/marker/cluster/재시도는 변경하지 않았다. 지도 `bottomInset`은 drag frame마다 갱신하지 않고 유효한 최신 spring 정착 뒤에만 바뀐다.
- 시트 좌우0/하단0, 상단 모서리, 접힘 첫 행, 실측 탭 가림+12pt, 마지막 장소·상세 CTA 접근성과 플로팅 탭바 위치·크기·색상·터치·목적지는 유지했다.
- 3km 반경·거리순·기준 위치, 목록 카드/상세 문구, 엔진/API/DB/catalog/env/native 의존성, App/nav/중앙 정책은 변경하지 않았다. 다른 세션 변경도 되돌리지 않았다.

### 3. 수정 전 실패와 수정 후 테스트 결과

- 실패 선행: 정상 기대값으로 바꾼 집중 fixture에서 3건 실패했다. production handler에 `onPanResponderGrant`가 없어 318 재잡기→326, 측정 변경 중 377 유지, terminate 정착을 시작할 수 없었다.
- 수정 후 `390×844/safe47·34` fixture에서 펼침 spring 중 318 재잡기+`dy=-8`은 326, 접힘 drag 377 중 summary 58→80 변경은 377을 유지한다. tab frame 변경으로 새 최소값 521이 되면 한 번 clamp하고 다음 `dy=-110`은 531로 연속 이동한다. 접힘/펼침 양방향, `297→317→287` 방향 반전, terminate→277, 비동기 grant 직후 release 단일 정착도 통과했다.
- `npx tsx --test test/ui/nearby-browse-screen.test.mjs`: 18/18 통과. 전체 nearby selector/screen/layout/생성 HTML parse·실행 집중 fixture 48/48 통과.
- `npm run test:typecheck`: 통과. `npm run test:ui`: 426건 중 425 통과, 기존 skip 1, 실패 0. `npm test`: 213/213 통과. `node --test test/map-transport-ui-contract.test.mjs`: 14/14 통과. `git diff --check`: 통과.
- `npx expo export --platform ios`: 1270 modules iOS bundle/export 성공. 자동 외부 API/GPS/DB 호출과 Simulator 순회는 0회다.

### 4. 다음 결정·위험·재현 조건

- 자동 handler fixture는 높이 연속성·취소·stale 차단을 검증하지만 실제 iOS touch 전달률과 JS layout/WebView 합성 프레임률을 대신하지 않는다. 후속 `QA-NEARBY-SHEET-DRAG-01`에서 버튼 펼침과 손잡이 drag를 구분해 native 체감을 확인한다.
- native 확인은 접힘→위 drag→animation 중 재잡기, 펼침→아래 drag→재잡기, drag 중 상세/행 높이 변화, 손가락이 취소되는 제스처 순서로 제한한다. 높이 점프가 사라졌는데 프레임 저하가 남을 때만 문서의 제한 계측 항목으로 연결한다.
- 실제 합격 전까지 “모든 native 버벅임 해결”로 확대 해석하지 않는다. commit/stage/push는 실행하지 않았다.

## 최신 진단 명령 — 시트 드래그 끊김 (수정 전 원인 확인)

상태: **코드 진단 완료·실기기 연결 미확인·제품 수정 전**. 사용자는 손잡이에서도 위로 드래그할 때 끊김을 관찰했다. 단순 터치 영역 확대 작업으로 대체하지 않는다.

통합 사전 재현: 기존 nearby-browse-screen fixture의 production handler를 실행했다. spring 중 현재 높이를318로 주입한 후 dy=-8을 전달하면326이 아닌610으로 이동했다. 다른 fixture는 드래그 높이377에서 list-summary 실측 높이80을 전달하자299로 복귀했다. 이는 합성 중간 높이/실측 이벤트로 확인한 코드 결함이며 실제 기기에서 해당 이벤트가 끊김 순간 발생했다고 증명한 것은 아니다.

```text
U-NEARBY-BROWSE-01의 시트 드래그 끊김을 진단해. 이 문서 최신 진단 절, NearbyBrowseScreen의 settleSheet/PanResponder/layout effect, nearbyBrowseSheetLayout, 기존 screen fixture를 읽어. 이번에는 원인 확인과 회귀 재현·보고만 하고 제품 코드를 수정하지 마. 지도 복구·탭바/시트 확정 배치를 되돌리지 마.

1. 다음 두 반례를 실제 production handler로 재현한다. 첫째 spring 진행 중 현재 height를 중간값으로 주입하고 새 드래그 grant/move를 전달해 현재값+변위와 실제값을 비교한다. 둘째 드래그 도중 header/firstRow/tab frame 측정 갱신을 주입해 높이가 상태 끝점으로 돌아가는지 확인한다. 동일 측정값 반복에서는 문제가 없는지도 대조한다. 숫자는 현재 코드의 실제 layout으로 산출하고 위 사전 수치를 억지로 맞추지 마.

2. animatedSheetHeight의 모든 작성자를 추적해 표로 기록한다: 초기화/layout effect, move, spring, release/terminate. grant에서 현재값 캡처/애니메이션 정지 여부, responder 재생성, terminate 처리, 측정 변경 effect가 drag 상태를 구분하는지 확인한다. RN 실제 Animated.Value.setValue가 진행 animation을 중지하는 동작과 mock의 차이를 확인해 잘못된 '두 animation 동시 실행' 결론을 피한다.

3. 기존 테스트는 PanResponder callback 직접 호출·spring 즉시 완료/수동 완료 mock이므로 터치 전달이나 프레임 성능을 보장하지 않는다. 한 번의 move/release만 통과하는 테스트와 연속 move·방향 반전·중간 재잡기·측정 변경·termination을 구분해 진단 fixture를 추가한다. fake animation은 중간값/취소/완료와 stale completion을 표현한다. 네트워크·GPS·DB0, 제품과 무관한 테스트 수정/skip0.

4. 실제 native 원인은 확인/추정/미확인으로 나눠. 합성 측정값 변경이 실제 드래그에서 매번 발생한다고 단정하지 마. height 변경에 따른 layout 비용, JS thread 지연, responder 취소는 코드만으로 확정하지 않는다. 기존 로그/캡처가 있으면 먼저 활용하고 없으면 필요한 관찰값(grant/move/release/terminate, 현재/시작/목표 높이, 측정 변경 시점)을 인계한다. 제품 진단 로그 삽입이나 Simulator 수동 순회는 이번 권한 밖이다. 필요하면 최소 계측 계획을 제안하고 사용자에게 직접 손잡이 드래그/버튼 펼침 비교의 짧은 녹화만 요청한다.

5. 결과는 (a) 실제 코드로 재현된 원인과 파일/라인, (b) 실기기와 연결되지 않은 가설, (c) 최소 수정 방향 및 보존 계약, (d) 수정 전 실패/후 통과해야 할 테스트로 작성한다. 후보 수정 방향은 grant 시 현재 높이 캡처·기존 animation 취소, drag 중 layout 보정 분리, release/terminate 단일 정착이다. 이 방향을 이번에 바로 구현하지 마.

진단용 테스트를 추가할 경우 알려진 실패는 별도 재현 경로에 격리하고 기존 npm test에 의도적 실패를 섞거나 skip으로 숨기지 않는다. 사용한 명령·입력·expected/actual·로그를 기록한다. 문서 diff check를 실행하고 이번 결과만 같은 작업 문서에 인계해. 제품 코드·중앙 정책·보드·env·commit/push는 변경하지 않는다. 원인 확인 완료와 문제 해결 완료를 구분한다.
```

## 시트 드래그 끊김 진단 인수인계 — 2026-09-05

### 1. 변경 파일과 진단 목적

- `test/ui/nearby-browse-screen.test.mjs`: production `NearbyBrowseScreen`의 실제 PanResponder callback을 실행하는 진단 snapshot 4건을 추가했다. fake animation은 중간 frame 주입, `setValue` 취소, 정상 완료, 취소된 stale 완료를 서로 구분한다. 기존 정상 fixture와 의도적 실패/skip은 추가하지 않았다.
- `docs/work/uiux/nearby-browse.md`: 확인된 코드 결함, 아직 실기기와 연결되지 않은 가설, animated height 작성자, 최소 수정 방향과 수정 전/후 합격값을 기록했다.
- 이번 진단에서는 `src/ui/NearbyBrowseScreen.tsx`, `nearbyBrowseSheetLayout.ts`, 지도·탭바 등 제품 코드를 수정하지 않았다.

### 2. production 코드로 재현된 사실

현재 `390×844`, safe top/bottom `47/34`, fontScale 1, 탭 frame `y=744, height=66` fixture의 접힘/펼침 끝점은 `277/610`이다.

| animated height 작성자 | 확인 결과 |
| --- | --- |
| 초기화 | `Animated.Value(collapsedHeight)`로 277에서 시작한다. 현재 높이를 별도 React state/ref로 보관하지 않는다. |
| geometry effect | 접힘/펼침 끝점이 바뀌면 `sheetExpanded` boolean에 해당하는 끝점을 즉시 `setValue`한다. drag 중인지 구분하지 않는다. |
| PanResponder move | grant 기준 현재 높이가 아니라 `sheetExpanded ? expandedHeight : collapsedHeight`를 매 move의 시작점으로 쓰고 누적 `gesture.dy`를 뺀다. `grant` handler와 animation 정지가 없다. |
| spring | toggle/detail/release가 같은 `Animated.Value`에 spring을 시작한다. 완료 run ID는 오래된 map inset 반영만 차단하며 drag 시작 높이를 제공하지 않는다. |
| release | velocity/dy로 끝점을 정해 spring을 시작한다. |
| terminate | handler가 없어 native responder 취소 시 중간 높이를 어느 끝점에도 정착시키지 않는다. |

- **확인된 결함 A — animation 중 재드래그 점프:** 펼침 spring 중 합성 현재 높이를 318로 주입하고 새 gesture의 `dy=-8`을 production move handler에 전달했다. 기대는 `318-(-8)=326`, 실제는 expanded 끝점 기준 clamp인 `610`이었다. move의 `setValue(610)`는 spring과 병렬 실행되는 것이 아니라 기존 spring을 취소하는 것으로 fixture에서 구분했다.
- **확인된 결함 B — drag 중 실측 변경 reset:** 접힘 상태에서 누적 `dy=-100`으로 높이 377을 만든 뒤 list-summary 실측을 58→80으로 갱신했다. 새 접힘 끝점 299가 geometry effect에서 즉시 기록되어 실제 높이가 `377→299`로 돌아갔다. 같은 80 측정을 반복하면 React state가 변하지 않아 377을 유지했다.
- **확인된 결함 C — responder 수명:** endpoint 변경은 `useMemo` 의존성을 바꾸므로 active gesture 중 PanResponder callback 객체도 교체된다. `onPanResponderTerminate`가 없다는 사실도 확인했다. 다만 callback 교체가 iOS에서 현재 responder를 실제로 끊는지는 이 코드 fixture만으로 증명하지 않았다.
- **정상 대조:** 한 grant 구간을 가정한 누적 move `dy=-20→-40→-10`은 `297→317→287`로 연속 이동·방향 반전을 올바르게 계산했다. 즉 단일 gesture의 누적 dy 계산 자체가 주 원인은 아니다.
- React Native 공식 `Animated.Value` 계약상 `setValue()`는 해당 값에서 실행 중인 animation을 중지한다. 따라서 실제 RN을 “spring과 drag가 동시에 값을 쓴다”로 해석하지 않는다: https://reactnative.dev/docs/animatedvalue

### 3. 실기기 원인과의 연결 상태

- **확인:** 위 두 입력을 production handler에 주면 숫자 점프가 발생한다. 재드래그 시 spring 취소와 endpoint 점프가 함께 발생할 수 있는 코드 경로가 존재한다.
- **추정:** 사용자가 관찰한 손잡이 끊김이 빠른 재잡기 직전에 남은 spring 때문일 가능성, 또는 drag 중 첫 행/요약/탭 frame의 실측 변경 때문일 가능성이 있다.
- **미확인:** 실제 끊김 frame에 measurement 변경이나 responder terminate가 발생했는지, height 기반 JS layout과 WebView 합성 비용 또는 JS thread 지연으로 move event가 누락됐는지는 native event/frame 로그가 없어 확정할 수 없다. 현재 fixture는 터치 전달률과 프레임 성능을 보장하지 않는다.
- 최소 계측이 허용되는 다음 진단에서는 비밀 없는 값만 기록한다: `grant/move/release/terminate`, animation 상태, current/grant/target height, `dy/vy`, handle/summary/first-row/tab 측정 변경 시점. 제품 로그 삽입과 Simulator 순회는 이번에 실행하지 않았다.

### 4. 최소 수정 방향·보존 계약·후속 테스트

- 후보 수정은 grant에서 기존 animation을 `stopAnimation(callback)`으로 중지하고 callback의 현재 합성 높이를 drag baseline ref에 저장하는 것이다. move는 `baseline-dy`만 사용한다.
- drag 중 geometry 변경은 새 min/max와 padding을 계산하되 height를 상태 끝점으로 즉시 덮어쓰지 않는다. 현재값이 새 범위 밖일 때만 clamp하고, 정착 보정은 release/terminate의 단일 경로에서 수행한다.
- release와 terminate는 현재 높이·velocity로 접힘/펼침 한 곳에 한 번만 정착하고 stale spring completion은 지도 inset이나 상태를 바꾸지 않아야 한다.
- 수정 후 필수 합격값: 중간 318 재잡기+`dy=-8`은 326, drag 377 중 summary 80 변경은 377 유지(새 범위 밖이면 가장 가까운 경계로만 clamp), 동일 측정 반복 write 0, 방향 반전 연속성 유지, terminate 후 transient height 0, stale completion state/map write 0이다.
- 시트 좌우/하단 연결, 탭 frame/터치, 마지막 행·상세 CTA 접근, 지도 복구 및 정착 후 inset, 3km 거리순·위치 기준 계약은 수정 이후에도 보존해야 한다.

실행 결과: `npx tsx --test test/ui/nearby-browse-screen.test.mjs` 13/13 통과(그중 진단 snapshot 4건). `npm run test:ui` 421건 중 420 통과·기존 skip 1·실패 0, `npm test` 208/208 통과. 네트워크·GPS·DB·Simulator·제품 진단 로그·commit/push는 0이다. 상태는 **코드 원인 재현 완료 / 실기기 원인 연결과 제품 수정은 미완료**다.

## 최신 확정: 하단 연결 시트·플로팅 탭바 보존

상태: **지도 표시 사용자 확인 완료 / 시트 배치·열림 성능 보완 완료·native 확인 대기**. 이번 절은 이전 시트/탭바 배치 미확정 상태를 대체한다. 기존 지도 HTML 수정과 파싱·실행 회귀는 보존한다.

이전 좌우10pt·하단 `safeBottom+72`의 떠 있는 둥근 시트 → 접힘에서는 탭바가 카드를 가리고 펼침에서는 지도 틈이 드러나는 불일치 → 시트 좌우/하단을 화면에 연결하고 상단 모서리만 둥글게, 기존 플로팅 탭바는 위에 유지 → 겹침이 아닌 콘텐츠 가림을 해소하고 탭바 일관성 유지 → **현행·보완 완료, native 확인 대기**. 탭바 자체를 일반 고정 바 형태로 바꾸거나 숨기는 대안은 채택하지 않는다.

```text
U-NEARBY-BROWSE-01의 하단 시트 배치 보완을 진행해. 이 문서 최신 확정 절과 기존 기능 계약을 읽어. 지도 복구는 사용자가 확인했으므로 기존 HTML 파싱/실행 수정은 되돌리지 마. 아래 배치만 변경한다.

1. NearbyBrowseScreen의 시트를 좌우0·하단0에 연결한다. 배경은 화면 아래 끝까지 이어지고 위쪽 모서리만 둥글게 한다. 접힘/펼침 모두 아래쪽 연결을 유지하고 위쪽 경계만 움직인다. 현재 max-height sheet 전체를 translateY하는 방식과 bottom safe+72가 실제 보이는 viewport/스크롤 끝에 미치는 영향을 먼저 확인해. 화면 밖으로 이동한 전체 높이를 스크롤 viewport로 오인하지 않도록 visible height와 scroll layout을 일치시키는 구조로 고친다. 임시 배경 덧칠만으로 가리지 마.

2. FloatingTabBar의 위치·크기·모양·색상·다른 탭 동작은 그대로다. 시트 위에 떠서 접힘/펼침/상세 모든 상태에서 보이고 누를 수 있어야 한다. stacking/elevation/pointerEvents를 확인하고 투명한 wrapper가 지도/탭 터치를 가로채지 않게 한다. 탭바 실제 frame을 부모 좌표계에서 측정해 가림 영역을 구한다. 측정용 optional callback만 필요한 경우 추가하되 다른 화면의 시각/행동은 불변이다. 하드코딩72pt를 가림 높이의 단일 근거로 쓰지 않는다.

3. 접힌 상태는 핸들·제목/장소수·첫 장소 한 행이 탭바 위에 온전히 보이도록 구성한다. 확장 최대 높이는 safe area/상단 컨트롤과 실제 화면 가용 높이로 제한한다. 큰 글씨/작은 화면에서 다 들어가지 않으면 글자나 터치를 축소하지 않고 접근 가능한 확장/스크롤로 처리한다. 일반 화면에서 두 번째 카드가 탭바에 잘려 보이는 것을 기본 미리보기로 삼지 마.

4. 목록/상세 ScrollView 양쪽에 실제 탭바 가림 높이+적절한 간격의 끝 여백을 계산한다. safe-bottom을 중복 더하지 마. 끝까지 스크롤했을 때 마지막 장소 전체와 상세 카카오맵 확인 버튼의 터치 rect가 탭바 상단보다 위로 올라오는 것이 합격 기준이다. 단순 padding 존재 검사는 충분하지 않다. 탭바 뒤 콘텐츠가 스크롤되는 것은 허용하되 중요한 행동은 접근 가능해야 한다. 상세로 전환해도 별도 floating panel을 만들지 않고 같은 시트를 사용한다.

5. 지도의 bottomInset은 translate 전 sheet 전체 높이가 아니라 실제 보이는 가림 영역을 반영한다. 선택 마커가 시트/헤더 뒤로 숨지 않게 하되 드래그 매 프레임마다 fitBounds를 반복하거나 장소 거리순/기준 위치를 바꾸지 않는다. 목록 스크롤과 핸들 드래그 충돌, 접기/펼치기 버튼, 상세 닫기 복원과 tab 즉시 전환을 보존한다. 이번에는 목록 카드 디자인/사진/데이터/반경/정렬/키보드/위치 검색을 추가 재설계하지 마.

실패 선행 fixture: 현재 시트 좌우/하단 틈과 상수 offset, 접힘 실제 viewport와 마지막 행/상세 CTA 가림을 재현한다. 보완 후 작은/큰 화면·safe inset0/34·fontScale1/큰 글씨·접힘/펼침/상세·행0/1/다수 조합을 production-used layout/실제 handler로 실행한다. background 하단 연결, tab rect 불변/터치, last item/CTA 접근, 가림 inset, 드래그/목록/탭 전환을 확인한다. mock rect/style는 Yoga/native 캡처가 아님을 명시한다.

소유 범위 NearbyBrowseScreen·필요 UI layout helper·UI 테스트, 필요한 FloatingTabBar 측정 prop만이다. App/nav/다른 화면 시각·엔진/API/DB/catalog/env·native 의존성은 변경하지 않는다. 집중 nearby 및 HTML script 실행 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check, iOS export를 실행해. 자동 외부 호출/Simulator 순회0. 실패를 skip/삭제하지 마.

완료 인계는 변경 파일/유지 계약/실패 선행·최종 수치·로그/남은 native 확인을 같은 문서에 기록한다. 사용자는 접힘·펼침·상세 각 상태에서 탭바 유지와 시트 하단 연결, 마지막 행/카카오 버튼 접근, 지도 마커 선택/탭 전환만 짧게 확인한다. 중앙 문서·보드·타 역할 코드 변경과 커밋은 하지 마.
```

## 하단 연결 시트·플로팅 탭바 보존 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `src/ui/NearbyBrowseScreen.tsx`: 좌우/하단 offset과 max-height 전체 translate를 제거하고, 하단 0에 연결된 시트의 실제 `height`를 접힘/펼침 값으로 애니메이션한다. 핸들·목록 요약·첫 행을 실측해 접힘 미리보기를 만들고 목록/상세 scroll viewport를 실제 시트 높이와 일치시켰다. 지도에는 정착된 접힘/펼침 높이만 bottom inset으로 전달한다.
- `src/ui/nearbyBrowseSheetLayout.ts`: safe top, 화면 높이, font scale, 행 수, 실측 탭 frame과 시트 내부 실측값으로 접힘/펼침 높이·탭 가림·끝 여백을 계산하는 production-used 순수 경계를 추가했다.
- `src/ui/FloatingTabBar.tsx`: 위치·크기·모양·색상·행동은 바꾸지 않고 기존 absolute wrapper의 parent-coordinate `onLayout` frame을 전달하는 optional callback만 추가했다.
- `test/ui/nearby-browse-sheet-layout.test.ts`, `test/ui/nearby-browse-screen.test.mjs`: 작은/큰 화면, safe bottom 0/34, font scale 1/1.8, 행 0/1/다수, 접힘/펼침/상세와 실제 화면 handler·탭 frame 전달 계약을 검증한다.

### 2. 유지한 공개 계약·정책 경계

- 복구된 `NearbyBrowseMap`의 최종 HTML 파싱/실행, SDK 단계별 오류, 사진/기본/cluster marker, 지도 재시도와 현재 dataset ID bridge는 변경하지 않았다.
- 플로팅 탭바의 `left/right 16`, `bottom=max(safeBottom,18)`, 4개 탭 크기·색상·label·목적지와 즉시 전환 handler는 유지했다. 시트 elevation만 탭바보다 낮춰 탭 터치를 보존했다.
- 3km 반경·거리순·기준 위치·목록 카드/사진/상세 문구, 추천/route/API/DB/catalog/env/native 의존성은 변경하지 않았다. 지도 fit은 드래그 중 매 프레임 실행하지 않고 접힘/펼침 상태 변화에만 연결된다.
- `App.tsx`, nav, 다른 화면과 중앙 문서·보드는 수정하지 않았고 기존 다른 세션 변경도 되돌리지 않았다. commit/stage/push와 실제 API·Simulator 순회는 실행하지 않았다.

### 3. 실패 선행·최종 수치·테스트 결과

- 실패 선행: production 화면 fixture에서 시트 하단이 `safeBottom 34 + 72 = 106pt`, 좌우 10pt이며 translate 뒤에도 scroll layout은 max height를 유지하는 상태를 재현했다. `FloatingTabBar` frame callback과 production layout module 부재도 각각 실패했다.
- 최종 계산 fixture: `568pt/safe0/font1`은 탭 가림 84, 접힘 261, 펼침 468pt; `568pt/safe34/font1.8`은 가림 100, 접힘 330, 펼침 441pt; `932pt/safe0/font1`은 84/261/610pt; `932pt/safe34/font1.8`은 100/330/610pt다. 목록/상세 끝 여백은 실측 가림+12pt이며, 최대 scroll에서 마지막 장소 또는 카카오 CTA의 하단은 탭 상단보다 12pt 위다. 접힘의 탭 위 영역은 핸들+요약+첫 행까지만 포함한다.
- 집중 nearby layout/screen fixture 22/22, 전체 nearby selector/screen/생성 HTML parse·실행 fixture 38/38 통과. 복구 지도 script parse, fake SDK 실행, marker/cluster/재시도도 그대로 통과했다.
- `npm run test:typecheck`: 통과. `npm run test:ui`: 416건 중 415 통과, 기존 skip 1, 실패 0. `npm test`: 203/203 통과. `node --test test/map-transport-ui-contract.test.mjs`: 14/14 통과. `git diff --check`: 통과.
- `npx expo export --platform ios`: 1270 modules iOS bundle/export 성공. 외부 SDK/API 호출은 0회다.

### 4. 다음 결정·위험·재현 조건

- 자동 layout fixture의 rect는 주입한 native 측정값으로 production 계산/handler를 실행하지만 Yoga 또는 실기기 캡처 자체는 아니다. `QA-NEARBY-SHEET-01`에서 작은 화면과 큰 글씨 각각 주변 탭 → 접힘 첫 행 → 펼침 마지막 장소 → 상세 마지막 카카오 버튼 → 메인/기록 탭 즉시 전환을 확인한다.
- native 확인 합격값은 접힘/펼침/상세에서 시트 배경 좌우·하단 틈 0, 탭바 frame/터치 불변, 마지막 행/CTA touch rect가 탭 상단보다 최소 12pt 위, 펼침 상단이 header/safe area 아래인 것이다.
- 실제 글꼴/현지화로 핸들·요약·첫 행 높이가 달라져도 `onLayout` 실측 후 재계산한다. 첫 native layout 전에는 기존 탭 구조에서 산출한 66pt bar 높이와 safe bottom을 보수적 fallback으로 쓰며, 이후 72pt 상수가 아니라 실측 parent-coordinate frame이 단일 기준이다.

## 시트 열림 버벅임 반환 보완 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `src/ui/NearbyBrowseScreen.tsx`: 펼침 state 변경 직후 geometry effect가 진행 중인 spring 값을 최종 높이로 덮어쓰던 동기화를 분리했다. geometry가 실제로 변할 때만 높이를 직접 맞추고, 열기/닫기에서는 spring이 끝까지 진행한다.
- 같은 화면에서 지도 `bottomInset` 갱신을 spring 완료 callback 뒤로 이동했다. 빠른 연속 동작에서는 run ID가 최신 animation의 완료만 수락하며, height animation을 non-interaction 작업으로 지정했다.
- `test/ui/nearby-browse-screen.test.mjs`: 완료를 지연할 수 있는 animation fixture로 spring 진행 중 강제 `setValue`와 지도 조기 refit을 검출한다.

### 2. 유지한 공개 계약·정책 경계

- 시트 좌우/하단 연결, 접힘/펼침 높이, 탭 실측 가림+12pt, 목록/상세 접근성과 플로팅 탭바 frame·디자인·행동은 변경하지 않았다.
- 복구된 지도 HTML/marker/cluster/재시도와 3km 데이터·거리순·기준 위치 계약은 변경하지 않았다. 지도 inset 값 자체도 동일하며 적용 시점만 실제 animation 정착 뒤로 옮겼다.
- 엔진/API/DB/catalog/env/native 의존성, App/nav/다른 화면과 중앙 문서는 수정하지 않았다. 실제 API·Simulator, commit/stage/push는 실행하지 않았다.

### 3. 실패 선행·테스트 결과

- 실패 선행 fixture에서 펼침 spring을 완료하지 않은 상태인데도 `Animated.Value.setValue` 호출 수가 2→3으로 증가해 animation이 끊기는 현상을 재현했다. 같은 시점에 지도 inset도 펼침 값으로 먼저 바뀌어 WebView viewport 작업이 겹치는 계약 위반을 함께 고정했다.
- 보완 후 pending spring 동안 추가 `setValue` 0회, 지도 inset 변경 0회이며 완료 callback 뒤에만 두 값이 정착된다. 집중 nearby layout/screen fixture 23/23 통과.
- `npm run test:typecheck`: 통과. `npm run test:ui`: 417건 중 416 통과, 기존 skip 1, 실패 0. `npm test`: 204/204 통과. 지도 계약 14/14 및 `git diff --check` 통과.
- `npx expo export --platform ios`: 1270 modules iOS bundle/export 성공. 외부 API/SDK 자동 호출은 0회다.

### 4. 다음 결정·위험·재현 조건

- 자동 fixture는 animation/state 순서와 중복 지도 작업 제거를 보장하지만 실제 WebView 합성 프레임률은 측정하지 않는다. 기존 `QA-NEARBY-SHEET-01`에 접기↔펼치기 3회, 마커 선택으로 상세 열기, animation 중 탭 터치를 추가해 native 체감과 끊김 여부를 확인한다.
- height는 실제 scroll viewport를 animation과 일치시키기 위해 JS layout animation을 유지한다. 이번 원인 제거 후에도 특정 저사양 기기에서 프레임 저하가 남으면 native 성능 측정 근거를 수집한 뒤, 시트 연결·실제 viewport 계약을 깨지 않는 animation 구조를 별도 결정해야 한다.

## 지도 미표시 반환 보완 — 최우선 실행 명령

상태: **지도 보완 완료·사용자 확인 완료**. 이전 구현 완료/fixture 통과는 실제 생성 HTML의 실행 가능성을 증명하지 않았다. 당시 지도 문제를 먼저 해결했고 시트/탭바 배치는 미확정이었으나, 현재는 문서 최상단의 하단 연결 시트 확정이 이를 대체한다.

### 확정 원인과 추가 결함

통합 세션이 NearbyBrowseMap.tsx를 TypeScript transpile 후 fake key/center로 buildNearbyBrowseMapDocument를 실행하고, 반환 HTML의 inline script를 node:vm.Script로 파싱했다. 네트워크 없이 `Unexpected end of input` 재현. 템플릿 문자열의 escape가 소비되어 정규식이 `/^https:///`로 생성되고 inline onerror의 `'fallback'`이 JS 문자열을 깨뜨린다. 이 파싱 실패는 init 실행 전 발생하므로 지도 초기화/ready bridge가 실행되지 않는다. 키/도메인/네트워크 이상을 원인으로 단정하지 않는다.

동일 onerror는 this.remove() 뒤 this.parentNode를 사용하여 부모가 null이 되는 별도 잠재 오류도 있다. 문법만 통과시키고 이미지 실패 fallback을 놓치지 않는다.

### 복사할 보완 명령

```text
U-NEARBY-BROWSE-01의 지도 미표시 보완을 진행해. docs/work/uiux/nearby-browse.md 상단의 확정 원인과 이 명령을 우선 읽어. 이번 범위는 NearbyBrowseMap의 HTML/스크립트 실행 및 지도 초기화·사진 fallback 회귀다. 시트/탭바 배치, 주변 탐색 정책, 키/env/도메인 등록, 엔진/API/DB는 바꾸지 마.

1. 수정 전에 실제 production buildNearbyBrowseMapDocument(fake center/key)의 반환 HTML에서 inline script를 추출해 node:vm.Script 또는 동등한 JS parser로 컴파일하는 실패 테스트를 추가한다. 외부 SDK를 다운로드하지 않는다. 원본 TS가 아니라 WebView가 받는 최종 문자열을 검증해야 한다. Unexpected end of input 및 생성 정규식/따옴표 문제를 기록한다. 비밀키를 로그나 fixture에 넣지 마.

2. 중첩 문자열 escape로 문법이 깨지는 경계를 고쳐. 사진 URL 판별·marker 생성·이벤트 연결을 읽기 쉬운 구조로 정리하고 필요하면 DOM API/addEventListener를 사용해 inline onerror 문자열 중첩을 제거한다. escape를 무작정 전체 치환하지 마. 이미지 오류는 제거 전에 부모를 확보하거나 안전한 이벤트 closure로 기본 핀을 적용한다. 반복 이미지 요청/실패 loop0, 기본 핀 선택 동작 유지. 장소명/ID/이미지 주소의 따옴표·역슬래시·개행·HTML 특수문자로 스크립트/DOM 주입이 발생하지 않게 기존 payload 직렬화와 표시 escaping을 검증한다.

3. 문법 통과 이후 fake kakao.maps/DOM/ReactNativeWebView bridge로 실제 생성 스크립트를 실행한다. SDK load callback→Map 생성1회→ready message→renderNearby payload 주입→기본/사진/cluster 마커 생성과 선택 메시지를 검증한다. 실행 중 오류가 추가로 나오면 이 경계에서 원인을 확인하고 보완한다. script 문자열에 init이 있다는 검사만으로 완료하지 않는다. 실제 SDK와 native 로딩 성공은 이 mock 결과와 구분한다.

4. SDK script load 실패/초기화 예외는 안전한 error bridge 및 기존 목록 fallback/명시 재시도로 연결한다. 정상 ready 이후 stale timeout이 오류로 덮어쓰지 않고 retry document가 실제 재초기화되는지 확인한다. 키 누락·SDK 실패·문법/런타임 오류를 모두 네트워크 실패라고 뭉뚱그리지 말고 개발 테스트에서 단계 구분 가능한 근거를 남겨. 키·전체 HTML·좌표/개인정보를 진단 로그에 출력하지 않는다. 일반 사용자에게는 기술 상세 대신 기존 재시도 안내를 유지한다.

5. 집중 테스트에 다음을 포함한다: 최종 HTML script parse, 기본 marker/정상 사진/실패 사진 fallback, 특수문자 label/ID, ready/error 및 재시도, current dataset ID 검증, cluster/동일좌표 묶음 목록, 기존 위치 기준/거리순 목록 불변. 기존 테스트를 삭제하거나 skip하지 마. 타입/JSX 빌드 성공과 HTML 런타임 성공은 별도 게이트다.

소유 범위는 NearbyBrowseMap 및 필요 UI 전용 HTML builder와 UI 테스트다. 기존 KakaoRouteMap/코스 geometry는 변경하지 않는다. 임의 키 교체·새 SDK/provider·새 native 의존성·앱 삭제·Metro 초기화로 해결을 시도하지 마. 지도 표시 이후 별도 키/도메인/네트워크 오류가 확인되면 그 응답/단계의 비민감 근거를 인계한다.

집중 nearby 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check 및 iOS export를 실행해. 자동 검증은 외부 API/SDK 네트워크0, Simulator 버튼 순회0. 이후 사용자에게 주변 탭 진입→지도 타일/사진 또는 기본 마커→마커 선택→지도 재시도(필요 시)의 제한 확인을 요청한다. 지도 문제를 해결하기 전에 시트/탭바를 재설계하지 않는다.

완료 인계는 변경 파일/목적, 유지 계약, 실패 선행과 최종 parse·실행 fixture/회귀 수치·로그, 사용자 native 지도 확인 대기로 기록한다. 자동 fixture만으로 실제 지도 정상이라고 선언하지 마. 중앙 문서·보드·타 역할 파일을 수정하거나 커밋하지 않는다.
```

이력: TS/화면 mock 중심 테스트 통과 → 최종 HTML escape 손실을 검사하지 못해 지도 init 전 파싱 실패 → production 생성 script 파싱+실행 fixture 추가 → DOM API marker와 typed 초기화 실패 경계로 교체 → **현행·보완 완료, native 재확인 대기**. 탭바 겹침 개선은 별도 결정 대기로 유지한다.

## 지도 미표시 반환 보완 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `src/ui/NearbyBrowseMap.tsx`: 최종 HTML을 `String.raw`로 생성해 정규식 escape 손실을 막고, 사진/기본/선택/cluster marker를 HTML 문자열 대신 DOM API로 생성한다. 사진 실패는 `{ once: true }` listener에서 기본 핀으로 한 번만 전환한다. SDK load/global/초기화/runtime 및 native navigation/HTTP/timeout은 비밀 없는 enum으로만 구분한다.
- `src/ui/nearbyBrowseModel.ts`: map error bridge에서 허용된 단계 enum만 통과시키고 임의 raw reason은 버리도록 보완했다.
- `test/ui/nearby-browse-map-document.test.mjs`: production builder가 반환한 실제 inline script의 parse와 fake Kakao SDK/DOM 실행 fixture를 추가했다.
- `test/ui/nearby-browse.test.ts`: typed error message와 허용되지 않은 raw reason 차단을 추가했다. `NearbyBrowseScreen`, sheet, `FloatingTabBar` 및 탭 배치는 이번 보완에서 수정하지 않았다.

### 2. 유지한 공개 계약·정책 경계

- 3km selector, 거리순 목록, 기준 위치, cluster/동일좌표 접근, 단일 sheet, 탭 목적지와 기존 추천·코스·저장 계약은 변경하지 않았다.
- 기존 `KakaoRouteMap`, 엔진, 외부 API adapter, DB, env 키, 도메인/native 설정과 dependency는 수정하지 않았다. 실제 SDK를 다운로드하거나 실제 API/GPS를 호출하지 않았다.
- 일반 사용자에게는 기존 지도 재시도 안내만 유지한다. 개발 진단도 `sdk_load | sdk_unavailable | sdk_init | runtime | navigation | http | timeout` enum만 남기며 키·전체 HTML·좌표·raw 오류는 출력하지 않는다.

### 3. 실패 선행·최종 테스트 결과

- 실패 선행: fake key/center로 production `buildNearbyBrowseMapDocument()`를 실행하고 최종 inline script를 `node:vm.Script`로 컴파일했을 때 `Unexpected end of input`을 재현했다. 생성 문자열에서 사진 URL 정규식 escape와 inline `onerror` 따옴표가 손상된 상태였다.
- 지도 문서 집중 실행 fixture: 9/9 통과. 최종 script parse, SDK load callback, Map 생성 1회, ready bridge, 기본/사진 marker, 사진 실패 fallback·재요청 0, 특수문자 장소명/ID/이미지 URL, 동일좌표 cluster 전수 ID, 단계별 error, retry 재초기화, ready 뒤 stale timeout 0을 확인했다.
- 기존 nearby 집중 fixture: 11/11 통과. 현재 dataset ID bridge, 위치 기준/거리순 목록, cluster/상세/지도 실패 fallback 계약을 유지했다.
- `npm run test:typecheck`: 통과. `npm run test:ui`: 398건 중 397 통과, 기존 skip 1, 실패 0. `npm test`: 199/199 통과. `node --test test/map-transport-ui-contract.test.mjs`: 14/14 통과. `git diff --check`: 통과.
- `npx expo export --platform ios`: 1269 modules iOS bundle/export 성공. 테스트 로그에는 fixture key 값이나 생성 전체 HTML을 출력하지 않았다.

### 4. 다음 결정·위험·재현 조건

- 자동 fixture는 WebView에 전달되는 script의 문법과 fake SDK 실행을 보장하지만 실제 Kakao SDK/타일 응답, 등록 도메인, native WebView 네트워크 성공을 대신하지 않는다.
- 사용자 확인은 `QA-NEARBY-MAP-RETURN-01`: 새 build에서 주변 탭 진입 → 지도 타일 → 사진 또는 기본 마커 → 마커 선택 → 필요 시 지도 재시도 순서로 제한한다. 실패하면 일반 안내와 함께 개발 진단의 enum 단계만 전달하고 키·URL query·좌표·raw WebView 오류는 수집하지 않는다.
- 이 완료 당시 시트·탭바 배치는 지도 문제와 분리된 미확정 결정이었다. 이후 확정된 배치는 문서 최상단의 `최신 확정: 하단 연결 시트·플로팅 탭바 보존`과 해당 완료 인수인계를 따른다.

상태: **사용자 UX 확정·구현 가능**. 부모 결정 DEC-NEARBY-BROWSE-01. 신규 요구 UX-34, 기존 내 코스 최상위 탭 대체. 사용자 약속 시간/코스 추천과 독립된 장소 정보 탐색이다.

## 현행 결정과 완료 화면

- `내 코스` 최상위 탭을 `주변 둘러보기`로 전환한다. 메인·주변 둘러보기·기록·내정보는 좌우 push 없이 즉시 전환한다. 저장 데이터·legacy 경로를 무차별 삭제하지 않는다.
- 전체 지도에 기준 위치에서 직선거리 3km 이내 장소를 표시하고 하단에는 펼칠 수 있는 거리순 목록을 둔다. 동일 거리 tie는 안정적인 place ID로 결정한다. 사진 없음/카테고리로 순위를 변경하지 않는다.
- 지도 pan/zoom은 탐색 기준 위치와 목록 순서를 변경하지 않는다. GPS는 진입/명시 현위치 행동에 기존 foreground 정책으로 확보하며 연속 추적하지 않는다. 수동 위치 선택 fallback을 제공하고 그 경우 `선택 위치 기준`으로 명시한다. 기준 위치를 실제 변경했을 때만 거리/대상을 재계산한다. 부산 중심 fallback을 사용자 현위치로 가장하지 않는다.
- 사진 있으면 작은 썸네일 마커, 없거나 로딩 실패면 기본 마커. 선택 마커만 테두리/크기·장소명으로 강조한다. 겹치는 마커는 개수 cluster로 묶고 tap하면 해당 범위로 확대한다. 같은 좌표 등 최대 확대에서도 분리 불가능하면 그 묶음 목록을 보여주어 모두 접근 가능하게 한다.
- cluster는 표시 방식일 뿐 장소를 탈락시키는 필터가 아니다. 목록은 3km 전체 적격 장소를 거리순으로 탐색 가능해야 한다. 가상화/점진 렌더는 가능하나 기존 추천 3개 제한을 가져오지 않는다.
- 마커 tap은 하단 floating sheet 상세와 연결한다. 목록 tap도 동일 마커/상세를 선택한다. 사진·장소명·카테고리·주소·직선거리·근거 있는 설명/운영시간을 제공한다. 닫으면 기존 목록/지도 상태를 유지한다. 단일 sheet의 목록↔상세 상태로 구현하고 중복 sheet를 쌓지 않는다.
- 인기/방문자 데이터가 없으므로 인기·많이 찾는 곳·평점·혼잡도를 생성하지 않는다. 경로 시간/체류/도착 보장/코스 담기/선택하기/진행 시작은 없다. 카카오맵 장소 확인은 기존 place opener를 재사용하고 route 계산/체류 표본/완료 기록을 생성하지 않는다.

## 데이터·범위 경계

이번 구현은 기존 공개 런타임 카탈로그의 장소 ID·좌표·분류·사진·설명·운영시간 snapshot을 소비한다. 유효 좌표/ID가 없거나 hold/중복·검토 제외 장소는 노출하지 않는다. representative_core/standard와 conditional_more는 **정보 탐색 자격**으로 분리해 읽고, conditional_more를 검증 추천으로 승격하지 않는다. 운영시간 없으면 `운영시간 확인 필요`, 날짜/예외 포함 현재 영업을 판단할 근거가 없으면 `영업 중`을 만들지 않는다. 기존 구조화 시간 정보는 출처대로 표시하며 닫힌 곳도 영업 상태를 숨긴 채 방문 가능하다고 표시하지 않는다.

기존 추천 Results의 조건부 시장 실제10~18 gate는 그대로다. 이 신규 탭은 영업/시간 보장 없는 장소 정보 탐색이므로 해당 추천 노출 gate를 이유로 정보를 자동 코스에 합류시키거나 recommendation API를 실행하지 않는다. 입력시간 없이도 정보 확인 가능하다는 분리 계약이다. 카탈로그 확대/설명 생성/운영시간 추정/새 외부 검색은 이번 작업에 포함하지 않는다. 실제 카탈로그 필드로 자격을 결정할 수 없으면 해당 필드와 영향 수를 인계하고 추측으로 포함하지 않는다.

## 현재 코드 위험

App.tsx/nav.ts/mainTabNavigation.ts의 MyCourses와 각 화면의 탭 버튼/legacy 복귀 경로가 연결되어 있다. visible 탭만 바꾸되 내부 legacy 목적지를 근거 없이 신규 화면으로 치환하지 않는다. App/nav는 이번 UIUX 단일 작성자에게 최소 변경을 허용한다.

PlaceDetailScreen은 course/firstCourse/session 및 selection handoff를 필수로 사용한다. 주변 탐색에 가짜 VerifiedCourse/추천 session을 만들어 넘기지 않는다. 순수 표시 model·sheet/marker 부분을 공유하거나 별도 browse 상세 표시를 구현한다. 기존 추천 상세의 명시 선택과 pair flow는 회귀로 보존한다. KakaoRouteMap도 route geometry/viewport 정책과 연결되어 있으므로 browse 전용 표시 모드 또는 독립 map view의 경계를 먼저 정하고 route map 동작을 전역 변경하지 않는다.

## 복사할 작업 명령

```text
U-NEARBY-BROWSE-01을 진행해. AGENTS.md, docs/README.md, docs/work/uiux/README.md, 이 문서와 중앙 UX-34/DEC-NEARBY-BROWSE-01을 읽어. 구현 전에 실제 카탈로그 필드·기존 지도 marker/bridge·탭 진입·상세 모델 의존성을 확인하고 재사용/분리할 파일을 짧게 기록해. 과거 내 코스 전체 삭제나 추천 결과 상세에 가짜 코스를 넣는 방식은 금지한다.

먼저 pure browse selector(center,catalog,radius=3000)와 안정적인 ID/거리 정렬, 선택 ID, viewport와 별도 기준 위치 상태를 분리해 production-used fixture를 작성한다. 반경은 ≤3000m 포함, 계산 원값으로 판정하고 표시 반올림과 분리한다. 지도와 목록은 동일 적격 dataset/ID를 사용한다. location은 fake port로 주입하고 늦은 GPS/수동 위치 역전·화면 이탈 응답을 차단한다. 정보 조회에 recommendation engine/route/API/DB 쓰기를 실행하지 마.

거리순 목록+full map+단일 draggable sheet를 구현한다. 지도 선택↔목록 선택 identity를 일치시키고 sheet 실측 높이로 선택 마커 가림을 방지한다. 사진 마커 로딩 실패는 기본 핀으로 내려가며 빈 사진 재시도 loop를 만들지 않는다. 많은 사진은 lazy/reuse하고 pan마다 모든 마커/이미지를 재생성하지 마. 겹침 cluster는 viewport/zoom에 따라 계산하며 반경 3km 적격 목록을 축소하지 않는다. cluster 해제/동일좌표 묶음/빠른 선택 중 stale 이미지·상세가 다른 장소에 붙지 않게 한다. WebView 메시지는 허용 action과 현재 dataset ID만 받아 검증하고 외부 문자열 삽입은 안전하게 직렬화한다.

현위치 권한 거절/미결정/GPS 실패는 기존 위치 선택 UX를 재사용한 수동 기준 위치 대안을 제공한다. 이번 탭에서 위치 prompt는 명시 현위치 행동에서만 요청한다. 이미 허용되면 foreground 1회 초기화 가능하다. 지도 실패에도 거리순 목록/상세 텍스트와 명시 재시도를 유지한다. 장소0이면 반경 안 등록 장소가 없음을 안내하고 위치 변경을 제공한다. 범위를 자동 확대하거나 부산 중심 결과를 내 주변으로 표시하지 마.

카카오맵 장소 확인은 기존 안전한 opener, 실패 시 상세 유지. 상세에는 코스에 담기/선택하기/길찾기 시작으로 체류 측정 등 추천 흐름 행동을 추가하지 않는다. 재사용 컴포넌트는 browse/recommendation 구분이 타입으로 명확해야 한다. 운영시간 미확인·설명 없음은 솔직한 fallback, 인기 데이터 합성0이다.

App/nav/mainTabNavigation과 실제 모든 최상위 탭 호출부를 검색해서 주변 둘러보기로 연결한다. 탭 즉시 전환·기존 active 이어가기/완료 기록/계정 접근은 유지한다. legacy MyCourses 저장 데이터/repository는 삭제하지 않으며 남는 내부 접근은 별도 이관 기록을 남겨. 무관한 UI 정리/Live Activity/Profile 기능은 이번에 구현하지 마.

필수 fixture: 2999/3000/3001m·동일거리 tie·유효좌표 검사·중복 ID·hold 제외·conditional 정보구분·닫힘/시간없음; pan/zoom 순서불변·기준위치 변경; 사진없음/실패·cluster/같은좌표·전수목록 접근; 마커/목록/상세 동기화·닫기 복원·큰 글씨/sheet 가림; 권한/GPS stale·지도 실패/빈 결과; browse 입력/선택/탭왕복에서 추천/route/저장/체류 side effect0; 기존 추천 상세/pair/코스 map·Home active·완료기록 회귀. 실제 production entry/handler 또는 사용되는 pure module을 실행하고 문자열 검사만으로 완료하지 마.

소유 범위 src/ui 및 UI 테스트, App.tsx/nav.ts/mainTabNavigation 최소 탭 연결. 데이터·엔진·API adapter·DB·env·native 의존성 수정 금지. 추가 지도 라이브러리/네이티브 설정이 필수면 근거와 대안을 인계하고 승인받아. QA 자동/회귀는 네트워크0·Simulator 순회0, 새 실제 route 호출0. 지도 SDK 타일·기존 사진 로딩까지 무네트워크라고 주장하지 마.

집중 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check 및 iOS export를 실행한다. 새 skip/삭제로 통과시키지 마. 완료 인계는 변경 파일/목적, 유지 계약, 실패 선행·최종 수치·로그, QA 재현 ID/실기기 남은 지도 cluster·사진·시트 제스처·권한 항목을 이 파일에 기록한다. 중앙 문서·보드·타 역할 파일 수정과 커밋은 하지 마.
```

## 순서·병렬

UIUX 한 세션이 map/탭/상세를 소유한다. 다른 UIUX/Live Activity의 App/nav 편집과 동시 실행하지 않는다. 기존 데이터 점검은 읽기만 병렬 가능하며 신규 데이터/API/DB 작업은 선행 필수가 아니다. 구현 후 QA 고정 fixture, 마지막 사용자 지도/마커/시트·권한 smoke 한 번 순서다.

## 이력

내 코스 저장 중심 최상위 탭 → 현재시간 추천 중심 제품에서 별도 주변 발견 요구 → 3km 지도·사진 cluster·거리순 sheet, 시간 무관 정보 탐색 → 기존 코스 추천과 역할 분리 → **현행·구현 완료**. 카드 먼저 방식은 비교안으로 보존하며 이번 기본 진입으로 채택하지 않는다. 인기순·지도 pan에 따른 자동 재정렬·모든 사진 겹침 그대로 노출은 채택하지 않는다.

## 구현 분리 기록 — 2026-09-05

- 공개 카탈로그에서 실제 확인된 `contentId`, 좌표, `classification`, `category/subCategory`, `addr1`, `imageUrl/imageSource`, `detailDescription`, `operatingHours`, `mapVerification`만 읽는다. `representative_core/representative_standard/conditional_more`를 browse 정보 자격으로 변환하고 다른 등급·유효하지 않은 ID/좌표·중복 ID는 닫는다.
- 기존 `KakaoRouteMap`은 코스 geometry·viewport 계약을 유지한다. 주변 지도는 `NearbyBrowseMap`으로 분리해 viewport projection cluster, 사진 실패 기본 핀, 선택 강조, 현재 dataset ID만 허용하는 bridge를 소유한다.
- 기존 `PlaceDetailScreen`의 추천 session/선택 handoff에는 연결하지 않는다. 주변 상세는 하나의 draggable sheet 안에서 목록과 교체되고 기존 카카오 장소 opener만 재사용한다.
- 최상위 탭은 신규 `NearbyBrowse` reset으로 전환했다. 기존 `MyCourses` route와 `MyCoursesScreen`, 저장 repository 및 진행 화면의 legacy 복귀는 별도로 보존해 저장 데이터를 삭제하거나 주변 화면으로 오인 전환하지 않는다.

## 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`: `NearbyBrowse` 최상위 목적지를 추가하고 `MyCourses` legacy 목적지를 분리 보존했다.
- `src/ui/FloatingTabBar.tsx`, `src/ui/HomeScreen.tsx`, `src/ui/ExecutionScreen.tsx`, `src/ui/ActivityRecordScreen.tsx`, `src/ui/ProfileScreen.tsx`, `src/ui/FeedbackScreen.tsx`: 표시 탭을 `주변 둘러보기`로 바꾸고 모든 최상위 탭 행동을 즉시 reset 전환에 연결했다. 진행 화면의 저장 코스 복귀 행동은 기존 `MyCourses`를 유지했다.
- `src/ui/nearbyBrowseModel.ts`: 직선거리 원값 기준 `≤3000m`, 안정 ID tie, 자격/중복/좌표 필터, 정직한 정보 fallback, cluster·선택·위치 stale guard·WebView message 검증을 순수 경계로 추가했다.
- `src/ui/NearbyBrowseMap.tsx`, `src/ui/NearbyBrowseScreen.tsx`: 전체 지도, viewport/zoom 겹침 묶음, 사진/기본/선택 마커, 거리순 가상화 목록, 단일 draggable 목록↔상세 sheet, 실측 bottom inset, 위치 검색·지도 선택·명시 현위치, 지도 실패/0건/카카오 실패 복구를 구현했다.
- `test/ui/nearby-browse.test.ts`, `test/ui/nearby-browse-screen.test.mjs`: 순수 경계와 production 화면 handler fixture를 추가했다.

### 2. 유지한 공개 계약·정책 경계

- 추천 engine, route/API adapter, 카탈로그 원본, DB/repository, 저장 payload, 완료 기록, Live Activity, native 의존성과 env는 수정하지 않았다. browse 진입·선택에서 추천/route/저장/체류 호출은 0회다.
- 지도 pan/zoom은 기준 위치·거리순 dataset을 바꾸지 않고, 실제 기준 위치 변경만 재계산한다. 부산 중심 좌표는 picker가 아직 열릴 기준일 뿐 주변 결과나 현위치로 표시하지 않는다.
- 조건부 장소를 검증 추천으로 승격하지 않고 `정보 탐색 장소`로 표시한다. 운영시간/설명이 없으면 각각 `운영시간 확인 필요`/`상세 설명 없음`이며 현재 영업·인기·평점·혼잡을 합성하지 않는다.
- 기존 추천 상세/pair/CourseConfirm과 `KakaoRouteMap`, Home의 active 이어가기, 저장 코스 `MyCourses` 내부 경로와 데이터는 유지했다.

### 3. 실패 선행·테스트 결과

- 실패 선행: `nearbyBrowseModel` 부재로 집중 fixture 1건이 `MODULE_NOT_FOUND` 실패하는 것을 확인한 뒤 구현했다. 전체 회귀 첫 실행에서는 신규 `.mjs`의 TS loader 누락으로 화면 fixture 4건이 실패했고 `tsx/cjs` 로더를 명시해 같은 `npm test` 경계에서 재현·해소했다.
- 집중 fixture: 11/11 통과. 2999/3000/3001m, 동일거리 ID tie, 유효좌표·중복·hold·conditional·시간 없음, pan 불변/기준 변경, cluster/동일좌표 전수 접근, 선택/상세 복원, GPS stale, 권한 거절, 지도 실패, bridge dataset ID, side effect 0을 확인했다.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 389건 중 388 통과, 1건 기존 skip, 실패 0.
- `npm test`: 190/190 통과. `node --test test/map-transport-ui-contract.test.mjs`: 14/14 통과. `git diff --check`: 통과.
- `npx expo export --platform ios`: iOS 1269 modules bundle 및 export 성공. 실제 API·GPS·Simulator·실기기는 실행하지 않았다.

### 4. 다음 결정·위험·QA 재현 조건

- `QA-NEARBY-01`: internal/실기기에서 위치 권한이 이미 허용된 진입과 거절→`현위치` 명시 요청을 각각 확인하고, 수동 검색·지도 선택 라벨이 `선택 위치 기준`인지 확인한다.
- `QA-NEARBY-02`: 카카오 지도에서 3km 전체 fit, pan 뒤 목록 순서 불변, 일반 겹침 tap 확대, 같은 좌표/최대 확대 묶음 목록, 선택 사진 마커의 테두리·장소명 및 sheet 가림 방지를 확인한다.
- `QA-NEARBY-03`: 정상/없는/실패 사진, 큰 글씨, 작은 화면에서 목록 drag·가상화·상세 scroll·닫기 상태 복원을 확인한다. 자동 테스트는 원격 지도 SDK tile과 실제 사진 응답 품질까지 무네트워크로 보장하지 않는다.
- `QA-NEARBY-04`: 지도 네트워크 실패 중 목록/상세/명시 재시도와 카카오 앱 미설치·HTTPS/browser 실패 시 상세 유지 여부를 확인한다. 카탈로그 밖 추가 장소·새 API 검색은 이번 범위 밖이다.
