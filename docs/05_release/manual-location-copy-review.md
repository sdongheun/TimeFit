# DOCS-MANUAL-LOCATION-PREP-01 — GPS 미사용 전환 문안 검토본

기준일: 2026-09-09
상태: **공개 원본·HTML 반영 완료 / Connect·게시 미실행 / App Privacy 3개 항목·신고 후속·최종 iPhone 확인 대기**

이 문서는 [DEC-RELEASE-MANUAL-LOCATION-01](../work/integration-decision/release-manual-location.md), API·DB·UIUX 인수인계, [QA-RELEASE-MANUAL-LOCATION-01](../work/qa-release/release-manual-location.md), [U-LIVE-FINAL-HANDOFF-FEEDBACK-01](../work/uiux/live-final-handoff-feedback.md)을 대조해 GPS 미사용 출시 문구와 실제 반영 결과를 관리한다. 공급자 DPA·계약 조사는 반복하지 않았다. 이 기술 전환만으로 신고 대상 여부, 법적 적합성 또는 공개 가능 상태를 확정하지 않는다.

## 1. 적용 전제와 유지 경계

| 구분 | 확인된 현재 사실 | 문서 처리 |
| --- | --- | --- |
| 신규 장소 입력 | 위치 권한 조회·요청, GPS 자동 출발지, 현재위치 선택, 지도 GPS 버튼과 legacy GPS 재추천 entry가 UI에서 제거됨 | GPS 수집·현위치 자동 설정·위치 권한 안내를 삭제 대상으로 표시 |
| 네이티브 설정 | `expo-location` 실행 모듈 없음, Release Simulator Info.plist 위치 usage key·background location 0, 공개 입력 빌드·설치·기동 PASS. 최종 Distribution IPA와 iPhone 확인은 남음 | 확인된 GPS·권한 미사용을 공개본에 반영하고 최종 IPA·iPhone은 출시 게이트로 분리 |
| 수동 선택 좌표 | 검색 또는 지도 핀으로 사용자가 확정한 장소의 이름·주소·정확 좌표가 주소 조회, 경로 계산, 지도·외부 길찾기에 전달됨 | 좌표 처리·서버/API 전송 고지를 유지하고 출처만 수동 선택으로 교체 |
| 코스·기록 | 계정 코스에는 선택 장소 좌표가 남을 수 있음. 완료 기록·guest 가져오기·체류 표본에는 GPS가 필요하지 않으며 버튼 기반 도착·출발·완료와 그 시간 차를 사용 | 코스 저장·방문 기록·별도 동의 개인화 문구 유지. GPS 방문 인증으로 표현하지 않음 |
| 과거 진행·저장 코스 | 표식 없는 과거 코스는 화면·connector·외부 길찾기·Live Activity pending 전 gate에서 차단하고 합성 fixture에서 자동 재전송0 확인. 정확히 같은 양 끝 재선택과 유효 시각일 때만 원본 run을 이어감 | 일반 기록을 보존하고 조건부 legacy 공급자 문구 유지. 변경 좌표의 동일 run 재계산은 지원한다고 쓰지 않음 |
| App Privacy | GPS 센서 접근은 제거되지만 수동으로 확정한 정확 좌표의 외부 전송·서버 보관 경로는 유지 | `Precise Location`을 현 단계에서 `아니오`로 변경하지 않음 |

변경 이력은 **GPS·위치 권한으로 현재 위치 선택 → 출시 구조와 불일치 → 검색·지도 핀의 명시 선택 → 자동 측위 없이 추천·경로 기능 유지 → 자동 QA와 Release Simulator 산출물 확인 후 공개 원본·HTML 반영 완료**다.

## 2. 개인정보 처리방침 교체안

대상: `publish/privacy-policy.md`와 승인 후 `public-site/privacy/index.html`. 아래 항목 외의 계정·보유기간·공급자·개인화·삭제 문구는 유지한다.

### 2.1 제1절 장소·경로 추천 행

**제거할 표현**

> 현위치 또는 사용자가 입력한 출발지·약속 장소
> 사용자가 기능을 실행하고 위치 사용을 선택한 경우

**교체 문안**

