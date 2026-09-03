# 2-S — 검증 코스 형태 다양성 회복

## 상태

구현 완료·인계 대기. 18개 공간 풀과 8→조건부 16회 상한을 유지한 채, 첫 receipt queue의 1·2곳 교차와 형태별 내부 관찰값을 추가했다.

## 목적

`QA-SUPPLY-01`에서 120분 입력 세 생활권이 각각 서로 다른 1곳 코스 세 개만 반환했고, 2·3곳 코스는 관찰되지 않았다. DATA-SUPPLY-01의 대표 1개 보강만으로는 사용자가 느끼는 장소·활동 다양성을 해결하지 못했다.

이번 작업은 장소를 더 넣거나 route 호출량을 늘리는 작업이 아니다. 현재 191개 자동 대표와 현행 18개 장소 풀·첫 8→조건부 16회 provider attempt 안에서, 실제로 가능한 2·3곳 코스가 1곳 코스 연속 검증 때문에 기회를 잃는지 고정 receipt로 분리하고, 확인되면 검증 대기열의 **형태 교차 순서**만 보정한다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md` 1.5.1·1.6, `docs/테스트.md` REC-25~29
3. `courseV1.ts`, `test/course-v1-limited-integration.test.ts`, `test/course-v1-pagination.test.ts`
4. `QA-SUPPLY-01`의 완료 기록

## 현행 관찰과 해석 경계

- SUP-02~04에서 1곳 코스 세 개가 실제로 시간표 오류 없이 나왔다는 것은, 엔진이 단일 장소 후보를 검증할 수 있음을 뜻한다.
- 이것만으로 다장소 코스가 실제 경로·운영시간·최소 체류를 통과했다고 추정하지 않는다. 실제 Kakao route가 실패했을 수도 있고, 첫 queue에서 기회를 잃었을 수도 있다.
- 현재 `continuationQueue`는 첫 1곳 뒤 첫 2곳을 한 번 시도한 후 나머지 1곳을 연속 배치한다. 첫 2곳이 탈락하고 단일 코스가 목표 수를 먼저 채우면, 뒤의 독립 2곳·3곳은 첫 결과에서 검증되지 않을 수 있다.

## 구현 규칙

1. 자동 대표·조건부·hold 분류, 18개 장소 풀, 5,220개 조합 상한, 첫 결과 새 provider attempt 8→조건부 16, adapter call 24, 첫 결과 대표 1+대안 최대 3, 이어보기 8회/3개를 바꾸지 않는다.
2. 1·2·3곳은 강제 장소 수가 아니다. 2·3곳이 실제 route·운영시간·최소 체류·도착 여유를 통과하지 못하면 1곳만 정직하게 반환한다. 남는 시간을 채우기 위해 체류·장소를 늘리지 않는다.
3. 첫 결과의 receipt 대기열은 가능한 경우 `근접 1곳 → 독립 2곳 → 다음 근접 1곳 → 다음 독립 2곳` 순으로 교차한다. 이미 선택/탈락한 동일 장소 집합·순서만 다른 집합은 다시 넣지 않는다.
4. 3곳은 대표 우선순위를 얻지 않는다. 다만 1·2곳 교차 기회를 해치지 않는 범위에서, 사전 최소 체류+도착 여유를 통과한 독립 3곳 후보 한 개에는 첫 결과에서 검증 기회를 준다. 실제 검증 실패면 더 많은 3곳을 억지로 찾지 않는다.
5. internal diagnostics에만 카드 수가 아닌 형태별 안전 집계를 추가한다: 1/2/3곳 각각의 queue 수, 실제 시도 수, 검증 수, `time_budget_exceeded`·`route_not_verified`·`route_verification_unavailable` 수. 장소명·좌표·route URL·provider 원문은 기록하지 않는다. 일반 사용자 UI에는 노출하지 않는다.
6. first result의 목표 수가 단일 코스로 조기 충족돼도, 위 교차 슬롯 중 아직 시도하지 않은 2곳 후보가 있고 8/16·24 상한이 남아 있으면 그 슬롯을 먼저 검증한다. 이 규칙은 유효 다장소 후보의 **검증 기회**만 보장하며 결과 수를 보장하지 않는다.
7. 이어보기 continuation은 현재 candidate ID·cursor·signature·receipt key 경계를 유지한다. 새 server 상태, 좌표·사용자 ID, provider 객체, 새로고침·legacy fallback을 만들지 않는다.

## 필수 실패 fixture와 검증

1. 120분 왕복/도착지 각각에, 1곳 세 개가 먼저 실제 검증되지만 첫 2곳은 route 탈락하고 **두 번째 독립 2곳은 실제 검증 가능**한 fixture를 만든다. 보완 뒤 첫 결과에 그 2곳 코스가 포함돼야 한다.
2. 2곳·3곳이 전부 실제 route 또는 시간 게이트에서 탈락하는 fixture에서는 1곳만 반환하고, 기존 8→조건부 16·adapter 24 상한을 넘지 않아야 한다.
3. 1곳·2곳·3곳이 모두 실제로 가능한 180분 fixture에서는 대표가 1~2곳 우선이고, 3곳은 대안으로만 남을 수 있어야 한다.
4. cache/session reuse, provider unavailable, 운영 종료, siteGroup 관계 제외, 체류 20/30분, 같은 집합 순서 중복 제거, continuation 재수화 불일치 route 0의 기존 회귀를 유지한다.
5. `npm run test:typecheck`, 관련 순수 엔진 tests, `npm test`, `git diff --check`를 실행한다. 실제 Kakao/Supabase/DB/GPS 호출은 0회다.

## 수정 경계

- 수정 가능: `src/engine/`, 순수 엔진 fixture/test, 이 작업 문서.
- 수정 금지: `src/ui/`, `src/data/`, API adapter·Edge·cache/한도, DB, `.env*`, `docs/작업조정_보드.md`, 제품 정책 문서.

## 완료 뒤 UX 확인

2-S 수락 뒤에만 `QA-UX-CORE-01`을 연다. 새 internal build에서 사용자가 일반 추천 흐름을 3~4회 사용해 결과의 선택지·카드 이해·코스 확인·다음 길찾기를 평가한다. 그 UX 확인은 다장소 코스가 실제로 불가능한 경우를 결함으로 취급하지 않고, 사용자에게 의미 있는 선택지가 늘었는지를 평가한다.

---

## 2026-09-01 — 2-S 완료 인계

### 1. 변경 파일과 목적

- `src/engine/courseV1.ts`: `continuationQueue`를 `N1 → N2 → 다음 N1 → 다음 N2` 형태로 교차하고, 최소 체류+도착 여유를 통과한 3곳 후보 한 개를 뒤이어 검증 기회로 배치했다. `shapeDiagnostics`에 1/2/3곳별 queue·시도·검증·시간/route/unavailable 탈락 수만 남긴다.
- `src/engine/index.ts`: 내부 진단 타입 `CourseV1ShapeDiagnostics`를 barrel에 공개했다.
- `test/course-v1-pagination.test.ts`: 교차 순서, 다장소 검증 기회/진단, 다장소 route 탈락 시 단일 코스 유지와 상한을 고정했다.
- `test/course-v1-limited-integration.test.ts`: 현행 representative provider 191개 기대값으로 fixture를 동기화했다.

### 2. 유지한 공개 계약·정책 경계

- 대표 분류, 조건부/hold 제외, 18개 공간 풀, 5,220개 사전선정 상한, 첫 8→조건부 16회·adapter 24회, 이어보기 8회/3개 상한은 변경하지 않았다.
- 다장소 성공을 강제하지 않는다. 실제 route·운영시간·최소 체류·도착 여유에서 탈락하면 1곳 결과만 정직하게 유지하며, 3곳은 대표 우선순위를 얻지 않는다.
- diagnostics에는 장소명·좌표·route URL·provider 원문을 넣지 않으며 UI/API/data/DB/보드는 수정하지 않았다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts`: 49/49 통과.
- `npm run test:typecheck`: 통과.
- `npm test`: 109 통과, 실패 0.
- `npm run test:ui`: 163 통과, 실패 0, 기존 skip 1.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- `QA-UX-CORE-01`은 새 internal build에서 120분 왕복/도착지 등 실제 사용자 흐름을 확인해야 한다. 다장소가 보이지 않는 경우에는 shape diagnostics의 route/time 탈락과 실제 route 조건을 먼저 확인하고, 결과 수 자체를 실패 기준으로 삼지 않는다.
- 2-S는 실제 Kakao/Supabase/DB/GPS 호출을 하지 않았다. API adapter의 실제 receipt 품질·카카오 응답 실패는 API/QA 경계에서 별도로 관찰해야 한다.
