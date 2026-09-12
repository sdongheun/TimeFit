import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
function validate({width,height,format,alpha,profile}) {
  assert.equal(width,1024);assert.equal(height,1024);assert.equal(format,'png');assert.equal(alpha,'no');assert.match(profile,/sRGB/);
}
test('ICON rejects wrong dimensions, alpha and non-sRGB fixtures',()=>{
  const good={width:1024,height:1024,format:'png',alpha:'no',profile:'sRGB IEC61966-2.1'};
  validate(good);
  for(const bad of [{width:1254},{height:512},{format:'jpeg'},{alpha:'yes'},{profile:'Display P3'}]) assert.throws(()=>validate({...good,...bad}));
});
test('ICON approved asset is the Expo consumer and is opaque 1024 sRGB PNG',()=>{
  const {expo}=JSON.parse(fs.readFileSync('app.json','utf8'));
  assert.equal(expo.icon,'./assets/jjaturi-icon-blue.png');assert.equal(expo.ios.icon,undefined);
  assert.equal(expo.name,'mobile');assert.equal(expo.slug,'mobile');assert.equal(expo.scheme,'timefit');assert.equal(expo.version,'1.0.0');assert.equal(expo.ios.buildNumber,'1');
  assert.equal(expo.ios.bundleIdentifier,'com.dongheun.mobile');assert.equal(expo.ios.supportsTablet,false);
  const file=expo.icon;assert.ok(fs.existsSync(file));
  const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const info=execFileSync('sips',['-g','hasAlpha','-g','profile',file],{encoding:'utf8'});
  validate({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),format:'png',alpha:info.match(/hasAlpha: (.+)/)[1],profile:info.match(/profile: (.+)/)[1]});
});
