# QA-LIVE-ACTIVITY-01 — Live Activity 체류 측정·개인화 출시 게이트

> 상태: **대기 — DB-DWELL-01, 2-AB, U-LIVE-ACTIVITY-01 수락 및 QA 대상 Supabase migration 적용 뒤 실행**
> 상위 결정: [DEC-LIVE-DWELL-01](../integration-decision/live-activity-dwell-personalization.md)

## 목적

GPS와 실제 외부 API 반복 호출 없이 상태·시각·저장 경계를 자동 검증한 뒤, iOS 17 실기기에서 Lock Screen/Dynamic Island·알림·Kakao 복귀의 OS 동작만 최소 확인한다.

## 자동 게이트

1. 고정 clock, 1곳/2곳 snapshot, fake Kakao handoff, fake notification/activity/repository를 사용한다.
2. 도착 유예 20%·3~10분, snooze 1회, 출발 안전 시각-5분, late arrival을 검증한다.
3. route handoff 실패/중복, 도착·출발 중복, 미확인/incomplete에서 저장과 상태가 잘못 전이되지 않는지 확인한다.
4. 일반 로그인+동의+완료만 표본 1회 저장하고 anonymous/비로그인/미동의/철회는 0회인지 확인한다.
5. 3개부터 최근 최대 5개 중앙값·5분 반올림·±10분·min/max clamp와 `(category, subCategory)` 복합 키 격리를 공개 엔진 entry로 검증한다. 같은 subCategory 문자열·다른 category 반례를 포함한다.
6. 개인화가 실제 경로·운영시간·최소 체류·도착 여유를 바꾸거나 one-stop/pair 후보를 없애지 않는지 비교한다.
7. Activity/notification disabled, repository 실패, 재실행 복구, 취소/완료/만료 cleanup을 검증한다.
8. 기존 one-stop 더보기, 2곳 인라인 선택/취소, route geometry, 전역 interaction 회귀를 함께 실행한다.

## 제한 실기기 게이트

- 전제: iOS 17 이상 새 internal build, DB-DWELL migration이 적용된 QA 대상 Supabase, 일반 로그인 테스트 계정, 개인화 동의 on, 알림 및 Live Activity 허용.
- 1곳 코스 1회: 길찾기 → 예상시간+유예 알림 → 도착 → 출발 5분 전 → 목적지/복귀 → 완료.
- 2곳 코스 1회: 첫 장소 도착/출발 → 두 번째 장소 도착/출발 → 최종 목적지/복귀. 각 stop 기록이 섞이지 않아야 한다.
- Dynamic Island 지원 기기에서 compact/expanded action, 잠금화면 action과 인증을 확인한다. 미지원 기기가 없으면 SwiftUI preview/Simulator presentation으로 대체하되 로컬 알림 수신을 실제 확인했다고 쓰지 않는다.
- 알림 off 또는 Live Activity off 중 하나를 1회 확인해 Kakao 길찾기와 앱 진행이 계속되는지 본다.
- 실제 Kakao/Route Proxy 호출은 위 두 코스에 필요한 횟수만 기록하며 추천 후보 전체 검증을 반복하지 않는다.

## 합격 조건

- 가짜 실제 시각·GPS 추정 저장 0건.
- 미완료 표본의 개인화 반영 0건.
- 사용자·category·subCategory 간 데이터 누출 0건.
- 같은 action 중복 저장/알림 예약 0건.
- 코스 취소·완료 뒤 활성 Live Activity와 pending course notification 0건.
- 최소 `npm run test:typecheck`, `npm run test:ui`, `npm test`, iOS build와 관련 집중 테스트 통과.

완료 인수인계에는 시나리오 ID, fixture 입력, 테스트 수, 실제 기기/OS, 캡처·로그 위치, 남은 출시 위험을 기록한다. 보드·제품 정책·기능 코드는 수정하지 않는다.
