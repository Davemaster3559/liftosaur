import { lb } from "lens-shmens";
import { IThunk } from "../ducks/types";
import { IState, updateState } from "../models/state";
import { IProgram, IStorage, IWeight } from "../types";
import { IPlanUpgradePreview, PlanUpgrade_apply, PlanUpgrade_restore } from "./planUpgrade";
import { ICardioPrescription, IMilestoneTarget } from "./planSchema";
import { PlannerProgram_replaceExercise } from "../pages/planner/models/plannerProgram";
import { Program_evaluate, Program_forceEvaluate } from "../models/program";
import { ProgramToPlanner } from "../models/programToPlanner";
import { ProgramRewrite_validate } from "../models/programRewrite";
import { PlannerIds_preserve } from "./plannerIds";
import { Milestones_isAvailable } from "./milestones";
import { LiftingUnits_commit } from "./liftingUnits";

export function PlanActions_apply(preview: IPlanUpgradePreview, onResult: (error?: string) => void): IThunk {
  return async (dispatch, getState) => {
    const result = PlanUpgrade_apply(getState().storage, preview);
    if (!result.error) {
      updateState(
        dispatch,
        [lb<IState>().p("storage").p("programs").record(result.storage.programs)],
        "Update my existing DevFit plan"
      );
    }
    onResult(result.error);
  };
}
export function PlanActions_restore(programId: string, onResult: (error?: string) => void): IThunk {
  return async (dispatch, getState) => {
    const result = PlanUpgrade_restore(getState().storage, programId);
    if (!result.error) {
      updateState(
        dispatch,
        [lb<IState>().p("storage").p("programs").record(result.storage.programs)],
        "Restore pre-upgrade plan"
      );
    }
    onResult(result.error);
  };
}

export function PlanActions_targetStorage(
  storage: IStorage,
  programId: string,
  key: string,
  patch: Partial<IMilestoneTarget>
): IStorage {
  const program = storage.programs.find((p) => p.id === programId);
  const old = program?.devfitPlan?.targets[key];
  if (!program?.devfitPlan || !old) {
    return storage;
  }
  const target = { ...old, ...patch };
  if (
    !Number.isFinite(target.weight.value) ||
    target.weight.value < 0 ||
    (target.step && (!Number.isFinite(target.step.value) || target.step.value <= 0))
  ) {
    return storage;
  }
  const exercise = Program_evaluate(program, storage.settings)
    .weeks.flatMap((w) => w.days.flatMap((d) => d.exercises))
    .find((e) => e.key === key)?.exerciseType;
  if (target.calibrated && exercise && !Milestones_isAvailable(target.weight, exercise, storage.settings)) {
    return storage;
  }
  return {
    ...storage,
    programs: storage.programs.map((p) =>
      p.id !== programId
        ? p
        : { ...p, devfitPlan: { ...program.devfitPlan!, targets: { ...program.devfitPlan!.targets, [key]: target } } }
    ),
    progress: storage.progress.map((r) =>
      r.programId !== programId
        ? r
        : {
            ...r,
            entries: r.entries.map((e) => {
              if (
                e.devfitMilestone?.key !== key ||
                e.devfitMilestone.target.calibrated ||
                e.sets.some((s) => s.isCompleted)
              ) {
                return e;
              }
              const requiredIds = new Set(e.devfitMilestone.required.map((requiredSet) => requiredSet.id));
              const entry = {
                ...e,
                sets: e.sets.map((s) =>
                  requiredIds.has(s.id) ? { ...s, weight: target.weight, reps: target.reps } : s
                ),
              };
              return {
                ...entry,
                devfitMilestone: {
                  ...e.devfitMilestone,
                  target,
                  required: e.devfitMilestone.required.map((requiredSet) => ({
                    ...requiredSet,
                    weight: target.weight,
                    reps: target.reps,
                  })),
                },
              };
            }),
          }
    ),
  };
}
export function PlanActions_target(
  programId: string,
  key: string,
  patch: Partial<IMilestoneTarget>,
  onResult?: (error?: string) => void
): IThunk {
  return async (dispatch, getState) => {
    const storage = getState().storage;
    const result = PlanActions_targetStorage(storage, programId, key, patch);
    if (result === storage) {
      onResult?.("Choose a load available in this exercise's equipment setup.");
      return;
    }
    updateState(
      dispatch,
      [
        lb<IState>().p("storage").p("programs").record(result.programs),
        lb<IState>().p("storage").p("progress").record(result.progress),
      ],
      "Set exercise progression"
    );
    onResult?.();
  };
}

