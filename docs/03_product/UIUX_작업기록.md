# TimeFit UIUX 작업기록

> 이 문서는 UIUX 세션의 **작업 명령 → 결과 → 인계 → 통합 피드백 → 다음 명령**을 시간순으로 누적하는 단일 작업 파일이다. 화면 구현자는 `AGENTS.md`, `docs/README.md`, `UIUX_공통규칙.md`, `UIUX_테스트명세.md`, 이 문서만 먼저 읽는다.
>
> 제품 정책은 `추천로직.md`, 엔진 작업 결과는 `추천엔진_작업기록.md`가 기준이다. UIUX 세션은 엔진·data·API adapter·DB 스키마를 직접 수정하지 않는다.

## 2026-08-26 — 통합·결정 지시 U-1-F-R7: 카카오맵식 단일 경로 설정 전환

**결정 상태: 현행·구현 전.** 사용자에게 `현재 위치`와 `도착지/복귀`를 따로 고르게 한 이전 진입 방식은 철회한다. 시간 설정에서는 **`경로 설정하기` 한 행**으로 들어가고, 카카오맵 길찾기처럼 출발지·도착지를 한 화면에서 설정한다. U-1-F-R6의 통합 위치 선택 자산은 재사용할 수 있지만, 그 화면 흐름만 보완하는 작업으로는 수락할 수 없다.

**선행 조건:** 검색은 API-S-5-R의 `createKakaoLocationSearchAdapter()`만 소비한다. 지도 핀 확정 라벨은 API-S-6의 공개 역지오코딩 계약을 소비해야 한다. API-S-6이 아직 완료되지 않았으면 화면 골격·고정 pin·검색/권한·테스트부터 구현하고, 핀 확정 연결은 `대기`로 명시한다. UI가 `src/engine/kakao.ts` 또는 제공사 HTTP를 직접 호출해서 선행 조건을 우회하면 안 된다.

### 사용자 흐름 — 구현 대상

```text
시간 설정
  └─ [경로 설정하기]
       └─ 경로 설정: 출발지 / 도착지 두 필드 동시 표시
            ├─ 출발지 탭 ─┐
            └─ 도착지 탭 ─┴─ 공통 위치 선택 화면
                                  ├─ 장소명·주소 검색
                                  ├─ 현재 위치
                                  └─ 지도에서 선택 → 중앙 고정 핀 → 이 위치로 확정
       └─ [경로 적용]
  └─ 출발 → 도착  또는  출발지로 돌아오기 요약
```

1. `TimeSetupScreen`의 별도 `현재 위치`, `도착지/복귀`, 예전 origin/destination 선택 진입을 제거하고 `경로 설정하기` 한 행으로 교체한다. 시간·도착 여유·개발 테스트 시각의 기존 의미는 바꾸지 않는다.
2. 새 route setup 화면(페이지 또는 같은 수준 sheet)은 출발지와 도착지 필드를 **동시에** 보여 준다. 현재 편집 중인 필드(`origin | destination`)를 명시 상태로 두고, 두 필드는 같은 `PlacePicker`로만 진입한다. 출발지를 선택하지 않으면 `경로 적용`은 비활성이다. 도착지는 비어 있을 수 있고, 이때 적용 결과는 `returnToOrigin: true` 및 사용자 문구 `출발지로 돌아오기`다. 도착지를 임의의 현재 위치·첫 검색 결과로 채우지 않는다.
3. route setup을 열 때만 위치 권한을 **조회**한다. 이미 foreground 권한이 허용되어 있으면 출발지에 GPS 위치를 자동 적용한다. 아직 허용되지 않았거나 위치 획득에 실패하면 권한 요청 팝업을 자동으로 띄우지 말고 `출발지 선택`으로 둔다. 사용자가 공통 picker의 `현재 위치`를 탭했을 때만 권한 요청/재시도를 수행하며, 그 위치도 `이 위치로 확정`이라는 명시 행동 뒤 필드에 반영한다.
4. 공통 picker의 초기 상태에는 검색 입력 아래 `현재 위치`, `지도에서 선택`을 함께 둔다. 검색어가 한글 기준 2자 이상(숫자/주소 입력 포함)이면 400ms debounce 뒤 API-S-5-R adapter **한 인스턴스**로 검색한다. 장소 신호는 관련 POI를, 주소 신호는 주소 제안을 우선 표시하며, 반대 종류 fallback·TTL·in-flight는 adapter 계약에 맡긴다. UI는 Kakao와 TMAP을 함께 호출하거나 주소·노선·유사어를 추측하지 않는다. 입력이 바뀌면 이전 결과와 이전 선택은 즉시 무효화한다.
5. `지도에서 선택`은 앱 내부 전체 지도다. 핀은 지도 마커가 아니라 화면 정중앙에 절대 배치된 시각적 overlay이며, 사용자가 지도를 드래그/확대할 때 지도 중심 좌표만 바뀌고 핀은 움직이지 않는다. WebView 지도 이벤트는 drag/idle 뒤 중심 좌표를 UI 상태로 전달할 수 있어야 한다. 지도 탭으로 marker를 옮기는 기존 동작은 제거한다. 지도 이동·확대·축소 중 검색·역지오코딩·TMAP 요청은 각각 **0회**다.
6. `이 위치로 확정`을 누른 딱 한 번만 API-S-6 `reverseGeocodeSelection()`을 호출한다. 성공 라벨/주소면 동일 `LocationSelection` payload에 넣어 돌아가고, typed 실패 또는 주소 없음이면 provider 주소인 것처럼 꾸미지 않은 임시 좌표 선택 라벨과 `검색으로 선택` 대안을 보여 주되 좌표 확정 자체는 가능해야 한다. 버튼 연타·처리 중 중복 호출을 막고, 지도 중심이 바뀐 뒤 오래된 응답은 적용하지 않는다.
7. 사용자 장소·주소·좌표를 AsyncStorage, DB, 콘솔 진단, 화면 분석 이벤트에 새로 저장하지 않는다. 기존 세션에 필요한 선택 payload만 navigation의 직렬화 가능한 primitive(`nowIso`, label, lat/lon 등)로 전달하며 `Date`, 함수, adapter 인스턴스는 navigation params에 넣지 않는다.
8. 적용 후 시간 설정 화면에는 `출발지 이름 → 도착지 이름` 또는 `출발지 이름 · 출발지로 돌아오기`의 짧은 요약만 표시한다. 기존 두 행이나 별도 권한 선택 단계가 남아 사용자에게 서로 다른 위치 설정 방법을 중복 노출하면 완료가 아니다.

### 테스트와 수동 확인

소스 문자열 검사만으로 완료 처리하지 말고, 위치·route setup 표시 모델 또는 주입 가능한 controller 경계에서 아래 고정 fixture를 추가한다. 실제 Kakao/TMAP 호출은 0회다.

| ID | 입력/행동 | 기대 결과 |
| --- | --- | --- |
| UR7-01 | route setup 진입, 권한 허용 GPS 성공 | 출발지만 자동 적용, 도착지는 빈 상태, 권한 추가 요청 0회 |
| UR7-02 | 권한 거부/위치 실패 | 자동 출발지 없음, 시스템 권한 팝업 0회, `현재 위치` 명시 탭만 요청 가능 |
| UR7-03 | 출발지·도착지 각각 탭 | 동일 picker가 active field만 바꿔 선택 payload를 되돌림 |
| UR7-04 | 1글자 / 2글자 뒤 400ms / 빠른 입력 변경 | 1글자 요청 0회, 최신 query만 반영, stale 결과·선택 확정 0회 |
| UR7-05 | 장소명, 주소, 성공 0건·provider 실패 | API-S-5-R의 제안/typed 상태만 표시, 병렬 Kakao·TMAP 요청 0회, 재시도 가능 |
| UR7-06 | 지도 drag·zoom 20회 후 확정 | 이동 중 검색·reverse-geocode·TMAP 0회, 확정 1회; 성공/실패 모두 선택 경계 유지 |
| UR7-07 | 빈 도착지/지정 도착지로 경로 적용 | 각각 복귀/도착 payload와 시간 설정 요약이 정확, 출발지 없으면 CTA 비활성 |
| UR7-08 | 지도 SDK 실패 | 명시 `다시 시도`와 검색 대안, 외부 카카오맵 강제 전환 없음 |

- 안정적인 `testID`를 route setup 진입, 출발/도착 필드, 현재 위치, 지도 선택, 중앙 핀 지도, 핀 확정, 경로 적용, 검색 입력/결과/재시도에 제공한다.
- iOS 시뮬레이터 또는 실기기에서 권한 허용 GPS 자동 출발지, 권한 거부, 검색으로 출발/도착 각각 지정, 중앙 고정 핀 드래그 뒤 확정을 최소 한 번씩 재현한다. 실제 키가 없거나 지도 SDK가 실행되지 않으면 성공으로 기록하지 말고 기기·입력·관찰 로그와 차단 사유를 남긴다.
- `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다.

**소유 경계:** `src/ui/`, UI 테스트, 이 작업기록만 수정한다. `src/services/`, `src/engine/`, data, DB, 제품 정책을 수정하지 않는다. 완료 기록에는 변경 파일, 유지 경계, API-S-6 소비 방식, 각 fixture와 iOS 결과, 남은 차단을 네 항목으로 남긴다.

**완료 기준:** 한 번의 route setup에서 출발/도착/복귀를 이해하고 설정할 수 있으며, 검색·현재 위치·중앙 고정 핀 선택이 하나의 picker와 명시 확정 계약으로 작동한다. API-S-6 연동, UR7-01~08, iOS 수동 확인이 모두 충족되기 전에는 `조건부 완료`로도 수락하지 않는다.

### U-1-F-R7 진행 기록 (2026-08-26)

**상태: 구현·자동 검증 완료, iOS 전체 수동 시나리오 미완료 — 미수락.**

#### 이전 방식 → 문제/관찰 → 교체 방식 → 이유·상태

- **경로 입력:** 이전에는 시간 설정의 `현재 위치`와 `도착지/복귀`가 독립 진입이었다. 출발·도착의 관계가 분리되어 보였다. 이를 `경로 설정하기` 한 행과 출발지·도착지 동시 route setup 화면으로 교체했다. 빈 도착지는 `출발지로 돌아오기`로 요약하고, 출발지 없이는 `경로 적용`을 비활성화한다. **현행, 자동 검증 완료.**
- **권한/GPS:** route setup 진입에서 이미 허용된 foreground 권한만 조회하고 GPS 출발지를 자동 적용한다. 미허용·GPS 실패에는 팝업을 띄우지 않으며 picker의 `현재 위치` 명시 탭만 요청 경로로 남긴다. **현행, fixture 검증 완료·기기 권한 미확인.**
- **지도 핀:** 기존 지도 탭 marker 이동을 중앙 고정 overlay pin과 WebView `idle` 중심 좌표 전달로 교체했다. 이동/확대 중에는 adapter를 호출하지 않고, `이 위치로 확정`에서만 API-S-6 `reverseGeocodeSelection()`을 1회 호출한다. 중심이 바뀐 뒤 늦은 응답은 무시하고, 주소 없음/typed 실패에는 좌표 선택 및 검색 대안을 유지한다. **현행, fixture·코드 계약 검증 완료·기기 API 결과 미확인.**

#### 변경 파일 / 목적

- `src/ui/TimeSetupScreen.tsx`, `src/ui/routeSetupModel.ts`: 단일 route setup 진입, 출발/도착 active field, 권한 조회 전용 자동 GPS, 복귀 요약과 적용 게이트를 추가했다.
- `src/ui/MapPlacePicker.tsx`, `src/ui/KakaoRouteMap.tsx`: 중앙 고정 핀, 지도 중심 이벤트, API-S-6 확정 1회, stale 응답 차단, 지도 재시도·검색/좌표 대안을 구현했다.
- `test/ui/route-setup-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: UR7-01/02/03/07의 표시 모델 및 route setup·중앙 pin·API-S-6·재시도 UI 계약을 추가했다. R6의 위치 검색 fixture는 UR7-04/05의 debounce·stale·typed 상태를 계속 검증한다.

#### 유지한 계약 / 테스트 결과 / 다음 결정

- `src/services/`, `src/engine/`, data, DB, 제품 정책은 수정하지 않았다. UI는 API-S-5-R 검색 adapter와 API-S-6 `reverseGeocodeSelection()` 공개 함수만 소비하며 TMAP·직접 HTTP·engine 역지오코딩을 호출하지 않는다. 위치 payload는 화면 상태와 navigation primitive로만 전달하며 새 저장/진단은 추가하지 않았다.
- `npm run test:typecheck`, `npm run test:ui`(94 pass, 1 skip), `npm test`, `git diff --check`가 통과했다. 고정 fixture의 실제 Kakao/TMAP 호출은 0회다.
- 2026-08-26 iOS 시뮬레이터에서 `npx expo run:ios` 빌드·설치와 `com.dongheun.mobile` 실행, 홈 화면 표시까지는 확인했다(캡처: `/private/tmp/r7-ios.png`). 이 환경에서는 앱 화면을 입력 조작할 수 없어 권한 허용/거부, 출발·도착 검색, 지도 drag 후 핀 확정의 수동 시나리오는 아직 실행하지 못했다. 해당 항목이 남아 있으므로 R7은 수락하지 않는다.

### 통합·결정 지시 U-1-F-R7-R: 이전 경로 제거·GPS 근거·지도 확정 fixture 보완 (2026-08-26)

사용자 시뮬레이터 확인으로 `경로 설정하기 → 출발/도착 동시 설정`이라는 **화면 틀**은 의도와 맞는 것을 확인했다. 그러나 아래 세 항목은 현행 정책·완료 기준과 다르므로 U-1-F-R7을 완료로 수락하지 않는다. 새 화면을 다시 설계하는 작업이 아니라, 남은 이전 경로와 검증 경계를 정리하는 보완이다.

1. `TimeSetupScreen`에 `origin-choice`, `location-permission`, `destination-choice`, `useGps`, 관련 back 분기와 화면 JSX가 여전히 남아 있다. 현재 주 흐름에서는 닿지 않더라도, 철회한 두 단계 위치 설정이 코드에 공존하면 이후 연결에서 재노출될 수 있다. 해당 page union·함수·JSX·전용 스타일을 삭제하고, 뒤로가기는 `route-setup → setup`, picker/modal 닫기는 route setup 유지라는 현재 흐름만 남긴다.
2. `PlacePicker.useMyLocation()`은 기기 GPS 결과를 `provider: 'kakao'`, `labelSource: 'provider'`, `addressSource: 'provider'`인 `LocationSuggestion`으로 만들어 준다. 이는 GPS 위치를 Kakao 제공 장소/주소로 위장하는 잘못된 근거 표기다. API adapter 타입은 바꾸지 말고, UI 내부의 별도 device-location 선택 상태 또는 `Place` payload로 처리한다. 사용자는 `현재 위치 사용` 뒤 footer의 `이 위치로 확정`을 한 번 더 눌러야 하며, 화면에는 `현재 위치`/`기기 위치`처럼 사실인 라벨만 보인다. 장소·주소 목록의 provider label·주소·노선 표시는 계속 API-S-5-R 결과만 사용한다.
3. UR7-06은 `test/map-transport-ui-contract.test.mjs`의 소스 문자열 검사뿐이다. `MapPlacePicker`의 주입 가능한 reverse-geocode 함수 또는 별도 controller/model fixture로 지도 중심 변경 20회 → reverse 요청 0회 → 명시 confirm 1회, confirm 중 버튼 연타 0회 추가, 중심 변경 뒤 늦은 응답 무시, 성공·주소 없음·typed 실패의 좌표 선택/검색 대안을 실제 상태 전이로 검증한다. fixture에서 실제 API, WebView, TMAP은 0회여야 한다.

**재검증:** 기존 UR7-01~05/07/08의 경계를 유지하고 위 보완 fixture를 추가한 뒤 `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 사용자가 확인한 화면 틀은 통과 관찰로 기록하되, 권한 허용·거부, 출발/도착 검색, 지도 drag 뒤 확정은 iOS에서 각각 재현한 뒤 수락한다.

**완료 기록 형식:** 변경 파일과 제거한 이전 page 목록, GPS device 선택과 provider 검색 결과의 타입/표시 분리, UR7-06 state fixture의 호출 횟수, 실행한 테스트 결과, iOS 수동 재현 결과 및 남은 차단을 기록한다.

**완료 기준:** 철회 화면 코드가 재진입 경로 없이 제거되고, GPS가 Kakao 근거로 표시되지 않으며, UR7-06 상태 fixture가 API 호출 0/1 경계를 증명해야 한다. iOS 수동 재현까지 끝나기 전에는 완료로 기록하지 않는다.

### U-1-F-R7-R 진행 기록 (2026-08-26)

**상태: 코드·자동 검증 완료, iOS 행동 재현 미완료 — 미수락.** 사용자 확인으로 `경로 설정하기 → 출발/도착 동시 설정` 화면 틀은 통과 관찰로 유지한다.

#### 변경 파일과 제거한 이전 경로

- `src/ui/TimeSetupScreen.tsx`: `origin-choice`, `location-permission`, `destination-choice` page union·JSX, `useGps`, 전용 back 분기와 권한 전용 스타일을 제거했다. 남은 뒤로가기는 `route-setup → setup`이며, 검색/지도 modal을 닫거나 확정해도 route setup으로 돌아간다.
- `src/ui/PlacePicker.tsx`: GPS 결과를 `LocationSuggestion`으로 만들지 않고 `deviceLocation: Place` 별도 상태로 분리했다. 화면은 `현재 위치`와 `기기 위치`만 표시하고, Kakao의 장소/주소·노선 라벨은 API-S-5-R 제안 행에만 남긴다. GPS 후에도 footer의 `이 위치로 확정`을 한 번 더 눌러야 한다.
- `src/ui/mapPinConfirmationModel.ts`, `test/ui/map-pin-confirmation-model.test.ts`: 주입 reverse 함수 기반의 UR7-06 state fixture를 추가했다. 중심 이동 20회는 reverse **0회**, confirm은 **1회**, 처리 중 confirm 연타는 추가 호출 **0회**, 중심 변경 뒤 늦은 응답은 확정하지 않음을 확인했다. 주소 없음과 `network_error` typed 실패는 검색 대안 문구와 좌표 확정 행동을 유지한다. fixture의 Kakao/WebView/TMAP 실제 호출은 **0회**다.
- `test/map-transport-ui-contract.test.mjs`: 철회 page 문자열 부재, route setup 전용 권한 조회, GPS/Kakao 근거 분리의 화면 계약을 갱신했다.

#### 유지한 공개 계약·검증 결과·다음 재현

- `src/services/`, `src/engine/`, data, DB, 제품 정책은 변경하지 않았다. 검색은 API-S-5-R, 지도 확정은 API-S-6 공개 adapter만 소비한다.
- `npm run test:typecheck`, `npm run test:ui`(97 pass, 1 skip), `npm test`, `git diff --check` 통과.
- 남은 iOS 수동 재현: 권한 허용 GPS 자동 출발지, 권한 거부 뒤 명시 GPS 요청, 출발/도착 각각 검색 확정, 지도 20회 drag/zoom 뒤 핀 확정·주소 없음/오류 대안. 이 네 행동이 기기에서 확인될 때까지 R7-R을 완료로 수락하지 않는다.

**소유 경계:** `src/ui/`, UI 테스트, 이 작업기록만 수정한다. API-S-5-R/API-S-6 adapter·엔진·카탈로그·DB를 바꾸지 않는다.

### 통합·결정 지시 U-1-F-R8: 기기 주소·기기 중심 지도·해안 핀 선택 보완 (2026-08-26)

**선행 조건:** API-S-7 완료. UI는 그 `createKakaoLocationLabelAdapter()` 공개 계약만 소비한다. `src/engine/kakao.ts`·Kakao HTTP·TMAP을 화면에서 직접 호출하거나 API-S-7의 cache/fallback을 다시 구현하지 않는다.

**사용자 관찰과 목표:** 현재 경로 설정을 열면 기기 위치가 `현재 위치`라고만 보이고, 지도 선택은 부산광역시청에서 시작하며, 원형 핀과 해운대해수욕장처럼 주소 없는 좌표의 확정 실패가 카카오맵식 선택 경험을 끊는다. 아래 네 행동을 하나의 일관된 흐름으로 고친다.

1. `route-setup` 진입 시 위치 권한이 이미 허용되어 GPS를 얻으면 출발지에 즉시 `현재 위치 확인 중` 같은 loading 상태를 보이고 API-S-7을 **한 번** 호출한다. address 결과면 provider 주소를, region 결과면 provider 행정구역 + `인근`을 출발지 라벨로 표시한다. typed 실패/unresolved면 GPS 출발지 자체는 유지하고 `현재 위치`만 표시한다. 권한 팝업은 자동 요청하지 않고, 화면을 열어 둔 동안 중복 GPS 라벨 요청·늦은 응답 덮어쓰기를 막는다.
2. `지도에서 선택`을 열 때 `origin`이 있으면 그 좌표를 초기 중심 및 visible/reopen recenter 기준으로 쓴다. origin이 아직 없으면 마지막으로 명시한 기기 위치가 있으면 그것을 쓰고, 그것도 없을 때만 부산 기본 중심을 쓴다. `KakaoRouteMap`은 빈 markers/line일 때도 전달받은 initial/recenter point로 실제 WebView 지도를 맞춰야 한다. 지도 이동은 위치 라벨 adapter·검색·TMAP 호출을 0회로 유지한다.
3. 중앙 고정 핀을 원형 버튼에서 지도 앱과 같은 **물방울 마커 핀**(둥근 머리 + 아래 뾰족한 꼬리)으로 바꾼다. `pointerEvents="none"`의 화면 overlay여야 하고 지도 marker가 아니다. 하단 조작 패널이 가리는 화면 전체 중심이 아니라 사용자가 실제로 움직여 보는 지도 가시 영역의 중심에 둔다. 충분한 대비와 `map-fixed-pin` testID는 유지한다.
4. 핀 확정은 API-S-7 결과를 그대로 소비한다. address는 정확 주소로, region은 `해운대구 우동 인근`처럼 **대략 지역**임을 표시하고 바로 선택 가능하게 한다. `unresolved` 또는 typed 실패만 `주소를 확인하지 못했어요`와 좌표 선택/검색 대안을 보인다. Kakao가 응답하지 않은 해변 좌표에 임의 POI 이름을 붙이거나 사용자가 다시 검색하게 강제하지 않는다.

### fixture·수동 확인

| ID | 고정 행동 | 기대 결과 |
| --- | --- | --- |
| UR8-01 | 권한 허용 GPS + address/region/failure | 자동 출발지는 각각 provider 주소/`인근`/`현재 위치`; 권한 추가 요청 0, 최신 결과만 반영 |
| UR8-02 | route setup 재진입/동일 GPS label | API-S-7 memory hit 또는 in-flight 공유, 화면에서 새 중복 호출·로그·저장 0 |
| UR8-03 | origin 있음/없음 지도 진입 | WebView 최초 중심과 reopen recenter가 origin/기기 위치/부산 fallback 순서; 이동 중 label/search/TMAP 0 |
| UR8-04 | map overlay | 물방울 핀이 가시 지도 중심에 고정되고 drag/zoom 뒤에도 지도만 움직임 |
| UR8-05 | address/region/unresolved/typed failure 확정 | address·region은 즉시 선택, region은 주소와 구분, 마지막 두 경우만 좌표/검색 대안 |

- API-S-7 fake adapter와 고정 GPS/map-center fixture를 주입한다. API/WebView/TMAP 실제 호출은 0회다.
- iOS에서 현재 기기 위치 주소, 지도 최초 중심, 해운대해수욕장 주변 land/water 좌표 각각의 확정 결과를 확인한다. 실제 provider가 address 대신 region을 주면 `인근` 표시가 되어야 하며, 둘 다 없을 때만 좌표 선택 대안이 보여야 한다.
- `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다.

**소유 경계와 완료 기준:** `src/ui/`, UI 테스트, 이 작업기록만 수정한다. 기기 GPS/지도/해안 좌표가 위 흐름대로 동작하고, API-S-7 public adapter 이외의 네트워크가 추가되지 않으며 UR8-01~05와 iOS 확인이 모두 기록되기 전에는 완료로 표시하지 않는다.

