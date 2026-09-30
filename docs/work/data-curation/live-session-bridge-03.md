# DATA-LIVE-SESSION-BRIDGE-03 — facade 결과의 데이터 projection 연결

상태: **데이터 bridge·집중 fixture 완료 / public controller 연결 대기**  
기준: `DATA-BUSAN-LIVE-PROJECTION-02-R1`, `API-LIVE-MULTISOURCE-SESSION-01`, `ENG-LIVE-MULTISOURCE-ORCHESTRATOR-03`  
작성일: 2026-09-22  
실제 API·배포·secret 사용: **0회**

## 결과

`src/data/liveSessionBridge.ts`에 service facade의 token-free 결과를 기존 데이터 projection 입력으로 바꾸는 순수 bridge를 추가했다.

- `buildApprovedLiveMultiSourceInput()`은 검토된 exact 연결만 facade 승인 입력으로 만든다.
- `projectLiveSessionInitial()`은 token-free Tour catalog를 369개 로컬 정책과 결합하고 부산 결과를 같은 snapshot으로 전달한다.
- `projectLiveSessionDetails()`은 detail 원문을 기존 Tour normalizer에만 넣고, 원문 값 없이 구조화 결과와 `ready/failed/missing/review` 진단만 반환한다.
- `mergeLiveTourSupplements()`는 진단용 누적 결과를 순서 독립적으로 정렬·동결하며 중복 또는 stale snapshot을 거절한다. 실제 세션 상태의 단일 소유자는 계속 추천 엔진이다.

Tour 불가 때 facade가 만든 fallback snapshot은 부산 요청 연속성에만 사용한다. 이 ID로 Tour catalog를 ready/partial로 합성하지 않으며 Tour projection은 `unavailable`, snapshot ID는 `null`로 남는다.

## 승인 입력 고정 수량

| 입력 | 허용 수 |
| --- | ---: |
| TourAPI exact `contentId + contentTypeId` | 139 |
| 부산 명소 exact ID | 85 |
| 부산 맛집 exact ID | 19 |
| 부산 쇼핑 exact ID | 29 |
| 부산 명소 verified 사진 | 85 |
| 부산 맛집 verified 사진 | 16 |
| 부산 쇼핑 verified 사진 | 0 |

사진은 `status=verified`, 서비스 페이지, `이용허락범위 제한 없음`, 상업·변경 허용, 확인일이 모두 있는 부산 evidence만 전달한다. `operator_approved`인 TourAPI 73개와 부산 쇼핑 29개는 권리 검증으로 승격하지 않고 live 승인 사진 입력에서 제외한다. 사진 부재로 장소나 source ID를 제외하지 않는다.

기준선은 런타임 369, 대표 191, 대표 분할 `TourAPI-only 82 / 부산-only 93 / 양쪽 16`으로 유지했다.

## public/UI controller의 정확한 helper 흐름

이번 데이터 작업은 controller를 수정하지 않았다. 후속 연결은 아래 순서를 그대로 사용해야 한다.

1. 세션마다 `buildApprovedLiveMultiSourceInput()`을 한 번 만들고 `facade.initialize(approved)`에 전달한다.
2. facade가 `active`를 반환하면 `projectLiveSessionInitial(initial)`을 호출한다. `rejected`면 엔진 세션을 만들지 않는다.
3. `accepted.sources`를 `createMultiSourceLiveSession({ sources, ... })`에 전달한다. UI가 facade 결과를 직접 조립하지 않는다.
4. 엔진의 `reserveDetails()`가 반환한 **원래 reservation 객체**를 `P`로 보관하고 그대로 `facade.loadDetails(P)`에 전달한다.
5. facade가 detail `accepted`를 반환하면 `projectLiveSessionDetails({ reservation: P, response, referenceDate })`를 호출한다. response 안의 복사된 reservation을 엔진에 넘기지 않는다.
6. bridge가 `accepted`이면 `engine.acceptDetails(P, result.supplements, { nextBatchMax: result.nextBatchMax })`를 호출한다. 이때 `P`는 4번의 동일 객체여야 한다.
7. `acceptDetails`가 `accepted`일 때만 `engine.evaluate()`하고, 다음 예약은 기존 stop reason에 따라 반복한다.
8. facade/bridge가 blocked 또는 rejected면 stale bundle·로컬 운영시간으로 보충하지 않고 typed 실패로 종료한다.

detail batch 자체가 provider `unavailable`이면 예약 전체를 `failed`, supplement 0개, `nextBatchMax=0`으로 settle한다. `active_detail_failed`는 failed, active인데 detail row가 없으면 missing, normalizer가 구조화하지 못하면 review다. opening/closed/event 원문 값과 provider body, token은 bridge 출력에 없다.

## 변경 이력

- **이전 방식:** facade는 token을 제거했지만 기존 Tour projector가 token 포함 adapter union을 직접 요구했고, detail batch를 supplement로 바꾸는 데이터 소유 경계가 없었다.
- **발생한 문제:** public controller가 token-free 응답을 임의 재조립하거나 fallback snapshot을 Tour 성공으로 오인하고, detail 원문을 엔진/UI까지 전달할 위험이 있었다.
- **교체한 방식:** projector 입력을 token-free 구조 타입으로 좁히고 승인 입력·초기 projection·detail 정규화 helper를 데이터 경계에 추가했다.
- **교체 이유:** facade/API 비밀과 원천 문자열을 data normalizer 안에 가두면서 기존 369/191 정책과 엔진 reservation identity 계약을 보존하기 위해서다.
- **상태:** 데이터 bridge 현행 구현 완료, public controller 연결 전.

## 변경 파일과 목적

- `src/data/liveSessionBridge.ts`: 승인 요청 builder, token-free 초기 projection, detail supplement 정규화, 결정적 누적 helper.
- `src/data/liveCatalogProjection.ts`: token이 필요 없는 catalog projection 입력 타입을 명시.
- `test/live-session-bridge.test.ts`: exact 수량, ready/partial/unavailable, fallback, detail 상태, 중복·snapshot, 원문/token 비노출, 결정성·동결 fixture.
- 이 문서와 데이터 역할 README: 후속 controller 흐름과 경계 인계.

## 변경하지 않은 공개 계약·정책 경계

service facade/API/Edge, 추천 엔진, UI/App, DB/migration, env/secret, 원본·processed JSON, 런타임 catalog를 수정하지 않았다. category/subCategory, 분류, 좌표, 운영시간·체류 정책, 사진 권리 상태를 바꾸지 않았다. 실제 API·Simulator·배포·commit·push도 실행하지 않았다.

## 검증

- bridge 단독 fixture — 7/7 통과.
- bridge와 catalog/opening/Busan projection/orchestrator/facade 집중 회귀 — 61/61 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 589/589 통과.
- `npm run test:ui` — 824개 중 823 통과, 기존 skip 1, 실패 0.
- `git diff --check` — 통과.

## 남은 위험과 결정 필요 사항

- public/UI controller는 아직 bridge와 facade를 호출하지 않는다. 실제 활성화는 통합 역할이 위 호출 순서와 기존 출시 게이트를 검토한 뒤 해야 한다.
- Tour detail normalizer의 provenance에는 어떤 입력 필드가 사용됐는지 필드명만 남는다. opening/closed/event 원문 값은 남지 않는다.
- 운영자 승인만 있고 서비스 단위 권리 검증이 없는 102개 사진은 live adapter 승인 입력이 아니다. 별도 권리 결정 없이 자동 승격하지 않는다.
- facade가 반환하는 reservation은 안전 복사본이므로 엔진의 객체 identity 검증에는 최초 `P`를 사용해야 한다.
