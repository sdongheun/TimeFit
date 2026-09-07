# DB-RELEASE-MIGRATION-COMPAT-01 — 015 업그레이드 충돌 보완

상태: **사용자 나이 삭제 선택 반영·로컬 구현/검증 완료, 원격 적용 금지**. 기존 나이 필드 삭제의 로컬 이관 범위는 확정됐다. 실제 약관·백업/복구·서버 ACL 경로 확인 및 별도 적용 승인 전 APPLY 중단은 유지한다.

최신 실행 결과(2026-09-07): **빈 DB 및 기존 데이터001~014→015→016 PASS**. 7절은 사용자 답변 전 부분 완료 이력이며, 현행 결과·hash·남은 적용 조건은 8절이다. 로컬 완료를 원격 적용 승인으로 해석하지 않는다.

## 기준과 소유

AGENTS.md → docs/README.md → DB README → 본 문서 → release-personalization-migration-apply.md 6절 → 최신 release-personalization-account.md → 실제001~016 migration/DB 하네스를 읽는다. DB writer만 migration/repository 계약 테스트/로컬 하네스/DB 작업 문서를 수정한다. UI/엔진/원본 데이터/중앙 정책 직접 변경0, 원격 쓰기·repair·reset·push·계정 생성·백업 export·commit 금지.

현행 정책: 신규 나이 입력·수집 없음. 기존 값 정리는 별도 범위 확인 뒤 수행한다. 015에 포함된 무조건 기존 나이 UPDATE를 이미 승인된 삭제로 보지 않는다. 이메일 인증은 정상 동기화하되 클라이언트 위조는 막는다. 회원/별도 동의·기록 격리·개인화 표본 정책·보유기간은 유지한다.

## 1. 실패 우선 — 기존 데이터 업그레이드 회귀

기존 빈 DB001~016 PASS는 유지하되, 임시 로컬 DB001~014 → 합성 Auth/profile 나이 보유·이메일 인증 전후·기존 course graph →015→016을 별도 고정 fixture로 추가한다. 원격 사용자 값을 복제하지 않는다. `/private/tmp` 일회성 재현을 지속 가능한 DB 테스트/하네스로 옮긴다. 발견한 015:37 guard 실패를 먼저 재현한다.

공유 원격 또는 기존 로컬 데이터베이스를 reset하지 않는다. 임시 DB는 exact 대상만 생성·정리하며 기본 하네스의 격리 규칙을 유지한다.

## 2. 나이 처리 — 사용자 답변 조건부

질문 부모는 기존 나이 신규 수집 제거 결정이며 자식 선택은 보존 환경의 기존 값 처리다. 아직 답변이 없으면 migration의 나이 처리 분기를 확정하지 말고 나머지 작업을 진행한다.

- 보존·미사용 선택 시: 미적용015의 기존 profiles/Auth metadata 나이 제거 UPDATE를 분리해 이번 적용에서 실행하지 않도록 수정한다. 신규 nullable·입력 없음은 유지하고 기존 값을 새 추천/개인화에 쓰지 않는다. 별도 삭제 migration을 실행 가능한 pending으로 자동 추가하지 않는다. 보존은 영구 보유기간 승인으로 해석하지 않으며 추후 정리 검토를 인계한다.
- 삭제 선택 시: 정확한 대상 필드만 이관할 관리 경계를 설계하고 로컬 fixture로 검증한다. trigger 전역 disable/클라이언트가 설정 가능한 bypass/넓은 관리자 예외로 우회하지 않는다. 보호 경계와 나머지 필드 보존을 입증할 수 없으면 설계안을 반환한다. 선택 답변이 있어도 원격 삭제는 백업·복구 준비와 별도 적용 승인 전 금지.

승인된 답변과 이전 방식→관찰→교체→이유→상태를 DB 작업 문서에 남기고 중앙 기준 갱신은 통합에 요청한다. 현재 미적용015 수정은 허용하되, 다른 관리 환경에 이미 적용된 증거가 나오면 이력 변경을 멈추고 후속 migration 방식을 반환한다.