export function PlanActions_bench(
  programId: string,
  choice: "sit_up" | "back_extension",
  onResult: (error?: string) => void
): IThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const program = state.storage.programs.find((p) => p.id === programId);
    if (!program?.planner || !program.devfitPlan || state.storage.progress.some((r) => r.programId === programId)) {
      onResult("Finish the active workout before changing the abdominal exercise.");
      return;
    }
    const evaluated = Program_evaluate(program, state.storage.settings);
    const pending = [
      ...new Map(
        evaluated.weeks
          .flatMap((w) => w.days.flatMap((d) => d.exercises))
          .filter((e) => !e.exerciseType && /awaiting bench/i.test(e.name))
          .map((e) => [e.key, e])
      ).values(),
    ];
    if (!pending.length) {
      onResult("No pending abdominal slot was found.");
      return;
    }
    const newType = { id: choice === "sit_up" ? "sitUp" : "backExtension", equipment: "bodyweight" as const };
    let planner = program.planner;
    const existingKeys = new Set(evaluated.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.key))));
    for (const slot of pending) {
      planner = PlannerProgram_replaceExercise(
        planner,
        slot.key,
        slot.label ?? "devfitBench",
        newType,
        state.storage.settings
      );
    }
    const updatedPlan = Program_forceEvaluate({ ...program, planner }, state.storage.settings);
    for (const week of updatedPlan.weeks) {
      for (const day of week.days) {
        for (const exercise of day.exercises) {
          if (existingKeys.has(exercise.key) || exercise.exerciseType?.id !== newType.id) {
            continue;
          }
          exercise.notused = false;
          exercise.progress = undefined;
          exercise.update = undefined;
          exercise.reuse = undefined;
          exercise.warmupSets = [];
          for (const variation of exercise.evaluatedSetVariations) {
            for (const set of variation.sets) {
              set.weight = { value: 0, unit: "lb" };
              set.maxrep = 8;
              set.minrep = undefined;
            }
          }
        }
      }
    }
    planner = PlannerIds_preserve(
      program.planner,
      new ProgramToPlanner(updatedPlan, state.storage.settings).convertToPlanner()
    );
    const error = ProgramRewrite_validate(planner, state.storage.settings);
    if (error) {
      onResult(error.message);
      return;
    }
    const updated: IProgram = { ...program, planner, devfitPlan: { ...program.devfitPlan, abdominal: choice } };
    updateState(
      dispatch,
      [
        lb<IState>()
          .p("storage")
          .p("programs")
          .record(state.storage.programs.map((p) => (p.id === programId ? updated : p))),
      ],
      "Identify abdominal bench"
    );
    onResult();
  };
}

export function PlanActions_load(value: string, original?: IWeight): IWeight | undefined {
  const num = Number(value);
  return value.trim() && Number.isFinite(num) && num >= 0
    ? (LiftingUnits_commit({ value: num, unit: "lb" }, original) as IWeight)
    : undefined;
}

export function PlanActions_cardio(
  programId: string,
  key: string,
  prescription: ICardioPrescription,
  onResult: (error?: string) => void
): IThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const program = state.storage.programs.find((p) => p.id === programId);
    if (!program?.devfitPlan || !program.planner || state.storage.progress.some((r) => r.programId === programId)) {
      onResult("Finish your workout before changing future cardio targets.");
      return;
    }
    if (!Number.isFinite(prescription.durationSeconds) || prescription.durationSeconds <= 0) {
      onResult("Enter a duration in mm:ss.");
      return;
    }
    const evaluated = Program_forceEvaluate(program, state.storage.settings);
    for (const week of evaluated.weeks) {
      for (const day of week.days) {
        for (const exercise of day.exercises) {
          if (exercise.key !== key) {
            continue;
          }
          if (prescription.intention !== "run_a" && prescription.intention !== "run_b") {
            for (const variation of exercise.evaluatedSetVariations) {
              for (const set of variation.sets) {
                set.setTimer = prescription.durationSeconds;
              }
            }
          }
        }
      }
    }
    const planner = PlannerIds_preserve(
      program.planner,
      new ProgramToPlanner(evaluated, state.storage.settings).convertToPlanner()
    );
    const error = ProgramRewrite_validate(planner, state.storage.settings);
    if (error) {
      onResult(error.message);
      return;
    }
    const updated: IProgram = {
      ...program,
      planner,
      devfitPlan: { ...program.devfitPlan, cardio: { ...program.devfitPlan.cardio, [key]: prescription } },
    };
    updateState(
      dispatch,
      [
        lb<IState>()
          .p("storage")
          .p("programs")
          .record(state.storage.programs.map((p) => (p.id === programId ? updated : p))),
      ],
      "Set future cardio target"
    );
    onResult();
  };
}
