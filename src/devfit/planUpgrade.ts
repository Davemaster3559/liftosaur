import * as v from "valibot";
import { IHistoryRecord, IProgram, ISettings, IStorage, IWeight, VProgram } from "../types";
import { Program_forceEvaluate, Program_getListOfDays } from "../models/program";
import { PlannerProgram_replaceExercise } from "../pages/planner/models/plannerProgram";
import {
  PlannerProgramExercise_createExerciseFromEntry,
  PlannerProgramExercise_currentEvaluatedSetVariation,
  PlannerProgramExercise_getState,
} from "../pages/planner/models/plannerProgramExercise";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import { ProgramToPlanner } from "../models/programToPlanner";
import { ProgramRewrite_validate } from "../models/programRewrite";
import { PlannerKey_fromExerciseType } from "../pages/planner/plannerKey";
import { Exercise_get, Exercise_toKey } from "../models/exercise";
import { Equipment_getEquipmentDataForExerciseType } from "../models/equipment";
import { StringUtils_hashString } from "../utils/string";
import { Milestones_isAvailable, Milestones_stage } from "./milestones";
import { ICardioPrescription, IDevFitPlan, IMilestoneTarget } from "./planSchema";
import { Rotation_role, Rotation_roles } from "./rotationIdentity";
import { Session_exerciseKind } from "./presentation";
import { LiftingUnits_same } from "./liftingUnits";
import { PlannerIds_preserve } from "./plannerIds";

export interface IPlanUpgradePreview {
  programId: string;
  fingerprint: string;
  program?: IProgram;
  changes: string[];
  conflicts: string[];
  alreadyApplied: boolean;
}
export function PlanUpgrade_fingerprint(program: IProgram): string {
  return StringUtils_hashString(JSON.stringify(program));
}

function realBaseline(exercise: IPlannerProgramExercise, history: IHistoryRecord[]): IWeight | undefined {
  const type = exercise.exerciseType;
  if (!type) {
    return undefined;
  }
  for (const record of [...history].sort((a, b) => b.startTime - a.startTime)) {
    const entry = record.entries.find((e) => Exercise_toKey(e.exercise) === Exercise_toKey(type));
    const sets = entry?.sets.filter((s) => s.isCompleted && s.completedWeight && (s.completedReps ?? 0) > 0);
    if (sets?.length && sets.every((s) => LiftingUnits_same(s.completedWeight, sets[0].completedWeight))) {
      return sets[0].completedWeight;
    }
  }
  return undefined;
}

function targetFor(
  exercise: IPlannerProgramExercise,
  settings: ISettings,
  history: IHistoryRecord[],
  replacement: boolean
): IMilestoneTarget {
  const sets = PlannerProgramExercise_currentEvaluatedSetVariation(exercise).sets.filter((s) => !s.isQuickAddSet);
  const first = sets[0];
  const baseline = replacement
    ? realBaseline(exercise, history)
    : first?.weight?.unit !== "%"
      ? first?.weight
      : undefined;
  const weight = baseline ?? { value: 0, unit: "lb" as const };
  const state = PlannerProgramExercise_getState(exercise);
  const increment = state.increment;
  const equipment = Equipment_getEquipmentDataForExerciseType(settings, exercise.exerciseType);
  const fixedMatch = !equipment || Milestones_isAvailable(weight, exercise.exerciseType!, settings);
  return {
    weight: { ...weight },
    reps: Milestones_stage(Math.max(...sets.map((s) => s.maxrep ?? 8), 8)),
    calibrated: !!baseline && fixedMatch,
    step:
      !replacement && increment && typeof increment !== "number" && increment.unit !== "%" && increment.value > 0
        ? increment
        : undefined,
  };
}

