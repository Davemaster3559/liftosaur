import { PlannerTestUtils_get } from "../utils/plannerTestUtils";
import { IDevFitSchedule, IProgram } from "../../src/types";

// Example data only, used by tests and the isolated browser preview. Never installed into user storage.
export function DevFitRotation_fixture(): { program: IProgram; schedule: IDevFitSchedule } {
  const { program } = PlannerTestUtils_get(`# Week 1
## Run A
// Warm-up: 5 min easy walk. Main Target: Jog and walk to finish 30 min. Progression: Complete the continuous target twice comfortably before increasing.
runA: Cycling / 1x1 1800s|0s
## Upper A
Bench Press / 3x8-12 100lb / progress: dp(5lb, 8, 12)
Lat Pulldown / 3x10 80lb
Seated Row / 3x10 70lb
Overhead Press / 3x8 45lb
Face Pull, Cable / 3x12 30lb
Lateral Raise, Dumbbell / 3x12 15lb
Triceps Pushdown / 3x12 30lb
Bicep Curl / 3x12 20lb
// Warm-up: 2–3 min easy flat walk. Main Target: 20 min incline walk, around 5% if comfortable. Choose your own speed. Progression: Follow the current program target.
inclineWalk: Incline Treadmill Walk / 1x1 1200s|0s
## Lower A
Leg Press / 3x10 180lb / progress: lp(10lb)
Leg Curl / 3x10 60lb
Leg Extension / 3x12 60lb
Hip Thrust / 3x10 100lb
Standing Calf Raise / 3x12 80lb
Crunch / 3x15
// Warm-up: 2–3 min light spin. Main Target: 15 min steady spin at 80–90 RPM. Progression: Add +1 resistance level when RPE <= 6.
bike: Cycling / 1x1 900s|0s
## Endurance
// Warm-up: 2–3 min easy flat walk. Main Target: 20 min incline walk, then 20 min stationary bike. Choose your own pace. Progression: Follow the current program target.
inclineWalk: Incline Treadmill Walk / 1x1 1200s|0s
// Warm-up: Transition smoothly from walk. Main Target: 20m Stationary Bike at 80–90 RPM after 20m Incline Walk (5.0% incline). Progression: Add +1 resistance level when RPE <= 6.
stationaryBike: Stationary Bike / 1x1 1200s|0s
## Run B
// Warm-up: 5 min brisk walk (1.0% incline). Main Target: 1.0–1.5% incline run/walk intervals (6x 2 min jog / 1 min walk). Progression: Add +1 interval or +0.1 mph when all segments feel controlled.
runB: Cycling / 6x1 120s|60s auto
## Upper B
upperB: Bench Press / 3x8 95lb / progress: lp(5lb)
Seated Row / 3x10 70lb
Face Pull, Cable / 3x12 30lb
// Warm-up: 2–3 min easy flat walk. Main Target: 20 min incline walk, around 5% if comfortable. Choose your own speed. Progression: Follow the current program target.
inclineWalk: Incline Treadmill Walk / 1x1 1200s|0s
## Lower B
Leg Press / 3x10 180lb
Leg Curl / 3x10 60lb
// Warm-up: 2–3 min light spin. Main Target: 10 min steady cooldown spin at 80–90 RPM. Progression: Add +1 resistance level when RPE <= 6.
bikeStairs: Cycling / 1x1 600s|0s
`);
  program.id = "devfit-rotation-fixture";
  program.name = "Continental rotation";
  program.nextDay = 2;
  const schedule: IDevFitSchedule = {
    cycleDays: 14,
    anchorDate: "2026-10-07",
    homeTimeZone: "America/Edmonton",
    referenceSource: "confirmed",
    personalRotation: true,
    trainingDayRolloverMinutes: 0,
    days: [
      { day: 1, programDay: 1, context: "work" },
      { day: 2, context: "work" },
      { day: 3, programDay: 2, context: "off" },
      { day: 4, programDay: 3, context: "off" },
      { day: 5, programDay: 4, context: "off" },
      { day: 6, programDay: 5, context: "work" },
      { day: 7, context: "work" },
      { day: 8, programDay: 6, context: "off" },
      { day: 9, programDay: 7, context: "off" },
      { day: 10, programDay: 1, context: "work" },
      { day: 11, context: "work" },
      { day: 12, programDay: 5, context: "work" },
      { day: 13, programDay: 2, context: "off" },
      { day: 14, programDay: 3, context: "off" },
    ],
  };
  return { program, schedule };
}
