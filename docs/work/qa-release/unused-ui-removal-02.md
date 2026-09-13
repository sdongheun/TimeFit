# U-UNUSED-UI-REMOVE-02 — 미연결 UI 제거와 회귀 검증

2026-09-14 / 최신 상태: **QA 자동 검증 PASS / 사용자 정상 동작 확인·통합 최종 수락 완료**. 아래 구현 전·수락 대기 설명은 당시 이력이며, 최신 수락은 바로 아래 기록을 따른다.

## 2026-09-14 통합 최종 수락

- QA 결과 검토 및 통합 관련 테스트 54/54 PASS 이후 사용자가 “정상동작 확인”을 보고했다. 이를 근거로 U-UNUSED-UI-REMOVE-02를 최종 수락한다.
- QA 근거: UI 814 PASS·기존 skip1, 기본 537 PASS, 타입 검사·public iOS export PASS. 사용자 확인은 보고 수준으로 기록하며 기기·빌드 번호·개별 시나리오 로그까지 확보했다고 확대하지 않는다.
- 이전 자동 검증 완료·실기기 대기 → 사용자 정상 동작 확인 → 최종 수락 완료. 삭제 범위18개와 기존 기록·DB·추천·Live Activity 보존 경계는 변경하지 않는다.
- 이번 통합 변경은 본 문서의 상태 기록뿐이다. 제품·테스트 추가 수정 없음. 기존 검증 결과를 인용했으며 이번 문서 변경은 git diff --check로 확인한다.
- 다음: 역할별 한국어 커밋으로 완료 기준점 확보. 이번 수락만으로 commit/push·스토어 업데이트·운영 데이터 삭제를 실행하지 않는다.

## 목적·판정

과거 네 화면 제거 후 남은 UI를 정리한다. 사용자 요청은 앞선 제거 작업의 보완이며 추천·저장·개인화 정책 변경이 아니다.
이전: 과거 표시 컴포넌트와 전용 모델 잔존 → 앱 진입점 연결 없이 테스트만 남아 유지보수 혼동 → 연결이 끊긴 UI 묶음만 제거 → 현재 기능을 유지하며 실행 코드와 테스트 목적을 일치시킴 → 구현 전.

통합 조사: index.ts/App.tsx에서 정적·문자열 동적 import/require의 로컬 파일 그래프를 추적했다. 아래 후보는 앱 진입점에서 연결되지 않았고 src/scripts/supabase의 이름·경로 참조를 추가 대조했다. 이는 파일 단위 후보 판정이지 모든 export·네이티브·운영 데이터의 무사용 증명이 아니다. 삭제 담당자는 변경 직전 다시 확인한다.

## UIUX 실행 명령

`U-UNUSED-UI-REMOVE-02를 진행하라. 이 문서의 후보를 재확인한 뒤 미연결 UI만 제거하고 테스트로 검증하라.`

1. 현재 미커밋 변경은 직전 수락된 네 화면 제거·만료 보완이다. 이를 덮어쓰거나 초기화하지 말고, 시작 시 HEAD와 기존 diff를 구분 기록한다. 기존 결과는 UI 823 PASS/기존 skip 1, 기본 521 PASS이며 현재 실행 결과로 대신하지 않는다.
2. 아래 후보마다 앱·서버·스크립트·동적 로딩·테스트 참조를 확인한다. 현재 호출자가 발견되면 해당 파일은 제외하고 근거를 보고한다. 사용 코드의 호출을 제거해 인위적으로 미사용으로 만들지 않는다.
3. 삭제 목표를 검증하는 테스트를 먼저 추가해 예상 실패를 확인하고, 현재 추천·진행·기록 보존 테스트의 통과를 확인한다.
4. 확정한 후보와 그 전용 의존만 삭제한다. UI 테스트는 케이스별로 현재 계약 유지/현재 경로 이관/폐기 UI 전용으로 구분한다. 폐기 UI만 검증하는 테스트는 이유를 남겨 제거할 수 있지만 현재 기능 검증이나 전체 파일을 통째로 없애 통과시키지 않는다.
5. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `node scripts/release-build.cjs export`, `git diff --check`를 실행한다. 범위 밖 QA/API 테스트 수정이 필요하면 실패 케이스와 대체 기대값을 해당 역할에 인계하고 전체 완료로 표시하지 않는다.

### 1차 후보 — UIUX 소유

- src/ui/recommendation/CandidateList.tsx
- src/ui/recommendation/CandidateDetail.tsx
- src/ui/recommendation/BasketPanel.tsx
- src/ui/execution/CourseProgress.tsx
- src/ui/activity/ActivityDonut.tsx
- src/ui/Chip.tsx
- src/ui/recommendation/TimeJourney.tsx
- src/ui/recommendation/ExplorationPlaceCard.tsx

