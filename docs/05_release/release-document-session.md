# RELEASE-DOCS-01 — 공모전 출시 문서 마감

## 현행 완료 — DOCS-CAPTCHA-NOTICE-FINAL-01 (2026-09-10)

최종 `1.0.0(1)`에 이미 구현·검증된 회원가입 CAPTCHA가 공개 개인정보처리방침의 Cloudflare 설명에서 빠진 세 곳만 보완하고 기존 Cloudflare Pages 프로젝트 `jjaturi-docs` Production에 재게시했다. 새 수집 기능이나 목적을 추가한 변경이 아니며 현재 가입 보안 동작을 정확히 설명하기 위한 정정이다.

### 변경 파일·세 문구

- `publish/privacy-policy.md`, `public-site/privacy/index.html`
  1. 처리 시기: `회원가입, 비로그인 추천 또는 비밀번호 로그인 보안 확인과 공개 문서 접속 때`
  2. 목적: `악성 자동 요청 탐지·차단, 회원가입·로그인·추천 API 보호와 Cloudflare의 bot 탐지 개선; 공개 문서 호스팅·보안`
  3. 거부 영향: `보안 확인을 거부하면 보호 대상 회원가입·비로그인 추천·비밀번호 로그인을 진행할 수 없음`
- 본 기록: 로컬 검증, 기존/신규 배포, 공개 본문 확인과 유지 경계를 기록했다.

개인정보처리방침 ID `privacy-policy`, 버전 `1.0`, 시행일 `2026-09-09`, 실제 URL은 유지했다. 이번 정정은 이미 존재하는 처리의 누락 설명을 보완하므로 새 문서 ID·version이나 재동의로 전환하지 않았다. 이용약관·지원 안내 내용과 URL도 변경하지 않았다.

### 배포·공개 검증

| 항목 | 결과 |
| --- | --- |
| 배포 전 확인 | 인증된 계정에서 기존 Production 배포 `38d73fba-b013-4e88-8c44-52376abdf8d7` 1건 확인; 프로젝트 중복 생성0 |
| 새 Production 배포 | `89fce301-82df-4523-9fb1-b374e53f4731` / `https://89fce301.jjaturi-docs.pages.dev` |
| 업로드 범위 | `public-site/` 승인7파일. Wrangler는 변경 파일1개 업로드·기존 일반 파일4개 재사용 후 `_headers`, `_redirects` 적용 |
| 실제 개인정보처리방침 | `https://jjaturi-docs.pages.dev/privacy/` — 비로그인 iPhone User-Agent HTTPS200, 새 세 문구·version1.0·시행일 확인, canonical/immutable 원격 본문과 로컬 파일 byte 일치 |
| 이용약관·지원 링크 | `https://jjaturi-docs.pages.dev/terms/`, `https://jjaturi-docs.pages.dev/support/` — HTTPS200, privacy 본문의 두 링크와 `mailto:sdongheun@gmail.com` 유지 |
| 로컬 검사 | `validate-public-site.mjs` PASS(허용7파일·HTML3페이지·version1.0), Markdown/HTML 세 문구 대조 PASS, `git diff --check` PASS |

### 현행 게시 해시

| 문서 | SHA256 |
| --- | --- |
| privacy HTML | `10dacbcc689cdf3d71b251edee4762b8c29c8c349e397ab09f83861f398cf342` |
| terms HTML | `9e2bc417ddd92c469ef74cb003955f7aa465d870482138d3517b0515527d3c14` |
| support HTML | `38b9bf339b64804e2171daf73be9c563ee8f229616889a70a34a5907b7ec0254` |

### 유지 경계·다음 인계

- 제품 코드·빌드·DB registry/동의/기록·App Privacy 설정·GPS 제거·암호화·출시 방식·App Store Connect는 변경하지 않았다. 추가 공급자 조사·문의, DPA 전면 재조사와 심사 제출도 수행하지 않았다.
- 공개 URL과 DB/UI 인계값은 privacy `privacy-policy`/`1.0`/`https://jjaturi-docs.pages.dev/privacy/`, terms `terms-of-service`/`1.0`/`https://jjaturi-docs.pages.dev/terms/`, support `https://jjaturi-docs.pages.dev/support/`로 유지한다.
- 다음 남은 게이트는 Connect 심사 버전 `1.0.0(1)` 선택과 암호화·심사 계정·심사 메모·자동 출시의 최종 확인이다. CAPTCHA 안내 보완만으로 이 게이트나 심사 제출을 완료 처리하지 않는다.

아래 RELEASE-PUBLIC-DOCS-PUBLISH-01 최초 게시 절의 privacy SHA256과 배포 ID는 2026-09-09 최초 게시 이력이다. 현행 공개 privacy 본문과 배포는 이 절의 값을 적용한다.

## 현행 완료 — RELEASE-PUBLIC-DOCS-PUBLISH-01 (2026-09-09)

사용자가 개인정보처리방침·이용약관·지원 안내의 공개 게시와 운영자명 **신동흔**, 지원 이메일 **sdongheun@gmail.com** 공개를 승인했다. 승인된 문안의 시행일을 실제 게시일 **2026-09-09**로 Markdown과 HTML에 동일하게 반영하고 Cloudflare Pages에 게시했다. 아래 과거의 게시 보류·부분 승인·승인 대기·예정 URL 기록은 이 완료 절보다 이전 이력이다.

### 게시 결과

| 항목 | 실제 값 |
| --- | --- |
| Pages 프로젝트 | `jjaturi-docs` |
| 환경·branch | Production / `main` |
| 배포 ID | `38d73fba-b013-4e88-8c44-52376abdf8d7` |
| immutable 배포 URL | `https://38d73fba.jjaturi-docs.pages.dev` |
| 개인정보처리방침 | `https://jjaturi-docs.pages.dev/privacy/` |
| 이용약관 | `https://jjaturi-docs.pages.dev/terms/` |
| 지원 안내 | `https://jjaturi-docs.pages.dev/support/` |
| 게시일·시행일 | `2026-09-09` |
| 게시 시각 확인 | Cloudflare 응답 `2026-09-09 12:04:43 UTC` (`21:04:43 KST`) |
| 문서 버전 | 개인정보처리방침 `1.0`, 이용약관 `1.0`; 지원 안내는 registry version 대상 아님 |
| 게시 승인 | 사용자 승인 수신 완료 |

게시 전에 인증된 Cloudflare 계정에서 `jjaturi-docs` 배포 목록을 조회했고 API code `8000007`로 프로젝트가 없음을 확인했다. 프로젝트를 한 번 생성한 뒤 `docs/05_release/public-site/`만 Direct Upload했다. Wrangler 결과는 일반 파일 5개와 `_headers`, `_redirects`를 합친 승인 대상 7파일 업로드 및 Production 배포 완료다. 저장소 전체·환경파일·내부 작업 문서는 게시하지 않았다.

### 공개 접근 검증

| 검증 | 결과 |
| --- | --- |
| 비로그인 HTTPS | privacy·terms·support 모두 인증 header·cookie 없이 iPhone User-Agent GET, 최종 canonical URL에서 HTTP/2 `200`, `text/html; charset=utf-8`; `Set-Cookie` 없음 |
| 보안·권한 header | 세 페이지 모두 CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` 확인 |
| 모바일 표시 구조 | 세 페이지 `width=device-width` viewport, 공개 CSS HTTPS `200`, 넓은 표의 가로 스크롤 규칙 확인. Computer Use 없이 iPhone User-Agent 응답 본문과 반응형 구조를 검사했으며 별도 실기기 시각 캡처는 수행하지 않음 |
| 문서 간 링크 | 세 원격 본문에서 privacy·terms·support canonical 링크를 모두 확인하고 대상 세 URL의 HTTPS `200` 확인 |
| 문의 메일·공개 정보 | privacy·support의 `mailto:sdongheun@gmail.com`, 세 페이지의 운영자명 `신동흔`과 지원 이메일 표시 확인 |
| 원격 동일성 | iPhone User-Agent로 받은 privacy·terms·support 원격 본문 SHA256이 각 로컬 게시 HTML과 일치 |
| 정적 검사 | `validate-public-site.mjs` PASS: 허용7파일·HTML3페이지·version1.0·상대 링크·메일·viewport·보안 설정·금지 script/placeholder |

### 게시 파일 SHA256

| 파일 | SHA256 |
| --- | --- |
| `_headers` | `b350678edd0dc026d0d0db85ffc34ab438c19a3e973e50147e1acf82ffecd08f` |
| `_redirects` | `484196d32c42c33fd7a5bcf192b00ef861ef578e3c8bebe71d10725501ef01a5` |
| `assets/styles.css` | `c915f42fcc8552bbd366767a2098b6c05b5ce38416546aab6985a87111081f4c` |
| `privacy/index.html` | `a42a4e48b5fe9cf6547b33a8a26fd9b1c57d3386fccdbca0b575d4f8b6b0f933` |
| `robots.txt` | `16ceb5ee3e0dc13aa9adf31a3ebbe45a1d965b8c2b9f72eaf84e5911e140ed95` |
| `support/index.html` | `38b9bf339b64804e2171daf73be9c563ee8f229616889a70a34a5907b7ec0254` |
| `terms/index.html` | `9e2bc417ddd92c469ef74cb003955f7aa465d870482138d3517b0515527d3c14` |

### DB·UI 연결 인계값

| 연결 대상 | ID / version | 실제 URL | 시행일·검증 | 이번 작업 상태 |
| --- | --- | --- | --- | --- |
| 개인정보처리방침 | `privacy-policy` / `1.0` | `https://jjaturi-docs.pages.dev/privacy/` | `2026-09-09`; 비로그인 HTTPS200·원격 hash 일치 | DB 담당이 inactive 준비 후 원자적 active 전환, UI 가입·내정보와 Connect Privacy Policy URL에 인계. 이번 작업 쓰기0 |
| 이용약관 | `terms-of-service` / `1.0` | `https://jjaturi-docs.pages.dev/terms/` | `2026-09-09`; 비로그인 HTTPS200·원격 hash 일치 | DB 담당이 privacy와 같은 transaction에서 active 전환, UI 가입 문서에 인계. 이번 작업 쓰기0 |
| 지원 안내 | registry 대상 아님 | `https://jjaturi-docs.pages.dev/support/` | 게시일 `2026-09-09`; 비로그인 HTTPS200·원격 hash 일치 | UI 내정보 문의와 Connect Support URL에 인계. 이번 작업 변경0 |

DB registry는 privacy/terms 두 문서의 위 URL·ID·version·승인시각을 대조해 기존 행과 과거 동의를 보존하면서 전환한다. UI는 registry가 반환한 privacy/terms와 실제 support URL을 사용하고, 문서 누락·stale version·열기 실패 때 가입 우회를 허용하지 않는다. DB·앱 코드·App Store Connect는 이번 작업에서 변경하지 않았다.

QA-ODSAY-REMOVE-01의 소스·고정 fixture 수락은 유지하되, 최종 iOS release bundle/export/Archive에서 ODsay URL·키·query builder·usage write·신규 attempt가 없는지 확인하는 최종 출시 빌드 검증은 아직 남아 있다.

## 현행 — RELEASE-PUBLIC-DOCS-PUBLISH-01 최종 문안 승인 대기 (2026-09-09)

`QA-ODSAY-REMOVE-01`의 소스·고정 fixture QA 수락을 반영했다. 개인정보처리방침 Markdown/HTML에서 ODsay를 신규 수신자 행에서 제거하고, 과거 저장 코스에 남은 provider·이동시간·geometry 표시는 새 요청이나 저장을 발생시키지 않는 읽기 전용 호환으로 구분했다. Supabase는 인증·DB·Edge Function 처리위탁과 싱가포르 계약 수령자, 서울 주 DB·`route-proxy`, DPA 보유 기준을 반영했다. Cloudflare는 미국 계약 수령자, Turnstile 사이트 보호 처리와 bot 탐지 개선 목적, 글로벌 처리 가능성과 DPA·Privacy Policy 보유 기준을 반영했다. 추가 공급자 조사·문의는 수행하지 않았다.

- 변경 파일: `publish/privacy-policy.md`, `public-site/privacy/index.html`, `publish/data-facts.md`, `publish/release-gates.md`, 본 기록.
- 공개 계약 경계: GPS 미사용, 수동 검색·지도 핀과 선택 좌표 전송, Kakao·TMAP·Visit Busan의 실제 전달, 버튼 기반 기록·체류, 개인화, Live Activity는 유지했다. DB·앱 코드·App Store Connect는 변경하지 않았다.
- QA 근거: 집중129/129, 최종 화면52/52, typecheck PASS, UI760 PASS/0 FAIL/기존1 SKIP, core450/450 PASS. 이는 소스·fixture 수락이다. 최종 iOS release bundle/export/Archive에서 ODsay URL·키·query builder·usage write·신규 attempt 부재를 확인하는 검증은 아직 남아 있다.
- 공개 후보 검증: 정적 validator PASS(허용7파일·HTML3페이지·version1.0), Markdown/HTML의 ODsay·Supabase·Cloudflare 의미 대조 PASS, `git diff --check` PASS. 후보 HTML SHA256은 privacy `ae0a83ba4ea630da0c66f562b272697715e2e02cb7b6e9b815467646ce0c657c`, terms `25ab9c48c72d1a590219cfb72c356c99292405263f34f6a15078828f421e47c9`, support `38b9bf339b64804e2171daf73be9c563ee8f229616889a70a34a5907b7ec0254`이다.
- 게시 중복 방지 확인: 예정 hostname `https://jjaturi-docs.pages.dev`는 2026-09-09 DNS가 확인되지 않았다. 인증된 Pages 프로젝트 조회는 게시 승인 뒤 배포 직전에 다시 수행하며, 예정 주소를 실제 URL로 취급하지 않는다.
- 현재 값: privacy/terms 버전 `1.0`; 시행일은 `공개 게시와 함께`로 Markdown/HTML이 일치한다. 실제 URL·게시일·비로그인 HTTPS 결과·게시 hash·DB/UI 연결값은 미발급이며 게시 승인 전에는 채우지 않는다.

