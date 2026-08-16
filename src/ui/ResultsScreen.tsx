import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Course,
  automaticLegMode,
  automaticTravelLegs,
  hasBalancedPaidVisit,
  LatLon,
  Mode,
  minimumStayForCourse,
  minimumStayForSpot,
  safetyBufferMin,
  Spot,
  travelGeo,
  travelMin,
  travelSrc,
  validateCourseOpening,
} from "../engine";
import { RootStackParamList, fmtHM } from "./nav";
import { Chip } from "./Chip";
import { C } from "./theme";
import { ACTS, Activity, actsOf, MOODS, Mood, moodOf } from "./tags";
import { useAppFlow } from "./AppFlowContext";
import { FloatingTabBar } from "./FloatingTabBar";
import {
  resetToMain,
  resetToMyCourses,
  resetToProfile,
} from "./mainTabNavigation";
import { buildRouteMapSegments, KakaoRouteMap } from "./KakaoRouteMap";
import { haversineKm, precompute, precomputeTransit } from "../engine/travel";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;
type CandidateStatus = "good" | "short" | "tight" | "over";
type SheetPosition = "collapsed" | "default" | "expanded";
type CandidateEval = {
  spot: Spot;
  moveMin: number;
  stayPossibleMin: number;
  bufferLeftMin: number;
  status: CandidateStatus;
  siteConflict: boolean;
  reason: string;
  recommendationRank: number;
  rankingScore: number;
  availableModes: Mode[];
  suggestedMode?: Mode;
  recommendationStrategy?: Course["strategy"];
  rankingWhy?: string;
};

type CandidateRecommendation = {
  rank: number;
  score: number;
  strategy?: Course["strategy"];
  why?: string;
};

type TransportScenario = {
  mode: Mode;
  approachMin: number;
  onwardMode: Mode;
  onwardMin: number;
  stayPossibleMin: number;
  bufferLeftMin: number;
  status: CandidateStatus;
};

function TransportGlyph({ mode, color = C.txt2, size = 15 }: { mode: Mode; color?: string; size?: number }) {
  if (mode === "car") return <MaterialCommunityIcons color={color} name="car" size={size} />;
  if (mode === "transit") return <MaterialCommunityIcons color={color} name="bus" size={size} />;
  return <MaterialCommunityIcons color={color} name="walk" size={size} />;
}

function transportColor(mode: Mode): string {
  if (mode === "car") return C.amber;
  if (mode === "transit") return C.accent;
  return C.green;
}


const STATUS_LABEL: Record<CandidateStatus, string> = {
  good: "여유 있음",
  short: "짧게 가능",
  tight: "빠듯함",
  over: "시간 초과",
};

const MODE_LABEL: Record<Mode, string> = {
  walk: "도보",
  transit: "대중교통",
  car: "차량",
};

function statusStyle(status: CandidateStatus) {
  if (status === "good") return { box: s.statusGood, txt: s.statusGoodTxt };
  if (status === "short") return { box: s.statusShort, txt: s.statusShortTxt };
  if (status === "tight") return { box: s.statusTight, txt: s.statusTightTxt };
  return { box: s.statusOver, txt: s.statusOverTxt };
}

function distanceFromOriginLabel(origin: LatLon, spot: Spot): string {
  const km = haversineKm(origin, spot);
  if (km < 1) return `현재 위치 ${Math.max(10, Math.round(km * 1000 / 10) * 10)}m`;
  return `현재 위치 ${km.toFixed(1)}km`;
}

function evalStatus(
  stayPossibleMin: number,
  minStay: number,
  dwellMin: number,
  bufferLeftMin: number,
  paidBalanced: boolean,
  courseMinimumMet: boolean,
): CandidateStatus {
  if (
    stayPossibleMin < minStay ||
    bufferLeftMin < 0 ||
    !paidBalanced ||
    !courseMinimumMet
  )
    return "over";
  if (stayPossibleMin >= dwellMin) return "good";
  if (stayPossibleMin >= Math.max(minStay, Math.round(dwellMin * 0.55)))
    return "short";
  return "tight";
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
function candidateRecommendations(
  courses: Course[],
): Map<string, CandidateRecommendation> {
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
  const strategies: Partial<Record<NonNullable<Course["strategy"]>, number>> =
    {};

  while (remaining.length) {
    // 낮은 순위 후보가 과도하게 앞서지 않도록 상위 6개 안에서만 다양성 선택을 한다.
    const windowSize = Math.min(6, remaining.length);
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < windowSize; i++) {
      const item = remaining[i];
      const categoryPenalty = (categories[item.spot.category] ?? 0) * 0.09;
      const strategyPenalty = item.recommendationStrategy
        ? (strategies[item.recommendationStrategy] ?? 0) * 0.035
        : 0;
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
      strategies[next.recommendationStrategy] =
        (strategies[next.recommendationStrategy] ?? 0) + 1;
    }
  }
  return out;
}

function routeMoveMin(
  spots: Spot[],
  origin: LatLon,
  target: LatLon,
  mode: Course["bestMode"],
): number {
  let cur: LatLon = origin,
    total = 0;
  for (const spot of spots) {
    total += travelMin(cur, spot, mode ?? automaticLegMode(cur, spot));
    cur = spot;
  }
  total += travelMin(cur, target, mode ?? automaticLegMode(cur, target));
  return total;
}

function courseApproachMins(
  spots: Spot[],
  origin: LatLon,
  mode: Course["bestMode"],
): number[] {
  let cur = origin;
  return spots.map((spot) => {
    const min = travelMin(cur, spot, mode ?? automaticLegMode(cur, spot));
    cur = spot;
    return min;
  });
}

// 후보를 담을 때만 사용한다. 경로 API를 호출하지 않고 캐시/거리 근사값으로 순서를 정한다.
function optimizeSpotOrder(
  spots: Spot[],
  origin: LatLon,
  target: LatLon,
  mode: Course["bestMode"],
): Spot[] {
  if (spots.length < 2) return spots;
  const remaining = [...spots];
  const ordered: Spot[] = [];
  let current: LatLon = origin;

  while (remaining.length) {
    remaining.sort((a, b) => {
      const aMode = mode ?? automaticLegMode(current, a);
      const bMode = mode ?? automaticLegMode(current, b);
      const aCost =
        travelMin(current, a, aMode) +
        travelMin(a, target, mode ?? automaticLegMode(a, target)) * 0.15;
      const bCost =
        travelMin(current, b, bMode) +
        travelMin(b, target, mode ?? automaticLegMode(b, target)) * 0.15;
      return aCost - bCost || a.title.localeCompare(b.title, "ko");
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
        const trial = [
          ...ordered.slice(0, start),
          ...ordered.slice(start, end + 1).reverse(),
          ...ordered.slice(end + 1),
        ];
        if (
          routeMoveMin(trial, origin, target, mode) <
          routeMoveMin(ordered, origin, target, mode)
        ) {
          ordered.splice(0, ordered.length, ...trial);
          improved = true;
          break;
        }
      }
    }
  }
  return ordered;
}

