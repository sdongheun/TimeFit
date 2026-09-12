# FIX-LEGACY-COURSE-DATE-01 — 날짜 유실 보완 명령

2026-09-08. QA-RELEASE-180-01 반환 후 사용자 수정 요청. 날짜 보존 원칙 확정·구현 전. 아래 순서로 역할별 진행한다.

## 근거와 불변 경계

docs/work/qa-release/release-three-hour-validation.md 및 test/ui/qa-release-three-hour-save-date.test.mjs를 먼저 읽는다. 실제 repository 테스트에서120/180 두 경우 날짜가 하루 밀림을 통합도 재현했다.

중요: 현재 실패 fixture는 originalStart를 **기대값에만 두고 제품 입력에는 날짜 없는 startMin만 전달**한다. repository가 이 입력만으로 전날을 알아낼 수는 없다. 따라서 테스트를 억지로 통과시키려고 ‘현재 시각보다 늦으면 전날’ 같은 추정을 넣지 않는다. 생산자가 날짜를 확보하는 경로와 미확정 날짜를 안전히 거절하는 경로를 각각 검증해야 한다.

이력: 저장 당일+시분으로 날짜 재생성 → 자정 이후 저장 시 하루 밀림 → 최초 생성/원본 저장 날짜를 명시 전달하고 저장 시 보존 → 날짜 추측 제거·기존 기록 보호 → 구현 전. DB schema/RLS·개인화·3시간/2곳·호출예산 불변. 운영 기록 수정/삭제·migration/C 재실행0.

## 1. DB/repository — DB-COURSE-DATE-01 계약 인계

- courseRepository.ts의 조회 decode/create/replace와 호출부를 읽기 전용으로 추적한다. 원본 courses.starts_at/ends_at 및 날짜 포함 snapshot을 복구할 수 있는지 확인한다.
- UIUX에 날짜 포함 시작 instant(예: ctx.startedAtIso)의 필드·우선순위·유효성·실패 반환 계약을 먼저 인계한다. 필드명은 소비자와 한 번 정하고 저장소 독자 타입 복제 금지. UI 소유 nav.ts는 직접 수정하지 않는다.
- 원본 명시 시작 날짜를 저장에 사용하고 remainingMin을 더한 종료시각을 계산한다. 시분 startMin은 표시용이며 날짜 재생성 근거가 아니다. 원본 persisted starts_at과 snapshot이 충돌하면 조용히 추정하지 말고 정합성 실패로 반환한다. 실제 replace의 최초 시간 보존 계약 유지.
- 날짜 없는 기존 항목은 원본 저장 날짜가 있으면 복원한다. createdAt/현재 날짜/시분 비교로 원래 날짜를 추정하지 않는다. 근거가 없으면 기존 기록 조회·보존은 유지하고 저장/변경만 명확한 날짜 부족 상태로 차단해 UI가 새 입력으로 안내하도록 한다. 날짜 오류를 local 성공 fallback으로 숨기지 않는다.
- 계약 인계 및 UI 타입 연결 후 repository 소유 구현/테스트 진행. 테스트는 명시 날짜120/180의 실제 RPC payload·월말/연말·원본 복원·충돌/invalid/날짜 없음 RPC0·기존 조회 보존을 포함한다. 기존 계정·멱등성·정리 계약 유지. 결과 문서 docs/work/db-personalization/course-date-preservation.md에 남긴다.

## 2. UIUX — U-COURSE-DATE-01 계약 수신 후

- AppFlowContext/Execution/LegacyResults/MyCourses 경로와 새 입력에서 날짜가 최초 확정되는 시점을 확인한다. DB와 합의한 필드를 nav.ts 단일 작성자로 추가하고 생성→화면 왕복→변경→save 전달 동안 보존한다. 저장 버튼을 누를 때 날짜를 새로 캡처하지 않는다.
- 원본 저장 항목은 repository가 복원한 날짜를 사용한다. 기존 항목의 날짜가 확인되지 않으면 기록을 삭제하지 않고 `시간을 다시 설정해 주세요` 등 짧은 안내와 현재 입력 화면으로 가는 명시 행동을 제공한다. 자동 새 코스 생성/기존 기록 덮어쓰기0.
- 날짜를 전달했어도 사용자가 자정을 넘겨 실제 마감이 지난 코스를 시작하는 것은 기존 시간 유효성 검증 대상이다. 날짜 보존을 오래된 코스의 무조건 실행 허용으로 확대하지 않는다.
- 공유 타입/경계 작업이 끝나면 DB에 인계하고 UI 소유 구현을 진행한다. 엔진 타입·정책/서비스를 직접 수정하지 않는다. 결과는 docs/work/uiux/course-date-preservation.md.

## 3. QA — QA-RELEASE-180-01 재검증

- 두 구현 인계 후 실행한다. 현재 날짜 없는 실패 fixture는 삭제/skip/기대 날짜를 하루 뒤로 바꾸지 않는다. **새 명시 날짜 전달 계약의 성공 사례로 갱신하고, 날짜 없는 입력은 추정 저장하지 않고 거절하는 별도 사례로 보존**한다. 변경 이유를 QA 기록에 명시한다.
- repository 입력에 날짜를 넣은 테스트만으로 끝내지 않는다. 실제 생산자/화면 이동→save 전달에서23:50 시작→익일00:05 저장의 날짜가 유지되는 결합 fixture를 추가한다.120/180,월말/연말,서버 원본 복원,날짜 없음·충돌·만료를 확인한다.
- 실제 회원 RPC가 기대 starts_at/ends_at을 받는지, 오류 시 RPC0/가짜 로컬 성공0인지 검증한다. 이후 기존180분 집중/전체 회귀·typecheck·iOS export 재실행. 운영 DB 쓰기/실사용자 삭제/Simulator 반복0.

## 순서·완료

DB 계약 제시 → UIUX 공유 타입/전달 경계 연결 → DB 저장 수정·UI 화면 연결(분리 파일에서 병렬 가능) → QA. 서로의 파일을 동시에 수정하지 않는다. 계약 불명확하면 해당 지점만 통합에 반환하고 unrelated 작업 확대0. 각 역할 변경 파일/유지 계약/테스트 결과/남은 위험을 기록한다. commit/push 금지.
