# 짜투리(TimeFit)

**부산에서 약속 전 남은 시간에 들를 장소와 이동 코스를 찾는 iPhone 앱**이다. 출발지·약속 장소·도착 시각을 입력하면 이동시간과 운영시간을 고려해 장소를 추천하고, 사용자가 최대 두 곳을 선택해 코스를 진행한다.

이 문서는 처음 프로젝트를 읽는 사람을 위한 기능·코드·DB 안내다. 기술 기반은 Expo / React Native / TypeScript, 서버는 Supabase다.

> 기준: 2026-09-14 확인한 작업 트리. 배포 완료가 보고된 기능을 중심으로 설명하되, 파일 경로는 출시 이후 코드 정리를 반영한다. 현재 소스가 배포 IPA와 동일하다는 뜻은 아니다. 설정 파일의 버전은 `1.0.0(1)`이며, 현재 스토어 제공 버전은 사용자 확인 대기다. 운영 DB를 이번에 조회하거나 변경하지 않았다.

## 1. 사용자는 무엇을 할 수 있나

서비스 지역은 **부산**, 지원 대상은 **iPhone / iOS 17 이상**이다. 시간 입력은 현재부터 최대 **3시간**, 코스에 들르는 장소는 최대 **2곳**이다. 최종 약속 장소는 이 두 곳과 별개다.

| 화면 | 사용자에게 제공하는 기능 | 다른 기능과의 경계 |
| --- | --- | --- |
| 메인 | 시간·출발지·도착지 설정, 추천, 상세 확인, 코스 생성·진행 | 이동·체류·도착 전 여유시간을 함께 고려한다 |
| 주변 둘러보기 | 수동 지정한 기준 위치 주변 3km 장소를 가까운 순으로 탐색하고 길찾기 | 약속 시간 제약이 없고, 이 길찾기로 코스 기록·체류 학습을 만들지 않는다 |
| 기록 | 완료한 코스의 방문 장소 확인, 카테고리별 보기, 개별·전체 삭제 | 로그인 계정의 기록과 비로그인 기록을 구분한다 |
| 내정보 | 가입·로그인, 프로필 관리, 개인화 동의, 로그아웃·탈퇴, 문서 안내 | 가입 동의와 체류 개인화 동의는 별개다 |

### 추천부터 완료까지

```text
메인 → 시간·출발지·도착지 설정 → 장소 추천 ↔ 장소 상세
                                  ↓ 상세에서 선택 후 추천 화면 복귀
                     선택 장소와 함께 가능한 장소 추천
                                  ↓ 최대 두 곳 선택
                     코스 확인 → 길찾기 → 도착 확인
                                  → 머무르기 → 다음 이동 → 코스 완료
                                                               ↓
                                                            방문 기록
```

- 상세 화면에서 선택하면 기존 추천 화면의 선택 상태가 갱신된다.
- 두 장소의 방문 순서는 담은 순서가 아니라 경로 검증·최적화 결과를 따른다.
- 운영시간 등 검증 조건을 충족하지 못한 장소를 일반 추천 코스로 무조건 승격하지 않는다. 주변 탐색과 시간 제약이 있는 코스 추천은 다른 기능이다.
- 앱과 Live Activity의 도착·출발·완료 버튼은 같은 진행 상태를 공유한다. 앱에서 같은 행동을 다시 누르게 하는 구조가 아니다.
- 도착은 사용자의 확인이다. GPS로 실제 방문을 자동 판정하지 않는다. 진행 성공과 개인화 학습 가능 여부도 별개다.

### 위치와 카카오맵의 관계

짜투리는 기기 GPS 현재 위치를 취득하지 않으며 위치 권한을 요청하지 않는다. 사용자가 **검색하거나 지도에서 선택한 장소**를 입력으로 사용한다.

