import { JSX, useMemo } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, IProgram, IScreenMuscle, ISettings, IStats } from "../types";
import { Program_evaluate } from "../models/program";
import { Muscle_getMuscleGroupName } from "../models/muscle";
import { Weight_convertTo, Weight_print } from "../models/weight";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Analytics_summary } from "./analytics";
import { DevFitAction, DevFitBar, DevFitColumns, DevFitMetric, DevFitSection, DevFitSurface, DevFitTitle } from "./ui";
import { DevFitPage } from "./page";

export function DevFitProgress(props: {
  history: IHistoryRecord[];
  settings: ISettings;
  stats: IStats;
  program?: IProgram;
  onGraphs: () => void;
  onMeasurements: () => void;
  onInsights: () => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const evaluated = useMemo(
    () => (props.program ? Program_evaluate(props.program, props.settings) : undefined),
    [props.program, props.settings]
  );
  const summary = useMemo(
    () => Analytics_summary(props.history, props.settings, props.stats, evaluated),
    [props.history, props.settings, props.stats, evaluated]
  );
  const latestWeight = props.stats.weight.weight?.slice().sort((a, b) => b.timestamp - a.timestamp)[0];
  return (
    <DevFitPage testID="devfit-progress">
      <DevFitTitle
        eyebrow="Consistency becomes progress"
        title="Progress"
        subtitle={`Last ${summary.range.days} days · ${summary.records.length} completed sessions`}
      />
      <DevFitSurface>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
          <DevFitMetric label="Working sets" value={`${summary.sets.total}`} />
          <DevFitMetric
            label={`Volume · ${props.settings.units}`}
            value={Math.round(summary.sets.volume.value).toLocaleString()}
          />
          <DevFitMetric label="Exercise PRs" value={`${summary.prs}`} />
        </View>
      </DevFitSurface>
      <DevFitColumns
        primary={
          <>
            <DevFitSection title="Your training mix" detail="Completed / plan">
              <DevFitSurface>
                {(["strength", "running", "cardio"] as const).map((kind) => (
                  <View key={kind} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <Text className="font-semibold" style={{ color: c.ink }}>
                        {kind === "strength" ? "Strength" : kind === "running" ? "Running" : "Endurance / cardio"}
                      </Text>
                      <Text className="font-bold" style={{ color: kind === "strength" ? c.accent : c.cardio }}>
                        {summary.completed[kind]} / {summary.planned[kind]}
                      </Text>
                    </View>
                    <DevFitBar value={summary.completed[kind]} total={summary.planned[kind]} />
                  </View>
                ))}
                <Text className="text-xs" style={{ color: c.muted }}>
                  Completions cover the last {summary.range.days} days; plan counts cover one{" "}
                  {summary.calendarCycleDays ?? 14}-day rotation. Mixed sessions can count in two categories. Recovery
                  days need no log.
                </Text>
              </DevFitSurface>
            </DevFitSection>
            <DevFitSection title="Strength signals" detail="Estimated 1RM">
              <DevFitSurface>
                {summary.trends.length ? (
                  summary.trends.slice(0, 6).map((t) => (
                    <View
                      key={t.key}
                      style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}
                    >
                      <Text className="text-sm" style={{ color: c.ink }}>
                        {t.name}
                      </Text>
                      <Text className="font-bold" style={{ color: t.direction === "up" ? c.success : c.muted }}>
                        {t.direction === "up" ? "↑" : t.direction === "down" ? "↓" : "→"} {t.change > 0 ? "+" : ""}
                        {t.change.toFixed(1)}%
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: c.muted }}>
                    Log two strength sessions for the same exercise to see a comparison.
                  </Text>
                )}
                <Text className="text-xs" style={{ color: c.muted }}>
                  Latest two completed sessions. Rep ranges, RPE, technique and deloads affect the estimate. This cannot
                  diagnose a plateau.
                </Text>
                <DevFitAction label="Exercise & muscle graphs" secondary onPress={props.onGraphs} />
              </DevFitSurface>
            </DevFitSection>
            <DevFitSection title="Muscle balance" detail="Sets · frequency">
              <DevFitSurface>
                {Object.entries(summary.sets.muscleGroup)
                  .filter(([, group]) => group.strength + group.hypertrophy > 0)
                  .map(([key, group]) => (
                    <View key={key} style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <Text className="text-sm font-semibold" style={{ color: c.ink }}>
                          {Muscle_getMuscleGroupName(key as IScreenMuscle, props.settings)}
                        </Text>
                        <Text className="text-xs" style={{ color: c.muted }}>
                          {+(group.strength + group.hypertrophy).toFixed(1)} sets ·{" "}
                          {Object.keys(group.frequency).length} days
                        </Text>
                      </View>
                      <Text className="text-xs" style={{ color: c.muted }}>
                        {+group.strength.toFixed(1)} sets below 8 reps · {+group.hypertrophy.toFixed(1)} sets at 8+ reps
                      </Text>
                    </View>
                  ))}
                {summary.sets.total === 0 && (
                  <Text style={{ color: c.muted }}>Strength sessions will build your muscle breakdown.</Text>
                )}
                <Text className="text-xs" style={{ color: c.muted }}>
                  Warmups and cardio excluded. Indirect sets use your configured synergist multiplier. These are rep
                  ranges, not prescribed targets.
                </Text>
              </DevFitSurface>
            </DevFitSection>
          </>
        }
        secondary={
          <>
            <DevFitSection title="Time in motion" detail="Running + cardio">
              <DevFitSurface>
                <DevFitMetric
                  value={`${Math.round(summary.cardioSeconds / 60)} min`}
                  label="Recorded cardio duration"
                />
                <DevFitBar value={summary.cardioSeconds} total={summary.plannedCardioSeconds} />
                <Text className="text-sm" style={{ color: c.muted }}>
                  {Math.round(summary.plannedCardioSeconds / 60)} min programmed per rotation. Only recorded timed sets
                  count toward duration.
                </Text>
                <Text className="text-xs" style={{ color: c.muted }}>
                  Adherence and duration help you build consistency. Distance, pace and GPS are not recorded.
                </Text>
              </DevFitSurface>
            </DevFitSection>
            <DevFitSection title="Body trends">
              <DevFitSurface>
                <DevFitMetric
                  value={latestWeight ? Weight_print(Weight_convertTo(latestWeight.value, props.settings.units)) : "—"}
                  label="Latest bodyweight"
                />
                {summary.bodyweightChange && (
                  <Text style={{ color: c.muted }}>
                    {summary.bodyweightChange.value > 0 ? "+" : ""}
                    {Weight_print(summary.bodyweightChange)} in this period
                  </Text>
                )}
                <DevFitAction label="Log weight & measurements" secondary onPress={props.onMeasurements} />
              </DevFitSurface>
            </DevFitSection>
            <DevFitAction label="Weekly insights" secondary onPress={props.onInsights} />
          </>
        }
      />
    </DevFitPage>
  );
}
