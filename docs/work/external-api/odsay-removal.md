# API-ODSAY-REMOVE-01 — 어댑터·출시 빌드 입력 제거

2026-09-09. 기준: [RELEASE-PROVIDER-MIN-01 §4 B](../integration-decision/release-overseas-minimum-and-odsay-removal.md), [엔진 인계](../recommendation-engine/odsay-removal.md). **API 구현·고정 계약 검증 완료. 전체 제거 수락은 UI 회귀·운영자 변수 제거·최종 artifact/QA 확인 대기.** 보드/역할 README에 새 ID가 없어 사용자 명시 명령과 부모 상세 지시를 실행 근거로 삼았다. 보드는 수정하지 않았다.

## 1. 변경 파일

- `src/services/courseV1RouteAdapter.ts`: live provider와 HTTP budget/diagnostics를 TMAP만으로 축소. retired observer 입력은 accounting 전에 거절한다. default transit fetch는 null, 먼 보행/보행 실패 뒤 transit fetch 자체를 실행하지 않는다. 신규 exact 성공은 TMAP walk만 허용하며 과거 ODsay source를 신규 성공/cache로 수입하지 않는다.
- `scripts/release-build.cjs`: client 허용 목록의 ODSAY_API_KEY 제거. public environment와 native assert 양쪽에서 EXPO_PUBLIC_ODSAY_API_KEY의 **존재**를 검사해 값이 비어 있어도 이름만 담은 안전 오류로 중단한다. 검사 시 값 getter도 읽지 않는다. 일반 ODSAY_API_KEY는 기존 비공개 key 필터로 출력 environment에서 제외된다. 환경파일은 수정하지 않는다.
- `test/api-odsay-removal.test.ts`: 신규 실패 fixture 3건 후 구현. 공개 키 존재/빈 값/native bypass/값 미읽기, 과거 source 성공 승격 금지·transit fetch0, retired observer 차단을 검증한다.
- `test/course-v1-route-adapter.test.ts`: 기존 transit 성공/시도 기대를 무호출 null 계약으로 교체. TMAP retry·cache·in-flight·논리 구간 상한 검증 유지. 엔진 세션이 먼저 수정한 마지막 HTTP helper fixture는 보존했다.
- 본 문서. 엔진·UI·DB·중앙 문서·공개 고지·사용자 기존 변경은 수정하지 않았다.

이력: 엔진 제거 뒤에도 어댑터는 주입된 ODsay source를 exact로 승격하고 build wrapper는 공개 키를 허용 → 신규 fixture 3/3 실패로 확인 → live transit 연결/성공 판정 제거와 key-name guard 적용 → 신규 3/3 통과. 근사 성공 복원 없이 신규 전송·신규 검증과 과거 표시를 분리하기 위한 현행 교체다.

## 2. 유지한 계약

- 출시 Kakao route proxy는 별도 어댑터이며 walk/publictraffic request, receipt, cache, attempt 상한, CAPTCHA를 변경하지 않았다. TMAP 보행 요청/응답·retry는 불변이며 TMAP transit/자동차 대체나 신규 provider는 추가하지 않았다.
- 최대180분/2곳·체류·개인화·운영시간·사진·실패 표시 정책 불변. 실경로 부재는 null이며 근사 시간/성공 코스로 위장하지 않는다.
- legacy walk cache 키·성공24시간/실패5분·메모리 owner/in-flight 유지. transit fetch 진단·옵션 타입은 호출 호환으로 남지만 실제 transit fetch는0이다. ODsay live provider budget/counter는 제거했다.
- 기존 Leg/source/geometry snapshot 타입·repository는 수정하지 않았다. ODsay 문자열은 과거 기록에서 그대로 읽을 수 있고 DB 행·로컬 기록·기존 사용량 저장소를 삭제/변환하지 않았다. 실제 UI 표시/저장 차단 판정은 후속 UI/QA 소유다.
- `routeProviderAdapter.ts`의 disabled ODsay API와 엔진의 zero-only usage 호환 export는 명시적 비활성 허용 목록이다. 신규 요청 함수나 사용량 저장 경로가 아니다.

## 3. 테스트 결과