### U-1-F-R8 진행 기록 (2026-08-26)

**상태: 코드·고정 fixture 완료, iOS 실제 GPS/해안 좌표 확인 대기 — 미수락.**

#### 변경 파일 / API-S-7 소비 방식

- `src/ui/TimeSetupScreen.tsx`: 허용된 GPS 출발지를 먼저 `현재 위치 확인 중`으로 표시한 뒤, 화면 수명 동안 재사용하는 `createKakaoLocationLabelAdapter()`의 `gps_auto` 호출만 소비한다. address는 정확 주소, region은 `인근`, typed 실패/unresolved는 `현재 위치`로 표시하며 GPS 좌표 자체는 유지한다. request id로 늦은 응답을 차단하고 새 권한 요청·저장·로그를 추가하지 않았다.
- `src/ui/MapPlacePicker.tsx`: 핀 확정을 API-S-6 직접 호출에서 API-S-7 `pin_confirm` label 계약으로 전환했다. address/region은 각각 정확 주소/`인근` 라벨로 즉시 확정하며, unresolved/typed 실패만 기존 좌표·검색 대안을 보인다. 물방울 형태의 중앙 고정 overlay pin으로 바꾸고, origin → 마지막 기기 위치 → 부산 fallback 순서로 지도 중심을 전달한다.
- `src/ui/KakaoRouteMap.tsx`: marker·line이 비어도 `initialCenter`와 reopen `recenterPoint`를 WebView 초기/재중심 기준으로 반영한다. 지도 이동 이벤트는 계속 좌표 상태만 보내며 label/search/TMAP 요청을 만들지 않는다.
- `src/ui/locationLabelDisplayModel.ts`, `test/ui/location-label-display-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: address·region·unresolved 표시와 stale GPS 응답 차단, API-S-7 pin confirm·초기 중심·물방울 pin 계약을 고정했다. fixture의 실제 API/WebView/TMAP 호출은 0회다.

#### 검증·남은 수동 재현

- `npm run test:typecheck`, `npm run test:ui`(99 pass, 1 skip), `npm test`, `git diff --check` 통과.
- iOS에서 현재 기기 위치의 address 또는 region 표시, origin 중심 지도 최초/reopen, 해운대해수욕장 주변 land/water 핀 확정을 확인해야 한다. region이면 반드시 `인근`, address/region 모두 없을 때만 좌표/검색 대안이 보여야 한다. 이 재현 전에는 R8을 완료로 수락하지 않는다.

### 통합·결정 지시 U-1-F-R8-R: 실제 GPS 라벨·지도 실패·도착지 중심 회귀 수정 (2026-08-26)

**수락 상태:** U-1-F-R8은 완료가 아니다. 사용자 시뮬레이터 관찰과 코드 검토에서 아래 실제 회귀를 확인했다. 고정 fixture가 통과해도 화면 lifecycle·WebView 실패·출발/도착 기준 좌표를 검증하지 못했기 때문이다.

| 관찰/원인 | 수정 기준 |
| --- | --- |
| 출발지가 계속 `현재 위치 확인 중` | `useEffect`가 GPS 좌표를 `origin`에 넣은 뒤 dependency 변경으로 cleanup되고, 완료된 `locationLabel.resolve()` 응답을 `active === false`로 버린다. 자동 GPS label 요청은 origin 자체를 갱신해도 취소되지 않아야 한다. |
| 위치를 못 받는 시뮬레이터에서 지도만 흰 배경 | WebView의 loading·ready·timeout·키 없음·SDK 오류를 `MapPlacePicker`의 사용자 행동 상태로 연결하지 않아, 실패/검색 대안이 보장되지 않는다. |
| 도착지 지도 선택이 현재 기기가 아니라 출발지에서 열림 | `center={origin ?? devicePoint ?? SEOMYEON}`를 출발/도착 모두에 사용한다. 도착지 선택은 기기 위치를 먼저 써야 한다. |

#### 구현 지시

1. **GPS 주소 lifecycle**
   - route setup 진입마다 자동 GPS의 request id를 하나 만들고, GPS 좌표를 origin에 적용하는 자체 state 변경 때문에 해당 request가 취소되지 않게 한다. effect의 dependency/cleanup을 정리하고, route setup 이탈·새 자동 GPS 시작·사용자의 명시 출발지 선택에서만 이전 request를 무효화한다.
   - 허용 GPS를 얻은 뒤 `현재 위치 확인 중`을 표시하고 API-S-7 `gps_auto` 결과의 address/region만 반영한다. 실패/unresolved는 `현재 위치`로 끝낸다. 무한 재시도·추가 provider 호출·권한 자동 요청은 금지한다.
   - 사용자가 주소 조회 완료 전 검색/지도/GPS로 출발지를 명시 선택하면, 늦은 자동 응답이 그 선택을 덮어쓰지 않는 fixture를 추가한다.
2. **단일 label adapter 인스턴스**
   - `TimeSetupScreen`이 화면 수명 동안 `createKakaoLocationLabelAdapter()`를 한 번 만들고 `MapPlacePicker`에 주입한다. MapPlacePicker 안에서 별도 factory를 만들지 않는다. GPS 자동 라벨과 같은 좌표 핀 확정이 cache/in-flight를 실제로 공유해야 한다.
3. **출발/도착별 중심과 기기 위치 출처**
   - 장소 선택 payload에 UI 내부 `source: 'device' | 'provider' | 'map'`을 포함해, 기기 GPS를 출발지·도착지 어느 필드에 적용해도 `devicePoint`를 갱신한다. label 문자열 비교로 기기 위치를 판정하지 않는다.
   - 지도/검색 중심은 `origin` 편집이면 `origin → devicePoint → 부산`, **destination 편집이면 `devicePoint → origin → 부산`** 순서다. 따라서 사용자가 다른 출발지를 정한 뒤 도착지를 지도에서 고르면 실제 기기 위치가 있으면 그곳에서 열린다.
4. **흰 지도 대신 명시 상태**
   - `KakaoRouteMap`은 `onMapReady`를 공개하고, missing JS key·WebView `onError/onHttpError`·SDK message error·ready timeout을 모두 `onMapError`로 한 번만 전달한다. WebView와 fallback 배경은 앱 배경색을 명시해 흰 빈 화면이 보이지 않게 한다.
   - `MapPlacePicker`은 map loading을 보여 주고 ready 전/실패 시 `이 위치로 확정`을 비활성화한다. 실패 화면에는 `지도 다시 시도`, `검색으로 선택`을 항상 보인다. 위치가 없는 시뮬레이터는 부산 fallback 중심에서 지도가 뜨거나, 위 실패 상태가 보여야 한다. 흰 화면만 남으면 실패다.
5. **검증**
   - 고정/주입 fixture로 아래를 추가한다. 실제 Kakao·TMAP·WebView는 0회다.
     - `UR8R-01`: GPS origin state 변경 뒤 address label이 정상 반영되고, route setup 이탈/새 request/명시 선택 뒤에는 늦은 응답이 무시됨.
     - `UR8R-02`: GPS auto와 같은 좌표 pin confirm이 주입한 단일 adapter의 cache/in-flight를 공유함.
     - `UR8R-03`: destination map/search initial center가 `devicePoint` 우선이며 origin과 다를 때 정확히 구분됨.
     - `UR8R-04`: key 없음, WebView 오류, SDK timeout, ready 성공의 loading/error/CTA 상태와 retry를 검증. 흰 배경 상태 없음.
   - iOS 실기기와 위치 없는 시뮬레이터에서 각각: GPS 주소, destination 지도 중심, 지도 load/error 대안, 해운대해수욕장 핀 address/region/unresolved 결과를 확인한다.
   - `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다.

**소유 경계:** `src/ui/`, UI 테스트, 이 문서만 수정한다. API-S-7 adapter·엔진·data·DB·제품 정책은 수정하지 않는다.

**완료 기준:** 사용자 관찰 세 건이 재현 fixture와 실제 기기/시뮬레이터에서 모두 해소되고, GPS와 핀이 같은 label adapter cache를 공유해야 한다. iOS 실제 결과가 없으면 완료가 아니라 `수동 확인 대기`로 기록한다.

### U-1-F-R8-R 진행 기록 (2026-08-26)

**상태: 자동 검증 완료 · iOS 수동 확인 대기.** API-S-7 adapter·추천 엔진·카탈로그·DB 및 제품 정책은 변경하지 않았다.

| 이전 방식 → 관찰된 문제 | 교체한 방식 | 이유 / 상태 |
| --- | --- | --- |
| 자동 GPS effect가 `origin`을 dependency로 가짐 → origin을 넣는 즉시 cleanup되어 `현재 위치 확인 중`에서 주소 응답을 버림 | route-setup 진입 수명과 request id를 분리하고, route 이탈·새 자동 요청·명시 출발지 선택 때만 이전 request를 무효화 | origin state 갱신은 취소 사유가 아니므로 address/region 라벨을 끝까지 반영한다. **현행** |
| GPS와 핀 확정이 각자 label adapter를 만들 수 있음 → cache/in-flight 공유 보장 없음 | `TimeSetupScreen`의 단일 adapter를 `MapPlacePicker`로 주입 | 같은 좌표의 `gps_auto`·`pin_confirm`이 API-S-7 cache 경계를 공유한다. **현행** |
| 출발·도착 picker가 같은 중심 우선순위를 사용 → 도착지 지도가 출발지에서 열림 | payload 내부 source(`device`/`provider`/`map`)로 기기 좌표를 구분하고, origin은 `origin → device → 부산`, destination은 `device → origin → 부산` | 라벨 문자열 추측 없이 실제 기기 위치를 보존한다. **현행** |
| WebView 준비/오류가 CTA에 전달되지 않음 → 흰 지도와 확정 가능 상태가 남음 | `onMapReady`, key 없음·WebView/HTTP·SDK 오류·7초 timeout의 one-shot `onMapError`, loading/failed CTA 및 retry/search 대안 | 준비 전·실패 시 확정을 막고 앱 배경색 fallback을 유지한다. **현행** |

#### 변경 파일과 검증

- `src/ui/TimeSetupScreen.tsx`: GPS 라벨 lifecycle, source 기반 devicePoint 갱신, 출발/도착 중심 선택, 단일 label adapter 주입.
- `src/ui/PlacePicker.tsx`, `src/ui/MapPlacePicker.tsx`: 선택 source 전달, 공유 adapter 소비, 지도 준비/실패/재시도 CTA.
- `src/ui/KakaoRouteMap.tsx`: ready callback과 key·WebView·SDK·timeout 오류의 한 번만 전달되는 실패 경계, 비백색 fallback.
- `src/ui/locationPickerRecoveryModel.ts`, `test/ui/location-picker-recovery-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: UR8R-01~04 고정 fixture/화면 계약을 추가·갱신했다. 실제 Kakao·TMAP·WebView 호출은 0회다.
- 통과: `npm run test:typecheck`, `npm run test:ui` (103 pass, 1 skip), `npm test`, `git diff --check`.

#### 다음 수동 확인 / 인계

1. 위치 허용 iOS에서 route setup 진입 후 `현재 위치 확인 중`이 address 또는 `인근` 라벨로 바뀌는지, 즉시 출발지를 검색/지도로 바꾸면 늦은 자동 응답이 덮어쓰지 않는지 확인한다.
2. 다른 출발지를 정한 뒤 destination picker를 열어 실제 기기 위치를 중심으로 시작하는지 확인한다.
3. 위치 없는 시뮬레이터와 key/네트워크 실패 조건에서 흰 화면 대신 loading 또는 재시도·검색 대안이 보이는지, 해운대해수욕장 핀이 address/region/unresolved 각각을 정확히 처리하는지 확인한다.

수동 결과가 없으므로 U-1-F-R8-R은 완료 수락으로 승격하지 않는다.

### 통합·결정 지시 U-1-F-R8-R2: 지도 late-ready 경합과 수동 확인 (2026-08-26)

**판정:** U-1-F-R8-R의 세 관찰 회귀에 대한 코드 경로와 자동 테스트는 확인했다. 그러나 완료로 수락하지 않는다. iOS 수동 결과가 없고, `KakaoRouteMap`의 7초 timeout/error가 먼저 발생한 뒤 WebView가 늦게 `ready`를 보내면, 현행 `MapPlacePicker`는 `mapReady`만 true로 바꾸고 `mapFailed`는 true로 남긴다. 사용자는 실제 지도가 보이는데도 실패 문구·재시도 버튼을 함께 보게 된다.

#### 구현 지시

1. `MapPlacePicker`의 loading/ready/failed 상태 전이를 하나의 실제 소비 모델 또는 reducer로 통합한다. 테스트 전용 함수와 화면의 별도 boolean 조합을 유지하지 않는다.
2. `ready` 이벤트는 이전 timeout/error 상태를 **명시적으로 해제**해 `ready`가 최종 상태가 되게 한다. 반대로 ready 뒤의 실제 오류는 failed로 전환한다. retry는 loading으로 초기화하고 WebView를 새로 연다.
3. 확정 CTA는 ready일 때만 활성화한다. failed이면 재시도·검색 대안은 유지하되, late-ready 회복 뒤에는 실패 문구를 숨긴다.
4. 고정 fixture에 아래 상태 순서를 추가한다. 실제 WebView/Kakao/TMAP 호출은 0회다.
   - `UR8R2-01`: `open → timeout(error) → ready`는 최종 ready이며 확정 가능, 실패 문구 없음.
   - `UR8R2-02`: `open → ready → error`는 failed이며 확정 불가.
   - `UR8R2-03`: `failed → retry → ready`가 정상 회복하고, retry 전의 confirm/message가 남지 않음.
5. 이어서 다음 수동 결과를 **값과 기기 종류(실기기/시뮬레이터)** 로 기록한다.
   - 실기기: route setup 진입 뒤 출발지 라벨이 address 또는 `인근`으로 바뀌는지, 다른 출발지 뒤 도착지 지도 중심이 실제 기기 위치인지.
   - 위치 없는 시뮬레이터: 부산 fallback 지도 또는 loading 뒤 명시 실패/재시도·검색 대안 중 하나가 흰 화면 없이 보이는지.
   - 해운대해수욕장 주변: address/region/unresolved 각각에서 확정 또는 대안이 API-S-7 계약과 일치하는지.

**소유 경계:** `src/ui/`, UI 테스트, 이 작업기록만 수정한다. `src/services/` adapter·엔진·카탈로그·제품 정책은 변경하지 않는다.

**완료 기준:** UR8R2-01~03 자동 검증과 위 세 수동 결과를 모두 기록한다. 수동 환경이 없어 실행하지 못하면 `수동 확인 대기`를 유지하며 완료라고 쓰지 않는다.

### 통합·결정 범위 판정 — 장소 선택 마감 (2026-08-26)

- **관찰:** 실기기에서 사용자가 보고한 GPS 주소 표시, 출발지 변경 뒤 도착지 지도 중심 문제가 해결됐다. 위치를 주입하지 못하는 시뮬레이터에서는 지도 실행이 되지 않는다.
- **판정:** 실제 사용자 경로인 실기기 동작을 현 범위의 수락 근거로 삼는다. 위치 없는 시뮬레이터의 WebView 지도 재현과 timeout 뒤 late-ready 경합은 장소 검색·선택의 다음 기능을 막지 않는 별도 지도 품질 항목으로 보류한다.
- **현행 상태:** U-1-F-R8/R8-R 수락·실기기 확인. U-1-F-R8-R2 보류. 이 판정은 시뮬레이터 흰 화면을 정상으로 인정하는 것이 아니며, 출시 전 실기기/시뮬레이터 지도 품질 게이트에서 다시 확인한다.

## 2026-08-26 — 통합·결정 지시 U-1-F-R6: 통합 위치 선택 화면

**선행 조건:** API-S-5 완료. UI는 그 작업의 단일 Kakao 위치 제안·cache·호출 상태 계약만 소비한다.

1. 출발/도착 변경을 하나의 위치 선택 화면으로 통합한다. 입력이 비어 있을 때 `현위치`, `지도에서 선택`, 검색 입력을 제공하고, 입력 중에는 장소/주소 제안 목록으로 전환한다. 이전 검색 결과/선택은 입력 변경 즉시 확정에 쓰지 못하게 한다.
2. 앱 내부 지도 선택은 별도 전체 화면 또는 sheet 상태로 제공한다. 지도 이동·핀 드래그 중 주소 요청을 반복하지 않고, 사용자가 `이 위치 선택`을 누를 때만 좌표를 확정한다. 지도 SDK/권한 실패는 명시적 재시도·검색 대안을 보여 주며 외부 카카오맵으로 강제 전환하지 않는다.
3. 출발지는 권한 허용 시 현위치를 자동 적용하고, 도착지는 빈 상태에서 시작한다. 현위치/지도 핀/장소/주소는 동일한 선택 payload로 돌아오며, 사용자가 명시 확정하기 전에는 CTA를 활성화하지 않는다.
4. API-S-5의 `kind`를 이용해 장소·주소 결과를 시각적으로 구분한다. 관련 POI 복수 제안과 provider metadata가 준 노선 라벨은 보존하되, UI가 노선·주소를 추측하거나 추가 API를 호출하지 않는다.
5. 고정 UI fixture로 빈 입력, 장소·주소 입력, TTL hit/miss 상태, provider fallback, 현위치 권한 허용/거부, 지도 이동 중 reverse-geocode 0회·핀 확정 1회, 입력 변경 stale 결과, 명시 선택/확정을 검증한다. 실제 API 호출은 0회다.
6. iOS 시뮬레이터 또는 실기기에서 지도 선택·현위치 권한·장소/주소 검색을 각각 한 번 확인한다. map SDK 또는 기기가 실행되지 않으면 완료로 표시하지 않고 차단 원인·대체 검색 흐름만 기록한다.

**완료 기준:** 사용자는 한 화면에서 현위치·지도 핀·장소·주소 중 하나를 선택해 출발/도착을 확정할 수 있고, 지도 이동 중 불필요한 API 호출이 없으며 API-S-5 cache 계약을 우회하지 않는다.

### 통합·결정 검토 — U-1-F-R6 미수락 (2026-08-26)

단일 `createKakaoLocationSearchAdapter()` 인스턴스 사용, 기존 TMAP·직접 주소 보정 제거, 입력 변경의 stale 응답 차단, 장소/주소 kind와 provider 노선 라벨 표시까지는 확인했다. 그러나 아래 항목 때문에 자동 검증 완료·작업 완료로 수락할 수 없다.

1. 현행 `UXV-06`의 **두 글자 뒤 400ms debounce 제안**이 없다. 현재 `PlacePicker`는 검색 버튼 또는 키보드 submit에서만 호출하므로, 입력 중 장소·주소 제안으로 전환하는 확정 흐름을 충족하지 못한다.
2. 지도 핀은 이동 중 reverse-geocode 0회인 것은 맞지만, `이 위치로 선택` 때도 reverse-geocode가 0회다. U-1-F-R6의 `핀 확정 1회` 계약에 따라 이때만 주소 라벨을 확인하고 같은 선택 payload를 확정해야 한다. 실패하면 좌표 선택·검색 대안을 명시적으로 유지해야 한다.
3. 추가한 `test/map-transport-ui-contract.test.mjs`는 소스 문자열 검사다. 빈 입력, 장소/주소 분류, TTL hit/miss, provider fallback, 권한 허용/거부, 지도 이동 0회·핀 확정 1회, stale 결과, 명시 선택·확정의 고정 fixture/상호작용 계약 테스트가 없다. `testID`도 이 시나리오를 고정할 만큼 제공되지 않는다.
4. 지도 SDK 실패는 오류 문구와 검색 진입은 있으나 명시적 재시도 동작이 없다. 또한 시뮬레이터 연결 실패로 현위치·지도·장소·주소의 기기 수동 재현이 완료 기준대로 실행되지 않았다.

**수락 상태:** 보완 필요. API-S-5-R의 검색 계약은 재사용하며, UI는 그 adapter를 다시 조합하거나 TMAP·추측 보정을 되살리면 안 된다. 다음 보완은 위 네 항목과 iOS 수동 재현을 모두 충족한 뒤에만 완료로 기록한다.

## 2026-08-24 — 현행 화면 구조 감사

## UIUX 세션 필수 인계 — 현재 추천 로직은 이렇게 바뀌었다

### 이전 화면 로직과 현재 V1의 차이

| 항목 | 이전 화면/legacy 로직 | 현재 V1 구현 계약 | UIUX 처리 |
| --- | --- | --- | --- |
| 입력 | 최대 120분, 사용자 mode·legacy 후보/기준 경로 | 실제 `now`, 출발, 도착지 또는 복귀, 1~180분, 도착 여유(기본 10분) | 시간 설정은 180분까지. 수단 선택 UI 없음 |
| 자동 대표 장소 | 기존 후보·근사값·단일 장소 재정밀화 | 최신 카탈로그 368개 중 자동 대표 후보 190개만 provider가 반환 | 조건부·hold·내부·근거 만료 장소를 대표 카드에 넣지 않음 |
| 내부 선별 | 넓은 후보와 legacy 랭킹 | 좌표·체류·운영 상태로 최대 18곳, 그 안의 최대 5,220개 1~3곳 순서 코스 | 이 숫자·직선/근사 점수는 어떤 화면에도 표시하지 않음 |
| 정확 검증 | 단일 장소를 최대 3회 실제 경로 재검사 | 우선순위 높은 순서 코스 최대 4개만, 모든 구간을 TMAP 도보 또는 ODsay 대중교통으로 정확 검증 | 차량·직선거리·`haversine`·`transit_fallback`·`walk_short`은 코스 시간으로 표시하지 않음 |
| 첫 결과 | 장소 후보 또는 단일 장소 | 검증된 대표 **코스 1개**(장소 1~3곳) | 장소 순서·구간별 수단/분·체류·도착 여유를 한 시간 여정으로 표시 |
| 새 추천 | 새 후보 재정렬·재정밀화 가능 | 이미 검증 완료된 `alternativeCourses`만 순환 | 대안이 소진되면 API/엔진 재호출 없이 안내 상태 |
| 0개 | 후보 없음과 실제 경로 실패가 화면에서 섞임 | `no_representative_candidates`, `no_verified_course_within_limit`을 구분 | §U-1의 서로 다른 빈 상태·CTA. 조건부/일반 카페로 대체 금지 |
| 장소 편집 | 장바구니 추가·삭제·순서 변경 | 대표 코스는 엔진이 조립하며 V1 결과는 읽기 전용 | 자유 장바구니·수단 선택·순서 변경 UI 금지 |

### 엔진이 UI에 주는 최소 결과 계약

```text
CourseV1LimitedResult
  representativeCourse: VerifiedCourseV1 | null
  alternativeCourses: VerifiedCourseV1[]
  resultState:
    | 'verified'
    | 'no_representative_candidates'
    | 'no_verified_course_within_limit'
  alternativeState:
    | 'alternatives_available'
    | 'no_alternative_verified_course'
    | 'no_candidates'

VerifiedCourseV1
  placeIds: string[]                 // 엔진이 확정한 방문 순서, 1~3개
  legs: { fromId, toId, mode: 'walk'|'transit', min }[]
  stayMin, travelMin, totalMin, arrivalBufferMin
  remainingAfterArrivalBufferMin
```

- `totalMin`에는 이동·권장 체류·도착 여유가 모두 포함된다. UI는 이 값을 재계산하지 않는다.
- `legs`는 모든 구간의 실제 검증 결과다. `mode`는 정보 표시용이지 사용자가 바꾸는 선택값이 아니다.
- 장소 제목·사진·지역·활동 유형·카카오 링크 같은 표시 데이터는 `placeIds`를 최신 런타임 카탈로그에서 조회해 보강한다. 이 조회는 코스 가능 여부·시간을 바꾸지 않는다.
- 운영시간 `needs_review`와 `conditional_more`는 V1 대표 결과에 올 수 없다. 더보기·조건부 수동 포함은 U-1 범위 밖이다.

### 확인한 흐름

```text
TimeSetupScreen (최대 120분, legacy planTimeFit)
  → ResultsScreen / OneStopResultsScreen (단일 장소, oneStop 추천)
  → buildBasketCourse + validateCourseOpening
  → ExecutionScreen / courseRepository (legacy Course·단일 mode·자유 편집 전제)
