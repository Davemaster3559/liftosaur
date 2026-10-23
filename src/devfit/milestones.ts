import type { IExerciseType, IHistoryEntry, IHistoryRecord, ISettings, IWeight } from "../types";
import type { IMilestoneSnapshot, IMilestoneTarget } from "./planSchema";
import { LiftingUnits_convert, LiftingUnits_print, LiftingUnits_same } from "./liftingUnits";
import { Equipment_getEquipmentDataForExerciseType } from "../models/equipment";
import { Weight_calculatePlates, Weight_step } from "../models/weight";

const stages = [8, 10, 12, 15] as const;
export function Milestones_stage(reps: number): 8 | 10 | 12 | 15 {
  return stages.find((n) => n >= reps) ?? 15;
}

export function Milestones_availableLoad(
  target: IMilestoneTarget,
  exercise: IExerciseType,
  settings: ISettings
): IWeight | undefined {
  if (!target.step) {
    return undefined;
  }
  const equipment = Equipment_getEquipmentDataForExerciseType(settings, exercise);
  const desired = {
    value: target.weight.value + LiftingUnits_convert(target.step, target.weight.unit).value,
    unit: target.weight.unit,
  };
  if (equipment?.isFixed) {
    return (
      equipment.fixed
        .filter((w) => LiftingUnits_convert(w, "kg").value >= LiftingUnits_convert(desired, "kg").value - 0.00001)
        .sort((a, b) => LiftingUnits_convert(a, "kg").value - LiftingUnits_convert(b, "kg").value)[0] ?? target.weight
    );
  }
  if (equipment) {
    const attainable = Weight_calculatePlates(desired, settings, desired.unit, exercise).totalWeight;
    if (LiftingUnits_same(attainable, desired)) {
      return desired;
    }
    const above = Weight_step(desired, 1, settings, exercise);
    return LiftingUnits_convert(above, "kg").value >= LiftingUnits_convert(desired, "kg").value - 0.00001
      ? above
      : target.weight;
  }
  return desired;
}

export function Milestones_isAvailable(weight: IWeight, exercise: IExerciseType, settings: ISettings): boolean {
  const equipment = Equipment_getEquipmentDataForExerciseType(settings, exercise);
  return (
    !equipment ||
    (equipment.isFixed
      ? equipment.fixed.some((w) => LiftingUnits_same(w, weight))
      : LiftingUnits_same(weight, Weight_calculatePlates(weight, settings, weight.unit, exercise).totalWeight))
  );
}

export function Milestones_adjustLoad(
  weight: IWeight,
  direction: -1 | 1,
  step: IWeight,
  exercise: IExerciseType,
  settings: ISettings
): IWeight {
  if (direction === 1) {
    return Milestones_availableLoad({ weight, step, reps: 8, calibrated: true }, exercise, settings) ?? weight;
  }
  const desired = { ...weight, value: Math.max(0, weight.value - LiftingUnits_convert(step, weight.unit).value) };
  const equipment = Equipment_getEquipmentDataForExerciseType(settings, exercise);
  if (equipment?.isFixed) {
    return (
      equipment.fixed
        .filter((w) => LiftingUnits_convert(w, "kg").value <= LiftingUnits_convert(desired, "kg").value + 0.00001)
        .sort((a, b) => LiftingUnits_convert(b, "kg").value - LiftingUnits_convert(a, "kg").value)[0] ?? weight
    );
  }
  if (equipment) {
    return Weight_calculatePlates(desired, settings, desired.unit, exercise).totalWeight;
  }
  return desired;
}

export function Milestones_snapshot(
  entry: IHistoryEntry,
  key: string,
  target: IMilestoneTarget,
  optionalIds: string[] = []
): IMilestoneSnapshot {
  return {
    key,
    target: { ...target, weight: { ...target.weight }, step: target.step && { ...target.step } },
    required: entry.sets
      .filter((s) => !optionalIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        weight: { ...(s.weight ?? target.weight) },
        reps: target.reps,
        rpe: s.rpe,
        unilateral: !!s.isUnilateral,
      })),
  };
}

