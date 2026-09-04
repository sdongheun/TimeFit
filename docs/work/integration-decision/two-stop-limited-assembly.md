# DEC-TWO-STOP-SELECTION-01 — 검증된 한 곳에서 시작하는 최대 2곳 제한 조립

## 상태와 활성화 경계

- **제품 결정:** 확정
- **구현 상태:** 엔진·API 정확성 수락 / `U-TWO-STOP-03` 사용자 실사용 반환
- **일반 사용자 활성화:** 동일 Results 트리 보존과 B 첫 결과 지연 보완, 원격 Edge 단일 배포와 출시 후보 실기기 2건 전까지 보류
- **현행 fallback:** 기존 실제 검증 one-stop 결과·상세·진행 흐름

2026-09-03 통합 검토에서 `2-Y`의 pair-only 엔진, `API-TWO-STOP-02`의 cache-only·provider attempt 비환불 계약, `U-TWO-STOP-01`의 표시·상태·session reuse와 `QA-TWO-STOP-01` 17/17을 수락했다. 이어 `U-TWO-STOP-02`가 Results/CourseConfirm production session을 연결했고, secondary 표시와 intent 기록을 동일한 allowlist identity predicate로 통일한 보완까지 독립 회귀에서 통과했다. 따라서 로컬 production 코드는 최대 2곳 선택 흐름을 갖춘 상태다. 다만 원격 Edge는 아직 미배포이고 출시 후보 실기기 확인도 없으므로 운영 활성화 완료로 해석하지 않는다.

이 결정은 과거 자유 장바구니나 1~3곳 자동 조립을 복구하지 않는다. 사용자가 실제 검증된 한 곳 A를 고른 뒤, 그 장소와 함께 시간 안에 갈 수 있음이 다시 검증된 B 중 하나를 추가하는 **최대 2곳 제한 조립**이다. 3곳, 순서 편집, 검증 전 후보 담기, 조건부 장소 자동 승격은 범위 밖이다.

2026-09-04 UX 결정: `U-TWO-STOP-02`의 `카드 → one-stop 상세 → 한 곳 더 고르기 → Results 복귀` 진입은 기능 검증용 이전 방식으로 남기고 production UX에서는 교체한다. 새 방식은 Results의 카드 tap으로 A를 선택하고, 상단 sticky tray와 하단 fixed CTA를 나타내며, 같은 화면에서 B를 고른 뒤 CTA에서만 1곳/2곳 CourseConfirm을 연다. A/B를 위에서 아래로 표시해도 방문 순서를 뜻하지 않으며 실제 순서는 CourseConfirm에서 engine snapshot으로 보여 준다. 원격 Edge는 이 UI 자동 회귀 뒤 한 번만 배포한다.

2026-09-04 자동 재검증에서는 `U-TWO-STOP-03`의 카드 tap navigation 0, 즉시 A 선택, exact B 선택·교체·개별 취소, A snapshot 복원, 상단 tray·하단 CTA, CourseConfirm 과거 secondary 제거와 전체 회귀가 통과했다. 그러나 이후 사용자 실사용에서 A 선택 시 `ResultsScreen`이 선택 전 ScrollView를 유지하지 않고 별도 조건부 return으로 전체 본문을 교체해 페이지 전환처럼 보이며, 첫 B가 나타나기까지 대기가 길다는 문제가 확인됐다. 따라서 자동 수락을 최종 UX 수락으로 해석한 판단을 철회한다. 원격 배포 전에 같은 Results 트리 보존과 B 첫 결과 latency를 보완한다.

2026-09-04 사용자 후속 결정: A 선택 뒤 기존 one-stop 카드를 계속 남기는 방식은 선택 역할을 혼동시키므로 채택하지 않는다. 같은 Results/ScrollView/헤더/시간 요약을 유지하되, **기존 one-stop 목록이 있던 같은 영역만 B 후보와 검증 중 skeleton으로 교체**한다. A 취소 시 저장한 snapshot과 scroll로 그 영역을 원래 one-stop 목록으로 되돌린다.

## 이전 방식 → 관찰 → 교체 방식 → 이유