function cardioExercise(
  source: IPlannerProgramExercise | undefined,
  role: string,
  index: number,
  dayData: IPlannerProgramExercise["dayData"],
  settings: ISettings
): { exercise: IPlannerProgramExercise; prescription: ICardioPrescription } {
  const bike = role.startsWith("lower") || role === "endurance_bike";
  const intention =
    role === "run_a" || role === "run_b"
      ? role
      : role.startsWith("endurance")
        ? "endurance"
        : bike
          ? "recovery"
          : "incline_walk";
  const old = source && PlannerProgramExercise_currentEvaluatedSetVariation(source).sets;
  const oldDuration = old?.reduce((n, s, i) => n + (s.setTimer ?? 0) + (i < old.length - 1 ? (s.timer ?? 0) : 0), 0);
  const durationSeconds = role.startsWith("run")
    ? 1800
    : role.startsWith("lower") && oldDuration && oldDuration >= 600 && oldDuration <= 900
      ? oldDuration
      : role.startsWith("lower")
        ? 900
        : 1200;
  const prescription: ICardioPrescription = {
    machine: bike ? "stationary_bike" : "treadmill",
    intention,
    durationSeconds,
  };
  const entry = {
    vtype: "history_entry" as const,
    id: "cardio",
    index,
    exercise: { id: bike ? "stationaryBike" : "inclineTreadmillWalk", equipment: "leverageMachine" as const },
    warmupSets: [],
    sets: [
      {
        vtype: "set" as const,
        id: "cardio",
        index: 0,
        reps: 1,
        weight: { value: 0, unit: "lb" as const },
        setTimer: durationSeconds,
        isOverflowSetTimer: true,
        timer: 0,
        isCompleted: false,
      },
    ],
  };
  let exercise = PlannerProgramExercise_createExerciseFromEntry(entry, dayData, settings, index);
  exercise.label = role.startsWith("run")
    ? (source?.label ?? (role === "run_a" ? "runA" : "runB"))
    : role.startsWith("endurance")
      ? bike
        ? "enduranceBike"
        : "enduranceWalk"
      : bike
        ? "recoveryBike"
        : "inclineWalk";
  exercise.key = PlannerKey_fromExerciseType(entry.exercise, exercise.label);
  exercise.fullName = `${exercise.label}: ${Exercise_get(entry.exercise, settings.exercises).name}`;
  exercise.shortName = exercise.fullName;
  if (role.startsWith("run") && source) {
    const identity = {
      key: exercise.key,
      exerciseType: entry.exercise,
      name: exercise.name,
      equipment: exercise.equipment,
      label: exercise.label,
      fullName: exercise.fullName,
      shortName: exercise.shortName,
      exerciseVariations: exercise.exerciseVariations,
    };
    exercise = Object.assign(source, identity);
    if (exercise.evaluatedSetVariations.every((variation) => variation.sets.length === 1 && !variation.sets[0].auto)) {
      for (const variation of exercise.evaluatedSetVariations) {
        variation.sets[0].isOverflowSetTimer = true;
      }
    }
  }
  const main =
    role === "run_b"
      ? "Walk/jog intervals for 30 minutes. Switch Walk/Jog to record each phase."
      : role === "run_a"
        ? "Build a comfortable continuous jog within 30 minutes of walk/jog."
        : bike
          ? `${Math.round(durationSeconds / 60)} minutes at an easy controlled effort. Machine resistance and cadence are optional.`
          : "20 minutes incline treadmill walking. Choose a comfortable speed and incline.";
  const previous = source?.descriptions.values
    .map((d) => d.value)
    .filter(Boolean)
    .join("\n");
  if (!role.startsWith("run") || !source?.descriptions.values.length) {
    exercise.descriptions = {
      values: [
        {
          isCurrent: true,
          value: `Warm-up: Begin easy. Main Target: ${main} Progression: Record actual phases and effort; total time alone does not advance a running target.${previous ? `\nPrevious notes: ${previous}` : ""}`,
        },
      ],
    };
  }
  return { exercise, prescription };
}

