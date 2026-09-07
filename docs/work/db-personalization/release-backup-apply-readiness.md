# DB-RELEASE-BACKUP-READINESS-01 — 보호 백업·최종 적용 준비

상태: **사용자 권장안 승인·지금 준비 실행, migration push 승인 전**. 기준 DEC-RELEASE-DB-READINESS-01. DB 단일 writer가 실행하며 실제 서버 업무 데이터 수정은 하지 않는다.

최신 실행(2026-09-07): **로컬 MAINTAIN·고정 CLI timeout 보완 PASS / 보호 백업 생성은 암호화 수단·안전한 사용자 로컬 입력 대기 / 전체 적용 준비 미완료**. 아래5절이 수행 결과다. 백업 폴더 생성만으로 백업/복원 PASS라고 하지 않는다.

## 1. 승인 범위와 읽기 순서

AGENTS.md → docs/README.md → DB README → 본 문서 → integration-decision/release-personalization-account.md 최신 결정 → release-personalization-migration-apply.md 8절 → release-migration-compatibility.md 8절을 읽는다.

승인: 기존 보존 서버의 Auth/public/migration 이력을 포함한 새 보호 백업 생성, 별도 임시 복원 검증, 로컬 MAINTAIN·timeout 보완, 실제 약관 준비 전 신규 일반 가입 일시 차단 수락. 보관 책임자는 사용자이며 DB 세션은 생성/검증 절차를 수행한다. 승인 전 백업 근거가 있다는 주장0.

미승인: 원격 migration push·서버 role/DB 전역 timeout 변경·기존 데이터 삭제·운영 복원·테스트 계정/표본 write·약관 seed·Edge 배포·유료 서비스 구매·commit/push. 나이 필드 삭제 범위는 앞선 선택을 유지하되 실제 삭제는 최종 적용 승인 후다.

## 2. 보호 백업 생성·복원 근거 확보

1. 먼저 서버 대상과 버전, 백업 범위·보호 위치·암호화·복원 방법을 짧게 제시한다. 기본 제안 위치는 repo 밖 사용자 소유의 전용 `TimeFitBackups` 폴더다. 정확한 절대 경로는 생성 전 확정/권한 확인하며 repo·공유 임시 폴더·클라우드 자동 동기화 위치는 사용하지 않는다. 쓰기 권한은 도구 승인 절차로 받는다.
2. 안전한 기존 암호화 수단/사용자 소유 복호화 키가 있는지 확인한다. 비밀번호·개인키는 채팅/문서/CLI 인자/로그로 받거나 출력하지 않는다. 키 제공이 필요하면 사용자 로컬 입력 등 안전한 경로를 안내하고 그 단계만 기다린다. 새 장기 암호화 키를 임의로 만들거나 백업과 함께 복호화 비밀을 보관하지 않는다.
3. Auth 데이터/필요 정의와 연결 정보, public 데이터/DDL/RLS/grants/functions/triggers, migration 이력 및 복원에 필요한 의존성을 포함하는 **일관된 snapshot**을 확보한다. public-only dump는 불가. provider 관리 스키마/role/권한의 복원 제한은 방법별로 확인한다. 운영 서버에서 dump 외 쓰기 작업0. 서비스 키·DB 접속 비밀번호를 archive에 불필요하게 포함하지 않는다.
4. 가능하면 암호화 스트림으로 저장하여 평문 dump를 남기지 않는다. 평문 임시 산출물이 필요하면 보호된 권한/암호화 저장소·정리 절차를 먼저 확보한다. 데이터 내용을 stdout에 출력하지 않는다. 암호화 실패·부분 파일은 성공 백업으로 등록하지 않는다. 파일 접근 최소 권한, 외부 공유0.
5. 별도 격리된 로컬/허용된 임시 복원 대상으로 실제 복원을 검증한다. 원격 기존 서버에 restore하지 않는다. 네트워크 격리·제한된 접근과 합성/실데이터 구분을 지키고, 복호화된 데이터 내용은 로그로 남기지 않는다. 관리형 Auth 서비스 전체 복원까지 입증하지 못하면 정확한 한계를 표시하고 SQL 복원 PASS와 구분한다.
6. 산출물 존재/hash뿐 아니라 Auth/public/이력 포함 여부와 실제 restore 후 정의·보존 기준선 비교를 확인한다. snapshot UTC/KST 시각, 정확한 보호 경로, 암호화 방식(비밀 제외), 파일 hash·크기, 복호화/복구 권한, 책임자(사용자), 복원 시험 범위/결과·절차를 인계한다. 백업 이후 쓰기 손실 구간도 설명한다.
7. 임시 복원 환경/평문은 exact 생성 대상만 정리하고 내역을 보고한다. 최종 암호화 백업은 검증 후 자동 삭제하지 않는다. 적용·QA 완료 시 폐기 여부를 사용자에게 재확인하는 항목을 남기며 영구 보유 정책으로 만들지 않는다.

