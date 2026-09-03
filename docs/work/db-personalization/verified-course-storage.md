# DB-1 — V1 검증 코스 저장 계약

## 상태

진행 예정. 이 문서는 DB·개인화 역할의 현재 상세 지시와 완료 인계를 함께 보관한다.

## 목적과 확정 경계

추천은 비로그인 사용자도 익명 Auth로 계속 이용한다. 다만 **저장**은 이메일 인증을 마친 일반 로그인 사용자만 할 수 있다. 자동 익명 Auth 계정에는 profile·저장 코스·방문 이력·개인화 이벤트·출발/도착 좌표를 만들지 않는다.

이번 작업은 화면의 저장 버튼이나 저장 후 화면 전환을 만들지 않는다. 실제 경로·운영시간·최소 체류·도착 여유를 통과한 `VerifiedCourseV1` 스냅샷을 안전하게 저장하고 다시 읽고 삭제할 수 있는 DB/repository 경계만 만든다.

### 저장 가능한 코스

- 대표 또는 검증 대안처럼 `VerifiedCourseV1`의 검증 완료 상태인 코스만 허용한다.
- `conditional_visit`, `운영시간 확인 필요(사용자 확인)`, 탐색 카드, route 미검증/실패/시간 초과 후보는 저장 payload로 만들지 않는다.
- 저장값은 코스가 검증된 당시의 순서, 각 stop의 선택 체류(`stayMin`, `stayState`), 실제 legs·수단·시간, 도착 여유·남은 시간, 엔진/카탈로그 버전 및 필요한 표시 스냅샷이다. 복원 시 카탈로그·엔진을 재계산해 과거 코스를 바꾸지 않는다.
- 사용자 소유 코스에 한해 출발/도착 좌표를 저장할 수 있다. 이 좌표·user ID·추천 입력은 Route Proxy cache/lease/budget 및 진단·공개 continuation과 어떤 FK·열·RPC 인자·로그로도 연결하지 않는다.

## 구현 지시

1. 현재 `courses`/`course_stops`/`course_legs`와 legacy `src/services/courseRepository.ts`를 V1 계약 관점에서 감사한다. 자유 장바구니·로컬 guest 성공 반환·근사 leg 재계산에 기대는 경로를 V1 저장 구현에 재사용하지 않는다.
   - 기존 migration은 수정하지 않고 새 migration만 추가한다.
   - 기존 legacy 저장 행을 삭제·변환하지 않는다. V1 행과 식별 가능한 schema/version을 추가하거나, 기존 행과 안전하게 구별되는 저장 계약을 둔다.
2. 새 migration에서 검증 V1 저장을 한 트랜잭션으로 처리하는 서버 함수/RPC를 만든다.
   - `user_id`는 payload가 아니라 `auth.uid()`로만 정한다.
   - top-level 시간·버퍼·수단·버전·snapshot과 stops/legs를 검증한 뒤 코스·stop·leg가 전부 저장되거나 전부 실패해야 한다. child row만 남는 부분 성공은 금지한다.
   - stop order/leg order 연속성, 1~3 stops, 음수 시간 금지, 허용 mode·visit 상태, 필수 title/source/version, route 검증 상태를 DB 경계에서 다시 확인한다. 클라이언트 제공 user ID·임의 SQL 필드·provider 원문/비밀값은 받지 않는다.
   - 폴리라인, 원본 provider body, GPS 이동 이력, 검색어, CAPTCHA/JWT/API key는 저장하지 않는다.
3. RLS/권한을 명확히 한다.
   - anon과 익명 Auth 사용자는 table 직접 접근·RPC 저장/읽기/삭제를 모두 거절한다.
   - 이메일 인증된 일반 사용자만 자기 V1 코스를 저장·목록·상세 읽기·삭제할 수 있다. 다른 사용자의 행과 child row는 ID를 알아도 읽거나 변경·삭제할 수 없다.
   - service role은 운영/계정 삭제에 필요한 기존 권한을 유지하되, public RPC가 service role처럼 동작하거나 임의 user ID를 받으면 안 된다.
   - 기존 profile/RLS 정책과 충돌하면 조용히 완화하지 말고 migration에서 충돌 원인과 안전한 전환을 남긴다.
