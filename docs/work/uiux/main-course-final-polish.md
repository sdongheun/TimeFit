# U-MAIN-COURSE-POLISH-01 — 메인·추천·코스 최종 표현 정리

상태: 2026-09-08 A→B 구현·자동 검증 완료, 최소 실기기 확인·통합 수락 대기. 담당 UIUX. 본문 전체가 실행 명령이다.

## 결정 이력·기준

U-RELEASE-UI-CLEANUP-01 후속 보완이며 폐기한 날짜 선택·조건부 추천을 복원하지 않는다. 기존 큰 카드/촘촘한 배치/분산된 진행 행동 → 순서 파악과 행동 접근 불편 → 여백 계층·작은 썸네일 타임라인·고정 주요 행동 → 정보 밀도와 진행 접근성 개선 → 확정·구현 전.

AGENTS.md, docs/README.md, UIUX 공통 규칙·테스트 명세, docs/테스트.md의 UX-MAIN-COURSE-POLISH-01, release-ui-cleanup.md 완료 인계를 읽고 현재 구현을 먼저 확인한다. 단계 A→B로 한 세션에서 수행하되 중간에 별도 QA 세션을 반복하지 않는다. 실패 fixture 선행 후 구현하고 마지막 전체 게이트로 마감한다.

## A. 메인·설정·추천·상세

1. 메인 상단 TIMEFIT 장식 텍스트 제거. 메인 문구는 ‘약속 전 남는 시간, 어디 들러볼까요?’로 변경한다. 중복 보조 문구는 최소화하고 진행 코스 이어가기·기존 동작을 유지한다.
2. 출발지/도착지 버튼 사이 간격을 늘리고 세로 점 세 개로 연결한다. 장식은 접근성 탐색에서 제외한다. 휠·하단 CTA를 지나치게 축소하지 않고 개발 도구 제외 기본 무스크롤/큰 글씨 접근성을 유지한다. 오늘/내일 선택 복원 금지.
3. 최초 대표 추천과 ‘다른 장소’ 영역 간 여백을 카드 간 여백보다 크게 둔다. 선택 후에도 선택 장소 영역과 추가 추천 사이에 같은 계층의 간격을 둔다. 긴 설명을 추가하거나 후보 순서·수량·호출량을 바꾸지 않는다. 작은 화면에서 과도한 공백이 생기지 않도록 실제 크기로 검증한다.
4. 장소 상세의 영업시간 강조는 흰색 계열 텍스트·굵기를 기본으로 하며 강한 초록을 제거한다. 필요 시 기존 블루 계열 작은 상태 점을 쓴다. 영업/종료/미확인은 텍스트로도 구별하고 실제 상태 데이터는 변경하지 않는다. 오류·취소의 의미색은 별개다.

## B. 코스 확인·진행

5. 코스 확인은 추천용 대형 사진 카드 대신 작은 썸네일+장소명+핵심 시간의 압축 타임라인으로 구성한다. 작은 썸네일 유지가 사용자 승인안이다. 지도·방문 순서·이동 구간·최종 목적지를 빠르게 파악할 수 있게 한다. 사진 없음은 기본 이미지, 긴 이름은 읽을 수 있게 처리한다. 체류 시간은 기존 허용된 review 단계에서만 표시한다. 실제 경로/최적화 순서/시간 계산은 변경하지 않는다.
6. 진행 단계의 길찾기·도착·출발 등 현재 유효한 주요 행동은 스크롤 바깥 하단 고정 영역에 둔다. 기존 단계별 가능 행동만 같은 controller로 연결하고 중복 버튼은 제거한다. safe area와 고정 영역 실측 높이만큼 본문 여백을 확보한다. 지도·모달·키보드·스크린리더 및 큰 글씨에서 가림을 확인한다.
7. 타임라인 왼쪽 현재 단계 점은 기존 블루 계열 강조와 은은한 점등으로 표현한다. 완료/현재/예정 단계는 색 외 모양·짧은 상태/접근성으로 구별한다. Reduce Motion에서는 정적 강조를 사용한다. 업무 상태 반영은 즉시, 애니메이션 때문에 API/공유 상태를 지연하지 않는다. 앱과 Live Activity 어느 쪽에서 동작해도 같은 상태·버튼이 갱신되고 중복 탭은 중복 전환/길찾기/학습을 만들지 않아야 한다.
8. 코스 취소는 ‘약 N분 코스’ 요약 행 오른쪽 끝으로 옮긴다. 작은 빨간 의미색 보조 버튼이며 주요 진행 CTA보다 시각적으로 약하게 한다. 터치 영역은 확보한다. 기존 취소 확인과 정리 controller를 재사용하고 하단 취소 중복은 제거한다. 긴 글씨에서도 제목과 겹치지 않도록 대응한다. 기록 삭제로 의미를 바꾸지 않는다.

## 병렬 경계·금지

DATA-PLACE-PHOTO-RECHECK-01과 병렬 가능. UIUX는 src/ui와 화면 테스트만 소유하고 사진 allowlist·카탈로그·빌드·provider를 변경하지 않는다. 기존 허용 사진/기본 이미지 계약으로 개발한다. 새 사진 계약이 필요하면 데이터 인계 후 별도 연결하며 권리 gate 우회 금지. DB·엔진·인증·개인화·알림 정책과 원본 날짜/180분/최대2곳은 유지한다. 새 프로필/동의/코스 저장 정책을 만들지 않는다.

## 검증·인수인계