- 일반 코스 길찾기: 수동 선택한 출발지 또는 직전 코스 장소와 다음 목적지를 사용한다.
- 주변 둘러보기 길찾기: 목적지 장소 정보만 전달한다. 카카오맵이 자체 권한으로 현재 위치를 사용하는 것은 짜투리의 GPS 취득이 아니다.
- 수동 선택 좌표도 추천·경로 계산을 위해 외부로 전달될 수 있다. “GPS 미사용”을 “좌표 처리·전송이 전혀 없음”으로 해석하면 안 된다.

## 2. 기능이 코드에 연결되는 구조

```text
화면·내비게이션 (App.tsx, src/ui)
  ├─ 추천 세션 → 추천 엔진 + 번들 장소 카탈로그
  │                └─ 경로 어댑터 → Supabase route-proxy → Kakao
  ├─ 코스 진행 ↔ Live Activity 네이티브 연동
  └─ 완료·계정·동의 → 저장 모듈
                      ├─ 기기 내 저장: 진행 복원·소유자별 기록·재시도
                      └─ Supabase: 회원 기록·동의·유효 체류 표본
```

| 찾는 기능 | 먼저 볼 코드 |
| --- | --- |
| 앱 진입·탭·화면 연결 | [App.tsx](App.tsx), [mainTabNavigation](src/ui/mainTabNavigation.ts), [AppFlowContext](src/ui/AppFlowContext.tsx) |
| 시간·수동 위치 설정 | [TimeSetupScreen](src/ui/TimeSetupScreen.tsx) |
| 추천 화면과 추천 세션 연결 | [ResultsScreen](src/ui/ResultsScreen.tsx), [v1Session](src/ui/recommendation/v1Session.ts) |
| 추천 계산·후보 데이터 | [courseV1](src/engine/courseV1.ts), [courseV1CandidateProvider](src/data/courseV1CandidateProvider.ts) |
| 장소 상세·코스 확인 및 진행 | [PlaceDetailScreen](src/ui/PlaceDetailScreen.tsx), [CourseConfirmScreen](src/ui/CourseConfirmScreen.tsx), [실행 모듈](src/ui/execution/) |
| 진행 복원·완료 처리 | [activeVerifiedCourseStorage](src/ui/activeVerifiedCourseStorage.ts), [ownedCourseLifecycle](src/ui/ownedCourseLifecycle.ts) |
| Live Activity | [UI 연결](src/ui/liveActivity/), [네이티브 플러그인](plugins/) |
| 주변 탐색 | [NearbyBrowseScreen](src/ui/NearbyBrowseScreen.tsx) |
| 기록·계정 화면 | [ActivityRecordScreen](src/ui/ActivityRecordScreen.tsx), [ProfileScreen](src/ui/ProfileScreen.tsx), [ProfileManagementScreen](src/ui/ProfileManagementScreen.tsx), [LoginScreen](src/ui/LoginScreen.tsx) |
| 인증·DB 연결 | [releaseIdentitySupabase](src/services/releaseIdentitySupabase.ts), [releaseIdentityPersonalizationRuntime](src/services/releaseIdentityPersonalizationRuntime.ts) |
| 체류 개인화 계산 | [personalizationComposition](src/ui/personalizationComposition.ts), [dwellPersonalization](src/engine/dwellPersonalization.ts) |

화면은 상태·입력·표시를 연결하고, 추천 계산과 저장·외부 호출은 별도 모듈로 나뉜다. 다만 모든 부분이 완전히 분리되었다는 뜻은 아니다. 파일이 존재하거나 테스트에서 호출된다는 이유만으로 출시 화면의 활성 기능으로 판단하지 않는다.

## 3. DB 설계: 무엇을 어디에 저장하나

### 기기 내 저장과 서버 저장

