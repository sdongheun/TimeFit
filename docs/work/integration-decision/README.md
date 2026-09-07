# 통합·결정 현재 작업

## 2026-09-07 최신 작업

[출시 개인화 Wave](release-personalization-wave.md): 2026-09-07 회원 혜택 구분 확정. DB A/UI A/API/데이터/2-AB 검증 병렬 → DB 저장 → UI 통합 → QA. 현재 상세 명령은 각 역할 README의 최신 링크를 따른다.

## 현재 역할

- 단일 작성자: `docs/작업조정_보드.md`
- 기준 문서의 충돌·수락·다음 작업 순서만 결정한다.
- 제품 코드·원본 데이터·역할 소유 구현 파일은 수정하지 않는다.

## 현재 게이트

- [DEC-RELEASE-PERSONALIZATION-01](release-personalization-account.md)(2026-09-07, 사용자 확정·구현 전): 출시 전 제한적 체류 개인화, 계정 기록 격리, 승인 기반 guest 방문 기록 가져오기와 과거 guest 체류 학습 제외. 나이 수집 제거·권리 미확인 사진 대체. 기존 출시 후 보류보다 우선한다.

- [출시 UIUX 통합 체크리스트](release-uiux-checklist.md)(2026-09-05, 현행): 사용자가 확정하거나 검토를 요청한 전체 UIUX를 시간 흐름대로 관리한다. 구현 세션은 직접 체크하지 않고 통합 세션이 코드·자동 회귀·필요한 수동 관찰을 검토한 뒤에만 완료 표시한다.

- [DEC-PLACE-COURSE-FLOW-01](place-detail-and-optimized-course-flow.md)(2026-09-05, 제품 흐름·완료 UI 시나리오 최종 승인·구현 작업 활성화): 추천 카드 tap은 전체 지도형 장소 상세를 열고 명시 선택만 같은 Results의 A/B 상태를 바꾼다. 2곳 방문 순서는 exact route 최적화 결과를 따르며 코스 검토와 진행은 동일 화면 상태로 통합한다. `DATA-PLACE-DETAIL-01`과 `U-PLACE-COURSE-FLOW-01`을 병렬로 시작하고, `QA-PLACE-COURSE-FLOW-01` 최종 판정은 UIUX 완료 뒤 실행한다.

- [WAVE-FOUNDATION-01](parallel-foundation-wave.md)(2026-09-05, 자동 게이트 통과·수동 1건 이관): `DB-COMPLETION-RECORD-01`, `2-AB`, `U-RELEASE-VISUAL-01`의 자동 게이트와 사용자 시각 2건은 통과했다. 당시 발견한 V1 Home active 미연결은 `U-PROGRESS-RESUME-01`에서 구현됐고 `QA-PROGRESS-RESUME-01` 비로그인 실기기 확인이 남았다.

- [U-PROGRESS-RESUME-01](../uiux/active-verified-course-resume.md)(2026-09-05, 수락): 비로그인·로그인 모두 같은 프로세스에서 V1 활성 코스와 마지막 확정 단계를 AppFlow로 이어 Home에서 재진입하며, 자동 회귀와 `QA-PROGRESS-RESUME-01` 비로그인 실기기를 통과했다. 추천/API/DB/영속 storage는 건드리지 않았다. 강제 종료·재부팅 복구와 안정적인 `courseRunId`는 U-LIVE-ACTIVITY-01의 App Group 범위이며, 다른 활성 코스의 silent replace와 익명 Auth 계정 오표시는 별도 후속이다.

- [U-RUNTIME-GUARD-01](../uiux/runtime-course-auth-guard.md)(2026-09-05, 실행 대기): 다른 active가 있는 최종 시작에서 취소·기존 이어가기·새 시작을 명시 선택하고, Route Proxy anonymous raw session은 유지하면서 사용자 account/Profile/saved course/personalization과 분리한다. 같은 UI 상태 파일을 소유하므로 다른 UIUX와 병렬 실행하지 않으며 후속은 `QA-RUNTIME-GUARD-01`이다.

- [U-COMPLETION-HISTORY-01](../uiux/course-completion-history.md)(2026-09-05, QA-RUNTIME-GUARD 뒤 대기): 선택 기능인 Live Activity 때문에 필수 완료 기록이 지연되지 않게 runtime `courseRunId`, 명시 finish repository 호출, 이번 달 device-local 기록과 미측정 표시를 먼저 연결한다. App Group/ActivityKit/알림·서버 동기화는 포함하지 않는다.

- [DEC-COMPLETION-RECORD-01](course-completion-record.md)(2026-09-04, repository 구현 완료·UI 대기): 진행 화면의 명시 `코스 마치기`가 후기 없이도 로컬 완료 기록을 한 번 생성한다. 선택·코스 보기·길찾기 실행은 완료가 아니며, 미확인 실제 체류는 `null`로 두어 장소/카테고리에는 포함하되 활동 시간과 개인화 표본에서는 제외한다. DB repository는 구현됐고 다음은 `U-COMPLETION-HISTORY-01`의 기본 UI 연결이다.

