# U-CONDITIONAL-PREVIEW-01 — 조건부 장소 개발 미리보기

상태: 2026-09-08 사용자 승인, UIUX 구현 가능. 먼저 현재 UI의 미리보기만 추가하고 재디자인은 사용자 화면 피드백 후 진행한다.

## 목적·이력

사용자가 새벽에도 시장 등 운영시간 미확인 장소의 실제 UI를 확인하고 수정하려 한다. 일반 추천의 테스트 시각 실패 수정이 이번 목표는 아니다.

이전 실제 시각10~18시에만 조건부 UI 확인 가능 → 새벽에 디자인 확인 불가 → 개발 전용 고정 데이터 미리보기에서 동일 표시 컴포넌트 재사용 → 실제 노출/안전 정책을 바꾸지 않고 디자인 확인 → 현행 결정·구현 전. 배포 전 미리보기 진입점·전용 화면/fixture 연결을 제거한다. 실제 조건부 화면 및 재사용 표시 컴포넌트는 제거하지 않는다.

## 구현 순서

1. AGENTS.md, docs/README.md, 본 문서, TimeSetupScreen.tsx의 기존 개발 도구 영역, ResultsScreen.tsx의 ConditionalVisitSection 및 관련 표시 모델/테스트를 읽는다.
2. 기존 ConditionalVisitSection은 ResultsScreen 안에 있고 카탈로그 map·표시 함수·동작 callback에 의존한다. 필요한 부분만 표시 컴포넌트로 추출해 운영 Results와 미리보기가 함께 사용하게 한다. 기존 레이아웃·문구·운영 callback·노출 규칙은 그대로 유지한다. 미리보기 전용 복제 카드나 전체 Results 실행으로 production side effect를 켜는 방식은 금지한다.
3. TimeSetup의 기존 개발 영역에 `운영시간 미확인 장소 미리보기` 진입점을 둔다. 일반 입력 무스크롤 레이아웃 크기를 줄이지 말고 개발 영역에만 추가한다. 가능하면 화면 내부 개발 page/닫기 흐름을 재사용하며 별도 앱·새 네이티브 의존성·복잡한 navigator는 만들지 않는다.
4. 기존 개발 빌드 게이트를 확인해 재사용한다. dev=true일 때만 노출/렌더/동작하고 production에서는 진입 요청도 거절한다. 새 env 설정은 필요한 경우에만 명시하며 기존 env 값을 임의 변경하지 않는다. 실제 시각 02:00/20:00이어도 미리보기에는 보이고 실제 Results에는 기존 정책대로 비노출이어야 한다.
5. 안전한 합성 장소 fixture를 UI 개발 전용 경로에 둔다. 시장/거리, 긴 이름·주소, 사진 없음/로컬 기본 이미지, 여러 카드와 더보기, 로딩/오류 상태를 최소 구성한다. 이용허락 미확인 원격 사진·실사용자 기록·계정·receipt를 쓰지 않는다. 별도 fixture라고 명시하며 실제 운영시간/코스가 검증된 것처럼 표현하지 않는다.
6. 화면 상단 safe area 아래 `개발용 미리보기 · 실제 추천/저장 없음`과 닫기를 제공한다. 스크롤/고정 fixture 더보기와 로컬 상태 선택만 허용한다. 기존 카카오맵 확인/수동 코스 계산 버튼은 디자인을 볼 수 있게 유지하되 클릭은 `미리보기에서는 실행하지 않아요` 등 로컬 피드백만 제공한다. Linking/WebBrowser, 엔진/provider, Auth/RPC, 저장/기록 정리, Live Activity/알림/학습은 모두0회다. 실제 장소 상세 route를 자동 재사용하지 않는다.
7. 닫으면 기존 시간·출발/목적지·개발 시각 입력과 진행 코스 상태가 그대로 남는다. 미리보기에서 테스트 시각을 전역 변경하거나 운영 결과 cache/session을 생성하지 않는다.

## 검증

- 실패 fixture 우선: dev 진입 가능/production 진입 불가, 실제 새벽·밤에서도 미리보기 표시, 닫기 후 입력 보존, 더보기 로컬 누적, 버튼 탭 외부 side effect0, 긴 텍스트/사진 없음.
- 운영 Results가 같은 표시 컴포넌트를 사용하며 실제09:59/10:00/17:59/18:00 노출 및 기존 callback 연결은 그대로임을 확인한다. 미리보기를 위해 실제 정책 함수를 always true로 바꾸지 않는다.
- npm run test:typecheck, npm run test:ui, npm test, git diff --check 및 기존 경량 iOS export. Simulator 반복 순회·실제 API/DB 호출0.
- 사용자에게 진입 위치와 반영 방법을 안내한다. JS만 변경했다면 불필요한 Xcode 재빌드를 요구하지 않는다. 먼저 현재 카드가 새벽에도 보이는지 확인받고 디자인 수정 요청을 기다린다.

