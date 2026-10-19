import { IDevFitSchedule, IHistoryRecord, ISettings } from "../types";
import { IEvaluatedProgram, Program_getListOfDays, Program_getProgramDay } from "../models/program";
import { Session_day } from "./presentation";
import { Dates_add, Dates_day, Dates_key, Dates_timestamp, Dates_zone } from "./dates";
import { Cardio_recordDate } from "./cardio";
import { IScheduleCredit } from "./cardioSchema";

export const DEVFIT_WORK_STEPS_DAYS = [2, 7, 11] as const;
const personalSlots = [
  "run_a",
  "recovery",
  "upper_a",
  "lower_a",
  "endurance",
  "run_b",
  "recovery",
  "upper_b",
  "lower_b",
  "run_a",
  "recovery",
  "run_b",
  "upper_a",
  "lower_a",
];
const workDays = new Set([1, 2, 6, 7, 10, 11, 12]);

export function Schedule_dateKey(now: number, zone?: string): string {
  return Dates_key(now, zone);
}

export function Schedule_dayNumber(
  anchor: string | undefined,
  days: number,
  now: number,
  zone?: string
): number | undefined {
  const start = Dates_day(anchor);
  if (start == null || days < 1 || !Number.isInteger(days)) {
    return undefined;
  }
  return ((((Dates_day(Dates_key(now, zone))! - start) % days) + days) % days) + 1;
}

function role(text: string): string | undefined {
  const pair = text.match(/\b(upper|lower|run)[ _-]*([ab])\d*\b/i);
  return pair ? `${pair[1].toLowerCase()}_${pair[2].toLowerCase()}` : /endurance/i.test(text) ? "endurance" : undefined;
}

function personalDays(program: IEvaluatedProgram): Map<string, number[]> | undefined {
  const roles = new Map<string, number[]>();
  for (const [id, name] of Program_getListOfDays(program)) {
    const day = Program_getProgramDay(program, Number(id));
    const identity = role(name) ?? role(day?.exercises.map((e) => e.label || e.name).join(" ") ?? "");
    if (identity) {
      roles.set(identity, [...(roles.get(identity) ?? []), Number(id)]);
    }
  }
  return ["run_a", "run_b", "upper_a", "lower_a", "upper_b", "lower_b", "endurance"].every((r) => roles.has(r))
    ? roles
    : undefined;
}

export function Schedule_default(program: IEvaluatedProgram): IDevFitSchedule {
  const roles = personalDays(program);
  const occurrences = new Map<string, number>();
  if (roles) {
    return {
      cycleDays: 14,
      anchorDate: "2026-10-07",
      homeTimeZone: "America/Edmonton",
      referenceSource: "personal_oct7",
      personalRotation: true,
      days: personalSlots.map((r, i) => {
        const occurrence = occurrences.get(r) ?? 0;
        occurrences.set(r, occurrence + 1);
        const choices = roles.get(r);
        return {
          day: i + 1,
          programDay: choices?.[occurrence % choices.length],
          context: workDays.has(i + 1) ? "work" : "off",
        };
      }),
    };
  }
  const list = Program_getListOfDays(program);
  const cycleDays = Math.min(60, Math.max(14, list.length));
  const reserved = /rotation|continental|14[ -]?day/i.test(program.name)
    ? new Set<number>(DEVFIT_WORK_STEPS_DAYS)
    : new Set<number>();
  const available = Array.from({ length: cycleDays }, (_, i) => i + 1).filter((d) => !reserved.has(d));
  const days = list.map(([id, name], i) => ({
    day: Math.min(cycleDays, Math.max(1, Number(name.match(/\bday\s*(\d+)\b/i)?.[1] ?? available[i] ?? i + 1))),
    programDay: Number(id),
  }));
  return {
    cycleDays,
    homeTimeZone: Dates_zone(),
    days: [
      ...days,
      ...Array.from(reserved)
        .filter((d) => !days.some((s) => s.day === d))
        .map((day) => ({ day, context: "work" as const })),
    ].sort((a, b) => a.day - b.day),
  };
}

export function Schedule_get(program: IEvaluatedProgram, settings: ISettings): IDevFitSchedule {
  const saved = settings.devfitSchedules?.[program.id];
  if (!saved) {
    return Schedule_default(program);
  }
  const personal = saved.personalRotation || !!personalDays(program);
  return personal && saved.cycleDays === 14 && !saved.referenceSource
    ? {
        ...saved,
        personalRotation: true,
        anchorDate: "2026-10-07",
        homeTimeZone: "America/Edmonton",
        referenceSource: "personal_oct7",
      }
    : { ...saved, homeTimeZone: saved.homeTimeZone || Dates_zone() };
}