다음은 위 후보만 사용하는지 재확인한 경우에 한해 함께 제거한다: `src/ui/currentPlacePhoto.ts`, `src/ui/recommendation/TransportGlyph.tsx`, `types.ts`, `candidateModel.ts`, `candidateEvaluation.ts`, `basketPlanner.ts`, `timeJourneyModel.ts`, `oneStop.ts`, `useRecommendationSheet.ts`, `sheetLayout.ts` (별도 경로가 없는 파일은 src/ui/recommendation/ 기준).

## 이번 삭제에서 제외

- 조건부 개발 미리보기 묶음: 앱 연결은 없지만 개발 테스트 목적을 별도 판단해야 하므로 이번 범위에서 보존.
- services 전부: courseRepository, courseNotifications, routeProxyAdapter, routeProviderAdapter, legacyRouteBaselineCleanup 등은 DB/API 역할 후속 검토. UI에서 타입 참조가 사라져도 이 작업으로 삭제하지 않는다.
- 현재 사용되는 LegacyCompletionPanel, placeFeedback 읽기, courseCompletionRepository, guest 가져오기·학습·계정 동의/삭제·진행 복원.
- 현재 실행하는 execution/schedule.ts, liveActivity 전체, 지도/사진 공유 컴포넌트, 엔진·카탈로그·네이티브·권한·DB/migration·기존 데이터.
- 이름이 유사하다는 이유로 폴더 전체를 제거하거나 실행 경로를 복원하지 않는다. output/과 무관한 사용자 변경 보존.

## QA 인계 명령

`QA-UNUSED-UI-REMOVE-02를 진행하라. UIUX의 변경 목록과 실패 인계를 대조하고 필요한 QA 소유 테스트만 이관한 뒤 위 전체 검증을 다시 실행하라.`

실패를 기존 실패/삭제된 UI 참조/현재 기능 회귀/환경 문제로 분류한다. 현재 기능 회귀는 구현 담당자에게 반환한다. 테스트 수 감소 이유와 기존 skip 변화도 기록한다. 실제 API·운영 DB를 호출하는 테스트는 추가하지 않는다.

## 완료 인계

1. 삭제·변경 파일, 각 파일의 호출 부재 근거와 테스트 변경 이유.
2. 변경하지 않은 추천·DB·기록·Live Activity·공개 계약.
3. 삭제 전 예상 실패/보존 통과, 삭제 후 각 명령 결과·로그. 자동 통과와 실기기 확인을 구분.
4. 다음 통합 검토·실기기 추천→코스→완료/기록 확인. 커밋·push·스토어 업데이트·운영 데이터 삭제는 별도 승인 범위.

통합 작성 인계: 이번에는 본 명령 문서만 추가했다. 제품 코드 및 테스트 변경 없음. 문서 형식은 git diff --check로 검증한다. 제거와 삭제 후 회귀 테스트는 아직 미실행이다.

## 2026-09-13 QA-UNUSED-UI-REMOVE-02 최종 검증

### 변경 파일·실패 분류

[UIUX 제거 인계](../uiux/unused-ui-removal-02.md)를 대조했다. 기존 네 화면 제거·만료 보완 및 이번 UIUX 삭제18개/테스트 변경, `output/`을 보존했다. QA는 제품 코드를 수정하거나 추가 삭제하지 않았다.

수정 전 두 계약 파일을 실행해 `ExplorationPlaceCard.tsx`, `basketPlanner.ts`의 top-level read **ENOENT 2건**을 재현했다(`/private/tmp/unused-qa-before.log`). 현재 기능 실패가 아니라 삭제된 UI 참조 오류로 분류한다.

- `test/map-transport-ui-contract.test.mjs`: 사용0인 explorationCard 파일 읽기 선언만 제거. 현재 지도·입력·Kakao 링크·진행 검증과 폐기 화면 비참조 기대값은 그대로다.
- `test/mixed-travel-contract.test.mjs`: 삭제 basketPlanner 읽기와 해당 helper 전용 assertion2개만 제거하고 혼합 케이스 제목을 현재 검증에 맞췄다. 엔진 자동 이동수단·짧은 구간 근사, 현재 snapshot 소비·invalid 차단·재계산 없음, PlaceDetail 역할 분리, 보존 repository/schedule 및 현재 route의 leg mode 기대를 모두 유지했다. 5개 테스트 자체는 유지했다.
- 이 작업 문서: 결과·테스트 수·다음 담당 기록. 중앙 문서·UIUX 인계는 수정하지 않았다.

