import type { IPlannerProgram } from "../types";

export function PlannerIds_preserve(before: IPlannerProgram | undefined, after: IPlannerProgram): IPlannerProgram {
  after.weeks.forEach((week, i) => {
    week.id = before?.weeks[i]?.id;
    week.days.forEach((day, j) => {
      day.id = before?.weeks[i]?.days[j]?.id;
    });
  });
  return after;
}
