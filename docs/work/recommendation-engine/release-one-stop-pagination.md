# 2-V — 출시 1곳 추천 요청형 이어보기

## 상태

통합 수락. `DEC-ONE-STOP-MORE-01`의 single 전용 continuation/page entry와 고정 fixture를 구현했고, 2026-09-02 통합 세션이 관련 엔진 테스트 63/63·typecheck·diff check를 독립 재확인했다. 다음 작업은 `U-ONE-MORE-01`이다.

## 목적과 사용자 관찰

출시 one-stop 결과는 현재 대표와 대안을 합쳐 입력별 0~3개가 주로 보인다. 대표 카탈로그는 191개이고 one-stop 공간 후보는 최대 18개지만, 첫 8회 안에서 확인된 결과만 반환하고 나머지 후보를 이어서 검증할 entry가 없다. 첫 결과는 빠르게 유지하되 사용자가 `다른 장소 더 보기`를 요청하면 남은 후보만 실제 경로로 검증할 수 있게 한다.

성공하면 첫 결과의 대표와 기존 대안은 그대로 남고, 한 번의 명시 행동 뒤 서로 다른 검증 장소가 최대 3개까지 아래에 추가된다.

## 확정 원인과 재사용 경계

- `buildReleaseOneStopRepresentativeCourseV1`는 single 후보 풀 최대 18개를 만들지만 검증 성공 4개 또는 신규 provider attempt 8회에서 종료한다.
- release 결과에는 continuation이 없어 남은 cursor·검증/탈락 상태를 UI가 이어 받을 수 없다.
- `releaseOneStopDisplayResult`의 첫 대안 최대 3개는 최초 화면 계약이다. 페이지 결과까지 다시 3개로 자르는 총량 상한으로 사용하면 안 된다.
- 기존 `2-Q`에는 안전한 재수화와 페이지 예산 구현이 있으나 multi-stop queue를 포함한다. 검증된 budget·signature·종료 상태 primitive는 추출·재사용할 수 있지만 release entry가 2·3곳 queue를 생성하거나 `continueLimitedRepresentativeCourseV1`를 호출해서는 안 된다.
- 외부 API의 `API-PAGE-01`은 페이지당 신규 attempt 최대 8회, cache/in-flight reuse 0회, typed unavailable과 로컬 예산 소진 분리를 이미 고정했다. production adapter를 임의 수정하지 않는다.

## 구현 명령

1. `src/engine/`에 release one-stop 전용 continuation 타입과 공개 이어보기 entry를 추가한다. 이름은 `continueReleaseOneStopRepresentativeCourseV1`처럼 multi-stop entry와 구분한다. 기존 `buildReleaseOneStopRepresentativeCourseV1` 결과에는 다음 single 후보가 있을 때만 이 continuation을 선택 필드로 포함한다.
2. continuation은 최소한 version, single 후보 ID 집합과 opaque signature, cursor, 이미 검증·탈락한 single ID/signature, 필요한 opaque receipt key, typed 종료 상태만 직렬화한다. 좌표, 사용자 ID, 입력 시각 원문, provider/route 객체, 함수, API key를 넣지 않는다.
3. 이어보기 호출은 최초와 같은 `CourseV1LimitedInput`과 continuation을 함께 받는다. 현재 provider가 만든 release single 후보 ID 집합과 signature가 일치할 때만 다음 후보를 재수화한다. 누락·순서/집합 변경·version 불일치는 receipt 호출 0회인 `continuation_unavailable`로 끝낸다.
4. 첫 계산의 계약은 유지한다: 신규 provider attempt 최대 8회, 대표 포함 검증 최대 4개, 자동 16회 보충 없음. 단, 검증 루프가 끝났을 때 미검증 후보가 남으면 `more_available` continuation을 반환한다.
5. 페이지 한 번은 cursor 뒤의 single 후보만 순회해 신규 provider attempt 최대 8회, 새 검증 one-stop 최대 3개에서 멈춘다. 반환 코스는 모두 `placeIds.length === 1`, `legs.length === 2`이고 실제 경로·구조화 운영시간·최소 20분·도착 여유를 통과해야 한다.
6. initial/page를 합쳐 같은 place ID를 두 번 검증 결과로 반환하지 않는다. 이미 실제 조건으로 탈락한 후보도 다시 요청하지 않는다. 첫 대표·기존 결과의 순위는 페이지에서 다시 계산하거나 교체하지 않는다.
7. 로컬 페이지 예산 소진과 실제 provider 종료를 구분한다. 페이지 예산 때문에 후보의 두 leg 검증이 끝나지 않았다면 이를 영구 `rejected`로 기록하지 말고 다음 페이지에서 같은 후보부터 안전하게 재개한다. 이미 얻은 leg는 adapter cache/session reuse를 사용하며 신규 attempt로 세지 않는다. 실제 typed provider unavailable/limit만 terminal 상태로 만든다.
8. 후보가 남으면 `more_available`, 전부 검사했으면 `exhausted`, 실제 provider 종료면 `provider_unavailable`, 재수화 실패면 `continuation_unavailable`을 반환한다. 로컬 8회 도달을 provider 장애로 표시하지 않는다.
9. 기존 multi-stop `buildLimitedRepresentativeCourseV1`, `continueLimitedRepresentativeCourseV1`, A8/B12/test-only entry와 타입·정렬·fixture를 삭제하거나 release용으로 바꾸지 않는다. candidate-to-candidate receipt는 release initial/page 모두 0회다.
10. barrel export와 공개 타입을 갱신하되, UI 파일·서비스 adapter·카탈로그·환경값은 수정하지 않는다.

