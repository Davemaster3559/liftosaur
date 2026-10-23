import { JSX, useState } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord } from "../types";
import { IDispatch } from "../ducks/types";
import { Dates_day, Dates_label } from "./dates";
import { TrainingDateActions_assign } from "./trainingDateActions";
import { DevFitAction } from "./ui";
import { DevFitField } from "./field";
import { Tailwind_semantic } from "../utils/tailwindConfig";

export function DevFitTrainingDateChoice(props: { record: IHistoryRecord; dispatch: IDispatch }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const assignment = props.record.devfitTrainingDate;
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(assignment?.date ?? assignment?.legacyCivilDate ?? "");
  const unresolved = assignment?.source === "legacy_date_only";
  return (
    <View style={{ gap: 8 }}>
      <Text className="text-sm" style={{ color: c.muted }}>
        {assignment?.date
          ? `Training date · ${Dates_label(assignment.date)}${assignment.source === "override" ? " · assigned by you" : ""}`
          : unresolved
            ? "Training date needs confirmation. The original date and time are preserved."
            : "Training date follows the workout start."}
      </Text>
      <DevFitAction
        secondary
        label={
          editing
            ? "Cancel training date change"
            : unresolved
              ? "Confirm training date"
              : "Count toward another training day"
        }
        onPress={() => setEditing(!editing)}
      />
      {editing && (
        <>
          <DevFitField
            label="Training date (YYYY-MM-DD)"
            testID="training-date-choice"
            value={date}
            onChange={setDate}
          />
          <DevFitAction
            label="Use this training date"
            disabled={Dates_day(date) == null}
            onPress={() => {
              props.dispatch(TrainingDateActions_assign(props.record.id, date));
              setEditing(false);
            }}
          />
        </>
      )}
    </View>
  );
}
