# U-DIAG-SHAPE-02 — 다장소 unavailable 안전 사유 내부 표시

## 상태

구현 전. `2-T`와 `API-MULTISTOP-RECEIPT-02` 수락 뒤 수행하는 [통합 관찰 계약](../integration-decision/multistop-receipt-observability-contract.md)의 3단계다.

## 목적

정확한 internal diagnostics panel에서만 1·2·3곳의 `경로 확인 불가`를 아래 safe enum 건수로 풀어 보인다. 일반 사용자에게는 이유·패널·추가 설명을 노출하지 않는다.

`limited | in_flight | store | provider | transport | invalid_response | rejected | unknown`

이 작업은 오류를 고치거나 추천 수·호출 수를 바꾸지 않는다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. [통합 관찰 계약](../integration-decision/multistop-receipt-observability-contract.md), [2-T](../recommendation-engine/receipt-unavailable-reason-contract.md), [API-MULTISTOP-RECEIPT-02](../external-api/multistop-receipt-reason-mapping.md)
3. `src/ui/recommendation/recommendationInternalDiagnosticsModel.ts`, `src/ui/recommendation/RecommendationInternalDiagnostics.tsx`, `test/ui/recommendation-internal-diagnostics-model.test.ts`

## 사전 확인

다음 세 가지를 읽기 전용으로 확인한다.

1. `RecommendationInternalDiagnostics`가 exact `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'`일 때만 조립·렌더되는지
2. engine의 `shapeDiagnostics[1|2|3].unavailableReasonCounts`가 장소/좌표/URL/provider 원문 없이 숫자 map만 가지는지
3. API-MULTISTOP-RECEIPT-02가 `in_flight` status 우선과 local/missing `unknown`을 fixed fixture로 통과했는지

하나라도 다르면 수정·실기기 QA를 시작하지 않고 통합·결정에 인계한다.

## 구현 명령

1. UI model에 각 shape의 `unavailableReasonCounts`를 **non-zero safe enum만** 별도 배열로 투영한다. 0값은 표시하지 않아 진단 화면이 불필요하게 길어지지 않게 한다.
2. 레이블은 내부 진단용으로 다음처럼 고정한다.
   - `limited` → `제공사 한도`
   - `in_flight` → `동일 경로 처리 중`
   - `store` → `경로 저장소`
   - `provider` → `경로 제공사`
   - `transport` → `경로 통신`
   - `invalid_response` → `경로 응답 형식`
   - `rejected` → `경로 요청 거절`
   - `unknown` → `안전상 원인 미확인`
3. `RecommendationInternalDiagnosticsPanel`에서 각 `N곳 코스`의 기존 `경로 확인 불가` 바로 아래에, non-zero 사유가 있을 때만 `확인 불가 사유` 제목과 숫자를 표시한다. 다른 shape/tier/결과 탈락·일반 카드·CTA·정렬·네비게이션은 불변이다.
4. UI는 reason을 새로 추론하거나 API 응답을 읽지 않는다. model 입력에 없는 값, 음수·정수가 아닌 값, 허용 enum 밖 key는 `안전상 원인 미확인`으로 임의 합산하지 말고 표시하지 않는다. 이 경우 engine의 `unknown`만 신뢰한다.
5. model test를 고정한다.
   - 2곳 `provider: 1`, `in_flight: 2`만 있는 fixture → 두 label/value만, zero 6종 미표시
   - 사유 map 없음/모두 0 → `확인 불가 사유` 섹션 0개
   - invalid key/음수/소수 → 미표시
   - 기존 shape-only, diagnostics disabled, 금지 필드 비노출 회귀 유지

## 경계

- 수정 가능: `src/ui/recommendation/`, 관련 UI/model test, 이 문서.
- 수정 금지: `src/engine/`, `src/services/`, Edge, 데이터, DB, `.env*`, 일반 사용자 문구·추천 정책·호출 한도·보드.
- 실제 API/GPS/DB/카카오맵 호출과 internal build/실기기 QA는 이 작업에서 하지 않는다.
- 장소명/ID·좌표·주소·URL/query·provider 원문·cache key·JWT/token·사용자 ID·API key는 타입·model·화면·테스트 출력에 금지한다.

