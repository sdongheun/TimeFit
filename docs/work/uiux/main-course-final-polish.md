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
