# TimeFit App Store 제출 초안·App Privacy 대응표

기준일: 2026-09-07
상태: 내부 입력용 초안. App Store Connect 입력·업로드·제출은 하지 않았다.

## 1. 스토어 메타데이터 초안

| 필드 | 초안 | 상태 |
| --- | --- | --- |
| 앱 이름 | TimeFit | 사용자 확정 필요. 현재 `app.json`과 main app 표시명은 `mobile`, extension은 TimeFit으로 불일치 |
| 부제 | 약속 전, 부산 한 곳 더 | 30자 이내 초안 |
| 기본 언어 | 한국어 | Connect 확인 필요 |
| 기본 카테고리 | 여행 | 사용자 확정 필요 |
| 보조 카테고리 | 라이프스타일 | 사용자 확정 필요 |
| 가격 | 무료 | Connect 계약·세금 category 확인 필요 |
| 최소 OS | iOS 17.0 | app.json/Xcode source 기준. 최종 archive 확인 필요 |
| 지원 기기 | iPhone 및 iPad로 설정됨 | `supportsTablet=true`. iPad 출시 유지 여부와 실제 레이아웃 증거 필요 |

### 설명 초안

약속까지 남은 시간, 그냥 기다리지 마세요.

TimeFit은 부산에서 출발지와 약속 장소, 남은 시간을 바탕으로 지금 들를 수 있는 장소와 이동 코스를 제안합니다.

- 현재 위치를 사용하거나 부산의 장소를 직접 검색해 출발지를 설정할 수 있어요.
- 실제 경로와 운영시간, 도착 여유를 확인한 한 장소 추천을 먼저 보여드려요.
- 마음에 드는 검증 후보를 직접 고르면 최대 두 장소 코스를 비교해 구성할 수 있어요.
- 장소 상세와 지도에서 위치와 근거를 확인하고 카카오맵 길찾기로 이어갈 수 있어요.
- 도착·출발 안내와 Live Activity로 진행 코스를 확인할 수 있어요.
- 코스를 마치면 방문 기록을 기기에 남기고, 로그인하면 계정 기록을 관리할 수 있어요.

추천 이동시간과 운영시간은 교통·임시 휴무·행사 등에 따라 달라질 수 있습니다. 출발 전 카카오맵과 장소의 최신 안내를 확인해 주세요.

서비스 지역: 부산
지원 환경: iOS 17 이상

개인화 문구는 실제 서버 학습 검증 PASS 때만 아래 한 줄을 추가합니다.

> 별도로 동의하면 새 코스의 확인된 체류 기록을 바탕으로 다음 추천 시간을 맞춰드려요.

### 키워드 초안

`부산여행,약속,자투리시간,장소추천,코스,산책,카페,길찾기,주변장소`

앱 이름과 회사명은 키워드에서 중복하지 않는다. 최종 입력 전 UTF-8 100 bytes 제한을 Connect에서 확인한다.

### 프로모션 텍스트 초안

부산에서 약속 전 남은 시간에 맞는 장소와 실제 이동 코스를 찾아보세요.

첫 버전에는 ‘새로운 기능’ 문구가 필요하지 않다. 앱 preview는 선택 사항이며 출시 필수로 만들지 않는다.

## 2. App Privacy 입력 대응표

Apple의 ‘수집’은 데이터를 기기 밖으로 전송해 실시간 요청 처리에 필요한 시간보다 오래 개발자 또는 제3자가 접근할 수 있는 경우다. 기기에서만 처리하는 데이터는 라벨 수집에 포함하지 않는다. 그러나 TimeFit은 계정 코스·완료 기록을 서버에 저장하고, 공급자 로그·backup 보유가 미확인이므로 ‘수집 없음’으로 답할 수 없다.

