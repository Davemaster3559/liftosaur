import { expect } from "chai";
import { DevFitPersonalPlan_fixture } from "./fixtures/devfitPersonalPlan";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Storage_getDefault } from "../src/models/storage";
import { Program_evaluate, Program_nextHistoryRecord, Program_runAllFinishDayScripts } from "../src/models/program";
import { PlannerProgramExercise_getState } from "../src/pages/planner/models/plannerProgramExercise";
import { PlanUpgrade_apply, PlanUpgrade_preview } from "../src/devfit/planUpgrade";
import { PlanActions_bench, PlanActions_targetStorage } from "../src/devfit/planActions";
import { Milestones_availableLoad } from "../src/devfit/milestones";
import { Cardio_breakdown, Cardio_mirror, Cardio_phaseSetting, Cardio_segments } from "../src/devfit/cardio";
import { ICardioActivity } from "../src/devfit/cardioSchema";
import { Exercise_toKey } from "../src/models/exercise";
import { Weight_build } from "../src/models/weight";
import { TrainingDateActions_assign } from "../src/devfit/trainingDateActions";
import { buildState, IEnv } from "../src/models/state";
import { IAction, reducer } from "../src/ducks/reducer";
import { IDispatch } from "../src/ducks/types";
import { ISet } from "../src/types";