```

### 재사용 가능한 UI 자산

- 위치·도착지 선택, iOS 시각 선택, 도착 여유 슬라이더의 화면 골격
- safe-area, 탭, 지도, 사진·카카오맵 링크, `TimeJourney`의 시각적 이동/활동/여유 표현 원칙
- 코스 확인 화면의 전체 페이지 전환과 진행·기록 화면의 기본 내비게이션

### 대규모 전환이 필요한 경계

| 경계 | 현재 전제 | V1 현행 정책 | 판정 |
| --- | --- | --- | --- |
| 시간 설정 | 최대 120분, `planTimeFit`과 차량/legacy baseline 호출 | 최대 180분, V1 엔진에 `now·출발·도착/복귀·여유` 주입 | 수정 필요 |
| 결과 화면 | `OneStopResultsScreen`이 단일 장소를 근사 선별 뒤 3회 재정밀화 | 대표 1~3곳 코스 1개와 이미 검증된 대안만 순환 | **교체 필요** |
| 내비게이션 타입 | `PlanResult`, legacy `Course`, 사용자 mode | `CourseV1LimitedResult`, `VerifiedCourseV1`, 구간별 walk/transit | **교체 필요** |
| 코스 확인 | 한 장소·`buildBasketCourse` 재조립 | 엔진 반환 코스의 읽기 전용 검토 | **교체 필요** |
| 저장·진행 | legacy `Course`, 단일 `mode`, 자유 편집·교체 | 혼합 구간·엔진 조립·운영시간 상태 스냅샷 | DB 계약 보완 전 연결 보류 |

**결론:** 홈·위치 선택·지도·디자인 토큰을 전면 재설계할 필요는 없다. 그러나 `TimeSetup → Results → Confirm`의 데이터 경로는 legacy 타입을 V1 타입으로 교체해야 한다. V1 결과를 기존 `Course`로 억지 변환하거나 `OneStopResultsScreen`에 조건문을 누적하는 방식은 금지한다.

---

## 명령 U-1 — UIUX 세션: V1 결과 세션과 화면 전환 기반 만들기

**목표:** 사용자 입력을 V1 엔진으로 연결하고, 대표 코스·새 추천·두 빈 상태를 화면에서 정확히 표현한다. 이 명령은 저장·진행·조건부 수동 포함을 구현하지 않는다.

1. `TimeSetupScreen`의 최대 시간을 180분으로 교체하고, 입력값에서 실제 `Date now`·출발 좌표/라벨·도착지/복귀·남은 시간·도착 여유를 하나의 읽기 전용 V1 요청 모델로 만든다. 기존 `planTimeFit`, 차량/legacy baseline 호출은 새 V1 결과 진입에서 사용하지 않는다.
2. UI 컨테이너 전용 `RecommendationSession`(명칭은 구현에 맞게 조정 가능)을 만든다. 이 경계에서만 `createCourseV1CandidateProvider`, `createCourseV1RouteAdapter`, `buildLimitedRepresentativeCourseV1`을 조립한다. 표시 컴포넌트는 고정 result fixture를 받아 렌더링만 한다.
3. `OneStopResultsScreen`의 단일 장소·근사 재정밀화·`buildBasketCourse` 의존을 V1 결과 화면으로 교체하거나, 같은 릴리스에서 사용 경로를 끊고 새 화면으로 대체한다. 둘을 한 화면에 공존시키는 분기 구현은 하지 않는다.
4. 첫 화면은 `representativeCourse` 1개만 보여 준다. 장소 순서, 모든 실제 구간의 도보/대중교통·분, 권장 체류, 도착 여유를 하나의 시간 여정으로 표시한다. 사용자가 구간 수단·장소 순서를 고치거나 장소를 담고 빼는 UI를 제공하지 않는다.
5. `alternativeCourses`는 같은 세션 메모리에 보관한다. `새 추천`은 다음 검증 대안으로만 교체하며, 대안 소진 뒤에는 엔진·adapter를 재호출하지 않고 `이 조건에서 다른 검증 코스가 없어요`를 보인다.
6. `no_representative_candidates`와 `no_verified_course_within_limit`은 `UIUX_공통규칙.md` §4-1의 서로 다른 문구·CTA로 표시한다. 일반 카페·조건부 장소·내부 공간 점수·4개 상한·근사 시간은 대표 결과나 빈 상태에 표시하지 않는다.
7. 코스 확인은 V1 반환 코스를 읽기 전용으로 보여 주는 새/교체 화면까지 구현한다. 이 단계의 확정 CTA는 저장·진행을 호출하지 않고 `저장 기능 연결 전` 같은 임시 문구를 사용자에게 노출해서도 안 된다. 대신 DB 계약이 준비될 때까지 확정 CTA 자체를 노출하지 않고, 뒤로가기·새 추천·지도에서 더 보기만 제공한다. 실제 사용자 테스트는 결과 이해·시간 여정·새 추천 체감에 한정한다.

### 테스트·완료 기준

- `CourseV1LimitedResult` 고정 fixture로 UI 계약 테스트를 먼저 쓴다: 1/2/3곳 대표, 대안 교체, 대안 소진 뒤 엔진/adapter 재호출 0회, 두 빈 상태, 차량·근사·조건부 대표 미노출, 결과와 코스 확인의 동일 시간 여정.
- `UXV-20`, `UXV-41`, `REC-17`, `REC-21`에 테스트 근거를 연결한다. 최소 `npm run test:typecheck`, `npm run test:ui`, `npm test`를 실행한다.
- 변경 파일 / 유지한 엔진·DB 경계 / 테스트 결과 / DB 저장에 필요한 V1 스냅샷 필드를 이 문서에 기록한다.

### 다음 작업의 선행 조건

U-1 수락 뒤 DB·개인화 세션이 V1 저장 계약을 정한다. 최소한 코스 장소 순서, 구간별 `walk|transit`과 실제 분·출처, 총 이동·체류·도착 여유, 입력 시각·출발/도착 좌표, 운영시간 상태, 엔진/카탈로그 버전을 스냅샷에 보존해야 한다. 그 전에는 `ExecutionScreen`, `MyCoursesScreen`, `courseRepository`를 V1 코스에 연결하지 않는다.

---

## 2026-08-24 — U-1 완료 기록

### 변경 파일 / 목적

- `src/ui/TimeSetupScreen.tsx`, `src/ui/timeSetup/testClock.ts`: 최대 입력과 개발 시각 보조 종료를 180분으로 바꾸고, V1 `RecommendationSession`만 생성하도록 전환했다. 새 결과 진입에서는 `planTimeFit`·차량/legacy baseline을 호출하지 않는다.
- `src/ui/recommendation/v1Session.ts`, `src/ui/nav.ts`: UI 컨테이너에서만 후보 provider·실제 경로 adapter·V1 엔진을 조립하는 읽기 전용 세션과 화면 전달 타입을 추가했다.
- `src/ui/ResultsScreen.tsx`, `src/ui/recommendation/CourseV1Journey.tsx`, `src/ui/CourseConfirmScreen.tsx`: 대표 1~3곳 코스, 실제 `walk|transit` 구간·체류·도착 여유의 시간 여정, 대안 순환/소진, 두 빈 상태, 읽기 전용 코스 확인을 구현했다. 저장·진행·장소/수단/순서 편집 CTA는 노출하지 않는다.
- `App.tsx`, `src/ui/OneStopResultsScreen.tsx`, `src/ui/ExecutionScreen.tsx`, `src/ui/mainTabNavigation.ts`: 새 V1 `Results` 경로와 legacy 진행 코스 변경 전용 `LegacyResults` 경로를 분리했다. 한 화면 안의 V1/legacy 조건 분기는 만들지 않았다.
- `test/ui/course-v1-results-contract.test.mjs`, `test/ui/time-setup-clock.test.ts`: 180분 입력, V1 세션 경계, 대표/대안/두 빈 상태, 저장·자유 편집 미노출 계약을 추가·갱신했다.

### 유지한 공개 계약·정책 경계

- `src/engine/`, `src/data/`, `src/services/`의 V1 추천·경로 계약은 수정하지 않았다. UI는 `CourseV1LimitedResult`의 시간 값을 다시 계산하지 않는다.
- V1 저장 스냅샷과 `ExecutionScreen`·`MyCoursesScreen`·`courseRepository` 연결은 DB 계약 전까지 변경하지 않았다. 조건부 수동 포함과 앱 내 지도 후보 탐색은 U-1 범위 밖이다.

### 검증 결과

- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 65개 통과. 고정 V1 fixture의 대안 소비·소진 상태를 포함한 새 UI 계약 4개가 통과했다.
- `npm test`: 실패. 스크립트가 `node --test test`를 실행하지만 현재 Node가 저장소의 `test` 경로를 모듈로 해석하지 못해 `MODULE_NOT_FOUND`로 시작 단계에서 종료한다. 구현 테스트 실패는 아니다.
- `git diff --check`: 통과.

### 다음 결정·위험

- DB·개인화 담당이 V1 스냅샷(장소 순서, 모든 실제 구간과 출처, 이동·체류·여유, 입력 시각·좌표, 운영시간 상태, 엔진/카탈로그 버전)을 확정하기 전 저장·진행 연결 금지.
- 현재 `지도에서 더 보기`는 U-1에서 허용된 외부 카카오맵 진입이다. 확인 후보/조건부 후보를 구분하는 앱 내 지도는 별도 결과 계약이 준비된 뒤 구현한다.
- `npm test`의 경로 스크립트는 QA 또는 통합 담당이 고쳐야 전체 회귀를 재현할 수 있다.

---

## 2026-08-24 — 통합·결정 검토: U-1 조건부 보류

### 수락한 부분

- 시간 입력 180분 전환, V1 전용 session 경계, legacy 결과와 `LegacyResults` 경로 분리, 대표/대안/두 빈 상태 분리, 저장·진행·자유 편집 비연결은 U-1 범위와 맞는다.
- `npm run test:typecheck`, `npm run test:ui` 통과와 `git diff --check` 기록은 확인했다.

### 수락하지 못한 부분

`CourseV1Journey`는 모든 이동 구간을 먼저 그리고 `course.stayMin`을 한 개의 활동 막대로 합산한다. 따라서 2~3곳 코스가 실제 순서인 `이동 → 1번 장소 체류 → 이동 → 2번 장소 체류 → … → 최종 이동 → 도착 여유`가 아니라 `이동 전체 → 활동 전체 → 여유`로 보인다. 이는 UIUX 공통 규칙과 UXV-35의 시간 여정 계약에 맞지 않는다.

현재 `VerifiedCourseV1`에는 총 `stayMin`만 있고 장소별 체류시간·운영시간 상태 스냅샷이 없다. UI가 카탈로그를 다시 읽어 체류를 나누면 엔진 결과를 재계산하는 것이므로 금지다. 따라서 이 문제는 UI의 표시 수정만으로 해결할 수 없으며, 먼저 추천 엔진의 공개 결과 계약을 보완해야 한다.

또한 새 UI 테스트는 소스 문자열과 대안 소비 순수 함수 중심이라, 실제 시간 여정 순서와 2·3곳 표시 모델을 보장하지 못한다. `npm test`는 `node --test test` 경로 해석 오류로 시작조차 하지 못했으므로 전체 회귀 통과로 기록할 수 없다.

### 다음 순서

1. 추천 엔진 세션이 장소별 체류·운영 상태를 포함한 V1 출력 계약을 추가한다.
2. 그 결과가 수락되면 UIUX 세션은 `CourseV1Journey`를 실제 순서 막대로 고치고, 1/2/3곳 fixture 기반 표시 모델 테스트를 추가한다.
3. QA·통합은 별도 범위에서 `npm test` 테스트 명령의 경로 해석 문제를 고친다. UIUX 세션은 이 문제를 우회해 테스트 스크립트를 임의로 바꾸지 않는다.

---

## 명령 U-1-A — UIUX 세션: 순서 있는 시간 여정과 회귀 경계 보완

2-G가 수락되어 `VerifiedCourseV1.stops`에 장소별 체류·운영 상태·정확 도착/출발 시각이 추가됐다. 다음은 **UIUX 세션**의 소유 작업이다.

1. `CourseV1Journey`를 `legs` 전체 뒤에 총 체류를 붙이는 표현에서 교체한다. `legs.length === stops.length + 1` 계약을 사용해 아래 순서로 렌더링한다.

   ```text
   leg[0] → stop[0].stayMin → leg[1] → stop[1].stayMin → … → leg[last] → arrivalBufferMin
   ```

   막대·접근성 라벨·시각 라벨은 `stops[].arrivalAt/departureAt`, `legs[].min`, `arrivalBufferMin`을 사용하며 체류·운영시간·구간 시간을 계산하거나 보정하지 않는다.
2. 결과와 코스 확인에서 1/2/3곳 모두 장소별 체류가 해당 장소 뒤에 보이는지 보장한다. `structured_verified`는 필요한 경우에만 간결한 사실 상태로 표시하며, 등급·내부 분류를 사용자에게 노출하지 않는다.
3. `CourseV1LimitedResult` UI fixture를 2-G 타입에 맞춰 `stops`까지 포함한다. 순서 있는 1/2/3곳 시간 여정, `stops`/`legs` 불일치 방어, 새 추천 대안 교체 뒤 시간 여정 교체를 순수 표시 모델 또는 렌더링 가능한 계약 테스트로 검증한다. 소스 문자열 검사만으로 완료 처리하지 않는다.
4. U-1에서 만든 UI 테스트로 인해 `npm test`가 깨진 두 항목을 UIUX 소유 범위에서 바로잡는다.
   - 120분을 요구하는 `test/map-transport-ui-contract.test.mjs`는 현행 180분 정책으로 갱신한다.
   - Node 기본 러너가 TypeScript 모듈을 직접 import하지 않도록 `course-v1-results-contract` 테스트의 실행 경계를 정리한다. `npm run test:ui`와 `npm test` 모두에서 같은 계약이 중복 실행되거나 모듈 해석 실패하지 않아야 한다.
   - `package.json` 테스트 명령 자체는 수정하지 않는다. 여전히 실패하면 정확한 파일·명령·오류를 기록하고 QA·통합으로 인계한다.
5. 저장·진행·조건부 수동 포함·앱 내 더보기 지도는 계속 범위 밖이다. `src/engine/`, `src/data/`, `src/services/`, DB 스키마를 수정하지 않는다.

### 완료 기준

- `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`가 모두 통과해야 한다.
- 변경 파일, 유지 경계, 테스트 결과, DB 스냅샷에 추가로 필요한 표시 필드가 있으면 이 문서에 기록한다.
- U-1-A 수락 뒤 통합·결정 세션이 실제 화면 체감 확인 범위와 DB·개인화 저장 계약의 다음 순서를 결정한다.

---

## 2026-08-24 — U-1-A 완료 기록

### 변경 파일 / 목적

- `src/ui/recommendation/courseV1JourneyModel.ts`, `src/ui/recommendation/CourseV1Journey.tsx`: 엔진의 `legs`·`stops` 스냅샷을 `이동 → 해당 장소 체류 → … → 최종 이동 → 도착 여유` 순서로 변환·표시한다. `legs.length !== stops.length + 1` 또는 장소 순서가 불일치하면 시간 여정을 추정·보정하지 않고 표시하지 않는다.
- `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: 대표 결과와 읽기 전용 코스 확인 모두 장소별 체류 시간을 해당 장소와 함께 표시하도록 바꿨다. `structured_verified` 내부 등급은 사용자에게 별도 노출하지 않는다.
- `test/ui/course-v1-journey.test.ts`: 1·2·3곳 고정 fixture의 순서, stops/legs 불일치 방어, 새 추천 뒤 다음 검증 코스의 시간 여정 교체를 순수 표시 모델로 검증한다. 기존 TypeScript import를 가진 `.mjs` 계약 테스트는 제거했다.
- `test/map-transport-ui-contract.test.mjs`: 120분·legacy 결과 화면 전제를 180분 V1 세션·대표 코스 전제로 갱신했다.
- `test/index.js`: `package.json`을 바꾸지 않고 `node --test test` 진입에서 TypeScript loader가 있는 전체 테스트 발견을 실행하도록 경계를 추가했다. 재귀 실행은 환경 표식으로 차단한다.

### 유지한 공개 계약·정책 경계

- `src/engine/`, `src/data/`, `src/services/`, DB 스키마는 수정하지 않았다. UI는 stop별 체류·운영 상태·도착/출발 시각을 계산하거나 카탈로그로 보정하지 않는다.
- 저장·진행, 조건부 수동 포함, 앱 내 더보기 지도는 여전히 U-1-A 범위 밖이다.
- DB 저장에 새로 요구되는 UI 표시 필드는 없다. 엔진의 `stops.placeId/stayMin/availabilityState/arrivalAt/departureAt` 스냅샷을 그대로 보존하면 된다.

### 검증 결과

- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 66개 통과. 1·2·3곳 순서 여정과 불일치 방어 fixture를 포함한다.
- `npm test`: 통과. 변경하지 않은 package script에서 TypeScript loader를 가진 전체 테스트 발견 경계를 실행한다.
- `git diff --check`: 통과.

### 다음 결정·위험

- 통합·결정 세션은 iOS 화면에서 1·2·3곳 막대의 최소 폭·줄바꿈·접근성 읽기 순서를 수동 확인할지 결정해야 한다.
- V1 저장 계약이 확정되기 전에는 현 읽기 전용 결과·코스 확인 화면에 저장/진행 CTA를 연결하지 않는다.

---

## 2026-08-24 — 통합·결정 검토: U-1-A 수락

- `CourseV1Journey`는 이제 엔진 `legs`와 `stops`를 `이동 → 해당 장소 체류 → … → 최종 이동 → 도착 여유` 순서로만 렌더링하고, 불일치 시 추정하지 않는 것을 확인했다.
- 독립 실행 `npm test`는 70/70 통과했다. 1/2/3곳 시간 여정·불일치 차단·대안 교체는 UI 테스트 66개에 포함되며, 타입·형식 검사도 완료 기록상 통과했다.
- `test/index.js`의 TypeScript loader 발견 경계는 현 `package.json` 제약 아래의 임시 호환 계층이다. 기능 정책을 바꾸지는 않지만, 테스트 실행 시간이 늘어날 수 있으므로 QA가 테스트 도구를 정비할 때 단일 러너로 정리한다.

### 아직 남은 UI 정책

결과·코스 확인에는 장소명만 표시되고, 현행 UIUX 공통 규칙 0-1 및 UXV-40이 요구하는 사실 기반 `지역명 + 활동 유형`이 아직 없다. 이는 시간 여정과 별개의 사용자 가치(부산의 계획 밖 장소 발견)를 전달하는 필수 표시이므로 다음 명령에서 보완한다.

---

## 명령 U-1-B — UIUX 세션: 부산 발견 맥락 표시 보완

**목표:** 대표 결과와 읽기 전용 코스 확인에서 각 장소의 제목만 나열하지 않고, 최신 런타임 카탈로그에 근거한 `지역명 + 활동 유형`을 함께 표시한다.

1. UI는 `placeIds`로 카탈로그의 표시 전용 지역·활동 데이터를 조회한다. 이 조회는 체류·운영시간·경로·코스 순서를 계산하거나 바꾸지 않는다.
2. 대표 카드에는 코스 전체의 발견 맥락 한 줄을, 코스 확인의 각 stop에는 해당 장소의 지역명과 사용자 친화 활동 유형을 표시한다. 데이터에 없는 경우에는 추정 문구 대신 제목만 표시한다.
3. `처음 가보는`, `숨은`, `인기`, 소비 유도, GPS 방문·외부 소비 이력 기반 문구는 넣지 않는다. 내부 `core/standard` 등급도 노출하지 않는다.
4. 지역·활동 있음/없음 fixture의 UI 계약 테스트를 추가해 사실 기반 문구만 보이는지, 시간 여정·대안·빈 상태가 바뀌지 않는지 검증한다. UXV-40과 UX-24에 근거를 연결한다.
5. 엔진·data·API adapter·DB·저장/진행은 수정하지 않는다. 완료 시 전체 테스트와 변경 경계를 이 문서에 남긴다.

---

## 2026-08-24 — U-1-B 완료 기록

### 변경 파일 / 목적

- `src/ui/recommendation/courseV1DiscoveryContext.ts`: 런타임 카탈로그의 주소에서 실제 `구/군` 지역명을 읽고, 검토된 `shortStay.type`만 사용자 친화 활동명으로 바꾸는 표시 전용 모델을 추가했다. 둘 중 하나라도 없거나 알 수 없으면 맥락을 만들지 않는다.
- `src/ui/ResultsScreen.tsx`: 대표 카드에 방문 순서의 `지역명 · 활동 유형`을 한 줄로 표시한다. 카탈로그 표시는 시간 여정·대안·빈 상태·추천 결과를 변경하지 않는다.
- `src/ui/CourseConfirmScreen.tsx`: 읽기 전용 각 stop의 제목 아래에 해당 장소의 발견 맥락을 표시하고, 근거가 없는 stop은 제목과 체류시간만 유지한다.
- `test/ui/course-v1-discovery-context.test.ts`: 지역·활동 근거 있음/없음 fixture, 코스 순서 보존, `UXV-40`·`UX-24`의 근거 없는 편집 문구 미노출을 UI 표시 모델로 검증한다.

### 유지한 공개 계약·정책 경계

- `src/engine/`, `src/data/`, `src/services/`, DB 스키마와 저장·진행 흐름은 수정하지 않았다. 카탈로그 조회는 표시 전용이며 체류·운영시간·경로·장소 순서를 계산하거나 보정하지 않는다.
- `처음 가보는`, `숨은`, `인기`, 소비 유도, GPS 방문·외부 소비 이력, 내부 `core/standard` 등급은 새 화면 문구와 표시 모델에 추가하지 않았다.
- `docs/테스트.md`의 `UX-24` 상태 집계는 통합·결정 소유이므로 직접 갱신하지 않았다. 해당 자동 검증 근거는 위 UI 테스트 ID에 연결했다.

### 검증 결과

- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 69개 통과. U-1-B 발견 맥락 UI 표시 모델 3개를 포함한다.
- `npm test`: 통과.
- `git diff --check`: 통과.

### 다음 결정·위험

- `UXV-40`은 자동 표시 모델로는 검증됐지만, iOS 실기기에서 긴 지역·활동 문구의 줄바꿈과 VoiceOver 읽기 순서 확인이 남아 있다.
- 저장 계약이 확정되기 전에는 현재 읽기 전용 결과·코스 확인 화면에 저장·진행 CTA를 연결하지 않는다.

---

## 2026-08-24 — 통합·결정 검토: U-1-B 수락

- 결과 카드의 코스 전체 맥락과 코스 확인의 stop별 맥락은 런타임 카탈로그의 `addr1` 및 검토된 `shortStay.type`만 읽는 표시 전용 모델임을 확인했다. 둘 중 하나라도 없으면 생략하므로 근거 없는 지역·활동 추정이 없다.
- `처음 가보는`, `숨은`, `인기`, 소비 유도, 내부 후보 등급은 구현과 테스트의 허용 문구에 포함되지 않는다. 코스 순서·체류·운영시간·경로·대안 계산도 변경하지 않았다.
- 독립 재검증 결과 `npm run test:typecheck` 통과, `npm run test:ui` 69개 통과, `npm test` 70개 통과, `git diff --check` 통과다. 이에 따라 UX-24와 UXV-40은 자동 표시 모델 기준으로 `부분` 상태로 갱신했다.

### 다음 순서

1. 실제 체감 확인을 우선한다면 QA·UIUX 세션이 1/2/3곳 코스와 긴 `구/군 · 활동 유형` 입력으로 iOS 실기기에서 줄바꿈·VoiceOver·새 추천 교체를 확인한다.
2. 저장·진행이 필요한 단계로 넘어갈 때에만 DB·개인화 세션이 V1 검증 코스 스냅샷의 저장 계약을 먼저 설계한다. 그 전에는 CTA를 연결하지 않는다.

---

