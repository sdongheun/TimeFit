# DB·개인화 현재 작업

2026-09-14 [DB-UNUSED-COURSE-REPOSITORY-REMOVE-01](unused-course-repository-removal-01.md): 미연결 courseRepository1개 제거·현재 완료/owner/guest37건 전후 PASS·부재 gate2 PASS·typecheck PASS. 테이블/기존 데이터/nav 불변. UI/QA 혼합 테스트 잔여 참조는 케이스별 인계했으며 전체 회귀 수락은 아직 아님.

2026-09-09 [DB-SIGNUP-FAILURE-01 repository 완료·API/UI 인계](signup-failure.md): transient captchaToken 전달/누락 Auth0 및 allowlist code·HTTP·registry/auth stage 계약. 집중20/typecheck/UI777(기존skip1)/core465 PASS. 실제 가입·메일·운영변경0. API의 Auth options/오류 정제 및 UI fresh CAPTCHA/failure 소비는 후속이며 end-to-end 완료 아님.

2026-09-09 **DEPLOY-05 운영 배포 승인 완료**: 통합 대화의 사용자 “승인한다”를 [명령의 승인 경계](../integration-decision/release-delete-links-final.md)에 기록했다. 함수1개·사후 검증·조건부 제거만 승인. 동일 승인 재질문 없이 원격 사전 조건 확인부터 재개하며 실제 계정 삭제 테스트는 제외한다. 배포 결과는 아직 미확인이다.

## 현행 후속 — DB-RELEASE-DELETE-DEPLOY-05

