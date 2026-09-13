# QA-LEGACY-REMOVE-VERIFY-01 — D 검증 인계

작성일: 2026-09-13. 최신 상태: **D 재검증 PASS / 자동 검증 완료·실기기 수락 대기**. 아래 최초 FAIL은 이력이며, 최종 결과는 문서 끝의 재검증 인계를 따른다.

## 기준과 범위

- [R1 실행 명령의 D](legacy-four-screen-removal-command.md), [B 대응표](legacy-four-screen-removal-prep.md), [C 구현·테스트 인계](../uiux/legacy-four-screen-removal.md)를 대조했다.
- A 복구 기준 `955931e`, 현재 HEAD `8c57a9cedade6836720a93dfb35c79982f84fbdf`. C의 미커밋 제품/UI 테스트 변경과 기존 `output/`은 보존했다. 명령 문서 상단의 B 대기 표시는 이전 상태로 남아 있으나, 최신 사용자 D 명령과 C 인계에 따라 실행했다. 중앙 문서 상태를 임의 갱신하지 않았다.
- QA 소유 테스트와 이 인계 문서만 변경했다. 삭제된 제품 화면을 복원하지 않았고 제품 기능 코드 수정, 테스트 삭제/skip 추가/탐색 축소, DB·migration 변경, 외부 공급자 호출, Simulator·실기기 조작, stage/commit/push는 하지 않았다.

## 테스트 대응과 변경 파일

| QA 변경 파일 | 이전 의존 → 현행 검증 |
| --- | --- |
| `test/ui/current-flow-refactor-safety.test.mjs` | 1/2곳 projection의 과거 3인자 → 공개 2인자. 장소 순서·제목·identity/run/progress 기대값 유지 |
| `test/ui/legacy-course-auto-query.test.mjs` | 명시 refresh 유지 1건 → 전용 상태·API 미노출/과거 조회0. guest·로그인·계정 전환의 현재 복원/owner 재개 3건 유지 |
| `test/course-replan-contract.test.mjs` | 삭제 Execution 파일 읽기 → 현재 CourseConfirm의 GPS0·수동 proof 게이트·원본 마감 전달. 보존 SQL 원자 교체/최초 시각 불변 및 repository RPC 2건 유지 |
| `test/map-transport-ui-contract.test.mjs` | 삭제 OneStop/Execution의 링크 연결 → 실제 PlaceDetail/CourseConfirm의 앱 우선 연결. shared schedule의 URL·웹 복귀/취소와 나머지 현재 지도·입력·진행 계약 유지 |
| `test/mixed-travel-contract.test.mjs` | 과거 결과 화면의 재계산/체류 선택 UI → 현재 snapshot 확인·장소 상세 역할 분리. 보존 엔진 자동 수단/basket helper·repository/schedule mode와 현재 route의 각 leg mode 전달 유지. 과거 최소/권장 선택 UI를 복원하지 않음 |
| `test/ui/qa-odsay-removal-execution.test.mjs` | 삭제 Execution 2건 → 실제 보존 repository에서 geometry 유/무 ODsay 기록 조회 후 snapshot 불변, 실제 travel의 명시 transit 재요청 실패/geometry 없음, HTTP·가짜 ODsay 키 읽기·cache/신규 저장0. 별도 현재 verified review에서 기존 진행 교체 취소/보존 확인. 과거 snapshot을 현재 verified로 승격하지 않음 |
| `test/ui/release-preflight-handoff.test.mjs` | 사용하지 않는 resetToMyCourses mock만 제거. 기존 Live Activity rollback 검증 유지 |
| `test/ui/qa-current-course-expiry.test.mjs` (신규) | 미확인 만료 → 현재 CourseConfirm 실제 mount/시작 CTA, 고정 clock의 120/180분 정상 대조·정확 마감·직후 6건. 실패 4건을 red로 보존 |

C 소유 `course-date-screen-boundary`, `manual-location-restore`, `odsay-removal-screen` 등은 직접 수정하지 않았다. C의 `test/ui/fixtures/currentConfirm.mjs`를 재사용했다. B의 제거 검증 5건도 그대로 실행했다. `test/index.js` 발견 경계를 수정하지 않았다.

현재 확인 화면은 저장소 save/replace를 연결하는 화면이 아니다. 따라서 보존 repository 날짜/과거 기록 계약과 현재 verified 실행 계약은 별도로 검증하며, 삭제 화면을 다시 연결해 두 계약을 억지로 합치지 않는다. 경로 누락/비정상 시간에 현재 시작을 차단하는 C 소유 ODsay 6건도 전체 UI 회귀에서 유지된다.

