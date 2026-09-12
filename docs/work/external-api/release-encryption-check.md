# API-RELEASE-ENCRYPTION-01 — 암호화 판단 및 UIUX 인계

2026-09-09. 상태: **현재 소스·설치 의존성 기준 판단 완료 / 설정 반영·최종 Archive 확인 전**. 대한민국 단독 배포. 위치 신고 판단과 독립적이다.

## 1. 결론

현재 앱의 사용 경로와 의존성을 근거로 **비면제 암호화 미사용**, `ITSAppUsesNonExemptEncryption = false`를 권장한다. HTTPS는 사용하므로 ‘암호화 자체를 사용하지 않는다’고 신고하는 뜻이 아니다. Apple 운영체제의 통신 보안 기능을 이용하는 유형으로 판단하며 현재 Connect에 별도 암호화 문서를 올릴 필요는 없다.

이전: HTTPS만 알고 SDK 경계 미확인 → 문제: HTTPS 사용과 비면제 여부를 혼동할 수 있음 → 교체: 실제 fetch/네이티브 통신·SDK 인증 코드·설치된 prebuilt 의존 근거를 대조 → 이유: 면제값을 편의상 입력하지 않도록 함 → 상태: 권장 답변 확정, UIUX 설정 반영 전.

이는 현 구성의 기술적 분류이며 법적 보증이나 최종 IPA 전수 역분석 완료 선언이 아니다. 최종 산출물 확인은 아래 좁은 범위로 남긴다.

## 2. 실제 사용 근거

| 경계 | 확인한 구현 | 판단 |
| --- | --- | --- |
| Supabase REST/Auth | `src/services/supabase.ts`의 createClient, AsyncStorage, 기본 fetch. `AuthContext.tsx` 이메일/비밀번호·세션·OTP. 설치 supabase-js의 react-native export는 `dist/index.cjs`, resolveFetch는 global fetch 호출 | 앱 안에 별도 TLS/비밀번호 암호화 구현을 넣지 않고 HTTPS와 서버 인증 사용 |
| React Native 네트워크 | `Libraries/Network/fetch.js`→whatwg-fetch/XHR, `RCTHTTPRequestHandler.mm:103` NSURLSession 생성 | iOS 네트워크 기능에 통신 위임 |
| Expo fetch | `expo/ios/Fetch/ExpoURLSessionTask.swift`, `ExpoURLSessionManager.swift` URLSession | 이 경로를 이용해도 별도 TLS 라이브러리 구현 아님 |
| 지도·CAPTCHA·웹 링크 | 기존 API-KAKAO-CONFIG 인계 재사용. react-native-webview `RNCWebViewImpl.m` WKWebView, expo-web-browser `WebBrowserSession.swift` SFSafariViewController·`WebAuthSession.swift` ASWebAuthenticationSession | OS WebKit/Safari 통신. 원격 지도·CAPTCHA 스크립트 전체를 이번에 다운로드/감사한 것은 아님 |
| Supabase SDK의 PKCE/JWT | auth-js src 및 `dist/main/lib/helpers.js:252`, `dist/main/GoTrueClient.js:5196` 이후: WebCrypto digest/importKey/verify 호출. WebCrypto 미지원이면 PKCE plain 또는 JWT getUser 서버 확인. 앱은 flowType override/getClaims/crypto polyfill을 직접 사용하지 않음 | SHA/RSA/ECDSA 명칭 존재만으로 자체 구현이라고 판단하지 않음. 별도 암호 알고리즘 구현을 가져오는 fallback은 해당 코드에 없음 |
| Expo UUID | `expo-modules-core/ios/Uuidv5/Uuidv5.swift` CommonCrypto CC_SHA1 호출. 앱 randomUUID는 ID 생성 용도 | OS 해시/난수와 ID 생성. 데이터 기밀성 암호화 기능과 구분 |
| 네이티브 prebuilt 의존 | Podfile.lock 및 arm64 ReactNativeDependencies framework의 `nm -u`: CC_SHA1, SecRandomCopyBytes, SecTrust, CFStream SSL 설정 참조 | 실제 설치 바이너리에서도 Apple CommonCrypto/Security/CFStream 경계 확인. 심볼 일부만으로 바이너리 전체의 비존재를 증명하지 않음 |
| Live Activity/저장 | plugins/live-activity의 App Group FileManager/UserDefaults·JSON 경계. Supabase 세션 AsyncStorage | 별도 AES 저장 암호화 코드 확인되지 않음. 이 결론은 로컬 저장을 암호화 저장소라고 보증하지 않음 |
| 서버 전용 | Edge 함수·Supabase 서버 인증/저장 암호화·운영 백업 | 서버 구현을 iOS 배포물 내 암호 라이브러리로 계산하지 않음 |

