# 짜투리 출시 데이터 처리 사실표

공개 문서 호스팅 현행값(2026-09-09): Cloudflare Pages 프로젝트 `jjaturi-docs` Production에 승인된 정적7파일을 게시했다. 실제 기본 주소는 `https://jjaturi-docs.pages.dev`이며 공개 페이지 요청 과정의 Cloudflare 처리는 개인정보처리방침 제3절에 반영했다. DB registry·앱·Connect 연결은 아직 수행하지 않았다.

기준일: 2026-09-09
상태: 내부 검토용. 현재 공유 작업트리의 구현과 최신 인수인계를 기준으로 한다. 015·016·017 운영 적용과 승인된 개인화 C 1회 결과, native 개인정보 명세·진단 clock 로컬 보완을 확인했다. `delete-account`는 ACTIVE/v1·verify_jwt=true·승인 소스 일치·무인증 401까지 확인했지만 실제 탈퇴 E2E는 미실행이다. Distribution IPA·최종 후보 검증도 실행되지 않았다.

## 현행 정정 — RELEASE-PROVIDER-MIN-01·QA-ODSAY-REMOVE-01

- Supabase는 인증·DB·Edge Function 처리위탁, 계약상 싱가포르 수령자로 공개한다. 주 DB와 `route-proxy`의 서울 기본 지역은 국외 계약 수령자와 구분한다. 보유는 DPA의 계약 기간 또는 더 이른 삭제 요청, 계약 종료 후 30일 반환 기간 뒤 사본 삭제 기준을 사용하며 공급자 보안 로그의 정확한 물리 삭제일을 임의로 약속하지 않는다.
- Cloudflare는 Turnstile 사이트 보호 처리위탁과 bot 탐지 개선 목적의 독자 처리를 함께 공개한다. 계약 수령자는 미국이며 미국·EEA 중심 저장과 글로벌 이전·접근 가능성, DPA와 Privacy Policy의 보유 기준을 사용한다. Turnstile token 5분을 전체 로그 보유기간으로 확대하지 않는다.
- ODsay 신규 HTTP 요청·키 읽기·신규 저장은 고정 fixture에서 0으로 수락했다. 과거 저장 코스의 ODsay provider·분·geometry 표시는 읽기 전용 호환이며 현재 외부 전송이 아니다. 아래 과거 조건부 표기는 당시 이력으로만 읽는다.
- QA 자동 결과는 소스·fixture 수락이다. 최종 iOS release bundle/export/Archive의 ODsay URL·키·query builder·usage write·신규 attempt 부재 검증은 아직 남아 있다.

## 판정 범례

- **현재 구현:** production entry에서 호출되는 코드가 있다.
- **기기 전용:** 앱 또는 iOS 저장소에서만 처리하며 앱 코드에 서버 업로드 경로가 없다.
- **검증 제한:** 구현 또는 특정 운영 경로는 확인했지만 최종 artifact·실기기·운영 설정 전체가 미검증이다.
- **미확인:** 운영 대시보드, 공급자 계약 또는 최종 Release artifact 없이는 확정할 수 없다.

## 데이터 흐름

