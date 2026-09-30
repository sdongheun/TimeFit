# U-LIVE-NEARBY-CONNECT-03 — 주변 둘러보기 별도 live 읽기 연결

2026-09-22. 상태: **기본 OFF UI 연결·고정 fixture 완료 / 실제 원천·실기기·운영 활성화 전**.

## 이전 방식 → 관찰 → 교체 방식 → 이유

- 이전 방식: 주변 둘러보기는 앱 번들의 369곳을 수동 기준 장소 중심 3km로 필터링했다. 추천의 sealed 세션은 주변 탭과 공유하지 않았다.
- 관찰: 앱 업데이트 전까지 오래된 장소 사실이 남고, 추천 세션을 재사용하면 주변 정보 탐색에 추천의 시간/운영시간 게이트를 잘못 적용할 수 있다. 지도 pan·기준점 재선택마다 새 조회하면 공급자 비용·지연이 불필요하게 늘어난다.
- 교체 방식: `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED === 'true'`에서 첫 수동 기준 장소 선택 뒤에만 승인된 production facade를 생성해 초기 snapshot 1회와 별도 `projectLiveNearbyReadModel`을 사용한다. 화면이 mounted인 동안 후보 배열을 메모리로 유지하고 재선택은 기존 3km 순수 계산만 다시 한다. 실패는 정적 성공으로 대체하지 않고 명시적인 재시도만 제공한다. 부분 실패는 확인된 후보만 표시한다.
- 이유: 추천 엔진·Route Proxy 예산과 분리된 정보 탐색 수명을 만들고, 원천 최신성·호출량·개인정보 경계를 지키기 위해서다.
- 상태: **구현·자동 검증**. flag 기본 OFF, 실제 Edge/API/실기기 미검증.

## 변경 파일·목적

- `src/ui/nearbyLiveSession.ts`: 별도 facade 1회 수명, token-free read model→기존 주변 목록 형태 변환, 메모리 snapshot 재사용, 실패 시에만 명시 retry, unmount cancel/close.
- `src/ui/NearbyBrowseScreen.tsx`: 첫 기준점 선택 후 로드, 같은 dataset으로 3km 지도·목록·상세 표시. loading·부분 확인·전체 실패 재시도 UX. 지도 pan·기준점 재선택에서는 원천 호출하지 않는다.
- `test/ui/live-nearby-session.test.ts`, `test/ui/nearby-browse-screen.test.mjs`: RED 모듈 부재부터 시작해 controller 호출1, detail0, 부분/전체 장애, 사진 승인/URL 불일치, no-session 원천0, 취소/늦은 응답, 실제 화면 ON/OFF·재선택을 검증한다.

## 유지한 계약

- flag 미설정/`true` 외 값은 OFF이며 기존 주변 화면/369곳 번들 목록이 유지된다. ON에서 최대 251개 live-mapped 장소만 후보가 될 수 있고 원천 범위 밖 118곳은 정적으로 되살리지 않는다. 이는 fixture 상한이지 실제 주변 장소 수가 아니다.
- 추천 세션·엔진·Route Proxy·상세 배치·개인화·저장/방문 기록은 건드리지 않았다. 사용자 수동 기준점 좌표는 화면의 3km 계산에만 쓰고 TourAPI/부산 초기 요청에 전달하지 않는다. 앱이 이미 가진 Supabase 세션만 사용하며 로그인·익명 세션·CAPTCHA를 새로 만들지 않는다. 현재 세션이 없으면 원천 요청 전 안전 실패한다.
- browse read model은 운영시간이 없어 현재 영업을 주장하지 않는다. 화면은 `운영시간 확인 필요`를 표시한다. 사진은 exact 승인 증거와 URL이 일치할 때만 표시하고 그렇지 않으면 기본 이미지다.
- 탭을 새로 열면 새 화면 세션이다. 자동 백그라운드 새로고침/지도 pan 조회는 없고, 화면 이탈 시 facade를 취소·닫아 메모리 후보를 폐기한다.

## 검증 결과·다음 결정·위험

