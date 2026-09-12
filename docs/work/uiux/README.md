# UIUX 현재 작업

## 현행 실행 — U-RELEASE-ICON-01

[아이콘 적용 명령](../integration-decision/release-docs-icon-closeout.md)의 해당 절 진행. 승인된 파란 시계 시안을 원본 보존하며 최종 규격으로 변환·앱 연결한다. AGE-01은 완료 근거 재사용, 신규 UI 다듬기·Distribution Archive/업로드 없음. DOCS-05-R1과 병렬 가능.

## 현행 실행 — U-RELEASE-AGE-01

[2단계 명령](../integration-decision/release-stage-two.md)의 AGE 절을 진행한다. 신규 가입 만14세 이상 자기확인만 구현, 기존 로그인·DB 계약 유지. 공개 문서 준비와 병렬 가능. 실제 URL/DB registry 인계 후 같은 문서의 LINKS-01 UI 절로 순차 연결한다.

## 최신 — U-RELEASE-EXIT-03 → U-RELEASE-SIGNING-PREP-03

[배포 준비 명령](../integration-decision/release-deploy-preparation.md)의 해당 두 절을 순서대로 진행. 기록 없는 종료의 legacy 목적지·raw 오류 로그만 보완 후 서명 준비. NATIVE-02 manifest 완료 유지, UI 다듬기 없음.

## 최신 — U-RELEASE-NATIVE-02

[최소 보완 명령](../integration-decision/release-minimal-followup.md)의 해당 절 진행. 01 로컬 완료 근거를 유지하고 Extension privacy/API 이유 및 public Archive 경계만 최소 보완. UI·LA 상태 로직 변경 금지.

## 최우선 — U-RELEASE-BUILD-01

[출시 실행 명령](../integration-decision/release-execution-wave.md)의 해당 절 실행. UI 다듬기 종료, 표시명·iPhone·제출 환경·native 검증만 수행. RELEASE-LINKS-01은 URL/승인 후 조건부. 아래 과거 UI 명령 재실행 금지.

## 최신 실행 — U-MAIN-MAP-POLISH-02 → U-MAIN-STACK-01 → U-LIVE-ACTIVITY-FINAL-02

[최종 표현·지도·스택·LA 명령](final-interaction-wave.md). 기존 MAIN-COURSE-POLISH 실기기4항목 사용자 확인 완료. 추가 보완은 일반 UI/지도→메인 스택→LA 배치·최종 완료 액션 순서다. LA 읽기 전용 조사와 사진 데이터 조사는 병렬 가능하나 공유 navigation/controller 구현은 동시에 쓰지 않는다.

## 최신 실행 — U-MAIN-COURSE-POLISH-01

[메인·추천·코스 최종 표현 정리](main-course-final-polish.md). 사용자 승인·구현 전. 메인 문구/여백/영업 상태 색상, 작은 썸네일 코스 확인, 진행 하단 고정 행동·현재 단계 점등·요약 행 취소를 A→B로 수행한다. 사진 조사와 소유 파일을 분리해 병렬 가능. 아래 cleanup은 완료 인계를 선행 기준으로 사용하며 다시 구현하지 않는다.

## 최우선 실행 — U-RELEASE-UI-CLEANUP-01

[시간 설정·추천 화면 정리](release-ui-cleanup.md). 오늘/내일 선택을 없애되 내부 날짜 보존과 최대 180분은 유지한다. 폐기한 10~18시 조건부 추천·수동 코스 진입과 추천 헤더의 빈 네모를 제거한다. 주변 독립 탐색·정상 검증 추천은 유지한다. 아래 과거 조건부 노출 유지 지시보다 이 사용자 확정 명령이 우선한다. 상태: 구현 전.

## 2026-09-08 최신 — U-PROFILE-AUTH-POLISH-02

[프로필 관리·로그인 혜택·닉네임 제목·폼 격리](profile-management-auth-polish.md). 내정보 inline 관리를 별도 화면으로 교체하고 닉네임/삭제/로그아웃 순서, 실제 동의 조건을 포함한 혜택 문구, 계정별 제목과 로그인/가입 입력 분리를 구현한다. U-HISTORY-FINAL-03은 사용자 완료 보고.

## 2026-09-08 최신 — U-HISTORY-FINAL-03

[드래그 우선 복구 → 지도 요약·삭제 메뉴](history-motion-summary-menu.md). 현재 Animated 구현 뒤 남은 끊김을 A에서 재현/수정한 뒤 B의 지도·방문 횟수·카테고리 요약과 날짜/⋯/long press 삭제를 적용한다. 기존 상시 swipe 설명과 첫 사용 자동 시연 제안은 새 구현에 넣지 않는다.

## 2026-09-08 최신 — U-HISTORY-POLISH-02