| 항목 | 수집·생성 entry | 기기 처리 | 서버·제3자 전송 | 계정 연결 | 보유·삭제 | 상태·근거 |
| --- | --- | --- | --- | --- | --- | --- |
| 이메일·비밀번호 | 회원가입·로그인 | Supabase SDK가 세션 토큰을 AsyncStorage에 지속. 비밀번호 자체를 앱이 별도 저장하는 코드는 없음 | Supabase Auth | Auth 사용자 ID와 연결 | 계정 삭제 성공 시 Auth 사용자 삭제를 시도. Auth·로그·백업의 실제 잔존 기간은 미확인 | 앱 호출과 운영 함수 ACTIVE/v1 확인. 승인 소스·의존성 bundle 대조 및 무인증401 PASS. 실제 계정 탈퇴 E2E는 미실행 |
| 가입 동의 기록 | 가입 화면에서 이용약관·처리방침을 각각 열고 체크 | 가입 요청 metadata에 문서 ID·버전·요청 ID 포함 | Supabase Auth 및 DB consent registry | 사용자 ID와 연결 | 계정 cascade 설계. 운영 문서 registry와 실제 URL은 미등록 | 구현·운영 schema 적용. 공개 문서 URL/active registry 연결은 미완료 |
| 닉네임 | 로그인 사용자가 선택 입력 | 화면 상태 | Supabase `profiles` | 사용자 ID와 연결 | 비워 저장하면 삭제; 계정 삭제 시 cascade | 구현·운영 schema 적용. 최종 계정 E2E는 별도 게이트 |
| 사용자 ID·세션 | 일반 또는 경로 프록시용 anonymous Auth | access/refresh session 지속 | Supabase Auth, Edge 요청 JWT | 일반 회원 또는 anonymous 식별자 | 일반 계정은 앱 내 삭제 entry와 운영 함수가 연결됨. anonymous 정리 scheduler의 운영 활성은 미확인 | 삭제 endpoint ACTIVE/v1; 정상 JWT·AMR·cascade·기기 정리 E2E는 미확인 |
| 기기 GPS 좌표 | 출시 앱에는 수집 entry 없음 | 위치 권한·GPS snapshot을 새로 만들지 않음 | 전송 없음 | 해당 없음 | 해당 없음 | QA-RELEASE-MANUAL-LOCATION-01의 권한/GPS trap 호출0, Release plist 위치 usage key0, ExpoLocation0 |
| 수동 검색어·주소·선택 좌표 | 출발지·약속 장소 검색 또는 지도 핀 | 검색 결과 메모리 cache 10분/최대 100개, 주소 라벨 10분/64개. 선택 결과는 진행 상태에 포함 가능 | 검색어는 Kakao Local로 전송하며 현재 keyword 요청에 GPS 중심좌표를 넣지 않음. 선택 좌표가 경로에 쓰이면 Supabase Edge·Kakao에 전송 | 코스 저장 시 계정 연결 가능 | 앱 cache는 lazy expiry. 검색어가 개인 주소일 수 있으며 공급자 로그 보유는 미확인 | 현재 구현 |
| 경로 요청·결과 | 추천 검증·상세 경로·카카오 길찾기 | 상세 connector 메모리 cache 10분/64개; 활성 코스에는 장소·구간·일부 geometry가 지속될 수 있음 | 현재 추천은 Supabase Edge→Kakao. 공개 POI 경로는 ID/version을 Edge로 보내고 서버 snapshot 좌표를 provider에 전달. 외부 카카오맵은 코스 구간의 이름·좌표·수단, 주변 둘러보기는 목적지 이름·좌표만 전달 | Edge JWT와 연결 가능. public POI cache key/row에는 사용자 좌표·ID/JWT를 넣지 않음 | public cache 기본 유효기간 15분, private 경로는 public cache 제외. TTL은 물리 삭제 보장이 아니며 운영 override·purge·로그 보유 미확인 | 현재 구현 / 운영·최종 Archive 미확인 |
| 저장 코스 | 로그인 사용자가 legacy 저장·교체 경로 이용 | 화면 상태 | Supabase `courses`, `course_stops`, `course_legs`: 출발·목적지 label/좌표, 시작·종료, 이동·체류·여유, 장소와 구간 snapshot | 사용자 ID 직접 연결 | 개별 삭제·탈퇴 cascade, 정기 TTL 없음. 최신 V1 `TimeSetup→Results→CourseConfirm`은 이 저장을 직접 호출하지 않고, 명시적인 기록 없는 종료는 메인으로 돌아가도록 보완됨. 기존 저장 코스 재계산 경로는 여전히 도달 가능 | EXIT-03 자동 회귀 완료·실기기 최종 후보 대기. legacy 저장/전송 전면 제거로 해석하지 않음 |
| 비로그인 완료 기록 | `코스 마치기` | 장소 ID·명칭·분류·완료 시각·선택적 체류를 기기에 최대 1,000건 | 자동 서버 전송 없음 | 계정과 연결하지 않음 | 가져오기 성공 항목은 기기 guest 목록에서 제거. 전체 삭제 UI는 확인되지 않음; 앱 삭제·OS 정책 외 기간 미정 | 현재 구현: `courseCompletionRepository.ts`, `ActivityRecordScreen.tsx` |
| 계정 완료 기록 | 로그인 중 명시 완료 | 동기화 대기와 owner snapshot을 기기에 저장 | 완료 ID/run ID, 분 단위 완료시각, generation, 1~2곳 ordinal/ID/이름/분류를 Supabase RPC로 전송. 좌표·원시 도착/출발·실제 체류는 이 payload에 없음 | 사용자 ID 직접 연결 | 개별·전체 기록 삭제, 탈퇴 cascade. tombstone/generation/mutation 일부는 재등록 방지용으로 유지 | 구현·운영 schema 적용. C에서 합성 runtime 완료3건 저장·정리 확인 |
| guest 방문 가져오기 | 로그인 직후 사용자가 명시 승인 | pending import 상태 | 승인한 완료 기록만 Supabase RPC | 승인한 계정에 귀속 | 서버 accepted source만 기기 guest 목록에서 제거. 거절·응답 불명 원본 보존, 과거 체류 학습 제외 | 자동 회귀와 2026-09-08 실기기 계정 기록 표시 성공 확인. 전체 서버 중복·물리 정리 증거로 확대하지 않음 |
| 체류 개인화 동의 | 로그인 사용자가 별도 토글 | 현재 동의·증거·outbox 일부 기기 저장 | Supabase consent RPC | 사용자 ID 직접 연결 | off는 신규 제출·조회·추천 적용과 pending을 막지만 기존 서버 표본을 즉시 삭제하지 않음. `맞춤 기록 초기화`는 표본·집계를 삭제하고 동의를 끔 | 현재 출시 범위. 015·016·017 운영 적용 및 C owner 동의 ON 확인 |
| 체류 표본 | 로그인+별도 동의 상태에서 새 코스의 명시 도착·출발·완료 | 전송 대기 최대 32건, 최초 기준 7일 | 완료 event ID, run/stop, 장소 ID, category/subCategory, 실제 체류분, 분 단위 완료시각, 동의 epoch/revision을 Supabase RPC로 전송 | 사용자 ID 직접 연결 | 유효 180일. purge 함수는 있으나 scheduler와 backup 반영은 미확인 | C 1회에서 완료·표본 각 3건 저장, 동일 owner 조회, 제한 exact 정리 PASS |
| 개인화 profile | 같은 category+subCategory 유효 표본 최소 3개부터 최근 최대 5개 중앙값 | 추천 session에 일시 사용 | Supabase에서 파생·조회 | 사용자 ID 직접 연결 | 최근 180일은 유효 범위이며 owner 조회가 만료행을 삭제. service-role purge 함수는 있으나 scheduler 운용 미확인 | C 실제 엔진 체류 추천 30→40분 반영 PASS. 실제 3회 방문 증거는 아님 |
| 활성 코스·Live Activity 진행·완료 | 코스 길찾기 버튼의 명시 클릭과 명시 도착·출발·완료 | AsyncStorage, App Group 파일, ActivityKit state, 알림 registry에 코스·장소·예정/실제 시각 저장 | 원격 Activity push 없음. iOS Live Activity·로컬 알림 subsystem 사용 | 서버 계정 ID는 저장하지 않음 | 완료·취소·교체 시 exact cleanup, 실패 대상 재시도. OS backup·강제 종료 한계는 최종 artifact 확인 필요 | 기기 전용 현재 구현. 클릭은 도착·체류 학습 증거가 아님. 최종 구간의 Live Activity 완료가 앱의 기존 완료 절차로 연결됨. `5분 뒤 다시 알림`은 출시 UI에서 제거 |

