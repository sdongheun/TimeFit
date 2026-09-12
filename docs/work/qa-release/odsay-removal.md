# QA-ODSAY-REMOVE-01 — 신규 ODsay 경로 제거 검증

2026-09-09. 고정 fixture 검증. 제품/운영 변경 없음. **소스·실행형 계약 검증과 최종 빌드 산출물 검증을 분리한다.**

## 1. 기준·선행

- 기준: `../integration-decision/release-overseas-minimum-and-odsay-removal.md` §4 D.
- 엔진/API/UIUX 각각 `odsay-removal.md` 인계를 대조. 엔진/API 문서의 basket 실패1건은 UI 최신 보완 인계와 사용자11/11 확인에 의해 후속 검증 대상으로 전환했으며 옛 실패를 현행 미해결로 반복 등록하지 않았다.
- HEAD `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f`, 공유 dirty worktree 기준. 최종 signed 후보 식별자가 아니다.

## 2. 변경 파일·검증 목적

1. `test/ui/qa-odsay-removal-execution.test.mjs` 신규2건: 실제 ExecutionScreen → 수동 좌표 재선택 gate → 실제 travel 모듈의 격리 실행을 연결. geometry 있는/없는 과거 ODsay 코스를 열고 source·분·geometry 보존, HTTP/key-read/storage-write0, 명시 변경 시 기존 코스 보존을 확인한다. 지도 renderer·알림·저장 port는 fixture이며 native나 DB를 실행하지 않는다.
2. `test/ui/odsay-removal-screen.test.mjs`: 기존 save/replace × exact/missing/lost_before_save 6건에 HTTP 금지 recorder, ODsay env getter 기록, 신규 저장 legs의 ODsay 부재 검증 추가. 실제 화면→실제 basket builder→주입 저장 port 경계를 유지했다.
3. `test/ui/unified-time-route-setup.test.mjs`: public TimeSetup에서 두 ODsay 키를 합성 주입해도 읽지 않고 proxy=true의 추천 runner로1회 전달하고 Results에 진입하는 테스트1건 추가. runner 자체는 이 화면 fixture에서 주입하므로 아래 실제 runtime/adapter 검증과 결합한다.
4. 본 문서. 제품·엔진·API·UI 기능·env·중앙 문서·DB 변경0.

## 3. 시나리오별 결과와 증거 한계

| 경로 | 검증 결과 | 증거 경계 |
| --- | --- | --- |
| 공개 TimeSetup→추천 | 화면 ODsay key-read0/HTTP0, proxy=true 전달·Results 진입. 실제 v1Session proxy factory/실패 시 legacy 미전환, Kakao request/cache/receipt/attempt/CAPTCHA 회귀 통과 | 화면 runner 주입과 실제 runtime/adapter fixture를 계층별로 결합. 단일 end-to-end native/원격 성공을 주장하지 않음. 추천 화면 결과는 course repository 저장이 아니며 legacy 새 저장 source는 별도 행에서 검증 |
| 과거 저장 snapshot 열기 | 수동 재선택 후 실제 Execution 화면 표시 가능. 과거 src=ODsay/이동20분/geometry 유지. HTTP0/key-read0/route storage0/save·replace0 | repository에서 읽은 형태의 snapshot을 route params로 주입. 기존 DB행 직접 조회는 하지 않음. 기존 active snapshot의 메모리 연결은 신규 검증 코스 저장과 구분 |
| Execution geometry 누락 | 실제 precomputeTransit no-route 경계, HTTP0/key-read0/storage0. 기존 src/min 유지, 누락 geometry를 새 exact geometry로 만들어 저장하지 않음 | 실제 지도 WebView 시각 검증 아님. 지도 props/legs 소비까지만 fixture 관찰 |
| 명시 변경·재계산 | Execution ‘코스 변경’은 현행상 수동 설정 안내이며 자동 재계산0·기존 snapshot 불변. 별도 LegacyResults save/replace에서 initial no-route와 저장 직전 final leg 소실은 저장/교체/활성화/Execution 이동0 | 존재하지 않는 자동 재계산 동작을 만들어 검사하지 않음. 명시 새 계산 성공에는 TMAP exact walk/최종 구간 수단/유한 분·geometry를 주입, save 또는 replace1회·신규 ODsay source0 |
| retired provider·키 | 엔진 near/far/retry transit에서 합성 키 존재에도 key-read0/HTTP0/cache write0. API retired observer budget 진입 차단, 과거 source의 신규 exact 승격 금지 | 원격 CI secret 조회/실제 키 사용0. public wrapper의 금지 키명 존재 검사는 값 getter를 읽지 않고 실패하는 계약으로 별도 검증 |
| Kakao/TMAP 유지 | Kakao proxy walk/transit·receipt/cache/페이지/2곳 예산/CAPTCHA, TMAP walk retry/cache/in-flight 회귀 통과. TMAP 보행 실패 뒤 ODsay/TMAP transit 대체0 | 실제 공급자 정확도/가용성은 fixture가 증명하지 않음 |

