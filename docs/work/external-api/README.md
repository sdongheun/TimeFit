# 외부 API 현재 작업

## 최신 — API-RELEASE-OPS-02

[최소 보완 명령](../integration-decision/release-minimal-followup.md)의 해당 절 진행. 운영 endpoint/provider·공급자 사실 확인만, 원격 배포/실제 경로 반복 호출 금지. DB 공통 메타데이터 재사용.

## 최우선 — API-RELEASE-FACTS-01

[출시 실행 명령](../integration-decision/release-execution-wave.md)의 해당 절 실행. 실제 위치 전송/provider/cache/log·제출 설정 계약 점검. 정책 변경·원격 배포·반복 운영 호출 금지.

## 2026-09-07 최신 작업

[API-RELEASE-SAFETY-01](release-safety-remediation.md): **지금 실행 가능**. 안전 로그/위치 cache/adapter 실패 경계 및 원격 확인 인계. 원격 배포는 별도 승인.

`API-4-F`, [API-PAGE-01 — 검증 코스 페이지 호출·cache 계약](verified-course-page-budget.md), [API-SNAPSHOT-SYNC-01 — 대표 카탈로그 Route Proxy 배포 동기화](representative-snapshot-deployment-sync.md)는 수락됐다. API-SNAPSHOT-SYNC-01은 DATA-SUPPLY-01의 대표 190→191 변경 뒤 mobile public scope와 Edge snapshot을 동기화했고, stale version을 generic transport로 평탄화하지 않게 고정했다. 다음 runtime 확인은 QA-SUPPLY-01의 SUP-01 한 번이다. 새 작업 전에는 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`와 작업 목적에 맞는 현재 묶음만 읽는다.

- [장소 검색·위치](place-search-location.md)
- [Route Proxy 활성화·호출량](route-proxy-activation.md)
- [검증 코스 페이지 호출·cache 계약](verified-course-page-budget.md)
- [대표 카탈로그 Route Proxy 배포 동기화](representative-snapshot-deployment-sync.md)
- [다장소 receipt unavailable 원인 감사](multistop-receipt-unavailable-audit.md)
- [다장소 receipt unavailable 안전 reason 전달](multistop-receipt-reason-mapping.md)
- [대표 구간 Route Proxy 저장소 준비 상태 감사](public-route-store-readiness-audit.md)
- [2곳 route receipt·public store·예산 재사용](two-stop-route-budget.md)

`API-MULTISTOP-RECEIPT-01`은 과거 실행을 읽기 전용으로 감사했으나 reason을 안전하게 연결할 로그 창이 없어 원인을 특정하지 못했다. `2-T`와 `API-MULTISTOP-RECEIPT-02`는 원인을 고치지 않고 safe reason을 engine 진단까지 보존했다. QA-MULTISTOP-RECEIPT-01은 A8 두 입력 모두 첫 다장소 receipt가 `store`로 중단됨을 확인했다. [API-PUBLIC-STORE-01](public-route-store-readiness-audit.md)은 remote migration·Function secret 이름·RPC signature/권한의 국소 결함이 없음을 확인했고, 이로써 `DEC-RELEASE-MULTISTOP-01`의 1곳 출시 전환 조건이 발동했다. 외부 API의 추가 추적·배포는 하지 않으며, 다음은 추천 엔진의 1곳 전용 release entry다. Route Proxy·Kakao cache·CAPTCHA의 과거 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다.

`DEC-ONE-STOP-MORE-01`의 one-stop page 계약과 [API-ROUTE-GEOMETRY-01/02/03](route-geometry.md)은 유지한다. [API-TWO-STOP-01/02](two-stop-route-budget.md)의 public A↔B receipt, private/public scope, 명시적 `maxNewProviderAttemptCount: 0 | 1`, cache-only miss provider 0, provider 후처리 실패의 실제 attempt 보존은 코드·fixture 통합 검토에서 수락됐다. 실제 원격 Edge 배포와 운영 cache 검증은 아직 하지 않았다. 외부 API 세션의 독립 구현은 재실행하지 않고 필수 네 항목 인수인계만 보충하며, 이후 QA 통합 실패가 API 소유 재현으로 돌아오거나 단 한 번의 원격 배포가 승인될 때만 재개한다.