## 3. 이메일 인증 동기화 — 정책 변경 없이 보완

007의 정당한 Auth 서버 동기화를015 guard가 깨뜨리지 않게 한다. 실제 trigger/function 실행 주체·security definer/invoker·권한을 추적하고 최소 허용 범위를 정한다. 전체 immutable 필드를 관리자에게 무조건 풀지 않는다. 기존 계정·신규 계정의 미인증→인증 갱신 성공과 클라이언트의 email_verified_at/id/동의 필드 직접 변경 거절을 로컬 SQL 역할 fixture로 검증한다. 문자열 검사만으로 완료하지 않는다.

## 4. 잔여 권한 최소화

현재 서버에서 관찰된 anon/authenticated TRUNCATE/REFERENCES/TRIGGER 권한이 실제 어떤 테이블·PUBLIC/직접 grant·상속 경로로 부여됐는지 catalog로 확인한다. 앱 계약상 필요 없는 권한만 exact 테이블/역할에서 회수하도록 미적용 migration을 보완한다. schema 전체 권한 일괄 변경이나 service_role/Admin 필수 권한 회수 금지.

RLS로 TRUNCATE를 막았다고 판단하지 않는다. 실제 임시 SQL 역할로 불필요 작업 거절, 허용된 회원 SELECT/RPC 성공, anonymous 회원 데이터 접근 거절, 다른 계정 접근 거절을 검증한다. 원격에서 위험 SQL을 실행해 시험하지 않는다. 저장된 기존 데이터·route cache와 unrelated 정책은 유지한다.

## 5. 가입 문서·백업은 우회하지 않고 적용 조건으로 유지

015가 실제 약관 registry 없이 신규 일반 가입을 막는 것은 가짜 동의로 우회하지 않는다. 실제 문서 등록/가입 재개는 별도 준비이고, 문서 없는 가입 거절 및 올바른 문서+명시 동의 가입 성공은 로컬 합성 fixture로 검증한다. 기존 로그인·이메일 인증은 가입 INSERT 검증과 분리한다.

백업 근거 미확인은 코드 보완으로 해소되지 않는다. 필요한 public/Auth/정책/이력 복구 범위를 인계하되 운영 백업 생성/export/복원은 이번 명령에 포함하지 않는다.

## 6. 검증·인수인계

