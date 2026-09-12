# 짜투리 App Store 제출 초안·App Privacy 대응표

기준일: 2026-09-09
상태: 사용자 보고 기준 metadata·연령등급 입력 완료, 암호화 검토·앱 설정 반영 완료. GPS 미사용 설명·심사 문안과 App Privacy 최종 입력안을 갱신했으며 URL/심사 정보/build·Connect 반영은 대기다.

## 1. 스토어 메타데이터 초안

| 필드 | 초안 | 상태 |
| --- | --- | --- |
| 앱 이름 | 짜투리 | 사용자 확정·Connect 앱 생성에 반영. app config·main/extension 로컬 표시명 일치, Distribution IPA 재확인 |
| 부제 | 약속 전, 부산 한 곳 더 | 사용자 저장 완료 보고. 14자, Apple 30자 제한 이내 |
| 기본 언어 | 한국어 | Connect 앱 생성에 반영 |
| Bundle ID | `com.dongheun.mobile` | Connect 앱 생성에 반영. 최종 Distribution artifact와 대조 |
| SKU | `jjaturi-ios` | Connect 앱 생성에 반영. 중복 생성 금지 |
| 사용자 액세스 | 전체 | 사용자 저장 완료 보고 |
| 기본 카테고리 | 여행 | 사용자 확정·Connect 앱 생성에 반영 |
| 보조 카테고리 | 없음 | 사용자 확정·Connect 앱 생성에 반영 |
| 가격 | 무료 `₩0` | 사용자 저장 완료 보고. 세금 category는 제출 전 실제 선택 확인 |
| 저작권 | 2026 Dongheun Shin | 사용자 저장 완료 보고. 개인정보 운영자명 `신동흔`은 변경하지 않음 |
| 배포 지역 | 대한민국만 | 사용자 저장 완료 보고 |
| 최소 OS | iOS 17.0 | app.json/Xcode source 기준. 최종 archive 확인 필요 |
| 지원 기기 | iPhone 전용 | app config와 로컬 Development Archive의 `UIDeviceFamily=[1]` PASS. Distribution IPA 재확인 |

**입력 이력:** App Store Connect 앱 레코드 없음 → 사용자가 iOS / 짜투리 / 한국어 / `com.dongheun.mobile` / SKU `jjaturi-ios` / 사용자 액세스 전체 / 여행 / 보조 없음으로 생성 → 무료 `₩0`·대한민국만·부제·설명·프로모션·키워드·저작권 저장 완료 보고 → 아래 값을 현행 입력값으로 사용하고 이전 설명 초안으로 덮어쓰지 않음. 계정 원문 철자·대소문자를 문서 세션이 직접 검증한 것으로 표시하지 않는다.

### 앱 이름 — Connect 저장값

```text
짜투리
```

### 부제 — Connect 저장값

```text
약속 전, 부산 한 곳 더
```

### 설명 — Connect 저장값

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

### 키워드 — Connect 저장값

```text
부산여행,약속,자투리시간,장소추천,코스,산책,카페,길찾기,주변장소
```

앱 이름과 회사명은 키워드에서 중복하지 않는다. 현행 저장값은 UTF-8 **92 bytes**로 Apple 100 bytes 제한 이내다.

### 프로모션 텍스트 — Connect 저장값

```text
부산에서 약속 전 남은 시간에 맞는 장소와 실제 이동 코스를 찾아보세요.
```

첫 버전에는 ‘새로운 기능’ 문구가 필요하지 않다. 앱 preview는 선택 사항이며 출시 필수로 만들지 않는다.

### 저작권 — Connect 저장값

```text
2026 Dongheun Shin
```

## 2. App Privacy 입력 대응표

Apple의 ‘수집’은 데이터를 기기 밖으로 전송해 실시간 요청 처리에 필요한 시간보다 오래 개발자 또는 제3자가 접근할 수 있는 경우다. 기기에서만 처리하는 데이터는 라벨 수집에 포함하지 않는다. 그러나 짜투리는 계정 코스·완료 기록을 서버에 저장하고, Kakao endpoint별 호출 기록과 Supabase 조회 로그가 존재하며 공급자 내부 보유 범위가 미확인이므로 ‘수집 없음’으로 답할 수 없다.

