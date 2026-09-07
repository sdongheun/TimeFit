# DB-RELEASE-PERSONALIZATION-APPLY-01 — 보존 환경 015·016 적용

상태: **충돌 보완 로컬 결과 검토 완료·적용 준비 재개, 실제 적용은 최종 승인 후**. 최신 실행은 7절이다. 6절의 충돌 FAIL은 보완 전 이력이며 반복 구현하지 않는다. 백업·서버 권한/trigger·가입 영향 확인은 미완료다. 서버 적용0. 현재 Supabase는 실제 사용자가 없더라도 보존 대상이다. 초기화·기존 기록 일괄 삭제·테스트용 대체 환경 취급을 금지한다.

## 1. 범위·읽기 순서

AGENTS.md → docs/README.md → DB README → 본 문서 → 데이터베이스설계.md → live-learning-evidence-contract.md 6~7절 → integration-decision/release-personalization-wave.md의 현재 서버 보존 점검을 읽는다. 다음 두 migration을 **전체** 읽고 실제 원격 정의와 비교한다.

- `202609070015_release_account_identity_records.sql`
- `202609070016_dwell_personalization_storage.sql`

통합 관찰: 앱/linked project/DATABASE_URL 일치, 014까지 local/remote 이력 일치, 015/016 remote 미등록, 실제 public 카탈로그에 신규 계정 완료·dwell 객체 없음. 현재 상태를 다시 확인하며 이전 점검만 믿고 적용하지 않는다. 기존 CLI는 config 최신 키 parsing 실패가 있었으므로 정상 작동하는 CLI 버전을 확인하고 config를 낮춰 고치지 않는다.

수정·실행 소유자는 DB 단일 writer. UI/엔진/카탈로그/기존 정책 임의 변경 금지. Edge Function 배포·약관 문서 seed·테스트 계정 생성·테스트 표본 write·보유기간 scheduler 설정·commit/push는 별도 범위다.

## 2. 적용 전 필수 게이트

1. 프로젝트 대상 일치와 migration 이력, schema/RLS/grants/관련 함수·trigger 정의를 read-only로 대조한다. 값/계정 원문 없이 건수와 일치 여부만 보고한다. 부수효과 있는 consent/sample RPC는 사전 조회에 쓰지 않는다.
2. 015의 기존 profiles 컬럼 변경·constraint·Auth handle_new_user·나이 데이터 제거·RLS 교체·course 생성/교체·삭제 함수 변경을 영향표로 작성한다. 016의 신규 저장·동의·표본·profile·purge와 기존 count 함수 교체를 포함한다. 새 테이블만 추가하는 작업으로 표현하지 않는다.
3. 특히 `profiles.birth_year/age_band` 비어 있지 않은 행, `auth.users.raw_user_meta_data`의 해당 키 존재 행 수를 한정 집계한다. **제거 대상이 1건이라도 있으면 적용 전 멈추고 삭제 영향과 보존 방법을 사용자에게 제시하여 명시 승인받는다.** 나이 수집 철회 정책만으로 보존 서버의 기존 값을 조용히 제거하지 않는다.
4. 기존 nickname 값/constraint, 중복 client_request_id, 예상 밖 부분 적용/정의 drift 등 실패 가능성을 확인한다. 정확한 검사는 migration 전체 정의에서 도출한다. manual repair/버전 이력 조작으로 우회하지 않는다.
5. 활성 약관/개인정보 문서가 없는 상태에서 015의 가입 trigger가 신규 가입에 주는 영향을 확인한다. 가짜 URL/version/동의 seed 금지. 기존 로그인 영향과 새 가입 차단을 구분한다. 기존 가입 가능 상태를 바꾸는 영향이 있으면 사용자에게 알리고 적용 전 승인받는다.
6. 영향 받는 schema·데이터·Auth metadata를 실제로 복원할 수 있는 백업 범위/시점/접근권한/복구 수단을 확인한다. 백업 기능이 있다고 추정하지 않는다. 일반 public dump만으로 Auth까지 보존됐다고 하지 않는다. 민감한 백업은 repo/로그에 저장하지 않고 보호된 위치와 보관·폐기 책임을 정한다. 스냅샷 생성/민감 데이터 export에 별도 권한이 필요하면 요청한다. 복구 가능한 근거가 없으면 적용 중단.
7. 기존 로컬 DB 하네스와 관련 계약 테스트로 적용 순서·migration 호환성을 검증한다. 임시 로컬 데이터만 사용하고 원격 DB를 하네스 대상으로 지정하지 않는다. 두 파일 hash와 검증 결과를 기록한다.

