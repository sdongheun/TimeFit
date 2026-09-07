# DB-DWELL-01 — 사용자 확인 체류 표본·동의·개인화 프로필 저장

2026-09-07 최신 선행 조건: [DB-RELEASE-IDENTITY-01](release-identity-personalization.md) A 수락·B 계정/소유권 구현 후 같은 DB writer가 본 작업을 실행한다. 최신 보완 절의 guest import 학습0·동의 epoch·최소 payload·기존 V1 run identity 계약을 함께 적용한다. 엔진 2-AB는 기존 구현 재사용이며 별도 재작성하지 않는다.

> 상태: **2026-09-07 로컬 구현·disposable PostgreSQL 검증 완료, 원격 적용·UI/engine 연결 전**
> 상위 결정: [DEC-LIVE-DWELL-01](../integration-decision/live-activity-dwell-personalization.md)

## 목적과 사용자 관찰

일반 로그인 사용자가 명시적으로 확인한 도착·출발 사이의 대략적인 체류시간만 개인화 근거로 저장한다. Route Proxy anonymous Auth, 미확인/추정 시각, GPS 좌표 이력은 개인화 데이터가 아니다.

## 현재 원인과 근거

- 기존 `course_stops`에는 계획 체류와 방문 상태만 있고 사용자 확인 체류의 최소 영속 계약이 없다.
- 기존 DB 문서의 `arrived_at/departed_at/GPS arrived_candidate_at` 초안은 이번 결정과 섞여 있다. GPS 후보는 이번 배포 철회이며 그대로 구현하면 안 된다.
- 개인화 동의는 가입 동의나 알림/위치 시스템 권한과 별개이며 언제든 변경·초기화할 수 있어야 한다.

## 구현 명령

1. 먼저 실패하는 migration/RLS/repository fixture를 추가한다. 운영 DB나 실제 사용자를 테스트 입력으로 쓰지 않는다.
2. migration으로 다음 논리 계약을 구현하되, 기존 저장 코스 snapshot과 RLS를 깨지 않는 정규화된 스키마를 선택한다.
   - 사용자별 `dwell_personalization_enabled`와 변경 시각.
   - 완료된 체류 표본: 사용자, 저장 코스/stop 연결 또는 안전한 완료 identity, 정제된 `category`, non-null `sub_category`, `actual_dwell_min`, `arrival_source=user_confirmed`, 완료 시각, schema/version. account 완료 이력에는 nullable subCategory를 보존하되 값이 없는 완료는 체류 표본 insert 0건이며 파생 프로필에서 제외한다.
   - 파생 프로필: 사용자+category+subCategory 복합 유일 키, sample count, 최근 window 근거, 중앙값/적용 분, 갱신 시각. 동일한 subCategory 문자열이 다른 category에 있어도 합치지 않는다.
   - `arrivedAt/departedAt` exact 시각을 서버에 꼭 저장해야 하는지 최소 수집 관점에서 먼저 판정한다. `actual_dwell_min`만으로 목적을 달성하면 raw exact 시각을 영속하지 않는다.
3. 유효성 제약을 둔다: 양의 유한 분, 공백 문자열 subCategory 금지(null 또는 정제값만 허용), profile의 null subCategory 금지, 허용 source enum, 다른 사용자 course/stop 연결 금지, 중복 completion event idempotency.
4. 일반 로그인+동의가 아니면 repository write 0회다. anonymous Auth, 미동의, 도착/출발 누락, incomplete/cancelled/expired는 표본 insert 0회다.
5. 동의를 끄면 신규 insert와 프로필 read/apply를 즉시 중단한다. 과거 데이터 자동 삭제 여부는 `개인화 데이터 초기화`와 구분하되 UI가 명확히 설명할 수 있는 반환 상태를 제공한다.
6. `개인화 데이터 초기화`와 계정 삭제가 raw 표본·파생 프로필을 모두 지우도록 RLS/cascade/RPC를 검증한다.
7. 보유 기간은 임의로 영구 설정하지 않는다. 필요한 최소 기간과 자동 정리 방법을 문서에 제안하고 통합·결정 승인을 받기 전 production retention job을 활성화하지 않는다.
8. `docs/04_backend/데이터베이스설계.md`에는 이전 GPS 초안 → 문제 → 사용자 확인 최소 저장 → 이유 → 상태 이력을 기록한다.

## 수정 금지 경계

- `src/ui`, `src/engine`, `app.json`, iOS Widget Extension을 수정하지 않는다.
- 추천 최소 20분·권장 30분·최대 60/120분, 실제 경로, 운영시간, 1/2곳 조립 계약을 바꾸지 않는다.
- 좌표·연속 위치·polyline·Kakao URL·알림 토큰을 체류 표본에 넣지 않는다.
- 원격 ActivityKit push/APNs 저장 계약을 추가하지 않는다.

## 필수 반례 fixture

- 로그인+동의+완료 3건 성공과 사용자/category/subCategory 격리. 같은 `거리·골목`이라도 상위 category가 다르면 별도 프로필이어야 한다.
- 표본 1·2건, 3건, 최근 5건 이상 조회 순서.
- anonymous/missing session, 동의 off, 동의 중간 철회.
- arrival만 있음, departure만 있음, 음수/0/비정상 분, 중복 event.
- 다른 사용자 course/stop 주입 RLS 거절.
- 초기화와 계정 삭제 뒤 raw/profile 0건.
- 기존 course 저장·조회·삭제 회귀.

