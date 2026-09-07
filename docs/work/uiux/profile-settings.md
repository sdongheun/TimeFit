# U-PROFILE-SETTINGS-01 — 내정보·로그인 진입 정리

## 후속 보완 명령 — U-PROFILE-SETTINGS-01-R

상태: **1단계 UI 보완·자동 회귀 완료 / 실기기 체크리스트 실행 대기 / 2단계 가입·저장 연결은 승인 계약 대기**.

```text
U-PROFILE-SETTINGS-01-R을 진행해. 이 파일 완료 인계와 docs/work/integration-decision/profile-settings.md를 읽어. 이번 보완을 기본 UI와 계약 의존 기능으로 분리한다.

1단계(즉시 가능): 사용자용 문구에서 '닉네임 저장 계약' 같은 내부 구현 용어를 제거해 '닉네임 기능은 준비 중이에요'처럼 정리한다. 준비 중을 실제 저장 버튼으로 가장하지 않는다. 문서 최상단의 구현 전 상태를 기본 UI 완료·계약 연결 대기로 정정하고 자동/실기기 미확인을 구분한다. 로그인·가입 전환은 제출 중 비활성화해 진행 중 요청과 화면 모드가 달라지지 않게 한다. 실패 시 다시 입력/제출 가능, 취소 후 늦은 응답이 화면 이동하지 않는 회귀를 추가한다. 기존 기본 UI/권한 조회/설정 실패 테스트와 타입 검사를 실행한다. 사용자에게 비로그인 내정보·메인 로그인 취소/완료 복귀·프로필 로그아웃·OS 설정 복귀 갱신 체크리스트를 제공한다. Simulator를 직접 반복 조작하지 마.

2단계(대기): docs/work/db-personalization/profile-account-contract.md의 DB-PROFILE-ACCOUNT-01 결과를 통합 세션이 승인하고 실제 repository/서버 구현이 제공된 뒤에만 연결한다. 닉네임 필드·계정 삭제 endpoint·동의 metadata를 임의로 추가하지 않는다. 지금 회원가입의 '기존 가입 절차를 따릅니다'는 명시 동의 구현이 아니므로 완료로 표시하지 않는다. 후속에는 승인된 문서/버전을 확인하는 필수 동의 UI와 가입 입력 검증을 AuthContext 계약에 함께 연결한다. 선택 체류 동의를 필수 약관에 묶지 않는다. 계약 승인 전 가입 저장 정책을 UI만으로 변경하지 않는다.

정책 URL·문의 주소는 사용자 확정 전 만들지 않는다. 계정 삭제는 가짜 버튼·signOut 대체 금지다. 추천/진행/guest 기록 보존, anonymous 분리, 새 자동 권한 요청 없음은 불변이다. 수정 파일/테스트/사용자 확인/계약 대기를 같은 문서에 기록하고 중앙 문서·DB·env·commit/push는 변경하지 마. 1단계 통과를 전체 프로필/출시 완료로 보고하지 않는다.
```

DB 계약 조사와 1단계 UI 보완은 병렬 가능하다. DB는 문서·읽기 전용 조사, UI는 화면·UI 테스트만 소유한다. 2단계의 AuthContext/App/nav 연결은 UI 단일 작성자이며 별도 구현 승인 후 진행한다.

상태: **기본 UI와 U-PROFILE-SETTINGS-01-R 1단계 구현·자동 검증 완료 / 계약 의존 2단계 대기**. 기준: [DEC-PROFILE-SETTINGS-01](../integration-decision/profile-settings.md). 실기기 체크리스트는 작성했으나 아직 실행하지 않았고, 기능 전체 완성을 뜻하지 않는다.

## 목적·확인된 현재 상태

현재 ProfileScreen 안에 이메일 로그인/회원가입 form과 account 표시가 함께 있다. 첫 화면을 내 프로필·권한 및 맞춤 추천·앱 안내로 단순화하고, 로그인은 별도 명시 진입으로 분리한다. AuthContext 공개 API는 signIn/signUp/signOut이며 닉네임 쓰기·계정 삭제 계약은 이 파일에서 확인되지 않았다. 다른 repository에 없다고 단정하지 않고 먼저 조사한다.

