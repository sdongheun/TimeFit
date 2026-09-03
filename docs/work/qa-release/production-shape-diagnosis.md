# QA-SHAPE-01 — 실제 다장소 탈락 원인 최소 관찰

## 시작 조건

[U-DIAG-SHAPE-01](../uiux/internal-shape-diagnostics.md)이 수락되고, 아래 두 환경값을 포함한 **새 internal build**가 설치된 뒤에만 실행한다.

```text
EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true
EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12=false
```

두 번째 값은 제거해도 되지만 `'true'`이면 안 된다. B12는 별도 실험 entry여서 production 기본 entry의 `shapeDiagnostics`를 만들지 않는다. 결과 화면에서 `내부 정책: A8`과 `1곳 코스`·`2곳 코스`·`3곳 코스` 섹션이 함께 보여야만 이 QA를 시작할 수 있다. `내부 정책: B12` 또는 N1/N2/W/T만 보이면 설정 불일치로 중단하며, 그 실행은 QA 횟수에 세지 않는다.

## 목적

`QA-UX-CORE-01`의 선택 폭 부족을 재현하려는 작업이 아니다. 실제 production 기본 entry에서 2·3곳이 **후보 부족 / 시간 초과 / 경로 미검증 / 제공사 불가** 중 어디에서 사라지는지 최소 횟수로 관찰한다.

## 실행

위 시작 조건을 만족한 뒤 아래 두 흐름만 각각 정확히 한 번 실행한다. 새 추천, 같은 입력 재시도, cache 삭제, B12 전환, 시간·장소 변경은 금지한다.

| ID | 입력 | 기록 목적 |
| --- | --- | --- |
| SHAPE-01 | 서면역 복귀, 개발 시작 15:00, 약 120분, 여유 10분 | 밀집 생활권의 1·2·3곳 queue/시도/검증 분리 |
| SHAPE-02 | 사상역 → 서면역, 개발 시작 15:00, 약 120분, 여유 10분 | 이동 목적지가 있는 흐름의 동일 분리 |

각 실행에서 결과 장소명·장소 수와 다음 **화면에 표시된 안전 숫자만** 기록한다.

- 1곳·2곳·3곳의 `큐 후보 / 시도 / 검증`
- 2곳·3곳의 `시간 예산 초과 / 경로 미검증 / 경로 확인 불가`
- 총 `새 경로 확인 / adapter 호출 / 재사용`이 표시되는 경우

시간표 모순, 중복 장소, 조건부 자동 승격, `route_proxy_*` 오류, 앱 멈춤이면 즉시 중단한다.

## 판정 규칙

- 2곳 `검증 ≥ 1`인데 결과에 2곳이 없으면 **엔진 선택/표시 결함**으로 분리한다.
- 2곳 `큐 후보 > 0`, `시도 > 0`, `검증 = 0`이면 **실제 route·시간 탈락**으로 기록한다. 이 결과만으로 호출 한도 상향·장소 승격을 결정하지 않는다.
- 2곳 `큐 후보 > 0`, `시도 = 0`이면 **production queue/budget 순서**를 추천엔진이 재검토한다.
- 2곳 `큐 후보 = 0`이거나 3곳만 0이면 **공간 선별·운영시간·최소 체류 사전 탈락**을 추천엔진/데이터가 분리한다.
- 제공사 오류·상한이면 API 어댑터 경계로 넘긴다.

## 완료 기준

- 두 실행의 입력·화면 결과·안전 집계와 위 판정만 기록한다. 좌표·URL·provider 원문·키·사용자 식별자는 기록하지 않는다.
- 추천 정책, API 호출 상한, 장소 수, UI 일반 화면은 변경하지 않는다.
- 다음 작업은 두 결과를 통합·결정이 읽어 **엔진 / 데이터 / API / UI 중 하나**로 한 번만 지정한다.

---

## 2026-09-02 — QA-SHAPE-01 설정 불일치 중단 인계

### 1. 변경 파일과 목적

- 이 문서: SHAPE-01 첫 실행에서 발견한 internal build 설정/진단 표시 불일치와 중단 사유를 기록했다.

### 2. 유지한 공개 계약·정책 경계

- 추천 엔진, UIUX 구현, API·cache, 데이터, DB, 환경 파일, 제품 정책 및 작업 조정 보드는 수정하지 않았다.
- 새 추천, 같은 입력 재시도, cache 삭제, B12 전환, 시간·장소 변경을 하지 않았다.

### 3. 테스트와 실기기 결과

- 실행 전 `npx tsx --test test/ui/recommendation-internal-diagnostics-model.test.ts` 5/5, `npx tsx --test test/course-v1-pagination.test.ts test/course-v1-limited-integration.test.ts` 50/50, `npm run test:typecheck`를 통과했다.
- `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true`가 포함돼야 하는 새 iOS internal build를 설치·실행한 뒤 **SHAPE-01**(서면역 복귀, 개발 시작 15:00, 약 120분, 여유 10분)을 1회 실행했다.
- 결과 화면의 internal panel에는 `내부 정책: B12`와 기존 N1/N2/W/T 집계만 표시됐고, QA-SHAPE-01의 필수 관찰값인 1곳·2곳·3곳별 `큐 후보/시도/검증/시간·경로 탈락` 섹션은 표시되지 않았다.
- 따라서 이 실행은 production 기본 entry의 형태별 탈락 원인을 판정하는 근거로 사용할 수 없다. token·URL·좌표·provider 원문·키·사용자 식별자는 기록하지 않았다.

### 4. 다음 세션의 결정 필요 사항·위험·재현 조건

- **UIUX/빌드 설정 인계 필요:** QA-SHAPE-01은 B12 전환 없이 production 기본 entry의 shape diagnostics가 표시되는 build를 요구한다. 현재 설치 build가 왜 B12 panel만 표시했는지(번들 환경값, internal panel 조립 경로, production entry 전달 중 하나)를 UIUX/통합이 분리해야 한다.
- QA는 이 화면에서 숫자를 추정하거나 SHAPE-02를 실행하지 않는다. UIUX/통합이 B12가 아닌 production 기본 panel에 1·2·3곳 안전 집계가 보임을 확인한 새 internal build를 제공한 뒤에만 SHAPE-01부터 새 1회로 재개한다.
- 현 상태에서 API 호출 상한·추천 정책·장소 수를 변경하거나 다장소 코스를 강제하는 것은 근거가 없다.
