import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ScheduleResult } from "../../services/courseNotifications";
import { fmtHM } from "../nav";
import { C } from "../theme";
import { UI_RADIUS, UI_SIZE } from "../tokens";
import type { ExecutionStop } from "./schedule";

type Props = {
  appointmentLabel?: string;
  endMin: number;
  bufferLeftMin: number;
  current: ExecutionStop;
  next?: ExecutionStop;
  isDone: boolean;
  moveMin: number;
  stayMin: number;
  actualDepartMin?: number;
  actualArriveMin?: number;
  delayMin: number;
  stayWarning: boolean;
  isChangingCourse: boolean;
  transitionMsg: string;
  ctaKicker: string;
  ctaMeta: string;
  ctaLabel: string;
  totalSegments: number;
  currentSegment: number;
  stops: ExecutionStop[];
  step: number;
  alerts: Array<{ min: number; msg: string }>;
  notificationResult: ScheduleResult | null;
  notificationError: boolean;
  onChangeCourse: () => void;
  onPrimaryAction: () => void;
  onSelectStep: (index: number) => void;
  onFinish: () => void;
};

export function CourseProgress({
  appointmentLabel,
  endMin,
  bufferLeftMin,
  current,
  next,
  isDone,
  moveMin,
  stayMin,
  actualDepartMin,
  actualArriveMin,
  delayMin,
  stayWarning,
  isChangingCourse,
  transitionMsg,
  ctaKicker,
  ctaMeta,
  ctaLabel,
  totalSegments,
  currentSegment,
  stops,
  step,
  alerts,
  notificationResult,
  notificationError,
  onChangeCourse,
  onPrimaryAction,
  onSelectStep,
  onFinish,
}: Props) {
  return (
    <>
      <View style={s.banner}>
        <Text style={s.bannerTxt}>
          {appointmentLabel
            ? `${fmtHM(endMin)} ${appointmentLabel} 약속`
            : `${fmtHM(endMin)} 복귀 목표`}
        </Text>
        <Text style={s.bannerBig}>여유 {bufferLeftMin}분</Text>
      </View>
      <View style={s.nowBox}>
        {isDone ? (
          <>
            <Text style={s.nowKicker}>코스 완료</Text>
            <Text style={s.nowTitle}>{current.name}</Text>
            <Text style={s.nowMeta}>예정된 마지막 지점에 도착했습니다.</Text>
          </>
        ) : (
          <>
            <Text style={s.nowKicker}>{current.isSpot ? "체류 중" : "이동 준비"}</Text>
            <Text style={s.nowTitle}>{next?.name}</Text>
            <Text style={s.nowMeta}>
              {current.isSpot
                ? `${current.name}에서 현재 기준 약 ${stayMin}분 머물 수 있어요. ${fmtHM(current.leaveMin)}에는 출발하세요.`
                : "카카오맵에서 현재 위치 기준 길찾기를 열고, 도착 후 TimeFit으로 돌아오세요."}
            </Text>
            {actualDepartMin != null ? (
              <Text style={s.actualNote}>실제 출발 {fmtHM(actualDepartMin)} 기준으로 진행 중입니다.</Text>
            ) : null}
            {current.isSpot && actualArriveMin != null ? (
              <Text style={[s.actualNote, delayMin > 0 && s.delayNote]}>
                앱 복귀 {fmtHM(actualArriveMin)}
                {delayMin > 0
                  ? ` · 예상보다 ${delayMin}분 늦게 이어가요.`
                  : delayMin < 0
                    ? ` · 예상보다 ${Math.abs(delayMin)}분 빠르게 이어가요.`
                    : " · 예정 흐름과 같아요."}
              </Text>
            ) : null}
            {stayWarning ? (
              <Text style={s.warnNote}>머물 시간이 짧아졌어요. 다음 장소로 바로 이동하는 것도 고려하세요.</Text>
            ) : null}
            <Pressable
              disabled={isChangingCourse}
              style={[s.adjustBtn, stayWarning && s.adjustBtnWarn, isChangingCourse && s.adjustBtnDisabled]}
              onPress={onChangeCourse}
            >
              <Text style={[s.adjustBtnTxt, stayWarning && s.adjustBtnWarnTxt]}>
                {isChangingCourse ? "현재 위치 확인 중" : "코스 변경"}
              </Text>
            </Pressable>
            <View style={s.nowStats}>
              <Stat label="이동" value={`${moveMin}분`} />
              <Stat label="체류 가능" value={current.isSpot ? `${stayMin}분` : "-"} />
              <Stat label="출발 마감" value={fmtHM(current.leaveMin)} />
            </View>
          </>
        )}
      </View>

      <View style={s.actionBox}>
        <View style={s.segmentRow}>
          {Array.from({ length: totalSegments + 1 }).map((_, index) => {
            const done = index <= step;
            const active = index === step || (!isDone && index === step + 1);
            return (
              <View key={index} style={s.segmentItem}>
                <View style={[s.segmentDot, done && s.segmentDotDone, active && s.segmentDotActive]} />
                {index < totalSegments ? <View style={[s.segmentLine, index < step && s.segmentLineDone]} /> : null}
              </View>
            );
          })}
        </View>
        {transitionMsg ? <Text style={s.transitionMsg}>{transitionMsg}</Text> : null}
        <View style={s.ctaInfo}>
          <Text style={s.ctaKicker}>{ctaKicker}</Text>
          <Text style={s.ctaRoute} numberOfLines={2}>{ctaMeta}</Text>
        </View>
        <Pressable style={s.btnMain} onPress={onPrimaryAction}>
          <Text style={s.btnMainTxt}>{ctaLabel}</Text>
        </Pressable>
      </View>

      <Text style={s.lbl}>가는 순서</Text>
      <View style={s.timeline}>
        {stops.map((stop, index) => {
          const done = index < step;
          const selected = index === step;
          return (
            <Pressable key={`${stop.name}-${index}`} style={s.stopRow} onPress={() => onSelectStep(index)}>
              <View style={[s.dot, done && s.dotDone, selected && s.dotCur]} />
              <View style={s.stopInfo}>
                <Text style={[s.stopName, selected && s.stopNameCurrent]}>{stop.name}</Text>
                <Text style={s.stopMeta}>
                  {fmtHM(stop.arriveMin)} 도착
                  {stop.leaveMin > stop.arriveMin
                    ? ` · ${stop.leaveMin - stop.arriveMin}분 체류 · ${fmtHM(stop.leaveMin)} 출발`
                    : ""}
                </Text>
              </View>
              {done ? <Text style={s.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={s.lbl}>약속·복귀 출발 알림</Text>
      <View style={s.alertBox}>
        {alerts.map((alert) => (
          <Text key={`${alert.min}-${alert.msg}`} style={s.alert}>
            <Text style={s.alertTime}>{fmtHM(alert.min)}</Text> {alert.msg} · 5분 전/정각
          </Text>
        ))}
        <Text style={s.alertNote}>
          {notificationError
            ? "알림 예약에 실패했습니다. 기기 알림 설정을 확인해 주세요."
            : notificationResult == null
              ? "알림을 예약하고 있습니다."
              : !notificationResult.permissionGranted
                ? "알림 권한이 꺼져 있어 예약되지 않았습니다. 기기 설정에서 TimeFit 알림을 허용해 주세요."
                : `${notificationResult.scheduled}건 예약 완료 · 최종 출발 5분 전과 정각에 알려드려요${notificationResult.skipped > 0 ? ` · 지난 시각 ${notificationResult.skipped}건 제외` : ""}`}
        </Text>
      </View>

      <Pressable style={s.btnSub} onPress={onFinish}>
        <Text style={s.btnSubTxt}>코스 취소·종료</Text>
      </Pressable>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={s.stat}><Text style={s.statLbl}>{label}</Text><Text style={s.statVal}>{value}</Text></View>;
}

const s = StyleSheet.create({
  banner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(227,179,65,0.08)", borderColor: "rgba(227,179,65,0.3)", borderWidth: 1, borderRadius: UI_RADIUS.control, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 6 },
  bannerTxt: { color: C.txt2, fontSize: 12.5 },
  bannerBig: { color: C.amber, fontSize: 15, fontWeight: "800" },
  nowBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: UI_RADIUS.panel, padding: 16, marginTop: 12 },
  nowKicker: { color: C.accent, fontSize: 11, fontWeight: "800", marginBottom: 5 },
  nowTitle: { color: C.txt, fontSize: 20, fontWeight: "900" },
  nowMeta: { color: C.txt2, fontSize: 13, lineHeight: 20, marginTop: 8 },
  actualNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  delayNote: { color: C.amber },
  warnNote: { color: C.red, fontSize: 12.5, lineHeight: 18, marginTop: 8, fontWeight: "700" },
  adjustBtn: { marginTop: 12, borderWidth: 1, borderColor: "rgba(76,194,255,0.5)", backgroundColor: "rgba(76,194,255,0.1)", borderRadius: 11, paddingVertical: 11, alignItems: "center" },
  adjustBtnDisabled: { opacity: 0.55 },
  adjustBtnWarn: { borderColor: "rgba(227,179,65,0.75)", backgroundColor: "rgba(227,179,65,0.22)" },
  adjustBtnTxt: { color: C.accent, fontSize: 13.5, fontWeight: "800" },
  adjustBtnWarnTxt: { color: C.amber },
  nowStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 9 },
  statLbl: { color: C.muted, fontSize: 10.5, fontWeight: "700", marginBottom: 3 },
  statVal: { color: C.txt, fontSize: 13, fontWeight: "900" },
  actionBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: UI_RADIUS.panel, padding: 14, marginTop: 12 },
  segmentRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  segmentDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.bg, borderWidth: 2, borderColor: "#3a4653" },
  segmentDotDone: { backgroundColor: C.green, borderColor: C.green },
  segmentDotActive: { borderColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 6 },
  segmentLine: { flex: 1, height: 2, backgroundColor: "#3a4653", marginHorizontal: 5 },
  segmentLineDone: { backgroundColor: C.green },
  transitionMsg: { color: C.green, fontSize: 12.5, fontWeight: "800", marginBottom: 8 },
  ctaInfo: { marginBottom: 12 },
  ctaKicker: { color: C.accent, fontSize: 11.5, fontWeight: "900", marginBottom: 4 },
  ctaRoute: { color: C.txt, fontSize: 16, lineHeight: 21, fontWeight: "800" },
  btnMain: { minHeight: UI_SIZE.primaryAction, borderRadius: UI_RADIUS.control, justifyContent: "center", alignItems: "center", backgroundColor: C.accent },
  btnMainTxt: { color: C.onAccent, fontSize: 16, fontWeight: "800" },
  lbl: { color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginTop: 14, marginBottom: 8, textTransform: "uppercase" },
  timeline: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: UI_RADIUS.panel, padding: 6 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, paddingHorizontal: 10 },
  dot: { width: 14, height: 14, borderRadius: 8, backgroundColor: C.bg, borderWidth: 2, borderColor: "#3a4653" },
  dotDone: { backgroundColor: C.green, borderColor: C.green },
  dotCur: { backgroundColor: C.accent, borderColor: C.accent },
  stopInfo: { flex: 1 },
  stopName: { color: C.txt, fontSize: 14.5, fontWeight: "600" },
  stopNameCurrent: { color: C.accent },
  stopMeta: { color: C.muted, fontSize: 12, marginTop: 1 },
  check: { color: C.green, fontWeight: "800" },
  alertBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: UI_RADIUS.panel, padding: 14 },
  alert: { color: C.txt2, fontSize: 13, marginVertical: 3 },
  alertTime: { color: C.accent, fontWeight: "800" },
  alertNote: { color: "#6e7d8c", fontSize: 11, marginTop: 8 },
  btnSub: { minHeight: UI_SIZE.primaryAction, marginTop: 10, paddingHorizontal: 18, backgroundColor: "transparent", borderWidth: 1, borderColor: C.line, borderRadius: UI_RADIUS.control, justifyContent: "center", alignItems: "center" },
  btnSubTxt: { color: C.txt2, fontSize: 13.5, fontWeight: "600" },
});