| Apple 데이터 유형 | 최종 답변 상태 | 목적 | 사용자 연결 | 추적 | 적용 기능·저장 경계 | 코드·문서 근거 |
| --- | --- | --- | --- | --- | --- | --- |
| Contact Info → Email Address | **확정 예** | App Functionality; 사용자가 문의한 경우 Customer Support | 예 | 아니오 | Supabase Auth 서버 보관. 지원 메일을 보내면 메일 제공자·운영자 보관 | 이메일 가입·로그인 구현, `data-facts.md` 계정·지원 경계 |
| Identifiers → User ID | **확정 예** | App Functionality; Product Personalization | 예 | 아니오 | 일반/anonymous Auth ID와 계정 기록을 서버 보관. 닉네임도 screen name 성격의 User ID로 분류 | Auth ID, 계정 코스·개인화 repository 근거 |
| Location → Precise Location | **최종 입력안: 예** | App Functionality | 예 | 아니오 | GPS 센서 접근 여부가 아니라 Apple의 위치 데이터 정의와 수집 경계를 적용. 검색·핀으로 선택한 정밀 좌표가 계정 코스에 보관될 수 있어 실시간 요청만으로 끝나지 않는 경로가 있음 | Apple App Privacy 위치 데이터 정의, 정확 좌표+JWT Edge 요청, 계정 코스 저장·legacy 재확인 경로 |
| Search History | **미확인/입력 보류** | App Functionality | 미확인 | 아니오 | 앱 서버에는 검색어를 저장하지 않음. Kakao Local 요청은 일시 전송되며 요청 내용의 장기 보유·계정 결합 범위 미확인 | Kakao endpoint별 호출 기록, 공급자 NOTICE 미답변 |
| Usage Data → Product Interaction | **확정 예** | App Functionality; Product Personalization | 예 | 아니오 | 계정의 저장·완료 코스, 방문 장소와 동의 상태를 서버 보관 | 코스/완료/동의 repository 및 DB/API 완료 인계 |
| Usage Data → Other Usage Data | **확정 예** | App Functionality; Product Personalization | 예 | 아니오 | 별도 동의 뒤 생성한 코스의 실제 체류 분·완료 시각을 서버 보관 | 개인화 저장·조회·추천 운영 검증 015·016·017 |
| User Content → Customer Support | **확정 예(문의 사용자만)** | Customer Support | 예 | 아니오 | 사용자가 지원 이메일로 보낸 본문·첨부를 메일 제공자와 운영자가 보관 | 공개 지원 채널과 `support.md` |
| User Content → Other User Content | **확정 아니오** | 해당 없음 | 해당 없음 | 아니오 | 자유 입력 게시물·메모 없음. 닉네임·검색어·좌표는 각각 User ID·Search History·Location으로 분류 | production entry와 DB/API 자유 입력 감사 |
| Diagnostics | **미확인/입력 보류** | App Functionality 또는 Analytics 가능 | 미확인 | 아니오 | native 진단은 기기 내 저장 후 사용자가 직접 복사할 때만 전송. Supabase Edge 로그는 조회 가능하고 Cloudflare 운영자 선택 Logs·Traces는 꺼져 있으나 공급자 기본 로그의 Apple 분류·보유 범위 미확인 | 진단 구현, Supabase/Cloudflare 계정 확인, 공급자 NOTICE 미답변 |
| Identifiers → Device ID | **미확인/입력 보류** | 보안·오남용 방지 가능 | 미확인 | 아니오 | 광고 ID SDK는 없음. Turnstile·Supabase가 device-level 신호를 실시간 처리보다 오래 보유하는지 미확인 | SDK inventory, Cloudflare/Supabase NOTICE 미답변 |
| Photos or Videos, Contacts, Health, Fitness, Financial Info, Purchases, Advertising Data | **확정 아니오** | 해당 없음 | 해당 없음 | 아니오 | 해당 데이터의 기기 밖 전송·서버 보관 경로 없음 | dependency·production entry·DB/API 감사 |

### 처리·저장 경계 대조

