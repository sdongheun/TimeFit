import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { approvedPlacePhoto, type ApprovedPlacePhoto, type PlacePhotoInput } from './placePhotoModel';
import { C } from './theme';

export const PHOTO_LOAD_TIMEOUT_MS = 12000;
export function PlacePhoto({ place, style, fallback, testID }: {place: PlacePhotoInput; style?: StyleProp<ViewStyle>; fallback: ReactNode; testID?: string}) {
  const photo = approvedPlacePhoto(place);
  return <View testID={testID} style={[s.frame, style]}>{photo
    ? <PhotoRequest key={`${photo.url}:${photo.licenseUrl}:${photo.attribution}`} photo={photo} fallback={fallback} />
    : fallback}</View>;
}
function PhotoRequest({ photo, fallback }: {photo: ApprovedPlacePhoto; fallback: ReactNode}) {
  const [state, setState] = useState<'loading'|'loaded'|'failed'>('loading');
  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => setState('failed'), PHOTO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state]);
  return <>
    {state !== 'loaded' ? fallback : null}
    {state !== 'failed' ? <Image testID="approved-place-photo" accessibilityLabel={photo.attribution} source={{uri:photo.url}} resizeMode="cover" style={[{position:'absolute',top:0,right:0,bottom:0,left:0}, {opacity: state === 'loaded' ? 1 : 0}]} onLoad={() => setState(current => current === 'loading' ? 'loaded' : current)} onError={() => setState('failed')} /> : null}
  </>;
}
/** 사용자가 볼 수 있는 출처·이용조건. 접근성 label만으로 대체하지 않는다. */
export function PlacePhotoCredit({ place, links = false }: {place: PlacePhotoInput; links?: boolean}) {
  const photo = approvedPlacePhoto(place);
  const [error, setError] = useState(false);
  if (!photo) return null;
  const open = async (url: string) => { try { await Linking.openURL(url); setError(false); } catch { setError(true); } };
  return <View testID="place-photo-credit">
    <Text style={s.credit}>{photo.attribution} · {photo.licenseName}</Text>
    {links ? <View style={s.links}><Pressable accessibilityRole="link" accessibilityLabel="사진 출처 보기" onPress={() => void open(photo.sourcePageUrl)} style={s.link}><Text style={s.linkText}>사진 출처</Text></Pressable><Pressable accessibilityRole="link" accessibilityLabel="사진 이용조건 보기" onPress={() => void open(photo.licenseUrl)} style={s.link}><Text style={s.linkText}>이용조건</Text></Pressable></View> : null}
    {error ? <Text accessibilityRole="alert" style={s.credit}>링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.</Text> : null}
  </View>;
}
const s = StyleSheet.create({frame:{flex:1,overflow:'hidden'},credit:{color:C.muted,fontSize:11,lineHeight:16},links:{flexDirection:'row',gap:16},link:{minHeight:44,justifyContent:'center'},linkText:{color:C.accent,fontSize:12}});
