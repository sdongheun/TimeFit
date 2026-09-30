# DATA-LIVE-NEARBY-READMODEL-01 — 주변 둘러보기 비저장 live read model

상태: **데이터 순수 projection·고정 fixture 완료 / UI·운영 연결 대기**  
작성일: 2026-09-22  
외부 API·Simulator·배포 호출: **0회**

## 판단과 결과

기존 `NearbyBrowseScreen`은 추천과 별도 탭으로 `busan_poi_catalog.json` 369곳의 저장된 제목·좌표·설명·사진·운영시간을 직접 읽는다. 추천의 sealed session을 주변 기준점에 재사용하면 별도 진입의 시각·수명과 섞이므로, 같은 추천 결과를 공유하지 않는다.

승인된 `TourAPI contentId + contentTypeId`, 부산 `source key + UC_SEQ`와 **한 번의 facade 초기 snapshot**만 받아 순수·비저장 read model을 만드는 것은 가능하다. `src/data/liveNearbyReadModel.ts`는 이전 `DATA-LIVE-SESSION-BRIDGE-03`의 token-free 초기 projection을 재사용한다. 네트워크·사용자 좌표·시각·지도 pan·detail batch·운영시간 parser·추천 엔진·저장소를 호출하지 않는다. 출력은 ID, 최신 제목·주소·좌표, 부산 설명, exact 승인 사진, 앱 파생 category/subCategory/classification, 필드 출처와 안전 상태뿐이다. `informationOnly: true`를 붙이고 현재 영업·코스 적합성을 주장하지 않는다.

사용자 수동 기준점과의 3km 거리·정렬은 이 read model 밖 기존 UI 순수 계산이 담당할 영역이다. 지도 pan은 메모리 안의 동일 dataset 표시만 바꿀 수 있고 provider를 다시 호출해서는 안 된다. 다만 화면 탭 진입 시 새 facade를 언제 만드는지, 메모리 snapshot의 종료·재사용·명시 새로고침은 아래 미확정 사항이다. 본 구현은 UI에 연결하지 않았다.

## 후보 수·상태

| 검증용 완전 active fixture | 장소 |
| --- | ---: |
| 런타임 정책 | 369 |
| exact TourAPI 또는 부산 연결 | 251 |
| 그중 대표 | 191 |
| 그중 conditional_more | 60 |
| 전통시장-only, live provider 범위 밖 | 118 |

이는 **최대 정보 탐색 후보의 fixture 수**이고, 실제 API 응답 성공 수나 특정 3km 기준점에서 보이는 수가 아니다. 완전 active fixture에서는 251개를 투영한다. Tour 전체 실패 + 부산 active는 132개 active/119개 `source_unavailable`, 부산 전체 실패 + Tour active는 139개 active/112개 `source_unavailable`이다. 전통시장-only 118개는 언제나 `provider_out_of_scope`이며 저장 사실로 되살리지 않는다. complete inactive는 삭제로 구분하고, 부분 실패는 삭제로 단정하지 않는다.

양쪽 active면 TourAPI 제목·주소·좌표, 부산 설명을 사용한다. TourAPI inactive/unavailable이면 부산 active, 반대이면 TourAPI active 사실만 사용한다. exact identity/type 충돌과 부산 내부 다중 링크 사실 충돌은 `review_required`로 제외한다. snapshot 불일치는 후보 0개의 `unavailable`이다. 승인 사진이 없으면 기본 이미지 상태로 두고 장소는 유지한다. 운영시간·휴무 원문이나 저장된 description/좌표로 빈 live 필드를 보충하지 않는다.

## 변경 이력

- **이전 방식:** 주변 둘러보기는 369개 번들 JSON의 원천 사실을 화면에서 직접 읽었다.
- **관찰:** 추천 live 전환과 별개인 주변 화면은 앱 업데이트 전까지 수정·삭제가 반영되지 않고, 추천 snapshot 재사용은 별도 기준점/수명에 맞지 않는다.
- **교체한 방식:** exact 연결과 단일 facade snapshot으로 만드는 비저장 정보 탐색 read model을 데이터 경계에 추가했다. UI는 아직 기존 방식 그대로다.
- **교체 이유:** 원천 최신성과 앱 파생 정책을 분리하면서 시간·운영시간 추천 게이트를 주변 정보 탐색에 잘못 적용하거나 저장 사실을 live로 위장하지 않기 위해서다.
- **상태:** 데이터 read model 구현·fixture 검증 완료, public UI 전환·운영 수락 전.

## 변경 파일·보존 경계·검증

- `src/data/liveNearbyReadModel.ts`: token-free 단일 snapshot으로 369개 record와 최대 251개 후보를 만드는 순수 투영.
- `test/live-nearby-read-model.test.ts`: complete/partial/inactive/장애/identity/snapshot/사진/원문 비노출 fixture.
- 이 문서와 데이터 역할 README: 후보 수·화면 인계·남은 선택 기록.

UI/App, 추천 엔진·추천 게이트, 외부 API adapter·provider cap (`500행 × 2페이지 × 3원천 = 최대 6회`), 원본/런타임 catalog, DB·영속 저장, 사진 권리 상태, env/Edge를 수정하지 않았다. 실제 API, Simulator, 배포, commit/push를 실행하지 않았다.

검증:

- 모듈 부재 `MODULE_NOT_FOUND`로 실패 fixture 선행 확인.
- read model 단독 고정 fixture 6/6, 관련 데이터 집중 회귀 25/25 통과.
- `npm run test:typecheck` 통과.
- `npm test` 591/591 통과.
- `npm run test:ui` 839개 중 838 통과, 기존 skip 1, 실패 0.
- `git diff --check` 통과.

## 통합·API·UI 역할의 미확정 선택

1. 주변 독립 세션의 수명: 탭 진입마다 새 facade를 만들면 정상 3개 부산 provider 호출과 Tour 목록 호출이 추가된다. 메모리 재사용의 key·TTL·foreground/재진입/명시 새로고침·취소 시점을 정해야 한다. 이 결정 없이 UI 자동 연결·pan 재호출을 하지 않는다.
2. 주변 화면의 부분 장애·전체 장애·inactive·review·provider out-of-scope 118곳을 사용자에게 어떻게 표시하고 명시 재시도할지 결정해야 한다. 정적 fallback은 금지한다.
3. 장소 상세의 운영시간은 이 read model에 없다. 추천용 detail 최대 30곳을 주변 탐색에 자동 재사용할지/별도 예산을 둘지는 미확정이며 현재 구현은 detail 호출 0회, 표시상 `운영시간 확인 필요`만 안전하다.
4. 현재 UI의 `NearbyCatalogPlace` 사진 계약과 live 승인 사진 증거/출처 표시를 연결하는 adapter는 UI 소유다. 이 read model은 검증된 부산 photo 객체만 전달한다.
5. 실제 부산 세 서비스의 500행 허용, 운영계정 한도, 제한 호출 결과와 실제 3km 후보 분포는 아직 측정하지 않았다. fixture 수를 운영 결과로 해석하지 않는다.
