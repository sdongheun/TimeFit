# API-LIVE-MULTISOURCE-SESSION-01 — TourAPI/부산 live source 세션 facade

2026-09-22. TourAPI catalog/detail과 부산 live snapshot의 수명·snapshot 결합·호출 예산을 외부 API 계층의 한 메모리 객체가 소유하도록 구현했다.

상태: **service facade 및 고정 fixture 완료 / 데이터 projection·추천 엔진·public UI 연결 전**. 실제 공급자 호출, Edge 배포, 환경·secret 변경은 하지 않았다.

## 변경 파일 / 변경 목적

| 파일 | 목적 |
| --- | --- |
| `src/services/liveMultiSourceSessionFacade.ts` | Tour catalog 1회 → 동일 snapshot의 Busan snapshot 1회 → 엔진 reservation 기반 Tour detail batch를 한 수명 안에서 조정한다. budget token은 closure에만 두고 반환 타입에서는 제거한다. |
| `test/live-multisource-session-facade.test.ts` | ready/partial/unavailable 조합, 동일 snapshot, 승인 입력 exact 전달, 12→6→6→6·누적30, stale/중복/미승인 사전 차단, close/cancel, 결정적 복사, 손상 입력을 검증한다. |
| `test/live-multisource-session-facade-safety.test.mjs` | persistence·로그·좌표·raw payload·retry port 부재와 App/UI 미연결을 정적 검증한다. |
| 본 문서 | 유지 계약, 검증 결과, 다음 연결 순서와 위험을 인계한다. |

## 구현 계약

`createLiveMultiSourceSessionFacade({ tour, busan, idFactory })`는 명시적인 추천 세션마다 한 번 생성한다. `initialize()`는 승인 Tour ref와 부산 source ID·사진 근거를 복사·정렬·검증한 뒤 다음 순서만 수행한다.

1. Tour catalog를 정확히 한 번 호출한다.
2. Tour가 ready/partial이면 그 `liveSourceSnapshotId`를 Busan 요청에 그대로 사용한다. Tour가 unavailable이면 주입된 `idFactory`의 안전한 opaque ID를 한 번 생성해 Busan만 계속할 수 있다.
3. Busan에는 호출자가 승인한 source ID와 사진 근거만 전달하며 위치·검색어를 받거나 합성하지 않는다.
4. 반환값은 token을 제거한 typed Tour catalog 상태, 원래 typed Busan adapter 상태, snapshot context와 안전 집계뿐이다. service 계층은 장소 projection이나 추천 판단을 하지 않는다.

`loadDetails(reservation)`은 엔진 `LiveMultiSourceReservation`의 같은 snapshot·연속 sequence·서로 다른 place/ref·catalog active exact ref만 허용한다. 첫 batch 최대12, 이후 최대6, 세션 누적30을 provider 호출 전에 검사한다. catalog가 발급한 budget token은 facade closure에 보관하고 정상 detail 응답 token으로만 교체한다. stale/different snapshot, catalog 미승인, 중복, 재사용 reservation은 provider 호출0으로 차단한다.

adapter가 unavailable을 반환하거나 throw하면 안전 unavailable 상태만 반환하고 해당 세션의 detail 경계를 종료한다. 자동 retry는0이다. `close()`와 `cancel()`은 terminal이며, 초기 catalog 응답을 기다리는 동안 취소되면 Busan 요청도 시작하지 않는다. 명시 재시도는 기존 handle의 adapter retry가 아니라 새 facade와 새 엔진 세션으로만 시작해야 한다.

## 유지한 계약

- TourAPI의 catalog 최대2페이지, detail 12→6·누적30 및 예약된 common4/image1 상한과 Busan 원천별 최대2페이지·snapshot 최대6 provider calls를 확대하지 않았다. facade는 기존 adapter 포트 한 인스턴스를 세션 전체에서 재사용한다.
- exact 승인 ID·사진 근거, `ready/partial/unavailable`, identity conflict, 안전 enum 계약을 유지했다. 실패를 로컬 facts나 다른 원천 성공으로 합성하지 않는다.
- engine reservation을 다시 계산하지 않고 동일 객체를 결과에 돌려준다. 추천 충분성·순위·route 예산·부분 결과 판단은 엔진 소유다.
- token·키·좌표·검색어·원문 응답·payload·이메일을 반환, 로그, DB, 파일, cache, trace에 저장하지 않는다. snapshot ID와 safe counts만 관찰 가능하다.
- 데이터/엔진/UI/App/DB/env/secret/Edge handler, 중앙 문서와 보드를 수정하지 않았다. 실제 네트워크·배포·commit/push 없음.

## 테스트 결과

- facade 집중 테스트: **10/10 PASS**.
- 안전·public 미연결 정적 테스트: **2/2 PASS**.
- 엔진 조정기와 facade 결합 계약: **29/29 PASS** (`17 engine + 10 facade + 2 safety`).
- `npm run test:typecheck`: **PASS**.
- `npm test`: **589/589 PASS**, fail0, skip0.
- `npm run test:ui`: tsx IPC가 sandbox에서 `EPERM`으로 시작 전 실패. 같은 UI glob을 `node --import tsx --test`로 실행해 **824건 중 823 PASS / fail0 / 기존 skip1**. 원래 npm 명령 성공으로 기록하지 않는다.
- `git diff --check` 및 신규 파일 trailing whitespace 검사: **PASS**.
- 실제 공급자 호출0, 원격 변경0, public 연결0.

## 다음 결정·위험

1. 통합 소유자는 `initialize()`의 token-free `tourCatalog`를 데이터 소유 projection 입력으로 변환하고 `busan`과 함께 `createMultiSourceLiveSession`에 전달해야 한다. 현재 데이터 projector는 adapter의 token 포함 타입을 직접 받으므로, token을 UI/엔진에 노출하지 않는 token-free 변환 경계를 데이터 소유 경로에서 확정해야 한다.
2. 엔진 `reserveDetails()`가 반환한 객체를 그대로 `loadDetails()`에 전달하고, 반환된 동일 `reservation`과 데이터 normalizer가 만든 supplement만 `acceptDetails()`에 전달한다. `batch.budget.nextBatchMax`도 엔진에 전달한다. service 반환값을 UI가 직접 조립하거나 adapter retry API를 섞지 않는다.
3. Tour unavailable의 fallback snapshot은 Busan 세션을 묶기 위한 opaque ID일 뿐 Tour 성공 근거가 아니다. 엔진/data projection에서 Tour unavailable을 유지해야 한다.
4. 공개 연결 전 background/foreground에서 기존 facade를 재사용할지 새 명시 세션으로 종료할지, 통합 controller가 close/cancel을 언제 호출할지 정해야 한다. 어떤 선택도 동일 handle 자동 재시도나 batch별 facade 재생성으로 예산을 초기화해서는 안 된다.
5. public UI는 현재 미연결이다. 실제 공급자 지연·운영 한도·Edge 배포·실기기 결과를 이번 fixture 완료로 간주하지 않는다.
