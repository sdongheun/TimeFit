# 추천 엔진 작업 기록

> 작성 역할: 추천 엔진  
> 용도: 추천 엔진 세션의 **작업 명령 → 작업 결과 → 인계 요청 → 통합·결정 피드백 → 다음 작업 명령**을 한 파일에서 시간순으로 누적한다. 통합·결정 세션은 이 문서만으로 구현 상태와 다음 작업을 판단한다.  
> 운영 책임: 추천 엔진 세션은 결과·테스트·인계 요청을 남긴다. **통합·결정 세션은 그 인계를 읽고 다음 담당 세션과 작업 범위를 이 파일에 지시한다.** 별도 작업 큐나 다음 명령 문서를 만들지 않는다.
> 기록 원칙: 정책을 여기서 확정하거나 기존 결정 문서를 대체하지 않는다. 정책 충돌·새 공개 계약은 근거와 함께 인계만 남긴다.

---

## 2026-08-24 — 현행 정책 정합성 감사

### 작업 결과

- 최신 런타임 카탈로그는 368개(`representative_core` 28, `representative_standard` 162, `conditional_more` 178)임을 확인했다.
- 기존 `planner.ts`는 분류 필터, 1~3곳 대표 코스, 차량 배제, 대표 단계 실제 경로, 구조화 운영시간, 검증 대안 상태를 구현하지 않아 현행 정책과 충돌함을 확인했다.
- 감사 상세와 증거는 [추천엔진_현행정책정합성_감사결과.md](../../../03_product/추천엔진_현행정책정합성_감사결과.md)에 보관한다.

### 유지한 경계

- 이 감사에서는 엔진·UI·DB·데이터 카탈로그를 수정하지 않았다.
- 현행 정책의 단일 기준은 `추천로직.md`, 요구 상태의 단일 기준은 `테스트.md`로 유지한다.

### 검증

- 카탈로그·근거 프로필 fixture 23건 통과
- 단일 장소 경로 fixture 22건 통과
- 기존 플래너 회귀 11건 통과
- 타입 검사 통과

### 통합·결정 인계

- 대표 코스 1개 계약, 조건부 수동 포함 상태의 저장 방식, 실제 경로 호출 상한, 발견성 입력 소유자는 엔진 단독으로 확정하지 않는다.

---

## 2026-08-24 — 점진적 전환 v1 순수 코스 엔진

### 변경 파일과 목적

- `src/engine/courseV1.ts`
  - 기존 장바구니·다수 후보 배치 플래너와 분리된 순수 대표 코스 v1을 추가했다.
  - 입력은 고정 현재 시각, 출발지, 도착지 또는 복귀, 1~180분 예산, 도착 여유, 후보, 구조화 운영시간, 실제 경로 adapter다.
  - 자동 대표 후보는 `representative_core`와 `representative_standard`만 허용한다. `conditional_more`와 `hold`는 대표 계산 전에 제외한다.
  - 1·2·3곳 순열을 결정적으로 검사하고, 동일 `siteGroupId` 조합을 제외한다.
  - 차량 타입을 두지 않는다. adapter는 `walk | transit`의 `exact: true` 경로만 수용하며, 실패·근사 폴백은 대표·대안에서 제외한다.
  - 각 장소의 실제 도착 시각부터 최소 체류 종료까지 구조화 운영시간을 판정한다.
  - 결과는 `representativeCourse | null`, `alternativeCourseIds`, `alternativeState`, 탈락 사유별 진단값을 반환한다.

- `src/engine/index.ts`
  - v1 입력·출력·adapter 타입과 조립 함수를 공개 export했다.

- `test/course-v1.test.ts`
  - 아래 고정 fixture 회귀를 추가했다.

### 새 입출력 계약

```text
buildRepresentativeCourseV1({
  now, origin, destination | null, remainingMin, arrivalBufferMin,
  candidates, routes,
})
  -> {
       representativeCourse | null,
       alternativeCourseIds,
       alternativeState:
         alternatives_available |
         no_alternative_verified_course |
         no_candidates,
       diagnostics,
     }
```

`CourseV1Candidate`에는 장소 분류, 최소·권장 체류, 구조화 운영시간, 관계 그룹이 필요하다. `CourseV1RouteAdapter`는 각 구간에 대해 실제 도보 또는 대중교통 경로만 반환해야 한다. `null`은 실패 또는 근사 결과이며 추천에 사용할 수 없다.

### 검증과 결과

| 고정 시나리오 | 관찰 결과 |
| --- | --- |
| 45분 왕복 | 대표 1곳, 조건부 후보 제외, 경로 없는 차량 전용 후보 제외, 대안 없음 상태 |
| 90분 별도 도착지 | 도착 구간과 10분 도착 여유를 포함해 1·2곳 비교 |
| 180분 | 1곳 3개, 2곳 6개, 3곳 6개 순열을 모두 평가; 3곳 강제 없음 |
| 운영 종료·경로 실패·관계 중복 | 대표·대안에서 제외하고 진단 사유에 기록 |
| 후보 없음·대안 없음 | `no_candidates` 및 `no_alternative_verified_course`를 결정적으로 반환 |
| 시간 경계 | 0분·181분 입력 거부 |

- `npx tsx --test test/course-v1.test.ts`: 6건 통과
- `npm test`: 69건 통과
- `npm run test:ui`: 61건 통과
- `npm run test:typecheck`: 통과
- `git diff --check`: 통과

### 아직 연결하지 않은 경계

- 앱 UI는 아직 v1 결과 모델을 소비하지 않는다.
- 현재 카탈로그와 구조화 운영시간 JSON을 `CourseV1Candidate`로 변환하는 data adapter는 데이터/외부 API 경계와 함께 연결해야 한다.
- 기존 `oneStopRouteService`의 TTL 캐시를 다구간 `CourseV1RouteAdapter`에 연결하는 작업은 API 어댑터 경계다.
- 조건부 후보의 사용자 명시 확인·저장·재조립, 완료 기록 기반 발견성, 진행 중 코스 변경 재조립은 v1 범위에서 의도적으로 제외했다.

### 다음 세션의 결정 및 재현 조건

1. **UIUX 세션**: `representativeCourse`, `alternativeCourseIds`, `alternativeState`를 대표 코스 1개·새 추천·대안 없음 화면 상태로 매핑한다. 기존 자유 장바구니 계약을 재사용하지 않는다.
2. **DB 세션**: 조건부 수동 포함을 도입할 때만 사용자 확인 상태·근거·재계산 결과의 저장 payload를 결정한다. v1 대표 코스에는 조건부 장소가 들어가지 않는다.
3. **API 어댑터 세션**: 후보를 사전 축소한 뒤 모든 코스 구간의 정확한 도보/대중교통 결과를 캐시해 주입한다. 실패·근사 폴백은 `null`로 전달한다.
4. **추천 엔진 후속**: data adapter가 준비되면 190개 대표 후보에서 작은 후보 풀을 선택하는 경계와 실제 경로 호출 상한을 고정 fixture로 먼저 결정한다.

---

## 2026-08-24 — 명령 2 시작 조건 확인: 인계 대기

### 확인 결과

`추천엔진_점진적전환_작업지침.md`의 명령 2 시작 조건을 코드·고정 산출물 기준으로 확인했다. 세 인계가 모두 준비되지 않아 연결 구현을 시작하지 않았다.

| 필요 인계 | 현재 근거 | 판정 |
| --- | --- | --- |
| 190개 대표 후보 변환 provider | 런타임 카탈로그에는 분류·체류·관계 필드가 있으나, `CourseV1Candidate`로 변환하며 구조화 운영시간·근거 만료 상태를 결합하는 provider가 없다. | 미준비 |
| 다구간 `CourseV1RouteAdapter` | `oneStopRouteService`는 한 장소의 두 구간 전용이다. `CourseV1RouteAdapter`에 맞는 다구간 도보/대중교통 캐시 adapter와 success/failure fixture가 없다. | 미준비 |
| 대표·새 추천 정확 경로 호출 상한 | 지침은 임의 숫자 사용을 금지한다. 기존 문서에는 과거 단일 장소의 최대 3곳 재검사 기록만 있고, 1~3곳 코스의 후보 코스 상한은 확정돼 있지 않다. | 미확정 |

### 유지한 경계

- `courseV1`에 카탈로그 JSON 직접 읽기·TourAPI/ODsay/TMAP 호출·임의 호출 상한을 추가하지 않았다.
- UI·저장·진행 화면을 수정하지 않았다.
- 외부 API를 호출하지 않았다.

### 통합·결정 및 담당 세션 인계

1. **데이터 정제**: `classification`, 최소·권장 체류, `siteGroupId`, 구조화 운영시간, 근거 만료 상태를 보존한 190개 `CourseV1Candidate` provider와 고정 fixture를 제공한다.
2. **외부 API 어댑터**: 좌표쌍·수단 TTL 캐시 키, 도보/대중교통 선택 규칙, 정확 경로 실패 시 `null` 반환을 포함한 다구간 adapter와 success/failure/cached fixture를 제공한다.
3. **통합·결정**: 대표와 새 추천에 실제 경로를 검증할 최대 후보 코스 수를 확정한다. 이 수는 API 호출량·캐시 정책·빈 결과 재시도 UX와 함께 기록해야 한다.

### 다음 작업

위 세 인계가 준비됐다는 기록을 확인한 뒤에만 명령 2의 통합 테스트와 얇은 조립 경계를 구현한다. 그전에는 기존 v1 순수 engine fixture만 유지한다.

---

## 2026-08-24 — 명령 2-B 재개 조건 재확인: 계속 인계 대기

### 확인 결과

점진적 전환 작업 지침의 명령 2-B에 따라 작업기록과 저장소의 공개 타입·fixture를 다시 대조했다. 명령 2-A에서 기록한 세 인계의 파일 경로·공개 타입·fixture 이름·호출 상한이 새로 제공되지 않았다.

- 190개 대표 후보를 구조화 운영시간·근거 만료 상태와 함께 변환하는 provider 없음
- 다구간 `CourseV1RouteAdapter` 구현 및 success/failure/cached fixture 없음
- 대표·새 추천의 정확 경로 후보 코스 호출 상한 없음

### 조치와 유지 경계

- 지침에 따라 엔진 코드, UI, 카탈로그를 수정하지 않았다.
- 기존 v1 순수 엔진과 고정 fixture를 그대로 유지한다.
- 외부 API 호출과 임의 호출 상한 설정을 하지 않았다.

### 다음 작업

데이터 정제·외부 API 어댑터·통합·결정 세션이 위 세 인계를 파일 경로와 계약으로 남긴 뒤에만 명령 2 통합 테스트를 재개한다.

---

## 2026-08-24 — 통합·결정 피드백 및 다음 명령 2-C: 인계 준비

### 통합·결정 피드백

- 순수 `courseV1`은 체감 검증용 v1의 안전 조건(대표 후보만 사용, 1~3곳, 차량 제외, 조건부 대표 제외, 정확 경로·구조화 운영시간 요구)을 구현했다.
- 아직 앱에 연결하지 않은 것은 결함이 아니라, 데이터 변환·다구간 실제 경로·호출 상한 계약이 없는 상태에서 추정 구현을 막기 위한 정상 경계다.
- 앞으로 추천 엔진 작업의 명령과 완료 결과는 이 파일에만 이어 쓴다. `추천엔진_점진적전환_작업지침.md`는 제품 방향 참고용이며 작업 큐가 아니다.

### 다음 명령 2-C

추천 엔진 세션은 새 코드부터 작성하지 않는다. 아래 인계가 이 파일 또는 담당 세션의 인수인계에 **파일 경로·공개 타입·fixture 이름**으로 기록됐는지 확인한다.

1. 데이터 정제: 최신 368개 중 `representative_core / representative_standard` 190개만 `CourseV1Candidate`로 변환하는 provider. `classification`, 최소·권장 체류, `siteGroupId`, 구조화 운영시간, 근거 만료 상태를 모두 보존해야 한다.
2. 외부 API 어댑터: 다구간 `CourseV1RouteAdapter`, 도보·대중교통 자동 선택, 좌표쌍·수단 TTL 캐시, 정확 경로 실패 시 `null`, success/failure/cached fixture.
3. 통합·결정: 대표 및 새 추천에 실제 경로를 검증할 최대 후보 코스 수(호출 상한).

셋 중 하나라도 없으면 누락 항목만 이 파일에 기록하고 종료한다. 같은 확인을 반복하거나, 카탈로그 직접 읽기·외부 API 직접 호출·임의 호출 상한을 엔진에 추가하지 않는다.

셋이 모두 준비되면 다음을 수행한다.

1. `courseV1`과 provider/adapter 타입을 대조하고, 근사값·문자열 운영시간·조건부 후보가 새 경계로 유입되지 않는지 확인한다.
2. 호출 상한 안에서만 후보 코스를 사전 축소하고, 대표·새 추천 코스의 모든 이동 구간이 `exact: true` 도보/대중교통인지 검증한다.
3. 45/90/180분, 왕복/별도 도착지, 1/2/3곳, 후보/대안 없음, 차량·조건부·근사 경로·운영시간 종료 제외를 고정 통합 테스트로 검증한다.
4. UI·저장·진행 화면은 수정하지 않는다. 통합 결과와 UIUX·DB 인계 계약을 이 파일에 남긴다.

---

## 2026-08-24 — 명령 2-C: 담당 인계 요청 발행

### 통합·결정 세션 요청 — 정확 경로 후보 코스 호출 상한

대표 및 새 추천에서 실제 경로를 검증할 최대 후보 코스 수를 확정해 작업 지침과 이 기록에 남겨야 한다. 수치만이 아니라 아래 계약이 함께 필요하다.

- 적용 범위: 첫 대표, 새 추천, 후보 상세 중 어느 흐름이 이 상한을 공유하는지
- 단위: 코스 수인지, 좌표쌍 수인지, 도보·대중교통 각각인지
- 캐시 적중 시 계산 방식과 TTL
- 상한에 도달했을 때의 결과: 대안 없음, 재시도, 또는 후보 없음 중 무엇인지
- 호출 실패·부분 성공 때 대표 및 새 추천의 상태

현재는 이 수치가 **미확정**이다. 추천 엔진은 임의 숫자를 코드에 넣지 않는다.

### 데이터 정제 세션 요청 — 대표 후보 provider와 fixture

다음 공개 계약을 제공해야 한다.

```text
CourseV1CandidateProvider.listRepresentativeCandidates()
  -> CourseV1Candidate[]
```

각 후보는 다음을 손실 없이 보존해야 한다.

- `id`, `title`, 좌표
- `classification` (`representative_core | representative_standard`만 반환)
- `minStayMin`, `recommendedStayMin`
- `siteGroupId`
- 구조화 운영시간: `status`, `alwaysAccessible`, `dayTypes`, `windows`
- 근거 만료 상태 및 만료 시 대표 후보 제외 여부

고정 fixture에는 총 368개 입력과 대표 190개, 조건부 178개, `hold`, 내부 장소, 운영시간 만료 사례를 포함해야 한다.

### 외부 API 어댑터 세션 요청 — 다구간 정확 경로 adapter와 fixture

다음 공개 계약을 제공해야 한다.

```text
CourseV1RouteAdapter.getRoute(from, to)
  -> { mode: 'walk' | 'transit', min, exact: true } | null
```

- 차량은 이 경계에 넣지 않는다.
- 좌표쌍·수단별 캐시 키와 TTL을 명시한다.
- 정확 경로가 없거나 근사 폴백이면 반드시 `null`을 반환한다.
- success, 한 구간 실패, 전체 실패, 캐시 적중 fixture를 제공한다.
- 엔진은 네트워크를 직접 호출하지 않고 이 adapter만 주입받는다.

### 추천 엔진 상태와 다음 작업

- v1 순수 코스 엔진은 준비돼 있으며, 위 provider·adapter·호출 상한을 받는 즉시 명령 2-B의 통합 테스트를 재개한다.
- UI·저장·진행 화면과 조건부 수동 포함·개인화는 여전히 이번 범위 밖이다.
- 명령 2-C 지시에 따라 새 인계가 기록되기 전까지 시작 조건 재확인을 반복하지 않는다.

---

## 2026-08-24 — 통합·결정 지시: 명령 2-D 데이터·경로 인계 구현

명령 2-C의 요청을 실제 다음 작업으로 분해한다. 아래 두 작업은 서로 독립적으로 수행하며, 추천 엔진 세션은 두 결과가 이 파일에 기록되기 전까지 재개하지 않는다.

### 2-D-1 — 데이터 정제 세션 지시: 대표 후보 provider

**목표:** 최신 런타임 카탈로그 368개에서 자동 대표 후보 190개만 안전하게 `CourseV1Candidate` 입력으로 변환하는 provider와 고정 fixture를 만든다.

1. `src/data/busan_poi_catalog.json`과 `data/processed/review/부산_장소_구조화_운영시간.json`을 결합하되, `representative_core / representative_standard`만 반환한다.
2. 각 반환 후보에 ID·좌표·분류·최소/권장 체류·`siteGroupId`·구조화 운영시간·근거 만료 상태를 보존한다.
3. `conditional_more` 178개, `hold`, 내부 장소, 근거 만료 장소는 반환하지 않는다.
4. 현재 시각을 주입할 수 있는 순수 provider로 만들고, 368/190/178 수·만료·조건부·내부 장소 경계를 고정 fixture 계약 테스트로 검증한다.
5. 런타임 카탈로그를 수동 편집하지 않는다. 생성/변환 경로와 테스트 결과를 이 파일에 인계한다.

### 2-D-2 — 외부 API 어댑터 세션 지시: 다구간 정확 경로 adapter

**목표:** `CourseV1RouteAdapter.getRoute(from, to)`에 주입할 도보·대중교통 전용 adapter와 캐시·fixture를 만든다.

1. 반환값은 `{ mode: 'walk' | 'transit', min, exact: true } | null`만 허용한다. 차량·직선거리·근사 폴백은 반환하지 않는다.
2. 좌표쌍·선택 수단별 캐시 키와 TTL을 명시한다. 캐시 적중, 한 구간 실패, 전체 실패, 성공 fixture를 제공한다.
3. 수단 자동 선택 규칙과, 정확한 도보·대중교통 결과를 모두 얻지 못했을 때 `null`을 반환하는 조건을 문서화한다.
4. 엔진의 순수 조립 함수에 네트워크·키·SDK 의존성을 넣지 않는다.
5. 실제 API 호출은 하지 않거나 소수 수동 검증으로 분리한다. 고정 fixture 계약 테스트와 파일 경로를 이 파일에 인계한다.

### 통합·결정 확정 — 정확 경로 호출 상한

대표와 새 추천을 위해 한 요청에서 실제 경로를 검증할 **최대 후보 코스 수**는 V1에서 **4개 후보 코스**로 확정한다. 이 상한은 코스 수 기준이며, 캐시 적중은 새 호출로 세지 않는다.

이는 초기 체감 검증을 위한 시작값이다. 실사용에서 새 추천의 다양성·응답 시간·호출량을 관찰한 뒤에만 수치를 조정한다.

### 추천 엔진 재개 조건

2-D-1과 2-D-2가 완료되고 호출 상한이 확정되면, 추천 엔진 세션은 `courseV1` 통합 테스트를 수행한다. 그 결과·테스트·UIUX/DB 인계는 다음 항목으로 이 파일에 기록한다.

---

## 2026-08-24 — 추천 엔진 확인: 명령 2-D 인계 대기

명령 2-D를 확인했다. `2-D-1`은 데이터 정제 세션, `2-D-2`는 외부 API 어댑터 세션의 소유 작업이다. 추천 엔진 세션은 다음 세 조건이 이 파일에 완료 결과로 기록될 때까지 해당 파일·계약을 직접 구현하지 않는다.

1. 190개 대표 후보 `CourseV1Candidate` provider와 368/190/178·만료·조건부·내부 장소 fixture
2. 다구간 도보/대중교통 정확 경로 adapter와 success/failure/cached fixture
3. 통합·결정 세션이 확정한 후보 코스 호출 상한

호출 상한은 V1에서 4개 후보 코스로 확정됐다. 2-D-1과 2-D-2의 완료 인계가 기록되면, 이 값을 적용해 다음 추천 엔진 명령으로 `courseV1` 통합 테스트를 실행한다.

---

## 2026-08-24 — 추천 엔진 상태 갱신: 호출 상한 수령, 2-D 인계 계속 대기

통합·결정 세션이 V1 정확 경로 후보 코스 호출 상한을 **4개 코스**로 확정했음을 확인했다. 이 값은 캐시 적중을 새 호출로 세지 않는 코스 수 기준이며, 이후 `courseV1` 통합 경계의 입력으로 사용한다.

그러나 현재 작업기록에는 다음 완료 인계가 아직 없다.

1. 2-D-1의 190개 대표 후보 provider·만료/조건부/내부 장소 fixture·테스트 결과
2. 2-D-2의 다구간 정확 경로 adapter·TTL 캐시·success/failure/cached fixture·테스트 결과

추천 엔진은 역할 경계에 따라 이 두 작업을 대신 구현하지 않는다. 두 인계가 이 파일에 기록되면 4개 코스 상한을 적용해 대표·대안의 실제 경로 통합 테스트를 수행한다.

---

## 2026-08-24 — 데이터 정제 인계 완료: 2-D-1 대표 후보 provider

### 제공 파일과 공개 계약

- `src/data/courseV1CandidateProvider.ts`
  - `createCourseV1CandidateProvider().listRepresentativeCandidates(now)`을 제공한다.
  - 런타임 368개와 구조화 운영시간 산출물을 결합해 `CourseV1Candidate`와 구조 호환되는 후보를 반환한다.
  - `id`, 제목, 좌표, `classification`, 최소·권장 체류, `siteGroupId`, `StructuredAvailability`, `evidenceReviewDueAt`을 보존한다.
  - `representative_core / representative_standard`만 통과시키며, `reviewDueAt < now`이면 제외한다. `conditional_more`, `hold`, 내부 장소는 반환하지 않는다.
  - 네트워크·경로 계산·후보 코스 호출 상한은 소유하지 않는다.

- `data/processed/review/코스V1_대표후보_provider_fixture.json`
  - 2026-08-24 고정 입력: 런타임 368, 대표 190, 조건부 178, hold 669개와 대표 ID·조건부 ID·내부 장소·만료 시 제외 ID·구조화 운영시간을 보존한다.
- `scripts/build_course_v1_candidate_provider_fixture.mjs`
  - fixture 재생성 경로다. 런타임 JSON을 수동 편집하지 않는다.
- `test/course-v1-candidate-provider.test.ts`
  - 368/190/178 수, 대표 분류·체류·운영시간 전달, 조건부·내부 장소 제외, 2026-11-22 근거 만료 제외를 검증한다.

### 검증

- `node scripts/build_course_v1_candidate_provider_fixture.mjs` — 대표 190 / 조건부 178 / hold 669
- `npx tsx --test test/course-v1-candidate-provider.test.ts` — 2/2 통과
- `npm run test:typecheck` — 통과

### 유지 경계와 다음 인계

- 추천 엔진, UI, 외부 API adapter, DB, 런타임 카탈로그 원천은 변경하지 않았다.
- 2-D-2의 다구간 정확 경로 adapter와 fixture가 이 기록에 추가되면, 추천 엔진 세션은 확정된 최대 4개 후보 코스 상한으로 통합 테스트를 재개할 수 있다.

---

## 2026-08-24 — 외부 API 어댑터 인계 완료: 2-D-2 다구간 정확 경로

### 제공 파일과 공개 계약

- `src/services/courseV1RouteAdapter.ts`
  - `createCourseV1RouteAdapter()`가 `CourseV1RouteAdapter`를 제공한다. 엔진에는 `getRoute(from, to) -> { mode: 'walk' | 'transit', min, exact: true } | null`만 주입된다.
  - 실제 TMAP 보행 결과가 14분 이하일 때 `walk`를 선택한다. 그보다 길거나 도보 결과가 없으면 실제 ODsay 대중교통 결과만 `transit`으로 선택한다. 차량은 이 경계에 없다.
  - TMAP 이외 도보 출처와 ODsay 이외 대중교통 출처(`haversine`, `transit_fallback`, `walk_short` 포함), 빈·오류 응답, 0분 이하 또는 정수가 아닌 시간은 모두 `null`이다. 따라서 근사 경로가 대표·대안으로 유입되지 않는다.
  - `courseV1RouteCacheKey(mode, from, to)`는 `course-v1:exact-route:v1:<mode>:<lat5,lon5>:<lat5,lon5>` 형식이다. 좌표쌍과 수단을 분리해 캐시한다.
  - 성공한 정확 경로 TTL은 24시간, 실패(`null`)의 음성 캐시 TTL은 5분이다. 같은 수단·좌표쌍의 진행 중 요청도 공유한다.
  - 기본 fetcher는 기존 TMAP/ODsay 호출·캐시 경계를 사용하되, 출처를 다시 검사한다. 엔진은 네트워크·키·SDK를 직접 알지 않는다.

- `test/fixtures/course-v1-route-adapter.fixture.ts`
  - 성공, 한 구간 실패, 전체 실패, 캐시 적중의 고정 좌표·응답 fixture를 제공한다.

- `test/course-v1-route-adapter.test.ts`
  - 도보 자동 선택, 먼 구간 대중교통 실패 시 `null`, 양 수단 실패 시 `null`, 좌표쌍·수단 캐시 키와 성공 24시간/실패 5분 TTL을 계약으로 검증한다.

### 검증

- `npx tsx --test test/course-v1-route-adapter.test.ts` — 4/4 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 61/61 통과
- `npm test` — 69/69 통과
- `git diff --check` — 통과

### 유지 경계와 다음 인계

- `courseV1` 순수 엔진, `src/engine/index.ts`, UI·저장·DB·런타임 카탈로그와 실제 외부 API 호출은 변경하지 않았다.
- 대표·새 추천은 확정된 최대 4개 후보 코스 안에서 이 adapter를 주입해 모든 구간을 검증할 수 있다. 후보 사전 축소와 통합 테스트는 추천 엔진 세션의 다음 작업이다.

---

## 2026-08-24 — 통합·결정 검토 및 다음 명령 2-E: 4개 코스 한정 통합

### 2-D 인계 검토 결과

2-D-1과 2-D-2는 다음 경계를 충족하므로 **수락**한다.

