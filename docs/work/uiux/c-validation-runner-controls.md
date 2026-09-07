# C runner 내부 실행 연결 — UIUX 인계

## 최우선 현행 — 지정 네 항목 보완 완료 (2026-09-08, 운영 재시도 금지 유지)

아래 진단의 세 결함과 관찰 누락에 대한 사용자 승인 네 항목만 구현했다. 추가 원인 조사는 하지 않았다. 기존 진단은 당시 코드의 이력으로 보존하며 실기기 마지막 원인을 확정한 것으로 변경하지 않는다.

1. **같은 계정 refresh 입력 유지:** CValidationPanel은 owner 변경/SIGNED_OUT/PASSWORD_RECOVERY 때만 receipt를 지운다. 같은 owner TOKEN_REFRESHED/SIGNED_IN은 입력을 유지한다. 계정 변경 중단·늦은 응답 폐기 계약은 유지한다.
2. **안전한 거절:** controller prepare/run은 closed/busy/already_started/account_required/owner_changed/not_prepared/baseline_required를 명시 반환하고 별도 `rejectionReason` 및 trace에 표시한다. 기존 실행 결과 reason을 중복 탭 사유로 덮어쓰지 않는다. panel ref 부재는 controller_unavailable로 표시하며, 비활성 버튼 이유도 표시한다. receipt는 검증을 통과해 실행이 시작될 때 소비하므로 실행 전 거절에 무조건 지우지 않는다.
3. **값 기반 receipt 비교:** strict 필드·값 검증은 유지하면서 ids의 각 index별 runId/completionId/eventId로 비교한다. 객체 키 삽입 순서는 무관하고 배열 순서/값/owner/execution 불일치는 계속 거절한다. 값 검증 후에만 ids를 **이미 준비된 runner plan의 키 순서**로 직렬화해 전달한다. 이는 receipt 권한을 합성하는 것이 아니라 검증된 동등 데이터의 전달 형식 정규화다. 기존 DB runner의 JSON 비교에도 정상 통과하며 서비스 파일을 수정하지 않았다. 독립 DB 소비자의 값 비교 개선은 DB 소유 후속이고, 이번 UI 연결은 그 변경을 기다리지 않는다.
4. **비민감 단계:** 내부 메모리에 최근32개 순번/stage/안전 거절 enum만 둔다. button_entered → controller_entered → receipt_accepted → runner_called → runner_returned/runner_threw → result_displayed를 확인하고, 거절/폐기는 execution_rejected/result_discarded로 구분한다. runner_called는 UI가 서비스 함수를 호출한 경계이며 서버 저장 성공이나 서비스 내부 claim 성공은 아니다. result_displayed는 panel의 표시 상태 반영 경계이며 실제 기기 픽셀 관찰을 대신하지 않는다. 새로고침 뒤 영속 복원은 추가하지 않았다.

### 완료 인수인계 네 항목

- **변경 파일:** `src/ui/CValidationPanel.tsx`(동일 owner 입력 유지·거절/단계 표시), `src/ui/cValidationControls.ts`(명시 거절·값 비교/전달 정규화·제한된 단계 기록), `test/ui/c-validation-failure-diagnosis.test.ts`(기존 결함 assertion을 정상 기대값으로 전환하고 guard 반례 추가), 이 작업 문서.
- **유지 계약:** 내부 flag/일반 UI·조회 패널·신규 ID 명시 준비·단일 run·동의 직접 ON·정상 owner 검증·격리 저장소·기존 코스/Live Activity 유지. 서비스/DB/엔진/환경/네이티브 코드는 수정하지 않았다. 운영 C 재시도·운영 조회·계정/표본 생성·DB 초기화/삭제·Simulator·추가 원인 조사·commit/push 모두0. receipt/토큰/비밀번호/계정 ID를 trace/로그/파일로 출력하지 않는다.
- **검증 결과:** 정상 기대값으로 바꾼 기존 fixture3개 RED를 먼저 확인한 뒤 GREEN. 집중 UI15 + 기존 DB runner8/recovery4 = **27 PASS**. 동일 owner 입력 유지, 표시 단계/비밀 부재, 값 동등 키 재배열 통과 및 기존 runner 직렬화 경계 일치, 배열 역순 거절, owner/미준비/중복/종료 guard, 취소/복구/정상 배포 비노출을 확인했다. typecheck PASS, 기본 테스트274 PASS, iOS export PASS(`/private/tmp/timefit-c-four-fixes-export`). 전체 UI 최종 결과는 아래 기록한다.
- **다음 결정·위험:** 지정된 UI 보완과 자동 검증만 완료했다. 마지막 운영 원인은 미확정 상태를 유지하고 새 C 실행/실기기 요청은 하지 않는다. 서버 claim/실제 저장·조회/추천/정리 성공은 이 trace나 fixture로 주장하지 않는다. DB standalone runner의 비교 구현은 그대로이며 UI 정규화 바깥 소비자에는 기존 한계가 남는다.

