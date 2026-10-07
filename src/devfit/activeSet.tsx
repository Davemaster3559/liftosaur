import { JSX } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IWorkoutExerciseSetBodyProps } from "../components/workoutExerciseSet";
import { InputNumber2 } from "../components/inputNumber2";
import { InputWeight2 } from "../components/inputWeight2";
import { WorkoutExerciseSetRpeTime } from "../components/workoutExerciseSetFields";
import { PlatesBar } from "../components/platesBar";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Weight_convertTo } from "../models/weight";
import { DevFitAction, DevFitSurface, DevFitTag } from "./ui";
import { Session_minutes } from "./presentation";

export function DevFitActiveSet(props: IWorkoutExerciseSetBodyProps): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const { set, lastSet } = props;
  const timed = set.setTimer != null;
  return (
    <DevFitSurface accent testID="devfit-active-set">
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
        <DevFitTag
          label={`${props.type === "warmup" ? "Warmup" : "Working set"} ${props.setIndex + 1}${set.isCompleted ? " · completed" : ""}`}
          success={set.isCompleted}
        />
        {set.isAmrap && <DevFitTag label="AMRAP" />}
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
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 105, gap: 8 }}>
              <Text className="text-xs font-bold" style={{ color: c.muted }}>
                WEIGHT · {set.weight?.unit ?? props.settings.units}
              </Text>
              <InputWeight2
                name="set-weight"
                size="lg"
                fill
                showUnitInCorner
                exerciseType={props.exerciseType}
                inputCommitMode="blur"
                onBlur={props.onBlurWeight}
                onInput={props.onInputWeight}
                subscription={props.subscription}
                placeholder={props.placeholderWeight}
                initialValue={set.weight}
                value={set.completedWeight ?? set.weight}
                max={9999}
                min={-9999}
                settings={props.settings}
              />
            </View>
            <View style={{ flex: 1, minWidth: 105, gap: 8 }}>
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
            </View>
            {props.isUnilateral && (
              <View style={{ flex: 1, minWidth: 105, gap: 8 }}>
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
              label={`Use previous · ${Weight_convertTo(lastSet.completedWeight, set.weight?.unit ?? props.settings.units).value} × ${lastSet.completedReps}`}
              secondary
              onPress={() => {
                props.onBlurWeight(
                  Weight_convertTo(lastSet.completedWeight!, set.weight?.unit ?? props.settings.units)
                );
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
        label={set.isCompleted ? "Undo completion" : timed ? "Start timer  ▶" : "Complete set  ✓"}
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
        {props.onEditTarget && <DevFitAction label="Edit target" secondary onPress={props.onEditTarget} />}
        {timed && props.onEditSetTimer && (
          <DevFitAction label="Timer options" secondary onPress={props.onEditSetTimer} />
        )}
        {props.isRoundedWeight && <DevFitAction label="Plate rounding" secondary onPress={props.onOpenRoundingInfo} />}
      </View>
    </DevFitSurface>
  );
}
