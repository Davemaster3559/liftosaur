import * as v from "valibot";
import { IHistoryEntry, IHistoryRecord, ISet, ISettings } from "../types";
import {
  ICardioActivity,
  ICardioPhaseSettings,
  ICardioSegment,
  VCardioActivity,
  VCardioEntryDetails,
  ICardioEntryDetails,
} from "./cardioSchema";
import { Dates_key, Dates_timestamp, Dates_zone, Dates_validTime } from "./dates";
import { Weight_build } from "../models/weight";
import { ITrainingDate, TrainingDate_changedStart, TrainingDate_start, VTrainingDate } from "./trainingDates";
import { ICardioPrescription } from "./planSchema";

export const CARDIO_NAMES: Record<ICardioActivity["kind"], string> = {
  treadmill: "Treadmill",
  stair_climber: "Stairs",
  stationary_bike: "Bike",
  rowing: "Row",
  elliptical: "Elliptical",
  other: "Other cardio",
};

export function Cardio_name(activity: ICardioActivity): string {
  return (
    activity.activityName ||
    Cardio_prescriptionName({ machine: activity.kind, intention: activity.intention ?? activity.runPlan ?? "general" })
  );
}

export function Cardio_prescriptionName(prescription: Pick<ICardioPrescription, "machine" | "intention">): string {
  const intention = {
    run_a: "Run A",
    run_b: "Run B",
    incline_walk: "Incline walk",
    endurance: "Endurance",
    recovery: "Recovery",
    general: "",
  }[prescription.intention];
  return `${CARDIO_NAMES[prescription.machine]}${intention ? ` · ${intention}` : ""}`;
}

export function Cardio_exerciseId(machine: ICardioActivity["kind"]): string {
  return {
    treadmill: "inclineTreadmillWalk",
    stationary_bike: "stationaryBike",
    rowing: "rowing",
    elliptical: "ellipticalMachine",
    stair_climber: "stairClimber",
    other: "otherCardio",
  }[machine];
}

export function Cardio_speedKmh(speed: { value: number; unit: "mph" | "kmh" }): number {
  return speed.value * (speed.unit === "mph" ? 1.609344 : 1);
}

export function Cardio_meters(distance: { value: number; unit: "km" | "mi" }): number {
  return distance.value * (distance.unit === "mi" ? 1609.344 : 1000);
}

export function Cardio_breakdown(
  activity: Pick<ICardioActivity, "segments" | "walkSeconds" | "jogSeconds" | "longestJogSeconds">
): {
  walkSeconds?: number;
  jogSeconds?: number;
  longestJogSeconds?: number;
} {
  if (!activity.segments?.length) {
    return {
      walkSeconds: activity.walkSeconds,
      jogSeconds: activity.jogSeconds,
      longestJogSeconds: activity.longestJogSeconds,
    };
  }
  let walkSeconds = 0;
  let jogSeconds = 0;
  let longestJogSeconds = 0;
  let uninterrupted = 0;
  for (const s of activity.segments) {
    if (s.breakBefore) {
      uninterrupted = 0;
    }
    if (s.phase === "walk") {
      walkSeconds += s.durationSeconds;
    }
    if (s.phase === "jog" || s.phase === "run") {
      jogSeconds += s.durationSeconds;
      uninterrupted += s.durationSeconds;
      longestJogSeconds = Math.max(longestJogSeconds, uninterrupted);
    } else {
      uninterrupted = 0;
    }
  }
  return { walkSeconds, jogSeconds, longestJogSeconds };
}

export function Cardio_segments(laps: ISet["cardioLaps"], seconds: number): ICardioSegment[] | undefined {
  if (!laps?.length || seconds <= 0) {
    return undefined;
  }
  if (
    laps.some(
      (l, i) =>
        !Number.isFinite(l.elapsedSeconds) ||
        l.elapsedSeconds < 0 ||
        l.elapsedSeconds > seconds ||
        (i > 0 && l.elapsedSeconds < laps[i - 1].elapsedSeconds)
    )
  ) {
    return undefined;
  }
  const boundaries = laps[0].elapsedSeconds === 0 ? laps : [{ phase: "walk" as const, elapsedSeconds: 0 }, ...laps];
  let pendingBreak = false;
  return boundaries.flatMap((l, i) => {
    pendingBreak = pendingBreak || !!l.breakBefore;
    const durationSeconds = (boundaries[i + 1]?.elapsedSeconds ?? seconds) - l.elapsedSeconds;
    if (durationSeconds <= 0) {
      return [];
    }
    const segment = {
      phase: l.phase,
      durationSeconds,
      speed: l.speed,
      inclinePercent: l.inclinePercent,
      breakBefore: pendingBreak || undefined,
    };
    pendingBreak = false;
    return [segment];
  });
}

