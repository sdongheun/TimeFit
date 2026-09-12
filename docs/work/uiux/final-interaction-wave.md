# 최종 UI·네비게이션·Live Activity 작업 묶음

2026-09-08 사용자 요청 기반 실행 명령. 아래 작업 ID별 범위를 독립적으로 완료·인계한다. 이전 U-MAIN-COURSE-POLISH-01의 사용자 실기기 확인 4개(설정/문구 변경, 코스 가시성, 고정 행동, 앱·LA 공유 상태)는 확인 완료로 접수했다. 아래는 추가 보완이며 앞선 성공을 실패로 되돌려 해석하지 않는다.

## 실행 순서·소유권

1. **U-MAIN-MAP-POLISH-02**: 일반 UI와 지도 카메라 버튼. 먼저 실행 가능.
2. **U-MAIN-STACK-01**: 1번 완료 후 같은 UIUX 세션에서 실행.
3. **U-LIVE-ACTIVITY-FINAL-02**: 2번 완료 후 UIUX/native 담당 세션에서 실행. 네이티브 완료 액션이 앱 열기·완료 controller·navigation과 겹칠 수 있어 전체 구현은 병렬 금지.

1번 진행 중 3번의 읽기 전용 조사/테스트 설계는 별도 UIUX/native 세션에서 병렬 가능하나 App.tsx/nav/화면/controller/공유 payload 파일은 쓰지 않는다. DATA-PLACE-PHOTO-RECHECK-01은 세 작업과 병렬 가능하며 UI는 카탈로그/사진 허용목록을 수정하지 않는다. 같은 세션에서 여러 에이전트를 무조건 생성할 필요는 없다. 최종 QA는 세 구현 인수인계 뒤 한 번에 수행한다.

공통 필수 읽기: AGENTS.md, docs/README.md, UIUX 공통 규칙·테스트 명세, docs/테스트.md, main-course-final-polish.md 완료 인계 및 해당 작업 절 전체. 과거 정책 재도입 금지. 추천/180분·2곳/날짜/소유권·개인화/기록 보존 정책 불변. 운영 API/DB 반복 호출·데이터 삭제·C 재실행·commit/push는 하지 않는다.

## U-MAIN-MAP-POLISH-02

상태: 2026-09-08 UI 구현·자동 검증 완료, 최소 실기기·통합 수락 대기. 이전 압축 UI → 추가 문구/상태/상세 밀도 보완 요청 → 다음 표현으로 교체 → 이해와 가시성 개선.

1. Home 제목은 ‘약속 전 남는 시간,\n어디 들러볼까요?’로 의도된 줄바꿈을 둔다. 작은 화면/큰 글씨에서 추가 자연 줄바꿈은 허용하고 잘라내지 않는다. 소제목 ‘약속 시간에 맞춰 들를 만한 곳을 찾아드려요.’ 추가. 이어가기 유지.
2. Results 빈 결과는 실제 공급/시간 검증/경로 실패/통신 실패 근거로 문구를 구분한다. 원인 불명은 단정하지 않는다. 일반 대안은 ‘설정한 시간 안에 들를 수 있는 장소를 찾지 못했어요.’이며 API 실패를 장소 부재로 표현하지 않는다. 시간·위치 재설정 버튼의 일관된 패딩/폭/문구 간격을 적용한다. 미검증 후보의 정상 더보기는 유지한다.
3. 첫 장소 선택 후 실제 추가 후보 계산 pending 상태에 ‘함께 들를 곳을 찾고 있어요’와 로딩 표시를 제공한다. 선택 tray 유지, 취소 가능, 이전 후보를 새 결과처럼 선택하게 하지 않는다. 취소/다른 선택 이후 늦은 응답이 화면을 덮어쓰지 않아야 한다. 결과 있음/없음/실패/재시도와 pending을 구분하고 최소 표시시간이나 신규 API 호출은 추가하지 않는다.
4. review 장소 카드는 기본 작은 사진+이름, 아래 ‘상세 보기’/‘접기’ 컨트롤로 기존 카테고리·허용 체류 정보 등을 확장한다. 버튼에 expanded 접근성 상태 제공. 방문 순서·전체 시간·구간 이동은 카드 밖에서 유지한다. 필요한 사진 출처/권리 표시는 접어서 누락시키지 않는다. active 주요 버튼은 이 확장 안으로 이동하지 않는다. 코스/장소 변경 시 확장 상태가 다른 장소로 전이되지 않게 한다.
5. 현재 진행 점은 기존 테마와 어울리는 따뜻한 앰버로 교체한다. 취소/오류의 빨간색과 구별한다. 현재만 점등, 완료/예정 구분 및 Reduce Motion 정적 강조 유지. 사용자 추가 결정 전 전체 버튼/지도 테마는 바꾸지 않는다.
6. 시간 설정 다음 계산 화면의 점등+텍스트 묶음을 safe area 내 가용 화면 중앙에 배치한다. 여러 행은 그룹 전체만 중앙 배치하고 내부 점/텍스트 정렬은 일관되게 유지한다. 실제 pending/success/failure와 기존 진행 모델을 유지하며 가짜 완료/지연 전환 금지.
7. 사용자용 지도(주변 탐색·장소 상세·코스 지도·위치 선택·기록 지도)의 현재 조작 가능 화면을 먼저 목록화한다. 모서리에 ‘내 위치로 이동’ 카메라 버튼을 제공하거나 기존 버튼을 재사용해 중복을 막는다. GPS 실제 현재 좌표로 카메라만 이동하고 탐색 기준/출발·도착/선택 장소/코스/기록/추천은 바꾸지 않는다. 위치 선택 화면에서도 위치 확정은 별도 행동이다. 정적 미리보기 등 적용이 불가능한 표면은 이유와 제외 범위를 인계한다. 권한 상태/실패는 기존 서비스 재사용, 권한 없으면 설명·명시 요청 경로 제공, 실패 시 기존 지도 유지. 백그라운드/지속 GPS 추적 추가 금지. 시트·탭바·범례·지도 출처를 가리지 않고 safe area와 44pt 터치 영역을 확보한다. 반복 자동 fit으로 즉시 원위치 복귀시키지 않는다.

검증: Home 두 줄/소제목·큰 글씨, 빈 결과 원인별 fixture, 추가 추천 지연/실패/취소/늦은 응답/재시도, review 확장·사진 없음·출처·긴 이름·active 행동 유지, 현재 앰버/동작 줄이기, 로딩 중앙 레이아웃, 지도 GPS 성공/거절/실패/지연 시 카메라 외 상태 불변을 실패 선행 fixture로 검증한다.

## U-MAIN-STACK-01