ProfileScreen의 가입 문구는 개인화 데이터 이용까지 일괄 동의로 표현한다. 이는 별도 opt-in 결정과 충돌하므로 재사용하지 않는다. 회원가입 보안/연령/이메일 인증 흐름을 임의로 제거하는 권한은 아니다.

이전 로그인 form 중심 내정보·일괄 동의 문구 → 비로그인 설정 접근과 별도 수집 동의 요구에 불일치 → 공개 내정보와 명시 로그인/관리 화면 분리 → 인증·권한·동의를 서로 독립적으로 유지 → **확정·구현 전**.

## 복사할 작업 명령

```text
U-PROFILE-SETTINGS-01을 수행해. AGENTS.md, docs/README.md, docs/work/uiux/profile-settings.md, docs/work/integration-decision/profile-settings.md와 공통 UIUX 규칙의 DEC-PROFILE-SETTINGS-01을 읽어. 과거 내정보의 로그인 form/기록 관리 추가 제안을 현행으로 복원하지 마.

1. 수정 전 기존 ProfileScreen, AuthContext/authKind projection, HomeScreen, App/nav/mainTabNavigation, 권한 조회 및 설정 이동, 프로필 repository/계정 삭제/동의 저장 계약, 정책 URL/문의 채널/앱 버전을 읽기 전용으로 확인한다. 재사용 가능한 entry와 부족한 계약을 이 문서에 표로 남긴다. nickname/user metadata 키나 삭제 endpoint를 추정해서 만들지 않는다. 권한 조회가 prompt를 띄우는 함수인지도 확인한다.

2. 기존 production handler를 쓰는 실패 선행 fixture를 추가한다. 내정보 진입이 로그인 form을 강제하는 현재 상태, 메인 프로필 진입, null/anonymous/account/loading, 로그인 완료/취소 뒤 복귀·선택/활성 코스 보존을 먼저 검증한다. 프로필 저장/삭제·권한·링크는 외부 adapter를 fixture로 대체한다.

3. 내정보는 항상 공개 화면이며 제목을 로그인으로 바꾸지 않는다. 첫 영역은 비로그인 로그인 안내, account 닉네임+프로필 관리, loading은 해당 계정 영역만 대기한다. 나머지 권한/앱 안내 접근은 막지 않는다. 닉네임 없음은 닉네임 설정하기로 안내하되 쓰기 계약이 없으면 저장 완료를 가장하지 말고 미연결 항목으로 인계한다. 사진 업로드·새 통계·즐겨찾기·방문 기록 관리 메뉴는 추가하지 않는다. 이메일을 대표 닉네임으로 노출하지 않는다.

4. 로그인/회원가입 form을 별도 화면으로 분리하되 기존 signIn/signUp 계약과 이메일 확인·비밀번호/연령 검증·실패/재시도 기능을 보존한다. 기존 가입 시 개인화까지 자동 동의 문구는 제거하고 별도 선택 동의임을 정확히 안내한다. 기존 DB signUp이 동의를 자동 기록하는지 확인하고 발견하면 타 역할 수정 대신 계약 충돌로 반환한다. 이용약관 동의를 임의로 삭제하거나 새 동의 저장을 만들지 않는다. 미구현 저장 동기화/개인화를 로그인 혜택으로 확정 홍보하지 않는다.

5. 메인 우상단 safe area 아래에 작은 프로필 버튼을 추가한다. 비로그인→로그인 화면, account→내정보, loading→중복 진입 방지다. 내정보 계정 영역의 로그인도 같은 화면을 사용한다. 로그인 완료/취소는 호출한 화면으로 돌아가고 내정보 호출이면 갱신된 내정보로 돌아간다. 성공을 Promise 완료만으로 단정하지 말고 실제 account 상태를 확인한다. 이메일 인증 대기 signUp은 로그인 완료로 처리하지 않는다. 뒤로가기/취소 뒤 늦게 도착한 응답이 강제 화면 이동을 만들지 않게 한다. route params에 세션·비밀번호·함수·코스 복사본을 넣지 않는다. 최상위 탭은 즉시 전환, 로그인 상세는 기존 stack을 활용하며 root reset으로 선택/진행 상태를 초기화하지 않는다.

6. 프로필 관리에는 기존 계약으로 가능한 닉네임 표시/수정, 로그아웃, 계정 삭제를 연결한다. 중복 submit 방지, 실패 시 현재 화면 유지, 삭제 전 확인을 제공한다. signOut을 계정 삭제처럼 쓰거나 UI state만 바꾸고 서버 삭제 성공이라 하지 않는다. 계약 없는 항목은 요구사항 미완료로 명확히 인계하며 가짜 성공 버튼은 만들지 않는다. authKind anonymous는 일반 로그인과 구분하고 raw Proxy session은 UI 진입 때문에 sign-out하지 않는다. 로그인/로그아웃에 guest 기록 자동 병합·수집 동의·코스 완료를 발생시키지 않는다.

7. 권한 영역은 위치/알림의 실제 상태와 명시 설정 이동을 제공한다. 화면 진입은 read-only 조회이며 권한 요청을 자동 실행하지 않는다. 기존 initializeNotifications처럼 요청도 수행하는 helper를 조회용으로 재사용하지 마. 미결정/거절/허용/지원 불가/조회 실패를 구분하고 설정 앱 복귀 때 재조회한다. 설정 열기 실패는 화면에 남아 재시도 가능하게 한다. 네이티브 wrapper는 기존 모듈을 우선하고 테스트 가능한 경계로 분리한다. 체류 동의/Live Activity는 기존 공개 계약이 있을 때만 실제 연결; 없으면 토글/성공 상태를 노출하지 않고 후속 인계한다. 이번에 native capability·배경 위치·알림 예약을 추가하지 않는다.

8. 앱 안내에는 확인된 개인정보/위치정보 안내, 문의, 실제 앱 버전을 간결하게 둔다. 문의 메일/웹 URL은 추정 금지. 채널 부재는 사용자 결정 필요로 남기고 inert link를 완성 기능으로 제출하지 않는다. 외부 링크 실패/미설치 처리도 fixture로 검증한다. 기존 다크/파랑, 일반 눌림 애니메이션·햅틱 없음, floating tab 유지, 충분한 터치 영역과 큰 글씨/scroll bottom 가림 방지를 지킨다.

9. 소유 범위는 src/ui 및 UI 테스트, 최소 App.tsx/nav.ts/mainTabNavigation 연결이다. 이 파일들은 단일 작성자이며 다른 UI 작업과 동시 편집하지 않는다. DB schema/repository 정책, 원본 데이터, 엔진/API, env·키·새 의존성은 수정하지 않는다. 계약 부족이면 가능한 UI 범위는 완료하고 차단 항목·필요 entry/input/output/실패 경계를 DB 또는 통합 세션에 넘긴다. 공개 API를 임의로 만들어 맞추지 않는다.

10. 집중 fixture, npm run test:typecheck, npm run test:ui, npm test, npx expo export --platform ios, git diff --check를 실행한다. 실패 skip/삭제·운영 Auth/DB 계정 생성·삭제·실제 메일 발송·외부 API 반복·Simulator 수동 순회는 하지 않는다. 자동/기기 증거를 구분한다. 사용자 확인은 비로그인 내정보, 메인 로그인 취소/완료 복귀, account 닉네임/로그아웃, 시스템 설정 복귀를 짧은 목록으로 전달한다. 실제 계정 삭제 테스트는 전용 계정과 별도 승인 전 실행하지 않는다.

11. 이 문서에 변경 파일/유지 계약/실패 선행과 최종 테스트/남은 계약과 사용자 확인을 남긴다. UI 기본 구성 완료와 닉네임 쓰기·삭제·체류 동의 전체 완료를 구분한다. 중앙 문서/보드 변경 및 commit/push는 하지 않는다.
```

