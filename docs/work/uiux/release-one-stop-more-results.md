# U-ONE-MORE-01 — 출시 1곳 추천 `다른 장소 더 보기`

## 상태

통합 수락. `2-V`의 공개 `continueReleaseOneStopRepresentativeCourseV1`, continuation과 네 page state를 그대로 연결했고, 2026-09-02 통합 세션이 전체 UI 회귀 191 통과·기존 skip 1·실패 0와 typecheck·diff check를 독립 재확인했다. `QA-ONE-MORE-01` 자동 게이트도 2026-09-03 수락됐다.

## 목적

첫 결과의 속도는 유지하면서 사용자가 원할 때 실제 검증된 one-stop 장소를 더 비교하게 한다. 더보기는 무경로 장소 목록이나 새 추천이 아니라, 같은 추천 입력에서 아직 검증하지 않은 다음 후보를 이어 확인하는 행동이다.

## 구현 명령

1. `2-V`가 공개한 release one-stop continuation과 page entry만 사용한다. 기존 multi-stop `continueLimitedRepresentativeCourseV1`를 release 화면에 연결하지 않는다.
2. 첫 화면은 대표 1개와 첫 대안 최대 3개를 유지한다. `releaseOneStopDisplayResult`의 초기 대안 제한은 초기 투영에만 적용하고, 이후 page 결과를 포함한 전체 배열을 다시 `.slice(0, 3)`으로 자르지 않는다.
3. `more_available`일 때 검증 대안 목록 아래, 조건부 `운영시간 확인 후 들러볼 곳` 위에 primary와 시각적으로 구분되는 `다른 장소 더 보기` 버튼을 둔다. 버튼은 후보가 실제로 남아 있을 때만 보인다.
4. tap 한 번에 같은 `RecommendationSession`의 메모리에 보관된 최초 input과 현재 continuation으로 page entry를 정확히 한 번 호출한다. 연타·동시 요청을 막고 로딩 중에는 `다른 장소 확인 중…`과 진행 상태를 접근성으로 알린다. 렌더·스크롤·카드 상세 진입만으로 호출하지 않는다.
5. 새 검증 결과는 place ID로 기존 대표·대안과 중복 제거한 뒤 최대 3개를 기존 대안 뒤에 append한다. 대표·기존 카드 순서·선택 상태를 바꾸지 않고, 성공 뒤 새 카드가 보이도록 하되 목록 맨 위로 강제 이동하지 않는다.
6. page가 다시 `more_available`이면 버튼을 유지한다. `exhausted`는 `이 조건에서 확인할 수 있는 다른 장소가 없어요`, `provider_unavailable`은 `다른 장소를 지금 확인하지 못했어요`, `continuation_unavailable`은 `이 결과에서는 더 확인할 수 없어요. 다시 추천해 주세요.`로 끝낸다. 기존 카드와 상세 진입은 항상 유지한다.
7. page가 0개를 추가했지만 `more_available`이면 버튼을 유지하며 provider 실패 문구를 표시하지 않는다. 같은 tap 안에서 자동으로 다음 페이지를 연속 호출해 3개를 억지로 채우지 않는다.
8. 카드 전체 tap, CourseConfirm 세로 상세, 뒤로가기의 선택·추가 카드·스크롤 상태를 보존한다. navigation params에는 provider·route port·함수·Date 등 비직렬 값을 넣지 않는다.
9. 조건부 시장 로컬 `더 보기`와 문구·상태·호출 함수를 섞지 않는다. 검증 더보기만 route receipt를 호출하며 조건부 영역은 계속 route 0이다.
10. CAPTCHA 재발급, Route Proxy 설정, 엔진 순위·시간 계산, API cache, 카탈로그, 환경값은 수정하지 않는다.
11. 첫 계산에서 검증 코스가 0개여도 continuation/page state가 `more_available`이면 일반적인 최종 실패 화면으로 닫지 않는다. `아직 확인된 장소가 없어요`처럼 검증 결과 0건을 정직하게 알리고 같은 `다른 장소 더 보기`를 제공한다. 후보 없음·provider 종료·continuation 불일치일 때만 기존 최종 빈 상태를 사용한다.

## 실패 우선 UI fixture

