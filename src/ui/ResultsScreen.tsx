import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Course } from '../engine';
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

function mobilityLine(course: Course): string {
  const walk = course.mobility?.walk;
  const car = course.mobility?.car;
  if (!walk || !car) return `총 ${course.totalMin}분`;
  return `도보 이동 ${walk.moveMin}분 · 자동차 이동 ${car.moveMin}분`;
}

function stayLine(course: Course, mode: 'walk' | 'car'): string {
  const selected = course.mobility?.[mode];
  if (!selected) return `여유 ${course.bufferLeftMin}분`;
  const label = mode === 'car' ? '차량' : '도보';
  return `${label} 기준 약 ${selected.stayMin}분 머물 수 있어요`;
}

function strategyLabel(course: Course): string {
  if (course.strategy === 'destination_area') return '약속지 근처';
  if (course.strategy === 'route_area') return '가는 길 중간';
  return '출발지 근처';
}

export function ResultsScreen({ route, navigation }: Props) {
  const { result, usedTimeLabel, origin, ctx } = route.params;
  const [moods, setMoods] = useState<Set<Mood>>(new Set());
  const [acts, setActs] = useState<Set<Activity>>(new Set());
  // 배치식 추천: 현재 5개 + 대기열(pending). API 사용량 보호를 위해 추가 배치는 추정값 그대로 보여준다.
  const [courses, setCourses] = useState<Course[]>(result.courses);
  const [pending, setPending] = useState<Course[]>(result.pending);
  const [refreshMsg, setRefreshMsg] = useState('');

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  function showMore() {
    setRefreshMsg('');
    const next = pending.slice(0, 5);
    setPending(pending.slice(5));
    if (next.length) setCourses(next);
    else setRefreshMsg('더 이상 새 코스가 없어요 — 시간을 바꿔보세요');
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
            <Pressable style={s.moreBtn} onPress={showMore}>
              <Text style={s.moreBtnTxt}>🔄 다른 코스 보기 ({pending.length})</Text>
            </Pressable>
          )}
        </View>
        {refreshMsg ? <Text style={s.empty}>{refreshMsg}</Text> : null}
        {filtered.length === 0 && <Text style={s.empty}>이 필터에 맞는 코스가 없어요. 필터를 줄여보세요.</Text>}

        {filtered.map((c, i) => (
          <Pressable key={i} style={s.card} onPress={() => navigation.navigate('Detail', { course: c, origin, ctx })}>
            <View style={s.cardHead}>
              <Text style={s.cardType}>{strategyLabel(c)} · {c.type} · {c.spots.length}곳</Text>
              <Text style={s.cardTotal}>{c.bestMode === 'car' ? '자동차' : '도보'} ›</Text>
            </View>
            {c.why ? <Text style={s.whyMeta}>{c.why}</Text> : null}
            {c.spots.map((sp, k) => (
              <View key={k} style={s.spot}>
                <Text style={s.spotName}>{sp.title} <Text style={s.spotMeta}>권장 {sp.dwell}분</Text></Text>
              </View>
            ))}
            <Text style={s.mobility}>{mobilityLine(c)}</Text>
            <CompositionBar course={c} remainingMin={ctx.remainingMin} />
            <Text style={s.why}>
              ✓ {stayLine(c, ctx.mode)}
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
  mobility: { color: C.txt2, fontSize: 12.5, marginTop: 3 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 5, overflow: 'hidden', marginTop: 8, gap: 2 },
  why: { color: C.green, fontSize: 12, marginTop: 8, fontWeight: '600' },
});
