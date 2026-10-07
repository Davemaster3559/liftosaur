import { IHistoryEntry, IHistoryRecord, ISettings, ISet } from "../types";
import { Exercise_get } from "../models/exercise";
import { Weight_build } from "../models/weight";
import { IEvaluatedProgramDay, Program_getProgramDayUsedExercises, Program_dayApproxTimeMs } from "../models/program";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import { PlannerProgramExercise_currentEvaluatedSetVariation } from "../pages/planner/models/plannerProgramExercise";

export type ISessionKind = "strength" | "running" | "cardio" | "mixed" | "recovery";
export const SESSION_LABELS: Record<ISessionKind, string> = {
  strength: "Strength",
  running: "Running",
  cardio: "Cardio",
  mixed: "Strength + cardio",
  recovery: "Recovery",
};

export function Session_displayName(label: string): string {
  const text = label.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function Session_timing(entry: IHistoryEntry): { work: number; rest: number; total: number } {
  const work = entry.sets.reduce((n, set) => n + Session_setDuration(set), 0);
  const rest = entry.sets.reduce((n, set, i) => n + (i < entry.sets.length - 1 ? (set.timer ?? 0) : 0), 0);
  return { work, rest, total: work + rest };
}

export function Session_kind(name: string, labels: string[] = []): ISessionKind {
  const text = [name, ...labels].join(" ");
  if (/\b(run(?:ning)?[ _-]?[ab]?|jog(?:ging)?|treadmill)\b/i.test(text)) {
    return "running";
  }
  if (
    /\b(cardio|elliptical|bike(?:stairs)?|cycling|cycle ride|stair(?:s|master)?|endurance|rowing machine|swim(?:ming)?)\b/i.test(
      text
    )
  ) {
    return "cardio";
  }
  return "strength";
}

export function Session_exerciseKind(
  exercise: IPlannerProgramExercise | undefined,
  entry?: IHistoryEntry,
  settings?: ISettings
): ISessionKind {
  const name = exercise?.name ?? (entry && settings ? Exercise_get(entry.exercise, settings.exercises).name : "");
  return Session_kind(name, [exercise?.label ?? "", ...(entry?.sets.map((s) => s.label ?? "") ?? [])]);
}

export function Session_day(
  day: IEvaluatedProgramDay,
  settings: ISettings
): {
  name: string;
  kind: ISessionKind;
  exercises: ReturnType<typeof Program_getProgramDayUsedExercises>;
  count: number;
  minutes: number;
  timedSeconds: number;
  duration: string;
} {
  const exercises = Program_getProgramDayUsedExercises(day);
  const kinds = exercises.map((e) => Session_exerciseKind(e));
  const hasStrength = kinds.includes("strength");
  const cardio = kinds.filter((k) => k !== "strength");
  const kind: ISessionKind =
    hasStrength && cardio.length > 0
      ? "mixed"
      : cardio.includes("running")
        ? "running"
        : cardio.length > 0
          ? "cardio"
          : exercises.length === 0
            ? "recovery"
            : "strength";
  const timedSeconds = exercises.reduce(
    (n, e) =>
      n + PlannerProgramExercise_currentEvaluatedSetVariation(e).sets.reduce((sum, s) => sum + (s.setTimer ?? 0), 0),
    0
  );
  const plannedSeconds = exercises.reduce((total, e) => {
    const sets = PlannerProgramExercise_currentEvaluatedSetVariation(e).sets;
    return total + sets.reduce((n, s, i) => n + Session_setDuration(s) + (i < sets.length - 1 ? (s.timer ?? 0) : 0), 0);
  }, 0);
  const minutes = Math.max(
    1,
    Math.round(hasStrength ? Program_dayApproxTimeMs(day, settings) / 60000 : plannedSeconds / 60)
  );
  return {
    name: day.name,
    kind,
    exercises,
    count: exercises.length,
    minutes,
    timedSeconds,
    duration: `${minutes} min${hasStrength ? " est." : " planned"}`,
  };
}

export function Session_cardioIntent(
  exercise: IPlannerProgramExercise | undefined,
  entry: IHistoryEntry,
  settings: ISettings
): string {
  const description =
    exercise?.descriptions.values
      .filter((d) => d.isCurrent)
      .map((d) => d.value)
      .join(" ") || entry.descriptionSnapshot;
  if (description) {
    return description;
  }
  const label = exercise?.label ?? "";
  if (/^run[ _-]?a$/i.test(label)) {
    return "Continuous jog · keep an easy, conversational effort.";
  }
  if (/^run[ _-]?b$/i.test(label)) {
    return "Run / walk intervals · follow your planned work and recovery segments.";
  }
  return Session_exerciseKind(exercise, entry, settings) === "running"
    ? "Easy, controlled effort. Follow the duration and instructions in your plan."
    : "Follow your planned duration and effort. Time is your primary target.";
}

export function Session_setDuration(
  set: Pick<ISet, "setTimer" | "isUnilateral" | "completedSetTimer" | "completedSetTimerLeft">,
  completed = false
): number {
  return completed
    ? (set.completedSetTimer ?? 0) + (set.completedSetTimerLeft ?? 0)
    : (set.setTimer ?? 0) * (set.isUnilateral ? 2 : 1);
}

export function Session_recordedSeconds(entries: IHistoryEntry[]): number {
  return entries.reduce(
    (total, entry) =>
      total + entry.sets.reduce((n, set) => n + (set.isCompleted ? Session_setDuration(set, true) : 0), 0),
    0
  );
}

// Time-only cardio has no load or rep target. Supply the engine's neutral values
// at recording time, while retaining explicit AMRAP, RPE and weight prompts.
export function Session_timedRecordingSet(set: ISet, kind: ISessionKind, settings: ISettings): ISet {
  if (set.setTimer == null || (kind !== "running" && kind !== "cardio")) {
    return set;
  }
  return {
    ...set,
    completedWeight:
      set.completedWeight ?? (set.weight == null && !set.askWeight ? Weight_build(0, settings.units) : undefined),
    completedReps: set.completedReps ?? (set.reps == null && !set.isAmrap ? 1 : undefined),
    completedRepsLeft: set.completedRepsLeft ?? (set.isUnilateral && set.reps == null && !set.isAmrap ? 1 : undefined),
  };
}

export function Session_recordKind(record: IHistoryRecord, settings: ISettings): ISessionKind {
  const kinds = record.entries.map((e) => Session_exerciseKind(undefined, e, settings));
  if (kinds.some((k) => k !== "strength") && kinds.includes("strength")) {
    return "mixed";
  }
  return kinds.includes("running") ? "running" : kinds.includes("cardio") ? "cardio" : "strength";
}

export function Session_minutes(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function Session_completion(entries: IHistoryEntry[]): { completed: number; total: number } {
  const sets = entries.flatMap((e) => [...e.warmupSets, ...e.sets]);
  return { completed: sets.filter((s) => s.isCompleted).length, total: sets.length };
}
