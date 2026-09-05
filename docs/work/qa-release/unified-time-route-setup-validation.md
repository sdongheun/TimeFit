# QA-SETUP-UNIFIED-01 — 통합 입력 기능·회귀 검증

상태: **완료·수락 — 자동 기능·회귀 게이트 통과 / 일반 배치 수락 유지 / 요청한 실기기 1~4 확인 완료**

## 목적·근거·범위

U-SETUP-UNIFIED-01 및 개발 영역 제외 배치 보완의 기능 연결을 검증한다. 사용자는 2026-09-05 캡처로 **개발 버튼을 제외한 일반 입력이 한 화면에 잘 배치됨**을 확인했다. 이 시각 배치는 수락하며 재설계하거나 같은 캡처를 다시 요구하지 않는다. 캡처는 위치·시간 입력의 유효성이나 추천 성공을 증명하려는 자료가 아니므로 그 입력값을 사용자 테스트 실패로 분류하지 않는다. 모든 기기·큰 글씨·제스처까지 확인한 것으로도 확대하지 않는다.

이전 중간 경로/시간 화면 → 반복 진입 문제 → 출발·도착 직접 선택과 상시 휠·slider·하단 CTA → 한 화면 입력 → **구현 완료·QA 전**. 일반 영역과 개발 버튼을 함께 압축한 초기 구현은 보완됐으며 개발 버튼은 일반 영역 아래에 추가한다. 내부용 본문 스크롤은 정상이다. 과거 route-apply·시간 sheet를 요구하는 검증은 철회한다.

관계: REC-01/18 및 공통 규칙 3-2의 통합 입력 보완. 엔진 정책·API·저장 경계는 변경하지 않는다.

## 복사할 작업 명령