## 순서와 후속

- 이번 UI 작업은 먼저 실행한다. 닉네임/삭제/동의 계약이 없을 경우 발견 내용에 근거해 별도 DB 작업을 발행한다.
- Live Activity 연계 토글은 기본 화면 수정과 별개다. UIUX 두 작업이 App/nav/Profile을 동시에 편집하지 않는다.
- 정책 URL·문의 채널·닉네임 규칙의 신규 결정이 필요하면 사용자에게 실제 필요한 항목만 요청한다.

## 구현 전 계약 조사 — 2026-09-05

| 확인 항목 | 확인 위치 | 재사용/부족 판정 | 이번 처리 |
| --- | --- | --- | --- |
| 일반 로그인 판정 | `AuthContext`, `authStateModel` | `authKind`와 `accountSession` 재사용 가능. anonymous는 guest이고 raw Proxy session은 별도 유지 | 화면 분기에 그대로 사용하고 UI 진입을 위한 sign-out은 하지 않음 |
| 로그인·회원가입·로그아웃 | `AuthContext` | `signIn`/`signUp`/`signOut` 공개 계약 존재 | 별도 Login 화면과 프로필 관리의 로그아웃에 연결 |
| 가입 동의 metadata | `AuthContext.signUp` | `terms_agreed_at`, `privacy_agreed_at`를 가입 시 자동 기록. 이것이 필수 약관 동의인지 별도 수집 동의인지 UIUX가 확정할 공개 계약은 없음 | 코드는 수정하지 않고, 과거 “개인화 자동 동의” 문구만 제거. 통합·인증 계약 확인 필요로 인계 |
| 닉네임 조회·쓰기 | `src/`, repository 전역 검색 | 합의된 metadata key, validation, read/write repository 없음 | 이메일을 닉네임으로 대체하지 않고 `닉네임 설정하기`와 준비 상태만 표시. 저장 행동은 만들지 않음 |
| 계정 삭제 | 앱 repository/API 전역 검색 | 일반 계정 삭제 공개 endpoint 없음. 발견된 admin 삭제는 anonymous cleanup 서버 경계로 앱에서 사용할 수 없음 | 삭제 버튼·가짜 성공을 만들지 않고 후속 계약으로 인계 |
| 체류 기록 동의 | UI/repository 전역 검색 및 DEC-LIVE-DWELL | 정책 결정은 있으나 읽기·쓰기·철회 공개 계약은 아직 없음 | 토글을 만들지 않고 미수집 안내만 표시 |
| 위치·알림 권한 | `expo-location`, `expo-notifications`, `courseNotifications` | `getForegroundPermissionsAsync`/`getPermissionsAsync`는 read-only. `initializeNotifications`는 미결정 권한을 요청하므로 조회용 재사용 불가 | 별도 read-only adapter 사용. 앱 시작 시 `initializeNotifications` 호출을 제거하고 기존 명시 알림 일정 경계는 유지 |
| 시스템 설정 이동 | React Native `Linking.openSettings` | 재사용 가능, reject 가능 | 명시 버튼·실패 안내·같은 버튼 재시도와 AppState active 재조회 연결 |
| 정책·문의 채널 | 앱 설정·문서·UI 전역 검색 | 확정 URL/메일 없음 | 링크를 만들지 않고 `공개 채널 준비 중`/`문의 채널 준비 중`으로 사실만 표시 |
| 앱 버전 | `app.json` | Expo 실제 version `1.0.0` | 런타임 화면에서 동일 설정 값을 표시 |

