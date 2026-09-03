# U-RELEASE-ONESTOP-01 — 출시 1곳 추천 UI 연결

## 상태

**통합 수락 (2026-09-02).** 추천 엔진 `2-U`의 내부 후보 선별 보완과 병렬로 진행했으며, 아래 공개 계약과 역할 경계를 바꾸지 않고 UI 연결·회귀 검증을 마쳤다. 통합·결정 세션이 실제 소스와 독립 회귀를 재확인했으며 다음 게이트는 `QA-RELEASE-ONESTOP-01`이다.

> **후속 교체 범위:** 이 작업의 `continuation 없음·검증 더보기 비노출`만 `DEC-ONE-STOP-MORE-01`과 [U-ONE-MORE-01](release-one-stop-more-results.md)로 교체한다. 첫 대표 1+대안 최대 3, one-stop-only, 카드·시간·조건부 영역 계약은 유지한다. 아래 내용은 U-RELEASE-ONESTOP-01 완료 당시 이력이다.

```text
buildReleaseOneStopRepresentativeCourseV1(input)
  → representativeCourse: 실제 검증된 1곳 또는 null
  → alternativeCourses: 실제 검증된 서로 다른 1곳 코스 0~3개
  → continuation 없음
  → diagnostics: 내부 관찰용, 사용자 화면 비노출
```

두 작업의 최종 수락은 각각의 테스트가 끝난 뒤 통합·결정 세션이 함께 확인한다. UIUX 세션은 2-U의 내부 구현 완료를 기다리거나 `src/engine/`을 수정하지 않는다.

## 1. 목적과 사용자 관찰

### 이전 방식

- 출시 화면은 `buildLimitedRepresentativeCourseV1` 또는 internal B12를 선택해 1~3곳 결과와 continuation을 받았다.
- 결과 화면은 `대표 추천 · N곳`, `이 시간에 가능한 다른 코스`, `다른 검증 코스 더 보기`를 표시했다.
- 결과·코스 확인·진행 화면에 `활동 30분`, `30분 머물기`, 도착/출발 시각처럼 체류시간을 직접 또는 사실상 계산 가능한 형태로 표시했다.
- 시간 설정은 최대 180분이었다.

### 발생한 문제

- 실기기에서 다장소 첫 public segment가 `store` unavailable로 중단됐고, 허용한 국소 감사에서 단순 설정 결함을 찾지 못했다. 다장소를 계속 출시 조건으로 두면 추천 핵심과 UI 마감이 지연된다.
- 현 대표 191곳의 권장 체류가 모두 30분 템플릿이어서, 카드마다 `30분`을 장소별 정밀 근거처럼 보여 주면 신뢰를 떨어뜨린다.
- 실제 출시 범위는 1곳인데 화면에 다장소 수·이어보기 행동이 남으면 사용자가 제공되지 않는 기능을 기대한다.
- 1곳만 제공하면서 180분을 받으면 짧은 한 장소와 과도한 남는 시간이 나타날 수 있다.

### 교체 결과

- 출시 기본 계산은 `출발 → 한 장소 → 도착/복귀`의 release one-stop entry를 사용한다.
- 첫 화면은 `이 시간의 추천` 1개와 `다른 추천` 0~3개만 보여 준다. 카드 수는 목표이지 보장이 아니다.
- 다장소 표현과 검증 코스 continuation CTA를 출시 UI에서 제거한다.
- 최대 입력은 120분이다.
- 엔진 snapshot의 체류 분은 계산·막대 비율·내부 상태에 남기되 사용자 텍스트와 접근성 문구에는 표시하지 않는다. `stayState=short`일 때만 `가볍게 둘러보기`를 표시한다.

상태: **2026-09-02 공모전 출시 현행 정책, UI 구현 전**. 기준은 `docs/03_product/추천로직.md`, `docs/테스트.md`의 `REC-30`, `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`다.

## 2. 먼저 읽을 파일

