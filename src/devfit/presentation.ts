import { IHistoryEntry, IHistoryRecord, ISettings, ISet } from "../types";
import { Exercise_get } from "../models/exercise";
import { Weight_build } from "../models/weight";
import { Cardio_duration } from "./cardio";
import { IEvaluatedProgramDay, Program_getProgramDayUsedExercises, Program_dayApproxTimeMs } from "../models/program";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import {
  PlannerProgramExercise_currentEvaluatedSetVariation,
  PlannerProgramExercise_currentDescription,
  PlannerProgramExercise_getState,
} from "../pages/planner/models/plannerProgramExercise";

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
  if (/\b(run(?:ning)?(?:[ _-]*[ab])?\d*|jog(?:ging)?)\b/i.test(text)) {
    return "running";
  }
  if (
    /\b(incline\s+treadmill\s+walk|treadmill\s+walk|incline\s+walk|stationary\s+bike)\b/i.test(text) &&
    !/\b(run(?:ning)?[ _-]?[ab]?|jog(?:ging)?)\b/i.test(text)
  ) {
    return "cardio";
  }
  if (/\b(run(?:ning)?[ _-]?[ab]?|jog(?:ging)?|treadmill)\b/i.test(text)) {
    return "running";
  }
  if (
    /\b(cardio|elliptical|bike(?:stairs)?|stationary\s+bike|incline.*walk|cycling|cycle ride|stair(?:s|master)?|endurance|rowing machine|swim(?:ming)?)\b/i.test(
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
  const cardio = entry?.sets.find((s) => s.devfitCardio)?.devfitCardio;
  const name = exercise?.name ?? (entry && settings ? Exercise_get(entry.exercise, settings.exercises).name : "");
  const classified = Session_kind(name, [exercise?.label ?? "", ...(entry?.sets.map((s) => s.label ?? "") ?? [])]);
  if (cardio) {
    return cardio.runPlan || (cardio.kind === "treadmill" && classified === "running") ? "running" : "cardio";
  }
  return classified;
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

function resolveExerciseDescription(
  exercise: IPlannerProgramExercise | undefined,
  entry?: IHistoryEntry
): string | undefined {
  let current: IPlannerProgramExercise | undefined = exercise;
  const visited = new Set<IPlannerProgramExercise>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const active = PlannerProgramExercise_currentDescription(current);
    if (active) {
      return active;
    }
    current = current.descriptions.reuse?.exercise ?? current.reuse?.exercise;
  }
  return entry?.descriptionSnapshot;
}

export function Session_cardioIntent(
  exercise: IPlannerProgramExercise | undefined,
  entry: IHistoryEntry | undefined,
  settings: ISettings
): string {
  return resolveExerciseDescription(exercise, entry) ?? Session_cardioCoaching(exercise, entry, settings).mainTarget;
}

export interface ICardioCoachingSummary {
  instructions?: string;
  warmup: string;
  mainTarget: string;
  recovery?: string;
  then?: string;
  progressionRule: string;
}

export function Session_cardioCoaching(
  exercise: IPlannerProgramExercise | undefined,
  entry: IHistoryEntry | undefined,
  settings: ISettings
): ICardioCoachingSummary {
  const description = resolveExerciseDescription(exercise, entry);
  const warmup = description?.match(/Warm-?up:\s*([\s\S]+?)(?=\s*Main(?:\s+Incline\/Jog)?\s+Target:|$)/i)?.[1]?.trim();
  const main = description
    ?.match(/Main(?:\s+Incline\/Jog)?\s+Target:\s*([\s\S]+?)(?=\s*Progression(?:\s+Rule)?:|$)/i)?.[1]
    ?.trim();
  const progression = description?.match(/Progression(?:\s+Rule)?:\s*([\s\S]+)$/i)?.[1]?.trim();
  const kind = Session_exerciseKind(exercise, entry, settings);
  const label = exercise?.label ?? "";
  const name = exercise?.name ?? (entry ? Exercise_get(entry.exercise, settings.exercises).name : "");
  const sets = entry?.sets ?? (exercise ? PlannerProgramExercise_currentEvaluatedSetVariation(exercise).sets : []);
  const total = sets.reduce((n, s, i) => n + Session_setDuration(s) + (i < sets.length - 1 ? (s.timer ?? 0) : 0), 0);
  const duration = total > 0 ? `${Session_minutes(total)} total planned` : "your programmed duration";
  const isB = /\brun[ _-]*b\d*\b/i.test(`${label} ${name}`);
  const intervals = isB || sets.length > 1;
  const state = exercise ? PlannerProgramExercise_getState(exercise) : (entry?.state ?? {});
  const continuous = Object.entries(state).find(
    ([key, value]) =>
      /(?:continuous|run|jog)(?:target)?(?:minutes|mins|seconds|secs)$/i.test(key.replace(/[_ -]/g, "")) &&
      typeof value === "number" &&
      value > 0
  );
  const continuousSeconds =
    continuous && typeof continuous[1] === "number" ? continuous[1] * (/min/i.test(continuous[0]) ? 60 : 1) : undefined;
  if (kind === "running") {
    const target = continuousSeconds != null ? `Continuous jog target: ${Session_minutes(continuousSeconds)}. ` : "";
    return {
      instructions: description && !(warmup && main && progression) ? description : undefined,
      warmup: warmup ?? "Start with 5 min of easy walking within your session.",
      mainTarget: `${target}${main ?? (intervals ? `Run/walk endurance intervals · ${duration}. Follow the work segments below; walk during the planned recovery timer.` : `Easy jog / walk · ${duration}. Follow your program's continuous jog target at a comfortable pace.`)}`,
      recovery:
        "Walk for 2–3 min as needed between continuous jog efforts, unless your plan gives a different recovery.",
      then: intervals
        ? "Continue the programmed intervals. Work and recovery clocks advance through the actual plan."
        : "Jog again, then walk easily to finish the planned session. Switch phase to track walk and jog time.",
      progressionRule:
        progression ??
        (intervals
          ? "Follow your program's interval progression. Keep recovery comfortable."
          : "Complete the current continuous target twice comfortably before increasing it in your program."),
    };
  }
  const walk = /incline|walk/i.test(`${label} ${name}`);
  return {
    instructions: description && !(warmup && main && progression) ? description : undefined,
    warmup: warmup ?? "Begin with 2–3 min at an easy pace.",
    mainTarget:
      main ??
      (walk
        ? `Incline treadmill walk · ${duration}. Around 5% incline if comfortable; choose your own speed.`
        : `Steady cardio · ${duration}. Use the programmed equipment and a comfortable pace.`),
    progressionRule:
      progression ?? "Follow your program's duration or resistance targets. Change speed only when you choose.",
  };
}

export function Session_phase(set: ISet, elapsedSeconds: number): { phase: "walk" | "jog"; seconds: number } {
  const last = set.cardioLaps?.[set.cardioLaps.length - 1];
  return { phase: last?.phase ?? "walk", seconds: Math.max(0, elapsedSeconds - (last?.elapsedSeconds ?? 0)) };
}

export function Session_switchPhase(set: ISet, elapsedSeconds: number): ISet {
  const current = Session_phase(set, elapsedSeconds);
  const last = set.cardioLaps?.[set.cardioLaps.length - 1];
  return {
    ...set,
    cardioLaps: [
      ...(set.cardioLaps ?? []),
      {
        ...set.cardioLaps
          ?.slice()
          .reverse()
          .find((l) => l.phase === (current.phase === "walk" ? "jog" : "walk")),
        phase: current.phase === "walk" ? "jog" : "walk",
        elapsedSeconds: Math.max(last?.elapsedSeconds ?? 0, Math.floor(elapsedSeconds), 0),
      },
    ],
  };
}

export function Session_setDuration(
  set: Pick<ISet, "setTimer" | "isUnilateral" | "completedSetTimer" | "completedSetTimerLeft" | "devfitCardio">,
  completed = false
): number {
  return completed ? Cardio_duration(set) : (set.setTimer ?? 0) * (set.isUnilateral ? 2 : 1);
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
