# U-DIAG-SHAPE-01 — 공개 추천 형태 진단 표시

## 상태

구현 전. `QA-UX-CORE-01`에서 네 생활권 모두 1곳 코스만 보였지만, production A8 결과 화면의 내부 진단은 B12 tier만 표시할 수 있어 1/2/3곳 후보의 실제 시도·탈락을 분리할 수 없다.

## 목적

일반 사용자 UI·추천 정책을 바꾸지 않고, 정확한 internal build에서만 production 기본 entry의 **안전 집계**를 표시한다. 이 값으로 “다장소 후보가 queue에 없었는지 / 시도했지만 경로·시간에서 탈락했는지”를 다음 QA 한 번으로 구분한다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `src/ui/recommendation/recommendationInternalDiagnosticsModel.ts`, `RecommendationInternalDiagnostics.tsx`
3. `src/engine/courseV1.ts`의 `CourseV1ShapeDiagnostics`
4. [핵심 UX 결과](../qa-release/core-user-experience-review.md), [형태 다양성 회복](../recommendation-engine/verified-course-shape-diversity.md)

## 필수 사전 확인 — 수정 전에 끝낼 것

아래를 **읽기 전용**으로 확인하고 작업 기록에 남긴다. 이 단계에서 일반 UI나 환경값을 바꾸지 않는다.

1. internal build 조립 경로에서 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS`가 정확히 `'true'`일 때만 `ResultsScreen`의 내부 panel이 렌더되는지 확인한다. production shape 관찰 build에서는 `EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12`가 없거나 `'true'`가 아니어야 한다. 값이 없거나 다른 문자열이면 그 상태를 먼저 보고하고 코드 수정·QA 실행을 중단한다.
2. production 기본 entry `buildLimitedRepresentativeCourseV1`의 결과에 `diagnostics.shapeDiagnostics`가 실제로 붙는 고정 unit fixture를 확인한다. 2-S-R fixture 또는 동등한 기존 fixture로 1·2·3곳 안전 집계가 생성됨을 증명한다.
3. 현재 `recommendationInternalDiagnosticsModel`이 `verificationTiers`만 투영하고 `shapeDiagnostics`를 반환하지 않는지 unit test 또는 코드 기준으로 확인한다.

**판정:** 1·2가 통과하고 3이 확인되면, 이는 설정 누락이 아니라 internal panel의 투영 누락이다. 그때만 아래 최소 구현으로 진행한다. 1 또는 2가 실패하면 여기서 종료하고, 설정/엔진 소유 경계에 인계한다.

## 조건부 구현 명령

사전 확인의 세 조건이 충족된 경우에만 다음을 수행한다.

1. `diagnostics.shapeDiagnostics`가 있을 때만 내부 model에 `1곳`, `2곳`, `3곳`별 섹션을 추가한다. 각 섹션은 아래 숫자만 표시한다.
   - `큐 후보`, `시도`, `검증`, `시간 예산 초과`, `경로 미검증`, `경로 확인 불가`
2. 장소명·ID·좌표·주소·route URL·provider 원문·cache key·토큰·사용자 정보는 model/화면에 절대 넣지 않는다.
3. `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'`인 기존 internal panel 외에는 렌더하지 않는다. 일반 결과 카드·문구·정렬·버튼·네비게이션은 불변이다.
4. 기존 B12 tier 진단은 그대로 유지한다. production 기본 entry는 tier 값이 없어도 shape 값과 총 요청 집계가 있다면 안전하게 보일 수 있어야 하며, 값이 둘 다 없으면 빈 섹션을 만들지 않는다.
5. model unit/contract test로 다음을 고정한다.
   - shape 값이 없는 일반 결과: 새 섹션 0개, 기존 모델과 동등
   - production shape 값만 있는 결과: 세 형태의 숫자가 정확히 투영
   - diagnostics disabled: panel 자체 미렌더
   - 금지 필드가 타입/model/표시에 존재하지 않음

## 경계

- 수정 가능: `src/ui/recommendation/`, 해당 UI/model test, 이 문서.
- 수정 금지: `src/engine/`, 추천 정책, API·cache·호출 상한, data, DB, `.env*`, 보드.
- 새 환경변수·실제 API 호출은 만들지 않는다.

