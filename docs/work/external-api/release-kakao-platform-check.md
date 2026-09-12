# API-RELEASE-KAKAO-CONFIG-01 — 플랫폼 등록 필요성 확인

2026-09-09 · [실행 지시](../integration-decision/release-parallel-verification.md).

**판정: 현재 구현에 대한 iOS Bundle ID 추가 등록은 불필요. 필요한 JavaScript 도메인은 사용자 확인 목록과 일치하므로 도메인 추가 조치도 없다.** 플랫폼 등록 감사는 완료한다. 다만 카카오맵 상품 활성화/키별 제한의 현재 상태와 최종 WKWebView 요청 origin은 기존 근거만으로 전부 증명되지 않아 아래처럼 분리한다. 이 미확인을 곧바로 설정 변경 필요로 판정하지 않는다.

## 1. 재사용 근거와 구현 방식

- [API NOTICE](release-notice-facts.md), [DOCS-06 사용자 직접 확인](../../05_release/release-document-session.md)의 §5, BUILD/EXIT-03/ICON-01 public export 인계를 재사용했다. 계정 화면 Computer Use·원격 조회·실제 API 요청·env 재수집0.
- 사용자 확인 도메인: `http://localhost:3000`, **`https://timefit.local`**, `http://localhost:8000`, `http://127.0.0.1:5500`. iOS Bundle ID 미등록, Local/Maps JavaScript/REST 도보·대중교통의 사용 기록과 무료 쿼터 내 사용 보고가 있다. API가 이번 원격 상태를 직접 확인한 것은 아니다.
- `package.json`·`ios/Podfile.lock`에서 Kakao Native SDK 의존성을 찾지 못했다. 실제 지도 소비는 `KakaoRouteMap.tsx`와 `NearbyBrowseMap.tsx`의 WebView 및 `dapi.kakao.com/v2/maps/sdk.js`. 두 파일은 public JavaScript key를 우선 사용하고, 정적 HTML의 baseUrl은 `https://timefit.local`이다. 현재 방식은 iOS 네이티브 지도 SDK가 아니다.

## 2. 기능별 결론

| 기능 / 사용 상품 | 필수 등록·설정 | 현재 근거 | 판정 / 필요 조치 |
| --- | --- | --- | --- |
| 장소·주소·좌표 라벨 / Local REST | Developers 앱의 REST API 키. 각 API 기본 정보는 별도 요구 사항 ‘-’; 네이티브 SDK Bundle ID·JS 도메인 인증 방식 아님 | `src/engine/kakao.ts`의 GET Local+KakaoAK, 검색/라벨 adapter→화면. 사용자 Local 사용 확인 | **현재 사용 방식 일치, iOS/JS 등록 추가 불필요.** 키 유효성/허용 IP 변경은 별개이며 이번 변경 없음 |
| 지도 / Maps Web SDK | JavaScript key 및 해당 key의 JavaScript SDK 도메인 등록 | 두 WebView baseUrl과 등록 목록의 `https://timefit.local` 일치. SDK appkey는 JS key | **도메인 일치, 추가 등록 불필요.** 외부 Pages 예정 host·Supabase host·Kakao API host를 대신 등록하지 않음 |
| 경로 / Maps REST walk·publictraffic | REST API 키, 상품 사용 설정·키에 허용된 API/제한. iOS native key 등록은 해당 없음 | `supabase/functions/route-proxy/kakaoRouteRequest.ts`의 `/v2/routing/walk`, `/v2/routing/publictraffic` GET, 서버 REST 인증. 사용자 화면은 `/route-open/openapi/v1/*.json` 명칭의 사용 기록 보고 | **인증 방식 일치, Bundle ID 추가 불필요.** 보고된 통계 경로와 코드 endpoint의 명칭 차이는 관찰 계층 차이로 남기며 동일 배포/동일 키 증명으로 삼지 않음. 상품 설정의 정확 ON·키 제한은 아래 미확인 |
| 외부 카카오맵 앱 열기 / URL scheme | `kakaomap://route`·place 등의 외부 앱 scheme. iOS 설치 여부 질의에는 앱 Info.plist의 `LSApplicationQueriesSchemes` 항목 `kakaomap` | `execution/schedule.ts`의 route URL, `app.json` 및 생성 `ios/mobile/Info.plist`에 kakaomap 질의 허용 | **로컬 설정 일치, 조치 없음.** Kakao Developers의 native key/Bundle ID 등록이나 우리 앱 URL Types에 kakaomap을 소유 scheme으로 추가할 필요 없음 |
| 외부 웹 길찾기 / Kakao 지도 URL | 공식 `https://map.kakao.com/link/by/...` 또는 `/link/to/...` 링크. 해당 URL에 우리 JS key 없음 | `execution/schedule.ts`, `nearbyDirections.ts`의 HTTPS/browser fallback | **등록 추가 불필요.** 카카오 소유 map.kakao.com은 외부 목적지이지 우리 WebView JS 허용 host가 아님 |
| Kakao iOS Native SDK / 카카오 로그인·공유 | 사용한다면 상품별 native key/Bundle ID 또는 OAuth/제품 링크 설정 필요 | 현재 Kakao Native SDK 사용 없음; 앱 로그인은 Supabase. 사용자도 카카오톡 공유 미사용 확인 | **현재 비대상.** `com.dongheun.mobile`을 Kakao iOS 플랫폼에 지금 등록하라는 조치 없음. 이후 실제 native 상품 도입 시 재평가 |

