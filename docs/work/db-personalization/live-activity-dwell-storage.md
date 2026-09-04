# DB-DWELL-01 — 사용자 확인 체류 표본·동의·개인화 프로필 저장

> 상태: **진행 예정**
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
   - 완료된 체류 표본: 사용자, 저장 코스/stop 연결 또는 안전한 FK, 정제된 `category`, nullable `sub_category`, `actual_dwell_min`, `arrival_source=user_confirmed`, 완료 시각, schema/version. 카탈로그에 subCategory가 없는 완료 표본만 null을 허용하며 파생 프로필 계산에서는 제외한다.
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
