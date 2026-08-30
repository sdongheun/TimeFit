# UIUX 추천 결과·내부 진단

## 범위

`U-1-REC-01`, `U-1-REC-DIAG-01`: v1 결과를 표시하고 internal build에서만 tier·attempt·화면/엔진 코스 수를 읽기 전용으로 표시하는 워크스트림이다.

## 유지 계약

- 결과 카드·빈 상태는 엔진의 검증 결과만 표시한다. 목록 선택이 새 API 요청을 만들지 않는다.
- diagnostics는 exact internal flag일 때만 보이며 버튼·저장·analytics·network 요청이 없다.
- 현재 B12 조립은 별도 [b12-internal-build](b12-internal-build.md)에서만 한다.

## 상세 이력

[2026-08 archive](archive/2026-08-history.md)
