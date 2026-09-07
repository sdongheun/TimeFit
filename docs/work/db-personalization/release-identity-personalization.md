# DB-RELEASE-IDENTITY-01 — 출시 계정·기록 격리 선행 작업

## 현재 보완 명령 — 공유 잠금과 cold 소유권 조회 (2026-09-07)

상태: **DB 보완 구현·집중 검증 완료, 통합 수락 및 UI B 잔여 연결 대기**. 최신 구현 계약은 바로 아래 “공유 잠금·cold 소유권 완료 인수인계”다. 이전 세 보완 수락은 유지한다. 이번 문제는 UI 연결 중 추가로 드러난 공유 잠금 및 조회 계약 공백이다. 기존 구현을 재작성하거나 새 작업 ID로 분리하지 않는다.

### 근거와 현행 경계

- 이전: 완료 함수의 원격 sync를 분리했으나 begin/capture가 동일 storage 직렬화 구간에서 인증·동의·generation 원격 조회를 기다린다 → UI lifecycle 진단에서 capture 무응답이 필수 local 완료를 막음 → 네트워크 대기와 짧은 저장 commit을 분리 → 선택 기능 장애가 완료 저장을 막지 않기 위함. 상태: 보완 구현 전.
- 이전: begin은 snapshot이 없으면 새로 생성하고 UI owner proof는 메모리에만 있음 → cold active의 소유 확인을 위해 begin을 쓰면 과거 run 소급 귀속 위험 → 생성 없는 readonly 조회/안전 복구 계약 제공 → 다른 계정 진행 삭제와 과거 표본 승격 방지. 상태: 보완 구현 전.
- 재현 기준: UI 문서 “B 수락 후 연결 인수인계” 및 `test/ui/owned-course-lifecycle.test.ts`의 `DB handoff diagnostic`을 읽는다. 이 진단 PASS는 결함 관찰이지 합격이 아니다. UI 파일은 DB가 수정하지 않고 동등한 기대 성공 fixture를 DB 소유 테스트에 추가한다.

### 1. 공유 잠금 보완

1. 기존 공개 runtime에서 unresolved consent와 무관한 완료 기록 저장이 막히는 실패 fixture를 먼저 작성한다. begin의 identity/generation 무응답, 다른 run의 완료도 포함한다.
2. 직렬화 구간에는 짧은 storage read/commit만 둔다. 원격 조회는 밖에서 수행하고 결과 commit 때 최초 owner, run/stop/event identity, revision/epoch, reset/delete/terminal 상태를 재검증한다. 늦은 응답이 삭제 run을 부활시키거나 null/미확정 적격성을 소급 승인하면 안 된다. 단순 lock 제거로 동시 read-modify-write 유실을 만들지 않는다.
3. begin 자체가 미해결이면 UI `complete`가 starts Promise를 기다리는 현재 구조도 인계한다. 원격으로 검증할 수 없는 신규 run의 필수 local 저장을 보장할 명시 계약을 제공하되, 임의 guest/account 귀속·기존 owner 변경은 금지한다. 저장 성공 합성이나 무한 대기를 허용하지 않는다. 안전한 unverified 보존 등 기존 승인 경계를 재사용하고 UI가 await할 entry와 비차단 entry를 구분한다.
4. 학습 적격성 응답을 기다리지 않고 완료된 경우의 처리도 명시한다. 당시 근거가 확정되지 않은 표본은 제외하고 뒤늦은 현재 동의로 채우지 않는다. 기존 local 완료→cleanup→별도 sync와 7일/32건·180일·방문 ack 선행은 유지한다.

### 2. cold 소유권 readonly/복구 보완

1. 새 공개 조회 entry는 stable courseRunId로 기존 snapshot만 조회하고 생성·동의 조회/캡처·원격 쓰기를 하지 않는다. found/not_found/corrupt/unavailable 및 필요한 owner match/cleanup proof를 정확한 타입으로 정의해 실제 production export로 인계한다. 임의 타 계정 정보 노출을 최소화한다.
2. guest/account A/B/unverified, 기존 run 존재/없음, 손상, cold restart를 구분한다. not_found를 begin으로 자동 복구하거나 현재 사용자로 귀속하지 않는다. missing run의 local 완료 보존과 학습 제외에 적용할 기존 정책/한계를 구체적으로 인계하고, 새로운 사후 귀속 정책이 필요하면 임의 구현하지 않는다.
3. UI가 계정 기록 삭제/탈퇴 후 exact active cleanup에 사용할 proof와 수명을 명시한다. 단순 readonly 조회 결과는 원자적 삭제 권한 증거가 아니므로 조회 후 계정 변경/코스 교체를 다시 검증한다. 삭제 전 필요한 proof를 캡처해 서버 성공 후 local snapshot이 없어져도 다른 run을 지우지 않게 한다. unknown 삭제 응답을 성공으로 합성하지 않는다.

### 합격 fixture·인수인계

- consent Promise 해제 **전** 같은 run local 완료 성공, 원격 visit/sample 0. begin 원격 무응답 중에도 필수 local 완료의 관찰 가능한 반환과 저장을 확인한다. 다른 run 완료도 막히지 않는다.
- 늦은 capture와 complete/reset/off/delete/account 전환의 모든 핵심 순서: owner 덮어쓰기0, 삭제 부활0, 뒤늦은 학습 승격0, 중복 확인 멱등, 저장 손상 시 성공 합성0.
- readonly found/not_found 각각 storage write0·원격 쓰기0, cold A/B/guest 격리, 조회 후 active 교체/계정 전환 시 잘못된 cleanup0.
- 기존 세 보완과 신규 DB fixture, typecheck/UI/core·diff 검사. SQL 무변경이면 원격/SQL 재작업 불필요; SQL 변경 시 local SQL 회귀 필수.
- 변경 파일/유지 정책/실패→통과/정확한 export·호출 예제·UI 진단 교체 항목을 기록한다. UI/native/engine/data·중앙 문서·운영 DB·commit/push는 수정하지 않는다.
- 병렬 Live Activity 조사는 아래 별도 UI 조사 문서를 참조만 한다. 새 receipt/동의 증거 계약은 통합 확인 전 이번 DB 작업에 추정 구현하지 않는다. 기존 두 보완과의 계약 접점만 조기에 인계한다.

## 공유 잠금·cold 소유권 완료 인수인계 — 2026-09-07

### 1. 변경 파일 / 원인·교체 이력

- `src/services/releaseIdentityPersonalizationRuntime.ts`: 이전 begin/capture의 storage lock 안 원격 대기 → 같은 run과 다른 run 필수 완료까지 정지 → 짧은 준비/commit만 직렬화하고 identity/generation/consent는 잠금 밖으로 이동했다. commit에서 공유 storage port의 변경 revision과 처음 읽은 전체 envelope를 비교하고 최신 run/owner/stop/event·동의 epoch/revision·완료 기록을 확인한다. 삭제된 run은 `not_found`, 충돌한 begin은 `stale`로 끝나며 예전 envelope를 덮어쓰지 않는다. 실패한 write 시도도 revision을 증가시켜 부분 저장 뒤 늦은 승인을 막는다. 상태: **구현·DB fixture 검증**.
- capture는 네트워크 전에 동일 envelope에 event와 `eligibility:null`을 예약한다. **예약한 동일 호출만** 변경 없는 commit에서 승인할 수 있다. 중복/cold 호출은 기존 null을 그대로 반환한다. 완료·reset/off·삭제·다른 저장·Auth 변경이 끼면 승인하지 않는다. 당시 증거가 미확정인 표본을 현재 동의로 다시 만드는 방식은 철회했다. local 완료 metadata write가 실패해도 실제 owner 완료 repository를 재확인하여 승인하지 않는다.
- `preserveUnverifiedCourseRun`, `readCourseRunOwnership`, `canCleanupCourseRun`을 실제 runtime에 추가했다. 기존 owner envelope/repository를 재사용하며 새 영구 소유권 저장소·receipt·보유기간·migration은 만들지 않았다.
- `src/services/releaseIdentitySupabase.ts`: 아래 신규 alias를 production runtime에 연결했다. 실제 `supabase.auth.onAuthStateChange`의 동기 callback이 pending capture와 메모리 cleanup proof를 무효화한다. 실제 consent set/reset remote는 공통 `withCourseRunCaptureInvalidation`으로 감싸 호출 시작과 resolve/reject 모두에서 pending capture를 무효화한다. fixture도 같은 wrapper를 실행한다. Auth callback 안에는 원격 조회/await가 없다.
- `test/release-identity-lock-ownership.test.ts`: 실제 repository·identity resolver·runtime factory를 메모리 storage, 고정 시각, 제어 가능한 Promise와 조합한 18개 fixture다. 기존 UI diagnostic과 동등한 성공 기대를 DB 소유 파일에 추가했으며 UI fixture/파일은 수정하지 않았다.

### 2. 유지 계약 / 정확한 export·입출력

모든 UI용 함수는 `src/services/releaseIdentitySupabase.ts`에서 import한다. 타입은 `releaseIdentityPersonalizationRuntime.ts`의 `CourseRunOwnershipViewer`, `ReadCourseRunOwnershipResult`, `CourseRunCleanupProof`를 사용한다.

| export | 입력 | 반환·실패 및 부수효과 |
| --- | --- | --- |
| `beginOwnedCourseRun` | `{courseRunId:string}` | 기존 `{status:'captured',snapshot}` / `invalid_input` / `storage_corrupt` / `storage_unavailable`에 `stale` 추가. 실제 **새 시작**에서만 호출한다. 원격 미응답으로 Promise가 남을 수 있지만 storage 잠금은 점유하지 않는다. 기존 snapshot은 불변 반환, stale은 성공/생성으로 합성하지 않는다. |
| `captureOwnedStopEligibility` | `{courseRunId,stopOrdinal:1\|2,confirmationEventId}` | `{status:'captured',eligibility:DwellEligibilitySnapshotV1\|null}` 또는 `invalid_input` / `not_found` / `conflict` / `storage_corrupt` / `storage_unavailable`. null은 학습 승인 아님. 동일 event 재호출로 null을 승격하지 않는다. 다른 event로 같은 stop을 바꾸면 conflict. 원격을 기다릴 수 있으므로 필수 완료에서 await하지 않는다. |
| `preserveUnverifiedOwnedCourseRun` | `{courseRunId:string}` | local-only `{status:'captured',snapshot}` 또는 `invalid_input` / `storage_corrupt` / `storage_unavailable`. 기존 snapshot은 그대로 반환한다. 없으면 오직 `unverified:<courseRunId>`로 generation/eligibility=null인 snapshot을 저장한다. identity·consent·원격 write 0. **이 응답 자체는 완료 기록 저장 성공이 아니다.** |
| `readOwnedCourseRunOwnership` | `{courseRunId:string,viewer: {kind:'account',subject:string}\|{kind:'guest'}\|{kind:'unverified'}}` | `{status:'found',courseRunId,ownerKind:'account'\|'guest'\|'unverified',ownerMatch:boolean,cleanupProof:CourseRunCleanupProof\|null}` 또는 `{status:'not_found'\|'corrupt'\|'unavailable'\|'invalid_input'}`. storage write·Auth/consent/network 호출 모두 0. 상대 계정 subject/key/방문/eligibility를 반환하지 않는다. account 일치일 때만 process-local proof를 준다. |
| `canCleanupOwnedCourseRun` | `{proof:CourseRunCleanupProof\|null,currentSubject:string\|null,activeCourseRunId:string\|null}` | 동기 boolean. 같은 runtime이 발급한 실제 proof 객체, 현재 account subject, exact active run, Auth context revision이 모두 맞아야 true. 위조·JSON 복원·다른 runtime proof는 false. 저장·삭제·원격 호출 0. |

`viewer`는 **이미 확인한 UI 표시용 identity context**이지 서버 인증이나 삭제 권한이 아니다. 정상 missing_session/anonymous에만 guest를 전달한다. 인증 오류에서 guest를 합성하지 않는다. null/손상/missing을 account 매칭으로 해석하지 않는다. proof는 `{courseRunId}`만 공개하고 소유 subject/context는 WeakMap에 보관한다. 삭제 전 조회된 proof는 해당 owner local snapshot이 삭제돼도 같은 Auth context 안에서 유효하나, 계정 변경/로그아웃/재인증 이벤트·runtime 재생성에서 무효다. UI는 한 삭제 작업의 메모리 안에서만 보관하고 완료/실패 후 폐기한다.

이전 세 보완의 `completeOwnedCourseRun` local 성공 union, `retryOwnedCourseRunSync`의 visit/sample 분리 상태, `readPendingOwnedCourseRunSyncs` 계약은 그대로다. owner/generation/epoch, guest 명시 import·legacy 비승격, visit ack→sample, 7일 정확 경계/32건 terminal 비재등록, 서버 180일·민감필드 금지도 유지했다. 아래 이전 인계의 “begin→capture 순서대로 호출”은 **완료가 그 Promise를 기다린다는 뜻으로 사용하지 않으며**, 다음 순서로 보완한다.