## 2026-08-25 — 통합·결정 지시 U-1-E: 대표와 검증 대안 목록 결과 화면

**담당:** UIUX 세션 (`src/ui/`, UI 테스트). **선행 조건:** 2-I가 `representativeCourse`, 비중첩 `alternativeCourses`, 각 코스의 `remainingAfterCourseMin` 공개 계약과 fixture를 인계한 뒤 시작한다. 엔진·카탈로그·외부 API adapter·DB는 수정하지 않는다.

### 목표

사용자가 하나의 코스만 보고 판단하지 않도록 결과 화면을 상단 `시간의 추천`과 하단 `이 시간에 가능한 다른 코스` 목록으로 재구성한다. 화면 요소를 늘리기보다, 대표은 충분한 맥락으로, 대안은 비교 가능한 요약으로 보여 준다.

1. 기존의 순차 `새 추천` 교체 UI를 제거한다. 같은 추천 세션에서 받은 대표과 대안 목록을 첫 결과에 함께 렌더링하며, 목록 렌더·선택은 엔진이나 route adapter를 다시 호출하지 않는다.
2. 상단 대표 카드에는 장소 순서, 실제 시간 여정, 각 장소의 사진/플레이스홀더·지역/활동 맥락, **권장 체류**, 도착 여유 및 `남는 시간`을 보인다. `최대 가능 체류`, 내부 등급·점수·후보 수는 노출하지 않는다.
3. 하단 목록은 코스마다 장소명/장소 수, 실제 총 소요 또는 종료 시각, 권장 체류 기준의 남는 시간, 간결한 지역·활동 맥락만 보여 준다. 목록 항목을 선택하면 해당 검증 코스의 읽기 전용 확인 화면으로 이동하고, 선택한 코스의 원본 legs/stops/remaining 값을 그대로 쓴다.
4. 3곳 코스는 목록에서 숨기거나 시각적으로 오류처럼 다루지 않는다. 대표 카드의 3곳은 엔진이 1·2곳 fallback으로 반환한 경우만 표시한다. 대안 없음은 짧고 정직하게 `이 조건에서 다른 검증 코스가 없어요`로 보이며, 무한 새로고침 CTA를 제공하지 않는다.
5. 시간 막대는 이동 → 장소별 권장 체류 → 이동 → 도착 여유 → **남는 시간** 순서를 실제 엔진 스냅샷대로 표시한다. 남는 시간은 사용자가 더 머무르거나 이후 다른 추천을 받는 선택 여지임을 과도한 설명문 없이 상태 라벨로 전달한다. UI는 합계·최대 체류·시간을 추정·보정하지 않는다.
6. 고정 fixture 기반 UI 계약을 먼저 추가한다: 대표 1곳+대안 2/3곳, 대표 2곳+3곳 대안, 1/2곳 없음인 3곳 fallback 대표, 대안 없음, 남는 시간 0이 아닌 코스, 대안 목록 표시·선택 동안 engine/adapter 호출 0회, 사진 없음/카카오 CTA 유지, VoiceOver 라벨. 기존 순차 새 추천 fixture는 철회 이력으로 남기되 현행 통과 기준으로 쓰지 않는다.
7. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. iOS 수동 확인에는 긴 장소명, 1/2/3곳, 남는 시간 막대 폭, 목록 스크롤, VoiceOver 읽기 순서를 기록한다.

### 완료 기준

- 화면에서 사용자가 대표 하나와 다른 검증 코스를 한 화면에서 비교할 수 있고, 시간·경로는 모두 엔진의 실제 검증 스냅샷만 사용한다.
- `새 추천`의 순환·재호출 행동과 최대 체류시간 노출이 남아 있지 않다.
- 변경 파일 / 유지한 엔진·데이터·adapter·DB 경계 / 테스트 결과 / iOS 수동 확인 결과 / 다음 결정이 필요한 UX를 이 문서 끝에 기록한다.

---

## 2026-08-25 — U-1-E 완료: 대표와 검증 대안 목록 결과 화면

### 변경 사항

- `src/ui/ResultsScreen.tsx`를 `시간의 추천` 대표 카드와 `이 시간에 가능한 다른 코스` 목록으로 재구성했다. 순차 `새 추천` 교체 CTA를 제거했으며, 대표·대안 모두 최초 결과의 검증 스냅샷만 표시한다.
- `src/ui/recommendation/courseV1ResultListModel.ts`에 목록 표시·선택 모델을 추가했다. 대안 선택은 원본 `VerifiedCourseV1`의 `legs`, `stops`, `remainingAfterCourseMin`을 변경 없이 `CourseConfirm`에 전달한다.
- `src/ui/CourseConfirmScreen.tsx`, `src/ui/nav.ts`는 대표 코스에 다시 의존하지 않고 선택된 검증 코스를 읽기 전용으로 받도록 변경했다.
- `src/ui/recommendation/courseV1JourneyModel.ts`, `CourseV1Journey.tsx`는 이동 → 권장 체류 → 이동 → 도착 여유 → 남는 시간 순서의 rail과 VoiceOver 레이블을 렌더링한다. 남는 시간·총 소요는 엔진 스냅샷 값을 표시하며 UI에서 합계·체류·종료시각을 보정하지 않는다.
- `test/ui/course-v1-results-list.test.ts`에 1/2/3곳 대표·대안, 3곳 fallback, 대안 없음, 남는 시간, 원본 스냅샷 보존, VoiceOver 요약 fixture를 추가했다. 이전 순차 `새 추천` fixture는 `test/ui/course-v1-journey.test.ts`에 `skip`된 철회 이력으로 남겼다. 사진 없음에서도 카카오 CTA가 유지되는 기존 fixture도 계속 통과한다.

### 유지한 경계

- 엔진의 대표/비중첩 대안 선택, 경로·운영시간·체류·남는 시간 계산은 변경하지 않았다.
- 카탈로그, 외부 API adapter, DB·저장 계약은 수정하거나 호출하지 않았다. 목록 렌더·선택은 UI 표시 모델만 사용한다.

### 검증 결과

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 80개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `npx expo export --platform ios` 통과.
- `git diff --check` 통과.

### iOS 수동 확인

- **미실행(환경 차단):** 2026-08-25에 `CoreSimulatorService`가 연결 거부되어 사용 가능한 시뮬레이터를 조회할 수 없었다. 따라서 긴 장소명, 1/2/3곳 rail 폭, 대안 목록 스크롤, VoiceOver 읽기 순서는 실기기 또는 복구된 시뮬레이터에서 확인이 필요하다.

### 다음 결정·위험

- 수동 확인 후 작은 화면에서 3곳 대표의 rail 최소 폭과 긴 장소명의 줄바꿈이 비교 행동을 방해하는지 판단한다. 문제가 확인되면 정보 우선순위(rail 라벨 축약 또는 카드 간격)를 UIUX에서 조정하되, 엔진 스냅샷 계약은 유지한다.

---

## 2026-08-25 — 통합·결정 검토: U-1-E 조건부 수락

- 상단 `시간의 추천`과 하단 검증 대안 목록, 순차 `새 추천` 제거, 선택한 원본 코스 스냅샷 전달, 시간 여정의 남는 시간 구간은 U-1-E 요구와 맞는다. 최대 체류시간을 화면에 추가하지 않은 것도 확인했다.
- 다만 UI 테스트는 표시 모델 중심이며 실제 작은 iOS 화면의 rail 폭·긴 장소명 줄바꿈·목록 스크롤·VoiceOver 읽기 순서는 미검증이다. `CoreSimulatorService` 연결 실패로 수동 확인도 수행되지 않았다. 따라서 화면 정책의 **조건부 수락**으로 둔다.
- `CourseV1Journey`의 남는 시간 구간과 대표 카드 하단의 `남는 시간 N분` 문구는 같은 값을 두 번 보여 준다. 이는 기능 오류는 아니나, 작은 화면에서 정보가 과해질 수 있다. iOS 확인에서 중복이 체감상 불필요하면 rail의 상태 라벨 또는 카드 하단 문구 중 하나만 남기는 소규모 UI 보완으로 처리한다. 엔진 시간값을 재계산해서는 안 된다.

---

## 2026-08-25 — 통합·결정 지시 U-1-E-R: 결과 정보밀도와 실기기 확인 보완

**담당:** UIUX 세션 (`src/ui/`, UI 테스트). 엔진·카탈로그·외부 API adapter·DB·QA 테스트 명령은 수정하지 않는다.

1. 대표 카드의 별도 `남는 시간 N분` 문구를 제거하고, `CourseV1Journey`의 마지막 보라색 `남는 시간` 구간·접근성 라벨만 남긴다. 같은 시간값을 두 위치에 반복하지 않는다. 대안 목록은 비교용 요약이므로 각 항목의 남는 시간 표시는 유지한다.
2. 2-I-R이 대표·대안 결과를 바꿔도 UI가 장소 수나 시간값을 추정하지 않고 `representativeCourse`·`alternativeCourses`·`remainingAfterCourseMin` 원본 스냅샷을 그대로 렌더링하는지 fixture로 확인한다. 넓은 한 곳 대표/대안 fixture를 화면이 별도 예외 없이 처리해야 한다.
3. 시뮬레이터 또는 실기기에서 고정 fixture로 다음을 수동 확인하고 캡처 또는 재현 기록을 남긴다: 1곳 대표+대안, 2곳 대표+3곳 대안, 3곳 fallback 대표, 긴 장소명, 남는 시간 rail, 대안 목록 스크롤, VoiceOver 읽기 순서, 사진 없음·카카오맵 외부 전환. `CoreSimulatorService`가 다시 실패하면 실패 원문·시각만 기록하고 통과로 처리하지 않는다.
4. `새 추천`, 최대 체류시간, UI가 계산한 남는 시간, 목록 표시·선택 중 engine/adapter 재호출이 다시 생기지 않도록 UI 계약 테스트를 갱신한다.
5. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `npx expo export --platform ios`, `git diff --check`를 실행한다.

**완료 기준:** 대표에는 남는 시간 정보가 한 번만 보이고, 1/2/3곳 및 넓은 한 곳 fixture가 동일한 화면 계약으로 표시되며, 수동 확인 결과 또는 재현 가능한 환경 차단 기록이 남아야 한다. 변경 파일 / 유지 경계 / 테스트 결과 / iOS 확인 결과 / QA-01에 넘길 fixture를 이 문서에 기록한다.

---

## 2026-08-25 — U-1-E-R 완료: 결과 정보밀도와 실기기 확인 보완

### 변경 파일·목적

- `src/ui/ResultsScreen.tsx`: 대표 카드 하단의 중복 `남는 시간 N분`을 제거했다. 대표의 남는 시간은 `CourseV1Journey` 마지막 보라색 rail·VoiceOver 레이블에서 한 번만 표시한다. 대안 목록의 비교용 요약은 유지했다.
- `test/ui/course-v1-results-list.test.ts`: 긴 장소명을 가진 넓은 1곳 대표와 대안을 별도 예외 없이 표시하며, `totalMin`·`remainingAfterCourseMin`·선택 코스 참조가 원본 스냅샷과 같은지 확인하는 fixture를 추가했다.
- `test/map-transport-ui-contract.test.mjs`: 대표 카드가 `remainingAfterCourseMin`을 별도로 반복 표시하지 않고, 순차 `새 추천`·재호출 경로를 다시 포함하지 않는 소스 계약을 추가했다.

### 유지한 경계

- 대표/대안 선택, 1·2·3곳 우선순위, `remainingAfterCourseMin` 계산, 실제 경로·운영시간·체류 정책은 엔진 스냅샷을 그대로 사용하며 변경하지 않았다.
- 카탈로그, 외부 API adapter, DB, QA 테스트 명령은 수정하거나 결과 목록 표시·선택 중 호출하지 않았다.

### 자동 검증

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 81개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `npx expo export --platform ios` 통과.
- `git diff --check` 통과.

### iOS 수동 확인·환경 차단 기록

- **미실행(통과 처리하지 않음):** 2026-08-25 18:03:18 KST, `xcrun simctl list devices available` 실행이 `CoreSimulatorService connection became invalid` 및 `Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 (Connection refused)`로 실패했다. 따라서 1/2/3곳·긴 장소명·rail 폭·대안 목록 스크롤·VoiceOver 순서·사진 없음 카카오맵 전환의 캡처/수동 확인은 남아 있다.

### QA-01 인계 fixture

- `test/ui/course-v1-results-list.test.ts`: 대표 1곳 + 대안 2/3곳, 대표 2곳 + 대안 3곳, 3곳 fallback 대표, 대안 없음, 넓은 1곳/긴 장소명, 비영(0) 남는 시간, 원본 `legs/stops/remaining` 보존, 목록 표시·선택의 engine/adapter 호출 0회.
- `test/ui/course-v1-journey.test.ts`: 1/2/3곳 rail 순서와 남는 시간 마지막 구간, `legs/stops` 불일치 차단.
- `test/ui/course-v1-place-preview.test.ts`: 사진 없음에도 카카오맵 CTA·접근성 문구가 유지되는지 확인.

### 다음 결정·위험

- 시뮬레이터 서비스 복구 또는 실기기 확보 뒤 위 QA-01 fixture를 주입해 캡처와 VoiceOver 읽기 순서를 검증해야 한다. 특히 작은 iPhone에서 3곳 rail의 최소 폭과 긴 장소명 줄바꿈이 대안 비교를 방해하면 UIUX에서만 라벨·간격을 조정한다.

---

## 2026-08-26 — 통합·결정 지시 U-1-F: 출발지 검색 정확도 보완

**목표:** 사용자가 `사상역`처럼 장소명을 입력했을 때 무관한 상점이 자동 선택돼 추천 출발지가 바뀌는 일을 차단한다.

