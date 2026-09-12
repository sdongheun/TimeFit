# U-KAKAO-WEB-RETURN-01 — 웹 길찾기 종료 복귀

> 2026-09-09 후속: [U-KAKAO-ROUTE-START-02](kakao-route-start.md)의 사용자 확정 결정으로 코스 이동 시작 기준을 교체했다. 아래 ‘취소 시 시작 미확정/준비 복구’는 과거 계약이다. 정상 닫기 무오류·실제 실패 재시도·이미 확정된 상태 보존은 유지한다. 현재 코스는 클릭을 이동 의사로 먼저 저장하며 주변 길찾기는 이 처리를 적용하지 않는다.

## 2026-09-09 완료 인수인계

상태: 구현·자동 회귀·iOS JS export 완료. 이번 변경의 Simulator/실기기 재확인은 미실행이며 아래 수동 확인을 남긴다.

### 1. 변경 파일과 목적

- `src/ui/CourseConfirmScreen.tsx`: 첫 길찾기·다음 구간·Live Activity pending 자동 연결/명시 재시도에서 `browser_fallback_cancelled`를 오류 문구 없이 처리한다. 성공 boolean은 여전히 false다. pending 호출별 취소 여부를 전달하여 controller의 비성공 결과가 정상 닫기를 다시 일반 실패 문구로 덮지 않도록 했다.
- `src/ui/ExecutionScreen.tsx`: legacy 길찾기도 정상 browser 종료는 실패 Alert 없이 반환한다. 성공 후 진행 갱신보다 앞에서 반환한다.
- `test/ui/place-course-screen-runtime.test.mjs`: 실제 화면 handler와 실제 공용 adapter/controller를 고정 fixture로 실행한다. 브라우저 dismiss/cancel/throw, background로 먼저 확인된 성공, 1·2곳 첫 길찾기 및 체류 후 다음 구간, 기존 확정 단계, pending 자동/재시도 반례를 추가했다.
- `test/ui/release-exit-logs.test.mjs`: 기존 오류 원문 비출력 검증을 보존하고 실제 Execution handler의 닫기 무경고·단계 유지와 진짜 실패 Alert를 추가했다.
- 이 문서: 원인·계약·검증·수동 인계 기록. 위 파일들의 기존 다른 작업 변경은 보존했다.

이전 방식(철회): 화면에서 모든 비성공 enum을 길찾기 열기 실패로 표시 → 관찰: adapter가 정상 닫기를 이미 `browser_fallback_cancelled`로 반환해도 화면이 일반 오류로 표시하고, pending controller 결과에서도 같은 오류를 다시 표시 → 교체 방식(현행): 닫기는 비성공이지만 중립 표시, 실제 실패는 오류·재시도 유지 → 이유: 웹 닫기와 외부 앱 열기 성공은 별개의 증거이며, 오류 제거를 위해 진행 성공을 만들어서는 안 된다.

확인한 실패 경계는 adapter가 아니라 **화면의 반환값 소비/오류 표시**다. adapter의 browser Promise reject는 `failed`, background 증거 없는 정상 resolve는 `browser_fallback_cancelled`이며, 먼저 background를 관찰해 성공으로 확정한 호출은 뒤늦은 dismiss로 취소되지 않는다.

### 2. 유지한 공개 계약·정책 경계

