# RELEASE-DATA-AUDIT-01 — 출시 데이터 처리 사실표

감사일: 2026-09-07

상태: **FAIL — 제출 차단 결함과 원격 미확인 항목 존재**

범위: 저장소의 현재 shared worktree를 읽기 전용으로 감사했다. 운영 Supabase 데이터·secret 값·실사용자·provider를 조회하지 않았고 migration/Function 배포, 테스트 계정 생성, 메일 발송, 원격 쓰기는 0회다.

## 판정 기준

- **사실:** production entry와 저장/전송 코드가 연결돼 있음을 확인했다.
- **준비만 됨:** schema/type은 있으나 production write entry가 없어 현재 수집으로 보지 않는다.
- **미확인:** 저장소만으로 운영 설정·보유·실제 배포 상태를 확정할 수 없다.
- **P0:** App Store 제출 또는 개인정보 안전을 위해 제출 전에 해결·확인해야 한다.
- **P1:** 출시 전 해결을 권장하며, 유지할 경우 공개 문서와 사용자 제어가 정확해야 한다.

Live Activity의 **서버 체류 표본·업로드 queue·개인화 적용은 이번 출시에서 보류**다. 아래 로컬 진행 저장을 서버 개인화로 해석하지 않는다.

## 요약 판정

| 등급 | 발견 | 판정 |
| --- | --- | --- |
| P0 | 앱이 이메일 계정 생성을 제공하지만 일반 계정 삭제 UI/Edge entry가 없다 | 제출 차단. `signOut`과 service-role DB helper는 계정 삭제가 아니다. |
| P0 | anonymous Auth가 `authenticated` role을 받고 course RLS는 `auth.uid()`만 확인한다 | 정책상 authorization-only인 anonymous가 REST/RPC로 자기 course graph를 만들 수 있다. UI guard만으로 차단할 수 없다. |
| P0 | 가입 UI의 명시 동의 없이 두 동의 timestamp가 자동 생성되고 trigger는 누락도 현재시각으로 보정한다 | 실제 약관/개인정보 문서·버전·명시 확인 증거가 아니다. 개인정보/가입 공개 전 교정 필요. |
| P0 | legacy TMAP/ODsay 요청 로그가 정확 좌표를 소수점 5자리로 `console.log`한다 | production 도달 가능 경로를 제거/비식별화하거나 Release에서 도달 불가임을 자동 증명해야 한다. |
| P0 | `routeBaselineService`가 좌표를 AsyncStorage key에 넣고 geometry를 저장한다 | 논리 TTL 24시간이지만 전체 stale key purge가 없어 마지막 접근이 없으면 파일이 남는다. guest 위치는 session 밖 저장하지 않는 정책과 충돌한다. |
| P0 확인 게이트 | 운영 이메일 확인, anonymous sign-in/CAPTCHA, cleanup scheduler, 백업·로그·region·보유 설정 | 로컬 `config.toml`은 운영 증거가 아니다. 값 출력 없이 운영 설정 존재/상태를 별도 확인해야 한다. |
| P1 | 로컬 완료·legacy 후기·활성 코스가 계정과 무관하게 같은 기기에서 유지되며 전체 삭제 UI가 없다 | 로그아웃/계정 교체/계정 삭제 때 유지·삭제 정책을 확정하고 정확히 고지해야 한다. |
| P1 | profile table grant가 넓고 trigger가 legacy 동의 timestamp 변경을 막지 않는다 | 본인 행 RLS는 지키지만 동의 증거 무결성은 지키지 못한다. 허용 컬럼 축소 필요. |
| P1 | course 생성 후 stops/legs insert 오류를 확인하지 않는다 | parent만 저장된 부분 course를 성공처럼 반환할 수 있다. 데이터 정합성 회귀 필요. |
| P1 | 인증·legacy 실행 catch가 원시 Error 객체를 `console.warn`한다 | token/좌표가 없다는 보장이 없다. Release 로그의 허용 필드 정책과 retention을 고정해야 한다. |

## 데이터 처리 사실표