최종 문안 변경은 ODsay 신규 전송 제거, Supabase·Cloudflare 최소 국외 처리 표 추가, Cloudflare Pages 접속 시 네트워크 요청 처리 추가이다. 시행일을 실제 게시일로 교체하고 7파일을 게시하려면 이 후보에 대한 사용자의 별도 승인이 필요하다. 아래 “최소 게이트 재판정·부분 승인” 절은 이전 판단 이력이며 이 절의 후보 검토 결과가 현행이다.

## 현행 — RELEASE-PUBLIC-DOCS-PUBLISH-01 최소 게이트 재판정·부분 승인 (2026-09-09)

사용자는 미확정 사실이 해결될 때까지 `jjaturi-docs` 공개 게시를 보류하기로 결정했다. 이후 “완벽한 검증”을 출시 조건으로 만들지 말고 확인하지 않아도 되는 항목을 걸러, 조사 후 승인 가능한 범위는 승인하라고 지시했다. 이에 따라 공개 문안과 최종 앱 경로, 계정 비민감 설정, 공급자 공식 문서를 다시 대조해 아래처럼 범위를 축소한다. 이 절의 부분 승인은 Cloudflare Pages 배포 승인이 아니다.

### 승인한 범위

- 이용약관 `1.0`과 지원 안내 문안은 **게시 문안 승인**한다. 삭제 결과가 불확실할 때 같은 계정·같은 삭제 요청으로 다시 확인하라는 안내는 중복 요청을 안전하게 처리하는 현재 계약과 일치한다.
- 개인정보처리방침 `1.0`의 제1·2·4~8절과 제3절의 실제 기술 흐름·전달 항목은 **내용 승인**한다. Supabase 핵심 DB와 route-proxy의 서울 지역, Kakao 검색·지도·경로 요청, Cloudflare Turnstile 보안 신호, Visit Busan 허용 사진 요청, TMAP·ODsay의 기존 코스 조건부 경로를 유지한다.
- Visit Busan 이미지 호스트의 내부 로그 보유기간, 공급자 내부 로그의 정확한 물리 삭제 시각, 모든 하위처리자의 개별 서버 위치는 운영자가 통제하거나 확인할 수 없는 상세값이므로 **게시 선행조건에서 제외**한다. 확인되지 않은 값을 만들지 않고 기술 흐름만 알리는 현재 문장은 게시 차단 사유가 아니다.
- Supabase DPA는 Supabase Pte. Ltd.를 처리자로, 계약 기간 또는 운영자의 조기 삭제 요청까지를 처리기간 기준으로 두고 계약 종료 후 30일 반환 기간 뒤 사본 삭제를 정한다. Cloudflare DPA는 Cloudflare, Inc.(미국)를 처리자로, 계약 종료 또는 처리 필요 소멸 중 빠른 때까지를 보유 기준으로 두며 Turnstile 안내는 사이트 보호 목적의 처리자 역할과 탐지 개선 목적의 독자 역할을 구분한다. 따라서 두 공급자의 모든 내부 로그에 고정 일수를 요구하지 않는다.
- 로컬 출시 입력은 route proxy `true`이고 TMAP·ODsay 키는 존재한다. 신규 추천은 Supabase Edge→Kakao이며 proxy 실패 시 TMAP·ODsay 자동 fallback은 없다. 그러나 기존 코스 실행·재계산 직접 경로가 남아 있으므로 TMAP·ODsay를 공개 수신자에서 제거하지 않는다.

### 공개 게시 승인에 남은 최소 게이트

다음 한 묶음만 남긴다: 실제 전송이 확인된 Supabase·Cloudflare의 국외 처리와 Kakao·TMAP·ODsay의 외부 좌표 요청에 적용할 **공개·동의 근거를 확정**하고, 그 결론에 따라 개인정보처리방침 제3절의 `확인 중` 표현을 확정 문장으로 바꾼다. 공급자의 모든 내부 로그 보유기간이나 전 세계 서버를 조사하는 과제가 아니라, 현재 기능에 적용할 위탁·제3자 제공·국외 이전 고지 방식만 정하는 작업이다. 운영자가 임의로 법적 관계를 확정하지 않으며, 공식 지원 답변 또는 개인정보보호 전문 검토 중 하나로 닫는다.

이 최소 게이트가 닫히면 개인정보처리방침 `1.0` 전체와 공개 7파일의 배포를 별도로 승인할 수 있다. 실제 URL·게시일·시행일·비로그인 HTTPS 검증은 배포 후 기록한다.

| 항목 | 현행 값 |
| --- | --- |
| Cloudflare Pages 프로젝트 | 후보 `jjaturi-docs`; 생성·사용 가능 여부 미확인 |
| 개인정보처리방침 실제 URL | **미발급** — 예정 경로 `/privacy/`를 실제 URL로 취급하지 않음 |
| 이용약관 실제 URL | **미발급** — 예정 경로 `/terms/`를 실제 URL로 취급하지 않음 |
| 지원 안내 실제 URL | **미발급** — 예정 경로 `/support/`를 실제 URL로 취급하지 않음 |
| 게시일 | **미정** — 게시하지 않음 |
| 시행일 | **미정** — 공개 게시와 함께 시행하는 현행 후보 문구 유지 |
| 문서 버전 | 개인정보처리방침 `1.0`, 이용약관 `1.0`; 게시 전 후보 버전이며 시행 중인 공개본이 아님 |
| 비로그인 HTTPS 검증 | **미실행/미완료** — 실제 배포 URL이 없어 HTTP 상태·모바일 표시·문서 간 링크·문의 메일을 검증할 수 없음 |
| 이번 작업의 외부 변경 | 게시·DB registry·앱 코드·UI 링크·Connect 변경 0건 |

### DB·UI 연결 인계값

| 문서 | registry ID | version | URL | 연결 상태 |
| --- | --- | --- | --- | --- |
| 개인정보처리방침 | `privacy-policy` | `1.0` | 미발급 | DB registry 쓰기 및 UI/Connect 연결 금지 |
| 이용약관 | `terms-of-service` | `1.0` | 미발급 | DB registry 쓰기 및 UI 연결 금지 |
| 지원 안내 | registry 대상 아님 | 해당 없음 | 미발급 | UI/Connect 연결 금지 |

DB 담당은 실제 HTTPS URL·게시일·시행일·비로그인 접속 검증·게시 승인 결과를 인계받기 전 `privacy-policy`와 `terms-of-service`를 active로 등록하거나 기존 값을 교체하지 않는다. 게시 재개 시에는 승인된 공개 대상 7파일만 배포하고, 실제 URL 세 개의 비로그인 HTTPS 접근과 모바일 표시·상호 링크·`mailto:sdongheun@gmail.com`을 검증한 뒤 그 결과와 게시 파일 hash를 이 절에 기록한다.

동일 상태의 세부 실행표는 [`publish/release-gates.md`](publish/release-gates.md)의 “RELEASE-DOCS-08 — 게시·DB·UI 단일 인계표”에 이미 기록되어 있다. 그 표의 `jjaturi-docs.pages.dev`는 예정 주소일 뿐 실제 공개 URL이 아니다. 이번 기록에서는 게시 작업이나 기존 조사를 반복하지 않았다.

## 현행 완료 — DOCS-MANUAL-LOCATION-FINAL-01 (2026-09-09)

[문안 검토·완료 기록](manual-location-copy-review.md)에 따라 GPS 미사용 전환을 공개 Markdown 원본과 정적 HTML, App Store 설명·심사 메모·App Privacy 입력안에 반영했다. QA-RELEASE-MANUAL-LOCATION-01의 집중191/191·map14/14·전체 자동·Release Simulator 빌드/설치/기동 PASS와 U-LIVE-FINAL-HANDOFF-FEEDBACK-01의 집중89/89·사용자 정상 확인을 함께 대조했다. 후자의 기기/빌드·1/2곳 세부 결과는 없으므로 전체 실기기 PASS로 확대하지 않았다.

1. **변경 파일·목적:** 공개 원본 `publish/privacy-policy.md`, `terms.md`, `support.md`와 대응 HTML3개에 수동 검색·지도 핀, 선택 좌표 전송, GPS/위치 권한 미사용, 버튼 기반 도착·출발·완료/체류시간, 앱·Live Activity 공유 진행을 반영했다. `publish/app-store-submission.md`, `data-facts.md`, `release-gates.md`, `manual-location-copy-review.md`에 Connect 문구·App Privacy·screenshot·위치 회신 상태와 게시 인계를 갱신했다.
2. **유지 경계:** 수동 좌표의 서버/API·외부 지도 전송, 최대3시간·2곳, 별도 동의 개인화, guest 가져오기, 계정/삭제·공급자 미확인 계약을 유지했다. 과거 코스 좌표 변경·동일 run 재계산을 추가하지 않았고 신고 면제·법적 적합성을 확정하지 않았다. 제품 코드·DB registry·Connect·공급자 설정·게시·업로드·제출0.
3. **검증:** 정적 사이트 validator PASS(7파일·3페이지·version1.0), 공개 원본/HTML 의미 대조 PASS, Connect 설명513자·한국어 Notes988자/2,236bytes·영어 Notes2,088bytes, `git diff --check` PASS. 공개 HTML hash는 privacy `9585bac0...a8af4`, terms `25ab9c48...e47c9`, support `38b9bf33...0254`이며 전체 값은 검토 문서 §11에 기록했다.
4. **남은 결정·위험:** 위치 문의 답변 대기는 끝났고 실제 신고 처리·추가 고지 확인이 남았다. 공개 시행일/URL, 공급자 법적 분류·국외 이전 필수 필드, Search History·Diagnostics·Device ID App Privacy, 심사 전화·계정, 최종 Distribution/iPhone, 교체 screenshot03·05, Connect 수동 출시 저장, 게시·업로드·제출 승인이 필요하다.

아래 과거 `위치 답변 대기`, `스크린샷 미촬영`, GPS 권한 사용 문구는 당시 이력이며 현행 판정은 이 절과 `manual-location-copy-review.md` §11을 따른다.

## 현행 — 위치 문의 회신 반영·문서 마감 점검 (2026-09-09)

- 이전: 위치 문의 답변 대기 → 관찰: 사용자가 위치정보지원센터 회신 전문을 전달함 → 변경: 답변 접수, 일반 신고 준비와 공개 출시 보류로 구분한다. 회신은 법적 유권해석이나 신고 면제 확인이 아니다.
- iOS 위치 API 사용 구조에서 별도 개인위치정보사업 등록보다 위치기반서비스사업 신고 여부를 검토하라는 회신이다. 신고에는 사업자등록이 필요하다고 안내받았다. 사용자 요청에 따라 특례를 전제로 출시하지 않는다. 사업자등록·신고 접수·처리 완료 증거는 아직 없다.
- 수동 출시 결정은 유지한다. Connect 실제 저장, 심사 제출, 공개 출시는 각각 미확인/별도 단계이며 이번 문서 정리를 해당 완료로 확대하지 않는다.
- 문서 1단계는 **확인된 사실 갱신 완료, 최종 공개본 마감·게시 미완료**다. 회신은 Supabase·Cloudflare·Kakao의 처리 관계, 처리 국가·보유기간을 확정하지 않았으므로 개인정보처리방침 제3절의 미확인 내용을 확정값으로 바꾸지 않았다. 일반 신고 준비에 따른 위치정보 고지 범위도 후속 확인 대상이다.
- 현재 길찾기 시작 기준을 외부 handoff 확인에서 명시적인 길찾기 버튼 클릭으로 정정한다. 클릭은 도착·체류 학습 증거가 아니며 주변 둘러보기에는 적용하지 않는다.

### 인수인계

1. 변경 파일: 이 기록, `publish/data-facts.md`, `publish/release-gates.md`, `publish/support.md`, `public-site/support/index.html`. 회신 상태와 현재 동작 안내만 정정했다.
2. 유지 경계: 기능 코드·DB·가입 동의 계약·공개 URL·문서 version1.0은 변경하지 않았다. 원본 이용약관·개인정보처리방침의 미확인 공급자 정보를 추정하지 않았다.
3. 검증: 아래 마감 검증 기록 참조. 정적 사이트 검사는 문안의 법적 적정성이나 실제 HTTPS 게시 검증을 대체하지 않는다.
4. 다음 단계: 공급자별 미확인 고지 사실과 일반 신고 관련 고지 범위를 확정한 뒤 공개본 승인·게시 → 실제 URL로 DB/UI 연결. 이번 작업의 외부 게시·운영 DB 쓰기·Connect 변경은 0건이다.

아래 과거 완료/대기 기록과 충돌할 때 이 절을 현행 상태로 적용한다.

마감 검증: `node docs/05_release/validate-public-site.mjs` PASS(7파일·3페이지·version1.0), `git diff --check` PASS. 지원 HTML 현행 후보 SHA256: `eca0ac2e400fdf21b4e07bf06cf333101f4e7d2a9009a814a3359befc5e319c0`. 실제 공개 URL·시행일은 아직 미정이다. 기능 코드 변경이 없어 앱 테스트·빌드는 실행하지 않았다.

## 현행 완료 — RELEASE-DOCS-08 후속·Connect 입력자료 마감 (2026-09-09)

[병렬 검증 후속 명령](../work/integration-decision/release-parallel-verification.md)의 `RELEASE-DOCS-08 후속`을 기존 DOCS-08에 합쳤다. DOCS-06·DB/API 완료 근거와 API 암호화·Kakao 플랫폼·UIUX 설정 인계를 재사용했으며 기존 조사를 반복하지 않았다. 위치 신고 필요 여부와 후속 절차는 답변 대기로 유지했고 특정 법적 결론을 확정 사실로 쓰지 않았다.

### 1. 변경 파일과 목적