2026-09-09 [DEPLOY-05 운영 배포·사후 검증 완료](release-facts-final.md#12-db-release-delete-deploy-05--운영-배포사후-검증-완료-2026-09-09): 승인된 함수1개 배포1회, ACTIVE/v1/verify_jwt=true, 소스·실제 dependency 대조 및 무인증401 PASS. 실제 계정 탈퇴 테스트 미실행·별도 승인. CLI lock 비업로드 한계는 상세12절C 참고.

[함수1개 배포 명령](../integration-decision/release-delete-links-final.md)의 DEPLOY-05를 따른다. FIX-04 로컬 보완은 통합 수락. 명시 승인 후 delete-account만 배포·무인증 거절 확인, 실제 계정 삭제/개인화 C는 제외한다. 아래 FIX-04는 완료 이력이며 재실행하지 않는다.

## 현행 후속 — DB-RELEASE-DELETE-FIX-04

2026-09-09 [FIX-04 로컬 완료·최신 배포 hash](release-facts-final.md#10-db-release-delete-fix-04--sdk시작실패-전달-보완-완료-2026-09-09): SDK2.109.0 exact/frozen lock·Deno 실제 entry 시작1 PASS·실패 전달 focused35 PASS·typecheck/UI/core PASS. 운영 미배포, 함수1개 배포와 전용 탈퇴1회는 별도 승인. §9의 과거 소스 hash 대신 §10 사용.

[탈퇴 최소 보완 명령](../integration-decision/release-delete-links-final.md)의 DB 절을 진행한다. DELETE-PREP-03 완료 조사에 따라 함수 SDK 고정/시작 검증과 탈퇴 실패 전달만 보완. 운영 배포/계정 삭제/C 반복 금지.

## 최신 — DB-RELEASE-DELETE-PREP-03

[배포 준비 명령](../integration-decision/release-deploy-preparation.md)의 해당 절 진행. OPS-02에서 확인한 delete-account 미배포의 함수1개 배포 승인 묶음 준비. 운영 배포·계정 삭제·C 재실행 금지.

## 최신 — DB-RELEASE-OPS-02

[최소 보완 명령](../integration-decision/release-minimal-followup.md)의 해당 절 진행. 읽기 전용 운영 메타데이터 및 전용 계정 탈퇴1회 승인 계획. 실제 삭제/쓰기/C 재실행 금지.

## 최우선 — DB-RELEASE-FACTS-01

[출시 실행 명령](../integration-decision/release-execution-wave.md)의 해당 절 실행. 저장/삭제/region·보관/registry 사실 확인, 운영 변경0. 개인화 C 재실행 금지. LINKS-01 원격 쓰기는 별도 승인 후.

2026-09-08 [최종 DB 사실 확인 인수인계](release-facts-final.md): fixture42 PASS, 현재 linked region ap-northeast-2 확인. 저장/삭제·180일 유효성 대 물리 purge·가입 registry 적용/롤백 준비 기록. plan/로그·백업 retention·scheduler/삭제 Edge 실제 운용 및 registry 현행값은 미확인으로 분리. 운영 변경/C 재실행0.

## 2026-09-08 진행 — DB-COURSE-DATE-01

[날짜 포함 시작시각 보존 계약](course-date-preservation.md): UIUX 타입 인계 후 **repository 구현 완료**, 신규6개 회귀·typecheck PASS. CourseDateError export 연결 및 QA 날짜 없는 기존 성공 fixture 보완 대기(전체 UI2건/기본 wrapper 포함3건 FAIL). 전체 완료와 구분한다. 날짜 추정·기존 기록 삭제·migration·운영 쓰기0.

## 2026-09-08 완료 — DB-RELEASE-180-CHECK

[최대180분·2곳 저장 계약 영향 확인](release-three-hour-impact.md): DB 읽기 전용 감사 완료. 저장/RPC의180분·익일 차단 제약 없음, 제품·migration 변경0. 기존43개 회귀 PASS 근거와 legacy 코스 저장의 날짜 전달 위험을 기록했다. UI 신규 snapshot180분 검증과 전체 QA 수락은 구분한다.

## 2026-09-08 최우선 — DB-GUEST-IMPORT-01

[로그인 후 비로그인 기록 가져오기 실패](guest-import-release-fix.md)를 진단하고 DB 소유 경계에서 확인된 최소 수정만 진행한다. 017 운영 적용·개인화 C 저장/조회/추천/제한 정리는 완료됐다. 아래 백업·적용·C 대기 문구는 과거 이력이며 재실행하지 않는다. UI 원인은 계약과 재현 근거를 통합에 반환한다.

최신 승인: 사용자가 macOS 숨김 로컬 비밀번호 입력 방식을 승인했다. `personalization-finalization.md`의 A 백업을 이어가며 동일 동의 재질문0. 실제 로컬 입력/OS 권한은 필요하며 백업 완료·원격 적용 승인으로 혼동하지 않는다.

## 마감 우선 — DB-PERSONALIZATION-FINALIZE-01

[남은 개인화 마감](personalization-finalization.md)을 따른다. 기존 readiness5절 기술 보완 PASS 유지, 백업→최종 승인/015·016 적용→실제 서버 학습 검증 세 묶음만 마감한다. 출시 문서 세션과 파일 경계 내 병렬. 기능 제외/원격적용/테스트 쓰기를 포괄 승인한 것으로 해석하지 않는다.

## 최우선 — DB-RELEASE-BACKUP-READINESS-01

[보호 백업·최종 적용 준비](release-backup-apply-readiness.md)를 수행한다. 사용자 새 백업 생성/격리 복원 검증 및 문서 준비 전 신규 가입 일시 차단 수락. MAINTAIN·CLI timeout 로컬 보완 포함. 보호 위치/암호화 수단을 먼저 제시하고 안전한 키 입력이 필요하면 해당 단계만 요청한다. 실제 migration push·운영 복원은 아직 승인되지 않았다. 아래 APPLY 최종 승인 대기는 유지한다.

## 최신 실행 — APPLY-01 R1

[release-personalization-migration-apply.md 7절](release-personalization-migration-apply.md#7-보완-후-적용-재개-명령--db-release-personalization-apply-01-r1)을 실행한다. COMPAT 8절의 삭제 선택 후 로컬 보완 결과 검토 완료. 아래 나이 답변 대기/충돌 보완 반복은 과거 이력이다. 현재는 실제 서버 topology/ACL·백업·가입 영향·dry-run 확인 → 최종 사용자 적용 승인 →015/016 적용 → QA C 순서. 준비 단계에서 push 금지.

## 최우선 보완 — DB-RELEASE-MIGRATION-COMPAT-01

[015 업그레이드 충돌 보완](release-migration-compatibility.md)을 로컬에서 진행한다. 기존 데이터 guard 충돌·이메일 인증 호환·잔여 권한을 검증한다. 나이 기존 값 처리는 사용자 답변 뒤 분기 확정; 다른 보완은 진행 가능. 아래 APPLY는 보완 수락·복구 준비·적용 승인 전 중단 유지. 원격 쓰기0.

## 현재 우선 — 보존 서버 migration 적용 준비

[DB-RELEASE-PERSONALIZATION-APPLY-01](release-personalization-migration-apply.md)을 수행한다. 현재 서버 015/016 미반영 확인 뒤 적용 전 영향·백업·로컬 검증 → 사용자 적용 승인 → 정확한 두 migration 적용/사후 확인 순서다. 기존 나이 값 삭제와 가입 trigger/RLS 영향은 별도 확인한다. 초기화·무승인 서버 쓰기 금지. 아래 구현 작업은 완료 이력이며 반복하지 않는다.

## 2026-09-07 최신 작업

**최신 실행: [DB-LIVE-LEARNING-EVIDENCE-01 — 로컬 학습 증거 계약·구현](live-learning-evidence-contract.md).** 사용자 증거 정책 확정 뒤 첫 작업이다. 정확한 공개 계약을 기록하고 동일 세션에서 서비스·fixture까지 구현한다. 아래 공유 잠금/cold 조회 보완은 수락된 선행 이력이며 반복하지 않는다. UI/native는 수정하지 않는다.

최신: [공유 잠금과 cold 소유권 조회 보완](release-identity-personalization.md)을 지금 실행한다. 이전 세 보완 수락은 유지한다. B 실제 연결에서 발견된 두 공백만 닫으며 Live Activity 증거 계약은 별도 병렬 조사 후 인계받는다.

**현행: 세 보완 통합 수락 완료·DB 재작업 불필요. UIUX B 연결로 인계한다.** [수락 기록](../integration-decision/release-personalization-wave.md#db-세-보완-통합-수락--2026-09-07). 아래 최우선 실행 문구는 보완 전 이력이다. 원격 적용은 승인하지 않았다.

최우선 갱신: [release-identity-personalization.md](release-identity-personalization.md) 맨 위 **“최우선 보완 — 완료 응답·표본 재등록·인증 오류”**를 실행한다. 기존 소유권 구현은 유지하며 세 가지 실패 fixture와 실제 adapter 연결을 보완한다. 아래 기기 소유권 명령은 이전 단계 이력이며 전체 재작업하지 않는다.

최우선: release-identity-personalization.md 맨 위 **“최신 수락 전 보완 — 기기 소유권·진행 적격성 연결”**을 지금 실행한다. B 서버 구현 재작성 아님. UI가 제기한 local namespace/source 조회/cold eligibility/완료 적재 composition 누락을 닫는다.

최신 후속: [DB-RELEASE-IDENTITY-01 B 실행 승인](release-identity-personalization.md)은 **확정 범위 지금 구현 가능**. A 당시 잠금보다 최신 B 승인 절을 우선한다. 기술 계약 공백은 조기 인계, DB-DWELL은 같은 writer 순차, 원격 미승인.

[DB-RELEASE-IDENTITY-01](release-identity-personalization.md): **A 계약 지금 실행 가능**. A 통합 수락 뒤 B 계정/기록 격리 → 기존 DB-DWELL-01 순차. 과거 profile 계약의 나이 필수 입력은 철회, 새로운 public entry를 UI가 추정하지 않는다.

- [DB-PROFILE-ACCOUNT-01](profile-account-contract.md): 닉네임·가입 동의·계정 삭제 계약 조사/설계. 코드·원격 적용 전, 통합 승인 후 구현 명령 발행.

새 작업 전에는 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/04_backend/데이터베이스설계.md`와 해당 현재 묶음만 읽는다.

- [DB-COMPLETION-RECORD-01 — 후기와 분리한 로컬 코스 완료 기록](course-completion-record.md): **구현 완료·자동 게이트 통과.** 명시 `코스 마치기`의 멱등 로컬 완료 repository와 legacy 후기 호환 read model을 구현했고 집중 13/13 및 Foundation 자동 게이트를 통과했다. 다음 UI consumer는 `U-COMPLETION-HISTORY-01`이며 App Group 복구와 서버 체류 표본은 후속이다. Supabase migration은 추가하지 않았다.
- [DB-1 — V1 검증 코스 저장 계약](verified-course-storage.md)
- [DB-DWELL-01 — 사용자 확인 체류 표본·동의·개인화 프로필 저장](live-activity-dwell-storage.md): **진행 예정.** 일반 로그인+별도 동의+명시 도착/출발 완료만 저장하며 GPS·anonymous Auth·미완료 표본은 제외한다. `2-AB`와 병렬 가능하고 원격 migration 적용은 별도 게이트다.
- [DB-ROUTE-GEOMETRY-01 — 공개 구간 형상 캐시 보존](route-geometry-cache.md): **운영 적용 완료·수락.** `202609030014`가 local/remote migration 이력에 모두 존재하며 전체 이력이 일치함을 통합 세션이 재확인했다. private 위치 저장·cache 삭제·Kakao 호출은 수행하지 않았다.

- [Route cache·익명 보관 경계](route-cache-and-privacy.md)

B12 internal 비교는 DB schema·RLS·저장 payload를 변경하지 않는다.

과거 세부 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다.