| 기능 | 처리 항목 | 목적 | 처리 조건 |
| --- | --- | --- | --- |
| 장소·경로 추천 | 사용자가 검색 또는 지도 핀으로 직접 선택한 출발지·약속 장소의 이름·주소·정확 좌표, 이동수단, 요청 시각, 추천·경로 결과 | 장소 검색, 예상 이동시간과 가능한 코스 계산, 지도 표시 | 사용자가 장소를 검색하거나 지도 핀을 확정하고 추천·경로 기능을 실행한 경우 |

제1절의 기기 내 처리 설명은 다음과 같이 한 문장만 좁힌다.

```text
비로그인 완료 기록, 활성 코스, Live Activity 진행, 로컬 알림과 앱 진단은 원칙적으로 기기 안에 저장되며 짜투리 서버로 자동 전송하지 않습니다. 다만 사용자가 장소를 검색하거나 지도 핀을 확정해 장소·경로를 계산하고 외부 지도·사진을 열 때에는 해당 요청에 필요한 검색어·선택 장소의 좌표·네트워크 정보가 외부 서비스에 전달될 수 있습니다.
```

### 2.2 제4절 전체 교체

**삭제할 제목·표현**

- 제목 `위치정보와 권한`의 `권한`
- iOS의 ‘앱을 사용하는 동안’ 위치 권한 요청
- 권한 허용·거절
- 현위치 좌표 전송
- `현위치나 수동 선택 위치`처럼 GPS와 수동 좌표를 함께 묶은 표현

**교체 제목과 문안**

```text
## 4. 선택 장소의 좌표와 경로 처리

짜투리는 출시 버전에서 기기의 GPS 위치를 요청하거나 위치 권한을 사용하지 않습니다. 사용자는 부산의 출발지, 약속 장소 또는 주변 둘러보기 기준점을 검색하거나 지도에서 핀을 찍어 직접 선택합니다. 지도의 부산 기본 보기는 화면의 초기 중심일 뿐 사용자의 위치나 선택으로 저장되지 않습니다.

장소 검색어는 카카오에 전달되며 검색 요청에 기기 현위치 좌표를 자동으로 붙이지 않습니다. 사용자가 지도 핀을 확정하면 선택한 정확 좌표가 주소 표시를 위해 카카오에 전달됩니다. 추천·경로 계산에는 선택한 출발지·약속 장소·방문 장소의 정확 좌표와 인증 정보가 짜투리 서버에 전달되고, 서버는 경로 계산에 필요한 좌표를 카카오에 전달합니다. 카카오 경로 요청에는 짜투리 계정 ID나 약속 시각을 넣지 않습니다.

사용자가 코스에서 길찾기를 누르면 해당 구간의 출발·도착 이름과 좌표, 이동수단이 카카오맵 앱 또는 웹에 전달됩니다. 앱은 GPS로 도착이나 방문을 판정하지 않습니다. 도착·출발·완료와 체류시간은 사용자가 앱 또는 Live Activity에서 직접 누른 버튼과 그 시간 차를 기준으로 처리합니다. 예상 이동시간·운영시간·도착 여유는 실제 상황과 다를 수 있으므로 출발 전 지도와 장소의 최신 정보를 확인해야 합니다.
```

### 2.3 제5절 권리·권한 목록

**제거할 항목**

> iOS 설정에서 위치·알림·Live Activity 권한 변경

**교체 항목**

> iOS 설정에서 알림·Live Activity 권한 변경

### 2.4 과거 코스 조건부 문구

제3절의 TMAP Mobility·ODsay 행과 “일부 기존 저장 코스의 실행·재계산” 문구는 과거 좌표 복원 보완과 QA가 끝날 때까지 유지한다.

- QA에서 과거 좌표의 자동 외부 재전송이 0이고 최종 artifact에서 해당 공급자 경로가 도달 불가로 확인되면, 기존 API artifact 감사와 함께 공급자 행의 삭제 여부를 다시 판단한다.
- 자동 재전송 경로가 남으면 공개하지 않고 먼저 해당 기술 게이트를 해결한다. 출처 불명 좌표를 GPS로 단정하거나 일반 방문 기록을 삭제하는 문안은 사용하지 않는다.

## 3. 이용약관 교체안

대상: `publish/terms.md`와 승인 후 `public-site/terms/index.html`.

### 3.1 제4조 제4항

**제거할 문장**

> 위치 권한을 거절해도 부산의 위치를 직접 입력할 수 있습니다.

