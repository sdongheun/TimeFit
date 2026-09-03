import type { CourseV1Stop } from '../../engine';

/** Snapshot-only dwell copy. Missing legacy state is intentionally not reclassified. */
export function courseV1StopDwellLabel(stayMin: number | undefined, stayState: CourseV1Stop['stayState']): string | null {
  void stayMin;
  return stayState === 'short' ? '가볍게 둘러보기' : '장소 둘러보기';
}

export function courseV1CourseDwellStatus(stops: readonly Pick<CourseV1Stop, 'stayState'>[]): '가볍게 둘러보기' | null {
  return stops.some((stop) => stop.stayState === 'short') ? '가볍게 둘러보기' : null;
}