**실행 승인 경계:** 위 영향표·대상·백업·정확한 pending 015/016·실행 명령을 제시한 후 사용자에게 이 보존 환경의 적용 승인을 받는다. 본 작업명령 전달을 예상 밖 삭제/정책 변경의 포괄 승인으로 해석하지 않는다. 승인 전은 read-only/로컬 검증까지만 진행한다.

## 3. 승인 후 적용

1. 승인한 소스 hash/서버/직전 이력이 그대로인지 확인한다. 동시 migration writer나 다른 pending이 발견되면 중단한다.
2. migration 도구의 dry-run으로 pending이 정확히 015→016인지 확인한다. 실제 명령은 설치된 CLI help에서 확인한다. 다른 migration이 함께 적용되는 포괄 push 금지. db reset, 이력만 repair, 전체 schema 재생성, 소스 SQL 일부 삭제 후 우회 금지.
3. 도구의 transaction 범위를 확인하고 015/016을 순서대로 적용한다. 두 파일 전체가 자동으로 하나의 transaction이라고 가정하지 않는다. lock/statement timeout과 실패 처리 기준을 정하고 강제 세션 종료는 하지 않는다.
4. 실패 시 새 쓰기를 중단하고 적용 이력/실제 객체를 read-only 재확인한다. 015만 성공한 경우를 포함해 부분 적용 사실과 사용자 영향을 보고한다. 반복 push·수동 함수 교체·자동 백업 복원 금지. 복원도 현재 새 데이터 손실 가능성을 검토하고 별도 승인한다.

## 4. 적용 후 검증·C 인계

- 이력 015/016 일치, 예상 테이블/컬럼/constraint/index/함수/trigger/grants/RLS 정의를 소스와 대조한다. RLS enabled=true만으로 계정 격리 PASS 금지.
- 기존 보호 대상 행 수/기존 함수·route cache 구조 등 사전 기준선 보존을 확인한다. 나이 제거가 별도 승인된 경우 그 승인 범위와 제거 건수만 기록한다. 사용자 원문은 노출하지 않는다.
- 테이블/함수 존재 확인과 실제 앱 저장 성공을 분리한다. 쓰기성 RPC를 사후 읽기 점검으로 실행하지 않는다.
- QA C에 `schema 적용`, `실제 인증/RLS`, `방문 ack`, `표본 저장/read`, `추천 반영`을 별도 상태로 인계한다. 이번에는 뒤의 실제 데이터 흐름을 미확인으로 남길 수 있다. 테스트 계정/최소 방문·표본 생성 및 exact 정리는 사용자 별도 승인 뒤 진행한다.
- 개인정보 문서/약관 registry·Edge 삭제 함수 배포·180일 purge scheduler는 별도 출시 잔여이며 migration만으로 완료 처리하지 않는다.

## 5. 완료 인수인계

본 문서에 (1) 변경 파일·서버 변경 및 목적 (2) 유지한 공개 계약/데이터와 승인된 예외 (3) 실행 명령·버전·hash·전후 상태·검증 결과 (4) QA C 인계·미확인·복구 위험 네 항목을 남긴다. 로그에 URL credential/API key/token/email/Auth metadata를 남기지 않는다. 문서만 변경했는지 실제 적용했는지 제목부터 구분한다. 적용/삭제를 수행했다면 변경 대상과 복구 수단을 사용자에게 요약한다.

## 6. 적용 전 점검 결과·중단 인계 — 2026-09-07

**현재 두 파일 그대로 적용 승인을 요청할 수 없는 상태다.** 보존 서버는 읽기 전용으로만 접속했고, 실패는 임시 로컬 DB에서 재현했다. 원격 migration/업무 데이터 변경0. 초기화·가짜 약관 seed·migration repair·trigger 비활성화로 우회하지 않았다.

### 대상·기준선