export function Cardio_pauseBoundary(record: IHistoryRecord, pausedAt: number): IHistoryRecord {
  const clock = record.setTimer;
  const entry = clock && record.entries[clock.entryIndex];
  const set = clock && entry?.sets[clock.setIndex];
  const last = set?.cardioLaps?.slice(-1)[0];
  if (!clock || !set || set.id !== clock.setId || !last) {
    return record;
  }
  const elapsedSeconds = Math.max(last.elapsedSeconds, Math.floor((pausedAt - clock.startedAt) / 1000));
  const updated = { ...set, cardioLaps: [...set.cardioLaps!, { ...last, elapsedSeconds, breakBefore: true }] };
  return {
    ...record,
    entries: record.entries.map((e, i) =>
      i === clock.entryIndex ? { ...e, sets: e.sets.map((s, j) => (j === clock.setIndex ? updated : s)) } : e
    ),
  };
}

export function Cardio_duration(
  set: Pick<ISet, "devfitCardio" | "completedSetTimer" | "completedSetTimerLeft">
): number {
  return set.devfitCardio?.actualDurationSeconds ?? (set.completedSetTimer ?? 0) + (set.completedSetTimerLeft ?? 0);
}

export function Cardio_mirror(set: ISet, activity: ICardioActivity): ISet {
  // Legacy set rendering and CSV export still read completedSetTimer.
  const validated = v.parse(VCardioActivity, { ...activity, ...Cardio_breakdown(activity) });
  return {
    ...set,
    devfitCardio: validated,
    completedSetTimer: validated.actualDurationSeconds,
    completedSetTimerLeft: undefined,
  };
}

export function Cardio_identity(text: string): { kind: ICardioActivity["kind"]; runPlan?: ICardioActivity["runPlan"] } {
  const run = text.match(/\brun[ _-]*([ab])\d*\b/i)?.[1]?.toLowerCase();
  const kind =
    run || /treadmill|incline.*walk|jog|\brunning\b/i.test(text)
      ? "treadmill"
      : /stair/i.test(text)
        ? "stair_climber"
        : /bike|cycling/i.test(text)
          ? "stationary_bike"
          : /rowing|rower/i.test(text)
            ? "rowing"
            : /elliptical/i.test(text)
              ? "elliptical"
              : "other";
  return { kind, runPlan: run === "a" ? "run_a" : run === "b" ? "run_b" : undefined };
}

export function Cardio_fromSet(set: ISet, record: IHistoryRecord, text: string): ICardioActivity | undefined {
  if (!set.isCompleted) {
    return undefined;
  }
  if (set.devfitCardio) {
    return set.devfitCardio;
  }
  const actualDurationSeconds = Cardio_duration(set);
  if (actualDurationSeconds <= 0) {
    return undefined;
  }
  const segments = Cardio_segments(set.cardioLaps, actualDurationSeconds);
  return {
    schemaVersion: 1,
    ...Cardio_identity(text),
    recordingMode: "legacy",
    datePrecision: "minute",
    performedLocalDate: Dates_key(record.startTime),
    timeZone: Dates_zone(),
    actualDurationSeconds,
    segments,
    ...Cardio_breakdown({ segments }),
  };
}

export function Cardio_recordDate(record: IHistoryRecord, zone?: string): string {
  const manual = record.source === "devfit_manual" ? record.entries[0]?.sets[0]?.devfitCardio : undefined;
  return manual?.performedLocalDate ?? Dates_key(record.startTime, zone);
}

