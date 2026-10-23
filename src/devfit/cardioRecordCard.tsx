import { JSX } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { ICardioPoint, CardioProgress_details } from "./cardioProgress";
import { Cardio_name } from "./cardio";
import { Dates_label } from "./dates";
import { DevFitAction, DevFitSurface, DevFitTitle } from "./ui";
import { IDispatch } from "../ducks/types";
import { DevFitTrainingDateChoice } from "./trainingDateChoice";
import { CardioTime_format } from "./cardioTime";

export function DevFitCardioRecordCard(props: {
  point: ICardioPoint;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCredit?: () => void;
  onRemoveCredit: () => void;
  dispatch?: IDispatch;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const p = props.point;
  return (
    <DevFitSurface>
      <DevFitTitle
        title={Cardio_name(p.activity)}
        subtitle={`${Dates_label(p.activity.performedLocalDate)}${p.activity.performedLocalTime ? ` · ${p.activity.performedLocalTime}` : p.activity.datePrecision === "date" ? " · date only" : ""}`}
      />
      <Text style={{ color: c.cardio }}>
        {p.activity.recordingMode === "manual"
          ? "Manually logged · local only"
          : p.activity.recordingMode === "legacy"
            ? "Previously recorded"
            : "Live recording"}
      </Text>
      {CardioProgress_details(p.activity).map(([label, value]) => (
        <View key={label} style={{ gap: 3 }}>
          <Text style={{ color: c.muted }}>{label}</Text>
          <Text style={{ color: c.ink }}>{value}</Text>
        </View>
      ))}
      {props.dispatch && <DevFitTrainingDateChoice record={p.record} dispatch={props.dispatch} />}
      {p.activity.segments?.map((s, i) => (
        <Text key={i} style={{ color: c.muted }}>
          {i + 1}. {s.phase} · {CardioTime_format(s.durationSeconds)}
          {s.breakBefore ? " · after pause" : ""}
          {s.speed ? ` · ${s.speed.value} ${s.speed.unit}` : ""}
          {s.inclinePercent != null ? ` · ${s.inclinePercent.toFixed(1)}%` : ""}
        </Text>
      ))}
      {p.record.source === "devfit_manual" && (
        <>
          <DevFitAction label="Edit activity" secondary onPress={props.onEdit} />
          <DevFitAction
            label={props.deleting ? "Confirm delete activity" : "Delete activity"}
            secondary
            onPress={props.onDelete}
          />
        </>
      )}
      {props.onCredit && <DevFitAction label="Choose schedule credit" secondary onPress={props.onCredit} />}
      {p.record.devfitScheduleCredit && (
        <>
          <Text style={{ color: c.muted }}>
            Explicit credit: {p.record.devfitScheduleCredit.scheduledDate} · Day{" "}
            {p.record.devfitScheduleCredit.rotationDay}
          </Text>
          <DevFitAction label="Remove schedule credit" secondary onPress={props.onRemoveCredit} />
        </>
      )}
    </DevFitSurface>
  );
}