- `publish/app-store-submission.md`: App Privacy를 데이터 유형/확정·보류/목적/사용자 연결/추적/적용 기능·저장 경계/근거의 Connect 입력표로 마감했다. 기기 내 전용, 일시 외부 요청, 서버 보관을 분리하고 공급자 장기 보유·결합이 확인되지 않은 Search History·Diagnostics·Device ID만 입력 보류로 남겼다.
- `publish/app-store-submission.md`: 부산 밖 현재 시각 수동 입력부터 최대 두 곳·Kakao 길찾기·선택적 Live Activity·직접 완료·방문 기록까지 한/영 복사용 심사 메모를 작성했다. 현재 운영시간에 후보가 없을 때 다른 운영 중 부산 장소 또는 주간 재확인을 안내하며 숨은 심사 기능이나 추천 보장을 전제하지 않았다.
- `publish/app-store-submission.md`: 6.9형 screenshot 6장의 실제 기능 기반 캡션과 미촬영 상태, 사용자 직접 입력 항목을 정리했다. 기본 metadata와 연령등급은 완료 보고로 닫고, 암호화 검토 및 `usesNonExemptEncryption=false` 앱 설정·생성 plist 반영을 완료로 기록했다.
- `publish/data-facts.md`: Kakao WebView/REST 인증 경계와 `https://timefit.local` 등록 도메인 일치를 반영해 iOS Bundle ID 미등록을 출시 설정 공백에서 제외하고 법적 역할·로그 보유 미확인과 분리했다.
- `publish/release-gates.md`: `DEC-RELEASE-MANUAL-02` 수동 출시를 현행으로 적용하고 이전 자동 출시를 철회 이력으로 남겼다. Kakao는 현재 WebView/REST 구현상 iOS Bundle ID 등록 불필요, `https://timefit.local` 등록 도메인 일치, 설정 조치0으로 닫았다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 제품 코드·DB·중앙 정책·개인화·위치 처리·공급자 설정은 수정하지 않았다. 공개 게시, registry 쓰기, UI 링크 연결, Connect 조작, build 업로드·제출도 수행하지 않았다.
- 앱명 짜투리, 운영자 신동흔, 지원 이메일 `sdongheun@gmail.com`, 대한민국 단독 무료 배포, iPhone/iOS17, 최대3시간·최대2곳, 별도 동의 개인화와 명시적 guest 가져오기 계약을 유지했다.
- 연령등급은 사용자 완료 사실만 기록했다. 계산된 정확한 등급 값은 전달받지 않아 추정하지 않았다. 위치 문의 답변 전에는 신고 필요 여부·별도 약관·책임자·주소·전화와 공개 가능 시점을 확정하지 않는다.

### 3. 실행한 검증과 결과

- `git diff --check` **PASS**.
- App Review Notes 추출 결과: 한국어 **917자/UTF-8 2,043 bytes**, 영어 **1,927자/1,927 bytes**. 두 문안은 각각 독립된 `text` 코드 블록으로 복사 가능하다.
- 현행 두 문서에서 내부 `delete-account ACTIVE` 기술 문구와 위치 신고의 확정 결론이 심사 문안에 없는지 확인했다. `자동 출시`는 현행값이 아니라 `DEC-RELEASE-MANUAL-02`에 의해 철회된 이력으로만 남겼다.
- 공개 HTML은 수정하지 않아 `validate-public-site.mjs`를 다시 실행하지 않았다. DOCS-08의 기존 정적 페이지 validator PASS와 후보 hash를 재사용했다. 제품 코드 변경이 없어 앱 전체 테스트를 반복하지 않았다.

### 4. 남은 결정·위험·재현 조건

- **공급자/전문 확인:** Kakao 검색 요청의 장기 보유·계정 결합, Supabase/Cloudflare 기본 로그·device-level 신호의 처리 범위가 확인돼야 Search History·Diagnostics·Device ID의 App Privacy 답을 확정할 수 있다. 기존 미발송 문의문을 사용하며 이번 작업에서 발송하지 않았다.
- **위치 답변:** 답변을 받으면 개인정보 처리방침 제4·7절, 이용약관의 위치 관련 조항, 지원 안내의 필요한 법정 연락 표시와 게시 가능 시점만 최소 반영한다. 답변이 실제 수집·전송·보관 구현 변경을 요구할 때만 App Privacy를 다시 대조한다.
- **사용자 직접 입력:** 국제 형식 심사 전화번호, 별도 비만료 심사 계정의 생성·로그인 확인, Connect의 수동 출시 선택·저장 확인이 남았다. 계정 비밀번호는 Connect 전용 필드에만 입력한다.
- **최종 실행:** 실제 Privacy/Support URL, App Privacy 입력·preview/publish, 한/영 Notes 입력, 최종 후보 screenshot 6장, version/build, Distribution IPA의 암호화 plist·manifest 확인, 공개 URL 연결과 업로드·제출은 각각 선행 게이트 및 별도 사용자 승인 뒤 실행한다.

## 현행 완료 — RELEASE-DOCS-08·문의/게시 인계 준비

[게시 인계 명령](../work/integration-decision/release-publication-handoff.md)의 RELEASE-DOCS-08을 완료했다. Connect 저장 완료 사용자 보고를 현행 값으로 반영하고, 미해결 고지를 수신처별 발송 전 문의문으로 만들었으며, 게시·DB registry·UI·Connect URL 연결 대상을 단일 표로 고정했다. 위치 문의 재접수, 계정 확인, 실제 문의 발송·게시·운영 변경은 수행하지 않았다.

## RELEASE-DOCS-08 완료 인수인계 — 2026-09-09

### 1. 변경 파일과 변경 목적

- `publish/app-store-submission.md`: Connect 앱의 사용자 액세스 전체, 무료 `₩0`, 대한민국만과 부제·설명·프로모션·키워드·저작권 저장 완료 보고를 반영했다. 설명은 사용자가 실제 저장한 500자 본문을 현행으로 교체했고, 저작권은 `2026 Dongheun Shin`으로 갱신했다. 개인정보 운영자명 `신동흔`은 유지했다.
- `publish/notice-inquiries.md`: Supabase 공식 지원, Cloudflare 개인정보 문의, Kakao 개인정보보호부서/고객센터, 국내 개인정보 전문 검토 수신처별 제목·본문·영향 문단을 작성했다. 이미 접수한 위치 문의는 새 문의문을 만들지 않고 답변 반영 규칙만 기록했다.
- `publish/release-gates.md`: 핵심 metadata를 저장 완료로 전환하고 URL·App Privacy·연령·수출규정·심사 정보·build·자동 출시 설정은 미완료로 유지했다. 최종 HTML3개·시행일/version/hash·대상7파일·Pages 프로젝트/실제 URL·문서 ID·다음 DB/UI/Connect 담당을 한 표로 고정했다.
- 본 문서: DOCS-08 변경, 유지 경계, 검증과 남은 답변/승인을 현행 인수인계로 기록했다.

### 2. 유지한 계약과 금지 경계

- 사용자가 보고한 Connect 저장 결과를 반영했으며 문서 세션이 계정 원문의 영문 철자·대소문자를 직접 검증했다고 기록하지 않았다. 완료된 설명을 DOCS-07 초안으로 덮어쓰지 않는다.
- 앱명 짜투리, 개인정보 운영자 신동흔, 지원 이메일 `sdongheun@gmail.com`, 부산·최대180분·최대2곳·별도 동의 개인화·Live Activity·만14세 이상 계정 정책을 유지했다.
- App Privacy, 실제 URL, 연령등급, 수출규정, 심사 전화·계정, version/build와 자동 출시 설정은 완료 보고가 없으므로 미완료다. Kakao iOS 플랫폼 등록도 요구 여부를 확정하지 않았다.
- 제품 코드·DB·migration·중앙 정책·공급자 설정을 수정하지 않았다. Computer Use·계정 재확인·문의 발송·계약 동의·Pages 생성/게시·registry/UI/Connect 조작·업로드/제출·commit/push는 0회다.

### 3. 검증

- Connect 저장 code block을 추출해 앱명3자, 부제14자, 설명500자, 키워드92 bytes, 프로모션40자, 저작권18자를 확인했다. 사용자가 보고한 본문과 일치하며 Apple 길이 제한 안이다.
- `notice-inquiries.md`에 Supabase·Cloudflare·Kakao·국내 전문 검토 수신처, 각 미발송 상태, 영향 문단과 비밀값 제외 지침이 있는지 확인했다. Supabase 공개 이메일이나 전문 자문 수신처를 만들지 않았다.
- `node docs/05_release/validate-public-site.mjs` PASS: 공개 대상7파일·HTML3페이지·version1.0, 상대 링크·메일·viewport·allowlist·보안 헤더·금지 script/placeholder 검사를 통과했다. 구조 검사이며 법적 적합성 판정은 아니다.
- DOCS-08 후보 SHA256: privacy `cf0fef530872b23a02425bb8b714bcff9cdb3faa397aa21339f1796c52a10039`, terms `2be46a6c1db1390d4661612a1c077e80489affe33d1b43d6a19c593d0b8d2a17`, support `694195573d382d7d90201ac76e900238a6553225e867b820966ea8a7b03f2b64`. 실제 시행일 또는 답변 영향 문단이 바뀌면 재계산한다.
- `git diff --check` PASS. DOCS-06·DB/API NOTICE·계정 결과와 DOCS-07 공식 근거를 재사용했고 앱 테스트·개인화 C·Archive·운영 API/DB 조회·기존 조사는 반복하지 않았다.

### 4. 남은 답변·승인

1. **기존 위치 문의 답변:** 재접수하지 않는다. 답변이 직접 다룬 신고·면제/특례, 별도 위치 약관, 공개 주소·전화·책임자와 확인자료 의무만 공개 문단에 반영한다.
2. **공급자 사실 답변:** `notice-inquiries.md`의 Supabase·Cloudflare·Kakao 문의는 발송 전이다. 공개 자료와 계정 화면에 없던 처리 항목·지역·보유 예외와 상품별 역할만 답변 대상으로 유지한다.
3. **국내 법적 분류 답변:** 공급자 답변을 근거로 위탁·제3자 제공·국외 이전, 별도 가입 동의와 공개 필드를 전문 검토한다. 수신처는 아직 선정되지 않았고 문의도 발송하지 않았다.
4. **최종 본문·게시 승인:** 위 답변이 영향을 주는 문단만 반영해 실제 시행일·새 hash·대상7파일·프로젝트 충돌 전 정보를 제시한다. 사용자 승인 뒤에만 Pages 게시와 실제 URL→DB→UI→Connect 인계를 시작한다.

## 현행 완료 — RELEASE-DOCS-07·Connect 앱 생성 반영

[Connect 병렬 명령](../work/integration-decision/release-docs-connect-parallel.md)의 RELEASE-DOCS-07을 완료했다. DOCS-06·DB/API NOTICE·계정 확인 결과를 재사용해 공개 Markdown/HTML의 내부 검토 표현을 이용자용 문장으로 정리하고, 남은 필수 고지 질문과 Connect 필드별 복사용 문안을 준비했다. 위치 답변·공급자 전문 해석·실제 게시·DB/UI 연결·스토어 입력/업로드/제출은 수행하지 않았다.

## RELEASE-DOCS-07 완료 인수인계 — 2026-09-09

### 1. 변경 파일과 변경 목적

- `publish/privacy-policy.md`, `terms.md`, `support.md`와 `public-site/` 대응 HTML: 제목의 후보 표시, 내부 편집 메모, 테스트·plan·DPA·endpoint·legacy·artifact·설정 상태와 미확정 대괄호를 이용자용 본문에서 제거했다. 이용자가 알아야 하는 처리 항목·목적·전달·보유·삭제, 계정/개인화/Live Activity와 권리 행사 이메일은 유지했다. 공급자의 미확인 처리 국가·보유기간은 완결된 것처럼 숨기지 않고 “확인 중”으로 표시했다.
- `publish/data-facts.md`: 공개 본문에서 뺀 계정·계약·검증 근거를 유지하고, 위치·Kakao·Supabase·Cloudflare에 대해 `정확한 질문 / 이미 확인한 사실 / 답변할 기관·공급자 / 영향 문단 / 답변 전 가능한 작업` 표를 추가했다.
- `publish/app-store-submission.md`: App Store Connect 앱이 iOS / 짜투리 / 한국어 / `com.dongheun.mobile` / SKU `jjaturi-ios` / 여행 / 보조 없음으로 생성됐다는 사용자 보고를 반영했다. 앱 이름·부제·설명·키워드·선택 프로모션·저작권을 필드별 복사용 블록으로 정리했다.
- `publish/release-gates.md`: “앱 레코드 미생성”을 앱 생성 완료·필드 저장 대기로 교체했다. App Privacy·가격·대한민국·URL·연령·수출규정·심사 정보·build는 완료 보고 없이 입력 완료로 올리지 않았다.
- 본 문서: DOCS-07 변경·유지 경계·검증과 남은 답변/실행 항목을 현행 인수인계로 기록했다.

### 2. 유지한 공개 계약·정책 경계

- 앱명 짜투리, 운영자 신동흔, 지원 이메일 `sdongheun@gmail.com`, 최대180분·기본1곳/사용자 선택 최대2곳, 부산, iPhone·iOS17, 별도 동의 개인화, 명시 guest 가져오기, Live Activity, 만14세 이상 계정 자기확인을 유지했다.
- Supabase·Cloudflare 계정 설정과 Kakao 사용 상품을 재조사하지 않았다. 표시되지 않은 공급자 보유기간·처리 국가를 만들거나 위탁·제3자 제공·국외 이전을 단정하지 않았다.
- Kakao iOS Bundle ID 미등록을 무조건 장애로 확정하지 않았다. 최종 앱의 사용 SDK·키·WebView host 계약에서 필요한 등록인지 API/UI 담당이 판단하도록 유지했다.
- 제품 코드·DB·migration·중앙 정책·공급자 설정을 바꾸지 않았다. Pages 프로젝트/URL 생성, 공개 게시, registry/UI 연결, Connect 조작, 업로드·제출, commit/push는 0회다.

