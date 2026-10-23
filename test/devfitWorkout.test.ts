import { expect } from "chai";
import { getInitialState, IAction } from "../src/ducks/reducer";
import { DevFitService } from "../src/devfit/service";
import { DevFit_localClient } from "../src/devfit/localClient";
import { MockAudioInterface } from "../src/lib/audioInterface";
import { Program_evaluate, Program_getProgramExercise, Program_nextHistoryRecord } from "../src/models/program";
import { Progress_getProgress } from "../src/models/progress";
import { IEnv, IState } from "../src/models/state";
import { Storage_getDefault } from "../src/models/storage";
import { Subscriptions_hasSubscription } from "../src/utils/subscriptions";
import { AsyncQueue } from "../src/utils/asyncQueue";
import { HeartRateStore } from "../src/utils/heartRateStore";
import { Persistence, IPersistenceStore } from "../src/utils/persistence";
import { MockBridges_build } from "./utils/mockBridges";
import { MockReducer } from "./utils/mockReducer";
import { PlannerTestUtils_get } from "./utils/plannerTestUtils";
import { Thunk_pauseWorkout, Thunk_restoreWorkout } from "../src/ducks/thunks";
import { History_isActivelyPaused } from "../src/models/history";
import { Weight_build } from "../src/models/weight";

(globalThis as unknown as { __HOST__: string }).__HOST__ = "https://www.liftosaur.com";

