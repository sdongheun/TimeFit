# TimeFit 출시 데이터 처리 사실표

기준일: 2026-09-07
상태: 내부 검토용. 현재 공유 작업트리의 구현과 최신 인수인계를 기준으로 하며, 운영 서버 배포 상태를 증명하지 않는다.

## 판정 범례

- **현재 구현:** production entry에서 호출되는 코드가 있다.
- **기기 전용:** 앱 또는 iOS 저장소에서만 처리하며 앱 코드에 서버 업로드 경로가 없다.
- **조건부:** 코드와 로컬 검증은 있으나 migration·Function·운영 설정 또는 실제 서버 동작이 미검증이다.
- **미확인:** 운영 대시보드, 공급자 계약 또는 최종 Release artifact 없이는 확정할 수 없다.

## 데이터 흐름

| 항목 | 수집·생성 entry | 기기 처리 | 서버·제3자 전송 | 계정 연결 | 보유·삭제 | 상태·근거 |
| --- | --- | --- | --- | --- | --- | --- |
| 이메일·비밀번호 | 회원가입·로그인 | Supabase SDK가 세션 토큰을 AsyncStorage에 지속. 비밀번호 자체를 앱이 별도 저장하는 코드는 없음 | Supabase Auth | Auth 사용자 ID와 연결 | 계정 삭제 성공 시 Auth 사용자 삭제를 시도. Auth·로그·백업의 실제 잔존 기간은 미확인 | 현재 구현: `LoginScreen.tsx`, `AuthContext.tsx`, `supabase.ts`, `delete-account` |
| 가입 동의 기록 | 가입 화면에서 이용약관·처리방침을 각각 열고 체크 | 가입 요청 metadata에 문서 ID·버전·요청 ID 포함 | Supabase Auth 및 DB consent registry | 사용자 ID와 연결 | 계정 cascade 설계. 운영 문서 registry와 실제 URL은 미등록 | 조건부: `accountRegistrationRepository.ts`, migration 015 |
| 닉네임 | 로그인 사용자가 선택 입력 | 화면 상태 | Supabase `profiles` | 사용자 ID와 연결 | 비워 저장하면 삭제; 계정 삭제 시 cascade | 조건부: 앱·SQL 로컬 검증 완료, migration 015 원격 미적용 |
| 사용자 ID·세션 | 일반 또는 경로 프록시용 anonymous Auth | access/refresh session 지속 | Supabase Auth, Edge 요청 JWT | 일반 회원 또는 anonymous 식별자 | 일반 계정은 앱 내 삭제 entry 있음. anonymous 정리 scheduler의 운영 활성은 미확인 | 현재 구현 / 운영 미확인 |
| 현위치 좌표 | 사용자가 위치 기능을 선택하고 ‘앱을 사용하는 동안’ 권한을 허용 | 선택 상태, 활성 코스 snapshot 등에 남을 수 있음 | 주소 변환 시 Kakao Local. 경로 계산 시 Supabase Edge를 거쳐 Kakao. 레거시 분기에서는 TMAP·ODsay 가능 | 로그인 저장 코스에는 사용자 ID와 함께 저장될 수 있고, guest route 요청은 anonymous JWT와 결합될 수 있음 | 활성 코스 정상 종료 시 정리 경계가 있으나 OS backup·오류 경로까지 완전 삭제는 미확인 | 현재 구현: `TimeSetupScreen`, route adapters, 외부 API 감사 |
| 수동 검색어·주소·선택 좌표 | 출발지·약속 장소 검색 또는 지도 핀 | 검색 결과 메모리 cache 약 10분, 선택 결과는 진행 상태에 포함 가능 | Kakao Local; 경로 계산 시 Supabase Edge·Kakao | 코스 저장 시 계정 연결 가능 | 앱 검색 cache는 lazy expiry. 공급자 로그 보유는 미확인 | 현재 구현 |
| 경로 요청·결과 | 추천 검증·상세 경로·카카오 길찾기 | 메모리 cache; 활성 코스에는 장소·구간·일부 geometry가 지속될 수 있음 | Supabase Edge→Kakao. 외부 카카오맵 열기 시 출발·도착 이름·좌표·수단이 URL로 전달 | Edge JWT와 연결 가능. 공개 POI pair cache에는 사용자 ID·private 좌표를 저장하지 않도록 설계 | public cache 기본 TTL 15분이나 운영 override·purge 실행 미확인. private Edge 경로는 영속 cache 제외 | 현재 구현 / 운영 미확인 |
| 저장 코스 | 로그인 사용자가 저장·교체 | 화면 상태 | Supabase `courses`, `course_stops`, `course_legs` | 사용자 ID 직접 연결 | 개별 삭제 및 계정 cascade 설계. 자동 만료 없음. 백업 잔존 미확인 | 현재 구현; 원격 RLS 재확인 필요 |
| 비로그인 완료 기록 | `코스 마치기` | 장소 ID·명칭·분류·완료 시각·선택적 체류를 기기에 최대 1,000건 | 자동 서버 전송 없음 | 계정과 연결하지 않음 | 가져오기 성공 항목은 기기 guest 목록에서 제거. 전체 삭제 UI는 확인되지 않음; 앱 삭제·OS 정책 외 기간 미정 | 현재 구현: `courseCompletionRepository.ts`, `ActivityRecordScreen.tsx` |
| 계정 완료 기록 | 로그인 중 명시 완료 | 동기화 대기와 owner snapshot을 기기에 저장 | Supabase account completion tables/RPC | 사용자 ID 직접 연결 | 개별·전체 기록 삭제, 계정 삭제 cascade 설계 | 조건부: 코드·fixture 완료, migration 015 원격 미적용 |
| guest 방문 가져오기 | 로그인 직후 사용자가 명시 승인 | pending import 상태 | 승인한 완료 기록만 Supabase RPC | 승인한 계정에 귀속 | 성공 항목만 guest 목록에서 제거. 가져온 기록은 체류 학습 제외 | 조건부: 코드·fixture 완료, 원격 미검증 |
| 체류 개인화 동의 | 로그인 사용자가 별도 토글 | 현재 동의·증거·outbox 일부 기기 저장 | Supabase consent RPC | 사용자 ID 직접 연결 | off는 신규 학습 중단 및 pending 폐기, reset은 서버 표본·profile 삭제를 요청 | **조건부 개인화**: 원격 015/016·실제 서버 검증 대기 |
| 체류 표본 | 로그인+별도 동의 상태에서 새 코스의 명시 도착·출발·완료 | 전송 대기 최대 32건, 최초 기준 7일 | 완료 event ID, run/stop, 장소 ID, category/subCategory, 실제 체류분, 분 단위 완료시각, 동의 epoch/revision을 Supabase RPC로 전송 | 사용자 ID 직접 연결 | 유효 180일. purge 함수는 있으나 운영 scheduler와 백업 잔존은 미확인 | **조건부 개인화**: 로컬 자동 게이트 PASS, 실제 서버 학습 미확인 |
| 개인화 profile | 같은 category+subCategory 유효 표본 최소 3개부터 최근 최대 5개 중앙값 | 추천 session에 일시 사용 | Supabase에서 파생·조회 | 사용자 ID 직접 연결 | 표본 reset/off 정책과 연동. 서버 180일 경계는 SQL에 있음 | **조건부 개인화** |
| 활성 코스·Live Activity 진행 | 첫 외부 길찾기 handoff와 도착·출발 버튼 | AsyncStorage, App Group 파일, ActivityKit state, 알림 registry에 코스·장소·예정/실제 시각 저장 | 원격 Activity push 없음. iOS Live Activity·로컬 알림 subsystem 사용 | 서버 계정 ID는 저장하지 않음 | 완료·취소·교체 시 exact cleanup, 실패 대상 재시도. OS backup·강제 종료 한계는 최종 artifact 확인 필요 | 기기 전용 현재 구현 |
| 로컬 진단 | Activity 단계·고정 결과 code·revision·build | App Group stream별 최대 32건. 사용자가 복사하면 pasteboard 사용 | 자동 서버 전송 없음 | 사용자·좌표 원문을 진단 schema에 넣지 않음 | 수동 clear 가능; final public Release에서 진단 UI·flag 비노출 증거 필요 | 기기 전용 / Release 미확인 |
| 로컬 후기(legacy) | 후기 화면 | 장소·평점·합성 체류 등을 기기 최대 1,000건 | 자동 서버 전송 없음 | 계정 연결 없음 | 전체 clear consumer와 기간 미확인 | 기기 전용 legacy |
| 위치·알림 권한 상태 | 내정보 화면이 OS 상태 조회 | OS가 상태 관리 | Apple OS | 기기 단위 | 시스템 설정에서 변경 | 현재 구현 |
| CAPTCHA 신호 | anonymous Auth 보호 WebView | token을 일회 전달; 앱 영속 저장 경로 없음 | Cloudflare Turnstile/Worker→Supabase Auth | 네트워크·브라우저 신호가 공급자에서 처리될 수 있음 | Worker 응답 no-store. Cloudflare 내부 보유는 미확인 | 조건부 운영 설정 |
| 지도·장소 사진 | 지도 WebView·장소 카드 | RN Image/WebView cache 가능 | Kakao 지도 리소스, 한국관광공사·Visit Busan 이미지 호스트 | 앱이 JWT·GPS를 이미지 URL에 추가하지 않음 | 공급자 cache/log 정책과 개별 사진 권리 미확인 | 현재 구현; 콘텐츠 권리 게이트 미통과 |

