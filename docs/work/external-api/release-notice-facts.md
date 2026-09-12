# API-RELEASE-NOTICE-01 — 공급자 적용·production 사용 인계

2026-09-09. [실행 지시](../integration-decision/release-notice-closeout.md)의 API 범위. **읽기 전용 조사 및 제한 fixture 완료 / 개별 계약·운영 설정·최종 artifact 적용은 일부 미확인**. 법적 적합성 또는 공개 승인 판정이 아니다.

## 1. 근거 범위·이전 결론 교체

[OPS-02](release-facts-final.md#7-api-release-ops-02--운영-연결공급자-후속-감사), [공개 사실표 R1](../../05_release/publish/data-facts.md), [BUILD](../uiux/release-build-final.md), [EXIT-03](../uiux/release-exit-final.md), [ICON-01](../uiux/release-icon-final.md)의 기존 증거와 현재 공유 소스를 대조했다. cache/키/운영 배포 감사를 반복하지 않았다. 계정 관리 화면·계약 원본은 제공되지 않아 조회하지 않았고, 이전 CLI 인증 실패도 재시도하지 않았다.

- 이전 OPS-02: V1 기록 없는 종료→MyCourses→기존 코스에서 legacy 도달 확인 → EXIT-03이 그 종료를 Home 단일 reset으로 교체 → **당시 입증한 공개 진입 경로는 현재 닫힘**. legacy 전체 제거/최종 바이너리 전송0이라는 뜻은 아니다.
- R1의 Cloudflare production 미확인 → public wrapper·export 인계·실제 소비 분기를 결합 → **production 구성에 포함되어 조건 충족 시 사용되는 보안 의존성 확인**. 원격 widget 가용성·최종 distribution 실행 확인은 별도다. 진단 flag=false를 CAPTCHA 기능 비활성으로 오해하지 않는다.

## 2. Kakao 상품·요청별 적용 근거

공식 자료 확인일은 모두 **2026-09-09**. 표의 적용 근거는 공개 문서와 코드 일치이며 해당 계정의 동의 시각/별도 계약까지 확인한 것은 아니다.

| 실제 상품·목적 | 요청 주체·항목 / source 근거 | 공식 적용 자료·범위 |
| --- | --- | --- |
| Local 장소·주소 검색/좌표 라벨 | 앱→Local REST. 검색어 또는 위경도, REST 인증. `src/engine/kakao.ts`, `kakaoLocationSearchAdapter.ts`, `kakaoLocationLabelAdapter.ts`; PlacePicker/지도 선택의 실제 소비. 검색어에 개인 주소가 포함될 수 있음 | [Local 개발 가이드](https://developers.kakao.com/docs/ko/local/dev-guide)의 키워드/주소/좌표→주소·행정구역 API 절. 카카오 사용자 OAuth 정보를 받는 로그인 API와 구별 |
| Maps JavaScript 지도 | 앱 WebView→지도 SDK/리소스. JS key, 지도 중심/marker/geometry를 SDK 객체로 전달. `KakaoRouteMap.tsx`, `NearbyBrowseMap.tsx` | [Maps Web 가이드](https://apis.map.kakao.com/web/guide/) 시작하기의 앱·키/도메인 등록. marker 전부의 서버 전송을 입증한 패킷 감사는 아님 |
| 카카오맵 REST 도보·대중교통 경로 | 앱 JWT/private 좌표 또는 public ID/version→Supabase Edge→Kakao. `kakaoRouteRequest.ts`는 GET `/v2/routing/walk`, `/v2/routing/publictraffic`, start/end x/y 및 input/output WGS84, 서버 REST 인증. Kakao에는 JWT/계정ID/약속 날짜·시각을 추가하지 않음 | [카카오맵 REST 문서](https://developers.kakao.com/docs/ko/kakaomap/rest-api)의 도보·대중교통 경로 조회 절과 endpoint 일치. **일반 카카오맵 앱 이용약관이나 별도 Kakao Mobility 자동차 Directions 상품으로 대체하지 않음** |
| 외부 카카오맵 열기 | 명시 길찾기 버튼→앱 scheme/HTTPS. 코스는 구간 양 끝점·수단, 주변은 목적지-only. `execution/schedule.ts`, `nearbyDirections.ts` | API 응답 가공과 외부 서비스 이용을 분리. [Kakao 개인정보방침](https://www.kakao.com/policy/privacy) §5·6·10은 외부 서비스의 일반 파기/위치/문의 근거이지 위 REST 로그의 개별 처리 계약을 대신하지 않음 |

### 개발자 계약의 명시 조항

[Kakao 플랫폼 서비스 약관](https://developers.kakao.com/terms/ko/site-terms)은 제1조에 (주)카카오, 제2조에 개발자 서비스/회원/API, 제5조에 동의·신청·승낙에 의한 가입을 규정한다. 제7조는 **개발자 회원** 개인정보 보호이며 앱 최종 이용자 좌표 전체의 수탁 계약이라는 근거가 아니다. 제11조⑦·⑧은 사용자 데이터 수집/분석 기술·API로 카카오에 제공한 데이터가 개인정보이면 제3자 제공 동의를 요구한다. 이 조항의 **Local·Maps·routing 요청별 적용 여부**를 확정하지 않은 채 모두 위탁 또는 모두 제3자 제공이라고 단정하지 않는다. 제12조는 플랫폼/서비스 API 구분과 별도 신청 안내를 둔다.

[개발자 운영정책](https://developers.kakao.com/terms/ko/site-policies) 제1조는 개발자의 개인정보 보호·보안 의무, 제5조13·17호는 소유권 고지 삭제/로고 변경 금지, 제5조20호는 UX 개선 목적의 cache 및 최신성 조건을 둔다. 지도/경로 표시·cache 사용을 검토할 기준이며 공급자의 요청 로그 보유 일수를 정한 조항은 아니다.

개발자 약관이 연결하는 [카카오비즈니스 개인정보 안내](https://business.kakao.com/policy/privacy/)는 이번 웹 도구에서 본문을 얻지 못했다. 소비자 방침으로 조용히 대체하지 않았다. Kakao 일반 개인정보방침 §6의 이용·제공사실 확인자료6개월은 **원시 API 좌표/SDK 접속 로그 전체6개월**이라는 뜻이 아니다. §10의 개인정보보호부서/고객센터1577-3754가 공개 문의 경로다. 실제 API별 로그 목적·국가·보유/backup 예외 및 개별 계정의 계약 적용은 미확인이다.

**역할 판정을 위해 남길 질문 하나(발송하지 않음):** “짜투리의 해당 Developers 앱에서 Local 검색어·좌표, Maps SDK 신호, walk/publictraffic 출발·도착 좌표를 처리할 때 각 상품은 운영자 지시에 따른 처리위탁인지 카카오 독자 목적의 제공인지, 플랫폼 약관 제11조⑦·⑧ 적용 여부를 어떤 상품별 계약/처리 안내로 확인할 수 있습니까?”

## 3. Turnstile·Worker production 판정

| 증거 층 | 확인 사실 | 판정 한계 |
| --- | --- | --- |
| 빌드 입력 | `scripts/release-build.cjs`: public URL 필수 HTTPS, proxy=true, production/EXPO_NO_DOTENV=1, 내부4 flag=false. CAPTCHA URL은 allowlist에 유지 | 원격 host 소유권·widget 연결 확인 아님. 이번 env 재수집0 |
| 기존 export | ICON-01의 public iOS export PASS,37파일 audit에서 Supabase/CAPTCHA 입력 포함 확인. JS SHA256 `aadf0a6802364eaf79fc405f3e780588cc3603bc111e5505720f910fdb654605` | 기존 인계 재사용이며 이번 재생성/재검사0. 이전 Development Archive·설치 앱과 같은 코드라고 주장하지 않음 |
| 공개 추천 entry | `TimeSetupScreen.tsx:230`→`recommendationGateDecision`: proxy=true+session 없음+유효 URL이면 CAPTCHA, session 있으면 재사용, URL 없으면 fail-closed. `CaptchaVerificationSheet`가 URL WebView를 열고 성공 token을 adapter→`routeProxyProductionPorts.ts`의 Supabase signInAnonymously에 전달 | 새 anonymous Auth는 조건부 실행. 매 추천마다 Worker를 호출한다고 설명하지 않음 |
| 일반 로그인 entry | Home/Profile→LoginScreen, 로그인 submit→CaptchaVerificationSheet→AuthContext→`signInWithFreshCaptcha`→Supabase password 로그인. `LoginScreen.tsx:109,141` | 추천 anonymous에만 쓰이는 개발 도구가 아님. 가입·메일 flow 전체를 동일 CAPTCHA 흐름으로 확대하지 않음 |
| Worker 구현 | `cloudflare/captcha-worker/src/index.ts`: binding 기반 cf-turnstile, callback으로 token 전달, no-store 응답. wrangler의 기존 Worker명 유지 | no-store는 Cloudflare 플랫폼 로그/신호 보유0 보장이 아님 |

따라서 R1의 ‘production 미활성이면 처리 대상 제외’ 조건을 현재 앱 구성에 근거 없이 적용하면 안 된다. **출시 구성상 조건부 사용 확정 / 최종 운영 실행·설정 확인 미완**으로 문서에 반영한다. Cloudflare Pages는 별도로 예정된 공개 문서 호스팅이며 Worker 사용 근거가 Pages 게시 완료를 뜻하지 않는다.

공식 [Self-Serve Agreement](https://www.cloudflare.com/terms/) §20은 Cloudflare, Inc.와 연락 경로를 명시한다. [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) §3.1 및 Annex1은 processor 의무, 고객 서비스의 콘텐츠/로그 처리 및 데이터 수입자 Cloudflare, Inc.를 기술한다. 표준 공개 DPA를 읽었다고 짜투리 계정의 별도 계약 체결을 주장하지 않는다. [Turnstile 안내](https://www.cloudflare.com/turnstile-privacy-policy/) §4는 사이트 보호 시 processor, 탐지 개선 시 controller를 구분하고 문의처 `dpo@cloudflare.com`을 명시한다. IP·UA·TLS/site 신호를 처리하며 고정 보유 일수·이 계정의 처리 국가·log drain은 미확인이다. 미국 법인 주소를 모든 처리 국가로 대체하지 않는다.

## 4. TMAP·ODsay 최신 도달성

1. **새 public 정상 시작:** Home→TimeSetup→`recommendationPortsFor`의 proxy=true→activated port. 실패 시 throw하며 legacy port로 fallback하지 않는다(`v1Session.ts:247`). 장소 입력은 Kakao-only adapter다. `placeSearchSuggestionAdapter`의 dual-provider 함수 존재만으로 현재 PlacePicker의 TMAP 전송을 주장하지 않는다.
2. **과거 확인 entry 교정:** CourseConfirm의 명시 no-record는 현재 `recorded ? 'record' : 'home'`, 취소도 Home. MyCourses로 향하던 OPS-02 경로는 더 이상 현행 근거가 아니다. EXIT-03의 실제 화면 reset fixture 인계를 재사용한다.
3. **등록/기존 상태:** App의 MyCourses/Execution/LegacyResults 등록은 유지. Execution 헤더·파라미터 누락 버튼→MyCourses, 기존 일반 계정 저장 코스 선택→Execution→geometry hydration의 precompute/precomputeTransit→TMAP/ODsay, 명시 재계산→baseline/planTimeFit→LegacyResults 경로는 남는다. 저장 목록은 account owner scope가 필요하다. cache/키/limit 조건에 따라 HTTP0일 수 있다.
4. **그 상태로 들어가는 조건:** Home의 activeCourse projection은 값이 있을 때 Execution을 연다. 그러나 activeCourse는 AppFlowContext에서 null로 초기화되고 writer는 legacy Execution/OneStopResults다. 읽은 코드에서 savedCourses 로드가 activeCourse를 자동 설정하지 않는다. 공개 탭은 MyCourses를 직접 열지 않는다. NavigationContainer의 일반 linking/initialState 복원도 없으며 AuthContext의 URL listener는 인증 링크 처리, LA pending bridge는 verified CourseConfirm 연결이다. 따라서 **현재 clean public cold start에서 legacy로 들어가는 새 사용자 이벤트는 추적 범위에서 발견하지 못했다**. legacy 활성 세션/내부 flag=false 입력까지 도달 불가로 확대하지 않는다.
5. **최종 판정:** 최신 소스의 일반 공개 동선은 legacy와 분리된 근거가 강화됐다. OPS-02의 ‘실패 분기로 공개 도달 확정’은 철회된 경로 설명이다. 다만 이번에는 최종 distribution artifact·업데이트 중 기존 상태를 전수 검증하지 않았으므로 **모든 production TMAP/ODsay 전송0 확정 또는 공개 수신자 무조건 삭제는 인계하지 않는다**. 최종 후보에 EXIT-03 반영·proxy=true·nav 초기화/기존 저장 상태 격리를 QA가 확인하면 통합/DOCS가 수신자 제외 여부를 확정한다. 실제 provider 호출을 새 승인 조건으로 요구하지 않는다.

## 5. 문서 담당에게 넘길 정확한 공백

| 대상 | 이번에 닫은 필드 | 계정 화면/자료가 필요한 필드 | 해석·승인 잔여 |
| --- | --- | --- | --- |
| Kakao | 실제 상품 Local/Maps SDK/Maps REST routing 구분, 공개 계약 주체·제11조 조건, 개인정보 일반 보유와 API 로그 구분 | 해당 Developers 앱의 사용 상품/권한, 약관 적용 버전·동의/승낙 근거 또는 별도 계약 유무; 상품별 처리 안내의 요청 로그 목적/보유/국가. JS 도메인과 앱 연결은 기존 OPS 설정 요구 재사용 | §2의 한 질문으로 위탁/제3자 제공 적용 확인. 위치 문의 답변이 이 계약 문제까지 해결하는지 따로 판단 |
| Cloudflare 보안 | production 입력 및 공개 추천/로그인 소비, processor/controller 목적 구분, 공개 법인/문의처 | 해당 계정의 적용 Self-Serve/별도 계약·DPA 버전, Worker route↔widget 연결/허용 host 일치, 플랫폼 로그·drain/보유 및 실제 지역·subprocessor 적용 | ‘미사용’으로 제외 불가. 계정 근거와 한국법상 고지 분류 결합 필요; 공개 DPA의 일반 역할만으로 모든 고지 필드 확정 금지 |
| TMAP/ODsay | 과거 공개 진입 폐쇄와 남은 legacy 조건 분리 | 최종 후보의 proxy/EXIT-03 반영·기존 상태 격리 증거. 도달 가능으로 판정될 때만 제품 계약/법인/보유/국가 확인 | 도달성 조건부 유지하되 과거 실패 경로를 현재 사실로 복사하지 않음 |
| Supabase / Pages | 이 작업의 보안 흐름과 분리 | Supabase 계약·지역은 DB-NOTICE-01, Pages 예정 호스팅은 DOCS-06 A 인계 | 중복 계약 조사·프로젝트 생성0 |

설정 근거는 위 항목만 **한 묶음**으로 요청한다. 키·token·계정 식별자·계약 서명/개인 주소·메일 원문 없이 버전/유무/일치 여부와 공개 조항만 전달하면 된다. 접근 불가 필드를 임의 값으로 메우지 않았다. 위치 답변 전 가능한 API 독립 조사는 완료했으며, 문의 발송·법률 판정·게이트 해제·최종 게시 승인은 하지 않았다.

## 6. 네 항목 인수인계

1. **변경 파일:** `docs/work/external-api/release-notice-facts.md`만 신규 작성. 기존 사실 기록/README/보드/publish/기능·설정·타 역할 파일 변경0.
2. **유지 계약:**180분/2곳·provider·cache·quota·Auth·legacy 정책 유지. 실제 운영 API/Auth/CAPTCHA/DB 호출0, 원격 설정 조회·변경0, 게시/업로드/Archive/계약 동의·문의 발송/commit/push0. 키·사용자 데이터 출력/저장0.
3. **확인 방법·결과:** 공식 공개 조항 및 source/event 추적, 기존 public export 증거 재사용. `node --import tsx --test test/ui/captcha-recommendation-gate-model.test.ts test/ui/password-login-captcha.test.ts test/ui/release-exit-logs.test.mjs test/ui/main-stack-navigation.test.mjs` **8/8 PASS**(네트워크 없는 주입 fixture). 운영 성공·전수 도달성 증거는 아님. 문서 공백 검사 수행; 문서만 변경하여 전체 앱 테스트/빌드0.
4. **남은 위험·다음 담당:** DOCS-06 B가 R1의 Cloudflare 미활성 가능성/legacy 과거 entry를 위 구분으로 갱신. 운영자는 §5 최소 계정 적용 근거, 통합은 Kakao 역할 질문과 위치 답변의 실제 영향, QA는 최종 artifact 경계를 확인. 새 기능 작업을 열거나 게시 차단을 임의 해제하지 않는다.
