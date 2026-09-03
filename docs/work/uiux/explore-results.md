# U-EXPLORE-01 — 대표 코스·장소 탐색 결과 화면

## 목적과 의존성

결과 화면을 “대표 1개만 보이는 정확 코스”에서 “대표 1개 + 충분히 둘러볼 수 있는 고유 장소 탐색 목록”으로 바꾼다. 화면 구현은 **2-P의 타입·선택 결과 계약이 수락된 뒤에만** 시작한다. 다만 이 문서의 화면 상태·접근성·fixture 설계 검토는 DATA-AREA-01과 병렬로 가능하다. UIUX는 `src/ui/`과 화면 테스트만 수정하며 엔진·데이터·Route Proxy·보드는 수정하지 않는다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/UIUX_공통규칙.md` 4-1, `docs/03_product/UIUX_테스트명세.md` `UXV-20`, `UXV-42`
3. 수락된 `docs/work/recommendation-engine/explore-result-contract.md`와 필요한 화면 현재 파일만

## 화면 계약

1. 최상단 `이 시간의 추천`은 기존 실제 경로 검증 완료 대표 코스만 표시한다. 실제 이동·활동·도착 여유 시간표는 이 영역과 선택 검증 성공 화면에만 쓴다.
2. 대표 아래 `이 시간에 더 들러볼 곳`은 장소 카드 목록이다. 카드에는 사진/대체 이미지, 장소명, 지역+활동, 발견 자격에 맞는 짧은 맥락을 표시한다. `area_access`만 `가볍게 둘러보기 · 약 20분`을 표시한다.
3. 탐색 카드에는 실제 이동 분, 도착 시각, `추천`, `짧게 가능`, `검증됨`을 표시하지 않는다. 화면은 이 카드가 “선택하면 확인” 대상임을 짧은 행동 라벨로 알린다.
4. 목록은 첫 묶음과 `더 보기` 또는 점진 로딩을 제공한다. 제품상 총 3개 상한은 없으며, 항목을 더 표시해도 엔진 재실행·route API 호출이 일어나면 안 된다. 스크롤 접근성·하단 safe-area 여백을 보장한다.
5. 탭한 카드만 로딩 상태가 되고 중복 탭을 막는다. 성공하면 기존 코스 확인 화면/상세에 **선택 1곳의 실제 검증 스냅샷**을 넘긴다. 실패하면 목록 위치·대표를 유지하고 `경로를 확인하지 못했어요` / `시간이 부족해요` / `접근 가능 시간을 확인하지 못했어요` 중 엔진 reason에 맞는 한 문장과 재선택 행동을 보인다.
6. `conditional` 후보와 근거 없는 장소는 이 목록에 표시하지 않는다. 기존 `지도에서 더 보기`의 `운영시간 확인 필요`와 카카오맵 링크는 유지한다.

## 구현 전 체크와 필수 테스트

- 기존 “검증 대안 목록” 컴포넌트·문구가 결과 화면에 남는지 확인하고, 남으면 일괄 전환한다. 기존 시간 여정/코스 확인의 실제 스냅샷 표시는 훼손하지 않는다.
- representative only / representative+20 탐색 / primary 실패+탐색 있음 / 탐색 없음 / `area_access` / 선택 로딩·성공·3종 실패 fixture를 만든다.
- 목록 렌더, 더 보기, 스크롤은 route mock 0회; 카드 선택만 1회 엔진 선택 entry를 호출함을 검증한다.
- 동일 장소·siteGroup 중복, 실제 시간표 노출, area_access 문구의 시설형 노출, 실패 뒤 목록 초기화/자동 다음 후보 호출을 UI 계약 테스트로 차단한다.
- VoiceOver: 목록 제목·카드 행동·20분 의미·로딩/실패 상태를 읽을 수 있게 한다. 길고 반복되는 설명·권역 전체 보장 문구는 쓰지 않는다.

## 금지

- 탐색 카드를 시간에 맞는 확정 코스처럼 보이게 만드는 것.
- 탐색 목록을 3개만 보이고 같은 버튼으로 새 route 요청을 반복하는 것.
- 대표 영역의 실제 여정과 탐색 카드의 1차 후보 정보를 하나의 시간 막대에 섞는 것.
- 엔진 결과 코드 대신 UI가 원인을 추정하거나, 데이터 분류를 화면에서 보정하는 것.

## 완료 기준과 인계

`npm run test:typecheck`, `npm run test:ui`, 관련 UI test, `git diff --check`를 실행한다. 인계에는 (1) 변경 파일·목적, (2) UI가 변경하지 않은 엔진/데이터/API 계약, (3) 테스트 결과, (4) iOS 수동 확인이 필요한 스크롤·선택·실패 상태를 남긴다. 보드는 수정하지 않는다.

## 완료 인계 — 2026-08-31

### 1. 변경 파일·목적

- `src/ui/ResultsScreen.tsx`: 기존 검증 대안 코스 목록을 대표 코스 아래의 탐색 장소 목록으로 전환했다. 목록과 `더 보기`는 로컬 페이지를 이어 붙이고, 카드 선택 때만 검증을 요청하며 성공 스냅샷으로 코스 확인 화면으로 이동한다.
- `src/ui/recommendation/v1Session.ts`: 화면이 사용할 탐색 페이지 생성·선택 검증 경계를 추가했다. 선택 실패 reason을 비밀 없는 사용자 문장으로 변환한다.
- `src/ui/recommendation/ExplorationPlaceCard.tsx`: 사진/대체 이미지, 장소명, 지역·활동, 발견 맥락과 선택 행동만 표시하는 접근 가능한 탐색 카드 컴포넌트를 추가했다.
- `test/ui/exploration-results.test.ts`, `test/map-transport-ui-contract.test.mjs`: 목록·더 보기의 무경로 호출, 선택 검증, 성공 스냅샷, 실패 문구와 금지된 시간/검증 표현의 회귀를 고정했다.

### 2. 유지한 계약·정책 경계

- 엔진의 탐색 후보 자격·`conditional` 제외·선택 reason과 데이터 카탈로그는 변경하지 않았다. UI는 후보를 재분류하거나 실패 원인을 추정하지 않는다.
- 첫 목록과 `더 보기`는 route API/엔진 재실행을 하지 않으며, 탭한 한 장소만 선택 검증 경계로 보낸다.
- 대표 코스의 실제 이동·활동·도착 여유 시간표와 선택 성공 시의 검증 스냅샷은 유지했다. 탐색 카드에는 실제 이동 시간·도착 시각·`추천`·`짧게 가능`·`검증됨`을 표시하지 않는다.
- `area_access`에만 `가볍게 둘러보기 · 약 20분`을 노출한다. 보드와 엔진·데이터·Route Proxy 소유 파일은 수정하지 않았다.

### 3. 테스트 결과

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과.
- `npm test` 통과 (105 tests).
- `git diff --check` 통과.
- 고정 fixture만 사용했으며 실제 외부 API·CAPTCHA·Supabase 호출은 0회다.

### 4. 다음 결정·위험·재현 조건

- iOS 수동 확인: 대표+탐색, 탐색 없음, `더 보기` 뒤 스크롤, 한 카드의 로딩/중복 탭 차단, 세 실패 문구 뒤 목록 위치 유지와 VoiceOver 읽기를 확인한다.
- 실제 활성 Route Proxy 환경에서는 선택 1건의 성공과 route 미검증·시간 부족·접근 가능 시간 미확인 응답을 각각 fixture/테스트 빌드로 재현해, 화면의 reason 매핑이 유지되는지 확인한다.

---

## 재개 지시 — 탐색 카드 카카오맵 확인 링크

### 재개 이유와 결정

QA-EXPLORE-01은 현재 카드에 `선택해 확인`만 있고 카카오맵 외부 전환이 없어 보류됐다. 기존 UI 계약의 “카카오맵 링크 유지”와 탐색 카드의 장소 발견 목적을 기준으로, 링크 요구를 대표 코스에만 한정하지 않는다. **탐색 카드마다 선택 검증과 별개의 `카카오맵에서 확인` 행동을 추가한다.** 이는 탐색 카드가 정확 코스라는 뜻이 아니며, 사용자에게 사진만으로 부족한 위치·장소 맥락을 확인시키는 보조 행동이다.

### 구현 범위

1. `ExplorationPlaceCard`에 `카카오맵에서 확인` 보조 행동을 추가한다. `선택해 확인`은 실제 1곳 검증의 주 행동으로 남기고, 두 행동의 접근성 라벨·비활성 상태를 분리한다.
2. 결과 화면은 기존의 단일 `openKakaoPlace` 경계만 재사용한다. 링크 탭은 `Linking.openURL`만 호출하며, `verifyRecommendationExplorationPlace`, route adapter, exploration pagination, 대표 코스·선택 로딩 상태를 호출하거나 바꾸지 않는다.
3. 직접 상세 URL은 검증된 Kakao Place URL일 때만 사용한다. `weak`·없음은 제목·유효 좌표 기반 HTTPS 검색 URL로만 열고, URL을 만들 수 없으면 CTA를 렌더하지 않는다. 링크 실패는 해당 카드 또는 결과 화면에서 짧게 알리되, 선택 검증 실패 문구와 섞지 않는다.
4. 탐색 카드에는 실제 이동시간·도착 시각·`추천`·`검증됨`을 여전히 표시하지 않는다. `area_access`의 `가볍게 둘러보기 · 약 20분`도 그대로 유지한다.

### 필수 회귀

- verified URL / weak URL의 좌표 검색 fallback / URL 불가 숨김 / Linking 실패를 고정 mock으로 검증한다.
- 링크 탭, 첫 목록, 더 보기, 스크롤 모두 route·receipt·선택 검증 0회다. 선택 탭만 기존 1곳 검증 경계를 호출한다.
- `npm run test:typecheck`, `npm run test:ui`, 관련 UI 테스트, `git diff --check`를 실행한다. 새 internal build에서 다대포 또는 암남공원/송도해안볼레길 카드의 링크와 선택 성공 또는 typed 실패를 각각 한 번만 수동 확인한다.

### 변경 금지·인계

엔진 발견 자격, `area_access` 두 곳 수, 카탈로그 원본, Route Proxy, 보드는 수정하지 않는다. 완료 인계에는 변경 파일·유지 경계·테스트·internal build에서 확인할 링크/선택 재현 조건을 남긴다.

## 링크 보완 완료 인계 — 2026-08-31

### 1. 변경 파일·목적

- `src/ui/recommendation/ExplorationPlaceCard.tsx`: 탐색 카드의 `선택해 확인`과 별개로, 만들 수 있는 카카오맵 URL이 있을 때만 `카카오맵에서 확인` CTA를 추가했다. 두 행동은 서로의 로딩·비활성 상태를 공유하지 않는다.
- `src/ui/ResultsScreen.tsx`: 기존 단일 `openKakaoPlace`/`Linking.openURL` 경계를 탐색 카드에도 연결했다. 링크 실패는 기존 카카오맵 오류 상태로만 알리고 선택 검증 상태를 바꾸지 않는다.
- `src/ui/recommendation/courseV1PlacePreviewModel.ts`: 직접 URL은 `verified` 상태의 `place.map.kakao.com` HTTPS URL일 때만 열고, `weak`·누락·비카카오 URL은 제목과 유효 좌표의 HTTPS 검색 링크로 폴백하도록 제한했다.
- `test/ui/course-v1-place-preview.test.ts`, `test/map-transport-ui-contract.test.mjs`: verified/weak/URL 불가/Linking 실패, CTA 조건부 렌더와 탐색 카드의 route 검증 경계 부재를 고정했다.

### 2. 유지한 계약·정책 경계

- 링크 탭은 장소 정보 외부 전환만 수행하며 route adapter·receipt·선택 검증·탐색 페이지네이션·대표 코스·선택 로딩을 호출하거나 승격하지 않는다.
- 탐색 후보 자격, `conditional` 제외, `area_access` 두 권역, 카탈로그와 Route Proxy는 수정하지 않았다. 실제 시간·도착 시각·`추천`·`검증됨` 표현도 탐색 카드에 추가하지 않았다.
- 보드는 수정하지 않았다.

### 3. 테스트 결과

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과.
- `npm test` 통과 (105 tests).
- `git diff --check` 통과.
- 고정 mock만 사용했으며 실제 카카오맵·route API·CAPTCHA·Supabase 호출은 0회다.

### 4. 다음 결정·위험·재현 조건

- 새 internal build에서 다대포 또는 암남공원/송도해안볼레길 탐색 카드의 `카카오맵에서 확인`을 1회 열고, 앱 복귀 뒤 대표·목록·선택 버튼 상태가 그대로인지 확인한다.
- 같은 카드에서 `선택해 확인`은 별도로 1회만 실행해 성공 스냅샷 또는 typed 실패 문구를 확인한다. 외부 카카오맵 전환만으로 경로 확인 문구·시간표가 나타나면 회귀다.

---

## 재개 지시 — iOS 카카오맵 외부 전환 fallback

### 재개 근거

실기기에서 탐색 카드의 `카카오맵에서 확인`이 `카카오맵을 열지 못했어요`로 실패했지만, 같은 다대포 Kakao Place URL은 Safari에서 정상적으로 열렸다. 따라서 카카오 장소 데이터·URL·추천·Route Proxy 문제가 아니라 앱의 `Linking.openURL` handoff 실패다. 현행은 이 한 번의 실패를 그대로 사용자 오류로 끝내므로, 안전한 웹 fallback을 추가한다.

### 구현 범위

1. `expo-web-browser`를 Expo 호환 버전으로 추가하고, UI 전용 카카오맵 opener를 만든다. 네이티브 의존성 추가이므로 새 internal build가 필요하다.
2. 첫 시도는 현재처럼 `Linking.openURL`로 외부 전환한다. 실패할 때만 **같은 장소의 안전한 Kakao 검색 HTTPS URL**을 `WebBrowser.openBrowserAsync`로 한 번 연다. 직접 상세 URL이 verified여도 fallback은 상세 URL 재시도가 아니라 제목·좌표 검색 URL이다.
3. 브라우저 시트도 실패하거나 URL을 만들 수 없을 때만 기존의 짧은 오류를 보인다. raw 예외·전체 URL·좌표를 사용자 화면, 로그, 진단 패널에 남기지 않는다.
4. 이 공통 opener를 Results 탐색 카드와 대표/코스 확인의 기존 장소 링크에 함께 적용한다. 링크 성공/브라우저 fallback은 대표 코스·탐색 목록·선택 로딩·route adapter·receipt·페이지네이션을 바꾸지 않는다.
5. `kakaomap://` 같은 앱 전용 scheme, `canOpenURL` whitelist, Kakao REST 호출, 카탈로그 URL/등급 수정은 이번 범위에 넣지 않는다. 앱 설치 여부에 따라 동작이 갈리는 새 경로를 만들지 않는다.

