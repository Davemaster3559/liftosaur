import { JSX, useState } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IDispatch } from "../ducks/types";
import { DevFitAction } from "./ui";
import { DevFitField } from "./field";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { PlanActions_cardio } from "./planActions";
import { ICardioPrescription } from "./planSchema";
import { CardioTime_format, CardioTime_parse } from "./cardioTime";
import { Cardio_prescriptionName } from "./cardio";

export function DevFitCardioPlanSetup(props: {
  programId: string;
  exerciseKey: string;
  prescription: ICardioPrescription;
  dispatch: IDispatch;
  isOngoing: boolean;
}): JSX.Element {
  const [duration, setDuration] = useState(CardioTime_format(props.prescription.durationSeconds));
  const [machine, setMachine] = useState(props.prescription.machine);
  const [message, setMessage] = useState<string>();
  const seconds = CardioTime_parse(duration);
  const c = Tailwind_semantic().devfit;
  return (
    <View style={{ gap: 8, paddingVertical: 14 }}>
      <Text className="font-semibold" style={{ color: c.cardio }}>
        {Cardio_prescriptionName(props.prescription)}
      </Text>
      <DevFitField label="Future duration (mm:ss)" value={duration} onChange={setDuration} />
      {props.prescription.intention === "recovery" && (
        <View style={{ gap: 6 }}>
          <DevFitAction
            secondary
            label={machine === "stationary_bike" ? "✓ Stationary bike" : "Use stationary bike"}
            onPress={() => setMachine("stationary_bike")}
          />
          <DevFitAction
            secondary
            label={machine === "stair_climber" ? "✓ Stair climber alternative" : "Choose stair climber instead"}
            onPress={() => setMachine("stair_climber")}
          />
        </View>
      )}
      <DevFitAction
        secondary
        disabled={props.isOngoing || !seconds}
        label="Save future cardio target"
        onPress={() =>
          props.dispatch(
            PlanActions_cardio(
              props.programId,
              props.exerciseKey,
              { ...props.prescription, machine, durationSeconds: seconds! },
              (error) => setMessage(error ?? "Future cardio target saved.")
            )
          )
        }
      />
      {message && <Text style={{ color: c.muted }}>{message}</Text>}
    </View>
  );
}
