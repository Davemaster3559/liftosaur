import { PlannerTestUtils_get } from "../utils/plannerTestUtils";
import { IDevFitSchedule, IProgram } from "../../src/types";

export function DevFitPersonalPlan_fixture(): { program: IProgram; schedule: IDevFitSchedule } {
  const upper = (
    incline: boolean
  ): string => `${incline ? "Incline Bench Press" : "Chest Press"}, Leverage Machine / 3x11 80lb / progress: dp(5lb, 8, 12)
${incline ? "Seated Row / 3x10 70lb\nLat Pulldown / 3x10 80lb" : "Lat Pulldown / 3x10 80lb\nSeated Row / 3x10 70lb"}
Shoulder Press, Leverage Machine / 2x10 45lb
Reverse Fly, Leverage Machine / 2x12 30lb
Lateral Raise, Leverage Machine / 2x12 30lb
Triceps Pushdown / 2x12 30lb
Bicep Curl, Cable / 2x12 20lb
Cardio: Elliptical Machine / 1x1 1200s|0s`;
  const lower = (
    hipFirst: boolean
  ): string => `${hipFirst ? "Hip Thrust / 3x10 100lb\nLeg Press / 3x10 180lb / progress: lp(10lb)" : "Leg Press / 3x10 180lb / progress: lp(10lb)"}
Seated Leg Curl / 3x10 60lb
Leg Extension / 2x12 60lb
${hipFirst ? "" : "Hip Thrust / 3x10 100lb\n"}Standing Calf Raise, Leverage Machine / 3x12 80lb
Crunch, Leverage Machine / 2x15 50lb
Cardio: Elliptical Machine / 1x1 900s|0s`;
  const { program } = PlannerTestUtils_get(`# Week 1
## Run A
runA: Cycling / 1x1 1800s|0s
## Upper A
${upper(false)}
## Lower A
${lower(false)}
## Endurance
Cardio: Elliptical Machine / 1x1 2400s|0s
## Run B
runB: Cycling / 1x1 1800s|0s
# Week 2
## Upper B
${upper(true)}
## Lower B
${lower(true)}
## Run A2
runA: Cycling / 1x1 1800s|0s
## Run B2
runB: Cycling / 1x1 1800s|0s
## Upper A2
${upper(false)}
## Lower A2
${lower(false)}
`);
  program.id = "devfit-personal-anonymous";
  program.name = "Continental rotation";
  const trainingDays = [1, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14];
  const work = new Set([1, 2, 6, 7, 10, 11, 12]);
  return {
    program,
    schedule: {
      cycleDays: 14,
      anchorDate: "2026-10-07",
      homeTimeZone: "America/Edmonton",
      trainingDayRolloverMinutes: 900,
      referenceSource: "confirmed",
      personalRotation: true,
      days: Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        programDay: trainingDays.includes(i + 1) ? trainingDays.indexOf(i + 1) + 1 : undefined,
        context: work.has(i + 1) ? "work" : "off",
      })),
    },
  };
}
