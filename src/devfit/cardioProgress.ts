import { IHistoryRecord, ISettings } from "../types";
import { Exercise_get } from "../models/exercise";
import { Session_exerciseKind } from "./presentation";
import { Cardio_breakdown, Cardio_fromSet, Cardio_meters, Cardio_speedKmh, Cardio_entryActivity } from "./cardio";
import { ICardioActivity, ICardioPhaseSettings } from "./cardioSchema";
import { Dates_key } from "./dates";

export interface ICardioPoint {
  record: IHistoryRecord;
  activity: ICardioActivity;
  key: string;
}
export function CardioProgress_records(
  history: IHistoryRecord[],
  settings: ISettings,
  now = Date.now()
): ICardioPoint[] {
  return history
    .flatMap((record) =>
      record.entries.flatMap((entry) => {
        if (Session_exerciseKind(undefined, entry, settings) === "strength") {
          return [];
        }
        const text = `${record.entries.length === 1 ? record.dayName : ""} ${Exercise_get(entry.exercise, settings.exercises).name} ${entry.sets.map((s) => s.label ?? "").join(" ")}`;
        if (entry.sets.length > 1) {
          const activity = Cardio_entryActivity(record, entry, text);
          return activity && activity.performedLocalDate <= Dates_key(now, activity.timeZone)
            ? [{ record, activity, key: `${record.id}:${entry.id}:activity` }]
            : [];
        }
        return entry.sets.flatMap((set) => {
          const activity = Cardio_fromSet(set, record, text);
          return activity && activity.performedLocalDate <= Dates_key(now, activity.timeZone)
            ? [{ record, activity, key: `${record.id}:${entry.id}:${set.id}` }]
            : [];
        });
      })
    )
    .sort(
      (a, b) =>
        a.activity.performedLocalDate.localeCompare(b.activity.performedLocalDate) ||
        a.record.startTime - b.record.startTime
    );
}

export const CARDIO_METRICS = {
  treadmill: [
    ["duration", "Duration (min)"],
    ["jog", "Jog / run (min)"],
    ["walk", "Walk (min)"],
    ["longest", "Longest jog (min)"],
    ["ratio", "Jog / walk ratio"],
    ["distance", "Machine distance (km)"],
    ["speed", "Average machine speed (km/h)"],
    ["rpe", "Effort RPE"],
    ["shin", "Shin discomfort"],
  ],
  stair_climber: [
    ["duration", "Duration (min)"],
    ["steps", "Reported steps"],
    ["spm", "Steps / minute"],
    ["rpe", "Effort RPE"],
  ],
  stationary_bike: [
    ["duration", "Duration (min)"],
    ["distance", "Virtual distance (km)"],
    ["watts", "Power (watts)"],
    ["rpm", "Cadence (RPM)"],
    ["rpe", "Effort RPE"],
  ],
  rowing: [
    ["duration", "Duration (min)"],
    ["distance", "Machine distance (km)"],
    ["split", "Seconds / 500 m"],
    ["watts", "Power (watts)"],
    ["stroke", "Strokes / minute"],
    ["rpe", "Effort RPE"],
  ],
  elliptical: [
    ["duration", "Duration (min)"],
    ["distance", "Machine distance (km)"],
    ["rpe", "Effort RPE"],
  ],
  other: [
    ["duration", "Duration (min)"],
    ["rpe", "Effort RPE"],
  ],
} as const;

export function CardioProgress_metric(a: ICardioActivity, metric: string): number | undefined {
  const b = Cardio_breakdown(a);
  const distance = a.machineDistance && Cardio_meters(a.machineDistance);
  switch (metric) {
    case "duration":
      return a.actualDurationSeconds / 60;
    case "jog":
      return b.jogSeconds == null ? undefined : b.jogSeconds / 60;
    case "walk":
      return b.walkSeconds == null ? undefined : b.walkSeconds / 60;
    case "longest":
      return b.longestJogSeconds == null ? undefined : b.longestJogSeconds / 60;
    case "ratio":
      return b.jogSeconds == null || !b.walkSeconds ? undefined : b.jogSeconds / b.walkSeconds;
    case "distance":
      return distance == null ? undefined : distance / 1000;
    case "speed":
      return a.durationCoverage === "active_work" || distance == null || a.actualDurationSeconds <= 0
        ? undefined
        : (distance / a.actualDurationSeconds) * 3.6;
    case "steps":
      return a.stairSteps;
    case "spm":
      return a.stepsPerMinute;
    case "watts":
      return a.powerWatts;
    case "rpm":
      return a.cadenceRpm;
    case "split":
      return a.rowingSplitSecondsPer500m;
    case "stroke":
      return a.strokeRate;
    case "rpe":
      return a.effortRpe1to10;
    case "shin":
      return a.shinDiscomfort0to10;
    default:
      return undefined;
  }
}