- [DEC-LIVE-DWELL-01](live-activity-dwell-personalization.md)(2026-09-04, 제품 정책 확정·구현 전): iOS 17 Live Activity는 길찾기 성공 뒤 로컬 진행을 시작하고, 예상 이동 `moveMin`에 20%·3~10분 유예를 둔 사용자 확인만 체류 표본으로 인정한다. GPS/background location과 원격 ActivityKit push는 이번 출시에서 제외한다. 일반 로그인+별도 동의+완료 표본만 같은 `category + subCategory`에 최근 최대 5개 중앙값으로 적용한다. 필수 완료 기록은 `U-RUNTIME-GUARD-01 → QA-RUNTIME-GUARD-01 → U-COMPLETION-HISTORY-01`로 먼저 연결하고, 이후 `DB-DWELL-01`·`2-AB` 공개 계약과 UI writer 종료 뒤 `U-LIVE-ACTIVITY-01 → QA-LIVE-ACTIVITY-01` 순서다.

- [DEC-TWO-STOP-SELECTION-01](two-stop-limited-assembly.md)(2026-09-04, 자동 통합 수락·실기기 체감만 남음): 같은 session/input의 exact pair 0-call seed와 production runtime 역선택 연결을 완료했다. provider/store terminal partial 비저장과 attempt-limit exact partial 유지가 하나의 predicate로 고정됐고, B 카드는 A+B 전체 88분 대신 A one-stop 대비 `함께 가면 약 37분 추가`를 표시한다. `QA-TWO-STOP-02` 고정 fixture 게이트도 통과했으며 작은 iPhone 체감은 출시 후보 smoke에 합친다.

- [DEC-ONE-STOP-MORE-01](release-one-stop-more-results.md)(2026-09-02, 현행): 출시 one-stop 첫 결과는 신규 provider attempt 최대 8회·대표 1+첫 대안 최대 3개를 유지한다. 미검증 single 후보가 남을 때만 `다른 장소 더 보기`를 표시하고, tap마다 다음 후보를 신규 attempt 최대 8회로 검증해 새 one-stop 최대 3개를 기존 목록 뒤에 누적한다. 자동 16회·자동 연속 page·2/3곳 queue는 금지한다. 기존 `API-PAGE-01` 계약을 재사용한 `2-V → U-ONE-MORE-01 → QA-ONE-MORE-01`은 모두 수락됐으며, 네이티브 화면 확인은 출시 후보의 최종 수동 smoke에서 한 번만 수행한다.
- [DEC-COURSE-GEOMETRY-01](course-confirm-route-geometry.md)(2026-09-03, 현행·보완 구현 대기): API-02에서 14개 transit route 모두 endpoint WALKING이 없음을 확인했다. 추천 중 선조회는 금지하고 사용자가 코스 카드를 눌러 상세를 열 때만, transit geometry와 실제 endpoint의 50m 초과 gap을 private Kakao walk로 최대 4개 보충한다. 추천 시간·순위는 불변이고 private 좌표는 비영속이다. 순서는 `API-ROUTE-GEOMETRY-03 → U-COURSE-GEOMETRY-02 → QA-COURSE-GEOMETRY-02`다.
- [DEC-RELEASE-MULTISTOP-01](release-multistop-timebox.md)(2026-09-03, 제한적 재개로 부분 교체): 당시 mixed 2·3곳 자동 복구는 중단했고 그 판단은 유지한다. 이후 사용자가 별도 pair-only 최대 2곳 제한 조립을 선택해 `DEC-TWO-STOP-SELECTION-01`로 구현을 재개했다. 3곳·mixed queue·자유 장바구니는 계속 보류하고 production one-stop은 새 자동 게이트 전까지 불변이다.

- `DEC-RESULTS-02`(2026-08-31): 2-P의 무경로 장소 탐색 목록은 검증 대안을 대체하지 못하므로 결과 역할을 철회한다. 첫 결과는 대표 1개 + 검증 대안 최대 3개를 목표로 하며, 첫 8회 뒤 4개 미만이고 후보 큐가 남을 때만 최대 16회까지 보충한다. `다른 검증 코스 더 보기`는 같은 cursor의 새 후보만 최대 8회 검증해 최대 3개를 append하며 총 결과 수를 자르지 않는다. 시장·거리·골목은 `conditional_visit`으로 분리해 10:00–18:00 탐색 노출·카카오맵 확인·명시 수동 계산만 허용하고, 자동 추천/검증 상태로 승격하지 않는다. 상태: 구현 전.

