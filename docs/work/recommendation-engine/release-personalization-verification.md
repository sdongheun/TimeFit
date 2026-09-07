# 2-AB — 출시 연결 전 현행 검증

상태: **지금 실행 가능**. 기존 dwell-personalization.md의 2026-09-04 구현을 재사용한다. 새 알고리즘을 만들지 않는다.

1. AGENTS/역할 기준/최신 출시 결정과 dwell-personalization.md 완료 인계, 실제 src/engine/dwellPersonalization.ts와 courseV1 개인화 entry를 비교한다. 문서만 보고 구현 완료를 재선언하지 않는다.
2. 기존 DwellPersonalizationSampleV1과 CourseV1Input.dwellPersonalizationSamples, stop.dwellPersonalization의 정확한 exported shape/시간순 방향/호출 순서를 DB·UI 인계로 기록한다. UI가 userId·raw timestamp를 엔진에 넘기지 않도록 한다.
3. 2개 기본·3개 시작·최신5·중앙값 5분 반올림·기본±10·place min/max·복합 키·missing/invalid를 현행 fixture로 확인한다. one-stop/pair/continuation 입력 frozen snapshot의 현행 계약을 설명한다.
4. 개인화 때문에 후보 소실·API 추가·순서 변경·운영시간/총예산 초과가 생기는지 검사한다. 동일 입력 off/empty/invalid는 기존 기본 결과와 동일해야 한다. pair의 이미 검증된 exact legs와 ledger를 보존한다.
5. 맞춤 표시를 위한 실제 적용/기본 복귀/동일값 판정을 현행 엔진 snapshot으로 UI가 구분할 수 있는지 확인한다. 불가능하면 최소 backward-compatible 결과 메타데이터만 제안하고 통합 수락 뒤 구현한다. 별도 사용자 통계/서버 profile 계산을 엔진에 추가하지 않는다.
6. 발견한 순수 엔진 결함만 failure-first로 수정한다. src/data, src/ui, repository, API transport, migration은 수정하지 않는다. 특히 API 세션 소유 travel.ts의 네트워크/로그 수정과 겹치지 않는다.
7. 12개였던 기존 집중 fixture 숫자를 고정 기대값으로 복사하지 말고 현행 실행 수를 보고한다. 실제 API/DB/GPS0. 정상이라면 재구현 없이 검증·계약 인계로 완료한다.

## 공통 검증·권한

[Wave 공통 실행 규칙](../integration-decision/release-personalization-wave.md)을 따른다. 코드 변경 전 실패 fixture, 변경 후 typecheck/UI/core/집중 테스트와 diff 검사. 운영 API·사용자 데이터·키 출력·원격 쓰기·commit/push 금지. 결과를 이 문서에 변경 파일/유지 계약/테스트/다음 결정 네 항목으로 인계한다. 문서의 구현 전 상태는 실제 증거 없이 완료로 올리지 않는다.

## 2026-09-07 검증 인계

판정: **엔진 집중 검증 완료, 출시 연결 수락은 대기**. 최신 DEC-RELEASE-PERSONALIZATION-01·DEC-GUEST-MEMBER-BENEFIT-01 및 REC-34와 대조했다. 중앙 문서의 구현 전 표기는 전체 연결이 남아 있으므로 유지한다. 9월 4일 수치를 재사용하지 않고 현재 entry를 실행했다.

### 변경 파일

- `src/engine/courseV1.ts`: allocator의 미적용 stop 재배분 결함만 수정했다. 이전에는 A만 개인화되어도 B의 기본 권장값을 새 목표로 재시도했다. 80분/세 leg 각 5분/buffer 10분의 기본 `[30,20]`에서 A 목표 20분을 주면 B가 표본 없이 30분으로 늘어났다. 실패 fixture로 확인 후 `profiles[index].state !== 'applied'` stop은 기존 배분을 유지하도록 제한했다. 이유는 복합 키별 적용 경계를 보존하기 위함이며 상태는 **수정·집중 검증 완료**다.
- `test/dwell-personalization-course.test.ts`: 위 실패 반례, one-stop/pair 전체 off·empty·invalid JSON 동등성, 표시 판단용 네 snapshot, frozen 표본의 single/pair continuation 회귀를 추가했다. continuation fixture 작성 중 공개 출력명을 `appendedCourses`로 정정하고 shared 12회 내 pair 반환값 2개를 확인했다. 이 두 건은 fixture 작성 오류이며 제품 결함으로 세지 않는다.
- 이 문서: 실행 결과·DB/UI 공개 계약·통합 미충족 항목을 기록했다. 중앙 보드·정책·역할 밖 파일과 기존 사용자 변경은 수정하지 않았다.