## 3. 로컬 MAINTAIN·timeout 보완

1. 실제 서버에서 발견된 exact6개 앱 테이블의 anon/authenticated MAINTAIN12개를 불필요 권한 회수 범위에 포함한다. 서버 PostgreSQL 버전·권한 지원 차이를 확인하고, 해당 버전 실행형 fixture로 effective privilege 거절 및 service_role/필수 DML/RPC 보존을 검증한다. 구버전 테스트를 위해 지원하지 않는 권한 문법을 무조건 넣지 않는다. 광범위 상속 role/schema 변경0.
2. startup PGOPTIONS가 session pooler에서 기대대로 적용되지 않고 CLI가 RESET ALL하는 사실을 반영한다. 두 미적용 migration 내부의 transaction-local lock/statement 제한을 검토·구현한다. 기본 검토값 lock3초/statement60초이며 로컬 결과로 타당성을 설명한다. 서버 전역 설정0.
3. **고정 CLI2.116.0의 실제 로컬 적용 경로**로 timeout 유효값/경합 제한/실패 원자성·migration 이력 일관성을 검증한다. 별도 psql SET 성공만으로 CLI 전달 성공을 주장하지 않는다. 파일별 transaction과 두 파일 전체 원자성을 구분한다.
4. COMPAT의 빈 DB/기존 데이터 업그레이드·정확한 나이 삭제와 오류 복원·이메일 동기화·권한·개인화 회귀를 유지한다. 관련 테스트·typecheck/UI/core/diff 실행 후015/016 새 hash를 인계한다. 원격 적용된 환경 증거가 있으면 이력 파일 수정 중단·후속 방식 반환.

## 4. 가입 조건·최종 보고

실제 약관 준비 전 신규 일반 가입 일시 차단은 사용자 수락됐다. 이는 문서 검증을 삭제하거나 가입 보호를 우회하는 승인이 아니다. migration 적용 전 현재 가입 상태를 먼저 바꾸지 않는다. 출시 전 실제 문서 등록과 가입 정상 시나리오 검증을 잔여 게이트로 유지한다.

최종 적용 요청 전 대상/직전 이력/정확한 pending015→016·새hash·백업 복구 시점/경로/책임자/검증·나이 삭제1+1행 등 재확인된 범위·잠금 영향·임시 신규 가입 차단·실제 명령을 한 묶음 제시한다. 사용자의 **최종 원격 적용 승인 전 push 금지**. 백업 실패/복원 불명확/timeout 검증 실패는 준비 미완료로 보고한다.

인수인계는 본 문서에 변경 파일/목적, 유지 계약·승인 범위, 실행 결과·백업 근거, 다음 담당/위험 네 항목으로 기록한다. 실제 생성/로컬 보완/원격 적용을 분리하고 운영 원문·비밀을 남기지 않는다. 준비 완료→최종 승인→APPLY→QA C 순서를 따른다.

## 5. 실행 인수인계 — 2026-09-07

### 1) 변경 파일·보호 위치·실행 환경