| Apple 데이터 유형 | 수집 여부 초안 | 목적 | 사용자 연결 | 추적 | 근거·입력 전 확인 |
| --- | --- | --- | --- | --- | --- |
| Contact Info → Email Address | 예 | App Functionality: 가입·로그인·보안·지원 | 예 | 아니오 | Supabase Auth. 지원 이메일로 문의를 받으면 Customer Support 목적도 검토 |
| Identifiers → User ID | 예 | App Functionality; 조건부 Product Personalization | 예 | 아니오 | 일반/anonymous Auth ID, 계정 기록. 닉네임은 screen name 성격이라 User ID 분류를 우선 검토 |
| Location → Precise Location | 예 | App Functionality: 주소·주변·경로·코스 저장 | 예 | 아니오 | 위도·경도 3자리 이상. 로그인 코스 저장과 JWT route 요청 때문에 linked로 보수 판정 |
| Search History | **조건부 예** | App Functionality | Kakao 보유·계정 결합 여부에 따라 결정 | 아니오 | 앱 서버는 검색어를 저장하지 않지만 Kakao 요청 로그가 실시간 처리 후 남는지 미확인. 공급자 확인 전 누락 금지 |
| Usage Data → Product Interaction | 예 | App Functionality; 조건부 Product Personalization | 예 | 아니오 | 저장·완료한 코스와 방문 장소, 동의 상태 |
| Usage Data → Other Usage Data | **개인화 포함 시 예** | Product Personalization, App Functionality | 예 | 아니오 | 실제 체류 분과 완료 시각. 개인화 미출시 빌드에서 서버 경로 비활성 증명 시 제거 검토 |
| User Content → Other User Content | 확인 필요 | App Functionality | 예 | 아니오 | 사용자가 입력한 주소/장소 선택과 닉네임을 Apple 정의상 별도 user content로 중복 신고할지 Connect 설명과 대조 |
| User Content → Customer Support | 지원 채널에 따라 예 | App Functionality | 보통 예 | 아니오 | 지원 이메일/폼에서 사용자가 보낸 문의·첨부를 운영자가 보관하면 추가 |
| Diagnostics | 현재 앱 수집 아니오 | 해당 없음 | 해당 없음 | 아니오 | native 진단은 기기 전용·수동 복사. Supabase/Cloudflare가 요청 로그를 diagnostics로 보유하면 유형 재검토 |
| Device ID | 미확인 | 보안·오남용 방지 가능 | 미확인 | 아니오 | 광고 ID SDK는 없음. Cloudflare/Supabase가 Apple 정의의 device-level ID를 장기 보유하는지 확인 |
| Photos or Videos, Contacts, Health, Fitness, Financial, Purchases, Advertising | 아니오 | 해당 없음 | 해당 없음 | 아니오 | 현재 dependency·production entry에서 수집 경로 없음 |

**Tracking:** 광고 SDK, 데이터 브로커 공유, 타사 데이터와 결합한 표적 광고 경로를 찾지 못했으므로 ‘추적에 사용 안 함’ 초안이다. 공급자 계약과 최종 SDK inventory에서 동일함을 확인한다.

**개인화 조건:** Apple 답변은 일부 사용자만 선택적으로 제공받는 데이터도 모두 포함해야 한다. 따라서 개인화가 출시되면 opt-in이라는 이유로 체류 데이터를 숨기지 않는다. 개인화가 제외되면 UI 숨김만으로 부족하고 서버 호출 불가·migration/endpoint 비활성·최종 artifact를 함께 확인한다.

## 3. 심사 메모 초안

```
TimeFit은 부산에서 약속 전 남은 시간에 들를 장소와 실제 이동 코스를 제안하는 앱입니다. 핵심 추천은 로그인 없이 사용할 수 있습니다.

재현 절차
1. 첫 화면에서 시간을 현재 시각 이후 30~120분 범위로 선택합니다.
2. 위치 권한은 허용해도 되고 거절해도 됩니다. 거절한 경우 출발지와 약속 장소에 부산 장소를 직접 검색해 선택합니다.
3. 추천 결과에서 장소 카드를 눌러 상세 지도와 근거를 확인합니다. ‘선택하기’로 한 장소 코스를 확인할 수 있습니다.
4. 검증된 다른 후보를 선택하면 최대 두 장소 조립을 확인할 수 있습니다. 방문 순서는 실제 경로 비교로 정합니다.
5. 코스 확인 화면에서 카카오 길찾기를 누릅니다. 카카오맵 앱이 없으면 웹 fallback을 사용합니다.
6. 알림과 Live Activity는 선택 사항입니다. 거절해도 앱 내 코스와 길찾기는 계속 사용할 수 있습니다.
7. 코스를 마치면 비로그인 상태에서는 기기 기록에 저장됩니다.

서비스 지역은 부산이며, 실제 이동 없이 심사하려면 출발지와 약속 장소를 부산의 공개 장소로 수동 입력해 핵심 흐름을 확인할 수 있습니다. 현재 시각을 사용하므로 개발용 고정 시각 버튼은 없습니다.

계정 기능
- 로그인 없이 핵심 기능을 모두 확인할 수 있습니다.
- 계정 생성과 로그인은 이메일 방식입니다.
- 계정 삭제는 내정보 > 프로필 관리 > 계정 삭제에서 시작합니다.
- 심사 계정이 필요하면 App Review Information의 전용 username/password 필드로만 제공합니다. 이 문서와 Notes에는 비밀번호를 적지 않습니다.

위치·외부 서비스
- foreground 위치만 사용하며 background location과 GPS 자동 도착은 사용하지 않습니다.
- Kakao 지도/장소/경로와 Supabase 인증·서버 기능을 사용합니다.
- 추천·이동·운영시간은 예상치이며 앱과 스토어 설명에서 확인 안내를 제공합니다.

[개인화 실제 서버 검증 PASS 시에만 추가]
로그인 후 내정보의 별도 맞춤 추천 동의를 켜고, 동의 후 새 코스에서 명시 도착·출발·완료한 표본만 사용합니다. 3개 미만이면 기본 추천을 유지합니다.
```

