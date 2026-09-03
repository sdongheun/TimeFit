# DATA-MARKET-01 — 조건부 시장·거리 발견 계약

## 상태

수락. 2-Q와 병렬로 완료됐다. 이 작업은 장소를 대표 추천으로 늘리는 작업이 아니다.

## 읽을 범위

`AGENTS.md` → `docs/README.md` → `docs/작업조정_보드.md` → `docs/03_product/추천로직.md` 1.5.1 → `docs/테스트.md` DATA-25·REC-29 → 관련 `docs/02_data/` 근거와 현재 카탈로그 계약 → 이 문서.

## 목표

운영시간이 구조화되지 않은 시장·거리·골목을 버리지 않되, 자동 추천의 신뢰도를 낮추지 않는다. 적격 후보에만 `conditional_visit`을 투영해 UI가 정보 확인용으로 분리 노출할 수 있게 한다. 이는 10:00–18:00 **제품 탐색 창**이지 영업시간·안전시간·공식 운영 근거가 아니다.

## 구현 명령

1. 기존 `conditional_more`만 검토한다. 기존 `representative_core/standard`, 운영시간, 체류, 좌표, 사진, source, 등급 수를 승격·수정하지 않는다.
2. 시장·거리·골목의 권역형 장소만 구조화한 `conditionalVisit` 공개 필드를 부여한다. 필드는 최소 `kind: market_or_street`, `displayWindow: 10:00–18:00`, `requiresUserHoursConfirmation: true`를 갖고 runtime provider가 명시적으로 전달할 수 있어야 한다.
3. 시설, 개별 점포, 도매·새벽 전용, 장기 이용/예약 중심 장소는 title 단어만으로 포함하지 말고 제외한다. 기존 근거·placeKind·활동 유형·분류 기록을 사용해 후보별 포함/제외 이유와 ID를 감사 문서에 남긴다.
4. 카카오맵 UI/REST에서 운영시간을 스크래핑·수집·추론하지 않는다. 이번 작업에서 외부 대량 재조사·API 호출을 늘리지 않는다. 공식 구조화 운영시간이 이미 있는 장소는 `conditional_visit`가 아니라 현행 대표 등급/감사 절차를 유지한다.
5. 적격 수와 ID 목록, 제외 수와 이유 분포, 이전 등급 불변을 `docs/02_data/` 감사 문서에 기록한다. 데이터가 없거나 불확실하면 fail-closed로 해당 필드를 주지 않는다.

## 필수 검증

- provider 출력에 eligible `conditionalVisit`만 전달되고 representative/area_access/hold에는 부여되지 않는 fixture.
- 시장·거리·골목 포함과 시설·개별 점포·도매/새벽·장기 이용 제외 fixture.
- 10:00, 18:00 경계 데이터 값, 원본 등급·운영시간·체류·좌표 불변, 카카오 API 호출 0 검증.

## 수정 범위와 금지

`data/`, `scripts/build_*.mjs`, `src/data/`, 데이터 계약 테스트, `docs/02_data/` 감사, 이 작업 기록만 수정한다. 추천 엔진, UI, API 어댑터, 제품 정책, 보드는 수정하지 않는다.

## 완료 인계

적격/제외 수와 IDs, 공개 field 스키마, 변경하지 않은 대표 데이터 경계, 실행 테스트, 2-Q/U-RESULTS-03에 필요한 provider 예시 fixture를 이 문서에 남긴다.

---

## 2026-08-31 — DATA-MARKET-01 완료 인계

### 변경 파일·목적

- `scripts/build_conditional_market_candidates_audit.mjs`, `data/processed/review/조건부_시장거리_발견후보_감사.json`: `conditional_more` 178개만 보존 근거로 감사해 `conditional_visit` 142개·제외 36개를 재현 가능하게 기록했다.
- `scripts/build_runtime_poi_catalog.mjs`, `src/data/busan_poi_catalog.json`: 적격 장소에만 `conditionalVisit { kind, displayWindow: 10:00–18:00, requiresUserHoursConfirmation: true }`를 투영했다.
- `src/data/courseV1CandidateProvider.ts`: 기존 대표·area discovery provider와 분리된 `listConditionalVisitCandidates()` 및 전용 타입을 추가했다.
- `test/conditional-market-candidates.test.mjs`, `test/course-v1-candidate-provider.test.ts`, `docs/02_data/조건부_시장거리_발견후보_감사.md`: 감사·runtime·provider 계약과 요약을 추가했다.

### 결과·유지 경계

- 적격은 시장 134개·거리/골목 8개다. 36개는 시설/비권역 20, 비시장·거리 권역 6, 도매·새벽·수산/유통 전문 6, 산책로 2, 예약·장기 이용 불확실 2로 제외했다.
- 대표 190, `area_access` 2, 기존 classification, 운영시간 원문, 체류·좌표·사진·원천, 실제 경로·카카오 호출·엔진/UI/API adapter/보드는 변경하지 않았다.
- `conditional_visit`는 10:00–18:00 제품 탐색 창과 사용자 운영시간 확인 필요만 뜻한다. 자동 대표·검증 대안 후보 큐에 들어가거나 실제 영업시간으로 해석되면 안 된다.

### 테스트 결과

- `node scripts/build_conditional_market_candidates_audit.mjs && node scripts/build_runtime_poi_catalog.mjs` — 조건부 178, 적격 142, 제외 36.
- `node --test test/conditional-market-candidates.test.mjs` — 3/3 통과.
- `npx tsx --test test/course-v1-candidate-provider.test.ts test/conditional-market-candidates.test.mjs` — 8/8 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 140 통과, 1 skip, 0 실패.
- `npm test` — 1/1 통과.
- `git diff --check` — 공백 오류 없음.
- 실제 API·GPS·Auth·DB 호출 — 0회.

### 다음 인계

- 2-Q는 이 provider 출력을 대표/검증 대안 큐와 분리하고, U-RESULTS-03은 제품 창 안에서만 정보 확인 카드를 렌더링해야 한다. 명시 사용자 확인 전 route 호출은 0회여야 한다.
- 사용자 확인 뒤의 조건부 수동 계산은 `운영시간 확인 필요(사용자 확인)` 상태를 보존한다. 이번 데이터 필드만으로 그 계산·저장·화면 승격을 구현하면 안 된다.
