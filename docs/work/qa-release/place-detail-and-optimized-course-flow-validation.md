# QA-PLACE-COURSE-FLOW-01 — 장소 상세·최적 코스 단일 화면 검증

> 상태: **QA 수락 — 최종 자동 게이트·사용자 실기기 smoke 1회 통과**  
> 선행 결정: `DEC-PLACE-COURSE-FLOW-01` 최종 승인  
> 소유: QA·출시

## 작업 명령

"QA-PLACE-COURSE-FLOW-01을 진행해. 먼저 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/테스트.md`, `docs/03_product/UIUX_테스트명세.md`, `docs/work/integration-decision/place-detail-and-optimized-course-flow.md`, `docs/work/qa-release/README.md`와 이 작업 문서만 읽어. 이 작업은 제품 코드를 수정하는 작업이 아니라 승인된 완료 UI 시나리오가 코드와 fixture에서 재현되는지 판정하는 자동 게이트다.

UIUX가 구현 중이면 Phase A만 병렬 진행할 수 있다. 이때 새 `test/fixtures/place-course-flow.fixture.ts`와 `test/qa-place-course-flow.test.ts`의 입력·예상 receipt만 작성하고, `src/ui/`, 기존 `test/ui/*`, `App.tsx`, `nav.ts`, package script를 수정하지 마. UIUX 인수인계의 testID와 entry가 확정되기 전 source 문자열에 맞춘 임시 assertion으로 테스트를 통과시키지 마. 최종 판정과 기존 전체 게이트 실행은 `U-PLACE-COURSE-FLOW-01` 완료 후 수행해.

고정 fixture에는 1곳/2곳, 현재 위치=설정 출발지/다름/snapshot 없음, 설명·운영시간·사진 있음/없음, A→B 최적/B→A 최적/한 순서만 유효/둘 다 실패/동률 A 우선, 왕복/별도 목적지, handoff 성공/실패/중복, Home 재진입, 완료 저장 성공/already/failed를 포함해. 실제 Kakao/TourAPI/Route Proxy/Supabase를 호출하지 말고 권한·navigation·map marker·external opener·repository를 fake adapter로 주입해.

다음 receipt를 각각 독립 assertion으로 남겨.

PF-01: A0 카드 tap은 PlaceDetail만 열고 선택·pair begin·route·위치 권한 요청이 모두 0이다.
PF-02: current=origin, current≠origin, current 없음/GPS 실패에서 marker와 fallback이 규칙대로다. 상세 진입 새 권한 prompt는 항상 0이다.
PF-03: 설명·운영시간·사진·주소의 있음/없음이 사실 기반 문구와 fallback으로 표시되고 내부 activityEvidence나 추론 문구가 노출되지 않는다.
PF-04: 상세 닫기 뒤 place ID 순서·더보기·continuation·terminal state·scroll/focus가 동일하며 호출 증가가 0이다.
PF-05: 상세 명시 선택만 A0→A1을 만들고 빠른 연타에도 pair begin은 최대 1회다.
PF-06: B 상세는 current·A·B를 보이되 방문 번호·경로선이 0이고, 닫기는 A1 유지, 명시 선택은 A2이며 새 route는 0이다.
PF-07: A 삭제는 A0 snapshot을 0-call 복원하고 B 삭제는 A1·후보·ledger를 유지하며 취소 뒤 늦은 응답은 반영하지 않는다.
PF-08: A→B/B→A/한 방향/둘 다 실패/동률에서 엔진 exact snapshot의 최종 순서가 그대로 선택된다.
PF-09: 최종 지도 marker 번호·세로 카드·legs·Kakao sp/ep가 동일 최적 순서다. UI 재정렬과 새 route 계산은 0이다.
PF-10: `review→active`의 navigation stack 증가가 0이고 `courseRunId`·course/session snapshot이 동일하다. review에서는 길찾기·체류·완료 저장이 0이다.
PF-11: active의 현재 travel CTA만 활성이고 미래 travel은 disabled, 완료 travel은 완료 상태다. handoff 실패는 단계 유지, 성공만 단계 전이, 중복 tap은 opener 1회다.
PF-12: active 화면 이탈→Home 진행 카드→재진입이 같은 단계이고, 마지막 명시 완료가 completion을 정확히 1회 만들고 active를 제거한다.
PF-13: 상세 열기/닫기와 Kakao 장소 보기는 추천·pair·route·저장·권한 요청 0이다(장소 보기 external opener는 허용). 명시 A 선택은 PF-05의 pair begin 최대 1회와 기존 session 36 attempt ledger 안의 검증을 허용한다. B 선택·선택 삭제는 검증 결과/snapshot을 재사용한다. CourseConfirm 최초 진입은 COURSE-11/UXV-46의 필요한 endpoint walk connector 1곳 최대 4개·2곳 최대 6개만 허용하고 추천·transit·최적화 재계산은 0이다. 같은 코스 재렌더·review→active·재진입은 connector 결과를 재사용한다. 시작의 in-memory active 생성과 명시 완료의 repository 저장을 구분한다. 모든 자동 검증은 fake port로 실행하며 실제 네트워크·운영 DB 호출은 0이다.

