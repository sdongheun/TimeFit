import { buildLimitedRepresentativeCourseV1, type CourseV1LimitedInput, type CourseV1LimitedResult, type CourseV1RouteAdapter, type CourseV1RouteReceiptAdapter } from '../../engine';
import { createCourseV1CandidateProvider } from '../../data/courseV1CandidateProvider';
import { createCourseV1RouteAdapter } from '../../services/courseV1RouteAdapter';
import { createActivatedCourseV1RouteAdapter, RouteProxyUnavailableError } from '../../services/routeProxyActivatedCourseAdapter';
import type { RecommendationSession } from '../nav';
import { parseRecommendationNowIso } from './recommendationSessionTime';

export type RecommendationRuntimeOptions = {
  routeProxyEnabled: boolean;
  /** One request-stack token only. It is never copied into a navigation session or persisted UI state. */
  captchaToken?: string;
};

export type RecommendationRuntimeDependencies = {
  createLegacyRoutes: () => CourseV1RouteAdapter;
  /** API-4-A-ACT-04-B-R supplies this factory; UI owns only the boolean/token call boundary. */
  createActivatedProxyRoutes?: (input: { captchaToken?: string }) => Promise<CourseV1RouteAdapter & CourseV1RouteReceiptAdapter>;
};

export type RecommendationRuntimePorts = {
  routes: CourseV1RouteAdapter;
  /** Proxy enabled mode requires the exact same activated port for receipt-budget verification. */
  receiptRoutes?: CourseV1RouteReceiptAdapter;
};

export async function recommendationPortsFor(options: RecommendationRuntimeOptions, dependencies: RecommendationRuntimeDependencies): Promise<RecommendationRuntimePorts> {
  if (!options.routeProxyEnabled) return { routes: dependencies.createLegacyRoutes() };
  if (!dependencies.createActivatedProxyRoutes) throw new RouteProxyUnavailableError();
  try {
    const activatedRoutes = await dependencies.createActivatedProxyRoutes({ captchaToken: options.captchaToken });
    if (typeof activatedRoutes.getRouteReceipt !== 'function') throw new RouteProxyUnavailableError();
    return { routes: activatedRoutes, receiptRoutes: activatedRoutes };
  } catch (error) {
    if (error instanceof RouteProxyUnavailableError) throw error;
    throw new RouteProxyUnavailableError();
  }
}

/** Backward-compatible route-only boundary for callers that do not build engine input. */
export async function recommendationRoutesFor(options: RecommendationRuntimeOptions, dependencies: RecommendationRuntimeDependencies): Promise<CourseV1RouteAdapter> {
  return (await recommendationPortsFor(options, dependencies)).routes;
}

/** 직렬화된 navigation session을 엔진 호출 직전에만 Date로 복원한다. */
export function buildRecommendationEngineInput(session: RecommendationSession) {
  return { now: parseRecommendationNowIso(session.nowIso), origin: session.origin, destination: session.destination, remainingMin: session.remainingMin, arrivalBufferMin: session.arrivalBufferMin };
}

/** Activated proxy mode passes one shared route/receipt port; legacy mode deliberately remains route-only. */
export async function buildRecommendationLimitedInput(
  session: RecommendationSession,
  options: RecommendationRuntimeOptions,
  dependencies: RecommendationRuntimeDependencies,
): Promise<CourseV1LimitedInput> {
  return { ...buildRecommendationEngineInput(session), provider: createCourseV1CandidateProvider(), ...await recommendationPortsFor(options, dependencies) };
}

/** UI 컨테이너만 엔진 provider·실제 경로 adapter를 조립한다. 표시 화면은 result만 받는다. */
export async function runRecommendationSession(
  session: RecommendationSession,
  options: RecommendationRuntimeOptions = { routeProxyEnabled: false },
  dependencies: RecommendationRuntimeDependencies = {
    createLegacyRoutes: createCourseV1RouteAdapter,
    createActivatedProxyRoutes: async ({ captchaToken }) => {
      // Legacy mode must stay runnable in local/test builds without Supabase public config.
      // Proxy ports are therefore loaded only after the explicit Proxy gate succeeds.
      const { createSupabaseRouteProxyPorts } = await import('../../services/routeProxyProductionPorts');
      return createActivatedCourseV1RouteAdapter({ enabled: true, captchaToken, ...createSupabaseRouteProxyPorts() });
    },
  },
): Promise<CourseV1LimitedResult> {
  return buildLimitedRepresentativeCourseV1(await buildRecommendationLimitedInput(session, options, dependencies));
}
