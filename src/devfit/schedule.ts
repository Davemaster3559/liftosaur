import { IDevFitSchedule, IHistoryRecord, ISettings } from "../types";
import { IEvaluatedProgram, Program_getListOfDays, Program_getProgramDay } from "../models/program";
import { Session_day } from "./presentation";

export function Schedule_dateKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Use local calendar dates, not elapsed milliseconds, so DST does not shift a cycle day.
export function Schedule_dayNumber(anchor: string | undefined, days: number, now: number): number | undefined {
  if (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    return undefined;
  }
  const [year, month, day] = anchor.split("-").map(Number);
  const d = new Date(now);
  const delta = Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(year, month - 1, day)) / 86400000
  );
  return (((delta % days) + days) % days) + 1;
}

export function Schedule_default(program: IEvaluatedProgram): IDevFitSchedule {
  const list = Program_getListOfDays(program);
  const cycleDays = Math.min(60, Math.max(14, list.length));
  return {
    cycleDays,
    days: list.map(([id, name], index) => {
      const explicit = name.match(/\bday\s*(\d+)\b/i)?.[1];
      return { day: explicit ? Math.min(cycleDays, Math.max(1, Number(explicit))) : index + 1, programDay: Number(id) };
    }),
  };
}

export function Schedule_get(program: IEvaluatedProgram, settings: ISettings): IDevFitSchedule {
  return settings.devfitSchedules?.[program.id] ?? Schedule_default(program);
}

export function Schedule_slots(
  program: IEvaluatedProgram,
  settings: ISettings,
  history: IHistoryRecord[],
  now: number
): {
  day: number;
  programDay?: number;
  context?: "work" | "off";
  session?: ReturnType<typeof Session_day>;
  date?: Date;
  completed: boolean;
  isToday: boolean;
  isNext: boolean;
}[] {
  const config = Schedule_get(program, settings);
  const today = Schedule_dayNumber(config.anchorDate, config.cycleDays, now);
  const cycleStart = new Date(now);
  cycleStart.setHours(0, 0, 0, 0);
  if (today != null) {
    cycleStart.setDate(cycleStart.getDate() - today + 1);
  }
  return Array.from({ length: config.cycleDays }, (_, index) => {
    const day = index + 1;
    const slot = config.days.find((s) => s.day === day);
    const programDay = slot?.programDay != null ? Program_getProgramDay(program, slot.programDay) : undefined;
    const session = programDay ? Session_day(programDay, settings) : undefined;
    const date = today == null ? undefined : new Date(cycleStart);
    date?.setDate(cycleStart.getDate() + index);
    const completed =
      date == null || slot?.programDay == null
        ? false
        : history.some(
            (r) =>
              r.programId === program.id &&
              r.day === slot.programDay &&
              Schedule_dateKey(r.startTime) === Schedule_dateKey(date.getTime())
          );
    return {
      day,
      programDay: slot?.programDay,
      context: slot?.context,
      session,
      date,
      completed,
      isToday: today === day,
      isNext: slot?.programDay === program.nextDay,
    };
  });
}

export function Schedule_assign(
  config: IDevFitSchedule,
  day: number,
  patch: Partial<IDevFitSchedule["days"][number]>
): IDevFitSchedule {
  const old = config.days.find((s) => s.day === day);
  return {
    ...config,
    days: [...config.days.filter((s) => s.day !== day), { ...old, day, ...patch }].sort((a, b) => a.day - b.day),
  };
}
