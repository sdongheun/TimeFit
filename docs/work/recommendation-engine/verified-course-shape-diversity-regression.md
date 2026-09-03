# 2-S-R — 다장소 검증 기회 회귀 고정

## 상태

구현 완료·인계 대기. 2-S의 production queue가 첫 N2 route 탈락 뒤에도 두 번째 N2를 첫 결과에서 실제 검증하는 회귀를 왕복·도착지 fixture로 고정했다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. [2-S 작업](verified-course-shape-diversity.md)
3. `src/engine/courseV1.ts`, `test/course-v1-pagination.test.ts`

## 확인된 상태

- 공개 기본 entry는 `buildInitialContinuationCourseV1` → `verifyContinuationPage` → `continuationQueue`를 실제로 사용한다.
- 2-S는 이 queue를 `N1 → N2 → 다음 N1 → 다음 N2`로 바꿨고, 관련 순수 테스트 49개는 통과했다.
- 그러나 현 테스트는 2곳 코스가 모두 성공하는 경우만 확인한다. 따라서 **첫 독립 2곳 route 탈락 뒤, 두 번째 독립 2곳이 유효할 때도 1곳 코스가 목표 수를 먼저 채워 그 두 번째 2곳을 건너뛰지 않는지** 증명하지 못한다.

## 작업 명령

`test/course-v1-pagination.test.ts`에 공개 기본 entry만 쓰는 고정 receipt fixture 하나를 추가한다.

1. 120분 왕복 입력과 최소 네 개의 대표 후보를 사용한다.
2. N1 세 개는 실제 검증되게 하고, queue의 첫 N2는 중간 구간 `no_route`로 탈락하게 한다.
3. **두 번째 독립 N2**는 모든 leg가 exact route로 검증되게 한다.
4. 결과에는 그 두 번째 N2의 두 장소 코스가 포함되어야 한다. 단, 대표가 1곳인지 2곳인지·3곳 포함 여부는 고정하지 않는다.
5. `shapeDiagnostics[2]`의 시도·검증 수가 각각 기대값 이상인지, `newProviderAttemptCount ≤ 8`, `adapterCallCount ≤ 24`를 함께 고정한다.
6. 이 fixture가 실패하면 queue 교차가 production entry가 아닌 internal B12 경로에만 적용된 경우이므로, production entry를 보정한다. 호출 상한을 늘리거나 다장소를 강제해서 통과시키면 안 된다.
7. 기존 2-S의 전부 다장소 탈락 fixture와 180분 가능 fixture는 유지한다.

## 경계

- 수정 가능: `src/engine/`이 실제로 필요한 경우, 순수 엔진 test, 이 작업 기록.
- 수정 금지: UI, 데이터, API adapter·한도, DB, `.env*`, `docs/작업조정_보드.md`, 제품 정책 문서.
- 실제 API·GPS·DB 호출은 0회다.

## 완료 기준

- 위의 실패-후-성공 fixture가 새 구현 전 실패하고 보완 뒤 통과한다.
- `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`, `npm run test:typecheck`, `npm test`, `git diff --check` 결과를 기록한다.
- 변경 파일, 유지한 예산/정책, 테스트 결과, 남은 실기기 위험을 이 문서 끝에 인계한다.

## 다음 단계

2-S-R 수락 뒤에만 새 internal build를 설치하고 `QA-UX-CORE-01`의 네 실제 사용자 흐름을 실행한다.

---

## 2026-09-01 — 2-S-R 완료 인계

### 1. 변경 파일과 목적

- `test/course-v1-pagination.test.ts`: 공개 `buildLimitedRepresentativeCourseV1`만 호출하는 120분 왕복/도착지 fixture를 추가했다. 실제 사전선정 queue에서 첫 N2의 중간 leg만 `no_route`로 만들고, 두 번째 N2는 exact로 유지해 첫 결과에 포함되는지 검증한다.
- `docs/work/recommendation-engine/verified-course-shape-diversity-regression.md`: 회귀 범위와 결과를 기록했다.

### 2. 유지한 공개 계약·정책 경계

- queue 구현, 18개 장소 풀, provider 8→조건부 16회, adapter 24회, 결과 수·대표 우선순위는 변경하지 않았다. 다장소를 강제하지 않고, fixture에서 실제로 exact인 두 번째 N2만 결과에 남는다.
- internal B12/test-only entry가 아닌 production 기본 entry만 사용했다. UI/API/data/DB/보드는 수정하지 않았다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`: 50/50 통과. 왕복·도착지 각각 첫 N2 route 탈락, 두 번째 N2 검증, shape 2곳 시도 ≥2·검증 ≥1, provider attempt ≤8·adapter call ≤24를 확인했다.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 163 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- `QA-UX-CORE-01`은 이제 새 internal build에서 일반 사용자 흐름 네 개를 각 한 번 검증할 수 있다. 결과에 다장소가 없으면 이 고정 회귀가 아니라 실제 route/time 조건을 먼저 확인해야 한다.
- fixture는 외부 API/GPS/DB를 호출하지 않는다. 실제 Kakao receipt의 실패·시간 정확도와 화면 체감은 QA/API/실기기 경계에서 계속 확인해야 한다.