| 이전 방식 | 문제·관찰 | 교체 방식 | 이유 | 상태 |
| --- | --- | --- | --- | --- |
| 출시 결과는 one-stop 대표와 대안만 제공 | 정확성과 출시 안정성은 확보했지만 시간이 충분해도 사용자가 두 장소를 연결해 선택할 수 없다 | 검증 one-stop A를 사용자가 명시 선택하면 exact 2곳 후보를 별도로 만든다 | 자동 pair를 처음부터 전부 계산하지 않으면서 사용자 의도가 있을 때만 추가 비용을 쓴다 | one-stop fallback 유지, 새 흐름 구현 전 |
| 과거 1~3곳 mixed queue와 자유 장바구니 | 3곳·순서 편집·중복 코스·public store 실패가 한 경로에 섞였다 | 최대 2곳, 순서 엔진 결정, 별도 pair-only entry | 상태와 실패 범위를 제한한다 | 과거 방식 철회 유지 |
| 첫 장소 취소 시 재계산 가능성이 있음 | 목록이 바뀌고 API가 다시 호출되며 늦은 응답이 다른 선택에 섞일 수 있다 | 선택 직전 화면 snapshot을 메모리에 보존하고 호출 없이 복원한다 | 사용자가 안심하고 비교할 수 있고 호출 상한을 우회하지 않는다 | 확정 |

## 사용자 흐름

1. 기존 release one-stop entry가 실제 경로·구조화 운영시간·최소 20분·도착 여유를 통과한 장소를 보여 준다. 최대 입력은 현행과 같이 현재 시각부터 120분이다.
2. 전체 카드 tap은 상세로 이동하지 않고 해당 exact one-stop을 **선택한 기준 장소 A**로 확정한다. Results 상단 sticky tray에 A를 고정하고, 선택 후에만 하단 fixed CTA `이 장소로 코스 보기`를 표시한다.
3. A는 선택 순서일 뿐 반드시 첫 방문 장소라는 뜻은 아니다. 화면은 A를 고정해 보여 주고 `A와 함께 갈 수 있는 장소 확인 중` 상태로 전환한다.
4. 엔진은 A를 제외한 representative 후보를 로컬 prefilter한 뒤 B마다 두 순서 `origin→A→B→target`과 `origin→B→A→target`을 모두 exact 검증한다.
5. 세 leg, A/B의 도착별 운영시간, 두 장소 최소 체류, 최종 도착 여유를 모두 통과한 B만 표시한다. 두 순서가 모두 유효하면 세 leg 총 이동시간이 짧은 순서를 채택하고, 동률이면 사용자가 먼저 고른 A를 앞에 둔다.
6. exact 성공 B는 검증 완료 순서로 점진 표시하며 이미 보인 카드의 순서를 뒤에서 바꾸지 않는다. 기본 목표는 3개지만 0~2개만 성공하면 부풀리지 않고 이유를 함께 보인다.
7. 사용자가 B 카드를 고르면 이미 exact 검증된 두 장소 snapshot을 같은 Results 화면에서 선택하고 CTA를 `선택한 2곳 코스 보기`로 바꾼다. B 선택은 navigation·route 0이며 CTA를 눌렀을 때만 해당 snapshot의 코스 상세를 연다.
8. 두 번째 후보 `더 보기`는 다음 미검증 cursor부터 이어서 확인하며 누적 최대 6개까지만 표시한다.
9. A 선택을 취소하면 A를 고르기 직전의 one-stop place ID·순서·이미 연 더보기·continuation·완료/부족 상태·스크롤 위치를 새 호출 없이 그대로 복원한다.

## 호출 예산과 기존 one-stop 더보기의 충돌 해소

한 recommendation session의 신규 route provider attempt 총상한은 **36회**다.

| 예산 구간 | 상한 | 사용 조건 |
| --- | ---: | --- |
| 최초 one-stop 검증 | 8 | 최초 결과 생성에만 사용 |
| A 선택 뒤 자동 2곳 검증 | 16 | 사용자가 Results의 실제 표시 one-stop 카드를 선택한 뒤 한 번 열리는 보호 예산 |
| 명시적 확장 공유 예산 | 12 | A 선택 전 기존 one-stop `다른 장소 더 보기`와 A 선택 후 두 번째 후보 `더 보기`가 함께 사용 |