최종 회귀: `npm run test:ui` **589 PASS / 1 기존 SKIP / 0 FAIL**(총590), `npm test` **274 PASS**, typecheck/iOS export/diff check PASS. 로그 `/private/tmp/timefit-c-four-fixes-ui.log`, `/private/tmp/timefit-c-four-fixes-all.log`, `/private/tmp/timefit-c-four-fixes-export.log`. UI IPC 제한은 승인된 권한으로 재실행했다. 운영 결과와 구분한다.

## 진단 이력 — 마지막 C 실패 (2026-09-08, 운영 재시도 금지)

### 1. 실제 증거와 판정 한계

DB 최신 `두 번째 시도 종료·명시 재시도 준비 — 2026-09-08 00:31 KST` 전체와 위로 연결된 실행/복구 기록, 현재 UI/controller/runner/receipt 생성 코드를 대조했다. 현재 문서에 기록된 마지막 운영 시도는 두 번째 시도다. 그 뒤 새 시도의 실행 증거는 제공되지 않았다.

- 00:23:55 기준선 확보 및 receipt 전달, 사용자 실행 버튼을 눌렀다는 보고, 캡처 `awaiting_baseline`.
- 00:25:47 exact 완료0·표본0. **명시 중단 전** 기기 조회 `active/runClaimed:false/pendingRequests:0/storedKeyCount:0`; 이후 명시 중단으로 retired, 00:31 제한 정리 완료.
- 마지막 확인 가능한 성공 경계는 준비 완료/namespace active다. durable claim 성공 증거가 없고 controller/runner 진입 시각도 없다. 정상 동일 namespace 경로라면 claim 성공 뒤에는 marker가 남으며, clock_stale 등 runner try 내부 실패는 retire로 이어지므로 위 active·빈 values snapshot은 그 경로와 잘 맞지 않는다. 다만 저장 실패·동시 동작·캡처 시차를 배제한 trace가 없어 `runner.run 호출0`으로 단정하지 않는다.
- 사용자 조작 또는 키보드 첫 탭 소비는 원인으로 채택하지 않는다. `awaiting_baseline`은 버튼 callback 미진입, 입력 소실로 disabled, controller guard 반환 등 여러 경로에서 그대로 남을 수 있다. **실기기 최종 원인 미확정 / 아래 코드 결함은 fixture로 확인**이다.

### 2. 입력 → 결과 표시 경로 및 누락 경계

| 경계 | 현재 코드·상태 | 진단 |
| --- | --- | --- |
| 화면 실행 버튼 | CValidationPanel의 disabled=`busy || started || !receipt` | 비활성 이유가 별도로 표시되지 않으며 onPress 진입 증거 없음 |
| Auth 이벤트 → 입력 | 모든 Auth 이벤트에 `setReceipt('')` | 같은 owner의 TOKEN_REFRESHED도 정상 입력을 지움. controller는 해당 owner 변경이 없으므로 status/reason을 바꾸지 않음 |
| panel act | controls ref 없음이면 return; run 전에 입력을 지움; 반환값은 받지 않음 | controller가 거절/조용히 반환해도 입력은 이미 사라짐. 화면은 state snapshot만 표시 |
| controller.run 진입 | closed/busy/started/runner 없음/plan 없음/owner 불일치면 undefined return | 어느 guard였는지 표시되지 않음. 중복 호출 차단 자체는 올바르나 진단 경계 누락 |
| receipt 검사 | strict 필드/형식 검사 + owner/execution + JSON.stringify(ids) 비교 | 실패하면 baseline_required는 표시됨. 개별 실패 이유는 통합됨. 필드 삽입 순서만 달라도 정상 값이 거절됨 |
| runner.run | started→already_started; plan/stage/receipt 불일치→baseline_required; claim 실패→해당 상태 반환 | controller는 반환 상태를 reason에 표시. claim 뒤 try의 clock/baseline/runtime/sync 실패는 stopped+reason+cleanup으로 전달됨 |
| 비동기 결과 | controller는 closed/owner 불일치면 결과 폐기; panel은 ref 교체 뒤 업데이트 폐기 | 계정 보호는 유지할 계약. 폐기 단계 자체의 관찰 기록 없음 |
| 화면 표시 | 300ms 메모리 state 조회 및 promise 후 setView; 안전한 status/reason/progress/report | 즉시 실패는 유지되지만 phase trace/빌드 식별 없음. 새로고침으로 메모리 결과 소실; recovery는 결과 복원이 아님 |