- 실제 화면 fixture: 메인 이어가기, 설정 입력/날짜/무스크롤, 추천 첫/선택후/더보기/취소, 영업 상태, 1/2곳 review·active, 취소 확인/취소 철회, LA로 상태 변경, 비동기 중복 행동을 검증한다.
- 작은 화면·큰 글씨·긴 장소명·사진 없음·Reduce Motion에서 버튼 가림/겹침·시간 정보 유실이 없어야 한다. 지도 사진 자르기 권리는 임의 변경하지 않는다.
- npm run test:typecheck, npm run test:ui, npm test, iOS export 실행. 운영 API/DB 반복·시뮬레이터 수동 순회 금지. 제품 코드 외 역할 경계 수정은 인계한다.
- 이 문서에 변경 파일/목적, 유지 계약, 테스트 결과, 최소 실기기 확인·위험을 기록한다. 테스트 수치 재사용·미확인 완료 표시는 금지한다. 중앙 문서/commit/push는 별도 지시 없이 변경하지 않는다.

## 완료 인수인계 — 2026-09-08

이전 큰 사진 카드·동일한 간격·타임라인 내부 진행 버튼 → 정보 위계와 행동 접근 불편 → 작은56pt 썸네일/그룹28pt 간격/실측 하단 고정 행동과 실제 현재 단계 표시 → 승인된 정보 밀도·접근성 개선 → **구현·자동 검증 완료, 실기기 미확인**. 날짜 선택·조건부 추천의 철회는 유지했다.

### 1. 변경 파일 / 목적

- `src/ui/HomeScreen.tsx`: TIMEFIT 장식과 중복 보조 문구 제거, ‘약속 전 남는 시간, 어디 들러볼까요?’ 적용. 프로필 아이콘 우측 정렬과 설정/기존 코스 이어가기 callback 유지.
- `src/ui/timeSetup/UnifiedSetupInputs.tsx`: 출발/도착 사이6pt gap을24pt 세로 점3개 연결 공간으로 교체. 터치 및 접근성 탐색에서 제외. 입력 필드·휠·footer 크기를 줄이지 않았다. 익일 helper 및 무스크롤 기본 레이아웃/공간 부족·큰 글씨 스크롤 접근성은 유지한다.
- `src/ui/ResultsScreen.tsx`: 일반 카드 간10pt보다 큰28pt 대안 영역 상단 간격. 선택한 장소 영역 아래18pt+기존 본문 상단10pt로 같은 그룹 계층 유지. 선택 전 빈 tray에는 여백 추가0. 동일 Results/ScrollView, 순서·수량·더보기·선택 취소 snapshot 유지.
- `src/ui/PlaceDetailScreen.tsx`: 운영시간 표시를 C.green→C.txt/800 굵기로 전환. 기존 영업/종료 문구와 운영시간 미확인 fallback을 그대로 소비하며 새 영업 판정을 만들지 않았다.
- `src/ui/recommendation/CourseV1VerticalDetail.tsx`: 가로56×56 썸네일+장소명/활동/review 체류/사진 출처/장소 보기의 압축 행. 긴 이름 줄 수 제한0, 사진 없음은 기존 권리 gate의 대체 화면. 모든 구간·출발/최종 목적지·도착 여유 유지. 요약 행 오른쪽에 전달받은 취소 행동을 배치한다. 진행 버튼을 타임라인 안에 중복 렌더하지 않는다.
- `src/ui/recommendation/CourseStepIndicator.tsx`: 표시 전용 현재 단계 점등. 현재는 블루 원, 완료는 체크/모서리가 있는 점, 예정은 빈 원이며 기존 상태 문구를 함께 표시한다. native opacity만1초씩0.55↔1 변화. Reduce Motion 조회 전/ON/조회 실패에는 정적 표시, preference 변경·단계 변경·unmount 때 loop 정리. 상태/서비스 callback이나 타이머 기반 업무 전환 없음.
- `src/ui/CourseConfirmScreen.tsx`: 기존 primaryAction/취소/완료 controller를 그대로 연결한 스크롤 바깥 하단 footer. safe area 포함 실측 높이+16pt 본문 여백, 최초 측정 전 보수적 여백, KeyboardAvoidingView와 scroll tap 처리. 실패 시 재시도/기록 없이 마치기도 같은 footer에서 제공한다. 취소는 요약 행 우측64×44 이상 빨간 보조 행동이며 길찾기/기록 처리 중 비활성. 기존 취소 확인/철회/cleanup을 재사용한다.
- 화면 테스트: `test/ui/main-course-polish.test.mjs`, `test/ui/place-course-screen-runtime.test.mjs`, `test/ui/unified-time-route-setup.test.mjs`, `test/ui/two-stop-selection.test.ts`, `test/map-transport-ui-contract.test.mjs`. `test/ui/support/screenRuntime.mjs`에는 타이머 없는 native animation/accessibility 기본 대역만 추가했다. dedicated indicator 테스트는 실제 컴포넌트를 실행하며 preference/loop 포트를 계측한다.
- 본 작업 문서. 중앙 문서·보드·사진/카탈로그/데이터 작업 파일 수정0.

### 2. 유지한 계약

- 기존180분/최대2곳·날짜 보존·120분 복구·review만 계획 체류 표시, 추천/최적화 순서·provider 예산·조건부 Results 진입 철회 유지.
- 장소 사진의 URL/권리/가공 gate 및 기본 이미지/출처표시를 우회하지 않았다. 사진 재조사는 DATA-PLACE-PHOTO-RECHECK-01 소유이며 새 사진 허용 여부를 UIUX가 판정하지 않았다.
- 기존 app/LA 공유 progress를 직접 표시한다. 기존 stay 단계에서 다음 travel을 action 대상으로 강조하던 표현은 실제 `stepRows`의 현재 stay만 강조하도록 교체했다. 출발 버튼이 다음 구간을 연다는 이유로 ‘현재’ 점을 두 곳에 표시하지 않는다. 길찾기/도착/출발/완료의 가능 행동·lock·handoff·이벤트·학습 저장은 기존 controller 계약 그대로다.
- DB/repository·인증·개인화·알림/Live Activity 정책 및 native 구현 변경0. 기존 진행 취소는 기록 삭제가 아니며 취소 확인을 우회하지 않는다. 일반 버튼 햅틱 추가0.
- 운영 API/DB/C 실행·Simulator/실기기 조작·stage/commit/push0. 다른 세션 변경을 되돌리지 않았다.