- provider는 런타임 368개에서 대표 분류 190개만 반환하고, 조건부 178개·내부 장소·근거 만료 장소를 반환 경계에서 막는다. `needs_review` 운영시간은 엔진의 구조화 운영시간 게이트에서 탈락하므로 대표 코스에 유입되지 않는다.
- route adapter는 TMAP 도보와 ODsay 대중교통의 실제 응답만 `exact: true`로 통과시키며, 차량·직선거리·폴백을 `null`로 격리한다. 성공 24시간·실패 5분 TTL과 캐시 fixture도 확인했다.
- 단, 두 인계의 단위 계약 테스트만 완료된 상태다. 190개 후보를 그대로 `courseV1`에 넣어 모든 1~3곳 순열을 경로 검증하는 것은 호출량과 응답 시간 면에서 허용되지 않는다. 이제 확정 상한 4개를 엔진 통합 경계에 실제 적용해야 한다.

### 2-E — 추천 엔진 세션 지시: 대표·대안 코스의 한정 정확 경로 통합

**목표:** provider와 route adapter를 주입받아, 한 요청에서 사전 선정한 최대 **4개 후보 코스**만 정확 경로로 검증하고 대표 1개와 실제로 다시 표시 가능한 대안을 반환한다. UI·저장·DB는 이번 작업에서 수정하지 않는다.

1. `src/engine/courseV1.ts` 또는 새 순수 조립 모듈에 명시적 입력 계약을 만든다. 입력은 `now`, 출발·도착/복귀, 1~180분, 도착 여유, provider 후보, route adapter, 그리고 고정 상한 `4`를 포함한다. 상한의 단위는 **순서가 정해진 후보 코스 수**다. 캐시 적중은 새 외부 호출로 세지 않지만, 후보 코스 상한을 넘겨 추가 검증하는 근거가 되지 않는다.
2. 실제 route adapter를 부르기 전에 순수한 사전 선정 단계를 둔다. 이 단계에서는 좌표·체류·분류·구조화 운영시간을 이용한 내부 근사/정렬은 허용하지만, 근사 시간이나 직선거리를 사용자 결과로 반환하거나 정확 경로 성공으로 취급하지 않는다. 1~3곳을 모두 허용하고, 같은 `siteGroupId`·중복 장소·조건부·hold·운영시간상 명백히 불가능한 조합은 사전에 제외한다.
3. 사전 선정된 순서 있는 코스는 최대 4개만 adapter로 검증한다. 각 코스의 모든 구간이 `exact: true` 도보/대중교통이고 권장 체류와 운영시간·도착 여유를 통과할 때만 검증 완료다. 차량·근사·한 구간 `null`은 해당 코스를 탈락시킨다. 4개를 모두 실패한 뒤에는 추가 후보로 조용히 확장하지 않는다.
4. 첫 화면용 대표은 검증 완료 코스 중 1개만 반환한다. 새 추천에 실제로 사용할 수 있도록 ID 목록만이 아니라 검증된 대안 코스의 장소·구간·시간 상세도 반환한다. 대표와 대안은 동일 장소 집합의 순서만 다른 중복이 아니어야 한다. 대표가 하나뿐이면 상태는 `no_alternative_verified_course`이며, UI가 “이 조건에서 다른 검증 코스가 없다”를 표시할 수 있는 근거를 남긴다.
5. 대표 후보 자체가 없을 때와, 후보는 있었으나 4개 이내 정확 경로·운영시간 검증을 통과한 코스가 없을 때를 결과 상태·진단에서 구분한다. 두 경우 모두 “조건부 더보기”를 대표 대체로 자동 사용하지 않는다.
6. 고정 통합 fixture와 테스트를 먼저 추가한다. 최소한 다음을 검증한다: 45/90/180분, 도착지 지정/복귀, 1·2·3곳 각각의 대표 가능성, 정확 경로 요청 대상이 4개 후보 코스를 넘지 않음, 4개 실패 뒤 추가 호출 없음, 캐시 적중 재사용, 조건부·차량·근사·운영 종료 제외, 대안의 상세 반환, 대안 없음/대표 후보 없음/검증 코스 없음의 구분.
7. `src/engine/index.ts`의 단일 작성자 경계를 조심해 공개 계약을 export한다. provider·adapter 구현 파일과 런타임 카탈로그·UI·DB·기존 legacy planner 정책은 수정하지 않는다.

### 완료·인계 기준

- 엔진 세션은 변경 파일·새 공개 타입·고정 fixture 이름을 이 문서에 기록한다.
- `npx tsx --test`로 새 통합 테스트, `npm run test:typecheck`, `npm test`를 실행하고 결과를 남긴다. 실패가 기존 전환 전 테스트의 정책 충돌이면 임의 수정하지 말고 ID·충돌 내용을 남긴다.
- 다음 단계는 엔진 결과를 UI 컨테이너에 연결하기 전에, 통합·결정 세션이 대표/새 추천/0개 상태의 UI 계약과 저장 스냅샷 계약을 검토하는 것이다. 이 명령에서는 화면을 수정하지 않는다.

---

## 2026-08-24 — 추천 엔진 완료: 2-E 4개 코스 한정 정확 경로 통합

### 변경 파일과 목적

- `src/engine/courseV1.ts`
  - `buildLimitedRepresentativeCourseV1`과 provider 주입 최소 계약 `CourseV1RepresentativeCandidateProvider`를 추가했다. provider 구현을 엔진에 의존시키지 않는다.
  - `COURSE_V1_EXACT_COURSE_LIMIT = 4`를 공개 상수로 고정했다. 사전 선정 후 이 수를 초과해 정확 경로 검증을 하지 않는다. 엔진 내부 구간 캐시는 동일 구간의 adapter 재호출만 줄이며, 후보 코스 상한 확장 근거가 되지 않는다.
  - 조건부·hold·`needs_review`·당일 권장 체류조차 시작할 수 없는 운영시간 후보와 같은 `siteGroupId` 조합을 사전 제외한다. 1·2·3곳 코스를 모두 허용하되, 체류시간·분류만으로 순수 정렬하며 근사 이동시간/직선거리를 결과나 성공 판정에 사용하지 않는다.
  - 선정된 최대 4개 코스만 모든 구간의 실제 `exact: true` 도보/대중교통, 권장 체류, 구조화 운영시간, 도착 여유로 재검증한다. 런타임에서도 `exact !== true`, 차량 모드, 0분/비정수는 `null`과 동등하게 탈락시킨다.
  - 결과는 대표 1개와 `alternativeCourses`의 장소 ID·구간·이동/체류/총시간 상세를 반환한다. 동일 장소 집합의 순서만 다른 코스는 중복 대안으로 반환하지 않는다. `no_representative_candidates`와 `no_verified_course_within_limit`을 구분한다.

- `src/engine/index.ts`
  - 위 함수·상수·제한 통합 입력/결과/진단 타입을 export했다.

- `test/course-v1-limited-integration.test.ts` (고정 입력 fixture를 테스트 안에 선언)
  - 45분 복귀, 90분 별도 도착지와 대안 상세, 180분 3곳 대표, 1·2·3곳 사전선정, 4개 실패 뒤 확장 금지, 구간 캐시, 조건부·운영 종료·근사/차량 성격 경로 제외, 후보 없음/검증 실패 상태 분리, 1~180분 검증을 고정 입력으로 검증한다.

### 변경하지 않은 공개 경계

- `src/data/courseV1CandidateProvider.ts`, `src/services/courseV1RouteAdapter.ts`, 런타임 카탈로그, legacy planner, UI·저장·DB는 수정하지 않았다.
- 조건부 후보를 대표 대체로 자동 승격하지 않았고, 실제 API 호출도 수행하지 않았다.

### 검증 결과

- `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 18/18 통과
- `npm run test:typecheck` — 통과
- `npm test` — 69/69 통과
- `npm run test:ui` — 61/61 통과
- `git diff --check` — 통과

### 다음 결정 세션에 필요한 사항·위험·재현 조건

- UI 컨테이너 연결 전, 대표/새 추천/0개 상태가 `CourseV1LimitedResult`의 `resultState`와 `alternativeState`를 어떻게 표시하고 저장 스냅샷에 어떤 필드를 보존할지 결정해야 한다. 이번 작업은 UI·저장을 변경하지 않았다.
- 사전선정은 경로 호출 전 체류·분류·운영 가능성만으로 만든 시작 정책이다. 실제 사용에서 4개 상한의 응답 시간·대표 다양성·새 추천 반복률을 관찰한 뒤에만 순위식 또는 상한 변경 여부를 결정한다.

---

## 2026-08-24 — 통합·결정 피드백: 2-E 조건부 보류 및 보완 명령 2-E-A

### 수락한 결과

- provider·route adapter 주입 경계, 정확 경로 4개 **코스** 상한, 조건부/근사/차량 차단, 대표·대안 상세 반환, 0개 상태 분리는 현행 정책과 맞는다.
- 기록된 18개 고정 테스트와 타입·기존 테스트 통과도 확인했다.

### 수락하지 못한 문제

`preselectCourses`가 provider의 대표 후보 190개 전체에 대해 1·2·3곳 순열을 모두 배열로 만들고 정렬한다. 현재 규모에서는 `190 + (190×189) + (190×189×188) = 6,787,180`개의 순서 있는 조합과 부수 배열을 만든다.

이는 실제 route adapter 호출을 4개 코스로 제한하더라도 모바일 JavaScript의 메모리·응답 시간을 과도하게 사용한다. 또한 ID와 체류시간 중심 선택은 출발·도착지와 공간적으로 동떨어진 4개를 먼저 검증해, 실제 사용에서 0개 결과를 불필요하게 늘릴 수 있다. 따라서 2-E는 **기능 계약은 조건부 수락, 런타임 통합은 보류**다. UI 작업으로 넘기지 않는다.

### 2-E-A — 추천 엔진 세션 지시: 공간 기반 유한 사전선정으로 교체

**목표:** 사용자에게 근사 이동시간을 표시하지 않으면서도, 190개 입력에서 일정한 작은 계산량으로 공간적으로 관련 있는 최대 4개 후보 코스를 고른다.

1. 190개 전체의 1~3곳 순열 생성·전역 정렬을 제거한다. 먼저 출발지와 도착지(없으면 복귀 출발지)에 대한 좌표 기반 내부 공간 점수로, 고정된 작은 후보 장소 풀을 결정적으로 고른다. 직선거리/공간 점수는 **사전선정 전용**이며 결과·성공 판정·사용자 시간 막대에는 절대 반환하지 않는다.
2. 후보 장소 풀의 최대 수와, 그 풀 안에서 만들 수 있는 최대 순서 코스 수를 공개 상수·진단으로 명시한다. 190개 입력에서도 순열 수가 고정 상한을 넘지 않아야 한다. 권장 시작값은 장소 풀 18개 이하이며, 더 작은 값도 근거와 테스트가 있으면 허용한다.
3. 공간 점수는 왕복이면 출발지와의 접근·복귀 부담을, 별도 도착지면 출발→장소→도착의 경로 이탈 정도를 내부적으로 반영한다. `representative_core` 우선은 **같은 공간·시간 적합성의 동점 해소**에만 쓰며 standard를 숨은 폴백으로 만들지 않는다.
4. 운영시간·분류·siteGroup 사전 제외, 1~3곳 허용, 동일 장소 집합 중복 제거, 최대 4개 정확 경로 검증, 정확 결과만 반환하는 2-E 계약은 유지한다. 후보가 없거나 4개 안에서 모두 실패했을 때 추가 확장하지 않는다.
5. 실제 `createCourseV1CandidateProvider()`의 190개 고정 입력을 사용하는 테스트를 추가해 후보 풀 상한·순열 상한·외부 route 호출 0회(사전선정 단계)를 검증한다. 별도 고정 경로 fixture로 45/90/180분·왕복/도착지·1/2/3곳·대표/대안/0개 결과도 기존대로 회귀 검증한다.
6. 화면·카탈로그·provider·adapter·legacy planner를 수정하지 않는다. 완료 시 변경 파일, 190개 입력에서의 후보 풀/조합 상한, 테스트 결과를 이 문서에 기록한다.

### 다음 단계

2-E-A 수락 뒤에만 대표·새 추천·0개 결과의 UI 계약 및 저장 스냅샷 계약을 결정한다.

---

## 2026-08-24 — 통합·결정 검토: 2-E-A 수락

- 실제 provider의 대표 후보 190개를 넣은 고정 테스트에서 후보 장소 풀은 최대 18개, 풀 내부의 순서 코스는 최대 5,220개, 사전선정 단계의 route adapter 호출은 0회임을 확인했다.
- 공간 점수는 사전선정에만 쓰이며, 대표·대안 결과의 이동시간·성공 판정은 여전히 exact 도보/대중교통 결과만 사용한다. `core`도 공간·체류 동점의 보조 정렬에만 쓰므로 `standard`를 숨은 폴백으로 만들지 않는다.
- 독립 재실행: `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 19/19 통과. `npm run test:typecheck`, `git diff --check` — 통과.
- 따라서 2-E-A를 수락한다. 다음 작업은 엔진을 변경하지 않고, 대표·새 추천·0개 상태의 UI 표시 계약과 저장 스냅샷 계약을 통합·결정으로 확정하는 것이다.

---

## 2026-08-24 — 통합·결정 지시: 명령 2-F UIUX 결과 연결

UI 표시 계약은 `UIUX_공통규칙.md` §4-1과 `UIUX_테스트명세.md` UXV-20·UXV-41에 확정했다. 다음은 **UIUX 세션**의 소유 작업이다.

### 2-F — UIUX 세션 지시: 시간 입력에서 대표 코스 결과까지의 얇은 연결

1. 시간 설정에서 확정한 `now`, 출발지, 도착지/복귀, 1~180분, 도착 여유를 `buildLimitedRepresentativeCourseV1`에 주입한다. 후보는 `createCourseV1CandidateProvider`, 경로는 `createCourseV1RouteAdapter`를 UI 컨테이너에서 조립해 주입하며, 화면 컴포넌트에는 엔진·API 호출을 넣지 않는다.
2. 요청 중에는 중복 실행을 막고, 완료 결과는 같은 추천 세션의 메모리 상태로 보존한다. 첫 화면에는 `representativeCourse` 1개만 보인다. `alternativeCourses`가 있으면 새 추천이 다음 항목으로 교체하며, 모두 본 뒤에는 다시 엔진/API를 호출하지 않고 `이 조건에서 다른 검증 코스가 없어요` 상태를 보인다.
3. `no_representative_candidates`와 `no_verified_course_within_limit`은 §4-1의 서로 다른 문구·CTA로 표시한다. 두 상태에서 조건부 장소나 일반 카페를 대표 카드로 대체하지 않고, 내부 후보 수·공간 점수·4개 상한·근사 이동시간도 표시하지 않는다.
4. 대표·대안·코스 확인 화면은 엔진 반환값의 장소 순서, 실제 각 구간 수단·분, 총 이동·권장 체류·도착 여유만 사용한다. UI에서 시간 재계산, 사용자 수단 선택, 자유 장바구니 편집을 추가하지 않는다.
5. 고정 `CourseV1LimitedResult` fixture로 UI 계약 테스트를 먼저 추가한다. 최소: 대표 1/2/3곳, 새 추천 교체와 소진 뒤 엔진 재호출 0회, 두 0개 상태, 근사/차량 미노출, 코스 확인에 동일 시간 여정 전달. UXV-20·UXV-41 및 REC-17·REC-21을 테스트 근거로 연결한다.
6. UIUX 소유 경로(`src/ui/`, 화면 테스트)만 수정한다. provider·adapter·engine·카탈로그·DB 스키마는 수정하지 않는다. 실제 저장 CTA는 현재 UI로 보이더라도 저장 payload를 바꾸지 않으며, DB·개인화 세션의 별도 인계 전에는 새 엔진 결과 저장을 완료 처리하지 않는다.

### 완료 인계

변경 파일, 유지한 엔진/DB 경계, `npm run test:typecheck`·`npm run test:ui`·`npm test` 결과, DB 저장 스냅샷에 필요한 필드를 이 파일에 기록한다. UIUX 완료 뒤 통합·결정 세션은 표시 결과를 검토하고 DB·개인화 세션에 저장 계약 보완 명령을 낸다.

---

## 2026-08-24 — 통합·결정 지시: 명령 2-G 장소별 시간 여정 출력 계약

U-1 검토에서 `VerifiedCourseV1`이 총 체류시간만 반환해 2~3곳 코스의 실제 순서별 활동 막대를 만들 수 없음을 확인했다. 다음은 **추천 엔진 세션**의 소유 작업이다.

### 목표

정확 경로로 검증된 코스가 장소별 체류와 운영 상태를 반환해, UI·저장 계층이 시간을 재계산하지 않고 순서 있는 시간 여정과 스냅샷을 만들 수 있게 한다.

1. `VerifiedCourseV1`에 방문 순서와 동일한 `stops` 배열을 추가한다. 각 stop은 최소 `placeId`, 엔진이 실제 사용한 `stayMin`, 대표 자동 추천에 사용된 운영시간 상태(구조화·검증됨을 표현하는 안정된 값)를 가진다. 기존 `placeIds`는 호환을 위해 유지할 수 있으나 `stops`와 순서·합계가 반드시 일치해야 한다.
2. `stops[].stayMin`의 합은 기존 `stayMin`과 항상 같아야 한다. 각 stop은 해당 장소에 도착한 실제 시각과 그 체류 종료가 구조화 운영시간 안인지 이미 검증된 값이어야 한다. UI는 이 값이나 운영 상태를 카탈로그에서 다시 계산하지 않는다.
3. 1/2/3곳 코스 fixture에서 `origin → leg → stop 1 체류 → leg → stop 2 체류 … → final leg → buffer` 순서로 복원 가능한지 단위/통합 테스트를 추가한다. placeIds/stops 불일치, 체류 합 불일치, `needs_review`/조건부의 stop 유입도 실패해야 한다.
4. provider·route adapter·카탈로그·UI·DB를 수정하지 않는다. `src/engine/index.ts`의 공개 type export만 필요한 범위에서 갱신한다.

### 완료 인계

변경 파일, 공개 타입, 1/2/3곳 fixture 테스트와 전체 테스트 결과, UIUX/DB가 사용할 운영 상태 표현을 이 파일에 기록한다. 수락 뒤 UIUX 세션이 U-1-A 시간 여정 표시 보완을 수행한다.

---

## 2026-08-24 — 추천 엔진 완료: 2-G 장소별 시간 여정 출력 계약

### 변경 파일과 공개 타입

- `src/engine/courseV1.ts`
  - `CourseV1Stop`을 추가하고 `VerifiedCourseV1.stops`에 방문 순서대로 반환한다.
  - 각 stop은 `placeId`, 엔진이 사용한 `stayMin`, 안정된 운영 상태 `availabilityState: 'structured_verified'`, 실제 정확 경로 도착 시각 `arrivalAt`, 권장 체류 종료 시각 `departureAt`(모두 ISO 8601 UTC)을 담는다.
  - `stops`는 정확 경로 도착 뒤 구조화 운영시간과 권장 체류를 통과한 경우에만 생성한다. `placeIds`는 호환을 위해 유지하며 stop과 동일한 순서다. 모든 stop의 `stayMin` 합은 `course.stayMin`과 일치한다.

- `src/engine/index.ts`
  - `CourseV1Stop` 공개 타입을 export했다.

- `test/course-v1-limited-integration.test.ts`
  - 1·2·3곳 코스가 `origin → 각 leg → 각 stop 도착/체류종료 → final leg → arrival buffer` 순서로 정확히 복원되고, stop 체류 합·순서·운영 상태가 코스 합계와 일치하는지 검증한다.
  - 조건부 및 `needs_review` 후보는 검증 stop으로 유입되지 않음을 검증한다.

### UIUX·DB 인계 계약

- UI와 저장 계층은 `stops`의 체류·도착/출발·`structured_verified` 상태를 스냅샷으로 사용한다. 카탈로그 운영시간을 다시 해석하거나 체류 시간을 재계산하지 않는다.
- 구간 수단·분은 기존 `legs`, 마지막 도착 여유는 `arrivalBufferMin`을 사용한다. 따라서 시간 여정은 엔진의 방문 순서와 정확 경로 검증 결과를 그대로 보존할 수 있다.

### 변경하지 않은 경계

- provider·route adapter·카탈로그·UI·DB·legacy planner는 수정하지 않았다.
- 조건부/hold/`needs_review` 차단, 최대 4개 정확 경로 코스 상한, 대안/0개 상태 계약은 유지했다.

### 검증 결과

- `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 21/21 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 65/65 통과
- `git diff --check` — 통과
- `npm test` — **실패 (엔진 변경과 무관한 현재 UIUX 전환 충돌)**
  - `test/map-transport-ui-contract.test.mjs`: 현재 `src/ui/TimeSetupScreen.tsx`는 `MAX_MINUTES = 180`인데 기존 테스트가 `120`을 요구한다.
  - `test/ui/course-v1-results-contract.test.mjs`: Node 기본 테스트 러너가 현재 untracked인 `src/ui/recommendation/v1ResultState.ts`를 확장자 없는 import로 해석하지 못한다. `npm run test:ui`(tsx)는 같은 UI 계약 65/65를 통과한다.
  - 두 항목은 UIUX 소유 파일/테스트 경계이므로 추천 엔진 세션에서 수정하지 않았다.

### 다음 세션 결정 필요 사항

- UIUX 세션은 U-1-A에서 `CourseV1Stop`을 사용해 시간 여정을 표시하고, 위 UI 계약 테스트의 120분 정책 잔재 및 Node/tsx 실행 경계를 정리해야 한다.
- DB·개인화 세션은 저장 payload를 변경하기 전 `stops`의 ISO 시각·운영 상태·체류를 어떤 스냅샷 필드로 보존할지 결정해야 한다.

---

## 2026-08-24 — 추천 엔진 완료: 2-E-A 공간 기반 유한 사전선정

### 교체 기록

- **이전 방식:** provider의 대표 후보 전체에서 1~3곳 순서 코스를 만들고 전역 정렬했다.
- **문제/관찰:** 190개 입력에서는 최대 6,787,180개 코스 배열을 만들어, 정확 경로 호출을 4개로 제한해도 모바일 JS의 메모리·응답 시간 위험이 남았다. 출발/도착지와 무관한 ID 중심의 우선순위도 0개 결과를 불필요하게 만들 수 있었다.
- **교체 방식:** 출발·도착(왕복이면 출발 복귀)을 기준으로 한 내부 좌표 점수로 먼저 결정적인 장소 풀을 고르고, 그 풀 안에서만 1~3곳 순서 코스를 만든다. 실제 경로 adapter는 그 후 최대 4개 코스에만 호출한다.
- **교체 이유:** 사전선정의 계산량과 공간 관련성을 고정하면서도, 사용자에게 근사 이동 시간·거리나 성공 판정을 노출하지 않기 위해서다.
- **상태:** 현행 구현.

### 변경 파일과 공개 계약

- `src/engine/courseV1.ts`
  - `COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT = 18`, `COURSE_V1_PRESELECTION_ORDERED_COURSE_LIMIT = 5,220`을 공개 상수로 추가했다. 190개 입력에서도 사전선정 풀과 풀 내부 순서 코스 수는 이 상한을 넘지 않는다.
  - `preselectLimitedCourseV1`을 adapter 없는 순수 경계로 공개했다. 따라서 사전선정 단계에서는 외부 route 호출이 0회다.
  - 왕복은 출발지 접근·복귀 부담, 별도 도착지는 출발→장소→도착의 내부 공간 부담을 사용한다. 이 값은 결과 타입·시간 막대·성공 판정에 반환하거나 사용하지 않는다.
  - `representative_core`는 공간 점수와 권장 체류 시간 적합성이 같은 경우의 동점 해소에만 사용한다. standard 후보를 숨은 폴백으로 만들지 않는다.
  - 제한 통합 진단에 `candidatePoolCount`, `generatedOrderedCourseCount`를 추가했다. 후자는 정확 검증 4개와 별개인 사전선정 코스 수다.

- `src/engine/index.ts`
  - 공간 사전선정 함수·상수·입력/결과 타입을 export했다.

- `test/course-v1-limited-integration.test.ts`
  - 실제 `createCourseV1CandidateProvider()`의 190개 고정 입력으로 장소 풀 18 이하, 생성 순서 코스 5,220 이하, 사전선정 adapter 호출 0회를 검증한다. 기존 45/90/180분, 왕복/도착지, 1/2/3곳, 대표·대안·0개, 4개 정확 검증 상한 회귀도 유지했다.

### 변경하지 않은 경계

- 화면·카탈로그·provider·route adapter·legacy planner·저장·DB는 수정하지 않았다.
- 조건부/hold/운영 불가/siteGroup 중복 제외, 권장 체류와 모든 구간의 정확 경로 검증, 최대 4개 코스 상한, 0개 상태 분리는 2-E 계약 그대로 유지한다.

### 검증 결과

- `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 19/19 통과
- `npm run test:typecheck` — 통과
- `npm test` — 69/69 통과
- `npm run test:ui` — 61/61 통과
- `git diff --check` — 통과

### 다음 결정 세션에 필요한 사항

- 2-E-A 수락 뒤 UI 세션은 `CourseV1LimitedResult.resultState`와 `alternativeState`, 대표 코스·상세 대안을 어떤 화면 상태와 저장 스냅샷으로 표현할지 결정해야 한다. 이번 엔진 작업은 UI·저장을 연결하지 않았다.
- 장소 풀 18과 정확 검증 4는 현행 시작값이다. 실제 사용에서 응답 시간, 대표·새 추천 다양성, 0개 비율을 관찰해 수정을 판단해야 한다.

---

## 2026-08-24 — 활성 명령 2-G 재게시: 장소별 시간 여정 출력 계약

> 이 항목은 파일 중간의 2-G와 동일한 현행 지시다. 뒤늦은 2-E-A 완료 기록이 파일 끝에 추가되어 지시가 묻힌 문제를 해결하기 위해 마지막에 다시 게시한다. **다음 추천 엔진 세션은 이 항목부터 수행한다.**

**담당:** 추천 엔진 세션 (`src/engine/`, 순수 엔진 테스트). UI·data·API adapter·DB는 수정하지 않는다.

**목표:** `VerifiedCourseV1`이 총 체류시간만 주는 현재 계약을 보완해, UI와 저장 계층이 시간을 재계산하지 않고 1~3곳 코스의 실제 순서를 표시·보존할 수 있게 한다.

