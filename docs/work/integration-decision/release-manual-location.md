# DEC-RELEASE-MANUAL-LOCATION-01 — 출시 수동 장소 선택 전환

결정일: 2026-09-09. 상태: 사용자 승인·명령 작성 완료·구현/QA 전.

## 결정과 이력

- 부모: 사용자의 GPS 미사용 출시 전환 결정. 사업자등록/위치 신고 일정 및 취업지원 영향으로 자동 측위 없는 제품 구조를 선택했다. 기술 전환 승인은 신고 면제·법적 적합성 또는 공개 출시 승인과 별개다.
- 관계: REC-13, UX-07/12/20/21/25 및 기존 위치 검색·주변 둘러보기의 GPS 부분과 **충돌·사용자 승인 교체**. 기록/개인화/Live Activity는 **동일·유지**.
- 이전: 허용된 GPS 자동 출발지, 현재위치 검색/지도 버튼, GPS 주변 탐색, legacy GPS 코스 재추천 → 관찰: 자동 측위·외부 좌표 전달이 출시 구조에 남음 → 교체: 수동 검색과 지도 핀 선택만으로 기준 장소 확정 → 이유: GPS 없는 출시 구조로 단순화 → 상태: 현행 결정·구현 전. 과거 GPS 기대값은 이력이며 복원하지 않는다.
- GPS/Wi-Fi/기지국/IP 위치 추정 등 자동 측위로 대체하지 않는다. 기존 수동 장소 좌표의 경로 API 전송은 유지한다. 서버가 해당 좌표를 사용자의 실제 현재 위치로 자동 판정하지 않는다.
- 코스 기록은 사용자 선택·명시 완료, 체류는 앱/Live Activity 도착·출발 버튼의 시간 차다. 방문 인증·자동 도착·위치 추적을 새로 넣지 않는다. 로그인, guest 승인 가져오기, 동의 기반 학습, 기록/탈퇴 삭제 정책은 유지한다.
- 최대180분/2곳, 실제 이동시간·운영시간 검증, 추천 순서, API 예산·private/public cache 구분은 불변. 수동 좌표라는 이유로 모든 경로를 public cache에 넣지 않는다.
- 기존 기록·표본을 삭제하거나 운영 migration/정리/C 테스트를 반복하지 않는다. 과거 GPS 출발지의 복원·재전송과 일반 방문 이력 보존을 구분한다.

## 실행 순서·소유 경계

1. **U-RELEASE-MANUAL-LOCATION-01 + API-RELEASE-MANUAL-LOCATION-01 + DB-RELEASE-MANUAL-LOCATION-CHECK-01 병렬**. UI는 UI와 앱/네이티브 설정 단일 작성자, API는 어댑터, DB는 repository 영향 확인을 담당한다. 공통 type 변경이 필요하면 제안만 인계하고 통합 뒤 단일 작성한다.
2. API/DB 인계 중 UI 관련 발견만 UI가 마감. 기존 좌표 출처 불명확한 진행 데이터는 무조건 삭제·GPS로 단정하지 말고 처리안을 통합 세션에 제시한다. 문제 없으면 새 작업을 만들지 않는다.
3. **DOCS-RELEASE-MANUAL-LOCATION-01**: 구현 근거 반영. 초안 준비는 1단계와 병렬 가능하나 사실 확정은 인계 후.
4. **QA-RELEASE-MANUAL-LOCATION-01**: 수정 동결 후 동일 후보 검사. 사전 fixture 작성만 병렬 가능. 최종 전체 테스트/빌드 단일 실행자 QA. 기능 작성자는 변경 전 실패 재현 및 집중 테스트를 수행한다.

추천 엔진·데이터 세션 신규 작업 없음. 기존 계약을 유지할 수 없다는 근거가 나올 때만 범위를 다시 판단한다. 중앙 기준 문서는 통합 세션만 수정하고 각 역할은 자기 인수인계 파일에 결과를 남긴다. 본 파일을 동시 편집하지 않는다.

## U-RELEASE-MANUAL-LOCATION-01 — UIUX 세션