PF-10/11에는 review→active 뒤에도 같은 ID·최적 순서의 세로 장소 카드와 지도/구간이 유지되고 현재 행동만 달라지는지 추가 검증한다. PF-02/03에는 작은 화면·큰 글씨·240자 설명·여러 줄 운영시간·위치 fallback/링크 오류를 넣어 sheet의 높이 제한·정보 스크롤·선택 CTA safe area·지도 padding의 일치를 검증한다. 카운터를 0으로 선언하고 끝내지 말고 production이 사용하는 controller/연결 entry에 fake port를 주입해 이벤트를 실행한다.

정정 이력(2026-09-05): 기존 PF-13의 모든 행동 0-call 요구 → PF-05의 명시 A 선택 및 COURSE-11의 connector 허용과 충돌 → 행동별 허용 호출로 분리 → 기존 엔진/API 예산을 바꾸지 않고 정확한 QA를 하기 위함 → 이전 일괄 0-call 문구 철회, 위 기준 현행. UIUX의 수락 전 보완 3개가 끝나기 전에는 최종 통과로 판정하지 않는다.

기존 `test/qa-two-stop-integration.test.ts`의 exact 비교·36회 예산·취소·stale·geometry, `test/ui/verified-course-progress.test.ts`의 handoff/진행, 카카오 장소 fallback, route geometry/endpoint walk, Home resume, runtime guard, 완료 기록 테스트는 재사용하고 중복 재작성하지 마. 과거 흐름을 강제하는 기존 UI 테스트의 교체는 UIUX 세션 소유이며 QA가 수정하지 않는다.

자동 판정은 새 집중 게이트, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `node --test test/map-transport-ui-contract.test.mjs`, `git diff --check` 순서로 실행한다. 실패하면 설정 문제인지 코드 결함인지 evidence를 분리하고 제품 코드를 직접 고치지 말고 소유 세션에 정확한 파일·재현 fixture·기대/실제 값을 반환한다.

자동 게이트가 모두 통과한 뒤에만 실기기 smoke 한 번을 요청해. 실기기에서는 `첫 카드→전체 지도 상세`, 새 권한 팝업 없음, current/후보 marker와 floating sheet, A 선택 후 같은 Results 복귀, B 상세와 2곳 선택, 최적 순서 지도·카드 일치, 같은 화면의 코스 시작, 현재 구간 Kakao 길찾기, 앱 복귀 후 같은 단계만 확인한다. 실기기에서 호출량·실패 조합·취소 조합을 반복하거나 시뮬레이터 버튼을 하나씩 순회하지 마.

완료 후 이 문서에 변경 파일, 보존한 정책/API/DB 경계, PF-01~13 pass/fail 표, 전체 테스트 수치, 마지막 실기기 확인 항목과 남은 출시 위험을 기록해. 중앙 기준 문서·제품 코드·데이터·엔진·API·DB를 수정하지 말고 커밋하지 마."

## 수락 기준

### 현행 복원 게이트 — 2026-09-05

이전 PF-13 정정 이력에 남은 `모든 코스 최대 4개` 해석은 철회한다. 현행은 1곳 최대 4개·2곳 최대 6개이며 상세 정보 B는 0회다. 기존 동시 2·in-flight/10분 메모리·TTL을 보존하고 캐시 유효 재진입과 TTL 만료를 구분한다. 두 곳 모두 transit인 세 legs fixture에서 5·6번째 성공 connector가 마지막 leg에 합성되는지도 검사한다. 단순 호출 카운트 교체로 완료하지 않는다.