function buildBasketCourse(
  selected: Spot[],
  origin: LatLon,
  target: LatLon,
  ctx: Props["route"]["params"]["ctx"],
  arrivalModes: Partial<Record<string, Mode>> = {},
): Course {
  const travelPlan = automaticTravelLegs(selected, origin, target, arrivalModes);
  const buffer = Math.max(...travelPlan.map((leg) => safetyBufferMin(leg.mode)));
  const budget = ctx.remainingMin - buffer;
  const moveMin = travelPlan.reduce((sum, leg) => sum + travelMin(leg.from, leg.to, leg.mode), 0);
  const stayPool = Math.max(0, budget - moveMin);
  const dwellTotal = selected.reduce((n, spot) => n + spot.dwell, 0);
  let allocatedLeft = stayPool;
  let cur: LatLon = origin;
  const legs: Course["legs"] = [];

  selected.forEach((spot, i) => {
    const travel = travelPlan[i];
    const t = travelMin(cur, spot, travel.mode);
    const src = travelSrc(cur, spot, travel.mode);
    const stay =
      i === selected.length - 1
        ? Math.max(0, allocatedLeft)
        : Math.min(
            allocatedLeft,
            Math.round(stayPool * (spot.dwell / Math.max(dwellTotal, 1))),
          );
    allocatedLeft -= stay;
    legs.push({
      label: `${i === 0 ? "출발" : "이동"} → ${spot.title}`,
      min: t,
      src,
      mode: travel.mode,
      geo: travelGeo(cur, spot, travel.mode),
    });
    legs.push({
      label: `체류 가능 · ${spot.title}`,
      min: stay,
      src: spot.dwellSrc,
    });
    cur = spot;
  });

  const finalTravel = travelPlan[travelPlan.length - 1];
  const lastMove = travelMin(cur, target, finalTravel.mode);
  legs.push({
    label: ctx.appointment ? "다음 스케줄로" : "출발지로 복귀",
    min: lastMove,
    src: travelSrc(cur, target, finalTravel.mode),
    mode: finalTravel.mode,
    geo: travelGeo(cur, target, finalTravel.mode),
  });

  const totalStay = stayPool - allocatedLeft;
  const directMove = ctx.appointment ? travelMin(origin, target, automaticLegMode(origin, target)) : 0;
  const addedMove = Math.max(0, moveMin - directMove);
  const minStay = minimumStayForCourse(
    selected,
    courseApproachMins(selected, origin, undefined),
  );
  const mobility = {
    transit: {
      mode: "transit",
      moveMin,
      stayMin: stayPool,
      totalMin: moveMin + totalStay,
      bufferLeftMin: ctx.remainingMin - moveMin - totalStay,
      ok:
        stayPool >= minStay &&
        hasBalancedPaidVisit(selected, totalStay, addedMove),
      legs,
    },
  } as Course["mobility"];

  return {
    type: selected.length >= 2 ? "미니코스" : "단일",
    spots: selected,
    totalMin: moveMin + totalStay,
    legs,
    bufferLeftMin: ctx.remainingMin - moveMin - totalStay,
    bestMode: travelPlan.some((leg) => leg.mode === "transit") ? "transit" : "walk",
    mobility,
    why: `구간별 자동 이동 · 이동 ${moveMin}분 · 체류 가능 ${Math.round(stayPool)}분`,
  };
}

