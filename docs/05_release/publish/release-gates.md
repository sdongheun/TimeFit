# 짜투리 최소 출시 게이트

## 현행 완료 — 2026-09-09 공개 문서 게시

사용자 게시 승인 후 Cloudflare Pages `jjaturi-docs` Production에 승인된7파일을 게시했다. 실제 URL은 privacy `https://jjaturi-docs.pages.dev/privacy/`, terms `https://jjaturi-docs.pages.dev/terms/`, support `https://jjaturi-docs.pages.dev/support/`이며 세 경로 모두 비로그인 iPhone User-Agent HTTPS200·상호 링크·메일·원격/로컬 hash 일치를 확인했다. privacy/terms version은 `1.0`, 시행일은 `2026-09-09`다. DB registry·앱 UI·Connect 연결은 인계만 했고 변경하지 않았다. 아래의 프로젝트 없음·미게시·게시 승인 대기 표기는 이전 이력이며 실제 값과 충돌하면 본 절과 `release-document-session.md`의 완료 절을 적용한다. 최종 iOS release bundle/export/Archive의 ODsay 제거 검증은 계속 남아 있다.

## 현행 상태 정정 — 2026-09-09 최소 국외 처리·ODsay 제거

QA-ODSAY-REMOVE-01은 신규 ODsay HTTP 요청·키 읽기·신규 저장 0을 소스·고정 fixture 범위에서 수락했다. 개인정보 처리방침 후보는 ODsay를 현재 수신자에서 제거하고 과거 provider·분·geometry 표시를 읽기 전용 호환으로 구분했으며, Supabase·Cloudflare는 `RELEASE-PROVIDER-MIN-01`의 최소 국외 처리값으로 교체했다. 최종 iOS release bundle/export/Archive 산출물 검증은 아직 남아 있고 이 자동 수락을 최종 빌드·게시·DB·Connect 승인으로 확대하지 않는다.

공개 7파일 validator는 PASS이고 privacy HTML 후보 SHA256은 `ae0a83ba4ea630da0c66f562b272697715e2e02cb7b6e9b815467646ce0c657c`이다. 개인정보처리방침·이용약관은 버전 `1.0`, 시행일은 실제 게시일로 유지한다. `https://jjaturi-docs.pages.dev`는 2026-09-09 게시 전 확인에서 DNS가 확인되지 않았으므로 실제 URL로 기록하지 않는다. 별도 게시 승인 전에는 배포하지 않는다. 아래 표의 공급자 미확인·ODsay 현재 수신자·이전 privacy hash가 충돌하면 이 절을 현행으로 적용한다.

## 현행 상태 정정 — 2026-09-09 위치 회신 접수

아래 표의 과거 `위치 답변 대기`는 **회신 접수·신고 및 고지 후속 확인**으로 대체한다. 센터 회신은 등록 면제나 공개 출시 승인이 아니다. 사용자는 특례를 전제로 하지 않고 수동 출시 준비를 계속하기로 했다. 사업자등록·위치기반서비스사업 신고 처리 완료와 Connect 수동 출시 저장은 아직 확인되지 않았다.

공개 문서 마감은 공급자별 처리 관계·국가·보유기간 등 개인정보처리방침 제3절의 미확인 사실과 일반 신고에 따른 고지 범위 확인이 남았다. 문의 답변을 다시 기다리는 단계가 아니다. 문서 게시와 앱 공개 출시를 구분하며, 미확인 문안을 완성본으로 게시하지 않는다. 지원 안내의 길찾기 시작 기준은 최신 클릭 기반 동작으로 갱신했다. 아래 지원 HTML 후보 hash는 과거 값이므로 재사용하지 않고 이번 마감 검증 값을 사용한다.

기준일: 2026-09-09
범위: 출시 필수 문서·설정·최종 artifact·승인만 포함한다. 공개 게시·registry 쓰기·App Store Connect 입력·업로드·제출은 별도 승인 전 수행하지 않는다.

## A. Apple 플랫폼 제출 필수

