# 역할별 현재 작업 안내

`docs/work/`은 새 작업 세션이 읽는 **짧은 현재 작업 공간**이다. 역할별 `archive/`는 감사·결정 이력을 보존하는 append-only 기록이므로, 현재 작업에 직접 연결되지 않은 과거 구간을 처음부터 읽지 않는다.

## 읽는 순서

1. 저장소 루트 `AGENTS.md`와 `docs/README.md`
2. `docs/작업조정_보드.md`에서 자신의 활성 작업 ID
3. 이 폴더의 역할 `README.md`
4. 그 README가 가리키는 현재 작업 파일 및 역할 기준 문서

완료된 작업은 역할별 archive에 요약·수락 근거를 남긴다. 새 세션의 상세 명령은 같은 목표와 의존성을 공유하는 작업 묶음 파일 하나에만 쓴다. 작업마다 파일을 기계적으로 늘리지 않는다. 동일 제품 영역의 후속은 기존 묶음을 갱신하고, 공개 계약·선행 조건이 달라질 때만 새 묶음을 만든다.

## 역할 폴더

- [통합·결정](integration-decision/README.md)
- [추천 엔진](recommendation-engine/README.md)
- [UIUX](uiux/README.md)
- [외부 API](external-api/README.md)
- [데이터 정제](data-curation/README.md)
- [DB·개인화](db-personalization/README.md)
- [QA·출시](qa-release/README.md)
