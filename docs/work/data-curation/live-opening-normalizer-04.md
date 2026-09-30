# DATA-LIVE-OPENING-NORMALIZER-04 — TourAPI live 운영시간 보수 정규화

상태: **순수 normalizer·저장 근거 감사·fixture 완료 / public openingGate 연결 대기**
기준: `DEC-LIVE-PUBLIC-DATA-01`, `API-TOUR-LIVE-PROGRESSIVE-03`
작성일: 2026-09-21
외부 API·운영 DB 호출: **0회**

## 1. 결과

`src/data/liveOpeningNormalizer.ts`에 TourAPI `detailIntro2` adapter가 정규화한 `rawText`, `closedText`, `eventStartDate`, `eventEndDate`만 받아 CourseV1 `StructuredAvailability` 또는 typed 제외 결과로 바꾸는 순수 normalizer를 추가했다.

운영시간 원문이 live 응답에 없거나 변경됐을 때 기존 로컬 구조화 windows를 최신 성공값으로 사용하지 않는다. 기존 windows 재사용은 같은 내부 장소, 같은 TourAPI source ID와 content type, 정규화한 live `rawText`와 기존 검토 `sourceText`의 정확한 일치, 추가 `closedText`·행사기간 없음이 모두 확인된 경우로 제한했다.

출력은 다음 셋 중 하나다.

- `structured`: 검증된 기존 파생 windows 재사용 또는 안전한 live 문법 새 파싱
- `needs_review`: 모호·조건부·복수 예외·필드 누락·source mismatch
- `event_excluded`: 기준 날짜가 명시 행사기간 전 또는 후

원문 전체는 반환·로그·영속 저장하지 않는다. provenance에는 공급자, source ID, parser version, 사용한 필드 이름과 `reviewed_exact_reuse | live_runtime_parse | event_period_gate | rejected` 모드만 포함한다.

## 2. 저장 원문 선행 감사 — 대표 TourAPI 연결 98개

실제 API를 호출하지 않고 저장된 `tourapi_detailIntro2` evidence를 같은 날짜 `2026-09-21`의 합성 live 입력으로 사용했다.

| 예상 처분 | 수 | 의미 |
| --- | ---: | --- |
| `exact-reviewed reuse` | 76 | 같은 TourAPI ID의 단일 검토 원문과 구조화 row `sourceText`가 정확히 같아 기존 windows 재사용 가능 |
| `safe runtime parse` | 6 | 기존 row는 합성/과거 판정 때문에 exact 재사용 불가지만 저장된 TourAPI 원문 자체는 새 안전 문법으로 파싱 가능 |
| `needs_review` | 16 | 저장 TourAPI 원문 부재 6, 복수·예외 문법 9, 시간 범위 없음 1 |
| `event_excluded` | 0 | 저장 audit fixture에는 행사기간 입력 없음 |

안전 새 파싱 6개는 `poi_13`, `poi_89`, `poi_92`, `poi_123`, `poi_225`, `poi_287`이다. 단순 단일 범위 또는 명시 상시 문법이다.

검토 필요 16개는 `poi_3`, `poi_4`, `poi_25`, `poi_34`, `poi_71`, `poi_78`, `poi_94`, `poi_145`, `poi_176`, `poi_187`, `poi_237`, `poi_245`, `poi_270`, `poi_272`, `poi_403`, `poi_427`이다. 부산 원천만 있는 운영시간을 TourAPI live 성공으로 대신 쓰지 않았고, 계절별·복수 시설·입장마감·예약·마지막 주문처럼 추가 해석이 필요한 문법도 새 runtime parse로 승격하지 않았다.

이 분포는 live API의 미래 결과 수가 아니다. 현재 저장된 TourAPI evidence가 그대로 돌아온다는 감사 fixture의 예상치다. 실제 live `closedText`나 행사기간이 추가되면 exact 재사용 수는 줄 수 있다.

## 3. 변경 이력

