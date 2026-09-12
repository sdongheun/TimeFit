# RELEASE-PROVIDER-MIN-01 — 최소 국외 처리 확정과 ODsay 제거 명령

2026-09-09. 사용자 결정: 국내 전용 출시에서 공급자 내부의 모든 로그·서버 국가를 전수 조사하지 않는다. 실제 출시 경로에 필요한 최소 국외 처리만 공개하고, 주 추천에 사용하지 않는 ODsay의 신규 외부 전송 경로를 제거한다. 이 문서는 조사 결과와 역할별 실행 명령이며, 작성만으로 코드 제거·공개 게시·운영 설정 변경을 승인하지 않는다.

## 1. 목적·사용자 관찰

- 국내 전용 앱이라는 사실은 이용자·배포 범위다. 계약 수령자가 국외 법인이고 개인정보가 그 법인에 위탁·보관되거나 조회될 수 있으면 국외 처리 고지는 별도로 필요하다.
- 현행 출시 추천은 `route proxy=true`에서 Supabase Edge→Kakao를 사용하며 proxy 실패가 ODsay fallback으로 이어지지 않는다.
- ODsay는 주 추천에 필요하지 않지만 `src/engine/travel.ts`의 직접 HTTP 함수, legacy 코스 실행·재계산, release build 입력 이름과 로컬 키가 남아 있다. 따라서 문안에서 먼저 삭제하지 않고 신규 전송 경로를 코드·빌드에서 닫은 뒤 제거한다.

## 2. Supabase·Cloudflare 최소 국외 처리 조사

법적 고지 항목은 `개인정보 보호법 제28조의8 제2항`의 항목·국가/시기/방법·수령자/연락처·목적/보유기간·거부 방법/효과에 맞춘다. 계약 이행에 필요한 국외 처리위탁·보관은 같은 조 제1항 제3호에 따라 이 항목을 개인정보처리방침에 공개하는 방식을 적용 후보로 삼는다. 이는 별도 전문 의견서나 공급자 내부 로그 전수조사를 출시 선행조건으로 만든다는 뜻이 아니다.

### 2.1 Supabase — 공개 문안에 사용할 최소값

| 항목 | 최소 확정값 |
| --- | --- |
| 처리 관계 | 짜투리의 인증·DB·Edge Function 제공을 위한 처리위탁. Supabase DPA는 Customer=controller, Supabase=processor로 명시한다. |
| 이전받는 자·연락처 | `SUPABASE PTE. LTD.` / `privacy@supabase.io` / 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 |
| 국가 | 계약상 국외 수령자 **싱가포르**. 주 DB와 route-proxy의 현재 primary region은 **대한민국 서울(ap-northeast-2)**이며 이 국내 저장 위치와 계약 수령자 국가는 구분한다. |
| 항목 | 이메일, 사용자 ID, 인증·세션 정보, 선택 닉네임, 가입 동의 이력, 저장 코스·선택 좌표, 완료 기록, 별도 동의 체류 표본, Edge 경로 요청 정보. 비밀번호는 Supabase Auth 요청에 전달되지만 짜투리가 평문으로 별도 저장하지 않는다. |
| 시기·방법 | 회원가입·로그인, 계정 기능, 저장·동기화, 추천 경로 요청 때 HTTPS 암호화 통신으로 건별 또는 서비스 이용 기간 중 계속 처리 |
| 목적 | 회원 인증, 계정 데이터 저장, 코스·개인화 제공, 서버 경로 계산, 보안·장애 대응 |
| 보유 기준 | Supabase DPA 기준 계약 기간 또는 운영자의 더 이른 삭제 요청까지. 계약 종료 시 30일 반환 기간 뒤 Supabase와 승인 하위처리자의 사본 삭제. 앱 데이터의 더 짧은 보유·삭제 기준은 개인정보처리방침 제2절을 우선 적용한다. |
| 거부·효과 | 회원가입을 하지 않거나 계정·서버 추천 기능을 사용하지 않는 방식으로 거부할 수 있다. 필수 인증·서버 처리를 거부하면 로그인, 계정 저장·동기화 및 서버 경로 검증 기능을 제공할 수 없다. 계정 삭제와 개별 기록 삭제는 앱에서 요청한다. |
| 재위탁 공개 | 공급자명·업무는 Supabase의 현행 공개 하위처리자 목록에 연결한다. 운영자가 각 하위처리자의 모든 물리 서버 국가·로그 일수를 별도로 보증하지 않는다. |

