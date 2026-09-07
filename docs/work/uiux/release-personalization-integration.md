# U-RELEASE-PERSONALIZATION-01 — 안전 진행·회원 혜택 연결

최신 통합 수락: DB 공유 잠금/cold 조회 서비스 보완을 수락했다. Wave 최신 검토에 근거를 기록했다. **B 잔여 연결 지금 실행 가능**: DB “공유 잠금·cold 소유권 완료 인수인계”의 정확한 호출 순서를 소비하고 `await starts` 차단 제거, readonly/proof와 명시 완료 fallback을 연결한다. 기존 lock 결함을 기대하는 진단은 삭제하지 말고 원격 해제 전 local 성공과 late 승인0 기대값으로 교체한다. Live Activity 증거 구현은 조사안 확인 뒤 별도 명령이며 임의 활성화하지 않는다.

**2026-09-07 수락 후 B 실행 결과:** 아래 남은 consumer 연결을 구현하고 자동 회귀를 수행했다. 과거 승인 대기는 해제됐다. 다만 production factory에서 `captureStopPersonalizationEligibility`의 원격 동의 조회가 공용 storage 직렬화를 점유하여 직후 필수 local 완료를 지연시키는 새 반례를 재현했다. B 전체 수락은 이 DB 보완과 cold active owner의 읽기 전용 복구/삭제 경계 확인 전까지 보류한다. 세부 구현·검증·미완료는 문서 끝 최신 인수인계를 따른다.