### 3. 검증

- `node docs/05_release/validate-public-site.mjs` PASS: 공개 대상7파일·HTML3페이지·version1.0. 상대 링크·메일·viewport·allowlist·보안 헤더·금지 script/placeholder 검사를 통과했다. 구조 검사이며 법적 적합성 판정은 아니다.
- 필드별 code block을 직접 추출해 앱명3자, 부제14자, 설명569자, 키워드92 bytes, 선택 프로모션40자, 저작권8자를 확인했다. 부제30자·설명4,000자·키워드100 bytes 제한 안이다.
- 공개 Markdown/HTML에서 `clean cold start`, `legacy artifact`, Free/Workers plan, DPA version, 쿼터, PASS/ACTIVE, 내부 편집 메모, 답변용 대괄호와 `게시 승인본 후보` 검색 결과가 0건이다.
- DOCS-07 게시 후보 SHA256: privacy `cf0fef530872b23a02425bb8b714bcff9cdb3faa397aa21339f1796c52a10039`, terms `2be46a6c1db1390d4661612a1c077e80489affe33d1b43d6a19c593d0b8d2a17`, support `694195573d382d7d90201ac76e900238a6553225e867b820966ea8a7b03f2b64`. 위치·공급자 답변과 실제 시행일 반영 뒤 다시 계산한다.
- 문서 작업이므로 앱 테스트·개인화 C·Archive·운영 DB/API·계정 화면 조사를 반복하지 않았다. `git diff --check` PASS로 문서 공백 오류 0건을 확인했다.

### 4. 남은 항목 — 답변·승인·후속 실행만

1. **위치 답변:** 신고·면제/특례, 별도 위치 약관, 공개 주소·전화·위치정보관리책임자, 위치정보 이용·제공사실 확인자료 의무 중 답변이 직접 다룬 범위만 공개 세 문서에 반영한다.
2. **공급자 답변/전문 해석:** `data-facts.md`의 DOCS-07 질문표에 있는 Kakao 요청의 위탁/제3자 제공·국외 이전, Supabase 기본 이메일/로그 예외, Cloudflare Turnstile 이중 역할과 미표시 국가·보유만 남았다. 같은 계정 화면 확인은 반복하지 않는다.
3. **사용자 Connect 병렬 결과:** 생성된 기존 앱에서 무료·대한민국과 복사용 이름/부제/설명/키워드/저작권 저장 성공 여부만 받는다. 선택 프로모션은 생략 가능하다. 실제 URL·App Privacy publish·연령/수출규정·심사 제출·build 업로드는 이번 병렬 입력 범위가 아니다.
4. **게시 승인 뒤 실행:** 위치·공급자 문안을 반영한 version1.0 세 문서와 새 hash를 검토해 승인받은 뒤 Pages 게시 → 실제 URL3개 → DB registry → UI 링크 → 최종 build/스크린샷 → Connect 잔여 입력 순서로 인계한다.

## 현행 완료 — RELEASE-DOCS-06 A/B·위치 답변 대기

[고지 마감 명령](../work/integration-decision/release-notice-closeout.md)의 RELEASE-DOCS-06 A와 B를 완료했다. 위치 답변 없이 가능한 Cloudflare Pages 계약·처리 초안, 공급자 NOTICE와 사용자 직접 확인 계정 사실, App Privacy·스토어 metadata/심사/screenshot 준비와 정적 페이지 검증을 반영했다. C의 위치 답변 반영·최종 문안 승인·실제 게시는 수행하지 않았다.

## RELEASE-DOCS-06 완료 인수인계 — 2026-09-09

### 1. 변경 파일과 변경 목적

- `publish/data-facts.md`: DB/API NOTICE를 반영해 Supabase 표준 계약 주체를 **SUPABASE PTE. LTD.**로 정정하고 Supabase, Inc.의 지원 하위처리자/Privacy 역할과 분리했다. Kakao Local·Maps JavaScript·Maps REST routing, Cloudflare 보안 흐름의 조건부 production 소비, TMAP·ODsay 최신 도달 조건을 공급자별 사실과 계정 확인 공백으로 정리했다. Cloudflare Pages의 계약·기본 네트워크 처리·글로벌 지역/하위처리자·로그 설정과 게시 직전 조건부 문구를 추가했다.
- `publish/privacy-policy.md`, `public-site/privacy/index.html`: 표준 Supabase 계약/처리 구조, Cloudflare의 세션 없는 추천·비밀번호 로그인 보안 처리, EXIT-03 뒤 legacy 경로 한계를 같은 범위로 반영했다. 표준 계약을 해당 계정의 별도 계약 증거로, clean cold start를 모든 legacy 전송0으로 확대하지 않았다.
- `publish/app-store-submission.md`: App Privacy의 자유 입력 분류를 닫고 API NOTICE 흐름을 반영했다. 부제14자·설명569자·키워드92 bytes·프로모션40자, 최신 6.9형 screenshot 허용 규격과 최종6장 목록, 적용 완료 아이콘, Support URL 연락 정보, 연령·수출규정 Connect 입력 근거표를 정리했다.
- `publish/release-gates.md`: 공급자 차단을 공개자료 조사 완료와 계정 사실/전문 해석 대기로 교체하고 위치 답변 영향 필드·독립 준비표를 추가했다. 아이콘과 Apple 공식 기준 확인일을 최신 상태로 갱신했다.
- `publish/terms.md`, `support.md`와 대응 HTML: DB/API NOTICE가 기존 서비스 범위·외부 서비스 링크·지원 안내를 바꾸지 않아 수정하지 않았다. 이 무변경도 B 대조 결과다.
- 본 문서: A/B 완료, 유지 계약, 검증 결과와 위치 답변 뒤 남은 최소 항목을 기록했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 짜투리/신동흔/`sdongheun@gmail.com`, 대한민국·iPhone·iOS17, 최대180분·최대2곳, 별도 동의 개인화, 명시 guest 가져오기, Live Activity 완료, 만14세 이상 계정 자기확인, 무료·여행/보조 없음·자동 출시 결정을 유지했다.
- 미확정 비로그인 아동 허용 문구를 복원하지 않았다. 계정 가입 연령을 앱 전체 이용 금지·실제 연령 인증·부모 동의 기능으로 확대하지 않았다.
- Kakao 전송을 일괄 위탁 또는 제3자 제공으로, Cloudflare의 processor/controller 목적을 하나로, SUPABASE PTE. LTD.의 Singapore 소재를 모든 데이터의 Singapore 저장으로 단정하지 않았다. 서울 DB/Auth 핵심 지역도 Edge·SMTP·로그·backup의 전부 국내 처리로 확대하지 않았다.
- 제품 코드·DB·migration·중앙 정책·공급자 설정을 수정하지 않았다. 계약 동의·문의 발송, Pages 프로젝트 생성, 공개 게시, registry/UI/Connect 입력, 가입/탈퇴, 함수 배포, Archive·업로드·제출, commit/push는 0회다.

### 3. 확인·검증 결과

- `DB-RELEASE-NOTICE-01`: 공개 서비스 약관의 SUPABASE PTE. LTD., 2026-08-01 DPA, 하위처리자·region·Edge·logs·SMTP·backups 공식 자료와 기존 서울 project/배포 사실을 대조한 결과를 인수했다. 운영 DB/API 재호출·사용자 기록 조회는 없었다.
- 열려 있던 Supabase 대시보드의 조직 헤더에서 `FREE` plan 표시를 읽기 전용으로 확인했다. 프로젝트 설정 상세 이동은 자동 승인 검토에서 거부되어 계약·SMTP·로그 화면을 추가 열지 않았고, 키·token·계약 원본·사용자 로그를 문서에 남기지 않았다.
- `API-RELEASE-NOTICE-01`: Kakao 상품별 공개 조항과 source/event 추적, Cloudflare production 소비 분기, EXIT-03 뒤 legacy 도달성을 인수했다. 제한 fixture 8/8 PASS이며 실제 공급자 호출은 0회다.
- 최신 공식 확인(2026-09-09): Cloudflare Self-Serve Subscription Agreement, DPA, Privacy Policy, Sub-Processors와 Logs; Apple App Privacy, 필수 metadata, Support URL, screenshot 규격, 연령등급과 수출규정 안내를 확인하고 각 문서에 URL을 남겼다.
- `node docs/05_release/validate-public-site.mjs` PASS: 공개 파일7개, HTML3개, version1.0. 상대 링크·메일·viewport·allowlist·보안 헤더·금지 script/placeholder 검사를 통과했다. validator는 법적 적합성 판정이 아니다.
- 계정 사실 반영 뒤 게시 후보 SHA256: privacy `5f259c882c343bd6c07492c6c11a937473824ed62dedb9c9091452cc617eb9a8`, terms `cdf76aa1247f228fc54e4b4cf085dc3556aa3d8b90f8fc74b2454afe10992345`, support `968e2b17de81fa0954a6d6252b23c3f9f7a0b4196a1960a9f56241d04f7c8a97`. 위치·전문 해석 문안과 실제 게시일 반영 뒤 다시 계산한다.
- 문서 작업이므로 앱 전체 테스트, 개인화 C, Archive를 반복하지 않았다. `git diff --check` PASS로 문서 공백 오류 0건을 확인했다.

### 4. 남은 항목 — 한 묶음 인계

| 분류 | 남은 최소 항목 | 반영 위치·완료 증거 |
| --- | --- | --- |
| **위치 답변만 필요한 것** | 신고·면제/특례, 별도 위치 약관, 주소·전화, 위치정보관리책임자와 개인위치정보 이용·제공 사실 확인자료 관련 답변 범위 | 답변 원문/핵심 문구가 실제 다룬 부분만 privacy 제4·7절, terms 위치 특약, support와 HTML3개에 반영. 제품 변경 요구가 있으면 통합에 분리 인계 |
| **계정·출시 화면에 남은 사실** | Supabase는 delete-account region, 기본 SMTP의 실제 처리 범위, 제공자 로그 보유·처리 국가와 로딩되지 않은 Jobs만 남음. Cloudflare는 Worker 실행 지역과 기본 서비스 로그 보유·처리 국가만 남음. Kakao는 약관 버전/별도 계약·상품별 로그 안내와 최종 iOS Bundle ID/host 등록이 남음. App Store Connect 앱 레코드와 모든 version/build·URL·Privacy·가격·연령·수출규정·심사 필드는 미생성 | 표시되지 않은 공급자 사실은 공식 문의/전문 검토로 넘긴다. Kakao 플랫폼과 Connect는 담당자가 실제 출시값을 생성·입력한 뒤 결과만 해당 게이트에 기록. 키·token·계약 원본·사용자 로그·비밀번호는 문서에 남기지 않음 |
| **전문 해석 필요** | Kakao 상품별 요청이 위탁/제3자 제공에 해당하는지와 플랫폼 약관 제11조⑦·⑧ 적용, Cloudflare Turnstile의 처리자/독자 목적을 국내 고지에 어떻게 나눌지, 확인된 Supabase/Cloudflare 처리에서 국외 이전 고지·동의가 필요한 범위. 위치 답변이 이를 직접 다루지 않으면 별도 유지 | 적용 법조항·필수 필드가 확정된 경우에만 공개 문구/App Privacy/gate를 변경. 공급자 고정 보유기간이나 법적 지위를 추정하지 않음 |
| **게시 승인** | 위 세 분류 반영 뒤 대괄호·내부 메모 없는 privacy/terms/support와 HTML3개, 실제 게시일/version1.0, 새 hash, Pages 조건부 호스팅 문구, 공개 이름·메일, 대상7파일과 `jjaturi-docs` 프로젝트/예정 주소 | 사용자가 최종 묶음을 승인한 뒤에만 프로젝트 생성·Direct Upload·모바일 HTTPS 검증. 실제 URL을 RELEASE-LINKS-01에 인계 |

위치 답변 없이 가능한 문서·스토어 준비는 모두 완료했다. screenshot은 규격·순서까지 준비됐고 실제 촬영은 최종 후보 화면이 필요하다. App Privacy Publish, metadata 입력, 심사 계정 생성, Distribution IPA·온라인 Validate와 업로드/제출은 문서 공백이 아니라 이후 계정·빌드·승인 실행 단계다.

### 5. 사용자 직접 확인 결과 — 2026-09-09

- **Supabase:** Free Plan / SUPABASE PTE. LTD. / DPA Version 1(2026-08-01). Custom SMTP 비활성. `route-proxy` region은 `ap-northeast-2`; `delete-account`는 최근 실행 로그가 없어 region 확인 불가. Edge Function Logs 조회 가능, Log Drains 미사용(Pro 이상), Free backup 미제공, Cron Integration 미설치. Jobs는 화면 로딩 지속으로 확인하지 못했다.
- **Cloudflare:** Workers Free / Cloudflare, Inc. / DPA Version 6.4(2026-04-03), 활성, 결제수단 없음. Managed Turnstile과 hostname `timefit-captcha.sdongheun.workers.dev`, 같은 이름의 Worker route 활성. Workers Logs·Traces 비활성. 실행 지역은 메트릭 화면에 표시되지 않았고 Pages 프로젝트는 없다.
- **Kakao Developers:** Local 키워드 장소 검색·좌표→행정구역·좌표→주소·주소검색, Maps JavaScript, REST 도보(`/route-open/openapi/v1/walk.json`)·대중교통(`/route-open/openapi/v1/publictraffic.json`)의 실제 사용과 endpoint별 호출 기록을 확인했다. JavaScript 허용 도메인은 `http://localhost:3000`, `https://timefit.local`, `http://localhost:8000`, `http://127.0.0.1:5500`; iOS Bundle ID는 미등록이다. 카카오톡 공유·유료 카카오맵 API는 미사용, 별도 유료 계약은 확인하지 않았고 무료 API는 확인 시점 2,691/월 최대 제공량 3,000,000으로 제한 상태가 없다.
- **App Store Connect:** 앱 레코드가 아직 생성되지 않았다. 따라서 앱 정보, version/build, URL, App Privacy, 가격·세금, 연령등급, 수출규정과 심사 전화·계정도 모두 미생성이다.
- 위 결과는 사용자가 계정 화면을 직접 확인해 전달했다. 계약·설정의 유무를 공급자 고정 보유기간이나 한국법상 위탁/제3자 제공·국외 이전 판정으로 확대하지 않았다. 쿼터와 결제수단 정보는 비용·가용성 참고이며 개인정보 미처리의 근거가 아니다.

