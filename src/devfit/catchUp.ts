import { IHistoryEntry, IHistoryRecord, ISettings, IStats, IExerciseType } from "../types";
import {
  IEvaluatedProgram,
  Program_createEmptyProgram,
  Program_getListOfDays,
  Program_nextHistoryRecord,
  Program_nextHistoryRecordFromEvaluated,
} from "../models/program";
import { History_createCustomEntry } from "../models/history";
import { Exercise_get } from "../models/exercise";

export function CatchUp_build(
  program: IEvaluatedProgram,
  settings: ISettings,
  stats: IStats,
  includeCardio = false
): IHistoryRecord {
  const entries = Program_getListOfDays(program).flatMap(
    ([day]) => Program_nextHistoryRecordFromEvaluated(program, settings, stats, Number(day)).entries
  );
  const template: { match: RegExp; id: IExerciseType["id"]; count: number; min: number; max: number }[] = [
    { match: /leg press|squat/i, id: "legPress", count: 3, min: 8, max: 12 },
    { match: /chest press|bench press/i, id: "chestPress", count: 3, min: 8, max: 12 },
    { match: /lat pulldown|seated row|pull.?up/i, id: "latPulldown", count: 3, min: 8, max: 12 },
    { match: /leg curl/i, id: "seatedLegCurl", count: 2, min: 10, max: 15 },
    { match: /shoulder press|overhead press/i, id: "shoulderPress", count: 2, min: 10, max: 12 },
    { match: /calf/i, id: "standingCalfRaise", count: 2, min: 12, max: 20 },
  ];
  const result: IHistoryEntry[] = template.map((item, index) => {
    const source = entries.find((e) => item.match.test(Exercise_get(e.exercise, settings.exercises).name));
    const entry = History_createCustomEntry(source?.exercise ?? { id: item.id }, index);
    const weight = source?.sets[0]?.weight;
    return {
      ...entry,
      descriptionSnapshot: "Compact catch-up. Use your usual warm-up before these working sets.",
      sets: Array.from({ length: item.count }, (_, setIndex) => ({
        vtype: "set" as const,
        id: `catchup-${index}-${setIndex}`,
        index: setIndex,
        minReps: item.min,
        reps: item.max,
        weight,
        askWeight: weight == null,
        timer: 75,
        isUnilateral: source?.sets[0]?.isUnilateral,
      })),
    };
  });
  if (includeCardio) {
    const source = entries.find((e) =>
      /incline.*walk|stationary bike|cycling|rowing machine/i.test(Exercise_get(e.exercise, settings.exercises).name)
    );
    result.push({
      ...History_createCustomEntry(source?.exercise ?? { id: "inclineTreadmillWalk" }, result.length),
      descriptionSnapshot: "Optional 10-minute easy finish. Choose a comfortable pace; no speed is prescribed.",
      sets: [{ vtype: "set", id: "catchup-cardio", index: 0, setTimer: 600, timer: 0, label: "Optional easy cardio" }],
    });
  }
  return {
    ...Program_nextHistoryRecord(Program_createEmptyProgram(), settings, stats),
    programName: "DevFit catch-up",
    dayName: "Full-Body Catch-Up",
    catchUpFor: program.id,
    entries: result,
  };
}