- 대상 프로젝트: `hwfsslihmmendxigklrx`. 앱 URL·linked project·DATABASE_URL 대상 일치=true(credential 출력0). 다른 테스트 프로젝트로 취급하지 않는다.
- psql 세션 `default_transaction_read_only=on`, `BEGIN READ ONLY`, statement timeout10초/lock timeout3초, 마지막 ROLLBACK. migration 이력 및 스키마/정책/권한/trigger 정의와 한정 건수 SELECT만 실행했다. 최초 sandbox DNS 실패 후 승인된 네트워크로 조회 성공. 부수효과 있는 RPC 호출0.
- 서버 이력: 001~014 14개, 015/016 미등록. public 테이블12개, 모두 RLS enabled. 신규 consent/account/dwell 테이블 없음. 이 결과는 RLS 실행 검증 전체 PASS가 아니다.
- 보존 기준선: Auth10행, profiles1행, courses2행, course_stops2행, course_legs4행, feedback0행, recommendation_events0행. 개별 계정·좌표·값 원문은 조회/출력하지 않았다.
- **나이 제거 대상**: profiles.birth_year 비NULL1행, age_band 비NULL1행(profiles 총1행). Auth metadata birth_year 키1행, age_band 키1행. 두 Auth 키 대상의 동일 행 여부나 profile과의 소유자 연결은 추정하지 않는다. 실제 제거0. 값 보존 수단과 별도 제거 승인이 필요하다.
- 서버에 nickname/nickname_updated_at/client_request_id 컬럼은 없다. 따라서 현재 기존 nickname 불량값·client_request_id 중복 충돌은 해당 없음. 승인 직전 다시 점검한다.

### 영향과 발견된 차단 사유

| 변경 | 영향·판정 |
| --- | --- |
| 015 profile nullable 전환·nickname constraint·나이 UPDATE | 기존 guard는 나이 변경이면 postgres도 예외를 발생시킨다. 015의 UPDATE는 guard 교체보다 먼저 실행돼 **37행에서 실패**한다. 새 guard 역시 나이 변경을 금지하므로 단순 순서 이동만으로 해결된다고 보지 않는다. 보호된 데이터 이관 설계와 승인 후 재검증 필요. |
| 015 Auth metadata 키 제거 | 해당 키만 제거하며 나머지 metadata를 보존하려는 SQL이다. 기존 값 복원에는 Auth까지 포함한 보호 백업이 필요하다. 현재 단계에서는 실행하지 않았다. |
| 가입 trigger 교체 | 기존 AFTER INSERT handle_new_user 연결 확인. 015는 새 registry를 비어 있는 상태로 생성하므로 승인된 실제 문서 등록 전 신규 일반 가입은 signup_consent_required로 차단된다. anonymous 신규 생성은 profile을 만들지 않고 통과한다. 기존 로그인 자체를 이 INSERT trigger가 차단하는 것은 아니지만, 이후 회원 데이터 접근은 새 RLS 영향을 받는다. 가짜 약관으로 해결 금지. |
| profile guard 교체·이메일 확인 | 기존 guard의 email_verified_at 변경에 대한 postgres 예외가 새 guard에서는 사라진다. 기존 email_confirmed_at UPDATE trigger가 존재하므로 인증 동기화 회귀 위험도 후속 재현 대상이다. 전체 호환 검증 완료로 보고하지 않는다. |
| 기존 RLS19개·profile 쓰기 권한 | account-only 조건으로 교체하고 profile 직접 쓰기를 회수한다. 익명 JWT의 기존 회원 데이터 접근이 차단된다. 서버 현재 anon/authenticated에 기존 테이블 TRUNCATE/REFERENCES/TRIGGER grant가 남아 있음. 015의 일부 DML revoke만으로 해당 권한이 제거되지 않는다. 실제 TRUNCATE 실행은 하지 않았으며 별도 권한 검토 필요. |
| courses·create/replace·삭제 RPC | client_request_id 고유 index와 원자적 저장 추가, replace는 anonymous 거절 후 자식 graph 교체, 신규 소유 완료/가져오기/삭제 멱등성 테이블·함수 추가. migration 적용만으로 기존 코스 graph를 삭제하는 것은 아니다. |
| 016 | 동의·표본·파생 profile·mutation 신규4테이블, owner/동의/완료 ack 검증, 180일 read/purge, 최신5개·최소3개 집계, count_account_owned_rows 교체. read RPC에도 만료 삭제가 포함됨. scheduler/Edge 배포는 포함하지 않음. |

### 로컬 검증과 정확한 소스

