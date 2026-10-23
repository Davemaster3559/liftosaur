import { IHistoryRecord, ISettings, IStats, IWeight } from "../types";
import { Exercise_fullName, Exercise_get, Exercise_toKey } from "../models/exercise";
import { History_getMax1RMSet, History_getNumberOfPersonalRecords, IPersonalRecords } from "../models/history";
import { Reps_avgUnilateralCompletedReps } from "../models/set";
import { Weight_build, Weight_convertTo, Weight_getOneRepMax } from "../models/weight";
import { WeekInsightsUtils_calculateSetResults } from "../utils/weekInsightsUtils";
import { Session_exerciseKind } from "./presentation";
import { Dates_add, Dates_key, Dates_timestamp, Dates_zone } from "./dates";
import { Cardio_recordDate } from "./cardio";
import {
  TrainingDate_bounds,
  TrainingDate_key,
  TrainingDate_record,
  TrainingDate_scheduleConfig,
} from "./trainingDates";
import { Dates_day } from "./dates";

export interface ICycleRange {
  start: number;
  end: number;
  now: number;
  days: number;
  zone?: string;
  startDate?: string;
  endDate?: string;
  rolloverMinutes?: number;
}
export interface ICycleTrend {
  key: string;
  name: string;
  change: number;
  direction: "up" | "down" | "steady";
}

export function Cycle_setting(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.min(60, Math.max(1, Math.round(value!))) : fallback;
}

export function Cycle_dayKey(record: IHistoryRecord, range?: ICycleRange): number {
  const key =
    TrainingDate_record(record, {
      timeZone: range?.zone ?? Dates_zone(),
      rolloverMinutes: range?.rolloverMinutes ?? 0,
    }) ?? Cardio_recordDate(record, range?.zone);
  return Dates_day(key)! * 86400000;
}

export function Cycle_range(settings: ISettings, now: number = Date.now()): ICycleRange {
  const days = Cycle_setting(settings.devfitCycleDays, 14);
  const schedules = Object.values(settings.devfitSchedules ?? {});
  const config = TrainingDate_scheduleConfig(schedules.length === 1 ? schedules[0] : undefined);
  const zone = config.timeZone;
  const today = TrainingDate_key(now, zone, config.rolloverMinutes);
  const startDate = Dates_add(today, 1 - days);
  const endDate = Dates_add(today, 1);
  return {
    start: TrainingDate_bounds(startDate, zone, config.rolloverMinutes).start,
    end: TrainingDate_bounds(today, zone, config.rolloverMinutes).end,
    now,
    days,
    zone,
    startDate,
    endDate,
    rolloverMinutes: config.rolloverMinutes,
  };
}

export function Cycle_records(history: IHistoryRecord[], range: ICycleRange): IHistoryRecord[] {
  return history.filter((r) => {
    const config = { timeZone: range.zone ?? Dates_zone(), rolloverMinutes: range.rolloverMinutes ?? 0 };
    const dateOnly = r.source === "devfit_manual" && r.entries[0]?.sets[0]?.devfitCardio?.datePrecision === "date";
    const date = TrainingDate_record(r, config) ?? (dateOnly ? Cardio_recordDate(r, range.zone) : undefined);
    return (
      r.vtype === "history_record" &&
      date != null &&
      date >= (range.startDate ?? Dates_key(range.start, range.zone)) &&
      date < (range.endDate ?? Dates_key(range.end, range.zone)) &&
      (dateOnly || r.startTime <= range.now)
    );
  });
}

export function Cycle_bodyweightChange(stats: IStats, range: ICycleRange, settings: ISettings): IWeight | undefined {
  const civilToday = Dates_key(range.now, range.zone);
  const civilStart = Dates_timestamp(Dates_add(civilToday, 1 - range.days), range.zone, "00:00");
  const civilEnd = Dates_timestamp(Dates_add(civilToday, 1), range.zone, "00:00");
  const values = (stats.weight.weight ?? [])
    .filter((s) => s.timestamp >= civilStart && s.timestamp < civilEnd && s.timestamp <= range.now)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (values.length < 2) {
    return undefined;
  }
  return Weight_build(
    Weight_convertTo(values[values.length - 1].value, settings.units).value -
      Weight_convertTo(values[0].value, settings.units).value,
    settings.units
  );
}

// Compare each exercise's latest two completed sessions. This is an estimate, not a
// judgement about a plateau or a prediction of the next Liftoscript update.
export function Cycle_trends(history: IHistoryRecord[], range: ICycleRange, settings: ISettings): ICycleTrend[] {
  const sessions = new Map<string, Array<{ time: number; value: number }>>();
  const exerciseTypes = new Map<string, IHistoryRecord["entries"][number]["exercise"]>();
  const records = history
    .filter((r) => r.vtype === "history_record" && r.startTime <= range.now)
    .sort((a, b) => a.startTime - b.startTime);
  for (const record of records) {
    const byExercise = new Map<string, IHistoryRecord["entries"][number]["sets"]>();
    for (const entry of record.entries) {
      const key = Exercise_toKey(entry.exercise);
      exerciseTypes.set(key, entry.exercise);
      byExercise.set(key, [...(byExercise.get(key) ?? []), ...entry.sets]);
    }
    for (const [key, sets] of byExercise) {
      const best = History_getMax1RMSet(sets);
      if (!best || !best.completedWeight || !best.completedReps) {
        continue;
      }
      const estimate = Weight_getOneRepMax(
        best.completedWeight,
        Reps_avgUnilateralCompletedReps(best) ?? 0,
        best.completedRpe ?? best.rpe ?? 10
      );
      const value = Weight_convertTo(estimate, settings.units).value;
      if (value <= 0) {
        continue;
      }
      sessions.set(key, [...(sessions.get(key) ?? []).slice(-1), { time: record.startTime, value }]);
    }
  }
  const trends: ICycleTrend[] = [];
  for (const [key, values] of sessions) {
    if (values.length < 2 || values[1].time < range.start) {
      continue;
    }
    const change = (values[1].value / values[0].value - 1) * 100;
    const exercise = Exercise_get(exerciseTypes.get(key)!, settings.exercises);
    trends.push({
      key,
      name: Exercise_fullName(exercise, settings),
      change,
      direction: change > 1 ? "up" : change < -1 ? "down" : "steady",
    });
  }
  return trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export function Cycle_summary(
  history: IHistoryRecord[],
  settings: ISettings,
  stats: IStats,
  prs: IPersonalRecords,
  now: number = Date.now()
): {
  range: ICycleRange;
  records: IHistoryRecord[];
  target: number;
  sets: ReturnType<typeof WeekInsightsUtils_calculateSetResults>;
  prs: number;
  bodyweightChange?: IWeight;
  trends: ICycleTrend[];
} {
  const range = Cycle_range(settings, now);
  const records = Cycle_records(history, range);
  const strength = records.map((r) => ({
    ...r,
    entries: r.entries.filter((e) => Session_exerciseKind(undefined, e, settings) === "strength"),
  }));
  return {
    range,
    records,
    target: Cycle_setting(settings.devfitCycleTarget, 4),
    sets: WeekInsightsUtils_calculateSetResults(strength, settings, (record) => Cycle_dayKey(record, range)),
    prs: History_getNumberOfPersonalRecords(records, prs),
    bodyweightChange: Cycle_bodyweightChange(stats, range, settings),
    trends: Cycle_trends(history, range, settings),
  };
}
