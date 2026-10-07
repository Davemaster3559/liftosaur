import { JSX, ReactNode } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Text } from "../components/primitives/text";
import { useRemScale } from "../utils/useRem";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { DevFit_layout } from "./layout";

export function useDevFitLayout(): ReturnType<typeof DevFit_layout> {
  return DevFit_layout(useWindowDimensions().width, useRemScale());
}

export function DevFitTitle(props: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          {props.eyebrow && (
            <Text className="text-xs font-bold" style={{ color: Tailwind_semantic().devfit.accent, letterSpacing: 2 }}>
              {props.eyebrow.toUpperCase()}
            </Text>
          )}
          <Text className="text-3xl font-bold" style={{ color: Tailwind_semantic().devfit.ink }}>
            {props.title}
          </Text>
        </View>
        {props.action}
      </View>
      {props.subtitle && (
        <Text className="text-sm" style={{ color: Tailwind_semantic().devfit.muted }}>
          {props.subtitle}
        </Text>
      )}
    </View>
  );
}

export function DevFitSurface(props: { children: ReactNode; accent?: boolean; testID?: string }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  return (
    <View
      testID={props.testID}
      style={{
        backgroundColor: props.accent ? c.accentsoft : c.surface,
        borderRadius: 22,
        padding: 20,
        gap: 16,
        borderWidth: 1,
        borderColor: props.accent ? c.accent : c.line,
      }}
    >
      {props.children}
    </View>
  );
}

export function DevFitAction(props: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  testID?: string;
  disabled?: boolean;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !!props.disabled }}
      testID={props.testID}
      data-testid={props.testID}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: props.secondary ? c.raised : c.accent,
        alignItems: "center",
        justifyContent: "center",
        opacity: props.disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Text className="font-bold text-base text-center" style={{ color: props.secondary ? c.ink : c.onaccent }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function DevFitTag(props: { label: string; cardio?: boolean; success?: boolean }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: props.success ? c.successsoft : props.cardio ? c.cardiosoft : c.raised,
      }}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: props.success ? c.success : props.cardio ? c.cardio : c.muted }}
      >
        {props.label}
      </Text>
    </View>
  );
}

export function DevFitSection(props: { title: string; detail?: string; children: ReactNode }): JSX.Element {
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text className="text-lg font-bold" style={{ color: Tailwind_semantic().devfit.ink }}>
          {props.title}
        </Text>
        {props.detail && (
          <Text className="text-xs" style={{ color: Tailwind_semantic().devfit.muted }}>
            {props.detail}
          </Text>
        )}
      </View>
      {props.children}
    </View>
  );
}

export function DevFitMetric(props: { value: string; label: string }): JSX.Element {
  return (
    <View style={{ flexGrow: 1, flexBasis: 110, gap: 4 }}>
      <Text className="text-2xl font-bold" style={{ color: Tailwind_semantic().devfit.ink }}>
        {props.value}
      </Text>
      <Text className="text-xs" style={{ color: Tailwind_semantic().devfit.muted }}>
        {props.label}
      </Text>
    </View>
  );
}

export function DevFitBar(props: { value: number; total: number }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const pct = props.total > 0 ? Math.max(0, Math.min(100, (props.value / props.total) * 100)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: props.total, now: props.value }}
      style={{ height: 6, borderRadius: 3, backgroundColor: c.raised, overflow: "hidden" }}
    >
      <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: c.success }} />
    </View>
  );
}

export function DevFitColumns(props: { primary: ReactNode; secondary: ReactNode }): JSX.Element {
  const { wide, gap } = useDevFitLayout();
  return (
    <View
      testID={wide ? "devfit-two-columns" : "devfit-one-column"}
      style={{ flexDirection: wide ? "row" : "column", gap, alignItems: "stretch" }}
    >
      <View style={{ flex: wide ? 1.35 : undefined, minWidth: 0, gap: 24 }}>{props.primary}</View>
      <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 24 }}>{props.secondary}</View>
    </View>
  );
}