| 파일 | SHA-256 |
| --- | --- |
| `202609070015_release_account_identity_records.sql` | `f5b9a267de5e9ed9d1647fc9cf2b50a9dca58c88d4fef51ceda27f92b8b6ef3a` |
| `202609070016_dwell_personalization_storage.sql` | `c0c72f9f5fd35e8dcdae4bd8b3c5552d56cfd7683cb6f28023168eab41b21e89` |

- 두 migration 전체를 읽었다. 제품 SQL 수정0.
- `scripts/test_release_identity_local_db.sh`: PASS, `/private/tmp/timefit-apply-local-db.log`. 빈 임시 DB에001~016 적용 후 account A/B·anonymous·표본·reset·cascade 검증. 원격 대상 주입 없이 실행했다. 임시 DB는 종료 trap으로 제거됐다.
- `npx tsx --test test/release-identity-migration-contract.test.mjs test/dwell-storage-contract.test.ts test/release-account-contract.test.ts`: **15/15 PASS**, `/private/tmp/timefit-apply-contract-approved.log`. 최초 sandbox IPC EPERM은 환경 실패로 분리 후 승인 실행했다.
- **기존 데이터 업그레이드 반례 FAIL**: `/private/tmp/timefit-upgrade-repro.mjs`가 기존 하네스의001~014 뒤 합성 Auth/profile 나이1행을 넣고015를 한 번 실행. exit3, `015:37 ERROR: immutable profile fields cannot be changed by clients`, `guard_profile_changes() line 10`. 원격 데이터 복제0, 로컬 합성값만 사용, 임시 DB 자동 제거. 빈 DB PASS가 기존 데이터 업그레이드 PASS를 대신하지 못함을 확인했다. 실제 서버에 실패 SQL을 실행하지 않았다.

### 백업·복구와 적용 명령(실행 금지 상태)

- 현재 복구 가능한 snapshot/PITR 시점, Auth 포함 범위, 보관 위치·접근 담당자, 복원 권한/리허설 증거는 **미확인**이다. 백업이 없다고 단정하지도, 기능 존재만으로 준비됐다고 보지도 않는다. 민감 데이터 export/백업 생성은 미실행이며 별도 승인 필요.
- 필요한 범위는 public schema/RLS/grants/함수/trigger·기존 데이터와 Auth metadata/연결 데이터·migration 이력이다. public-only dump로는 부족하다. 암호화된 repo 외 보호 위치·보관/폐기 담당을 지정하고, 새 쓰기 이후 복구 시 손실 구간을 평가해야 한다. 복원도 별도 승인하며 자동 롤백 명목의 데이터 삭제는 하지 않는다.
- CLI help 확인 버전 **2.116.0**. `db push`는 기본 vault 변경 가능성이 있으므로 아래처럼 `--skip-vault`를 필수로 사용한다. config를 낮춰 고치지 않는다.

```sh
# 차단 해소·백업 증명·새 소스 hash 수락 후 계획 확인
npx supabase@2.116.0 db push --linked --skip-vault --dry-run
# pending이 정확히015→016이고 대상/소스/백업이 재확인된 뒤 사용자 적용 승인 필요
npx supabase@2.116.0 db push --linked --skip-vault
```

현재 dry-run/push 모두 미실행. include-all/include-seed/include-roles/repair/reset 사용 금지. 실제 적용 시 CLI의 파일별 transaction 범위와 session timeout 전달 방법을 추가 확인해야 한다(이번 help만으로 미확정). 두 파일이 하나의 transaction이라고 보장하지 않는다. 다른 pending 또는015 단독 성공/실패 발견 시 추가 적용을 멈추고 이력·객체만 읽기 재확인한다.

### 다음 담당·수락 조건

1. DB/통합: 기존 데이터 나이 이관 guard 충돌과 이메일 확인 회귀·잔여 권한을 검토하고 **수정 범위부터 승인**받는다. 원격 수동 함수 교체나 migration 조각 생략은 금지. 이번에는 발견 보고만 했으며 migration 수정하지 않았다.
2. 보존 서버 담당/사용자: Auth 포함 백업·복구 근거와 보호 위치/담당을 제공하거나 백업 준비를 별도 승인한다. 나이 값 제거 및 실제 문서 등록 전 신규 일반 가입 차단 영향은 각각 명시 수락해야 한다.
3. 위 항목 해결·기존 데이터 업그레이드 회귀 통과 후 새 hash와 대상/명령을 다시 제시하고 적용 승인을 받는다. **현재 상태의 적용 승인을 선요청하지 않는다.**
4. QA C 인계: schema 적용=미실행, 실제 인증/RLS=미검증, 방문 ack/표본 저장/read/추천 반영=미검증. A/B 기존 관찰은 유지하되 서버 학습 성공과 분리한다.