| 저장 위치 | 주요 내용 | 필요한 이유 |
| --- | --- | --- |
| 앱 번들 JSON | 정제된 부산 장소, 분류, 좌표, 운영시간·사진 관련 정책 | 원천 API에서 매번 전체 장소를 수집하지 않기 위해 |
| 기기 내 AsyncStorage | 진행 코스 복원, 소유자별 완료·비로그인 기록, 동기화·이관 재시도 정보 | 앱 재실행·네트워크 실패에도 진행과 기록을 보존하기 위해 |
| iOS 공유 저장 공간 | Live Activity와 앱 사이의 진행·행동 전달 정보 | 잠금화면과 앱이 같은 코스를 진행하기 위해 |
| Supabase Auth | 회원 인증 정보·사용자 UUID | 계정 식별과 로그인 처리 |
| Supabase public 스키마 | 프로필·동의·회원 완료 기록·체류 표본·경로 캐시 | 계정별 보존, 개인화, 서버 요청 제어 |

완료 처리는 먼저 해당 코스 소유자의 기기 내 기록을 확보하고 서버 동기화를 분리한다. **서버 동기화나 선택적 학습 실패가 코스 완료 자체를 없애서는 안 된다.** 연결은 `CourseConfirmScreen → courseCompletionComposition → ownedCourseLifecycle → releaseIdentitySupabase` 순으로 읽으면 된다.

### 회원 기록의 핵심 관계

```text
auth.users (회원 UUID)
  ├─ profiles                          프로필
  ├─ account_consent_records            가입 문서 동의
  ├─ account_course_completions         완료 코스 (회원 1 : 여러 완료)
  │    └─ account_course_completion_places  완료 코스의 장소 (1~2곳)
  ├─ dwell_personalization_consents     개인화 동의 상태
  ├─ dwell_completion_samples          학습 가능한 체류 표본
  └─ dwell_personalization_profiles     카테고리별 체류 집계
```

위 선은 회원을 기준으로 한 관계 요약이다. 체류 표본은 완료 장소 테이블의 자식 FK가 아니라 `user_id`, `course_run_id` 등으로 대응하는 별도 저장 모델이다.

| 테이블 | 주요 데이터와 역할 |
| --- | --- |
| `profiles` | 회원 ID, 닉네임 및 변경 시각 등 프로필 |
| `signup_consent_documents` | 가입 시 제시할 문서 종류·버전·URL·활성 상태 |
| `account_consent_records` | 어떤 회원이 어떤 가입 문서에 동의했는지 기록 |
| `account_course_completions` | 회원 ID, 완료 식별자, 실행 코스 ID, 완료 시각, 출처(`account_completed` / `guest_import`) |
| `account_course_completion_places` | 완료 기록에 속한 방문 순서, 장소 ID·이름·대/소분류. 위도·경도 컬럼은 없지만 장소 ID로 카탈로그와 대응 가능 |
| `dwell_personalization_consents` | 개인화 활성 여부와 동의 버전. 이전 동의 상태의 요청이 잘못 반영되는 것을 막는 기준 |
| `dwell_completion_samples` | 실행 코스·장소·분류·체류 분·완료 시각·동의 및 사용자 확인 근거 버전. GPS 궤적이나 원본 도착/출발 시각을 저장하는 테이블은 아님 |
| `dwell_personalization_profiles` | 회원·대/소분류별 표본 수, 최근 표본 수, 중앙값 등 집계 |

### 중복·삭제·재시도를 다루는 보조 테이블

이 테이블들은 별도 사용자 기능이 아니라 기록의 일관성을 위한 장치다.

- `account_record_state`, `account_record_mutations`: 기록 변경 버전과 요청 결과 관리.
- `account_completion_tombstones`: 삭제된 실행 코스가 오래된 재시도로 다시 등록되지 않도록 표식 보관.
- `guest_completion_imports`, `guest_completion_source_claims`: 비로그인 기록의 이관 결과와 중복 이관 관리.
- `account_nickname_mutations`, `dwell_consent_mutations`: 닉네임·동의 변경의 중복 요청 처리.
- `account_deletion_requests`: 계정 삭제 요청 처리 관리.
- `route_proxy_cache`, `route_proxy_daily_budget`, `route_proxy_second_budget`, `route_proxy_fetch_lease`: 경로 응답 재사용, 호출량 제한, 동일 요청의 중복 실행 제어. 방문 기록 테이블이 아님.

