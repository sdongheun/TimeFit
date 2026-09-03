# DEC-MULTISTOP-RECEIPT-OBS-01 — 다장소 receipt 안전 원인 관찰 계약

## 결정

`QA-SHAPE-01`은 2곳 후보 153개와 실제 1회 시도 뒤 `route_verification_unavailable`로 중단됨을 확인했다. `API-MULTISTOP-RECEIPT-01`은 이미 끝난 요청의 Edge 상태를 안전하게 연결할 로그 창이 없어 원인을 특정하지 못했다.

다음 한 번의 internal QA에서만 `unavailable`의 **안전 typed reason**을 코스 형태별 집계로 보존한다. 이 계약은 추천 규칙, API 한도, 장소 분류, 일반 사용자 UI를 바꾸지 않는다.

## 허용 값과 금지 값

`unavailable`에만 아래 enum 하나를 허용한다.

`limited | in_flight | store | provider | transport | invalid_response | rejected | unknown`

- 허용: 위 enum의 형태별 건수, 새 provider attempt·adapter 호출·재사용의 기존 합계
- 금지: 장소명/ID, 좌표, 주소, URL/query, API 응답 원문, cache key, JWT/token, 사용자 ID, 카카오 키
- `exact`·`no_route`에는 reason을 붙이지 않는다. 잘못된/누락된 reason은 `unknown`으로 fail-closed 한다.

## 순서와 소유 경계

1. **추천 엔진 2-T:** `CourseV1RouteReceipt`의 안전 reason 타입·정규화와 `shapeDiagnostics`의 형태별 reason 건수만 추가한다. API/UI는 수정하지 않는다.
2. 통합 수락 뒤 **외부 API:** 이미 존재하는 Route Proxy receipt reason을 위 타입으로 매핑한다. Edge 상태·한도·배포는 바꾸지 않는다.
3. 통합 수락 뒤 **UIUX:** exact internal diagnostics panel에만 reason 건수를 표시한다.
4. 새 A8 internal build에서 QA가 서면 복귀·사상→서면을 각 한 번만 실행한다. 그 결과로 API/engine 중 한 경계를 지정한다.

각 단계는 앞 단계 수락 전 시작하지 않는다. 로그가 없는 과거 요청을 다시 추정하거나, B12·호출 상한·장소 수를 바꾸지 않는다.
