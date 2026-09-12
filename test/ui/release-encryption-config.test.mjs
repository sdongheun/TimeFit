import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
test('API accepted encryption declaration uses Expo boolean and preserves plist security settings',()=>{
  const {expo}=JSON.parse(fs.readFileSync('app.json','utf8'));
  assert.equal(expo.ios.config.usesNonExemptEncryption,false);
  assert.equal(expo.ios.infoPlist.ITSAppUsesNonExemptEncryption,undefined);
  const {setUsesNonExemptEncryption}=require('@expo/config-plugins/build/ios/UsesNonExemptEncryption');
  const prior={CFBundleDisplayName:'짜투리',NSAppTransportSecurity:{NSAllowsArbitraryLoads:false}};
  assert.deepEqual(setUsesNonExemptEncryption(expo,prior),{...prior,ITSAppUsesNonExemptEncryption:false});
});