- 실패 선행: `nearbyLiveSession` 모듈 부재로 신규 fixture RED 확인.
- 고정 fixture: controller 5/5, 주변 실제 화면 fixture 32/32 PASS (동시 QA 추가 사례 포함). `npm run test:typecheck` PASS, `npm run test:ui` 848 PASS / 기존 1 SKIP / 0 FAIL (총 849), `npm test` 596/596 PASS. `git diff --check` PASS. UI 명령의 샌드박스 로컬 IPC `EPERM`은 허용된 테스트 실행 환경에서 동일 명령 재실행으로 검증했다.
- `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED=false npx expo export --platform ios --output-dir /private/tmp/timefit-live-nearby.nqlWKw` PASS. Hermes bundle `index-6f1a87f88489eb13b049d09f92321089.hbc` SHA-256 `63ca7b84fef4a1dace0fa0c186b0fbe56b75302fca052b5aeb1ed9efd57ba54c`.
- 실제 API·Simulator·실기기·운영 flag ON·배포·commit/push는 실행하지 않았다.
- **출시 결정 게이트:** production facade는 기존 Supabase `auth.getSession()`의 유효 access token을 요구한다. 기존 주변 둘러보기는 비로그인에서도 동작하므로, 처음 진입하는 guest에 세션이 없으면 flag ON에서는 원천 호출 0회로 실패 안내가 나온다. 이를 로그인 필수 정책으로 조용히 바꾸거나 UI에서 익명 로그인/CAPTCHA를 자동 생성하지 않았다. 비로그인 지원·공개 설정 활성화 여부는 통합 결정이 필요하다.
- 실기기에서 첫 수동 기준점→loading→ready/partial/failed, 위치 재선택·지도 pan의 추가 호출0, 장소 사진/출처·지도 마커·상세 길찾기, 탭 이탈 취소와 재진입 새 세션, 비로그인 기존 익명 세션/세션 부재를 확인해야 한다. 공급자 500행·최대 2페이지×3원천 허용과 실제 3km 분포/지연은 API·QA 제한 호출 전 미확인이다.

## U-LIVE-NEARBY-GUEST-AUTH-04 — 비로그인 첫 진입 안전 확인 (2026-09-22)

상태: **UIUX 자동 검증 완료 / 실제 API·실기기·flag 활성화 전**. 위 03 단계의 `세션 부재 시 실패, 익명 Auth 생성 없음`은 그 단계의 안전 경계였으며, 이번 명시 결정으로 아래 ON 경로에서만 교체한다. OFF의 번들 탐색은 그대로다.

### 이전 방식 → 관찰 → 교체 방식 → 이유

- 이전 방식: ON의 facade는 기존 Supabase 세션만 소비했고, 세션 없는 비로그인 첫 진입은 원천 호출 0회로 실패했다.
- 관찰: 주변 둘러보기의 비로그인 이용 계약과 충돌했다. 자동 익명 로그인은 CAPTCHA 승인 없이 세션을 만들 위험이 있었다.
- 교체 방식: 수동 기준 장소를 처음 선택하면 기존 세션을 조회한다. 유효 세션은 바로 live snapshot 1회로 진행하고, 세션이 없을 때만 기존 `CaptchaVerificationSheet`에서 사용자의 명시적 확인을 받는다. 성공 토큰은 기존 Route Proxy auth port의 `signInAnonymously({ options: { captchaToken } })`에 그 시도에서 한 번만 전달한 뒤 폐기한다. 취소·토큰 누락·인증 오류·잘못된 challenge 설정은 공급자 호출 0회와 안전한 재시도 안내로 끝난다.
- 이유: 비로그인 탐색을 유지하면서 로그인/개인화로 간주하지 않고, 무인증 원천 접근이나 토큰 재사용을 허용하지 않기 위해서다. 상태: **현행 ON 경로·자동 검증 완료**.

### 1. 변경 파일과 목적

- `src/ui/nearbyGuestAuthGate.ts`: 기존 Route Proxy Supabase auth port를 첫 수동 기준점 이후 지연 로드한다. 세션 확인·일회용 CAPTCHA 토큰 소비·취소/지연 응답 무효화를 화면 밖 순수 경계로 분리했다.
- `src/ui/NearbyBrowseScreen.tsx`, `src/ui/CaptchaVerificationSheet.tsx`: ON에서만 gate와 기존 확인 시트를 연결한다. 준비→인증→원천 로드를 순서대로 실행하고 연타·중복 callback·이탈을 막는다. 기존 세션은 시트 없이 통과한다.
- `test/ui/live-nearby-guest-auth.test.ts`, `test/ui/nearby-browse-screen.test.mjs`: 세션 있음/없음, 인증 성공·취소·실패·중복·늦은 응답, 설정 누락, OFF 원천/인증0을 고정 fixture로 검증한다. 화면 실패 선행에서 세션 부재인데도 `live-load`가 1회 실행되는 결함을 확인했다.

