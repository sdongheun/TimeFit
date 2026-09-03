# 추천 엔진 현재 작업

## 먼저 읽을 파일

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md`
3. 작업 목적에 맞는 현재 묶음만 읽는다.
   - [v1 코어·공개 엔트리](engine-v1-core.md)
   - [tier·공급량·검증 예산](tier-and-supply.md)
   - [B12 internal 검증 묶음](b12-internal-validation.md)
   - [체류 범위·짧게 가능 전환](dwell-range-recommendation.md)
   - [대표 코스·장소 탐색 이중 결과](explore-result-contract.md)
   - [검증 대안 이어보기·조건부 발견](verified-course-pagination.md)
   - [검증 코스 형태 다양성 회복](verified-course-shape-diversity.md)
   - [다장소 검증 기회 회귀 고정](verified-course-shape-diversity-regression.md)
   - [다장소 receipt unavailable 안전 원인 보존](receipt-unavailable-reason-contract.md)
   - [출시용 1곳 실제 검증 전환](release-one-stop-verified-course.md)
   - [출시 1곳 추천 요청형 이어보기](release-one-stop-pagination.md)
   - [검증 코스 구간 geometry snapshot](verified-route-geometry.md)
   - [출시 2곳 코스 재도입 준비 감사](release-two-stop-readiness-audit.md)
   - [최대 2곳 제한 조립 엔진](two-stop-limited-assembly.md)

## 현재 상태

`2-M`부터 [2-W](verified-route-geometry.md)까지 출시 one-stop 엔진 계약과 [2-X](release-two-stop-readiness-audit.md) 준비 감사는 수락됐다. 사용자는 이후 `DEC-TWO-STOP-SELECTION-01`의 최대 2곳 제한 조립을 확정했다. [2-Y](two-stop-limited-assembly.md)의 pair-only entry, 양방향 exact 비교, 점진 progress, 누적 36회 ledger는 구현·통합 검토까지 수락됐다. 추천 엔진 세션의 독립 후속 작업은 현재 없으며, `API-TWO-STOP-02`·UI 표시 보완 뒤 Wave 2 composition/QA 실패가 엔진 소유 재현으로 돌아올 때만 재개한다. production one-stop은 자동 통합 게이트 전까지 유지한다.

## 이력

과거 세부 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다. 현재 작업을 수행하기 위해 archive 전체를 읽지 않는다. 현재 묶음이 필요한 근거 anchor만 가리킬 때만 연다.