선행 U-MAIN-MAP-POLISH-02의 UI 구현·자동 검증은 완료됐다. 이번 요청에서는 아래 스택/LA 후속을 실행하지 않았다. 각각의 작업 지시로 이어서 진행할 수 있다.

상태: 1번 완료 후 실행. 이전 강제 특정 화면 이동/상태 유실 가능성 → 사용자 직전 화면 복귀 요청 → 메인 내부 스택을 일관화 → 탐색 연속성 개선. 현재 동작 조사 후 이미 정상인 흐름은 재구현하지 않는다.

- App.tsx/nav/mainTabNavigation 단일 작성자 확보. 현재 화면 전환·뒤로가기·gesture/hardware back·deep link 진입을 표로 정리하고 실패 fixture를 먼저 만든다.
- 메인→설정→추천→장소 상세→추천 상태 갱신→코스 review 흐름에서 직전 유효 화면으로 복귀하고 입력/선택/목록 스크롤을 보존한다. 상세 선택은 새 추천 화면 push가 아니라 기존 추천 상태 갱신이다. 모달은 먼저 닫는다. 탭 간은 좌우 슬라이드 없이 즉시 전환한다.
- 코스 시작은 탐색 스택의 일반 back과 구분한다. active 뒤로가기는 진행을 유지한 채 메인으로 돌아가 이어가기를 제공하며 시작 전 화면으로 돌아가 중복 시작하지 않는다. 완료/취소 뒤 back으로 종료된 코스가 재활성화되지 않는다. 외부 지도 복귀·LA cold/warm 진입도 기존 run/controller 유지.
- 저장/완료/동의/로그아웃·계정 전환 때의 보호 경계는 유지한다. 정책상 안전하지 않은 ‘무조건 이전 페이지’는 구현하지 않는다. 기능상 새로운 선택이 필요하면 재현 경로·대안을 인계한다.

검증: 깊이별 back·연속 back·상세 선택/취소·설정 값 유지·탭 왕복·active 이어가기·완료/취소 후 back·external 복귀·LA cold/warm action·중복 시작0을 고정 fixture로 검증한다. 3번 담당에게 실제 route/진입/완료 controller 계약을 인계한다.

## U-LIVE-ACTIVITY-FINAL-02

상태: 읽기 전용 조사는 병렬 가능, 구현은 2번 인계 후. live-activity-dwell-progress.md의 최신 수락 및 live-learning-evidence-integration.md의 최신 학습 경계와 실제 소스를 읽는다. 과거 무반응 버튼/앱 복귀 필요 버그를 복원하지 않는다.

1. 잠금화면 및 확장 Island의 장소명·상태는 왼쪽, 현재 유효한 행동(도착했어요/이제 출발해요)은 오른쪽에 배치한다. 긴 이름·큰 글씨에서 겹침을 막고 compact/minimal Island는 공간에 맞춰 요약한다. 모든 크기에 동일 버튼을 억지로 노출하지 않는다.
2. 앱에서 ‘코스 마치기’가 가능한 동일 최종 단계에만 LA 완료 액션을 추가한다. 중간 단계 상시 완료·취소 대체 기능은 만들지 않는다. 실제 최종 가능 조건을 앱 controller로 확인하고 같은 근거를 쓴다.
3. 현재 iOS/AppIntent 실행 경계와 앱의 완료 저장 경로를 조사한 뒤 가장 작은 연결로 구현한다. extension이 JS/인증/DB 저장을 임의 복제하지 않는다. 잠금 해제·앱 활성화가 필요하면 명시 완료 의도를 기존 내구 pending/receipt 패턴에 맞춰 전달한다. 앱에 들어온 뒤 같은 완료 버튼을 다시 누르게 하지 않는다. OS 잠금 해제를 우회하거나 항상 잠금화면 단독 완료한다고 약속하지 않는다.
4. 앱/LA는 동일 완료 controller 사용. run/step/revision·계정/동의 유효성 검증, 중복·오래된 action·cold/warm launch·계정 변경·취소 후 action 무효화를 유지한다. 완료 기록1회·학습 적격 표본만 기존 규칙대로 저장·Activity/알림 정리 순서를 보존한다. 의도 접수만으로 기록 성공을 표시하지 않는다. 실패는 기존 앱 재시도/명시 기록 없이 마치기 정책으로 연결하며 자동 포기하지 않는다. 타이밍 증거가 없으면 학습 제외 정책을 완화하지 않는다.
5. plugins/live-activity 등 실제 소스 생성 경계를 먼저 확인하고 생성된 iOS 파일만 임시 수정하지 않는다. role 밖 저장/RPC/공유 계약 확장이 필요하면 직접 변경하지 말고 인계한다. 최신 Apple 공식 자료 확인이 필요하면 공식 문서로만 확인한다.

검증: 레이아웃·단계별 액션, 앱/LA 각각 완료·연타·동시 액션·stale run·계정 변경·cold/warm pending·실패/재시도·취소 경합·기록/표본 중복0을 fixture/순수 native harness로 검증한다. 기존 첫 길찾기 즉시 Activity·도착 상태 동기화·출발 자동 지도 이동 회귀를 유지한다. native 빌드/서명 검증을 iOS export로 대체하지 않는다. 필요한 새 internal build 방법·빌드 식별값과 잠금화면/Island 최소 실기기 시나리오를 인계한다. 실기기 없이 OS 액션 성공으로 표시하지 않는다.

## 각 작업 공통 종료 기준

각 ID별 변경 파일/목적, 유지 계약, 실패 선행 및 test:typecheck/test:ui/npm test/iOS export 결과, 위험·다음 역할 인계·최소 실기기 항목을 본 문서 해당 완료 절에 기록한다. native 변경은 별도 빌드 결과 포함. 중앙 정책 파일은 직접 덮어쓰지 않는다. 공개 계약 변경은 역할에 인계한다. 자동 PASS와 OS/시각 확인을 구분하고 새로운 DB·API 작업을 근거 없이 추가하지 않는다.

## U-MAIN-MAP-POLISH-02 완료 인수인계 — 2026-09-08

### 1. 변경 파일 / 목적