4. DB·개인화 소유의 V1 repository를 추가하거나 기존 repository에 **명시적 V1 entry**를 분리한다.
   - 입력 타입은 UI가 재계산 없이 전달할 수 있는 검증 결과 스냅샷이어야 한다. UI/엔진 타입을 `any`로 흡수하지 않는다.
   - 저장 전 일반 로그인·이메일 인증 여부를 확인한다. 비로그인/익명/미인증은 네트워크 write 0회인 typed 결과로 끝낸다. 저장 실패를 `local-*` 성공으로 위장하지 않는다.
   - 목록/상세/삭제는 V1 행만 대상으로 하고, 복원 값의 stop/leg 순서와 검증 당시 선택 체류·시간표를 보존한다. 네트워크/DB 실패는 빈 목록과 실제 빈 목록을 구분 가능한 typed 결과로 만든다.
5. `docs/04_backend/데이터베이스설계.md`를 현행 V1 규칙으로 정합화한다.
   - 이전 자유 장바구니 편집·guest local 저장 방식 → 충돌/위험 → 검증 스냅샷 전용 로그인 저장 → 이유 → 상태를 남긴다.
   - 진행 중 재계획, 후기, 개인화 이벤트, 조건부 수동 코스 저장은 이번 범위 밖/구현 전으로 명시한다. 현재 구현되지 않은 기능을 완료처럼 쓰지 않는다.

## 필수 검증

고정 fixture와 격리 DB에서 아래를 검증한다. 운영 Supabase, 실제 사용자, 실제 좌표, provider 호출은 사용하지 않는다.

1. 이메일 인증 일반 사용자 1명이 1·2·3 stop 검증 코스를 저장하고 읽을 때 순서·legs·선택 체류·buffer·remaining·engine/catalog version이 동일하다.
2. stop/leg 한 행이라도 잘못된 payload면 parent/child가 **0행** 추가된다. 중간 child insert 실패도 부분 저장이 남지 않는다.
3. 비로그인·익명 Auth·미인증 일반 계정은 RPC/table 저장·목록·삭제가 거절되고 repository write 0회다.
4. A 사용자는 B의 course/stops/legs를 read/update/delete할 수 없고, ID 추측도 실패한다.
5. conditional/미검증/0·4 stop/음수 시간/순서 중복·누락/허용되지 않은 수단과 source는 fail-closed 한다.
6. 저장 schema·RPC·test 출력에 route cache key, user ID와 public cache의 결합, IP/GPS history/provider 원문/API key가 없음을 계약 검사한다.
7. 최소 `npm run test:typecheck`, 관련 DB/RLS/repository fixture, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 로컬 Postgres를 쓸 수 없으면 실행 불가 이유를 숨기지 말고 SQL 계약 테스트와 실제 실행 결과를 분리해 기록한다.

## 소유 경계와 다음 인계

- 수정 가능: `supabase/migrations/`, DB repository, DB/RLS fixture, `docs/04_backend/데이터베이스설계.md`, 이 문서와 DB 역할 README.
- 수정 금지: `src/ui/`, `src/engine/`, route adapter/cache/Edge Function, 원본·런타임 데이터, 기준 제품 문서, `docs/작업조정_보드.md`.
- UIUX 다음 작업은 DB-1 수락 후 `U-COURSE-SAVE-01`: 로그인 상태의 검증 코스에서만 저장 CTA·저장/실패/로그인 유도를 연결한다. 비로그인 추천 흐름에는 로그인 강제를 넣지 않는다.

## 완료 인계 양식

1. 변경 파일과 migration/RPC/repository 공개 타입
2. 유지한 privacy·anonymous·Route Proxy·UI/엔진 경계
3. 실행한 fixture/격리 DB/전체 회귀와 결과
4. UI 저장 CTA가 소비할 typed 성공·인증 필요·저장 실패·복원 불가 상태, 남은 위험