| 경계 | 데이터·기능 | App Privacy 처리 |
| --- | --- | --- |
| 기기 내 전용 | 비로그인 완료 기록, 현재 진행 코스, Live Activity 상태, 로컬 알림, 사용자가 보내지 않은 native 진단 | 기기 밖 전송이 없으므로 수집 신고에서 제외 |
| 일시 외부 요청 | 좌표·장소 검색·지도·경로·Turnstile 보안 확인 | 실시간 요청 뒤 공급자가 접근할 수 있는 기간과 식별 결합 여부가 확인된 항목만 수집 여부 확정. Kakao 검색 및 공급자 로그·기기 신호는 위 표에서 보류 |
| 서버 보관 | 이메일, Auth/User ID, 계정 코스·완료·방문 기록, 동의 뒤 체류 분·완료 시각 | 수집 `예`; 계정·사용자 ID와 연결되고 추적에는 사용하지 않음 |

**Tracking:** 광고 SDK, 데이터 브로커 공유, 타사 데이터와 결합한 표적 광고 경로를 찾지 못했으므로 ‘추적에 사용 안 함’ 초안이다. 공급자 계약과 최종 SDK inventory에서 동일함을 확인한다.

**개인화:** Apple 답변은 일부 사용자에게서만 선택적으로 수집하는 데이터도 포함한다. 따라서 별도 동의 방식이어도 체류 데이터를 신고한다. 출시 artifact에서 개인화를 다시 제외하기로 결정한다면 UI 숨김만으로 판단하지 않고 서버 호출 불가·endpoint 비활성 증거와 함께 이 표를 다시 작성한다.

**API NOTICE·계정 반영:** Kakao Developers에서 Local 키워드·좌표→행정구역·좌표→주소·주소검색, Maps JavaScript, REST 도보·대중교통 endpoint의 실제 사용 기록을 확인했다. 월간 사용량은 확인 시점 2,691/최대 제공량 3,000,000이며 제한 상태는 없었다. 현재 WebView/REST 구현에는 Kakao iOS Bundle ID 등록이 필요하지 않고 WebView base URL `https://timefit.local`은 등록된 JavaScript SDK 도메인과 일치하므로 플랫폼 추가 조치는 없다. 상품 활성화·키별 제한·최종 runtime origin은 최종 후보 smoke 범위로 남는다. 현재 추천의 proxy 경로는 Supabase Edge→Kakao이고 실패 시 TMAP/ODsay로 자동 전환하지 않는다. EXIT-03으로 과거 기록 없는 종료→MyCourses 진입은 닫혔지만 legacy 활성 상태와 최종 artifact까지 TMAP/ODsay 전송0으로 확정하지 않는다. 유료 API 미사용과 쿼터 여유를 개인정보 미처리의 근거로 사용하지 않는다.

## 3. App Review Notes 복사용 문안

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

심사 연락 담당자의 이름·이메일·국제 형식 전화번호는 App Review Information에 별도 입력한다. backend와 공개 URL은 심사 기간 동안 접근 가능해야 한다.

## 4. 필요한 URL·계정·자산

