# 출시용 외부 API 데이터 흐름 감사

감사일: 2026-09-07 · 담당: 외부 API 어댑터 · 상태: 읽기 전용 감사 완료, 출시 적합성 일괄 승인 아님.

## 범위와 판정 방법

사용자 명령에 따라 현재 공유 작업트리의 앱 진입점, adapter, Edge, Worker, 저장 코드와 migration을 읽고 공식 공개 문서를 대조했다. `.env`·`.env.local`, 키 값, 사용자 데이터, 운영 로그·DB·provider 응답은 열거나 출력하지 않았다. 공식 웹 문서 열람 외 운영 API 호출·배포·설정 변경은 0회다. 이 파일만 작성한다.

- **코드 확정**: 현재 소스가 만드는 요청·저장·표시 경계. 설치된 출시 바이너리와 운영 서버가 같은 버전이라는 뜻은 아니다.
- **공식 확인**: 아래 연결한 provider 공식 문서에서 확인한 조건. TimeFit 계정별 승인·계약을 대신하지 않는다.
- **미확인**: 출시 flag/키 설정, 배포 버전, 계약 예외, provider 내부 보유기간, 삭제 job 실행, 실제 화면 가림 여부. 원격 성공이나 미사용을 추정으로 확정하지 않는다.

## 1. provider별 요청·전송 항목

공통으로 직접 HTTP 요청을 받는 서비스는 접속 IP 등 네트워크 메타데이터를 처리할 수 있다. 아래 payload 목록은 앱이 명시적으로 조립하는 항목이며, SDK 내부 요청 전체를 패킷으로 측정한 목록은 아니다.