1. `VerifiedCourseV1`에 방문 순서와 같은 `stops` 배열을 추가한다. 각 항목은 최소 `placeId`, 엔진이 실제 사용한 `stayMin`, 자동 대표에 사용된 운영시간 검증 상태를 가진다. 기존 `placeIds`는 호환을 위해 유지할 수 있으나 `stops`와 길이·순서·ID가 항상 일치해야 한다.
2. `stops[].stayMin` 합계는 `stayMin`과 같아야 한다. 각 stop은 실제 도착 시각부터 체류 종료까지 구조화 운영시간 게이트를 통과한 값이어야 한다. `needs_review`, `conditional_more`, `hold`는 stop으로 반환될 수 없다.
3. 1/2/3곳 fixture에서 아래 순서를 정확히 복원할 수 있는 테스트를 추가한다.

   ```text
   origin → 이동 구간 1 → stop 1 체류 → 이동 구간 2 → stop 2 체류 → … → 최종 이동 → 도착 여유
   ```

   `placeIds`/`stops` 불일치, 체류 합 불일치, 미검증 운영 상태 유입은 실패해야 한다.
4. 필요한 공개 타입만 `src/engine/index.ts`에서 export한다. provider·route adapter·카탈로그·UI·DB와 4개 정확 코스 상한·사전선정 정책은 변경하지 않는다.

**완료 인계:** 변경 파일, 공개 타입, 1/2/3곳 테스트와 `npm run test:typecheck`·`npm test` 결과, UIUX/DB가 사용할 운영 상태 표현을 이 파일에 기록한다. 수락 뒤 UIUX 세션은 시간 막대를 실제 순서로 고치는 U-1-A를 수행한다.

---

## 2026-08-24 — 통합·결정 검토: 2-G 수락

- `CourseV1Stop`이 장소별 `stayMin`, `structured_verified`, 정확 경로 도착·체류 종료 ISO 시각을 반환하며 `placeIds`·`stops` 순서와 총 체류 합이 일치함을 확인했다.
- 독립 실행: V1 엔진·provider·adapter 고정 테스트 21/21 통과, `npm run test:typecheck` 및 `git diff --check` 통과.
- 파일 끝의 이전 “활성 명령 2-G 재게시”는 이 완료 기록으로 **완료 처리**한다. 다음 구현 담당은 UIUX 세션이며, U-1-A는 `UIUX_작업기록.md`에 기록한다.

---

## 2026-08-25 — 통합·결정 지시: 경로 비용·직렬화 시간·장소 이미지/카카오맵 보완

### 문제 확인

- 서면 왕복 한 건에서 TMAP/ODsay 실제 경로 호출이 10건 관찰됐다. V1의 상한은 **후보 코스 4개**이지 API 요청 4건이 아니다. 코스당 1~4개 구간과 도보 우선·대중교통 전환 때문에 여러 고유 좌표쌍 요청이 생긴다.
- 현재 `RecommendationSession.now`가 `Date` 객체인 채 React Navigation `Results` 파라미터로 전달돼 `Non-serializable values` 경고가 발생한다. 이는 화면 상태 복원·딥링크에서 실제 문제가 될 수 있다.
- TourAPI 대표 이미지 감사는 138개를 확인해 127개의 이미지를 찾았지만, 이는 조사 산출물일 뿐 런타임 카탈로그에 병합되지 않았다. 현재 368개 런타임 카탈로그의 129개 이미지는 모두 부산시 공식 원천이고 TourAPI 이미지는 0개다. 또한 V1 결과·코스 확인 화면은 `imageUrl`을 렌더링하지 않는다.
- 결과 화면의 `지도에서 더 보기`는 임시로 출발지 카카오맵만 열고 있다. 이는 대표 밖 후보를 상태별로 탐색한다는 현행 정책의 최종 구현이 아니다. 개별 장소 확인 링크와 앱 내 후보 탐색 지도를 같은 버튼에 섞지 않는다.

아래 명령은 번호 순서와 완료 인계를 따른다. 각 담당은 자기 소유 경계만 수정하고 이 문서에 완료 기록을 추가한다.

### 명령 3-A — 외부 API 어댑터 세션: 앱 세션 경로 캐시·호출 관찰성 보완

**목표:** 정확 경로 검증을 줄이거나 근사값으로 바꾸지 않으면서, 같은 앱 실행에서 중복 경로 요청을 재사용하고 호출량을 재현 가능하게 관찰한다.

1. `createCourseV1RouteAdapter()`를 추천 요청마다 새로 만드는 현재 경계를 점검한다. 성공 24시간·실패 5분 TTL 및 진행 중 요청 공유를 유지한 **앱 세션 단위 singleton 또는 명시적 cache owner**를 설계·구현한다. 경로 제공사 약관상 보관 허용 범위를 넘겨 영속 저장하지 않는다.
2. 키는 현재처럼 `수단 + 반올림 좌표쌍`을 포함해야 하며, 출발·도착 순서를 보존한다. 도보·대중교통을 섞거나, 실패 결과를 성공처럼 오래 보관하지 않는다. 실제 TMAP/ODsay 응답만 `exact`로 통과시키고 haversine·fallback은 계속 `null` 처리한다.
3. 고정 fetcher fixture로 다음을 계약 테스트한다: 같은 구간을 두 번 계산해도 fetch가 한 번, 동시에 온 같은 구간 요청이 하나로 합쳐짐, 24시간 성공/5분 실패 만료 뒤에만 재요청, 다른 수단·반대 방향·다른 좌표는 재사용하지 않음, 새 추천이 이미 검증된 대안을 교체할 때 네트워크가 0회임.
4. 개발 로그에만 요청 수를 나열하는 것으로 끝내지 말고, 고정 테스트에서 읽을 수 있는 `요청/캐시 적중/공유 대기/실패` 관찰값 또는 adapter 진단을 제공한다. 사용자 화면과 네비게이션 파라미터에는 내부 호출 수·캐시 키를 노출하지 않는다.
5. **공동 서버 캐시는 이번 명령에서 구현하지 않는다.** 기기별 캐시만으로 여러 사용자 호출을 합치지 못하므로, 완료 기록에는 공유 캐시가 필요한 조건, 제공사 약관·TTL 확인 항목, 좌표 최소화·비로그인 위치 미저장 원칙, 예상 비용/적중률 측정 방법을 설계 인계로 남긴다. Supabase에 원본 GPS 좌표를 무기한 저장하는 방식은 금지한다.
6. `src/services/`와 adapter 계약 테스트만 수정한다. 추천 엔진의 4코스 상한, provider·카탈로그, React 화면, DB 스키마는 수정하지 않는다.

**완료 기준:** 관련 고정 테스트와 `npm run test:typecheck`, `npm test`, `git diff --check` 통과. 실제 API 호출은 실행하지 않는다.

### 명령 U-1-C — UIUX 세션: 직렬화 가능한 추천 시각 계약

**목표:** 운영에서는 실제 시각을 사용하면서도, 테스트는 고정 시각으로 재현하고 React Navigation 경고 없이 상태를 복원할 수 있게 한다.

1. `RecommendationSession` 및 `Results`/`CourseConfirm` 파라미터에서 `Date`를 제거한다. 공개 값은 UTC ISO 문자열 `nowIso` 또는 epoch 정수 중 하나만 사용한다. 문자열이면 유효한 ISO인지, 정수면 유효 범위인지 경계에서 검사한다.
2. TimeSetup은 운영에서는 사용자가 추천을 누른 순간의 실제 시각을 직렬화 값으로 한 번 캡처한다. 개발 테스트 시각은 같은 형식의 고정 fixture 값으로 주입한다. 화면의 표시 시각과 엔진의 운영시간 판단 시각은 반드시 동일한 입력을 복원해 사용한다.
3. `runRecommendationSession`의 엔진 경계에서만 직렬화 값을 `Date`로 복원한다. 결과·코스 확인의 시간 표시도 같은 값에서 읽되, navigation state·AppFlow memory에 `Date`, 함수, class instance를 넣지 않는다.
4. JSON stringify 가능한 Results/CourseConfirm 파라미터, 고정 시각의 엔진 입력 일치, 실제 시각 캡처 한 번, 대안 교체 뒤 시각 불변을 UI 계약 테스트로 검증한다. 기존 180분 정책·1/2/3곳 여정은 회귀시킨다.
5. `src/ui/`, UI 테스트만 수정한다. 엔진·경로 adapter·카탈로그·DB·저장 흐름은 수정하지 않는다.