| 항목 | 최소 요구 | 현재 상태 |
| --- | --- | --- |
| 개인정보 처리방침 URL | 로그인 없이 공개 HTTPS, 앱·Connect에서 접근 | 초안만 있음; 미게시·앱 미연결 |
| 지원 URL | 실제 운영자 연락 정보와 지원 방법. Apple은 현지 법에 따라 필요한 주소·이메일·전화 등 실제 연락 정보를 요구 | 이메일·지원 방법 원본·HTML 완료. 신고 후속에서 실제 주소·전화 표시 필요 여부를 확인한 뒤 게시·앱 연결 |
| 이용약관 URL | 가입 registry와 앱 가입 화면에서 같은 버전 | 초안만 있음; registry 미등록 |
| Privacy Choices URL | 선택 사항. 삭제·동의 관리 설명에 유용 | 별도 URL 없이 privacy/support anchor로 대체 가능 여부 결정 |
| 심사 연락처 | 이름, 이메일, 국제 형식 전화 | 미확정 |
| 심사 계정 | 로그인 없이 핵심 심사 가능. 계정·개인화 심사용 전용 비만료 계정은 별도 보안 채널 | 사용자 준비 확정·아직 미생성. 문서에 비밀번호 기록 금지. 삭제 테스트 계정과 분리 |
| Kakao 플랫폼 등록 | 현재 WebView/REST 사용 방식의 인증 경계 일치 | 현재 구현에는 iOS Bundle ID 등록이 필요하지 않음. WebView base URL `https://timefit.local`은 등록된 JavaScript SDK 도메인과 일치해 추가 조치 없음. 상품 활성화·키별 제한·최종 runtime origin은 후보 smoke에서만 확인 |
| 앱 아이콘 | 최종 이름·브랜드와 일치, alpha 등 규격 확인 | 승인 시안을 `assets/jjaturi-icon-blue.png`에 1024×1024 PNG/RGB/불투명/sRGB로 적용, Expo와 생성 iOS asset 픽셀 동일 PASS. 최종 후보 홈 화면·Store 표시만 대기 |
| iPhone screenshots | 언어별 1~10장, JPEG/JPG/PNG, alpha·투명도 금지. 6.9형 portrait는 `1260×2736`, `1290×2796`, `1320×2868` 중 하나 사용. 6.9형을 제공하지 않으면 6.5형 제출이 필수 | 최신 화면 촬영 전. 최종 후보 UI로 6.9형 portrait 6장 계획 |
| iPad screenshots | iPhone 전용이므로 불필요 | 최종 Archive의 device family가 iPhone 전용인지 재확인 |
| 콘텐츠 권리 | 화면에 보이는 사진·지도·출처의 권리 | DATA 재집계 허용 101/369(부산 명소85·맛집16), 변경·상업 이용 가능·가시 출처 연결 검증. 미확인102·사진 없음166은 기본 이미지. 데이터 기준 차단 없음; 최종 후보 4사례 smoke와 Kakao 표시조건 확인 |
| 최종 signed build | main/extension version·build·signing 일치 | NATIVE-02 로컬 Archive에서 양쪽 짜투리·1.0.0(1)·iPhone·iOS17·App Group·target별 privacy manifest·codesign PASS. Apple Development 서명(`get-task-allow=true`)이며 EXIT-03 이후 최종 Archive, Distribution IPA·온라인 Validate는 미실행 |

### iPhone screenshot 6장 현황과 GPS 전환 영향

작업 폴더에 기존 6장(`output/app-store-screenshots-XHq0ou/`)이 있다. 화면 변경과 직접 충돌하는 컷만 교체하며, 존재하는 자산을 미촬영으로 되돌리지 않는다.

| 순서·파일 | 현재 화면 | 판정 | 교체 기준 |
| --- | --- | --- | --- |
| 01 `01-setup.jpg` | 최대 3시간·수동 출발/복귀 | **유지 가능** | 이미 수동 선택 장소가 표시되고 현재위치·권한 CTA가 없음. 최종 후보 UI와 일치하는지만 재확인 |
| 02 `02-recommendations.jpg` | 한 장소와 다른 후보 | **유지 가능** | GPS·권한·현재위치 표현 없음. 기존 캡션 유지 |
| 03 `03-place-detail-review-needed.jpg` | 장소 상세·지도 | **교체 필요** | 철회된 `현재 위치를 확인하지 못했어요` 안내와 GPS 모양 위치 버튼이 보임. 새 화면은 선택 출발지·방문 장소 marker만 표시해야 함 |
| 04 `04-course.jpg` | 코스 확인 | **유지 가능** | 수동 출발·복귀 장소와 경로가 표시되고 GPS 권한 표현 없음 |
| 05 `05-nearby-review-needed.jpg` | 주변 둘러보기 | **교체 필요** | GPS 모양 현재위치 버튼이 보임. 새 화면은 검색·지도 선택한 기준 장소와 가까운 순 결과를 보여야 함 |
| 06 `06-history.jpg` | 방문 기록 | **유지 가능** | 버튼 기반 완료 기록 화면이며 GPS 전환으로 표시 계약이 바뀌지 않음 |

교체 컷은 03과 05 두 장이다. 01·02·04·06은 최종 후보와 대조해 다른 UI 변경이 없으면 재사용할 수 있다. Live Activity는 현재 6장 묶음에 별도 파일이 없으므로 “기존 이미지 없음”으로 일반화하지 않고, Connect에서 진행 공유를 강조하려는 경우에만 실제 native Activity 보조컷을 추가한다. 화면 합성이나 과거 GPS 문구 수정본은 사용하지 않는다.

## 5. 사용자 직접 입력 항목

완료 보고가 있는 값은 재입력하거나 이전 초안으로 덮어쓰지 않는다.