**교체 문안**

```text
4. 사용자는 부산의 출발지와 약속 장소를 검색하거나 지도에서 직접 선택합니다. 외부 카카오맵 앱이 없으면 가능한 경우 웹 경로로 연결합니다.
```

### 3.2 마지막 위치 관련 절 전체 교체

**제거할 제목·표현**

- 제목 `위치 기반 기능`
- `사용자가 허용하거나 직접 고른 위치`
- background location·GPS 자동 도착·권한 거절 안내

**교체 제목과 문안**

```text
## 장소 선택과 경로 기능

짜투리는 사용자가 검색하거나 지도 핀으로 직접 고른 장소의 이름·주소·좌표를 주소 표시, 주변 장소 추천과 경로 안내에 사용합니다. 기기의 GPS 위치나 위치 권한을 사용하지 않으며, 도착·출발·완료는 사용자가 앱 또는 Live Activity에서 직접 확인합니다. 선택 장소와 경로의 처리 내용은 개인정보 처리방침에서 확인할 수 있습니다.
```

이 문구는 서비스의 기술 동작을 설명한다. 별도 위치 관련 신고·약관 적용 여부에 대한 법적 결론으로 사용하지 않는다.

## 4. 지원 안내 교체안

대상: `publish/support.md`와 승인 후 `public-site/support/index.html`.

### 4.1 기능 소개

**제거할 표현**

> 현재 위치를 허용하거나 부산의 출발지와 약속 장소를 직접 입력할 수 있습니다.

**교체 문안**

```text
짜투리는 부산에서 다음 일정 전 최대 3시간을 활용할 장소와 이동 코스를 제안합니다. 부산의 출발지와 약속 장소를 검색하거나 지도에서 직접 선택할 수 있습니다. 추천은 기본 한 장소이며, 시간·운영시간·경로 조건을 확인한 후보 중 사용자가 직접 선택하면 최대 두 장소 코스를 만들 수 있습니다.
```

### 4.2 이용 방법 제목과 첫 항목

**제거할 제목·문장**

> 위치·알림 없이 이용하기
> 위치 권한을 허용하지 않아도 출발지와 약속 장소를 검색하거나 지도에서 직접 선택할 수 있습니다.

**교체 문안**

```text
## 장소 선택·알림 이용 안내

- 출발지와 약속 장소는 검색하거나 지도에서 핀을 찍어 직접 선택합니다. 지도의 부산 기본 보기는 선택값으로 저장되지 않습니다.
- 알림 또는 Live Activity를 허용하지 않아도 앱 안에서 코스를 확인하고 외부 길찾기를 열 수 있습니다.
- 카카오맵 앱이 없으면 지원되는 경우 웹 지도로 연결됩니다.
```

### 4.3 문제 해결 제2항

**제거할 문장**

> 위치가 맞지 않으면 iOS 설정에서 짜투리 위치 권한을 확인하거나 위치를 직접 입력해 주세요.

**교체 문안**

```text
2. 선택한 장소가 맞지 않으면 출발지 또는 약속 장소를 다시 검색하거나 지도 핀을 옮겨 확정해 주세요.
```

Live Activity의 `도착했어요`, `도착 후 코스 마치기`, 길찾기만으로 도착·체류가 기록되지 않는다는 기존 안내는 유지한다.

## 5. App Store 설명 — Connect 복사용 교체 본문

기존 저장 설명에서 “현재 위치를 사용”하는 첫 번째 bullet만 바꾸되, Connect에서 부분 편집 오류를 피하도록 전체 본문을 제공한다. 개인화·3시간·2곳·Live Activity 문구는 유지한다.