**완료 기준:** 터미널에서 해당 non-serializable 경고가 재현되지 않는 고정 navigation fixture, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check` 통과.

### 명령 3-B — 데이터 정제 세션: TourAPI 대표 이미지의 안전한 런타임 병합

**선행 조건:** U-1-C와 병렬 가능. UI의 이미지 표시 명령 U-1-D보다 먼저 완료·인계한다.

**목표:** 감사로 확인한 TourAPI 이미지를 조사 결과에 머물게 하지 않고, 출처·연결 가능성·우선순위를 보존한 런타임 카탈로그 필드로 병합한다.

1. 입력은 `data/processed/review/현재사용_TourAPI_대표이미지_감사.json`과 현행 근거 프로필 카탈로그다. 감사의 `contentId`와 현재 런타임 장소 ID가 정확히 일치하고 `tourapiContentId`도 일치할 때만 이미지를 후보로 쓴다. 제목 유사도만으로 다른 장소에 붙이지 않는다.
2. 현재 부산시 공식 이미지는 유지한다. TourAPI 이미지는 **기존 공식 이미지가 없는 장소를 채우는 보완 원천**으로만 사용하며 `imageSource: 'tourapi'`, 원본 content ID, 감사 생성 시각을 추적 가능하게 기록한다. 이미지 부재 11건은 억지 대체하지 않는다.
3. `http` URL을 무조건 `https`로 치환하지 않는다. 제한된 대표 표본에서 HTTPS 응답·콘텐츠 유형·리다이렉트와 iOS 표시 가능성을 확인하고, 실패하면 이미지 없음으로 남긴다. 원격 이미지를 앱 번들에 무단 복제하거나, 앱 실행 중 TourAPI를 다시 대량 호출하지 않는다.
4. `scripts/build_runtime_poi_catalog.mjs` 또는 데이터 소유 변환 경계에 재현 가능한 병합을 넣고, 감사 원본·최종 카탈로그·출처별 수를 담은 작은 감사 문서를 갱신한다. 원본 감사 JSON을 수동으로 편집해 사실처럼 만들지 않는다.
5. 테스트는 TourAPI image가 실제 일치 ID에만 붙고, 부산시 공식 이미지가 우선이며, 빈/검증 실패 URL을 넣지 않고, 이미지 병합이 classification·운영시간·체류·좌표를 바꾸지 않음을 검증한다.
6. `data/`, `scripts/build_*.mjs`, `src/data/`와 데이터 테스트만 수정한다. 추천 정책·React UI·API adapter·DB는 수정하지 않는다.

**완료 기준:** 병합 전후 출처별 이미지 수와 대표 후보 이미지 커버리지를 보고하고, 위 계약 테스트·`npm test`·`git diff --check`를 통과한다. 추가 TourAPI 대량 수집은 금지한다.

### 명령 U-1-D — UIUX 세션: 장소 이해를 위한 이미지·일관된 카카오맵 연결

**선행 조건:** 3-B가 런타임 이미지 계약과 출처를 인계한 뒤 수행한다.

**목표:** 사용자가 코스를 받았을 때 각 장소가 어디이고 무엇을 하는 곳인지 이해하게 하되, 사진 유무에 따라 행동 방식이 달라지지 않게 한다.

1. 대표 결과와 코스 확인의 각 stop에 장소별 미리보기를 제공한다. 이미지가 있으면 출처를 숨기지 않는 범위의 사진 썸네일을, 없거나 로드 오류면 지역·활동 유형을 사용하는 중립 플레이스홀더를 보인다. 사진은 추천 근거·인기도 주장으로 사용하지 않는다.
2. 모든 stop에 같은 문구와 위치의 `카카오맵에서 장소 보기` 행동을 제공한다. `mapVerification.placeUrl`의 검증 URL을 우선하고, 없으면 제목과 좌표를 포함한 안전한 검색 URL을 만든다. 결과 화면의 출발지 좌표만 여는 현재 `지도에서 더 보기` 구현을 개별 장소 CTA의 대체로 남기지 않는다.
3. 사진 있음/없음은 **표현만** 다르고, 사용자는 같은 장소 정보·같은 카카오맵 CTA를 받는다. 네트워크 이미지 실패 시 레이아웃이 깨지거나 다른 장소 링크로 바뀌면 안 된다. 외부 링크 실패는 조용히 무시하지 말고 짧은 오류 상태를 제공한다.
4. 대표 코스의 전체 시간 여정, 장소 순서, 체류·운영 상태, 새 추천의 네트워크 0회 계약을 변경하지 않는다. 이미지의 외부 URL·카카오 링크는 엔진 결과·시간 계산·저장 payload에 넣지 않는다.
5. 고정 fixture로 사진 있음/없음/로드 실패, 검증 링크/검색 fallback/Linking 실패, 1·2·3곳 코스의 각 장소 링크·접근성 라벨을 검증한다. 실제 외부 URL을 반복 호출하는 UI 회귀 테스트는 금지한다.
6. `src/ui/`, UI 테스트만 수정한다. 카탈로그·추천 엔진·adapter·DB를 수정하지 않는다.

**완료 기준:** `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check` 통과 및 iOS에서 사진/플레이스홀더의 줄바꿈·VoiceOver·외부 앱 전환을 수동 확인 대상으로 기록.

### 후속 보류 — 앱 내 `지도에서 더 보기` 복원

앱 내 지도는 개별 카카오맵 CTA와 별개의 후속 작업이다. 후보 전체에 실제 경로를 일괄 호출하면 현재 호출량 목표와 충돌하므로, 다음 설계 명령 전에는 구현하지 않는다. 설계는 `대표 후보 탐색`과 `운영시간 확인 필요`를 명시적으로 구분하고, 장소를 탭한 한 건에만 정확 경로 확인을 수행하는지 여부를 고정 fixture·호출 상한과 함께 결정해야 한다. 그 전까지 결과 화면의 해당 버튼은 앱 내 탐색 지도 완성을 뜻하는 문구로 유지하거나 제거하되, 출발지 카카오맵 링크로 위장해서는 안 된다.

---

## 2026-08-25 — 통합·결정 보완 명령 3-B-1: TourAPI 대표 이미지 HTTPS 검증·병합 확대

**담당:** 데이터 정제 세션 (`data/`, `scripts/build_*.mjs`, `src/data/`, 데이터 계약 테스트). React UI·추천 엔진·경로 adapter·DB는 수정하지 않는다.

### 재작업 이유

3-B는 TourAPI 감사에서 127개 이미지를 확인했지만, 원래부터 HTTPS인 4개만 표본 검사해 런타임에는 1개만 병합했다. 따라서 자동 대표 190곳의 사진 커버리지는 부산시 공식 106개, TourAPI 0개, 사진 없음 84개로 그대로다. 이는 "안전한 연결"은 일부 달성했지만, 사진 부족 해소라는 목적을 달성하지 못한 결과다.

현재 감사 결과 중 부산시 공식 이미지가 없고 TourAPI 이미지가 있는 자동 대표 후보는 정확히 **72개**(`representative_core` 11, `representative_standard` 61)이며, 모두 `tong.visitkorea.or.kr` 원천이다. 이번 작업의 외부 이미지 검증 범위는 이 72개를 넘지 않는다. TourAPI 상세 API 재호출·새 장소 수집은 금지한다.

### 목표

기존 감사의 HTTP 이미지 URL을 HTTPS 후보로 안전하게 검증해, 실제로 연결 가능한 이미지만 대표 후보의 빈 이미지 자리에 병합한다. 부산시 공식 이미지는 계속 우선한다.

1. 감사 JSON에서 위 72개만 결정적으로 추출한다. 각 행은 `contentId`, `tourapiContentId`, 원본 URL, HTTPS 후보 URL, 분류를 보존한다. 현재 런타임 카탈로그의 ID와 TourAPI content ID가 둘 다 맞지 않으면 즉시 제외한다.
2. 먼저 `core`와 `standard`를 모두 포함하는 최대 12개 층화 표본을 HTTPS로 검증한다. 리다이렉트 최종 URL, HTTP 성공 상태, `image/*` 콘텐츠 유형, 빈 응답이 아님을 기록한다. 표본에서 HTTPS 전환이 원천 전체에 체계적으로 실패하면 대량 검증·병합을 멈추고 실패 근거만 기록한다.
3. 표본이 통과하면 남은 대상까지 포함해 최대 72개를 **한 번만** HTTPS 검증한다. 성공한 개별 URL만 병합 후보가 된다. `HEAD`만 허용하지 않고 CDN이 HEAD를 거부할 수 있음을 고려해 작은 `GET` 또는 Range 요청으로 콘텐츠 유형을 확인한다. 실패·타임아웃·HTML 응답·안전하지 않은 리다이렉트는 이미지 없음으로 남긴다.
4. URL을 무조건 문자열 치환하거나 원격 파일을 앱 번들에 복제하지 않는다. 최종 URL은 HTTPS여야 하고, `imageSource: 'tourapi'`, 감사 시각, HTTPS 검증 시각, 검증 방법/최종 URL을 추적 가능한 데이터 필드 또는 별도 검증 manifest에 남긴다.
5. `build_runtime_poi_catalog.mjs`는 부산시 공식 이미지를 항상 우선하고, 위 manifest에서 성공한 TourAPI 이미지로만 빈 값을 채운다. 이미지 변환은 장소의 분류·운영시간·체류 범위·좌표·추천 가능 여부를 바꾸지 않는다.
6. 고정 계약 테스트를 추가한다: (a) 72개 이외의 장소는 검증 manifest로 들어가지 않음, (b) ID/content ID 불일치는 병합 불가, (c) 공식 이미지 우선, (d) HTTPS·image 콘텐츠 검증 실패값 제외, (e) 성공값은 정확한 TourAPI 출처·검증 이력을 보존, (f) 비이미지 추천 필드 불변.
7. 결과 문서에는 표본 통과/실패, 최종 검증 수·성공 수·실패 사유 분포, 대표 후보의 `부산시 공식 / TourAPI / 없음` 이미지 수를 전후 비교해 기록한다. 실제 iOS에서는 URL을 대표 표본 몇 개로만 수동 확인 대상으로 남긴다.

### 완료 기준

- 앱의 실제 런타임 카탈로그에서 대표 후보 TourAPI 이미지가 0개인 상태를 그대로 완료 처리하지 않는다. 표본 실패로 중단한 경우에만 그 실패 근거와 다음 대안(공식 이미지 보강 또는 수동 큐)을 명확히 남긴다.
- 데이터 계약 테스트, `npm test`, `git diff --check`를 통과한다.
- 변경 파일 / 변경하지 않은 추천·UI 경계 / 테스트 / 외부 검증 수 / 남은 iOS 수동 확인을 이 작업기록에 인계한다.

---

## 2026-08-25 — 데이터 정제 완료: 명령 3-B TourAPI 대표 이미지 안전 병합

### 변경·결과

- `scripts/audit_tourapi_images.mjs`가 현재 런타임의 TourAPI 원천 ID 138개를 감사하고, 이미지 URL·분류·원천 ID를 `data/processed/review/현재사용_TourAPI_대표이미지_감사.json`에 남긴다. 결과는 이미지 있음 127개, 없음 11개다.
- `scripts/audit_tourapi_image_https_sample.mjs`가 감사에서 원문부터 HTTPS인 4개만 GET 범위 요청으로 검증해 리다이렉트·콘텐츠 유형을 `현재사용_TourAPI_대표이미지_HTTPS검증.json`에 보존했다. 4/4가 HTTPS `image/jpg`였다.
- `scripts/build_runtime_poi_catalog.mjs`는 감사의 장소 ID와 TourAPI content ID가 모두 일치하고 HTTPS 검증을 통과한 URL만 사용한다. 부산시 공식 이미지가 없던 `poi_41`(놀이마루) 1개에만 `imageSource: 'tourapi'`와 감사·검증 시각을 병합했다. 부산시 공식 이미지 129개는 우선 유지했다.
- 상세는 `docs/02_data/TourAPI_대표이미지_병합감사.md`에 기록했다. 런타임 전체 이미지는 130개(부산시 129, TourAPI 1)이며 자동 대표 190개의 커버리지는 106개로 변함없다.

### 검증·유지 경계

- `node --test test/busan-poi-catalog.test.mjs` — 6/6 통과
- 이미지를 URL 변환·번들 복제·앱 실행 중 재조회하지 않았다. 카탈로그의 분류·운영시간·체류·좌표도 변경하지 않았다.
- React UI, 추천 엔진, 외부 API adapter, DB는 수정하지 않았다. U-1-D UIUX 세션은 이 런타임 이미지 계약을 소비할 수 있다.

---

## 2026-08-25 — 외부 API 어댑터 완료: 명령 3-A 앱 세션 경로 캐시·호출 관찰성

### 변경 파일과 공개 계약

- `src/services/courseV1RouteAdapter.ts`
  - 옵션 없이 호출한 `createCourseV1RouteAdapter()`는 앱 실행 중 하나의 메모리 전용 singleton을 반환한다. 따라서 UI의 추천 요청마다 adapter 객체를 조립해도 같은 실행 안에서는 경로 cache·진행 중 요청이 유지된다.
  - `createCourseV1RouteCacheOwner(options)`는 fixture·독립 작업 단위에 사용할 명시적 cache owner를 제공하고, 그 owner에서 만든 adapter들은 동일 cache를 공유한다. 옵션을 명시한 `createCourseV1RouteAdapter(options)`는 의도적으로 독립 owner를 만든다.
  - 성공(`exact: true`)은 24시간, 실패(`null`)는 5분만 메모리에 보관한다. 캐시 키는 `course-v1:exact-route:v1:<mode>:<from lat5,lon5>:<to lat5,lon5>`로 수단·방향·좌표쌍을 모두 분리한다.
  - TMAP 도보와 ODsay 대중교통 이외의 출처, `haversine`·`transit_fallback`·`walk_short`는 기존처럼 `null`이다. 차량·근사 경로를 추가하지 않았다.
  - `CourseV1RouteAdapterWithDiagnostics.diagnostics()`와 owner의 같은 진단은 `{ fetchRequests, cacheHits, sharedInFlightWaits, failures }` 스냅샷만 반환한다. 사용자 화면·navigation 파라미터에는 호출 수·캐시 키·좌표가 전달되지 않는다.

- `test/course-v1-route-adapter.test.ts`
  - 같은 구간의 새 추천 교체는 owner 공유 cache로 fetch 1회·두 번째 네트워크 0회를 검증한다.
  - 동시 동일 구간 요청의 fetch 1회·공유 대기 1회, 성공 24시간/실패 5분 TTL, 수단·반대 방향·다른 좌표 키 분리, 실패·근사 `null`을 고정 fixture로 검증한다.

### 검증

- `npx tsx --test test/course-v1-route-adapter.test.ts` — 7/7 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 69/69 통과
- `npm test` — 71/71 통과
- `git diff --check` — 통과
- 실제 TMAP·ODsay 호출은 수행하지 않았다.

### 유지 경계와 공유 서버 캐시 설계 인계

- `src/engine/`의 최대 4개 후보 코스 상한, provider·카탈로그, React UI, DB 스키마는 수정하지 않았다. cache는 앱 프로세스 메모리에만 존재하며 앱 종료 시 폐기된다. 위치를 AsyncStorage·Supabase 등 영속 저장소에 쓰지 않는다.
- 공동 서버 캐시는 다음 조건이 모두 확인될 때만 별도 설계한다: 제공사별 응답 보관·재배포·상업 이용 약관과 허용 TTL, 지역·시간대별 응답 변동성, 인증·요금제, 삭제·만료 보장. 원본 GPS 좌표나 비로그인 사용자의 위치를 무기한 저장하지 않는다.
- 도입 판단을 위한 측정은 운영 사용자별 좌표·키를 수집하지 않고, 앱 세션의 진단값을 개발/승인된 관찰 경로에서 집계한 `fetchRequests`, `cacheHits`, `sharedInFlightWaits`, `failures`와 추천 요청 수·응답 시간을 익명 집계해 적중률과 예상 호출 비용을 비교한다. 서버 공유 cache가 필요하더라도 좌표 최소화·짧은 TTL·명시적 보존 정책을 먼저 확정해야 한다.

---

## 2026-08-25 — UIUX 완료: 명령 U-1-C 직렬화 가능한 추천 시각 계약

### 변경 파일과 목적

- `src/ui/nav.ts`, `src/ui/TimeSetupScreen.tsx`: `RecommendationSession.now`의 `Date`를 UTC ISO `nowIso`로 교체했다. 운영에서는 추천 버튼을 누른 순간 한 번만 캡처하고, 개발 테스트 시각도 같은 ISO 형식으로 캡처한다.
- `src/ui/recommendation/recommendationSessionTime.ts`, `src/ui/recommendation/v1Session.ts`: navigation 경계는 정규 UTC ISO만 허용하고, 엔진 호출 직전에만 `Date`로 복원한다. 결과·코스 확인의 시작 시각도 같은 `nowIso`에서 복원한다.
- `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`, `test/ui/recommendation-session-time.test.ts`: `Results`/`CourseConfirm` 파라미터의 JSON 직렬화, 고정 시각의 엔진·표시 일치, 잘못된 ISO 거부, 대안 교체 뒤 시각 불변을 고정 fixture로 검증했다.

### 유지 경계·검증

- 엔진·경로 adapter·카탈로그·DB·저장/진행 흐름은 수정하지 않았다. navigation state와 AppFlow 메모리에 `Date`·함수·class instance를 전달하지 않는다.
- `npm run test:typecheck`, `npm run test:ui`(77개), `npm test`, `npx expo export --platform ios`를 통과했다. 실제 외부 API 호출은 하지 않았다.

### 다음 위험

- ISO 형식은 UTC canonical 문자열로 고정했다. 서버·DB 저장 계약을 도입할 때도 같은 `nowIso`와 엔진 반환 스냅샷의 시각대를 보존해야 한다.

---

## 2026-08-25 — UIUX 완료: 명령 U-1-D 장소 미리보기·일관된 카카오맵 연결

### 변경 파일과 목적

- `src/ui/recommendation/CourseV1PlacePreview.tsx`, `courseV1PlacePreviewModel.ts`: 모든 V1 stop에 공통 미리보기를 추가했다. HTTPS 이미지가 있으면 `부산시 공식 사진` 또는 `TourAPI 제공 사진`을 표시하고, 이미지 없음·로드 실패면 지역·활동 맥락의 중립 플레이스홀더로 바꾼다.
- `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: 결과와 코스 확인의 모든 장소에 같은 위치·문구의 `카카오맵에서 장소 보기` 행동을 제공한다. 검증된 HTTPS `mapVerification.placeUrl`을 우선하고, 없거나 안전하지 않으면 제목·좌표의 HTTPS 카카오 검색 URL을 사용한다. Linking 실패는 짧은 오류 상태로 보인다.
- `test/ui/course-v1-place-preview.test.ts`, `test/map-transport-ui-contract.test.mjs`: 사진 있음/없음/로드 실패, 검증 링크·검색 fallback·Linking 실패, 1·2·3곳 stop의 공통 행동·접근성 문구, 출발지 카카오맵으로 위장하던 `지도에서 더 보기` 제거를 고정 fixture로 검증했다.

### 유지 경계·검증

- 이미지 URL·카카오 URL은 표시·외부 확인에만 사용하며, 추천 근거·시간 여정·장소 순서·대안의 네트워크 0회 계약·저장 payload에 넣지 않았다. 카탈로그·추천 엔진·adapter·DB는 수정하지 않았다.
- 앱 내 `지도에서 더 보기`는 별도 설계 전까지 제공하지 않는다. 개별 장소 CTA가 그 기능의 대체가 아니며, 출발지 좌표 카카오맵 링크도 제거했다.
- `npm run test:typecheck`, `npm run test:ui`(77개), `npm test`, `npx expo export --platform ios`를 통과했다. `git diff --check`는 아래 최종 변경까지 다시 실행한다.

### 다음 위험

- iOS 실기기에서 이미지/플레이스홀더의 긴 문구 줄바꿈, VoiceOver 읽기 순서, 카카오맵 전환·실패 안내를 수동 확인해야 한다. 실제 URL을 반복 호출하는 자동 회귀 테스트는 추가하지 않는다.

---

## 2026-08-25 — 데이터 정제 완료: 명령 3-B-1 TourAPI 대표 이미지 HTTPS 검증·병합 확대

### 변경 파일과 결과

- `scripts/build_tourapi_representative_image_https_queue.mjs`
  - 부산시 공식 이미지가 없고, 현재 런타임 ID와 TourAPI content ID가 기존 감사와 모두 일치하는 자동 대표 후보 72개(`core` 11, `standard` 61)만 고정 큐로 만들었다.
  - `tong.visitkorea.or.kr`의 원본 HTTP URL은 전역 문자열 치환 없이 allowlisted host·URL 구성요소로 HTTPS 후보를 만들었다.
- `scripts/audit_tourapi_representative_image_https.mjs`
  - core·standard가 모두 포함된 12개 표본을 먼저 GET Range로 검증해 12/12 성공한 뒤, 남은 60개를 한 번 검증해 60/60 성공했다.
  - 결과 manifest는 최종 HTTPS URL, HTTP 상태, `image/*` 콘텐츠 유형, Range 응답 길이, 검증 방법과 실패 사유 분포를 보존한다. TourAPI 상세 API 재호출은 하지 않았다.
- `scripts/build_runtime_poi_catalog.mjs`
  - 부산시 공식 이미지를 우선 유지하고, 성공 manifest의 정확한 ID·TourAPI content ID 일치 항목으로만 빈 값을 채운다.
  - 자동 대표 후보 이미지는 부산시 공식 106, TourAPI 72, 없음 12가 됐다. 전체 런타임은 부산시 공식 129, TourAPI 73, 없음 166이다.
- `test/tourapi-representative-image-https.test.mjs`, `test/busan-poi-catalog.test.mjs`
  - 72개 범위 고정, ID/content ID 일치, HTTPS·이미지 검증, 부산시 우선, TourAPI 출처·검증 이력, 비이미지 추천 필드 불변을 검증한다.

### 검증·유지 경계

- `node --test test/tourapi-representative-image-https.test.mjs test/busan-poi-catalog.test.mjs` — 7/7 통과
- `npm run test:typecheck`, `npm run test:ui`(77/77), `npm test`(72/72), `git diff --check` — 통과
- 외부 이미지 검증은 표본 12 + 나머지 60 = 72회이며, 대상·장소 수집·TourAPI 상세 API 호출을 확장하지 않았다.
- 추천 정책·React UI·추천 엔진·경로 adapter·DB는 수정하지 않았다. iOS에서는 TourAPI 대표 표본의 표시·리다이렉트·오프라인 플레이스홀더를 수동 확인해야 한다.

---

## 2026-08-25 — 통합·결정 지시 2-H: 대표·새 추천의 중첩 대안 제거

**담당:** 추천 엔진 세션 (`src/engine/`, 순수 엔진 테스트). UI·data·외부 API adapter·DB는 수정하지 않는다.

### 관찰과 교체 이유

사상→서면, 3시간 실제 체감에서 결과가 `A` → `A,B` → `A,C,B` 순으로 나왔다. 이는 장소 공급 부족을 바로 뜻하지 않는다. 현 V1 사전선정은 엔진이 1·2·3곳을 모두 만들 수 있는지 확인하려고 각 장소 수의 상위 한 코스를 먼저 넣는 임시 보정이므로, 가까운 A를 포함한 부분집합·상위집합이 검증 대안으로 함께 선택됐다. 이 보정은 1~3곳 지원을 시험하는 데는 유효했으나 사용자에게는 `새 추천`이 아닌 같은 코스 확장처럼 보인다.

### 목표

입력 시간에 맞는 1~3곳 대표 코스와, 이전에 본 코스와 실질적으로 다른 검증 대안을 반환한다. 장소 수를 3곳으로 강제하지 않고, 대안 다양성을 위해 정확 경로 요청 4코스 상한을 넘기지 않는다.

1. 사전선정의 `1곳 최상위 + 2곳 최상위 + 3곳 최상위` 강제 우선 배치를 제거한다. 1~3곳 코스는 모두 후보로 남기되, 현행 시간 여유·공간 부담·분류·운영시간 사전 조건에 따른 단일 결정적 순위로 시작 후보를 선택한다. 이 점수는 계속 사전선정 전용이며 사용자에게 노출하지 않는다.
2. 대표 다음의 대안은 이미 선택한 코스의 장소 집합과 **부분집합 또는 상위집합 관계**이면 선택하지 않는다. 따라서 대표 `A` 뒤에 `A,B`, `A,B,C`를 새 추천으로 반환하지 않고, 대표 `A,B` 뒤에 `A` 또는 `A,B,C`도 반환하지 않는다. 순서만 다른 같은 장소 집합 차단은 기존대로 유지한다.
3. 위 관계가 아닌 후보 중에서, 이미 선택된 각 코스와 비교해 적어도 한 곳의 새로운 장소가 있고 현재 사전선정 점수가 가장 좋은 코스를 다음 대안으로 선택한다. 예를 들어 `A` 뒤에는 `B,C` 또는 `C`가 `A,B`보다 우선한다. 이 규칙은 활동 유형·시간·공간·운영시간 하드 조건을 완화하지 않는다.
4. 위 다양성 조건을 충족하는 검증 후보가 없으면, 중첩 코스를 낮은 품질의 대안으로 몰래 반환하지 않는다. `alternativeCourses`를 비우고 기존 `no_alternative_verified_course` 상태를 사용한다. UI는 이미 있는 `이 조건에서 다른 검증 코스가 없어요`를 그대로 표시한다.
5. 최대 4개의 **정확 경로 검증 후보 코스** 상한은 그대로다. 다양성 후보를 찾기 위해 다섯 번째 이후 코스를 검증하거나, 새 추천을 눌렀을 때 API를 다시 호출하지 않는다. 사전선정·대안 필터는 route adapter 호출 전 또는 검증 결과의 순수 집합 비교로 구현해 호출량을 늘리지 않는다.
6. 고정 fixture 테스트를 먼저 추가한다.
   - `A`, `A,B`, `A,C,B`, `B,C`, `D`가 경쟁할 때 `A`의 대안은 `B,C` 또는 `D`가 되고 부분/상위집합 코스는 반환되지 않는다.
   - 45/90/180분 각각에서 자연스러운 1/2/3곳 대표가 가능하며, 특정 장소 수를 무조건 우선하지 않는다.
   - 독립 대안이 없으면 `no_alternative_verified_course`가 되고 중첩 대안을 반환하지 않는다.
   - 1/2/3곳·왕복/도착지·조건부/hold/운영 종료 제외·siteGroup 충돌·정확 route 4코스 상한·새 추천 네트워크 0회 기존 회귀를 유지한다.
   - 실제 provider 190개 고정 입력에서도 후보 풀 18·순서 코스 5,220 상한과 사전선정 route 0회가 유지됨을 검증한다.
7. `src/engine/courseV1.ts`, 필요한 순수 타입/테스트만 수정한다. `추천로직.md`, `docs/테스트.md`, UI 문구, data/provider, adapter cache, DB를 직접 수정하지 않는다. 완료 후 통합·결정이 정책·요구사항 상태를 갱신한다.

### 완료 기준

- 중첩 예시 `A` → `A,B` → `A,C,B`가 고정 fixture에서 새 추천 대안으로 재발하지 않는다.
- 독립 대안이 없을 때 정직한 대안 없음 상태를 반환한다.
- 관련 엔진 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`가 통과한다.
- 변경 파일 / 유지한 4코스·정확경로·1~3곳 정책 / 테스트 결과 / 실제 사상→서면 재확인에 필요한 고정 입력을 이 작업기록에 인계한다.

---

## 2026-08-25 — 작업기록 운영 전환

- 이 파일은 앞으로 **추천 엔진 세션의 상세 지시·완료 기록만** 유지한다. 현재 2-H는 이 규칙으로 수행한다.
- 역할 간 상태·선행 조건·완료 산출물은 [작업 조정 보드](../../../작업조정_보드.md)에 한 줄로 기록한다. 데이터·UIUX·외부 API·DB의 상세 지시를 이 파일에 새로 누적하지 않는다.
- 기존 교차 역할 기록은 당시의 결정·감사 근거이므로 삭제·재작성하지 않는다.

---

## 2026-08-25 — 추천 엔진 완료: 2-H 대표·새 추천의 중첩 대안 제거

### 교체 기록

- **이전 방식:** 사전선정에서 1·2·3곳 각각의 최상위 코스를 강제로 앞에 배치했고, 검증 뒤에는 총시간이 짧은 코스부터 대표·대안으로 반환했다.
- **문제/관찰:** 대표 `A` 뒤에 `A,B`, `A,C,B`처럼 부분집합·상위집합 관계의 코스가 새 추천으로 이어져, 사용자에게 다른 추천이 아니라 같은 코스의 확장으로 보였다.
- **교체 방식:** 1~3곳 모두를 하나의 시간 적합성·공간 부담 사전선정 순위로 정렬해 최대 4개만 정확 경로 검증한다. 검증 완료 코스는 그 사전선정 순위를 보존하고, 이미 선택된 어느 코스와도 장소 집합이 부분집합 또는 상위집합인 대안은 제외한다.
- **교체 이유:** 장소 수를 강제하지 않으면서, 새 추천이 적어도 하나의 새로운 장소를 가진 실질적 대안만 순환하게 하기 위해서다.
- **상태:** 현행 구현.

### 변경 파일과 공개 계약

- `src/engine/courseV1.ts`
  - `preselectLimitedCourseV1`에서 1·2·3곳의 강제 우선 배치를 제거했다. 시간 여유·공간 부담·분류·운영시간 사전 조건의 단일 결정적 순위가 시작 후보를 정한다.
  - `selectNonNestedCourseV1`을 추가했다. 사전선정 순서의 검증 코스에서 순서만 다른 동일 집합은 기존 중복 제거를 유지하고, 부분집합·상위집합 코스는 대표·대안 조합에 함께 넣지 않는다.
  - 독립 대안이 없으면 `alternativeCourses: []`와 기존 `no_alternative_verified_course` 상태를 유지한다. 이 필터는 검증 완료 결과의 순수 집합 비교이므로 route adapter 호출을 추가하지 않는다.

- `src/engine/index.ts`
  - `selectNonNestedCourseV1`을 엔진 공개 계약으로 export했다.

- `test/course-v1-limited-integration.test.ts`
  - `A`, `A,B`, `A,C,B`, `B,C`, `D` fixture에서 반환 순서가 `A`, `B,C`, `D`만 남는지, 독립 대안이 없으면 `A` 하나만 남는지 검증한다.
  - 45/90/180분에서 1/2/3곳이 각각 시간 적합성에 따라 첫 후보가 되며, 장소 수를 강제하지 않는지 검증한다. 기존 왕복/도착지·조건부/운영시간/siteGroup·정확 경로 4코스 상한·대안 상세·190개 provider 상한 회귀를 유지한다.

### 유지한 공개 계약·정책 경계

- 정확 경로 검증은 여전히 최대 4개 코스다. 다양성 후보를 위해 다섯 번째 코스를 검증하거나 새 추천 시 API를 재호출하지 않는다.
- 1~3곳 구성, `conditional_more`/`hold`/`needs_review` 제외, 같은 `siteGroupId` 충돌 제외, 구조화 운영시간·권장 체류·도착 여유·실제 도보/대중교통 검증을 완화하지 않았다.
- UI·data/provider·외부 API adapter·DB·legacy planner와 제품 기준 문서는 수정하지 않았다.

### 검증 결과

- `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 26/26 통과
- `npm run test:typecheck` — 통과
- `npm test` — 72/72 통과
- `npm run test:ui` — 77/77 통과
- `git diff --check` — 통과

### 다음 결정·재현 조건

- 실제 체감 재확인은 고정 입력 `now`, 출발 `사상역(35.1627, 128.9856)`, 도착 `서면역(35.1578, 129.0594)`, `remainingMin: 180`, 확정 도착 여유와 provider/route adapter의 고정 응답으로 수행한다. 기대 결과는 대표 장소 집합의 부분집합·상위집합이 새 추천으로 이어지지 않는 것이다.
- 이번 엔진 회귀는 외부 API를 호출하지 않았다. 실제 TMAP/ODsay 응답의 다양성·응답 시간 관찰은 adapter 소유의 제한 수동 검증으로 분리한다.
- UIUX는 현 `alternativeCourses` 순서를 그대로 소비하므로 별도 화면 수정은 필요 없지만, 통합·결정 세션이 실제 사상→서면 체감 결과를 수락한 뒤 보드 상태를 갱신해야 한다.

---

## 2026-08-25 — 통합·결정 지시 2-I: 분 단위 시간예산과 대표·대안 코스 세트

**담당:** 추천 엔진 세션 (`src/engine/`, 순수 엔진 테스트). UI·data·외부 API adapter·DB는 수정하지 않는다.

### 확정 정책과 교체 이유

- **이전 방식:** 권장 체류 합계가 입력 시간을 많이 채우는 코스를 사전선정에서 앞세우고, 대표 한 개를 `새 추천`으로 대체했다. 그 결과 78분처럼 짧은 분 단위 입력에서 실제로 가능한 1곳 후보가 정확 경로 검증 전 밀릴 수 있었고, 180분에서는 3곳이 불필요하게 앞섰다.
- **교체 방식:** 시간은 분 단위 연속 예산이다. 1·2·3곳을 모두 검토하고, 각 코스가 권장 체류와 실제 도보·대중교통 경로·도착 여유를 포함해 시간 안에 끝나는지만 통과 조건으로 쓴다. 남는 시간은 실패가 아니며 채우지 않는다. 검증 완료 결과는 상단 대표 하나와 다른 코스 목록을 이루는 세트로 반환한다.
- **대표 규칙:** 검증 완료한 1·2곳 코스가 하나라도 있으면 그중에서 대표를 고른다. 3곳은 1·2곳이 전혀 없을 때만 대표가 될 수 있다. 유효한 3곳은 대안 목록에서 제외하지 않는다.
- **체류 표시 계약:** 엔진은 권장 체류만 일정에 사용·출력한다. `maxStayMin`은 이번 화면·시간 여정의 출력 계약에 넣지 않는다. 코스별 남는 시간은 엔진이 계산한 값으로 반환하고 UI가 재계산하지 않는다.

### 작업 지시

1. 구현 전에 기존 고정 fixture를 확장해 실패를 재현한다. 최소 입력은 `78분`, `120분`, `180분`과 왕복·도착지 각 하나이며, 78분에서 1곳 유효 코스가 2·3곳 시간 채우기 후보 때문에 검증 기회를 잃지 않는 경우를 포함한다. 실제 외부 API 호출은 하지 않는다.
2. `abs(availableActivityMin - recommendedStayTotal)`처럼 남는 시간을 벌점으로 만드는 사전선정 규칙을 제거한다. 1·2·3곳 후보군은 모두 만들되, 장소 수나 체류 합계만으로 긴 입력에 2·3곳을 강제하지 않는다.
3. 사전선정은 4개 정확 경로 상한 안에서도 다음을 만족하도록 결정적으로 구성한다. (a) 1곳의 넓은 탐색 후보가 가까운 다장소 후보만으로 밀려나지 않을 것, (b) 1·2곳의 서로 다른 유효 코스를 우선 검증할 기회를 가질 것, (c) 3곳은 유효하면 대안 후보로 남을 것. 단순 거리 반경 확대나 route 요청 상한 증가는 해결책으로 쓰지 않는다. 후보 풀·사전 점수·다양성 선택의 변경 근거와 반례를 기록한다.
4. 실제 경로 검증 뒤에만 대표을 선택한다. 1·2곳 검증 코스 중 이동 부담, 권장 체류 적합성, 운영시간·체류 근거, 활동/장소 중복 회피를 비교해 대표을 정한다. 이 비교는 `남는 시간이 적을수록 좋다`가 되어서는 안 된다. 3곳은 위 조건의 fallback만 허용한다.
5. `alternativeCourses`는 대표와 실질적으로 다른 검증 코스만 담는다. 2-H의 동일 집합·부분집합·상위집합 차단을 유지하고, 3곳 검증 코스도 이 조건만 충족하면 포함한다. 후보가 부족하면 빈 목록을 정직하게 반환한다. 새 추천을 누를 때 추가 route 검증을 시작하는 동작은 추가하지 않는다.
6. 각 검증 코스에 `remainingAfterCourseMin`(입력 종료까지 남는 분)을 불변 스냅샷으로 추가한다. 값은 `입력 시간 - 실제 전체 이동 - 권장 체류 합계 - 도착 여유`와 일치해야 하며 음수일 수 없다. UI가 시간값을 다시 계산하도록 만들지 않는다. 기존 `legs/stops` 순서·권장 체류·운영시간 상태 계약과 호환되게 타입·fixture를 갱신한다.
7. 아래 순수 회귀를 추가한다.
   - 78·120·180분 및 `78분` 같은 비정시 입력에서 모든 반환 코스가 권장 체류 기준으로 시간 안에 끝나고, 남는 시간이 있어도 체류·장소 수가 자동 증가하지 않는다.
   - 유효한 1·2곳이 있으면 대표이 3곳이 아니며, 3곳 유효 코스는 대안 목록에 남을 수 있다.
   - 한 곳의 추가 이동이 권장 체류에 비해 터무니없이 큰 후보는 낮은 순위 또는 제외가 되지만, 고정 비율 하나로 경계 후보를 전부 배제하지 않는다.
   - `remainingAfterCourseMin`, 실제 legs, stops의 권장 체류, arrival buffer가 서로 일치한다.
   - 2-H의 비중첩 대안, `representative_core/standard`만 사용, 운영시간·siteGroup 차단, 왕복/도착지, 정확 route 최대 4개, 사전선정 route 0회, 새 추천 시 route 0회 회귀를 유지한다.
8. `src/engine/`, 필요한 순수 타입·테스트만 수정한다. UI 화면·카탈로그·adapter cache·DB·제품 기준 문서는 수정하지 않는다.

### 완료 기준

- 위의 실패 fixture가 먼저 실패하고, 구현 뒤 통과한다.
- 반환값만으로 UI가 상단 대표·하단 목록·권장 체류·남는 시간을 재계산 없이 표시할 수 있다.
- 관련 엔진 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`를 통과한다.
- 변경 파일 / 유지한 4개 정확 검증·자동 후보 등급·외부 호출 경계 / 테스트 결과 / UIUX에 인계할 타입·fixture 예시 / 이동·체류 균형에서 추가 사용자 결정이 필요한 경계 조건을 이 문서 끝에 기록한다.

---

## 2026-08-25 — 추천 엔진 완료: 2-I 분 단위 시간예산과 대표·대안 코스 세트

### 교체 기록

- **이전 방식:** 사전선정이 `abs(남은 활동 예산 - 권장 체류 합계)`를 큰 우선순위로 사용해, 입력 시간을 많이 채우는 2·3곳 코스를 앞세웠다.
- **문제/관찰:** 78분 같은 분 단위 입력에서 실제로 가능한 1곳 코스가 정확 경로 검증 전에 밀릴 수 있었고, 180분은 3곳을 필요 이상으로 앞세울 수 있었다. 남는 시간은 실패가 아닌데도 사실상 벌점으로 작동했다.
- **교체 방식:** 사전선정에서 체류 합계·남는 시간을 점수로 쓰지 않는다. 공간 관련성만으로 후보 풀을 정렬하고, 1곳·서로 다른 2곳·3곳 코스에 각각 정확 검증 기회를 준 뒤 최대 4개에서 멈춘다. 실제 검증 후 1·2곳이 하나라도 있으면 그중 이동 부담 대비 권장 체류가 나은 코스를 대표로 고르고, 3곳은 독립·비중첩 대안이면 목록에 남긴다.
- **교체 이유:** 시간은 연속 분 단위 예산이며, 남는 시간을 억지로 장소나 체류로 채우지 않기 위해서다.
- **상태:** 현행 구현.

### 변경 파일과 공개 타입

- `src/engine/courseV1.ts`
  - `VerifiedCourseV1.remainingAfterCourseMin`을 추가했다. 새 엔진 결과에는 항상 `remainingMin - travelMin - stayMin - arrivalBufferMin` 값이 있으며 음수가 아니다. UI가 legs/stops를 다시 합산하지 않는 스냅샷이다.
  - 이전 `remainingAfterArrivalBufferMin`은 같은 값을 유지하는 호환 필드다. 기존 UI/저장 fixture가 새 필드를 아직 만들지 않는 동안 타입만 선택값으로 유지했으며, 실제 엔진 출력은 항상 두 필드를 함께 넣는다.
  - `selectRepresentativeCourseSetV1`을 추가했다. 실제 검증 후 유효한 1·2곳 코스가 있으면 3곳을 대표로 고르지 않고, 이동 부담(`실제 이동 / 권장 체류`)·실제 이동·장소 수·ID 순으로 결정한다. 이 비교는 남는 시간을 점수로 사용하지 않는다.
  - `preselectLimitedCourseV1`에서 `abs(availableActivityMin - recommendedStayTotal)` 및 후보 풀의 체류 적합성 정렬을 제거했다. 2-H의 동일/부분/상위집합 대안 제거와 4개 정확 경로 상한은 유지한다.

- `src/engine/index.ts`
  - `selectRepresentativeCourseSetV1`을 export했다.

- `test/course-v1-limited-integration.test.ts`
  - 78분 왕복에서 유효한 1곳이 2·3곳 후보 때문에 검증 기회를 잃지 않는 fixture, 실제 검증 뒤 1·2곳 대표 우선과 독립 3곳 대안 fixture를 추가했다.
  - 78/120/180분 및 왕복/도착지 fixture에서 권장 체류·실제 legs·도착 여유·`remainingAfterCourseMin`의 합계 일치를 검증한다.
  - 기존 2-H의 “시간에 따라 장소 수를 채운다” 기대는 2-I 정책과 충돌해 철회했다. 대신 모든 예산에서 1·2·3곳을 후보로 검토하되 체류 합계로 장소 수를 강제하지 않는 계약으로 교체했다.

### 유지한 공개 계약·정책 경계

- `representative_core/representative_standard`만 자동 후보로 쓰며, 조건부·hold·`needs_review`·운영 종료·siteGroup 충돌을 계속 차단한다.
- 모든 반환 코스는 실제 도보/대중교통 전체 구간, 권장 체류, 구조화 운영시간, 도착 여유를 통과한다. `maxStayMin`은 이 출력 계약에 추가하지 않았다.
- 정확 경로 검증은 최대 4개 코스이며, 사전선정은 route adapter를 호출하지 않는다. 새 추천은 검증 완료 `alternativeCourses`만 소비하고 추가 route 요청을 시작하지 않는다.
- UI·카탈로그·provider·adapter cache·DB·제품 기준 문서는 수정하지 않았다.

### UIUX/DB 인계 예시

```ts
const course = result.representativeCourse;
// course.remainingAfterCourseMin: 엔진이 계산한 남는 분 (새 결과에는 항상 존재)
// course.stops: 권장 체류·검증 운영 상태·도착/출발 스냅샷
// course.legs + course.arrivalBufferMin: 실제 이동과 마지막 도착 여유
```

UI/DB는 위 값을 저장·표시하고, 권장 체류나 남는 시간을 다시 계산하지 않는다. 이전 fixture 호환 필드 `remainingAfterArrivalBufferMin`은 마이그레이션 기간에만 같은 값으로 함께 온다.

### 검증 결과

- `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 29/29 통과
- `npm run test:typecheck` — 통과
- `npm test` — 72/72 통과
- `npm run test:ui` — 77/77 통과
- `git diff --check` — 통과

### 다음 결정 필요 사항·위험

- 대표 비교의 현행 이동 부담은 고정 비율 하드 컷이 아니라 `실제 이동 / 권장 체류`의 상대 순위다. 예를 들어 이동 50분·체류 15분 후보를 절대 제외할지, 충분한 시간과 다른 후보 부재 시에는 표시할지를 제품 결정으로 확정해야 한다. 현재는 시간·운영시간을 통과하면 낮은 순위로 남긴다.
- UIUX/DB 세션은 새 스냅샷 필드를 의무화할 시점에 기존 fixture·저장 payload에서 `remainingAfterCourseMin`을 required로 승격할 수 있다. 그 전까지 엔진 런타임 출력은 값을 보장하지만 타입은 역호환 선택값이다.

---

## 2026-08-25 — 통합·결정 검토: 2-I 조건부 수락과 2-I-R 보완 지시

### 수락한 부분

- `remainingAfterCourseMin`을 실제 경로·권장 체류·도착 여유에서 엔진이 계산해 반환하고, 남는 시간을 점수 벌점에서 제거한 것은 정책과 맞는다.
- 대표은 검증된 1·2곳을 우선하고 3곳은 대안으로 남기며, 비중첩 필터·자동 후보 등급·4개 정확 경로 상한을 유지한 것도 수락한다.
- 고정 78/120/180분 및 왕복/도착지 fixture, 29개 엔진 테스트와 전체 테스트 통과 기록은 확인했다.

### 수락하지 못한 부분

`selectSpatialCandidatePool()`은 공간 부담이 작은 순서의 처음 18개만 보관한다. 그 다음 `addFirst(1, false)`는 그 18개 안에서만 한 곳 코스를 고른다. 따라서 가까운 다장소 후보가 많은 생활권에서는 19번째 이후의, 시간에는 맞지만 더 넓은 범위의 한 곳 후보가 **후보 풀 자체에 들어오지 못한다**.

이는 2-I의 “한 곳의 넓은 탐색 후보가 가까운 다장소 후보만으로 밀려나지 않을 것”을 만족하지 못한다. 현재 78분 fixture는 후보 네 곳 모두 같은 가까운 풀에 있어 이 반례를 검증하지 않는다.

### 명령 2-I-R — 후보 풀 안의 넓은 1곳 탐색 lane 보완

1. `COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT = 18`과 정확 경로 최대 4코스 상한은 유지한다. 전체 부산 후보를 모두 실제 경로 검증하거나 반경 상한을 완화하지 않는다.
2. 후보 풀을 단순한 공간 부담 상위 18개로만 만들지 않는다. 기본 근접/경로 관련 후보를 유지하면서, **같은 자동 후보 집합 안의 더 바깥 탐색 구간에서 한 곳 코스로 검토할 대표 후보를 최소 하나 포함**한다. 이 후보도 출발→도착/복귀의 공간 관련성으로 선별해야 하며, 무작위·인기도·소비·근거 없는 발견성으로 고르면 안 된다.
3. 사전선정 4코스에는 적어도 근접 1곳과 위 넓은 1곳이 각각 검증 기회를 갖도록 한다. 남은 슬롯은 2곳·3곳 및 비중첩 다양성에 사용하되, 모든 경우에 1·2·3곳 수를 강제하지 않는다.
4. 실패 fixture를 먼저 추가한다: 공간 점수 상위 18개는 실제 경로 시간 초과 또는 경로 실패이고, 19번째 이후의 공간 관련 한 곳은 권장 체류·도착 여유를 포함해 유효한 경우다. 보완 뒤 그 한 곳이 최대 4개 안에서 실제 검증되어 대표 또는 대안이 되는지 검증한다. 왕복과 도착지 입력을 각각 하나씩 포함한다.
5. 2-I의 78/120/180분·남는 시간·1/2 대표 우선·3곳 대안·운영시간·등급·siteGroup·비중첩·route 호출 상한 회귀를 유지한다. UI·data·adapter·DB·제품 기준 문서는 수정하지 않는다.

**완료 기준:** 넓은 한 곳 lane의 선택 근거와 반례 fixture가 기록되고, 해당 후보가 가까운 18개에 밀리지 않는 것을 실제 route fixture로 보인다. 관련 엔진 테스트, `npm run test:typecheck`, `npm test`, `git diff --check` 통과 뒤 이 문서에 인계한다.

## 2026-08-25 — 추천 엔진 완료: 2-I-R 넓은 1곳 탐색 lane

### 교체 기록

- **이전 방식:** 공간 부담 순위의 처음 18개만 후보 풀에 넣고, 그 풀에서만 1곳 코스를 골랐다.
- **문제/관찰:** 근접 후보가 18개를 채우면, 출발→도착 또는 복귀 경로와 여전히 공간 관련이 있는 19번째 이후 1곳은 정확 경로 검증 대상이 될 수 없었다. 시간·운영시간이 유효해도 후보 풀 경계에서 탈락했다.
- **교체 방식:** 18개 상한은 유지하되, 공간 순위의 근접 기본 후보 17개와 그 다음 바깥 탐색 구간의 대표 1개(기존 순위 19번째)를 함께 보관한다. 18번째는 바깥 lane의 경계로만 사용하고 풀에는 넣지 않는다. 사전선정은 근접 1곳과 이 바깥 1곳에 각각 정확 검증 기회를 먼저 주고, 남은 슬롯에서 2·3곳·비중첩 다양성 후보를 선택한다.
- **교체 이유:** 정확 경로 호출을 4개로 제한한 채, 인기도·소비·무작위 신호 없이 출발→도착/복귀 공간 부담만으로 넓은 단일 장소 반례를 검증할 수 있게 하기 위해서다.
- **상태:** 현행 구현.

### 변경 파일과 공개 계약

- `src/engine/courseV1.ts`
  - `selectSpatialCandidatePool`을 근접 17개 + 공간 순위 19번째의 넓은 1곳 lane으로 변경했다. 자동 후보 등급·구조화 운영시간·siteGroup 중복 제거 뒤의 동일 후보 집합만 사용한다.
  - `CourseV1PreselectionResult`와 제한 조립 diagnostics에 `wideSingleCandidateId`를 추가해, 어떤 후보가 넓은 1곳 lane으로 예약됐는지 결정적으로 관찰할 수 있게 했다.
  - 4개 정확 검증 후보에 근접 1곳과 넓은 1곳을 먼저 넣고, 이후 기존 2곳 독립 후보·3곳 후보·공간 순위 fallback을 적용한다.

- `test/course-v1-limited-integration.test.ts`
  - 왕복과 별도 도착지 각각에서 공간 상위 18개가 route fixture 실패, 19번째 공간 관련 1곳만 권장 체류·8분 도착 여유까지 통과하는 실패 우선 fixture를 추가했다.
  - 두 fixture 모두 넓은 후보가 후보 풀·사전선정·실제 route 호출에 포함되고 대표가 되는지, 근접 단일 후보도 함께 검증 기회를 받는지, 정확 검증 수가 4개 이하인지 확인한다.

### 유지한 공개 계약·정책 경계

- `COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT = 18`, 생성 순서 코스 최대 5,220개, 실제 정확 경로 검증 최대 4개를 변경하지 않았다. 반경을 완화하거나 전체 부산 후보를 정확 검증하지 않았다.
- 공간 점수는 사전선정에만 사용하며 실제 거리·시간·성공 판정·화면 값으로 반환하지 않는다. 실제 도보/대중교통 경로, 권장 체류, 구조화 운영시간, 도착 여유가 계속 최종 통과 조건이다.
- 2-I의 분 단위 예산·남는 시간 스냅샷·1/2곳 대표 우선·3곳 대안과 2-H의 비중첩 필터, 등급/siteGroup 차단을 유지했다. UI·data/provider·외부 API adapter·DB·제품 기준 문서는 수정하지 않았다.

### 검증 결과

- `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 31/31 통과
- `npm run test:typecheck` — 통과
- `npm test` — 72/72 통과
- `npm run test:ui` — 80 통과, 1 기존 철회 이력 fixture skip, 실패 0
- `git diff --check` — 통과

### 다음 결정 필요 사항·위험·재현 조건

- 현행 lane은 근접 17개 뒤의 **19번째 공간 순위**를 넓은 1곳의 결정적 대표로 삼고, 18번째는 의도적으로 경계 후보로만 둔다. 상한 18을 고정하면서 더 넓은 구간을 위한 자리를 확보한 선택이다. 실제 사용성 검토에서 18번째도 유지해야 한다면, 상한·정확 경로 호출량을 바꾸지 않는 별도 대표성 규칙(예: 공간 구간별 버킷)을 통합·결정 세션이 정해야 한다.
- 재현 고정 입력: `now: 2026-08-24T10:00:00+09:00`, `remainingMin: 78`, `arrivalBufferMin: 8`, 대표/표준·항상 접근 가능 후보 19개. 공간 상위 18개 route는 `null`, 19번째의 왕복은 `origin→wide: 10`, `wide→origin: 10`; 도착지는 `origin→wide: 10`, `wide→destination: 10`이다. 기대값은 wide 1곳이 43분 총 소요·35분 남음으로 최대 4회 안에 검증되어 대표가 되는 것이다.

---

## 2026-08-26 — 통합·결정 지시 2-J: cache miss 예산 기반 다양한 코스 검증

**선행 조건:** QA-03 측정 결과와 사용자 결정, API-4-A의 서버 adapter 계약이 모두 수락된 뒤 시작한다.

현재의 고정 4코스 상한을 임의로 늘리지 않는다. 서버 adapter가 제공하는 구간 cache hit/miss·잔여 제공사 예산을 받아, 이미 캐시된 구간을 공유하는 비중첩 코스를 우선 실제 검증하고 대표+대안 목표를 확보하면 중단하는 순수 엔진 전환을 설계한다. 새 구간 요청 예산, 넓은 한 곳 공간 구간, 결과 코스 최대 수는 QA-03 결과와 사용자 결정 전에는 숫자로 고정하지 않는다. 실제 API·UI·DB·카탈로그는 수정하지 않으며, route fixture로 비용·다양성·시간 신뢰를 검증한다.

### 제공사 전환 선행 조건 정정 (2026-08-26)

API-4-B와 API-4-A 완료 뒤에만 시작한다. 엔진은 `카카오 대중교통`, `카카오 도보`, `TMAP 도보`라는 provider-neutral route 결과와 cache hit/miss·예산 상태만 소비한다. ODsay를 직접 호출하거나, 제공사 이름을 순위 신호로 사용하거나, 대중교통 실패를 근사/도보 성공으로 오인해 통과시키지 않는다. 도보 제공사 균형·fallback·일일 한도 배정은 adapter 소유이며 엔진이 재구현하지 않는다.

---

## 2026-08-28 — 통합·결정 지시 2-K: 분 단위·다양성 중심의 제한 사전선정 보정

**상태:** 진행 예정. 이 작업은 Route Proxy 활성화와 무관한 순수 엔진 작업이다. `2-J`의 cache hit/miss·제공사 예산 소비, 실제 API 호출, 4회 상한 증가는 계속 대기한다.

### 배경과 목표

현재 V1은 자동 대표 후보 190개에서 공간 관련 후보 18개, 정확 경로 검증 후보 최대 4개라는 비용 경계를 갖는다. `2-H`, `2-I`, `2-I-R`로 부분집합 대안·시간 채우기·넓은 한 곳 누락은 해결했지만, 실제 체감에서는 짧은 시간에 코스가 없거나 밀집 생활권에서 비슷한 장소만 먼저 검증될 위험이 남아 있다.

이 작업의 목표는 시간을 `45/60/78/90/120/180분` 같은 **연속 분 단위 예산**으로 취급하면서, 최대 4회의 실제 경로 검증 안에서도 사용자가 비교할 수 있는 서로 다른 코스 기회를 공정하게 배분하는 것이다. 성공의 의미는 시간을 억지로 채우거나 모든 입력에서 여러 코스를 만들어 내는 것이 아니다. fixture에 서로 다른 유효 코스가 있으면 대표 1개와 독립 대안을 놓치지 않고, 실제로 하나만 가능하면 하나만 정직하게 반환하는 것이다.

### 담당·변경 경계

추천 엔진 세션은 `src/engine/`, 필요한 순수 타입, `test/course-v1*.test.ts`, 이 작업기록만 수정한다.

다음은 수정하거나 호출하지 않는다: React/UIUX, 카탈로그·장소 체류 원본, provider/adapter/cache/예산, Supabase, 실제 Kakao·TMAP·ODsay API, 제품 기준 문서. ODsay 제거와 `courseV1RouteAdapter` 기본 전환은 외부 API 활성화 작업의 책임이며 이 작업에서 우회하지 않는다.

### 현행 정책으로 고정할 것

1. 자동 추천은 `representative_core`·`representative_standard`와 구조화 운영시간을 통과한 후보만 사용한다. `conditional_more`, `hold`, `needs_review`, 운영 종료, 동일 `siteGroupId` 충돌은 계속 제외한다.
2. 모든 반환 코스는 실제 도보/대중교통 전체 구간, 각 장소의 **권장 체류**, 도착 여유를 포함해 입력 시간 안에 끝나야 한다. 남는 시간은 성공이며 체류시간·장소 수를 늘리는 점수나 후처리로 쓰지 않는다.
3. 1·2·3곳을 모두 논리 후보로 만들되, 상단 대표는 검증된 1·2곳을 우선한다. 3곳은 유효해도 대안 목록에 남길 수 있으나, 대표·사전선정에서 장소 수만으로 앞세우지 않는다.
4. 이동 대비 권장 체류의 균형은 **soft ranking**만 한다. 긴 이동·짧은 체류를 전역 고정 비율로 탈락시키지 않으며, 시간·운영시간을 통과하고 대안이 부족하면 낮은 순위로 남을 수 있다.
5. `COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT = 18`, 순서 코스 최대 5,220개, 정확 경로 검증 최대 4개, 새 추천의 추가 네트워크 0회, 2-H 비중첩 대안 규칙, 2-I-R의 근접 1곳 + 넓은 1곳 lane을 유지한다.

### 수행 순서

1. **실패 진단 fixture를 먼저 만든다.** 실제 provider를 호출하지 않고 provider-neutral `RouteAdapter` fixture로 다음을 재현한다. 각 fixture는 `now`, 출발/도착 또는 복귀 좌표, 입력 분, 도착 여유, 장소별 권장 체류, 모든 leg의 실제 분 값을 명시한다.

   | ID | 고정 상황 | 구현 전 관찰할 실패/위험 | 구현 후 기대 |
   | --- | --- | --- |
   | K-01 | 45분 왕복, 20분 권장 체류 한 곳만 유효 | 30분 체류·다장소 후보가 먼저 선택되어 유효 단일 코스가 검증 기회를 잃음 | 유효 1곳이 4회 안에 검증·반환되고, 남는 시간이 작다는 이유로 체류를 늘리지 않음 |
   | K-02 | 78분, 20/30/45분 체류가 섞인 밀집 후보 | 가까운 같은 활동/장소 집합의 부분·상위 코스가 사전선정 슬롯을 점유 | 대표와 대안은 서로 비중첩이며 fixture에 있는 독립 1·2곳 코스가 검증 기회를 가짐 |
   | K-03 | 90분 별도 도착지, 근접 1곳은 실제 route 실패·넓은 1곳은 유효 | 근접 실패 뒤 유효한 넓은 한 곳이 4회 밖으로 밀림 | 근접 lane과 wide lane이 각각 검증되고 넓은 유효 코스가 반환됨 |
   | K-04 | 120분, 60분 한 곳과 20+30분 두 곳이 모두 유효 | 입력 시간이 길다는 이유로 두 곳만 우선하거나, 남는 시간을 최소화한 코스만 선택 | 1·2곳을 모두 검토하고 실제 이동 부담·권장 체류의 soft ranking으로 대표를 결정 |
   | K-05 | 180분, 독립 1곳·2곳·3곳이 모두 유효 | 3곳이 장소 수/체류 합계만으로 대표가 되거나, 3곳 때문에 1·2곳 대안을 밀어냄 | 대표은 1·2곳, 3곳은 독립이면 대안으로 반환 |
   | K-06 | 유효 코스가 정확히 하나인 60·120분 입력 | 대안 수를 맞추려 중첩·시간 초과·근사 경로를 반환 | 대표 하나와 정직한 `no_alternative_verified_course`만 반환 |

2. **사전선정 슬롯을 코스 포트폴리오로 보정한다.** 기존 점수 하나를 단순 정렬해 상위 4개만 뽑는 방식이 위 fixture의 독립 유효 코스를 놓친다면, 다음 우선순위로 최대 4개의 검증 후보를 결정적으로 구성한다.
   - 근접 단일 후보 1개와 2-I-R의 넓은 단일 후보 1개는 각각 기회를 유지한다.
   - 남은 슬롯에서는 이미 예약된 장소 집합의 부분집합·상위집합이 아닌 2곳 후보를 먼저 고려한다.
   - 3곳 후보는 독립 집합이며 사전 공간·시간 하한이 합리적인 경우에만 마지막 슬롯 후보가 된다. 3곳이 없거나 중첩이면 남은 1·2곳 후보로 채운다.
   - 후보 수가 부족한 경우에는 없는 유형을 억지로 만들지 않는다. 검증 후보가 4개보다 적을 수 있다.
   - 공간 관련성·권장 체류·입력 시간 대비 최소 부담은 **순위·slot 배정**에만 쓰며, straight-line/근사값만으로 최종 불가 판정하지 않는다. 실제 route 결과만 통과·표시·시간값의 근거다.

3. **대표·대안 선택을 다시 대조한다.** 실제 검증 완료 코스만 대상으로 `selectRepresentativeCourseSetV1`의 순서를 확인한다. 1·2곳 우선, 권장 체류 대비 실제 이동 부담의 soft ranking, 비중첩 대안, 남는 시간 무벌점 규칙이 함께 성립해야 한다. 사전선정의 임시 순위가 사용자 표시 순서로 새지 않도록 한다.

4. **관찰 가능한 diagnostics를 추가 또는 보완한다.** 외부 API·좌표 원문을 노출하지 않는 순수 결과 안에서, 테스트가 `nearSingle`, `wideSingle`, `independentTwo`, `independentThree` 중 어떤 slot이 선택·누락됐는지 결정적으로 확인할 수 있게 한다. 사용자 화면·navigation·저장 payload에는 이 diagnostic을 전달하지 않는다. 기존 공개 타입을 넓혀야 한다면 optional 추가 후 호환 fixture를 함께 갱신한다.

5. **회귀를 실행한다.** 위 K-01~06 외에 왕복/별도 도착지, 1·2·3곳, 20·30·45·60분 권장 체류, 운영시간 종료, 동일 siteGroup, 조건부·hold 제외, route `null`, 실제 도보/대중교통, 정확 route 4회 상한, 사전선정 route 0회, 새 추천 route 0회를 모두 유지한다. 입력 분은 정시 단위로 반올림하지 않는다.

### 완료 기준

- K-01~K-06이 구현 전 실패 또는 현행 위험을 명확히 재현하고, 구현 뒤 모두 통과한다.
- fixture 안에 대표와 두 개 이상의 독립 유효 코스가 존재하면 4회 이내 검증 결과가 가능한 대로 대표 + 독립 대안을 반환한다. 독립 유효 코스가 하나뿐이면 수를 부풀리지 않는다.
- 시간 초과·근사 route·운영 불가·중첩 코스는 "다양성"을 위해 반환되지 않는다.
- 정확 경로 검증 상한을 늘리지 않고, 실 API 호출·cache/budget 소비·UI 변경 없이 완료한다.
- 관련 엔진 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`가 통과한다.
- 완료 기록에는 변경 파일, 변경하지 않은 외부 API/정책 경계, K-01~K-06별 결과, 검증 후보 slot별 호출 횟수, 다음 2-J에서만 결정할 cache-miss 예산 문제를 남긴다.

---

## 2026-08-28 — 추천 엔진 완료: 2-K 분 단위·다양성 중심 제한 사전선정

### 교체 기록

- **이전 방식:** 근접 1곳, 넓은 1곳, 2곳, 3곳을 순서대로 넣었지만 각 슬롯의 실제 장소 집합 독립성·선택 여부를 결과에서 관찰할 수 없었다. 3곳은 기존 슬롯과 장소가 겹쳐도 먼저 검증될 수 있었다.
- **문제/관찰:** 45~180분의 연속 예산에서 검증 4회는 유지했지만, 밀집 후보가 같은 장소를 포함한 코스를 여러 번 점유하는지와 독립 1·2·3곳이 각각 기회를 얻었는지 재현 가능한 방식으로 증명할 수 없었다.
- **교체 방식:** 사전선정 결과에 `nearSingle`, `wideSingle`, `independentTwo`, `independentThree` 슬롯 diagnostics를 추가했다. 근접/넓은 단일 후보를 먼저 예약하고, 2곳·3곳 슬롯은 이미 예약된 코스와 **장소를 공유하지 않는** 후보만 배정한다. 3곳 독립 후보는 권장 체류 합계와 도착 여유만으로도 입력 시간을 넘지 않는 경우에만 마지막 독립 슬롯에 넣는다. 남은 자리는 기존 1~3곳 검토 계약을 보존하는 fallback으로만 채우며, fallback 3곳은 `independentThree: null`로 남긴다.
- **교체 이유:** 실제 route 전에 추정 시간으로 통과·탈락을 결정하지 않으면서도, 네 번의 정확 검증을 서로 다른 코스 기회에 우선 배분하기 위해서다. 남는 시간은 점수·체류 연장 조건으로 사용하지 않았다.
- **상태:** 현행 구현.

### 변경 파일과 공개 계약

- `src/engine/courseV1.ts`
  - `CourseV1PreselectionSlots`와 `preselectionSlots` diagnostics를 추가했다. 기존 UI/저장 fixture 호환을 위해 공개 타입은 선택값이지만, 새 엔진 런타임 결과는 항상 네 슬롯을 문자열 또는 `null`로 반환한다.
  - 사전 공간 부담이 같은 경우에만 권장 체류가 짧은 코스를 먼저 검토한다. 이는 남는 시간을 채우는 점수나 최종 제외가 아니라, 제한된 슬롯의 soft tie-break다.
  - `independentTwo`·`independentThree`은 앞선 슬롯과 장소를 공유하지 않는 코스만 선택한다. 실제 도보/대중교통 route·운영시간·권장 체류·도착 여유는 기존처럼 검증 단계에서만 통과시킨다.

- `test/course-v1-limited-integration.test.ts`
  - K-01~K-06 고정 fixture를 추가했다. 45/60/78/90/120/180분, 왕복/도착지, 20/30/45/60분 권장 체류, route `null` 및 실제 route 분 값을 모두 주입한다.
  - 78분 밀집 후보의 독립 1·2곳, 180분의 독립 1·2·3곳, 유일 유효 코스의 정직한 대안 없음, 넓은 1곳 lane을 각각 검증한다.

### K-01~K-06 결과와 슬롯별 검증 기회

| Fixture | 결과 |
| --- | --- |
| K-01 | 45분 왕복에서 20분 유효 1곳이 30분 다장소 후보와 함께 있어도 `nearSingle`로 검증되어 반환됐다. 남는 4분 때문에 체류를 늘리지 않았다. |
| K-02 | 78분 밀집 후보에서 근접 1곳과 장소를 공유하지 않는 2곳이 각각 검증되고, 반환 세트는 비중첩이다. 실제 이동/권장 체류 soft ranking에 따라 2곳이 대표가 될 수 있음을 허용했다. |
| K-03 | 90분 도착지에서 근접 lane과 wide lane이 각각 검증되며, 근접 route 실패 뒤 넓은 유효 1곳이 반환됐다. |
| K-04 | 120분의 60분 1곳과 20+30분 2곳을 함께 검증했다. 대표은 장소 수·남는 시간이 아니라 실제 이동 대비 권장 체류의 soft ranking으로 결정됐다. |
| K-05 | 180분에서 장소를 서로 공유하지 않는 1·2·3곳 슬롯을 모두 검증했다. 대표은 1·2곳이고 독립 3곳은 대안으로 남았다. |
| K-06 | 60·120분에서 유효 코스가 하나뿐이면 `no_alternative_verified_course`와 빈 대안을 반환했다. |

- 슬롯별 코스 검증 기회는 `nearSingle` 1회, 후보가 있을 때 `wideSingle` 1회, `independentTwo` 1회, `independentThree` 1회다. 모든 슬롯이 있어도 정확 코스 검증은 최대 4회이며, 각 코스의 leg 수에 따른 adapter 호출 수는 route cache 재사용 여부에 따라 달라진다. 이 작업은 API/HTTP 호출 수를 만들거나 측정하지 않았다.

### 유지한 공개 계약·정책 경계

- 후보 풀 18개, 순서 코스 최대 5,220개, 정확 route 최대 4개, 사전선정 route 0회, 새 추천 route 0회를 변경하지 않았다.
- `representative_core / representative_standard`, 구조화 운영시간, 권장 체류, 도착 여유, `siteGroupId` 충돌, 조건부·hold·needs_review 제외, 2-H 비중첩 반환, 2-I-R 넓은 1곳 lane을 유지했다.
- UI·카탈로그·provider·route adapter/cache·제공사 예산·Supabase·실제 Kakao/TMAP/ODsay API·제품 기준 문서는 수정하거나 호출하지 않았다.

### 검증 결과

- `npx tsx --test test/course-v1.test.ts test/course-v1-limited-integration.test.ts test/course-v1-candidate-provider.test.ts test/course-v1-route-adapter.test.ts` — 43/43 통과
- `npm run test:typecheck` — 통과
- `npm test` — 97/97 통과
- `npm run test:ui` — 103 통과, 기존 철회 이력 fixture 1건 skip, 실패 0
- `git diff --check` — 통과

### 다음 결정 필요 사항·2-J 경계

- 이 구현은 route cache hit/miss, 제공사별 HTTP attempt, 잔여 예산을 읽거나 변경하지 않는다. cache-miss 비용으로 네 슬롯의 우선순위·검증 중단 조건을 조정하는 일은 API-4-A/4-B 및 QA-03 수락 뒤의 **2-J**에서만 결정한다.
- fallback 3곳은 기존 1~3곳 검토 계약을 유지하기 위한 마지막 기회이며 `independentThree` 슬롯으로 표기하지 않는다. 제품이 fallback 3곳까지 완전히 금지할지, 또는 현재처럼 실제 1·2곳 route가 모두 실패할 수 있는 상황에서 유지할지는 통합·결정 세션이 실제 체감 fixture로 재확인할 수 있다.

### 2026-08-28 — 통합·결정 검토: 2-K 수락

`nearSingle`·`wideSingle`·`independentTwo`·`independentThree` diagnostics는 사용자 화면과 저장 payload에 노출되지 않으면서도, 4회의 정확 경로 검증이 서로 다른 장소 집합에 배정됐는지 고정적으로 관찰하게 한다. 45/60/78/90/120/180분과 왕복/도착지·20~60분 권장 체류·route 실패·유일 유효 코스 fixture가 시간 채우기, 3곳 강제, 중첩 대안의 재도입 없이 통과했다.

따라서 2-K를 수락한다. fallback 3곳은 독립 1·2곳이 실제 route에서 모두 실패하는 경우의 기존 3곳 대표 fallback을 보존하는 것으로, 현행 1~3곳 정책과 충돌하지 않는다. cache-miss 예산을 이용한 검증 확장·중단은 여전히 Proxy 활성화 뒤의 2-J에서만 다룬다.

---

## 2026-08-29 — 통합·결정 최신 지시 2-J: 8회 provider attempt 예산의 코스 보충·근거 반환

> 이 지시는 2026-08-26의 2-J 초안에서 정하지 못했던 새 provider attempt 예산·탈락 보충·6개 생활권 fixture를 확정해 대체한다. 2-K의 분 단위·1~3곳·18개 장소 풀·근접/넓은 한 곳 lane·사전선정 방향은 유지한다.

### 목표와 범위

현재 고정 `exactCourseAttemptCount <= 4` 때문에 초반 코스가 실제 route·운영시간·시간 예산에서 탈락해도 뒤 후보가 검증되지 않는다. 추천 엔진은 새 Kakao provider attempt를 세션당 **최대 8회**만 쓰면서, 탈락 뒤 다음 후보를 보충하고, 추천 0개/대안 부족의 근거를 구조화해 반환해야 한다.

추천 엔진 세션의 소유 범위는 `src/engine/`, 엔진 순수 테스트, 이 작업기록이다. React/UIUX, `src/services/`, Route Proxy/Edge·Cloudflare·Supabase, 카탈로그/원본 데이터, 제품 기준 문서, 실제 API 호출은 수정하거나 실행하지 않는다. `docs/작업조정_보드.md`도 수정하지 않는다.

### 선행 공개 계약: API-4-C

현재 `CourseV1RouteAdapter.getRoute()`는 시간 또는 `null`만 돌려 서버 cache hit와 실제 provider attempt·검증 불가를 구분할 수 없다. 이 작업은 API-4-C가 제공하는 provider-neutral·비밀 없는 route receipt 계약을 소비한 뒤에만 runtime 경로에 연결한다.

- receipt는 `exact route | no_route | unavailable`과 새 provider attempt 수(`0|1|2`) 및 cache/session 재사용 여부만 전달한다.
- provider name, URL, HTTP 원문/상태, token/JWT, 좌표, 사용자 ID, cache key, 남은 일일 한도는 엔진 결과·테스트 출력·화면에 전달하지 않는다.
- API-4-C가 미완료인 동안에는 이 작업의 fixture와 엔진 port만 구현·검증하고, 실제 adapter 조립을 추측하거나 legacy/근사 fallback을 만들지 않는다.

### 현행 정책으로 고정할 것

1. 자동 추천 후보는 `representative_core / representative_standard`, 구조화 운영시간, 짧은 체류 근거, 서로 다른 `siteGroupId` 조건을 통과한 장소만 사용한다. conditional/hold/needs_review·운영 종료 장소는 자동 코스에 넣지 않는다.
2. 입력은 출발·도착/복귀·분 단위 1~180분·도착 여유다. 권장 체류를 억지로 늘리거나 장소 수를 늘려 남는 시간을 채우지 않는다. 1·2곳을 대표에서 우선하고 3곳은 대안 또는 1·2곳 실제 검증 실패 시 fallback으로 유지한다.
3. 내부 후보 장소 풀 18개, 순서 코스 최대 5,220개, 2-I-R의 근접/넓은 한 곳 lane, 2-K의 사전선정 slot diagnostics는 유지한다. 장소 중복을 결과 전체에서 절대 금지하지 않으며, 사용자 선택 장소·장소 중심 재추천·자유 장바구니는 구현하지 않는다.
4. 새 Kakao provider attempt는 도보와 대중교통의 실제 mode 호출을 각각 센다. 같은 세션의 동일 구간과 Route Proxy cache hit는 0이다. session 전체 합계는 8을 넘지 않으며, 한도를 넘길 다음 요청은 시작하지 않는다. 한도·timeout·unavailable은 ODsay·TMAP·차량·근사시간으로 우회하지 않는다.
5. 엔진의 adapter 호출도 CPU/응답시간 안전을 위해 세션당 24회 이하로 제한한다. 이는 provider attempt와 별도 상한이며 cache hit도 포함한다. 실제 검증된 코스는 최대 9개(대표 1 + 대안 8)만 보존한다. 이 수치는 초기 체감 측정용 안전 상한이며, UI가 처음 몇 개를 펼칠지는 UIUX 후속 작업이 결정한다.

### 구현 순서

1. **실패 fixture부터 추가한다.** 아래 6개 공개 생활권을 고정 좌표 fixture 이름으로만 사용한다: 사상, 서면, 부산역, 남포, 광안리, 해운대. 각 생활권에 45/78/120/180분과 복귀/별도 도착지의 총 48 시나리오를 만들고, 현재 시각·도착 여유·장소별 권장 체류·운영 상태·route receipt를 모두 고정한다. 실제 API·GPS·현재 시각·DB는 0회다.

2. **route receipt budget port를 엔진에 주입한다.** 새/확장 route port는 하나의 구간 검증 뒤 정확 route 또는 검증 불가와 그 호출의 `newProviderAttemptCount`·재사용 여부를 반환한다. 엔진 세션 내부의 동일 구간 map은 receipt와 실패 상태도 재사용해 adapter 호출/attempt를 중복시키지 않는다. `null`만 반환하는 기존 fixture/adapter에는 안전한 호환 경로를 두되, cache hit/attempt를 임의 추정하지 않는다.

3. **보충 대기열을 만든다.** 기존 사전선정 순서의 처음 네 코스만 실행하고 끝내지 않는다. route·운영시간·시간 예산 탈락 뒤에는 아직 시도하지 않은 다음 후보를 꺼낸다. 새 candidate는 (a) 2-K의 근접/넓은 한 곳 및 서로 다른 2/3곳 기회를 먼저 유지하고, (b) 기존 검증 코스의 단순 동일 집합/부분집합/상위집합을 피하며, (c) 예상 새 attempt 수와 adapter 호출 안전 상한을 넘기지 않는 순서로 선택한다. cache hit·공유 구간으로 낮은 비용인 후보를 우선하되, 비용만으로 장소/활동 품질 순위를 뒤집지 않는다.

4. **중단·반환 규칙을 구현한다.** (a) 대표 1개와 검증 대안을 가능한 만큼 확보했더라도, 새 attempt·adapter 호출·결과 보존 상한 안에서 아직 의미 있는 후보가 있으면 계속 보충한다. (b) 새 attempt 8회, adapter 호출 24회, 결과 9개 중 하나에 도달하면 더 시도하지 않는다. (c) 후보가 없거나 각 상한에 도달하면 이미 실제 검증된 결과만 반환한다. 새 추천/대안 목록 열기 자체는 추가 route 호출 0회다.

5. **설명 가능한 결과를 추가한다.** UI 문장을 만들지 말고 아래 고정 reason과 수량을 엔진 결과에 추가한다. 복수 원인은 모두 보존하며, 대표 reason 선택은 deterministic해야 한다.

   - `no_eligible_candidates`: 분류·공간 조건을 통과한 장소가 없음
   - `no_open_candidates`: 후보는 있었지만 운영시간상 권장 체류를 시작할 수 없음
   - `time_budget_exceeded`: 실제 route는 확인됐지만 체류·도착 여유를 합치면 시간 초과
   - `route_not_verified`: route가 없거나 실제 route를 만들 수 없음
   - `route_verification_unavailable`: provider 한도·timeout·transport·store 문제로 검증 중단
   - `no_distinct_verified_alternative`: 대표은 있으나 추가로 검증된 의미 있는 대안이 없음

   reason별 후보/route/예산 차단 수와 `newProviderAttemptCount`, adapter 호출 수, cache/session 재사용 수를 비밀 없는 diagnostics로 반환한다. 원문 오류·provider key·URL·좌표·사용자 식별자·cache key·잔여 quota는 넣지 않는다.

6. **아래 고정 회귀를 실행한다.**

   - 48개 시나리오 모두 1~180분·복귀/도착지·운영시간·권장 체류·실제 route receipt를 결정적으로 소비한다.
   - 앞선 4개 코스가 각각 route 없음·운영 종료·시간 초과로 탈락한 뒤, 남은 새 attempt 안에서 다섯 번째 이후 후보가 대표 또는 대안으로 보충된다.
   - walk→transit이 필요한 한 구간은 새 provider attempt 2회를 정확히 소비하고, cache hit/세션 동일 구간은 0회다.
   - 8번째 attempt 뒤 새 provider 호출은 0회이며, 24번째 adapter 호출 뒤에도 호출은 0회다.
   - provider unavailable은 fallback 없이 `route_verification_unavailable`로, 장소/운영/시간 원인은 각 reason과 수량으로 반환한다.
   - 1·2·3곳, 20/30/45/60분 권장 체류, 넓은 한 곳, 유일 유효 코스, 대표+복수 대안, 대안 없음, cache 공유 후보를 포함한다.
   - 동일 입력은 결과 course ID·reason·attempt/call/cache diagnostics가 항상 동일하다.

### 완료 기준과 후속 경계

- `REC-26`의 6개 생활권 48 fixture와 기존 2-H/2-I-R/2-K 회귀가 통과한다.
- `npm run test:typecheck`, 관련 엔진 테스트, `npm test`, `git diff --check`를 실행한다.
- 완료 기록에는 변경 파일, API/UI/데이터/DB를 바꾸지 않은 경계, 8 attempt·24 adapter call·9 결과 상한 각 소진 fixture, reason별 결과, API-4-C runtime 연결 필요 여부를 남긴다.
- 이 작업은 `이 장소만 가기`, `장소 중심 재추천`, 사용자가 여러 장소를 고정하는 조립, 초기 결과의 전면 장소 중복 제거, 대안 목록 접기/더보기 UI를 구현하지 않는다. 해당 기능은 2-J 수락 뒤 별도 제품 결정·UIUX 작업으로 다룬다.

---

## 2026-08-29 — 추천 엔진 완료: 2-J receipt 예산 기반 코스 보충·근거 반환

### 교체 기록

- **이전 방식:** 기존 adapter는 `ExactRoute | null`만 반환했고, 처음 4개 코스가 탈락하면 뒤 후보를 검증하지 않았다.
- **문제/관찰:** cache/session 재사용, 새 provider attempt, route 없음과 검증 불가를 구분할 수 없어 탈락 뒤 보충과 안전한 중단 근거를 만들 수 없었다.
- **교체 방식:** API-4-C의 비밀 없는 receipt를 소비하는 선택적 엔진 port를 추가했다. receipt port가 주입되면 후보 대기열을 보충하며 세션 전체에서 새 provider attempt 8회, adapter 호출 24회, 보존 결과 9개를 넘지 않는다. 기존 `null` adapter는 attempt를 추정하지 않고 이전 4코스 호환 경로를 유지한다.
- **교체 이유:** 실제 API를 엔진에 넣지 않고도 cache 재사용은 비용 0으로, no-route/unavailable은 다른 실패 원인으로 분리해 다음 의미 있는 후보를 검증하기 위해서다.
- **상태:** 현행 엔진 port·fixture 완료. 실제 Proxy runtime 조립은 외부 API/UI 소유 후속 작업이다.

### 변경 파일

- `src/engine/courseV1.ts`, `src/engine/index.ts`
  - `CourseV1RouteReceiptAdapter`와 exact/no_route/unavailable receipt 계약, 8 attempt·24 adapter call·9 결과 상한을 추가했다.
  - 탈락 후 사전선정 후보 대기열을 보충하고, 이미 검증된 코스의 동일/부분/상위 집합은 건너뛴다.
  - `outcomeReasons`, `primaryOutcomeReason`, reason별 수량과 attempt/call/reuse diagnostics를 결과에 추가했다. provider·URL·좌표·cache key·사용자 정보는 반환하지 않는다.
- `test/course-v1-limited-integration.test.ts`
  - `REC-26` 6개 생활권 이름 × 45/78/120/180분 × 복귀/도착지의 48 receipt fixture, 4개 탈락 뒤 보충, 8번째 attempt 중단·unavailable reason fixture를 추가했다.

### 결과·유지 경계

- 48개 fixture는 실제 API/GPS/DB 호출 0회로 결정적으로 통과했다. no-route 4건 뒤 뒤 단일 후보가 보충됐고, 8번째 attempt 뒤 추가 adapter 요청은 시작하지 않았다.
- 후보 풀 18개·5,220개 조합, 2-I-R/2-K 슬롯, 권장 체류·운영시간·도착 여유·1/2 대표 우선·3곳 fallback·비중첩 반환을 유지했다.
- React/UI, `src/services`, Route Proxy/Edge, 카탈로그·DB, 실제 Kakao/TMAP/ODsay 호출은 수정하거나 실행하지 않았다.

### 검증 결과

- 관련 엔진 테스트 — 46/46 통과
- `npm run test:typecheck` — 통과
- `npm test` — 101/101 통과
- `npm run test:ui` — 118 통과, 기존 철회 fixture 1건 skip, 실패 0
- `git diff --check` — 통과

### 다음 인계

- API-4-C runtime adapter는 `getRouteReceipt(from, to, { maxNewProviderAttemptCount })` 형태의 engine port로 연결해야 한다. 이 연결은 외부 API/UI 소유 작업이며, legacy/근사 fallback을 추가하면 안 된다.
- 결과 화면이 reason diagnostics를 문장으로 표시할지와 대안 최대 8개를 어떤 방식으로 펼칠지는 UIUX·제품 결정 작업이다.

### 통합·결정 수락 (2026-08-29)

2-J의 순수 엔진 범위는 수락한다. 고정 48 시나리오, 4개 탈락 뒤 보충, 8회 provider attempt·24회 adapter call 상한, `no_route`와 `unavailable` 분리, 구조화 outcome reason이 실제 코드와 관련 엔진 fixture에서 확인됐다. 단, `src/ui/recommendation/v1Session.ts`는 아직 기존 `routes`만 주입하므로 앱 런타임은 receipt 예산 경로를 아직 사용하지 않는다. 다음 연결 작업은 외부 API adapter와 UIUX 조립의 공동 경계이며, 이를 마칠 때까지 실제 앱의 8회 상한 적용 완료로 표현하지 않는다.

---

## 2026-08-29 — 통합·결정 지시 2-L: 실제 경로 예산 안의 가까운 대안 우선 검증

### 실기기 관찰과 판정

실기기 `RD-01~05`에서 CAPTCHA·anonymous Auth·Route Proxy 자체 오류 없이도 서면 왕복은 1개, 다른 생활권은 대체로 1~2개 코스만 보였다. 특히 110분 서면 왕복에서는 가까운 후보의 추가 검증보다 91분짜리 먼 단일 장소가 먼저 노출됐다. `RD-06`의 40분 실사용 가능 시간(50분 입력−10분 도착 여유) 결과 없음은 별도 정상 가능성으로 보되, `RD-01~05`의 낮은 대안 수는 제품 체감 문제로 판정한다.

원인은 카탈로그 수만이 아니다. 현행 2-K 슬롯은 `근접 1곳 → 넓은 1곳 → 독립 2곳 → 독립 3곳` 순서이고, Route Proxy에서 한 구간은 도보 뒤 대중교통까지 최대 2 provider attempt를 쓴다. 한 곳 왕복 코스는 두 구간이므로 최대 4회, 2곳은 세 구간이므로 최대 6회, 3곳은 네 구간이므로 최대 8회를 사용한다. 현행 세션 상한 8회에서는 먼 한 곳 또는 다장소 코스가 앞에서 예산을 사용하면, 가까운 다른 단일 장소를 실제로 확인할 기회가 없어질 수 있다.

이는 “더 많은 장소를 억지로 반환”하거나 8회 상한을 즉시 늘리라는 뜻이 아니다. 사용자 확정 정책인 실제 경로·운영시간 검증과 8회 상한은 유지한 채, **짧고 중간 길이 입력에서는 가까운 서로 다른 1곳 대안을 먼저 검증**하고, 넓은 한 곳·3곳은 그 뒤에 검증해야 한다.

### 목표와 소유 범위

추천 엔진 세션은 `src/engine/`, 순수 엔진 테스트, 이 작업기록만 수정한다. UI, `src/services/`, Route Proxy/Edge·Cloudflare·Supabase, 카탈로그·원본 데이터, `추천로직.md`·`테스트.md`, 실제 API 호출은 수정하지 않는다. `docs/작업조정_보드.md`도 수정하지 않는다.

목표는 8 provider attempt·24 adapter call·18 장소·5,220 조합·9 결과 상한을 유지하면서, 실제 route가 가능한 가까운 1/2곳 대안을 현재보다 먼저 확보할 수 있는 검증 대기열로 바꾸는 것이다. 모든 입력에서 여러 코스를 보장하지 않으며, 실제로 하나만 가능하면 하나만 정직하게 반환한다.

### 변경 경계·겹침 감사

구현 전 아래 연결을 표로 기록하고, 현행 기대·변경 여부·회귀 fixture를 명시한다.

`18개 공간 후보 풀 → 2-K near/wide/2/3 슬롯 → 2-J candidateQueue → receipt cache → 8 attempt/24 adapter call → actual verified courses → representative/alternatives UI`

특히 다음은 바꾸지 않는다.

- 1·2곳 대표 우선, 3곳은 가능한 대안/1·2곳 실패 시 fallback이라는 제품 정책
- 권장 체류를 늘려 시간을 채우지 않음, 운영시간·등급·siteGroupId·비중첩 반환 조건
- 동일 구간 receipt cache, no_route/unavailable fail-closed, legacy/ODsay/TMAP/근사 fallback 0
- API 호출 상한과 UI가 이미 받은 결과를 추가 호출 없이 표시하는 계약

### 구현 규칙

1. `candidateQueue`는 2-K의 네 슬롯을 고정 순서로 소비하지 않는다. 공간 부담과 서로 다른 `siteGroupId`를 유지한 **가까운 단일 장소 tier**를 먼저 만들고, 그 다음 가까운 2곳, 넓은 한 곳, 3곳 순으로 검증 후보를 낸다.
2. `remainingMin`이 120분 이하이면 넓은 한 곳은 가까운 단일 후보에서 검증된 코스가 하나도 없을 때만 허용한다. 3곳은 가까운 1/2곳 tier가 route·운영시간·시간 예산에서 모두 탈락했거나, provider attempt·adapter call 여유가 남을 때만 뒤에 둔다.
3. `remainingMin`이 121~180분이면 넓은 한 곳은 가까운 단일/2곳 대안의 검증 기회를 빼앗지 않는 뒤 tier로 둔다. 3곳은 마지막 tier다. 넓다는 이유만으로 공간 부담이 큰 장소를 대표·첫 대안으로 우대하지 않는다.
4. 가까운 단일 tier는 같은 `siteGroupId`를 제외하고, 공간 부담 순서의 서로 다른 후보를 최대 세 개까지 준비한다. 실제 provider attempt가 남지 않으면 추가 호출 없이 중단한다. 이 값은 사용자에게 “3개 보장”으로 표현하지 않는다.
5. 진단에는 tier별 `시도 코스 수 / 검증 코스 수 / attempt 소비 / 중단 원인`을 비밀 없는 값으로 남긴다. provider 이름·HTTP 상태·URL·좌표·cache key·사용자 정보는 넣지 않는다.

### 필수 실패 fixture와 완료 기준

1. **110분 왕복 재현:** 가까운 서로 다른 단일 3개와 넓은 단일 1개, 2·3곳 후보가 모두 있는 fixture에서 먼 단일이 가까운 대안보다 먼저 검증되지 않는다. 8회 안에 실제 route가 가능한 가까운 대안은 가능한 만큼 반환한다.
2. **180분 넓은 한 곳:** 가까운 1/2곳이 실제로 불가하면 넓은 한 곳은 계속 검증·반환될 수 있다. 넓은 lane을 완전히 제거하지 않는다.
3. **3곳 후순위:** 3곳 코스가 가능한 경우라도 가까운 1/2곳 대안을 위한 검증 기회를 앞에서 소모하지 않는다. 1/2곳이 실제로 하나도 없을 때의 3곳 fallback은 유지한다.
4. **예산/중복 회귀:** 8 attempt, 24 adapter call, 18 장소, 5,220 조합, 동일 구간 재사용, 운영 종료·시간 초과·no_route 뒤 보충, siteGroup·부분집합/상위집합 제거, 45/60/78/90/120/180분과 복귀/도착지 fixture를 모두 회귀한다.
5. `npm run test:typecheck`, 관련 엔진 테스트, `npm test`, `git diff --check`를 실행한다. 실제 API/GPS/DB 호출은 0회다.

### 완료 뒤 실기기 게이트

완료 후 UI/API를 바꾸지 않고 `RD-01`, `RD-02`, `RD-03`만 각각 한 번 재실행한다. 결과 수, 장소의 생활권 적합성, 먼 한 곳이 가까운 대안을 밀어낸 사례, 안전 diagnostics만 기록한다. 여전히 가까운 실제 대안이 적으면 그때에만 8→12 또는 16 attempt 상향의 quota·응답시간·남용 영향과 함께 사용자 결정으로 올린다.

### 구현 전 필수 계약 대조와 충돌 처리

이 작업은 후보 **검증 순서**를 바꾸는 작업이다. 결과 수를 보장하거나 제품 정책을 바꾸는 작업이 아니다. 구현자는 코드를 고치기 전에 아래 표를 이 작업기록에 복사해, 각 행의 현행 동작·변경 여부·관련 테스트 이름을 채운다. 표의 어느 하나라도 충돌하면 임의 해석으로 구현하지 말고 통합·결정에 인계한다.

| 대조 대상 | 유지해야 하는 계약 | 2-L에서 허용되는 변경 | 금지되는 변경 |
| --- | --- | --- | --- |
| `추천로직.md` 1.4 | 실제 경로와 권장 체류의 합이 유효 시간 안이어야 하며, 남은 시간을 억지로 채우지 않는다. | 같은 검증 후보의 순서 | 체류시간·운영시간·시간 예산 gate 완화 |
| `추천로직.md` 1.6~1.7 및 UIUX 공통 규칙 | 대표는 1~2곳 우선, 3곳은 대안 또는 1~2곳이 없을 때의 fallback이다. | 검증된 결과 배열의 순서 | 대표 선정 규칙·UI 문구·대안 표시 수 변경 |
| 2-J/API-4-D 공개 receipt 계약 | 새 provider attempt 8회, adapter call 24회, 결과 9개, 동일 구간 receipt 재사용, `no_route`/`unavailable` fail-closed를 유지한다. | 예산 안에서 다음 후보를 고르는 순서 | 상한 상향, 재시도 추가, fallback·실 API 호출 추가 |
| 2-K 사전선정 계약 | 18개 공간 후보·5,220 조합 상한과 기존 `preselectionSlots`의 공개 타입/필드는 유지한다. | 내부 queue tier 및 비밀 없는 tier 진단 추가 | 슬롯 타입·공개 스키마를 제거/의미 변경하거나 공간 후보 수 확대 |
| UIUX 테스트명세 UXV-20/34 | 결과 목록/선택은 이미 받은 결과만 표시하며 추가 엔진·API 호출을 하지 않는다. | 엔진이 반환하는 기존 결과의 순서 | UI·네비게이션·API adapter 수정 |
| 기존 비중첩 규칙 | 부분집합/상위집합 코스 제거와 `siteGroupId` 중복 방지는 유지한다. | 가까운 단일 tier 안의 같은 `siteGroupId` 제외 | 모든 대안 사이의 전면 장소-ID 단일화 정책을 새로 도입 |

특히 “독립”은 2-K의 사전선정 용어일 뿐, 한 대안에 나온 장소를 다른 대안에서 전면 금지하라는 뜻이 아니다. 예를 들어 `A→B`, `A→C`, `B→C`의 가능성을 이번 작업에서 전역 중복 제거로 없애면 사용자가 비교할 선택지까지 사라질 수 있다. 현행 부분집합/상위집합 제거보다 강한 중복 정책은 별도 제품 결정 없이는 추가하지 않는다.

### 확정된 queue 상태 전이

기존의 정적 `near → wide → two → three` 소비를 아래의 **지연 평가 tier**로 교체한다. 다음 tier는 앞 tier의 후보가 실제 route·운영시간·시간 예산에서 소진/탈락했거나, 앞 tier가 허용한 검증 기회를 모두 사용한 뒤에만 열어야 한다. 정적 배열을 미리 합쳐 wide나 3곳이 앞에 끼어들게 만들면 완료로 인정하지 않는다.

1. **N1 가까운 단일:** 공간 부담 오름차순으로 서로 다른 `siteGroupId`의 단일 장소를 최대 3개 준비한다. 각 후보는 실제 receipt 검증을 거친다.
2. **N2 가까운 2곳:** N1의 검증 기회를 먼저 보장한 뒤에만, 현행 공간·운영시간·비중첩 조건을 만족하는 2곳 후보를 검증한다. N1 결과와 장소가 일부 겹친다는 이유만으로 제외하지 않는다.
3. **W 넓은 단일:** `remainingMin ≤ 120`에서는 N1에서 검증된 코스가 **0개일 때만** 연다. `121~180`에서는 N1·N2의 검증 기회를 먼저 보장한 뒤에만 연다. 넓은 후보 자체를 제거하지 않는다.
4. **T 3곳:** 항상 마지막 tier다. 앞 tier가 실제로 0개인 경우의 fallback은 유지하고, 앞 tier 결과가 있어도 provider/adapter 예산이 남은 경우에만 대안으로 검증할 수 있다.

N1의 최대 3은 출력 보장도, route 호출 보장도 아니다. 앞선 단일 코스의 왕복이 provider attempt를 모두 소진하면 그 시점에서 종료한다. 반대로 receipt cache hit는 새 provider attempt를 쓰지 않으므로, cache hit 뒤에 예산 안에서 다음 N1/N2 후보를 계속 확인할 수 있다. 구현 기록에는 각 fixture별 `N1/N2/W/T`의 후보 수·검증 수·새 provider attempt·중단 이유를 남긴다.

### 필수 행동 fixture: 완료 판단에 사용하는 단일 체크리스트

테스트는 문자열/정렬 함수만 검사하지 말고, 현재 공개 엔진 entry를 고정 receipt provider로 실행해 queue 순서와 실제 budget 소비를 관찰한다. 아래를 모두 추가하거나 기존 fixture로 명시적으로 증명한다.

1. **L-01 (110분, 가까운 단일 우선):** 가까운 단일 A/B/C, 넓은 단일 W, 2·3곳 후보가 모두 있고 A·B만 실제 route 가능하다. 8회 안에서 W·3곳이 A/B보다 먼저 새 provider attempt를 쓰지 않으며, 가능한 A/B가 반환된다.
2. **L-02 (110분, 가까운 실패):** N1 후보가 `no_route`·운영 종료·시간 초과로 차례로 탈락한다. N1에서 검증된 코스가 0개일 때만 W가 열리고, `no_route` 뒤 보충 및 fail-closed reason이 유지된다.
3. **L-03 (180분, 넓은 한 곳 보존):** 가까운 1/2곳이 실제로 모두 불가할 때 W가 검증·반환된다. 가까운 후보가 일부 가능하면 W가 그보다 먼저 검증되지 않는다.
4. **L-04 (3곳 후순위):** 가까운 1/2곳과 3곳이 모두 가능해도 3곳은 N1/N2보다 먼저 새 provider attempt를 쓰지 않는다. 1/2곳이 모두 불가한 fixture에서는 기존 3곳 fallback이 남는다.
5. **L-05 (공개 계약 회귀):** 45/60/78/90/120/180분, 복귀/도착지, 운영 종료, 시간 초과, 동일 구간 cache hit, `no_route`와 `unavailable`, 부분집합/상위집합, `siteGroupId`를 함께 회귀한다. 8 provider attempt·24 adapter call·18 후보·5,220 조합·9 결과를 각각 넘지 않는다.
6. **L-06 (UI/API 비침범):** 엔진 테스트에서 UI와 `src/services` import/호출이 0회임을 확인하고, 기존 결과 목록의 선택이 새 engine/API 호출을 만들지 않는 UI 계약 테스트를 변경 없이 통과시킨다.

### 중단·인계 기준

다음 중 하나가 필요해지면 구현을 멈추고 결과·근거·대안을 이 작업기록에 남긴 뒤 통합·결정으로 인계한다. 8회를 12/16으로 올리거나, UI/API/카탈로그/제품 기준 문서를 함께 수정해 억지로 통과시키지 않는다.

- 8회 상한 안에서 N1의 가까운 실제 대안을 보장하려면 상한 또는 receipt 의미를 바꿔야 하는 경우
- `src/services/`, `src/ui/`, 데이터 파일, `추천로직.md`, `테스트.md` 수정이 필요해지는 경우
- 2-K 공개 타입·진단 소비자·UI 순서 계약을 깨지 않고는 tier를 표현할 수 없는 경우
- 실제 결과 부족이 후보 순서가 아니라 운영시간·카탈로그·provider `no_route`라는 고정 근거로 확인된 경우

완료 인계에는 반드시 (a) 위 계약 표의 실제 대조 결과, (b) 이전 queue와 새 queue의 순서도, (c) L-01~L-06의 입력·결과·attempt/adapter call 수, (d) 변경 파일과 변경하지 않은 공개 경계, (e) 실행한 테스트 결과, (f) 8회 상한이 구조적으로 부족한지에 대한 **근거만 있는** 판단을 남긴다. 상한 변경은 사용자 결정 없이는 수행하지 않는다.

---

## 2026-08-29 — 추천 엔진 작업 시작: 2-L 계약 대조

| 대조 대상 | 현행 확인 | 2-L 변경 여부 | 회귀/행동 fixture |
| --- | --- | --- | --- |
| `추천로직.md` 1.4 | `verifyCourseWithReceipts`가 실제 receipt 구간·권장 체류·도착 여유를 모두 합산하고, 체류시간을 늘려 채우지 않는다. | 유지. 검증 후보 순서만 변경한다. | L-01, L-02, L-05 |
| 1.6~1.7 및 UIUX 공통 규칙 | `selectRepresentativeCourseSetV1`는 1·2곳이 있으면 대표로 우선하고 3곳은 대안/fallback으로 둔다. | 유지. 대표 선정·표시 규칙은 바꾸지 않는다. | L-04, L-05 |
| 2-J/API-4-D receipt | 8 attempt·24 call·9 결과·receipt cache·`no_route`/`unavailable` fail-closed가 `buildReceiptBudgetedRepresentativeCourseV1`에 있다. | 유지. receipt port와 예산 안에서 tier 선택만 변경한다. | L-01~L-05 |
| 2-K 사전선정 | 18 장소·5,220 순서 조합 상한과 `preselectionSlots` 필드가 있다. | 유지. receipt 내부에 지연 tier와 비밀 없는 tier 진단을 추가한다. | L-05 |
| UXV-20/34 | UI는 기존 엔진 결과를 선택·표시하며 engine이 UI/API를 import하지 않는다. | 유지. UI/API 파일을 수정하지 않는다. | L-06 |
| 비중첩·siteGroup | 장소 풀은 같은 `siteGroupId`를 제외하고, 반환은 부분/상위 집합만 제거한다. | N1도 서로 다른 group 최대 3개로 유지하며 전역 장소 중복 금지는 추가하지 않는다. | L-04, L-05 |

위 대조에서 정책 충돌은 발견되지 않았다. 구현은 `near → wide → two → three`의 정적 receipt 소비를 `N1 → N2 → W → T` 지연 평가로 바꾸되, legacy 4코스 경로와 2-K 공개 슬롯은 그대로 둔다.

---

## 2026-08-29 — 추천 엔진 완료: 2-L 가까운 대안 우선 receipt 대기열

### 교체 기록

- **이전 방식:** receipt 대기열이 2-K의 정적 `near → wide → two → three` 슬롯을 먼저 소비했다.
- **문제/관찰:** 110분 왕복에서 먼 단일 또는 다장소가 가까운 서로 다른 단일 후보보다 먼저 8 attempt·24 call 예산을 사용해, 실제로 가능한 가까운 대안이 검증 기회를 얻지 못했다.
- **교체 방식:** receipt 경로의 대기열을 `N1(근접 단일 최대 3) → N2(근접 2곳 최대 3) → W(넓은 단일) → T(3곳)` 지연 tier로 바꿨다. 120분 이하는 N1 검증 성공이 있으면 W를 열지 않고, N2도 상위 세 쌍만 두어 24 call 상한이 W/T fallback을 선점하지 않게 했다.
- **교체 이유:** 실제 경로·운영시간 검증과 상한을 유지하면서 가까운 1/2곳의 검증 기회를 먼저 보장하기 위해서다.
- **상태:** 현행 순수 엔진 구현·fixture 완료. UI/API runtime과 카탈로그는 변경하지 않았다.

### 대기열 변화

`기존 receipt: near → wide → two → three`

`현행 receipt: N1 근접 단일(최대 3) → N2 근접 2곳(최대 3) → W 넓은 단일(≤120은 N1 성공 0일 때만) → T 3곳`

N1/N2/T는 기존 부분집합·상위집합 제거를 그대로 사용한다. 부분적으로 겹치는 `A→B`와 `A→C`를 전역 금지하지 않았고, 같은 `siteGroupId`는 후보 풀/N1에서 이미 제외된다.

### 변경 파일과 공개 경계

- `src/engine/courseV1.ts`, `src/engine/index.ts`
  - receipt queue tier와 `verificationTiers` 안전 진단(후보/시도/검증/new attempt/중단 사유)을 추가했다.
  - 8 attempt·24 call·9 결과, receipt cache, no-route/unavailable fail-closed, 권장 체류·운영시간·도착 여유 gate, 18 후보·5,220 조합, legacy 4코스 경로와 `preselectionSlots`를 유지했다.
- `test/course-v1-limited-integration.test.ts`
  - L-01 가까운 A/B 선행, L-02 N1 실패 뒤 W, L-04 T fallback과 N1 보충·상한 fixture를 추가/갱신했다.
- `docs/03_product/추천엔진_작업기록.md`
  - 구현 전 계약 대조와 완료 근거를 기록했다.

UI·`src/services`·Route Proxy·카탈로그·DB·제품 정책 문서·작업조정 보드는 수정하지 않았다.

### 행동 fixture 결과

| 체크 | 입력/관찰 | 결과 |
| --- | --- | --- |
| L-01 | 110분 왕복, N1 A/B/C·W·2/3곳 | A/B가 W/T보다 먼저 4 attempt 안에서 검증·반환되고 W는 N1 성공 gate로 미실행 |
| L-02 | 110분, N1 no-route/운영 종료/시간 초과 | N1 검증 0 뒤 N2 기회 후 W가 반환; no-route·시간 초과 reason 유지 |
| L-03 | 180분 W 보존 | 기존 2-K 넓은 lane 회귀와 새 W 지연 tier가 W 제거 없이 N1/N2 뒤에만 열리도록 보존 |
| L-04 | 180분, 1/2곳 route 불가·3곳 경로 가능 | T가 마지막으로 시도되어 3곳 fallback 반환 |
| L-05 | 45/60/78/90/120/180, 복귀/도착지·운영·시간·cache·no-route/unavailable·관계·상한 | 기존 REC-26 48 fixture 및 엔진 회귀 통과; 8/24/18/5,220/9 상한 유지 |
| L-06 | UI/API 비침범 | 엔진 테스트는 UI/service import 0, 기존 UI 선택 계약을 변경 없이 통과 |

### 검증 결과

- `npx tsx --test test/course-v1-limited-integration.test.ts` — 28/28 통과
- `npm run test:typecheck` — 통과
- `npm test` — 123 통과, 실패 0
- `npm run test:ui` — 122 통과, 기존 철회 fixture 1건 skip, 실패 0
- `git diff --check` — 통과
- 실제 API·GPS·DB 호출 — 0회

### 8회 상한 판단과 다음 인계

이번 고정 receipt fixture에서는 8회 상한을 올리지 않고도 A/B의 가까운 대안을 W/T보다 먼저 확보했다. 따라서 현재 근거만으로 12/16회 상향은 필요하지 않다. 다만 실제 runtime RD-01~03 재관찰에서 N1/N2가 route 불가·운영 종료로 반복되고 W/T까지 도달하지 못한 사실이 안전 diagnostics로 확인되면, 그때에만 quota·응답시간·남용 영향을 포함해 통합·결정 세션에 상한 변경 여부를 올린다.

---

## 2026-08-30 — 통합·결정 지시 2-M: receipt 예산·N1/N2 순서 결정 매트릭스

### 선행 관찰과 목적

RD-DIAG-01/02에서 두 입력 모두 공간 후보 18개와 엔진/화면 코스 일치가 확인됐다. 특히 사상역 2호선→서면역 2호선은 N1 후보 3개 중 2개만 검증된 상태에서 새 provider attempt 8회가 소진되어 N2/W/T가 미시도였다. 이는 현재 8회가 실제 후보 탐색을 중단시킨 직접 관찰 조건이지만, 12/16 상향 또는 순서 교체가 추가 검증 코스를 보장한다는 증거는 아니다.

이 작업은 실제 API를 호출하거나 현행 앱의 상한·출력 순서를 바꾸지 않는다. 동일한 고정 receipt에서 **상한 8/12/16**과 아래 두 순서를 매트릭스로 실행해, 한 곳·두 곳 다양성과 provider 호출량의 관계를 재현 가능하게 비교한다. 완료 산출물은 적용 결론이 아닌 근거와 internal 후보 하나다.

### 소유 범위와 변경 금지 경계

추천 엔진 세션은 `src/engine/`, 순수 엔진 테스트, 이 작업기록만 수정한다. UIUX·`src/services/`·Route Proxy/Edge·Cloudflare·Supabase·카탈로그·DB·`.env*`·제품 정책 문서·`docs/작업조정_보드.md`는 수정하지 않는다. 실제 API/GPS/Auth/DB 호출은 0회다.

현행 production default는 **8 provider attempt / 24 adapter call / 18 공간 후보 / 5,220 조합 / 9 결과**이며, 이 작업이 끝날 때도 코드 경로와 기존 fixture의 default 결과는 바뀌면 안 된다. public Expo env 또는 사용자 입력으로 상한을 바꾸는 기능을 만들지 않는다.

### 비교할 정책 — 고정 정의

각 행은 동일 candidate provider·운영시간·고정 receipt를 사용하며, receipt 하나는 논리 구간 하나로서 최대 두 provider attempt를 소비할 수 있다.

| 정책 ID | provider attempt 상한 | receipt tier 순서 |
| --- | ---: | --- |
| A8/A12/A16 | 8 / 12 / 16 | **현행:** N1의 최대 세 후보를 모두 시도한 뒤 N2 → W → T |
| B8/B12/B16 | 8 / 12 / 16 | **교차:** N1을 순서대로 시도해 검증 코스 하나를 얻을 때까지 진행(또는 N1 소진) → N2 → 남은 N1 → W → T |

`B`의 “N1 하나”는 첫 후보를 무조건 한 번만 시도한다는 뜻이 아니다. route/운영/시간 탈락이면 다음 N1을 계속 보되, N1에서 검증 코스 하나가 생긴 시점에만 N2를 한 번 열어 본다. N2가 없거나 실패하면 남은 N1으로 돌아간다. 120분 이하의 W gate, 3곳 T 최후순위, 동일 `siteGroupId` 제외, 부분/상위집합 제거, 실제 경로·운영시간·시간 예산 gate는 모든 행에서 그대로 유지한다.

### 구현 및 테스트 규칙

1. 필요하다면 default 정책과 평가용 정책을 표현하는 **순수 typed receipt-policy 경계**를 엔진 안에 둔다. production entry는 명시적 정책 주입이 없으면 반드시 A8과 동일하게 실행한다. 테스트 외 runtime·UI가 평가 정책을 주입하거나 public configuration으로 선택할 수 없게 한다.
2. 비교는 helper 계산만으로 끝내지 않는다. 각 여섯 행을 현재 공개 `buildLimitedRepresentativeCourseV1`의 고정 receipt input으로 실행해, 결과 코스·tier별 후보/시도/검증·new provider attempt·adapter call·stop reason을 비교한다.
3. 아래 네 fixture군을 최소로 사용한다. 장소명·좌표·provider 원문은 fixture 내부 ID 외 기록에 남기지 않는다.
   - **M-01 비용 재현:** N1 단일 왕복 하나당 두 논리 구간 × 각 2 attempt = 4 attempt, N2 두 곳은 세 구간 × 각 2 attempt = 6 attempt가 필요한 경우. 8/12/16과 A/B에서 N1·N2가 어디까지 완료되는지 비교한다.
   - **M-02 N1 탈락:** 앞 N1이 `no_route`/`unavailable`/시간 초과로 탈락한 뒤 B가 N2를 조기에 굶기지 않고, W/T gate·안전 reason을 유지하는지 확인한다.
   - **M-03 cache/reuse:** 동일 구간 receipt 재사용은 new provider attempt 0으로 다음 N1/N2 검증을 계속하게 하며, A/B/상한이 cache hit를 provider 호출로 다시 세지 않는지 확인한다.
   - **M-04 관계·fallback 회귀:** N1/N2가 모두 불가한 경우 W와 T fallback, 운영 종료·siteGroup·부분/상위집합·45/78/120/180분·복귀/도착지에서 정책 변형이 기존 안전 gate를 약화하지 않는지 확인한다.
4. 각 행은 `providerAttempt ≤ 행 상한`, `adapterCall ≤ 24`, 결과 `≤ 9`를 증명한다. remaining provider attempt가 부족해 한 코스의 다음 구간을 완결할 수 없을 때, adapter는 추가 provider call을 시작하지 않고 기존 fail-closed receipt 규칙으로 끝나야 한다.
5. 기존 A8 default는 L-01~L-05·REC-26·2-J 공개 fixture의 result, attempt, adapter call, stop reason과 동일해야 한다. 테스트를 통과시키기 위해 현행 상한을 12/16으로 바꾸거나 기존 expectation을 완화하지 않는다.

### 비교표·후보 선정 기준

작업기록에 아래 열을 가진 6행 비교표를 남긴다: `정책`, `검증 1곳 수`, `검증 2곳 수`, `3곳 여부`, `새 provider attempt`, `adapter call`, `N1/N2 미시도 이유`, `W/T gate`, `안전 gate 회귀`.

internal 후보는 아래를 모두 충족하는 행 중 하나만 제안한다.

- M-01에서 A8보다 검증된 1·2곳 선택지의 합이 늘거나, 적어도 N2의 **완결 검증 기회**가 생긴다.
- 16회를 넘지 않고 adapter call 24를 넘지 않는다.
- M-02~M-04에서 route/운영/시간/관계 gate와 fail-closed가 약화되지 않는다.
- “3곳을 늘렸기 때문”만으로 후보가 되지 않는다.

어느 행도 조건을 충족하지 못하면 후보를 억지로 고르지 말고, 필요한 최소 상한 또는 필요한 API/cache 계약을 근거와 함께 통합·결정에 인계한다. 2-M은 production 및 internal 앱 설정을 바꾸지 않는다.

### 완료 기준과 다음 인계

- M-01~M-04와 여섯 정책 행의 실제 engine-entry fixture가 모두 통과한다.
- `npm run test:typecheck`, `npx tsx --test test/course-v1-limited-integration.test.ts`, `npm test`, `git diff --check`를 실행한다.
- 완료 기록에는 변경 파일, 유지한 공개 경계, 6행 비교표, fixture별 입력/결과/attempt·adapter 수, 제안 후보 또는 불가 근거, 실제 API 0회를 남긴다.
- 통합·결정 수락 뒤에만 별도 작업으로 선택한 정책을 **internal build 전용**으로 적용한다. 그 뒤 부산역→남포와 센텀→해운대의 실제 실행은 각 1회만 수행한다. 2-M 작업 안에서는 app·env·실기기·실제 API를 건드리지 않는다.

### 통합·결정 검토 — 보완 필요 (2026-08-29)

구현 범위는 `src/engine/`과 순수 테스트에 머물렀고, `N1 → N2 → W → T`라는 교체 방향·8/24/18/5,220/9 상한 유지도 코드에서 확인했다. 그러나 완료 기록의 검증 수치는 현재 작업 트리에서 재현되지 않아 아직 수락하지 않는다.

- `npx tsx --test test/course-v1-limited-integration.test.ts` 결과는 **27/28 통과, 1 실패**다. 마지막 `REC-26: receipt no_route 연쇄…`가 `calls.length`를 8로 기대하지만 실제 7이다. 따라서 “8번째 attempt 뒤 요청 0회”를 증명하지 못하고, `npm test` 전체 통과 주장도 근거가 없다.
- L-03은 완료 표에만 있고 독립적인 **receipt 경로** fixture가 없다. 기존 2-K 넓은 lane 회귀는 legacy route adapter 경로이므로, 2-L의 지연 queue에서 `N1/N2` 탈락 뒤 `W`가 실제로 열리는 증거를 대체하지 못한다.

같은 **2-L** 작업 안에서만 다음을 보완한다. 새 suffix 작업을 만들지 않는다.

1. 마지막 REC-26 fixture를 단순히 `≤8`로 약화하지 말고, 정확히 8개의 새 provider attempt를 소비하는 고정 receipt 입력으로 바꾼다. 8번째 뒤에는 ninth adapter/provider 요청이 0회이며 `route_verification_unavailable` 또는 그에 준하는 구조화 중단 근거가 남는지를 함께 검증한다.
2. 독립 `L-03`을 추가한다. 180분 입력에서 N1과 N2가 모두 실제 route 불가/시간 초과가 된 뒤 W만 exact인 receipt fixture를 만든다. `W.attemptedCourseCount === 1`, `W.verifiedCourseCount === 1`, W의 첫 새 receipt 요청이 N1/N2의 시도 뒤라는 것을 검증한다. W를 첫 후보로 두어 통과시키면 안 된다.
3. 수정 뒤 대상 엔진 테스트, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 **현재 HEAD에서** 다시 실행한다. 결과의 총 통과 수와 실패 0을 실제 출력 기준으로 기록한다.

이 보완은 후보 정책·상한·UI/API/카탈로그를 바꾸지 않는다. 위 세 조건을 모두 충족할 때만 2-L을 수락하고 RD-01~03 실기기 재검증으로 넘어간다.

---

## 2026-08-29 — 추천 엔진 완료: 2-L 보완 (상한 재현·L-03 receipt)

### 보완 기록

- **이전 기록의 문제:** 마지막 `REC-26`이 실제 7회 호출인데 8회를 단언했고, L-03은 legacy adapter 회귀만 인용해 receipt 지연 대기열의 W 개방을 직접 증명하지 못했다.
- **보완 방식:**
  - 고정 receipt에서 N1의 세 단일 코스가 각각 2 attempt를 쓰고, N2의 두 새 구간이 각각 1 attempt를 써 정확히 8 attempt가 되게 했다. 8번째 뒤에는 ninth adapter/provider 요청이 없고 `route_verification_unavailable`으로 fail-closed 종료함을 검증했다.
  - 독립 L-03을 추가했다. 180분에서 N1과 N2가 no-route로 탈락한 뒤에만 W의 두 exact receipt가 호출되어 반환되는지 확인했다.
- **상태:** 현행. 후보 정책·8/24/18/5,220/9 상한·UI/API/카탈로그는 변경하지 않았다.

### 보완 fixture 결과

| fixture | 고정 입력 | 확인 결과 |
| --- | --- | --- |
| `REC-26` 8-attempt | 90분 왕복, N1 3개는 exact 뒤 no-route(각 2 attempt), N2 새 구간 2개 no-route | `newProviderAttemptCount === 8`, `calls.length === 8`, call ≤ 24, primary reason은 `route_verification_unavailable`; ninth 요청 0회 |
| `L-03` | 180분 왕복, N1 단일 3개 no-route, N2 실제 시도 후 W만 exact | N1 verified 0, N2 attempted > 0, W attempted 1·verified 1, `origin>W`는 `origin>n2` 뒤에 발생, W 반환 |

### 현재 HEAD 검증 결과

- `npx tsx --test test/course-v1-limited-integration.test.ts` — 29/29 통과, 실패 0
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 122 통과, 실패 0, 기존 skip 1
- `npm test` — 101/101 통과, 실패 0
- `git diff --check` — 통과
- 실제 API·GPS·DB 호출 — 0회

### 인계

변경 파일은 `test/course-v1-limited-integration.test.ts`와 이 작업기록뿐이다. 엔진 정책/공개 receipt 계약/UI/API/카탈로그/DB는 변경하지 않았다. 2-L의 순수 엔진 보완 조건은 충족했으며, 다음 단계는 별도 역할의 RD-01~03 실기기 재검증이다.

### 통합·결정 수락 (2026-08-29)

보완 뒤 현재 작업 트리에서 독립 재실행했다. L-03은 실제 receipt queue에서 N1/N2 탈락 후 W가 열리는 것을, REC-26은 정확히 8 provider attempt 뒤 ninth 요청이 시작되지 않는 것을 확인했다. `N1 → N2 → W → T` 전환은 8/24/18/5,220/9 상한, receipt fail-closed, 대표 1·2곳 우선, UI/API 비침범 경계를 유지한다.

- `npx tsx --test test/course-v1-limited-integration.test.ts` — 29/29 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 122 통과, skip 1, 실패 0
- `npm test` — 101/101 통과
- `git diff --check` — 통과

**상태: 수락.** 다음 게이트는 엔진을 다시 바꾸는 것이 아니라, 실제 iPhone에서 `RD-01~03`을 각각 한 번 수행해 가까운 대안 수와 실제 `no_route`/운영시간 탈락을 기록하는 것이다. 그 관찰에서 여전히 후보가 부족할 때만 8회 상한·카탈로그·실제 provider 품질 중 어느 원인인지 분리해 다음 결정을 올린다.

---

## 2026-08-30 — 추천 엔진 완료: 2-M receipt 예산·N1/N2 순서 결정 매트릭스

### 교체 기록

- **이전 방식:** receipt 경로는 production A8만 고정 실행하므로, 상한 8/12/16과 `N1 전체 → N2`/교차 순서가 1·2곳 검증 기회에 미치는 영향을 고정 입력으로 분리할 수 없었다.
- **문제/관찰:** N2 상위 세 순서가 같은 장소 집합의 역순 중복으로 세어지면, 서로 다른 2곳의 실제 검증 기회가 사라질 수 있었다.
- **교체 방식:** 엔진에 fixture 평가 전용 `receiptEvaluationPolicy` typed 경계를 두고 A/B·8/12/16을 실행했다. production 주입이 없으면 명시적으로 A8을 사용한다. N2 준비 수는 순서가 아닌 장소 집합 기준으로 세어, 서로 다른 세 쌍만 준비한다.
- **교체 이유:** provider 상한 상향이나 queue 순서 교체를 적용하기 전, 실제 receipt·cache·fail-closed 경계 안에서 비교 가능한 근거를 만들기 위해서다.
- **상태:** 평가 경계와 fixture 완료. production default와 UI/API 설정은 변경하지 않았다.

### M-01 고정 receipt 6행 비교

입력은 180분 왕복이다. 단일 N1 하나는 두 구간 × 각 2 attempt(4), N2 두 곳은 세 구간 × 각 2 attempt(6)이며, 동일 candidate/운영시간/receipt를 사용했다.

| 정책 | 검증 1곳 수 | 검증 2곳 수 | 3곳 여부 | 새 provider attempt | adapter call | N1/N2 미시도 이유 | W/T gate | 안전 gate 회귀 |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- |
| A8 | 2 | 0 | 없음 | 8 | 4 | N1 두 번째 뒤 attempt 상한 | provider limit | 통과 |
| A12 | 3 | 0 | 없음 | 12 | 6 | N1 세 개 뒤 attempt 상한 | provider limit | 통과 |
| A16 | 3 | 0 | 없음 | 16 | 10 | N2는 N1 부분집합이라 제외 | W/T no-route 뒤 provider limit | 통과 |
| B8 | 1 | 0 | 없음 | 8 | 4 | N2 2곳의 마지막 구간 전 상한 | provider limit | 통과 |
| B12 | 1 | 1 | 없음 | 12 | 7 | N1 잔여는 검증된 2곳의 부분집합이라 제외 | W/T no-route 뒤 provider limit | 통과 |
| B16 | 1 | 1 | 없음 | 16 | 10 | N1 잔여는 검증된 2곳의 부분집합이라 제외 | W/T no-route 뒤 provider limit | 통과 |

M-02~04는 각 여섯 행에서 N1 no-route 뒤 N2 기회, 동일 구간 reuse(새 attempt 0), 120분 W gate, W/T fallback, 운영·시간·siteGroup·부분/상위집합 gate를 고정 receipt로 회귀했다. 모든 행에서 attempt는 행 상한 이하, adapter call은 24 이하, 결과는 9 이하였고 실제 API/GPS/Auth/DB 호출은 0회였다.

### internal 후보와 적용하지 않은 결론

**internal 후보: B12.** M-01에서 A8보다 결과 수는 늘지 않았지만, 12 attempt 안에서 실제 2곳 코스의 완결 검증 기회를 처음 만든 유일한 최소 행이다. B16은 같은 1+2곳 결과에 더 많은 attempt를 사용해 후보로 우선하지 않는다. 이 결과는 고정 fixture 근거일 뿐, production 상한/순서를 바꾸는 결론이 아니다. 통합·결정 수락 전에는 internal build·env·UI에 주입하지 않는다.

### 변경 파일 / 유지 경계 / 검증

- 변경: `src/engine/courseV1.ts`, `src/engine/index.ts`, `test/course-v1-limited-integration.test.ts`, 이 작업기록.
- 유지: production default A8·24 call·18 후보·5,220 조합·9 결과, receipt cache와 fail-closed, 실제 route·권장 체류·운영시간·시간 예산 gate, 1/2곳 대표 우선·3곳 fallback, UI/API/카탈로그/DB/보드 비수정.
- `npx tsx --test test/course-v1-limited-integration.test.ts` — 31/31 통과
- `npm run test:typecheck` — 통과
- `npm test` — 102/102 통과
- `npm run test:ui` — 125 통과, 기존 skip 1, 실패 0
- `git diff --check` — 통과

### 다음 결정

통합·결정은 B12를 internal build 전용으로 수락할지, 실제 RD-DIAG 관찰이 고정 fixture와 같은 N2 완결 부족을 보이는지 먼저 판단해야 한다. 수락 전에는 production 기본값과 외부 API 호출량을 바꾸지 않는다.

---

## 2026-08-30 — 추천 엔진 진행 기록: 2-M 보완 1~4 완료, M-04 확장 대기

### 완료한 보완 근거

1. `receiptEvaluationPolicy`를 공개 `CourseV1LimitedInput`과 engine barrel에서 제거했다. 평가 정책은 engine-local 두 번째 options만 사용하며 앱 호출은 인자 하나로 A8 기본값을 유지한다.
2. M-01 비용 fixture에서 무주입 default와 명시 A8 평가 결과 전체를 `deepEqual`로 비교했다. 대표/대안·상태·outcome reason·tier diagnostics·adapter call·stop reason까지 같은 값을 확인한다.
3. M-02는 6정책 각각에서 N1 `no_route`·`unavailable`·시간 초과를 독립 실행한다. N1 검증 0 뒤 N2가 열리고 W/T가 N2보다 먼저 attempt를 쓰지 않는 것을 확인한다.
4. M-03은 6정책 각각에서 engine cache hit(동일 `origin>a` adapter 호출 1회)와 adapter 재사용 receipt(`newProviderAttemptCount: 0`)를 함께 확인했다. reuse 집계가 증가하고 새 provider attempt는 1 이하로 유지된다.

### 아직 남은 보완

5. M-04의 **6정책 × 45/78/120/180 × 복귀/도착지** 전체 매트릭스와 W/T 양성 fallback을 별도 fixture로 확장하는 작업은 아직 완료하지 못했다. 현재의 `M-02~04` fixture는 120분 W fallback·관계 gate만 포괄하므로 이 48행 요구를 대체하지 않는다.
6. 따라서 A16/B12/B16의 attempted-set·nested 사유를 최종 수락 인계로 확정하지 않는다. 기존 M-01 표는 보존하며, M-04 확장 결과를 추가한 뒤 두 사유와 1+2 결과 보존 위치를 함께 갱신해야 한다.

### 현재 실행 결과

- `npx tsx --test --test-name-pattern='M-0[123]' test/course-v1-limited-integration.test.ts` — 선택 4 fixture 통과
- `npm run test:typecheck` — 통과
- 실제 API/UI/서비스/카탈로그/env 수정·호출 — 0회

### 변경 파일과 유지 경계

- 변경: `src/engine/courseV1.ts`, `src/engine/index.ts`, `test/course-v1-limited-integration.test.ts`, 이 작업기록.
- 유지: production A8·24 call·18/5,220/9 상한, UI/API/service·카탈로그·env·보드 비수정.
- 다음 엔진 세션은 M-04 48행 fixture를 먼저 추가한 뒤 전체 회귀와 `git diff --check`를 실행해야 한다.

### 통합·결정 검토 — 2-M 보완 필요 (2026-08-30)

M-01은 현재 공개 engine entry를 여섯 정책으로 실행했고, B12가 12 attempt 안에서 1곳+2곳의 완결 검증 기회를 만드는 초기 근거를 제공한다. typecheck·엔진 31/31·UI·전체 테스트도 현재 HEAD에서 통과했다. 그러나 아래 두 경계가 완료 기준에 미달하므로 **B12는 아직 후보일 뿐 수락하지 않는다.** 새 suffix 작업을 만들지 말고 같은 2-M에서 보완한다.

1. **평가 정책의 runtime 비주입 경계:** `receiptEvaluationPolicy`가 현재 공개 `CourseV1LimitedInput`과 `src/engine/index.ts`에 노출되어 있다. 주석만으로는 UI/runtime이 정책을 주입하지 않는다는 계약이 되지 않는다. 이 필드는 입력 payload에서 제거하고, 평가용 정책은 `buildLimitedRepresentativeCourseV1`의 별도 두 번째 내부 options 또는 동등한 engine-local 평가 entry로만 전달한다. 이 type/options는 engine barrel의 일반 앱 API로 export하지 않는다. 기존 앱 호출은 인자 하나만 사용하고 production default는 A8이다.
2. **A8 default 동등성:** default 호출과 명시 A8 평가는 provider attempt·대표 하나만 비교하지 말고, 대표·대안 전체, `resultState`/`alternativeState`, outcome reason, diagnostics 전체(tier·adapter call·stop reason 포함)가 deep-equal임을 최소 두 fixture(M-01 비용, M-04 fallback)에서 고정한다.
3. **M-02 분리:** 여섯 정책 각각에서 N1의 `no_route`, `unavailable`, `time_budget_exceeded` 탈락을 독립적으로 재현한다. B는 N1 검증 0이면 N1을 소진한 뒤 N2를 열고, N2의 exact 성공 또는 안전 탈락을 정확히 기록해야 한다. W/T가 N2보다 먼저 provider attempt를 쓰지 않음을 assert한다.
4. **M-03 분리:** 동일 논리 구간의 engine receipt cache hit와 adapter가 이미 재사용한 receipt(`newProviderAttemptCount: 0`)를 구분해 검증한다. 각 여섯 정책에서 cache hit는 adapter/provider 새 호출 0, reuse 집계 증가, 다음 N1/N2 검증 지속을 보장해야 한다. 단순 fallback fixture에 `reused: true`를 넣어 통과시키면 안 된다.
5. **M-04 분리:** 여섯 정책 × 45/78/120/180분 × 복귀/도착지에서 운영 종료·siteGroup·부분/상위집합 gate를 유지한다. N1/N2가 모두 불가한 경우 W exact fallback과 T exact fallback을 각각 양성으로 검증하고, 120분 W gate와 3곳 최후순위를 assert한다. 이전 L fixture를 호출했다는 서술만으로 대체하지 않는다.
6. M-01 비교표는 유지하되, A16의 N2 미시도 사유와 B12/B16의 N1 제외 사유를 fixture의 실제 `attemptedSets`·nested gate에 맞게 명시한다. 결과 선택에서 1+2곳이 함께 남는 이유와 부분집합 제거가 적용된 위치를 짧게 기록한다.

보완 뒤에는 `npx tsx --test test/course-v1-limited-integration.test.ts`, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 다시 실행한다. 실제 API·UI·서비스·카탈로그·env 수정은 계속 0회다. 위 여섯 조건을 모두 충족할 때만 통합·결정이 B12 internal 적용 여부를 판단한다.

---

## 2026-08-30 — 추천 엔진 진행 기록: 2-M M-04 완료 인계

### M-04 완료 근거

- `M-04`는 A/B × 8/12/16의 여섯 정책, 45/78/120/180분, 왕복/별도 도착지의 **48개 고정 receipt 시나리오**를 실행한다. 45·120분은 N1/N2 모두 탈락 뒤 W의 exact 1곳 fallback, 78·180분은 N1/N2·W 이후 T의 exact 3곳 fallback을 각각 양성 검증한다. 따라서 두 fallback은 각 정책·왕복/도착지 경계에서 모두 관찰된다.
- W fixture는 입력 후보에 `closed`(10:00 시작 시 권장 15분을 끝내지 못하는 창), `a`/`same-a` 동일 `siteGroupId`, 그리고 19번째 W lane을 함께 넣는다. 사전선정 결과에서 `closed`는 제외되고, 동일 group 두 장소를 포함한 조합은 queue에 없으며, W가 wide lane임을 assert했다.
- 모든 48행에서 N1/N2 검증 성공 수는 0이다. W 행은 W 검증 성공 1, T 행은 W 성공 0·T 성공 1을 확인한다. 120분 W 행은 N1 성공이 없으므로 `gated_by_near_single_verification`이 없어 실제 W fallback이 열린 것을 확인한다. T는 마지막 tier의 유일한 3곳 조합으로만 성공한다.
- M-04 W fallback fixture에서도 production 무주입 호출과 명시 A8 평가 결과를 `deepEqual`로 비교했다. M-01 비용 fixture의 동일 비교와 합쳐, 대표/대안·상태·outcome reason·tier diagnostics·adapter call·stop reason의 A8 default 동등성을 두 fixture에서 고정했다.
- 각 행은 provider attempt ≤ 정책 상한, adapter call ≤ 24를 assert한다. fixture adapter만 사용했으며 실제 route/GPS/Auth/DB/API 호출은 0회다.

### M-01 표의 attempted-set / nested 해석 확정

- A16의 N2 미시도는 N1에서 이미 검증한 1곳 집합의 부분집합인 N2 set을 `runTier`의 nested gate가 skip하기 때문이다. provider 상한이 원인이 아니다.
- B12/B16의 남은 N1 제외도 먼저 검증된 2곳 set의 부분집합인 1곳 set을 같은 nested gate가 skip하기 때문이다. 부분 겹침 자체는 제외하지 않는다.
- 반환 직전 `selectRepresentativeCourseSetV1`은 1·2곳 검증 코스를 대표 pool으로 두고, `selectNonNestedCourseV1`에서 동일·부분·상위집합만 제거한다. 그러므로 서로 부분집합 관계가 아닌 1곳과 2곳은 함께 남는다.

### 변경 파일 / 유지 경계 / 검증

- 변경: `test/course-v1-limited-integration.test.ts`, 이 작업기록. M-04는 순수 receipt fixture만 추가했고 production 엔진 정책은 변경하지 않았다.
- 유지: production A8·24 call·18/5,220/9 상한, receipt cache·fail-closed, UI/API/service·카탈로그·환경값·보드 비수정.
- `npx tsx --test test/course-v1-limited-integration.test.ts` — 34/34 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 통과.
- `npm test` — 102/102 통과.
- `git diff --check` — 통과.

### 통합·결정 인계

2-M 보완 조건 1~6은 현재 충족했다. B12는 여전히 고정 fixture에서만 관찰된 internal 후보이며, 이 기록은 production A8·queue 순서 또는 외부 호출량 변경을 승인하지 않는다. 통합·결정 세션은 실제 RD-DIAG 관찰과 비용/안전 기준을 별도로 비교한 뒤에만 internal 적용 여부를 결정해야 한다.

### 통합·결정 수락 — 2-M 보완 (2026-08-30)

M-04 구현과 현재 HEAD의 독립 재실행을 확인했다. 여섯 receipt 정책에 45/78/120/180분과 복귀/별도 도착지를 교차한 48개 고정 입력에서, W와 T의 양성 fallback 및 운영 종료·동일 `siteGroupId`·부분/상위집합 제외 gate가 유지된다. production 무주입 A8과 명시 A8도 M-01·M-04에서 결과와 diagnostics 전체가 동일하다.

- `npx tsx --test test/course-v1-limited-integration.test.ts` — 34/34 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 통과
- `npm test` — 102/102 통과
- `git diff --check` — 통과

**상태: 수락.** B12는 12 provider attempt 안에서 1곳과 2곳의 완결 검증 기회를 함께 만든 최소 internal 후보로 유지한다. 이 수락은 production A8, 실제 API 호출량, UI·환경값을 바꾸지 않는다. 다음 작업은 별도 단계에서 B12를 internal build에만 주입하고, 고정된 두 실기기 입력을 각각 한 번 실행해 A8과 추천량·attempt·안전 reason을 비교하는 것이다. 그 결과가 확인되기 전에는 production 전환을 결정하지 않는다.

---

## 2026-08-30 — 통합·결정 지시 2-N: B12 internal 전용 엔진 진입점

### 목적과 범위

2-M에서 **B12만** internal 후보로 수락했다. 이 작업은 사용자가 정책을 고르는 기능이나 production 상한 변경이 아니라, UI가 임의 정책 객체를 주입하지 않고도 internal build에서 B12를 한정 호출할 수 있는 엔진 진입점을 만드는 작업이다.

- 수정 소유: `src/engine/`, 엔진 순수 테스트, 이 작업기록만.
- 수정 금지: `src/ui/`, Expo 환경값, Route Proxy/API·cache·DB·카탈로그, production A8 상한·queue 순서.
- 실제 API/GPS/Auth/DB 호출은 0회다.

### 구현 계약

1. 기본 공개 진입점 `buildLimitedRepresentativeCourseV1(input)`은 인자 하나일 때 계속 A8이며, `CourseV1LimitedInput`에는 정책·상한·queue 순서를 추가하지 않는다.
2. UI가 사용할 수 있는 것은 임의 `A/B × 8/12/16` 객체가 아닌, 이름과 동작이 고정된 **B12 internal 전용 진입점 하나**뿐이다. 예를 들어 `buildLimitedRepresentativeCourseV1ForInternalB12(input)`처럼 입력은 동일하고 B12만 선택한다. 명칭은 달라도 되나 A8/B12 외 정책이나 수치를 인자로 받으면 안 된다.
3. receipt evaluation policy 타입·일반 평가 옵션은 계속 `courseV1.ts` 내부 구현에만 둔다. engine barrel은 위 기본 진입점과 고정 B12 진입점만 노출하며, UI가 8/12/16·A/B를 조합하거나 runtime에서 선택할 통로를 만들지 않는다.
4. B12 진입점도 기존 12 provider attempt·24 adapter call·18개/5,220개/결과 9개·운영시간·동일 `siteGroupId`·nested·W gate·T 최후순위·fail-closed receipt 계약을 그대로 사용한다. B12라는 이유로 cache, fallback, 결과 정렬을 별도 구현하거나 완화하지 않는다.

### 필수 fixture와 완료 기준

1. M-01 비용 fixture에서 고정 B12 진입점 결과 전체가 현재 private B12 평가 결과와 `deepEqual`이고, 기본 진입점은 A8과 `deepEqual`임을 검증한다. 대표/대안·상태·outcome reason·tier diagnostics·provider attempt·adapter call을 일부만 비교하지 않는다.
2. M-04의 W 또는 T fallback fixture 하나에서 고정 B12 진입점이 운영·관계 gate와 12/24 상한을 그대로 유지함을 검증한다.
3. engine source와 public type 검사에서 `CourseV1LimitedInput`·기본 entry에 `receiptPolicy`, `providerAttemptLimit`, `queueOrder` 같은 외부 선택 필드가 없고, `process.env`/Expo import도 없음을 검증한다. 문자열 검사만으로 끝내지 말고 1~2의 실제 entry 실행을 함께 둔다.
4. `npx tsx --test test/course-v1-limited-integration.test.ts`, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 실패를 기존 expectation 완화나 정책 상한 변경으로 고치지 않는다.

### 인계

완료 기록에는 변경 파일, 기본 A8과 고정 B12의 공개 호출 계약, fixture별 A8/B12 결과·attempt/adapter 수, 실제 호출 0회, UI가 소비할 export 이름을 남긴다. 통합·결정 수락 뒤에만 UIUX가 별도 `U-1-REC-02`에서 exact internal flag로 이 진입점을 조립한다.

---

## 2026-08-30 — 추천 엔진 완료: 2-N B12 internal 전용 엔진 진입점

### 변경

- `src/engine/courseV1.ts`에 `buildLimitedRepresentativeCourseV1ForInternalB12(input)`을 추가했다. 이 함수는 호출자 입력에 정책 필드를 받지 않고 내부 상수 B12(새 provider attempt 12, queue B)만 고정해 기존 receipt 엔진으로 위임한다.
- `src/engine/index.ts`는 기본 `buildLimitedRepresentativeCourseV1`과 위 고정 B12 entry를 함께 export한다. `CourseV1ReceiptEvaluationPolicy`와 일반 evaluation options는 barrel에서 export하지 않았다.
- `test/course-v1-limited-integration.test.ts`의 M-01 비용 fixture는 고정 B12 entry와 기존 내부 B12 평가 결과를 전체 `deepEqual`로 비교한다. M-04 120분 왕복 W fallback fixture도 같은 비교를 수행하고 N1/N2 0, W 1, provider attempt ≤12, adapter call ≤24를 확인한다.

### 공개 계약과 유지 경계

- 기본 공개 호출은 계속 `buildLimitedRepresentativeCourseV1(input)`이며 production 기본값은 A8이다. `CourseV1LimitedInput`에는 `receiptPolicy`, `providerAttemptLimit`, `queueOrder`를 추가하지 않았다.
- UI가 소비할 수 있는 새 정책 선택 entry는 `buildLimitedRepresentativeCourseV1ForInternalB12` 하나다. 인자로 A/B·8/12/16을 조합하는 runtime 선택 통로는 추가하지 않았다.
- B12 entry는 기존 receipt cache, fail-closed, 운영시간·동일 `siteGroupId`·nested gate, W gate·T 최후순위, 18 후보/5,220 조합/결과 9·adapter call 24 경계를 별도 구현이나 완화 없이 그대로 사용한다.
- engine source/barrel을 검사해 공개 input에 외부 정책 필드가 없고, engine에 `process.env`·Expo import가 없음을 확인했다. 실제 API/GPS/Auth/DB 호출은 0회다.

### 검증

- M-01: 고정 B12와 내부 B12의 대표·대안·상태·outcome reason·tier diagnostics·provider attempt·adapter call 전체가 `deepEqual`; A8 기본 entry도 명시 A8과 `deepEqual`.
- M-04: 고정 B12 W fallback이 운영·관계 gate 및 12/24 상한을 유지하며 내부 B12와 `deepEqual`.
- `npx tsx --test test/course-v1-limited-integration.test.ts` — 34/34 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 102/102 통과.
- `git diff --check` — 통과.

### 다음 결정 / 인계

2-N은 internal build 진입점만 만들었다. production A8·환경값·UI·Route Proxy/API·카탈로그·DB는 변경하지 않았다. 통합·결정 수락 뒤 UIUX는 `U-1-REC-02`에서 exact internal+diagnostics flag에만 `buildLimitedRepresentativeCourseV1ForInternalB12`을 조립할 수 있다. 그 뒤 QA의 RD-B12 실기기 각 1회 비교 전에는 production 전환이나 B12 범위 확장을 결정하지 않는다.

### 통합·결정 검토 — 2-N 보완 필요 (2026-08-30)

B12 고정 entry, M-01/M-04의 전체 결과 비교, 12/24 및 안전 gate는 확인했다. 그러나 기본 공개 entry가 아직 다음과 같이 두 번째 인자를 받는다.

```ts
buildLimitedRepresentativeCourseV1(input, evaluationOptions?)
```

`CourseV1ReceiptEvaluationOptions`의 type 이름을 barrel에서 export하지 않아도 TypeScript의 구조적 타입 규칙상 UI/runtime이 `{ receiptPolicy: { providerAttemptLimit, queueOrder } }`를 전달할 수 있다. 이는 “기본 entry는 A8 하나, UI에는 B12 고정 entry 하나”라는 2-N 완료 계약을 충족하지 못한다. 따라서 **U-1-REC-02는 아직 시작하지 않는다.**

같은 **2-N** 안에서 아래만 보완한다. 새 suffix 작업을 만들지 않는다.

1. `buildLimitedRepresentativeCourseV1`의 공개 시그니처를 input 하나로 닫고, 실제 구현은 engine-local private helper가 A8 또는 B12 policy를 받도록 분리한다. `buildLimitedRepresentativeCourseV1ForInternalB12(input)`도 같은 private helper로 위임한다.
2. M-01~M-04의 A/B×8/12/16 매트릭스가 필요로 하는 일반 평가 helper는 engine barrel과 app 경로에 export하지 않는다. 테스트 전용 helper가 불가피하면 이름·파일 경로에 test-only임을 명시하고, `src/ui/` 및 production recommendation 조립 경로에서 그 helper를 import하지 못함을 source 계약으로 검증한다. UI가 소비할 production export는 기본 A8과 고정 B12 두 entry뿐이다.
3. 기본 entry에 두 번째 인자를 전달하는 코드는 compile-time에서 실패해야 한다(`@ts-expect-error` 또는 동등한 타입 fixture). 동시에 M-01/M-04에서 기본 A8·고정 B12가 private evaluation 결과와 전체 `deepEqual`인 실제 실행 fixture를 유지한다.
4. `src/ui/`에는 아직 B12 import·env·정책 선택 변경이 없어야 한다. public input에 policy 필드가 없고 engine에 `process.env`/Expo import가 없음을 다시 검증한다.
5. 수정 뒤 `npx tsx --test test/course-v1-limited-integration.test.ts`, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다. 실제 API/GPS/Auth/DB 호출은 계속 0회다.

완료 기록에는 공개 A8/B12 entry의 정확한 signature, test-only matrix 경계, 두 인자 기본 호출의 compile-time 거절 근거, 전체 회귀 결과를 남긴다. 이 조건을 만족할 때만 통합·결정이 2-N을 수락하고 U-1-REC-02로 넘긴다.

---

## 2026-08-30 — 추천 엔진 완료: 2-N 보완 공개 A8 경계 폐쇄

### 변경

- 기본 공개 entry의 정확한 signature를 `buildLimitedRepresentativeCourseV1(input: CourseV1LimitedInput)`으로 닫았다. 두 번째 `evaluationOptions`는 engine-local `buildLimitedRepresentativeCourseV1WithEvaluation` private helper로 이동했다.
- 고정 B12 entry `buildLimitedRepresentativeCourseV1ForInternalB12(input: CourseV1LimitedInput)`도 위 private helper에만 B12(12/B)를 전달한다. 둘 다 기존 receipt 구현 하나를 공유하므로 cache·fail-closed·운영/관계·W/T·상한 로직을 분기하거나 완화하지 않는다.
- M-01~04 A/B×8/12/16 matrix는 [courseV1.testOnly.ts](/Users/shindongheun/Desktop/myProject/TimeFit/src/engine/courseV1.testOnly.ts)에서만 노출하는 `buildLimitedRepresentativeCourseV1ForTestOnlyReceiptEvaluation`을 통해 실행한다. 이 helper는 engine barrel에 export하지 않았고, `src/ui/`의 import도 0건이다.
- 통합 테스트에 `@ts-expect-error` fixture를 추가해 `buildLimitedRepresentativeCourseV1(input, policy)`가 compile-time에서 거절됨을 고정했다. M-01/M-04는 계속 기본 A8·고정 B12와 test-only 평가 결과 전체를 `deepEqual`로 실제 실행한다.

### 공개 계약과 검증

- production/UI가 소비할 engine barrel export는 A8 기본 entry와 고정 B12 entry뿐이다. 일반 평가 options·정책 type은 barrel에 없다.
- `CourseV1LimitedInput`에는 `receiptPolicy`·`providerAttemptLimit`·`queueOrder`가 없으며 engine에는 `process.env`·Expo import가 없다. source 검사에서 UI의 test-only/B12 import는 0건, barrel에는 B12만 있음을 확인했다.
- `npx tsx --test test/course-v1-limited-integration.test.ts` — 34/34 통과.
- `npm run test:typecheck` — 통과 (`@ts-expect-error`의 두 인자 거절 포함).
- `npm test` — 102/102 통과.
- `git diff --check` — 통과.
- 실제 API/GPS/Auth/DB 호출 — 0회.

### 인계

2-N의 보완 조건을 충족했다. production A8, UI·Expo 환경값, Route Proxy/API·cache·DB·카탈로그는 변경하지 않았다. 통합·결정 수락 전까지 U-1-REC-02는 시작하지 않으며, 수락 뒤에도 UI는 exact internal+diagnostics flag에서만 `buildLimitedRepresentativeCourseV1ForInternalB12(input)`을 호출해야 한다.

### 통합·결정 수락 — 2-N 보완 (2026-08-30)

공개 A8 함수가 단일 `CourseV1LimitedInput` 인자로 닫힌 것과, 두 번째 인자 호출이 compile-time에서 거절되는 fixture를 확인했다. B12는 고정 entry 하나이고 A/B×8/12/16 matrix는 barrel 밖의 test-only 경계에서만 실행된다. 현재 `src/ui/`에는 B12·test-only import와 정책 환경값 변경이 없다.

- `npx tsx --test test/course-v1-limited-integration.test.ts` — 34/34 통과
- `npm run test:typecheck` — 통과
- `npm test` — 102/102 통과
- `git diff --check` — 통과

**상태: 수락.** production A8와 실제 API 호출량은 바꾸지 않는다. 다음 작업 `U-1-REC-02`는 이제 시작 가능하며, exact internal+diagnostics build에서만 고정 B12 entry를 조립·식별한다. UIUX 수락 뒤에만 RD-B12의 두 실기기 실행으로 넘어간다.
