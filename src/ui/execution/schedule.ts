import type { Course, LatLon, Mode } from "../../engine";
import type { PlanCtx } from "../nav";

export type ExecutionScheduleInput = {
  course: Course;
  ctx: PlanCtx;
  origin: LatLon;
};

export type ExecutionStop = {
  name: string;
  arriveMin: number;
  leaveMin: number;
  isSpot: boolean;
  point: LatLon;
  incomingMode?: Mode;
};

export type ExecutionSchedule = {
  stops: ExecutionStop[];
  alerts: { min: number; msg: string }[];
};

// legs를 누적해 화면 표시와 알림에 공통으로 쓰는 지점별 예정 시각을 만든다.
export function buildExecutionSchedule({
  course,
  ctx,
  origin,
}: ExecutionScheduleInput): ExecutionSchedule {
  const target = ctx.appointment ?? origin;
  const stops: ExecutionStop[] = [
    {
      name: "출발",
      arriveMin: ctx.startMin,
      leaveMin: ctx.startMin,
      isSpot: false,
      point: origin,
    },
  ];
  let time = ctx.startMin;
  let spotIndex = 0;

  for (const leg of course.legs) {
    if (leg.label.startsWith("체류")) {
      const lastStop = stops[stops.length - 1];
      lastStop.leaveMin = time + leg.min;
      time += leg.min;
      continue;
    }

    time += leg.min;
    const isLast = leg === course.legs[course.legs.length - 1];
    const spot = isLast ? null : course.spots[spotIndex++];
    const name = isLast
      ? ctx.appointment
        ? `약속 · ${ctx.appointment.label}`
        : "출발지 복귀"
      : spot?.title ?? "";
    stops.push({
      name,
      arriveMin: time,
      leaveMin: time,
      isSpot: !isLast,
      point: isLast ? target : spot ?? target,
      incomingMode: leg.mode ?? ctx.mode,
    });
  }

  const lastSpot = [...stops].reverse().find((stop) => stop.isSpot);
  const alerts = lastSpot
    ? [
        {
          min: lastSpot.leaveMin,
          msg: ctx.appointment
            ? `${ctx.appointment.label}(으)로 출발하세요`
            : "출발지로 돌아가세요",
        },
      ]
    : [];
  return { stops, alerts };
}

function kakaoRouteMode(mode: Mode): "car" | "foot" | "publictransit" {
  if (mode === "car") return "car";
  if (mode === "transit") return "publictransit";
  return "foot";
}

export type KakaoRouteTarget = Pick<ExecutionStop, 'name' | 'point'>;
export type KakaoRouteStage = Readonly<{ from: KakaoRouteTarget; to: KakaoRouteTarget }>;

function hasValidRoutePoint(point: LatLon): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}

export function isValidKakaoRouteStage(stage: KakaoRouteStage): boolean {
  return hasValidRoutePoint(stage.from.point) && hasValidRoutePoint(stage.to.point);
}

export function kakaoRouteUrl(from: LatLon, to: LatLon, mode: Mode): string {
  return `kakaomap://route?sp=${from.lat},${from.lon}&ep=${to.lat},${to.lon}&by=${kakaoRouteMode(mode)}`;
}

function kakaoWebRouteMode(mode: Mode): 'walk' | 'traffic' | 'car' {
  if (mode === 'transit') return 'traffic';
  return mode;
}

export function kakaoWebFallback(stage: KakaoRouteStage, mode: Mode): string {
  const from = `${encodeURIComponent(stage.from.name)},${stage.from.point.lat},${stage.from.point.lon}`;
  const to = `${encodeURIComponent(stage.to.name)},${stage.to.point.lat},${stage.to.point.lon}`;
  return `https://map.kakao.com/link/by/${kakaoWebRouteMode(mode)}/${from}/${to}`;
}

