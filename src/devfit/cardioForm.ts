import * as v from "valibot";
import { ICardioActivity, ICardioSegment, VCardioActivity } from "./cardioSchema";
import { Dates_day, Dates_key, Dates_zone, Dates_validTime, Dates_timestamp } from "./dates";
import { Cardio_nearDuplicates } from "./cardio";
import { IHistoryRecord } from "../types";
import { CardioTime_format, CardioTime_parse } from "./cardioTime";
import { ITrainingDate, TrainingDate_key, TrainingDate_start, VTrainingDate } from "./trainingDates";

export const CARDIO_PRESETS = [
  "Run A",
  "Run B",
  "Incline walk",
  "Treadmill",
  "Stairs",
  "Bike",
  "Row",
  "Elliptical",
  "Other",
] as const;
export type ICardioPreset = (typeof CARDIO_PRESETS)[number];
export interface ICardioDraft {
  preset: ICardioPreset;
  date: string;
  time: string;
  zone: string;
  minutes: string;
  fields: Record<string, string>;
  detailed: boolean;
  segments: {
    phase: ICardioSegment["phase"];
    minutes: string;
    speed: string;
    unit: "mph" | "kmh";
    incline: string;
    distance: string;
    breakBefore?: boolean;
  }[];
  speedUnit: "mph" | "kmh";
  distanceUnit: "km" | "mi";
  intention?: ICardioActivity["intention"];
  blocks?: { duration: string; level: string; cadence: string; watts: string; notes: string }[];
  trainingMode?: "training" | "actual" | "legacy";
  trainingDate?: string;
  assignment?: ITrainingDate;
  rolloverMinutes?: number;
}
export const CARDIO_FIELDS = {
  treadmill: [
    ["walkMinutes", "Walking minutes"],
    ["jogMinutes", "Jog / run minutes"],
    ["longestMinutes", "Longest uninterrupted jog (minutes)"],
    ["walkSpeed", "Walk speed"],
    ["walkIncline", "Walk incline (%)"],
    ["jogSpeed", "Jog speed"],
    ["jogIncline", "Jog incline (%)"],
    ["shin", "Shin discomfort (0–10)"],
  ],
  stair_climber: [
    ["steps", "Machine steps"],
    ["spm", "Steps per minute"],
    ["level", "Machine level"],
    ["floors", "Reported floors"],
  ],
  stationary_bike: [
    ["resistance", "Resistance setting"],
    ["rpm", "Cadence (RPM)"],
    ["watts", "Average power (watts)"],
  ],
  rowing: [
    ["split", "Split (seconds / 500 m)"],
    ["stroke", "Strokes per minute"],
    ["watts", "Average power (watts)"],
    ["damper", "Damper / resistance"],
  ],
  elliptical: [],
  other: [["name", "Activity name"]],
} as const;

export function CardioForm_kind(preset: ICardioPreset): ICardioActivity["kind"] {
  return preset === "Stairs"
    ? "stair_climber"
    : preset === "Bike"
      ? "stationary_bike"
      : preset === "Row"
        ? "rowing"
        : preset === "Elliptical"
          ? "elliptical"
          : preset === "Other"
            ? "other"
            : "treadmill";
}