export function Cardio_manualRecord(
  activity: ICardioActivity,
  history: IHistoryRecord[],
  settings: ISettings,
  now: number,
  previous?: IHistoryRecord,
  trainingDate?: ITrainingDate
): IHistoryRecord {
  const a = v.parse(VCardioActivity, { ...activity, recordingMode: "manual" });
  const oldActivity = previous?.entries[0]?.sets[0]?.devfitCardio;
  const unchangedDate =
    oldActivity?.performedLocalDate === a.performedLocalDate &&
    oldActivity?.performedLocalTime === a.performedLocalTime &&
    oldActivity?.timeZone === a.timeZone;
  const startTime =
    unchangedDate && previous
      ? previous.startTime
      : Dates_timestamp(a.performedLocalDate, a.timeZone, a.performedLocalTime);
  if (
    a.performedLocalTime &&
    !Dates_validTime(a.performedLocalDate, a.performedLocalTime, a.timeZone ?? Dates_zone())
  ) {
    throw new Error("Check the date and time.");
  }
  const ids = new Set(history.map((r) => r.id));
  let id = Math.max(1, Math.floor(now));
  while (ids.has(id)) {
    id += 1;
  }
  id = previous?.id ?? id;
  const set = Cardio_mirror(
    {
      vtype: "set",
      index: 0,
      id: previous?.entries[0]?.sets[0]?.id ?? `cardio-${id}`,
      isCompleted: true,
      completedReps: 1,
      completedWeight: Weight_build(0, settings.units),
      timestamp: startTime,
    },
    a
  );
  return {
    vtype: "history_record",
    id,
    date: a.performedLocalDate,
    programId: "devfit-manual-cardio",
    programName: "Cardio",
    day: 1,
    dayName: Cardio_name(a),
    source: "devfit_manual",
    startTime,
    endTime: startTime + a.actualDurationSeconds * 1000,
    updatedAt: now,
    devfitScheduleCredit: previous?.devfitScheduleCredit,
    devfitTrainingDate: trainingDate
      ? v.parse(VTrainingDate, trainingDate)
      : previous
        ? TrainingDate_changedStart(previous, startTime)
        : a.datePrecision === "date"
          ? {
              source: "legacy_date_only",
              legacyCivilDate: a.performedLocalDate,
              timeZone: a.timeZone ?? Dates_zone(),
              rolloverMinutes: 0,
            }
          : TrainingDate_start(startTime, { timeZone: a.timeZone ?? Dates_zone(), rolloverMinutes: 0 }),
    entries: [
      {
        vtype: "history_entry",
        index: 0,
        id: `cardio-entry-${id}`,
        exercise: { id: Cardio_exerciseId(a.kind), equipment: "leverageMachine" },
        sets: [set],
        warmupSets: [],
        notes: a.notes,
      },
    ],
  };
}

export function Cardio_nearDuplicates(
  activity: ICardioActivity,
  history: IHistoryRecord[],
  excludeId?: number
): IHistoryRecord[] {
  return history.filter(
    (r) =>
      r.id !== excludeId &&
      r.entries.some((e) =>
        e.sets.some((s) => {
          const a = Cardio_fromSet(
            s,
            r,
            `${r.dayName} ${e.exercise.id} ${e.sets.map((set) => set.label ?? "").join(" ")}`
          );
          return (
            a &&
            a.kind === activity.kind &&
            a.performedLocalDate === activity.performedLocalDate &&
            Math.abs(a.actualDurationSeconds - activity.actualDurationSeconds) < 180
          );
        })
      )
  );
}

export function Cardio_phaseSetting(set: ISet, seconds: number, settings: ICardioPhaseSettings): ISet {
  const phase = set.cardioLaps?.slice(-1)[0]?.phase ?? "walk";
  return {
    ...set,
    cardioLaps: [
      ...(set.cardioLaps ?? []),
      {
        phase,
        elapsedSeconds: Math.max(set.cardioLaps?.slice(-1)[0]?.elapsedSeconds ?? 0, Math.floor(seconds), 0),
        ...settings,
      },
    ],
  };
}

