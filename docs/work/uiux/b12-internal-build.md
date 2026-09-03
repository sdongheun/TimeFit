# U-1-REC-02 — B12 internal build 조립·식별

## 선행 조건

`2-N` 수락 완료. engine barrel의 고정 `buildLimitedRepresentativeCourseV1ForInternalB12(input)`만 사용한다.

## 범위와 금지 경계

- 수정: `src/ui/`, UI 순수 테스트, 이 파일이 가리키는 UIUX 기록.
- 금지: `src/engine/` 정책·상한, API/Route Proxy/cache, 카탈로그·DB, navigation 흐름, 작업조정 보드.

## 구현 계약

1. recommendation session 조립 지점에서만 B12 entry를 선택한다.
2. exact `EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12 === 'true'` **그리고** `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'`일 때만 B12를 쓴다. 그 외 모든 값은 기본 A8이다.
3. 임의 정책·상한·queue parser, 사용자 토글, 저장값, 원격 설정을 만들지 않는다.
4. diagnostics가 보이는 internal build에서만 `내부 정책: B12` 또는 `내부 정책: A8`을 읽기 전용으로 표시한다. 일반 사용자 화면·접근성 tree에는 정책 문구가 없어야 한다.
5. 정책 선택은 계산 시작 전에 한 번만 한다. 재시도·cache 삭제·병렬 추천·추가 Route Proxy 요청, 결과 카드·CTA·저장·로그인·CAPTCHA·navigation 변경을 만들지 않는다.

## 필수 검증

- flag 네 조합 `(diagnostics, B12)`: `(true,true)`만 B12 builder 1회, 나머지는 A8 builder만 선택.
- B12/A8 fixture에서 엔진·화면 코스 수가 같고 policy label 외 카드·빈 상태·CTA·저장/navigation event·route port 호출 수가 같다.
- false/누락에서 B12 entry와 diagnostics accessibility label은 0개.
- 실제 session builder stub으로 builder 선택과 route port 호출 수를 검증한다.
- `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`; 실제 API/Auth/CAPTCHA/GPS 호출 0회.

## 완료 인계

변경 파일, flag 조합표, builder 선택 fixture, production 비노출, 실제 호출 0회를 남긴다. 수락 뒤에만 QA의 [RD-B12](../qa-release/b12-device-comparison.md)를 시작한다.

## 완료 인계 — 2026-08-30

### 변경 파일

- `src/ui/recommendation/recommendationInternalBuildModel.ts`: 두 public env의 exact 조합을 A8/B12 고정 정책으로 변환하고 internal label을 제공한다.
- `src/ui/recommendation/v1Session.ts`: 추천 시작 직전에 환경을 한 번 읽어 A8 또는 engine barrel의 고정 B12 entry 하나를 선택한다. 테스트 전용 builder/environment seam은 사용자 토글·저장값·원격 설정을 만들지 않는다.
- `src/ui/ResultsScreen.tsx`, `src/ui/recommendation/RecommendationInternalDiagnostics.tsx`: 이미 diagnostics가 표시되는 internal 화면에서만 `내부 정책: A8|B12`을 읽기 전용으로 추가했다.
- `test/ui/recommendation-runtime-boundary.test.ts`, `test/map-transport-ui-contract.test.mjs`: 네 flag 조합, builder 선택 3:1, route port 호출 수, internal label과 행동 추가 금지를 고정했다.

### 유지한 계약

- `2-N`의 engine B12 entry와 A8 정책·상한·queue는 수정하지 않았고, UI는 engine barrel의 두 고정 builder만 소비한다.
- diagnostics 또는 B12 flag가 false/누락이면 B12 entry·정책 label·diagnostics accessibility tree는 만들어지지 않는다. B12만 true이고 diagnostics가 false인 경우도 A8이다.
- 결과 카드·빈 상태·CTA·저장·navigation·로그인·CAPTCHA·Route Proxy/cache 및 실제 route port 계약은 변경하지 않았다. 실제 API/Auth/CAPTCHA/GPS 호출은 0회다.

### 테스트 결과

| diagnostics | B12 | builder | 결과 |
| --- | --- | --- | --- |
| true | true | B12 1회 | 통과 |
| true | false | A8 | 통과 |
| false | true | A8 | 통과 |
| 누락 | 누락 | A8 | 통과 |

- `npm run test:typecheck`, `npm run test:ui`, `npm test`(102/102), `git diff --check`를 통과했다.

### 다음 결정·위험

- 통합·결정 수락 뒤에만 QA가 [RD-B12](../qa-release/b12-device-comparison.md)를 internal build의 지정 두 입력에서 각 1회 실행한다.
- 그 전에는 cache 삭제·재시도·production 전환, A8 production 상한·tier 순서 변경을 하지 않는다. production build에는 두 internal flag를 `true`로 두지 않는다.
