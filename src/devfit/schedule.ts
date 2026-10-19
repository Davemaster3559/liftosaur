import { IDevFitSchedule, IHistoryRecord, ISettings } from "../types";
import { IEvaluatedProgram, Program_getListOfDays, Program_getProgramDay } from "../models/program";
import { Session_day } from "./presentation";

export const DEVFIT_WORK_STEPS_DAYS = [2, 7, 11] as const;

export function Schedule_dateKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function anchorDate(anchor: string | undefined): Date | undefined {
  if (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    return undefined;
  }
  const [year, month, day] = anchor.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return Schedule_dateKey(date.getTime()) === anchor ? date : undefined;
}

export function Schedule_dayNumber(anchor: string | undefined, days: number, now: number): number | undefined {
  const date = anchorDate(anchor);
  if (!date || days < 1 || !Number.isFinite(days)) {
    return undefined;
  }
  const delta = calendarDay(new Date(now)) - calendarDay(date);
  return (((delta % days) + days) % days) + 1;
}

export function Schedule_default(program: IEvaluatedProgram): IDevFitSchedule {
  const list = Program_getListOfDays(program);
  const cycleDays = Math.min(60, Math.max(14, list.length));
  const rotation = cycleDays === 14 && /rotation|continental|14[ -]?day/i.test(program.name);
  const reserved = new Set<number>(rotation ? DEVFIT_WORK_STEPS_DAYS : []);
  const available = Array.from({ length: cycleDays }, (_, i) => i + 1).filter((d) => !reserved.has(d));
  const assigned = list.map(([id, name], index) => ({
    day: Math.min(cycleDays, Math.max(1, Number(name.match(/\bday\s*(\d+)\b/i)?.[1] ?? available[index] ?? index + 1))),
    programDay: Number(id),
  }));
  return {
    cycleDays,
    days: [
      ...assigned,
      ...Array.from(reserved)
        .filter((d) => !assigned.some((s) => s.day === d))
        .map((day) => ({ day, context: "work" as const })),
    ].sort((a, b) => a.day - b.day),
  };
}

export function Schedule_get(program: IEvaluatedProgram, settings: ISettings): IDevFitSchedule {
  return settings.devfitSchedules?.[program.id] ?? Schedule_default(program);
}

function completedForSlot(
  program: IEvaluatedProgram,
  config: IDevFitSchedule,
  day: number,
  date: Date,
  history: IHistoryRecord[],
  now: number
): IHistoryRecord | undefined {
  const slot = config.days.find((s) => s.day === day);
  if (slot?.programDay == null) {
    return undefined;
  }
  let repeat = config.cycleDays;
  for (let offset = 1; offset < config.cycleDays; offset += 1) {
    if (
      config.days.find((s) => s.day === ((day - 1 + offset) % config.cycleDays) + 1)?.programDay === slot.programDay
    ) {
      repeat = offset;
      break;
    }
  }
  const start = calendarDay(date);
  const end = start + repeat;
  return history.find(
    (r) =>
      r.programId === program.id &&
      r.day === slot.programDay &&
      r.startTime <= now &&
      calendarDay(new Date(r.startTime)) >= start &&
      calendarDay(new Date(r.startTime)) < end &&
      r.entries.some((e) => e.sets.some((s) => s.isCompleted))
  );
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
  isWorkSteps: boolean;
  session?: ReturnType<typeof Session_day>;
  date?: Date;
  completed: boolean;
  completedLate: boolean;
  isToday: boolean;
  isNext: boolean;
  missed: boolean;
}[] {
  const config = Schedule_get(program, settings);
  const today = Schedule_dayNumber(config.anchorDate, config.cycleDays, now);
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  if (today != null) {
    start.setDate(start.getDate() - today + 1);
  }
  return Array.from({ length: config.cycleDays }, (_, index) => {
    const day = index + 1;
    const slot = config.days.find((s) => s.day === day);
    const programDay = slot?.programDay != null ? Program_getProgramDay(program, slot.programDay) : undefined;
    const session = programDay ? Session_day(programDay, settings) : undefined;
    const date = today == null ? undefined : new Date(start);
    date?.setDate(start.getDate() + index);
    const completed = date ? completedForSlot(program, config, day, date, history, now) : undefined;
    return {
      day,
      programDay: slot?.programDay,
      context: slot?.context,
      isWorkSteps: !session && slot?.context === "work",
      session,
      date,
      completed: !!completed,
      completedLate:
        !!completed && !!date && Schedule_dateKey(completed.startTime) !== Schedule_dateKey(date.getTime()),
      isToday: day === today,
      isNext: slot?.programDay === program.nextDay,
      missed:
        !!date &&
        calendarDay(date) < calendarDay(new Date(now)) &&
        !!session &&
        session.kind !== "recovery" &&
        !completed,
    };
  });
}

