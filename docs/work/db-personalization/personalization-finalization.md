# DB-PERSONALIZATION-FINALIZE-01 — 남은 개인화 마감

## 현행 완료 — 017 이후 C1회 실행·저장·조회·추천·제한 정리 PASS (2026-09-08 01:51 KST)

### 1. 변경 파일·실행 증거

공유 변경은 본 문서만이다. 사용자 C 재개 승인 후 정상 앱의 현재 계정 confirmed→새 prepare→보호 plan 전달을 거쳤다. Mac clipboard로 수신한 새 plan은 이전 종료 ID를 재사용하지 않았으며 기준선 capture가 예정 ID 부재를 확인했다.01:49:24 KST 실제 read-only 기준선: 기존 완료0·표본0·집계0, 동의ON. repo 밖 `/private/tmp/timefit-c-post017-operator.cjs`에서 기존 capture/receipt/seal/cleanup을 재사용하고 원문 baseline은 프로세스 메모리에 보존했다. receipt를 Mac clipboard로 전달하고 사용자에게 입력→키보드 닫기→ready→1회 실행을 안내했다. 운영 ID/계정/receipt 원문은 본 문서에 복사하지 않는다.

사용자 실기기 최종 캡처: `status:verified`, reason/rejectionReason/panelFailure 모두 null. trace는 button_entered→controller_entered→receipt_accepted→runner_called→runner_returned→result_displayed, progress는 verified/completed3/submitted3, cleanup은 retired. report는 completed3/submitted3/existingSampleCount0/observedSampleCount3/changed:true/**beforeStayMin30→afterStayMin40**이다. 로컬 캡처 위치는 사용자 첨부 `/var/folders/z9/4c3qvwrs78g05wh5xkkj1c7m0000gn/T/codex-clipboard-ucn9b3.png`이며 계정/plan 일부가 포함되어 공유 repo/테스트 fixture로 복사하지 않았다.

### 2. 실제 저장·조회·추천 반영

| 항목 | 이번 실제 증거 / 판정 |
| --- | --- |
| 기기 완료 응답→서버 방문 ack→표본 제출 | 공개 runner verified, completed3/submitted3. 로컬 완료와 서버 저장은 별도 확인 |
| exact 서버 완료·표본 | 01:50:46 KST 기존 manifest seal에서 완료3·표본3, 각 planned tuple·장소 연결 및 동의 기준선 일치 |
| 체류 표본·관련 집계 | 01:51:25 KST read-only 조회: 이번3개 표본 각각40분, sample_count3/window_sample_count3/median_dwell_min40, 동의ON |
| 동일 owner 공개 조회 | 실제 정상 owner-pinned SDK/RPC와 runtime 경로의 verified 반환. report observedSampleCount3, existingSampleCount0; runner 내부 public read와 owner rows의 multiset 및 exact sample 대조를 통과 |
| 다음 추천 계산 | 실제 엔진 `buildReleaseOneStopRepresentativeCourseV1`의 course.stops[0].stayMin을 그대로 추출한 report가30→40분, changed:true. 단순 화면 문구 변경이 아님 |
| 실행 종료 | 동일 runner 최종 cleanup retired. pending일 때는 반환될 수 없는 종료 상태를 확인한 뒤 관리자 정리 실행 |

경로/clock은 승인한 고정 fixture, 외부 경로 API 호출0이다. 정상 Auth·방문 확인 evidence·학습 적격성 판단·완료·Supabase 저장/조회·엔진 계산은 기존 공개 연결을 사용했다. 실제3회 방문이나 Live Activity 실기기 확인을 새로 수행한 증거가 아니라 **승인된 합성 runtime의 실제 서버 end-to-end 검증**이다. 보고된 체류값은 실제 course 계산 결과지만 UI summary에 없는 전체 course 시간 필드까지 개별 실기기 수치로 관찰했다고 주장하지 않는다.

### 3. 제한 정리·기존 데이터 보존

01:51:30 KST 기존 `cleanupCManifest`를 단1회 실행해 **cleaned/completions3/samples3/tombstones3**을 수신했다. 이번 exact 완료3 및 연결 장소3·표본3만 제거하고, 영향 세부분류 집계를 남은 표본 기준으로 정상화했다. 기존 동의·기록·표본·이전 시도의 tombstone은 전체 행 대조로 보존했다. 초기 일반 완료/표본이0이므로 이번에 원래 사용자 기록을 제거한 것은 없다. 동일 owner의 비테스트 행 보존 및 허용된 동시 쓰기 경계는 기존 cleanup transaction의 검사로 확인했다. 전체 초기화·계정 삭제·동의 변경 없음.

01:51:43 KST `/private/tmp/timefit-c-post017-result.cjs`의 별도 read-only 사후 확인: 이번 exact 완료0·표본0, 이번 tombstone3, owner 집계0(초기 기준선과 동일), 동의ON. 반환 비교는 민감 원문 없이 건수·표본 분·집계만 출력했다. 기기 namespace는 retired이며 기존 구현상 values가 비워져 해당 outbox/evidence/ack로 재등록하지 않는다. 서버 tombstone3은 승인된 최소 재등록 방지 잔존이며 제거하지 않았다. 실패/자동 재시도/추가 운영 쓰기/자동 복원0.

### 4. 유지 계약·검증 한계·QA 인수인계

**이번 C 승인 범위는 저장 PASS / 동일 owner 공개 조회 PASS / 실제 추천 체류 계산 반영 PASS / exact 정리·기존 데이터 보존 PASS로 완료**했다. B/017 재적용·약관 등록·Edge/scheduler·UI/native/추천 정책 수정·stage/commit/push0. 제품 코드 변경이 없어 기존 자동 회귀를 다시 실행하지 않았다. `git diff --check` PASS.

1·2건에서는 미적용,3건에서 적용되는 경계와 로그아웃/A→B→A·재시작 격리는 기존 고정 자동 테스트 증거를 유지한다. 이번 기기 운영 시도에서 그 중간 추천 및 계정 전환을 별도로 수행했다고 확대하지 않는다. 이번 실행의 local 증거 source는 app_action이며 Live Activity/일반 알림 배제의 기존 A/B 증거와 구분한다. QA는 이 실제 서버 C 증거를 인수하고 전체 출시/법적 문서/배포 게이트는 별도로 판단한다. 사용자 추가 기기 조작은 필요 없고 재실행하지 않는다. 아래 C 미완료·재개 준비/과거 실패는 이력이며 현행 결과로 되돌리지 않는다.

## 현행 C 재개 승인 — 017 수락 후 새 실행1회 준비

사용자가017 적용·사후 PASS를 기준으로 현재 로그인 계정의 C1회 재개를 명시 승인했다. 새 executionId/plan/기준선/receipt를 사용하며 종료된 ID/receipt는 재사용하지 않는다. 기존 최대 완료3·표본3, 이번 exact ID 제한 정리/집계/재등록 방지 승인과 기존 기록·동의·표본 보존 계약을 유지한다. 실패 시 자동 재시도하지 않고 단계·서버 오류를 기록한다. 이번 승인으로 B/추가 배포/계정 삭제/전체 초기화 범위를 확대하지 않는다.

현재 준비 인수인계: UIUX 최신 동일 owner refresh 입력 유지·명시 거절/trace·값 기반 receipt 비교 연결을 코드와 문서에서 확인했다. 기기에서 같은 계정 확인을 받은 뒤 정상 prepare로 owner/동의/기존 표본을 재검증한다. 계정이나 동의는 관리자 SQL로 만들지 않는다. 현재 새 plan/서버 기준선/receipt/운영 쓰기는 아직0이며, 017 재검증이나 기존 C 자동 fixture는 반복하지 않았다. 사용자에게 내정보의 새 내부 패널 수명→현재 계정 확인만 먼저 안내한다. 제품 파일 수정0, 공유 변경은 본 문서의 재개 승인·상태 기록뿐이다. 실제 저장·조회·추천 반영·정리는 이후 각각 기록해야 하며 이번 준비를 C 완료로 표시하지 않는다.

## 현행 완료 — 017 운영 단독 적용·사후 검증 PASS (2026-09-08 01:42 KST)

### 1. 변경 파일·실제 적용

공유 변경은 본 문서의 실행 인수인계뿐이다. 상단 최종 승인을 확인했고 같은 정책 승인을 재요청하지 않았다. 실제 운영에는 승인된 **`202609080017_qualify_pgcrypto_digest.sql` 한 개**만 적용했다. 실행 명령은 **`npx supabase@2.116.0 db push --linked --skip-vault`**, 단1회, exit0. CLI 결과 migrations 배열은017 한 개, seeds/roles 배열은 빈 값이다. 실패/재시도/자동 복원 없음.

### 2. 사전 기준·유지 계약

- linked ref와 DB 접속 대상은 승인된 `hwfsslihmmendxigklrx`로 일치했다. 파일 SHA-256 **`67a96f0aba8d2467ebf3de50f2446f32a7bfb2de84d7ea352e0d3bfbd9e38ba6`**을 적용 전후 대조했다.
- 동일 고정 CLI의 `db push --linked --skip-vault --dry-run` exit0, pending **017 단독**, seed/role 작업 없음.
- 01:41:02 KST 읽기 전용 repeatable-read 기준선: 원격 migration 이력16개(로컬001~016과 일치), 대상3개 함수 원본 prosrc MD5 guard 일치, pgcrypto는 extensions 배치. 다른 pending/source drift 없음.
- repo 밖 `/private/tmp/timefit-017-preservation.cjs`의 살아 있는 프로세스 메모리에 Auth/public **50개 테이블**의 행수와 정렬된 행 지문 집계, 기존 migration 각 행 지문, public/auth/extensions 함수 메타데이터·본문, public/auth 테이블·열·제약·trigger·RLS/정책·권한, extension 카탈로그를 보존했다. 원문 계정·토큰·데이터·지문은 채팅/문서/파일로 출력하지 않았다. 추가 백업 생성이나 이전 백업으로 덮어쓰기를 하지 않았다.

### 3. 사후 검증

01:42:04 KST 별도 read-only repeatable-read snapshot과 메모리 기준선을 대조해 **postverified**:

| 검증 | 결과 |
| --- | --- |
| 원격 history001~017 | PASS,017 추가·이전001~016 각 이력 행 보존 |
| 정확한 함수 변경 | PASS, 완료 저장1·표본 제출1·guest 가져오기2의 digest 호출만 extensions.digest로 변경 |
| 나머지 함수 본문·공개 계약·OID·소유권·권한·search_path | PASS, 전체 함수 메타데이터 전후 비교에서 기대 source 치환 외 동일 |
| extension 위치·정의 및 테이블/열/제약/trigger/정책/권한 카탈로그 | PASS, 동일 |
| Auth/public 기존 데이터 | PASS,50개 테이블 전후 행수·전체 행 지문 동일, changedTables=[] |
| B 재작업·운영 C 쓰기/재시도·추가 배포 | 전부0 |

017의 lock_timeout3s/statement_timeout60s와 원본 guard는 승인 SQL 그대로다. 운영 함수 호출로 검증하지 않았으므로 이 성공은 **schema 적용·보존 검증**이지 실제 앱 표본 저장/추천 성공이 아니다. 로컬17+17·정리13·업그레이드·타입/UI589·기본274의 기존 검증은 유지하며 다시 실행하지 않았다. `git diff --check` PASS. stage/commit/git push0.

### 4. QA·다음 담당

017 적용 승인 범위는 완료됐다. **C 전체는 여전히 미완료**이며 실제 완료→표본 저장→동일 owner 공개 조회→추천 체류/시간 계산 검증은 별도 재개 단계다. 이번 턴에는 기기 버튼 조작이나 새 plan·receipt·테스트 쓰기를 요청하지 않았다. 다음 DB/QA는 이 사후 결과를 수락한 뒤 기존 C 실행/제한 정리 계약에 따라 새 실행 준비 여부를 판단한다. 과거 종료된 executionId/receipt는 재사용하지 않는다. 약관 등록·Edge/scheduler·B 재적용·전체 초기화·자동 복원은 계속 범위 밖이다. 아래 ‘운영 승인 대기/미적용’은 당시 이력이며 현재 상태로 되돌리지 않는다.

## 최신 사용자 승인 — 017 운영 적용 (2026-09-08)

사용자가 통합의 017 운영 적용 질문에 “승인”으로 답했다. 아래 digest 로컬 검증 인계의 운영 승인 대기는 해소됐으며, 실제 적용 완료를 뜻하지 않는다. DB 세션은 같은 승인을 다시 요청하지 않는다.

- 대상: `hwfsslihmmendxigklrx`. 정확히 `202609080017_qualify_pgcrypto_digest.sql` 단독 적용과 읽기 전용 사전·사후 확인을 승인한다. SHA-256은 `67a96f0aba8d2467ebf3de50f2446f32a7bfb2de84d7ea352e0d3bfbd9e38ba6`이다.
- 변경 범위: 아래 명시된 완료 저장·체류 표본 제출·guest 가져오기 3개 함수의 digest 호출 4곳만 실제 설치 스키마로 한정한다. 기존 데이터·권한·함수 공개 계약·extension 위치·search_path는 보존한다.
- 실행 전 대상·원격 이력001~016·pending017 단독·파일 hash·원본 함수 guard와 보존 기준을 확인한다. 일치할 때 고정 CLI의 `npx supabase@2.116.0 db push --linked --skip-vault`를 1회 실행한다. 다른 pending/정의 차이/실패/통신 단절이면 반복 적용하지 말고 읽기 전용 상태를 반환한다.
- 적용 후 이력017·정확한 4곳 한정·나머지 함수 정의/권한 및 기존 데이터 보존을 확인하고 결과를 본 문서에 기록한다. 정상 동시 쓰기를 과거 데이터로 되돌리지 않는다.
- 이번 승인은 운영 C 재시도, B 재적용, 추가 migration/배포, 전체 초기화·자동 복원·권한 완화·commit/git push를 포함하지 않는다. C 재개는 017 사후 결과 검토 뒤 안내한다.

승인 기록 인수인계: 통합은 본 문서만 변경했다. 코드·SQL·운영 서버 변경 및 테스트 실행은 하지 않았다. 기존 로컬 검증 결과는 유지하며, 다음 담당은 DB 세션의 승인된 적용·사후 검증이다.

## 현행 — digest 최소 전진 migration 로컬 구현·검증 완료 / 운영 승인 대기

### 1. 변경 파일·정확한 함수 범위

- `supabase/migrations/202609080017_qualify_pgcrypto_digest.sql`: 새017. 기존015·016은 수정하지 않았다. pgcrypto 실제 설치 스키마를 pg_extension에서 확인하고 해당 extension 소유의 digest(bytea,text)인지 pg_depend로 검증한다. public/extensions만 허용하며 다른 배치·없는 extension·기대와 다른 원본 함수 본문이면 중단한다. 3개 함수의 pg_get_functiondef에서 아래 **4개 비한정 digest 호출만** 설치 스키마로 한정한다. 예상 원본 prosrc MD5 guard는 drift 검출용이지 보안 서명이 아니다. CREATE OR REPLACE로 OID/소유권/ACL을 유지한다.
- `scripts/test_release_identity_local_db.sh`: `digest-extensions`/`digest-public` 모드 추가. 전자는 빈 격리 DB 생성 시 extensions에 pgcrypto를 최초 설치한다(이동 아님).001~016 적용 뒤 새 독립 회귀를 수행한다. 환경 URL을 받지 않고 기존 mktemp/socket 전용 클러스터와 종료 정리 trap을 재사용한다.
- `scripts/test_digest_schema_compat.mjs`: 합성 Auth/동의/기존 완료·표본·guest fixture,3개 경로 RED,017 적용·메타데이터·기존 전체 public/Auth 행 보존·정상 저장·멱등성·충돌·원본 drift rollback 회귀.
- 본 문서: 구현 전 진단을 이력으로 보존하고 아래 현행 로컬 결과/운영 승인 요청을 기록한다. UI·engine·native·중앙 문서 변경 없음.

| 함수 identity | 한정하는 호출 수 | extensions 배치 기존 실패 |
| --- | --- | --- |
| `public.write_account_course_completion(text,text,bigint,bigint,jsonb)` | 1 | 42883 재현 |
| `public.submit_dwell_completion_sample(text,text,smallint,text,text,text,integer,bigint,uuid,uuid,bigint)` | 1 | 42883 재현 |
| `public.import_guest_course_completions(uuid,jsonb)` | 2 (요청 hash·항목 hash) | 42883 재현 |

이전: 비한정 digest → 운영 extensions 배치에서 함수 search_path 밖이어서42883 → 실제 설치 스키마의 digest로 한정 → extension 위치/검색 경로/권한을 바꾸지 않는 최소 해결 → **로컬 구현·검증 완료, 운영 미적용**. public 설치에서는 public.digest로 한정되므로 기존 로컬 환경도 지원한다. 해시 입력 문자열/인코딩/알고리즘/구분자·JSON 직렬화는 그대로다.

### 2. 유지 계약·적용 경계

함수 인자/반환 타입·언어·security definer·search_path·volatility·owner·ACL·OID는 전후 카탈로그 비교로 보존했다. 다른 모든 public 함수의 소스/메타데이터도 동일하다.017은 사용자 데이터 DML, extension 이동/생성, grant/revoke, trigger 변경을 하지 않는다.015·016의 배포 원본 hash는 기존 수락값과 동일하다. B 재적용·C 재시도·운영 접속·운영 변경·자동 복원·stage/commit/push0.

017은 migration transaction을 전제로 `SET LOCAL lock_timeout=3s`, `statement_timeout=60s`를 유지한다. 마지막(세 번째) 함수 본문 drift를 고의 주입했을 때 앞선 두 함수 replacement까지 전체 rollback됨을 검증했다. 예상 밖 본문을 보정하거나 이미 적용된017을 반복 실행하지 않는다. 실제 배포 시 pending이017 단독인지/함수 source guard·대상·hash가 같은지 재확인해야 한다. 기존 승인되지 않은 변경을 포함한 include-all/push 우회는 금지다.

### 3. 실패 선행·회귀 결과와 hash

새 migration 생성 전에 extensions 격리 DB에서 완료/표본/guest가 각각42883을 반환하는 것을 확인했다. 완료 실패와 독립적으로 표본 함수 hash에 도달하도록 **로컬 합성 기존 방문 행만** 준비했다. 세 RED 확인 뒤 아직 존재하지 않는017 파일에서 테스트가 종료됐다. 구현 후 두 배치에서 성공했다.

| 검증 | 결과 |
| --- | --- |
| `scripts/test_release_identity_local_db.sh digest-extensions` | **17 PASS**, 기존3개42883 재현 후017 적용; 정상·중복·변경 payload·전체 행/메타데이터 보존·마지막 대상 drift rollback |
| `scripts/test_release_identity_local_db.sh digest-public` | **17 PASS**, 기존 정상 완료/표본/guest 데이터·hash를 만든 뒤017 적용, 기존 요청 재처리도 동일; extension public 위치 보존 |
| `scripts/test_release_identity_local_db.sh c-cleanup` | **13 PASS**,017 포함 상태의 기존 정확 정리/동시 쓰기 보존 회귀 |
| `scripts/test_release_identity_local_db.sh upgrade` | PASS, 기존001~014 합성 데이터→015·016·017 적용 후 기존 보존 fixture. 출력 라벨의015→016은 기존 fixture 명칭이며 harness는017까지 적용 |
| `npm run test:typecheck` | PASS |
| `npm run test:ui` | **589 PASS / 1 기존 SKIP** |
| `npm test` | **274 PASS** |
| `git diff --check` | PASS |

DB shared-memory 제한은 승인된 권한으로 로컬 재실행했다. 격리 DB들은 종료 후 trap으로 제거됐다. 운영 데이터/인증 토큰을 fixture에 넣지 않았다. 로그는 `/private/tmp/timefit-digest-{red,extensions,public,cleanup,upgrade,ui,all}.log`에 있다.

SHA-256:

- 015(변경 없음): `ab9f35393d22bae81fc965d02f68e9ee5ebb0ef77cee97d3e85acb0ddc06c6e7`
- 016(변경 없음): `93b76a2a9924d49051b5199b440ddf1fefe7929bebe7b5346b9affed48c4b5d8`
- **017:** `67a96f0aba8d2467ebf3de50f2446f32a7bfb2de84d7ea352e0d3bfbd9e38ba6`

### 4. 운영 승인 요청·다음 담당

**요청 범위:** 기존 프로젝트의 위017 단독 적용(정확히3개 함수/4개 호출 한정) 및 읽기 전용 사전·사후 정의/권한/데이터 보존 확인. 적용 전 실제 대상·pending017 단독·위 hash·source guard·기존 데이터 보존 기준을 확인하고 차이가 있으면 중단한다. 함수 DDL 잠금 대기3초/statement60초 이내 실패 시 반복 적용하지 않고 transaction/이력을 보고한다. 기존 데이터를 과거 백업으로 덮어쓰지 않는다. **C 쓰기/재시도·추가 배포·약관 등록은 승인 요청에서 제외**한다.

현재 운영 적용 승인은 받지 않았고 이번 턴은 로컬 구현·검증에서 종료한다. 다음 담당 DB는 승인 후에만 사전 점검 및017 적용·사후 확인을 수행한다. QA에는 local 수정 PASS와 운영 미적용·C 실제 저장/조회/추천 미검증을 분리 인계한다. receipt 키 순서 수정과 이번 SQL 수정은 별개의 원인/변경이며 하나의 성공으로 다른 운영 검증을 대신하지 않는다.

## 현행 진단 — 세 번째 sync_failed 원인 확인 / 수정·운영 재시도 없음

### 1. 실제 서버 로그와 실패 단계

기존 승인 대상의 Management API 로그를 UTC `2026-09-07T15:37:40Z`~`15:38:45Z`로 제한 조회했다. API GET으로 과거 로그만 읽었으며 앱 RPC는 호출하지 않았다. 기존 CLI keychain 값을 직접 전달한 최초 조회는401이었다. 공식 keyring 구현의 base64 저장 형식을 확인하여 메모리에서 디코딩한 후 정상 조회했다. 최초401은 진단 도구의 인증 전달 문제이지 당시 앱 Auth 오류가 아니다. 자격정보/원문 로그/계정/요청 본문은 출력·문서에 남기지 않았다.

| KST 2026-09-08 | 기존 로그 | 확인 결과 |
| --- | --- | --- |
| 00:38:07.969 | gateway `get_account_record_generation` | HTTP **200** |
| 00:38:08.344 | gateway `write_account_course_completion` | HTTP **404** |
| 00:38:08.344 | Postgres, `write_account_course_completion` 문맥 | SQLSTATE **42883**, `digest` 함수가 존재하지 않는다는 오류 |

같은 좁은 실행 구간에서 위 두 RPC gateway 행2개와 해당 Postgres 오류1개를 확인했다. 계정/본문 일치로 상관분석한 것은 아니며 시각·함수 경로·동일404/SQL 오류 시점과 사용자 실행 결과를 대조했다. 이404는 RPC 자체가 없다는 뜻으로 해석하지 않는다. 실제 함수 내부의 digest 이름 해석 실패가 확인됐다.

### 2. 카탈로그·코드 대조 / 확인된 원인

별도 명시 read-only repeatable-read transaction으로 운영 pg_extension/pg_proc만 조회했다. `pgcrypto` 설치 스키마는 **extensions**, `digest(bytea,text)` 및 `digest(text,text)`도 extensions에 존재한다. 완료 저장 함수의 실제 proconfig는 **search_path=pg_catalog, public**, 실제 본문에는 **`v_hash := digest(...)` 비한정 호출**이 있다. 동일 search_path에서 `to_regprocedure('digest(bytea,text)')`는 미해석, `to_regprocedure('extensions.digest(bytea,text)')`는 해석된다. 이름 조회만 수행했으며 운영 저장 함수를 재실행하지 않았다.

따라서 이번 확인된 실패는 **get_account_record_generation 실패가 아니라 write_account_course_completion의 pgcrypto 스키마 해석 불일치**다. 타입/권한/토큰을 추정한 결론이 아니라 당시42883과 현재 실제 객체 정의를 대조한 결과다. 완료 함수는 generation/입력 검증 뒤 payload hash를 계산하고 그 뒤 INSERT하므로 해당 지점 실패는 서버 완료0·표본0과 일치한다. adapter는 원래 RPC error를 completion_unavailable로 바꾸고 repository는 unavailable, runner는 sync_failed로 통합한다. local 완료 응답1은 앞단 성공이며 서버 저장 성공이 아니다.

receipt 키 순서 비교는 별도 결함이다. 이번에는 실행 진입 후 완료 RPC까지 도달했으므로 그 비교 수정이 이 DB 오류를 해결하지 않는다. 로컬001은 `create extension if not exists pgcrypto`만 실행하며 기존 harness는 extensions 스키마 설치를 명시적으로 재현하지 않는다. 따라서 기존 빈/업그레이드 PASS가 운영 extension 배치까지 검증했다는 뜻은 아니다.

### 3. 최소 수정안 / 제한 재현 조건 / 담당

- **최소 수정안(구현 전):** DB 담당이 새 전진 migration으로 `public.write_account_course_completion(text,text,bigint,bigint,jsonb)` 내부의 해당 digest 호출을 운영의 실제 `extensions.digest(...)`로 한정한다. search_path 확대, extension 이동, 권한 완화, 보호 trigger 해제,015/016 재적용은 필요 없다. 함수 인자·반환·security definer·검색 경로·권한·generation·payload 해시 입력·멱등성·정리 계약은 그대로 보존해야 한다. 새 migration 작성/적용은 이번 진단에서 실행하지 않았다.
- **로컬 선행 재현:** 격리 DB에 pgcrypto를 extensions에 설치하고 기존001~016과 합성 account/동의/고정 completion 입력을 적용한다. 같은 public 함수가42883으로 실패하고 완료/장소/표본0인지 먼저 확인한 뒤, 최소 한정 호출 수정 후 created/동일 입력 already_completed/변경 payload conflict 및 기존 보존 회귀를 확인한다. public에 pgcrypto를 설치한 기존 로컬 환경과의 호환 전략도 새 migration 확정 전에 결정한다. 운영 계정·토큰·기존 plan은 fixture로 쓰지 않는다.
- **서버 적용 조건:** 로컬 재현·수정 검증 후 정확한 함수 변경 범위/hash/보존 검증을 제시하고 별도 원격 적용 승인을 받는다. 현재 사용자 명령은 진단이며 원격 수정 승인이 아니다. 적용 뒤에도 C 전체 재시도는 별도 실행 판단이다. 기존 종료된 ID 재사용 금지.
- **같은 패턴의 잔여 위험:** 로컬016의 submit_dwell_completion_sample과015의 guest import에도 비한정 digest 호출이 있다. 이번 실제 오류 로그는 완료 저장 함수에서만 확인됐으며 표본/guest 경로 실패를 실제 관찰했다고 표기하지 않는다. 완료 함수만 수정해도 C 전체 통과를 보장하지 않으므로, 다음 로컬 재현에서는 표본 제출 경로의 같은 스키마 의존성도 읽기 전용 감사하고 수정 승인 묶음에 필요한 최소 함수 범위를 분리 제시한다. 이번에는 해당 함수나 정책을 변경하지 않았다.
- 기존 로그로 함수·오류 코드·원인을 구분했으므로 이번에는 추가 제품 관찰 코드/새 UI/원격 재현을 만들지 않았다. 이후 다른 실패가 나면 안전한 stage/code/HTTP 상태 관찰을 별도 최소 보완할 수 있지만 이번 진단의 필수 선행 작업은 아니다.

### 4. 변경·검증·인수인계

공유 변경은 **본 문서만**이다. repo 밖 `/private/tmp/timefit-c-sync-logs.cjs`, `/private/tmp/timefit-c-digest-catalog.cjs`로 과거 로그·현재 카탈로그를 읽고 allowlist 형태의 단계/코드/상태·함수 메타데이터만 출력했다. 제품 코드·SQL·서버 설정·정리 정책·운영 데이터 수정0, C 전체/부분 쓰기 재현0, stage/commit/push0. 진단은 실제 로그2개+Postgres 오류1개 및 카탈로그 이름 해석 대조로 확인했다. 코드 변경이 없으므로 전체 자동 테스트를 반복하지 않았다. `git diff --check` PASS. 다음 담당은 **DB 최소 전진 migration의 로컬 실패 재현·수정안 검증**, 통합은 그 뒤 원격 적용 범위를 판단한다. C 저장·조회·추천 반영은 여전히 미완료다.

조회 방법 근거: [Supabase 로그 조회 안내](https://supabase.com/docs/guides/observability/advanced-log-filtering), [공식 CLI credential store](https://github.com/supabase/cli/blob/develop/apps/cli-go/internal/utils/credentials/store.go), [keyring macOS 인코딩 구현](https://github.com/zalando/go-keyring/blob/master/keyring_darwin.go). 서버 오류 원인은 이 일반 문서가 아니라 위 실제 제한 조회 결과에 근거한다.

## 현행 로컬 보완 — receipt 객체 키 순서 독립 비교·UIUX 진단 인계

1. **변경 파일/이력:** `src/services/cValidationReceipt.ts`에 순수 `matchesCBaselineReceipt(receipt, plan): boolean`을 추가하고 `src/services/cValidationRunner.ts`의 receipt IDs JSON.stringify 비교만 교체했다. 이전 방식은 동일 ID 객체도 key 삽입 순서가 다르면 거절했다 → 키 순서만 바꾼 실제 runner fixture가 baseline_required로 실패함을 확인 → 같은 배열 위치의 runId/completionId/eventId를 각각 엄격 비교하도록 변경 → 직렬화 표현이 아닌 승인 값의 동일성을 검사하기 위함. `test/c-validation-runner.test.ts`에 값/배열 순서 거절·키 순서 통과와 비민감 진단 회귀를 추가했다. 본 문서에 인계한다.
2. **유지 계약:** owner/executionId/각 ID 값·배열 길이·배열 순서 엄격 비교, baselineCaptured===true, ID 객체의 정확한3개 필드 경계를 유지한다. trim/대소문자 변경/정렬/타입 변환/ID 재생성 없음. snapshot의 다른 JSON.stringify 비교, claim·Auth·cleanup 정책, SQL/서버 설정/원격 데이터는 변경하지 않았다. 운영 C 재시도0, UI/native/추천 정책 파일 수정0, stage/commit/push0. 이 변경은 이전 실제 sync_failed의 원인 확정 또는 해결 증거가 아니다.
3. **실행 테스트:** 수정 전 reordered receipt가 baseline_required로 실패하고 진단 getter 부재도 실패하는 RED 확인. 수정 후 C runner9+preparation8+recovery4=**21 PASS**, typecheck PASS, 전체UI **589 PASS/1 기존 SKIP**, 기본 **274 PASS**, diff check PASS. UI/집중 테스트의 tsx IPC EPERM은 권한 승인 후 재실행했다. 테스트 요청은 고정 fixture이며 운영 요청 없음.
4. **UIUX 정확한 연결/남은 경계:** UI 소유 `src/ui/cValidationControls.ts`의 run 앞단에도 `JSON.stringify(receipt.ids)!==JSON.stringify(plan.ids)`가 남아 있다. **UIUX 후속 필요:** 기존 `parseCBaselineReceipt`의 exact schema/금지 필드 검사와 null 거절은 유지하고, 그 뒤 owner/execution/IDs 비교 조건을 `!matchesCBaselineReceipt(receipt,plan)`으로 교체한다. import는 **`../services/cValidationReceipt`**다. 이 파일은 type-only import뿐이라 SDK/native/engine 초기화를 유발하지 않는다. UI controller에도 reordered keys 정상 통과 및 값/배열 순서 불일치 거절 fixture를 추가해야 한다. 이 DB 변경만으로 실제 UI 앞단까지 해결됐다고 표기하지 않는다.

### 실행기 비민감 진단 공개 계약

기존 `createAppCValidationRunner`가 반환하는 runner에 **`getExecutionDiagnostics()`**가 추가됐다. 인자 없음, 메모리 snapshot만 반환, 네트워크·저장·로그 없음:

`{ entered: boolean, claim: 'not_attempted' | 'pending' | 'claimed' | 'already_started' | 'owner_changed' | 'account_required' | 'session_expired' | 'unavailable' | 'retired' | 'cleanup_pending', failureReason: string | null }`

- entered는 실제 `runner.run` 진입 시 true다. UI 앞단 receipt 거절/키보드 터치/disabled는 진입 증거가 아니므로 UI 자체 거절 status와 구분한다. 초기 false, claim 초기 not_attempted, failureReason 초기 null.
- receipt 거절은 entered:true/claim:not_attempted/failureReason:baseline_required. 승인 receipt로 실제 claim 호출 직전 pending, 응답 뒤 claim.status를 그대로 저장한다. claimed는 시작 독점권 취득이지 서버 저장 성공이 아니다.
- claim 거절은 해당 status를 failureReason에 기록한다. 실행 중 실패는 기존 Halt reason 또는 unavailable만 기록하며 원문 오류/owner/ID/토큰/SQL payload 없음. 현재 가능한 실행 reason은 unavailable, consent_required, consent_changed, owner_changed, expired_existing_samples, baseline_too_large, id_collision, clock_stale, runtime_failed, sync_failed, sample_mismatch, baseline_changed, interrupted다. 성공은 null. 중복 run/stop으로 기존 최종 실패를 덮어쓰지 않는다.
- UIUX는 기존 getState의 stage/completed/submitted와 병렬로 getter를 읽어 **진입·claim·실패**를 구분해 표시한다. controller 자체의 parse 실패 이유 및 run 반환 status도 계속 유지한다. 진단을 위해 prepare/run/stop을 다시 호출하지 않는다. 이 진단은 runner 객체 수명 동안만 존재하며 앱 재시작 뒤 복원된다고 주장하지 않는다. durable 종료 확인은 기존 inspectAppCValidationExecution을 유지한다.
- 기존 run 반환값 및 getState 구조는 바꾸지 않았다. UIUX 연결 전 자동 테스트/로컬 구현 완료와 실제 C 저장·조회·추천 미검증을 구분한다. 다음 담당은 UIUX의 위 한 비교 조건 교체 및 진단 표시 연결이며, 운영 실행은 이번 범위에서 금지다.

## 현행 C 세 번째 시도 — 실제 sync_failed 중단 (2026-09-08 00:39 KST)

1. **변경 파일/실제 실행:** 본 문서에 사용자 결과와 서버 확인을 기록했다. 이전 임시 수신 파일/세션이 없어 repo 밖 `/private/tmp/timefit-c-third-operator.cjs`로 기존 capture/receipt/seal/cleanup 모듈을 재사용했다. 새 plan은 사용자 정상 텍스트와 Mac clipboard를 exact 대조했다.00:37:45 KST 읽기 전용 기준선 확보: 기존 완료0·표본0·집계0·동의ON, receipt clipboard 전달. raw baseline은 살아 있는 operator 메모리에만 있다. 사용자 최종 결과는 `stopped/reason:sync_failed/progress:{stage:stopped,completed:1,submitted:0}/cleanup:retired/report:null`. running 관찰은 사용자 기억이며 최종 stopped 결과를 확정 증거로 사용한다.
2. **유지 계약/정리:**00:38:44 KST seal로 이번 exact 서버 완료0·표본0, 동의 기준선 일치 확인. 기기 completed1은 local 완료 응답이며 서버 저장1건이 아니다. 사용자 retired 결과에 따라00:39:03 KST 기존 승인 exact cleanup1회 수행: cleaned/완료 삭제0·표본 삭제0·이번 run tombstone3. 기존 일반 기록·동의·이전 tombstone은 cleanup transaction 전후 비교로 보존, 영향 표본0이므로 집계 재계산 대상0. 원격 재실행/자동 복원/계정 삭제/전체 초기화/추가 배포/UI·native·engine 수정0.
3. **검증/관찰 한계:** 실제 local 완료 응답1 확인, 실제 서버 완료·표본 성공0, 동일 owner 공개 표본 조회 및 다음 추천 체류/시간 반영 미도달, 제한 정리 transaction PASS. 이번 턴 별도 post-commit 조회는 미실행이다. 기존 자동 테스트 PASS를 실제 C 성공으로 대체하지 않는다. `sync_failed`는 runner가 runtime sync 결과를 통합한 reason이라 네트워크·인증·저장소·generation·RPC 거절/DB 오류 중 무엇인지 현재 출력만으로 확정할 수 없다. production adapter는 RPC 오류를 completion_unavailable로 바꾸고 repository는 unavailable로 바꾸므로 실제 SQLSTATE/HTTP 상태는 이 보고에 없다. 원격 반복 호출로 원인을 추측하지 않는다.
4. **다음 담당/중단 조건:** DB·API 담당이 완료 동기화 경계의 안전한 오류 코드/상태를 로그 또는 로컬 재현으로 좁힌다. 우선 `retryCourseRunSync`의 반환 status/visitStatus, `get_account_record_generation` 및 `write_account_course_completion`의 오류 경계를 확인한다. 원인 확인 전 네 번째 운영 실행을 요청하지 않는다. UIUX의 버튼 미눌림 가설과 이번 실제 동기화 실패는 분리한다. 수정 필요 시 로컬 실패 재현을 먼저 추가하고, 원격 함수/권한 변경이면 정확한 범위를 별도 승인받는다. B 재적용/권한 광범위 완화로 우회하지 않는다. 현재 C 전체는 **실패 원인 진단 대기**, 완료 아님.

> **현행 — 2026-09-08 00:31 KST 두 번째 시도 종료·새 명시 시도 준비:** 아래 두 번째 시도 인수인계가 최신이다. 기기 active/runClaimed:false/pending0/values0 조회 뒤 사용자 명시 중단으로 retired 확인. 서버 exact 완료0·표본0, 제한 정리1회·사후 검증 PASS(삭제0, 이번 ID tombstone3). 사용자가 다시 진행하도록 요청했으며 새 수신 세션만 준비했다. 새 plan/쓰기 아직 없음. 실제 C 저장·공개 조회·추천 계산 성공은 계속 미검증이다.

> **현행 — 2026-09-08 00:12 KST 이전 C 시도 종료·제한 정리 완료:** UIUX readonly 복구 연결 후 사용자가 기존 실행의 `found/retired/pendingRequests:0/storedKeyCount:0` 결과를 전달했다. 보존 manifest로 exact 완료0·표본0 및 동의 일치를 확인하고 승인된 cleanup을 **1회** 실행했다. 삭제0, 재등록 방지 tombstone3개, 사후 읽기 전용 검증 PASS. **C 실제 저장·공개 조회·추천 반영은 성공 미확인**이며 아래 이전 보류 기록은 이력이다. 새 실행은 자동 재시도하지 않는다. 마지막 인수인계 참조.

> **최우선 후속 — 새로고침 후 이전 실행 readonly 복구:**23:57:54 KST 서버 exact 완료0·표본0 재확인. 사용자는 receipt 붙여넣기/실행 클릭을 확인했으나 결과를 기억하지 못하고 앱을 새로고침했다. 현재 패널은 이전 실행 재조회 기능이 없으므로 사용자에게 새 준비/기억 확인을 반복 요구하지 않는다. DB는 아래 `inspectAppCValidationExecution` 구현/20개 테스트 PASS를 인계했다. **UIUX readonly 복구 연결 전 실제 기기 pending/retired 미확인, 새 실행·관리자 정리 보류**다.

> **최신 운영 확인 — 2026-09-07 23:53 KST:** 사용자가23:47 직전 C 실행 버튼을 누른 뒤 앱을 새로고침했다고 후속 보고했다. 보존 중인 이전 실행 manifest로23:53:11 KST `sealCManifest` 읽기 전용 조회를 수행하여 해당 exact ID의 완료0·표본0, baseline 동의 일치를 확인했다. 실행 실패/무쓰기 확정 또는 retired 확인이 아니므로 **새 실행과 관리자 삭제를 보류**한다. 아래 마지막 실행 경과를 따른다.

## 최신 사용자 승인·C runner 실행 계약 — 준비 완료·UIUX 연결 대기

> **최신 실제 실행 재개 상태:** 사용자 후속 명령과 `docs/work/uiux/c-validation-runner-controls.md`의 UIUX 연결 검토/집중23개 PASS 인계를 수락했다. 기존 계정·쓰기·관리자 정리 승인을 반복 요청하지 않는다. 현재는 **기기 내부 패널 및 보호된 plan 전달 경로 확인 대기**, prepare/운영 C 쓰기/정리 미실행이다. 아래 ‘UIUX 연결 미확인’은 이전 이력이며, 자동 연결 검토 수락을 실제 기기/서버 성공으로 확대하지 않는다.

사용자는 현재 로그인 계정의 완료/표본 최대3건, 해당 ID 관리자 정리, 관련 집계 정상화, tombstone 최대3개·최소 관리 기록 잔존 및 앞서 명시한 테이블 잠금 영향을 승인했다. 같은 승인을 재요청하지 않는다. **운영 실행은 UIUX 연결 완료 뒤**이며 이번 작업은 runner 구성/로컬 검증만 한다. B·RPC/migration 재작업 및 전체 초기화/계정 삭제 금지.

UIUX 선인계(이번 작업에서 아래 export 구현·로컬 검증 완료): `src/services/cValidationSupabase.ts`의 `createAppCValidationRunner({executionId,currentAppOwner})`를 내부 도구에서 실행별1회 만들고 유지한다. `prepare({expectedOwner})`는 정상 Auth·동의·만료 표본/예정 ID 중복을 읽기 전용 확인한 뒤 `awaiting_baseline`과 exact 계획을 반환한다. DB 담당이 기존 `captureCManifest`로 보호 baseline을 확보한 뒤 **동일 계획의 operator receipt**를 전달해야 `run({baselineReceipt})`을 호출할 수 있다. receipt는 비밀 토큰/사용자 인증 대체물이 아니라 관리자 준비 확인이며 UI에서 자동 true 처리하지 않는다.

`run`은 딱1회, 기존 공개 runtime의 evidence→local completion→server visit ack→sample→owner read→실제 엔진 체류/계산 비교를 순차 실행한다. `getState()`는 안전한 단계/건수만 표시한다. `notifyAuthChanged()`는 logout/owner 전환 때 동기 호출하며 자동 진행을 중단한다. `stop()`은 즉시 새 작업을 막고 격리 저장소를 retire한다. 반환 `cleanup_pending`이면 관리자 삭제 금지, `retired`이면 기존 seal/cleanup 모듈로 exact 정리를 진행할 수 있다. 중복 run·cold 재실행·동의/owner 변경·네트워크 불확실성은 자동 재시도하지 않는다. 앱에는 관리자 DB 연결/secret/cleanup SQL을 넣지 않는다. 정확한 타입·검증 결과는 본 절의 후속 인수인계에서 확정한다.

> **최신 C 상태 — 2026-09-07 / runner 준비 로컬 검증:** 관리자 exact 정리·정상 Auth·격리 저장소 모듈을 재사용하고 **공개 runtime + 실제 SDK/공통 production adapter + 고정 route/engine runner 연결을 완료**했다. 통합 테스트16 PASS, 로컬 DB13개 검사 PASS. 관리자 정리 범위도 위 사용자 승인으로 수락됐다. **UIUX 연결 완료 전 운영 실행0이며, 현재 계정의 하네스 인증/실제 C 저장·조회·추천 반영·정리는 아직 미검증**이다. A/B 재실행0. 마지막 runner 인수인계가 현행이다.

## 최신 사용자 승인 — B 운영 적용 승인

> 최신 실행 결과: **2026-09-07 21:24 KST B 적용·읽기 전용 사후 검증 PASS, 이력001~016**. Auth drift는 정상 refresh-token 회전으로 분류하고 최신 인증 데이터를 보존했다. 마지막 B 완료 인수인계를 따른다. C는 미실행이다.

사용자가 통합의 최종 승인 질문에 “승인”으로 답했다. 아래 **B 중단 보완·최종 적용 승인 묶음(2026-09-07 20:45 KST)**의 대상 `hwfsslihmmendxigklrx`, 정확한015/016 hash, 나이 필드 제거 범위, 실제 문서 registry 등록 전 신규 일반 가입 차단, 잠금·부분 적용 위험과 제한 복구 경계를 포함한 운영 적용을 승인한다. 같은 최종 승인을 다시 묻지 않는다. 승인 기록은 실행 완료 증거가 아니다.

DB 세션은 직전 대상/hash/pending·계정 보존 기준·route 정의가 승인 묶음과 동일함을 확인한 뒤 `npx supabase@2.116.0 db push --linked --skip-vault`를1회 실행하고 B 사후 검증을 수행한다. 정상 예산 카운터 갱신은 반복 백업 사유로 삼지 않고 현재 데이터를 보존한다. 다른 pending·hash/정의 drift·예상 밖 계정 변경이면 적용하지 말고 차이를 반환한다. 필요한 도구/네트워크 권한은 정상 절차로 요청한다.

실패·통신 단절 시 성공을 추정하거나 재실행하지 않고 원격 이력·객체를 읽기 전용 확인하여 부분 적용 범위를 보고한다. reset/repair/보호 해제/전체 또는 자동 복원/강제 세션 종료는 승인하지 않았다. C 테스트 계정·표본 쓰기/정리, 약관 registry 등록, Edge/scheduler 배포, commit/push는 이번 승인에 포함하지 않는다. 아래 과거 B 승인 대기 표기는 이 승인으로 해소됐으며 실제 적용 결과는 DB 완료 인수인계로 별도 기록한다.

## 최신 사용자 승인 — 숨김 로컬 입력 방식 확정

사용자 “진행해”로 **macOS 숨김 비밀번호 입력창 방식 사용을 승인**했다. 같은 방식 동의를 다시 묻지 말고 안전한 로컬 입력을 요청하여 A 백업 생성·격리 복원 검증을 이어간다. 비밀번호는 채팅/문서/로그/CLI 인자에 남기지 않는다. 입력창에서 실제 사용자가 비밀번호를 입력하는 단계와 필요한 OS/파일 접근 권한은 생략하지 않는다. 아래 “암호화 방식 동의 대기”는 해소된 이력이며 백업 생성 완료를 뜻하지 않는다. B 원격 migration과 C 테스트 쓰기 승인은 아직 별도다.

상태: **A 수락 유지, B 원격015·016 적용 및 사후 catalog/데이터 보존 검증 PASS, C 미실행·별도 승인**. 최신 실제 결과는 마지막 B 완료 인수인계를 따른다. 새 기능/광범위 리팩터링 없음. 출시 문서 세션과 병렬 진행한다.

## 기준·진행 범위

AGENTS.md → docs/README.md → 본 문서 → release-backup-apply-readiness.md **5절** → APPLY 문서 최신 절 → QA live-learning-evidence-validation.md C를 읽는다. 이미 통과한 MAINTAIN·고정CLI timeout·업그레이드 보완을 다시 구현하지 않는다. 현재 최신hash는015 `ab9f35393d22bae81fc965d02f68e9ee5ebb0ef77cee97d3e85acb0ddc06c6e7`,016 `93b76a2a9924d49051b5199b440ddf1fefe7929bebe7b5346b9affed48c4b5d8`이며 실행 전 검증한다.

DB 소유 구현/하네스와 본 인수인계만 작성한다. 출시 공개 문서/중앙 정책/UI/엔진 직접 변경0. 최종 단계는 아래 세 묶음으로 고정한다. 예상 밖 차단이면 해당 근거와 최소 수정량을 반환하고 꼬리물기 새 작업을 스스로 추가하지 않는다. 하루 안 마감 가능 여부를 중간 결과로 보고하되 시간 초과만으로 기능을 임의 제외하지 않는다.

## A. 백업 1회 생성·복원 확인

사용자 새 보호 백업/격리 복원 승인과 신규 가입 일시 차단 수락은 유지한다. 이전에는 `/Users/shindongheun/TimeFitBackups`가700 빈 폴더였으나, 아래 A 완료 실행에서 검증한 암호화 백업을 보존했다. 신규 가입 상태는 이번 A에서 변경하지 않았다.

기존 질문에 대한 암호화 방식 답변을 먼저 확인한다. 미답변이면 권장한 macOS 숨김 로컬 비밀번호 입력 방식 사용 동의를 한 번 요청하고, 비밀은 로컬에서만 받는다. 채팅/CLI 인자/로그로 비밀번호 요청0. 실제 보호 볼륨·snapshot/export·격리 restore는 기존 readiness의 안전 절차를 따른다. 새 백업 시스템/PITR 구매/관리형 자동화 구축으로 확대하지 않는다.

Auth/public/migration 이력과 필요한 의존성이 포함된 일관 snapshot 하나를 암호화 보관하고 격리 복원으로 검증한다. 복구 시점/위치/파일hash/포함범위/사용자 복호화 가능/복원 결과와 한계를 기록한다. 관리형 Auth 서비스 전체 복구를 SQL 복원으로 보장하지 않는다. 임시 대상만 정리하고 최종 백업은 보존한다.

## B. 정확한015·016 적용

### B 실행 명령 — A 수락 후 현행 기준

관계: 기존 B의 **보완**. 이전 APPLY 7~8절의 백업 미확인·MAINTAIN/timeout 미보완·옛 hash는 당시 이력이다. readiness 5절의 보완 완료와 본 문서 마지막 A 완료 인수인계를 현행 근거로 사용한다. 통합은 A의 최종 이미지 존재·600 권한·크기·SHA-256을 직접 대조했고 복원/재입력 검증 인계를 수락했다. 새 백업 시스템이나 이미 통과한 SQL 보완을 다시 만들지 않는다. 이번 명령 작성은 **운영 적용 최종 승인 자체가 아니다**.

1. 읽기: AGENTS.md → docs/README.md → 본 문서 B 및 A 완료 인수인계 → release-backup-apply-readiness.md 5절 → APPLY 문서의 사전/사후 검증·실패 경계. 아래 지정 두 SQL은 전체를 읽되, 과거 hash로 복원하지 않는다.
2. DB 단일 writer로 승인 전 준비를 수행한다. 앱/linked/DB 대상이 `hwfsslihmmendxigklrx`로 일치하는지, 원격001~014와 pending이 정확히015→016인지, 동시 schema 작업이 없는지 확인한다. 다른 pending·부분 적용·정의 drift가 있으면 push하지 않고 차이를 반환한다.
3. 소스 SHA-256: 015=`ab9f35393d22bae81fc965d02f68e9ee5ebb0ef77cee97d3e85acb0ddc06c6e7`, 016=`93b76a2a9924d49051b5199b440ddf1fefe7929bebe7b5346b9affed48c4b5d8`. 파일 내 SET LOCAL lock_timeout 3초/statement_timeout 60초와 CLI2.116.0 검증 근거를 유지한다. 변경 발견 시 임의 재작성·재수락 없이 중단한다.
4. 원격 사전 검사는 명시 읽기 전용 transaction으로 수행한다. 기존 Auth/profile/코스 graph/동의/나머지 metadata 보존 기준, 정확한 나이 제거 대상 건수, Auth trigger topology와 RLS/ACL을 확인한다. 개별 행 원문·계정·좌표·비밀은 출력하지 않는다. 건수만으로 내용 보존을 입증하지 말고 보호된 비교 자료 또는 민감 원문 없는 일치 판정을 사용한다. read 이름의 RPC도 purge 등 쓰기 부수효과가 있으면 호출하지 않는다.
5. A 백업은 `timefit-pre015-20260907T111929Z.sparseimage`, 복구 시점 KST 2026-09-07 20:20:48.763587, 이미지 SHA-256 `70dccc4e3dac0e6d5bf9730aab607f1dfd97c913924d7d11c5564cc3c7d8be3b`다. 파일 무결성과 백업 이후 신규 쓰기/정의 변경을 평가한다. 경과 시간만으로 자동 재백업하지 않되, 현재 보존 대상이 백업에 없으면 손실 범위와 최소 추가 보호 방법을 제시하고 적용을 멈춘다. SQL 격리 복원은 관리형 Auth 서비스 전체 복구 보장이 아니다.
6. `npx supabase@2.116.0 db push --linked --skip-vault --dry-run`으로 exact pending을 확인한다. 사용자에게 대상·hash·나이 삭제 범위/현재 건수·나머지 데이터 보존·복구 시점과 한계·신규 일반 가입 영향·잠금·명령을 **한 번에** 제시하고 최종 적용 승인을 받는다. 나이 제거는 profiles.birth_year/age_band NULL 및 Auth metadata 최상위 동명 두 키만이며, profile updated_at의 기존 trigger 갱신은 구분한다. 실제 문서 registry 등록 전 신규 일반 가입 일시 차단은 이미 수락된 영향으로 알리고 같은 정책 선택을 다시 묻지 않는다. 가짜 registry나 별도 Auth 설정 변경으로 해결하지 않는다.
7. 최종 승인 뒤 대상/hash/pending/기준선이 동일할 때만 `npx supabase@2.116.0 db push --linked --skip-vault`를 실행한다. 두 파일은 파일별 transaction이며 015 성공·016 실패가 가능하다. timeout/권한/기타 실패 시 즉시 중단하고 이력·객체를 읽기 전용으로 확인한다. 반복 push, reset, repair, include-all/seed/roles, trigger 보호 해제, 강제 세션 종료, SQL 조각 우회, 자동 운영 복원은 금지한다.
8. 사후에는001~016 이력·예상 schema/함수/trigger/constraint/index/RLS/grants를 대조한다. exact 위험 grant 회수, 승인한 나이 필드만 제거, 기존 계정/코스 graph/동의/나머지 metadata 보존을 검증한다. 동시 정상 쓰기와 migration 변경을 구분할 수 없으면 보존 PASS를 단정하지 않는다. 계정 전체 삭제나 테스트 RPC 실행으로 증명하지 않는다.
9. 완료 인계는 본 문서에 변경 파일/서버 변경 목적, 보존 계약·승인 삭제 범위, CLI/hash/전후 이력/실제 검증, 남은 위험·C 인계를 기록한다. `schema 적용 PASS`와 `실제 인증/RLS 실행·방문 ack·표본 저장·owner read·추천 반영 미검증`을 분리한다. 제품/SQL 변경이 없으면 유효한 전체 회귀를 반복하지 않는다.

범위 제외: C 테스트 계정·방문/표본 쓰기·정리, 실제 약관 registry 등록, Edge/scheduler 배포, UIUX/엔진/데이터 변경, 스토어 게시, commit/push. C는 필요한 전용 계정·정상 인증·최소 쓰기/정리 계획만 인계하고 실행하지 않는다. 예상 밖 차단은 근거와 최소 해결책으로 반환하며 새 작업을 임의 증식하지 않는다.

백업 준비 후 대상/이력/pending/새hash/잠금3초·statement60초/나이 삭제 범위/임시 신규 가입 차단/복구 근거를 한 번에 제시하여 **최종 원격 적용 승인**을 받는다. 기존 백업 승인이 migration 승인은 아니다.

승인 뒤 `npx supabase@2.116.0 db push --linked --skip-vault`로 정확한015→016만 적용한다. APPLY의 직전 read-only 확인·dry-run·실패 중단/부분 적용 보고를 유지한다. reset/repair/보호해제/자동복원/반복push0. 적용 후 정의·RLS/grants·나이 exact 제거·기존 graph/동의/나머지metadata 보존과 이력을 확인한다.

## C. 실제 서버 학습 최소 검증·QA 인계

테스트 계정/동의·최소 방문/표본 write·정리 범위는 migration과 구분해 함께 계획하되 별도 승인을 받는다. 실제 문서가 없다는 이유로 가입 trigger를 우회하거나 가짜 registry를 넣지 않는다. 사용 가능한 전용 검증 계정/인증 경로가 없으면 정확한 조건을 반환한다.

승인된 전용 계정으로 실제 runtime 확인/완료 → 실제 방문 ack → 표본 저장 → 동일 owner read → 실제 다음 추천 반영을 검증한다. 운영 계정에 직접 SQL로 가짜 표본을 넣지 않는다. 필요3건은 승인된 고정 clock/route port의 테스트 runtime 시나리오로 격리하고 사용자에게 실제3회 방문을 요구하지 않는다. 실제 서버 adapter를 mock으로 바꾸지 않는다. 외부 경로API 반복 호출0.

저장/조회/추천 적용 각 결과와 테스트 데이터 exact 정리 결과를 QA C에 인계한다. 계정 전체 초기화/삭제는 명시 승인된 전용 계정 범위만 허용한다. Activity 실기기 정상 보고는 재요청하지 않으며 학습 서버 결과와 구분한다. 서버read까지 성공해도 추천 미확인이라면 부분 완료로 적는다.

## 완료 기준·중단 경계

백업/적용/실제저장/조회/추천반영별 PASS 또는 미확인, 남은 필수 조건만 보고한다. 큰 추가 설계·새 인프라·미승인 개인정보 처리가 필요하면 통합에 즉시 반환하여 출시 포함 여부를 결정한다. 예외를 허용해 개인화를 성공으로 꾸미지 않는다. 출시 문서 세션에는 민감정보 없이 실제 사용 항목·저장/삭제·권한·개인화 검증 사실만 전달한다.

기존 코드 변경이 없으면 이미 유효한 전체 테스트를 반복하지 않고 관련 최종 검증만 실행한다. 코드/SQL 수정이 필요한 경우 실패 재현과 해당 회귀·기본 게이트를 실행한다. 인수인계 네 항목(변경 파일/목적·유지 계약·실행 결과·위험/다음 담당)을 본 문서에 남긴다. 서버 변경은 수행 범위와 복구 수단을 사용자에게 보고한다. 원격 게시·Edge/scheduler·스토어 제출·commit/push는 별도다.

## 실행 인수인계 — 2026-09-07 / 암호화 방식 동의 대기

> 아래는 과거 이력이다. 숨김 입력 방식 동의는 맨 위 사용자 승인으로 해소됐다. 최신 실제 실행 결과는 문서 마지막 A 재개 인수인계를 따른다.

1. **변경 파일/목적:**본 문서만 갱신. 필수 문서와 QA C 인수인계를 읽고 실행 순서를 확정했다. 기존 MAINTAIN/timeout/upgrade 구현과 테스트를 반복하지 않았다.
2. **유지 계약:**백업 생성·격리 복원 및 실제 문서 준비 전 신규 일반 가입 일시 차단은 승인 상태다. macOS 숨김 입력 방식 사용 동의는 아직 없다. 비밀번호는 로컬 입력창에서만 받으며 채팅/CLI 인자/로그에 요구하지 않는다. 서버 적용, 테스트 계정·동의·방문/표본 쓰기·exact 정리는 별도 승인이다. 기존 실기기 관찰을 재요청하거나 실제3회 방문을 요구하지 않는다.
3. **검증/현재 결과:**015/016 파일 SHA-256은 본 문서의 최신값과 일치한다. 백업 경로 `/Users/shindongheun/TimeFitBackups`는 사용자 소유700이며 아직 실제 백업이 아니다. 이번 턴 원격 호출·dump·restore·push·계정/표본 쓰기0. 제품/SQL 변경이 없어 유효한 readiness5절 전체 회귀를 재실행하지 않았다.

| 마감 단계 | 상태 |
| --- | --- |
| 보호 백업1회 생성·격리 복원 | 미실행: macOS 로컬 비밀번호 입력 방식 동의 대기 |
|015·016 원격 적용 | 미실행: 백업 검증 후 최종 원격 적용 승인 필요 |
| 실제 방문 ack·표본 저장 | 미검증: 별도 승인된 전용 검증 계정/정상 인증 경로 필요 |
| 동일 owner 서버 조회 | 미검증 |
| 다음 추천 실제 반영 | 미검증 |

4. **다음 담당/최소 작업량:**사용자에게 숨김 로컬 비밀번호 입력 방식 사용 동의를 한 번 요청한다. 동의 후 기존 계획 범위의 AES-256 암호화 이미지에 일관 snapshot1회→socket-only 격리 SQL 복원1회→결과/새hash/pending/나이 삭제 범위/복구 수단을 모아 최종 적용 승인 요청 순서다. 이어서 전용 계정의 고정 runtime3건·실제 서버 adapter·다음 추천1회와 exact 정리 계획을 별도 승인받는다. 현재 새 인프라 필요 근거는 없으며, 동의·승인 및 의존성 복원이 순조로우면 당일 마감을 목표로 한다(보장 아님). 예상 능동 작업은 백업/복원1~2시간, 적용/사후검증30~60분, 승인된 runtime 검증/정리1~2시간이며 사용자 대기·새 차단은 별도다. provider 의존성/정상 검증 계정 때문에 큰 추가 설계가 필요해지면 확대하지 않고 정확한 최소 수정 범위와 갱신 견적을 통합에 반환한다. QA C는 위 다섯 상태를 따로 인수한다.

## A 재개 실행 인수인계 — 2026-09-07 / 실제 로컬 입력 검증 미통과

> 과거 시도 이력이다. 이후 사용자 비밀번호 준비 및 실제 숨김 입력 성공으로 아래 A 완료 결과로 대체됐다.

1. **변경 파일·목적:** 본 문서에 실제 시도와 차단 경계를 기록했다. repo 밖 일회성 `/private/tmp/timefit-protected-volume.cjs`는 macOS 숨김 입력 → 확인 입력 → AES-256 APFS sparseimage 생성·마운트 순서로 준비했다. 입력은 프로세스 메모리에서만 처리하며 hdiutil 표준입력으로 전달하도록 구성했다. `/private/tmp/timefit-backup-inventory.cjs`는 대상과 스키마 의존성을 읽기 전용으로 조사했다. 제품 코드·migration·중앙 문서는 수정하지 않았다.
2. **유지 계약:** 숨김 입력 방식은 승인 완료이며 방식 재동의를 요구하지 않는다. 백업 보관 책임자는 사용자다. DB 접속 비밀·사용자 입력값·운영 행 원문을 로그/문서에 기록하지 않았다. 원격 migration·운영 복원·가입 상태 변경·테스트 계정/표본 쓰기·배포·stage/commit/push는 수행하지 않았다.
3. **실행 결과:** macOS 숨김 입력을 실제 시도했으나 두 시도 모두 도구가 정한 최소 16자 입력 검증에서 중단됐다. 첫 안내의 ‘권장’과 실제 필수 조건이 불일치하여 두 번째 안내를 ‘16자 이상’으로 수정했다. 입력값 자체는 기록하지 않았고 확인 입력 및 이미지 생성으로 진행하지 않았다. 최종 파일 시스템 확인에서 `/Users/shindongheun/TimeFitBackups`는 사용자 소유700·빈 폴더이며 볼륨 상태 파일도 없다. 따라서 **보호 백업 생성 미완료 / snapshot·hash 없음 / 격리 복원 미실행**이다. 실패를 백업 성공으로 취급하지 않는다.

   원격 읽기 전용 inventory는 성공했다. linked/app/DB 대상 일치, PostgreSQL17.6, migration 이력001~014를 확인했다. Auth/public/supabase_migrations의 테이블·시퀀스 목록과 extension 목록을 확인했으며 선택 스키마 밖을 참조하는 FK는 조회되지 않았다. 이것만으로 함수 본문 등 모든 의존성 복원을 입증하지는 않는다. 로컬17.11 도구로 실제 archive 복원 검증이 여전히 필요하다. 제품/SQL 변경이 없으므로 이미 통과한 전체 회귀는 반복하지 않았다.
4. **다음 담당·위험·복구 절차:** 다음 실행에서는 방식 동의가 아니라 16자 이상 백업 전용 비밀번호의 **실제 로컬 입력**만 진행한다. 비밀번호는 채팅에 보내지 않고 백업과 별도로 사용자가 보관한다. 보호 이미지가 실제 생성된 뒤에만 동일 snapshot의 Auth/public/이력 export, 암호화 볼륨 내부 socket-only 임시 PostgreSQL 복원, 정의·건수·보존 비교, 임시 cluster 정리와 이미지 분리·재열기 검증을 진행한다. 현재 복구 가능한 산출물이 없으므로 A 수락 및 B 적용 준비 완료를 선언할 수 없다. B 원격 적용과 C 저장/조회/추천 반영은 모두 미실행·별도 승인 상태로 QA C에 인계한다.

## A 완료 인수인계 — 2026-09-07 / 보호 백업·격리 SQL 복원 PASS

### 1) 변경 파일·목적 및 보호 산출물

공유 작업 트리에서는 **본 문서만** 갱신했다. 제품/SQL/중앙/UI/native/engine 수정0, 다른 세션 변경 되돌림0, stage/commit/push0. 일회성 실행기는 `/private/tmp/timefit-{protected-volume,protected-backup,restore-existing,verify-existing,seal-backup}.cjs`다. 재사용 가능한 운영 백업 시스템을 새로 구축하지 않았다. 보호 볼륨 생성 → 한 snapshot export → 격리 복원·비교 → 임시 cluster 정리 → 사용자 재입력으로 읽기 전용 재열기 순서를 실제 수행했다. 실행기는 서버 적용/테스트 쓰기 도구가 아니다.

| 항목 | 확인 결과 |
| --- | --- |
| 보관 책임자·복호화 비밀번호 | 사용자. macOS 숨김 창의 최초/확인 입력 및 마지막 독립 재입력 성공. 채팅·CLI 인자·파일·로그에 비밀번호 저장0 |
| 보호 위치 | `/Users/shindongheun/TimeFitBackups/timefit-pre015-20260907T111929Z.sparseimage` |
| 암호화·권한 | hdiutil AES-256, APFS sparseimage. 상위 폴더700·파일600. repo/공유 임시 폴더 밖. 최종 unmount 완료 |
| 복구 기준 시점 UTC | **2026-09-07 11:20:48.763587+00** — REPEATABLE READ READ ONLY transaction의 export snapshot |
| 복구 기준 시점 KST | **2026-09-07 20:20:48.763587+09** |
| 최종 이미지 크기·SHA-256 | **90,304,000 bytes** / `70dccc4e3dac0e6d5bf9730aab607f1dfd97c913924d7d11c5564cc3c7d8be3b` |
| 내부 archive | `backup.dump`, PostgreSQL17 custom format, **315,012 bytes** |
| archive SHA-256 | `cc98a35b637276df0372ab5679994629560ad0bc72b4c55dc7870a9798b5c10b` |
| 보호 내부 근거 | `baseline.json`, `restored-inventory-final.json`, `verification-final.json`, `RESTORE-NOTES.txt`, 사용한 export/복원/검증 실행기. 첫 실패 결과도 이력으로 보호 보관 |

이미지는 다시 쓰기 가능으로 마운트하면 파일 자체 hash가 바뀔 수 있다. 보존·조회에는 읽기 전용 마운트를 사용하고, 내부 archive hash와 별도로 구분한다. 비밀번호를 잊으면 에이전트가 복구할 키 사본은 없다.

### 2) 유지 계약·복원 범위와 한계

- 서버 대상 `hwfsslihmmendxigklrx`: linked/app/DB ref 일치. 서버17.6 → 로컬 PostgreSQL17.11 도구. 백업 전용 remote read-only transaction의 snapshot을 pg_dump에 전달하여 **백업 생성1회** 수행했다. 서버 migration/업무 데이터/가입 상태 변경0.
- Auth/public/supabase_migrations **36개 테이블 전체**, 해당 스키마 정의·함수·trigger·RLS·ACL 및 migration 이력001~014, extensions namespace와 pgcrypto/uuid-ossp 의존성을 포함했다. DB 접속 비밀번호·서비스 키를 불필요하게 archive에 넣지 않았다. Auth 복원용 민감 행은 암호화 내부에만 두고 내용은 출력하지 않았다.
- 소유자/grantee 이름은 로컬에서 NOLOGIN role로 재현했다. 원본 role 속성은 baseline에 기록했으나 provider 로그인 권한·role membership·관리 서비스 동작을 로컬에 동일하게 활성화하지 않았다. 따라서 **저장된 ACL/RLS 정의 비교 PASS이지, 모든 provider role의 effective privilege 또는 Auth 로그인 성공 증거가 아니다.**
- 관리형 Auth 설정/JWT 서명 키/OAuth·SMTP 설정/storage 객체/vault 비밀/관리형 서비스와 전체 cluster를 복구하는 백업은 아니다. 선택 스키마 SQL 복원 PASS를 Supabase 서비스 전체 복구 보장으로 확대하지 않는다. sequence는 pg_dump에 포함되지만 PostgreSQL sequence 값은 MVCC snapshot 원자성 대상이 아니며 별도 실사용 동작 검증은 하지 않았다.
- snapshot 이후 발생한 쓰기는 이 백업에 없고, 해당 시점으로 운영 교체 복원하면 손실될 수 있다. 실제 운영 복원은 별도 승인·provider별 복구 검토가 필요하며 자동 복원하지 않는다.

### 3) 실행 검증 결과·교체 이력

1. 비밀번호 길이 검증 실패로 생성 전 중단했던 이전 시도 → 사용자가 비밀번호를 준비하고 숨김 창에서 입력/확인 성공 → AES-256 이미지 생성·마운트 성공. 방식 동의를 다시 묻지 않았다.
2. 최초 격리 복원은 template0의 기본 `public` 스키마와 archive의 생성문이 중복되어 중단됐다. **원격 재백업 없이** 생성한 로컬 `timefit_restore` DB만 재생성하고 빈 public 스키마를 제거한 뒤 같은 archive를 복원했다. 보호 trigger 비활성화/원격 권한 완화0.
3. 행 데이터는 일치했으나 ACL 배열의 순서 및 pg_dump가 기본값으로 전제하는 public의 PUBLIC USAGE가 달랐다. ACL은 grantor/grantee/권한·grant option을 그대로 유지한 항목 단위 정렬로 비교했고, 로컬에서만 원본 baseline의 정확한 `GRANT USAGE ON SCHEMA public TO PUBLIC`을 복원했다. 순서 차이와 실제 권한 차이를 구분한 뒤 재검증했다. 이 보완은 앱/운영 권한 정책 변경이 아니라 **격리 복원 레시피의 현행 절차**다.
4. 최종 **PASS**: 36개 테이블별 건수 및 정렬된 행 SHA-256 집계가 동일하다. relations(소유자/ACL/RLS flags), columns/defaults, constraints, 사용자 trigger 정의/활성 상태, policies, 함수 정의/소유자/ACL, namespace 소유자/ACL, schema별 default ACL, migration 이력을 비교하여 차이0. 행 원문은 문서/로그에 출력하지 않았다.
5. 로컬 cluster는 암호화 볼륨 내부, TCP `listen_addresses=''`, private Unix socket700으로 실행했다. 최종 프로세스 종료 후 이번에 만든 `restore-cluster`, `restore-socket`, `restore-server.log`만 삭제했다. 원본은 암호화 archive에서 복원 가능하며 최종 백업은 삭제하지 않았다. 과거 실패 진단 파일은 보호 내부에만 남겼다.
6. 볼륨 분리 후 **사용자의 별도 숨김 재입력**으로 읽기 전용 attach 성공, 내부 archive SHA-256 일치, 다시 detach 성공. 따라서 단순 파일 존재가 아니라 실제 사용자 복호화와 SQL 복원을 각각 확인했다.
7. 015/016 hash는 위 기준값(`ab9f…c6e7`, `93b7…5d8`) 그대로 일치. `git diff --check` PASS. 제품/SQL 변경이 없어 이미 통과한 MAINTAIN/timeout/upgrade 및 전체 회귀는 반복하지 않았다. 이번에는 원격 dry-run/push도 수행하지 않았다.

### 4) 다음 담당·복구 안내·QA C 인계

백업을 열 때 macOS의 로컬 비밀번호 입력 또는 `hdiutil attach -readonly -nobrowse -stdinpass <위 이미지>`의 안전한 표준입력 경로만 사용한다. 비밀번호를 명령 인자에 붙이지 않는다. 내부 `RESTORE-NOTES.txt`가 검증한 격리 복원 순서이며, 실행기에는 이번 임시 경로가 있으므로 이를 운영 서버에 그대로 실행하지 않는다. 파일과 비밀번호는 사용자가 분리 보관하고, 적용/QA 후 보관 또는 폐기 여부를 별도로 결정한다.

| 마감 단계 | 최신 상태 / 다음 담당 |
| --- | --- |
| 보호 백업1회 | **PASS**, 최종 암호화 이미지 보존 / 사용자 보관 |
| 격리 SQL 복원·사용자 복호화 | **PASS**, 위 범위와 관리형 서비스 한계 유지 / 통합 수락 |
| 015·016 원격 적용 | **미실행** / DB가 직전 대상·이력·pending·hash·나이 삭제 범위·가입 차단·복구 시점·잠금 영향·명령을 묶어 제시한 뒤 별도 최종 승인 필요 |
| 실제 방문 ack·표본 저장 | **미검증** / 전용 계정·정상 인증 경로·최소 고정 runtime·쓰기/정리 범위 별도 승인 필요 |
| 동일 owner 서버 조회 | **미검증** / QA C 실제 서버 경로 검증 |
| 다음 추천 실제 반영 | **미검증** / QA C, 실기기 확인이나 SQL 복원 PASS로 대체하지 않음 |

사용자의 이번 승인은 A에 한정되므로 B/C를 진행하지 않았다. 백업과 향후 적용 간 시간차·신규 쓰기 손실 가능성을 적용 승인 묶음에서 다시 평가한다. 관리형 서비스 전체 복구가 추가 필수 조건이면 최소 provider 복구 확인 범위를 통합에 반환하며 인프라 구축으로 임의 확대하지 않는다.

## B 사전 점검 인수인계 — 2026-09-07 20:31 KST / 백업 이후 예산 데이터 변경으로 적용 중단

> 중단 당시 이력. 아래 “B 중단 보완·최종 적용 승인 묶음”이 현행이다. 정상 예산 갱신을 이유로 두 테이블을 반복 백업하는 제안은 철회했으며, 추가 백업은 실행하지 않았다.

### 1) 변경 파일·수행 범위

공유 작업 트리는 본 문서만 갱신했다. 일회성 `/private/tmp/timefit-b-preflight.cjs`로 기존 암호화 이미지를 사용자 숨김 입력 후 **읽기 전용**으로 열어 baseline과 원격 read-only transaction을 비교하고 detach했다. 결과 `/private/tmp/timefit-b-preflight-result.json`은600이며 행 원문 대신 테이블 건수/집계 digest·객체 digest·권한·trigger 정보만 기록했다. 제품/SQL/중앙 문서 수정·stage/commit/push0. 기존 A 수락 및 MAINTAIN/timeout 구현·검증은 유지한다.

### 2) 사전 검증 결과·보존 기준

- 원격 기준 시각 **2026-09-07 11:31:48.281431 UTC / 20:31:48.281431 KST**. 앱/linked/DB 대상 `hwfsslihmmendxigklrx` 일치. 명시 REPEATABLE READ READ ONLY, local statement60초/lock3초, UTC, 종료 rollback. 쓰기성 RPC 호출0.
- 원격 이력001~014. `npx supabase@2.116.0 db push --linked --skip-vault --dry-run` exit0: 정확히 `202609070015_release_account_identity_records.sql` → `202609070016_dwell_personalization_storage.sql`, seeds/roles 빈 배열. CLI의 접속용 login role 초기화 메시지는 있었지만 migration/업무 데이터 적용은 없다.
- SHA-256:015 `ab9f35393d22bae81fc965d02f68e9ee5ebb0ef77cee97d3e85acb0ddc06c6e7`,016 `93b76a2a9924d49051b5199b440ddf1fefe7929bebe7b5346b9affed48c4b5d8`, 현행 수락값과 일치. SQL 전체를 읽었고 두 파일의 SET LOCAL lock3초/statement60초를 유지했다.
- A 이미지600·SHA-256 `70dccc4e3dac0e6d5bf9730aab607f1dfd97c913924d7d11c5564cc3c7d8be3b` 일치. A 복구 시점20:20:48.763587 KST, 이번 기준선과 약11분 간격. 기존 A 검증을 취소하거나 경과 시간만으로 재백업하지 않았다.
- 36개 테이블 중 **34개는 건수·행 전체 집계 digest가 백업과 일치**, 삭제된 테이블0. Auth users10, profiles1, courses2, stops2, legs4, feedback0, recommendation_events0, route cache144를 포함한다. 기존 동의 및 나머지 Auth metadata도 전체 행 digest 비교에 포함했다. 사후용으로 profiles의 나이/updated_at/추가컬럼, courses의 추가컬럼, Auth의 최상위 나이 키만 정규화한 별도 digest를 확보했다.
- relations/RLS flags/ACL, columns/defaults, constraints, 사용자 trigger, policies, 함수 정의/owner/ACL, namespace, schema default ACL, migration 이력의 **백업 대비 정의 차이0**. 추가015/016 테이블·컬럼 부분 적용 징후 없음. 이번 비교 목록 외 객체 전체를 검사했다고 확대하지 않는다.
- Auth INSERT → `handle_new_user`, Auth email_confirmed_at UPDATE → postgres 소유 SECURITY DEFINER `sync_profile_email_verification` → profiles BEFORE UPDATE `profiles_guard_changes` → `profiles_set_updated_at` 순서를 확인했다. 기존 guard는 invoker, sync는 postgres definer로 현행015의 depth2 예외 전제와 맞는다.
- exact6개 테이블의 anon/authenticated TRUNCATE/REFERENCES/TRIGGER/MAINTAIN effective 권한48개가 현재 존재한다. 이는 **015 원격 미적용의 예상 상태**이며 로컬 보완 실패가 아니다. 적용 후 제거 및 service_role 보존을 검증해야 한다.
- 관찰 시 대기 lock0, 타 세션의 검사 대상 강한 lock0, active query 시작문 기준 DDL 후보0. 순간 관찰이지 다른 writer의 향후 작업 부재 보장은 아니다. 승인 직전 다시 확인한다.

### 3) 새 차단·적용 영향·최소 해결안

| 백업 이후 변경 | A 기준 | B 사전 기준 | 의미 |
| --- | --- | --- | --- |
| public.route_proxy_daily_budget |22행 |22행, 전체 행 digest 다름 | 건수 동일해도 내용 변경 있음. 이번 집계만으로 변경 행 수를 단정하지 않음 |
| public.route_proxy_second_budget |1867행 |1877행, 전체 행 digest 다름 | 순증10행. 삽입·삭제·수정 각각의 수는 미분리 |

이 둘은015/016의 변경 대상이 아니지만 기존 데이터 보존 범위에 들어간다. A 전체 시점으로 교체 복원하면 백업 후 예산 집계/초 단위 기록을 잃어 호출량 제한이 과소 계산될 수 있다. **B 현행5항에 따라 실제 push 및 최종 적용 승인 요청을 멈췄다.** 이를 허용 가능한 손실로 임의 분류하지 않는다.

최소 권장안: 기존 A 이미지는 hash 그대로 보존하고, 위 두 테이블의 최신 일관 snapshot만 별도 보호 보충본으로 확보·격리 복원 검증한 뒤 적용 직전 비교를 갱신한다. 새로운 전체 백업 시스템/SQL 재구현은 필요 없다. 능동 작업 예상30~60분(로컬 비밀번호·도구 승인 대기 제외). 계속 들어오는 정상 예산 쓰기 때문에 시점 차이가 반복되면 무한 재백업하지 않고, 해당 두 테이블은 운영 복원에서 덮어쓰지 않는 제한 복구 범위 또는 짧은 호출 중지 필요성을 통합에 반환한다. 호출 중지·예산 손실 수락·운영 복원은 현재 승인하지 않았고 실행하지 않았다.

해소 후 한 번에 제시할 실제 적용 영향은 다음과 같다.

- 나이 제거 현재 **profile1행**의 birth_year/age_band NULL, **Auth1행**의 raw_user_meta_data 최상위 동명 두 키 삭제(각 키도1행). 계정 전체/중첩 키/나머지 metadata/기존 동의/코스 graph는 삭제하지 않는다. profile updated_at은 기존 trigger에 의해 갱신된다.
- 015는 계정 전용 RLS·선택 닉네임·동의/완료/guest import/삭제 요청 계약과 원자적 코스 저장을 추가·교체하며 exact 위험 권한을 회수한다.016은 선택 체류 동의·표본·집계 저장 및 RPC를 추가하고 count 함수를 확장한다. 신규 일반 가입은 실제 문서 registry 준비 전 일시 차단된다(이미 수락된 영향). 기존 로그인 유지 의도와 실제 인증 검증은 구분한다.
- Auth/users와 profiles의 ACCESS EXCLUSIVE lock은 읽기/쓰기를 잠시 막을 수 있다. lock3초, 개별 statement60초, 파일별 transaction이다.015만 성공하고016 실패할 수 있다. 실패 시 반복 push/repair/reset/보호 해제/강제 세션 종료/SQL 조각 우회/자동 운영 복원0, 읽기 전용 부분 상태 보고만 한다.
- 적용 명령(아직 실행 승인 전): `npx supabase@2.116.0 db push --linked --skip-vault`. 대상/hash/pending/보존 기준이 승인 직전 동일할 때 정확한 두 파일만 적용한다. A는 격리 SQL 복원 PASS이며 관리형 Auth 전체 서비스 복구 보장은 아니다.

### 4) 다음 담당·유지 계약·검증 상태

사용자/통합: 두 예산 테이블의 최소 추가 보호 범위 또는 덮어쓰지 않는 제한 복구 경계를 결정한다. DB: 결정된 최소 보호를 확인한 뒤 적용 근거 전체를 묶어 **최종 운영 적용 승인**을 별도로 받는다. 현재 상태는 **사전 dry-run PASS / 백업 이후 변경 대응 미확정 / B 미적용**이다.

제품/SQL 변경이 없으므로 이미 유효한 전체 테스트와 MAINTAIN/timeout/upgrade 보완은 반복하지 않았다. C 실제 계정 인증/RLS 실행·방문 ack·표본 저장·owner 조회·추천 반영은 모두 미검증이다. 전용 검증 계정/정상 인증·최소 고정 runtime 쓰기/정리의 별도 승인, 실제 약관 등록, Edge/scheduler 준비를 C 조건으로 인계하며 이번에는 실행하지 않는다.

## B 중단 보완·최종 적용 승인 묶음 — 2026-09-07 20:45 KST

**현행 상태: 사전 조건 정리 완료·최종 운영 적용 승인 요청 / B 미적용 / C 미실행.**

### 1) 변경 파일·방법 및 교체 이유

본 문서만 갱신했다. 일회성 `/private/tmp/timefit-b-budget-impact.cjs` 및600 결과 파일 `/private/tmp/timefit-b-budget-impact-result.json`으로 원격 catalog·함수 본문·기준선 digest를 명시 read-only transaction에서 조회했다. 제품·SQL·원격 데이터 변경0, 추가 백업·호출 중지·운영 복원0, stage/commit/push0.

이전: 백업 후 예산 digest 변경 → 두 테이블 추가 보호 제안 → 정상 갱신이 지속되면 보호 시점 추격이 반복됨 → **015/016 영향 분석 후 비영향 예산 데이터를 현 위치에 보존하고 전체 시점 덮어쓰기를 금지하는 제한 복구로 교체** → 정상 카운터를 과거 값으로 되돌리지 않기 위함 → **제한 복구 방안 제안 완료, 실제 복구는 별도 승인**. A 수락·MAINTAIN/timeout 검증은 현행 유지, 재검증/재구현하지 않았다.

### 2) 두 예산 테이블의 직접·간접 영향 판정

관찰시각 **2026-09-07 11:45:50.546070 UTC / 20:45:50.546070 KST**.

- **직접 변경 없음:**015/016 전체 SQL에 두 테이블 및 route_proxy 함수 참조가 없다. 기존 데이터 UPDATE는 profiles 나이와 Auth 최상위 나이 metadata에 한정된다. 위험 grant 회수는 exact6개 계정 테이블이며 예산 테이블은 제외다. schema/role/extension/전역 default privilege를 바꾸는 문장도 없다. dynamic SQL은 나이 guard의 제한 교체·복원 및 exact6개 MAINTAIN 회수뿐이다.
- **행 trigger/FK 경로 없음:** 두 테이블의 사용자·내부 trigger0, 들어오거나 나가는 FK0. CHECK/PK는 built-in 형식/범위 검사뿐이고, catalog 의존성은 자체 constraint/default/index/type/TOAST 및 public namespace다. 확인된 default/index와 예산 테이블의 ACL/RLS 정의는 이전 기준과 같다. 계정·개인화 객체와 연결되는 FK/cascade 경로는 없다.
- **함수 경로:** public의 route_proxy 함수10개와 예산 이름 참조 함수 본문을 읽었다. 예산 직접 참조는 `route_proxy_read_budget`와 `route_proxy_reserve_budget`이며 reserve는 built-in advisory lock → 두 예산 row 조회/UPSERT뿐이다.015/016에서 교체하는 계정 함수, Auth/profile trigger 함수, `is_account_user`를 호출하지 않는다. 기타 route 함수는 cache/lease 경계와 `route_proxy_put_route`로 연결되며 계정 경로를 호출하지 않는다. 함수 본문 비교는 pg_depend가 PL/pgSQL 본문의 모든 참조를 추적하지 못하는 한계를 보완한다.
- **전역 DDL event:** 현재7개 event trigger 본문까지 확인했다. `ensure_rls`는 이번에 생성되는 새 테이블만 RLS 활성화한다. extension 관련4개는 CREATE/DROP EXTENSION 태그로 한정되며 두 SQL에 해당 문장 없음. `pgrst_ddl_watch`/`pgrst_drop_watch`는 스키마 cache reload NOTIFY를 수행하며 예산 행/함수/권한을 수정하지 않는다. 따라서 ‘서비스 영향 전혀 없음’으로 확대하지 않는다. 스키마 reload에 따른 일시적 API 지연 가능성은 남는다.
- 이전 B 기준선 대비 **정의 digest 차이0, 예산 외34개 테이블 행 digest 차이0**. 일별 예산22행, 초별 예산1882행으로 정상 쓰기는 계속 관찰됐다. 이는 해당 값을 폐기하거나 감소시켜도 된다는 뜻이 아니다. 관찰시 대기 lock0·AccessExclusive lock0. 이력001~014 유지.

판정: **확인한 SQL·현재 catalog/함수/trigger 경로상 두 예산 테이블의 데이터·정의·권한을 변경하는 직접/간접 경로 없음**. 두 테이블과 정상 갱신 데이터는 그대로 보존한다. 서버 전체 장애·향후 타 writer·모든 동적 코드 경로의 무조건적 부재를 보장하지 않는다. 적용 직전 정의 drift나 다른 pending이 나타나면 중단한다.

### 3) 실행 가능한 제한 복구 경계와 근거

1. **실패 파일 transaction 결과부터 판별:** CLI2.116.0의 검증된 파일별 transaction에 따라015 실패면 해당 파일 schema/data/history는 rollback 대상이다.015 commit 후016 실패면015 상태와 이력15를 유지하고016 부분 객체 유무를 읽기 전용 확인한다. 통신 단절 시 성공/실패를 추정하지 말고 이력·객체를 먼저 조회한다. 즉시 재push·repair·reset·자동 복원0.
2. **현재 운영 예산/route 경계는 복구 쓰기 제외:** `route_proxy_daily_budget`, `route_proxy_second_budget`의 INSERT/UPDATE/DELETE/TRUNCATE/DROP/ACL 변경0. cache/lease와 route_proxy 함수도 이 migration 복구의 대상이 아니다. 전체 DB/public/auth schema restore, `pg_restore --clean` 운영 실행, `DROP ... CASCADE`, 전체 권한/default privilege 재설정을 금지한다. 예산 테이블 제외 옵션 몇 개만 붙인 전체 dump 복원을 안전한 제한 복구로 취급하지 않는다.
3. **이미 commit한 변경의 문제는 별도 승인된 좁은 복구/전진 수정:** A archive를 기존 승인 방식의 보호된 격리 DB에 복원해 이전 정의/필요 행을 참조하고, 현재 서버와 diff하여 문제 있는015/016 객체의 exact allowlist를 만든다. 수정안은 별도 migration으로 기록하며 기존 이력 삭제/위장0. 불필요한 새 테이블 DROP이나 이미 생긴 기록 삭제를 하지 않는다. 이때도 원격 복원·추가 export는 별도 승인한다.
4. **나이 원복이 별도 승인되는 예외에만:** A에서 해당 계정의 기존 두 키/컬럼을 보호 내부로 추출하고 현재 행의 동일 PK·비나이 필드·동시 변경을 대조한 뒤, 승인된 exact필드만 복구하는 최소 SQL을 설계·격리 테스트한다. Auth 전체 row/metadata를 과거 값으로 교체하지 않는다. 가입/로그인 변경·새 동의·닉네임·코스 기록을 덮어쓰지 않는다. 현재 guard는 직접 나이 변경을 막으므로 임의 UPDATE/trigger disable로 우회하지 않으며, 그 시점의 별도 검증·승인 전에는 실행 가능한 원복 완료를 주장하지 않는다.
5. **근거와 남은 한계:** A는 Auth/public/이력36테이블의 격리 SQL 복원·정의/행/ACL 비교와 사용자 복호화가 PASS여서 이전 데이터/정의 참조원이 실제 존재한다. 이번 의존성 검사로 예산 데이터를 원복할 필요가 없음을 확인했다. 다만 commit 이후 특정 결함의 exact 복구 SQL은 결함과 최신 쓰기 상태를 알아야 확정할 수 있고, **자동 rollback 스크립트/운영 복원 검증 완료가 아니다**. 관리형 Auth 서비스 전체 복구·서버 전체 장애는 이 제한 계획 범위 밖이다. 큰 범위가 필요하면 중단해 통합에 반환한다.

### 4) 최종 운영 적용 승인 요청 내용

| 항목 | 승인 요청 기준 |
| --- | --- |
| 대상·현재 이력 | `hwfsslihmmendxigklrx`, 앱/linked/DB 일치,001~014 |
| 적용 파일015 SHA-256 | `ab9f35393d22bae81fc965d02f68e9ee5ebb0ef77cee97d3e85acb0ddc06c6e7` |
| 적용 파일016 SHA-256 | `93b76a2a9924d49051b5199b440ddf1fefe7929bebe7b5346b9affed48c4b5d8` |
| dry-run 재확인 | 고정2.116.0 exit0, exact015→016, seeds/roles 빈 배열 |
| 나이 삭제 | profiles1행의 birth_year/age_band NULL + Auth1행의 raw_user_meta_data **최상위** 동명 두 키 제거. 각 컬럼/키도1행. profile updated_at 기존 trigger 갱신은 별도 허용 영향 |
| 보존 | 계정·기존 동의·비나이 metadata·코스 graph·route cache/lease/예산 현재 데이터. 나이/예정 추가컬럼/updated_at 외 내용 비교. 필요한 계정 RLS·grant 변경은 승인된 두 SQL의 exact 범위 |
| 서비스 영향 | 실제 문서 registry 등록 전 신규 일반 가입 일시 차단(이미 수락), 계정 전용 RLS/기록·선택 닉네임·개인화 저장 기반 추가. 기존 로그인 실제 성공과 C 학습은 이번 검증 아님 |
| 잠금·실패 | Auth/profiles ACCESS EXCLUSIVE 가능, lock3초/개별 statement60초. 파일별 transaction,015만 성공 가능. 실패 시 중단·부분 상태 보고, 반복 실행/자동 복원0 |
| 복구 근거 | A 시점2026-09-07 20:20:48.763587 KST, 사용자 보관 AES-256 이미지·격리 SQL 복원 PASS. 이미지 hash `70dccc4e3dac0e6d5bf9730aab607f1dfd97c913924d7d11c5564cc3c7d8be3b` 재일치. 위 제한 복구만 제안, 운영 복원은 별도 승인 |
| 정확한 명령 | `npx supabase@2.116.0 db push --linked --skip-vault` |

최종 승인 후에는 대상/hash/pending·계정 보존 기준선·비영향 route 정의를 다시 확인하고 동일할 때만 위 명령을1회 실행한다. 정상 예산 카운터 갱신만으로 반복 백업하지 않는다. 사후001~016 이력, 예상 객체/constraint/index/함수/trigger/RLS/grants, exact 나이 제거, 기존 계정/동의/graph/metadata 보존을 검증한다. 예산은 정의·권한 및 이 migration의 비변경 경계를 검사하며 정상 쓰기로 digest가 달라졌다는 이유로 내용을 되돌리지 않는다. 동시 쓰기를 구분할 수 없는 항목은 미확인으로 기록한다.

**현재 실제 push0·B 미적용.** C 테스트 계정·표본 쓰기/정리·실제 약관 등록·Edge/scheduler 배포는 승인 요청에서 제외한다. C에는 전용 계정/정상 인증 경로·최소 고정 runtime 쓰기/정리 별도 승인 필요만 인계한다. 제품/SQL을 변경하지 않아 기존 전체 회귀·A·MAINTAIN/timeout 테스트를 반복하지 않았고, 이번 검증은 읽기 전용 영향 검사·기준선/hash·dry-run이다.

## B 승인 후 직전 검사 인수인계 — 2026-09-07 21:08 KST / Auth drift로 적용 전 중단

1. **변경 파일·수행 목적:** 본 문서에 실제 실행 여부와 차단 근거를 기록했다. 일회성 `/private/tmp/timefit-b-execution-check.cjs`는 before/after 읽기 전용 검사용으로 작성했으며 **before만 실행**했다.600 결과 `/private/tmp/timefit-b-execution-before.json`에는 원문 행 없이 테이블 digest·정규화 digest와 객체 정의/권한을 보관했다. 제품·migration·중앙 문서 변경0, stage/commit/push0. 중간 사용자 재전달 이전에도 실제 migration 실행 명령은 호출하지 않았다.
2. **유지 계약:** B 최종 운영 적용 승인은 완료 상태로 유지한다. 다만 승인문이 명시한 ‘예상 밖 계정 변경이면 적용하지 말고 차이를 반환’ 조건을 적용했다. 정상 예산 갱신은 차단에서 제외했고 추가 백업·호출 중지·복원은 하지 않았다. A 및 MAINTAIN/timeout 기존 수락은 철회하지 않는다.
3. **검증 결과:** 기준시각2026-09-07 **12:08:38.087305 UTC /21:08:38.087305 KST**. 대상 `hwfsslihmmendxigklrx`, 두 SQL full hash는 수락값과 일치, 정의 digest 차이0, 이력001~014, lock/active DDL 검사 차단0. 고정 CLI dry-run exit0·exact015→016·seeds/roles 빈 배열. 나이 제거 대상 profile1행/Auth1행 유지. 그러나 다음 Auth 변경 때문에 before 게이트 exit1로 중단됐다.

| 비교 대상 | 승인 기준선 | 직전 검사 | 판정 |
| --- | --- | --- | --- |
| auth.users |10행 |10행 | 전체 행 및 **나이 두 키를 제외한** digest 모두 달라짐 |
| auth.sessions |6행 |6행 | 행 내용 digest 달라짐 |
| auth.refresh_tokens |117행 |118행 | 순증1행 및 digest 달라짐 |
| profiles·courses | 기존 기준 | 동일 | 정규화 보존 digest 일치 |
| 비교 대상 schema/함수/trigger/RLS/ACL | 기존 기준 | 동일 | 정의 drift 없음 |

이 조회는 원문 계정/토큰을 출력하지 않는다. 현재 집계만으로 정상 세션 갱신·last_sign_in_at/updated_at 변경인지, credential/metadata 등 보호 필드 변경인지 구분할 수 없다. 토큰 증가를 근거로 모든 Auth 변경을 정상이라고 추정하지 않았다. 이번 CLI는 dry-run만 실행했으므로 **migration 실패 또는015 부분 적용이 아니라 적용 전 검사 중단**이다. 실제 push0, 적용 이력001~014, after 검사 미실행.

4. **다음 담당·최소 해소 조건:** DB/통합이 기존 암호화 A 기준선의 원문을 보호된 로컬 범위에서만 대조하여 변경된 Auth 필드를 분류해야 한다. 현재 비교 자료는 행별 원문이 아닌 전체 digest이므로 정확한 필드 분리에 기존 archive의 보호된 조회가 필요하다. 신규 백업 시스템/반복 백업이나 기존 승인 재질문은 필요하지 않다. 정상 인증 갱신으로 확인되면 최신 세션/토큰을 그대로 두는 제한 복구 경계와 갱신된 적용 기준을 명시하고 기존 B 승인 조건 안에서 재개할 수 있는지 판단한다. 예상 밖 credential/metadata/계정 변경이면 정확한 영향만 반환한다. **새 기준선을 조용히 수락하거나 기존 Auth 상태로 덮어쓰지 않는다.** C 테스트 쓰기·약관 등록·Edge/scheduler 배포는 계속 미실행이며 B 완료로 기록하지 않는다. 제품/SQL 수정이 없어 전체 회귀는 반복하지 않았다.

## B 완료 인수인계 — 2026-09-07 21:24 KST / 정상 Auth 갱신 확인·015→016 적용 PASS

### 1) 변경 파일·진단과 실제 실행

공유 작업 트리는 본 문서만 갱신했다. 제품/SQL/중앙/UI/engine 파일 수정0, 기존 공유 변경 되돌림0, stage/commit/git push0. 일회성 실행기 `/private/tmp/timefit-auth-drift-diagnose.cjs`, `timefit-b-execution-check.cjs`, `timefit-b-catalog-final.cjs`로 진단·직전/사후 read-only 검사·catalog 대조를 수행했다. 결과 JSON은 같은 접두어의 `/private/tmp/` 파일에600으로 저장했다. 사용자/토큰 원문은 저장·출력하지 않았다.

**실제 원격 변경:** 사용자 기존 B 승인에 따라 `npx supabase@2.116.0 db push --linked --skip-vault`를 **1회** 실행했다. CLI exit0, dryRun=false, 적용 목록은 정확히015·016, seeds/roles 빈 배열. 반복 push·repair/reset·수동 SQL 조각 적용·보호 trigger 해제·운영 복원0. C 테스트 계정·표본·약관 registry·Edge/scheduler 쓰기0.

### 2) Auth drift 분류와 유지 계약

기존 전체 digest 불일치 → 원인을 모른 채 적용 중단 → 사용자 후속 승인으로 기존 A를 읽기 전용 열고 `pg_restore --data-only --schema=auth --table=... --file=-` 출력을 **프로세스 메모리에서만** 비교 → 다음 정상 갱신을 확인 → 최신 인증 데이터 기준으로 적용 → **현행 완료**. 새 백업이나 평문 임시 dump는 만들지 않았으며 A는 변경 없이 detach했다.

- users10행 유지, 추가/삭제0. 변경 필드는 **updated_at 2행뿐**이다. ID·이메일·비밀번호/자격증명·Auth metadata 및 나머지 계정 필드 동일.
- sessions6행 유지, 추가/삭제0. 변경은 동일한2개 세션의 **updated_at/refreshed_at/IP**뿐이다. 처음 inet COPY와 text의 `/32`·`/128` 표기 차이가6개 IP 차이로 보였으나 정규화 후 실제 변경2개를 분리했다. 토큰과 무관한 IP 변경을 자동 허용하지 않았다.
- refresh_tokens117→119행. 새2개 모두 기존 부모 토큰을 참조하고 기존 동일 사용자·세션에 연결되며 미폐기 상태다. 기존 토큰2개는 revoked=false→true 및 updated_at만 변경됐다. 삭제0.
- 변경된 모든 사용자/세션은 새 토큰과 같은 user/session으로 연결되고 세션 갱신시각은 증가했다. 실제 IP는 유효 주소 형식이며 해당 갱신 세션에 한정됐다. 이 **일치한 회전 경로**를 정상 인증 갱신으로 판정했으며 사용자의 신원·접속 의도를 별도로 인증했다는 뜻은 아니다.
- 진단 snapshot **21:21:42.057599 KST**, 설명되지 않는 필드/행 변경0. 해당 snapshot의 Auth digest를 별도로 확보하고 직전 검사에서 정확히 동일한지 확인했다. 계정 비교 전체를 무조건 제외하거나 시각 필드를 이유 없이 무시하지 않았다.
- 직전 route cache 갱신도 발견됐다. 기존 영향 검사의 cache/lease/예산 비변경·제한 복구 제외 경계를 적용해 최신 데이터를 그대로 두었다. account/schema drift와 route 정상 쓰기를 분리했고 추가 백업·호출 중지를 하지 않았다.

### 3) 적용·사후 검증 결과

직전 snapshot **21:22:26.878900 KST**: target `hwfsslihmmendxigklrx` 일치, Auth는 위 진단 snapshot과 동일, 프로필/코스·기존 schema/함수/trigger/RLS/ACL은 승인 기준과 동일. lock/DDL 차단0. dry-run exit0·pending exact015→016. 소스 hash는 변경 없이 다음 값이다.

| 파일 | SHA-256 |
| --- | --- |
|015 | `ab9f35393d22bae81fc965d02f68e9ee5ebb0ef77cee97d3e85acb0ddc06c6e7` |
|016 | `93b76a2a9924d49051b5199b440ddf1fefe7929bebe7b5346b9affed48c4b5d8` |

CLI 실제 적용 성공 후 **21:24:22.693741 KST** read-only snapshot에서 확인했다.

| 검증 | 결과 |
| --- | --- |
| migration 이력 |001~014 → **001~016**,015·016 모두 등록, CLI exit0 |
| 승인된 나이 제거 | profile1행의 birth_year/age_band NULL, Auth1행의 최상위 동명2키 제거. 남은 대상0/0 |
| 계정/metadata 보존 | 나이 키만 정규화한 Auth 전체 행 digest가 **직전 최신 기준과 동일**. 사용자10행, 최신 session6행/token119행 내용도 보존 |
| 프로필/동의/코스 graph | 승인된 나이·updated_at·신규 컬럼 외 정규화 digest 동일. 기존 동의/비나이 metadata/코스2·stops2·legs4 및 나머지 비교 데이터 보존 |
| route 경계 | cache/lease/두 예산 테이블의 정의·함수·권한·RLS 동일. 이번 직전→사후 관찰 구간에는 **행 digest도 동일**. 과거 백업 값으로 덮어쓰기0 |
| 신규 테이블 |15개 존재, 전부 RLS 활성화·0행. signup registry/완료/체류 표본에 테스트 쓰기 없음 |
| 함수 | 두 SQL의 최종 함수 **21개 본문**을 사후 정의와 대조해 일치. 변경 대상 밖 기존 함수·schema/default ACL 보존 |
| 정책 | 생성/교체 정책25개 존재, authenticated 대상 및 account/owner predicate 확인. legacy profiles_update_own 제거 |
| constraints/index | 기존 constraint166개·index116개 정의 보존, 전체 constraint244개 validated. SQL 지정 신규 index 존재 확인 |
| 권한 | exact6개 테이블 × anon/authenticated × 위험4권한(TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) **48개 effective 거절**. 기존 service_role 권한 보존 |
| 신규 테이블 ACL | PUBLIC/anon 권한 없음, authenticated는 지정7개 테이블 SELECT만, 나머지8개 직접 권한 없음. service_role DML 유지(기존 default grant의 추가 service 권한을 임의 회수하지 않음) |
| Auth/profile trigger | 기존 topology·활성 상태 동일, 최종 guard 본문 일치. 이메일 동기화 **실제 Auth 쓰기 시험은 미실행** |

사후 검사 자체에서 PostgreSQL name[]의 문자열 표현과 service_role의 보존된 default grant를 잘못 가정한 첫 catalog 검사 경고가 있었다. 실제 catalog를 확인해 roles 표현만 정규화하고 service DML 포함 여부/기존 권한 보존으로 바로잡은 뒤 **errors0**을 확인했다. 제품 SQL을 변경하거나 migration을 재실행하여 검사를 통과시키지 않았다. `git diff --check` PASS. 제품/SQL 소스 수정이 없어 전체 회귀·A 복원·MAINTAIN/timeout 기존 테스트는 반복하지 않았다.

### 4) 제한 복구·잔여 위험·QA C 인계

- **B schema 적용 및 위 읽기 전용 사후 검증 PASS**다. 실제 계정 로그인/RLS 역할별 RPC 실행·방문 ack·표본 저장·owner read·다음 추천 반영은 모두 **C 미검증**이다. catalog PASS를 실제 학습 성공으로 대체하지 않는다.
- registry0행이므로 신규 일반 가입은 승인된 일시 차단 조건이다. 실제 약관 준비/등록과 정상 가입 시험은 별도 담당·승인 대상이며 가짜 registry를 넣지 않았다. Edge 삭제 함수/180일 scheduler 배포도 하지 않았다.
- 나이 제거는 승인대로 실제 수행됐다. 기존 값은 사용자 보관 A 암호화 archive에서 참조할 수 있지만 원복은 별도 승인·현재 데이터 대조·보호 guard 경계를 검증해야 한다. 전체 DB/Auth/public 또는 최신 session/token/route 데이터 덮어쓰기는 금지한다. 자동 복원·백업 폐기0.
- A 복구 시점20:20:48.763587 KST 이후 최신 인증 데이터는 **이번 migration에서 보존**했고 A가 최신 token을 담는다고 주장하지 않는다. 장애 시 exact 변경 객체를 대상으로 별도 승인된 제한 복구/전진 수정을 검토한다. 관리형 Auth 전체 서비스 복구 보장은 아니다.
- 다음 담당: 통합은 B 적용 사실을 수락하고 QA는 C에 필요한 전용 계정/정상 인증·최소 고정 runtime 쓰기·exact 정리 승인만 준비한다. 이번 작업에서 C를 시작하거나 같은 운영 적용 승인을 다시 요청하지 않는다. 공유 작업 트리의 기존 다른 세션 변경은 그대로 보존했다.

## B 이후 앱 로그인 진단 — 2026-09-07 / CAPTCHA 계약 누락 확인·로그인 미해결

### 진단 결과

B 적용/기존 검증은 반복하지 않았다. 기존 CLI 인증을 이용한 Management API의 Auth 로그·Auth 설정 GET 및 명시 read-only DB 상태 집계만 수행했다. 브라우저 연결은 제공되지 않아 Management API로 조회했다. 계정·비밀번호·토큰·IP·설정 secret 원문은 출력/문서/fixture에 넣지 않았다. 진단 스크립트는 `/private/tmp/timefit-login-{auth-logs,captcha-check,account-status}.cjs`, 안전한 상태/코드 결과는 같은 경로의600 JSON이다. 공유 작업 트리는 **본 문서만** 변경했다.

| Auth 로그 KST(2026-09-07) | 요청 | HTTP | 오류 코드 |
| --- | --- | --- | --- |
|21:24:59 |POST /token, grant_type=password |400 |captcha_failed |
|21:25:11 |동일 |400 |captcha_failed |
|21:25:38 |동일 |400 |captcha_failed |
|21:25:47 |동일 |400 |captcha_failed |
|21:27:27 |동일 |400 |captcha_failed |

각 로그의 안전한 원인 신호는 `captcha protection: request disallowed`와 token 관련 거절이다. 같은 범위의 GET /user 200(21:24:40,21:28:17)은 기존 세션 사용자 조회이며 **비밀번호 로그인 성공을 뜻하지 않는다**. 사용자에게 실패 시각을 요청했지만 아직 응답은 없으므로 위5건과 사용자의 특정 시도1건의 대응은 미확정이다. 그러나 해당 비밀번호 로그인 실패 원인은 실제 서버 코드로 확인했다.

현재 서버: **CAPTCHA enabled=true, provider=turnstile**, email provider=true, mailer_autoconfirm=true, disable_signup=false. 마지막 두 설정은 DB의 실제 동의 registry 조건을 우회하지 않는다.015의 신규 일반 가입 trigger 차단과 로그인 CAPTCHA 차단은 별개다. 설정을 변경하지 않았다.

코드: `src/ui/AuthContext.tsx`의 signIn은 `signInWithPassword({ email: email.trim(), password })`만 전달하며 **options.captchaToken을 전달하지 않는다**. 반환 error를 새 일반 Error로 바꿔 원래 code/status를 잃는다. `src/ui/LoginScreen.tsx` catch는 다시 모든 실패를 “입력과 연결 상태를 확인하고 다시 시도해주세요”로 표시한다. 따라서 **서버 Turnstile 요구 ↔ 앱의 비밀번호 로그인 CAPTCHA 토큰 누락**이 확인된 실패 원인이다. [Supabase CAPTCHA 계약](https://supabase.com/docs/guides/auth/auth-captcha)은 로그인 등 인증 요청에 CAPTCHA 클라이언트 연결을 요구한다. 추가 네트워크 인증 시도 없이 현재 SDK/호출 경계와 서버 로그를 대조했다.

보조 read-only 집계: 일반 계정1, 이메일 확인1, 비밀번호 hash 존재1, 현재 ban0, 삭제0, identity provider=email1. 비밀번호 값/일치 여부를 읽거나 시험하지 않았다. 현재 로그는 email_not_confirmed/invalid_credentials/user_banned/DB trigger 500이 아니라 captcha_failed다. **관찰된 실패를 이메일 인증·계정 제한·DB trigger 문제로 돌릴 근거는 없다.** CAPTCHA 통과 후 다른 오류가 발생할 가능성까지 배제하지 않는다.

### 로그인 해결 여부·최소 수정안·담당

**원인 확인 / 수정 미실행 / 로그인 해결 미확인.** 사진/UI/추천 정책/제품 코드·migration·서버 설정 변경0. 계정 재생성·비밀번호 초기화·CAPTCHA 비활성화·인증 우회·추가 백업0. 서버 변경은 현재 확인한 최소 수정에 필요하지 않다. 이후 제공사 origin/sitekey 설정 수정 등이 실제로 필요해지면 정확한 범위를 제시해 별도 승인받는다.

UIUX + Auth API 경계 담당 인계:

1. 이미 존재하는 `CaptchaVerificationSheet`와 `captchaVerificationModel`의 허용 origin·신뢰 message·token callback을 재사용할 수 있는지 확인한다. 사용자의 명시 비밀번호 로그인에도 새 challenge를 연결하고, 검증된 일회성 token을 `signInWithPassword({ email, password, options: { captchaToken } })`로 전달한다. 익명 로그인에서 사용한 토큰을 재사용하지 않는다. 취소/만료/실패 시 로그인 자동 재시도0, 매 새 시도 challenge 재발급. 토큰 저장/로그0. 이번 DB 세션은 UI를 수정하지 않는다.
2. 최소 안전 진단 항목은 `attemptAtUtc`, `operation=signInWithPassword`, `stage=captcha|auth`, 허용된 `AuthApiError.code`, 숫자 `status`, `captchaTokenProvided:boolean`, 앱 버전/빌드와 가능할 때 비민감 request correlation ID다. email/password/token/session/user 객체·요청 body/headers·raw error 전체·IP는 수집하지 않는다. 서버 실패 코드가 일반 문구로 교체되기 전에 안전한 필드만 보존하고 표시 문구와 분리한다.
3. 고정 fixture로 토큰 전달/누락/취소/만료 및 captcha_failed·invalid_credentials·email_not_confirmed·500·network 오류를 구분 검증한 뒤, 사용자가 비밀번호를 직접 입력하는 최소 로그인1회를 확인한다. 반복 운영 로그인이나 계정 초기화로 테스트하지 않는다. 성공은 Auth /token 200 및 실제 계정 session 연결로 확인하며 GET /user 200만으로 대체하지 않는다.

### C 진입 조건

C는 시작하지 않았다. 우선 위 로그인 연결 수정과 최소 실제 로그인 성공 확인이 필요하다. 이후 별도 승인 묶음은 **전용 일반 계정1개(기존 계정 사용 시 전용 지정 동의), 정상 인증·실제 개인화 동의, 고정 clock/route runtime의 완료3건·각1장소 표본 최대3건, 같은 owner 조회1회·다음 추천 반영1회, 생성한 completion/sample/consent의 exact 정리** 범위로 제시한다. 실제3회 방문은 요구하지 않으며 외부 경로 API는 fixture로 대체하되 Supabase 저장/조회 adapter는 실제를 사용한다. 전용 계정 생성/동의/쓰기/정리는 모두 승인 전 실행0이며 기존 일반 계정을 테스트용이라고 임의 지정하지 않는다. 계정 전체 삭제/가짜 약관 등록/Edge 배포를 묶어 승인받거나 자동 실행하지 않는다.

현재 상태: **B 완료 유지 / 로그인 미해결 / C 진입 불가·쓰기0**. 정상 가입 registry·실제 문서·Edge/scheduler 등 별도 출시 조건도 그대로 유지한다.

## C 사전 점검 인수인계 — 2026-09-07 22:21 KST / exact 정리 경로 미충족·쓰기 전 중단

### 1) 변경 파일·목적과 최신 승인

공유 작업 트리에서는 본 문서만 갱신했다. 최신 B 완료·C 조건과 `docs/work/uiux/password-login-captcha.md` 인수인계를 읽었다. UIUX 보완 후 **사용자가 기존 계정의 실기기 로그인 성공을 확인**했으므로 앞선 로그인 미해결 상태는 과거 이력이다. CAPTCHA 재수정·B 적용/검증 재실행·추가 백업0. 사용자는 현재 로그인 계정의 제한 C 사용을 승인했으며 같은 승인을 다시 요청하지 않는다.

로컬 일회성 `/private/tmp/timefit-c-cleanup-preflight.cjs`로 대상 `hwfsslihmmendxigklrx`를 확인하고 **명시 read-only transaction**, statement timeout10초로 함수 본문·외래키·trigger·effective DELETE 권한만 조회했다. 안전한 catalog 판정 결과는 `/private/tmp/timefit-c-cleanup-preflight-result.json`(600)에 기록했다. 계정 행·비밀번호·세션/토큰 원문 조회·출력0. 실제 C 데이터 생성 ID는 **없음**이다.

### 2) 유지 계약·중단 근거

이전 C 계획의 완료/표본 exact 정리 전제 → 실제 공개 삭제 경계 조사에서 아래 공백 발견 → 사용자의 명시 지시대로 **쓰기 전에 중단** → 기존 기록·동의·표본을 훼손하지 않기 위한 조치이며 **현행 미완료**다. 완료 기록과 학습 표본의 독립 보관 자체를 제품 결함이나 정책 변경 대상으로 단정하지 않는다.

| 확인한 경계 | 원격 정의/권한과 실제 의미 |
| --- | --- |
| `deleteOwnedAccountRecord({completionId, requestId})` → `delete_account_course_completion(text,text)` | 해당 완료/하위 장소 기록을 지우고 tombstone·mutation을 남긴다. **학습 표본 삭제와 집계 재계산은 없다.** 로컬 evidence 정리를 서버 표본 정리로 해석하지 않는다. |
| `dwell_completion_samples` | FK는 `user_id → auth.users(id) ON DELETE CASCADE`만 있다. 완료 기록 FK와 사용자 trigger는 없다. authenticated 직접 DELETE는 false다. 완료 삭제가 표본으로 cascade되지 않는다. |
| `resetOwnedDwellPersonalization` → `reset_dwell_personalization` | owner의 **전체** 표본/집계를 삭제하고 동의 enabled=false·epoch=null·revision 증가. 사용자 금지 범위이므로 호출하지 않았다. |
| `read_dwell_personalization_samples` | 180일 만료 표본을 삭제할 수 있는 조회 RPC다. exact 테스트 ID 정리 경로가 아니며 기존 데이터 기준선용 순수 조회로 호출하지 않았다. |
| `purge_expired_dwell_samples` / `refresh_dwell_profiles_for_user` | 전자는 전체 만료 정리, 후자는 owner 전체 집계 삭제/재생성이다. 새 테스트 ID만 삭제하는 공개 함수가 아니며, 무관한 집계의 updated_at 등도 보존한다고 보장할 수 없다. 호출0. |

관리자 권한으로 제한 DELETE를 구성하는 것이 기술적으로 불가능하다는 뜻은 아니다. **현재 검증된 공개 함수 조합에는 exact 표본 정리와 기존 집계 보존 경로가 없고, 관리자용 실행별 정리 transaction도 아직 검증되지 않았다.** 계정/전체 기록/맞춤 추천 초기화로 우회하지 않으며 새 RPC·migration을 임의 배포하지 않는다. 직접 SQL 표본 INSERT0, 임의 동의 생성0, 약관/Edge/scheduler/사진/UI/추천 정책 변경0.

### 3) 실행 결과·QA 판정

catalog 조회 exit0, 최종 시각 `2026-09-07T13:21:12.310Z`. 첫 진단기의 DELETE 판별 정규식이 뒤 SELECT까지 포함하던 오탐을 DELETE 문장 단위로 좁혔다. 수정 후 위5개 함수 중 completion_event_id를 DELETE 대상으로 사용하는 함수0을 확인했다. 이것은 **정리 경로 사전 점검**이며 인증/RLS 실행 또는 학습 통합 PASS가 아니다. 제품 코드/SQL 변경이 없어 기존 전체 회귀는 반복하지 않았다.

| 단계 | 이번 결과 |
| --- | --- |
| A 백업 / B 적용 | 기존 수락·PASS 유지, 재실행0 |
| 실기기 로그인 | 사용자 성공 확인 수락. 이 실행기의 동일 owner 정상 Auth 증명과는 구분 |
| C 실행 owner 확인 | 미실행. 기기의 현재 세션을 실행기가 확보·검증하지 않았다. 과거 일반 계정1건 집계로 owner를 추정하지 않음 |
| 기존 기록·동의·표본 기준선 | 미조회. 정리 게이트에서 먼저 중단했으며 동의 ON/OFF를 추정하지 않음 |
| 완료 응답·서버 방문 ack | 미실행, 생성0 |
| 표본 저장 | 미실행, 생성0 |
| 동일 owner 공개 조회 | 미실행 |
| 다음 추천 실제 체류값·계산 비교 | 미실행 |
| 생성 ID 정리·집계 검증 | 미실행. 생성 ID가 없어 삭제할 C 데이터0; 정리 기능 PASS로 표기하지 않음 |

### 4) 다음 담당·최소 해소 범위·재개 순서

**DB/통합 반환:** 제품 전체 삭제 정책을 바꾸거나 새 인프라를 만들지 않고, 일회성 C 하네스의 보호된 manifest와 제한 정리 transaction을 먼저 로컬 합성 DB에서 검증하는 방안을 권장한다. 대상은 정상 Auth로 증명된 owner + 이번 run/completion/event ID 최대3건이며, 사전 부재 확인·정리 전 재대조·예상 행 수 불일치 시 rollback을 포함해야 한다. 기존 표본/동의 epoch·revision 및 비대상 기록 보존, 테스트로 변경된 집계만 정상화, 동시 정상 표본 쓰기 보존, 새 tombstone/mutation 등 부수효과의 보관/정리 범위까지 명시해야 한다. 재시작/실패 뒤 재등록 방지를 위해 로컬 outbox/evidence/ack 정리도 함께 검증한다. 권한 확대나 운영 migration 없이 해결 가능한지부터 판정하며 **이 제안은 구현·운영 실행 완료가 아니다.**

그 뒤 정상 앱 세션의 `getSession` + 서버 `getUser`로 사용자 지정 계정과 일치함을 증명할 안전한 실행 경로를 연결한다. 실기기 세션을 DB refresh token 조회나 관리자 JWT로 대체하지 않는다. 계정이 불명확하면 사용자 확인을 받고, 비밀은 채팅/로그로 받지 않는다. 기존 기준선은 쓰기 부수효과 없는 조회로 확보한다. 동의가 OFF이면 사용자가 앱에서 직접 ON하도록 요청하고, 만료 기존 표본이 있다면 공개 read의 purge 영향을 먼저 반환한다.

안전 경로 확정 후 기존 승인 범위에서 고정 runtime 완료3건/표본 최대3건 → 서버 ack/accepted → owner 조회 → 기존/테스트 표본을 구분한 실제 체류값 및 계산 결과 → exact 정리/보존 비교를 수행한다. 실제3회 방문·이미 성공한 실기기 로그인 반복 요구는 하지 않는다. QA는 **C 미완료·쓰기 전 안전 중단**으로 인수하며 자동 fixture나 catalog 점검을 실제 서버 학습 성공으로 대체하지 않는다.

## C 실행 준비 결과 — 2026-09-07 / 로컬 exact 정리·정상 인증 연결 계약

### 1) 변경 파일·준비 범위

- `scripts/lib/cValidationCleanup.mjs`: 연결/비밀번호/CLI가 없는 일회성 관리자 절차. 사전 부재 manifest → 실제 생성 결과 seal → 재대조/정리 transaction을 동일 코드로 실행한다. 배포 RPC가 아니다.
- `scripts/test_c_validation_cleanup.mjs`: 기존015/016까지 설치한 격리 합성 DB에서 기존 기록/별도 owner·동시 쓰기·rollback·집계를 검증한다.
- `scripts/test_release_identity_local_db.sh`: 기존 disposable socket-only cluster 실행기에 `c-cleanup` 모드만 추가. 운영 URL 입력/환경 파일 로딩/원격 fallback 없음. 새 클러스터의 스키마 준비를 B 재적용이나 B 보완 재검증으로 취급하지 않는다.
- `src/services/cValidationPreparation.ts`: **opt-in C 하네스 전용** 정상 Auth 확인·token-pinned client 전달·격리 저장소·영구 폐쇄 marker. 제품 UI/production singleton에는 아직 연결하지 않았다.
- `test/c-validation-preparation.test.ts`: 정상/불일치 Auth, 무세션·익명·인증 오류, A→B→A, 재시작/지연/저장 실패, 실제 공개 runtime의 evidence→완료→sync 후 재등록 차단 fixture.
- 본 문서: 이전 ‘정리 경로 없음’ 관찰 → 기존 사용자 API는 그대로 유지 → 하네스 전용 제한 관리자 정리와 격리 저장소 준비 → 기존 데이터/동의 보존을 위한 선택 → **로컬 준비 검증 완료·앱 연결 및 운영 실행 전**으로 기록한다.

### 2) 유지 계약과 정확한 관리자 정리 범위

운영 C 생성/삭제/동의 변경/원격 조회0, B 재작업0, migration·RPC 배포0, 기존 Auth/CAPTCHA/UI/native/추천 기준 변경0. 기존 공유 변경 되돌림 및 stage/commit/push0. 로컬 합성 계정은 disposable DB에서만 공식 완료/표본 RPC로 생성했으며 보호 trigger를 해제하지 않았다. 암호/토큰은 수집·기록하지 않았다.

공개 관리자 모듈 입력/출력(호출자는 승인된 DB 연결을 별도로 주입):

| export | 입력 | 반환·실패 |
| --- | --- | --- |
| `captureCManifest(db, {owner, ids})` | `ids: {runId,completionId,eventId}[]`, 1~3개, 각 ID 중복 없음. 정상 앱 Auth로 확인된 owner만 사용 | 기존 owner 기록/장소/표본/집계/동의/tombstone의 메모리 baseline. 예정 ID 기존 존재·동의 없음/OFF는 거절 |
| `sealCManifest(db, baselineManifest)` | 종료·원격 요청 정지 후 실제 생성 상태 | exact 행 내용/건수 `rows` 추가. 완료 0~3·표본 0~3의 부분 실행도 기록. 1장소 완료 및 동일 세부분류 표본만 허용. tuple/동의 불일치 거절 |
| `cleanupCManifest(db, sealedManifest)` | 위 보호된 manifest; 사용자가 승인한 관리자 정리용 연결 | `{status:'cleaned',completions,samples,tombstones}`. 대상/행 내용/예상 수/동의/기존 행 변경이면 rollback 후 오류. 성공 여부 불명확/재실행은 자동 허용하지 않음 |

manifest는 사용자 승인/인증 자체를 증명하는 토큰이 아니다. 사전 baseline은 호출자가 **read-only repeatable-read transaction**으로 감싸 일관 snapshot에서 확보한다. 민감한 owner/기존 행을 포함하므로 채팅·콘솔·fixture·repo에 저장하지 않는다. 실행 중 메모리 보관을 기본으로 하며, 재시작용 보관이 필요하면 사용자 관리 repo 밖 보호 파일(600·상위700, 별도 보호/보관 범위 수락)에만 저장한다. DB 예외도 raw `detail`/행 값을 출력하지 않고 code·단계만 보고한다. 모듈 비교 예외에는 실제/기대 행을 붙이지 않는다.

관리자 transaction은 다음 **정확한 범위**다.

1. `lock_timeout=3s`, 각 statement `statement_timeout=10s`. **먼저** `account_completion_tombstones`에 짧은 **ACCESS EXCLUSIVE**, 다음5테이블 `account_course_completions`, `account_course_completion_places`, `dwell_completion_samples`, `dwell_personalization_profiles`, `dwell_personalization_consents`에 **SHARE ROW EXCLUSIVE** 잠금. grant/RLS/trigger 변경 없음. 기존 완료 writer의 tombstone 확인이 row lock 없이 수행되므로 tombstone의 SELECT까지 잠시 막아야, 정리 중 ‘없음’을 읽은 늦은 요청이 commit 뒤 재삽입하는 경쟁을 차단할 수 있다. 관련 정상 쓰기와 **tombstone 조회**는 잠시 대기할 수 있고 나머지5테이블 SELECT는 차단하지 않는다. timeout/deadlock이면 rollback·중단하며 자동 반복하지 않는다. 10초는 transaction 전체 제한이 아니라 **각 statement 제한**이다. 잠금 획득 뒤 사용자/네트워크 대기 callback을 넣지 않는다.
2. 승인 owner와 exact UUID까지 seal 내용이 일치한 `dwell_completion_samples` **0~3행**, `account_course_completions` **0~3행**, 해당 부모의 `account_course_completion_places` **0~3행**만 삭제. 전체 owner DELETE/만료 표본 purge/계정 삭제는 하지 않는다. 기존 행은 그대로 있어야 하며 추가 정상 행은 허용·보존한다.
3. **예약한 run 최대3개에 tombstone 1개씩 새로 남긴다.** 삭제한 완료가 지연 retry로 재생성되는 것을 서버에서도 차단하기 위한 의도적 잔여 데이터다. tombstone까지 완전히 지우는 정리가 아니므로 추가 승인 묶음에 명시한다. `account_record_mutations` 쓰기0, generation/기존 동의/프로필 계정 정보 수정0. C의 정상 RPC가 최초 생성한 account_record_state는 generation1 bookkeeping으로 남을 수 있으며 기존 상태를 삭제/과거값 복원하지 않는다.
4. 테스트 표본의 **동일 owner/category/subCategory 집계만** 잔존 현재 유효 표본으로 다시 계산한다. 서버 기존016과 같은180일·최근5개·중앙값·최소3개 조건을 사용하고, 3개 미만이면 그 집계만 제거한다. 기존 `refresh_dwell_profiles_for_user`의 전체 owner DELETE 방식은 호출하지 않는다.
5. 기존 submit 함수는 테스트와 무관한 owner 집계의 timestamp도 재생성한다. 비대상 그룹은 **baseline 대비 표본 내용과 현재 의미 집계가 모두 동일한 경우에만** 기존 updated_at/profile_version으로 복구한다. 정상 새 표본/만료 경계로 의미값이 달라졌다면 그대로 둔다. 다른 owner/동시 정상 쓰기의 표본·기록은 덮어쓰지 않는다. 잠금 해제 뒤 정상 submit이 집계를 다시 refresh하는 것은 정상 변경으로 구분한다.

### 3) 정상 계정 연결·UIUX 인계

**export:** `createCValidationPreparation({auth,currentAppOwner,storage,executionId,createOwnerClient})`.

- `auth`: 현재 로그인 앱의 기존 `supabase.auth`. `currentAppOwner(): string|null`은 AuthContext에서 확인한 현재 일반 계정 ID. 사용자가 앱에서 자신의 계정임을 확인한 뒤 그 ID를 `expectedOwner`로 전달한다. DB의 계정 수·최근 로그인으로 추정하지 않는다.
- `executionId`: 보안 난수로 정한 8~80자 영문/숫자/hyphen, 한 실행에서 재사용하고 새 실행마다 새 값. 관리 manifest의 run/completion/event ID와 함께 격리 실행을 식별한다.
- `createOwnerClient(accessToken)`: **정상 getSession→서버 getUser 검증으로 얻은 현재 토큰만** 메모리에서 받는 factory. 앱과 같은 Supabase URL/public key로 `createClient`를 만들되 `persistSession:false`, `autoRefreshToken:false`, `detectSessionInUrl:false`, 고정 `Authorization: Bearer <검증 토큰>` header를 사용한다. 토큰을 파일/URL/log에 내보내지 않고 global 앱 client의 변경 가능한 세션에 의존하지 않는다. 관리자/service key, DB refresh_tokens 조회, 사용자 비밀번호 재수집0. 검증된 일반 사용자 JWT로 기존 RLS/RPC를 실행하는 경로다.

| 준비 객체 공개 함수 | 반환/호출 계약 |
| --- | --- |
| `prepare({expectedOwner})` | `ready`+owner 또는 `owner_changed/account_required/session_expired/unavailable/retired/cleanup_pending`. 정상 서버 getUser와 앱 owner를 전후 비교하며 토큰을 반환하지 않음. Auth 만료 검사는 실제 clock 사용, 추천 fixture clock과 분리 |
| `withVerifiedOwner({expectedOwner}, operation)` | operation에 위 **owner-pinned client**만 전달. `completed`+value 또는 같은 실패 상태. operation은 기존 remote adapter 호출1건을 감싸고 반환값을 안전한 상태/필요 데이터로 한정. 중첩 호출/동시 호출은 하지 않음; 이미 진행 중이면 `cleanup_pending`. 앱 owner 변경 후 결과는 `owner_changed`이며 이미 보낸 RPC가 취소됐다고 주장하지 않음 |
| `scopedStorage` | 기존 CourseCompletionStorage 인터페이스. 실제 키들을 `@timefit/c-validation-v1/<executionId>` 하나의 JSON envelope 안에 격리. owner 완료·run·outbox·evidence·ack·legacy repository 모두 **같은 scopedStorage** 사용. 실제 사용자 AsyncStorage 키나 기존 singleton에 fixture를 넣지 않음 |
| `notifyAuthChanged()` | logout/계정 전환에서 동기 호출. A→B→A도 진행 중 작업의 auth revision 불일치로 폐기. UIUX는 같은 이벤트를 기존 runtime auth guard에도 전달하고 C 자동 진행을 중지 |
| `retire()` | durable retired marker 기록 후 격리 values만 제거. 원격 operation 미완료이면 `cleanup_pending`, 저장 실패/손상이면 `unavailable`. **`retired`일 때만** 관리자 정리로 진행. marker는 남겨 cold 재사용을 막음 |

`withVerifiedOwner` 실행 중 crash이면 durable pending이 남아 재시작 때 `cleanup_pending`이다. 시간 경과만으로 pending을0으로 바꾸거나 새 namespace로 같은 ID를 재시도하지 않는다. in-flight 요청 결과와 manifest를 안전하게 대조할 때까지 운영 정리를 중단한다. 지연 응답이 돌아와도 retired 저장소에 ack/evidence/outbox를 다시 쓰지 못한다. 비정상 종료 자동 복구 인프라는 이번 준비 범위가 아니다.

**UIUX 필요 연결(미구현·UI 파일 수정0):** 내부 개발 도구의 명시 C 버튼1개에서 현재 AuthContext owner를 확인하고 위 준비 객체를 생성한다. 같은 실행 객체/underlying storage port를 유지한다. Auth 이벤트 listener는 notifyAuthChanged/기존 runtime notify를 전달한다. DB 하네스는 `createReleaseIdentityPersonalizationRuntime`의 **기존 공개 구현**에 scopedStorage와 정상 owner resolver, owner-pinned client를 쓰는 기존 account/dwell RPC 매핑을 연결한다. 현재 `releaseIdentitySupabase.ts`의 singleton은 storage/clock/remote가 고정이고 adapter 상수는 비공개라 그대로 fixture에 재사용할 수 없다. C 실행 시 DB 담당이 이 매핑을 factory로 최소 추출하거나 일회성 harness adapter로 연결해야 하며, 임의 SQL 표본 INSERT로 대체하지 않는다. 이번에는 준비 함수/계약만 제공하고 실제 앱 연결 완료로 기록하지 않는다.

Native/Live Activity 파일 연결은 이번 준비에 필요하지 않다. C는 기존 수락된 앱 확인 경로와 로컬 publication fixture를 사용한다. 실제 확인/증거 판정은 공개 evidence/runtime 서비스로 수행하고 native 실기기 성공은 이전 결과를 유지한다. 이전에 만든 실제 Activity나 일반 사용자 진행 코스는 건드리지 않는다.

### 4) 로컬 검증·C 실행 순서·추가 승인

실패 테스트를 먼저 작성해 구현 파일 없음으로 RED를 확인한 뒤 구현했다. 아래 동작 검사는 실제 합성 DB/공개 서비스 호출로 검증했고, 단순 소스 문자열 검사로 PASS를 대신하지 않았다.

| 명령 | 결과 |
| --- | --- |
| `scripts/test_release_identity_local_db.sh c-cleanup` | **12개 검사 PASS**, 원격 연결0. 최대3/중복·기존 ID 거절, wrong owner/예상 sample 수 거절, 동의 revision 변경 거절, DELETE 뒤 오류 rollback, 정상 동시 writer 대기→commit, 비대상 owner/기존 표본 보존·정확 median30/count4, 비대상 집계 원본 timestamp 보존, tombstone 재등록 차단, 중복 cleanup 거절, 완료1/표본0 정리, 잠금3초 timeout rollback |
| `npx tsx --test test/c-validation-preparation.test.ts` | **8 PASS**. 정상 서버 Auth/안전 상태, 무세션·익명·오류, A→B→A, durable retire·cold write 거절, in-flight/재시작 보류, 손상/저장 실패, **실제 공개 runtime의 prepare/publish/앱 confirmation→완료→visit/sample→retire→cold retry/evidence 재생 금지**. DB/route는 여기서 fixture이며 실제 C 증거가 아님 |
| `npm run test:typecheck` | PASS |
| `npm run test:ui` | **574 PASS / 1 SKIP / 0 FAIL** |
| `npm test` | **274 PASS / 0 FAIL** |

로컬 harness가 만든 socket-only 임시 cluster/합성 사용자·기록은 기존 trap으로 종료·제거했다. 운영/기존 사용자 데이터 삭제0이며 합성 데이터는 harness로 재생성 가능하다.

다음 C 순서:

1. 아래 추가 관리자 범위 수락 및 UIUX 내부 연결 확인. 기존 계정 사용/최대3건 승인은 반복 요청하지 않는다. `prepare` ready 후 같은 owner 정상 서버 조회, 실제 개인화 동의 ON 확인. OFF이면 사용자가 앱에서 직접 ON. 기존 만료 표본이 있으면 public read의180일 purge 때문에 보존 경계가 충돌하므로 **쓰기 전에 반환**.
2. 정상 기존 기록/표본/동의 기준선과 예정 ID 부재를 읽기 전용 일관 snapshot으로 확보. 실제 C ID는 최대3개씩 고정하고 보호 manifest에 연결. active 사용자 코스와 격리한다.
3. fixture clock/route + 실제 공개 evidence/runtime + 정상 JWT의 기존 Supabase remote adapter로 완료3건·표본 최대3건. 필수 완료 응답과 후속 visit ack/sample accepted를 구분한다. SDK response loss는 결과 모른 채 새 ID로 다시 생성하지 않는다.
4. 동일 owner public sample 조회 → 기존/테스트 표본 분리 → 동일 추천 입력의 baseline 대비 실제 선택 체류값/시간 계산 결과를 기록. 기존 표본이 이미 개인화를 적용했다면 ‘3건 뒤 첫 적용’으로 오기하지 않는다. 표본을 지우거나 추천 기준을 바꿔 차이를 만들지 않는다.
5. C 자동 진행 중지 → 모든 remote operation 종료 → scoped `retire=retired` 확인. `cleanup_pending/unavailable`이면 관리자 삭제 금지. 이후 seal/정확 행 수 대조 → 승인 관리자 transaction1회 → exact 삭제와 tombstone/집계/기존 행·동의 보존 확인. 실패/통신단절은 읽기 전용 부분 상태 확인만 하고 반복 정리/자동 복원하지 않는다.
6. 저장/조회/추천 반영/정리 각각 QA에 결과를 인계한다. 이번 준비는 네 단계 모두 **미실행·미검증**, 현재 실기기 계정의 harness Auth 연결도 **미실행**이다.

**필요한 추가 승인 묶음:** 기존 최대3건 검증 승인에 더해, 위 관리자 exact DELETE 범위·6테이블의 짧은 쓰기 대기 영향·해당 run tombstone 최대3개 및 최초 generation bookkeeping 잔존·영향 집계 정규화·필요 시 repo 밖 보호 manifest 보관을 운영에 사용한다는 명시 수락이 필요하다. 새 RPC/migration 배포/전체 초기화는 필요 없고 승인 대상에 넣지 않는다. **이번에는 승인 요청 후 즉시 실행하는 단계가 아니라 준비 인계만 수행했다.**

다음 담당: DB는 승인 뒤 기존 adapter의 최소 factory 연결과 C runner를 구성하고, UIUX는 owner/내부 버튼/auth listener 계약만 연결한다. 예상 잔여 능동 작업 **1~2시간**(작은 adapter 추출/내부 연결·고정 시나리오·실행/정리; 승인·기기 대기 제외), 보장 아님. pending crash나 실제 SDK/RLS 오류 등으로 범위가 커지면 동일 문서에 근거와 최소 대안만 반환한다. 신규 로그인 화면/토큰 전달 서버/계정 복제·대형 인프라를 만들지 않는다.

## C runner 완료 인수인계 — 2026-09-07 / 운영 실행 전

### 1) 변경 파일·목적·이력

기존 ‘adapter 추출·runner 구성 필요’ → 공통 완료/표본 port factory 추출과 opt-in runner 구현 → **현재 로컬 연결 검증 완료, UIUX 연결 대기**로 바뀌었다. 기존 정리 알고리즘/잠금/집계 정책은 재구현하지 않았다.

- `src/services/releaseIdentitySupabasePorts.ts`: `createAccountCompletionWritePort(client)` (`readGeneration/write`), `createDwellSamplePort(client)` (`submit/readSamples`)를 추출했다.
- `src/services/releaseIdentitySupabase.ts`: 기존 production singleton이 위 factory를 사용한다. RPC 이름/인자·반환 매핑·repository 정책은 동일하다. 내부 예외는 안전한 고정 오류명으로 바꾸되 repository의 공개 unavailable 처리는 유지했다.
- `src/services/cValidationRunner.ts`: `createCValidationRunner`와 `CValidationPlan/CBaselineReceipt/CValidationId` 타입. 같은 factory, 정상 owner resolver, 공개 evidence/완료/runtime, 고정 route port와 실제 엔진을 조합한다.
- `src/services/cValidationSupabase.ts`: UIUX가 직접 import할 `createAppCValidationRunner`. 기존 앱 supabase.auth/공개 URL·key/AsyncStorage/보안 UUID를 연결한다. 생성만으로 Auth/REST/C 쓰기를 실행하지 않는다.
- `src/services/cValidationPreparation.ts`: 기존 준비 모듈에 `claimExecution()`만 보완했다. 동일 underlying storage port에서 두 runner가 같은 execution을 동시에 실행하려던 실패 fixture(둘 다 stopped)를 먼저 확인하고, 원자적1회 claim으로 **한 번만 실행**되도록 수정했다. 새 저장소/서버 RPC 없음.
- `scripts/lib/cValidationCleanup.mjs`: `createCBaselineReceipt(manifest)`만 추가했다. 기존 capture 결과에서 owner/예정 ID/executionId만 반환하며 기존 행 baseline/동의/비밀은 제외한다. cleanup SQL 변경0.
- `test/c-validation-runner.test.ts`: 실제 설치된 Supabase SDK의 HTTP transport만 fixture로 교체하여 요청·payload·순서·실패와 실제 엔진 계산을 검증한다.
- `scripts/test_c_validation_cleanup.mjs`: 기존 로컬13번째 검사로 receipt 값/원문 제외를 확인했다. 본 문서에 승인·정확한 UIUX 계약·잔여 게이트를 기록했다.

### 2) 유지 계약·승인 경계

이번 사용자의 **완료/표본 최대3건 + 해당 ID 관리자 정리 + 관련 집계 + tombstone/최소 관리 기록 잔존 + 명시 잠금 영향 승인**을 수락했다. 과거 ‘추가 관리자 승인 필요’ 표기는 이력이다. 같은 질문을 반복하지 않는다. **UIUX 연결 완료가 운영 실행의 남은 선행 조건**이며, 이번에는 앱 사용자 Auth 호출·운영 표본/완료 생성·관리자 삭제를 전혀 실행하지 않았다.

B/migration/새 RPC/약관/Edge/scheduler/사진/UI/native/engine 정책 변경0. 전체 초기화/계정 삭제·동의 생성/변경0. 기존 사용자/공유 변경 보존, stage/commit/push0. 앱 runner에는 관리자 권한과 cleanup 모듈을 import하지 않는다. token은 정상 앱 getSession→서버 getUser로만 받아 비저장·비갱신 client의 Authorization에 메모리 전달한다. 관리자 JWT/DB 토큰 조회·비밀번호 입력·토큰 전달 서버를 만들지 않는다.

### 3) UIUX의 정확한 entry·입력·상태·중단

**실제 import:** `createAppCValidationRunner` from `src/services/cValidationSupabase.ts`.

1. 내부 실행 화면에서 보안 난수 `executionId`(8~80자 영문·숫자·hyphen)를 만들고 `{executionId,currentAppOwner:()=>최신일반계정ID또는null}`로 runner **1개**를 생성·유지한다. 현재 계정임을 사용자가 앱에서 확인한 ID를 `expectedOwner`로 사용한다. 로그·채팅에 계정/plan 전체를 남기지 않는다. production factory의 underlying storage port는 고정 공유 객체이므로 동일 execution 동시 claim이 직렬화된다.
2. `await runner.prepare({expectedOwner})`:
   - 성공 `{status:'awaiting_baseline',plan,existingSampleCount}`. `plan={executionId,owner,ids:[{runId,completionId,eventId}×3],clockMs}`.
   - ID는 `c-<executionId>-1/2/3`, completion은 `-completion`, event는 `-arrival` suffix다. 임의 추가 ID/다른 계정/다른 분류를 받지 않는다.
   - 실패: `owner_changed/account_required/session_expired/unavailable/retired/cleanup_pending/already_started/stopped`, 그리고 `consent_required/consent_changed/expired_existing_samples/baseline_too_large/id_collision`. `consent_required`이면 사용자가 앱에서 동의를 직접 켠 뒤 준비만 다시 확인한다. 다른 상태를 ‘비로그인 성공’으로 바꾸지 않는다.
   - 서버 준비는 SELECT만 한다. 동의 조회에 기본 행을 만드는 get-consent RPC를 쓰지 않는다. 기존 표본996개 초과, 180일 만료까지10분 미만인 기존 표본, 예정 ID 충돌은 C 쓰기 전 중단한다. 전체 read를 위해 pagination/만료 정책을 임의 확대하지 않는다.
3. DB 담당이 `plan`을 보호된 로컬 범위에서 받아 기존 승인 연결의 **read-only repeatable-read transaction** 안에서 `captureCManifest(db,plan)`을 실행/commit한다. 반환 baseline을 메모리에서 보존하고 `createCBaselineReceipt(manifest)`를 만든다. receipt는 정확히 `{executionId,owner,ids,baselineCaptured:true}`이며 기존 행/토큰은 없다. UIUX 내부 operator 확인 입력으로 같은 receipt를 전달한다. **UI가 prepare 성공만 보고 자동 receipt를 만들면 안 된다.** receipt는 서명된 권한 증명이 아니라 작업자 준비 확인이며 실제 Auth/RLS는 별도로 매 요청 검증한다. 새 업로드 endpoint나 관리자 secret을 앱에 넣지 않는다. 보호 자료 전달 방법이 기기 연결상 불가하면 쓰기 전에 반환한다.
4. `await runner.run({baselineReceipt})` 한 번만 호출한다. 서로 다른 receipt는 `{status:'baseline_required'}`, 중복/동시/cold 시작은 `already_started` 또는 폐쇄 상태로 거절한다. 실행 시작을 격리 저장소에 원자적으로 기록하고, 실패를 새 ID로 자동 재시도하지 않는다. 준비 후5분을 넘기거나 실행 중 fixed clock이5분 이상 뒤처지면 `clock_stale`로 중단한다. 관리자 준비가 늦어진 경우 **쓰기 전** prepare를 다시 수행해 clock/baseline을 맞춘다.
5. 실행 흐름은 **준비된 real owner/동의 재대조 → 기존 public sample read/추천 baseline → 3개 run 각각 begin → prepare/publish local evidence → app_action arrival confirmation → 명시 local complete → 명시 retryCourseRunSync 1회 → sample accepted → owner read → 실제 엔진 비교**다. 장소는 기존 fixture의 `poi_1158/히떼로스터리/카페/커피전문점`, 고정 체류40분, 완료시각은 fixed clock의3·2·1분 전이다. 경로는 fixture 5분 walk이며 provider 호출0. 실제3회 방문 증거가 아니라 승인된 synthetic runtime 검증으로 표기한다.
6. `getState()` 반환은 `{stage:'idle'|'awaiting_baseline'|'running'|'verified'|'stopped',completed,submitted}`. UI는 필요할 때 조회해 단계/건수를 표시한다. local 완료 응답 뒤 즉시 completed가 증가하고 원격 대기와 분리된다. token/session/user 객체나 상세 DB 예외는 없다.
7. `run` 성공은 `{status:'verified',report:{before,after,completed,submitted,existingSampleCount,observedSampleCount,changed,cleanup:'retired'}}`. before/after에는 **실제 engine `stayMin`, `personalization`(state/recommendedStayMin/validSampleCount/windowSampleCount), 전체 고정 추천 `course` 계산 결과**가 있다. 일반 표본과 이번 exact ID를 분리·보존 대조하고, public RPC 표본값 multiset과 owner 직접 조회도 대조한다. 기존에 개인화가 적용됐으면 changed=false도 정상 관찰이며 표본을 지워 차이를 만들지 않는다.
8. 중간 실패는 `{status:'stopped',reason,completed,submitted,cleanup}`. reason은 위 안전 상태 또는 `baseline_changed/runtime_failed/sync_failed/sample_mismatch/interrupted/clock_stale/unavailable`. 정리 준비 반환은 `retired/cleanup_pending/unavailable` 등이며 `stopped`를 쓰기0으로 해석하지 않는다. 실제 row 수는 기존 seal로 판정한다.
9. logout/계정 전환 listener에서 `notifyAuthChanged()`를 동기 호출하고 `void runner.stop()`을 이어 호출한다. unmount/사용자 중단에도 `stop()`을 호출한다. `stop`은 새 작업을 막고 기존 격리 namespace만 retire한다. 응답 대기 중이면 `cleanup_pending`: **운영 관리자 삭제 금지**. 늦은 완료 응답 뒤에도 다음 표본/코스 작업으로 진행하지 않는다. in-flight가 settle한 뒤 stop 재확인만 가능하며 run 재시도는 금지한다. 네트워크 무응답/crash로 pending이 남으면 시간 경과로 성공/미실행을 추정하지 않는다.
10. `verified`는 **학습 실행/조회/계산 관찰 결과**이지 관리자 삭제 완료가 아니다. `cleanup:'retired'`를 확인한 DB 담당이 기존 `sealCManifest` → `cleanupCManifest`를1회 실행하고 보존/집계/이력 검증을 별도 기록한다. 원격 실패/응답 소실 시 자동 반복/전체 복원 금지. 기존 계정의 실제 활동/저장소는 건드리지 않는다.

UIUX는 위 entry·작은 내부 실행/중단 연결만 담당한다. 엔진이나 실제 사용자 singleton에 fixture를 섞지 않는다. 이번 DB 작업에서는 UI 파일을 변경하지 않았으므로 실제 UIUX 연결 완료는 별도로 인계받아야 한다.

### 4) 실행 테스트·남은 조건·QA 인계

| 검증 | 결과 |
| --- | --- |
| `npx tsx --test test/c-validation-runner.test.ts test/c-validation-preparation.test.ts` | **16 PASS**(runner8 + 기존 preparation8). SDK transport→공통 production port→공개 evidence/runtime→engine 전경로 fixture. 완료3/sample3, 실제 선택 체류30→40분, 기존 표본 보존/변화 강요0, 동의/ID/만료 거절, sync 오류1회 중단, 무응답 중 local 완료 가시성 및 stop 후 표본0, 두 runner 중1회 실행 |
| `scripts/test_release_identity_local_db.sh c-cleanup` | 기존 정리12개 + 원문 없는 operator receipt1개 = **13 PASS**, disposable 합성 DB만 사용 |
| `npm run test:typecheck` | PASS |
| `npm run test:ui` | **574 PASS / 1 SKIP / 0 FAIL** |
| `npm test` | **274 PASS / 0 FAIL** |

runner 실패 테스트를 구현 전에 추가했다. 최초 SDK 실행에서는 Node20의 WebSocket constructor 부재를 확인해 **테스트에만 생성 시 실패하는 비연결 constructor**를 주입했다. Supabase HTTP transport는 전부 fixture이고 realtime/provider/운영 API 요청0이다. 동시 runner 반례는 실제로 둘 다 stopped가 되는 RED를 확인한 뒤 기존 저장소 잠금으로 claim을 보완했다. 제품 정책을 바꿔 테스트를 통과시키지 않았다.

현재 결과 구분: **runner 구성/로컬 SDK·runtime·engine 검증 PASS / 관리자 정리 범위 승인 수락 / UIUX 연결 미확인 / 현재 계정 하네스 정상 Auth 미실행 / 실제 C 저장·조회·추천 반영·관리자 정리 미실행**. A/B는 완료 유지다. 로컬 합성 DB는 기존 trap으로 종료·삭제됐고 운영 데이터 삭제0이다.

다음 담당: UIUX는 위 factory/owner listener/prepare·receipt·run·stop 연결 완료를 인계한다. DB는 그 뒤 기존 승인 범위에서 정상 owner/실제 동의/baseline을 확인하고 동일 runner를1회 운영 실행한다. 추가 계정 사용/정리/잠금 승인을 반복 요청하지 않는다. raw baseline의 별도 영구 보관이 필요하거나 안전한 operator receipt 전달이 불가능하면 그 보호/연결 조건만 반환하고 새 인프라로 확대하지 않는다. QA는 운영 단계의 저장/조회/계산/정리를 각각 새 증거로 판정하며 위16개 fixture PASS로 대체하지 않는다.

## C 실제 실행 재개 — 기기·보호 전달 확인 대기

1. **변경 파일/목적:** 본 문서만 갱신. 최신 UIUX 인계 전체와 패널/controller의 버튼·전달·중단 경계를 읽었다. `.env.local`의 내부 flag가 true인 사실만 출력했고 나머지 환경값/비밀은 출력하지 않았다. 실행 중인 기기에 이 JS 설정이 반영됐다는 증거로 간주하지 않는다. 빌드/환경/배포 변경0.
2. **유지 계약:** 사용자 실행·제한 정리 승인은 유효하다. 계정/동의는 정상 앱 prepare로 검증하며 운영 계정 목록이나 DB token으로 추정하지 않는다. plan/receipt는 채팅·로그로 받지 않는다. 보호 전달 경로 확인 전 run0, B 재작업/추가 배포/전체 초기화0.
3. **현재 실제 결과:** 기기 패널 렌더·현재 owner/동의 확인 미관찰, 보호 plan 미수신, DB baseline/receipt 미생성, 실제 완료/표본 저장·owner 조회·추천 계산·정리 모두 **미실행**. UIUX 집중23개/기존1·2·3건 경계·계정 격리 자동 증거는 수락하되 운영 증거와 구분한다. 테스트 재실행/원격 호출0.
4. **사용자 다음 조작:** 내정보 하단 `내부 개발 · C 검증` 표시와 현재 계정을 확인하고 `현재 계정 확인`까지만 진행한다(기대 status `confirmed`). 기기에서 복사한 텍스트를 Mac에 로컬 붙여넣기할 수 있는지 확인한다. 전달 경로가 준비되면 그때 `서버 인증·동의·기준선 준비 조회` → `awaiting_baseline`을 안내하고 선택 가능한 plan을 Mac 로컬 입력으로 받는다. 아직 준비/실행을 먼저 누르게 하여5분 창을 소모하지 않는다. `C runner 1회 실행`은 DB baseline 확보와 동일 receipt 반환 뒤에만 안내한다. 패널이 없거나 로컬 전달 불가이면 그 조건만 반환하며 새 배포/전달 서버를 임의 구축하지 않는다.

## C 운영 시도 경과 — 2026-09-07 23:53 KST / 실행 보고 뒤 읽기 전용 확인

1. **변경 파일/목적:** 본 문서만 갱신. 사용자 제공 로컬 plan 원본 캡처를 확인하고, repo 밖600 일회성 실행기 `/private/tmp/timefit-c-live-operator.cjs`에서 기존 capture/receipt/seal 모듈을 재사용했다. 원문 계정/ID·receipt·baseline은 본 문서에 옮기지 않는다. baseline은 살아 있는 로컬 프로세스 메모리에만 보관한다.
2. **기준선·승인 경계:** 원본 plan의 fixed clock은23:42이며 앱 실행 유효시각은23:47까지였다. 최초23:45:02 read-only capture는 비대화형 입력 종료로 프로세스가 종료되어 메모리 보존에 실패했다. **C 실행을 안내하기 전에** 지속 입력 세션으로 다시23:45:41 KST 기준선을 확보하고 receipt를 Mac clipboard에 전달했다. 일반 Auth 사용자 여부, 기존 완료0·표본0·집계0, 개인화 동의ON과 예정 ID 부재 확인. 원격 write/관리자 DELETE0. 기준선 재확보를 추가 백업이나 B 재작업으로 취급하지 않는다.
3. **사용자 보고·실제 조회:** 이후 사용자가 ‘23:47 직전에 C runner를 눌렀다’, ‘앱을 새로고침했다’고 보고했다. receipt가 실제 입력·검증됐는지, UI가 runner.run까지 호출했는지, 버튼 이후 상태/응답/retired는 미확인이다.23:53:11 KST 기존 입력 세션에서 `inspect`만 수행하여 **이전 manifest exact 완료0·표본0**을 확인했다. seal의 동의 baseline 대조도 통과했다. 이0건은 해당 snapshot에서 관찰된 결과이며 클릭이 무효였거나 네트워크 요청이 없었다는 증거로 확대하지 않는다.
4. **QA/다음 조치:** 실제 저장은 현재0건 관찰·성공 미확인, owner 공개 조회/추천 체류·시간 계산 결과 미확인, retired/원격 요청 종료 미확인, 관리자 정리 미실행이다. 이전1·2·3건 경계·격리 자동 증거와 구분한다. 사용자에게 실행 직후 상태/현재 안전한 상태 표시를 확인한다. 새 runner·새 plan·반복 실행으로 우회하지 않으며, 이전 격리 namespace의 pending/retired가 불명확하면 해당 복구 상태를 먼저 확인해야 한다. 기존 manifest는 유지하고 `cleanup-retired-confirmed` 명령은 보내지 않았다. B/배포/전체 초기화·계정 삭제0.

## 새로고침 후 C 복구 인수인계 — readonly 서비스 구현·기기 연결 대기

### 1. 진단·변경 파일

사용자 후속 확인: receipt를 붙여넣고 실행 버튼을 눌렀지만 직후 상태는 기억하지 못하며 현재 앱을 새로고침한 상태다.23:57:54 KST 보존된 operator 세션의 `inspect`로 기존 manifest exact 완료0·표본0, 동의 baseline 대조 통과를 재확인했다. 원격 쓰기/삭제0. 같은 결과를 반복 polling하지 않는다.

현재 `cValidationControls`는 새로 mount할 때 runner/plan을 메모리에서 새로 시작하고, 새 준비는 새 executionId를 생성한다. **이전 실행의 durable state를 찾는 경로가 없다.** 또한 runner가 없는 새 화면의 stop은 UI 자체에서 retired를 반환하므로, 이를 이전 실행의 retired로 취급하면 안 된다. 이 공백이 사용자의 추가 버튼 조작으로 해결되지 않는 원인이다. 과거 결과를 기억하거나 또 새로고침하도록 요구하지 않는다.

변경: `src/services/cValidationPreparation.ts`에 `inspectExistingExecution`, `src/services/cValidationSupabase.ts`에 실제 앱 wrapper `inspectAppCValidationExecution`, `test/c-validation-recovery.test.ts`에 실패 선행4개 fixture, 본 문서. UI 파일/기존 runner 쓰기 경로·정리 SQL은 변경하지 않았다.

### 2. UIUX에 필요한 최소 연결 계약

실제 export: **`inspectAppCValidationExecution({executionId,expectedOwner,currentAppOwner})`**, import 경로 `src/services/cValidationSupabase.ts`.

- executionId는 **DB가 보존한 이전 plan의 값**을 사용한다. 새 UUID를 만들지 않으며 사용자에게 owner/receipt/전체 JSON을 다시 타이핑시키지 않는다. 로컬 operator의 기존 계획은 `/private/tmp/timefit-c-live-operator.cjs`에 있고 raw baseline은 해당 프로세스 메모리에 보존 중이다. 필요한 executionId만 보호된 로컬 범위에서 전달하며 소스/UI에 운영 ID를 hardcode하지 않는다.
- expectedOwner/currentAppOwner는 현재 AuthContext 일반 계정이다. 기존 정상 getSession→서버 getUser 및 전후 owner/auth revision 대조를 수행한다. 다른 owner의 저장값을 보여주지 않는다. 관리자 JWT/DB 토큰 조회/비밀번호 요청 없음.
- 읽는 대상은 정확한 `@timefit/c-validation-v1/<executionId>` envelope 한 개다. **prepare/create/claim/retire/remove/동의/RPC 쓰기를 호출하지 않는다.** 없는 namespace를 자동 생성하지 않는다.
- 반환 성공: `{status:'found',phase:'active'|'pending'|'retired',runClaimed:boolean,pendingRequests:number,storedKeyCount:number}`. token·owner 원문·저장 key·완료/evidence/outbox payload는 반환하지 않는다. pending>0이면 retired flag가 true여도 phase는 **pending**이다.
- 실패: `not_found/owner_changed/account_required/session_expired/corrupt/unavailable`. 오류를 empty/not_found로 바꾸거나 데이터를 수리하지 않는다. 결과는 조회 snapshot이며 진행 중 operation의 미래 종료를 보장하지 않는다.

**UIUX 최소 작업:** 기존 내부 패널과 독립적으로 실행 가능한 `이전 C 실행 상태 확인` read-only 동작을 연결하고 위 안전한 상태 요약만 표시한다. 조회 도중 버튼 연타를 막고 Auth 전환/unmount 뒤 늦은 결과를 버린다. recovery 조회를 위해 새 runner를 만들거나 기존 prepare 버튼을 호출하지 않는다. 제품 UI 소유 경계를 지켜 이번 DB 세션은 버튼을 직접 추가하지 않았다. 예상 연결/집중 fixture 작업은30~60분이며 새 서버·migration·큰 설계는 필요 없다.

결과별 DB 판단: pending→새 실행/삭제 금지·요청 결과 별도 대조, active→자동 재개/retire하지 않고 기존 runClaimed와 서버 결과 대조, retired(pending0)→원격 상태와 함께 승인 정리 가능 여부 판단, not_found/손상→실행 안 됨으로 추정하지 않고 반환. 읽기 경로 자체에 해제/재시도 버튼을 묶지 않는다. 새로고침 전 UI 결과와 같은 정보를 복원했다고 주장하지 않는다.

### 3. 유지 경계·테스트 결과

실제 기기 state는 아직 읽지 못했다. 이번 서버 재조회는 exact 두 표본 테이블 결과에 관한 read-only 확인이며 실제 C 성공/종료 증거가 아니다. 기존 개인정보·동의·표본·B 적용/승인 경계를 유지한다. 기기 초기화/새 C 실행/관리자 정리/추가 배포/새 RPC/migration·stage/commit/push0.

실패 선행 신규4개에서 함수 부재 RED 확인 → 구현 후 `npx tsx --test test/c-validation-recovery.test.ts test/c-validation-preparation.test.ts test/c-validation-runner.test.ts` **20 PASS**. missing 무생성, active/claimed/retired 비민감 요약, crash pending 우선, owner 불일치/손상/저장 실패 무수정 검증. typecheck PASS, UI **581 PASS/1 SKIP**, 기본 **274 PASS**. 제품 화면/실기기 성공으로 대체하지 않는다.

### 4. 사용자 안내·다음 담당

**현재 사용자 추가 조작 없음.** ‘기억나는 오류를 알려달라/다시 준비하라/새로고침하라’는 안내를 반복하지 않는다. DB 작업은 서버 재확인과 readonly recovery service까지 완료했으며 **남은 정확한 작업은 UIUX의 위 read-only 버튼 연결**이다. UIUX 세션에는 이 절을 실행 명령으로 전달하면 된다. 연결이 완료된 뒤에만 사용자에게 화면 이름·버튼 이름·기대 상태를 한 단계씩 안내하고, 원문 JSON이 아닌 안전한 상태 요약을 확인한다. C 저장·조회·추천 계산·정리는 여전히 미확인/미완료 상태로 QA에 인계한다.

## 이전 C 시도 복구·제한 정리 완료 — 2026-09-08 00:12 KST

### 1. 변경 파일과 실제 처리

본 문서에 실제 복구·정리 결과를 추가했다. 제품 코드/SQL 변경 없음. repo 밖 로컬 전달 도구 `/private/tmp/timefit-c-copy-recovery-id.cjs`는 기존 operator plan에서 executionId만 Mac clipboard로 전달했고, 사용자 기기의 UIUX readonly 패널로 기존 namespace를 조회했다. 사용자가 전달한 안전 요약은 `status:found, phase:retired, runClaimed:false, pendingRequests:0, storedKeyCount:0`이다. 정상 Auth 전후 owner 검증이 포함된 공개 조회 결과이며, 원문 계정/ID/토큰은 문서에 기록하지 않는다.

retire는 values를 비우므로 `runClaimed:false`는 미실행 증거가 아니다. 과거 오류 코드/완료 응답/추천 보고서를 복원한 것으로 해석하지 않는다. 기기 결과 수신 후 보존 중인 원래 operator 메모리 manifest로00:11:48 KST seal: exact 완료0·표본0, 기존 동의 일치.00:11:57 KST 기존 `cleanupCManifest`를1회 호출하여 `cleaned/completions:0/samples:0/tombstones:3`을 수신했다. 예상 대상·행·동의 대조, 제한 잠금/timeout, transaction 내 보존 대조를 통과하고 commit됐다. 재시도/자동 복원 없음.

### 2. 유지 계약·보존

기존 완료/장소/표본과 동의는 cleanup transaction의 전후 전체 행 대조로 보존했다. 대상 완료/표본이0건이므로 삭제된 기록0, 영향 세부분류0으로 집계 재계산 대상도0이다. 승인된 exact run 세 개의 재등록 방지 표시만 추가했다. 앱 격리 namespace는 retired·pending0·values0이고 다시 열지 않는다. 전체 초기화·계정 삭제·동의 변경·B 재작업·새 RPC/migration·약관 등록·추가 배포0. UIUX/engine/native 파일 수정·stage/commit/push0.

### 3. 검증과 결과 구분

추가 로컬 `/private/tmp/timefit-c-postcleanup-check.cjs`로00:12:40 KST 별도 read-only repeatable-read 사후 확인: exact 완료0·표본0·tombstone3, owner 집계0, 동의ON, `postcleanup_verified`. 민감 원문 출력 없이 건수/상태만 반환했다. 기존 baseline 집계0, 이번 영향 표본0과 일치한다. 제품 코드 변경이 없어 이전 자동 회귀를 반복하지 않았다. UIUX recovery 집중7 PASS/전체 UI584 PASS·1 SKIP/typecheck·기본274 PASS/iOS export 인계는 자동 증거로 유지한다.

| C 항목 | 현행 결과 |
| --- | --- |
| 기기 이전 실행 종료 | 사용자 실기기 readonly 결과 retired/pending0 확인 |
| 실제 완료·표본 저장 | exact0건 관찰, 성공 미확인 |
| 동일 owner 공개 조회·추천 체류/시간 계산 | 실행 보고 소실로 미검증; 관리자 SELECT를 공개 연결 성공으로 대체하지 않음 |
| exact 관리자 정리·보존 | PASS, 삭제0·재등록 방지3·동의 및 기존 행 보존 |
| 1·2·3건 경계·로그아웃/계정 격리 | 기존 자동 fixture 증거만 유지; 이번 실제 성공으로 표기하지 않음 |

### 4. 다음 담당·남은 위험

사용자의 이전 시도 처리 요청은 종료/제한 정리까지 완료했다. **C 전체 완료가 아니다.** 현재 UIUX는 실행 패널 대신 readonly recovery 패널을 연결했으므로 사용자가 새 준비/receipt/실행 버튼을 찾도록 안내하지 않는다. 다음 UIUX·DB 인계는 기존 runner와 보호된 plan→baseline→receipt 전달을 유지하면서 실행 패널을 명시적으로 다시 연결하고, 안전한 실패 reason/진행/보고서를 관찰할 수 있는 재실행 절차를 정하는 것이다. 기존 개인정보/최대3건/exact 정리 승인은 유지하지만 과거 실행 ID는 재사용 금지, 새 ID 자동 생성·자동 재시도 금지. 이번 턴에는 새 실행을 시작하지 않았다. QA는 위 저장/조회/계산 미검증과 정리 PASS를 구분하여 인수한다. 사용자에게 과거 오류 기억이나 실제3회 방문을 다시 요구하지 않는다.

## 두 번째 시도 종료·명시 재시도 준비 — 2026-09-08 00:31 KST

1. **변경 파일/처리:** 본 문서만 갱신. UIUX의 실행·조회 동시 표시, reason 유지, 집중11/전체UI585 PASS·1 SKIP/typecheck/기본274/iOS export 인계를 수락했다. repo 밖 기존 모듈 재사용 operator는 로컬 원본 캡처로 대조한 새 plan을 받아00:23:55 KST 기준선(기존 완료/표본/집계0·동의ON)을 메모리에 보존하고 receipt를 Mac clipboard로 전달했다. 채팅 OCR 손상값을 임의 보정해 사용하지 않았다. 사용자는 실행을 눌렀다고 보고했으나 캡처는 awaiting_baseline이었다.00:25:47 서버 exact 완료0·표본0. 기기 readonly 재조회는 active/runClaimed:false/pendingRequests0/storedKeyCount0, 이후 사용자 명시 중단 결과 retired였다. 키보드가 첫 터치를 소비했을 가능성은 사용자 가설이며 원인 확정은 아니다.
2. **유지 계약:**00:31:14 seal로 동일 manifest exact 완료0·표본0 및 동의 일치 재확인,00:31:23 승인된 cleanup을1회 실행해 cleaned/삭제 완료0·표본0/이번 run tombstone3을 수신했다. 기존 기준선의 첫 시도 tombstone과 일반 기록·동의는 기존 cleanup 전체 행 대조로 보존했다. 영향 표본0이므로 집계 재계산 대상0. 전체 초기화/계정 삭제/새 RPC·migration/B/배포/제품 UI·native·engine 수정/commit/push0. 과거 receipt·정리한 ID 재사용 금지.
3. **검증:**00:31:40 별도 read-only repeatable-read postcleanup 검증 PASS: 이번 exact 완료0·표본0·tombstone3, owner 집계0·동의ON. 정리 실패/자동 재시도 없음. 로컬 plan 검증 도구의 정상 입력 및 손상 JSON/이전 ID/다른 owner/잘못된 건수/금지 필드 거절6 PASS, 원격 fixture 쓰기 없음. 실제 C 저장·owner 공개 조회·추천 체류/시간 계산 성공은 아직 미검증이다.
4. **다음 담당/실행 순서:** 사용자가 이번 시도 정리 후 다시 하도록 명시 요청했다. UIUX 추가 변경 없이 새 화면 수명을 시작하고 현재 계정 확인부터 진행한다. 보호된 plan 수신 대기 프로세스만 열었고 새 plan/기준선/쓰기0. Mac→아이폰 복사는 되지만 역방향 복사는 안 되므로 원본 캡처의 Mac 로컬 전달을 사용한다. receipt 붙여넣기 뒤 키보드를 먼저 닫고 입력 마스킹 존재를 확인한 다음 실행1회, 바로 running 또는 최종 status/reason을 관찰한다. 눌림이 불확실하면 중복 클릭 대신 exact readonly 상태를 확인한다. 실기기1·2·3건 경계/계정 격리 성공을 기존 자동 fixture에서 추론하지 않는다.