2026-09-09 정정: 외부 handoff 확인 기준은 웹 복귀 시 진행되지 않는 문제로 철회했다. 현행 `DEC-KAKAO-ROUTE-START-02`는 코스 길찾기 클릭으로 진행을 시작하며 정상 웹 닫기를 실패로 보지 않는다. 실제 열기 전체 실패의 제한적 복구 정책은 유지한다. 주변 둘러보기는 코스·체류 기록과 독립적이다.

위치 문의 상태 정정: 사용자 제공 센터 회신을 접수했다. 별도 개인위치정보사업 등록보다 위치기반서비스사업 신고 여부를 검토하라는 내용이며, 공급자별 위탁/제3자 제공·국외 이전 관계는 확정하지 않았다. 아래 과거 `답변 대기`는 회신 접수 후 미확인 고지 사실 확인으로 읽는다. 사업자등록·일반 신고 완료 또는 특례 적용이 확인된 것은 아니다.
| 로컬 진단 | Activity 단계·고정 결과 code·revision·build | App Group stream별 최대 32건. 사용자가 복사하면 pasteboard 사용 | 자동 서버 전송 없음 | 사용자·좌표 원문을 진단 schema에 넣지 않음 | 수동 clear 가능 | 기기 전용. 부적합 가능성이 있던 uptime 파일 순서는 잠금·증가 순번·UUID로 교체. 앱/Extension별 privacy manifest가 포함된 Development Archive 감사 PASS. Distribution IPA에서 재확인 필요 |
| 로컬 후기(legacy) | 후기 화면 | 장소·평점·합성 체류 등을 기기 최대 1,000건 | 자동 서버 전송 없음 | 계정 연결 없음 | 전체 clear consumer와 기간 미확인 | 기기 전용 legacy |
| 알림·Live Activity 권한 상태 | 내정보 화면과 진행 기능이 OS 상태 사용 | OS가 상태 관리 | Apple OS | 기기 단위 | 시스템 설정에서 변경 | 위치 권한 조회는 제거. 알림·Live Activity 선택 기능만 유지 |
| CAPTCHA 신호 | anonymous Auth 보호 WebView | token을 일회 전달; 앱 영속 저장 경로 없음 | Cloudflare Turnstile/Worker가 sitekey/origin·IP·User-Agent·TLS/browser 신호와 challenge 결과를 처리하고 token을 Supabase Auth에 전달 | 익명 Auth도 서버 사용자 식별자와 session JWT가 존재 | Worker 자체 token 저장 없음/no-store. Cloudflare·Supabase 내부 보유는 미확인 | 검증 제한: 최종 endpoint·도메인 allowlist·공급자 보유 확인 필요 |
| 지도·장소 사진 | 지도 WebView·장소 카드 | RN Image/WebView cache 가능 | 허용 사진은 `www.visitbusan.net`, 지도 리소스는 Kakao에 요청. 앱이 JWT·GPS를 이미지 URL에 추가하지 않음 | 사진 요청 자체에 계정 ID를 추가하지 않음 | 호스트 cache/log 보유는 미확인 | DATA 최종 재집계: 공개 허용 101/369(부산 명소85·맛집16), 기본 이미지268. 조건 미확인102·사진 없음166은 비노출. 데이터 기준 제출 차단 없음 |

