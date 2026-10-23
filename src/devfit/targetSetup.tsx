import { JSX, useState } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IDispatch } from "../ducks/types";
import { DevFitAction } from "./ui";
import { DevFitField } from "./field";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { PlanActions_load, PlanActions_target } from "./planActions";
import { IMilestoneTarget } from "./planSchema";
import { LiftingUnits_convert, LiftingUnits_print } from "./liftingUnits";

export function DevFitTargetSetup(props: {
  programId: string;
  exerciseKey: string;
  target: IMilestoneTarget;
  dispatch: IDispatch;
  label: string;
  onChange?: (target: IMilestoneTarget) => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [editing, setEditing] = useState(false);
  const [load, setLoad] = useState("");
  const [step, setStep] = useState("");
  const [reps, setReps] = useState(props.target.reps);
  const [error, setError] = useState<string>();
  const weight = PlanActions_load(load, props.target.weight);
  const increment = PlanActions_load(step);
  return (
    <View style={{ gap: 8 }}>
      <Text className="font-semibold" style={{ color: c.ink }}>
        {props.label}
      </Text>
      <Text style={{ color: c.muted }}>
        {LiftingUnits_print(props.target.weight)} · {props.target.reps} reps
        {!props.target.calibrated ? " · baseline needs confirmation" : ""}
        {props.target.step ? ` · +${LiftingUnits_print(props.target.step)}` : " · choose a load increment"}
        {props.target.keep ? " · hold target" : ""}
      </Text>
      <DevFitAction
        secondary
        label={editing ? "Close progression setup" : "Edit progression / calibrate"}
        onPress={() => {
          setEditing(!editing);
          setReps(props.target.reps);
          setError(undefined);
          setLoad(String(+LiftingUnits_convert(props.target.weight, "lb").value.toFixed(2)));
          setStep(props.target.step ? String(+LiftingUnits_convert(props.target.step, "lb").value.toFixed(2)) : "");
        }}
      />
      {editing && (
        <>
          <DevFitField label="Available working load (lb)" value={load} onChange={setLoad} numeric />
          <Text style={{ color: c.muted }}>
            {/dumbbell/i.test(props.exerciseKey) ? "Weight per dumbbell. " : ""}Confirm the load shown on your
            equipment. Existing kg records keep their original values.
          </Text>
          <DevFitField label="Load increment for this exercise (lb)" value={step} onChange={setStep} numeric />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {([8, 10, 12, 15] as const).map((stage) => (
              <DevFitAction
                key={stage}
                secondary
                label={`${reps === stage ? "✓ " : ""}${stage} reps`}
                onPress={() => setReps(stage)}
              />
            ))}
          </View>
          {error && (
            <Text accessibilityRole="alert" style={{ color: c.accent }}>
              {error}
            </Text>
          )}
          <DevFitAction
            label="Confirm baseline and increment"
            disabled={!weight || weight.value <= 0 || !increment || increment.value <= 0}
            onPress={() => {
              const target = { ...props.target, weight: weight!, step: increment!, reps, calibrated: true };
              if (props.onChange) {
                props.onChange(target);
                setEditing(false);
              } else {
                props.dispatch(
                  PlanActions_target(props.programId, props.exerciseKey, target, (message) => {
                    setError(message);
                    if (!message) {
                      setEditing(false);
                    }
                  })
                );
              }
            }}
          />
          <DevFitAction
            secondary
            label={props.target.keep ? "Resume earned progression" : "Keep this target"}
            onPress={() => {
              const target = { ...props.target, keep: !props.target.keep };
              if (props.onChange) {
                props.onChange(target);
              } else {
                props.dispatch(PlanActions_target(props.programId, props.exerciseKey, target));
              }
            }}
          />
        </>
      )}
    </View>
  );
}