## 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `src/ui/ProfileScreen.tsx`: 로그인 강제를 제거하고 내 프로필/권한 및 맞춤 추천/앱 안내 세 영역을 guest·anonymous·account·loading에 맞게 공개했다. account loading은 계정 영역에만 한정하고, 프로필 관리 안쪽에는 계약이 있는 로그아웃만 연결했다.
- `src/ui/LoginScreen.tsx`: 기존 signIn/signUp, 이메일·비밀번호 확인·만 14세 출생연도 검증과 오류 재시도를 별도 stack 화면으로 옮겼다. 실제 account 전이에서만 `goBack`하고 취소/blur/unmount 뒤 늦은 응답은 이동하지 않는다.
- `src/ui/profileSettingsPort.ts`: 위치·알림 상태를 prompt 없이 읽고 `granted/denied/undetermined/unavailable/error`로 정규화하며 시스템 설정 이동을 분리했다.
- `src/ui/HomeScreen.tsx`: safe area 아래 우상단 44pt 프로필 entry를 추가했다. guest/anonymous는 Login, account는 Profile, loading은 disabled이며 reset을 쓰지 않는다.
- `src/ui/nav.ts`, `App.tsx`: `Login` stack route를 최소 연결했다. 앱 시작 시 알림 permission prompt를 발생시키던 호출은 제거했으며 알림 일정 helper와 권한 요청 계약 자체는 변경하지 않았다.
- `test/ui/profile-settings-screen.test.mjs`: production 화면 handler와 권한 adapter의 고정 fixture를 추가했다.

