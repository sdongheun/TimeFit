import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Mode } from "../../engine";
import { C } from "../theme";

type Props = { mode: Mode; color?: string; size?: number };

export function TransportGlyph({ mode, color = C.txt2, size = 15 }: Props) {
  if (mode === "car") {
    return <MaterialCommunityIcons color={color} name="car" size={size} />;
  }
  if (mode === "transit") {
    return <MaterialCommunityIcons color={color} name="bus" size={size} />;
  }
  return <MaterialCommunityIcons color={color} name="walk" size={size} />;
}
