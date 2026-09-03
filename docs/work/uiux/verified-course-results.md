# U-RESULTS-03 — 검증 대안·조건부 발견 결과 화면

## 상태

수락 — U-RESULTS-03-C. `U-KAKAO-DEEPLINK-01`, `2-Q`, `DATA-MARKET-01`, `API-PAGE-01`, `2-R` 수락 뒤 조건부 수동 계산 CTA와 결과 표시를 연결했다. 2026-08-31 통합 검토의 CTA handler route 0·중복 호출·실패 상태 fixture 보완도 완료했다. 같은 `src/ui/` 소유 경계 때문에 U-KAKAO와 병행하지 않는다.

## 읽을 범위

`AGENTS.md` → `docs/README.md` → `docs/작업조정_보드.md` → `docs/03_product/UIUX_공통규칙.md` 4·4-1 → `docs/03_product/UIUX_테스트명세.md` UXV-20·42 → `docs/테스트.md` UX-22·REC-28·29 → 2-Q/DATA-MARKET/API-PAGE 완료 인계 → 이 문서.

## 구현 명령

1. 철회된 무경로 `이 시간에 더 들러볼 곳` 결과 목록을 검증 대안 카드로 교체한다. 상단 대표 1개와 첫 대안 최대 3개는 모두 엔진 snapshot의 장소 순서·실제 legs·체류·남는 시간·도착 여유만 표시한다.
2. `다른 검증 코스 더 보기`는 UI 컨테이너가 결과 화면의 기존 `RecommendationSession`으로 같은 `CourseV1LimitedInput`(provider·route ports 포함)을 다시 조립해 `continueLimitedRepresentativeCourseV1({ ...originalInput, continuation })`을 한 번만 실행한다. continuation 자체에는 runtime context를 넣거나 AsyncStorage/DB/API에 저장하지 않는다. 로딩 중 중복 탭을 막고, 성공하면 `appendedCourses` 최대 3개를 기존 카드 뒤에 append하며 대표·기존 순서·스크롤 문맥을 바꾸지 않는다. `continuation_unavailable`이면 기존 카드를 유지하고 `이 결과에서는 더 확인할 수 없어요. 다시 추천해 주세요.`와 재추천 행동만 보인다. cursor 종료/한도/provider 실패도 reason 기반 종료 상태를 보인다.
3. `conditionalVisit`은 별도 `운영시간 확인 후 들러볼 곳`에만 보인다. 10:00–18:00 밖에는 렌더링하지 않는다. 출발/도착 중 직선거리 가까운 쪽으로 결정적 정렬한 첫 8개만 보이고, 별도 로컬 `더 보기`는 다음 8개를 기존 뒤에 추가한다. 이 행동은 route/API 호출 0이며 전체 조건부 후보의 총 노출 상한은 없다. 카드에는 `운영시간을 카카오맵에서 확인해 주세요`만 표시하고 실제 시간표·영업 중·안전·검증됨 문구를 쓰지 않는다.
4. 조건부 카카오맵 열기는 현재 공통 opener(U-KAKAO의 scheme→HTTPS/browser fallback)를 재사용하며 route/API 호출을 만들지 않는다. 사용자가 `확인했어요, 이 장소로 코스 계산`을 명시할 때만 조건부 수동 계산을 시작하고, 성공해도 `운영시간 확인 필요(사용자 확인)` 라벨을 유지한다.
5. 후보 없음·큐 종료·운영 종료·시간 초과·경로 미확인·provider 한도를 서로 구분한 간결한 화면 문구로 매핑한다. 내부 8/16 숫자·근사값·원인 없는 실패 문구는 노출하지 않는다.

## 필수 테스트

- 대표 + 1/2/3 대안, 두 페이지 append, 중복 탭 차단, 기존 결과/스크롤 불변, 종료 reason fixture.
- 모든 코스 카드가 엔진 snapshot만 렌더하고 무경로 장소·근사 시간을 대안으로 쓰지 않는 테스트.
- 조건부 09:59/10:00/18:00/18:01, 확인 전 route 0, 확인 뒤 상태 유지, excluded 후보 미노출 fixture.
- 카카오맵 scheme 성공/실패→HTTPS/browser fallback과 route 0을 공통 opener mock으로 확인한다.

## 수정 범위와 금지

