import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Course, hasBalancedPaidVisit, LatLon, minimumStayForCourse, minimumStayForSpot, safetyBufferMin, Spot, travelMin, travelSrc } from '../engine';
import { RootStackParamList, fmtHM } from './nav';
import { Chip } from './Chip';
import { C } from './theme';
import { ACTS, Activity, actsOf, MOODS, Mood, moodOf } from './tags';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourses, resetToProfile } from './mainTabNavigation';
import { KakaoRouteMap } from './KakaoRouteMap';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;
type CandidateStatus = 'good' | 'short' | 'tight' | 'over';
type CandidateEval = {
  spot: Spot;
  moveMin: number;
  stayPossibleMin: number;
  bufferLeftMin: number;
  status: CandidateStatus;
  reason: string;
  recommendationRank: number;
  rankingScore: number;
  recommendationStrategy?: Course['strategy'];
  rankingWhy?: string;
};

type CandidateRecommendation = {
  rank: number;
  score: number;
  strategy?: Course['strategy'];
  why?: string;
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

function evalStatus(stayPossibleMin: number, minStay: number, dwellMin: number, bufferLeftMin: number, paidBalanced: boolean, courseMinimumMet: boolean): CandidateStatus {
  if (stayPossibleMin < minStay || bufferLeftMin < 0 || !paidBalanced || !courseMinimumMet) return 'over';
  if (stayPossibleMin >= dwellMin) return 'good';
  if (stayPossibleMin >= Math.max(minStay, Math.round(dwellMin * 0.55))) return 'short';
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

// 하나의 장소가 여러 코스에 포함될 수 있으므로, 가장 높은 순위 코스의 근거를 후보에 연결한다.
function candidateRecommendations(courses: Course[]): Map<string, CandidateRecommendation> {
  const byId = new Map<string, CandidateRecommendation>();
  courses.forEach((course, rank) => {
    course.spots.forEach((spot) => {
      const previous = byId.get(spot.contentId);
      if (!previous || rank < previous.rank) {
        byId.set(spot.contentId, {
          rank,
          score: course.rankingScore ?? -rank,
          strategy: course.strategy,
          why: course.why,
        });
      }
    });
  });
  return byId;
}

function diversifyCandidateGroup(items: CandidateEval[]): CandidateEval[] {
  const remaining = [...items];
  const out: CandidateEval[] = [];
  const categories: Record<string, number> = {};
  const strategies: Partial<Record<NonNullable<Course['strategy']>, number>> = {};

  while (remaining.length) {
    // 낮은 순위 후보가 과도하게 앞서지 않도록 상위 6개 안에서만 다양성 선택을 한다.
    const windowSize = Math.min(6, remaining.length);
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < windowSize; i++) {
      const item = remaining[i];
      const categoryPenalty = (categories[item.spot.category] ?? 0) * 0.09;
      const strategyPenalty = item.recommendationStrategy ? (strategies[item.recommendationStrategy] ?? 0) * 0.035 : 0;
      const value = item.rankingScore - categoryPenalty - strategyPenalty;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    out.push(next);
    categories[next.spot.category] = (categories[next.spot.category] ?? 0) + 1;
    if (next.recommendationStrategy) {
      strategies[next.recommendationStrategy] = (strategies[next.recommendationStrategy] ?? 0) + 1;
    }
  }
  return out;
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

function courseApproachMins(spots: Spot[], origin: LatLon, mode: Course['bestMode']): number[] {
  const travelMode = mode ?? 'walk';
  let cur = origin;
  return spots.map((spot) => {
    const min = travelMin(cur, spot, travelMode);
    cur = spot;
    return min;
  });
}

// 후보를 담을 때만 사용한다. 경로 API를 호출하지 않고 캐시/거리 근사값으로 순서를 정한다.
function optimizeSpotOrder(spots: Spot[], origin: LatLon, target: LatLon, mode: Course['bestMode']): Spot[] {
  if (spots.length < 2) return spots;
  const travelMode = mode ?? 'walk';
  const remaining = [...spots];
  const ordered: Spot[] = [];
  let current: LatLon = origin;

  while (remaining.length) {
    remaining.sort((a, b) => {
      const aCost = travelMin(current, a, travelMode) + travelMin(a, target, travelMode) * 0.15;
      const bCost = travelMin(current, b, travelMode) + travelMin(b, target, travelMode) * 0.15;
      return aCost - bCost || a.title.localeCompare(b.title, 'ko');
    });
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
    current = next;
  }

  // nearest-neighbor 결과의 교차·역방향 구간을 짧게 정리한다.
  let improved = true;
  while (improved) {
    improved = false;
    for (let start = 0; start < ordered.length - 1 && !improved; start++) {
      for (let end = start + 1; end < ordered.length; end++) {
        const trial = [...ordered.slice(0, start), ...ordered.slice(start, end + 1).reverse(), ...ordered.slice(end + 1)];
        if (routeMoveMin(trial, origin, target, mode) < routeMoveMin(ordered, origin, target, mode)) {
          ordered.splice(0, ordered.length, ...trial);
          improved = true;
          break;
        }
      }
    }
  }
  return ordered;
}

function openKakaoPlaceDetail(spot: Spot) {
  if (!spot.kakaoPlaceUrl) return;
  void Linking.openURL(spot.kakaoPlaceUrl).catch(() => undefined);
}

function buildBasketCourse(selected: Spot[], origin: LatLon, target: LatLon, ctx: Props['route']['params']['ctx']): Course {
  const buffer = safetyBufferMin(ctx.mode);
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
  const directMove = ctx.appointment ? travelMin(origin, target, ctx.mode) : 0;
  const addedMove = Math.max(0, moveMin - directMove);
  const minStay = minimumStayForCourse(selected, courseApproachMins(selected, origin, ctx.mode));
  const mobility = {
    [ctx.mode]: {
      mode: ctx.mode,
      moveMin,
      stayMin: stayPool,
      totalMin: moveMin + totalStay,
      bufferLeftMin: ctx.remainingMin - moveMin - totalStay,
      ok: stayPool >= minStay && hasBalancedPaidVisit(selected, totalStay, addedMove),
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
  const [selectedIds, setSelectedIds] = useState<string[]>(route.params.selectedIds ?? []);
  const [page, setPage] = useState<'recommend' | 'basket'>(route.params.initialPage ?? 'recommend');
  const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);
  const candidateListRef = useRef<ScrollView>(null);
  const candidateOffsets = useRef(new Map<string, number>());

  const target = ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : origin;
  const endMin = ctx.startMin + ctx.remainingMin;
  const allCourses = useMemo(() => [...result.courses, ...result.pending], [result.courses, result.pending]);
  const spots = useMemo(() => uniqueCandidateSpots(allCourses), [allCourses]);
  const recommendationById = useMemo(() => candidateRecommendations(allCourses), [allCourses]);
  const selected = useMemo(() => selectedIds.map((id) => spots.find((sp) => sp.contentId === id)).filter(Boolean) as Spot[], [selectedIds, spots]);
  const selectedMoveMin = routeMoveMin(selected, origin, target, ctx.mode);
  const buffer = safetyBufferMin(ctx.mode);
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
      const trial = isSelected ? selected : optimizeSpotOrder([...selected, spot], origin, target, ctx.mode);
      const moveMin = routeMoveMin(trial, origin, target, ctx.mode);
      const stayPool = Math.max(0, budget - moveMin);
      const dwellTotal = trial.reduce((n, sp) => n + sp.dwell, 0);
      const approachMins = courseApproachMins(trial, origin, ctx.mode);
      const trialMinStay = minimumStayForCourse(trial, approachMins);
      const candidateStay = isSelected
        ? Math.min(spot.dwell, stayPool)
        : Math.max(0, Math.round(stayPool * (spot.dwell / Math.max(dwellTotal, 1))));
      const bufferLeftMin = ctx.remainingMin - moveMin - Math.min(stayPool, dwellTotal);
      const directMove = ctx.appointment ? travelMin(origin, target, ctx.mode) : 0;
      const addedMove = Math.max(0, moveMin - directMove);
      const paidBalanced = hasBalancedPaidVisit(trial, Math.min(stayPool, dwellTotal), addedMove);
      const candidateIndex = trial.findIndex((item) => item.contentId === spot.contentId);
      const candidateMinStay = minimumStayForSpot(spot, approachMins[candidateIndex] ?? Infinity);
      const status = isSelected ? 'good' : evalStatus(candidateStay, candidateMinStay, spot.dwell, bufferLeftMin, paidBalanced, stayPool >= trialMinStay);
      const reason = isSelected
        ? '이미 담은 장소입니다'
        : status === 'over'
          ? !paidBalanced
            ? '시설형 장소는 추가 이동시간보다 체류시간이 길어야 해요'
            : `담으면 약 ${Math.abs(Math.min(bufferLeftMin, candidateStay - candidateMinStay))}분 부족해요`
          : `담으면 약 ${candidateStay}분 머물 수 있어요`;
      const recommendation = recommendationById.get(spot.contentId);
      return {
        spot, moveMin, stayPossibleMin: candidateStay, bufferLeftMin, status, reason,
        recommendationRank: recommendation?.rank ?? Number.MAX_SAFE_INTEGER,
        rankingScore: recommendation?.score ?? -Number.MAX_SAFE_INTEGER,
        recommendationStrategy: recommendation?.strategy,
        rankingWhy: recommendation?.why,
      };
    });
  }, [spots, selectedIds, selected, origin, target, ctx.mode, ctx.remainingMin, budget, recommendationById]);

  const filtered = useMemo(() => {
    const activeFilter = moods.size > 0 || acts.size > 0;
    const candidates = evals.filter(({ spot }) => {
    const moodOk = moods.size === 0 || (() => { const m = moodOf(spot.category); return m && moods.has(m); })();
    const actOk = acts.size === 0 || actsOf(spot.category).some((a) => acts.has(a));
    return moodOk && actOk;
    });
    const statusRank: Record<CandidateStatus, number> = { good: 0, short: 1, tight: 2, over: 3 };
    const ordered = candidates.sort((a, b) => {
      const selectedDiff = Number(selectedIds.includes(b.spot.contentId)) - Number(selectedIds.includes(a.spot.contentId));
      if (selectedDiff) return selectedDiff;
      return statusRank[a.status] - statusRank[b.status]
        || a.recommendationRank - b.recommendationRank
        || b.rankingScore - a.rankingScore
        || b.stayPossibleMin - a.stayPossibleMin;
    });
    if (activeFilter) return ordered;

    const selectedItems = ordered.filter((item) => selectedIds.includes(item.spot.contentId));
    const unselectedItems = ordered.filter((item) => !selectedIds.includes(item.spot.contentId));
    return [
      ...selectedItems,
      ...(['good', 'short', 'tight', 'over'] as CandidateStatus[]).flatMap((status) =>
        diversifyCandidateGroup(unselectedItems.filter((item) => item.status === status)),
      ),
    ];
  }, [evals, moods, acts, selectedIds]);

  function addSpot(evalItem: CandidateEval) {
    if (selectedIds.includes(evalItem.spot.contentId) || evalItem.status === 'over') return;
    setSelectedIds((prev) => {
      const next = [...prev, evalItem.spot.contentId]
        .map((id) => spots.find((spot) => spot.contentId === id))
        .filter(Boolean) as Spot[];
      return optimizeSpotOrder(next, origin, target, ctx.mode).map((spot) => spot.contentId);
    });
  }

  function removeSpot(contentId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== contentId));
  }

  function moveSpot(index: number, direction: -1 | 1) {
    setSelectedIds((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function autoSortSelected() {
    setSelectedIds((prev) => {
      const selectedSpots = prev.map((id) => spots.find((spot) => spot.contentId === id)).filter(Boolean) as Spot[];
      return optimizeSpotOrder(selectedSpots, origin, target, ctx.mode).map((spot) => spot.contentId);
    });
  }

  function confirmCourse() {
    if (!selected.length) return;
    const course = buildBasketCourse(selected, origin, target, ctx);
    navigation.navigate('Detail', { course, origin, ctx, source: 'builder' });
  }

  function focusCandidate(markerIndex: number) {
    const item = filtered[markerIndex - 1]; // 0번은 현재 위치 마커
    if (!item) return;
    const contentId = item.spot.contentId;
    setFocusedSpotId(contentId);
    const y = candidateOffsets.current.get(contentId);
    if (y != null) candidateListRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }

  const candidateMapPoints = [
    origin,
    ...filtered.map((item) => ({ lat: item.spot.lat, lon: item.spot.lon })),
    ...(ctx.appointment ? [target] : []),
  ];
  const candidateMapMarkers = [
    { ...origin, label: '현재 위치', kind: 'origin' as const },
    ...filtered.map((item) => ({
      ...item.spot,
      label: item.spot.title,
      kind: 'spot' as const,
      active: focusedSpotId === item.spot.contentId,
    })),
    ...(ctx.appointment ? [{ ...target, label: ctx.appointment.label, kind: 'appointment' as const }] : []),
  ];

  return (
    <View style={s.root}>
      {page === 'recommend' ? (
        <KakaoRouteMap
          style={s.candidateMap}
          points={candidateMapPoints}
          line={[]}
          markers={candidateMapMarkers}
          showMarkerLabels
          boundsPadding={{ top: 24, right: 20, bottom: 24, left: 20 }}
          onMarkerTap={focusCandidate}
        />
      ) : null}
      <ScrollView
        ref={page === 'recommend' ? candidateListRef : undefined}
        style={page === 'recommend' ? s.candidateSheet : undefined}
        contentContainerStyle={[s.scroll, page === 'recommend' && s.candidateSheetScroll]}
      >
        {page === 'recommend' ? <View style={s.sheetHandle} /> : null}
        <View style={s.banner}>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTxt}>
              {ctx.appointment ? `${fmtHM(endMin)} ${ctx.appointment.label} 약속까지` : `${fmtHM(endMin)}까지 · 왕복 기준`}
            </Text>
            <Text style={s.bannerBig}>{page === 'recommend' ? '지도에서 장소를 골라보세요' : '담은 장소로 코스를 만드세요'}</Text>
          </View>
          <Pressable style={s.cartBadge} onPress={() => setPage(page === 'recommend' ? 'basket' : 'recommend')}>
            <Text style={s.cartBadgeNum}>{selected.length}</Text>
            <Text style={s.cartBadgeTxt}>{page === 'recommend' ? '장바구니' : '추천 보기'}</Text>
          </Pressable>
        </View>
        <Text style={s.meta}>⏱ {usedTimeLabel} · 후보 장소 {page === 'recommend' ? filtered.length : spots.length} · 영업시간 확인 {result.gatedCount}</Text>

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
              {selected.length > 1 ? (
                <Pressable style={s.autoSortBtn} onPress={autoSortSelected}>
                  <Text style={s.autoSortTxt}>↻ 최적 순서로 정렬</Text>
                </Pressable>
              ) : null}
              {selected.length ? <Text style={s.orderNote}>현재 위치 → {selected.map((spot) => spot.title).join(' → ')} → {ctx.appointment ? ctx.appointment.label : '출발지'}</Text> : null}
              {selected.length ? (
                <View style={s.selectedList}>
                  {selected.map((spot, i) => (
                    <View key={spot.contentId} style={s.selectedChip}>
                      <Text style={s.selectedTxt}>{i + 1}. {spot.title}</Text>
                      <View style={s.orderControls}>
                        <Pressable style={[s.orderBtn, i === 0 && s.orderBtnOff]} disabled={i === 0} onPress={() => moveSpot(i, -1)} accessibilityLabel={`${spot.title} 순서 올리기`}>
                          <Text style={[s.orderBtnTxt, i === 0 && s.orderBtnTxtOff]}>↑</Text>
                        </Pressable>
                        <Pressable style={[s.orderBtn, i === selected.length - 1 && s.orderBtnOff]} disabled={i === selected.length - 1} onPress={() => moveSpot(i, 1)} accessibilityLabel={`${spot.title} 순서 내리기`}>
                          <Text style={[s.orderBtnTxt, i === selected.length - 1 && s.orderBtnTxtOff]}>↓</Text>
                        </Pressable>
                        <Pressable onPress={() => removeSpot(spot.contentId)} hitSlop={8}><Text style={s.removeTxt}>제거</Text></Pressable>
                      </View>
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
              <Text style={s.countSub}>지도 마커를 누르면 이 목록의 장소를 보여줘요</Text>
            </View>
            {filtered.length === 0 && <Text style={s.empty}>이 필터에 맞는 장소가 없어요. 필터를 줄여보세요.</Text>}

            {filtered.map((item) => {
              const isSelected = selectedIds.includes(item.spot.contentId);
              const status = statusStyle(item.status);
              return (
                <View
                  key={item.spot.contentId}
                  onLayout={(event) => candidateOffsets.current.set(item.spot.contentId, event.nativeEvent.layout.y)}
                  style={[s.card, isSelected && s.cardOn, focusedSpotId === item.spot.contentId && s.cardFocused]}
                >
                  <View style={s.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardType}>{strategyLabel(item.recommendationStrategy ? { strategy: item.recommendationStrategy } as Course : undefined)} · {item.spot.category}</Text>
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
                  {item.rankingWhy ? <Text style={s.rankingWhy}>추천 근거 · {item.rankingWhy}</Text> : null}
                  <Pressable
                    style={s.kakaoDetailBtn}
                    onPress={() => openKakaoPlaceDetail(item.spot)}
                    disabled={!item.spot.kakaoPlaceUrl}
                  >
                    <Text style={[s.kakaoDetailTxt, !item.spot.kakaoPlaceUrl && s.kakaoDetailTxtOff]}>
                      카카오맵에서 장소 자세히 보기
                    </Text>
                  </Pressable>
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
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToMyCourses(navigation)}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  candidateMap: { position: 'absolute', top: 0, right: 0, bottom: '55%', left: 0, zIndex: 0 },
  candidateSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', zIndex: 1,
    backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.line,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
  },
  scroll: { padding: 18, paddingTop: 8 },
  candidateSheetScroll: { paddingTop: 8, paddingBottom: 120 },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#506070', marginBottom: 10 },
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
  autoSortBtn: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderColor: 'rgba(76,194,255,0.45)', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: 'rgba(76,194,255,0.08)' },
  autoSortTxt: { color: C.accent, fontSize: 12, fontWeight: '900' },
  orderNote: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 9 },
  selectedList: { gap: 7, marginTop: 10 },
  selectedChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  selectedTxt: { color: C.txt, fontSize: 13.5, fontWeight: '700', flex: 1 },
  orderControls: { flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 8 },
  orderBtn: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 7 },
  orderBtnOff: { opacity: 0.35 },
  orderBtnTxt: { color: C.accent, fontSize: 16, fontWeight: '900' },
  orderBtnTxtOff: { color: C.muted },
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
  cardFocused: { borderColor: C.accent, borderWidth: 2 },
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
  rankingWhy: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  kakaoDetailBtn: { marginTop: 10, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingVertical: 10, alignItems: 'center', backgroundColor: C.panel2 },
  kakaoDetailTxt: { color: C.txt2, fontSize: 12.5, fontWeight: '800' },
  kakaoDetailTxtOff: { color: C.muted },
  addBtn: { marginTop: 12, backgroundColor: 'rgba(76,194,255,0.12)', borderWidth: 1, borderColor: 'rgba(76,194,255,0.45)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  addBtnTxt: { color: C.accent, fontSize: 13.5, fontWeight: '900' },
  removeBtn: { backgroundColor: 'rgba(255,123,114,0.1)', borderColor: 'rgba(255,123,114,0.45)' },
  removeBtnTxt: { color: C.red },
  addBtnOff: { backgroundColor: C.panel2, borderColor: C.line },
  addBtnOffTxt: { color: C.muted },
});