## 실패 우선 fixture

구현 전에 현재 release entry로는 통과할 수 없는 아래 테스트를 추가한다.

1. 후보 10개, 모든 두 leg exact: 첫 결과는 최대 4개이고 continuation이 있으며 첫 attempt ≤8이다. 첫 페이지는 기존과 겹치지 않는 최대 3개를 추가하고 페이지 attempt ≤8이다.
2. 첫 결과가 총 3개로 끝났지만 큐가 남음: 상태는 `more_available`이며 페이지에서 새 장소가 추가된다.
3. 첫 결과에서 검증된 ID, 실제 조건 탈락 ID는 페이지에서 adapter 호출·결과 중복이 0이다.
4. cache/session reuse receipt는 `newProviderAttemptCount: 0`이며 페이지 8회에 포함되지 않는다.
5. 페이지 예산이 후보 두 leg 사이에서 끝남: 후보를 영구 탈락시키지 않고 다음 호출에서 재개하며 이미 성공한 leg를 신규 호출로 세지 않는다.
6. 후보 signature/version/provider 후보 불일치: page course 0, adapter call 0, `continuation_unavailable`이다.
7. 로컬 8회+큐 잔여는 `more_available`, 실제 typed unavailable은 `provider_unavailable`, 큐 소진은 `exhausted`다.
8. initial과 여러 페이지 전체에서 candidate-to-candidate receipt 0, 2·3곳 결과 0, 조건부 후보 0이다.
9. 기존 `test/release-one-stop-verified-course.test.ts`, multi-stop pagination, A8/B12 회귀가 그대로 통과한다.

## 수정 경계

- 수정 가능: `src/engine/`, 순수 엔진 테스트, 이 작업 문서.
- 수정 금지: `src/ui/`, `src/services/`, Edge/Supabase, `src/data/`, `data/`, `.env*`, 기준 정책 문서, 작업 보드.
- 실제 Kakao·GPS·DB 호출은 0회다.

## 완료 기준과 인수인계

- 최소 실행: `npx tsx --test test/release-one-stop-verified-course.test.ts test/course-v1-pagination.test.ts`, `npm run test:typecheck`, `npm test`, `git diff --check`.
- 합격값: initial/page 각각 신규 attempt ≤8, 페이지당 새 course ≤3, 전체 중복 0, release multi-stop 0, signature 실패 route 0, 모든 기존 테스트 통과.
- 완료 기록에는 변경 파일, 유지한 multi-stop/API/data/UI 경계, 테스트 건수, UIUX가 호출할 정확한 entry·타입·page state를 남긴다.

---

## 2026-09-02 — 2-V 완료 인계

### 변경 파일과 변경 목적

- `src/engine/courseV1.ts`: `CourseV1ReleaseOneStopContinuation`, 입력·결과·page state 타입과 공개 `continueReleaseOneStopRepresentativeCourseV1` entry를 추가했다. 기존 release initial도 같은 single page 검증 경계를 사용하며 미검증 후보가 남을 때만 continuation을 반환한다.
- `src/engine/index.ts`: 새 release continuation entry와 공개 타입을 barrel에서 export했다.
- `test/release-one-stop-pagination.test.ts`: initial/page 8회 상한, 페이지 최대 3개, 첫 결과 3개+큐 잔여, 중복·기탈락 재검증 0, cache reuse, 부분 leg 재개, signature/version/provider 불일치 route 0, 네 page state를 고정했다.
- `test/release-one-stop-verified-course.test.ts`: 2-V 현행에 맞춰 18개 이상 후보에서 다장소 진단 없이 single continuation만 생성하는 계약으로 갱신했다.
- `docs/work/recommendation-engine/release-one-stop-pagination.md`: 구현 결과와 역할 간 인계를 기존 2-V 문서에 기록했다.

