import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { PlacePicker } from './PlacePicker';
import { MapPlacePicker } from './MapPlacePicker';
import { createKakaoLocationLabelAdapter } from '../services/kakaoLocationLabelAdapter';
import { manualReselectionResult, type ManualReselection } from './manualLocationRestoreModel';
import { C } from './theme';
const DEFAULT_VIEW = { lat: 35.1578, lon: 129.0594 };
type Props = { origin: {lat:number;lon:number}; destination: {lat:number;lon:number}|null; endsAtMs: number; titles: readonly string[]; onCancel():void; onConfirm(origin:ManualReselection,destination:ManualReselection):boolean|Promise<boolean> };

/** No course map, route effects or pending handoff child mounts until this boundary is satisfied. */
export function ManualLocationRestoreGate(props: Props) {
  const insets=useSafeAreaInsets();
  const [origin,setOrigin]=useState<ManualReselection|null>(null),[destination,setDestination]=useState<ManualReselection|null>(null);
  const [target,setTarget]=useState<'origin'|'destination'|null>(null),[map,setMap]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const lock=useRef(false), generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);
  const adapter=useRef(createKakaoLocationLabelAdapter()).current;
  const select=(point:ManualReselection)=>{if(!target || !['provider','map'].includes(point.source))return; if(target==='origin')setOrigin(point);else setDestination(point);setTarget(null);setMap(false);setMessage('');};
  const submit=async()=>{
    if(lock.current)return;
    const status=manualReselectionResult(props,origin,destination,props.endsAtMs,Date.now());
    if(status!=='ready'){setMessage(status==='missing'?'출발지와 최종 목적지를 각각 선택해 주세요.':status==='expired'?'기존 코스의 시간을 확인할 수 없거나 종료시각이 지났어요. 코스는 보존되며, 메인에서 새 시간으로 설정할 수 있어요.':'선택한 위치가 기존 코스와 달라 경로를 다시 검증해야 해요. 기존 진행은 보존되며, 이 경로는 실행하지 않아요.');return;}
    const token=++generation.current;lock.current=true;setBusy(true);
    try { const ok=await props.onConfirm(origin!,destination!);if(token===generation.current&&!ok)setMessage('코스가 변경되어 이어갈 수 없어요. 기존 진행은 보존됩니다.'); }
    catch {if(token===generation.current)setMessage('확인 내용을 적용하지 못했어요. 기존 진행은 보존됩니다. 다시 시도해 주세요.');}
    finally {if(token===generation.current){lock.current=false;setBusy(false);}}
  };
  return <View testID="manual-restore-gate" style={[s.root,{paddingTop:insets.top+16}]}><ScrollView contentContainerStyle={s.content}>
    <Text style={s.title}>장소를 다시 선택해 주세요</Text><Text style={s.copy}>이전 버전에서 시작한 코스예요. 진행과 기록은 그대로 보존돼요. 지도와 길찾기를 사용하기 전에 출발지와 최종 목적지를 검색하거나 지도에서 선택해 주세요.</Text>
    {props.titles.map((title,index)=><Text key={index} style={s.copy}>{title}</Text>)}
    <Pressable testID="restore-origin" style={s.button} disabled={busy} onPress={()=>setTarget('origin')}><Text style={s.text}>{origin?.label ?? '출발지 검색·지도 선택'}</Text></Pressable>
    <Pressable testID="restore-destination" style={s.button} disabled={busy} onPress={()=>setTarget('destination')}><Text style={s.text}>{destination?.label ?? (props.destination?'최종 목적지 검색·지도 선택':'돌아올 최종 목적지 검색·지도 선택')}</Text></Pressable>
    {message?<Text testID="restore-error" accessibilityRole="alert" style={s.copy}>{message}</Text>:null}
    <Pressable testID="restore-submit" disabled={busy||!origin||!destination} style={[s.button,s.primary]} onPress={()=>void submit()}><Text style={s.text}>{busy?'확인 중…':'선택한 장소로 이어가기'}</Text></Pressable>
    <Pressable testID="restore-cancel" disabled={busy} style={s.button} onPress={()=>{generation.current++;props.onCancel();}}><Text style={s.text}>나중에 하기</Text></Pressable>
  </ScrollView>
  {target&&!map?<PlacePicker key={target} visible title={target==='origin'?'출발지 선택':'최종 목적지 선택'} center={DEFAULT_VIEW} onClose={()=>setTarget(null)} onOpenMap={()=>setMap(true)} onConfirm={p=>{if(p.source==='provider')select({...p,source:'provider'});}}/>:null}
  {target&&map?<MapPlacePicker visible title={target==='origin'?'출발지 선택':'최종 목적지 선택'} center={DEFAULT_VIEW} labelAdapter={adapter} onClose={()=>setMap(false)} onConfirm={p=>select({...p.point,label:p.label,source:'map'})}/>:null}
  </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},content:{padding:20,gap:18},title:{color:C.txt,fontSize:24,fontWeight:'800'},copy:{color:C.txt2,fontSize:15,lineHeight:23},button:{minHeight:52,padding:14,borderRadius:14,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},primary:{backgroundColor:C.accent},text:{color:C.txt,fontSize:16,fontWeight:'700',textAlign:'center'}});
