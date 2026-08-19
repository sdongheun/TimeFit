import { Feather } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import type { LatLon } from "../../engine";
import { haversineKm } from "../../engine/travel";
import { C } from "../theme";
import { TransportGlyph } from "./TransportGlyph";
import {
  CATEGORY_FILTERS,
  CandidateEval,
  CandidateStatus,
  MODE_LABEL,
} from "./types";

type Props = {
  categoryFilter: string | null;
  filtered: CandidateEval[];
  focusedSpotId: string | null;
  origin: LatLon;
  selectedIds: string[];
  onCategoryChange: (category: string | null) => void;
  onCandidateLayout: (contentId: string, y: number) => void;
  onCandidatePress: (item: CandidateEval) => void;
};

function statusStyle(status: CandidateStatus) {
  if (status === "good") return { box: s.statusGood, text: s.statusGoodText };
  if (status === "short") return { box: s.statusShort, text: s.statusShortText };
  if (status === "tight") return { box: s.statusTight, text: s.statusTightText };
  return { box: s.statusOver, text: s.statusOverText };
}

function distanceFromOriginLabel(origin: LatLon, point: LatLon): string {
  const km = haversineKm(origin, point);
  if (km < 1) return `현재 위치 ${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`;
  return `현재 위치 ${km.toFixed(1)}km`;
}

const STATUS_LABEL: Record<CandidateStatus, string> = {
  good: "여유 있음",
  short: "짧게 가능",
  tight: "빠듯함",
  over: "시간 초과",
};

export function CandidateList({
  categoryFilter,
  filtered,
  focusedSpotId,
  origin,
  selectedIds,
  onCategoryChange,
  onCandidateLayout,
  onCandidatePress,
}: Props) {
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categoryFilterRow}
        style={s.categoryFilterScroll}
      >
        {CATEGORY_FILTERS.map((filter) => {
          const active = categoryFilter === filter.category;
          return (
            <Pressable
              key={filter.label}
              onPress={() => onCategoryChange(filter.category)}
              style={[s.categoryFilterChip, active && s.categoryFilterChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${filter.label} 장소 보기`}
            >
              <Text style={[s.categoryFilterText, active && s.categoryFilterTextOn]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {filtered.length === 0 ? (
        <Text style={s.empty}>이 필터에 맞는 장소가 없어요. 필터를 줄여보세요.</Text>
      ) : null}
      {filtered.map((item) => {
        const isSelected = selectedIds.includes(item.spot.contentId);
        const status = statusStyle(item.status);
        return (
          <Pressable
            key={item.spot.contentId}
            onLayout={(event) => onCandidateLayout(item.spot.contentId, event.nativeEvent.layout.y)}
            style={[s.card, isSelected && s.cardOn, focusedSpotId === item.spot.contentId && s.cardFocused]}
            disabled={isSelected || item.siteConflict}
            onPress={() => onCandidatePress(item)}
            accessibilityLabel={
              isSelected
                ? `${item.spot.title}, 장바구니에 담김`
                : item.siteConflict
                  ? `${item.spot.title}, 같은 단지 장소가 이미 담김`
                  : `${item.spot.title} 상세 보기`
            }
          >
            <View style={s.cardHead}>
              <View style={s.cardBody}>
                <Text style={s.cardType}>
                  {distanceFromOriginLabel(origin, item.spot)} · {item.spot.category}
                </Text>
                <Text style={s.spotName}>{item.spot.title}</Text>
                <View style={s.modeAvailability}>
                  {(["walk", "transit", "car"] as const).map((mode) => {
                    const available = item.availableModes.includes(mode);
                    return (
                      <View
                        key={mode}
                        style={[s.modeAvailabilityIcon, !available && s.modeAvailabilityIconOff]}
                        accessibilityLabel={`${MODE_LABEL[mode]} ${available ? "가능" : "불가"}`}
                      >
                        <TransportGlyph mode={mode} color={available ? C.green : C.muted} size={17} />
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={[s.status, status.box]}>
                <Text style={[s.statusText, status.text]}>
                  {isSelected ? "담김" : item.siteConflict ? "같은 단지" : STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            {!isSelected && !item.siteConflict ? (
              <Feather color={C.muted} name="chevron-down" size={19} style={s.cardChevron} />
            ) : null}
          </Pressable>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  categoryFilterScroll: { marginHorizontal: -18, marginTop: 10 },
  categoryFilterRow: { gap: 8, paddingHorizontal: 18, paddingRight: 36 },
  categoryFilterChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
  },
  categoryFilterChipOn: { borderColor: C.accent, backgroundColor: "rgba(76,194,255,0.14)" },
  categoryFilterText: { color: C.txt2, fontSize: 13, fontWeight: "800" },
  categoryFilterTextOn: { color: C.accent },
  empty: { color: C.amber, fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 116,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  cardOn: { borderColor: C.green, backgroundColor: "rgba(126,231,135,0.08)" },
  cardFocused: { borderColor: C.accent, borderWidth: 2 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardBody: { flex: 1 },
  cardType: { color: C.green, fontWeight: "800", fontSize: 12, lineHeight: 17 },
  spotName: { color: C.txt, fontSize: 16, fontWeight: "800", lineHeight: 22, marginTop: 6 },
  modeAvailability: { flexDirection: "row", gap: 8, marginTop: 12 },
  modeAvailabilityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(126,231,135,0.12)",
  },
  modeAvailabilityIconOff: { opacity: 0.35, backgroundColor: C.panel2 },
  cardChevron: { alignSelf: "center", marginTop: 10 },
  status: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, borderWidth: 1 },
  statusText: { fontSize: 11.5, fontWeight: "900" },
  statusGood: { borderColor: C.green, backgroundColor: "rgba(126,231,135,0.12)" },
  statusGoodText: { color: C.green },
  statusShort: { borderColor: C.accent, backgroundColor: "rgba(76,194,255,0.12)" },
  statusShortText: { color: C.accent },
  statusTight: { borderColor: C.amber, backgroundColor: "rgba(227,179,65,0.12)" },
  statusTightText: { color: C.amber },
  statusOver: { borderColor: C.red, backgroundColor: "rgba(255,123,114,0.1)" },
  statusOverText: { color: C.red },
});
