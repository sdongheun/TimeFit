# RELEASE-CONNECT-FINAL-PARALLEL-01

최신 상태는 문서 마지막 사용자 게시 보고 및 DOCS-CAPTCHA-NOTICE-FINAL-01을 우선한다.

2026-09-10. 사용자 승인: App Privacy 답변 마감과 가입 수정본 배포 빌드 준비·업로드를 병렬 진행한다. 심사 제출·공개 실행은 이번 작업에 포함하지 않는다.

## 현행 결정과 관찰

- 이전 수동 출시 → GPS 제거 후 사용자가 빠른 공개를 위해 자동 출시를 재선택 → **자동 출시 현행**. 과거 문서의 수동 출시 지시는 이력이며 재적용하지 않는다. 09/10 직전 Connect 화면에서 자동 출시 선택을 확인했다.
- 사용자가 CAPTCHA 가입 및 로그아웃 후 재로그인 성공을 확인했다. 이메일 확인 없이 로그인한 관찰이며 이메일 소유 검증 성공으로 기록하지 않는다. 메일 확인을 새로운 출시 선행 구현으로 추가하지 않기로 했다.
- 심사 계정 입력은 사용자가 완료·정확성을 확인했다. 자격 증명은 이 문서에 기록하지 않는다.
- Connect TestFlight를 09/10 직접 조회: **빌드 없음**. 기존 09/09 1.0.0(1) 서명 IPA는 가입 수정 전이므로 업로드하지 않는다.
- 가입 수정본의 새 public Archive 및 배포 IPA 생성·검증 후 업로드한다. 기존 산출물은 보존한다. 빌드 번호 중복 또는 새 서명 권한이 필요하면 승인 범위를 재확인한다.

## 병렬 소유 경계

1. QA·출시 검토: 기존 App Privacy 표와 실제 처리·Apple 정의 대조. 코드·운영 설정·공개 방침을 임의 변경하지 않는다.
2. UIUX 빌드: 기존 public wrapper 및 서명 검증기 재사용. 제품 변경 없이 새 Archive/IPA와 해시·검증 결과를 `../uiux/release-signed-build.md`에 인계한다.
3. 통합: Connect 상태 확인·검증된 빌드 업로드와 확정 답변 입력. 사실 미확정 항목을 추정해 게시하지 않는다.

## 진행 상태

- App Privacy: 입력안 검토 중. 이전 브라우저의 데이터 수집 선택은 저장·게시 완료가 아니다.
- 빌드: 새 산출물 생성 실행 권한 대기. 생성·업로드 완료로 표시하지 않는다.
- 암호화: 기존 API 근거의 비면제 암호화 미사용 판단 유지. 새 IPA의 `ITSAppUsesNonExemptEncryption=false` 검증 후 업로드된 빌드에서 실제 질문/처리 상태를 확인한다.

## App Privacy 병렬 검토 결과

기존 미정 진단 전체 → 실제 Supabase hosted 요청 상태·실행시간·오류 로그 근거 → Performance Data / Other Diagnostic Data로 좁힌 입력안. 앱 Crash Data 자동 수집을 새로 주장하지 않는다. 다음은 **입력안이며 Connect 게시 완료가 아니다**.

| 수집 유형 | 목적 | 사용자 연결 | 추적 |
| --- | --- | --- | --- |
| Email Address | App Functionality | 예 | 아니오 |
| User ID | App Functionality, Product Personalization | 예 | 아니오 |
| Precise Location | App Functionality | 예 | 아니오 |
| Product Interaction | App Functionality, Product Personalization | 예 | 아니오 |
| Other Usage Data | App Functionality, Product Personalization | 예 | 아니오 |
| Customer Support | App Functionality | 예 | 아니오 |
| Performance Data | App Functionality | 예(보수적 입력안) | 아니오 |
| Other Diagnostic Data | App Functionality | 예(보수적 입력안) | 아니오 |

