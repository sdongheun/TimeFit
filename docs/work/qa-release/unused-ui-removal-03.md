# U-UNUSED-UI-REMOVE-03 — 잔여 미연결 UI 제거

2026-09-14 / 최신 상태: **QA 자동 검증 PASS / 사용자 정상 확인·통합 최종 수락 완료**. 아래 미실행·수락 대기 설명은 당시 이력이며 최신 상태는 바로 아래 수락 기록을 따른다.

## 2026-09-14 통합 최종 수락

- QA 인계와 변경 테스트를 검토하고 관련44건을 재실행해 모두 통과했다. QA 로그에서 UI795 PASS·기존 skip1, 기본555 PASS 및 public iOS export 성공을 확인했다. 타입 검사 PASS는 QA 인계에 기록되어 있다.
- 이후 사용자가 “정상 확인”을 보고하여 이번19개 미연결 UI 제거를 최종 수락한다. 기기·빌드 번호·개별 시나리오 로그까지 제공된 것은 아니므로 사용자 정상 확인 이상의 실기기 증거를 주장하지 않는다.
- 이전 자동 검증 완료·실기기 수락 대기 → 사용자 정상 확인 → 최종 수락 완료. 삭제 범위와 현재 추천·기록·복원·Live Activity·DB 보존 계약은 변경하지 않는다.
- 이번 통합 변경은 본 문서의 수락 기록뿐이며 제품·테스트 수정 없음. 문서는 git diff --check로 확인하고 기존 자동 검증 결과를 재실행 결과로 혼동하지 않는다.
- 다음은 역할별 한국어 커밋으로 완료 기준점 확보다. 이번 수락만으로 commit/push·배포·운영 데이터 삭제를 수행하지 않는다.

## 결정과 경계

부모 작업 U-UNUSED-UI-REMOVE-02의 보완이다. 이전에는 개발 도구 목적을 판단하기 위해 미리보기 묶음6개를 보존했다. 이후 19개 잔여 파일의 앱 진입점 연결 부재를 설명했고 사용자가 “이것도 확인하고 제거 진행 후 테스트”를 요청했다. 이번에는 연결이 없는 개발 미리보기 묶음도 재확인 후 제거 대상으로 포함한다. 현재 시간 설정 QA/테스트 시각 기능 전체를 없애는 승인이 아니다.

통합은 index.ts/App.tsx에서 정적 import/export·문자열 동적 import/require 그래프를 추적하고 src/scripts/supabase 참조를 대조했다. 아래 집합 밖의 제품 호출을 발견하지 않았다. 테스트 호출은 남아 있다. 임의 문자열 동적 호출이나 모든 네이티브 경로까지 자동 증명한 것은 아니므로 구현 직전 재확인한다.

기준점: `232a45d`. 작업 전 관련 변경 없음, untracked output/만 존재. 파일 삭제는 이 기준점에서 복구할 수 있다. output/은 보존한다.

## UIUX 실행

`docs/work/qa-release/unused-ui-removal-03.md의 U-UNUSED-UI-REMOVE-03을 진행하라.`

1. 아래 파일의 모든 import/reexport/동적 로딩 및 실제 앱·개발 진입점과 테스트 참조를 재확인해 파일별 근거를 남긴다. 현재 사용이 발견되면 그 파일은 제외한다. 호출자를 지워 미사용으로 만들지 않는다.
2. 집합 밖 유입0과 지정 파일 제거를 검증하는 테스트를 먼저 추가한다. 삭제 전 예상 실패와 현재 추천·수동 검색/지도 선택·날짜/만료·기록·진행 보존 테스트 통과를 기록한다.
3. 확정한 아래 파일만 삭제한다. 폴더 전체 삭제 및 다른 역할 서비스/엔진 연쇄 삭제 금지.
4. 테스트는 케이스별로 폐기 전용/현재 기능 보존/현재 경로 이관으로 분류한다. 폐기 함수 전용 테스트만 이유와 함께 정리하고, 혼합 테스트의 현재 계약은 유지한다. 테스트가 있다는 이유만으로 실행되지 않는 제품 함수를 유지하거나 복원하지 않는다.
5. UIUX 소유 테스트 수정 후 아래 검증을 수행한다. QA 소유 파일에 남은 참조는 파일·케이스·대체 기대값을 인계한다. 전체 통과 전에는 구현 완료·QA 대기로 표시한다.

### 삭제 후보19개

모든 경로는 src/ui/ 기준이다.

