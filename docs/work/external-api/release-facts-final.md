# API-RELEASE-FACTS-01 — 공개 출시 API 사실 인계

2026-09-08 · [출시 실행 명령](../integration-decision/release-execution-wave.md)의 API 절 수행.
상태: **소스·로컬 설정 분류·격리 계약 점검 완료 / 최종 제출 환경·운영 설정 미확인**.

## 근거와 범위

현재 공유 작업트리의 소스를 읽었다. [QA 후보 감사](../qa-release/release-candidate-audit.md), [API 안전성 수정](release-safety-remediation.md), [180분 영향 확인](release-three-hour-impact.md)을 대조했다. 과거 자동/실기기 PASS를 새 Archive의 증거로 바꾸지 않았다. 코드·설정·보드 변경, 운영 API 요청, 계정 생성/삭제, 원격 설정 조회·배포는 수행하지 않았다.

로컬 env는 **source/실행하지 않고** 파일을 메모리에서 파싱하여 flag·URL 유형·키 종류·위험 이름/중복 여부만 출력했다. 원문 URL·키·token·사용자 데이터는 기록하지 않았다. 이 단순 파싱은 Expo의 shell/빌드 환경 병합 결과나 실제 제출 산출물을 대신하지 않는다.

## 1. 공개 문서용 전송 사실

| 동작·목적·시점 | 요청 주체 → 공급자 | 명시적으로 전달되는 항목 | 보관·미확인 |
| --- | --- | --- | --- |
| 현위치 선택/주소 라벨 | 기기 위치 API → 앱, 앱 → Kakao Local | 권한 허용 후 얻은 위도·경도. 주소가 정상 빈 결과일 때 행정구역 요청 추가. 앱 사용자 ID/JWT를 Local에 추가하지 않음 | 앱 라벨 메모리 cache 10분/64개. Kakao 로그 보유·처리 국가 미확인 |
| 수동 장소/주소 검색 | 앱 → Kakao Local | 입력 검색어, 결과 수, REST 인증 header. 현재 keyword 요청에 GPS 중심좌표를 포함하지 않음 | 앱 검색 메모리 cache 10분/100개. 검색어는 개인 주소일 수 있으므로 비개인정보로 일괄 분류하지 않음 |
| 공개 대표 POI 사이 경로 검증 | 앱 → Supabase Edge → Kakao walk/publictraffic | 앱→Edge: Bearer JWT, mode, catalogVersion, from/to POI ID, allowance. Edge→Kakao: 서버 snapshot에서 해석한 양 끝 좌표·좌표계·서버 REST 인증 | public cache는 provider/mode/방향성 ID/version 기준, 기본 TTL15분. 사용자 좌표/ID/JWT를 cache key·row에 넣지 않음. 운영 TTL·물리 삭제 미확인 |
| GPS·수동 선택 장소가 포함된 private 경로 / 상세 도보 보충 | 앱 → Supabase Edge → Kakao | 앱→Edge: JWT, private scope, 양 끝 정확 좌표·mode/allowance. Edge→Kakao: 양 끝 좌표·좌표계·서버 인증. 사용자 계정 ID/JWT·약속시각·장소명을 provider 요청에 넣지 않음 | private 요청은 Edge의 public cache/lease 저장 제외. **서버 수신·provider 전송은 발생**. 상세 connector는 별도 앱 메모리10분/64개. 앱 진행 snapshot 영속과는 별개 |
| 지도 보기 | 앱 WebView → Kakao Maps JS/지도 리소스 | JS app key, SDK 로드. 지도 중심/bounds/marker·label/geometry를 WebView SDK 객체에 전달 | SDK/HTTP cache·세부 텔레메트리·처리 국가/보유기간 미확인. 모든 점이 서버로 전송된다는 패킷 증거는 없음 |
| 코스 길찾기 버튼 | 앱 → 카카오맵/웹/브라우저 | 앱 scheme은 양 끝 좌표·수단, HTTPS fallback은 이름·좌표·수단. 현재 구간 명시 실행 | 외부 서비스 이력/URL 보유는 TimeFit TTL과 별개. 앱 열기 접수는 실제 이동/도착 증거 아님 |
| 주변 둘러보기 길찾기 | 앱 → 카카오맵 HTTPS/브라우저 | **목적지 이름·좌표만**. 현재 둘러보기 중심/GPS를 출발지로 만들어 넣지 않음 | `src/ui/nearbyDirections.ts`. 외부 앱이 자체 권한으로 위치를 취득하는 것은 TimeFit 전송과 구분 |
| 비로그인 보안 확인·Auth | 앱 WebView → Cloudflare Worker/Turnstile, token은 앱 → Supabase Auth | Turnstile sitekey/origin·브라우저 신호; 결과 token을 Auth에 전달. 이후 session JWT로 Edge 접근 | Worker 자체는 token 저장·검증 안 함. Auth session은 앱 AsyncStorage에 persist. 익명 Auth도 서버 사용자 식별자가 존재 |
| 사진 표시 | 앱 Image/지도 사진 marker → 허용 이미지 호스트 | 허용된 사진 URL 요청. GPS/JWT를 명시 추가하지 않음 | 관광공사/부산 사진 host의 IP 등 접속 메타데이터와 HTTP cache는 별개. 최신 사진별 수량/권리는 DATA-RELEASE-ASSETS-01 인계 |
| 일반 계정·기록 | 앱 → Supabase | 로그인/가입 인증정보와 명시 기능별 payload | 코스/완료/동의/guest import/표본의 현재 도달성과 보유·삭제는 DB-RELEASE-FACTS-01 사실표를 결합. 이 감사로 전체 GPS 자동 서버 저장을 주장하지 않음 |

