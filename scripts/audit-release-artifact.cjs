// Read-only. Emit counts/identity, never credentials, endpoint values or profile data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { loadInputs, publicEnvironment } = require('./release-build.cjs');
function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(root, entry.name);
    return entry.isDirectory() ? files(name) : entry.isFile() ? [name] : [];
  });
}
function plist(filename) {
  const r = spawnSync('plutil', ['-convert', 'json', '-o', '-', filename], { encoding: 'utf8' });
  if (r.status !== 0) throw Error('plist_read_failed');
  return JSON.parse(r.stdout);
}
function audit(root) {
  if (root.endsWith('.xcarchive')) root = path.join(root, 'Products/Applications/mobile.app');
  const input = loadInputs();
  const env = publicEnvironment(input);
  const candidates = [...new Set(Object.entries(input).filter(([key, value]) => !key.startsWith('EXPO_PUBLIC_') && /SECRET|TOKEN|PASSWORD|DATABASE_URL|(?:^|_)KEY$|(?:^|_)KEY_/.test(key) && typeof value === 'string' && value.length >= 8).map(([, value]) => value))];
  const publicValues = Object.entries(env).filter(([key]) => key.startsWith('EXPO_PUBLIC_')).map(([, value]) => value);
  const secrets = candidates.filter(value => !publicValues.includes(value));
  const sharedProviderCredentials = candidates.filter(value => publicValues.includes(value));
  const list = files(root);
  let secretMatches = 0, privateKeyMatches = 0, sharedProviderCredentialMatches = 0;
  for (const file of list) {
    const bytes = fs.readFileSync(file);
    secretMatches += secrets.filter(value => bytes.includes(Buffer.from(value))).length;
    sharedProviderCredentialMatches += sharedProviderCredentials.filter(value => bytes.includes(Buffer.from(value))).length;
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8'))) privateKeyMatches++;
  }
  const bundle = list.find(file => file.endsWith('main.jsbundle')) || list.find(file => file.endsWith('.hbc'));
  if (!bundle) throw Error('bundle_missing');
  const bytes = fs.readFileSync(bundle);
  const publicEndpointPresence = ['SUPABASE_URL', 'CAPTCHA_CHALLENGE_URL'].map(name => ({ name, embedded: bytes.includes(Buffer.from(env[`EXPO_PUBLIC_${name}`])) }));
  const manifests = list.filter(file => file.endsWith('PrivacyInfo.xcprivacy')).map(file => ({ path: path.relative(root, file), reasons: plist(file).NSPrivacyAccessedAPITypes ?? [] }));
  const identities = list.filter(file => file === path.join(root, 'Info.plist') || /PlugIns\/[^/]+\.appex\/Info.plist$/.test(file)).map(file => {
    const p = plist(file);
    return { path: path.relative(root, file), name: p.CFBundleDisplayName, bundle: p.CFBundleIdentifier, version: p.CFBundleShortVersionString, build: p.CFBundleVersion, os: p.MinimumOSVersion, devices: p.UIDeviceFamily, liveActivity: p.NSSupportsLiveActivities, extension: p.NSExtension?.NSExtensionPointIdentifier, backgroundModes: p.UIBackgroundModes ?? [], ats: p.NSAppTransportSecurity ?? null, permissions: Object.keys(p).filter(k => k.endsWith('UsageDescription')) };
  });
  const result = { files: list.length, serverOnlySecretMatches: secretMatches, sharedProviderCredentialMatches, privateKeyMatches, publicEndpointPresence, bundleSHA256: crypto.createHash('sha256').update(bytes).digest('hex'), identities, manifests };
  result.targetPrivacyManifests = identities.map(item => ({ target: item.path, present: fs.existsSync(path.join(root, path.dirname(item.path), 'PrivacyInfo.xcprivacy')) }));
  console.log(JSON.stringify(result, null, 2));
  if (result.targetPrivacyManifests.some(item => !item.present)) process.exitCode = 1;
  if (secretMatches || privateKeyMatches || publicEndpointPresence.some(item => !item.embedded)) process.exitCode = 1;
}
try {
  const root = process.argv[2];
  if (!root || !path.isAbsolute(root)) throw Error('absolute_artifact_path_required');
  audit(root);
} catch { console.error('artifact_audit_failed_without_sensitive_output'); process.exitCode = 1; }