export function Cardio_liveSet(
  set: ISet,
  record: IHistoryRecord,
  text: string,
  seconds: number,
  zone?: string,
  prescription?: ICardioPrescription
): ISet {
  if (set.isUnilateral) {
    return set;
  }
  const actualDurationSeconds = Math.max(0, seconds);
  const segments = Cardio_segments(
    set.cardioLaps?.filter((l) => l.elapsedSeconds <= actualDurationSeconds),
    actualDurationSeconds
  );
  return Cardio_mirror(set, {
    ...set.devfitCardio,
    schemaVersion: 1,
    ...(set.devfitCardio
      ? { kind: set.devfitCardio.kind, runPlan: set.devfitCardio.runPlan }
      : prescription
        ? {
            kind: prescription.machine,
            runPlan:
              prescription.intention === "run_a" || prescription.intention === "run_b"
                ? prescription.intention
                : undefined,
          }
        : Cardio_identity(text)),
    intention: set.devfitCardio?.intention ?? prescription?.intention,
    recordingMode: "live",
    datePrecision: "minute",
    performedLocalDate:
      set.devfitCardio?.performedLocalDate ??
      Dates_key(record.setTimer?.performedAt ?? record.setTimer?.startedAt ?? record.startTime, zone),
    timeZone: set.devfitCardio?.timeZone ?? Dates_zone(zone),
    actualDurationSeconds,
    segments,
    walkSeconds: undefined,
    jogSeconds: undefined,
    longestJogSeconds: undefined,
  });
}

