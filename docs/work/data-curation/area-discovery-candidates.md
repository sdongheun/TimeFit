# DATA-AREA-01 — 권역형 발견 후보·접근시간 계약

## 목적과 완료 상태

상단 대표 코스의 정확성은 낮추지 않으면서, 시장·거리·골목·해변·공원처럼 약속 전 잠깐 들러볼 수 있는 권역형 장소를 `이 시간에 더 들러볼 곳`의 후보로 분리한다. 이 작업은 **190개 대표 코스를 늘리거나 178개 조건부 후보를 일괄 승격하는 작업이 아니다.** 완료 상태는 데이터 계약과 감사 결과가 준비된 `구현 완료·통합 대기`다. 추천 엔진·UI·보드는 수정하지 않는다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md`의 1.5, 1.5.1절과 `docs/테스트.md`의 `DATA-12`, `DATA-15~19`, `DATA-25`
3. 현재 카탈로그·근거 프로필·운영시간 감사에 직접 연결된 `docs/02_data/` 문서와 `data/processed/review/` 결과만

## 고정 공개 계약

런타임에서 각 후보는 아래 발견 자격 중 하나를 명시적으로 전달한다. 기존 필드와 호환되는 매핑을 선택해도 되지만, 의미를 추론해 UI나 엔진이 재분류하게 해서는 안 된다.

| 값 | 자동 결과에서의 역할 | 최소 근거 |
| --- | --- | --- |
| `representative` | 대표 1~3곳 정확 코스와 탐색 목록 모두의 원천 | 기존의 구조화 운영시간/허용 야외 접근, 활동·체류 근거 |
| `area_access` | 탐색 목록 전용. 선택 뒤에만 1곳 실경로 검증 | 권역의 공식·검토된 접근 시간 또는 공개 야외 접근, 원천·확인일·접근 창 |
| `conditional` | 자동 탐색 목록 제외, 지도/카카오맵의 `운영시간 확인 필요` 전용 | 위 접근 근거가 없음 또는 시설형 구조화 운영시간이 없음 |

- `area_access`는 `placeKind: area|outdoor`에만 허용한다. 시장 전체가 07:00~19:00이라는 근거는 **대표 권역을 잠깐 둘러볼 접근 창**일 뿐, 내부 점포·전시·유료 프로그램의 운영시간이 아니다.
- 권역형 탐색 카드의 체류 정책은 `min/recommended/max`를 새로 부풀리지 않는다. 사용 문구는 제품 계약상 `가볍게 둘러보기 · 약 20분`이며, 기존 체류 범위는 선택 뒤 엔진이 다룬다.
- `facility`, 예약/유료/장기 이용 시설, 내부 점포는 구조화 운영시간 없이는 `area_access`가 될 수 없다.
- Kakao Place의 화면상 운영시간은 **독립적인 자동 승격 근거가 아니다.** 기존 원천/공식 근거가 이미 있는지 확인하는 보조 대조로만 쓰며, 새 대량 API 수집·추정·상호 운영시간 상속을 하지 않는다.

## 수행 범위

1. 현행 368개 런타임 카탈로그(대표 190 + 조건부 178)를 대상으로 `market/street/alley/beach/park/outdoor/area` 성격을 감사한다. 내부 점포, 음식점, 장기 이용·예약 시설은 별도 제외 사유를 남긴다.
2. 기존 공식 원천, 이미 보존된 원문 운영시간, 근거 프로필, 공개 야외 접근 근거만으로 `area_access` 가능 여부를 판정한다. 근거 문구, 원천, 확인일, 접근 창(요일/시간 또는 상시 접근)을 구조화한다.
3. 판정 결과를 런타임 카탈로그 및 provider가 소비할 데이터 필드로 전달한다. 대표 등급·운영시간 파서·사진·좌표·활동 유형·체류값은 근거 없이 변경하지 않는다.
4. 다음 감사 산출물을 남긴다.
   - `data/processed/review/권역형_발견후보_감사.json`: 후보별 이전 등급, 새 발견 자격, 장소 성격, 근거 요약/원천/확인일/접근 창, 제외 사유.
   - `docs/02_data/권역형_발견후보_감사.md`: 총수와 유형별 수, 대표/area_access/conditional 전후 수, 대표 생활권별 분포, 경계 사례(시장·거리·해변·시설)를 표로 요약.
5. 데이터 계약 테스트를 추가한다. 최소 fixture는 (a) 공식 시간 있는 시장 권역, (b) 공개 야외 해변/공원, (c) 시간 없는 거리, (d) 미술관 등 시설형, (e) 시장 내부 점포, (f) 동일 `siteGroupId` 대표·내부 쌍이다.

## 금지와 실패 처리

- “장소 수를 300개 이상으로 맞추기”를 목표로 분류하지 않는다. 결과 수는 감사 결과이며, 0개여도 근거가 부족하면 `conditional`을 유지한다.
- 190개 `representative`의 자동 정확 코스 자격을 낮추거나, `conditional_more` 전체를 자동 대표에 넣지 않는다.
- 운영시간이 `점포별 상이`인 문구만으로 접근 창을 만들어 내지 않는다. 공개 야외 접근 근거가 별도로 없으면 `conditional`이다.
- 근거가 충돌하면 가장 최근·1차 원천을 우선하되, 결론을 임의로 내리지 말고 후보를 `conditional`로 두고 충돌을 감사 파일에 적는다.
- 외부 API 대량 호출·원천 재수집은 이번 범위가 아니다. 필요한 추가 조사량이 상당하면 목록·예상 호출량·왜 기존 근거로 판정할 수 없는지를 인계한다.

## 완료 기준과 검증

- 대표/area_access/conditional의 합이 입력 런타임 후보 수와 일치한다.
- `area_access` 모두에 장소 성격, 근거 원천, 확인일, 접근 창이 있고, 시설형·내부 점포에는 0건이다.
- 대표 190의 등급·기존 운영시간·체류값·좌표·사진 연결은 불변임을 계약 테스트로 확인한다.
- 새 필드는 JSON schema/TypeScript provider 경계에서 누락 시 fail-closed(`conditional`)이며, 추론 기본값으로 자동 발견에 넣지 않는다.
- 관련 데이터 테스트, `npm run test:typecheck`, `git diff --check` 결과를 기록한다.

## 인계 형식

현재 작업 문서 끝에 반드시 남긴다: (1) 변경 파일·목적, (2) 바꾸지 않은 대표 코스 등급/공개 계약, (3) 실행한 테스트·결과, (4) `area_access` 수·제외/충돌 수·엔진 통합 전 위험. 보드는 수정하지 않는다.

---

## 2026-08-31 — DATA-AREA-01 완료 인계

### 변경 파일·목적

- `scripts/build_area_discovery_audit.mjs`, `data/processed/review/권역형_발견후보_감사.json`: 현행 368개를 보존 근거만으로 `representative` 190·`area_access` 2·`conditional` 176으로 감사했다.
- `scripts/build_runtime_poi_catalog.mjs`, `src/data/busan_poi_catalog.json`: 각 런타임 장소에 `discovery.eligibility`를 전달하고, `area_access`에만 원천·확인일·상시 접근 창을 보존했다. 감사 누락은 fail-closed `conditional`이다.
- `src/data/courseV1CandidateProvider.ts`: 기존 대표 provider는 유지하고, 2-P가 읽을 별도 `listDiscoveryCandidates()`와 `DiscoveryEligibility` 타입을 추가했다.
- `test/area-discovery-candidates.test.mjs`, `test/course-v1-candidate-provider.test.ts`, `docs/02_data/권역형_발견후보_감사.md`: 데이터·provider 계약과 감사 요약을 추가했다.

### 유지한 계약

- 대표 190의 classification, 운영시간, 체류 범위, 좌표, 사진, 기존 `listRepresentativeCandidates()` 결과와 정렬은 변경하지 않았다.
- `area_access`는 탐색 목록 전용이다. 이번 작업은 엔진·UI·Route Proxy·실제 경로 호출·A8/B12 queue·보드를 수정하지 않는다.
- 조건부 178개 중 공식 공개 야외 접근이 명시된 두 해변·해안 권역만 `area_access`로 분리했다. 시설, 내부 점포, `가게별 상이`·프로그램별 시간·근거 없는 거리/시장은 계속 `conditional`이다.

### 테스트 결과

- 감사 재생성: `node scripts/build_area_discovery_audit.mjs && node scripts/build_runtime_poi_catalog.mjs` — 368개, representative 190 / area_access 2 / conditional 176.
- `node --test test/area-discovery-candidates.test.mjs` — 3/3 통과.
- `npx tsx --test test/course-v1-candidate-provider.test.ts test/area-discovery-candidates.test.mjs` — 7/7 통과.
- `npm run test:typecheck`, `npm run test:ui`(129 통과·기존 철회 이력 1건 skip), `npm test`, `git diff --check` — 통과.
- 실제 API·GPS·Auth·DB 호출 — 0회.

### 다음 결정·위험

- 2-P는 `listDiscoveryCandidates()`의 `representative`와 `area_access`만 로컬 탐색에 소비하고 `conditional`·facility를 fail-closed로 제외해야 한다. 첫 렌더·더 보기에는 route 호출 0회를 유지한다.
- `area_access` 2개는 상시 공개 야외 **권역 접근**만 의미한다. 내부 시설·계절 프로그램을 자동으로 포함하거나 실제 시간표/검증 완료로 표시하면 안 된다. 선택 뒤 1곳 실경로·접근 창·최소 체류 검증이 필요하다.

---

## 통합 보완 — `placeKind` 공개 투영 (수락 전 필수)

2-P 검토에서 데이터와 엔진의 공개 타입이 한 필드 불일치함을 확인했다. `listDiscoveryCandidates()`가 `area_access`의 접근 근거·창은 주지만, 엔진이 시설형 우회를 차단할 때 필요한 `discovery.placeKind`를 주지 않는다. 현 상태로 UI가 연결하면 두 `area_access` 후보도 엔진에서 fail-closed로 빠진다.

### 수행

1. 런타임 `evidenceProfile.placeKind`를 엔진 공개 enum으로 **명시 변환**해 `CourseV1DiscoveryCandidate.discovery.placeKind`로 전달한다.
   - 원천 `area` → `area`
   - 원천 `outdoor_route` → `outdoor`
   - 원천 `point_facility` → `facility`
   - 알 수 없거나 누락 → 필드를 추정하지 말고 `conditional` 처리 또는 `placeKind` 누락 fail-closed를 유지한다.
2. `area_access`는 반드시 `area` 또는 `outdoor`이며, `facility`는 접근 근거·창이 있어도 `area_access`로 전달되지 않게 한다.
3. provider 계약 테스트에 실제 `poi_646`, `poi_662`가 `area_access + placeKind: area`로 전달됨을 추가한다. `point_facility` fixture는 `facility`로 전달되거나 자동 탐색 자격 `conditional`임을 함께 검증한다.
4. 대표 190개 목록·정렬·체류·운영시간 및 감사 수 `190/2/176`은 바꾸지 않는다. 엔진·UI·Route Proxy·보드는 수정하지 않는다.

### 완료 기준

- `listDiscoveryCandidates()` 결과가 2-P의 `CourseV1DiscoveryCandidate` 입력과 타입 호환된다.
- 실제 런타임의 두 `area_access`가 `buildExplorationPageV1`의 area/outdoor gate에서 빠지지 않음을, 데이터 provider 경계 테스트 또는 최소 고정 통합 fixture로 증명한다.
- `node --test test/area-discovery-candidates.test.mjs`, provider TypeScript 테스트, `npm run test:typecheck`, `git diff --check`를 실행하고 네 인계 항목을 갱신한다.

---

## 2026-08-31 — DATA-AREA-01 `placeKind` 공개 투영 보완 인계

### 변경 파일·목적

- `src/data/courseV1CandidateProvider.ts`
  - 카탈로그의 보존된 `evidenceProfile.placeKind`를 provider 공개 `discovery.placeKind`로 명시 변환했다: `area → area`, `outdoor_route → outdoor`, `point_facility → facility`.
  - 알 수 없거나 누락한 원천값은 추정하지 않는다. 특히 `area_access`는 기존 접근 근거·상시 창이 모두 있어도 `area|outdoor`로 변환되지 않으면 `conditional`로 fail-closed한다.
- `test/course-v1-candidate-provider.test.ts`
  - 실제 `poi_646`, `poi_662`가 `area_access + placeKind: area`로 provider에서 전달되고, 조건부 시설형 `poi_41`은 `facility`로 전달됨을 고정했다.
  - 실제 두 `area_access` provider candidate가 2-P `buildExplorationPageV1`의 area/outdoor gate를 통과함을 고정 통합 fixture로 확인했다.
- 이 데이터 현재 작업 문서에 보완 인계를 추가했다. 카탈로그 원본·감사 산출물·엔진·UI·Route Proxy/adapter·보드는 수정하지 않았다.

### 유지한 공개 계약

- 감사 수와 발견 자격은 `representative` 190 / `area_access` 2 / `conditional` 176으로 불변이다.
- 대표 190개의 classification, 정렬, 운영시간, 체류 범위, 좌표, 사진 및 `listRepresentativeCandidates()` 결과를 변경하지 않았다.
- `area_access`는 탐색 전용이며, 공개 야외 권역 접근 근거일 뿐 내부 시설·점포·계절 프로그램의 운영시간을 상속하지 않는다. `facility`는 자동 탐색 승격되지 않는다.

### 테스트 결과

- `npx tsx --test test/course-v1-candidate-provider.test.ts test/area-discovery-candidates.test.mjs test/course-v1-exploration.test.ts` — 13/13 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 통과.
- `npm test` — 105/105 통과.
- `git diff --check` — 통과.
- 실제 API·GPS·Auth·DB 호출 — 0회.

### 다음 결정·위험

- 2-P의 `area_access` fail-closed 원인이었던 provider `placeKind` 누락은 해소됐다. 통합·결정은 이 보완을 수락한 뒤 2-P와 U-EXPLORE-01의 실제 조립을 진행할 수 있다.
- UIUX는 `area_access`를 실제 시간표/시설 운영 보장으로 표시하지 말고, `accessEvidence`/`accessWindow`와 선택 뒤의 1곳 receipt 결과만 사용해야 한다.
- 현재 두 권역만 자동 탐색 대상이다. 시장·거리·시설 등 나머지 조건부 176개를 승격하려면 별도 공식 접근 근거 감사가 필요하며, 이 필드 투영을 근거로 수를 늘리면 안 된다.