```text
약속까지 남은 시간, 그냥 기다리지 마세요.

짜투리는 부산에서 출발지와 약속 장소, 현재부터 최대 3시간의 남은 시간을 바탕으로 들를 만한 장소와 이동 코스를 제안합니다.

• 부산의 출발지와 약속 장소를 검색하거나 지도에서 직접 선택하세요.
• 예상 이동시간과 운영시간, 도착 전 여유시간을 고려한 장소를 확인하세요.
• 장소의 위치와 상세 정보를 살펴보고 최대 두 곳을 골라 코스를 구성하세요.
• 카카오맵 길찾기로 이동하고, Live Activity에서 코스 진행을 확인하세요.
• 약속이 없어도 주변 둘러보기의 기준 장소를 직접 선택해 가까운 장소를 찾아보세요.
• 코스를 마치면 방문 기록을 확인할 수 있어요.
• 로그인하고 맞춤 추천에 동의하면 확인된 체류 기록을 바탕으로 다음 추천의 체류시간을 조정해 드려요.

예상 이동시간과 운영시간은 교통 상황이나 임시 휴무 등에 따라 달라질 수 있습니다.
출발 전 카카오맵과 장소의 최신 안내를 확인해 주세요.

서비스 지역: 부산
지원 환경: iOS 17 이상
```

앱 이름·부제·프로모션·키워드·카테고리·가격·배포 지역·저작권은 GPS 전환의 영향을 받지 않으므로 변경하지 않는다.

## 6. App Review Notes — Connect 복사용 교체 문안

아래 문안은 과거 진행 코스 보완과 최종 QA가 통과한 뒤 사용한다. 심사 계정 비밀번호는 Notes에 넣지 않는다.

### 한국어

```text
짜투리는 부산에서 약속 전 남은 시간에 들를 장소와 이동 코스를 제안합니다. 핵심 추천은 로그인 없이 심사할 수 있습니다. 이 버전은 기기의 GPS 위치와 위치 권한을 사용하지 않습니다.

부산 밖에서 확인하는 방법
1. 첫 화면에서 현재 시각부터 최대 3시간 안의 약속 시각을 선택합니다.
2. 출발지와 약속 장소에 현재 운영 중인 부산의 공개 장소를 각각 검색하거나 지도에서 핀으로 선택합니다. 지도의 부산 기본 보기는 선택값이 아닙니다.
3. 추천 결과에서 장소 상세와 지도를 확인하고 한 곳을 선택합니다. 유효한 두 번째 후보가 있으면 최대 두 곳까지 코스를 구성할 수 있습니다.
4. 코스 확인에서 카카오 길찾기를 엽니다. 카카오맵 앱이 없으면 웹으로 열립니다.
5. 알림과 Live Activity는 선택 사항입니다. 허용하면 코스 진행 상태를 확인할 수 있고, 앱 또는 Live Activity에서 도착·출발을 직접 선택한 뒤 앱에서 최종 완료합니다. GPS로 도착을 자동 판정하지 않습니다.
6. 완료 뒤 방문 기록을 확인합니다.

추천 후보는 현재 시각의 장소 운영시간과 실제 경로 결과에 따라 달라집니다. 후보가 없으면 현재 운영 중인 다른 부산 공개 장소를 선택하거나 주간 운영시간에 다시 확인해 주세요. 심사용 숨은 기능이나 고정된 QA 시각은 없습니다.

계정은 코스 동기화와 선택적 맞춤 추천에만 필요합니다. 계정 삭제는 내정보 > 프로필 관리 > 계정 삭제에서 시작합니다. 심사 계정 ID와 비밀번호는 App Review Information의 전용 필드에만 입력합니다.

앱은 Kakao의 장소 검색·지도·경로, Supabase의 인증·서버 기능, 일부 비로그인 추천과 로그인 요청의 Cloudflare Turnstile 보안 확인을 사용합니다. 사용자가 검색하거나 지도에서 선택한 장소의 좌표는 주소 조회·추천·경로 계산과 외부 길찾기에 전송될 수 있습니다. 추천·이동시간·운영시간은 예상치이므로 출발 전에 최신 정보를 확인해 주세요.
```

### English