```text
QA-SETUP-UNIFIED-01을 진행해. AGENTS.md, docs/README.md, docs/work/qa-release/README.md, 이 파일과 docs/work/uiux/unified-time-route-setup.md의 최종 보완 인수인계를 읽어. 기준은 docs/테스트.md의 REC-01/18 및 통합 입력 확정 절, UIUX 공통 규칙·테스트명세의 2026-09-05 통합 입력 확정 절이다. 과거 archive 전체는 읽지 마.

사용자는 개발 버튼을 제외한 현재 화면 배치를 수락했다. 이를 다시 디자인하거나 캡처의 임시 입력값을 실패로 판정하지 마. 아래 기능 검증을 고정 fixture로 먼저 실행해. Simulator를 버튼 하나씩 조작하거나 운영 API·GPS·DB를 반복 호출하지 마. 자동 단계의 실제 외부 호출은 0이다.

1. 기존 test/ui/unified-time-route-setup.test.mjs의 26개 테스트와 production 연결을 먼저 읽고 실행해. 실제 TimeSetup/TimeWheel/선택기/CAPTCHA handler가 실행되는지, fake port 카운터가 실제 호출 경계에 연결되는지 확인한다. 기존 충분한 fixture를 다시 만들지 않는다. 누락이 있을 때만 QA 소유의 별도 테스트 파일에 실패 재현을 추가한다. production 코드·기존 UIUX 소유 테스트·env·의존성·정책을 수정하지 마.

2. 아래 US-01~08을 테스트 이름·입력·관찰값과 연결해 판정한다. 임의 contentHeight 주입이나 style 계산은 Yoga/native 렌더 증거가 아니므로 구분해 기록한다.
US-01: 출발·도착 선택/확정/취소/검색↔지도/뒤로가기가 같은 setup으로 돌아오며 다른 필드 보존. 취소 뒤 늦은 주소 응답은 미적용.
US-02: 목적지 null은 출발지 복귀, 복귀 모드 출발지 변경은 새 출발지 복귀, 명시 목적지는 유지. GPS 허용 초기 1회·거절/실패 수동 대안·늦은 GPS/라벨의 수동 선택 덮어쓰기 0. 새 권한 자동 요청 0.
US-03: 상시 휠 정착 값 즉시 반영, 별도 적용 불필요. 사용자 wheel 새 행/slider 5분 변화만 haptic, programmatic 복원과 일반 버튼 haptic 0. 기본 여유10·5~30/step5 유지.
US-04: 미선택·과거/0분·1분·120분·121분, 오전/오후 변경, 실행 직전 시간 경과·자정 기존 계약을 fake clock으로 확인. 잘못된 시간에 추천 호출0, 날짜 임의 이월/자동 연장0. 현재 snapshot 날짜 의미의 기존 한계는 새 결함과 구분해 인계.
US-05: Auth loading, CAPTCHA 성공/취소/실패/늦은 callback/재시도, 빠른 연타에서 유효 실행1회. 실패 후 입력 유지, 편집만으로 추천/저장/active 취소0. 익명 proxy 세션을 일반 계정으로 취급하지 않음.
US-06: production/internal 일반 입력 tree와 viewport 기준 동일. 개발 버튼 없는 기본 375×812/390×844/402×874 fontScale1은 무스크롤 예산. internal 개발 버튼은 일반 영역 뒤 추가 높이로 스크롤 접근, 두 개발 기능과 QA8개 진입 유지. 개발 버튼을 포함해 일반 영역 축소 금지.
US-07: 하단 CTA는 본문 밖 safe area, picker/CAPTCHA 뒤 배경 실행 차단. 작은 화면/큰 글씨/긴 위치명/짧은 viewport는 overflow 허용하고 입력과 CTA 접근 유지. 선택기 키보드 동작을 hook host만으로 실기기 통과라 하지 않음.
US-08: 추천 session의 origin/destination/now/end/buffer/device point가 입력과 일치하고 기존 loading/results 연결 유지. 새 화면 진입으로 진행 중 코스 취소0. 관련 기존 회귀 테스트 재사용.

3. node --test test/ui/unified-time-route-setup.test.mjs, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check를 실행한다. 인수인계 기준은 집중26/26·UI352 pass/기존 skip1·전체161/161·map14/14다. 병렬 작업으로 수가 바뀌면 근거와 추가/누락을 기록하며 숫자를 맞추려고 skip/삭제하지 마. 실패0이 합격 기준이다. 기존 의도 skip 외 새 skip은 허용하지 않는다.
UIUX의 마지막 iOS export 로그 /private/tmp/timefit-setup-dev-ios.log와 산출물 /private/tmp/timefit-setup-dev-ios를 읽고 성공·대상 시점을 확인한다. 없거나 이후 UI/native 변경으로 증거가 오래됐으면 별도 임시 출력 경로로 iOS export를 한 번 실행한다. 빌드 설치·앱 삭제·Metro 초기화는 자동 지시하지 마.

4. 자동 게이트 실패는 첫 재현 입력·expected/actual·파일/라인·소유 세션으로 반환하고 제품 수정은 하지 마. 기본 시각 배치 수락을 번복할 필요가 있는 실제 가림/터치 불가 증거가 없으면 디자인 수정 작업을 만들지 않는다.

5. 자동 통과 뒤 미확인 native 동작만 사용자에게 한 번에 요청한다: 같은 입력 화면에서 위치 검색/지도 선택 및 취소, 휠/slider 촉각, 유효 시간으로 추천, 개발 영역까지 스크롤하여 두 버튼 접근. 이미 같은 빌드에서 확인된 항목은 재요청하지 않는다. CAPTCHA는 실제 나타났을 때만 확인하고 강제 재인증·로그아웃은 하지 마. 큰 글씨/키보드/제스처에서 아직 증거 없는 항목은 미확인으로 구분한다. 자동 기능 통과와 사용자 native 확인 대기를 별도 상태로 남겨.

완료 인수인계에는 변경 파일/목적, 유지한 공개 계약, US별 fixture·결과·명령·수치·로그와 실제 외부 호출 횟수, 다음 담당/미확인 위험을 이 파일에 기록해. 중앙 문서·보드·UIUX 코드를 수정하거나 커밋하지 마.
```

## 실행 순서

- 선행 UIUX 구현·배치 보완 완료. 자동 QA 실행 가능.
- TimeSetup과 TimeWheel 변경 세션은 게이트 동안 편집을 멈추거나 QA에 변경 시점을 인계한다. 다른 경계의 작업은 가능하다.
- 현재 완료 판정: **사용자 일반 화면 배치 수락 / QA 기능·native 게이트 미실행**.

## QA 실행 인수인계 — 2026-09-05

위 실행 전 판정은 아래 결과로 갱신한다. 일반 영역 무스크롤 배치의 사용자 수락은 유지하며, 자동 기능 통과를 모든 native 동작의 통과로 확대하지 않는다.

### 변경 파일·소유 경계

