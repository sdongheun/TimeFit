# QA-LIVE-LEARNING-EVIDENCE-01 — 앱·Live Activity 학습 연결 검증

상태: **A 자동 게이트 PASS / B 새 서명 internal build 사용자 확인 대기 / C 전용 환경·권한 미확인**. U-LIVE-LEARNING-EVIDENCE-01 통합 코드 검토 완료. 전체 출시 승인이 아니라 DEC-LIVE-LEARNING-EVIDENCE-01 구현의 통합 회귀 검증이다.

## 1. 시작 조건과 소유 범위

AGENTS.md → docs/README.md → QA README → 본 문서 → `../uiux/live-learning-evidence-integration.md` 6절 → `../db-personalization/live-learning-evidence-contract.md` 6절 → Wave 최신 수락과 DEC-LIVE-LEARNING-EVIDENCE-01을 읽는다. 필요할 때만 현재 테스트명세/개인화 검증 문서를 연다. 과거 native 학습 무조건 제외·DB 계약 대기는 현행이 아니다. 일반 알림 액션 학습 제외는 현행이다.

QA는 test/fixture와 본 결과 문서만 수정한다. 제품 JS/Swift/DB/엔진/카탈로그/중앙 정책을 바꿔 PASS로 만들지 않는다. 결함은 실패 fixture·실제 경로·기대/관찰·담당 역할로 반환한다. 다른 세션 변경은 보존하고 시작/종료 HEAD·관련 dirty 파일·실행 시각을 기록한다. 테스트 도중 대상 변경이 있으면 영향 범위만 재검증한다. commit/push/원격 배포·운영 DB 쓰기 금지.

기존 통합 직접 재실행 근거: 집중71/71, UI549 PASS·기존skip1·FAIL0, core270/270, typecheck/diff PASS. 이는 QA 자신의 실행 결과로 복제하지 않는다. UI 인계의 unsigned Release BUILD SUCCEEDED는 실기기 설치/잠금 동작 증거가 아니다.

## 2. A단계 — 고정 fixture 자동 게이트

기존 실행형 테스트를 재사용하고 아래 빠진 경계만 최소 fixture로 추가한다. 이미 표본3개를 read mock에 넣는 방식은 신규 학습 연결 검증이 아니다. UI controller/coordinator → 실제 DB runtime factory → 주입된 방문 ack/sample repository → 실제 추천 entry를 통과시킨다. 네트워크·실시간 GPS·실시간 clock 대신 고정 port를 사용한다.

| ID | 입력·행동 | 관찰 가능한 합격 기준 |
| --- | --- | --- |
| LLE-01 | 회원+별도 동의 새 run, native-only 독립 완료3건 및 앱/native 혼합 | 실제 도착/출발 차이로 표본 생성, 방문 ack 선행, 1/2건 기본·3건 같은 복합 카테고리 실제 체류 보정. 중복 표본0, 진행 중 추천 불변 |
| LLE-02 | 최적화 방문 순서가 담은 순서와 다른 2곳 | stopId/ordinal/contentId·실제 도착 event 매핑 일치. 두 장소를 다른 장소/카테고리로 학습하지 않음 |
| LLE-03 | guest/anonymous/미동의/guest import/legacy/일반 알림/증거 손상 | 진행·완료 기록은 정책대로 유지, 해당 학습0. 로그인/on/재탭으로 과거 증거 소급 승격0 |
| LLE-04 | prepared 전/준비만/authorization 전 확인, activate ack 유실, 중복 준비, 늦은 activate | 행동 당시 실제 active token만 사용. 준비만 된 확인을 나중 승인0, active token null 덮기0, 닫힌/다른 run 부활0 |
| LLE-05 | 진행 저장 후 crash, consume 후 ack 전 crash, ack 후 cold restore, 중복/경쟁 receipt | 동일 최초 event만 replayed_first, accepted/already/excluded 뒤 exact ack, unavailable은 보존·재시도, 경쟁 event가 최초 결론 교체0 |
| LLE-06 | begin 원격/optional 저장/publish/consume 미응답 | 실제 UI 명시 완료·진행·길찾기 비차단. 필수 local 저장 실패는 성공으로 합성0. 완료 뒤 늦은 승인0 |
| LLE-07 | A→B→A, off→on/reset/delete, refresh/INITIAL_SESSION | 실제 전환은 이전 증거 차단, 같은 owner 정상 refresh는 불필요한 무효화0. 기록·표본 계정 격리, 현재 동의로 과거 증거 보충0 |
| LLE-08 | 완료/취소/만료/교체·native 제거 실패·재시작 | exact 활성 증거 정리/재시도, 다른 run 보존, 완료의 최소 pending은 유지. cold sync 가능, 기존32건/최초7일 경계·terminal 비재등록 유지 |
| LLE-09 | cold 삭제·삭제 중 계정/active 변경 | readonly 조회가 owner 생성0, proof 재검증 후 exact cleanup, 다른 계정/새 active 삭제0 |
| LLE-10 | 기존 LA 첫 시작/도착/출발·다음 길찾기 | 학습 연결로 앱 복귀·동일 버튼 재탭 요구가 추가되지 않음. 앱/native 상태 공유 회귀0 |