- Customer Support는 수집 유형이며 목적 dropdown에서는 App Functionality에 해당한다.
- 정확 위치는 GPS 사용 여부와 구분한다. 계정별 장소 좌표·명시 도착/완료 기록을 보관하는 경계에 따른 기존 보수안이며 임의 지도 핀 자체를 사용자 실측 위치라고 단정하지 않는다.
- Search History: 앱 서버 검색어 저장은 없지만 Kakao가 요청 처리 이후 검색어 원문을 보관하는지 현재 자료로 미확정. API 호출 건수를 검색어 보관 증거로 대체하지 않는다.
- Device ID: Turnstile IP/TLS/UA 보안 신호를 고유 기기 식별자로 사용·보관하는지 현재 구성의 근거 부족. Enterprise 전용 Ephemeral ID를 현재 Free에 사용한다고 가정하지 않는다.
- 이 두 사실 외에 모든 내부 로그의 정확한 삭제일·공급자 DPA 전체 조사를 새 선행 과제로 확대하지 않는다. 확인 전 수집 예/아니오를 임의 확정해 게시하지 않는다.
- 공개 방침의 Cloudflare 시기·목적·거부 영향 설명에 새로 연결한 회원가입 CAPTCHA가 누락됨. 출시 문서 소유자가 가입을 포함하는 최소 사실 수정을 인계받아야 하며, 이번 검토에서 공개 사이트를 임의 재게시하지 않았다.

