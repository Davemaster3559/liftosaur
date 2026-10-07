import { JSX } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryEntry, ISettings } from "../types";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import { useRemScale } from "../utils/useRem";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Session_cardioIntent, Session_minutes, Session_displayName, Session_timing } from "./presentation";
import { DevFitAction, DevFitBar, DevFitTag } from "./ui";

export function DevFitCardioTimer(props: {
  entry: IHistoryEntry;
  exercise?: IPlannerProgramExercise;
  settings: ISettings;
  setIndex: number;
  elapsedSeconds: number;
  target: number;
  readySeconds?: number;
  sideLabel?: string;
  completed: boolean;
  onStart: () => void;
  onRecord: () => void;
  onKeepTiming: () => void;
  onClose: () => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const scale = useRemScale();
  const ready = props.readySeconds != null;
  const remaining = Math.max(0, props.target - props.elapsedSeconds);
  const timing = Session_timing(props.entry);
  return (
    <View testID="devfit-cardio-timer" style={{ padding: 24, gap: 22, backgroundColor: c.canvas, borderRadius: 20 }}>
      <DevFitTag label={ready ? "Get ready" : props.entry.sets[props.setIndex].label || "Cardio in progress"} cardio />
      {props.sideLabel && <DevFitTag label={props.sideLabel} />}
      <Text className="text-2xl font-bold" style={{ color: c.ink }}>
        {Session_displayName(props.exercise?.label || props.exercise?.name || "Your cardio session")}
      </Text>
      <Text className="text-sm" style={{ color: c.muted }}>
        {Session_cardioIntent(props.exercise, props.entry, props.settings)}
      </Text>
      <Text className="text-xs" style={{ color: c.muted }}>
        {Session_minutes(timing.work)} work
        {timing.rest > 0 ? ` + ${Session_minutes(timing.rest)} recovery between segments` : ""} ·{" "}
        {Session_minutes(timing.total)} total planned
      </Text>
      <View style={{ alignItems: "center", paddingVertical: 12, gap: 8 }}>
        <Text
          testID="set-timer-current"
          className="font-bold"
          style={{ color: c.cardio, fontSize: 54 * scale, lineHeight: 64 * scale }}
        >
          {ready ? props.readySeconds : Session_minutes(props.elapsedSeconds)}
        </Text>
        <Text className="text-sm" style={{ color: c.muted }}>
          {ready
            ? "seconds until you begin"
            : `${Session_minutes(remaining)} remaining · ${Session_minutes(props.target)} target`}
        </Text>
      </View>
      <DevFitBar value={props.elapsedSeconds} total={props.target} />
      {props.entry.sets.length > 1 && (
        <View style={{ gap: 8 }}>
          {props.entry.sets.map((set, i) => (
            <View
              key={set.id}
              style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}
            >
              <Text className="text-sm" style={{ color: i === props.setIndex ? c.cardio : c.muted }}>
                {set.isCompleted ? "✓ " : ""}
                {i + 1}. {set.label || "Work segment"}
                {i === props.setIndex ? " · now" : ""}
              </Text>
              <Text className="text-sm" style={{ color: c.muted }}>
                {Session_minutes(set.setTimer ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      )}
      {ready ? (
        <DevFitAction label="Start now" testID="set-timer-start-now" onPress={props.onStart} />
      ) : (
        !props.completed && (
          <>
            <DevFitAction
              label={`Stop & record · ${Session_minutes(props.elapsedSeconds)}`}
              testID="set-timer-stop-record"
              onPress={props.onRecord}
            />
            <DevFitAction
              label="Record time, keep going"
              testID="set-timer-log-keep"
              secondary
              onPress={props.onKeepTiming}
            />
          </>
        )
      )}
      {props.completed && <Text style={{ color: c.success }}>✓ Time recorded</Text>}
      <DevFitAction
        label={props.completed ? "Close timer" : "Discard timer"}
        testID="set-timer-discard"
        secondary
        onPress={props.onClose}
      />
    </View>
  );
}
