import { IHistoryRecord, ISettings, IStats } from "../types";
import { IEvaluatedProgram, Program_getProgramExercise } from "../models/program";
import { History_getPersonalRecords } from "../models/history";
import { Cycle_range, Cycle_records, Cycle_summary } from "./cycle";
import { Schedule_get, Schedule_slots } from "./schedule";
import { ISessionKind, Session_exerciseKind, Session_setDuration } from "./presentation";
import { PlannerProgramExercise_currentEvaluatedSetVariation } from "../pages/planner/models/plannerProgramExercise";

export function Analytics_summary(
  history: IHistoryRecord[],
  settings: ISettings,
  stats: IStats,
  program?: IEvaluatedProgram,
  now: number = Date.now()
): ReturnType<typeof Cycle_summary> & {
  completed: Record<"strength" | "running" | "cardio", number>;
  planned: Record<"strength" | "running" | "cardio", number>;
  cardioSeconds: number;
  plannedCardioSeconds: number;
  calendarCycleDays?: number;
} {
  const cycleDays = settings.devfitCycleDays ?? (program ? Schedule_get(program, settings).cycleDays : 14);
  const cycleSettings = { ...settings, devfitCycleDays: cycleDays };
  const records = Cycle_records(history, Cycle_range(cycleSettings, now));
  const completed = { strength: 0, running: 0, cardio: 0 };
  let cardioSeconds = 0;
  let plannedCardioSeconds = 0;
  const periodRecords = new Set(records);
  const strengthRecords = history.map((record) => {
    const inPeriod = periodRecords.has(record);
    const kinds = new Set<ISessionKind>();
    const entries = record.entries.filter((entry) => {
      const exercise =
        program && record.programId === program.id
          ? Program_getProgramExercise(record.day, program, entry.programExerciseId)
          : undefined;
      const kind = Session_exerciseKind(exercise, entry, settings);
      if (inPeriod && entry.sets.some((s) => s.isCompleted)) {
        kinds.add(kind);
      }
      if (kind === "running" || kind === "cardio") {
        if (inPeriod) {
          cardioSeconds += entry.sets.reduce((n, s) => n + (s.isCompleted ? Session_setDuration(s, true) : 0), 0);
        }
        return false;
      }
      return true;
    });
    for (const kind of kinds) {
      if (kind === "strength" || kind === "running" || kind === "cardio") {
        completed[kind] += 1;
      }
    }
    return { ...record, entries };
  });
  const planned = { strength: 0, running: 0, cardio: 0 };
  if (program) {
    for (const slot of Schedule_slots(program, settings, [], now)) {
      if (!slot.session) {
        continue;
      }
      const kinds = new Set(slot.session.exercises.map((e) => Session_exerciseKind(e)));
      for (const kind of kinds) {
        if (kind === "strength" || kind === "running" || kind === "cardio") {
          planned[kind] += 1;
        }
      }
      plannedCardioSeconds += slot.session.exercises
        .filter((e) => Session_exerciseKind(e) !== "strength")
        .reduce(
          (n, e) =>
            n +
            PlannerProgramExercise_currentEvaluatedSetVariation(e).sets.reduce(
              (sum, s) => sum + Session_setDuration(s),
              0
            ),
          0
        );
    }
  }
  const strength = Cycle_summary(strengthRecords, cycleSettings, stats, History_getPersonalRecords(history), now);
  return {
    ...strength,
    records,
    completed,
    planned,
    cardioSeconds,
    plannedCardioSeconds,
    calendarCycleDays: program ? Schedule_get(program, settings).cycleDays : undefined,
  };
}
