import { expect } from "chai";
import * as v from "valibot";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Storage_get, Storage_getDefault } from "../src/models/storage";
import { Program_evaluate, Program_nextHistoryRecord } from "../src/models/program";
import { ISet, IDevFitSchedule } from "../src/types";
import { Dates_add, Dates_key, Dates_timestamp, Dates_validTime } from "../src/devfit/dates";
import {
  Schedule_dayNumber,
  Schedule_default,
  Schedule_get,
  Schedule_overview,
  Schedule_slots,
  Schedule_suggestion,
} from "../src/devfit/schedule";
import {
  Cardio_breakdown,
  Cardio_duration,
  Cardio_fromSet,
  Cardio_manualRecord,
  Cardio_meters,
  Cardio_mirror,
  Cardio_nearDuplicates,
  Cardio_speedKmh,
  Cardio_applyPhase,
  Cardio_editDuration,
  Cardio_historyDate,
  Cardio_liveSet,
  Cardio_entryActivity,
  Cardio_entryDetails,
} from "../src/devfit/cardio";
import { CardioForm_build, CardioForm_draft, CardioForm_submission } from "../src/devfit/cardioForm";
import { CardioProgress_compare, CardioProgress_metric, CardioProgress_records } from "../src/devfit/cardioProgress";
import { ICardioActivity, VCardioActivity } from "../src/devfit/cardioSchema";
import { Analytics_summary } from "../src/devfit/analytics";
import { Cycle_summary } from "../src/devfit/cycle";
import {
  History_getPersonalRecords,
  History_clockNow,
  History_pauseWorkout,
  History_getDateToHistory,
  History_getHistoryRecordsForTimerange,
} from "../src/models/history";
import { CardioFinish_step } from "../src/devfit/cardioFinish";
import { Progress_checkSetTimer, Progress_completeSetAction, Progress_resumeWorkout } from "../src/models/progress";
import { Session_switchPhase } from "../src/devfit/presentation";
import { DevFitRotation_fixture } from "./fixtures/devfitRotation";
import { PlannerTestUtils_get } from "./utils/plannerTestUtils";
import { CardioActions_credit, CardioActions_delete, CardioActions_save } from "../src/devfit/cardioActions";
import { buildState, IEnv } from "../src/models/state";
import { MockReducer } from "./utils/mockReducer";
import { MockBridges_build } from "./utils/mockBridges";
import { MockAudioInterface } from "../src/lib/audioInterface";
import { DevFitService } from "../src/devfit/service";
import { AsyncQueue } from "../src/utils/asyncQueue";
import { Persistence } from "../src/utils/persistence";
import { HeartRateStore } from "../src/utils/heartRateStore";
import { HealthAdapter } from "../src/utils/health";

(globalThis as unknown as { __HOST__: string }).__HOST__ = "https://www.liftosaur.com";
const zone = "America/Edmonton";
const now = Dates_timestamp("2026-10-18", zone, "15:00");
function activity(patch: Partial<ICardioActivity> = {}): ICardioActivity {
  return {
    schemaVersion: 1,
    kind: "treadmill",
    runPlan: "run_a",
    recordingMode: "manual",
    datePrecision: "date",
    performedLocalDate: "2026-10-16",
    timeZone: zone,
    actualDurationSeconds: 1800,
    ...patch,
  };
}
function setup(): {
  program: ReturnType<typeof DevFitRotation_fixture>["program"];
  schedule: IDevFitSchedule;
  settings: ReturnType<typeof Settings_build> & { devfitSchedules: Record<string, IDevFitSchedule> };
  evaluated: ReturnType<typeof Program_evaluate>;
  stats: ReturnType<typeof Stats_getEmpty>;
} {
  const { program, schedule } = DevFitRotation_fixture();
  const settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
  return { program, schedule, settings, evaluated: Program_evaluate(program, settings), stats: Stats_getEmpty() };
}

