import { fireEvent, screen } from "@testing-library/react-native";
import * as RN from "react-native";
import { Fixture_build } from "./harness/fixture";
import { RenderApp_mount } from "./harness/renderApp";
import { RenderEnv_build } from "./harness/renderEnv";
import { DevFitRotation_fixture } from "../test/fixtures/devfitRotation";
import { Schedule_anchor } from "../src/devfit/schedule";
import { HealthAdapter } from "../src/utils/health";
import { navigationRef } from "../src/navigation/navigationRef";
import { Dates_label } from "../src/devfit/dates";

describe("DevFit past cardio through the native application", () => {
  it("retains the successor clock when an auto cardio entry advances into a multi-set entry", async () => {
    const { program } = DevFitRotation_fixture();
    program.nextDay = 4;
    const state = Fixture_build({ program });
    state.nosync = true;
    state.storage.settings.timers.getReady = 0;
    const record = state.storage.progress[0];
    record.entries[0].sets[0] = { ...record.entries[0].sets[0], auto: true, timer: 0, setTimer: 30 };
    record.entries[1].sets = [0, 1].map((index) => ({
      ...record.entries[1].sets[0],
      id: `bike-${index}`,
      index,
      auto: false,
      timer: 0,
      setTimer: 30,
    }));
    const { env } = RenderEnv_build();
    const app = await RenderApp_mount(state, env);
    try {
      await app.press("start-set-timer");
      await app.settle();
      await app.press("set-timer-stop-record");
      await app.settle();
      expect(screen.getByTestId("devfit-cardio-timer")).toBeTruthy();
      expect(screen.queryByTestId("devfit-cardio-form")).toBeNull();
      await app.press("set-timer-stop-record");
      await app.settle();
      expect(screen.queryByTestId("devfit-cardio-form")).toBeNull();
      expect(screen.getByTestId("devfit-workout")).toBeTruthy();
      expect(screen.getAllByTestId("set-completed")).toHaveLength(1);
      await app.press("start-set-timer");
      await app.settle();
      await app.press("set-timer-stop-record");
      await app.settle();
      expect(screen.getByTestId("devfit-cardio-form")).toBeTruthy();
      expect(screen.getByTestId("cardio-date").props.editable).toBe(false);
      expect(screen.getByTestId("cardio-minutes").props.editable).toBe(false);
      await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      await app.settle();
      expect(screen.getAllByTestId("set-completed")).toHaveLength(2);
    } finally {
      await app.unmount();
    }
  });
  for (const width of [360, 960]) {
    it(`saves, reopens, edits and deletes a past Run A at width ${width} without touching live timers or health`, async () => {
      const previous = RN.Dimensions.get("window");
      RN.Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 } });
      const { program, schedule } = DevFitRotation_fixture();
      const state = Fixture_build({ program });
      state.nosync = true;
      state.storage.settings.devfitSchedules = { [program.id]: Schedule_anchor(schedule, 12, Date.now()) };
      state.storage.settings.healthConfirmation = true;
      state.storage.settings.googleHealthSyncWorkout = true;
      const { env, bridges } = RenderEnv_build();
      env.health = new HealthAdapter();
      const saveHealth = jest.spyOn(env.health, "saveWorkout").mockResolvedValue(undefined);
      const app = await RenderApp_mount(state, env, { start: "home" });
      try {
        const beforeEffects = bridges.log.names().filter((s) => /^(timer|workout)\./.test(s));
        await app.press("devfit-log-past");
        await fireEvent.changeText(screen.getByTestId("cardio-date"), "2026-10-16");
        await fireEvent.press(screen.getByRole("button", { name: "Run A" }));
        await fireEvent.changeText(screen.getByTestId("cardio-minutes"), "30");
        await fireEvent.press(screen.getByRole("button", { name: "Add optional details" }));
        await fireEvent.changeText(screen.getByLabelText("Walking minutes"), "16");
        await fireEvent.changeText(screen.getByLabelText("Jog / run minutes"), "14");
        await fireEvent.changeText(screen.getByLabelText("Longest uninterrupted jog (minutes)"), "8");
        await fireEvent.changeText(screen.getByLabelText("Walk incline (%)"), "5");
        await fireEvent.changeText(screen.getByLabelText("Jog incline (%)"), "3.5");
        await app.press("cardio-save");
        await app.settle();
        expect(screen.getByText("Manually logged · local only")).toBeTruthy();
        expect(screen.getByText("30 min")).toBeTruthy();
        expect(screen.getByText("8 min")).toBeTruthy();
        expect(screen.getByText(`${Dates_label("2026-10-16")} · date only`)).toBeTruthy();
        await fireEvent.press(screen.getByRole("button", { name: "Edit activity" }));
        expect(screen.getByTestId("cardio-date").props.value).toBe("2026-10-16");
        expect(screen.getByLabelText("Jog incline (%)").props.value).toBe("3.5");
        await fireEvent.changeText(screen.getByTestId("cardio-minutes"), "32");
        await app.press("cardio-save");
        await app.settle();
        expect(screen.getByText("32 min")).toBeTruthy();
        expect(bridges.log.names().filter((s) => /^(timer|workout)\./.test(s))).toEqual(beforeEffects);
        expect(saveHealth).not.toHaveBeenCalled();
        await fireEvent.press(screen.getByRole("button", { name: "Delete activity" }));
        await fireEvent.press(screen.getByRole("button", { name: "Confirm delete activity" }));
        await app.settle();
        expect(screen.getByText(/No cardio recorded yet/)).toBeTruthy();
        await fireEvent.press(screen.getByRole("button", { name: "Close activity log" }));
        expect(screen.getByTestId("devfit-today")).toBeTruthy();
        await app.tapFooter("workout");
        await app.settle();
        expect(screen.getByTestId("devfit-workout")).toBeTruthy();
      } finally {
        await app.unmount();
        saveHealth.mockRestore();
        RN.Dimensions.set({ window: previous });
      }
    });
  }
  it("offers the past log from Schedule and Progress, and keeps kind-specific charts separate", async () => {
    const { program, schedule } = DevFitRotation_fixture();
    const state = Fixture_build({ program, ongoingWorkout: false });
    state.nosync = true;
    state.storage.settings.devfitSchedules = { [program.id]: schedule };
    const { env } = RenderEnv_build();
    const app = await RenderApp_mount(state, env, { start: "home" });
    try {
      await app.tapFooter("program");
      expect(screen.getByTestId("devfit-log-past")).toBeTruthy();
      await app.tapFooter("graphs");
      expect(screen.getByTestId("devfit-log-past")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Stairs" }));
      expect(screen.getByRole("button", { name: "Reported steps" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Virtual distance (km)" })).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Bike" }));
      expect(screen.getByRole("button", { name: "Virtual distance (km)" })).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Row" }));
      expect(screen.getByRole("button", { name: "Seconds / 500 m" })).toBeTruthy();
      expect(navigationRef.getCurrentRoute()?.name).toBe("graphsList");
    } finally {
      await app.unmount();
    }
  });
});