## 제3자·수탁 후보

| 사업자·서비스 | 역할 후보 | 처리 범위 | 출시 전 확정할 사실 |
| --- | --- | --- | --- |
| Supabase, Inc. | 인증·DB·Edge Function 처리 수탁자 및 국외 이전 수령자 후보 | 이메일, 사용자 ID, 세션, 코스·위치, 완료 기록, 조건부 체류 표본 | 계약 주체, 연락처, 실제 project region/국가, 이전 시기·방법, 로그·백업 보유, DPA·subprocessor 적용 |
| Kakao Corp. | 장소·주소 검색, 지도, 경로 제공 외부 서비스 | 검색어, 주소·좌표, 경로 양 끝점, IP 등 네트워크 정보 가능 | TimeFit과 Kakao 사이 법적 역할, 요청·로그 보유, 지도/경로 표시 조건 |
| Cloudflare, Inc. | CAPTCHA·Worker 처리 수탁자/국외 이전 수령자 후보 | IP, User-Agent, TLS/browser 신호, sitekey/origin, challenge 결과 | 계약 주체, 처리 국가, subprocessor, 보유기간, 실제 production 활성 |
| 한국관광공사·부산관광공사/Visit Busan 호스트 | 장소 사진·콘텐츠 제공 | 이미지 URL 요청과 네트워크 metadata | 사진별 권리·출처·변경/상업 이용 조건 |
| TMAP Mobility·ODsay | 레거시 경로 provider 후보 | 정확 좌표, 이동수단, 네트워크 metadata | 최종 Release에서 경로가 도달 가능한지. 가능하면 계약·표시·보유·App Privacy 반영 |