- 이 작업 문서만 수정해 실행 결과와 미확인 항목을 기록했다. 기존 26개 실행형 fixture가 충분하여 중복 테스트를 추가하지 않았다.
- 제품 코드·기존 UIUX 소유 테스트·엔진·API·DB·env·의존성·중앙 문서·보드는 수정하지 않았다. 기존 dirty worktree는 보존했고 stage/commit/push하지 않았다.
- REC-01의 1~120분, 목적지 null=출발지 복귀, 여유 기본10/범위5~30/step5, 사용자 변화에만 선택적 haptic, 인증·호출 예산·저장·진행 중 코스 계약을 유지했다.
- 게이트 전후 TimeSetupScreen/TimeWheel/집중 테스트 SHA-256이 동일했다. 각각 `1949bb38ee7ec74d723df016606cff557cfe4ffac57154780152502c2112e98e`, `179e2ec07ea5eaf99e984e48ba4e05591e117bf64bb2b597b87f489308abe52a`, `d5f38b951c9f671452d2f16ebc2c8b08b7c3a9381fc6748fe0eaf97d384dbc52`.

### US-01~08 고정 fixture 판정

실행 기준은 `test/ui/unified-time-route-setup.test.mjs`다. hook host가 실제 TimeSetupScreen·TimeWheel 및 실제 검색/지도 선택기·CAPTCHA handler를 실행한다. 추천/session·위치 권한/GPS·검색/주소 resolve·haptic·navigation fake는 해당 production 호출 경계에 연결돼 있다. 테스트마다 global fetch를 차단하고 호출0을 검사한다. 실제 외부 API/GPS/DB 호출 **0회**, Simulator 조작 **0회**다.

| ID | 테스트 식별·입력 | 관찰값·판정 |
| --- | --- | --- |
| US-01 | `direct fields`, `real search and map ports`, `picker map→search` — 고정 O/D, 검색↔지도·확정·취소·뒤로가기, 지연 라벨 | 동일 setup 필드 보존, 명시 검색/확정만 port 실행, 취소 뒤 늦은 라벨 미반영. 자동 통과. |
| US-02 | `already-permitted GPS`, 권한 거절/미결정/조회 실패 및 late GPS 변형 — 고정 좌표 | 허용 GPS 초기1회, 새 권한 요청0, 수동 대안과 blur/unmount 무효화, 수동 출발지 덮어쓰기0. null 복귀와 명시 목적지 보존 통과. |
| US-03 | `wheel commits immediately` — 실제 휠 새 행/관성·programmatic 복원, slider20 및 동일 값 반복 | 휠 즉시 반영, 새 행 haptic2와 slider 새 값 haptic1, 중복/복원 silent. 여유 기본값·범위·step 계약과 session buffer20 보존 확인. native 촉감은 별도 대기. |
| US-04 | 0/1/120/121분 변형, `missing origin, elapsed execution and midnight` — fake clock 12:00, 실행13:01, 23:50→00:01 | 오전/오후 포함 실제 휠 handler 실행. 유효1/120만 추천, 누락/과거/0/121 및 경과 후 무효 입력 추천0. 다음 날짜 자동 이월/시간 연장0. 자동 통과. |
| US-05 | `CAPTCHA wait`, `cancel/stale verification`, `auth loading`, `actual CAPTCHA WebView failure` | 취소·늦은 bridge·auth loading 차단, 연타 유효 실행1회, 실패 입력 유지와 명시 retry, 익명 proxy 계약 통과. 편집만으로 추천/저장/active 취소 없음. |
| US-06 | 기본375×812/390×844/402×874 변형, `general region uses the whole viewport`, `production hides dev tools` | production/internal 일반 tree·viewport 동일, 일반 무스크롤 예산 유지. 내부 개발 영역은 뒤에 추가돼 스크롤, 두 기능과 launcher8개 fake 실행 유지. 일반 영역 축소 없음. |
| US-07 | `fixed CTA`, `small screen/large type and keyboard-sized viewport` — 320×568/fontScale2/긴 라벨/viewport200 | 본문 밖 safe-area footer, picker/CAPTCHA 중 배경 CTA 차단, overflow 접근 구조 통과. 주입 contentHeight·style 계산은 Yoga 렌더/키보드/제스처 증거가 아님. |
| US-08 | `session preserves fields and device point`, `wait captures fresh remaining time` 및 기존 UI 회귀 | O/D·실행 now·end에서 재산정한 remaining·buffer20·device point 일치, CAPTCHA 대기 후 remaining55, loading 진행/Results replace1. 편집/진입으로 active 취소 없음. 자동 통과. |

### 명령·결과·로그

로그 루트: `/private/tmp/timefit-qa-setup-unified-RyyW37/`.

| 순서 | 명령 | 결과 | 로그 |
| --- | --- | --- | --- |
| 1 | `node --test test/ui/unified-time-route-setup.test.mjs` | 26/26 pass, fail0/skip0 | `focused.log` |
| 2 | `npm run test:typecheck` | exit0 | `typecheck.log` |
| 3 | `npm run test:ui` | 353 total, 352 pass, fail0, 기존 skip1 | `ui-approved.log` |
| 4 | `npm test` | 161/161 pass, fail0/skip0 | `core.log` |
| 5 | `node --test test/map-transport-ui-contract.test.mjs` | 14/14 pass, fail0/skip0 | `map.log` |
| 6 | `git diff --check` | exit0 | `diff-check.log` |