describe("DevFit v0.5 reviewed data and progression regressions", () => {
  function base(): ReturnType<typeof Storage_getDefault> {
    const { program, schedule } = DevFitPersonalPlan_fixture();
    const storage = Storage_getDefault();
    storage.programs = [program];
    storage.currentProgramId = program.id;
    storage.settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
    return storage;
  }
  function upgrade(storage = base()): ReturnType<typeof Storage_getDefault> {
    const preview = PlanUpgrade_preview(storage.programs[0], storage.settings, []);
    expect(preview.conflicts).to.deep.equal([]);
    const result = PlanUpgrade_apply(storage, preview);
    expect(result.error).to.equal(undefined);
    return result.storage;
  }
  it("rejects mixed working loads without changing the source program", () => {
    const storage = base();
    for (const week of storage.programs[0].planner!.weeks) {
      for (const day of week.days) {
        day.exerciseText = day.exerciseText.replace(/3x11 80lb/g, "1x11 60lb, 2x11 80lb");
      }
    }
    const before = JSON.stringify(storage);
    const preview = PlanUpgrade_preview(storage.programs[0], storage.settings, []);
    expect(preview.conflicts.some((s) => s.includes("mixed"))).to.equal(true);
    expect(PlanUpgrade_apply(storage, preview).storage).to.equal(storage);
    expect(JSON.stringify(storage)).to.equal(before);
  });
  it("preserves genuine timed running circuits and their saved state, advancing only on measured work evidence", () => {
    const storage = base();
    for (const week of storage.programs[0].planner!.weeks) {
      for (const day of week.days) {
        day.exerciseText = day.exerciseText.replace(
          "runB: Cycling / 1x1 1800s|0s",
          "runB: Cycling / 6x1 120s|60s auto / progress: custom(intervals: 6) {~ state.intervals += 1 ~}"
        );
      }
    }
    const updated = upgrade(storage);
    const program = updated.programs[0];
    const ev = Program_evaluate(program, updated.settings);
    expect(ev.errors).to.deep.equal([]);
    const exercise = ev.weeks[0].days[4].exercises[0];
    expect(PlannerProgramExercise_getState(exercise).intervals).to.equal(6);
    const progress = Program_nextHistoryRecord(program, updated.settings, Stats_getEmpty(), 5);
    const entry = progress.entries[0];
    expect(entry.sets).to.have.length(6);
    expect(entry.sets.every((s) => s.auto && s.setTimer === 120 && s.timer === 60)).to.equal(true);
    for (const set of entry.sets) {
      set.isCompleted = true;
      set.completedReps = 1;
      set.completedSetTimer = 120;
    }
    const held = Program_runAllFinishDayScripts(program, progress, Stats_getEmpty(), updated.settings).program;
    expect(
      PlannerProgramExercise_getState(Program_evaluate(held, updated.settings).weeks[0].days[4].exercises[0]).intervals
    ).to.equal(6);
    entry.sets = entry.sets.map((set) =>
      Cardio_mirror(set, {
        schemaVersion: 1,
        recordingMode: "live",
        kind: "treadmill",
        runPlan: "run_b",
        datePrecision: "minute",
        performedLocalDate: "2026-10-22",
        actualDurationSeconds: 120,
        segments: [{ phase: "jog", durationSeconds: 120 }],
      })
    );
    const earned = Program_runAllFinishDayScripts(program, progress, Stats_getEmpty(), updated.settings).program;
    expect(
      PlannerProgramExercise_getState(Program_evaluate(earned, updated.settings).weeks[0].days[4].exercises[0])
        .intervals
    ).to.equal(7);
    entry.sets = entry.sets.map((set) =>
      Cardio_mirror(set, {
        ...set.devfitCardio!,
        segments: [
          { phase: "jog", durationSeconds: 1 },
          { phase: "walk", durationSeconds: 119 },
        ],
      })
    );
    const walked = Program_runAllFinishDayScripts(program, progress, Stats_getEmpty(), updated.settings).program;
    expect(
      PlannerProgramExercise_getState(Program_evaluate(walked, updated.settings).weeks[0].days[4].exercises[0])
        .intervals
    ).to.equal(6);
  });
  it("holds Run A for total-only logs and requires measured continuous jogging and explicit controlled effort", () => {
    const storage = base();
    for (const week of storage.programs[0].planner!.weeks) {
      for (const day of week.days) {
        day.exerciseText = day.exerciseText.replace(
          "runA: Cycling / 1x1 1800s|0s",
          "runA: Cycling / 1x1 1800s|0s / progress: custom(continuousTargetMinutes: 8, successes: 0) {~ state.successes += 1 ~}"
        );
      }
    }
    const updated = upgrade(storage);
    const program = updated.programs[0];
    const progress = Program_nextHistoryRecord(program, updated.settings, Stats_getEmpty(), 1);
    const set = progress.entries[0].sets[0];
    const activity: ICardioActivity = {
      schemaVersion: 1,
      kind: "treadmill",
      runPlan: "run_a",
      recordingMode: "live",
      performedLocalDate: "2026-10-22",
      datePrecision: "minute",
      actualDurationSeconds: 1800,
    };
    const successes = (): number =>
      Number(
        PlannerProgramExercise_getState(
          Program_evaluate(
            Program_runAllFinishDayScripts(program, progress, Stats_getEmpty(), updated.settings).program,
            updated.settings
          ).weeks[0].days[0].exercises[0]
        ).successes
      );
    progress.entries[0].sets[0] = Cardio_mirror({ ...set, isCompleted: true }, activity);
    expect(successes()).to.equal(0);
    activity.segments = [
      { phase: "walk", durationSeconds: 300 },
      { phase: "jog", durationSeconds: 480 },
      { phase: "walk", durationSeconds: 1020 },
    ];
    progress.entries[0].sets[0] = Cardio_mirror({ ...set, isCompleted: true }, activity);
    expect(successes()).to.equal(0);
    progress.entries[0].sets[0] = Cardio_mirror({ ...set, isCompleted: true }, { ...activity, controlledEffort: true });
    expect(successes()).to.equal(1);
  });
  it("uses the deliberately configured stack step and never invents an unavailable plate load", () => {
    const settings = Settings_build();
    const gym = settings.gyms[0];
    const exercise = { id: "benchPress", equipment: "barbell" };
    settings.exerciseData[Exercise_toKey(exercise)] = { equipment: { [gym.id]: "barbell" } };
    const equipment = gym.equipment.barbell!;
    equipment.isFixed = true;
    equipment.unit = "lb";
    equipment.fixed = [60, 65, 70].map((n) => Weight_build(n, "lb"));
    const target = {
      weight: Weight_build(60, "lb"),
      step: Weight_build(10, "lb"),
      reps: 15 as const,
      calibrated: true,
    };
    expect(Milestones_availableLoad(target, exercise, settings)).to.deep.equal(Weight_build(70, "lb"));
    equipment.isFixed = false;
    equipment.multiplier = 1;
    equipment.bar.lb = Weight_build(0, "lb");
    equipment.plates = [{ weight: Weight_build(10, "lb"), num: 7 }];
    const next = Milestones_availableLoad({ ...target, step: Weight_build(5, "lb") }, exercise, settings)!;
    expect(next.value).not.to.equal(65);
    expect(next.value === 60 || next.value === 70).to.equal(true);
  });
  it("retains original required IDs when calibrating and leaves added optional sets optional", () => {
    const storage = upgrade();
    const program = storage.programs[0];
    const record = Program_nextHistoryRecord(program, storage.settings, Stats_getEmpty(), 2);
    const entry = record.entries.find((e) => e.exercise.id === "lateralRaise")!;
    const required = entry.devfitMilestone!.required.map((r) => r.id);
    entry.sets.push({ ...entry.sets[0], id: "optional-extra", index: 2 });
    storage.progress = [record];
    const updated = PlanActions_targetStorage(storage, program.id, entry.programExerciseId!, {
      weight: Weight_build(20, "lb"),
      step: Weight_build(5, "lb"),
      calibrated: true,
    });
    expect(updated).not.to.equal(storage);
    expect(
      updated.progress[0].entries.find((e) => e.id === entry.id)!.devfitMilestone!.required.map((r) => r.id)
    ).to.deep.equal(required);
  });
  it("preserves a historical date override through save and targets record zero even while history is being edited", async () => {
    const storage = upgrade();
    const program = storage.programs[0];
    const history = {
      ...Program_nextHistoryRecord(program, storage.settings, Stats_getEmpty(), 2),
      vtype: "history_record" as const,
      id: 123,
    };
    storage.history = [history];
    storage.progress = [Program_nextHistoryRecord(program, storage.settings, Stats_getEmpty(), 1)];
    let state = buildState({ storage, deviceId: "v05-test", nosync: true });
    state.progress[123] = { ...history, notes: "Unsaved note" };
    const dispatch: IDispatch = (action) => {
      if (typeof action === "function") {
        return action(dispatch, () => state, {} as IEnv);
      }
      state = reducer(state, action as IAction, []);
      return undefined;
    };
    await dispatch(TrainingDateActions_assign(123, "2026-10-17"));
    expect(state.progress[123]?.devfitTrainingDate?.date).to.equal("2026-10-17");
    await dispatch(TrainingDateActions_assign(0, "2026-10-18"));
    expect(state.storage.progress[0].devfitTrainingDate?.date).to.equal("2026-10-18");
    expect(state.progress[123]?.devfitTrainingDate?.date).to.equal("2026-10-17");
    await dispatch({ type: "FinishProgramDayAction", id: 123 });
    expect(state.storage.history[0].devfitTrainingDate?.date).to.equal("2026-10-17");
    expect(state.storage.history[0].notes).to.equal("Unsaved note");
  });
  it("chooses all pending abdominal slots without changing an existing independent sit-up prescription", async () => {
    const storage = base();
    storage.programs[0].planner!.weeks[0].days[2].exerciseText +=
      "\nIndependent: Sit Up, Bodyweight / 1x20 / progress: custom(achievements: 7) {~ ~}";
    const updated = upgrade(storage);
    let state = buildState({ storage: updated, deviceId: "v05-bench", nosync: true });
    const dispatch: IDispatch = (action) => {
      if (typeof action === "function") {
        return action(dispatch, () => state, {} as IEnv);
      }
      state = reducer(state, action as IAction, []);
      return undefined;
    };
    let error: string | undefined;
    await dispatch(
      PlanActions_bench(updated.programs[0].id, "sit_up", (message) => {
        error = message;
      })
    );
    expect(error).to.equal(undefined);
    const evaluated = Program_evaluate(state.storage.programs[0], state.storage.settings);
    const entries = evaluated.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises));
    expect(entries.filter((e) => /awaiting bench/i.test(e.name))).to.have.length(0);
    const independent = entries.find((e) => e.label === "Independent")!;
    expect(PlannerProgramExercise_getState(independent).achievements).to.equal(7);
    expect(independent.evaluatedSetVariations[0].sets[0].maxrep).to.equal(20);
    expect(
      entries
        .filter((e) => e.label === "devfitBench")
        .every((e) => !e.notused && e.evaluatedSetVariations[0].sets[0].weight?.value === 0)
    ).to.equal(true);
  });
  it("keeps pause provenance through an immediate same-second settings change", () => {
    const set: ISet = {
      vtype: "set",
      id: "jog",
      index: 0,
      cardioLaps: [
        { phase: "jog", elapsedSeconds: 0 },
        { phase: "jog", elapsedSeconds: 300, breakBefore: true },
      ],
    };
    const edited = Cardio_phaseSetting(set, 300, { speed: { value: 4, unit: "mph" } });
    expect(Cardio_breakdown({ segments: Cardio_segments(edited.cardioLaps, 600) }).longestJogSeconds).to.equal(300);
  });
});
