import { JSX } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IWorkoutExerciseSetBodyProps } from "../components/workoutExerciseSet";
import { InputNumber2 } from "../components/inputNumber2";
import { InputWeight2 } from "../components/inputWeight2";
import { WorkoutExerciseSetRpeTime } from "../components/workoutExerciseSetFields";
import { PlatesBar } from "../components/platesBar";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Weight_build, Weight_step, Weight_print } from "../models/weight";
import { IWeight } from "../types";
import { LiftingUnits_commit, LiftingUnits_convert, LiftingUnits_print } from "./liftingUnits";
import { Milestones_adjustLoad } from "./milestones";
import { Exercise_get } from "../models/exercise";
import { DevFitAction, DevFitSurface, DevFitTag } from "./ui";
import { Session_kind, Session_minutes } from "./presentation";

export function DevFitActiveSet(props: IWorkoutExerciseSetBodyProps & { loadStep?: IWeight }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const { set, lastSet } = props;
  const timed = set.setTimer != null;
  const kind = Session_kind(Exercise_get(props.exerciseType, props.settings.exercises).name);
  const originalWeight = set.completedWeight ?? set.weight;
  const displayWeight = originalWeight && LiftingUnits_convert(originalWeight, "lb");
  const weightUnit = "lb";
  const currentWeightValue = displayWeight?.value ?? 0;
  const currentRepsValue = set.completedReps ?? set.reps ?? 0;
  const currentLeftRepsValue = set.completedRepsLeft ?? set.reps ?? 0;

  const stepWeight = (direction: -1 | 1): void => {
    props.onBlurWeight(
      props.loadStep
        ? Milestones_adjustLoad(
            originalWeight ?? Weight_build(currentWeightValue, weightUnit),
            direction,
            props.loadStep,
            props.exerciseType,
            props.settings
          )
        : Weight_step(
            originalWeight ?? Weight_build(currentWeightValue, weightUnit),
            direction,
            props.settings,
            props.exerciseType
          )
    );
  };

  const stepReps = (delta: number): void => {
    props.onBlurReps(Math.max(0, currentRepsValue + delta));
  };

  const stepLeftReps = (delta: number): void => {
    props.onBlurLeftReps(Math.max(0, currentLeftRepsValue + delta));
  };

  return (
    <DevFitSurface accent testID="devfit-active-set">
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
        <DevFitTag
          label={`${props.type === "warmup" ? "Warmup" : "Working set"} ${props.setIndex + 1}${set.isCompleted ? " · completed" : ""}`}
          success={set.isCompleted}
        />
        {set.isAmrap && <DevFitTag label="AMRAP" />}
        {timed && <DevFitTag label={set.isCompleted ? "Time recorded" : "Ready"} cardio />}
        {props.isUnilateral && <DevFitTag label="Left + right" />}
      </View>
      {timed ? (
        <View style={{ gap: 8 }}>
          <Text className="text-4xl font-bold text-center" style={{ color: c.ink }}>
            {Session_minutes(set.setTimer!)}
          </Text>
          <Text className="text-sm text-center" style={{ color: c.muted }}>
            {set.label || "Duration target"}
            {set.isOverflowSetTimer ? " · keep going if you can" : ""}
          </Text>
          {set.completedSetTimer != null && (
            <Text className="text-center" style={{ color: c.success }}>
              Recorded {Session_minutes(set.completedSetTimer)}
            </Text>
          )}
          {kind === "strength" && (set.completedWeight?.value ?? set.weight?.value ?? 0) > 0 && (
            <Text className="text-center" style={{ color: c.ink }}>
              Load · {Weight_print(set.completedWeight ?? set.weight!)}
            </Text>
          )}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 135, gap: 8 }}>
              <Text className="text-xs font-bold" style={{ color: c.muted }}>
                WEIGHT · lb{props.exerciseType.equipment === "dumbbell" ? " per dumbbell" : ""}
              </Text>
              <InputWeight2
                key={weightUnit}
                name="set-weight"
                size="lg"
                fill
                showUnitInCorner
                exerciseType={props.exerciseType}
                inputCommitMode="blur"
                onBlur={(value) => props.onBlurWeight(LiftingUnits_commit(value, originalWeight))}
                onInput={(value) => props.onInputWeight(LiftingUnits_commit(value, originalWeight))}
                subscription={props.subscription}
                placeholder={props.placeholderWeight}
                initialValue={set.weight && LiftingUnits_convert(set.weight, "lb")}
                value={displayWeight}
                units={["lb"]}
                max={9999}
                min={-9999}
                settings={props.settings}
              />
              {originalWeight && (
                <Text className="text-xs" style={{ color: c.muted }}>
                  {LiftingUnits_print(originalWeight, "kg")} equivalent
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <DevFitAction
                    label="− weight"
                    secondary
                    testID="devfit-weight-minus"
                    onPress={() => stepWeight(-1)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <DevFitAction label="+ weight" secondary testID="devfit-weight-plus" onPress={() => stepWeight(1)} />
                </View>
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 135, gap: 8 }}>
              <Text className="text-xs font-bold" style={{ color: c.muted }}>
                {props.isUnilateral ? "RIGHT REPS" : "REPS"}
              </Text>
              <InputNumber2
                name="set-reps"
                size="lg"
                fill
                inputCommitMode="blur"
                onInput={props.onInputReps}
                onBlur={props.onBlurReps}
                placeholder={props.placeholderReps}
                initialValue={set.reps}
                value={set.completedReps ?? set.reps}
                min={0}
                max={9999}
                step={1}
              />
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <DevFitAction label="-1" secondary testID="devfit-reps-minus" onPress={() => stepReps(-1)} />
                </View>
                <View style={{ flex: 1 }}>
                  <DevFitAction label="+1" secondary testID="devfit-reps-plus" onPress={() => stepReps(1)} />
                </View>
              </View>
            </View>
            {props.isUnilateral && (
              <View style={{ flex: 1, minWidth: 135, gap: 8 }}>
                <Text className="text-xs font-bold" style={{ color: c.muted }}>
                  LEFT REPS
                </Text>
                <InputNumber2
                  name="set-left-reps"
                  size="lg"
                  fill
                  inputCommitMode="blur"
                  onInput={props.onInputLeftReps}
                  onBlur={props.onBlurLeftReps}
                  placeholder={props.placeholderReps}
                  initialValue={set.reps}
                  value={set.completedRepsLeft ?? set.reps}
                  min={0}
                  max={9999}
                  step={1}
                />
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <View style={{ flex: 1 }}>
                    <DevFitAction
                      label="-1"
                      secondary
                      testID="devfit-left-reps-minus"
                      onPress={() => stepLeftReps(-1)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DevFitAction label="+1" secondary testID="devfit-left-reps-plus" onPress={() => stepLeftReps(1)} />
                  </View>
                </View>
              </View>
            )}
          </View>
          <Text className="text-xs" style={{ color: c.muted }}>
            Target: {props.placeholderReps} reps{set.rpe != null ? ` @ RPE ${set.rpe}` : ""}
          </Text>
          {(set.logRpe || set.rpe != null) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text className="text-sm" style={{ color: c.muted }}>
                Effort / RPE
              </Text>
              <WorkoutExerciseSetRpeTime
                set={set}
                isUnilateral={props.isUnilateral}
                completedRpeValue={props.completedRpeValue}
                sizeClass="text-lg"
                onEditSetTimer={props.onEditSetTimer}
              />
            </View>
          )}
          {lastSet?.completedWeight && lastSet.completedReps != null && !set.isCompleted && (
            <DevFitAction
              label={`Use previous · ${LiftingUnits_print(lastSet.completedWeight)} × ${lastSet.completedReps}`}
              secondary
              onPress={() => {
                props.onBlurWeight(lastSet.completedWeight!);
                props.onBlurReps(lastSet.completedReps);
                if (props.isUnilateral) {
                  props.onBlurLeftReps(lastSet.completedRepsLeft);
                }
              }}
            />
          )}
        </>
      )}
      <DevFitAction
        label={
          set.isCompleted
            ? "Undo completion"
            : timed
              ? kind === "running" || /run[ _-]*[ab]\d*/i.test(set.label ?? "")
                ? "Start run  ▶"
                : "Start timer  ▶"
              : props.preserveRest
                ? "Log set · keep current rest"
                : "Log set  ✓"
        }
        testID={timed && !set.isCompleted ? "start-set-timer" : "complete-set"}
        onPress={props.onCompleteSet}
      />
      {props.platesLine && (
        <View style={{ gap: 6 }}>
          <Text className="text-xs" style={{ color: c.muted }}>
            Plates per side · {props.platesLine.plates}
          </Text>
          <PlatesBar plates={props.platesLine.sidePlates} />
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {!timed && <DevFitAction label="Weight setup" secondary onPress={props.onWeightSetup} />}
        {props.onEditTarget && <DevFitAction label="Edit target" secondary onPress={props.onEditTarget} />}
        {timed && props.onEditSetTimer && (
          <DevFitAction label="Timer options" secondary onPress={props.onEditSetTimer} />
        )}
        {props.isRoundedWeight && <DevFitAction label="Plate rounding" secondary onPress={props.onOpenRoundingInfo} />}
      </View>
    </DevFitSurface>
  );
}
