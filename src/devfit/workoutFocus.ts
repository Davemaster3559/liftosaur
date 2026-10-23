import { IHistoryEntry, IHistoryRecord, IProgressMode, ISet } from "../types";

export function WorkoutFocus_sets(entry: IHistoryEntry): { set: ISet; index: number; mode: IProgressMode }[] {
  return [
    ...entry.warmupSets.map((set, index) => ({ set, index, mode: "warmup" as IProgressMode })),
    ...entry.sets.map((set, index) => ({ set, index, mode: "workout" as IProgressMode })),
  ];
}

export function WorkoutFocus_active(
  entry: IHistoryEntry,
  selectedId?: string
): ReturnType<typeof WorkoutFocus_sets>[number] | undefined {
  const sets = WorkoutFocus_sets(entry);
  return sets.find((s) => s.set.id === selectedId) ?? sets.find((s) => !s.set.isCompleted);
}

export function WorkoutFocus_shouldStartRest(
  progress: IHistoryRecord,
  entryIndex: number,
  setIndex: number,
  mode: IProgressMode,
  preserveRest = false
): boolean {
  const entry = progress.entries[entryIndex];
  if (progress.id !== 0 || !entry || preserveRest || entryIndex !== (progress.currentEntryIndex ?? 0)) {
    return false;
  }
  const ordered = WorkoutFocus_sets(entry);
  const current = ordered.findIndex((s) => s.mode === mode && !s.set.isCompleted);
  const requested = ordered.findIndex((s) => s.index === setIndex && s.mode === mode);
  return requested >= 0 && current === requested && !ordered.slice(requested + 1).some((s) => s.set.isCompleted);
}
