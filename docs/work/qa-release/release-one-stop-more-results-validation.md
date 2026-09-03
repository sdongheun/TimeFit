# QA-ONE-MORE-01 — 출시 1곳 추천 이어보기 검증

## 상태

통합 수락. `2-V`와 `U-ONE-MORE-01`의 요청형 이어보기 계약을 고정 fixture 자동검증으로 통과했다. Simulator·실기기·실제 API 호출은 0회였으며, 다음 단계는 출시 UIUX 정리다.

## 목적

더보기 때문에 첫 결과가 느려지거나 검증되지 않은 장소가 섞이지 않으면서, 실제로 기존보다 많은 서로 다른 one-stop 선택지를 제공하는지 검증한다.

이 작업은 **고정 fixture 자동검증 전용**이다. QA 세션이 Simulator를 열어 화면을 직접 누르거나, 버튼 위치를 찾아 스크롤하거나, 캡처를 반복 수집하지 않는다. 실제 기기 체감은 자동검증 통과 뒤 통합·결정이 필요하다고 판단한 경우에만 사용자 수동 smoke 1회로 분리한다.

## 자동 검증

1. 고정 now/GPS/remaining/provider receipt fixture로 initial 8회와 page별 8회 상한, cache reuse 0회, page당 추가 최대 3개를 검증한다.
2. initial→page1→page2 전체 place ID 중복 0, 대표·기존 순서 불변, 모든 course one-stop/two-leg exact를 확인한다.
3. 후보 소진, 로컬 예산 소진+큐 잔여, typed provider unavailable, signature 불일치 상태와 UI 문구를 각각 확인한다.
4. 연타·상세 왕복·조건부 시장 더보기에서 잘못된 추가 route 호출이 없는지 검증한다.
5. 기존 release one-stop, 코스 카드/세로 상세, Route Proxy adapter, 조건부 시간 경계 테스트를 재실행한다.
6. initial 0건+`more_available` fixture에서 최종 실패로 닫히거나 자동 page 호출하지 않고, 명시 tap 뒤 첫 검증 코스를 대표로 표시하는지 확인한다.

## 실행 방식과 금지 경계

- 엔진·UI 모델·화면 컨테이너 seam에 고정 now/GPS/provider receipt를 주입해 명령 한 번으로 검증한다.
- 후보가 밀집한 두 입력은 Simulator launcher가 아니라 fixture로 실행한다. initial과 page 2회까지의 카드 ID, continuation, 신규 attempt, cache reuse, page state를 구조화 결과로 비교한다.
- QA 세션은 Simulator/실기기를 실행·조작하지 않는다. 화면 버튼을 하나씩 누르기, 스크롤 탐색, 반복 캡처, Metro 재시작, 앱 삭제·재설치, Xcode build는 이 작업 범위에 포함하지 않는다.
- 실제 Kakao·CAPTCHA·GPS 호출도 하지 않는다. 실제 체감 확인이 필요하면 QA 완료 인계에 사용자 수동 smoke 입력과 관찰값만 최대 1개 제안하고, 직접 실행을 시작하지 않는다.

## 합격 기준

1. 첫 결과 신규 attempt ≤8, 각 사용자 tap 신규 attempt ≤8, 자동 연속 page 호출 0.
2. fixture에서는 큐와 exact receipt가 충분할 때 첫 결과보다 고유 장소 수가 증가한다.
3. 밀집 fixture 2개 중 최소 1개에서 더보기 뒤 새로운 검증 장소가 1개 이상 추가된다. 추가되지 않으면 UI 성공으로 처리하지 않고 candidate/attempt/terminal receipt를 근거로 엔진 또는 API에 인계한다.
4. 검증되지 않은 장소, 조건부 시장, 중복 장소, 2·3곳 코스가 검증 대안에 섞이지 않는다.
5. 기존 카드와 코스 상세·길찾기 흐름에 회귀가 없다.

## 인수인계

변경한 QA 파일, 유지한 제품/엔진/API 경계, 자동 fixture 두 시나리오의 구조화 결과, 출시 차단 여부, 필요할 때 사용자에게 요청할 수동 smoke 최대 1개만 이 문서에 남긴다. 기능 코드와 Simulator 상태는 수정하지 않는다.

---

## 2026-09-03 — QA-ONE-MORE-01 완료 인계

### 1. 변경 파일과 변경 목적

- `test/qa-release-one-stop-more-results-harness.test.ts`: 고정 now/GPS/candidate/receipt만 사용하는 밀집 fixture 2개와 안전 종료 상태 fixture를 추가했다. initial→page1→page2의 호출 상한·선택 폭·중복·one-stop/two-leg 구조와 initial 0건 뒤 명시 page 승격을 엔진/UI seam에서 함께 검증한다.
- `test/qa-release-one-stop-harness.test.ts`: 수락된 typed provider unavailable terminal 계약에 맞춰 과거 QA 기대값을 후보 2건 순회에서 첫 unavailable 1건 즉시 중단으로 교정하고 실제 adapter 호출 1회를 고정했다.
- `docs/work/qa-release/release-one-stop-more-results-validation.md`: 자동 fixture 결과와 출시 판정을 기록했다.