- `supabase/migrations/202609070015_release_account_identity_records.sql`: PostgreSQL17 이상에서만 dynamic SQL로 exact6개 기존 앱 테이블의 PUBLIC/anon/authenticated MAINTAIN 회수. 상위 role/schema 전체 변경이나 service_role 회수0. 파일 앞에 transaction-local lock3초/statement60초 추가.
- `supabase/migrations/202609070016_dwell_personalization_storage.sql`: 동일 transaction-local lock3초/statement60초. 표본·동의·보유기간·RPC 본문 변경0.
- `scripts/test_release_identity_local_db.sh`: psql migration 실행에 `-1`을 적용하여 SET LOCAL을 같은 파일 transaction 안에서 검사. `cli` 모드는 합성 임시 cluster의 loopback만 열며 기존 서버/프로젝트 env를 주입하지 않는다.
- `scripts/test_release_migration_cli.mjs`(신규): 실제 CLI2.116.0, 실제 두 파일, 임시001~014 합성 DB/독립 clone3개를 사용. 파일 설정 관찰·경합·60초 timeout·실패 시 schema/data/history rollback·015만 성공한 부분 적용 검증. 운영 재시도/복원 코드가 아니다.
- `test/fixtures/release-migration-compat-privileges.sql`:17 이상 effective MAINTAIN 및 REINDEX 거절·service_role 보존 추가. 기존36개 위험 SQL 거절 유지.
- `test/release-identity-migration-contract.test.mjs`: timeout·버전별 MAINTAIN 정적 회귀1개 추가. 실행형 fixture를 대체하지 않는다.
- 본 문서: 결과/새hash/백업 차단 단계 기록. 중앙 문서·UI/native/engine·원본 데이터 수정0, 기존 공유 변경 되돌림0, stage/commit/push0.

보호 경로는 사용자에게 먼저 제시하고 도구 쓰기 승인을 받아 **`/Users/shindongheun/TimeFitBackups`**를 생성했다. 실제 mode=`drwx------`(700), 소유자=사용자. repo 밖 사용자 홈 직속이며 클라우드 동기화 폴더를 선택하지 않았다. **현재 빈 디렉터리이며 디렉터리 자체가 암호화된 것은 아니다.** 암호화 수단 확정 전 민감 데이터 저장0.

서버 읽기 전용 조회: 대상 `hwfsslihmmendxigklrx`, app/linked/DB ref 일치, PostgreSQL **17.6(170006)**, 이력001~014만 존재. 초기 로컬 도구14.19는17 MAINTAIN/17 dump를 검증할 수 없어 도구 승인 후 Homebrew PostgreSQL **17.11**을 별도 설치했다.17 메이저 호환 검증이며 서버와 minor까지 동일한17.6 바이너리 검증은 아니다. 기존14 링크/DB 서비스 교체·서비스 시작0. 설치 도구의 기본 데이터 디렉터리 생성과 실제 임시 검증 cluster를 구분하며 기존 DB를 reset하지 않았다.

### 2) 유지 계약·교체 이력·승인 범위

이전 세 권한만 revoke → 운영17 catalog에 MAINTAIN12개 잔류 → 버전170000 이상에서 exact6개 테이블(`profiles/courses/course_stops/course_legs/course_feedback/recommendation_events`)의 MAINTAIN을 PUBLIC/anon/authenticated에서 회수 → 유지보수 작업 권한 최소화 → **로컬 구현·검증 완료 / 원격 미적용**. 구버전은 SQL 문자열을 실행하지 않아 미지원 권한 문법 오류를 피한다. service_role MAINTAIN/필요 DML/RPC 보존.

startup PGOPTIONS에 의존 → session pooler에서2min/0 관찰 및 CLI의 파일별 RESET ALL → 두 migration 본문 맨 앞에 SET LOCAL lock_timeout3s/statement_timeout60s → 실제 파일 transaction 안에서 제한을 보장 → **고정 CLI 로컬 실행 PASS / 원격 미적용**. 값은 무제한 대기를 막고 현재 작은 이관의 로컬 완료 시간에 충분했지만 운영 성능/무경합 보장은 아니다. 파일 전체60초 예산이 아니라 개별 SQL statement 제한이며 lock3초가 우선 적용된다. standalone psql 실행은 반드시 `--single-transaction`이 필요하다.

앞선 exact 나이 삭제·보호 guard·이메일 동기화·account-only RLS·guest 학습0·소유권·멱등성·동의/삭제/개인화 보유 계약은 유지한다. 사용자의 신규 일반 가입 일시 차단 수락은 기록했으나 migration 미적용인 지금 가입 상태를 먼저 바꾸지 않았다. 실제 문서 registry/가입 정상 검증은 출시 전 별도 게이트다.

