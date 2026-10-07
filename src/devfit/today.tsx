import { JSX, useMemo } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, IProgram, ISettings, IStats } from "../types";
import { Program_evaluate, Program_getProgramDay, Program_getListOfDays } from "../models/program";
import { History_getPersonalRecords } from "../models/history";
import { ExerciseImage } from "../components/exerciseImage";
import { Cycle_summary } from "./cycle";
import { Schedule_get, Schedule_slots } from "./schedule";
import { Session_completion, Session_day, Session_displayName, SESSION_LABELS } from "./presentation";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import {
  DevFitAction,
  DevFitBar,
  DevFitColumns,
  DevFitMetric,
  DevFitSection,
  DevFitSurface,
  DevFitTag,
  DevFitTitle,
} from "./ui";
import { DevFitPage } from "./page";

export function DevFitToday(props: {
  program: IProgram;
  settings: ISettings;
  history: IHistoryRecord[];
  stats: IStats;
  progress?: IHistoryRecord;
  onStart: () => void;
  onSchedule: () => void;
  onProgress: () => void;
  onHistory: () => void;
  onChooseDay: () => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const now = new Date().setHours(12, 0, 0, 0);
  const evaluated = useMemo(() => Program_evaluate(props.program, props.settings), [props.program, props.settings]);
  const nextDay = Program_getProgramDay(evaluated, evaluated.nextDay);
  const session = nextDay && Session_day(nextDay, props.settings);
  const config = Schedule_get(evaluated, props.settings);
  const slots = useMemo(
    () => Schedule_slots(evaluated, props.settings, props.history, now),
    [evaluated, props.settings, props.history, now]
  );
  const today = slots.find((s) => s.isToday);
  const recoveryToday = today != null && (!today.session || today.session.kind === "recovery");
  const summary = useMemo(
    () =>
      Cycle_summary(
        props.history,
        { ...props.settings, devfitCycleDays: props.settings.devfitCycleDays ?? config.cycleDays },
        props.stats,
        History_getPersonalRecords(props.history),
        Date.now()
      ),
    [props.history, props.settings, props.stats, config.cycleDays, now]
  );
  const completion = props.progress && Session_completion(props.progress.entries);
  const nextAfter = Program_getProgramDay(
    evaluated,
    (evaluated.nextDay % Math.max(1, Program_getListOfDays(evaluated).length)) + 1
  );
  return (
    <DevFitPage testID="devfit-today">
      <DevFitTitle
        eyebrow="DevFit / your training"
        title="Today"
        subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      />
      <DevFitColumns
        primary={
          <>
            {recoveryToday && !props.progress && (
              <DevFitSurface>
                <DevFitTag label={today?.context === "work" ? "Work day · recovery" : "Recovery day"} success />
                <Text className="text-2xl font-bold" style={{ color: c.ink }}>
                  Make room to recover.
                </Text>
                <Text style={{ color: c.muted }}>
                  Easy movement, steps and rest. Your next training session stays ready when you are.
                </Text>
                <DevFitAction label="See your rotation" secondary onPress={props.onSchedule} />
              </DevFitSurface>
            )}
            <DevFitSurface accent testID="devfit-next-session">
              <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <DevFitTag
                  label={props.progress ? "In progress" : recoveryToday ? "Next training session" : "Up next"}
                  success={!!props.progress}
                />
                <DevFitTag
                  label={session ? SESSION_LABELS[session.kind] : "Training"}
                  cardio={session?.kind === "running" || session?.kind === "cardio"}
                />
              </View>
              <Text className="text-3xl font-bold" style={{ color: c.ink }}>
                {props.progress?.dayName || session?.name || props.program.name}
              </Text>
              <Text className="text-sm" style={{ color: c.muted }}>
                {props.program.name}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
                <DevFitMetric
                  value={session ? `${session.minutes} min` : "Your pace"}
                  label={
                    session?.kind === "strength" || session?.kind === "mixed"
                      ? "Estimated duration"
                      : "Planned duration"
                  }
                />
                <DevFitMetric value={`${props.progress?.entries.length ?? session?.count ?? 0}`} label="Exercises" />
              </View>
              {completion && (
                <>
                  <DevFitBar value={completion.completed} total={completion.total} />
                  <Text className="text-sm" style={{ color: c.muted }}>
                    {completion.completed} of {completion.total} sets logged · saved on this device
                  </Text>
                </>
              )}
              <DevFitAction
                label={props.progress ? "Continue workout  →" : "Start session  →"}
                testID="devfit-start-session"
                onPress={props.onStart}
                disabled={evaluated.errors.length > 0 && !props.progress}
              />
              {!props.progress && (
                <DevFitAction label="Choose a different session" secondary onPress={props.onChooseDay} />
              )}
              {evaluated.errors.length > 0 && (
                <Text style={{ color: c.muted }}>
                  Your program has an error. Open Schedule → Program tools to correct it.
                </Text>
              )}
            </DevFitSurface>
            {session && session.exercises.length > 0 && (
              <DevFitSection title="Your session" detail="In training order">
                {session.exercises.map((exercise, index) => (
                  <View
                    key={exercise.id}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}
                  >
                    <Text className="text-xs" style={{ color: c.muted, width: 24 }}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    {exercise.exerciseType && (
                      <ExerciseImage
                        exerciseType={exercise.exerciseType}
                        settings={props.settings}
                        size="small"
                        width={48}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text className="font-semibold" style={{ color: c.ink }}>
                        {Session_displayName(exercise.label || exercise.name)}
                      </Text>
                      {exercise.label && (
                        <Text className="text-xs" style={{ color: c.muted }}>
                          {exercise.name}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </DevFitSection>
            )}
          </>
        }
        secondary={
          <>
            <DevFitSection title="Your rhythm" detail={`Last ${summary.range.days} days`}>
              <DevFitSurface>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
                  <DevFitMetric value={`${summary.records.length}`} label="Sessions completed" />
                  <DevFitMetric value={`${summary.prs}`} label="Personal records" />
                </View>
                <DevFitBar value={summary.records.length} total={summary.target} />
                <Text className="text-sm" style={{ color: c.muted }}>
                  {summary.target} session goal · every kind of training counts
                </Text>
                <DevFitAction label="Explore progress" secondary onPress={props.onProgress} />
              </DevFitSurface>
            </DevFitSection>
            <DevFitSection title="Coming up">
              <DevFitSurface>
                <Text className="text-lg font-semibold" style={{ color: c.ink }}>
                  {nextAfter?.name ?? "Your next rotation"}
                </Text>
                <Text className="text-sm" style={{ color: c.muted }}>
                  {config.cycleDays}-day rotation · training and recovery in one place
                </Text>
                <DevFitAction label="Open schedule" secondary onPress={props.onSchedule} />
              </DevFitSurface>
            </DevFitSection>
            <DevFitSection title="Recent activity">
              {props.history.slice(0, 3).map((record) => (
                <Pressable
                  key={record.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open history for ${record.dayName}`}
                  onPress={props.onHistory}
                  style={{ minHeight: 64, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line, gap: 4 }}
                >
                  <Text className="font-semibold" style={{ color: c.ink }}>
                    {record.dayName || record.programName}
                  </Text>
                  <Text className="text-xs" style={{ color: c.muted }}>
                    {new Date(record.startTime).toLocaleDateString()} · {Session_completion(record.entries).completed}{" "}
                    sets logged
                  </Text>
                </Pressable>
              ))}
              {props.history.length === 0 && (
                <Text style={{ color: c.muted }}>Your first completed session will appear here.</Text>
              )}
              <DevFitAction label="Workout history" testID="devfit-history" secondary onPress={props.onHistory} />
            </DevFitSection>
          </>
        }
      />
    </DevFitPage>
  );
}
