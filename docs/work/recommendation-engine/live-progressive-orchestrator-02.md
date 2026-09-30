# 2-LIVE-PROGRESSIVE-ORCHESTRATOR-02

2026-09-21. 부모: [마스터 계획 §3.3.1](../integration-decision/live-public-data-transition-master-plan.md), API: [progressive-03](../external-api/tourapi-live-progressive-03.md).
상태: **순수 queue/planner/transition 구현·fixture 검증 완료, public 미연결**.

## 변경 이력·목적

이전18 사전선정 → 번들 좌표가 수정되면 가까워진 장소가 탈락하고 첫18곳의 운영 실패를 보충하지 못함 → 최신 catalog 좌표로 전체 공간 순서를 만든 뒤 초기12·후속6·누적30 상세 예약 → 최신성과 상세 실패 보충을 제한된 예산 안에서 함께 보장 → **이전 제안 철회, 순수 구현 현행/운영 연결 전**.

## 변경 파일

- `src/engine/liveProgressiveOrchestrator.ts`: catalog→identity 검증→live 공간 queue, 순수 예약과 응답 수락, 상세 정책 gate, 누적 route 후보18 제한, 충분성 순수 판정.
- `src/engine/courseV1.ts`: 기존 공간 점수 함수 `candidateSpatialBurden`를 재사용할 수 있게 export. 기존 첫 결과 목표 숫자4를 `COURSE_V1_RELEASE_RESULT_TARGET`으로 추출해 동일 값으로 호출·slice. 기존 계산/route 예산 변경 없음.
- `test/live-progressive-orchestrator.test.ts`: 9개 fixture.
- 본 문서. `src/data/src/ui/src/services`, API handler/client, DB, 환경변수, 중앙 문서와 엔진 barrel 미수정. 앞선 snapshot/R1 파일은 재작성하지 않았다.

## 공개 순수 계약과 호출 순서

1. `beginLiveProgressive({local, catalog, origin, destination})`: 실제 `TourLiveCatalogResult`와 `LocalLivePlaceProjection`을 받는다. catalog active만 빈 opening의 합성 원천 사실로 기존 `buildLiveCandidateSnapshot` identity gate를 통과시킨다. 이때 빈 opening은 조회 전 상태이지 운영 검증 성공이 아니다. inactive/identity_conflict/review_required/미연결을 제외하고 대표 분류만 queue에 둔다.
2. queue는 **live lat/lon**에 기존 CourseV1 공간 부담 점수를 적용한다. 목적지 있음은 출발→후보→목적지, 없으면 왕복 점수. core 우선은 공간 동점만, 마지막 동점은 내부 ID 코드 순서. 상세 이전18 cap은 없다. 별도 반경을 발명하지 않았다. 공간 queue 진입/이탈 fixture는 최초12 예약 범위의 변화이며 catalog 전체에서 거리만으로 삭제하는 새 정책이 아니다.
3. `planLiveDetailBatch(state, sufficiency)`: 최초최대12, 후속최대6, 누적 고유 requested최대30 및 API nextBatchMax를 모두 준수한다. 반환 state에 예약을 먼저 반영한 뒤 dispatch해야 한다. pending 중 호출은 awaiting_batch이며 새 예약0. API를 실행하지 않는다.
4. 반환 `batch`는 `{liveSourceSnapshotId, candidates:[{contentId,contentTypeId}]}`만 담는다. 사용자 좌표·공간점수·키·budgetToken은 state/request에 넣지 않는다. API owner가 해당 예약에 최신 signed token을 붙인다.
5. `acceptLiveDetailBatch(state, response, openingGate, reservation)`: dispatch 당시 reservation을 필수로 받는다. 다른 snapshot/예약 불일치/누락·중복 상태/초과 또는 불일치 budget은 state 변경 없이 거절한다. settled 예약의 재응답은 성공/실패와 무관하게 무시한다. 다음 batch 전에 현 batch가 완결되어야 하므로 비동기 batch 순서 경합을 만들지 않는다. batch 안의 응답 배열 순서는 queue 순서로 정규화한다.
6. 상세 성공 ID만 catalog의 **같은 live 사실**과 합성한 뒤 기존 combiner에 전달한다. opening은 detail 응답에서만 사용하며 로컬 fallback0. detail_failed는 삭제와 구별해 제외한다.
7. 주입 `LiveOpeningGate(candidate)`가 live 운영 사실과 명시 시각·정책 입력으로 검증한 structured availability를 반환해야 route 후보가 된다. null/예외/needs_review는 opening_rejected. parser/운영시간 정책을 이 작업에서 새로 추정하지 않았다. 실제 gate 구현은 public 연결의 필수 선행 항목이다.
8. 누적 routeCandidates는 성공한 순서로 최대18, 중복 내부ID/동일단지는 추가하지 않는다. 뒤 batch가 앞서 예약된 route 후보를 몰래 교체하지 않는다. 이 배열은 `CourseV1RepresentativeCandidateProvider.listRepresentativeCandidates`에 주입 가능한 타입이다. sourceCandidates는 상세 성공 사실 목록으로, 운영 gate에서 탈락한 항목도 진단/검토용으로 남을 수 있으므로 routeCandidates와 혼동하지 않는다.