`src/ui/`, 화면 테스트, 필요한 UI iOS 설정, 이 문서만 수정한다. 엔진 계산, API budget/cache, 카탈로그, DB, 제품 정책, 보드는 수정하지 않는다.

## 완료 인계

변경 화면/상태/testID, 엔진 continuation 소비 방식, 링크 fallback 불변, 테스트 결과와 internal build·실기기 확인 항목을 이 문서에 기록한다.

## 진행 인계 — 2026-08-31

### 1. 변경 파일 / 목적

- `src/ui/ResultsScreen.tsx`: 철회된 무경로 `이 시간에 더 들러볼 곳` 목록을 실제 `alternativeCourses` 카드로 교체했다. 대표와 모든 대안은 같은 `VerifiedCourseV1` snapshot의 장소 순서·legs·체류·여유만 `CourseV1Journey`로 표시한다. `verified-course-more`는 로딩 중 중복 탭을 막고 새 카드만 기존 뒤에 append하며, `more_available`·큐 종료·provider 불가·continuation 불가를 서로 다른 짧은 문구로 표시한다. 조건부 시장·거리 카드는 10:00–18:00에만 별도 영역에서 카카오맵 정보 확인만 제공한다.
- `src/ui/recommendation/v1Session.ts`: 첫 계산 때의 `CourseV1LimitedInput`(동일 provider·route/receipt ports)을 navigation payload 밖 `WeakMap` 메모리에 보관하고, `continueRecommendationSession`만 그 input과 opaque continuation을 결합하도록 했다. AsyncStorage·DB·API·navigation params에는 runtime context나 함수가 들어가지 않는다.
- `docs/work/uiux/verified-course-results.md`: 이 진행 인계와 남은 공개 계약을 기록했다.

### 2. 유지한 계약 / 경계

- 엔진·API budget/cache·카탈로그·DB·보드·공통 UIUX 정책 문서는 수정하지 않았다. 이어보기는 engine의 `continueLimitedRepresentativeCourseV1`을 한 번만 호출하고, 대표·기존 카드·스크롤 문맥을 교체하지 않는다.
- 대안에는 무경로 장소·근사 시간·조건부 후보를 섞지 않는다. 카카오맵 정보 전환은 기존 app scheme → HTTPS/browser fallback 공통 opener만 사용하며 route/API 호출을 만들지 않는다.
- 조건부 후보의 `확인했어요, 이 장소로 코스 계산`은 **아직 노출하지 않았다.** 현재 공개 엔진에는 conditional 후보만을 명시 확인 뒤 계산하고 결과에 `운영시간 확인 필요(사용자 확인)`을 보존하는 entry·결과 타입이 없다. UI가 기존 representative/탐색 verifier를 재사용하면 대표 승격·route 경계 위반이므로 구현하지 않았다.

### 3. 테스트 결과

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과: 140 pass, 기존 철회 이력 1 skip.
- `node --test test/map-transport-ui-contract.test.mjs` 13/13 통과, `npm test` 109/109 통과.
- `git diff --check` 통과.
- 모든 검증은 고정 fixture/정적 UI 계약이며 실제 Kakao·Route Proxy·CAPTCHA·Supabase 호출은 0회다.

### 4. 다음 결정 / 위험 / 재현 조건

- 추천 엔진 담당은 명시 사용자 확인 뒤에만 conditional 후보를 계산하고 `운영시간 확인 필요(사용자 확인)`을 보존하는 전용 entry와 fixture를 제공해야 한다. 그 뒤 UIUX는 해당 CTA·성공/실패 화면을 추가하고 확인 전 route 0 및 확인 뒤 조건부 상태 유지 테스트를 완결한다.
- 새 internal build에서 대표·대안 1/2/3곳, 두 페이지 append, 설치/미설치 카카오맵 fallback, 09:59/10:00/18:00/18:01 조건부 영역을 확인해야 한다.

---

## 2026-08-31 — 통합 재검토: U-RESULTS-03 추가 보완 지시

### 수락하지 않은 근거

