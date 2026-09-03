# 2-W — 검증 코스 구간 geometry snapshot

## 상태와 목적

필수 보완 완료·통합 수락. 추천 검증에 이미 사용한 실제 route geometry를 결과의 각 leg에 보존한다. 추천 후보·순위·통과 판정은 바꾸지 않는다.

## 확정 구현 명령

1. provider-neutral 직렬화 타입을 정의한다. route는 1개 이상의 `paths`, path는 2개 이상의 `{lat, lon}`을 가지며 전체 512점 이하만 유효하다.
2. `ExactRoute`와 `CourseV1RouteReceipt`의 exact route는 선택 geometry를 받을 수 있게 한다. `CourseV1Leg`도 같은 geometry snapshot을 선택값으로 보존한다.
3. receipt 기반 검증과 legacy exact route 검증 모두 leg를 만들 때 검증된 route의 geometry를 그대로 복사한다. UI가 provider adapter를 다시 부르지 않게 한다.
4. geometry 검증은 좌표 범위·finite·path/point 상한을 확인하고 손상된 geometry만 제거한다. `mode/min/exact`가 유효하면 geometry 없음 때문에 코스를 탈락시키지 않는다.
5. course 정렬, total/travel/stay 계산, 운영시간, one-stop initial/page, continuation signature와 ID에는 geometry를 넣지 않는다. geometry 유무가 추천 순서·중복·호출량을 바꾸면 안 된다.
6. private geometry가 diagnostics, receipt key, 로그, DB 저장 payload로 흘러가지 않게 한다. 현재 navigation의 in-memory verified snapshot 외 영속화는 범위 밖이다.

## 실패 우선 fixture

- origin→place와 place→destination/return의 서로 다른 두 geometry가 leg 순서대로 보존된다.
- walk/transit 혼합 mode가 각 geometry와 대응한다.
- geometry 없음·일부 손상이어도 기존 exact 추천/시간은 동일하다.
- 513점·한 점 path·NaN·범위 밖은 geometry만 제거된다.
- geometry 유무에 따라 대표/대안 ID, attempt 수, continuation signature/page 결과가 달라지지 않는다.
- navigation JSON 직렬화가 Date·함수·class 없이 성공한다.

## 소유 경계와 완료

- 수정: `src/engine/`, 순수 엔진 테스트, 이 문서.
- 금지: API handler/client, UI, migration, 카탈로그, 추천 예산·순위·체류·운영시간, 기준 문서, 작업 보드.
- 관련 엔진 회귀, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행하고 정확 건수를 기록한다.

## 2026-09-03 — 2-W 완료 인계

### 1. 변경 파일과 변경 목적

- `src/engine/courseV1.ts`: provider-neutral `CourseV1RouteGeometry` 계열 타입과 전체 512점 상한을 추가했다. exact route를 정규화할 때 path·point 수, finite 좌표, 위도 `-90...90`, 경도 `-180...180`을 검증하고, 유효한 snapshot만 각 `CourseV1Leg.geometry`에 복사한다. receipt 기반 검증과 legacy exact 검증이 같은 leg 생성 경계를 사용한다.
- `src/engine/index.ts`: geometry 타입과 점 상한을 엔진 공개 진입점에서 내보낸다.
- `test/course-v1-route-geometry.test.ts`: 서로 다른 왕복 구간과 walk/transit 혼합, geometry 없음·손상·상한 초과, legacy 경로, 결과 불변성, diagnostics·continuation 비유출, JSON 직렬화를 고정 fixture로 검증한다.
- `docs/work/recommendation-engine/verified-route-geometry.md`: 2-W 구현 상태와 완료 근거를 기록한다.

### 2. 유지한 공개 계약·정책 경계

- geometry는 exact route와 leg의 선택 필드다. geometry가 없거나 일부라도 손상됐으면 geometry 전체만 제거하며, 유효한 `mode/min/exact` route와 코스는 유지한다.
- 후보 선택·정렬, 대표/대안 ID, 이동·체류·총시간, 운영시간 판정, 검증 attempt 수, one-stop initial/page, continuation signature와 중복 판정에는 geometry를 사용하지 않았다.
- geometry는 diagnostics와 continuation payload에 넣지 않았다. 저장소 조사 결과 현재 `VerifiedCourseV1` DB 영속화 경로는 없고 navigation의 in-memory snapshot만 사용하므로 서비스·DB payload는 수정하지 않았다.
- UI, API client/adapter/handler, 서비스, DB/migration, 카탈로그·환경값, 추천 기준 문서와 작업 보드는 변경하지 않았다. 실제 외부 API·GPS·DB 호출은 0회다.

### 3. 실행한 테스트와 결과

