# QA-TWO-STOP-01 — 최대 2곳 제한 조립 자동 통합 게이트

## 담당과 실행 시점

- 담당: QA·출시 세션
- 상태: **QA fixture 타입 보완 필요 / production 활성화 불가** — UI session reuse 뒤 TS-01~16 runtime 통과, TS-14 fixture의 필수 receipt 타입 복구와 전체 회귀 대기
- Simulator 자율 조작 금지. 실제 API·GPS·DB·실기기 호출 금지
- 새 QA 전용 fixture와 통합 테스트 파일만 수정한다.

시작 시 `AGENTS.md`, `docs/README.md`, `docs/테스트.md`의 REC-32/COURSE-12, `docs/03_product/UIUX_테스트명세.md`의 UXV-47, `docs/work/integration-decision/two-stop-limited-assembly.md`, 이 파일만 읽는다. 과거 QA archive 전체나 기존 8개 simulator launcher를 다시 실행하지 않는다.

## 목적

역할별 단위 테스트 존재를 다시 나열하는 것이 아니라, 공개 release 경계에서 아래 네 가지를 한 번에 증명한다.

1. one-stop fallback이 깨지지 않음
2. A 선택→B 점진 표시→B 선택→2곳 상세가 같은 exact snapshot을 사용
3. A 취소가 원래 화면을 복원하고 stale 응답·중복 호출을 차단
4. initial/auto/shared budget과 geometry connector 상한이 역할 경계 전체에서 일치

## 고정 시나리오 집합

fixture는 정밀 실제 위치나 운영 API를 쓰지 않고 공개 가상 place ID와 고정 clock을 사용한다.

| ID | 입력·주입 | 기대 |
| --- | --- | --- |
| TS-01 | one-stop A·B·C·D, 첫 후보 1개 탈락 뒤 pair exact 3개가 지연 순서로 성공 | 선택 장소 고정, B 카드 1→2→3 점진 append, 순서 고정, 성공 완료 뒤 실패·부족 문구 0 |
| TS-02 | A/B 두 순서 exact, A-first 1분 빠름 | A→B course 한 개, 역순 중복 0 |
| TS-03 | 두 순서 exact 이동합 동률 | A→B 선택 |
| TS-04 | B-first만 운영/route 통과 | 화면은 `선택한 A`와 실제 순서 B→A를 구분, 상세 3 legs |
| TS-05 | 후보 2개 성공 뒤 후보 소진 | 2개와 부족 이유, 미검증 채움 0. 같은 후보 소진이라도 3개 목표를 채웠으면 부족 문구 0 |
| TS-06 | 후보 모두 시간·운영·no-route 탈락 | B 0, A one-stop 유지, 원인별 safe 안내 |
| TS-07 | provider/store/limit terminal | 진행 중단, A/취소 유지, fallback provider 0 |
| TS-08 | 초기 attempt 8, A 자동 16, pair more 12 | 총 36, 37번째 provider 0, 누적 B ≤6. 누적 6개 상한만 도달하고 실제 attempt가 남은 경우 소진 오류 문구 0 |
| TS-09 | 초기 8 뒤 single more가 shared 8 소비, A 자동 stage, pair more | pair 명시 확장 최대 4, 총 36 이하 |
| TS-10 | cache/session hit이 모든 shared leg에 존재 | adapter call은 있으나 provider attempt 0으로 재사용 |
| TS-11 | A 선택 중 취소 후 과거 success/error 도착 | 선택 전 ID/order/more/offset 복원, stale 화면 반영 0, 취소 call 0 |
| TS-12 | A 취소 후 같은 A와 다른 C 재선택 | branch는 분리, cumulative ledger는 유지, 중복 pair call 0 |
| TS-13 | B 선택 후 CourseConfirm | engine/route 0, exact order·3 legs·2 stops·시간 합 일치 |
| TS-14 | 2곳 transit 세 legs의 endpoint gap | 상세 먼저 표시, connector ≤6·동시 ≤2·부분 실패 유지 |
| TS-15 | malformed continuation/provider/input mismatch | route 0, 기존 one-stop 유지, safe continuation 오류 |
| TS-16 | 기존 one-stop/조건부 시장/카카오맵/진행 | 기존 동작과 호출량 snapshot 불변 |

