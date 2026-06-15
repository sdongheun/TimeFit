import { Course, LatLon, PlanResult } from '../engine';

export type RootStackParamList = {
  Home: undefined;
  Results: { result: PlanResult; remainingMin: number; usedTimeLabel: string; origin: LatLon };
  Detail: { course: Course; origin: LatLon };
};
