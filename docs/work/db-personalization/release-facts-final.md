# DB-RELEASE-FACTS-01 — 출시 저장·삭제·보관·가입 연결 사실

## RELEASE-LINKS-01 / DB-RELEASE-DOCS-LINK-01 — 2026-09-09 사전 점검

**현행 완료:** 사용자 “승인” 후21:39:33 KST 두 문서1.0을 transaction1회로 등록·활성화했다. 정확한2행 active=true, 공개 anon RPC의 ID/version/URL2건 일치, 과거 동의0→0·RPC ACL 보존 PASS. [실행 결과·UI 인계](release-docs-link.md#5-사용자-승인실제-운영-적용-완료). 계정/기록/개인화C 조작0, 실제 UI/가입 시험은 별도다. 아래는 사전 점검 이력이다.

[정확한 변경·복구·UI 계약](release-docs-link.md). 21:27 KST 운영 registry0행·과거 동의 연결0건, 공개 privacy/terms1.0 HTTP200 및 게시hash 일치. 신규2행 원자적 활성화 승인 대기이며 운영 쓰기0. 기존 계정·기록 보존. 실제 적용/공개 RPC 사후검증은 아직 미실행이다.

2026-09-08. **읽기 전용 코드/기존 수락 증거 확인·fixture 완료. 운영 메타데이터 일부 확인, 공개 문서 확정 조건은 남음.** 기준: [출시 실행 명령](../integration-decision/release-execution-wave.md), [출시 후보 감사](../qa-release/release-candidate-audit.md). 법적 판단·서비스 전체 출시 수락이 아니다.

## 1. 기존 수락·이번 확인 범위

- `personalization-finalization.md`의 최신015/016 적용 및017 단독 적용·사후 보존 PASS, C 저장/동일 owner 조회/추천 체류 반영/정확한 테스트 데이터 정리 PASS를 재사용했다. 과거 미적용·C 보류 기록을 현행으로 복원하지 않는다. C 재실행0.
- `guest-import-release-fix.md`의09-08 02:48 사용자 실기기 계정 기록 표시 성공을 유지한다. 사용자 재가져오기·초기화 요청0. 단일 화면을 모든 서버 중복/물리 정리 증거로 확대하지 않는다.
- 소스와 migration은 현재 공유 트리 기준이다. 과거 `release-data-audit.md`의 나이 수집/계정 삭제 부재/개인화 보류는015~017 및 후속 구현 전 이력이다. 현재 사실표로 대체해 인계하되 과거 문서를 삭제하지 않았다.
- 이번 원격 접근은 기존 CLI 인증의 **연결 프로젝트 설정 메타데이터 조회1회 성공**뿐이다. 첫 sandbox 시도는 npm registry DNS 실패로 Supabase 결과를 얻지 못했고 권한 승인 실행으로 조회했다. 운영 사용자 행·Auth 세션/토큰·좌표 조회0. 데이터 조회라는 이름이지만 purge 쓰기가 있는 `read_dwell_personalization_samples`는 호출하지 않았다.

## 2. 실제 저장 경로·목적·필드·보유

모든 소스 경로는 저장소 루트 기준이다. ‘자동 만료’는 ‘해당 시각에 저장매체에서 물리 삭제됨’과 다르다.

| 데이터·목적 | 실제 연결/소유 관계·저장 위치 | 삭제·보관 사실 / 근거 |
| --- | --- | --- |
| 계정 인증 | `src/services/supabase.ts`의 Supabase Auth, SDK session은 AsyncStorage 지속·자동갱신. 이메일/비밀번호는 정상 인증으로 전송; 앱이 비밀번호를 자체 저장하는 코드 없음 | 로그아웃은 인증 종료이며 서버 계정/기록 삭제가 아님. 관리형 Auth 로그/백업 보유는 아래 미확인 |
| 프로필·가입 동의 | `accountRegistrationRepository.ts`, `accountProfileRepository.ts`, `releaseIdentitySupabase.ts`,015. 회원 ID 연결. 선택 닉네임1~20자·중복 허용. 문서 ID/version·요청 ID·수락시각 저장 | 나이 수집 제거 및 기존 나이값 삭제의015 수락 유지. profiles/account_consent_records는 Auth 삭제 cascade. 현재 닉네임·동의를 과거 나이/자동 동의 정책으로 설명하지 않음 |
| 일반 회원의 저장 코스 | `courseRepository.ts` create/replace. `courses`에 출발·목적지 label/좌표, 시작/종료 timestamp, 이동/체류/여유 분, 추천 snapshot. `course_stops`에 장소명·분류·좌표·계획체류, legs에 이동 분/출처/요약. user_id owner |003/015 RLS로 본인 일반 회원만. 코스 삭제/탈퇴 cascade. 정기 TTL 없음. 전체 완료기록 삭제와 저장 코스 삭제는 별도 경계 |
| 해당 좌표 저장의 실제 도달성 | 공개 신규 V1 `TimeSetup→Results→CourseConfirm`은 이 legacy save를 직접 호출하지 않음. 그러나 `MyCourses→Execution→LegacyResults→AppFlowContext.save/replace→courseRepository` 호환 경로가 존재함 | 따라서 ‘좌표를 서버에 저장하지 않는다’는 전면 문구는 부정확. 코드 존재만으로 모든 신규 추천이 좌표 저장된다고도 쓰지 않음. `release-three-hour-validation.md`/`course-date-preservation.md` 실제 연결 fixture 근거 |
| 기기 완료 기록 | `courseCompletionRepository.ts`, `releaseIdentityPersonalizationRuntime.ts`: 완료ID/runID, 완료 epoch ms,1~2곳 ID·이름·분류·계획체류/측정된 실제체류(없으면null). guest device scope 또는 account owner별 AsyncStorage | 좌표/원시 GPS/후기 민감필드 미포함. 기본 최신1000건 상한, 기간 TTL 없음. 상한 정리는 새 저장 시. 같은 run 멱등. 소유자별 삭제/가져오기 accepted 정리. 로그아웃·다른 계정에서 섞이지 않도록 분리하며 로컬 보유와 화면 비노출을 구분 |
| 서버 계정 완료 | `accountCourseCompletionRepository.ts`→015 `write_account_course_completion`: 완료ID/runID, 완료 epoch minute, generation, 장소 ordinal/ID/이름/분류. 계정 owner·provenance | 좌표·원시 도착/출발·실제체류 payload 없음. 개별/전체 기록 삭제 또는 탈퇴, 별도 기간 TTL 없음. tombstone/generation/mutation으로 삭제된 offline 요청 재등록 방지 |
| guest 가져오기 | 공개 approve/continue→repository→015 import. guest/허용 legacy를 사용자 명시 승인으로 계정 방문기록에 이관. pending은 동일 대상/items/요청ID 보관 | 서버 accepted source만 로컬에서 정리, rejected/응답불명 source 보존. 원래 pending 멱등 및 제한 구형ID 복구. 과거 guest 체류를 학습으로 승격하지 않음. import/claim 감사·멱등 행은 Auth cascade; 별도 기간 purge 없음 |
| 학습 표본·집계 | `dwellPersonalizationRepository.ts`→016 submit: 계정, event/run/장소ID, ordinal, category/subCategory, 실제 체류 정수분, 완료 분, 동의 epoch/revision/hash. owner·명시 동의·학습 적격성 필요 | 좌표/사진/원시 도착·출발시각을 서버 표본에 저장하지 않음. 최근180일이 유효 범위. 표본 조회 RPC가 **해당 owner 만료행 DELETE**하며 별도 service-role purge 함수 존재. 정기 scheduler 실제 운용은 미확인 → ‘180일 후 모두 자동 물리 삭제’라고 쓰지 않음 |
| 기기 학습 outbox | `dwellPersonalizationOutbox.ts`: 위 최소 payload+queuedAt, owner/동의 분리 |7일/최대32건. enqueue/read 등의 접근에서 정리, ack 시 제거. 만료/상한 탈락 표본은 runtime 상태로 재생성 방지. 앱 미실행 동안 정확히7일에 파일 삭제를 보장하는 OS scheduler 아님 |
| 진행 snapshot·로컬 학습 증거 | `activeVerifiedCourseStorage.ts`, `ui/liveActivity/localProgressModel.ts`, `services/liveLearningEvidence*.ts`: 선택 코스·session에 출발/목적지/장소 좌표가 포함될 수 있으며 기기 진행/증거에 도착·출발 epoch와 run/action 식별자 보관 | 완료/취소/소유권 변경의 닫기·purge와 복구 정리. 서버 완료/표본과 다른 로컬 경계. UI/native의 App Group 제거·OS 백업 포함 여부는 빌드 담당 최종 산출물 확인 필요. 모든 잔존의 고정 시간 TTL은 확인 못함 |
| 익명 Auth |012+`supabase/functions/anonymous-auth-cleanup`: authorization용 익명 사용자, 일반 회원 profile 생성 제외 |30일 inactivity 후보·연결 데이터/identity/최근 session 재검사 후 Admin 삭제 계약. 일별 실행·집계 audit 존재. 실제 scheduler 배포/최근 성공 미확인 → ‘30일 정각 삭제 완료’ 보장 불가 |
| 공개 장소 경로 cache |010/014 route store: public POI 경로, 구간 시간/geometry, expiry | 사용자 방문 이력과 다른 서버 cache. 논리 expiry/별도 purge와 실제 물리 정리 운용 구분. private 위치 전송·provider cache/로그/국가 상세는 API 세션 인계 |

사진 파일 업로드를 사용자 계정 데이터로 수집하는 활성 경로는 이번 DB 코드에서 확인하지 않았다. 장소 사진은 DATA/API의 외부 asset 근거와 구분한다. 이동 경로의 지속 GPS 추적 수집을 위 선택 좌표 저장과 혼동하지 않는다.

## 3. 삭제 동작별 정확한 차이

| 사용자 동작 | 구현 결과 / 남는 것 |
| --- | --- |
| 로그아웃/계정 전환 | 인증·owner 접근과 진행/학습 적용 격리. 서버 기록의 물리 삭제 명령 아님. 다른 owner 기기 원본을 임의로 삭제하지 않음 |
| 개별 완료기록 삭제 |015 `delete_account_course_completion`: 완료/연결 장소 삭제, tombstone·mutation 보존. runtime은 해당 로컬 완료/학습 대기·증거 정리. **서버 dwell 표본은 완료 테이블 FK가 아니며 해당 함수에서 DELETE하지 않음** |
| 전체 완료기록 삭제 |015 generation 변경·완료 제거, runtime 해당 owner 로컬 완료/대기 정리. import claims·mutation 등 재등록 방지 상태가 남음. **서버 dwell 표본 초기화와 동일하지 않음** |
| 맞춤 추천 끄기 |016 set consent: enabled=false/epoch 제거/revision 변경. RLS·조회·제출·추천 적용을 막지만 기존 서버 표본/집계를 즉시 DELETE하지 않음 |
| 맞춤 추천 초기화 |016 reset: 해당 owner 표본·집계 DELETE, 동의OFF/revision 변경. 최소 consent/mutation은 멱등성을 위해 남음 |
| 계정 탈퇴 | `delete-account/handler.ts`가 getUser + 검증 claims에서 password AMR 최근600초를 서버 검사. iat 갱신만으로 재인증 대체 불가. 요청 claim→Storage 단계→Auth Admin delete→소유행 확인→localCleanupRequired. runtime은 해당 owner 기기 정리 |

탈퇴의 public cascade 범위: profiles, courses→stops/legs/feedback, recommendation_events, account_consent_records, 계정 완료/장소, tombstone/generation/mutation, guest import/source claims, dwell consent/mutation/samples/profiles, account_deletion_requests의 Auth FK. 개인 owner 데이터와 달리 **signup registry, public POI cache, 익명 정리의 날짜별 집계 audit, provider 로그, 보호 백업은 계정 삭제로 전역 제거되지 않는다**.

`count_account_owned_rows`는 대표9개 owner 테이블을 검사하고 연결 자식은 FK cascade에 의존한다. 모든 시스템 테이블0을 검증하는 함수가 아니다. Edge `deleteStorage()`는 현재 true를 반환하는 no-op이다. 현재 사용자 업로드 경로 미확인과 별개로, 향후 Storage 객체가 생기면 이 코드를 삭제 보장으로 사용할 수 없다. 삭제 Edge의 운영 배포 및 실제 계정 삭제 E2E는 이번 메타데이터 조회로 확인하지 않았다. 완료된 C는 계정 탈퇴 시험이 아니다.

**공개 문서 주의:** ‘기록 삭제=학습표본 즉시 삭제’, ‘동의OFF=기존 표본 즉시 삭제’, ‘탈퇴=모든 로그/백업 즉시 삭제’를 쓰지 않는다. 이 동작의 제품/법률 고지 적합성은 통합·문서 담당이 판단할 사항이며 이번에 정책을 바꾸지 않는다.

## 4. 서버 지역·보관 메타데이터

| 항목 | 근거·확인 수준 | 남은 최소 확인 |
| --- | --- | --- |
| 현재 linked project 지역 | 기존 인증 `npx supabase@2.116.0 projects list --output json` 결과에서 로컬 linked ref와 매칭 후 region/status만 출력. **ap-northeast-2, ACTIVE_HEALTHY** 확인 | AWS 서울 리전(대한민국)의 프로젝트 배치. Auth 메일/Edge/CDN/support·하위처리자 전부 국내라는 뜻 아님 |
| plan·관리형 로그 retention | 이번 project list 응답으로 확인하지 못함 | 소유자가 Dashboard plan 및 Auth/Edge/Postgres 로그 보유 설정 화면의 해당 항목만 확인. 사용자 로그 본문/키 불필요 |
| 관리형 백업/PITR | 과거 `release-personalization-migration-apply.md`에 walg_enabled=true/pitr_enabled=false/백업 목록 비어 있음 기록. **과거 상태** | 현재 Backup/PITR 화면의 실제 복원 가능 시점·보관기간 확인. flag만으로 복구 가능 보장 금지 |
| 사용자 보호 백업 | `personalization-finalization.md` A 수락:09-07 20:20:48 KST snapshot, Auth/public/migration 포함 AES-256 APFS 보호 이미지, 격리 복원 비교 PASS, repo 밖·사용자 보관 책임 | 이 문서에 원문/비밀번호 재노출0, 재마운트/재생성0. 자동 만료/폐기일 미확정. 당시 데이터가 현재 live DB 삭제 후에도 암호화 백업에 남을 수 있음 |
| 정기 삭제 운용 |012 익명30일 계약과016180일 purge 함수는 존재. 기존 완료 문서에서 Edge/scheduler 배포는 별도 범위 | 소유자의 Functions 배포 상태/정기 작업 설정/마지막 성공 시각·집계만 확인 필요. readSamples는 purge 쓰기가 있어 이번 조회에 사용하지 않음 |

국가/수탁/국외 이전 여부의 법적 분류는 기술적 region만으로 확정하지 않는다. API 전송·제공사 약관·cache/로그 상세는 `docs/work/external-api/release-facts-final.md` 담당 결과와 문서 세션이 합친다.

## 5. 가입 문서 연결 준비 — RELEASE-LINKS-01 적용 전 계약

확인 소스:015 `signup_consent_documents`, `get_signup_consent_documents`, `handle_new_user`; `accountRegistrationRepository.ts`, `releaseIdentitySupabase.ts`, LoginScreen의 registry 소비.

- 고정 ID: `terms-of-service`, `privacy-policy`. 필수2개 모두 필요. version 길이1~120, URL은 HTTPS, approved_at 필수, 기본active=false. (ID,version) PK·ID별 active1개 unique. 클라이언트에는 registry 직접 write 권한 없음.
- 공개 read RPC는 active 문서만 반환. signUp은 읽은 version과 명시 accepted=true를 대조하고 Auth metadata에 전달. Auth trigger도 해당 active version을 다시 검사하여 오래된/빠진 동의로 가입하지 못하게 한다. 등록 문서가 없으면 not_configured/signup_unavailable로 신규 가입이 막힘.
- 마지막 B 수락 당시 registry0행·신규 일반 가입 일시 차단 기록을 재사용하되, **현재 registry 행을 재조회했다고 주장하지 않는다**. 실제 공개 URL/version 값의 최종 등록은 아직 미확인. 가짜 URL·임시 active 문서 생성0.

승인 후 최소 적용 순서(이번 실행하지 않음):

1. 문서 역할이 실제 게시된 HTTPS 문서2개의 ID/version/URL·승인시각·내용을 확정한다. 동일 version URL의 내용을 조용히 바꾸지 않도록 버전별 불변 URL/보관 원칙을 합의한다.
2. DB가 metadata 전용으로 기존 registry 상태를 읽고 정확한 변경행·이전 active 값·가입 차단 영향을 승인 묶음에 제시한다. 문서 본문 검증과 네트워크 접근 가능 확인 후 RELEASE-LINKS-01 쓰기 승인을 받는다.
3. 한 transaction 안에서 새 version inactive 준비→기존 active 해제→새2종 active 전환. 예상 ID/행수/기존값이 다르면 rollback. unique 제약/기존 account_consent_records FK 유지, 과거 동의행 삭제0.
4. 공개 RPC 결과2종과 UI 노출·버전 일치를 확인한다. 가입 자체는 계정 생성/메일 발송이므로 전용 계정1회 검증의 별도 승인 필요.
5. 롤백은 이전 active 행을 복원하고 새 행은 inactive로 보존한다. 새 버전에 이미 동의한 회원 기록을 삭제하지 않는다. 이전 상태가0종이면 롤백은 신규 가입 재차단임을 명시한다. URL만 바꾸는 경우에도 이전 정확한 URL값을 보존하며 동의 내용 변경은 새 version으로 처리한다.

승인에 필요한 값: 문서2종 실제 URL/version/승인시각, 현재 registry metadata, 정확한 활성 전환·롤백 범위. 공개 게시·등록·가입 시험을 이번 사실 확인 승인으로 대신하지 않는다.

## 6. 검증·남은 1회 삭제 E2E 계획

실행: `node --import tsx --test test/delete-account-handler.test.ts test/release-identity-classification-contract.test.mjs test/release-identity-migration-contract.test.mjs test/release-identity-device-flow.test.ts test/release-owned-completion.test.ts test/dwell-storage-contract.test.ts test/guest-import-pending-recovery.test.ts test/guest-import-release-fix.test.ts` → **42/42 PASS**, exit0.

정상 인증/회원·익명 분리, password AMR600초, owner 변경, 동의/기록 계약·guest pending/재시도/원본 보존을 fixture로 재확인했다. 이는 source/fixture 증거이며 이번 운영 RLS 세션·삭제 E2E 증거가 아니다. 제품/SQL 변경0이므로 전체 QA·개인화 C는 반복하지 않았다.

삭제 E2E 미확인 해소 계획만 제시: 통합이 delete-account의 배포 상태를 먼저 metadata로 확인한다. 별도 승인 후 전용 신규 테스트 계정1개에만 정상 가입/문서 동의·비밀번호 재인증을 하고, 최소 완료1/표본최대1/필요할 때 저장코스1의 소유 ID를 추적한다. stale AMR 거절은 fixture 증거를 재사용하며 실제 삭제는1회. Auth 삭제와 public cascade·해당 owner 로컬 정리·다른 사용자 비변경을 확인한다. 사용자 현 계정/전체 기록 초기화 금지, 실패 시 동일 요청 상태만 확인하고 자동 반복/관리자 우회 삭제하지 않는다. Storage 업로드는 현재 사용하지 않으므로 임의 추가하지 않는다. 계정 생성·메일·테스트 쓰기·정확한 삭제·메타데이터 사후 확인 범위를 한 번에 별도 승인받아야 한다.

## 7. 네 항목 인수인계

1. 변경: 본 문서 신규 및 DB README 링크. 공개 publish 문서·중앙 정책·제품·migration 수정0.
2. 유지:015/016/017 및 C 완료, 실기기 guest 가져오기 표시 성공, owner/RLS·명시 동의·기록/표본 분리·120/180 코스·삭제 최소 보유 계약 유지.
3. 검증: fixture42 PASS, linked project region/status 최소 metadata 확인, git diff --check PASS. 원격 변경0·사용자 행/토큰/키 원문 출력0·commit/push0.
4. 다음 담당: 문서 세션은 사실표와 미확인을 공개 문구에 구분 반영. 통합/사용자는 현재 plan·로그/백업 retention·scheduler/삭제Edge 배포와 백업 폐기일을 확인한다. RELEASE-LINKS-01 게시/registry 전환 및 전용 삭제 E2E는 위 정확한 범위 별도 승인. API 상세·법적 분류를 DB가 확정하지 않음.

## 8. DB-RELEASE-OPS-02 — 운영 메타데이터·탈퇴1회 계획 (2026-09-08)

**읽기 전용 확인 완료 / 운영 배포 보완·일부 설정 확인 필요 / 계정 생성·삭제 미실행.** [최소 후속 명령](../integration-decision/release-minimal-followup.md)의 DB 절을 따랐다. 아래는 이전4절의 미확인 중 실제 확인한 추가 사실이며 과거42 PASS/C 결과를 이번 운영 탈퇴 성공으로 복사하지 않는다.

### A. 조회 방법·운영 사실

확인 시작시각 **2026-09-08 14:49:41 UTC (23:49:41 KST)**. 기존 Supabase CLI macOS Keychain 인증을 메모리에서만 사용하고 로컬 linked ref를 읽었다. 조회기는 repo 밖 `/private/tmp/timefit-release-ops02.cjs`다. 토큰/키/사용자 행/로그 메시지/cron 명령 본문을 출력하지 않았다. 각 설정 조회1회, 실패 endpoint 반복0. 관리형 query API의 `read_only:true`로 system catalog의 cron 테이블 존재 여부만 SELECT했다. purge RPC·삭제 Edge 호출0.

| 확인 항목 | 실제 응답·판정 |
| --- | --- |
| 연결 프로젝트 | linked project 일치, region **ap-northeast-2**, status **ACTIVE_HEALTHY**. 서울 프로젝트라는 사실을 모든 provider/로그/Edge 처리 국가로 확대하지 않음 |
| delete-account | Functions 목록 조회 성공, 해당 slug **없음(미배포)**. 운영 version/배포시각/verify_jwt는 해당 없음. 로컬 코드가 있다는 사실과 구분 |
| anonymous-auth-cleanup | Functions 목록 조회 성공, 해당 slug **없음(미배포)**. 운영 version/배포시각/verify_jwt는 해당 없음 |
| route-proxy (API 공통 인계) | **ACTIVE, version14, verify_jwt=true**, 생성2026-08-28T13:57:08.670Z, 최종 갱신2026-09-02T18:55:38.609Z. 갱신시각을 로컬 소스 빌드 동일성 증거로 쓰지 않음. 배포 코드 hash/재현 빌드 일치는 이번 확인 범위 밖 |
| 관리형 백업 | region ap-northeast-2, walg_enabled=true, pitr_enabled=false, backups=[], physical_backup_data 키0. **API 목록상 복원 가능한 시점0건**. 내부/사용자 별도 백업이 전혀 없다는 뜻 아님 |
| 백업 schedule | 공식 GET endpoint **HTTP402**, 추가 반복하지 않음. 스케줄/보관일수 확인 불가.402로 Free/Pro 요금제를 단정하지 않음 |
| DB 정기 작업 | `to_regclass('cron.job')` 및 `cron.job_run_details` 모두 없음. **이 DB의 pg_cron 등록·실행 이력 경로 없음**. 외부 GitHub/Cloudflare 등 스케줄러 존재까지 부정하지 않음 |
| 익명30일·학습180일 마지막 정기 삭제 | 해당 Edge 미배포/pg_cron 없음이므로 이 경로의 성공시각 없음. 외부 scheduler 실행 여부는 미확인. 사용자 로그·audit 내용 조회로 우회하지 않음 |
| plan / Auth·Postgres·Edge 로그 retention | 공개 Management API 명세의 해당 설정 조회 경로를 확인하지 못해 **미확인**. 사용자 로그를 읽어 오래된 행이 없다는 이유로 보유기간을 추정하지 않음 |

읽기 endpoint: GET `/v1/projects`, `/v1/projects/{ref}/functions`, `/v1/projects/{ref}/database/backups`, `/v1/projects/{ref}/database/backups/schedule`; POST `/v1/projects/{ref}/database/query`는 read_only 존재검사 SELECT만. endpoint의 POST 명칭을 데이터 변경으로 사용하지 않았으며 성공 SELECT 이후 실제 job/로그 테이블은 읽지 않았다.

공식 경로 확인 근거: [Management API 원본 명세](https://github.com/supabase/supabase/blob/master/apps/docs/spec/api_v1_openapi.json), [백업 목록 API](https://supabase.com/docs/reference/api/v1-list-all-backups). 문서 조회일2026-09-08. 이 문서의 운영 수치는 API 실응답이며 제공사 일반 요금제 설명으로 채운 값이 아니다.

### B. 공개 고지·최소 운영 보완 인계

1. **회원 탈퇴 출시 차단점:** 앱/repository가 호출할 `delete-account`가 현재 없다. 사용자 탈퇴가 운영에서 성공한다고 고지하거나 기존 C PASS로 대체할 수 없다. 최소 배포 대상은 기존 `supabase/functions/delete-account/index.ts`와 handler/dependency 묶음이다. 현재 미배포→신규 endpoint 활성의 영향, 게이트 JWT 설정, service-role 서버 비밀 주입 및 getUser/getClaims/password AMR 검증 유지, artifact 식별자를 배포 승인 묶음에 포함해야 한다. 이번 배포0. 미사용 Storage 기능을 개발하거나 기존 함수를 우회한 관리자 삭제로 대신하지 않는다.
2. **익명30일:** 계약/소스는 있지만 cleanup Edge 미배포·DB scheduler 없음. inactivity 후보·재검사·일1회 통제와 실제30일 물리 정리를 구분한다. 필요 시 기존 anonymous-auth-cleanup 배포+승인된 scheduler1개 등록/secret 연결을 별도 승인받고 최대 batch·계정 재검사·실패 정책을 제시한다. 지금은 자동 삭제 운용 완료라고 쓸 수 없다.
3. **표본180일:** 유효범위/회원 표본 조회 때 해당 owner 만료행 삭제는016 계약이다. 전역 `purge_expired_dwell_samples`의 정기 실행은 이 pg_cron 경로에 등록되지 않았다. 외부 운용 확인 전 ‘180일 후 전량 정기 물리 삭제’라고 쓰지 않는다. 정기 삭제가 필요하면 해당 함수 호출 주기·예상 잠금/범위·실행 owner를 별도 승인하고 임의 등록하지 않는다.
4. **백업·로그:** 목록0건/HTTP402로 복구·폐기 SLA를 만들지 않는다. 기존 암호화 A 백업은 사용자 보관 책임·복원 수락 이력을 유지하며 이번 생성/마운트/열람/삭제0. 사용자에게 폐기 예정일을 결정받아야 하며 계정 삭제가 백업 원문까지 즉시 제거한다는 고지를 하지 않는다.

배포 전 대조용 로컬 SHA256(운영 동일성 인증 아님):

| 파일 | SHA256 |
| --- | --- |
| delete-account/index.ts | 47fd715d6b04048e5492000e37f5fea6052db522aa51332017d99b5dadb19da0 |
| delete-account/handler.ts | c435804b40af82af2d887b54d4f7a2995d6368ae44dfeb4cff95d3b267a48c31 |
| anonymous-auth-cleanup/index.ts | 7361833f1936078c54bb39e52d48d1abdd9fda4e27e344ad593befe74af25074 |

`src/`와 `supabase/functions/`의 Storage upload API 호출 패턴 검색에서 사용자 upload 경로를 발견하지 않았다. 기존 deleteStorage=true no-op은 이 현재 범위에서만 해석한다. 향후 사용자가 업로드한 Storage 객체가 생기면 현 구현은 객체 삭제를 보장하지 않는다. Auth/public cascade 증거를 Storage 삭제 증거로 확대하지 않는다.

### C. 필요한 최소 설정 확인 — 한 묶음

동일 조회를 반복하거나 관리 권한을 우회하지 않는다. 소유자가 아래 **설정 값만** 화면으로 확인하면 충분하며 계정 목록·로그 본문·키·토큰은 가린다.

- 조직 Billing/Subscription: 해당 프로젝트의 현재 plan.
- Logs 관련 설정/계약: Auth·Postgres·Edge 각 보유기간, 외부 log drain 유무와 목적지 보유정책(주소/credential 불필요).
- Database Backups/PITR: 현재 활성 옵션·실제 복원가능 범위·보관일수와 schedule entitlement. 현 API402 원인을 plan 이름으로 추정하지 않음.
- 외부 scheduler를 사용한다면: 익명/학습 cleanup 작업 등록 여부·활성 주기·마지막 실행시각/성공 여부만. URL·명령·secret 본문 불필요. 사용하지 않는다면 ‘없음’ 확인.
- 사용자 소유 보호 백업 폐기일/보유 필요성 결정. 비밀번호 재요청0.

### D. 전용 계정 탈퇴1회 — 실행 전 승인 묶음

**현재 실행 불가 선행:** 실제 공개 registry2종 준비/승인 연결, delete-account 배포 별도 승인·완료, 위 배포 auth 검증/공개 앱 오류 처리 확인. 이후 아래 범위를 한 번에 승인받는다. 현재 로그인 계정·실사용자·심사 계정을 사용하지 않는다.

| 단계·담당 | 정확한 실행 범위·성공 기준 |
| --- | --- |
| 대상 확정(사용자/QA) | 승인 이후 지정한 전용 신규 계정1개, 정상 앱 가입/메일 확인·명시 문서 동의. 비밀번호·토큰은 앱/보호 경로에서만 사용하고 채팅/로그 전달0. 이 계정은 테스트 종료 후 삭제되어 심사 계정으로 재사용하지 않음 |
| 최소 데이터(사용자/QA, DB 증거) | 완료기록 최대1개. cascade 검증에 필요한 경우에만 개인화 동의1상태·표본최대1개. 기존 저장코스 graph의 cascade가 이 후보에서 미확인일 때만 synthetic 위치의 저장코스 최대1개. 실제 경로 API 대신 고정 fixture 사용, 개인화 추천3회/C 시나리오 재실행0. 추가 행은 생성하지 않음 |
| 기준선(DB) | 승인된 owner/run/completion/event/course/request ID를 보호된 manifest로 추적. 해당 owner의 Auth 존재·public 관계별 건수·기기 owner 상태만 확인. 다른 사용자 내용조회0. 전역 테이블0을 목표로 하지 않음 |
| 탈퇴(사용자/QA) | 정상 앱 비밀번호 재인증→서버 검증 AMR600초 이내→동일 requestId로 앱 내 탈퇴 **1회**. API를 DB가 대신 직접 호출하거나 Admin 우회 삭제0. 오래된 AMR/위조 body 거절은 기존 fixture 재사용 |
| 사후(DB+QA) | 해당 Auth user 부재, 그 owner의 public cascade/연결 자식 정리, 해당 owner 기기 완료·outbox/evidence/pending 접근/재등록 정리 확인. 공개 registry·POI cache·비개인 집계·백업은 전역 삭제하지 않음. client `deleted`만으로 모든 경계 성공 판정하지 않음 |
| 실패·응답 불명 | 자동 재시도/새 request 발급/관리자 보정 삭제 금지. 같은 request의 안전 상태와 이미 완료된 단계만 확인해 통합 반환. Auth가 삭제돼 재인증 불가하거나 로컬 정리만 남는 경우도 성공으로 숨기지 않음. 잔여 전용 데이터 정리는 새 정확한 범위 승인 후 |

승인 문구에 포함할 항목: 전용 계정1개 생성·메일, 필요한 최소 기록/표본/코스의 정확한 상한, 정상 앱 탈퇴1회, 해당 owner에 한정된 사전/사후 읽기 검증, 실패 시 중단. 별도 함수 배포·registry 변경은 이 계정 테스트 승인과 혼합해 암묵 승인하지 않는다. 실행 시각/계정은 아직 지정하지 않았다.

### E. 이번 네 항목 인수인계

1. 변경 파일: 본 문서 후속8절만. repo 밖 일회성 metadata 조회기 준비. 제품/SQL/registry/native/QA 테스트 변경0.
2. 유지 계약:42개 fixture PASS·015/016/017·개인화 C 완료·실기기 guest 가져오기 성공 이력 재사용. 동의/owner·최소 보유·백업 보존 불변.
3. 근거/검증: 위 실제 metadata 조회, 로컬 업로드 경로 검색·함수 SHA256, 문서 diff 검사. 기존42개 테스트를 재실행하지 않았으며 운영 삭제 E2E 성공으로 표시하지 않음. 원격 변경/삭제 함수 호출/사용자 행 조회/로그 본문 조회/C/commit/push0.
4. 다음 담당: 통합이 delete-account 미배포를 출시 보완 대상으로 수락하고 정확한 배포 승인을 별도 준비. API는 region/route-proxy version14·verify_jwt/백업 목록/PITR·미확인 retention을 재사용한다. 소유자가 C의 최소 설정 항목을 확인한 뒤 문서 담당이 고지 확정. 최종 QA/사용자 UI 조작과 DB 서버 증거 담당을 분리하여 D의1회 계획 승인 후 실행한다.

## 9. DB-RELEASE-DELETE-PREP-03 — 함수1개 배포 승인안 (2026-09-09)

> **FIX-04 이후 실행 기준:** 아래 A의2파일 hash/manifest와 가변 SDK·실패 축약 미보완 표기는 **과거 준비 근거**다. 현재 배포 승인 소스·의존성·시작 검증·실패 전달 계약은 **10절**을 사용한다. D의 프로젝트·함수1개·verify_jwt=true·조건부 endpoint 제거/별도 계정 E2E 범위만 유지한다. 옛 hash로 배포하지 않는다.

**준비 조사 완료·승인안 작성 / 실제 배포·삭제 미실행.** [실행 명령](../integration-decision/release-deploy-preparation.md)의 DB 절 기준. 이전 소스 존재→OPS02에서 운영 endpoint 부재 확인→기존 함수 하나의 인증·의존성·복구를 분리한 조건부 배포안→탈퇴 성공을 배포 여부와 혼동하지 않기 위함→현행 준비안. OPS02의 2026-09-08 23:49 KST metadata를 재사용하며 오늘 원격 상태를 재조회한 것으로 표시하지 않는다.

### A. 대상·파일·의존성

- 예상 프로젝트: `hwfsslihmmendxigklrx`, ap-northeast-2, ACTIVE_HEALTHY. 실행 직전 `supabase/.temp/project-ref`와 명시 CLI ref·Management 프로젝트 metadata를 대조한다. `config.toml`의 `project_id=TimeFit`은 로컬 이름이지 원격 대상 증거가 아니다.
- 예상 사전 상태: Functions 목록에 `delete-account` 없음. 이미 존재하거나 대상·승인 소스가 바뀌면 덮어쓰지 않고 중단한다. route-proxy v14와 anonymous cleanup은 이번 배포 대상 아님.
- 로컬 entry와 유일한 상대 import를 모두 확인했다. `index.ts` → `handler.ts`; 외부 import는 `https://esm.sh/@supabase/supabase-js@2`. 함수 디렉터리에는 이2개 파일만 있다. config 전체를 확인했으며 delete-account 전용 설정/entrypoint/import_map/verify_jwt override는 없다.

| 승인 대조 파일 | SHA256 (이번 재계산) |
| --- | --- |
| `supabase/functions/delete-account/index.ts` | `47fd715d6b04048e5492000e37f5fea6052db522aa51332017d99b5dadb19da0` |
| `supabase/functions/delete-account/handler.ts` | `c435804b40af82af2d887b54d4f7a2995d6368ae44dfeb4cff95d3b267a48c31` |
| `supabase/config.toml` (대조용, 전체 설정 원격 적용 아님) | `dd6c37e3f5d639990f5e524b9cebb1484459c3acec0409165e497c3f32f9d8cb` |

소스2개 manifest hash: `039d38e9edde6cf0f88df2860640c66cf4fc6b70f37d559967504392124e9d53`. 계산은 위 index→handler 순서로 `repo상대경로 + TAB + 파일sha256 + LF`를 연결한 UTF-8의 SHA256이다. **외부 dependency 포함 bundle hash가 아니다.** Edge deno/import lock 없음, `@2`는 가변 해석이며 앱 package-lock이 이를 고정하지 않는다. 이번 Deno 실행환경은 PATH에서 확인되지 않았고 실제 Edge bundle/startup은 미검증이다.

남은 최소 의존성 조건: 배포 전 해석 SDK 버전·전이 import·bundle 식별값과 getClaims 제공/시작 가능 여부를 확인해야 한다. 재현 가능한 빌드를 권장하려면 해당 함수 외부 import의 검증된 exact 버전 및 해당 함수 범위 lock만 고정하는 별도 로컬 보완을 통합에 요청한다. 이번 제품 무변경 지시에 따라 임의 버전 선택·SDK 교체·lock 생성은 하지 않았다. 소스 hash 일치만으로 의존성 동일성 PASS를 만들지 않는다. 신규 인프라나 다른 함수 일괄 업그레이드는 불필요하다.

DB 의존성은 기존 `claim_account_deletion(uuid,uuid)` 및 `count_account_owned_rows(uuid)`다. 015/016의 security definer·고정 search_path·service_role 전용 EXECUTE와 Auth FK cascade를 재사용한다. 실행 직전 system catalog로 존재·정의·ACL이 승인된 기존 계약과 같은지만 읽는다. 함수 실행이나 사용자 행 조회로 검사하지 않는다. 015/016/017 재적용·권한 변경·extension 이동0.

### B. 인증·secret·실패 계약

1. 실제 client `releaseIdentitySupabase.ts`는 `functions.invoke('delete-account')`에 정상 계정 accessToken을 Authorization Bearer로 명시하고 body는 requestId만 전달한다. SDK의 apikey(현재 앱 publishable key)와 사용자 JWT는 다른 자격이다. API key를 사용자 Bearer로 대체하지 않는다.
2. gateway는 **verify_jwt=true 유지**, `--no-verify-jwt` 사용하지 않는다. 최신 공식 문서는 user JWT 호출에서 true를 권장하고 HS256/비대칭 서명 모두 지원한다고 설명한다. 호환 API key만으로 gateway 통과할 수 있는 예외도 있으므로 이것만으로 사용자 인증을 보장하지 않는다. [공식 Authorization 계약](https://supabase.com/docs/guides/functions/auth-headers) (2026-09-09 확인). 타 함수 설정을 복사하거나 기존 로그인 성공을 이 endpoint 검증으로 쓰지 않는다.
3. handler는 POST·UUID requestId 단일 필드만 허용한다. `getUser(token)`으로 계정/비익명을 확인하고 `getClaims(token)`의 검증된 sub가 같은 owner인지 재검사한다. password AMR은 정수 timestamp, 현재+60초 이내, 경과600초 이하만 인정한다. refresh iat/token_refresh만으로 통과하지 않는다. owner 입력·관리자 JWT 사용자 대체 금지.
4. claim→Storage→Auth admin.deleteUser→잔여 public 행 검사 순서다. claim same_request는 재진입 가능, 다른 request는409. 그러나 Auth 삭제와 public 검증은 전체 단일 transaction이 아니고 삭제 후 claim행도 cascade되므로 **응답 유실 뒤 같은 요청의 성공 응답을 영구 재생한다고 보장하지 않는다.** 실제 실행 실패/응답 불명은 자동 재시도·새 request 발급 금지, 이미 완료된 단계만 좁혀 확인한다.
5. HTTP/status: 잘못된 method405/입력400, 계정·claims401, 재인증403, claim충돌409, storage/auth/verification 실패503, 예외503 database. `deleted`에는 requestId와 localCleanupRequired=true가 있다. 현재 실제 adapter는 invoke error(비2xx)를 일반 오류로 바꿔 repository에서 database 실패로 축약할 수 있다. 따라서 서버 실패 stage/reauth_required가 그대로 UI에 도달한다고 인계하지 않는다. DB adapter 최소 후속 후보는 응답의 고정 status/stage만 안전하게 복원하는 것; UI가 원문 body/토큰을 수집하는 수정은 불필요하다. 이번 수정0, 실패 표시 계약 검토는 전용 E2E 전 조건.
6. Storage 삭제는 `true` no-op이다. 현재 소스에서 사용자 업로드 경로가 발견되지 않은 범위에서만 허용된다. 업로드 기능 또는 해당 사용자 소유 객체가 존재하면 삭제 성공 보장이 달라지므로 전용 E2E 전에 중단/범위를 반환한다. 신규 Storage 구현 없음.

| 이름 | 공급·사용 경계 |
| --- | --- |
| `SUPABASE_URL` | hosted 기본 제공 프로젝트 URL, Edge client2개 초기화 |
| `SUPABASE_ANON_KEY` | hosted legacy 기본 제공 키, getUser/getClaims용; 앱 publishable key와 같다고 가정하지 않음 |
| `SUPABASE_SERVICE_ROLE_KEY` | hosted legacy 기본 제공, claim/count RPC 및 Auth admin 전용. RLS 우회 권한이므로 서버 밖 반출0 |

[공식 기본 환경변수](https://supabase.com/docs/guides/functions/secrets) 기준이며, 대상 프로젝트에서 legacy 키를 중지한 경우 호환성을 별도로 확인해야 한다. 사용자에게 값 전달을 요청하지 않는다. 현재 코드가 읽지 않는 SUPABASE_SECRET_KEYS 등으로 임의 치환하지 않는다. custom secret 추가0, secrets set/키 회전0. 설정 확인은 이름·활성 여부만, 값·JWT·service key 로그0.

### C. 실행한 검증과 한계

`node --import tsx --test test/delete-account-handler.test.ts test/release-identity-migration-contract.test.mjs` → **11/11 PASS**, skip0, exit0.

- handler4개: 최근 password 정상 삭제 순서,601초/refresh/미래61초 거절, 익명·body owner 위조 거절, Auth 삭제 뒤 잔여행이면 verification 실패.
- migration/repository 정적 계약7개: 소유 graph·service/owner 계약 등 기존 명세 확인. 운영 DB cascade를 이번 실행한 증거는 아니다.
- 기존 fixture는 storage 실패/auth 실패/claim 경쟁/응답 유실의 모든 조합을 실행하지 않는다. 코드를 읽어 실패 반환·순서를 확인했지만 해당 조합 전체 PASS로 확대하지 않는다. 앱 SDK 실제 invoke→Edge getClaims startup, 운영 gateway, 전용 계정 삭제/로컬 정리는 미검증이다.
- 문서 준비만이므로 전체 typecheck/UI/core·iOS export·개인화 C 반복0.
- `npx --no-install supabase@2.116.0 functions deploy --help` → exit0. 초기 sandbox DNS 실패 후 승인된 도움말 조회로만 재실행했다. 함수명 지정·project-ref·use-api·no-verify-jwt 옵션을 확인했고 실제 deploy는 호출하지 않았다. 함수명을 생략하면 전체 배포하므로 생략 금지, `--prune`도 사용 금지.

### D. 최종 승인 범위·실행 순서·복구

**승인 요청안(아직 미승인、FIX-04 후 보완):** **10절 최신 승인 소스와 의존성/시작 검증 근거**를 사용하고 대상·DB 의존성·미배포 상태가 동일한 경우에 한해, 아래 고정 CLI로 `delete-account` **1개 신규 배포1회**, verify_jwt=true 유지, metadata/source 동일성 확인과 자격 없는 요청1회의 거절 검증을 허용한다. 검증 실패 시 이번 생성 endpoint만 제거하는 조건부 복구를 승인 범위에 명시한다. 계정 생성·정상 사용자 탈퇴·기존 데이터 수정·다른 함수·scheduler·registry·secret 변경은 포함하지 않는다. 운영 artifact 대조를 로컬 시작 PASS로 생략하지 않는다.

승인 후 실행할 명령(이번 실행0, repo 루트에서):

```sh
npx supabase@2.116.0 functions deploy delete-account --project-ref hwfsslihmmendxigklrx --use-api
```

1. 고정 CLI version, linked/명시 target, **10절 최신 소스/hash/config**, Functions 미배포, DB dependency 정의/ACL을 대조. 권한/legacy secret 활성 여부는 값 없이 확인. 승인 artifact 외 파일이나 상태가 다르면 중단. config 전체 Auth 설정을 운영에 push하지 않는다.
2. 배포 명령1회만 실행. 배포 자체 계정 데이터 삭제0이지만 **기존 앱에서 자격을 갖춘 사용자의 실제 탈퇴 endpoint가 활성화된다**. 전체 서비스 중단이나 다른 함수 변경은 계획하지 않는다.
3. 성공 후 slug/status/version/verify_jwt=true/배포시각·deployment ID를 기록한다. 배포 소스는 공유 트리를 덮어쓰지 않는 별도 로컬 경로로 받아 entry/handler와 해석 dependency/bundle을 대조한다. metadata version만으로 source 동일성 PASS 아님. 실제 다운로드가 원본과 다른 bundle 형태이면 대응되는 bundle hash로 검증하며 불가능하면 미확인으로 중단.
4. Authorization/apikey 둘 다 없는 POST1회(합성 requestId 또는 빈 body, 사용자 자격0)의401 gateway 거절만 확인한다. 실제 요청 본문/로그를 사용자 정보로 채우지 않는다. 이는 유효 JWT·AMR·cascade 성공 검증을 대신하지 않는다. 반복 probe0.
5. 실패/timeout/응답 불명 시 반복 deploy0. Functions metadata로 부재/부분 생성/ACTIVE 상태부터 보고한다. 기존 부재가 확인됐고 이번 생성임이 식별되는 endpoint에만 아래 조건부 제거를 적용한다. 다른 작성자가 변경했거나 출처가 불명확하면 제거하지 않고 반환한다.

조건부 복구 명령(위 범위의 명시 승인 후에만):

```sh
npx supabase@2.116.0 functions delete delete-account --project-ref hwfsslihmmendxigklrx
```

제거 후 목록상 부재를 확인한다. 영향은 앱 탈퇴 API가 다시 사용 불가해지는 것이며 다른 기능·데이터를 복원하는 작업이 아니다. 배포 후 사용자가 이미 삭제한 계정/데이터는 함수 제거로 복구되지 않는다. 전체 DB 과거시점 복원·백업 재생성·Auth 계정 재생성0. 실제 사용자 삭제가 발생했거나 잔여행이 있으면 별도 사고/제한 복구 승인으로 반환한다. 새 endpoint 외 기존 함수 rollback 대상0.

전용 계정 삭제1회는 위 배포 승인과 별개다. 공개 문서/registry 준비, 정상 앱 인증·비밀번호 AMR, 실패 전달 계약·Storage 범위 확인 후 **8절D**의 별도 계정1개·최소 데이터·삭제1회 계획을 사용한다. C 완료 근거/현재 로그인 계정 재사용0.

### E. 네 항목 인수인계·남은 조건

1. 변경 파일: 이 문서9절만(인증·파일 hash·의존성·승인/복구안). 제품·SQL·UI·원격 변경0, stage/commit/push0.
2. 유지 계약: owner/명시동의·password AMR600초·requestId·015/016/017·기존 C 완료·guest 기록·기존 백업 보존. 다른 함수/학습 purge/scheduler 묶음 배포 금지.
3. 검증: 위11 fixture PASS·소스/config 전체 대조·SHA256. 배포/운영 인증 거절/탈퇴/복구는 실행 전이다. 소스 manifest와 dependency bundle 검증을 구분한다.
4. 통합 다음 결정: 가변 SDK를 exact 고정하고 Edge 시작 검증하는 최소 로컬 보완 및 adapter 실패 상태 전달 검토를 수락할지 결정한 뒤 함수1개 승인안을 확정한다. QA는 전용 탈퇴1회만 별도 수행. 소유자 확인값은 **8절C의 한 묶음**(plan, 서비스별 로그 retention/drain, 백업/PITR/schedule, 외부 cleanup scheduler 유무·주기·마지막 상태, 보호 백업 폐기일)을 재사용한다. 미확인을 고지 완료나 자동 정기 삭제 성공으로 바꾸지 않는다.

## 10. DB-RELEASE-DELETE-FIX-04 — SDK·시작·실패 전달 보완 완료 (2026-09-09)

**로컬 구현/검증 완료, 운영 미배포.** [FIX-04 명령](../integration-decision/release-delete-links-final.md)의 DB 범위만 수행했다. 9절의 가변 의존성·실패 축약은 이제 과거 상태다. 대상 프로젝트·verify_jwt=true·함수1개 배포/조건부 제거·전용 계정 별도 승인 경계는 그대로다.

### A. 실패 선행 → 보완 → 결과

이전 `functions.invoke` error를 모두 throw하고 성공 data를 그대로 전달 → 실제 production adapter→repository fixture에서403 재인증/401 계정 거절/503 stage가 database로 축약되고 성공 extra field·잘못된 requestId까지 반환되는 것을 관찰 → SDK `FunctionsHttpError.context`의 허용 HTTP/body 조합만 읽어 기존 union의 새 객체로 반환 → 민감 원문 전달과 성공 오판을 막으면서 기존 공개 상태를 보존 → **구현 현행**.

실패 선행 기록: 합성 세션의 expires_at을 올바르게 구성한 뒤 신규18개 실행에서 **8 PASS/10 FAIL**(실패 축약·성공 검증·없는 dependency 설정). 최초 하네스 자체의 expires_at 누락은 제품 실패 근거에서 제외했다. 제품 보완 뒤22개로 확장하여 모두 PASS. 전체 npm test 첫 실행에서는 새 mjs 하네스의 TS 로더 누락으로17개가 실패하여 테스트 파일에 `tsx/cjs` 등록을 추가했다. 제품을 완화하거나 테스트 삭제/skip으로 통과시키지 않았다.

이전 Edge `https://esm.sh/@supabase/supabase-js@2` 및 lock 없음 → local source만으로 해석 dependency 동일성을 식별하지 못함 → 함수 전용 deno.json의 `npm:@supabase/supabase-js@2.109.0` exact import와 frozen deno.lock → 다른 함수/앱 dependency를 바꾸지 않고 재현 가능한 해석 확보 → **구현 현행**. [Supabase 함수별 dependency 권장 방식](https://supabase.com/docs/guides/functions/dependencies), [Deno lock 설명](https://docs.deno.com/runtime/fundamentals/modules/)을 확인했다. 전용 Deno2.5.2는 승인된 npm 실행 캐시에만 설치했고 앱 package.json/package-lock은 변경하지 않았다.

### B. 실제 시작 검증·재현 명령

`supabase/functions/delete-account/startup_test.ts`는 Deno에서 **실제 index.ts를 dynamic import**한다. 실제 SDK createClient/getUser/getClaims/Admin/RPC를 사용한다. Deno.serve의 주소/port만 loopback·임시 포트로 지정하여 **실제 HTTP 서버를 시작**하고 요청1개를 보낸다. 단순 handler 주입을 시작 검증으로 부르지 않는다.

- 고정 clock1788912000초, 합성 owner/requestId/JWT·합성 env3개만 사용. 실제 환경값은 로그/fixture에 복사하지 않는다.
- getClaims 존재와 HS256의 Auth 검증 경로(getUser2회)를 확인. anon client 및 service client의 apikey가 각각 합성 지정값인지 확인.
- 실제 HTTP 응답200/deleted/requestId/localCleanupRequired와 `getUser→getClaims의 Auth 확인→claim→Auth 삭제→count` 요청 순서 확인. Storage no-op은 기존 handler 경계 그대로.
- 외부 fetch는 fixture origin만 mock 응답, Deno net 허용은127.0.0.1만. 운영 Auth/DB/외부 API 호출0. 종료 시 서버 shutdown·fetch/serve/clock/env 복구.
- 실제 Supabase gateway나 운영 JWT 서명/DB cascade의 검증은 아니다. 비대칭 JWT 경로와 실제 계정 삭제는 이 테스트에서 실행하지 않았다. hosted 검증은9절D/8절D의 별도 승인 단계에 남는다.

재현(루트에서, 이미 설치한 Deno2.5.2 실행파일을 `deno`로 사용할 때; 다른 버전이면 바꾸지 말고 확인):

```sh
deno --version
deno cache --config supabase/functions/delete-account/deno.json --frozen supabase/functions/delete-account/index.ts
deno test --config supabase/functions/delete-account/deno.json --frozen --cached-only --allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY --allow-net=127.0.0.1 supabase/functions/delete-account/startup_test.ts
```

이번 실행파일: `/Users/shindongheun/.npm/_npx/6fb1ea4ceff08f92/node_modules/deno/deno` (2.5.2). 최초 전용 lock 생성에서만 `cache --frozen=false`를 사용했고 이후 테스트는 frozen/cached-only로 PASS. npm offline 실행기 cache 해석 실패와 sandbox loopback bind 거절은 제품 결함으로 기록하지 않으며, 이미 설치한 고정 바이너리와 승인된 localhost 실행으로 검증했다. **lock 재생성은 배포 재현 명령에 포함하지 않는다.** SDK9개 package integrity를 lock에 보관한다: supabase-js/auth-js/functions-js/postgrest-js/realtime-js/storage-js 각2.109.0, phoenix0.4.4, iceberg-js0.8.1, tslib2.8.1.

### C. UIUX가 사용할 기존 export·반환 계약

호출 export 유지: `src/services/releaseIdentitySupabase.ts`의 `supabaseAccountDeletionRepository.deleteAccount({ requestId })`; 정상 앱 runtime은 기존 `deleteOwnedAccount`/`recheckOwnedAccountDeletion` 연결 유지. 신규 UI 상태/화면/입력 추가0. repository 구현 파일의 공개 union 변경0.

| 실제 응답 | repository로 전달하는 값 |
| --- | --- |
| invoke 성공 + deleted + 요청과 같은 requestId + localCleanupRequired===true | `{status:'deleted', requestId, localCleanupRequired:true}`만 |
| 403 + reauth_required/password_sign_in | `{status:'reauth_required', method:'password_sign_in'}` |
| 401 + rejected/account_required | `{status:'rejected', reason:'account_required'}` |
| 400/405 + rejected/invalid_request | `{status:'rejected', reason:'invalid_request'}` |
| 409 + retryable_failure/database | 기존 `{status:'retryable_failure', stage:'database'}` (새 conflict 상태를 만들지 않음) |
| 503 + retryable_failure + storage/auth/verification/database | 해당 허용 stage만 전달 |
| malformed/빈/읽기 실패/unknown stage/HTTP-body 불일치/네트워크 실패/잘못된 성공 ID·flag | 기존 `{status:'retryable_failure', stage:'database'}`; 삭제 성공 추정0 |

오류 body는 SDK HttpError context.clone().text()로 읽고4096자 이하만 JSON 해석한다. 이는 응답 다운로드 전체 크기를 제한하는 기능은 아니며 원문은 반환/로그하지 않는다. 새 객체를 구성하므로 extra field는 UI/runtime으로 전달하지 않는다. 비HttpError의 임의 context는 읽지 않는다. gateway401 원문이 handler 계약과 다르면 안전한 database 실패로 남기며 account_required라고 추정하지 않는다.

UI 호출 순서: 기존 정상 계정 확인/비밀번호 재인증→동일 requestId로 명시 탈퇴→typed 결과 분기. reauth_required는 비밀번호 재인증이 필요함을 전달, account_required는 정상 인증 필요, retryable_failure는 성공/로컬 정리로 전환하지 않는다. 재시도 가능이라는 이름이 자동 재호출 승인을 의미하지 않는다. **이번 adapter는 invoke1회만 수행**, 응답 유실 시 기존 확인/복구 경계를 유지하고 새 request를 만들지 않는다. deleted 이후 로컬 namespace 정리는 기존 runtime 책임이며 guest 원본 전체 삭제0.

### D. 최신 배포 승인 소스 (9절의 옛 hash를 대체)

| 경로 | SHA256 |
| --- | --- |
| `supabase/functions/delete-account/index.ts` | `cc73f68e8239b8ae65f584b3bb26e0ddb9ca8609cf72e4edfb39401e0be542c4` |
| `supabase/functions/delete-account/handler.ts` (내용 불변) | `c435804b40af82af2d887b54d4f7a2995d6368ae44dfeb4cff95d3b267a48c31` |
| `supabase/functions/delete-account/deno.json` | `72900cee4671b1dfc89488bc11b9f47bc2c7f5a1e417744a22616b2ad8de64f3` |
| `supabase/functions/delete-account/deno.lock` | `a4a1f0b4163ca97a8103a33e499bbe24ba667819e4519f3b2f266b5d4d3084a8` |

최신 runtime source+dependency manifest SHA256: **`6abd0e9b7af78d0fa7b01ee330dc876d1d8d62eef2fe133192bc636271b17b5b`**. 파일 순서는 deno.json→deno.lock→handler.ts→index.ts, 각 `repo상대경로 + TAB + sha256 + LF` UTF-8 연결의 hash. 테스트는 entry에서 import하지 않으며 runtime manifest에서 제외. 시작 fixture 자체 hash는 `00d3e42d02bd05aa3fe35c4ee1e44eed9b74e72c7e10aca96e0e885e6fb47c02`.

supabase/config.toml의 기존 hash/verify_jwt 기본true 유지. 위 manifest는 운영 배포 artifact hash가 아니다. 승인 후9절D의 **같은 함수1개 명령**을 사용하되 이4개 파일과 lock 해석을 배포 전 대조하고, server bundler 산출 소스/의존성·metadata를 사후 확인한다. 운영에서 lock/SDK 해석이 다르면 반복 배포하지 않고 중단한다. 이번 로컬 공백은 해소했으므로 신규 큰 설계/인프라 작업은 필요하지 않다.

### E. 검증 결과·네 항목 인수인계

| 실행 | 최종 결과 |
| --- | --- |
| `node --import tsx --test test/delete-account-adapter.test.mjs test/delete-account-handler.test.ts test/release-identity-migration-contract.test.mjs` | **35/35 PASS**, skip0 |
| 위 Deno frozen/cached-only 실제 entry 시작 fixture | **1/1 PASS**, 실제 localhost 시작·합성 Auth/RPC |
| `npm run test:typecheck` | PASS exit0 |
| `npm run test:ui` | **706 PASS / 0 FAIL / 기존 skip1** (총707). skip은 course-v1-journey의 철회 이력이며 이번 추가/변경0 |
| `npm test` | **395/395 PASS**, exit0, skip0. 로그 `/private/tmp/timefit-delete-fix04-core.log` |
| `git diff --check` | PASS |

1. 변경: index import exact 연결, 함수 전용 deno.json/deno.lock/startup_test.ts 신규; releaseIdentitySupabase.ts의 탈퇴 응답 변환만; delete-account-adapter.test.mjs 신규 및 handler 테스트2개 추가; 이 문서9절 현행 참조/10절과 DB README 인계. 서비스 파일에 이미 있던 guest serializationKey/createImportId 변경은 그대로 보존했다.
2. 유지: handler 제품 내용·AMR600초·owner·requestId·claim→Storage→Auth→검증 순서·service role 서버 전용·public union·SQL/RLS·기존 계정/기록/동의·C 완료. UI/native/다른 API 메서드·다른 함수 SDK·앱 dependency 수정0. Storage no-op의 업로드 부재 전제는 그대로이며 새 기능0.
3. 증거: 실패 선행/최종 focused·시작·기본 게이트는 위와 같다. 민감 원문 포함 합성 성공/error/손상 body, 재인증·거절·충돌·부분 실패·600초 경계·통신 실패를 검증. 운영 쓰기/배포/secrets/registry/migration/계정 생성·삭제/Archive/C/commit/push0.
4. 다음 담당: 통합은 FIX-04 로컬 완료 수락 후9절D의 **최신10절 hash 기준 함수1개 배포 승인**을 요청한다. 승인 직전 대상/미배포·DB 의존성/권한·legacy env 활성 여부 확인은 여전히 필요하다. 운영 gateway·source/bundle 동일성은 배포 사후, 공개 문서/registry 이후 전용 탈퇴1회는 별도 승인이다. UIUX는 위 기존 typed 결과 분기를 유지하며 실패를 성공·로컬 정리로 승격하지 않는다. 로그/백업/정기 삭제 정책 미확인은8절C에서 계속 관리한다.

## 11. DB-RELEASE-DELETE-DEPLOY-05 — 승인 확인 대기 (2026-09-09)

> 과거 승인 대기 기록. 이후 통합의 명시 승인 확인 및 실제 배포 결과는12절이다.

명령의 DEPLOY-05 승인 경계를 확인했다. 최신 통합 문서는 ‘명시적인 운영 배포 승인 후’로 남아 있고, 해당 문서·DB 인수인계·DB README에서 완료된 운영 승인 근거를 찾지 못했다. 사용자 요청의 ‘운영 배포 승인을 확인한 뒤’를 조건 없는 승인으로 바꾸지 않았다.

1. 변경: 본11절의 진행 상태만. 실제 배포/제거0.
2. 유지: 함수1개·verify_jwt=true·조건부 신규 endpoint 제거, 계정 생성/삭제·C·다른 함수·SQL/registry/secret/scheduler 제외.
3. 사전 확인: 로컬 linked ref=`hwfsslihmmendxigklrx`, 최신10절4파일 SHA256 모두 일치. 이번 원격 프로젝트/함수/ACL/env 재조회와 전체 테스트는 아직 실행하지 않았다. 과거 원격 부재를 현재 재조회 결과로 표시하지 않는다.
4. 다음: 사용자에게 정확한 범위(신규 배포1회·사후 읽기·무인증 POST1회·검증 실패 시 이번 생성 endpoint만 조건부 제거)의 명시 승인을 요청한다. 승인 뒤 원격 사전 조건을 확인하고 모두 일치할 때만 고정 CLI1회 적용한다. 배포 활성화 후 기존 앱의 유효한 탈퇴 요청은 실제 처리될 수 있지만 테스트 계정 삭제는 이 승인에 포함하지 않는다.

## 12. DB-RELEASE-DELETE-DEPLOY-05 — 운영 배포·사후 검증 완료 (2026-09-09)

**함수1개 배포 완료 / 실제 계정 탈퇴 E2E 미실행.** [통합 명령 승인 경계](../integration-decision/release-delete-links-final.md)의 ‘2026-09-09 운영 배포 승인 완료’와 사용자의 재개 요청을 확인했다. 동일 승인 질문 없이 진행했다. 이전 미배포/승인 대기→명시 승인·사전 일치→고정 CLI1회 배포 및 소스/무인증 검증→기존 탈퇴 endpoint 활성화→현행. 11절은 승인 전 이력이다.

### A. 실제 사전 조건

확인시각 **2026-09-08T16:26:59.574Z (2026-09-09 01:26:59.574 KST)**. repo 밖 `/private/tmp/timefit-delete-deploy05.cjs pre`에서 기존 CLI Keychain 자격을 메모리에만 사용했다. GET 프로젝트/Functions/legacy-key-enabled와 read_only system catalog SELECT만 수행. 사용자 행·키값·Auth 로그·백업 조회0.

- linked ref·명시 ref·운영 프로젝트 `hwfsslihmmendxigklrx` 일치, ACTIVE_HEALTHY, ap-northeast-2.
- delete-account 부재. 기존 함수는 route-proxy ACTIVE/v14/verify_jwt=true.
- 10절4파일 SHA256 전부 일치, frozen lock 및 exact SDK 보존.
- legacy API keys `enabled=true`. 값이 아닌 [활성 여부 전용 endpoint](https://supabase.com/docs/reference/api/v1-get-project-legacy-api-keys)를 사용했다. hosted 기본 SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY 공급 계약과 대조했으며 secret 추가/원문 조회0. 실제 handler env로 인증 요청을 보내는 검증은 하지 않았다.
- claim/count2개만 존재. source body는 각각015/016 원본과 공백 정규화 후 일치. security definer·search_path=pg_catalog,public, anon/authenticated/PUBLIC EXECUTE=false, service_role EXECUTE=true.
- claim: text/plpgsql/volatile, args(user UUID, request UUID), prosrc SHA256 `ab39aaa715820d04567816a1c96580162be95c894be8ec9ac9b9af74b97a3e79`.
- count: bigint/sql/stable, args(user UUID), prosrc SHA256 `142e806db90df47114be850d1e3fcbb2bc162b4788cf024259104a43d303fa3a`.

### B. 실제 배포·metadata

아래 명령 **1회**, exit0, 응답 대상은 delete-account만. 무명 전체 배포/prune/no-verify-jwt 사용0. CLI 업데이트 안내는 적용하지 않았다.

```sh
npx supabase@2.116.0 functions deploy delete-account --project-ref hwfsslihmmendxigklrx --use-api
```

사후 확인시각 **2026-09-08T16:27:37.760Z**:

| 항목 | 실제 확인값 |
| --- | --- |
| slug | delete-account |
| function ID | ba1a877f-f69d-4bde-a692-a4b8feceeecb |
| 상태/version | ACTIVE / 1 |
| verify_jwt | true |
| created_at / updated_at | 둘 다1788884837202 = 2026-09-08T16:27:17.202Z (09-09 01:27:17.202 KST) |
| 배포 식별 | `hwfsslihmmendxigklrx_ba1a877f-f69d-4bde-a692-a4b8feceeecb_1` (metadata의 배포 entry path 및 project/function/version 조합) |
| entry/import 설정 | 배포 source의 delete-account/index.ts 및 delete-account/deno.json |
| 기존 route-proxy | ID·ACTIVE/v14/verify_jwt=true·created/updated·entry path 모두 사전과 동일 |

SQL/migration/registry/secret/scheduler 변경을 수행하지 않았다. 사용자 데이터 보존을 확인하려고 실제 행을 읽지는 않았으며, 이번 실행에서 계정/기록 데이터 쓰기0이다. 메타데이터 보존을 사용자 행 전수 대조 증거로 확대하지 않는다.

### C. 승인 소스·의존성 사후 대조

고정 CLI2.116.0 `functions download delete-account --project-ref hwfsslihmmendxigklrx --use-api`를 별도 `/private/tmp/timefit-delete-deployed.sJsH88`에서 실행했다. 공유 소스 덮어쓰기0. 다운로드된 index.ts/handler.ts/deno.json의 SHA256은 **10절 승인값과 byte-for-byte 일치**.

주의: CLI upload 목록과 다운로드에는 **deno.lock 파일 자체가 없다**. 따라서 ‘운영 bundler가 frozen lock을 강제했다’고 기록하지 않는다. source exact import는 유지됐고, 추가 읽기1회로 [배포 body](https://supabase.com/docs/reference/api/v1-get-a-function-body)를 받아 **이번 실제 해석 결과**를 대조했다.

- bundle: ESZIP2.3, **7,804,993 bytes**, SHA256 **`5e36819dcf1ffa75098f6c451b3e17f986eec22471c34eb1535f4cf742e1de01`**.
- 보관: `/private/tmp/timefit-delete-deployed.sJsH88/deployed-body.bin` (로컬 제한권한). 소스/API 키 원문을 채팅이나 문서에 덤프하지 않았다.
- 승인 lock으로 받아 FIX-04에 사용한 Deno npm cache의9개 package 전체 일반파일을 bundle 내 bytes와 대조: auth-js197/197, functions-js53/53, phoenix49/49, postgrest-js30/30, realtime-js143/143, storage-js33/33, supabase-js33/33, iceberg-js9/9, tslib14/14 → **561/561 일치**. package.json도 포함한다. 대조기는 같은 임시 폴더의 `verify-dependencies.cjs`.
- root SDK redirect는 npm:@supabase/supabase-js@2.109.0. 전이 package 내용/버전은10절 lock의9개와 일치한다. bundle의 README에 나오는 옛 버전 문자열을 실제 의존 버전으로 오인하지 않았다.
- 이 검사는 실제 package 내용이 bundle에 동일하게 포함되는지 확인한 것이며, ESZIP 모든 내부 resolution edge를 별도 파서로 증명한 것은 아니다. **이번 소스/고정 dependency 결과 대조는 PASS**, 향후 재배포는 lock 업로드를 가정하지 말고 같은 bundle 대조를 유지해야 한다. 이 제한 때문에 lock을 제거하거나 SDK/배포를 변경하지 않았다.

### D. 무인증 거절·실행 제외

Authorization/apikey 없이 Content-Type만 지정하고 body=`{}`인 POST **1회**를 해당 endpoint에 보냈다. `curl --max-time 20` 결과 **HTTP401**, exit0. 응답 원문은 `/dev/null`로 버렸고 credential·실제 requestId·사용자 ID를 보내지 않았다. gateway 거절 확인이며 정상 JWT/AMR·Auth 삭제·cascade·앱 로컬 정리 성공 증거가 아니다.

사후 실패가 없어 endpoint 조건부 제거는 **실행0**. 배포 재시도0. 실제 계정 생성/삭제 테스트·관리자 사용자 삭제·개인화 C·전체 테스트/Archive·백업 재생성·commit/push0. 기존 앱의 자격을 갖춘 탈퇴 요청은 이제 처리될 수 있다.

### E. 네 항목 인수인계

1. 변경 대상: 운영 delete-account 신규1개(v1), 본 문서12절/11절 과거표시 및 DB README. 제품/SQL 소스 변경0. repo 밖 읽기 점검/의존성 비교기와 다운로드 산출물은 감사 근거다.
2. 유지: 프로젝트·verify_jwt=true·owner·password AMR600초·requestId·삭제 순서·server-only 권한·Storage no-op 한계·기존 기록/동의·다른 함수.9절 조건부 복구 및 계정 테스트 별도 승인 계약 유지.
3. 실제 결과: 사전 ref/hash/RPC/ACL/legacy 활성 PASS; 지정 CLI1회 성공; ACTIVE/v1/verify_jwt=true; 승인 소스3개 동일·lock 대응 package561파일 동일; 무인증 POST1회401. 기존 FIX-04 로컬35+1/typecheck/UI/core 증거를 반복 실행하지 않았다.
4. 다음: 통합은 배포 완료를 수락하되 **실제 탈퇴 E2E 완료로 고지하지 않는다**. 공개 문서/registry 및 정상 전용 계정 생성 준비 뒤8절D의 계정1개·최소 데이터·탈퇴1회/owner 한정 검증을 별도 승인한다. 현재 사용자 계정/개인화 C는 사용하지 않는다. 향후 재배포 시 CLI lock 비업로드 제한과 bundle 대조를 유지. 로그/백업/정기삭제 고지 미확인은8절C 별도다.
