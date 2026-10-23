import { JSX, useMemo } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryEntry, IUnit } from "../types";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import { Progression_rule, Progression_sets } from "./progression";

export function DevFitProgressionCue(props: {
  entry: IHistoryEntry;
  previous?: IHistoryEntry;
  exercise?: IPlannerProgramExercise;
  unit: IUnit;
  onViewRule?: () => void;
}): JSX.Element {
  const last = useMemo(() => Progression_sets(props.previous, true, props.unit), [props.previous, props.unit]);
  const today = useMemo(() => Progression_sets(props.entry, false, props.unit), [props.entry, props.unit]);
  const next = useMemo(() => Progression_rule(props.exercise), [props.exercise]);
  return (
    <View
      className="mx-4 mt-3 p-3 rounded-lg bg-background-default border border-border-neutral"
      testID="devfit-progression"
    >
      <View className="flex-row gap-3">
        <View className="flex-1 min-w-0">
          <Text className="text-xs text-text-secondary">LAST SESSION</Text>
          <Text className="text-sm mt-1">{last}</Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-xs text-text-secondary">TODAY</Text>
          <Text className="text-sm mt-1 font-semibold">{today}</Text>
        </View>
      </View>
      <Text className="text-xs text-text-secondary mt-3">NEXT · PROGRESSION RULE</Text>
      <Text className="text-sm mt-1">{next}</Text>
      {props.onViewRule && (
        <Pressable
          accessibilityRole="button"
          onPress={props.onViewRule}
          testID="devfit-view-progression"
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text className="text-sm text-text-link">View program rule</Text>
        </Pressable>
      )}
    </View>
  );
}
