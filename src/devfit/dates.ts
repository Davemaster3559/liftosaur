export function Dates_zone(zone?: string): string {
  const candidate = zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return "UTC";
  }
}

export function Dates_key(time: number, zone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: Dates_zone(zone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(time);
  const value = (type: string): string => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function Dates_day(key?: string): number | undefined {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return undefined;
  }
  const [y, m, d] = key.split("-").map(Number);
  const stamp = Date.UTC(y, m - 1, d);
  return new Date(stamp).toISOString().slice(0, 10) === key ? stamp / 86400000 : undefined;
}

export function Dates_add(key: string, days: number): string {
  return new Date((Dates_day(key)! + days) * 86400000).toISOString().slice(0, 10);
}

export function Dates_timestamp(key: string, zone?: string, time = "12:00"): number {
  const [hour, minute] = time.split(":").map(Number);
  const target = Dates_day(key)! * 86400000 + (hour * 60 + minute) * 60000;
  let result = target;
  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: Dates_zone(zone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(result);
    const n = (type: string): number => Number(parts.find((p) => p.type === type)!.value);
    const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
    const correction = target - local;
    if (!correction) {
      break;
    }
    result += correction;
  }
  return result;
}

export function Dates_label(key: string): string {
  return new Date(Dates_day(key)! * 86400000).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Dates_validTime(date: string, time: string, zone: string): boolean {
  if (Dates_day(date) == null || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return false;
  }
  const stamp = Dates_timestamp(date, zone, time);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: Dates_zone(zone),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(stamp);
  const actualTime = `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
  return Dates_key(stamp, zone) === date && actualTime === time;
}