모든 사용자 표시·접근성 snapshot에는 설계 기호 `A`/`B`를 그대로 쓰지 않는다. 선택 장소명 또는 `선택한 장소`로 표현하되 실제 방문 순서를 `첫 번째 장소`로 단정하지 않는다.

## QA 하네스 규칙

- 실제 엔진 공개 entry와 UI production adapter를 호출한다. 문자열 검색이나 독립 가짜 구현만으로 통과시키지 않는다.
- route receipt port, progress 지연, abort, clock, candidate provider, geometry connector만 fixture로 주입한다.
- 각 시나리오는 place IDs, chosen order, stop/leg 수, exact source, result reason, adapter calls, new provider attempts, reuse, connector calls, stale ignored 수를 machine-readable snapshot으로 남긴다.
- 제목·랜덤 카드 순서만 비교하지 않는다.
- QA는 기능 코드를 고치지 않는다. 실패하면 소유 역할, 공개 경계, 최소 재현 ID를 남기고 현재 작업을 실패/보완 필요로 종료한다.

## 실행 순서

1. TS-01~16의 fixture schema와 expected snapshot을 QA 전용 파일에 작성한다.
2. 이미 수락된 `2-Y` engine entry, `API-TWO-STOP-02` receipt 계약, `U-TWO-STOP-01` UI port를 같은 fixture 흐름에 연결한다.
3. 전체 자동 회귀를 한 번 실행한다. 중간에 Simulator 버튼을 반복 조작하거나 실제 Edge 배포·API 호출로 대체하지 않는다.

## 검증 명령과 합격 기준

- QA-TWO-STOP-01 전용 하네스
- 역할별 새 테스트와 관련 one-stop/pagination/receipt/Results/CourseConfirm/geometry 회귀
- `npm run test:typecheck`
- `npm run test:ui`
- `npm test`
- `git diff --check`

합격은 TS-01~16 모두 통과, 신규 provider attempt 최대 36, connector 최대 6, stale 화면 반영 0, B 선택 추가 route 0, 기존 one-stop·조건부·지도·진행 회귀 0이다. 기존 unrelated skip은 새 실패로 세지 않되 이름과 이유를 기록한다.

자동 게이트가 통과한 뒤에만 통합·결정 세션이 일반 사용자 entry 활성화를 판단한다. 실기기 smoke가 필요하면 왕복 1건과 별도 목적지 1건만 사용자에게 정확한 입력·관찰 항목을 요청한다. 자동 fixture로 확인한 취소·수량 시나리오를 실기기에서 모두 반복하지 않는다.

## 수정 금지와 인수인계

- 수정 금지: `src/engine/`, `src/services/`, `src/ui/`, App/navigation, Edge/migration/data, `.env*`, 제품 기준 문서, 보드
- 운영 API·Supabase 운영 데이터·실사용자·실제 좌표를 fixture에 넣지 않는다.
- 완료 기록은 변경 파일/유지 계약/명령별 테스트 수/잔여 실기기 위험을 이 문서 아래에 남긴다. commit·push는 사용자 요청 전 금지한다.

## 2026-09-03 실행 인수인계 — 보완 필요

### 1. 변경 파일과 목적

- `test/qa-two-stop-integration.test.ts`: TS-01~16의 고정 clock·가상 place·route receipt·지연/abort·connector fixture를 추가했다. 공개 engine entry를 호출하는 `createTwoStopSelectionEnginePort`, 실제 `createCourseV1ProxyRouteAdapter`, UI controller/card/detail geometry port를 같은 흐름에서 호출하고, 각 시나리오의 place ID·방문 순서·stop/leg·exact source·사유·adapter/provider/reuse/connector/stale 계측을 JSON receipt로 출력한다.
- 이 작업 문서: 실행 결과, 중단 원인, 담당 경계와 최소 재현을 기록했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- `src/engine/`, `src/services/`, `src/ui/`, App/navigation, Edge/migration/data, 제품 기준 문서와 작업조정 보드는 수정하지 않았다.
- 최대 2곳, initial 8 + automatic 16 + shared 12 = 총 36, connector 최대 6·동시 2, one-stop fallback, production 비활성 정책을 바꾸지 않았다.
- Simulator·실기기·Metro·Xcode·운영 API·GPS·DB 호출은 모두 0회다.

