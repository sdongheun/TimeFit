# QA·출시 현재 작업

[QA-RELEASE-ONESTOP-01 — 출시 1곳 추천 빠른 Simulator 검증](release-one-stop-simulator-validation.md)은 조건부 수락됐고, [QA-ONE-MORE-01](release-one-stop-more-results-validation.md)은 고정 fixture 자동검증으로 통합 수락됐다. 요청형 이어보기 때문에 과거 8개 입력이나 Simulator 조작을 다시 수행하지 않는다. 미회수 receipt, CourseConfirm 복원, 더보기 표시·누적은 UIUX 정리 이후 출시 후보의 사용자 수동 smoke 1회에 합쳐 확인한다.

## 먼저 읽을 파일

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/테스트.md`, `docs/03_product/UIUX_테스트명세.md`
3. 작업 목적에 맞는 현재 묶음만 읽는다.
   - [출시 1곳 추천 시뮬레이터 자율 검증](release-one-stop-simulator-validation.md)
   - [출시 1곳 추천 이어보기 검증](release-one-stop-more-results-validation.md)
   - [추천 기준선·진단](recommendation-baseline.md)
   - [B12 실기기 비교 게이트](b12-device-comparison.md)
   - [사용자 실기기 추천 기록](real-device-recommendation.md)
   - [체류 범위 회귀 게이트](dwell-range-validation.md)
   - [대표 코스·장소 탐색 결과 검증](explore-results-validation.md)
   - [검증 대안·조건부 발견 결과 검증](verified-course-results-validation.md)
   - [생활권 대표 후보 보강 실기기 재확인](targeted-supply-recheck.md)
   - [핵심 추천 UX 체감 확인](core-user-experience-review.md)
   - [실제 다장소 탈락 원인 최소 관찰](production-shape-diagnosis.md)
   - [다장소 receipt unavailable 원인 실기기 판정](multistop-receipt-reason-device-validation.md)
   - [최대 2곳 제한 조립 자동 통합 게이트](two-stop-limited-assembly-validation.md)

## 현재 상태

과거 다장소·B12·공급량 QA는 완료 이력으로만 보존한다. 출시 기본 one-stop, `QA-ONE-MORE-01`, [QA-COURSE-GEOMETRY-02](course-confirm-route-geometry-validation.md)는 수락됐다. [QA-TWO-STOP-01](two-stop-limited-assembly-validation.md)은 UI session reuse와 TS-14 connector fixture 계약을 복구한 뒤 runtime 17/17, typecheck, UI 225 통과·기존 skip 1, core 117/117, diff check까지 통과해 수락됐다. 자동 fixture 범위의 잔여 실패는 없고, production 연결 뒤에는 소수 실기기 smoke만 별도 수행한다.

## 이력

과거 QA·출시 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다. 현재 게이트에 필요한 anchor 외 전체 이력을 읽지 않는다.