### 2. 유지한 공개 계약·정책 경계

- flag는 여전히 정확히 `true`일 때만 ON이다. OFF의 정적 주변 목록·지도·상세/길찾기, ON의 facade 1회 수명·3km 화면 내 계산·명시적 provider retry는 유지했다.
- 익명 Auth는 Route Proxy 접근용이다. 일반 계정 로그인, 비로그인 기록 가져오기, 체류 동의·개인화·저장·추천 엔진·DB 정책은 변경하지 않았다. CAPTCHA token은 state/로그/파일에 저장하지 않고 화면에서 auth port로만 전달한다.
- 사용자 수동 기준점 좌표는 TourAPI/부산 초기 원천 요청에 추가하지 않았다. 취소·인증 실패를 정적 카탈로그의 가짜 성공으로 대체하지 않는다.

### 3. 실행 테스트와 결과

- RED: 화면 fixture 2건에서 세션 부재에도 provider가 먼저 호출되고 CAPTCHA 시트가 없음을 확인한 뒤 구현했다.
- 집중 `node --import tsx --test test/ui/nearby-browse-screen.test.mjs test/ui/live-nearby-guest-auth.test.ts`: **41/41 PASS**.
- `npm run test:typecheck`: **PASS**. `npm run test:ui`: **858 PASS / 기존 1 skip / 실패 0**. `npm test`: 최초 안전성 가드 문자열 검사 2건 실패(직접 실패 1건 + 전체 발견 경계 1건) 후 명시적 ON·기준점 가드를 복원해 **599/599 PASS**. QA 소유 검사 파일은 변경하지 않았다.
- `EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED=false npx expo export --platform ios --output-dir /private/tmp/timefit-live-nearby-guest-auth-20260922`: **PASS**. 실제 API·Simulator·실기기·배포·flag 전환은 하지 않았다.

### 4. 다음 결정·위험·재현 조건

- 실기기 제한 확인: 비로그인·기존 익명 세션·일반 계정 각각 수동 기준점 선택→CAPTCHA 표시 여부→한 번의 live 조회, 취소/만료/네트워크 실패→원천0·명시 재시도, 탭 이탈/재진입, 지도 pan·기준점 재선택 추가 원천0을 확인한다.
- CAPTCHA 운영 challenge URL과 Supabase 익명 가입 제한·보안 설정, 실제 provider 500행/페이지 예산은 UI fixture로 확인할 수 없다. 통합/API/QA가 제한 호출로 확인하기 전 ON 활성화·출시 수락을 하지 않는다.

## U-LIVE-MARKET-NEARBY-UI-06 — 전통시장 정적 정보 구분 표시 (2026-09-23)

상태: **UIUX 고정 fixture·자동 검증 완료 / 실제 API·실기기·운영 ON 전**. 근거는 `DEC-LIVE-MARKET-01`과 `docs/work/data-curation/live-traditional-market-nearby-06.md`다.

### 이전 방식 → 관찰 → 교체 방식 → 이유

- 이전: DATA read model이 live ON 주변에 분리 결합한 정적 전통시장 118곳의 `sourceKind=traditional_market_standard_static`을 UI adapter가 버렸다. 카드·상세는 일반 live 장소와 똑같이 보였고 두 live 원천이 모두 실패한 `partial`도 단순히 “일부 장소만 확인”이라고 했다.
- 관찰: 저장 자료만 남은 상황을 live 원천 일부가 확인된 것처럼 오해할 수 있고, 시장 이용자가 운영시간 미확인과 출처를 알기 어려웠다.
- 교체: adapter가 정적 시장의 `sourceKind`와 `operatingHoursStatus=unverified`를 보존하고 사진은 부착하지 않는다. 좁은 목록 카드에는 “전통시장 자료 · 운영시간 미확인”, 상세에는 “전국전통시장표준데이터 저장 정보 · 운영시간 확인 필요”와 길찾기 전 영업·출입 확인 안내를 둔다. `partial`의 후보가 모두 정적 시장이면 실시간 장소를 확인하지 못했다는 별도 안내를 표시한다.
- 이유: 정보 탐색·길찾기 접근성은 유지하되 정적 원천을 live 사실이나 현재 영업으로 가장하지 않기 위해서다. 상태: **현행 UI 구현·자동 검증 완료**.