근거: `src/ui/TimeSetupScreen.tsx`, `PlacePicker.tsx`, `MapPlacePicker.tsx`, `NearbyBrowseScreen.tsx`; `src/engine/kakao.ts`; `src/services/kakaoLocationSearchAdapter.ts`, `kakaoLocationLabelAdapter.ts`, `routeProxyClientAdapter.ts`, `routeProxyActivatedCourseAdapter.ts`, `routeProxyProductionPorts.ts`, `privateWalkConnector.ts`; `supabase/functions/route-proxy/{handler,index,kakaoRouteRequest}.ts`; `src/ui/execution/schedule.ts`, `nearbyDirections.ts`; `cloudflare/captcha-worker/src/index.ts`.

네트워크 수신자는 IP·User-Agent 등 접속 메타데이터도 처리할 수 있다. 공급자의 법인 소재지만으로 실제 처리 국가를 확정하지 않았다. Kakao·Supabase·Cloudflare·이미지 공급자의 **처리 국가/국외 이전 경로·보유기간·계약상 수탁/제3자 지위는 미확인**이며 문서 담당/통합이 DB 운영 근거·계약과 결합해야 한다.

## 2. 출시 provider 도달성

- TimeSetup의 exact proxy flag → `v1Session.recommendationPortsFor` → activated adapter → Supabase Edge → Kakao가 현재 출시 추천 경로다. proxy 실패 시 TMAP/ODsay로 자동 우회하지 않는다.
- false 분기는 legacy adapter를 선택한다. `App.tsx`에 LegacyResults/Execution/MyCourses가 등록돼 있고 MyCourses→Execution 및 Execution의 legacy 재계산이 남아 있다. **코드 존재는 실제 운영 호출의 증거가 아니지만, proxy=true만으로 앱 전체 legacy 도달 불가도 증명되지 않는다.** 최종 제출 동선/기존 저장 코스 지원은 빌드·QA 확인 대상이다.
- 조건부 legacy TMAP은 양 끝 좌표·좌표계·고정 이름/차량 옵션·appKey, ODsay는 양 끝 좌표·SearchType·query apiKey를 앱에서 직접 보낸다. 이 기능을 임의 삭제하거나 키/flag를 바꾸지 않았다. TourAPI JSON은 V1 로컬 후보 경로가 아니라 legacy/데이터 구축 경계이며 이미지 요청과 구별한다.
- 최대180분·2곳으로 API 예산을 늘리지 않았다. 예정 leg 출발 날짜를 provider에 보내지 않는 기존 제약 때문에 익일/미래 운행·막차를 보장하지 않는다.

## 3. 키·환경 점검 결과와 빌드 인계