```text
Jjaturi suggests places to visit and travel itineraries for time remaining before an appointment in Busan. The core recommendation flow can be reviewed without signing in. This version does not use the device's GPS location or request location permission.

How to review outside Busan
1. On the first screen, select an appointment time within three hours of the current time.
2. Search for currently open public places in Busan, or select them with map pins, for the starting point and appointment place. The default Busan map view is not treated as a selection.
3. Open a result to view its details and map, then select one place. When another valid candidate is available, you can build an itinerary with up to two places.
4. Open Kakao directions from the itinerary. If the KakaoMap app is unavailable, the directions open on the web.
5. Notifications and Live Activity are optional. If enabled, they show itinerary progress. Select arrival and departure explicitly in the app or Live Activity, then complete the itinerary in the app. GPS is not used to detect arrival.
6. After completion, open the visit history.

Available candidates depend on current business hours and live route results. If no candidate appears, select other currently open public places in Busan or review again during daytime business hours. There is no hidden review feature or fixed QA clock.

An account is only needed for itinerary sync and optional personalized recommendations. Account deletion starts at My Info > Manage Profile > Delete Account. Enter the review account ID and password only in the App Review Information fields.

The app uses Kakao for place search, maps, and routes; Supabase for authentication and server features; and Cloudflare Turnstile for security checks on some signed-out recommendation and sign-in requests. Coordinates for places selected by search or map pin may be sent for address lookup, recommendations, route calculation, and external directions. Recommendations, travel times, and business hours are estimates, so please confirm current information before departure.
```

## 7. App Privacy 변경 입력표

GPS 권한 제거는 Apple의 데이터 수집 답변 전체를 `아니오`로 바꾸는 근거가 아니다. 데이터 이름이나 좌표 정밀도만으로도 확정하지 않고 Apple의 데이터 유형·기기 밖 전송·실시간 처리 초과 접근·사용자 연결 정의와 실제 보관 경로를 함께 적용한다.

| Apple 입력 항목 | 기존 입력표 | GPS 전환 뒤 제안 | Connect에 사용할 근거 |
| --- | --- | --- | --- |
| Location → Precise Location | 확정 예 / App Functionality / 사용자 연결 예 / 추적 아니오 | **최종 입력안 유지** | GPS 센서 접근 때문이 아니라 검색·핀으로 선택한 정밀 좌표가 계정 코스에 보관될 수 있어 실시간 요청만으로 끝나지 않는 경로를 근거로 함 |
| Search History | 미확인/입력 보류 | **변경 없음** | 검색어는 Kakao Local에 전송. 공급자의 실시간 처리 이후 보유·계정 결합 범위는 기존 문의 항목 |
| Usage Data → Product Interaction | 확정 예 | **변경 없음** | 선택·저장·완료 코스와 방문 장소, 동의 상태 유지 |
| Usage Data → Other Usage Data | 확정 예 | **변경 없음** | 별도 동의 후 버튼 기반 도착·출발 시간 차에서 계산한 체류 분과 완료 시각 유지. GPS 방문 인증 아님 |
| Diagnostics / Device ID | 미확인/입력 보류 | **변경 없음** | Supabase·Cloudflare 기본 로그와 device-level 신호의 보유 범위는 GPS plugin 제거와 별개 |
| Tracking | 아니오 | **변경 없음** | 광고·데이터 브로커·타사 결합 추적 경로 없음 |

Connect의 App Privacy 설명 또는 내부 근거 메모가 허용되는 경우 다음 문장을 사용한다.

```text
The app does not access the device's GPS location. Users manually select places by search or map pin. Precise coordinates for those selected places are transmitted for address lookup, recommendations, route calculation, and external directions, and may be retained with account itineraries. The data is used for app functionality, may be linked to the user's account, and is not used for tracking.
```

## 8. 영향받는 App Store screenshot

작업 폴더의 기존 6장 `output/app-store-screenshots-XHq0ou/`를 직접 대조했다. 존재하는 자산을 미촬영으로 되돌리지 않고 화면 변경과 충돌하는 컷만 교체한다.

| 순서·파일 | 영향 | 판정·이유 |
| --- | --- | --- |
| 01 `01-setup.jpg` | 수동 장소 설정 | 유지 가능. 수동 출발·복귀 장소가 표시되고 권한·현재위치 CTA가 없음 |
| 02 `02-recommendations.jpg` | 추천 결과 | 유지 가능. GPS·권한·현재위치 표현 없음 |
| 03 `03-place-detail-review-needed.jpg` | 장소 상세·지도 | **교체 필요.** `현재 위치를 확인하지 못했어요`와 GPS 모양 버튼이 남아 현행 화면과 충돌 |
| 04 `04-course.jpg` | 코스 확인 | 유지 가능. 수동 출발·복귀와 경로 표시, 권한 표현 없음 |
| 05 `05-nearby-review-needed.jpg` | 주변 둘러보기 | **교체 필요.** GPS 모양 현재위치 버튼이 남아 현행 수동 기준점 화면과 충돌 |
| 06 `06-history.jpg` | 방문 기록 | 유지 가능. 버튼 기반 완료 기록 계약 불변 |