```text
docs/work/integration-decision/release-manual-location.md의 U-RELEASE-MANUAL-LOCATION-01을 진행해.
기존 검색·지도 선택을 재사용해 출발지와 주변 둘러보기 기준점을 수동 확정하도록 전환해. GPS 자동 조회·현재위치 선택·지도 내 위치 버튼·위치 권한 항목과 요청을 제거하고, 검색 아래 지도에서 선택은 남은 공간에 자연스럽게 배치해. 별도 화면 재설계는 하지 마.
미선택이면 기준 장소 선택을 안내하고 추천 요청을 하지 마. 지도 초기 중심은 기존 선택 장소 또는 부산 기본 보기로 하고, 기본 보기 자체를 사용자의 선택으로 확정하지 마. 지도 카메라 복귀가 필요하면 선택 장소 기준으로만 동작하게 해.
ExecutionScreen의 GPS 재추천은 코드에 남아 있으므로 출시 도달 경로를 확인해. 현재 정상 흐름에 없는 기능을 새로 살리지 말고 GPS 실행 entry를 막아. 앱/웹/딥링크·이미 권한을 허용한 기기의 자동 조회도 확인해.
UI/AppGroup/local snapshot의 과거 GPS 좌표가 재전송되는 복원 경로를 확인하고 API/DB 세션에 인계해. 일반 방문 기록을 삭제하지 마. 출처 불명확한 기존 활성 코스의 강제 종료·초기화는 임의 결정하지 마.
app.json 및 네이티브 생성 설정에서 불필요한 위치 permission/plugin을 정리해. 의존 제거가 필요하면 package/lock은 UI 세션만 편집해. 다른 네이티브 설정·Live Activity는 보존해.
로그인·기록·동의 기반 개인화·앱/Live Activity 공유 진행·길찾기 클릭 시작은 유지해. 변경 전 재현 테스트, 변경 후 집중 테스트를 수행하고 최종 전체 게이트는 QA에 인계해.
결과는 docs/work/uiux/release-manual-location.md에 변경 파일·유지 계약·검증 결과·잔여 위험 네 항목으로 남겨. 운영 데이터 삭제·배포·스토어 작업은 하지 마.
```

## API-RELEASE-MANUAL-LOCATION-01 — API 세션

```text
docs/work/integration-decision/release-manual-location.md의 API-RELEASE-MANUAL-LOCATION-01을 진행해.
GPS 좌표의 역지오코딩·경로 요청·외부 길찾기 전달과 자동 위치 fallback이 남는지 어댑터 소유 범위에서 확인해. 수동 검색/지도 핀 좌표와 공개 장소 간 경로 계산은 유지하고 GPS 또는 IP 위치 추정으로 대체하지 마.
UI가 GPS 공급을 제거하면 어댑터 수정이 필요 없는 경우 변경0으로 마감해. 불필요한 새 origin type·서버 스키마·공통 추상화는 추가하지 마. 필요한 수정은 먼저 실패 fixture를 만든 뒤 최소 수정해.
수동 장소도 임의 좌표/개인 주소일 수 있으므로 기존 private 경로·인증·cache·호출량·실패 정책을 유지해. 목적지만 전달하는 주변 길찾기와 코스 구간 길찾기를 구분하고 클릭 기반 진행을 바꾸지 마.
GPS 유입 없는 고정 입력 요청/응답 fixture로 확인하고 실제 API 반복 호출·운영 배포는 하지 마. UI/네이티브 파일은 편집하지 말고 필요한 조치를 인계해.
docs/work/external-api/release-manual-location.md에 현재 전송 항목·GPS 유입 차단 경계·유지 계약·검증/잔여 위험을 남겨. 법적 신고 제외 확정으로 표현하지 마.
```

## DB-RELEASE-MANUAL-LOCATION-CHECK-01 — DB 세션

```text
docs/work/integration-decision/release-manual-location.md의 DB-RELEASE-MANUAL-LOCATION-CHECK-01을 진행해.
코드와 기존 근거·로컬 fixture만으로 완료 기록/guest 가져오기/체류 표본 payload가 GPS 측위가 아닌 선택 장소와 명시 버튼 기록으로 유지되는지 확인해. 기존 GPS 출발지가 legacy 저장 코스·outbox·복원·재계산에서 재전송될 수 있는 경로를 구분해 UI/API에 인계해.
기존 기록/표본 전체 삭제, 스키마 변경, 운영 SQL/배포, C 테스트 재실행은 하지 마. 출처 불명확한 좌표를 GPS로 단정하거나 새 필드를 요구하지 마. 변경이 필요 없으면 변경0·근거로 마감하고, 필요하면 영향과 최소 처리안을 인계해 승인 없이 데이터 의미를 바꾸지 마.
로그인 소유권·동의·180일 학습 유효 범위·완료 멱등·기존 삭제 정책을 유지해. 결과는 docs/work/db-personalization/release-manual-location.md에 변경 여부·유지 계약·fixture 결과·복원 위험으로 남겨.
```