- courseDateContext.ts
- mapPinConfirmationModel.ts
- placeSearchRanking.ts
- placeSearchStateModel.ts
- placeSearchSuggestionModel.ts
- routeSetupModel.ts
- tokens.ts
- recommendation/MapControls.tsx
- recommendation/courseV1DwellStateModel.ts
- recommendation/courseV1ResultListModel.ts
- recommendation/oneStopSearchScope.ts
- recommendation/v1ResultState.ts
- recommendation/verifiedCourseResultsModel.ts
- dev/ConditionalPlacePreview.tsx
- dev/conditionalPlacePreviewFixtures.ts
- recommendation/ConditionalVisitSection.tsx
- recommendation/CourseV1Journey.tsx
- recommendation/CourseV1PlacePreview.tsx
- recommendation/courseV1JourneyModel.ts

### 보존

현재 PlacePicker/MapPlacePicker/TimeSetup/Results/PlaceDetail/CourseConfirm/NearbyBrowse/기록/계정 흐름, 현재 datedSetupTime과 만료 guard, 현재 추천 모델·엔진·services·DB·카탈로그·Live Activity·네이티브 설정은 변경하지 않는다. 현재 화면의 로직을 새로 작성하거나 단순화하는 작업이 아니다. 과거 저장 데이터·진행 복원·동의·학습·사진 허락 계약 유지. tokens.ts는 미연결 MapControls 전용이며 현재 theme.ts 및 다른 공유 디자인 컴포넌트는 보존한다.

## QA 실행

`UIUX 인계 후 QA-UNUSED-UI-REMOVE-03을 진행하라.`

QA 소유 테스트의 삭제 파일 참조만 이관하고 다음을 최종 상태에서 실행한다.

```sh
npm run test:typecheck
npm run test:ui
npm test
node scripts/release-build.cjs export
git diff --check
```

직전 기준은 UI814 PASS/기존 skip1, 기본537 PASS이다. 숫자를 맞추려고 테스트를 제외하지 말고 폐기/추가/이관 수와 발견 오류를 구분한다. 실제 API·운영 DB 호출을 회귀에 추가하지 않는다. 기존 테스트 탐색 설정이나 skip를 바꿔 실패를 숨기지 않는다.

## 완료 인계

변경 파일·파일별 호출 부재 근거, 보존 계약, 삭제 전후 테스트와 로그, 남은 실패/실기기 미확인 사항을 기록한다. 자동 검증 통과 후 통합 검토 및 수정 빌드의 수동 검색/지도 선택→추천→코스 진행·완료/기록을 확인한다. QA는 제품 정책을 바꾸지 않는다.

통합 이번 작업: 본 명령만 추가, 코드 삭제 없음. git diff --check로 문서 형식 확인. 사용자 요청의 실제 제거·전체 테스트는 UIUX→QA 역할에서 이어서 수행해야 한다. commit/push·스토어 업데이트·운영 데이터 삭제는 포함하지 않는다.

## 2026-09-14 QA-UNUSED-UI-REMOVE-03 최종 인계

### 변경 파일·실패 분류·대응

[UIUX 변경 및 실패 인계](../uiux/unused-ui-removal-03.md)를 대조했다. 기준 `232a45d4c8ab43c704177d64ec46bc221eb99141` 이후 UIUX 삭제19개와 전용/혼합 테스트 변경, untracked output/을 보존했다. 삭제 파일별 유입0 근거와 테스트 철회 사유는 해당 인계의 표를 따른다. QA는 제품 파일을 추가 삭제하거나 현재 화면을 수정하지 않았다.

수정 전 `node --test test/map-transport-ui-contract.test.mjs`는 **14건 중11 PASS/3 FAIL**, skip0(`/private/tmp/unused03-qa-before.log`). 인계된 세 케이스가 삭제 section/journey 읽기에서 실패했다. 현재 화면 회귀가 아닌 **삭제 파일 참조 및 과거 표시 계약**으로 분류했다.

이번 변경은 `test/map-transport-ui-contract.test.mjs` 및 이 기록 문서뿐이다.

1. 결과 진입점: 폐기 ConditionalVisitSection→CourseV1Journey 존재 검증을 section 파일 부재로 교체했다. 현재 CourseConfirm 연결·legacy 미연결 기대 유지.
2. single 대표/누적 대안: 폐기 section의 preview·조건부 문구·확정·더보기 전용 read/assert만 제거했다. 현재 대표/empty reason/누적 대안/verified-more/실제 continuation, Kakao 연결과 Results의 조건부 진입0 검증 유지.
3. 체류 표시: 폐기 Journey/Preview/ListModel 읽기를 현재 `CourseV1SummaryCard`, `CourseV1VerticalDetail`, `courseV1CardDetailModel`, `courseConfirmActiveModel` 계약으로 이관했다. **review의 상세 펼침에서만 원본 snapshot 계획 체류 표시, 결과/장소 상세/active에서는 체류 분 비노출, short는 숫자 없는 의미 표시**를 검증한다. 과거의 모든 화면 체류 숫자 비노출 규칙을 복원하지 않았다. 현재 코스 합계는 이동+체류이며 도착 여유와 분리됨을 확인한다.