1. 초기 `result.continuation.stopReason`이 `candidate_queue_exhausted` 또는 provider 종료여도 화면의 `continuationState`는 처음 `null`이다. 현 조건은 continuation 객체가 존재하기만 하면 `다른 검증 코스 더 보기`를 렌더하므로, 이미 끝난 큐에도 불필요한 호출 버튼이 보인다. `continuationMessage`도 state가 `more_available`이면 먼저 `null`을 반환해 초기 종료 문구가 사라진다.
2. `isLoadingMore` state만으로는 같은 렌더 프레임의 연속 탭을 원자적으로 막지 못한다. 첫 `setIsLoadingMore(true)`가 반영되기 전에 두 번째 handler가 같은 continuation을 실행할 수 있다. API-PAGE-01이 무상태로 cursor를 막지 않는 것은 확정된 경계이므로, UI의 동기 in-flight lock이 필요하다.
3. `continueRecommendationSession` 예외 시 loading state를 복구하지 않는다. 원시 오류를 보이지 않되 기존 카드는 유지하고 종료 상태를 안전하게 정해야 한다.
4. 이 작업의 필수였던 대표/대안·두 페이지 append·중복 탭·종료 상태·조건부 09:59~18:01·카카오 정보 전환 route 0을 검증하는 전용 UI fixture가 없다. 현재 통과한 일반 UI 회귀만으로는 새 흐름을 증명하지 못한다.
5. 정책에 있는 `확인했어요, 이 장소로 코스 계산`은 공개 엔진 entry가 없어 의도적으로 미구현이다. 이는 UI에서 representative verifier를 재사용해 임시로 해결하면 안 되며, 별도 `2-R` 엔진 계약 후에만 연결한다.

### 이번 U-RESULTS-03-R 수정 범위와 명령

1. `src/ui/`와 UI 테스트만 수정한다. `stopReason`에서 첫 화면의 effective page state를 순수 함수로 정한다.
   - `candidate_queue_exhausted` → `exhausted`
   - `provider_daily_limit`/`provider_unavailable` → `provider_unavailable`
   - continuation 없음·재수화 실패 → `continuation_unavailable` 또는 `exhausted`를 호출 결과에 맞게 쓴다.
   - 그 밖의 continuation만 `more_available`이다.
   - 더 보기 버튼은 effective state가 **정확히** `more_available`이고 continuation이 있을 때만 보인다. 종료 문구도 같은 effective state에서만 결정한다.
2. `useRef` 기반 동기 in-flight lock과 화면 loading state를 함께 쓴다. handler 진입 즉시 ref를 잠그고, `try/finally`에서 반드시 해제한다. 두 번째 탭은 engine/API 호출 0회여야 한다. 예외는 raw message 없이 기존 카드·스크롤을 유지하고 `provider_unavailable`의 간결한 문구로 끝낸다.
3. append 중복 방어는 ordered string만 비교하지 말고, 장소 ID를 정렬한 동일 집합 signature로 막는다. 엔진이 보장하는 순서중복 제거를 UI에서도 깨지지 않게 하되, `A`와 `A→B` 같은 서로 다른 부분집합은 유지한다.
4. 전용 순수 UI model/test 또는 적절한 화면 컨테이너 fixture를 추가한다.
   - 초기 exhausted/provider 종료: 버튼 없음·각 종료 문구.
   - `more_available` 두 페이지: 기존 대표/대안 순서 불변, 새 최대 3개만 뒤 append, 동일 장소 집합 중복 0, `A`/`A→B` 보존.
   - 같은 tick의 두 요청: engine continuation 호출 1회.
   - continuation unavailable/throw: 기존 카드 유지·재추천 문구 또는 안전한 provider 문구·loading 해제.
   - conditional 표시: 09:59/18:00 밖 0, 10:00~17:59만 표시; 출발/도착 중 가까운 쪽 거리순 첫 8개·다음 8개 append·중복 0·더 보기와 카카오 정보 확인 모두 route port 호출 0.
5. 조건부 카드에는 2-R 수락 전까지 `확인했어요, 이 장소로 코스 계산` CTA를 추가하지 않는다. UI가 제공해야 할 CTA/결과 상태는 2-R 공개 타입을 받은 뒤 별도 보완으로 완료한다.
6. 조건부 노출은 `session.nowIso`의 고정 추천 시작 시각으로만 `10:00 ≤ t < 18:00`을 판정한다. 09:59/18:00은 숨기고 10:00/17:59는 보이며, 결과를 읽는 중 wall clock 변화로 숨기지 않는다. 2-R 수락 뒤 CTA는 실제 tap 시각을 새로 캡처하고, `ceil((confirmedAt - session.nowIso) / 1분)`만큼 `remainingMin`을 차감한 입력을 만든다. 실제 확인 시각이 18:00 이상이거나 남은 시간이 유효하지 않으면 route 0·기존 결과 유지·`조건부 장소는 오후 6시 전 확인 후 계산할 수 있어요. 다시 추천해 주세요.`만 보인다.
7. `npm run test:typecheck`, 새 UI fixture, `npm run test:ui`, `npm test`, `git diff --check`를 실행하고, 결과와 internal build에서 확인할 항목을 인계한다.