## DOCS-RELEASE-MANUAL-LOCATION-01 — 출시 문서 세션

```text
docs/work/integration-decision/release-manual-location.md의 DOCS-RELEASE-MANUAL-LOCATION-01을 진행해.
UI/API/DB 결과를 받은 뒤 docs/05_release 범위의 처리방침·약관·지원·공개 HTML·App Privacy/심사 설명에서 GPS 수집·자동 현재위치·GPS 도착 인증 표현을 실제 수동 선택/버튼 기록 구조로 수정해. 준비 초안은 병렬 가능하나 구현되지 않은 사실을 완료로 쓰지 마.
좌표가 남는다는 이유로 무조건 GPS 정보라고 쓰거나, GPS 제거만으로 모든 위치 관련 App Privacy 항목을 아니오로 바꾸지 마. 일반 개인정보 고지·공급자 사실은 유지하고 실제 payload 기준으로 필요한 필드만 재판단해. 신고 면제/법적 적합성은 확정하지 마.
영향받는 스크린샷과 사용자가 수정할 Connect 문구만 짧게 인계해. 실제 게시·registry·Connect 변경은 하지 마. 정적 사이트 검사·diff 검사를 수행하고 docs/05_release/release-document-session.md에 네 항목 인수인계를 남겨. 중앙 기준 문서는 편집하지 마.
```

## QA-RELEASE-MANUAL-LOCATION-01 — QA 세션

```text
docs/work/integration-decision/release-manual-location.md의 QA-RELEASE-MANUAL-LOCATION-01을 UI/API/DB 수정 동결 후 진행해.
신규 설치·위치 권한 이미 허용/거절·로그인/guest·과거 활성 코스 fixture에서 GPS API 호출과 위치 권한 요청0을 확인해. WebView/딥링크/legacy 화면을 포함하고 코드 문자열 검색만으로 통과시키지 마.
수동 검색·지도 선택·취소/재선택·출발/목적 분리·기준점 없는 주변 화면·가까운 순 정렬·1/2곳 코스·앱/웹 길찾기·앱/Live Activity 도착/출발/완료를 확인해. 기록 저장·동의 개인화·guest 가져오기 회귀와 과거 GPS 좌표 자동 재전송0을 fixture로 검사해.
npm run test:typecheck, npm run test:ui, npm test와 동일 출시 입력 iOS 빌드/권한 설정 검사를 실행해. 최종 iPhone 실기기에서 위치 팝업 없음·지도 선택·외부 길찾기·Live Activity를 확인하거나 사용자 확인 대기로 정확히 분리해.
docs/work/qa-release/release-manual-location.md에 후보 식별·테스트/로그·미검증·판정을 남겨. 운영 데이터 조작·배포·업로드·심사 제출은 하지 마. 기술 PASS를 신고 면제 확인으로 바꾸지 마.
```

## 완료 체크

- [x] 사용자 결정·과거 충돌 규칙·역할 명령 작성
- [ ] UI/네이티브 GPS 자동 조회·권한·entry 제거
- [ ] API 수동 장소 계산 유지·GPS 파생 유입 경계 확인
- [ ] DB 일반 기록 보존·과거 GPS 복원 경로 확인
- [ ] 필요한 과거 진행 데이터 처리안 합의 또는 영향 없음 근거
- [ ] 공개 문안·Connect 변경 인계 준비
- [ ] 자동 게이트·동일 후보 빌드·실기기 확인

통합 세션 인수인계: 중앙5문서와 본 명령 파일만 변경. 기능/DB/엔진/데이터/운영 계약 미변경. 문서 diff 검사만 수행하며 제품 테스트는 미실행. 다음은 역할별 구현·검증이며 기존 작업을 완료로 추정하지 않는다.