1. Kakao Local·TMAP·주소 결과를 병합한 뒤, 제목·별칭·주소의 정규화 검색어 일치도를 기준으로 정렬한다. 제공사 원래 순서나 중심 좌표만으로 첫 항목을 선택하지 않는다.
2. 검색 결과가 나온 직후 첫 항목을 자동 선택하지 않는다. 사용자가 목록의 하나를 명시 선택해야 `이 위치로 확정` 행동이 가능하다. 단, 현재 위치 사용은 별도 명시 행동으로 유지한다.
3. 완전 일치 또는 역/정류장 등 장소 유형 일치 결과가 있으면 무관한 상호·주소 결과보다 위에 둔다. 관련성 근거가 부족한 결과는 자동 확정 후보로 만들지 않는다.
4. 고정 provider fixture로 `사상역`, 일반 주소, 동명 상점, 결과 없음, Kakao 실패 후 TMAP fallback, 현재 위치 사용을 검증한다. `사상역` 입력 뒤 무관한 음식점이 확정 CTA에 나타나지 않아야 한다.
5. 추천 엔진·카탈로그·외부 API 호출량 정책·DB는 수정하지 않는다. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check` 결과와 수동 재현 절차를 기록한다.

---

## 2026-08-26 — U-1-F 완료: 출발지 검색 정확도 보완

### 변경 파일·목적

- `src/ui/placeSearchRanking.ts`: 제목·주소의 정규화 일치도를 기준으로 검색 결과를 정렬하는 순수 UI 모델을 추가했다. 완전 일치, 주소 일치, 역/출구 등 제목 접두 일치를 우선하고 `맛집`·`카페` 등 상호성 결과는 뒤로 보낸다. 제공사 응답 순서와 중심 좌표는 순위 근거로 쓰지 않는다.
- `src/ui/PlacePicker.tsx`: 검색 후 선택값을 항상 비워 두고 `목록에서 위치를 선택하세요`를 보인다. 따라서 사용자가 행을 고르기 전에는 `이 위치로 확정` CTA가 활성화되지 않는다. 현재 위치 사용은 사용자의 별도 명시 행동이므로 기존처럼 선택·확정 가능하다.
- 같은 파일에서 Kakao POI/주소 조회가 실패해도 TMAP POI와 주소 fallback을 계속 시도하도록 화면의 실패 처리를 분리했다. 외부 API 요청 수·키·캐시·응답 계약은 변경하지 않았다.
- `test/ui/place-search-ranking.test.ts`: `사상역`과 동명 음식점, 일반 주소, Kakao 실패 후 TMAP fallback 형태, 동명 결과, 결과 없음, 명시 선택 전 상태를 고정 fixture로 검증한다.
- `test/map-transport-ui-contract.test.mjs`: 관련성 정렬·자동 선택 금지·명시 선택 안내가 화면 계약에 남도록 추가했다.

### 유지한 경계

- 추천 엔진, 장소 카탈로그, API adapter의 호출량·캐시·키 정책, DB는 수정하지 않았다.
- 검색 결과의 좌표·라벨은 사용자가 선택한 제공사 원본 `Poi`에서만 전달하며, UI가 추천 출발지나 좌표를 추정·보정하지 않는다.

### 검증 결과

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 84개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `git diff --check` 통과.

### 수동 재현 절차

1. `자투리 시간 설정 → 현재 위치 → 장소 이름 또는 주소로 검색`에서 `사상역`을 검색한다.
2. 첫 결과가 `사상역`/출구 등 역 일치 결과인지 확인하고, `사상역 맛집` 등 무관 상호가 자동 선택되지 않았으며 CTA가 `위치를 선택하세요`로 비활성인지 확인한다.
3. 역 행을 명시 선택한 뒤에만 `이 위치로 확정 — 사상역`이 활성화되는지 확인한다.
4. 일반 주소, 결과 없음, 네트워크에서 Kakao 실패 후 TMAP 결과만 남는 경우를 같은 방식으로 확인한다. 출발지 검색의 `현재 위치 사용`은 누른 뒤에만 GPS 선택·확정되는지 확인한다.

### 다음 결정·위험

- 현재 `Poi` 공개 계약에는 제공사 종류·역/정류장 타입·별칭 필드가 없다. 제목·주소 문자열 근거로 정렬하므로, 제공사가 구조화된 장소 유형·별칭을 제공하도록 계약을 확장할 필요가 생기면 외부 API 어댑터 세션에서 설계해야 한다. UI는 그 계약 전까지 자동 확정을 계속 금지한다.

---

## 2026-08-26 — 통합·결정 지시 U-1-F-R: 장소명 검색 계약 재보완

**관찰:** U-1-F는 자동 선택을 없앴지만, `사상역` 검색에 주소 지오코딩 및 무관 상호가 결과 목록에 여전히 섞인다. 이는 사용자가 일반 지도 앱처럼 기대하는 “입력한 장소 이름의 결과를 고르는” 경험과 다르며, 관련성 정렬만으로 해결할 문제가 아니다.

**확정 정책:** 출발지·도착지는 주소 입력기가 아니라 장소명 선택기다. 실시간 자동완성은 제공사 호출량을 늘릴 수 있으므로 이번 단계에서 요구하지 않는다. 사용자가 검색 버튼 또는 키보드 검색을 실행했을 때만 장소 검색을 한 번 요청한다.

1. `PlacePicker`의 기본 검색 결과는 장소명 POI만 사용한다. `kakaoGeocodeAddr`·TMAP 주소 지오코딩 결과를 기본 목록에 병합하거나, 장소 결과가 없을 때 조용히 주소 목록으로 바꾸지 않는다. 주소를 별도 기능으로 다시 도입하려면 통합·결정의 별도 정책 결정과 명시적 모드/라벨이 필요하다.
2. 검색어가 `사` → `사상` → `사상역`처럼 바뀌는 즉시 이전 `cands`와 선택값을 비우고 확정 CTA를 비활성화한다. 새 결과는 검색 버튼 또는 `onSubmitEditing` 후에만 표시한다. 따라서 타이핑 자체가 네트워크 요청을 만들지 않는다.
3. 결과는 정규화된 장소명·공식 별칭(계약에 있을 때)으로 검색어와 관련된 항목만 보인다. 주소 일치만으로 들어온 행, 검색어와 무관한 상호, 임의 주소 문자열은 제외한다. `사상역`의 경우 역·출구 등 이름 관련 장소만 보이며, 결과가 없으면 정직하게 `장소명 결과가 없어요`를 표시한다.
4. 사용자가 결과 행 하나를 명시 선택한 뒤에만 `이 위치로 확정 — {선택 장소명}`을 활성화한다. 현재 위치 사용은 별도 명시 행동이므로 유지한다. `사`처럼 짧은 검색어 결과는 관련 이름 결과로 제한하되, 자동 확정하지 않는다.
5. UI 순수 모델/contract fixture를 먼저 작성한다: `사`, `사상`, `사상역`, 동명 상호, 주소만 일치하는 결과, 빈 결과, Kakao 실패 후 TMAP 장소 fallback, 입력 변경 뒤 stale 선택, 현재 위치 사용. 다음을 검증한다: 주소 행 미노출, 무관 상호 미노출, 검색 실행 전 외부 호출 0회, 입력 변경 후 CTA 비활성, 명시 선택 뒤에만 정확한 장소명으로 확정.
6. 외부 API 어댑터의 키·일일 예산 정책, 추천 엔진·카탈로그·DB는 수정하지 않는다. 현재 adapter가 장소명 API와 주소 API를 분리하기 어렵거나 제공사 응답에서 이름 관련성 필드를 주지 않으면, UI에서 우회 구현하지 말고 필요한 최소 공개 계약을 인계한다.
7. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행하고, 시뮬레이터/실기기에서 `사상역`과 동명 상호를 수동 재현한다. 변경 파일 / 유지한 경계 / 테스트 결과 / 실제 요청 수 / 남은 API 계약 위험을 이 문서 끝에 기록한다.

**완료 기준:** `사상역`을 검색해도 주소·무관 상호가 기본 목록이나 확정 CTA에 나타나지 않으며, 사용자가 검색 실행 뒤 장소명을 직접 고른 경우에만 해당 이름으로 출발지/도착지가 확정된다. UXV-06·UX-25 자동 근거와 수동 재현 기록이 남아야 한다.

### 보류 인계 — API-S-1 결과 뒤 UIUX 재확인

현재 화면에서 `장소명 결과가 없어요`가 보이는 것은 실제 빈 결과인지 adapter 실패인지 구별할 수 없다. API-S-1이 장소명 검색 상태 계약을 제공한 뒤에만 아래를 수행한다: 성공+필터 0개에만 현재 빈 문구를 쓰고, 설정/권한/쿼터/네트워크 오류에는 재시도 가능한 별도 상태를 표시한다. `사상역` 성공 fixture에서 목록이 나타나는지, 실패 fixture에서 빈 결과로 오인하지 않는지 확인한다. UIUX는 API 키·제공사 원문 오류·사용자 검색어를 표시하거나 기록하지 않는다.

---

## 2026-08-26 — 통합·결정 지시 U-1-F-R2: 성공한 장소명 POI의 필터 탈락 재현·수정

**확정 관찰:** 시뮬레이터에서 `사상역` 검색 시 개발 진단이 `kakao ok 5`를 기록했다. 이는 Kakao 키·권한·네트워크·Expo 공개 환경변수 주입 문제가 아니라, 앱이 POI 다섯 개를 수신한 뒤 화면 목록을 만들지 못한다는 뜻이다. 현 `PlacePicker` 흐름에서 `장소명 결과가 없어요`는 `rankPlaceSearchResults()`의 최종 목록이 0개일 때만 표시된다.

1. 먼저 `rankPlaceSearchResults()`를 순수 진단 모델로 확장해 **입력 수, 정확/접두/포함 일치 수, 주소형 제외 수, 무관 상호 제외 수, 최종 수**만 개발 fixture에서 확인한다. 실제 검색어, 장소명·주소 원문, 좌표, API 키는 콘솔·테스트 산출물에 기록하지 않는다.
2. Kakao 성공 5개를 대표하는 공개·고정 fixture를 추가한다. 이 fixture에는 `사상역` 정확 일치, `사상역 부산2호선`/출구 같은 이름 관련 결과, 주소만 `사상역`인 무관 상호를 함께 둔다. 정확 일치와 이름 관련 역 결과는 반드시 남고, 주소 일치만인 무관 상호는 제거됨을 먼저 실패하는 테스트로 고정한다.
3. 진단 결과가 주소형 정규식·상호 단어 필터의 오판이면, 정확 일치와 역/출구 이름 일치를 **제외 규칙보다 먼저** 통과시킨다. 검색어와 장소명이 정규화해 직접 일치/포함하지 않는 주소 행·무관 상호를 허용하는 방식으로 고치지 않는다.
4. 진단 결과가 순수 필터는 통과하지만 화면이 빈 경우에는 `requestId` 경쟁, `setCands`/`setMsg` 순서, 검색 중 입력 변경을 고정 UI fixture로 재현해 수정한다. 이전 요청의 늦은 응답이 최신 입력 결과를 덮지 않아야 하며, 성공 결과가 있으면 빈 문구를 쓰지 않는다.
5. API-S-1의 상태형 계약을 화면에 연결한다. 양 제공사가 성공했고 최종 이름 목록만 0개일 때 `장소명 결과가 없어요`; 그 외 `unconfigured`/HTTP/쿼터/네트워크/형식 실패는 재시도 안내로 표시한다. 제공사 상태 코드·키·검색어·원문 오류는 사용자에게 노출하지 않는다.
6. `사`, `사상`, `사상역`, 동명 상호, 주소만 일치, Kakao 성공+TMAP 실패, 입력 변경 중 늦은 응답, 양 제공사 실패 fixture를 검증한다. 시뮬레이터에서 `사상역` 검색 후 최소 하나의 이름 관련 행이 보이고, 선택 뒤에만 확정 CTA가 켜지는 수동 재현을 남긴다.
7. 추천 엔진·카탈로그·외부 API 키/쿼터 정책·DB는 바꾸지 않는다. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행하고 변경 파일 / 유지 경계 / 진단의 **개수만** / 테스트 / 수동 재현 결과를 기록한다.

**완료 기준:** `kakao ok 5` 같은 성공 상태에서 `사상역`의 이름 관련 결과가 1개 이상 목록에 보이며, 주소만 일치한 무관 행은 보이지 않는다. 실제 0개와 제공사 실패가 서로 다른 상태로 표시되고 UXV-06·UX-25의 자동·수동 근거가 남아야 한다.

---

## 2026-08-26 — U-1-F-R 완료: 장소명 검색 계약 재보완

### 이전 방식 → 문제 → 교체 방식

- **이전 방식:** U-1-F는 Kakao·TMAP POI와 주소 지오코딩 결과를 병합한 뒤 정렬했다.
- **문제:** 주소 지오코딩과 동명 상호가 목록에 남아 장소명 선택기 기대를 충족하지 못했다. 일부 제공사는 주소 결과를 `name` 필드에도 넣어 단순 이름 포함 검사만으로는 차단되지 않았다.
- **교체 방식:** `PlacePicker` 기본 목록은 Kakao/ TMAP **POI만** 사용하며, 정규화한 장소명 관련 결과만 남긴다. 도로명·번지 형태의 `name`, 주소만 일치한 행, `맛집`·`카페` 등 상호성 결과는 제외한다. 입력 변경 즉시 목록·선택·CTA와 이전 요청을 무효화하고, 사용자가 검색 버튼/키보드 검색을 실행할 때만 새 요청을 시작한다.
- **이유·상태:** 출발지/도착지를 주소 입력기가 아닌 명시적 장소명 선택기로 유지하기 위함이다. 주소 모드는 통합·결정의 별도 정책 전까지 **미도입**이다.

### 변경 파일

- `src/ui/PlacePicker.tsx`: 주소 지오코딩을 기본 검색 흐름에서 제거하고, 입력 변경 시 stale 후보·선택·진행 중 응답을 무효화했다. 결과 행을 명시 선택하기 전까지 확정 CTA는 비활성이다. 현재 위치 사용은 별도 명시 행동으로 유지했다.
- `src/ui/placeSearchRanking.ts`: 장소명 관련 POI만 정렬·반환하도록 수정하고, 제공사가 `name`으로 반환한 도로명·번지 형식도 제외했다.
- `test/ui/place-search-ranking.test.ts`: `사`·`사상`·`사상역`, 역/출구, 동명 상호, 주소만 일치한 행, 빈 결과, TMAP fallback, 자동 선택 금지를 고정 fixture로 검증했다.
- `test/map-transport-ui-contract.test.mjs`: 입력 변경 뒤 후보 초기화, 장소명 결과 없음, 기본 검색에서 주소 지오코딩 미호출을 화면 계약으로 추가했다.

### 유지한 경계·요청 수

- 추천 엔진·카탈로그·DB·외부 API adapter의 키·일일 예산·캐시·호출량 정책은 변경하지 않았다.
- 고정 UI fixture 실행 중 실제 외부 요청은 **0회**다. 사용자의 명시 검색 1회에서만 기존 POI 호출 경계를 사용하며, Kakao 실패/관련 POI 부족 시에만 기존 TMAP POI fallback을 시도한다. 타이핑·입력 변경 자체는 외부 요청을 만들지 않는다.

### 검증·수동 재현

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 84개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `git diff --check` 통과.
- **수동 확인 미실행(통과 처리하지 않음):** 2026-08-26 00:34:26 KST, `xcrun simctl list devices available`가 `CoreSimulatorService connection became invalid` 및 `Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 (Connection refused)`로 실패했다.
- 수동 재현 시 `사상역`을 검색해 역/출구만 표시되고 `사상역 맛집`·`사상역로 N` 주소 행이 없는지, 입력을 `사상`으로 바꾼 즉시 CTA가 `위치를 선택하세요`로 돌아가는지, 행을 직접 선택한 뒤에만 정확한 장소명으로 확정되는지 확인한다.

### 남은 API 계약 위험

- 현재 `Poi` 공개 계약에는 공식 별칭과 구조화된 장소 유형(역/정류장 등)이 없다. UI는 문자열 근거 밖의 결과를 자동으로 승격하지 않는다. 별칭·유형 기반 검색을 요구하면 외부 API 어댑터 세션이 최소 공개 계약을 정의해야 한다.

---

## 2026-08-26 — U-1-F-R2 완료: 성공 POI 필터 탈락 진단·상태 분리

### 이전 방식 → 문제 → 교체 방식

- **이전 방식:** 장소명 필터는 최종 목록만 반환했고, 화면은 빈 목록을 모두 `장소명 결과가 없어요`로 표시했다.
- **문제:** `kakao ok 5`처럼 제공사가 성공한 경우에도 정확 일치·역 관련 이름이 주소형/상호 필터보다 먼저 통과하는지 확인할 수 없었고, 실제 빈 결과와 제공사 실패가 같은 경험으로 보였다.
- **교체 방식:** 순수 `diagnosePlaceSearchResults`가 결과와 함께 입력·일치·제외·최종 **개수만** 반환한다. 정확 일치는 주소형·상호 제외보다 먼저 보존하고, 접두·포함 이름 일치만 다음 후보로 둔다. 화면은 API-S-1 상태 계약을 사용해 양 제공사 성공 + 최종 0개만 빈 상태로, 그 밖의 실패는 재시도 안내로 분리한다.
- **이유·상태:** 성공한 장소명 POI가 UI 필터에서 사라지는 회귀를 개인정보·키·원문 데이터 없이 고정 fixture로 재현하고, 실패를 빈 결과로 오인하지 않기 위함이다. **현행**.

### 변경 파일·목적

- `src/ui/placeSearchRanking.ts`: 순수 진단 모델과 카운트 계약을 추가했다. 정확 일치는 제외 규칙보다 먼저 남기고, 주소형 이름·무관 상호는 직접 이름 일치가 없을 때만 제외한다.
- `src/ui/placeSearchStateModel.ts`: Kakao·TMAP의 공개 상태와 최종 개수로 `results`/`empty`/`retry` 화면 상태를 결정하는 순수 모델을 추가했다.
- `src/ui/PlacePicker.tsx`: API-S-1의 상태형 POI 검색을 사용하고, requestId로 입력 변경 뒤 늦은 응답을 무시한다. 성공 결과가 있으면 선택 안내를, 양 제공사 성공 후 0개면 빈 문구를, 실패면 키·상태 코드·검색어·원문 오류 없는 재시도 안내를 표시한다.
- `test/ui/place-search-ranking.test.ts`: 공개 고정 Kakao 성공 5개 fixture, 짧은 검색어, 주소형·동명 상호, Kakao 성공+TMAP 실패, 양 제공사 실패 상태를 검증한다.
- `test/map-transport-ui-contract.test.mjs`: 장소 선택기가 진단 모델·상태 모델을 사용하고 주소 지오코딩을 기본 목록에 섞지 않는 화면 계약을 유지했다.

### 진단 fixture 개수·유지 경계

- 성공 5개 fixture의 진단 개수는 **입력 5, 정확 1, 접두 2, 포함 0, 주소형 제외 1, 상호 제외 1, 최종 3**이다. 실제 API 검색어·장소명/주소 원문·좌표·키는 로그나 테스트 산출물에 기록하지 않았다.
- 추천 엔진, 카탈로그, 외부 API 키·쿼터·캐시 정책, DB는 수정하지 않았다. UI는 API-S-1이 공개한 상태형 검색 결과만 소비하며, 제공사 어댑터 계약을 변경하지 않았다.
- 고정 UI fixture의 실제 외부 요청은 **0회**다.

### 검증·수동 재현

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 86개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `git diff --check` 통과.
- **수동 확인 미실행(통과 처리하지 않음):** 2026-08-26 01:04:52 KST, `xcrun simctl list devices available`가 `CoreSimulatorService connection became invalid` 및 `Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 (Connection refused)`로 실패했다.
- 시뮬레이터/실기기 복구 뒤 `사상역`을 검색해 이름 관련 행이 하나 이상 표시되고 주소만 일치한 무관 행이 없는지, 행을 명시 선택한 뒤에만 확정 CTA가 켜지는지 확인해야 한다. 제공사 실패 fixture에서는 빈 결과 대신 재시도 안내가 보여야 한다.

### 다음 결정·위험

- `Poi`에는 공식 별칭·구조화된 역/정류장 유형이 없다. 현 UI는 이름 문자열의 직접 일치만 보존한다. 별칭·장소 유형을 근거로 결과 범위를 넓혀야 하면 외부 API 어댑터 세션에서 최소 공개 계약을 먼저 결정해야 한다.

---

## 2026-08-26 — U-1-F-R3 진행 기록: TMAP 성공 1건 목록 소실 진단 준비

**상태: 수동 재현 대기 — 완료 기준 미충족.**

### 변경 파일·목적

- `src/ui/placeSearchStateModel.ts`: 개발 전용 검색 완료 진단 payload를 추가했다. 제공사 상태, 합산 raw POI 수, 정확/접두/포함 일치 수, 주소형/상호 제외 수, 최종 수, stale 응답 무시 여부만 담는다.
- `src/ui/PlacePicker.tsx`: 검색 요청이 Kakao/필요 시 TMAP까지 완료된 뒤 한 번만 위 payload를 `__DEV__`에서 기록한다. stale 응답도 화면 갱신 전 같은 개수 기반 기록을 남겨, 필터 탈락과 requestId 폐기를 구분할 수 있다. 프로덕션에서는 실행하지 않는다.
- `test/ui/place-search-ranking.test.ts`: 완료 진단이 장소명·주소·검색어·좌표·키를 담지 않고 상태·개수·stale 여부만 보존하는 고정 fixture를 추가했다.

### 유지한 경계

- 원인 카운트를 실제로 수집하기 전에는 장소명 필터를 완화하지 않았다. 주소만 일치한 행·무관 상호를 기본 목록에 허용하지 않는다.
- 추천 엔진·카탈로그·외부 API 어댑터 계약·키/쿼터/캐시 정책·DB와 UIUX 공통 규칙/요구사항 기준 문서는 수정하지 않았다.

### 실행 카운트·원인 판정

- 실제 `사상역` 검색의 R3 카운트는 아직 **미수집**이다. 따라서 `TMAP ok 1`이 주소형 제외·상호 제외·이름 불일치·stale 중 어느 분기에서 최종 0개가 되었는지는 아직 판정하지 않았다.
- 고정 단위 fixture는 provider 상태 `kakao ok`/`tmap ok`, raw POI 3, 정확 1, 주소형 제외 1, 상호 제외 1, 최종 1, stale 무시 `true`를 원문 없이 검증한다. 이 값은 실제 API 실행 결과가 아니다.

### 검증·수동 재현

- `npx tsx --test test/ui/place-search-ranking.test.ts` 통과: 6개.
- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 87개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `git diff --check` 통과.
- **수동 재현 차단:** 2026-08-26 01:12:18 KST, 시뮬레이터는 직전 `iPhone 17` 부팅 상태가 확인됐으나 `xcrun simctl listapps booted`에서 다시 `CoreSimulatorService connection became invalid` 및 `Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 (Connection refused)`로 실패했다. 실제 `사상역` 검색·콘솔 카운트·행 선택 CTA 확인은 실행하지 못했다.

### 다음 결정·재현 조건

- 시뮬레이터 또는 실기기가 안정화되면 `사상역`을 한 번 검색하고 `[place-search-complete]`의 개수만 수집한다. `finalCount`가 0이면 `excluded` 또는 `matches`/`staleIgnored`로 분류해 다음 수정 범위를 결정한다.
- 이름 불일치면 UI가 주소 결과를 대신 허용하지 않고, TMAP의 공식 별칭·역/정류장 유형 필드 유무를 외부 API 어댑터에 인계한다. 주소형·상호 오판 또는 stale이면 그 범위의 순수 UI fixture와 상태 갱신만 수정한다.

### 통합·결정 재개 판정 (2026-08-26)

사용자 수동 재현에서 `사상역` 검색 후 `tmap ok 1`이 기록됐지만 목록은 비어 있다. `PlacePicker`는 `resultCount > 0`이면 반드시 목록 상태를 만들므로, 이 관찰은 수신한 TMAP POI 1개가 `diagnosePlaceSearchResults()`에서 0개가 되었거나, 최신 검색의 응답이 requestId 경계에서 버려졌다는 뜻이다. 위 완료 기록의 시뮬레이터 수동 확인은 미실행이므로 U-1-F-R2의 완료 기준을 충족하지 못했다. 아래 U-1-F-R3으로 재개한다.

---

## 2026-08-26 — 통합·결정 지시 U-1-F-R3: 실행 중 TMAP 성공 1건의 목록 소실 원인 확정

1. 개발 전용으로 `PlacePicker`가 검색 **완료 시 한 번만** `provider status`, `raw POI 수`, `정확/접두/포함 일치 수`, `주소형/상호 제외 수`, `최종 수`, `stale 응답 무시 여부`를 기록하게 한다. 장소명·주소 원문, 검색어, 좌표, API 키, HTTP 본문은 기록하지 않는다. 프로덕션에서는 비활성이다.
2. 현재 시뮬레이터에서 `사상역`을 검색해 위 카운트를 수집한다. `TMAP ok 1`만으로 완료 처리하지 않으며, 최종 수가 0인 정확한 분기(주소형 제외 / 상호 제외 / 이름 불일치 / stale 응답)를 기록한다.
3. **이름 불일치**라면 제공사 결과를 주소로 대신 통과시키지 않는다. TMAP의 공식 별칭·역/정류장 유형 같은 구조화 필드가 이미 응답에 있는지 외부 API 어댑터에 최소 계약으로 인계한다. 이름 관련성을 입증할 수 없는 1개는 목록에 넣지 않는다.
4. **주소형·상호 제외 오판**이라면 실제 이름 직접 일치/역·출구 유형을 정확히 보존하도록 순수 필터와 fixture를 수정한다. **stale 응답**이면 requestId·busy·상태 갱신 순서를 수정한다. 원인과 무관하게 주소만 일치한 행·무관 상호를 일반 목록에 허용하지 않는다.
5. 수정 뒤 같은 시뮬레이터에서 `사상역` 검색 결과의 최종 수가 1 이상인지 확인하고, 행을 누른 뒤에만 확정 CTA가 켜지는지 확인한다. `사`, `사상`, 동명 상호, 주소만 일치, 제공사 실패도 회귀 확인한다.
6. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 변경 파일 / 유지 경계 / 실행 카운트 / 원인 / 테스트 / 캡처 또는 수동 재현을 기록한다. 시뮬레이터를 실제로 실행하지 못했다면 완료로 표시하지 않는다.

**완료 기준:** `TMAP ok 1`의 POI가 왜 최종 목록 0개가 되었는지가 범주형 근거로 기록되고, 그 원인이 UI 수정 대상이면 `사상역`에 이름 관련 행이 표시된다. 제공사 계약이 부족한 경우에는 UI를 임의 완화하지 않고 외부 API 인계가 남아야 한다.

### API-S-2 선행 인계 (2026-08-26)

실행 진단은 `raw 6 / exact·prefix·contains 0 / 주소형·상호 제외 0 / stale false / Kakao·TMAP ok`로 끝났다. 따라서 U-1-F-R3의 UI 필터·상태 반영 원인 가설은 기각한다. 외부 API 어댑터가 keyword 요청·반경/검색유형·응답 `name` 매핑을 검증하는 API-S-2를 먼저 수행한다. UIUX는 그 결과 전까지 주소·무관 상호를 목록에 넣어 문제를 가리거나, UI만으로 임의의 이름 유사도를 넓히지 않는다.

### API-S-3 선행 인계 (2026-08-26)

API-S-2로 주변 POI 요청 문제는 해소됐으나, 현재 전체 문자열 일치는 `사상역 2호선`과 제공사 표기 `사상역 부산2호선`의 도시명 삽입·순서 차이를 처리하지 못한다. API-S-3의 공유 교통 장소명 의미 매칭 계약을 먼저 소비한다. UIUX는 이를 자체 정규식으로 중복 구현하지 않으며, 계약 뒤 결과 표시·명시 선택·수식어 단독 빈 상태 fixture만 보완한다.

---

## 2026-08-26 — 통합·결정 지시 U-1-F-R4: API-S-3 교통 장소명 계약의 화면 소비

**우선순위 1 / 선행 조건:** API-S-3 완료. `matchPlaceNameQuery()`와 adapter fixture가 이미 제공됐다.

1. `src/ui/placeSearchRanking.ts`의 제공사 `name` 관련성 판정에서 API-S-3의 공유 순수 함수를 소비한다. UI 자체 정규식·별칭 추측을 추가하지 않는다.
2. 직접 일치가 최우선이고, 그 다음에만 `transit_variant`를 둔다. 주소만 일치한 행·무관 상호·수식어 단독 입력은 현재처럼 결과로 넓히지 않는다. 확정 CTA는 사용자가 행을 명시 선택할 때만 활성화한다.
3. 고정 fixture로 `사상역 2호선 ↔ 사상역 부산2호선`, 도시 접두/순서 변형, 수식어 단독 빈 결과, 주소형/무관 상호 차단, 기존 단순 `사상` 검색의 순위를 검증한다. 실제 API 호출은 0회여야 한다.
4. 시뮬레이터 또는 실기기에서 `사상역`, `사상역 2호선`을 각각 한 번 확인한다. 이름 관련 행만 보이고, 선택 전 확정 CTA가 꺼져 있으며 선택 뒤 켜지는지 기록한다. 실행 불가면 완료로 표시하지 않는다.
5. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 변경 파일·유지 경계·수동 재현·남은 위험을 이 파일에 기록한다.

**완료 기준:** API adapter의 `directNameMatchCount`와 UI 최종 목록의 관련성 의미가 일치하고, 교통 수식어 표기 차이에서 이름 관련 행을 안전하게 선택할 수 있다.

---

## 2026-08-26 — 통합·결정 지시 U-1-F-R5: 구조화된 역 fallback의 화면 표시

**선행 조건:** API-S-4 완료. UI는 그 작업이 공개한 `base_transit_place`와 표시 label 출처만 소비한다.

1. 결과 화면을 정확 일치 하나가 아닌 관련성 순 **장소 제안**으로 표시한다. `사상역`은 제공된 같은 이름의 교통 POI·출구/관련 장소를 함께 보이며, 주소·일반 상호·유형 미상 결과를 UI에서 추측해 통과시키지 않는다.
2. provider metadata가 근거를 준 경우에만 `2호선` 같은 노선 라벨을 표시한다. `사상역 2호선` 검색에서는 표기 변형 또는 base fallback의 같은 역 교통 POI를 상단에 둔다. 제공사가 노선명을 주지 않으면 실제 장소명만 보이며 사용자가 입력한 수식어를 결과 사실처럼 복사하지 않는다.
3. 검색 버튼 한 번으로 원문→base fallback이 일어났을 때도 busy·빈 상태·명시 선택 전 CTA 비활성·stale 응답 처리를 유지한다. fallback 횟수/상태는 원문 없이 개발 진단의 개수만 소비한다.
4. API-S-4 fixture 계약을 이용해 직접/표기변형/base 역 성공, 주소·상호·수식어 단독 차단, 노선 근거 없음 라벨, 선택 전후 CTA를 UI 테스트로 검증한다. 실제 API 호출은 0회다.
5. 실기기 또는 시뮬레이터에서 `사상역`, `사상역 2호선`을 각각 한 번 검색해 실제 역 관련 행과 선택 흐름을 확인한다. 실행하지 못하면 완료로 표시하지 않는다.

**완료 기준:** `사상역`은 관련 복수 제안을, `사상역 2호선`은 근거 있는 노선별 제안을 보여 주고, 노선 사실·주소 결과를 UI가 추측하지 않으며 명시 선택 뒤에만 확정할 수 있다.

---

## 2026-08-26 — U-1-F-R4 진행 기록: API-S-3 교통 장소명 계약 화면 소비

**상태: 자동 검증 완료, 수동 재현 대기 — 완료 기준의 기기 확인 미충족.**

### 이전 방식 → 문제 → 교체 방식

- **이전 방식:** UI는 정규화한 전체 문자열의 정확·접두·포함 검사만으로 장소명 관련성을 판정했다.
- **문제:** 제공사 이름의 도시 접두·교통 수식어 순서 차이(예: `사상역 2호선`과 `사상역 부산2호선`)를 UI가 놓쳤으며, API adapter의 `directNameMatchCount`와 화면 관련성 의미가 달라질 수 있었다.
- **교체 방식:** `src/services/placeNameSemanticMatch.ts`의 API-S-3 공개 순수 함수 `matchPlaceNameQuery()`를 UI 순위 모델이 직접 소비한다. 직접 일치는 기존 우선순위를 유지하고, `transit_variant`는 그 다음 순위로만 추가한다.
- **이유·상태:** 교통 표기 변형을 제공사와 같은 계약으로 처리하면서 UI 자체 별칭·정규식 추측을 만들지 않기 위함이다. 수동 검증 전까지 **조건부 현행**이다.

### 변경 파일·목적

- `src/ui/placeSearchRanking.ts`: 제공사 `name` 관련성 판정에 `matchPlaceNameQuery()`를 연결했다. `transitVariant` 진단 수와 순위를 추가했으며, 주소형·무관 상호 제외와 명시 선택 전 CTA 비활성 정책은 유지했다.
- `src/ui/placeSearchStateModel.ts`: 개발 완료 진단의 일치 계수에 `transitVariant`만 추가해, 표기 변형이 최종 목록에 남은 근거를 원문 없이 구분할 수 있게 했다.
- `test/ui/place-search-ranking.test.ts`: 직접 일치 우선, `사상역 2호선`의 도시 접두/순서 변형, 수식어 단독 빈 결과, 주소형·무관 상호 차단, 기존 `사상` 순위를 고정 fixture로 검증했다.

### 유지한 경계·요청 수

- API-S-3의 공유 함수 외에 UI별 별칭, 주소 보정, 교통 장소명 정규식은 추가하지 않았다. 주소만 일치한 행·무관 상호·수식어 단독 입력은 목록으로 넓히지 않는다.
- 추천 엔진·카탈로그·외부 API 어댑터·키/쿼터/캐시 정책·DB는 수정하지 않았다. 고정 UI fixture의 실제 외부 API 요청은 **0회**다.
- 제공사 `directNameMatchCount`와 UI는 모두 `matchPlaceNameQuery()`의 `direct`/`transit_variant`/`none` 의미를 사용한다. UI의 주소·상호 제외는 장소명 선택기 표시 정책으로 그 뒤에만 적용된다.

### 검증·수동 재현

- `npx tsx --test test/ui/place-search-ranking.test.ts` 통과: 7개.
- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 88개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `git diff --check` 통과.
- **수동 재현 차단:** 2026-08-26 01:47:54 KST, `xcrun simctl list devices available`에서는 iPhone 17 부팅 상태가 보였으나, 이어서 `xcrun simctl listapps booted`가 `CoreSimulatorService connection became invalid` 및 `Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 (Connection refused)`로 실패했다. 따라서 `사상역`, `사상역 2호선`의 실제 행 표시·선택 전/후 CTA 상태는 확인하지 못했다.

### 다음 재현 조건·위험

- 시뮬레이터 또는 실기기가 안정화되면 두 검색어를 각각 한 번 실행해 이름 관련 행만 표시되는지, 선택 전 `위치를 선택하세요`와 선택 후 확정 CTA 전환을 확인한다.
- API-S-3 계약에 없는 새 교통 수식어·공식 별칭은 UI가 추측하지 않는다. 필요하면 외부 API 어댑터가 공유 매칭 계약을 확장해야 한다.

---

## 2026-08-26 — U-1-F-R6 진행 기록: 통합 위치 선택 화면

**상태: 자동 검증 완료, 수동 재현 대기 — 기기 확인 미충족.**

### 변경 파일·목적

- `src/ui/PlacePicker.tsx`: API-S-5 `createKakaoLocationSearchAdapter()` 인스턴스를 화면 수명 동안 재사용한다. 빈 입력에서는 현재 위치·지도 선택을, 입력 뒤에는 Kakao의 장소/주소 제안을 한 목록으로 보인다. 입력 변경은 이전 선택·응답을 무효화하며, provider가 준 노선 라벨과 주소/장소 kind만 표시한다.
- `src/ui/TimeSetupScreen.tsx`: 검색 화면의 빈 입력 `지도에서 선택` 행동을 기존 지도 선택 화면과 연결했다. 지도 핀·검색·현재 위치는 같은 `Place` payload로 출발/도착지에 적용된다.
- `test/map-transport-ui-contract.test.mjs`: Kakao 단일 위치검색, 노선 metadata, 지도 진입, 검색 중 TMAP/legacy 주소 보정 미사용과 지도 선택 중 reverse-geocode 미호출을 화면 계약으로 고정했다.

### 유지한 경계·호출 정책

- API-S-5의 cache/분류/fallback 계약을 UI가 재구현하거나 우회하지 않았다. 검색 중 TMAP, 주소/노선 추측, 별도 reverse-geocode 호출은 없다.
- 지도 이동·탭은 좌표 상태만 바꾸고, `이 위치로 선택`을 누를 때만 동일 선택 payload를 확정한다. 지도 SDK 실패 시에는 기존 검색 행동으로 돌아갈 수 있으며 외부 카카오맵으로 강제 전환하지 않는다.
- 추천 엔진·카탈로그·외부 API adapter·DB는 변경하지 않았다. 고정 UI fixture 및 회귀 테스트의 실제 API 호출은 **0회**다.

### 검증·수동 재현

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 89개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `git diff --check` 통과.
- **수동 재현 차단:** 2026-08-26 17:20:03 KST, 기기 목록에는 iPhone 17 부팅 상태가 보였지만 `xcrun simctl listapps booted`가 `CoreSimulatorService connection became invalid` 및 `Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 (Connection refused)`로 실패했다. 현위치 권한, 지도 선택, 장소/주소 검색의 실제 화면 확인은 실행하지 못했다.

### 다음 재현 조건·위험

- 시뮬레이터 또는 실기기가 안정화되면 출발지에서 현위치 허용/거부, 지도 탭 후 확정, 장소 검색, 주소 검색을 각각 한 번 확인한다. 지도 이동만으로 reverse-geocode 요청이 생기지 않고, 선택 전 CTA가 비활성인 상태도 함께 확인한다.
- 지도 SDK 자체 로드 실패의 화면 문구/재시도 동작은 현재 기기 차단으로 미검증이다. 실패 fixture 또는 실기기에서 확인 뒤 필요 시 UI 문구만 보완한다.

---

## 2026-08-26 — U-1-F-R6 보완 기록: debounce·실패 대안·고정 fixture

**상태: 보완 진행. UI 소유 항목은 자동 검증 완료, 핀 확정 역지오코딩 공개 계약 및 iOS 수동 재현이 남아 미수락이다.**

### 이전 방식 → 문제/관찰 → 교체 방식 → 이유·상태

- **입력 제안:** 이전에는 검색 버튼/키보드 submit만 요청했다. 이는 두 글자 입력 뒤 제안으로 전환한다는 `UXV-06`과 달랐다. `PlacePicker`는 이제 두 글자부터 400ms 뒤 API-S-5 adapter를 호출하고, 같은 입력을 버튼/submit으로 이미 보낸 경우 debounce 중복 호출은 생략한다. 입력 변경은 이전 선택·응답의 request id를 무효화한다. **현행, 자동 검증 완료.**
- **지도 실패 대안:** 이전에는 `KakaoRouteMap` 오류 문구만 있고 선택 화면에 재시도 행동이 없었다. 지도 오류를 선택 화면으로 전달하고 WebView를 새 key로 다시 마운트하는 `지도 다시 시도`, 검색 화면으로 돌아가는 `검색으로 선택`을 추가했다. 외부 카카오맵 전환은 추가하지 않았다. **현행, 자동 검증 완료·기기 미확인.**
- **고정 UI fixture:** 이전 소스 문자열 검사는 빈 입력·장소/주소·cache/fallback·stale·명시 선택의 상태 전이를 검증하지 못했다. `locationSelectionModel`과 고정 `KakaoLocationSearchResult` fixture로 이 흐름을 검증하고, 실제 화면에는 검색/현재 위치/지도/제안/확정 및 지도 재시도/검색 대안 `testID`를 추가했다. fixture는 실제 외부 API를 호출하지 않는다. **현행, 자동 검증 완료.**
- **핀 확정 주소화:** U-1-F-R6은 지도 이동 중 0회, 핀 확정 시 정확히 1회의 reverse-geocode를 요구한다. 그러나 API-S-5-R의 공개 계약은 텍스트 장소/주소 검색만 제공하고 좌표→주소 reverse-geocode 결과·실패 상태를 제공하지 않는다. UI가 engine의 내부 함수를 직접 호출하면 adapter 경계와 cache/실패 관찰성을 우회한다. 따라서 현재는 좌표를 `이 위치로 선택`으로 확정하고 검색 대안을 유지한다. **구현 전/외부 API 어댑터 공개 계약 필요.** 필요한 계약은 `(lat, lon) → provider label/address | typed failure`, 핀 확정 시에만 호출할 수 있는 단일 함수와 fixture 요청 수(이동 0, 확정 1)다.

### 변경 파일·목적

- `src/ui/PlacePicker.tsx`, `src/ui/locationSelectionModel.ts`: 400ms debounce, 동일 query 중복 억제, stale/명시 선택의 순수 상태 모델과 화면 `testID`를 추가했다.
- `src/ui/KakaoRouteMap.tsx`, `src/ui/MapPlacePicker.tsx`: 지도 SDK 오류 콜백을 상위 선택 화면에 전달하고, 지도 재시도와 검색 대안을 제공했다. 지도 탭은 여전히 좌표 상태만 바꾸며 reverse-geocode를 호출하지 않는다.
- `test/ui/location-selection-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: 빈 입력, 두 글자 debounce, 장소/주소 kind, cache hit/miss·fallback 진단 소비, stale 응답 차단, 명시 선택 전 확정 불가, 지도 오류 재시도/검색 대안의 고정 계약을 추가했다.

