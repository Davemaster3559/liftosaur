import { JSX, useState } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { ICardioPhaseSettings } from "./cardioSchema";
import { DevFitAction } from "./ui";
import { Tailwind_semantic } from "../utils/tailwindConfig";

export function DevFitPhaseControls(props: {
  phase: "walk" | "jog";
  suggestion?: ICardioPhaseSettings;
  actual?: ICardioPhaseSettings;
  onConfirm: (s: ICardioPhaseSettings) => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [speed, setSpeed] = useState(
    props.actual?.speed?.value ?? props.suggestion?.speed?.value ?? (props.phase === "walk" ? 2.5 : 4)
  );
  const [incline, setIncline] = useState(
    props.actual?.inclinePercent ?? props.suggestion?.inclinePercent ?? (props.phase === "walk" ? 5 : 3.5)
  );
  const [unit, setUnit] = useState<"mph" | "kmh">(props.actual?.speed?.unit ?? props.suggestion?.speed?.unit ?? "mph");
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: c.muted }}>
        {props.phase === "walk" ? "Walk" : "Jog"} settings · editable suggestion until confirmed
      </Text>
      <Text style={{ color: c.ink }}>
        {speed.toFixed(1)} {unit === "mph" ? "mph" : "km/h"} · {incline.toFixed(1)}% incline
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <DevFitAction label="Speed −0.1" secondary onPress={() => setSpeed(Math.max(0, +(speed - 0.1).toFixed(1)))} />
        <DevFitAction label="Speed +0.1" secondary onPress={() => setSpeed(+(speed + 0.1).toFixed(1))} />
        <DevFitAction label="Grade −0.5%" secondary onPress={() => setIncline(Math.max(-10, incline - 0.5))} />
        <DevFitAction label="Grade +0.5%" secondary onPress={() => setIncline(Math.min(40, incline + 0.5))} />
        <DevFitAction
          label={`Speed unit: ${unit}`}
          secondary
          onPress={() => {
            setUnit(unit === "mph" ? "kmh" : "mph");
            setSpeed(+(speed * (unit === "mph" ? 1.609344 : 1 / 1.609344)).toFixed(1));
          }}
        />
      </View>
      <DevFitAction
        label="Confirm machine settings from now"
        secondary
        onPress={() => props.onConfirm({ speed: { value: speed, unit }, inclinePercent: incline })}
      />
    </View>
  );
}
