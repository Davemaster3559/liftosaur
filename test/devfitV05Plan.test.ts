import { expect } from "chai";
import * as v from "valibot";
import { DevFitPersonalPlan_fixture } from "./fixtures/devfitPersonalPlan";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import {
  Program_evaluate,
  Program_getListOfDays,
  Program_nextHistoryRecord,
  Program_runAllFinishDayScripts,
} from "../src/models/program";
import { PlanUpgrade_apply, PlanUpgrade_preview, PlanUpgrade_restore } from "../src/devfit/planUpgrade";
import { Storage_getDefault } from "../src/models/storage";
import { VProgram, VHistoryRecord } from "../src/types";
import { Milestones_evaluate, Milestones_workoutComplete } from "../src/devfit/milestones";
import { LiftingUnits_commit, LiftingUnits_convert, LiftingUnits_same } from "../src/devfit/liftingUnits";

describe("DevFit v0.5 existing personal plan and earned progression", () => {
  function setup(): {
    storage: ReturnType<typeof Storage_getDefault>;
    preview: ReturnType<typeof PlanUpgrade_preview>;
  } {
    const { program, schedule } = DevFitPersonalPlan_fixture();
    const storage = Storage_getDefault();
    storage.programs = [program];
    storage.currentProgramId = program.id;
    storage.settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
    return { storage, preview: PlanUpgrade_preview(program, storage.settings, [], 1234) };
  }
  it("upgrades all eleven sessions with correct counts, distinct equipment, pending bench and named cardio", () => {
    const { storage, preview } = setup();
    expect(preview.conflicts).to.deep.equal([]);
    expect(preview.program, JSON.stringify(preview)).not.to.equal(undefined);
    const upgraded = PlanUpgrade_apply(storage, preview);
    expect(upgraded.error).to.equal(undefined);
    const program = upgraded.storage.programs[0];
    expect(v.safeParse(VProgram, program).success).to.equal(true);
    const ev = Program_evaluate(program, storage.settings);
    expect(ev.errors).to.deep.equal([]);
    expect(Program_getListOfDays(ev)).to.have.length(11);
    for (let day = 1; day <= 11; day++) {
      const record = Program_nextHistoryRecord(program, storage.settings, Stats_getEmpty(), day);
      expect(v.safeParse(VHistoryRecord, record).success).to.equal(true);
      expect(record.entries.filter((e) => /crunch|standingCalfRaise/.test(e.exercise.id))).to.have.length(0);
      expect(record.entries.every((e) => e.exercise.id !== "cycling")).to.equal(true);
      expect(record.entries.filter((e) => e.devfitCardioPrescription)).to.have.length(day === 4 ? 2 : 1);
      const lateral = record.entries.find((e) => e.exercise.id === "lateralRaise");
      if (lateral) {
        expect(lateral.exercise.equipment).to.equal("dumbbell");
        expect(lateral.sets).to.have.length(2);
        expect(lateral.devfitMilestone?.target.calibrated).to.equal(false);
      }
      const calf = record.entries.find((e) => e.exercise.id === "seatedCalfRaise");
      if (calf) {
        expect(calf.sets).to.have.length(3);
      }
    }
    expect(program.id).to.equal(storage.programs[0].id);
    expect(program.devfitPlan?.abdominal).to.equal("unknown");
    expect(upgraded.storage.settings).to.equal(storage.settings);
    expect(upgraded.storage.history).to.equal(storage.history);
    expect(PlanUpgrade_apply(upgraded.storage, preview).storage).to.equal(upgraded.storage);
    expect(
      JSON.parse(JSON.stringify(PlanUpgrade_restore(upgraded.storage, program.id).storage.programs[0]))
    ).to.deep.equal(JSON.parse(JSON.stringify(storage.programs[0])));
  });
  it("rejects stale previews, other selections and active workouts without writing", () => {
    const { storage, preview } = setup();
    storage.programs[0] = { ...storage.programs[0], name: "Changed" };
    expect(PlanUpgrade_apply(storage, preview).storage).to.equal(storage);
    expect(PlanUpgrade_apply(storage, preview).error).to.contain("changed");
    const fresh = setup();
    fresh.storage.progress = [
      Program_nextHistoryRecord(fresh.storage.programs[0], fresh.storage.settings, Stats_getEmpty()),
    ];
    expect(PlanUpgrade_apply(fresh.storage, fresh.preview).error).to.contain("active workout");
  });
  it("awards one stage only after all original required sets and the full workout; missing/deleted sets hold", () => {
    const { storage, preview } = setup();
    let program = PlanUpgrade_apply(storage, preview).storage.programs[0];
    for (const target of Object.values(program.devfitPlan!.targets)) {
      target.calibrated = true;
    }
    const progress = Program_nextHistoryRecord(program, storage.settings, Stats_getEmpty(), 2);
    for (const entry of progress.entries) {
      for (const set of entry.sets) {
        set.isCompleted = true;
        set.completedReps = 99;
        set.completedWeight = set.weight;
        set.completedRpe = set.rpe ?? 5;
      }
    }
    const entry = progress.entries[0];
    const key = entry.devfitMilestone!.key;
    expect(entry.sets).to.have.length(3);
    expect(entry.sets[0].weight).to.deep.equal({ value: 80, unit: "lb" });
    expect(program.devfitPlan!.targets[key].reps).to.equal(12);
    const deleted = { ...progress, entries: [{ ...entry, sets: entry.sets.slice(1) }, ...progress.entries.slice(1)] };
    expect(Milestones_workoutComplete(deleted)).to.equal(false);
    expect(
      Program_runAllFinishDayScripts(program, deleted, Stats_getEmpty(), storage.settings).program.devfitPlan!.targets[
        key
      ].reps
    ).to.equal(12);
    const missingExercise = { ...progress, entries: progress.entries.slice(1) };
    expect(Milestones_workoutComplete(missingExercise)).to.equal(false);
    program = Program_runAllFinishDayScripts(program, progress, Stats_getEmpty(), storage.settings).program;
    expect(program.devfitPlan!.targets[key].reps).to.equal(15);
    expect(program.devfitPlan!.targets[key].weight.value).to.equal(80);
    expect(
      Program_runAllFinishDayScripts(program, progress, Stats_getEmpty(), storage.settings).program.devfitPlan!.targets[
        key
      ]
    ).to.deep.equal(program.devfitPlan!.targets[key]);
  });
  it("holds wrong weights, unilateral misses, absent RPE, large jumps, maximums and explicit Keep target", () => {
    const { storage, preview } = setup();
    const program = PlanUpgrade_apply(storage, preview).storage.programs[0];
    const entry = Program_nextHistoryRecord(program, storage.settings, Stats_getEmpty(), 2).entries[0];
    const target = { ...entry.devfitMilestone!.target, calibrated: true, reps: 15 as const };
    entry.devfitMilestone!.target = target;
    for (const required of entry.devfitMilestone!.required) {
      required.reps = 15;
      required.rpe = 8;
      required.unilateral = true;
    }
    for (const set of entry.sets) {
      set.isCompleted = true;
      set.completedReps = 15;
      set.completedWeight = set.weight;
    }
    expect(Milestones_evaluate(entry, target, "one").earned).to.equal(false);
    for (const set of entry.sets) {
      set.completedRepsLeft = 15;
      set.completedRpe = 8;
    }
    expect(Milestones_evaluate(entry, target, "one", { value: 100, unit: "lb" }).reason).to.contain("larger");
    expect(Milestones_evaluate(entry, target, "one", target.weight).reason).to.contain("maximum");
    expect(Milestones_evaluate(entry, { ...target, keep: true }, "one").earned).to.equal(false);
    const earned = Milestones_evaluate(entry, target, "one", { value: 85, unit: "lb" });
    expect(earned.target.reps).to.equal(8);
    expect(earned.target.weight.value).to.equal(85);
    entry.sets[0].completedWeight = { value: 81, unit: "lb" };
    expect(Milestones_evaluate(entry, target, "two").earned).to.equal(false);
  });
  it("converts exact physical loads for display without equipment rounding or no-op blur drift", () => {
    const old = { value: 27, unit: "kg" as const };
    expect(LiftingUnits_convert({ value: 1, unit: "lb" }, "kg").value).to.equal(0.45359237);
    expect(LiftingUnits_same(LiftingUnits_convert(old, "lb"), old)).to.equal(true);
    expect(LiftingUnits_commit({ value: +LiftingUnits_convert(old, "lb").value.toFixed(2), unit: "lb" }, old)).to.equal(
      old
    );
  });
});