체류 분은 review에서 각 stop snapshot 값으로 표시하고 active·Results·장소 상세 B에서는 숨긴다. short 20/recommended 35 fixture의 review 문구와 active 전환/재진입 비노출을 확인한다. 지도·카드 트리와 기존 보완 3항목은 유지한다. UIUX 문서 마지막 `현행 계약 복원` 완료 인계 전에는 최종 통과를 선언하지 않는다. 자동 검증은 실제 외부 호출 0, 실기기 smoke는 최종 자동 통과 뒤 한 번이다.

- PF-01~13 전부 통과
- 기존 exact pair·경로 geometry·Home resume·runtime guard·completion 회귀 통과
- 실제 외부 API/Supabase 호출 0인 자동 fixture
- 마지막 실기기 smoke 1회 외 Simulator 수동 순회 0

## 최종 자동 게이트 실행 기록 — 2026-09-05

### 1. 변경 파일과 목적

- 이 작업 문서만 갱신했다. 사용자가 U-PLACE-COURSE-FLOW-01의 현행 복원 통합 수락을 확인하여 Phase A를 반복하지 않고 최종 자동 게이트를 실행했다. 보드·역할 README의 이전 대기 표시는 직접 수정하지 않았다.
- 신규 fixture나 source 문자열 assertion을 추가하지 않고 기존 production 화면 실행 하네스와 엔진·어댑터·repository 회귀를 재사용했다.

### 2. 보존한 정책·API·DB 경계

- 제품 코드·기존 테스트·package script·중앙 기준·엔진·catalog·API·DB·환경변수를 수정하지 않았다. stage/commit/push, Simulator 수동 순회, 실기기 직접 조작은 0회다.
- review만 stop snapshot 체류를 표시하며 active·Results·장소 상세 B에서는 숨긴다. connector는 1곳 4개/2곳 6개, 동시 2, 기존 in-flight·10분 메모리·TTL을 유지한다. 추천 8회·pair session 36회 예산과 connector 예산은 별개다.
- 화면 실행 fixture는 fake navigation/location/opener/repository/Edge를 주입하고 fetch를 실패하도록 차단하며 매 테스트 뒤 실제 네트워크 시도 0을 검사한다. 실제 Kakao/TourAPI/Route Proxy/Supabase·운영 DB 호출은 0회다.

### 3. PF 판정과 자동 게이트 결과

아래 PASS는 자동 fixture 범위의 판정이다. `runtime`은 `test/ui/place-course-screen-runtime.test.mjs`, `detail`은 `test/ui/place-detail-and-optimized-course-flow.test.ts`, `TS`는 `test/qa-two-stop-integration.test.ts`를 뜻한다.

| 항목 | 판정 | 재사용한 실행 근거 |
| --- | --- | --- |
| PF-01 | PASS | runtime의 Results→PlaceDetail open/close: 카드 중복 tap도 상세 navigation 1, pair·route·권한 0 |
| PF-02 | PASS | detail current=origin/다름/없음 marker projection 및 runtime 위치 fallback·permission 금지 port |
| PF-03 | PASS | detail 원천 설명/운영시간/사진 fallback, runtime 240자 설명·여러 줄 시간·링크 오류·72개 화면/글꼴/정보 조합 |
| PF-04 | PASS | runtime 상세 닫기/native pop/focus의 기존 카드 유지, A 취소 시 ID 순서·scroll 720 복원; 기존 two-stop snapshot·continuation 회귀 병행 |
| PF-05 | PASS | runtime 선택 tap/focus 각각 중복 실행에도 pair begin 1회, stale request 거부 |
| PF-06 | PASS | detail current/A/B marker 의미 구분, runtime B 닫기 A1 유지·선택 A2·원본 pair/session 전달·추가 route 0 |
| PF-07 | PASS | runtime A/B 삭제와 취소 후 pending 응답 무시, TS-11/12 및 기존 exact 선택의 ledger·snapshot 복원 |
| PF-08 | PASS | TS-02/03/04/06과 release-two-stop-selection의 2-Z/2-Y: A 우세·B 우세·한 순서만 유효·둘 다 실패·동률 A 우선 |
| PF-09 | PASS | runtime B→A 지도 marker·사진·세로 카드 유지 및 opener endpoint 순서, card-detail/geometry의 legs·왕복·별도 목적지 projection |
| PF-10 | PASS | runtime 동일 CourseConfirm 시작 전후 호출은 start 1만 발생; 추가 stack 없음·지도/카드 유지·같은 run Home 복원; review 완료 저장 0 |
| PF-11 | PASS | detail current/future 행, runtime handoff 실패 유지·pending 중복 opener 차단·명시 이동 완료 뒤 전이·stale 응답 무시; verified-course-progress 회귀 |
| PF-12 | PASS | runtime 1곳/2곳 Home 재진입·마지막 명시 완료·실패/재시도, completion-history/repository의 created/already_completed 멱등과 active 제거 |
| PF-13 | PASS | runtime 행동별 금지 port, TS 36회 예산, connector 1곳4/2곳6·동시2·유효 캐시 재사용·TTL 만료·부분 실패·정확한 선만 합성 |