## 소유권·종료 조건

UIUX의 src/ui·관련 화면 테스트·본 문서만 수정. App.tsx/nav.ts가 반드시 필요하면 단일 작성자 범위로만 변경하고 인계에 명시한다. 엔진/카탈로그/API/DB·120분 상한·조건부 실제 시각·시계 혼용 버그 수정은 범위 밖이다. U-TEST-CLOCK-01의 발견 버그는 별도 잔여로 보존하고 해결 완료로 기록하지 않는다.

인수인계: 변경 파일과 목적 / 운영 계약 유지 / 테스트 결과 / 사용자 진입 방법 및 배포 전 제거 대상의 정확한 파일·연결 목록. commit/push 금지.

배포 전 완료 기준: 미리보기 버튼·전용 page·개발 fixture의 앱 import 연결 제거, production route/게이트 우회0, 실사용 조건부 컴포넌트와 디자인 개선 유지. 개발 표시용 코드를 지웠다는 이유로 회귀 테스트까지 삭제하지 않는다. 이번에는 기존 QA/개발 시각 도구를 일괄 제거하지 않는다.

## 2026-09-08 U-CONDITIONAL-PREVIEW-01 완료 인수인계

### 1. 변경 파일과 목적

- `src/ui/recommendation/ConditionalVisitSection.tsx`: Results 내부의 실제 조건부 표시 JSX·스타일·상태 타입을 추출했다. 카탈로그 직접 참조 대신 `discoveryContext` callback을 받는다. 문구·카드 간격·버튼 크기·수동 결과 표시를 그대로 유지한다.
- `src/ui/ResultsScreen.tsx`: 3개 결과 분기 모두 위 컴포넌트를 사용한다. 기존 카탈로그 맥락과 Kakao/계산/더보기 callback을 그대로 전달한다.
- `src/ui/dev/ConditionalPlacePreview.tsx`, `src/ui/dev/conditionalPlacePreviewFixtures.ts`: 전용 화면과 합성 시장/거리4건. 초기2건→로컬 더보기4건, 첫 카드 기본/로딩/오류 상태, safe area 아래 개발 안내와 닫기. 원격 사진·실제 계정·코스·receipt 없음. 긴 이름/주소·사진 없음 fixture를 포함한다. 현행 조건부 기본 카드는 주소/사진을 표시하지 않으므로 이번에 새로운 주소/이미지 영역을 만들지 않았다.
- `src/ui/TimeSetupScreen.tsx`: 기존 개발 영역에 진입 버튼, 내부 page 및 뒤로가기 처리만 추가. 정상 입력 영역의 배치 수치는 변경하지 않았다. App/nav/네이티브 설정 변경 없음.
- `test/ui/unified-time-route-setup.test.mjs`: production handler 기반 신규3건(새벽/밤 미리보기·입력 보존·안전 차단, 배포 진입/직접 렌더 차단, 공유 컴포넌트 callback 인자 보존).
- `test/ui/release-one-stop-more-results.test.ts`, `test/map-transport-ui-contract.test.mjs`: 추출된 실제 표시 파일에서 기존 문구/testID를 검사하도록 검사 위치만 갱신. 운영 Results의 시간 gate·callback 연결 검사는 유지했다.

### 2. 유지한 운영 계약

- 실제 Results의10:00≤t<18:00 노출·foreground/시간 경계 갱신, 조건부 명시 계산과 예산/인증 검증은 변경하지 않았다. `U-TEST-CLOCK-01` 시계 혼용 문제는 **미수정 잔여**다.
- 미리보기는 추천 실행/Results 진입이 아니다. 세션·코스·캐시를 생성하지 않는다. 외부 열기/코스 계산 버튼은 `미리보기에서는 실행하지 않아요` 로컬 안내만 표시한다. 로딩도 timer/실제 요청 없이 로컬 선택 상태다. 학습·저장·알림·Live Activity·Auth/RPC·엔진/provider 호출 연결0.
- 기존 `SHOW_TEST_CLOCK` dev 게이트로 버튼과 page 렌더를 제한하고 진입 handler도 확인한다. 전용 컴포넌트는 직접 렌더 시에도 `__DEV__`가 false/undefined면 null이며 내부 handler에도 dev 확인을 둔다. diagnostics만 켠 Release에는 진입할 수 없다. env 변경 없음.
- 닫기/뒤로가기는 setup page로만 돌아오며 입력·개발 시각·진행 코스 상태를 변경하지 않는다. 일반 입력 무스크롤 기준·기존 개발 도구·120분 제한 유지. 중앙 문서/보드/engine/data/API/DB 수정 및 commit/push0.