버전: Expo56.0.19, RN0.85.3, supabase-js/auth-js/storage-js2.109.0, iceberg-js0.8.1, WebView13.16.1, ExpoWebBrowser56.0.6, ExpoModulesCore56.0.23. package-lock의 runtime 관계와 설치 package 버전을 대조했다. OpenSSL/BoringSSL/libsodium/CryptoJS/aes-js 등 별도 기밀성 암호 라이브러리 의존은 현재 manifest/lock에서 확인되지 않았다. dev/build 의존을 제품 암호화로 간주하지 않는다.

특이점: supabase-js 배포 코드에 AES/aes-js/SecureStore 언급이 있으나 저장 예제 설명 주석이다. 현재 앱은 그 예제를 구현하지 않았고 해당 라이브러리도 의존성에 없다. src/lib/fetch.ts의 tracing 참조와 배포 entry의 차이도 고려하여 src 검색만 아니라 실제 react-native export인 dist/index.cjs의 global fetch 경계를 확인했다.

## 3. Connect 질문별 답변

실제 문구가 아래 조건과 같은 경우에 적용한다. 화면을 보지 않고 ‘항상 아니오’로 답하지 않는다.

| 질문의 의미 | 현재 권장 답변 |
| --- | --- |
| 앱이 암호화를 사용/포함/이용합니까? (일반 질문) | **예** — HTTPS 이용 |
| 비면제 암호화를 사용합니까? | **아니오** |
| 암호화가 Apple OS 제공 기능에 한정됩니까? | **예**, 위 구현 범위 기준 |
| OS에서 제공하는 암호화 외의 표준 알고리즘 / 자체·비표준 알고리즘 / 둘 다 / 해당 없음 형태 | **언급된 알고리즘에 해당하지 않음(None of the algorithms mentioned above)** — OS 밖 구현을 묻는 경우. 일반 ‘암호화 없음’과 혼동 금지 |
| 자체·비표준 암호화 알고리즘을 사용합니까? | **아니오** |
| 프랑스에서 배포합니까? | **아니오** — 사용자 대한민국 단독 결정 |
| 별도 암호화 문서 업로드 | 현 구현은 **불필요**. 빈 양식·임의 CCATS를 만들지 않음 |

공식 기준(확인 2026-09-09):

