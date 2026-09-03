# UIUX 현재 작업

## 먼저 읽을 파일

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`
3. 작업 목적에 맞는 현재 묶음만 읽는다.
   - [경로·위치 선택](route-and-location.md)
   - [CAPTCHA·Route Proxy](captcha-and-proxy.md)
   - [추천 런타임 표시](recommendation-runtime.md)
   - [B12 internal build 조립](b12-internal-build.md)
   - [체류 상태 표시 전환](dwell-state-results.md)
   - [대표 코스·장소 탐색 결과](explore-results.md)
   - [카카오맵 앱 직접 열기](kakao-map-deeplink.md)
   - [검증 대안·조건부 발견 결과](verified-course-results.md)
   - [조건부 실제 시각·카카오 주소 확인](results-conditional-time-and-map-query.md)
   - [검증 코스 진행·다음 길찾기](verified-course-progress.md)
   - [공개 추천 형태 내부 진단](internal-shape-diagnostics.md)
   - [다장소 unavailable 안전 사유 내부 표시](internal-unavailable-reason-diagnostics.md)
   - [출시 1곳 추천 UI 연결](release-one-stop-results.md)
   - [출시 1곳 추천 개발용 빠른 시나리오 실행기](qa-release-one-stop-launcher.md)
   - [출시 코스 카드·세로 상세 재구성](course-card-and-vertical-detail.md)
   - [출시 1곳 추천 다른 장소 더 보기](release-one-stop-more-results.md)
   - [최대 2곳 제한 선택·취소 복원](two-stop-limited-assembly.md)

## 현재 작업

`U-EXPLORE-01`의 browser fallback과 QA-EXPLORE-01은 수락됐지만, 무경로 탐색 목록의 결과 역할은 철회됐다. [U-KAKAO-DEEPLINK-01](kakao-map-deeplink.md), [U-RESULTS-03](verified-course-results.md), [U-RESULTS-04](results-conditional-time-and-map-query.md), [U-PROGRESS-01](verified-course-progress.md), [U-DIAG-SHAPE-01](internal-shape-diagnostics.md), [U-DIAG-SHAPE-02](internal-unavailable-reason-diagnostics.md), [U-RELEASE-ONESTOP-01](release-one-stop-results.md)은 수락됐다. 출시 기본은 실제 검증 1곳 entry, 최대 120분, 대표 1+첫 single 대안 최대 3이며 다장소 continuation은 비노출이다. one-stop 요청형 이어보기 엔진 `2-V`도 수락됐고, 이제 `U-ONE-MORE-01`에서 연결한다. 기존 체류 분 전체 비노출은 카드·진행 비노출과 코스 확인 상세의 맥락형 표시로 부분 교체했다.

[U-QA-HARNESS-01](qa-release-one-stop-launcher.md), [U-COURSE-CARD-DETAIL-01](course-card-and-vertical-detail.md), [U-ONE-MORE-01](release-one-stop-more-results.md), [U-COURSE-GEOMETRY-01/02](course-confirm-route-geometry.md)는 수락됐다. 코스를 선택한 뒤에만 50m 초과 transit endpoint gap의 private walk를 최대 4개 보충하며, 직선·transit 재조회·추천 시간 수정은 하지 않는다. `QA-COURSE-GEOMETRY-02`의 자동·실기기 검증도 통과해 이 경로 표시 묶음은 완료됐다.

최신 [U-TWO-STOP-01/02](two-stop-limited-assembly.md)과 `QA-TWO-STOP-01` 자동 게이트는 수락됐다. `U-TWO-STOP-02`는 production session·공유 12회 ledger·Results 선택 흐름을 연결했고, secondary 표시와 intent 기록을 동일한 allowlist identity predicate로 통일했다. production session 6/6, selection 20/20, QA integration 17/17과 전체 회귀가 통과했다. UIUX의 활성 구현은 없으며 다음은 외부 API 소유의 원격 Edge 단일 배포와 출시 후보 실기기 2건이다.

## 이력

과거 세부 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다. 현재 작업에 연결되지 않은 과거 구간을 전체 읽지 않는다.
