import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Course, refineCourses } from '../engine';
import { RootStackParamList, fmtHM } from './nav';
import { Chip } from './Chip';
import { C } from './theme';
import { ACTS, Activity, actsOf, MOODS, Mood, moodOf } from './tags';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

// 코스 시간 구성 바: 이동(회색)·체류(파랑)·남는 여유(초록 틴트)
function CompositionBar({ course, remainingMin }: { course: Course; remainingMin: number }) {
  const segs = course.legs.map((lg) => ({
    flex: Math.max(lg.min, 1),
    color: lg.label.startsWith('체류') ? C.accent : '#3a4653',
  }));
  const left = Math.max(remainingMin - course.totalMin, 0);
  return (
    <View style={s.bar}>
      {segs.map((g, i) => <View key={i} style={{ flex: g.flex, backgroundColor: g.color }} />)}
      {left > 0 && <View style={{ flex: left, backgroundColor: 'rgba(126,231,135,0.35)' }} />}
    </View>
  );
}

export function ResultsScreen({ route, navigation }: Props) {
  const { result, usedTimeLabel, origin, ctx } = route.params;
  const [moods, setMoods] = useState<Set<Mood>>(new Set());
  const [acts, setActs] = useState<Set<Activity>>(new Set());
  // 배치식 추천: 현재 5개 + 대기열(pending) → "다른 코스 보기"로 다음 배치 정밀화
  const [courses, setCourses] = useState<Course[]>(result.courses);
  const [pending, setPending] = useState<Course[]>(result.pending);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  async function showMore() {
    setRefreshing(true); setRefreshMsg('');
    try {
      const dest = ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : null;
      const r = await refineCourses(pending, origin, dest, ctx.mode, ctx.remainingMin, 5);
      setPending(r.rest);
      if (r.courses.length) setCourses(r.courses);
      else setRefreshMsg('더 이상 새 코스가 없어요 — 시간을 바꿔보세요');
    } finally { setRefreshing(false); }
  }

  const filtered = useMemo(() => courses.filter((c) => {
    const moodOk = moods.size === 0 || c.spots.some((sp) => { const m = moodOf(sp.category); return m && moods.has(m); });
    const actOk = acts.size === 0 || c.spots.some((sp) => actsOf(sp.category).some((a) => acts.has(a)));
    return moodOk && actOk;
  }), [courses, moods, acts]);

  const endMin = ctx.startMin + ctx.remainingMin;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* 약속/가용 시간 배너 */}
        <View style={s.banner}>
          <Text style={s.bannerTxt}>
            {ctx.appointment ? `${fmtHM(endMin)} ${ctx.appointment.label} 약속까지` : `${fmtHM(endMin)}까지 · 왕복 기준`}
          </Text>
          <Text style={s.bannerBig}>가용 {ctx.remainingMin}분</Text>
        </View>
        <Text style={s.meta}>⏱ {usedTimeLabel} · 후보 {result.candidateCount} · 영업중 {result.gatedCount} · TMAP {result.tmapOk}/{result.tmapOk + result.tmapFail}</Text>

        <Text style={s.flabel}>분위기</Text>
        <View style={s.row}>{MOODS.map((m) => (
          <Chip key={m} active={moods.has(m)} onPress={() => toggle(moods, m, setMoods)} text={m} />
        ))}</View>
        <Text style={s.flabel}>활동</Text>
        <View style={s.row}>{ACTS.map((a) => (
          <Chip key={a} active={acts.has(a)} onPress={() => toggle(acts, a, setActs)} text={a} />
        ))}</View>

        <View style={s.countRow}>
          <Text style={s.count}>가능한 코스 {filtered.length}</Text>
          {pending.length > 0 && (
            <Pressable style={s.moreBtn} onPress={showMore} disabled={refreshing}>
              {refreshing ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.moreBtnTxt}>🔄 다른 코스 보기 ({pending.length})</Text>}
            </Pressable>
          )}
        </View>
        {refreshMsg ? <Text style={s.empty}>{refreshMsg}</Text> : null}
        {filtered.length === 0 && <Text style={s.empty}>이 필터에 맞는 코스가 없어요. 필터를 줄여보세요.</Text>}

        {filtered.map((c, i) => (
          <Pressable key={i} style={s.card} onPress={() => navigation.navigate('Detail', { course: c, origin, ctx })}>
            <View style={s.cardHead}>
              <Text style={s.cardType}>{c.type} · {c.spots.length}곳</Text>
              <Text style={s.cardTotal}>{c.totalMin}분 ›</Text>
            </View>
            {c.why ? <Text style={s.whyMeta}>{c.why}</Text> : null}
            {c.spots.map((sp, k) => (
              <View key={k} style={s.spot}>
                <Text style={s.spotName}>{sp.title} <Text style={s.spotMeta}>체류 {sp.dwell}분</Text></Text>
              </View>
            ))}
            <CompositionBar course={c} remainingMin={ctx.remainingMin} />
            <Text style={s.why}>
              ✓ {ctx.appointment ? `${ctx.appointment.label} 도착 여유 ${c.bufferLeftMin}분` : `여유 ${c.bufferLeftMin}분`}
            </Text>
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
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(76,194,255,0.08)', borderColor: 'rgba(76,194,255,0.3)', borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 8 },
  bannerTxt: { color: C.txt2, fontSize: 12.5 },
  bannerBig: { color: C.accent, fontSize: 15, fontWeight: '800' },
  meta: { color: C.muted, fontSize: 11.5, marginBottom: 8 },
  flabel: { color: C.txt2, fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 4 },
  count: { color: C.muted, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5 },
  moreBtn: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, minWidth: 60, alignItems: 'center' },
  moreBtnTxt: { color: C.accent, fontSize: 12, fontWeight: '700' },
  empty: { color: C.amber, fontSize: 13, marginTop: 6 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardType: { color: C.green, fontWeight: '800', fontSize: 12.5 },
  cardTotal: { color: C.txt, fontSize: 14, fontWeight: '700' },
  whyMeta: { color: C.muted, fontSize: 11.5, marginTop: -6, marginBottom: 8 },
  spot: { marginBottom: 5 },
  spotName: { color: C.txt, fontSize: 15, fontWeight: '600' },
  spotMeta: { color: C.muted, fontSize: 12.5, fontWeight: '400' },
  bar: { flexDirection: 'row', height: 8, borderRadius: 5, overflow: 'hidden', marginTop: 8, gap: 2 },
  why: { color: C.green, fontSize: 12, marginTop: 8, fontWeight: '600' },
});