### 2. 유지한 공개 계약·정책 경계

- 추천 엔진·외부 API·원본 데이터·DB repository·Supabase 스키마와 일반/anonymous 인증 판정은 변경하지 않았다.
- 로그인/로그아웃에 guest 완료 기록 병합·업로드, 진행 코스 초기화, 추천 재호출, 체류 동의, 완료 처리를 추가하지 않았다. route params에도 세션·비밀번호·함수·코스 복사본을 넣지 않았다.
- 닉네임 key/검증/저장, 계정 삭제 endpoint, 체류 동의 저장, 정책 URL·문의 주소를 추정하지 않았다. 계정 이메일도 대표 닉네임으로 노출하지 않는다.
- 일반 버튼 haptic, Live Activity, background location, 알림 예약/capability 변경은 추가하지 않았다. floating tab과 다크/파랑 테마를 유지했다.

### 3. 실패 선행과 최종 테스트 결과

- 실패 선행: production 화면 fixture를 구현 전에 추가한 최초 실행은 **0/5 실패**했다. 새 Login 화면·권한 adapter는 `ENOENT`였고, Home/Profile은 fixture의 native module 격리가 덜 되어 assertion 진입 전에 실패했다. 격리 경계를 바로잡은 뒤에는 새 handler 계약을 그대로 유지해 최종 fixture로 검증했으며, 기존 Profile의 로그인 form 강제와 Home entry 부재는 수정 전 source 조사 결과로 별도 확인했다.
- 최종 집중: `npx tsx --test test/ui/profile-settings-screen.test.mjs` **6/6 통과**. null/anonymous/account/loading 목적지, 세 영역 공개, 설정 복귀 재조회, 다섯 권한 상태, 설정 실패 재시도, account 상태 성공 복귀, 취소 뒤 늦은 응답 차단을 확인했다.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **431 pass / 0 fail / 의도 skip 1**.
- `npm test`: **219/219 통과**.
- `npx expo export --platform ios`: 통과, iOS bundle 생성. 실제 Auth/메일/권한 prompt/외부 API/Simulator/실기기는 실행하지 않았다.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·사용자 확인

- **UI 기본 구성은 완료**, 닉네임 쓰기·계정 삭제·체류 동의는 계약 부재로 **미완료**다. 후속 DB/통합 계약에는 각각 (a) 닉네임 canonical field와 validation/read/write/error, (b) 재인증·확인·서버 삭제·부분 실패/재시도, (c) 동의 상태 read/write/revoke 및 실제 수집과의 원자 경계가 필요하다.
- `AuthContext.signUp`이 현재 `terms_agreed_at`과 `privacy_agreed_at`을 자동 기록한다. 별도 체류 동의로 사용하지는 않았지만, 필수 약관의 명시 확인 방식과 metadata 의미는 통합·인증 소유자가 확정해야 한다.
- 개인정보/위치정보 정책의 실제 HTTPS URL과 문의 채널이 확정되면 링크 adapter와 미설치/열기 실패 fixture를 추가해야 한다. 현재는 inert 링크를 제공하지 않는다.
- 실제 기기에서는 비로그인 내정보 세 영역, Home 로그인 취소/완료 후 기존 화면·선택·active 유지, account 닉네임 준비 상태/로그아웃 실패, iOS 설정에서 위치·알림 변경 후 복귀 갱신을 제한 확인한다. 계정 삭제 실험은 계약과 전용 계정·별도 승인 전 금지한다.

## U-PROFILE-SETTINGS-01-R 1단계 완료 인수인계 — 2026-09-06

