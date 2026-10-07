import { expect } from "chai";
import * as v from "valibot";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Program_evaluate, Program_getProgramDay, Program_nextHistoryRecord } from "../src/models/program";
import { VSettings } from "../src/types";
import { Schedule_assign, Schedule_dayNumber, Schedule_slots } from "../src/devfit/schedule";
import { Session_day, Session_kind, Session_timedRecordingSet } from "../src/devfit/presentation";
import { Analytics_summary } from "../src/devfit/analytics";
import { WorkoutFocus_active } from "../src/devfit/workoutFocus";
import { DevFit_layout } from "../src/devfit/layout";
import { Finish_activity, Finish_nextTargets } from "../src/devfit/finish";
import { PlannerTestUtils_finish, PlannerTestUtils_get } from "./utils/plannerTestUtils";
import { DevFitRotation_fixture } from "./fixtures/devfitRotation";

describe("DevFit schedule and workout presentation", () => {
  const { program, schedule } = DevFitRotation_fixture();
  const settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
  const evaluated = Program_evaluate(program, settings);
  const now = new Date(2026, 9, 7, 12).getTime();
  it("evaluates a mixed rotation using the real planner", () => {
    expect(evaluated.errors).to.deep.equal([]);
    expect(Session_day(Program_getProgramDay(evaluated, 1)!, settings).kind).to.equal("running");
    expect(Session_day(Program_getProgramDay(evaluated, 1)!, settings).minutes).to.equal(30);
    expect(Session_day(Program_getProgramDay(evaluated, 5)!, settings).minutes).to.equal(17);
    expect(Session_day(Program_getProgramDay(evaluated, 2)!, settings).kind).to.equal("mixed");
    expect(Session_day(Program_getProgramDay(evaluated, 4)!, settings).kind).to.equal("cardio");
    expect(Session_kind("Plank")).to.equal("strength");
    expect(Session_kind("Cardio", ["runA"])).to.equal("running");
    expect(Session_kind("Custom movement", ["endurance"])).to.equal("cardio");
    expect(Session_kind("Bicycle Crunch")).to.equal("strength");
  });
  it("shows 14 slots including recovery without inserting any workout or changing nextDay", () => {
    const before = JSON.stringify(program);
    const slots = Schedule_slots(evaluated, settings, [], now);
    expect(slots).to.have.length(14);
    expect(slots[1].session).to.equal(undefined);
    expect(slots[1].context).to.equal("work");
    expect(slots[2].session!.name).to.equal("Upper A");
    expect(slots[2].isToday).to.equal(true);
    expect(slots[2].isNext).to.equal(true);
    expect(JSON.stringify(program)).to.equal(before);
  });
  it("uses calendar days across DST and cycles before or after the anchor", () => {
    expect(Schedule_dayNumber("2026-10-31", 14, new Date(2026, 10, 2, 0, 1).getTime())).to.equal(3);
    expect(Schedule_dayNumber("2026-10-05", 14, new Date(2026, 9, 19).getTime())).to.equal(1);
    expect(Schedule_dayNumber("2026-10-05", 14, new Date(2026, 9, 4).getTime())).to.equal(14);
    expect(Schedule_dayNumber(undefined, 14, now)).to.equal(undefined);
  });
  it("round-trips optional schedule metadata through existing settings validation", () => {
    const config = Schedule_assign(schedule, 5, { programDay: 2, context: "off" });
    const copy = v.parse(
      VSettings,
      JSON.parse(JSON.stringify({ ...settings, devfitSchedules: { [program.id]: config } }))
    );
    expect(copy.devfitSchedules![program.id]).to.deep.equal(config);
    expect(v.parse(VSettings, Settings_build()).devfitSchedules).to.equal(undefined);
    expect(schedule.days.some((s) => s.day === 5)).to.equal(false);
  });
  it("matches completion to this cycle's date, rather than weekday or any historical session", () => {
    const record = Program_nextHistoryRecord(program, settings, Stats_getEmpty());
    record.vtype = "history_record";
    record.startTime = now - 14 * 86400000;
    expect(Schedule_slots(evaluated, settings, [record], now)[2].completed).to.equal(false);
    record.startTime = now;
    expect(Schedule_slots(evaluated, settings, [record], now)[2].completed).to.equal(true);
  });
  it("keeps cardio duration out of strength volume and muscle set counts", () => {
    const record = Program_nextHistoryRecord(program, settings, Stats_getEmpty());
    record.vtype = "history_record";
    record.startTime = now;
    for (const entry of record.entries) {
      for (const set of entry.sets) {
        set.isCompleted = true;
        if (set.setTimer != null) {
          set.completedSetTimer = 1200;
        } else {
          set.completedWeight = set.weight;
          set.completedReps = set.reps;
        }
      }
    }
    const summary = Analytics_summary([record], settings, Stats_getEmpty(), evaluated, now);
    expect(summary.completed.strength).to.equal(1);
    expect(summary.completed.cardio).to.equal(1);
    expect(summary.cardioSeconds).to.equal(1200);
    expect(summary.sets.total).to.equal(24);
    expect(summary.planned.running).to.equal(2);
    expect(summary.planned.strength).to.equal(4);
    expect(summary.plannedCardioSeconds).to.equal(147 * 60);
    const older = { ...record, id: -1, startTime: now - 30 * 86400000 };
    const withPrevious = Analytics_summary([record, older], settings, Stats_getEmpty(), evaluated, now);
    expect(withPrevious.trends.length).to.be.greaterThan(0);
    expect(withPrevious.sets.total).to.equal(24);
  });
  it("selects warmups before working sets and supports editing completed sets", () => {
    const entry = Program_nextHistoryRecord(program, settings, Stats_getEmpty()).entries[0];
    const first = WorkoutFocus_active(entry)!;
    expect(first.mode).to.equal(entry.warmupSets.length ? "warmup" : "workout");
    first.set.isCompleted = true;
    expect(WorkoutFocus_active(entry)?.set.id).not.to.equal(first.set.id);
    expect(WorkoutFocus_active(entry, first.set.id)?.set.id).to.equal(first.set.id);
  });
  it("uses compact cover layouts and a useful split when unfolded, including large text", () => {
    for (const width of [320, 360, 420, 600]) {
      expect(DevFit_layout(width).wide).to.equal(false);
    }
    for (const width of [720, 800, 960, 1200]) {
      expect(DevFit_layout(width).wide).to.equal(true);
    }
    expect(DevFit_layout(800, 1.5).wide).to.equal(false);
    expect(DevFit_layout(1200, 1.5).wide).to.equal(true);
  });
  it("reports actual saved LP targets after finishing", () => {
    const text = "# Week 1\n## Upper A\nBench Press / 1x5 100lb / progress: lp(5lb)";
    const { program: before } = PlannerTestUtils_get(text);
    const record = Program_nextHistoryRecord(before, settings, Stats_getEmpty());
    const { program: after } = PlannerTestUtils_finish(text, { completedReps: [[5]] }, settings);
    const changes = Finish_nextTargets(record, after, settings, Stats_getEmpty());
    expect(changes).to.have.length(1);
    expect(changes[0].after).to.equal("105lb × 5");
  });
  it("records time-only cardio with neutral engine values while preserving explicit prompts", () => {
    const set = Program_nextHistoryRecord({ ...program, nextDay: 1 }, settings, Stats_getEmpty()).entries[0].sets[0];
    const defaults = Session_timedRecordingSet({ ...set, weight: undefined, reps: undefined }, "running", settings);
    expect(defaults.completedWeight?.value).to.equal(0);
    expect(defaults.completedReps).to.equal(1);
    const prompted = Session_timedRecordingSet(
      { ...set, weight: undefined, reps: undefined, askWeight: true, isAmrap: true },
      "running",
      settings
    );
    expect(prompted.completedWeight).to.equal(undefined);
    expect(prompted.completedReps).to.equal(undefined);
    expect(Session_timedRecordingSet(set, "strength", settings)).to.equal(set);
  });
  it("summarizes a completed run as duration and segments without strength volume", () => {
    const record = Program_nextHistoryRecord({ ...program, nextDay: 1 }, settings, Stats_getEmpty());
    record.entries[0].sets[0].isCompleted = true;
    record.entries[0].sets[0].completedSetTimer = 1800;
    const activity = Finish_activity(record, settings, evaluated);
    expect(activity.hasStrength).to.equal(false);
    expect(activity.strength.entries).to.have.length(0);
    expect(activity.cardioSeconds).to.equal(1800);
    expect(activity.cardioSegments).to.equal(1);
  });
});
