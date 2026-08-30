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
