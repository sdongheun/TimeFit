import {
  DefaultTheme,
  NavigationContainer,
  Theme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootStackParamList } from "./src/ui/nav";
import { HomeScreen } from "./src/ui/HomeScreen";
import { TimeSetupScreen } from "./src/ui/TimeSetupScreen";
import { ResultsScreen } from "./src/ui/ResultsScreen";
import { ExecutionScreen } from "./src/ui/ExecutionScreen";
import { FeedbackScreen } from "./src/ui/FeedbackScreen";
import { ProfileScreen } from "./src/ui/ProfileScreen";
import { AppFlowProvider } from "./src/ui/AppFlowContext";
import { AuthProvider } from "./src/ui/AuthContext";
import { MyCoursesScreen } from "./src/ui/MyCoursesScreen";
import { C } from "./src/ui/theme";
import { initializeNotifications } from "./src/services/courseNotifications";
import { resetToMyCourses } from "./src/ui/mainTabNavigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card: C.bg,
    text: C.txt,
    border: C.line,
    primary: C.accent,
  },
};

export default function App() {
  useEffect(() => {
    initializeNotifications().catch((error) => {
      console.warn("[알림] 초기 권한 설정 실패", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppFlowProvider>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: C.bg },
                headerTintColor: C.txt,
                headerTitleStyle: { fontWeight: "700" },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: C.bg },
                animation: "fade",
                animationDuration: 250,
              }}
            >
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="TimeSetup"
                component={TimeSetupScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Results"
                component={ResultsScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="MyCourses"
                component={MyCoursesScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Execution"
                component={ExecutionScreen}
                options={({ navigation }) => ({
                  title: "코스 진행 중",
                  headerBackVisible: false,
                  headerLeft: () => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="내 코스로 돌아가기"
                      hitSlop={8}
                      onPress={() => resetToMyCourses(navigation)}
                      style={{
                        width: 42,
                        height: 42,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="arrow-left" size={21} color={C.txt} />
                    </Pressable>
                  ),
                })}
              />
              <Stack.Screen
                name="Feedback"
                component={FeedbackScreen}
                options={{ title: "코스 완료", headerBackVisible: false }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </AppFlowProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