상태/예약/결과는 메모리 복사 후 깊게 동결한다. 이전 state를 두 번 dispatch하면 외부 부수효과까지 막아주는 전역 lock은 없으므로 public session 단일 writer가 반환 state를 먼저 commit해야 한다. pure callback인 openingGate는 동일 입력에 결정적이어야 한다.

## 충분성 입력과 route 예산

- `releaseResultSufficiency`는 CourseV1의 `resultState`, 대표 course ID, 대안 course ID를 입력받는다. 현재 public 첫 결과 목표4(대표1+대안최대3)를 **기존 코드와 같은 상수**로 읽고 distinct course가 충족됐을 때 sufficient. 새 목표 숫자를 추가하지 않았다.
- planner에 주입하는 상태: sufficient / insufficient / not_evaluated / route_budget_exhausted. 충분하면 다음 요청0, 미평가는 기다림, route 예산 소진이면 추가 상세0. 최초 catalog 뒤 상세 검증 시작은 insufficient로 주입한다. API nextBatchMax는 허용 상한이지 충분성 신호가 아니다.
- detail cap30 또는 queue 소진 뒤 여전히 insufficient면 `nextAction: empty_or_edit_inputs`. 이는 stale fallback을 허용하지 않는 종료 인계이며 이미 검증된 일부 course를 삭제하는 코드는 없다. **조건부 UI 결정:** 일부 정상 course가 있는데 목표4 미달인 경우의 안내/유지 문구와 명시 확장 흐름은 public 연결 시 확정해야 한다. 기존 “한 개도 정상 결과” 정책을 몰래 하드4 보장으로 바꾸지 않는다.
- route 검증 후보18과 route attempt8은 별개다. 테스트에서는 실제 `buildReleaseOneStopRepresentativeCourseV1`에 이 provider를 주입해 receipt8회, one-stop4 결과, 충분성 종료를 확인했다. 운영시간 상세12/6/30 호출 카운터는 route ledger를 초기화하지 않는다.
- **public 연결 주의:** batch마다 CourseV1 신규 builder를 새 예산으로 반복 실행하면 안 된다. 같은 세션 adapter/receipt cache/attempt ledger를 유지하는 incremental 연결이 필요하다. 기존 single8, pair16, 명시공유12/총36 계약을 변경하지 않았으며 자동8→16 보충도 추가하지 않았다.
- 이전 CourseV1의 최종17+wide1 lane 및 실제 운영시간/도착·체류 검사 자체는 그대로다. 새 점진 계층은 아직 public 전단이 아니며 live queue→누적18 선정이 기존 최종 선별과 결합되는 순서/동일단지 gate 시점은 통합 fixture에서 검토해야 한다.

## RED → GREEN / 검증

- RED: 새 모듈 전에 fixture 작성, 모듈 부재로 파일1 FAIL/PASS0.
- GREEN: live 좌표 이동(기존 번들 먼 좌표는 사전 cap에 사용하지 않음),12 조기종료,12+6,30 cap,route18,상세/운영 실패,중복 무과금,다른 snapshot,응답 순서,late unavailable,CourseV1 실8회,제외 상태,빈 queue까지 신규9개 통과.
- 첫 typecheck는 fixture의 이미 ready로 좁혀진 타입에 unavailable 비교를 넣은 오류1개였고 불필요한 비교를 제거했다. 제품 정책 변경 없음.
- 집중: `node --import tsx --test test/live-progressive-orchestrator.test.ts test/live-candidate-snapshot.test.ts test/release-one-stop-pagination.test.ts test/release-three-hour-engine.test.ts test/release-two-stop-selection.test.ts test/dwell-personalization-course.test.ts test/tourapi-live-progressive.test.ts` → **90/90 PASS**, skip0.
- `npm run test:typecheck` → PASS.
- `npm test` → **575/575 PASS**, skip0.
- `npm run test:ui` → **823 PASS/FAIL0/skip1**, 총824.
- `git diff --check` → PASS.

## 보존 경계 / 다음 인계

- AI-Hub는 identity 입력/queue 매칭에 사용하지 않는다. 기존 exact ID·최신 제목/좌표와 검토 별칭 gate만 재사용. min20/recommended30/일반max60/문화max120·category/subCategory 개인화·분류·사진권리·관계는 기존 projection 유지.
- 최대180분/최대2곳/도착여유·추천 결과 순위 정책·provider 예산 변경0. public UI/session/provider 연결0. API/HTTP/React/DB/환경 읽기0. API 타입은 type-only import.
- 데이터 담당: 실제 projection·source ID·검토 별칭·로컬 identity baseline의 정확성을 함께 검토. TourAPI-only 대표 축소 금지, 부산 live 이후 운영 전환.
- API 담당: 최신 token을 reservation에 외부 연결하고 응답 수락 성공 때만 다음 token으로 갱신. 폐기된 응답 token으로 되돌리지 않는다. token/signature와 실제 provider 과금은 API 소유이며 엔진 requested는 보수적 예약 카운터다.
- UI/통합: single writer·취소/새 snapshot·응답 예약 바인딩·route ledger 유지·충분성 최신값 주입·부분 정상 결과 문구·deadline/background 수명·운영 gate 구현을 완료해야 한다. 새 세션/명시 retry와 기존 snapshot 재사용을 혼동하지 않는다.
- 외부 호출·운영 배포·DB 변경·commit/push 없음. master 체크박스와 중앙 문서는 수정하지 않았다. 순수 구현 수락과 운영 완료는 구분한다.