## 제3자·수탁 후보

현재 연결된 Supabase project는 설정 metadata상 `ap-northeast-2`(AWS 서울, 대한민국)·`ACTIVE_HEALTHY`다. 이 사실은 Auth 메일·Edge/CDN·지원·하위처리자까지 모두 국내 처리된다는 뜻이 아니므로 국외 이전 판단은 별도로 남긴다.

| 사업자·서비스 | 역할 후보 | 처리 범위 | 출시 전 확정할 사실 |
| --- | --- | --- | --- |
| SUPABASE PTE. LTD. 및 적용 하위처리자 | Free Plan·DPA Version 1(2026-08-01)에 따른 인증·DB·Edge Function 처리자. Supabase, Inc.는 공개 하위처리자 목록의 지원 업무 및 Privacy 주체와 구분 | 이메일, 사용자 ID, 세션, 코스·위치, 완료 기록, 체류 표본 | Custom SMTP 비활성, route-proxy 서울 region, Log Drains 미사용, Free backup 미제공은 확인. delete-account region, 기본 SMTP의 실제 처리 범위, 조회 가능한 로그의 보유기간·처리 국가와 하위처리자 범위는 미확인 |
| Kakao Corp. | Local 검색 4종, Maps JavaScript, REST 도보·대중교통 경로 제공 외부 서비스 | 검색어, 주소·좌표, 경로 양 끝점, 지도 marker/geometry, IP 등 네트워크 정보 가능 | endpoint별 실제 호출 확인. 현재 WebView/REST 방식에는 iOS Bundle ID 등록이 필요하지 않고 `https://timefit.local`이 등록 JS 도메인과 일치해 플랫폼 조치0. 짜투리와 Kakao 사이 법적 역할, 요청 로그 목적·보유·처리 국가 및 최종 runtime 표시만 미확인 |
| Cloudflare, Inc. | Workers Free·DPA Version 6.4(2026-04-03)에 따른 CAPTCHA·Worker 처리 수탁자/국외 이전 수령자 후보 | IP, User-Agent, TLS/browser 신호, sitekey/origin, challenge 결과 | Managed Turnstile과 `timefit-captcha.sdongheun.workers.dev` Worker/hostname 활성, Workers Logs·Traces 비활성 확인. 실행 지역·기본 서비스 로그 보유·처리 국가와 이중 역할 법적 분류는 미확인 |
| 부산광역시·Visit Busan 호스트 | 공개 허용 장소 사진 101건 제공 | 이미지 URL 요청과 IP 등 접속 metadata | 명소85·맛집16은 공식 API 이용허락범위 제한 없음, 변경·상업 이용 가능 및 화면 출처 연결 확인. 호스트 로그 보유는 미확인 |
| TMAP Mobility·ODsay | 레거시 저장 코스·재계산 경로의 provider 후보 | 양 끝 정확 좌표, 이동수단과 provider key | 현재 추천 proxy 실패의 자동 fallback은 아님. 최종 Release에서 legacy 화면이 실제 도달 가능한지 확인하고 가능하면 계약·표시·보유·App Privacy 반영 |