| 점검 | 결과 | 해석/후속 |
| --- | --- | --- |
| `.env.local` 로컬 입력 분류 | proxy enabled, recommendation diagnostics enabled, C validation enabled; B12 disabled; CAPTCHA diagnostics unset | **내부 테스트 입력이며 그대로 제출 불가**. U-RELEASE-BUILD-01이 별도 제출 입력에서 내부 flag를 false로 고정하고 실제 산출물 검증. 사용자 로컬 파일 변경0 |
| `.env.local` endpoint | Supabase/CAPTCHA 모두 remote HTTPS 유형 | host 값 비출력. 소유 project·승인된 Worker·운영 가용성·도메인 allowlist는 미확인 |
| `.env` 단독 관련 설정 | proxy/진단/C/Supabase/CAPTCHA 분류 대상 unset | `.env` 전체가 비어 있다는 뜻 아님. shell·Expo 우선순위가 반영된 effective release env 아님 |
| Supabase 클라이언트 키 | local publishable 유형 | 서버 service role 키와 구별. publishable 자체가 RLS/계정 격리를 대신하지 않음 |
| public 환경 이름·중복 | 검사 파일별 public server-secret 의심 이름0, 같은 파일 내 서버 secret과 동일한 public 값0 | 키 원문 출력0. 교차 파일/원격 secret과 전체 값 비교·credential 유효성 검증은 아님 |
| 앱 소스 검사 | `src`+App TS/JS 224파일: 개인키/sb_secret literal 패턴0, 지정 서버 env 직접 참조0, localhost/127.0.0.1 HTTP literal0 | 제한 패턴 정적 검사. JSON/assets/dependency/native bundle/Archive 전체 secret scan 완료로 해석하지 않음 |
| 지도 synthetic origin | 두 지도 WebView에 `https://timefit.local` 존재 | 로컬 HTML SDK origin용 baseUrl. 자체 개발 backend를 호출하는 fetch URL이라는 증거는 없음. 제출 도메인 등록 및 WebView SDK 작동 확인 필요 |
| 최종 Archive | 이번에 생성/지정/검사하지 않음 | 최종 candidate의 번들에 서버키 없음, endpoint 일치, 내부 버튼 비노출, key 제한을 별도 확인 |

Kakao Local REST 키와 지도 JS 키는 현재 앱 직접 요청에 쓰여 클라이언트에 들어가는 값이다. 이름이 key라는 이유만으로 서버 secret과 혼동하지 않되, 바이너리에서 숨겨진 서버 비밀이라고 설명해서도 안 된다. 서버 경로키·Supabase service role은 `Deno.env`에서만 읽는 구조이며 앱 imports에서 참조를 찾지 못했다. 계정별 키 사용 제한/도메인/권한 적용은 미확인이다.

## 4. 인증·비용·실패·보유

- Auth: 기존 session 재사용, 신규 anonymous는 유효 CAPTCHA 후 sign-in. Edge는 method/body/snapshot, store 준비, JWT 사용자와 audience, anonymous flag, abuse guard/rate를 검사한다. CAPTCHA 취소/없음과 Auth 실패는 경로 성공으로 바꾸지 않는다.
- rate guard: JWT hash 일부를 instance 메모리 key로 써 60초 window 제한. 실제 전역 비용은 DB의 provider+mode별 daily/second quota다. 일별 bucket은 UTC 서버 시각. 배포 rate 값·실제 quota 값은 미확인.
- 요청마다 provider 최대1, adapter walk→조건부 transit 최대2. remaining0 public cache-only miss는 provider0, private0은 호출0. lease 대기 뒤 cache 재조회는 provider retry 아님. timeout/network/store 실패 시 typed unavailable, provider 이후 store 후처리 실패에도 attempt1 보존. offline/손상 응답은 exact로 승격하지 않음.
- Local 검색은 정상 빈 응답에서 다른 검색 종류로 최대1 fallback; 주소 라벨도 정상 빈 주소일 때 region 최대1. 실패를 무한 재시도하지 않는다. UI 명시 재시도와 자동 반복은 구분한다. Local HTTP에는 이 Edge deadline을 적용하지 않으므로 앱의 모든 요청이 동일 시간 안에 끝난다고 약속하지 않는다.
- Edge deadline은 lease보다 짧은 ms 설정, lease 최대30초. timeout은 코스 180분과 무관하며 확대하지 않았다. provider 처리와 body parse를 같은 abort 경계로 묶는다.
- public cache15분/connector10분/검색10분은 기본 **유효기간**, 실제 물리 삭제 보장이 아니다. purge·anonymous cleanup 운영 schedule, override TTL, Edge 배포 version, 플랫폼 로그 보유·drain·backup·region은 원격 미조회로 미확인이다. 공개 snapshot 좌표는 user 좌표와 별개다.
- private server 비영속을 앱 전체 비영속으로 표현하지 않는다. baseline의 개인 좌표 key/geometry 영속은 기존 안전성 결정 대기이고 활성 course snapshot도 별도 영속 경계다. 준비된 legacy purge 도구는 앱에 연결하지 않았다.
- 최신 로그: legacy 정확 좌표 로그는 제거됐고 count/mode/provider 상태를 유지한다. `AuthContext.tsx` raw 오류 로그도 현재 고정 문구로 교정돼 있다. Edge/provider/검색 경계의 안전 실패 fixture가 통과했다. 앱 console 원문이 없다고 플랫폼 HTTP/접속 로그가 없다고 주장하지 않는다.