| 게이트 | 담당 | 상태 | 해제 증거 |
| --- | --- | --- | --- |
| 공개 개인정보 처리방침 URL | 문서/게시/UI | **최종 후보 반영 / 게시 승인 대기** | ODsay 현재 수신자 제거, Supabase·Cloudflare 최소 국외 처리, GPS 미사용 흐름과 version1.0 반영. 실제 게시일을 넣고 승인 후 로그인 없이 모바일 HTTPS 확인 |
| 지원 URL·앱 안내 | 문서/게시/UI | **GPS 미사용 원본·HTML 반영 / 게시 차단** | 지원 정적 페이지·메일 링크 준비. 신고 결과가 실제 주소·전화 표시를 요구하는지 확인하고 게시한 뒤 앱의 `준비 중` entry 교체 |
| 가입 문서 registry | DB/UI/QA | **차단** | 게시 URL·document ID/version·active registry 일치, 두 동의 기본 미선택, stale version 가입 우회 0 |
| 계정 삭제 | DB/UI/QA | **운영 배포 완료·E2E 차단** | ACTIVE/v1·verify_jwt=true·승인 소스/의존성 bundle 대조·무인증401 PASS. 전용 계정1회로 정상 JWT·AMR·cascade·기기 정리와 부분 실패 안내 확인 |
| App Privacy | 문서/빌드/운영 | **필드별 입력표 완료·공급자 미확인/Connect 입력 대기** | Email·User ID·Precise Location·Product Interaction·Other Usage Data·문의 콘텐츠는 확정 예, Other User Content와 비사용 범주는 확정 아니오. Search History·Diagnostics·Device ID는 공급자 장기 보유·결합 범위가 확인된 뒤 결정하고 Connect preview/publish 결과 확인 |
| privacy manifest·SDK | 빌드/QA | **로컬 보완 완료·최종 IPA 대기** | NATIVE-02에서 진단 clock 제거, target별 manifest 연결, 로컬 Development Archive 감사 PASS. EXIT-03 이후 새 Distribution IPA의 main/extension/대상 SDK manifest, required-reason API·서명과 Xcode privacy report 확인 |
| 공개 빌드 internal 도구 격리 | 빌드/QA | **로컬 완료·Archive 대기** | public 로컬 Release에서 QA/진단/C 실행·복구 entry0, runner/구독0 PASS. 같은 public 입력의 최종 Archive에서 재확인 |
| 앱 이름·기기 범위 | 빌드/QA | **로컬 완료·Archive 대기** | app config와 public 로컬 Release에서 `짜투리`, iPhone 전용, iOS17, main/extension version1.0.0(1) 일치. Bundle ID·App Group 유지, 최종 Archive 재확인 |
| 최종 signed Archive | 빌드/QA | **차단** | 서명/export 절차만 준비됨. 고정 후보 ID, version/build 중복, main/extension Distribution 서명·entitlement·아이콘·endpoint·privacy report와 IPA/온라인 validation 확인 |
| 필수 metadata·자산 | 문서/사용자/출시 | **metadata·연령·암호화 설정 완료 / URL·심사·build 대기** | 기본 metadata·무료·대한민국·저작권 저장 완료, 연령등급 사용자 완료 보고, 비면제 암호화 검토와 `usesNonExemptEncryption=false` 설정/생성 plist 확인. 실제 URL·국제 전화·심사 계정·최종 screenshot/build·Distribution IPA 값은 미완료 |
| 심사 접근 | 사용자/QA | **한·영 절차 준비·계정/최종 시나리오 대기** | 부산 밖 수동 위치·현재 운영시간 대체 절차 작성 완료. 비만료 심사 계정과 제출 직전 부산 장소·시각, backend 가용성 확인. 비밀번호는 Connect 전용 필드만 사용 |
| 제출 승인 | 사용자 | **미승인** | 기술·공개·법적 차단을 구분한 최종 검토본에 대한 별도 업로드·제출 승인 |