export function CardioForm_draft(
  zone: string,
  now: number,
  a?: ICardioActivity,
  assignment?: ITrainingDate,
  rolloverMinutes = 0
): ICardioDraft {
  const s = (n?: number): string => (n == null ? "" : `${+n.toFixed(3)}`);
  return {
    preset:
      a?.runPlan === "run_a"
        ? "Run A"
        : a?.runPlan === "run_b"
          ? "Run B"
          : a?.kind === "stair_climber"
            ? "Stairs"
            : a?.kind === "stationary_bike"
              ? "Bike"
              : a?.kind === "rowing"
                ? "Row"
                : a?.kind === "elliptical"
                  ? "Elliptical"
                  : a?.kind === "other"
                    ? "Other"
                    : "Treadmill",
    date: a?.performedLocalDate ?? TrainingDate_key(now, zone, rolloverMinutes),
    trainingMode: a
      ? assignment?.source === "legacy_date_only" || (!assignment && a.datePrecision === "date")
        ? "legacy"
        : a.datePrecision === "minute"
          ? "actual"
          : "training"
      : "training",
    trainingDate: assignment?.date,
    assignment,
    rolloverMinutes: assignment?.rolloverMinutes ?? rolloverMinutes,
    time: a?.performedLocalTime ?? "",
    zone: a?.timeZone ?? zone,
    minutes: a ? CardioTime_format(a.actualDurationSeconds) : "",
    detailed: !!a?.segments?.length,
    speedUnit: a?.jog?.speed?.unit ?? a?.walk?.speed?.unit ?? "mph",
    distanceUnit: a?.machineDistance?.unit ?? "mi",
    intention: a?.intention ?? a?.runPlan,
    blocks:
      a?.machineBlocks?.map((b) => ({
        duration: CardioTime_format(b.durationSeconds),
        level: b.resistanceLevel ?? "",
        cadence: s(b.cadenceRpm ?? b.stepsPerMinute ?? b.strokeRate),
        watts: s(b.powerWatts),
        notes: b.notes ?? "",
      })) ?? [],
    fields: {
      walkMinutes: s(a?.walkSeconds == null ? undefined : a.walkSeconds / 60),
      jogMinutes: s(a?.jogSeconds == null ? undefined : a.jogSeconds / 60),
      longestMinutes: s(a?.longestJogSeconds == null ? undefined : a.longestJogSeconds / 60),
      walkSpeed: s(a?.walk?.speed?.value),
      walkIncline: s(a?.walk?.inclinePercent),
      jogSpeed: s(a?.jog?.speed?.value),
      jogIncline: s(a?.jog?.inclinePercent),
      distance: s(a?.machineDistance?.value),
      steps: s(a?.stairSteps),
      spm: s(a?.stepsPerMinute),
      level: a?.stairsLevel ?? "",
      floors: s(a?.reportedFloors),
      resistance: a?.bikeResistanceLevel ?? "",
      rpm: s(a?.cadenceRpm),
      watts: s(a?.powerWatts),
      split: s(a?.rowingSplitSecondsPer500m),
      stroke: s(a?.strokeRate),
      damper: a?.rowingDamper ?? "",
      rpe: s(a?.effortRpe1to10),
      controlledEffort: a?.controlledEffort == null ? "" : a.controlledEffort ? "yes" : "no",
      shin: s(a?.shinDiscomfort0to10),
      profile: a?.machineProfile ?? "",
      notes: a?.notes ?? "",
      name: a?.activityName ?? "",
      pace: a?.machinePace ? CardioTime_format(a.machinePace.seconds) : "",
      paceUnit: a?.machinePace?.unit ?? a?.machineDistance?.unit ?? "mi",
      heartRate: s(a?.averageHeartRateBpm),
      calories: s(a?.machineCaloriesKcal),
    },
    segments:
      a?.segments?.map((p) => ({
        phase: p.phase,
        minutes: CardioTime_format(p.durationSeconds),
        speed: s(p.speed?.value),
        unit: p.speed?.unit ?? "mph",
        incline: s(p.inclinePercent),
        distance: s(p.distanceMeters),
        breakBefore: p.breakBefore,
      })) ?? [],
  };
}