export function PlanUpgrade_preview(
  program: IProgram,
  settings: ISettings,
  history: IHistoryRecord[],
  now = Date.now()
): IPlanUpgradePreview {
  const preview: IPlanUpgradePreview = {
    programId: program.id,
    fingerprint: PlanUpgrade_fingerprint(program),
    changes: [],
    conflicts: [],
    alreadyApplied: program.devfitPlan?.version === 5,
  };
  if (preview.alreadyApplied) {
    return preview;
  }
  if (!program.planner) {
    return { ...preview, conflicts: ["This program has no editable planner. Export it before updating."] };
  }
  let working = { ...program };
  const original = Program_forceEvaluate(program, settings);
  if (
    original.errors.length ||
    !Rotation_roles(Program_getListOfDays(original).map(([day, name]) => ({ day: Number(day), name })))
  ) {
    return {
      ...preview,
      conflicts: [
        "Select your personal Upper A/B, Lower A/B, Run A/B and Endurance rotation. Other programs keep their own rules.",
      ],
    };
  }
  const replacements: NonNullable<IDevFitPlan["replacements"]> = [];
  const changed = new Set<string>();
  for (const week of original.weeks) {
    for (const day of week.days) {
      for (const exercise of day.exercises) {
        if (changed.has(exercise.key) || !exercise.exerciseType) {
          continue;
        }
        const type = exercise.exerciseType;
        const replacement =
          type.id === "lateralRaise" && type.equipment !== "dumbbell"
            ? { id: "lateralRaise", equipment: "dumbbell" as const }
            : /standingCalfRaise|calfRaise/.test(type.id) && type.id !== "seatedCalfRaise"
              ? { id: "seatedCalfRaise", equipment: "leverageMachine" as const }
              : /crunch/i.test(type.id)
                ? "Abdominal exercise awaiting bench identification"
                : undefined;
        if (!replacement) {
          continue;
        }
        changed.add(exercise.key);
        const key =
          typeof replacement === "string" ? replacement : PlannerKey_fromExerciseType(replacement, exercise.label);
        if (
          typeof replacement !== "string" &&
          original.weeks.some((w) => w.days.some((d) => d.exercises.some((e) => e.key === key)))
        ) {
          preview.conflicts.push(
            `Both ${exercise.name} and its replacement are already in this program. Review the duplicate before updating.`
          );
          continue;
        }
        working = {
          ...working,
          planner: PlannerProgram_replaceExercise(working.planner!, exercise.key, undefined, replacement, settings),
        };
        replacements.push({
          from: exercise.key,
          to: key,
          reason:
            typeof replacement === "string"
              ? "Bench identity pending; no required abdominal sets until selected."
              : "Separate equipment baseline; prior history stays under its original identity.",
        });
        preview.changes.push(
          `${exercise.name} → ${typeof replacement === "string" ? replacement : Exercise_get(replacement, settings.exercises).name}`
        );
      }
    }
  }
  if (preview.conflicts.length) {
    return preview;
  }
  const evaluated = Program_forceEvaluate(working, settings);
  const targets: IDevFitPlan["targets"] = {};
  const cardio: IDevFitPlan["cardio"] = {};
  const add: { dayData: IPlannerProgramExercise["dayData"]; index: number; fullName: string }[] = [];
  const renameMapping: Record<string, { to: string }> = {};
  for (const week of evaluated.weeks) {
    for (const day of week.days) {
      const role = Rotation_role(day.name);
      if (!role) {
        continue;
      }
      const oldCardio = day.exercises.filter((e) => !e.notused && Session_exerciseKind(e) !== "strength");
      const strength = day.exercises.filter((e) => e.notused || Session_exerciseKind(e) === "strength");
      for (const exercise of strength) {
        if (!exercise.exerciseType || exercise.notused) {
          continue;
        }
        if (
          ![
            "chestPress",
            "benchPress",
            "inclineBenchPress",
            "latPulldown",
            "seatedRow",
            "shoulderPress",
            "overheadPress",
            "reverseFly",
            "lateralRaise",
            "tricepsPushdown",
            "bicepCurl",
            "legPress",
            "legCurl",
            "seatedLegCurl",
            "legExtension",
            "hipThrust",
            "seatedCalfRaise",
          ].includes(exercise.exerciseType.id)
        ) {
          continue;
        }
        const replacement = replacements.some((r) => r.to === exercise.key);
        if (replacement) {
          const count = exercise.exerciseType.id === "lateralRaise" ? 2 : 3;
          const sets = PlannerProgramExercise_currentEvaluatedSetVariation(exercise).sets;
          exercise.evaluatedSetVariations = [
            {
              isCurrent: true,
              sets: Array.from({ length: count }, (_, i) => ({
                ...sets[Math.min(i, sets.length - 1)],
                weight: { value: 0, unit: "lb" },
                maxrep: sets[0]?.maxrep ?? 8,
                logRpe: false,
                isAmrap: false,
                isQuickAddSet: false,
                askWeight: false,
              })),
            },
          ];
          exercise.progress = undefined;
          exercise.update = undefined;
          exercise.reuse = undefined;
          exercise.warmupSets = [];
        }
        const target = targetFor(exercise, settings, history, replacement);
        const required = PlannerProgramExercise_currentEvaluatedSetVariation(exercise).sets.filter(
          (s) => !s.isQuickAddSet
        );
        if (
          !replacement &&
          required.some((s) => s.weight?.unit === "%" || !s.weight || !LiftingUnits_same(s.weight, target.weight))
        ) {
          preview.conflicts.push(
            `${exercise.fullName} has mixed or relative working loads. Review its baseline in the program editor before updating; these targets were kept.`
          );
        }
        const existing = targets[exercise.key];
        if (existing && (!LiftingUnits_same(existing.weight, target.weight) || existing.reps !== target.reps)) {
          preview.conflicts.push(
            `${exercise.fullName} has different targets on recurring days. Give independent progressions distinct labels before applying.`
          );
        } else {
          targets[exercise.key] = existing ?? target;
        }
      }
      const roles = role === "endurance" ? ["endurance_walk", "endurance_bike"] : [role];
      day.exercises = strength;
      for (const [i, cardioRole] of roles.entries()) {
        const oldKey = oldCardio[i]?.key;
        const built = cardioExercise(oldCardio[i], cardioRole, strength.length + i, day.dayData, settings);
        day.exercises.push(built.exercise);
        if (cardioRole.startsWith("run") && oldKey) {
          renameMapping[oldKey] = { to: built.exercise.key };
        } else {
          add.push({ dayData: day.dayData, index: strength.length + i, fullName: built.exercise.fullName });
        }
        cardio[built.exercise.key] = built.prescription;
      }
    }
  }
  const planner = new ProgramToPlanner(evaluated, settings).convertToPlanner({ add, renameMapping });
  PlannerIds_preserve(program.planner, planner);
  const error = ProgramRewrite_validate(planner, settings);
  if (error) {
    preview.conflicts.push(error.message);
  }
  preview.changes.push(
    "8 → 10 → 12 → 15 earned reps; existing physical loads and working-set counts stay.",
    "Named treadmill/bike prescriptions across every recurring session; Endurance has two editable blocks.",
    "History, body measurements, equipment and calendar assignments stay in place. A recoverable plan snapshot is saved."
  );
  preview.program = {
    ...program,
    planner,
    devfitPlan: {
      version: 5,
      appliedAt: now,
      sourceFingerprint: preview.fingerprint,
      beforeProgramJson: JSON.stringify(program),
      targets,
      cardio,
      abdominal: "unknown",
      replacements,
    },
  };
  return preview;
}