## 검증과 완료 인수인계

- 최소 `npm run test:typecheck`, 관련 repository/RLS 테스트, `npm test`, `git diff --check`를 실행한다.
- 원격 migration 적용은 별도 승인·배포 단계다. 로컬 계약 통과를 원격 적용 완료로 쓰지 않는다.
- 변경 파일과 목적 / 유지 계약 / 테스트 수와 결과 / 보유 기간 제안·원격 적용 필요를 이 문서에 기록한다.
- 사용자 요청 전 commit·push하지 않는다. 보드를 수정하지 않는다.

## 완료 인수인계 — 2026-09-07

### 1. 변경 파일과 목적

- `supabase/migrations/202609070016_dwell_personalization_storage.sql`: account-only 선택 동의, epoch/revision, 사용자 확인 최소 표본, 완료/수신 시각 분리, 180일 rolling 보유, 3개부터 최신 5개 중앙값 profile, off/reset/cascade와 service cleanup RPC를 구현했다.
- `src/services/dwellPersonalizationRepository.ts`, `dwellPersonalizationOutbox.ts`, `releaseIdentitySupabase.ts`: consent read/set/reset, run+stop owner/epoch snapshot 검증, 완료 millisecond→minute 전송, 32건/7일 최소 outbox, storage 손상/실패 fail-closed, Supabase adapter를 구현했다.
- `test/dwell-storage-contract.test.ts`, `test/release-identity-migration-contract.test.mjs`, `scripts/test_release_identity_local_db.sh`: 미래/180일/순서/idempotency, 민감 필드, outbox expiry, A/B/anonymous RLS, 표본 1·2·3·6/latest5, reset와 계정 cascade를 고정했다.
- `docs/04_backend/데이터베이스설계.md`: GPS/raw 시각 초안 → 과수집 문제 → user-confirmed 최소 저장 → 동의 epoch/보유 계약의 변경 이력과 현행/원격 미적용 상태를 기록했다.

### 2. 유지한 공개 계약·정책 경계

- UI, engine과 Live Activity native를 수정하지 않았다. 엔진 `DwellPersonalizationSampleV1`의 오래된→최신 입력, 최소 3개, 최신 5개 중앙값과 기본 추천 fallback을 변경하지 않았다.
- guest/anonymous/legacy/imported 완료, missing subCategory, owner/epoch/revision 불일치, 5분 초과 미래, 180일 초과 표본은 학습에 쓰지 않는다. 사용자 확인은 GPS 방문 증명으로 표현하지 않는다.
- raw 도착/출발 시각, 좌표·연속 위치·경로, 제목·주소·Kakao URL·알림 토큰을 저장하지 않는다. account 완료 이력과 dwell outbox는 별도 보유·삭제 경계다.
- off는 신규 수집/새 적용만 중단하고 유효 표본을 유지한다. reset은 raw/profile 삭제+disabled+revision 증가이며 이전 outbox는 epoch 불일치로 재생되지 않는다.

### 3. 실행한 테스트와 결과

- 실패 우선 repository 테스트 뒤 구현했으며, 실제 PostgreSQL 하네스가 consent revision SQL 모호성을 재현해 수정했다.
- 집중 TypeScript **32/32 PASS** 중 DB-DWELL 계약 5개 PASS, migration/기존 DB source **12/12 PASS**.
- `scripts/test_release_identity_local_db.sh`: migration 001~016 적용 및 A/B/anonymous, 표본 1·2에서 profile 0, 3에서 생성, 6에서 latest5 중앙값, 시간순, duplicate/conflict, reset/cascade **PASS**.
- `npm run test:typecheck`: **PASS**. `npm test`: **258/258 PASS**. `npm run test:ui`: **504 PASS / 1 기존 skip / fail 0**. tracked 및 신규 산출물 whitespace 진단 0. 원격 Supabase, cleanup scheduler와 실제 사용자 데이터는 0회 사용했다.

### 4. 다음 결정·위험·재현 조건

- 승인 보유값은 outbox 32건/7일과 서버 완료 시각 기준 180일이다. migration은 조회/명시 RPC에서 물리 정리할 수 있지만 production 정기 purge job은 활성화하지 않았다. API/운영 세션이 scheduler 주기·관찰 지표·실패 재시도를 확정해야 한다.
- UI는 검증된 DB 공개 entry를 연결하며 consent snapshot을 run 시작과 stop 확인 때 각각 캡처해야 한다. outbox upload 실패가 local 완료/기본 추천을 막지 않게 하고, reset/account 삭제 성공 뒤 해당 owner outbox를 `discardOwner`로 정리해야 한다.
- 실제 원격 적용 전 `scripts/test_release_identity_local_db.sh`와 upgrade DB dry-run을 다시 실행한다. 로컬 하네스는 A fixture UUID와 `fixture.invalid` 문서만 쓰고 종료 시 DB를 삭제한다.
- migration/Edge 원격 적용, 운영 삭제, UI 연결, engine 변경, commit/push는 이번 작업에서 수행하지 않았다.
