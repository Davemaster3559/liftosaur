import { expect } from "chai";
import * as v from "valibot";
import { ICompleteSetAction } from "../src/ducks/reducer";
import { IHistoryEntry, IHistoryRecord, VHistoryRecord } from "../src/types";
import { INativeEffect } from "../src/models/nativeEffects";
import { History_clockNow, History_pauseWorkout, History_workoutTime } from "../src/models/history";
import {
  Progress_changeAmrapAction,
  Progress_closeTimedSet,
  Progress_completeSetAction,
  Progress_finishWorkout,
  Progress_isSetTimerCheckDue,
  Progress_resumeWorkout,
  Progress_startSetTimerWork,
} from "../src/models/progress";
import { Program_evaluate, Program_nextHistoryRecord, emptyProgramId } from "../src/models/program";
import {
  RestTimerProgress_at,
  RestTimerProgress_context,
  RestTimerProgress_notice,
} from "../src/models/restTimerProgress";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Storage_getDefault } from "../src/models/storage";
import { Weight_build, Weight_step } from "../src/models/weight";
import { Exercise_toKey } from "../src/models/exercise";
import {
  Schedule_anchor,
  Schedule_dayNumber,
  Schedule_default,
  Schedule_missedSessions,
  Schedule_overview,
  Schedule_slots,
} from "../src/devfit/schedule";
import { CatchUp_build } from "../src/devfit/catchUp";
import { Session_cardioCoaching, Session_kind, Session_phase, Session_switchPhase } from "../src/devfit/presentation";
import { DevFitRotation_fixture } from "./fixtures/devfitRotation";
import { PlannerTestUtils_get } from "./utils/plannerTestUtils";

(globalThis as unknown as { __HOST__: string }).__HOST__ = "https://www.liftosaur.com";

const stats = Stats_getEmpty();
function workout(settings = Settings_build()): IHistoryRecord {
  const { program } = PlannerTestUtils_get("# Week 1\n## Upper A\nBench Press / 3x5 100lb / 60s / warmup: none");
  return Program_nextHistoryRecord(program, settings, stats);
}

function complete(
  progress: IHistoryRecord,
  setIndex: number,
  settings = Settings_build(),
  extra: Partial<ICompleteSetAction> = {}
): { progress: IHistoryRecord; effects: INativeEffect[] } {
  const effects: INativeEffect[] = [];
  const result = Progress_completeSetAction(
    effects,
    settings,
    stats,
    progress,
    {
      type: "CompleteSetAction",
      entryIndex: 0,
      setIndex,
      mode: "workout",
      isPlayground: false,
      forceUpdateEntryIndex: false,
      isExternal: false,
      ...extra,
    },
    undefined
  );
  return { progress: result, effects };
}

