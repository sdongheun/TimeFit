# 2-O — 체류 범위 기반 검증·추천 상태 전환

## 목적과 선행 결정

`DEC-DWELL-01`(2026-08-30): 최소 20분·권장 30분·최대 60분(문화시설 120분)은 서로 다른 역할을 가진다. 이전 V1은 권장 30분을 모든 결과의 하드 조건으로 사용해, 50분 입력에서 실제 왕복 이동이 짧아 최소 20분 방문이 가능한 장소도 탈락시켰다.

이 작업은 **최소 체류를 안전 통과 조건**, 권장 체류를 **품질 우선순위와 표시 상태**로 전환한다. 최대 체류시간은 자동 연장 값이 아니라 상한이다.

## 소유 범위

- 수정: `src/engine/courseV1.ts`, `src/engine/index.ts`, `test/course-v1*.test.ts` 및 이 작업 묶음
- 수정 금지: `src/data/`, `src/ui/`, Route Proxy/adapter, `docs/작업조정_보드.md`, 제품 기준 문서
- `maxStayMin`을 실제 런타임 후보에 전달하는 일은 [DATA-DWELL-01](../data-curation/candidate-dwell-contract.md)의 소유다. 두 작업이 모두 수락되기 전에는 production 전환·UI 작업을 하지 않는다.

## 구현 계약

### 1. 후보 체류 범위

- `CourseV1Candidate`에는 `minStayMin`, `recommendedStayMin`, `maxStayMin`을 모두 전달한다. 범위는 정수이며 `0 < min <= recommended <= max`가 아니면 자동 추천 후보가 될 수 없다.
- 전환 중 누락된 `maxStayMin`을 60분으로 추정하거나 권장값으로 조용히 대체하지 않는다. DATA-DWELL-01이 전달하지 않은 후보는 fail-closed로 제외하고 안전한 진단/테스트 근거를 남긴다.
- `canPossiblyOpen`, 사전선정의 시간 하한, 1·2·3곳 조합의 빠른 제외는 권장 합계가 아니라 **최소 체류 합계**를 사용한다. 실제 운영시간은 정확 경로 뒤 선택 체류로 다시 판정한다.

### 2. 정확 경로 뒤의 선택 체류

1. 기존 receipt queue·A8/B12 attempt/adapter 상한 안에서 실제 이동 구간을 한 번만 확인한다. 체류시간을 바꾸기 위해 provider 요청을 추가하거나 queue 순서를 바꾸지 않는다.
2. 각 장소에 최소 체류를 배정한 시간표가 운영시간·도착 여유·입력 시간 안에 드는지 먼저 판정한다. 이 단계가 실패하면 `time_budget_exceeded`다.
3. 최소 시간표가 통과하면, 동일한 실제 구간으로 각 장소를 권장 30분으로 올릴 수 있는지 결정적으로 검사한다. 앞 장소의 10분 연장이 뒤 장소의 운영 종료나 최종 도착을 넘기면 그 연장은 하지 않는다. 전체 시간표를 다시 계산해 검증한다.
4. 기본 선택은 가능한 장소의 권장 30분이다. 권장으로 올릴 수 없는 장소는 최소 20분과 `short` 상태를 기록한다. 여러 장소 코스는 권장과 `short`가 섞일 수 있다.
5. 40·50·60분 및 문화시설 120분은 이번 작업에서 자동 선택하지 않는다. 충분한 남는 시간이 있어도 30분에서 멈추고 남은 시간은 남긴다. `maxStayMin`은 잘못된 범위·후속 개인화 확장을 막는 상한으로만 쓴다.

### 3. 공개 결과와 정렬

- `CourseV1Stop`은 실제 `stayMin`과 함께 UI·저장에 필요한 결정적 상태(`recommended` 또는 `short`)를 스냅샷으로 가진다. UI가 카탈로그 범위나 남은 시간을 다시 해석해 상태를 만들면 안 된다.
- 하나의 장소 집합·방문 순서는 선택 체류가 달라도 **한 코스만** 반환한다. 20분판과 30분판을 별도 대안으로 내지 않는다.
- 최소 체류만 가능한 코스는 전역 fallback이 아니다. 권장 코스가 있어도 실제 경로 검증을 통과하면 대안 후보가 될 수 있다.
- 대표 정렬은 기존의 1~2곳 우선·실제 이동 부담·발견성 경계를 유지하되, 같은 안전성·공간 적합성에서는 권장 체류를 더 많이 확보한 코스를 먼저 둔다. 남는 시간을 적게 만들기 위해 체류를 늘리거나 장소 수를 늘리는 점수는 금지한다.
- `selectNonNestedCourseV1`, 동일 `siteGroupId` 차단, conditional/hold 제외, 운영시간 structured gate, 결과 9개·A8 8회/B12 12회·adapter 24회 상한은 변경하지 않는다.

## 필수 고정 fixture

외부 API·실시간 시각 없이 공개 entry를 실행해 아래를 검증한다.

