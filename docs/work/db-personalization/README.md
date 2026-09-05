# DB·개인화 현재 작업

새 작업 전에는 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/04_backend/데이터베이스설계.md`와 해당 현재 묶음만 읽는다.

- [DB-COMPLETION-RECORD-01 — 후기와 분리한 로컬 코스 완료 기록](course-completion-record.md): **구현 완료·자동 게이트 통과.** 명시 `코스 마치기`의 멱등 로컬 완료 repository와 legacy 후기 호환 read model을 구현했고 집중 13/13 및 Foundation 자동 게이트를 통과했다. 다음 UI consumer는 `U-COMPLETION-HISTORY-01`이며 App Group 복구와 서버 체류 표본은 후속이다. Supabase migration은 추가하지 않았다.
- [DB-1 — V1 검증 코스 저장 계약](verified-course-storage.md)
- [DB-DWELL-01 — 사용자 확인 체류 표본·동의·개인화 프로필 저장](live-activity-dwell-storage.md): **진행 예정.** 일반 로그인+별도 동의+명시 도착/출발 완료만 저장하며 GPS·anonymous Auth·미완료 표본은 제외한다. `2-AB`와 병렬 가능하고 원격 migration 적용은 별도 게이트다.
- [DB-ROUTE-GEOMETRY-01 — 공개 구간 형상 캐시 보존](route-geometry-cache.md): **운영 적용 완료·수락.** `202609030014`가 local/remote migration 이력에 모두 존재하며 전체 이력이 일치함을 통합 세션이 재확인했다. private 위치 저장·cache 삭제·Kakao 호출은 수행하지 않았다.

- [Route cache·익명 보관 경계](route-cache-and-privacy.md)

B12 internal 비교는 DB schema·RLS·저장 payload를 변경하지 않는다.

과거 세부 기록은 [archive/2026-08-history.md](archive/2026-08-history.md)에 보존한다.
