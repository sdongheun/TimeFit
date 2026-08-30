# B12 internal 검증 묶음

## 상태

`2-M`, `2-N` **수락**. B12는 production 정책이 아니라 internal build 비교 후보이다.

## 확정된 공개 계약

- 기본 호출: `buildLimitedRepresentativeCourseV1(input)` — production A8, provider attempt 8회.
- internal 호출: `buildLimitedRepresentativeCourseV1ForInternalB12(input)` — B12만 고정, provider attempt 12회와 B queue.
- UI는 일반 정책 객체·8/12/16·A/B 값을 주입할 수 없다. A/B×8/12/16 matrix는 engine barrel 밖의 test-only 경계에만 있다.
- 두 entry는 운영시간·동일 `siteGroupId`·nested·W gate·T 최후순위·receipt fail-closed·adapter 24회·18개/5,220개/결과 9개 상한을 공유한다.

## 검증 근거

- M-01: A/B×8/12/16 비용 비교에서 B12는 최소 1+2곳 완결 검증 기회를 만들었다.
- M-02~M-04: 48개 시간·복귀/도착지 fixture, cache/reuse, route/운영/관계·W/T fallback 안전 gate를 검증했다.
- 기본 A8·고정 B12는 각각 해당 평가 결과와 전체 `deepEqual`이다.
- 기본 A8에 두 번째 정책 인자를 주는 호출은 typecheck에서 거절된다.

## 다음 handoff

UIUX는 [U-1-REC-02 작업](../uiux/b12-internal-build.md)에서만 B12 entry를 소비한다. 엔진 세션은 이 묶음에 새 정책을 추가하거나 production A8을 바꾸지 않는다.

## 이력 위치

상세 fixture와 수락 이력: [추천 엔진 archive](archive/2026-08-history.md)의 `2-M`, `2-N` anchor.