Live Activity 별도 이미지는 현재 6장 묶음에 포함되지 않는다. 기존 이미지 전체가 없다고 기록하지 않으며, 진행 공유를 추가로 강조할 때만 실제 native Activity 보조컷을 사용한다.

## 9. 실제 공백과 공개 반영 게이트

1. **자동 구현·복원:** QA 집중191/191, map 계약14/14, typecheck/UI/core, 공개 입력 Release Simulator build·설치·기동 PASS. 표식 없는 과거 코스 자동 전송0과 새 수동 코스 cold 복원 무확인을 fixture로 확인했다.
2. **Live Activity 최종 handoff:** U-LIVE-FINAL-HANDOFF-FEEDBACK-01 집중89/89·typecheck PASS와 사용자 정상 확인을 인수했다. 확인 기기/빌드와 1·2곳별 세부 결과가 없으므로 모든 실기기 항목 PASS로 확대하지 않는다.
3. **최종 native:** Release Simulator의 위치 usage description0, background location0, ExpoLocation0과 Live Activity·암호화 설정을 확인했다. 최종 Distribution IPA와 실제 iPhone의 위치 팝업0·외부 지도·Live Activity·기록 흐름은 제출 전 확인한다.
4. **위치 문의:** 답변 대기는 종료됐다. 회신은 면제·법적 적합성 확정이 아니며 실제 신고 처리와 그 결과에 따른 책임자·연락처·별도 약관 등 추가 고지만 남는다.
5. **App Privacy:** Precise Location은 GPS 센서 때문이 아니라 Apple의 위치 데이터 정의와 계정 코스 보관 가능 경로를 근거로 최종 입력안 `예 / App Functionality / 사용자 연결 예 / Tracking 아니오`로 둔다. Search History·Diagnostics·Device ID는 공급자의 실시간 처리 초과 보유·식별 결합 여부가 확인되지 않아 보류한다.
6. **게시 실행:** 실제 시행일, 공개 HTTPS URL, 공급자·신고 후속 필수 고지, 사용자 게시 승인 전에는 게시·registry·앱 링크·Connect를 변경하지 않는다.

## 10. 이번 작업 인수인계

1. **변경 파일과 목적:** 이 파일만 신규 작성. GPS 미사용 전환에 따른 개인정보 처리방침·약관·지원·스토어 설명·심사 Notes·App Privacy·screenshot 교체안을 한곳에 준비했다.
2. **유지한 계약:** 수동 좌표의 서버/API 전송, private/public cache 경계, 최대180분·2곳, 버튼 기반 기록·체류, 별도 동의 개인화, guest 가져오기, Live Activity와 기존 공급자 미확인 사실을 유지했다.
3. **검증 범위:** 네 인수인계와 현재 공개 원본·HTML·Connect 초안의 GPS·권한 표현을 대조했다. 복사용 블록 추출 결과 스토어 설명 586자, 한국어 Notes 994자, 영어 Notes 2,094자이며 code fence 짝과 문서 공백 검사를 통과했다. 제품 테스트·정적 사이트 검사는 실행하지 않았다. 제품과 공개 파일을 변경하지 않았기 때문이다.
4. **다음 결정:** 과거 코스 복원 보완과 QA 결과를 받은 뒤 이 문안의 사실 전제를 확인하고 공개 원본·HTML 반영 여부를 결정한다. 법적 답변과 게시·Connect 변경은 별도다.

## 11. DOCS-MANUAL-LOCATION-FINAL-01 완료 인수인계

### 변경 파일과 목적

- `publish/privacy-policy.md`, `terms.md`, `support.md`와 `public-site/privacy|terms|support/index.html`: GPS·위치 권한 문구를 수동 검색·지도 핀, 선택 좌표 전송, 버튼 기반 도착·출발·완료와 체류시간, 앱·Live Activity 공유 진행으로 교체했다.
- `publish/app-store-submission.md`: 위 5·6절의 Connect 복사용 설명·한영 심사 메모를 현행값으로 반영하고, App Privacy 최종 입력안과 보류 항목, 기존 screenshot 6장의 유지/교체 판정을 갱신했다.
- `publish/data-facts.md`, `publish/release-gates.md`: 기기 GPS 수집 entry0과 위치 문의 회신 접수 상태를 반영했다. `답변 대기`를 실제 신고·고지 후속 확인으로 바꾸되 면제·법적 적합성을 확정하지 않았다.
- 본 파일과 `release-document-session.md`: QA·Live Activity 근거, 검증, 게시 파일·version·Connect 교체 문구와 남은 공백을 기록했다.

