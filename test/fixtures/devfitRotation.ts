import { PlannerTestUtils_get } from "../utils/plannerTestUtils";
import { IDevFitSchedule, IProgram } from "../../src/types";

// Example data only, used by tests and the isolated browser preview. Never installed into user storage.
export function DevFitRotation_fixture(): { program: IProgram; schedule: IDevFitSchedule } {
  const { program } = PlannerTestUtils_get(`# Week 1
## Run A
runA: Cycling / 1x1 1800s|0s
## Upper A
Bench Press / 3x8-12 100lb / progress: dp(5lb, 8, 12)
Lat Pulldown / 3x10 80lb
Seated Row / 3x10 70lb
Overhead Press / 3x8 45lb
Face Pull / 3x12 30lb
Lateral Raise / 3x12 15lb
Triceps Pushdown / 3x12 30lb
Bicep Curl / 3x12 20lb
elliptical: Elliptical Machine / 1x1 1200s|0s
## Lower A
Leg Press / 3x10 180lb / progress: lp(10lb)
Leg Curl / 3x10 60lb
Leg Extension / 3x12 60lb
Hip Thrust / 3x10 100lb
Standing Calf Raise / 3x12 80lb
Crunch / 3x15
bike: Cycling / 1x1 900s|0s
## Endurance
endurance: Elliptical Machine / 1x1 2400s|0s
## Run B
runB: Cycling / 6x1 120s|60s auto
## Upper B
upperB: Bench Press / 3x8 95lb / progress: lp(5lb)
Seated Row / 3x10 70lb
elliptical: Elliptical Machine / 1x1 1200s|0s
## Lower B
Leg Press / 3x10 180lb
Leg Curl / 3x10 60lb
bikeStairs: Cycling / 1x1 600s|0s
`);
  program.id = "devfit-rotation-fixture";
  program.name = "Continental rotation";
  program.nextDay = 2;
  const schedule: IDevFitSchedule = {
    cycleDays: 14,
    anchorDate: "2026-10-05",
    days: [
      { day: 1, programDay: 1, context: "work" },
      { day: 2, context: "work" },
      { day: 3, programDay: 2, context: "off" },
      { day: 4, programDay: 3, context: "off" },
      { day: 6, programDay: 4 },
      { day: 8, programDay: 5, context: "work" },
      { day: 10, programDay: 6, context: "off" },
      { day: 11, programDay: 7, context: "off" },
    ],
  };
  return { program, schedule };
}
