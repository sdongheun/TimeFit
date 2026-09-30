# U-LIVE-PUBLIC-DATA-INTEGRATION-01 — 공개 추천 live 세션 UI 연결

2026-09-22. 상태: **기본 OFF 연결·고정 fixture·전체 자동 회귀·iOS bundle 검증 완료 / 실제 활성화·실기기 수락 전**. 후속 화면 표시 연결은 [`live-public-data-surfaces.md`](live-public-data-surfaces.md)에 기록한다.

## 이전 방식 → 관찰 → 교체 방식 → 이유

- 이전 방식: 공개 추천은 앱 번들 정적 후보를 입력으로 사용하고 기존 Results·2곳 선택·더보기를 같은 UI runtime에서 진행했다.
- 관찰: live facade의 초기 결과만 교체하면 후속 2곳 선택·더보기가 정적 provider와 새 경로 포트를 사용해 cache·호출 예산·snapshot을 분리할 위험이 있다.
- 교체 방식: `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED === 'true'`일 때에만 기존 입력 검증·개인화 snapshot·Route Proxy receipt 준비 뒤 live facade/data/engine을 동적 로드한다. 초기 12→6→최대30 상세 예약을 같은 facade·동일 reservation으로 반복하고, 종료 후 sealed bridge의 input/result/ledger를 기존 Results runtime에 등록한다. pair begin은 `automatic`, pair continue와 one-stop 더보기는 `shared` bridge 작업으로 묶는다.
- 이유: 현재 화면·선택·코스 확인 UX를 유지하면서 live 세션의 단일 경로 cache와 8/16/12/총36 예산을 후속 행동까지 공유하기 위해서다.
- 상태: **구현·자동 검증**, flag 기본 OFF. 실제 Edge 배포/공급자 호출·실기기/출시 수락은 별도.

## 변경 파일과 목적

- `src/ui/recommendation/livePublicDataSession.ts`: production port 동적 조립, facade initialize→data projection→engine 상세/evaluate→seal의 단일 수명 controller. blocked/unavailable은 정적 후보 fallback 없이 종료하고 cancel/close한다. 후속 U-LIVE-PUBLIC-DATA-SURFACES-02에서 같은 최종 projection의 화면용 사실도 sealed 결과와 함께 반환한다.
- `src/ui/recommendation/livePublicDataError.ts`, `src/ui/captchaRecommendationGateModel.ts`: 원천·토큰·좌표·원문 오류를 화면에 노출하지 않는 짧은 재시도 안내.
- `src/ui/recommendation/v1Session.ts`: flag ON 분기와 sealed bridge를 기존 WeakMap runtime·동결 seed·operation 직렬화·ledgerStore에 연결. 후속 화면 연결에서 같은 live projection의 UI 사실을 session에 등록한다. flag OFF는 기존 정적 builder/port 경로를 그대로 실행한다.
- `src/ui/TimeSetupScreen.tsx`: 로딩 취소·화면 이탈 중인 live 작업에 AbortSignal을 전달한다. 성공 후 Results runtime은 로딩 화면 수명과 분리한다.
- `test/ui/live-public-data-integration.test.ts`: 실패 선행 fixture와 flag·단일 facade·12→6→30·partial/empty/unavailable·blocked detail·취소/늦은 응답·OFF 호출0·공유 continuation·안전 문구 회귀.

## 유지한 계약

- `app.json`과 환경값은 수정하지 않았다. 미설정/`true` 이외 값은 OFF다. diagnostics/test clock으로 우회 활성화하지 않는다.
- OFF에서 정적 후보·현재 결과·화면/문구·개인화·경로 포트와 사용량은 기존 경로를 유지한다. ON에서 source/detail 실패를 정적 JSON 성공으로 바꾸지 않는다.
- ON에서도 Auth 새 로그인/CAPTCHA 재실행, 새 provider/route adapter 생성, 사용자용 공급자 진단·토큰·좌표 출력, navigation payload에 runtime 직렬화, 추천/DB 정책 변경은 없다.
- 기존 Results/장소 상세/코스 확인, 표시 완료 one-stop seed, pair intent, 최대2곳, 180분, 체류·개인화, 8/16/12/총36 호출 예산을 유지한다.

## 검증 결과와 남은 게이트

- RED: 신규 테스트를 먼저 실행해 `livePublicDataSession` 부재로 실패함을 확인했다.
- focused UI fixture **12/12 PASS**; 실제 Results의 pair begin/continue가 같은 sealed bridge와 초기 receipt cache를 사용하는 회귀를 포함한다. engine/facade 기존 집중 **36/36 PASS**.
- `npm run test:typecheck` **PASS**.
- 최신 결합 회귀(후속 화면 표시 연결 포함): `npm run test:ui` **838 PASS / 0 FAIL / 기존 1 SKIP** (총 839). 첫 샌드박스 실행은 tsx IPC `EPERM`으로 시작 전 실패했고, 같은 명령을 허용된 실행 환경에서 재실행했다.
- `npm test` **591/591 PASS**. 이 작업 직후에는 QA 소유의 구현 전 정적 안전 검사 때문에 동일 단언이 직접 실행·discovery에서 각각 실패했으나, QA가 현행 OFF/ON 경계 검사로 갱신한 뒤 전체 회귀가 통과했다. UIUX 세션은 QA 소유 테스트를 수정하지 않았다.
- 최신 결합 번들: `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED=false npx expo export --platform ios --output-dir /private/tmp/timefit-live-surfaces-minimal.LvWXrj` **PASS**. Hermes bundle `index-98680ccc7abec7fceae322aa0ed6628a.hbc` SHA-256 `f2376b8b41e06d98becf02eecfe5d56201835935415074e88698e14facf3754a`.
- `git diff --check` **PASS**. 실제 Edge/API/Simulator/실기기/운영 계정·secret·DB 쓰기·배포·commit/push는 실행하지 않았다.

### 다음 결정·위험

1. QA 안전 검사 충돌은 현행 OFF/ON 경계로 교체되어 자동 회귀가 통과했다. 실제 Edge/API 호출 없이 확인한 결과이므로 운영 전환 수락을 뜻하지 않는다.
2. 실제 활성화 전 `tourapi-live`·`busan-live` Edge 배포/secret/운영 승인, 개발계정 한도·500행 응답의 제한 호출, 단말 네트워크/취소/재시도·1/2곳 결과·pair/더보기 실기기 확인이 필요하다.
3. ON의 실제 공급자 지연·오류를 아직 측정하지 않았다. flag는 기본 OFF를 유지한다. Nearby는 별도 browse read model·예산/개인정보 계약 이후 연결하며, 선택 코스 cold restore의 최소 보존 경계는 후속 화면 연결 문서를 따른다.
