# U-LIVE-ACTIVITY-01 — iOS 17 Live Activity·도착/출발 확인·권한 설정

> 상태: **대기 — U-INTERACTION-01 수락 및 DB-DWELL-01·2-AB 공개 계약 필요**
> 상위 결정: [DEC-LIVE-DWELL-01](../integration-decision/live-activity-dwell-personalization.md)

## 목적과 사용자 관찰

카카오맵 길찾기 뒤 앱을 다시 열지 않는 사용자도 예상 도착·안전 출발 시각을 놓치지 않고, 잠금화면/Dynamic Island에서 낮은 마찰로 도착과 출발을 확인하게 한다.

## 구현 전 원인 확인

- 현재 `VerifiedCourseProgressScreen`은 화면 메모리 전용이며 Live Activity/DB/알림을 사용하지 않는다.
- 현재 `app.json` deployment target은 16.4이고 Widget Extension/App Group/ActivityKit bridge가 없다.
- 현재 iOS Info.plist에는 기능과 맞지 않는 generic Always location 문구가 생성돼 있으나 이번 결정은 background/Always GPS를 금지한다.
- 기존 `expo-notifications`에는 legacy 출발 5분 전·정시 알림이 있으므로 그대로 중복 예약하지 말고 새 진행 상태 기준으로 교체/분리해야 한다.

## 구현 명령

1. `U-INTERACTION-01` 보완이 수락되기 전 `App.tsx`, 공용 Pressable, 현재 화면 파일을 동시에 수정하지 않는다.
2. 먼저 고정 clock과 fake Activity/notification/repository port로 실패하는 상태 전이·부수효과 테스트를 만든다. 화면에서 ActivityKit·Notifications·Supabase를 직접 호출하지 않는다.
3. iOS deployment target을 17.0으로 일관되게 전환하고 Expo prebuild 재생성에도 유지되는 config plugin/설정을 만든다. Xcode 수동 편집만으로 끝내지 않는다.
4. 제3자 패키지의 암묵적 target 생성에 의존하지 않는다. 프로젝트 로컬 Expo config plugin과 Swift native bridge로 Widget Extension, App Group, `NSSupportsLiveActivities`, ActivityKit attributes/content state를 생성·연결하고, clean prebuild 뒤에도 target·entitlement·shared type이 재현되는지 검사한다. 한 번에 활성 Live Activity는 하나다.
5. 길찾기 handoff 성공 뒤에만 `traveling`을 시작한다. 실패/중복 tap은 activity·알림·저장 0회다.
6. 상위 결정의 20%·3~10분 도착 유예와 `latestSafeDepartureAt - 5분` 공식을 단일 순수 schedule helper에서 사용한다. 화면마다 다시 계산하지 않는다.
7. 도착 알림 action은 `도착했어요`, `5분 뒤 다시 알림` 두 개다. snooze는 1회이고 무시/미응답으로 activity를 종료하지 않는다.
8. iOS 17 LiveActivityIntent로 도착·출발 행동을 처리하고 App Group의 최소 상태를 idempotent하게 갱신한다. 잠긴 기기 인증, 앱 foreground/background, 중복 action을 안전 처리한다.
9. 도착 확인 뒤 `dwelling`, 출발 5분 전 `departure_due` 맥락을 보여 준다. 다음/목적지/복귀 Kakao handoff 성공 또는 앱의 명시 완료가 같은 departure event를 사용한다.
10. 강제 종료/재실행은 App Group의 활성 코스 하나만 복구한다. 취소·완료·만료 때 pending notification과 Live Activity를 함께 종료하고 local exact timestamps를 정리한다.
11. 내 정보에는 실제 앱 토글 `맞춤 추천을 위한 체류 기록`, `개인화 데이터 초기화`를 추가한다. 알림·위치·Live Activity는 시스템 상태와 `설정에서 변경` 행으로 구현하고 앱이 시스템 권한을 직접 끈 것처럼 표현하지 않는다.
12. 최초 개인화 활성화 때만 수집 목적을 설명한다. 알림 권한은 첫 실행이 아니라 첫 `카카오맵에서 길찾기` handoff 직전에 도착·출발 알림 목적을 설명한 뒤 요청하고, 응답과 무관하게 handoff를 계속한다. 거절 후 내 정보의 시스템 상태 행에서 설정 앱으로 갈 수 있으며, 개인화 활성화 이전 기록은 전송하지 않는다.
13. GPS/background location 코드를 추가하지 않는다. Always usage description/background location mode가 이번 앱 기능에 필요하지 않으면 생성 원인을 제거하고 When In Use 위치 선택 설명만 실제 기능과 맞춘다.
14. ActivityKit 시작 실패, 알림 거절, 개인화 미동의, repository 실패에도 추천·기존 진행·Kakao handoff를 막지 않는다.
15. 원격 push token/APNs/Edge Function을 추가하지 않는다. Live Activity 때문에 Route Proxy/Kakao API를 재호출하지 않는다.

## 수정 금지 경계

- 추천 후보·순위·체류 계산, route snapshot, API cache/attempt, 카탈로그를 수정하지 않는다.
- 엔진이 제공한 `moveMin`, 남은 legs/stops, 도착 여유를 UI가 임의 연장하지 않는다.
- 일반 버튼 haptic 0과 TimeWheel 전용 haptic, 2곳 인라인 선택/취소 상태를 유지한다.
- 시스템 알림/위치 권한을 실제 앱 토글처럼 위장하지 않는다.

## 필수 반례 fixture

- 10/30/60분 이동의 유예 3/6/10분과 clamp 경계.
- 일찍 도착, 정시+유예 도착, snooze 1회, 미응답.
- last stop과 2곳 첫 stop의 남은 일정 공식, 이미 지난 출발 5분 전 시각.
- Kakao app/web/browser 각각 성공과 전체 실패, 중복 tap.
- arrival 중복, departure 중복, route 실패 시 departure 미기록.
- 비로그인, anonymous Auth, 로그인 미동의/동의/철회.
- 알림 거절, Live Activity disabled/start failure, 앱 강제 종료 복구, 취소·완료 cleanup.
- Dynamic Island/Lock Screen 각 presentation과 긴 장소명·VoiceOver·Reduce Motion.

## 검증과 완료 인수인계

- 최소 `npm run test:typecheck`, `npm run test:ui`, `npm test`, iOS bundle/build, `git diff --check`를 실행한다.
- SwiftUI preview/fixture로 Lock Screen·Dynamic Island compact/minimal/expanded를 검증한다. 실제 알림·App Intent·잠금 상태는 QA 실기기 게이트로 남긴다.
- 변경 파일과 목적 / 유지 계약 / 자동 테스트 결과 / 실제 기기에서만 가능한 항목을 이 문서에 기록한다.
- 사용자 요청 전 commit·push하지 않는다. 보드를 수정하지 않는다.
