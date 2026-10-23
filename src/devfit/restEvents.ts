import * as v from "valibot";
import type { IHistoryRecord } from "../types";
export const VRestEvent = v.object({
  id: v.string(),
  deadline: v.number(),
  revision: v.optional(v.number()),
  native: v.boolean(),
  claimed: v.boolean(),
  cancelled: v.optional(v.boolean()),
});
export type IRestEvent = v.InferOutput<typeof VRestEvent>;
export type ICapturedRest = { timer: number; timerSince: number };

export function RestEvents_restoreCaptured(
  record: IHistoryRecord,
  captured: ICapturedRest | undefined,
  tappedAt: number | undefined,
  canRestore: boolean
): IHistoryRecord {
  const rest = record.devfitRestEvent;
  if (
    !canRestore ||
    !rest?.native ||
    rest.cancelled ||
    !captured ||
    tappedAt == null ||
    record.timer != null ||
    record.setTimer ||
    record.setTimerGetReady ||
    !Number.isFinite(captured.timer) ||
    captured.timer <= 0 ||
    !Number.isFinite(captured.timerSince) ||
    captured.timerSince + captured.timer * 1000 !== rest.deadline ||
    tappedAt < captured.timerSince ||
    tappedAt >= rest.deadline ||
    tappedAt > Date.now()
  ) {
    return record;
  }
  return {
    ...record,
    timer: captured.timer,
    timerSince: captured.timerSince,
    timerMode: "workout",
    timerEntryIndex: record.currentEntryIndex ?? 0,
    timerSetIndex: 0,
  };
}
export function RestEvents_matches(
  record: IHistoryRecord,
  expected?: Pick<IRestEvent, "id" | "deadline" | "revision">
): boolean {
  return (
    !expected ||
    (record.devfitRestEvent?.id === expected.id &&
      record.devfitRestEvent.deadline === expected.deadline &&
      (record.devfitRestEvent.revision ?? 0) === (expected.revision ?? 0))
  );
}

export function RestEvents_ack(
  rest: IRestEvent | undefined,
  result: { eventId?: string; deadline?: number; eventRevision?: number; scheduled: boolean } | undefined,
  now: number,
  canCue: boolean
): { event?: IRestEvent; notify: boolean } {
  if (
    !rest ||
    !result ||
    rest.id !== result.eventId ||
    rest.deadline !== result.deadline ||
    (rest.revision ?? 0) !== (result.eventRevision ?? 0)
  ) {
    return { notify: false };
  }
  const notify =
    canCue &&
    !result.scheduled &&
    !rest.cancelled &&
    !rest.claimed &&
    now >= rest.deadline &&
    now <= rest.deadline + 5000;
  return { event: { ...rest, native: result.scheduled, claimed: rest.claimed || notify }, notify };
}
