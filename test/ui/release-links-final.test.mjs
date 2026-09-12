import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const tick = async () => { for (let i=0;i<30;i++) await Promise.resolve(); };
const docs = ['privacy-policy','terms-of-service'].map(documentId => ({documentId,documentVersion:'1.0',url:`https://registry.example.test/${documentId}`}));
for (const scenario of ['ok','open_failed','missing','unavailable','stale','refresh_failed','refresh_throws']) test(`LINKS signup ${scenario} uses registry and fails closed`, async()=>{
  const calls=[],opened=[]; let reads=0;
  const host=screenRuntime({'./AuthContext':{useAuth:()=>({authKind:'guest',signUp:async x=>{calls.push(x);return false;}})},'./CaptchaVerificationSheet':{CaptchaVerificationSheet:'Captcha'},'expo-modules-core':{uuid:{v4:()=> 'fixture-id'}}});
  host.native.Linking.openURL=async url=>{opened.push(url);if(scenario==='open_failed')throw Error('fixture');};
  const readDocuments=async()=>{
    reads++;
    if(scenario==='refresh_throws'&&reads>1)throw Error('fixture-read');
    if(scenario==='missing')return {status:'not_configured',documents:[]};
    if(scenario==='unavailable'||(scenario==='refresh_failed'&&reads>1))return {status:'unavailable',documents:[]};
    return {status:'ok',documents:scenario==='stale'&&reads>1?docs.map(d=>({...d,documentVersion:'2.0'})):docs};
  };
  const screen=host.mount(host.load('src/ui/LoginScreen.tsx').LoginScreen,{navigation:{goBack(){},addListener:()=>()=>{}},readDocuments});
  screen.press('login-mode-signup');screen.render();await tick();
  screen.get('login-email').props.onChangeText('fixture@example.test');screen.get('login-password').props.onChangeText('fixture-password');screen.get('signup-password-confirm').props.onChangeText('fixture-password');
  assert.equal(screen.get('login-submit').props.disabled,true);
  screen.press('signup-age-confirm');
  if(!['missing','unavailable'].includes(scenario))for(const d of docs){await screen.get(`signup-document-${d.documentId}`).props.onPress();await tick();screen.get(`signup-consent-${d.documentId}`).props.onPress();}
  await screen.get('login-submit').props.onPress();await tick();
  screen.nodes(n=>n.type==='Captcha')[0]?.props.onVerified('fresh-fixture');await tick();
  assert.equal(calls.length,scenario==='ok'?1:0);
  if(scenario==='ok'){assert.deepEqual(opened,docs.map(d=>d.url));assert.equal(reads,2);assert.equal(calls[0].requiredConsents.privacy.documentVersion,'1.0');}
  screen.unmount();
});

for(const scenario of ['missing','read_failed','open_failed'])test(`LINKS profile ${scenario} keeps safe retry and never uses fallback registry URL`,async()=>{
  const opened=[];
  const host=screenRuntime({'./mainTabNavigation':{},'./AuthContext':{useAuth:()=>({authKind:'guest'})},'./profileSettingsPort':{readProfilePermissionSnapshot:async()=>({notification:'denied',liveActivity:'denied'})},'./FloatingTabBar':{FloatingTabBar:'Tabs'},'./CValidationRecoveryPanel':{cRecoveryInternalEnabled:()=>false},'./CValidationPanel':{},'./AccountPersonalizationPanel':{}});
  host.native.Linking.openURL=async url=>{opened.push(url);throw Error('fixture-open');};
  const screen=host.mount(host.load('src/ui/ProfileScreen.tsx').ProfileScreen,{navigation:{},readDocuments:async()=>{if(scenario==='read_failed')throw Error('fixture-read');return scenario==='missing'?{status:'not_configured',documents:[]}:{status:'ok',documents:docs};}});
  await screen.get('profile-document-privacy-policy').props.onPress();await tick();
  assert.equal(opened.length,scenario==='open_failed'?1:0);
  assert.ok(screen.nodes(n=>n.type==='Text'&&String(n.props.children).includes('문서를 열지 못했어요')).length);
  assert.ok(screen.get('profile-document-privacy-policy'));screen.unmount();
});

test('LINKS profile exposes registry privacy/terms and approved support without debug UI',async()=>{
  const opened=[];
  const host=screenRuntime({__DEV__:false,__process:{env:{}},'./mainTabNavigation':{},'./AuthContext':{useAuth:()=>({authKind:'guest',accountSession:null})},'./profileSettingsPort':{readProfilePermissionSnapshot:async()=>({notification:'denied',liveActivity:'denied'})},'./FloatingTabBar':{FloatingTabBar:'Tabs'},'./CValidationRecoveryPanel':{cRecoveryInternalEnabled:()=>false},'./CValidationPanel':{},'./AccountPersonalizationPanel':{}});
  host.native.Linking.openURL=async url=>{opened.push(url);};
  const screen=host.mount(host.load('src/ui/ProfileScreen.tsx').ProfileScreen,{navigation:{},readDocuments:async()=>({status:'ok',documents:docs})});await tick();
  for(const id of ['privacy-policy','terms-of-service','support']){await screen.get(`profile-document-${id}`).props.onPress();await tick();}
  assert.deepEqual(opened,[...docs.map(d=>d.url),'https://jjaturi-docs.pages.dev/support/']);
  screen.unmount();
});