describe("DevFit v0.3 gym flow", () => {
  for (const phase of ["work", "getReady"] as const) {
    it(`freezes and restores workout, rest and ${phase} clocks from serialized intervals`, () => {
      const originalNow = Date.now;
      let now = 1_800_000_000_000;
      Date.now = () => now;
      try {
        const settings = Settings_build();
        let progress = Progress_resumeWorkout([], workout(settings), settings);
        const start = now;
        expect(progress.intervals).to.deep.equal([[start, undefined]]);
        expect(progress.entries[0].sets.some((s) => s.isCompleted)).to.equal(false);
        const clock = {
          entryIndex: 0,
          setIndex: 0,
          setId: progress.entries[0].sets[0].id,
          id: "original-phase",
          side: "bilateral" as const,
          startedAt: start,
          nonce: 4,
        };
        progress = {
          ...progress,
          timer: 60,
          timerSince: start,
          timerMode: "workout",
          timerEntryIndex: 0,
          timerSetIndex: 0,
          setTimer: phase === "work" ? clock : undefined,
          setTimerGetReady: phase === "getReady" ? { ...clock, getReady: 30 } : undefined,
        };
        now += 10_000;
        progress = { ...progress, intervals: History_pauseWorkout(progress.intervals) };
        progress = v.parse(VHistoryRecord, JSON.parse(JSON.stringify(progress)));
        now += 120_000;
        expect(History_clockNow(progress)).to.equal(start + 10_000);
        expect(History_workoutTime(progress)).to.equal(10_000);
        expect(
          RestTimerProgress_at(progress.timerSince!, progress.timer!, History_clockNow(progress)).elapsedMs
        ).to.equal(10_000);
        expect(Progress_isSetTimerCheckDue(progress, now)).to.equal(false);
        expect(complete(progress, 0, settings).progress).to.equal(progress);
        expect(Progress_startSetTimerWork(progress, now)).to.equal(progress);
        const effects: INativeEffect[] = [];
        progress = Progress_resumeWorkout(effects, progress, settings);
        expect(progress.timerSince).to.equal(start + 120_000);
        const resumedClock = progress.setTimer ?? progress.setTimerGetReady!;
        expect(resumedClock.startedAt).to.equal(start + 120_000);
        expect(resumedClock.id).not.to.equal(clock.id);
        expect(resumedClock.nonce).to.equal(clock.nonce);
        expect(History_workoutTime(progress)).to.equal(10_000);
        expect(effects.some((e) => e.type === "startTimer")).to.equal(true);
        expect(Progress_resumeWorkout([], progress, settings)).to.equal(progress);
        now += 5_000;
        expect(History_workoutTime(progress)).to.equal(15_000);
      } finally {
        Date.now = originalNow;
      }
    });
  }

  it("starts rest for each rapid current-set completion and preserves it for an older set", () => {
    const settings = Settings_build();
    let first = complete(workout(settings), 0, settings);
    expect(first.progress.entries[0].sets[0].isCompleted).to.equal(true);
    expect(first.effects.some((e) => e.type === "startTimer")).to.equal(true);
    const second = complete(first.progress, 1, settings);
    expect(second.progress.timerSetIndex).to.equal(1);
    expect(second.effects.some((e) => e.type === "startTimer")).to.equal(true);
    first = complete(second.progress, 0, settings, { preserveRest: true });
    const rechecked = complete(first.progress, 0, settings, { preserveRest: true });
    expect(rechecked.progress.entries[0].sets[0].isCompleted).to.equal(true);
    expect(rechecked.progress.timerSince).to.equal(second.progress.timerSince);
    expect(rechecked.progress.timerSetIndex).to.equal(1);
    expect(rechecked.effects).to.deep.equal([]);
  });

  it("retains zero-duration rest and overtime when paused and resumed", () => {
    const settings = Settings_build();
    let progress = complete(workout(settings), 0, settings).progress;
    progress = { ...progress, timer: 0, intervals: History_pauseWorkout(progress.intervals) };
    const effects: INativeEffect[] = [];
    const resumed = Progress_resumeWorkout(effects, progress, settings);
    expect(resumed.timer).to.equal(0);
    expect(resumed.timerSince).not.to.equal(undefined);
    expect(resumed.timerSetIndex).to.equal(0);
    expect(effects.some((e) => e.type === "startTimer")).to.equal(false);
    expect(RestTimerProgress_at(resumed.timerSince!, 0, History_clockNow(resumed)).isTimeOut).to.equal(true);
  });

  it("starts the next exercise's rest when its advertised native action is completed", () => {
    const settings = Settings_build();
    const { program } = PlannerTestUtils_get(
      "# Week 1\n## Day 1\nSquat / 1x5 100lb / 60s / warmup: none\nBench Press / 2x5 80lb / 60s / warmup: none"
    );
    let progress = Program_nextHistoryRecord(program, settings, stats);
    progress = complete(progress, 0, settings).progress;
    const result = complete(progress, 0, settings, { entryIndex: 1, isExternal: true, forceUpdateEntryIndex: true });
    expect(result.progress.timerEntryIndex).to.equal(1);
    expect(result.effects.some((e) => e.type === "startTimer")).to.equal(true);
    const live = result.effects.find((e) => e.type === "updateLiveActivity");
    expect(live && live.type === "updateLiveActivity" ? live.state.historyEntryState?.entryIndex : undefined).to.equal(
      1
    );
  });

  it("keeps the active superset exercise in native controls when starting or resuming without rest", () => {
    const settings = Settings_build();
    const { program } = PlannerTestUtils_get(
      "# Week 1\n## Day 1\nSquat / 2x5 100lb / warmup: none / superset: A\nBench Press / 2x5 80lb / warmup: none / superset: A"
    );
    let progress = Program_nextHistoryRecord(program, settings, stats);
    for (let pass = 0; pass < 2; pass += 1) {
      const effects: INativeEffect[] = [];
      progress = Progress_resumeWorkout(effects, progress, settings);
      const live = effects.find((e) => e.type === "updateLiveActivity");
      expect(
        live && live.type === "updateLiveActivity" ? live.state.historyEntryState?.entryIndex : undefined
      ).to.equal(0);
      progress = { ...progress, intervals: History_pauseWorkout(progress.intervals) };
    }
  });

  it("keeps existing rest after an older timed set is recorded, kept running and closed", () => {
    const settings = Settings_build();
    settings.timers.getReady = 0;
    let progress = complete(workout(settings), 1, settings).progress;
    progress = {
      ...progress,
      timer: 60,
      timerSince: Date.now() - 20_000,
      timerEntryIndex: 0,
      timerSetIndex: 1,
      timerMode: "workout",
    };
    progress.entries[0].sets[0] = { ...progress.entries[0].sets[0], setTimer: 30 };
    const before = { since: progress.timerSince, set: progress.timerSetIndex };
    progress = complete(progress, 0, settings, { preserveRest: true }).progress;
    progress = complete(progress, 0, settings, { keepSetTimerRunning: true, recordedSeconds: 10 }).progress;
    expect(progress.entries[0].sets[0].isCompleted).to.equal(true);
    const effects: INativeEffect[] = [];
    const closed = Progress_closeTimedSet(effects, progress, settings, undefined);
    expect(closed.setTimer).to.equal(undefined);
    expect(closed.timerSince).to.equal(before.since);
    expect(closed.timerSetIndex).to.equal(before.set);
    expect(effects).to.deep.equal([]);
  });

  it("clears old phase laps on a fresh timer attempt and anchors deferred rest at the paused clock", () => {
    const originalNow = Date.now;
    let now = 1_800_000_000_000;
    Date.now = () => now;
    try {
      const settings = Settings_build();
      settings.timers.getReady = 0;
      let progress = workout(settings);
      progress.entries[0].sets[0] = {
        ...progress.entries[0].sets[0],
        setTimer: 30,
        cardioLaps: [{ phase: "jog", elapsedSeconds: 300 }],
      };
      progress = complete(progress, 0, settings).progress;
      expect(progress.entries[0].sets[0].cardioLaps).to.equal(undefined);
      progress = complete(progress, 0, settings, { keepSetTimerRunning: true, recordedSeconds: 10 }).progress;
      now += 15_000;
      progress = { ...progress, intervals: History_pauseWorkout(progress.intervals) };
      now += 120_000;
      progress = Progress_closeTimedSet([], progress, settings, undefined);
      expect(progress.timerSince).to.equal(now - 120_000);
      progress = Progress_resumeWorkout([], progress, settings);
      expect(progress.timerSince).to.equal(now);
    } finally {
      Date.now = originalNow;
    }
  });

  it("keeps explicit AMRAP, RPE and weight prompts and preserves rest when an older prompt resolves", () => {
    const settings = Settings_build();
    let progress = complete(workout(settings), 0, settings).progress;
    progress = complete(progress, 1, settings).progress;
    progress.entries[0].sets[0] = {
      ...progress.entries[0].sets[0],
      isCompleted: false,
      completedReps: undefined,
      completedWeight: undefined,
      completedRpe: undefined,
      isAmrap: true,
      askWeight: true,
      logRpe: true,
    };
    const prompted = complete(progress, 0, settings, { preserveRest: true }).progress;
    expect(prompted.amrapModal).to.include({ isAmrap: true, askWeight: true, logRpe: true, preserveRest: true });
    expect(prompted.entries[0].sets[0].isCompleted).to.equal(false);
    const effects: INativeEffect[] = [];
    const resolved = Progress_changeAmrapAction(
      effects,
      settings,
      stats,
      prompted,
      {
        type: "ChangeAMRAPAction",
        entryIndex: 0,
        setIndex: 0,
        isPlayground: false,
        isAmrap: true,
        askWeight: true,
        logRpe: true,
        amrapValue: 7,
        weightValue: Weight_build(102, "lb"),
        rpeValue: 8,
      },
      undefined
    );
    expect(resolved.entries[0].sets[0]).to.include({ completedReps: 7, completedRpe: 8, isCompleted: true });
    expect(resolved.entries[0].sets[0].completedWeight).to.deep.equal(Weight_build(102, "lb"));
    expect(resolved.timerSince).to.equal(progress.timerSince);
    expect(resolved.timerSetIndex).to.equal(1);
    expect(effects).to.deep.equal([]);
  });

  it("describes warmup and working-set context using the engine's absolute next-set index", () => {
    const settings = Settings_build();
    const progress = workout(settings);
    const entry = progress.entries[0];
    entry.warmupSets = [0, 1].map((index) => ({
      ...entry.sets[0],
      id: `warmup-${index}`,
      index,
      weight: Weight_build(45, "lb"),
      isCompleted: index === 0,
    }));
    progress.timerEntryIndex = 0;
    progress.timerSetIndex = 0;
    progress.timerMode = "warmup";
    expect(RestTimerProgress_context(progress, settings).after).to.include("Warmup 1");
    expect(RestTimerProgress_context(progress, settings).next).to.include("Warmup 2");
    entry.warmupSets[1].isCompleted = true;
    progress.timerSetIndex = 1;
    expect(RestTimerProgress_context(progress, settings).next).to.include("Set 1 · 100lb · 5 reps");
    entry.sets[0].setTimer = 30;
    expect(RestTimerProgress_context(progress, settings).next).to.include("Set 1 · 0:30");
  });

  it("reaches zero, retains overtime and emits one foreground cue across pause and rest adjustments", () => {
    const exact = RestTimerProgress_at(1_000, 60, 61_000);
    expect(exact).to.include({ remainingMs: 0, elapsedMs: 60_000, isTimeOut: true });
    const first = RestTimerProgress_notice({}, "same-set", exact, 60, false, false);
    expect(first.notify).to.equal(true);
    expect(
      RestTimerProgress_notice(first.state, "same-set", RestTimerProgress_at(121_000, 75, 200_000), 75, false, false)
        .notify
    ).to.equal(false);
    expect(RestTimerProgress_at(1_000, 60, 78_000).elapsedMs).to.equal(77_000);
    expect(RestTimerProgress_notice({}, "native", exact, 60, false, true).notify).to.equal(false);
    expect(RestTimerProgress_notice({}, "paused", exact, 60, true, false).notify).to.equal(false);
  });

  it("steps small configured loads and negative assistance without global rounding changes", () => {
    const type = { id: "latPulldown" as const };
    for (const step of [0.5, 1, 2]) {
      const settings = Settings_build();
      settings.gyms[0].equipment = {};
      settings.exerciseData[Exercise_toKey(type)] = { rounding: step };
      expect(Weight_step(Weight_build(12, "kg"), 1, settings, type)).to.deep.equal(Weight_build(12 + step, "kg"));
      expect(Weight_step(Weight_build(-12, "kg"), -1, settings, type)).to.deep.equal(Weight_build(-12 - step, "kg"));
    }
  });

  it("uses irregular machine stacks in their configured unit and stops at the stack limits", () => {
    const settings = Settings_build();
    const gym = settings.gyms[0];
    gym.equipment.barbell = {
      ...gym.equipment.barbell!,
      isFixed: true,
      fixed: [8, 12, 17].map((n) => Weight_build(n, "kg")),
      unit: "kg",
    };
    const type = { id: "latPulldown" as const };
    settings.exerciseData[Exercise_toKey(type)] = { equipment: { [gym.id]: "barbell" } };
    expect(Weight_step(Weight_build(12, "kg"), 1, settings, type)).to.deep.equal(Weight_build(17, "kg"));
    expect(Weight_step(Weight_build(12, "kg"), -1, settings, type)).to.deep.equal(Weight_build(8, "kg"));
    expect(Weight_step(Weight_build(17, "kg"), 1, settings, type).value).to.equal(17);
    expect(Weight_step(Weight_build(8, "kg"), -1, settings, type).value).to.equal(8);
    expect(Weight_step(Weight_build(10, "kg"), 1, settings, type).value).to.equal(12);
    expect(Weight_step(Weight_build(10, "kg"), -1, settings, type).value).to.equal(8);
    expect(Weight_step(Weight_build(26.46, "lb"), 1, settings, type).unit).to.equal("kg");
  });

  it("keeps finite plate inventory authoritative for weight steps", () => {
    const settings = Settings_build();
    const gym = settings.gyms[0];
    gym.equipment.barbell!.unit = "kg";
    gym.equipment.barbell!.bar.kg = Weight_build(20, "kg");
    gym.equipment.barbell!.plates = [
      { weight: Weight_build(1.25, "kg"), num: 2 },
      { weight: Weight_build(5, "kg"), num: 2 },
    ];
    const type = { id: "squat" as const, equipment: "barbell" };
    settings.exerciseData[Exercise_toKey(type)] = { equipment: { [gym.id]: "barbell" } };
    expect(Weight_step(Weight_build(22.5, "kg"), 1, settings, type).value).to.equal(30);
    expect(Weight_step(Weight_build(32.5, "kg"), 1, settings, type).value).to.equal(32.5);
  });

  it("uses the confirmed personal reference to select today's real program day", () => {
    const { program, schedule } = DevFitRotation_fixture();
    const settings = Settings_build();
    const evaluated = Program_evaluate(program, settings);
    expect(Schedule_default(evaluated).anchorDate).to.equal("2026-10-07");
    expect(Schedule_overview(evaluated, settings, [], Date.now()).setupNeeded).to.equal(false);
    const now = new Date(2026, 9, 14, 12).getTime();
    settings.devfitSchedules = { [program.id]: schedule };
    const overview = Schedule_overview(evaluated, settings, [], now);
    expect(overview.today?.day).to.equal(8);
    expect(overview.selectedDay).to.equal(6);
    expect(overview.mismatch).to.equal(true);
    expect(overview.canCatchUp).to.equal(true);
    expect(overview.missed.map((m) => m.area)).to.include.members(["upper", "lower", "cardio"]);
    expect(Schedule_overview(evaluated, settings, [], now).today?.day).to.equal(8);
    for (const day of [2, 7, 11]) {
      const date = new Date(2026, 9, 6 + day, 12).getTime();
      const recovery = Schedule_overview(evaluated, settings, [], date);
      expect(recovery.recovery).to.equal(true);
      expect(recovery.canCatchUp).to.equal(false);
      expect(recovery.selectedDay).to.equal(undefined);
    }
    expect(Schedule_missedSessions(evaluated, settings, [], now).some((m) => [2, 7, 11].includes(m.day))).to.equal(
      false
    );
    const anchored = Schedule_anchor(schedule, 8, now);
    expect(Schedule_dayNumber(anchored.anchorDate, 14, now)).to.equal(8);
  });

  it("resolves a strength session logged later without shifting the schedule or treating old-cycle records as current", () => {
    const { program, schedule } = DevFitRotation_fixture();
    const settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
    const evaluated = Program_evaluate(program, settings);
    const now = new Date(2026, 9, 14, 12).getTime();
    const late = Program_nextHistoryRecord({ ...program, nextDay: 2 }, settings, stats);
    late.startTime = new Date(2026, 9, 13, 12).getTime();
    late.entries[0].sets[0].isCompleted = true;
    const slots = Schedule_slots(evaluated, settings, [late], now);
    expect(slots[2]).to.include({ completed: false, completedLate: false, missed: true });
    late.devfitScheduleCredit = { programId: program.id, scheduledDate: "2026-10-09", rotationDay: 3, programDay: 2 };
    expect(Schedule_slots(evaluated, settings, [late], now)[2]).to.include({
      completed: true,
      completedLate: true,
      missed: false,
    });
    expect(Schedule_missedSessions(evaluated, settings, [late], now).some((m) => m.programDay === 2)).to.equal(false);
    expect(Schedule_overview(evaluated, settings, [late], now).canCatchUp).to.equal(false);
    expect(Schedule_slots(evaluated, settings, [late], now + 14 * 86400000)[2].completed).to.equal(false);
  });

  it("does not recommend full-body work for cardio/recovery gaps and finishes catch-up without changing the main program", () => {
    const { program, schedule } = DevFitRotation_fixture();
    const storage = Storage_getDefault();
    storage.programs = [program];
    storage.currentProgramId = program.id;
    storage.settings.devfitSchedules = { [program.id]: schedule };
    const evaluated = Program_evaluate(program, storage.settings);
    expect(Schedule_overview(evaluated, storage.settings, [], new Date(2026, 9, 7, 12).getTime()).canCatchUp).to.equal(
      false
    );
    const before = JSON.stringify(storage.programs);
    const progress = CatchUp_build(evaluated, storage.settings, storage.stats, true);
    expect(progress.programId).to.equal(emptyProgramId);
    expect(progress.catchUpFor).to.equal(program.id);
    expect(progress.entries).to.have.length(7);
    expect(progress.entries.slice(0, 6).reduce((n, e) => n + e.sets.length, 0)).to.equal(15);
    expect(progress.entries[6].sets[0].setTimer).to.equal(600);
    progress.entries[0].sets[0] = {
      ...progress.entries[0].sets[0],
      isCompleted: true,
      completedReps: 10,
      completedWeight: progress.entries[0].sets[0].weight,
    };
    const finished = Progress_finishWorkout([], storage, progress);
    expect(JSON.stringify(finished.programs)).to.equal(before);
    expect(finished.currentProgramId).to.equal(program.id);
    expect(finished.history[0].dayName).to.equal("Full-Body Catch-Up");
    expect(finished.history[0].catchUpFor).to.equal(program.id);
    expect(v.parse(VHistoryRecord, JSON.parse(JSON.stringify(finished.history[0]))).catchUpFor).to.equal(program.id);
  });

  it("recognizes running variants, reads live continuous targets and retains explicit plan instructions", () => {
    for (const name of ["Run A", "Run B", "runA", "runA2", "runB", "runB2", "Running", "Jog", "Treadmill Run"]) {
      expect(Session_kind(name)).to.equal("running");
    }
    expect(Session_kind("Bicycle Crunch")).to.equal("strength");
    const settings = Settings_build();
    const progress = workout(settings);
    const entry: IHistoryEntry = {
      ...progress.entries[0],
      exercise: { id: "cycling" as const },
      state: { continuousMinutes: 8 },
      sets: [{ ...progress.entries[0].sets[0], setTimer: 1800, label: "runA2" }],
      descriptionSnapshot: "Keep today's effort conversational.",
    };
    expect(Session_cardioCoaching(undefined, entry, settings).mainTarget).to.include("8:00");
    entry.state = { continuousMinutes: 10 };
    const coaching = Session_cardioCoaching(undefined, entry, settings);
    expect(coaching.mainTarget).to.include("10:00");
    expect(coaching.instructions).to.equal(entry.descriptionSnapshot);
    expect(coaching.mainTarget).not.to.match(/mph|km\/h/);
    const set = Session_switchPhase(entry.sets[0], 300);
    expect(Session_phase(set, 330)).to.deep.equal({ phase: "jog", seconds: 30 });
    entry.sets[0] = Session_switchPhase(set, 420);
    const reopened = v.parse(VHistoryRecord, JSON.parse(JSON.stringify({ ...progress, entries: [entry] })));
    expect(Session_phase(reopened.entries[0].sets[0], 430)).to.deep.equal({ phase: "walk", seconds: 10 });
  });
});
