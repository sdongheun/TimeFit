# 처리 데이터 구조

`src/data/busan_poi_catalog.json`은 아래 자투리 활동 카탈로그로 생성한다. 앱은 `data/processed`의 JSON을 직접 읽지 않는다.

전체 데이터 역할은 상위 [data/README.md](../README.md), 검토 JSON의 세부 분류는 [review/README.md](review/README.md)를 따른다.

## 현재 런타임 추천 후보

- `review/부산_장소_근거프로필_재분류.json`: 기준선 1,037개를 필드별 근거로 재분류한 현행 원천이다. `representative_core` 28개·`representative_standard` 138개·`conditional_more` 176개·`hold` 695개이며, 원천·원문·수집일·적용 범위와 재검토 기한을 보존한다.
- `review/부산_장소_근거프로필_기준선.json`: 활성 356개 + 기존 review 140개 + excluded 541개의 ID 대조 기준선이다.
- `review/부산_자투리장소_카탈로그_초안.json`, `review/부산_자투리장소_보류및제외.json`: 이전 `approved / conditional / review / excluded` 분류 원천으로 보존한다. 현행 런타임 입력은 아니다.
- `src/data/busan_poi_catalog.json`: 재분류 원천에서 hold를 제외하고 생성한 앱용 구조다. 대표 추천은 core/standard만, 조건부는 더보기 전용이다.

`카테고리별_체류시간.json`의 중앙값은 과거 파이프라인과 진단 호환용으로만 보존한다. 현재 추천 후보의 체류시간은 카테고리 중앙값이 아니라 장소별 활동 범위를 우선한다.

## 자투리 활동 카탈로그의 원천·근거

- `부산시_명소정보.json`
- `부산시_쇼핑정보.json`
- `부산시_맛집정보.json`

장소의 출처는 각 장소의 `sourceEvidence`에서 `tourapi_aihub`, `tourapi_fallback`, `busan_attraction`, `busan_shopping`, `busan_food`로 확인한다. AI-Hub 이름+좌표 직접 매칭은 개인 체류 근거로 보존하고, 그 외 장소는 활동 유형별 범위와 조건부 상태를 사용한다.

## 보관만 하는 자료

`archive/현재미사용_참고자료/`은 현재 최종 후보 생성과 앱 추천에서 사용하지 않는 과거 조사·검증 산출물이다. 현재 서비스 동작에는 영향이 없으며, 참고 목적일 때만 사용한다.

## 이전 파이프라인 산출물 (철회·보관)

`부산_최종매칭장소.json`, `부산_최종미매칭장소.json`, `카테고리별_체류시간.json`과 루트의 `부산_매칭장소.json`, `부산_미매칭_TourAPI장소.json`, `부산_제외_*.json`은 과거 TourAPI 중심 파이프라인 자료다. 넓은 관광·업종 카테고리와 카테고리 중앙값만으로 자투리 활동을 설명하기 어려워 런타임 입력에서 철회했다. 비교·재생성·감사 목적만으로 보관한다.