| 데이터 항목 | 실제 처리 entry와 상태 | 기기 저장 | 서버/제3자 수신 | 계정 연결 | 보유·삭제 | 코드 근거 |
| --- | --- | --- | --- | --- | --- | --- |
| 이메일·비밀번호 | 회원가입/로그인에서 실제 입력. `signUp`, `signInWithPassword`로 Supabase Auth에 전송 | Supabase SDK가 access/refresh session을 AsyncStorage에 지속. 비밀번호를 앱 저장하는 코드는 없음 | Supabase Auth. 이메일 확인 메일 provider/SMTP 운영 설정은 미확인 | 일반 Auth user ID와 연결 | Auth 정책/백업 보유 미확인. 로그아웃은 session 종료일 뿐 계정 삭제 아님 | `LoginScreen.tsx`, `AuthContext.tsx`, `supabase.ts` |
| 일반 사용자 ID | Auth session/JWT의 `user.id`; saved course 소유자로 실제 사용 | Auth session 안에 포함 | Supabase Auth/DB | 직접 연결 | 일반 계정 삭제 entry 부재 | `AuthContext`, `courseRepository.currentUserId` |
| 출생연도·연령대 | 회원가입에서 출생연도 입력, client가 age band 계산; 일반 사용자 trigger가 profile 생성 | 가입 form state/session metadata | Auth metadata와 `public.profiles.birth_year/age_band` | user ID와 연결 | 임의 영구/백업 기간 미확인. DB 문서의 “age band만” 최소화 문구와 실제 birth year 저장이 불일치 | `AuthContext.ageBandFor/signUp`, migration 002/012 |
| 약관·개인정보 timestamp | 실제 체크 없이 가입 시 client 현재시각 생성; 누락 시 DB now 보정 | Auth metadata/session에 포함 가능 | Auth metadata와 `profiles` | user ID와 연결 | 명시 동의 증거로 사용 불가. 본인 update가 가능 | `AuthContext.signUp`, migration 002/012, profile trigger |
| 닉네임 | UI는 준비 중. column/repository 없음 | 없음 | 없음 | 없음 | 해당 없음 | `ProfileScreen`, `profile-account-contract.md` |
| anonymous Auth | Route Proxy에 session이 없을 때 CAPTCHA 뒤 실제 생성·지속 가능 | Supabase Auth session이 AsyncStorage에 지속 | Supabase Auth; Route Proxy JWT 인증 | anonymous user ID. profile trigger는 생성 제외 | DB 계약은 Auth inactivity 30일 후보·일 1회 이하 삭제. Function source는 있으나 scheduler 운영 활성/최근 성공은 미확인 | `routeProxyProductionPorts`, migration 012, `anonymous-auth-cleanup` |
| 현위치 좌표 | 권한 granted일 때 GPS를 읽는다. 자동 권한 요청 시점은 UI 흐름별로 다름 | 현재 선택/활성 snapshot과 route baseline에 남을 수 있음 | 주소 변환 시 Kakao에 직접 전송; private route는 Supabase Edge→Kakao. legacy route는 TMAP/ODsay 직접 전송 가능 | 일반 saved course면 user ID 연결; guest route 요청은 anonymous JWT와 함께 Edge에 도달 | active 종료 정상 cleanup과 route별 cache가 다름. baseline stale key 전역 정리 없음 | `TimeSetupScreen`, `ExecutionScreen`, `kakaoLocationLabelAdapter`, route adapters, `routeBaselineService` |
| 수동 검색어·수동 좌표·주소 | 장소/주소 query가 Kakao 검색으로 전송되고 provider 결과의 label/address/좌표를 사용 | search cache는 process memory 10분. 선택된 값은 active snapshot 또는 account saved course에 포함될 수 있음 | Kakao 검색/주소 API; 이후 route provider | 저장 코스만 account 연결 | 검색 query 서버 저장소는 발견되지 않음. provider 보유는 미확인 | `kakaoLocationSearchAdapter`, `locationSearchDraft`, `courseRepository` |
| private route endpoints | catalog exact pair가 아니면 origin/destination 좌표를 Supabase Function body에 전송 | private connector cache는 process memory 10분; legacy baseline은 별도 persistent | Supabase Edge가 검증 후 Kakao route에 전달 | 요청 JWT는 account 또는 anonymous일 수 있음 | DB route cache에는 private 좌표를 쓰지 않음. Edge/platform request log·Kakao 보유 미확인 | `routeProxyClientAdapter`, `privateWalkConnector`, `route-proxy/handler.ts` |
| public route cache·geometry | exact catalog POI pair만 server cache/lease/budget 사용 | mobile session/memory 재사용 가능 | Supabase DB, Kakao route | user ID/JWT/IP/검색어를 cache schema에 저장하지 않음 | route result TTL은 Edge env라 현재 값 미확인; 만료 row purge job 운영 상태 미확인 | migrations 010/011/013/014, route handler |
| 로그인 저장 코스 | account UI에서 save/replace/list/delete entry가 실제 연결됨 | UI state; 저장 실패 시 `local-*` 객체만 반환하고 영속하지 않음 | Supabase `courses/stops/legs` | user ID 직접 연결 | 개별 course delete entry 있음. 계정 전체 삭제 없음. server 보유는 “사용자 삭제까지” 문서뿐이며 백업 기간 미확인 | `AppFlowContext`, `courseRepository`, migrations 003/005/009 |
| 코스 위치·snapshot | 저장 코스에 출발/약속 label·정확 좌표·시각, 장소 좌표, route summary, recommendation snapshot 저장 | account save 전 UI state | Supabase DB | user ID 연결 | course 삭제/FK cascade 설계. 원격 cascade 실행 증거 없음 | `coursePlanRows`, `saveCourseToRepository`, migrations 003 |
| 서버 후기·행동 event | table/RLS는 준비돼 있으나 `.from('course_feedback')`/`.from('recommendation_events')` production writer가 없음 | 해당 없음 | 현재 production 수집으로 판정하지 않음 | schema상 user ID | 계정 cascade 설계만 존재 | migrations 004/005, repository 전역 검색 |
| legacy 장소 후기 | Feedback 제출 시 실제 AsyncStorage 저장: 장소 ID/명/분류/rating, 계획 기반 합성 dwell, revisit | `@timefit/place-feedback-v1`, 최대 1,000개 | 서버 자동 업로드 없음 | 계정 ID 없음; 기기 공유 | 시간 보유기간/전체 clear UI 없음 | `placeFeedback.ts`, `FeedbackScreen.tsx` |
| 명시 코스 완료 기록 | `코스 마치기` production entry에서 실제 저장. 1~2곳 ID/명/분류, plannedStay, optional actual dwell | `@timefit/course-completions-v1`, 최대 1,000개 | 서버 자동 업로드 없음 | 계정 ID 없음; guest/account 공통 기기 기록 | typed clear는 있으나 consumer 없음. 개수 상한만 있고 기간 없음 | `courseCompletionRepository`, `CourseConfirmScreen` |
| 활성 검증 코스 snapshot | 시작/갱신 시 전체 `ActiveVerifiedCourse`를 실제 지속 | `@timefit/active-verified-course-v1`; session·course에 label/좌표/시각/장소/route가 포함 | 서버 자동 업로드 없음 | 계정 ID 없음 | 정상 clear/교체 때 삭제. write/clear 실패는 호출자가 관찰하지 않으며 계정 삭제와 연결 안 됨 | `activeVerifiedCourseStorage`, `AppFlowContext`, model types |
| Live Activity 로컬 진행 | 첫 Kakao handoff 성공 뒤 courseRunId, 장소 ID/명, 계획 체류, 도착/출발 exact epoch, route 경계, event IDs를 실제 저장 | App Group `TimeFitLocalProgress-v1.json`, receipt inbox, ActivityKit state | Apple OS Live Activity/로컬 notification subsystem. URLSession/APNs/서버 upload 없음 | account ID 없음 | terminal 상태를 먼저 쓰고 exact Activity/notification cleanup 성공 뒤 progress clear. 실패 대상 queue는 재시도용 유지 | liveActivity runtime/native Swift, terminal cleanup tests |
| 로컬 알림 | 출발/도착 안내와 notification ID registry를 실제 저장·예약 | AsyncStorage registry와 OS 예약 알림; lock screen에 장소/행동 문구 표시 가능 | OS notification subsystem, remote push token 없음 | account ID 없음 | terminal exact cancel; 실패 ID는 cleanup queue에 유지 | `courseProgressNotifications`, `courseNotifications`, plugin entitlement/tests |
| Live Activity 진단 | intent/app 단계·결과·고정 error·attempt ID·phase/revision/build를 항상 로컬 기록 | App Group 파일, stream별 최대 32개; file protection 적용. 사용자가 복사하면 pasteboard | 서버 전송 없음 | user/courseRun/place/좌표를 event schema에 넣지 않음 | 최대 개수 trim과 수동 clear. terminal 자동 clear/기간 제한은 없음 | `TimeFitLiveActivityDiagnostics.swift`, diagnostics model/tests |
| legacy route 진단·baseline | TMAP/ODsay 호출 수와 정확 endpoint 좌표를 console에 출력. usage count와 baseline geometry 저장 | usage count AsyncStorage; baseline key에 두 endpoint 좌표, value에 geometry/fetchedAt | device log; route providers | user ID 없음이나 위치 자체가 식별 가능 | baseline freshness 24h지만 stale key 전역 삭제 없음. OS/console log 보유 미확인 | `travel.ts`, `routeBaselineService.ts` |
| 위치·알림 권한 상태 | Profile은 read-only 조회, route 흐름은 필요 시 foreground/notification 요청 | OS 설정 | Apple OS | 기기 단위 | 앱 DB 저장 없음 | `profileSettingsPort`, Location/Notifications calls |
| SDK/네트워크 구성 | Supabase, Expo Location/Notifications/WebBrowser, React Native WebView가 포함. Firebase/Sentry/광고 SDK dependency는 발견되지 않음 | SDK별 OS/app storage | Supabase, Kakao/legacy provider, CAPTCHA 페이지, 외부 image/map host 가능 | 흐름별 상이 | SDK 선언만으로 실제 수집을 확정하지 않음. native privacy manifest와 네트워크 관찰은 QA/API 게이트 | `package.json`, `app.json`, imports |