심사 연락 담당자의 이름·이메일·국제 형식 전화번호는 App Review Information에 별도 입력한다. backend와 공개 URL은 심사 기간 동안 접근 가능해야 한다.

## 4. 필요한 URL·계정·자산

| 항목 | 최소 요구 | 현재 상태 |
| --- | --- | --- |
| 개인정보 처리방침 URL | 로그인 없이 공개 HTTPS, 앱·Connect에서 접근 | 초안만 있음; 미게시·앱 미연결 |
| 지원 URL | 실제 운영자 연락 정보와 지원 방법 | 초안만 있음; 미게시·앱 미연결 |
| 이용약관 URL | 가입 registry와 앱 가입 화면에서 같은 버전 | 초안만 있음; registry 미등록 |
| Privacy Choices URL | 선택 사항. 삭제·동의 관리 설명에 유용 | 별도 URL 없이 privacy/support anchor로 대체 가능 여부 결정 |
| 심사 연락처 | 이름, 이메일, 국제 형식 전화 | 미확정 |
| 심사 계정 | 로그인 없이 핵심 심사 가능. 계정·개인화 심사용 전용 비만료 계정은 별도 보안 채널 | 미확정·문서에 비밀번호 기록 금지 |
| 앱 아이콘 | 최종 이름·브랜드와 일치, alpha 등 규격 확인 | 기존 asset은 있으나 최종 검수 미확인 |
| iPhone screenshots | 1~10장. 6.9형 허용 크기 우선 | 미준비/미확인 |
| iPad screenshots | iPad 지원 유지 시 필요 | P0 결정·증거 미확인 |
| 콘텐츠 권리 | 화면에 보이는 사진·지도·출처의 권리 | 406 이미지 권리·가시 출처 미확인 |
| 최종 signed build | main/extension version·build·signing 일치 | unsigned Release 근거만 존재; 미확인 |

권장 screenshot 순서: 시간·수동 위치 설정 → 한 장소 추천 → 장소 상세 지도 → 최대 두 장소 코스 확인 → 진행/Live Activity → 방문 기록. 계정 개인화는 서버 검증 전 screenshot에 넣지 않는다.

## 5. Connect 입력 전 확인

- 앱 이름 2~30자, 부제 30자 이하, 설명 4,000자 이하, 키워드 100 bytes 이하.
- 연령등급 설문 필수. 실제 콘텐츠·외부 웹·사용자 기능을 기준으로 답하고 임의 등급을 문서에서 확정하지 않는다.
- privacy manifest와 required-reason API를 최종 archive에서 확인한다. manifest의 collected types 빈 배열을 App Privacy 수집0의 근거로 쓰지 않는다.
- 암호화 사용 여부를 Connect 질문으로 판정하고 최종 답변을 기록한다. 현재 HTTPS/Supabase 사용만 보고 면제 여부를 임의 확정하지 않는다.
- 한국·EU 등 배포 국가별 사업자/거래자 정보 요구와 콘텐츠 권리를 확인한다.

## 6. 공식 출처

확인일 2026-09-07.

- App Privacy 정의·데이터 유형·연결·추적·선택적 수집: https://developer.apple.com/app-store/app-privacy-details/
- App Privacy URL과 Connect 입력: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- App Review Guidelines 2.1, 5.1.1, 5.1.5: https://developer.apple.com/app-store/review/guidelines/
- 계정 생성 앱의 앱 내 계정 삭제: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- 앱 이름·부제·privacy URL: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- 설명·키워드·지원 URL·심사 정보: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/
- screenshot 규격: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- 연령등급: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
- 암호화 수출 준수: https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
