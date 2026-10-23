import { JSX, useState } from "react";
import { Modal, ScrollView } from "react-native";
import { lb } from "lens-shmens";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, ISettings } from "../types";
import { IDispatch } from "../ducks/types";
import { updateProgress } from "../models/state";
import { DevFitAction, DevFitSurface } from "./ui";
import { DevFitCardioActivityForm } from "./cardioActivityForm";
import { Cardio_entryActivity, Cardio_updateEntry } from "./cardio";
import { CardioProgress_details } from "./cardioProgress";
import { Dates_zone } from "./dates";
import { Tailwind_semantic } from "../utils/tailwindConfig";

export function DevFitRecordedCardio(props: {
  progress: IHistoryRecord;
  entryIndex: number;
  settings: ISettings;
  history: IHistoryRecord[];
  dispatch: IDispatch;
}): JSX.Element {
  const [edit, setEdit] = useState<number>();
  const c = Tailwind_semantic().devfit;
  const entry = props.progress.entries[props.entryIndex];
  const aggregate = entry.sets.length > 1 ? Cardio_entryActivity(props.progress, entry, "") : undefined;
  const activity = edit == null ? undefined : edit === -1 ? aggregate : entry.sets[edit]?.devfitCardio;
  const items = aggregate
    ? [{ key: entry.id, activity: aggregate, index: -1 }]
    : entry.sets.flatMap((set, index) =>
        set.isCompleted && set.devfitCardio ? [{ key: set.id, activity: set.devfitCardio, index }] : []
      );
  return (
    <>
      {items.map((item) => (
        <DevFitSurface key={item.key}>
          <Text className="font-bold" style={{ color: c.cardio }}>
            {item.index === -1 ? "Recorded cardio activity" : `Recorded cardio · segment ${item.index + 1}`}
          </Text>
          {CardioProgress_details(item.activity).map(([label, value]) => (
            <Text key={label} style={{ color: c.muted }}>
              {label}: {value}
            </Text>
          ))}
          <DevFitAction
            label={`Add / edit cardio details${item.index === -1 ? "" : ` ${item.index + 1}`}`}
            secondary
            onPress={() => setEdit(item.index)}
          />
        </DevFitSurface>
      ))}
      <Modal visible={!!activity} animationType="slide" onRequestClose={() => setEdit(undefined)}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: c.canvas }}
          contentContainerStyle={{ padding: 20, paddingTop: 50, paddingBottom: 48 }}
        >
          {activity && (
            <DevFitCardioActivityForm
              activity={activity}
              mode="live"
              zone={activity.timeZone ?? Dates_zone()}
              settings={props.settings}
              history={props.history}
              onCancel={() => setEdit(undefined)}
              onSave={(a) => {
                updateProgress(
                  props.dispatch,
                  lb<IHistoryRecord>()
                    .p("entries")
                    .i(props.entryIndex)
                    .recordModify((currentEntry) => Cardio_updateEntry(currentEntry, edit!, a)),
                  "Update actual cardio details"
                );
                setEdit(undefined);
              }}
            />
          )}
        </ScrollView>
      </Modal>
    </>
  );
}