### 필수 테스트·수동 확인

- external 성공, external 실패→browser fallback 성공, 두 단계 실패, URL 없음의 typed 결과를 고정 mock으로 검증한다.
- fallback을 포함한 링크 탭은 route·receipt·선택 검증 0회이며, 선택 탭의 기존 한 곳 검증 호출 수는 변하지 않음을 검증한다.
- `npm run test:typecheck`, `npm run test:ui`, 관련 UI 테스트, `git diff --check`를 실행한다.
- 새 internal build에서 다대포 카드 링크를 한 번 누른다. 외부 전환 또는 브라우저 시트 중 하나로 장소가 열리고, 닫기/앱 복귀 뒤 탐색 목록·대표·선택 버튼이 보존돼야 한다. 같은 검증은 코스 확인의 장소 링크에서도 한 번 수행한다.

### 경계·인계

UIUX는 `src/ui/`, UI 테스트, 필요한 Expo 의존성·iOS 동기화 산출물만 수정한다. 엔진·데이터·Route Proxy·보드는 수정하지 않는다. 인계에는 실제 외부 전환과 browser fallback을 구별한 mock 결과, 새 internal build 필요 여부, 실기기 재현 결과를 남긴다.

## iOS 외부 전환 fallback 완료 인계 — 2026-08-31