변경 파일은 이 작업 문서뿐(임시 진단·재현 스크립트는 `/private/tmp`). 중앙 기준·제품·migration·기존 사용자 변경 보존. stage/commit/push0. 원격 조회는 승인 범위에서만 수행했고 원격 데이터 삭제0, 백업/복원0이다.

## 7. 보완 후 적용 재개 명령 — DB-RELEASE-PERSONALIZATION-APPLY-01 R1

### 현행 인수인계와 검토 범위

`release-migration-compatibility.md` **8절**을 읽는다. 사용자 삭제 선택과 local upgrade/empty PASS, 집중102·core271·UI549/기존skip1·typecheck 결과가 최신이다. 통합은 실제015 코드·upgrade/집중 로그·hash를 대조했으며 전체 테스트를 재실행했다고 주장하지 않는다. 7절의 사용자 답변 대기/upgrade FAIL은 이력이다. 나이 삭제 선택은 정확한 필드의 로컬 보완 선택이며 보존 서버의 최종 적용 승인과 구분한다.

대상 hash:

- 015: `0f8c8e3f3ec467562d721b4a0f0217dfc568da3359a5d64c54d675ad48e5a751`
- 016: `c0c72f9f5fd35e8dcdae4bd8b3c5552d56cfd7683cb6f28023168eab41b21e89`

### A. 지금 실행할 적용 준비

1. 앱/linked/DB 대상 일치,001~014 일치·015/016 미적용, 위 hash를 재확인한다. hash·원격 정의가 달라지면 자동 진행하지 않는다.
2. 읽기 전용으로 Auth sync 함수 owner/security/trigger 순서를 확인한다.015 이메일 예외의 postgres·depth2·Auth 원본 일치 조건이 실제 topology에 맞는지 검증한다. PUBLIC/direct/inherited ACL 경로와 exact6개 앱 테이블의 위험 권한을 확인한다. 예상 밖 상속 권한은 부모 role을 임의 수정하지 말고 반환한다.
3. profiles/Auth 나이 대상 건수와 기존 코스 graph·metadata·동의·route cache의 보존 기준선을 최소 집계로 확보한다. 실제 값/토큰/계정은 로그에 넣지 않는다. 제거 범위는 profiles.birth_year/age_band NULL 및 Auth metadata 최상위 동명 두 키뿐이다.
4. Auth와 public 데이터/정의·정책·trigger·권한·migration 이력을 포함하는 복구 가능한 백업 근거를 확인한다. 없으면 보호 위치·범위·방법과 필요한 별도 export/생성 승인을 요청한다. public-only dump·존재 여부만으로 완료 처리하지 않는다. 민감 백업은 repo에 넣지 않는다.
5. 실제 문서 registry 미준비면 신규 일반 가입 차단 상태를 명시한다. 가짜 문서 seed/trigger 우회 금지. 기존 로그인과 가입 차단을 구분하고, 실제 문서 준비 또는 임시 신규 가입 차단 수락을 최종 승인 항목에 포함한다.
6. Auth/profiles ACCESS EXCLUSIVE lock의 영향과 실행 시간대·lock/statement timeout·CLI 파일별 transaction 경계를 확인한다. 단일 나이 DO 원자성과 두 migration 전체 원자성을 혼동하지 않는다. 연결 방식에 맞는 timeout 전달을 실제로 검증하고 보호 기능을 해제하지 않는다.
7. 고정 CLI `npx supabase@2.116.0 db push --linked --skip-vault --dry-run`으로 정확한 pending015→016만 확인한다. 다른 pending/대상 변경/부분 적용이면 중단한다. 실제 push는 아직 실행하지 않는다.

위 확인 뒤 사용자에게 한 번에 `대상 일치·두 hash·기존 나이 삭제 건수/범위·나머지 데이터 보존·백업/복구·신규 가입 영향·잠금 영향·실제 적용 명령`을 제시하고 **최종 원격 적용 승인**을 받는다. 반복 질문을 줄이되 미확인 항목을 준비 완료로 합성하지 않는다.

### B. 최종 승인 뒤만 실행

