import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Slider from "@react-native-community/slider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Linking,
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
  LatLon,
  Mode,
  safetyBufferMin,
  Spot,
  travelMin,
  validateCourseOpening,
} from "../engine";
import {
  createActualRouteSearchScope,
  isPointInActualRouteSearchScope,
} from "../engine/actualRouteSearchScope";
import { RootStackParamList, fmtHM } from "./nav";
import { C } from "./theme";
import { useAppFlow } from "./AppFlowContext";
import { FloatingTabBar } from "./FloatingTabBar";
import {
  resetToMain,
  resetToMyCourses,
  resetToProfile,
} from "./mainTabNavigation";
import { buildRouteMapSegments, KakaoRouteMap } from "./KakaoRouteMap";
import { precompute, precomputeTransit } from "../engine/travel";
import { CandidateList } from "./recommendation/CandidateList";
import {
  CandidateEval,
  TransportScenario,
} from "./recommendation/types";
import {
  candidateListEndSpace,
  mapFocusOffsetY,
  recommendationSheetLayout,
} from "./recommendation/sheetLayout";
import {
  buildBasketCourse,
  optimizeBasketSpotOrder,
} from "./recommendation/basketPlanner";
import {
  candidateRecommendations,
  uniqueCandidateSpots,
} from "./recommendation/candidateModel";
import {
  evaluateCandidates,
  filterCandidateEvaluations,
  transportScenarioForCandidate,
} from "./recommendation/candidateEvaluation";
import { useRecommendationSheet } from "./recommendation/useRecommendationSheet";
import { CandidateDetail } from "./recommendation/CandidateDetail";
import { BasketPanel } from "./recommendation/BasketPanel";
import {
  MapIconButton,
  RecommendationMapTopBar,
} from "./recommendation/MapControls";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;
const DEFAULT_RADIUS_KM = 1;
const MAX_RADIUS_KM = 8;

