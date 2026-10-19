import { JSX } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryEntry, ISettings } from "../types";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import { useRemScale } from "../utils/useRem";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import {
  Session_cardioCoaching,
  Session_minutes,
  Session_displayName,
  Session_timing,
  Session_phase,
  Session_exerciseKind,
} from "./presentation";
import { DevFitAction, DevFitBar, DevFitSurface, DevFitTag } from "./ui";

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
  nextSide?: boolean;
  paused?: boolean;
  onStart: () => void;
  onRecord: () => void;
  onKeepTiming: () => void;
  onClose: () => void;
  onResume?: () => void;
  onSwitchPhase?: () => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const scale = useRemScale();
  const ready = props.readySeconds != null;
  const remaining = Math.max(0, props.target - props.elapsedSeconds);
  const timing = Session_timing(props.entry);
  const coaching = Session_cardioCoaching(props.exercise, props.entry, props.settings);
  const set = props.entry.sets[props.setIndex];
  const phase = Session_phase(set, props.elapsedSeconds);
  const showPhase =
    props.entry.sets.length === 1 &&
    !set.isUnilateral &&
    Session_exerciseKind(props.exercise, props.entry, props.settings) === "running";
  return (
    <View testID="devfit-cardio-timer" style={{ padding: 24, gap: 18, backgroundColor: c.canvas, borderRadius: 20 }}>
      <DevFitTag
        label={props.paused ? "Workout paused" : ready ? "Get ready" : props.completed ? "Time recorded" : "Running"}
        cardio
      />
      {props.sideLabel && <DevFitTag label={props.sideLabel} />}
      <Text className="text-2xl font-bold" style={{ color: c.ink }}>
        {Session_displayName(props.exercise?.label || props.exercise?.name || "Your cardio session")}
      </Text>
      <View style={{ alignItems: "center", paddingVertical: 8, gap: 8 }}>
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
        {props.paused && <Text style={{ color: c.accent }}>Workout, rest and cardio clocks are frozen.</Text>}
        {props.completed && !props.paused && (
          <Text style={{ color: c.muted }}>Time saved. The clock keeps running until you close it.</Text>
        )}
        {!ready && showPhase && (
          <Text testID="devfit-cardio-phase" style={{ color: c.ink }}>
            {phase.phase === "walk" ? "WALK" : "JOG"} · {Session_minutes(phase.seconds)} this phase
          </Text>
        )}
      </View>
      <DevFitBar value={props.elapsedSeconds} total={props.target} />
      {props.paused ? (
        <DevFitAction label="Resume workout" testID="devfit-cardio-resume" onPress={() => props.onResume?.()} />
      ) : ready ? (
        <DevFitAction label="Start now" testID="set-timer-start-now" onPress={props.onStart} />
      ) : (
        <>
          {(!props.completed || props.nextSide) && (
            <DevFitAction
              label={props.nextSide ? "Next side →" : `Stop & record · ${Session_minutes(props.elapsedSeconds)}`}
              testID="set-timer-stop-record"
              onPress={props.onRecord}
            />
          )}
          {!props.completed && (
            <DevFitAction
              label="Record time, keep going"
              testID="set-timer-log-keep"
              secondary
              onPress={props.onKeepTiming}
            />
          )}
          {!props.completed && showPhase && props.onSwitchPhase && (
            <DevFitAction
              label={phase.phase === "walk" ? "Switch to jog" : "Switch to walk"}
              testID="devfit-cardio-switch-phase"
              secondary
              onPress={props.onSwitchPhase}
            />
          )}
        </>
      )}
      <DevFitSurface testID="devfit-cardio-coaching-card">
        {coaching.instructions && <Text style={{ color: c.ink }}>{coaching.instructions}</Text>}
        {[
          ["WARM-UP", coaching.warmup],
          ["MAIN TARGET", coaching.mainTarget],
          ["RECOVERY", coaching.recovery],
          ["THEN", coaching.then],
          ["PROGRESSION", coaching.progressionRule],
        ].map(([label, value]) =>
          value ? (
            <View key={label} style={{ gap: 4 }}>
              <Text className="text-xs font-bold" style={{ color: c.cardio }}>
                {label}
              </Text>
              <Text className="text-sm" style={{ color: c.ink }}>
                {value}
              </Text>
            </View>
          ) : null
        )}
      </DevFitSurface>
      <Text className="text-xs" style={{ color: c.muted }}>
        {Session_minutes(timing.work)} work
        {timing.rest > 0 ? ` + ${Session_minutes(timing.rest)} recovery between segments` : ""} ·{" "}
        {Session_minutes(timing.total)} total planned
      </Text>
      {props.entry.sets.length > 1 && (
        <View style={{ gap: 8 }}>
          {props.entry.sets.map((segment, i) => (
            <View
              key={segment.id}
              style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}
            >
              <Text className="text-sm" style={{ color: i === props.setIndex ? c.cardio : c.muted }}>
                {segment.isCompleted ? "✓ " : ""}
                {i + 1}. {segment.label || "Work segment"}
                {i === props.setIndex ? " · now" : ""}
              </Text>
              <Text className="text-sm" style={{ color: c.muted }}>
                {Session_minutes(segment.setTimer ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      )}
      <DevFitAction
        label={props.completed ? "Close timer" : "Discard timer"}
        testID="set-timer-discard"
        secondary
        onPress={props.onClose}
      />
    </View>
  );
}