세 번째 케이스는 source 계약과 함께 기존 실행형 `place-course-screen-runtime`의 두 PF restore 테스트(실제 short20/recommended35 상세 펼침·active/Home 재진입 비노출, 실제 Results summary/PlaceDetail 비노출)를 그대로 실행했다. 정적 문자열 검사만으로 현재 동작 보존을 대신하지 않는다.

첫 이관 집중 검사에서 `CourseV1VerticalDetail` props가 바로 model로 시작한다고 가정한 정규식1건이 실패했다. 실제 expansionKey가 앞에 있음을 확인해 props 순서 의존만 제거하고 model/detail·mode 전달 기대는 유지했다(`/private/tmp/unused03-qa-contract.log`). 최종 집중/전체에서 통과했다.

### 유지 계약

현재 수동 검색/지도 선택·개발 시각/QA 입력·추천/더보기·180분/2곳·원본 날짜/만료·진행/완료/기록·사진 허락·Live Activity·계정/동의/학습, 엔진/services/DB/migration/카탈로그/native 경계는 변경하지 않았다. QA 테스트14건 자체는 모두 유지했고 skip·발견 설정·loader 변경0이다. 제품 코드 복원이나 정책 완화로 통과시키지 않았다.

### 최종 자동 검증

| 실행 | 결과 | 로그 |
| --- | --- | --- |
| 삭제 목표·현재 화면/검색/지도/복원/날짜/만료/기록·QA 계약 집중9파일 | **165/165 PASS**, skip0 | `/private/tmp/unused03-qa-focus.log` |
| `npm run test:typecheck` | **PASS**, exit0 | `/private/tmp/unused03-qa-types.log` |
| `npm run test:ui` | **795 PASS/FAIL0/기존 skip1**, 총796, exit0 | `/private/tmp/unused03-qa-ui.log` |
| `npm test` | **555/555 PASS**, skip0, exit0 | `/private/tmp/unused03-qa-all.log` |
| `node scripts/release-build.cjs export` | **public iOS PASS**, exit0 | `/private/tmp/unused03-qa-export.log` |
| `git diff --check` | **PASS**, 최종 문서 포함 | 로컬 검사 |

집중 명령:

```sh
node --import tsx --test test/map-transport-ui-contract.test.mjs test/ui/unused-ui-removal-03.test.mjs test/ui/current-flow-refactor-safety.test.mjs test/ui/place-course-screen-runtime.test.mjs test/ui/location-search-interaction.test.mjs test/ui/manual-location-restore.test.mjs test/ui/course-date-screen-boundary.test.mjs test/ui/current-course-start-expiry.test.mjs test/ui/guest-import-record-display.test.ts
```

UI 총수815→796은 UIUX 전용39건 제거+목표20건 추가로 순감소19건이다. 기존 skip1 변화0. QA 이관으로 케이스 감소0. 기본 runner 총수537→555는 신규 `.mjs` 제거20건과 폐기 `.mjs` 전용2건의 차이이며 TypeScript 하위 실행은 기존 loader로 유지한다. UIUX 기본 실행의 세 실패 및 집계1은 최종 재검증에서 모두 해소됐다. UI 수와 기본 수를 단순 합산하거나 과거 실행 결과로 대신하지 않았다.

실제로 재생성된 산출물: `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`. 직전과 동일한 파일명은 미연결 제거에 부합하는 보조 관찰이며 서명 IPA·native·실기기 동일성 증명은 아니다. 번들 생성은 실행했고 Archive/IPA·설치·업로드·스토어 확인은 미실행이다.

### 다음 담당·미확인 조건

**자동 검증 완료 → 통합 범위·삭제/테스트 대응표 수락 → 수정 빌드 최소 실기기 확인**으로 인계한다. 수동 검색/지도 선택→추천→현재 코스 진행/완료/기록, 기존 진행 이어가기·Live Activity 공유를 한 묶음으로 확인한다. 기존 데이터를 삭제하거나 운영 API/DB 반복 호출을 요구하지 않는다.

이번 QA에서 실제 API·운영 DB·계정 생성/삭제·Simulator 조작·실기기 확인·stage/commit/push·배포는 수행하지 않았다. 자동 PASS를 실기기 성공으로 표시하지 않는다. 추가 엔진/서비스/DTO 정리는 별도 역할·승인 범위다.
