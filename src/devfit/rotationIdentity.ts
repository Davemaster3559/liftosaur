export function Rotation_role(text: string): string | undefined {
  const pair = text.match(/\b(upper|lower|run)[ _-]*([ab])\d*\b/i);
  return pair ? `${pair[1].toLowerCase()}_${pair[2].toLowerCase()}` : /endurance/i.test(text) ? "endurance" : undefined;
}

export function Rotation_roles(
  days: { day: number; name: string; details?: string }[]
): Map<string, number[]> | undefined {
  const roles = new Map<string, number[]>();
  for (const day of days) {
    const identity = Rotation_role(day.name) ?? Rotation_role(day.details ?? "");
    if (identity) {
      roles.set(identity, [...(roles.get(identity) ?? []), day.day]);
    }
  }
  return ["run_a", "run_b", "upper_a", "lower_a", "upper_b", "lower_b", "endurance"].every((role) => roles.has(role))
    ? roles
    : undefined;
}