### 3. 테스트 결과

- A 실패 선행: Home 문구/설정 연결 장식/추천 간격/상세 시간 testID 기대 실패 확인. Home 테스트의 초기 native import 대역 누락을 보완한 뒤 실제 문구 실패를 확인했다 (`/private/tmp/timefit-polish-a-red.log`, `...-a-red2.log`). A 구현 후 집중72/72 PASS (`...-a-green.log`), 이후 B 진행.
- B 실패 선행:1곳/2곳 실제 CourseConfirm에서 작은 썸네일 부재2건 FAIL (`/private/tmp/timefit-polish-b-red.log`). 구현 중 marker status prop 누락을 typecheck/화면 fixture가 검출해 수정했다. 수정 후 집중36/36 PASS (`...-b-green2.log`); 이후 사진 없음/긴 이름/영업 문구 반례를 전체 검증에 추가했다.
- 실제 화면 fixture: Home 프로필/설정/이어가기 callback, 설정 점3개 비접근 장식·날짜/휠/작은 viewport·큰 글씨 회귀, Results 대표/대안 간격/선택·취소·더보기·상세 복귀, 영업/종료/미확인 텍스트 보존과 흰색/800 강조 확인.
- 1곳/2곳 review→active 지도·사진·세로 순서 유지, review만 체류 분, footer가 ScrollView 밖이며180/360pt 실측 시 본문 여백 증가, 요약 취소1개/44pt target·취소 확인 철회/승인 후 기존 cleanup. 긴 이름 무제한 줄바꿈·사진 fallback·모든 이동 구간/최종 목적지 유지 확인.
- 기존 실제 화면+runtime의 LA pending 출발→추가 탭 없이 길찾기, 공유 progress 복구, handoff 실패 복구, pending/연타/완료 기록/학습 controller 회귀 통과. 상태 반영은 animation 완료를 기다리지 않는다. Reduce Motion ON 전환에서 loop stop·정적 opacity1, 미래/완료에서 새 loop0 및 unmount 정리 확인.
- `npm run test:typecheck`: PASS (`/private/tmp/timefit-polish-typecheck-final.log`).
- `npm run test:ui`:674건,673 PASS / 기존1 SKIP / 실패0 (`/private/tmp/timefit-polish-ui-final2.log`). 기존 고정 tray 스타일 문자열 기대는 ‘동일 slot의 선택 여부별 간격’으로 교체했다. 동일 ScrollView/선택 계약은 삭제·skip하지 않았다.
- `npm test`:344/344 PASS (`/private/tmp/timefit-polish-all-final2.log`).
- `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-polish-ios-final`: PASS (`/private/tmp/timefit-polish-export-final.log`). JS/Hermes export이며 네이티브 빌드/실기기 표시 수락으로 간주하지 않는다.
- `git diff --check`: PASS. 숫자는 이번 실행 결과이며 이전 cleanup 수치 재사용 없음.

### 4. 최소 실기기 확인 / 다음 결정·위험

1. 작은 iPhone에서 메인 문구와 프로필 버튼, 설정의 연결 점/상시 휠/footer, 개발 도구 제외 기본 무스크롤 확인. 큰 글씨·공간 부족 시 허용된 스크롤로 필드/휠/CTA에 접근 가능한지 확인한다. 기존 날짜 선택/조건부 추천은 복원하지 않는다.
2. 대표→대안 및 A 선택→추가 추천의 간격, 취소 후 스크롤 복구 확인. 사진 유무/긴 이름1·2곳 review에서 지도·모든 방문/마지막 목적지·핵심 시간·사진 출처에 접근 가능한지 확인한다.
3. active의 길찾기/도착/출발 버튼이 스크롤 위치와 무관하게 하단에 있으며 마지막 본문/오류/재시도·기록 없이 마치기가 가려지지 않는지 확인. native 확인 모달은 기존 Alert를 사용한다. 키보드 복귀·큰 글씨·VoiceOver 읽기 순서/44pt 취소 타깃도 확인한다.
4. 앱과 LA에서 각각 현재 단계 변경 시 버튼/현재 점이 같은 상태인지, Reduce Motion ON 시 정적 강조인지 확인. 기존 취소 확인에서 ‘계속 진행’은 상태 유지, ‘코스 취소’만 기존 정리 수행. 실제 Kakao/잠금화면 전달의 수락은 자동 fixture 통과와 별도다.
5. 화면 harness는 Yoga/native 렌더러가 아니다. 작은 viewport·실측 높이 주입·스타일/상태/handler 회귀는 완료했으나 실제 픽셀 가림·점등 체감·VoiceOver/키보드 동작은 미확인이다. Simulator 자동 순회는 사용자 금지에 따라 수행하지 않았다. 통합 세션은 이 구분을 유지해 수락하고 사진 재조사의 새 계약은 별도로 인계한다.

## 메인 화면 정보 위계 재정리 — 2026-09-16

이전 방식: 우상단 프로필과 하단 내정보가 중복되고 `자투리 시간 설정하기`가 입력 작업을 강조했으며, 활성 코스가 없어도 안내 카드가 계속 자리했다. 진행 카드는 장소명과 `›`만 함께 표시했다. → 관찰: 첫 화면이 비어 보이면서도 행동 의미는 설정 중심이고, 존재하지 않는 진행 상태와 중복 계정 진입이 시선을 분산했다. → 교체 방식: 결과 중심 `코스 추천받기`, 실제 입력 흐름을 설명하는 두 줄 보조 문구, 활성 코스가 있을 때만 상태·장소·설명·`이어서 하기`를 분리한 카드로 정리했다. → 이유: 첫 행동과 재개 행동을 빠르게 구분하고 빈 상태의 불필요한 UI를 제거한다. → 상태: **현행 구현·자동 검증 완료, 사용자 시각 확인 전**.

