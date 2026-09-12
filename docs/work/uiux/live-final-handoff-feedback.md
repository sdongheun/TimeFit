# U-LIVE-FINAL-HANDOFF-FEEDBACK-01

## 2026-09-09 — 원인 확인·최소 수정 인수인계

상태: **실패 선행 재현 및 집중 자동 검증 완료 / 사용자 정상 확인으로 해당 보완 마감**. 사용자 보고의 새 수동 코스 최종 출발 후 거짓 불일치 문구를 대상으로 한다. 아래 구현 당시의 확인 대기 기록은 이력으로 유지하며 마지막 사용자 확인 기록을 최신 상태로 적용한다.

### 1. 변경 파일·원인·수정 목적

- `src/ui/liveActivity/pendingNavigationHandoffModel.ts`: 동일 요청의 실행 중 판정을 변경된 출발 단계 검증보다 먼저 처리한다. 멱등 키를 actionId 단독에서 active identity·purpose·courseRunId·actionId·stopId·baseRevision 조합으로 강화했다. 키는 메모리에만 사용하며 로그/저장하지 않는다.
- `test/ui/place-course-screen-runtime.test.mjs`: 실제 CourseConfirm을 실행하여 1곳·2곳 최종 출발의 상태 저장 → 재렌더 → background/active 복귀 → 외부 열기 완료 경합을 재현했다. 다른 run·만료·receipt 증거 누락은 실제 화면에 불일치 문구가 계속 표시되는 반례도 추가했다. 기존 파일의 이전 작업 변경은 유지했다.
- `test/ui/live-activity-pending-navigation.test.ts`: 실행 중/완료된 동일 요청, 다른 run·stop·revision, terminal/expired, manual 표식 누락의 분리를 검증한다.
- 본 문서: 원인·변경 이력·검증과 재확인 인계.

**이전 방식 → 관찰된 문제 → 교체 → 이유 → 상태**

1. 기존 컨트롤러는 `verifiedNextTravel()`로 출발 stop 일치를 검증한 **뒤에** 동일 action 실행 중 여부를 검사했다.
2. 실제 `beginRouteIntent`는 외부 길찾기 응답을 기다리기 전에 공유 이동 상태를 저장한다. 최종 목적지에서는 `activeStopId=null`이 된다. active 갱신으로 CourseConfirm의 `livePlan` 및 pending effect가 다시 실행되면, 아직 남아 있는 같은 pending 요청이 이미 변경된 local 상태로 검증되어 `invalid`가 된다.
3. CourseConfirm의 오류 설정 조건은 consume 결과 `invalid`이다. 새 effect가 불일치 문구를 설정하고, 이전 성공 effect는 cleanup으로 `mounted=false`이므로 성공 결과로 문구를 해제하지 못한다. 앱의 길찾기 재열기는 시작 시 오류를 비워 증상이 사라졌던 것이다. 길찾기 공급자 실패나 manualLocation 검사 실패로 재현된 문제가 아니다.
4. 수동 위치 증명·run·terminal 유효성을 먼저 유지하고, 같은 immutable 요청의 in-flight/consumed 여부를 출발 단계 재검증보다 먼저 확인하도록 교체했다. 새로운 요청은 기존 receipt/stop/revision/다음 구간 검증을 그대로 거친다. 최종 상태 변경 때문에 같은 실행을 새 실패로 오인하지 않기 위한 변경이다. **현행 구현**.

문구 무조건 삭제, 오류 표시 조건 제거, 길찾기 재실행, 최종 단계 특례 승인은 하지 않았다. 기존 pending=`executing` cold 복구의 자동 재실행 금지도 유지한다.

### 2. 유지한 계약

- 최초 클릭에서 이동 상태 저장 → Live Activity 시도 → 앱/웹 열기, 실제 전체 열기 실패의 조건부 복구, 재열기/연속 탭/늦은 응답 보호를 유지한다.
- 출발 시각·도착/체류 증거·공유 단계·알림 생성 로직 변경 없음. 같은 요청의 open/onOpened/native 성공 처리는 한 번만 수행한다. 최종 완료는 기존 완료 흐름을 사용한다.
- `hasManualLocationProof` 검사를 최우선으로 유지한다. 과거 좌표 차단·수동 재확정 계약을 완화하거나 GPS를 사용하지 않는다. 다른 run·만료/종료·새 요청의 증거 누락은 숨기지 않는다.
- native/AppGroup·DB·추천·API·개인화·운영 데이터 변경 없음. CourseConfirm 제품 화면과 오류 문구 자체 수정 없음. 보드·중앙 문서·다른 세션 변경을 수정/복원하지 않았다. commit/push/배포 없음.

