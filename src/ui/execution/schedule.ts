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

export type KakaoRouteOpenResult = "app_opened" | "web_opened" | "browser_fallback_opened" | "invalid_stage" | "failed";

/** 설치된 카카오맵만 scheme으로 열고, 그 외에는 기존 HTTPS 길찾기로 한 번 전환한다. */
export async function openKakaoRouteWithFallback(
  stage: KakaoRouteStage,
  mode: Mode,
  ports: {
    canOpenApp: (url: string) => Promise<boolean>;
    openApp: (url: string) => Promise<unknown>;
    openWeb: (url: string) => Promise<unknown>;
    openBrowser: (url: string) => Promise<unknown>;
  },
): Promise<KakaoRouteOpenResult> {
  if (!hasValidRoutePoint(stage.from.point) || !hasValidRoutePoint(stage.to.point)) return 'invalid_stage';
  const appUrl = kakaoRouteUrl(stage.from.point, stage.to.point, mode);
  try {
    if (await ports.canOpenApp(appUrl)) {
      try {
        await ports.openApp(appUrl);
        return "app_opened";
      } catch { /* HTTPS fallback below */ }
    }
  } catch { /* HTTPS fallback below */ }

  const webUrl = kakaoWebFallback(stage, mode);
  try {
    await ports.openWeb(webUrl);
    return "web_opened";
  } catch {
    try {
      await ports.openBrowser(webUrl);
      return 'browser_fallback_opened';
    } catch {
      return "failed";
    }
  }
}

export function currentMinuteOfDay(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}
