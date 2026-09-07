import test from 'node:test';
import assert from 'node:assert/strict';
import { screenRuntime } from './support/screenRuntime.mjs';

const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(signIn: (...args:string[])=>Promise<void> = async()=>{}) {
  let authKind='anonymous',returns=0;
  const listeners:Record<string,()=>void>={};
  const runtime=screenRuntime({'./AuthContext':{useAuth:()=>({authKind,signIn,signUp:async()=>false})},'./CaptchaVerificationSheet':{CaptchaVerificationSheet:'Captcha'},'expo-modules-core':{uuid:{v4:()=> 'fixture-id'}},__process:{env:{EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL:'https://captcha.example.test/',EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS:'true'}}});
  const {LoginScreen}=runtime.load('src/ui/LoginScreen.tsx');
  const screen=runtime.mount(LoginScreen,{navigation:{goBack(){returns++;},addListener(name:string,fn:()=>void){listeners[name]=fn;return()=>{};}}});
  screen.get('login-email').props.onChangeText('fixture@example.test');
  screen.get('login-password').props.onChangeText('fixture-password');
  return {screen,listeners,captcha:()=>screen.nodes((n:{type:unknown})=>n.type==='Captcha')[0],account(){authKind='account';screen.render();},returns:()=>returns};
}
test('login asks for independent CAPTCHA even with anonymous session, blocks same-tick duplicate and consumes one token', async()=>{
  const calls:string[][]=[];let done!:()=>void;
  const f=fixture(async(...args)=>{calls.push(args);await new Promise<void>(r=>done=r);});
  const submit=f.screen.get('login-submit').props.onPress;submit();submit();
  assert.equal(calls.length,0);assert.equal(f.screen.get('login-mode-signup').props.disabled,true);
  const callbacks=f.captcha().props;
  const verified=callbacks.onVerified;verified('fresh-fixture');verified('duplicate-fixture');callbacks.onClose();
  assert.equal(calls.length,1);assert.equal(calls[0][2],'fresh-fixture');
  assert.equal(f.screen.get('login-submit').props.disabled,true,'stale close cannot unlock an in-flight login');
  assert.equal(f.captcha(),undefined);
  f.account();assert.equal(f.returns(),1);done();await tick();f.screen.unmount();
});
test('production AuthProvider forwards captcha options and preserves safe SDK errors, never invoking anonymous auth', async()=>{
  const calls:any[]=[];
  const runtime=screenRuntime({
    '../services/supabase':{supabase:{auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async(input:any)=>{calls.push(input);return {error:{code:'captcha_failed',status:400,message:'raw-private-fixture'}};},signInAnonymously:async()=>{throw Error('anonymous flow must not be called');}}}},
    './personalizationComposition':{personalizationSession:{setAccount(){}}},
    './liveActivity/learningEvidenceComposition':{liveLearningEvidence:{clearInvalidatedNative:async()=>{}}},
  });
  Object.assign(runtime.react,{createContext:()=>({Provider:'AuthProviderValue'})});
  Object.assign(runtime.native.Linking,{getInitialURL:async()=>null,addEventListener:()=>({remove(){}})});
  const {AuthProvider}=runtime.load('src/ui/AuthContext.tsx');
  const screen=runtime.mount(AuthProvider,{});await tick();
  const auth=screen.nodes((n:{type:unknown})=>n.type==='AuthProviderValue')[0].props.value;
  await assert.rejects(()=>auth.signIn('fixture@example.test','fixture-password','fresh-fixture'),(error:any)=>error.code==='captcha_failed'&&error.status===400&&!JSON.stringify(error).includes('raw-private-fixture'));
  assert.equal(calls.length,1);assert.deepEqual(calls[0].options,{captchaToken:'fresh-fixture'});
  await assert.rejects(()=>auth.signIn('fixture@example.test','fixture-password'));assert.equal(calls.length,1);
  screen.unmount();
});
test('cancel/blur rejects late token; failure requires a new explicit challenge', async()=>{
  let calls=0;
  const f=fixture(async()=>{calls++;throw {code:'captcha_failed',status:400,message:'private-fixture'};});
  f.screen.press('login-submit');const old=f.captcha().props;
  old.onClose();old.onVerified('cancelled-fixture');assert.equal(calls,0);
  f.screen.press('login-submit');f.captcha().props.onVerified('expired-fixture');await tick();
  assert.equal(calls,1);assert.equal(f.captcha(),undefined);
  assert.match(f.screen.get('login-error').props.children,/안전 확인/);
  const diagnostic=f.screen.get('login-diagnostic').props.children;
  assert.match(diagnostic,/captcha_failed/);assert.doesNotMatch(diagnostic,/private-fixture|expired-fixture|fixture-password|fixture@example/);
  f.screen.press('login-submit');const late=f.captcha().props.onVerified;f.listeners.blur();late('late-fixture');assert.equal(calls,1);f.screen.unmount();
});
for(const [error,copy] of [[{code:'invalid_credentials',status:400},'이메일 또는 비밀번호'],[{code:'email_not_confirmed',status:400},'인증을 완료'],[{name:'AuthRetryableFetchError',status:0},'네트워크'],[{code:'unexpected_failure',status:500},'서버']] as const) test(`login maps ${copy} without generic-error collapse`,async()=>{
  const f=fixture(async()=>{throw error;});f.screen.press('login-submit');f.captcha().props.onVerified('fresh-fixture');await tick();
  assert.ok(f.screen.get('login-error').props.children.includes(copy));assert.equal(f.screen.get('login-submit').props.disabled,false);f.screen.unmount();
});
test('real CAPTCHA sheet consumes once, rejects cancelled/stale/expired attempts and retries only by user action',()=>{
  let verified=0,closed=0;
  const runtime=screenRuntime({'react-native-webview':{WebView:'WebView'}});
  const {CaptchaVerificationSheet}=runtime.load('src/ui/CaptchaVerificationSheet.tsx');
  const screen=runtime.mount(CaptchaVerificationSheet,{visible:true,challengeUrl:'https://captcha.example.test/',purpose:'login',onVerified(){verified++;},onClose(){closed++;}});
  const message=(type:string,token?:string)=>({nativeEvent:{url:'https://captcha.example.test/',data:JSON.stringify({type,token})}});
  const web=()=>screen.get('captcha-webview').props;
  const old=web();old.onMessage(message('error')); // Worker expired-callback uses the same error message.
  old.onMessage(message('token','expired-fixture'));assert.equal(verified,0);screen.get('captcha-error');
  screen.press('captcha-retry');old.onMessage(message('token','stale-fixture'));assert.equal(verified,0);
  const current=web();current.onMessage(message('token','fresh-fixture'));current.onMessage(message('token','duplicate-fixture'));assert.equal(verified,1);
  screen.unmount();current.onMessage(message('token','unmounted-fixture'));assert.equal(verified,1);
  const next=runtime.mount(CaptchaVerificationSheet,{visible:true,challengeUrl:'https://captcha.example.test/',onVerified(){verified++;},onClose(){closed++;}});
  const callback=next.get('captcha-webview').props.onMessage;callback(message('cancelled'));callback(message('token','cancelled-fixture'));assert.equal(closed,1);assert.equal(verified,1);next.unmount();
});