**현재 실행 승인(2026-09-07): DB 세 보완 통합 수락을 기록했으므로 B 나머지 연결을 지금 진행한다.** [수락 근거](../integration-decision/release-personalization-wave.md#db-세-보완-통합-수락--2026-09-07). 아래 “통합 수락 기록 없음/인계 후 실행”은 승인 기록 누락 당시 이력이며 더 이상 차단 사유가 아니다. DB 최신 반환 계약과 local 완료→cleanup→별도 sync, 재시작 pending 조회를 소비한다. 기존 UI 부분 구현은 유지하며 UI B 전체 완료·QA·원격 출시 승인은 별도다.

2026-09-07 B 재개 선행 확인: DB 최우선 보완의 새 production exports와 집중 36/36 PASS를 확인했다. 과거의 entry 부재는 더 이상 그대로 적용하지 않는다. 다만 Wave의 명시 `DB 세 항목 보완 → 통합 수락 → UI B` 중 통합 수락 기록은 아직 없어, 아래 런타임 연결을 임의 활성화하지 않았다. 상세 재개 인계는 문서 끝을 따른다.

최신 선행 게이트(2026-09-07): DB 문서 맨 위 **“최우선 보완 — 완료 응답·표본 재등록·인증 오류”** 수락 뒤 아래 B 연결을 진행한다. 기존 DB 완료 응답이 remote sync까지 기다리는 점이 발견됐으므로 과거 인계만으로 호출하지 않는다. 새 local 완료 반환 계약과 별도 sync 순서를 확인하고 UI에서 저장 성공을 합성하거나 만료 표본을 재생성하지 않는다. 기존 완료된 UI 범위는 유지한다.

## 최신 B 이어서 실행 — DB 소유권 보완 뒤 (2026-09-07)

상태: **DB 최신 수락 전 보완 인계 후 실행**. 이미 완료한 A, nickname/consent, 표본 read/frozen 추천은 반복 구현하지 않는다. 본 절은 문서 끝 B 부분 대기 사항을 닫는 후속 명령이다.

1. DB release-identity-personalization.md 최신 기기 소유권 보완과 실제 releaseIdentitySupabase exports를 먼저 대조한다. owner-scoped local complete/read/delete, 승인 전 import source read, immutable run/stop eligibility capture/restore, 완료→방문 ack→학습 submit, registry reader가 모두 구현/테스트됐는지 확인한다. 없는 entry를 UI schema/raw table write로 우회하지 않는다.
2. AppFlow의 실제 새 run 생성에서 소유권을 캡처하고 앱/Live Activity 확인은 기존 shared event의 identity를 DB port에 전달한다. cold start 뒤 당시 eligibility 복원 실패를 현재 계정 동의로 채우지 않는다. 소유 확인 실패가 경로 안내를 막지 않도록 학습 불가 상태와 진행 기능을 분리한다.
3. 필수 local 완료를 owner-scoped 공개 entry로 전환한다. remote 방문/체류 전송은 뒤에서 처리하고 실패해도 완료 UI·exact Activity/알림 cleanup은 완료한다. 앱 재시작 때 승인된 pending만 동일 ID로 재개한다.
4. 기록 화면은 account의 local 미동기화+remote 이력을 같은 completion identity로 중복 없이 보여준다. guest/legacy는 명시 구분하며 account A logout/B 진입에 A 기록이 보이지 않아야 한다. 단순히 account는 remote만 표시해서 아직 전송 안 된 완료를 잃어 보이게 하지 않는다.
5. 로그인 후 가져올 guest/legacy source가 있을 때 명시 질문한다. 읽기만으로 target을 bind하지 않는다. 거절 시 유지하고 반복 강요하지 않으며 기록 탭에서 나중 가져오기 가능. 승인/부분 ack/응답 유실/source cleanup 재시도/계정 변경을 처리한다. imported 체류 학습0.
6. 새 적격 체류를 실제 submit/outbox로 연결한다. account 기록 ack 전 submit 금지, off/reset/logout·다른 계정·old epoch 전송0. 대표1곳·2곳에서 표본3개 후 다음 추천의 실제 stay 변화를 확인한다. 진행 중 코스 snapshot은 바꾸지 않는다.
7. 기록 개별/전체 삭제와 탈퇴의 해당 owner local cleanup을 연결한다. 탈퇴 재인증10분은 서버 증거를 사용한다. 응답 유실/네트워크 실패는 성공 화면이나 전체 기기 삭제로 덮지 말고 결과 확인 중/재시도 상태를 노출한다. guest 전체 삭제는 별도 선택일 때만 실행한다.
8. registry reader로 실제 문서가 있을 때만 문서·기본 미선택 체크·가입 submit을 연결한다. 빈 registry는 가입만 닫고 기본 추천·로그인은 유지한다. 실제 문서 미게시와 reader 미구현을 구분한다.
9. 맞춤 표시는 기존 엔진 metadata/동일 후보 기본값과 실제 stay 차이에 근거한다. 증명 불가시 숨기되 데이터가 없어서 표시 안 된 것과 consumer 미구현을 인계에서 구분한다.
10. 실제 화면+DB production service factories+주입 포트의 fixture로 전체 쓰기→읽기 흐름을 검증한다. 단순 panel read mock으로 B 전체 완료를 선언하지 않는다. 실패한 entry/정확한 소유 파일을 남기고 구현 가능한 독립 범위는 계속한다.

완료 검증: typecheck/UI/core·신규 E2E fixture·iOS bundle. 실제3회 방문 요구 없이 고정 clock/확인 event로 표본3건을 만든다. 계정 A/B/guest, import, offline→online, 재시작, 삭제/철회 race, 기본 추천 안전성/route 추가0을 포함한다. remote 적용·공개 문서·최종 실기기 게이트는 별도 표시한다.

상태: **A 자동 검증 완료 유지. B는 2026-09-07 독립 연결 구현·자동 검증 완료, 계정별 local 완료/명시 import/신규 체류 적재/삭제·가입의 미충족 계약은 부분 대기**. B 전체 완료나 출시 수락을 의미하지 않는다. UIUX 단일 writer. App.tsx/AppFlow/AuthContext/nav/화면/runtime UI 연결은 이 세션만 수정한다. DB repository/migration·순수 엔진·원본 data·API adapter는 타 역할 소유다.

2026-09-07 A 실행 결과: **준비/성공 분리·실패 복구 구현 및 자동 검증 완료, 변경 bundle 실기기 확인은 미실행**. 당시 B는 시작하지 않았다. 후속 B의 실제 구현·대기 범위는 문서 끝 인수인계를 따른다. 과거 `.5` 실기기 통과를 새 bundle의 실기기 증거로 승격하지 않는다.

## A. 현재 Live Activity 실패 복구 — 지금 실행
1. release-preflight.md와 test/ui/release-preflight-handoff.test.mjs의 실패를 먼저 재현한다. 감사에서 확인된 것은 실제 외부 성공 전에 afterHandoff(opened:true)로 updated revision이 저장되고 실패 rollback에서 빠지는 경계다. 정상 실기기 동작 전체를 실패로 되돌리지 않는다.
2. 기존 live-activity-dwell-progress.md 최신 성공 인계를 읽는다. foreground Activity 준비와 실제 handoff 성공 commit을 분리한다. opened:true 합성으로 UI/native/notification에 성공 이벤트를 미리 전파하지 않는다.
3. 첫 카카오맵 진입 직후 Activity 노출을 유지하고, 이미 존재한 run 업데이트도 실패 시 정확한 이전 상태 또는 명시 준비 상태로 수렴시킨다. 실패 rollback이 사용자 최신 도착/출발 이벤트를 덮어쓰지 않게 run/stop/revision·시도 토큰으로 소유권을 검증한다.
4. Live Activity의 명시 이제 출발해요는 이미 확인한 departedAt과 외부 열기 성공을 분리하는 현행 계약이다. 카카오 실패 때문에 명시 출발 시각을 지우거나 재시도 시 갱신하지 않는다. 일반 앱 길찾기는 기존 실제 handoff 성공 경계를 유지한다.
5. 새 Activity 실패/기존 updated 실패/반복 탭/stale callback/준비 후 background/cold restore/사용자 확인과 실패 race를 공개 entry fixture로 통과시킨다. route/API 증설·로그인 강제·앱 재탭 요구로 가리지 않는다.
6. API schedule adapter 변경이 필요하면 정확한 요청/응답 계약을 API 담당에 반환하고 해당 파일 동시 수정하지 않는다. A 결과를 먼저 인계한다.

## B. 계정·기록·개인화 연결 — 선행 계약 완료 후
1. DB A에서 수락된 정확한 entry/type를 import한다. UI가 별도 storage key/schema·가짜 server success·raw Supabase table write를 만들지 않는다. 가입 나이 입력/검증 제거, 실제 동의와 profile/삭제 계약을 연결한다. 닉네임 정책이나 공개 문서가 미확정이면 임의 규칙·링크를 만들지 않는다.
2. 회원 A 로그아웃/계정 B 전환 시 A 기록/표본/derived UI cache를 즉시 비노출·미적용하고 이전 비동기 응답을 무시한다. 기존 진행 snapshot 안전성과 소유권을 분리한다. 미확정 계정 전환 중 active 처리나 legacy 귀속은 DB 계약의 승인 범위까지만 구현한다.
3. guest 방문 기록이 있을 때 로그인 후 명시 import 질문을 한 번 제시한다. 승인 성공분만 source 정리, 거절은 유지. 재시도/응답 유실로 자료를 없애거나 동의 없이 반복 팝업을 띄우지 않는다. import 동의와 체류 개인화 토글을 묶지 않는다.
4. 앱과 Live Activity가 공유하는 완료 이벤트를 통해 account+동의 적격 신규 표본만 DB port에 전달한다. 가입/로그인 전 표본·guest import·불완전 확인·취소/만료는 제외한다. 업로드는 필수 local 완료 및 Activity/알림 정리를 막지 않는다. offline는 승인된 최소 queue 계약만 사용한다.
5. 추천 시작 전에 현재 account/consent에 맞는 안전한 표본 snapshot을 가져와 기존 CourseV1Input.dwellPersonalizationSamples에 주입한다. 로딩/네트워크 실패/미동의는 기본 추천으로 계속하며 무한 대기하지 않는다. first/더보기/pair의 동일 session에서 같은 snapshot을 유지한다. JSON continuation·navigation params·로그에 개인 표본/identity를 직렬화하지 않는다.
6. 완료 뒤 새 표본은 다음 추천 session부터 반영한다. 이미 확정된 진행 코스의 시간·순서·알림을 학습 결과로 도중 변경하지 않는다. 로그아웃/철회 시 이전 개인화 session의 더보기/새 선택 적용을 중단하고 기본 기준 재계산 entry로 안내하되 실제 활성 코스 안전 계획을 몰래 바꾸지 않는다.
7. guest도 같은 Live Activity/길찾기/기기 기록을 제공한다. 완료 후 로그인 제안은 비차단이다. account 미동의에는 설정 진입, 동의한 경우 유효 복합 카테고리별 0~2개 준비 상태를 표시한다. missing subCategory는 준비 카운트를 합성하지 않는다.
8. 실제 엔진 적용 snapshot과 기본 대비 차이가 확인될 때만 맞춤 반영 표시를 한다. 3개 있다는 이유로 모든 장소가 개인화됐다고 하지 않는다. 기본값 복귀·부적격·다른 category 표시는 금지한다.
9. 기록 삭제는 기록 탭, 개인화 초기화/동의는 내정보로 기존 UX를 유지한다. default unchecked 동의·서버 실패·삭제 재인증·부분 실패 UI를 포함한다.
10. 데이터 사진 fallback은 기존 기본 asset을 재사용한다. 실허락 미확인 URL을 UI 다른 fallback 경로에서 다시 불러오지 않는다. 이미지 없는 장소를 숨기지 않는다.

## 필수 검증
A 실패 fixture와 실제 최신 handler, 회원 A/B/guest 화면 전환, import 수락/거절/부분 실패, 동의 전/철회/계정 전환 race, 첫2개 기본/3개 이후 실제 반영, begin/continue/pair snapshot 고정, old pending 재전송 차단, offline 기본 추천/완료 유지. 네이티브 변경은 unsigned Release build, 나머지는 iOS bundle 검증. QA 버튼을 통해 개인화를 공개 출시처럼 위조하지 않는다.

## 공통 검증·권한

[Wave 공통 실행 규칙](../integration-decision/release-personalization-wave.md)을 따른다. 코드 변경 전 실패 fixture, 변경 후 typecheck/UI/core/집중 테스트와 diff 검사. 운영 API·사용자 데이터·키 출력·원격 쓰기·commit/push 금지. 결과를 이 문서에 변경 파일/유지 계약/테스트/다음 결정 네 항목으로 인계한다. 문서의 구현 전 상태는 실제 증거 없이 완료로 올리지 않는다.

## A 완료 인수인계 — foreground 준비와 외부 성공 분리 (2026-09-07)

### 1. 변경 파일과 목적

- `src/ui/CourseConfirmScreen.tsx`: 최초 길찾기의 `afterHandoff(opened:true)` 선호출을 `prepareHandoff → 외부 adapter → settleHandoff(opened:실제 반환값)`으로 교체했다. throw도 실패 정착을 수행한다. 성공 후 UI 변경은 기존 progress 소유권에 더해 준비 시도 유효성을 확인한다. 후속 앱 길찾기·Live Activity pending 자동 소비는 기존 성공 후 `afterHandoff` 경계를 유지한다.
- `src/ui/liveActivity/courseProgressRuntimeModel.ts`: 직렬화된 공개 `prepareHandoff`/`settleHandoff`를 추가했다. 준비는 신규 Activity를 foreground에서 만들지만 route·routeOpenedAtMs·handoff 성공 event·출발 시각·성공 알림을 저장하지 않는다. 기존 run은 실제 진행 revision/route/확인 시각을 그대로 둔다. 실제 adapter 성공 뒤에만 해당 시도의 handoff를 commit한다.
- `src/ui/liveActivity/localProgressModel.ts`: 기존 로컬 진행 schema1에 선택적 `handoffPreparation` 메타데이터를 추가했다. run은 부모 상태, stop/revision/시도 ID/travel index/준비 결과는 메타데이터로 대조한다. 신규 준비의 `route=null`은 cold projection에서도 `routeOpened=false`다. native payload의 기존 표시 phase와 도착 버튼 계약은 보존한다.
- `test/ui/release-preflight-handoff.test.mjs`: 기존 QA 실패를 먼저 그대로 실행한 뒤, fake runtime을 실제 controller+메모리 storage/Activity/알림 port로 바꿔 같은 기존 상태 복구 기대값을 검증한다.
- `test/ui/live-activity-course-runtime.test.ts`: 새/기존 run 실패, 준비 멱등, stale token, cold 복구, Activity 거절, 늦은 receipt, 명시 출발 시각 보존, 도착 뒤 늦은 성공의 알림 계획 복구를 추가했다.
- `test/ui/place-course-screen-runtime.test.mjs`: 기존 화면 fixture를 새 준비/정착 공개 계약으로 갱신하고, 실제 screen+controller 조합으로 1곳/2곳 × 성공/실패/throw, 준비 후 background, 대기 중 중복 탭, 외부 성공 전 알림0·성공 기록0을 검증했다.
- 현재 작업 문서에 이 인수인계를 작성했다. 보드·중앙 문서는 수정하지 않았다.

이전 방식 → foreground에서 성공 이벤트를 합성하고 신규 run 실패만 취소 → QA에서 기존 revision1이 외부 실패 후 revision2로 남음 → 준비와 성공을 별도 공개 entry로 분리하고 run/stop/revision/시도 소유권으로 정착 → 정상 foreground 노출을 유지하면서 실패를 성공으로 저장하지 않기 위함. 이전 성공 합성은 **철회**, 새 경계는 **구현·자동 검증 완료**다.

### 2. 유지한 계약과 실패 정착 방식

- 첫 Activity 준비는 외부 열기보다 먼저 await한다. 실제 길찾기 성공은 기존 adapter의 OS handoff 수락 의미를 그대로 사용하며, 브라우저 닫힘이나 UI 탭 자체를 성공으로 바꾸지 않는다. 카카오 앱 내부에서 실제 이동을 시작했는지까지 검증했다고 주장하지 않는다.
- 기존 run 실패는 준비 메타데이터만 제거하여 이전 진행 상태를 정확히 보존한다. 신규 run 실패는 해당 Activity 종료를 시도하되, `route=null`·성공 event0인 명시 `failed` 준비 상태를 보관한다. 이유: native Intent가 종료와 교차해 receipt를 늦게 저장해도 cold reconcile의 기준 상태가 사라지지 않아야 한다. 이 상태는 코스 완료/취소가 아니며 기존 재시도 CTA와 최종 run cleanup을 사용한다. Activity 종료 거절도 성공 진행으로 승격하지 않는다.
- 정착 전에 durable receipt를 적용하고, 확인으로 revision/stop이 바뀌었으면 이전 실패로 종료·rollback하지 않는다. 종료 await 중 또는 그 이후 도착한 receipt도 기준 상태가 남아 복구된다. 도착 뒤 늦은 incoming 성공은 도착 상태·시각을 유지하면서 그 구간의 계획 알림 정보를 확정하고, 도착을 출발로 오인하지 않는다.
- Live Activity에서 확인한 최초 departedAt은 외부 실패/재시도와 무관하게 보존한다. 일반 앱 길찾기만으로 출발하는 경우는 실제 성공 때 기록한다. 1/2곳 snapshot·다음 구간·pending claim/자동 연결·동일 run·token lock·중복 방지·명시 완료 계약을 유지한다.
- API schedule adapter, 추천 엔진/예산, DB repository/migration, 서버 개인화, 계정/동의, 원본 데이터, App Group/권한/Swift/plugin은 수정하지 않았다. 신규 외부 호출·좌표/URL/사용자 ID 진단 적재도 없다. B 소비 entry는 선행 계약 수락 전이므로 연결하지 않았다.

### 3. 실행한 테스트와 결과

- 실패 선행: 원본 `node --test test/ui/release-preflight-handoff.test.mjs` FAIL1. 기대 revision1, 실제 revision2로 감사의 실패를 재현했다. 추가 runtime fixture도 새 공개 entry 부재로 FAIL2를 확인한 뒤 구현했다.
- 집중 화면/QA: `node --test test/ui/release-preflight-handoff.test.mjs test/ui/place-course-screen-runtime.test.mjs` **29/29 PASS**. 실제 화면·runtime을 함께 실행하며 네트워크는 금지한 fixture다.
- `npm run test:typecheck`: **PASS**. 최초 실행 중 병렬 API 파일의 미완성 import/type 오류 3건을 관찰했지만 해당 파일은 수정하지 않았고, 후속 실행에서 해소된 상태를 확인했다.
- `npm run test:ui`: **505 total / PASS504 / FAIL0 / 기존 SKIP1**. 기존 skip을 추가하거나 실패를 삭제하지 않았다. sandbox tsx IPC EPERM은 승인된 동일 명령 재실행으로 해소했다.
- `npm test`: **251/251 PASS**. 공유 worktree의 병렬 API 테스트 증가를 포함한 실행값이다.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-release-personalization-a-export`: **PASS**. 최종 UI 변경 뒤 재생성했다. Swift·plugin·native 설정 변경이 없어 이번 A에서는 unsigned native rebuild 대신 작업 명령의 iOS bundle 게이트를 적용했다.
- `git diff --check`: **PASS**. 로그: `/private/tmp/timefit-release-personalization-a-{screen,ui,core,export}.log`, bundle: `/private/tmp/timefit-release-personalization-a-export/`.
- Simulator·실기기 자동 조작·운영 API·서버 쓰기·commit/push는 수행하지 않았다.

### 4. 다음 결정·위험·실기기 확인 범위

- A는 자동 검증 완료 인계다. 기존 `.5`에서 사용자 확인한 첫 Activity 즉시 표시와 잠금화면 출발→TimeFit→카카오맵 흐름의 성공 이력은 보존하지만, 이 변경 bundle의 iOS 실제 표시/종료 timing은 **미확인**이다. QA가 최종 internal build에 이 JS bundle을 포함해 제한 검증하며 앱 삭제는 필요 없다.
- 미회수 확인은 새 build의 첫 길찾기 즉시 Activity, 실패 후 현재 단계/재시도, 잠금화면 확인과 복귀가 교차할 때 최초 시각 유지 및 추가 탭 없는 다음 길찾기에 한정한다. OS 미설치/fallback·종료 거절은 가능한 기기에서만 확인하고 자동 fixture 통과와 구분한다.
- 신규 실패의 명시 준비 상태를 저장소에서 즉시 삭제하도록 되돌리면 늦은 native receipt의 복구 기반을 잃는다. 준비 상태를 성공 route로 투영하거나 `afterHandoff(opened:true)`를 준비에 재사용하지 않는다. 성공 전에 예약 알림을 넣는 변경도 재검토 대상이다.
- B 계정/기록/개인화 연결은 **미착수·선행 DB/엔진/데이터 계약 수락 대기**다. 통합 세션은 A의 실패 재현 해소와 새 bundle 실기기 미확인을 구분해 수락하고, B의 공개 entry/type/미결정이 수락됐을 때만 후속 지시한다.

## B 부분 구현 인수인계 — 공개 계약 소비와 미충족 경계 (2026-09-07)

### 1. 변경 파일과 변경 목적

- `src/ui/personalizationSessionModel.ts`, `personalizationComposition.ts`: 현재 account와 메모리 revision을 분리해 관리하고, 검증 identity의 `readDwellPersonalizationSamples()`만 추천 시작 직전에 읽는다. 최대 1.5초 대기 후 실패/지연/미동의/guest는 빈 표본으로 기본 추천한다. account 전환 중 늦은 응답은 폐기하며 표본 배열과 원소를 복사·동결한다.
- `src/ui/recommendation/v1Session.ts`: `CourseV1Input.dwellPersonalizationSamples`에 해당 snapshot을 주입한다. first/continue/pair는 기존 runtime input을 공유하며 새 계정·동의 revision에서 옛 작업의 시작/결과 적용을 거절한다. 표본·identity는 WeakMap/runtime에만 두고 navigation/JSON continuation에 넣지 않는다.
- `src/ui/AuthContext.tsx`: 초기 getSession 늦은 응답보다 최신 auth event를 우선한다. 계정 변경/로그아웃 시 개인화 scope를 무효화한다. 가입의 나이 metadata/timestamp 합성을 제거하고 승인된 `signUpAccount(SignUpAccountInputV1)` 경계로 교체했다. Auth 실패 로그/사용자 메시지에 원시 오류를 노출하지 않는다.
- `src/ui/LoginScreen.tsx`: 나이 입력/검증을 제거했다. 실제 필수 문서 registry 조회 entry와 공개 문서 승인이 없으므로 가입 submit을 닫고 안내한다. 가짜 체크박스/링크로 production 가입을 열지 않았다. 기존 로그인·복귀·제출 중 전환 방지는 유지한다.
- `src/ui/AccountPersonalizationPanel.tsx`, `ProfileScreen.tsx`: 검증 계정의 nickname read/update와 별도 dwell consent read/set/reset을 연결했다. nickname 선택/null 삭제 및 typed 실패, 기본 미선택 동의·중복 submit 차단·서버 실패 시 기존 상태 유지·초기화 확인을 제공한다. off/reset 성공 시 해당 owner outbox를 discard한다. 동의 mutation 시작 및 성공 양쪽에서 추천 scope를 무효화해 mutation 도중 읽은 옛 상태도 차단한다. 유효 category+subCategory별 1~2개 준비 상태를 표시하되 3개 이상을 실제 엔진 적용 증거로 주장하지 않는다.
- `src/ui/AccountRecordsPanel.tsx`, `ActivityRecordScreen.tsx`: 계정은 검증된 account repository의 원격 기록만 조회하고 A→B 늦은 응답을 비노출한다. 조회 실패를 guest 기록으로 대체하지 않는다. guest의 기존 기기 기록 동작은 유지한다. **신규 account 완료 업로드·계정별 local namespace 전환까지 완성한 것은 아니다.**
- `src/ui/ResultsScreen.tsx`: 계정/동의 scope가 바뀐 이전 결과의 더보기·선택 대신 새 조건 입력으로 안내한다. `CourseConfirmScreen.tsx`는 stale review의 새 코스 시작만 차단한다. 이미 활성화된 snapshot·길찾기·시간·알림은 바꾸지 않는다.
- UI 테스트: `release-personalization-runtime.test.ts`, `release-personalization-panels.test.mjs`, `recommendation-runtime-boundary.test.ts`, `profile-settings-screen.test.mjs`. 현재 문서 외 보드/중앙 문서를 수정하지 않았다.

이전 방식 → 나이 입력·raw signup metadata, 추천에 개인화 snapshot 없음, 기록은 기기 공통 조회 → 계정과 동의 변경 시 과거 결과의 적용 경계가 없고 미승인 가입 증거를 만들 위험 → 승인 entry만 소비하고 메모리 scope/표본을 동결하며 미충족 기능만 닫음 → account 데이터의 소급 귀속과 미동의 학습을 방지하기 위함. 나이 신규 수집·임의 signup timestamp는 **철회**, 위 독립 연결은 **구현/자동 검증 완료**, 아래 항목은 **구현 대기**다.

### 2. 유지한 계약·확인한 선행 인수인계

- DB `release-identity-personalization.md`의 최신 B 완료 및 `live-activity-dwell-storage.md`를 확인했다. exact 소비는 `releaseIdentitySupabase.ts`의 identity/profile/account completion read/dwell consent·samples/outbox export다. raw table write, UI storage key/schema, 사용자 ID를 navigation에 저장하는 우회는 추가하지 않았다.
- 엔진 `release-personalization-verification.md`와 공개 `DwellPersonalizationSampleV1`, `CourseV1Input.dwellPersonalizationSamples`를 확인했다. 기본값/최신5개/3개/보정폭 정책과 2곳 session/호출 예산은 변경하지 않았다. 엔진의 실제 적용과 baseline 차이를 UI가 입증하지 못하는 경우 맞춤 label을 숨기는 보수적 기준을 유지한다.
- 데이터 `release-personalization-data.md`의 최신 사진 fail-closed·세부분류 인계를 확인했다. 미허락 사진 URL을 다른 fallback에서 재도입하지 않고 기존 기본 asset을 유지했다. missing subCategory의 준비 횟수를 합성하지 않는다.
- A의 준비/실제 handoff 분리, 정상 Live Activity/native Intent/자동 카카오 전환, guest의 진행·명시 완료·로컬 필수 저장·알림 정리는 재구현하지 않았다. 이번 B에서 Swift/plugin/iOS 설정, DB repository/schema, 추천 engine/data/API adapter를 수정하지 않았다.
- UI 화면 검증은 fixture를 주입했다. 서버 신규 표본 적재나 remote account record write를 실행하지 않았으며 실제 데이터의 A/B 격리를 검증했다고 주장하지 않는다.

### 3. 테스트와 결과

- 실패 선행: `release-personalization-runtime.test.ts`를 먼저 추가하고 새 controller 부재 `MODULE_NOT_FOUND`를 확인한 뒤 구현했다. account 늦은 응답/동결/무한 대기 방지 fixture 2개 통과.
- 실제 panel handler fixture 3개 통과: A 기록 늦은 응답+B unavailable 비노출, 미선택 동의/실패 유지/중복1회/성공 전후 invalidation, nickname null 삭제/typed validation 안내. 새 test loader의 tsx 등록 누락은 테스트 실행 경계에서 수정했다.
- 공개 recommendation runtime fixture: first→continue 동일 samples 참조·동결, session JSON의 개인 표본/identity 부재, A→B 후 continue 실행0. 기존 runtime boundary 포함 7개 통과. pair의 동일 input/기존 예산 회귀는 전체 UI suite에 포함되며 별도 실계정 pair E2E 증거는 없다.
- `npm run test:typecheck`: PASS. 추가 recommendation fixture의 불완전 diagnostics 타입을 채운 뒤 통과했다.
- `npm run test:ui`: **511 total / PASS510 / FAIL0 / 기존 SKIP1**. `npm test`: **261/261 PASS**. 공유 worktree의 다른 역할 테스트 증가를 포함한 실행값이다.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-release-personalization-b-export`: PASS. 이번 B는 native 변경이 없으므로 iOS bundle 게이트를 실행했다. `git diff --check`: PASS.
- 로그: `/private/tmp/timefit-release-personalization-b-{ui,core,export}.log`. Simulator/실기기 실행, 운영 API·remote migration·계정 생성/삭제·메일 발송·commit/push는 하지 않았다.

### 4. 다음 결정·위험·정확한 대기 계약

1. **account별 local 완료 저장/격리 및 신규 account 완료 write 대기.** `courseCompletionRepository.ts`의 현재 공개 record/store는 owner 없는 단일 기기 목록이다. `captureAccountCompletionOwner()`와 `writeAccountCourseCompletion()`는 있으나 composition에서 owner별 local 완료를 읽고/쓰고/정리하는 entry 또는 기존 local record의 귀속을 조회하는 entry는 없다. UI가 임의 namespace를 만들면 금지 경계를 넘는다. DB는 guest/legacy와 account별 필수 local 완료, account 전환/cold restore/삭제 generation을 함께 구분할 소비 entry/type을 인계해야 한다. 기존 기기 기록을 계정 기록으로 자동 승격하지 않았다. 따라서 현재 앱의 공통 local 완료가 계정별로 격리됐다고 수락하면 안 된다.
2. **명시 guest import 대기.** `prepareGuestCompletionImport/importGuestCourseCompletions/finalizeGuestCompletionImport`는 제공됐지만 입력 records의 source가 guest/legacy인지 account local인지 판별할 공개 경계가 위와 같이 없다. prepare는 현재 target에 binding하므로 질문 전에 임의 귀속시키지 않았다. DB/통합은 승인 전 source 조회, 질문 거절/재노출 기준, ack 성공분만 정리, finalize 후 다른 계정 재이관 차단을 위한 source claim/소유권 소비 경계를 인계해야 한다. 승인·거절·부분 실패 UI 테스트는 **미구현/대기**, 완료로 표시하지 않는다.
3. **신규 체류 완료 수집/submit/outbox 소비 대기.** 동의 설정·기존 적격 표본 read·다음 추천 input은 연결했으나 새 표본을 만들지 않는다. run/stop 시작 당시 account+consent 적격 snapshot을 cold restore까지 보존하는 승인 entry가 없고, dwell migration016의 submit은 동일 `account_completed` 기록과 place/category/completed minute 일치를 요구한다. 위 account 필수 local/remote 완료 연결 전에 직접 submit하거나 UI 영구 queue를 만들지 않는다. DB는 적격 snapshot의 생성/복구/철회/계정 변경 검증 계약과 완료 writer 연계를 먼저 인계해야 한다. offline 신규 적재/old pending 재전송·동의 전 수집0의 end-to-end는 **미확인/대기**다.
4. **가입·삭제 대기.** 실제 필수 문서 URL/version과 public registry reader가 없으므로 가입은 disabled다. nickname은 승인 계약을 연결했다. 계정 삭제는 Auth 삭제 성공 뒤 응답 유실에 대한 완료 판정 및 해당 계정 local/pending cleanup 범위가 DB 인계에서도 미결정이다. account record 개별/전체 삭제도 local 소유권 정리 경계와 함께 연결해야 하므로 아직 화면에 넣지 않았다. 영구 receipt나 전체 기기 기록 삭제로 우회하지 않는다.
5. **통합/실기기 게이트.** 원격 migration/registry/cleanup scheduler 미적용은 DB 인계 그대로이며 본 UI 연결만으로 production 개인화가 가동됐다고 표시하지 않는다. 승인된 최종 internal build에서 로그인→내정보·계정 기록→로그아웃/계정 전환→옛 추천 비적용, 그리고 기존 첫 카카오 전환 즉시 Activity/잠금화면 출발 자동 길찾기를 제한 확인해야 한다. 이번 bundle의 실제 네트워크·권한·OS 전환은 **미확인**이다. 위 계약 공백이 닫힌 뒤 같은 B에서 import·완료·신규 표본·삭제와 해당 실패 fixture를 이어가며, B 전체 수락 전 QA/출시 완료로 승격하지 않는다.

## B 재개 선행 확인 인수인계 — 2026-09-07

### 1. 변경 파일

- 현재 작업 문서만 갱신했다. AGENTS/README/보드, UI 최신 명령, DB 최신 최우선 보완·소유권 인계, Wave와 실제 service exports를 대조했다. 제품 코드·기존 A/B 구현은 변경하지 않았다.
- 이전의 공개 entry 부재 → DB 소유권/적격성 및 최우선 세 항목 구현 인계가 추가됨 → 이번에는 구현 부재가 아니라 명시된 통합 수락 여부를 판정 → 완료 기록과 수락을 혼동하지 않기 위함. 과거 entry 부재 판단은 당시 이력이며 현재 대기 사유로 반복 적용하지 않는다.

### 2. 유지한 계약

- 새 `completeOwnedCourseRun`은 local 성공만 반환하고 remote 호출0, cleanup 이후 `retryOwnedCourseRunSync`, 재시작은 `readPendingOwnedCourseRunSyncs`의 ID만 소비하는 계약을 확인했다. owner-scoped read/import/eligibility/삭제/registry export도 존재한다.
- `release-personalization-wave.md` 최신 통합 검토와 본문 최상단 게이트는 여전히 **DB 최우선 세 항목 보완 → 통합 수락 → UI B**다. DB 문서의 완료 인계만으로 UIUX가 통합 수락을 대신하지 않았다. 보드·서비스·엔진·DB schema 수정0.

### 3. 실행 검증

- `node --import tsx --test test/release-identity-priority-remediation.test.ts test/release-identity-device-flow.test.ts test/release-owned-completion.test.ts test/dwell-storage-contract.test.ts test/release-account-contract.test.ts`: **36/36 PASS**, FAIL/SKIP0.
- 증거: `/private/tmp/timefit-ui-b-prerequisite-check.log`. 고정 storage/identity/remote fixture이며 실제 API·원격 DB·Simulator·실기기·commit/push 실행0. 제품 코드 무변경이므로 전체 UI/core/iOS build는 이번 선행 확인에서 반복하지 않았다.

### 4. 다음 결정·재개 조건

- 통합·결정 또는 사용자가 DB의 **완료 응답·표본 재등록·인증 오류 세 보완**을 수락하고 B 연결 재개를 명시해야 한다. 현재 확인한 문서에는 그 수락 기록이 없다. 이는 원격 배포 승인 요청이 아니라 UI consumer 전환 선행 게이트다.
- 수락 후 동일 B에서 AppFlow 새 run/stop capture → owner local 완료 → exact cleanup → 별도 sync, owner별 기록 병합/import/삭제, registry 기반 가입, production factory 주입 lifecycle fixture를 이어간다. 이번 집중 PASS는 UI 쓰기→표본→추천 전체 완료 증거가 아니며 B 전체는 미완료다.

## B 수락 후 연결 인수인계 — 2026-09-07

### 1. 변경 파일·변경 목적

- `src/ui/ownedCourseLifecycle.ts`: 새 run의 `beginOwnedCourseRun`, 실제 앱 도착의 `captureOwnedStopEligibility`, 필수 `completeOwnedCourseRun`, 완료/cleanup 뒤 `retryOwnedCourseRunSync`, boot/foreground의 `readPendingOwnedCourseRunSyncs`를 조립한다. 중복 시작/동기화를 프로세스 메모리에서 합치고 영구 owner/queue key를 만들지 않았다. cold 완료에서 begin을 재호출해 현재 account로 소급 귀속하지 않는다. 공개 local 성공만 기존 완료 controller의 created/already_completed로 투영하며 실패는 성공으로 합성하지 않는다.
- `src/ui/AppFlowContext.tsx`: 실제 새 courseRunId 생성에 owner 캡처를 시작한다. 경로 안내는 이 선택 기능의 네트워크 응답을 기다리지 않는다. account 진입/foreground에서 승인 pending만 복구한다. 로그인 뒤 `GuestImportPanel`을 제공한다. 기존 저장 코스의 A→B 늦은 응답과 A 캐시 노출도 scope로 차단했다. 이미 활성 코스의 계획·순서·handoff는 변경하지 않았다.
- `src/ui/courseCompletionComposition.ts`, `CourseConfirmScreen.tsx`: 기존 완료 controller/화면을 owner-local completion에 연결했다. 로컬 저장 성공 → 기존 exact Activity/알림 정리 → active clear/완료 화면 → 별도 sync 순서다. sync는 서버 방문 ack 후에만 DB 내부에서 학습을 제출한다. `personalizedCourseLabel.ts`는 engine snapshot의 실제 stay=target이고 baseline과 다른 해당 장소만 review에서 표시한다. Results/active에 계획 체류나 임의 맞춤 표시를 추가하지 않았다.
- `src/ui/liveActivity/courseProgressRuntimeModel.ts`, `courseProgressComposition.ts`: 적용된 실제 앱 arrival event의 stable eventId·run·stop ordinal을 선택적 callback으로 전달한다. duplicate/stale는 callback0, callback throw도 공유 진행을 되돌리지 않는다. native receipt/notification의 과거 동의 적격성을 현재 동의로 합성하지 않는다. 이들 확인의 로컬 체류·진행·Activity 복구는 유지하며 당시 eligibility 증거가 없는 표본은 제외한다.
- `src/ui/ownedRecordsModel.ts`, `AccountRecordsPanel.tsx`, `ActivityRecordScreen.tsx`, `LegacyCompletionPanel.tsx`: account local 미동기화 기록을 먼저 보이고 서버 결과와 completionId로 중복 제거한다. 원격 실패에도 local 행을 유지한다. sync 결과 시 갱신한다. guest는 검증된 정상 비회원일 때 owner-scoped 기기 기록을 표시하며 인증 오류/account를 guest로 대체하지 않는다. 기존 owner 없는 자료는 별도의 “이전 방식으로 남긴 기기 기록” 영역으로 구분하고 명시 import의 `legacy_unassigned` source로 유지한다. guest/account 통계나 학습으로 합성하지 않는다.
- `src/ui/GuestImportPanel.tsx`: 로그인 제안과 기록 탭의 나중 가져오기를 연결했다. source read에는 binding0. 승인 뒤만 prepare→continue, request ID 재사용·중복 탭 차단·실패 원본 유지·부분 성공 후 남은 source 안내·거절 상태를 처리한다. imported 체류 submit0. 다른 account/언마운트 늦은 결과를 현재 화면에 적용하지 않는다.
- `src/ui/LoginScreen.tsx`: 실제 `readSignupConsentDocuments` 결과가 있을 때 문서 읽기·기본 미선택 두 필수 동의·UUID request와 정확한 version을 `signUp`에 전달한다. 빈/실패 registry는 가입만 닫는다. placeholder 문서/나이/timestamp metadata를 생성하지 않는다.
- `src/ui/OwnedDeletionPanel.tsx`, `ProfileScreen.tsx`: 기록 개별/전체 삭제는 기록 탭, 탈퇴는 프로필 관리에 둔다. 명시 확인 뒤 exact owned 삭제 port를 호출한다. 서버 reauth_required에서만 비밀번호 재로그인하며 서버의 10분 증거 판정을 소비한다. 같은 requestId 재시도, unknown 결과 안내, 서버 성공·local cleanup pending을 구분한다. 해당 owner임이 확인된 active만 exact 정리하고 다른 owner는 유지한다. **cold active owner를 증명할 공개 read가 없으면 삭제를 차단하고 코스 완료 후 재시도를 안내한다.** 이것은 전체 삭제 복구 완료가 아니라 아래 잔여 경계다.
- `src/ui/AccountPersonalizationPanel.tsx`, `personalizationComposition.ts`: 승인된 owned reset/read로 연결을 갱신했고 request/mutation ID를 UUID로 생성한다. reset 서버 성공·local cleanup pending을 구분한다. off와 reset을 같은 저장 정책으로 바꾸지 않았다.
- UI 테스트: `owned-course-lifecycle.test.ts`, `owned-account-screen-flow.test.mjs`, `fixtures/ownedCoursePorts.ts`, 기존 `live-activity-course-runtime.test.ts`, `place-course-screen-runtime.test.mjs`, `profile-settings-screen.test.mjs`, `release-personalization-panels.test.mjs`, `course-completion-history.test.ts`를 보완했다. 보드·중앙 문서·DB/engine/data/API는 수정하지 않았다.

이전 방식 → 계정 read만 연결하고 기기 완료는 공통 store에 저장 → 승인된 owner runtime이 제공돼 나머지 연결이 가능해짐 → UI는 기존 schema 대신 exact owned export를 소비하고 local 완료와 remote 전송을 분리 → 계정 전환/오프라인에도 완료를 보호하고 과거 guest 학습을 막기 위함. 이전 read-only 연결은 이력, 현재 consumer는 **구현·자동 검증**, 아래 DB 직렬화와 cold owner 삭제는 **보완 필요**다.

### 2. 유지한 계약과 검증 경계

- A의 foreground 준비/외부 성공 분리와 기존 카카오 자동 handoff, native `.5` 실기기 성공 이력은 그대로 유지했다. 이번 작업은 Swift/plugin/App Group/native 권한을 수정하지 않았다.
- 계정 namespace·run/stop 불변 eligibility·generation/epoch·7일/32건·서버180일·stable ID·visit ack→sample은 DB 공개 factory에 맡긴다. UI에서 remote sync 성공이나 개인 표본을 navigation params에 합성/직렬화하지 않는다.
- 1~2곳/120분/one-stop 및 pair 호출 예산·순위·clamp·최근5개/3개 정책, catalog/photo fallback은 변경하지 않았다. sample count만으로 맞춤 적용을 표시하지 않는다. engine metadata가 없으면 비노출이며 이는 consumer 미구현이 아니라 증거 없는 표시를 막는 정책이다.
- 계정 삭제 응답 유실의 unknown을 deleted로 표시하지 않는다. guest 전체 삭제를 account 삭제에 묶지 않았으며 별도의 guest 전체 삭제 기능은 추가하지 않았다.

### 3. 테스트·실행 결과

- 실패 선행: `owned-course-lifecycle.test.ts`를 새 UI controller 작성 전에 실행해 `MODULE_NOT_FOUND`를 확인했다. 구현 뒤 성공했다. 신규 화면 factory fixture는 실제 연결 뒤 회귀로 추가했으며 모두를 구현 전 실패 재현했다고 주장하지 않는다.
- `owned-course-lifecycle.test.ts`: production DB runtime+주입 storage/identity/remote에서 1곳·2곳, account local 완료, offline 방문 실패/표본0, cold pending 복구, 유효 표본 후 엔진 적용, A/B/guest 로컬 격리, remote 무응답과 local 완료 분리, owner 없는 cold 완료 비승격, label/기록 merge를 검증했다. 마지막 DB 직렬화 fixture는 **현 결함을 관찰하는 진단**이며 제품 수락값이 아니다.
- `owned-account-screen-flow.test.mjs`: 실제 import panel+DB factory의 source read/binding0·offline 원본 유지·중복1회·재시도 ack 정리·학습0, 실제 signup의 두 문서 미선택→명시 동의→payload, 실제 deletion panel의 서버 재인증/unknown·same request/다른 진행 cleanup0을 실행했다.
- `place-course-screen-runtime.test.mjs`: **30/30 PASS**, 실제 CourseConfirm에서 1곳/2곳 완료를 owner factory로 저장하고 active clear 뒤 sync함을 추가 검증했다. 정상 A 준비/롤백 회귀를 포함한다. `live-activity-course-runtime.test.ts`: **15/15 PASS**, 앱 arrival stable callback1/중복0·native 늦은 receipt 진행복구/소급 eligibility0 포함.
- 전체 최종 실행값은 이 절 하단 검증 확정 줄을 따른다. 증거 로그: `/private/tmp/timefit-ui-b-connected.log`, `timefit-ui-b-connected-core.log`, `timefit-ui-b-connected-export.log`, `timefit-ui-b-screen.log`, `timefit-ui-b-live.log`.
- Simulator·실기기·운영 API·remote DB·registry seed·메일 발송·실제 계정 삭제·commit/push 실행0. hook host/factory 자동 fixture는 iOS 실기기 UI나 remote RLS 실행 증거를 대신하지 않는다.

### 4. 다음 결정·재현 조건·미완료 게이트

1. **DB 보완 필요 — eligibility 조회가 필수 완료를 잠금.** `src/services/releaseIdentityPersonalizationRuntime.ts`의 `captureStopPersonalizationEligibility`는 `serialized(deps.storage, …)` 안에서 identity/원격 consent를 await한다. 같은 storage를 쓰는 `completeCourseRun`도 serialized이므로, 도착 후 동의 조회 무응답 중 완료하면 UI에서 선택 작업을 await하지 않아도 local 저장이 정지한다. fixture `DB handoff diagnostic: pending eligibility holds shared storage…`는 동의 Promise를 잠근 상태에서 local 응답 없음·visit/sample0, 잠금 해제 뒤 created를 관찰했다. 요구 합격값은 **동의 Promise 해제 전에 필수 local 저장 성공**이다. DB writer는 네트워크 조회와 짧은 원자적 storage commit을 분리하고 run/stop/epoch·terminal race를 검증해야 한다. UI success 합성·다른 store·만료 재등록으로 우회하지 않았다. `beginCourseRun`의 동일 장기 lock도 함께 점검해야 한다.
2. **DB 공개 read/복구 보완 필요 — cold active owner 및 missing run.** 현재 `beginOwnedCourseRun`은 기존 snapshot을 반환하지만 없으면 현재 owner를 새로 만든다. 따라서 cold restore/삭제 소유권 확인용으로 호출하면 과거 코스를 소급 귀속할 위험이 있다. UI는 새 run에서 얻은 proof만 메모리에 사용하며 cold unknown active 삭제는 보수적으로 막았다. DB는 없는 run을 생성하지 않는 readonly snapshot 조회(또는 동등한 복구 entry), owner별 active cleanup에 필요한 exact run identity를 제공해야 한다. 이 gate 전에는 cold active 삭제/탈퇴까지 완성했다고 수락하지 않는다.
3. **학습 누락과 거짓 학습 구분.** native/notification 도착 당시 account·consent 적격성은 현 receipt에 없으므로 현재 정보로 채우지 않는다. 로컬 실제 체류와 진행은 보존하지만 그 stop의 서버 개인화는 제외한다. native 확인도 반드시 학습해야 한다면 승인된 과거 eligibility 증거 계약이 선행돼야 한다. 추가 앱 버튼을 학습 조건으로 강요하지 않았다.
4. **남은 QA/활성화.** 전체 lifecycle을 실제 AuthProvider/AppFlowProvider와 OS 이벤트까지 하나로 묶은 실기기 E2E, remote migration/문서 registry/삭제 Edge/보유기간 scheduler 검증은 미실행이다. 같은 기록의 부분 ack 후 cold cleanup 실패, account 삭제 응답 유실·새 session 사이 race는 최종 QA가 추가 검증해야 한다. 이번 자동 PASS만으로 B 전체/출시 수락을 올리지 않는다. 위 두 DB 보완을 동일 DB 활성 작업에 반환하고, 인계 후 같은 U-RELEASE-PERSONALIZATION-01 B에서 잔여 failure fixture를 닫는다.

최종 검증 확정: `npm run test:typecheck` **PASS**, `npm run test:ui` **522 total / PASS521 / FAIL0 / 기존 SKIP1**, `npm test` **267/267 PASS**, iOS export **PASS**, `git diff --check` **PASS**. core 수 증가는 공유 worktree의 다른 역할 변경을 포함한 실행값이다. UI PASS521 중 DB lock 진단은 현 결함이 재현됐다는 뜻이며, 그 필수 local 비차단 계약까지 통과했다는 의미가 아니다. 제품 코드를 허용 소유 범위에서 연결했지만 **B 전체 완료 판정은 보류**한다.