### 3. 실패 우선 / 실행 결과

- 첫 실행 **4 FAIL / 0 PASS**: unresolved capture 중 같은 run 완료 미반환, begin identity/generation 무응답 중 다른 run 완료 미반환, readonly export 부재. 구현 후 같은 fixture 통과.
- 후속 mutation fixture 실행에서 off invalidation wrapper/Auth event entry 부재 **3 FAIL**을 확인하고 production 연결까지 추가했다.
- 마지막 cold duplicate fixture를 완료 이전 응답 순서로 강화해 **1 FAIL**(중복 호출은 null 반환했으나 이전 호출이 나중에 승인)을 추가 재현했다. null을 중복/cold 호출이 관찰하면 이전 pending 승인 revision을 무효화하도록 고친 뒤 통과했다.
- 최종 집중 회귀 **54/54 PASS**, fail/skip 0: 신규 18 + 기존 priority 12/device 8/owned completion 6/dwell 5/account 5. `npx tsx --test test/release-identity-lock-ownership.test.ts test/release-identity-priority-remediation.test.ts test/release-identity-device-flow.test.ts test/release-owned-completion.test.ts test/dwell-storage-contract.test.ts test/release-account-contract.test.ts`.
- `npm run test:typecheck`: PASS. `npm test`: **267/267 PASS**.
- `git diff --check` 및 이번 untracked 4개 파일의 `git diff --no-index --check /dev/null <file>`: whitespace 진단 0. 후자의 exit 1은 신규 파일 차이 존재를 나타낸다.
- `npm run test:ui`: **520 PASS / 1 FAIL / 기존 skip 1**. 실패는 `test/ui/owned-course-lifecycle.test.ts:82`의 DB handoff diagnostic 하나다. 기존 기대 `completed === false`와 달리 consent 해제 전 **true**가 되어 실패한다. targeted 재실행도 다른 4개 PASS/진단 1개 FAIL. UI가 이 결함 관찰 assertion을 성공 기대로 교체해야 하며 전체 UI PASS로 보고하지 않는다.
- 손상·쓰기 실패에서 완료 성공 합성0, capture 중 완료 metadata 실패 후에도 표본0, cold duplicate의 consent 재조회0, 삭제 run 부활0, A→B owner 변경0, readonly write0, replacement/계정전환/위조/cold proof cleanup0을 확인했다. 기존 7일/32건·인증 오류 회귀도 통과했다.
- SQL/UI/native/engine/data·중앙 문서 수정, remote API/DB/배포, stage/commit/push는 수행하지 않았다. SQL 무변경이므로 local SQL 재실행도 하지 않았다. 원격·실기기는 미검증이다.

### 4. UI 호출 순서 / 결정·잔여 위험

1. **새 run 시작만** `beginOwnedCourseRun({courseRunId})`를 비차단 선택 작업으로 시작한다. 도착 이벤트는 stable ID로 capture를 비차단 호출한다. 두 결과를 받아 표시/진단할 수 있지만 `starts`/capture Promise를 필수 완료 앞에서 await하지 않는다. `stale`에 현재 동의로 begin을 자동 재시도하지 않는다.
2. 사용자가 여전히 같은 active run을 명시적으로 마칠 때, `await preserveUnverifiedOwnedCourseRun({courseRunId})`로 로컬 snapshot만 확보한다. 기존 owner는 유지된다. captured가 아니면 저장 실패를 처리하고 성공 cleanup을 하지 않는다. 이어 `await completeOwnedCourseRun(input)` 호출; `status:'completed'`만 실제 필수 기록 성공이다. begin 미해결이어도 이 두 await는 네트워크를 기다리지 않는다.
3. local 완료 성공 → 기존 exact-active/Activity/알림 cleanup → 완료 표시 → 별도 `retryOwnedCourseRunSync`. capture가 미확정이었다면 그 event는 학습 제외, 방문 이력은 유지된다. unverified는 sync `not_applicable`이며 guest/account 화면·import·학습으로 자동 노출/승격하지 않는다.
4. **cold 조회는 읽기만** `readOwnedCourseRunOwnership({courseRunId,viewer})`를 호출한다. `not_found`에 begin/preserve를 자동 호출하지 않는다. 실제 동일 active run에 대한 새 명시 완료에만 2의 unverified 보존을 허용한다. 이미 삭제된 진행·교체된 코스·백그라운드 복구·과거 이력 migration에는 적용하지 않는다. missing만으로 “한 번도 생성 안 됨”과 “이전 삭제됨”은 구분할 수 없으며 새로운 사후 귀속/삭제 복원 정책은 추가하지 않았다.
5. 기록/계정 삭제 전 현재 확인 account와 exact active run을 고정하고 readonly proof를 받는다. 서버의 기존 삭제 함수를 **같은 requestId**로 실행한다. `unknown/unavailable/reauth_required`는 성공 cleanup 조건이 아니다. acknowledged 삭제 및 local cleanup 상태를 분리해서 처리한다. snapshot이 사라질 수 있으므로 proof는 삭제 전에 확보한다.
6. 서버 성공 후 UI의 기존 **exact-active compare-and-clear 경계 안에서** 최신 subject와 active courseRunId를 다시 읽어 `canCleanupOwnedCourseRun`을 동기로 검사한다. boolean을 얻은 뒤 await하거나 무조건 전체 active를 지우지 않는다. native/알림에도 같은 exact run을 전달하고 각 비동기 단계 뒤에는 active 교체·Auth scope를 다시 검사한다. 조회 결과 하나는 원자적 삭제 권한 증거가 아니다.
7. 자체 탈퇴 후 signOut은 가능하면 성공한 exact cleanup 다음에 한다. Auth 이벤트가 먼저 왔거나 다른 account로 바뀌면 proof는 false이며 cleanup 성공을 합성하지 않는다. 이미 삭제된 account의 자동 로그아웃 이후까지 proof를 연장하는 권한 정책은 구현하지 않았다. UI는 이 경우 안전한 잔여 진행 안내/재확인으로 인계하고 타 계정 active를 지우지 않아야 한다.
8. boot/foreground 서버 재시도는 종전 `readPendingOwnedCourseRunSyncs` 결과만 사용한다. UI B가 완료 앞의 `await starts`를 제거하고 새 readonly/proof entry를 소비하기 전까지 전체 연결/출시 완료로 승격하지 않는다. 진단 교체 fixture에는 같은 run 완료 전 원격 0, begin unresolved+명시 unverified 보존, cold mismatch/missing, 삭제 응답 후 active 교체와 계정 전환을 넣는다.

revision fence는 같은 production storage port에 공유되는 보수적 충돌 경계다. 다른 run 저장도 outstanding begin을 `stale`로 만들거나 미확정 표본을 제외할 수 있지만 필수 기록은 유실하지 않는다. 이를 더 세밀한 per-run 동시성으로 최적화하거나 여러 독립 프로세스가 같은 key를 쓰게 하는 변경은 이번 범위가 아니다. 네트워크 지연은 분리했으나 실제 로컬 storage 자체가 영원히 응답하지 않는 장애에 완료 성공을 합성하지는 않는다.

## 최우선 보완 — 완료 응답·표본 재등록·인증 오류 (2026-09-07)