export function Cardio_historyDate(record: IHistoryRecord): Date {
  const manual = record.source === "devfit_manual" ? record.entries[0]?.sets[0]?.devfitCardio : undefined;
  if (!manual) {
    return new Date(record.date);
  }
  const [year, month, day] = manual.performedLocalDate.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function Cardio_editDuration(set: ISet, seconds?: number, leftSeconds?: number): ISet {
  if (seconds == null) {
    return {
      ...set,
      completedSetTimer: undefined,
      completedSetTimerLeft: undefined,
      devfitCardio: undefined,
      cardioLaps: undefined,
    };
  }
  const actualDurationSeconds = seconds + (leftSeconds ?? 0);
  if (!set.devfitCardio) {
    return { ...set, completedSetTimer: seconds, completedSetTimerLeft: leftSeconds };
  }
  const a = set.devfitCardio;
  const invalidPhases = !!a.segments?.length && Math.abs(a.actualDurationSeconds - actualDurationSeconds) > 1;
  const invalidSummary =
    (a.walkSeconds ?? 0) + (a.jogSeconds ?? 0) > actualDurationSeconds ||
    (a.longestJogSeconds ?? 0) > actualDurationSeconds;
  return Cardio_mirror(
    { ...set, cardioLaps: invalidPhases ? undefined : set.cardioLaps },
    {
      ...a,
      actualDurationSeconds,
      segments: invalidPhases ? undefined : a.segments,
      walkSeconds: invalidPhases || invalidSummary ? undefined : a.walkSeconds,
      jogSeconds: invalidPhases || invalidSummary ? undefined : a.jogSeconds,
      longestJogSeconds: invalidPhases || invalidSummary ? undefined : a.longestJogSeconds,
    }
  );
}

export function Cardio_entryDetails(activity: ICardioActivity): ICardioEntryDetails {
  return v.parse(VCardioEntryDetails, activity);
}

export function Cardio_updateEntry(entry: IHistoryEntry, setIndex: number, activity: ICardioActivity): IHistoryEntry {
  return entry.sets.length > 1
    ? { ...entry, devfitCardioDetails: Cardio_entryDetails(activity) }
    : { ...entry, sets: entry.sets.map((s, i) => (i === setIndex ? Cardio_mirror(s, activity) : s)) };
}

export function Cardio_entryActivity(
  record: IHistoryRecord,
  entry: IHistoryEntry,
  text: string
): ICardioActivity | undefined {
  const activities = entry.sets.map((s) => Cardio_fromSet(s, record, text)).filter((a): a is ICardioActivity => !!a);
  if (!activities.length) {
    return undefined;
  }
  if (activities.length === 1 && entry.sets.length === 1) {
    return activities[0];
  }
  const first = activities[0];
  const breakdowns = activities.map(Cardio_breakdown);
  const sum = (key: "walkSeconds" | "jogSeconds"): number | undefined =>
    breakdowns.every((b) => b[key] != null) ? breakdowns.reduce((n, b) => n + b[key]!, 0) : undefined;
  const sameSetting = (phase: "walk" | "jog"): ICardioPhaseSettings | undefined => {
    const settings = activities.flatMap((a) => {
      const segments = a.segments?.filter((s) =>
        phase === "walk" ? s.phase === "walk" : s.phase === "jog" || s.phase === "run"
      );
      return segments?.length ? segments : [a[phase]];
    });
    return settings[0] &&
      settings.every(
        (s) =>
          JSON.stringify(s?.speed) === JSON.stringify(settings[0]?.speed) &&
          s?.inclinePercent === settings[0]?.inclinePercent
      )
      ? { speed: settings[0].speed, inclinePercent: settings[0].inclinePercent }
      : undefined;
  };
  const base: ICardioActivity = {
    ...first,
    actualDurationSeconds: activities.reduce((n, a) => n + a.actualDurationSeconds, 0),
    durationCoverage: "active_work",
    segments: undefined,
    walkSeconds: sum("walkSeconds"),
    jogSeconds: sum("jogSeconds"),
    longestJogSeconds: undefined,
    walk: sameSetting("walk"),
    jog: sameSetting("jog"),
    machineDistance: undefined,
    effortRpe1to10: undefined,
    shinDiscomfort0to10: undefined,
    stairSteps: undefined,
    stepsPerMinute: undefined,
    cadenceRpm: undefined,
    powerWatts: undefined,
    rowingSplitSecondsPer500m: undefined,
    strokeRate: undefined,
    ...entry.devfitCardioDetails,
  };
  if (v.safeParse(VCardioActivity, base).success) {
    return base;
  }
  return { ...base, segments: undefined, walkSeconds: undefined, jogSeconds: undefined, longestJogSeconds: undefined };
}

export interface ICardioPhaseRequest {
  entryIndex: number;
  setIndex: number;
  phaseId: string;
  setId: string;
  expectedPhase: "walk" | "jog";
  kind: "begin" | "switch" | "settings";
  value?: ICardioPhaseSettings;
  initialPhase?: "walk" | "jog";
}

export function Cardio_applyPhase(
  progress: IHistoryRecord,
  request: ICardioPhaseRequest,
  now: number,
  paused: boolean
): IHistoryRecord {
  const clock = progress.setTimer;
  const set = progress.entries[request.entryIndex]?.sets[request.setIndex];
  if (
    paused ||
    !clock ||
    !set ||
    clock.id !== request.phaseId ||
    clock.setId !== request.setId ||
    set.id !== request.setId ||
    clock.entryIndex !== request.entryIndex ||
    clock.setIndex !== request.setIndex ||
    set.isUnilateral
  ) {
    return progress;
  }
  const phase = set.cardioLaps?.slice(-1)[0]?.phase ?? "walk";
  if (phase !== request.expectedPhase) {
    return progress;
  }
  const seconds = Math.max(0, Math.floor((now - clock.startedAt) / 1000));
  let updated = set;
  if (request.kind === "begin") {
    if (set.cardioLaps?.length) {
      return progress;
    }
    updated = { ...set, cardioLaps: [{ phase: request.initialPhase ?? "walk", elapsedSeconds: 0 }] };
  } else if (request.kind === "settings" && request.value) {
    updated = Cardio_phaseSetting(set, seconds, request.value);
  } else if (request.kind === "switch") {
    const next = phase === "walk" ? "jog" : "walk";
    const previous = set.cardioLaps
      ?.slice()
      .reverse()
      .find((p) => p.phase === next);
    updated = {
      ...set,
      cardioLaps: [
        ...(set.cardioLaps ?? []),
        {
          ...previous,
          phase: next,
          elapsedSeconds: Math.max(seconds, set.cardioLaps?.slice(-1)[0]?.elapsedSeconds ?? 0),
        },
      ],
    };
  }
  return updated === set
    ? progress
    : {
        ...progress,
        entries: progress.entries.map((e, i) =>
          i === request.entryIndex ? { ...e, sets: e.sets.map((s, j) => (j === request.setIndex ? updated : s)) } : e
        ),
      };
}