현재 기능 검증을 삭제하거나 기대값을 약화하지 않았고 `test/index.js`/package 탐색·skip 설정도 변경하지 않았다. 삭제 후보의 유입0·파일 부재19건과 실제 현재 화면 실행형 회귀를 함께 실행했다. UIUX 삭제18개의 파일별 호출 부재 근거와 전용 테스트 철회 이유는 위 UIUX 인계의 대응표를 따른다.

### 유지 계약

추천 엔진/180분·최대2곳/실경로 차단, 현재 CourseConfirm 만료·복원, 지도·사진·외부 링크, 완료/기록·guest/회원·개인화·동의·Live Activity, 보존 repository/서비스/타입·DB/migration/기존 데이터 및 조건부 개발 미리보기는 그대로다. 과거 UI·helper를 복원해 테스트를 통과시키지 않았다.

### 실행 결과

| 명령/범위 | 최종 결과 | 로그 |
| --- | --- | --- |
| 삭제 목표19 + 현재 화면·사진·기록·경로 보존 + QA 계약, 10파일 | **124/124 PASS**, skip0 | `/private/tmp/unused-qa-focus-final.log` |
| `npm run test:typecheck` | **PASS**, exit0 | `/private/tmp/unused-qa-types.log` |
| `npm run test:ui` | **814 PASS / FAIL0 / 기존 skip1**, 총815, exit0 | `/private/tmp/unused-qa-ui.log` |
| `npm test` | **537/537 PASS**, skip0, exit0 | `/private/tmp/unused-qa-all.log` |
| `node scripts/release-build.cjs export` | **public iOS PASS**, exit0 | `/private/tmp/unused-qa-export.log` |
| `git diff --check` | **PASS**, 이 문서 포함 최종 확인 | 로컬 검사 |

집중 명령:

```sh
node --import tsx --test test/map-transport-ui-contract.test.mjs test/mixed-travel-contract.test.mjs test/ui/unused-ui-removal.test.mjs test/ui/current-flow-refactor-safety.test.mjs test/ui/place-course-screen-runtime.test.mjs test/ui/guest-import-record-display.test.ts test/ui/public-api-photo.test.ts test/ui/public-api-photo-screen.test.ts test/ui/odsay-removal-screen.test.mjs test/ui/one-stop-recommendation.test.ts
```

최초 집중 명령은 guest-import-record-display/public-api-photo-screen의 확장자를 `.mjs`로 잘못 지정해 실행 전 중단됐다(`/private/tmp/unused-qa-focus.log`). 실제 `.ts` 경로를 확인한 뒤 위 명령으로 실행했다. 제품/fixture 결함이 아니며 해당 테스트를 제외하지 않았다.

테스트 수 해석:

- 이전 수락 UI824 → 이번815: UIUX의 폐기 UI 전용28건 제거 + 제거 목표19건 추가로 9건 감소. 기존 skip1 유지. 이번 QA 변경으로 테스트 케이스 수 감소0.
- UIUX 기본 실행520은 QA 계약2파일의 로딩 실패가 포함된 수다. 로딩 복구 후 계약19건이 정상 발견되고 실패 파일2건을 대체해 최종537이 됐다. 직전 수락521 대비로는 신규 제거19건과 폐기 `.mjs` 계약3건 감소에 해당한다. TypeScript 하위 실행은 기존 loader 집계 경계도 그대로 유지한다.
- 최종 ENOENT·집계 실패·현재 기능 회귀0. 이전 UIUX 실행 숫자를 최종 실행 결과로 대신하지 않았다.

public 산출물은 실제 재생성된 `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`다. 직전 만료 보완 번들과 같은 이름이라는 보조 관찰이며, 서명 IPA 동일성이나 실기기 동작 증명은 아니다. native archive/IPA·설치·배포는 미실행이다.

### 다음 담당·남은 조건

**QA 자동 검증 완료 → 통합 삭제 범위/테스트 대응표 검토 → 수정 빌드의 최소 실기기 수락** 순서다. 실기기는 아직 확인하지 않았다. 추천→1/2곳→현재 코스→카카오 앱/웹 길찾기→완료/기록, 기존 진행 이어가기·Live Activity 공유를 한 묶음으로 확인한다. 기존 데이터를 삭제하거나 운영 데이터를 반복 생성해 검증을 대신하지 않는다.

실제 외부 API·운영 DB 호출, Simulator 조작, 운영 데이터 삭제, stage/commit/push·스토어 업데이트 없음. 추가 서비스/DTO 정리는 별도 소유 역할·승인 범위이며 이번 자동 PASS로 승인하지 않는다.