### 1. 변경 파일과 변경 목적

- `src/ui/HomeScreen.tsx`: 중복 우상단 프로필 entry와 빈 진행 placeholder를 제거했다. CTA를 `코스 추천받기`로 변경하고, 활성 코스 카드를 `진행 중`·장소명·재개 설명·`이어서 하기`의 네 단계로 분리했다. 하단 `내정보` 탭과 기존 TimeSetup/CourseConfirm 이동은 유지했다.
- `test/ui/main-course-polish.test.mjs`, `test/ui/current-flow-refactor-safety.test.mjs`, `test/ui/profile-settings-screen.test.mjs`: 새 문구·빈/활성 상태·로그인 상태별 중복 entry 제거·추천/재개/탭 이동을 실제 화면 fixture로 검증했다.
- `test/ui/global-interaction-motion.test.ts`, `test/ui/active-verified-course-resume.test.ts`, `test/ui/release-visual-polish.test.ts`, `test/map-transport-ui-contract.test.mjs`: 기존 CTA·26pt·placeholder를 고정하던 화면 계약을 새 승인 구조로 교체했다. 공용 눌림·활성 courseRunId와 navigation 계약은 유지했다.

### 2. 유지한 계약

- 추천 입력·엔진·최대 시간/장소·API 호출, 활성 코스 snapshot/courseRunId/progress, 저장·개인화·DB·Live Activity 계약을 변경하지 않았다.
- 로그인/회원가입은 하단 `내정보` 탭에서 기존 화면으로 진입한다. 탭 전환·플로팅 탭바의 배치와 동작도 변경하지 않았다.
- 일반 버튼 햅틱을 추가하지 않았고 공용 press animation을 유지했다. Simulator·실기기·운영 API/DB·commit/push는 실행하지 않았다.

### 3. 테스트 결과

- 실패 선행: 새 화면 fixture가 기존 프로필 entry, 설정 중심 CTA, 빈 placeholder와 구형 진행 카드 문구를 검출해 실패했다. 구현 후 집중 회귀 **20/20 통과**.
- 최초 전체 회귀가 구형 정적 화면 계약 4곳을 검출했고 승인된 새 기준으로 기대값을 갱신한 뒤 `npm run test:typecheck` 통과, `npm run test:ui` **802건 중 801 통과·기존 1 skip·실패 0**, `npm test` **557/557 통과**.
- iOS export: `npx expo export --platform ios --output-dir /private/tmp/timefit-home-visual-polish-ios` 통과. Hermes bundle `_expo/static/js/ios/index-e3be7d66523089e1ae97f3f8993e1a0f.hbc`, 1,330 modules.

### 4. 다음 확인·결정·위험

- 최소 사용자 확인: 진행 코스 없음/있음 각각에서 첫 시선이 `코스 추천받기`에 놓이는지, 활성 카드의 긴 2곳 장소명이 잘리지 않는지, `이어서 하기`가 별도 행동으로 인식되는지 확인한다.
- 중앙 단일 작성자 문서 `docs/03_product/UIUX_테스트명세.md`의 UXV-30은 아직 옛 CTA `자투리 시간 설정하기`를 적고 있다. 이번 사용자 확정에 맞춘 문구·빈 placeholder 제거·중복 프로필 제거로 통합·결정 역할이 갱신해야 한다. UIUX 세션은 중앙 문서를 직접 수정하지 않았다.

## 추천→장소 상세→코스 확인 흐름 시각 마감 — 2026-09-16

이전 방식: 추천 카드마다 큰 세로 사진과 `대표 추천`·`다른 추천 N`·사진 제공 문구를 반복하고, 장소 상세의 출발지 복귀 버튼은 열린 하단 시트를 무시한 화면 중앙을 기준으로 지도를 이동했다. 코스 확인에서는 같은 총 시간이 두 번 보이고 시작 버튼이 긴 본문 끝에 있었다. → 관찰: 후보가 많을수록 스크롤 피로가 커지고, 선택 전후 위계와 지도 조작 결과가 불명확하며, 코스 시작 행동을 찾기 어려웠다. → 교체 방식: 96pt 정사각 썸네일의 가로 압축 카드, `장소 추천`→`코스 구성` 상태 제목, 선택 표시와 고정 CTA, 시트 실측 기반 지도 중심 보정, 한 번만 표시하는 코스 요약과 하단 고정 시작 CTA로 정리했다. → 교체 이유: 사진은 식별 단서로 유지하되 화면 높이를 줄이고, 현재 단계와 다음 행동을 한눈에 구분하기 위함이다. → 상태: **현행 구현·자동 검증 완료, 실기기 시각 확인 전**.

### 1. 변경 파일과 변경 목적

