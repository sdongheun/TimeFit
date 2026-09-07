import {useEffect,useRef,useState} from 'react';
import {Text,TextInput,View,StyleSheet} from 'react-native';
import {accountSessionFor} from './authStateModel';
import {useAuth} from './AuthContext';
import {createCValidationControls} from './cValidationControls';
import {AnimatedPressable as Pressable} from './AnimatedPressable';
import {C} from './theme';

export const cValidationInternalEnabled=()=>process.env.EXPO_PUBLIC_C_VALIDATION_INTERNAL==='true';

export function CValidationPanel(){
  const auth=useAuth();
  const currentOwner=useRef<string|null>(null);
  currentOwner.current=auth.authKind==='account'?auth.accountSession?.user.id??null:null;
  const controls=useRef<ReturnType<typeof createCValidationControls>|null>(null);
  const [view,setView]=useState<ReturnType<ReturnType<typeof createCValidationControls>['state']>|null>(null);
  const [receipt,setReceipt]=useState('');
  const [panelFailure,setPanelFailure]=useState<string|null>(null);
  useEffect(()=>{
    if(!cValidationInternalEnabled())return;
    // Keep native/runner dependencies inert in normal release builds and screen fixtures.
    const {uuid}=require('expo-modules-core') as typeof import('expo-modules-core');
    const {createAppCValidationRunner}=require('../services/cValidationSupabase') as typeof import('../services/cValidationSupabase');
    const {supabase}=require('../services/supabase') as typeof import('../services/supabase');
    let mounted=true;
    const control=createCValidationControls({currentOwner:()=>currentOwner.current,createExecutionId:()=>uuid.v4(),createRunner:createAppCValidationRunner,
      subscribeAuth(listener){const {data}=supabase.auth.onAuthStateChange((event,session)=>{
        // Read event owner synchronously, before React can batch A -> B -> A renders.
        const next=event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY'?null:accountSessionFor(session,false)?.user.id??null;
        const invalidate=next!==currentOwner.current||event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY';
        currentOwner.current=next;listener(next);
        if(mounted){if(invalidate)setReceipt('');setView(controls.current?.state()??null);}
      });return()=>data.subscription.unsubscribe();},
    });
    controls.current=control;setView(control.state());
    const timer=setInterval(()=>{if(mounted)setView(control.state());},300);
    return()=>{mounted=false;clearInterval(timer);controls.current=null;void control.dispose();};
  },[]);
  if(!cValidationInternalEnabled())return null;
  const act=async(action:'prepare'|'run'|'stop')=>{
    const control=controls.current;if(!control){setPanelFailure('controller_unavailable');return;}
    setPanelFailure(null);
    if(action==='run')control.recordUiStage('button_entered');
    const pending=action==='run'?control.run(receipt):control[action]();
    if(action==='run'&&control.state().started)setReceipt('');
    setView(control.state());await pending;
    if(controls.current===control){if(action==='run')control.recordUiStage('result_displayed');setView(control.state());}
  };
  return <View testID="c-validation-panel" style={s.box}>
    <Text style={s.title}>내부 개발 · C 검증</Text>
    <Text style={s.text}>이전 실행 ID는 재사용하지 않습니다. 현재 계정 확인 후 준비 버튼을 누를 때만 새 ID를 생성합니다. 결과를 확인하기 전에 새로고침하지 마세요. 결과는 이 화면의 메모리에만 유지됩니다.</Text>
    <Text style={s.text}>실제 방문이 아닌 합성 완료·표본 최대 3건을 현재 계정에 저장합니다. DB 기준선 확인 후에만 실행하세요. 기존 코스와 실시간 현황은 변경하지 않습니다.</Text>
    <Text style={s.text}>{auth.authKind==='account'?`확인할 계정: ${auth.accountSession?.user.email??'현재 일반 계정'}`:'일반 계정으로 로그인해 주세요.'}</Text>
    <Pressable testID="c-confirm-owner" style={s.button} disabled={!currentOwner.current||view?.status!=='idle'} onPress={()=>{controls.current?.confirmOwner();setView(controls.current?.state()??null);}}><Text style={s.text}>현재 계정 확인</Text></Pressable>
    <Pressable testID="c-prepare" style={s.button} disabled={!view||view.status==='idle'||view.closed||view.busy||view.started||!currentOwner.current} onPress={()=>void act('prepare')}><Text style={s.text}>서버 인증·동의·기준선 준비 조회</Text></Pressable>
    {view?.status==='consent_required'?<Text style={s.text}>위 맞춤 추천 설정에서 직접 동의를 켠 뒤 준비 조회를 다시 눌러 주세요. 동의를 자동 변경하지 않습니다.</Text>:null}
    {view?.plan?<>
      <Text style={s.text}>DB 담당에게 아래 계획을 보호된 로컬 경로로 전달하세요. 공개 로그·채팅에 올리지 마세요. 5분이 지나면 쓰기 전에 다시 준비하고 새 receipt를 받으세요.</Text>
      <Text testID="c-plan" selectable style={s.text}>{JSON.stringify(view.plan)}</Text>
      <TextInput testID="c-receipt" accessibilityLabel="DB 기준선 확인 receipt" secureTextEntry autoCorrect={false} autoCapitalize="none" maxLength={4000} style={s.input} value={receipt} editable={!view.busy&&!view.started} onChangeText={setReceipt} placeholder="DB가 발급한 receipt만 입력" placeholderTextColor={C.muted}/>
      <Pressable testID="c-run" style={s.button} disabled={view.busy||view.started||!receipt} onPress={()=>void act('run')}><Text style={s.text}>C runner 1회 실행</Text></Pressable>
    </>:null}
    <Text testID="c-status" selectable accessibilityLiveRegion="polite" style={s.text}>{JSON.stringify({status:view?.status,reason:view?.reason,rejectionReason:view?.rejectionReason,panelFailure,trace:view?.trace,progress:view?.progress,cleanup:view?.cleanupStatus,report:view?.report})}</Text>
    <Text style={s.text}>실행 가능 상태: {view?.closed?'closed':view?.busy?'busy':view?.started?'already_started':!view?.plan?'not_prepared':!receipt?'receipt_required':'ready'}</Text>
    <Text style={s.text}>연결 완료나 verified는 C 최종 통과가 아닙니다. cleanup_pending이면 관리자 정리를 진행하지 마세요. 정리는 DB 담당만 수행합니다.</Text>
    <Pressable testID="c-stop" style={s.button} onPress={()=>void act('stop')}><Text style={s.text}>중단 · 격리 저장소 종료 상태 확인</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({box:{padding:16,gap:12,borderWidth:1,borderColor:C.line,borderRadius:12},title:{color:C.txt,fontSize:16,fontWeight:'700'},text:{color:C.txt,fontSize:13,lineHeight:19},button:{minHeight:44,padding:12,backgroundColor:C.panel2,borderRadius:12},input:{minHeight:44,color:C.txt,borderWidth:1,borderColor:C.line,padding:10}});