### 유지한 공개 계약·정책 경계

- `src/services/kakaoLocationSearchAdapter.ts`와 engine·data·DB·추천 정책은 수정하지 않았다. UI는 API-S-5-R의 Kakao 단일 검색·10분 TTL·동일 요청 합치기·실패 non-cache 계약만 소비한다.
- 장소/주소/노선 라벨을 UI가 추측하거나 TMAP·직접 geocode/reverse-geocode 호출을 되살리지 않았다. 지도 이동 중 reverse-geocode는 0회다.

### 검증·수동 재현

- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 92개 통과, 철회 이력 1개 skip (새 위치 선택 fixture 3개 포함).
- `npm test`: 통과.
- `git diff --check`: 통과.
- **수동 재현 차단:** 2026-08-26 17:29:07 KST, `xcrun simctl listapps booted`가 `CoreSimulatorService connection became invalid` 및 POSIX Code 61 (Connection refused)로 다시 실패했다. 현위치 권한, 지도 SDK 오류/재시도, 장소·주소 자동 제안은 기기에서 확인하지 못했다.

### 다음 세션의 결정 필요 사항·재현 조건

- 외부 API 어댑터 담당은 위의 좌표 reverse-geocode 공개 계약과 이동 0/핀 확정 1 fixture를 제공해야 한다. 그 전 UI는 내부 engine 호출로 이를 대체하지 않는다.
- 시뮬레이터/실기기가 안정화되면 출발지와 도착지에서 각각 빈 입력의 현위치·지도 진입, `사상역`과 주소 입력의 400ms 제안, 행 선택 전/후 CTA, 지도 실패 재시도/검색 대안을 확인한다. 핀 주소 라벨과 1회 호출 검증은 adapter 계약 수락 뒤에만 실행한다.

---

## 2026-08-26 — U-1-F-R5 진행 기록: 구조화된 역 fallback 제안 표시

**상태: 자동 검증 완료, 수동 재현 대기 — 완료 기준의 기기 확인 미충족.**

### 이전 방식 → 문제 → 교체 방식

- **이전 방식:** `PlacePicker`가 Kakao·TMAP POI를 직접 호출·병합하고 UI 문자열 순위만 적용했다.
- **문제:** 원문 교통 수식어 검색이 비었을 때 구조화된 base 역 fallback과 노선 근거를 화면이 안전하게 소비할 수 없었고, UI가 제공사 결과 밖의 노선을 만들 위험이 있었다.
- **교체 방식:** `PlacePicker`는 API-S-4의 `searchPlaceSuggestions()` 결과만 소비한다. 직접/표기 변형/base 교통 장소 제안을 순위 모델에 전달하고, base fallback은 adapter가 제공한 `base_transit_place`일 때만 보조 제안으로 남긴다. 노선 라벨은 `providerMetadata.lineLabels`가 있을 때만 보인다.
- **이유·상태:** 검색 버튼 한 번의 원문→base fallback 경로를 API adapter 계약에 맡기고, UI의 주소·별칭·노선 추측을 제거하기 위함이다. 수동 확인 전까지 **조건부 현행**이다.

### 변경 파일·목적

- `src/ui/PlacePicker.tsx`: 제공사별 직접 호출/병합 대신 `searchPlaceSuggestions()`를 연결했다. fallback을 포함한 모든 요청의 성공 여부로 빈/재시도 상태를 정하고, 개발 진단에는 raw POI 수와 provider별 fallback 횟수·상태·일치 개수만 남긴다. 제안 행은 provider 원본 label을 사용하며, 사용자가 행을 선택하기 전에는 확정 CTA가 계속 비활성이다.
- `src/ui/placeSearchRanking.ts`: API-S-4 제안용 순수 순위 모델을 추가했다. `base_transit_place`는 제공 계약으로 들어온 경우에만 직접/표기변형 다음의 보조 순위로 표시하며 주소형·상호 제외는 유지한다.
- `src/ui/placeSearchSuggestionModel.ts`: 제공사 metadata의 실제 `lineLabels`만 짧은 노선 라벨로 반환한다. 라벨이 없으면 `null`을 반환해 사용자 입력 수식어를 복사하지 않는다.
- `src/ui/placeSearchStateModel.ts`: 원문·fallback을 포함한 모든 요청이 성공했을 때만 최종 0개를 빈 상태로 표시하도록 순수 상태 모델을 추가했다.
- `test/ui/place-search-ranking.test.ts`, `test/map-transport-ui-contract.test.mjs`: 직접/표기변형/base 성공, 주소·상호·수식어 단독 차단, metadata 없는 노선 라벨, fallback 횟수 진단, 명시 선택 화면 계약을 고정 fixture로 검증했다.

### 유지한 경계·요청 수

- UI는 API-S-4가 근거를 확인한 `suggestion.match`, `label`, `providerMetadata`만 소비한다. 주소·일반 상호·유형 미상 POI를 UI가 통과시키거나, 제공되지 않은 노선을 합성하지 않는다.
- 추천 엔진·카탈로그·외부 API 어댑터·키/쿼터/캐시 정책·DB는 수정하지 않았다. 고정 UI fixture의 실제 외부 API 요청은 **0회**다.

### 검증·수동 재현

- `npx tsx --test test/ui/place-search-ranking.test.ts` 통과: 8개.
- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 89개 통과, 철회 이력 1개 skip.
- `npm test` 통과.
- `git diff --check` 통과.
- **수동 재현 차단:** 2026-08-26 14:56:33 KST, `xcrun simctl list devices available` 및 `xcrun simctl listapps booted`가 모두 `CoreSimulatorService connection became invalid` 및 `Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 (Connection refused)`로 실패했다. 따라서 `사상역`과 `사상역 2호선`의 실제 제안 행·선택 전후 CTA는 확인하지 못했다.

### 다음 재현 조건·위험

- 시뮬레이터 또는 실기기가 안정화되면 두 검색어를 각각 한 번 실행한다. 이름 관련 제안만 보이는지, 제공사 metadata가 있을 때만 노선 라벨이 보이는지, 선택 전 `위치를 선택하세요`와 선택 후 확정 CTA 전환을 확인한다.
- 제공사 카테고리에 노선 token이 없으면 base fallback 제안은 만들지 않는다. UI는 원본 장소명만 보여 줄 수 있으며, 누락된 노선을 보정하려면 외부 API 어댑터의 공개 계약 확장이 필요하다.

---

## 2026-08-28 — 통합·결정 지시 U-1-CAP-01: 비로그인 추천용 최소 CAPTCHA UX

### 목표와 경계

비로그인 추천은 유지한다. 저장 session이 없는 사용자가 `이 시간에 할 일 찾기`를 실행할 때에만 짧은 `안전 확인 중` sheet에서 Managed Turnstile token을 얻고 원래 동작으로 돌아간다. 장소 검색·지도 선택·시간 입력 중에는 CAPTCHA를 선제 표시하지 않으며, session이 있으면 WebView 0회다. 취소·실패·만료 때는 재시도/닫기만 보여 주고 추천 계산·Kakao/ODsay 직접 호출은 시작하지 않는다.

UIUX 세션은 `src/ui/`·UI fixture·이 작업기록만 수정한다. API-4-A-ACT-04-A의 `CaptchaTokenProvider`와 HTTPS challenge URL만 소비하며 anonymous sign-in, Turnstile secret, Supabase config, Edge Function, engine/adapter, board는 수정하지 않는다. 새 native CAPTCHA dependency 대신 기존 `react-native-webview`만 쓴다.

### 구현 지시

1. `CaptchaVerificationSheet`와 순수 상태 모델(`idle → loading → ready | failed | cancelled`)을 만든다. token은 UI state/로그/analytics/Alert에 보관하지 않고 success callback에 한 번 전달한 뒤 폐기한다.
2. WebView는 API가 제공하는 HTTPS challenge URL만 열며 JavaScript/DOM storage를 허용한다. arbitrary navigation·popup·deep link는 막는다. message는 정확히 token/error/cancelled 세 typed event만 허용하고, invalid origin/payload는 failed 처리한다.
3. Managed widget을 사용한다. 항상 보이는 CAPTCHA 화면이나 invisible mode는 사용하지 않는다. 필요할 때만 상호작용이 나타날 수 있다는 짧은 안내와 닫기·재시도를 제공한다.
4. `TimeSetupScreen`에는 UI callback/overlay 연결점만 둔다. session 판단·실제 anonymous sign-in·route request는 API adapter가 소유하며, 이번 작업에서 route adapter를 직접 전환하지 않는다.
5. fixture로 기존 session sheet 0회, 첫 요청 sheet 1회/token 전달 1회, 취소·오류·invalid payload 추천 시작 0회, 재시도 WebView 새 mount 1회, safe area·VoiceOver label을 검증한다. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행하며 실제 Turnstile/Supabase/Kakao 요청은 0회다.

### 완료 기준

첫 비로그인 추천의 보안 확인은 한 번의 Managed WebView로 끝나고 정상 session에는 추가 UI가 없어야 한다. API-4-A-ACT-04-A와 이 작업이 수락된 뒤에만 Cloudflare widget/Supabase CAPTCHA 설정, Edge 배포, 비식별 smoke로 넘어간다.

### U-1-CAP-01 진행 기록 (2026-08-28)

**상태: UI·고정 fixture 완료 · API 활성화/실기기 확인 대기.**

| 이전 방식 → 관찰/위험 | 교체 방식 | 이유 / 상태 |
| --- | --- | --- |
| 비로그인 추천 전에 사용자에게 보이는 확인 경계가 없음 | `CaptchaVerificationSheet`를 추천 CTA 직전에만 표시하고 기존 session·Auth 초기 확인 중에는 sheet/WebView를 열지 않음 | 장소 검색·지도·시간 입력을 막지 않으면서 첫 비로그인 요청에만 확인을 둔다. **현행 UI 경계** |
| WebView message와 navigation을 신뢰하면 token/딥링크/외부 이동이 섞일 수 있음 | HTTPS server-owned challenge URL과 동일 URL만 허용하고 popup을 끄며 token/error/cancelled 세 message만 parse | invalid URL/origin/payload는 failed로 처리하고 재시도·닫기만 노출한다. **현행** |
| token을 상태·로그에 두면 노출 또는 재사용 위험 | token은 `onVerified(token)` callback으로 한 번만 전달하고 즉시 화면을 닫음 | UI state, Alert, analytics, 로그에는 token을 보관하지 않는다. **현행** |

#### 변경 파일 / 유지한 경계

- `src/ui/CaptchaVerificationSheet.tsx`, `src/ui/captchaVerificationModel.ts`: Managed WebView sheet, typed event·URL·상태 모델, safe-area 및 VoiceOver label을 추가했다.
- `src/ui/TimeSetupScreen.tsx`: Auth session이 없는 추천 CTA에서만 sheet를 연다. token callback은 화면 경계에서 즉시 폐기하고, 취소/실패/invalid payload에서는 추천 계산을 시작하지 않는다.
- `test/ui/captcha-verification-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: UCAP-01~04로 기존 session 0회, 첫 비로그인 sheet, typed payload/URL fail-closed, retry loading mount, token 비저장을 고정했다.
- anonymous sign-in, `CaptchaTokenProvider`의 실제 소비, route adapter 전환, Turnstile/Supabase/Edge 설정과 배포는 수정하지 않았다. 공개 Supabase base URL에서 HTTPS `captcha-challenge` endpoint를 조립할 뿐, secret·token·실제 네트워크 요청은 없다.

#### 검증 / 다음 결정

- 통과: `npm run test:typecheck`, `npm run test:ui` (106 pass, 1 skip), `npm test` (99 pass), `git diff --check`.
- 실제 Turnstile·Supabase·Kakao 요청은 0회다. iOS에서 WebView widget 렌더링, 닫기/재시도, VoiceOver와 safe area를 확인해야 한다.
- **API 활성화 의존성:** 현재 기본 route adapter는 CAPTCHA token을 실제 anonymous sign-in에 전달하는 runtime 연결을 아직 소비하지 않는다. API-4-A-ACT-04-B에서 Auth/CAPTCHA 설정·Edge 배포 승인과 함께 one-shot token→`CaptchaTokenProvider`→anonymous sign-in 연결을 완료하기 전에는 CAPTCHA 활성화·기본 route adapter 전환·ODsay 제거를 하지 않는다.

---

## 2026-08-28 — 통합·결정 검토 및 지시 U-1-CAP-01-R: Turnstile 보조 WebView navigation 보완

### 발생한 문제와 확정 경계

`U-1-CAP-01`은 server-owned HTTPS challenge URL만 허용한다는 의도로 `onShouldStartLoadWithRequest`와 `originWhitelist`를 동일 URL-only로 만들었다. 그러나 Managed Turnstile은 최상위 challenge 안에서 `https://challenges.cloudflare.com`과 `about:blank`/`about:srcdoc` 보조 frame·연결을 사용한다. 현 구현은 이를 모두 거절할 수 있어, typed fixture가 통과해도 실제 iOS widget이 렌더링·완료되지 않을 위험이 있다.

최상위 문서는 여전히 정확한 Supabase `captcha-challenge` HTTPS URL 하나만 허용한다. 단, 그 내부 보조 자원에는 **Cloudflare Turnstile origin과 about 보조 문서만** 허용한다. Cloudflare는 native WebView에서 이 연결을 요구한다. [Cloudflare Mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/)

### 소유 범위

UIUX 세션은 `src/ui/CaptchaVerificationSheet.tsx`, `src/ui/captchaVerificationModel.ts`, UI fixture, 이 작업기록만 수정한다. `supabase/functions/captcha-challenge/` CSP 수정은 병렬 `API-4-A-ACT-04-A-R`의 소유다. anonymous sign-in·`CaptchaTokenProvider` 실제 소비·route adapter·DB·카탈로그·Cloudflare/Supabase 설정·배포·`docs/작업조정_보드.md`는 수정하지 않는다.

### 수행 지시

1. 순수 navigation 정책을 URL 문자열 비교와 분리한다. 최상위 navigation은 `challengeUrl`과 protocol·origin·path·query가 정확히 같은 경우만 허용한다. 보조 navigation은 `https://challenges.cloudflare.com` origin과 `about:blank`·`about:srcdoc`만 허용한다. HTTP, 다른 HTTPS origin, deep link, `javascript:`, `data:`, file URL, popup/new window는 계속 거절한다.
2. 플랫폼이 `isTopFrame`을 주지 않는 요청도 보안상 넓게 허용하지 않는다. 허용 목록에 든 Cloudflare/about 보조 URL만 통과시키고, `onMessage` 성공 수용은 계속 **최상위 exact challenge URL**에서 온 typed `token` 한 종류로 제한한다. 따라서 보조 frame의 임의 message·navigation은 token으로 승격될 수 없다.
3. `originWhitelist`와 `onShouldStartLoadWithRequest`를 같은 제한 목록으로 맞춘다. `setSupportMultipleWindows={false}`는 유지한다. 재시도는 새 WebView mount 1회, token은 state·로그·analytics·Alert·persistent storage 0개라는 계약을 유지한다.
4. fixture에 (a) exact top-level challenge 허용, (b) Cloudflare/about 보조 허용, (c) Cloudflare가 아닌 top-level/보조 HTTPS·HTTP·deep link·data/javascript 거절, (d) 보조 URL에서 온 message와 invalid payload는 failed, (e) 기존 session 0회/first sheet 1회/token callback 1회/취소·오류 시작 0회를 추가한다. 실제 widget·API는 호출하지 않는다.
5. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 실제 iOS widget 렌더링은 다음 배포 smoke 이전에 별도 수동 확인으로 기록하며, 이 작업에서 secret·token 값을 출력하지 않는다.

### 완료 기준

Managed Turnstile이 필요로 하는 보조 frame·연결은 열리되, 앱이 직접 신뢰하는 최상위 문서·token message 경계는 기존보다 넓어지지 않아야 한다. 이 작업과 `API-4-A-ACT-04-A-R`이 수락되기 전에는 `API-4-A-ACT-04-B`의 Dashboard 설정·Edge 배포·기본 adapter 전환을 시작하지 않는다.

### U-1-CAP-01-R 진행 기록 (2026-08-28)

**상태: UI·고정 fixture 완료 · 실제 iOS/배포 확인 대기.**