### 6. 사용자 직접 확인 순서 — 완료 기록·Computer Use 사용 금지

사용자 요청에 따라 이후 계정 화면 확인에 Computer Use를 사용하지 않는다. 아래 순서는 이번 직접 확인에 사용한 절차이며 재조사를 지시하기 위한 목록이 아니다. 키·token·sitekey·비밀번호·계약 원본·사용자 행/로그·개인 주소는 복사하거나 캡처하지 않았다.

1. **Supabase 조직·프로젝트**
   - Organization Settings의 Legal/Agreements 또는 기존 Order/DPA: `온라인 표준 계약` / `별도 계약` / `표시 없음`, 표시되는 계약 법인·버전/효력일.
   - Authentication의 SMTP 설정: `default` / `custom`; custom이면 공급자명 또는 host 도메인만.
   - Edge Functions 설정: route-proxy와 delete-account의 region 고정 여부와 표시 region. 없으면 `미지정/표시 없음`.
   - Logs/Log Drains: Auth·Postgres·API·Edge별 조회/보유 설명, drain `없음/있음`; 있으면 목적지 서비스·국가·보유기간만.
   - Database Backups: FREE에 표시되는 retention/복원 범위, 추가 복제 지역 표시, 외부 cleanup scheduler의 유무·주기·마지막 성공 상태. 기존 확인된 `FREE`, 서울 project, PITR false·목록0은 반복하지 않는다.
2. **Cloudflare 앱 보안 계정**
   - Account/Billing/Subscriptions 또는 Legal: `Self-Serve` / `별도 계약` / `표시 없음`, DPA 버전이 표시되면 버전만.
   - Turnstile의 해당 widget: active 여부와 허용 hostname 일치 여부만. sitekey·secret은 전달하지 않는다.
   - Workers & Pages의 기존 CAPTCHA Worker → Settings → Domains & Routes: widget callback/허용 host와 route 일치 여부, Observability/Logs·Logpush/drain의 on/off와 표시 보유기간·지역 제한/CMB 유무.
   - Pages project는 아직 만들지 않는다. `jjaturi-docs` 존재 여부가 계속 `없음`인지 만 확인한다.
3. **Kakao Developers 앱**
   - 내 애플리케이션 → 해당 앱 → 제품 설정/권한: Local, Maps JavaScript, Maps REST walk/publictraffic 각각 사용/허용 표시 여부.
   - 플랫폼 설정: 등록 iOS bundle과 Web 도메인이 최종 앱/지도 host와 일치하는지만 `일치/불일치`로 전달한다. 실제 key는 전달하지 않는다.
   - 약관/계약 화면: 플랫폼 서비스 약관 버전·동의/승낙 표시 또는 별도 계약 유무. 상품별 최종 이용자 요청 로그의 목적·보유·처리 국가 안내가 있으면 공개 문서명/URL만 전달한다.
   - 위 정보가 없으면 `상품별 처리 역할·로그 정보 표시 없음`으로 반환한다. 이 경우 API NOTICE의 단일 질문을 전문 해석/공식 문의 대상으로 유지한다.
4. **App Store Connect — 입력 전 읽기만**
   - App Information: 앱명, 기본 언어, bundle ID, 기본/보조 category, 대한민국 availability, 현재 age rating 설정 유무.
   - iOS 버전 페이지: version/build 중복 여부, description·keywords·Support URL·copyright·6.9형 screenshot 슬롯, App Review 연락 전화 입력 가능 여부와 release option.
   - App Privacy: 현재 published/draft 상태, Privacy Policy/Choices URL 슬롯, 데이터 유형별 기존 응답 유무. Publish는 누르지 않는다.
   - Pricing and Availability: 무료와 tax category 표시. 연령 설문은 현재 응답/계산 결과만, 수출규정은 build에 질문/결과가 보일 때만 전달한다.
   - 심사 계정은 `준비 가능/불가`만 전달하며 ID·비밀번호는 보내지 않는다.

반환 형식은 다음 한 묶음이면 충분하다.

```text
Supabase: 계약= / SMTP= / Edge region= / 로그·drain= / backup·scheduler=
Cloudflare: 계약·DPA= / Turnstile active·host 일치= / Worker route·logs·region= / Pages project 없음=
Kakao: Local= / Maps JS= / Maps REST walk·publictraffic= / 플랫폼 일치= / 약관·별도계약= / 상품별 로그 안내=
App Store Connect: 앱정보= / version·build= / URLs= / Privacy 상태= / 가격·세금= / 연령= / 수출규정= / 심사 전화·계정 준비=
```

## 현행 보완 완료 — RELEASE-DOCS-05-R1

[제한 보완 명령](../work/integration-decision/release-docs-icon-closeout.md)의 DOCS-05-R1을 현재 작업 폴더에 반영했다. 만14세 미만 비로그인 허용은 사용자 확정 범위가 아니므로 원본/HTML에서 제거했고, 공급자 고지 미확정을 필수 공백·미판정·조건부·비차단으로 좁혔다. 아래 ‘공급자 고지 준비’는 초안 작성 상태이며 법적 게시 수락이 아니다. 전체 조사 재실행이나 임의 정책 확정은 하지 않았다.

## RELEASE-DOCS-05-R1 완료 인수인계 — 2026-09-09

### 1. 변경 파일과 변경 목적

- 작업 위치는 `/Users/shindongheun/Desktop/myProject/TimeFit`, 현재 브랜치는 `main`, 확인 당시 HEAD는 `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f`다. 별도 Gemini worktree 두 곳은 각각 `critique_app_feasibility_logic`, `refactor_uiux_feature_logic` 브랜치였고 출시 문서 작업 위치가 아니었다. R1 명령 파일과 시작 문구는 현재 폴더에 있었지만 개인정보 원본·HTML의 대상 문구와 완료 인계가 남아 있어 미반영 상태로 판정했다.
- `publish/privacy-policy.md`, `public-site/privacy/index.html`: `만 14세 미만 사용자는 계정을 만들 수 없고 비로그인 기본 기능만 이용할 수 있습니다`를 제거했다. 두 공개본에는 **계정 가입 대상 만14세 이상 → 신규 가입의 필수 자기확인 → 생년월일 수집·실제 연령 인증 아님**만 남겼다.
- `publish/data-facts.md`: 기존 공급자 사실표 아래에 대상 처리, 필수 고지 해당 여부와 기존 공식 근거, 확인 사실, 부족한 정확한 필드, 확보 출처·담당, 게시 판정을 한 표로 추가했다.
- `publish/release-gates.md`: 모든 미확인 국가·보유기간을 같은 차단으로 두던 표현을 교체했다. Supabase 적용 수탁자 법인명과 Kakao 적용 고지 체계만 현재 필수 공백으로 올리고, Cloudflare 앱 흐름·TMAP/ODsay·Pages는 활성/도달/게시 조건부, Visit Busan의 미확인 로그 기간은 그 사실만으로 비차단으로 분리했다.
- 본 문서: 경로·브랜치 확인, 표현 변경 이력, 검증 결과와 실제 게시 차단만 R1 완료 근거로 기록했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 이전 표현 **만14세 미만은 비로그인 기본 기능 이용 가능** → 문제 **확정되지 않은 이용 허용 정책을 공개 문구로 승격** → 교체 **확정된 계정 가입 범위와 자기확인만 기재** → 이유 **연령 결정과 비로그인 정책의 충돌 방지** → 상태 **현행**이다. 이를 만14세 미만 앱 이용 전면 금지, 부모 동의 기능, 생년월일 수집, 실제 연령 인증으로 바꾸지 않았다.
- AGE-01의 로컬 구현·자동 회귀 완료와 실제 가입·실기기 확인 대기는 내부 게이트에서 계속 구분한다. 개인정보 원본에는 구현 전 문구를 남기지 않았다.
- 앱이 공급자에게 요청을 보낸다는 사실을 곧바로 운영자 위탁·제3자 제공·국외 이전으로 단정하지 않았다. AWS 서울 DB를 모든 처리의 국내 완료로, TTL을 물리 삭제로, 법인 소재지를 처리 국가로 바꾸지 않았다.
- 제품 코드, DB·migration, 중앙 정책, 공개 URL/registry/UI/Connect를 변경하지 않았다. 외부 게시·프로젝트 생성·업로드·제출·commit/push는 0회다.

### 3. 실행한 검증과 결과

- `pwd`, `git branch --show-current`, `git worktree list --porcelain`로 현재 경로·`main`·HEAD와 별도 worktree를 확인했다.
- 개인정보 원본과 HTML 두 파일을 대상으로 `만 14세 미만.*비로그인`, `만14세 미만.*비로그인`, `비로그인 기본 기능만 이용`을 검색해 일치 0건을 확인했다.
- `node docs/05_release/validate-public-site.mjs` PASS: 공개 파일7개, HTML3개, version1.0. 이는 구조·링크·금지 항목 검증이며 필수 고지의 법적 완결성 검증은 아니다.
- 게시 후보 SHA256: privacy `4219dba66a7b77f816e87c47dbb2bc28a413e030d79b25b632d44969a22e3773`, terms `cdf76aa1247f228fc54e4b4cf085dc3556aa3d8b90f8fc74b2454afe10992345`, support `968e2b17de81fa0954a6d6252b23c3f9f7a0b4196a1960a9f56241d04f7c8a97`. 실제 게시일·남은 필수 문안 반영 뒤 다시 계산한다.
- 기존 개인정보/Apple/공급자 전수 조사는 반복하지 않았다. R1 명령, 최신 DOCS-05 인계, 개인정보 두 공개본, 기존 공급자 사실표와 그 안의 공식 근거만 재사용했다. 문서 작업이므로 앱 테스트·Archive·운영 DB/API 검증은 반복하지 않았다.

### 4. 답변 수신 후 반영·게시 승인에 필요한 한 묶음

1. **위치 문의 답변:** 답변이 실제 다루는 신고·면제/특례, 별도 위치 약관, 공개 주소·전화, 위치정보관리책임자 범위만 privacy/terms/support와 HTML3개에 반영한다. 답변으로 공급자 계약·처리 국가·로그 보유까지 해결됐다고 하지 않는다.
2. **현재 필수 공급자 공백:** 운영자 계정 근거로 Supabase에 실제 적용되는 수탁자 법인명을 확인한다. Kakao Developers의 실제 사용 API·적용 계약/약관 근거와 위치 문의 또는 전문 검토로, 확인된 검색어·주소·좌표 전송에 적용할 위탁/제3자 제공/국외 이전 고지 체계를 확정한다. 국외 이전이 실제 확인될 때만 국가·시기/방법·수령자 연락처·목적·항목·보유기간을 채운다.
3. **조건부 증거:** 최종 production에서 Turnstile/Worker가 활성인지와 최종 Release에서 TMAP·ODsay legacy 경로가 도달 가능한지만 각 담당 인계로 받는다. 비활성·도달 불가가 증명되면 공급자 필드를 억지로 만들지 않는다. Cloudflare Pages 호스팅 처리는 게시 승인 후 프로젝트를 만들기 전에 최종 문안 반영 여부를 확정한다.
4. **게시 승인:** 위 필수 항목을 반영한 HTML3개, 실제 게시일, 새 hash, 공개 대상7파일, Cloudflare 계정·신규 프로젝트 `jjaturi-docs`와 충돌 전 예정 주소를 한 묶음으로 제시한다. 사용자가 이름 **신동흔**·이메일 **sdongheun@gmail.com**을 포함한 최종 본문과 게시를 승인한 뒤에만 실제 URL을 생성·검증해 RELEASE-LINKS-01로 인계한다.

## 현행 실행 — RELEASE-DOCS-05 로컬 준비 완료·위치 답변 대기

[2단계 작업 명령](../work/integration-decision/release-stage-two.md)의 DOCS-05를 진행한다. 확정값 반영·공개 정적 페이지 준비부터 시작하고, 최종 문안/계정/주소 게시 승인 후 동일 작업에서 게시와 실제 URL 인계까지 진행한다. 위치 문의 미확정과 실제 게시를 구분. 기존 DOCS-04 전체 재감사 금지.

## RELEASE-DOCS-05 로컬 준비 인수인계 — 2026-09-09

### 1. 변경 파일과 목적

- `publish/privacy-policy.md`, `terms.md`, `support.md`: 책임자 신동흔, 권리 요청 `sdongheun@gmail.com`, 문서 version1.0·실제 게시일 시행, 만14세 이상 가입 자기확인을 반영했다. 공급자별 확인된 처리 흐름·공개 주체와 미확인 국가/보유기간을 구분하고 임의 값을 만들지 않았다. 위치 답변에 직접 영향을 받는 부분만 내부 편집 메모로 남겼다.
- `publish/data-facts.md`, `app-store-submission.md`, `release-gates.md`: delete-account ACTIVE/v1·verify_jwt=true·승인 소스/의존성 대조·무인증401 완료와 실제 탈퇴 E2E 미실행을 구분했다. 여행/보조 없음·무료·2026 신동흔·자동 출시 기본·별도 심사 계정 준비 결정을 반영했다.
- `public-site/`: 배포 대상만 담은 정적 산출물을 만들었다. `/privacy/`, `/terms/`, `/support/`, 공통 CSS, Cloudflare `_headers`·`_redirects`, robots만 포함한다. 추적·분석·로그인·문의 폼·JavaScript·외부 SDK는 없다.
- `validate-public-site.mjs`: 배포 파일 allowlist, 한국어·viewport·제목·메일·문서 탐색, 내부 placeholder/비밀 환경명/스크립트 금지, 보안 헤더를 검사한다.