### 3. 검증 결과

- 실패 선행: 구현 전 화면 테스트32건 중 기존30통과/추가2실패(진입 버튼 없음·전용 모듈 없음)를 확인했다. 구현 후 해당 테스트와 공유 callback 인자 검증을 통과했다.
- 명시적02시/20시 fixture에서 두 카드 표시→더보기4카드→Kakao/계산 탭 로컬 안내→로딩 disabled→오류 표시→닫기 후 출발/목적지/도착 시각 입력 보존. 진입 전후 runtime 호출 목록 증가0, 테스트 fetch0. 배포 dev=false/diagnostics=true 버튼0, 전용 화면 직접 렌더0.
- `npm run test:typecheck`: 통과. `npm run test:ui`:602건 중601통과·기존 skip1·실패0 (`/private/tmp/timefit-preview-ui.log`). 기존09:59/10:00/17:59/18:00 조건부 정책 회귀 포함.
- 전체 테스트는 추출 전 소스 위치를 가정한 검사 실패를 먼저 확인하고, 공용 표시 파일을 검증하도록 보완하여 재실행했다. 최종 결과는 아래 검증 마감에 기록한다.
- `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-conditional-preview-ios`: 성공, iOS Hermes bundle 생성 (`/private/tmp/timefit-preview-export.log`). JS export이며 실기기 시각 확인은 아니다. Simulator·실제 API/DB 호출0. tsx IPC sandbox 실패는 권한 승인 후 재실행했다.

### 4. 사용자 진입·배포 전 제거 목록

- **진입:** 개발 빌드에서 시간/경로 설정 화면 → 기존 개발 도구 영역의 **운영시간 미확인 장소 미리보기**. 실제 새벽에도 바로 열리며 추천 실행·로그인·테스트 시각 변경은 필요 없다. 닫기 또는 뒤로가기로 원래 입력 화면에 돌아온다. 최신 JS를 개발 서버에서 다시 불러오면 반영되며 이번 변경 때문에 Xcode 네이티브 재빌드는 필요 없다. 일반 Release에서는 의도적으로 접근할 수 없다.
- 사용자 확인 대기: 현재 카드가 보이는지, 긴 제목 줄바꿈·스크롤·닫기 접근성을 현재 기기에서 확인한 뒤 디자인 피드백을 받는다. 이번에는 디자인을 변경하지 않았다.
- **배포 전 제거할 전용 파일:** `src/ui/dev/ConditionalPlacePreview.tsx`, `src/ui/dev/conditionalPlacePreviewFixtures.ts`.
- **배포 전 제거할 연결(모두 TimeSetupScreen.tsx):** `ConditionalPlacePreview` import, `Page`의 `'conditional-preview'`, `usePreventRemove`의 해당 page 조건, 전용 page 렌더 분기, `conditional-preview-launcher` 버튼과 진입 handler. 별도 nav/route/env/native 연결은 없다. 기존 QA/개발 시각 버튼은 이 작업 제거 대상이 아니다.
- **반드시 유지:** 운영용 `src/ui/recommendation/ConditionalVisitSection.tsx`, Results의 공유 연결·실제 시간 gate와 callback. 배포 정리 시 테스트를 일괄 삭제하지 말고 전용 개발 진입 기대만 제거 상태 검증으로 바꾸며, 운영 컴포넌트·정책·부작용 차단 회귀는 보존한다.
- 이력: 실제10~18시에만 UI 확인 가능 → 새벽 확인 불가 → 동일 표시 컴포넌트를 dev 전용 합성 fixture에서 확인 → 운영 정책/디자인을 건드리지 않기 위함 → **구현 및 자동 검증, 사용자 시각 확인 대기**. 배포 전 전용 연결 제거는 별도 미완료 게이트다.

검증 마감: `npm test` **277통과·실패0** (`/private/tmp/timefit-preview-core.log`), `git diff --check` 통과. 운영 테스트 정책을 완화하지 않고 추출한 컴포넌트의 검사 위치를 갱신한 뒤의 최종 결과다.