export function Schedule_suggestion(
  program: IEvaluatedProgram,
  settings: ISettings,
  history: IHistoryRecord[],
  now: number
): { day: number; confidence: "low" | "moderate"; explanation: string } {
  const config = Schedule_get(program, settings);
  const records = history.filter(
    (r) => r.programId === program.id && r.entries.some((e) => e.sets.some((s) => s.isCompleted))
  );
  const candidates = Array.from({ length: config.cycleDays }, (_, index) => {
    const day = index + 1;
    const anchor = Dates_add(Dates_key(now, config.homeTimeZone), 1 - day);
    let score = 0;
    for (const r of records) {
      const performed = Schedule_dayNumber(
        anchor,
        config.cycleDays,
        Dates_timestamp(Cardio_recordDate(r, config.homeTimeZone), config.homeTimeZone),
        config.homeTimeZone
      )!;
      if (
        [0, 1, 2].some(
          (delay) =>
            config.days.find((s) => s.day === ((performed - delay - 1 + config.cycleDays) % config.cycleDays) + 1)
              ?.programDay === r.day
        )
      ) {
        score += 1;
      }
    }
    return { day, score };
  }).sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const unique = best.score >= 3 && candidates[1]?.score < best.score;
  return {
    day: best.score ? best.day : 1,
    confidence: unique ? "moderate" : "low",
    explanation: unique
      ? "Several dated sessions fit this phase, allowing short delays. Confirm once to follow the calendar."
      : "Your history allows several phases. Choose today's rotation day once; missed workouts will never shift it.",
  };
}

export function Schedule_creditValid(
  credit: IScheduleCredit,
  program: IEvaluatedProgram,
  config: IDevFitSchedule
): boolean {
  return (
    credit.programId === program.id &&
    credit.rotationDay ===
      Schedule_dayNumber(
        config.anchorDate,
        config.cycleDays,
        Dates_timestamp(credit.scheduledDate, config.homeTimeZone),
        config.homeTimeZone
      ) &&
    config.days.find((s) => s.day === credit.rotationDay)?.programDay === credit.programDay
  );
}

function completedForSlot(
  program: IEvaluatedProgram,
  config: IDevFitSchedule,
  day: number,
  date: string,
  history: IHistoryRecord[],
  now: number
): IHistoryRecord | undefined {
  const slot = config.days.find((s) => s.day === day);
  if (slot?.programDay == null) {
    return undefined;
  }
  const planned = Program_getProgramDay(program, slot.programDay);
  const expectedRun =
    role(planned?.name ?? "") ?? role(planned?.exercises.map((e) => e.label || e.name).join(" ") ?? "");
  return history.find((r) => {
    if (
      !r.entries.some((e) => e.sets.some((s) => s.isCompleted)) ||
      Cardio_recordDate(r, config.homeTimeZone) > Dates_key(now, config.homeTimeZone)
    ) {
      return false;
    }
    const link = r.devfitScheduleCredit;
    if (link) {
      return (
        Schedule_creditValid(link, program, config) &&
        link.scheduledDate === date &&
        link.rotationDay === day &&
        link.programDay === slot.programDay
      );
    }
    if (Cardio_recordDate(r, config.homeTimeZone) !== date) {
      return false;
    }
    if (r.programId === program.id && r.day === slot.programDay) {
      return true;
    }
    return (
      (expectedRun === "run_a" || expectedRun === "run_b") &&
      r.source === "devfit_manual" &&
      r.entries.some((e) => e.sets.some((s) => s.isCompleted && s.devfitCardio?.runPlan === expectedRun))
    );
  });
}

export interface IRotationSlot {
  day: number;
  programDay?: number;
  context?: "work" | "off";
  isWorkSteps: boolean;
  session?: ReturnType<typeof Session_day>;
  dateKey?: string;
  date?: Date;
  completed: boolean;
  completedLate: boolean;
  performed: IHistoryRecord[];
  mismatched: IHistoryRecord[];
  isToday: boolean;
  isNext: boolean;
  missed: boolean;
}

