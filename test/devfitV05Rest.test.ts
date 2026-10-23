import { expect } from "chai";
import * as v from "valibot";
import { PlannerTestUtils_get } from "./utils/plannerTestUtils";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Program_nextHistoryRecord } from "../src/models/program";
import {
  Progress_checkSetTimer,
  Progress_isSetTimerCheckDue,
  Progress_resumeWorkout,
  Progress_startTimer,
  Progress_stopTimer,
  Progress_updateTimer,
} from "../src/models/progress";
import { History_pauseWorkout, History_workoutTime } from "../src/models/history";
import { INativeEffect } from "../src/models/nativeEffects";
import { VHistoryRecord } from "../src/types";
import { RestEvents_ack, RestEvents_matches, RestEvents_restoreCaptured } from "../src/devfit/restEvents";
(globalThis as unknown as { __HOST__: string }).__HOST__ = "https://www.liftosaur.com";

describe("DevFit v0.5 rest lifecycle", () => {
  const settings = Settings_build();
  const stats = Stats_getEmpty();
  let now = 1000000;
  const originalNow = Date.now;
  beforeEach(() => {
    now = 1000000;
    Date.now = () => now;
  });
  afterEach(() => {
    Date.now = originalNow;
  });
  function rest(): ReturnType<typeof Program_nextHistoryRecord> {
    const { program } = PlannerTestUtils_get("# Week\n## Upper\nBench Press / 3x8 60lb / 60s / warmup: none");
    let record = Program_nextHistoryRecord(program, settings, stats);
    record.intervals = [[now, undefined]];
    record.entries[0].sets[0].isCompleted = true;
    record = Progress_startTimer([], record, now, "workout", 0, 0, settings, undefined, 60);
    return record;
  }
  it("clears ordinary rest at exact zero once, preserves workout time and creates no lifting stopwatch", () => {
    const record = rest();
    now += 60000;
    expect(Progress_isSetTimerCheckDue(record, now)).to.equal(true);
    const effects: INativeEffect[] = [];
    const ended = Progress_checkSetTimer(effects, settings, stats, record, undefined, undefined, undefined, now);
    expect(ended.timer).to.equal(undefined);
    expect(ended.timerSince).to.equal(undefined);
    expect(ended.setTimer).to.equal(undefined);
    expect(ended.setTimerGetReady).to.equal(undefined);
    expect(History_workoutTime(ended)).to.equal(60000);
    expect(effects.filter((e) => e.type === "restCue")).to.have.length(1);
    expect(effects.some((e) => e.type === "stopTimer")).to.equal(false);
    const restored = v.parse(VHistoryRecord, JSON.parse(JSON.stringify(ended)));
    expect(Progress_checkSetTimer([], settings, stats, restored, undefined, undefined, undefined, now)).to.equal(
      restored
    );
    expect(restored.devfitRestEvent?.claimed).to.equal(true);
  });
  it("leaves one native cue owner and quietly clears long-expired rests", () => {
    const record = rest();
    record.devfitRestEvent!.native = true;
    now += 60000;
    const effects: INativeEffect[] = [];
    Progress_checkSetTimer(effects, settings, stats, record, undefined, undefined, undefined, now);
    expect(effects).to.deep.equal([]);
    record.devfitRestEvent!.native = false;
    now += 60000;
    Progress_checkSetTimer(effects, settings, stats, record, undefined, undefined, undefined, now);
    expect(effects).to.deep.equal([]);
  });
  it("rejects expired adjustments, freezes pause and resumes with a fresh event and a shifted deadline", () => {
    const record = rest();
    now += 30000;
    const paused = { ...record, intervals: History_pauseWorkout(record.intervals) };
    now += 120000;
    expect(
      Progress_updateTimer(
        [],
        paused,
        undefined,
        75,
        record.timerSince!,
        undefined,
        undefined,
        true,
        settings,
        undefined
      )
    ).to.equal(paused);
    expect(Progress_checkSetTimer([], settings, stats, paused, undefined, undefined, undefined, now)).to.equal(paused);
    const resumed = Progress_resumeWorkout([], paused, settings);
    expect(resumed.devfitRestEvent?.id).not.to.equal(record.devfitRestEvent?.id);
    expect(resumed.devfitRestEvent?.revision).to.equal(0);
    expect(resumed.devfitRestEvent?.deadline).to.equal(record.devfitRestEvent!.deadline + 120000);
    expect(RestEvents_matches(resumed, record.devfitRestEvent)).to.equal(false);
    now = resumed.devfitRestEvent!.deadline;
    expect(
      Progress_updateTimer(
        [],
        resumed,
        undefined,
        90,
        resumed.timerSince!,
        undefined,
        undefined,
        true,
        settings,
        undefined
      )
    ).to.equal(resumed);
  });
  it("accepts a natively rescheduled tap captured before expiry when JS receives it later", () => {
    const record = rest();
    const tappedAt = now + 59000;
    now += 65000;
    const extended = Progress_updateTimer(
      [],
      record,
      undefined,
      75,
      record.timerSince!,
      undefined,
      undefined,
      true,
      settings,
      undefined,
      tappedAt
    );
    expect(extended.timer).to.equal(75);
    expect(extended.devfitRestEvent?.deadline).to.equal(record.timerSince! + 75000);
  });
  it("marks explicit cancellation, cancels a superseded zero-rest cue, and ignores late failure acknowledgements", () => {
    const record = rest();
    const effects: INativeEffect[] = [];
    const skipped = Progress_stopTimer(effects, record);
    expect(effects[0]).to.deep.equal({ type: "stopTimer", eventId: record.devfitRestEvent!.id, eventRevision: 0 });
    now += 60000;
    const failure = {
      eventId: record.devfitRestEvent!.id,
      deadline: record.devfitRestEvent!.deadline,
      scheduled: false,
    };
    expect(RestEvents_ack(skipped.devfitRestEvent, failure, now, true).notify).to.equal(false);
    now -= 30000;
    effects.length = 0;
    const zero = Progress_startTimer(effects, record, now, "workout", 0, 0, settings, undefined, 0);
    expect(zero.timer).to.equal(undefined);
    expect(zero.devfitRestEvent?.cancelled).to.equal(true);
    expect(effects.some((e) => e.type === "stopTimer")).to.equal(true);
  });
  it("correlates success/failure by event and deadline and claims a fallback once", () => {
    const record = rest();
    const event = record.devfitRestEvent!;
    now = event.deadline;
    expect(
      RestEvents_ack(event, { eventId: "old", deadline: event.deadline, scheduled: true }, now, true).event
    ).to.equal(undefined);
    expect(
      RestEvents_ack(event, { eventId: event.id, deadline: event.deadline - 15000, scheduled: true }, now, true).event
    ).to.equal(undefined);
    expect(
      RestEvents_ack(event, { eventId: event.id, deadline: event.deadline, scheduled: false }, now, false).notify
    ).to.equal(false);
    const failed = { eventId: event.id, deadline: event.deadline, scheduled: false };
    const ack = RestEvents_ack(event, failed, now, true);
    expect(ack.notify).to.equal(true);
    expect(RestEvents_ack(ack.event, failed, now, true).notify).to.equal(false);
  });
  it("rejects an old revision after adjustments return to the same deadline", () => {
    const original = rest();
    const plus = Progress_updateTimer(
      [],
      original,
      undefined,
      75,
      original.timerSince!,
      undefined,
      undefined,
      true,
      settings,
      undefined
    );
    const minus = Progress_updateTimer(
      [],
      plus,
      undefined,
      60,
      plus.timerSince!,
      undefined,
      undefined,
      true,
      settings,
      undefined
    );
    expect(minus.devfitRestEvent?.deadline).to.equal(original.devfitRestEvent?.deadline);
    expect(minus.devfitRestEvent?.revision).to.equal(2);
    expect(RestEvents_matches(minus, original.devfitRestEvent)).to.equal(false);
    expect(
      RestEvents_ack(
        minus.devfitRestEvent,
        {
          eventId: original.devfitRestEvent!.id,
          deadline: original.devfitRestEvent!.deadline,
          eventRevision: 0,
          scheduled: false,
        },
        now,
        true
      ).event
    ).to.equal(undefined);
    expect(RestEvents_matches(minus, plus.devfitRestEvent)).to.equal(false);
  });
  it("reconciles a valid native tap after JS cleared the older deadline, without reviving cancelled rests", () => {
    const original = rest();
    original.devfitRestEvent!.native = true;
    const captured = { timer: original.timer!, timerSince: original.timerSince! };
    const tappedAt = now + 59000;
    now += 65000;
    const expired = Progress_checkSetTimer([], settings, stats, original, undefined, undefined, undefined, now);
    expect(expired.timer).to.equal(undefined);
    const restored = RestEvents_restoreCaptured(expired, captured, tappedAt, true);
    const adjusted = Progress_updateTimer(
      [],
      restored,
      undefined,
      75,
      captured.timerSince,
      undefined,
      undefined,
      true,
      settings,
      undefined,
      tappedAt
    );
    expect(adjusted.timer).to.equal(75);
    expect(adjusted.devfitRestEvent?.revision).to.equal(1);
    const skipped = Progress_stopTimer([], original);
    expect(RestEvents_restoreCaptured(skipped, captured, tappedAt, true)).to.equal(skipped);
    expect(RestEvents_restoreCaptured(expired, captured, tappedAt, false)).to.equal(expired);
    expect(RestEvents_restoreCaptured(expired, captured, now, true)).to.equal(expired);
  });
});