- 기존 one-stop 결과와 페이지 계약은 A를 선택하기 전까지 그대로다. 새 제한 조립 session에서는 첫 장소 목록 더보기가 공유 12회를 소비한다.
- 첫 장소 목록에서 8회를 더 썼다면 두 번째 후보 더보기에는 신규 attempt 최대 4회만 남는다. cache/session hit 결과는 새 attempt가 아니므로 남은 예산과 무관하게 재사용할 수 있다.
- 공유 예산이 소진되면 더보기를 반복 호출하지 않고 현재 검증 결과와 `이번 추천에서 추가로 확인할 수 있는 횟수를 모두 사용했어요`를 표시한다.
- A 선택 취소·재선택은 어느 예산도 초기화하거나 환불하지 않는다. 이미 provider에서 시작한 요청은 취소 신호 성공 여부와 무관하게 실제 사용량으로 센다.
- 선택 단계의 후보별 live 장소 API는 0회다. representative runtime catalog와 유효한 metadata만 사용한다.
- 추천 route 36회 밖에는 선택한 2곳 코스 상세의 geometry endpoint connector를 최대 6회 예약한다. 따라서 새 외부 provider attempt의 이론 총상한은 42회다. Auth·cache/RPC·adapter call과 provider attempt는 별도 계측한다.

## 캐시·개인정보·continuation

- public route는 현행 서버의 방향·수단·공개 장소 ID cache와 짧은 TTL(기본 15분)을 재사용한다.
- private endpoint와 상세 connector는 프로세스 메모리·현행 10분 TTL만 사용하며 정밀 좌표를 DB·로그·공개 continuation에 넣지 않는다.
- 시간·출발지·목적지·체류·도착 여유에 종속된 `A와 B가 함께 가능` 판정 전체를 수 시간~하루 저장하지 않는다.
- 공개 continuation에는 version, 선택 A/B 후보 ID, cursor, 후보/검증 signature, provider attempt ledger, opaque receipt key와 typed 종료 이유만 둔다. 좌표·사용자 ID·API key·provider 객체·함수·비직렬 runtime context를 넣지 않는다.
- 이어보기 호출은 기존 입력과 provider/route port를 앱 화면 메모리에서 다시 전달하고, 엔진은 공개 ID를 현재 provider에서 재수화한다. 서버에 추천 세션·후보 큐를 저장하지 않는다.

## 선택 취소·stale 응답 상태 기계

| 상태 | 사용자 행동 | 다음 상태 | 새 provider attempt |
| --- | --- | --- | ---: |
| `one_stop_list` | 실제 표시 one-stop 카드 A 선택 | `second_candidates_loading(A, epoch)` | 최대 남은 자동 예산 |
| `second_candidates_loading/ready` | A 취소 | 저장한 `one_stop_list` snapshot | 0 |
| `second_candidates_loading/ready` | 다른 A 선택 | 새 `epoch`, 남은 공통 예산으로 새 branch | 남은 예산 안에서만 |
| `second_candidates_ready` | B 선택 | 같은 화면의 `pair_selected(A,B)` | 0 |
| `second_candidates_loading/ready` | A only CTA | exact one-stop CourseConfirm | 0 |
| `pair_selected(A,B)` | 2곳 CTA | exact 2곳 CourseConfirm | 0 |
| `pair_selected(A,B)` | B만 취소 | `second_candidates_ready(A)` | 0 |
| 어느 상태든 핵심 입력 변경 | 새 추천 | 새 recommendation session | 새 예산 |

- 모든 진행 이벤트와 최종 응답에는 `selectedFirstPlaceId + requestId(epoch)`를 대응시킨다. 현재 값과 다른 늦은 응답은 UI 목록·continuation·오류에 합치지 않는다.
- 같은 A를 다시 고르면 현재 session에 남은 exact 결과와 route cache를 우선 복원한다. 결과를 재사용해도 이미 쓴 attempt를 환불하지 않는다.
- 두 번째 후보가 0개거나 terminal failure가 발생해도 A의 검증 one-stop은 유지한다. 미검증 B, 조건부 후보, 근사 route로 채우지 않는다.

## 역할별 단일 작성자와 병렬화

### Wave 1 — 즉시 병렬