- `DEC-CONDITIONAL-CLOCK-02`와 `DEC-KAKAO-FALLBACK-02`(2026-08-31): QA-RESULTS-01 실기기에서 추천 시작 17:59의 조건부 시장이 실제 18:00 뒤에도 남고, 미검증 Kakao fallback이 `장소명+좌표` 검색으로 실패한 것을 확인했다. 조건부 영역은 실제 기기 시각 10:00–18:00에서만 보이고 18:00 경계/foreground 복귀에는 기존 카드도 숨긴다. 개발 추천 시각은 이를 연장하지 않는다. 장소 확인은 verified URL/ID → 상세 `addr1` 주소 검색 → 주소가 없거나 넓을 때 좌표 지도 보기 순으로 바꾸며 이름+좌표 검색은 철회한다. 상태: `U-RESULTS-04` 구현 대기.

- `DEC-COURSE-STORAGE-01`(2026-08-31): 비로그인 추천은 유지하되, V1 검증 코스 저장은 이메일 인증을 마친 일반 로그인 사용자에게만 허용한다. 익명 Auth는 Route Proxy authorization 전용이며 profile·코스·좌표·이력에 연결하지 않는다. 이전 legacy 자유 장바구니/guest local 성공 반환은 검증 스냅샷 저장에 재사용하지 않는다. 저장은 실제 경로 검증 결과의 1~3 stop·선택 체류·실제 legs·여유·버전 스냅샷을 원자적으로 보존한다. 조건부 수동 코스·진행 중 편집·후기·개인화는 구현 전이다. 상태: `DB-1` 구현 예정.

- `DEC-PROGRESS-FIRST-01`(2026-08-31, 선행 순서 달성): 검증 V1 진행·카카오 길찾기와 장소 공급량을 Live Activity보다 먼저 확인한다는 우선순위였다. `U-PROGRESS-01`, 공급량·one-stop/pair-only 게이트와 route geometry 확인이 끝났으므로 이 순서 제한은 달성됐다. GPS 자동 수집은 계속 철회하며, 다음 사용자 확인 체류 작업은 `DEC-LIVE-DWELL-01`이 대체 기준이다.

- [DEC-KAKAO-ROUTE-01](kakao-route-handoff-contract.md)(2026-08-31, 2026-09-01 수락): 실기기 실패를 확인한 결과 iOS scheme whitelist가 아니라 공유 route URL이 출발지 `sp` 없이 목적지 `ep`만 전달하고, HTTPS fallback도 길찾기가 아닌 목적지 보기였음이 확인됐다. V1과 legacy는 검증 snapshot의 구간 출발·도착을 함께 사용해 공식 app route scheme 및 web route link로 교체했다. 구간 fixture 14개·지도 계약 14개·타입 검사와 새 internal build의 출발·도착 route 화면을 통과했다.

