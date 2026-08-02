import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Course, LatLon, Spot, travelMin, travelSrc } from '../engine';
import { RootStackParamList, fmtHM } from './nav';
import { Chip } from './Chip';
import { C } from './theme';
import { ACTS, Activity, actsOf, MOODS, Mood, moodOf } from './tags';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourse, resetToProfile } from './mainTabNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;
type CandidateStatus = 'good' | 'short' | 'tight' | 'over';
type CandidateEval = {
  spot: Spot;
  moveMin: number;
  stayPossibleMin: number;
  bufferLeftMin: number;
  status: CandidateStatus;
  reason: string;
};

const STATUS_LABEL: Record<CandidateStatus, string> = {
  good: '여유 있음',
  short: '짧게 가능',
  tight: '빠듯함',
  over: '시간 초과',
};

function statusStyle(status: CandidateStatus) {
  if (status === 'good') return { box: s.statusGood, txt: s.statusGoodTxt };
  if (status === 'short') return { box: s.statusShort, txt: s.statusShortTxt };
  if (status === 'tight') return { box: s.statusTight, txt: s.statusTightTxt };
  return { box: s.statusOver, txt: s.statusOverTxt };
}

function strategyLabel(course?: Course): string {
  if (course?.strategy === 'destination_area') return '약속지 근처';
  if (course?.strategy === 'route_area') return '가는 길 중간';
  return '출발지 근처';
}

function minStayForSpot(spot: Spot): number {
  if (spot.category === '카페' || spot.category === '상업지구') return 15;
  if (spot.category === '자연관광지') return 18;
  if (spot.category === '문화시설') return 20;
  if (spot.category === '식당') return 25;
  return 20;
}

function evalStatus(stayPossibleMin: number, spot: Spot, bufferLeftMin: number): CandidateStatus {
  const minStay = minStayForSpot(spot);
  if (stayPossibleMin < minStay || bufferLeftMin < 0) return 'over';
  if (stayPossibleMin >= spot.dwell) return 'good';
  if (stayPossibleMin >= Math.max(minStay, Math.round(spot.dwell * 0.55))) return 'short';
  return 'tight';
}

function uniqueCandidateSpots(courses: Course[]): Spot[] {
  const byId = new Map<string, Spot>();
  for (const course of courses) {
    for (const spot of course.spots) {
      if (!byId.has(spot.contentId)) byId.set(spot.contentId, spot);
    }
  }
  return [...byId.values()];
}

function routeMoveMin(spots: Spot[], origin: LatLon, target: LatLon, mode: Course['bestMode']): number {
  const travelMode = mode ?? 'walk';
  let cur: LatLon = origin, total = 0;
  for (const spot of spots) {
    total += travelMin(cur, spot, travelMode);
    cur = spot;
  }
  total += travelMin(cur, target, travelMode);
  return total;
}

