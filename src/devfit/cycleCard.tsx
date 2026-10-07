import { JSX, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, ISettings, IStats } from "../types";
import { IPersonalRecords } from "../models/history";
import { Cycle_summary } from "./cycle";
import { Muscle_getMuscleGroupName } from "../models/muscle";
import { IScreenMuscle } from "../types";
import { Weight_print } from "../models/weight";
import { DateUtils_formatRange } from "../utils/date";

export function DevFitCycleCard(props: {
  history: IHistoryRecord[];
  settings: ISettings;
  stats: IStats;
  prs: IPersonalRecords;
  now: number;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(
    () => Cycle_summary(props.history, props.settings, props.stats, props.prs, props.now),
    [props.history, props.settings, props.stats, props.prs, props.now]
  );
  return (
    <View className="mx-4 my-3 p-4 rounded-xl border border-border-neutral bg-background-subtle">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Training cycle details"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={{ minHeight: 48 }}
      >
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-lg font-bold">Your training cycle</Text>
          <Text className="text-sm text-text-secondary">{expanded ? "Less" : "Details"}</Text>
        </View>
        <Text className="text-sm text-text-secondary">
          Rolling {summary.range.days} days · {DateUtils_formatRange(summary.range.start, new Date(summary.range.now))}
        </Text>
      </Pressable>
      <View className="flex-row flex-wrap gap-4 mt-2">
        <CycleMetric label="Sessions / target" value={`${summary.records.length} / ${summary.target}`} />
        <CycleMetric label="Working sets" value={`${summary.sets.total}`} />
        <CycleMetric label={`Volume (${props.settings.units})`} value={`${Math.round(summary.sets.volume.value)}`} />
        <CycleMetric label="Exercise PRs" value={`${summary.prs}`} />
      </View>
      {expanded && (
        <View className="mt-3 gap-2">
          <Text className="text-sm">
            {summary.sets.strength} strength sets · {summary.sets.hypertrophy} hypertrophy sets
          </Text>
          <Text className="text-xs text-text-secondary">
            Rep split: below 8 / 8+. Warmups excluded. Change cycle length and session target in Settings.
          </Text>
          {summary.bodyweightChange && (
            <Text className="text-sm">
              Bodyweight change: {summary.bodyweightChange.value > 0 ? "+" : ""}
              {Weight_print(summary.bodyweightChange)}
            </Text>
          )}
          <Text className="font-semibold">Muscle sets · training days</Text>
          <View className="flex-row flex-wrap gap-x-6 gap-y-2">
            {Object.entries(summary.sets.muscleGroup).map(([key, group]) => (
              <View key={key} style={{ minWidth: 140, flexGrow: 1 }}>
                <Text className="text-sm">{Muscle_getMuscleGroupName(key as IScreenMuscle, props.settings)}</Text>
                <Text className="text-sm text-text-secondary">
                  {Math.round((group.strength + group.hypertrophy) * 10) / 10} sets ·{" "}
                  {Object.keys(group.frequency).length} days
                </Text>
              </View>
            ))}
          </View>
          <Text className="text-xs text-text-secondary">
            Indirect muscle sets use your configured synergist multiplier.
          </Text>
          {summary.trends.length > 0 && (
            <>
              <Text className="font-semibold">Recent estimated strength</Text>
              {summary.trends.slice(0, 6).map((trend) => (
                <Text key={trend.key} className="text-sm">
                  {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.name}:{" "}
                  {trend.change > 0 ? "+" : ""}
                  {trend.change.toFixed(1)}%
                </Text>
              ))}
              <Text className="text-xs text-text-secondary">
                Estimated 1RM, latest two sessions. Deloads, rep ranges and technique can affect this estimate.
              </Text>
            </>
          )}
          {summary.records.length === 0 && (
            <Text className="text-sm text-text-secondary">Finish a workout to start this cycle’s insights.</Text>
          )}
        </View>
      )}
    </View>
  );
}

function CycleMetric(props: { label: string; value: string }): JSX.Element {
  return (
    <View style={{ minWidth: 100, flexGrow: 1 }}>
      <Text className="text-xl font-bold">{props.value}</Text>
      <Text className="text-xs text-text-secondary">{props.label}</Text>
    </View>
  );
}