[기록 카드·필터·드래그 보완](history-card-filter-gesture.md): 둥근14pt 기록/삭제 카드, 제목 오른쪽 전체 삭제, 카테고리 목록 필터와 실제 표시 위치 기반 gesture 진단·수정. 기존 completionId 삭제 단위와 전체 삭제 범위는 유지한다. U-HISTORY-SWIPE-01은 구현 보고됐으나 실기기 끊김을 이번 작업에서 보완한다.

## 2026-09-08 최신 — U-NEARBY-HANDOFF-02 → U-HISTORY-SWIPE-01

[주변 검색·handoff 오류와 계정 기록 스와이프 삭제](nearby-handoff-and-history-polish.md)를 A→B 순서로 수행한다. 주변 단순화는 완료 보고됐으나 실제 길찾기 후 실패 문구 관찰을 후속 진단한다. 계정 기록은 기존 삭제 서비스를 행 스와이프에 연결하며 새로운 DB 삭제 정책은 만들지 않는다.

## 2026-09-08 현재 — U-NEARBY-SIMPLE-01

[주변 UI 간소화·독립 길찾기](nearby-simple-directions.md): 시트 `가까운 순`, 접기/펼치기 텍스트 제거·손잡이 탭/접근성 유지, 상세 반복 경고 제거 및 독립 외부 길찾기. 추천·기록·체류·Live Activity 연결0. 추천 조건부 영역 제거와 전체 UI 재정리는 별도 후속이다.

## 2026-09-08 현재 — U-CONDITIONAL-PREVIEW-01

[조건부 장소 개발 미리보기](conditional-place-preview.md)를 먼저 추가한다. 사용자의 목적은 새벽에도 현재 조건부 UI를 보며 수정하는 것이며, 실제10~18시 정책이나 일반 추천 시간을 변경하지 않는다. U-TEST-CLOCK-01은 진단 완료이며 발견한 시계 혼용 버그는 별도 잔여다. 미리보기 추가 → 사용자 UI 피드백/수정 → 배포 전 전용 연결 제거 순서다.

## 2026-09-08 현재 — U-TEST-CLOCK-01

[테스트 시각 추천 실패 진단](test-clock-recommendation-diagnosis.md)을 진행한다. U-GUEST-IMPORT-01은 사용자 실기기 정상 확인으로 수락됐으며 추가 가져오기/C 반복은 하지 않는다. 이번은 시계 경계 진단·고정 재현만이며 시장 UI/시간 상한/제품 정책 변경은 다음 순서다.

## 2026-09-08 현재 — U-GUEST-IMPORT-01

[가져온 계정 기록 표시 보완](guest-import-record-display.md): DB 가져오기 제한 복구·사용자 계정 기록 표시 확인 뒤, 계정 통계 레이아웃과 sibling key 충돌을 보완한다. DB 복구·개인화 C는 재실행하지 않는다. 테스트 시각/시장 카드/시간 확장은 다음 순서다.

## 현재 실행 — U-LIVE-LEARNING-EVIDENCE-01

[앱·Live Activity 학습 증거 연결 명령](live-learning-evidence-integration.md)을 지금 수행한다. DB-LIVE-LEARNING-EVIDENCE-01 서비스 계약은 통합 수락됐으며 계약 대기는 해제됐다. 기존 B await starts/cold proof 잔여 연결도 이번 명령 A에 포함한다. 아래 조사 전용/인계 대기는 과거 이력이고 본 명령이 우선한다. UI/native를 별도 writer로 나누어 같은 파일을 동시에 수정하지 않는다.

## 2026-09-07 최신 작업

최신: B 주요 연결 구현 뒤 DB 공유 잠금/cold 조회 두 보완을 반환했다. 기다리는 동안 [Live Activity 학습 증거 조사](live-activity-learning-evidence.md)를 **병렬 조사**한다. 제품 코드 변경은 조사 계약 확인 뒤이며, DB 인계 후 기존 B 진단을 기대 성공 fixture로 교체하고 잔여 연결을 검증한다.