export function PlanUpgrade_apply(
  storage: IStorage,
  preview: IPlanUpgradePreview
): { storage: IStorage; error?: string } {
  const current = storage.programs.find((p) => p.id === preview.programId);
  if (current?.devfitPlan?.version === 5) {
    return { storage };
  }
  if (storage.currentProgramId !== preview.programId || !current || !preview.program || preview.conflicts.length) {
    return { storage, error: "Select the previewed personal program and resolve its conflicts first." };
  }
  if (storage.progress.some((r) => r.programId === current.id)) {
    return { storage, error: "Save or discard your active workout before updating this plan." };
  }
  if (PlanUpgrade_fingerprint(current) !== preview.fingerprint) {
    return { storage, error: "The program changed. Refresh the preview before applying." };
  }
  const parsed = v.safeParse(VProgram, preview.program);
  if (!parsed.success) {
    return { storage, error: "The updated plan could not be validated. Your current plan was kept." };
  }
  const evaluated = Program_forceEvaluate(parsed.output, storage.settings);
  const exercises = evaluated.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises));
  for (const [key, target] of Object.entries(parsed.output.devfitPlan?.targets ?? {})) {
    const type = exercises.find((e) => e.key === key)?.exerciseType;
    if (target.calibrated && type && !Milestones_isAvailable(target.weight, type, storage.settings)) {
      return {
        storage,
        error: `Choose an available equipment load for ${exercises.find((e) => e.key === key)?.name}. The current plan was kept.`,
      };
    }
  }
  return { storage: { ...storage, programs: storage.programs.map((p) => (p.id === current.id ? parsed.output : p)) } };
}

export function PlanUpgrade_restore(storage: IStorage, programId: string): { storage: IStorage; error?: string } {
  const current = storage.programs.find((p) => p.id === programId);
  if (storage.progress.some((r) => r.programId === programId)) {
    return { storage, error: "Finish your active workout before restoring the plan." };
  }
  try {
    const previous = v.parse(VProgram, JSON.parse(current?.devfitPlan?.beforeProgramJson ?? "null"));
    if (previous.id !== programId) {
      throw new Error("Identity mismatch");
    }
    return { storage: { ...storage, programs: storage.programs.map((p) => (p.id === programId ? previous : p)) } };
  } catch {
    return { storage, error: "No valid pre-upgrade snapshot was found. Your plan was kept." };
  }
}
