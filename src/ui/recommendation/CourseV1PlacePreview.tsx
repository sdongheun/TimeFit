import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { getPlacePreviewKind, type CourseV1DisplayPlace } from './courseV1PlacePreviewModel';

type Props = {
  place: CourseV1DisplayPlace;
  context: string | null;
  stayMin?: number;
  onOpenKakao: (place: CourseV1DisplayPlace) => void;
};

/** 사진 실패 여부와 무관하게 제목·맥락·카카오 행동을 동일하게 보이는 stop 미리보기다. */
export function CourseV1PlacePreview({ place, context, stayMin, onOpenKakao }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = getPlacePreviewKind(place, imageFailed);
  return <View style={s.root}>
    <View style={s.media}>{preview.kind === 'image' ? <Image accessibilityLabel={`${place.title} ${preview.sourceLabel}`} source={{ uri: place.imageUrl! }} style={s.image} onError={() => setImageFailed(true)} /> : <View accessibilityLabel={`${place.title} 사진 없음`} style={s.placeholder}><Text style={s.placeholderText}>{context ?? '장소 미리보기'}</Text></View>}</View>
    <View style={s.content}><Text style={s.title}>{place.title}{stayMin != null ? ` · ${stayMin}분` : ''}</Text>{context ? <Text style={s.context}>{context}</Text> : null}{preview.kind === 'image' ? <Text style={s.source}>{preview.sourceLabel}</Text> : null}<Pressable style={s.link} accessibilityLabel={`${place.title} 카카오맵에서 장소 보기`} onPress={() => onOpenKakao(place)}><Text style={s.linkText}>카카오맵에서 장소 보기</Text></Pressable></View>
  </View>;
}

const s = StyleSheet.create({ root: { flexDirection: 'row', gap: 11, borderTopWidth: 1, borderColor: C.line, paddingTop: 12 }, media: { width: 76, height: 76, borderRadius: 10, overflow: 'hidden', backgroundColor: C.panel2 }, image: { width: '100%', height: '100%' }, placeholder: { flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26384a' }, placeholderText: { color: '#b9d8ff', fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'center' }, content: { flex: 1, minHeight: 76, gap: 3 }, title: { color: C.txt, fontSize: 15, fontWeight: '800' }, context: { color: '#b9d8ff', fontSize: 13, fontWeight: '700' }, source: { color: C.muted, fontSize: 11 }, link: { alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center' }, linkText: { color: '#75b1ff', fontSize: 13, fontWeight: '800' } });