## 3. 공식 요건 — 확인일 2026-09-09

- [Maps Web 가이드 ‘준비하기’](https://apis.map.kakao.com/web/guide/): 앱→앱 설정→앱→플랫폼 키에서 JavaScript key 선택, **JavaScript SDK 도메인** 등록. 등록 사이트에서만 지도 API 사용 가능. 같은 문서 ‘지도 URL’은 외부 지도·길찾기 링크를 별도 안내한다.
- [카카오맵 이해하기 ‘지도 SDK/시작하기/쿼터’](https://developers.kakao.com/docs/ko/kakaomap/common): Web SDK=JavaScript key, Android/iOS SDK=native key로 구분한다. 시작하기는 카카오맵→사용 설정→상태 ON, REST key 설정, SDK별 등록을 요구한다. 첫 활성 앱의 무료 쿼터와 두 번째 앱/초과 사용의 유료 조건도 구분한다. **현재 무료 한도 내 사용 보고만으로 유료 전환이나 새 앱 생성을 요구하지 않는다.**
- [Local REST 기본 정보](https://developers.kakao.com/docs/ko/local/dev-guide), [Maps REST 도보·대중교통 조회](https://developers.kakao.com/docs/ko/kakaomap/rest-api): REST 인증/요청 규격 근거. 현재 Edge routing은 별도 Kakao Mobility 자동차 API로 해석하지 않는다.
- [앱 설정 ‘플랫폼 키/호출 허용 IP 주소’](https://developers.kakao.com/docs/ko/app-setting/app): JavaScript key의 domain과 native key의 iOS Bundle ID를 구별한다. REST key IP 제한을 등록하면 해당 IP 요청만 허용되므로 앱 직접 Local 요청이나 Edge egress를 고려하지 않은 IP 추가는 장애를 만들 수 있다. 키별 API 제한과 IP 제한은 이번 조회/변경하지 않았다.
- [공식 카카오맵 URL scheme](https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/): 외부 카카오맵 실행·길찾기 규격 근거. 외부 앱 호출과 앱 안의 Native SDK 인증을 혼동하지 않는다.

위 요건과 실제 사용 방식의 대조로 iOS Bundle ID 등록 불필요를 판단했다. 단순히 ‘iOS 앱’이라는 이유로 Native SDK 설정을 강제하지 않는다.

## 4. origin·artifact 확인 수준 및 남은 확인

1. source 상수만 확인한 것은 아니다. 설치된 `react-native-webview/apple/RNCWebViewImpl.m:841`에서 source.baseUrl을 NSURL로 변환하여 WKWebView `loadHTMLString:baseURL:`에 넘기는 경계까지 확인했다. 양 지도 컴포넌트도 실제 source prop에 같은 값을 전달한다. `originWhitelist=['*']`는 RN 탐색 허용이며 Kakao domain 등록을 대체하지 않는다.
2. 기존 ICON-01은 public wrapper iOS export 및 credential/endpoint audit PASS, JS SHA256 `aadf0a6802364eaf79fc405f3e780588cc3603bc111e5505720f910fdb654605`를 기록했다. 이 인계의 audit는 Maps host의 실제 HTTP Origin/Referer·JS key↔계정 일치 전용 검사가 아니며 이번 바이너리를 새로 만들거나 읽어 재확인하지 않았다.
3. 이번 격리 JS document fixture는 SDK stub을 사용한다. 실제 WKWebView origin/Referer와 최종 key 도메인 검증 성공을 증명하지 않는다. 최종 후보의 기존 지도 smoke에서 확인할 사항이지 지금 새 운영 호출을 만들 이유는 아니다. 외부 카카오맵 길찾기 성공 보고도 Maps JS 또는 Local/REST 설정 전부의 증거가 아니다.
4. **현재 설정 변경 필요가 확정된 항목은0개.** 정확한 Maps 사용 설정 ON과 사용 REST key의 허용 상품/IP 상태는 기존 사용자 인계에 값이 없어 미확인이다. 사용 기록은 존재 근거지만 현재 설정 전체 확인은 아니다. 추가로 확인해야 한다면 해당 앱의 **카카오맵→사용 설정→상태**, **앱→플랫폼 키→사용 REST key의 사용 가능 API/호출 허용 IP 설정 유무**만 값 비노출로 받는다. 같은 계정 전수 재조사·키 복사 불필요.
5. 향후 최종 후보에서 실제 JS origin 또는 key가 바뀐 증거가 생길 때만 사용자에게 **앱→플랫폼 키→사용 JavaScript key→JavaScript SDK 도메인**의 정확한 host 추가/수정을 인계한다. 현재 값 `https://timefit.local`은 이미 등록되어 있으므로 중복 입력하지 않는다. 기존 개발 도메인 삭제·IP 제한 강화·API 활성화·유료 변경은 이 명령에 포함되지 않는다.

## 5. 네 항목 인수인계

1. **변경 파일:** 이 문서만 신규 작성. 앱 config/화면/native project/API 코드/보드/타 역할 문서 변경0.
2. **유지 계약:** provider·public wrapper·JS baseUrl·외부 URL scheme·키/쿼터/캐시 불변. Computer Use·운영 지도/검색/경로 요청·계정/설정 변경·문의·게시·Archive·commit/push0.
3. **검증:** `node --import tsx --test test/route-proxy-kakao-request.test.ts test/kakao-location-search-adapter.test.ts test/kakao-location-label-adapter.test.ts test/ui/nearby-browse-map-document.test.mjs test/ui/execution-schedule.test.ts` → **35/35 PASS**, skip0、외부 HTTP0(주입 fixture). 요청 규격·검색/라벨·지도 stub·외부 링크 실패 분기를 확인했으며 실제 도메인 인증 테스트는 아님. 문서 whitespace 검사 수행. 앱 전체 게이트는 QA 단일 실행 결과를 사용하며 이번 재실행0.
4. **다음 결정:** 통합/DOCS는 ‘iOS Bundle ID 미등록’을 현 방식의 수정 필수 항목에서 제외하고 **JS 도메인 일치·추가 조치 없음**으로 닫을 수 있다. 상품 활성화/키별 제한·최종 artifact/runtime origin 미확인은 별도로 남긴다. 공급자 법적 역할/고지 문의는 본 플랫폼 감사로 해결된 것이 아니며 재조사하지 않았다.