근거: [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/), [Supabase 함수 로그](https://supabase.com/docs/guides/functions/logging), [Turnstile 개인정보](https://www.cloudflare.com/turnstile-privacy-policy/), [Turnstile Analytics](https://developers.cloudflare.com/turnstile/turnstile-analytics/), [Ephemeral ID](https://developers.cloudflare.com/turnstile/additional-configuration/ephemeral-id/). 기존 코드·공식 자료 검토이며 원격 사용자 데이터 조회/수집 실험은 하지 않았다.

## 09/10 업로드 결과 — 위 빌드 대기 해제

- 가입 수정본 public Archive `/private/tmp/timefit-signup-signed-20260910-final01.xcarchive` 및 배포 IPA `/private/tmp/timefit-signup-signed-20260910-export01/mobile.ipa` 생성·검증 PASS. 자세한 검증은 `../uiux/release-signed-build.md` 마지막 절.
- 로컬 IPA SHA256 `9c7df298e30ff21cdc4311abbf850f752e7853d40b5792e30de504f8adda3e9b`, Archive/IPA JS SHA256 `926cbf6e9143626584cf98a1ab6944031a13d80e6741712f052a49c61fa01035` 동일. main/extension 1.0.0(1), Distribution 서명/App Store 프로필/get-task-allow=false, public guard/GPS 없음/ODsay 금지 패턴0, 알려진 서버 비밀0.
- 사용자 승인된 업로드 실행: 기존 public 환경을 재사용한 `xcodebuild -exportArchive`, `destination=upload`, 같은 Archive, 자동 빌드 번호 관리 false, Internal Only false. `-allowProvisioningUpdates` 없이 실행. 업로드 과정에서 재패키징하므로 로컬 export IPA 파일 해시를 원격 파일 해시라고 주장하지 않는다.
- 결과 **exit 0 / Uploaded mobile / EXPORT SUCCEEDED**. 로그 `/private/tmp/timefit-signup-upload-20260910.log`. 추가 인증서 생성·취소·개인키 내보내기 실행0, 운영 DB 변경0.
- 업로드 경고: ReactNativeDependencies.framework 및 hermesvm.framework dSYM 누락. 전송 실패가 아니며 해당 프레임워크 충돌 심볼 해석에 제한이 있을 수 있다. 경고를 숨기거나 전체 빌드 실패로 바꾸지 않는다.
- 업로드 후 Connect TestFlight 탐색 중 사용자가 다른 Chrome 창을 사용하여 조작을 중단했다. **Apple 처리 완료/빌드 선택/수출 규정 화면 상태는 미확인**, 업로드 성공과 구분한다.
- App Privacy 초안 저장·게시0. 자동 출시 기존 선택 유지, 심사 제출/공개0. 후속은 위 두 개인정보 사실 마감, Connect 처리 완료 확인·동일 빌드 TestFlight 실기기 확인이다.

## 09/10 TestFlight 내부 검증 수락 — 사용자 실기기 보고

이전 업로드 후 처리·실기기 미확인 → 사용자가 TestFlight **1.0.0(1)**에서 아래 항목 모두 통과 보고 → 해당 내부 체크리스트 수락. 자동 테스트 재실행이나 모든 출시 게이트 통과로 확대하지 않는다. 기기 모델·OS 버전·개별 캡처는 이번 보고에 포함되지 않았다.

- [x] 앱 정상 실행, 개발/QA 요소 미노출, 위치 권한 요청 없음.
- [x] CAPTCHA 로그인 / 로그아웃 / 재로그인.
- [x] 개인정보처리방침 / 이용약관 / 지원 링크 정상.
- [x] 수동 장소 검색 / 지도 선택 / 주변 둘러보기.
- [x] 추천 → 장소 선택 → 코스 생성 → 카카오맵 길찾기 E2E.
- [x] Live Activity 도착·출발·완료 및 앱과 상태 동기화.
- [x] 코스 완료 후 History 기록 증가, 앱 종료·재실행 후 기록과 숫자 유지.

이 수락은 App Privacy 게시, 심사 버전의 빌드 선택·수출 규정 상태 확인, 심사 제출 완료를 의미하지 않는다. 위 개인정보 입력안의 미확정 항목과 공개 방침의 가입 CAPTCHA 최소 반영은 별도 마감 항목이다. 이번 보고만으로 코드 수정·새 빌드·동일 체크리스트 반복을 추가하지 않는다.

### 이번 기록 인수인계

1. 변경: 본 문서, `docs/README.md`, `docs/테스트.md`에 빌드가 명시된 사용자 검증 수락을 연결.
2. 불변: 제품 코드·GPS 제거·180분/2곳·개인화·공개 문서·Connect 설정.
3. 검증: 위 11개 항목의 사용자 TestFlight 보고 수락. 문서 diff 검사만 실행, 제품 테스트 재실행 없음.
4. 다음: App Privacy 및 제출 화면 미완료 항목 마감. 계정 삭제·다른 기기·모든 실패 조건 등 보고에 없는 시험을 통과로 간주하지 않는다.

## 09/10 App Privacy 마감 점검 — 사실 확인 한계와 게시 보류

사용자 요청: App Privacy 마감. 위 8개 유형 표를 Connect 입력용으로 재사용하되, **검색 기록·기기 ID의 공급자 보관/사용 관계를 확인하지 못했으므로 전체 마감·게시 완료로 기록하지 않는다**. 이전 공급자 미확인 → 공식 자료·현행 소스 재대조 → 미확인 항목만 유지 → 근거 없는 수집 예/아니오를 피하기 위한 상태다. 새 코드·빌드 작업은 없다.

### 이번에 직접 재확인한 경계

- `src/services/kakaoLocationSearchAdapter.ts:81`: 검색 캐시는 앱 메모리의 Map이다. `src/engine/kakao.ts:77`의 Local 요청은 검색어를 query로 Kakao에 전송하며 짜투리 계정 ID를 헤더에 넣지 않는다. 이 코드만으로 Kakao가 요청 종료 후 무엇을 보관하는지는 알 수 없다.
- Kakao 일반 개인정보처리방침 제2절은 검색어를 포함한 서비스 이용 내역의 자동 기록 가능성을 설명한다. 그러나 이 일반 설명만으로 현재 Local REST endpoint의 원문 검색어 보관·사용 목적·사용자 연결을 확정할 수는 없다. 반대로 짜투리 DB에 검색어가 없다는 이유로 공급자까지 수집 없다고 답하지 않는다.
- Cloudflare Turnstile 공식 방침은 IP/TLS fingerprint/User-Agent/sitekey·origin의 보안 및 bot 탐지 개선 처리를 명시한다. Turnstile Analytics 공식 문서는 Source IP별 challenge 집계를 설명한다. 따라서 모든 신호가 실시간 요청 직후 사라진다고 주장하지 않는다. 다만 IP·브라우저 특성이 있다는 사실 자체를 device-level ID 사용으로 동일시하지 않는다. Enterprise 전용 Ephemeral ID를 현재 Free 설정의 증거로 쓰지 않는다.
- Apple는 IP의 분류를 실제 사용 목적에 따라 Location/Device ID/Diagnostics 등으로 정하도록 안내한다. 광고 SDK가 없다는 것만으로 모든 기기 ID 수집을 부정할 수 없고, 반대로 보안 IP라는 것만으로 광고 추적을 긍정하지 않는다.
- 개인정보처리방침 원본의 Cloudflare 설명은 아직 비로그인 추천·비밀번호 로그인만 명시한다. 가입 CAPTCHA가 추가된 사실을 공개 원본/HTML에 함께 반영하는 최소 수정은 출시 문서 소유자 인계 범위이며 이번 통합 세션에서 직접 수정·재게시하지 않았다.

### 남은 확인은 아래 두 질문으로 한정

1. Kakao Local `search/keyword.json`, `search/address.json`에 보낸 이용자 검색어를 실시간 응답 이후 보관하는가? 그렇다면 용도와 계정/기기 연결 여부는 무엇인가? 검색어를 포함하지 않는 호출량 집계와 구분한다.
2. 현재 Free Managed Turnstile의 IP/TLS/브라우저 신호를 실시간 challenge 이후 기기 수준 식별자로 보관·이용하는가? 보안 진단 집계와 구분한다. 정확한 모든 로그 삭제일이나 DPA 전면 조사는 요구하지 않는다.

이메일·사용자 ID·정확 위치·제품 상호작용·기타 사용 데이터·고객 지원·성능 데이터·기타 진단 데이터의 위 입력안은 유지한다. Customer Support는 데이터 유형이고 목적은 App Functionality다. 공개 문서의 옛 목적 열에 Customer Support라고 쓰인 부분은 실제 Connect 목적 옵션으로 사용하지 않는다. GPS 제거·카카오앱 자체 현재 위치 이용은 계정 코스 좌표 보관 여부를 자동으로 바꾸지 않는다.

공식 근거(2026-09-10 재조회):

- Apple 수집/제3자/WebView/IP/연결/추적 정의: https://developer.apple.com/app-store/app-privacy-details/
- Kakao 일반 수집 설명(개별 Local 보관 확정 자료 아님): https://www.kakao.com/policy/privacy
- Turnstile 보안 신호·독자적 탐지 개선 목적: https://www.cloudflare.com/turnstile-privacy-policy/
- Turnstile IP 등 집계 항목: https://developers.cloudflare.com/turnstile/turnstile-analytics/
- Ephemeral ID 기능 구분: https://developers.cloudflare.com/turnstile/additional-configuration/ephemeral-id/

인수인계: 변경 파일은 본 통합 문서만(판정 근거·남은 질문); 제품 코드·운영 DB·공개 문서·Connect는 변경 없음. 검증은 로컬 소스 읽기·공식 자료 재조회·문서 diff 검사이며 제품 테스트 재실행 없음. **Connect 저장/게시0, 심사 제출0.** 미확인 두 답변을 사용자 선호만으로 사실 확정 처리하지 않는다.

## 최초 인수인계 — 진행 상태는 위 최신 후속 우선

- 변경 파일·목적: 이 문서 신규, 사용자 최신 결정과 병렬 범위·직접 관찰을 기록.
- 불변: 최대180분/2곳, 수동 장소, 기록/개인화, 가입 동의·CAPTCHA, Bundle/Team/App Group, 기존 원본·산출물.
- 검증: Connect TestFlight `빌드 없음` 직접 확인. 이 기록 추가만으로 제품 테스트를 재실행하지 않았다.
- 남은 사항: 새 빌드 권한·생성·검증·업로드, App Privacy 불확실 항목 판정 및 입력/게시, TestFlight 동일 빌드 실기기 확인. 심사 제출 미실행.

## 09/10 사용자 App Privacy 설정 인계 — 게시 전

사용자가 공유한 Connect 설정을 이후 검증의 현재 상태로 기록한다. 이번 세션에서 원격 화면을 직접 재확인한 결과가 아니라 **사용자 완료 보고**다. 기술적 사실·분류 판단·현재 입력값을 구분하며 기존 입력에 맞추기 위해 코드를 바꾸지 않는다.

- 대상: TestFlight 1.0.0(1). 데이터 수집 예, 개인정보처리방침 `https://jjaturi-docs.pages.dev/privacy/`, 선택 사항 URL 공란. **최종 게시 전**, 심사 제출 완료 아님.
- GPS: 기기 현재 위치 취득·권한 요청·권한 description 없음. 수동 검색/지도 선택 사용. 주변 길찾기는 목적지명/좌표만, 일반 코스는 수동 출발지 또는 직전 장소 좌표 전달. KakaoMap 자체 위치 사용을 짜투리 GPS 취득으로 기록하지 않는다.

| 유지 유형 | 목적(사용자 입력 완료 보고) | 사용자 신원 연결 | 추적 |
| --- | --- | --- | --- |
| 이메일 주소 | 앱 기능 | 예 | 아니요 |
| 정확한 위치 | 앱 기능 | 예 | 아니요 |
| 사용자 ID | 앱 기능, 제품 개인 맞춤화 | 예 | 아니요 |
| 기기 ID | 앱 기능 | 아니요(아래 검토 사항) | 아니요 |
| 제품 상호 작용 | 앱 기능, 제품 개인 맞춤화 | 예 | 아니요 |
| 기타 사용 데이터 | 앱 기능, 제품 개인 맞춤화 | 예 | 아니요 |
| 기타 진단 데이터 | 앱 기능 | 예 | 아니요 |

판정에 사용한 경계: 이메일은 Auth 저장; UUID/닉네임은 계정 식별; 완료·동의·인증은 상호 작용; 유효 체류 분은 기타 사용 데이터. 정확한 위치는 GPS가 아니라 사용자 확인 방문 장소 ID와 카탈로그의 좌표 식별 관계에 따른 분류 판단이다. 완료 테이블 자체에 lat/lon이 저장된다고 서술하지 않는다. 기기 ID는 Turnstile 단기 클라이언트 식별 근거이며 앱의 IDFA/IDFV 직접 조회나 DB 저장을 의미하지 않는다. 진단은 Auth/API 관련 상태·오류·보안 로그 범위다.

### 이전 안내와 교체 결정

이전 8/10유형 보수적 일괄 입력 → 수집 가능성만으로 포함하거나 서버 성능과 앱 성능을 동일시하는 문제 → 사용자 결정은 7유형 유지 및 아래 3유형 제거 → 확인 가능한 실제 처리와 Apple 정의에 맞추기 위한 교체. **제거는 예정이며 실행 완료로 기록하지 않는다.**

- 고객 지원: 외부 support/mailto만 제공, 앱/Supabase 문의 본문 수집 경로 미확인으로 제거 예정.
- 검색 기록: Kakao Local 전송과 앱 메모리 캐시 확인, 공급자의 요청 후 원문 보관 미확인. 가능성만으로 포함하지 않는 결정이며 공급자 비보관이 검증됐다는 의미는 아님.
- 실적 데이터: 서버 함수 실행시간만으로 앱 Performance Data 신고 근거가 충분하지 않다는 판단으로 제거 예정.

실명·전화번호·결제·구매·사용자 사진/동영상·연락처·브라우징 기록·기타 사용자 콘텐츠·Crash Data·광고 데이터·대략적 위치는 현재 수집 근거가 없어 추가하지 않는 사용자 결정. 새 수집 코드/SDK/공급자/분석·로그/GPS/광고가 생기면 다시 대조한다. 가능성만으로 추가하거나, 이번 결정을 미래 코드에 대한 영구 면제로 쓰지 않는다.

### 남겨둘 분류 검토 사항

기기 ID의 현재 입력은 ‘사용자 신원에 연결: 아니요’다. 그러나 Apple의 연결은 계정뿐 아니라 **기기 및 제3자에 의한 연결**도 포함한다. 짜투리 user_id와 결합하지 않는다는 사실만으로 아니요를 확정할 수 없다. 현재 입력값을 임의 수정하지 않으며, 기술적 수락과 구분해 게시 전 검토 사항으로 유지한다. 근거: https://developer.apple.com/app-store/app-privacy-details/#data-linked-to-the-user

인수인계: 변경 파일은 본 문서와 docs/README.md(현재 보고·이력·검토 사항 연결). 제품 코드·DB·공개 사이트·Connect 설정 변경 없음. 사용자 보고 기록과 공식 정의 확인, 문서 diff 검사만 수행하며 제품 테스트 재실행 없음. 다음은 3유형 실제 제거 여부 및 게시 전 분류 검토 확인이고, 게시·심사 제출은 아직 미완료다.

## 09/10 사용자 App Privacy 게시 보고 및 다음 실행

사용자: ‘기기 ID를 빼기로 했고, 게시했다’. 이전 7유형 중 기기 ID 유지/연결 검토 → 사용자 제외 결정 및 게시 보고로 상태 갱신. 최종 의도는 이메일·정확한 위치·사용자 ID·제품 상호 작용·기타 사용 데이터·기타 진단의 6유형이다. 실제 게시 화면의 6유형 목록을 이번 세션이 직접 조회한 것은 아니다. 공급자의 기기 식별 미수집이 검증된 것으로 승격하지 않으며 새 근거가 있으면 정정 검토한다. 기존 내부 처리 관련 근거와 판단 한계는 보존한다. 심사 제출은 별도다.

### DOCS-CAPTCHA-NOTICE-FINAL-01 — 출시 문서 세션

목적: 최종 1.0.0(1)의 회원가입 CAPTCHA가 공개 방침에서 누락된 설명만 보완한다. 통합 세션이 09/10 공개 HTTPS 본문을 직접 읽어 Cloudflare 행에 여전히 비로그인 추천·비밀번호 로그인만 있는 것을 확인했다. 로컬 Markdown/HTML도 같다.

작업:
1. `docs/05_release/publish/privacy-policy.md`와 `docs/05_release/public-site/privacy/index.html`의 Cloudflare 행에서 아래 세 문구만 보완한다.
   - 처리 시기: ‘회원가입, 비로그인 추천 또는 비밀번호 로그인 보안 확인과 공개 문서 접속 때’.
   - 목적: ‘악성 자동 요청 탐지·차단, 회원가입·로그인·추천 API 보호와 Cloudflare의 bot 탐지 개선; 공개 문서 호스팅·보안’.
   - 거부 영향: ‘보안 확인을 거부하면 보호 대상 회원가입·비로그인 추천·비밀번호 로그인을 진행할 수 없음’으로 반영. 나머지 사이트 접속·권리 안내 유지.
2. 새 수집 기능 도입이 아닌 현재 가입 보안 동작의 누락 설명 보완임을 작업 기록에 남긴다. 문서 URL·문서 ID·현재 버전을 임의 변경하거나 DB 동의 이력을 수정하지 않는다. 별도 버전/재동의가 필요하다고 판단하면 이유를 인계하고 운영 DB에는 쓰지 않는다.
3. 기존 게시 절차로 이 최소 보완을 같은 공개 사이트에 반영한다. 배포에 딸려갈 다른 로컬 변경이 없는지 diff를 먼저 확인하고, 관련 없는 변경은 함께 게시하지 않는다. 배포 권한/인증이 필요하면 요청한다.
4. 공개 `/privacy/` 본문에서 세 변경을 확인하고 `/terms/`, `/support/` 링크가 유지되는지 확인한다. 기존 문서 검증 및 `git diff --check` 결과, 배포 결과를 기록한다.

불변: 제품 코드·빌드·DB registry/동의/기록·GPS 제거·App Privacy 설정·암호화·출시 방식. 공급자 DPA 전면 재조사, 기기 ID 제외를 근거로 네트워크 보안 신호 고지 삭제, App Review 제출은 하지 않는다.

완료 인계: 변경 파일/세 문구와 이유, 유지 경계, 로컬 및 공개 검증 결과, 남은 게이트를 남긴다. 다음은 Connect 심사 버전의 1.0.0(1) 선택·암호화/계정/메모/자동 출시 최종 확인이다.

이번 통합 인계: README와 본 문서만 수정. 공개 원문 읽기 성공 및 문서 diff 검사, 제품 테스트 재실행 없음. 공개 사이트 수정/재배포는 아직 하지 않았고 출시 문서 세션 소유로 인계한다.