| 서비스와 사용 경계 | 요청 주체 → 수신자 | 명시 전송 항목 / 반환값 | 코드 근거·판정 |
| --- | --- | --- | --- |
| Kakao Local 장소·주소 검색 | 앱 → Kakao | `query`, `size`, REST 인증 header. keyword 검색은 현재 중심 GPS를 요청에 넣지 않는다. 이름·주소·좌표·일부 노선 근거를 결과로 사용 | `src/engine/kakao.ts`의 `kakaoGet`, `kakaoPoiSearchMultiResult`, `kakaoAddressSearchResult`; `src/services/kakaoLocationSearchAdapter.ts`; `src/ui/PlacePicker.tsx`. 코드 확정 |
| Kakao Local GPS/지도 핀 라벨 | 앱 → Kakao | `x`, `y` 좌표로 `coord2address`; 정상 빈 주소일 때만 `coord2regioncode` 추가. 주소/행정구역 라벨 반환 | `src/services/kakaoLocationLabelAdapter.ts`, `src/engine/kakao.ts`, `src/ui/TimeSetupScreen.tsx`, `MapPlacePicker.tsx`. GPS 자동 라벨과 명시 핀 확정 경계. 지도 움직임마다 검색한다는 뜻 아님 |
| Kakao walk/publictraffic 경로 | 앱 → Supabase Edge → Kakao | 앱→Edge: mode, scope, mode별 allowance, Bearer session. public은 catalog version·from/to 장소 ID, private은 출발·도착 좌표. Edge는 public ID를 서버 snapshot 좌표로 해석. Edge→Kakao: `start_x/start_y/end_x/end_y`, 입력·출력 좌표계 WGS84, 서버 REST 인증 header. 사용자 ID·JWT·장소명·약속시각·체류시간은 이 provider 요청에 넣지 않음 | `src/ui/recommendation/v1Session.ts`, `src/services/routeProxyClientAdapter.ts`, `routeProxyActivatedCourseAdapter.ts`, `supabase/functions/route-proxy/handler.ts`, `kakaoRouteRequest.ts`. proxy-enabled 출시 경로의 코드 확정 |
| 상세의 endpoint 도보 보충 | 앱 → 기존 Supabase Auth session의 Edge → Kakao walk | private 출발·도착 좌표, walk mode. 새 로그인/CAPTCHA를 만들지 않는 별도 port. 검증된 경로 형상과 안전 결과 반환 | `src/services/privateWalkConnector.ts`, `privateWalkConnectorProduction.ts`; `src/ui/recommendation/courseV1RouteGeometryModel.ts`. 기본 경로와 같은 서버를 쓰지만 메모리 cache 경계는 별도 |
| Kakao Maps JS 지도 | 앱 WebView → Kakao SDK·지도 리소스 | JS app key로 SDK 로드. 지도 중심·bounds·marker 좌표·label·선 geometry를 WebView의 Kakao 객체에 전달. SDK가 viewport용 지도 리소스를 요청 | `src/ui/KakaoRouteMap.tsx`, `NearbyBrowseMap.tsx`. 모든 marker/경로점이 그대로 별도 서버 payload에 전송된다고 단정할 수는 없음. 실제 SDK 텔레메트리·cookie·referrer는 미측정 |
| 카카오맵 외부 열기 | 앱 → 카카오맵 앱 또는 웹 | 선택 장소의 주소 검색어 또는 이름·좌표, 길찾기에서는 양 끝 이름·좌표·이동수단을 URL에 포함 | `src/ui/execution/schedule.ts`, `src/ui/recommendation/courseV1PlacePreviewModel.ts`, `CourseConfirmScreen.tsx`. 명시 행동 시 발생. 브라우저/카카오맵의 URL·이력 보유는 TimeFit 메모리 TTL과 별개 |
| Supabase Auth | 앱 → Supabase | anonymous 생성의 CAPTCHA token, 일반 가입/로그인의 이메일·비밀번호, 이메일 확인 code/token, refresh/access session. Edge는 `auth.getUser(token)` 검증 | `src/services/supabase.ts`, `routeProxyProductionPorts.ts`, `src/ui/AuthContext.tsx`. 토큰의 값은 감사하지 않음 |
| Supabase 코스 저장 | 앱 → Supabase DB API | 저장 경로에서 user ID, 출발·목적지 label/좌표, 시작·종료 시각, mode, 이동·체류·buffer, 추천 snapshot 및 stop/leg rows. 조회·코스 삭제·계획 교체도 존재 | `src/services/courseRepository.ts`, `src/ui/AppFlowContext.tsx`, `MyCoursesScreen.tsx`. 모든 V1 추천이 자동 서버 저장된다는 뜻은 아님. repository는 `getUser`의 ID를 확인하므로 일반 로그인만이라는 보장은 UI/RLS까지 필요 |
| Cloudflare Worker·Turnstile | 앱 WebView → Worker/Turnstile, token은 앱 → Supabase Auth | Worker는 CAPTCHA HTML 제공. widget sitekey·origin, 브라우저 신호 처리; token은 bridge callback으로 앱에 전달 후 Auth 요청에 사용 | `cloudflare/captcha-worker/src/index.ts`, `src/ui/CaptchaVerificationSheet.tsx`, `captchaVerificationModel.ts`, `routeProxyProductionPorts.ts`. Worker 코드 자체는 token 검증·저장·provider 전달을 하지 않음. 실제 challenge URL 설정은 미확인 |
| 한국관광공사/부산 사진 호스트 | 앱 Image 및 지도 사진 marker → 이미지 호스트 | 번들 카탈로그의 이미지 URL로 이미지 요청. 코드가 GPS/JWT를 사진 요청에 추가하지는 않음. 호스트에는 IP·리소스 식별자 등 요청 메타데이터가 도달할 수 있음 | `src/ui/PlaceDetailScreen.tsx`, `NearbyBrowseScreen.tsx`, `recommendation/CourseV1SummaryCard.tsx`, `CourseV1VerticalDetail.tsx`, `KakaoRouteMap.tsx`. TourAPI JSON 조회와 사진 다운로드를 구분 |