새 백업 생성·격리 복원은 승인됐지만 **사용자 복호화 수단을 임의 생성하는 승인으로 해석하지 않는다**. 기존 공개키/암호화 볼륨 경로 또는 사용자 로컬 입력창 방식 선택을 질문했으며 아직 응답/비밀 로컬 입력이 없다. 비밀번호·개인키·DB credential을 채팅/로그/문서/CLI 인자에 요청하거나 기록하지 않았다.

### 3) 실행 결과·백업 준비 상태·새 hash

실패 우선:

- PostgreSQL17 `privileges`: `residual MAINTAIN anon.profiles`로 exit3 확인 후 SQL 보완.
- 정적 timeout/MAINTAIN 회귀: 보완 전 FAIL 확인.
- 실제 CLI2.116.0의 DDL event 관찰: 기존 두 파일에서 `cli_timeout_missing: 0/0`로 FAIL 확인 후 SET LOCAL 추가. 최초 loopback fixture의 SSL 요구 오류는 로컬 URL에만 sslmode=disable을 명시하여 바로잡았다. 운영 TLS를 끄지 않았다.

| 최종 검증 | 결과 |
| --- | --- |
| PostgreSQL17 실제 CLI의015/016 적용 | PASS: 실제 설정 lock3s/statement1min, 이력16개, 기존 데이터 compatibility fixture 통과 |
| CLI lock 경합 | PASS: 약4510ms(접속 포함), lock timeout 오류, 이력14 유지·나이2행/원래 schema 보존 |
| CLI statement 경합 | PASS: SQL 내65초 sleep을 실제60초 제한으로 중단, 약61557ms(접속 포함), 이력14/schema/나이 보존 |
| CLI016 강제 실패 | PASS:015는 commit/이력15,016 객체·이력 없음. 재시도 없이 부분 상태 검증 |
| PostgreSQL17 upgrade + empty | 둘 다 PASS. exact 나이 제거/실패 복원·이메일·권한·계정·개인화/guest/reset/cascade 유지 |
| PostgreSQL17 MAINTAIN | PASS: effective12개 없음, anon/authenticated REINDEX12개 거절, service_role MAINTAIN6개·필요DML 보존 |
| PostgreSQL14 upgrade | PASS: 미지원 MAINTAIN 문법을 실행하지 않음, 기존 compatibility 통과 |
| DB/개인화 집중8파일 | **103/103 PASS** |
| typecheck / core / UI | **exit0 /272 PASS /549 PASS·0 FAIL·기존skip1** |
| diff 검사 | `git diff --check` PASS |

명령은 `PG_BIN=/opt/homebrew/opt/postgresql@17/bin scripts/test_release_identity_local_db.sh cli`, 같은 환경의 `upgrade`, `privileges`, 기본 empty 및14 기본 환경의 `upgrade`다. CLI 하네스 내부 호출은 고정2.116.0 `db push --db-url <합성127.0.0.1 대상> --skip-vault --yes`; repo/원격 linked 설정을 복사하지 않은 임시 프로젝트에서 실행한다. `--yes`는 이 합성 로컬 하네스에만 사용했으며 운영 승인을 대신하지 않는다.

로그: `/private/tmp/timefit-readiness-{static-red,maintain-red,maintain-green,cli-red,cli-green,upgrade17,empty17,upgrade14,contract,core,ui}.log`. 실제 CLI lock/statement 테스트 때문에 약1분 대기가 있으며 별도 진행 업데이트를 제공했다. 테스트 cluster/clone/생성 SQL은 각 mktemp exact 디렉터리의 trap으로 정리됐고 합성 데이터만 사용했다. 실데이터 평문 임시물은 생성하지 않았다.

새 SHA-256:

| 파일 | SHA-256 |
| --- | --- |
| `202609070015_release_account_identity_records.sql` | `ab9f35393d22bae81fc965d02f68e9ee5ebb0ef77cee97d3e85acb0ddc06c6e7` |
| `202609070016_dwell_personalization_storage.sql` | `93b76a2a9924d49051b5199b440ddf1fefe7929bebe7b5346b9affed48c4b5d8` |

