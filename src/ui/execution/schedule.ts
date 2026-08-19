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

export function kakaoRouteUrl(to: LatLon, mode: Mode): string {
  return `kakaomap://route?ep=${to.lat},${to.lon}&by=${kakaoRouteMode(mode)}`;
}

export function kakaoWebFallback(to: ExecutionStop): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(to.name)},${to.point.lat},${to.point.lon}`;
}

export function currentMinuteOfDay(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}