| Connect 항목 | 상태 | 사용자가 할 일·완료 증거 |
| --- | --- | --- |
| 앱 레코드·기본 metadata | **완료** | 앱명/언어/Bundle ID/SKU/액세스/category, 부제·설명·프로모션·키워드, 무료·대한민국·저작권 저장 완료 보고 재사용 |
| 연령등급 | **사용자 완료** | 설문 완료 보고 재사용. 계산된 정확한 등급 값은 전달받지 않아 이 문서에서 추정·재입력하지 않음 |
| 암호화 검토·앱 설정 | **완료** | 비면제 암호화 미사용 판단 및 `usesNonExemptEncryption=false` 반영, 생성 main plist와 Release Simulator plist의 `ITSAppUsesNonExemptEncryption=false` 확인. 최종 Distribution IPA 값만 빌드 담당이 대조 |
| App Privacy | **최종 입력안 준비·일부 미확인** | Email·User ID·Precise Location·Product Interaction·Other Usage Data·Customer Support는 예, 명시 비사용 항목과 Tracking은 아니오로 입력. Search History·Diagnostics·Device ID는 아래 미확인 근거를 해소한 뒤 결정하고 Connect preview/publish 결과 반환 |
| 개인정보 처리방침·지원 URL | **게시 뒤 입력** | 승인된 실제 HTTPS URL만 입력. 예정 주소나 로컬 경로 입력 금지 |
| 심사 연락처 | **미완료** | 이름 신동흔, `sdongheun@gmail.com`, 실제 국제 형식 전화번호를 App Review Information에 입력 |
| 심사 계정 | **미완료** | 전용 비만료 계정을 생성·로그인 확인한 뒤 ID/password를 Connect 전용 필드에 입력. 탈퇴 E2E 계정과 분리하고 저장소·Notes에 비밀번호를 남기지 않음 |
| Version/build·screenshots | **미완료** | 최종 링크가 반영된 후보의 version/build를 선택하고 검수된 6장만 업로드 |
| 출시 방식 | **정책 확정·Connect 저장 확인 대기** | `DEC-RELEASE-MANUAL-02`에 따라 **수동 출시**를 선택·저장하고 표시 결과를 확인. 이전 자동 출시 결정은 철회 |
| App Review Notes | **문안 완료·입력 대기** | 위 한국어 또는 영어 문안을 복사하고 제출 직전 실제 후보 장소·계정 가용성만 확인 |
| 업로드·심사 제출 | **미승인** | 최종 게이트 검토 뒤 사용자의 별도 승인으로만 실행 |

앱 이름 3자, 부제 14자, GPS 미사용 교체 설명 513자, 키워드 92 bytes, 프로모션 텍스트 40자, 저작권 18자로 현행 제한 안에 있다. privacy manifest 로컬 감사 결과와 App Privacy 수집 답변은 서로 대체하지 않으며, 최종 Distribution IPA에서 main/extension manifest·required-reason API·암호화 plist 값을 확인한다.

### 위치 문의 회신 접수 뒤 남은 후속

기존 `답변 대기` 상태는 종료됐다. 접수된 회신은 등록 면제나 공개 출시 승인을 확정한 근거가 아니며, 현재 남은 일은 실제 신고 절차와 그 결과에 따른 고지 범위를 확인하는 것이다.

| 반영 위치 | 남은 후속 |
| --- | --- |
| 개인정보 처리방침 제4·7절과 대응 HTML | GPS 미사용 기술 사실은 반영 완료. 신고 처리 결과가 요구하는 책임자·연락 표시가 있을 때만 최소 추가 |
| 이용약관 장소 선택 조항과 대응 HTML | GPS·권한 문구 교체 완료. 별도 위치 약관이 실제로 필요하다는 근거가 생길 때만 추가 |
| 지원 안내와 대응 HTML | 수동 장소 선택 안내 반영 완료. 신고 처리 결과가 요구하는 주소·전화가 있을 때만 추가 |
| 게시·출시 시점 | 신고·필수 고지 확인과 별도 게시 승인을 구분해 결정 |

회신이나 신고의 법적 결론은 App Privacy 답변을 자동으로 바꾸지 않는다. App Privacy는 Apple의 데이터 유형·수집·사용자 연결·추적 정의와 실제 전송·보관 경로로 판단한다.

### 연령·암호화 완료 근거

