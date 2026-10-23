import { IHistoryRecord, ISettings } from "../types";
import { Reps_findNextEntryAndSetIndex } from "./set";
import { Exercise_get } from "./exercise";
import { Weight_print } from "./weight";

export interface IRestTimerProgress {
  elapsedMs: number;
  remainingMs: number;
  fraction: number;
  isTimeOut: boolean;
}

export function RestTimerProgress_at(timerSince: number, timerSeconds: number, now: number): IRestTimerProgress {
  const totalMs = timerSeconds * 1000;
  const elapsedMs = Math.max(0, now - timerSince);
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const fraction = totalMs <= 0 ? 1 : Math.min(1, elapsedMs / totalMs);
  return { elapsedMs, remainingMs, fraction, isTimeOut: elapsedMs >= totalMs };
}

export function RestTimerProgress_context(
  progress: IHistoryRecord,
  settings: ISettings
): { after: string; next?: string; key?: string } {
  const entry = progress.entries[progress.timerEntryIndex ?? -1];
  const mode = progress.timerMode ?? "workout";
  const set = entry?.[mode === "warmup" ? "warmupSets" : "sets"][progress.timerSetIndex ?? -1];
  const after = entry
    ? `${Exercise_get(entry.exercise, settings.exercises).name} · ${mode === "warmup" ? "Warmup" : "Set"} ${(progress.timerSetIndex ?? 0) + 1}`
    : "Your last set";
  const next = entry && Reps_findNextEntryAndSetIndex(progress, progress.timerEntryIndex!, mode);
  const nextEntry = next && progress.entries[next.entryIndex];
  const warmup = nextEntry && next ? next.setIndex < nextEntry.warmupSets.length : false;
  const nextIndex = nextEntry && next ? next.setIndex - (warmup ? 0 : nextEntry.warmupSets.length) : -1;
  const nextSet = nextEntry?.[warmup ? "warmupSets" : "sets"][nextIndex];
  const target =
    nextSet?.setTimer != null
      ? `${Math.floor(nextSet.setTimer / 60)}:${String(Math.floor(nextSet.setTimer % 60)).padStart(2, "0")}${nextSet.isUnilateral ? " per side" : ""}`
      : nextSet
        ? `${nextSet.weight ? `${Weight_print(nextSet.weight)} · ` : ""}${nextSet.minReps != null ? `${nextSet.minReps}–` : ""}${nextSet.reps ?? "AMRAP"} reps`
        : undefined;
  return {
    after,
    next:
      nextEntry && nextSet
        ? `${Exercise_get(nextEntry.exercise, settings.exercises).name} · ${warmup ? "Warmup" : "Set"} ${nextIndex + 1} · ${target}`
        : undefined,
    key: set
      ? `${entry.id}/${mode}/${set.id}/${set.timestamp ?? 0}`
      : progress.timerSince == null
        ? undefined
        : `${progress.timerSince}`,
  };
}

export interface IRestTimerNotice {
  key?: string;
  notified?: boolean;
}

export function RestTimerProgress_notice(
  previous: IRestTimerNotice,
  key: string | undefined,
  time: IRestTimerProgress | undefined,
  timer: number | undefined,
  paused: boolean,
  nativeScheduled: boolean
): { state: IRestTimerNotice; notify: boolean } {
  const state = previous.key === key ? previous : { key, notified: false };
  if (!key || !time?.isTimeOut || state.notified) {
    return { state, notify: false };
  }
  return {
    state: { key, notified: true },
    notify: !paused && !nativeScheduled && time.elapsedMs <= (timer ?? 0) * 1000 + 5000,
  };
}