## 완료 인계 — U-RESULTS-03-R (2026-08-31)

### 1. 변경 파일 / 목적

- `src/ui/recommendation/verifiedCourseResultsModel.ts`: initial continuation의 stop reason을 화면의 effective state로 결정하고, 종료 문구·순서 무관 동일 장소 집합 중복 제거·동기 in-flight lock·고정 추천 시작 시각 기반 조건부 8개 페이지를 순수 함수로 분리했다.
- `src/ui/ResultsScreen.tsx`: effective state가 `more_available`일 때만 이어보기 버튼을 보이게 했고 `useRef` lock과 `try/finally`로 같은 tick 중복 요청 및 예외 뒤 loading 고착을 막았다. 조건부 후보는 출발/도착 중 가까운 쪽 거리순으로 첫 8개와 로컬 더보기 8개씩만 표시한다.
- `test/ui/verified-course-results.test.ts`, `test/map-transport-ui-contract.test.mjs`: 종료 state, 집합 중복·부분집합 보존, 동기 lock, 09:59/10:00/17:59/18:00 및 조건부 페이지를 고정했다.

### 2. 유지한 계약 / 경계

- continuation은 화면 메모리의 기존 input·provider·route ports만 사용하며, API/DB/AsyncStorage/navigation에 재수화 상태를 저장하지 않는다. exception은 raw error 없이 기존 카드를 유지하고 provider 종료 문구로 끝난다.
- 조건부 더보기·카카오맵 정보 확인은 route/API 호출을 만들지 않는다. 카카오맵 app scheme → HTTPS/browser fallback 계약은 바꾸지 않았다.
- 2-R 수락 전 조건부 `확인했어요, 이 장소로 코스 계산` CTA는 추가하지 않았다. 엔진·API·카탈로그·DB·보드·정책 문서는 수정하지 않았다.

### 3. 테스트 결과

- `npm run test:typecheck` 통과.
- `npx tsx --test test/ui/verified-course-results.test.ts` 4/4 통과.
- `node --test test/map-transport-ui-contract.test.mjs` 13/13 통과.
- `npm run test:ui` 144 pass, 기존 skip 1.
- `npm test` 109/109 통과, `git diff --check` 통과.
- 고정 fixture만 사용했으며 실제 Kakao·Route Proxy·CAPTCHA·Supabase 호출은 0회다.

### 4. 다음 결정 / 위험 / 재현 조건

- 2-R의 공개 conditional manual entry/type 수락 뒤에만 명시 확인 CTA, 실제 tap 시각 차감, 18:00 이후 안전 종료, `운영시간 확인 필요(사용자 확인)` 결과 연결을 추가한다.
- 새 internal build에서 초기 exhausted/provider 종료 버튼 미노출, 빠른 두 번 탭 한 요청, 두 페이지 append·스크롤 유지, 조건부 09:59/10:00/17:59/18:00, 설치/미설치 카카오맵 복귀를 확인한다.

---

## U-RESULTS-03-C — 조건부 장소의 명시 확인 수동 계산 연결

### 목표

`운영시간 확인 후 들러볼 곳`의 조건부 시장·거리 카드에서 사용자가 카카오맵을 확인한 뒤 **명시적으로만** 한 곳의 실제 경로·체류 계산을 요청할 수 있게 한다. 성공 결과는 대표 추천·검증 대안과 끝까지 분리하고 `운영시간 확인 필요(사용자 확인)`으로만 표시한다.

### 수정 범위와 금지

`src/ui/`, UI 컨테이너/순수 UI model 테스트, 이 문서만 수정한다. 엔진/API adapter/카탈로그/DB/제품 정책/보드는 수정하지 않는다. 외부 카카오맵 opener의 app scheme → HTTPS/browser fallback 계약도 바꾸지 않는다.

### 구현 명령