| 항목 | 현재 확인 사실 | 남은 확인 |
| --- | --- | --- |
| 연령등급 | 사용자가 Connect 설문 완료를 보고했다. 어린이 대상 기획이 아니며 게시물·채팅·광고·구매·도박·의료, 범용 웹 접근과 사용자 간 위치 공유 기능이 없다는 기존 기능 근거를 재사용했다 | 계산된 정확한 등급 값은 전달받지 않았으므로 재입력·추정하지 않는다. 최종 후보의 기능 범위가 바뀔 때만 영향 확인 |
| 암호화 | HTTPS/TLS와 OS·SDK 제공 암호화를 사용하고 OS 밖 자체·비표준 암호화 근거는 없다. 검토 결과 비면제 암호화 미사용, 별도 문서 불필요로 판정했고 `usesNonExemptEncryption=false` 설정과 생성 plist 반영을 확인했다 | 최종 Distribution IPA의 main plist와 포함 의존성이 검토 당시와 같은지만 대조 |

## 6. 사용자 결정 묶음

| 결정 | 권장안 | 필수 구분·이유 |
| --- | --- | --- |
| 문서 시행일·version | 실제 공개일 / `1.0` | 사용자 확정. 실제 날짜는 게시 성공 뒤 기록 |
| 개인정보 권리 요청 이메일 | `sdongheun@gmail.com` | 사용자 확정 |
| 개인정보 보호 책임자 | 신동흔 | 사용자 확정 |
| 가입 연령 | 만14세 이상 필수 자기확인 | 사용자 확정·AGE-01 자동 검증 완료·최종 링크/실기기 대기. 생년월일 수집이나 실제 인증으로 표현 금지 |
| 기본/보조 카테고리 | 여행 / 없음 | 사용자 확정 |
| 가격 | 무료 | 사용자 확정·Connect `₩0` 저장 완료 보고. 세금 category는 제출 전 확인 |
| 저작권 표기 | `2026 Dongheun Shin` | Connect 저장 완료 보고. 개인정보 운영자 표기 `신동흔`과 구분 |
| 최종 아이콘 | 승인된 파란 시계 시안 적용 | 1024×1024 불투명 sRGB asset·Expo/iOS 소비 경로 자동 검증 완료. 최종 후보 홈/Store 표시 대기 |
| 연령등급 | 사용자 설문 완료 | 계산된 정확한 등급 값은 미전달. 재입력·임의 숫자 확정 없이 완료 보고 유지 |
| 심사 연락처 | 신동흔/지원 이메일 + 국제 형식 전화번호 | App Review Information 준비에 필요. 비밀번호와 별도 |
| 심사 계정 | 별도 비만료 계정 1개 | 사용자 준비 확정·아직 미생성. 비밀번호는 Connect 전용 필드에만 저장 |
| 출시 방식 | 심사 승인 뒤 수동 출시 | `DEC-RELEASE-MANUAL-02` 현행. Connect에서 실제 수동 출시 선택·저장 결과만 확인 대기 |
| 지원 시간·목표 답변 | 예: 평일 기준 3영업일 이내 | 운영 권장사항이며 Apple 제출 자체의 필수 기능으로 확대하지 않음 |

## 7. 공식 출처

Apple metadata·App Privacy·screenshot 확인일 2026-09-09. 나머지 기존 법적·기술 근거 확인일은 각 원문 기록을 따른다.

- App Privacy 정의·데이터 유형·연결·추적·선택적 수집: https://developer.apple.com/app-store/app-privacy-details/
- App Privacy URL과 Connect 입력: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- App Review Guidelines 2.1, 5.1.1, 5.1.5: https://developer.apple.com/app-store/review/guidelines/
- 계정 생성 앱의 앱 내 계정 삭제: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- privacy manifest 및 required-reason API: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- 특정 제3자 SDK privacy manifest·서명 요건: https://developer.apple.com/support/third-party-SDK-requirements/
- 앱 이름·부제·privacy URL: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- 설명·키워드·지원 URL·심사 정보: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/
- screenshot 규격: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- 연령등급: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
- 암호화 수출 준수: https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
- 필수·편집 가능 metadata: https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties
- 가격·배포 지역·세금 category: https://developer.apple.com/help/app-store-connect/reference/pricing-and-availability/app-pricing-and-availability/