export function ResultsScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { result, origin, ctx, editingCourseId } = route.params;
  const flow = useAppFlow();
  const { saveCourse, replaceCourse, setActiveCourse, setLatestResults } = flow;
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [candidateRadiusKm, setCandidateRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    route.params.selectedIds ?? [],
  );
  const [page, setPage] = useState<"recommend" | "basket">(
    route.params.initialPage ?? "recommend",
  );
  const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState({
    point: origin,
    token: 0,
  });
  const [selectedArrivalModes, setSelectedArrivalModes] = useState<
    Partial<Record<string, Mode>>
  >({});
  const [pendingTransportItem, setPendingTransportItem] =
    useState<CandidateEval | null>(null);
  const [chosenArrivalMode, setChosenArrivalMode] = useState<Mode>("walk");
  const [transportModeTouched, setTransportModeTouched] = useState(false);
  const [basketRouteVersion, setBasketRouteVersion] = useState(0);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const sheetLayout = useMemo(
    () =>
      recommendationSheetLayout({
        windowHeight,
        insetTop: insets.top,
        insetBottom: insets.bottom,
      }),
    [insets.bottom, insets.top, windowHeight],
  );
  const {
    defaultHeight: defaultSheetHeight,
    expandedHeight: expandedSheetHeight,
  } = sheetLayout;
  const requestMapFocusForSheetChange = useCallback(() => {
    setMapFocusRequest((previous) => ({
      ...previous,
      token: previous.token + 1,
    }));
  }, []);
  const {
    moveSheet,
    panHandlers: sheetPanHandlers,
    resetSheet,
    sheetPosition,
    sheetTranslateY,
  } = useRecommendationSheet({
    layout: sheetLayout,
    onPositionChange: requestMapFocusForSheetChange,
  });
  const mapFocusOffsetYForSheet = mapFocusOffsetY(
    sheetLayout,
    sheetPosition,
    insets.bottom,
  );
  const candidateListBottomSpace = candidateListEndSpace(
    sheetLayout,
    sheetPosition,
    insets.bottom,
  );
  const candidateListRef = useRef<ScrollView>(null);
  const candidateOffsets = useRef(new Map<string, number>());
  const detailTranslateY = useRef(new Animated.Value(28)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;

  const requestMapFocus = useCallback((point: LatLon) => {
    setMapFocusRequest((previous) => ({ point, token: previous.token + 1 }));
  }, []);

  const target = ctx.appointment
    ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon }
    : origin;
  const endMin = ctx.startMin + ctx.remainingMin;
  // 이전 화면 파라미터가 남아도 새 탐색 필드가 없어 렌더링이 중단되지 않게 한다.
  const spatialCandidates = result.spatialCandidates ?? [];
  const routeBaselines = result.routeBaselines ?? [];
  const allCourses = useMemo(
    () => [...result.courses, ...result.pending],
    [result.courses, result.pending],
  );
  const allSpatialSpots = useMemo(
    () => spatialCandidates.length ? spatialCandidates : uniqueCandidateSpots(allCourses),
    [allCourses, spatialCandidates],
  );
  const visibleSearchScope = useMemo(
    () => createActualRouteSearchScope({
      origin,
      destination: ctx.appointment ? target : null,
      radiusM: candidateRadiusKm * 1000,
      baselines: routeBaselines,
    }),
    [candidateRadiusKm, ctx.appointment, origin, routeBaselines, target],
  );
  const radiusVisibleSpots = useMemo(
    () => allSpatialSpots.filter((spot) => isPointInActualRouteSearchScope(spot, visibleSearchScope)),
    [allSpatialSpots, visibleSearchScope],
  );
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => allSpatialSpots.find((spot) => spot.contentId === id))
        .filter(Boolean) as Spot[],
    [allSpatialSpots, selectedIds],
  );
  // 반경을 다시 줄여도 이미 장바구니에 담은 장소는 계속 확인·삭제할 수 있어야 한다.
  const spots = useMemo(() => {
    const byId = new Map(radiusVisibleSpots.map((spot) => [spot.contentId, spot]));
    selected.forEach((spot) => byId.set(spot.contentId, spot));
    return [...byId.values()];
  }, [radiusVisibleSpots, selected]);
  const recommendationById = useMemo(
    () => candidateRecommendations(allCourses),
    [allCourses],
  );
  const selectedTravelPlan = useMemo(
    () => automaticTravelLegs(selected, origin, target, selectedArrivalModes),
    [origin, selected, selectedArrivalModes, target],
  );
  const selectedMoveMin = selectedTravelPlan.reduce(
    (sum, leg) => sum + travelMin(leg.from, leg.to, leg.mode),
    0,
  );
  const buffer = Math.max(
    ...selectedTravelPlan.map((leg) => safetyBufferMin(leg.mode)),
  );
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
      resetSheet();
    }
  }, [page, resetSheet]);

  useEffect(() => {
    if (page !== "basket" || !selected.length) return;
    const plans = automaticTravelLegs(
      selected,
      origin,
      target,
      selectedArrivalModes,
    );

    let alive = true;
    const timer = setTimeout(() => {
      // 장바구니의 각 구간을 자동 수단으로 정밀화한다. 같은 좌표쌍·수단은 24시간 캐시를 재사용한다.
      Promise.all(
        plans.map((plan) =>
          plan.mode === "transit"
            ? precomputeTransit([[plan.from, plan.to]], { retryFallback: true })
            : precompute([[plan.from, plan.to]], plan.mode, {
                retryFallback: true,
              }),
        ),
      ).finally(() => {
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

  const candidateEvaluationInput = useMemo(
    () => ({
      spots,
      selected,
      selectedIds,
      origin,
      target,
      hasAppointment: Boolean(ctx.appointment),
      remainingMin: ctx.remainingMin,
      selectedArrivalModes,
      recommendationById,
    }),
    [
      ctx.appointment,
      ctx.remainingMin,
      origin,
      recommendationById,
      selected,
      selectedArrivalModes,
      selectedIds,
      spots,
      target,
    ],
  );
  const evals = useMemo(
    () => evaluateCandidates(candidateEvaluationInput),
    [candidateEvaluationInput],
  );
  const filtered = useMemo(
    () => filterCandidateEvaluations(evals, categoryFilter, selectedIds)
      .filter((item) => selectedIds.includes(item.spot.contentId) || item.status !== "over"),
    [categoryFilter, evals, selectedIds],
  );
  const transportScenario = useCallback(
    (spot: Spot, mode: Mode): TransportScenario =>
      transportScenarioForCandidate(candidateEvaluationInput, spot, mode),
    [candidateEvaluationInput],
  );

  const pendingTransportScenarios = useMemo(() => {
    if (!pendingTransportItem) return [];
    return (["walk", "transit", "car"] as Mode[]).map((mode) =>
      transportScenario(pendingTransportItem.spot, mode),
    );
  }, [
    pendingTransportItem,
    selected,
    selectedArrivalModes,
    origin,
    target,
    ctx.remainingMin,
  ]);

  useEffect(() => {
    if (!pendingTransportItem || transportModeTouched) return;
    // 자차·택시 여부를 앱이 임의로 가정하지 않도록 기본 추천에서는 차량을 뒤로 둔다.
    const suggested = [...pendingTransportScenarios]
      .filter((scenario) => scenario.status !== "over")
      .sort((a, b) => {
        const aVehiclePenalty = a.mode === "car" ? 1 : 0;
        const bVehiclePenalty = b.mode === "car" ? 1 : 0;
        return (
          aVehiclePenalty - bVehiclePenalty || b.bufferLeftMin - a.bufferLeftMin
        );
      })[0];
    if (suggested) setChosenArrivalMode(suggested.mode);
  }, [pendingTransportItem, pendingTransportScenarios, transportModeTouched]);

  function openTransportPicker(evalItem: CandidateEval) {
    if (selectedIds.includes(evalItem.spot.contentId) || evalItem.siteConflict)
      return;
    const previous = selected[selected.length - 1] ?? origin;
    setChosenArrivalMode(automaticLegMode(previous, evalItem.spot));
    setTransportModeTouched(false);
    detailTranslateY.setValue(28);
    detailOpacity.setValue(0);
    setPendingTransportItem(evalItem);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(detailTranslateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(detailOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  function openCandidateFromSheet(evalItem: CandidateEval) {
    if (selectedIds.includes(evalItem.spot.contentId) || evalItem.siteConflict)
      return;
    setFocusedSpotId(evalItem.spot.contentId);
    requestMapFocus(evalItem.spot);
    openTransportPicker(evalItem);
  }

  function closeCandidateDetail() {
    Animated.parallel([
      Animated.timing(detailTranslateY, {
        toValue: 28,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(detailOpacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => setPendingTransportItem(null));
  }

  async function openKakaoPlace(spot: Spot) {
    const fallback = `https://map.kakao.com/link/map/${encodeURIComponent(spot.title)},${spot.lat},${spot.lon}`;
    try {
      await Linking.openURL(spot.kakaoPlaceUrl ?? fallback);
    } catch {
      Alert.alert("카카오맵을 열 수 없어요", "잠시 후 다시 시도해 주세요.");
    }
  }

  async function addSpotWithTransport() {
    if (!pendingTransportItem) return;
    const scenario = pendingTransportScenarios.find(
      (item) => item.mode === chosenArrivalMode,
    );
    if (!scenario || scenario.status === "over") return;
    const contentId = pendingTransportItem.spot.contentId;
    const nextArrivalModes = { ...selectedArrivalModes, [contentId]: chosenArrivalMode };
    const trial = [...selected, pendingTransportItem.spot];
    const plans = automaticTravelLegs(trial, origin, target, nextArrivalModes);
    setIsAddingSpot(true);
    try {
      await Promise.all(
        plans.map((plan) => plan.mode === "transit"
          ? precomputeTransit([[plan.from, plan.to]], { retryFallback: true })
          : precompute([[plan.from, plan.to]], plan.mode, { retryFallback: true })),
      );
      const refined = buildBasketCourse(trial, origin, target, ctx, nextArrivalModes);
      const stayMins = refined.legs
        .filter((leg) => leg.label.startsWith("체류 가능"))
        .map((leg) => leg.min);
      const validation = await validateCourseOpening(
        trial,
        origin,
        target,
        plans.map((plan) => plan.mode),
        ctx.startMin,
        stayMins,
      );
      if (!validation.ok || !validation.exactRoute) {
        Alert.alert(
          "이 장소는 지금 담기 어려워요",
          validation.reason ?? "실제 경로를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }
      setSelectedArrivalModes(nextArrivalModes);
      // 이동수단은 "직전 지점 → 이 장소"에 대응하므로, 추가 순서를 자동으로 바꾸지 않는다.
      setSelectedIds((prev) => [...prev, contentId]);
      setBasketRouteVersion((version) => version + 1);
      closeCandidateDetail();
    } catch {
      Alert.alert("장소를 확인하지 못했어요", "실제 이동 경로를 다시 확인한 뒤 담아 주세요.");
    } finally {
      setIsAddingSpot(false);
    }
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
      return optimizeBasketSpotOrder(selectedSpots, origin, target).map(
        (spot) => spot.contentId,
      );
    });
  }

  async function confirmCourse() {
    if (!basketCourse || isSavingCourse) return;
    setIsSavingCourse(true);
    try {
      const plans = automaticTravelLegs(
        selected,
        origin,
        target,
        selectedArrivalModes,
      );
      await Promise.all(
        plans.map((plan) =>
          plan.mode === "transit"
            ? precomputeTransit([[plan.from, plan.to]], { retryFallback: true })
            : precompute([[plan.from, plan.to]], plan.mode, {
                retryFallback: true,
              }),
        ),
      );

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
        Alert.alert(
          "코스를 확정할 수 없어요",
          opening.reason ?? "운영시간을 다시 확인해 주세요.",
        );
        setBasketRouteVersion((version) => version + 1);
        return;
      }
      if (!opening.exactRoute) {
        Alert.alert(
          "실경로 확인이 필요해요",
          "일부 구간의 경로 API 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
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
      console.warn("[코스 저장] 실패", error);
      Alert.alert(
        "코스 저장 실패",
        error instanceof Error
          ? error.message
          : "저장한 뒤 다시 시도해 주세요.",
      );
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

  function renderCandidateDetail() {
    if (!pendingTransportItem) return null;
    return (
      <CandidateDetail
        item={pendingTransportItem}
        scenarios={pendingTransportScenarios}
        chosenMode={chosenArrivalMode}
        opacity={detailOpacity}
        translateY={detailTranslateY}
        onClose={closeCandidateDetail}
        onModeChange={(mode) => {
          setTransportModeTouched(true);
          setChosenArrivalMode(mode);
        }}
        onOpenKakaoPlace={openKakaoPlace}
        onAddToBasket={addSpotWithTransport}
        isAdding={isAddingSpot}
      />
    );
  }

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
          recenterOffsetY={mapFocusOffsetYForSheet}
          focusedMarkerOffsetY={mapFocusOffsetYForSheet}
          boundsPadding={{
            top: 184,
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
        <MapIconButton
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
          icon="crosshair"
        />
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
        <MapIconButton
          style={[s.mapLocationButton, { top: basketMapHeight - 54 }]}
          onPress={() => requestMapFocus(origin)}
          accessibilityLabel="현재 위치로 지도 이동"
          icon="crosshair"
        />
      ) : null}
      {page === "recommend" ? (
        <View style={[s.mapTopBar, { top: insets.top + 8 }]}>
          <RecommendationMapTopBar
            basketCount={selected.length}
            remainingMin={ctx.remainingMin}
            onBack={() => navigation.goBack()}
            onOpenBasket={() => setPage("basket")}
          />
        </View>
      ) : null}
      {page === "recommend" && sheetPosition !== "expanded" ? (
        <View style={[s.radiusControl, { top: insets.top + 62 }]}>
          <Text style={s.radiusValue}>{candidateRadiusKm}km</Text>
          <Slider
            accessibilityLabel="추천 장소 탐색 범위"
            minimumValue={DEFAULT_RADIUS_KM}
            maximumValue={MAX_RADIUS_KM}
            step={1}
            value={candidateRadiusKm}
            minimumTrackTintColor={C.accent}
            maximumTrackTintColor={C.line}
            thumbTintColor={C.accent}
            onValueChange={(value) => setCandidateRadiusKm(Math.round(value))}
            style={s.radiusSlider}
          />
          <Text style={s.radiusLimit}>8km</Text>
        </View>
      ) : null}
      {page === "basket" ? (
        <View style={[s.basketMapBar, { top: insets.top + 8 }]}>
          <MapIconButton
            onPress={() => setPage("recommend")}
            accessibilityLabel="추천 장소 목록으로 돌아가기"
            icon="arrow-left"
          />
        </View>
      ) : null}
      <Animated.View
        // 추천 시트의 native translateY가 장바구니 일반 레이아웃에 남지 않게 페이지별로 재마운트한다.
        key={page}
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
              {...sheetPanHandlers}
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
            {sheetPosition !== "collapsed" && !pendingTransportItem ? (
              <View style={s.sheetCandidateCount}>
                <Text style={s.sheetCandidateCountText}>장소 후보 {filtered.length}</Text>
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
            <BasketPanel
              appointmentLabel={ctx.appointment?.label}
              bufferLeftMin={selectedBufferLeft}
              course={basketCourse}
              isEditing={Boolean(editingCourseId)}
              isSaving={isSavingCourse}
              moveMin={selectedMoveMin}
              selected={selected}
              stayPoolMin={selectedStayPool}
              onAutoSort={autoSortSelected}
              onConfirm={confirmCourse}
              onMove={moveSpot}
              onRemove={removeSpot}
            />
          ) : pendingTransportItem ? (
            renderCandidateDetail()
          ) : (
            <CandidateList
              categoryFilter={categoryFilter}
              filtered={filtered}
              focusedSpotId={focusedSpotId}
              origin={origin}
              selectedIds={selectedIds}
              onCategoryChange={setCategoryFilter}
              onCandidateLayout={(contentId, y) => candidateOffsets.current.set(contentId, y)}
              onCandidatePress={openCandidateFromSheet}
            />
          )}
          <View
            style={{
              height: page === "recommend" ? candidateListBottomSpace : 120,
            }}
          />
        </ScrollView>
      </Animated.View>
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
    zIndex: 6,
  },
  radiusControl: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 38,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "rgba(31,32,35,0.92)",
    zIndex: 6,
  },
  radiusValue: { width: 30, color: C.txt, fontSize: 12, fontWeight: "900" },
  radiusSlider: { flex: 1, height: 30, marginHorizontal: 4 },
  radiusLimit: { width: 26, color: C.muted, fontSize: 11, fontWeight: "800", textAlign: "right" },
  mapLocationButton: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(31,32,35,0.94)",
    zIndex: 3,
  },
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
  candidateSheetExpanded: { zIndex: 7 },
  contentScroll: { flex: 1 },
  scroll: { padding: 18, paddingTop: 8 },
  candidateSheetScroll: { paddingTop: 0 },
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
  sheetCandidateCount: { paddingHorizontal: 18, paddingBottom: 8 },
  sheetCandidateCountText: { color: C.muted, fontSize: 12.5, fontWeight: "800" },
});