### 유지 계약 및 DB/UI 소비 순서

공개 export는 `src/engine/index.ts`에 있다. 기존 중앙값 함수·export·타입을 재작성하지 않았다.

```ts
type DwellPersonalizationSampleV1 = Readonly<{
  category: string;
  subCategory: string;
  dwellMin: number;
}>;
type DwellPersonalizationInputV1 = Readonly<{
  category: string;
  subCategory?: string;
  minStayMin: number;
  recommendedStayMin: number;
  maxStayMin: number;
  samples: readonly DwellPersonalizationSampleV1[];
}>;
type DwellPersonalizationResultV1 = Readonly<{
  state: 'applied' | 'not_applied';
  recommendedStayMin: number;
  validSampleCount: number;
  windowSampleCount: number;
}>;
// CourseV1Input（CourseV1LimitedInput/pair input도 상속）
dwellPersonalizationSamples?: readonly DwellPersonalizationSampleV1[];
// CourseV1Stop의 기존 선택적 메타데이터
dwellPersonalization?: Readonly<{
  targetStayMin: number;
  baselineStayMin: number;
  baselineStayState: 'recommended' | 'short';
}>;
```

1. DB/consumer가 일반 회원·현재 계정·별도 동의·명시 완료·중복 제외·가져온 guest 체류 제외를 먼저 보장한다. 엔진에는 계정/동의/완료 ID가 없으므로 이 적격성을 검사할 수 없다. `userId`, 좌표, 원시 시각, repository 객체를 표본과 함께 넘기지 않는다.
2. DB는 적격 표본을 **과거→최신** 순서로 제공한다. 엔진은 복합 키와 양의 유한값을 필터한 뒤 마지막 최대 5개를 사용한다. UI가 역순 전달하거나 서로 다른 그룹이 섞인 전체 배열을 먼저 5개로 자르면 안 된다. 중복 제거·동률 시각 정렬은 DB 계약에서 고정해야 한다.
3. `deriveDwellPersonalizationV1(input)`은 3개 미만/missing 키를 기본값으로 반환한다. 짝수 중앙값은 가운데 두 값 평균이며 5분 반올림→기본 ±10→장소 min/max 순서다. `validSampleCount`는 입력에 전달된 유효 전체 수이고 `windowSampleCount`는 최대 5다. DB가 일부 표본만 전달했다면 이 수를 계정 평생 누적수처럼 표시하지 않는다. UI/DB에서 계산을 복제하지 않는다.
4. 추천 session 생성 시 적격 표본을 값 복사하고 배열·각 항목을 동결한다. `readonly`는 TypeScript 제약이고 엔진 자체의 runtime freeze가 아니다. 같은 session의 release one-stop build/continue와 pair begin/continue에는 동일 내용 snapshot을 전달한다. 계정 변경·로그아웃·동의 철회는 consumer가 진행 요청을 중단하고 이전 결과/cache의 개인화 사용을 끝내야 한다.
5. one-stop은 기존 최소 체류·route·운영시간·buffer 검증 뒤 allocator에서 적용한다. pair는 두 순서를 최소 체류로 검증하고 각 순서의 같은 exact legs에서 배분한 뒤 기존 최소 이동합/A-first 동률 규칙을 사용한다. 개인화 실패로 가능한 순서가 제거되지 않는다. 선택 체류가 달라지면 예정 출발·후속 도착 시각은 재계산되며, 시각 숫자 불변이 아니라 **시간 안전성 불변**이다.
6. single continue 출력은 `appendedCourses`, pair 출력은 `courses`다. continuation JSON에는 표본이 없고 표본 변경 감지도 없다. 기존 exact pair seed 및 same-branch reuse는 완료 snapshot을 그대로 반환하므로 같은 frozen session에서만 사용한다. 변경한 표본으로 예전 seed를 재개해 최신 개인화를 보장한다고 주장하면 안 된다.
7. 후보 pool/queue, route adapter 및 first/page 8·pair 16/12/36 예산, geometry, 캐시 계약은 유지했다. 실제 API/DB/GPS 호출은 0회이며 테스트의 receipt는 고정 함수다.

### 테스트 결과