describe("DevFit offline workout lifecycle", () => {
  it("recovers an active workout, applies progression and reloads completed history without a cloud account", async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    // The native reducer persists through the window shim installed by App.native.
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
    const data: Record<string, string> = {};
    const store: IPersistenceStore = {
      get: async (key) => data[key],
      getAllKeys: async () => Object.keys(data),
      setMany: async (pairs) => {
        for (const [key, value] of pairs) {
          if (value == null) {
            delete data[key];
          } else {
            data[key] = value;
          }
        }
      },
    };
    let networkCalls = 0;
    const offline = DevFit_localClient(async () => {
      networkCalls += 1;
      throw new Error("No internet available");
    });
    const persistence = new Persistence(store);
    const reopenedPersistence = new Persistence(store);
    const bridges = MockBridges_build();
    const env: IEnv = {
      service: new DevFitService(offline),
      audio: new MockAudioInterface(),
      queue: new AsyncQueue(),
      persistence,
      timer: bridges.timer,
      workout: bridges.workout,
      watch: bridges.watch,
      keychain: bridges.keychain,
      mirroring: bridges.mirroring,
      heartRate: new HeartRateStore(bridges.mirroring),
    };
    const url = new URL("https://www.liftosaur.com/app/?nosync=true");
    const { program } = PlannerTestUtils_get("# Week 1\n## Day 1\nSquat / 3x5 100lb / 60s / progress: lp(5lb)");
    const storage = Storage_getDefault();
    storage.programs = [program];
    storage.currentProgramId = program.id;
    storage.settings.devfitCycleDays = 10;
    storage.settings.devfitCycleTarget = 5;
    storage.settings.devfitSchedules = {
      [program.id]: { cycleDays: 14, anchorDate: "2026-10-05", days: [{ day: 3, programDay: 1, context: "off" }] },
    };
    storage.settings.exercises["devfit-personal-cable"] = {
      vtype: "custom_exercise",
      id: "devfit-personal-cable",
      name: "My cable lateral raise",
      isDeleted: false,
      meta: { bodyParts: ["Shoulders"], targetMuscles: ["Deltoid Lateral"], synergistMuscles: [] },
    };
    storage.stats.weight.weight = [{ vtype: "stat", value: Weight_build(80, "kg"), timestamp: 1_790_000_000_000 }];
    storage.stats.length.waist = [{ vtype: "stat", value: { value: 90, unit: "cm" }, timestamp: 1_790_000_000_000 }];
    const retainedProfile = JSON.parse(
      JSON.stringify({
        gyms: storage.settings.gyms,
        exercises: storage.settings.exercises,
        stats: storage.stats,
        schedules: storage.settings.devfitSchedules,
      })
    );
    const completeSet = (state: IState, setIndex: number): IAction => {
      const progress = Progress_getProgress(state)!;
      const currentProgram = state.storage.programs[0];
      return {
        type: "CompleteSetAction",
        entryIndex: 0,
        setIndex,
        programExercise: Program_getProgramExercise(
          progress.day,
          Program_evaluate(currentProgram, state.storage.settings),
          progress.entries[0].programExerciseId
        ),
        mode: "workout",
        isPlayground: false,
        forceUpdateEntryIndex: false,
        isExternal: false,
      };
    };
    try {
      const initial = await getInitialState(offline, { url, storage, deviceId: "first-launch" });
      const app = MockReducer.build(initial, env);
      await app.run([{ type: "StartProgramDayAction" }]);
      expect(Progress_getProgress(app.state)!.intervals).to.have.length(1);
      expect(Progress_getProgress(app.state)!.intervals![0][1]).to.equal(undefined);
      expect(Progress_getProgress(app.state)!.entries[0].sets.some((set) => set.isCompleted)).to.equal(false);
      expect(bridges.log.names()).to.include("workout.resumeWorkout");
      await app.run([completeSet(app.state, 0)]);
      expect(bridges.log.names()).to.include("timer.startTimer");
      expect(bridges.log.names()).to.include("workout.updateLiveActivity");
      expect(Subscriptions_hasSubscription(app.state.storage.subscription)).to.equal(false);
      await app.run([Thunk_pauseWorkout()]);
      expect(History_isActivelyPaused(Progress_getProgress(app.state)!.intervals)).to.equal(true);
      await persistence.flushSave();

      const baseKey = `liftosaur_${data.current_account}`;
      const saved = await reopenedPersistence.load(baseKey, true);
      expect(saved).not.to.equal(undefined);
      const reopened = await getInitialState(offline, { url, localStorage: saved, deviceId: "reopened" });
      expect(reopened.errors.corruptedstorage).to.equal(undefined);
      expect(Progress_getProgress(reopened)!.entries[0].sets[0].completedReps).to.equal(5);
      expect(reopened.storage.settings.devfitCycleDays).to.equal(10);
      const resumed = MockReducer.build(reopened, { ...env, persistence: reopenedPersistence });
      bridges.log.reset();
      await resumed.run([Thunk_restoreWorkout()]);
      expect(bridges.log.names()).to.include("workout.pauseWorkout");
      expect(bridges.log.names()).not.to.include("timer.startTimer");
      expect(History_isActivelyPaused(Progress_getProgress(resumed.state)!.intervals)).to.equal(true);
      await resumed.run([{ type: "ResumeWorkoutAction", isPlayground: false, hasSubscription: false }]);
      expect(bridges.log.names()).to.include("timer.startTimer");
      await resumed.run([completeSet(resumed.state, 1), completeSet(resumed.state, 2)]);
      await resumed.run([{ type: "FinishProgramDayAction", id: 0 }]);
      await reopenedPersistence.flushSave();

      const completed = await new Persistence(store).load(baseKey, true);
      const finalState = await getInitialState(offline, { url, localStorage: completed, deviceId: "after-finish" });
      expect(finalState.storage.history).to.have.length(1);
      expect(finalState.storage.history[0].entries[0].sets.map((set) => set.completedReps)).to.eql([5, 5, 5]);
      expect(Progress_getProgress(finalState)).to.equal(undefined);
      expect(finalState.storage.currentProgramId).to.equal(program.id);
      expect(finalState.storage.settings.devfitCycleTarget).to.equal(5);
      expect(
        JSON.parse(
          JSON.stringify({
            gyms: finalState.storage.settings.gyms,
            exercises: finalState.storage.settings.exercises,
            stats: finalState.storage.stats,
            schedules: finalState.storage.settings.devfitSchedules,
          })
        )
      ).to.deep.equal(retainedProfile);
      const next = Program_nextHistoryRecord(
        finalState.storage.programs[0],
        finalState.storage.settings,
        finalState.storage.stats
      );
      expect(next.entries[0].sets.map((set) => set.weight?.value)).to.eql([105, 105, 105]);
      expect(finalState.user).to.equal(undefined);
      expect(networkCalls).to.equal(0);
    } finally {
      persistence.cancelSave();
      reopenedPersistence.cancelSave();
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });
});