export function CardioForm_build(
  d: ICardioDraft,
  now: number,
  mode: ICardioActivity["recordingMode"] = "manual"
): { activity?: ICardioActivity; error?: string } {
  if (Dates_day(d.date) == null) {
    return { error: "Use a valid date: YYYY-MM-DD." };
  }
  if (d.zone !== Dates_zone(d.zone)) {
    return { error: "Use a valid home time zone, such as America/Edmonton." };
  }
  if (d.date > Dates_key(now, d.zone)) {
    return { error: "Choose today or a past date." };
  }
  if (d.time.trim() && !Dates_validTime(d.date, d.time.trim(), d.zone)) {
    return {
      error: "That local time does not exist or is invalid. Check daylight saving time, or leave the time blank.",
    };
  }
  if (d.time.trim() && Dates_timestamp(d.date, d.zone, d.time.trim()) > now) {
    return { error: "Choose an actual start time that has already happened." };
  }
  const duration = CardioTime_parse(d.minutes);
  if (duration == null || duration <= 0) {
    return { error: "Enter the actual duration as minutes:seconds, such as 30:32." };
  }
  const n = (key: string): number | undefined => (d.fields[key]?.trim() ? Number(d.fields[key]) : undefined);
  const text = (key: string): string | undefined => d.fields[key]?.trim() || undefined;
  const seconds = (key: string): number | undefined => (n(key) == null ? undefined : n(key)! * 60);
  const kind = CardioForm_kind(d.preset);
  const intention =
    d.intention ??
    (d.preset === "Run A"
      ? "run_a"
      : d.preset === "Run B"
        ? "run_b"
        : d.preset === "Incline walk"
          ? "incline_walk"
          : "general");
  const pace = text("pace") ? CardioTime_parse(text("pace")!) : undefined;
  if (text("pace") && (pace == null || pace <= 0)) {
    return { error: "Enter machine-reported pace as minutes:seconds." };
  }
  const phase = (name: "walk" | "jog"): ICardioActivity["walk"] =>
    n(`${name}Speed`) != null || n(`${name}Incline`) != null
      ? {
          speed: n(`${name}Speed`) == null ? undefined : { value: n(`${name}Speed`)!, unit: d.speedUnit },
          inclinePercent: n(`${name}Incline`),
        }
      : undefined;
  const segments =
    kind === "treadmill" && d.detailed
      ? d.segments.map((p) => ({
          phase: p.phase,
          durationSeconds: CardioTime_parse(p.minutes) ?? NaN,
          speed: p.speed.trim() ? { value: Number(p.speed), unit: p.unit } : undefined,
          inclinePercent: p.incline.trim() ? Number(p.incline) : undefined,
          distanceMeters: p.distance.trim() ? Number(p.distance) : undefined,
          breakBefore: p.breakBefore,
        }))
      : undefined;
  if (d.detailed && kind === "treadmill" && !segments?.length) {
    return { error: "Add actual phases, or use the quick summary." };
  }
  const candidate: ICardioActivity = {
    schemaVersion: 1,
    kind,
    recordingMode: mode,
    datePrecision: d.time.trim() ? "minute" : "date",
    performedLocalDate: d.date,
    performedLocalTime: d.time.trim() || undefined,
    timeZone: d.zone,
    actualDurationSeconds: duration,
    intention,
    runPlan: kind === "treadmill" && (intention === "run_a" || intention === "run_b") ? intention : undefined,
    machineProfile: text("profile"),
    activityName: kind === "other" ? text("name") : undefined,
    notes: text("notes"),
    effortRpe1to10: n("rpe"),
    controlledEffort:
      d.fields.controlledEffort === "yes" ? true : d.fields.controlledEffort === "no" ? false : undefined,
    machineDistance: n("distance") == null ? undefined : { value: n("distance")!, unit: d.distanceUnit },
    machinePace: pace == null ? undefined : { seconds: pace, unit: d.fields.paceUnit === "km" ? "km" : "mi" },
    averageHeartRateBpm: n("heartRate"),
    machineCaloriesKcal: n("calories"),
    machineBlocks:
      kind === "treadmill" || !d.blocks?.length
        ? undefined
        : d.blocks.map((b) => ({
            durationSeconds: CardioTime_parse(b.duration) ?? NaN,
            resistanceLevel: b.level.trim() || undefined,
            cadenceRpm: kind === "stationary_bike" && b.cadence.trim() ? Number(b.cadence) : undefined,
            stepsPerMinute: kind === "stair_climber" && b.cadence.trim() ? Number(b.cadence) : undefined,
            strokeRate: kind === "rowing" && b.cadence.trim() ? Number(b.cadence) : undefined,
            powerWatts: b.watts.trim() ? Number(b.watts) : undefined,
            notes: b.notes.trim() || undefined,
          })),
    ...(kind === "treadmill"
      ? {
          segments,
          walkSeconds: segments ? undefined : seconds("walkMinutes"),
          jogSeconds: segments ? undefined : seconds("jogMinutes"),
          longestJogSeconds: segments ? undefined : seconds("longestMinutes"),
          walk: phase("walk"),
          jog: phase("jog"),
          shinDiscomfort0to10: n("shin"),
        }
      : {}),
    ...(kind === "stair_climber"
      ? { stairSteps: n("steps"), stepsPerMinute: n("spm"), stairsLevel: text("level"), reportedFloors: n("floors") }
      : {}),
    ...(kind === "stationary_bike"
      ? { bikeResistanceLevel: text("resistance"), cadenceRpm: n("rpm"), powerWatts: n("watts") }
      : {}),
    ...(kind === "rowing"
      ? {
          rowingSplitSecondsPer500m: n("split"),
          strokeRate: n("stroke"),
          powerWatts: n("watts"),
          rowingDamper: text("damper"),
        }
      : {}),
  };
  const parsed = v.safeParse(VCardioActivity, candidate);
  return parsed.success
    ? { activity: parsed.output }
    : {
        error:
          "Check optional numbers, effort (1–10), and phase times. Walk + jog and longest jog must fit the duration; detailed phases must add up to it.",
      };
}