- 수정 전: 기존 집중 12개 통과, 신규 복합 키 배분 반례 1개 실패(`30 !== 20`). 수정 후 집중 16개를 포함한 5개 파일 **62/62 통과**. 명령: `node --import tsx --test test/dwell-personalization.test.ts test/dwell-personalization-course.test.ts test/release-one-stop-pagination.test.ts test/release-one-stop-verified-course.test.ts test/release-two-stop-selection.test.ts`.
- frozen continuation 반례에서 기본/개인화의 모든 반환 장소·방문 순서·legs·receipt 호출열·pair ledger를 비교했다. single 후속 3개, pair 첫 3개/후속 2개를 반환하며 목표를 채우기 위한 초과 호출이 없다. 각 stop 도착/출발 시간식·min/max·총예산도 검사했다. 기존 운영 종료/총예산 반례는 그대로 통과했다.
- `npm run test:typecheck`: 최종 **통과**. 최초 실행은 동시 작업 중인 Live Activity `prepareHandoff`/`settleHandoff` 타입 12건이 실패했으며, 이후 해당 역할 변경 반영 뒤 통과했다.
- `npm run test:ui`: 최종 관찰 **497개, 489 통과·7 실패·1 skip**. 실패는 `test/ui/place-course-screen-runtime.test.mjs`의 38/115/154/282(A 및 B→A)/437/505행 시나리오다. `resolveRoute is not a function`, handoff·단계 전이 기대 불일치가 포함되며 본 작업에서 수정하지 않았다. 최초 관찰은 487 통과·9 실패로 공유 worktree가 진행 중이다.
- `npm test`: 최종 관찰 **244개, 235 통과·9 실패**. 위 화면 7개 및 `test/index.js`의 자식 테스트 발견 실패, 데이터 사진 허락 테스트가 포함된다(자식 출력은 244개/236 통과/8 실패: `test/data-release-personalization.test.mjs:7` + 화면 7개). 중복 출력은 별도 엔진 실패로 합산하지 않는다. 최초 관찰 233 통과·11 실패 역시 동시 작업 상태다.
- `git diff --check`: 통과. 전체 회귀가 green이라고 판정하지 않는다. 네이티브/원격 검증은 이번 순수 엔진 검증에 포함하지 않았다. stage/commit/push 없음.

### 다음 결정: 맞춤 표시와 출시 연결

현재 metadata의 존재나 순수 함수의 `state: applied`만으로 맞춤 표시하면 안 된다. `baselineStayMin`은 카탈로그 recommended가 아니라 **동일 후보·순서에서 비개인화 allocator가 선택한 값**이다.

| 관찰 snapshot (`baseline / target / stay`) | UI 해석 |
| --- | --- |
| 메타데이터 없음 | 적용 근거 없음, 기본 표시 |
| 30 / 40 / 40 | 기본 선택 대비 실제 변경·목표 달성 |
| 30 / 30 / 30 | 동일값, 변화된 추천 표시 금지 |
| 30 / 40 / 30 | 기본 선택 복귀, 변화된 추천 표시 금지 |
| 30 / 40 / 35 | 시간 조건으로 부분 clamp된 실제 변경 |

위 구분은 실행 fixture로 확인했다. `stayState`만으로 개인화 여부를 판정하지 않는다. metadata만으로는 **카탈로그 기본 recommended와 최종값의 동일 여부**까지 완전 판정할 수 없다. 예를 들어 baseline 20, target 40, selected 30인데 카탈로그 recommended 30인 경우는 최신 결정상 동일값 표시 제외 대상이다. UI가 같은 session 카탈로그 원본을 갖지 못하는 경우를 위해 `stop.dwellPersonalization.catalogRecommendedStayMin?: number` 추가를 최소 backward-compatible 제안으로 남긴다. **통합 수락 전 미구현**이며, 필드 없는 결과는 보수적으로 맞춤 라벨을 숨길 수 있다. 독립 서버 profile 계산이나 사용자 통계를 추가하지 않는다.

코드 검색 시 production `src/data/courseV1CandidateProvider.ts`의 category/subCategory 투영과 UI/서비스의 `dwellPersonalizationSamples` 주입은 아직 없었다. 따라서 현재 엔진 검증을 회원 개인화 end-to-end 출시 완료로 해석하면 안 된다. 다음 담당은 데이터의 정확한 키 투영, DB의 적격·시간순 표본 계약, UI의 동결/계정 전환/맞춤 표시 연결, QA의 실패 중인 전체 회귀 및 출시 게이트 재확인이다. 중앙 문서에는 REC-34의 엔진 집중 검증 근거만 반영하고 전체 구현 전 상태 승격은 이 연결 검증 뒤 결정한다.
