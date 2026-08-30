# TimeFit 문서 안내

> 이 파일은 새 세션·새 작업자가 가장 먼저 읽는 문서 색인이다. 과거 문서를 현행 사양으로 해석하지 않는다.

## 1. 현재 기준 문서

| 목적 | 문서 | 상태 |
| --- | --- | --- |
| 추천 정책 단일 기준 | [03_product/추천로직.md](03_product/추천로직.md) | 현행 정책, 구현 전환 필요 |
| 역할별 현재 작업 | [work/README.md](work/README.md) | 새 세션의 짧은 역할 색인과 활성 작업 파일. 과거 작업기록 전체를 읽지 않는다. |
| 추천 엔진 작업 이력 | [work/recommendation-engine/archive/2026-08-history.md](work/recommendation-engine/archive/2026-08-history.md) | 수락·보완·fixture의 append-only 감사 이력 |
| 세션 간 작업 조정 | [작업조정_보드.md](작업조정_보드.md) | 역할 간 의존성·상태·활성 작업 파일 색인 |
| 추천 엔진 현행정책 감사 | [03_product/추천엔진_현행정책정합성_감사프롬프트.md](03_product/추천엔진_현행정책정합성_감사프롬프트.md) | 코드 전환 범위 확인용, 감사 전용 |
| 추천 엔진 점진 전환 지침 | [03_product/추천엔진_점진적전환_작업지침.md](03_product/추천엔진_점진적전환_작업지침.md) | 체감 검증용 v1부터 고도화하는 구현 순서 |
| 사용자 요구·검증 상태 | [테스트.md](테스트.md) | 현행 요구, 미검증 항목 있음 |
| 화면 공통 규칙 | [03_product/UIUX_공통규칙.md](03_product/UIUX_공통규칙.md) | 현행 규칙, 구현 전환 필요 |
| UIUX 작업 이력 | [work/uiux/archive/2026-08-history.md](work/uiux/archive/2026-08-history.md) | 화면·테스트의 append-only 감사 이력 |
| QA·출시 작업 이력 | [work/qa-release/archive/2026-08-history.md](work/qa-release/archive/2026-08-history.md) | 회귀 게이트·실기기 확인의 append-only 감사 이력 |
| 실기기 추천 검증 | [work/qa-release/real-device-recommendation.md](work/qa-release/real-device-recommendation.md) | 사용자가 직접 기록하는 실제 Route Proxy·추천 체감 시나리오 |
| 외부 API 작업 기준 | [work/external-api/archive/2026-08-history.md](work/external-api/archive/2026-08-history.md) | 서버 Route Proxy·구간 캐시·호출량 예산 계약 |
| DB·개인화 작업 기준 | [work/db-personalization/archive/2026-08-history.md](work/db-personalization/archive/2026-08-history.md) | 검증 코스 저장·RLS·개인정보 경계의 후속 작업 |
| 화면 흐름·와이어프레임 | [03_product/UIUX_와이어프레임_계획.md](03_product/UIUX_와이어프레임_계획.md) | 현행 계획, 화면 재구성 필요 |
| UIUX 수동·E2E 명세 | [03_product/UIUX_테스트명세.md](03_product/UIUX_테스트명세.md) | 현행 명세, 자동화 미착수 |
| DB 계약·마이그레이션 | [04_backend/데이터베이스설계.md](04_backend/데이터베이스설계.md) | 현행 DB 구조 기준 |
| iOS 출시 게이트 | [05_release/출시준비_체크리스트.md](05_release/출시준비_체크리스트.md) | 출시 전 갱신 |

`구현 전환 필요`은 현재 코드가 문서 정책을 아직 모두 따르지 않는다는 뜻이다. 문서는 아래 확정 정책을 새 구현의 단독 기준으로 사용한다.

## 2. 데이터 근거

- [AI-Hub 카테고리별 체류시간 분포](02_data/AI허브_카테고리별_체류시간분포.md): 현재 체류시간 정책의 분포 근거
- [사용 중 장소 운영시간 감사](02_data/사용중_장소_운영시간_감사.md): TourAPI 실조회와 부산시 원천 대조 결과
- [데이터 정제 검증·재분류 실행 프롬프트](02_data/데이터정제_검증및재분류_실행프롬프트.md): 데이터 정제 세션의 필수 읽기 순서, 원천 조사, 재분류, 검증·인수인계 기준
- [장소 검증 최종 제한 실행 프롬프트](02_data/장소검증_최종_제한실행프롬프트.md): 출시 후보 직전의 무호출 우선·제한 수동 재확인 게이트. 지금 실행하는 작업이 아니다.
- [보류 발견 장소 재검증 실행 프롬프트](02_data/보류_발견장소_재검증_실행프롬프트.md): 짧은 방문이 가능한 자연·문화·거리 장소를 공식 문구 부재만으로 제외하지 않도록 하는 140개 보류군 재검토 기준.
- [AI-Hub 데이터셋 전수 카탈로그](02_data/AI허브_데이터셋_전수카탈로그.md), [TourAPI 카탈로그](02_data/TourAPI카탈로그.md): 원천 데이터 레퍼런스

## 3. 현재 확정 정책·구현 대기 항목

2026-08-24까지의 사용자 결정으로 아래 항목을 확정했다. 코드는 이전 단일 장소·2시간 흐름이 일부 남아 있으므로 다음 구현 세션은 이 결정만을 기준으로 전환한다.

