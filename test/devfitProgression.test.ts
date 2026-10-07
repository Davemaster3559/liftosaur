import { expect } from "chai";
import { Progression_rule, Progression_sets } from "../src/devfit/progression";
import { PlannerTestUtils_get, PlannerTestUtils_finish } from "./utils/plannerTestUtils";
import { Program_evaluate, Program_nextHistoryRecord } from "../src/models/program";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Weight_build } from "../src/models/weight";

const settings = Settings_build();
function exercise(text: string) {
  const { program } = PlannerTestUtils_get(`# Week 1\n## Day 1\n${text}`);
  return Program_evaluate(program, settings).weeks[0].days[0].exercises[0];
}

describe("DevFit truthful progression cues", () => {
  it("describes double progression and verifies its threshold against the real engine", () => {
    const text = "# Week 1\n## Day 1\nSquat / 3x8 100lb / progress: dp(5lb, 8, 12)";
    expect(Progression_rule(exercise("Squat / 3x8 100lb / progress: dp(5lb, 8, 12)"))).to.include(
      "Add 5lb after every required set reaches 12 reps"
    );
    const { program } = PlannerTestUtils_finish(text, { completedReps: [[12, 12, 12]] });
    const next = Program_nextHistoryRecord(program, settings, Stats_getEmpty());
    expect(next.entries[0].sets.map((set) => set.weight?.value)).to.eql([105, 105, 105]);
    expect(next.entries[0].sets.map((set) => set.reps)).to.eql([8, 8, 8]);
  });
  it("preserves a failed threshold and describes remaining successful sessions for linear progression", () => {
    const text = "# Week 1\n## Day 1\nSquat / 3x8 100lb / progress: dp(5lb, 8, 12)";
    const { program } = PlannerTestUtils_finish(text, { completedReps: [[12, 12, 11]] });
    expect(Program_nextHistoryRecord(program, settings, Stats_getEmpty()).entries[0].sets[0].weight?.value).to.equal(
      100
    );
    expect(Progression_rule(exercise("Squat / 3x5 100lb / progress: lp(5lb, 3, 1)"))).to.include(
      "2 more successful sessions"
    );
  });
  it("does not invent predictions for custom scripts and distinguishes no progression", () => {
    const custom = exercise("Squat / 3x5 100lb / progress: custom() {~ weights += 5lb ~}");
    expect(Progression_rule(custom)).to.include("Your Liftoscript calculates");
    expect(Progression_rule(custom)).not.to.include("Add 5lb");
    expect(Progression_rule(exercise("Squat / 3x5 100lb"))).to.include("No automatic progression");
  });
  it("shows actual previous weights, current rep ranges, and honest missing values", () => {
    const { program } = PlannerTestUtils_get("# Week 1\n## Day 1\nSquat / 3x8-12 150lb");
    const entry = Program_nextHistoryRecord(program, settings, Stats_getEmpty()).entries[0];
    expect(Progression_sets(entry, false, "lb")).to.equal("3 sets · 150lb × 8–12");
    const previous = {
      ...entry,
      sets: [{ ...entry.sets[0], completedWeight: Weight_build(145, "lb"), completedReps: 10 }],
    };
    expect(Progression_sets(previous, true, "lb")).to.equal("145lb × 10");
    expect(Progression_sets(undefined, true, "lb")).to.equal("No previous logged sets");
  });
});
