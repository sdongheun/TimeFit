import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Mode, Spot } from "../../engine";
import { C } from "../theme";
import { UI_RADIUS, UI_SIZE } from "../tokens";
import { TransportGlyph } from "./TransportGlyph";
import { MODE_LABEL, type CandidateEval, type TransportScenario } from "./types";

type Props = {
  item: CandidateEval;
  scenarios: TransportScenario[];
  chosenMode: Mode;
  opacity: Animated.Value;
  translateY: Animated.Value;
  onClose: () => void;
  onModeChange: (mode: Mode) => void;
  onOpenKakaoPlace: (spot: Spot) => void;
  onAddToBasket: () => void | Promise<void>;
  isAdding?: boolean;
};

function transportColor(mode: Mode): string {
  if (mode === "car") return C.amber;
  if (mode === "transit") return C.accent;
  return C.green;
}

function modeHintForMode(mode: Mode): string {
  if (mode === "transit") return "대중교통 지연에 대비해 안전 여유 20분을 미리 확보해요";
  if (mode === "walk") return "도보는 이동이 확실해 장소에 더 오래 머물 수 있어요";
  return "차량 이동은 주차·신호 대기 여유 10분을 반영해요";
}

export function CandidateDetail({
  item,
  scenarios,
  chosenMode,
  opacity,
  translateY,
  onClose,
  onModeChange,
  onOpenKakaoPlace,
  onAddToBasket,
  isAdding = false,
}: Props) {
  const chosen = scenarios.find((scenario) => scenario.mode === chosenMode);
  const disabled = isAdding || !chosen || chosen.status === "over";
  const { spot } = item;

  const approachMin = chosen?.approachMin ?? 0;
  const onwardMin = chosen?.onwardMin ?? 0;
  const stayPossibleMin = chosen?.stayPossibleMin ?? 0;
  const remainingMin = Math.round(chosen?.remainingAfterPlannedMin ?? 0);
  const totalMoveMin = Math.round(chosen?.totalMoveMin ?? 0);

  return (
    <Animated.View style={[s.root, { opacity, transform: [{ translateY }] }]}>
      {/* 1. 상단 장소 헤더 */}
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{spot.title}</Text>
          <Text style={s.categoryText}>{spot.category}</Text>
        </View>
        <Pressable
          style={s.close}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="장소 목록으로 접기"
        >
          <Feather color={C.txt} name="chevron-down" size={22} />
        </Pressable>
      </View>

      {/* 2. 장소 사진 & 카카오맵 링크 */}
      <View style={s.mediaWrap}>
        <View style={s.media}>
          {spot.imageUrl ? (
            <Image source={{ uri: spot.imageUrl }} style={s.image} />
          ) : (
            <View style={s.fallback}>
              <MaterialCommunityIcons color={C.accent} name="map-marker" size={32} />
              <Text style={s.fallbackText}>{spot.category}</Text>
            </View>
          )}
        </View>
        <Pressable style={s.mapLink} onPress={() => onOpenKakaoPlace(spot)} accessibilityLabel={`${spot.title} 카카오맵에서 보기`}>
          <MaterialCommunityIcons color={C.accent} name="map-marker-outline" size={15} />
          <Text style={s.mapLinkText}>카카오맵에서 보기</Text>
          <Feather color={C.accent} name="external-link" size={13} />
        </Pressable>
      </View>

      {/* 3. 세로형 타임라인 일정 흐름 카드 */}
      <View style={s.timelineCard}>
        <Text style={s.timelineCardTitle}>예상 일정 흐름</Text>

        <View style={s.timeline}>
          {/* 출발지 */}
          <View style={s.timelineNode}>
            <View style={[s.nodeDot, { backgroundColor: C.accent }]} />
            <Text style={s.nodeTitle}>출발 (현재 위치)</Text>
          </View>

          {/* 이동 1 구간 */}
          <View style={s.timelineSegment}>
            <View style={s.segmentLine} />
            <View style={s.segmentContent}>
              <View style={s.transportBadge}>
                <TransportGlyph mode={chosenMode} color={transportColor(chosenMode)} size={14} />
                <Text style={[s.transportText, { color: transportColor(chosenMode) }]}>
                  {approachMin}분 이동
                </Text>
              </View>
            </View>
          </View>

          {/* 장소 방문 */}
          <View style={s.timelineNode}>
            <View style={[s.nodeDot, { backgroundColor: C.green }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.nodeTitleHighlight}>{spot.title}</Text>
              <Text style={s.nodeSubText}>체류 권장 {stayPossibleMin}분</Text>
            </View>
          </View>

          {/* 이동 2 구간 */}
          <View style={s.timelineSegment}>
            <View style={s.segmentLine} />
            <View style={s.segmentContent}>
              <View style={s.transportBadge}>
                <TransportGlyph mode={chosen?.onwardMode ?? chosenMode} color={transportColor(chosen?.onwardMode ?? chosenMode)} size={14} />
                <Text style={[s.transportText, { color: transportColor(chosen?.onwardMode ?? chosenMode) }]}>
                  {onwardMin}분 이동
                </Text>
              </View>
            </View>
          </View>

          {/* 도착지 (약속/복귀) */}
          <View style={s.timelineNode}>
            <View style={[s.nodeDot, { backgroundColor: C.amber }]} />
            <Text style={s.nodeTitle}>약속 장소 도착</Text>
          </View>
        </View>

        {/* 하단 요약 메트릭 바 */}
        <View style={s.metricsRow}>
          <Metric label="총 이동" value={`${totalMoveMin}분`} style={s.metricVal} />
          <View style={s.metricDivider} />
          <Metric label="이 장소 체류" value={`${stayPossibleMin}분`} style={[s.metricVal, { color: C.green }]} />
          <View style={s.metricDivider} />
          <Metric label="남는 시간" value={`${remainingMin}분`} style={[s.metricVal, { color: C.accent }]} />
        </View>
      </View>

      {/* 4. 이동 수단 선택 칩 */}
      <View style={s.modeSection}>
        <Text style={s.modeSectionLabel}>이동 수단 선택</Text>
        <View style={s.modePicker}>
          {scenarios.map((scenario) => {
            const active = scenario.mode === chosenMode;
            return (
              <Pressable
                key={scenario.mode}
                disabled={scenario.status === "over"}
                onPress={() => onModeChange(scenario.mode)}
                style={[s.mode, active && s.modeOn, scenario.status === "over" && s.modeOff]}
                accessibilityRole="button"
                accessibilityLabel={`${MODE_LABEL[scenario.mode]} ${scenario.approachMin}분`}
              >
                <TransportGlyph mode={scenario.mode} color={active ? C.accent : C.txt2} size={16} />
                <Text style={[s.modeText, active && s.modeTextOn]}>
                  {MODE_LABEL[scenario.mode]} {scenario.status === "over" ? "(불가)" : `${scenario.approachMin}분`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.modeHint}>{modeHintForMode(chosenMode)}</Text>
      </View>

      {/* 5. 하단 주요 CTA 버튼 */}
      <Pressable
        disabled={disabled}
        onPress={onAddToBasket}
        style={[s.confirm, disabled && s.confirmOff]}
        accessibilityRole="button"
        accessibilityLabel={
          isAdding
            ? "실제 경로 확인 중"
            : !chosen || chosen.status === "over"
              ? "시간 안에 다녀오기 어려움"
              : "장바구니에 담기"
        }
      >
        <Text style={[s.confirmText, disabled && s.confirmTextOff]}>
          {isAdding
            ? "실제 경로 확인 중..."
            : !chosen || chosen.status === "over"
              ? "시간 안에 다녀오기 어려워요"
              : "장바구니에 담기"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function Metric({ value, label, style }: { value: string; label: string; style: object }) {
  return (
    <View style={s.metricItem}>
      <Text style={style}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { padding: 18, paddingTop: 4, paddingBottom: 120 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  title: { color: C.txt, fontSize: 18.5, fontWeight: "900" },
  categoryText: { color: C.muted, fontSize: 12.5, fontWeight: "700", marginTop: 2 },
  close: {
    width: UI_SIZE.iconControl,
    height: UI_SIZE.iconControl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: UI_RADIUS.control,
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.line,
  },
  mediaWrap: { marginBottom: 16 },
  media: { height: 160, overflow: "hidden", borderRadius: UI_RADIUS.panel, backgroundColor: C.panel2 },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  fallbackText: { color: C.muted, fontSize: 12.5, fontWeight: "800" },
  mapLink: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(76,194,255,0.08)",
  },
  mapLinkText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  timelineCard: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: UI_RADIUS.media,
    padding: 16,
    marginBottom: 16,
  },
  routePreview: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: UI_RADIUS.media,
    padding: 16,
    marginBottom: 16,
  },
  timelineCardTitle: { color: C.txt, fontSize: 14, fontWeight: "900", marginBottom: 14 },
  timeline: { paddingLeft: 4, paddingRight: 4 },
  timelineNode: { flexDirection: "row", alignItems: "center", gap: 12 },
  nodeDot: { width: 10, height: 10, borderRadius: 5 },
  nodeTitle: { color: C.txt2, fontSize: 13.5, fontWeight: "700" },
  nodeTitleHighlight: { color: C.txt, fontSize: 14.5, fontWeight: "900" },
  nodeSubText: { color: C.green, fontSize: 12, fontWeight: "800", marginTop: 2 },
  timelineSegment: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
    paddingLeft: 4,
    gap: 17,
  },
  segmentLine: { width: 2, height: "100%", backgroundColor: C.line },
  segmentContent: { paddingVertical: 4 },
  transportBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.panel2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
  },
  transportText: { fontSize: 11.5, fontWeight: "800" },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  metricItem: { flex: 1, alignItems: "center" },
  metricVal: { color: C.txt, fontSize: 16.5, fontWeight: "900" },
  move: { color: C.txt, fontSize: 16.5, fontWeight: "900" },
  stay: { color: C.green, fontSize: 16.5, fontWeight: "900" },
  remaining: { color: C.accent, fontSize: 16.5, fontWeight: "900" },
  metricLabel: { color: C.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  metricDivider: { width: 1, height: 26, backgroundColor: C.line },
  modeSection: { marginBottom: 14 },
  modeSectionLabel: { color: C.txt2, fontSize: 12.5, fontWeight: "800", marginBottom: 8 },
  modePicker: { flexDirection: "row", gap: 8 },
  mode: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: UI_RADIUS.control,
    backgroundColor: C.panel,
  },
  modeOn: { borderColor: C.accent, backgroundColor: "rgba(76,194,255,0.12)" },
  modeOff: { opacity: 0.35 },
  modeText: { color: C.txt2, fontSize: 12, fontWeight: "800" },
  modeTextOn: { color: C.accent, fontWeight: "900" },
  modeHint: { color: C.muted, fontSize: 11.5, fontWeight: "600", textAlign: "center", marginTop: 8 },
  confirm: {
    minHeight: UI_SIZE.primaryAction,
    height: UI_SIZE.primaryAction,
    borderRadius: UI_RADIUS.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
    paddingHorizontal: 16,
  },
  confirmOff: { backgroundColor: C.panel2 },
  confirmText: { color: C.onAccent, fontSize: 16, fontWeight: "800" },
  confirmTextOff: { color: C.muted },
});