1. `v1Session`에 조건부 수동 계산을 위한 UI 경계를 추가한다.
   - 최초 `runRecommendationSession` 뒤에는 continuation 유무와 관계없이 같은 화면 메모리의 원래 `CourseV1LimitedInput`을 `WeakMap`에 보관한다. navigation params·AsyncStorage·DB·API에 provider, receipt port, CAPTCHA token, 좌표, 사용자 ID를 저장하지 않는다.
   - 선택된 화면 후보 한 개와 실제 `confirmedAt`을 받는 전용 helper를 만든다. `elapsedMin = max(0, ceil((confirmedAt - session.nowIso) / 1분))`, `remainingMin = session.remainingMin - elapsedMin`을 계산해 2-R의 `buildConfirmedConditionalManualCourseV1`에 전달한다. 최초 추천 시각을 `now`로 재사용하면 안 된다.
   - 원래 receipt port가 없거나 재수화 메모리가 없으면 legacy/API fallback을 호출하지 않고 typed 안전 실패로 끝낸다. helper의 테스트 seam은 실제 시각과 route/receipt port를 주입할 수 있어야 한다.
2. 조건부 카드에는 `카카오맵에서 확인`과 별도로 `확인했어요, 이 장소로 코스 계산` CTA를 둔다. 지도 열기·조건부 더보기·화면 진입은 route/API 호출 0회이고, 이 CTA만 수동 계산을 시작한다. 같은 카드의 연속 탭은 `useRef` 동기 lock과 disabled/loading 상태로 한 요청만 허용한다.
3. CTA 직전 실제 확인 시각이 18:00 이상이면 **2-R entry와 route adapter를 호출하지 말고** 기존 결과·카드 목록을 유지하며 다음 고정 문구만 표시한다.

   `조건부 장소는 오후 6시 전 확인 후 계산할 수 있어요. 다시 추천해 주세요.`

   10:00 이상 18:00 미만에서만 helper를 호출한다. 시간 부족, 후보 자격 상실, exact route 없음, provider unavailable은 각각 원시 오류·quota·좌표 없이 짧은 고정 문구로 표현한다.
4. 성공하면 선택 카드 아래 또는 별도 결과 영역에 한 개의 실제 여정 snapshot을 표시한다. 카드의 고정 라벨은 정확히 `운영시간 확인 필요(사용자 확인)`이다. `CourseV1Journey`와 장소 미리보기는 재사용할 수 있지만, 대표/검증 대안 배열에 append하거나 `대표 추천`, `검증 대안`, `추천`, `검증됨`, 자동 저장 가능으로 표현하지 않는다. 현재 일반 `CourseConfirm`으로 이동하거나 저장 행동을 노출하지 않는다.
5. 기존 조건부 목록·대표·대안·continuation 상태와 스크롤 문맥은 수동 결과 성공/실패로 교체하지 않는다. 다른 조건부 장소도 계속 확인할 수 있다. 외부 카카오맵에서 돌아왔는지는 자동 추측하지 않으며 CTA 자체를 명시 확인 근거로 사용한다.

### 필수 고정 fixture

- continuation이 없는 최초 결과도 원래 input/receipt port를 화면 메모리에 보관한다. navigation 직렬화값에는 runtime context가 없음도 확인한다.
- `session.nowIso`보다 1초·60초·61초 뒤 CTA에서 elapsed ceil 및 차감 `remainingMin`·`now=confirmedAt`이 2-R 입력에 정확히 전달된다.
- 09:59/10:00/17:59/18:00 CTA 경계: 10:00·17:59만 manual entry 한 번, 18:00은 entry·route 0과 고정 문구다. 선택 전/카카오맵 열기/조건부 더보기는 route 0이다.
- 같은 tick의 CTA 두 번은 route helper 한 번, 성공 결과는 조건부 상태 라벨만 가지며 대표/대안/CourseConfirm 저장 행동을 만들지 않는다.
- receipt port 없음·engine typed rejection·throw는 기존 카드 유지, loading 해제, raw provider 오류 미노출을 확인한다.
- `npm run test:typecheck`, 새 UI fixture, `npm test`, `npm run test:ui`, `git diff --check`를 실행하고 네 항목 완료 인계를 남긴다.

### 완료 인계 — U-RESULTS-03-C (2026-08-31)

#### 1. 변경 파일 / 목적

