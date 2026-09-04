# 2-AB — 서브카테고리 사용자 체류 개인화 순수 계산

> 상태: **진행 예정**
> 상위 결정: [DEC-LIVE-DWELL-01](../integration-decision/live-activity-dwell-personalization.md)

## 목적과 사용자 관찰

같은 서브카테고리에서 사용자가 실제로 확인한 완료 체류 표본이 최소 3개 쌓이면, 기본 체류 정책을 파괴하지 않는 제한된 개인화 값을 추천의 선택 체류와 보조 순위에 적용한다.

## 구현 명령

1. 네트워크·React·DB 없이 실행되는 공개 순수 함수의 실패 fixture부터 추가한다.
2. 입력은 `category`, `subCategory`, 카탈로그 기본 min/recommended/max, 시간순 유효 표본 배열이다. 개인화 키는 `(category, subCategory)` 복합 키다. 사용자 ID·좌표·raw timestamp·repository 객체를 엔진에 전달하지 않는다.
3. `subCategory`가 없거나 표본이 3개 미만이면 `not_applied`와 기본 recommended를 반환한다.
4. 3개 이상이면 최신 최대 5개만 선택해 중앙값을 계산한다. 짝수 개면 가운데 두 값의 산술평균이며, `Math.round(median / 5) * 5`로 가장 가까운 5분에 반올림한다. 전체 표본 평균·최빈값·랜덤·ML은 사용하지 않는다.
5. 기본 recommended 대비 조정폭을 `±10분`으로 제한한 뒤 장소 min/max 안으로 clamp한다. NaN·무한·0/음수·타 subCategory 표본은 유효 표본으로 세지 않는다.
6. 다른 category 또는 subCategory 표본을 모두 제외한 뒤 계산한다. 같은 `거리·골목` 문자열이어도 상위 category가 다르면 절대 섞지 않는다.
7. 이 값은 기존 체류 배정기에 soft recommended override로 전달한다. 먼저 기존 최소 체류·route·운영시간·도착 여유로 후보 가능성을 확정하고, 개인화 목표가 현재 schedule 안에 맞을 때만 선택 체류에 반영한다.
8. 1곳 또는 2곳에서 개인화 목표가 총예산·장소 운영 종료를 넘기면 기존 allocator의 feasible clamp를 사용하고, 그래도 맞지 않으면 같은 후보의 기존 비개인화 선택 체류 snapshot으로 되돌린다. 개인화 때문에 후보를 탈락시키거나 route/API를 다시 호출하지 않는다.
9. 개인화 off/프로필 없음/오염 profile이면 기존 비개인화 결과와 byte-equivalent한 장소 집합·시간 안전성을 유지한다.
10. 1곳 release entry와 사용자 명시 pair-only 2곳에서 각 stop의 해당 category+subCategory 프로필만 소비한다. 두 장소 프로필을 서로 섞거나 총 시간 예산을 초과하면 안 된다. pair는 이미 선택된 방문 순서와 exact legs·attempt ledger를 유지한 채 그 순서의 예정 시각·운영시간만 다시 확인하고, 맞지 않으면 기존 비개인화 선택 체류로 되돌린다.
11. `docs/03_product/추천로직.md`와 `docs/테스트.md`의 확정 계약을 구현 결과와 함께 갱신한다.

## 수정 금지 경계

- UI, DB migration/repository, App Intent, 알림을 수정하지 않는다.
- 후보 수, first/page attempt 8, pair 16/12/36 ledger, continuation, cache, route adapter 호출 수를 바꾸지 않는다.
- `subCategory`를 장소명·category로 추정하거나 합성하지 않는다.
- 카탈로그 min 20, recommended 30, max 60/120 자체를 사용자별로 덮어쓰지 않는다.

## 필수 반례 fixture

- `[20,30,120] → 중앙값 30`, 평균 57을 사용하지 않음.
- 서로 다른 세 값에서 mode 부재에도 결정적 결과.
- 2건 미적용, 3건 첫 적용, 4·5건 매 표본 갱신, 6건에서 최신 5개만 사용.
- 홀수/짝수 window 중앙값과 5분 반올림 경계.
- 기본 대비 ±10, 장소 min/max 이중 clamp.
- 다른 category/subCategory, 같은 이름·다른 상위 category, missing subCategory, invalid sample 제외.
- 개인화 때문에 후보 0건이 되지 않음.
- one-stop/pair에서 개인화 목표가 예산·운영 종료를 넘을 때 기존 feasible 선택 체류로 복귀하고 route/API 0회.
- one-stop/pair-only 시간 예산·순서·route attempt 회귀.

## 검증과 완료 인수인계

- 관련 순수 테스트, `npm run test:typecheck`, 엔진 전체, `npm test`, `git diff --check`를 실행한다.
- 실제 API·DB·GPS 호출은 0회다.
- 변경 파일과 목적 / 유지 계약 / 테스트 수와 결과 / UI·DB가 소비할 공개 타입과 잔여 위험을 이 문서에 기록한다.
- 사용자 요청 전 commit·push하지 않는다. 보드를 수정하지 않는다.