- `src/ui/HomeScreen.tsx`: 제목의 쉼표 뒤 명시 줄바꿈과 승인된 소제목 적용. 줄 수 제한 없이 자연 추가 줄바꿈 허용, 이어가기/프로필/설정 callback 유지.
- `src/ui/ResultsScreen.tsx`: 빈 결과의 단정적인 상태별 제목을 중립 제목으로 교체. 기존 `courseV1OutcomeMessage(primaryOutcomeReason)`로 공급/운영/시간/경로 미검증/확인 불가를 구별하고 근거 없는 경우 승인된 일반 안내 사용. API 확인 불가를 장소 부족으로 표시하지 않는다. reset 버튼 전체 폭·수평20/수직14 패딩·상단20 간격 적용. 정상 미검증 후보 더보기는 별도 유지.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`: 실제 controller pending에만 ‘함께 들를 곳을 찾고 있어요’와 ActivityIndicator 표시. pair_loading 동안 전달된 이전 후보는 선택 카드로 렌더하지 않는다. 기존 skeleton/tray/취소 및 완료·없음·실패·더보기 controller 상태 유지. 최소 표시 시간/추가 호출 없음.
- `src/ui/recommendation/CourseV1VerticalDetail.tsx`, `src/ui/CourseConfirmScreen.tsx`: review의 기본 작은 사진/이름과 ‘상세 보기/접기’ 확장. expanded 접근성 상태 제공. 카테고리·계획 체류만 확장 안에 두고 출처/권리 링크·순서/이동/전체 시간은 접어도 유지. session ISO+course ID 및 장소/체류별 key로 다른 코스에 확장 상태가 전이되지 않는다. active 주요 행동은 기존 fixed footer에 유지한다.
- `src/ui/recommendation/CourseStepIndicator.tsx`: 현재 점만 블루→기존 C.amber. 완료 체크/예정 빈 원, 현재만 점등 및 Reduce Motion 정적 강조 유지. 버튼·지도 색상 일괄 변경0.
- `src/ui/TimeSetupScreen.tsx`, `src/ui/recommendation/RecommendationLoadingProgress.tsx`: 기존 loading 묶음을 위/아래 safe area를 제외한 가용 영역 중앙에 배치. 그룹 maxWidth280/가용 폭100%, 내부 행/텍스트 정렬 유지. 실제 stage와 pending/success/failure 전환·소요시간 조작 없음.
- `src/ui/MapCameraButton.tsx`: 기존 Expo Location foreground 권한/1회 GPS API를 재사용하는 UI 경계. 기본44pt 버튼, 권한 설명→명시 허용/설정 열기, 요청 중복 lock·15초 실패 경계·좌표 검증·scope 변경/unmount 후 늦은 응답 무효화. 원본 오류/좌표/계정 로그·저장 없음. 지도 콜백만 소유한다.
- `src/ui/KakaoRouteMap.tsx`: ready인 공용 지도에 카메라 버튼 제공, 기존 `focusMap` imperative bridge 사용. safe area와 caller별 모서리 offset 확보. props/route/session 변경 없이 카메라만 이동한다.
- `src/ui/NearbyBrowseScreen.tsx`, `src/ui/NearbyBrowseMap.tsx`: 기준 위치가 있는 경우 기존 헤더 현위치 버튼 자리에서 공용 카메라 버튼을 재사용한다. `cameraPoint`는 탐색 center와 분리하며 JS panTo만 실행한다. center/목록/선택/상세/호출 상태는 바꾸지 않는다. 기준 위치가 없는 초기 화면은 기존 명시 기준 설정 행동을 유지한다.
- `src/ui/MapPlacePicker.tsx`, `src/ui/PlaceDetailScreen.tsx`, `src/ui/CompletedPlacesMapButton.tsx`: 위치 선택/장소 상세의 상단 컨트롤을 피하는 offset, 모달 비표시 시 카메라 버튼 해제, 정적 기록 미리보기의 cameraControl=false. 기록의 조작 가능한 전체 지도는 버튼 유지.
- 테스트: `test/ui/main-map-polish.test.mjs` 신규; `main-course-polish.test.mjs`, `place-course-screen-runtime.test.mjs`, `nearby-browse-screen.test.mjs`, `nearby-browse-map-document.test.mjs`, `two-stop-selection.test.ts`, `test/map-transport-ui-contract.test.mjs`의 철회된 문구/기본 펼침 기대 교체 및 공개 화면/HTML 실행 회귀. `test/ui/support/screenRuntime.mjs`는 다른 화면 테스트에서 camera component를 대역화하고 dedicated 테스트는 실제 component와 고정 Location 포트를 실행한다.

현재 지도 적용 목록:

| 표면 | 적용 / 배치 | 카메라 외 상태 |
| --- | --- | --- |
| 주변 탐색 | 기존 헤더 현위치 자리 재사용, 중복 없음 | 탐색 기준·거리순 목록·선택/상세 유지 |
| 장소 상세 | 공용 지도 우상단, 닫기 아래 offset72 및 safe area | 상세/선택/추천 유지 |
| V1 코스 review/active | 지도 우측 offset100, 위 경로 상태/아래 범례와 분리 | 실제 경로·순서·진행/footer 유지 |
| 위치 선택 modal | 헤더 아래 inset+68 | 화면의 중앙 위치 draft만 지도 이동을 따라가며 출발/도착/선택 값 확정은 기존 별도 CTA에서만 수행 |
| 기록 전체 지도 modal | 헤더 아래 공용 지도 우상단 | 방문 기록/목록/삭제 상태 불변 |
| legacy Execution/OneStop 지도 | 공용 지도 버튼 상속, safe area 적용 | 코스/탐색 입력·추천/저장 불변 |
| 기록 작은 정적 preview | 제외: pointerEvents=none인 전체 지도 열기 썸네일, cameraControl=false | 전체 지도 modal에서 조작 가능 |
| 지도 키 없음/로드 실패/준비 중 | 카메라 버튼 미표시 또는 기존 실패 화면 유지 | 기존 목록/대체 안내 유지 |

### 2. 유지한 계약

- 추천·180분/최대2곳·날짜/원본 종료·소유권/개인화·완료 기록·알림·LA 공유 상태/controller·권리 gate 유지. U-MAIN-COURSE-POLISH-01의 사용자 확인4항목을 반려하거나 재구현하지 않았다.
- GPS는 명시 버튼당 최대1회이며 자동/백그라운드/지속 추적 추가0, reverse geocode 추가0. 위치 선택의 임시 중심은 아직 확정된 출발/도착이 아니며 별도 확인 전 외부 선택 callback0. 카메라 조작을 추천 위치 변경으로 연결하지 않는다.
- 공용 map document를 재생성하지 않고 focusMap/panTo만 사용한다. 동일 route/동일 nearby payload의 일반 재렌더는 fit을 반복하지 않는 기존 경계를 유지한다. 실제 새 코스/선택·경로/레이아웃 변경의 기존 fit 자체를 폐기하지 않았다.
- 원인 코드는 엔진의 공개 근거만 소비한다. `route_verification_unavailable`만으로 특정 provider/네트워크 장애를 추정하지 않고 ‘이동 경로 확인 불가·재시도’로 안내한다. 새로운 오류 세분화 계약이나 운영 API 호출을 임의 추가하지 않았다.
- App.tsx/nav/mainTabNavigation/native·DB·엔진·카탈로그·사진 허용목록·중앙 문서·보드 수정0. 운영 API/DB/C·Simulator/실기기 자동 조작·stage/commit/push0.

### 3. 실패 선행 / 자동 검증 결과

- 신규 pending 문구/indicator 및 camera 진입 fixture2건을 먼저 작성하고 수정 전 실패 확인 (`/private/tmp/timefit-map02-red.log`). 이후 실제 component/고정 GPS로 권한·명시 요청·중복·실패·잘못된 좌표·scope 변경 후 지연 무효화를 확인했다.
- 집중 지도/화면74/74 PASS (`/private/tmp/timefit-map02-focused2.log`). 생성 HTML 실제 파싱/실행 및 ready, 카메라 pan 후 동일 데이터 재렌더 fit 추가0/선택 메시지 추가0, 실제 공용 map의 focusMap 주입과 문서 안정성 검증 포함.
- 추가 동작6/6 PASS (`/private/tmp/timefit-map02-behavior-final.log`): 실제 빈 Results 원인5종/불명·reset callback/폭, pending stale 후보 비노출, review 접기/펼침·코스 key 변경 reset·active 분 비노출, GPS 반례. 사진 출처는 기존 실제1/2곳 CourseConfirm의 접힌 초기 상태에서도2건 유지되는 회귀로 확인했다.
- 기존 실제 선택 controller의 늦은 응답/취소/다른 선택/더보기, LA/app 진행·고정 footer·중복 handoff·날짜/저장/학습 회귀를 유지했다. 과거 ‘기본 review 체류 표시’ 기대는 먼저 상세 보기를 눌러 동일 snapshot 분을 검사하도록 변경했으며 active 비노출 검증은 유지했다.
- `npm run test:typecheck`: PASS (`/private/tmp/timefit-map02-type-complete.log`).
- `npm run test:ui`:682건,681 PASS / 기존1 SKIP / 실패0 (`/private/tmp/timefit-map02-ui-complete.log`).
- `npm test`:352/352 PASS (`/private/tmp/timefit-map02-all-accepted.log`). 이전 로딩 문구와 resultState 단독 원인 분기를 요구하던 소스 기대는 새 문구/primaryOutcomeReason 소비로 교체했다. 실제 실패 분기 테스트를 삭제/skip하지 않았다.
- `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-map02-ios-complete`: PASS (`/private/tmp/timefit-map02-export-complete.log`). JS/Hermes export이며 OS 지도/GPS/실기기 수락 아님. native 파일 변경 없음.
- `git diff --check`: PASS.

### 4. 다음 역할 / 최소 실기기·위험

- U-MAIN-STACK-01로 인계 가능. main 탐색 스택/뒤로가기 정책은 이번에 변경하지 않았으며 이 문서의 별도 절대로 조사·실행해야 한다. U-LIVE-ACTIVITY-FINAL-02 배치/완료 액션도 미착수다. 전체 세 작업의 최종 QA 수락으로 표시하지 않는다.
- 사용자 확인: Home 의도된 두 줄/소제목, 작은 화면·큰 글씨 loading 중앙과 내부 정렬, 실제 pair pending 취소/다른 선택, empty 원인별 안내/재설정, review 접기/펼침·출처·긴 이름/사진 없음, 현재 앰버/Reduce Motion 확인.
- 지도별 위 표 순서로 ‘내 위치로 이동’1회, 거절→설명/명시 허용·설정, GPS 실패에서 기존 지도 유지 확인. 주변은 거리순 목록과 기준 주소가 유지되고, 위치 선택은 지도 이동 뒤 **이 위치로 확정**해야 입력 값이 바뀌는지 확인한다. 카메라 뒤 단순 재렌더로 원위치 복귀하지 않아야 한다.
- 시트 최대 높이·큰 글씨·상단 safe area·범례·지도 출처·44pt 버튼 가림은 실제 native 렌더러에서 최종 확인해야 한다. 자동 harness는 포트/상태/스타일/실측 입력/HTML 실행을 검증하며 실제 지도 타일/GPS 정확도·권한 UI·스크린리더·픽셀 가림을 대체하지 않는다. 실기기/Simulator는 이번에 실행하지 않았다.
- 이미 시작된 OS 단발 GPS 요청은 취소 API 없이 늦게 반환될 수 있으나 scope/unmount 이후 camera callback은 차단한다. 위치 저장이나 장기 추적은 없다. 사진 재조사의 신규 근거는 데이터 소유 세션 인계 전 추정하지 않는다.

## U-MAIN-MAP-POLISH-02 사용자 이미지 반환 보완 — 2026-09-08

### 1. 변경 파일 / 목적

- `src/ui/CourseConfirmScreen.tsx`, `src/ui/KakaoRouteMap.tsx`: 이전 지도 내부 top100 배치와 화면 safe inset 최소값 강제 → 사용자 이미지에서 버튼이 우측 중간에 위치 → 코스 지도는 명시적인 지도 내부 top12/right12로 교체. 공용 지도는 명시 offset을 존중하고 미지정일 때만 기존 safe inset+12 기본값을 사용한다. 경로 상태 안내의 오른쪽을68로 확보해 버튼과 겹치지 않게 했다. 위 완료 기록의 코스 offset100은 철회, top12가 현행이다.
- `src/ui/recommendation/RecommendationLoadingProgress.tsx`: 이전280pt/100% 폭 그룹 내부의 좌측 정렬과 label flex1 → 부모만 중앙이어도 보이는 점·문구가 왼쪽에 치우침 → 외부 중앙 컨테이너와 내용 폭의 내부 공유 열로 분리. 행별 점/텍스트 열은 유지하고 label flexShrink로 좁은 폭에서 줄바꿈을 허용한다. 기존 넓은 고정 그룹 방식은 철회, 내용 묶음 중앙 배치가 현행이다.
- `test/ui/main-map-polish.test.mjs`, `test/ui/place-course-screen-runtime.test.mjs`: 실제 공용 지도 offset/safe area 기본값, 실제 로딩 컴포넌트 공유 열 스타일, CourseConfirm 전달값 회귀 추가. 본 문서에 반환 원인과 결과 기록.

### 2. 유지한 계약

- GPS 권한·1회 요청·실패/중복/늦은 응답 경계, 지도 카메라 전용 이동, 코스 snapshot·진행·Live Activity·추천·시간·저장·사진 계약은 변경하지 않았다.
- 로딩 실제 stage·점등·Reduce Motion 유지. 가짜 지연이나 완료 전환 추가0. 다른 화면 디자인/탭/스택·엔진·API·DB·중앙 문서·보드 수정0. stage/commit/push0.

### 3. 검증 결과

- 실패 선행: 신규2건 실패/기존6건 통과 확인 (`/private/tmp/timefit-map-return-red.log`), 수정 후8/8 통과 (`/private/tmp/timefit-map-return-green.log`). 실제 stage verifying와 CourseConfirm 전달값을 포함한 추가 집중 회귀는 `/private/tmp/timefit-map-return-focused.log`에 기록.
- `npm run test:typecheck` PASS, `npm run test:ui` 684건 중683 PASS/기존1 SKIP, `npm test` 354/354 PASS. 로그: `/private/tmp/timefit-map-return-{type,ui,all}.log`.
- iOS export PASS: `/private/tmp/timefit-map-return-ios`, 로그 `/private/tmp/timefit-map-return-export.log`. `git diff --check` PASS. native 변경 없음.

### 4. 남은 확인 / 위험

- 자동 테스트는 컴포넌트 연결·스타일 계약 검증이며 Yoga 픽셀 렌더링 실측이 아니다. 사용자에게 코스 지도 우상단 버튼, 로딩 점·문구 묶음 중앙, 큰 글씨에서 줄바꿈과 안내/버튼 가림 여부만 확인 요청한다.
- Simulator·실기기 조작과 실제 GPS/API 호출은 실행하지 않았다. 새 native 의존성이 없으므로 개발 빌드는 JS 새로고침으로 확인 가능하고, 번들 내장 Release는 새 번들이 포함된 빌드가 필요하다.

## U-MAIN-STACK-01 완료 인수인계 — 2026-09-08

선행 지도 우상단 버튼·로딩 점/문구 중앙 배치는 사용자가 정상 확인했다. 해당 배치를 유지했다. 본 작업은 UIUX 단일 작성자로 수행했고 App.tsx/nav/mainTabNavigation의 기존 변경을 덮어쓰거나 다른 역할에 병렬 위임하지 않았다. 보드에는 해당 신규 ID가 없으므로 역할 README의 현행 링크와 사용자 명령을 실행 기준으로 사용했다.

### 1. 변경 파일 / 원인 / 현재 화면 전환

- `src/ui/TimeSetupScreen.tsx`: 일반 추천 성공의 replace가 입력 화면을 제거 → Results 뒤로가기 시 입력 복귀 불가 → 성공 후 입력 page/실행 lock 복원 및 navigate로 동일 입력 화면 보존. QA는 기존 launcher 복귀 유지. 이전 일반 replace 방식은 철회, 일반/QA 모두 원래 입력 화면을 남기는 방식이 현행이다.
- 같은 파일: 계산 중 시스템 back/unmount 이후 늦은 응답이 latestResults·navigation에 반영될 수 있음 → 실행 epoch 검사와 loading 제거 방지 callback으로 입력 복귀·후속 반영 차단. QA 실행 토큰 취소도 연결하되 이미 시작된 외부 요청의 물리적 취소를 보장하지 않는다. 자동 재실행/호출 예산 확대 없음.
- `src/ui/ResultsScreen.tsx`: raw beforeRemove 방식 → native-stack 공통 usePreventRemove 경계로 교체. 현재 보이는 Results에서만 A/B 선택을 먼저 취소하며 원래 카드·스크롤을 복구한다. 숨겨진 Results는 active/완료 reset을 차단하지 않는다. 설치된 native-stack의 preventedRoutes 소비 경계를 확인했다. 정상 상세 선택 handoff/focus 복귀는 재구현하지 않았다.
- `src/ui/CourseConfirmScreen.tsx`: review→active가 내부 상태만 갱신해 route bridge에는 activeId가 없었음 → 동일 activeId를 setParams로 전달. 추가 push나 controller 생성 없이 현재 화면을 식별한다. 이 결함은 코드 경계로 확인했으며 실기기 중복 진입 발생 자체를 새로 재현했다고 주장하지 않는다.
- 테스트: `test/ui/main-stack-navigation.test.mjs` 신규, `unified-time-route-setup.test.mjs`, `place-course-screen-runtime.test.mjs` 실행형 검증 확대. `main-map-polish.test.mjs`, `release-preflight-handoff.test.mjs` navigation 대역을 새 사용 메서드/훅에 맞춤. `qa-release-one-stop-launcher.test.ts`, `two-stop-selection.test.ts`의 철회된 replace/raw beforeRemove 소스 기대만 교체. 기존 실패/저장 회귀를 삭제하지 않았다.

| 진입/행동 | 현재 처리 / 보존 근거 |
| --- | --- |
| Home→TimeSetup→Results | native navigate, 입력 route key/입력값 유지, 계산 성공 후 lock 해제 |
| Results→PlaceDetail→선택/닫기 | 기존 goBack+일회 handoff/focus 소비, 같은 Results/ScrollView 유지, 추천 추가 push0 |
| Results→CourseConfirm review→back | 기존 stack pop, 선택·추천 세션 유지 |
| 선택 중 header/system/gesture back | usePreventRemove가 선택부터 취소, A 직전 목록/720px fixture 스크롤 복원, 다음 back은 입력으로 |
| 검색/지도/CAPTCHA/개발 하위 화면 back | 기존 모달/내부 page 먼저 닫기 유지. loading은 입력 복구 후 늦은 결과 무효화 |
| review→active | 동일 화면 상태+route activeId 동기화, stack 증가0 |
| active back | 기존 usePreventRemove→Home reset, 같은 courseRunId/진행 보존·Home 이어가기 |
| 완료/취소 뒤 back | 기존 기록/Home 등 단일 root reset, 이전 CourseConfirm stack 제거, 종료 코스 재활성화0 |
| 메인/주변/기록/내정보 탭 | 기존 reset 단일 root 및 App의 animation:none 유지, 탭 스택 누적0. 입력/Results에는 탭바를 새로 만들지 않음 |
| 외부 지도 복귀 / LA cold·warm | 기존 AppFlow 복구→pending route gate→CourseConfirm 소비/claim 유지. 현재 동일 activeId는 추가 navigation하지 않음 |

### 2. 유지한 계약

- UX-02/UX-30·UXV-50의 입력 보존/계층 전환 보완이다. 정상 map/loading 스타일·탭 외형·native push/pop 기본 전환은 불변이다.
- App.tsx/nav/mainTabNavigation는 읽기·실제 router 검증만 했으며 제품 수정0. 중앙 문서·보드·engine·DB·API·카탈로그·native 파일 수정0. 현재 활성 코스·종료 repository·계정 격리/로그아웃·동의·학습·180분/2곳·예산 불변.
- 화면을 떠난 결과 무효화는 UI publish/navigation만 막는다. 진행된 provider 호출을 없었던 것으로 처리하거나 학습/취소/완료를 합성하지 않는다. 앱 삭제/운영 데이터/API/C·Simulator·실기기 자동 조작·stage/commit/push0.

### 3. 실패 선행 및 자동 검증

- 입력 보존/계산 중 back 실패 선행 `/private/tmp/timefit-stack-red.log`; native 선택 guard 실패 `/private/tmp/timefit-stack-selection-red.log`; active route 식별 전달 실패 `/private/tmp/timefit-stack-active-red.log`. 수정 후 실제 컴포넌트 callback·focus·unmount·late response·원래 스크롤·단일 선택 소비·외부 handoff·완료 실패/재시도/중복 회귀를 전체 suite에서 통과했다.
- 실제 설치된 StackRouter/CommonActions를 실행해 깊이별/연속 back, route key 유지, 탭 왕복 단일 root, Home/기록 reset 후 종료 화면으로 back 불가를 검증했다. router harness는 RESET의 partial state를 실제 navigator처럼 rehydrate하도록 보완했다. iOS gesture 렌더링 실측은 아니다.
- `npm run test:typecheck` PASS (`/private/tmp/timefit-stack-type-accepted.log`).
- `npm run test:ui` 688건:687 PASS/기존1 SKIP/실패0 (`/private/tmp/timefit-stack-ui-accepted.log`).
- `npm test` 358/358 PASS (`/private/tmp/timefit-stack-all-accepted.log`).
- iOS export PASS (`/private/tmp/timefit-stack-ios-accepted`, `/private/tmp/timefit-stack-export-accepted.log`). `git diff --check` PASS. 네이티브 빌드/OS 실행 결과로 대체 표기하지 않는다.

### 4. 다음 담당 / 최소 실기기 확인

- 사용자 확인: 입력→추천→상세 닫기/선택→review 뒤로가기에서 입력/선택/스크롤 유지. 선택 중 back1회 취소/다음 back 입력 복귀. 계산 중 back 후 결과가 늦게 화면을 다시 열지 않는지 확인.
- iOS edge-swipe와 헤더 back, 모달 먼저 닫힘, 탭 즉시 전환, active back→Home 동일 진행 이어가기, 완료/취소 뒤 연속 back으로 종료 코스가 열리지 않는지 확인. 자동 callback/라우터 검증과 별개로 OS gesture 실기기 확인은 미실행이다.
- U-LIVE-ACTIVITY-FINAL-02 인계: 현재 route 식별은 CourseConfirm.params.activeId이며 review→active에서도 갱신된다. pending bridge는 기존 `createPendingNavigationRouteGate`의 동일 run/action 및 현재 route 검증을 그대로 사용한다. 완료는 CourseConfirm의 기존 finish/finishController→repository→runtime.finish→flow.clear→exitTarget reset 순서다. 완료 receipt 새 연결 시 이 경계를 재사용하고 별도 JS/DB 완료 writer를 만들지 않는다. 3번 작업은 아직 실행하지 않았다.

## U-LIVE-ACTIVITY-FINAL-02 사용자 보완 — ‘5분 뒤’ 제거 (2026-09-08)

### 1. 변경 파일 / 목적

- 이전: 도착 확인 옆에 1회 ‘5분 뒤’ 재알림 버튼 → 관찰: 명시 도착 시각을 쓰는 흐름에서 부가 행동의 의미가 불명확 → 사용자 승인으로 해당 버튼 제거 → 이유: 도착 확인 행동에 집중. 상태: 구현·자동 검증 완료, 이번 제거의 실기기 확인 전. 아래 기존 snooze 유지 기록은 호환 처리 이력이며 새 버튼을 복원하는 지시가 아니다.
- `plugins/live-activity/TimeFitLiveActivityExtension.swift`: 잠금화면/확장 Island 공용 actions에서 재알림 버튼 제거. prebuild로 `ios/TimeFitLiveActivityExtension/TimeFitLiveActivityExtension.swift` 동기화 및 원본 일치 확인.
- `src/ui/liveActivity/courseProgressNotifications.ts`: 로컬 도착 알림에서도 ‘5분 뒤’ 액션 등록 제거.
- `test/ui/live-activity-action-display.test.mjs`: 재알림 비노출과 도착·출발·완료 버튼 및 잠금화면/Island 공용 표시 유지 검사.

### 2. 유지한 계약

- 도착 확인 시 체류 시작, 출발 확인/성공 handoff의 체류 경계, 최종 완료·기록·학습·알림 정리 불변. 일반 도착 알림과 출발 권장 알림은 제거하지 않는다.
- 기존 `arrival_snoozed` receipt/Intent/상태 소비·정리와 1회 제한은 구버전 호환을 위해 유지한다. 과거 예약 알림을 일괄 삭제하거나 진행 중 코스를 초기화하지 않는다. DB/API/엔진/중앙 문서/보드 변경 없음.

### 3. 검증 결과

- 새 표시 계약 테스트가 기존 Swift 버튼에서 실패하는 것을 확인한 뒤 제거하여 통과. 이 테스트는 소스 표시 계약 검사이며 실제 OS 렌더링 검증이 아니다.
- typecheck PASS, UI 696건 중 695 PASS·기존 1 skip·실패0, 전체 362/362 PASS. 기존 arrival/departure/completion 및 구버전 snooze 복구 회귀 유지.
- iOS export PASS, Expo prebuild PASS, iPhone generic Release native build PASS (`CODE_SIGNING_ALLOWED=NO`, 이번 제거에서는 서명/설치 재검증하지 않음). template/generated 일치·diff check PASS.
- 로그: `/private/tmp/timefit-remove-snooze-{type,ui,all,prebuild,export,native}.log`. UI IPC와 Xcode sandbox 제한은 승인된 외부 실행으로 재검증했다. Simulator·실기기·운영 API/DB 실행 및 stage/commit/push 없음.

### 4. 다음 결정 / 실기기 확인

- 사용자 ‘잘 된다’는 이전 FINAL-02의 동작 확인으로 기록한다. 이번 버튼 제거는 앱/Extension 새 네이티브 빌드 설치 후 잠금화면·확장 Island에 도착 버튼만 표시되는지 확인해야 한다. JS 새로고침만으로 Extension은 바뀌지 않는다.
- 새 도착 알림 카테고리 등록 후 알림에도 재알림 버튼이 없는지, 도착→체류→출발 자동 길찾기→최종 완료가 유지되는지 최소 확인한다. 기존 OS에 등록된 알림 카테고리는 다음 동기화 전까지 이전 버튼이 남을 수 있다.
- 통합·결정 담당 인계: COURSE-13 및 관련 중앙 명세의 ‘1회 snooze’ 사용자 UI 요구를 이번 명시 승인에 맞춰 제거 이력으로 반영하되, 기존 receipt 호환 정책과 혼동하지 않는다.

## U-LIVE-ACTIVITY-FINAL-02 구현 인수인계 — 2026-09-08

상태: **구현·자동 테스트·iPhone 대상 Release 빌드 및 로컬 서명 검증 완료 / 새 internal build의 실기기 수락 전**. 위 ‘3번 미실행’은 STACK 마감 당시 이력이며 본 절로 갱신한다. OS 잠금화면 동작 성공을 자동 테스트로 대신 수락하지 않는다.

### 1. 변경 파일 / 목적과 이력

- `plugins/live-activity/TimeFitLiveActivityExtension.swift`: 잠금화면 정보 아래 버튼 행·확장 Island의 이름만 표시 → 정보와 액션 구분 및 최종 완료 버튼 부재 → 공용 상태/행동 View를 분리해 잠금화면 HStack의 정보 왼쪽/행동 오른쪽, expanded leading/trailing에 재사용. compact/minimal은 체류/이동·걷기 요약 유지. 긴 장소명/버튼은 세로 줄바꿈하고 오른쪽 영역 최대140pt를 둔다. 상태: 구현 현행·기기 크기별 시각 확인 전.
- `TimeFitActivityAttributes.swift`, `TimeFitLiveActivityModule.swift`, `src/ui/liveActivity/lifecyclePolicy.ts`, `courseProgressComposition.ts`: additive `completionEligible` 전송. 구형 ContentState는 false로 복구. 최종 목적지 traveling + 실제 route + 준비/실패 handoff 없음 + 비종료 상태에서만 true. 준비 중 final-destination sentinel만 보고 완료로 오인하지 않는다. 기존 도착·출발/테스트 fixture 상태 계약 보존.
- `TimeFitLiveActivityIntents.swift`, `TimeFitNativeIntentPolicy.swift`: `TimeFitCompletionIntent` 추가. 실제 course purpose, exact target/run/revision, final/no stop 및 eligible·무효화 여부를 확인하고 `openAppWhenRun`으로 앱 활성화 요청. 완료를 출발 receipt로 만들거나 native에서 DB 저장/Activity 종료하지 않는다. 중복 같은 완료 요청은 기존 pending을 재사용한다.
- `TimeFitActivityAttributes.swift`, `TimeFitLiveActivityModule.swift`, `TimeFitLiveActivityModuleBridge.m`, `src/ui/liveActivity/nativeLiveActivityPort.ts`, `pendingNavigationHandoffModel.ts`, `pendingNavigationRouteModel.ts`: 기존 내구 pending 저장/신호/transition/exact cleanup을 공유하되 purpose를 `course_progress_completion`으로 명시 구분. 필드는 기존 schema/actionId/run/stop/baseRevision/state뿐이며 URL·좌표·장소명·계정 원문은 없다. 기존 departure consumer는 completion purpose를 거절한다. completion의 cold executing은 기존 완료 repository 멱등성으로 재개하며, 출발 executing의 자동 재시도 금지 규칙은 그대로다.
- `src/ui/liveActivity/pendingCompletionModel.ts`, `completionAuthorization.ts`: final step/snapshot 매핑·local revision·미종료·준비 상태 없음·현재 run·계정 context를 검증하고 claim 후 동일 `finish` 호출. 중복 동시 소비 lock, 저장 실패는 pending failure/기존 앱 재시도 유지, 실제 성공 후에만 exact pending 정리. 체류 근거 누락은 완료 차단 이유로 사용하지 않으며 기존 학습 제외 정책에 맡긴다.
- `src/ui/CourseConfirmScreen.tsx`, `AppFlowContext.tsx`: 자동 완료는 기존 finish→completion controller→repository→runtime.finish→clear→기록 이동 경로를 공유한다. async 체류 조회 전후 현재 run/context 검사. `isActiveVerifiedCourseRun`은 state 렌더를 기다리지 않는 기존 provider ref의 읽기 전용 조회로, 취소/교체 직후 오래된 완료 쓰기를 막는다. 별도 완료 저장 writer/engine 정책 없음.
- `src/ui/AuthContext.tsx` 및 native pending store: 실제 owner 변경·로그아웃·복구 이벤트에서 completion capability만 무효화한다. 같은 owner 토큰 갱신/INITIAL_SESSION은 유지한다. 비민감 단일 run 취소표 `TimeFitCompletionRevokedRun-v1.json`을 남겨 A→B→A 또는 재시작 뒤 늦은 버튼이 같은 run의 완료 의도를 다시 만들지 않게 한다. 계정/토큰/동의 원문 저장0. 기존 arrival/departure·활성 진행·학습 projection 정책은 바꾸지 않았다.
- 진단 식별: `TimeFitLiveActivityDiagnostics.swift`, `src/ui/liveActivity/liveActivityDiagnosticsModel.ts` → native/JS 모두 **`ula-final-2026-09-08.1`**. 기존 진단 stream/개인정보 규칙 유지.
- 생성: 기존 config plugin의 `npx expo prebuild --platform ios --no-install`로 `ios/mobile/`, `ios/TimeFitLiveActivityExtension/` 소스를 동기화했다. 생성물만 임시 수정0, 새 dependency/App Group/entitlement/서버 설정0.
- 테스트: `test/ui/live-activity-final.test.ts`, `live-activity-final-native-port.test.mjs` 신규; `place-course-screen-runtime.test.mjs`, `fixtures/TimeFitNativeIntentPolicyHarness.swift` 확대. 본 문서 인수인계 작성.

### 2. 유지한 계약 / 실제 연결

`최종 외부 handoff 수락 → eligible ContentState → 완료 Intent의 exact 검증·내구 pending → 기존 Darwin signal/foreground·cold 복구 → pending route gate → 같은 CourseConfirm → readonly 소유 확인·claim → 기존 finish controller → 실제 local repository 성공 → runtime Activity/알림 정리·flow clear·기록 탭`.

- 완료 Intent 진입/앱 열림/pending 저장은 완료 기록 성공이 아니다. 실패·불명확을 성공으로 합성하지 않는다. `finishWithoutRecord`는 기존 실패 후 사용자 명시 행동에서만 가능하다.
- 소유 검증은 DB의 기존 `readOwnedCourseRunOwnership` 공개 readonly 계약만 소비하며 자동 소유 생성/추정은 하지 않는다. 읽기 실패/not_found/owner 불일치는 진행을 유지하고 자동 완료를 거절한다. guest/unverified의 기존 필수 완료 저장/학습 제외와 계정 기록 격리는 그대로다.
- 최초 Activity foreground 준비·실패 rollback, 잠금화면 도착 즉시 상태 공유·출발 자동 카카오맵, snooze1회, 같은 run 재사용/다른 run 충돌, 학습 당시 증거·3개/최근5개 정책, 180분·2곳·날짜/호출 예산·기록 멱등성 불변.
- DB·migration·engine·API·카탈로그·중앙 문서·보드 수정0. 서버 개인화 규칙 확대/운영 API·DB 실행/기기 설치·Simulator/stage/commit/push0. 기존 다른 세션 변경은 보존했다.

### 3. 실행 검증 결과

- 실패 선행 `/private/tmp/timefit-la-final-red.log`: 새 완료 검증 entry 부재로 실패 확인 후 구현. 최종 검증에는 중간/최종 1·2곳, stale revision/run/terminal/preparing, missing dwell, 동시 callback·cold executing·중복, 저장 실패, 계정 변경/되돌아오기·동의 version 변경, readonly owner mismatch/not_found를 포함한다.
- 실제 CourseConfirm fixture: 1곳·2곳 각각 pending 주입 → 추가 앱 tap0 → 기존 complete 호출1 → 활성 clear → 기록 탭 인계 통과 (`/private/tmp/timefit-lafinal-screen-accepted.log`). 기존 동일 controller의 실패/명시 재시도/기록 없이 마침/중복 저장/외부 길찾기 회귀를 전체 suite에서 유지했다.
- native port 실행형 fixture는 실제 TS bridge 모듈과 fake NativeModules로 purpose 전달·auth revoke1회·exact clear payload를 확인한다. Swift 정책 harness는 actual `TimeFitNativeIntentPolicy`를 swiftc로 빌드해 final/fixture/중간/terminal 액션 제한 및 기존 arrival/departure/snooze/pending 정책을 실행한다. Widget 실제 잠금화면 렌더링이나 App Group 잠금 상태 저장의 OS 검증은 아니다.
- `npm run test:typecheck` PASS (`/private/tmp/timefit-lafinal-type-complete.log`).
- `npm run test:ui`:695건,694 PASS/기존1 SKIP/실패0 (`/private/tmp/timefit-lafinal-ui-complete.log`).
- `npm test`:361/361 PASS (`/private/tmp/timefit-lafinal-all-complete.log`).
- iOS export PASS (`/private/tmp/timefit-lafinal-ios-complete`, `/private/tmp/timefit-lafinal-export-complete.log`).
- prebuild PASS, template→앱/extension 17개 파일 parity PASS. package.json 변경 없음 (`/private/tmp/timefit-lafinal-prebuild-accepted.log`).
- `xcodebuild -workspace ios/mobile.xcworkspace -scheme mobile -configuration Release -destination 'generic/platform=iOS' -derivedDataPath /private/tmp/timefit-lafinal-release CODE_SIGNING_ALLOWED=NO build`: BUILD SUCCEEDED (`/private/tmp/timefit-lafinal-native-accepted.log`).
- 같은 명령에서 CODE_SIGNING_ALLOWED=NO를 제외한 **기존 로컬 서명 Release 빌드도 BUILD SUCCEEDED**, main/extension CodeSign 완료 (`/private/tmp/timefit-lafinal-signed.log`). 프로필 신규 등록/다운로드 승인 플래그는 쓰지 않았다. `codesign --verify --deep --strict .../mobile.app`는 sandbox에서 trust 접근 오류 후 승인된 환경에서 exit0. 인증서 설정 변경0.
- `git diff --check` PASS. 빌드와 서명 성공은 설치·잠금해제·외부 지도·실기기 수락 증거와 구별한다.

### 4. 최소 실기기 / 남은 위험과 다음 인계

**새 native build 필수**. 기존 앱 삭제 없이 앱과 Extension을 함께 덮어 설치한다. Xcode `mobile` scheme·iPhone 대상 Release/internal 설정으로 실행하고 진단 native/JS가 모두 `ula-final-2026-09-08.1`인지 먼저 확인한다. 이번에 기기 설치/실행은 하지 않았다. 서명된 산출물은 `/private/tmp/timefit-lafinal-release/Build/Products/Release-iphoneos/mobile.app`이다.

1. 실제 1곳 코스: 첫 길찾기 즉시 Activity, 도착1회 상태 공유, 출발1회 잠금해제→카카오맵 자동 연결을 먼저 회귀 확인한다. 최종 목적지 이동 중에만 ‘도착 후 코스 마치기’가 나타나야 한다.
2. 실제 최종 도착 뒤 LA 완료1회→필요한 잠금 해제→앱에서 완료 버튼 재탭 없이 기록1건·진행/Activity/알림 정리. 잠금 해제를 취소했다면 완료 성공으로 표시되지 않아야 한다. 앱 재시작/중복 터치 후 기록 증가0 확인.
3. 2곳 코스는 첫 장소/두번째 장소 체류에서 완료 버튼 없음, 최종 목적지 구간에서만 완료 가능 확인. 잠금화면 및 expanded Island에서 긴 이름·큰 글씨의 왼쪽 정보/오른쪽 행동이 겹치거나 잘리지 않는지 확인. compact/minimal에는 완료 버튼을 넣지 않았다.
4. 실패 시 기존 코스와 Activity를 유지하고 앱 오류/명시 재시도 동작 확인. 자동 소유 proof가 없거나 읽기 실패면 완료를 억지로 진행하지 않는다. 계정 전환으로 무효화한 기존 run의 LA 완료는 재활성화하지 않으며, 기존 앱의 명시 완료 경로는 남긴다.

남은 위험: cross-process App Group 쓰기/무효화가 OS 또는 저장 실패로 실제 영속되지 못한 뒤 프로세스까지 종료되는 상황은 보장할 수 없다. 저장 실패를 성공으로 기록하지 않으며 readonly 소유/현재 context/현재 run을 추가 검증한다. 자동 fixture는 OS 저장 보호·잠금 해제·접근성/Island 공간을 대체하지 않는다. 기존 서명 프로필은 기기/만료 상태에 따라 설치 때 추가 승인이 필요할 수 있다. 후속 QA는 이 실기기 목록과 MAIN-MAP/MAIN-STACK 인계를 함께 확인하되 운영 개인화/C 재검증으로 범위를 확대하지 않는다.