- 집중 통합 명령: `npx tsx --test test/ui/place-course-screen-runtime.test.mjs test/ui/place-detail-and-optimized-course-flow.test.ts test/ui/course-v1-route-geometry.test.ts test/ui/course-v1-card-detail.test.ts test/qa-two-stop-integration.test.ts test/qa-course-geometry-connector-integration.test.ts test/ui/verified-course-progress.test.ts test/ui/active-verified-course-resume.test.ts test/ui/runtime-course-auth-guard.test.ts test/ui/course-completion-history.test.ts test/course-completion-repository.test.ts` → **130/130 pass**, fail/skip 0.
- `npm run test:typecheck` → **통과**.
- `npm run test:ui` → **327 total / 326 pass / 0 fail / 의도 skip 1** (`철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다`).
- `npm test` → **135/135 pass**, fail/skip 0. 이 명령의 현행 discovery에는 화면 runtime 및 support 파일도 포함되므로 UI/집중 수와 합산해 고유 테스트 수로 표현하지 않는다.
- `node --test test/map-transport-ui-contract.test.mjs` → **14/14 pass**, fail/skip 0.
- `git diff --check` → **통과**.
- PF-08 추가 exact 근거: `npx tsx --test test/release-two-stop-selection.test.ts` → **35/35 pass**, fail/skip 0. 두 순서 모두 유효한 B 우세까지 기존 실행형 fixture로 확인했다.
- 현행 복원: short 20/recommended 35의 review 문구, active/Home 재진입 비노출, mode 누락 시 비노출 통과. transit 세 legs의 5·6번째 성공 connector가 마지막 leg 앞/뒤에 합성되고 마지막 endpoint가 목적지와 일치한다. 부분 실패는 해당 선만 제외한다. 유효 캐시에서는 추가 시도 0, TTL 만료 재진입 뒤 누적 시도는 1곳 8/2곳 12로 기존 정책을 유지한다. walk/intact/damaged 0, 단일 gap 1도 통과했다.
- 최초 실패 test 없음. 제품 결함 또는 설정 오류로 반환할 항목 없음.

### 4. 실기기 확인과 남은 출시 위험

- 최종 판정: **QA 수락 — 최종 자동 게이트 및 실기기 smoke 1회 통과**. 자동 통과 뒤 요청한 1~5단계에 사용자가 `정상확인했다`고 응답했다. 아래는 사용자 보고이며 QA 에이전트의 직접 기기 관찰은 아니다.
- 1단계 PASS: 첫 카드에서 전체 지도 상세가 열리고 새 위치 권한 팝업 없이 marker·하단 정보 sheet가 표시된다.
- 2단계 PASS: A 명시 선택 후 기존 Results로 복귀하고 B 상세에서 함께 선택한다.
- 3단계 PASS: 최종 코스 지도 번호와 세로 카드 순서가 일치하고 review에서 체류 분이 표시된다.
- 4단계 PASS: 같은 화면에서 코스를 시작하며 active에서 체류 분이 숨겨지고 현재 구간만 길찾기가 활성화된다.
- 5단계 PASS: 현재 구간 Kakao 길찾기 후 TimeFit으로 복귀해 같은 진행 상태가 유지된다.
- 별도 캡처·기기 모델·폰트 배율·장소명은 제공되지 않았다. 정상 보고를 모든 기기/큰 글씨 조합의 실측 증거로 확대하지 않는다. 72개 레이아웃 조합은 주입된 onLayout 치수 기반 자동 검증이며 Yoga 실측을 대체하지 않는다.
- 이 작업의 추가 수동 반복 확인과 실패 반환 항목은 없다. 후속 통합 세션은 본 수락 기록으로 중앙 보드 상태를 반영할 수 있다. 제품 코드·중앙 문서 수정과 stage/commit/push는 하지 않았다.