- `2-Y` 추천 엔진: `src/engine/types.ts`, `src/engine/index.ts`, pair-only 검증·continuation·누적 ledger의 단일 작성자
- `API-TWO-STOP-01` 외부 API: 기존 adapter/receipt/cache가 3-leg·36회·reuse·typed failure를 보존하는지 계약 보완. 엔진 정책과 UI는 수정 금지
- `U-TWO-STOP-01` UIUX: `src/ui/`, `App.tsx`, navigation의 단일 작성자. 문서의 구조적 port를 기준으로 view state와 fixture를 먼저 구현하고, 2-Y export가 생기면 같은 작업 안에서 연결
- `QA-TWO-STOP-01` QA: 새 QA 전용 fixture/통합 테스트 파일만 작성. 기존 엔진·UI·API 테스트 파일은 수정하지 않고 실제 API·Simulator는 사용하지 않음

### Wave 2 — 한 번의 통합 게이트

네 작업을 합친 뒤에만 typecheck, 역할별 자동 테스트, 전체 회귀를 한 번 실행한다. 필수 자동 게이트가 모두 통과하면 일반 사용자 진입점 활성화를 결정한다. 실기기는 활성화 후보 build에서 대표 왕복 1건과 별도 목적지 1건만 사용자에게 요청하며, 자동 fixture로 확인 가능한 화면을 반복 조작하지 않는다.

## 활성화 합격 기준

1. one-stop production 회귀가 그대로 통과한다.
2. A 선택 뒤 exact B가 점진 표시되고, B 선택은 추가 route·navigation 0회로 화면 상태만 바꾼다. 선택 후 fixed CTA에서만 1곳/2곳 상세를 연다.
3. 두 순서 비교·동률 A 우선·운영시간·20분 체류·도착 여유가 고정 fixture로 재현된다.
4. 기본 목표 3, 누적 최대 6, 총 신규 route attempt 36, 상세 connector 최대 6을 초과하지 않는다.
5. A 취소가 원래 목록·순서·더보기·스크롤을 복원하고 stale 응답을 무시한다.
6. 주변 후보 없음, 시간 불충족, 경로 없음, provider/store/한도 실패를 가능한 범위에서 구분하고 A one-stop을 유지한다.
7. continuation과 로그에 정밀 좌표·사용자 ID·API key·raw provider 오류가 없다.
8. 실제 public A↔B leg가 store 실패 없이 적어도 하나의 고정 통합 경계에서 exact 또는 typed no-route로 종결된다. store unavailable이면 일반 사용자 활성화만 보류하고 one-stop fallback을 유지한다.

## 이번 결정에서 바꾸지 않는 것

- 최대 입력 120분, 도착 여유, 최소 20분과 권장/short 정책
- representative 191개와 조건부 시장·거리 분리
- Kakao 단일 route provider, ODsay/TMAP fallback 0
- 선택 후 CTA로 여는 one-stop/pair 상세, 카카오맵 확인·길찾기, 진행 화면
- 자유 장바구니, 3곳, 순서 수동 편집, 자동 GPS 체류, Live Activity, 코스 DB 저장
- 사용자가 요청하기 전 commit·push 금지

## 2026-09-04 U-TWO-STOP-03 통합 검토

- **판정:** 자동 수락. 첫 인라인 구현의 별도 selected tree와 두 번째 ScrollView는 제거됐고, 동일 Results/ScrollView 안에서 one-stop region만 pair loading/results/terminal로 교체된다.
- **확인한 계약:** A tap 직후 tray와 A-only fixed CTA가 pair 완료를 기다리지 않고 나타난다. exact B만 선택 가능하며 B 선택은 route·navigation 0이다. A 취소는 one-stop 목록·더보기 상태·scroll snapshot을 복원한다. 표시 완료 one-stop seed는 A branch별로 동결돼 2-Z begin/continue/reuse에 전달되고 navigation·continuation·DB에는 들어가지 않는다.
- **독립 검증:** `two-stop-selection` 25/25, `two-stop-production-session` 7/7, one-stop more 8/8, QA 통합 17/17, UI 237 통과·기존 skip 1, core 117/117, typecheck와 `git diff --check` 통과.
- **남은 활성화 확인:** 실제 작은 iPhone에서 중간/마지막 one-stop 카드 선택 시 동일 화면으로 인식되는지, 즉시 맨 위 region 이동이 과도하지 않은지, A 취소가 원래 스크롤로 복귀하는지, fixed CTA가 마지막 B를 가리지 않는지만 출시 후보 smoke 한 번에 확인한다. 이 수동 확인은 자동 수락을 되돌리거나 같은 구현을 반복하는 사유가 아니다.

