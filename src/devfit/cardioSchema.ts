import * as v from "valibot";
import { Dates_day } from "./dates";

const nonnegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const positive = v.pipe(v.number(), v.finite(), v.minValue(0.001));
export const VCardioSpeed = v.object({ value: nonnegative, unit: v.picklist(["mph", "kmh"]) });
export const VCardioPhaseSettings = v.object({
  speed: v.optional(VCardioSpeed),
  inclinePercent: v.optional(v.pipe(v.number(), v.finite(), v.minValue(-30), v.maxValue(100))),
});
export const VCardioSegment = v.object({
  phase: v.picklist(["walk", "jog", "run", "recovery", "other"]),
  durationSeconds: positive,
  ...VCardioPhaseSettings.entries,
  distanceMeters: v.optional(nonnegative),
  breakBefore: v.optional(v.boolean()),
});
export const VCardioMachineBlock = v.object({
  durationSeconds: positive,
  resistanceLevel: v.optional(v.string()),
  cadenceRpm: v.optional(nonnegative),
  powerWatts: v.optional(nonnegative),
  stepsPerMinute: v.optional(nonnegative),
  strokeRate: v.optional(nonnegative),
  notes: v.optional(v.string()),
});
export const VScheduleCredit = v.object({
  programId: v.string(),
  scheduledDate: v.pipe(
    v.string(),
    v.check((s) => Dates_day(s) != null)
  ),
  rotationDay: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60)),
  programDay: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
export const VCardioActivityBase = v.object({
  schemaVersion: v.literal(1),
  kind: v.picklist(["treadmill", "stair_climber", "stationary_bike", "rowing", "elliptical", "other"]),
  activityName: v.optional(v.string()),
  runPlan: v.optional(v.picklist(["run_a", "run_b"])),
  intention: v.optional(v.picklist(["run_a", "run_b", "incline_walk", "endurance", "recovery", "general"])),
  recordingMode: v.picklist(["live", "manual", "legacy"]),
  performedLocalDate: v.pipe(
    v.string(),
    v.check((s) => Dates_day(s) != null)
  ),
  performedLocalTime: v.optional(v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/))),
  timeZone: v.optional(v.string()),
  datePrecision: v.picklist(["date", "minute"]),
  actualDurationSeconds: nonnegative,
  durationCoverage: v.optional(v.picklist(["active_work", "whole_activity"])),
  segments: v.optional(v.array(VCardioSegment)),
  walkSeconds: v.optional(nonnegative),
  jogSeconds: v.optional(nonnegative),
  longestJogSeconds: v.optional(nonnegative),
  walk: v.optional(VCardioPhaseSettings),
  jog: v.optional(VCardioPhaseSettings),
  machineDistance: v.optional(v.object({ value: nonnegative, unit: v.picklist(["km", "mi"]) })),
  machineProfile: v.optional(v.string()),
  machineBlocks: v.optional(v.array(VCardioMachineBlock)),
  machinePace: v.optional(v.object({ seconds: positive, unit: v.picklist(["mi", "km"]) })),
  averageHeartRateBpm: v.optional(positive),
  machineCaloriesKcal: v.optional(nonnegative),
  stairSteps: v.optional(v.pipe(nonnegative, v.integer())),
  stairsLevel: v.optional(v.string()),
  stepsPerMinute: v.optional(nonnegative),
  reportedFloors: v.optional(nonnegative),
  bikeResistanceLevel: v.optional(v.string()),
  cadenceRpm: v.optional(nonnegative),
  powerWatts: v.optional(nonnegative),
  rowingSplitSecondsPer500m: v.optional(positive),
  strokeRate: v.optional(nonnegative),
  rowingDamper: v.optional(v.string()),
  effortRpe1to10: v.optional(v.pipe(v.number(), v.finite(), v.minValue(1), v.maxValue(10))),
  controlledEffort: v.optional(v.boolean()),
  shinDiscomfort0to10: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(10))),
  notes: v.optional(v.string()),
});
export const VCardioEntryDetails = v.omit(VCardioActivityBase, [
  "schemaVersion",
  "kind",
  "runPlan",
  "intention",
  "recordingMode",
  "performedLocalDate",
  "performedLocalTime",
  "timeZone",
  "datePrecision",
  "actualDurationSeconds",
  "durationCoverage",
]);
export type ICardioEntryDetails = v.InferOutput<typeof VCardioEntryDetails>;
export const VCardioActivity = v.pipe(
  VCardioActivityBase,
  v.check((a) => {
    const total = a.actualDurationSeconds;
    if ((a.walkSeconds ?? 0) + (a.jogSeconds ?? 0) > total + 1) {
      return false;
    }
    if (a.longestJogSeconds != null && a.longestJogSeconds > (a.jogSeconds ?? total) + 1) {
      return false;
    }
    if (a.segments?.length && Math.abs(a.segments.reduce((n, s) => n + s.durationSeconds, 0) - total) > 1) {
      return false;
    }
    if (a.machineBlocks && a.machineBlocks.reduce((n, b) => n + b.durationSeconds, 0) > total + 1) {
      return false;
    }
    return true;
  }, "Phase times must fit the actual duration.")
);
export type ICardioActivity = v.InferOutput<typeof VCardioActivity>;
export type ICardioSegment = v.InferOutput<typeof VCardioSegment>;
export type ICardioPhaseSettings = v.InferOutput<typeof VCardioPhaseSettings>;
export type IScheduleCredit = v.InferOutput<typeof VScheduleCredit>;
export const VCardioLap = v.object({
  phase: v.picklist(["walk", "jog"]),
  elapsedSeconds: nonnegative,
  breakBefore: v.optional(v.boolean()),
  ...VCardioPhaseSettings.entries,
});