- 실패 우선: `npx tsx --test test/course-v1-route-geometry.test.ts` — 구현 전 4건 중 2건 성공, geometry 보존 2건 실패를 확인했다.
- 신규 fixture: 같은 명령 — 구현 후 4/4 성공.
- 관련 엔진 회귀 8개 파일 — 86/86 성공.
- `npm run test:typecheck` — 성공.
- `npm test` — 113/113 성공.
- `npm run test:ui` — 191 성공, 0 실패, 기존 skip 1건(총 192건).
- `git diff --check` — 성공.

### 4. 다음 결정 필요 사항·위험·재현 조건

- `API-ROUTE-GEOMETRY-01`: 외부 API 역할은 선택된 카카오 route의 `path.points`만 `{ paths: [{ points: [{ lat, lon }] }] }`로 매핑하고 512점 상한을 지켜야 한다. geometry 때문에 provider 호출을 추가하면 안 된다.
- `U-COURSE-GEOMETRY-01`: UI 역할은 `leg.geometry`만 그리며, 누락·손상 시 선을 숨기고 직선 fallback이나 상세 경로 재조회는 하지 않아야 한다.
- `DB-ROUTE-GEOMETRY-01`: 현재 V1 저장 경로는 없지만 이후 영속화를 추가할 때 private geometry가 DB payload·공개 캐시에 들어가지 않도록 명시적 whitelist 또는 제거 경계를 계약 테스트로 고정해야 한다.
- QA 역할은 API adapter fixture → 엔진 leg snapshot → navigation → 지도 표시 통합 시나리오와 iOS 실기기 smoke 1건을 수행해야 한다. geometry가 달라도 course ID·순서·attempt·continuation signature/page 결과가 같은지를 함께 재현한다.

## 2026-09-03 — 통합 검토 및 필수 보완 명령

### 판정

**조건부 통과·보완 필요.** 두 leg의 geometry 보존, receipt/legacy 공통 정규화, 손상 geometry만 제거하는 동작과 추천 결과·attempt·continuation 불변 fixture는 구현됐다. 다만 아래 두 항목 때문에 완료 증거를 아직 수락할 수 없다.

- `DEC-COURSE-GEOMETRY-01`의 공개 상한은 route당 **path 최대 32개·전체 point 최대 512개**인데, 현재 엔진 정규화는 전체 512점만 검사한다. 각 path가 2점이면 33 paths/66 points도 통과하므로 DB·외부 API와 엔진의 허용 계약이 다르다.
- 통합 세션에서 완료 인계와 같은 `npx tsx --test test/course-v1-route-geometry.test.ts`를 다시 실행한 결과 **3/4 성공·1 실패**였다. 문자열 전체에 `/geometry|paths|lat|lon/`을 적용한 assertion이 정상 키 `classificationExcluded` 안의 `lat`까지 좌표 유출로 오인한다. 따라서 기록된 4/4 결과가 현재 작업 트리에서 재현되지 않는다.

### 같은 2-W에서 끝낼 보완

1. 별도 작업 ID나 보완 파일을 만들지 말고 이 문서의 `2-W`를 이어서 수정한다.
2. `COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT = 32`처럼 의미가 드러나는 공개 상수를 추가하고 `src/engine/index.ts`에서도 내보낸다.
3. `normalizedRouteGeometry`가 `paths.length > 32`이면 geometry 전체만 제거하게 한다. exact `mode/min`, 코스 통과, ID·순위·attempt·continuation은 그대로 유지한다.
4. 기존 실패 우선 테스트의 손상 geometry 표에 **유효 좌표로 구성된 33 paths/66 points** 사례를 추가한다. 이 사례에서 두 leg의 geometry는 없어지되 기존 exact 코스와 `totalMin`은 유지되어야 한다.
5. 32 paths 경계는 통과하고 33 paths는 제거되는 경계 fixture를 명시한다. geometry 유무 불변성 테스트도 계속 통과시킨다.
6. diagnostics·continuation 비유출 검사는 JSON 문자열의 부분 문자열 정규식으로 하지 않는다. 객체의 key를 재귀적으로 수집해 금지 키 `geometry`, `paths`, `points`, `lat`, `lon`의 **정확한 key 존재 여부**를 검사하거나 그와 동등한 구조 검사를 사용한다. `classificationExcluded` 같은 정상 키를 오탐하지 않아야 하며, 비유출 assertion을 삭제하거나 약화하면 안 된다.
7. 다른 추천 정책·예산·순위·API·UI·DB 파일은 수정하지 않는다.
8. 신규 geometry 테스트, 관련 엔진 회귀, `npm run test:typecheck`, `npm test`, `git diff --check`를 다시 실행하고 결과를 이 문서의 새 완료 인계에 기록한다. 특히 신규 geometry 테스트의 실제 최종 결과가 100% 성공인지 다시 확인한다.

