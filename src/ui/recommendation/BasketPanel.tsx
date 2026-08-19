import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Course, Spot } from "../../engine";
import { C } from "../theme";
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
        <View style={s.basketHead}>
          <Text style={s.basketTitle}>내 코스 바구니</Text>
          <Text style={s.basketMeta}>담은 장소 {selected.length}개</Text>
        </View>
        {selected.length > 1 ? (
          <Pressable style={s.autoSortBtn} onPress={onAutoSort}>
            <Text style={s.autoSortTxt}>↻ 최적 순서로 정렬</Text>
          </Pressable>
        ) : null}
        {selected.length ? (
          <Text style={s.orderNote}>
            현재 위치 → {selected.map((spot) => spot.title).join(" → ")} →{" "}
            {appointmentLabel ?? "출발지"}
          </Text>
        ) : null}
        {selected.length ? (
          <View style={s.selectedList}>
            {selected.map((spot, index) => {
              const approachLeg = course?.legs[index * 2];
              const stayLeg = course?.legs[index * 2 + 1];
              return (
                <View key={spot.contentId} style={s.selectedChip}>
                  <View style={s.selectedInfo}>
                    <Text style={s.selectedTxt}>
                      {index + 1}. {spot.title}
                    </Text>
                    <Text style={s.selectedMeta}>
                      {spot.category} · {MODE_LABEL[approachLeg?.mode ?? "transit"]} · 이동{" "}
                      {approachLeg?.min ?? 0}분 · 체류 {stayLeg?.min ?? 0}분
                    </Text>
                  </View>
                  <View style={s.orderControls}>
                    <Pressable
                      style={[s.orderBtn, index === 0 && s.orderBtnOff]}
                      disabled={index === 0}
                      onPress={() => onMove(index, -1)}
                      accessibilityLabel={`${spot.title} 순서 올리기`}
                    >
                      <Text style={[s.orderBtnTxt, index === 0 && s.orderBtnTxtOff]}>↑</Text>
                    </Pressable>
                    <Pressable
                      style={[s.orderBtn, index === selected.length - 1 && s.orderBtnOff]}
                      disabled={index === selected.length - 1}
                      onPress={() => onMove(index, 1)}
                      accessibilityLabel={`${spot.title} 순서 내리기`}
                    >
                      <Text style={[s.orderBtnTxt, index === selected.length - 1 && s.orderBtnTxtOff]}>↓</Text>
                    </Pressable>
                    <Pressable onPress={() => onRemove(spot.contentId)} hitSlop={8}>
                      <Text style={s.removeTxt}>제거</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={s.emptySmall}>추천 장소에서 마음에 드는 장소를 먼저 담아주세요.</Text>
        )}
        <View style={s.basketStats}>
          <Stat label="이동" value={`${moveMin}분`} />
          <Stat label="체류 가능" value={`${Math.round(stayPoolMin)}분`} />
          <Stat label="여유" value={`${Math.round(bufferLeftMin)}분`} />
        </View>
        {course ? (
          <View style={s.routeSummary}>
            <Text style={s.routeSummaryTitle}>이동 순서와 시간</Text>
            {course.legs.map((leg, index) => (
              <View key={`${leg.label}-${index}`} style={s.routeSummaryRow}>
                <Text style={s.routeSummaryLabel} numberOfLines={1}>
                  {leg.mode ? `${MODE_LABEL[leg.mode]} · ${leg.label}` : leg.label}
                </Text>
                <Text style={s.routeSummaryMin}>{leg.min}분</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable
          style={[s.cta, (!selected.length || isSaving) && s.ctaOff]}
          disabled={!selected.length || isSaving}
          onPress={onConfirm}
        >
          <Text style={s.ctaTxt}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLbl}>{label}</Text>
      <Text style={s.statVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pageBlock: { marginTop: 4 },
  basket: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  basketHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  basketTitle: { color: C.txt, fontSize: 16, fontWeight: "900" },
  basketMeta: { color: C.accent, fontSize: 12.5, fontWeight: "800" },
  autoSortBtn: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(76,194,255,0.45)",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(76,194,255,0.08)",
  },
  autoSortTxt: { color: C.accent, fontSize: 12, fontWeight: "900" },
  orderNote: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 9 },
  selectedList: { gap: 7, marginTop: 10 },
  selectedChip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.panel2,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  selectedInfo: { flex: 1, minWidth: 0 },
  selectedTxt: { color: C.txt, fontSize: 13.5, fontWeight: "700" },
  selectedMeta: { color: C.muted, fontSize: 11.5, marginTop: 3 },
  orderControls: { flexDirection: "row", alignItems: "center", gap: 7, marginLeft: 8 },
  orderBtn: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
  },
  orderBtnOff: { opacity: 0.35 },
  orderBtnTxt: { color: C.accent, fontSize: 16, fontWeight: "900" },
  orderBtnTxtOff: { color: C.muted },
  removeTxt: { color: C.red, fontSize: 12, fontWeight: "800" },
  emptySmall: { color: C.muted, fontSize: 12.5, marginTop: 8 },
  basketStats: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: C.panel2,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  statLbl: { color: C.muted, fontSize: 10.5, fontWeight: "800", marginBottom: 2 },
  statVal: { color: C.txt, fontSize: 13.5, fontWeight: "900" },
  routeSummary: {
    marginTop: 12,
    borderTopColor: C.line,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 7,
  },
  routeSummaryTitle: { color: C.txt2, fontSize: 12.5, fontWeight: "800", marginBottom: 2 },
  routeSummaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeSummaryLabel: { color: C.muted, flex: 1, fontSize: 12 },
  routeSummaryMin: { color: C.txt, fontSize: 12, fontWeight: "800" },
  cta: {
    minHeight: 52,
    marginTop: 12,
    backgroundColor: C.accent,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaOff: { backgroundColor: C.panel2 },
  ctaTxt: { color: C.onAccent, fontSize: 16, fontWeight: "800" },
});
