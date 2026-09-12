# TimeFit 문서 색인 변경 이력 — 2026-09-12 이전 원문

이 문서는 이전 색인을 같은 디렉터리에 보존한 기록이다. 아래 `최신`, `현재 실행`, `미적용`, `구현 전`은 작성 당시 상태이며 현재 작업 지시가 아니다. 현행 진입점은 [문서 안내](README.md)와 [현재 기능과 구조](03_product/현재기능과구조.md)를 따른다. 상대 링크와 과거 결정 근거를 보존하기 위해 원문을 삭제하지 않았다.

2026-09-12 최신: **사용자 App Store 배포 완료 보고**. [출시 후 역할별 커밋 인계](work/integration-decision/post-release-role-commits.md)를 기준으로 현재 작업트리를 보존한다. 아래 출시 준비·심사 대기 기록은 당시 이력이며 재실행 지시가 아니다. 다음 순서는 기능별 문서 재정리 → 테스트 현황·누락 조사 → 필요한 테스트 보강이며, 이번 커밋 정리에 리팩터링·UI 변경은 포함하지 않는다.

2026-09-10 최신: 사용자 **기기 ID 제외·App Privacy 게시 완료** 보고. [통합 후속](work/integration-decision/release-connect-final-parallel.md)의 DOCS-CAPTCHA-NOTICE-FINAL-01로 가입 CAPTCHA 고지 누락 3곳만 보완한다. 게시 보고는 공급자 미수집 검증이나 심사 제출 완료가 아니다. 아래 게시 전 기록은 이력이다.