### 1. 변경 파일과 변경 목적

- `src/ui/ProfileScreen.tsx`: `닉네임 저장 계약`, `공개 채널`처럼 사용자가 알 필요 없는 구현 표현을 `닉네임 기능은 준비 중이에요`, `안내 페이지 준비 중`, `문의 방법 준비 중`으로 정리했다. 체류 기록도 연결 상태 설명 대신 현재 수집하지 않는다는 사실만 안내한다.
- `src/ui/LoginScreen.tsx`: 로그인/회원가입 선택 버튼을 제출 중 함께 비활성화해 요청 중 form 종류가 바뀌지 않게 했다. 가입 안내는 미완성 약관 확인을 완료처럼 말하지 않으며, 선택 체류 기록이 가입만으로 선택되지 않는다는 범위만 유지했다.
- `test/ui/profile-settings-screen.test.mjs`: 내부 용어 미노출, 로그인→회원가입과 회원가입→로그인 양방향 제출 잠금, 실패 뒤 입력 유지·재제출을 production handler fixture에 추가했다. 기존 성공 복귀와 취소 뒤 늦은 응답 차단 fixture는 유지했다.

### 2. 유지한 계약·진행하지 않은 2단계

- `AuthContext`, DB/repository, Supabase metadata와 가입 저장 정책을 수정하지 않았다.
- 닉네임 field/read/write/validation, 계정 삭제 endpoint·재인증, 필수 약관 동의 저장, 선택 체류 동의는 연결하지 않았다. 가짜 저장·삭제 버튼이나 signOut 대체도 추가하지 않았다.
- 일반/anonymous 인증 분리, guest 기록·진행 코스 보존, read-only 권한 조회와 설정 복귀 갱신, 새 자동 권한 요청 없음은 그대로 유지했다.
- 정책 URL·문의 주소, 추천 엔진·외부 API·데이터·DB·Live Activity는 변경하지 않았다.

### 3. 실패 선행과 회귀 결과

- 실패 선행 집중 fixture: **5 pass / 2 fail**. account 화면의 내부 문구와 제출 중 전환 control 부재를 재현했다.
- 최종 집중 fixture: `npx tsx --test test/ui/profile-settings-screen.test.mjs` **7/7 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **432 pass / 0 fail / 의도 skip 1**.
- `npm test`: **220/220 통과**.
- `git diff --check`: 통과. 실제 API·Auth 계정·Simulator·실기기는 실행하지 않았다.

### 4. 실기기 체크리스트·다음 위험

체크리스트 작성은 완료했으며 실행 증거는 아직 없다. 승인된 테스트 계정과 iOS 실기기에서 다음만 제한 확인한다.

- [ ] 비로그인 내정보에서 내 프로필/권한 및 맞춤 추천/앱 안내가 모두 보이고 내부 개발 용어가 노출되지 않는다.
- [ ] 메인 프로필 버튼으로 연 로그인 화면을 취소하면 원래 메인과 선택·진행 중 코스가 유지된다.
- [ ] 로그인 완료 시 reset 없이 호출 화면으로 돌아오고 내정보 호출이었다면 로그인 상태로 갱신된다.
- [ ] 로그인과 회원가입 각각의 제출 중에는 두 전환 버튼과 입력이 잠기며, 실패 뒤 기존 입력으로 다시 제출할 수 있다.
- [ ] 로그인 계정의 프로필 관리에는 닉네임 준비 안내와 로그아웃만 보이고, 로그아웃 실패 시 화면과 재시도 가능 상태가 유지된다.
- [ ] iOS 설정에서 위치·알림 상태를 바꾸고 앱으로 돌아오면 표시가 갱신되며, 설정 열기 실패 뒤 같은 버튼으로 재시도할 수 있다.

2단계는 통합 세션이 `DB-PROFILE-ACCOUNT-01`의 구체 구현 버전을 승인하고 실제 repository/서버 API가 제공된 뒤 재개한다. 특히 현재 가입 metadata와 명시 필수 동의의 의미가 확정되지 않았으므로 지금 상태를 가입 동의 완료나 전체 프로필 출시 완료로 판정하지 않는다.