### 3. 고정 fixture 재현 결과·최소 수정안·담당

`test/ui/c-validation-failure-diagnosis.test.ts`는 원하는 정상 동작이 아닌 **현재 결함을 재현하는 진단 assertion**이다. 향후 수정 시 정상 기대값으로 바꿔야 한다.

1. **UIUX 확정 결함 — 동일 owner refresh의 receipt 무통보 삭제.** 실제 CValidationPanel handler에서 유효 fixture 입력 뒤 TOKEN_REFRESHED를 전달하면 입력이 빈 문자열, 실행 disabled=true, status=awaiting_baseline/reason=null, runner 호출0이 된다. 사용자나 키보드 동작 없이 재현했다. 최소 수정: 실제 owner 변경/로그아웃/recovery 때만 입력을 폐기하고 같은 owner refresh는 유지. 입력 폐기 시 안전한 사유 표시. 실제 마지막 시도에 refresh가 발생했다는 증거는 없다.
2. **UIUX 확정 관찰 공백 — controller guard의 무응답.** 준비 뒤 currentOwner를 바꾸되 listener 전달 전 run을 호출하면 undefined, runner 호출0, 기존 awaiting_baseline/reason=null이 유지됨을 재현했다. 이는 지연/렌더·이벤트 순서 반례이며 마지막 기기에서 계정 전환이 있었다는 주장이 아니다. 최소 수정: 모든 거절에 allowlist gate 이유를 반환하고 panel이 처리. 중복/종료 보호는 유지하고 live 결과를 덮어쓰지 않는 별도 action 진단을 둔다. 입력은 검증/소비 결과를 확인해 지우되 비밀·receipt 원문 기록은 하지 않는다.
3. **UIUX 및 DB 공동 경계 결함 — JSON 필드 순서 의존.** 같은 ID 값·같은 배열 순서에서 객체 키만 eventId/completionId/runId 순서로 만들면 parser는 통과하지만 controller는 baseline_required로 거절, runner 호출0. 정규 순서 입력은 runner까지 도달한다. runner도 동일 JSON.stringify 비교를 사용하므로 UI만 고쳐서는 불충분하다. 최소 수정: 배열 순서와 각 필드 값은 엄격 유지하되 객체 키 삽입 순서는 무시하는 field-wise 비교를 UI/DB에 각각 적용. DB createCBaselineReceipt는 전달된 manifest.ids의 키 순서를 그대로 보존한다. 마지막 실제 receipt의 순서가 달랐는지는 원문을 보지 않아 미확정이며, 이 결함만으로 awaiting_baseline 캡처를 설명하지는 못한다(보통 baseline_required 표시).

**DB 인계:** 서비스 운영 실패 자체는 확정하지 못했다. 위 receipt 비교 정합성 및 runner 진입/claim 전후/반환 관찰 계약을 보완할 범위다. claim 실패 early return에는 cleanup 값이 없으므로 UI가 종료/정리 가능성을 추정하지 않게 phase와 cleanup 미확인을 명확히 유지한다. DB 정책·SQL·상태를 고쳐 실패를 우회하는 제안은 하지 않는다. UI의 silent guard/입력 삭제/화면 trace는 UIUX 담당이다.

### 4. 필요한 최소 비민감 진단 및 인수인계