- **이전 방식:** 번들 `부산_장소_구조화_운영시간.json`의 windows를 동기식 후보 provider가 사용했고, live `detailIntro2` 원문을 같은 계약으로 보수 변환하는 runtime 경계가 없었다.
- **발생한 문제:** live 원문 변경·휴무 추가·행사 종료에도 오래된 windows를 성공값으로 재사용하거나, 단순 정규식이 복수 예외를 첫 시간 범위로 잘못 축약할 수 있었다.
- **교체한 방식:** exact 검토 근거 재사용과 새 live 문법 파싱을 provenance로 분리하고, 나머지는 `needs_review` 또는 행사기간 제외로 fail-closed한다.
- **교체 이유:** 원천 최신성과 검증된 앱 파생 정책을 동시에 보존하면서 오래된 운영시간 fallback을 막기 위해서다.
- **상태:** 데이터 normalizer 구현 완료. public 추천의 opening gate 연결은 추천 엔진/orchestrator 후속 작업이다.

## 4. 지원 문법

### 구조화 가능

- `24시간`, `상시`, `상시 개방`, `연중무휴`
- 단일 명확 범위: `09:00~18:00`, `매일 09:00-18:00`
- CourseV1 day type으로 정확히 표현 가능한 단일 요일군:
  - `평일`, `월~금`, `월요일~금요일` → `weekday`
  - `주말`, `토~일`, `토요일~일요일` → `weekend`
  - `매일`, `월~일`, `월요일~일요일` → `weekday + weekend`
- 매일 자정 넘김 단일 범위: `22:00~02:00` → `00:00~02:00`, `22:00~24:00` 두 windows
- `<br>`, `<br/>`, 단순 HTML tag와 연속 공백 정규화
- `closedText`가 비어 있거나 `연중무휴/무휴`이고 나머지 문법이 안전한 경우

`00:00~24:00`은 상시 접근으로 정규화한다. 날짜는 운영시간 window로 바꾸지 않는다.

### `needs_review` 제외

- `점포별/매장별/가게별`, `상이`, `문의`, `홈페이지 참조`, `행사별`, `프로그램별`
- 빈 값, 유효하지 않은 시각, 시작·끝 동일 범위
- 복수 시간 범위, 계절별 범위, 성수기/비수기, 여러 시설별 범위
- 입장 마감, 마지막 주문/라스트오더 등 추가 시각이 있는 **새로운** live 문법
- 예약제, 공휴일 예외, 임시휴무, 휴관·휴점
- `화~일`, 특정 요일 휴무처럼 `weekday/weekend` 두 값만으로 정확히 표현할 수 없는 요일 규칙
- 평일 자정 넘김처럼 다음 날짜의 day type을 현재 CourseV1 계약으로 정확히 표현할 수 없는 범위
- `closedText`에 실제 휴무일·임시휴무가 추가된 경우
- 행사기간 한쪽 누락, 형식 오류, 시작일이 종료일보다 늦은 경우

기존 검토 exact 재사용은 parser가 새로 해석하는 것이 아니다. 같은 source ID·원문임을 확인해 이미 검증된 windows를 재사용하므로, 검토 당시 허용된 문법이 새 parser 지원 문법보다 넓을 수 있다. live 원문이 한 글자라도 달라지면 이 경로를 사용하지 않는다.

## 5. 행사기간 계약

호출자는 세션의 부산 현지 기준 날짜를 `YYYY-MM-DD`로 명시 주입한다. 행사 시작·종료일은 `YYYYMMDD` 둘 다 있어야 한다.

- 기준 날짜 < 시작일: `event_excluded / event_not_started`
- 기준 날짜 > 종료일: `event_excluded / event_ended`
- 기간 안: exact windows 재사용은 금지하고 live 운영시간 문법을 새로 파싱
- 불완전·잘못된 기간: `needs_review / invalid_event_period`

행사기간 밖 결과는 route 전 제외에 사용할 typed 결과다. 행사 날짜를 `00:00~24:00` 같은 운영 windows로 합성하지 않는다.