1. 루트 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md`의 2026-09-02 출시 파이프라인
3. `docs/테스트.md`의 `REC-30`
4. `docs/03_product/UIUX_공통규칙.md`의 시간 설정·결과·코스 확인·진행 규칙
5. [2-U 출시용 1곳 실제 검증 전환](../recommendation-engine/release-one-stop-verified-course.md)
6. `src/ui/recommendation/v1Session.ts`, `src/ui/TimeSetupScreen.tsx`, `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`, `src/ui/VerifiedCourseProgressScreen.tsx`와 직접 사용하는 표시 model/component

과거 UIUX archive, 다장소 엔진 이력 전체, 데이터 감사 전체는 읽지 않는다.

## 3. 확정 구현 계약

### 3.1 런타임 builder 선택

1. `v1Session.ts`의 **출시 기본 builder**를 `buildReleaseOneStopRepresentativeCourseV1`로 바꾼다. route proxy/captcha/provider 조립 순서는 바꾸지 않고, 같은 `CourseV1LimitedInput`을 새 entry에 전달한다.
2. production/default 환경에서 기존 A8 `buildLimitedRepresentativeCourseV1` 호출은 0회여야 한다.
3. internal B12는 삭제하지 않는다. `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true`와 `EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12=true`가 모두 켜진 개발 진단 환경에서만 기존 B12 entry를 선택한다. 그 외 조합은 release one-stop을 선택한다.
4. UI 의존성 주입 seam에는 release builder를 명시적으로 주입할 수 있게 한다. A8/B12 테스트 seam을 보존해야 한다면 이름과 역할을 분명히 구분하고, A8을 production fallback으로 사용하지 않는다.
5. release 결과와 B12 결과가 타입상 다르면 `src/ui/` 안에 화면이 실제 사용하는 readonly 공통 결과 타입 또는 union을 둔다. 이를 해결하려고 `src/engine/types.ts`나 release result 타입을 수정하지 않는다.
6. 결과 화면에서 continuation을 호출하지 않는다. `continueRecommendationSession`과 기존 continuation 엔진 코드는 배포 후 보류 이력 및 다른 테스트를 위해 삭제하지 않아도 되지만, 출시 Results의 import/state/lock/CTA에서 연결을 끊는다.
7. 조건부 시장·거리 수동 계산은 기존 추천 input/receipt port를 같은 화면 메모리에서 재사용하므로, 이를 위해 사용하는 WeakMap을 제거하지 않는다. 이름을 바꾸는 경우에도 `requestConditionalManualCourse`가 계속 동작해야 한다.

### 3.2 결과의 1곳 표시 경계

1. release 화면은 대표 1개와 대안 최대 3개를 표시한다. 각 코스의 `placeIds.length`는 정확히 1이어야 한다.
2. 엔진 오류나 오래된 navigation snapshot으로 2·3곳 course가 유입되면 이를 1곳처럼 잘라 표시하거나 첫 장소만 재사용하지 않는다. release 표시 model에서 해당 course를 fail-closed로 제외하고, 대표까지 유효하지 않으면 기존의 안전한 빈 결과 상태를 보여 준다. 추가 route/API 호출로 자리를 채우지 않는다.
3. 대안은 대표와 같은 place ID, 서로 같은 place ID, 네 번째 이후 대안을 표시하지 않는다. 중복 제거는 표시 안전장치이며 엔진 결과를 재정렬하거나 새 추천으로 만들지 않는다.
4. 사용자 카피는 다음 의미를 사용한다.
   - 화면 제목: `시간의 추천`
   - 대표 카드: `대표 추천` 또는 동등한 한 장소 중심 문구. `· 1곳`처럼 당연한 개수를 반복하지 않는다.
   - 대안 영역: `이 시간에 가능한 다른 장소`
   - 대안 카드: `다른 추천 1`, `다른 추천 2`, `다른 추천 3`
   - `1~3곳`, `N곳 코스`, `다른 검증 코스 더 보기`, `다음 후보를 더 검증`을 출시 결과에 표시하지 않는다.
5. 대안이 0개면 빈 카드나 disabled 더보기를 만들지 않는다. 필요하다면 `이 조건에서 확인된 다른 장소는 없어요`처럼 사실만 짧게 알리되, API 오류나 후보 부족 원인을 추정하지 않는다.
6. `운영시간 확인 후 들러볼 곳`의 조건부 카드와 그 영역의 로컬 페이지 `더 보기`는 검증 코스 continuation과 다른 기능이므로 유지한다. 조건부 카드를 대표·검증 대안에 섞거나 자동 승격하지 않는다.
7. 기존 카카오맵 장소 확인, 주소/좌표 fallback, 조건부 실제 시각 `10:00 ≤ t < 18:00`, 18:00/foreground 숨김, 조건부 수동 route 계산은 바꾸지 않는다.

### 3.3 체류 분 비노출

1. `stayMin`, stop의 arrival/departure 시각, `stayState`는 engine snapshot과 UI 순서 model에 그대로 보존한다. 표시를 숨긴다는 이유로 0으로 만들거나 route·남는 시간을 재계산하지 않는다.
2. Results, `CourseV1Journey`, `CourseV1PlacePreview`, CourseConfirm, VerifiedCourseProgress의 사용자 텍스트와 accessibility label에서 다음 표현을 제거한다.
   - `활동 30분`, `체류 20분`, `30분 머물기`, `남은 체류 N분`
   - stop의 `16:00–16:30`, `16:30 출발 예정`처럼 체류시간을 직접 계산하게 하는 시각 쌍
   - `짧게 가능` 사용자 문구
3. `stayState=short`에는 숫자 없이 `가볍게 둘러보기`를 표시한다. recommended에는 별도 체류 상태 문구를 강제로 붙이지 않아도 된다. 장소/활동 문맥은 유지한다.
4. 시간 막대의 stop 구간은 내부 `stayMin` 비율을 사용해 유지할 수 있지만, 구간 텍스트와 접근성에는 분을 말하지 않는다. 예: recommended는 `장소 둘러보기`, short는 `가볍게 둘러보기`.
5. 실제 이동시간(`도보 30분`, `대중교통 20분`), 도착 전 여유, 전체 예상 일정, 남는 시간은 그대로 표시한다. 테스트에서 단순히 모든 `30분` 문자열을 금지해 이동시간까지 숨기지 않는다.
6. 진행 화면의 stay 단계는 숫자 countdown을 약속하지 않는다. `장소를 둘러본 뒤 다음 길찾기를 이용하세요`와 같은 행동 안내를 사용한다. 다음 travel이 최종 구간이면 CTA를 도착지 존재 여부에 따라 `도착지 길찾기` 또는 `복귀 길찾기`로 표시할 수 있다. 기존 app→HTTPS→browser 길찾기, 성공 후에만 단계 전이, 중복 탭 lock은 유지한다.
7. legacy `ExecutionScreen`, 기존 저장 코스 목록, DB payload의 체류값은 이번 작업에서 전면 개편하지 않는다. 다만 새 V1 release 흐름이 실제로 사용하는 공통 component에 숫자가 남아 있으면 제거 대상이다.

### 3.4 120분 입력 경계

1. TimeSetup의 최대값, preset clamp, 개발 테스트 시각의 추천 종료값, validation/error 문구를 120분으로 통일한다.
2. 정확히 120분은 허용하고 121분은 추천 엔진·captcha·route proxy를 호출하기 전에 차단한다. 0분 이하도 기존처럼 차단한다.
3. 개발 테스트 시각을 사용해도 최대 120분은 동일하다. 실제 기기 시각을 사용하는 조건부 시장 노출 기준은 변경하지 않는다.
4. 가능하면 시간 범위 판정을 순수 UI model로 분리해 120/121/0 경계를 React·GPS·네트워크 없이 검증한다. 시간대 자정 처리 등 기존 계약 밖의 대규모 재설계는 하지 않는다.

### 3.5 빈 결과·오류·관찰 가능성

1. `no_representative_candidates`와 `no_verified_course_within_limit`의 기존 사실 기반 빈 결과를 유지한다. 날씨·영업 종료·근처 장소 부족을 근거 없이 추정하지 않는다.
2. route proxy, CAPTCHA, anonymous auth 실패 표현과 재시도 동작을 변경하지 않는다.
3. production 사용자 화면에는 diagnostics를 표시하지 않는다. internal diagnostics가 켜진 경우 release 정책은 `출시 1곳`처럼 A8과 구분되는 라벨을 사용하고, B12 exact 진단은 기존 label과 shape 값을 유지한다.
4. 이 작업은 실제 API 호출 수, cache TTL, Supabase Edge/DB, candidate catalog 수를 바꾸지 않는다.

## 4. 필수 fixture와 검증

### 4.1 런타임 조립 fixture

- diagnostics=false/internalB12=false → release builder 1회, A8 0회, B12 0회.
- diagnostics=true/internalB12=false → release builder 1회, B12 0회.
- diagnostics=false/internalB12=true → release builder 1회. 진단 없이 B12를 열지 않는다.
- diagnostics=true/internalB12=true → B12 1회, release 0회.
- release 실행은 기존 route proxy port와 captcha token을 한 번만 조립하고 navigation payload에 port/token/function을 넣지 않는다.
- release 결과를 받았을 때 continuation 호출은 0회다. 조건부 수동 계산 input 보존은 계속 동작한다.

### 4.2 결과 표시 fixture

- 대표 single + 대안 single 3개는 네 개의 서로 다른 place ID로 표시된다.
- 대안 0/1/2/3개를 있는 그대로 표시하며 4개째·대표 중복·대안 중복은 fail-closed로 제외한다.
- 대표 또는 대안에 `placeIds.length=2/3`인 손상/과거 snapshot이 들어오면 한 장소로 자르지 않고 제외한다. 이 과정에서 route/API 호출은 0회다.
- release 결과에는 검증 continuation 더보기 CTA가 없다. 조건부 영역의 `더 보기`는 그대로 남는다.
- 대표 없음은 크래시하지 않고 기존 구조화 빈 결과를 표시한다.

### 4.3 체류·시간 표시 fixture

- recommended stop 30분: 장소 카드·journey·CourseConfirm·progress 텍스트와 accessibility에 `체류 30분`, `활동 30분`, `30분 머물기`, stop arrival–departure 쌍이 없다.
- short stop 20분: 숫자는 없고 `가볍게 둘러보기`가 한 번의 의미로 전달된다.
- 이동 leg가 30분인 fixture에서는 `도보 30분` 또는 `대중교통 30분`이 계속 표시된다. 체류 숫자 제거를 전체 문자열 금지로 검사하지 않는다.
- 남는 시간과 도착 전 여유는 engine snapshot 값 그대로다. UI가 stay를 숨기며 total/remaining을 재계산하지 않는다.
- 진행 stay 단계에서 최종 이동 CTA는 왕복이면 `복귀 길찾기`, 별도 destination이면 `도착지 길찾기`이며 외부 길찾기 실패 시 stay 단계·재시도 상태를 유지한다.

### 4.4 시간 입력 fixture

- 120분: 실행 가능.
- 121분: release builder, auth/CAPTCHA, route port 호출 0회로 차단.
- 0분 이하: 기존 오류 유지.
- preset 180 또는 개발 테스트 종료 제안: 화면 상태에서 120분 이하로 clamp.

## 5. 수정 경계

### 수정 가능

- `src/ui/`
- UI 단위·계약 테스트(`test/ui/` 및 UI runtime 경계 fixture)
- 이 작업 문서의 완료 인수인계

### 수정 금지

- `src/engine/`, 엔진 순수 테스트와 2-U 공개 계약
- `src/services/`, Supabase Edge/migration/DB, API cache·한도
- `src/data/`, `data/`, 카탈로그 후보·운영시간·체류 원천
- `.env*`, 실제 키·토큰, native project 설정
- `docs/03_product/*`, `docs/테스트.md`, `docs/작업조정_보드.md`

`App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`는 단일 작성자 경계다. 이 작업에 실제로 필요한 `nav.ts` 외에는 수정하지 않으며, 같은 시간에 다른 UIUX 세션을 실행하지 않는다.

## 6. 실행 명령과 합격값

아래를 실제로 실행하고 결과를 기록한다.

```bash
npx tsx --test test/ui/recommendation-runtime-boundary.test.ts test/ui/time-setup-clock.test.ts test/ui/course-v1-dwell-state.test.ts test/ui/course-v1-journey.test.ts test/ui/verified-course-results.test.ts test/ui/verified-course-progress.test.ts
npx tsx --test test/release-one-stop-verified-course.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

합격 기준:

- 새·수정 대상 fixture 실패 0.
- 전체 UI와 전체 테스트 실패 0. 기존 명시 skip은 새 실패로 세지 않되 개수를 기록한다.
- 테스트 중 실제 Kakao/TMAP/ODsay/TourAPI/Supabase/GPS 호출 0회.
- production/default release builder 1회, A8/B12/continuation 0회.
- release 표시 결과의 모든 course `placeIds.length === 1`, 대안 최대 3개.
- 체류 분 비노출과 이동시간 유지가 의미별 assertion으로 증명됨.

## 7. 중단·인계 기준

- 2-U 보완 중 release 함수명·입출력 계약을 바꿔야 한다는 요구가 생기면 UI에서 임의 대응하지 않고 현재 결과와 필요한 계약만 기록해 통합·결정에 인계한다.
- 조건부 수동 계산을 유지하려면 API/engine 변경이 필요하다는 결론이 나오면 해당 역할 파일을 수정하지 않는다.
- 기존 navigation에 저장된 다장소 snapshot migration까지 필요해지면 이번 출시 메모리 흐름과 분리해 위험으로 남긴다. 임의 데이터 마이그레이션을 만들지 않는다.

완료 기록은 다음 네 항목을 이 문서 아래에 남긴다.

1. 변경 파일과 사용자에게 달라진 결과
2. 유지한 엔진/API/조건부/카카오맵/B12 계약
3. 실행한 테스트·통과 수·실제 외부 호출 0회 여부
4. 새 internal build에서 QA가 확인할 항목과 남은 위험

## 8. 완료 인계 (2026-09-02)

### 1. 변경 파일과 변경 목적

- `src/ui/TimeSetupScreen.tsx`, `src/ui/timeSetup/testClock.ts`, `src/ui/timeSetup/releaseTimeBoundary.ts`: 출시 시간 입력·preset·개발 종료 제안을 120분으로 통일하고 120/121/0 경계를 엔진·인증·CAPTCHA 진입 전에 판정했다.
- `src/ui/recommendation/v1Session.ts`, `src/ui/recommendation/recommendationInternalBuildModel.ts`, `src/ui/recommendation/releaseOneStopResultsModel.ts`, `src/ui/recommendation/recommendationInternalDiagnosticsModel.ts`, `src/ui/nav.ts`: exact diagnostics+B12만 B12를 선택하고 나머지는 release one-stop만 선택하도록 고정했다. release/B12 navigation union과 single 대표·서로 다른 대안 최대 3개의 fail-closed 표시 경계를 추가했다.
- `src/ui/ResultsScreen.tsx`: 검증 continuation 연결과 다장소/개수 카피를 제거하고 `대표 추천`, `이 시간에 가능한 다른 장소`, `다른 추천 1~3`으로 교체했다. 대표 손상 시 대안을 승격하지 않고 구조화 빈 결과를 사용한다.
- `src/ui/recommendation/CourseV1Journey.tsx`, `src/ui/recommendation/CourseV1PlacePreview.tsx`, `src/ui/recommendation/courseV1DwellStateModel.ts`, `src/ui/CourseConfirmScreen.tsx`, `src/ui/VerifiedCourseProgressScreen.tsx`, `src/ui/recommendation/verifiedCourseProgressModel.ts`: snapshot의 체류값·순서·막대 비율은 보존하면서 V1 사용자 텍스트와 접근성에서 체류 분·stop 시각 쌍을 제거했다. short는 `가볍게 둘러보기`, 최종 stay CTA는 destination 유무에 따라 `도착지 길찾기`/`복귀 길찾기`로 표시한다.
- `test/ui/recommendation-runtime-boundary.test.ts`, `test/ui/time-setup-clock.test.ts`, `test/ui/course-v1-dwell-state.test.ts`, `test/ui/verified-course-results.test.ts`, `test/ui/verified-course-progress.test.ts`, `test/map-transport-ui-contract.test.mjs`: 필수 환경 조합, 120분 경계, single/dedup/fail-closed, 체류 분 비노출·이동시간 유지, 최종 길찾기 라벨과 기존 성공 전이/실패 유지/중복 lock을 회귀로 고정했다.

### 2. 유지한 공개 계약·정책 경계

- `src/engine/`, 엔진 테스트, `src/services/`, 데이터·DB·native·환경 설정, 제품 기준 문서와 작업조정 보드는 수정하지 않았다. 병렬 `2-U`가 제공한 `buildReleaseOneStopRepresentativeCourseV1` 공개 입출력을 그대로 소비했다.
- production/default에서 A8 fallback을 만들지 않았고 exact `diagnostics=true && internalB12=true`의 B12 entry·내부 shape 진단은 유지했다. diagnostics panel은 원본 engine result를 사용하므로 표시 sanitizer와 무관하게 B12 관찰값을 보존한다.
- route proxy/CAPTCHA/provider 조립 순서, navigation의 비직렬화 port/token/function 비포함, 조건부 시장의 실제 시각 gate·로컬 `더 보기`·WeakMap receipt 재사용, 카카오맵 place/route app→HTTPS→browser fallback을 유지했다.
- 체류 `stayMin`·arrival/departure·`stayState`, 전체 소요·남는 시간·도착 전 여유와 이동시간은 snapshot/model 안에서 변경하거나 재계산하지 않았다.

### 3. 테스트 결과

- 필수 UI fixture 묶음: 35개 중 34 통과, 기존 철회 이력 1 skip, 실패 0.
- 병렬 `2-U` 공개 계약 테스트 `test/release-one-stop-verified-course.test.ts`: 5/5 통과.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 172개 중 171 통과, 기존 철회 이력 1 skip, 실패 0.
- `npm test`: 113/113 통과, skip 0.
- 추가 UI 정적 계약 `test/map-transport-ui-contract.test.mjs`: 14/14 통과.
- `git diff --check`: 통과.
- 모든 검증은 고정 fixture/정적 계약으로 실행했으며 실제 Kakao/TMAP/ODsay/TourAPI/Supabase/GPS 호출은 0회다. 네 필수 flag 조합과 public 값 누락 기본값을 함께 검증해 release 4회, A8 0회, B12 1회(exact 조합만), 기존 route port 조립은 세션당 1회였다.

### 4. 다음 결정·위험·QA 재현 조건

- 새 internal build에서 기본/diagnostics-only/internalB12-only 세 조합이 모두 `내부 정책: 출시 1곳`과 single 결과를 보이고, exact 두 flag 조합만 `내부 정책: B12` 및 기존 shape 진단을 유지하는지 확인한다.
- iOS 실기기에서 120분 실행, 121분 사전 차단, 대표+대안 0~3개, short 읽기/VoiceOver, 최종 `도착지 길찾기`와 `복귀 길찾기`, 외부 길찾기 실패 후 stay 단계 유지, 조건부 시장의 18:00 숨김을 수동 확인해야 한다. 이번 세션은 외부 API와 실기기를 호출하지 않았다.
- 이전 navigation 메모리에 남은 다장소 snapshot은 자르거나 migration하지 않고 안전한 빈 결과로 닫힌다. 재현되면 새 release 계산으로 다시 진입시키는 제품 안내 여부를 통합·결정 세션에서 판단한다.

## 9. 통합 수락 (2026-09-02)

- production/default와 diagnostics-only/internalB12-only는 release one-stop을 사용하고, exact `diagnostics=true && internalB12=true`만 B12를 사용하는 것을 실제 source와 공개 entry fixture로 재확인했다.
- release 표시 model이 single 대표와 서로 다른 single 대안 최대 3개만 보존하고, 다장소 대표를 자르거나 대안을 대표로 승격하지 않는 것을 확인했다.
- Results에서 검증 continuation 연결·CTA가 제거됐고, V1 Results/CourseConfirm/Progress의 사용자 텍스트·접근성에서 체류 분은 숨기되 실제 이동시간·도착 여유·남는 시간과 내부 snapshot은 유지됨을 확인했다.
- 독립 실행 결과: 핵심 UI·엔진 묶음 40개 중 39 통과·기존 철회 1 skip, `npm run test:typecheck` 통과, `npm run test:ui` 통과, `npm test` 113/113 통과, `git diff --check` 통과.
- 실제 Route Proxy와 화면 체감은 [QA-RELEASE-ONESTOP-01](../qa-release/release-one-stop-simulator-validation.md)이 Simulator에서 직접 검증한다. UIUX 세션의 추가 보완은 현재 없다.