과거 ODsay 문자열 자체는 삭제 대상이 아니다. `Leg.src` 기록 열람과 disabled provider/zero-only 진단은 허용 호환이며 신규 호출/저장 허가가 아니다. 실패를 Infinity→유한 시간 또는 haversine transit으로 바꾸지 않았다.

정적 재검사 `src`, `supabase/functions`, `cloudflare`에서 `api.odsay.com`, `EXPO_PUBLIC_ODSAY_API_KEY`, `ODSAY_API_KEY`, `ODSAY_USAGE`, `markOdsay`, `odsayTransit` 0건. `scripts/release-build.cjs`의 공개 키명은 금지 검사1건으로 남는다. 소스 무검출은 최종 번들 무검출과 별개다.

## 4. 실행 기록

- 15파일 집중 실행(`node --import tsx --test`): **129/129 PASS**, `/private/tmp/qa-odsay-focus.log`. 신규 Execution2·기존 UI6/basket5·엔진/API 제거·route adapter/provider·unified setup/runtime·proxy client/activated/two-stop budget/CAPTCHA/Kakao request/page budget.
- 최종 화면3파일 실행: **52/52 PASS**, `/private/tmp/qa-odsay-screen-final.log`. 추가 public TimeSetup 키 getter와 강화한 저장 recorder 포함.
- `npm run test:typecheck`: PASS, `/private/tmp/qa-odsay-type.log`.
- 첫 전체 회귀: UI760건 중759 PASS/기존1 skip, core449 PASS. 이후 공개 화면 경계1건을 추가하여 최종 전체를 재실행했다. 중간 결과를 최종 파일 집합의 결과로 혼동하지 않는다.
- **최종 전체:** `npm run test:ui` 761건 중760 PASS/0 FAIL/기존1 SKIP, exit0 (`/private/tmp/qa-odsay-ui-final.log`). `npm test` 450/450 PASS, exit0 (`/private/tmp/qa-odsay-core-final.log`). `git diff --check` PASS. **소스·고정 fixture QA 수락, 최종 artifact 미검증**으로 판정한다.
- 신규 Execution 초회는 ‘잔여 이동시간’을 원본 이동20분과 비교해2건 실패했다. 잔여시간은 현재 시각에 따라 달라지는 표시값이므로 원본 시간 보존의 증거가 아니다. assertion을 실제 schedule의 `도착 예정−이전 출발 예정=20`으로 바로잡고 src/min/geometry 보존을 함께 검사했다. 제품 변경이나 기대20분 완화 없음. `/private/tmp/qa-odsay-execution.log`는 이 fixture 작성 오류 이력이다.
- 기존 skip은 철회된 순차 추천 대표 교체 이력. 신규 skip/제품 실패 은폐 없음. 집중·UI·core는 중복이 있어 고유 테스트 수로 합산하지 않는다.

## 5. 빌드·운영 판정

**최종 iOS release bundle/export/Archive 생성 및 산출물 검색: 미실행.** 기존 artifact를 이번 제거의 증거로 재사용하지 않았다. UI 인계의 사용자 public 입력 검사 통과와 API의 옛 `.env` 변수 존재 기록은 시점이 다르다. QA가 환경을 삭제하거나 실제 키를 읽어 최신 상태를 추정하지 않았다.

API/빌드 담당 다음 조건: 로컬/원격 CI의 해당 retired 변수 제거 확인(키 값 비출력) → 현재 wrapper check → 동일 후보 public export/Archive 생성 → 실제 bundle의 ODsay URL/key/query builder/usage write/신규 attempt 부재 확인. disabled/read-only/철회 문자열은 구분한다. 환경검사 PASS만으로 산출물 검증 완료 처리 금지.

## 6. 인수인계

- 변경: QA 테스트3파일과 본 문서. 기존 타 역할 변경 보존, stage/commit/push0.
- 유지: 최대180분/최대2곳·운영시간/체류/개인화/사진·Kakao proxy/TMAP walk·과거 기록 read-only·실경로 실패 비저장·기존 코스 보존. DB 삭제/마이그레이션/source 치환0.
- 실제 공급자 API/운영 DB/Simulator/계정/배포/게시0. 신규 재현 fixture는 모두 격리된 입력/port로 수행했다.
- 다음: 통합은 소스·fixture 수락과 빌드 수락을 분리하고, API/빌드 담당은 §5를 마감한다. 출시 문서 담당만 기준 문서 §5 순서에 따라 ODsay 신규 수신자 문안 및 최소 국외 처리 고지를 정리한다. QA 자동 PASS를 Pages 게시·registry·Connect·출시 승인으로 쓰지 않는다. 실기기/최종 후보 검사는 별도 조건이며 이번에 완료 표시하지 않는다.