승인 직전 기준선/hash/pending이 그대로이면 `npx supabase@2.116.0 db push --linked --skip-vault`를 승인된 timeout 설정으로 실행한다. 정확한 두 파일 외 적용0. reset/repair/include-all/include-seed/include-roles·수동 일부 SQL 생략 금지. 적용 중 다른 writer 금지.

실패 시 반복 실행·자동 rollback/복원 금지. 이력/객체를 read-only로 확인하고015만 적용됐는지 등 부분 성공 범위를 보고한다. 잠금 실패 시 세션 강제 종료나 trigger disable로 우회하지 않는다. 백업 복원은 신규 데이터 손실 가능성을 설명하고 별도 승인받는다.

### C. 사후 검증·QA 인계

이력015/016·객체/함수/trigger/RLS/grants·나이 제거 범위·기존 graph/동의/나머지 metadata 보존을 사전 기준과 비교한다. updated_at의 기존 trigger 갱신은 보완 인계 허용 범위와 구분하여 기록한다. 실제 삭제 건수와 복구 수단을 사용자에게 알린다.

여기까지는 schema 적용 검증이다. 테스트 계정 생성·방문/sample RPC 쓰기·reset/정리는 자동 승인하지 않는다. QA C의 실제 저장→read→추천 반영은 전용 테스트 계정/최소 쓰기·정리 승인 후 별도로 진행한다. 약관 등록·Edge 배포·180일 scheduler도 별도 범위다.

결과에는 변경 파일/서버 변경 목적, 유지 계약과 승인된 삭제 범위, 실행 로그·검증·전후 이력, QA C 잔여/복구 위험 네 항목을 기록한다. 준비 완료/승인 대기/적용 완료/QA C 완료를 구분한다.

## 8. R1 적용 준비 실측 — 2026-09-07

**상태: dry-run PASS / 준비 조건 미충족 / 최종 적용 승인 요청 전 중단. 실제 push0.** 호환성8절 local PASS는 유지하며 나이 정책·과거 upgrade 실패를 다시 구현하지 않았다. 아래 새 관찰을 기존 보완 실패와 혼동하지 않는다.

### 1) 변경 파일·수행 범위

공유 작업 트리에서는 본 문서만 변경했다. 읽기 전용 진단 코드는 `/private/tmp/timefit-apply-r1-readonly.cjs`, 집계/catalog 로그는 `/private/tmp/timefit-apply-r1-readonly.log`, timeout 실측은 `/private/tmp/timefit-apply-r1-timeout.log`다. `.env.local`은 연결 대상 확인/인증에만 사용했고 credential·실사용자 값·계정 ID·나이 값·Auth metadata 원문 출력0이다. product/migration/UI/native/engine/중앙 문서 수정0, stage/commit/push0.

DB 접근은 명시 `BEGIN READ ONLY`/ROLLBACK, 부수효과 RPC0. 백업은 Management API의 목록만 조회했으며 export/생성/복원0. 지정된 CLI dry-run이 `Initialising login role...`를 출력했다(CLI의 접속용 역할 초기화 단계). 이를 포함한 도구 내부 인증 동작까지 무조건 “서버 쓰기 전무”라고 단정하지 않으며, 업무 데이터·migration·약관·테스트 계정·표본·Edge 변경은 수행하지 않았다.

### 2) 대상·hash·보존 기준과 공개 계약

- 대상 `hwfsslihmmendxigklrx`: 앱 URL project ref/linked project/DATABASE_URL 일치. DATABASE_URL은 direct host가 아니라 서울 **session pooler 5432**이며 `postgres.<project-ref>`로 대상이 지정된다. 처음 direct-host-only 검사가 중단한 것은 검사 가정 오류였으며 다른 프로젝트 접속은 없었다. pooler의 exact host suffix/user ref/port를 확인한 뒤 재실행했다.
- 원격 이력001~014 14개, 로컬 대응 버전과 일치.015/016 미등록. public12테이블 모두 RLS enabled. 신규 registry/completion/dwell 테이블 없음.
- 파일 SHA-256은 수락본 그대로:
  - 015 `0f8c8e3f3ec467562d721b4a0f0217dfc568da3359a5d64c54d675ad48e5a751`
  - 016 `c0c72f9f5fd35e8dcdae4bd8b3c5552d56cfd7683cb6f28023168eab41b21e89`
