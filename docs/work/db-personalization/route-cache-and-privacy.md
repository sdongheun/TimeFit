# DB route cache·익명 개인정보 경계

## 범위

`DB-RP-*`, `DB-PRIV-*`: 공개 POI 구간 cache/lease·provider 예산과 익명 사용자 정리/RLS를 분리했다.

## 유지 계약

- 공개 route cache는 방향·mode·catalog version 기준의 최소 결과만 저장한다.
- cache/lease/budget RPC는 service role만 실행하며 anon/authenticated 직접 접근을 막는다.
- anonymous Auth는 profile을 만들지 않으며, 30일 비활성 후보도 서버 재검증 뒤에만 정리한다.

## 상세 이력

[2026-08 archive](archive/2026-08-history.md)