## DB·RLS·삭제 감사

### 확인된 방어

- user tables 6개(`profiles`, `courses`, `course_stops`, `course_legs`, `course_feedback`, `recommendation_events`)에 RLS enable migration이 있다.
- courses/profile/feedback은 `auth.uid()` 본인 행, child graph는 소유 course 존재 조건을 사용한다. `replace_course_plan`은 `security invoker`이고 owner course를 먼저 확인한다.
- route cache/lease/budget와 anonymous cleanup run/audit는 public/anon/authenticated 권한을 회수하고 service role RPC만 노출한다.
- `profiles`, `courses`, `course_feedback`, `recommendation_events`는 Auth user 또는 course FK cascade가 설계돼 있다.
- 공개 route cache에는 user ID, IP, private endpoint, JWT, 검색어, provider 원문/API key 컬럼이 없다.

### 확인된 결함·미확인

1. **anonymous 격리 실패 가능성(P0):** anonymous Auth도 Postgres `authenticated` role이다. course/profile policies는 JWT의 anonymous 여부를 검사하지 않는다. anonymous profile은 trigger가 막지만 courses는 `auth.users(id)`만 FK이므로 직접 REST insert가 가능하고, 연결 행이 생기면 30일 cleanup 후보에서도 제외된다. UI `requireAccountSession` 테스트 12건은 consumer guard만 증명하며 DB 격리를 증명하지 않는다.
2. **동의 무결성(P0/P1):** `profiles_update_own`과 table-wide update grant가 있고 guard는 terms/privacy timestamp 변경을 막지 않는다. 자동 생성된 값을 법적 동의 증거로 사용할 수 없다.
3. **계정 삭제 부재(P0):** `purge_account_data(uuid)`는 service-role helper일 뿐 호출 Edge Function이 없다. 재인증, JWT identity, anonymous 거절, forged userId, Storage/Auth 부분 실패, 멱등/재시도, client 성공 확인이 구현되지 않았다.
4. **부분 course(P1):** parent insert 성공 뒤 stops/legs 두 insert의 `error`를 검사하지 않고 성공 객체를 반환한다. transaction/RPC가 아니어서 graph 일부가 없을 수 있다.
5. **실행 검증 부족:** user table RLS는 SQL 문자열/코드 판독만 확인했다. disposable user A/B/anonymous로 실제 PostgREST/RPC 격리와 account cascade를 실행하는 테스트가 없다.
6. **원격 상태:** 2026-09-03 문서에는 migration 001~014 local/remote 일치가 기록돼 있지만 이번 감사에서 재조회하지 않았다. DB backup/PITR, deleted-row backup retention, project region, Auth/Edge/Postgres log retention, support access, DPA/subprocessor 설정은 미확인이다.