| 이전 방식 → 문제 | 교체 방식 | 이유 / 상태 |
| --- | --- | --- |
| 모든 WebView navigation을 challenge URL 하나로만 제한 | Turnstile의 Cloudflare 및 `about:` 보조 frame·연결까지 막아 iOS widget 렌더링을 실패시킬 수 있음 | 최상위 navigation은 exact challenge URL만, `isTopFrame === false` 보조 navigation은 `https://challenges.cloudflare.com`과 `about:blank`/`about:srcdoc`만 허용 | widget의 필수 보조 자원만 열되 신뢰 최상위 문서는 확장하지 않는다. **현행** |
| `isTopFrame` 누락 플랫폼에서 보조 URL을 허용할 여지 | frame 정보가 없을 때 Cloudflare 등을 최상위로 오인할 수 있음 | `isTopFrame !== false`는 exact challenge만 허용 | 플랫폼 정보가 불완전해도 fail-closed한다. **현행** |
| 보조 frame message도 typed payload면 token으로 처리할 수 있음 | third-party frame message가 인증 token 경계를 넘을 위험 | `onMessage`는 source URL이 exact top-level challenge일 때만 parse하고, 아닌 경우 failed 처리 | token callback·비저장 계약을 유지한다. **현행** |

#### 변경 파일 / 유지한 경계

- `src/ui/captchaVerificationModel.ts`: 최상위·보조 navigation allow-list와 message source 검증을 순수 모델로 분리했다.
- `src/ui/CaptchaVerificationSheet.tsx`: `originWhitelist`와 navigation interceptor가 같은 allow-list를 사용하도록 바꾸고, popup 차단·새 retry mount·token 비저장을 유지했다.
- `test/ui/captcha-verification-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: exact top-level, Cloudflare/about 보조 허용, 다른 HTTPS/HTTP/deep link/javascript/data 거절, 보조 message 거절을 UCAP-R fixture로 고정했다.
- Edge challenge CSP, anonymous sign-in/token provider 실제 연결, route adapter, Cloudflare/Supabase 설정·배포·실제 widget 호출은 수정하거나 실행하지 않았다.

#### 검증 / 다음 조건

- 통과: `npm run test:typecheck`, `npm run test:ui` (108 pass, 1 skip), `npm test`, `git diff --check`.
- 실제 iOS에서 Managed widget이 렌더링·완료되는지, 닫기/재시도·VoiceOver/safe area를 수동 확인해야 한다. 실제 secret/token/API 호출은 0회다.
- `API-4-A-ACT-04-A-R`는 수락됐지만, `U-1-CAP-01-R`도 수락되고 사용자 배포 승인이 있기 전까지 `API-4-A-ACT-04-B`의 Dashboard 설정·Edge 배포·기본 adapter 전환은 시작하지 않는다.

### 2026-08-28 — 통합·결정 검토: U-1-CAP-01-R 수락

최상위 navigation과 token message source는 exact server-owned challenge URL로 계속 제한되고, `isTopFrame === false`인 Turnstile 보조 frame만 Cloudflare 또는 `about:blank`/`about:srcdoc`을 통과함을 확인했다. `isTopFrame` 정보가 없으면 Cloudflare를 허용하지 않아 플랫폼 정보 누락도 fail-closed한다. popup 차단·token 비저장·재시도 새 mount 경계도 유지된다.

통합 재실행에서 CAPTCHA UI fixture **5/5 통과**, `npm run test:ui` **108 통과·1 skip**, `npm run test:typecheck`, `git diff --check`가 통과했다. 따라서 **U-1-CAP-01-R을 수락**한다. 실제 widget 렌더링은 아직 Cloudflare/Supabase 설정과 Edge 배포가 없는 상태에서는 확인할 수 없으므로, `API-4-A-ACT-04-B`의 제한된 smoke에서만 확인한다.

---

## 2026-08-28 — 통합·결정 지시 U-1-CAP-02: Cloudflare Worker CAPTCHA URL 운영 설정 소비

### 목적·소유 경계

Supabase 기본 도메인 Edge Function HTML 대신 Cloudflare Worker의 HTTPS CAPTCHA page를 사용한다. UIUX 세션은 `src/ui/`·UI fixture·이 작업기록만 수정한다. Worker artifact/secret/deploy, Supabase Auth 설정, anonymous sign-in·route adapter, 엔진·DB·카탈로그·`docs/작업조정_보드.md`는 수정하지 않는다.

### 수행 지시

1. `CaptchaVerificationSheet`가 열 최상위 URL은 Supabase base URL 조립값이 아니라 `EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL`의 production build 설정값만 사용한다. URL은 HTTPS이고 query/fragment 없는 exact Worker root URL이어야 한다. 이것은 public URL이므로 source·runtime 로그에 key/token을 추가하지 않는다.
2. 설정값이 누락·공백·HTTP·URL parse 실패·path/query/fragment이 있으면 WebView를 mount하지 않고 기존 failed UI만 보인다. `onVerified`가 직접 추천 계산을 시작하는 현재 임시 연결은 유지하되, 실제 token→anonymous session 소비는 ACT-04-B의 API runtime 전환 전까지 추가하지 않는다.
3. `U-1-CAP-01-R`의 top-level exact Worker URL, `isTopFrame === false` Cloudflare/about 보조 frame, exact top-level message source, popup 차단, token 비저장 계약을 유지한다. Worker hostname을 문자열 상수로 source/fixture에 박지 않는다.
4. fixture: valid HTTPS root URL, missing/HTTP/query/fragment URL fail-closed 및 WebView 0회, origin/iframe/message 경계 회귀, 기존 session 0회/first session sheet 1회를 검증한다. 실제 Worker/Turnstile/ Supabase 호출은 0회다.
5. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행하고 완료 기록에 변경 파일·유지 경계·결과를 남긴다.

### 완료 기준

운영 Worker URL이 있을 때만 CAPTCHA sheet가 열린다. 설정이 없는 개발 build는 안전하게 실패하며 anonymous sign-in·Route Proxy 요청을 만들지 않는다. ACT-04-B 배포 smoke 전에는 UI가 Worker URL을 추측하거나 default adapter를 전환하지 않는다.

### U-1-CAP-02 진행 기록 (2026-08-28)

**상태: UI·고정 fixture 완료 · Worker 설정/배포 smoke 대기.**

| 이전 방식 → 문제 | 교체 방식 | 이유 / 상태 |
| --- | --- | --- |
| Supabase base URL에서 `captcha-challenge` endpoint를 조립 | Worker 기반 운영 URL로 전환할 때 UI가 이전 origin을 추측하고 잘못된 WebView를 열 수 있음 | `EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL`만 읽고 HTTPS·root path·query/fragment 없음·credential 없음 검증 후 그대로 사용 | Worker hostname을 코드/fixture에 고정하지 않으며 설정이 없으면 fail-closed한다. **현행** |
| 단순 HTTPS 검사만 수행 | 경로·query·fragment가 붙은 Worker URL도 최상위 신뢰 문서가 될 수 있음 | `resolveCaptchaChallengeUrl`이 exact public Worker root URL만 반환, 나머지는 `null` | invalid 설정은 WebView mount 0회·기존 failed UI만 보인다. **현행** |
| CAP-01-R navigation 계약 | Worker 전환 과정에서 Cloudflare/about 보조 자원 또는 top-level token source 경계를 잃을 수 있음 | 기존 top-level exact URL, 보조 `isTopFrame === false` Cloudflare/about, exact message source, popup 차단·token 비저장을 그대로 유지 | Worker URL만 바꾸고 보안 정책을 완화하지 않는다. **현행** |

#### 변경 파일 / 유지한 경계

- `src/ui/captchaVerificationModel.ts`: public Worker root URL의 fail-closed resolver를 추가했다.
- `src/ui/TimeSetupScreen.tsx`: Supabase URL 조립을 제거하고 `EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL` 설정만 소비한다.
- `src/ui/CaptchaVerificationSheet.tsx`: resolver 결과가 없으면 WebView를 mount하지 않고 failed UI를 유지한다.
- `test/ui/captcha-verification-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: valid root와 missing/blank/HTTP/path/query/fragment/parse 실패, Supabase 조립 제거, 기존 navigation/message 경계를 고정했다.
- Worker artifact/secret/deploy, Supabase Auth, anonymous sign-in·route adapter, 엔진·DB·카탈로그는 수정하지 않았고 실제 Worker/Turnstile/Supabase/Kakao 요청도 0회다.

#### 검증 / 다음 조건

- 통과: `npm run test:typecheck`, `npm run test:ui` (109 pass, 1 skip), `npm test`, `git diff --check`.
- 운영 환경에는 public exact Worker root URL을 별도로 주입해야 하며, 누락된 개발 build는 CAPTCHA 실패 UI만 보여야 한다. `API-4-A-ACT-04-B`의 Dashboard 설정·제한 배포·비식별 smoke 수락 전에는 default adapter 전환·ODsay 제거·2-J를 시작하지 않는다.

### 2026-08-28 — 통합·결정 검토: U-1-CAP-02 수락

Supabase URL 조립은 제거됐고, HTTPS root 형태의 public Worker URL만 소비한다. 누락·공백·HTTP·path/query/fragment·parse 실패는 모두 WebView mount 없이 fail-closed하며, 기존 최상위 URL/message 및 Cloudflare/about 보조 frame 경계가 유지된다.

통합 재실행에서 CAPTCHA UI fixture **6/6 통과**(Worker fixture와 합산 8/8), `npm run test:typecheck`, `git diff --check`가 통과했다. 따라서 **U-1-CAP-02를 수락**한다. 실제 URL 값은 Dashboard에서 Worker deploy 뒤에만 production build 설정으로 주입한다.

---

## 2026-08-28 — 통합·결정 지시 U-1-CAP-03: one-shot CAPTCHA token·Proxy/legacy 조립 연결

### 발견한 배포 차단 결함

현재 `onVerified(_token)`은 token을 폐기한 뒤 `startRecommendation()`을 호출하고, `runRecommendationSession()`은 legacy TMAP/ODsay adapter를 직접 조립한다. 따라서 Worker URL을 설정해도 CAPTCHA가 Kakao Proxy 인증에 쓰이지 않는다.

UI는 token을 상태·navigation·storage·로그에 저장하지 않고, `startRecommendation(token?) → runRecommendationSession(..., { captchaToken: token })`의 한 호출 스택 안에서만 전달한다. Auth/anonymous sign-in/Proxy 세부는 병렬 `API-4-A-ACT-04-B-R` 서비스 factory가 소유한다.

### 소유 범위

UIUX 세션은 `src/ui/`, UI fixture, 이 작업기록만 수정한다. `src/services/` adapter 구현, Worker/secret/deploy, Supabase Auth 설정, 엔진·DB·카탈로그·`docs/작업조정_보드.md`는 수정하지 않는다.

### 수행 지시

1. `EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true'`일 때만 Proxy 모드다. false/누락이면 CAPTCHA sheet를 열지 않고 현행 legacy 추천을 시작한다. 이 값은 public release mode flag일 뿐 key·JWT·개인정보가 아니다.
2. Proxy 모드에서 existing Auth session이 있으면 CAPTCHA 0회로 `startRecommendation()`을 시작한다. session이 없으면 valid `EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL`이 있을 때만 CAPTCHA sheet를 열며, 없거나 invalid면 추천·legacy·anonymous 요청 0회와 명확한 실패 UI로 끝낸다.
3. `onVerified(token)`은 token을 state/ref/navigation/analytics/Alert/storage에 넣지 않는다. 닫은 직후 `startRecommendation(token)`에 한 번만 넘긴다. cancel/error/invalid message는 start 0회다. retry 뒤 새 token만 허용하며 이전 token을 재사용하지 않는다.
4. `startRecommendation`과 `runRecommendationSession` 호출 경계에 `routeProxyEnabled`, 선택적 `captchaToken`을 명시한다. `routeProxyEnabled`면 API service의 activated Proxy factory 결과만 쓰고, typed unavailable은 legacy fallback 없이 `안전 확인 또는 경로 연결을 완료하지 못했어요. 다시 시도해 주세요.`로 표시한다. false면 현행 legacy adapter만 쓴다.
5. 기존 token source·Worker exact URL·Cloudflare/about navigation·message source·popup 차단·safe area/VoiceOver·token 비저장 계약을 유지한다. 화면이 provider key·Turnstile secret·JWT·좌표·route body를 읽거나 출력하지 않는다.

### fixture·완료 기준

| ID | 입력 | 기대 결과 |
| --- | --- | --- |
| UCAP03-01 | Proxy flag false, session 없음 | CAPTCHA 0, legacy session 시작 1 |
| UCAP03-02 | Proxy flag true, existing session | CAPTCHA 0, Proxy session 시작 1, token 없음 |
| UCAP03-03 | Proxy true, no session, valid Worker URL/token | sheet 1, `startRecommendation(token)` 1, token state/storage/log/navigation 0 |
| UCAP03-04 | Proxy true, no session, URL 누락/invalid·cancel/error/invalid message | Proxy·legacy·anonymous session 시작 0, failed UI |
| UCAP03-05 | API typed unavailable | legacy fallback 0, 재시도 가능한 오류 문구 |

API service fixture와 공유하는 type만 import하고, fake `runRecommendationSession`/adapter를 주입해 화면의 결정만 검증한다. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 실제 Worker/Supabase/Kakao 호출·배포는 0회다.

### 인계

`API-4-A-ACT-04-B-R`과 이 작업이 모두 수락되면 통합·결정이 runtime 조립과 fail-closed를 확인한다. 그 뒤에만 사용자가 Worker/Turnstile/Supabase Dashboard 설정을 시작한다.

---

## 2026-08-28 — UIUX 작업 완료: U-1-CAP-03 one-shot CAPTCHA token·Proxy/legacy 조립

### 변경 내용

| 이전 방식 → 문제 | 교체 방식 | 이유 / 상태 |
| --- | --- | --- |
| CAPTCHA 성공 token을 폐기한 뒤 legacy 추천을 시작 | `onVerified(token) → startRecommendation(token, true) → runRecommendationSession(..., { routeProxyEnabled, captchaToken })` 한 호출 스택으로만 전달 | token은 state/ref/navigation/storage/log에 남기지 않으면서 활성 Proxy factory가 한 번만 소비한다. **현행** |
| Auth 상태와 무관하게 CAPTCHA UI 경계만 존재 | `EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true'`에서만 Proxy gate를 적용 | false/누락은 CAPTCHA 없이 legacy adapter만 사용하고, Proxy+기존 session은 token 없이 활성 factory를 사용한다. **현행** |
| Proxy 활성 경로의 factory 부재/실패에 legacy fallback 위험 | Proxy mode는 activated factory만 선택하고 typed `RouteProxyUnavailableError`를 재시도 가능한 안전 확인 오류로 표시 | 인증·경로 연결 실패를 legacy 외부 호출로 숨기지 않는다. **현행** |
| 모듈 로드시 Supabase public 설정을 요구 | Proxy gate를 통과한 activated factory 호출 시에만 production ports를 동적 로드 | flag false의 legacy와 UI fixture는 Supabase 설정·외부 호출 없이 동작한다. **현행** |

### 변경 파일 / 유지한 경계

- `src/ui/TimeSetupScreen.tsx`: public Proxy flag·Auth session·검증된 Worker URL로 gate를 결정하고, 성공 token을 한 번의 추천 호출에만 전달한다.
- `src/ui/captchaRecommendationGateModel.ts`: legacy/Proxy/CAPTCHA/fail-closed 결정과 typed Proxy unavailable 오류 문구를 화면 상태와 분리했다.
- `src/ui/recommendation/v1Session.ts`: UI runtime 옵션으로 legacy 또는 API service의 activated Proxy factory를 선택한다. Proxy ports는 gate 통과 뒤에만 로드한다.
- `test/ui/captcha-recommendation-gate-model.test.ts`, `test/ui/recommendation-runtime-boundary.test.ts`, `test/map-transport-ui-contract.test.mjs`: UCAP03-01~05의 flag/session/valid URL/token 전달/fail-closed/legacy fallback 금지를 고정했다.
- `src/services/` factory 내부, Worker·Turnstile·Supabase 설정/배포, 엔진·DB·카탈로그·작업조정 보드는 수정하지 않았다. 실제 Worker/Supabase/Kakao 호출은 0회다.

### 검증 / 다음 조건

- 통과: `npm run test:typecheck`, `npm run test:ui` (110 pass, 1 skip), `npm test` (99 pass), `git diff --check`.
- 다음 세션은 실제 Worker/Turnstile/Supabase Dashboard 설정과 별도 비식별 smoke에서 Proxy flag true의 신규·기존 session 흐름을 확인해야 한다. 해당 설정과 운영 호출은 UIUX 소유 범위 밖이다.

### 2026-08-28 — 통합·결정 검토: U-1-CAP-03 수락

Proxy flag false에서는 CAPTCHA 없이 legacy adapter만 선택되고, Proxy flag true에서는 기존 session을 우선 사용하거나 검증된 Worker URL에서 받은 one-shot token을 한 호출 스택으로만 전달한다. token은 UI state·ref·navigation·storage·로그에 보관하지 않으며, Proxy/Auth/Edge 오류는 legacy fallback 없이 안전 확인 오류로 끝난다.

통합 재실행에서 gate/runtime fixture **5/5**, 관련 활성 Proxy·CAPTCHA Worker fixture를 포함한 선택 검증 **19/19**, `npm run test:typecheck`, `npm run test:ui` **114 통과·1 skip**, `npm test` **99 통과**, `git diff --check`가 통과했다. 따라서 **U-1-CAP-03을 수락**한다. 다음 실제 검증은 Dashboard 설정 뒤 비식별 iOS smoke이며, 이 수락만으로 public flag를 켜거나 legacy adapter를 제거하지 않는다.

---

## 2026-08-29 — 통합·결정 지시 U-1-CAP: CAPTCHA WebView 실패 원인 분리

### 관찰과 목표

QA-04는 Worker가 기본 `Hello World!`를 반환한 초기 실패 뒤, Worker artifact·production public site key 정상화까지 마친 상태에서 같은 일반 문구로 다시 실패했다. 공개 root는 이제 `200 text/html`, `Cache-Control: no-store`, 제한 CSP 및 Turnstile/React Native bridge marker를 반환한다. anonymous Auth·Route Proxy·Kakao 호출은 두 실행 모두 0회다.

현 `CaptchaVerificationSheet`는 invalid URL, 최상위/보조 frame navigation 거부, WebView network/HTTP error, Worker의 Turnstile `error` message, 신뢰하지 않는 message source/payload를 모두 `failed`와 같은 사용자 문구로 합친다. 따라서 Worker·Turnstile·Supabase 설정을 다시 추측하거나 QA 재시도를 반복하면 안 된다. 이 작업의 목표는 **실제 다음 한 번의 QA 실행에서 실패 경계를 하나로 확정할 수 있게** 만드는 것이다.

### 소유 범위와 금지 경계

UIUX 세션은 `src/ui/CaptchaVerificationSheet.tsx`, `src/ui/captchaVerificationModel.ts`, 필요 최소 UI fixture, 이 작업기록만 수정한다. Worker, Turnstile Dashboard, Supabase Auth/Edge, API adapter, 엔진, DB, 카탈로그, `docs/작업조정_보드.md`는 수정하지 않는다.

실제 CAPTCHA token·site/secret key·JWT·raw URL·HTTP body·좌표·검색어는 화면·console·테스트·문서에 기록하지 않는다. 외부 API·anonymous Auth·Route Proxy·Kakao 호출은 구현/fixture에서 0회다.

### 구현 계약

1. CAPTCHA modal 한 번의 open/retry 시도에 대해 최초 terminal failure만 아래의 **고정 enum** 중 하나로 만든다. raw URL/상태코드/message/token은 enum에 포함하지 않는다.

   - `invalid_config`
   - `top_navigation_blocked`
   - `subframe_navigation_blocked`
   - `webview_network_error`
   - `webview_http_error`
   - `widget_error`
   - `message_source_rejected`
   - `message_payload_rejected`

2. navigation 판정은 기존 보안 규칙(최상위 exact Worker root, 보조 frame은 Cloudflare/about만)을 완화하지 않는다. `isTopFrame`이 누락된 native event를 허용으로 추측하지 말고, 별도 실패 범주 또는 기존 top navigation 차단으로 결정적으로 처리한다. 실제 iOS event shape를 전제로 보안 허용 범위를 넓히는 수정은 금지한다.
3. `onError`, `onHttpError`, `onMessage`, `onShouldStartLoadWithRequest`, invalid URL 각각이 위 하나의 범주로 귀결돼야 한다. 정상 token/cancelled와 retry는 failure diagnostic을 만들지 않는다. callback 중복·여러 하위 resource event가 발생해도 modal 시도당 첫 실패 enum만 보존한다.
4. 일반 사용자 문구는 그대로 유지한다. 단, **internal test build에서만** 별도 `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS === 'true'`일 때 `CAPTCHA 진단: <enum>`을 오류 문구 아래에 표시한다. production/flag false에서는 이 텍스트와 raw error를 표시·로그하지 않는다. 이 flag는 key·개인정보가 아니지만 앱 bundle에 공개되는 값이므로 테스트 build에만 주입한다.
5. 진단 enum은 token state·navigation params·storage·analytics·DB에 저장하지 않는다. QA는 visible enum과 시나리오 ID만 기록하고, 실제 QA 후에는 앱 process를 종료한다.

### 필수 fixture·완료 기준

1. model fixture로 여덟 failure source → enum mapping, first-failure-wins, retry reset, token/cancelled 무진단을 고정한다.
2. UI 계약 fixture로 internal flag true/false의 표시 차이, production 문구 유지, external route/auth/provider 호출 0, raw URL/key/token 미표시를 검증한다.
3. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다.
4. 완료 기록에는 변경 파일, 유지한 보안/외부 경계, fixture 결과, 새 internal build 필요 여부만 남긴다. 원인을 추측해 “해결”로 기록하지 않는다.

**다음 인계:** 이 작업 수락 후 동일 Worker URL·Proxy flag에 `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS=true`만 추가한 internal build를 만들고, QA-04 신규 session을 **한 번만** 실행한다. 나온 enum이 `widget_error`이면 Turnstile widget 설정만, navigation enum이면 UI WebView 경계만, config/network/http enum이면 해당 설정/전달 경계만 후속으로 다룬다. 그 전에는 2-J·ODsay 제거·추가 QA 재시도를 금지한다.

---

## 2026-08-29 — UIUX 작업 완료: U-1-CAP CAPTCHA WebView 실패 진단 분리

### 변경 내용

| 이전 방식 → 문제 | 교체 방식 | 이유 / 상태 |
| --- | --- | --- |
| invalid config·navigation·WebView·widget·message 실패가 모두 동일한 일반 오류 | 각 WebView mount의 첫 terminal failure를 8개 비밀 없는 고정 enum으로 분류 | 다음 QA-04 1회에서 실패 경계를 재현 가능하게 식별한다. raw URL·HTTP 상태·message·token은 포함하지 않는다. **현행** |
| 하위 resource callback이 뒤늦게 오면 사용자 오류 원인이 바뀌거나 성공 callback으로 이어질 가능성 | `firstCaptchaFailure`와 ref로 첫 실패만 보존하고, retry mount에서만 초기화 | 실패 후 bridge event가 인증을 시작하지 않으며, retry는 독립 시도다. **현행** |
| production 사용자도 내부 원인 텍스트를 볼 수 있음 | `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS === 'true'`인 internal test build에서만 `CAPTCHA 진단: <enum>` 표시 | 일반 사용자 문구는 유지하고, 공개 bundle 값도 테스트 build에서만 주입한다. **현행** |

### 변경 파일 / 유지한 경계