- 기존 자료로 확정 불가하므로 다음 **구현 제안만** 남긴다: build/JS revision, 시각·단조 증가 이벤트 순번, press_handler_entered, receipt_present boolean/validation enum, controller_gate enum, runner_entered, claim_started/result enum, runner_result(status/reason/cleanup), result_applied 또는 result_discarded(enum). 동일 owner인지 boolean, 입력 폐기 원인 enum도 포함한다.
- owner/이메일/실행 ID/receipt JSON·토큰/비밀번호/저장 payload/SDK 원문은 불필요하며 수집하지 않는다. 반환 실패와 callback 미진입을 구분해야 하며, 운영 재시도 승인 없이 진단을 위해 다시 실행하지 않는다. 새로고침 이후도 보존하려면 비민감 최소 진단 보유 계약을 별도 결정해야 하며 이번에 파일/저장소 기록을 추가하지 않았다.
- **변경 파일:** 신규 UI 진단 fixture와 이 작업 문서만. 제품 UI/controller/service는 조사만 했고 수정하지 않았다.
- **유지 계약:** 운영 계정/표본 생성·새 실행 ID로 운영 재시도·DB 초기화/삭제·원격 조회·Simulator/실기기 실행·commit/push0. 실제 ID/receipt를 읽거나 기록하지 않았다. 현재 사용자 운영 재시도 금지 명령이 과거 DB의 재시도 안내보다 우선한다.
- **테스트 결과:** 신규 진단3 + 기존 UI11 + DB runner8/recovery4 = **26 PASS**, typecheck 및 diff check PASS. 합성 fixture와 stub/SDK fixture transport만 사용. PASS는 결함 재현 성공이며 제품 수정·C 성공의 증거가 아니다. 제품 변경0이므로 iOS 재번들/전체 회귀는 반복하지 않았다.
- **다음 결정:** UIUX는 위 두 UI 결함 및 안전한 action 진단 수정 승인을 받아 정상 기대 fixture로 교체; DB는 receipt 비교 및 runner/claim 진단 계약 인계. 마지막 운영 원인을 확정했다거나 서비스를 정상/실패로 단정하지 않는다.

## 최우선 현행 — 이전 종료·정리 후 내부 실행 재연결 (2026-09-08)

사용자 보고와 DB의 `이전 C 시도 복구·제한 정리 완료 — 2026-09-08 00:12 KST`를 확인했다. 이전 namespace retired/pending0 및 제한 정리는 수락된 결과이며, 이전 C의 실제 저장/추천 성공을 뜻하지 않는다.

읽기 전용만 제공하던 임시 진입 → 이전 실행의 종료/정리 확인으로 다음 명시 실행 연결 가능 → **같은 내부 flag 아래 조회 패널과 실행 패널을 함께 표시**로 교체했다. 아래 복구 중 실행 비노출 지시는 당시 경계로 보존하되 지금은 이 절이 우선한다. 일반 사용자 UI 및 flag 기본 숨김은 그대로다.

- `내정보 → 내부 개발 · 이전 C 실행 조회`는 기존 exact 읽기 전용 경로를 유지한다.
- `내정보 → 내부 개발 · C 검증`에서 현재 계정 확인 → 명시 준비 → DB의 새 plan 기준선/receipt → 명시 1회 실행 순서를 따른다. 화면 mount/계정 확인만으로 runner·UUID·prepare·run을 시작하지 않는다.
- 새 UUID는 사용자가 준비 버튼을 누를 때만 생성한다. 이전 조회 ID나 receipt에서 ID를 가져오지 않으며, 이번 실행 중에는 동일 runner/ID를 유지한다. 이전 정리된 ID/receipt 재사용과 실패 뒤 새 ID 자동 생성·자동 반복은 금지다.
- 상태 JSON은 `status`, 별도 `reason`, `progress`, `cleanup`, `report`를 표시한다. stopped의 reason과 정리 상태를 분리하고 중단 버튼 뒤에도 최초 실패 사유를 유지한다. report는 완료/제출/표본 수·선택 체류 전후·변화 여부의 안전한 요약이다. runner 없는 패널의 stop은 cleanup=null이며 이전 실행 retired 증거를 합성하지 않는다.
- 실행 결과를 확인하고 안전한 상태 요약을 DB에 인계하기 전에는 새로고침하지 않는다. 결과는 메모리 한정이며 저장·로그 기능을 추가하지 않았다. 새로고침 뒤 이전 결과/실패 사유의 복원을 약속하지 않고 durable 상태 조회는 별도로 유지한다.

### 재연결 완료 인수인계 네 항목