### 게시 후보와 문서 버전

문서 version은 아직 게시되지 않은 `1.0`을 유지한다. 시행일과 공개 URL은 실제 게시 성공 뒤 기록한다.

| 공개 대상 | 원본 Markdown SHA-256 | 게시 HTML SHA-256 |
| --- | --- | --- |
| 개인정보 처리방침 `/privacy/` | `1b02fa0062a775d441533974ae3998f16f592b6f7897326e03adeb02d5201be5` | `9585bac0ee8232da3835cfc24f7cb88613c3d01c9b679280bbe2e815852a8af4` |
| 이용약관 `/terms/` | `4bf29d5b08be65d29a20e49659628edaf539276b86c1a14972aa7946c1fb5b41` | `25ab9c48c72d1a590219cfb72c356c99292405263f34f6a15078828f421e47c9` |
| 지원 `/support/` | `37ac824e1ff6baaf80a8a8da0b1c930b642d48b1e03172df0d6b1660537d401d` | `38b9bf339b64804e2171daf73be9c563ee8f229616889a70a34a5907b7ec0254` |

게시 묶음은 `public-site/`의 `_headers`, `_redirects`, `robots.txt`, `assets/styles.css`, 위 HTML 3개인 총 7파일이다. 실제 Pages 프로젝트 생성·게시·URL 확인은 수행하지 않았다.

### Connect 교체값

- 앱 설명: 이 파일 §5와 `publish/app-store-submission.md`의 `설명 — Connect 저장값` 전체 블록. 513자.
- App Review Notes: 이 파일 §6의 한국어 또는 영어 전체 블록. 한국어 988자/2,236 bytes, 영어 2,088자/bytes.
- App Privacy 최종 입력안: Email Address, User ID, Precise Location, Product Interaction, Other Usage Data, 문의 사용자의 Customer Support는 `예`; 명시 비사용 범주와 Tracking은 `아니오`. Precise Location은 좌표 존재만으로 판단한 것이 아니라 Apple 정의와 계정 코스 보관 가능 경로를 함께 적용했다.
- App Privacy 미확인: Search History, Diagnostics, Device ID. 공급자가 데이터를 실시간 요청 처리보다 오래 접근하는지와 식별자에 연결하는지가 확인되지 않아 Connect 입력·publish 전에 결정해야 한다.
- screenshot: 기존 6장 중 03 장소 상세와 05 주변 둘러보기만 교체. 01·02·04·06은 최종 후보와 일치하면 유지한다.

### 검증과 남은 필수 공백

- `node docs/05_release/validate-public-site.mjs`: PASS, 허용된 7파일·HTML 3페이지·version1.0·상대 링크·메일·viewport·보안 헤더·금지 placeholder/script 검사 완료.
- 공개 원본·HTML 의미 검사: GPS/권한 미사용, 수동 장소 선택, 버튼 기반 체류/완료 문구 존재와 철회된 권한 요청·거절 안내 부재 PASS.
- `git diff --check`: PASS. 제품 테스트는 QA-RELEASE-MANUAL-LOCATION-01과 U-LIVE-FINAL-HANDOFF-FEEDBACK-01 결과를 인수했고 문서 작업에서 반복하지 않았다.
- 남은 필수 공백은 실제 시행일, 공개 HTTPS URL 3개, 신고 처리 결과가 요구하는 추가 고지, 공급자 법적 분류·국외 이전 필수 필드, App Privacy 보류 3항목, 국제 형식 심사 전화번호, 비만료 심사 계정, 최종 Distribution IPA·iPhone 확인, 교체 screenshot 03·05, Connect 수동 출시 저장 확인, 게시·업로드·제출 승인이다.

제품 코드·DB registry·공급자 설정·Connect·외부 게시는 변경하지 않았다. 기술 검증을 신고 면제나 법적 적합성으로 승격하지 않는다.