- `src/ui/recommendation/v1Session.ts`: 최초 결과에 continuation이 없어도 동일 `CourseV1LimitedInput`을 화면 메모리 `WeakMap`에 보관하고, `requestConditionalManualCourse`가 실제 CTA 시각·올림 차감 예산·같은 receipt port만 2-R entry로 전달하도록 추가했다.
- `src/ui/recommendation/verifiedCourseResultsModel.ts`: 실제 CTA 시각의 10:00–17:59 gate, typed 수동 실패의 비밀 없는 화면 문구, 카드별 동기 lock을 추가했다.
- `src/ui/ResultsScreen.tsx`: 조건부 카드에 명시 CTA를 추가했다. 18:00 이후에는 entry/route를 호출하지 않고 고정 문구만 보이며, 성공 코스는 카드 안에서만 `운영시간 확인 필요(사용자 확인)`으로 실제 시간 여정을 표시한다.
- `test/ui/conditional-manual-ui.test.ts`: continuation 없는 입력 보관, 1/60/61초 올림 차감, 09:59/10:00/17:59/18:00 경계, 동일 카드 동기 lock을 고정했다.

#### 2. 유지한 계약 / 경계

- runtime input·receipt port는 navigation/AsyncStorage/DB/API에 저장하지 않으며, port가 없으면 legacy/API fallback 없이 typed 안전 실패로 끝난다.
- 카카오맵 열기·조건부 더보기·화면 진입은 route 0이고, 명시 CTA만 2-R entry를 호출한다. 외부 app scheme → HTTPS/browser fallback 계약은 바꾸지 않았다.
- 수동 성공은 대표·검증 대안·continuation·일반 `CourseConfirm`·저장 흐름으로 병합하지 않는다. `추천`·`검증됨`·자동 저장 가능 표현도 추가하지 않았다.

#### 3. 테스트 결과

- `npm run test:typecheck` 통과.
- `npx tsx --test test/ui/conditional-manual-ui.test.ts` 3/3 통과.
- `npm run test:ui` 147 pass, 기존 skip 1.
- `npm test` 109/109 통과, `git diff --check` 통과.
- 고정 fixture만 사용했으며 실제 Kakao·Route Proxy·CAPTCHA·Supabase 호출은 0회다.

#### 4. 다음 결정 / 위험 / 재현 조건

- 새 internal build에서 카카오맵 외부 확인→복귀→CTA의 실제 시각 차감, 18:00 이후 CTA route 0, 성공/typed 실패 후 기존 대표·대안·조건부 목록 유지, 설치/미설치 fallback을 확인해야 한다.
- 사용자 확인은 실제 카카오 운영시간의 진실성 보장이 아니며, 수동 성공도 계속 사용자 확인 상태로만 표시한다.

---

### 통합 재검토 보완 명령 — 같은 U-RESULTS-03-C

#### 보완 이유

현재 새 fixture는 `isConditionalManualConfirmTime`과 keyed lock을 각각 통과시킨다. 그러나 이 둘만으로는 실제 `confirmConditionalPlace` 흐름이 18:00에 `requestConditionalManualCourse`/2-R entry/route를 호출하지 않는지, 같은 tick 두 CTA가 실제 요청 하나만 만드는지, receipt port 부재·throw 뒤 화면 상태가 정상으로 돌아오는지를 증명하지 못한다. 이는 단순 화면 문구가 아니라 유료/제한 API 호출 경계이므로 수락 전에 실제 action entry를 고정해야 한다.

#### 수정 범위

`src/ui/`, `test/ui/conditional-manual-ui.test.ts` 등 UI fixture, 이 문서만 수정한다. 엔진/API adapter/카탈로그/DB/제품 정책/보드는 수정하지 않는다.

#### 완료 명령

1. Results handler가 직접 조건을 조합해 테스트 불가능한 상태로 남지 않도록, CTA 실행을 담당하는 순수 UI action/controller를 분리한다. 입력은 `placeId`, `confirmedAt`, request callback/port이고 결과는 성공·typed rejection·after-window block·unavailable만 가진다. React 화면은 keyed lock을 얻은 뒤 이 action만 호출한다.
2. 아래 fixture는 **분리한 action을 실제 실행**하고 request callback 및 receipt adapter의 호출 횟수를 세야 한다.
   - 09:59와 18:00: request callback·2-R entry·route 0, 특히 18:00은 고정 문구를 반환한다.
   - 10:00과 17:59: request callback 정확히 1회 및 2-R 결과를 그대로 조건부 상태로 전달한다.
   - 같은 placeId의 같은 tick 두 CTA: 첫 request가 pending인 동안 action/route는 정확히 1회다. 다른 placeId는 독립적으로 동작할 수 있다.
   - `requestConditionalManualCourse`의 receipt port 없음은 legacy route/API fallback 0, `unavailable`로 끝난다. callback throw와 typed rejection은 loading을 해제하고 기존 대표·대안·조건부 목록을 지우지 않는다.