## 완료 기준과 다음 단계

- 사전 확인 결과와 model/UI test, `npm run test:typecheck`, `npm run test:ui`, `git diff --check`를 기록한다.
- 성공 뒤에만 QA가 **새 A8 internal build**에서 서면 복귀와 사상→서면을 각각 1회 실행한다. 필요한 환경값은 기존 두 개뿐이다.

```text
EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true
EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12=false
```

- 새 환경값은 추가하지 않는다. 환경값 변경이 없다면 Metro clear/Xcode 재빌드는 이 UI code 변경을 실제 기기에 반영하는 목적에서만 필요하다.

---

## 2026-09-02 — U-DIAG-SHAPE-02 완료 인계

### 사전 확인과 판정

1. `ResultsScreen`은 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'`일 때만 `RecommendationInternalDiagnosticsPanel`을 조립하며, 기존 internal 환경 비교는 그대로다.
2. engine `shapeDiagnostics[1|2|3].unavailableReasonCounts`는 허용 enum의 숫자 map만 가진다. 타입·주석과 2-T 완료 fixture가 장소·좌표·URL·provider 원문을 보관하지 않음을 확인했다.
3. API-MULTISTOP-RECEIPT-02 완료 기록의 31개 고정 contract test에서 `status: in_flight` 우선과 receipt 누락/local `unknown`이 통과한 것을 확인했다.

세 조건이 모두 충족되어, UI model·exact internal panel의 투영만 최소 범위로 보완했다.

### 1. 변경 파일과 목적

- `src/ui/recommendation/recommendationInternalDiagnosticsModel.ts`: shape별 unavailable safe enum을 non-zero 정수만 내부 진단용 한국어 label/value 배열로 투영했다. 누락·0·음수·소수·허용 밖 key는 표시하지 않는다.
- `src/ui/recommendation/RecommendationInternalDiagnostics.tsx`: 각 `N곳 코스`의 기존 `경로 확인 불가` 바로 아래에 사유가 있을 때만 `확인 불가 사유`를 표시했다.
- `test/ui/recommendation-internal-diagnostics-model.test.ts`: 2곳 `in_flight: 2`·`provider: 1` 투영, map 없음/0/오염값 미표시 및 기존 shape/flag 회귀를 고정했다.
- 이 문서: 사전 확인과 완료 인계를 기록했다.

### 2. 유지한 공개 계약·정책 경계

- 일반 사용자 결과 카드·문구·CTA·정렬·네비게이션은 바꾸지 않았고, exact internal panel 밖에는 새 진단을 렌더하지 않았다.
- UI는 API 응답·오류를 읽거나 reason을 추론하지 않으며, engine의 `unknown` 외 값으로 임의 합산하지 않는다.
- 추천 엔진·API/service/Edge·호출 한도·환경값·데이터·DB·작업 조정 보드는 수정하지 않았다. 실제 API/GPS/DB/카카오맵 호출과 internal build/실기기 QA도 실행하지 않았다.
- 장소명/ID·좌표·주소·URL/query·provider 원문·cache key·JWT/token·사용자 ID·API key를 타입·model·화면·테스트 출력에 넣지 않았다.

### 3. 테스트 결과

- 구현 전 새 UI fixture 2건은 `unavailableReasons` 미투영으로 예상대로 실패했다.
- `npx tsx --test test/ui/recommendation-internal-diagnostics-model.test.ts` — 7/7 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 167 통과, 실패 0, 기존 skip 1.
- `npm test` — 113 통과, 실패 0.
- `git diff --check` — 통과.

### 4. 다음 결정·위험·재현 조건

- QA는 이 UI code 변경이 반영된 **새 A8 internal build**에서만 서면 복귀·사상→서면을 각각 1회 실행한다. 필요한 환경값은 기존 diagnostics=true, internalB12=false뿐이며 새 환경값은 없다.
- Metro clear/Xcode 재빌드는 환경값 변경 때문이 아니라 이 UI code를 기기에 반영할 때만 필요하다.
- `unknown`은 local/누락 경계를 뜻하므로 API 원인으로 단정하거나 재시도·추천 수·호출 상한을 바꾸는 근거가 아니다.