주요 변경은 **RPC(서버 DB 함수)**나 Edge Function을 통한다. **RLS(행별 접근 제한)**와 함수의 계정·소유자 검증으로 다른 회원의 기록에 접근하지 못하도록 한다. UI에서 숨기는 것만으로 권한을 통제하지 않는다.

정확한 컬럼·제약·권한은 [마이그레이션](supabase/migrations/)이 구현 근거다. 특히 `015`는 계정·완료 기록, `016`은 체류 개인화, `017`은 pgcrypto 호출 보완이다. 이번 설명은 운영 적용 상태를 새로 검증한 결과가 아니다.

### 비로그인과 로그인 기록

- 비로그인도 코스 진행·Live Activity·기기 내 기록을 사용할 수 있지만 체류 개인화는 적용하지 않는다.
- 로그인한 계정의 기록과 개인화가 로그아웃 후 그대로 적용되지 않도록 소유자를 구분한다.
- 비로그인 기록은 로그인 시 사용자의 선택을 거쳐 계정으로 가져올 수 있다. 과거 비로그인 체류를 회원의 학습 표본으로 자동 승격하지 않는다.
- 코스를 시작할 때의 소유자와 완료 시점의 로그인 상태를 구분한다. 단순히 완료 당시 로그인한 계정으로 소유권을 바꾸지 않는다.

### 체류 개인화는 어떻게 동작하나

1. 회원이 별도 개인화 동의에 참여한다.
2. 앱 또는 Live Activity에서 확인한 도착·출발 증거가 유효한 완료 건만 학습 대상으로 삼는다. 근거가 불명확하면 진행은 유지하고 학습에서 제외한다.
3. 같은 **대분류 + 소분류**의 유효 표본이 3개 이상일 때 최신 최대 5개의 중앙값을 사용한다. 서버 집계는 최근 180일 표본을 대상으로 한다.
4. 추천 체류시간을 5분 단위로 보정하되 기본 권장시간 ±10분과 장소별 최소·최대 체류 범위를 넘지 않는다. 새 추천 세션에서 읽어 적용한다.

따라서 “코스 세 번마다 무조건 적용”이 아니다. 완료 기록과 학습 표본은 다른 데이터이며, 같은 분류의 적격 표본이 필요하다.

## 4. 외부 서비스와 데이터 경계

| 서비스 | 프로젝트에서의 역할 |
| --- | --- |
| Supabase | Auth, 회원 데이터·동의·체류 저장, 경로 프록시 및 계정 삭제 등 서버 함수 |
| Kakao | 지도·장소 검색·경로 계산, 앱/웹 길찾기 연결. 현재 `route-proxy` 구현의 공급자는 Kakao |
| Cloudflare | Turnstile CAPTCHA와 공개 안내 문서 호스팅 |
| TourAPI·부산 공공데이터 | 장소·운영시간·사진 등 원천 자료. 정제·권리 확인을 거친 앱 카탈로그와 구분 |
| Apple | iOS 알림·Live Activity·앱 배포 |

과거 문서의 ODsay/TMAP 언급이나 저장된 과거 공급자 표기를 현재 출시 경로의 신규 호출로 해석하지 않는다. 별도 어댑터·개발 분기의 존재와 실제 출시 설정의 활성화는 구분해야 한다. 공급자별 고지는 [공개 개인정보처리방침 원본](docs/05_release/publish/privacy-policy.md)을 참고한다.

## 5. 폴더와 검증 방법