- `src/ui/ResultsScreen.tsx`, `src/ui/recommendation/CourseV1SummaryCard.tsx`: 첫 화면은 `장소 추천`, 명시 선택 뒤는 `코스 구성`으로 표시한다. `대표 추천`·`다른 추천 1/2` 라벨을 제거하고 대표 영역은 `가장 잘 맞는 장소`, 후속 영역은 `다른 장소`로만 구분했다. 카드는 96×96 사진·두 줄 장소명·활동·소요시간·화살표의 가로형으로 압축했다.
- `src/ui/recommendation/TwoStopSelectionPanel.tsx`, `src/ui/recommendation/TwoStopSelectionTray.tsx`: B 후보와 loading skeleton도 같은 가로 비율로 맞췄다. 반복되는 `함께 둘러볼 장소`를 제거하고 `선택한 장소 1/2` 또는 `2/2`, 후보의 `✓ 선택됨`으로 현재 상태를 구분했다. 기존 선택 취소와 하단 코스 보기 CTA는 유지했다.
- `src/ui/PlaceDetailScreen.tsx`, `src/ui/placeDetailLayout.ts`, `src/ui/KakaoRouteMap.tsx`: 고정 정보 시트를 유지하면서 실측된 시트 높이로 지도 가시 영역의 중심 보정값을 계산한다. 출발지 복귀는 시트 위 지도 영역 중앙으로 이동하고, 닫기는 좌상단·복귀는 우상단으로 분리했다. 정보는 운영시간·주소·설명·출처 순으로 정리하고 카카오 장소 보기는 보조 버튼으로 낮췄다.
- `src/ui/CourseConfirmScreen.tsx`, `src/ui/recommendation/CourseV1VerticalDetail.tsx`: 지도 위 `약 N분 코스`와 도착 시각·여유를 한 번만 표시한다. review의 `코스 시작하기`를 safe area를 반영한 하단 고정 영역으로 옮겼으며, 시작 후 동일 화면에서 상단으로 복귀해 active 진행을 이어간다. 진행 취소는 같은 요약 행에 유지했다.
- `test/ui/public-api-photo-screen.test.ts`, `test/ui/release-visual-polish.test.ts`, `test/ui/main-map-polish.test.mjs`, `test/ui/place-course-screen-runtime.test.mjs`, `test/ui/two-stop-selection.test.ts`, `test/map-transport-ui-contract.test.mjs`: 카드 밀도·반복 문구 제거·출처 위치·선택 상태·시트 기반 중심 보정·review 고정 CTA·동일 화면 active 전환을 고정 fixture로 검증했다.

### 2. 유지한 계약

- 추천 순서·후보 수·1/2곳 선택 session과 호출 예산·180분/날짜·실경로·저장·개인화·DB 정책은 변경하지 않았다. Results와 기존 ScrollView, PlaceDetail 명시 선택, CourseConfirm review→active 동일 화면 흐름을 유지했다.
- 현재 허용 사진의 `attributionRequired=false` 계약에 따라 반복 카드의 제공 문구만 제거했다. 승인 URL·가공/표시 gate·로딩 실패 fallback은 그대로이며, 사용자에게 필요한 출처·라이선스 링크는 장소 상세에서 유지한다. 향후 `attributionRequired=true` 사진이 들어오면 카드에서 조용히 숨기는 방식이 아니라 데이터/통합 결정이 다시 필요하다.
- 장소 상세를 드래그 시트로 바꾸지 않았다. 시트 실측·작은 화면/긴 내용 스크롤·CTA 분리 계약은 유지하고 지도 중심만 가시 영역에 맞췄다.
- 코스 시작·길찾기·도착·체류·완료·Live Activity·알림 controller와 오류 복구를 변경하지 않았다. 시각 전환 때문에 상태 저장이나 외부 호출을 지연시키지 않았다. 주변 둘러보기·인증·엔진/API/데이터/DB·Simulator/실기기·commit/push는 건드리지 않았다.

### 3. 테스트 결과