## 완료 기준

- 사전 확인 1~3의 결과와 판정을 먼저 기록한다. 설정/엔진 경계 실패라면 수정 없이 종료한다.
- 조건부 구현을 했다면 관련 UI/model 테스트, `npm run test:typecheck`, `npm run test:ui`, `git diff --check`를 기록한다.
- 새 internal build가 필요한 이유를 인계에 남긴다.
- `QA-SHAPE-01` 시작 전 화면 정책 표기가 `A8`이고 1·2·3곳 shape 섹션이 보이는지 확인하는 조건을 인계에 남긴다.
- 다음 `QA-SHAPE-01`은 이 build에서만 시작한다.

---

## 2026-09-02 — U-DIAG-SHAPE-01 완료 인계

### 사전 확인과 판정

1. `.env.local`에서 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS`가 정확히 `'true'`인 것을 비밀값 없이 확인했다. `ResultsScreen`은 같은 exact 비교가 참일 때만 internal panel을 조립한다.
2. production 기본 entry `buildLimitedRepresentativeCourseV1`의 2-S/2-S-R 고정 fixture 50건에서 `diagnostics.shapeDiagnostics`의 1·2·3곳 queue·시도·검증 값이 생성되는 것을 확인했다.
3. 기존 `recommendationInternalDiagnosticsModel`은 `verificationTiers`만 투영하고 `shapeDiagnostics`는 반환하지 않았다.

세 조건이 모두 충족되어, 설정·엔진 문제가 아니라 internal panel의 투영 누락으로 판정하고 UIUX 최소 보완을 진행했다.

### 1. 변경 파일과 목적

- `src/ui/recommendation/recommendationInternalDiagnosticsModel.ts`: shape diagnostics가 있을 때만 1·2·3곳별 `큐 후보`·`시도`·`검증`·시간/경로 탈락 안전 집계를 투영했다. tier가 없어도 shape와 총 요청 집계가 있는 production 기본 결과는 안전하게 표시한다.
- `src/ui/recommendation/RecommendationInternalDiagnostics.tsx`: 기존 exact internal panel 안에만 형태별 섹션을 렌더했다. 일반 결과 카드·문구·정렬·CTA·네비게이션은 바꾸지 않았다.
- `test/ui/recommendation-internal-diagnostics-model.test.ts`: production shape-only, shape 없음, 금지 필드 비노출을 고정했다.
- 이 문서: 사전 확인, 판정과 완료 인계를 기록했다.

### 2. 유지한 공개 계약·정책 경계

- `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'` 외에는 panel을 렌더하지 않으며 새 환경변수는 만들지 않았다.
- 장소명·ID·좌표·주소·route URL·provider 원문·cache key·토큰·사용자 정보는 model과 화면에 넣지 않았다.
- 추천 엔진 정책·queue/호출 상한, API·cache, data, DB, 일반 결과 UI와 작업 조정 보드는 수정하지 않았다.

### 3. 테스트 결과

- 사전 engine fixture: `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts` — 50/50 통과.
- 모델 regression: `npx tsx --test test/ui/recommendation-internal-diagnostics-model.test.ts` — 5/5 통과. 구현 전 새 2개 검증은 예상대로 실패한 뒤 구현 후 통과했다.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 165 통과, 실패 0, 기존 skip 1.
- `npm test` — 113 통과, 실패 0.
- `git diff --check` — 통과.

### 4. 다음 결정·위험·재현 조건

- `QA-SHAPE-01`은 이 변경을 포함한 **새 internal build**에서만 시작한다. Expo public 환경값은 번들 시 주입되므로 기존 설치 build에는 새 panel이 나타나지 않는다.
- QA는 서면 복귀·사상→서면을 각 1회만 실행하고, 1·2·3곳의 queue/시도/검증/시간·경로 탈락 안전 숫자로 원인을 분리한다. 숫자만으로 다장소 코스를 강제하거나 추천 정책을 바꾸지 않는다.
- 현재 panel은 internal build의 개발용 정보이므로 일반 사용자에게 노출하면 안 된다. `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS`가 누락되거나 `'true'` 이외면 panel은 계속 숨겨야 한다.