### 유지한 계약

- release initial은 신규 provider attempt 최대 8회, 대표 포함 최대 4개이며 자동 16회 보충을 하지 않는다. page는 cursor 뒤 single만 최대 8회 검증해 새 코스 최대 3개를 반환한다.
- continuation은 `version`, single 후보 ID·opaque signature, cursor, attempted/rejected/verified ID와 opaque receipt key만 직렬화한다. 좌표·시각 원문·사용자 ID·provider/route 객체·함수·API key는 포함하지 않는다.
- 페이지 중 두 leg 사이에서 로컬 예산이 끝나면 cursor와 rejected 상태를 전진시키지 않는다. 다음 호출에서 같은 후보를 다시 시작하고 adapter cache/session의 `newProviderAttemptCount: 0` receipt를 재사용한다.
- 기존 multi-stop `buildLimitedRepresentativeCourseV1`, `continueLimitedRepresentativeCourseV1`, A8/B12/test-only 타입·정렬·상한·fixture는 수정하지 않았다. release initial/page의 candidate-to-candidate receipt와 2·3곳 결과는 0이다.
- UI, 서비스/API adapter, Edge/Supabase, 데이터·카탈로그, 환경값, 제품 기준 문서와 `docs/작업조정_보드.md`는 수정하지 않았다. 실제 Kakao·GPS·DB 호출은 0회다.

### 테스트 결과

- 구현 전 `npx tsx --test test/release-one-stop-pagination.test.ts`: 새 entry·continuation 부재로 0/6 통과하여 실패 우선 재현을 확인했다.
- `npx tsx --test test/release-one-stop-pagination.test.ts test/release-one-stop-verified-course.test.ts test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`: 63/63 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 113/113 통과.
- `npm run test:ui`: 183 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.
- 병렬 재검증 중 `tsx` 임시 IPC socket이 sandbox `EPERM`으로 한 번 시작되지 않았으나, 같은 지정 명령을 단독 재실행해 63/63 통과를 확인했다.

### 다음 결정·남은 위험

- UIUX의 다음 entry는 `continueReleaseOneStopRepresentativeCourseV1({ ...originalInput, continuation })`이다. 결과의 `appendedCourses`만 기존 대표·대안 뒤에 누적하고 `pageState`의 `more_available | exhausted | provider_unavailable | continuation_unavailable`로 CTA/종료 문구를 결정해야 한다.
- initial의 `CourseV1ReleaseOneStopResult.continuation`은 미검증 single 후보가 있을 때만 존재한다. page continuation의 cursor·ID 상태를 UI가 해석하거나 수정하지 말고 다음 호출에 그대로 전달해야 한다.
- 실제 adapter의 페이지 간 cache/in-flight 재사용과 사용자 중복 tap 방지는 각각 외부 API·UIUX 역할의 범위다. U-ONE-MORE-01 연결 후 QA-ONE-MORE-01이 밀집 fixture와 실기기 제한 시나리오로 확인해야 한다.

---

## 2026-09-02 — 통합 수락

- 독립 실행 `npx tsx --test test/release-one-stop-pagination.test.ts test/release-one-stop-verified-course.test.ts test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`는 63/63 통과했다.
- `npm run test:typecheck`와 `git diff --check`도 통과했다.
- initial/page 각각 신규 attempt 최대 8회, page당 새 one-stop 최대 3개, 중복·기탈락 재검증 0, partial leg 재개, signature 불일치 route 0, release 다장소 0을 수락한다.
- initial에 검증 코스가 0개여도 continuation이 `more_available`이면 다음 후보를 확인할 수 있는 엔진 계약은 유지된다. 이 상태의 버튼·빈 상태 표현은 `U-ONE-MORE-01`, 실제 회귀는 `QA-ONE-MORE-01`에서 고정한다.
- `src/engine/courseV1.ts`의 2-U 설명 중 `continuation 없이`라는 과거 문구 한 곳은 현재 공개 계약을 설명하지 못하는 비기능 주석 부채다. 동작·타입·테스트 수락을 막지는 않으며, 다음 추천 엔진 파일 수정 때 현행 one-stop continuation 설명으로 정리한다.
