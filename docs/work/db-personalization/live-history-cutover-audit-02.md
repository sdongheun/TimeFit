# DB-LIVE-HISTORY-CUTOVER-AUDIT-02 — 기록 보존·실시간 전환 읽기 전용 감사

2026-09-23. **판정: 기존 완료/guest/계정 기록 삭제는 실시간 원천 전환의 선행 조건이 아니다.** 이 문서는 코드·schema의 현행 계약만 확인했다. 사용자의 “현재 실사용자 없이 테스트 계정 기록만”이라는 설명은 운영 Auth·DB 전수 계수나 계정 소유자 확인으로 검증된 사실이 아니다. 원격 조회·쓰기, 운영 데이터 삭제, schema/migration 변경은 0회다.

## 1. 기록/좌표/소유권 경계

| 경계 | 코드·schema 근거 | 전환 영향 |
| --- | --- | --- |
| 서버 완료 | `015_release_account_identity_records.sql`의 `account_course_completions`는 owner, run/completion ID, 완료시각, provenance(`account_completed`/`guest_import`), generation/hash를 저장한다. 자식 `account_course_completion_places`는 ordinal, content ID, title, category/subcategory만 저장하며 **원천 source key·좌표·주소는 없다**. | 목록·방문횟수는 보존 가능. 삭제해도 새 live 좌표 계약이 만들어지지 않는다. 원천 간 동명/동일 ID를 자동 합치면 안 된다. |
| guest 가져오기 | `guest_completion_imports`와 `guest_completion_source_claims`가 request/수락·거절·source claim을 보관한다. 가져온 완료는 `guest_import` provenance이며 학습 자격을 얻지 않는다. 기기 원본/pending은 서버 집계 밖이다. | 완료 행만 임의 삭제하면 import ack·claim과 기기 원본의 의미가 어긋날 수 있다. guest 원본을 “서버에 있는 테스트 데이터”로 간주하지 않는다. |
| RLS | 완료/장소는 account Auth 본인만 select. tombstone, guest import/claim, mutation은 직접 클라이언트 읽기 불가이며 service_role 전용. `get_account_record_generation`과 삭제 RPC는 검증된 account JWT를 요구한다. | 관리 SQL을 클라이언트 권한으로 우회하거나 타 owner 기록을 삭제하지 않는다. 읽기 전용 감사도 관리자 보호 경로에서만. |
| 개별/전체 삭제 | `delete_account_course_completion`은 owner의 run tombstone을 먼저 쓰고 완료 행을 삭제한다. 장소는 FK cascade. `delete_all_account_course_completions`는 generation 증가 후 완료와 tombstone을 지우고 mutation을 남긴다. 둘 다 guest import/claim, 동의, 표본·profile을 직접 지우지 않는다. | 삭제는 불가역적이며 서버 완료/기기 pending/ack/학습을 한 번에 초기화하는 수단이 아니다. 전체 삭제를 cutover 도구로 사용하지 않는다. |
| 체류 표본 | `016_dwell_personalization_storage.sql`의 sample은 별도 `user_id/course_run_id/content_id`와 실제 체류를 저장한다. 제출 때 account 완료와 대조하지만 FK가 아니다. profile은 sample에서 계산되며 유효 180일·최소 3건이다. consent도 별도다. | 완료 기록만 삭제해도 기존 sample/profile·동의가 자동 삭제/재계산되지 않는다. guest import는 제출 적격성 없음. 테스트 완료 삭제만으로 개인화 시험 흔적이 사라진다고 주장할 수 없다. |
| 다른 저장 데이터 | legacy `courses/course_stops`는 별도 그래프와 좌표를 가질 수 있지만 완료 행과 FK가 없다. `course_run_id`/제목으로 임의 join하여 “과거 방문 좌표”로 승격하면 안 된다. | 전체 계정/코스 삭제나 오래된 코스 좌표 재사용은 필요하지 않다. |
| 화면 | `AccountRecordsPanel`은 owner 검증 후 기기·서버 완료를 `completionId`로 병합한다. 목록과 통계는 저장된 완료/분류로 만들고, 지도·구군 필터·카카오 열기만 `busan_poi_catalog.json`의 ID→주소·좌표를 사용한다. `buildBusanVisitMap`은 ID가 없거나 주소/좌표가 불명확하면 `unlocatedCount`로 남긴다. | 번들 원천 사실을 제거하면 map/열기/구군 필터가 막힐 수 있으나 완료 목록 자체를 삭제할 이유는 아니다. 현재 catalog 좌표가 과거 방문 당시 좌표였다는 보장도 없다. |
| 신규 기기 완료 | `courseCompletionRepository.ts`의 현재 `CourseCompletionPlaceV1`도 content ID, title, category/subcategory, 계획/실제 체류만 저장한다. 계정 업로드는 이 DTO에서 ordinal을 더한 동일 비좌표 장소 사실을 전송한다. | 기존 기록을 전부 지워도 **다음 신규 완료부터 똑같이** 번들 위치 해석에 의존한다. 일회성 삭제는 구조 해결이 아니다. |

