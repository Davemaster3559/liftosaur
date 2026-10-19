import { act, fireEvent, screen } from "@testing-library/react-native";
import * as RN from "react-native";
import { Fixture_build } from "./harness/fixture";
import { RenderApp_mount } from "./harness/renderApp";
import { RenderEnv_build } from "./harness/renderEnv";
import { DevFitRotation_fixture } from "../test/fixtures/devfitRotation";
import { navigationRef } from "../src/navigation/navigationRef";
import { Program_nextHistoryRecord } from "../src/models/program";
import { DevFitService } from "../src/devfit/service";
import { Exercise_toKey } from "../src/models/exercise";
import { Schedule_anchor } from "../src/devfit/schedule";

describe("DevFit redesigned native flows", () => {
  for (const width of [360, 720, 960]) {
    it(`renders Today and the focused logger at width ${width}`, async () => {
      const previousDimensions = RN.Dimensions.get("window");
      RN.Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 } });
      const { program, schedule } = DevFitRotation_fixture();
      const state = Fixture_build({ program, ongoingWorkout: false });
      state.nosync = true;
      state.storage.settings.devfitSchedules = { [program.id]: Schedule_anchor(schedule, 3, Date.now()) };
      const { env } = RenderEnv_build();
      const app = await RenderApp_mount(state, env, { start: "home" });
      try {
        expect(screen.getByTestId("devfit-today")).toBeTruthy();
        expect(screen.getByTestId(width < 700 ? "devfit-one-column" : "devfit-two-columns")).toBeTruthy();
        await app.press("devfit-start-session");
        await app.settle();
        expect(navigationRef.getCurrentRoute()?.name).toBe("progress");
        expect(screen.getByTestId("devfit-workout")).toBeTruthy();
        expect(screen.getByTestId("devfit-active-set")).toBeTruthy();
        expect(screen.getByText("Workout active")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Pause workout" })).toBeTruthy();
        expect(screen.getAllByTestId("complete-set")).toHaveLength(1);
        expect(screen.getAllByTestId("input-set-reps-field")).toHaveLength(1);
        expect(screen.getByTestId(width < 700 ? "devfit-one-column" : "devfit-two-columns")).toBeTruthy();
      } finally {
        await app.unmount();
        RN.Dimensions.set({ window: previousDimensions });
      }
    });
  }

  it("keeps recovery visible without creating a workout, and opens Schedule instead of the editor", async () => {
    const { program, schedule } = DevFitRotation_fixture();
    const state = Fixture_build({ program, ongoingWorkout: false });
    state.nosync = true;
    const anchor = new Date();
    anchor.setDate(anchor.getDate() - 1);
    const key = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(anchor.getDate()).padStart(2, "0")}`;
    state.storage.settings.devfitSchedules = { [program.id]: { ...schedule, anchorDate: key } };
    const { env } = RenderEnv_build();
    const app = await RenderApp_mount(state, env, { start: "home" });
    try {
      expect(screen.getByText("Make room to recover.")).toBeTruthy();
      expect(screen.getByText("Your first completed session will appear here.")).toBeTruthy();
      await app.tapFooter("program");
      expect(navigationRef.getCurrentRoute()?.name).toBe("programs");
      expect(screen.getByTestId("devfit-schedule")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^Day \d+,/ })).toHaveLength(14);
      expect(screen.queryByTestId("devfit-active-set")).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Arrange rotation" }));
      await fireEvent.press(screen.getByRole("button", { name: /^Day 2,/ }));
      await fireEvent.press(screen.getByRole("button", { name: "Upper A" }));
      expect(screen.getByRole("button", { name: /^Day 2, Upper A,/ })).toBeTruthy();
    } finally {
      await app.unmount();
    }
  });

  it("flushes edited reps through the real completion action and retains native timer effects", async () => {
    const state = Fixture_build();
    state.nosync = true;
    state.storage.progress[0].entries[0].warmupSets = [];
    const { env, bridges } = RenderEnv_build();
    const previousDimensions = RN.Dimensions.get("window");
    const app = await RenderApp_mount(state, env);
    try {
      await app.press("input-set-reps-field");
      // First keypad input replaces the target, as in the native keyboard.
      await app.press("keyboard-button-7");
      await app.completeSet(0);
      expect(screen.getAllByTestId("set-completed")).toHaveLength(1);
      expect(bridges.log.names()).toContain("timer.startTimer");
      expect(bridges.log.names()).toContain("workout.updateLiveActivity");
      expect(screen.getByTestId("devfit-rest-panel")).toBeTruthy();
      await app.press("devfit-rest-plus");
      await app.press("devfit-rest-skip");
      expect(screen.queryByTestId("devfit-rest-panel")).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Set 1, completed" }));
      expect(screen.getByRole("button", { name: "Undo completion" })).toBeTruthy();
      expect(screen.getByText("7")).toBeTruthy();
      await act(async () => RN.Dimensions.set({ window: { width: 720, height: 900, scale: 1, fontScale: 1 } }));
      expect(screen.getByTestId("devfit-two-columns")).toBeTruthy();
      expect(screen.getByText("7")).toBeTruthy();
      await act(async () => RN.Dimensions.set({ window: { width: 360, height: 900, scale: 1, fontScale: 1 } }));
      expect(screen.getByTestId("devfit-one-column")).toBeTruthy();
      expect(screen.getByText("7")).toBeTruthy();
    } finally {
      await app.unmount();
      RN.Dimensions.set({ window: previousDimensions });
    }
  });

  it("starts and records a running timer without weight or reps fields", async () => {
    const { program } = DevFitRotation_fixture();
    program.nextDay = 1;
    const state = Fixture_build({ program });
    state.nosync = true;
    state.storage.progress[0] = Program_nextHistoryRecord(program, state.storage.settings, state.storage.stats);
    const { env } = RenderEnv_build();
    const offline = jest.fn(async () => {
      throw new Error("offline");
    });
    env.service = new DevFitService(offline);
    const app = await RenderApp_mount(state, env);
    try {
      expect(screen.queryByTestId("input-set-weight-field")).toBeNull();
      expect(screen.queryByTestId("input-set-reps-field")).toBeNull();
      expect(screen.getByTestId("devfit-cardio-summary-card")).toBeTruthy();
      await app.press("start-set-timer");
      await app.settle();
      expect(screen.getByTestId("devfit-cardio-timer")).toBeTruthy();
      expect(screen.getByTestId("devfit-cardio-coaching-card")).toBeTruthy();
      if (screen.queryByTestId("set-timer-start-now")) {
        await app.press("set-timer-start-now");
      }
      expect(screen.getByText("Running")).toBeTruthy();
      await app.press("devfit-cardio-switch-phase");
      expect(screen.getByRole("button", { name: "Switch to walk" })).toBeTruthy();
      await app.press("devfit-workout-pause-resume");
      expect(screen.getByTestId("devfit-workout-paused-banner")).toBeTruthy();
      expect(screen.getAllByText("Workout paused").length).toBeGreaterThan(0);
      await app.press("devfit-workout-pause-resume");
      await app.press("set-timer-stop-record");
      await app.settle();
      if (screen.queryByTestId("devfit-cardio-form")) {
        await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      }
      expect(screen.getAllByTestId("set-completed")).toHaveLength(1);
      expect(offline).not.toHaveBeenCalled();
    } finally {
      await app.unmount();
    }
  });

  it("keeps the next-side control after recording a unilateral cardio segment", async () => {
    const { program } = DevFitRotation_fixture();
    program.nextDay = 1;
    const state = Fixture_build({ program });
    state.nosync = true;
    const key = Exercise_toKey(state.storage.progress[0].entries[0].exercise);
    state.storage.settings.exerciseData[key] = { ...state.storage.settings.exerciseData[key], isUnilateral: true };
    state.storage.progress[0] = Program_nextHistoryRecord(program, state.storage.settings, state.storage.stats);
    const { env } = RenderEnv_build();
    const app = await RenderApp_mount(state, env);
    try {
      await app.press("start-set-timer");
      await app.settle();
      if (screen.queryByTestId("set-timer-start-now")) {
        await app.press("set-timer-start-now");
      }
      await app.press("set-timer-log-keep");
      await app.settle();
      expect(screen.getByRole("button", { name: "Next side →" })).toBeTruthy();
      await app.press("set-timer-stop-record");
      await app.settle();
      expect(screen.getByText("Right side")).toBeTruthy();
      if (screen.queryByTestId("set-timer-start-now")) {
        await app.press("set-timer-start-now");
      }
      await app.press("set-timer-stop-record");
      await app.settle();
      expect(screen.getAllByTestId("set-completed")).toHaveLength(1);
    } finally {
      await app.unmount();
    }
  });

  it("automatically records and advances cardio intervals without a weight prompt", async () => {
    const { program } = DevFitRotation_fixture();
    program.nextDay = 5;
    const state = Fixture_build({ program });
    state.nosync = true;
    state.storage.settings.timers.getReady = 0;
    const entry = state.storage.progress[0].entries[0];
    entry.sets = entry.sets.slice(0, 3).map((set) => ({ ...set, setTimer: 1, timer: 0, auto: true }));
    const { env } = RenderEnv_build();
    const app = await RenderApp_mount(state, env);
    try {
      await app.press("start-set-timer");
      for (let i = 0; i < 13; i += 1) {
        await app.settle();
      }
      if (screen.queryByTestId("devfit-cardio-form")) {
        await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      }
      expect(screen.queryByTestId("modal-amrap-weight-input")).toBeNull();
      expect(screen.getAllByTestId("set-completed")).toHaveLength(3);
      expect(screen.getByText("Good work. Keep moving.")).toBeTruthy();
    } finally {
      await app.unmount();
    }
  });

  it("supports zero-typing controls, rapid current sets, contextual rest and prominent pause/resume", async () => {
    const state = Fixture_build();
    state.nosync = true;
    const entry = state.storage.progress[0].entries[0];
    entry.warmupSets = [];
    state.storage.settings.gyms[0].equipment = {};
    state.storage.settings.exerciseData[Exercise_toKey(entry.exercise)] = { rounding: 5 };
    const initialWeight = entry.sets[0].weight?.value ?? 45;
    const initialReps = entry.sets[0].reps ?? 5;
    const { env, bridges } = RenderEnv_build();
    const app = await RenderApp_mount(state, env);
    try {
      expect(screen.getByTestId("devfit-workout-status")).toBeTruthy();
      await app.press("devfit-workout-pause-resume");
      expect(screen.getByText("Workout active")).toBeTruthy();

      await app.press("devfit-weight-plus");
      await app.press("devfit-reps-plus");
      expect(screen.getByText(`${initialWeight + 5}`)).toBeTruthy();
      expect(screen.getByText(`${initialReps + 1}`)).toBeTruthy();

      await app.completeSet(0);
      expect(screen.queryByTestId("modal-amrap-reps-input")).toBeNull();
      expect(screen.getByTestId("devfit-rest-panel")).toBeTruthy();
      expect(screen.getByTestId("devfit-rest-context")).toBeTruthy();
      const startTimerCallsBefore = bridges.log.names().filter((n) => n === "timer.startTimer").length;
      expect(startTimerCallsBefore).toBe(1);

      await app.completeSet(0);
      const startTimerCallsAfter = bridges.log.names().filter((n) => n === "timer.startTimer").length;
      expect(startTimerCallsAfter).toBe(2);

      await app.press("devfit-workout-pause-resume");
      await app.settle();
      expect(screen.getByTestId("devfit-workout-paused-banner")).toBeTruthy();
      expect(screen.getByText("Workout paused")).toBeTruthy();
      expect(bridges.log.names()).toContain("timer.stopTimer");

      await app.press("devfit-workout-paused-banner");
      await app.settle();
      expect(screen.queryByTestId("devfit-workout-paused-banner")).toBeNull();
      expect(screen.getByText("Workout active")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Weight setup" }));
      await app.settle();
      expect(navigationRef.getCurrentRoute()?.name).toBe("equipmentModal");
    } finally {
      await app.unmount();
    }
  });

  it("uses the anchored day and offers ad-hoc full-body catch-up after missed upper and lower sessions", async () => {
    const { program, schedule } = DevFitRotation_fixture();
    const state = Fixture_build({ program, ongoingWorkout: false });
    state.nosync = true;
    state.storage.settings.devfitSchedules = {
      [program.id]: Schedule_anchor(schedule, 8, Date.now()),
    };
    const { env } = RenderEnv_build();
    const app = await RenderApp_mount(state, env, { start: "home" });
    try {
      expect(screen.getByTestId("devfit-rotation-day-badge")).toBeTruthy();
      expect(screen.getByTestId("devfit-missed-sessions")).toBeTruthy();
      expect(screen.getByTestId("devfit-calendar-mismatch")).toBeTruthy();

      await app.press("devfit-catchup-start");
      await app.settle();
      expect(navigationRef.getCurrentRoute()?.name).toBe("progress");
      expect(screen.getByText("Full-Body Catch-Up")).toBeTruthy();
    } finally {
      await app.unmount();
    }
  });
});