```text
App.tsx        앱 진입과 화면 연결
src/ui/        화면·진행·내비게이션·Live Activity 연결
src/engine/    추천·시간·운영시간·경로 계산
src/data/      앱용 카탈로그와 후보 공급
src/services/ 인증·저장소·외부 API 어댑터
supabase/      SQL 마이그레이션·Edge Functions
plugins/       Expo 설정·iOS 네이티브 연동
data/          원천·정제·감사 자료
scripts/       데이터 빌드·감사·검증 도구
test/          단위·계약·UI 검증과 fixture
docs/          정책·설계·출시·역할별 작업 이력
```

기본 검증 명령은 다음과 같다.

```bash
npm run test:typecheck
npm run test:ui
npm test
```

이 명령의 성공이 곧 실기기 E2E 통과를 뜻하지는 않는다. 지도 WebView, 카카오맵 전환, 잠금화면 버튼, 네이티브 변경은 iOS 번들 검증 및 실기기 확인을 별도로 수행한다. 고정 시각·장소·응답 fixture로 회귀를 검증하고, 운영 API·실사용자 데이터를 반복 테스트에 쓰지 않는다. Metro는 명시적으로 요청할 때만 실행한다. 인증키·운영 데이터는 문서·fixture·커밋에 넣지 않는다.

## 6. 상세 문서를 읽는 순서

1. 이 README로 사용자 흐름과 저장 경계를 파악한다.
2. [AGENTS.md](AGENTS.md)에서 역할·수정 권한·검증 규칙을 읽는다.
3. [문서 색인](docs/README.md)에서 맡은 기능의 기준 문서를 선택한다.
4. 추천 정책은 [추천로직](docs/03_product/추천로직.md), 요구사항·수락 상태는 [테스트](docs/테스트.md), 화면 규칙은 [UIUX 공통 규칙](docs/03_product/UIUX_공통규칙.md)을 확인한다.
5. DB 상세는 [데이터베이스설계](docs/04_backend/데이터베이스설계.md)와 해당 마이그레이션·저장 코드를 함께 읽는다.

### 현재 구조와 과거 설계를 혼동하지 않기

[현재기능과구조](docs/03_product/현재기능과구조.md)와 DB 설계의 2026-09-12 설명에는 이후 삭제된 코드가 남아 있다. 현재 파일 안내는 이 README의 2026-09-14 점검 내용을 참고한다. 정책 문서와 코드가 충돌한다면 자동으로 코드를 정답으로 삼지 않고 결정 이력을 확인한다.

- 과거 `OneStopResultsScreen`, `MyCoursesScreen`, `ExecutionScreen`, `FeedbackScreen`과 전용 연결은 현재 소스에서 제거되었다. 현행 진행 화면은 `CourseConfirmScreen`이다.
- 과거 `courseRepository.ts`는 제거되었지만, 현행 `courseCompletionRepository.ts` 및 계정별 완료 저장은 별개다. 이름이 비슷하다고 삭제 대상으로 판단하지 않는다.
- 과거 `courses`·`course_stops` 등 스키마는 코드 정리 과정에서 삭제하지 않았다. 현행 회원 완료 기록의 중심은 `account_course_completions` 계열이다.
- 일부 과거 기록 읽기·복원 호환 코드와 엔진 내부 함수는 남아 있다. 이 README는 추가 삭제를 승인하는 문서가 아니다.
- `docs/work/`와 `docs/archive/`는 결정·검증 이력이다. 과거의 “현행”, “구현 전” 문구는 해당 기록 시점의 상태이며 지금의 작업 지시가 아니다.

### 문서 변경 이력

| 날짜 | 이전 방식 → 문제 → 변경 및 이유 | 상태 |
| --- | --- | --- |
| 2026-09-14 | 짧은 폴더 소개와 과거 구조 문서 링크 중심 → 현재 완료 기록과 과거 코스 DB를 구분하기 어려움 → 사용자 흐름·저장 위치·테이블 관계·코드 진입점을 정리하고, 삭제된 코드와 남은 DB 구분 | 문서 반영. 기능·추천 정책·DB·공개 고지는 변경 없음. 스토어 최신 버전 확인 대기 |
