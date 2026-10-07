import { JSX } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./primitives/text";
import { Thunk_pushScreen, Thunk_startProgramDay } from "../ducks/thunks";
import { IDispatch } from "../ducks/types";
import { ITab } from "../models/screen";
import { INavCommon } from "../models/state";
import { IconHome } from "./icons/iconHome";
import { IconDoc2 } from "./icons/iconDoc2";
import { IconGraphs } from "./icons/iconGraphs";
import { IconMe } from "./icons/iconMe";
import { Tailwind_semantic } from "../utils/tailwindConfig";

export function Footer2View(props: { dispatch: IDispatch; navCommon: INavCommon; currentTab: ITab }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const insets = useSafeAreaInsets();
  const tabs = [
    {
      tab: "home" as const,
      label: "Today",
      screen: "main" as const,
      icon: (selected: boolean) => <IconHome size={22} isSelected={selected} />,
    },
    {
      tab: "program" as const,
      label: "Schedule",
      screen: "programs" as const,
      icon: (selected: boolean) => <IconDoc2 isSelected={selected} />,
    },
    {
      tab: "graphs" as const,
      label: "Progress",
      screen: "graphsList" as const,
      icon: (selected: boolean) => <IconGraphs color={selected ? c.accent : c.muted} />,
    },
    {
      tab: "me" as const,
      label: "Me",
      screen: "settings" as const,
      icon: (selected: boolean) => <IconMe isSelected={selected} color={selected ? c.accent : c.muted} />,
    },
  ];
  return (
    <View style={{ backgroundColor: c.canvas, borderTopWidth: 1, borderColor: c.line, paddingBottom: insets.bottom }}>
      {props.navCommon.isOngoingProgress && props.currentTab !== "workout" && (
        <Pressable
          testID="footer-workout"
          data-testid="footer-workout"
          accessibilityRole="button"
          accessibilityLabel="Continue active workout"
          onPress={() => props.dispatch(Thunk_startProgramDay())}
          style={{
            minHeight: 52,
            padding: 14,
            margin: 8,
            borderRadius: 14,
            backgroundColor: c.accentsoft,
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text className="font-semibold" style={{ color: c.accent }}>
            ● Workout in progress
          </Text>
          <Text className="font-bold" style={{ color: c.accent }}>
            Continue →
          </Text>
        </Pressable>
      )}
      <View style={{ flexDirection: "row", width: "100%", maxWidth: 900, alignSelf: "center", paddingVertical: 6 }}>
        {tabs.map((t) => (
          <Pressable
            key={t.tab}
            testID={`footer-${t.tab}`}
            data-testid={`footer-${t.tab}`}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: props.currentTab === t.tab }}
            onPress={() => props.dispatch(Thunk_pushScreen(t.screen, undefined, { tab: t.tab }))}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 56, gap: 5, padding: 4 }}
          >
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: props.currentTab === t.tab ? c.accentsoft : "transparent",
              }}
            >
              {t.icon(props.currentTab === t.tab)}
            </View>
            <Text className="text-xs font-semibold" style={{ color: props.currentTab === t.tab ? c.accent : c.muted }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
