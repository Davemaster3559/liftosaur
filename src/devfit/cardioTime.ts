export function CardioTime_parse(value: string): number | undefined {
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  if (!text.includes(":")) {
    const minutes = Number(text);
    return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes * 60) : undefined;
  }
  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) {
    return undefined;
  }
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n >= 60)) {
    return undefined;
  }
  return numbers.reduce((seconds, n) => seconds * 60 + n, 0);
}

export function CardioTime_format(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, "0")}`;
}
