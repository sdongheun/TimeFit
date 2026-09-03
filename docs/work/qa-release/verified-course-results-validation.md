# QA-RESULTS-01 — 검증 대안·조건부 발견 결과 검증

## 상태

진행 예정. `2-Q`, `DATA-MARKET-01`, `API-PAGE-01`, `U-RESULTS-03`가 수락됐다. 고정 fixture/E2E는 지금 시작하며, 최소 실기기 항목은 이를 포함한 새 internal build 뒤에만 실행한다.

## 읽을 범위

`AGENTS.md` → `docs/README.md` → `docs/작업조정_보드.md` → `docs/테스트.md` REC-25~29·UX-22·DATA-25 → `docs/03_product/UIUX_테스트명세.md` UXV-20·42 → 각 완료 인계 → 이 문서.

## 고정 fixture 검증

1. 6개 생활권 × 45/78/120/180분 × 복귀/도착지에서 첫 8회, 조건부 16회, 큐 소진/전역 실패의 호출·reason·실제 시간표를 검사한다.
2. 이어보기 두 페이지에서 `continueLimitedRepresentativeCourseV1({ ...originalInput, continuation })`의 새 attempt ≤8, 새 코스 ≤3, 기존 카드 불변, shown/rejected 재검증 0, cache reuse와 총 화면 수 상한 없음을 검사한다. continuation JSON에 lat/lon·사용자 ID·Date·함수/provider 객체가 없고, candidate signature 불일치/ID 누락이면 `continuation_unavailable`·route 호출 0·기존 카드 유지가 되는 fixture/E2E를 추가한다.
3. 대표 1~2곳 우선, 3곳 대안 가능, 권장/짧게 가능, 중복·중첩 차단을 snapshot ID·legs·stay 상태로 비교한다.
4. `conditional_visit` 시장/거리/골목의 추천 시작 고정 시각 09:59/10:00/17:59/18:00 노출과 실제 확인 시각 09:59/10:00/17:59/18:00 경계를 분리한다. 확인 시에는 경과 시간을 차감하고, 18:00 이후·유효 시간 미달은 route 0·재추천 문구여야 한다. 출발/도착 중 가까운 쪽 거리순 첫 8개·다음 8개·중복 없음, 조건부 더 보기/지도 열기 0 route, 제외 분류, 허용 확인 뒤 조건부 상태 보존을 fixture로 검사한다.
5. 공개 entry에 실제 mock adapter를 연결해 receipt/provider attempt/cache hit를 확인한다. 운영 Kakao 반복 호출은 금지한다.

## 최소 실기기 검증

고정 입력 한 개에서 대표·대안과 `다른 검증 코스 더 보기` 한 번, 조건부 카드의 카카오맵 scheme→fallback 한 번만 확인한다. 실제 provider 호출 수·네트워크·시간을 기록하되, 실패하면 원인을 UI/엔진/API/외부 제공사로 분리하고 반복 호출로 해결하려 하지 않는다.

## 2026-08-31 — QA-RESULTS-01 실행 기록

### 고정 fixture / 회귀

- `test/qa-results-verified-course-harness.test.ts`를 추가했다. 사상·서면·부산역·남포·광안리·해운대의 45/78/120/180분, 복귀/도착지 총 48개 고정 입력에서 대표·대안의 실제 legs와 첫 페이지 새 provider attempt 8회 이하를 확인했다.
- 같은 harness에서 첫 8회 뒤 16회 이내 보충, typed provider unavailable, candidate ID 누락 continuation의 `continuation_unavailable` 및 receipt route 0회를 확인했다.
- pagination/receipt/조건부 UI 경계를 함께 실행해 24/24 통과했다. `npm run test:typecheck`, `npm test`(150 pass, 기존 skip 1), `npm run test:ui`(150 pass, 기존 skip 1), `git diff --check`도 통과했다. 모두 고정 fixture/mock만 사용했으며 실제 외부 provider 호출은 0회다.

### 최소 실기기 — 실패 기록 (1회, 반복 금지)