function buildBasketCourse(selected: Spot[], origin: LatLon, target: LatLon, ctx: Props['route']['params']['ctx']): Course {
  const buffer = Math.max(10, Math.round(ctx.remainingMin * 0.12));
  const budget = ctx.remainingMin - buffer;
  const moveMin = routeMoveMin(selected, origin, target, ctx.mode);
  const stayPool = Math.max(0, budget - moveMin);
  const dwellTotal = selected.reduce((n, spot) => n + spot.dwell, 0);
  let allocatedLeft = stayPool;
  let cur: LatLon = origin;
  const legs: Course['legs'] = [];

  selected.forEach((spot, i) => {
    const t = travelMin(cur, spot, ctx.mode);
    const src = travelSrc(cur, spot, ctx.mode);
    const stay = i === selected.length - 1
      ? Math.max(0, allocatedLeft)
      : Math.min(allocatedLeft, Math.round(stayPool * (spot.dwell / Math.max(dwellTotal, 1))));
    allocatedLeft -= stay;
    legs.push({ label: `${i === 0 ? '출발' : '이동'} → ${spot.title}`, min: t, src });
    legs.push({ label: `체류 가능 · ${spot.title}`, min: stay, src: spot.dwellSrc });
    cur = spot;
  });

  const lastMove = travelMin(cur, target, ctx.mode);
  legs.push({
    label: ctx.appointment ? '다음 스케줄로' : '출발지로 복귀',
    min: lastMove,
    src: travelSrc(cur, target, ctx.mode),
  });

  const totalStay = stayPool - allocatedLeft;
  const mobility = {
    [ctx.mode]: {
      mode: ctx.mode,
      moveMin,
      stayMin: stayPool,
      totalMin: moveMin + totalStay,
      bufferLeftMin: ctx.remainingMin - moveMin - totalStay,
      ok: stayPool >= selected.reduce((n, spot) => n + minStayForSpot(spot), 0),
      legs,
    },
  } as Course['mobility'];

  return {
    type: selected.length >= 2 ? '미니코스' : '단일',
    spots: selected,
    totalMin: moveMin + totalStay,
    legs,
    bufferLeftMin: ctx.remainingMin - moveMin - totalStay,
    bestMode: ctx.mode,
    mobility,
    why: `${ctx.modeLabel} 기준 직접 구성 · 이동 ${moveMin}분 · 체류 가능 ${Math.round(stayPool)}분`,
  };
}