LLE-01은 3건이 전부 다른 courseRunId인 것을 확인한다. 동일 이벤트3회는 표본1개다. 결과에는 category/subCategory, 기본/보정 stay, 표본 수, route 호출 수를 fixture 식별자로만 남긴다. 실제 ref/token/account/email/좌표 로그 금지. 추천 안전성·호출 예산·세션 freeze는 기존 회귀를 재사용한다.

실행 순서:

```sh
node --import tsx --test test/ui/live-learning-integration.test.ts test/ui/owned-course-lifecycle.test.ts test/live-learning-evidence.test.ts test/release-identity-lock-ownership.test.ts
node --test test/ui/live-learning-native.test.mjs
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

Swift harness/전체 UI에 환경 권한이 필요하면 실패 원인을 분리하고 승인 후 재실행한다. IPC/컴파일 환경 실패를 기능 PASS 또는 기능 결함으로 임의 분류하지 않는다. 신규 skip 금지. 기존 skip의 이름·사유를 확인한다. 새 테스트가 있으면 해당 명령도 결과에 포함한다. 고정 fixture 회귀를 위해 Simulator를 하나씩 조작하거나 캡처 순회하지 않는다.

## 3. B단계 — 네이티브 산출물·최소 실기기

A 실패가 제품 결함이면 관련 B 시나리오는 보류하고 담당에게 반환한다. A 통과 시 현재 소스와 기존 unsigned build/template parity 근거를 확인한다. 변경 이후 산출물이 오래됐거나 근거가 없으면 필요 범위의 번들/네이티브 빌드를 별도 승인·환경에서 검증한다. 서명 성공·설치 완료를 unsigned 로그로 대신하지 않는다. QA가 불필요한 prebuild로 공유 생성물을 변경하지 않는다.

실기기 조작은 사용자에게 아래를 **한 번에** 요청한다. 이미 같은 빌드로 확인한 증거는 재사용한다. 별도의 실제3회 방문을 요구하지 않는다. 현재 시각을 사용하되 부산 밖이면 출발/목적지 수동 입력 가능; 이는 GPS/실제 이동 검증이 아니라 버튼·상태·전환 검증이라고 기록한다. 조기 도착/출발로 만든 테스트 체류를 실사용 학습으로 주장하지 않는다. 데이터는 전용 테스트 계정/환경으로 격리하고 운영 사용자 정보를 수집하지 않는다.

1. 새 internal build, 일반 회원+별도 동의의 새 1곳 코스에서 첫 카카오 길찾기. TimeFit 재복귀 없이 Activity 표시.
2. 잠금화면 도착 한 번 → 즉시 머무는 중 → 앱 복귀 후 같은 단계. 앱 도착 재탭0.
3. 잠금화면 출발 한 번 → 잠금 해제 → 다음/목적지 카카오 길찾기 자동 연결. 추가 CTA0.
4. 명시 완료 → 기록1건·Activity 종료·재진입 중복0. 2곳은 최적화된 첫째/둘째 장소 순서와 상태 공유 확인.
5. 활성 중 앱 재시작 후 진행 복구. 미확인인 iPhone 잠금 파일 접근/OS 강제 종료 제약은 별도 표시하고 일반 복귀 성공으로 대신하지 않는다.

요청 시 빌드 식별·입력·누른 버튼·기대 화면·관찰값을 제시한다. 로그인·별도 동의·알림·Live Activity 권한은 서로 구분한다. 권한 미허용을 학습 구현 실패로 단정하지 않는다.

## 4. C단계 — 실제 서버 반영 게이트(권한/환경 의존)

전용 검증 환경의 migration/인증/동의·방문 ack·sample 조회 준비 여부부터 확인한다. 원격이 미준비면 A/B를 막지 않고 **실제 서버 반영 미확인**으로 남긴다. 운영 키/사용자 데이터로 MCP 테스트하지 않는다. 별도 승인 없는 원격 write·migration·계정 생성/삭제 금지. 필요한 서버 관측은 DB 세션에 정확한 테스트 ID/요청 항목으로 인계한다.

실제 서버 반영의 합격은 방문 저장→허용된 최소 체류 표본 저장→같은 계정 다음 추천 read/반영 근거가 있을 때만 가능하다. 잠금화면 머무는 중 표시나 fixture3건 성공만으로 서버 학습 PASS 금지. 전용 테스트 데이터 정리는 승인된 범위에서 수행/인계하고 결과를 기록한다. 약관·개인정보 문서·원격 RLS/보유기간 운영 작업 등 기존 출시 잔여를 이번 QA로 완료 처리하지 않는다.

## 5. 결과 인수인계 형식

본 문서에 변경 파일/목적, 유지 계약, 실행 테스트/결과, 다음 담당·위험·재현 조건 네 항목을 남긴다. 각 LLE ID 및 A/B/C 상태를 PASS/FAIL/미확인/환경차단으로 구분한다. 실패는 기대값·실제값·재현 명령·원인 확인 범위·담당(UI/DB/엔진)을 포함한다. 제품 코드는 고치지 않는다.

최종 판정은 `자동 게이트 통과`, `실기기 확인 완료 여부`, `실제 서버 학습 확인 여부`, `출시 잔여` 네 줄로 분리한다. 사용자 응답을 기다리는 B/C 때문에 A 결과를 누락하거나 전체 완료로 올리지 않는다. 현재 정책을 바꿀 새 질문이 있을 때만 통합에 반환한다.

## 6. QA 독립 실행 인수인계 — 2026-09-07

### 변경 파일·유지 계약

- `test/ui/live-learning-integration.test.ts`: 기존 native-only/mixed 독립 완료3건 fixture를 재사용하되, 메모리 sample Map 직접 전달 대신 실제 DB runtime의 `readDwellPersonalizationSamples()` 결과를 실제 추천 entry에 연결했다. 복합 카테고리/체류40/개수 및 추천당 exact route2회, legacy fallback0을 명시 검증했다. 새 fixture를 중복 생성하거나 read mock에 표본3개를 미리 넣지 않았다.
- 본 문서: A 결과, B/C 별도 상태와 다음 담당을 기록했다. 제품 JS/Swift/DB/엔진/카탈로그·중앙 기준·기존 실패 기대값은 변경하지 않았다. stage/commit/push·원격 쓰기·배포·Simulator 조작0.
- 기존 회원+별도 동의·신규 run·action-time 증거·방문 ack 선행·일반 알림/guest/import/legacy 학습0, 실제 stop 순서, optional 학습 비차단, session freeze, 표본3/최근5 및32건/최초7일/서버180일 계약을 유지했다.
- 시작 17:07:30 KST, 종료 소스 확인 17:09:37 KST. 시작/종료 HEAD 동일 `e1f803e439e5cada825cc025f9c99fc475cc39ae`. dirty 상세는 아래 로그의 `status-start.log`/`status-end.log`. 기존 UI/서비스/엔진/native/test/App.tsx 전체 파일별 SHA-256 비교에서 이번 QA 테스트 보강 외 변경0. 따라서 다른 세션 제품 변경에 의한 재검증 범위는 없었다.

### A — 실행 명령·결과

로그 루트: `/private/tmp/timefit-qa-lle-baaj2y/`. 고정 clock/storage/auth/native/remote repository/route port만 사용했고 실제 API·GPS·운영 DB 호출0이다. 이는 실제 Supabase 서버 통합이 아니라 production DB factory에 repository를 주입한 통합 검증이다.

| 순서 | 실행 | 결과 | 로그 |
| --- | --- | --- | --- |
| 1 | 문서 지정 `node --import tsx --test` 4파일 | 89/89 PASS, fail/skip0 | `focused.log` |
| 2 | `node --test test/ui/live-learning-native.test.mjs` | 1/1 PASS, Swift 컴파일·프로세스 간 lock 실행 | `native.log` |
| 3 | `npm run test:typecheck` | PASS | `typecheck.log` |
| 4 | `npm run test:ui` | 550 total, PASS549 / FAIL0 / 기존SKIP1 | `ui-approved.log` |
| 5 | `npm test` | 270/270 PASS, fail/skip0 | `core.log` |
| 추가 | 보강 뒤 지정 4파일 동일 재실행 | 89/89 PASS | `focused-final.log` |
| 최종 | `git diff --check` | PASS | tool exit0 |

지정4파일은 `live-learning-integration` 23건 + `owned-course-lifecycle` 6건 + DB `live-learning-evidence` 42건 + `release-identity-lock-ownership` 18건이다. 통합 인용71과 달리 문서 지정 lock18까지 실행해89건이며 삭제/skip/누락이 아니다. 전체 UI에는 실제 cold 삭제 화면/동의 패널/학습 안전성 회귀도 포함됐다. 유일 skip은 기존 철회 이력 `순차 새 추천은 다음 검증 코스로 대표를 교체했다`다. 최초 UI 실행은 tsx 로컬 IPC `listen EPERM`으로 테스트 시작 전 차단(`ui.log`)됐고 승인 후 동일 명령 통과. 환경 실패를 제품 실패로 반환하지 않았다.

### LLE-01~10 판정

| ID | 재사용 fixture·실제 경계 | 판정·관찰 |
| --- | --- | --- |
| LLE-01 | `production UI + DB: mixed/native-only three completions...` — lifecycle/coordinator→실제 DB factory→방문 ack/sample repository→DB read→실제 `buildReleaseOneStopRepresentativeCourseV1` | PASS. 서로 다른 run-1/2/3, native-only와 mixed 각각 표본1/2/3. 카페+커피전문점, actual40분, 추천 stay30/30/40분. 각 추천 exact route2회(각 mode 3회 추천 합계6), legacy0. 방문 ack 없으면 fixture submit이 오류. 중복/cold 표본 증가0. 진행 중 freeze는 release-personalization-runtime 회귀 PASS. |
| LLE-02 | `two optimized stops...` 및 DB `two exact stop mappings...` | PASS. q→p 최적 순서, ordinal/content 매핑·actual40/40, swapped content 학습0. |
| LLE-03 | UI exclusion guest/anonymous/unpublished/notification/invalidated/legacy 및 DB invalid confirmation·guest/import/동의 회귀 | PASS. 진행 dwelling·완료 유지, 제외 표본0, 후속 로그인/on/현재 token 소급 승인0. |
| LLE-04 | publication boundary 3변형·activation ack lost·double prepare·delayed bootstrap/activate, Swift native harness | PASS. 당시 active token만, prepared 승인0, 중복 prepare token null화0, exact 종료 후 늦은 부활0. |
| LLE-05 | unavailable cold replay, consume committed/ack failed, ack 완료 cold prepare, competing stale receipt | PASS. 최초 firstArrival durable 복구, accepted/already/excluded exact ack, unavailable 보존, 경쟁 event 교체0/중복 sample0. |
| LLE-06 | optional consume hang·publication/evidence write hang·owned lifecycle begin 무응답·필수 local 실패 | PASS. 명시 완료/진행 비차단, 미확정 학습0, 필수 저장 실패 성공 합성0, late callback 승격0. |
| LLE-07 | account/off/reset/delete 및 production Auth observer INITIAL_SESSION/refresh | PASS. A→B→A 무효화, 동일 owner refresh 보존, off→on 과거 재생0. |
| LLE-08 | cancelled/expired/replaced·cold cleanup·DB orphan/33rd/7-day fixture | PASS. 다른 run 보존, exact native cleanup 재시도, 최소 pending cold sync 유지, terminal 재등록0. 서버180일은 기존 repository 계약 회귀이며 원격 상태 확인 아님. |
| LLE-09 | `owned-account-screen-flow` cold deletion switched=false/true + lock ownership readonly/proof | PASS. 실제 삭제 화면과 production readonly proof, 조회 owner 생성0, await 뒤 subject/active 재검증, 다른 run 삭제0. |
| LLE-10 | 기존 live-activity runtime/pending-navigation 및 실제 place-course screen tests | 자동 PASS. 첫 준비→실제 handoff·도착/출발·추가 CTA 없는 다음 길찾기 연결 유지. OS 잠금/앱 자동 전환은 B 미확인. |

실제 ref/token/account/email/좌표를 결과 로그에 출력하지 않았다. 제어된 fixture identity만 테스트 내부에서 사용한다. 현재 A에서 담당에게 반환할 제품 결함은 발견되지 않았다.

### B — 산출물 확인·사용자 요청

- 기존 `/private/tmp/timefit-learning-native-build.log`의 `BUILD SUCCEEDED`와 `/private/tmp/timefit-learning-release/Build/Products/Release-iphoneos/mobile.app`의 binary/main.jsbundle 존재 확인. binary 16:25:00, bundle16:26:45 KST. 관련 제품 소스는 해당 로그 종료 이후 변경 없음.
- template 비교의 초기 차이는 `__APP_GROUP_IDENTIFIER__` 치환이었다. config plugin의 실제 치환을 적용하여 생성 앱/extension Swift parity PASS를 확인했다. prebuild/생성물 수정/재빌드하지 않았다.
- 인계 명령은 `CODE_SIGNING_ALLOWED=NO`다. 현재 서명·설치 완료를 입증하지 못하므로 **B 미확인**. 기존 `.5` native 성공을 새 학습 연결 소스의 실기기 성공으로 대체하지 않는다.
- 다음 UIUX/빌드 담당: 현재 소스로 서명된 internal build를 준비하고 build 번호/소스 식별을 제공한다. 사용자에게 새 빌드와 전용 테스트 계정/환경 준비 후 아래만 한 묶음 요청한다. 실제3회 방문/서버 표본3개 생성은 요구하지 않는다.
  1. 일반 회원+별도 학습 동의의 새1곳 코스, 현재 시각·부산 수동 입력 허용 → 첫 카카오 길찾기 → 재복귀 없이 Activity 표시.
  2. 잠금 도착1회 → 머무는 중 → 앱 복귀 동일 단계(앱 도착 재탭0).
  3. 잠금 출발1회 → 잠금 해제 → 다음/목적지 카카오 길찾기(추가 CTA0).
  4. 명시 완료 → 기록1건·Activity 종료·재진입 중복0. 2곳은 최적화 첫/둘째 순서와 상태 공유만 확인.
  5. 활성 중 앱 재시작 → 같은 코스/단계 복구. 최초 잠금 해제 전 파일 접근·OS 강제 종료/재부팅 제한은 별도 미확인.
- 회신은 빌드 식별,1~5별 정상/이상과 해당 버튼·화면 관찰만 요청한다. 계정·토큰·위치 원문은 보내지 않는다. 로그인/동의/알림/Activity 권한을 혼동하지 않으며 조기 버튼 확인은 UI smoke이지 실제 체류 학습 증거가 아니다.

### C — 환경·권한 판단 및 다음 담당

**실제 서버 학습 미확인**. 이번 요청은 별도 승인 없는 원격 write를 허용하지 않으며 전용 검증 환경 식별·적용 migration·안전한 테스트 계정/동의·표본 조회 권한이 제공되지 않았다. 운영 env/DB를 대신 사용하지 않았다. A/B와 분리하여 C 실행은 보류한다.

DB 담당에게 `QA-LIVE-LEARNING-EVIDENCE-01 C`로 인계: 전용 환경의 migration/인증/동의 준비, 승인된 테스트 run의 방문 ack→sample 저장→동일 owner 다음 추천 read 근거, 테스트 데이터 정리 권한/방법을 확인한다. 준비 확인과 명시 승인 뒤에만 제한 실행을 판단한다. 표본 조회/서버 적용이 확인되지 않은 상태에서 B의 머무는 중 표시를 서버 학습 PASS로 기록하지 않는다.

### 최종 4줄 판정

- 자동 게이트: **A PASS** — 집중89·Swift1·UI549/기존skip1·core270·typecheck/diff.
- 실기기 확인: **B 부분 확인** — 아래 사용자 관찰 회수 참조. 빌드 식별·나머지 항목은 미확인.
- 실제 서버 학습: **C 미확인** — 전용 환경·권한 확인 후 별도 승인 판단.
- 출시 잔여: 개인정보/약관·원격 RLS/보유기간·서명/최종 배포 게이트는 이번 QA로 완료 처리하지 않음.

### B 사용자 관찰 회수 — 2026-09-07

- 사용자 보고: 2곳 코스로 진입됨. 모든 장소 방문이 끝나 목적지로 돌아가야 할 때 `복귀 길찾기`가 표시됨. 이어서 같은 코스·복귀 길찾기 단계가 앱 종료·재실행 뒤 유지되는지에 대한 확인 요청에 **“확인되었다”**고 응답했다. 해당 단계의 재시작 복구는 사용자 관찰로 확인하며 반복 요청하지 않는다.
- 설명 정정: 앱 본문에 반드시 `머무는 중` 문구가 있어야 한다는 QA 안내는 부정확했다. 실제 CourseConfirm은 도착 후 stay 단계에서 다음 행동 버튼을 표시한다. 첫 장소 뒤에는 `다음 장소 길찾기`, 최종 장소 뒤에는 목적지 설정에 따라 `도착지 길찾기`/`복귀 길찾기`다. 버튼 활성화 자체가 출발 완료는 아니다. 앱 재시작 검증은 문구 유무가 아니라 같은 코스·단계·다음 행동 보존으로 판정한다.
- 범위: B-5의 보고된 최종 장소 이후 복구는 확인. B-4는 2곳 진입과 마지막 복귀 버튼까지 확인했으며, 전체 A→B 순서/명시 완료 기록1건·Activity 종료·중복0은 이 응답만으로 추가 수락하지 않는다. B-1~3, 새 빌드 식별/회원·동의 조건 및 OS 잠금 파일 접근·재부팅 제약도 별도 미확인이다. C 실제 서버 학습은 계속 미확인이다.
- 이번 변경은 이 문서의 관찰·안내 정정뿐이다. 제품/정책/자동 fixture는 변경하지 않았고 자동 게이트 결과는 유지한다. `git diff --check` 통과; 테스트·기기·API/DB 재실행 및 commit/push0. 다음 QA는 미회수 증거만 확인하며 UIUX/빌드 담당의 artifact 식별과 DB 담당의 C 환경·권한 인계를 기다린다.