export function ResultsScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { result, origin, ctx, editingCourseId } = route.params;
  const flow = useAppFlow();
  const { saveCourse, replaceCourse, setActiveCourse, setLatestResults } = flow;
  const [moods, setMoods] = useState<Set<Mood>>(new Set());
  const [acts, setActs] = useState<Set<Activity>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>(
    route.params.selectedIds ?? [],
  );
  const [page, setPage] = useState<"recommend" | "basket">(
    route.params.initialPage ?? "recommend",
  );
  const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState({ point: origin, token: 0 });
  const [selectedArrivalModes, setSelectedArrivalModes] = useState<
    Partial<Record<string, Mode>>
  >({});
  const [pendingTransportItem, setPendingTransportItem] =
    useState<CandidateEval | null>(null);
  const [chosenArrivalMode, setChosenArrivalMode] = useState<Mode>("walk");
  const [transportModeTouched, setTransportModeTouched] = useState(false);
  const [basketRouteVersion, setBasketRouteVersion] = useState(0);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const expandedSheetHeight = Math.min(
    Math.round(windowHeight * 0.9),
    windowHeight - (insets.top + 8),
  );
  const defaultSheetHeight = Math.round(windowHeight * 0.56);
  const defaultSheetOffset = expandedSheetHeight - defaultSheetHeight;
  const collapsedSheetOffset = Math.max(
    0,
    expandedSheetHeight - (insets.bottom + 82),
  );
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>("default");
  const mapFocusOffsetY =
    sheetPosition === "default"
      ? Math.round(defaultSheetHeight * 0.5)
      : sheetPosition === "collapsed"
        ? Math.round((insets.bottom + 82) * 0.5)
        : Math.round(expandedSheetHeight * 0.5);
  const candidateListRef = useRef<ScrollView>(null);
  const candidateOffsets = useRef(new Map<string, number>());
  const sheetTranslateY = useRef(
    new Animated.Value(defaultSheetOffset),
  ).current;
  const sheetStartOffset = useRef(0);

  const requestMapFocus = useCallback((point: LatLon) => {
    setMapFocusRequest((previous) => ({ point, token: previous.token + 1 }));
  }, []);

  const moveSheet = useCallback(
    (position: SheetPosition) => {
      setSheetPosition(position);
      // 시트 높이가 바뀌면 같은 장소라도 보이는 지도 영역의 중심이 달라진다.
      setMapFocusRequest((previous) => ({ ...previous, token: previous.token + 1 }));
      const toValue =
        position === "expanded"
          ? 0
          : position === "collapsed"
            ? collapsedSheetOffset
            : defaultSheetOffset;
      Animated.spring(sheetTranslateY, {
        toValue,
        useNativeDriver: true,
        stiffness: 240,
        damping: 28,
      }).start();
    },
    [collapsedSheetOffset, defaultSheetOffset, sheetTranslateY],
  );

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dy) > 4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((value) => {
            sheetStartOffset.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextOffset = Math.max(
            0,
            Math.min(
              collapsedSheetOffset,
              sheetStartOffset.current + gesture.dy,
            ),
          );
          sheetTranslateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) {
            moveSheet(
              sheetPosition === "collapsed"
                ? "default"
                : sheetPosition === "default"
                  ? "expanded"
                  : "default",
            );
            return;
          }
          const currentOffset = Math.max(
            0,
            Math.min(
              collapsedSheetOffset,
              sheetStartOffset.current + gesture.dy,
            ),
          );
          const nextPosition: SheetPosition =
            gesture.vy > 0.3
              ? currentOffset >= defaultSheetOffset
                ? "collapsed"
                : "default"
              : gesture.vy < -0.3
                ? currentOffset <= defaultSheetOffset
                  ? "expanded"
                  : "default"
                : [
                    { position: "expanded" as const, offset: 0 },
                    {
                      position: "default" as const,
                      offset: defaultSheetOffset,
                    },
                    {
                      position: "collapsed" as const,
                      offset: collapsedSheetOffset,
                    },
                  ].reduce((nearest, candidate) =>
                    Math.abs(candidate.offset - currentOffset) <
                    Math.abs(nearest.offset - currentOffset)
                      ? candidate
                      : nearest,
                  ).position;
          moveSheet(nextPosition);
        },
      }),
    [
      collapsedSheetOffset,
      defaultSheetOffset,
      moveSheet,
      sheetPosition,
      sheetTranslateY,
    ],
  );

  const target = ctx.appointment
    ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon }
    : origin;
  const endMin = ctx.startMin + ctx.remainingMin;
  const allCourses = useMemo(
    () => [...result.courses, ...result.pending],
    [result.courses, result.pending],
  );
  const spots = useMemo(() => uniqueCandidateSpots(allCourses), [allCourses]);
  const recommendationById = useMemo(
    () => candidateRecommendations(allCourses),
    [allCourses],
  );
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => spots.find((sp) => sp.contentId === id))
        .filter(Boolean) as Spot[],
    [selectedIds, spots],
  );
  const selectedTravelPlan = useMemo(
    () => automaticTravelLegs(selected, origin, target, selectedArrivalModes),
    [origin, selected, selectedArrivalModes, target],
  );
  const selectedMoveMin = selectedTravelPlan.reduce(
    (sum, leg) => sum + travelMin(leg.from, leg.to, leg.mode),
    0,
  );
  const buffer = Math.max(...selectedTravelPlan.map((leg) => safetyBufferMin(leg.mode)));
  const budget = ctx.remainingMin - buffer;
  const selectedStayPool = Math.max(0, budget - selectedMoveMin);
  const selectedBufferLeft = Math.max(
    0,
    ctx.remainingMin -
      selectedMoveMin -
      Math.min(
        selectedStayPool,
        selected.reduce((n, sp) => n + sp.dwell, 0),
      ),
  );
  const basketCourse = useMemo(
    () =>
      selected.length
        ? buildBasketCourse(selected, origin, target, ctx, selectedArrivalModes)
        : null,
    [basketRouteVersion, ctx, origin, selected, selectedArrivalModes, target],
  );
  const basketMapHeight = Math.round(windowHeight * 0.3);
  const basketTravelLegs =
    basketCourse?.legs.filter((leg) => !leg.label.startsWith("체류")) ?? [];
  const basketMapPoints = [origin, ...selected, target];
  const basketRouteLine = basketTravelLegs.flatMap((leg) => leg.geo ?? []);
  const basketRouteSegments = buildRouteMapSegments(
    basketMapPoints,
    basketTravelLegs,
  );

  useEffect(() => {
    if (page !== "recommend") {
      sheetTranslateY.setValue(defaultSheetOffset);
      setSheetPosition("default");
    }
  }, [defaultSheetOffset, page, sheetTranslateY]);

  useEffect(() => {
    if (page !== "basket" || !selected.length) return;
    const plans = automaticTravelLegs(selected, origin, target, selectedArrivalModes);

    let alive = true;
    const timer = setTimeout(() => {
      // 장바구니의 각 구간을 자동 수단으로 정밀화한다. 같은 좌표쌍·수단은 24시간 캐시를 재사용한다.
      Promise.all(plans.map((plan) => plan.mode === "transit"
        ? precomputeTransit([[plan.from, plan.to]], { retryFallback: true })
        : precompute([[plan.from, plan.to]], plan.mode, { retryFallback: true })))
        .finally(() => {
        if (alive) setBasketRouteVersion((version) => version + 1);
      });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [origin, page, selected, selectedArrivalModes, target]);

  useEffect(() => {
    setLatestResults(route.params);
  }, [setLatestResults, route.params]);

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    setter(n);
  };

  const evals = useMemo<CandidateEval[]>(() => {
    return spots.map((spot) => {
      const isSelected = selectedIds.includes(spot.contentId);
      const siteConflict = !isSelected && Boolean(
        spot.siteGroupId
        && selected.some((selectedSpot) => selectedSpot.siteGroupId === spot.siteGroupId),
      );
      const modeScenarios = (['walk', 'transit', 'car'] as Mode[])
        .map((mode) => transportScenario(spot, mode));
      const feasibleScenarios = modeScenarios.filter((scenario) => scenario.status !== 'over');
      const suggested = [...feasibleScenarios].sort((a, b) => {
        const vehiclePenalty = Number(a.mode === 'car') - Number(b.mode === 'car');
        return vehiclePenalty || b.bufferLeftMin - a.bufferLeftMin;
      })[0];
      const status = isSelected
        ? 'good'
        : siteConflict
          ? 'over'
          : suggested?.status ?? 'over';
      const moveMin = suggested ? suggested.approachMin + suggested.onwardMin : 0;
      const candidateStay = suggested?.stayPossibleMin ?? 0;
      const bufferLeftMin = suggested?.bufferLeftMin ?? -1;
      const reason = isSelected
        ? "이미 담은 장소입니다"
        : siteConflict
          ? "이미 담은 장소와 같은 단지의 내부 공간이에요"
          : status === "over"
          ? '현재 코스 기준 시간 안에 담기 어려워요'
          : `${MODE_LABEL[suggested?.mode ?? 'walk']}로 담으면 약 ${candidateStay}분 머물 수 있어요`;
      const recommendation = recommendationById.get(spot.contentId);
      return {
        spot,
        moveMin,
        stayPossibleMin: candidateStay,
        bufferLeftMin,
        status,
        siteConflict,
        reason,
        recommendationRank: recommendation?.rank ?? Number.MAX_SAFE_INTEGER,
        rankingScore: recommendation?.score ?? -Number.MAX_SAFE_INTEGER,
        availableModes: feasibleScenarios.map((scenario) => scenario.mode),
        suggestedMode: suggested?.mode,
        recommendationStrategy: recommendation?.strategy,
        rankingWhy: recommendation?.why,
      };
    });
  }, [
    spots,
    selectedIds,
    selected,
    origin,
    target,
    ctx.remainingMin,
    selectedArrivalModes,
    recommendationById,
  ]);

  const filtered = useMemo(() => {
    const activeFilter = moods.size > 0 || acts.size > 0;
    const candidates = evals.filter(({ spot }) => {
      const moodOk =
        moods.size === 0 ||
        (() => {
          const m = moodOf(spot.category);
          return m && moods.has(m);
        })();
      const actOk =
        acts.size === 0 || actsOf(spot.category).some((a) => acts.has(a));
      return moodOk && actOk;
    });
    const statusRank: Record<CandidateStatus, number> = {
      good: 0,
      short: 1,
      tight: 2,
      over: 3,
    };
    const ordered = candidates.sort((a, b) => {
      const selectedDiff =
        Number(selectedIds.includes(b.spot.contentId)) -
        Number(selectedIds.includes(a.spot.contentId));
      if (selectedDiff) return selectedDiff;
      return (
        statusRank[a.status] - statusRank[b.status] ||
        a.recommendationRank - b.recommendationRank ||
        b.rankingScore - a.rankingScore ||
        b.stayPossibleMin - a.stayPossibleMin
      );
    });
    if (activeFilter) return ordered;

    const selectedItems = ordered.filter((item) =>
      selectedIds.includes(item.spot.contentId),
    );
    const unselectedItems = ordered.filter(
      (item) => !selectedIds.includes(item.spot.contentId),
    );
    return [
      ...selectedItems,
      ...(["good", "short", "tight", "over"] as CandidateStatus[]).flatMap(
        (status) =>
          diversifyCandidateGroup(
            unselectedItems.filter((item) => item.status === status),
          ),
      ),
    ];
  }, [evals, moods, acts, selectedIds]);

  function transportScenario(spot: Spot, mode: Mode): TransportScenario {
    const trial = [...selected, spot];
    const arrivalModes = { ...selectedArrivalModes, [spot.contentId]: mode };
    const plan = automaticTravelLegs(trial, origin, target, arrivalModes);
    const incoming = plan[trial.length - 1];
    const outgoing = plan[plan.length - 1];
    const moveMin = plan.reduce(
      (sum, leg) => sum + travelMin(leg.from, leg.to, leg.mode),
      0,
    );
    const buffer = Math.max(...plan.map((leg) => safetyBufferMin(leg.mode)));
    const stayPool = Math.max(0, ctx.remainingMin - buffer - moveMin);
    const dwellTotal = trial.reduce((sum, item) => sum + item.dwell, 0);
    let allocatedLeft = stayPool;
    let candidateStay = 0;
    trial.forEach((item, index) => {
      const stay =
        index === trial.length - 1
          ? Math.max(0, allocatedLeft)
          : Math.min(
              allocatedLeft,
              Math.round(stayPool * (item.dwell / Math.max(dwellTotal, 1))),
            );
      allocatedLeft -= stay;
      if (item.contentId === spot.contentId) candidateStay = stay;
    });
    const bufferLeftMin =
      ctx.remainingMin - moveMin - Math.min(stayPool, dwellTotal);
    const approaches = trial.map((_, index) => {
      const leg = plan[index];
      return travelMin(leg.from, leg.to, leg.mode);
    });
    const candidateMinStay = minimumStayForSpot(
      spot,
      approaches[trial.length - 1] ?? travelMin(incoming.from, incoming.to, incoming.mode),
    );
    const minCourseStay = minimumStayForCourse(trial, approaches);
    const directMove = ctx.appointment
      ? travelMin(origin, target, automaticLegMode(origin, target))
      : 0;
    const addedMove = Math.max(0, moveMin - directMove);
    return {
      mode,
      approachMin: travelMin(incoming.from, incoming.to, incoming.mode),
      onwardMode: outgoing.mode,
      onwardMin: travelMin(outgoing.from, outgoing.to, outgoing.mode),
      stayPossibleMin: candidateStay,
      bufferLeftMin,
      status: evalStatus(
        candidateStay,
        candidateMinStay,
        spot.dwell,
        bufferLeftMin,
        hasBalancedPaidVisit(trial, Math.min(stayPool, dwellTotal), addedMove),
        stayPool >= minCourseStay,
      ),
    };
  }

  const pendingTransportScenarios = useMemo(() => {
    if (!pendingTransportItem) return [];
    return (["walk", "transit", "car"] as Mode[]).map((mode) =>
      transportScenario(pendingTransportItem.spot, mode),
    );
  }, [pendingTransportItem, selected, selectedArrivalModes, origin, target, ctx.remainingMin]);

  useEffect(() => {
    if (!pendingTransportItem || transportModeTouched) return;
    // 자차·택시 여부를 앱이 임의로 가정하지 않도록 기본 추천에서는 차량을 뒤로 둔다.
    const suggested = [...pendingTransportScenarios]
      .filter((scenario) => scenario.status !== "over")
      .sort((a, b) => {
        const aVehiclePenalty = a.mode === "car" ? 1 : 0;
        const bVehiclePenalty = b.mode === "car" ? 1 : 0;
        return (
          aVehiclePenalty - bVehiclePenalty ||
          b.bufferLeftMin - a.bufferLeftMin
        );
      })[0];
    if (suggested) setChosenArrivalMode(suggested.mode);
  }, [pendingTransportItem, pendingTransportScenarios, transportModeTouched]);

  function openTransportPicker(evalItem: CandidateEval) {
    if (selectedIds.includes(evalItem.spot.contentId) || evalItem.siteConflict) return;
    const previous = selected[selected.length - 1] ?? origin;
    setChosenArrivalMode(automaticLegMode(previous, evalItem.spot));
    setTransportModeTouched(false);
    setPendingTransportItem(evalItem);
  }

  function openCandidateFromSheet(evalItem: CandidateEval) {
    if (selectedIds.includes(evalItem.spot.contentId) || evalItem.siteConflict) return;
    setFocusedSpotId(evalItem.spot.contentId);
    requestMapFocus(evalItem.spot);
    // 시트 위치를 바꾸지 않고 지도 포커스 전환을 먼저 보여 준 뒤 상세 선택을 연다.
    setTimeout(() => openTransportPicker(evalItem), 220);
  }

  function addSpotWithTransport() {
    if (!pendingTransportItem) return;
    const scenario = pendingTransportScenarios.find(
      (item) => item.mode === chosenArrivalMode,
    );
    if (!scenario || scenario.status === "over") return;
    const contentId = pendingTransportItem.spot.contentId;
    setSelectedArrivalModes((prev) => ({ ...prev, [contentId]: chosenArrivalMode }));
    // 이동수단은 "직전 지점 → 이 장소"에 대응하므로, 추가 순서를 자동으로 바꾸지 않는다.
    setSelectedIds((prev) => [...prev, contentId]);
    setPendingTransportItem(null);
  }

  function removeSpot(contentId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== contentId));
    setSelectedArrivalModes((prev) => {
      const next = { ...prev };
      delete next[contentId];
      return next;
    });
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
      const selectedSpots = prev
        .map((id) => spots.find((spot) => spot.contentId === id))
        .filter(Boolean) as Spot[];
      return optimizeSpotOrder(selectedSpots, origin, target, undefined).map(
        (spot) => spot.contentId,
      );
    });
  }

  async function confirmCourse() {
    if (!basketCourse || isSavingCourse) return;
    setIsSavingCourse(true);
    try {
      const plans = automaticTravelLegs(selected, origin, target, selectedArrivalModes);
      await Promise.all(plans.map((plan) => plan.mode === "transit"
        ? precomputeTransit([[plan.from, plan.to]], { retryFallback: true })
        : precompute([[plan.from, plan.to]], plan.mode, { retryFallback: true })));

      // 정밀 경로를 받은 뒤 체류 종료시각까지 다시 검증한다.
      const refinedCourse = buildBasketCourse(
        selected,
        origin,
        target,
        ctx,
        selectedArrivalModes,
      );
      const stayMins = refinedCourse.legs
        .filter((leg) => leg.label.startsWith("체류 가능"))
        .map((leg) => leg.min);
      const opening = await validateCourseOpening(
        selected,
        origin,
        target,
        plans.map((plan) => plan.mode),
        ctx.startMin,
        stayMins,
      );
      if (!opening.ok) {
        Alert.alert("코스를 확정할 수 없어요", opening.reason ?? "운영시간을 다시 확인해 주세요.");
        setBasketRouteVersion((version) => version + 1);
        return;
      }
      if (!opening.exactRoute) {
        Alert.alert("실경로 확인이 필요해요", "일부 구간의 경로 API 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.");
        setBasketRouteVersion((version) => version + 1);
        return;
      }

      const baseParams = { course: refinedCourse, origin, ctx };
      // 장바구니가 최종 검토 화면이다. DB 저장이 성공한 코스만 실행 흐름으로 넘긴다.
      const executionParams = editingCourseId
        ? await replaceCourse(editingCourseId, baseParams)
        : { ...baseParams, courseId: (await saveCourse(baseParams)).id };
      setActiveCourse(executionParams);
      navigation.replace("Execution", executionParams);
    } catch (error) {
      console.warn('[코스 저장] 실패', error);
      Alert.alert('코스 저장 실패', error instanceof Error ? error.message : '저장한 뒤 다시 시도해 주세요.');
    } finally {
      setIsSavingCourse(false);
    }
  }

  function focusCandidate(markerIndex: number) {
    const item = filtered[markerIndex - 1]; // 0번은 현재 위치 마커
    if (!item) return;
    const contentId = item.spot.contentId;
    setFocusedSpotId(contentId);
    requestMapFocus(item.spot);
    moveSheet("default");
    const y = candidateOffsets.current.get(contentId);
    if (y != null)
      candidateListRef.current?.scrollTo({
        y: Math.max(0, y - 12),
        animated: true,
      });
  }

  const candidateMapPoints = [
    origin,
    ...filtered.map((item) => ({ lat: item.spot.lat, lon: item.spot.lon })),
    ...(ctx.appointment ? [target] : []),
  ];
  const candidateMapMarkers = [
    {
      ...origin,
      label: "현재 위치",
      kind: "origin" as const,
      active: !focusedSpotId,
    },
    ...filtered.map((item) => ({
      ...item.spot,
      label: item.spot.title,
      kind: "spot" as const,
      active: focusedSpotId === item.spot.contentId,
    })),
    ...(ctx.appointment
      ? [
          {
            ...target,
            label: ctx.appointment.label,
            kind: "appointment" as const,
          },
        ]
      : []),
  ];

  return (
    <View style={s.root}>
      {page === "recommend" ? (
        <KakaoRouteMap
          style={s.candidateMap}
          points={candidateMapPoints}
          line={[]}
          markers={candidateMapMarkers}
          showMarkerLabels
          usePhotoMarkers
          recenterPoint={mapFocusRequest.point}
          recenterToken={mapFocusRequest.token}
          recenterOffsetY={mapFocusOffsetY}
          focusedMarkerOffsetY={mapFocusOffsetY}
          boundsPadding={{
            top: 132,
            right: 20,
            bottom:
              sheetPosition === "expanded"
                ? expandedSheetHeight + 16
                : sheetPosition === "collapsed"
                  ? insets.bottom + 92
                  : defaultSheetHeight + 16,
            left: 20,
          }}
          onMarkerTap={focusCandidate}
        />
      ) : null}
      {page === "recommend" && sheetPosition !== "expanded" ? (
        <Pressable
          style={[
            s.mapLocationButton,
            {
              bottom:
                sheetPosition === "collapsed"
                  ? insets.bottom + 96
                  : defaultSheetHeight + 16,
            },
          ]}
          onPress={() => requestMapFocus(origin)}
          accessibilityLabel="현재 위치로 지도 이동"
        >
          <Feather color={C.txt} name="crosshair" size={21} />
        </Pressable>
      ) : null}
      {page === "basket" ? (
        <KakaoRouteMap
          style={[s.basketMap, { height: basketMapHeight }]}
          points={basketMapPoints}
          line={basketRouteLine.length > 1 ? basketRouteLine : basketMapPoints}
          segments={basketRouteSegments}
          recenterPoint={mapFocusRequest.point}
          recenterToken={mapFocusRequest.token}
          markers={[
            { ...origin, label: "현재 위치", kind: "origin" },
            ...selected.map((spot) => ({
              ...spot,
              label: spot.title,
              kind: "spot" as const,
            })),
            ...(ctx.appointment
              ? [
                  {
                    ...target,
                    label: ctx.appointment.label,
                    kind: "appointment" as const,
                  },
                ]
              : []),
          ]}
          boundsPadding={{
            top: insets.top + 58,
            right: 18,
            bottom: 18,
            left: 18,
          }}
        />
      ) : null}
      {page === "basket" ? (
        <Pressable
          style={[s.mapLocationButton, { top: basketMapHeight - 54 }]}
          onPress={() => requestMapFocus(origin)}
          accessibilityLabel="현재 위치로 지도 이동"
        >
          <Feather color={C.txt} name="crosshair" size={21} />
        </Pressable>
      ) : null}
      {page === "recommend" && sheetPosition !== "expanded" ? (
        <View style={[s.mapTopBar, { top: insets.top + 8 }]}>
          <Pressable
            style={s.mapBackButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="시간 설정으로 돌아가기"
          >
            <Feather color={C.txt} name="arrow-left" size={22} />
          </Pressable>
          <View style={s.timePill}>
            <Text style={s.timePillValue}>코스 만들기 · {ctx.remainingMin}분 남음</Text>
          </View>
          <Pressable
            style={s.mapCartButton}
            onPress={() => setPage("basket")}
            accessibilityLabel={`장바구니, ${selected.length}곳 선택됨`}
          >
            <Feather color={C.txt} name="shopping-bag" size={21} />
            <View style={s.mapCartCount}>
              <Text style={s.mapCartCountText}>{selected.length}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
      {page === "basket" ? (
        <View style={[s.basketMapBar, { top: insets.top + 8 }]}>
          <Pressable
            style={s.mapBackButton}
            onPress={() => setPage("recommend")}
            accessibilityRole="button"
            accessibilityLabel="추천 장소 목록으로 돌아가기"
          >
            <Feather color={C.txt} name="arrow-left" size={22} />
          </Pressable>
        </View>
      ) : null}
      <Animated.View
        style={
          page === "recommend"
            ? [
                s.candidateSheet,
                sheetPosition === "expanded" && s.candidateSheetExpanded,
                {
                  height: expandedSheetHeight,
                  transform: [{ translateY: sheetTranslateY }],
                },
              ]
            : [s.pageSurface, { marginTop: basketMapHeight }]
        }
      >
        {page === "recommend" ? (
          <View style={s.sheetTop}>
            <View
              {...sheetPanResponder.panHandlers}
              accessibilityLabel={
                sheetPosition === "collapsed"
                  ? "장소 목록 펼치기"
                  : sheetPosition === "expanded"
                    ? "장소 목록 기본 크기로 줄이기"
                    : "장소 목록 펼치기"
              }
              style={s.sheetDragArea}
            >
              <View style={s.sheetHandle} />
            </View>
            {sheetPosition === "expanded" ? (
              <View style={s.expandedHeader}>
                <Pressable
                  style={s.expandedHeaderButton}
                  onPress={() => navigation.goBack()}
                  accessibilityLabel="시간 설정으로 돌아가기"
                >
                  <Feather color={C.txt} name="arrow-left" size={21} />
                </Pressable>
                <Text style={s.expandedHeaderTitle}>
                  장소 후보 {filtered.length}
                </Text>
                <Pressable
                  style={s.expandedHeaderButton}
                  onPress={() => setPage("basket")}
                  accessibilityLabel={`장바구니, ${selected.length}곳 선택됨`}
                >
                  <Feather color={C.txt} name="shopping-bag" size={20} />
                  <View style={s.mapCartCount}>
                    <Text style={s.mapCartCountText}>{selected.length}</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
        <ScrollView
          ref={page === "recommend" ? candidateListRef : undefined}
          style={s.contentScroll}
          contentContainerStyle={[
            s.scroll,
            page === "recommend" && s.candidateSheetScroll,
            page === "basket" && s.basketScroll,
          ]}
        >
          {page === "basket" ? (
            <View style={s.pageBlock}>
              <View style={s.basket}>
                <View style={s.basketHead}>
                  <Text style={s.basketTitle}>내 코스 바구니</Text>
                  <Text style={s.basketMeta}>
                    담은 장소 {selected.length}개
                  </Text>
                </View>
                {selected.length > 1 ? (
                  <Pressable style={s.autoSortBtn} onPress={autoSortSelected}>
                    <Text style={s.autoSortTxt}>↻ 최적 순서로 정렬</Text>
                  </Pressable>
                ) : null}
                {selected.length ? (
                  <Text style={s.orderNote}>
                    현재 위치 → {selected.map((spot) => spot.title).join(" → ")}{" "}
                    → {ctx.appointment ? ctx.appointment.label : "출발지"}
                  </Text>
                ) : null}
                {selected.length ? (
                  <View style={s.selectedList}>
                    {selected.map((spot, i) => (
                      <View key={spot.contentId} style={s.selectedChip}>
                        <View style={s.selectedInfo}>
                          <Text style={s.selectedTxt}>
                            {i + 1}. {spot.title}
                          </Text>
                          <Text style={s.selectedMeta}>
                            {spot.category} · {MODE_LABEL[basketCourse?.legs[i * 2]?.mode ?? "transit"]} · 이동{" "}
                            {basketCourse?.legs[i * 2]?.min ?? 0}분 · 체류{" "}
                            {basketCourse?.legs[i * 2 + 1]?.min ?? 0}분
                          </Text>
                        </View>
                        <View style={s.orderControls}>
                          <Pressable
                            style={[s.orderBtn, i === 0 && s.orderBtnOff]}
                            disabled={i === 0}
                            onPress={() => moveSpot(i, -1)}
                            accessibilityLabel={`${spot.title} 순서 올리기`}
                          >
                            <Text
                              style={[
                                s.orderBtnTxt,
                                i === 0 && s.orderBtnTxtOff,
                              ]}
                            >
                              ↑
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              s.orderBtn,
                              i === selected.length - 1 && s.orderBtnOff,
                            ]}
                            disabled={i === selected.length - 1}
                            onPress={() => moveSpot(i, 1)}
                            accessibilityLabel={`${spot.title} 순서 내리기`}
                          >
                            <Text
                              style={[
                                s.orderBtnTxt,
                                i === selected.length - 1 && s.orderBtnTxtOff,
                              ]}
                            >
                              ↓
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => removeSpot(spot.contentId)}
                            hitSlop={8}
                          >
                            <Text style={s.removeTxt}>제거</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.emptySmall}>
                    추천 장소에서 마음에 드는 장소를 먼저 담아주세요.
                  </Text>
                )}
                <View style={s.basketStats}>
                  <View style={s.stat}>
                    <Text style={s.statLbl}>이동</Text>
                    <Text style={s.statVal}>{selectedMoveMin}분</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statLbl}>체류 가능</Text>
                    <Text style={s.statVal}>
                      {Math.round(selectedStayPool)}분
                    </Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statLbl}>여유</Text>
                    <Text style={s.statVal}>
                      {Math.round(selectedBufferLeft)}분
                    </Text>
                  </View>
                </View>
                {basketCourse ? (
                  <View style={s.routeSummary}>
                    <Text style={s.routeSummaryTitle}>이동 순서와 시간</Text>
                    {basketCourse.legs.map((leg, index) => (
                      <View
                        key={`${leg.label}-${index}`}
                        style={s.routeSummaryRow}
                      >
                        <Text style={s.routeSummaryLabel} numberOfLines={1}>
                          {leg.mode ? `${MODE_LABEL[leg.mode]} · ${leg.label}` : leg.label}
                        </Text>
                        <Text style={s.routeSummaryMin}>{leg.min}분</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  style={[s.cta, (!selected.length || isSavingCourse) && s.ctaOff]}
                  disabled={!selected.length || isSavingCourse}
                  onPress={confirmCourse}
                >
                  <Text style={s.ctaTxt}>
                    {isSavingCourse
                      ? "코스 저장 중..."
                      : selected.length
                      ? editingCourseId
                        ? "변경 적용 후 길찾기 시작"
                        : "코스 저장 후 길찾기 시작"
                      : "장소를 먼저 담아주세요"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={s.flabel}>분위기</Text>
              <View style={s.row}>
                {MOODS.map((m) => (
                  <Chip
                    key={m}
                    active={moods.has(m)}
                    onPress={() => toggle(moods, m, setMoods)}
                    text={m}
                  />
                ))}
              </View>
              <Text style={s.flabel}>활동</Text>
              <View style={s.row}>
                {ACTS.map((a) => (
                  <Chip
                    key={a}
                    active={acts.has(a)}
                    onPress={() => toggle(acts, a, setActs)}
                    text={a}
                  />
                ))}
              </View>

              <View style={s.countRow}>
                <Text style={s.count}>장소 후보 {filtered.length}</Text>
              </View>
              {filtered.length === 0 && (
                <Text style={s.empty}>
                  이 필터에 맞는 장소가 없어요. 필터를 줄여보세요.
                </Text>
              )}

              {filtered.map((item) => {
                const isSelected = selectedIds.includes(item.spot.contentId);
                const status = statusStyle(item.status);
                return (
                  <Pressable
                    key={item.spot.contentId}
                    onLayout={(event) =>
                      candidateOffsets.current.set(
                        item.spot.contentId,
                        event.nativeEvent.layout.y,
                      )
                    }
                    style={[
                      s.card,
                      isSelected && s.cardOn,
                      focusedSpotId === item.spot.contentId && s.cardFocused,
                    ]}
                    disabled={isSelected || item.siteConflict}
                    onPress={() => openCandidateFromSheet(item)}
                    accessibilityLabel={
                      isSelected
                        ? `${item.spot.title}, 장바구니에 담김`
                        : item.siteConflict
                          ? `${item.spot.title}, 같은 단지 장소가 이미 담김`
                          : `${item.spot.title} 상세 보기`
                    }
                  >
                    <View style={s.cardHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardType}>
                          {distanceFromOriginLabel(origin, item.spot)} · {item.spot.category}
                        </Text>
                        <Text style={s.spotName}>{item.spot.title}</Text>
                        <View style={s.modeAvailability}>
                          {(["walk", "transit", "car"] as Mode[]).map((mode) => {
                            const available = item.availableModes.includes(mode);
                            return (
                              <View
                                key={mode}
                                style={[s.modeAvailabilityIcon, !available && s.modeAvailabilityIconOff]}
                                accessibilityLabel={`${MODE_LABEL[mode]} ${available ? "가능" : "불가"}`}
                              >
                                <TransportGlyph
                                  mode={mode}
                                  color={available ? C.green : C.muted}
                                  size={17}
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>
                      <View style={[s.status, status.box]}>
                        <Text style={[s.statusTxt, status.txt]}>
                          {isSelected
                            ? "담김"
                            : item.siteConflict
                              ? "같은 단지"
                              : STATUS_LABEL[item.status]}
                        </Text>
                      </View>
                    </View>
                    {!isSelected && !item.siteConflict ? (
                      <Feather
                        color={C.muted}
                        name="chevron-right"
                        size={19}
                        style={s.cardChevron}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>
      <Modal
        visible={Boolean(pendingTransportItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingTransportItem(null)}
      >
        <Pressable
          style={s.transportModalBackdrop}
          onPress={() => setPendingTransportItem(null)}
        >
          <Pressable style={s.transportModal} onPress={() => undefined}>
            <View style={s.transportModalHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.transportModalEyebrow}>이 장소로 이동</Text>
                <Text style={s.transportModalTitle} numberOfLines={1}>
                  {pendingTransportItem?.spot.title}
                </Text>
              </View>
              <Pressable
                style={s.transportModalClose}
                onPress={() => setPendingTransportItem(null)}
                accessibilityLabel="장소 미리보기 닫기"
              >
                <Feather color={C.txt2} name="x" size={20} />
              </Pressable>
            </View>
            {(() => {
              const chosen = pendingTransportScenarios.find(
                (scenario) => scenario.mode === chosenArrivalMode,
              );
              const disabled = !chosen || chosen.status === "over";
              return (
                <>
                  <View style={s.routePreview}>
                      <View style={s.routePreviewLine}>
                        <View style={s.routePreviewPoint}>
                          <Feather color={C.accent} name="navigation" size={17} />
                          <Text style={s.routePreviewPointLabel}>출발</Text>
                        </View>
                        <View style={s.routePreviewLeg}>
                          <View style={[s.routePreviewDash, { borderColor: transportColor(chosenArrivalMode) }]} />
                          <View style={[s.routePreviewLegIcon, { borderColor: transportColor(chosenArrivalMode) }]}>
                            <TransportGlyph mode={chosenArrivalMode} color={transportColor(chosenArrivalMode)} size={17} />
                          </View>
                          <Text style={s.routePreviewLegTime}>{chosen?.approachMin ?? "-"}분</Text>
                        </View>
                        <View style={s.routePreviewPoint}>
                          <Feather color={C.green} name="map-pin" size={17} />
                          <Text style={s.routePreviewPointLabel}>장소</Text>
                        </View>
                        <View style={s.routePreviewLeg}>
                          {chosen ? (
                            <>
                              <View style={[s.routePreviewDash, { borderColor: transportColor(chosen.onwardMode) }]} />
                              <View style={[s.routePreviewLegIcon, { borderColor: transportColor(chosen.onwardMode) }]}>
                                <TransportGlyph mode={chosen.onwardMode} color={transportColor(chosen.onwardMode)} size={17} />
                              </View>
                              <Text style={s.routePreviewLegTime}>{chosen.onwardMin}분</Text>
                            </>
                          ) : null}
                        </View>
                      <View style={s.routePreviewPoint}>
                        <Feather color={C.amber} name="calendar" size={16} />
                        <Text style={s.routePreviewPointLabel}>약속</Text>
                      </View>
                    </View>
                    <View style={s.timeVisualRow}>
                      <View style={s.timeVisualMetric}>
                        <Text style={s.timeVisualMove}>
                          {Math.round((chosen?.approachMin ?? 0) + (chosen?.onwardMin ?? 0))}분
                        </Text>
                        <Text style={s.timeVisualLabel}>이동</Text>
                      </View>
                      <View style={s.timeVisualDivider} />
                      <View style={s.timeVisualMetric}>
                        <Text style={s.timeVisualStay}>{chosen?.stayPossibleMin ?? 0}분</Text>
                        <Text style={s.timeVisualLabel}>이곳 체류 가능</Text>
                      </View>
                      <View style={s.timeVisualDivider} />
                      <View style={s.timeVisualMetric}>
                        <Text style={s.timeVisualRemaining}>{Math.max(0, Math.round(chosen?.bufferLeftMin ?? 0))}분</Text>
                        <Text style={s.timeVisualLabel}>남는 시간</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.compactModePicker}>
                    {pendingTransportScenarios.map((scenario) => {
                      const active = scenario.mode === chosenArrivalMode;
                      return (
                        <Pressable
                          key={scenario.mode}
                          disabled={scenario.status === "over"}
                          onPress={() => {
                            setTransportModeTouched(true);
                            setChosenArrivalMode(scenario.mode);
                          }}
                          style={[
                            s.compactMode,
                            active && s.compactModeOn,
                            scenario.status === "over" && s.compactModeOff,
                          ]}
                          accessibilityLabel={`${MODE_LABEL[scenario.mode]} ${scenario.approachMin}분`}
                        >
                          <TransportGlyph
                            mode={scenario.mode}
                            color={active ? C.accent : C.txt2}
                          />
                          <Text style={[s.compactModeTime, active && s.compactModeTimeOn]}>
                            {scenario.status === "over" ? "-" : `${scenario.approachMin}분`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    disabled={disabled}
                    onPress={addSpotWithTransport}
                    style={[s.transportConfirmButton, disabled && s.transportConfirmButtonOff]}
                  >
                    <Text style={[s.transportConfirmText, disabled && s.transportConfirmTextOff]}>
                      {disabled ? "시간 안에 담기 어려워요" : "장바구니에 담기"}
                    </Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
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
  pageSurface: { flex: 1 },
  candidateMap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  basketMap: { position: "absolute", top: 0, right: 0, left: 0, zIndex: 0 },
  basketMapBar: { position: "absolute", left: 16, zIndex: 3 },
  mapTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mapBackButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderColor: C.line,
    borderWidth: 1,
    backgroundColor: "rgba(31,32,35,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  timePill: {
    flex: 1,
    height: 42,
    paddingHorizontal: 11,
    justifyContent: "center",
    borderRadius: 12,
    borderColor: C.line,
    borderWidth: 1,
    backgroundColor: "rgba(31,32,35,0.92)",
  },
  timePillValue: {
    color: C.txt,
    fontSize: 13.5,
    fontWeight: "800",
  },
  mapCartButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderColor: C.line,
    borderWidth: 1,
    backgroundColor: "rgba(31,32,35,0.92)",
  },
  mapLocationButton: {
    position: "absolute",
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "rgba(31,32,35,0.94)",
    zIndex: 3,
  },
  mapCartCount: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.bg,
  },
  mapCartCountText: { color: C.onAccent, fontSize: 10.5, fontWeight: "900" },
  candidateSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderColor: C.line,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  candidateSheetExpanded: { zIndex: 4 },
  contentScroll: { flex: 1 },
  scroll: { padding: 18, paddingTop: 8 },
  candidateSheetScroll: { paddingTop: 0, paddingBottom: 120 },
  basketScroll: { paddingTop: 18, paddingBottom: 120 },
  sheetTop: { backgroundColor: C.panel },
  // 시트 최상단만 높이 전환 제스처를 받고, 후보 카드 영역은 목록 스크롤만 처리한다.
  sheetDragArea: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4a4c52",
  },
  expandedHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  expandedHeaderButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
  },
  expandedHeaderTitle: {
    flex: 1,
    color: C.txt,
    fontSize: 17,
    fontWeight: "800",
  },
  pageBlock: { marginTop: 4 },
  basket: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  basketHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  basketTitle: { color: C.txt, fontSize: 16, fontWeight: "900" },
  basketMeta: { color: C.accent, fontSize: 12.5, fontWeight: "800" },
  autoSortBtn: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(76,194,255,0.45)",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(76,194,255,0.08)",
  },
  autoSortTxt: { color: C.accent, fontSize: 12, fontWeight: "900" },
  orderNote: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 9 },
  selectedList: { gap: 7, marginTop: 10 },
  selectedChip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.panel2,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  selectedInfo: { flex: 1, minWidth: 0 },
  selectedTxt: { color: C.txt, fontSize: 13.5, fontWeight: "700" },
  selectedMeta: { color: C.muted, fontSize: 11.5, marginTop: 3 },
  orderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginLeft: 8,
  },
  orderBtn: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
  },
  orderBtnOff: { opacity: 0.35 },
  orderBtnTxt: { color: C.accent, fontSize: 16, fontWeight: "900" },
  orderBtnTxtOff: { color: C.muted },
  removeTxt: { color: C.red, fontSize: 12, fontWeight: "800" },
  emptySmall: { color: C.muted, fontSize: 12.5, marginTop: 8 },
  basketStats: { flexDirection: "row", gap: 8, marginTop: 12 },
  routeSummary: {
    marginTop: 12,
    borderTopColor: C.line,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 7,
  },
  routeSummaryTitle: {
    color: C.txt2,
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  routeSummaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeSummaryLabel: { color: C.muted, flex: 1, fontSize: 12 },
  routeSummaryMin: { color: C.txt, fontSize: 12, fontWeight: "800" },
  stat: {
    flex: 1,
    backgroundColor: C.panel2,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  statLbl: {
    color: C.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  statVal: { color: C.txt, fontSize: 13.5, fontWeight: "900" },
  cta: {
    minHeight: 52,
    marginTop: 12,
    backgroundColor: C.accent,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaOff: { backgroundColor: C.panel2 },
  ctaTxt: { color: C.onAccent, fontSize: 16, fontWeight: "800" },
  flabel: {
    color: C.txt2,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  countRow: { marginTop: 16, marginBottom: 4 },
  count: {
    color: C.muted,
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  empty: { color: C.amber, fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 74,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  cardOn: { borderColor: C.green, backgroundColor: "rgba(126,231,135,0.08)" },
  cardFocused: { borderColor: C.accent, borderWidth: 2 },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 0,
  },
  cardType: { color: C.green, fontWeight: "800", fontSize: 12 },
  spotName: { color: C.txt, fontSize: 16, fontWeight: "800", marginTop: 3 },
  modeAvailability: { flexDirection: "row", gap: 8, marginTop: 9 },
  modeAvailabilityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(126,231,135,0.12)",
  },
  modeAvailabilityIconOff: { opacity: 0.35, backgroundColor: C.panel2 },
  cardChevron: { marginLeft: 2 },
  status: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderWidth: 1,
  },
  statusTxt: { fontSize: 11.5, fontWeight: "900" },
  statusGood: {
    borderColor: C.green,
    backgroundColor: "rgba(126,231,135,0.12)",
  },
  statusGoodTxt: { color: C.green },
  statusShort: {
    borderColor: C.accent,
    backgroundColor: "rgba(76,194,255,0.12)",
  },
  statusShortTxt: { color: C.accent },
  statusTight: {
    borderColor: C.amber,
    backgroundColor: "rgba(227,179,65,0.12)",
  },
  statusTightTxt: { color: C.amber },
  statusOver: { borderColor: C.red, backgroundColor: "rgba(255,123,114,0.1)" },
  statusOverTxt: { color: C.red },
  transportModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.58)",
    padding: 16,
  },
  transportModal: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    paddingBottom: 16,
  },
  transportModalHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  transportModalEyebrow: { color: C.accent, fontSize: 12, fontWeight: "800" },
  transportModalTitle: { color: C.txt, fontSize: 19, fontWeight: "900", marginTop: 3 },
  transportModalClose: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    backgroundColor: C.panel2,
  },
  routePreview: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
    padding: 12,
  },
  routePreviewLine: { flexDirection: "row", alignItems: "flex-start" },
  routePreviewPoint: { alignItems: "center", width: 38 },
  routePreviewPointLabel: { color: C.muted, fontSize: 9.5, fontWeight: "800", marginTop: 4 },
  routePreviewLeg: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingTop: 2,
    position: "relative",
  },
  routePreviewDash: {
    position: "absolute",
    top: 13,
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
  },
  routePreviewLegIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  routePreviewLegTime: { color: C.txt2, fontSize: 11, fontWeight: "900", marginTop: 4 },
  timeVisualRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: C.line,
  },
  timeVisualMetric: { flex: 1, alignItems: "center" },
  timeVisualDivider: { width: 1, height: 34, backgroundColor: C.line },
  timeVisualMove: { color: C.txt, fontSize: 20, fontWeight: "900", marginTop: 2 },
  timeVisualStay: { color: C.txt, fontSize: 21, fontWeight: "900", marginTop: 2 },
  timeVisualRemaining: { color: C.green, fontSize: 20, fontWeight: "900", marginTop: 2 },
  timeVisualLabel: { color: C.muted, fontSize: 10.5, fontWeight: "800", marginTop: 3 },
  compactModePicker: { flexDirection: "row", gap: 8, marginTop: 12 },
  compactMode: {
    flex: 1,
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 9,
    backgroundColor: C.panel2,
  },
  compactModeOn: { borderColor: C.accent, backgroundColor: "rgba(76,194,255,0.12)" },
  compactModeOff: { opacity: 0.38 },
  compactModeTime: { color: C.txt2, fontSize: 11.5, fontWeight: "900" },
  compactModeTimeOn: { color: C.accent },
  transportConfirmButton: {
    minHeight: 50,
    marginTop: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
  },
  transportConfirmButtonOff: { backgroundColor: C.panel2 },
  transportConfirmText: { color: C.onAccent, fontSize: 14, fontWeight: "900" },
  transportConfirmTextOff: { color: C.muted },
});