### RELEASE-DOCS-05-R1 필수 고지 공백 분류

제26조의 수탁자·위탁 업무 공개와 제28조의8의 실제 국외 이전 시 고지 항목을 구분한다. 공급자의 국가·법인·보유기간이 미확인이라는 이유만으로 모두 같은 차단으로 올리지 않으며, 기술적 요청 전송만으로 위탁·제3자 제공·국외 이전을 단정하지 않는다.

| 대상 처리 | 필수 고지 해당 여부·공식 근거 | 이미 확인된 사실 | 부족한 정확한 필드 | 확보할 출처·담당 | 게시 판정 |
| --- | --- | --- | --- | --- | --- |
| Supabase Auth·DB·Edge | 실제 수탁이면 수탁자와 위탁 업무 공개가 필수(개인정보 보호법 제26조). 실제 국외 이전이 있으면 국가·시기·방법·수령자·목적·항목·보유기간 등 제28조의8 항목이 필수 | Free Plan / SUPABASE PTE. LTD. / DPA Version 1(2026-08-01). DB/Auth와 route-proxy는 서울. Custom SMTP 비활성, Edge 로그 조회 가능, Log Drains 미사용, Free backup 미제공, Cron Integration 미설치. delete-account 최근 실행 로그 없음 | 기본 SMTP의 실제 처리 범위, delete-account 실행 region, 제공자 로그 보유기간·처리 국가와 적용 하위처리자. Jobs 화면은 로딩 지속으로 확인 불가. 실제 국외 이전 확인 시 해당 국가·시기/방법·수령자 연락처·목적·항목·보유기간 | 확인된 계정 설정과 Supabase 공식 약관·DPA·하위처리자 자료 — 운영자/전문 검토 | **계정 사실 반영·전문 해석 대기:** 표준계약과 주요 설정은 확인. 확인되지 않은 보유·이전 필드를 추정하지 않고 실제 국외 이전 고지 범위를 확정 |
| Kakao Local·Maps·경로 | 확인된 외부 전송이 위탁인지 제3자 제공인지 먼저 판정. 위탁이면 제26조, 국외 이전이면 제28조의8 적용. 제3자 제공 해당 여부와 동의 항목은 전문 검토 대상 | Local 키워드·좌표→행정구역·좌표→주소·주소검색, Maps JavaScript, REST walk/publictraffic의 실제 사용·endpoint별 호출 기록 확인. 무료 API 사용량 2,691/월 최대 제공량 3,000,000, 제한 없음. 계정 ID/JWT·약속 시각은 Kakao 경로 요청에 넣지 않음. WebView base URL `https://timefit.local`과 등록 JS 도메인이 일치하며 iOS Native SDK는 사용하지 않음 | 짜투리와 Kakao 사이 법적 역할, 요청 로그의 목적·보유와 처리 국가, 약관 버전/별도 계약. 상품 활성화·키별 제한·최종 runtime origin은 좁은 후보 smoke로 남음 | Kakao Developers 앱 설정과 해당 API 공식 처리 안내 — 운영자와 위치 문의/전문 검토 | **플랫폼 설정 대조 완료·법적 분류 게시 차단:** 현 방식의 iOS Bundle ID 등록은 불필요하고 추가 도메인 조치도 없음. 적용 고지 체계는 미확정이며 유료 API 미사용을 로그·처리 없음으로 확대하지 않음 |
| Cloudflare Turnstile·Worker | 출시 구성에서 조건부 사용되므로 운영자 위탁·공급자 독자 목적과 국외 이전을 분리해 제26조·제28조의8 검토 | Workers Free / Cloudflare, Inc. / DPA Version 6.4(2026-04-03), 결제수단 없음. Managed Turnstile active와 hostname `timefit-captcha.sdongheun.workers.dev`, 같은 Worker route 활성 확인. Workers Logs·Traces 비활성, Pages project 없음 | Worker 실행 지역은 화면에 표시 없음. 기본 서비스 로그 보유·처리 국가·하위처리자와 한국법상 processor/controller 이중 역할 고지 분류. 최종 운영 실행 성공 | 확인된 Cloudflare Account·Turnstile·Worker 설정과 공개 DPA/Privacy 자료 — 운영자/API/전문 검토 | **계정 연결 반영·전문 해석 대기:** ‘미사용’으로 제외할 수 없음. 사용자 활성화 로그가 없다는 사실을 Cloudflare 내부 처리·보유0으로 확대하지 않음 |
| Cloudflare Pages 공개 문서 | 실제 게시 뒤 방문자의 네트워크 정보가 호스팅 처리 대상이 될 수 있어 앱 보안 흐름과 별도로 분류 | 현재 프로젝트·배포가 없고 외부 게시 0회. 예정 호스트만 확정 | 게시 프로젝트의 적용 계정/법인, 실제 요청 log 설정과 처리 범위 | 게시 승인 후 생성된 Pages 프로젝트 설정·계정 계약 — 출시 문서 담당/운영자 | **게시 시 조건부:** 현재 처리 없음. 게시 실행 전에 최종 공개 문안에 호스팅 처리를 반영할지 확정 |
| 부산광역시·Visit Busan 이미지 요청 | 기기에서 공개 이미지 호스트로 직접 요청되는 접속 정보를 운영자의 위탁·제3자 제공으로 볼지는 미판정. 해당 법적 역할이 성립할 때만 관련 필수 고지 적용 | 허용 사진 101건과 출처 연결, 이미지 요청에 IP 등 접속 정보가 생길 수 있음 | 운영자와 호스트의 법적 역할, 접속 로그 목적·보유 | 사용 API/이미지 이용조건과 호스트 공식 처리 안내 — 데이터 담당/전문 검토 | **미판정·비차단:** 허용 콘텐츠와 기술 흐름은 공개 초안에 기재. 새 근거 없이 보유기간을 만들지 않음 |
| TMAP Mobility·ODsay | 최종 Release에서 도달 가능할 때만 실제 수신자 분류 후 제26조·제28조의8 및 제3자 제공 해당 여부 검토 | 신규 추천 자동 fallback은 아니며 legacy 저장 코스·재계산에서 조건부 도달 가능 | 최종 artifact 도달성, 사용 API·계약 주체, 법적 역할, 처리 국가·로그 보유 | 최종 후보의 legacy 진입 재현과 provider 계정 계약/공식 안내 — UI/API/운영자 | **도달성 조건부:** 도달 불가 증명 시 공개 수신자에서 제거. 도달 가능이면 정확 필드 확정 전 게시 차단 |