1. **변경 파일:** `src/ui/ProfileScreen.tsx`에 내부 실행 패널을 조회 옆으로 복구; `src/ui/CValidationPanel.tsx`에 새 실행/메모리 결과 안내 및 별도 reason 표시; `src/ui/cValidationControls.ts`에 실패 reason 보존과 runner 없는 retired 오인 제거; `test/ui/c-validation-controls.test.ts`, `test/ui/c-validation-panel.test.ts`에 failure-first·비자동 생성/실행·결과 표시 회귀; 이 문서에 현행 이력/인계.
2. **유지 계약:** 정상 Auth owner 검증·동의 직접 ON·DB baseline receipt·1회 claim·격리 저장소·계정 변경 중단·exact 정리 계약 유지. 조회 서비스/DB 서비스/엔진/일반 사용자 UI/기존 코스/Live Activity/환경 파일은 수정하지 않았다. 실제 새 실행·DB 쓰기/삭제·배포·Simulator·stage/commit/push는 하지 않았다. 토큰/비밀번호/관리자 자격정보 출력0.
3. **검증:** 실패 fixture에서 빈 runner cleanup=retired 및 reason 필드 누락 RED를 확인한 뒤 수정했다. 실행/controller/복구 화면 집중 **11 PASS**. 명시 준비 전 UUID/runner 생성0·인증 확인만으로 실행0·단일 생성/단일 run·중복 차단·reason 유지·조회 보존을 포함한다. typecheck PASS. 전체 UI/기본 테스트 및 iOS 번들의 최종 결과는 아래에 기록한다.
4. **DB 다음 단계:** 변경 반영 내부 앱에서 새 준비를 시작하기 전 보호된 plan→baseline→receipt 전달을 준비한다. 같은 최대3건/정리 승인 경계를 유지하며 새 ID로 사용자 명시 실행을 안내한다. 화면의 실패 reason/진행/결과/cleanup을 확인하고 저장·조회·추천·정리를 각각 판정한다. 이번 재연결이나 이전 제한 정리 PASS를 새 C 전체 통과로 기록하지 않는다. 실제 새 실행·기기 표시 결과는 미확인이다.

최종 자동 검증: `npm run test:ui` **585 PASS / 1 기존 SKIP / 0 FAIL**(총586), `npm test` **274 PASS / 0 FAIL**, iOS export PASS(`/private/tmp/timefit-c-reconnect-export`), `git diff --check` PASS. 로그는 `/private/tmp/timefit-c-reconnect-ui.log`, `/private/tmp/timefit-c-reconnect-all.log`, `/private/tmp/timefit-c-reconnect-export.log`다. UI의 tsx IPC 권한 제한은 승인된 권한으로 재실행했다. 운영 실행 증거가 아니다.

## 이력 — 새로고침 후 읽기 전용 복구 (2026-09-08, 조회는 유지·실행 비노출은 종료)

[DB 문서 맨 아래 새로고침 후 C 복구 인수인계](../db-personalization/personalization-finalization.md)를 수행했다. **현재 내정보 내부 진입은 이전 실행 조회 전용**이다. 아래 2026-09-07의 새 준비/receipt/실행 안내는 이번 복구 중 사용하지 않는다. 기존 runner 코드는 보존하되 Profile에서 실행 패널을 mount하지 않는다. 과거 runner 없는 화면의 stop 결과를 이전 실행 retired 증거로 사용하지 않는다.

DB 담당이 보존한 이전 plan에서 executionId만 보호된 로컬 경로로 전달한다. 운영 ID를 소스에 넣거나 새 UUID를 만들지 않는다. 변경 반영 앱의 `내정보 → 내부 개발 · 이전 C 실행 조회` 입력란에 **이전 executionId만** 붙여넣고 `이전 C 실행 상태 확인`을 한 번 누른다. owner/receipt/전체 JSON 재입력은 요구하지 않는다. 입력은 메모리에만 두며 결과에는 executionId/owner를 포함하지 않는다. 내부 flag는 기존 `EXPO_PUBLIC_C_VALIDATION_INTERNAL=true`를 사용하며 설정 파일은 이번에 변경하지 않았다.

반환된 status/phase/runClaimed/pendingRequests/storedKeyCount만 DB에 인계한다. pending이면 새 실행·삭제 금지, active면 자동 재개/retire 금지, retired(pending0)도 DB 원격 상태 대조 전 정리 완료나 C 통과가 아니다. not_found/corrupt/unavailable은 미실행·빈 결과로 추정하지 않는다. 조회 snapshot은 새로고침 전 UI 결과의 복원이 아니며, 미래 요청 종료를 보장하지 않는다. 이전 실행 ID 전달이 안 되면 조회를 멈추고 DB에 그 조건만 인계한다.

## 기준·현행 상태 — 2026-09-07

[DB C runner 완료 인수인계](../db-personalization/personalization-finalization.md)의 정확한 entry·prepare·receipt·run·stop 계약을 따른다. 기존 B 및 로그인 CAPTCHA 작업은 반복하지 않았다. 사용자는 CAPTCHA 확인 뒤 비로그인 기록 가져오기 안내 표시를 보고했으며, 이는 이번 C runner의 서버 owner 검증/실행 증거와 구분한다.