공식 요청 규격은 [Kakao Local REST 가이드](https://developers.kakao.com/docs/ko/local/dev-guide), [Kakao Maps REST API의 도보·대중교통 경로](https://developers.kakao.com/docs/ko/kakaomap/rest-api), [지도 SDK 및 링크 가이드](https://apis.map.kakao.com/web/guide/)에서 확인했다. 현재 경로 endpoint는 공식 문서에 존재한다. account 권한·허용량·출시 도메인 등록은 별도 미확인이다.

### 레거시·빌드 단계 사용을 출시 기본 흐름과 구별

- `v1Session.ts:recommendationPortsFor`는 proxy flag가 false이면 `createLegacyRoutes()`를 선택한다. `App.tsx`에는 `LegacyResults`와 `Execution`이 여전히 등록돼 있고, `MyCoursesScreen.tsx`에는 저장 코스→Execution 이동이 있다. `ExecutionScreen.tsx`는 실제 `precompute`/`precomputeTransit` 및 LegacyResults 재계산 코드를 호출한다. 따라서 **현재 소스만으로 앱 전체 TMAP·ODsay 미사용은 확정할 수 없다**. 최종 flag·실제 저장 코스 접근 가능성·출시 번들의 gate 확인이 필요하다.
- TMAP 조건부 앱 직접 요청: `src/engine/travel.ts:tmapTravel`의 출발·도착 좌표, WGS84 좌표계, 고정 출발/도착 이름, 차량 옵션, appKey header. 도보/차량 endpoint와 검색·지오코딩 코드도 존재한다. [TMAP 공식 가이드](https://tmapapi.tmapmobility.com/main.html)는 확인했지만 현재 계정 계약·저장 허용기간·타사 지도 위 경로 표시 허용의 조항은 이번 열람으로 확정하지 못했다. TMAP 대중교통 API는 이 코드의 ODsay 요청과 다른 서비스다.
- ODsay 조건부 앱 직접 요청: `travel.ts:odsayTransit`는 `SX/SY/EX/EY`, `SearchType`, apiKey를 query로 전송한다. [공식 ODsay 가이드](https://lab.odsay.com/guide/guide)에서 해당 좌표 규격을 확인했다. 출시 요청 발생 여부·계정별 보유조건은 미확인이다.
- TourAPI: V1 후보는 `src/data/courseV1CandidateProvider.ts`가 번들 카탈로그·로컬 운영시간 JSON을 읽는다. 기본 V1 추천에서 실시간 TourAPI fetch를 확인하지 않았다. `src/engine/tourapi.ts`에는 레거시 위치 기반 검색(좌표·반경·page/rows), 상세(콘텐츠 ID/type), 공통 MobileOS/MobileApp 및 query 인증키 전송이 남아 있고 planner가 상세 함수를 참조한다. `scripts/audit_tourapi_images.mjs`는 빌드/데이터 감사용 상세 조회 코드다. 이번에 실행하지 않았다. [공식 국문 관광정보 서비스](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578)는 JSON API의 존재 근거이며 개별 사진 이용권의 증명은 아니다.

## 2. 캐시·로그·보유·삭제

| 대상 | 코드로 확정된 보유·삭제 | 미확인 / 주의할 해석 |
| --- | --- | --- |
| 장소 검색 | 앱 Map, 기본 10분·최대 100개, 정규화 검색어 key·검색 결과; 만료 항목 접근 시 삭제, 용량 초과 eviction, in-flight 합류 | 10분은 재사용 유효기간이며 타이머로 정확히 그 순간 메모리를 지우는 계약 아님. provider의 query 로그 삭제와 무관 |
| 좌표 라벨 | 앱 Map, 기본 10분·64개, 소수점 정규화 좌표 key·주소/지역 결과; lazy expiry·eviction | 화면/adapter 생존기간 및 OS 메모리 처리는 별도. provider 원본 좌표 처리의 보유기간 미확인 |
| public route server cache | handler 기본 TTL 900,000ms(15분), env override 가능. provider/mode/방향성 장소 ID/catalog version key, 분 단위 시간·정제한 geometry steps. public cache에 JWT·private 요청 좌표를 key/payload로 넣지 않음 | 기본값을 운영 실측값으로 쓰지 않음. `202608270010_route_proxy_store.sql`, `202609030014_route_proxy_geometry_cache.sql`의 expiry 조회 제외와 purge 함수는 존재하지만 스케줄 실행·실제 물리 삭제 시점 미확인. SQL의 최대 허용 expiry는 24시간이며 24시간 보유 자동 보장이 아님 |
| lease·provider 예산 | `202608270011_route_proxy_fetch_lease.sql`: 완료/release 시 lease 삭제, 만료 lease purge 함수. daily/second budget은 provider+mode+시각별 집계 | 미사용/과거 예산 row와 lease의 운영 청소 주기 미확인. cache-only miss는 provider/reserve/lease 시작 0의 로컬 계약이나 배포 일치 여부 미확인 |
| private route / connector | Edge private은 public cache·lease 영속 경로 제외. connector는 프로세스 메모리 10분·64개 및 in-flight, dispose 시 clear | **Edge 비영속을 앱 전체 비영속으로 일반화하면 안 됨.** 일반 검증 course에는 private leg geometry가 들어갈 수 있고 아래 진행 snapshot 저장이 존재 |
| 진행·완료·후기 로컬 저장 | `src/ui/activeVerifiedCourseStorage.ts`는 session/course/progress 전체를 AsyncStorage에 JSON 직렬화하며 geometry 제거·TTL이 없음. `AppFlowContext.tsx`는 활성 상태 저장·종료 정리 경계를 호출. 완료 repository는 장소 ID/명칭/category·완료시각·체류 등을 최대 1,000개 보유하고 clear 제공; 후기 역시 최대 1,000개 | 기본 경로 geometry가 들어 있는 snapshot은 저장될 수 있음. 별도 상세 connector 메모리 결과와 구분해야 함. 모든 종료/오류/복원에서 삭제되는지, 기기 backup·App Group까지의 최종 삭제 보장은 본 API 감사에서 미검증 |
| Supabase session·계정·코스 | `supabase.ts`: AsyncStorage persistSession·autoRefreshToken. signOut 제공. 코스 delete API 존재. anonymous cleanup 함수 및 migration은 30일 비활성·연결 데이터 재확인 후 Admin 삭제, 실행당 최대 100 후보, 집계 audit | 로그아웃은 계정 삭제와 다름. 일반 회원 탈퇴의 end-to-end 삭제 경로, 서버 코스 TTL, backup 삭제, cleanup scheduler 실행은 확인 못함. anonymous는 이메일이 없다는 뜻이지 서버 user ID가 없다는 뜻 아님 |
| CAPTCHA | Worker 응답은 no-store, token은 일회 callback 전달 구조이며 앱 token 로그·영속 저장 코드 없음 | CAPTCHA WebView는 domStorageEnabled. cookie/WebView 저장소와 Cloudflare 내부 로그의 실제 수명은 별도 미확인 |
| 지도·사진 | 앱의 원본 이미지 다운로드·지도 SDK/타일 표시. 자체 사진 삭제/TTL 관리 코드 확인 못함 | RN Image/WebView·HTTP cache·CDN의 보유기간은 측정하지 않음. URL을 번들에 넣은 것과 사진 bytes의 저장기간은 다름 |
| 레거시 경로 | `travel.ts`의 route/transit Map TTL 24시간, lazy expiry. 일별 호출 집계는 AsyncStorage. **`markRouteCall`/`markOdsayCall`은 출발·도착 좌표를 console.log에 포함하며 해당 함수에 development guard가 없음** | 코드의 “약관상 24시간” 주석은 공식 약관 확인을 대신하지 않음. 출시에서 이 branch가 실행되면 안전 enum-only 로그라는 설명이 성립하지 않음. 실제 로그 값은 열람하지 않음 |

추가 로그 경계: `kakao.ts` 개발 로그는 provider/status/결과 수 집계이며 검색어 원문 출력은 없다. Route Proxy index/handler에는 직접 원문 console 로깅을 확인하지 않았고, rate guard는 token SHA-256 일부를 instance 메모리 key로 써 60초 경과 항목을 후속 요청에서 정리한다. 반면 `AuthContext.tsx`에는 오류 객체/메시지를 그대로 경고 로그로 보내는 경로가 있어 전 앱 로그가 안전 enum으로 제한된다고 확정할 수 없다.

[Supabase Edge 로그 문서](https://supabase.com/docs/guides/functions/logging)는 플랫폼 실행·요청 로그를 별도 제공한다. 앱 console이 없어도 플랫폼 로그가 0이라는 뜻은 아니다. [요금별 보유 안내](https://supabase.com/pricing)는 로그·backup 기간이 플랜에 따라 다름을 명시한다. TimeFit 플랜·로그 drain·region·backup/PITR·삭제 설정은 확인하지 않았다. [anonymous 공식 문서](https://supabase.com/docs/guides/auth/auth-anonymous)는 자동 계정 정리를 기본 제공하지 않는다고 설명하므로 저장소의 cleanup 구현만으로 운영 삭제를 확정하지 않는다.

[Turnstile 개인정보 안내](https://www.cloudflare.com/turnstile-privacy-policy/)는 IP, TLS fingerprint, User-Agent, sitekey와 origin 신호 처리를 명시하며 고객을 위한 bot 차단 처리와 자체 탐지 개선 목적의 역할을 구별한다. 따라서 “CAPTCHA는 개인정보를 전혀 처리하지 않는다”는 표현은 부정확하다. 이 문서에서 TimeFit에 적용할 일률적인 숫자 보유기간은 확인하지 못했다. Kakao·사진 호스트·TMAP·ODsay의 요청 로그 보유/삭제 주기도 미확인이다.

## 3. 지도·사진·경로 표시와 출처

### 지도·경로

- 코드 확정: `KakaoRouteMap.tsx`는 공식 JS SDK 지도에 marker와 `Polyline`을 그린다. 도보/대중교통의 색·선 종류와 사용자 overlay는 앱이 결정한다. 원본 지도 타일을 자체 서버에 저장하는 구현은 확인하지 않았다. `originWhitelist=['*']`가 있어 지도 WebView의 실제 하위 리소스/이동 범위를 추가 검증할 필요가 있다.
- 공식 확인: [Kakao 현행 운영정책](https://developers.kakao.com/terms/ko/site-policies) 제5조는 저작권·상표 등 고지 삭제, 로고 변경을 금지하며 캐시는 사용자 환경 개선 목적과 최신성 유지 조건을 둔다. “15분이면 무조건 허용”이라는 정량적 예외 조항은 확인하지 못했다.
- 미확인: 지도 logo/copyright를 지우는 명시 코드는 확인하지 않았으나 앱 overlay·sheet에 의해 출시 화면에서 가려지지 않는지는 실기기 확인이 필요하다. 경로 geometry 정제·공유 cache·장기 진행 snapshot 저장에 대한 계정별 계약 허용 여부와 별도 경로 출처 문구 의무는 확인 못했다. 일반 map SDK 허용만으로 모든 경로 데이터 재배포를 승인하지 않는다.
- Kakao 공식 응답의 landing URL을 handler는 공개 응답으로 보존하지 않고 앱이 링크 가이드에 맞는 URL을 구성한다. 공식 문서의 landing URL 존재는 확인했지만 원본 URL을 그대로 사용해야 한다는 의무까지 확인한 것은 아니다.
- 조건부 ODsay 사용 시 [공식 상표사용가이드](https://lab.odsay.com/guide/guide)의 결과/설명 페이지 표기와 권리 귀속 조건을 적용해야 한다. 가이드는 이미지 또는 `powered by www.ODsay.com` 텍스트 예시를 제공한다. 출시의 해당 페이지 충족 여부는 미확인이다. TMAP의 표시·캐시 조항도 계정에 적용되는 공식 계약 확인이 남았다.

### 사진·관광 데이터

- 공개 번들 `src/data/busan_poi_catalog.json`을 값 대신 image field/호스트/출처별 **집계만** 확인했다. 이미지 URL 406건: `tong.visitkorea.or.kr` 146건, `www.visitbusan.net` 260건. imageSource는 각각 `tourapi`, `busan_official`이고 관련 필드는 `imageUrl`, `imageSource`, `imageEvidence`다. 이는 전체 번들 집계이며 현재 추천 대상 수·화면 노출 수·고유 저작물 수가 아니다.
- `courseV1PlacePreviewModel.ts`는 출처 label을 만들지만 `CourseV1PlacePreview.tsx`/`ExplorationPlaceCard.tsx`에서는 주로 accessibilityLabel에 사용한다. `CourseV1SummaryCard.tsx`, `CourseV1VerticalDetail.tsx`, `PlaceDetailScreen.tsx`, `NearbyBrowseScreen.tsx`의 사진 표시 경로에서 모든 사진에 보이는 저작자·원문 링크·허락 유형을 표시하는 처리는 확인하지 못했다. 일부 Image는 `accessible={false}`다. **출처 데이터 존재나 접근성 label만으로 시각적 출처 표기 완료를 판정하지 않는다.**
- [공공누리 공식 이용허락 안내](https://www.kogl.or.kr/info/license.do)는 출처표시를 기본으로 유형별 상업 이용·변경 조건을 구별한다. 다만 해당 사진에 실제 어떤 허락이 붙었는지가 선행돼야 한다. '공공기관 호스트', '공식 사진', TourAPI 응답 URL이라는 이유만으로 모든 사진을 제1유형·자유 변경 가능으로 취급할 수 없다.
- 한국관광공사 공식 API 데이터셋 페이지는 열람했으나 개별 146건 사진의 권리자·유형·출처문구·thumbnail crop 허용을 확인하지 않았다. 관광콘텐츠랩 홈페이지는 도구가 본문을 추출하지 못했다. Visit Busan 홈페이지도 확인했지만 사진별 권리와 적용 저작권 정책 본문을 확보하지 못했다. 이 부분은 **미확인**으로 남긴다. 부산광역시 일반 정책을 Visit Busan 개별 사진 허락으로 대체하지 않는다.
- 출시 전 데이터 담당은 사진별 허락 근거(권리자·저작물·원문·유형·변경/상업 조건)를 확정하고 UI 담당은 그 조건에 맞는 보이는 출처 표기를 검토해야 한다. 감사에서는 사진·데이터·UI를 변경하지 않았다.

## 4. 출시 전 확인 우선순위

1. **실제 provider 범위:** 최종 proxy flag와 legacy 저장 코스/Execution 진입 여부를 확정한다. 잔존 코드만으로 운영 사용이라고 단정하지도, 기본 V1 provider만 보고 전 앱 미사용이라고 선언하지도 않는다. API·UI·QA 담당.
2. **보유·로그 고지:** private server 비영속, 앱 진행 snapshot 영속, provider 로그를 구분한다. legacy 좌표 console 및 Auth 원문 오류 출력의 출시 노출 여부, 계정·코스·로컬 이력의 삭제 범위와 주기를 확인한다. API·DB·UI 담당.
3. **운영 삭제 증거:** cache/lease purge, anonymous cleanup schedule, 실제 TTL override, backup·로그 보유와 region을 비밀 없는 설정 증거로 확인한다. 이번 감사에서 원격을 조회하지 않았다. DB·출시 담당.
4. **콘텐츠 권리:** 사진별 허락과 시각적 출처, 지도 logo 가림, Kakao 경로 cache/geometry 저장의 적용 계약을 확인한다. legacy가 열려 있으면 TMAP/ODsay 계약·출처도 포함한다. 데이터·UI·통합 담당.

## 인수인계

- **변경 파일:** `docs/work/external-api/release-api-audit.md` 신규 작성. provider별 흐름·보유·표시 조건 및 미확인 사항 기록.
- **유지한 계약:** 보드, 코드, 설정, 다른 역할 문서, 키, 운영 데이터 불변. 배포·API 실호출·실기기 실행·캐시 삭제 0회.
- **테스트 결과:** 정적 호출·저장·로그·표시 경로 추적과 공식 문서 대조, 공개 카탈로그 호스트/출처 집계 완료. 코드 변경이 없어 기능 테스트는 실행하지 않았다. `git diff --check` 통과. 신규 문서는 아래 최종 공백 검사 대상으로도 확인했다. runtime 정상·약관 완전 준수·삭제 완료 판정은 하지 않았다.
- **다음 결정·위험:** 위 네 출시 확인 항목이 남는다. 본 감사는 수정·원격 검증 작업을 자동 개시하지 않는다. 특히 사용자 고지에 “카카오만 사용”, “좌표는 저장하지 않음”, “15분 후 완전 삭제”, “공공 사진 자유 사용”을 현재 근거로 확정해서는 안 된다.
