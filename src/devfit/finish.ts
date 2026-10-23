import { IHistoryEntry, IHistoryRecord, IProgram, ISettings, IStats } from "../types";
import {
  IEvaluatedProgram,
  Program_evaluate,
  Program_getProgramDay,
  Program_getProgramExercise,
  Program_nextHistoryRecord,
} from "../models/program";
import { Exercise_toKey } from "../models/exercise";
import { Progression_sets } from "./progression";
import { Session_exerciseKind, Session_setDuration } from "./presentation";

export function Finish_activity(
  record: IHistoryRecord,
  settings: ISettings,
  program?: IEvaluatedProgram
): {
  strength: IHistoryRecord;
  cardioSeconds: number;
  cardioSegments: number;
  hasStrength: boolean;
} {
  let cardioSeconds = 0;
  let cardioSegments = 0;
  const entries = record.entries.filter((entry) => {
    const exercise = program && Program_getProgramExercise(record.day, program, entry.programExerciseId);
    if (Session_exerciseKind(exercise, entry, settings) === "strength") {
      return true;
    }
    for (const set of entry.sets) {
      if (set.isCompleted) {
        cardioSegments += 1;
        cardioSeconds += Session_setDuration(set, true);
      }
    }
    return false;
  });
  return { strength: { ...record, entries }, cardioSeconds, cardioSegments, hasStrength: entries.length > 0 };
}

// The stored program has already been updated by FinishProgramDayAction. These are actual
// evaluated targets for the next occurrence of this day, not a projection of an unfinished set.
export function Finish_nextTargets(
  record: IHistoryRecord,
  program: IProgram | undefined,
  settings: ISettings,
  stats: IStats
): { entry: IHistoryEntry; before: string; after: string }[] {
  if (!program) {
    return [];
  }
  const evaluated = Program_evaluate(program, settings);
  if (evaluated.errors.length || !Program_getProgramDay(evaluated, record.day)) {
    return [];
  }
  const next = Program_nextHistoryRecord({ ...program, nextDay: record.day }, settings, stats);
  return record.entries.flatMap((entry) => {
    const after = next.entries.find((e) =>
      entry.programExerciseId
        ? e.programExerciseId === entry.programExerciseId
        : Exercise_toKey(e.exercise) === Exercise_toKey(entry.exercise)
    );
    if (!after) {
      return [];
    }
    const beforeText = Progression_sets(entry, false, settings.units);
    const afterText = Progression_sets(after, false, settings.units);
    return beforeText === afterText ? [] : [{ entry, before: beforeText, after: afterText }];
  });
}