### 2. 유지한 계약과 최신 인계

- 앱명 짜투리, 운영자/책임자 신동흔, 지원·권리 요청 메일, 한국/iPhone/iOS17, 180분/2곳·개인화·guest·Live Activity 계약을 유지했다. 신규 가입 연령 자기확인은 실제 연령 인증이나 생년월일 수집으로 표현하지 않았다.
- AGE-01 인계의 집중4/4, UI710 PASS/skip1, core399 PASS, public iOS export PASS를 반영했다. 로컬 구현·자동 검증 완료이며 실제 가입·실기기·공개 링크는 아직이다.
- DB §12의 함수 배포 완료를 반영했다. 정상 JWT·최근 password AMR·cascade·기기 정리를 검증하는 전용 계정 탈퇴1회는 별도다. 로그/backup/scheduler와 공급자 처리 국가·보유기간의 미확인은 삭제하지 않았다.
- 심사 승인 후 자동 출시가 기본이나 공개 차단이 있으면 승인 전에 수동 출시로 전환한다. Connect 설정, 아이콘 적용, Archive·업로드·제출은 이번 범위가 아니다.

### 3. 검증과 호스팅 준비 상태

- `node docs/05_release/validate-public-site.mjs` PASS: 공개 파일7개, HTML3개, version1.0. Python 표준 HTML parser로 세 페이지 파싱 PASS. 문서 간 링크·메일 링크·모바일 viewport·반응형 CSS·CSP/Referrer/Content-Type/Permissions 헤더를 확인했다.
- R1 반영 뒤 게시 후보 content SHA256: privacy `4219dba66a7b77f816e87c47dbb2bc28a413e030d79b25b632d44969a22e3773`, terms `cdf76aa1247f228fc54e4b4cf085dc3556aa3d8b90f8fc74b2454afe10992345`, support `968e2b17de81fa0954a6d6252b23c3f9f7a0b4196a1960a9f56241d04f7c8a97`. 위치 답변·필수 공급자 문안과 실제 게시일 확정 뒤 재계산한다.
- Cloudflare Pages 공식 Direct Upload 절차를 2026-09-09 확인했다. 인증된 Wrangler 계정에서 기존 Pages 프로젝트 목록은0개였다. 신규 프로젝트 후보는 `jjaturi-docs`, 예정 주소는 `https://jjaturi-docs.pages.dev`, 업로드 대상은 `docs/05_release/public-site/`만이다. 프로젝트 생성 전이므로 예정 주소를 실제 URL로 취급하지 않는다.
- 최신 Wrangler는 Node22를 요구해 실행하지 않았고 프로젝트 의존성을 바꾸지 않았다. Node20 호환 Wrangler4.42.0으로 목록만 읽었다. 원격 프로젝트 생성·게시0, registry/UI/Connect 쓰기0, 앱 테스트 반복0, commit/push0.

### 4. 답변 수신 후 반영·게시 승인 묶음

현재 위치 문의 답변이 오지 않았다는 사용자 확인에 따라 답변 영향 문안과 실제 게시를 보류했다. 나머지 확정값·정적 페이지·호스팅 계정 조사는 완료했으며 반복하지 않는다. 공급자 고지는 R1 표의 Supabase 수탁자 법인명·Kakao 적용 고지 체계를 닫은 뒤 완료로 판정한다.

1. **답변 반영:** 사용자가 받은 위치기반서비스 문의 답변 원문 또는 핵심 문구를 한 번 전달한다. 그 근거로만 신고/면제·별도 위치 약관, 운영자 주소·전화와 위치정보관리책임자 표시 필요 여부를 privacy/terms/support와 정적3페이지에 함께 반영한다. 답변 범위를 넘어 법적 지위를 만들지 않는다.
2. **게시 승인:** 반영된 최종 HTML3개, 실제 게시일, 갱신 hash, 공개 대상 `public-site/`7파일, 인증된 Cloudflare 계정의 신규 프로젝트 `jjaturi-docs`, 예정 `https://jjaturi-docs.pages.dev`를 한 묶음으로 제시한다. 사용자가 이 내용과 이름 **신동흔**·이메일 **sdongheun@gmail.com**의 공개 게시를 승인한 뒤에만 프로젝트 생성·Direct Upload를 실행한다.
3. **승인 후 같은 작업:** 로그인 없는 모바일 HTTPS를 세 경로에서 확인하고 실제 URL·응답·시행일/version/hash를 아래 표와 `release-gates.md`에 기록해 DB RELEASE-LINKS-01로 인계한다. URL이 Cloudflare 충돌로 달라지면 예상 주소를 실제 주소로 조용히 대체하지 않고 결과를 확인한다.

| 문서 | ID/version | 예정 경로 | 실제 URL |
| --- | --- | --- | --- |
| 개인정보 처리방침 | `privacy-policy` / `1.0` | `/privacy/` | 게시 전 |
| 이용약관 | `terms-of-service` / `1.0` | `/terms/` | 게시 전 |
| 지원 | registry 없음 | `/support/` | 게시 전 |

## 2026-09-09 통합 결정 인계 — 1단계 완료

[최신 사용자 결정](../work/integration-decision/release-user-decisions.md)의 DEC-RELEASE-PUBLIC-01·AGE/AUTO/ICON을 우선 적용한다. 아래 DOCS-04의 사용자 ‘미확정’ 목록은 작성 시점 이력: 책임자 신동흔/권리요청 지원메일 동일·실제 게시일/version1.0·Cloudflare Pages·여행/보조 생략·무료/2026 신동흔·전용 심사 계정 준비 확정. 자동 출시 기본(공개 차단 시 사전 수동 전환), 새 파란 시계 아이콘 방향 확정. 위치 문의 답변·최종 게시 승인/실제 URL·전화번호 입력은 완료가 아니다. DEPLOY-05 함수 배포 완료는 DB 사실표12절, 탈퇴 E2E는 아직 별도다. 같은 사용자 결정을 재질문하지 않는다.

## 현행 후속 완료 — RELEASE-DOCS-04

[최소 마감·링크 인계 명령](../work/integration-decision/release-delete-links-final.md)의 DOCS-04 절을 완료했다. DOCS-03 초안에 최신 완료/미실행 사실을 반영하고 사용자 결정과 게시→DB→UI 연결 인계를 정리했다. 실제 게시/registry/UI 연결은 승인 후 기존 RELEASE-LINKS-01로 진행한다.

## RELEASE-DOCS-04 완료 인수인계 — 2026-09-09

### 1. 변경 파일과 목적

- `publish/data-facts.md`: 기준일을 갱신하고 NATIVE-02의 진단 clock 제거·target별 privacy manifest 로컬 Archive 확인, EXIT-03의 기록 없는 종료→메인 보완, delete-account 미배포와 legacy 저장/전송 잔존을 정확히 구분했다.
- `publish/privacy-policy.md`, `terms.md`, `support.md`: 미완료 삭제 endpoint를 현재 제공 완료로 읽지 않도록 게시 조건을 추가했다. 조건부 도달 가능한 TMAP·ODsay와 Supabase 적용 법인 미확정을 개인정보 초안에 반영했다.
- `publish/app-store-submission.md`: 개인정보 명세 로컬 보완 완료, Apple Development Archive와 Distribution IPA·온라인 Validate 미실행, delete-account 배포 전 심사 메모 사용 금지를 반영했다.
- `publish/release-gates.md`: 오래된 manifest 차단을 ‘로컬 보완 완료·최종 IPA 대기’로 교체하고 삭제 endpoint를 명시적 차단으로 올렸다. 공개 문서 파일→URL→registry ID/version→내정보/가입/Connect 연결표와 역할별 실행 순서를 추가했다.
- 본 문서: DOCS-04 결과, 중복 제거한 사용자 결정 묶음, 공개 URL·가입 연결 인계를 기록했다.

### 2. 유지한 공개 계약·정책과 최신 사실

- 사용자 확정값인 앱명 **짜투리**, 운영자 **신동흔**, 지원 이메일 **sdongheun@gmail.com**, 대한민국 배포, iPhone 전용, iOS17 이상, 사업자등록 없음은 유지했다. 지원 이메일을 개인정보 권리 요청 창구로도 쓰는 것은 별도 결정으로 남겼다.
- 최대180분·최대2곳, 별도 동의 기반 개인화, guest 명시 가져오기, Live Activity 완료와 snooze 제거, 사진101/369·fallback268/369를 바꾸지 않았다.
- NATIVE-02는 진단의 `uptimeNanoseconds`를 제거하고 앱/Extension별 privacy manifest가 포함된 로컬 Development Archive를 검증했다. SIGNING-PREP-03은 자동 서명 기반 export 절차만 준비했다. EXIT-03 뒤 새 최종 Archive, Distribution IPA, 온라인 Validate·업로드는 실행되지 않았다.
- EXIT-03은 명시적인 기록 없는 종료의 MyCourses 이동을 메인 reset으로 교체하고 안전 로그 회귀를 통과했다. 기존 MyCourses/Execution·저장 코스 재계산과 조건부 TMAP/ODsay 전송 전체가 제거된 것은 아니다.
- DB-RELEASE-DELETE-PREP-03 기준 `delete-account`는 운영 미배포다. 함수 exact 의존성과 Edge 시작, adapter의 401/403/409/503 실패 전달 보완이 별도 FIX-04 범위이며, 그 중간 상태를 완료로 반영하지 않았다. 배포 뒤에도 전용 계정 삭제1회 검증이 필요하다.
- 위치기반서비스 관련 공식 문의는 답변 대기다. 신고 면제·특례·별도 약관 불필요나 법적 공개 가능을 확정하지 않았다. 불명인 공급자 처리 국가·로그/backup 보유기간도 만들지 않았다.

### 3. 실행한 검증과 실제 결과

- 요구된 NATIVE-02/SIGNING-PREP-03, EXIT-03, DB 사실표 §8~9, API OPS-02, DATA 최종 인계를 대조했다. 공개 초안과 내부 게이트의 오래된 Extension manifest/clock·Store Archive 완료 표현을 갱신했다.
- 연결 계약의 고정 registry ID가 `privacy-policy`, `terms-of-service`이고 두 active 문서·HTTPS URL·동일 version이 가입 선행임을 코드·DB 인계와 대조했다. 내정보의 현재 두 행은 `안내 페이지 준비 중`, `문의 방법 준비 중`이며 UI 연결 미완료로 기록했다.
- 문서 링크·용어·version placeholder, `delete-account`/manifest/Distribution/legacy 표현을 상호 검색했다. 실제 URL을 만들거나 예시 도메인을 운영값으로 쓰지 않았다.
- 문서만 변경했으므로 앱 테스트, native Archive, 개인화 C, 운영 API·DB 검증을 재실행하지 않았다. 외부 게시·Cloudflare 작업·registry/앱/Connect 쓰기·업로드·제출·commit/push는 0회다.

### 4. 사용자 결정 묶음

이미 확정되어 다시 묻지 않는 값: **짜투리 / 신동흔 / sdongheun@gmail.com / 대한민국 / iPhone / iOS17 이상 / 사업자등록 없음 / 공개 URL 미정·외부 게시 금지**.

공개 전에 한 번에 확정할 필수 결정:

1. 개인정보 권리 요청에도 `sdongheun@gmail.com`을 사용할지, 개인정보 보호 책임자를 `신동흔` 또는 `운영자` 중 어떻게 표시할지, 문의 답변에 따라 필요한 공개 주소·전화번호와 위치정보관리책임자 표기.
2. 만14세 미만 계정 생성을 차단하는 정책을 수락할지. 법정대리인 동의 경로를 새로 만드는 안은 이번 최소 출시 범위에 포함하지 않는다.
3. 게시 호스트/계정과 기본 HTTPS URL, 세 문서 게시 승인, 실제 게시·앱 연결일을 시행일로 할지, privacy/terms registry version을 `1.0`으로 할지. URL만 정해져도 위치 답변·법적 placeholder가 남으면 게시하지 않는다.
4. App Store 기본 category `여행`, 보조 `라이프스타일`, 무료, 저작권 `2026 신동흔`, 현재 아이콘 사용, 심사 승인 뒤 수동 출시의 권장안을 수락할지.
5. 심사 연락처에 쓸 국제 형식 전화번호와 전용 비만료 심사 계정 제공 여부. 계정 비밀번호는 Connect 전용 필드에만 입력한다.

지원 시간·목표 답변 기간은 선택 운영 항목이며 공개/제출의 자동 차단으로 만들지 않는다. 공급자 계약·보유, 위치 문의 결과, delete-account 배포/E2E, 최종 Distribution artifact는 사용자 선호를 묻는 값이 아니라 각 담당이 증거로 닫을 사실이다.

### 5. 공개 URL·가입 연결 인계

현재 세 URL은 모두 **미정**이고 게시 승인은 없다. 상세 표와 성공/실패 계약은 `publish/release-gates.md` E절을 단일 실행표로 사용한다.

| 순서 | 담당 | 승인 후 최소 작업 | 완료 증거 |
| --- | --- | --- | --- |
| 1 | 게시 | 승인된 privacy/terms/support만 승인 호스트에 게시, 모바일·비로그인 HTTPS 확인 | 실제 URL3개, 시행일, privacy/terms version, content hash |
| 2 | DB | 게시된 privacy=`privacy-policy`, terms=`terms-of-service` 새 version 두 행만 inactive 준비 후 원자적 active 전환, 이전 행·과거 동의 보존 | registry metadata와 공개 RPC 두 문서의 ID/version/URL 일치, rollback 기록 |
| 3 | UI | 내정보 개인정보 안내·문의하기를 승인 URL에 연결. 가입은 registry URL만 표시 | 최초 미동의, 두 문서 누락/stale/열기 실패 시 가입 우회0 |
| 4 | QA/출시 | iPhone에서 세 페이지·내정보·가입·Connect URL을 같은 version으로 확인 | 링크 게이트 PASS 뒤 새 공개 Archive/Distribution IPA 단계로 인계 |

