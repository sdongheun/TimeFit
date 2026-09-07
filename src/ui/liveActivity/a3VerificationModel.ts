import type { KakaoRouteOpenResult } from '../execution/schedule';
import type { TestFixturePayload } from './lifecyclePolicy';

export type LiveActivityA3Fixture = TestFixturePayload;

type ActivitySupport = Readonly<{ supported: boolean; enabled: boolean }>;
type ActivityStart = Readonly<{
  status: 'started' | 'cleanup_required' | 'disabled' | 'invalid_input';
  activityId?: string;
  applicationState?: string;
}>;

export type LiveActivityA3Result =
  | Readonly<{ kind: 'busy' }>
  | Readonly<{ kind: 'unsupported' }>
  | Readonly<{ kind: 'activity_disabled' }>
  | Readonly<{ kind: 'cleanup_required' }>
  | Readonly<{ kind: 'handoff_failed'; routeResult: Extract<KakaoRouteOpenResult, 'invalid_stage' | 'failed' | 'browser_fallback_cancelled'> }>
  | Readonly<{ kind: 'started' | 'already_active'; activityId?: string; applicationState?: string; routeResult: Exclude<KakaoRouteOpenResult, 'invalid_stage' | 'failed' | 'browser_fallback_cancelled'> }>
  | Readonly<{ kind: 'opened_without_activity'; routeResult: Exclude<KakaoRouteOpenResult, 'invalid_stage' | 'failed' | 'browser_fallback_cancelled'> }>;

export function createLiveActivityA3VerificationController(dependencies: Readonly<{
  support: () => Promise<ActivitySupport>;
  fixtureExists?: () => Promise<boolean>;
  openRoute: () => Promise<KakaoRouteOpenResult>;
  startActivity: (fixture: LiveActivityA3Fixture) => Promise<ActivityStart>;
}>) {
  let busy = false;
  return {
    async run(fixture: LiveActivityA3Fixture): Promise<LiveActivityA3Result> {
      if (busy) return { kind: 'busy' };
      busy = true;
      try {
        let support: ActivitySupport;
        try { support = await dependencies.support(); }
        catch { return { kind: 'unsupported' }; }
        if (!support.supported) return { kind: 'unsupported' };
        if (!support.enabled) return { kind: 'activity_disabled' };
        try { if (await dependencies.fixtureExists?.()) return { kind: 'cleanup_required' }; }
        catch { return { kind: 'unsupported' }; }

        let routeResult: KakaoRouteOpenResult;
        try { routeResult = await dependencies.openRoute(); }
        catch { routeResult = 'failed'; }
        if (routeResult === 'invalid_stage' || routeResult === 'failed' || routeResult === 'browser_fallback_cancelled') return { kind: 'handoff_failed', routeResult };

        try {
          const activity = await dependencies.startActivity(fixture);
          if (activity.status === 'disabled' || activity.status === 'invalid_input') return { kind: 'opened_without_activity', routeResult };
          if (activity.status === 'cleanup_required') return { kind: 'cleanup_required' };
          return {
            kind: activity.status,
            activityId: activity.activityId,
            applicationState: activity.applicationState,
            routeResult,
          };
        } catch {
          return { kind: 'opened_without_activity', routeResult };
        }
      } finally {
        busy = false;
      }
    },
  };
}