## 6. public openingGate 인계

추천 orchestrator는 같은 `liveSourceSnapshotId`의 `active_catalog` 후보와 `detail_batch` 결과를 exact content ID/type으로 연결한 뒤 이 normalizer를 호출해야 한다.

1. `active_detail_failed`는 normalizer를 호출하지 않고 기존 계약대로 제외한다.
2. `active_ready`의 internal place ID, TourAPI source ID/type, opening, 세션 기준 날짜만 전달한다.
3. `structured`만 기존 CourseV1 candidate의 `availability`에 넣는다.
4. `needs_review`, `event_excluded`는 route 호출 전에 제외하고 typed 이유를 진단에 보존한다.
5. local category/subCategory, 체류, classification, site 관계는 `DATA-LIVE-CATALOG-PROJECTION-03` 결과를 그대로 유지한다.
6. normalizer 결과가 없거나 malformed이면 로컬 구조화 운영시간으로 성공 복귀하지 않는다.
7. 원문은 사용자 로그·navigation payload·DB·파일·cache에 저장하지 않는다.

이 모듈은 현재 public `courseV1CandidateProvider`, 엔진 opening gate, UI 표시를 직접 변경하지 않는다.

## 7. fixture와 검증

`test/live-opening-normalizer.test.ts`가 다음 RED→GREEN 범위를 고정한다.

- 최초 RED: normalizer 모듈 부재로 0/1, `MODULE_NOT_FOUND`
- 24시간·상시·연중무휴
- 단일 매일 범위, weekday/weekend 범위
- 매일 자정 넘김
- 실제 휴무일·임시휴무
- 문의·상이·참조·프로그램별
- 복수 범위·예외·예약
- HTML `<br>` 정규화
- 빈 값과 잘못된 시각
- 행사기간 전·후·기간 안·불완전/역전
- exact source ID/sourceText 재사용과 변경·source/type mismatch
- 결과에 live 원문 전체가 포함되지 않음
- 저장 근거 감사 `76 / 6 / 16`

## 8. 변경·검증·남은 위험

### 변경 파일과 목적

- `src/data/liveOpeningNormalizer.ts`: exact 검토 근거 재사용, 보수 runtime parse, 행사기간 gate, 98개 저장 근거 감사.
- `test/live-opening-normalizer.test.ts`: 문법·휴무·행사·재사용·누락·감사 fixture.
- 이 문서와 데이터 역할 README: 분포와 public openingGate 인계.

### 변경하지 않은 공개 계약·정책 경계

원본 JSON, 기존 구조화 운영시간 JSON, UI, 추천 엔진, API adapter/Edge, DB, 배포, 환경변수, 중앙 정책·마스터 체크박스를 수정하지 않았다. 사용자 위치·HTTP·API key·추천 순위·route 계산을 추가하지 않았다. 실제 API 호출·stage·commit·push도 하지 않았다.

### 실행 테스트

- RED `npx tsx --test test/live-opening-normalizer.test.ts` — 모듈 부재로 예상 실패 확인.
- GREEN `npx tsx --test test/live-opening-normalizer.test.ts` — 8/8 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 575/575 통과.
- `npm run test:ui` — 824개 중 823 통과, 1개 기존 skip, 실패 0.
- `git diff --check` — 통과.

### 다음 결정·위험·재현 조건

- 현재 CourseV1 availability는 `weekday/weekend`와 공통 windows만 가지므로 특정 요일 휴무나 요일군별 서로 다른 시간은 손실 없이 표현할 수 없다. 타입 확장 전에는 계속 `needs_review`다.
- exact 재사용 76개는 저장 원문과 동일하다는 가정의 fixture 수다. 실제 live 변경·휴무·행사 필드는 새 결과로 판정한다.
- 실제 TourAPI 제한 호출 전에는 content type별 현행 원문 분포와 행사 필드 조합을 운영 사실로 확정하지 않는다.