- 빈 DB + 기존 데이터 업그레이드 두 경로 모두 통과. 기존 graph/나이 선택 범위/나머지 Auth metadata/동의 기록 보존을 각각 검증한다.
- 관련 DB 계약·격리·개인화 테스트, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check` 실행. 환경 실패/기존 skip/제품 실패를 구분한다.
- 실제 SQL 정의/RLS/grant 효과와 신규/기존 이메일 동기화 테스트 근거를 기록한다. 신규 수집 없음·guest/import 학습0·원래 표본 계약 유지.
- 변경 파일/목적, 유지 정책·승인 선택, 실행 결과, 잔여 위험/결정 네 항목과015/016 새 hash를 본 문서에 남긴다. 나이 답변 대기라면 부분 완료로 표시한다.
- 완료 후 통합 검토 → 백업·복구/가입 영향 확인 → 사용자 원격 적용 승인 → APPLY 명령 재개 → QA C 순서다. 로컬 보완 완료를 서버 적용/실제 학습 완료로 표기하지 않는다.

## 7. 로컬 실행 인수인계 — 2026-09-07 (사용자 답변 전 이력)

### 1) 변경 파일과 목적

- `supabase/migrations/202609070015_release_account_identity_records.sql`: 이메일 인증 guard 최소 허용 및 기존 앱 테이블6개의 잔여 DDL/파괴 권한 회수. **나이 UPDATE 두 문장은 변경하지 않았다.** 미적용015 수정 허용과 APPLY 6절의001~014 이력 근거를 사용했으며, 다른 환경의 적용 여부를 새로 조회하지 않았다. 적용 흔적이 추가로 나오면 이 파일 수정 대신 후속 migration 검토로 전환한다.
- `scripts/test_release_identity_local_db.sh`: 기존 `empty`(기본) 이외에 `upgrade`, `email`, `privileges` 실행 모드 추가. 각 실행마다 새 `mktemp` cluster를 만들고 PostgreSQL superuser를 명시적으로 `postgres`로 고정한다. 원래 OS 계정 이름으로 initdb하면007의 실행 주체 계약을 정확히 재현하지 못한다. TCP listen을 끄고 exact 임시 socket만 사용하며 종료 trap으로 해당 cluster만 정리한다. DB URL/운영 env를 읽지 않는다.
- `test/fixtures/release-migration-compat-{before,after,catalog,email,privileges}.sql`:001~014의 합성 미인증/인증 회원2명, 나이/Auth 기타 metadata/기존 동의시각, 코스1·장소1·구간2·후기1·이벤트1·공개 route cache1 보존 snapshot,015→016 후 비교, 실제 Auth/클라이언트 역할 실행, grant/trigger catalog 점검을 영구 fixture로 추가.
- 본 문서: 실패 우선 근거, 부분 완료 상태, 소스 hash와 다음 조건 기록. UI/native/engine/중앙 문서·운영 데이터 수정0. 기존 공유 작업 트리 변경 되돌림0, stage/commit/push0.

### 2) 유지 계약·변경 이력·권한 근거

**이메일:**007의 postgres 예외 →015가 모든 이메일 변경까지 금지하여 Auth 인증 UPDATE 실패 →015 guard에서 이메일 필드에만 `current_user='postgres'` + `pg_trigger_depth()=2` + 해당 `auth.users.email_confirmed_at`과 exact 일치 조건 허용 → 서버 원본 동기화를 유지하면서 직접 위조/넓은 관리자 예외를 막기 위함 → **로컬 구현·검증 완료, 원격 미적용**.

실행 경로는 `supabase_auth_admin UPDATE auth.users` → `on_auth_user_email_confirmed` → postgres 소유 `sync_profile_email_verification` SECURITY DEFINER → `profiles_guard_changes`의 SECURITY INVOKER다. 로컬 catalog에서 owner/prosecdef/trigger enabled=O를 확인했다. guard를 SECURITY DEFINER로 바꾸지 않았으며 클라이언트 GUC/JWT의 bypass flag도 없다. id/나이/기존 동의시각은 이메일 경로에서도 무조건 immutable이다. 관리자 직접 UPDATE도 이메일/나이/id/동의 모두 거절한다. 원격 적용 직전에 실제 함수 owner와 trigger topology가 이 계약과 같은지 재확인해야 한다.

**권한:**기존 DML-only revoke → 상위 환경의 기본 grant에서 남은 TRUNCATE/REFERENCES/TRIGGER는 RLS와 무관하게 허용될 수 있음 → exact `profiles`, `courses`, `course_stops`, `course_legs`, `course_feedback`, `recommendation_events`에서 PUBLIC/anon/authenticated의 세 권한만 회수 → 필요한 DML/RPC/service_role과 unrelated route/cleanup 정책 보존 → **로컬 구현·검증 완료, 서버 ACL 경로 최종 확인 대기**.

로컬은 Supabase형 `ALTER DEFAULT PRIVILEGES ... GRANT ALL ... TO anon,authenticated,service_role`를 합성 bootstrap에 주입했다(제품 SQL의 권한 완화가 아니다).001~014 뒤 `aclexplode(relacl)`에서 위6개 테이블 각각 anon/authenticated의 세 권한, 총36행을 확인했다. grantor=postgres/direct ACL, PUBLIC 경로0, role membership0. route/anonymous-cleanup6개 테이블은 기존 migration의 revoke로 해당 권한0이다. `pg_auth_members`와 trigger catalog 조회도 fixture에 남겼다.

**원격 catalog 근거 한계:**이전 APPLY 문서에는 잔여 권한 관찰만 있고 exact PUBLIC/direct/inheritance 결과는 보존되어 있지 않다. 이번에는 로컬 전용 지시에 따라 원격 조회도 하지 않았다. 따라서 로컬 direct-grant 재현을 서버 ACL 출처 확정으로 표시하지 않는다. 적용 담당이 승인된 read-only catalog 조회로 exact 경로를 확인해야 하며, 다른 inherited grant가 확인되면 자동으로 부모 role 권한을 회수하지 말고 범위를 다시 인계한다.

**나이(미확정):**신규 수집 제거에 기존 값 일괄 삭제까지 포함한015 →001~014 기존 profile의 나이 guard에서015:37 실패, 삭제 범위도 미승인 → 사용자에게 보존·미사용 권장안과 정확한 필드 삭제 로컬 검증안을 질문 → **답변 대기**. 이번 변경에서 UPDATE 삭제/실행 순서 이동/guard 나이 예외를 만들지 않았다. `after.sql`의 무손실 비교는 안전 회귀 기대치이며 영구 보존 정책 승인이 아니다. 삭제 선택이면 승인 범위에 맞춰 기대 snapshot과 이관 경계를 먼저 보완해야 한다. 답변 전까지 현재015는 적용 금지다.

닉네임 선택·중복·1~20자, 실제 동의 registry와 서버 accepted_at, account-only RLS/기록 소유권, guest 가져오기 학습0, 완료 멱등성, outbox32건/7일과 서버180일·최근5개/최소3개, 삭제·재인증 계약은 변경하지 않았다.016은 byte 변경0이다. 신규 profile 나이NULL 검증을 유지하며, 보존 기존 값을 신규 추천으로 연결하는 코드 변경도 없다.

### 3) 실패 우선·실행 결과

제품 SQL 변경 전에 세 독립 경로를 실행했다.

| 실행 | 보완 전 | 보완 후 |
| --- | --- | --- |
| `scripts/test_release_identity_local_db.sh upgrade` | exit3,015:37 `immutable profile fields cannot be changed by clients` | **동일 FAIL 유지**: 나이 응답 대기.015/016 전체 적용 및 after fixture는 도달 전이며 PASS 아님 |
| `scripts/test_release_identity_local_db.sh email` | exit3, Auth 서버 UPDATE에서 `immutable_profile_field` | PASS: registry 없음/동의false/문서version 불일치 거절, exact 동의 가입·신규 이메일 동기화·no-age·consent2행·회원 SELECT/nickname RPC·client 직접4필드 및 관리자6필드 거절 |
| `scripts/test_release_identity_local_db.sh privileges` | exit3, `TRUNCATE allowed: profiles` | PASS: anon/authenticated ×6테이블 ×TRUNCATE/REFERENCES/TRIGGER 실제36문장 거절, effective privilege36개 없음, service_role 각 DML24개 보존 |
| `scripts/test_release_identity_local_db.sh` | 기존 빈 DB 경로 유지 | PASS:001~016·A/B/anonymous·코스 원자성·완료/guest import 멱등·학습 제외·표본 집계·reset·cascade |
| DB/소유권/개인화 집중 회귀8파일 | — | **101/101 PASS** |
| `npm run test:typecheck` | — | exit0 |
| `npm test` | — | **270/270 PASS** |
| `npm run test:ui` | — | **549 PASS /0 FAIL /1 기존 SKIP**, 총550 |
| `git diff --check` | — | PASS |

집중 명령: `npx tsx --test test/release-identity-migration-contract.test.mjs test/dwell-storage-contract.test.ts test/release-account-contract.test.ts test/release-owned-completion.test.ts test/release-identity-device-flow.test.ts test/release-identity-lock-ownership.test.ts test/release-identity-priority-remediation.test.ts test/live-learning-evidence.test.ts`.

로그는 `/private/tmp/timefit-compat-{upgrade-red,upgrade-final,email-red,email-green,privileges-red,privileges-green,empty,contract,core,ui}.log`. 합성 자료만 사용했다. 초기 initdb shmget EPERM/tsx IPC EPERM은 sandbox 환경 실패이며 승인 재실행 후 통과했다. 권한 fixture의 최초 FK 검사는 PostgreSQL의 TEMP→일반 테이블 참조 제한으로 실패하여 테스트 전용 일반 schema로 바로잡았다(제품 권한 변경으로 우회하지 않음). UI skip은 `철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다`이며 새 skip을 만들지 않았다.

**미실행 성공 주장 금지:**`upgrade`가015에서 중단되므로 기존2명 이메일 호환·graph/metadata/기존 동의 보존·이관 후 격리 검사는 fixture에만 있고 아직 실행 완료하지 못했다. 빈 DB/신규 이메일 PASS가 이를 대신하지 않는다. 실제 Supabase Auth HTTP/실기기/서버 학습도 검증하지 않았다.

현재 작업본 SHA-256(적용 승인용 최종 hash 아님):

| 파일 | SHA-256 |
| --- | --- |
| `202609070015_release_account_identity_records.sql` | `a129eec4e04c5b4df12baa287d225af02df7b0a372b02462124134fd0b608b9f` |
| `202609070016_dwell_personalization_storage.sql` | `c0c72f9f5fd35e8dcdae4bd8b3c5552d56cfd7683cb6f28023168eab41b21e89` |

### 4) 남은 조건·다음 담당

1. **사용자→DB:**기존 나이 보존·미사용 또는 정확한 나이 필드 삭제 로컬 검증 선택. 답변 후015 분기·필요한 계약 테스트를 보완하고 `upgrade` 전체 PASS 및 새 hash를 다시 인계한다. 아직 삭제 정책/데이터 삭제 승인으로 해석하지 않는다.
2. **DB→통합:**위 부분 완료 검토, 서버 ACL의 PUBLIC/direct/inheritance 경로 및 Auth trigger owner 재확인. 현재 remote migration/repair/reset/배포/데이터 변경0이며 기존 서버는001~014 보존 상태라는 이전 관찰을 유지한다.
3. **통합·운영 담당:**실제 이용약관·개인정보 문서 URL/version/내용·등록 승인 및 registry 준비 전 신규 일반 가입 차단 영향을 별도 수락한다. `.invalid` fixture 문서를 운영 seed로 사용하지 않는다.
4. **운영 담당/사용자:**Auth metadata와 연결 데이터, public 데이터/schema/RLS/grants/functions/triggers, migration 이력을 포함한 복구 가능 시점·보호 위치·권한/담당자·복원 리허설·신규 쓰기 손실 구간을 확인한다. public-only 백업은 충분하지 않다. 운영 백업 export/복원 자체는 미수행이며 별도 승인 대상이다.
5. **적용/QA 담당:**나이 선택·업그레이드 PASS·통합 수락·실제 문서와 백업 조건 해소 → 사용자 원격 적용 승인 → APPLY 재개 → QA C. 이번 작업을 전체 완료/서버 적용 가능/실제 학습 성공으로 승격하지 않는다.

## 8. 사용자 삭제 선택 후 최종 로컬 인수인계 — 2026-09-07

### 1) 변경 파일·승인 및 이력

사용자가 보존·미사용/정확한 나이 필드 삭제 로컬 검증 선택 질문에 **“삭제 진행”**이라고 답했다. 부모는 신규 나이 수집 제거 결정, 이번 자식 결정은 기존 `public.profiles.birth_year`, `age_band`를 NULL로 하고 `auth.users.raw_user_meta_data`의 최상위 `birth_year`, `age_band` 두 키를 제거하는 범위다. 계정/기록 행 삭제, 다른 metadata 삭제, 원격 적용 승인이 아니다. 중앙 결정 반영은 통합 담당에 요청한다.

이전 무조건 UPDATE → 기존 guard와 충돌·삭제 범위 미확정 → 사용자 정확한 나이 필드 삭제 선택 → 단일 `DO $erase_legacy_age$` 안의 잠금·제한 guard·정확한 UPDATE·guard 복원 → trigger 보호를 유지한 기존 데이터 이관 → **현행 로컬 구현·검증 완료 / 원격 미적용**. 7절의 나이 답변 대기·upgrade FAIL은 이력으로 대체된다. 보존·미사용 분기는 이번 선택에서 채택하지 않았다.

이번 턴 변경:

- `202609070015_release_account_identity_records.sql`: 나이 이관을 단일 atomic DO 문으로 변경. postgres 실행 확인, Auth→profiles 순서의 exact 테이블 ACCESS EXCLUSIVE 잠금, 원래 guard 정의 저장, 나이NULL 전환만 허용하는 임시 guard, 두 저장소의 정확한 필드 정리, 원래 guard 복원. 뒤의 기존015 이메일 호환 guard 설치는 유지.
- `test/fixtures/release-migration-compat-after.sql`: 삭제 선택에 맞춘 snapshot 기대치. 다른 Auth metadata 전체, 기존 동의/인증 시각, 코스·장소·구간·후기·이벤트·route cache 전 필드 보존 비교. profile의 `updated_at`만 기존 timestamp trigger의 정상 갱신이므로 비교에서 제외하며 업무 필드 삭제 범위를 넓히지 않는다.
- `scripts/test_release_migration_age_boundary.mjs`(신규), `scripts/test_release_identity_local_db.sh`: 실제015의 제한 guard/DO 본문을 읽어 임시 DB에서 실행. 나이 비NULL 재설정·동의·이메일·id·created_at 동시 수정7개와 authenticated의 정확한 NULL 변경도 거절. profile 삭제 뒤 Auth 처리 직전에 실패를 주입해 **외부 BEGIN 없이 단일 DO 자체가 원래 guard와 profile/Auth 나이 값을 모두 복원**함을 확인한다. DB 전용 스크립트는 자동 테스트 검색 폴더 밖에서 명시 실행한다.
- `test/release-identity-migration-contract.test.mjs`: 잠금/정의 복원/전체 나머지 필드 비교/trigger-disable 금지 정적 회귀1개 추가. 실행 SQL 검증을 대체하지 않는다.
- 본 문서: 사용자 선택, 교체 이력, 결과, 새 hash, 적용 게이트 기록.016 수정0, 타 세션 변경 되돌림·stage/commit/push0.

### 2) 유지한 보호·공개 계약

제한 guard도 계속 활성 trigger다. 임시 guard의 허용은 `current_user=postgres`, trigger depth1, 기존 나이가 하나 이상 비NULL, 새 나이 두 값NULL, **나이를 제외한 전체 row 동일**일 때뿐이다. 관리자에게 모든 immutable 필드를 풀지 않는다. 클라이언트가 설정할 GUC/권한/capability나 영구 bypass 함수/role을 추가하지 않는다. `pg_get_functiondef`로 저장한 원래 정의를 같은 DO에서 복원하고, 오류는 PostgreSQL statement rollback으로 정의와 데이터를 함께 복원한다. 잠금 밖에 임시 guard가 commit되는 구간이 없다.

이메일 최소 허용·회원/anonymous RLS·필요 DML/RPC·service_role 권한·닉네임·실제 가입 동의·완료/guest import 멱등성·학습 제외·개인화 보유기간·삭제/재인증 계약은 유지한다. 신규 나이 수집 재도입0. 원격 서버/실사용자 자료 조회·복제·삭제0. 로컬 합성 나이 값만 제거했고 임시 cluster는 종료 시 정리됐다. 실제 기존 나이 값의 복구는 향후 원격 실행 전에 준비할 보호 백업이 필요하다.

### 3) 최종 테스트·새 hash

실패 우선: 삭제 기대 snapshot과 정적 회귀를 먼저 추가한 상태에서 정적1 FAIL/5 PASS 및 기존015:37 upgrade exit3을 확인한 뒤 SQL을 수정했다.

| 최종 실행 | 결과 |
| --- | --- |
| `scripts/test_release_identity_local_db.sh upgrade` | **PASS**:001~014 합성 기존 데이터→나이 경계 위조 거절/강제 오류 복원→015→016→정확한 나이 제거·나머지 데이터 보존→기존/신규 인증 동기화·가입 문서/동의 게이트·A/B/anonymous 격리·위험 권한36문장 거절 |
| `scripts/test_release_identity_local_db.sh` | **PASS**:빈 DB001~016 및 기존 계정·개인화·guest 학습0·reset·cascade fixture |
| 7절 집중 명령8파일 | **102/102 PASS** |
| `npm run test:typecheck` | **exit0** |
| `npm test` | **271/271 PASS** |
| `npm run test:ui` | **549 PASS /0 FAIL /1 기존 SKIP**, 총550 |
| `git diff --check` | **PASS** |

로그: `/private/tmp/timefit-compat-upgrade-final.log`, `timefit-compat-empty.log`, `timefit-compat-contract.log`, `timefit-compat-age-core.log`, `timefit-compat-ui.log`. DB-only 스크립트를 처음 fixtures 아래 놓아 `npm test` 자동 발견이 인자 없는 실행을 시도한 2 FAIL은 테스트 배치 결함이었다. scripts로 이동하고 하네스 경로를 수정한 뒤 전체271/271 및 upgrade를 재실행했다. 로컬 경계 스크립트 최초 상대 경로 오류도 수정 후 재검증했다. 제품 정책/skip 변경으로 PASS를 만들지 않았다.

| 파일 | 최종 로컬 SHA-256 |
| --- | --- |
| `202609070015_release_account_identity_records.sql` | `0f8c8e3f3ec467562d721b4a0f0217dfc568da3359a5d64c54d675ad48e5a751` |
| `202609070016_dwell_personalization_storage.sql` | `c0c72f9f5fd35e8dcdae4bd8b3c5552d56cfd7683cb6f28023168eab41b21e89` |

### 4) 남은 적용 조건·다음 담당

- **통합:**나이 삭제 선택과 이번 local PASS 수락, 중앙 결정/보드 갱신. 기존7절의 대기 hash가 아니라 위 hash를 검토한다.
- **DB/적용 담당:**원격 read-only catalog에서 exact ACL의 PUBLIC/direct/inherited 경로와 Auth sync owner/trigger 순서를 재확인해야 한다. 현재 증명은 합성 direct-grant 경로이며 서버 출처 확정을 대신하지 않는다. 이관은 Auth/profiles ACCESS EXCLUSIVE 잠금을 필요로 하므로 적용 시간대·timeout/transaction 경계와 가입/인증 일시 대기 영향을 계획한다. lock 실패 시 보호를 풀거나 임의 재시도하지 않는다. 이미015가 적용된 다른 환경 증거가 나오면 이력 수정 중단.
- **운영/사용자:**실제 약관 문서·registry 등록/가입 차단 영향 수락과 Auth 포함 백업/복구 준비는 독립적인 미완료 조건이다. 기존 public 데이터·함수/RLS/grants/trigger, Auth metadata/연결 정보, migration 이력을 복원할 수 있는 보호 위치·담당·시점·리허설·손실 구간 근거가 필요하다. 삭제된 나이 값은 별도 백업 없이 역migration으로 복원할 수 없다.
- **다음 순서:**통합 수락→위 적용 조건 해소→사용자 별도 원격 적용 승인→APPLY 재개→QA C. 이번 “삭제 진행”은 제시했던 로컬 검증 선택의 답변이며 운영 삭제/배포로 확대하지 않았다. 서버 실제 인증·학습 성공/실기기 검증은 여전히 미수행이다.
