import { IHistoryRecord } from "../types";
import { ICardioActivity } from "./cardioSchema";
import { Progress_getNextTimedSet } from "../models/progress";
import { Cardio_entryActivity } from "./cardio";

export interface ICardioTimerTarget {
  entryId: string;
  setId: string;
}
export function CardioFinish_step(
  previous: ICardioTimerTarget | undefined,
  progress: IHistoryRecord | undefined
): {
  target?: ICardioTimerTarget;
  finish?: { entryIndex: number; setIndex: number; activity: ICardioActivity };
} {
  if (!progress) {
    return {};
  }
  const clock = progress.setTimer ?? progress.setTimerGetReady;
  if (clock) {
    const entry = progress.entries[clock.entryIndex];
    const set = entry?.sets[clock.setIndex];
    return entry && set?.id === clock.setId ? { target: { entryId: entry.id, setId: set.id } } : {};
  }
  const restSet =
    progress.timerEntryIndex == null || progress.timerSetIndex == null
      ? undefined
      : progress.entries[progress.timerEntryIndex]?.sets[progress.timerSetIndex];
  if (progress.timerSince != null && progress.timer != null && restSet?.auto && Progress_getNextTimedSet(progress)) {
    return {};
  }
  const entryIndex = progress.entries.findIndex((e) => e.id === previous?.entryId);
  const entry = progress.entries[entryIndex];
  const setIndex = entry?.sets.findIndex((s) => s.id === previous?.setId) ?? -1;
  const set = entry?.sets[setIndex];
  if (!set?.isCompleted || !set.devfitCardio || setIndex !== entry.sets.length - 1) {
    return {};
  }
  return {
    target: previous,
    finish: { entryIndex, setIndex, activity: Cardio_entryActivity(progress, entry, "") ?? set.devfitCardio },
  };
}