- 신규 fixture 구현 전 0/3 통과 → 구현 후 3/3 통과.
- 집중 실행: `node --import tsx --test`에 다음 11개 파일 지정 → **69/69 통과**: `api-odsay-removal`, `engine-odsay-removal`, `course-v1-route-adapter`, `route-provider-adapter`, `route-proxy-client-adapter`, `activated-route-proxy-adapter`, `api-two-stop-route-budget`, `captcha-challenge-handler`, `route-proxy-kakao-request`, `route-proxy-page-budget`의 `test/*.test.ts` 및 `test/ui/release-build-config.test.mjs`.
- 엔진 신규3건 재실행: fixture 키를 주입한 near/far/retry transit HTTP0·ODsay key-read0·storage write0, TMAP 실패 후 추가 transit0, 과거 snapshot JSON 호환 통과. API fixture는 transit fetch0·신규 ODsay exact cache 성공0을 확인한다. 이것을 실기기 전체 UI/DB 저장 검증 완료로 확대하지 않는다.
- `npm run test:typecheck`: exit0. `npm test`: **441/441 통과**.
- `npm run test:ui`: sandbox IPC EPERM으로 시작 불가 후 승인된 외부 실행 1회. **750건 중748 통과·1 실패·1 skip**. 실패는 엔진 인계와 동일한 `test/ui/basket-planner.test.ts:67`의 `course.totalMin <= ctx.remainingMin`. 아래 UI 인계로 남겼으며 API에서 테스트 기대를 완화하지 않았다.
- 첫 집중 명령의 잘못된 `captcha-challenge-contract.test.ts` 파일명으로 실행 전 중단; 실제 `captcha-challenge-handler.test.ts`로 정정해 위69건 완료.
- `git diff --check`: 통과.
- production source 정적 검사 범위 `src`, `supabase/functions`, `cloudflare`: `api.odsay.com`, `EXPO_PUBLIC_ODSAY_API_KEY`, `ODSAY_API_KEY`, `ODSAY_USAGE`, `markOdsay`, `odsayTransit` **0건**. build script의 키 이름은 금지 검사에만 존재하며 앱 dependency가 아니다. 허용 문자열: disabled observer/provider, zero-only diagnostics, 과거 source 표시/타입, fixture·철회 문서.
- 실제 local wrapper `node scripts/release-build.cjs check`: `forbidden_public_variable:EXPO_PUBLIC_ODSAY_API_KEY`로 의도대로 중단. 값은 출력하지 않았다. **새 release bundle은 생성/검사하지 못했으며 기존 산출물을 이번 변경의 증거로 사용하지 않는다.**
- 실제 provider·DB·배포·Simulator·게시·commit/push 호출0.

## 4. 다음 결정·위험 / 담당 인계

### 운영자·출시 빌드

- 값 없는 존재 확인: `.env`의 EXPO_PUBLIC_ODSAY_API_KEY **있음**; 같은 파일의 ODSAY_API_KEY 없음. `.env.local`에는 두 이름 모두 없음. `.env.production`, `.env.production.local` 파일 없음. 현재 process에는 두 이름 모두 없음. source/export/eval 없이 dotenv parse 후 존재 boolean만 출력했다.
- 운영자가 **해당 EXPO_PUBLIC_ODSAY_API_KEY 변수 한 개만** `.env`에서 제거해야 한다. 다른 secret의 출력·회전·삭제는 하지 않는다. 원격 CI/빌드 secret은 미조회이며 운영자 확인 대상이다. 로컬 `.github`/`eas.json`은 없어 CI secret 부재를 증명하지 못한다.
- 변수 제거 후 wrapper check → 최종 release export/archive 생성 담당이 실제 bundle에서 ODsay URL/key 이름/query builder·usage write·신규 attempt 코드 부재를 검사한다. 기존 snapshot/disabled 문자열 존재만으로 실패시키거나 모든 ODsay 문자열 삭제를 요구하지 않는다. 현재 코드 정적 검사와 최종 산출물 검증은 별개다.

### U-ODSAY-REMOVE-01 — UIUX 장바구니 회귀 1건

- 재현: `test/ui/basket-planner.test.ts`의 “장바구니 코스는 이동·체류 합계가 안전 여유를 제외한 입력 시간 안에 머문다”, remaining180, 엔진 인계의 고정 출발→장소→약속 fixture. 실제 transit 경로 없는 구간이 Infinity인데 Course 반환 후 시간 성공 기대가 실패한다.
- UI 담당은 `basketPlanner`의 실패 Course 반환과 호출자의 저장/추천 성공 표시 차단을 확인한다. 성공 fixture에는 명시적 exact 경로를 주입하고, 실경로 부재 fixture에서는 실패/비저장을 확인하도록 분리한다. 근사 transit 복원·Infinity를 유한 성공으로 치환·과거 기록 삭제 금지.
- 이번 세션은 UI 파일이나 해당 테스트를 수정하지 않았다. 위1건 해결 전 전체 ODsay 제거/출시 수락으로 표시하지 않는다.

### QA·출시 문서

- A/B 뒤 C 회귀 해결 후 `QA-ODSAY-REMOVE-01`: 공개 추천·기존 저장 열기·Execution geometry 누락·명시 재계산에서 HTTP/key-read/new-write0과 과거 표시, Kakao/TMAP 회귀를 통합 검증한다.
- QA 수락 이후에만 출시 문서 담당이 ODsay 신규 수신자 문안을 제거한다. API 세션은 게시/문안/운영 설정을 변경하지 않았다.