export interface IMissedSession {
  day: number;
  programDay: number;
  name: string;
  date: string;
  daysAgo: number;
  kind: ReturnType<typeof Session_day>["kind"];
  area: "upper" | "lower" | "strength" | "cardio";
}

export function Schedule_missedSessions(
  program: IEvaluatedProgram,
  settings: ISettings,
  history: IHistoryRecord[],
  now: number
): IMissedSession[] {
  const config = Schedule_get(program, settings);
  const anchor = anchorDate(config.anchorDate);
  if (!anchor) {
    return [];
  }
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const elapsed = calendarDay(today) - calendarDay(anchor);
  const result: IMissedSession[] = [];
  for (let ago = 1; ago <= Math.min(elapsed, config.cycleDays * 2); ago += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - ago);
    const day = Schedule_dayNumber(config.anchorDate, config.cycleDays, date.getTime())!;
    const slot = config.days.find((s) => s.day === day);
    const planned = slot?.programDay != null ? Program_getProgramDay(program, slot.programDay) : undefined;
    if (!planned || slot?.programDay == null) {
      continue;
    }
    const session = Session_day(planned, settings);
    if (session.kind === "recovery" || completedForSlot(program, config, day, date, history, now)) {
      continue;
    }
    const strength = session.kind === "strength" || session.kind === "mixed";
    const area = !strength
      ? "cardio"
      : /upper/i.test(planned.name)
        ? "upper"
        : /lower/i.test(planned.name)
          ? "lower"
          : "strength";
    result.push({
      day,
      programDay: slot.programDay,
      name: planned.name,
      date: Schedule_dateKey(date.getTime()),
      daysAgo: ago,
      kind: session.kind,
      area,
    });
  }
  return result;
}

export function Schedule_overview(
  program: IEvaluatedProgram,
  settings: ISettings,
  history: IHistoryRecord[],
  now: number
): {
  config: IDevFitSchedule;
  slots: ReturnType<typeof Schedule_slots>;
  today?: ReturnType<typeof Schedule_slots>[number];
  selectedDay?: number;
  mismatch: boolean;
  missed: IMissedSession[];
  canCatchUp: boolean;
  setupNeeded: boolean;
  recovery: boolean;
  next?: ReturnType<typeof Schedule_slots>[number];
} {
  const config = Schedule_get(program, settings);
  const slots = Schedule_slots(program, settings, history, now);
  const today = slots.find((s) => s.isToday);
  const selectedDay = today
    ? today.session && today.session.kind !== "recovery"
      ? today.programDay
      : undefined
    : program.nextDay;
  const missed = Schedule_missedSessions(program, settings, history, now);
  const pendingStrength = missed.filter(
    (m) =>
      !history.some(
        (r) =>
          r.catchUpFor === program.id &&
          Schedule_dateKey(r.startTime) >= m.date &&
          r.entries.some((e) => e.sets.some((s) => s.isCompleted))
      )
  );
  const areas = new Set(pendingStrength.map((m) => m.area));
  const offTrainingDay = today?.context === "off" && !!today.session && today.session.kind !== "recovery";
  const nextSlots = today ? [...slots.slice(today.day), ...slots.slice(0, today.day)] : slots;
  return {
    config,
    slots,
    today,
    selectedDay,
    missed,
    mismatch: selectedDay != null && selectedDay !== program.nextDay && !today?.completed,
    recovery: !!today && (!today.session || today.session.kind === "recovery"),
    canCatchUp: offTrainingDay && areas.has("upper") && areas.has("lower"),
    setupNeeded:
      !config.anchorDate &&
      !config.setupDismissed &&
      (settings.devfitSchedules?.[program.id]?.cycleDays === 14 ||
        /rotation|continental|14[ -]?day/i.test(program.name) ||
        Program_getListOfDays(program).length === 14),
    next: nextSlots.find((s) => s.session && s.session.kind !== "recovery"),
  };
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

export function Schedule_anchor(config: IDevFitSchedule, selectedDay: number, now: number): IDevFitSchedule {
  const date = new Date(now);
  date.setDate(date.getDate() - selectedDay + 1);
  return { ...config, anchorDate: Schedule_dateKey(date.getTime()), setupDismissed: undefined };
}
