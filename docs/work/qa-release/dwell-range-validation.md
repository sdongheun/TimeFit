# QA-DWELL-01 — 체류 범위 회귀 게이트

## 시작 조건

`2-O`, `DATA-DWELL-01`, `U-1-DWELL-01` 수락 뒤의 internal build와 고정 fixture를 사용한다. 이 작업은 실제 Kakao 호출량을 늘리는 실기기 탐색이 아니다.

## 목적

권장 30분 고정 때문에 짧은 입력에서 결과가 사라지던 문제를, 실제 경로·운영시간·도착 여유의 안전성을 낮추지 않고 해결했는지 확인한다.

## 검증 범위

1. 50분·여유 10분·가까운 왕복의 20분 `짧게 가능` 단일 코스가 실제 구간 fixture와 함께 나온다.
2. 같은 입력에서 30분 권장 코스와 다른 20분 short 코스가 함께 있을 때 둘 다 표시되며, 대표 우선순위는 권장 코스다.
3. 운영 종료 직전 20/30 경계와 2곳 30+20 혼합 시간표가 도착 여유를 넘지 않는다.
4. 180분·60/120분 상한 fixture에서 체류가 자동으로 30분을 넘어 남는 시간을 채우지 않는다.
5. A8/B12의 provider attempt·adapter call 상한, cache/session 재사용, no-route/unavailable fail-closed, 같은 장소·순서 중복 금지를 이전 기준과 비교한다.
6. UI의 시간 여정·장소 카드·대안 선택은 engine snapshot과 일치하며 목록 선택으로 추가 route 요청을 만들지 않는다.

## 판정

- 위 1~6이 고정 fixture에서 통과하면 수락한다.
- 실기기에서는 이후 `RD-B12`의 두 고정 입력에 추가해 `RD-06` 50분 서면 왕복을 **한 번만** 다시 실행한다. 이 실행은 결과 수가 아닌 `짧게 가능` 코스의 시간표·진단 enum·사용자 이해 가능성을 기록한다.
- Route Proxy/CAPTCHA/실제 provider 오류는 체류 정책 실패로 단정하지 않고 해당 안전 enum을 별도 기록한다.

## QA 실행 기록 — 2026-08-30

**상태: 수락 (고정 fixture 회귀).** 실제 Kakao·TMAP·ODsay·Route Proxy 호출과 실기기 실행은 이 작업에서 하지 않았다.

| 범위 | 확인 결과 |
| --- | --- |
| 50분 short | 50분·여유 10분·가까운 왕복에서 20분 `짧게 가능` 단일 코스와 실제 구간 시간표를 확인했다. |
| 권장/short 동시 | 30분 권장 코스는 대표로, 별도 20분 short 코스는 대안으로 함께 반환·표시됨을 확인했다. |
| 운영시간·혼합 체류 | 종료 임박 20/30분 경계와 30+20분 혼합 코스가 도착 여유를 넘지 않으며, 최소 운영시간 미달 후보는 이후 경로 검증으로 넘기지 않음을 확인했다. |
| 상한 비자동 확장 | 180분 입력과 최대 60/120분 fixture에서 체류가 남는 시간을 채우도록 30분을 초과해 자동 확장되지 않음을 확인했다. |
| A8/B12 안전 경계 | attempt·adapter 상한, cache/session 재사용, no-route/unavailable fail-closed, 장소·순서 중복 금지 회귀를 확인했다. |
| UI 일치 | 시간 여정·장소 카드·대안 선택 모델이 engine snapshot과 일치하고, 목록 선택만으로 추가 route 요청을 만들지 않음을 확인했다. |

### 실행 명령과 결과

- `npx tsx --test test/course-v1-limited-integration.test.ts test/ui/course-v1-dwell-state.test.ts test/ui/course-v1-results-list.test.ts test/ui/recommendation-runtime-boundary.test.ts` — 53/53 통과
- `npm run test:typecheck` — 통과
- `npm run test:ui` — 통과
- `npm test` — 102/102 통과
- `git diff --check` — 통과

### 경계와 다음 단계

- 변경 파일: 이 QA 실행 기록 문서만 변경했다. 추천 정책, 엔진, UI, 외부 API 어댑터, 운영 데이터와 공개 계약은 변경하지 않았다.
- 이 수락은 고정 fixture 범위의 결과다. 실제 provider 오류를 체류 정책 실패로 해석하지 않는다.
- 통합·결정 역할이 `2-O`, `DATA-DWELL-01`, `U-1-DWELL-01`, `QA-DWELL-01` 네 게이트 수락을 확인한 뒤에만, 별도 승인된 internal build에서 `RD-B12`와 `RD-06` 실기기 확인을 진행한다.