**현행: DB 세 보완 통합 수락 완료, U-RELEASE-PERSONALIZATION-01 B 남은 연결 지금 실행.** [수락 기록](../integration-decision/release-personalization-wave.md#db-세-보완-통합-수락--2026-09-07). 아래 DB 인계/수락 대기는 해제됐으며 기존 부분 구현은 반복하지 않는다.

최우선 후속: release-personalization-integration.md 맨 위 **“최신 B 이어서 실행 — DB 소유권 보완 뒤”**. 현재 B 부분 구현 유지, DB 보완 인계 후 신규 완료/guest import/sample submit/삭제를 연결한다. A/read 연결 재구현 금지.

[U-RELEASE-PERSONALIZATION-01](release-personalization-integration.md): **A handoff 실패 복구 지금 실행 가능**, B 계정/기록/개인화 consumer는 DB·엔진·데이터 계약 수락 뒤. UI 단일 writer.

## 먼저 읽을 파일

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`
   - 전체 출시 요구의 현재 체크 상태는 `docs/work/integration-decision/release-uiux-checklist.md`를 읽되 직접 수정하지 않는다.
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
    - [전역 상호작용 모션·시간 휠·화면 전환](global-interaction-motion.md)
   - [출시 핵심 화면 시각 밀도·진행 피드백](release-visual-polish.md)
   - [V1 활성 코스 메인 이어가기](active-verified-course-resume.md)
   - [활성 코스 교체·일반/익명 Auth guard](runtime-course-auth-guard.md)
   - [비로그인 포함 완료 기록·기록 탭 연결](course-completion-history.md)
   - [iOS 17 Live Activity·체류 확인](live-activity-dwell-progress.md)
   - [장소 상세 선택·최적 코스 단일 화면](place-detail-and-optimized-course-flow.md)

## 현재 작업

2026-09-06 최신 시작 작업은 [U-LIVE-ACTIVITY-01 로컬 A→B](live-activity-dwell-progress.md)다. 내정보 기본 UI 이후 서버 연결을 분리하고 기술 검증부터 진행한다. [실행 순서](../integration-decision/live-activity-local-first.md). 다른 App/nav/Profile/native writer와 동시 실행 금지.

최신 실행: [U-PROFILE-SETTINGS-01](profile-settings.md). 내정보 세 영역·메인 프로필 진입·로그인 분리와 기존 계약 확인. 주변 지도/드래그는 사용자 확인으로 제한 수락됐으며 아래 과거 활성 문구보다 이 항목이 우선한다. 닉네임/삭제/동의 계약 부재는 별도 인계하며 Live Activity를 이번에 구현하지 않는다.

다음 활성 구현은 [U-NEARBY-BROWSE-01](nearby-browse.md)이다. 약속 시간과 독립된 3km 정보 탐색, 사진 cluster 지도+거리순 하단 sheet를 구현하고 내 코스 최상위 탭을 교체한다. `U-LOCATION-SEARCH-01`은 사용자 수락(키보드 미세 지연 비차단 보류) 상태다. 과거 활성 표기보다 이 항목을 우선한다.

최신 활성 작업은 [U-LOCATION-SEARCH-01](location-search-interaction.md) **구현 가능**이다. U-SETUP-UNIFIED-01 뒤 사용자 추가 요구인 위치 검색 키보드/선택·필드별 draft·지도 왕복 복원·항상 가로 선택 수단·간결한 디자인을 구현한다. 통합 입력 배치는 유지한다.

[U-PLACE-COURSE-FLOW-01](place-detail-and-optimized-course-flow.md)은 **복원 및 QA 수락**이다. review 한정 계획 체류, 1곳 4/2곳 6 connector, 상세 후 선택·단일 코스 화면은 자동 게이트와 사용자 실기기 smoke를 통과했다. 다음은 [U-SETUP-UNIFIED-01](unified-time-route-setup.md)이며 **구성 확정·상시 시간 휠/일반 영역 무스크롤·개발 버튼 유지·구현 가능**다.

`U-EXPLORE-01`의 browser fallback과 QA-EXPLORE-01은 수락됐지만, 무경로 탐색 목록의 결과 역할은 철회됐다. [U-KAKAO-DEEPLINK-01](kakao-map-deeplink.md), [U-RESULTS-03](verified-course-results.md), [U-RESULTS-04](results-conditional-time-and-map-query.md), [U-PROGRESS-01](verified-course-progress.md), [U-DIAG-SHAPE-01](internal-shape-diagnostics.md), [U-DIAG-SHAPE-02](internal-unavailable-reason-diagnostics.md), [U-RELEASE-ONESTOP-01](release-one-stop-results.md)은 수락됐다. 출시 기본은 실제 검증 1곳 entry, 최대 120분, 대표 1+첫 single 대안 최대 3이며 다장소 continuation은 비노출이다. one-stop 요청형 이어보기 엔진 `2-V`도 수락됐고, 이제 `U-ONE-MORE-01`에서 연결한다. 기존 체류 분 전체 비노출은 카드·진행 비노출과 코스 확인 상세의 맥락형 표시로 부분 교체했다.

[U-QA-HARNESS-01](qa-release-one-stop-launcher.md), [U-COURSE-CARD-DETAIL-01](course-card-and-vertical-detail.md), [U-ONE-MORE-01](release-one-stop-more-results.md), [U-COURSE-GEOMETRY-01/02](course-confirm-route-geometry.md)는 수락됐다. 코스를 선택한 뒤에만 50m 초과 transit endpoint gap의 private walk를 최대 4개 보충하며, 직선·transit 재조회·추천 시간 수정은 하지 않는다. `QA-COURSE-GEOMETRY-02`의 자동·실기기 검증도 통과해 이 경로 표시 묶음은 완료됐다.

최신 [U-TWO-STOP-03](two-stop-limited-assembly.md#2026-09-04-u-two-stop-03-사용자-반환-보완-완료-인계)은 자동 수락됐다. 선택 전후 동일 Results 트리·헤더·시간 요약·ScrollView를 유지하고 기존 one-stop 카드 영역만 B loading/exact 후보로 교체한다. A tray와 A-only CTA는 즉시 보이며, 취소 시 목록·더보기·scroll snapshot을 복원한다. 표시 완료 one-stop seed도 A branch별로 동결해 `2-Z` begin/continue/reuse에 연결했다. 실제 작은 iPhone에서 중간 카드 선택 시 스크롤 이동 체감과 fixed CTA 가림 여부만 출시 후보 smoke 한 번에 확인한다.

[U-TWO-STOP-04](two-stop-limited-assembly.md#u-two-stop-04-수락-전-보완-완료-인수인계-2026-09-04-uiux)와 `QA-TWO-STOP-02`는 수락됐다. 동일 session exact pair 역선택 0-call, terminal partial 비저장, attempt-limit exact partial 유지와 B 추가시간을 자동 통합 확인했다. 작은 iPhone의 A/B 카드·고정 CTA·취소 복원은 출시 후보 smoke에 합친다.

[U-INTERACTION-01](global-interaction-motion.md)은 **최종 수락**이다. 공용 `AnimatedPressable` style 복구, 일반 버튼 햅틱 0, 시간 wheel 새 행과 도착 여유 slider 새 5분 값의 selection haptic, 중복/programmatic 0회, native stack/Results 전환을 자동 검증했고 `ExpoHaptics`가 포함된 새 internal build의 iOS 실기기 촉각 확인도 완료했다. 후속 작업은 이 공용 interaction 경계를 재사용한다.

[U-RELEASE-VISUAL-01](release-visual-polish.md)은 **자동 수락·수동 시각 2/3 확인**이다. 결과 카드 밀도와 CourseConfirm full-bleed 지도·세로 순서는 사용자가 확인했다. Home active 영역은 간격 문제가 아니라 V1 진행 상태가 Home에 연결되지 않은 별도 구현 격차로 확인돼 아래 작업으로 이관한다.

[U-PROGRESS-RESUME-01](active-verified-course-resume.md)은 **수락**이다. 로그인 여부와 무관한 같은 프로세스 V1 활성 코스·마지막 단계·Home 이어가기 자동 회귀와 `QA-PROGRESS-RESUME-01` 비로그인 실기기 smoke를 통과했다. legacy active course, 추천/API/DB, AsyncStorage/App Group은 바꾸지 않았다. 강제 종료 복구와 영속 `courseRunId`는 `U-LIVE-ACTIVITY-01`에 남기고, 다른 활성 코스를 조용히 교체하는 현행 동작은 별도 교체 확인 UX로 보완한다.

[U-RUNTIME-GUARD-01](runtime-course-auth-guard.md)은 **수락**이다. 다른 active가 있는 최종 시작에서 취소·기존 이어가기·새 코스로 시작을 제공하고, Route Proxy anonymous raw session은 유지하면서 Profile·saved course·개인화의 일반 account 상태와 분리했다. `QA-RUNTIME-GUARD-01`의 자동 게이트와 제한 수동 확인 A·B도 통과했고 후속 `U-COMPLETION-HISTORY-01`까지 수락됐다.

[U-COMPLETION-HISTORY-01](course-completion-history.md)은 **수락**이다. 안정적인 runtime `courseRunId`, 명시 완료 repository 호출, 이번 달 device-local 기록 탭과 미측정 상태를 연결했고 자동 게이트와 `QA-COMPLETION-HISTORY-01` 비로그인 iOS 1곳 제한 smoke를 통과했다. App Group/ActivityKit/알림·실제 체류와 legacy 포함 전체 삭제는 별도 후속 경계로 남긴다.

[U-LIVE-ACTIVITY-01](live-activity-dwell-progress.md)은 **대기**다. `U-COMPLETION-HISTORY-01`, DB-DWELL-01·2-AB 공개 계약 뒤 iOS 17 Widget Extension·App Group·App Intent, 로컬 알림, 도착/출발 확인과 내 정보 동의/권한 상태를 연결한다. 기본 완료 기록을 다시 구현하지 않고 선행 작업의 `courseRunId`와 repository를 App Group/실제 체류 경계로 확장한다. GPS·background location·원격 ActivityKit push와 추가 Kakao/Route Proxy 호출은 금지한다.

## 이력

과거 세부 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다. 현재 작업에 연결되지 않은 과거 구간을 전체 읽지 않는다.
