// package.json의 `node --test test` 진입점. Node 기본 러너가 디렉터리를
// 직접 모듈로 해석하지 못하므로, TypeScript loader를 가진 표준 탐색으로 넘긴다.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

if (process.env.TIMEFIT_TEST_DISCOVERY === '1') {
  test('TypeScript loader로 발견된 전체 테스트 경계', () => {});
} else {
  test('전체 테스트 발견 경계는 TypeScript loader를 사용한다', () => {
    const env = { ...process.env, TIMEFIT_TEST_DISCOVERY: '1' };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test'], { cwd: process.cwd(), encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr || result.stdout || '발견된 테스트 중 실패가 있습니다.');
  });
}