3. 성공 화면 model/fixture에서 라벨이 정확히 `운영시간 확인 필요(사용자 확인)`이고 결과가 대표·검증 대안 배열 또는 `CourseConfirm` 저장 행동으로 변환되지 않음을 확인한다. raw provider 오류·quota·좌표가 UI 문구에 없음을 함께 검증한다.
4. 최초 결과에 continuation이 없어도 `WeakMap`을 보관하고 1/60/61초 올림 차감을 전송하는 기존 fixture는 유지한다. `npm run test:typecheck`, 해당 UI fixture, `npm test`, `npm run test:ui`, `git diff --check`를 다시 실행한다.

### 완료 인계 — U-RESULTS-03-C 보완 (2026-08-31)

#### 1. 변경 파일 / 목적

- `src/ui/recommendation/verifiedCourseResultsModel.ts`: `runConditionalManualAction`을 추가해 CTA의 실제 시각 gate와 `success`/typed rejection/after-window/unavailable 결과를 React handler 밖에서 결정한다.
- `src/ui/ResultsScreen.tsx`: 카드별 keyed lock을 얻은 뒤 위 action만 호출하게 변경했다. action의 after-window·typed 실패·예외는 기존 대표/대안/조건부 목록을 교체하지 않고 카드 상태만 갱신한다.
- `test/ui/conditional-manual-ui.test.ts`: action을 실제 callback으로 실행해 시간 경계의 request 0/1, pending 같은 카드 중복 1회, 다른 카드 독립 lock, port 부재 unavailable, throw 안전 종료를 고정했다.
- `test/map-transport-ui-contract.test.mjs`: 조건부 CTA/action/수동 상태 라벨/lock의 화면 연결 계약을 추가했다.

#### 2. 유지한 계약 / 경계

- 09:59·18:00에는 `requestConditionalManualCourse`·2-R entry·route를 호출하지 않는다. 10:00·17:59에만 request callback을 정확히 한 번 호출한다.
- receipt port 부재는 legacy/API fallback 없이 `unavailable`로 끝난다. 원시 provider 오류·quota·좌표는 화면 문구에 노출하지 않는다.
- 수동 성공은 `운영시간 확인 필요(사용자 확인)` 라벨로만 남고 대표·검증 대안·`CourseConfirm`·저장 행동으로 변환하지 않는다. 카카오맵 opener와 continuation 계약은 변경하지 않았다.

#### 3. 테스트 결과

- `npm run test:typecheck` 통과.
- `npx tsx --test test/ui/conditional-manual-ui.test.ts` 6/6 통과.
- `node --test test/map-transport-ui-contract.test.mjs` 13/13 통과.
- `npm run test:ui` 150 pass, 기존 skip 1.
- `npm test` 109/109 통과, `git diff --check` 통과.
- 모든 검증은 고정 fixture/callback으로 실행했으며 실제 Kakao·Route Proxy·CAPTCHA·Supabase 호출은 0회다.

#### 4. 다음 결정 / 위험 / 재현 조건

- 새 internal build에서 외부 카카오맵 확인→복귀→CTA 시각 차감, 18:00 route 0, pending 연속 두 번 탭, receipt port 부재/route 실패 뒤 기존 목록 보존, 설치/미설치 fallback을 확인해야 한다.
- 수동 확인은 운영시간 사실성 보장이 아니며 성공 화면도 사용자 확인 상태를 유지한다.

### 2026-08-31 — 통합 수락

U-RESULTS-03-C를 수락한다. `runConditionalManualAction`을 실제 callback으로 실행한 6개 UI fixture가 09:59/18:00 request 0, 10:00/17:59 허용, pending 중복 1회, receipt port 부재와 throw의 안전 종료를 고정했다. 통합 재실행에서 타입 검사, 해당 6/6, UI 계약 13/13, 전체 테스트 150 pass/기존 skip 1, UI 테스트, `git diff --check`를 확인했다. 다음은 코드 정책을 바꾸지 않는 `QA-RESULTS-01` fixture/E2E와 최소 실기기 게이트다.