근거:

- [Supabase DPA Version 1 — 2026-08-01](https://supabase.com/legal/customer-resources/data-processing-addendum): 처리자 역할, 시설 소재지에서의 처리 가능성, Singapore 법인·연락처, continuous transfer, 서비스 제공 목적, 계약 기간 또는 조기 삭제 요청까지의 보유, 계약 종료 후 30일 반환 기간과 삭제.
- [Supabase regions](https://supabase.com/docs/guides/platform/regions): `ap-northeast-2`가 Seoul이며 선택 region은 primary project data의 저장 위치라는 설명.
- [Supabase subprocessor list](https://supabase.com/legal/customer-resources/subprocessor-list): 현행 재수탁자 공개 목록. 동적 목록을 앱의 고정 사실로 복제하지 않고 링크와 확인일을 둔다.

판정: 위 값은 개인정보처리방침의 Supabase 최소 고지 초안에 사용할 수 있다. `일부 로그의 정확한 처리 국가와 보유기간은 확인 중`이라는 포괄 문장을 게시 차단으로 유지하지 않는다. 대신 위 보유 기준과 서울 primary/Singapore 수령자 경계를 명시하고, 공급자 보안 로그의 정확한 물리 삭제일을 보장하지 않는다고 짧게 적는다.

### 2.2 Cloudflare — 공개 문안에 사용할 최소값

| 항목 | 최소 확정값 |
| --- | --- |
| 처리 관계 | Turnstile 사이트 보호 신호는 짜투리를 위한 처리위탁. Cloudflare는 동일 신호를 bot 탐지 개선 목적으로 독자 처리한다고 별도로 공개하므로 두 목적을 함께 알린다. |
| 이전받는 자·연락처 | `Cloudflare, Inc.` / DPO `dpo@cloudflare.com` / 101 Townsend Street, San Francisco, CA 94107, USA |
| 국가 | DPA상 수령자 **미국**. Cloudflare Privacy Policy는 정보를 주로 미국과 EEA에 저장하고 글로벌 운영상 다른 국가에서 이전·접근할 수 있다고 밝힌다. `국내 처리`로 표시하지 않는다. |
| 항목 | IP 주소, TLS fingerprint, User-Agent, sitekey와 origin, 브라우저·네트워크 신호, challenge 결과·token. 짜투리의 form 입력·통신 내용은 Turnstile 처리 항목으로 쓰지 않는다. |
| 시기·방법 | 비로그인 추천 또는 비밀번호 로그인에서 보안 확인을 실행할 때 HTTPS로 건별 전송. token은 5분 유효·1회 사용이며 앱이 영속 저장하지 않는다. |
| 목적 | 악성 자동 요청 탐지·차단과 로그인/추천 API 보호; Cloudflare의 bot 탐지 성능 개선 |
| 보유 기준 | Cloudflare DPA 기준 계약 종료 또는 계약 수행에 처리가 더 이상 필요하지 않은 때 중 빠른 때까지. 독자 처리 신호는 Cloudflare Privacy Policy의 목적·필요성·법적 의무에 따른 보유 기준을 적용한다. Turnstile token 유효시간 5분을 모든 공급자 로그 보유기간으로 확대하지 않는다. |
| 거부·효과 | 보안 확인을 실행하지 않는 방식으로 거부할 수 있으나, 보호 대상 비로그인 추천과 비밀번호 로그인 요청을 진행할 수 없다. 계정·권리 요청은 짜투리 운영자에게 할 수 있고 Cloudflare 문의처도 함께 제공한다. |
| 재위탁 공개 | Cloudflare의 현행 공개 subprocessor 목록에 연결한다. 모든 데이터센터와 내부 로그 일수를 출시 전에 전수 확정하지 않는다. |

근거:

- [Cloudflare Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/): IP·TLS fingerprint·User-Agent·sitekey/origin, 사이트 보호 목적의 processor와 탐지 개선 목적의 controller 구분, DPO 연락처.
- [Cloudflare Customer DPA v6.4 — 2026-04-03](https://www.cloudflare.com/cloudflare-customer-dpa/): 미국 법인·주소·처리자 역할, continuous processing, 계약 종료 또는 필요 소멸 중 빠른 때까지의 보유 기준.
- [Cloudflare Privacy Policy](https://www.cloudflare.com/policies/privacy/): 미국·EEA 중심 저장과 글로벌 이전·접근, 목적·민감도·법적 의무에 따른 보유 기준.
- [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): token 300초 유효·1회 사용. 이는 token 동작 계약이지 모든 신호의 삭제 기간이 아니다.

판정: 위 값은 개인정보처리방침의 Cloudflare 최소 고지 초안에 사용할 수 있다. `기본 정보의 처리 국가·보유기간과 하위처리자 범위는 확인 중`이라는 포괄 문장을 게시 차단으로 유지하지 않는다. 미국/글로벌 처리 가능성과 공식 보유 기준, 거부 시 기능 제한을 명시한다.

## 3. 현행·철회 이력

- 이전 방식: 국내 전용 출시이므로 모든 공급자의 국외 처리를 생략할 수 있다고 가정 → 문제: Supabase 계약 수령자는 Singapore, Cloudflare 수령자는 USA이고 이용자 국가와 처리 위치는 별개 → 교체: **Supabase·Cloudflare 두 서비스만 최소 국외 처리 표로 공개** → 상태: 문안 반영 전, 조사 완료.
- 이전 방식: 모든 하위처리자 국가·내부 로그 일수를 알아야 게시 가능 → 문제: 운영자가 통제할 수 없고 공식 DPA가 보유 결정 기준을 제공함 → 교체: **주 수령자·공식 보유 기준·동적 재수탁자 링크를 사용** → 상태: 현행 결정.
- 이전 방식: ODsay를 조건부 수신자로 계속 고지 → 관찰: 신규 추천에는 역할이 없지만 legacy 직접 호출과 키가 남음 → 교체: **신규 ODsay 외부 요청을 코드·빌드에서 제거한 뒤 공개 수신자에서 삭제** → 상태: 구현 전.

## 4. ODsay 제거 작업 명령

### 공통 목표와 완료 판정

`API-ODSAY-REMOVE-01`의 목표는 출시 앱의 어떤 공개·legacy 동선에서도 `api.odsay.com` 신규 요청이 발생하지 않게 하고, release build 입력에서 ODsay 키를 제거하는 것이다. 과거 저장 snapshot의 `src: "ODsay"` 문자열은 기록 열람 호환을 위해 읽을 수 있어야 하며, 이를 신규 호출 허용 신호로 쓰지 않는다.

완료는 문자열 삭제가 아니라 다음 고정 fixture에서 `ODsay fetch=0`, 신규 저장 `ODsay=0`, 기존 snapshot 표시 가능, Kakao route proxy·TMAP 보행 계약 불변으로 판정한다.

### 역할·순서

#### A. 추천 엔진 — `2-ODSAY-REMOVE-01`

읽기: `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/work/recommendation-engine/README.md`, 이 문서 전체.

소유 범위: `src/engine/`과 순수 엔진 테스트만. UI·서비스·환경·공개 문서를 수정하지 않는다.

1. `src/engine/travel.ts`에서 ODsay key 읽기, 사용량 저장·진단, `api.odsay.com` request builder/fetch 및 신규 `src: "ODsay"` cache write를 제거한다.
2. legacy `precomputeTransit` 공개 함수가 다른 모듈의 컴파일 경계에 필요하면 네트워크 없는 fail-closed/no-route 호환 함수로 유지한다. 새 근사 이동시간이나 TMAP transit fallback을 만들지 않는다.
3. 과거 저장 course/leg의 `src: "ODsay"`를 읽고 표시하는 타입 호환은 유지한다. 기존 기록을 재계산·변환·삭제하지 않는다.
4. `getOdsayTransitUsage`가 공개 export 호환에 필요하면 deprecated zero-only 진단으로 한 차례 유지하고, 호출자가 없음을 증명할 수 있을 때만 같은 작업에서 제거한다.
5. transit을 얻지 못한 legacy 경로는 추천 성공으로 승격하지 않고 기존 fail-closed 결과를 유지한다.

필수 fixture:

- ODsay 키가 주입돼도 transit 계산의 fetch 0회.
- 먼 구간·TMAP 보행 실패에도 ODsay/TMAP transit/근사 fallback 0회.
- 과거 `src: "ODsay"` leg 입력은 표시용 snapshot으로 파싱 가능하지만 provider request 0회.
- Kakao proxy가 제공한 exact transit result의 시간·geometry·source 계약은 변하지 않음.

#### B. 외부 API 어댑터·빌드 입력 — `API-ODSAY-REMOVE-01`

선행: `2-ODSAY-REMOVE-01` 완료 인계. 읽기: `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/work/external-api/README.md`, 이 문서와 엔진 인계.

소유 범위: API client/cache/adapter, `scripts/release-build.cjs`, 관련 계약 테스트. 엔진·UI·공개 문서를 수정하지 않는다.

1. `scripts/release-build.cjs`의 client 입력에서 `ODSAY_API_KEY`를 제거하고, release public environment에 `EXPO_PUBLIC_ODSAY_API_KEY`가 포함되면 값 없이 이름만 보고 fail하도록 안전 검사를 추가한다.
2. `src/services/courseV1RouteAdapter.ts`의 live provider/budget에서 ODsay 신규 시도를 제거한다. 과거 `ODsay` source 판독은 read-only compatibility로 분리하고 이를 실제 provider 성공 판정에 사용하지 않는다.
3. `routeProviderAdapter.ts`의 `disabledRouteProvider('odsay', ...)`처럼 명시적으로 disabled임을 보장하는 호환 API는 유지할 수 있다. ODsay를 Kakao/TMAP 다음 fallback으로 재연결하지 않는다.
4. 로컬 `.env` 또는 CI/빌드 secret에 있는 ODsay 키는 값 출력 없이 존재 여부만 확인한다. 코드·fixture 검증 후 운영자가 해당 변수 한 개를 제거하도록 인계한다. 다른 secret을 출력·회전·삭제하지 않는다.
5. ODsay URL, query key, usage counter, provider attempt가 production dependency graph와 release bundle에 남지 않는지 검사한다. 과거 문서·fixture의 철회 이력 문자열은 삭제 대상으로 삼지 않는다.

필수 fixture:

- `EXPO_PUBLIC_ODSAY_API_KEY=fixture`를 강제로 넣어도 공개 추천·legacy 재계산에서 `api.odsay.com` fetch 0회.
- release wrapper가 ODsay public env 이름을 산출물에 포함하지 않음.
- route proxy의 Kakao walk/public-transit 요청, cache·attempt 상한과 CAPTCHA 계약은 기존 snapshot과 동일.
- TMAP 보행은 변경하지 않고 TMAP transit은 새로 만들지 않음.
- ODsay 제거 때문에 실패한 legacy transit은 저장·추천 성공으로 위장되지 않음.

#### C. UIUX 영향 확인 — `U-ODSAY-REMOVE-01`

기본 판정은 **코드 변경 없음**이다. API/엔진 변경 뒤 타입 오류나 사용자에게 ODsay 신규 조회를 약속하는 문구가 실제 `src/ui/`에 있을 때만 UIUX 세션이 최소 수정한다.

- 기존 저장 코스의 과거 ODsay leg label·geometry는 그대로 표시할 수 있다.
- 재계산에 새 대중교통 exact route가 없으면 기존 실패/재시도 안내를 사용하며 직선 추정이나 성공 시간으로 바꾸지 않는다.
- Kakao 길찾기·지도 표시·Live Activity·추천 분류는 변경하지 않는다.

#### D. QA — `QA-ODSAY-REMOVE-01`

선행: A/B 완료, C가 필요했다면 C 완료. 고정 fixture만 사용하고 실제 ODsay/TMAP/Kakao API·Simulator·실사용자 DB를 호출하지 않는다.

1. 공개 `TimeSetup→추천`, 기존 저장 코스 열기, Execution geometry 누락, 명시 재계산을 각각 실행한다.
2. 모든 시나리오에서 ODsay HTTP 0회, ODsay key read 0회, 신규 `src: "ODsay"` 저장 0회를 확인한다.
3. 과거 ODsay snapshot이 앱을 중단시키지 않고 read-only로 표시되는지 확인한다.
4. Kakao proxy exact transit, TMAP walk, 호출 상한·cache·receipt·실패 표시 회귀를 확인한다.

### 변경하지 않는 경계

- 최대 180분·최대 2곳, 장소 등급·운영시간·체류·개인화·사진 정책을 변경하지 않는다.
- Kakao Local/Maps/route, Supabase route proxy, TMAP 보행을 제거·교체하지 않는다.
- 기존 DB course/leg 행을 삭제·마이그레이션하거나 과거 `ODsay` source를 거짓 source로 치환하지 않는다.
- ODsay 제거를 이유로 haversine 대중교통, TMAP transit, 자동차 경로 또는 새 공급자를 추가하지 않는다.
- 외부 API 호출, 운영 배포, Simulator, 문서 게시, DB registry, Connect, commit/push는 별도 승인 전 수행하지 않는다.

### 검증 명령과 합격값

구현 세션은 먼저 변경 영역의 정확한 테스트 파일을 선택한다. 최소 합격값은 다음과 같다.

```sh
npx tsx --test test/course-v1-route-adapter.test.ts test/route-provider-adapter.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

추가 정적 검사는 production 경로에서 `api.odsay.com`, `EXPO_PUBLIC_ODSAY_API_KEY`, `ODSAY_API_KEY`가 0건이어야 한다. 과거 문서와 명시적 disabled/read-only fixture는 허용 목록으로 분리한다. 테스트 실패 시 범위를 넓히지 말고 같은 작업 문서에 재현 입력·실패 수·영향을 기록한다.

### 완료 인수인계

각 역할은 자기 작업 문서에 다음 네 항목을 남긴다.

1. 변경 파일과 ODsay 신규 전송 제거 목적
2. 유지한 Kakao/TMAP·추천·기존 snapshot 공개 계약
3. 실행한 테스트와 정확한 결과, ODsay request/key-read/new-write 0 증거
4. 남은 운영 환경 변수 제거, 공개 문안 삭제와 최종 release artifact 검증 조건

## 5. 후속 공개 문서 순서

`QA-ODSAY-REMOVE-01` 수락 후 출시 문서 세션만 다음을 수행한다.

1. 개인정보처리방침 Markdown/HTML에서 ODsay 신규 수신자와 `확인 중` 문장을 제거한다. 과거 기록 호환은 개인정보 신규 처리로 쓰지 않는다.
2. Supabase·Cloudflare 행을 §2의 최소 확정값으로 교체한다.
3. Kakao·TMAP·Visit Busan은 국내 외부 서비스의 실제 전달 목적·항목만 유지하고 국외 처리 미확정을 게시 차단으로 만들지 않는다.
4. 정적 validator·Markdown/HTML 의미 일치·`git diff --check` 뒤 개인정보처리방침 `1.0` 전체 게시 승인 여부를 다시 판정한다.

이 순서가 끝나기 전에는 `jjaturi-docs` 게시, 실제 URL/시행일 확정, DB registry·UI·Connect 연결을 수행하지 않는다.
