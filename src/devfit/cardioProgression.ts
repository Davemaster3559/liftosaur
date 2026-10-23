import type { IHistoryEntry, IHistoryRecord, ISettings } from "../types";
import type { IPlannerProgramExercise } from "../pages/planner/models/types";
import { PlannerProgramExercise_getState } from "../pages/planner/models/plannerProgramExercise";
import { Cardio_breakdown, Cardio_entryActivity } from "./cardio";

export function CardioProgression_holdReason(
  record: IHistoryRecord,
  entry: IHistoryEntry,
  exercise: IPlannerProgramExercise,
  settings: ISettings
): string | undefined {
  const intention = entry.devfitCardioPrescription?.intention;
  if (intention !== "run_a" && intention !== "run_b") {
    return undefined;
  }
  const required = entry.devfitCardioRequiredSetIds;
  if (
    !required?.length ||
    !required.every((id) => {
      const set = entry.sets.find((s) => s.id === id);
      return (
        set?.isCompleted &&
        set.devfitCardio &&
        set.devfitCardio.actualDurationSeconds >= (set.setTimer ?? 0) &&
        set.devfitCardio.segments?.some((p) => p.phase === "jog" || p.phase === "run") &&
        (set.rpe == null || (set.completedRpe != null && set.completedRpe <= set.rpe))
      );
    })
  ) {
    return "Running target held: complete the original work segments with actual jog phases and any prescribed effort.";
  }
  if (intention === "run_a") {
    const target = Object.entries(PlannerProgramExercise_getState(exercise)).find(
      ([key, value]) =>
        /(?:continuous|run|jog)(?:target)?(?:minutes|mins|seconds|secs)$/i.test(key.replace(/[_ -]/g, "")) &&
        typeof value === "number" &&
        value > 0
    );
    const activity = Cardio_entryActivity(record, entry, exercise.label ?? exercise.name);
    const seconds = target ? Number(target[1]) * (/minutes|mins/i.test(target[0]) ? 60 : 1) : undefined;
    if (
      seconds == null ||
      !activity ||
      (Cardio_breakdown(activity).longestJogSeconds ?? 0) < seconds ||
      activity.controlledEffort !== true
    ) {
      return "Run A target held: the saved continuous-jog target, measured uninterrupted jog and explicit comfortable effort are required. Total time alone does not advance it.";
    }
  } else if (
    !required.every((id) => {
      const set = entry.sets.find((s) => s.id === id)!;
      return (
        !set.isOverflowSetTimer &&
        (set.setTimer ?? 0) > 0 &&
        (Cardio_breakdown(set.devfitCardio!).longestJogSeconds ?? 0) >= set.setTimer!
      );
    })
  ) {
    return "Run B target held: each original jog interval needs its full measured uninterrupted jog. A whole-session duration does not establish an interval target.";
  }
  return undefined;
}
