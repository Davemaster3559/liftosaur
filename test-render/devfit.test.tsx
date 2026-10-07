import { fireEvent, render, screen } from "@testing-library/react-native";
import { DevFitCycleCard } from "../src/devfit/cycleCard";
import { DevFitProgressionCue } from "../src/devfit/progressionCue";
import { PlannerTestUtils_get } from "../test/utils/plannerTestUtils";
import { Program_evaluate, Program_nextHistoryRecord } from "../src/models/program";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";

describe("DevFit native cards", () => {
  const settings = Settings_build();
  const stats = Stats_getEmpty();
  it("opens cycle details with an honest empty state", async () => {
    await render(<DevFitCycleCard history={[]} settings={settings} stats={stats} prs={{}} now={Date.now()} />);
    expect(screen.getByText("Your training cycle")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Training cycle details" }));
    expect(screen.getByText("Finish a workout to start this cycle’s insights.")).toBeTruthy();
  });
  it("shows real targets and opens the program rule without completing a set", async () => {
    const { program } = PlannerTestUtils_get("# Week 1\n## Day 1\nSquat / 3x8-12 150lb / progress: dp(5lb, 8, 12)");
    const entry = Program_nextHistoryRecord(program, settings, stats).entries[0];
    const exercise = Program_evaluate(program, settings).weeks[0].days[0].exercises[0];
    const onViewRule = jest.fn();
    await render(<DevFitProgressionCue entry={entry} exercise={exercise} unit="lb" onViewRule={onViewRule} />);
    expect(screen.getByText("3 sets · 150lb × 8–12")).toBeTruthy();
    expect(screen.getByText("No previous logged sets")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("devfit-view-progression"));
    expect(onViewRule).toHaveBeenCalledTimes(1);
    expect(entry.sets.some((set) => set.isCompleted)).toBe(false);
  });
});