이전: DB runner만 있고 앱의 명시 실행 진입 없음 → 관찰: 정상 앱 일반 계정을 안전하게 전달할 소비자가 필요 → 교체: 내정보 내부 전용 패널에서 계정 확인/준비/DB receipt/단일 실행/중단 연결 → 이유: 관리자 자격정보나 사용자 fixture를 production runtime에 섞지 않고 기존 서비스 계약 소비 → **현재 UI 연결·자동 검증 완료, 운영 C 실행·최종 통과 미확인**.

## DB 작업자 실행 연결 절차

1. 내부용 빌드/JS 번들에서만 `EXPO_PUBLIC_C_VALIDATION_INTERNAL=true`를 명시한다. 기본값은 숨김이다. 일반 배포에는 이 플래그를 넣지 않는다. 이번 세션은 환경 파일·배포 설정을 수정하거나 운영 실행하지 않았다.
2. 내정보 하단 `내부 개발 · C 검증`에서 사용자가 표시된 현재 일반 계정을 확인하고 `현재 계정 확인`을 누른다. 익명 세션/로딩 상태는 대상이 아니다. `서버 인증·동의·기준선 준비 조회`를 누르면 보안 UUID execution과 runner 한 객체를 만들고 유지한다.
3. 서비스의 `prepare({expectedOwner})`가 정상 앱 Auth → 서버 getUser → 같은 owner 검증 및 동의/기존 표본 조회를 담당한다. UI의 계정 확인은 서버 검증의 대체가 아니다. `consent_required`면 내정보의 기존 맞춤 추천 설정에서 사용자가 직접 ON한 뒤 준비만 다시 누른다. UI는 동의 설정 API를 호출하지 않는다.
4. `awaiting_baseline`의 plan만 내부 선택 가능한 텍스트로 제공한다. 현재 계정/예정 ID가 들어 있으므로 공개 로그·채팅에 올리지 않는다. DB 담당이 보호된 로컬 전달 경로에서 받아 기존 `captureCManifest`로 기준선을 확보하고 `createCBaselineReceipt` 결과를 돌려준다. 전달 경로가 확보되지 않으면 **쓰기 전 중단**한다. UI가 baseline receipt를 합성하지 않는다.
5. DB가 발급한 receipt JSON만 마스킹 입력란에 입력한다. `{executionId,owner,ids,baselineCaptured}` 외 필드, 잘못된 형식/owner/execution/ID는 실행 전 거절한다. 비밀번호·토큰·관리자 키를 입력하는 화면이 아니다. 입력은 메모리에만 있고 실행/인증 이벤트 때 지운다. 같은 plan과 일치할 때만 `C runner 1회 실행`으로 기존 runner.run을 호출한다.
6. 동기 잠금으로 prepare/run 연타를 막고 run은 한 번만 호출한다. 실패를 새 execution으로 자동 반복하지 않는다. 준비 후 5분 지연은 서비스의 clock_stale 계약을 따른다. 실행 전이라면 준비를 명시적으로 다시 하고 **새 기준선과 receipt**를 받는다. 실패/중단 뒤 새 화면을 열어 새로운 실행으로 우회하지 말고 DB가 기존 실행의 결과부터 대조한다.
7. Auth 이벤트에서 변경 owner를 React 렌더 전에 읽어 `notifyAuthChanged()`를 동기 호출하고 stop을 호출한다. A→B→A, 로그아웃 및 password recovery는 기존 실행을 되살리지 않는다. 같은 owner의 token refresh만으로 중단하지 않는다. 화면 unmount와 명시 중단에서도 stop한다. 진행 중 원격 요청이 취소됐거나 쓰기 0이었다고 주장하지 않는다.
8. 표시값은 안전한 상태 enum, local completed/submitted 건수, cleanup 상태, before/after 선택 체류 분과 표본 수 요약이다. 300ms 조회는 getState 메모리 조회뿐이며 네트워크 폴링이 아니다. `cleanup_pending/unavailable`이면 관리자 정리 금지. 응답 settle 후 동일 객체의 중단 버튼으로 종료 상태만 다시 확인할 수 있고 run 재실행은 불가하다.
9. `verified`도 관리자 정리 완료/C 최종 통과가 아니다. DB는 보존 중인 manifest와 `cleanup=retired`를 확인한 뒤 기존 승인된 seal/정리를 별도로 실행하고 저장·조회·추천 계산·정리 결과를 각각 기록한다. 앱에는 관리자 cleanup import/버튼/자격정보가 없다.