export function ResultsScreen({ route, navigation }: Props) {
  const { result, usedTimeLabel, origin, ctx } = route.params;
  const flow = useAppFlow();
  const { setLatestResults } = flow;
  const [moods, setMoods] = useState<Set<Mood>>(new Set());
  const [acts, setActs] = useState<Set<Activity>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState<'recommend' | 'basket'>('recommend');

  const target = ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : origin;
  const endMin = ctx.startMin + ctx.remainingMin;
  const allCourses = useMemo(() => [...result.courses, ...result.pending], [result.courses, result.pending]);
  const spots = useMemo(() => uniqueCandidateSpots(allCourses), [allCourses]);
  const selected = useMemo(() => selectedIds.map((id) => spots.find((sp) => sp.contentId === id)).filter(Boolean) as Spot[], [selectedIds, spots]);
  const selectedMoveMin = routeMoveMin(selected, origin, target, ctx.mode);
  const buffer = Math.max(10, Math.round(ctx.remainingMin * 0.12));
  const budget = ctx.remainingMin - buffer;
  const selectedStayPool = Math.max(0, budget - selectedMoveMin);
  const selectedBufferLeft = Math.max(0, ctx.remainingMin - selectedMoveMin - Math.min(selectedStayPool, selected.reduce((n, sp) => n + sp.dwell, 0)));

  useEffect(() => {
    setLatestResults(route.params);
  }, [setLatestResults, route.params]);

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  const evals = useMemo<CandidateEval[]>(() => {
    return spots.map((spot) => {
      const isSelected = selectedIds.includes(spot.contentId);
      const trial = isSelected ? selected : [...selected, spot];
      const moveMin = routeMoveMin(trial, origin, target, ctx.mode);
      const stayPool = Math.max(0, budget - moveMin);
      const dwellTotal = trial.reduce((n, sp) => n + sp.dwell, 0);
      const candidateStay = isSelected
        ? Math.min(spot.dwell, stayPool)
        : Math.max(0, Math.round(stayPool * (spot.dwell / Math.max(dwellTotal, 1))));
      const bufferLeftMin = ctx.remainingMin - moveMin - Math.min(stayPool, dwellTotal);
      const status = isSelected ? 'good' : evalStatus(candidateStay, spot, bufferLeftMin);
      const reason = isSelected
        ? '이미 담은 장소입니다'
        : status === 'over'
          ? `담으면 약 ${Math.abs(Math.min(bufferLeftMin, candidateStay - minStayForSpot(spot)))}분 부족해요`
          : `담으면 약 ${candidateStay}분 머물 수 있어요`;
      return { spot, moveMin, stayPossibleMin: candidateStay, bufferLeftMin, status, reason };
    });
  }, [spots, selectedIds, selected, origin, target, ctx.mode, ctx.remainingMin, budget]);

  const filtered = useMemo(() => evals.filter(({ spot }) => {
    const moodOk = moods.size === 0 || (() => { const m = moodOf(spot.category); return m && moods.has(m); })();
    const actOk = acts.size === 0 || actsOf(spot.category).some((a) => acts.has(a));
    return moodOk && actOk;
  }).sort((a, b) => {
    const selectedDiff = Number(selectedIds.includes(b.spot.contentId)) - Number(selectedIds.includes(a.spot.contentId));
    if (selectedDiff) return selectedDiff;
    const statusRank: Record<CandidateStatus, number> = { good: 0, short: 1, tight: 2, over: 3 };
    return statusRank[a.status] - statusRank[b.status] || b.stayPossibleMin - a.stayPossibleMin;
  }), [evals, moods, acts, selectedIds]);

  function addSpot(evalItem: CandidateEval) {
    if (selectedIds.includes(evalItem.spot.contentId) || evalItem.status === 'over') return;
    setSelectedIds((prev) => [...prev, evalItem.spot.contentId]);
  }

  function removeSpot(contentId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== contentId));
  }

  function confirmCourse() {
    if (!selected.length) return;
    const course = buildBasketCourse(selected, origin, target, ctx);
    const params = { course, origin, ctx };
    flow.setActiveCourse(params);
    navigation.navigate('Detail', params);
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.banner}>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTxt}>
              {ctx.appointment ? `${fmtHM(endMin)} ${ctx.appointment.label} 약속까지` : `${fmtHM(endMin)}까지 · 왕복 기준`}
            </Text>
            <Text style={s.bannerBig}>장소를 담아 코스를 만드세요</Text>
          </View>
          <Pressable style={s.cartBadge} onPress={() => setPage('basket')}>
            <Text style={s.cartBadgeNum}>{selected.length}</Text>
            <Text style={s.cartBadgeTxt}>장바구니</Text>
          </Pressable>
        </View>
        <Text style={s.meta}>⏱ {usedTimeLabel} · 후보 장소 {spots.length} · 영업중 {result.gatedCount}</Text>

        {page === 'basket' ? (
          <View style={s.pageBlock}>
            <View style={s.pageHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.pageKicker}>장바구니</Text>
                <Text style={s.pageTitle}>담은 장소로 코스를 확정하세요</Text>
              </View>
              <Pressable style={s.backToListBtn} onPress={() => setPage('recommend')}>
                <Text style={s.backToListTxt}>추천 보기</Text>
              </Pressable>
            </View>
            <View style={s.basket}>
              <View style={s.basketHead}>
                <Text style={s.basketTitle}>내 코스 바구니</Text>
                <Text style={s.basketMeta}>담은 장소 {selected.length}개</Text>
              </View>
              {selected.length ? (
                <View style={s.selectedList}>
                  {selected.map((spot, i) => (
                    <View key={spot.contentId} style={s.selectedChip}>
                      <Text style={s.selectedTxt}>{i + 1}. {spot.title}</Text>
                      <Pressable onPress={() => removeSpot(spot.contentId)} hitSlop={8}><Text style={s.removeTxt}>제거</Text></Pressable>
                    </View>
                  ))}
                </View>
              ) : <Text style={s.emptySmall}>추천 장소에서 마음에 드는 장소를 먼저 담아주세요.</Text>}
              <View style={s.basketStats}>
                <View style={s.stat}><Text style={s.statLbl}>이동</Text><Text style={s.statVal}>{selectedMoveMin}분</Text></View>
                <View style={s.stat}><Text style={s.statLbl}>체류 가능</Text><Text style={s.statVal}>{Math.round(selectedStayPool)}분</Text></View>
                <View style={s.stat}><Text style={s.statLbl}>여유</Text><Text style={s.statVal}>{Math.round(selectedBufferLeft)}분</Text></View>
              </View>
              <Pressable style={[s.cta, !selected.length && s.ctaOff]} disabled={!selected.length} onPress={confirmCourse}>
                <Text style={s.ctaTxt}>{selected.length ? '이 코스로 선택하기' : '장소를 먼저 담아주세요'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={s.flabel}>분위기</Text>
            <View style={s.row}>{MOODS.map((m) => (
              <Chip key={m} active={moods.has(m)} onPress={() => toggle(moods, m, setMoods)} text={m} />
            ))}</View>
            <Text style={s.flabel}>활동</Text>
            <View style={s.row}>{ACTS.map((a) => (
              <Chip key={a} active={acts.has(a)} onPress={() => toggle(acts, a, setActs)} text={a} />
            ))}</View>

            <View style={s.countRow}>
              <Text style={s.count}>장소 후보 {filtered.length}</Text>
              <Text style={s.countSub}>전체를 보여주고 시간만 갱신합니다</Text>
            </View>
            {filtered.length === 0 && <Text style={s.empty}>이 필터에 맞는 장소가 없어요. 필터를 줄여보세요.</Text>}

            {filtered.map((item) => {
              const isSelected = selectedIds.includes(item.spot.contentId);
              const status = statusStyle(item.status);
              const sampleCourse = allCourses.find((course) => course.spots.some((sp) => sp.contentId === item.spot.contentId));
              return (
                <View key={item.spot.contentId} style={[s.card, isSelected && s.cardOn]}>
                  <View style={s.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardType}>{strategyLabel(sampleCourse)} · {item.spot.category}</Text>
                      <Text style={s.spotName}>{item.spot.title}</Text>
                    </View>
                    <View style={[s.status, status.box]}><Text style={[s.statusTxt, status.txt]}>{isSelected ? '담김' : STATUS_LABEL[item.status]}</Text></View>
                  </View>
                  <Text style={s.whyMeta}>{item.spot.dwellSourceName ?? item.spot.dwellSrc}</Text>
                  <View style={s.evalRow}>
                    <View style={s.evalCell}><Text style={s.evalLbl}>추가 후 이동</Text><Text style={s.evalVal}>{item.moveMin}분</Text></View>
                    <View style={s.evalCell}><Text style={s.evalLbl}>이 장소 체류</Text><Text style={s.evalVal}>{item.stayPossibleMin}분</Text></View>
                    <View style={s.evalCell}><Text style={s.evalLbl}>여유</Text><Text style={s.evalVal}>{Math.round(item.bufferLeftMin)}분</Text></View>
                  </View>
                  <Text style={s.why}>✓ {item.reason} · 권장 {item.spot.dwell}분</Text>
                  <Pressable
                    style={[s.addBtn, isSelected && s.removeBtn, item.status === 'over' && !isSelected && s.addBtnOff]}
                    onPress={() => isSelected ? removeSpot(item.spot.contentId) : addSpot(item)}
                    disabled={item.status === 'over' && !isSelected}
                  >
                    <Text style={[s.addBtnTxt, isSelected && s.removeBtnTxt, item.status === 'over' && !isSelected && s.addBtnOffTxt]}>
                      {isSelected ? '바구니에서 빼기' : item.status === 'over' ? '시간 초과로 담기 불가' : '장소 담기'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active="main"
        courseEnabled={!!flow.activeCourse}
        onMain={() => resetToMain(navigation)}
        onCourse={() => flow.activeCourse && resetToMyCourse(navigation, flow.activeCourse)}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 18, paddingTop: 8 },
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, backgroundColor: 'rgba(76,194,255,0.08)', borderColor: 'rgba(76,194,255,0.3)', borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 8 },
  bannerTxt: { color: C.txt2, fontSize: 12.5 },
  bannerBig: { color: C.accent, fontSize: 15, fontWeight: '800' },
  cartBadge: { minWidth: 54, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(76,194,255,0.42)', borderRadius: 11, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: C.panel },
  cartBadgeNum: { color: C.txt, fontSize: 16, fontWeight: '900' },
  cartBadgeTxt: { color: C.muted, fontSize: 10.5, fontWeight: '800' },
  meta: { color: C.muted, fontSize: 11.5, marginBottom: 10 },
  pageBlock: { marginTop: 4 },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  pageKicker: { color: C.accent, fontSize: 11.5, fontWeight: '900', marginBottom: 3 },
  pageTitle: { color: C.txt, fontSize: 18, fontWeight: '900' },
  backToListBtn: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12 },
  backToListTxt: { color: C.accent, fontSize: 12.5, fontWeight: '900' },
  basket: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  basketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  basketTitle: { color: C.txt, fontSize: 16, fontWeight: '900' },
  basketMeta: { color: C.accent, fontSize: 12.5, fontWeight: '800' },
  selectedList: { gap: 7, marginTop: 10 },
  selectedChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  selectedTxt: { color: C.txt, fontSize: 13.5, fontWeight: '700', flex: 1 },
  removeTxt: { color: C.red, fontSize: 12, fontWeight: '800' },
  emptySmall: { color: C.muted, fontSize: 12.5, marginTop: 8 },
  basketStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8 },
  statLbl: { color: C.muted, fontSize: 10.5, fontWeight: '800', marginBottom: 2 },
  statVal: { color: C.txt, fontSize: 13.5, fontWeight: '900' },
  cta: { marginTop: 12, backgroundColor: '#2ea043', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaOff: { backgroundColor: C.panel2 },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  flabel: { color: C.txt2, fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countRow: { marginTop: 16, marginBottom: 4 },
  count: { color: C.muted, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5 },
  countSub: { color: '#6e7d8c', fontSize: 11.5, marginTop: 2 },
  empty: { color: C.amber, fontSize: 13, marginTop: 6 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  cardOn: { borderColor: C.green, backgroundColor: 'rgba(126,231,135,0.08)' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardType: { color: C.green, fontWeight: '800', fontSize: 12 },
  spotName: { color: C.txt, fontSize: 16, fontWeight: '800', marginTop: 3 },
  whyMeta: { color: C.muted, fontSize: 11.5, marginBottom: 10 },
  status: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, borderWidth: 1 },
  statusTxt: { fontSize: 11.5, fontWeight: '900' },
  statusGood: { borderColor: C.green, backgroundColor: 'rgba(126,231,135,0.12)' },
  statusGoodTxt: { color: C.green },
  statusShort: { borderColor: C.accent, backgroundColor: 'rgba(76,194,255,0.12)' },
  statusShortTxt: { color: C.accent },
  statusTight: { borderColor: C.amber, backgroundColor: 'rgba(227,179,65,0.12)' },
  statusTightTxt: { color: C.amber },
  statusOver: { borderColor: C.red, backgroundColor: 'rgba(255,123,114,0.1)' },
  statusOverTxt: { color: C.red },
  evalRow: { flexDirection: 'row', gap: 8 },
  evalCell: { flex: 1, backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8 },
  evalLbl: { color: C.muted, fontSize: 10.5, fontWeight: '800' },
  evalVal: { color: C.txt, fontSize: 13.5, fontWeight: '900', marginTop: 2 },
  why: { color: C.green, fontSize: 12.5, marginTop: 10, fontWeight: '600' },
  addBtn: { marginTop: 12, backgroundColor: 'rgba(76,194,255,0.12)', borderWidth: 1, borderColor: 'rgba(76,194,255,0.45)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  addBtnTxt: { color: C.accent, fontSize: 13.5, fontWeight: '900' },
  removeBtn: { backgroundColor: 'rgba(255,123,114,0.1)', borderColor: 'rgba(255,123,114,0.45)' },
  removeBtnTxt: { color: C.red },
  addBtnOff: { backgroundColor: C.panel2, borderColor: C.line },
  addBtnOffTxt: { color: C.muted },
});