## 2026-09-04 exact pair 역선택 보완 결정

- **관찰:** 같은 입력에서 `포셋 전포`를 A로 골랐을 때 `롯데백화점 부산본점`이 exact B로 보였지만, 취소 후 롯데를 A로 고르면 포셋이 보이지 않았다.
- **판단:** 두 방문 순서는 엔진이 이미 모두 비교하므로 장소 간 물리적 가능성이 선택 방향에 따라 바뀐 것은 아니다. 현재 A별 reuse namespace, 첫 exact 3개 중단, session 비환불 예산과 후보 순서 때문에 반대 branch가 이미 검증한 pair snapshot을 직접 받지 못하는 비대칭이다.
- **확정:** 같은 recommendation session·동일 입력에서 완료된 exact `{A,B}`만 순서 없는 runtime pair로 보관한다. 반대 A를 선택하면 기존 snapshot의 실제 방문 순서와 legs를 그대로 유지해 신규 adapter/provider attempt 0회로 상대 장소를 우선 반환한다. initial 3·누적 6에는 한 후보로 계산하고 남은 자리만 남은 예산으로 검증한다.
- **범위 제한:** 새 session 또는 시각·출발/도착·남은 시간·provider/catalog signature가 달라진 경우에는 재사용하지 않는다. 어느 방향에서도 검증하지 않은 pair를 모든 새 세션의 첫 3개에 보장하지 않으며, 후보 pool·호출 상한·3곳·자유 장바구니로 범위를 확대하지 않는다.
- **실행 순서:** 추천 엔진 `2-AA`가 failure-first fixture와 pair seed 계약을 만든 뒤 UIUX `U-TWO-STOP-04`가 session runtime store를 연결하고, 마지막에 `QA-TWO-STOP-02`가 실제 API·Simulator 없이 production entry의 역선택 0-call을 검증했다. 세 작업은 export 의존성에 따라 순차 완료됐다.
- **2-AA 통합 판정:** 수락. 구현 전 역선택 1건이 신규 adapter 호출로 실패하는 것을 재현했고, 구현 후 전용 35/35, one-stop 회귀 11/11, 전체 core 117/117, typecheck와 diff check가 통과했다. 실제 사용자 화면 연결은 아래 `U-TWO-STOP-04`에서 완료했다.
- **U-TWO-STOP-04 통합 판정:** 수락. 정상 exact 완료의 session token·unordered store·branch frozen seed와 역선택 첫 후보 0-call을 production 연결했다. 수락 전 발견한 두 문제는 같은 작업에서 보완했다. `onCompletedExact`와 same-A reuse는 공통 predicate로 provider/store/continuation terminal partial을 저장하지 않고, attempt-limit에 도달했어도 이미 검증된 exact partial은 재사용한다. B 카드는 `(pair 이동+체류) - (A one-stop 이동+체류)`를 사용해 51→88분 fixture에서 `함께 가면 약 37분 추가`로 표시하고, CourseConfirm은 원 pair 전체 88분·순서·legs를 유지한다. 추가 route 호출은 0이다. 독립 재검증 결과 집중 97/97, UI 242 통과·기존 skip 1, core 117/117, typecheck·diff check가 통과했다.
- **QA-TWO-STOP-02 통합 판정:** 수락. 새 fixture를 중복 작성하지 않고 기존 failure-first 엔진·production session·표시 계약을 하나의 게이트로 재실행했다. 동일 세션 역선택 adapter/provider 0-call, 원 snapshot 순서, terminal partial callback/store/reverse seed 0, attempt-limit exact partial 저장 1, 새 session/input 비재사용, initial 3·누적 6과 16/12/36 예산, 51→88분의 37분 추가 표시를 확인했다. 독립 결과는 전용 17/17·엔진 35/35·집중 UI 37/37·전체 UI 242 통과(기존 skip 1)·core 117/117·typecheck·diff check 통과다. 실제 API·Simulator는 범위 밖이며 작은 iPhone의 카드·고정 CTA·취소 복원 체감만 출시 후보 smoke에 남긴다.