이 인계는 RELEASE-LINKS-01을 대체하거나 실행을 승인하지 않는다. 다음 순서는 delete-account FIX-04 수락과 별도 배포/E2E, 사용자 결정·위치 답변 반영, 별도 게시 승인, RELEASE-LINKS-01, 최종 Archive/Distribution 검증, 별도 업로드·제출 승인이다.

## 최우선 후속 완료 — RELEASE-DOCS-03

[출시 실행 명령](../work/integration-decision/release-execution-wave.md)의 DOCS-03 절을 완료했다. 기존 산출을 재사용해 DB/API/DATA/BUILD 최종 사실을 합쳤고 위치 신고 문의 답변 대기를 유지한다. 실제 게시/스토어 입력은 별도 승인이다. 아래 DOCS-02는 완료 근거이며 재실행 지시가 아니다.

## RELEASE-DOCS-03 완료 인수인계 — 2026-09-08

### 1. 변경 파일과 목적

- `publish/data-facts.md`: DB/API/DATA/BUILD 최종 인계를 합쳐 위치·검색·경로·인증·계정·완료·guest·체류 표본·사진의 수집/전송/저장/삭제를 현행 사실로 갱신했다.
- `publish/privacy-policy.md`: Supabase 서울 project, 정확 위치의 Edge/Kakao 전송, 개인화 off와 초기화의 차이, 계정 삭제와 공급자 로그·backup의 차이, 허용 사진 근거와 위치 문의 답변 대기를 반영했다.
- `publish/terms.md`, `support.md`: 사업자등록 없는 개인 운영·위치 문의 답변 대기, guest 승인/불명 원본 보존, 개인화 off/reset, 180분·2곳·Live Activity 현행을 공개 문구로 정리했다.
- `publish/app-store-submission.md`: App Privacy/API 사실, 부산 밖 심사 절차, 한국·iPhone·짜투리 local public Release 결과, Store metadata·가격·연령등급·심사 계정·출시 방식 사용자 결정 묶음과 privacy manifest 차단을 정리했다.
- `publish/release-gates.md`: Apple 플랫폼 필수, 법적 공개 조건, 사용자 결정, 제출 전 확인·권장 후속으로 재분류했다.
- 본 문서: DOCS-03 결과·검증·남은 결정과 게시 준비 상태를 기록했다.

### 2. DB/API/DATA/BUILD 최종 반영

- **DB:** 015·016·017 및 개인화 C 완료를 유지했다. guest 가져오기는 2026-09-08 실기기 계정 기록 표시 성공으로 갱신했다. Supabase 연결 project는 `ap-northeast-2`(AWS 서울)·정상 상태다. 최신 V1 추천은 legacy 코스 저장을 직접 호출하지 않지만 기존 저장 코스 재계산은 좌표 저장 경로에 도달한다. 계정 완료 payload에는 좌표·원시 도착/출발·실제 체류가 없고 체류 표본은 별도다. 개인화 off는 기존 표본 삭제가 아니며 초기화가 표본·집계 삭제다. 180일은 유효 범위이고 물리 삭제 시각 보장이 아니다. delete-account 배포·전용 계정 E2E, scheduler, 관리형 로그/backup과 보호 backup 폐기일은 미확인이다.
- **API:** 현재 추천 proxy는 앱→Supabase Edge→Kakao이며 proxy 실패가 TMAP/ODsay 자동 fallback은 아니다. private 경로는 정확 좌표+JWT를 Edge에 보내고 Edge가 좌표를 Kakao에 전달하지만 public cache에는 저장하지 않는다. 장소 검색은 검색어를 Kakao Local에 보내되 현재 GPS 중심좌표를 붙이지 않는다. public cache15분·검색/connector10분은 논리 유효기간이며 물리 삭제 보장이 아니다. 공급자 처리 국가·로그 보유·법적 수탁/제3자 지위는 미확인이다. 격리 계약84/84 PASS를 인수했다.
- **DATA:** 현행 카탈로그를 재계산한 허용 사진은 101/369(부산 명소85·맛집16, 대표84/191), 기본 이미지268/369다. 허용 사진은 부산광역시 권리·이용허락 제한 없음·변경/상업 이용 가능·가시 출처 연결이 확인됐다. 미확인102와 사진 없음166은 비노출 fallback이며 데이터 기준 제출 차단은 없다. exact 위반0, 집중66/66·typecheck·UI698 PASS/기존 skip1·core364/364 PASS를 인수했다.
- **BUILD:** app config와 public 전용 로컬 서명 Release에서 짜투리·iPhone 전용·iOS17·main/extension1.0.0(1)·internal 도구 비노출을 확인했다. 이는 development 서명 산출물이며 Store Archive가 아니다. Extension 진단의 SystemBootTime 사용 이유와 자체 privacy manifest 필요 여부, distribution Archive·최종 아이콘 승인·운영 endpoint·최소 실기기 smoke가 남았다.

### 3. 공식 기준·상호 검증

- Apple App Review Guidelines와 App Privacy를 2026-09-08 재확인했다. 공개 개인정보 처리방침 URL, 정확한 App Privacy 응답, 계정 생성 앱의 앱 내 삭제, 심사 접근 정보는 플랫폼 제출 요건으로 분류했다. 별도 동의 사용자에게서만 수집하는 체류 정보와 통합 제3자 수집도 App Privacy 대상에서 제외하지 않았다.
- Apple App Store Connect의 필수 metadata·가격/availability·연령등급 안내를 확인했다. 기본 category·연령등급·가격/세금 category·지원 URL·저작권·심사 정보는 제출 전 입력 대상으로, 보조 category·지원 SLA는 선택/운영 권장으로 분리했다.
- Apple privacy manifest·제3자 SDK 요건을 확인하고 main manifest의 빈 수집 배열을 App Privacy ‘수집 없음’ 근거로 사용하지 않았다. Extension의 required-reason API 이유·manifest 범위가 해결되기 전 제출 준비 완료로 표시하지 않았다.
- 개인정보보호위원회 2026 처리방침 작성지침, 개인정보 보호법과 위치정보법을 법적 공개 검토 근거로 유지했다. 사업자등록 없음과 위치 관련 문의 접수·답변 대기는 사실로 기록했지만 신고 면제·특례·공개 가능은 확정하지 않았다.
- 공개 초안3종, 내부 사실표, App Privacy, 심사 메모와 게이트에서 180분·2곳·개인화 포함·guest 명시 가져오기·Live Activity 완료·snooze 제거가 일치하는지 검색했다. `off=삭제`, `TTL=물리 파기`, `미저장=미전송`, `서울 project=모든 처리 국내`, `단일 실기기 표시=모든 서버 정리`로 과장하지 않았다.
- 문서만 수정했으므로 제품·운영 테스트를 재실행하지 않았다. 각 역할의 최종 검증 결과를 인수했고 문서 상대 링크·스토어 글자수·공백 검사를 별도로 수행한다.

### 4. 게시 준비·미완료와 사용자 결정

게시용 본문은 최신 기능·데이터 흐름에 맞게 준비됐지만 **공개 준비 완료가 아니다**. 공개 URL·시행일/version·법적 공개 항목이 미확정이고 게시 승인이 없으므로 외부 게시, registry/UI 연결, Connect 입력·업로드·제출을 수행하지 않았다.

이미 확정되어 다시 묻지 않는 값: **짜투리 / 신동흔 / sdongheun@gmail.com / 대한민국 / iPhone / iOS17 이상 / 사업자등록 없음**.

통합이 한 번에 회수할 사용자 결정:

1. 개인정보 권리 요청에 지원 이메일을 같이 사용할지, 개인정보 책임자를 `신동흔` 또는 `운영자`로 표기할지, 적용 법령상 필요한 주소·전화번호.
2. 공개 승인 시점의 문서 시행일과 version(권장 `1.0`), 만14세 미만 계정 생성 차단 수락 여부.
3. App Store 기본/보조 category(권장 여행/라이프스타일), 가격·세금 category(권장 무료/App Store software 검토), 저작권(권장 `2026 신동흔`), 현재 아이콘 최종 사용 승인.
4. 심사 연락처의 국제 형식 전화번호, 비만료 심사 계정 제공 여부, 심사 승인 후 수동 출시 방식 수락 여부. 비밀번호는 Connect 전용 필드에만 입력한다.
5. 선택 운영 항목인 지원 시간·목표 답변 기간. 이는 자동 제출 차단으로 만들지 않는다.

사용자 외 남은 사실/차단: 위치 문의 답변, Supabase/Auth·Cloudflare 등 처리 국가/계약·보유, 관리형 로그/backup·scheduler, delete-account 배포와 전용 계정 E2E, legacy provider 최종 도달성, Extension privacy manifest, Store distribution Archive와 최종 후보 smoke다. 공개 URL과 문서 version이 확정되고 별도 게시 승인이 있어야 RELEASE-LINKS-01로 진행한다.

## 최신 후속 — RELEASE-DOCS-02

사용자 확정 사실(2026-09-08): 앱명 **짜투리**, 공개 운영자명 **신동흔**, 지원 이메일 **sdongheun@gmail.com**. publish/ 초안의 해당 항목에 이 표기를 사용한다. 계정 판매자명 변경·개인정보 책임자 별도 지정·공개 URL 확정으로 확대하지 않는다. Cloudflare Pages 방식은 준비 대상으로 안내했으며 실제 게시 주소/원격 게시 승인은 별도다.

2026-09-08 [출시 제출 마감 명령](../work/integration-decision/release-submission-final.md)의 RELEASE-DOCS-02 절 전체를 실행한다. 아래 초안의 개인화 조건부/120분은 현재 결정으로 재대조하며 과거 근거를 삭제하지 않는다. 기존 산출물 재사용·최신 공식 기준 확인·사용자 사실 인계까지만 수행한다. 원격 게시/스토어 제출은 승인되지 않았다.

## RELEASE-DOCS-02 완료 인수인계 — 2026-09-08

### 1. 변경 파일과 목적

- `publish/privacy-policy.md`, `terms.md`, `support.md`: 공개 명칭을 짜투리, 운영자를 신동흔, 문의 이메일을 `sdongheun@gmail.com`으로 맞췄다. 최대 3시간·최대 2곳, 개인화 포함, 승인 기반 guest 가져오기, Live Activity 완료와 `5분 뒤 다시 알림` 제거를 현행으로 반영했다.
- `publish/data-facts.md`: 015·016·017 운영 적용과 C 1회 저장·동일 owner 조회·추천 30→40분·제한 정리 PASS를 기록했다. guest 구형 pending 복구는 자동 검증 완료/실기기 성공 대기로 분리했고 사진은 허용 101, 기본 이미지 268로 정정했다.
- `publish/app-store-submission.md`: 스토어 설명, App Privacy 대응표, 부산 밖 수동 입력 심사 절차, 테스트 계정 준비 절차, privacy manifest 확인 항목을 갱신했다. 비밀번호는 기록하지 않았다.
- `publish/release-gates.md`: 과거 개인화 A/B 분기를 현행 개인화 포함 근거로 교체하고, 사용자 순서인 차단 사항 최소 수정 → 공개 문서 연결 → 최종 빌드 검증 → 제출 승인으로 재정렬했다.
- 본 문서: RELEASE-DOCS-02 결과·유지 경계·검증·남은 결정을 같은 작업 문서에 남겼다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 제품 코드, DB·migration, 추천/데이터/UIUX 중앙 정책과 보드, QA 결과, 다른 역할 문서는 수정하지 않았다.
- 최대 180분·최대 2곳, 개인화의 별도 동의와 새 코스 명시 도착·출발·완료만 학습, guest/import/동의 전 기록 학습 0, 표본 3개부터 최근 최대 5개, 유효 180일 계약을 유지했다.
- 조건부 Results 진입은 출시 설명에서 복원하지 않았다. 현재 UI에 연결되지 않은 소스 파일의 존재를 사용자 기능으로 설명하지 않았다.
- U-LIVE-ACTIVITY-FINAL-02 사용자 실기기 완료 보고를 인수했으며 이번 세션이 새 OS 테스트를 수행했다고 쓰지 않았다. `5분 뒤`는 Activity 자동 종료 시간이 아니라 제거된 재알림 행동으로 기록했다.
- 공개 URL 생성·Cloudflare Pages 게시·도메인 구매·앱 링크/가입 registry·Connect 입력·업로드·제출·commit/push를 수행하지 않았다.

### 3. 수행한 검증과 결과

- 최신 근거 대조: 개인화 C 저장·조회·추천·exact 정리 PASS, 180분/2곳 최종 자동 게이트 PASS, guest pending 복구 25/25 및 전체 회귀 PASS/실기기 대기, Live Activity 자동·서명 Release와 사용자 수락 이력, 사진 허용 101/369·기본 이미지 268/369를 확인했다.
- 구현 대조: `RELEASE_MAX_MINUTES=180`, engine의 1~180/181 거절, Live Activity `completionEligible`, main target privacy manifest의 File Timestamp·User Defaults·System Boot Time required-reason API와 tracking=false, 현재 `mobile` 표시명과 iPad 포함 설정을 읽었다.
- 공식 기준 확인(2026-09-08): Apple App Review Guidelines는 공개 개인정보 처리방침의 Connect·앱 내 링크, 계정 생성 앱의 앱 내 삭제, 심사 계정 또는 충분한 demo 접근을 플랫폼 필수로 둔다. App Privacy는 선택적 사용자만 수집하는 경우와 통합 제3자 수집도 신고 범위로 안내한다. Apple privacy manifest/제3자 SDK 안내는 유효한 manifest와 대상 SDK manifest·서명을 제출 요건으로 둔다. 개인정보보호위원회 2026 작성지침과 개인정보 보호법·위치정보법은 국내 공개 항목과 적용 여부를 최종 사실·전문 검토로 확정할 근거로 사용했다.
- 구분: Apple 제출 요건은 **플랫폼 필수**, 개인정보 보호법·위치정보법의 실제 적용과 국외 이전·수탁 표시는 **법적 적용 검토**, Privacy Choices URL·지원 응답 목표는 **권장/운영 선택**으로 분리했다. 법률 검토나 심사 통과 완료로 표시하지 않았다.
- 문서 변경만 수행했으므로 제품 테스트와 운영 C를 재실행하지 않았다. 공개 초안 3종·사실표·App Privacy·게이트의 120분/개인화 보류/사진 406 표현을 상호 검색해 제거했다.