## 만료 재현 — UIUX 반환

### 고정 조건

1. `nowIso=2026-12-31T14:50:00.000Z` (KST 12/31 23:50), remainingMin 120 또는 180, 유효한 수동 위치 proof, 1곳 검증 snapshot, 활성 코스 없음.
2. stop arrival/departure도 원본 시작 날짜로 맞추고 이동5+체류20+복귀5+buffer10의 snapshot을 사용한다. remaining 표시 값 역시 해당 120/180 입력으로 계산한다.
3. 시작 1분 후 review를 mount한다. 정상 대조군은 이 시각에 시작한다.
4. 실패군은 화면을 유지한 채 clock만 `nowIso + remainingMin*60000` 또는 그 시각+1ms로 옮기고 기존 시작 CTA를 누른다. KST 마감은 익년 1/1 01:50 또는 02:50이다.
5. 기대: 마감 이상이면 새 active 생성0, 기존 진행 보존, 외부 길찾기0. 관찰: **start 포트가 1회 호출되어 새 run이 생성**된다. 정상 대조 2건은 start1로 통과한다.

재현: `node --test test/ui/qa-current-course-expiry.test.mjs`.
결과: **6건 중 2 PASS / 4 FAIL / skip0**. 로그 `/private/tmp/legacy-d-expiry.log`.

### 원인·영향 경계

- `CourseConfirmScreen.tsx`의 proof 없는 복원은 `ManualLocationRestoreGate`에 원본 마감을 전달한다. 이 경로의 만료 거절은 C 날짜 테스트가 검증한다.
- 반면 proof가 있는 review의 `verified-course-start`는 `startController.request`로 직접 진입한다. `createActiveVerifiedCourseStartController`는 중복/기존 진행 교체를 관리하지만 마감 시각을 검사하지 않는다.
- provider의 `startActiveVerifiedCourse` 역시 검증 모델을 생성하고 lifecycle/학습 시작 연결을 진행하며, 별도의 만료 guard가 없다. fixture에서는 이러한 외부 lifecycle을 메모리 포트로 격리했으므로 **실제 서버 저장·알림 생성까지 일어났다고 주장하지 않는다**.
- 현재 CourseConfirm 파일 diff는 없고, startController/provider start 본문도 C 변경에서 바뀌지 않았다. 따라서 삭제로 새로 추가된 로직 결함으로 단정하지 않으며, **이번 검증에서 드러난 기존 현재 경로의 만료 공백**으로 반환한다. 과거 OneStop 저장 전/후 검사를 삭제 화면 복원으로 해결하지 않는다.
- 과거 날짜 화면 테스트를 현재 수동 재선택 만료로 옮긴 것만으로 review 대기 만료까지 PASS라고 할 수 없다. 이번 red 검증을 보존한다.

담당: **UIUX (`U-LEGACY-SCREENS-REMOVE-01` 인계의 현재 경로 미확인 사항)**. 새 ID 생성 없이 D 차단점으로 반환한다. 현재 시작 진입 및 기존 코스 교체 확인 대기 후 승인 경계에 적용할 원본 마감 guard/사용자 재설정 안내를 UIUX가 검토해야 한다. 기존 진행 재개와 신규 시작·교체를 혼동하지 말고 기존 run/저장 데이터는 보존해야 한다. 수정 후 이 6건과 교체·복원·전체 회귀를 재실행한다. QA는 제품 수정을 하지 않았다.

## 자동 게이트 결과

| 실행 | 결과 | 로그 |
| --- | --- | --- |
| 제거+보존 집중 7파일 | **43/43 PASS**, skip0 (제거5·기존 보존14 포함) | `/private/tmp/legacy-d-preservation.log` |
| 현재 review 만료 1파일 | **2 PASS / 4 FAIL**, 총6 | `/private/tmp/legacy-d-expiry.log` |
| `npm run test:typecheck` | PASS, exit0 | `/private/tmp/legacy-d-types.log` |
| `npm run test:ui` | **808 PASS / 4 FAIL / 기존 skip1**, 총813 | `/private/tmp/legacy-d-ui-final.log` |
| `npm test` | **505 PASS / 5 FAIL / skip0**, 최상위 총510 | `/private/tmp/legacy-d-all-final.log` |
| `git diff --check` | PASS | 최종 문서 포함 재검사 |
| `node scripts/release-build.cjs export` | **public iOS export PASS**, exit0 | `/private/tmp/legacy-d-export.log` |