- 실패 선행: 추천/코스 카드의 사진 제공 문구, 세로 대형 카드, 장소 상세의 고정 `cameraTop=72`와 중심 보정 0, 구형 Results 제목, CourseConfirm 중복 요약·본문 내부 시작 CTA를 fixture가 검출하는 것을 확인했다.
- 집중 화면 회귀: **93/93 통과**. 추가 two-stop 정적/행동 계약 **28/28 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **805건 중 804 통과·기존 1 skip·실패 0**.
- `npm test`: **560/560 통과**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-recommendation-flow-polish-ios`: 통과. iOS Hermes bundle `index-3e418856879688f5bdca552c29768f33.hbc`, 1,330 modules.
- `git diff --check`: 통과. 운영 API/DB와 Simulator/실기기는 실행하지 않았다.

### 4. 다음 확인·결정·위험

1. 실기기에서 후보가 1개/여러 개인 경우 96pt 썸네일 카드의 장소명 두 줄·활동 한 줄·소요시간이 읽히고, 이전보다 한 화면에 더 많은 후보가 보이는지 확인한다.
2. 장소 상세 시트가 열린 상태에서 우상단 출발지 복귀를 눌러 marker가 시트 뒤가 아닌 보이는 지도 영역 중심에 오는지 확인한다. 시트 높이·작은 화면·긴 설명에서도 닫기/복귀/선택 CTA가 겹치지 않는지 확인한다.
3. 한 곳 선택과 두 곳 선택에서 `장소 추천`→`코스 구성`, 선택 수 1/2→2/2, 선택 취소가 즉시 이해되는지 확인한다. 사진 제공 문구는 카드에 없고 장소 상세의 출처·라이선스 링크는 열리는지 확인한다.
4. 코스 확인에서 시간 요약이 한 번만 보이고 스크롤 위치와 무관하게 `코스 시작하기`가 접근 가능한지, 시작 직후 같은 화면 상단의 지도·진행 단계·하단 진행 CTA로 자연스럽게 바뀌는지 확인한다.
5. 화면 harness와 iOS export는 실제 픽셀 밀도·네이티브 지도 이동·큰 글씨/VoiceOver 체감을 대체하지 않는다. 사용자 금지에 따라 Simulator 자동 확인은 수행하지 않았으며 위 항목은 새 빌드의 사용자 확인으로 남긴다.

## 코스 review→active 진행 화면 구분 보완 — 2026-09-16

이전 방식: `코스 시작하기` 뒤에도 review의 사진 장소 카드와 전체 코스 지도를 거의 그대로 유지했다. → 관찰: 화면이 실제 진행 상태로 바뀌었는지 알아보기 어렵고, 이미 선택한 장소의 사진·설명이 현재 행동과 코스 순서보다 큰 비중을 차지했다. → 교체 방식: 같은 화면에서 즉시 active로 전환하되 짧은 `코스가 시작됐어요` 피드백, 현재 구간 지도, 진행 위치·진행률, 현재 행동 카드, 완료/현재/예정 체크 순서로 재구성했다. → 교체 이유: 진행 중에는 장소 탐색 정보보다 지금 어디로 가고 무엇을 눌러야 하는지, 다음 순서가 무엇인지 우선하기 위함이다. → 상태: **현행 구현·자동 검증 완료, 사용자 실기기 확인 전**.

### 1. 변경 파일과 변경 목적

- `src/ui/CourseConfirmScreen.tsx`: review와 active의 표시 경계를 분리했다. 시작 직후 같은 ScrollView의 맨 위로 즉시 이동하고 기존 in-place fade/짧은 이동 효과만 적용한다. review는 전체 지도·사진·계획 체류를 유지하고, active 지도는 현재 이동 구간의 출발/도착 또는 현재 장소만 표시한다.
- `src/ui/recommendation/ActiveCourseProgress.tsx`: 사진 없는 active 전용 표시 컴포넌트를 추가했다. `N / M번째 장소`, 완료 장소 수, 진행 막대, 현재 행동, 체크형 코스 순서를 한 위계로 표시하며 완료/현재/예정은 색상뿐 아니라 아이콘과 상태 문구로 함께 구분한다.
- `test/ui/place-course-screen-runtime.test.mjs`, `test/ui/support/screenRuntime.mjs`: 실제 review→active 화면 연결, 사진 카드 제거, 현재 구간 marker, 시작 피드백과 현재 단계 표시를 failure-first fixture로 검증하고 기존 native animation stub에 병렬 애니메이션 경계를 보완했다.
- `test/ui/course-v1-card-detail.test.ts`, `test/ui/release-visual-polish.test.ts`, `test/map-transport-ui-contract.test.mjs`: active도 review 상세 카드를 유지해야 한다는 과거 정적 기대를 폐기하고, review 전용 상세와 active 전용 진행 표시·현재 구간 geometry 계약으로 갱신했다.

### 2. 유지한 계약

- review의 승인 사진, 장소 상세, 계획 체류 분, 전체 경로 geometry와 하단 `코스 시작하기`는 유지했다. active에서만 사진·설명 중심 카드를 제거했다.
- 시작/길찾기/재열기/도착/체류/다음 출발/완료/취소 controller, 공유 progress·courseRunId, Live Activity·알림·완료 기록과 오류 복구는 변경하지 않았다. 시각 전환 완료를 상태 저장이나 외부 길찾기 실행 조건으로 사용하지 않는다.
- 추천·API·데이터·DB·개인화 정책과 주변 둘러보기는 수정하지 않았다. 페이지형 navigation animation을 추가하지 않았고 일반 버튼 햅틱도 추가하지 않았다.
- Simulator·실기기·운영 API/DB·commit/push는 실행하지 않았다.

### 3. 테스트 결과

- 실패 선행: 시작 뒤에도 `course-thumbnail-*`/`course-stop-*`이 남고 active 전용 진행 영역이 없다는 실제 화면 fixture 실패를 확인했다.
- 집중 실제 화면 회귀: `test/ui/place-course-screen-runtime.test.mjs` **56/56 통과**. 관련 정적 지도·표시 계약 **14/14 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **806건 중 805 통과·기존 1 skip·실패 0**.
- `npm test`: **561/561 통과**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-active-course-progress-ios`: 통과. iOS Hermes bundle `_expo/static/js/ios/index-6b808d9ce67ad6879673f9833bc87e70.hbc`.
- `git diff --check`: 통과.

### 4. 다음 확인·결정·위험

1. 새 빌드에서 `코스 시작하기` 직후 페이지가 밀려 넘어가는 느낌 없이 상단으로 전환되고, `코스가 시작됐어요`가 잠시 보인 뒤 `코스 진행 중`으로 안정되는지 확인한다.
2. 1곳/2곳 fixture에서 이동 단계는 현재 출발·도착 marker 2개와 현재 구간 선만, 체류 단계는 현재 장소 marker 1개만 보이는지 확인한다. 전체 순서의 완료/현재/예정과 하단 CTA가 공유 진행 상태에 맞는지도 확인한다.
3. 긴 장소명·작은 화면·큰 글씨·VoiceOver와 Reduce Motion ON에서 현재 행동과 다음 순서가 잘리지 않고 읽히는지 확인한다. Reduce Motion에서는 같은 즉시 상태 전환만 남아야 한다.
4. 실제 Kakao 전환과 Live Activity의 도착/출발 후 앱 복귀 시 현재 단계가 정확히 갱신되는지는 자동 fixture와 별도의 실기기 확인 항목이다. 사용자의 Simulator 금지 지시에 따라 이번 세션에서 직접 실행하지 않았다.

## 지도 경로선·방향 화살표 시각 보완 — 2026-09-16

이전 방식: 4~5px 경로선 위에 흰 배경과 그림자를 가진 26×20px 대형 화살표 pill을 거리 기준으로 최대 8개 별도 배치했다. → 관찰: 화살표가 경로보다 강하게 보이고 실제 선과 분리돼 보이며, 급회전 꼭짓점 주변에 놓이면 어느 방향을 가리키는지 어색해질 수 있었다. → 교체 방식: 흰 outline과 5~7px 색상 inner line을 겹쳐 지도 위 경로를 선명하게 만들고, 배경 없는 12px 흰 chevron을 경로선 내부에 제한적으로 배치한다. 30도 이상 꺾임의 앞뒤 28m와 전체 경로 양끝 20m에는 chevron을 만들지 않는다. → 교체 이유: 실제 길찾기 지도처럼 경로가 주 정보이고 방향 표시는 보조 정보로 읽히게 하며, 꺾임 위의 잘못된 방향 인상을 막는다. → 상태: **현행 구현·자동 검증 완료, 실제 지도 배율별 시각 확인 전**.

