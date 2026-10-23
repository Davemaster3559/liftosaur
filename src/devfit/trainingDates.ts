import * as v from "valibot";
import type { IDevFitSchedule, IHistoryRecord, IProgram, ISettings, IStorage } from "../types";
import { Dates_add, Dates_day, Dates_key, Dates_timestamp, Dates_zone } from "./dates";
import { Rotation_roles } from "./rotationIdentity";

const dateKey = v.pipe(
  v.string(),
  v.check((s) => Dates_day(s) != null)
);
export const VTrainingDate = v.pipe(
  v.object({
    date: v.optional(dateKey),
    source: v.picklist(["start_time", "training_date", "override", "legacy_date_only"]),
    timeZone: v.string(),
    rolloverMinutes: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1439)),
    legacyCivilDate: v.optional(dateKey),
  }),
  v.check((a) => (a.source === "legacy_date_only" ? a.date == null : a.date != null))
);
export type ITrainingDate = v.InferOutput<typeof VTrainingDate>;
export interface ITrainingConfig {
  timeZone: string;
  rolloverMinutes: number;
}

export function TrainingDate_rolloverLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${((hour + 11) % 12) + 1}:${`${minutes % 60}`.padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function TrainingDate_config(
  settings: ISettings,
  programId?: string,
  personalFallback = false
): ITrainingConfig {
  const schedule = programId ? settings.devfitSchedules?.[programId] : undefined;
  return TrainingDate_scheduleConfig(
    schedule ?? (personalFallback ? { cycleDays: 14, days: [], personalRotation: true } : undefined)
  );
}

export function TrainingDate_scheduleConfig(schedule?: IDevFitSchedule): ITrainingConfig {
  return {
    timeZone: Dates_zone(schedule?.homeTimeZone ?? (schedule?.personalRotation ? "America/Edmonton" : undefined)),
    rolloverMinutes: schedule?.trainingDayRolloverMinutes ?? (schedule?.personalRotation ? 900 : 0),
  };
}

export function TrainingDate_key(timestamp: number, timeZone: string, rolloverMinutes = 0): string {
  const civil = Dates_key(timestamp, timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: Dates_zone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute < rolloverMinutes ? Dates_add(civil, -1) : civil;
}

export function TrainingDate_bounds(
  date: string,
  timeZone: string,
  rolloverMinutes = 0
): { start: number; end: number } {
  const clock = `${`${Math.floor(rolloverMinutes / 60)}`.padStart(2, "0")}:${`${rolloverMinutes % 60}`.padStart(2, "0")}`;
  return { start: Dates_timestamp(date, timeZone, clock), end: Dates_timestamp(Dates_add(date, 1), timeZone, clock) };
}

export function TrainingDate_start(timestamp: number, config: ITrainingConfig): ITrainingDate {
  return {
    timeZone: config.timeZone,
    rolloverMinutes: config.rolloverMinutes,
    date: TrainingDate_key(timestamp, config.timeZone, config.rolloverMinutes),
    source: "start_time",
  };
}

export function TrainingDate_record(record: IHistoryRecord, config?: ITrainingConfig): string | undefined {
  if (record.devfitTrainingDate) {
    return record.devfitTrainingDate.date;
  }
  const manual = record.source === "devfit_manual" ? record.entries[0]?.sets[0]?.devfitCardio : undefined;
  if (manual?.datePrecision === "date") {
    return undefined;
  }
  const zone = config?.timeZone ?? manual?.timeZone ?? Dates_zone();
  return TrainingDate_key(record.startTime, zone, config?.rolloverMinutes ?? 0);
}

export function TrainingDate_changedStart(record: IHistoryRecord, timestamp: number): ITrainingDate | undefined {
  const assignment = record.devfitTrainingDate;
  return assignment?.source === "start_time" ? TrainingDate_start(timestamp, assignment) : assignment;
}

export function TrainingDate_assign(record: IHistoryRecord, date: string, config: ITrainingConfig): IHistoryRecord {
  const assignment = v.parse(VTrainingDate, { ...config, date, source: "override" });
  return { ...record, devfitTrainingDate: assignment };
}

export function TrainingDate_migrate(storage: IStorage): IStorage {
  const schedules = Object.fromEntries(
    Object.entries(storage.settings.devfitSchedules ?? {}).map(([id, s]) => {
      const personal =
        s.personalRotation ||
        (s.cycleDays === 14 && TrainingDate_personalProgram(storage.programs.find((p) => p.id === id)));
      return [
        id,
        {
          ...s,
          personalRotation: personal,
          trainingDayRolloverMinutes: s.trainingDayRolloverMinutes ?? (personal ? 900 : 0),
        },
      ];
    })
  );
  const settings = { ...storage.settings, devfitSchedules: schedules };
  const assign = (record: IHistoryRecord): IHistoryRecord => {
    if (record.devfitTrainingDate || !Number.isFinite(record.startTime)) {
      return record;
    }
    const manual = record.source === "devfit_manual" ? record.entries[0]?.sets[0]?.devfitCardio : undefined;
    const programId = manual
      ? (record.devfitScheduleCredit?.programId ??
        storage.currentProgramId ??
        (storage.programs.length === 1 ? storage.programs[0].id : undefined))
      : (record.catchUpFor ?? record.programId);
    const program = storage.programs.find((p) => p.id === programId);
    const personal = TrainingDate_personalProgram(program);
    const config = TrainingDate_config(settings, programId, personal);
    if (!programId && manual?.timeZone) {
      config.timeZone = manual.timeZone;
    }
    const attribution: ITrainingDate =
      manual?.datePrecision === "date"
        ? {
            source: "legacy_date_only",
            legacyCivilDate: manual.performedLocalDate,
            timeZone: manual.timeZone ?? config.timeZone,
            rolloverMinutes: config.rolloverMinutes,
          }
        : TrainingDate_start(record.startTime, config);
    return { ...record, devfitTrainingDate: attribution };
  };
  return { ...storage, settings, history: storage.history.map(assign), progress: storage.progress.map(assign) };
}

export function TrainingDate_personalProgram(program: IProgram | undefined): boolean {
  const days = program?.planner?.weeks.flatMap((w) => w.days) ?? program?.days ?? [];
  return !!Rotation_roles(days.map((d, i) => ({ day: i + 1, name: d.name })));
}