- 기준선: Auth10, profiles1, courses2, stops2, legs4, feedback0, events0, route_cache144행. profile 인증시각1·기존 terms1·privacy1 비NULL. 현재 시점 대기 lock0(미래 적용 시 무경합 보장 아님).
- **원격 승인 시 삭제할 정확한 범위:**profile1행의 birth_year/age_band 두 값NULL, Auth1행의 metadata 최상위 birth_year/age_band 두 키 제거. 각 키1행, 키 합집합도1행임을 이번에 집계 확인했다. 두 저장소의 개별 소유자 연결은 출력/추정하지 않았다. 계정·코스·방문·route cache 행 삭제는 없다. 나머지 metadata/기존 동의/graph는 보존하며 profile updated_at은 기존 trigger로 갱신된다.
- 현재 확보한 원격 기준은 최소 집계다. 같은 건수만으로 내용 보존까지 입증했다고 하지 않는다. 승인 직전 보호 백업/일관된 최소 비교 기준을 확보하고 적용 후 허용 필드 외 변경을 검증해야 한다. 이번에는 민감 snapshot/export를 만들지 않았다.

**Auth topology 확인:**sync와 handle_new_user는 postgres 소유 SECURITY DEFINER, guard는 postgres 소유 INVOKER. Auth AFTER UPDATE OF email_confirmed_at→sync→profile BEFORE UPDATE guard의 depth2 조건이 현재 정의와 맞는다. profiles_guard_changes→profiles_set_updated_at 순서, 두 Auth trigger를 포함해4개 모두 enabled=O. 현재 정의가007/012 계열과 부합하며 제품 Auth HTTP 테스트나 이메일 변경은 실행하지 않았다.

**ACL 출처 확인:**exact6개 앱 테이블의 TRUNCATE/REFERENCES/TRIGGER는 postgres가 anon/authenticated에 직접 부여한 ACL이다(36개). 두 역할의 재귀 membership 결과는 자기 자신뿐, PUBLIC 경로0이며 예상 밖 상속 경로는 없다. 따라서 수락015의 exact revoke가 이36개에 대응한다. service_role 권한은 변경하지 않았다.

**추가 발견 — MAINTAIN:**같은6개 테이블 각각 anon/authenticated에 `MAINTAIN` 직접 grant도 있다(12개). 수락015는 이 권한을 회수하지 않는다. 이전 로컬 PostgreSQL fixture의 세 권한만으로 운영 권한 최소화 전체를 확정하면 안 된다. 이번 R1에서 승인 hash를 임의 변경하지 않았다. DB/통합에 이12개가 필요한지 검토하고, 불필요하면 exact revoke 및 해당 PostgreSQL 버전 회귀·새 hash 수락을 요청한다. 광범위 role/schema 권한 회수나 원격 위험 SQL 검사는 하지 않는다.

### 3) dry-run·백업·timeout·검증 결과

고정 CLI help와 실행은2.116.0. 실행한 명령:

```sh
npx supabase@2.116.0 db push --linked --skip-vault --dry-run
npx supabase@2.116.0 backups list --project-ref hwfsslihmmendxigklrx
```

dry-run exit0: pending이 정확히 `202609070015_release_account_identity_records.sql` → `202609070016_dwell_personalization_storage.sql`. structured result의 dryRun=true, seeds=[], roles=[]이며 다른 pending0. 실제 push는 실행하지 않았다.

**백업 조회:**region=ap-northeast-2, walg_enabled=true, pitr_enabled=false, backups=[], physical_backup_data={}. 현재 API가 제공하는 목록에서 복원 가능한 백업 시점을 확인하지 못했다. 백업 기능 flag=true를 복원 가능 증거로 간주하지 않는다. 외부 별도 백업 유무·보호 위치·담당자·복구 권한·리허설도 미확인이다. 따라서 현재 복구 수단은 **준비 미확인**이며 최종 적용 승인으로 건너뛸 수 없다.

