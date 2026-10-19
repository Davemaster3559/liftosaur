import { JSX, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, IProgram, ISettings, IStats } from "../types";
import { IDispatch } from "../ducks/types";
import { Program_evaluate, Program_getProgramDay } from "../models/program";
import { History_getPersonalRecords } from "../models/history";
import { ExerciseImage } from "../components/exerciseImage";
import { useNow } from "../utils/useNow";
import { Cycle_summary } from "./cycle";
import { Schedule_overview, Schedule_suggestion, Schedule_anchor } from "./schedule";
import { updateSettings } from "../models/state";
import { lb } from "lens-shmens";
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
import { DevFitCardioLog } from "./cardioLog";
import { Dates_key, Dates_label } from "./dates";

export function DevFitToday(props: {
  program: IProgram;
  settings: ISettings;
  history: IHistoryRecord[];
  stats: IStats;
  progress?: IHistoryRecord;
  dispatch?: IDispatch;
  now?: number;
  onStart: (programDay?: number) => void;
  onCatchUp?: (includeCardio: boolean) => void;
  onDismissSetup?: () => void;
  onSchedule: () => void;
  onProgress: () => void;
  onHistory: () => void;
  onChooseDay: () => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const clock = useNow();
  const now = props.now ?? clock;
  const [showMissed, setShowMissed] = useState(false);
  const [includeCardio, setIncludeCardio] = useState(false);
  const evaluated = useMemo(() => Program_evaluate(props.program, props.settings), [props.program, props.settings]);
  const plan = useMemo(
    () => Schedule_overview(evaluated, props.settings, props.history, now),
    [evaluated, props.settings, props.history, now]
  );
  const selectedDay = props.progress
    ? props.progress.programId === props.program.id
      ? props.progress.day
      : undefined
    : plan.selectedDay;
  const day = selectedDay != null ? Program_getProgramDay(evaluated, selectedDay) : undefined;
  const session = day && Session_day(day, props.settings);
  const summary = useMemo(
    () =>
      Cycle_summary(
        props.history,
        {
          ...props.settings,
          devfitCycleDays: props.settings.devfitCycleDays ?? plan.config.cycleDays,
          devfitSchedules: { [props.program.id]: plan.config },
        },
        props.stats,
        History_getPersonalRecords(props.history),
        now
      ),
    [props.history, props.settings, props.stats, plan.config.cycleDays, now]
  );
  const completion = props.progress && Session_completion(props.progress.entries);
  const suggestion = plan.setupNeeded ? Schedule_suggestion(evaluated, props.settings, props.history, now) : undefined;
  return (
    <DevFitPage testID="devfit-today">
      <DevFitTitle
        eyebrow="DevFit / your training"
        title="Today"
        subtitle={Dates_label(Dates_key(now, plan.config.homeTimeZone))}
      />
      {plan.today && (
        <View testID="devfit-rotation-day-badge" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <DevFitTag label={`Rotation Day ${plan.today.day}`} />
          {plan.today.context && <DevFitTag label={plan.today.context === "work" ? "Work day" : "Off day"} />}
        </View>
      )}
      {plan.setupNeeded && (
        <DevFitSurface testID="devfit-schedule-setup">
          <Text className="text-lg font-semibold" style={{ color: c.ink }}>
            Keep your rotation in step with your calendar.
          </Text>
          <Text style={{ color: c.muted }}>
            {suggestion?.explanation} Confidence: {suggestion?.confidence}.
          </Text>
          {props.dispatch && suggestion && (
            <DevFitAction
              label={`Confirm Day ${suggestion.day} is today`}
              onPress={() =>
                updateSettings(
                  props.dispatch!,
                  lb<ISettings>()
                    .p("devfitSchedules")
                    .recordModify((s) => ({
                      ...s,
                      [props.program.id]: Schedule_anchor(plan.config, suggestion.day, now),
                    })),
                  "Confirm home rotation"
                )
              }
            />
          )}
          <DevFitAction label="Set up my rotation" onPress={props.onSchedule} />
          {props.onDismissSetup && <DevFitAction label="Later" secondary onPress={props.onDismissSetup} />}
        </DevFitSurface>
      )}
      {props.dispatch && (
        <DevFitCardioLog
          compact
          history={props.history}
          settings={props.settings}
          program={props.program}
          dispatch={props.dispatch}
        />
      )}
      <DevFitColumns
        primary={
          <>
            {plan.recovery && !props.progress ? (
              <DevFitSurface testID="devfit-recovery-today">
                <DevFitTag
                  label={plan.today?.context === "work" ? "Work day · recovery / steps" : "Recovery / steps"}
                  success
                />
                <Text className="text-2xl font-bold" style={{ color: c.ink }}>
                  Make room to recover.
                </Text>
                <Text style={{ color: c.muted }}>
                  No formal workout planned. Easy movement, steps and rest are part of your rotation.
                </Text>
                <DevFitAction label="See your rotation" secondary onPress={props.onSchedule} />
                <DevFitAction label="Choose a different session" secondary onPress={props.onChooseDay} />
              </DevFitSurface>
            ) : (
              <DevFitSurface accent testID="devfit-next-session">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <DevFitTag
                    label={
                      props.progress
                        ? "In progress"
                        : plan.today?.completed
                          ? "✓ Completed today"
                          : plan.today
                            ? "Today's scheduled session"
                            : "Up next"
                    }
                    success={!!props.progress || !!plan.today?.completed}
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
                {plan.mismatch && !props.progress && (
                  <Text testID="devfit-calendar-mismatch" style={{ color: c.accent }}>
                    Your program pointer differs from today's rotation. Use today's session to select {session?.name}.
                  </Text>
                )}
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
                {plan.today?.completed && !props.progress ? (
                  <>
                    <DevFitAction label="View saved workout" onPress={props.onHistory} />
                    <DevFitAction
                      label="Train this session again"
                      secondary
                      onPress={() => props.onStart(plan.selectedDay)}
                    />
                  </>
                ) : (
                  <DevFitAction
                    label={
                      props.progress
                        ? "Continue workout →"
                        : plan.mismatch
                          ? "Use today's session →"
                          : "Start workout →"
                    }
                    testID="devfit-start-session"
                    onPress={() => props.onStart(props.progress ? undefined : plan.selectedDay)}
                    disabled={evaluated.errors.length > 0 && !props.progress}
                  />
                )}
                {!props.progress && (
                  <DevFitAction label="Choose a different session" secondary onPress={props.onChooseDay} />
                )}
                {evaluated.errors.length > 0 && (
                  <Text style={{ color: c.muted }}>
                    Your program has an error. Open Schedule → Program tools to correct it.
                  </Text>
                )}
              </DevFitSurface>
            )}
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
            {!props.progress && plan.missed.length > 0 && (
              <DevFitSurface testID="devfit-missed-sessions">
                <Text className="text-lg font-semibold" style={{ color: c.ink }}>
                  Missed scheduled sessions
                </Text>
                <Text className="text-sm" style={{ color: c.muted }}>
                  Last two rotations · recovery days excluded. Your calendar has stayed in place.
                </Text>
                <DevFitAction
                  label={showMissed ? "Hide missed sessions" : `View missed sessions · ${plan.missed.length}`}
                  testID="devfit-view-missed"
                  secondary
                  onPress={() => setShowMissed(!showMissed)}
                />
                {showMissed &&
                  plan.missed.map((missed) => (
                    <View key={missed.date} style={{ paddingVertical: 10, gap: 8 }}>
                      <Text style={{ color: c.ink }}>
                        {missed.name} · {missed.daysAgo} days ago · {SESSION_LABELS[missed.kind]}
                      </Text>
                      {missed.area !== "cardio" && plan.today?.context === "off" && !plan.recovery && (
                        <DevFitAction
                          label={`Catch up ${missed.name}`}
                          secondary
                          onPress={() => props.onStart(missed.programDay)}
                        />
                      )}
                    </View>
                  ))}
                {plan.canCatchUp && props.onCatchUp && (
                  <>
                    <Text style={{ color: c.ink }}>
                      Upper and lower strength work were missed. An optional compact full-body session fits this off
                      day.
                    </Text>
                    <Text className="text-sm" style={{ color: c.muted }}>
                      About 40–50 minutes. Your normal program and calendar remain available.
                    </Text>
                    <DevFitAction
                      label={includeCardio ? "✓ Include 10 min easy cardio" : "Add optional 10 min easy cardio"}
                      secondary
                      onPress={() => setIncludeCardio(!includeCardio)}
                    />
                    <DevFitAction
                      label="Full-Body Catch-Up"
                      testID="devfit-catchup-start"
                      onPress={() => props.onCatchUp!(includeCardio)}
                    />
                  </>
                )}
              </DevFitSurface>
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
                  {plan.next?.session?.name ?? "Your next rotation"}
                </Text>
                <Text className="text-sm" style={{ color: c.muted }}>
                  {plan.config.cycleDays}-day rotation · training and recovery in one place
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
