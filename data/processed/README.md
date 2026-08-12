# 처리 데이터 구조

`src/data/busan_poi_catalog.json`은 아래 최종 후보 파일로 생성한다. 앱은 `data/processed`의 JSON을 직접 읽지 않는다.

## 현재 추천 후보

- `부산_최종매칭장소.json`: AI-Hub와 직접 또는 포괄 맥락으로 매칭되어 개별 체류시간을 사용하는 장소
- `부산_최종미매칭장소.json`: AI-Hub 직접 매칭이 없어 카테고리 체류시간을 사용하는 장소
- `카테고리별_체류시간.json`: AI-Hub 원본에서 계산한 카테고리별 체류시간 통계

## 재정제 근거 원본

- `부산시_명소정보.json`
- `부산시_쇼핑정보.json`
- `부산시_맛집정보.json`

최종 장소의 출처는 각 장소의 `sourceEvidence`에서 `tourapi_aihub`, `tourapi_fallback`, `busan_attraction`, `busan_shopping`, `busan_food`로 확인한다.

## 보관만 하는 자료

`archive/현재미사용_참고자료/`은 현재 최종 후보 생성과 앱 추천에서 사용하지 않는 과거 조사·검증 산출물이다. 현재 서비스 동작에는 영향이 없으며, 참고 목적일 때만 사용한다.

## 이전 파이프라인 산출물

루트의 `부산_매칭장소.json`, `부산_미매칭_TourAPI장소.json`, `부산_제외_*.json`은 이전 TourAPI 중심 파이프라인 자료다. 현재 최종 후보의 입력은 아니며, 연결된 이전 스크립트를 정리하는 시점에 함께 `archive`로 이동하거나 삭제한다.
