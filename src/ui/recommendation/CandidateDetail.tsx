import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Mode, Spot } from "../../engine";
import { C } from "../theme";
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

function bufferNoteForMode(mode: Mode): string {
  if (mode === "transit") return "(대기·환승 20분 포함)";
  if (mode === "walk") return "(보행 여유 8분 포함)";
  return "(주차·정체 10분 포함)";
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

  return (
    <Animated.View style={[s.root, { opacity, transform: [{ translateY }] }]}>
      <View style={s.head}>
        <Text style={s.title} numberOfLines={1}>{spot.title}</Text>
        <Pressable style={s.close} onPress={onClose} accessibilityLabel="장소 목록으로 접기">
          <Feather color={C.txt2} name="chevron-down" size={22} />
        </Pressable>
      </View>
      <View style={s.media}>
        {spot.imageUrl ? (
          <Image source={{ uri: spot.imageUrl }} style={s.image} />
        ) : (
          <View style={s.fallback}>
            <MaterialCommunityIcons color={C.accent} name="map-marker" size={34} />
            <Text style={s.fallbackText}>{spot.category}</Text>
          </View>
        )}
      </View>
      <Text style={s.type}>{spot.category}</Text>
      <Pressable style={s.mapLink} onPress={() => onOpenKakaoPlace(spot)} accessibilityLabel={`${spot.title} 카카오맵에서 보기`}>
        <MaterialCommunityIcons color={C.accent} name="map-marker-outline" size={17} />
        <Text style={s.mapLinkText}>카카오맵에서 보기</Text>
        <Feather color={C.accent} name="external-link" size={15} />
      </Pressable>
      <View style={s.routePreview}>
        <View style={s.routeLine}>
          <RoutePoint icon="navigation" color={C.accent} label="출발" />
          <RouteLeg mode={chosenMode} minutes={chosen?.approachMin ?? "-"} />
          <RoutePoint icon="map-pin" color={C.green} label="장소" />
          <RouteLeg mode={chosen?.onwardMode} minutes={chosen?.onwardMin} />
          <RoutePoint icon="calendar" color={C.amber} label="약속" size={16} />
        </View>
        <View style={s.metrics}>
          <Metric value={`${Math.round(chosen?.totalMoveMin ?? 0)}분`} label="총 이동" style={s.move} />
          <View style={s.divider} />
          <Metric
            value={`${chosen?.stayPossibleMin ?? 0}분`}
            label="이 장소 체류"
            subLabel={chosen && chosen.totalStayMin !== chosen.stayPossibleMin ? `(코스 총 ${chosen.totalStayMin}분)` : undefined}
            style={s.stay}
          />
          <View style={s.divider} />
          <Metric
            value={`${Math.round(chosen?.remainingAfterPlannedMin ?? 0)}분`}
            label="남는 시간"
            subLabel={chosen ? bufferNoteForMode(chosen.mode) : undefined}
            style={s.remaining}
          />
        </View>
      </View>
      <View style={s.modePicker}>
        {scenarios.map((scenario) => {
          const active = scenario.mode === chosenMode;
          return (
            <Pressable
              key={scenario.mode}
              disabled={scenario.status === "over"}
              onPress={() => onModeChange(scenario.mode)}
              style={[s.mode, active && s.modeOn, scenario.status === "over" && s.modeOff]}
              accessibilityLabel={`${MODE_LABEL[scenario.mode]} ${scenario.approachMin}분`}
            >
              <TransportGlyph mode={scenario.mode} color={active ? C.accent : C.txt2} />
              <Text style={[s.modeTime, active && s.modeTimeOn]}>{scenario.status === "over" ? "-" : `${scenario.approachMin}분`}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.modeHint}>{modeHintForMode(chosenMode)}</Text>
      <Pressable disabled={disabled} onPress={onAddToBasket} style={[s.confirm, disabled && s.confirmOff]}>
        <Text style={[s.confirmText, disabled && s.confirmTextOff]}>{isAdding ? "실제 경로 확인 중" : !chosen || chosen.status === "over" ? "시간 안에 담기 어려워요" : "장바구니에 담기"}</Text>
      </Pressable>
    </Animated.View>
  );
}

function RoutePoint({ icon, color, label, size = 17 }: { icon: ComponentProps<typeof Feather>["name"]; color: string; label: string; size?: number }) {
  return <View style={s.routePoint}><Feather color={color} name={icon} size={size} /><Text style={s.routePointLabel}>{label}</Text></View>;
}

function RouteLeg({ mode, minutes }: { mode?: Mode; minutes?: number | string }) {
  if (!mode) return <View style={s.routeLeg} />;
  const color = transportColor(mode);
  return <View style={s.routeLeg}><View style={[s.dash, { borderColor: color }]} /><View style={[s.routeLegIcon, { borderColor: color }]}><TransportGlyph mode={mode} color={color} size={17} /></View><Text style={s.routeLegTime}>{minutes ?? "-"}분</Text></View>;
}

function Metric({ value, label, subLabel, style }: { value: string; label: string; subLabel?: string; style: object }) {
  return (
    <View style={s.metric}>
      <Text style={style}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      {subLabel ? <Text style={s.metricSubLabel}>{subLabel}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { padding: 18, paddingTop: 4, paddingBottom: 120 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  title: { flex: 1, color: C.txt, fontSize: 18, fontWeight: "900" },
  close: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: C.panel2 },
  media: { height: 176, overflow: "hidden", borderRadius: 16, backgroundColor: C.panel2 },
  image: { width: "100%", height: "100%" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 7 },
  fallbackText: { color: C.txt2, fontSize: 13, fontWeight: "800" },
  type: { color: C.accent, fontSize: 13, fontWeight: "800", marginTop: 16 },
  mapLink: { alignSelf: "flex-start", minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingHorizontal: 9, borderRadius: 9, backgroundColor: "rgba(76,194,255,0.1)" },
  mapLinkText: { color: C.accent, fontSize: 12.5, fontWeight: "800" },
  routePreview: { marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, padding: 12 },
  routeLine: { flexDirection: "row", alignItems: "flex-start" },
  routePoint: { alignItems: "center", width: 38 },
  routePointLabel: { color: C.muted, fontSize: 9.5, fontWeight: "800", marginTop: 4 },
  routeLeg: { flex: 1, minWidth: 0, alignItems: "center", paddingTop: 2, position: "relative" },
  dash: { position: "absolute", top: 13, left: 0, right: 0, borderTopWidth: 1.5, borderStyle: "dashed" },
  routeLegIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, backgroundColor: C.panel, alignItems: "center", justifyContent: "center" },
  routeLegTime: { color: C.txt2, fontSize: 11, fontWeight: "900", marginTop: 4 },
  metrics: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: C.line },
  metric: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 34, backgroundColor: C.line },
  move: { color: C.txt, fontSize: 20, fontWeight: "900", marginTop: 2 },
  stay: { color: C.txt, fontSize: 21, fontWeight: "900", marginTop: 2 },
  remaining: { color: C.green, fontSize: 20, fontWeight: "900", marginTop: 2 },
  metricLabel: { color: C.muted, fontSize: 10.5, fontWeight: "800", marginTop: 3 },
  metricSubLabel: { color: C.muted, fontSize: 9, fontWeight: "600", marginTop: 1 },
  modePicker: { flexDirection: "row", gap: 8, marginTop: 12 },
  mode: { flex: 1, minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.panel2 },
  modeOn: { borderColor: C.accent, backgroundColor: "rgba(76,194,255,0.12)" },
  modeOff: { opacity: 0.38 },
  modeTime: { color: C.txt2, fontSize: 11.5, fontWeight: "900" },
  modeTimeOn: { color: C.accent },
  modeHint: { color: C.muted, fontSize: 11.5, fontWeight: "600", textAlign: "center", marginTop: 8 },
  confirm: { minHeight: 50, marginTop: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.accent },
  confirmOff: { backgroundColor: C.panel2 },
  confirmText: { color: C.onAccent, fontSize: 14, fontWeight: "900" },
  confirmTextOff: { color: C.muted },
});