### 4. 남은 결정과 게시·연결 조건

사용자 제공 완료: 앱명 **짜투리**, 공개 운영자명 **신동흔**, 지원 이메일 **sdongheun@gmail.com**. 개인정보 권리 요청에도 같은 이메일을 쓸지는 최종 확인 대상으로 남겼다. 공개 URL은 미정이며 외부 게시 승인은 없다.

통합에서 한 묶음으로 확정할 남은 사실:

1. 문서 시행일·버전, 개인정보 보호 책임자 성명 또는 직책, 공개 주소·전화번호의 법적 필요 여부와 값, 지원 시간·목표 답변 기간.
2. 만 14세 미만 가입 정책과 실제 차단/법정대리인 동의 경로, 위치기반서비스사업 신고·면제 지위와 위치정보관리책임자, 법률 검토 담당.
3. Supabase project region/국가·plan·로그/backup 보유, Supabase·Cloudflare 계약 주체/연락처·국외 이전 시기/방법/보유기간, Kakao 로그·법적 역할, TMAP/ODsay 최종 Release 도달 여부.
4. App Store 기본/보조 category, 가격·배포 국가, 개인/조직 판매자와 EU trader 여부, 심사 연락 담당자의 이름·이메일·국제 형식 전화번호.
5. 심사용 비만료 계정 제공 여부와 제출 직전 부산 수동 입력 재현 장소·시각. 비밀번호는 Connect 전용 필드에서만 전달한다.

다음 단계 차단: QA 후보 감사의 P0에 따라 별도 역할이 제출 환경 internal flag 비활성, 짜투리 표시명, iPhone 전용 설정, 공개 안내 연결과 계정 삭제 E2E를 최소 범위로 닫아야 한다. guest 실제 재시도, 최종 provider·로그/cache·사진/지도 조건은 제출 전 확인으로 유지한다. 그 뒤 대괄호가 없는 최종 문서를 검토하고 **별도 게시 승인**을 받아 공개 URL·registry·앱 링크를 연결한다. 고정 commit의 signed Archive와 Connect preview를 검증한 뒤에도 **별도 제출 승인** 전에는 업로드·제출하지 않는다.

이하 내용은 RELEASE-DOCS-01 착수·실행 당시 이력이다. 현행 판정은 위 RELEASE-DOCS-02 완료 인수인계를 따른다.

상태(당시): **새 출시 문서 세션 지금 실행·DB 마감과 병렬 가능**. 목표는 2026-09-21 전 공모전 제출 가능한 출시이며 심사 완료를 보장하지 않는다. 개인화 제외는 아직 사용자 확정이 아니다. 현재 구현된 범위로 초안을 쓰고 개인화는 서버 검증 뒤 최종 문구를 확정한다.

## 역할·읽기 순서

출시 문서 전담 역할이다. AGENTS.md → docs/README.md → 본 문서 → release-readiness-2026-09.md → docs/work/integration-decision/release-personalization-account.md 최신 결정 → DB/API 데이터 감사와 최신 QA 인계를 읽는다. 과거 개인화 보류/FAIL을 현행으로 복원하지 말고 최신 구현·검증 증거와 대조한다.

소유: `docs/05_release/publish/`의 신규 Markdown 산출물과 본 문서의 인수인계. 기존 QA 테스트/결과, 중앙 정책/보드, 앱 코드, DB schema, 다른 역할 문서는 직접 수정하지 않는다. 기존 출시 문서 초안을 먼저 찾아 재사용하고 공개본과 내부 근거를 구분한다. .docx/PDF/웹 배포는 요청되지 않은 추가 작업으로 만들지 않는다.

## 작성할 최소 산출물

1. 내부 `data-facts.md`: 실제 수집/저장/전송 항목, entry·SDK·서버·제3자·목적·계정 연결·보유/삭제·근거 파일. 로컬 전용과 서버 전송, 계획과 현재 상태 구분. 키/계정/좌표 원문 수집0.
2. 공개 초안 `privacy-policy.md`, `terms.md`, `support.md`: 개인정보 안내·최소 이용약관·지원 안내. 운영자/이메일/주소 등 필요한 사용자 사실은 임의 생성하지 않는다. 부산 서비스 범위·예상 시간/운영시간 확인·외부 지도·권한 거절 대안은 실제 동작과 맞춘다.
3. 내부 `app-store-submission.md`: 스토어 설명/부제/키워드 초안, App Privacy 입력 대응표·근거, 지원 기기/권한/심사 시나리오, 필요한 이미지·계정·URL 목록. 개발 QA 버튼 없이 부산 수동 입력으로 핵심 흐름 재현. 심사 계정 비밀번호는 문서에 기록하지 않는다.
4. 내부 `release-gates.md`: 지금 제출에 필요한 항목만 담당/완료/미확인/차단으로 구분. 문서 게시·앱 링크/동의 registry·가입 검증·최종 artifact·제출 승인을 구분한다. 과거 포괄 QA를 반복하지 않는다.

## 정책 확인·범위 고정

- 심사/App Privacy·개인정보/위치·약관 요구는 작성일 기준 Apple·관할 정부·실제 공급자 공식 자료를 조회해 링크/확인일을 내부 근거에 남긴다. 법적 의무·플랫폼 요구·권장사항을 구분하고 검토 필요를 명시한다. 모든 권장 항목을 필수 새 개발로 확대하지 않는다. 법률 검토 완료/심사 통과 보장 금지.
- 개인화 공통 초안은 작성하되 포함/보류에 따라 달라지는 부분만 내부 조건표로 관리한다. 서버 미검증을 사용자에게 정상 제공 중이라고 광고하지 않는다. 공개본에 양립 불가한 문구 두 개나 내부 TODO가 남으면 게시 전 차단이다. 포함 여부는 통합이 결정하며 DB 세션은 문서를 편집하지 않는다.
- 기록/표본 보유·guest와 회원·동의/off/reset/delete·실제 위치 전달/route cache·Auth 처리 등은 코드와 감사 근거를 확인한다. 사진/지도 출처·제3자 데이터도 해당 범위만 점검한다. 모르는 사실을 일반 템플릿으로 채우지 않는다.
- 최소 질문을 운영자/문의 연락처/공개 도메인 등으로 묶어 사용자에게 한 번에 요청한다. 답변 없는 항목 때문에 나머지 초안을 멈추지 않는다. 이미 확정된 정책은 다시 질문하지 않는다.
- 문서 완성을 위해 새 기능을 설계하지 않는다. 실제 출시 차단을 발견하면 근거·영향·최소 해결책으로 통합에 반환한다. 개선 제안은 출시 후 목록으로 분리한다.

## 완료·권한

초안 작성 → 사실표·공개본·App Privacy·심사 메모 상호 대조 → 조건부/미확인 질문 묶음 → 통합 검토 순서. 타이밍을 위해 첫 인수인계에 초안과 차단 항목을 함께 반환한다. 원격 게시·도메인 구매·스토어 입력/업로드/제출·약관 registry 쓰기·코드 수정·commit/push 금지.

본 문서에 변경 파일/목적, 유지한 정책과 조건부 부분, 수행한 출처/일관성 검증, 남은 사용자 사실/게시 조건 네 항목을 남긴다. 산출물 준비와 실제 공개 URL/앱 연결 완료를 구분한다.

## 실행 인수인계 — 2026-09-07

### 1. 변경 파일과 목적

- `publish/data-facts.md`: 현재 production entry의 수집·기기 저장·서버/제3자 전송·계정 연결·보유/삭제를 구현/조건부/미확인으로 분리했다.
- `publish/privacy-policy.md`: 개인정보 처리방침 공개 초안. 위치·계정·기기 기록 공통 절과 서버 검증에 따라 달라지는 체류 개인화 절을 분리했다.
- `publish/terms.md`: 서비스 범위, 예상 정보, 계정, 외부 서비스, 책임과 위치기반서비스 검토 항목을 담은 최소 이용약관 초안.
- `publish/support.md`: 부산 수동 입력, 권한 거절 대안, 계정/기기 기록, 오류 대응과 문의 정보의 공개 지원 초안.
- `publish/app-store-submission.md`: 스토어 설명·부제·키워드, App Privacy 대응표, 심사 메모, URL·계정·이미지 목록과 공식 기준.
- `publish/release-gates.md`: 제출에 필요한 P0/P1만 담당·상태·합격 증거로 정리했다.
- 본 문서: 결과·조건부 범위·검증·남은 사용자 사실을 같은 작업 문서에 기록했다.

### 2. 유지한 공개 계약·정책 경계

- 제품 코드, DB/migration, 추천·UIUX 중앙 정책, 보드, 기존 QA 결과와 다른 역할 문서를 수정하지 않았다.
- 개인화 제외를 확정하지 않았다. 일반 로그인+별도 동의+동의 후 새 코스의 명시 도착·출발·완료, guest/import/과거 기록 학습0, category+subCategory 표본3개부터 최근5개 중앙값, 180일을 조건부 공개 문구에 유지했다.
- 로컬 자동 검증을 원격 적용·실제 서버 학습·signed artifact 성공으로 승격하지 않았다. 개인화 공개 절과 스토어 광고는 서버 C 검증 뒤에만 포함한다.
- 부산 범위, 최대120분, 기본 한 장소·명시 선택 최대 두 장소, 외부 Kakao 확인, 위치 거절 시 수동 입력, background location/GPS 자동 도착/remote Activity push 미사용을 현재 범위로 유지했다.
- 게시, 도메인 구매, registry 쓰기, App Store Connect 입력, 업로드·제출, commit/push를 수행하지 않았다.

### 3. 수행한 출처·일관성 검증

- 코드 대조: `app.json`, dependency, 가입·동의·계정 삭제·계정 기록·guest import·체류 consent/sample, 위치·route proxy·Kakao fallback, AsyncStorage/App Group/알림 entry를 확인했다.
- 최신 인계 대조: release readiness, 개인화 결정, DB/API 데이터 감사, DB 마감, QA preflight와 live-learning C 상태를 비교했다. 과거 ‘개인화 미구현’ 감사 문구는 이후 로컬 구현보다 앞선 이력으로 처리했다.
- 공식 확인(2026-09-07): Apple App Review/App Privacy/계정 삭제/metadata/screenshot/연령등급/암호화, 개인정보보호위원회 2026 처리방침 작성지침, 개인정보 보호법 제21·22조의2·26·28조의8·30, 위치정보법, Supabase region/log/backup/DPA, Kakao 위치·개인정보·개발자 정책을 확인하고 각 내부 문서에 URL을 남겼다.
- 상호 대조: 공개 초안의 항목·목적·삭제와 App Privacy 표·심사 메모·release gate가 같은 조건을 사용하도록 확인했다. 공개 초안의 대괄호는 게시 차단 항목이며 최종 공개본에는 남기지 않는다.
- 문서-only 변경이므로 제품 테스트는 실행하지 않았다. 공식 링크를 브라우저에서 재확인했고 공개 초안의 placeholder·조건부 문구를 전수 검색했다. 부제 14자, 키워드 92 bytes, 설명 578자, 심사 메모 2,383 bytes로 Apple 초안 제한 안이며 trailing whitespace와 `git diff --check` 오류는 0건이다.

### 4. 남은 사용자 사실·게시 조건

한 번에 받을 사용자 입력:

1. 공개 운영자 표기: 개인/사업자 구분, 상호 또는 성명, 대표자(해당 시), 공개 주소, 공개 전화번호, 개인정보 보호 책임자 성명 또는 직책.
2. 연락처: 지원 이메일, 개인정보 권리 요청 이메일(같아도 됨), 심사 연락 담당자 이름·이메일·국제 형식 전화번호, 지원 시간/목표 답변 기간.
3. 공개 위치: 사용할 HTTPS 도메인과 privacy/terms/support URL 경로, 게시·문서 registry 등록 담당자.
4. 스토어 선택: 최종 앱 이름, iPhone 전용 또는 iPad 유지, 기본/보조 category, 배포 국가, 개인/조직 판매자 및 EU trader 해당 여부.
5. 법률·연령: 만14세 미만 가입 차단 또는 법정대리인 동의 방식, 위치기반서비스사업 신고/면제 지위와 위치정보관리책임자, 법률 검토 담당.
6. 운영 공급자 사실: Supabase project region/plan과 log·backup 보유, Supabase·Cloudflare 계약 주체/연락처·처리 국가·보유기간, TMAP/ODsay 최종 Release 도달 여부.
7. 심사 계정: 계정·개인화 기능을 심사할 전용 비만료 계정 제공 가능 여부. 비밀번호는 이 문서에 기록하지 않는다.

초안 산출물은 준비됐으나 공개·앱 연결·registry·Connect 입력은 모두 미완료다. 특히 운영자/국외 이전/아동/위치법, 사진 권리, 개인화 서버 A 또는 제외 B, signed artifact와 iPad 분기가 P0이다. 답변 전에도 초안은 검토할 수 있지만 대괄호·양립 불가 조건을 제거하기 전 게시할 수 없다.