1. **50분 단일 장소:** 도착 여유 10분, 실제 왕복 이동 12~20분, `20/30/60` 장소는 20분 `short` 코스로 반환한다. 권장 30분이 시간 초과여도 결과 0이 되지 않는다.
2. **동시 반환:** 같은 입력에서 권장 30분 코스와 다른 장소의 20분 `short` 코스가 모두 실제 검증되면 둘 다 결과 집합에 남고, 권장 코스가 우선한다.
3. **운영 종료 경계:** 20분은 영업시간 안이고 30분은 닫는 시각을 넘는 장소는 `short`로 통과한다. 20분도 넘으면 탈락한다.
4. **혼합 2곳:** 한 장소는 30분, 다음 장소는 20분으로 해야만 운영시간·도착 여유를 지키는 코스의 순서·도착/출발 시각·총합을 검증한다.
5. **상한 비자동 확장:** 60분 일반 장소와 120분 문화시설은 180분 입력이어도 자동으로 30분을 넘겨 배정하지 않고 남는 시간 구간을 보존한다.
6. **사전선정:** 최소 합계만 가능한 3곳 조합이 권장 합계 초과만을 이유로 queue에서 사라지지 않는다.
7. **비용·중복 불변:** 위 fixture에서 새로운 provider attempt·adapter call은 기존 A8/B12 상한을 넘지 않고, 같은 장소·순서의 20/30 체류 변형은 한 결과만 반환한다.
8. 기존 `course-v1`, limited integration, QA-05 fixture가 새 stop 상태를 명시적으로 검사하며, 누락 상태를 UI가 추론하지 못하게 한다.

## 완료 기준과 인계

- `npm run test:typecheck`, 관련 engine test, `npm test`, `git diff --check`를 실행한다.
- DATA-DWELL-01이 완료되기 전에는 runtime catalog로 production 경로를 수락·배포하지 않는다.
- 완료 기록에는 변경 파일 / 유지한 공개 계약 / fixture별 결과와 provider·adapter 수 / DATA-DWELL-01 및 UIUX에 넘길 stop 상태 계약을 남긴다.

---

## 2026-08-30 — 2-O 완료 인계

### 변경 파일

- `src/engine/courseV1.ts`
  - 후보 범위에 `maxStayMin`을 추가하고, `0 < min ≤ recommended ≤ max`가 아닌 범위 및 전환 중 `maxStayMin`이 누락된 후보를 자동 추천에서 fail-closed로 제외했다.
  - 사전 운영 가능성·3곳 사전선정 시간 하한을 최소 체류 합계로 변경했다.
  - exact legs를 모두 한 번 검증한 뒤 최소 체류 시간표를 먼저 통과시키고, 같은 legs에서 방문 순서대로 권장 체류를 시도하는 선택기를 추가했다. 권장 불가 stop은 최소 체류와 `short`, 권장 가능 stop은 `recommended` 상태를 결과 snapshot에 기록한다.
  - `maxStayMin`은 범위 검증 상한일 뿐 30분을 넘는 자동 연장에 사용하지 않는다.
- `test/course-v1-limited-integration.test.ts`, `test/course-v1.test.ts`
  - 50분 short, 권장/short 동시 반환, 운영 종료 혼합 2곳의 실제 시각, 60/120 비자동 확장, 누락 max fail-closed를 고정 fixture로 추가·갱신했다.
- 이 현재 작업 묶음에 인계를 기록했다. 보드·UI·data·API·DB·환경값은 수정하지 않았다.

### 유지한 계약

- A8/B12 provider attempt·queue, adapter 24회, 18 후보/5,220 조합/9 결과 상한, receipt cache·fail-closed, 동일 `siteGroupId`·nested·W/T gate는 변경하지 않았다.
- 기본/고정 B12 entry와 test-only 평가 경계는 유지했다. 체류 변경을 위해 새 route/provider 요청을 시작하지 않는다.
- `CourseV1Stop`은 실제 `stayMin`과 `stayState: recommended | short`를 엔진 snapshot에 제공한다. 전환 호환을 위해 type은 optional이지만, 2-O가 만든 모든 stop에는 값이 있다. UI는 DATA-DWELL-01·U-1-DWELL-01 수락 전 이를 소비하거나 추론하지 않는다.

### 테스트 결과

- 50분 왕복: 10+20+10 이동/체류와 10분 buffer에서 권장 30분은 넘지만 최소 20분 `short` 코스를 반환했다.
- 동일 입력의 권장/short 단일 코스는 함께 남고 권장 코스가 대표이며, 같은 장소·순서의 20/30분 변형은 하나만 반환했다.
- 운영 종료 혼합 2곳은 `closing` 20분 `short` → `first` 30분 `recommended`를 반환하고, closing departure `2026-08-24T01:25:00.000Z`, 총 70분을 보존했다.
- 60분 일반·120분 문화 후보도 180분 입력에서 자동 선택 체류는 30분 이하이며, 누락 max 후보의 사전선정 eligible 수는 0이다.
- `npx tsx --test test/course-v1-limited-integration.test.ts test/course-v1.test.ts` — 44/44 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 102/102 통과.
- `git diff --check` — 통과.
- 실제 API/GPS/Auth/DB 호출 — 0회.