- `2-N`, `U-1-REC-02`, `API-4-F`는 수락됐다. API-4-F의 0개 코스는 receipt 전송 문제가 아니라 `route_not_verified`/`time_budget_exceeded` 관찰로 분리했다.
- `DEC-DWELL-01`(2026-08-30): 최소 20분은 실제 추천 통과 조건, 권장 30분은 대표·대안 우선순위와 `추천/짧게 가능` 상태다. 최대 60/120분은 자동 시간 채우기 값이 아니다.
- `2-O`는 수락됐다. 최소 20분 short·혼합 체류·max fail-closed에 더해, 최소 운영시간 불가 시 downstream receipt 0회, 동률에서 권장 우선, legacy 운영/예산 사유 보존을 고정 fixture로 확인했다.
- `DATA-DWELL-01`을 수락했다. 대표 190개 후보의 `minStayMin`·`recommendedStayMin`·`maxStayMin`이 카탈로그 원본값 그대로 runtime provider까지 전달돼 2-O의 누락 max fail-closed 조건이 해제됐다. 다음 필수는 `U-1-DWELL-01`이고, 수락 뒤 `QA-DWELL-01`로 간다.
- `U-1-DWELL-01`을 수락했다. 결과·대안·코스 확인은 engine snapshot의 선택 체류와 `recommended/short` 상태만 표시하고, 최대 60/120분·범위·조절 행동을 만들지 않는다. 다음 필수는 `QA-DWELL-01`이다.
- `QA-DWELL-01`을 수락했다. 고정 fixture에서 50분 short, 권장/short 동시 반환, 운영시간 경계, 60/120 비자동 확장과 호출 상한·snapshot UI 경계를 통과했다. 다음은 새 internal build의 `RD-B12` 두 입력과 `RD-06` 서면 왕복 50분을 각 1회 확인하는 실기기 단계다.
- 모든 체류 전환이 수락된 새 internal build에서만 `RD-B12`를 실행한다. B12/A8의 attempt 상한·tier 순서는 이 체류 전환에서 변경하지 않는다.
- `RD-B12`와 `RD-06`을 수락했다. B12는 두 입력에서 policy label과 N2 시도를 확인했지만 실제 provider·cache 재사용이 섞인 internal 관찰이므로 A8 production 상한·tier 순서는 유지한다. RD-06은 50분 예산에서 20분 short 1곳·48분 시간표·남는 시간 2분을 실기기에서 확인했다.
- `DEC-EXPLORE-01`(2026-08-31, **결과 역할 철회**): 대표 1개와 무경로 고유 장소 탐색 목록을 이중화했던 결정이다. DATA-AREA-01의 권역 근거 감사·카카오맵 fallback 결과는 유지하지만, 사용자에게 대체 코스로 읽히는 결과 구조는 `DEC-RESULTS-02`로 교체했다.
- `DATA-AREA-01`을 수락했다. 보존된 공식 근거 기준으로는 대표 190·공개 야외 `area_access` 2·조건부 176이다. 시장·거리의 점포별 상이 정보는 자동 접근 근거로 승격하지 않았다. 다음 구현은 2-P이며, 이후 데이터 수를 늘릴 필요가 생겨도 실제 사용성·공급량 진단을 보고 별도 데이터 작업으로 결정한다.
- DATA-AREA-01의 `placeKind` 공개 투영 보완과 2-P를 수락했다. 실제 `area_access` 두 곳은 `area`로 provider→engine gate를 통과하고 시설형은 계속 차단된다.
- U-EXPLORE-01을 수락했다. 대표 실제 코스와 탐색 장소 목록을 화면에서 분리했고, 목록/더 보기는 route 0회이며 탭한 한 장소만 독립 실제 경로 검증한다. 탐색 카드가 실제 시간표나 검증 완료처럼 보이지 않고, `area_access`에만 20분 탐색 문구를 보이는 것을 UI 계약·타입 검사에서 확인했다. 다음 작업은 QA-EXPLORE-01의 고정 fixture·실기기 게이트다.
- QA-EXPLORE-01의 서면 실기기 관찰에서 탐색 카드의 카카오맵 외부 전환이 빠진 것을 확인했다. `카카오맵에서 확인`은 대표 코스 전용으로 축소하지 않고, 탐색 카드의 장소 맥락 확인 행동으로 추가한다. 단, 이 행동은 route·receipt·선택 검증을 호출하지 않으며 verified 상세 URL만 직접 열고 그 밖에는 제목·좌표 검색으로 한정한다. U-EXPLORE-01 링크 보완과 새 internal build 수락 뒤 QA를 재개한다.
- U-EXPLORE-01 링크 보완을 수락했다. 탐색 카드의 외부 전환은 실제 경로 검증과 독립적이고 `weak` Kakao 상세 URL은 좌표 검색으로 fail-safe 처리한다. 링크·탐색 경계 20건과 전체 UI 회귀 133건(기존 skip 1건)을 통과했다. 다음은 QA-EXPLORE-01에서 실제 두 `area_access` 권역 중 하나로 외부 전환·복귀·선택 검증을 소수 실기기로 확인하는 단계다.
- QA 실기기에서 Safari는 다대포 Kakao Place URL을 정상으로 열지만 앱의 `Linking.openURL` handoff가 실패했다. URL/카탈로그/추천 문제가 아니라 iOS 외부 전환 경계 문제로 분리한다. U-EXPLORE-01은 external 실패 시 시스템 브라우저 시트의 안전한 Kakao 검색 URL을 한 번만 시도하도록 재개하며, 새 internal build 수락 뒤 QA-EXPLORE-01을 재개한다.
- U-EXPLORE-01 browser fallback과 QA-EXPLORE-01을 수락했다. 설치된 카카오맵 앱에서 HTTPS→앱 확인 단계를 줄이기 위해 새 U-KAKAO-DEEPLINK-01을 시작한다. 공식 `kakaomap://place`/`look` scheme과 iOS query whitelist만 쓰고, 미설치 기기는 현행 웹 fallback을 유지한다. 이는 추천 계약이 아니라 외부 지도 전환 UX 개선이며 새 internal build가 필요하다.

## 기준·이력

- [내정보 구성 확정](profile-settings.md): DEC-PROFILE-SETTINGS-01, 세 영역·계정 진입·기록 탭 분리. 사용자 확정·구현 전.

- 기준: `docs/03_product/추천로직.md`, `docs/테스트.md`, `docs/03_product/UIUX_공통규칙.md`
- 현재 상태: `docs/작업조정_보드.md`
- 과거 수락·지시: 역할별 `work/<role>/archive/2026-08-history.md`와 [보드 archive](archive/2026-08-board-history.md) (현재 작업에는 필요한 anchor만 참조)