### 1. 변경 파일과 목적

- `src/ui/nearbyBrowseModel.ts`: 주변 화면 전용 catalog가 원천 종류·운영시간 미확인 상태를 받을 수 있도록 타입만 확장했다.
- `src/ui/nearbyLiveSession.ts`: DATA의 후보 출처를 UI로 전달하고, 유효한 facade snapshot의 부분 결과가 정적 시장만 담았는지를 표시한다. 정적 시장에 잘못 붙은 사진 속성은 adapter에서 사용하지 않는다.
- `src/ui/NearbyBrowseScreen.tsx`: 시장 카드·상세의 단계별 출처/확인 안내와 static-only 부분 실패 문구. 기존 목록 선택→상세→카카오 길찾기 경로는 그대로 사용한다.
- `test/ui/live-nearby-session.test.ts`, `test/ui/nearby-browse-screen.test.mjs`: sourceKind 전달, 운영시간/사진 fallback, static-only와 mixed partial, 시장 카드·상세·길찾기 화면 실행을 고정했다. 수정 전 adapter 출처 누락과 일반 부분 실패 문구의 RED 2건을 확인했다.

### 2. 유지한 계약

- DATA의 118곳 정적 스냅샷과 exact live 251곳의 구분을 재해석하지 않았다. 스냅샷 mismatch·facade 실패는 기존처럼 전체 실패로 닫고, 시장만으로 성공을 꾸미지 않는다. ON의 화면 내 3km 계산, OFF의 번들 주변 화면은 유지했다.
- 시장은 주변 정보 탐색 및 길찾기만 가능하다. 코스 추천·체류·완료 기록·개인화·카카오 목적지 이름/좌표 payload·외부 API/DB/엔진 정책을 바꾸지 않았다. 운영시간을 10~18시나 현재 영업으로 합성하지 않는다.
- 사진 없는 시장은 기본 이미지다. 실제 live 사진 승인·URL exact 계약, 다른 장소의 부분 실패 표시와 선택/지도 동작은 유지했다.

### 3. 테스트 결과

- 집중 `node --import tsx --test test/ui/live-nearby-session.test.ts test/ui/nearby-browse-screen.test.mjs`: **42/42 PASS**. `npm run test:typecheck`: **PASS**. `npm run test:ui`: **863 PASS / 기존 skip 1 / 실패 0**. `npm test`: **603/603 PASS**.
- 공개 iOS 번들 export: flag OFF `/private/tmp/timefit-live-market-nearby-ui-20260923`, flag ON `/private/tmp/timefit-live-market-nearby-ui-on-20260923` 모두 PASS. 각각 실제 Hermes bundle SHA-256은 `24ffb5edc46186edcd1f8788b62564be45c328d49598532599fd4e54930b1c5a`, `cf9d1aa35c978eeba9859c0d17a2c18ab26b0007512d093ec02a20322cdf8ed6`다. 실제 API·Simulator·실기기·운영 flag 전환은 실행하지 않았다.

### 4. 다음 확인·위험

- 실기기에서 live ON 수동 기준점 근처 시장의 목록→상세→카카오 길찾기, 기본 이미지, 출처·운영시간 미확인·영업/출입 확인 문구, 화면을 떠난 뒤 재진입을 확인한다. 두 live 원천 장애에서 시장만 남는 경우와 한 원천만 장애인 mixed partial의 안내도 제한 fixture/실기기에서 구분한다.
- 전통시장 정적 정보는 현재 영업·입장·주소 정확도를 보증하지 않는다. source 갱신 주기·실제 접근성은 DATA/통합 결정에 남아 있다. UI 구현만으로 ON 출시나 실시간 운영시간 확인을 수락하지 않는다.
