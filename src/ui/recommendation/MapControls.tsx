import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { AnimatedPressable as Pressable } from "../AnimatedPressable";
import { C } from "../theme";
import { UI_RADIUS, UI_SIZE } from "../tokens";

type IconButtonProps = {
  accessibilityLabel: string;
  icon: ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

type TopBarProps = {
  remainingMin: number;
  basketCount: number;
  onBack: () => void;
  onOpenBasket: () => void;
};

export function MapIconButton({
  accessibilityLabel,
  icon,
  onPress,
  style,
}: IconButtonProps) {
  return (
    <Pressable variant="icon" style={[s.iconButton, style]} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <Feather color={C.txt} name={icon} size={21} />
    </Pressable>
  );
}

export function RecommendationMapTopBar({
  remainingMin,
  basketCount,
  onBack,
  onOpenBasket,
}: TopBarProps) {
  return (
    <View style={s.topBar}>
      <MapIconButton
        accessibilityLabel="시간 설정으로 돌아가기"
        icon="arrow-left"
        onPress={onBack}
      />
      <View style={s.timePill}>
        <Text style={s.timePillValue}>코스 만들기 · {remainingMin}분 남음</Text>
      </View>
      <Pressable
        variant="icon"
        style={s.cartButton}
        onPress={onOpenBasket}
        accessibilityLabel={`장바구니, ${basketCount}곳 선택됨`}
      >
        <Feather color={C.txt} name="shopping-bag" size={21} />
        <View style={s.cartCount}>
          <Text style={s.cartCountText}>{basketCount}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: UI_SIZE.iconControl,
    height: UI_SIZE.iconControl,
    borderRadius: UI_RADIUS.control,
    borderColor: C.line,
    borderWidth: 1,
    backgroundColor: "rgba(31,32,35,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  timePill: {
    flex: 1,
    height: UI_SIZE.iconControl,
    paddingHorizontal: 11,
    justifyContent: "center",
    borderRadius: UI_RADIUS.control,
    borderColor: C.line,
    borderWidth: 1,
    backgroundColor: "rgba(31,32,35,0.92)",
  },
  timePillValue: { color: C.txt, fontSize: 13.5, fontWeight: "800" },
  cartButton: {
    width: UI_SIZE.iconControl,
    height: UI_SIZE.iconControl,
    borderRadius: UI_RADIUS.control,
    justifyContent: "center",
    alignItems: "center",
    borderColor: C.line,
    borderWidth: 1,
    backgroundColor: "rgba(31,32,35,0.92)",
  },
  cartCount: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: UI_RADIUS.pill,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.bg,
  },
  cartCountText: { color: C.onAccent, fontSize: 10.5, fontWeight: "900" },
});