- `openKakaoRouteWithFallback`, `isKakaoRouteOpenSuccess` 및 enum은 변경하지 않았다. `app_opened` / `web_opened` / `browser_fallback_opened`만 성공이다. `invalid_stage` / `failed`의 실패 처리를 유지한다.
- foreground 준비와 성공 확정 분리는 `release-personalization-integration.md`의 A 계약을 유지한다. 첫 열기의 미확정 준비는 비성공 settle로 정리하되, 이미 확정된 진행은 기존 confirmation 보존 규칙을 따른다. 웹 종료 자체로 새로운 Activity·출발/도착/체류 이벤트·단계 전이를 만들지 않는다.
- pending 취소도 기존 controller에서는 재시도 가능한 failure 상태로 남는다. 새 native 상태/스키마는 만들지 않고 화면의 잘못된 일반 오류만 제거한다. 이미 native 출발 확인으로 확정된 시각은 되돌리지 않으며, 외부 열기 성공 전 화면의 다음 구간 전이는 하지 않는다. 자동 재실행은 추가하지 않는다.
- 주변은 별도 `openNearbyDirections`를 사용하며 기존 dismiss/cancel=cancelled, 불명확한 resolve=unconfirmed, throw=failed 처리가 있다. `NearbyBrowseScreen`의 실제 실패 표시와 독립 길찾기를 유지하고 수정하지 않았다. 장소 정보 링크와 내부 진단 caller도 공용 반환 계약 변경 없이 유지한다.
- 추천·DB·개인화·알림 정책·native Live Activity 구현 변경 없음. 보드/중앙 기준 문서 변경, 운영 API 호출, 계정/표본 쓰기, commit/push 없음.

### 3. 검증 결과

- 실패 선행: 수정 전 실제 화면 fixture 44개 중 4개 실패. 정상 닫기를 오류로 표시하는 1·2곳 반례 재현. `/private/tmp/timefit-webreturn-red-final.log`.
- 수정 후 집중 회귀: 초기 화면 44/44 통과. 이후 pending 취소/실패/재시도 및 legacy 화면 검증을 확장해 아래 최종 전체 실행에 포함했다.
- `npm run test:typecheck`: PASS. `/private/tmp/timefit-webreturn-type.log`.
- `npm run test:ui`: 721개 중 720 PASS, 기존 skip 1, FAIL 0. `/private/tmp/timefit-webreturn-ui-final.log`.
- `npm test`: 409/409 PASS. `/private/tmp/timefit-webreturn-core-final.log`.
- 공개 환경 iOS export: PASS, `/private/tmp/timefit-public-export`, `index-dc23f77853efd87303c97654175686c0.hbc`. `/private/tmp/timefit-webreturn-export.log`.
- `git diff --check`: PASS. 모든 재현은 고정 화면/서비스 fixture이며 실제 카카오 호출이나 실기기 성공 증거로 대체하지 않는다.

### 4. 다음 확인·위험·재현 조건

최신 JS를 포함한 앱에서 사용자가 다음 최소 확인을 수행한다. 기존 촬영용 Release 앱은 정적 번들이므로 이번 수정 반영에는 새 로컬 빌드·설치가 필요하다. 이번 작업에서는 새 native 빌드/설치나 Simulator 조작을 실행하지 않았다.

1. 코스 길찾기를 웹으로 연 뒤 완료/닫기로 복귀: 일반 길찾기 실패 문구가 없어야 한다. 닫기만으로 도착·체류 시작 또는 다음 단계 전이가 생기지 않아야 한다.
2. 이미 길찾기 성공/도착이 확정된 코스에서 동일 복귀: 확정된 단계·시각이 보존되어야 한다. 카카오맵 앱 전환으로 먼저 성공이 확정됐다면 이후 웹 닫기로 이를 취소하지 않는다.
3. 실제 열기가 실패하는 조건: 오류와 기존 재시도 CTA가 남아야 한다. 단순 웹 내부 로딩 문제는 open API의 reject와 동일하지 않으므로 이를 임의로 실패라고 단정하지 않는다.
4. Live Activity 출발 자동 연결 및 명시 재시도에서 웹을 닫을 경우: 거짓 성공이나 반복 자동 열기 없이 기존 확정 상태 및 재시도 가능성을 유지해야 한다. 실제 카카오맵 열기 성공 시 기존 자동 연결 흐름을 확인한다.
5. 주변 독립 길찾기 웹 종료: 실패 문구가 없고 코스/Live Activity 상태에 영향이 없어야 한다.

출시/결정 세션은 이 수정 이후의 번들을 최종 후보로 사용하고, 앞선 촬영용 앱이나 Archive를 최신 수정 반영본으로 간주하지 않는다.
