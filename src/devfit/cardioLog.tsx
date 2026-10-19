import { JSX, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, IProgram, ISettings } from "../types";
import { IDispatch } from "../ducks/types";
import { Program_evaluate } from "../models/program";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { DevFitAction, DevFitSurface, DevFitTitle } from "./ui";
import { CardioActions_credit, CardioActions_delete, CardioActions_save } from "./cardioActions";
import { CardioProgress_records, ICardioPoint } from "./cardioProgress";
import { Dates_add, Dates_key, Dates_timestamp, Dates_zone } from "./dates";
import { Schedule_get, Schedule_slots } from "./schedule";
import { DevFitCardioActivityForm } from "./cardioActivityForm";
import { DevFitCardioRecordCard } from "./cardioRecordCard";

export function DevFitCardioLog(props: {
  history: IHistoryRecord[];
  settings: ISettings;
  dispatch: IDispatch;
  program?: IProgram;
  editRecord?: IHistoryRecord;
  compact?: boolean;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [mode, setMode] = useState<"closed" | "new" | "list" | "edit">("closed");
  const [selected, setSelected] = useState<number>();
  const [deleting, setDeleting] = useState(false);
  const [crediting, setCrediting] = useState<number>();
  const list = useRef<FlatList<ICardioPoint>>(null);
  const evaluated = useMemo(
    () => (props.program ? Program_evaluate(props.program, props.settings) : undefined),
    [props.program, props.settings]
  );
  const zone = evaluated ? Schedule_get(evaluated, props.settings).homeTimeZone || Dates_zone() : Dates_zone();
  const points = useMemo(
    () =>
      mode === "closed"
        ? []
        : CardioProgress_records(props.history, props.settings)
            .reverse()
            .filter((p) => !props.editRecord || p.record.id === props.editRecord.id),
    [props.history, props.settings, props.editRecord, mode]
  );
  const record = props.history.find((r) => r.id === selected);
  const activity = record?.entries[0]?.sets[0]?.devfitCardio;
  const linkRecord = props.history.find((r) => r.id === crediting);
  const slots =
    evaluated && linkRecord
      ? [-14, 0].flatMap((offset) =>
          Schedule_slots(
            evaluated,
            props.settings,
            props.history,
            Dates_timestamp(
              Dates_add(
                linkRecord.entries[0]?.sets[0]?.devfitCardio?.performedLocalDate ??
                  Dates_key(linkRecord.startTime, zone),
                offset
              ),
              zone
            )
          )
        )
      : [];
  return (
    <>
      <DevFitAction
        label={props.editRecord ? "View / edit cardio activity" : "Log past activity"}
        testID="devfit-log-past"
        secondary
        onPress={() => {
          setSelected(props.editRecord?.id);
          setMode(props.editRecord ? "list" : "new");
        }}
      />
      {!props.compact && <DevFitAction label="Cardio history & details" secondary onPress={() => setMode("list")} />}
      <Modal visible={mode !== "closed"} animationType="slide" onRequestClose={() => setMode("closed")}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: c.canvas }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {mode === "new" || mode === "edit" ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 18, padding: 20, paddingTop: 52, paddingBottom: 48 }}
            >
              <DevFitCardioActivityForm
                key={`${mode}-${selected}`}
                settings={props.settings}
                history={props.history}
                zone={zone}
                activity={mode === "edit" ? activity : undefined}
                recordId={mode === "edit" ? selected : undefined}
                onCancel={() => setMode("list")}
                onSave={(a) => {
                  props.dispatch(
                    CardioActions_save(
                      a,
                      mode === "edit" ? selected : undefined,
                      mode === "edit" ? record?.devfitScheduleCredit : undefined
                    )
                  );
                  setMode("list");
                }}
              />
              <DevFitAction label="Close activity log" secondary onPress={() => setMode("closed")} />
            </ScrollView>
          ) : (
            <FlatList
              ref={list}
              data={points}
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={3}
              keyExtractor={(p) => p.key}
              contentContainerStyle={{ gap: 18, padding: 20, paddingTop: 52, paddingBottom: 48 }}
              ListHeaderComponent={
                <View style={{ gap: 16 }}>
                  <DevFitTitle title="Cardio history" subtitle="Actual sessions · manually logged entries stay local" />
                  <DevFitAction
                    label="+ Log activity"
                    onPress={() => {
                      setSelected(undefined);
                      setMode("new");
                    }}
                  />
                  <DevFitAction label="Close activity log" secondary onPress={() => setMode("closed")} />
                  {crediting != null && (
                    <DevFitSurface>
                      <Text style={{ color: c.ink }}>
                        Count this activity toward one planned session. Its performed date and identity stay as
                        recorded.
                      </Text>
                      {slots
                        .filter((s) => s.session && s.dateKey && s.dateKey <= Dates_key(Date.now(), zone))
                        .map((s) => (
                          <DevFitAction
                            key={s.dateKey}
                            secondary
                            label={`Credit ${s.dateKey} · Day ${s.day} · ${s.session!.name}`}
                            onPress={() => {
                              props.dispatch(
                                CardioActions_credit(crediting, {
                                  programId: evaluated!.id,
                                  scheduledDate: s.dateKey!,
                                  rotationDay: s.day,
                                  programDay: s.programDay!,
                                })
                              );
                              setCrediting(undefined);
                            }}
                          />
                        ))}
                      <DevFitAction label="Cancel credit" secondary onPress={() => setCrediting(undefined)} />
                    </DevFitSurface>
                  )}
                </View>
              }
              ListEmptyComponent={
                <Text style={{ color: c.muted }}>
                  No cardio recorded yet. Add a past run with only its date and duration.
                </Text>
              }
              renderItem={({ item: p }) => (
                <DevFitCardioRecordCard
                  point={p}
                  deleting={deleting && selected === p.record.id}
                  onEdit={() => {
                    setSelected(p.record.id);
                    setMode("edit");
                  }}
                  onDelete={() => {
                    if (deleting && selected === p.record.id) {
                      props.dispatch(CardioActions_delete(p.record.id));
                      setDeleting(false);
                    } else {
                      setSelected(p.record.id);
                      setDeleting(true);
                    }
                  }}
                  onCredit={
                    evaluated
                      ? () => {
                          setCrediting(p.record.id);
                          list.current?.scrollToOffset({ offset: 0, animated: true });
                        }
                      : undefined
                  }
                  onRemoveCredit={() => props.dispatch(CardioActions_credit(p.record.id))}
                />
              )}
            />
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
