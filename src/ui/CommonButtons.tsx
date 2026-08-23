import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";
import { C } from "./theme";
import { UI_RADIUS, UI_SIZE } from "./tokens";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: PrimaryButtonProps) {
  const isInactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      style={[s.primaryBtn, isInactive && s.primaryBtnDisabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={C.onAccent} />
      ) : (
        <Text style={[s.primaryBtnText, isInactive && s.primaryBtnTextDisabled, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

interface HeaderBackButtonProps {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function HeaderBackButton({
  onPress,
  accessibilityLabel = "이전 화면으로 돌아가기",
  style,
  testID,
}: HeaderBackButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={[s.backBtn, style]}
    >
      <Feather name="arrow-left" size={20} color={C.txt} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  primaryBtn: {
    minHeight: UI_SIZE.primaryAction,
    height: UI_SIZE.primaryAction,
    borderRadius: UI_RADIUS.control,
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  primaryBtnDisabled: {
    backgroundColor: C.panel2,
  },
  primaryBtnText: {
    color: C.onAccent,
    fontSize: 16,
    fontWeight: "800",
  },
  primaryBtnTextDisabled: {
    color: C.muted,
  },
  backBtn: {
    width: UI_SIZE.iconControl,
    height: UI_SIZE.iconControl,
    borderRadius: UI_RADIUS.control,
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.line,
    justifyContent: "center",
    alignItems: "center",
  },
});