export function Schedule_slots(
  program: IEvaluatedProgram,
  settings: ISettings,
  history: IHistoryRecord[],
  now: number
): IRotationSlot[] {
  const config = Schedule_get(program, settings);
  const todayKey = Dates_key(now, config.homeTimeZone);
  const today = Schedule_dayNumber(config.anchorDate, config.cycleDays, now, config.homeTimeZone);
  const start = Dates_add(todayKey, 1 - (today ?? 1));
  return Array.from({ length: config.cycleDays }, (_, index) => {
    const day = index + 1;
    const slot = config.days.find((s) => s.day === day);
    const planned = slot?.programDay != null ? Program_getProgramDay(program, slot.programDay) : undefined;
    const session = planned ? Session_day(planned, settings) : undefined;
    const dateKey = today == null ? undefined : Dates_add(start, index);
    const completed = dateKey ? completedForSlot(program, config, day, dateKey, history, now) : undefined;
    const performed = dateKey
      ? history.filter(
          (r) =>
            Cardio_recordDate(r, config.homeTimeZone) === dateKey &&
            r.entries.some((e) => e.sets.some((s) => s.isCompleted))
        )
      : [];
    return {
      day,
      programDay: slot?.programDay,
      context: slot?.context,
      isWorkSteps: !session && slot?.context === "work",
      session,
      dateKey,
      date: dateKey ? new Date(Dates_timestamp(dateKey, config.homeTimeZone)) : undefined,
      completed: !!completed,
      completedLate: !!completed && Cardio_recordDate(completed, config.homeTimeZone) !== dateKey,
      performed,
      mismatched: performed.filter((r) => r.id !== completed?.id),
      isToday: day === today,
      isNext: slot?.programDay === program.nextDay,
      missed: !!dateKey && dateKey < todayKey && !!session && session.kind !== "recovery" && !completed,
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
  if (Dates_day(config.anchorDate) == null) {
    return [];
  }
  const today = Dates_key(now, config.homeTimeZone);
  const elapsed = Dates_day(today)! - Dates_day(config.anchorDate)!;
  const result: IMissedSession[] = [];
  for (let ago = 1; ago <= Math.min(elapsed, config.cycleDays * 2); ago += 1) {
    const date = Dates_add(today, -ago);
    const day = Schedule_dayNumber(
      config.anchorDate,
      config.cycleDays,
      Dates_timestamp(date, config.homeTimeZone),
      config.homeTimeZone
    )!;
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
    result.push({ day, programDay: slot.programDay, name: planned.name, date, daysAgo: ago, kind: session.kind, area });
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
  slots: IRotationSlot[];
  today?: IRotationSlot;
  selectedDay?: number;
  missed: IMissedSession[];
  mismatch: boolean;
  recovery: boolean;
  canCatchUp: boolean;
  setupNeeded: boolean;
  next?: IRotationSlot;
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
  const pending = missed.filter(
    (m) =>
      !history.some(
        (r) =>
          r.catchUpFor === program.id &&
          Cardio_recordDate(r, config.homeTimeZone) >= m.date &&
          r.entries.some((e) => e.sets.some((s) => s.isCompleted))
      )
  );
  const areas = new Set(pending.map((m) => m.area));
  const nextSlots = today ? [...slots.slice(today.day), ...slots.slice(0, today.day)] : slots;
  return {
    config,
    slots,
    today,
    selectedDay,
    missed,
    mismatch: selectedDay != null && selectedDay !== program.nextDay && !today?.completed,
    recovery: !!today && (!today.session || today.session.kind === "recovery"),
    canCatchUp:
      today?.context === "off" &&
      !!today.session &&
      today.session.kind !== "recovery" &&
      areas.has("upper") &&
      areas.has("lower"),
    setupNeeded: !config.anchorDate && !config.setupDismissed && config.cycleDays === 14,
    next: nextSlots.find((s) => s.session && s.session.kind !== "recovery"),
  };
}

export function Schedule_assign(
  config: IDevFitSchedule,
  day: number,
  patch: Partial<IDevFitSchedule["days"][number]>
): IDevFitSchedule {
  return {
    ...config,
    days: [
      ...config.days.filter((s) => s.day !== day),
      { ...config.days.find((s) => s.day === day), day, ...patch },
    ].sort((a, b) => a.day - b.day),
  };
}

export function Schedule_anchor(config: IDevFitSchedule, selectedDay: number, now: number): IDevFitSchedule {
  return {
    ...config,
    anchorDate: Dates_add(Dates_key(now, config.homeTimeZone), 1 - selectedDay),
    homeTimeZone: config.homeTimeZone || Dates_zone(),
    referenceSource: "confirmed",
    setupDismissed: undefined,
  };
}
