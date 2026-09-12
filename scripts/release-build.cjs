// Public-only local build entry. Never rewrites the user's internal .env files.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const disabled = ['RECOMMENDATION_DIAGNOSTICS', 'RECOMMENDATION_INTERNAL_B12', 'C_VALIDATION_INTERNAL', 'CAPTCHA_DIAGNOSTICS'];
const clients = ['SUPABASE_URL', 'SUPABASE_KEY', 'CAPTCHA_CHALLENGE_URL', 'KAKAO_JAVASCRIPT_API_KEY', 'KAKAO_REST_API_KEY', 'TMAP_APP_KEY', 'TOURAPI_KEY'];
const allowed = new Set([...clients, ...disabled, 'ROUTE_PROXY_ENABLED'].map(key => `EXPO_PUBLIC_${key}`));
function assertNoRetiredPublicKey(input) {
  // Check presence only: never read or echo a retired credential's value.
  if (Object.prototype.hasOwnProperty.call(input, 'EXPO_PUBLIC_ODSAY_API_KEY')) throw Error('forbidden_public_variable:EXPO_PUBLIC_ODSAY_API_KEY');
}
function publicEnvironment(input) {
  assertNoRetiredPublicKey(input);
  const env = { ...input };
  for (const key of Object.keys(env)) {
    if (key.startsWith('EXPO_PUBLIC_')) {
      if (!allowed.has(key)) throw Error('unreviewed_public_variable');
    } else if (/SECRET|TOKEN|PASSWORD|DATABASE_URL|(?:^|_)KEY$|(?:^|_)KEY_/.test(key)) {
      delete env[key];
    }
  }
  for (const key of disabled) env[`EXPO_PUBLIC_${key}`] = 'false';
  for (const key of ['SUPABASE_URL', 'CAPTCHA_CHALLENGE_URL']) {
    let url;
    try { url = new URL(env[`EXPO_PUBLIC_${key}`]); } catch { throw Error('public_https_endpoint_required'); }
    if (url.protocol !== 'https:' || url.username || url.password || /localhost|\.local$|^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^\[/.test(url.hostname)) throw Error('public_https_endpoint_required');
  }
  const key = env.EXPO_PUBLIC_SUPABASE_KEY || '';
  let anon = false;
  try { anon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
  if (!key.startsWith('sb_publishable_') && !anon) throw Error('public_supabase_key_required');
  if (!env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY) throw Error('public_map_key_required');
  Object.assign(env, { NODE_ENV: 'production', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_ROUTE_PROXY_ENABLED: 'true', TIMEFIT_BUILD_PROFILE: 'public' });
  delete env.EXPO_NO_CLIENT_ENV_VARS;
  delete env.SKIP_BUNDLING;
  return env;
}
function loadInputs() {
  const { parse } = require('dotenv');
  let input = {};
  for (const file of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    const filename = path.join(root, file);
    if (fs.existsSync(filename)) Object.assign(input, parse(fs.readFileSync(filename)));
  }
  return { ...input, ...process.env };
}
function buildCommand(action, archivePath = '/private/tmp/timefit-public-native02.xcarchive') {
  if (action === 'archive' && (!path.isAbsolute(archivePath) || !archivePath.endsWith('.xcarchive'))) throw Error('absolute_xcarchive_path_required');
  const commands = {
    prebuild: ['npx', ['expo', 'prebuild', '--platform', 'ios', '--no-install']],
    export: ['npx', ['expo', 'export', '--platform', 'ios', '--output-dir', '/private/tmp/timefit-public-export']],
    build: ['xcodebuild', ['-workspace', 'ios/mobile.xcworkspace', '-scheme', 'mobile', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-derivedDataPath', '/private/tmp/timefit-public-release', 'build']],
    archive: ['xcodebuild', ['-workspace', 'ios/mobile.xcworkspace', '-scheme', 'mobile', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-derivedDataPath', '/private/tmp/timefit-public-release', '-archivePath', archivePath, 'archive']],
  };
  if (!commands[action]) throw Error('use_check_prebuild_export_build_or_archive');
  return commands[action];
}
function assertPublicNativeEnvironment(env) {
  assertNoRetiredPublicKey(env);
  const valid = env.TIMEFIT_BUILD_PROFILE === 'public' && env.NODE_ENV === 'production' && env.EXPO_NO_DOTENV === '1'
    && env.EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true' && !env.SKIP_BUNDLING && !env.EXPO_NO_CLIENT_ENV_VARS
    && disabled.every(key => env[`EXPO_PUBLIC_${key}`] === 'false');
  if (!valid) throw Error('public_native_environment_changed');
}
function run() {
  const action = process.argv[2];
  if (action === 'assert-native') { assertPublicNativeEnvironment(process.env); console.log('public_native_environment_verified'); return; }
  const env = publicEnvironment(loadInputs());
  if (action === 'check') { console.log('public_build_input_valid; internal_flags=off; route_proxy=on; values=redacted'); return; }
  if (process.argv.length > (action === 'archive' ? 4 : 3)) throw Error('unsupported_build_arguments');
  const command = buildCommand(action, process.argv[3]);
  if (action === 'archive' && fs.existsSync(command[1][command[1].indexOf('-archivePath') + 1])) throw Error('archive_path_already_exists_preserve_previous_artifact');
  const result = spawnSync(command[0], command[1], { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw Error('public_build_spawn_failed');
  process.exitCode = result.status ?? 1;
}
module.exports = { publicEnvironment, loadInputs, buildCommand, assertPublicNativeEnvironment };
if (require.main === module) {
  try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