현재 공급자 게시 공백은 **Supabase 기본 SMTP·일부 Edge/로그의 미표시 처리 범위에 대한 국외 이전 고지 판단**, **Kakao 확인 상품의 위탁/제3자 제공·국외 이전 고지 체계**, **Cloudflare Turnstile의 처리자/독자 목적과 미표시 지역·기본 로그 범위에 대한 고지 분류**다. 계정 계약과 주요 활성 설정 확인은 끝났다. TMAP·ODsay는 최종 artifact 도달성, Pages는 실제 게시에 따라 달라진다. 표시되지 않은 보유기간이나 법적 지위를 임의 작성하지 않는다.

### RELEASE-DOCS-07 — 답변 없이는 닫을 수 없는 필수 고지

| 정확한 질문 | 이미 확인한 사실 | 답변할 기관·공급자 | 영향받는 문단 | 답변 전 가능한 작업 |
| --- | --- | --- | --- | --- |
| 접수된 위치 문의 회신에 따라 실제 신고 절차와 추가 고지·책임자·연락처·별도 약관 중 무엇을 이행해야 하는가? | 문의 답변 대기는 종료. 출시 후보는 GPS·위치 권한을 사용하지 않고 검색·지도 핀으로 장소를 선택하며 버튼으로 도착·출발·완료를 기록. 회신은 면제·법적 적합성 확정 근거가 아님 | 실제 신고 처리 기관과 필요한 경우 전문 자문 | 개인정보 처리방침 제4·7절, 이용약관 장소 선택 부분, 지원 연락처 | GPS 미사용 기술 문구는 원본·HTML에 반영. 신고 처리 결과가 요구하는 항목만 추가하며 면제·보유기간·법적 지위를 추정하지 않음 |
| 확인된 Kakao Local·Maps JavaScript·REST 도보/대중교통 요청이 짜투리 운영자 기준 위탁·제3자 제공 중 무엇에 해당하며, 요청 로그의 목적·보유기간·처리 국가와 필요한 동의·고지 항목은 무엇인가? | 실제 사용 상품과 endpoint별 호출 기록, 전송 항목, 계정 ID·약속 시각 비전송 확인 | Kakao Developers 공식 지원/계약 자료와 개인정보 전문 자문 | 개인정보 처리방침 제3·4절, App Privacy의 Location·Search History, 심사 메모 | 상품·전송 항목·목적을 공개 본문에 쉬운 말로 반영. 법적 관계와 기간·국가는 답변 전 확정하지 않음 |
| Supabase 기본 이메일·지원·보안 로그와 서울 외 처리 예외에 실제 적용되는 수령자, 국가, 이전 시기·방법, 목적, 항목과 보유기간은 무엇인가? | Free Plan / SUPABASE PTE. LTD. / DPA v1, Custom SMTP off, DB/Auth·route-proxy 서울, Log Drains 미사용, Free backup 없음, Cron 미설치 | Supabase 공식 지원/계약·하위처리자 자료와 개인정보 전문 자문 | 개인정보 처리방침 제2·3절, App Privacy의 Email·Identifiers·Diagnostics | 서울 핵심 처리와 확인된 계정 설정을 반영. 기본 이메일·제공자 로그·하위처리자 범위를 국내 처리 또는 보유0으로 확대하지 않음 |
| Cloudflare Turnstile의 사이트 보호 처리와 탐지 개선 목적을 국내 고지에서 어떻게 구분하며, 기본 보안 처리의 국가·수령자·보유기간은 무엇인가? | Workers Free / Cloudflare, Inc. / DPA v6.4, Managed Turnstile·Worker 활성, 운영자 선택 Logs·Traces 비활성 | Cloudflare Privacy/DPA 공식 지원과 개인정보 전문 자문 | 개인정보 처리방침 제3절, App Privacy의 Device ID·Diagnostics, 공개 Pages 호스팅 문구 | 보안 목적·전송 가능 항목과 운영자 선택 상세 로그 비활성을 반영. 기본 처리까지 로그0으로 표현하지 않음 |

