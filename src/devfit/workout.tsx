import { JSX, ReactNode, memo, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { lb } from "lens-shmens";
import { Text } from "../components/primitives/text";
import { ExerciseImage } from "../components/exerciseImage";
import { WorkoutExerciseSet, computeSetColumnWidths } from "../components/workoutExerciseSet";
import { IHistoryRecord, ISettings, ISubscription } from "../types";
import { IDispatch } from "../ducks/types";
import { IEvaluatedProgram, Program_getProgramExercise } from "../models/program";
import { Exercise_get, Exercise_toKey } from "../models/exercise";
import { History_buildPrevExerciseData } from "../models/history";
import { updateProgress } from "../models/state";
import { useRem } from "../utils/useRem";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { WorkoutFocus_active, WorkoutFocus_sets } from "./workoutFocus";
import {
  Session_cardioIntent,
  Session_completion,
  Session_exerciseKind,
  Session_minutes,
  Session_displayName,
} from "./presentation";
import { Thunk_pushExerciseStatsScreen, Thunk_pushToEditProgramExercise } from "../ducks/thunks";
import { Progression_brief, Progression_sets } from "./progression";
import { DevFitActiveSet } from "./activeSet";
import { DevFitRestPanel } from "./restPanel";
import { DevFitAction, DevFitBar, DevFitColumns, DevFitSection, DevFitSurface, DevFitTag, DevFitTitle } from "./ui";
import { DevFitPage } from "./page";

const renderActiveSet = (props: Parameters<typeof DevFitActiveSet>[0]): JSX.Element => <DevFitActiveSet {...props} />;

export const DevFitWorkout = memo(function DevFitWorkout(props: {
  progress: IHistoryRecord;
  history: IHistoryRecord[];
  program?: IEvaluatedProgram;
  settings: ISettings;
  subscription: ISubscription;
  dispatch: IDispatch;
  onAdvanced: () => void;
  finish: ReactNode;
  menu?: ReactNode;
}): JSX.Element {
  const { progress, settings } = props;
  const c = Tailwind_semantic().devfit;
  const rem = useRem();
  const entryIndex = Math.min(progress.currentEntryIndex ?? 0, Math.max(0, progress.entries.length - 1));
  const entry = progress.entries[entryIndex];
  const [selected, setSelected] = useState<{ entryId: string; setId: string }>();
  const sameDay = useMemo(
    () => ({ programId: progress.programId, day: progress.day, week: progress.week, dayInWeek: progress.dayInWeek }),
    [progress.programId, progress.day, progress.week, progress.dayInWeek]
  );
  const keyString = progress.entries.map((e) => Exercise_toKey(e.exercise)).join("\n");
  const previous = useMemo(
    () => History_buildPrevExerciseData(props.history, progress.startTime, sameDay, new Set(keyString.split("\n"))),
    [props.history, progress.startTime, sameDay, keyString]
  );
  const completion = Session_completion(progress.entries);
  if (!entry) {
    return (
      <DevFitPage>
        <DevFitTitle title="Your workout" />
        <DevFitAction label="Add your first exercise" onPress={props.onAdvanced} />
      </DevFitPage>
    );
  }
  const exercise = Exercise_get(entry.exercise, settings.exercises);
  const programExercise =
    props.program && Program_getProgramExercise(progress.day, props.program, entry.programExerciseId);
  const lastEntry = previous[Exercise_toKey(entry.exercise)]?.lastEntry;
  const active = WorkoutFocus_active(entry, selected?.entryId === entry.id ? selected.setId : undefined);
  const kind = Session_exerciseKind(programExercise, entry, settings);
  const cardio = kind === "running" || kind === "cardio";
  const allSets = WorkoutFocus_sets(entry);
  return (
    <DevFitPage testID="devfit-workout">
      <DevFitTitle
        eyebrow={progress.programName}
        title={progress.dayName || "Your workout"}
        subtitle={`${completion.completed} of ${completion.total} sets logged · saved on this device`}
        action={props.menu}
      />
      <DevFitBar value={completion.completed} total={completion.total} />
      <DevFitColumns
        primary={
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${exercise.name} details`}
                onPress={() => props.dispatch(Thunk_pushExerciseStatsScreen(entry.exercise))}
                style={{ backgroundColor: c.surface, borderRadius: 18, padding: 4 }}
              >
                <ExerciseImage exerciseType={entry.exercise} settings={settings} size="small" width={88} />
              </Pressable>
              <View style={{ flex: 1, gap: 6 }}>
                <DevFitTag
                  label={
                    cardio
                      ? kind === "running"
                        ? "Running"
                        : "Cardio"
                      : `Exercise ${entryIndex + 1} of ${progress.entries.length}`
                  }
                  cardio={cardio}
                />
                <Text className="text-2xl font-bold" style={{ color: c.ink }}>
                  {Session_displayName(programExercise?.label || exercise.name)}
                </Text>
                {programExercise?.label && (
                  <Text className="text-sm" style={{ color: c.muted }}>
                    {exercise.name}
                  </Text>
                )}
                {entry.superset && <DevFitTag label={`Superset · ${entry.superset}`} />}
              </View>
            </View>
            <DevFitRestPanel progress={progress} settings={settings} dispatch={props.dispatch} />
            {cardio && (
              <DevFitSurface>
                <Text className="font-semibold" style={{ color: c.cardio }}>
                  {kind === "running" ? "Your running session" : "Your cardio session"}
                </Text>
                <Text className="text-sm" style={{ color: c.muted }}>
                  {Session_cardioIntent(programExercise, entry, settings)}
                </Text>
                {entry.sets.some((s) => s.label) && (
                  <View style={{ gap: 8 }}>
                    {entry.sets.map((s, i) => (
                      <Text key={s.id} className="text-sm" style={{ color: s.isCompleted ? c.success : c.muted }}>
                        {s.isCompleted ? "✓" : `${i + 1}.`} {s.label || "Work"} · {Session_minutes(s.setTimer ?? 0)}
                      </Text>
                    ))}
                  </View>
                )}
              </DevFitSurface>
            )}
            {active ? (
              <WorkoutExerciseSet
                key={active.set.id}
                renderBody={renderActiveSet}
                isExpanded
                isNext
                isCurrentProgress
                isPlayground={false}
                exerciseType={entry.exercise}
                day={progress.day}
                type={active.mode}
                entryIndex={entryIndex}
                setIndex={active.index}
                set={active.set}
                lastSet={active.mode === "workout" ? lastEntry?.sets[active.index] : undefined}
                programExercise={programExercise}
                otherStates={props.program?.states}
                subscription={props.subscription}
                columnWidths={computeSetColumnWidths(rem, !!active.set.isUnilateral, active.set.logRpe ? "RPE" : "")}
                lbSets={lb<IHistoryRecord>()
                  .p("entries")
                  .i(entryIndex)
                  .p(active.mode === "warmup" ? "warmupSets" : "sets")}
                lbSet={lb<IHistoryRecord>()
                  .p("entries")
                  .i(entryIndex)
                  .p(active.mode === "warmup" ? "warmupSets" : "sets")
                  .i(active.index)}
                settings={settings}
                dispatch={props.dispatch}
                onCompleteExpansion={() => setSelected(undefined)}
              />
            ) : (
              <DevFitSurface>
                <DevFitTag label="✓ Exercise complete" success />
                <Text className="text-xl font-bold" style={{ color: c.ink }}>
                  Good work. Keep moving.
                </Text>
                <DevFitAction
                  label={entryIndex + 1 < progress.entries.length ? "Next exercise →" : "Review your workout"}
                  onPress={() => {
                    if (entryIndex + 1 < progress.entries.length) {
                      updateProgress(
                        props.dispatch,
                        lb<IHistoryRecord>()
                          .p("currentEntryIndex")
                          .record(entryIndex + 1),
                        "devfit-next-exercise"
                      );
                    } else {
                      props.onAdvanced();
                    }
                  }}
                />
              </DevFitSurface>
            )}
            <DevFitSection title="Set timeline" detail="Tap to edit a set">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {allSets.map((s) => (
                  <Pressable
                    key={s.set.id}
                    testID={s.set.isCompleted ? "set-completed" : "devfit-set-pending"}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.mode === "warmup" ? "Warmup" : "Set"} ${s.index + 1}, ${s.set.isCompleted ? "completed" : "planned"}`}
                    onPress={() => setSelected({ entryId: entry.id, setId: s.set.id })}
                    style={{
                      minHeight: 48,
                      minWidth: 56,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: s.set.isCompleted ? c.successsoft : c.surface,
                      borderWidth: 1,
                      borderColor: active?.set.id === s.set.id ? c.accent : c.line,
                    }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: s.set.isCompleted ? c.success : c.muted }}>
                      {s.set.isCompleted ? "✓ " : ""}
                      {s.mode === "warmup" ? "W" : ""}
                      {s.index + 1}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </DevFitSection>
          </>
        }
        secondary={
          <>
            <DevFitSection title="Last / Today / Next">
              <DevFitSurface testID="devfit-progression">
                {[
                  { label: "LAST", value: Progression_sets(lastEntry, true, settings.units) },
                  { label: "TODAY", value: Progression_sets(entry, false, settings.units) },
                  { label: "NEXT", value: Progression_brief(programExercise) },
                ].map((item) => (
                  <View key={item.label} style={{ gap: 6 }}>
                    <Text
                      className="text-xs font-bold"
                      style={{ color: item.label === "NEXT" ? c.success : c.accent, letterSpacing: 1.5 }}
                    >
                      {item.label}
                    </Text>
                    <Text className="text-sm" style={{ color: c.ink }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
                <DevFitAction
                  label="Exercise details & history"
                  secondary
                  onPress={() => props.dispatch(Thunk_pushExerciseStatsScreen(entry.exercise))}
                />
                {programExercise && (
                  <DevFitAction
                    label="View progression rule"
                    testID="devfit-view-progression"
                    secondary
                    onPress={() =>
                      props.dispatch(
                        Thunk_pushToEditProgramExercise(programExercise.key, programExercise.dayData, {
                          workoutProgramId: props.program?.id,
                        })
                      )
                    }
                  />
                )}
              </DevFitSurface>
            </DevFitSection>
            <DevFitSection title="Session lineup" detail={`${progress.entries.length} exercises`}>
              {progress.entries.map((e, i) => {
                const done = Session_completion([e]);
                return (
                  <Pressable
                    key={e.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${Exercise_get(e.exercise, settings.exercises).name}, ${done.completed} of ${done.total} sets`}
                    onPress={() => {
                      setSelected(undefined);
                      updateProgress(
                        props.dispatch,
                        lb<IHistoryRecord>().p("currentEntryIndex").record(i),
                        "devfit-select-exercise"
                      );
                    }}
                    style={{
                      minHeight: 64,
                      padding: 12,
                      gap: 6,
                      backgroundColor: i === entryIndex ? c.accentsoft : c.surface,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: i === entryIndex ? c.accent : c.line,
                    }}
                  >
                    <Text className="font-semibold" style={{ color: c.ink }}>
                      {String(i + 1).padStart(2, "0")} {Exercise_get(e.exercise, settings.exercises).name}
                    </Text>
                    <Text className="text-xs" style={{ color: done.completed === done.total ? c.success : c.muted }}>
                      {done.completed === done.total ? "✓ Complete" : `${done.completed} / ${done.total} sets`}
                    </Text>
                  </Pressable>
                );
              })}
            </DevFitSection>
            <DevFitAction
              label="Workout tools · add / swap / notes"
              testID="devfit-workout-tools"
              secondary
              onPress={props.onAdvanced}
            />
            <View style={{ alignItems: "stretch", paddingVertical: 8 }}>{props.finish}</View>
          </>
        }
      />
    </DevFitPage>
  );
});