## 공개 문구 조건표

| 조건 | 포함할 문구 | 제거하거나 금지할 문구 |
| --- | --- | --- |
| 원격 015/016 적용·실제 회원/삭제/RLS/학습 검증 PASS | 계정 기록, guest 명시 가져오기, 별도 동의 체류 표본, 180일·최소 3개/최근 5개 개인화 설명 | “미제공”, “기기에서만 처리” |
| 개인화 서버 검증 미통과 | 공통 위치·계정·로컬 진행 설명만 유지. 빌드에서 가입/개인화 진입 비활성 및 서버 호출 불가 증거 필요 | 개인화 제공·표본 저장·맞춤 추천 광고 |
| legacy 경로 Release 도달 불가 증명 | Kakao/Supabase 경로만 기재 | TMAP·ODsay를 현재 수신자로 열거할 필요 없음 |
| legacy 경로 도달 가능 | TMAP·ODsay 수신·표시·보유와 App Privacy를 포함 | “경로는 Kakao만 사용” |

## 근거와 공식 기준

- 코드·감사: `docs/work/db-personalization/release-data-audit.md`, `docs/work/external-api/release-api-audit.md`, `docs/work/db-personalization/personalization-finalization.md`, `docs/work/qa-release/live-learning-evidence-validation.md`.
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