2026-09-10 최신 App Privacy 상태: [사용자 설정 인계](work/integration-decision/release-connect-final-parallel.md#0910-사용자-app-privacy-설정-인계--게시-전). 1.0.0(1) 대상 7유형 세부 설정 완료 보고, 고객 지원·검색 기록·실적 데이터는 제거 예정, **게시 미실행**. 기기 ID의 사용자 연결 ‘아니요’는 현재 입력값으로 기록하되 분류 검토 사항을 남겼다. 아래 과거 8/10유형 일괄 입력안은 재실행 기준이 아니다.

2026-09-10 최신 수락: [TestFlight 내부 검증](work/integration-decision/release-connect-final-parallel.md). 사용자 보고로 **1.0.0(1) 내부 체크리스트 전부 통과**: 수동 위치·길찾기 E2E·Live Activity 공유 진행·기록 재실행 보존 포함. 아래 실기기 대기는 이 범위에서 해제한다. App Privacy 게시·심사 버전 빌드 선택/수출 규정 확인·심사 제출 완료를 의미하지 않는다.

2026-09-10 최우선 출시 후속: [RELEASE-CONNECT-FINAL-PARALLEL-01](work/integration-decision/release-connect-final-parallel.md). 사용자 가입·재로그인 확인, **자동 출시 재확정**. 가입 수정본 public Archive/IPA 검증 및 **1.0.0(1) 업로드 성공**. App Privacy 입력안은 정리했고 검색 기록·기기 ID 판정은 남아 있다. 아래 수동 출시·가입 연결 전 산출물 지시는 과거 이력이다. Connect 처리 완료·TestFlight 확인·개인정보 게시·심사 제출은 아직 아니다.

2026-09-09 최우선 결정: [DEC-RELEASE-MANUAL-LOCATION-01](work/integration-decision/release-manual-location.md). 출시 GPS 사용을 수동 검색·지도 선택으로 교체(승인·구현 전). UI/API/DB 확인 병렬 → 인계 반영·문서 마감 → QA. 기존 기록·버튼 체류 개인화·Live Activity·180분/2곳 유지. 과거 GPS 조회/권한/자동 초기화 지시는 철회 이력이다. 신고 제외·공개 승인 확정은 아니다.

2026-09-09 최신 수락: [DOCS-KAKAO-ROUTE-START-02](work/integration-decision/kakao-route-start-decision.md). 코스 길찾기 클릭의 공유 이동 시작·웹 복귀 유지 규칙과 사용자 ‘1번 확인 완료’를 중앙 문서에 반영했다. 아래 과거 handoff 성공 전 이동 미확정 조건은 철회 이력이다. 추천/학습/주변 경계는 불변, 전체 출시 완료나 업로드 승인은 아니다.

2026-09-09 최우선 출시 방식: [DEC-RELEASE-MANUAL-02](work/integration-decision/release-user-decisions.md) **수동 출시로 변경 확정**, 실제 Connect 저장 확인 대기. 위치 면제/유예는 미확정. U-CAPTURE 후속 로컬 빌드·암호화 반영 완료, 앱 화면6장 촬영은 남음. 기존 DOCS-08 후속과 사용자 촬영을 마감하며 과거 자동 출시를 복원하지 않는다.

2026-09-09 최신 후속: [위치 문의 대기 중 독립 산출물 마감](work/integration-decision/release-parallel-verification.md). 앞선 QA/API/촬영 준비 완료 재사용. API-RELEASE-ENCRYPTION-01, U-RELEASE-CAPTURE-PREP-01 후속 로컬 빌드·촬영, RELEASE-DOCS-08 후속 입력자료를 병렬 진행한다. 연령등급 사용자 완료 보고. 신고 답변 영향 부분만 후속 갱신하며 공개 게시·운영 쓰기·업로드·제출은 포함하지 않는다.

2026-09-09 현행: [RELEASE-PARALLEL-VERIFY-01](work/integration-decision/release-parallel-verification.md). DOCS-08 준비 완료 확인. QA 자동 게이트/최종 시나리오, API Kakao 플랫폼 필요성, UIUX 캡처 준비를 병렬 진행한다. 전체 테스트 단일 실행자는 QA. 제품/운영 변경·게시·업로드는 없음. 공급자 문의는 아직 미발송.

2026-09-09 현행: [RELEASE-DOCS-08](work/integration-decision/release-publication-handoff.md). DOCS-07 완료, 사용자 Connect 가격/국가/소개 본문 저장 보고와 영문 저작권 `2026 Dongheun Shin` 반영. 기존 고지 질문을 실제 문의문·게시 인계로 마감한다. 반복 조사 없음, 실제 게시·DB/UI 연결은 답변 반영/승인 뒤.

2026-09-09 현행 병렬: [RELEASE-DOCS-CONNECT-PARALLEL-01](work/integration-decision/release-docs-connect-parallel.md). DOCS-06 A/B 완료 재사용 → DOCS-07 로컬 문서 마감과 사용자 Connect 확정 metadata 입력 병렬. 앱 생성 완료는 사용자 보고(SKU jjaturi-ios), 공개 게시/DB·UI 링크/업로드는 아직 별도.

2026-09-09 현행: [RELEASE-NOTICE-CLOSEOUT-01](work/integration-decision/release-notice-closeout.md). DOCS-05-R1·ICON-01 로컬 완료 확인. DB/API 공급자 근거 확인과 DOCS-06 A 병렬 → 인계 후 문서 B 통합. 위치 답변은 최종 문안·게시 전 반영하며 답변 전 가능한 준비를 모두 진행한다. 외부 게시/운영 쓰기/스토어 업로드는 포함하지 않는다.

2026-09-09 최신 후속: [RELEASE-DOCS-ICON-CLOSEOUT-01](work/integration-decision/release-docs-icon-closeout.md). DOCS-05-R1은 미확정 아동 비로그인 허용 문구 제거·필수 고지 공백만 마감, U-RELEASE-ICON-01은 승인된 파란 시계 시안 적용. 두 작업 병렬, 게시/registry/업로드는 아직 별도.

2026-09-09 현행 실행: [RELEASE-STAGE-02](work/integration-decision/release-stage-two.md). DOCS-05와 U-RELEASE-AGE-01 병렬 → 게시 승인/실제 URL → 기존 LINKS-01 DB→UI. 1단계 확정값 재질문 없음, 실제 계정 삭제/스토어 제출 별도.

2026-09-09 최신: [RELEASE-USER-DECISIONS-01](work/integration-decision/release-user-decisions.md) **1단계 사용자 결정 완료**. 다음2단계 공개 문서 완성·게시·DB/UI 연결. Cloudflare Pages·여행/보조 생략·무료·책임자/문의·시행일/버전·심사 계정 준비 확정. 실제 게시/설정/가입 확인·아이콘 구현 완료와 구분한다.

2026-09-09 사용자 결정 갱신: [자동 출시·파란 시계 아이콘](work/integration-decision/release-user-decisions.md) 방향 확정. 공개 차단 발생 시 자동 공개 전 수동 전환·실제 설정 확인. Connect 변경/제출은 미실행, 원본 보존한 아이콘 시안 생성이며 제품 아이콘 적용 전.

2026-09-09 현재: DEPLOY-05 운영 배포 완료 수락(실제 탈퇴 E2E는 별도). [RELEASE-USER-DECISIONS-01](work/integration-decision/release-user-decisions.md) 진행: 만14세 이상 가입 자기확인 확정·구현 전, 나머지 공개/스토어 사용자 결정 대기. 아래 미배포/배포 승인 대기 표시는 과거 이력이다.

2026-09-09 승인 갱신: **DB-RELEASE-DELETE-DEPLOY-05 운영 배포 승인 완료**, [정확한 범위](work/integration-decision/release-delete-links-final.md) 참조. DB 세션은 사전 조건 확인 후 함수1개 배포·검증 재개. 아래 승인 대기는 과거 상태이며 실제 계정 삭제/문서 게시/스토어 제출 승인은 포함하지 않는다.

2026-09-09 최신: FIX-04·DOCS-04 완료 검토. 다음은 [DB-RELEASE-DELETE-DEPLOY-05](work/integration-decision/release-delete-links-final.md), 명시 승인 후 탈퇴 함수1개 운영 배포. 공개 문서 결정은 병렬, 실제 계정 삭제/게시/registry/업로드는 별도 승인.

[RELEASE-DELETE-LINKS-FINAL-01](work/integration-decision/release-delete-links-final.md) — 2026-09-09 현행 후속: DB-RELEASE-DELETE-FIX-04와 RELEASE-DOCS-04 병렬. 앞선 EXIT-03 구현 및 서명 절차 준비 완료를 재사용한다. 실제 게시/registry/함수 배포는 승인 후, 개인화 C 반복 없음.

[RELEASE-DEPLOY-PREP-01](work/integration-decision/release-deploy-preparation.md) — 2026-09-09 최신: NATIVE-02 로컬 완료, delete-account 미배포 확인. DB 배포 준비와 UI 종료 경로 보완→서명 준비를 병렬 진행. 실제 배포/계정 삭제/서명 자격 생성은 별도 승인.

## 최신 후속 — RELEASE-MINIMAL-FOLLOWUP-01

[최소 보완 명령](work/integration-decision/release-minimal-followup.md): 5개 준비 작업 인계 검토 후 NATIVE-02/DB-OPS-02/API-OPS-02 병렬. UI 다듬기·개인화 C 반복 없음. 실제 계정 삭제·배포·게시·제출은 별도 승인.

## 최우선 현행 — 출시 준비 실행

[RELEASE-EXECUTION-WAVE-01](work/integration-decision/release-execution-wave.md): 2026-09-08 UI 다듬기 종료. BUILD/DB/API/DATA/DOCS 준비 병렬 → 승인된 URL·가입 연결 → 최종 후보 QA. 위치 신고 문의 답변 대기. 아래 과거 ‘최신 실행’은 재실행 지시가 아니다. 원격 변경·게시·업로드·제출·공개는 별도 승인.

## 최우선 출시 마감 — 2026-09-08

[RELEASE-SUBMISSION-FINAL-01](work/integration-decision/release-submission-final.md): 기능 확장 마감 후 제출 감사·문서 사실 정리 착수. 현행은 최대180분/2곳·동의 기반 제한적 개인화·앱/LA 공유 진행과 완료다. U-LIVE-ACTIVITY-FINAL-02 사용자 실기기 확인 보고 접수. 아래 과거120분/개인화 보류/구현 전 표기는 최신 작업별 근거와 대조할 이력이며 현재 실행 지시가 아니다. 미확인 사항을 자동 완료로 바꾸지 않는다. QA-RELEASE-CANDIDATE-AUDIT-01과 RELEASE-DOCS-02는 병렬 가능. 게시/업로드/제출은 별도 승인.

> 이 파일은 새 세션·새 작업자가 가장 먼저 읽는 문서 색인이다. 과거 문서를 현행 사양으로 해석하지 않는다.

## 1. 현재 기준 문서

2026-09-08 최우선 시간 결정: [DEC-RELEASE-180-01](work/integration-decision/release-three-hour-two-stop.md). **최대3시간·최대2곳 확정, 구현/검증 전**. 아래 과거2시간 출시 상한은 교체 이력이다. 엔진/UI 전환과 API/DB 영향 확인 뒤 QA하며 기존 체류/호출 예산은 늘리지 않는다.

출시 마감 병렬 명령: 새 **출시 문서 전담 세션**은 [RELEASE-DOCS-01](05_release/release-document-session.md), 기존 DB 세션은 [DB-PERSONALIZATION-FINALIZE-01](work/db-personalization/personalization-finalization.md). 문서 세션은 공개 초안/스토어 준비, DB는 백업·적용·실제학습 마감만 담당한다. 개인화 제외는 미확정이며 게시/스토어 제출은 별도 승인이다.

2026-09-07 최신 출시 범위: [출시 개인화·계정 기록 결정](work/integration-decision/release-personalization-account.md). 제한적 체류 개인화를 출시 전 범위로 변경했으며 **구현/검증 전**이다. 회원 기록 격리·승인 기반 guest 방문 기록 가져오기·과거 guest 체류 학습 제외를 따른다. 기존 보류 기록은 이력으로만 해석한다.

| 목적 | 문서 | 상태 |
| --- | --- | --- |
| 추천 정책 단일 기준 | [03_product/추천로직.md](03_product/추천로직.md) | 현행 정책, 구현 전환 필요 |
| 역할별 현재 작업 | [work/README.md](work/README.md) | 새 세션의 짧은 역할 색인과 활성 작업 파일. 과거 작업기록 전체를 읽지 않는다. |
| 추천 엔진 작업 이력 | [work/recommendation-engine/archive/2026-08-history.md](work/recommendation-engine/archive/2026-08-history.md) | 수락·보완·fixture의 append-only 감사 이력 |
| 세션 간 작업 조정 | [작업조정_보드.md](작업조정_보드.md) | 역할 간 의존성·상태·활성 작업 파일 색인 |
| 추천 엔진 현행정책 감사 | [03_product/추천엔진_현행정책정합성_감사프롬프트.md](03_product/추천엔진_현행정책정합성_감사프롬프트.md) | 코드 전환 범위 확인용, 감사 전용 |
| 추천 엔진 점진 전환 지침 | [03_product/추천엔진_점진적전환_작업지침.md](03_product/추천엔진_점진적전환_작업지침.md) | 체감 검증용 v1부터 고도화하는 구현 순서 |
| 사용자 요구·검증 상태 | [테스트.md](테스트.md) | 현행 요구, 미검증 항목 있음 |
| 화면 공통 규칙 | [03_product/UIUX_공통규칙.md](03_product/UIUX_공통규칙.md) | 현행 규칙, 구현 전환 필요 |
| UIUX 작업 이력 | [work/uiux/archive/2026-08-history.md](work/uiux/archive/2026-08-history.md) | 화면·테스트의 append-only 감사 이력 |
| QA·출시 작업 이력 | [work/qa-release/archive/2026-08-history.md](work/qa-release/archive/2026-08-history.md) | 회귀 게이트·실기기 확인의 append-only 감사 이력 |
| 실기기 추천 검증 | [work/qa-release/real-device-recommendation.md](work/qa-release/real-device-recommendation.md) | 사용자가 직접 기록하는 실제 Route Proxy·추천 체감 시나리오 |
| 외부 API 작업 기준 | [work/external-api/archive/2026-08-history.md](work/external-api/archive/2026-08-history.md) | 서버 Route Proxy·구간 캐시·호출량 예산 계약 |
| DB·개인화 작업 기준 | [work/db-personalization/archive/2026-08-history.md](work/db-personalization/archive/2026-08-history.md) | 검증 코스 저장·RLS·개인정보 경계의 후속 작업 |
| 화면 흐름·와이어프레임 이력 | [03_product/UIUX_와이어프레임_계획.md](03_product/UIUX_와이어프레임_계획.md) | 과거 180분·1~3곳 이력, 현행 구현 기준 아님 |
| UIUX 수동·E2E 명세 | [03_product/UIUX_테스트명세.md](03_product/UIUX_테스트명세.md) | 현행 명세, 자동화 미착수 |
| DB 계약·마이그레이션 | [04_backend/데이터베이스설계.md](04_backend/데이터베이스설계.md) | 현행 DB 구조 기준 |
| iOS 출시 게이트 | [05_release/출시준비_체크리스트.md](05_release/출시준비_체크리스트.md) | 출시 전 갱신 |
| Live Activity 체류 측정 결정 | [work/integration-decision/live-activity-dwell-personalization.md](work/integration-decision/live-activity-dwell-personalization.md) | 제품 정책 확정·역할별 구현 전 |
| 코스 완료 기록 결정 | [work/integration-decision/course-completion-record.md](work/integration-decision/course-completion-record.md) | 로컬 repository 구현 완료·UI 연결 대기 |
| 현재 병렬 작업 Wave | [work/integration-decision/parallel-foundation-wave.md](work/integration-decision/parallel-foundation-wave.md) | DB 완료 기록·엔진 개인화·UI 시각 정리를 3개 소유 경계로 병렬 실행 |
| V1 진행 코스 이어가기 | [work/uiux/active-verified-course-resume.md](work/uiux/active-verified-course-resume.md) | 자동·비로그인 실기기 및 교체 확인 수락 |
| 진행 코스·인증 runtime guard | [work/uiux/runtime-course-auth-guard.md](work/uiux/runtime-course-auth-guard.md) | 구현 및 QA 자동·수동 게이트 수락 |
| runtime guard QA | [work/qa-release/runtime-course-auth-guard-validation.md](work/qa-release/runtime-course-auth-guard-validation.md) | 자동 fixture·제한 수동 확인 A·B 수락 |
| 완료 기록 UI 연결 | [work/uiux/course-completion-history.md](work/uiux/course-completion-history.md) | 선행 runtime QA 통과·실행 가능 |
| 출시 UIUX 통합 체크리스트 | [work/integration-decision/release-uiux-checklist.md](work/integration-decision/release-uiux-checklist.md) | 사용자 확정 UIUX의 완료·미완료·결정 필요 상태를 통합 검토 후 갱신 |
| 장소 상세·최적 코스 진행 결정 | [work/integration-decision/place-detail-and-optimized-course-flow.md](work/integration-decision/place-detail-and-optimized-course-flow.md) | 제품 흐름·완료 UI 시나리오 최종 승인·역할별 구현 작업 활성화 |

`구현 전환 필요`은 현재 코드가 문서 정책을 아직 모두 따르지 않는다는 뜻이다. 문서는 아래 확정 정책을 새 구현의 단독 기준으로 사용한다.

## 2. 데이터 근거

- [AI-Hub 카테고리별 체류시간 분포](02_data/AI허브_카테고리별_체류시간분포.md): 현재 체류시간 정책의 분포 근거
- [사용 중 장소 운영시간 감사](02_data/사용중_장소_운영시간_감사.md): TourAPI 실조회와 부산시 원천 대조 결과
- [데이터 정제 검증·재분류 실행 프롬프트](02_data/데이터정제_검증및재분류_실행프롬프트.md): 데이터 정제 세션의 필수 읽기 순서, 원천 조사, 재분류, 검증·인수인계 기준
- [장소 검증 최종 제한 실행 프롬프트](02_data/장소검증_최종_제한실행프롬프트.md): 출시 후보 직전의 무호출 우선·제한 수동 재확인 게이트. 지금 실행하는 작업이 아니다.
- [보류 발견 장소 재검증 실행 프롬프트](02_data/보류_발견장소_재검증_실행프롬프트.md): 짧은 방문이 가능한 자연·문화·거리 장소를 공식 문구 부재만으로 제외하지 않도록 하는 140개 보류군 재검토 기준.
- [AI-Hub 데이터셋 전수 카탈로그](02_data/AI허브_데이터셋_전수카탈로그.md), [TourAPI 카탈로그](02_data/TourAPI카탈로그.md): 원천 데이터 레퍼런스

## 3. 현재 확정 정책·구현 대기 항목

2026-09-02 공모전 출시 범위는 아래와 같다. 2026-08-31까지의 180분·1~3곳·다장소 continuation 정책은 코드와 이력으로 보존하지만 **배포 후 보류**이며, 출시 화면이나 새 구현의 기본값으로 해석하지 않는다. 2026-09-02 이후의 `다른 장소 더 보기`는 이와 별개인 one-stop 전용 continuation이다.

1. 출시 UI의 최대 입력 시간은 현재 시각부터 `2시간(120분)`이다. 121분 이상은 입력 경계에서 차단한다.
2. 출시 기본 자동 추천은 실제 경로·구조화 운영시간·최소 20분·도착 여유를 통과한 **한 장소**만 계산한다. 첫 결과는 대표 `1개`와 서로 다른 검증된 1곳 대안 최대 `3개`를 목표로 하지만 검증 결과가 적으면 수를 부풀리지 않는다. 미검증 single 후보가 남으면 `다른 장소 더 보기`로 다음 실제 검증 결과를 최대 3개씩 기존 목록 뒤에 누적하며 화면 총량에는 별도 고정 상한을 두지 않는다. 과거 mixed 2·3곳 자동 조립과 candidate-to-candidate queue는 계속 사용하지 않는다. 사용자가 검증 A에서 명시적으로 시작하는 pair-only 2곳만 아래 8번의 별도 계약과 QA 게이트를 따른다.
3. 첫 계산과 사용자의 더보기 한 번은 각각 신규 provider attempt 최대 8회다. 첫 계산의 자동 8→16회 보충이나 자동 연속 페이지 호출은 하지 않는다. cache/session 재사용은 새 attempt가 아니며, 후보 소진·provider 한도·실경로 실패 때 목표 개수를 채우려고 추가 호출하거나 조건부 후보를 승격하지 않는다.
4. 결과 카드·장소 정보 상세 B·진행(active) 화면은 체류 분을 표시하지 않는다. 최종 코스 확인(review) 상세에서만 검증 snapshot의 선택 체류를 `둘러보기 약 N분`, short이면 `가볍게 둘러보기 약 N분`으로 표시한다. 최소·최대·범위·조절기는 비노출이며 체류를 자동 연장하지 않는다. 전체 코스 시간과 구간 이동 분은 유지한다.
5. `운영시간 확인 후 들러볼 곳`은 자동 대표·검증 대안과 다른 정보 확인 영역이다. 구조화 운영시간이 없는 조건부 시장·거리·골목은 기기의 실제 현재 시각 `10:00 ≤ t < 18:00`에서만 표시하고, 사용자가 카카오맵을 확인한 뒤 명시적으로 계산한 경우에만 별도의 조건부 수동 코스로 검증한다.
6. TimeFit의 사용자 가치는 다음 일정 전 계획 밖의 부산 장소를 발견할 기회다. 시간·운영시간·실제 경로 조건이 같은 후보 사이에서만 앱 완료 기록 기반의 지역·활동 발견성을 보조 순위로 사용한다. 소비·관광 활성, GPS 방문·외부 소비 이력, 근거 없는 첫 방문·인기도는 추천 근거나 사용자 약속으로 쓰지 않는다.
7. 장소는 단일 승인 등급이 아니라 장소 동일성·범위·활동/체류 근거·이용 가능성·이용 부담·근거 이력으로 재분류한다. 자동 대표 추천은 `representative_core / representative_standard`, 운영시간 미확인은 `conditional_more`, 근거 부족·중복·예약 필수 등은 `hold`로 처리한다.
8. `DEC-TWO-STOP-SELECTION-01`은 Results의 실제 검증 one-stop A를 사용자가 카드로 명시 선택할 때만 최대 2곳 제한 조립을 시작하는 기능이다. 엔진의 기본 B 3개 목표·누적 6개, 두 방문 순서 exact 비교, session 신규 route attempt 최대 36, A 취소 원상 복원은 자동 확인됐다. `2-Z`와 `U-TWO-STOP-03`은 검증 one-stop leg 재사용과 동일 Results/ScrollView 전환까지 자동 수락됐다. 같은 세션의 순서 없는 exact pair 역선택 0-call은 `2-AA → U-TWO-STOP-04`로 연결했고, terminal partial 비저장과 B의 A 대비 추가시간 표시까지 보완해 자동 수락했다. 다음은 `QA-TWO-STOP-02` 고정 fixture 게이트다. 새 세션의 미검증 pair를 모두 첫 3개에 보장하는 요구로 확대하지 않는다. 자유 장바구니·3곳·순서 편집은 재활성화하지 않는다.
9. `DEC-LIVE-DWELL-01`은 카카오 길찾기 handoff 성공 뒤 iOS 17 Live Activity와 로컬 알림으로 사용자의 명시적 도착·출발을 받는다. 예상 이동시간에 `20%`, 최소 3분·최대 10분 유예를 둔 뒤 도착을 묻고, 최종 도착/복귀 시각에서 사용자 여유·남은 검증 snapshot 이동·이후 계획 체류를 뺀 안전 출발시각 5분 전에 알린다. GPS·백그라운드 위치·원격 ActivityKit push는 이번 출시에서 사용하지 않는다. 일반 로그인과 별도 동의를 모두 만족한 완료 표본만 서버에 저장하며, 같은 `category + subCategory`의 유효 표본 3개부터 최근 최대 5개 중앙값을 제한적으로 적용한다. 최소 지원 버전은 iOS 17.0으로 전환한다. 상태: **정책 확정·구현 전**.
10. `DEC-COMPLETION-RECORD-01`은 진행 화면의 명시 `코스 마치기`를 후기와 분리된 완료 근거로 사용한다. 비로그인도 로컬 완료 이력을 가질 수 있고 같은 `courseRunId`는 한 번만 기록한다. 실제 체류 미확인은 장소/카테고리 완료에는 포함하지만 활동 시간과 개인화에는 사용하지 않는다. 활성 진행 App Group, 서버 체류 표본, 로그인 코스 저장은 서로 다른 저장 경계다. DB repository, `U-COMPLETION-HISTORY-01` 기본 화면 연결과 `QA-COMPLETION-HISTORY-01` 제한 검증까지 수락됐다.
11. `DEC-PLACE-COURSE-FLOW-01`은 추천 카드 tap과 장소 선택을 분리한다. tap은 현재 위치·설정 출발지·장소와 근거 있는 상세를 전체 지도형 화면에서 확인하고, 명시 `선택하기`만 같은 Results의 A/B 선택 상태를 갱신한다. 최종 2곳 방문 순서는 선택 순서가 아니라 exact 비교로 최적화하며, 코스 검토와 진행은 동일 snapshot의 한 화면 상태로 운영한다. 현재 다음 구간만 카카오 길찾기를 활성화한다. 상태: **제품 흐름·완료 UI 시나리오 최종 승인·역할별 구현 작업 활성화**.

## 4. 보관 문서

- [archive/product-history](archive/product-history/README.md): 이미 대체된 UI·추천 전환·구현 기록. 현재 사양이 아니다.
- [archive/product-plans](archive/product-plans/README.md): 초기 기획·기술 선택·다중 장바구니 계획. 현재 사양이 아니다.

## 5. 세션 시작 체크리스트

1. 이 파일과 저장소 루트의 `AGENTS.md`를 읽는다.
2. [작업 조정 보드](작업조정_보드.md)에서 자기 역할의 현재 작업 ID와 상세 현재 작업 묶음 링크를 확인한다.
3. 작업 대상의 기준 문서와 `docs/테스트.md` 요구사항 ID를 확인한다.
4. 현재 확정 정책과 충돌하면 구현을 시작하지 않고, 결정 트리에 기록할 질문으로 되돌린다.
5. 외부 API는 fixture·어댑터 경계로 검증하고, 실제 API 검증은 호출량을 기록한 소수 시나리오로 제한한다.

## 6. 역할별 최소 읽기 범위

세션은 필요한 문서와 파일만 읽는다. 과거 이력 전체를 다시 읽는 방식은 금지한다.

| 역할 | 시작 시 추가로 읽을 문서 | 주 소유 경로 | 완료 인수인계 |
| --- | --- | --- | --- |
| 통합·결정 | `work/integration-decision/README.md`, `추천로직.md`, `테스트.md` | 기준 문서 | 결정 ID, 충돌 여부, 다음 구현 범위 |
| 데이터 정제 | `work/data-curation/README.md`, `02_data` 근거 문서, `추천로직.md`의 데이터 절 | `data/`, `scripts/build_*`, `src/data/` | 입력·출력 파일, 데이터 수, 제외 근거 |
| 추천 엔진 | `work/recommendation-engine/README.md`, `추천로직.md`, 해당 단위 테스트 | `src/engine/`, 순수 테스트 | 입출력 계약, fixture, 회귀 시나리오 |
| API 어댑터 | `work/external-api/README.md`, API 관련 계약·호출량 기록 | adapter/cache, 계약 테스트 | 캐시 키·TTL, 실패 폴백, 실제 호출 수 |
| UIUX | `work/uiux/README.md`, `UIUX_공통규칙.md`, `UIUX_테스트명세.md` | `src/ui/`, UI 테스트 | 화면 전환, 접근성, 수동 확인 항목 |
| DB·개인화 | `work/db-personalization/README.md`, `데이터베이스설계.md` | migration/repository/RLS 테스트 | migration ID, RLS 결과, payload 호환성 |
| QA·출시 | `work/qa-release/README.md`, `테스트.md`, `UIUX_테스트명세.md` | `test/`, fixture, E2E, 출시 문서 | 시나리오 ID, fixture, 캡처/로그, 잔여 위험 |

공통 인수인계 형식은 `변경 파일 / 유지한 계약 / 테스트 결과 / 다음 결정` 네 항목이다. 단일 작성자 파일 목록과 역할 경계는 루트 `AGENTS.md`를 따른다.

### 작업 명령 작성 표준

통합·결정 세션은 각 활성 작업 문서를 아래 순서로 작성한다. 작업자는 제목만 보고 추정하거나 과거 archive 전체를 읽지 않는다.

1. **목적과 사용자 관찰:** 무엇을 만들려는지, 현재 어떤 입력·화면·로그에서 문제가 관찰됐는지, 성공하면 사용자가 무엇을 다르게 보게 되는지 적는다.
2. **현재 원인과 근거:** 확정된 사실, 아직 추정인 부분, 재현 조건을 구분한다. 원인이 미확정이면 바로 수정하라고 하지 않고 먼저 판별 fixture와 판정 분기를 지시한다.
3. **현행 계약과 이력:** 이전 방식 → 문제 → 교체 방식 → 교체 이유 → 상태(현행/구현 전/배포 후 보류/철회)를 적고 관련 요구사항 ID와 기준 문서를 연결한다.
4. **구현 순서:** 변경할 공개 entry·타입·상태 전이·UI 행동을 호출 순서대로 명시한다. 입력, 출력, 부수효과, cache/재시도/호출량 상한, 실패·빈 결과·중복 행동을 포함한다.
5. **불변·수정 금지 경계:** 다른 역할의 파일, 기존 공개 계약, 보안·개인정보, 카탈로그 수·API provider처럼 이번 작업이 바꾸지 않는 것을 구체적으로 적는다.
6. **필수 반례 fixture:** 정상 1개뿐 아니라 시간 경계, 0개 결과, 외부 실패, 중복 탭, stale 응답, cache hit, 권한 거절 등 이번 변경에서 실제로 발생 가능한 핵심 반례를 공개 entry 실행으로 고정한다.
7. **검증 명령과 합격값:** 실행할 명령, 예상 테스트 수 또는 관찰값, 실제 API/DB/GPS 호출 허용 횟수, 실패 시 중단 조건을 적는다. 문자열 존재 검사만으로 동작 완료를 판정하지 않는다.
8. **완료 인수인계:** 변경 파일과 목적 / 유지한 계약 / 실행 결과 / 남은 위험·사용자 결정·다음 담당 작업을 기록한다. 완료 기준을 충족하지 못하면 `완료`라고 쓰지 않고 정확한 미충족 항목을 남긴다.

하나의 작업에서 구현 전 확인할 수 있는 핵심 반례는 같은 문서에 포함한다. 다만 계정 승인·원격 배포·실기기처럼 해당 역할이 통제할 수 없는 활성화 게이트는 별도 작업으로 분리한다. 작업명이 `-R`, `-R2`처럼 계속 늘어나는 경우에는 새 이름을 만들기 전에 원래 활성 작업 문서의 누락된 완료 기준으로 흡수한다.

## 7. 현재 작업·이력 분리 원칙

- 여러 역할이 함께 봐야 하는 현재 상태·선행 조건은 [작업 조정 보드](작업조정_보드.md)에 짧게 기록한다.
- 새 세션의 상세 지시는 `work/<role>/README.md`와 그 README가 링크한 **활성 작업 묶음 파일**에만 둔다. 현재 작업과 무관한 역할 archive 전체 읽기는 금지한다.
- 역할별 `work/<role>/archive/`는 완료 이력·수락 근거·감사를 위한 append-only 보관소다. 완료 시 네 항목(변경 파일 / 유지 계약 / 테스트 / 다음 결정)을 요약해 남기되, 다음 작업의 상세 명령을 계속 누적하지 않는다. 실행에 필요한 현재 규칙은 별도 작업 묶음으로 짧게 정리한다.
- 하나의 파일은 같은 목표·공개 계약·선행 조건을 공유하는 작업 묶음만 다룬다. 독립 목표는 같은 역할이라도 새 묶음 파일로 분리한다.
