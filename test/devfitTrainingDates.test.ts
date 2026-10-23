import { expect } from "chai";
import { Dates_timestamp } from "../src/devfit/dates";
import {
  TrainingDate_assign,
  TrainingDate_bounds,
  TrainingDate_changedStart,
  TrainingDate_key,
  TrainingDate_migrate,
  TrainingDate_record,
} from "../src/devfit/trainingDates";
import { Schedule_dayForDate, Schedule_get, Schedule_slots, Schedule_slotsForDate } from "../src/devfit/schedule";
import { Program_evaluate, Program_nextHistoryRecord } from "../src/models/program";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Storage_get, Storage_getDefault } from "../src/models/storage";
import { CardioForm_build, CardioForm_draft, CardioForm_submission } from "../src/devfit/cardioForm";
import { Cardio_manualRecord } from "../src/devfit/cardio";
import { DevFitPersonalPlan_fixture as DevFitRotation_fixture } from "./fixtures/devfitPersonalPlan";

describe("DevFit v0.5 night-shift training dates", () => {
  const config = { timeZone: "America/Edmonton", rolloverMinutes: 900 };
  const cases = [
    ["2026-10-08", "02:00", "2026-10-07", 1],
    ["2026-10-10", "02:00", "2026-10-09", 3],
    ["2026-10-15", "02:00", "2026-10-14", 8],
    ["2026-10-18", "14:59", "2026-10-17", 11],
    ["2026-10-18", "15:00", "2026-10-18", 12],
    ["2026-10-19", "02:00", "2026-10-18", 12],
    ["2026-10-19", "15:00", "2026-10-19", 13],
    ["2026-10-21", "15:00", "2026-10-21", 1],
    ["2026-10-22", "06:00", "2026-10-21", 1],
  ] as const;
  for (const [civil, time, expected, rotation] of cases) {
    it(`${civil} ${time} Edmonton is ${expected}, rotation ${rotation}`, () => {
      const stamp = Dates_timestamp(civil, config.timeZone, time);
      const date = TrainingDate_key(stamp, config.timeZone, 900);
      expect(date).to.equal(expected);
      expect(Schedule_dayForDate("2026-10-07", 14, date)).to.equal(rotation);
    });
  }
  it("uses local boundary instants across both DST changes and never shifts date labels through noon", () => {
    for (const [date, hours] of [
      ["2026-03-07", 23],
      ["2025-11-01", 25],
    ] as const) {
      const bounds = TrainingDate_bounds(date, config.timeZone, 900);
      expect((bounds.end - bounds.start) / 3600000).to.equal(hours);
      expect(TrainingDate_key(bounds.end - 1, config.timeZone, 900)).to.equal(date);
    }
    const november = TrainingDate_bounds("2026-10-31", config.timeZone, 900);
    expect(TrainingDate_key(november.start, config.timeZone, 900)).to.equal("2026-10-31");
    expect(TrainingDate_key(november.end - 1, config.timeZone, 900)).to.equal("2026-10-31");
    expect(TrainingDate_key(november.end, config.timeZone, 900)).to.equal("2026-11-01");
    const { program, schedule } = DevFitRotation_fixture();
    const settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
    const evaluated = Program_evaluate(program, settings);
    const now = Dates_timestamp("2026-10-19", config.timeZone, "02:00");
    expect(Schedule_slots(evaluated, settings, [], now).find((s) => s.isToday)?.day).to.equal(12);
    expect(
      Schedule_slotsForDate(evaluated, settings, [], "2026-10-18", now).find((s) => s.dateKey === "2026-10-18")?.day
    ).to.equal(12);
    expect(
      Schedule_get(evaluated, {
        ...settings,
        devfitSchedules: { [program.id]: { ...schedule, trainingDayRolloverMinutes: 0 } },
      }).trainingDayRolloverMinutes
    ).to.equal(0);
  });
  it("captures a workout's start day once and preserves explicit choices across actual-date edits", () => {
    const { program, schedule } = DevFitRotation_fixture();
    const settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
    const start = Dates_timestamp("2026-10-19", config.timeZone, "14:50");
    const originalNow = Date.now;
    let record;
    try {
      Date.now = () => start;
      record = Program_nextHistoryRecord(program, settings, Stats_getEmpty());
    } finally {
      Date.now = originalNow;
    }
    expect(record.devfitTrainingDate?.date).to.equal("2026-10-18");
    expect(TrainingDate_record({ ...record, endTime: start + 30 * 60000 }, config)).to.equal("2026-10-18");
    const assigned = TrainingDate_assign(record, "2026-10-17", config);
    expect(TrainingDate_changedStart(assigned, start + 86400000)?.date).to.equal("2026-10-17");
    expect(TrainingDate_changedStart(record, start + 86400000)?.date).to.equal("2026-10-19");
  });
  it("preserves v0.4 date-only cardio and explicit credit while marking attribution for reconciliation", () => {
    const storage = Storage_getDefault();
    const { program, schedule } = DevFitRotation_fixture();
    storage.programs = [program];
    storage.settings.devfitSchedules = { [program.id]: schedule };
    const now = Dates_timestamp("2026-10-22", config.timeZone, "16:00");
    const draft = CardioForm_draft(config.timeZone, now);
    draft.date = "2026-10-18";
    draft.minutes = "30:32";
    const record = Cardio_manualRecord(CardioForm_build(draft, now).activity!, [], storage.settings, now);
    delete record.devfitTrainingDate;
    record.devfitScheduleCredit = {
      programId: program.id,
      scheduledDate: "2026-10-18",
      rotationDay: 12,
      programDay: 5,
    };
    storage.history = [record];
    const migrated = TrainingDate_migrate(storage);
    const saved = migrated.history[0];
    expect(saved.startTime).to.equal(record.startTime);
    expect(saved.entries).to.deep.equal(record.entries);
    expect(saved.devfitScheduleCredit).to.deep.equal(record.devfitScheduleCredit);
    expect(saved.devfitTrainingDate?.source).to.equal("legacy_date_only");
    expect(TrainingDate_record(saved, config)).to.equal(undefined);
    expect(TrainingDate_migrate(migrated)).to.deep.equal(migrated);
    expect(Storage_get(JSON.parse(JSON.stringify(migrated))).success).to.equal(true);
  });
  it("uses the personal home calendar before its settings have first been saved", () => {
    const { program } = DevFitRotation_fixture();
    const now = Dates_timestamp("2026-10-19", config.timeZone, "02:00");
    const originalNow = Date.now;
    try {
      Date.now = () => now;
      const record = Program_nextHistoryRecord(program, Settings_build(), Stats_getEmpty());
      expect(record.devfitTrainingDate).to.include({
        date: "2026-10-18",
        timeZone: "America/Edmonton",
        rolloverMinutes: 900,
      });
    } finally {
      Date.now = originalNow;
    }
  });
  it("migrates a clocked manual Run B using the selected personal calendar", () => {
    const storage = Storage_getDefault();
    const { program, schedule } = DevFitRotation_fixture();
    storage.programs = [program];
    storage.currentProgramId = program.id;
    storage.settings.devfitSchedules = { [program.id]: schedule };
    const now = Dates_timestamp("2026-10-22", config.timeZone, "16:00");
    const draft = CardioForm_draft(config.timeZone, now);
    draft.preset = "Run B";
    draft.date = "2026-10-19";
    draft.time = "02:00";
    draft.minutes = "30:00";
    const record = Cardio_manualRecord(CardioForm_build(draft, now).activity!, [], storage.settings, now);
    delete record.devfitTrainingDate;
    storage.history = [record];
    expect(TrainingDate_migrate(storage).history[0].devfitTrainingDate).to.include({
      date: "2026-10-18",
      timeZone: config.timeZone,
      rolloverMinutes: 900,
    });
  });
  it("rejects a future actual start and invalid explicit training dates", () => {
    const now = Dates_timestamp("2026-10-21", config.timeZone, "16:00");
    const draft = CardioForm_draft(config.timeZone, now, undefined, undefined, 900);
    draft.trainingMode = "actual";
    draft.date = "2026-10-21";
    draft.time = "22:00";
    draft.minutes = "30:00";
    expect(CardioForm_submission(draft, [], now, { duplicateConfirmed: true }).error).to.include("already happened");
    draft.trainingMode = "training";
    draft.time = "";
    for (const date of ["", "2026-02-30"]) {
      draft.trainingDate = date;
      expect(CardioForm_submission(draft, [], now, { duplicateConfirmed: true }).error).to.include(
        "valid training date"
      );
    }
  });
});