### 3. 실행 테스트와 결과

- `npx tsx --test test/qa-two-stop-integration.test.ts`: **실패, 17개 중 16 통과·1 실패**.
  - TS-01~11, TS-13~16 및 machine-readable receipt gate 통과.
  - TS-12 실패: 같은 선택 장소를 취소 후 재선택했을 때 Proxy adapter 재호출 기대 0회, 실제 10회.
  - TS-11 stale 화면 반영 0, TS-13 선택 후 추가 route 0, TS-14 connector 6·최대 동시 2·부분 실패 유지, 시나리오별 provider attempt 36 이하를 통과했다.
- `git diff --check`: 통과.
- 최초 sandbox 실행은 TSX 임시 IPC socket 생성 권한(`EPERM`)으로 시작하지 못했고, 동일 명령을 허용된 로컬 실행으로 1회 재실행해 위 기능 결과를 얻었다.
- 전용 하네스 중단 조건이 발생했으므로 문서 규칙에 따라 `npm run test:typecheck`, `npm run test:ui`, `npm test`와 관련 전체 회귀는 실행하지 않았다.

### 4. 다음 결정·위험·최소 재현

- 상태: **보완 필요 / production activation 불가**.
- 최소 재현 TS-12: 동일 session-scoped `createTwoStopSelectionEnginePort`와 controller를 만들고 A 선택 완료 → 취소 → 같은 A 재선택을 수행한다. 첫 실행 뒤 adapter call 수를 기준으로 두 번째 실행 증가분을 측정하면 10이며 기대는 0이다. 이어 C를 선택하면 branch ID는 분리되지만 기존 A exact pair 결과는 재사용되지 않는다.
- 담당 역할: **UIUX** (`src/ui/recommendation/twoStopSelectionEnginePort.ts`의 session reuse 전달/보관 공개 경계). 엔진은 `reuse` 입력을 지원하지만 UI production port context에서 이를 제외하고 완료 결과를 보관하지 않는다. 외부 API 어댑터는 요청받은 호출을 계측대로 수행하므로 원인 경계가 아니다.
- UIUX 보완 뒤 QA는 TS-12부터 전용 하네스를 다시 실행하고, 16개 시나리오가 모두 통과할 때만 지정된 typecheck/UI/core 회귀를 이어서 수행해야 한다. 현재 단계에서 실기기 smoke는 요청하지 않는다.

## QA-TWO-STOP-01 최종화 작업 명령

- 담당: QA·출시 세션
- 현재 확인: 통합·결정 세션이 수정되지 않은 원본 하네스를 재실행해 TS-01~16과 receipt gate **17/17 통과**, TS-12 동일 선택 재진입 adapter 증가 0을 확인했다.
- 남은 원인: `test/qa-two-stop-integration.test.ts:244`의 TS-14 fake connector가 현재 `PrivateWalkConnectorResult` 공개 계약에 필요한 `receipt`를 모든 결과에서 누락하고, unavailable 결과의 `reason`도 누락했다. `tsx --test`는 transpile 실행이라 통과하지만 `tsc --noEmit`은 이를 정확히 거부한다.

수정은 `test/qa-two-stop-integration.test.ts`의 TS-14 fixture로 제한한다.

- exact geometry 결과에 fixture receipt `{ newRequestStarted: true, reuse: 'new_request' }`를 붙인다.
- unavailable 결과에는 안전한 고정 reason `route_unavailable`과 같은 fixture receipt를 붙인다.
- connector 호출 6, 실패 1, 최대 동시 2, 성공선 유지라는 기존 기대값은 바꾸지 않는다.
- `as never`, 타입 단언, `@ts-ignore`, 기대값 완화로 숨기지 않는다.
- engine/API/UI/App/Edge/DB/data/env와 다른 시나리오는 수정하지 않는다.