상태: **DB 세 보완 통합 수락·UIUX B 연결 실행 가능·원격 검증 전**. [통합 수락 기록](../integration-decision/release-personalization-wave.md#db-세-보완-통합-수락--2026-09-07): 실제 코드와 집중36/36·typecheck·diff 검사를 확인했다. 아래 30/30 당시 결함은 보완 전 이력이며 재작업 명령이 아니다. 현재 계약은 “최우선 보완 완료 인수인계”다.

### 관찰과 교체 이유

1. 이전 방식: `completeCourseRun`이 local 저장 후 `await syncRun()`을 반환한다. 문제: local 성공을 먼저 반환한다는 인수인계와 달리 원격 지연이 호출자 완료 처리를 막는다. 교체: **필수 local 성공과 원격 동기화 실행/결과를 분리**한다. UI가 local 성공을 확인한 뒤 진행·Activity cleanup을 할 수 있어야 한다. 상태: **교체 완료**.
2. 이전 방식: `syncRun`이 local record에서 매번 표본을 재구성하고 `enqueue`가 새 `queuedAt`을 넣는다. 문제: 7일 만료 또는 32건 상한으로 제거된 표본을 새 대기 항목으로 재생할 수 있다. 교체: **최초 학습 대기 기준과 재시도 가능 여부를 재시작에도 보존**하고 만료·제거를 우회하지 않는다. 방문 기록 보유와 학습 대기는 별개다. 상태: **교체 완료**.
3. 이전 방식: 실제 Supabase `getSession` adapter가 `error`도 `null`로 반환한다. 문제: resolver가 이를 `missing_session`으로 분류하여 인증 확인 실패를 guest로 취급한다. 교체: **정상적인 세션 없음과 조회 실패를 분리**한다. 상태: **교체 완료**.

### 실행 순서·공개 계약

1. 변경 전 아래 실패 fixture를 기존 공개 runtime 및 실제 production adapter가 재사용하는 경계에 추가한다. 기존 정상 테스트 재실행이나 문자열 검사만으로 해결을 주장하지 않는다.
2. 완료 API는 owner namespace에 필수 기록이 저장된 사실만으로 응답 가능하게 한다. 별도 `retryOwnedCourseRunSync` 등 기존 entry를 재사용해 방문 ack → 체류 submit 순서를 유지한다. 정확한 반환 union과 UI 호출 순서를 먼저 본 절에 기록하고, 실제 exports에 연결한다. 단순 fire-and-forget이나 UI의 무조건 성공 처리로 우회하지 않는다. local 실패면 완료 성공을 반환하지 않으며 remote 실패·프로세스 종료 뒤에는 같은 local 기록과 stable ID로 복구한다. UI가 remote를 기다리거나 별도 DB 저장소를 만들 필요가 없어야 한다.
3. 학습 대기의 최초 기준 시각은 재시도 시각으로 갱신하지 않는다. 기존 7일 경계 연산과 호환을 유지하고, 방문 ack가 오래 지연된 뒤 최초 enqueue되는 경우까지 계약을 명시한다. 만료·상한 제거·철회·삭제 이후 local record에서 대기 표본을 재생성하지 못하게 최소 메타데이터로 처리한다. 별도 영구 receipt·미승인 보유기간·무제한 표본 queue는 추가하지 않는다. local 방문 이력 및 승인된 서버 표본 180일 정책을 7일로 줄이지 않는다. 저장된 최소 메타데이터가 손상되거나 과거 기준을 증명할 수 없으면 학습만 제외하고 방문 완료를 유지한다.
4. `getSession`의 정상 무세션만 null로 전달한다. 오류는 안전하게 `unavailable`로 수렴시킨다. `getUser`도 연결 실패와 검증된 만료/무효 인증을 구분할 수 있는 범위를 조사하고 일관되게 매핑한다. 원시 오류·토큰 로그 금지. 테스트용 resolver만 바꾸지 말고 실제 Supabase adapter가 같은 매핑을 사용하게 한다. 인증 실패 run의 기존 unverified 정책을 유지하고 guest/account 자동 귀속 금지.
5. runtime 동기화 결과는 방문 저장 성공과 표본의 대기/제외/실패를 구분하여 인계한다. 제출 실패가 있는데 모두 전송 완료라고 오해할 상태를 UI에 제공하지 않는다. 기존 owner/generation/epoch 및 account A/B 격리를 약화하지 않는다.

### 필수 재현 fixture와 합격값

- **원격 무응답**: 외부 write를 임의로 resolve하지 않는 deferred Promise로 둔다. 원격을 풀기 전 local 완료 응답과 namespace 기록을 확인한다. 이후 별도 sync 중에도 완료를 되돌리지 않으며 ack 이전 sample 호출 0. 실제 시간 sleep에 의존하지 않는다.
- **local 저장 실패**: 완료 성공 0, 원격 방문/표본 호출 0.
- **재시작**: local 완료 직후 종료한 runtime을 같은 storage로 복원하고 동일 ID sync가 수렴한다. 중복 방문·표본 증가 0.
- **7일 경계**: 최초 기준 전후 7일-1ms / 정확히 7일 / 7일+1ms를 고정 clock으로 검사한다. 기존 경계 포함 여부를 명시하고 승인 없이 바꾸지 않는다. 만료 뒤 반복 sync와 cold restore에서도 queuedAt 갱신·표본 재등록 0.
- **상한**: 33개 학습 대기 생성 뒤 제거된 항목을 local record로 재시도해도 부활 0; 방문 기록 33개는 보존한다. reset/off/delete 이후 재시도도 새 표본 0.
- **방문 ack 지연**: 학습 대기 허용 기한이 지난 뒤 방문 ack가 성공해도 방문은 저장하되 표본을 새 7일로 생성하지 않는다.
- **실제 adapter 인증 분기**: `{session:null,error:null}`만 guest, 세션 조회 오류/throw는 unavailable. 기존 guest 기록이 있어도 오류 입력으로 guest 조회·import·귀속 0. 정상 account/anonymous/만료 회귀 유지.

### 범위·검증·인수인계

DB services/repository와 관련 테스트 및 DB 인수인계만 수정한다. UI/native/engine/data·운영 DB/원격 migration·Edge 배포·commit/push는 금지한다. 기존 분리 구현을 되돌리거나 SQL을 불필요하게 재작성하지 않는다.

집중 신규 fixture와 `npm run test:typecheck`, `npm test`, `npm run test:ui`, `git diff --check`를 실행한다. SQL을 바꾸면 disposable local SQL 회귀도 필수다. 실행하지 않은 원격·실기기 게이트는 미검증으로 남긴다.

인수인계에는 (1) 변경 파일·원인별 수정 (2) 유지한 정책과 정확한 새 반환 계약 (3) 실패 재현→통과 및 테스트 수 (4) UI가 호출할 local 완료→cleanup→별도 sync/재시작 순서와 잔여 위험을 남긴다. 과거의 “local 성공을 먼저 반환” 문구는 당시 코드와 불일치했던 기록임을 표시하고 최신 계약으로 명시적으로 대체한다. 세 항목 수락 전 UI B 전체 연결 완료/출시 완료로 승격하지 않는다.

## 최우선 보완 완료 인수인계 — 2026-09-07

### 1. 변경 파일·원인별 수정

- `src/services/releaseIdentityPersonalizationRuntime.ts`: 이전 `completeCourseRun → await syncRun` 결합을 제거했다. owner local 완료와 run/stop 학습 기준 저장까지만 끝낸 뒤 즉시 반환하며 원격 호출은 0회다. 기존 `retryCourseRunSync`가 방문 ack 뒤에만 표본을 제출한다. 재시작 때 UI가 별도 run ID 저장소를 만들지 않도록 `readPendingCourseRunSyncs()`를 추가했다.
- 같은 owner envelope의 stop에 최소 `learning { firstEligibleAt, state }`를 추가했다. `state`는 `pending | queued | submitted | expired | evicted | discarded`이며 최초 기준은 local 완료 때 `min(record.completedAt, now)`로 한 번만 고정한다. 기존 envelope에 이 필드가 없으면 `null`로 읽고 완료 record의 원래 시각으로만 보완하므로 재시도 시각으로 7일을 갱신하지 않는다.
- `src/services/dwellPersonalizationOutbox.ts`: `enqueue(item, { firstQueuedAt })`가 최초 기준 시각을 보존하고, 정확히 7일은 포함하며 7일+1ms부터 `expired`를 반환한다. 32건 초과 시 `evictedCompletionEventIds`를 반환하고 실제 outbox write 전에 runtime의 owner envelope를 `evicted`로 닫는다. 중간 종료나 write 실패에서도 제거된 표본을 local 방문 기록으로 다시 만들지 않는다.
- `src/services/accountIdentity.ts`, `releaseIdentitySupabase.ts`: production이 직접 사용하는 `createSupabaseAccountAuthPort(supabase.auth)`를 추가했다. `{session:null,error:null}`만 정상 무세션이고 `getSession` error/throw는 `unavailable`이다. `getUser`의 검증된 401/403·`bad_jwt/session_not_found/user_not_found`만 `session_expired`, 그 밖의 연결/저장 오류는 `unavailable`이다. 원시 오류·token은 반환하거나 기록하지 않는다.
- `test/release-identity-priority-remediation.test.ts`, `release-identity-device-flow.test.ts`: 원격 미해결 Promise, local 실패, cold restart, 7일-1ms/정확히 7일/+1ms, 늦은 방문 ack, 33건 상한, off/reset, 실제 Supabase adapter 오류와 기존 guest fallback 금지를 고정 입력으로 검증했다.

### 2. 유지 정책과 정확한 공개 반환 계약

- owner key, account generation, run/stop consent epoch·revision, guest/legacy 명시 import, account A/B 격리와 삭제 tombstone은 유지했다. 방문 기록 자체에는 7일/32건 제한을 적용하지 않고 account owner local repository의 기존 최대 1000건을 유지한다. 서버 표본 180일 정책과 migration 015/016도 변경하지 않았다.
- `completeOwnedCourseRun(input: CompleteCourseInput)` 성공은 `{ status:'completed', localStatus:'created'|'already_completed', record, sync:{status:'pending'|'not_applicable'}, learning:{status:'recorded'|'excluded_storage_failure'} }`다. account는 `pending`, guest/unverified는 `not_applicable`이다. local 입력/저장/손상 실패는 완료 성공이 아니며 `sync.status:'not_started'`; 어떤 경우에도 이 함수가 원격 방문·표본 호출을 시작하지 않는다.
- `readPendingOwnedCourseRunSyncs()`는 현재 검증 account의 완료 record 중 방문 미동기 또는 학습 `pending/queued` run만 `{status:'ok',courseRunIds}`로 반환한다. 없으면 `empty`; `account_required | session_expired | unavailable | storage_corrupt | storage_unavailable`에서는 빈 ID 배열이며 guest/다른 account fallback이 없다.
- `retryOwnedCourseRunSync({courseRunId})`는 방문 ack 실패 시 기존 top-level `owner_changed | stale_generation | idempotency_conflict | unavailable | storage_* | not_found | local_only`와 `submittedSampleCount:0`을 반환한다. 방문 ack 성공 결과는 `{status:'synced', visitStatus:'created'|'already_completed', sampleSync, submittedSampleCount}`다.
- `sampleSync`은 `{status:'submitted'|'pending'|'excluded'|'partial', submittedCount, pendingCount, excludedCount}`다. `pending`은 재시도 가능한 원격/로컬 정리 실패, `excluded`는 미적격·만료·상한 제거·철회/reset·terminal server rejection이다. 제출 실패가 있으면 `submitted`로 표시하지 않는다. `submitted/expired/evicted/discarded`는 terminal이며 local 방문 record가 남아도 다시 `pending`으로 바꾸지 않는다.
- production export는 기존 `completeOwnedCourseRun`, `retryOwnedCourseRunSync`에 더해 `readPendingOwnedCourseRunSyncs`를 `src/services/releaseIdentitySupabase.ts`에서 제공한다. identity는 기존 `supabaseAccountIdentityResolver` 이름을 유지하지만 내부 adapter가 정상 무세션과 오류를 구분한다.

### 3. 실패 재현→통과와 검증 결과

- 실패 우선 최초 실행: `completeOwnedCourseRun`이 실제 `synced/submitted`까지 기다려 기대 `pending`과 불일치, 33번째 enqueue가 제거 event ID를 반환하지 않음, production용 Supabase Auth adapter 부재로 **3/3 FAIL**을 확인했다.
- 구현 후 집중 회귀: `npm run test:typecheck` **PASS**; 최우선 fixture와 기존 identity/device/dwell/account owner 계약 **36/36 PASS**, fail/skip 0.
- `npm test`: **262/262 PASS**, fail/skip 0. `npm run test:ui`: **510 PASS / 기존 skip 1 / fail 0**.
- `git diff --check`와 신규 파일 `--no-index --check`: whitespace 진단 0.
- SQL은 수정하지 않아 disposable SQL을 재실행하지 않았다. 원격 Supabase/운영 데이터/실기기 실행은 0회이며 미검증 게이트로 남긴다.

### 4. UIUX 호출 순서와 잔여 위험

1. 기존 순서대로 `beginOwnedCourseRun`과 stop별 `captureOwnedStopEligibility`를 호출한다.
2. 명시 코스 완료 시 `await completeOwnedCourseRun(input)`만 호출한다. `status:'completed'`를 받은 즉시 화면 완료·진행/Live Activity cleanup을 수행한다. `sync.status:'pending'`은 서버 완료가 아니라 별도 동기화 필요 표시다. local 실패면 완료 UI로 전환하지 않는다.
3. cleanup 뒤 `retryOwnedCourseRunSync({courseRunId})`를 별도 작업으로 실행한다. 이를 `completeOwnedCourseRun` 내부 fire-and-forget으로 되돌리지 않는다. 앱 종료는 local 완료를 훼손하지 않는다.
4. 로그인 account의 앱 시작/foreground 복구에서는 `readPendingOwnedCourseRunSyncs()`가 준 ID만 순차 재시도한다. UI는 별도 owner/outbox/run 목록을 만들지 않고, `pending/partial`은 다음 복구 기회에 유지하며 `excluded`를 오류 팝업이나 방문 기록 삭제로 해석하지 않는다.
5. Auth 결과가 `unavailable`이면 guest 화면/기록/import로 fallback하거나 새 guest owner를 만들지 않는다. 재시도 가능한 인증 확인 상태로 유지한다. `account_required.reason:'missing_session'|'anonymous'`만 정상 비회원 흐름이다.

잔여 위험은 Auth SDK가 새로운 무효-session error code를 추가할 경우다. 현재 401/403과 알려진 세 code만 만료로 좁게 분류하고 나머지는 `unavailable`로 fail-closed한다. UIUX B 전체 연결과 출시 완료 승격은 본 반환 계약 수락 및 실제 lifecycle fixture 연결 뒤에만 가능하다.

## 최신 수락 전 보완 — 기기 소유권·진행 적격성 연결 (2026-09-07)

상태: **지금 실행 가능**. 이전 B/DB-DWELL 로컬 검증 결과는 보존하지만 UI B 인계에서 필수 소비 경계 누락이 확인됐으므로 전체 수락 전이다. 기존 작업을 이어서 보완하며 같은 목적의 schema/repository를 새로 중복 구현하지 않는다.

### 근거·수정 범위

- courseCompletionRepository의 record/store는 owner 없는 단일 기기 목록이다. account owner snapshot 저장만으로 guest/local 계정 기록 조회·분리를 해결하지 못한다.
- releaseIdentitySupabase의 owner/import JSON store는 별도 key다. cold restore에 사용할 run/stop 동의 적격성·소유 기록 source 조회/삭제 orchestration이 공개되지 않았다.
- UI B는 적격 표본 read→추천 연결만 구현했으며 새 완료 write/import/submit은 의도적으로 미연결이다. UI가 자체 namespace를 만들도록 떠넘기지 않는다.
- services/repository/SQL·관련 테스트·본 인수인계만 소유한다. UI/native/engine/data는 변경하지 않는다. 원격 배포·운영 데이터 삭제·commit/push 금지.

### 구현 순서

1. 현재 공개 entry로 account A 완료→guest 조회, import 가능한 source 판별, 재시작 후 eligibility 복원이 불가능한 failure fixture를 먼저 작성한다. 기존 32개 테스트만 재실행해 완료하지 않는다.
2. 기기 owner-scoped 완료 저장·조회·삭제, import source의 승인 전 read, immutable run owner·run/stop eligibility 저장/복구를 하나의 DB 소유 서비스 경계로 제공한다. 실제 export 이름·파일·DTO·오류를 먼저 이 문서에 명시하고 구현된 releaseIdentitySupabase export로 UI에 인계한다. 함수명만 제안하고 composition 미연결로 끝내지 않는다.
3. 기존 CompleteCourseInput/CourseCompletionRecordV1의 의미와 stable completionId/courseRunId는 재사용한다. owner는 별도 검증 envelope/namespace 등 최소 호환 확장으로 관리하고, 구형 owner 없는 기록은 legacy_unassigned로 유지한다. current user를 읽어 과거 record에 덮어씌우지 않는다. guest/accountA/accountB/legacy 사이 read fallback 금지.
4. run owner는 최초 캡처 후 같은 run에서 덮어쓰기 불가다. 현재 captureAccountCompletionOwner의 반복 호출로 다른 계정/삭제 generation이 재캡처되는지 확인하고 차단한다. 네트워크 실패를 guest 판정으로 바꾸지 않는다. 인증 확인 불가 상태도 데이터 유실 없이 명시 미확인 소유로 처리할 안전 계약을 인계한다.
5. run/stop eligibility는 같은 owner와 실제 당시 동의 epoch/revision에 한정한다. cold restore나 나중 수신한 Live Activity receipt를 현재 로그인/동의로 소급 승인하지 않는다. native에서 생긴 확인에 당시 적격성을 증명할 수 없으면 local 진행은 유지하되 학습만 제외한다. 검증을 위해 raw 도착/출발·JWT를 새 영구 store/outbox에 복제하지 않는다. UI가 넘길 확인 event identity/순서와 기존 native receipt의 매핑 계약을 인계한다.
6. 필수 local 완료 → account 방문 이력 ack → 그 run/stop의 적격 체류 submit 순서를 재시도 가능한 서비스로 연결한다. migration016의 account_completed 전제와 완료 minute/장소 키 일치를 충족한다. remote 실패로 local 완료·Activity cleanup을 지연/취소하지 않는다. account 방문 이력 대기는 기존 local record에서 복구하고 무제한 중복 queue를 만들지 않는다.
7. outbox32건7일은 체류 표본만 대상으로 한다. 삭제 generation/동의 epoch·owner를 매 재시도 검증하고 서버 이력/학습 삭제 후 재생성 금지. 부분 성공, 응답 유실, 중복 요청, 앱 종료 후 continuation을 같은 ID로 수렴시킨다.
8. guest/legacy import source read는 side-effect free이며 account local 기록을 제외한다. 질문 승인 뒤에만 target binding/claim을 만든다. accepted ID만 source 삭제하고 cleanup 실패는 ack를 복구한다. 완료된 import source의 다른 계정 재사용도 차단한다. 최초 제안 거절은 로그인당 반복 팝업 없이 나중 기록 탭에서 명시 재진입할 수 있도록 UI용 상태를 제공한다.
9. 계정 개별/전체 기록 삭제·reset·탈퇴 후 해당 owner local/outbox/owner snapshot 정리 entry를 제공한다. 진행/알림은 UI 전용 cleanup을 호출할 typed identity/결과를 반환하고 다른 guest/계정을 지우지 않는다.
10. 탈퇴 성공 응답 유실은 deleted라고 합성하지 않는다. 기존 identity 검증으로 확정 가능한 결과와 unavailable/unknown을 구분하고 같은 requestId 재시도/현재 인증 재확인 entry를 제공한다. 영구 receipt나 새 보유기간을 임의 추가하지 않는다. 서버 삭제 확인 불가이면 UI가 “삭제 결과 확인 중”으로 보수적으로 처리할 수 있게 정확한 상태를 인계하며 이 경우를 해결 완료로 쓰지 않는다.
11. 실제 가입 문서 registry의 공개 read entry를 노출한다. 문서 ID/version/URL 일치와 빈/오류 결과를 typed 반환하고 private 정보 조회를 허용하지 않는다. 실제 공개 문서가 없는 것은 production gate이지 reader 구현을 생략할 이유가 아니다.
12. 데이터의 최신 dbClassificationContract와 migration016의 실제 catalog 검증 원천을 대조한다. 카페5곳 exact key/version 누락 때문에 적격 신규 표본이 전부 거절되지 않는지 fixture로 확인한다. 원격 catalog 변경은 이 작업에서 하지 않는다.

### 완료 기준·인수인계

실제 production composition+주입 storage/identity/remote를 통한 다음 단일 흐름을 증명한다: A 소유 run→명시 도착/출발→local 완료→server 방문 ack→sample submit→read→기존 엔진3개 적용. guest/import 학습0, A logout/B 비노출, cold restore/손상/동시 read-modify-write, source claim 재이관0, reset/delete 후 재전송0을 포함한다.

기존 신규 entry마다 입력/성공/실패/call order/실제 export 경로/소비 예제를 인계한다. 메모리 mock만 있고 AsyncStorage adapter가 연결되지 않으면 완료 아님. 집중 테스트·typecheck/UI/core·local SQL regression을 실행하고 remote/실기기 미검증을 구분한다. UI가 더 만들 DB storage가 없다는 checklist를 마지막에 남긴다.

상태: **2026-09-07 B 확정 범위와 후속 DB-DWELL-01 로컬 구현·격리 검증 완료, 통합/UI 연결·원격 적용 전**. A의 계정/guest 격리·명시 import·별도 학습 계약을 재사용했다. 과거 A/B 잠금 문구는 당시 이력이다.

## B 실행 승인·계약 보완 — 2026-09-07

부모 결정: DEC-RELEASE-DATA-LIFECYCLE-01 및 닉네임/재인증 후속 승인. A의 전체 초안을 무조건 승인한 것이 아니라 다음 확정 범위와 안전 조건으로 구현을 진행한다.

### 이번 명령

1. A 조사/fixture를 재사용해 실패하는 실행 테스트부터 만들고 B 계정·기록 격리/삭제/가입 동의/나이 신규 수집 제거를 구현한다. 원격 migration·계정 삭제·메일 발송은 하지 않는다. 기존 migration을 덮어쓰지 말고 후속 migration을 추가한다.
2. 닉네임은 선택 입력, canonical profiles.nickname 하나, 중복 허용, trim 후 1~20 Unicode code point, 줄바꿈/제어문자 금지. 미설정 null과 명시 삭제 null을 지원한다. 가입 성공을 닉네임 입력에 종속하지 않는다.
3. 삭제는 서버 검증 identity와 실제 최근 10분 내 비밀번호 재인증 근거를 사용한다. JWT iat/refresh/클라이언트 재인증 boolean을 근거로 대신하지 않는다. 공식 Auth 계약을 확인해 검증 가능한 방식과 10분 경계/위조/refresh 반례를 명시한다. 증명이 불가능하면 재인증 구현만 차단·대안을 반환하고 RLS/기록 구현은 계속한다.
4. guest/legacy 이력은 자동 귀속하지 않는다. import 승인 후 서버 acknowledgement에 포함된 source만 삭제하고 응답 유실/부분 실패/계정 변경에 재실행 가능하게 한다. 소유자 없는 기존 원본은 유지한다. 같은 source가 다른 계정에 재이관되지 않도록 local claim과 server 멱등 경계를 문서화한다.
5. account 완료 writer의 현 초안은 UI record만으로 생성 당시 account 소유를 증명하지 못한다. 고정 owner snapshot을 확인하는 전용 local boundary를 연결하고 직접 서버 호출/계정 전환 fixture를 추가한다. 사용자 확인 데이터가 GPS 방문 증거인 것처럼 서술하지 않는다.
6. account 기록 삭제 API의 exact entry/type도 추가한다. 개별/전체 삭제와 계정 삭제, 관련 offline 재전송으로 삭제 기록이 복원되지 않는 경계를 정의한다. 해당 계정 local/pending/progress 정리는 UI가 consumer로 구현할 수 있는 typed 결과로 인계한다.
7. 필수 문서 ID/version 검증과 서버 동의 증거는 테스트용 registry를 주입해 구현할 수 있다. 실제 공개 URL/문서 승인이 없으면 production 가입을 활성화하지 않으며 placeholder로 동의받지 않는다. 기존 timestamp는 소급 동의로 승격하지 않는다.
8. 원시 Auth 오류 로그 제거는 UI 인계로 남긴다. UI/AppFlow/AuthContext·엔진·카탈로그는 직접 수정하지 않는다. 테스트 helper/fixture와 서비스 계층 타입은 DB가 소유한다.

### DB-DWELL-01로 넘어가기 전 기술 보완

- 실제 완료 순서와 180일 만료를 위한 최소 완료 시각 계약을 보완한다. submit DTO에는 completedAt이 없는데 read는 completed_at 정렬을 요구하는 기존 초안의 공백을 닫는다. raw 도착/출발 시각 대신 완료 근거의 최소 정밀도를 제안하고, 서버 수신 시각과 분리한다. 미래/만료/순서 역전/재시도 동일 ID·다른 payload를 검증한다.
- 체류 outbox32건7일과 서버180일은 승인값이다. expiry 조회 제외·물리 cleanup·재시도/중복·off/reset epoch 차단을 구현한다. 상한 초과는 학습 대기 표본에만 영향을 주고 완료 이력을 삭제하지 않는다.
- guest import의 별도100건30일은 승인값이 아니다. source를 지우는 자동 만료를 만들지 말고 기존 최대1000건 source와 ID/ack만 보존하는 복구 메타데이터 등 최소 방안을 먼저 인계한다. 이를 체류 outbox의7일로 잘못 만료시키지 않는다.
- 초기화는 raw/profile 삭제+disabled, 일반 off는 신규 수집/새 추천 적용 중단·표본180일 내 유지. 다시 enable 때 이전 pending을 소급 승인하지 않는다. 보유 중 기존 적격 표본과 이전 outbox는 서로 다른 경계다.
- DB B의 검증된 공개 entry/type와 위 변경을 먼저 인계한다. 기존 DB-DWELL-01 확정 부분은 같은 writer가 이어서 구현 가능하나 미확정 기술 대안을 silently production 계약으로 승격하지 않는다. UI B는 안정된 DB 인계 뒤 연결한다.

### 합격·인수인계

기존 A JSON은 준비 자료일 뿐 실행 검증이 아니다. disposable local DB의 A/B/anonymous RLS·삭제 cascade·부분 graph 실패, import 응답 유실/중복, 닉네임0/1/20/21·Unicode, 재인증 만료/위조, 계정 전환·동의 reset race fixture를 실행한다. 집중 테스트와 typecheck/UI/core, diff 검사 결과를 기록한다. DB 도구 미가동/공개 문서 미확정/원격 미적용은 별도 게이트로 명시한다. 실패를 건너뛰어 완료라 하지 않는다.

## 목적·근거·불변
- release-data-audit.md의 anonymous RLS, 자동 동의 timestamp, 계정 삭제 부재, 부분 course 저장을 해결한다.
- 회원 기록은 계정 소유, guest는 기기 기록. guest 가져오기는 명시 승인과 성공 확인 뒤 이동하며 과거 guest 체류 학습은 0.
- UI/AppFlow/AuthContext/엔진/카탈로그/Live Activity native는 수정하지 않는다. DB repository/SQL/RLS/계정 Edge와 해당 테스트를 소유한다.

## A. 단일 공개 계약 — 지금 진행
1. profile-account-contract.md의 기존 entry를 읽고 재사용/변경을 표로 표시한다. 나이 입력 제거가 현행이므로 SignUpInputV2의 birthYear 요구와 birth/age 필수 trigger를 그대로 복원하지 않는다.
2. 다음 entry의 정확한 이름·소유 파일·입출력 union·오류·auth source·재시도·멱등 키를 제시하고 UI 인계를 먼저 남긴다: 가입 문서 검증, profile/계정 삭제, account-owned 완료 기록 read/write, guest import, 체류 consent read/set/reset, 완료 표본 submit/read. 기존 courseCompletionRepository와 엔진 SampleV1을 재사용한다.
3. 계정 소유권을 local namespace와 서버 RLS 모두에 명시한다. account A/B/guest를 이메일이 아닌 검증된 identity로 구분한다. 오래된 계정 비연결 레코드는 로그인 사용자나 guest라고 추정하지 않고 legacy_unassigned로 분류하는 설계를 제안한다. 레거시 귀속 사용자 UX는 승인 요청으로 남긴다.
4. guest import는 성공 acknowledgement 이전 source 삭제 금지, stable import ID, 재시도/응답 유실/계정 전환 중 타 계정 귀속 금지를 정의한다. 방문 이력만 옮기고 과거 guest raw 도착/출발 및 학습 eligibility는 전송하지 않는다. 두 저장소 원자성을 주장하지 말고 복구 가능한 상태/중복 키 계약을 둔다.
5. 소유권·동의의 run/stop eligibility snapshot과 철회 version을 정의한다. guest 시작/계정 변경/동의 전 확인을 나중 로그인으로 소급 승격하지 않는다. 로컬 과거 자료만으로 회원 소유 증거를 합성하지 않는다.
6. 의사결정 필요 목록을 조기 반환한다: 기존 legacy 기록 처리, offline pending 최소 payload/최대 수/보유기간, 서버 기록·표본 retention와 정리, 닉네임 미확정 규칙, 탈퇴 시 local 범위. 각 항목은 권장안/반례/사용자 영향/막히는 구현 단계를 적는다. 임의 production 기본값으로 승격하지 않는다.
7. A 계약과 확정 정책만으로 가능한 RLS/부분 저장 failure fixture 준비를 완료한다. 중앙 수락 전 새 public API/schema를 확정 구현하지 않는다.

## A단계 결과 — 통합 수락 전 공개 계약

이 절의 이름과 타입은 UI·DB가 서로 다른 이름을 추정 구현하지 않도록 만든 **수락 후보**다. 중앙 통합 수락 전에는 production API/schema가 아니며 아래 B와 DB-DWELL-01은 실행하지 않는다.

### 먼저 결정할 항목과 권장안

2026-09-07 후속 승인: [DEC-RELEASE-DATA-LIFECYCLE-01](../integration-decision/release-personalization-account.md)의 1~6이 현행이다. 아래 표는 제안 당시 이력이며 180일/체류 outbox32건7일/legacy 명시 이관/회원 기록 삭제까지 보유/탈퇴 local 분리/초기화 off는 더 이상 미확정이 아니다. 닉네임·재인증10분·import pending100건30일은 아직 미승인이다. B 전체 자동 해제 아님. submit payload의 실제 완료 시각 근거가 빠진 채 completed_at 순서·180일 만료를 주장하지 않도록 최소 시각 계약을 보완하고 통합에 반환한다.

| 결정 | 권장안 | 반례·사용자 영향 | 미확정 시 막히는 단계 |
| --- | --- | --- | --- |
| 기존 계정 비연결 기록 | 현재 `@timefit/course-completions-v1`과 legacy 후기를 모두 `legacy_unassigned`로 분류한다. 로그인 뒤 “이 기기의 이전 방문 기록”을 한 번 안내하고 사용자가 선택한 방문 이력만 가져온다. 소유자를 추정하거나 자동 병합하지 않는다. | 기존 기록이 실제로 account A 시절 생성됐더라도 증거가 없으므로 자동 A 귀속은 B에서 보일 수 있다. 반대로 전부 guest로 단정하면 account 기록을 잘못 공유한다. 가져오기 전에는 기기 이전 기록 영역에만 보이고 어느 account의 추천에도 쓰지 않는다. | local namespace migration, 가져오기 UI, 기존 기록 표시 범위 |
| offline pending 최소 payload·상한·기간 | 체류 표본만 최대 `32건/7일` 보관한다. `completionEventId/courseRunId/stopOrdinal/contentId/category/subCategory/actualDwellMin/ownerSubject/consentEpoch·revision`만 두고 제목·좌표·주소·raw 도착/출발·경로는 금지한다. 방문 이력 import pending은 항목 수 최대 100, 30일 후 자동 삭제가 아니라 사용자에게 재확인한다. | 무제한 queue는 오래된 민감 기록과 타 계정 전송 위험을 키운다. 너무 짧으면 장기 offline 표본이 사라지지만 기본 추천과 방문 완료는 유지된다. | DB-DWELL outbox, account 전환·철회 재생 방지 fixture |
| 서버 방문 기록 보유 | account-owned 방문 이력은 사용자가 개별/전체 삭제하거나 계정을 삭제할 때까지 보유하되, 출시 전에 기록 전체 삭제 entry를 함께 제공한다. | 기간 자동 삭제는 사용자가 기대한 기록을 잃게 할 수 있고, 무기한만 제공하면 통제권이 없다. | account completion delete/read UI와 개인정보 고지 |
| 서버 체류 표본·파생 보유 | raw 최소 표본은 완료 시각 기준 180일 rolling, 파생 profile은 유효 최신 최대 5건에서 재계산하고 마지막 유효 표본 소멸 시 삭제한다. 정리 job은 수락 전 활성화하지 않는다. | 180일은 무기한 보관을 피하지만 사용 빈도가 낮으면 개인화가 기본값으로 돌아간다. 보유기간을 늘리면 그 기간과 삭제 방식을 고지해야 한다. | DB-DWELL migration, cleanup job, 처리방침 |
| 필수 동의 문서 | 실제 공개 URL과 승인 문서 ID/version을 먼저 확정하고 기본 미선택으로 받는다. 기존 timestamp는 `legacy_unverified`이며 새 문서 재동의를 요구한다. | URL/version 없이 구현하면 어떤 문서에 동의했는지 증명할 수 없다. 미확정 상태에서는 production 가입을 차단해야 한다. | 가입 B 전체, 기존 account 재동의 UX |
| 닉네임 | `profiles.nickname` 단일 원천, nullable, NFC→trim→연속 공백 축약 후 1~20 Unicode code point, 제어문자/줄바꿈 거절, 중복 허용, `null`만 명시 삭제로 권장한다. | uniqueness는 별도 조회·충돌·사칭 정책을 만들고 공개 사용자 검색 기능으로 범위를 키운다. 규칙 미확정이면 Profile 저장 UI를 활성화하지 않는다. | profile migration/repository/UI |
| 탈퇴 시 기기 로컬 범위 | 삭제된 account namespace·그 account에 묶인 pending/active/progress/알림은 성공 확인 뒤 지운다. guest와 `legacy_unassigned`는 자동 삭제하지 않고 “이 기기의 모든 기록도 삭제”를 별도 선택으로 둔다. | 서버 삭제만으로 “모든 기록 삭제”라고 표시하면 거짓이고, guest까지 자동 삭제하면 계정과 무관한 기기 기록을 잃는다. 로컬 정리 일부 실패는 재시도 상태로 보여야 한다. | delete consumer 성공 문구·local cleanup orchestration |
| 최근 재인증 | 현재 이메일/비밀번호 방식에는 삭제 요청 전 10분 이내 `signInWithPassword` 성공을 요구한다. 비밀번호는 Edge body에 보내지 않는다. | token refresh는 사용자가 최근 비밀번호를 입력했다는 증거가 아니다. 너무 짧으면 UX 부담, 너무 길면 탈취 세션의 삭제 위험이 커진다. | delete-account Edge와 UI 재인증 |
| 동의 증거 삭제 | 별도 법적 보존 의무가 확정되지 않으면 account 삭제 때 user-linked 필수 동의 증거도 삭제한다. 법적 보존이 필요하면 목적·기간·비식별/분리 저장을 별도 결정한다. | 이유 없는 영구 보존은 삭제 약속과 충돌한다. | delete cascade·처리방침 |

확정된 불변은 별도 결정 대상이 아니다. 신규 가입의 나이 입력/`birth_year`·`age_band` 수집은 제거하고, 일반 account는 검증된 Auth identity이면서 anonymous가 아닌 경우뿐이다. guest 가져오기와 체류 동의는 분리하며, 과거 guest 체류·legacy 합성 체류는 학습 0이다.

### 공통 identity와 로컬 소유권

DB 소유 파일 후보는 `src/services/accountIdentity.ts`다. UI의 `authKindFor` 의미를 재사용하되 DB repository가 `src/ui`에 의존하지 않는다.

```ts
type AccountIdentityV1 = Readonly<{
  kind: 'account';
  subject: string;
}>;

type ResolveAccountIdentityResult =
  | { status: 'account'; identity: AccountIdentityV1; accessToken: string }
  | { status: 'account_required'; reason: 'missing_session' | 'anonymous' }
  | { status: 'session_expired' }
  | { status: 'unavailable' };

resolveAccountIdentity(): Promise<ResolveAccountIdentityResult>
```

- client source는 `supabase.auth.getUser()`로 다시 검증한 현재 user이며 이메일·화면 상태·body `userId`가 아니다. server/RLS source는 검증된 JWT `sub`와 anonymous claim이다. client guard는 DB 신뢰 경계가 아니다.
- read는 unavailable에서 다른 owner namespace나 guest records를 fallback으로 반환하지 않는다. write/delete는 account 외 결과에서 원격 호출 0회다.
- local owner는 `account:<subject>`, `guest:<deviceScopeId>`, `legacy_unassigned` 세 종류다. 이메일을 key로 쓰지 않는다. 기존 V1 key는 자동 account/guest 승격하지 않고 read-only `legacy_unassigned` source로 남긴다.
- run이 시작될 때 owner snapshot을 고정한다. 도중 로그인·로그아웃·account 전환으로 `courseRunId`의 owner를 바꾸지 않으며, guest run은 나중 로그인해도 account 표본으로 소급 승격하지 않는다.

### 가입 문서 검증

DB adapter 소유 파일 후보는 `src/services/accountRegistrationRepository.ts`, UI consumer는 기존 `AuthContext.signUp` 교체 지점이다. `birthYear`는 제거한다.

```ts
type RequiredConsentInputV1 = Readonly<{
  documentId: 'terms-of-service' | 'privacy-policy';
  documentVersion: string;
  accepted: true;
}>;

type SignUpAccountInputV1 = Readonly<{
  requestId: string;
  email: string;
  password: string;
  requiredConsents: Readonly<{
    terms: RequiredConsentInputV1;
    privacy: RequiredConsentInputV1;
  }>;
}>;

type SignUpAccountResultV1 =
  | { status: 'account_session_ready' }
  | { status: 'email_confirmation_pending' }
  | { status: 'rejected'; reason: 'invalid_input' | 'consent_required' | 'document_version_stale' | 'signup_unavailable' }
  | { status: 'retryable_failure' };

signUpAccount(input: SignUpAccountInputV1): Promise<SignUpAccountResultV1>
```

- `requestId`는 한 submit attempt에서 재사용하는 UUID다. UI in-flight mutex와 server evidence unique key로 중복 consent row를 막는다. Supabase Auth의 account uniqueness를 cross-system transaction이라고 표현하지 않으며 응답 유실 뒤에는 세션/이메일 확인 상태를 다시 조회한다.
- 승인된 두 exact document version과 `accepted: true`가 아니면 Auth 호출 0회다. canonical `acceptedAt`은 서버 시각이다. 기존 client timestamp와 trigger의 `now()` 보정은 신규 증거가 아니다.
- 선택 체류 동의는 이 입력에 넣지 않는다. provider 오류·email 존재 여부는 계정 열거를 피하는 `signup_unavailable`로 정규화하고 원시 오류를 기록하지 않는다.

### profile과 계정 삭제

profile은 기존 제안 이름을 그대로 재사용한다. 소유 파일은 `src/services/accountProfileRepository.ts`다.

```ts
type AccountProfileV1 = Readonly<{ nickname: string | null; nicknameUpdatedAt: string | null }>;
type ReadAccountProfileResultV1 =
  | { status: 'ok'; profile: AccountProfileV1 }
  | { status: 'account_required' | 'session_expired' | 'not_found' | 'unavailable' };
type UpdateAccountNicknameResultV1 =
  | { status: 'updated' | 'unchanged'; profile: AccountProfileV1 }
  | { status: 'invalid_nickname'; reason: 'empty' | 'too_long' | 'invalid_character' }
  | { status: 'account_required' | 'session_expired' | 'forbidden' | 'unavailable' };

readAccountProfile(): Promise<ReadAccountProfileResultV1>
updateAccountNickname(input: Readonly<{ mutationId: string; nickname: string | null }>): Promise<UpdateAccountNicknameResultV1>
```

`mutationId` 재시도와 정규화된 동일값 update는 같은 profile 상태로 수렴한다. nickname 외 legacy 동의·birth/age/email 필드 update는 RLS/RPC가 거절한다.

계정 삭제는 기존 `POST /functions/v1/delete-account`, client adapter `src/services/accountDeletionRepository.ts`의 `deleteAccount` 이름을 재사용한다.

```ts
type DeleteAccountResultV1 =
  | { status: 'deleted'; requestId: string; localCleanupRequired: true }
  | { status: 'reauth_required'; method: 'password_sign_in' }
  | { status: 'rejected'; reason: 'account_required' | 'invalid_request' }
  | { status: 'retryable_failure'; stage: 'storage' | 'database' | 'auth' | 'verification' };

deleteAccount(input: Readonly<{ requestId: string }>): Promise<DeleteAccountResultV1>
```

- `requestId`는 최초 확인 때 생성해 응답 유실/재시도에 그대로 쓴다. body에 `userId/email`을 받지 않으며 server가 JWT subject를 유일한 삭제 대상으로 쓴다.
- Auth, public DB, 향후 Storage, 기기 로컬은 하나의 transaction이 아니다. server는 단계별 멱등 상태와 삭제 뒤 user-linked row 0건을 확인하고, client는 `deleted` 뒤에만 해당 account local cleanup을 시작한다.
- `signOut`은 삭제가 아니다. local cleanup 일부 실패는 서버 삭제를 되돌리지 않고 별도 `local_cleanup_pending` consumer 상태로 재시도한다.

### account-owned 완료 기록 read/write

기존 `CourseCompletionRecordV1`, `CompleteCourseInput`, `courseCompletionRepository.complete/read`를 유일한 기기 완료 캡처로 재사용한다. 새 UI 완료 action이나 새 `courseRunId`를 만들지 않는다. 계정 서버 방문 이력용 최소 투영과 owner namespace 조정은 `src/services/accountCourseCompletionRepository.ts`가 소유한다.

```ts
type AccountCompletionPlaceV1 = Readonly<{
  stopOrdinal: 1 | 2;
  contentId: string;
  title: string;
  category: string;
  subCategory: string | null;
}>;

type AccountCourseCompletionV1 = Readonly<{
  completionId: string;
  courseRunId: string;
  completedAtMinute: number;
  provenance: 'account_completed' | 'guest_import';
  learningEligible: false;
  places: readonly AccountCompletionPlaceV1[];
}>;

type WriteAccountCompletionResultV1 =
  | { status: 'created' | 'already_completed'; record: AccountCourseCompletionV1 }
  | { status: 'account_required' | 'session_expired' | 'invalid_input' | 'forbidden' | 'unavailable' };
type ReadAccountCompletionsResultV1 =
  | { status: 'ok' | 'empty'; records: readonly AccountCourseCompletionV1[] }
  | { status: 'account_required' | 'session_expired' | 'unavailable'; records: readonly [] };

writeAccountCourseCompletion(input: Readonly<{ record: CourseCompletionRecordV1 }>): Promise<WriteAccountCompletionResultV1>
readAccountCourseCompletions(): Promise<ReadAccountCompletionsResultV1>
```

- server owner는 JWT subject이며 input은 `userId`를 받지 않는다. `(user_id, course_run_id)`가 멱등 키다. 동일 account 재시도는 기존 row를 반환하고 다른 account의 같은 `courseRunId`는 별도 namespace다.
- `CourseCompletionRecordV1.completedAt`은 기기 캡처 millisecond이고, 서버 공개 투영은 `floor(completedAt / 60_000)`인 `completedAtMinute`다. DB `completed_at`은 이 완료 근거이며 `created_at`/체류 `received_at`과 분리한다. 서버 현재 시각보다 5분 넘게 미래인 완료는 거절한다.
- 방문 이력은 완료 시각과 장소 표시용 필드만 저장한다. `plannedStayMin`, `actualDwellMin`, 좌표·주소·geometry·provider URL·raw 도착/출발·token은 이 table에 넣지 않는다. 학습 표본은 아래 별도 entry만 쓴다.
- 새 account run의 기기 record는 생성 당시 고정한 account namespace에만 저장한다. 원격 read 실패 시 guest/legacy/all-device 기록으로 대체하지 않는다.

### guest 방문 기록 가져오기

소유 파일 후보는 `src/services/guestCompletionImportRepository.ts`다.

```ts
type GuestVisitImportItemV1 = Readonly<{
  sourceCompletionId: string;
  courseRunId: string;
  completedAt: number;
  places: readonly AccountCompletionPlaceV1[];
}>;
type ImportGuestCompletionsResultV1 =
  | { status: 'acknowledged'; importId: string; acceptedSourceIds: readonly string[]; rejectedSourceIds: readonly string[] }
  | { status: 'already_acknowledged'; importId: string; acceptedSourceIds: readonly string[] }
  | { status: 'account_required' | 'session_expired' | 'account_changed' | 'invalid_input' | 'unavailable' }
  | { status: 'blocked'; reason: 'pending_for_other_account' };

prepareGuestCompletionImport(input: Readonly<{ sourceCompletionIds: readonly string[] }>): Promise<Readonly<{ status: 'prepared'; importId: string }> | Readonly<{ status: 'empty' | 'invalid_input' }>>
importGuestCourseCompletions(input: Readonly<{ importId: string }>): Promise<ImportGuestCompletionsResultV1>
finalizeGuestCompletionImport(input: Readonly<{ importId: string; acceptedSourceIds: readonly string[] }>): Promise<Readonly<{ status: 'source_removed' | 'cleanup_pending' | 'account_changed' }>>
```

- `prepare`는 stable UUID `importId`, 선택 source snapshot, 당시 검증된 target subject를 local pending에 먼저 쓴다. pending은 `prepared(targetSubject) → acknowledged(ids) → source_removed`이며 두 저장소의 원자성을 주장하지 않는다.
- server unique key는 `(user_id, import_id)`와 `(user_id, source_completion_id)`다. server body는 target user ID를 받지 않는다. 응답 유실은 같은 account·`importId` 재시도로 동일 acknowledgement를 회수한다.
- acknowledgement 전 source 삭제는 0건이다. 응답 시 현재 subject가 준비 당시 subject와 다르면 source를 삭제하지 않고 `account_changed`; 그 항목은 다른 account import에 사용할 수 없다. 원 account로 돌아와 status를 확인하거나 명시적으로 복구해야 한다.
- import payload는 방문 이력 투영만 포함하며 `actualDwellMin`, `legacyEstimatedDwellMin`, raw 도착/출발, consent/learning eligibility를 전송하지 않는다. server row는 `provenance='guest_import'`, `learningEligible=false`로 강제한다.
- 거절은 source 유지, 부분 수락은 `acceptedSourceIds`만 삭제하고 rejected는 유지한다. local 삭제 실패는 acknowledged state를 보존해 반복 server insert 없이 cleanup만 재시도한다.

### 체류 동의 read/set/reset과 eligibility snapshot

이 이름은 DB-DWELL-01의 유일한 repository에서 구현한다. 소유 파일 후보는 `src/services/dwellPersonalizationRepository.ts`이며 A에서는 만들지 않는다.

```ts
type DwellConsentStateV1 = Readonly<{
  enabled: boolean;
  consentEpoch: string | null;
  revision: number;
  updatedAt: string;
}>;
type DwellEligibilitySnapshotV1 = Readonly<{
  ownerSubject: string;
  consentEpoch: string;
  consentRevision: number;
}>;
type ReadDwellConsentResultV1 =
  | { status: 'ok'; consent: DwellConsentStateV1 }
  | { status: 'account_required' | 'session_expired' | 'unavailable' };
type SetDwellConsentResultV1 =
  | { status: 'updated' | 'unchanged'; consent: DwellConsentStateV1 }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'account_required' | 'session_expired' | 'invalid_input' | 'unavailable' };
type ResetDwellPersonalizationResultV1 =
  | { status: 'reset'; consent: DwellConsentStateV1; deletedSampleCount: number }
  | { status: 'account_required' | 'session_expired' | 'conflict' | 'unavailable' };

readDwellPersonalizationConsent(): Promise<ReadDwellConsentResultV1>
setDwellPersonalizationConsent(input: Readonly<{ requestId: string; enabled: boolean; expectedRevision: number }>): Promise<SetDwellConsentResultV1>
resetDwellPersonalization(input: Readonly<{ requestId: string; expectedRevision: number }>): Promise<ResetDwellPersonalizationResultV1>
```

- `requestId`는 mutation 멱등 키, `expectedRevision`은 stale UI/동시 account action 방지다. enable/off/reset마다 revision을 증가시키며 enable은 새 random `consentEpoch`를 만든다. off와 reset은 epoch를 폐기한다.
- off는 신규 수집과 profile read/apply를 즉시 중단하지만 과거 sample을 자동 삭제하지 않는다. `reset`은 raw/profile을 삭제하고 consent를 disabled로 만든다는 권장안이다. 다시 수집하려면 별도 명시 enable이 필요하다.
- `DwellEligibilitySnapshotV1 { ownerSubject, consentEpoch, consentRevision }`를 run 시작과 각 stop의 도착 확인 시 각각 고정한다. guest/미동의 run은 snapshot이 없으며 나중 로그인/enable로 채우지 않는다. submit은 run snapshot, stop snapshot, 현재 server consent의 subject+epoch+revision이 모두 같을 때만 가능하다.

### 완료 표본 submit/read와 엔진 연결

```ts
type SubmitDwellCompletionSampleInputV1 = Readonly<{
  completionEventId: string;
  courseRunId: string;
  stopOrdinal: 1 | 2;
  contentId: string;
  category: string;
  subCategory: string;
  actualDwellMin: number;
  completedAt: number;
  runEligibility: DwellEligibilitySnapshotV1;
  stopEligibility: DwellEligibilitySnapshotV1;
}>;
type SubmitDwellCompletionSampleResultV1 =
  | { status: 'accepted' | 'already_accepted'; completionEventId: string }
  | { status: 'not_eligible'; reason: 'account_required' | 'consent_off' | 'consent_changed' | 'owner_changed' | 'guest_or_imported' | 'incomplete_measurement' }
  | { status: 'invalid_input' | 'catalog_mismatch' | 'unavailable' };
type ReadDwellSamplesResultV1 =
  | { status: 'ok' | 'empty'; samples: readonly DwellPersonalizationSampleV1[]; snapshotVersion: string }
  | { status: 'not_enabled' | 'account_required' | 'session_expired' | 'unavailable'; samples: readonly [] };

submitDwellCompletionSample(input: SubmitDwellCompletionSampleInputV1): Promise<SubmitDwellCompletionSampleResultV1>
readDwellPersonalizationSamples(): Promise<ReadDwellSamplesResultV1>
```

- `completionEventId`는 기존 completion의 stable `courseRunId + stopOrdinal`에서 한 번 만들고 재시도에 유지한다. server unique key는 `(user_id, completion_event_id)`다. imported/legacy record에는 이 ID를 새로 합성하지 않는다.
- `completedAt`은 raw 도착/출발 시각이 아니라 기존 명시 완료 record의 millisecond 시각이다. repository와 outbox에서 minute로 내림해 전송하며 서버는 이를 수신 시각과 별도 저장한다. 5분 초과 미래, 180일 초과, 같은 ID의 다른 payload를 각각 `invalid_input`, `expired`, `idempotency_conflict`로 거절한다.
- payload에는 positive finite `actualDwellMin`과 승인 최소 메타데이터만 둔다. raw exact 시각·좌표·polyline·제목·provider URL은 금지한다. server는 catalog의 `contentId/category/subCategory`, owner와 consent epoch를 재검증한다.
- read는 동일 account의 적격 표본만 `completed_at ASC, completion_event_id ASC`로 결정 정렬한 뒤 엔진 공개형 `DwellPersonalizationSampleV1 { category, subCategory, dwellMin }[]`로 투영한다. user ID, timestamp, repository, consent 정보를 엔진에 넘기지 않는다.
- 추천 session begin 때 받은 `snapshotVersion`과 samples를 메모리에서 고정하고 continuation에도 재사용한다. 개인 표본을 public continuation/route cache에 직렬화하지 않는다. read 실패/off/empty는 엔진에 `[]`를 주며 기본 추천을 막지 않는다.

### UI 선행 인수인계

UI는 A 통합 수락 전 위 이름을 구현하지 않는다. 수락 뒤에도 다음 순서를 지킨다.

1. 가입은 실제 문서 표시·기본 미선택·동의 검증 뒤 `signUpAccount` 한 번만 호출한다. 나이 입력은 전달하지 않는다.
2. 로그인 성공 뒤 guest/legacy source가 있을 때 import 의사를 한 번 묻되, 가져오기 거절·실패가 로그인이나 기본 추천을 막지 않는다.
3. 방문 이력 가져오기와 체류 동의는 서로 다른 화면/행동이다. 가져오기 성공 문구가 개인화 동의 성공을 뜻하지 않는다.
4. account read 실패는 guest/다른 account 기록으로 fallback하지 않는다. 로그아웃 즉시 account history와 sample 적용을 화면에서 제거한다.
5. 코스 완료의 필수 local `courseCompletionRepository.complete`와 Live Activity cleanup을 먼저 보존한다. 서버 방문 기록/표본 실패는 이 완료를 되돌리지 않으며 동일 ID의 재시도만 예약한다.
6. “맞춤 추천” 표시는 엔진 stop snapshot이 실제 applied일 때만 한다. 표본 수 1/2, missing subCategory, default fallback은 준비 중/기본 기준으로 표시한다.

### A에서 준비한 B failure fixture

`test/fixtures/db-release-identity-a-v1.json`은 실제 이메일·token 없이 account A/B/anonymous/expired identity, RLS 기대값과 부분 course 저장 rollback 기대값을 고정한다. 아직 존재하지 않는 migration/RPC를 문자열로 검사하거나 test를 skip한 것이 아니라, B가 disposable local DB와 주입 repository test에 그대로 소비할 입력/관찰값이다.

- RLS: account A own read/write/update/delete 허용, B가 A parent/stop에 접근 0행, anonymous의 모든 account table/RPC write 0행, expired identity DB 호출 0회, forged `userId` 무시/거절.
- course graph: parent 성공 뒤 stop 또는 leg 실패면 결과 `write_failed`이고 A의 해당 parent/child가 0행이어야 한다. 타 사용자 graph는 전후 동일하다. 응답 유실/같은 `courseRunId` 재시도는 중복 parent가 아니라 동일 결과로 수렴한다.
- 이 fixture의 기대를 충족하는 transaction/RPC와 RLS는 B에서 실패 테스트를 먼저 만들고 구현한다. 현재 `saveCourseToRepository`의 partial success와 anonymous 허용 가능성이 남아 있으므로 A 완료를 기능 PASS로 해석하지 않는다.

## B. A 수락 후 구현
1. account-only 판정을 서버에서 강제한다. auth.uid()만으로 anonymous를 통과시키지 않는다. 회원 테이블/child/RPC와 repository read/write/delete에 적용하고 A/B/anonymous/만료 identity fixture를 실행한다.
2. 가입은 실제 승인 문서 ID/version/명시 입력만 받아 서버 증거를 남긴다. 누락을 now로 보정하거나 legacy timestamp를 동의로 소급하지 않는다. 실제 공개 문서 미확정은 production 가입 활성 게이트이며 fixture 문서로 출시하지 않는다.
3. 신규 나이 수집을 없애고 기존 필수 제약을 호환 이행한다. 기존 birth/age 삭제 SQL은 대상·Auth metadata 포함 범위·복구 가능성·개수 확인 절차를 제시하되 원격 실행하지 않는다.
4. 기존 계정 삭제 초안의 JWT-derived identity, anonymous/위조 body 거절, 재인증/부분 실패/응답 유실/멱등 복구를 구현한다. 단순 token refresh를 최근 비밀번호 재인증 증거로 오인하지 않는다. 로컬 삭제 완료를 DB 응답만으로 주장하지 않는다.
5. course parent/child 부분 성공을 원자적 DB transaction/RPC 또는 정확한 실패와 복구로 처리한다. 다른 사용자 graph를 건드리지 않는다.
6. 계정별 완료 기록·승인 import를 구현한다. 조회 실패 시 타 계정/guest 전체 저장소를 fallback으로 반환하지 않는다.
7. 이후 같은 DB writer가 기존 live-activity-dwell-storage.md의 DB-DWELL-01을 아래 최신 보완과 함께 실행한다.

## DB-DWELL-01 최신 보완
- 일반 계정+별도 동의+동일 소유/동의 epoch+명시 확인 완료 신규 표본만 수신한다. 서버는 카탈로그 키/소유권/동의/허용 payload를 검증하되 사용자 확인이 실제 GPS 방문 증명이라고 주장하지 않는다.
- 저장 코스를 만들지 않은 현행 V1 로컬 진행도 지원할 수 있도록 안정적인 run/stop 완료 identity를 사용한다. 표본 FK를 위해 레거시 저장 코스·좌표 전체를 자동 생성하지 않는다.
- raw exact 시각·좌표·polyline은 학습 payload 제외. 양의 유한 actualDwellMin과 승인 최소 메타데이터만 보존한다. 가져온 guest는 학습 불가 provenance를 서버에서도 강제한다.
- completion event unique key, 중복 submit, off/reset/delete와 동시 submit, 초기화 뒤 이전 outbox 재생성 방지를 fixture로 증명한다. 동의 off는 수집/새 추천 적용 중단이며 과거 데이터 삭제 여부는 초기화/보유 정책과 분리한다.
- 개인화 원시표본 정렬은 엔진의 시간순 입력 계약에 맞춰 고정한다. 전체 개인 표본을 public continuation/route cache에 넣지 않는다.
- 학습 업로드 실패로 기본 추천·길찾기·필수 로컬 완료 기록을 막지 않는다. 미확정 retention/pending 정책은 활성화하지 않는다.
- RLS는 SQL 문자열 검사만이 아니라 disposable local DB의 A/B/anonymous 직접 REST/RPC 또는 동등한 JWT role 실행으로 증명한다. 도구 불가 시 미검증을 분리한다.

## 필수 반례
guest/account A/B/로그아웃/철회/삭제, forged userId/타 소유 stop, 부분 course 저장, import 성공/거절/응답 유실/반복/계정 전환, 동의 전/guest 이력의 학습0, 동의 reset 뒤 재전송, null subCategory 파생0, 표본 2/3/6, 전체 사용자 삭제 cascade.

## 공통 검증·권한

[Wave 공통 실행 규칙](../integration-decision/release-personalization-wave.md)을 따른다. 코드 변경 전 실패 fixture, 변경 후 typecheck/UI/core/집중 테스트와 diff 검사. 운영 API·사용자 데이터·키 출력·원격 쓰기·commit/push 금지. 결과를 이 문서에 변경 파일/유지 계약/테스트/다음 결정 네 항목으로 인계한다. 문서의 구현 전 상태는 실제 증거 없이 완료로 올리지 않는다.

## A단계 완료 인수인계 — 2026-09-07

### 1. 변경 파일과 목적

- `docs/work/db-personalization/release-identity-personalization.md`: 기존 profile/account·local completion·엔진 SampleV1을 재사용하는 단일 수락 후보를 작성했다. account identity, 가입 문서, profile/delete, account 완료 기록, guest import, 체류 consent/eligibility, sample submit/read의 이름·소유 파일·입출력 union·오류·재시도·멱등 키를 고정했다.
- `test/fixtures/db-release-identity-a-v1.json`: B의 disposable DB/repository 테스트가 소비할 account A/B/anonymous/expired와 RLS·부분 course rollback·응답 유실 입력/기대값을 준비했다. migration/RPC 구현이나 문자열 검사 테스트는 추가하지 않았다.

### 2. 유지한 공개 계약·정책 경계

- 기존 `courseCompletionRepository`의 local capture, `courseRunId` 멱등성, legacy 후기 비승격, Live Activity/알림 완료 흐름을 변경하지 않았다.
- 엔진의 `DwellPersonalizationSampleV1`과 오래된→최신 정렬, 3개부터 최신 5개 중앙값, 안전 clamp 계약을 재사용하고 엔진에 identity·timestamp를 추가하지 않았다.
- guest Live Activity/기기 방문 기록을 유지했다. guest import와 개인화 동의를 결합하지 않았고 과거 guest/legacy 체류 학습은 0으로 유지했다.
- UI/AuthContext, engine, migration/RLS, Edge Function, DB 기준·중앙 문서, 원격 데이터·환경을 수정하지 않았다. B와 DB-DWELL-01은 실행하지 않았다.

### 3. 실행한 검증과 결과

- A fixture JSON parse·필수 구조 검증: **PASS**. identity 4개, RLS case 7개, course graph case 3개를 확인했다.
- `node --test test/anonymous-auth-cleanup-migration-contract.test.mjs test/course-replan-contract.test.mjs`: **7/7 통과**, 실패·skip 0. 이는 기존 정리/RPC source 계약 회귀이며 새 account RLS의 실제 JWT 격리를 증명하지 않는다.
- 운영 Supabase/API/메일/계정 생성·삭제·migration 배포는 0회다.
- `git diff --check`: 통과. 두 untracked 산출물은 각각 `git diff --no-index --check /dev/null <file>`로 추가 확인했고 whitespace 진단이 없었다.

### 4. 다음 결정·위험·재현 조건

- 위 결정 표의 legacy 귀속, pending 상한/기간, 서버 보유, 문서 URL/version, 닉네임, 탈퇴 local 범위, 최근 재인증, 동의 증거 보유를 통합·사용자가 수락해야 한다. 특히 공개 문서가 없으면 가입 B는 차단한다.
- A 수락 뒤에만 B가 account-only server predicate, 원자적 course graph, 가입 증거, account 삭제, owner namespace와 guest import를 실패 테스트부터 구현한다. B 수락 뒤에만 같은 DB writer가 DB-DWELL-01로 넘어간다.
- 현재 코드는 anonymous가 account table에 직접 접근할 가능성, 자동 동의 timestamp, 일반 계정 삭제 부재, course parent/child 부분 성공 위험을 그대로 가진다. A 문서 완료는 이 결함이 수정됐다는 뜻이 아니다.
- 재현 입력은 `test/fixtures/db-release-identity-a-v1.json`, 현재 RLS migration, `courseRepository.currentUserId/saveCourseToRepository`, AuthContext signup metadata와 `purge_account_data`다. 실제 수락은 문자열이 아니라 disposable JWT role의 row 결과와 repository observable result로 판정한다.

## B·후속 DB-DWELL-01 완료 인수인계 — 2026-09-07

### 1. 변경 파일과 변경 목적

- `supabase/migrations/202609070015_release_account_identity_records.sql`: 비익명 account predicate, 실제 문서 registry/서버 동의 증거, legacy age 제거 이행, 선택 nickname, account 완료 기록·generation/tombstone 삭제, 명시 guest import/source claim, 원자적 course graph, 계정 삭제 claim/검증 RPC를 후속 migration으로 작성했다. 기존 migration은 덮어쓰지 않았다.
- `supabase/migrations/202609070016_dwell_personalization_storage.sql`: 별도 동의 epoch/revision, user-confirmed 최소 표본, 180일 보유, 표본 3개부터 최신 5개 중앙값 profile, off/reset/cascade, service-role cleanup 계약을 작성했다. cleanup job 자체는 활성화하지 않았다.
- `supabase/functions/delete-account/{handler.ts,index.ts}`: body user ID 없이 Auth user와 공식 검증 claims의 password AMR 최근 600초를 검사하고 storage→Admin Auth delete→연결행 0 검증 결과를 typed stage로 반환한다. 공식 근거는 Supabase [JWT fields의 `amr`](https://supabase.com/docs/guides/auth/jwt-fields), [JWT 검증 지침](https://supabase.com/docs/guides/auth/jwts), [사용자 삭제와 cascade/Storage 주의](https://supabase.com/docs/guides/auth/managing-user-data)를 2026-09-07 확인했다.
- `src/services/accountIdentity.ts`, `accountRegistrationRepository.ts`, `accountProfileRepository.ts`, `accountCourseCompletionRepository.ts`, `guestCompletionImportRepository.ts`, `accountDeletionRepository.ts`, `dwellPersonalizationRepository.ts`, `dwellPersonalizationOutbox.ts`, `releaseIdentitySupabase.ts`: UI와 분리된 공개 entry/type, owner snapshot, 명시 import ack, 완료시각 minute 투영, 32건/7일 outbox 및 Supabase composition을 구현했다.
- `src/services/courseRepository.ts`, `courseCompletionRepository.ts`: anonymous account 저장을 차단하고 코스 parent/child를 단일 RPC로 저장하며 같은 request ID로 한 번 재시도한다. guest import acknowledgement에 든 source ID만 원자적으로 지우는 local entry를 추가했다.
- `test/release-account-contract.test.ts`, `release-owned-completion.test.ts`, `delete-account-handler.test.ts`, `dwell-storage-contract.test.ts`, `release-identity-migration-contract.test.mjs`, `course-completion-repository.test.ts`, `scripts/test_release_identity_local_db.sh`: A fixture를 재사용해 repository/Edge/source 계약과 disposable PostgreSQL의 전체 migration, A/B/anonymous RLS, graph rollback, import response loss, nickname, dwell 1·2·3·6, reset/cascade를 검증한다.

### 2. 변경하지 않은 공개 계약·정책 경계

- UI/AppFlow/AuthContext, 추천 engine, 카탈로그, Live Activity native와 중앙 추천/UIUX 문서는 수정하지 않았다. 기존 local 완료 캡처, `courseRunId` 멱등성, legacy 후기 실제체류 비승격, 1~2곳 순서와 기본 추천 fallback을 유지했다.
- guest/legacy 기록은 자동 account 귀속하거나 학습시키지 않는다. import는 `prepared(targetSubject) → server acknowledged(ids) → accepted source만 제거`이고 자동 만료가 없다. 체류 outbox의 7일 정책을 방문 기록 source에 적용하지 않았다.
- 완료 근거는 local millisecond → server minute로만 투영하고 서버 수신 시각과 분리했다. 좌표·주소·geometry·raw 도착/출발·provider URL·token은 account 완료/guest import/dwell outbox·표본에서 거절하거나 제외한다.
- 실제 공개 약관/처리방침 URL·version이 없으므로 migration registry는 비어 있고 production 가입은 계속 닫혀 있다. fixture의 `fixture.invalid` 문서는 local DB 안에서만 생성·폐기한다.
- migration·Edge Function·cleanup scheduler를 원격 적용/배포하지 않았고 운영 계정·데이터 생성/삭제, 메일 발송, stage/commit/push를 하지 않았다.

### 3. 실행한 테스트와 결과

- 실패 우선: 새 repository/Edge 테스트 4개는 최초 `MODULE_NOT_FOUND`로 실패했고, local DB 최초 실행은 child RLS UUID/text 모호성, consent revision 모호성, guest import 초기 배열 소실을 각각 재현했다. 구현 후 모두 수정했다.
- `npx tsx --test test/release-account-contract.test.ts test/release-owned-completion.test.ts test/delete-account-handler.test.ts test/dwell-storage-contract.test.ts test/course-completion-repository.test.ts`: **32/32 PASS**, fail/skip 0.
- `node --test test/release-identity-migration-contract.test.mjs test/anonymous-auth-cleanup-migration-contract.test.mjs test/course-replan-contract.test.mjs`: **12/12 PASS**, fail/skip 0.
- `scripts/test_release_identity_local_db.sh`: UTF-8/UTC disposable PostgreSQL에 migration 001~016 전체 적용 후 A/B/anonymous 격리, 나이0·동의증거, nickname20/21·중복, course rollback, account 완료 namespace/재시도, guest ack/교차 claim, dwell 1·2·3·6/latest5·reset, account cascade를 검증해 **PASS**. Docker/Supabase local stack은 데몬 부재로 사용하지 않았고 동일 PostgreSQL role/JWT claim 함수를 사용했다.
- `npm run test:typecheck`: **PASS**. `npm test`: **258/258 PASS**. `npm run test:ui`: **504 PASS / 1 기존 skip / fail 0**. `git diff --check`와 신규 산출물 21개의 `--no-index --check`: whitespace 진단 0.

### 4. 다음 세션 결정 필요 사항·위험·재현 조건

- 통합은 먼저 공개 entry/type과 `completedAt` millisecond → `completedAtMinute`/`received_at` 분리, owner snapshot, request/import/mutation ID 재사용 계약을 수락해야 한다. UI는 그 뒤에만 새 서비스 composition을 연결하고 실제 문서 표시·기본 미선택, password 재로그인, account local cleanup pending을 구현한다.
- password 재인증 판정은 verified `amr.method=password`의 timestamp만 사용한다. `iat`/refresh는 반례다. 단, Admin Auth 삭제 성공 뒤 HTTP 응답이 유실되면 삭제된 사용자의 같은 token으로 최종 성공을 재검증할 수 없다. 현재 계약은 삭제 자체의 안전성은 보장하지만 UI 완료 확인은 불확실 상태가 될 수 있으므로, 임의 영구 receipt를 추가하지 말고 통합에서 단기 비식별 receipt 보유기간 또는 보수적 local cleanup 재조정 UX를 결정해야 한다.
- 현재 Storage bucket은 없어 delete 단계가 no-op 성공이다. 사용자 소유 bucket을 도입하면 `deleteStorage`의 owner 삭제와 0건 확인을 먼저 구현해야 한다. Supabase 문서상 Auth user 삭제가 Storage object를 대신 지우지 않는다.
- 원격 적용 전 실제 공개 문서 두 URL/version 승인과 registry seed, 기존 `birth_year/age_band` profile/Auth metadata 대상 건수·백업/복구 승인, upgrade DB dry-run, 180일 purge scheduler 소유자를 확정해야 한다. 재현은 `scripts/test_release_identity_local_db.sh`; fixture 외 실제 사용자/키는 필요 없다.

## 최신 수락 전 보완 완료 인수인계 — 2026-09-07

### 1. 변경 파일과 변경 목적

- `src/services/releaseIdentityPersonalizationRuntime.ts`: 기존 완료·account 완료·guest import·dwell repository를 중복 구현하지 않고 하나의 owner-aware 서비스로 조합했다. `@timefit/release-device-ownership-v1`에는 기기 scope, immutable run owner, account generation, run/stop의 consent epoch·revision, 로그인 제안 dismissal만 저장하고 owner별 완료는 `@timefit/course-completions-owner-v1/<encoded ownerKey>`로 분리한다. 인증 확인 실패 run은 `unverified:<courseRunId>`에 보존하며 guest/account로 강등·승격하거나 fallback 조회하지 않는다.
- `src/services/releaseIdentitySupabase.ts`: 실제 `AsyncStorage`, 검증 Auth identity, 기존 Supabase RPC remote로 `supabaseReleaseIdentityPersonalizationRuntime`을 구성했다. UI가 별도 DB 저장소를 만들지 않도록 아래 함수 export를 실제 production composition에 연결했다.
- `src/services/accountCourseCompletionRepository.ts`: `captureAccountCompletionOwner(courseRunId)`가 기존 snapshot을 먼저 읽어 같은 owner에는 기존 generation을 반환하고 다른 owner에는 `owner_changed`를 반환한다. 반복 호출·계정 전환·삭제 generation 변화로 최초 owner를 덮어쓰지 않는다.
- `src/services/accountRegistrationRepository.ts`, `accountDeletionRepository.ts`: `readSignupConsentDocuments()`의 exact 2문서 typed read와, 삭제 응답 유실을 성공으로 합성하지 않는 `recheckAccountDeletion()`의 `retry_ready | unknown` 계약을 추가했다.
- `test/release-identity-device-flow.test.ts`, `release-identity-classification-contract.test.mjs`, `release-owned-completion.test.ts`, `release-account-contract.test.ts`: 기존 공개 함수만으로 실패하던 owner별 read/import/cold eligibility 조합을 고정 입력 runtime fixture로 전환했다. local→server ack→sample 순서, account 전환·logout·reset·삭제, 손상·원격 실패·동시 begin, 최신 카페 5곳 키를 검증한다.

실제 UI 소비 export는 모두 `src/services/releaseIdentitySupabase.ts`에 있다.

| export | 입력 | 성공/의미 | UI가 처리할 비성공 |
| --- | --- | --- | --- |
| `beginOwnedCourseRun` | `{ courseRunId }` | `captured`와 immutable owner/run eligibility snapshot | `invalid_input`, `storage_corrupt`, `storage_unavailable` |
| `captureOwnedStopEligibility` | `{ courseRunId, stopOrdinal, confirmationEventId }` | 최초 확인 event와 당시 동일 owner·epoch·revision 또는 `eligibility:null`을 영구 고정 | `not_found`, `conflict`, `invalid_input`, `storage_corrupt`, `storage_unavailable` |
| `completeOwnedCourseRun` | 기존 `CompleteCourseInput` | owner namespace에 local 완료 후 `sync.status`; server 완료가 `created/already_completed`인 뒤에만 해당 stop 표본 제출 | local `run_not_captured/invalid_input/storage_*`; sync `local_only/owner_changed/stale_generation/idempotency_conflict/unavailable/not_found` |
| `retryOwnedCourseRunSync` | `{ courseRunId }` | 저장된 local record·owner generation·run/stop eligibility로 같은 ID 재시도 | 위 sync 상태. local 완료는 취소하지 않는다 |
| `readOwnedDeviceCourseCompletions` | 없음 | 현재 검증 account 또는 현재 guest device namespace만 `ok/empty` | `session_expired`, `unavailable`, `storage_corrupt/storage_unavailable`; 다른 owner fallback 금지 |
| `readGuestCompletionImportSource` | `{ surface:'login'|'records' }` | guest+`legacy_unassigned`만 side-effect-free `available`; login dismissal은 `dismissed`, records는 재진입 가능 | `account_required`, `session_expired`, `unavailable`, `storage_*` |
| `dismissGuestCompletionImportOffer` | 없음 | 현재 subject의 로그인 제안만 `dismissed` | `account_required`, `storage_*` |
| `approveGuestCompletionImport` | `{ sourceCompletionIds }` | 명시 선택 뒤 stable `importId`로 `prepared` | `empty/dismissed/account_required/invalid_input/unavailable/storage_*` |
| `continueGuestCompletionImport` | `{ importId }` | server ack 뒤 accepted source만 제거하여 `source_removed` | `unavailable/account_changed/invalid_input/cleanup_pending`; 같은 ID로 재호출 |
| `readOwnedDwellPersonalizationSamples` | 없음 | 현재 동의 account 표본을 엔진 공개 SampleV1 배열로 `ok/empty` | `not_enabled/account_required/session_expired/unavailable`, 모두 samples `[]` |
| `resetOwnedDwellPersonalization` | `{ requestId, expectedRevision }` | 서버 reset 뒤 해당 owner outbox/eligibility만 제거 | `conflict/unavailable/account_required`; 서버 성공·로컬 실패는 `local_cleanup_pending` |
| `deleteOwnedAccountRecord` / `deleteAllOwnedAccountRecords` | `{ completionId, requestId }` / `{ requestId }` | 서버 삭제 확인 뒤 해당 account local run/outbox/owner snapshot 정리와 `progressCleanupRequired:true` | 원격 오류 그대로; 로컬만 실패하면 `cleanup.status:'local_cleanup_pending'` |
| `cleanupAccountOwnedDeviceData` | 없음 | 검증된 현재 account만 정리한다. caller가 subject를 지정할 수 없다 | `account_required` 또는 `local_cleanup_pending`; guest·legacy·다른 account 불변 |
| `deleteOwnedAccount` / `recheckOwnedAccountDeletion` | `{ requestId }` | 명시 `deleted` 뒤에만 삭제 전 캡처 subject를 local 정리. 재확인은 인증이 남으면 `retry_ready`, 없거나 확인 불가면 `unknown`, 둘 다 같은 ID 재시도 | `reauth_required/retryable_failure/rejected/unknown`; `unknown`을 deleted로 표시 금지 |
| `readSignupConsentDocuments` | 없음 | exact `terms-of-service`, `privacy-policy`의 ID/version/URL만 `ok` | 빈·형식 불일치 `not_configured`, 조회 오류 `unavailable`; 가입 활성화 금지 |

UI 연결 순서는 다음으로 고정한다. 코스 시작 시 `beginOwnedCourseRun`을 먼저 호출한다. 기존 검증 진행 모델이 stop 도착을 명시 확정한 그 시점에 stable `confirmationEventId`로 `captureOwnedStopEligibility`를 한 번 호출하고, 출발 뒤 계산한 `actualDwellMin`은 마지막 `completeOwnedCourseRun`의 기존 place payload에만 넣는다. 늦게 수신한 native receipt로 과거 `eligibility:null`을 채우지 않는다. `completeOwnedCourseRun`은 local 저장 성공을 먼저 반환할 수 있으며 UI의 진행/Activity cleanup은 sync 성공을 기다리지 않는다. 재시작은 같은 `courseRunId`로 `retryOwnedCourseRunSync`를 호출한다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 기존 `CompleteCourseInput/CourseCompletionRecordV1`, stable `completionId/courseRunId`, 명시 완료만 저장, legacy 후기 actual dwell 비승격을 유지했다. owner 없는 기존 key는 `legacy_unassigned` import source이며 current account/guest로 자동 귀속하지 않는다.
- guest/legacy import는 방문 기록만 전송하고 학습 표본은 0이다. account 완료 서버 ack 전에는 dwell remote 호출이 없고, null subCategory·guest·unverified·동의 불일치는 local 진행을 유지하면서 학습만 제외한다.
- account generation 조회와 선택 dwell 동의 조회를 분리했다. generation 확인 뒤 동의 조회만 실패하면 account 방문 기록은 계속 저장하고 run/stop eligibility만 `null`로 고정해 선택 기능 장애가 방문 이력을 막지 않는다.
- dwell outbox는 여전히 표본 최대 32건/7일과 승인된 최소 필드만 갖는다. owner subject·epoch·revision은 매 submit에 현재 identity/consent와 다시 대조하며 raw 도착/출발, 좌표, JWT, 제목을 새 owner envelope/outbox에 넣지 않았다.
- UI/AppFlow/AuthContext, native Live Activity, 추천 engine, runtime catalog, migration 015/016 및 중앙 문서는 수정하지 않았다. 원격 migration/Edge 배포, 운영 데이터·계정 생성/삭제, stage/commit/push는 실행하지 않았다.
- migration016의 실제 catalog 검증 원천은 별도 원격 catalog table이 아니라 먼저 ack된 `account_course_completion_places`의 exact `contentId/category/subCategory/completedAtMinute`다. 최신 `dbClassificationContract` version `runtime-category-subcategory-3bb74d97ebcd`와 카페 5곳 exact 키가 이 완료 payload에 들어가는 fixture를 추가했으며 원격 catalog 변경은 하지 않았다.

### 3. 실행한 테스트와 결과

- 실패 우선: `test/release-identity-device-flow.test.ts`는 runtime module 부재로 최초 `MODULE_NOT_FOUND`를 재현했다. 구현 후 로그인 account에서도 손상 owner envelope를 확인하지 않아 `storage_corrupt` 대신 `empty`를 반환하던 fixture가 한 번 실패했고, 모든 owner read가 envelope를 fail-closed 검증하도록 수정했다.
- 집중 TypeScript/Node 회귀: `npm run test:typecheck` **PASS**. identity device/account/dwell 집중 테스트 **24/24 PASS**, classification+migration 계약 **6/6 PASS**.
- `npm test`: **262/262 PASS**, fail/skip 0. `npm run test:ui`: **510 PASS / 기존 skip 1 / fail 0**.
- `scripts/test_release_identity_local_db.sh`: migration 001~016을 disposable PostgreSQL에 적용한 A/B/anonymous RLS·삭제 cascade·guest claim·dwell reset 회귀 **PASS**.
- `git diff --check`와 새 runtime/test/인수인계 파일의 `git diff --no-index --check`: whitespace 진단 0.

### 4. 다음 세션의 결정 필요 사항·위험·재현 조건

- UIUX는 위 production export만 소비하면 되며 새 owner/pending/outbox key, Supabase RPC, owner 추론 로직을 만들지 않는다. 특히 `confirmationEventId`는 기존 검증 진행 event의 stable ID여야 하고 native receipt 수신 시각이나 새 UUID로 대체하면 안 된다. UI 전용 active progress/알림 정리는 `progressCleanupRequired:true`일 때 해당 owner만 처리한다.
- 인증 확인 실패 run은 `unverified` namespace에 보존되지만 안전한 account 귀속 근거가 없으므로 guest/account 기록 화면이나 import source에 자동 노출하지 않는다. 사용자가 그 run을 계속 보는 UX가 필요하면 현재 active `courseRunId`로 받은 `begin/complete` 결과를 사용하고, 별도 사후 귀속 정책 없이는 account 학습으로 승격하지 않는다.
- 실제 공개 약관 두 URL/version과 registry seed가 아직 없으면 `readSignupConsentDocuments()`는 `not_configured`이고 production 가입은 계속 닫아야 한다. 계정 삭제 응답 유실 뒤 identity까지 사라진 `unknown`은 서버 성공으로 확정할 방법이 없으므로 “삭제 결과 확인 중”으로 남기며 영구 receipt를 임의 추가하지 않았다.
- 재현은 `npx tsx --test test/release-identity-device-flow.test.ts test/release-owned-completion.test.ts test/release-account-contract.test.ts test/dwell-storage-contract.test.ts`, `node --test test/release-identity-classification-contract.test.mjs test/release-identity-migration-contract.test.mjs`, `scripts/test_release_identity_local_db.sh`다. 원격/실기기 확인은 하지 않았으며 수락 뒤 UIUX가 고정 progress fixture로 export 호출 순서와 화면 cleanup을 연결해야 한다.
