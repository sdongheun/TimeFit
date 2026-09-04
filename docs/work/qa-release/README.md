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
   - [Live Activity 체류 측정·개인화 출시 게이트](live-activity-dwell-validation.md)

## 현재 상태

과거 다장소·B12·공급량 QA는 완료 이력으로만 보존한다. 출시 기본 one-stop, `QA-ONE-MORE-01`, [QA-COURSE-GEOMETRY-02](course-confirm-route-geometry-validation.md)는 수락됐다. [QA-TWO-STOP-02](two-stop-limited-assembly-validation.md)는 동일 세션 exact `{A,B}` 역선택 0-call, terminal partial 비저장, attempt-limit exact partial 유지, 새 세션 비재사용과 B 추가시간을 고정 fixture로 통과해 수락됐다. 자동 범위의 실패는 없고 Simulator·실제 API는 사용하지 않았다. 작은 iPhone의 중간 B 카드·고정 CTA·취소 스크롤 복원 체감만 출시 후보 수동 smoke 한 번에 합친다.

[QA-LIVE-ACTIVITY-01](live-activity-dwell-validation.md)은 **대기**다. DB-DWELL-01·2-AB·U-LIVE-ACTIVITY-01 수락과 QA 대상 Supabase migration 적용 뒤 고정 clock/notification/activity/repository fixture를 우선 실행하고, iOS 17 실기기에서는 1곳·2곳 코스 각 1회와 권한 거절 1회만 확인한다.

## 이력

과거 QA·출시 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다. 현재 게이트에 필요한 anchor 외 전체 이력을 읽지 않는다.
