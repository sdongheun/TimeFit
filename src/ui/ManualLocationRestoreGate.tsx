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
    if(status!=='ready'){setMessage(status==='missing'?'출발지와 마지막 도착지를 각각 선택해 주세요.':status==='expired'?'기존 코스의 시간이 지났어요. 코스는 그대로 유지되며, 메인에서 새 시간을 설정할 수 있어요.':'선택한 장소가 기존 코스와 달라요. 기존 코스는 그대로 유지되며, 새 장소로 이용하려면 메인에서 코스를 다시 만들어 주세요.');return;}
    const token=++generation.current;lock.current=true;setBusy(true);
    try { const ok=await props.onConfirm(origin!,destination!);if(token===generation.current&&!ok)setMessage('코스가 변경되어 이어갈 수 없어요. 기존 진행은 보존됩니다.'); }
    catch {if(token===generation.current)setMessage('확인 내용을 적용하지 못했어요. 기존 진행은 보존됩니다. 다시 시도해 주세요.');}
    finally {if(token===generation.current){lock.current=false;setBusy(false);}}
  };
  return <View testID="manual-restore-gate" style={[s.root,{paddingTop:insets.top+16}]}><ScrollView contentContainerStyle={s.content}>
    <Text style={s.title}>장소를 다시 확인해 주세요</Text><Text style={s.copy}>예전에 만든 코스는 출발지와 마지막 도착지를 한 번씩 다시 선택해야 이어갈 수 있어요. 진행과 기록은 그대로 유지돼요.</Text>
    {props.titles.length?<View style={s.course}><Text style={s.fieldLabel}>코스 장소</Text><Text style={s.courseText}>{props.titles.join(' · ')}</Text></View>:null}
    <Pressable testID="restore-origin" accessibilityLabel={`출발지, ${origin?.label??'검색 또는 지도 선택'}`} style={s.button} disabled={busy} onPress={()=>setTarget('origin')}><Text style={s.fieldLabel}>출발지</Text><Text style={s.value}>{origin?.label ?? '검색 또는 지도 선택'}</Text><Text style={s.arrow}>›</Text></Pressable>
    <Pressable testID="restore-destination" accessibilityLabel={`마지막 도착지, ${destination?.label??'검색 또는 지도 선택'}`} style={s.button} disabled={busy} onPress={()=>setTarget('destination')}><Text style={s.fieldLabel}>마지막 도착지</Text><Text style={s.value}>{destination?.label ?? '검색 또는 지도 선택'}</Text><Text style={s.arrow}>›</Text></Pressable>
    {message?<Text testID="restore-error" accessibilityRole="alert" style={s.copy}>{message}</Text>:null}
    <Pressable testID="restore-submit" disabled={busy||!origin||!destination} style={[s.action,s.primary]} onPress={()=>void submit()}><Text style={s.text}>{busy?'확인 중…':'이 코스 이어가기'}</Text></Pressable>
    <Pressable testID="restore-cancel" disabled={busy} style={s.action} onPress={()=>{generation.current++;props.onCancel();}}><Text style={s.text}>나중에 확인</Text></Pressable>
  </ScrollView>
  {target&&!map?<PlacePicker key={target} visible title={target==='origin'?'출발지 선택':'마지막 도착지 선택'} center={DEFAULT_VIEW} onClose={()=>setTarget(null)} onOpenMap={()=>setMap(true)} onConfirm={p=>{if(p.source==='provider')select({...p,source:'provider'});}}/>:null}
  {target&&map?<MapPlacePicker visible title={target==='origin'?'출발지 선택':'마지막 도착지 선택'} center={DEFAULT_VIEW} labelAdapter={adapter} onClose={()=>setMap(false)} onConfirm={p=>select({...p.point,label:p.label,source:'map'})}/>:null}
  </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},content:{padding:20,gap:16},title:{color:C.txt,fontSize:24,fontWeight:'800'},copy:{color:C.txt2,fontSize:15,lineHeight:23},course:{padding:14,borderRadius:12,backgroundColor:C.panel},courseText:{color:C.txt,fontSize:15,fontWeight:'700',marginTop:5},button:{minHeight:56,paddingHorizontal:14,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,flexDirection:'row',alignItems:'center',gap:10},fieldLabel:{color:C.muted,fontSize:12,fontWeight:'700'},value:{flex:1,color:C.txt,fontSize:15,fontWeight:'800'},arrow:{color:C.muted,fontSize:22},action:{minHeight:52,padding:14,borderRadius:14,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},primary:{backgroundColor:C.accent,borderColor:C.accent},text:{color:C.txt,fontSize:16,fontWeight:'700',textAlign:'center'}});
