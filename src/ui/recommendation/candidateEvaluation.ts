import {
  automaticLegMode,
  automaticTravelLegs,
  hasBalancedPaidVisit,
  minimumStayForCourse,
  minimumStayForSpot,
  safetyBufferMin,
  travelMin,
  type LatLon,
  type Mode,
  type Spot,
} from "../../engine";
import {
  diversifyCandidateGroup,
  evaluateCandidateStatus,
  type CandidateRecommendation,
} from "./candidateModel";
import type { CandidateEval, CandidateStatus, TransportScenario } from "./types";
import { MODE_LABEL } from "./types";

export type CandidateEvaluationInput = {
  spots: Spot[];
  selected: Spot[];
  selectedIds: string[];
  origin: LatLon;
  target: LatLon;
  hasAppointment: boolean;
  remainingMin: number;
  selectedArrivalModes: Partial<Record<string, Mode>>;
  recommendationById: Map<string, CandidateRecommendation>;
};

export function transportScenarioForCandidate(
  input: CandidateEvaluationInput,
  spot: Spot,
  mode: Mode,
): TransportScenario {
  const { selected, selectedArrivalModes, origin, target, remainingMin, hasAppointment } = input;
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
  const stayPool = Math.max(0, remainingMin - buffer - moveMin);
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

  const bufferLeftMin = remainingMin - moveMin - Math.min(stayPool, dwellTotal);
  const totalStayMin = Math.min(stayPool, dwellTotal);
  const remainingAfterPlannedMin = Math.max(0, remainingMin - moveMin - totalStayMin);
  const approaches = trial.map((_, index) => {
    const leg = plan[index];
    return travelMin(leg.from, leg.to, leg.mode);
  });
  const candidateMinStay = minimumStayForSpot(
    spot,
    approaches[trial.length - 1] ?? travelMin(incoming.from, incoming.to, incoming.mode),
  );
  const minCourseStay = minimumStayForCourse(trial, approaches);
  const directMove = hasAppointment
    ? travelMin(origin, target, automaticLegMode(origin, target))
    : 0;
  const addedMove = Math.max(0, moveMin - directMove);

  return {
    mode,
    approachMin: travelMin(incoming.from, incoming.to, incoming.mode),
    onwardMode: outgoing.mode,
    onwardMin: travelMin(outgoing.from, outgoing.to, outgoing.mode),
    totalMoveMin: moveMin,
    totalStayMin,
    remainingAfterPlannedMin,
    stayPossibleMin: candidateStay,
    bufferLeftMin,
    status: evaluateCandidateStatus(
      candidateStay,
      candidateMinStay,
      spot.dwell,
      bufferLeftMin,
      hasBalancedPaidVisit(trial, Math.min(stayPool, dwellTotal), addedMove),
      stayPool >= minCourseStay,
    ),
  };
}

export function evaluateCandidates(input: CandidateEvaluationInput): CandidateEval[] {
  const { spots, selected, selectedIds, recommendationById } = input;
  return spots.map((spot) => {
    const isSelected = selectedIds.includes(spot.contentId);
    const siteConflict =
      !isSelected &&
      Boolean(
        spot.siteGroupId &&
          selected.some((selectedSpot) => selectedSpot.siteGroupId === spot.siteGroupId),
      );
    const scenarios = (["walk", "transit", "car"] as Mode[]).map((mode) =>
      transportScenarioForCandidate(input, spot, mode),
    );
    const feasible = scenarios.filter((scenario) => scenario.status !== "over");
    const suggested = [...feasible].sort((a, b) => {
      const vehiclePenalty = Number(a.mode === "car") - Number(b.mode === "car");
      return vehiclePenalty || b.bufferLeftMin - a.bufferLeftMin;
    })[0];
    const status = isSelected
      ? "good"
      : siteConflict
        ? "over"
        : suggested?.status ?? "over";
    const recommendation = recommendationById.get(spot.contentId);
    const stayPossibleMin = suggested?.stayPossibleMin ?? 0;

    return {
      spot,
      moveMin: suggested ? suggested.approachMin + suggested.onwardMin : 0,
      stayPossibleMin,
      bufferLeftMin: suggested?.bufferLeftMin ?? -1,
      status,
      siteConflict,
      reason: isSelected
        ? "이미 담은 장소입니다"
        : siteConflict
          ? "이미 담은 장소와 같은 단지의 내부 공간이에요"
          : status === "over"
            ? "현재 코스 기준 시간 안에 담기 어려워요"
            : `${MODE_LABEL[suggested?.mode ?? "walk"]}로 담으면 약 ${stayPossibleMin}분 머물 수 있어요`,
      recommendationRank: recommendation?.rank ?? Number.MAX_SAFE_INTEGER,
      rankingScore: recommendation?.score ?? -Number.MAX_SAFE_INTEGER,
      availableModes: feasible.map((scenario) => scenario.mode),
      suggestedMode: suggested?.mode,
      recommendationStrategy: recommendation?.strategy,
      rankingWhy: recommendation?.why,
    };
  });
}

export function filterCandidateEvaluations(
  evals: CandidateEval[],
  categoryFilter: string | null,
  selectedIds: string[],
): CandidateEval[] {
  const activeFilter = categoryFilter !== null;
  const candidates = categoryFilter === null
    ? evals
    : evals.filter(({ spot }) => spot.category === categoryFilter);
  const statusRank: Record<CandidateStatus, number> = {
    good: 0,
    short: 1,
    tight: 2,
    over: 3,
  };
  const ordered = [...candidates].sort((a, b) => {
    const selectedDiff =
      Number(selectedIds.includes(b.spot.contentId)) -
      Number(selectedIds.includes(a.spot.contentId));
    return (
      selectedDiff ||
      statusRank[a.status] - statusRank[b.status] ||
      a.recommendationRank - b.recommendationRank ||
      b.rankingScore - a.rankingScore ||
      b.stayPossibleMin - a.stayPossibleMin
    );
  });
  if (activeFilter) return ordered;

  const selectedItems = ordered.filter((item) => selectedIds.includes(item.spot.contentId));
  const unselectedItems = ordered.filter((item) => !selectedIds.includes(item.spot.contentId));
  return [
    ...selectedItems,
    ...(["good", "short", "tight", "over"] as CandidateStatus[]).flatMap((status) =>
      diversifyCandidateGroup(unselectedItems.filter((item) => item.status === status)),
    ),
  ];
}