export interface IMilestoneResult {
  target: IMilestoneTarget;
  earned: boolean;
  reason: string;
}
export function Milestones_evaluate(
  entry: IHistoryEntry | undefined,
  target: IMilestoneTarget,
  workoutToken: string,
  nextLoad?: IWeight
): IMilestoneResult {
  const hold = (reason: string): IMilestoneResult => ({ target, earned: false, reason });
  const snapshot = entry?.devfitMilestone;
  if (!entry || !snapshot?.required.length || entry.isSuppressed) {
    return hold("Required working sets are missing.");
  }
  if (target.lastWorkout === workoutToken) {
    return hold("This workout has already been counted.");
  }
  if (target.keep) {
    return hold("Keep this target is enabled.");
  }
  if (!target.calibrated) {
    return hold("Confirm the baseline load for this equipment first.");
  }
  if (snapshot.target.reps !== target.reps || !LiftingUnits_same(snapshot.target.weight, target.weight)) {
    return hold("The target changed after this workout started.");
  }
  for (const required of snapshot.required) {
    const set = entry.sets.find((s) => s.id === required.id);
    if (
      !set?.isCompleted ||
      !LiftingUnits_same(required.weight, target.weight) ||
      !LiftingUnits_same(set.completedWeight, target.weight)
    ) {
      return hold("Complete every original working set at the target load.");
    }
    if (
      (set.completedReps ?? -1) < required.reps ||
      (required.unilateral && (set.completedRepsLeft ?? -1) < required.reps)
    ) {
      return hold("Every required set and side must reach the target reps.");
    }
    if (required.rpe != null && (set.completedRpe == null || set.completedRpe > required.rpe)) {
      return hold("Record effort at or below the prescribed RPE on every required set.");
    }
  }
  const stage = stages.indexOf(target.reps);
  if (stage < stages.length - 1) {
    return {
      target: { ...target, reps: stages[stage + 1], lastWorkout: workoutToken },
      earned: true,
      reason: `All required sets earned ${stages[stage + 1]} reps at the same load.`,
    };
  }
  if (!target.step) {
    return hold("Choose the available load increment for this exercise.");
  }
  const expected = LiftingUnits_convert(target.step, target.weight.unit).value;
  const available = nextLoad ?? { value: target.weight.value + expected, unit: target.weight.unit };
  const jump = LiftingUnits_convert(available, target.weight.unit).value - target.weight.value;
  if (jump <= 0.00001) {
    return hold("Equipment maximum reached. Keep the load or choose another progression.");
  }
  if (jump > expected * 1.25 + 0.00001) {
    return hold("The next available load is larger than your configured increment. Review it first.");
  }
  return {
    target: { ...target, weight: available, reps: 8, lastWorkout: workoutToken },
    earned: true,
    reason: `All required sets earned ${LiftingUnits_print(available)}. Start at 8 reps.`,
  };
}

export function Milestones_workoutComplete(record: IHistoryRecord): boolean {
  const required = record.devfitRequiredEntries;
  return (
    !!required?.length &&
    required.every((id) => {
      const entry = record.entries.find((e) => e.id === id);
      return (
        !!entry &&
        !entry.isSuppressed &&
        (entry.devfitMilestone
          ? entry.devfitMilestone.required.every((r) => entry.sets.some((s) => s.id === r.id && s.isCompleted))
          : (entry.devfitCardioRequiredSetIds ?? entry.sets.map((s) => s.id)).length > 0 &&
            (entry.devfitCardioRequiredSetIds ?? entry.sets.map((s) => s.id)).every((setId) =>
              entry.sets.some((s) => s.id === setId && s.isCompleted)
            ))
      );
    })
  );
}

export function Milestones_decision(
  record: IHistoryRecord,
  entry: IHistoryEntry,
  target: IMilestoneTarget,
  settings: ISettings
): IMilestoneResult {
  return Milestones_workoutComplete(record)
    ? Milestones_evaluate(
        entry,
        target,
        `${record.programId}:${record.startTime}`,
        Milestones_availableLoad(target, entry.exercise, settings)
      )
    : {
        target,
        earned: false,
        reason: "Workout incomplete. The original required exercises and working sets must be completed; target held.",
      };
}

export function Milestones_why(entry: IHistoryEntry, target?: IMilestoneTarget): string {
  const current = target ?? entry.devfitMilestone?.target;
  return current
    ? `Target: ${entry.devfitMilestone?.required.length ?? entry.sets.length} working sets × ${current.reps} at ${LiftingUnits_print(current.weight)}. Earn 8 → 10 → 12 → 15 reps by completing every original working set at this load, including both sides and any prescribed RPE. Then increase by your equipment increment and return to 8. Incomplete workouts hold the target. ${current.calibrated ? "" : "Baseline confirmation is still needed."}`
    : "The program's existing progression rule controls this exercise. Finishing the workout applies that rule.";
}
