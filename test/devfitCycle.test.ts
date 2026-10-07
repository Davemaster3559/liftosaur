import { expect } from "chai";
import * as v from "valibot";
import { Cycle_dayKey, Cycle_range, Cycle_records, Cycle_setting, Cycle_summary } from "../src/devfit/cycle";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Program_nextHistoryRecord } from "../src/models/program";
import { Weight_build, Weight_convertTo } from "../src/models/weight";
import { PlannerTestUtils_get } from "./utils/plannerTestUtils";
import { IHistoryRecord, VSettings } from "../src/types";

const now = new Date(2026, 9, 7, 15).getTime();
function workout(daysAgo: number, weight: number = 100): IHistoryRecord {
  const { program } = PlannerTestUtils_get("# Week 1\n## Day 1\nSquat / 1x5 100lb");
  const record = Program_nextHistoryRecord(program, Settings_build(), Stats_getEmpty());
  const start = new Date(now);
  start.setDate(start.getDate() - daysAgo);
  record.vtype = "history_record";
  record.id = record.startTime = start.getTime();
  record.endTime = record.startTime + 1000;
  record.date = start.toISOString();
  record.entries[0].sets[0] = { ...record.entries[0].sets[0], completedReps: 5,
    completedWeight: Weight_build(weight, "lb"), isCompleted: true };
  return record;
}

describe("DevFit rolling training cycles", () => {
  const settings = { ...Settings_build(), devfitCycleDays: 8, devfitCycleTarget: 4 };
  it("includes eight local calendar dates, including today, without counting future or unfinished workouts", () => {
    const range = Cycle_range(settings, now);
    const ongoing = { ...workout(0), vtype: "progress" as const };
    const records = Cycle_records([workout(0), workout(7), workout(8), workout(-1), ongoing], range);
    expect(records).to.have.length(2);
    expect(range.start).to.equal(new Date(2026, 8, 30).getTime());
    expect(range.end).to.equal(new Date(2026, 9, 8).getTime());
  });
  it("counts the same weekday in two different weeks as two muscle training days", () => {
    const summary = Cycle_summary([workout(0), workout(7)], settings, Stats_getEmpty(), {}, now);
    expect(summary.sets.total).to.equal(2);
    expect(summary.sets.strength).to.equal(2);
    expect(summary.sets.volume.value).to.equal(1000);
    expect(Object.keys(summary.sets.muscleGroup.quadriceps.frequency)).to.have.length(2);
    expect(Cycle_dayKey(workout(0))).not.to.equal(Cycle_dayKey(workout(7)));
  });
  it("converts volume and bodyweight units and counts existing exercise PRs", () => {
    const record = workout(0);
    const stats = Stats_getEmpty();
    stats.weight.weight = [
      { vtype: "stat", timestamp: now - 1000, value: Weight_build(100, "kg") },
      { vtype: "stat", timestamp: now, value: Weight_build(220, "lb") },
    ];
    const summary = Cycle_summary([record], { ...settings, units: "kg" }, stats,
      { [record.id]: { squat_barbell: { maxWeightSet: record.entries[0].sets[0] } } }, now);
    expect(summary.sets.volume.value).to.be.closeTo(Weight_convertTo(Weight_build(500, "lb"), "kg").value, 0.1);
    expect(summary.bodyweightChange?.value).to.be.closeTo(Weight_convertTo(Weight_build(220, "lb"), "kg").value - 100, 0.1);
    expect(summary.prs).to.equal(1);
  });
  it("compares completed estimates without inventing progress for a single observation", () => {
    expect(Cycle_summary([workout(0)], settings, Stats_getEmpty(), {}, now).trends).to.eql([]);
    const trend = Cycle_summary([workout(0, 110), workout(9, 100)], settings, Stats_getEmpty(), {}, now).trends[0];
    expect(trend.direction).to.equal("up");
    expect(trend.change).to.be.closeTo(10, 0.1); // Upstream rounds estimated 1RM weights.
  });
  it("keeps cycle preferences in validated backups and bounds invalid UI input", () => {
    expect(v.parse(VSettings, JSON.parse(JSON.stringify(settings))).devfitCycleDays).to.equal(8);
    expect(Cycle_setting(NaN, 8)).to.equal(8);
    expect(Cycle_setting(0, 8)).to.equal(1);
    expect(Cycle_setting(100, 8)).to.equal(60);
  });
});
