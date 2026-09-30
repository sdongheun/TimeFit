# DB-LIVE-PROVIDER-BUDGET-01 — live 공급자 전역 예약

## 2026-09-23 DB-LIVE-PROVIDER-BUDGET-DEPLOY-03 — 운영 적용·검증 완료

통합 결정의 개발계정 초기 상한 `tourapi=800`, `busan_public_data=8000`을 운영 DB에 적용했다. 이 DB 세션은 적용 직전 원격 이력001~017·local pending018 단독과 018 SHA-256 `d25171aa75f3f355d245d8de240759d0af36f65f81875c34a1f24a89fd85c732`를 확인했다. 그 사이 통합 세션이 중복 방지를 위해 018과 설정 migration 019를 먼저 적용했으므로, 본 세션의 고정 CLI dry-run은 `upToDate=true`, migrations/seeds/roles 빈 배열로 끝났고 **push/upsert를 반복하지 않았다**. 최종 원격 migration list는001~019가 local/remote 일치한다.

설정은 별도 감사 가능한 `202609230019_live_provider_budget_config.sql`의 한 transaction migration으로 두 scope를 idempotent upsert한다. SHA-256은 `f637fc81853c5be926f2e7fcd76c39cadca97ee8436b2deb136f7fca9a712c75`다. 같은 repeatable-read/read-only snapshot의 운영 사후 검증 결과:

- config 정확히 2행: `tourapi=800`, `busan_public_data=8000`.
- 예약 전체/rolling 24h 모두 0행. 실제 service-role RPC는 성공 시 예약 1행을 쓰므로 검증 목적으로 호출하지 않았다.
- `live_provider_budget_config`, `live_provider_attempt_reservations`: RLS 활성. anon/authenticated/service_role의 table SELECT/INSERT/UPDATE/DELETE 직접 권한 모두 false.
- `reserve_live_provider_attempt(text,text)`: SECURITY DEFINER, 인자2개, set-returning `TABLE(granted boolean, reason text)`. anon/authenticated EXECUTE false, service_role EXECUTE true. 즉 service-role RPC 단일행 공개 계약은 함수 정의·권한으로 검증했고 운영 slot은 소비하지 않았다.
- provider HTTP, live flag, Edge 배포, 다른 계정·기록·동의·개인화·route-proxy 변경0. 원격 확인 transaction은 ROLLBACK으로 종료했다.

문제 시 자동 down/전체 DB 복원 대신 먼저 live 호출/flag를 닫고, **새 전진 migration 한 건**에서 두 scope cap을 `0`으로 원자 갱신하면 함수의 `unconfigured` 경계로 신규 provider HTTP를 차단할 수 있다. 이전 상태는 config 부재였지만 예약이 생긴 뒤 config 행 삭제는 FK와 감사 연속성을 깨므로 권장하지 않는다. 018 객체 제거가 정말 필요하면 Edge 연결 해제·예약/의존성0을 별도 읽기 전용 확인하고 별도 승인 migration으로 처리한다. 기존 기록이나 전체 DB를 과거 시점으로 덮어쓰지 않는다.

상태: **DB migration·cap 설정·읽기 전용 사후 검증 PASS**. 이는 실제 provider HTTP·live flag 전환·Edge 동작 성공을 의미하지 않는다.

2026-09-22 로컬 구현·격리 DB 검증. 운영 migration 적용·quota 설정·공급자 HTTP 호출은 하지 않았다. 기준은 [API 설계](../external-api/live-provider-quota-design-01.md)의 첫 구현 범위다.

## 공개 RPC와 API 호출 순서

`public.reserve_live_provider_attempt(p_credential_scope text, p_operation text) returns table(granted boolean, reason text)`를 **service_role만** 호출한다. scope는 `tourapi`, `busan_public_data`뿐이다. Tour operation은 `catalog_page`(areaBasedList2 각 페이지), `detail_intro`(detailIntro2 각 ID), 향후 endpoint용 `detail_common`, `detail_image`; 부산은 `attractions_page`, `food_page`, `shopping_page`(각 원천의 각 페이지)다. 부산 세 operation은 **하나의 scope/cap**을 공유한다. 해당 credential이 실제로 분리된다는 계정 근거가 달라지면 활성화 전에 scope 매핑을 다시 검토해야 한다.

반환은 정확히 한 행이다. `true/granted`만 공급자 HTTP 1회 시도를 허가한다. `false/unconfigured`는 설정 누락·0, `false/limit`는 rolling 24시간 상한 도달, `false/invalid_input`은 허용되지 않은 scope/operation 조합이다. DB/RPC timeout·오류·무응답·복수 행·알 수 없는 enum은 RPC 성공이 아니므로 API가 **HTTP 0**으로 fail-closed 처리한다. 앱에는 원문 오류·예산 잔여량을 내보내지 않는다.