### 2. 유지한 공개 계약·정책 경계

- `src/engine/`, `src/ui/`, `src/services/`, data/catalog, DB/Edge, 환경값, 제품 기준 문서와 `docs/작업조정_보드.md`는 수정하지 않았다.
- release initial/page의 신규 attempt 최대 8회, page 새 one-stop 최대 3개, 대표·기존 순서 불변, 자동 연속 page 0, candidate-to-candidate route 0, 조건부 시장 자동 승격 0을 그대로 검증했다.
- 실제 Kakao·CAPTCHA·GPS·DB·Route Proxy 호출은 0회다. Simulator·실기기·Metro·Xcode를 실행하거나 조작하지 않았다.

### 3. 두 밀집 fixture 구조화 결과

| fixture | initial | page 1 | page 2 | 누적 고유 장소 | 중복 | reuse | 관찰 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dense-a` exact 18개 + 조건부 1개 | course 4 / attempt 8 | 새 course 3 / attempt 6 | 새 course 3 / attempt 6 | `4 → 7 → 10` | 0 | 0 | page 2 뒤에도 `more_available`; 조건부·다장소 0, 모든 course two-leg exact |
| `dense-b` 첫 후보 8개 no-route + 뒤 exact 10개 | course 0 / attempt 8 | 명시 page 뒤 새 course 3 / attempt 6 | 실행하지 않음 | `0 → 3` | 0 | 0 | initial은 최종 실패/자동 page 없이 `more_available`; 첫 새 course가 대표로 승격 |

- `dense-a` adapter receipt는 initial/page1/page2 합계 20회이고 모두 신규 attempt로 집계됐다. 조건부 ID는 continuation과 결과 모두에 없으며 candidate-to-candidate pair도 0이다.
- `dense-b`는 initial 직후 adapter 8회에서 멈춰 사용자 행동 없는 자동 page가 0임을 확인했다. 명시 page 뒤 합계 14회가 되었고 대표 1+대안 2가 생겼다.
- 별도 상태 fixture에서 signature 불일치는 route 0의 `continuation_unavailable`, typed provider 종료는 `provider_unavailable`, 큐 소진은 `exhausted`이며 각각 확정 UI 문구로 투영됐다.
- 기존 UI fixture에서 같은 tick 연타는 page 호출 1회, 빈 `more_available` page는 자동 재호출 0, 카드 상세는 route 0, 조건부 로컬 더보기와 검증 더보기는 서로 다른 testID·호출 경계를 유지했다.

### 4. 자동 테스트 결과

- QA-ONE-MORE-01 전용 하네스: 3/3 통과, 실패·skip 0.
- 지정 회귀 묶음(one-stop initial/page, UI append/종료/연타, 카드·세로 상세, Route Proxy adapter/page budget, 조건부 시간 경계): 79/79 통과, 실패·skip 0.
- 최초 지정 회귀 실행에서 과거 `QA-RELEASE-ONESTOP-01` fixture 1건이 typed provider unavailable을 2회 순회할 것으로 기대해 78/79로 실패했다. 현행 terminal 계약대로 QA 기대값과 호출 횟수를 교정한 뒤 79/79 통과했다. 기능 코드는 변경하지 않았다.
- `npm run test:typecheck`: 통과.
- `npm test`: 113/113 통과, 실패·skip 0.
- `npm run test:ui`: 192건 중 191 통과, 기존 철회 이력 1 skip, 실패 0.
- `git diff --check`: 통과.

### 5. 출시 판정과 남은 위험

- **QA-ONE-MORE-01 자동 게이트 통과, 이 작업으로 인한 출시 차단 없음.** 두 밀집 fixture 모두 첫 결과보다 고유 검증 장소 수가 증가했고 호출·형태·중복·조건부 경계를 만족했다.
- 이번 작업은 고정 fixture 계약만 증명한다. 실제 provider 공급량·네트워크 지연·native 스크롤/VoiceOver 체감은 증명하지 않지만, 현재 결과만으로 추가 사용자 수동 smoke를 요청하지 않는다.
- 앱 프로세스 종료 뒤 메모리 continuation 소실은 기존 수락 계약이며 이번 자동 게이트의 신규 위험이 아니다.

---

## 2026-09-03 — 통합 수락

- 새 QA 하네스가 `dense-a`의 `4 → 7 → 10`, `dense-b`의 `0 → 3` 고유 one-stop 증가를 재현했고 initial/page 신규 attempt 최대 8회, page 새 결과 최대 3개, 중복·조건부·다장소 0을 확인했다.
- 과거 QA fixture의 provider unavailable 기대값 변경은 현행 terminal 계약과 일치하는 테스트 교정이다. 제품·엔진·UI·API 코드는 변경하지 않았다.
- 통합 세션 독립 실행에서 관련 QA·엔진·UI·adapter 회귀 72/72, `npm test` 113/113, `npm run test:typecheck`, `git diff --check`가 통과했다.
- 이 기능을 위해 QA 세션이나 사용자에게 별도 Simulator/실기기 확인을 요구하지 않는다. 다음 출시 후보 수동 smoke에서 버튼 표시·누적·상세 왕복을 한 번만 합쳐 확인한다.