- [Apple 암호화 문서 표](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/): OS 내 암호화만 사용하는 경우 Connect 문서 불필요. OS 밖 표준 알고리즘과 자체 알고리즘은 별도 구분하며 프랑스 선언은 프랑스 배포 시 요구. 대한민국만이라는 이유 하나로 모든 암호화를 면제로 분류한 것은 아니다.
- [Apple ITSAppUsesNonExemptEncryption](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption): 비면제 사용 여부 선언. 키가 없으면 업로드 시 질문 절차가 표시될 수 있음.
- [Expo app config](https://docs.expo.dev/versions/latest/config/app/): `ios.config.usesNonExemptEncryption` boolean 설정. 설치된 config-plugins의 변환 함수를 아래처럼 직접 검증했다.

## 4. UIUX에 필요한 변경만 인계

1. **앱 설정 한 곳:** app.json의 기존 `expo.ios.config`에 `"usesNonExemptEncryption": false`를 병합한다. 기존 키·권한·식별자·네트워크 보안 정책을 덮어쓰지 않는다. 문자열 `"false"`가 아니라 boolean이다. HTTPS/ATS를 끄는 작업이 아니다.
2. 설치된 `@expo/config-plugins/build/ios/UsesNonExemptEncryption.js`가 main Info.plist의 boolean `ITSAppUsesNonExemptEncryption`으로 변환함을 메모리 assertion으로 확인했다. 현재 app.json/main 및 extension 원본 plist에는 키가 없다. 중복해서 ios.infoPlist와 config에 서로 다른 값을 쓰지 않는다.
3. UIUX 기존 public prebuild 경계로 생성하여 main `ios/mobile/Info.plist` 및 최종 `.app/Info.plist`의 false를 확인한다. generated native 파일만 직접 고치지 않는다. extension은 별도 네트워크 암호 기능을 추가하지 않았으므로 이번에 불필요한 plugin 변경을 만들지 않는다. 최종 포함 extension의 의존/기능 불변도 확인한다.
4. 최종 build가 본 문서의 lock/dependencies와 달라졌다면 새로 추가된 암호화·보안 SDK만 영향 검토한다. 동일한 의존성이고 설정 반영이 확인되면 이번 조사를 반복하지 않는다. 완성 IPA의 embedded frameworks/링크 목록에서 예상하지 못한 암호 SDK가 발견된 경우에만 재판정한다.
5. UIUX가 설정 계약 테스트·기존 필수 테스트/번들 검증을 수행한다. API는 제품 설정을 직접 변경하지 않았다. 인증서/Apple 계정/Connect 입력/업로드를 이번 승인에 포함하지 않는다.

## 5. 검증 및 네 항목 인수인계

1. **변경 파일·목적:** 이 문서만 신규 생성. 암호화 근거와 Connect 답변·UIUX 설정 인계.
2. **유지 계약:** 제품 코드·app.json·native 파일·운영 데이터·위치 처리·개인화·로그인·권한·공급자 모두 불변. 운영 API 호출0, 계정/서명 변경0, 게시/업로드0. 공식 문서 웹 조회만 수행.
3. **실행 결과:** lock/설치 버전 및 entry 확인, 소스/배포 JS inspection, `nm -u` 네이티브 의존 확인. Expo setUsesNonExemptEncryption 메모리 assertion: false 변환과 기존 CFBundleDisplayName 보존 **PASS**. 문서 whitespace 검사. 제품 변경이 없어 앱 전체 테스트/새 빌드 미실행. 없는 SocketRocket 개별 Pods 경로 대신 실제 prebuilt ReactNativeDependencies를 확인했다. 최종 IPA 미검사.
4. **다음:** UIUX가 위 boolean 설정·생성물 검증만 수행하면 됨. 사용자에게 새로운 암호화 기능/문서 발급 결정을 요구하지 않는다. 실제 Connect 질문이 표와 다르면 문구를 확인하여 대응하며 임의 입력하지 않는다.

검토 기준 HEAD `d3ac8f7ed1ad7360a1215def0b02c2726b96e47f` + 기존 dirty tree. 주요 SHA256:

```text
package.json      19d6fdfe7cbe4613590e3fc71adc17f60a339916d2eb0800ecb8c8c7381a3f6b
package-lock.json b138b9c9075cbc147d370dff5ae821fefcee18e083d6f8be974a7acb3e737e2b
ios/Podfile.lock  5a828053ca1d9a839e40ee9c3e70af54beb1451a96d4d6c35d7247c7f693da8b
app.json          58685a5ab9a30b86be2a83e3b034486b64d8c5fb4145c3c09f363522a555fb9b
```