수정 후 운영 **dry-run만** 재확인: `npx supabase@2.116.0 db push --linked --skip-vault --dry-run`, exit0, 정확히015→016, seeds/roles 빈 배열. CLI는 접속용 login role 초기화 메시지를 출력했으며 migration/업무 데이터 적용0이다. 현재 두 hash는 통합의 새 수락 대상이고 앞선 R1 hash와 다르다.

**보호 백업 실제 상태:**

| 항목 | 현재 결과 |
| --- | --- |
| 보호 위치 | `/Users/shindongheun/TimeFitBackups` 생성·700 확인. 아직 암호화 백업 파일 없음 |
| 보관 책임자 | 사용자(확정) |
| 암호화 방식·복호화 권한 | 기존 사용자 소유 수단 확인 대기. 대안은 사용자 비밀번호를 macOS hidden 입력창에서만 받아 AES-256 암호화 이미지 생성; 비밀은 저장소와 함께 보관하지 않음 |
| snapshot UTC/KST·복구 시점 | **미생성/미확정** |
| archive hash/크기·포함 범위 | **파일 없음/미검증** |
| 격리 복원 | **미실행**. synthetic CLI fixture는 운영 백업 복원 검증이 아님 |

계획한 복원 방법(아직 실행된 사실 아님): 사용자 암호화 수단이 준비되면 그 저장소 안으로 Auth/public/migration 이력과 필요한 정의·역할/extension 의존성을 담는 일관된 snapshot을 export한다. DB 비밀번호/서비스 키를 archive에 불필요하게 넣지 않는다. pg_dump snapshot과 같은 시점의 최소 보존 기준을 대조한다. 복호화된 dump와 복원용17 cluster도 암호화 볼륨 내부에 두고 TCP를 끈 socket-only 임시 DB에서 restore/정의·건수·보존 비교를 수행한 뒤 exact 복원 cluster/평문만 정리·unmount한다. 최종 암호화 archive는 남기고 적용/QA 종료 시 폐기 여부를 사용자에게 묻는다. provider 관리 role/extension 의존성은 export 전 inventory로 확인하고 SQL 복원 PASS를 관리형 Auth 서비스 전체 복원/로그인 성공으로 확대하지 않는다.

### 4) 다음 단계·위험·적용 승인 경계

1. **사용자 로컬 입력 단계만 대기:**기존 암호화 볼륨/공개키의 경로(비밀 제외)를 제공하거나 macOS 로컬 비밀번호 입력창 방식을 선택한다. 비밀번호/개인키를 채팅에 보내지 않는다. 신규 장기 키를 에이전트가 임의 생성하지 않는다. 해당 응답 뒤 암호화 저장소 준비→실제 보호 export→격리 restore를 이어간다.
2. **DB:**실제 백업의 UTC/KST snapshot, archive 위치/hash/크기, Auth/public/이력/의존성 포함 여부, 사용자 복호화 가능성, 실제 복원 결과·한계를 이 문서에 보완한다. 암호화 실패/부분 파일을 성공 백업으로 등록하지 않는다. 현재 전체 준비는 미완료다.
3. **통합:**MAINTAIN/timeout 새 hash와 로컬103/272/UI549+skip1 결과를 수락한다. 신규 가입 일시 차단 수락은 현행이며 실제 문서 등록/가입 복구는 별도 작업이다.
4. **최종 적용 전:**대상/이력/pending/새hash/직전 나이 삭제 건수(이전 관찰 profile1+Auth1행)/백업 시점·복구 수단/잠금 영향/가입 차단/정확한 실행 명령을 한 묶음으로 다시 제시하고 최종 원격 승인을 받는다. 백업 이후 신규 쓰기는 해당 snapshot 복원 시 손실될 수 있으므로 보호 시점과 적용 사이 간격을 재평가한다.
5. 원격 migration 적용·운영 복원·데이터 삭제·테스트 계정/표본 쓰기·약관 seed·Edge 배포·유료 구매는 이번 실행에서0. 운영 실패 시 반복 push/자동 복원/세션 강제 종료로 우회하지 않고 이력·객체의 부분 상태를 인계한다. QA C 실제 저장/read/추천 반영은 별도 승인 이후다.
