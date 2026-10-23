import { JSX, useState } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryEntry, ISettings } from "../types";
import { IPlannerProgramExercise } from "../pages/planner/models/types";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Session_cardioCoaching, Session_cardioIntent, Session_minutes, Session_timing } from "./presentation";
import { DevFitAction, DevFitSurface } from "./ui";

export function DevFitWorkoutBrief(props: {
  entry: IHistoryEntry;
  exercise?: IPlannerProgramExercise;
  settings: ISettings;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const c = Tailwind_semantic().devfit;
  const coaching = Session_cardioCoaching(props.exercise, props.entry, props.settings);
  const timing = Session_timing(props.entry);
  const aim = props.entry.devfitCardioPrescription?.durationSeconds ?? timing.total;
  return (
    <DevFitSurface testID="devfit-cardio-summary-card">
      <Text className="font-semibold" style={{ color: c.cardio }}>
        {Session_minutes(aim)} session aim
      </Text>
      <Text className="text-sm" style={{ color: c.muted }}>
        {coaching.mainTarget}
      </Text>
      {aim !== timing.total && (
        <Text className="text-xs" style={{ color: c.muted }}>
          {Session_minutes(timing.total)} in the saved work/recovery sequence. Existing interval steps are preserved;
          record the time you actually perform.
        </Text>
      )}
      <DevFitAction
        secondary
        label={open ? "Close workout briefing" : "Show workout briefing"}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <View style={{ gap: 10 }}>
          <Text className="text-sm" style={{ color: c.ink }}>
            {Session_cardioIntent(props.exercise, props.entry, props.settings)}
          </Text>
          <Text className="text-sm" style={{ color: c.muted }}>
            {coaching.progressionRule}
          </Text>
          {props.entry.sets.map((set, index) => (
            <Text key={set.id} className="text-sm" style={{ color: set.isCompleted ? c.success : c.muted }}>
              {set.isCompleted ? "✓" : index + 1} · {set.label || "Work"} · {Session_minutes(set.setTimer ?? 0)}
            </Text>
          ))}
        </View>
      )}
    </DevFitSurface>
  );
}