권장 다음 준비는 기존 Auth/public/이력 포함 보호 백업의 근거 제공이다. 없다면 repo 밖 암호화 저장소와 보관/폐기 담당·복원 대상/리허설 방법을 지정한 뒤 **별도 민감 export/백업 생성 승인**을 받아야 한다. public-only dump로 대체하지 않는다. 관리형 백업 범위와 한계는 [공식 백업 안내](https://supabase.com/docs/guides/platform/backups)를 참고하되, 이 프로젝트의 복원 가능성은 실측 근거로 확정한다.

**가입 영향:**registry 테이블 자체가 현재 없다.015가 빈 registry를 만들므로 실제 문서 등록 전 신규 일반 가입은 signup_consent_required로 차단된다. 기존 로그인은 INSERT trigger와 별개이며 이메일 동기화 topology는 위와 같다. 실제 문서 준비 또는 임시 신규 가입 차단의 사용자 수락은 별도 필요하다. 가짜 문서·테스트 계정·약관 등록0.

**timeout 실측:**psql startup PGOPTIONS에 statement_timeout10초/lock_timeout3초를 전달했지만 session pooler의 실제 값은 **2min/0**이었다. transaction_read_only=on과 명시 read-only transaction은 확인됐다. 추정 timeout을 적용 완료라고 기록하지 않는다. 별도 읽기 전용 transaction에서 `SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='3s';` 후 실제값10s/3s는 확인했고 ROLLBACK했다. 이 실측은 psql 해당 transaction에만 해당하며 CLI migration 세션으로 전달됐다는 증거가 아니다.

CLI2.116.0 [migration 실행 소스](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/shared/legacy-migration-apply.ts)는 각 파일 전 RESET ALL 및 일반 SQL 파일의 statements+이력 insert를 한 batch로 실행한다. 현재 두 파일에는 비transaction 문장/VACUUM/CONCURRENTLY/transaction=false 선언이 없어 **파일별 원자성 경로에 해당한다는 소스 검토 결과**다. 두 파일 전체가 하나의 transaction인 것은 아니다.015 성공 후016 실패 가능성을 남긴다. 실제 운영 push로 검증한 것은 아니다.

startup timeout이 보장되지 않고 CLI가 RESET ALL하므로 별도 psql SET을 먼저 실행하는 방식도 해결책이 아니다. 권장 검토안은 두 미적용 migration 앞부분의 transaction-local 제한(예: lock3초/statement60초)을 고정 CLI의 로컬 적용 fixture로 검증하고 새 hash를 수락받는 방식이다. 이번에는 지정 hash를 바꾸거나 ALTER ROLE/DB/서버 전역 timeout을 실행하지 않았다. 현재 전달 검증을 마친 **최종 push 명령은 아직 없다**.

조회 초기 sandbox DNS/npm 실패는 승인된 네트워크 재실행 후 해소. `git diff --check` PASS. 제품/SQL 변경이 없어 core/UI/typecheck를 이번 R1에서 반복하지 않았으며 호환성8절의102/271/549+skip1 결과를 기존 근거로 인용한다.

### 4) 사용자 결정·최종 승인 및 QA C 인계

현재 적용 명령의 형태는 아래지만 **실행 금지·timeout 미확정**이다.

```sh
# 백업·가입 영향·MAINTAIN·timeout 처리 및 최종 hash 수락 뒤에만 최종 승인 요청
npx supabase@2.116.0 db push --linked --skip-vault
```

한 번에 결정/준비할 항목:

1. Auth/public/이력 복원 가능한 기존 백업 근거를 제공하거나, 보호 위치·범위·담당자를 지정하여 별도 백업/export 준비를 승인한다. 아직 백업 생성/복원 승인은 없다.
2. DB/통합이 exact MAINTAIN12개와 파일 내 transaction-local timeout 보완안을 검토·수락하고 새 hash/로컬 CLI 전달 검증을 인계한다. R1을 이유로 현재 수락 hash를 조용히 변경하지 않는다.
3. 실제 약관 준비 또는 준비 전 신규 일반 가입 일시 차단을 수락한다. 문서 registry 쓰기는 별도 승인이다.
4. 위 조건 완료 후 대상·pending·나이1+1행 삭제·복구 시점/수단·잠금 시간대·최종 명령/hash를 모아 **최종 원격 적용 승인**을 받는다. 이번 결과로 선승인/조건부 push를 요청하거나 실행하지 않는다.

QA C 인계: schema 적용=미실행(001~014), 실제 인증/RLS 실행=미검증, 방문 ack/표본 저장/read/추천 반영=미검증. 테스트 계정 생성·최소 표본 쓰기·정리·약관 등록·Edge 배포·scheduler는 별도 승인 범위를 유지한다. 앞으로 적용 실패 시 반복 push/자동 rollback/강제 세션 종료 없이 read-only 이력·객체로 부분 적용 여부를 보고하고, 복원은 신규 쓰기 손실 위험을 설명한 뒤 별도 승인받는다.
