# U-UNUSED-UI-REMOVE-02 — UIUX 제거 인계

2026-09-13. 상태: **UIUX 제거·집중/UI 검증 통과 / 기본 전체 QA 참조 오류 잔여 / 전체 완료 아님**.
기준: [실행 명령](../qa-release/unused-ui-removal-02.md). 다음 담당 `QA-UNUSED-UI-REMOVE-02`.

## 1. 변경 파일과 호출 부재 근거

시작 HEAD는 `8c57a9cedade6836720a93dfb35c79982f84fbdf`. 작업 시작 시 기존 App/nav/AppFlow·네 legacy 화면 제거·만료 guard와 UI/QA 테스트·QA 명령 문서의 미커밋 변경, untracked 작업 기록/fixture 및 output/이 있었다. 그대로 보존했다. 아래 삭제18개와 테스트 정리·본 문서만 이번 작업이다. 기존 코드/데이터를 초기화하지 않았다.

`test/ui/unused-ui-removal.test.mjs`를 먼저 추가했다. App.tsx/index.ts와 src/scripts/supabase 전체 소스의 TypeScript AST에서 import/export 및 문자열 literal import()/require()를 해석해 삭제 집합 밖에서 안으로 들어오는 상대경로 참조가 **0**임을 변경 전에 확인했다. 전체 이름·경로 rg 검색도 대조했다. 호출자를 삭제해서 미사용으로 만든 것은 아니다. 임의 조합 문자열·운영 원격 코드·모든 네이티브 동적 로딩까지 증명하는 검사는 아니다.

| 삭제 파일 | 판정 |
| --- | --- |
| src/ui/recommendation/CandidateList.tsx | 과거 후보 목록, 보존 소스 호출0 |
| src/ui/recommendation/CandidateDetail.tsx | 과거 상세, 보존 소스 호출0; 현재 PlaceDetailScreen 유지 |
| src/ui/recommendation/BasketPanel.tsx | 과거 장바구니, 보존 소스 호출0 |
| src/ui/execution/CourseProgress.tsx | 제거된 Execution의 표시 계층, 보존 소스 호출0; 현재 CourseConfirm 유지 |
| src/ui/activity/ActivityDonut.tsx | 과거 통계 표시, 보존 소스 호출0; 현재 기록 통계 유지 |
| src/ui/Chip.tsx | 미연결 과거 표시 컴포넌트, 보존 소스 호출0 |
| src/ui/recommendation/TimeJourney.tsx | 과거 여정 표시, 보존 소스 호출0; 현재 CourseV1 여정 유지 |
| src/ui/recommendation/ExplorationPlaceCard.tsx | 과거 탐색 카드, 보존 소스 호출0; 조건부 개발 미리보기 및 현재 주변 유지 |
| src/ui/currentPlacePhoto.ts | CandidateDetail 전용 카탈로그 사진 lookup; 현재 사진 전달은 각 화면의 실제 catalog 모델 |
| src/ui/recommendation/TransportGlyph.tsx | 폐기 Candidate/Basket 표시 전용 |
| src/ui/recommendation/types.ts | 폐기 Candidate 표시/평가 타입, 보존 소스 호출0 |
| src/ui/recommendation/candidateModel.ts | 폐기 후보 계산, 보존 소스 호출0 |
| src/ui/recommendation/candidateEvaluation.ts | 폐기 후보·수단 예산 계산, 보존 소스 호출0 |
| src/ui/recommendation/basketPlanner.ts | 폐기 장바구니 계산, 보존 소스 호출0 |
| src/ui/recommendation/timeJourneyModel.ts | 폐기 여정 계산, 보존 소스 호출0 |
| src/ui/recommendation/oneStop.ts | 폐기 1곳 UI 계산, 보존 소스 호출0; 현재 엔진/oneStopSearchScope 유지 |
| src/ui/recommendation/useRecommendationSheet.ts | 미연결 과거 시트 hook, 보존 소스 호출0 |
| src/ui/recommendation/sheetLayout.ts | 위 과거 시트 전용, 현재 주변 layout/drag 유지 |

모든 삭제 파일은 HEAD에서 복구 가능하다. 폴더 전체 삭제·연쇄 서비스 제거·운영 기록 삭제는 하지 않았다.

### 테스트별 분류와 처리

| 파일/케이스 | 처리·이유 |
| --- | --- |
| candidate-model 4건 | 폐기 후보 중복/순위/상태/다양성 UI 알고리즘만 호출하므로 제거 |
| candidate-evaluation 3건 | 폐기 후보 conflict/수단/전체 장바구니 예산 계산 전용으로 제거 |
| basket-planner 5건 | 폐기 순서·예산·실경로 실패2건·정렬 함수 전용으로 제거. **실경로 없는 현재 코스 차단 계약은 odsay-removal-screen의 현재 CourseConfirm6건을 그대로 유지·실행** |
| time-journey 2건 | 폐기 UI의 권장/최소 체류 여정 계산 제거; course-v1-journey 등 현재 계산은 유지 |
| recommendation-sheet-layout 6건 | 폐기 56% 시트·offset·map focus·padding·작은 화면·snap 전용 제거; nearby-browse-sheet-layout 및 실제 드래그 회귀 유지 |
| candidate-detail-contract 1건 / basket-panel-contract 1건 / course-progress-contract 1건 | 각각 폐기 표시 컴포넌트의 props/문구만 검사하므로 제거; 현재 PlaceDetail/CourseConfirm 실행형 회귀 유지 |
| one-stop-recommendation 6건 중 5건 | 폐기 oneStop 알고리즘 호출5건만 제거. **minimumStayForSpot 엔진 최소 체류 계약1건은 같은 파일에 보존**, 엔진 구현 미수정 |
| public-api-photo 5건 | 전부 유지. 삭제 lookup 호출만 실제 `buildPlaceDetailModel(row).image.url`로 이관하고 제거된 ID는 현행 catalog에 없음/허락 없음으로 검증. 승인 URL·출처·수정 허용·실패 fallback·지도 전파 검증 유지 |
| unused-ui-removal 신규19건 | 보존 소스의 유입0 검사1건 + 지정 파일 부재18건 |