`npm test`의 실패5는 만료4와 해당 실패를 담은 `전체 테스트 발견 경계는 TypeScript loader를 사용한다` 집계1이다. 별개 기능 결함 5개가 아니다. UI skip1은 기존 `철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다`이며 추가/변경하지 않았다. C의 과거 파일 ENOENT·projection/refresh 실패는 최종 실행에서 재발하지 않았다. 발견 건수는 C의 로드 실패 해소와 새 만료6 때문에 달라졌으며, 과거 실패 파일을 제외해서 맞춘 수가 아니다.

집중 실행 명령:

```sh
node --test test/ui/legacy-four-screen-removal.test.mjs test/ui/current-flow-refactor-safety.test.mjs test/ui/legacy-course-auto-query.test.mjs test/ui/qa-odsay-removal-execution.test.mjs test/course-replan-contract.test.mjs test/mixed-travel-contract.test.mjs test/map-transport-ui-contract.test.mjs
```

번들: `/private/tmp/timefit-public-export/_expo/static/js/ios/index-5690d0c04b2f1e4d4a7241ac282c36e3.hbc`, 4,972,974 bytes. 네 삭제 화면 이름 및 `resetToMyCourses`, `resetToBasket` 바이트 문자열 모두 미검출. 이는 구조 제거 테스트를 보조하는 산출물 점검이며 모든 과거 코드 제거의 증명은 아니다. **서명 IPA·native archive·설치·App Store 반영·실기기 통과가 아니다.** public wrapper가 내부 진단 flag를 끄고 export했으며 키 값은 출력하지 않았다.

## 유지 계약 / 다음 담당 / 실기기 미확인

- courseRepository 및 courses/course_stops/course_legs/course_feedback·migration·기존 AsyncStorage 데이터, nav 저장 호환 타입, shared schedule, 현재 completion/activitySummary/owned lifecycle·개인화·GuestImport·수동 복원·Live Activity 경계는 이번 QA에서 변경하지 않았다.
- 제품 변경은 C 소유자의 기존 diff 그대로다. QA가 직접 화면/엔진/DB 코드를 고쳐 PASS로 만들지 않았다.
- **다음은 UIUX 만료 차단점 수정 → QA D 재검증 → 통합 E 수락**이다. 지금 `자동 검증 완료·실기기 수락 대기` 또는 삭제 무손상 최종 완료로 표시하지 않는다.
- D 통과 및 수정 설치 빌드 준비 뒤에만 사용자에게 아래 최소 E 목록을 전달한다. 이번에는 반복 실기기 검증을 요청하지 않았다.
  1. 수정 전 만든 현재 진행 코스를 데이터 삭제/재설치 없이 수정 빌드에서 이어가기.
  2. guest/회원의 추천→1/2곳 선택→현재 코스→카카오맵 앱/웹→완료→기록.
  3. Live Activity 도착·출발·완료와 앱 상태 공유.
  4. 로그인/로그아웃/재로그인의 계정·guest 기록 격리와 동의 유지.
- 저장 호환 Execution 타입/독립 repository DTO 분리는 기존 DB 후속 인계대로 남긴다. DB 정리·추가 리팩터링·운영 쓰기·배포는 포함하지 않는다.

## 2026-09-13 D 재검증 — 날짜·고정 clock fixture 보완

**자동 게이트 PASS. 다음 담당은 통합·사용자의 E 수락이며, 실기기·출시 반영 완료가 아니다.**

### 변경 파일과 원인

- 최신 [UIUX 만료 보완 인계](../uiux/legacy-four-screen-removal.md)의 마지막 절을 확인했다. UIUX가 추가한 실제 절대 마감 guard 및 교체 승인 재검사는 변경하지 않았다.
- 수정 전 `node --test test/ui/release-preflight-handoff.test.mjs`: **0 PASS / 1 FAIL**. `/private/tmp/legacy-d-recheck-before.log`. 과거 날짜와 실제 현재 clock을 혼용해 만료 차단되므로 `verified-progress-primary`에 도달하지 못했다.
- 이번 테스트 변경은 **`test/ui/release-preflight-handoff.test.mjs` 한 파일의 날짜·clock뿐**이다. `nowIso`를 같은 순간의 canonical `2026-09-07T06:00:00.000Z`로 정규화하고 `screenRuntime.__Date`에 원본 시작+1분인 `2026-09-07T06:01:00.000Z`를 주입했다. 무인자 Date 생성과 Date.now를 함께 고정하며 인자 있는 Date 파싱은 유지한다.
- 예전 resetToMyCourses mock 제거는 앞선 D 변경으로 이번 추가 수정이 아니다. 현재 기록 문서도 갱신했다. 다른 제품·QA·UIUX 변경은 그대로 보존했다.