### RELEASE-DOCS-06 A — Cloudflare Pages 게시 전 준비

| 구분 | 게시 전에 확정된 사실 | 프로젝트 생성 뒤 확인할 값 | 공개 문안 처리 |
| --- | --- | --- | --- |
| 적용 계약 | 계정이 필요한 Cloudflare 서비스는 Self-Serve Subscription Agreement가 사용·접근 또는 동의 시 적용된다. 공개 웹사이트 이용약관으로 Pages 계약을 대신하지 않는다 | 이 계정에 별도 Enterprise/서면 계약이 있는지 | 별도 계약 증거가 없으면 Self-Serve 기준으로 기록하되 계약 당사자를 임의 확정하지 않음 |
| 처리 역할·항목 | Cloudflare 공개 Privacy Policy는 고객·최종 사용자가 서비스를 통해 전송하거나 저장한 콘텐츠와 Customer Logs 등에 대해 처리자 역할을 설명한다. 정적 페이지 방문 시 IP, 요청 URL·시각, User-Agent 등 네트워크 요청 정보가 서비스 제공·보안 과정에서 처리될 수 있다 | Pages project의 Web Analytics, Logpush/Log Explorer/기타 log 기능 활성 여부와 실제 보존 설정 | 짜투리 사이트 자체에는 JS·분석 SDK·문의 폼·로그인이 없다고 설명 가능. Cloudflare의 기본 네트워크 처리를 ‘수집 없음’으로 확대하지 않음 |
| 처리 지역·하위처리자 | Cloudflare는 미국 기반 글로벌 사업자이고 공개 방침상 정보를 주로 미국·EEA에 저장하며 전 세계에서 이전·접근할 수 있다고 안내한다. Developer Platform 하위처리자는 공개 목록상 복수 국가에 있을 수 있다 | 해당 계정/상품에 적용되는 데이터 지역 제한·Customer Metadata Boundary 여부 | 대한민국 처리만으로 쓰지 않음. 국외 이전 필수 항목은 실제 계약·설정과 전문 검토로 확정 |
| 보유·삭제 | 공개 방침은 목적·법적 의무에 필요한 기간을 제시하며 Pages 방문 로그의 단일 고정 기간을 공개하지 않는다. 고객 로그 상품·plan별 기능이 다르다 | 계정 plan, 고객이 켠 로그 저장/전송, 삭제·보존 설정 | 임의 보유기간을 쓰지 않음. 프로젝트 생성 전에도 기본 호스팅 처리 설명 초안은 준비 가능 |

