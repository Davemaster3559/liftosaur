import { fireEvent, screen } from "@testing-library/react-native";
import * as RN from "react-native";
import { DevFitPersonalPlan_fixture } from "../test/fixtures/devfitPersonalPlan";
import { Fixture_build } from "./harness/fixture";
import { RenderApp_mount } from "./harness/renderApp";
import { RenderEnv_build } from "./harness/renderEnv";
import { Schedule_anchor } from "../src/devfit/schedule";
import { navigationRef } from "../src/navigation/navigationRef";

describe("DevFit v0.5 connected personal plan", () => {
  for (const width of [360, 960]) {
    it(`previews and applies the existing plan, keeps bench pending and opens the real logger at width ${width}`, async () => {
      const previous = RN.Dimensions.get("window");
      RN.Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 } });
      const { program, schedule } = DevFitPersonalPlan_fixture();
      const state = Fixture_build({ program, ongoingWorkout: false });
      state.nosync = true;
      state.storage.settings.devfitSchedules = { [program.id]: Schedule_anchor(schedule, 3, Date.now()) };
      const { env } = RenderEnv_build();
      const app = await RenderApp_mount(state, env, { start: "home" });
      try {
        await fireEvent.press(screen.getByRole("button", { name: "Update my existing plan" }));
        expect(screen.getByText("Review your plan update")).toBeTruthy();
        expect(screen.getByText(/8 → 10 → 12 → 15 earned reps/)).toBeTruthy();
        await app.press("devfit-apply-plan-upgrade");
        await app.settle();
        await app.tapFooter("program");
        await fireEvent.press(screen.getByRole("button", { name: "Plan setup · baselines and equipment" }));
        expect(screen.getByText("Your v0.5 plan")).toBeTruthy();
        expect(screen.getByText("Abdominal bench · identification pending")).toBeTruthy();
        expect(screen.getByLabelText(/Sit-up bench: face upward/)).toBeTruthy();
        expect(screen.getByLabelText(/Back-extension bench: face downward/)).toBeTruthy();
        await fireEvent.press(screen.getByRole("button", { name: "Still unsure · leave pending" }));
        expect(screen.getByText(/Bench choice remains pending/)).toBeTruthy();
        await app.tapFooter("home");
        await app.press("devfit-start-session");
        await app.settle();
        expect(screen.getByTestId("devfit-set-comparison")).toBeTruthy();
        await app.press("devfit-view-progression");
        expect(screen.getByText(/Every original working set|Earn 8 → 10 → 12 → 15 reps/)).toBeTruthy();
        expect(navigationRef.getCurrentRoute()?.name).toBe("progress");
        await fireEvent.press(screen.getByRole("button", { name: "Edit progression / calibrate" }));
        await fireEvent.changeText(screen.getByLabelText("Available working load (lb)"), "999");
        await fireEvent.press(screen.getByRole("button", { name: /^Seated Row, 0 of \d+ sets$/ }));
        expect(screen.queryByLabelText("Available working load (lb)")).toBeNull();
        await fireEvent.press(screen.getByRole("button", { name: "Edit progression / calibrate" }));
        expect(screen.getByLabelText("Available working load (lb)").props.value).toBe("70");
        expect(screen.getByRole("button", { name: "✓ 10 reps" })).toBeTruthy();
        await fireEvent.press(screen.getByRole("button", { name: "Close progression setup" }));
        await fireEvent.press(screen.getByRole("button", { name: "Count toward another training day" }));
        await fireEvent.changeText(screen.getByTestId("training-date-choice"), "2026-10-17");
        await fireEvent.press(screen.getByRole("button", { name: "Use this training date" }));
        expect(screen.getByText(/Training date · .*assigned by you/)).toBeTruthy();
        expect(screen.getByTestId("devfit-set-comparison")).toBeTruthy();
      } finally {
        await app.unmount();
        RN.Dimensions.set({ window: previous });
      }
    });
  }
});
