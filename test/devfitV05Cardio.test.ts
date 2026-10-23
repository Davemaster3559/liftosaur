import { expect } from "chai";
import * as v from "valibot";
import { CardioTime_format, CardioTime_parse } from "../src/devfit/cardioTime";
import { CardioForm_build, CardioForm_draft, CardioForm_submission } from "../src/devfit/cardioForm";
import { Cardio_breakdown } from "../src/devfit/cardio";
import { VCardioActivity } from "../src/devfit/cardioSchema";

describe("DevFit v0.5 cardio summaries and timing", () => {
  const now = Date.UTC(2026, 9, 22, 23);
  it("accepts direct mm:ss and longer durations, rejecting invalid seconds", () => {
    expect(CardioTime_parse("30:32")).to.equal(1832);
    expect(CardioTime_parse("1:30:32")).to.equal(5432);
    expect(CardioTime_parse("90:32")).to.equal(5432);
    expect(CardioTime_parse("30:60")).to.equal(undefined);
    expect(CardioTime_parse("-1")).to.equal(undefined);
    expect(CardioTime_format(1832)).to.equal("30:32");
  });
  it("preserves the reported Precor values without inferring walk/jog or phase speed", () => {
    const draft = CardioForm_draft("America/Edmonton", now);
    draft.minutes = "30:32";
    draft.date = "2026-10-21";
    draft.fields = { distance: "2.15", pace: "14:10", paceUnit: "mi", heartRate: "134", calories: "268" };
    const result = CardioForm_build(draft, now);
    expect(result.error).to.equal(undefined);
    const activity = result.activity!;
    expect(activity.actualDurationSeconds).to.equal(1832);
    expect(activity.machineDistance).to.deep.equal({ value: 2.15, unit: "mi" });
    expect(activity.machinePace).to.deep.equal({ seconds: 850, unit: "mi" });
    expect(activity.averageHeartRateBpm).to.equal(134);
    expect(activity.machineCaloriesKcal).to.equal(268);
    expect(activity.segments).to.equal(undefined);
    expect(Cardio_breakdown(activity).longestJogSeconds).to.equal(undefined);
    const restored = v.parse(VCardioActivity, JSON.parse(JSON.stringify(activity)));
    expect(CardioForm_draft("America/Edmonton", now, restored).minutes).to.equal("30:32");
    expect(CardioForm_draft("America/Edmonton", now, restored).fields.pace).to.equal("14:10");
  });
  it("combines adjacent jogging setting changes but breaks continuity at an explicit pause", () => {
    const segments = [
      { phase: "jog" as const, durationSeconds: 240, speed: { value: 4, unit: "mph" as const } },
      { phase: "jog" as const, durationSeconds: 300, speed: { value: 4.2, unit: "mph" as const } },
      { phase: "jog" as const, durationSeconds: 180, breakBefore: true },
    ];
    expect(Cardio_breakdown({ segments })).to.deep.equal({ walkSeconds: 0, jogSeconds: 720, longestJogSeconds: 540 });
    const activity = v.parse(VCardioActivity, {
      schemaVersion: 1,
      kind: "treadmill",
      recordingMode: "live",
      datePrecision: "minute",
      performedLocalDate: "2026-10-21",
      performedLocalTime: "16:00",
      timeZone: "America/Edmonton",
      actualDurationSeconds: 720,
      segments,
    });
    const draft = CardioForm_draft("America/Edmonton", now, activity);
    draft.fields.distance = "1.2";
    const edited = CardioForm_submission(draft, [], now, {
      mode: "live",
      original: activity,
      duplicateConfirmed: true,
    });
    expect(edited.error).to.equal(undefined);
    expect(Cardio_breakdown(edited.activity!).longestJogSeconds).to.equal(540);
  });
  it("retains machine-specific time blocks without adding another activity duration", () => {
    const draft = CardioForm_draft("America/Edmonton", now);
    draft.preset = "Bike";
    draft.minutes = "20:00";
    draft.blocks = [
      { duration: "8:00", level: "4", cadence: "70", watts: "90", notes: "Warm-up" },
      { duration: "12:00", level: "6", cadence: "76", watts: "120", notes: "" },
    ];
    const result = CardioForm_build(draft, now);
    expect(result.error).to.equal(undefined);
    expect(result.activity!.actualDurationSeconds).to.equal(1200);
    expect(result.activity!.machineBlocks![1]).to.include({
      durationSeconds: 720,
      resistanceLevel: "6",
      cadenceRpm: 76,
    });
    draft.blocks[1].duration = "13:00";
    expect(CardioForm_build(draft, now).error).to.be.a("string");
  });
});
