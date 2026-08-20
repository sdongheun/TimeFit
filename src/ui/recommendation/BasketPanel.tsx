import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Course, Mode, Spot } from "../../engine";
import { C } from "../theme";
import { TransportGlyph } from "./TransportGlyph";
import { MODE_LABEL } from "./types";

type Props = {
  selected: Spot[];
  course: Course | null;
  moveMin: number;
  stayPoolMin: number;
  bufferLeftMin: number;
  appointmentLabel?: string;
  isSaving: boolean;
  isEditing: boolean;
  onAutoSort: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (contentId: string) => void;
  onConfirm: () => void;
};

export function BasketPanel({
  selected,
  course,
  moveMin,
  stayPoolMin,
  bufferLeftMin,
  appointmentLabel,
  isSaving,
  isEditing,
  onAutoSort,
  onMove,
  onRemove,
  onConfirm,
}: Props) {
  const confirmLabel = isSaving
    ? "코스 저장 중..."
    : selected.length
      ? isEditing
        ? "변경 적용 후 길찾기 시작"
        : "코스 저장 후 길찾기 시작"
      : "장소를 먼저 담아주세요";

  return (
    <View style={s.pageBlock}>
      <View style={s.basket}>
        {/* 상단 메트릭 요약 바 */}
        <View style={s.metricsBar}>
          <MetricItem value={`${moveMin}분`} label="총 이동" style={s.metricMove} />
          <View style={s.divider} />
          <MetricItem value={`${Math.round(stayPoolMin)}분`} label="코스 체류" style={s.metricStay} />
          <View style={s.divider} />
          <MetricItem value={`${Math.round(bufferLeftMin)}분`} label="남는 시간" style={s.metricRemaining} />
        </View>

        {/* 헤더 & 최적 정렬 버튼 */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.basketTitle}>내 코스 일정</Text>
            <Text style={s.basketMeta}>담은 장소 {selected.length}개</Text>
          </View>
          {selected.length > 1 ? (
            <Pressable style={s.autoSortBtn} onPress={onAutoSort} accessibilityLabel="최적 순서로 자동 정렬">
              <Feather name="refresh-cw" size={13} color={C.accent} />
              <Text style={s.autoSortTxt}>최적 순서로 정렬</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 통합 타임라인 뷰 */}
        {selected.length ? (
          <View style={s.timeline}>
            {/* 1. 출발 지점 */}
            <TimelinePoint icon="navigation" color={C.accent} label="출발 · 현재 위치" />

            {/* 2. 장소 및 이동 구간 반복 */}
            {selected.map((spot, index) => {
              const approachLeg = course?.legs[index * 2];
              const stayLeg = course?.legs[index * 2 + 1];
              const mode: Mode = approachLeg?.mode ?? "transit";

              return (
                <View key={spot.contentId}>
                  {/* 구간 이동 레그 */}
                  <TimelineLeg mode={mode} minutes={approachLeg?.min ?? 0} />

                  {/* 장소 카드 */}
                  <View style={s.spotCard}>
                    <View style={s.spotBadge}>
                      <Text style={s.spotBadgeNum}>{index + 1}</Text>
                    </View>
                    <View style={s.spotMain}>
                      <Text style={s.spotTitle} numberOfLines={1}>
                        {spot.title}
                      </Text>
                      <Text style={s.spotSub}>
                        {spot.category} · 체류 {stayLeg?.min ?? spot.dwell}분
                      </Text>
                    </View>
                    <View style={s.controls}>
                      <Pressable
                        style={[s.btnOrder, index === 0 && s.btnDisabled]}
                        disabled={index === 0}
                        onPress={() => onMove(index, -1)}
                        accessibilityLabel={`${spot.title} 위로 이동`}
                        hitSlop={6}
                      >
                        <Feather name="chevron-up" size={18} color={index === 0 ? C.muted : C.txt2} />
                      </Pressable>
                      <Pressable
                        style={[s.btnOrder, index === selected.length - 1 && s.btnDisabled]}
                        disabled={index === selected.length - 1}
                        onPress={() => onMove(index, 1)}
                        accessibilityLabel={`${spot.title} 아래로 이동`}
                        hitSlop={6}
                      >
                        <Feather name="chevron-down" size={18} color={index === selected.length - 1 ? C.muted : C.txt2} />
                      </Pressable>
                      <Pressable
                        style={s.btnRemove}
                        onPress={() => onRemove(spot.contentId)}
                        accessibilityLabel={`${spot.title} 제거`}
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={16} color={C.red} />
                        <Text style={s.removeTxt}>제거</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* 3. 마지막 복귀 / 약속 구간 레그 */}
            {course && course.legs.length > 0 ? (
              <TimelineLeg
                mode={course.legs[course.legs.length - 1]?.mode ?? "transit"}
                minutes={course.legs[course.legs.length - 1]?.min ?? 0}
              />
            ) : null}

            {/* 4. 최종 도착/복귀 지점 */}
            <TimelinePoint
              icon={appointmentLabel ? "calendar" : "home"}
              color={appointmentLabel ? C.amber : C.txt2}
              label={appointmentLabel ? `약속 · ${appointmentLabel}` : "도착 · 출발지 복귀"}
            />
          </View>
        ) : (
          <View style={s.emptyState}>
            <Feather name="shopping-bag" size={32} color={C.muted} />
            <Text style={s.emptyText}>추천 목록에서 마음에 드는 장소를 담아보세요.</Text>
          </View>
        )}

        {/* 확정 CTA (규칙 3: 52px, 12px 반경, C.accent) */}
        <Pressable
          style={[s.cta, (!selected.length || isSaving) && s.ctaDisabled]}
          disabled={!selected.length || isSaving}
          onPress={onConfirm}
          accessibilityLabel={confirmLabel}
        >
          <Text style={[s.ctaTxt, (!selected.length || isSaving) && s.ctaTxtDisabled]}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetricItem({ value, label, style }: { value: string; label: string; style: object }) {
  return (
    <View style={s.metricItem}>
      <Text style={style}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function TimelinePoint({
  icon,
  color,
  label,
}: {
  icon: "navigation" | "calendar" | "home";
  color: string;
  label: string;
}) {
  return (
    <View style={s.timelinePointRow}>
      <View style={[s.pointIconBox, { borderColor: color }]}>
        <Feather name={icon} size={13} color={color} />
      </View>
      <Text style={s.pointLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function TimelineLeg({ mode, minutes }: { mode: Mode; minutes: number }) {
  return (
    <View style={s.legRow}>
      <View style={s.legLine} />
      <View style={s.legBadge}>
        <TransportGlyph mode={mode} color={C.txt2} size={13} />
        <Text style={s.legText}>
          {MODE_LABEL[mode]} {minutes}분
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pageBlock: { marginTop: 4 },
  basket: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panel2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 12,
    marginBottom: 16,
  },
  metricItem: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 28, backgroundColor: C.line },
  metricMove: { color: C.txt, fontSize: 18, fontWeight: "900" },
  metricStay: { color: C.txt, fontSize: 18, fontWeight: "900" },
  metricRemaining: { color: C.green, fontSize: 18, fontWeight: "900" },
  metricLabel: { color: C.muted, fontSize: 11, fontWeight: "800", marginTop: 3 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  basketTitle: { color: C.txt, fontSize: 17, fontWeight: "900" },
  basketMeta: { color: C.accent, fontSize: 12, fontWeight: "800", marginTop: 2 },
  autoSortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(76,194,255,0.45)",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: "rgba(76,194,255,0.08)",
  },
  autoSortTxt: { color: C.accent, fontSize: 12, fontWeight: "800" },
  timeline: { marginBottom: 12 },
  timelinePointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  pointIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: C.panel2,
    alignItems: "center",
    justifyContent: "center",
  },
  pointLabel: { color: C.txt, fontSize: 13, fontWeight: "800", flex: 1 },
  legRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 11,
    height: 38,
    position: "relative",
  },
  legLine: {
    position: "absolute",
    left: 11,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: C.line,
  },
  legBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 14,
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  legText: { color: C.txt2, fontSize: 11.5, fontWeight: "800" },
  spotCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    marginLeft: 2,
  },
  spotBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  spotBadgeNum: { color: C.onAccent, fontSize: 12, fontWeight: "900" },
  spotMain: { flex: 1, minWidth: 0 },
  spotTitle: { color: C.txt, fontSize: 14, fontWeight: "800" },
  spotSub: { color: C.muted, fontSize: 11.5, fontWeight: "700", marginTop: 3 },
  controls: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 },
  btnOrder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.25 },
  btnRemove: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,92,92,0.1)",
  },
  removeTxt: { color: C.red, fontSize: 12, fontWeight: "800" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  emptyText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  cta: {
    minHeight: 52,
    backgroundColor: C.accent,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  ctaDisabled: { backgroundColor: C.panel2 },
  ctaTxt: { color: C.onAccent, fontSize: 16, fontWeight: "800" },
  ctaTxtDisabled: { color: C.muted },
});