1. 최대 입력 시간은 현재 시각부터 `3시간(180분)`이다.
2. 결과는 시간·공간·운영시간 하드 조건을 통과한 `1~3개 장소` 코스들로 구성한다. 상단에는 1~2곳을 우선한 대표 `1개`를, 아래에는 같은 세션의 다른 검증 코스 목록을 제공한다.
3. `더보기`는 대표 코스에 포함 가능한 확인 후보와 운영시간 미확인 조건부 후보를 함께 탐색한다.
4. 운영시간 미확인 조건부 후보는 대표 추천·자동 확정에서 제외한다. 사용자가 카카오맵 확인을 명시하면 경로·시간을 재계산한 **조건부 수동 포함 코스**에만 넣을 수 있고, 공식 근거·추천 상태로 승격하지 않는다.
5. TimeFit의 사용자 가치는 다음 일정 전 계획 밖의 부산 장소를 발견할 기회다. 시간·운영시간·실제 경로 조건이 같은 후보 사이에서만 앱 완료 기록 기반의 지역·활동 발견성을 보조 순위로 사용한다. 소비·관광 활성, GPS 방문·외부 소비 이력, 근거 없는 첫 방문·인기도는 추천 근거나 사용자 약속으로 쓰지 않는다.
6. 장소는 단일 승인 등급이 아니라 장소 동일성·범위·활동/체류 근거·이용 가능성·이용 부담·근거 이력으로 재분류한다. 자동 대표 추천은 `representative_core / representative_standard`, 운영시간 미확인은 `conditional_more`, 근거 부족·중복·예약 필수 등은 `hold`로 처리한다.

## 4. 보관 문서

- [archive/product-history](archive/product-history/README.md): 이미 대체된 UI·추천 전환·구현 기록. 현재 사양이 아니다.
- [archive/product-plans](archive/product-plans/README.md): 초기 기획·기술 선택·다중 장바구니 계획. 현재 사양이 아니다.

## 5. 세션 시작 체크리스트

1. 이 파일과 저장소 루트의 `AGENTS.md`를 읽는다.
2. [작업 조정 보드](작업조정_보드.md)에서 자기 역할의 현재 작업 ID와 상세 작업기록 링크를 확인한다.
3. 작업 대상의 기준 문서와 `docs/테스트.md` 요구사항 ID를 확인한다.
4. 현재 확정 정책과 충돌하면 구현을 시작하지 않고, 결정 트리에 기록할 질문으로 되돌린다.
5. 외부 API는 fixture·어댑터 경계로 검증하고, 실제 API 검증은 호출량을 기록한 소수 시나리오로 제한한다.

## 6. 역할별 최소 읽기 범위

세션은 필요한 문서와 파일만 읽는다. 과거 이력 전체를 다시 읽는 방식은 금지한다.

| 역할 | 시작 시 추가로 읽을 문서 | 주 소유 경로 | 완료 인수인계 |
| --- | --- | --- | --- |
| 통합·결정 | `work/integration-decision/README.md`, `추천로직.md`, `테스트.md` | 기준 문서 | 결정 ID, 충돌 여부, 다음 구현 범위 |
| 데이터 정제 | `work/data-curation/README.md`, `02_data` 근거 문서, `추천로직.md`의 데이터 절 | `data/`, `scripts/build_*`, `src/data/` | 입력·출력 파일, 데이터 수, 제외 근거 |
| 추천 엔진 | `work/recommendation-engine/README.md`, `추천로직.md`, 해당 단위 테스트 | `src/engine/`, 순수 테스트 | 입출력 계약, fixture, 회귀 시나리오 |
| API 어댑터 | `work/external-api/README.md`, API 관련 계약·호출량 기록 | adapter/cache, 계약 테스트 | 캐시 키·TTL, 실패 폴백, 실제 호출 수 |
| UIUX | `work/uiux/README.md`, `UIUX_공통규칙.md`, `UIUX_테스트명세.md` | `src/ui/`, UI 테스트 | 화면 전환, 접근성, 수동 확인 항목 |
| DB·개인화 | `work/db-personalization/README.md`, `데이터베이스설계.md` | migration/repository/RLS 테스트 | migration ID, RLS 결과, payload 호환성 |
| QA·출시 | `work/qa-release/README.md`, `테스트.md`, `UIUX_테스트명세.md` | `test/`, fixture, E2E, 출시 문서 | 시나리오 ID, fixture, 캡처/로그, 잔여 위험 |

공통 인수인계 형식은 `변경 파일 / 유지한 계약 / 테스트 결과 / 다음 결정` 네 항목이다. 단일 작성자 파일 목록과 역할 경계는 루트 `AGENTS.md`를 따른다.

## 7. 현재 작업·이력 분리 원칙

- 여러 역할이 함께 봐야 하는 현재 상태·선행 조건은 [작업 조정 보드](작업조정_보드.md)에 짧게 기록한다.
- 새 세션의 상세 지시는 `work/<role>/README.md`와 그 README가 링크한 **활성 작업 묶음 파일**에만 둔다. 현재 작업과 무관한 기존 작업기록 전체 읽기는 금지한다.
- 역할별 `work/<role>/archive/`는 완료 이력·수락 근거·감사를 위한 append-only 보관소다. 완료 시 네 항목(변경 파일 / 유지 계약 / 테스트 / 다음 결정)을 요약해 남기되, 다음 작업의 상세 명령을 계속 누적하지 않는다. 실행에 필요한 현재 규칙은 별도 작업 묶음으로 짧게 정리한다.
- 하나의 파일은 같은 목표·공개 계약·선행 조건을 공유하는 작업 묶음만 다룬다. 독립 목표는 같은 역할이라도 새 묶음 파일로 분리한다.
