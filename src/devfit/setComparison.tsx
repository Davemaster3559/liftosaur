import { JSX } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryEntry, ISet } from "../types";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { LiftingUnits_print } from "./liftingUnits";

function summary(set: ISet | undefined, completed: boolean): string {
  const weight = completed ? set?.completedWeight : set?.weight;
  const reps = completed ? set?.completedReps : set?.reps;
  return !set || reps == null
    ? "—"
    : `${reps}${set.completedRepsLeft != null ? `/${set.completedRepsLeft}` : ""} × ${weight ? LiftingUnits_print(weight) : "—"}`;
}

export function DevFitSetComparison(props: {
  entry: IHistoryEntry;
  previous?: IHistoryEntry;
  activeId?: string;
  onSelect: (id: string) => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  return (
    <View
      testID="devfit-set-comparison"
      style={{ borderRadius: 16, borderWidth: 1, borderColor: c.line, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", padding: 12, gap: 6, backgroundColor: c.surface }}>
        <Text className="text-xs font-bold" style={{ width: 36, color: c.muted }}>
          SET
        </Text>
        <Text className="text-xs font-bold" style={{ flex: 1, color: c.muted }}>
          LAST
        </Text>
        <Text className="text-xs font-bold" style={{ flex: 1, color: c.accent }}>
          TODAY
        </Text>
      </View>
      <FlatList
        scrollEnabled={false}
        data={props.entry.sets}
        keyExtractor={(set) => set.id}
        renderItem={({ item: set, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit set ${index + 1}`}
            onPress={() => props.onSelect(set.id)}
            style={{
              minHeight: 52,
              padding: 12,
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              backgroundColor: props.activeId === set.id ? c.accentsoft : c.canvas,
              borderTopWidth: 1,
              borderColor: c.line,
            }}
          >
            <Text className="font-semibold" style={{ width: 36, color: set.isCompleted ? c.success : c.muted }}>
              {set.isCompleted ? "✓" : index + 1}
            </Text>
            <Text className="text-sm" style={{ flex: 1, color: c.muted }}>
              {summary(props.previous?.sets[index], true)}
            </Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text className="text-sm font-bold" style={{ color: c.ink }}>
                {summary(set, !!set.isCompleted)}
              </Text>
              {(set.completedWeight ?? set.weight) && (
                <Text className="text-xs" style={{ color: c.muted }}>
                  {LiftingUnits_print((set.completedWeight ?? set.weight)!, "kg")}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