Apple 근거: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [App Privacy](https://developer.apple.com/app-store/app-privacy-details/), [필수 metadata](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties), [screenshot 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [privacy manifest](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [제3자 SDK 요건](https://developer.apple.com/support/third-party-SDK-requirements/). metadata·App Privacy·screenshot 확인일 2026-09-09.

## B. 법적 공개 조건

| 조건 | 상태 | 다음 확인 |
| --- | --- | --- |
| 위치기반서비스 지위·별도 약관 | **회신 접수·신고/고지 후속 확인** | 문의 답변 대기는 종료. 회신 자체를 면제·법적 적합성으로 쓰지 않고 실제 신고 처리 상태와 그 결과에 따른 책임자·연락처·별도 약관 범위를 확인 |
| 개인정보 처리방침 필수 사실 | **최소 국외 처리 반영·게시일/승인 대기** | 목적·항목·권리·책임자·GPS 미사용 기술 흐름·version1.0, Supabase/Cloudflare 최소 국외 처리와 국내 외부 서비스의 실제 전달 항목 반영. 시행일을 실제 게시일로 교체하고 최종 문안 게시 승인 필요 |
| 만 14세 미만 계정 | **정책·로컬 구현 완료, 최종 링크/실기기 대기** | 가입 대상 만14세 이상, 기본 미선택 자기확인. AGE-01 집중4/4·UI710 PASS/skip1·core399 PASS·public export PASS. 실제 연령 인증으로 표현하지 않음 |
| 국외 이전·처리위탁 | **Supabase·Cloudflare 최소값 반영** | 싱가포르 Supabase 수령자와 서울 기본 region을 구분하고 DPA 보유 기준 반영. 미국 Cloudflare 수령자·글로벌 처리 가능성, Turnstile 이중 목적과 공식 보유 기준 반영. 추가 공급자 전수조사는 출시 조건이 아님 |
| 콘텐츠·지도 권리 | **사진 데이터·Kakao 플랫폼 대조 완료 / 최종 smoke 대기** | 허용101건의 변경·상업 이용과 출처 연결 PASS, 나머지268건 fallback으로 데이터 차단 없음. 현재 WebView/REST 방식에는 Kakao iOS Bundle ID 등록이 필요하지 않고 `https://timefit.local`이 등록 JS 도메인과 일치해 설정 조치0. 최종 runtime origin·대표4사례 logo/copyright·route geometry만 확인 |

국내 근거: [개인정보보호위원회 2026 처리방침 작성지침](https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20885), [개인정보 보호법 제30조](https://www.law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900078922), [국외 이전](https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1029332501), [위치정보법](https://www.law.go.kr/법령/위치정보의보호및이용등에관한법률). 실제 적용 판단은 문의 답변·법률 검토 전 완료로 표시하지 않는다.

## C. 사용자 결정

| 결정 | 권장안 | 상태 |
| --- | --- | --- |
| 문서 시행일/version | 실제 게시일 / `1.0` | 확정·게시일 대기 |
| 개인정보 문의 이메일 | `sdongheun@gmail.com` | 확정 |
| 개인정보 책임자 | 신동흔 | 확정 |
| 가입 연령 | 만14세 이상 필수 자기확인 | 확정·AGE-01 자동 검증 완료·최종 링크/실기기 대기 |
| App Store category | 여행 / 보조 없음 | 확정 |
| 가격 | 무료 | 확정·Connect `₩0`, 대한민국만 저장 완료 보고. 세금 category 확인 대기 |
| 저작권 | `2026 Dongheun Shin` | Connect 저장 완료 보고. 개인정보 운영자명 `신동흔` 유지 |
| 최종 아이콘 | 승인된 파란 시계 시안 | 1024×1024 불투명 sRGB asset·Expo/iOS 소비 경로 검증 완료, 최종 후보 홈/Store 표시 대기 |
| 연령등급 | Connect 설문 | 사용자 완료 보고. 계산된 정확한 등급 값은 미전달이므로 재입력·추정하지 않음 |
| 심사 연락처 | 신동흔·지원 이메일·국제 형식 전화 | 전화 미확정 |
| 심사 계정 | 별도 비만료 계정 | 준비 확정·아직 미생성 |
| 출시 방식 | 심사 승인 뒤 수동 출시 | `DEC-RELEASE-MANUAL-02`로 확정. 이전 자동 출시는 철회, Connect 실제 선택·저장 확인 대기 |
| 공개 호스팅·기본 URL | Cloudflare Pages | 호스트 확정. 인증된 계정의 기존 Pages 프로젝트0; 신규 `jjaturi-docs`와 예정 `https://jjaturi-docs.pages.dev`는 게시 승인·생성 전 |

확정되어 다시 묻지 않을 항목: 앱명 **짜투리**, 운영자 **신동흔**, 지원 이메일 **sdongheun@gmail.com**, 대한민국 배포, iPhone 전용, iOS 17 이상.

## D. 제출 전 확인과 권장 후속

| 항목 | 상태·최소 처리 |
| --- | --- |
| 개인화 | 015·016·017 운영 적용과 승인된 C 저장·조회·추천·제한 정리 PASS. 반복 실행하지 않고 최종 App Privacy와 artifact만 대조 |
| guest 가져오기 | 자동 회귀와 2026-09-08 실기기 계정 기록 표시 성공 확인. 단일 표시 결과를 전체 서버 중복·물리 정리 증거로 확대하지 않음 |
| DB 보유·삭제 | 최근180일은 체류 표본 유효 범위이며 물리 삭제 시점 보장 아님. Free backup 미제공, Cron Integration 미설치, Log Drains 미사용을 확인. Jobs는 화면 로딩 지속으로 미확인이고 제공자 로그의 보유기간은 추정하지 않음. delete-account 배포 완료, 전용 계정 삭제 E2E는 제출 전 확인 |
| API provider·위치·cache | Kakao Local/Maps/REST routing과 TMAP 도보 계약 유지. ODsay 신규 요청·키 읽기·신규 저장은 소스·fixture QA 수락. 최종 release bundle/export/Archive의 ODsay 금지 항목 검색은 남음 |
| 사진·지도 | DATA 최종 재집계 허용101/369(대표84/191), 기본 이미지268/369, exact 연결 위반0·회귀66/66 PASS. 최종 후보에서 명소·맛집·사진 없음·미확인 원천 각1개 smoke |
| 비로그인 기기 기록 | 최대 1,000건 상한과 삭제 entry·기간을 최종 확인. 지원 SLA와 함께 권장 운영 개선을 자동 제출 차단으로 만들지 않음 |
| export compliance | 비면제 암호화 미사용 판단과 `usesNonExemptEncryption=false` 앱 설정·생성 plist 반영 완료. 최종 Distribution IPA의 main plist와 포함 의존 불변만 확인 |
| 지원 운영 | 지원 시간·목표 답변 기간과 장애 공지 방법 결정 권장. Apple 제출 필수 기능으로 확대하지 않음 |

## E. 공개 URL·가입 연결 인계

실제 URL은 모두 미정이다. Cloudflare Pages 프로젝트 후보는 `jjaturi-docs`, 예정 기본 주소는 `https://jjaturi-docs.pages.dev`다. 프로젝트가 아직 없으므로 이 주소를 실제 URL로 기록하지 않는다. 아래 값은 게시 승인과 법적 문안 확정 전에는 registry·앱·Connect에 넣지 않는다. 문서 내용이 바뀌면 같은 version의 내용을 조용히 교체하지 않고 새 version으로 전환한다.

| 게시 대상 | 로컬 원본 | 공개 URL | registry ID / version | 연결 위치 | 현재 상태 |
| --- | --- | --- | --- | --- | --- |
| 개인정보 처리방침 | [privacy-policy.md](privacy-policy.md) / `public-site/privacy/` | **미정**(예정 `/privacy/`) | `privacy-policy` / `1.0` | App Store Connect Privacy Policy URL, 내정보 `개인정보·위치정보 안내`, 가입 문서 | ODsay 현재 수신자 제거, Supabase·Cloudflare 최소 국외 처리, GPS 미사용·수동 좌표·버튼 기록 반영. 게시 승인 대기 |
| 이용약관 | [terms.md](terms.md) / `public-site/terms/` | **미정**(예정 `/terms/`) | `terms-of-service` / `1.0` | 가입 문서 | 수동 장소 선택·GPS/권한 미사용 반영. 신고 후속 고지·게시 승인 대기 |
| 지원 안내 | [support.md](support.md) / `public-site/support/` | **미정**(예정 `/support/`) | registry 대상 아님 | App Store Connect Support URL, 내정보 `문의하기` | 수동 장소 선택·Live Activity 공유 진행 반영. 신고 후속 연락 표시·게시 승인 대기 |

### RELEASE-DOCS-08 — 게시·DB·UI 단일 인계표

| 실행 대상 | 고정 입력 | 현재 상태·실제 값 기록 슬롯 | 승인 뒤 담당·완료 증거 |
| --- | --- | --- | --- |
| 게시 파일 | `public-site/`의 `_headers`, `_redirects`, `assets/styles.css`, `privacy/index.html`, `terms/index.html`, `support/index.html`, `robots.txt` — 총7개 | 로컬 준비 완료·미게시 | 게시 담당: 승인된7파일만 배포, 파일 목록과 응답 상태 반환 |
| 개인정보 처리방침 | version `1.0`, ID `privacy-policy`; GPS 미사용·수동 좌표·버튼 기록, ODsay 현재 수신자 제거와 Supabase·Cloudflare 최소 국외 처리 반영 | HTML 후보 SHA256 `ae0a83ba4ea630da0c66f562b272697715e2e02cb7b6e9b815467646ce0c657c` / 실제 시행일 `미정` / 실제 URL `미정` | 게시 담당→DB 담당: HTTPS200·모바일 열림·시행일·version·hash·실제 URL |
| 이용약관 | version `1.0`, ID `terms-of-service`; 수동 장소 선택과 GPS·위치 권한 미사용 반영 | HTML 후보 SHA256 `25ab9c48c72d1a590219cfb72c356c99292405263f34f6a15078828f421e47c9` / 실제 시행일 `미정` / 실제 URL `미정` | 게시 담당→DB 담당: HTTPS200·모바일 열림·시행일·version·hash·실제 URL |
| 지원 안내 | 운영자 신동흔, `sdongheun@gmail.com`; 수동 장소 선택과 Live Activity 공유 진행 반영 | HTML 후보 SHA256 `38b9bf339b64804e2171daf73be9c563ee8f229616889a70a34a5907b7ec0254` / 실제 URL `미정` | 게시 담당→UI/Connect 담당: HTTPS200·모바일 열림·hash·실제 URL |
| Pages 프로젝트 | 후보 이름 `jjaturi-docs`; 예정 주소는 실제 URL이 아님 | 예정 hostname DNS 미확인 / 실제 프로젝트명 `미정` / 실제 기본 주소 `미정` | 게시 승인 뒤 게시 담당이 인증 계정에서 존재 여부를 다시 확인하고 중복 생성 없이 실제 주소만 반환 |
| DB 문서 registry | 위 실제 privacy/terms URL, ID, version `1.0`, 승인시각 | 쓰기0·대기 | DB 담당: inactive 준비→한 transaction 전환→active 각1개·과거 동의 보존·실패 rollback |
| 앱 UI 링크 | registry가 반환한 privacy/terms URL, 실제 support URL | 제품 변경0·placeholder 유지 | UI 담당: 내정보 privacy/support와 가입 두 문서 연결, 누락·stale·열기 실패 시 가입 우회0 |
| App Store Connect URL | 실제 Privacy Policy URL과 Support URL | 핵심 metadata 저장 완료 / URL·App Privacy 미입력 | Connect 담당: 게시·DB/UI 검증 뒤 동일 URL/version 입력, preview 결과 반환 |

실행 순서는 **신고·필수 고지 확인 → 최종 본문 검토 → 사용자 게시 승인 → Pages 게시 → 실제 URL 기록 → DB registry → UI 링크 → Connect URL**이다. 예정 주소를 실제 URL 슬롯에 넣지 않는다.

역할별 실행 순서는 기존 `RELEASE-LINKS-01`을 따른다.

1. **게시 담당:** 사용자가 확정·승인한 세 문서만 승인된 호스트에 게시하고, 로그인·쿠키 동의 없이 iPhone에서 HTTPS로 열리는지 확인한다. URL·응답 상태·게시 content hash·승인된 시행일/version을 문서 담당에게 반환한다. URL이 정해졌다는 이유만으로 대괄호가 남은 초안을 게시하지 않는다.
2. **DB 담당:** 게시된 privacy/terms의 URL·ID·version·승인시각과 현재 registry metadata를 대조한다. 새 두 행을 inactive로 준비한 뒤 한 transaction에서 이전 active를 해제하고 새 두 행만 활성화한다. 과거 동의행과 이전 문서 행은 보존하며 불일치 시 rollback한다.
3. **UI 담당:** 기존 내정보의 `안내 페이지 준비 중`·`문의 방법 준비 중`을 승인 URL에 연결하고, 가입은 registry가 반환한 privacy/terms URL만 사용한다. 최초 체크는 해제 상태로 두고 문서 미설정·한 종류 누락·stale version·열기 실패 때 가입 우회를 허용하지 않는다.
4. **QA/출시 담당:** 모바일 HTTPS, 내정보 두 안내, 가입 문서 두 링크·기본 미동의·stale/실패 차단, Connect Privacy/Support URL을 같은 version과 대조한다. 이 연결 완료 뒤에만 새 공개 Archive와 Distribution IPA 검증으로 이동한다.

### RELEASE-DOCS-06 A — 위치 회신 접수 후 신고·고지 영향 필드

| 분류 | 영향 파일·필드 | 현재 준비 상태 | 닫는 증거 |
| --- | --- | --- | --- |
| 신고 후속 직접 영향 | privacy 제7절, terms의 추가 위치 특약 여부, support 법적 연락 표시와 대응 HTML | GPS 미사용 기술 문구는 반영 완료. 신고 결과가 요구할 별도 약관·주소·전화·위치정보관리책임자는 임의 확정하지 않음 | 실제 신고 처리 결과와 필요한 전문 검토 |
| 신고 후속과 무관 | privacy 제1·4·5절, 수동 장소 선택, 운영자/메일/연령, 180분·2곳, 개인화, guest, Live Activity, 탈퇴 함수 상태, 스토어 설명·심사 절차 | 공개 원본·HTML·App Privacy·스토어 문안 반영 완료 | 최종 후보에서 데이터 흐름이 바뀔 때만 최소 수정 |
| Pages 게시 조건 | 정적3페이지, `_headers`, `_redirects`, 호스팅 처리 고지 | Workers Free / Cloudflare, Inc. / DPA v6.4와 공개 Privacy·하위처리자·로그 근거, 조건부 문구 준비 완료. Pages 프로젝트·호스팅 없음 | 게시 승인 뒤 프로젝트 생성 직전 실제 Pages log/analytics 설정 확인 |
| App Store 자산 | 부제·설명·키워드·프로모션, App Privacy, 심사 메모, screenshot·아이콘 | Connect metadata·연령 완료 보고와 암호화 설정 완료 반영. App Privacy 필드표, 한·영 심사 메모, 6.9형 6장 캡션·허용 규격과 승인 아이콘 근거 준비 | 최종 후보 캡처, 실제 URL, App Privacy 미확인 3종 결정·연락처·계정·build 입력, 수동 출시 설정 저장 확인 |

## 실행 순서

1. BUILD·DB·API·DATA·DOCS 인수인계를 합쳐 확인된 제출 차단만 최소 수정한다.
2. 접수된 위치 회신의 신고·고지 후속, Supabase/Cloudflare 계정 적용 사실과 Kakao·Cloudflare 고지 해석, 사용자 결정을 반영해 대괄호 없는 공개본을 검토한다.
3. 별도 게시 승인 뒤 실제 HTTPS URL을 만들고 위 E의 게시→registry→앱 링크·Connect metadata 순서로 같은 문서 version을 연결한다.
4. 고정 후보 signed Archive와 필요한 실기기 항목만 검증한다.
5. 기술 제출 가능, 법적 공개 가능, App Store 제출 승인을 따로 확인한 뒤 사용자의 별도 승인으로만 업로드·제출한다.
