import { IHistoryEntry, ISet, IUnit } from "../types";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import { PlannerProgramExercise_progressionType } from "../pages/planner/models/plannerProgramExercise";
import { Weight_convertTo, Weight_print } from "../models/weight";

function setLabel(set: ISet, completed: boolean, unit: IUnit): string {
  if (set.setTimer != null || set.completedSetTimer != null) {
    const seconds = completed ? set.completedSetTimer : set.setTimer;
    return seconds == null ? "Duration not logged" : `${seconds}s${set.isOverflowSetTimer ? "+" : ""}`;
  }
  const weight = completed ? set.completedWeight : set.weight;
  const weightText = weight
    ? Weight_print(Weight_convertTo(weight, unit))
    : completed
      ? "Weight not logged"
      : "Set weight";
  const reps = completed
    ? set.completedRepsLeft != null
      ? `${set.completedRepsLeft}/${set.completedReps ?? 0}`
      : set.completedReps
    : set.minReps != null && set.minReps !== set.reps
      ? `${set.minReps}–${set.reps}`
      : set.reps;
  return `${weightText} × ${reps ?? "—"}${!completed && set.isAmrap ? "+" : ""}`;
}

export function Progression_sets(entry: IHistoryEntry | undefined, completed: boolean, unit: IUnit): string {
  const sets = (entry?.sets ?? []).filter(
    (set) => !completed || (set.completedReps ?? 0) > 0 || (set.completedSetTimer ?? 0) > 0
  );
  if (sets.length === 0) return completed ? "No previous logged sets" : "No working sets";
  const groups = new Map<string, number>();
  for (const set of sets) {
    const label = setLabel(set, completed, unit);
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  const values = [...groups].map(([label, count]) => `${count > 1 ? `${count} sets · ` : ""}${label}`);
  return values.slice(0, 2).join("\n") + (values.length > 2 ? `\n+ ${values.length - 2} other targets` : "");
}

export function Progression_rule(exercise: IPlannerProgramExercise | undefined): string {
  const progression = exercise && PlannerProgramExercise_progressionType(exercise);
  const generic =
    "Your Liftoscript calculates the next targets when you finish the workout. Open the program to inspect its rule.";
  if (!progression) return "No automatic progression rule is configured for this exercise.";
  if (progression.type === "custom") return generic;
  if (!progression.increase || progression.increase.value <= 0) return generic;
  const increase = Weight_print(progression.increase);
  if (progression.type === "double") {
    if (progression.maxReps <= 0 || progression.minReps <= 0) return generic;
    return `Add ${increase} after every required set reaches ${progression.maxReps} reps and meets its RPE target. Reps return to ${progression.minReps}.`;
  }
  if (progression.type === "sumreps") {
    return `Add ${increase} after at least ${progression.reps} total reps across the working sets.`;
  }
  const remaining = Math.max(1, (progression.successesRequired ?? 1) - (progression.successesCounter ?? 0));
  const success = `Add ${increase} after ${remaining === 1 ? "the next successful session" : `${remaining} more successful sessions`}: complete all prescribed reps and meet the RPE targets.`;
  const deload =
    progression.decrease && progression.decrease.value > 0 && (progression.failuresRequired ?? 0) > 0
      ? ` Deload ${Weight_print(progression.decrease)} after ${progression.failuresRequired} failed session(s).`
      : "";
  return success + deload;
}