## 2. 삭제 없는 권장안과 결정

권장: **기록 DTO와 owner 격리·guest provenance는 유지**하고, 추천 live 원천과 별도인 “과거 기록 장소 해석” 포트를 UI/데이터 역할이 정한다. 과거 완료 행에는 source key가 없으므로 `contentId`만으로 Tour/부산 다중 원천을 exact 매칭했다고 주장하지 않는다. 기존 승인 카탈로그와 연결되는 작은 역사적 ID→위치 참조를 추천 입력에 섞지 않고 표시 전용으로 유지하거나, 현재 live 원천에 대해서는 명시적인 source 매핑 근거와 주소/좌표 검증이 있을 때만 “현재 확인된 장소로 길찾기”를 제공한다. 불일치·이동·누락이면 지도 점·카카오 CTA·지역 필터만 비활성/미확인으로 두고 원래 완료 목록·시각·방문 통계는 보존한다. 현재 날짜/좌표를 과거 방문 사실로 소급하지 않는다. 별도 static 참조는 master plan의 추천 stale fallback 금지와 명확히 분리해야 한다.

이 방식은 기록 삭제 없이 번들 추천 사실을 제거할 수 있다. 반대로 전체 완료 기록을 지워도 새 계정/guest 완료의 좌표 미저장 계약은 그대로이므로 문제가 재발한다. **삭제 필수 아님.** 새 완료에도 동일 resolver 또는 명시적 미확인 UI가 적용되어야 하고, 추천 live snapshot이 종료돼도 기록 열기에 필요한 검증된 위치 근거를 어디서 얻을지 UI/데이터 역할이 확정해야 한다. 실제 테스트 기록 정리는 전환 차단 해결이 아니라 별도의 사용자 데이터 정리 결정이다. 실사용자 0·모든 대상이 테스트 계정이라는 사실과 아래 수량을 확인하기 전에는 삭제 범위를 확정할 수 없다. 신규 마이그레이션/좌표 소급 저장은 이번 결정에 필요하지 않다.

## 3. 운영 대상·건수 안전 조회 절차 — 제안만, 미실행

1. 계정 소유자가 보호된 Auth 관리 화면에서 **테스트 계정임을 계정별로 확인**하고 삭제 후보 UUID를 비밀 보관 경로로 읽기 전용 감사 클라이언트에 전달한다. 이메일/UUID/토큰/비밀번호를 채팅·문서·명령행 인자·로그에 싣지 않는다. 시간대·`c-` ID prefix만으로 테스트 계정을 판정하지 않는다. 현재 로그인 계정도 테스트 계정이라는 별도 확인이 필요하다.
2. 동일 DB 연결에서 `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`를 시작하고 아래 SQL의 `$1::uuid[]`에 **검증된 후보 UUID 배열을 바인딩**한다. 반환에는 배열 순서의 `audit_slot`, Auth 존재 여부와 테이블별 개수만 둔다. ID·이메일·장소명·좌표·원시 payload/hash는 결과로 출력하지 않는다. 대상 배열/SQL을 query log에 남기는 도구라면 실행하지 말고 비출력 파라미터 경로를 먼저 준비한다.

