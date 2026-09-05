# 2-AB — 서브카테고리 사용자 체류 개인화 순수 계산

> 상태: **추천 엔진 구현 완료·통합 전**
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
11. `docs/03_product/추천로직.md`와 `docs/테스트.md`는 통합·결정 단일 작성자 파일이므로 수정하지 않는다. 구현 결과로 상태 변경이 필요하면 정확한 문구·테스트 근거를 완료 인수인계에 남긴다.

## 수정 금지 경계

- UI, DB migration/repository, App Intent, 알림을 수정하지 않는다.
- `docs/작업조정_보드.md`, `docs/테스트.md`, `docs/03_product/추천로직.md`, UIUX 공통 규칙을 수정하지 않는다.
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

## 2026-09-04 완료 인계

### 변경 파일과 목적

- `src/engine/dwellPersonalization.ts`: DB·React·network 없는 공개 순수 산출기를 추가했다. 정확한 `(category, subCategory)` 유효 표본만 필터링하고, 최신 최대 5건 중앙값→5분 반올림→기본 권장 ±10분→장소 min/max 순으로 제한한다.
- `src/engine/courseV1.ts`: `CourseV1Candidate` 선택적 `category`/`subCategory`, `CourseV1Input.dwellPersonalizationSamples`, 적용 stop의 `dwellPersonalization` snapshot을 추가했다. 기존 최소 체류 snapshot을 먼저 검증한 뒤 같은 exact legs에서만 목표를 feasible clamp하고, 최종 실패는 기존 snapshot으로 돌린다. 정렬은 비개인화 `baselineStayMin`/상태를 1차 기준으로 유지하고 개인화 목표 달성은 동률 보조 순위에서만 쓴다.
- `src/engine/index.ts`: `deriveDwellPersonalizationV1` 및 `DwellPersonalizationInputV1`/`ResultV1`/`SampleV1` 타입을 공개 export했다.
- `test/dwell-personalization.test.ts`: 순수 산출 요구의 실패 우선 fixture 4개를 추가했다.
- `test/dwell-personalization-course.test.ts`: one-stop/pair 적용·각 형태의 예산/운영 종료 clamp·복합 키 격리·byte-equivalent off·정렬·route/ledger 불변 fixture 8개를 추가했다.

### 유지한 계약

- 이전 방식: 카탈로그 기본 `recommendedStayMin`만 적용→관찰: 같은 활동 복합 키의 명시 완료 체류가 쌓여도 반영할 순수 경계가 없음→교체: 제한된 중앙값 목표를 기존 allocator의 soft override로만 적용→이유: 사용자 경험을 반영하되 route·운영시간·최소 체류·도착 여유를 약화하지 않기 위함→상태: **추천 엔진 구현 완료·통합 전**.
- 개인화는 후보 자격·수·사전선정·검증 queue를 바꾸지 않는다. first/page attempt 8, pair 16/12/36, continuation 구조, cache, route adapter 호출 예산을 유지했다.
- 개인화 없음, `subCategory` 누락, 유효 표본 3건 미만, 오염 표본은 선택 장소·시간·stop 상태가 비개인화 snapshot과 byte-equivalent하다. 장소명·상위 category로 `subCategory`를 추정하지 않는다.
- one-stop/pair는 검증된 방문 순서, exact legs/geometry, 도착/출발 시각, 총예산과 attempt ledger를 유지한다. 개인화로 후보를 탈락시키거나 route/API를 재호출하지 않는다.
- `docs/03_product/추천로직.md`, `docs/테스트.md`, `docs/작업조정_보드.md`, UI, DB, service/API, catalog/data, env는 수정하지 않았다. 다른 세션 변경을 되돌리지 않았고 stage·commit·push하지 않았다.

### 테스트 결과

