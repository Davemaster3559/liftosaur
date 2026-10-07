import { act, fireEvent, screen } from "@testing-library/react-native";
import { DevFitService } from "../src/devfit/service";
import { Exercise_toKey } from "../src/models/exercise";
import { navigationRef } from "../src/navigation/navigationRef";
import { Fixture_build } from "./harness/fixture";
import { RenderApp_mount } from "./harness/renderApp";
import { RenderEnv_build } from "./harness/renderEnv";

describe("DevFit signed-out native app", () => {
  it("reaches bundled programs from a fresh offline launch without account or attribution prompts", async () => {
    const state = Fixture_build({ subscribed: false, ongoingWorkout: false });
    state.storage.currentProgramId = undefined;
    state.storage.programs = [];
    state.nosync = true;
    const { env } = RenderEnv_build();
    const offline = jest.fn(async () => {
      throw new Error("No network available");
    });
    env.service = new DevFitService(offline);
    const app = await RenderApp_mount(state, env, { start: "home" });
    try {
      expect(screen.getByText("Get started")).toBeTruthy();
      expect(screen.queryByText("I have an account")).toBeNull();
      await app.press("see-how-it-works");
      await app.settle();
      expect(screen.getByText("Pick your units")).toBeTruthy();
      await app.press("see-how-it-works");
      await app.settle();
      await app.press("setup-equipment-continue");
      await app.settle();
      await app.press("setup-plates-continue");
      await app.settle();
      expect(navigationRef.getCurrentRoute()?.name).toBe("programselect");
      await app.press("program-select-builtin");
      await app.settle();
      expect(navigationRef.getCurrentRoute()?.name).toBe("programs");
      expect(screen.getByTestId("program-search")).toBeTruthy();
      expect(offline).not.toHaveBeenCalled();
    } finally {
      await app.unmount();
    }
  });

  it("logs a set and opens home insights, graphs, backup and Health Connect settings offline", async () => {
    const state = Fixture_build({ subscribed: false, editingProgram: true });
    state.nosync = true;
    state.storage.settings.graphs.graphs = [
      { vtype: "graph", type: "exercise", id: Exercise_toKey(state.storage.progress[0].entries[0].exercise) },
    ];
    const { env, bridges } = RenderEnv_build();
    const offline = jest.fn(async () => {
      throw new Error("No network available");
    });
    env.service = new DevFitService(offline);
    const app = await RenderApp_mount(state, env);
    try {
      expect(screen.getAllByTestId("devfit-progression").length).toBeGreaterThan(0);
      await app.completeSet(0);
      expect(screen.getAllByTestId("set-completed")).toHaveLength(1);
      expect(bridges.log.names()).toContain("timer.startTimer");
      expect(bridges.log.names()).toContain("workout.updateLiveActivity");

      await app.goToHomeTab();
      expect(screen.getByTestId("devfit-today")).toBeTruthy();
      await app.tapFooter("graphs");
      expect(navigationRef.getCurrentRoute()?.name).toBe("graphsList");
      expect(screen.getByTestId("devfit-progress")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Exercise & muscle graphs" }));
      await app.settle();
      expect(screen.getAllByTestId("graph").length).toBeGreaterThan(0);
      expect(screen.queryByText("Unlock Premium")).toBeNull();

      await app.tapFooter("me");
      expect(screen.getByText("About DevFit")).toBeTruthy();
      expect(screen.getByTestId("devfit-backup")).toBeTruthy();
      await act(async () => {
        navigationRef.navigate("mainTabs", { screen: "me", params: { screen: "googleHealth", params: undefined } });
      });
      await app.settle();
      expect(screen.getByText("Sync Workouts")).toBeTruthy();
      expect(screen.getByText("Sync Sleep & Nutrition")).toBeTruthy();
      await app.openProgram();
      expect(navigationRef.getCurrentRoute()?.name).toBe("editProgram");
      await app.tapFooter("home");
      expect(screen.getByTestId("devfit-today")).toBeTruthy();
      expect(offline).not.toHaveBeenCalled();
    } finally {
      await app.unmount();
    }
  });
});