- 새 iOS internal build를 설치·실행한 뒤 조건부 카드의 `카카오맵에서 확인`을 1회 실행했다.
- 관찰: 카카오맵 fallback 검색 화면이 장소명과 좌표를 합친 검색어로 열렸고, 장소를 찾지 못했다. 민감한 URL·좌표·키·토큰은 기록하지 않는다.
- 판정: **UIUX 외부 전환 실패**. 조건부 카드에 verified Kakao Place ID가 없는 경우 app scheme 실패 뒤 HTTPS 검색 fallback이 유효한 장소 결과로 이어지지 않는다. 엔진 추천·Route Proxy·조건부 수동 계산의 실패 근거는 아니며, 외부 제공사 재호출도 하지 않았다.
- 명세의 반복 호출 금지에 따라 이 시나리오는 재시도하지 않았고, `확인했어요, 이 장소로 코스 계산` 실기기 단계는 외부 확인 선행이 실패해 미수행으로 남긴다.

### 최소 실기기 — UIUX 수정본 재검증 (1회)

- UIUX가 verified Place ID 부재 fallback을 상세 주소 검색 또는 좌표 지도 보기로 교체한 새 internal build에서 조건부 카드의 `카카오맵에서 확인`을 1회 실행했다.
- 관찰: 주소 검색으로 해당 장소 위치가 표시됐다. 이전의 장소명+좌표 검색 실패는 재현되지 않았다.
- 판정: 외부 카카오맵 전환/장소 확인 단계는 **통과**. 이 관찰은 UIUX 수정본의 새 build에 한정하며, 외부 route/provider 재호출은 만들지 않았다.
- 남은 실기기 항목: 앱 복귀 뒤 `확인했어요, 이 장소로 코스 계산` 1회로 조건부 상태 라벨·기존 대표/대안 목록 보존을 확인한다.

### 최소 실기기 — 결과 화면 관찰

- 서면역 기준 15:00–17:00 입력에서 대표 추천 1개와 검증 대안 2개가 표시됐다.
- `다른 검증 코스 더 보기`는 표시되지 않았다. 이 버튼은 continuation이 `more_available`일 때만 보이므로, 이 세션은 추가 검증 후보가 없는 정상 종료 상태로 기록한다. 버튼을 억지로 노출시키거나 새 추천을 반복하지 않았다.
- 실기기 실행 시각은 조건부 노출 창(10:00 이상 18:00 미만) 밖이어서 시장·거리 등 `운영시간 확인 후 들러볼 곳` 카드가 표시되지 않았다. 이는 실제 시각 gate의 정상 동작이며, 이 실행에서는 조건부 CTA를 누를 수 없었다.
- 결과 입력의 15:00–17:00은 추천 시간표용 고정 입력이며, 조건부 카드 노출은 그 값이 아닌 실제 기기 시각을 사용한다.
- 따라서 조건부 수동 계산의 성공 상태·기존 목록 보존은 10:00–17:59의 별도 새 internal build 실기기 1회가 있어야 확인할 수 있다. 사용자가 2026-08-31 이 확인을 수행하지 않기로 결정했으므로, 현재 실행에서 시간 gate를 우회하거나 외부 호출을 반복하지 않았으며 이 항목은 **미검증 잔여 위험**으로 인계한다.

### QA 인계

1. **변경 파일과 목적:** `test/qa-results-verified-course-harness.test.ts`에 48개 고정 입력과 page/fail-closed receipt 검증을 추가했고, 이 문서에 결과를 기록했다.
2. **변경하지 않은 경계:** `src/ui/`, 엔진, API adapter, 카탈로그, 정책 문서, 작업 보드는 변경하지 않았다.
3. **테스트 결과:** 위 고정 fixture·전체 type/unit/UI 회귀는 통과했다. 실기기 카카오 fallback은 1회 실패했다.
4. **다음 결정·위험·재현 조건:** UIUX 수정본에서 주소 검색/지도 보기 외부 전환은 실기기 통과했다. 조건부 수동 계산 CTA의 성공 상태·기존 목록 보존은 사용자 결정으로 이번 출시 QA에서 미검증으로 남긴다. 재개한다면 10:00–17:59의 새 internal build에서만 1회 실행하며, 시간 gate 우회나 반복 외부 호출은 금지한다.

## 수정 범위와 금지

`test/`, fixture/E2E, QA 출시 문서와 이 문서만 수정한다. 제품 정책·엔진·UI·카탈로그·adapter 구현·보드는 수정하지 않는다.

## 완료 인계

시나리오 ID, fixture, attempt/cache receipt, 성공/실패, 캡처·로그 위치, 새 internal build 식별자, 미확인 외부 의존성을 이 문서에 남긴다.