describe("DevFit v0.4 actual calendar and historical cardio integration", () => {
  it("runs real history save/edit/credit/delete actions without changing the active workout, program or Health", async () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
    try {
      const { program, settings, stats, evaluated } = setup();
      const storage = Storage_getDefault();
      storage.programs = [program];
      storage.currentProgramId = program.id;
      storage.settings = settings;
      storage.settings.googleHealthSyncWorkout = true;
      storage.progress = [Program_nextHistoryRecord(program, settings, stats)];
      const originalProgress = JSON.stringify(storage.progress);
      const originalProgram = JSON.stringify(storage.programs);
      const bridges = MockBridges_build();
      let healthWrites = 0;
      const health = new HealthAdapter();
      health.saveWorkout = async () => {
        healthWrites += 1;
      };
      const env: IEnv = {
        service: new DevFitService(async () => {
          throw new Error("Unexpected network");
        }),
        audio: new MockAudioInterface(),
        queue: new AsyncQueue(),
        persistence: new Persistence(),
        timer: bridges.timer,
        workout: bridges.workout,
        watch: bridges.watch,
        keychain: bridges.keychain,
        mirroring: bridges.mirroring,
        heartRate: new HeartRateStore(bridges.mirroring),
        health,
      };
      const app = MockReducer.build(buildState({ storage, nosync: true, deviceId: "manual-cardio-test" }), env);
      await app.run([CardioActions_save(activity({ runPlan: "run_b" }))]);
      const record = app.state.storage.history[0];
      expect(record).not.to.equal(undefined);
      await app.run([
        CardioActions_credit(record.id, {
          programId: program.id,
          scheduledDate: "2026-10-12",
          rotationDay: 6,
          programDay: 5,
        }),
      ]);
      expect(
        Schedule_slots(evaluated, app.state.storage.settings, app.state.storage.history, now)[5].completed
      ).to.equal(true);
      await app.run([CardioActions_save(activity({ actualDurationSeconds: 1200, runPlan: "run_b" }), record.id)]);
      expect(app.state.storage.history).to.have.length(1);
      expect(Analytics_summary(app.state.storage.history, settings, stats, evaluated, now).cardioSeconds).to.equal(
        1200
      );
      expect(JSON.stringify(app.state.storage.progress)).to.equal(originalProgress);
      expect(JSON.stringify(app.state.storage.programs)).to.equal(originalProgram);
      expect(app.state.storage.settings.devfitSchedules).to.deep.equal(settings.devfitSchedules);
      expect(healthWrites).to.equal(0);
      expect(bridges.log.names().filter((s) => /^(timer|workout)\./.test(s))).to.deep.equal([]);
      await app.run([CardioActions_delete(record.id)]);
      expect(app.state.storage.history).to.have.length(0);
      expect(JSON.stringify(app.state.storage.progress)).to.equal(originalProgress);
    } finally {
      if (previousWindow) {
        Object.defineProperty(globalThis, "window", previousWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });
  for (const [date, day, context, session] of [
    ["2026-10-07", 1, "work", "Run A"],
    ["2026-10-18", 12, "work", "Run B"],
    ["2026-10-19", 13, "off", "Upper A"],
    ["2026-10-20", 14, "off", "Lower A"],
    ["2026-10-21", 1, "work", "Run A"],
  ] as const) {
    it(`${date} = Day ${day} / ${context} / ${session} with no completed workouts`, () => {
      const { evaluated, settings, program } = setup();
      const before = JSON.stringify(program);
      const overview = Schedule_overview(evaluated, settings, [], Dates_timestamp(date, zone));
      expect(overview.today).to.include({ day, context });
      expect(overview.today?.session?.name).to.equal(session);
      expect(JSON.stringify(program)).to.equal(before);
      expect(overview.missed.some((m) => [2, 7, 11].includes(m.day))).to.equal(false);
    });
  }
  it("keeps Oct 10 Upper A and Oct 15 Upper B as mismatches, without inventing an Oct 8 reference", () => {
    const { program, settings, evaluated, stats } = setup();
    const history = [
      [2, "2026-10-10"],
      [6, "2026-10-15"],
    ].map(([day, date]) => {
      const r = Program_nextHistoryRecord({ ...program, nextDay: Number(day) }, settings, stats);
      r.vtype = "history_record";
      r.startTime = Dates_timestamp(String(date), zone);
      r.entries[0].sets[0].isCompleted = true;
      return r;
    });
    const o = Schedule_overview(evaluated, settings, history, now);
    expect(o.today?.day).to.equal(12);
    expect(o.slots[3].completed).to.equal(false);
    expect(o.slots[3].mismatched[0].dayName).to.equal("Upper A");
    expect(o.slots[8].mismatched[0].dayName).to.equal("Upper B");
    expect(o.slots[2].completed).to.equal(false);
    expect(o.slots[7].completed).to.equal(false);
    expect(o.config.anchorDate).to.equal("2026-10-07");
  });
  it("reconciles only the old personal reference and preserves manual assignments and later confirmed corrections", () => {
    const { evaluated, settings, program, schedule } = setup();
    const edited = {
      ...schedule,
      referenceSource: undefined,
      anchorDate: "2026-10-08",
      homeTimeZone: "UTC",
      days: schedule.days.map((s) => (s.day === 5 ? { ...s, programDay: 3, context: "work" as const } : s)),
    };
    settings.devfitSchedules[program.id] = edited;
    const resolved = Schedule_get({ ...evaluated, name: "My renamed plan" }, settings);
    expect(resolved.anchorDate).to.equal("2026-10-07");
    expect(resolved.homeTimeZone).to.equal(zone);
    expect(resolved.days).to.deep.equal(edited.days);
    settings.devfitSchedules[program.id] = { ...resolved, anchorDate: "2026-10-09", referenceSource: "confirmed" };
    expect(Schedule_get(evaluated, settings).anchorDate).to.equal("2026-10-09");
    expect(Schedule_default({ ...evaluated, name: "Renamed" }).days[11].programDay).to.equal(5);
  });
  it("does not guess unknown rotations from ambiguous or weak history and respects dismissal", () => {
    const { program } = PlannerTestUtils_get("# Week\n## Upper\nBench Press / 1x5 100lb");
    const settings = Settings_build();
    const evaluated = Program_evaluate(program, settings);
    expect(Schedule_get(evaluated, settings).anchorDate).to.equal(undefined);
    expect(Schedule_suggestion(evaluated, settings, [], now).confidence).to.equal("low");
    expect(Schedule_overview(evaluated, settings, [], now).setupNeeded).to.equal(true);
    settings.devfitSchedules = { [program.id]: { ...Schedule_default(evaluated), setupDismissed: true } };
    expect(Schedule_overview(evaluated, settings, [], now).setupNeeded).to.equal(false);
  });
  it("uses home midnight and calendar-day arithmetic through DST and repeated cycles", () => {
    expect(Dates_key(Date.parse("2026-10-19T05:59:59Z"), zone)).to.equal("2026-10-18");
    expect(Schedule_dayNumber("2026-10-07", 14, Date.parse("2026-10-19T05:59:59Z"), zone)).to.equal(12);
    expect(Schedule_dayNumber("2026-10-07", 14, Date.parse("2026-10-19T06:00:00Z"), zone)).to.equal(13);
    for (const date of ["2026-03-08", "2026-11-01", "2027-03-14", "2027-11-07"]) {
      expect(Schedule_dayNumber(date, 14, Dates_timestamp(Dates_add(date, 1), zone, "00:01"), zone)).to.equal(2);
      expect(Schedule_dayNumber(date, 14, Dates_timestamp(Dates_add(date, 28), zone), zone)).to.equal(1);
    }
    expect(Dates_key(Dates_timestamp("2026-10-16", zone), "Asia/Tokyo")).not.to.equal("2026-10-16");
  });
  it("saves actual Run A, edits/deletes totals, preserves date precision and allows two sessions with a duplicate warning", () => {
    const { settings, evaluated, stats } = setup();
    const record = Cardio_manualRecord(
      activity({
        walkSeconds: 960,
        jogSeconds: 840,
        longestJogSeconds: 480,
        walk: { speed: { value: 2.5, unit: "mph" }, inclinePercent: 5 },
        jog: { speed: { value: 4, unit: "mph" }, inclinePercent: 3.5 },
      }),
      [],
      settings,
      now
    );
    expect(record.id).to.be.greaterThan(0);
    expect(record.source).to.equal("devfit_manual");
    expect(record.setTimer).to.equal(undefined);
    expect(record.entries[0].sets[0].devfitCardio?.datePrecision).to.equal("date");
    expect(record.entries[0].sets[0].devfitCardio?.performedLocalTime).to.equal(undefined);
    const s = Analytics_summary([record], settings, stats, evaluated, now);
    expect(s.cardioSeconds).to.equal(1800);
    expect(s.sets.total).to.equal(0);
    expect(s.completed.running).to.equal(1);
    expect(Cycle_summary([record], settings, stats, History_getPersonalRecords([record]), now).sets.total).to.equal(0);
    expect(Schedule_slots(evaluated, settings, [record], now)[9].completed).to.equal(true);
    const edited = Cardio_manualRecord(activity({ actualDurationSeconds: 1200 }), [record], settings, now + 1, record);
    expect(edited.id).to.equal(record.id);
    expect(Analytics_summary([edited], settings, stats, evaluated, now).cardioSeconds).to.equal(1200);
    expect(Analytics_summary([], settings, stats, evaluated, now).cardioSeconds).to.equal(0);
    expect(Cardio_nearDuplicates(activity(), [record])).to.have.length(1);
    const second = Cardio_manualRecord(activity(), [record], settings, now);
    expect(second.id).not.to.equal(record.id);
    expect(Analytics_summary([record, second], settings, stats, evaluated, now).cardioSeconds).to.equal(3600);
  });
  it("keeps Run B on a Run A date mismatched until explicit credit to one correct scheduled instance", () => {
    const { settings, evaluated, stats, program } = setup();
    const record = Cardio_manualRecord(activity({ runPlan: "run_b" }), [], settings, now);
    let o = Schedule_overview(evaluated, settings, [record], now);
    expect(o.slots[9].completed).to.equal(false);
    expect(o.slots[9].mismatched[0].dayName).to.equal("Run B");
    record.devfitScheduleCredit = { programId: program.id, scheduledDate: "2026-10-12", rotationDay: 6, programDay: 5 };
    o = Schedule_overview(evaluated, settings, [record], now);
    expect(o.slots[5]).to.include({ completed: true, completedLate: true });
    expect(o.slots[9].completed).to.equal(false);
    expect(o.today?.day).to.equal(12);
    expect(o.missed.some((m) => m.date === "2026-10-12")).to.equal(false);
    expect(Analytics_summary([record], settings, stats, evaluated, now).cardioSeconds).to.equal(1800);
  });
});

describe("DevFit v0.4 actual cardio measurements", () => {
  it("derives 16 walk / 14 jog / longest 8 from actual phases and retains independent units/grades", () => {
    const segments = [5, 8, 3, 6, 8].map((minutes, i) => ({
      phase: i % 2 ? ("jog" as const) : ("walk" as const),
      durationSeconds: minutes * 60,
      speed: { value: i % 2 ? 4 : 2.5, unit: "mph" as const },
      inclinePercent: i % 2 ? 3.5 : 5,
    }));
    const a = activity({ segments });
    expect(Cardio_breakdown(a)).to.deep.equal({ walkSeconds: 960, jogSeconds: 840, longestJogSeconds: 480 });
    expect(Cardio_breakdown(activity({ jogSeconds: 840 })).longestJogSeconds).to.equal(undefined);
    const set = Cardio_mirror({ vtype: "set", id: "s", index: 0 }, a);
    expect(Cardio_duration(set)).to.equal(1800);
    expect(set.completedSetTimer).to.equal(1800);
    expect(Cardio_speedKmh({ value: 4, unit: "mph" })).to.equal(6.437376);
    expect(Cardio_meters({ value: 1, unit: "mi" })).to.equal(1609.344);
    expect(v.parse(VCardioActivity, a).segments![1].inclinePercent).to.equal(3.5);
  });
  it("uses actual active work across Walk/Jog/pause/resume/Stop and finalizes keep-going time", () => {
    const { program, settings, stats } = setup();
    settings.timers.getReady = 0;
    const originalNow = Date.now;
    let clock = now;
    Date.now = () => clock;
    try {
      let p = Program_nextHistoryRecord({ ...program, nextDay: 1 }, settings, stats);
      p.startTime = now;
      p = Progress_resumeWorkout([], p, settings);
      const complete = (recordedSeconds?: number, keepSetTimerRunning = false): void => {
        p = Progress_completeSetAction(
          [],
          settings,
          stats,
          p,
          {
            type: "CompleteSetAction",
            mode: "workout",
            entryIndex: 0,
            setIndex: 0,
            isPlayground: false,
            isExternal: false,
            forceUpdateEntryIndex: false,
            recordedSeconds,
            keepSetTimerRunning: p.setTimer ? keepSetTimerRunning : undefined,
          },
          undefined
        );
      };
      complete();
      p.entries[0].sets[0].cardioLaps = [{ phase: "walk", elapsedSeconds: 0 }];
      for (const seconds of [300, 780, 960]) {
        clock = now + seconds * 1000;
        p.entries[0].sets[0] = Session_switchPhase(p.entries[0].sets[0], seconds);
      }
      clock = now + 1100 * 1000;
      p = { ...p, intervals: History_pauseWorkout(p.intervals) };
      clock += 120_000;
      expect(History_clockNow(p)).to.equal(now + 1100 * 1000);
      p = Progress_resumeWorkout([], p, settings);
      clock = now + (1320 + 120) * 1000;
      p.entries[0].sets[0] = Session_switchPhase(p.entries[0].sets[0], 1320);
      complete(1500, true);
      expect(p.entries[0].sets[0].devfitCardio?.actualDurationSeconds).to.equal(1500);
      clock = now + (1800 + 120) * 1000;
      complete(1800);
      const a = p.entries[0].sets[0].devfitCardio!;
      expect(a.actualDurationSeconds).to.equal(1800);
      expect(Cardio_breakdown(a)).to.deep.equal({ walkSeconds: 960, jogSeconds: 840, longestJogSeconds: 480 });
      expect(p.setTimer).to.equal(undefined);
    } finally {
      Date.now = originalNow;
    }
  });
  it("does not overcount delayed auto completion, or invent legacy phases", () => {
    const { program, settings, stats } = setup();
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      let p = Program_nextHistoryRecord({ ...program, nextDay: 1 }, settings, stats);
      p.startTime = now;
      p = Progress_resumeWorkout([], p, settings);
      p.setTimer = {
        entryIndex: 0,
        setIndex: 0,
        setId: p.entries[0].sets[0].id,
        id: "clock",
        side: "bilateral",
        startedAt: now - 1900_000,
      };
      p = Progress_checkSetTimer([], settings, stats, p, undefined, undefined, undefined, now);
      expect(p.entries[0].sets[0].devfitCardio?.actualDurationSeconds).to.equal(1800);
      const legacy: ISet = { vtype: "set", id: "old", index: 0, isCompleted: true, completedSetTimer: 1200 };
      expect(Cardio_fromSet(legacy, p, "Cardio")?.actualDurationSeconds).to.equal(1200);
      expect(Cardio_fromSet(legacy, p, "Cardio")?.longestJogSeconds).to.equal(undefined);
      expect(Cardio_fromSet(legacy, p, "Cardio")?.segments).to.equal(undefined);
      const withEvents = {
        ...legacy,
        cardioLaps: [
          { phase: "jog" as const, elapsedSeconds: 300 },
          { phase: "walk" as const, elapsedSeconds: 780 },
        ],
      };
      expect(Cardio_fromSet(withEvents, p, "runA2")?.longestJogSeconds).to.equal(480);
    } finally {
      Date.now = originalNow;
    }
  });
  it("keeps optional stairs/bike/row fields, unknowns and machine-specific comparisons honest", () => {
    for (const extra of [
      { kind: "stair_climber" as const, stairSteps: 1200, stepsPerMinute: 60, stairsLevel: "7" },
      {
        kind: "stationary_bike" as const,
        machineDistance: { value: 5, unit: "mi" as const },
        bikeResistanceLevel: "5",
        cadenceRpm: 80,
        powerWatts: 100,
      },
      {
        kind: "rowing" as const,
        machineDistance: { value: 2, unit: "km" as const },
        rowingSplitSecondsPer500m: 130,
        strokeRate: 24,
      },
    ]) {
      const a = v.parse(VCardioActivity, JSON.parse(JSON.stringify(activity({ ...extra, runPlan: undefined }))));
      expect(a).to.deep.include(extra);
      expect(a.reportedFloors).to.equal(undefined);
    }
    const prior = activity({ longestJogSeconds: 480, jog: { speed: { value: 4, unit: "mph" }, inclinePercent: 3.5 } });
    const current = activity({ longestJogSeconds: 600, jog: { speed: { value: 4, unit: "mph" }, inclinePercent: 0 } });
    expect(CardioProgress_compare(prior, current)).to.include("Longer continuous duration; lower incline");
    expect(CardioProgress_compare(prior, current)).to.include("no global PR");
    expect(CardioProgress_metric(activity(), "distance")).to.equal(undefined);
    expect(CardioProgress_metric(activity(), "longest")).to.equal(undefined);
    expect(CardioProgress_compare(prior, { ...current, jog: prior.jog })).to.include("similar speed and grade");
  });
  it("validates real form values instead of replacing unknowns with zero", () => {
    const d = CardioForm_draft(zone, now);
    d.preset = "Run A";
    d.date = "2026-10-16";
    d.minutes = "30";
    d.fields.jogMinutes = "14";
    const basic = CardioForm_build(d, now).activity!;
    expect(basic.jogSeconds).to.equal(840);
    expect(basic.longestJogSeconds).to.equal(undefined);
    expect(basic.walk?.speed).to.equal(undefined);
    d.fields.walkMinutes = "17";
    expect(CardioForm_build(d, now).error).to.be.a("string");
    d.fields.walkMinutes = "16";
    d.fields.longestMinutes = "15";
    expect(CardioForm_build(d, now).error).to.be.a("string");
    d.fields.longestMinutes = "8";
    d.fields.rpe = "11";
    expect(CardioForm_build(d, now).error).to.be.a("string");
    expect(v.safeParse(VCardioActivity, activity({ stairSteps: -1 })).success).to.equal(false);
  });
});

describe("DevFit v0.3 backup compatibility and v0.4 cardio restore", () => {
  it("loads an actual-format v0.3 JSON export with program, history, active workout, equipment, custom exercise and measurements intact", () => {
    const { program, settings, stats } = setup();
    const storage = Storage_getDefault();
    storage.programs = [program];
    storage.currentProgramId = program.id;
    storage.settings = settings;
    storage.settings.devfitSchedules![program.id] = {
      cycleDays: 14,
      anchorDate: "2026-10-08",
      days: settings.devfitSchedules![program.id].days,
    };
    storage.settings.exercises.personal = {
      vtype: "custom_exercise",
      id: "personal",
      name: "My Cardio",
      isDeleted: false,
      meta: { bodyParts: [], targetMuscles: [], synergistMuscles: [] },
    };
    storage.stats.weight.weight = [{ vtype: "stat", timestamp: now, value: { value: 80, unit: "kg" } }];
    const legacy = Program_nextHistoryRecord(program, settings, stats);
    legacy.vtype = "history_record";
    legacy.id = 100;
    legacy.entries[0].sets[0].isCompleted = true;
    storage.history = [legacy];
    storage.progress = [Program_nextHistoryRecord(program, settings, stats)];
    const exported = JSON.parse(JSON.stringify(storage));
    const loaded = Storage_get(exported, false);
    expect(loaded.success).to.equal(true);
    if (!loaded.success) {
      throw new Error(loaded.error.join("\n"));
    }
    expect(JSON.parse(JSON.stringify(loaded.data))).to.deep.equal(exported);
    loaded.data.history.push(
      Cardio_manualRecord(
        activity({
          segments: [{ phase: "jog", durationSeconds: 1800, speed: { value: 4, unit: "mph" }, inclinePercent: 3.5 }],
          machineDistance: { value: 2, unit: "mi" },
        }),
        loaded.data.history,
        settings,
        now
      )
    );
    const roundTrip = Storage_get(JSON.parse(JSON.stringify(loaded.data)), false);
    if (!roundTrip.success) {
      throw new Error(roundTrip.error.join("\n"));
    }
    const restored = roundTrip.data;
    expect(restored.programs).to.deep.equal(loaded.data.programs);
    expect(restored.progress).to.deep.equal(loaded.data.progress);
    expect(restored.history[1].entries[0].sets[0].devfitCardio).to.deep.equal(
      loaded.data.history[1].entries[0].sets[0].devfitCardio
    );
    expect(CardioProgress_records(restored.history, settings, now).length).to.be.greaterThan(0);
  });
});

describe("DevFit v0.4 integration review regressions", () => {
  it("combines structured timed sets into one activity without duplicating duration or confusing machine distance with work pace", () => {
    const { program, settings, stats, evaluated } = setup();
    const record = Program_nextHistoryRecord({ ...program, nextDay: 5 }, settings, stats);
    record.vtype = "history_record";
    record.startTime = now;
    record.id = 800;
    record.entries[0].sets = record.entries[0].sets.map((set) =>
      Cardio_mirror(
        { ...set, isCompleted: true },
        activity({
          recordingMode: "live",
          runPlan: "run_b",
          performedLocalDate: "2026-10-18",
          actualDurationSeconds: 120,
          segments: [{ phase: "jog", durationSeconds: 120 }],
        })
      )
    );
    const combined = Cardio_entryActivity(record, record.entries[0], "Run B")!;
    expect(combined.actualDurationSeconds).to.equal(720);
    expect(combined.jogSeconds).to.equal(720);
    expect(combined.longestJogSeconds).to.equal(undefined);
    record.entries[0].devfitCardioDetails = Cardio_entryDetails({
      ...combined,
      machineDistance: { value: 3, unit: "km" },
      effortRpe1to10: 7,
    });
    expect(
      Object.prototype.hasOwnProperty.call(record.entries[0].devfitCardioDetails, "actualDurationSeconds")
    ).to.equal(false);
    const point = CardioProgress_records([record], settings, now);
    expect(point).to.have.length(1);
    expect(point[0].activity.machineDistance?.value).to.equal(3);
    expect(CardioProgress_metric(point[0].activity, "speed")).to.equal(undefined);
    expect(Analytics_summary([record], settings, stats, evaluated, now).cardioSeconds).to.equal(720);
    record.entries[0].sets[0].devfitCardio!.segments = [
      { phase: "jog", durationSeconds: 60, speed: { value: 4, unit: "mph" }, inclinePercent: 3.5 },
      { phase: "jog", durationSeconds: 60, speed: { value: 6, unit: "mph" }, inclinePercent: 0 },
    ];
    expect(
      Cardio_entryActivity(record, { ...record.entries[0], devfitCardioDetails: undefined }, "Run B")?.jog
    ).to.equal(undefined);
    const loaded = Storage_get({ ...Storage_getDefault(), history: [record] }, false);
    if (!loaded.success) {
      throw new Error(loaded.error.join("\n"));
    }
    expect(loaded.data.history[0].entries[0].devfitCardioDetails?.effortRpe1to10).to.equal(7);
  });
  it("keeps date-only History calendar and week filtering on the entered Sunday in every device zone", () => {
    const { settings } = setup();
    const record = Cardio_manualRecord(activity({ performedLocalDate: "2026-10-18" }), [], settings, now);
    expect(History_getDateToHistory([record])["2026-10-18"]?.id).to.equal(record.id);
    expect(Cardio_historyDate(record).getDate()).to.equal(18);
    expect(
      History_getHistoryRecordsForTimerange([record], new Date(2026, 9, 18, 12).getTime(), "week", false)
    ).to.have.length(1);
    expect(
      History_getHistoryRecordsForTimerange([record], new Date(2026, 9, 11, 12).getTime(), "week", false)
    ).to.have.length(0);
    expect(Dates_validTime("2026-03-08", "02:30", zone)).to.equal(false);
    expect(Dates_validTime("2026-03-08", "03:30", zone)).to.equal(true);
    const d = CardioForm_draft(zone, now);
    d.date = "2026-03-08";
    d.time = "02:30";
    d.minutes = "30";
    expect(CardioForm_build(d, now).error).to.include("does not exist");
  });
  it("synchronizes legacy duration edits and clears unsupported phase totals", () => {
    const original = Cardio_mirror(
      { vtype: "set", id: "duration", index: 0, isCompleted: true },
      activity({ segments: [{ phase: "jog", durationSeconds: 1800 }] })
    );
    const edited = Cardio_editDuration(original, 1200);
    expect(Cardio_duration(edited)).to.equal(1200);
    expect(edited.completedSetTimer).to.equal(1200);
    expect(edited.devfitCardio?.segments).to.equal(undefined);
    expect(edited.devfitCardio?.longestJogSeconds).to.equal(undefined);
    const cleared = Cardio_editDuration(edited);
    expect(Cardio_duration(cleared)).to.equal(0);
    expect(cleared.devfitCardio).to.equal(undefined);
  });
  it("preserves live identity, clock date and locked live form values", () => {
    const { program, settings, stats } = setup();
    const p = Program_nextHistoryRecord({ ...program, nextDay: 1 }, settings, stats);
    const a = activity({ recordingMode: "live", datePrecision: "minute", performedLocalDate: "2026-10-18" });
    const first = Cardio_mirror(p.entries[0].sets[0], a);
    const recaptured = Cardio_liveSet(first, p, "Cycling", 1900);
    expect(recaptured.devfitCardio?.kind).to.equal("treadmill");
    expect(recaptured.devfitCardio?.runPlan).to.equal("run_a");
    const originalNow = Date.now;
    let clock = Dates_timestamp("2026-10-18", zone, "23:50");
    Date.now = () => clock;
    try {
      let auto = Progress_resumeWorkout([], p, settings);
      auto.setTimer = { entryIndex: 0, setIndex: 0, setId: first.id, id: "auto", side: "bilateral", startedAt: clock };
      clock += 60_000;
      auto = { ...auto, intervals: History_pauseWorkout(auto.intervals) };
      clock += 3600_000;
      auto = Progress_resumeWorkout([], auto, settings);
      expect(Dates_key(auto.setTimer!.performedAt!, zone)).to.equal("2026-10-18");
      expect(Cardio_liveSet(p.entries[0].sets[0], auto, "Cycling", 60, zone).devfitCardio?.performedLocalDate).to.equal(
        "2026-10-18"
      );
    } finally {
      Date.now = originalNow;
    }
    const draft = CardioForm_draft(zone, now, a);
    draft.date = "2026-10-16";
    draft.minutes = "1";
    draft.time = "12:00";
    draft.zone = "UTC";
    const result = CardioForm_submission(draft, [], now, {
      mode: "live",
      original: a,
      duplicateConfirmed: true,
    }).activity!;
    expect(result.performedLocalDate).to.equal(a.performedLocalDate);
    expect(result.timeZone).to.equal(zone);
    expect(result.actualDurationSeconds).to.equal(1800);
    expect(result.performedLocalTime).to.equal(undefined);
  });
  it("rejects stale, paused, get-ready and wrong-set phase requests, including after banked completion", () => {
    const { program, settings, stats } = setup();
    let p = Program_nextHistoryRecord({ ...program, nextDay: 1 }, settings, stats);
    p.setTimer = {
      entryIndex: 0,
      setIndex: 0,
      setId: p.entries[0].sets[0].id,
      id: "phase",
      side: "bilateral",
      startedAt: now,
    };
    const request = {
      entryIndex: 0,
      setIndex: 0,
      setId: p.setTimer.setId,
      phaseId: "phase",
      expectedPhase: "walk" as const,
      kind: "begin" as const,
    };
    p = Cardio_applyPhase(p, request, now, false);
    p = Cardio_applyPhase(p, { ...request, kind: "switch" }, now + 300_000, false);
    expect(
      Cardio_applyPhase(p, { ...request, kind: "settings", value: { inclinePercent: 5 } }, now + 400_000, false)
    ).to.equal(p);
    expect(
      Cardio_applyPhase(p, { ...request, expectedPhase: "jog", phaseId: "stale", kind: "switch" }, now + 400_000, false)
    ).to.equal(p);
    expect(Cardio_applyPhase(p, { ...request, expectedPhase: "jog", kind: "switch" }, now + 400_000, true)).to.equal(p);
    const ready = { ...p, setTimer: undefined };
    expect(Cardio_applyPhase(ready, request, now, false)).to.equal(ready);
    p.entries[0].sets[0].isCompleted = true;
    p = Cardio_applyPhase(p, { ...request, expectedPhase: "jog", kind: "switch" }, now + 480_000, false);
    expect(p.entries[0].sets[0].cardioLaps!.slice(-1)[0]).to.include({ phase: "walk", elapsedSeconds: 480 });
  });
  it("tracks finish targets by identity through auto advance, middle sets, rest and deletion", () => {
    const { program, settings, stats } = setup();
    const p = Program_nextHistoryRecord({ ...program, nextDay: 4 }, settings, stats);
    p.entries[1].sets.push({ ...p.entries[1].sets[0], id: "second-bike-set", index: 1 });
    p.entries[0].sets[0] = Cardio_mirror({ ...p.entries[0].sets[0], isCompleted: true, auto: true }, activity());
    const clock = (entryIndex: number, setIndex: number): NonNullable<typeof p.setTimer> => ({
      entryIndex,
      setIndex,
      setId: p.entries[entryIndex].sets[setIndex].id,
      id: `${entryIndex}-${setIndex}`,
      side: "bilateral" as const,
      startedAt: now,
    });
    p.setTimer = clock(0, 0);
    const first = CardioFinish_step(undefined, p);
    p.setTimer = clock(1, 0);
    const advanced = CardioFinish_step(first.target, p);
    expect(advanced.finish).to.equal(undefined);
    expect(advanced.target?.entryId).to.equal(p.entries[1].id);
    p.entries[1].sets[0] = Cardio_mirror(
      { ...p.entries[1].sets[0], isCompleted: true },
      activity({ kind: "stationary_bike", runPlan: undefined })
    );
    p.setTimer = undefined;
    expect(CardioFinish_step(advanced.target, p).finish).to.equal(undefined);
    p.setTimer = clock(1, 1);
    const last = CardioFinish_step(advanced.target, p);
    p.entries[1].sets[1] = { ...p.entries[1].sets[0], id: "second-bike-set", index: 1 };
    p.setTimer = undefined;
    expect(CardioFinish_step(last.target, p).finish?.setIndex).to.equal(1);
    p.entries[1].sets.pop();
    expect(CardioFinish_step(last.target, p).finish).to.equal(undefined);
    p.timer = 60;
    p.timerSince = now;
    p.timerEntryIndex = 0;
    p.timerSetIndex = 0;
    p.entries[1].sets[0].isCompleted = false;
    expect(CardioFinish_step(first.target, p).finish).to.equal(undefined);
  });
});
