import { JSX, useMemo, useState } from "react";
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
import { DevFitCardioCharts } from "./cardioCharts";
import { DevFitCardioLog } from "./cardioLog";
import { IDispatch } from "../ducks/types";
import { Schedule_get, Schedule_slots } from "./schedule";
import { TrainingDate_scheduleConfig } from "./trainingDates";
import { useNow } from "../utils/useNow";

export function DevFitProgress(props: {
  history: IHistoryRecord[];
  settings: ISettings;
  stats: IStats;
  program?: IProgram;
  dispatch?: IDispatch;
  onGraphs: () => void;
  onMeasurements: () => void;
  onInsights: () => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [details, setDetails] = useState(false);
  const evaluated = useMemo(
    () => (props.program ? Program_evaluate(props.program, props.settings) : undefined),
    [props.program, props.settings]
  );
  const now = useNow(TrainingDate_scheduleConfig(evaluated ? Schedule_get(evaluated, props.settings) : undefined));
  const summary = useMemo(
    () => Analytics_summary(props.history, props.settings, props.stats, evaluated, now),
    [props.history, props.settings, props.stats, evaluated, now]
  );
  const latestWeight = props.stats.weight.weight?.slice().sort((a, b) => b.timestamp - a.timestamp)[0];
  return (
    <DevFitPage testID="devfit-progress">
      <DevFitTitle
        eyebrow="Consistency becomes progress"
        title="Progress"
        subtitle={`Last ${summary.range.days} days · ${summary.records.length} completed sessions`}
      />
      {props.dispatch && (
        <DevFitCardioLog
          history={props.history}
          settings={props.settings}
          dispatch={props.dispatch}
          program={props.program}
        />
      )}
      <DevFitSurface accent>
        <Text className="font-bold" style={{ color: c.ink }}>
          Training adherence · last {summary.range.days} training days
        </Text>
        <DevFitMetric label="Planned sessions completed" value={`${summary.attendedSlots} / ${summary.plannedSlots}`} />
        <DevFitBar value={summary.attendedSlots} total={summary.plannedSlots} />
        <Text className="text-xs" style={{ color: c.muted }}>
          The numerator and plan use this same rolling window. Extra sessions stay in history; recovery needs no log.
        </Text>
      </DevFitSurface>
      {props.program?.devfitPlan && (
        <DevFitSurface>
          <Text className="font-bold" style={{ color: c.ink }}>
            Strength milestones
          </Text>
          {Object.entries(props.program.devfitPlan.targets)
            .slice(0, 4)
            .map(([key, target]) => (
              <Text key={key} style={{ color: c.muted }}>
                {evaluated?.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises)).find((e) => e.key === key)?.name ??
                  "Exercise"}{" "}
                · {target.reps} reps · {target.calibrated ? "8 → 10 → 12 → 15" : "baseline pending"}
              </Text>
            ))}
        </DevFitSurface>
      )}
      <DevFitSurface>
        <Text className="font-bold" style={{ color: c.cardio }}>
          Cardio
        </Text>
        <DevFitMetric label="Recorded duration" value={`${Math.round(summary.cardioSeconds / 60)} min`} />
        <DevFitMetric label="Latest bodyweight" value={latestWeight ? Weight_print(latestWeight.value) : "—"} />
        <DevFitAction
          secondary
          label={details ? "Close detailed trends" : "Explore Strength · Cardio · Body trends"}
          onPress={() => setDetails(!details)}
        />
      </DevFitSurface>
      {details && <DevFitCardioCharts history={props.history} settings={props.settings} />}
      {details && evaluated && (
        <DevFitSurface>
          <Text style={{ color: c.ink }}>Current rotation · planned / performed</Text>
          {Schedule_slots(evaluated, props.settings, props.history, now)
            .filter((s) => s.session)
            .map((s) => (
              <Text key={s.day} style={{ color: c.muted }}>
                Day {s.day} · {s.session!.name}:{" "}
                {s.completed
                  ? s.completedLate
                    ? "explicit late credit"
                    : "completed"
                  : s.missed
                    ? "not logged"
                    : "planned"}
                {s.performed.length ? ` · performed ${s.performed.map((r) => r.dayName).join(", ")}` : ""}
              </Text>
            ))}
        </DevFitSurface>
      )}
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
                  Completed and planned counts cover the same last {summary.range.days} training days. Mixed sessions
                  can count in two categories. Recovery days need no log.
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
            {details && (
              <DevFitSection title="Muscle balance" detail="Sets · frequency">
                <DevFitSurface>
                  {Object.entries(summary.sets.muscleGroup)
                    .filter(([, group]) => group.strength + group.hypertrophy > 0)
                    .map(([key, group]) => (
                      <View key={key} style={{ gap: 6 }}>
                        <View
                          style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
                        >
                          <Text className="text-sm font-semibold" style={{ color: c.ink }}>
                            {Muscle_getMuscleGroupName(key as IScreenMuscle, props.settings)}
                          </Text>
                          <Text className="text-xs" style={{ color: c.muted }}>
                            {+(group.strength + group.hypertrophy).toFixed(1)} sets ·{" "}
                            {Object.keys(group.frequency).length} days
                          </Text>
                        </View>
                        <Text className="text-xs" style={{ color: c.muted }}>
                          {+group.strength.toFixed(1)} sets below 8 reps · {+group.hypertrophy.toFixed(1)} sets at 8+
                          reps
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
            )}
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
                  {Math.round(summary.plannedCardioSeconds / 60)} min programmed in this same rolling window. Only
                  recorded timed sets count toward duration.
                </Text>
                <Text className="text-xs" style={{ color: c.muted }}>
                  Actual timed or manually reported duration counts once. Optional machine measurements appear in cardio
                  progress.
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