export type KakaoRouteOpenResult = "app_opened" | "web_opened" | "browser_fallback_opened" | "browser_fallback_cancelled" | "invalid_stage" | "failed";
export type KakaoRouteDiagnostic = Readonly<{
  stage: 'route_invalid' | 'app_check_started' | 'app_unavailable' | 'app_open_accepted' | 'app_open_failed'
    | 'web_open_accepted' | 'web_open_failed' | 'browser_open_started' | 'browser_background_observed'
    | 'browser_dismissed' | 'browser_open_failed';
  result: 'started' | 'succeeded' | 'rejected' | 'failed' | 'observed';
  error: 'none' | 'invalid_stage' | 'app_unavailable' | 'app_open_failed' | 'web_open_failed' | 'browser_dismissed' | 'browser_open_failed';
}>;

export function isKakaoRouteOpenSuccess(result: KakaoRouteOpenResult): boolean {
  return result === 'app_opened' || result === 'web_opened' || result === 'browser_fallback_opened';
}

/** 설치된 카카오맵만 scheme으로 열고, 그 외에는 기존 HTTPS 길찾기로 한 번 전환한다. */
export async function openKakaoRouteWithFallback(
  stage: KakaoRouteStage,
  mode: Mode,
  ports: {
    canOpenApp: (url: string) => Promise<boolean>;
    openApp: (url: string) => Promise<unknown>;
    openWeb: (url: string) => Promise<unknown>;
    openBrowser: (url: string) => Promise<unknown>;
    observeAppState?: (listener: (state: string) => void) => () => void;
    onDiagnostic?: (event: KakaoRouteDiagnostic) => void;
  },
): Promise<KakaoRouteOpenResult> {
  const diagnose = (event: KakaoRouteDiagnostic) => { try { ports.onDiagnostic?.(event); } catch { /* 진단 실패는 handoff를 바꾸지 않는다. */ } };
  if (!isValidKakaoRouteStage(stage)) {
    diagnose({ stage: 'route_invalid', result: 'rejected', error: 'invalid_stage' });
    return 'invalid_stage';
  }
  const appUrl = kakaoRouteUrl(stage.from.point, stage.to.point, mode);
  diagnose({ stage: 'app_check_started', result: 'started', error: 'none' });
  try {
    if (await ports.canOpenApp(appUrl)) {
      try {
        await ports.openApp(appUrl);
        diagnose({ stage: 'app_open_accepted', result: 'succeeded', error: 'none' });
        return "app_opened";
      } catch { diagnose({ stage: 'app_open_failed', result: 'failed', error: 'app_open_failed' }); }
    } else diagnose({ stage: 'app_unavailable', result: 'rejected', error: 'app_unavailable' });
  } catch { diagnose({ stage: 'app_unavailable', result: 'failed', error: 'app_unavailable' }); }

  const webUrl = kakaoWebFallback(stage, mode);
  try {
    await ports.openWeb(webUrl);
    diagnose({ stage: 'web_open_accepted', result: 'succeeded', error: 'none' });
    return "web_opened";
  } catch {
    diagnose({ stage: 'web_open_failed', result: 'failed', error: 'web_open_failed' });
  }
  if (!ports.observeAppState) {
    diagnose({ stage: 'browser_open_failed', result: 'failed', error: 'browser_open_failed' });
    return 'failed';
  }
  diagnose({ stage: 'browser_open_started', result: 'started', error: 'none' });
  return new Promise<KakaoRouteOpenResult>((resolve) => {
    let settled = false;
    let remove: () => void = () => undefined;
    const finish = (result: KakaoRouteOpenResult, diagnostic: KakaoRouteDiagnostic) => {
      if (settled) return;
      settled = true;
      remove();
      diagnose(diagnostic);
      resolve(result);
    };
    remove = ports.observeAppState!((state) => {
      if (state === 'background') finish('browser_fallback_opened', { stage: 'browser_background_observed', result: 'observed', error: 'none' });
    });
    Promise.resolve().then(() => ports.openBrowser(webUrl)).then(
      () => finish('browser_fallback_cancelled', { stage: 'browser_dismissed', result: 'rejected', error: 'browser_dismissed' }),
      () => finish('failed', { stage: 'browser_open_failed', result: 'failed', error: 'browser_open_failed' }),
    );
  });
}

export function currentMinuteOfDay(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}