export function CardioForm_submission(
  draft: ICardioDraft,
  history: IHistoryRecord[],
  now: number,
  opts: {
    recordId?: number;
    duplicateConfirmed: boolean;
    mode?: "manual" | "live";
    original?: ICardioActivity;
  }
): { activity?: ICardioActivity; trainingDate?: ITrainingDate; error?: string; duplicateWarning?: boolean } {
  const result = CardioForm_build(draft, now, opts.mode);
  if (!result.activity) {
    return result;
  }
  if (draft.trainingMode === "actual" && !draft.time.trim() && !opts.original) {
    return { error: "Enter the actual start time, or choose Training date." };
  }
  if (opts.mode === "live" && opts.original) {
    result.activity = {
      ...result.activity,
      actualDurationSeconds: opts.original.actualDurationSeconds,
      performedLocalDate: opts.original.performedLocalDate,
      performedLocalTime: opts.original.performedLocalTime,
      timeZone: opts.original.timeZone,
      datePrecision: opts.original.datePrecision,
      durationCoverage: opts.original.durationCoverage,
    };
  }
  const assignment = CardioForm_trainingAssignment(draft, result.activity);
  if (!v.safeParse(VTrainingDate, assignment).success) {
    return { error: "Choose a valid training date." };
  }
  if (assignment.date && assignment.date > TrainingDate_key(now, draft.zone, draft.rolloverMinutes ?? 0)) {
    return { error: "Choose the current training date or an earlier one." };
  }
  return !opts.duplicateConfirmed && Cardio_nearDuplicates(result.activity, history, opts.recordId).length
    ? { duplicateWarning: true }
    : { ...result, trainingDate: assignment };
}

export function CardioForm_trainingAssignment(
  draft: ICardioDraft,
  activity: Pick<ICardioActivity, "performedLocalDate" | "performedLocalTime" | "timeZone">
): ITrainingDate {
  const config = { timeZone: draft.zone, rolloverMinutes: draft.rolloverMinutes ?? 0 };
  if (draft.trainingMode === "legacy") {
    return draft.assignment ?? { source: "legacy_date_only", legacyCivilDate: activity.performedLocalDate, ...config };
  }
  if (draft.trainingMode === "training" || !draft.trainingMode) {
    return { date: draft.trainingDate ?? draft.date, source: "training_date", ...config };
  }
  if (draft.assignment && ["override", "training_date"].includes(draft.assignment.source)) {
    return draft.assignment;
  }
  if (!activity.performedLocalTime) {
    return draft.assignment ?? { source: "legacy_date_only", legacyCivilDate: activity.performedLocalDate, ...config };
  }
  const stamp = Dates_timestamp(activity.performedLocalDate, activity.timeZone, activity.performedLocalTime);
  return TrainingDate_start(stamp, draft.assignment ?? config);
}

export function CardioForm_trainingPreview(draft: ICardioDraft): string | undefined {
  if (
    Dates_day(draft.date) == null ||
    (draft.trainingMode === "actual" && !Dates_validTime(draft.date, draft.time, draft.zone))
  ) {
    return undefined;
  }
  return CardioForm_trainingAssignment(draft, {
    performedLocalDate: draft.date,
    performedLocalTime: draft.time,
    timeZone: draft.zone,
  }).date;
}