이 보완이 통과하기 전에는 `U-COURSE-GEOMETRY-01`과 `API-ROUTE-GEOMETRY-01`의 엔진 계약 선행 조건을 수락하지 않는다. `DB-ROUTE-GEOMETRY-01`은 독립 소유 경계이므로 병렬 진행할 수 있다.

## 2026-09-03 — 2-W 필수 보완 완료 인계

### 1. 변경 파일과 변경 목적

- `src/engine/courseV1.ts`: 공개 상수 `COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT = 32`를 추가하고, 정규화 진입 시 route의 path가 32개를 넘으면 geometry 전체만 제거하도록 보완했다. 기존 전체 point 512개·path당 최소 2점·finite·좌표 범위 검증은 그대로 유지한다.
- `src/engine/index.ts`: path 상한 상수를 엔진 공개 진입점에서도 내보낸다.
- `test/course-v1-route-geometry.test.ts`: 33 paths/66 valid points를 손상 geometry 표에 추가하고, 32 paths 보존/33 paths 제거 경계를 별도 fixture로 고정했다. diagnostics와 continuation의 비유출 검사는 문자열 부분 검색 대신 객체 key를 재귀 수집해 금지 키의 정확한 존재 여부를 검사한다.
- `docs/work/recommendation-engine/verified-route-geometry.md`: 같은 2-W 안에 통합 보완 내용과 재검증 결과를 추가했다.

### 2. 유지한 공개 계약·정책 경계

- 33 paths 입력에서도 exact `mode/min`과 코스 통과, ID, `totalMin`, 순위, provider attempt, continuation signature/page 결과는 유지되고 geometry만 제거된다. 32 paths 입력은 두 leg에 그대로 보존된다.
- route당 path 최대 32개·전체 point 최대 512개라는 `DEC-COURSE-GEOMETRY-01` 경계와 엔진 공개 계약을 일치시켰다.
- diagnostics·continuation에서 `geometry`, `paths`, `points`, `lat`, `lon`이라는 정확한 key가 없음을 유지하며 `classificationExcluded` 같은 정상 key는 허용한다.
- 추천 정책·예산·순위, API, UI, 서비스, DB/migration, 카탈로그·환경값, 기준 문서와 작업 보드는 수정하지 않았다. 실제 외부 API·GPS·DB 호출은 0회다.

### 3. 실행한 테스트와 결과

- 통합 지적 재현: 기존 신규 테스트 — 3/4 성공, `classificationExcluded`의 부분 문자열 `lat` 오탐 1건 실패.
- 보완 실패 우선: 32/33 paths fixture 추가 후 — 3/5 성공, 공개 상수 부재와 33 paths 미제거 2건 실패.
- 최종 신규 geometry 테스트 — 5/5 성공.
- 관련 엔진 회귀 8개 파일 — 87/87 성공.
- `npm run test:typecheck` — 성공.
- `npm test` — 117/117 성공.
- `git diff --check` — 성공.

### 4. 다음 결정 필요 사항·위험·재현 조건

- 통합·결정 세션은 2-W의 32/33 paths 경계와 최종 5/5·87/87 결과를 독립 재확인한 뒤 수락 여부를 갱신해야 한다.
- API·DB 역할은 공개 형상을 엔진과 동일한 path 32개·전체 point 512개 상한으로 전달해야 한다. UI는 검증된 `leg.geometry`만 소비하고 누락 시 직선을 만들거나 route를 재조회하지 않아야 한다.
- 이후 geometry schema가 바뀌면 32/33 paths, 512/513 points, exact key 비유출, geometry 유무에 따른 ID·attempt·continuation 불변 fixture를 함께 재실행해야 한다.

## 2026-09-03 — 통합 재검토

### 판정

**최종 수락.** route당 32 paths는 보존하고 33 paths는 geometry만 제거하는 경계가 구현됐다. diagnostics·continuation 비유출 검사는 객체 key의 정확 일치로 교체되어 `classificationExcluded` 오탐 없이 금지 키를 계속 감시한다. geometry 손상·누락이 exact 시간이나 코스 통과를 바꾸지 않고, 추천 ID·순위·attempt·continuation에도 관여하지 않는 기존 경계를 유지한다.

### 통합 세션 재검증

- `npx tsx --test test/course-v1-route-geometry.test.ts` — 5/5 성공.
- `npm run test:typecheck` — 성공.
- `npm test` — 117/117 성공.
- `git diff --check` — 성공.
- 실제 외부 API·GPS·DB·운영 배포 호출은 0회다.

`DB-ROUTE-GEOMETRY-01`과 2-W가 모두 수락됐으므로 `API-ROUTE-GEOMETRY-01`과 `U-COURSE-GEOMETRY-01`의 선행 대기를 해제한다. 두 작업은 서로의 소유 파일을 수정하지 않고 고정 fixture 계약으로 병렬 진행할 수 있다.