API는 JWT/secret/strict 입력/기존 세션 budget을 먼저 검사하고, **각 실제 fetch 직전** 이 RPC를 await하여 `true/granted`가 확정된 뒤에만 fetch한다. page1 성공 뒤 page2를 시도하지 않으면 page2 예약도 없다. 허가 후 공급자 timeout·거절·Edge 중단은 환불하지 않는다. 동일 요청 replay가 남은 cap 안에서 추가 slot을 소모할 수 있으므로 replay 차단으로 설명하면 안 된다. 클라이언트는 cap·시각·timezone을 제출하지 않는다.

## 구현과 보존 경계

새 migration `202609220018_live_provider_budget.sql`은 빈 scope 설정 테이블, 비식별 예약 행(scope·operation·서버 예약시각만), 함수 및 service-role-only EXECUTE를 추가한다. 테이블은 RLS 활성·직접 접근 권한0이다. 함수는 scope 설정 행을 `FOR UPDATE`로 잠가 최초 예약 경합까지 직렬화하고, **잠금 취득 후** `clock_timestamp()`로 `(t-24h,t]`를 계산한다. 24시간 밖의 해당 scope 예약은 잠금 안에서 정리한다. 기능이 한동안 사용되지 않으면 오래된 비식별 예약 행은 다음 해당 scope 예약 전까지 남으므로, 별도 정기 purge/집계 보관 정책은 운영 인계 사항이다. 설정은 migration에 등록하지 않았으므로 기본적으로 모든 live 호출이 차단된다.

기존 route-proxy Kakao/TMAP 예산, Tour 세션 2페이지·12→6·누적30, 부산 원천별2·snapshot6, 재시도0, 원본 비저장·owner/동의/개인화, 추천 정책, UI는 변경하지 않았다. DB에는 공급자 키·JWT·사용자·좌표·source/content ID·URL/query·원문 응답/오류가 없다. 이 DB migration만으로 Edge가 예약을 호출하지 않으므로 **live 안전 활성화 완료가 아니다**. API 역할이 handler의 모든 provider fetch에 연결하고 fixture로 HTTP 0 차단을 확인해야 한다. 공급자 실제 승인 cap·다른 콘솔 사용량·초당 한도·공식 reset 기준은 별도 운영 확인이다.

## 검증과 이력

이전: Edge invocation의 비영속 cap만 존재 → 다른 기기/인스턴스가 같은 credential을 공유해 전역 한도를 넘길 수 있음 → scope 설정 행 직렬화와 rolling 24시간 예약으로 교체 → 실제 HTTP 시도마다 서버 전역 상한을 유지하기 위함 → **로컬 구현 완료, API 연결·운영 설정 전**. replay ledger/CAS·초당 bucket·공급자 reset bucket은 첫 범위에서 보류한다.

- 실패 선행: 함수 미존재로 `scripts/test_release_identity_local_db.sh live-budget` 예상 실패.
- 같은 명령 최종: **PASS**. 001~018 순차 적용, 설정 없음/0, scope·operation allowlist, Tour/부산 scope 분리, 마지막 1 slot에 부산 3동시 요청 중 정확히 1 grant, Tour 동시 예약·상한/replay, 23h59m 보존·24h 초과 만료, anon/authenticated RPC·table 차단 및 service_role table 직접 차단을 격리 DB로 검증.
- migration SHA-256: `d25171aa75f3f355d245d8de240759d0af36f65f81875c34a1f24a89fd85c732`.
- `npm run test:typecheck` PASS. `npm run test:ui` **853 PASS/기존 skip1/FAIL0** (854). `npm test` **596 PASS/FAIL0**. `git diff --check` PASS. 실제 공급자 호출0, 원격 DB 변경0.

## 완료 인수인계

1. **변경 파일/목적:** migration 018, `scripts/test_release_identity_local_db.sh`의 `live-budget` 모드, `scripts/test_live_provider_budget_local_db.mjs`, 본 문서 및 DB README. 전역 예약과 격리 동시성·권한 회귀.
2. **유지 계약:** 기존 route-proxy/개인화/원본 비저장/세션 호출 cap과 UI·추천 정책 불변. 원격 migration·운영 quota 값·Edge 배포/연결0.
3. **테스트:** 격리 DB PASS, typecheck PASS, UI 853 PASS/기존 skip1, core 596 PASS, diff 검사 PASS.
4. **다음 결정·위험:** API가 각 fetch 직전 service-role RPC를 연결·fail-closed fixture 검증. 계정 소유자가 credential 공유 범위와 실제 승인량·여유폭을 확인하고 별도 운영 cap/배포 승인. replay/초당 보호는 보류.