## 계정·기기 경계

- 로그인 전/anonymous/account는 UI에서 구분되고 anonymous를 프로필 account로 표시하지 않는 fixture가 통과한다.
- 그러나 로그아웃은 Supabase `signOut`만 수행한다. completion, legacy feedback, active snapshot, App Group progress, notification/cleanup queue를 지우거나 account별 namespace로 분리하지 않는다.
- 로그인/계정 교체가 guest 완료 기록을 서버로 자동 병합하지 않는 것은 확인됐다. 반대로 같은 기기를 다른 사람이 쓰면 이전 device-local 기록이 그대로 보일 수 있다.
- 서버 계정 삭제와 device-local 기록 삭제는 별도 결정이다. “계정 삭제 시 전부 삭제”라고 표시하려면 로컬 각 저장소와 OS Activity/notification의 완료 확인까지 필요하다.
- 일반 계정 생성 유지 시 `DB-PROFILE-ACCOUNT-01`의 닉네임·명시 동의·delete-account 계약을 승인하고 구현/RLS/전용 계정 E2E를 통과해야 한다.

## Live Activity·체류·진단 판정

- DB-DWELL-01 migration/repository/table은 없다. `supabase.from/rpc/fetch`를 사용하는 dwell upload queue도 없다. 따라서 서버 체류 표본·파생 profile·개인화 적용은 **실제 미구현/꺼짐**이다.
- 도착·출발 raw epoch는 local App Group progress/receipt에만 존재한다. 완료 projection은 둘 다 확인된 경우에만 분을 계산하며, legacy 합성 dwell은 실제 체류로 승격하지 않는다.
- terminal cleanup은 progress를 즉시 지우기 전에 Activity identity와 owned notification IDs를 queue에 보존한다. 종료 성공 뒤 progress를 clear하고, 부분 실패면 실패 대상만 cold-start/foreground에서 재시도한다. 집중 fixture가 이를 통과했다.
- active full snapshot은 별도 AsyncStorage다. progress cleanup과 active snapshot clear가 서로 다른 비동기 entry이므로 write/clear 실패의 관찰·재시도 계약은 없다.
- 진단은 stream별 32건 상한과 허용 필드 schema가 있으나 production native code도 기록한다. 화면 노출/복사는 `__DEV__` 또는 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS === 'true'`일 때 열린다. 최종 Release artifact에서 이 flag가 false/unset이고 개발/QA 화면이 보이지 않는지는 QA가 증명해야 한다.

## 제출 전 조치와 합격 조건

### P0 — 제출 차단

1. **계정 삭제:** 승인된 `DB-PROFILE-ACCOUNT-01` 계약으로 앱 내 진입, recent reauth, JWT-derived identity, anonymous/userId 위조 거절, Auth+public data+local 선택 범위, 멱등/부분 실패를 구현한다. disposable account로 생성→소유행→삭제→Auth/public 0건을 검증한다.
2. **anonymous DB 차단:** 모든 account-owned table/RPC가 anonymous JWT에서 read/write/delete 0건인지 실제 DB fixture로 증명한다. UI guard가 아니라 RLS/server predicate를 교정한다. cleanup candidate가 linked row 때문에 영구 보류되지 않아야 한다.
3. **가입 동의/공개 문서:** 실제 개인정보 문서 URL·버전과 unchecked 명시 동의를 제공하고 server timestamp evidence를 남긴다. 기존 timestamp를 소급 증거/체류 opt-in으로 쓰지 않는다. 미확정이면 첫 출시에서 계정 생성을 비활성화하는 제품 결정을 받아야 한다.
4. **정확 위치 로그/잔존:** `travel.ts`의 exact-coordinate console output을 제거 또는 안전한 count/reason으로 교체한다. persistent route baseline을 제거하거나 bounded global purge와 명시 local purpose/retention을 구현한다. guest 종료/초기화 fixture에서 stale coordinate keys 0을 확인한다.
5. **운영 확인:** secret 값을 출력하지 않고 email confirmation, anonymous Auth+CAPTCHA, cleanup Function scheduler와 최근 집계 결과, migration 상태, Release diagnostics flag를 확인한다. 운영 확인 전 PASS로 승격하지 않는다.

### P1 — 출시 전 권장

- profiles 권한을 실제 허용 컬럼으로 축소하고 legacy 동의 timestamp update를 차단한다.
- course graph 저장을 transaction/RPC로 바꾸거나 child insert 실패를 typed failure로 반환·정리한다.
- device-local 완료/legacy 후기/active/progress/알림의 로그아웃·계정교체·계정삭제 정책과 사용자 clear entry를 확정한다.
- 원시 Error console logging을 code-only diagnostic으로 제한하고 Release log/diagnostic 보유를 문서화한다.
- 로컬 완료/legacy 후기의 기간 또는 사용자 삭제 수단을 확정한다. 1,000건 상한은 보유기간이 아니다.
- birth year를 계속 보유할 필요와 age band만 저장한다는 문서 불일치를 통합 결정으로 반환한다.

## API 세션 인수인계 — 외부 전송·캐시·제공사 약관

DB 감사에서는 recipient와 code path만 확인했다. 아래는 **외부 API 어댑터 세션이 provider별 공식 현행 문서로 상세 확인**해야 하며 이번 문서가 적합 판정을 대신하지 않는다.

1. **Kakao location search/reverse geocode:** 검색어, GPS/수동 좌표가 모바일에서 Kakao로 직접 전송된다. process-memory cache는 query 10분/최대 100, label 10분/최대 64다. 검색/역지오코딩 결과와 주소·좌표의 앱 내 저장/표시, attribution, 캐시 허용 기간, 파생·재배포 제한을 공식 약관과 대조한다.
2. **Kakao route via Supabase Edge:** private endpoints는 Supabase Edge와 Kakao가 받고, public POI route geometry는 Supabase DB에 TTL cache한다. private 비영속이 Edge/gateway/provider log까지 뜻하는지, route geometry/step의 저장·재표시·TTL, 제공사 식별/attribution, API별 quota/목적 제한을 확인한다.
3. **legacy TMAP/ODsay:** `ExecutionScreen`에서 direct call과 24시간 baseline persistence가 여전히 도달 가능하다. Release 경로 사용 여부, client key 노출, exact coordinate 전송, geometry cache, 로그, TMAP/ODsay 결과 혼합·표시 조건을 각각 확인한다. 사용하지 않으면 Release에서 도달 불가임을 test로 고정한다.
4. **KakaoMap 앱/웹 handoff:** 길찾기 URL에 endpoint/장소 정보가 전달되고 Kakao 앱 미설치 시 web browser로 이동할 수 있다. URL parameter, 외부 browser referrer/로그, 사용자 고지와 attribution을 확인한다.
5. **CAPTCHA WebView/Function:** challenge page/공급자, token 목적·수명, origin allowlist, IP/device/network metadata 처리, Supabase Function log를 확인한다. token을 app/DB diagnostic에 남기지 않는 현재 계약을 유지한다.
6. **지도·사진:** Kakao 지도 WebView/tiles와 원격 `imageUrl` host는 표시 시 IP·user-agent 등의 network metadata를 받을 수 있다. catalog source별 image hotlink/캐시/attribution 허용과 privacy recipient를 확인한다.
7. **운영 cache/job:** `ROUTE_PROXY_CACHE_TTL_MS`, expired cache purge, fetch lease purge, budget retention, anonymous cleanup schedule의 실제 운영값/활성 상태를 값 노출 없이 확인한다.
8. **배포 제외 확인:** 저장소에 `route-geometry-diagnostic` Function source가 남아 있다. 과거 문서는 원격 임시 Function 삭제를 기록하지만, 최종 배포/CI가 이를 다시 배포하지 않는지 확인한다.

API 인수인계 완료 조건은 provider별 `전송 필드 / 수신자·region / 목적 / cache·로그 보유 / 삭제·권리 / attribution·약관 근거 / Release 사용 여부` 표와 공식 URL·확인일을 남기는 것이다. 임의 보유기간이나 “provider가 저장하지 않는다”는 추정을 금지한다.

## 운영·통합 세션 결정 필요

1. 계정 기능을 첫 출시에서 유지할지. 유지하면 앱 내 삭제와 명시 동의가 P0이며, 제거하려면 UI만 숨기지 말고 remote signup/API 접근도 함께 차단해야 한다.
2. device-local 기록을 로그아웃·계정 교체·계정 삭제에서 유지/전체 삭제/사용자 선택 중 어떻게 처리할지.
3. 정확 birth year 보유를 유지할지 age band only로 줄일지.
4. 공개 운영자/지원 이메일, 개인정보 처리방침 URL, 실제 약관/개인정보 문서 버전, Supabase/외부 recipient와 국외 처리 표기.
5. Supabase project region, backup/PITR/deleted-row recovery 기간, Auth/Edge/Postgres log 보유, support access와 계정 삭제 시 백업 처리 문구.
6. P0 교정 전 TestFlight 내부 검증까지만 허용하고 공개 심사 제출은 막을지. 본 감사 권장은 **공개 제출 보류**다.

## 실행 증거

- migration/route privacy 계약: `20/20` 통과, 실패·skip 0.
- completion/local progress/terminal cleanup/diagnostics/runtime account guard: `36/36` 통과, 실패·skip 0.
- 첫 `tsx` 실행은 sandbox IPC socket `EPERM`으로 테스트 시작 전에 중단됐고, 동일 명령을 허용된 실행으로 재시도해 36/36을 확인했다.
- 이 테스트들은 local source/fixture 계약이다. 운영 RLS, 원격 삭제, scheduler, provider 약관, 실제 Release artifact를 증명하지 않는다.
- 기존 tracked 변경의 `git diff --check`와 신규 보고서의 별도 `--no-index --check` 모두 공백 오류 없이 통과했다.

## 완료 인수인계

### 1. 변경 파일과 목적

- `docs/work/db-personalization/release-data-audit.md`: 출시 데이터 사실표, DB/RLS/삭제 판정, P0/P1, 원격 미확인, API 세션 인수인계를 기록했다.

### 2. 유지한 계약

- 제품/DB schema/migration/RLS/Function/UI/engine/data/env를 수정하지 않았다.
- 서버 체류 개인화 보류, 로컬 완료 기록, anonymous 30일 후보 계약, public/private route cache 분리를 변경하지 않았다.
- 제공사 약관·운영 삭제·backup/region을 확인 완료로 추정하지 않았다.

### 3. 테스트 결과

- 관련 local fixture `56/56` 통과, 실패·skip 0. 운영 DB/API/메일/계정 생성·삭제 호출 0회.
- 공백 검사: 기존 tracked 변경과 신규 보고서 모두 통과했다.

### 4. 다음 결정·위험·재현 조건

- P0 5묶음을 닫고 원격 게이트를 확인하기 전 공개 제출을 승인하지 않는다.
- DB 후속은 account 삭제/명시 동의/anonymous RLS와 실제 A/B/anonymous 격리 테스트다. engine/QA 후속은 exact-coordinate console/persistent baseline 제거·Release 도달성 검증이다.
- API 후속은 위 8개 provider/운영 항목의 공식 근거 감사다.
- 재현은 `AuthContext.signUp`, migrations 002/005/008/012, `courseRepository.currentUserId`, `purge_account_data`, `travel.markRouteCall/markOdsayCall`, `routeBaselineKey`, local Live Activity storage를 실행 또는 fixture로 대조한다.
