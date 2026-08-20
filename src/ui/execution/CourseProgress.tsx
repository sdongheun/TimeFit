import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ScheduleResult } from "../../services/courseNotifications";
import { fmtHM } from "../nav";
import { C } from "../theme";
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
  overdueMin?: number;
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
  overdueMin = 0,
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
    <View style={s.root}>
      {/* 1. 상단 목표 시각 & 여유 배너 */}
      <View style={s.banner}>
        <View style={s.bannerLeft}>
          <Text style={s.bannerLabel}>
            {appointmentLabel ? `${appointmentLabel} 도착 목표` : "출발지 복귀 목표"}
          </Text>
          <Text style={s.bannerTime}>{fmtHM(endMin)}</Text>
        </View>
        <View style={s.bufferBadge}>
          <Text style={s.bufferText}>여유 {bufferLeftMin}분</Text>
        </View>
      </View>

      {/* 2. 현재 단계 핵심 액션 카드 */}
      <View style={s.currentCard}>
        {isDone ? (
          <View style={s.currentHeader}>
            <View style={[s.statusBadge, { backgroundColor: "rgba(34,197,94,0.15)" }]}>
              <Text style={[s.statusText, { color: C.green }]}>코스 완료</Text>
            </View>
            <Text style={s.currentTitle}>{current.name}</Text>
            <Text style={s.currentSub}>예정된 모든 일정을 마쳤습니다.</Text>
          </View>
        ) : (
          <View style={s.currentHeader}>
            <View style={s.statusRow}>
              <View style={[s.statusBadge, current.isSpot ? s.statusStay : s.statusMove]}>
                <Text style={[s.statusText, current.isSpot ? s.statusStayTxt : s.statusMoveTxt]}>
                  {current.isSpot ? (overdueMin > 0 ? "출발 시각 초과" : "체류 중") : "이동 중"}
                </Text>
              </View>
              {current.isSpot ? (
                overdueMin > 0 ? (
                  <Text style={[s.timeHint, { color: C.red, fontWeight: "900" }]}>
                    예정보다 {overdueMin}분 늦어졌어요
                  </Text>
                ) : (
                  <Text style={s.timeHint}>남은 체류 {stayMin}분 · {fmtHM(current.leaveMin)} 출발</Text>
                )
              ) : (
                <Text style={s.timeHint}>약 {moveMin}분 소요 · {fmtHM(current.leaveMin)} 도착</Text>
              )}
            </View>
            <Text style={s.currentTitle} numberOfLines={1}>
              {current.isSpot ? current.name : (next?.name ?? current.name)}
            </Text>
            {stayWarning ? (
              <Text style={s.warnText}>⚠️ 다음 일정을 위해 서둘러 이동해 주세요.</Text>
            ) : null}
          </View>
        )}

        {/* 주요 CTA (규칙 3: 52px 표준) */}
        <Pressable style={s.primaryBtn} onPress={onPrimaryAction} accessibilityLabel={ctaLabel}>
          <Feather name={isDone ? "check-circle" : current.isSpot ? "arrow-right" : "navigation"} size={18} color={C.onAccent} />
          <Text style={s.primaryBtnTxt}>{ctaLabel}</Text>
        </Pressable>
      </View>

      {/* 3. 전체 코스 일정 (세로 타임라인) */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>가는 순서</Text>
        <Text style={s.sectionCount}>{stops.length}개 지점</Text>
      </View>

      <View style={s.verticalTimeline}>
        {stops.map((stop, index) => {
          const isPassed = index < step;
          const isCurrent = index === step;
          const isLast = index === stops.length - 1;

          return (
            <Pressable
              key={`${stop.name}-${index}`}
              style={s.timelineItem}
              onPress={() => onSelectStep(index)}
            >
              {/* 좌측 세로선 및 상태 아이콘 */}
              <View style={s.timelineLeft}>
                <View
                  style={[
                    s.timelineDot,
                    isPassed && s.dotPassed,
                    isCurrent && s.dotCurrent,
                  ]}
                >
                  {isPassed ? (
                    <Feather name="check" size={12} color={C.green} />
                  ) : isCurrent ? (
                    <View style={s.dotInnerActive} />
                  ) : (
                    <View style={s.dotInnerPending} />
                  )}
                </View>
                {!isLast ? (
                  <View style={[s.verticalLine, isPassed && s.linePassed]} />
                ) : null}
              </View>

              {/* 우측 장소 정보 */}
              <View style={[s.timelineContent, isCurrent && s.contentCurrent]}>
                <View style={s.stopHeader}>
                  <Text style={[s.stopName, isPassed && s.textPassed, isCurrent && s.textCurrent]} numberOfLines={1}>
                    {stop.name}
                  </Text>
                  {isCurrent ? (
                    <View style={s.currentPill}>
                      <Text style={s.currentPillTxt}>현재</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.stopSchedule}>
                  {fmtHM(stop.arriveMin)} 도착
                  {stop.leaveMin > stop.arriveMin ? ` · ${stop.leaveMin - stop.arriveMin}분 체류` : ""}
                  {stop.leaveMin ? ` · ${fmtHM(stop.leaveMin)} 출발` : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 4. 약속·복귀 출발 알림 요약 */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>약속·복귀 출발 알림</Text>
      </View>
      <View style={s.alertCard}>
        {alerts.map((alert) => (
          <View key={`${alert.min}-${alert.msg}`} style={s.alertRow}>
            <Feather name="bell" size={14} color={C.accent} />
            <Text style={s.alertText}>
              <Text style={s.alertTime}>{fmtHM(alert.min)}</Text> {alert.msg} (5분 전/정각)
            </Text>
          </View>
        ))}
        {notificationResult?.scheduled ? (
          <Text style={s.alertStatus}>✓ 알림 {notificationResult.scheduled}건 예약 완료</Text>
        ) : notificationError ? (
          <Text style={s.alertError}>알림 설정 실패 — 기기 설정을 확인해 주세요.</Text>
        ) : null}
      </View>

      {/* 5. 하단 보조 액션 (코스 변경 / 코스 종료) */}
      <View style={s.footerActions}>
        <Pressable
          disabled={isChangingCourse}
          style={[s.footerBtn, s.btnChange]}
          onPress={onChangeCourse}
          accessibilityLabel="코스 변경"
        >
          <Feather name="refresh-cw" size={14} color={C.txt2} />
          <Text style={s.footerBtnTxt}>{isChangingCourse ? "위치 확인 중..." : "코스 변경"}</Text>
        </Pressable>
        <Pressable
          style={[s.footerBtn, s.btnFinish]}
          onPress={onFinish}
          accessibilityLabel="코스 종료"
        >
          <Feather name="x" size={14} color={C.red} />
          <Text style={[s.footerBtnTxt, { color: C.red }]}>코스 종료</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingBottom: 24 },
  banner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  bannerLeft: { gap: 2 },
  bannerLabel: { color: C.muted, fontSize: 12, fontWeight: "700" },
  bannerTime: { color: C.txt, fontSize: 18, fontWeight: "900" },
  bufferBadge: {
    backgroundColor: "rgba(34,197,94,0.12)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  bufferText: { color: C.green, fontSize: 13, fontWeight: "800" },
  currentCard: {
    backgroundColor: C.panel,
    borderColor: C.accent,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  currentHeader: { marginBottom: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  statusMove: { backgroundColor: "rgba(76,194,255,0.15)" },
  statusMoveTxt: { color: C.accent, fontSize: 11.5, fontWeight: "900" },
  statusStay: { backgroundColor: "rgba(245,158,11,0.15)" },
  statusStayTxt: { color: C.amber, fontSize: 11.5, fontWeight: "900" },
  statusText: { fontSize: 11.5, fontWeight: "900" },
  timeHint: { color: C.muted, fontSize: 12, fontWeight: "700" },
  currentTitle: { color: C.txt, fontSize: 18, fontWeight: "900" },
  currentSub: { color: C.muted, fontSize: 13, marginTop: 4 },
  warnText: { color: C.amber, fontSize: 12.5, fontWeight: "800", marginTop: 6 },
  primaryBtn: {
    minHeight: 52,
    backgroundColor: C.accent,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnTxt: { color: C.onAccent, fontSize: 16, fontWeight: "800" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 6,
  },
  sectionTitle: { color: C.txt, fontSize: 15, fontWeight: "900" },
  sectionCount: { color: C.muted, fontSize: 12, fontWeight: "700" },
  verticalTimeline: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 56,
  },
  timelineLeft: {
    width: 24,
    alignItems: "center",
    marginRight: 12,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.panel2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  dotPassed: { borderColor: C.green, backgroundColor: "rgba(34,197,94,0.1)" },
  dotCurrent: { borderColor: C.accent, backgroundColor: C.panel2 },
  dotInnerActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  dotInnerPending: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: C.line,
    marginTop: 2,
    marginBottom: 2,
  },
  linePassed: { backgroundColor: C.green },
  timelineContent: { flex: 1, paddingBottom: 16 },
  contentCurrent: { opacity: 1 },
  stopHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  stopName: { color: C.txt, fontSize: 14.5, fontWeight: "800", flex: 1 },
  textPassed: { color: C.muted },
  textCurrent: { color: C.accent, fontWeight: "900" },
  currentPill: {
    backgroundColor: "rgba(76,194,255,0.15)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  currentPillTxt: { color: C.accent, fontSize: 10.5, fontWeight: "900" },
  stopSchedule: { color: C.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  alertCard: {
    backgroundColor: C.panel2,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertText: { color: C.txt2, fontSize: 12.5, fontWeight: "700", flex: 1 },
  alertTime: { color: C.txt, fontWeight: "900" },
  alertStatus: { color: C.green, fontSize: 11.5, fontWeight: "800", marginTop: 2 },
  alertError: { color: C.red, fontSize: 11.5, fontWeight: "800" },
  footerActions: { flexDirection: "row", gap: 10 },
  footerBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnChange: {},
  btnFinish: { borderColor: "rgba(255,92,92,0.3)" },
  footerBtnTxt: { color: C.txt2, fontSize: 14, fontWeight: "800" },
});
