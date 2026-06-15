import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Course } from '../engine';
import { RootStackParamList } from './nav';
import { Chip } from './Chip';
import { C } from './theme';
import { ACTS, Activity, actsOf, MOODS, Mood, moodOf } from './tags';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props) {
  const { result, remainingMin, usedTimeLabel, origin } = route.params;
  const [moods, setMoods] = useState<Set<Mood>>(new Set());
  const [acts, setActs] = useState<Set<Activity>>(new Set());

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  const filtered = useMemo(() => result.courses.filter((c) => {
    const moodOk = moods.size === 0 || c.spots.some((sp) => { const m = moodOf(sp.category); return m && moods.has(m); });
    const actOk = acts.size === 0 || c.spots.some((sp) => actsOf(sp.category).some((a) => acts.has(a)));
    return moodOk && actOk;
  }), [result.courses, moods, acts]);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.meta}>
          ⏱ {usedTimeLabel} · 후보 {result.candidateCount} · 영업중 {result.gatedCount} · TMAP {result.tmapOk}/{result.tmapOk + result.tmapFail} · 가용 {result.budgetMin}분
        </Text>

        <Text style={s.flabel}>분위기</Text>
        <View style={s.row}>{MOODS.map((m) => (
          <Chip key={m} active={moods.has(m)} onPress={() => toggle(moods, m, setMoods)} text={m} />
        ))}</View>
        <Text style={s.flabel}>활동</Text>
        <View style={s.row}>{ACTS.map((a) => (
          <Chip key={a} active={acts.has(a)} onPress={() => toggle(acts, a, setActs)} text={a} />
        ))}</View>

        <Text style={s.count}>{filtered.length}개 코스</Text>
        {filtered.length === 0 && <Text style={s.empty}>이 필터에 맞는 코스가 없어요. 필터를 줄여보세요.</Text>}

        {filtered.map((c, i) => (
          <Pressable key={i} style={s.card} onPress={() => navigation.navigate('Detail', { course: c, origin })}>
            <View style={s.cardHead}>
              <Text style={s.cardType}>{c.type}</Text>
              <Text style={s.cardTotal}>총 {c.totalMin}분 · 여유 {c.bufferLeftMin}분 ›</Text>
            </View>
            {c.spots.map((sp, k) => (
              <View key={k} style={s.spot}>
                <Text style={s.spotName}>{sp.title}</Text>
                <Text style={s.spotMeta}>{sp.category} · 체류 {sp.dwell}분 · {sp.openNote}</Text>
              </View>
            ))}
            <Text style={s.why}>▶ 합 {c.totalMin}분 ≤ 남은 {remainingMin}분 — 진짜 가능</Text>
          </Pressable>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 18, paddingTop: 8 },
  meta: { color: C.muted, fontSize: 12, marginBottom: 10 },
  flabel: { color: C.txt2, fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { color: C.muted, fontSize: 12.5, marginTop: 16, marginBottom: 4 },
  empty: { color: C.amber, fontSize: 13, marginTop: 6 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardType: { color: C.green, fontWeight: '800', fontSize: 16 },
  cardTotal: { color: C.txt2, fontSize: 13 },
  spot: { marginBottom: 6 },
  spotName: { color: C.txt, fontSize: 16, fontWeight: '700' },
  spotMeta: { color: C.muted, fontSize: 12.5, marginTop: 1 },
  why: { color: C.accent, fontSize: 13, marginTop: 8, fontWeight: '600' },
});