## 5. 표시·전환·심사 재현

카카오맵 전환은 앱→HTTPS→browser를 각 최대1회 시도한다. browser cancel/dismiss는 중립 결과이며 준비 완료를 실제 이동 성공으로 해석하지 않는다. 코스 browser background 관찰은 목적 앱의 운행 검증과 다르다. 주변 둘러보기는 목적지-only URL과 opened/cancelled/unconfirmed/failed를 사용하고 코스 상태를 생성하지 않는다.

GPS 거절 시 PlacePicker는 검색·지도 선택을 제공한다. 부산 밖 심사자는 개발 시계/QA 도구 없이 공개 부산 장소를 출발/도착으로 수동 지정하고 180분 이내 코스를 요청할 수 있다. 카카오맵 미설치 시 HTTPS fallback을 사용한다. 네트워크 실패·운영시간·비용 제한에 따른 추천0을 심사 데이터로 숨기지 않는다. 실제 심사 네트워크와 최종 endpoint 가용성은 아직 검증하지 않았다.

지도 SDK와 사용자 overlay를 확인했으나 최종 Archive 화면에서 copyright/logo 가림 여부는 미확인이다. 사진은 최신 `PlacePhoto.tsx`/`placePhotoModel.ts`의 검증 허락·fallback 및 보이는 출처 컴포넌트가 존재하므로 과거 “출처 구현 없음”을 그대로 재사용하지 않는다. 모든 화면·marker 실제 표기/개별 사진 허락 수는 DATA/QA의 최종 근거와 결합한다.