### 1. 변경 파일·목적

- `src/ui/recommendation/courseV1PlacePreviewModel.ts`: 공통 `openKakaoPlaceWithBrowserFallback`을 추가했다. 외부 `Linking.openURL` 성공, 외부 실패 뒤 검색 URL의 시스템 브라우저 시트 성공, 두 단계 실패, URL 불가를 typed 결과로 분리한다.
- `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: 대표·탐색·코스 확인의 기존 장소 링크를 같은 fallback opener로 연결했다. browser fallback은 장소 정보 전환만 하며, 화면의 추천·선택 상태를 바꾸지 않는다.
- `test/ui/course-v1-place-preview.test.ts`, `test/map-transport-ui-contract.test.mjs`: 외부 성공, 외부 실패→검색 URL browser fallback 1회, 두 단계 실패, URL 불가와 두 화면의 공통 browser opener 연결을 고정했다.
- `package.json`, `package-lock.json`, `app.json`: Expo SDK 56 호환 `expo-web-browser`와 config plugin을 추가했다. 로컬 iOS Pods는 `pod install`로 `ExpoWebBrowser`를 동기화했다.

### 2. 유지한 계약·정책 경계

- fallback은 외부 handoff 실패 때만 안전한 HTTPS 카카오 **검색** URL을 browser sheet로 한 번 연다. verified Place URL을 browser에서 재시도하지 않으며, 앱 전용 scheme·`canOpenURL`·Kakao REST 호출을 추가하지 않았다.
- 링크·browser fallback은 route adapter·receipt·선택 검증·대표/탐색 목록·페이지네이션·완료 기록을 호출하거나 변경하지 않는다.
- 엔진·카탈로그·Route Proxy·보드와 카카오 장소 등급은 수정하지 않았다.

### 3. 테스트·동기화 결과

- `npm run test:typecheck` 통과.
- `npm run test:ui` 통과.
- `npm test` 통과 (105 tests).
- `git diff --check` 통과.
- `pod install` 통과: `ExpoWebBrowser (56.0.6)`가 iOS target에 연결됐다.
- 시뮬레이터 Debug 빌드는 `ExpoWebBrowser` 의존성을 포함해 시작됐고 산출물 생성까지 확인했다. 동일 DerivedData에서 중복 확인 빌드를 병렬로 실행한 1회는 build database lock으로 실패했으므로, 최종 internal build는 단일 빌드로 다시 실행해야 한다.
- 모든 자동 검증은 mock만 사용했으며 실제 카카오맵·route API·CAPTCHA·Supabase 호출은 0회다.

### 4. 다음 결정·위험·재현 조건

- **새 internal build가 필요하다.** 다대포 탐색 카드와 코스 확인의 장소 링크를 각각 1회 실행한다. 외부 전환이 거부된 기기에서는 시스템 browser sheet가 같은 장소의 카카오 검색을 한 번 열어야 한다.
- browser sheet 닫기 또는 앱 복귀 뒤 대표·탐색 목록·선택 버튼은 그대로여야 하며, 경로 확인 문구·시간표·추천 상태가 생기거나 route 호출이 발생하면 회귀다.
- 내부 빌드는 다른 Xcode/Expo build가 종료된 뒤 단일 DerivedData로 재실행해 database lock 없이 완료 여부를 확인한다.
