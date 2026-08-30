# RD-B12 — internal B12 실기기 비교 게이트

## 선행 조건

`2-N`, `U-1-REC-02` 수락 뒤 만든 새 internal build만 사용한다. B12는 여전히 production 전환 후보가 아니다.

## 정확히 두 번 실행

| ID | 입력 | A8 기준 관찰 | 기록 |
| --- | --- | --- | --- |
| RD-B12-01 | 서면역 부산1호선, 복귀, 개발 테스트 15:00→17:00, 여유 10분 | 엔진/화면 3/3, N1 3개 검증 | policy label, 엔진/화면 코스, N1/N2/W/T 수치, 새 경로·adapter·재사용, 안전성 |
| RD-B12-02 | 사상역 2호선→서면역 2호선, 개발 테스트 15:00→17:00, 여유 10분 | 엔진/화면 2/2, N1 2개 뒤 8회 소진, N2 0 시도 | 위와 동일, 특히 N2 시도와 1·2곳 결과 |

각 입력은 `이 시간에 할 일 찾기`를 한 번만 누른다. 같은 입력 재시도·새 추천·cache 삭제·설정 변경을 하지 않는다. CAPTCHA가 필요하면 정상 흐름에서 한 번만 완료한다.

## 중단·판정

- policy label이 B12가 아니거나 표시되지 않으면 `구성 검증 실패`로 종료한다.
- `route_proxy_transport_failed`, 앱 멈춤, 시간표 모순, 잘못된 출발/도착, 중복 장소면 즉시 중단한다.
- cache/session reuse가 있으면 새 provider attempt를 A8과 수치 비교하지 않고, 재사용·tier 결과를 함께 기록한다.
- 결과 수가 같아도 구조화된 time/no-route/운영 사유가 납득 가능하면 실패로 단정하지 않는다.

[`real-device-recommendation.md`](real-device-recommendation.md)에는 화면상 policy label·판정·수치·오류만 기록한다. URL·좌표·token/JWT·cache key·식별자·비밀값은 기록하지 않는다.
