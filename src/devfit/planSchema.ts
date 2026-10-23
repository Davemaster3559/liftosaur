import * as v from "valibot";

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0.000001));
const weight = v.object({ value: finite, unit: v.picklist(["lb", "kg"]) });
export const VMilestoneTarget = v.object({
  weight,
  reps: v.picklist([8, 10, 12, 15]),
  step: v.optional(v.object({ value: positive, unit: v.picklist(["lb", "kg"]) })),
  calibrated: v.boolean(),
  keep: v.optional(v.boolean()),
  lastWorkout: v.optional(v.string()),
});
export type IMilestoneTarget = v.InferOutput<typeof VMilestoneTarget>;
export const VMilestoneSnapshot = v.object({
  key: v.string(),
  target: VMilestoneTarget,
  required: v.array(
    v.object({ id: v.string(), weight, reps: finite, rpe: v.optional(finite), unilateral: v.boolean() })
  ),
});
export type IMilestoneSnapshot = v.InferOutput<typeof VMilestoneSnapshot>;
export const VCardioPrescription = v.object({
  machine: v.picklist(["treadmill", "stationary_bike", "stair_climber", "rowing", "elliptical", "other"]),
  intention: v.picklist(["run_a", "run_b", "incline_walk", "endurance", "recovery", "general"]),
  durationSeconds: positive,
});
export type ICardioPrescription = v.InferOutput<typeof VCardioPrescription>;
export const VDevFitPlan = v.object({
  version: v.literal(5),
  appliedAt: finite,
  sourceFingerprint: v.string(),
  beforeProgramJson: v.string(),
  targets: v.record(v.string(), VMilestoneTarget),
  cardio: v.record(v.string(), VCardioPrescription),
  abdominal: v.picklist(["unknown", "sit_up", "back_extension"]),
  replacements: v.optional(v.array(v.object({ from: v.string(), to: v.string(), reason: v.string() }))),
});
export type IDevFitPlan = v.InferOutput<typeof VDevFitPlan>;