## 네 항목 완료 인수인계

### 1. 변경 파일과 목적

- `src/ui/CValidationPanel.tsx`: 내부 flag, 일반 계정 확인, DB prepare/receipt/run/stop 화면, Auth 이벤트 연결, 안전한 상태 표시.
- `src/ui/cValidationControls.ts`: 화면 수명·동기 제출 잠금·동일 owner·정확 receipt·1회 실행·늦은 응답 차단 경계. DB 서비스는 type만 참조한다.
- `src/ui/ProfileScreen.tsx`: 기존 내정보 하단에 opt-in 패널 진입만 연결. 기존 프로필/권한/동의/로그아웃 기능은 유지.
- `test/ui/c-validation-controls.test.ts`, `test/ui/c-validation-panel.test.ts`: 실패 선행 및 production controller/화면 handler 실행 fixture.
- 이 문서: DB 전달 절차·검증 수준·운영 미확인 인계.

### 2. 유지한 공개 계약·정책

- `createAppCValidationRunner`를 직접 소비하며 서버 검증, owner-pinned client, 공유 underlying storage 및 실행별 격리 namespace, claim/retire 정책은 DB 구현 그대로다. 서비스/DB/엔진 파일은 수정하지 않았다.
- fixture를 일반 사용자 저장소·production singleton·기존 코스·Live Activity에 넣지 않는다. 계정·동의 자동 변경, 관리자 정리, B 재작업, native 변경, API/운영 DB 실행, Simulator, stage/commit/push 모두 0.
- 토큰·세션·비밀번호·관리자 자격정보를 읽어서 표시/로그/파일로 내보내는 UI 코드는 없다. SDK 원문 예외는 `unavailable`로 닫는다. plan/receipt에는 DB 계약의 owner/예정 ID만 있고 서버 기준선 행이나 인증 비밀은 없다.

### 3. 자동 검증 결과