1. initial 대표 1+대안 2+continuation: 버튼 표시, page 성공 뒤 대안 5개, 대표/기존 순서 불변, 중복 0.
2. 로딩 중 두 번 tap: page 호출 1회, disabled/접근성 busy 표시.
3. page 0+`more_available`: 기존 카드 유지, 버튼 유지, 자동 재호출 0.
4. exhausted/provider/continuation 종료: 올바른 문구, 버튼 제거, 기존 카드 tap 가능.
5. 조건부 시장 더보기와 검증 더보기의 호출 함수·testID가 다르고 전자는 route 0이다.
6. 카드 상세 왕복 뒤 append 목록과 continuation 상태가 유지된다.
7. production 화면에 내부 attempt·cursor·signature·provider 사유 원문을 노출하지 않는다.
8. initial course 0+`more_available`: 검증 0건 상태와 더보기 버튼이 함께 보이고, tap 1회 뒤 성공한 새 one-stop이 첫 대표가 된다. 자동 page 호출은 0이다.

## 수정 경계와 완료 기준

- 수정 가능: `src/ui/`, UI 전용 테스트, 이 작업 문서.
- 수정 금지: `src/engine/`, `src/services/`, Edge/DB, data/catalog, `.env*`, 기준 정책 문서, 작업 보드.
- 최소 실행: 관련 UI 테스트, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`.
- 인수인계에는 변경 파일, page entry 호출 횟수, initial/append/종료 fixture 결과, 실기기에서 확인할 항목을 남긴다.

## 완료 인수인계 (2026-09-02)

### 1. 변경 파일과 변경 목적

- `src/ui/ResultsScreen.tsx`: release one-stop 결과의 대표·누적 대안·continuation을 화면 메모리 state로 유지하고, 검증 대안 아래/조건부 영역 위에 `다른 장소 더 보기`를 연결했다. 로딩 중에는 단일 pending과 접근성 busy 상태를 표시하며, initial 0건+`more_available`도 별도 정직한 빈 상태에서 같은 버튼을 제공한다.
- `src/ui/recommendation/releaseOneStopMoreResultsModel.ts`: release single continuation만 식별하고 초기 대표+대안 최대 3개를 투영한 뒤, 각 page 앞 최대 3개의 새 single을 place ID로 중복 제거해 기존 목록 뒤에 누적한다. 첫 결과 0건이면 첫 새 코스만 대표로 승격하며 네 page state의 고정 사용자 문구와 동기 lock을 제공한다.
- `src/ui/recommendation/v1Session.ts`: 같은 `RecommendationSession` 객체의 `WeakMap` 메모리 input과 현재 single continuation만 `continueReleaseOneStopRepresentativeCourseV1`에 결합하는 `continueReleaseRecommendationSession`을 추가했다. navigation params에는 input·provider·route port·함수를 추가하지 않았다.
- `test/ui/release-one-stop-more-results.test.ts`: 초기/누적/0건/빈 page/종료/연타/single page entry/조건부 분리 8개 fixture를 추가했다.
- `test/map-transport-ui-contract.test.mjs`: 과거 one-stop 이어보기 비노출 정적 기준을 수락된 single 전용 `verified-course-more` 기준으로 교체하고, 다장소 continuation 금지는 유지했다.

### 2. 유지한 공개 계약·정책 경계

- `src/engine/`, `src/services/`, data/catalog, DB/Edge, 환경값, 작업 보드를 수정하지 않았다. 엔진 순위·시간·운영시간·attempt 상한·cache와 CAPTCHA 계약도 변경하지 않았다.
- 첫 화면의 대표 1+대안 최대 3개 제한은 유지했다. page가 추가된 뒤에는 전체 배열을 다시 자르지 않으며 대표·기존 카드 identity와 순서를 보존한다.
- release 화면은 `continueLimitedRepresentativeCourseV1`를 호출하지 않는다. `attemptedCandidateIds`/`verifiedCandidateIds`를 가진 2-V single continuation만 허용하고 과거 다장소 continuation은 버튼 상태로 승격하지 않는다.
- 조건부 시장의 `conditional-visit-more`는 기존 로컬 8개 paging과 route 0을 유지한다. 검증 더보기는 별도 `verified-course-more`/single page wrapper를 사용한다.
- 카드 전체 tap, `CourseConfirm` payload와 뒤로가기 동작은 바꾸지 않았다. Results 화면이 stack에 유지되는 동안 추가 카드·continuation·스크롤 상태도 같은 컴포넌트 메모리에 남는다.

### 3. page entry 호출 횟수와 fixture 결과

- 명시 tap wrapper fixture: 현재 session 메모리 input+continuation으로 single page entry 정확히 1회 호출, 반환 page identity 유지.
- 로딩 중 2회 tap: 동기 lock의 첫 요청만 허용하고 두 번째는 0회 추가 호출. 완료 뒤에만 다음 tap을 허용한다.
- initial 대표 1+대안 2: 새 single 3개 page 뒤 대안은 기존 `B,C` 뒤 `D,E,F`가 붙어 총 5개이며 대표와 기존 identity/순서, 중복 0을 확인했다.
- initial 0+`more_available`: 자동 page 호출 0, `아직 확인된 장소가 없어요`와 버튼을 함께 표시한다. 첫 명시 page의 `D,E` 중 D를 대표, E를 대안으로 승격한다.
- page 0+`more_available`: 기존 카드·버튼·continuation을 유지하고 자동 연속 호출 및 provider 오류 문구는 0이다.
- `exhausted`, `provider_unavailable`, `continuation_unavailable`: 각각 확정된 비밀 없는 문구로 끝내고 버튼만 제거하며 기존 카드는 유지한다.
- page 입력의 중복·다장소·네 번째 항목은 append하지 않고, 이를 보충하려 다음 page를 자동 호출하지 않는다.

### 4. 테스트 결과

- U-ONE-MORE-01 전용 fixture: 8/8 통과, 실패·skip 0.
- 결과·조건부·카드 상세·런타임·진행 관련 UI 묶음: 46/46 통과.
- 수락된 2-V page 회귀: 6/6 통과.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 192건 중 191 통과, 기존 철회 이력 1 skip, 실패 0.
- `npm test`: 113/113 통과, 실패·skip 0.
- `git diff --check`: 통과.

### 5. 다음 결정·위험·실기기 확인

- internal iOS build에서 대표 1+대안 2 상태의 버튼 위치, `다른 장소 확인 중…` VoiceOver busy 안내, 새 카드가 버튼 자리 위에 자연스럽게 나타나며 목록 맨 위로 이동하지 않는지 확인한다.
- 새 카드 상세 진입 후 뒤로왔을 때 추가 목록·버튼/종료 상태·스크롤 위치가 실제 native stack에서도 유지되는지 확인한다.
- initial 0+후보 잔여와 page 0+`more_available`, 세 종료 문구, 조건부 시장 `더 보기`가 동시에 보이는 낮 시간대 화면을 확인한다.
- provider 호출량·선택 폭 계약은 `QA-ONE-MORE-01`의 밀집 고정 fixture 2개에서 확인한다. QA 세션은 Simulator를 조작하지 않으며, 실제 체감은 필요할 때만 사용자 수동 smoke 1회로 별도 확인한다.

---

## 2026-09-02 — 통합 수락

- 수정 범위는 `src/ui/ResultsScreen.tsx`, `src/ui/recommendation/releaseOneStopMoreResultsModel.ts`, `src/ui/recommendation/v1Session.ts`, UI/정적 계약 테스트와 이 작업 문서로 제한됐고 엔진·API·데이터·DB·환경값은 바꾸지 않았다.
- initial 0건+후보 잔여, page 0건+후보 잔여, 단일 pending, place ID 중복 제거, 대표·기존 순서 보존, 네 종료 상태, 조건부 시장 더보기 분리를 수락한다.
- 독립 실행 `npm run test:ui`는 192건 중 191 통과·기존 skip 1·실패 0, `npm run test:typecheck`, `npm test`, `git diff --check`는 모두 통과했다. 샌드박스 IPC `EPERM`으로 UI 테스트가 한 번 시작되지 않았지만 동일 명령을 권한 경계 밖에서 재실행해 성공했다.
- 메모리 전용 continuation이므로 앱 프로세스 종료·재시작 뒤 이어보기는 보장하지 않는다. 이는 서버 세션 저장과 비직렬 navigation payload를 금지한 현행 계약이며 이번 출시 차단 사항이 아니다.