### 유지한 기대값·공개 계약

`prepare → external-failed` 순서, `routeOpened=false`, 기존 Activity 내용 원복, 이전보다 큰 revision, 성공 알림 금지 및 외부 fetch 금지 기대값을 **모두 유지**했다. canStart를 항상 true로 mock하거나 마감 기대값을 바꾸지 않았다. 기존 QA 만료6건과 UIUX 추가11건도 그대로 실행해 모두 통과했다. 원본 날짜를 현재 날짜로 옮겨 만료 실패를 숨긴 것이 아니라, 정상 handoff 복구 시나리오의 실행 시각을 고정했다.

제품 코드·엔진·DB·중앙 기준 문서·테스트 탐색 변경0, 삭제/skip 추가0, 실제 API/운영 DB/Simulator/실기기 조작0, stage/commit/push0.

### 최종 실행 결과

| 실행 | 결과 | 로그 |
| --- | --- | --- |
| handoff1 + QA 만료6 + UIUX 만료/교체11 + 제거5 + 보존14 | **37/37 PASS**, skip0 | `/private/tmp/legacy-d-recheck-focus.log` |
| `npm run test:typecheck` | **PASS**, exit0 | `/private/tmp/legacy-d-recheck-types.log` |
| `npm run test:ui` | **823 PASS / FAIL0 / 기존 skip1**, 총824, exit0 | `/private/tmp/legacy-d-recheck-ui.log` |
| `npm test` | **521/521 PASS**, skip0, exit0 | `/private/tmp/legacy-d-recheck-all.log` |
| `node scripts/release-build.cjs export` | **public iOS PASS**, exit0 | `/private/tmp/legacy-d-recheck-export.log` |
| `git diff --check` | **PASS**, 최종 문서 포함 | 로컬 최종 검사 |

집중 명령:

```sh
node --test test/ui/release-preflight-handoff.test.mjs test/ui/qa-current-course-expiry.test.mjs test/ui/current-course-start-expiry.test.mjs test/ui/legacy-four-screen-removal.test.mjs test/ui/current-flow-refactor-safety.test.mjs test/ui/legacy-course-auto-query.test.mjs
```

public 산출물: `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`, **4,973,196 bytes**. 네 삭제 화면과 resetToMyCourses/resetToBasket 이름 바이트 문자열 모두 미검출. 구조 제거 테스트와 함께 확인했으며 문자열 검사만으로 기능 보존을 대신하지 않았다. 번들은 실제 생성·검사했지만 native archive·서명 IPA·설치·배포는 미실행이다.

### 다음 실행 조건·남은 위험

- 이전 D 만료 실패4건과 집계 실패는 현행 UIUX guard로 해소됐고, 추가로 남았던 QA handoff fixture1건도 기대값 변경 없이 해소됐다. 본 문서의 이전 FAIL/반환 절은 이력으로 보존한다.
- 통합 E에서 삭제 diff·최종 로그를 검토한 뒤 수정 설치 빌드로 기존 진행 이어가기, guest/회원 1/2곳→카카오 앱/웹→완료/기록, LA 상태 공유, 로그인 전환 격리/동의를 확인한다. 데이터를 지우거나 신규 설치로 기존 기록 보존 검증을 대체하지 않는다.
- 이번 만료 보완의 최소 native 확인도 함께 묶는다: 마감 후 시작 안내/시간 재설정, 마감 전 교체창을 열고 마감 후 승인했을 때 기존 코스 보존, 기존 진행 이어가기·Live Activity 유지. 아직 수행하지 않았으며 자동 통과를 native 성공으로 간주하지 않는다.
- 저장 호환 타입·repository DTO 후속과 운영 데이터 보존 경계는 이전 인계 그대로다. QA D는 자동 검증 완료이며 E 최종 수락·출시 업데이트를 대신 승인하지 않는다.
