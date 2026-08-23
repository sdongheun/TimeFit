import type { LatLon, Mode } from '../../engine';

export type OneStopMode = Extract<Mode, 'walk' | 'transit'>;
export type OneStopStatus = 'recommended' | 'short' | 'unavailable';

export type OneStopSpot = {
  contentId: string;
  title: string;
  lat: number;
  lon: number;
  category: string;
  dwell: number;
  minStayMin?: number;
  recommendedStayMin?: number;
  maxStayMin?: number;
};

export type OneStopRecommendation = {
  spot: OneStopSpot;
  mode: OneStopMode;
  approachMin: number;
  onwardMin: number;
  availableStayMin: number;
  minimumStayMin: number;
  recommendedStayMin: number;
  status: OneStopStatus;
};

type Input = {
  spots: OneStopSpot[];
  origin: LatLon;
  target: LatLon;
  remainingMin: number;
  arrivalBufferMin: number;
  includeUnavailable?: boolean;
  modes?: OneStopMode[];
  minimumStay?: (spot: OneStopSpot) => number;
  estimate: (input: {
    spot: OneStopSpot;
    mode: OneStopMode;
    origin: LatLon;
    target: LatLon;
  }) => { approachMin: number; onwardMin: number };
};

const MODES: OneStopMode[] = ['walk', 'transit'];

// AI-Hub의 단일 체류값은 권장값으로 유지한다. 최소값 데이터가 확정되기 전에는
// 권장 체류의 60% (최소 10분)를 짧게 가능한 체류 기준으로 사용한다.
export function defaultMinimumStay(spot: OneStopSpot): number {
  if (spot.minStayMin !== undefined) return spot.minStayMin;
  return Math.min(spot.dwell, Math.max(10, Math.round(spot.dwell * 0.6)));
}

export function buildOneStopRecommendations({
  spots,
  origin,
  target,
  remainingMin,
  arrivalBufferMin,
  includeUnavailable = false,
  modes = MODES,
  minimumStay = defaultMinimumStay,
  estimate,
}: Input): OneStopRecommendation[] {
  const output: OneStopRecommendation[] = [];

  for (const spot of spots) {
    const minimumStayMin = minimumStay(spot);
    const recommendedStayMin = spot.recommendedStayMin ?? spot.dwell;
    const alternatives = modes.map((mode) => {
      const travel = estimate({ spot, mode, origin, target });
      const availableStayMin = Math.max(
        0,
        Math.floor(remainingMin - arrivalBufferMin - travel.approachMin - travel.onwardMin),
      );
      const status: OneStopStatus = availableStayMin >= recommendedStayMin
        ? 'recommended'
        : availableStayMin >= minimumStayMin
          ? 'short'
          : 'unavailable';
      return { spot, mode, minimumStayMin, recommendedStayMin, availableStayMin, status, ...travel };
    });
    const best = alternatives.sort((a, b) => (
      statusRank(a.status) - statusRank(b.status)
      || b.availableStayMin - a.availableStayMin
      || a.approachMin + a.onwardMin - (b.approachMin + b.onwardMin)
      || (a.mode === 'walk' ? -1 : 1)
    ))[0];
    if (best && (includeUnavailable || best.status !== 'unavailable')) output.push(best);
  }

  return output.sort((a, b) => (
    statusRank(a.status) - statusRank(b.status)
    || b.availableStayMin - a.availableStayMin
    || a.approachMin + a.onwardMin - (b.approachMin + b.onwardMin)
    || a.spot.title.localeCompare(b.spot.title, 'ko')
  ));
}

function statusRank(status: OneStopStatus): number {
  return status === 'recommended' ? 0 : status === 'short' ? 1 : 2;
}
