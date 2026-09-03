# 외부 API 현재 작업

`API-4-F`, [API-PAGE-01 — 검증 코스 페이지 호출·cache 계약](verified-course-page-budget.md), [API-SNAPSHOT-SYNC-01 — 대표 카탈로그 Route Proxy 배포 동기화](representative-snapshot-deployment-sync.md)는 수락됐다. API-SNAPSHOT-SYNC-01은 DATA-SUPPLY-01의 대표 190→191 변경 뒤 mobile public scope와 Edge snapshot을 동기화했고, stale version을 generic transport로 평탄화하지 않게 고정했다. 다음 runtime 확인은 QA-SUPPLY-01의 SUP-01 한 번이다. 새 작업 전에는 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`와 작업 목적에 맞는 현재 묶음만 읽는다.

- [장소 검색·위치](place-search-location.md)
- [Route Proxy 활성화·호출량](route-proxy-activation.md)
- [검증 코스 페이지 호출·cache 계약](verified-course-page-budget.md)
- [대표 카탈로그 Route Proxy 배포 동기화](representative-snapshot-deployment-sync.md)
- [다장소 receipt unavailable 원인 감사](multistop-receipt-unavailable-audit.md)
- [다장소 receipt unavailable 안전 reason 전달](multistop-receipt-reason-mapping.md)
- [대표 구간 Route Proxy 저장소 준비 상태 감사](public-route-store-readiness-audit.md)

`API-MULTISTOP-RECEIPT-01`은 과거 실행을 읽기 전용으로 감사했으나 reason을 안전하게 연결할 로그 창이 없어 원인을 특정하지 못했다. `2-T`와 `API-MULTISTOP-RECEIPT-02`는 원인을 고치지 않고 safe reason을 engine 진단까지 보존했다. QA-MULTISTOP-RECEIPT-01은 A8 두 입력 모두 첫 다장소 receipt가 `store`로 중단됨을 확인했다. [API-PUBLIC-STORE-01](public-route-store-readiness-audit.md)은 remote migration·Function secret 이름·RPC signature/권한의 국소 결함이 없음을 확인했고, 이로써 `DEC-RELEASE-MULTISTOP-01`의 1곳 출시 전환 조건이 발동했다. 외부 API의 추가 추적·배포는 하지 않으며, 다음은 추천 엔진의 1곳 전용 release entry다. Route Proxy·Kakao cache·CAPTCHA의 과거 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다.

`DEC-ONE-STOP-MORE-01`의 one-stop page 계약과 [API-ROUTE-GEOMETRY-01/02/03](route-geometry.md)을 따른다. API-02는 14개 transit route 모두 시작·마지막 WALKING path가 없고 endpoint gap이 `51–250m`임을 확인했다. 사용자가 선택한 코스 상세의 private walk connector인 API-03은 통합 수락됐다. 현재 Auth 세션만 재사용하고 walk-only·10분/64개 프로세스 메모리 재사용·private 좌표 비영속을 지킨다. 외부 API의 후속 수정은 없으며 다음 소유자는 `U-COURSE-GEOMETRY-02` UIUX다.