게시 직전 조건부 공개 문구: `공개 문서는 Cloudflare Pages를 통해 제공되며, 페이지 요청 과정에서 IP 주소, 요청 URL·시각, 브라우저·네트워크 정보가 호스팅 제공·보안 목적으로 Cloudflare에서 처리될 수 있습니다. 짜투리는 이 사이트에 분석 스크립트, 광고 SDK, 로그인 또는 문의 폼을 두지 않습니다.` 실제 프로젝트 생성과 계약·국외 이전 필드 확인 전에는 공개 HTML에 넣지 않는다.

Cloudflare 공식 근거(2026-09-09 확인): Self-Serve Subscription Agreement https://www.cloudflare.com/terms/, Privacy Policy https://www.cloudflare.com/policies/privacy/, Customer DPA https://www.cloudflare.com/cloudflare-customer-dpa/, Sub-Processors https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/, Logs https://developers.cloudflare.com/logs/.

## 공개 문구 조건표

| 조건 | 포함할 문구 | 제거하거나 금지할 문구 |
| --- | --- | --- |
| 현행 개인화 포함 | 계정 기록, guest 명시 가져오기, 별도 동의 체류 표본, 180일·최소 3개/최근 5개 개인화 설명 | “개인화 미제공”, “모든 기록이 기기에서만 처리” |
| 실제 출시 artifact에서 개인화가 다시 제외되는 경우 | 서버 신규 수집 불가와 UI·endpoint 비활성 증거를 먼저 확보한 뒤 공개 문구와 App Privacy를 함께 재작성 | UI만 숨긴 채 App Privacy의 체류 수집을 제거 |
| legacy 경로 Release 도달 불가 증명 | Kakao/Supabase 경로만 기재 | TMAP·ODsay를 현재 수신자로 열거할 필요 없음 |
| legacy 경로 도달 가능 | TMAP·ODsay 수신·표시·보유와 App Privacy를 포함 | “경로는 Kakao만 사용” |

## 근거와 공식 기준

- 코드·감사: `docs/work/db-personalization/release-facts-final.md`, `docs/work/external-api/release-facts-final.md`, `docs/work/data-curation/release-assets-final.md`, `docs/work/uiux/release-build-final.md`, `docs/work/db-personalization/personalization-finalization.md`, `docs/work/db-personalization/guest-import-release-fix.md`, `docs/work/uiux/final-interaction-wave.md`, `docs/work/qa-release/release-three-hour-validation.md`.
- Apple App Privacy는 앱과 통합된 제3자의 수집까지 포함하며, 실시간 요청 처리보다 오래 접근 가능한 전송을 “수집”으로 본다: https://developer.apple.com/app-store/app-privacy-details/
- 개인정보 보호법 제30조 처리방침 공개: https://www.law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900078922
- 개인정보 보호법 제26조 수탁자·업무 공개: https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900079061
- 개인정보 보호법 제28조의8 국외 이전 고지 항목: https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1029332501
- 개인정보보호위원회 2026 처리방침 작성지침: https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20885
- Supabase region·로그·backup은 project 설정과 plan에 따라 달라진다: https://supabase.com/docs/guides/platform/regions, https://supabase.com/docs/guides/observability/logs, https://supabase.com/docs/guides/platform/backups
- Supabase의 2026 DPA는 고객을 controller, Supabase를 processor/service provider로 설명하지만 실제 계약 체결·project 설정은 별도 확인해야 한다: https://supabase.com/downloads/docs/Supabase%2BDPA%2B260317.pdf
- Kakao 개인정보·위치정보 처리 안내: https://kakao.com/policy/privacy, https://www.kakao.com/policy/location/typesAndCharges
- Kakao Developers 운영정책과 지도 API 정책: https://developers.kakao.com/terms/ko/site-policies, https://developers.kakao.com/docs/ko/kakaomap/common
- Cloudflare Turnstile 개인정보 안내: https://www.cloudflare.com/turnstile-privacy-policy/

공식 기준 확인일: 2026-09-08.
