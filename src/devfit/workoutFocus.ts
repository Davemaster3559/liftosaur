import { IHistoryEntry, IProgressMode, ISet } from "../types";

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