### 1. 변경 파일과 변경 목적

- `src/ui/KakaoRouteMap.tsx`: 큰 pill overlay를 작은 line-embedded chevron으로 교체했다. route outline과 inner line을 함께 그려 밝고 복잡한 지도 타일에서도 경로가 분리되며, walk/transit/approx/fallback의 기존 색상·실선/점선 의미는 유지한다. 급회전과 경로 끝을 피하는 placement guard를 추가했다.
- `test/ui/kakao-route-direction.test.mjs`: 90도 회전 fixture에서 chevron이 꼭짓점 24m 이내와 양끝 20m 이내에 놓이지 않는지 검증한다. 대형 pill CSS 제거, 작은 흰 chevron, 굵어진 inner line과 기존 segment별 방향 연결도 고정한다.

### 2. 유지한 계약

- snapshot의 실제 geometry·segment 순서·도보 connector·marker·bounds·지도 camera와 누락 경로 fail-closed 정책은 변경하지 않았다. 직선 fallback을 새로 만들거나 경로를 재계산하지 않는다.
- walk/transit/approx/fallback의 색상과 선 스타일은 유지했고 방향 화살표가 없는 짧은 구간도 경로선 자체로 표시한다. 화살표 수를 늘려 연속 패턴으로 만들지 않았다. 작은 지도에서 과밀과 WebView overlay 비용을 줄이기 위한 의도다.
- 변경은 공용 `KakaoRouteMap`의 segment 경로 표시만 대상으로 한다. 경로를 표시하지 않는 주변 둘러보기·기록 지도, 추천·API·엔진·DB·개인화·외부 카카오맵 길찾기 동작은 변경하지 않았다.
- Simulator·실기기·실제 API/DB·commit/push는 실행하지 않았다.

### 3. 테스트 결과

- 실패 선행: 기존 CSS의 26×20 pill, 흰 배경/그림자, 4~5px 선과 새 compact-chevron 계약 불일치를 재현했다. 급회전 fixture도 새 회전 회피 규칙으로 고정했다.
- 방향 표시 집중 fixture **2/2 통과**, geometry·실제 CourseConfirm/WebView 집중 회귀 **72/72 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **810건 중 809 통과·기존 1 skip·실패 0**.
- `npm test`: **565/565 통과**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-route-chevron-ios`: 통과. iOS Hermes bundle `_expo/static/js/ios/index-a241b38019941583697ba1b4e9923412.hbc`.

### 4. 다음 확인·위험

- 새 빌드에서 짧은 도보, 긴 도보, 대중교통 점선, 90도 이상 골목 회전 각각을 확인해 흰 chevron이 선 안에서 읽히고 굽은 꼭짓점·marker·장소 label을 가리지 않는지 확인한다.
- 지도를 크게/작게 확대했을 때도 chevron의 화면 크기는 12px로 유지되고 지리적 회피 거리는 m 기준이다. 극단적으로 축척이 작은 전체 코스에서는 방향 표시가 작게 보이는 것이 과밀한 큰 화살표보다 우선한 현행 결정이며, 사용자 시각 확인 후 크기만 10~14px 범위에서 조정할 수 있다.

## 지도 방향 chevron 반복 간격 보완 — 2026-09-16

이전 방식: 대형 pill을 제거한 1차 보완에서는 약 260m당 하나, 짧은 경로에는 하나만 배치해 과밀 방지를 우선했다. → 사용자 관찰: A→B 방향은 선 안에 여러 화살표가 일정한 간격으로 반복돼야 시각적으로 빠르게 읽힌다. → 교체 방식: 약 110m 기준으로 균등 분할하고 70m 이상 경로는 최소 2개, 긴 overview는 최대 12개로 제한한다. 급회전 앞뒤 28m와 양끝 20m 회피는 그대로 적용한다. → 교체 이유: 작은 chevron의 장점을 유지하면서 경로 전체의 진행 방향을 반복 리듬으로 전달한다. → 상태: **1차 저밀도 규칙은 철회, 반복 간격 규칙이 현행 구현**.

### 1. 변경 파일과 변경 목적

- `src/ui/KakaoRouteMap.tsx`: 방향 mark 수를 전체 길이 약 110m 단위로 계산하고 경로 내부를 균등 분할하도록 보완했다. 70m 이상 A→B는 최소 2개를 표시하며 긴 경로는 WebView overlay 과밀을 막기 위해 12개에서 닫는다.
- `test/ui/kakao-route-direction.test.mjs`: 약 600m 직선 fixture가 4개 이상의 chevron을 만들고 인접 간격 편차가 2m 미만인지 검증한다. 기존 급회전·양끝 회피와 compact line-embedded 외형 fixture도 함께 유지한다.

### 2. 유지한 계약

- 굵은 outline/inner route와 12px 흰 chevron, walk/transit/approx/fallback 표현은 유지했다. 경로 geometry·예상 이동시간·marker·camera와 추천/엔진/API/DB는 바꾸지 않았다.
- 일정 간격보다 안전한 방향 해석이 우선이므로 급회전 주변에서는 해당 mark 하나를 생략할 수 있다. 경로를 변형하거나 꺾임 위에 억지로 이동시켜 표시하지 않는다.
- Simulator·실기기·실제 API/DB·commit/push는 실행하지 않았다.

### 3. 테스트 결과

- 실패 선행: 약 600m 직선에서 기존 260m 규칙이 화살표를 1~2개만 만들어 `4개 이상` fixture가 실패하는 것을 확인했다.
- 방향 표시 집중 fixture **3/3 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **811건 중 810 통과·기존 1 skip·실패 0**.
- `npm test`: **566/566 통과**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-route-chevron-rhythm-ios`: 통과. iOS Hermes bundle `_expo/static/js/ios/index-480253050944576de6d9221233321e06.hbc`.