수정 후 다음을 실행한다.

```bash
npx tsx --test test/qa-two-stop-integration.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

전부 통과하면 이 문서에 네 항목 최종 인계를 남긴다. Simulator·실기기·실제 API·원격 Edge는 호출하지 않는다. 이 자동 게이트 수락 뒤에만 통합·결정 세션이 Wave 2 production 연결 작업을 연다.

## 2026-09-03 최종화 완료 인수인계

### 1. 변경 파일과 변경 목적

- `test/qa-two-stop-integration.test.ts`: TS-14 fake connector의 exact 결과에 `{ newRequestStarted: true, reuse: 'new_request' }` receipt를 추가하고, unavailable 결과에 안전 reason `route_unavailable`과 같은 receipt를 추가했다. `PrivateWalkConnectorPort` 전체 공개 타입을 만족하도록 동작 없는 `reset()`도 같은 fixture에 추가했다.
- 이 작업 문서: 최종화 변경, 지정 회귀 결과, 유지 경계와 다음 활성화 판단을 기록했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- connector 호출 6회, 실패 1회, 최대 동시 2회와 성공 geometry 유지 기대값은 변경하지 않았다.
- TS-01~13·15~16 fixture와 engine/API/UI/App/Edge/DB/data/env 및 작업조정 보드는 수정하지 않았다.
- 최대 2곳·총 provider attempt 36·one-stop fallback·session reuse·production 비활성 정책을 그대로 유지했다.
- Simulator·실기기·Metro·Xcode·실제 API·원격 Edge 호출은 0회다.

### 3. 실행한 테스트와 결과

- `npx tsx --test test/qa-two-stop-integration.test.ts`: **17/17 통과**. TS-01~16 및 machine-readable receipt gate가 모두 통과했고 TS-14는 connector 6·실패 1·최대 동시 2를 유지했다.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **225 통과 / 0 실패 / 기존 skip 1**. skip은 `철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다`이며 현행 동작 실패가 아니다.
- `npm test`: **117/117 통과**.
- `git diff --check`: **통과**.
- 첫 지정 연속 실행에서 reason/receipt 보완 뒤 공개 port의 필수 `reset()` 누락을 typecheck가 추가로 검출했다. TS-14 fixture에 no-op `reset()`을 보완한 뒤 위 다섯 명령을 처음부터 다시 실행해 모두 통과했다.

### 4. 다음 결정 필요 사항·위험·재현 조건

- QA-TWO-STOP-01 자동 게이트 상태: **완료 / 통합·결정 수락 요청 가능**.
- 자동 범위에서 남은 실패는 없다. 실기기·운영 API·원격 Edge 정확성은 이번 고정 fixture 게이트의 증명 범위가 아니다.
- 다음 단계는 통합·결정 세션이 이 인계를 검토해 Wave 2 production 연결 작업을 열지 판단하는 것이다. QA 세션은 production entry를 직접 활성화하지 않는다.

## 2026-09-03 통합·결정 검토

- 상태: **수락 / Wave 2 production 연결 가능**.
- 통합·결정 세션이 전용 하네스 17/17, `npm run test:typecheck`, `npm run test:ui`(225 통과·기존 skip 1), `npm test`(117/117), `git diff --check`를 다시 실행해 모두 통과함을 확인했다.
- 자동 검증 범위에서 동일 장소 취소·재선택의 신규 adapter 호출 0, 선택 확정 뒤 추가 route 0, provider attempt 최대 36, connector 최대 6·동시 2, stale 화면 반영 0 계약을 수락한다.
- 이 수락은 아직 일반 사용자 화면에서 2곳 선택이 활성화됐다는 뜻이 아니다. 실기기·운영 API·원격 Edge는 검증하지 않았으며, 다음 작업에서 production Results/CourseConfirm composition을 연결한 뒤 최소 smoke로 확인한다.