공식 문서 재확인일 2026-09-08: [Kakao Local 요청 규격](https://developers.kakao.com/docs/ko/local/dev-guide), [지도 SDK·길찾기 링크](https://apis.map.kakao.com/web/guide/), [Kakao 운영정책](https://developers.kakao.com/terms/ko/site-policies), [Turnstile 개인정보 안내](https://www.cloudflare.com/turnstile-privacy-policy/). Kakao 정책은 소유권 고지 삭제/로고 변경을 금지하고 cache 목적·최신성 조건을 둔다. Turnstile은 IP/TLS/UA/sitekey·origin 등의 신호를 처리한다. 이 사실로 TimeFit 계정의 모든 저장/국외 처리 계약 적합성을 확정하지 않는다.

## 6. 인수인계

### 변경 파일

이 문서만 신규 작성. 소스·test·env·보드·타 역할 파일 수정0. 공유 변경을 되돌리지 않았다.

### 유지 계약

provider·180분/2곳·호출 예산·공개 API·실패 enum·public/private cache·계정/C 완료 이력 불변. 운영 호출/배포/원격 쓰기/사용자 행 조회/commit/push0. 로컬 key 값은 비출력 분류에만 사용하고 보관하지 않았다.

### 테스트 결과

`node --import tsx --test test/api-release-safety.test.ts test/api-two-stop-route-budget.test.ts test/route-proxy-client-adapter.test.ts test/activated-route-proxy-adapter.test.ts test/route-proxy-timeout-behavior.test.ts test/private-walk-connector.test.ts test/kakao-location-search-adapter.test.ts test/kakao-location-label-adapter.test.ts test/ui/execution-schedule.test.ts test/ui/nearby-directions.test.ts` → **84/84 PASS**, skip0. public snapshot과 private 분리, cache-only, 실제 attempt, JWT/CAPTCHA 실패, 좌표/raw 로그 부재, 검색 실패, 설치/미설치/취소를 격리 fixture로 검증했다. 운영 API 요청은0이다. 코드 변경이 없어 전체 UI/core/native build를 다시 실행하지 않았다. 문서 공백 검사 완료.

### 다음 위험·최소 담당 작업

1. **U-RELEASE-BUILD-01:** 제출 전용 env 계약과 동일 Archive 확인. 최소 재현은 현재 로컬 diagnostics/C=true 분류 및 후보 감사의 flag 소비 fixture다. `.env.local`을 그대로 제출하지 않고 최종 artifact 내부 도구 비노출을 확인한다. API가 임의 설정 수정하지 않음.
2. **통합·QA:** legacy 등록/저장코스 도달 여부와 최종 proxy 실패시 직접 provider0을 제출 후보에서 검증. provider 삭제·정책 변경은 요청하지 않는다.
3. **DB/운영:** region·plan·로그/backup·cleanup/TTL·배포 version을 사용자 행 없는 최소 metadata로 확인. 이 감사가 원격 실행 승인 아님.
4. **문서 담당:** 위 사실표를 그대로 사용하되 미저장=미전송, 익명=무식별, TTL=즉시 파기, 앱 열기=운행/도착 성공으로 쓰지 않는다. 처리 국가·보유·법적 지위 미확인을 남기고 최신 DB/DATA 사실과 대조한다.

기술 조사 완료와 제출 가능/법적 공개 가능은 별도다. 이번 범위에서 기능 교정이 필요한 신규 API 결함은 확정하지 않았으며 최종 제출 환경과 운영 증거는 남아 있다.

## 7. API-RELEASE-OPS-02 — 운영 연결·공급자 후속 감사

2026-09-08. [최소 보완 명령](../integration-decision/release-minimal-followup.md)의 API 절 수행. **로컬 대조·공식 자료·도달성 감사 완료, 원격 인증/설정 확인은 미충족으로 반환**. 운영 가용성 PASS나 제출 승인이 아니다. 아래 결과는 FACTS-01 이후 BUILD 보완을 반영하며 앞선 시점의 기록을 삭제하지 않는다.

### 7.1 실제 확인과 미확인

| 항목 | 이번 확인 결과 | 한계·다음 근거 |
| --- | --- | --- |
| BUILD public 입력 | `scripts/release-build.cjs`의 `loadInputs`→`publicEnvironment`를 로컬 메모리에서 실행. public 입력 검증 성공, 내부4 flag=false/proxy=true/EXPO_NO_DOTENV=1 강제 계약 확인 | `.env` source/파일 수정0. BUILD의 development 서명 Release 검사 이력은 재사용하되 최종 distribution Archive 확인으로 승격하지 않음 |
| Supabase endpoint | effective public URL의 hostname과 `supabase/.temp/project-ref`를 메모리 비교: **일치=true** | 로컬 linked project와 일치하는 사실. 현재 계정의 프로젝트 소유권/원격 서비스 건강도 증거와는 별개 |
| CAPTCHA endpoint | HTTPS=true, hostname 첫 label과 로컬 `wrangler.toml` Worker명 `timefit-captcha` 일치=true | account subdomain·실제 배포 Worker/버전·widget binding까지 일치했다고 단정하지 않음. root 요청/Turnstile 실행0 |
| route-proxy 배포 | 설치된 Supabase CLI(v2.62.10)의 native 기존 인증으로 `functions list --output json` 1회 시도 → **authentication unavailable**. stdout/stderr는 메모리 분류만, 원문 비출력 | 배포 유무/version/updated_at/verify_jwt 모두 이번 미확인. 재로그인·토큰 복사·다른 CLI 재시도0. secret 내용/사용자 행 조회0 |
| snapshot·Auth | 로컬 handler는 public version+ID를 snapshot에 대조하고 불일치는 Auth/provider 전에 rejected. Bearer/getUser/aud 및 anonymous 허용 검사 확인 | 배포 artifact 동일성, 원격 snapshot version/count 일치는 미확인. secret 존재만으로 계약 일치라 쓰지 않음 |
| quota/rate/timeout | 로컬 JWT hash instance rate60초; DB provider+mode quota; deadline/lease 유효성 fail-closed; lease1~30초; cache 기본900000ms 확인 | 원격 수치/override·quota 설정·배포 코드 동일성 미확인. 별도 운영 RPC/secret 내용 열람0 |
| DB 공통 운영 사실 | DB `release-facts-final.md` §4의 **ap-northeast-2 / ACTIVE_HEALTHY** 메타데이터 확인 이력 재사용 | API가 project list 반복 조회하지 않음. 읽은 DB 인계에는 OPS-02 결과가 아직 없어 plan/log/backup/scheduler는 그 결과 대기. 서울 DB=Auth/Edge/CDN/지원 전부 국내가 아님 |
| Kakao·Turnstile 제한 | 이 세션에 사용 가능한 승인된 공급자 관리 연결이 없어 관리 설정 확인하지 못함 | 지도 작동의 과거 실기기 보고는 최종 JS key 도메인·iOS 등록·REST 제한·Turnstile hostname 설정 증거를 대체하지 않음 |

지도 WebView의 `https://timefit.local`은 synthetic origin이다. [Kakao Maps 가이드](https://apis.map.kakao.com/web/guide/)의 JavaScript 키·도메인 등록과 실제 해당 앱 설정을 대조해야 한다. [Turnstile hostname 관리](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)는 widget 사용 hostname을 제한한다. Worker 이름 일치나 HTTPS 형식만으로 이 두 제한을 통과했다고 쓰지 않는다. 공식 문서 확인일 2026-09-08.

**한 번에 요청할 최소 설정 근거(키/계정 식별값/실제 URL은 가리고 일치 여부만 제공 가능):**

1. Supabase 연결 프로젝트의 `route-proxy` Functions 상세: 배포 상태·version/배포시각·JWT verification 설정. 기존 배포 이력의 artifact hash 및 snapshot version/count 대조 가능 여부. 비밀 값은 열지 말고 배포 당시 안전 검증 기록으로 rate/deadline/lease/quota 확인 수준 제공. DB 공통 plan/retention/region/scheduler는 DB-OPS-02 인계 재사용.
2. Cloudflare 해당 Worker의 Domains & Routes/배포 version, sitekey binding과 해당 Turnstile widget의 일치 여부, 허용 hostname에 public CAPTCHA host가 포함되는지. Supabase Auth CAPTCHA provider=Turnstile 및 해당 widget과의 연결 확인 여부(비밀키 값 불필요).
3. Kakao 해당 앱의 JS/Maps 허용 도메인에 synthetic origin 포함 여부, iOS bundle 등록 및 Local REST/서버 route 제품 권한·키 제한 적용 여부. 키 값·관리자 화면 전체 캡처는 불필요.

### 7.2 legacy 공개 도달성 — 등록만이 아닌 실행 경로

공개 기본 탭은 Home/주변/기록/Profile이며 MyCourses가 바로 보이는 탭은 아니다. `App.tsx` NavigationContainer에 일반 `linking`/저장 navigation state 복원 설정은 없고, pending Live Activity bridge는 기존 verified run을 CourseConfirm으로 연결한다. 따라서 단순 앱 scheme 또는 스택 등록만으로 임의 legacy 진입을 주장하지 않는다.

그러나 다음 **공개 실패 분기**로 기존 저장 코스에 도달할 수 있다:

`TimeSetup → Results → CourseConfirm → 완료 기록 실패 → 사용자가 “기록 없이 마치기” → MyCourses → 해당 일반 계정의 기존 저장 코스 선택 → Execution`.

- 근거: `CourseConfirmScreen.tsx:103` onFinish의 recorded=false→courses, 같은 파일 `finish-without-record` CTA; `courseCompletionUiModel.ts:77`의 failure에서만 finalize(false); `mainTabNavigation.ts:25`; `MyCoursesScreen.tsx:95`. 계정에 기존 코스가 없으면 이 경로만으로 Execution 코스를 만들지 않는다. 운영 사용자 코스 존재는 조회하지 않았다.
- Execution은 geometry 누락 때 `precompute`/`precomputeTransit`로 자동 복원을 시도하고(`ExecutionScreen.tsx:74`), 명시 재계산은 `getActualRouteBaselines`→`planTimeFit`→LegacyResults로 이어진다(`:274`). `travel.ts`의 walk/car는 TMAP, transit는 ODsay 직접 요청이다. proxy=true guard가 이 경계를 막지 않는다. cache hit·키 없음·비용 제한 등에 따라 실제 요청은0일 수 있다.
- 현재 effective public 입력에 TMAP/ODsay client key **존재=true**를 값 없이 확인했다. 유효성·제품 권한·최종 Archive 포함 여부는 미확인이다. 이미 Execution에 진입한 세션은 activeCourse→Home 이어가기 경로도 갖는다. activeCourse 초기값은 null이므로 이를 cold start 영속 복원으로 표현하지 않는다.
- 결론: **조건부 공개 도달 가능한 TMAP/ODsay를 공급자 사실표에서 제외하면 안 된다.** 신규 V1 추천의 자동 fallback은 아니며, 기존 코스/실패 분기에 한정된 앱 직접 전송이다. 양 끝 좌표·수단/좌표계·TMAP appKey 또는 ODsay query apiKey 전송은 §1/2에 합쳐 고지한다. TourAPI를 이 경로로 실제 호출한다는 추가 근거는 이번에 확정하지 않았다.
- 추가 관찰: Execution hydration catch의 raw `err` console 인자가 남아 있다. §4의 Auth/adapter 안전 로그 확인은 앱 전체 raw 오류0 선언이 아니다. 현재 에러에 실제 개인정보가 들어간 사례는 미관찰. 최소 교정이 필요하면 **UIUX 소유** `ExecutionScreen.tsx`의 catch를 고정 안전 코드로 바꾸는 범위와 실패 fixture를 인계한다. 이 감사가 UI 파일 수정 승인은 아니다.

### 7.3 공개 문서 담당용 공급자 추가 사실

공식 자료 확인일 **2026-09-08**. 아래 법인명은 공식 문서의 주체이며, TimeFit 계정에 별도 계약이 있는지까지 확인한 것은 아니다. 소재지와 실제 전송/처리 국가는 분리한다.

| 공급자 | 법인·연락 근거 | 처리·보유 공개 내용 / 남는 질문 |
| --- | --- | --- |
| Supabase | 현행 [서비스 약관](https://supabase.com/terms)과 [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum)는 **SUPABASE PTE. LTD.**(Singapore)를 계약 주체로 명시. [Privacy](https://supabase.com/privacy)는 **Supabase, Inc.**, 연락 `privacy@supabase.com` | Privacy는 운영자/사이트 이용 정보와 고객이 맡긴 end-user Customer Data를 구별하며 후자는 주로 processor/DPA 경계. DPA는 DB·앱 운영을 위한 보관/삭제/이전 등, 계약기간 또는 기능을 통한 선행 삭제, 계약 종료 후 반환 요청기간30일 및 그 뒤 삭제를 명시. **TimeFit 사용자 탈퇴 후30일 고정 보유라는 뜻 아님**. 적용 계약 버전·법인/하위처리자·Edge/메일 처리 국가·실제 로그/백업 보유는 계정 계약/DB 인계로 확정 필요 |
| Cloudflare Worker·Turnstile | [Privacy](https://www.cloudflare.com/policies/privacy/)의 **Cloudflare, Inc.**, [Turnstile 안내](https://www.cloudflare.com/turnstile-privacy-policy/) 연락 `dpo@cloudflare.com` | IP/TLS/UA·site/origin 신호를 bot 방지에 처리. 고객 사이트 보호는 processor, Turnstile bot 탐지 개선은 controller라고 별도 설명하므로 ‘고객 지시 처리만’으로 축약하지 않음. 일반 방침은 목적/법적 필요에 따라 보유하며 이번 확인 문서에서 TimeFit widget 신호의 고정 일수는 확인 못함. Worker 로그/drain·실제 처리 국가·계약 적용은 미확인 |
| Kakao Local/Maps/route·외부 카카오맵 | [개인정보처리방침](https://www.kakao.com/policy/privacy), [개발자 운영정책](https://developers.kakao.com/terms/ko/site-policies)의 **주식회사 카카오**. 개인정보보호부서, 고객센터1577-3754 및 공식 고객센터 연결 | 목적 달성시 파기, 서비스별 예외, 개인위치정보 이용·제공사실 확인자료6개월 보유를 공개. 이를 **TimeFit의 Local/publictraffic 원시 좌표·API 접속 로그 모두6개월**로 확대하지 않음. 해당 제품별 좌표/로그·backup 보유와 국내/국외 처리, 캐시·지도 표시의 실제 계약 적용은 추가 확인 필요 |
| 조건부 TMAP·ODsay | [TMAP API](https://tmapapi.tmapmobility.com/) / [티맵모빌리티 공식 사이트](https://www.tmapmobility.com/), [ODsay LAB](https://lab.odsay.com/)은 ODsay 공급자를 **(주)아로정보기술**, 문의02-6261-5242(내선262)로 명시 | 기존 코스의 직접 route 공급자이므로 공개 사실에서 누락 금지. TimeFit 키가 연결된 API 계약 주체·보유/국가·제한 설정과 TMAP API 전용 개인정보 문의창구는 미확인. 소비자 내비 앱의 계정 보유기간을 API 원시 요청에 전용하지 않음 |

최소 남는 공급자 질문은 ‘TimeFit이 쓰는 제품의 좌표/검색어/접속 신호별 보유기간 및 삭제·백업 예외, 실제 처리 국가/하위처리자, 적용 계약 법인/역할’이다. 공개자료에 없는 값을 ‘서비스 종료시’ 같은 문구로 창작하지 않는다. 국내 위치 관련 신고 문의는 별도 답변 대기다.

### 7.4 최종 QA 승인 묶음 — 이번 미실행

- 사용자 선택 확정 → 공개 문서 게시·연결 승인/registry 준비 → 동일 public distribution 후보의 최종 QA 순서 유지. 원격 배포가 필요하면 대상/이전 배포/영향을 별도 승인받는다.
- 운영 smoke는 **공개 고정 부산 장소의 수동 출발/복귀, 180분 이내 최초 추천1회**로 묶는다. GPS 거절로 실제 개인 위치 전송0, 기존 세션 재사용. 새 Auth/CAPTCHA가 필요하면 계정 생성 범위를 포함한 별도 승인 전 중단한다. 검색을 쓴다면 명시 검색1회, adapter 정상 빈 fallback 포함 Local HTTP최대2. 자동 반복/더 보기/2곳 선택0.
- 소스 계약상 최초 신규 provider attempt≤8. adapter 호출 상한24, 각 요청 최대 walk/transit2회이므로 route-proxy POST 보수적 상한48(실제 provider≤8), 상세1건을 여는 경우 connector≤4 추가로 **POST≤52/provider≤12**를 승인 상한으로 제시한다. cache/lease hit는 실제 provider0일 수 있으며 실제 집계와 함께 기록한다. 이 상한은 운영 배포 동일성을 먼저 확인한 뒤 적용하며 quota를 확대하지 않는다. 기존 session 외 Auth 내부 통신·SDK 타일/이미지 요청 수는 이 route 상한에 포함하지 않으며 전체 HTTP 상한으로 표현하지 않는다.
- receipt 미복원/transport_failed/limited 등 실패 시 재시도하지 않고 안전 enum·화면만 기록. 지도·Kakao 외부 handoff1회는 도메인 설정 확인과 같이 본다. legacy 실패 분기는 격리 fixture 근거를 사용하고 실제 완료 실패/운영 저장 코스/직접 TMAP·ODsay 호출을 만들지 않는다. 별도 2곳 QA는 통합이 기존 근거로 필요성을 판정하고 이번 smoke에 자동 추가하지 않는다.

### 7.5 네 항목 인수인계

1. **변경 파일:** 이 문서에 OPS-02 후속 절만 추가. 보드·공개 publish 문서·타 역할·제품/설정 수정0. 기존 공유 변경 보존.
2. **유지 계약:** provider/legacy·180분/2곳·quota/timeout·공개 API·계정/캐시 정책 불변. 실제 경로/CAPTCHA/Auth/계정삭제/원격 변경/배포/게시/업로드/commit/push0. env는 메모리 파싱만, 값/키/사용자 데이터 출력·저장0.
3. **테스트·근거:** public 입력 검증 및 linked hostname/Worker명 비교 성공. CLI 배포 metadata1회 인증 실패로 중단. `node --import tsx --test test/ui/course-completion-history.test.ts` **14/14 PASS**, 완료 실패→recorded=false 분기 재확인(전체 navigation/provider 운영 실행 증거는 아님). 기존84 PASS는 재실행/이번 운영 성공으로 복사하지 않음. 공식 공급자 자료 및 source 추적, 문서 whitespace 검사 수행.
4. **다음 결정·위험:** §7.1 최소 설정 화면/안전 메타데이터를 한 번에 요청. DB-OPS-02 공통 결과 반영, DOCS는 조건부 TMAP/ODsay·Supabase 법인별 적용 구분·Turnstile 이중 처리 목적 반영 필요. UI raw error catch는 해당 소유자 최소 보완 검토. 사용자 선택 확정→공개 문서 연결→최종 QA이며, 원격 확인 미충족을 ‘운영 확인 완료’로 승격하지 않는다.