- 구현 전 신규 controller fixture를 먼저 실행하여 모듈 없음 RED를 확인한 뒤 구현했다.
- 집중 23개 PASS: UI controller 5 + 실제 패널 2 + DB preparation 8 + DB runner 8. 계정 명시 확인, anonymous/owner 불일치, A→B→A, 취소/unmount, 동의 OFF, receipt 누락/잘못된 필드, 중복 실행, 같은 owner refresh, 실행 중 logout/늦은 성공 응답 폐기, 일반 배포 비노출을 포함한다. DB fixture는 실제 SDK HTTP transport만 대체하여 정상 서버 owner·격리 저장소·실제 runtime/engine 경계를 재검증했다.
- `npm run test:typecheck`: PASS.
- `npm run test:ui`: 582개 중 **581 PASS / 1 기존 SKIP / 0 FAIL**.
- `npm test`: **274 PASS / 0 FAIL**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-c-runner-export`: PASS. 네이티브 실기기 실행과 구분되는 iOS JS 번들 검증이다.
- 로그: `/private/tmp/timefit-c-runner-focused.log`, `/private/tmp/timefit-c-runner-ui.log`, `/private/tmp/timefit-c-runner-all.log`, `/private/tmp/timefit-c-runner-export.log`. tsx IPC 샌드박스 오류는 승인된 권한으로 재실행했으며 운영 네트워크 호출로 우회하지 않았다.

### 4. 다음 담당·미확인·위험

- **DB에 연결 완료 인계:** 위 내부 flag 빌드에서 사용자 현재 계정 확인 → 서버 prepare → 보호된 plan/receipt 교환 → 동일 runner 1회 실행 순서로 기존 승인을 사용한다. 같은 계정/정리 승인을 반복 요청하는 단계가 아니다.
- 아직 미확인: 내부 패널 실기기 렌더, 현재 계정으로 runner getUser/동의 검증, 보호된 receipt 전달, 실제 C 저장/owner 조회/추천 반영, 관리자 exact 정리/기존 데이터 보존. 이번 자동 검증이나 사용자 일반 로그인 성공으로 대체하지 않는다.
- 중단 뒤 local 건수와 실제 서버 row 수는 다를 수 있다. 응답 소실/pending은 미실행으로 간주하지 말고 DB manifest 및 요청 결과를 대조한다. 관리자 정리는 앱 밖 DB 담당 경계다.
- 일반 배포 전 내부 flag가 제거되어 패널이 숨겨지는지 빌드 설정을 확인한다. 새 build 적용만으로 C 통과라고 기록하지 않는다.

## 읽기 전용 복구 완료 인수인계 — 2026-09-08

### 1. 변경 파일·목적·이력

- `src/ui/CValidationRecoveryPanel.tsx`: 기존 `inspectAppCValidationExecution({executionId,expectedOwner,currentAppOwner})`만 명시 호출하는 독립 읽기 전용 패널. 새 runner/prepare/run/stop/retire는 호출하지 않는다. 예상 owner는 AuthContext의 현재 일반 계정이며 정상 서버 인증 및 exact namespace read는 기존 서비스에 맡긴다.
- `src/ui/ProfileScreen.tsx`: 내부 진입을 복구 패널로 교체해 복구 중 새 실행 버튼을 누르는 실수를 차단한다. 기존 CValidationPanel/controller 구현은 삭제하지 않는다.
- `test/ui/c-validation-recovery-panel.test.ts`: failure-first 화면 handler fixture 3개. 이 문서에 DB 인수인계를 추가했다.
- 이전 메모리 runner 상태만 표시 → 새로고침 후 이전 durable 상태를 찾을 수 없고 빈 runner의 retired가 혼동됨 → exact 이전 ID 조회 전용 화면으로 교체 → 이전 실행 증거를 새 실행 없이 확인하기 위함 → **현행 UI 연결 완료 / 실제 기기 상태 조회 대기**.

### 2. 유지한 계약·금지 경계

- DB service/recovery/runner·정리 SQL·계정·동의·기존 사용자 코스·Live Activity는 수정하지 않았다. prepare/create/claim/retire/remove 및 동의/RPC 쓰기 호출을 연결하지 않았다. 없는 namespace를 만들거나 손상 데이터를 수리하지 않는다.
- Auth 전환 세대를 UI가 추적한다. A→B→A 후에도 과거 조회의 currentAppOwner는 null을 반환하므로 서비스의 후속 owner 대조와 UI 표시 모두 실패로 닫힌다. 화면 종료 후 늦은 결과도 폐기한다. 같은 조회 중 연타는 동기 잠금으로 차단하며 자동 재조회/폴링은 없다.
- 반환은 allowlist 상태·phase·boolean·비음수 건수만 표시한다. pendingRequests>0이면 pending 우선이다. 추가 필드/원문 오류는 표시하지 않는다. 토큰·비밀번호·관리자 자격정보·owner·payload를 화면/로그/파일로 내보내지 않는다.
- 운영 조회/원격 쓰기·삭제/새 runner 실행/추가 배포/Simulator/실기기 조작/stage/commit/push는 하지 않았다. 운영 executionId나 operator baseline 파일을 읽거나 문서에 복사하지 않았다.

### 3. 검증 결과

- 구현 전 신규 화면 fixture 3개가 파일 부재로 실패함을 확인한 뒤 구현했다.
- 화면 3 + 기존 DB recovery 4 = 집중 **7 PASS**. 단일 inspect 인자, 신규 runner 금지, 중복 탭, 안전한 요약, pending, missing/손상/실패 보존, Auth A→B→A/화면 종료 뒤 늦은 결과 폐기, 일반 빌드 비노출을 검증했다. DB fixture는 missing 무생성·정확 읽기·비밀/쓰기 부재를 확인한다.
- `npm run test:typecheck`: PASS. `npm test`: **274 PASS / 0 FAIL**.
- iOS 번들 export PASS: `/private/tmp/timefit-c-recovery-export`. 로그 `/private/tmp/timefit-c-recovery-export.log`. 실제 기기 조회 결과와 구분한다.
- `npm run test:ui`: **584 PASS / 1 기존 SKIP / 0 FAIL**(총585). 로그 `/private/tmp/timefit-c-recovery-ui.log`, 전체 로그 `/private/tmp/timefit-c-recovery-all.log`. IPC 권한 제한으로 UI 테스트 시작이 차단되어 승인된 권한으로 재실행했다.

### 4. DB 다음 조치·미확인

- 연결 완료 후에만 DB 담당이 이전 executionId를 로컬로 전달하고 위 화면/버튼으로 조회 1회를 안내한다. 새 준비·실행·새로고침 반복이나 과거 오류 기억을 요구하지 않는다. 상태 요약만 받아 기존 manifest의 원격 결과와 대조한다.
- 실제 기기의 이전 namespace 상태는 이번에 조회하지 않았다. DB의 이전 exact 완료0/표본0 관찰을 호출0/미실행 증거로 확대하지 않는다. C 저장·owner 조회·추천 반영·종료·관리자 정리 성공 여부는 계속 별도 미확인이다.