UI 최초 실행은 테스트 시작 전 tsx 로컬 IPC 생성이 sandbox `listen EPERM`으로 차단됐다(`ui.log`). 권한 승인 후 동일 명령을 재실행하여 통과했다. 제품 실패가 아니며 fixture 변경·skip 추가 없이 인수인계 예상 수치와 일치했다.

iOS 증거는 기존 `/private/tmp/timefit-setup-dev-ios.log`의 `Exported: /private/tmp/timefit-setup-dev-ios` 및 metadata·실제 hbc 산출물로 확인했다. metadata 시점은 2026-09-05 15:56:33 KST이고 TimeSetup/UnifiedSetupInputs의 15:54:36, TimeWheel의 15:46:38 변경을 포함한다. src/ui·App·앱 설정/의존성 및 ios 프로젝트 소스(Pods/build 제외)에 export 이후 변경이 없어 재export하지 않았다. 설치·앱 삭제·Metro 초기화도 수행하지 않았다.

### 다음 담당·미확인 native 확인 묶음

- 사용자에게 현재 빌드에서 아직 확인하지 않은 항목만 한 번 요청한다: (1) 같은 setup에서 위치 검색/지도 선택·확정·취소 및 키보드 복귀, (2) 휠 정착 즉시 반영과 slider 5분 변화 촉각, (3) 유효 미래 시간으로 추천1회 및 결과 연결, (4) 내부 개발 영역 스크롤 후 개발 테스트 시각/출시 추천 QA 두 버튼 접근. launcher8개 실제 API 재실행은 요청하지 않는다.
- CAPTCHA는 자연스럽게 나타날 때만 확인한다. 강제 재인증·로그아웃은 하지 않는다. 같은 빌드에서 이미 확인한 항목은 보고만 받아 중복 요청하지 않는다. 기본 배치 캡처는 재요청하지 않는다.
- 큰 글씨 native 렌더·키보드 가림·native 뒤로가기 제스처·실제 촉감은 고정 fixture만으로 확정하지 않는다. 사용자 관찰이 없는 항목은 미확인으로 남긴다.
- 시간 입력은 기존 snapshot 날짜/당일 분 의미를 유지한다. 자정 이후 다음 날짜를 자동 추론하는 기능을 새로 보장하지 않는다. 자동 실패 반환은 없으며 native 실패 시 입력·관찰·기대값을 받아 기존 U-SETUP-UNIFIED-01(UIUX)에 반환한다.
- 최종 판정: **자동 게이트 통과 / 사용자 일반 배치 수락 유지 / 위 native 확인 대기**.

### 사용자 실기기 확인 회수·최종 인수인계 — 2026-09-05

- 위 대기 상태 이후 사용자가 요청 묶음에 대해 **“확인 완료”**라고 회신했다. 요청한 1~4 항목의 사용자 확인 완료로 수락한다: 위치 검색↔지도 선택·확정·취소와 입력 유지/키보드 복귀, 휠 즉시 반영과 slider 5분 변화 촉각, 유효 미래 시간 추천→결과 연결, 개발 영역 스크롤과 두 버튼 접근.
- 증거는 사용자 직접 관찰 보고다. QA가 기기를 직접 조작하거나 캡처를 재요청하지 않았다. CAPTCHA 실제 출현 여부, 모든 기기·큰 글씨 조합, native 뒤로가기 제스처는 별도 보고가 없어 실기기 통과로 확대하지 않는다. 이들은 확인 범위의 한계로 보존하며 반복 실행을 요청하지 않는다.
- 변경 파일은 이 문서뿐이며 목적은 실기기 결과 회수와 상태 최종화다. 제품 코드·공개 계약·수락된 무스크롤 배치·중앙 문서·보드는 변경하지 않았다. stage/commit/push하지 않았다.
- 자동 게이트는 위 실행 결과(집중26, UI352/기존 skip1, 전체161, map14, typecheck 통과)를 유지한다. 이번 문서 갱신에서 자동 테스트·외부 API·Simulator를 재실행하지 않았으며 `git diff --check`를 통과했다.
- 다음 세션: 통합·결정 역할은 이 인수인계를 근거로 중앙 상태를 동기화할 수 있다. 반환할 실패나 추가 사용자 결정 요청은 없다. **QA-SETUP-UNIFIED-01은 지정 범위 완료·수락**이다.