### 다음 결정·위험

- `DATA-DWELL-01`이 runtime catalog/provider에 `maxStayMin`을 전달하기 전, 실제 runtime 후보는 의도적으로 fail-closed될 수 있다. 이 엔진 변경만으로 production 전환·배포하면 안 된다.
- DATA 계약 수락 뒤 `U-1-DWELL-01`은 snapshot의 `stayMin`/`stayState`만 표시해야 하며, 카탈로그의 체류 범위나 남은 시간을 다시 해석해 상태를 만들면 안 된다.
- 그 뒤 QA-DWELL-01이 50분·운영시간·상한 비자동 확장과 A8/B12 비용 불변을 통합 fixture로 확인한 뒤에만 RD-B12 실기기 2회를 진행한다.

---

## 2026-08-30 — 2-O 보완 완료 인계

### 변경 파일

- `src/engine/courseV1.ts`
  - receipt 및 legacy exact-route 검증에서 각 stop의 **최소 체류** 운영시간을 해당 incoming leg 직후 판정하도록 바꿨다. 최소 체류가 운영 종료를 넘거나 부분 시간 예산을 이미 넘으면 다음 stop/final leg를 요청하지 않고 각각 fail-closed로 끝낸다.
  - receipt 경로는 조기 탈락을 `time_budget_exceeded`로, legacy 경로는 기존 진단 의미대로 운영시간은 `openingRejected`, 시간 예산은 `budgetRejected`로 보존했다.
  - 대표 정렬은 기존 이동 부담 → 실제 이동 시간 우선순위를 유지하고, 두 값이 같은 경우에만 `recommended` stop 수가 많은 코스를 먼저 선택하게 했다.
  - stop의 `departureAt` 설명을 실제 선택 체류 종료 시각으로 정정했다.
- `test/course-v1-limited-integration.test.ts`
  - 최소 체류 운영시간 탈락 뒤 `closed-at-minimum`에서 출발하는 downstream receipt가 0회임을 A8·internal B12 양쪽에서 고정했다. 두 entry의 provider attempt는 12 이하, adapter call은 24 이하로 확인했다.
  - 같은 이동 부담·같은 이동 시간에서 `recommended` stop이 많은 코스가 `short` 혼합 코스보다 앞서는 정렬 fixture를 추가했다.
- `test/course-v1.test.ts`
  - legacy 순수 경로에서 최소 시간표의 예산 탈락이 `openingRejected`가 아니라 `budgetRejected`로 기록됨을 고정했다.
- 이 작업 묶음에 보완 인계를 시간 순서대로 추가했다. 보드·제품 정책·UI·data·API·DB·환경값은 수정하지 않았다.

### 유지한 공개 계약

- 후보 범위 `0 < min ≤ recommended ≤ max`, 누락 `maxStayMin` fail-closed, `stayMin`/`stayState` snapshot, 권장 체류를 위해 route를 재요청하지 않는 계약은 유지했다.
- A8/B12 receipt queue, provider attempt 상한(8/12), adapter 24회 상한, receipt cache, 1~2곳 우선·nested/siteGroup/structured gate 및 결과 상한은 변경하지 않았다.
- 정렬 보완은 이동 부담과 실제 이동 시간이 동률일 때만 적용한다. 남는 시간을 채우거나 장소 수를 늘리기 위한 점수는 추가하지 않았다.

### 테스트 결과

- `npx tsx --test test/course-v1-limited-integration.test.ts test/course-v1.test.ts` — 47/47 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 통과.
- `npm test` — 102/102 통과.
- `git diff --check` — 통과.
- 고정 receipt fixture에서 최소 운영시간 불가 stop 뒤의 downstream receipt는 0회이며, A8/B12 모두 provider attempt ≤ 12 및 adapter call ≤ 24를 만족했다.
- 실제 API·GPS·Auth·DB 호출 — 0회.

### 다음 결정·위험

- `DATA-DWELL-01`이 runtime catalog/provider의 `maxStayMin` 전달을 수락하기 전 production 후보는 의도적으로 fail-closed될 수 있다. 이 엔진 작업만으로 production 전환·배포하면 안 된다.
- `U-1-DWELL-01`은 엔진 snapshot의 `stayMin`/`stayState`만 표시해야 하며, 카탈로그 범위나 잔여 시간으로 `recommended`/`short`를 재계산하면 안 된다.
- QA-DWELL-01은 DATA·UI 수락 뒤 A8과 fixed B12에서 조기 운영시간 차단, 호출 수, 정렬 동률 및 실제 어댑터 경계를 통합 fixture로 다시 확인해야 한다.