모든 케이스를 읽고 전용 테스트만 가진 8파일을 제거했다. 혼합 파일 one-stop-recommendation/public-api-photo는 통째로 삭제하지 않았다. 폐기 케이스28건 감소 + 신규19건 = UI 총수824→815(9건 감소), skip는 기존1 그대로다. 발견 경계/package 설정을 변경하지 않았다. 이름만 같은 테스트 mock의 비실행 문자열은 제품 import와 구분하며 불필요하게 다른 파일까지 정리하지 않았다.

## 2. 변경하지 않은 공개 계약

추천 엔진/최대180분·2곳/실경로 판정, services 전체, repository DTO, DB/migration/기존 저장 데이터, LegacyCompletionPanel/placeFeedback/완료 repository, 계정 격리/guest 가져오기/학습/동의/삭제, 현재 AppFlow와 진행 복원·만료 guard, Live Activity·알림·execution/schedule, 지도·공유 사진 컴포넌트, 카탈로그·native·권한은 수정하지 않았다. 조건부 개발 미리보기 묶음도 보존했다.

이전: 앱과 연결되지 않은 과거 UI/전용 모델·테스트 잔존 → 호출 부재 재확인 및 실패 우선 제거 목표 → 명시한18개만 제거, 현재 계약 테스트는 유지/실제 전달로 이관 → 실행 경로와 검증 목적 정합성 확보 → **UIUX 구현 현행 / QA 전체 게이트 수락 전**. 과거 코드가 없어져도 과거 기록을 읽는 서비스를 없애지 않는다.

## 3. 이번 실행 결과

| 검증 | 결과 | 로그 |
| --- | --- | --- |
| 삭제 전 목표 | 유입0 검사1 PASS / 삭제 목표18 FAIL | /private/tmp/unused-ui-red.log |
| 삭제 전 추천·진행·기록 보존 | 69/69 PASS | /private/tmp/unused-ui-baseline.log |
| 삭제 후 목표 | 19/19 PASS | /private/tmp/unused-ui-green.log |
| 삭제 후 집중8파일 | 105/105 PASS, skip0 | /private/tmp/unused-ui-focus.log |
| npm run test:typecheck | PASS exit0 | /private/tmp/unused-ui-types.log |
| npm run test:ui 최종 | 815건 / 814 PASS / 0 FAIL / 기존 skip1 | /private/tmp/unused-ui-ui.log |
| npm test | 520건 / 517 PASS / 3 FAIL / skip0 | /private/tmp/unused-ui-all.log |
| node scripts/release-build.cjs export | public iOS PASS exit0 | /private/tmp/unused-ui-export.log |
| git diff --check | PASS | 문서 포함 최종 실행 |

집중 명령은 `node --import tsx --test`에 unused-ui-removal/current-flow-refactor-safety/place-course-screen-runtime/guest-import-record-display/public-api-photo/public-api-photo-screen/odsay-removal-screen/one-stop-recommendation 파일을 전달했다. 첫 UI 전체 실행에는 아직 정리 전인 course-progress-contract ENOENT1건이 있었고, 전용1건임을 읽어 확인·제거 후 **최종 UI 실패0**이다.

public 산출물 `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`. 직전 만료 보완 export와 같은 파일명이다. 미연결 코드 제거에 부합하는 보조 관찰이며 서명 IPA 동일성·실기기 동작·모든 비활성 문자열 제거를 증명하지 않는다. Archive/IPA·설치·실제 API·운영 DB는 실행하지 않았다.

## 4. QA 인계·다음 결정·실기기 미확인

기본 전체 실패3건은 **QA 소유 삭제 파일 top-level 참조2건 + 하위 테스트 집계1건**이다. 현재 기능 회귀나 기존 만료 결함 재발로 분류하지 않는다. 로딩 실패 때문에 기본 발견 수가 달라졌으므로 517 PASS를 전체 통과로 보고하지 않는다.

- `test/map-transport-ui-contract.test.mjs`: 15행의 ExplorationPlaceCard read가 ENOENT. `explorationCard` 변수는 그 선언 외 사용0이다. QA는 불필요한 선언만 제거하고 현재 지도/링크/주변/진행 및 삭제 화면 비참조 기대값을 모두 유지한다.
- `test/mixed-travel-contract.test.mjs`: 8행 basketPlanner read가 ENOENT. 혼합 케이스에서 폐기 helper의 mode/automaticTravelLegs assertion2개만 제거하고, 현재 CourseConfirm의 검증 snapshot 소비·invalid 차단·재계산 없음과 보존 엔진/서비스 mode 기대는 유지한다. helper를 다시 제품에 복원해서 통과시키지 않는다.
- `test/index.js` 집계는 위 하위 실패로 발생했다. loader·발견 패턴·skip를 수정하지 않는다.

QA가 자기 파일만 이관한 뒤 typecheck/UI/전체/public export/diff를 최종 diff에서 재검증한다. 모두 통과 후 통합 수락 및 최소 실기기 추천→1/2곳→현재 코스→앱/웹 길찾기→완료/기록, 기존 진행 이어가기/Live Activity 공유를 확인한다. 이번 실기기 확인은 **미실행**이며 사용자에게 반복 운영 데이터 생성은 요구하지 않았다. commit/push·스토어 업데이트·운영 정리는 별도 승인 범위다.