export function CardioProgress_jogCondition(a: ICardioActivity): ICardioPhaseSettings | undefined {
  if (!a.segments?.length) {
    return a.jog;
  }
  const jogs = a.segments.filter((s) => s.phase === "jog" || s.phase === "run");
  const first = jogs[0];
  if (!first?.speed || first.inclinePercent == null) {
    return undefined;
  }
  return jogs.every(
    (s) =>
      s.speed &&
      s.inclinePercent != null &&
      Math.abs(Cardio_speedKmh(s.speed) - Cardio_speedKmh(first.speed!)) <= 0.16 &&
      Math.abs(s.inclinePercent - first.inclinePercent!) <= 0.25
  )
    ? first
    : undefined;
}

export function CardioProgress_compare(previous: ICardioActivity, current: ICardioActivity): string {
  if (previous.kind !== current.kind) {
    return "Different activities";
  }
  if (current.kind !== "treadmill") {
    return previous.machineProfile && previous.machineProfile === current.machineProfile
      ? "Same machine profile · compare reported metrics"
      : "Machine profile unknown or different · compare separately";
  }
  const p = CardioProgress_jogCondition(previous);
  const c = CardioProgress_jogCondition(current);
  const before = Cardio_breakdown(previous).longestJogSeconds;
  const after = Cardio_breakdown(current).longestJogSeconds;
  if (
    !p?.speed ||
    !c?.speed ||
    p.inclinePercent == null ||
    c.inclinePercent == null ||
    before == null ||
    after == null
  ) {
    return "Speed, grade or longest jog not recorded · no condition comparison";
  }
  const similar =
    Math.abs(Cardio_speedKmh(p.speed) - Cardio_speedKmh(c.speed)) <= 0.16 &&
    Math.abs(p.inclinePercent - c.inclinePercent) <= 0.25 &&
    previous.machineProfile === current.machineProfile;
  if (similar) {
    return after > before
      ? "Longer continuous jog at similar speed and grade"
      : "Similar speed and grade · compare continuous duration";
  }
  return `${after > before ? "Longer continuous duration; " : ""}${c.inclinePercent < p.inclinePercent ? "lower incline. " : c.inclinePercent > p.inclinePercent ? "higher incline. " : ""}Different conditions — no global PR`;
}

export function CardioProgress_details(a: ICardioActivity): [string, string][] {
  const b = Cardio_breakdown(a);
  const min = (seconds?: number): string => (seconds == null ? "Not recorded" : `${+(seconds / 60).toFixed(2)} min`);
  const setting = (p?: ICardioPhaseSettings): string =>
    `${p?.speed ? `${p.speed.value} ${p.speed.unit === "mph" ? "mph" : "km/h"}` : "Speed not recorded"} · ${p?.inclinePercent == null ? "grade not recorded" : `${p.inclinePercent.toFixed(1)}%`}`;
  const rows: [string, string][] = [
    [
      a.durationCoverage === "active_work" ? "Recorded active work (recovery timers separate)" : "Actual duration",
      min(a.actualDurationSeconds),
    ],
    [
      "Distance",
      a.machineDistance
        ? `${a.machineDistance.value} ${a.machineDistance.unit} · machine reported${a.kind === "stationary_bike" ? " (virtual)" : ""}`
        : "Not recorded",
    ],
  ];
  if (a.kind === "treadmill") {
    rows.push(
      ["Walk", min(b.walkSeconds)],
      ["Jog / run", min(b.jogSeconds)],
      ["Longest uninterrupted jog", min(b.longestJogSeconds)],
      ["Walk settings", setting(a.walk)],
      ["Jog settings", setting(CardioProgress_jogCondition(a))]
    );
  }
  for (const [label, value] of [
    ["Steps", a.stairSteps],
    ["Steps / min", a.stepsPerMinute],
    ["Machine level", a.stairsLevel],
    ["Reported floors", a.reportedFloors],
    ["Resistance", a.bikeResistanceLevel],
    ["RPM", a.cadenceRpm],
    ["Watts", a.powerWatts],
    ["Split seconds / 500m", a.rowingSplitSecondsPer500m],
    ["Stroke rate", a.strokeRate],
    ["Damper", a.rowingDamper],
    ["Effort RPE", a.effortRpe1to10],
    ["Shin discomfort", a.shinDiscomfort0to10],
  ] as const) {
    if (value != null) {
      rows.push([label, `${value}`]);
    }
  }
  if (a.machineProfile) {
    rows.push(["Machine", a.machineProfile]);
  }
  if (a.notes) {
    rows.push(["Notes", a.notes]);
  }
  return rows;
}