- 실패 우선: 순수 fixture는 구현 모듈 부재로 1개 파일이 실패했고, 통합 fixture는 개인화 미연결로 3/4 실패했다. 동률 보조 순위 반례는 초기 구현의 대표 뒤집기(`b-slow`)를 재현한 뒤 수정했다.
- `npx tsx --test test/dwell-personalization.test.ts test/dwell-personalization-course.test.ts`: **12/12 통과**.
- one-stop/pair/기존 course 대상 추천 엔진 회귀 7개 파일: **105/105 통과**.
- `npm run test:qa:v1`: **148개 중 147 통과, 기존 skip 1, 실패 0**.
- `npm run test:typecheck`: **통과**. 검증 중 다른 세션의 repository test가 구현 전 일시적으로 실패했지만, 해당 세션의 모듈 생성 후 재실행은 통과했다.
- `npm test`: **117/117 통과**.
- `npm run test:ui`: **259개 중 258 통과, 기존 skip 1, 실패 0**.
- `git diff --check`: **통과**. 실제 API·DB·GPS 호출은 **0회**다.

### UI·DB가 소비할 공개 타입

- DB/repository 역할은 시간순으로 정렬한 `DwellPersonalizationSampleV1 { category, subCategory, dwellMin }[]`만 recommendation session에 주입해야 한다. user ID·좌표·raw timestamp·repository 객체는 주입하지 않는다.
- 엔진 진입은 `CourseV1Input.dwellPersonalizationSamples` snapshot을 소비한다. 해당 session의 begin/continue 동안 같은 snapshot을 유지해야 한다.
- data provider 역할은 추정 없이 정제 카탈로그의 `category`/`subCategory`를 `CourseV1Candidate` 선택 필드에 전달해야 한다. 현재 provider는 이 역할 소유 경계때문에 2-AB에서 수정하지 않았으므로, 연결 전 production은 안전하게 `not_applied`다.
- `CourseV1Stop.dwellPersonalization` 은 적용 stop에만 `{ targetStayMin, baselineStayMin, baselineStayState }`를 남긴다. UI·저장은 이를 재계산하지 말고 엔진의 `stayMin`/시각 snapshot을 사용해야 한다.

### 다음 결정·위험과 중앙 문서 필요 문구

- **통합 순서**: data provider의 정확한 복합 키 투영과 DB/UI의 privacy-safe 표본 snapshot 주입이 먼저 통합되어야 production에서 적용된다. 이 전은 모든 장소가 기본 체류를 쓰는 fail-safe 상태다.
- **session snapshot 위험**: 표본이 begin/continue 사이에 바뀌면 같은 continuation의 뒤 페이지가 다른 체류 목표를 쓸 수 있다. UI/DB adapter는 추천 session 생성 시 표본을 동결하고 continuation에서 같은 메모리 snapshot을 재사용해야 한다. continuation JSON에 개인 표본을 넣지 않는다.
- `docs/03_product/추천로직.md` 필요 문구: **“동일 `(category, subCategory)`의 양의 유효 완료 체류 표본이 3건 이상일 때만 최신 최대 5건 중앙값을 5분으로 반올림하고, 기본 권장 ±10분 후 장소 min/max로 제한한 soft recommended를 쓴다. 최소 체류·exact route·운영시간·도착 여유를 먼저 확정하며, 목표가 맞지 않으면 같은 legs에서 feasible clamp 후 비개인화 snapshot으로 복귀한다. 개인화는 후보를 제거하거나 route/API·attempt 예산을 바꾸지 않고, 기존 안전성·이동 정렬이 같은 동률에서만 보조 순위로 쓴다.”** 상태는 data/DB/UI 연결 전까지 `구현 중`, 연결 검증 후 `현행`으로 올려야 한다.
- `docs/테스트.md` 필요 문구: 2-AB 항목에 **“2건은 기본, 3건부터 적용, 6건은 최신 5건만; 홀수/짝수 중앙값·5분 반올림·±10분→min/max 이중 clamp; category+subCategory 격리·missing/invalid 미적용; one-stop/pair 예산·운영 종료 feasible clamp·후보 0건 금지·route/API 0회 추가·순서/ledger 불변·비개인화 byte-equivalent”**를 관찰 결과로 등록해야 한다.