- `src/ui/captchaVerificationModel.ts`: failure enum, navigation 분류, first-failure-wins, diagnostics flag 순수 모델을 추가했다.
- `src/ui/CaptchaVerificationSheet.tsx`: invalid config/navigation/network/HTTP/widget/message callback을 enum으로 연결하고, internal flag에서만 enum을 표시한다.
- `test/ui/captcha-verification-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: 8개 enum, navigation fail-closed, 첫 실패 보존/retry reset, internal flag 표시와 raw 오류 미노출 계약을 고정했다.
- Worker·Cloudflare·Turnstile Dashboard·Supabase Auth/Edge·API adapter·엔진·DB·카탈로그·작업조정 보드는 수정하지 않았다. 외부 API·anonymous Auth·Route Proxy·Kakao 호출은 0회다.

### 검증 / 다음 조건

- 통과: `npm run test:typecheck`, `npm run test:ui` (117 pass, 1 skip), `npm test` (100 pass), `git diff --check`.
- 새 internal build에는 기존 Worker URL·Proxy flag를 유지하고 `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS=true`만 주입한다. 이후 QA-04 신규 anonymous session을 1회 실행해 visible enum과 시나리오 ID만 기록하고 앱 process를 종료한다. 이 구현은 원인 해결이 아니라 원인 분리다.

### 2026-08-29 — 통합·결정 검토: U-1-CAP 수락

- **수락 근거:** URL 설정·최상위/보조 frame navigation·WebView network/HTTP·widget·message source/payload의 실패가 8개 고정 enum으로 분리됐고, 첫 terminal failure만 보존하며 retry에서만 초기화된다. 진단은 internal build의 `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS=true`에서만 보이고 token·key·raw URL·HTTP body는 표시하거나 저장하지 않는다.
- **재검증:** `npm run test:typecheck`, `npm run test:ui`(117 통과·1 skip), `npm test`(100 통과), `git diff --check`를 통과했다.
- **다음 단계:** 기존 Worker URL·Proxy flag를 유지한 새 internal build에서 QA-04 신규 session을 한 번만 실행한다. 나온 enum이 원인 확정 전까지 Worker/Cloudflare/Supabase 설정 변경, 2-J, ODsay 제거, 추가 smoke를 진행하지 않는다.

---

## 2026-08-29 — 통합·결정 재개 지시 U-1-CAP: iOS WebView Turnstile 보조 문서 허용 경계 수정

### 재현 근거와 판정

- 진단 build의 QA-04에서 `webview_network_error`가 확인됐다. 이는 token, Supabase Auth, Route Proxy, Kakao 이전의 WebView 최상위 load failure다.
- **같은 iOS 기기 Safari**에서 동일한 Cloudflare Worker root는 성공했다. 따라서 Worker 배포·Turnstile hostname/site key·기기 DNS/HTTPS/ATS를 다시 바꾸는 작업은 금지한다.
- 현 `captchaAllowedOrigins()`은 `about:srcdoc`을 문자열 그대로 `originWhitelist`에 넣는다. 그러나 설치된 `react-native-webview`는 whitelist 비교 전에 URL을 origin 형태인 `about:`으로 추출한다. 따라서 `about:srcdoc`은 whitelist에 매치되지 않고, Turnstile이 요구하는 보조 문서를 WebView 밖으로 넘기거나 차단할 수 있다. 이 transport whitelist와 실제 navigation 보안 판정을 같은 문자열 목록으로 취급한 것이 결함이다.

### 소유 범위

UIUX 세션은 `src/ui/CaptchaVerificationSheet.tsx`, `src/ui/captchaVerificationModel.ts`, 최소 UI fixture, 이 작업기록만 수정한다. Worker·Cloudflare Dashboard·Turnstile·Supabase Auth/Edge·API adapter·iOS `Info.plist`·엔진·DB·카탈로그·`docs/작업조정_보드.md`는 수정하지 않는다.

### 구현 계약

1. `originWhitelist`는 **WebView transport 통과용 상위 집합**으로만 사용한다. challenge origin과 `https://challenges.cloudflare.com`은 유지하고, `about:srcdoc`/`about:blank`을 전달할 수 있도록 `about:*`을 사용한다. `about:*`는 최종 허용 규칙이 아니다.
2. 실제 보안 판정은 계속 `onShouldStartLoadWithRequest → captchaNavigationFailure()`만 담당한다. 최상위는 exact Worker root 하나, 보조 frame은 `https://challenges.cloudflare.com` 및 정확한 `about:blank`/`about:srcdoc`만 허용한다. 다른 `about:` URL, 다른 HTTPS origin, HTTP, deep link, javascript/data는 거절한다.
3. token message source는 기존처럼 exact Worker root만 신뢰한다. `about:*` 추가를 이유로 Cloudflare frame 또는 임의 about 문서의 `postMessage`를 신뢰해서는 안 된다.
4. `webview_network_error` 진단·일반 사용자 문구·first-failure-wins·retry reset·internal build 전용 표시를 유지한다. raw native error/URL/token/key는 새로 표시·로그·저장하지 않는다.

### 필수 검증과 완료 기준

1. 순수 fixture에서 `about:srcdoc` 및 `about:blank`은 transport whitelist와 navigation guard를 모두 통과하고, `about:evil`은 transport whitelist에는 통과해도 navigation guard에서 거절됨을 검증한다. 기존 exact Worker·Cloudflare·message source 및 거절 규칙 회귀도 포함한다.
2. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 실제 Worker/Supabase/Kakao 호출은 0회다.
3. 완료 뒤 **같은 진단 build에서 QA-04 신규 session을 정확히 한 번만** 재실행한다. 성공이면 widget→Auth→Proxy 제한 smoke를 이어가고, 실패면 visible enum만 기록하고 중단한다. 원인을 추측해 추가 Cloudflare 설정을 바꾸지 않는다.

---

## 2026-08-29 — UIUX 작업 완료: U-1-CAP iOS WebView `about:` transport whitelist 보정

### 변경 내용

| 이전 방식 → 문제 | 교체 방식 | 이유 / 상태 |
| --- | --- | --- |
| `originWhitelist`에 `about:blank`·`about:srcdoc`을 개별 문자열로 전달 | react-native-webview가 비교 전에 `about:` origin으로 정규화하면 `about:srcdoc`이 transport 단계에서 차단될 수 있음 | transport whitelist에 `about:*`을 사용 | Turnstile 보조 문서 transport를 허용한다. **현행** |
| transport whitelist와 최종 보안 guard를 같은 허용 목록으로 취급 | `about:*`가 임의 about 문서까지 최종 신뢰하는 것처럼 확대될 위험 | `isAllowedCaptchaNavigation`은 정확한 `about:blank`/`about:srcdoc`만 subframe에 허용, message source는 exact Worker root만 신뢰 | `about:evil`·Cloudflare/about message·다른 origin은 계속 차단한다. **현행** |

### 변경 파일 / 유지한 경계

- `src/ui/captchaVerificationModel.ts`: WebView transport whitelist만 `about:*`으로 교체했고, navigation/message 보안 판정은 변경하지 않았다.
- `test/ui/captcha-verification-model.test.ts`: `about:blank`·`about:srcdoc` transport/guard 통과, `about:evil` guard 거절, about message source 거절을 고정했다.
- Worker·Cloudflare Dashboard·Turnstile·Supabase Auth/Edge·iOS `Info.plist`·API adapter·엔진·DB·카탈로그·작업조정 보드는 수정하지 않았다. 실제 Worker/Supabase/Kakao 호출은 0회다.

### 검증 / 다음 조건

- 통과: `npm run test:typecheck`, `npm run test:ui` (117 pass, 1 skip), `npm test` (100 pass), `git diff --check`.
- 같은 diagnostics internal build로 QA-04 신규 anonymous session을 정확히 1회 재실행해야 한다. 성공 시에만 widget→Auth→Proxy 제한 smoke로 진행하며, 실패면 visible enum과 시나리오 ID만 기록하고 종료한다.

### 2026-08-29 — 통합·결정 검토: U-1-CAP transport whitelist 보정 수락

- **수락:** `about:*`은 react-native-webview transport 단계에만 추가됐으며, 최종 navigation guard는 `about:blank`·`about:srcdoc`만, token message source는 exact Worker root만 신뢰한다. 따라서 Turnstile 보조 문서 차단 결함을 고치면서 임의 about 문서·다른 origin·보조 frame 메시지를 허용하지 않는다.
- **재검증:** `npm run test:typecheck`, `npm run test:ui`(117 통과·1 skip), `npm test`(100 통과), `git diff --check`를 통과했다.
- **다음 작업:** `QA-04`를 같은 diagnostics 설정의 새 anonymous session으로 한 번만 실행한다. 성공 시에만 Auth→Proxy→Kakao 제한 smoke를 이어가며, 실패 시 enum만 기록하고 추가 재시도·설정 변경은 하지 않는다.

---

## 2026-08-29 — 통합·결정 재개 지시 U-1-CAP: iOS WKWebView load failure 비밀 없는 세분화

### 새 관찰과 목표

`about:*` transport 보정 뒤 같은 diagnostics QA에서 다시 `webview_network_error`가 나왔다. 같은 기기 Safari에서는 Worker root가 성공하므로, Worker·Turnstile·hostname·기기 일반 인터넷 문제가 아니라 **앱 WKWebView load delegate 경계**로 확정된다. 다만 현재 enum 하나는 TLS 신뢰·DNS·오프라인·연결 실패·WebView process 종료를 구분하지 못한다.

이 작업의 목표는 native error 원문, URL, 상태 코드, token을 보여 주지 않으면서 다음 QA-04 한 번의 결과를 수정 가능한 iOS 범주 하나로 좁히는 것이다. `about:*` 보정이나 Worker/Cloudflare/Supabase 설정을 되돌리거나 바꾸지 않는다.

### 소유 범위

UIUX 세션은 `src/ui/CaptchaVerificationSheet.tsx`, `src/ui/captchaVerificationModel.ts`, 최소 UI fixture, 이 작업기록만 수정한다. Worker·Cloudflare·Turnstile·Supabase·API adapter·`Info.plist`·엔진·DB·카탈로그·`docs/작업조정_보드.md`는 수정하지 않는다.

### 구현 계약

1. 기존 일반 `webview_network_error`를 아래 **고정·비밀 없는** 진단으로 세분화한다. 화면에는 `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS === 'true'`일 때만 이 식별자 하나만 보인다.

   - `webview_offline`
   - `webview_dns_failure`
   - `webview_connection_failure`
   - `webview_tls_failure`
   - `webview_load_failure` (알려지지 않은 native load 실패의 유일한 fallback)
   - `webview_process_terminated`

2. `onError` native event의 domain/code는 순수 model에서 위 범주로만 매핑하고, UI·console·테스트 출력·문서에 원문 domain/code/description/url을 표시·저장하지 않는다. 알려지지 않은 값은 반드시 `webview_load_failure`로 귀결한다. `onContentProcessDidTerminate`도 별도 범주로 연결한다.
3. `onHttpError`·navigation·widget·message 범주, first-failure-wins, retry reset, Worker exact URL/message source, `about:*` transport과 최종 navigation guard의 분리는 그대로 유지한다. 새 진단을 이유로 실패 후 token/Auth/Proxy를 시작해서는 안 된다.
4. 테스트는 알려진 iOS `NSURLErrorDomain`의 offline(-1009), DNS(-1003), connection/timeout(-1004/-1001), TLS(-1200)와 unknown domain/code fallback, content-process termination을 고정한다. 실제 native 오류를 fixture·문서에 복사하지 않는다.

### 완료 및 다음 실행

`npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 통과시킨다. 완료 뒤 같은 diagnostics 설정에서 QA-04 신규 session을 **정확히 한 번만** 실행해 표시된 범주와 시나리오 ID만 기록한다. 그 결과 전에는 Worker/Cloudflare/Supabase 변경, 2-J, ODsay 제거, 반복 smoke를 하지 않는다.

### 2026-08-29 — 통합·결정 정정: WebView 세분화 구현 지시 철회, 환경 URL 오타 수정

- **확정 원인:** QA 화면의 `webview_network_error` 뒤 `.env.local`의 `EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL`을 직접 대조한 결과, Worker hostname 끝의 `.workers.dev`가 중복돼 존재하지 않는 HTTPS host를 가리키고 있었다. 형식은 HTTPS root라 UI resolver를 통과하지만, WKWebView의 DNS/load 단계에서 실패한다.
- **교체:** 공개 Worker root `https://timefit-captcha.sdongheun.workers.dev/`로 local runtime 설정을 수정했다. 같은 기기 Safari에서 이 정상 URL이 열린 관찰과 일치한다.
- **철회:** 바로 위의 native error 세분화 구현은 시작하지 않는다. 현재 `webview_network_error`는 이번 URL 오타를 충분히 식별했고, 원문/코드 진단을 더 추가하면 필요한 범위를 넘긴다.
- **다음 단계:** Metro cache를 비우고 재시작한 뒤 새 anonymous session으로 QA-04를 한 번만 수행한다. Worker·Cloudflare·Supabase·WebView 보안 옵션은 이 원인 때문에 변경하지 않는다.

---

## 2026-08-29 — 통합·결정 대기 지시 U-1-CAP: Auth·Route Proxy 안전 진단 표시

### 선행 조건과 목적

QA-04는 CAPTCHA token callback 뒤 일반 `RouteProxyUnavailableError` 문구로 끝났지만, 현재 UI는 Supabase 익명 Auth 실패와 route-proxy 실패를 분리하지 않는다. 먼저 `API-4-A-ACT-04-B`가 `RouteProxyUnavailableError.reason`의 고정 비밀 없는 계약을 수락해야 한다. 이 작업은 그 계약이 수락되기 전에는 시작하지 않는다.

### 소유 범위

UIUX 세션은 `src/ui/TimeSetupScreen.tsx`, `src/ui/captchaRecommendationGateModel.ts`, 필요한 UI fixture, 이 작업기록만 수정한다. `src/services/`, Worker/Cloudflare, Supabase, 엔진, DB, 카탈로그, `.env*`, `docs/작업조정_보드.md`는 수정하지 않는다.

### 구현 계약

1. production/`EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS !== 'true'`에서는 기존 일반 문구 `안전 확인 또는 경로 연결을 완료하지 못했어요. 다시 시도해 주세요.`를 정확히 유지한다.
2. diagnostics flag가 exact `true`일 때만 `RouteProxyUnavailableError.reason`을 `CAPTCHA 진단: <reason>`으로 일반 문구 아래에 표시한다. 이 값은 화면 state에만 두며 navigation, storage, analytics, console, DB에 저장하지 않는다.
3. `RouteProxyUnavailableError`가 아닌 예외의 message/cause를 diagnostics 화면에 보여 주지 않는다. token/JWT/좌표/URL/HTTP 상태·본문/provider key/user ID는 어떤 경우에도 표시하지 않는다.
4. CAPTCHA sheet의 Worker URL/navigation/message 정책, one-shot token 전달, 기존 session CAPTCHA 0회, legacy fallback 금지, retry 상한은 바꾸지 않는다.

### fixture·완료 기준

API reason별 표시와 production 비표시, non-typed error 비표시, token/navigation/storage/analytics 전달 0을 UI fixture로 고정한다. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 통과한다.

**다음 인계:** API와 UI 작업이 모두 수락되면 QA-04 신규 anonymous session을 한 번만 실행한다. visible reason이 `anonymous_auth_failed`면 Supabase Auth CAPTCHA/anonymous 설정만, `route_proxy_*`면 Edge/Proxy 설정만 검토한다. reason 없이 일반 오류가 나오면 UI contract 결함으로 되돌린다.

---

## 2026-08-29 — UIUX 작업 완료: U-1-CAP Auth·Route Proxy 안전 진단 표시

### 변경 내용

| 이전 방식 → 문제 | 교체 방식 | 이유 / 상태 |
| --- | --- | --- |
| Auth와 Proxy fail-closed 오류가 동일한 일반 문구로만 끝남 | 수락된 `RouteProxyUnavailableError.reason`만 diagnostics build의 화면 state에 전달 | 다음 QA-04 1회에서 Supabase anonymous Auth와 route-proxy 실패 경계를 구분한다. **현행** |
| 내부 diagnostics가 일반 예외의 임의 message까지 표시할 위험 | typed `RouteProxyUnavailableError`일 때만 reason을 반환하고, 다른 error의 diagnostic은 항상 null | raw error/cause·token/JWT·좌표·URL·HTTP 원문을 표시하지 않는다. **현행** |
| diagnostics 식별자가 production UI에도 나타날 가능성 | `EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS === 'true'`일 때만 `CAPTCHA 진단: <reason>` 표시 | production의 기존 일반 문구와 재시도 경험을 그대로 유지한다. **현행** |

### 변경 파일 / 유지한 경계

- `src/ui/captchaRecommendationGateModel.ts`: 일반 사용자 문구와 typed reason-only diagnostics 표시 모델을 분리했다.
- `src/ui/TimeSetupScreen.tsx`: typed Proxy 실패 reason만 내부 diagnostics 화면 state에 두고, 새 추천 시작 시 이를 초기화한다.
- `test/ui/captcha-recommendation-gate-model.test.ts`, `test/map-transport-ui-contract.test.mjs`: diagnostics true/false, typed/non-typed error, reason-only 화면 표시와 raw detail 미노출을 고정했다.
- `src/services/` reason 계약, Worker/Cloudflare/Supabase·엔진·DB·카탈로그·`.env*`·작업조정 보드는 수정하지 않았다. 실제 Auth/Route Proxy/Worker/Kakao 호출은 0회다.

### 검증 / 다음 조건

- 통과: `npm run test:typecheck`, `npm run test:ui` (118 pass, 1 skip), `npm test` (101 pass), `git diff --check`.
- UI와 API reason 계약이 모두 수락되면 QA-04는 diagnostics internal build의 신규 anonymous session으로 정확히 1회 실행한다. `anonymous_auth_failed`는 Supabase Auth CAPTCHA/anonymous 설정만, `route_proxy_*`는 Edge/Proxy 설정만 검토하며, 실패 시 visible reason과 시나리오 ID만 기록하고 종료한다.

---

## 2026-08-29 — 통합·결정 검토: U-1-CAP 수락

- **수락:** `RouteProxyUnavailableError.reason`만 internal diagnostics 화면 state로 전달되며, production의 일반 오류 문구, one-shot token 비저장, Worker navigation/message 허용 경계는 바뀌지 않았다. typed error가 아닌 예외의 원문은 표시하지 않는다.
- **재검증:** `npm run test:typecheck`, `npm run test:ui`(118 통과·1 skip), 전체 `npm test`(101 통과), `git diff --check`를 통과했다. 실제 Worker·Supabase Auth/Edge·Kakao 호출은 0회다.
- **다음 작업:** QA는 `QA-04`로 새 anonymous session에서 한 번만 실행한다. 표시된 `CAPTCHA 진단: <reason>`과 시나리오 ID만 기록하며, 실패 시 재시도·설정 변경 없이 종료한다.

---

## 2026-08-29 — 통합·결정 대기 지시 U-1-REC-01: 2-J runtime 주입과 검증 불가 설명

### 선행 조건과 목적

API-4-D가 수락되어 활성 Route Proxy route port가 `CourseV1RouteAdapter`와 `CourseV1RouteReceiptAdapter`를 함께 제공한 뒤에만 시작한다. 이 작업은 Proxy 활성 추천이 실제로 2-J의 8회 attempt·후보 보충 경로를 사용하게 하고, 결과가 없을 때 사용자가 이해할 수 있는 안전한 이유를 표시한다.

### 소유 범위와 금지 경계

UIUX 세션은 `src/ui/recommendation/v1Session.ts`, `src/ui/ResultsScreen.tsx`, 필요한 UI model/fixture와 이 작업기록만 수정한다. `src/engine/`, `src/services/`, Route Proxy/Edge, 데이터·DB, `.env*`, 작업조정 보드는 수정하지 않는다. 실제 API/Auth/CAPTCHA/위치 요청은 0회다.

### 구현 계약

1. `EXPO_PUBLIC_ROUTE_PROXY_ENABLED === true`이고 API-4-D port 생성에 성공하면, `runRecommendationSession`은 같은 port를 `routes`와 `receiptRoutes`로 함께 주입한다. 따라서 Proxy 활성 추천은 2-J receipt 예산 경로를 반드시 사용한다.
2. Proxy 비활성 local/test 모드는 기존 legacy `routes`만 주입해 기존 고정 fixture를 유지한다. Proxy가 활성인데 receipt port가 없거나 생성 실패하면 legacy/근사/ODsay/TMAP fallback 없이 현재의 재시도 가능한 오류로 끝낸다.
3. 결과 없음은 `primaryOutcomeReason`을 안전한 사용자 문장으로 표시한다. provider명·quota·HTTP·좌표·token/JWT·cache 상태는 표시하지 않는다.
   - `no_eligible_candidates`: “이 위치와 시간에 추천 조건을 통과한 장소가 부족해요.”
   - `no_open_candidates`: “지금 운영 중인 추천 장소가 부족해요.”
   - `time_budget_exceeded`: “이동과 머무름을 합쳐 도착 시각 안에 들어오는 코스를 찾지 못했어요.”
   - `route_not_verified`: “실제 이동 경로로 가능한 코스를 확인하지 못했어요.”
   - `route_verification_unavailable`: “지금은 이동 경로를 확인할 수 없어 추천하지 않았어요. 잠시 후 다시 시도해 주세요.”
   - 기존 result에 reason이 없는 경우에만 현재의 일반 빈 상태 문구를 유지한다.
4. 대표·대안 카드의 순서, 카카오맵 CTA, navigation session 직렬화, CAPTCHA one-shot token 비저장, internal diagnostics 정책은 바꾸지 않는다. 최대 8개 대안의 펼치기 UX와 장소 중심 재추천은 이 작업 범위가 아니다.

### 필수 fixture와 완료 기준

- proxy enabled/disabled 각각에서 engine input의 `receiptRoutes` 주입 여부를 고정 fixture로 검증한다. enabled인데 receipt port가 없는 경우 engine·legacy route 요청 0회와 안전 오류를 검증한다.
- 여섯 reason과 reason 없는 기존 result의 Results 빈 상태 문구를 순수 model 또는 화면 계약 fixture로 검증한다. 금지 정보가 화면 tree·navigation params·storage에 없는지도 확인한다.
- `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 완료 기록에는 변경 파일·변경하지 않은 API/엔진 경계·테스트 결과·다음 QA 필요 조건을 남긴다.

**다음 인계:** 수락 뒤 QA가 proxy-enabled 고정 fixture에서 8 attempt 상한·후보 보충·reason 표시를 E2E로 확인한다. 실제 Kakao 호출 수는 이 UI 작업에서 측정하지 않는다.

### 완료 기록 — U-1-REC-01 (UIUX)

1. **변경 파일과 목적:** `src/ui/recommendation/v1Session.ts`에서 proxy 활성 포트를 `routes`와 `receiptRoutes`에 같은 객체로 조립하고, receipt 포트 부재·생성 실패는 legacy fallback 없이 `RouteProxyUnavailableError`로 정규화했다. `src/ui/recommendation/courseV1OutcomeMessageModel.ts`와 `src/ui/ResultsScreen.tsx`에서 여섯 `primaryOutcomeReason`을 provider-free 사용자 문구로 표시하고, reason 없음·범위 밖 reason은 기존 일반 빈 상태 문구를 유지했다. UI fixture와 정적 계약 fixture도 이를 고정했다.
2. **유지한 공개 계약·정책 경계:** `src/engine/`, `src/services/`, Route Proxy/Worker/Cloudflare/Supabase, 데이터·DB, `.env*`, navigation session 직렬화, CAPTCHA one-shot token 비저장, 대표·대안 카드 순서와 카카오 CTA는 변경하지 않았다. 실제 API/Auth/CAPTCHA/위치 요청은 0회다.
3. **검증:** `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 통과했다. enabled/disabled engine-input receipt 주입, 활성 factory 실패 시 legacy route 호출 0회 및 typed safe error, 여섯 사유와 일반 fallback 문구를 고정 fixture로 검증했다.
4. **다음 결정·위험·재현 조건:** QA는 API-4-D 수락 포트를 쓰는 proxy-enabled 고정 fixture에서 2-J의 8 attempt 상한·후보 보충·결과 reason 표시를 E2E로 확인한다. 실제 provider/CAPTCHA/네트워크를 호출하지 않으며, receipt port가 누락되거나 생성에 실패한 경우에는 Time Setup의 기존 재시도 가능한 안전 오류가 보여야 한다.

### 통합·결정 수락 (2026-08-29)

U-1-REC-01을 수락한다. Proxy 활성 시 같은 route port가 `routes`와 `receiptRoutes`에 함께 주입되고, port 누락·생성 실패는 legacy 요청 0회로 안전 오류가 된다. 여섯 outcome reason은 provider·quota·HTTP·좌표·token 없이 고정 사용자 문구로만 표시하며, reason 없는 기존 빈 상태는 유지한다. 통합 재실행에서 `npm run test:ui` 118 통과·1 skip, 전체 `npm test` 101/101, typecheck, diff 검사가 통과했다. 다음은 QA-05다.