```sql
with candidate as (
  select id, ordinality::integer as audit_slot
  from unnest($1::uuid[]) with ordinality as x(id, ordinality)
)
select c.audit_slot, (u.id is not null) as auth_exists,
  (select count(*) from public.account_course_completions x where x.user_id=c.id) as completions,
  (select count(*) from public.account_course_completion_places p join public.account_course_completions x on x.id=p.completion_id where x.user_id=c.id) as places,
  (select count(*) from public.guest_completion_imports x where x.user_id=c.id) as guest_imports,
  (select count(*) from public.guest_completion_source_claims x where x.user_id=c.id) as guest_claims,
  (select count(*) from public.account_completion_tombstones x where x.user_id=c.id) as tombstones,
  (select count(*) from public.account_record_mutations x where x.user_id=c.id) as record_mutations,
  (select count(*) from public.account_record_state x where x.user_id=c.id) as record_state,
  (select count(*) from public.profiles x where x.id=c.id) as profiles,
  (select count(*) from public.account_consent_records x where x.user_id=c.id) as signup_consents,
  (select count(*) from public.dwell_personalization_consents x where x.user_id=c.id) as dwell_consents,
  (select count(*) from public.dwell_completion_samples x where x.user_id=c.id) as dwell_samples,
  (select count(*) from public.dwell_personalization_profiles x where x.user_id=c.id) as dwell_profiles,
  (select count(*) from public.courses x where x.user_id=c.id) as saved_courses,
  (select count(*) from public.course_feedback x where x.user_id=c.id) as course_feedback,
  (select count(*) from public.recommendation_events x where x.user_id=c.id) as recommendation_events
from candidate c left join auth.users u on u.id=c.id
order by c.audit_slot;
```

3. 같은 snapshot에서 후보 **밖**의 Auth/완료/guest/표본 owner 수·행 수를 별도로 집계한다. 하나라도 있으면 “테스트 계정뿐” 가정으로 전량 정리하지 않는다. 아래는 실제 ID를 출력하지 않는 보수적 경계 확인이다. `account_course_completion_places`는 owner가 parent에 있으므로 완료 개수와 위 후보 place 수를 대조한다.

```sql
select
  (select count(*) from auth.users u where not (u.id = any($1::uuid[]))) as other_auth_users,
  (select count(*) from public.account_course_completions x where not (x.user_id = any($1::uuid[]))) as other_completions,
  (select count(*) from public.guest_completion_imports x where not (x.user_id = any($1::uuid[]))) as other_guest_imports,
  (select count(*) from public.guest_completion_source_claims x where not (x.user_id = any($1::uuid[]))) as other_guest_claims,
  (select count(*) from public.dwell_completion_samples x where not (x.user_id = any($1::uuid[]))) as other_dwell_samples,
  (select count(*) from public.courses x where not (x.user_id = any($1::uuid[]))) as other_saved_courses;
```

4. `ROLLBACK`으로 읽기 전용 transaction을 끝낸다. 관리자 출력은 계정별 `audit_slot`·건수와 후보 외 aggregate만 보호된 인수인계에 옮긴다. 운영 현황은 동시 쓰기로 바뀔 수 있으므로 삭제를 나중에 승인하더라도 **즉시 직전 같은 owner·개수·동의·pending·표본을 다시 확인**해야 한다. 기기 로컬 완료/outbox/evidence/ack는 DB에서 계수할 수 없으므로 해당 계정의 정상 앱 경로로 별도 확인한다.

## 4. 인수인계

1. **변경 파일/목적:** 본 감사 문서만 추가. 좌표 의존성과 DB 삭제 파급, 안전 계수 절차를 기록.
2. **보존 계약:** 완료·guest 원본/ack·owner RLS·동의/체류 표본·기존 코스와 live 추천 정책 불변. 코드, migration, 원격 데이터 변경0.
3. **검증:** 015/016 SQL과 현행 repository/UI 코드 정적 대조. 실제 운영 owner·건수는 **미조회**이므로 숫자를 추정하지 않는다.
4. **다음 결정/위험:** UI/데이터 역할이 과거뿐 아니라 **향후 신규 완료**의 map/카카오 목적지 위치 근거와 미매칭 UX를 확정한다. 통합은 테스트 계정 실체·후보별 수량 확인 뒤에도 삭제가 필요한 별도 목적이 있는지 결정한다. 삭제 승인 시 완료와 guest claim/기기 pending/표본·profile·동의를 별도 범위로 분리해 보존·복구·동시 쓰기 절차를 설계해야 하며 이번 문서가 실행 승인서는 아니다.
