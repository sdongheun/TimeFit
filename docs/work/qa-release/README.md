# QA·출시 현재 작업

## 최우선 실행 — QA-LIVE-LEARNING-EVIDENCE-01

[앱·Live Activity 학습 연결 검증](live-learning-evidence-validation.md)의 A 자동 게이트를 지금 실행한다. U-LIVE-LEARNING-EVIDENCE-01 통합 코드 검토 완료로 구현 인계 대기는 해제됐다. B는 새 internal build 최소 사용자 실기기, C는 별도 검증 환경·권한을 확인한 실제 서버 게이트다. 아래 전체 개인화/출시 대기와 구분하며 Simulator 반복 클릭·운영 쓰기 없이 진행한다.

## 2026-09-07 최신 작업

[QA-RELEASE-PERSONALIZATION-01](release-personalization-validation.md): fixture 준비 가능, **최종 실행은 각 구현 인계 뒤**. 실제 개인화 결과와 계정 격리/guest 학습0/기존 preflight 결함 확인.

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
   - [완료 기록·체류 개인화·시각 정리 통합 게이트](foundation-wave-validation.md)
   - [V1 진행 코스 재진입 검증](progress-resume-validation.md)
   - [활성 코스 교체·익명 Auth 표시 검증](runtime-course-auth-guard-validation.md)
   - [명시 완료 기록·기록 탭 제한 검증](completion-history-validation.md)
   - [Live Activity 체류 측정·개인화 출시 게이트](live-activity-dwell-validation.md)
   - [장소 상세·최적 코스 단일 화면 검증](place-detail-and-optimized-course-flow-validation.md)

## 현재 상태

[QA-SETUP-UNIFIED-01](unified-time-route-setup-validation.md)은 **실행 가능**이다. 통합 입력과 개발 영역 제외 배치 보완 후 기능·회귀를 고정 fixture로 검증한다. 사용자가 일반 입력의 무스크롤 배치를 수락했으므로 재디자인/반복 캡처를 요구하지 않는다. 자동 검증 후 미확인 native 동작만 묶어 확인한다.

[QA-PLACE-COURSE-FLOW-01](place-detail-and-optimized-course-flow-validation.md)은 **설계 병렬 가능·최종 실행은 U-PLACE-COURSE-FLOW-01 후행**이다. 새 fixture/QA 파일만 먼저 준비할 수 있고, 자동 PF-01~13 판정과 마지막 실기기 smoke는 UIUX 인수인계 뒤 실행한다. Simulator 버튼 순회와 실제 API 반복 호출은 하지 않는다.

과거 다장소·B12·공급량 QA는 완료 이력으로만 보존한다. 출시 기본 one-stop, `QA-ONE-MORE-01`, [QA-COURSE-GEOMETRY-02](course-confirm-route-geometry-validation.md)는 수락됐다. [QA-TWO-STOP-02](two-stop-limited-assembly-validation.md)는 동일 세션 exact `{A,B}` 역선택 0-call, terminal partial 비저장, attempt-limit exact partial 유지, 새 세션 비재사용과 B 추가시간을 고정 fixture로 통과해 수락됐다. 자동 범위의 실패는 없고 Simulator·실제 API는 사용하지 않았다. 작은 iPhone의 중간 B 카드·고정 CTA·취소 스크롤 복원 체감만 출시 후보 수동 smoke 한 번에 합친다.

[QA-LIVE-ACTIVITY-01](live-activity-dwell-validation.md)은 **대기**다. U-COMPLETION-HISTORY-01·DB-DWELL-01·2-AB·U-LIVE-ACTIVITY-01 수락과 QA 대상 Supabase migration 적용 뒤 고정 clock/notification/activity/repository fixture를 우선 실행하고, iOS 17 실기기에서는 1곳·2곳 코스 각 1회와 권한 거절 1회만 확인한다.

[QA-FOUNDATION-WAVE-01](foundation-wave-validation.md)의 자동 게이트와 시각 항목은 통과했고, 당시 발견한 Home V1 active 미연결은 `U-PROGRESS-RESUME-01`에서 구현됐다. [QA-PROGRESS-RESUME-01](progress-resume-validation.md)은 **수락**이다. 집중 32/32, UI 277 통과·의도 skip 1, core 117/117과 비로그인 iOS 실기기 6단계를 통과했다. 강제 종료 복구는 범위 밖이며, 다른 코스 교체 확인과 익명 Auth의 계정 오표시는 새 후속 항목이다.

[QA-RUNTIME-GUARD-01](runtime-course-auth-guard-validation.md)은 **수락**이다. fixed session/navigation/Alert fixture와 제한 수동 확인 A·B에서 silent replace 방지, anonymous/account 분리, 기존 진행 재개를 모두 검증했다. 집중 26/26, UI 289 통과·의도 skip 1, core 117/117이며 제품 코드는 수정하지 않았다.

[QA-COMPLETION-HISTORY-01](completion-history-validation.md)은 **수락**이다. 집중 41/41, map 계약 14/14, UI 303 pass·의도 skip 1, core 117/117, typecheck·diff check를 통과했고 비로그인 iOS 1곳 명시 완료에서 기록 탭 자동 이동, 장소 수 +1, 카테고리 반영, `체류시간 미측정`, 탭 왕복 유지와 active 제거를 확인했다. 로그인·2곳·저장 장애·연타의 반복 수동 확인은 남지 않았다.

## 이력

과거 QA·출시 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다. 현재 게이트에 필요한 anchor 외 전체 이력을 읽지 않는다.