### 4. 다음 확인·위험

- 새 빌드에서 약 100m·600m·1km 경로를 확인해 작은 흰 chevron이 선 안에서 일정한 리듬으로 보이고 marker나 굽은 교차점을 가리지 않는지 확인한다.
- 실제 화면에서는 지도 zoom에 따라 110m가 차지하는 pixel 간격이 달라진다. 현재는 bounds-fit 코스 지도의 안정적인 기본값이며, 지나치게 촘촘하거나 성기면 실제 캡처를 근거로 거리 기준만 조정한다.

## 왕복·중첩 경로의 선택 구간 강조 — 2026-09-16

이전 방식: 모든 구간의 경로선과 방향 chevron을 동시에 같은 강도로 표시했다. → 발생한 문제: 출발 경로와 복귀 경로가 같거나 가까우면 서로 반대 방향의 chevron이 겹쳐 어느 쪽으로 이동하는지 빠르게 구분하기 어려웠다. 구간별 색을 늘리는 방안은 도보·대중교통·경로 품질의 기존 색 의미와 충돌할 수 있었다. → 교체 방식: 코스 확인에서는 전체 경로를 옅은 맥락선으로 남기고 지도 아래 `1구간`부터 최대 `3구간`까지 선택기를 둔다. 선택한 구간만 선명한 경로와 반복 chevron을 표시한다. 코스 진행에서는 별도 선택기 없이 현재 이동 구간만 자동 강조한다. → 교체 이유: 전체 코스 위치와 현재 살펴보는 방향을 동시에 보존하면서 왕복 중첩을 색상 암기에 의존하지 않고 해소한다. → 상태: **현행 구현·자동 검증 완료, 새 빌드 시각 확인 전**.

### 1. 변경 파일과 변경 목적

- `src/ui/KakaoRouteMap.tsx`: 선택 구간 index를 선택적으로 받아 비선택 구간을 옅게 먼저 그리고, 선택 구간을 마지막에 선명하게 그린다. chevron은 선택 구간에만 생성한다. 선택 구간 변경은 bounds key에서 제외해 사용자가 보고 있던 지도 위치와 확대 상태를 불필요하게 초기화하지 않는다.
- `src/ui/CourseConfirmScreen.tsx`: review 지도 아래 구간 선택 chip과 `출발 → 도착`, 이동 수단·시간 요약을 추가했다. active에서는 선택기를 숨기고 공유 progress의 현재 travel step을 강조 구간으로 연결했다.
- `test/ui/kakao-route-direction.test.mjs`: 맥락선 우선·강조선 후순위 렌더와 선택 구간 단독 chevron 계약을 추가하고 기존 굵기 계약을 새 강조 구조에 맞춰 고정했다.
- `test/ui/place-course-screen-runtime.test.mjs`: 전체 3개 구간 유지, 기본 1구간 강조, 3구간 선택과 요약 변경, 코스 시작 후 선택기 제거, 다음 travel 단계 자동 강조를 실제 화면 fixture로 검증한다.

### 2. 유지한 계약

- 검증 snapshot의 geometry·구간 순서·도보 connector·이동 수단·시간·누락 경로 fail-closed를 변경하지 않았다. 강조를 위해 직선을 만들거나 경로를 재계산하지 않는다.
- 선택은 지도 표현 상태일 뿐 코스 진행, routeOpened, 출발 시각, 체류 증거, 알림, Live Activity 또는 외부 길찾기를 실행하지 않는다.
- active 진행의 현재 단계·도착/출발/완료 CTA와 중복 방지, 추천·엔진·API·DB·개인화 정책은 변경하지 않았다.
- 공용 지도를 사용하는 다른 화면은 강조 index를 전달하지 않으므로 기존처럼 모든 segment를 표시한다. 주변 둘러보기에는 코스 진행 처리를 추가하지 않았다.

### 3. 테스트 결과

- 실패 선행: 선택 구간 prop·선택기·비선택 구간 화살표 차단이 없어 정적 지도 계약과 실제 화면 fixture가 실패하는 것을 확인했다.
- 방향 표시 및 CourseConfirm 집중 회귀: **61/61 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **813건 중 812 통과·기존 1 skip·실패 0**.
- `npm test`: **568/568 통과**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-selected-route-leg-ios`: 통과. iOS Hermes bundle `_expo/static/js/ios/index-0d8cbe9361871e2cfc7776d5569b18a2.hbc`.
- `git diff --check`: 통과.

### 4. 다음 확인·결정·위험

1. 새 빌드의 왕복 동일 경로에서 한 번에 한 방향의 chevron만 보이고 `1구간`·마지막 구간을 바꿀 때 선명한 선만 교체되는지 확인한다.
2. 구간 선택 후 지도의 pan/zoom이 튀지 않는지, 긴 출발·장소명과 큰 글씨에서 구간 chip을 가로로 스크롤하고 요약을 읽을 수 있는지 확인한다.
3. 코스 시작 뒤 선택기가 사라지고 도착·출발로 다음 travel step에 진입할 때 현재 구간 강조가 자동으로 바뀌는지 확인한다.
4. 일부 구간 geometry가 누락되면 해당 구간을 임의 직선으로 채우지 않으므로 선택 시 화살표가 없고 기존 누락 안내가 남는다. 이는 경로를 거짓 표시하지 않는 의도된 위험 처리다.
5. 사용자 지시에 따라 Simulator·실기기·실제 API/DB·commit/push는 실행하지 않았다.