### 3. 검증 결과

실패 선행: `/private/tmp/timefit-final-feedback-red.log`에서 실제 화면의 **1곳·2곳 최종 출발 모두 불일치 문구 노출 assertion 실패**를 확인한 뒤 컨트롤러를 수정했다.

집중 회귀 명령:

```sh
node --import tsx --test test/ui/live-activity-pending-navigation.test.ts test/ui/place-course-screen-runtime.test.mjs test/ui/course-route-start.test.mjs test/ui/manual-location-restore.test.mjs test/ui/release-manual-location.test.mjs test/ui/live-activity-final.test.ts
```

- **89/89 PASS, fail/skip 0**. `/private/tmp/timefit-final-feedback-focused.log`.
- 새 최종 출발 fixture: 외부 열기 지연 중 재렌더/foreground 후 및 완료 후 거짓 문구 없음, open 1회, 이동 intent 1회, native executing/success 각 1회, 최종 travel·routeOpened 유지, 도착/출발 시각 보존.
- 다른 run·expired·missing receipt 실제 화면은 오류 유지·길찾기 0회. 컨트롤러의 변경 stop/revision·완료된 요청·manual 표식 누락도 검증.
- 기존 전체 열기 실패/취소·재열기·중복·늦은 응답, 앱/LA 최종 완료, 새 수동 복원 및 과거 좌표 차단 회귀 포함.
- `npm run test:typecheck`: **PASS**, `/private/tmp/timefit-final-feedback-type.log`.
- 변경 대상 `git diff --check`: **PASS**.
- 실제 네트워크/운영 DB/Simulator/실기기 실행 없음. 이번에는 요청된 집중 검증만 실행했으며 전체 UI/전체 테스트·iOS 빌드는 재실행하지 않았다. 이를 출시 전체 통과로 기록하지 않는다.

### 4. 남은 실기기 확인·QA 인계

수정 JS가 포함된 앱에서 새 수동 **1곳·2곳** 코스를 각각 확인한다. 마지막 장소의 Live Activity 출발 버튼 → 카카오맵 정상 열림 → 앱 복귀 시 거짓 불일치 문구가 없고 최종 이동 상태/기존 완료 CTA가 유지되는지 확인한다. 길찾기 다시보기를 누르지 않은 상태로 확인해야 한다.

외부 전환 중 빠른 복귀/재진입에서도 길찾기 추가 실행·출발 시각 재초기화가 없어야 한다. 정상 도착·체류·최종 완료 흐름도 유지되는지 확인한다. 다른 run/만료/과거 표식 없음 등의 반례는 자동 fixture로 검증했고 운영 코스나 DB를 변조해 재현하지 않는다.

네이티브 변경은 없지만 본 작업에서 재설치용 빌드를 새로 생성하지 않았다. 기존 설치본에 수정 JS가 반영됐는지 확인 후 실기기 결과를 추가해야 한다. 이전 U-MANUAL-LOCATION-RESTORE-01의 변경 좌표 동일 run 재검증/만료된 과거 코스 완료 처리 잔여 결정은 본 수정으로 해소됐다고 간주하지 않는다.

### 사용자 재확인 — 보완 마감

- 사용자가 수정 인계 후 “정상확인됐다”고 보고했다. 해당 최종 길찾기 handoff 후 거짓 오류 표시 보완은 사용자 정상 확인으로 마감한다.
- 자동 검증 89/89 PASS 및 타입 검사 PASS와 사용자 확인은 별도 근거다. 사용자가 확인한 기기/빌드·1곳/2곳별 세부 실행 내역은 제공되지 않았으므로 위 체크리스트 전체를 개별 실기기 통과로 확대 기록하지 않는다.
- 이번 확인 반영은 본 작업 문서만 변경했다. 제품 코드·공개 계약 변경 및 테스트 재실행 없음. 출시 전체 QA나 다른 작업의 잔여 결정까지 마감한 것은 아니다.
