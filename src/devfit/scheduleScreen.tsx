import { JSX, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { lb } from "lens-shmens";
import { Text } from "../components/primitives/text";
import { IDevFitSchedule, IHistoryRecord, IProgram, ISettings } from "../types";
import { IDispatch } from "../ducks/types";
import { Program_evaluate, Program_getListOfDays } from "../models/program";
import { updateSettings } from "../models/state";
import { Thunk_pushToEditProgram, Thunk_startProgramDay } from "../ducks/thunks";
import { navigateToModal } from "../navigation/navigationService";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { useNow } from "../utils/useNow";
import { Schedule_assign, Schedule_anchor, Schedule_get, Schedule_slots } from "./schedule";
import { SESSION_LABELS, Session_displayName } from "./presentation";
import { DevFitAction, DevFitSection, DevFitSurface, DevFitTag, DevFitTitle, useDevFitLayout } from "./ui";
import { DevFitPage } from "./page";
import { DevFitCardioLog } from "./cardioLog";
import { DevFitField } from "./cardioActivityForm";
import { Dates_label, Dates_zone } from "./dates";
import { CardioActions_credit } from "./cardioActions";
import { TrainingDate_rolloverLabel, TrainingDate_scheduleConfig } from "./trainingDates";
import { DevFitPlanUpgradePanel } from "./planUpgradePanel";

export function DevFitSchedule(props: {
  program: IProgram;
  history: IHistoryRecord[];
  settings: ISettings;
  dispatch: IDispatch;
  isOngoing: boolean;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const { wide } = useDevFitLayout();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [zone, setZone] = useState("");
  const evaluated = useMemo(() => Program_evaluate(props.program, props.settings), [props.program, props.settings]);
  const config = Schedule_get(evaluated, props.settings);
  const now = useNow(TrainingDate_scheduleConfig(config));
  const slots = useMemo(
    () => Schedule_slots(evaluated, props.settings, props.history, now),
    [evaluated, props.settings, props.history, now]
  );
  function save(value: IDevFitSchedule): void {
    updateSettings(
      props.dispatch,
      lb<ISettings>()
        .p("devfitSchedules")
        .recordModify((s) => ({ ...s, [props.program.id]: value })),
      "devfit-schedule"
    );
  }
  const selectedSlot = slots.find((s) => s.day === selected);
  return (
    <DevFitPage testID="devfit-schedule">
      <DevFitTitle
        eyebrow={props.program.name}
        title="Schedule"
        subtitle={`${config.cycleDays} days. One complete rotation.`}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <DevFitAction
          label={editing ? "Done arranging" : "Arrange rotation"}
          secondary
          onPress={() => setEditing(!editing)}
        />
        <DevFitAction label="Choose program" secondary onPress={() => navigateToModal("changeNextDayModal")} />
      </View>
      <DevFitCardioLog
        compact
        history={props.history}
        settings={props.settings}
        dispatch={props.dispatch}
        program={props.program}
      />
      <Text style={{ color: c.muted }}>
        Training day changes at {TrainingDate_rolloverLabel(config.trainingDayRolloverMinutes ?? 0)} ·{" "}
        {config.homeTimeZone}. This home calendar stays in place when you travel.
      </Text>
      {!config.anchorDate && (
        <DevFitSurface>
          <Text className="font-semibold" style={{ color: c.ink }}>
            Give your rotation a starting date.
          </Text>
          <Text className="text-sm" style={{ color: c.muted }}>
            Arrange your training, work and recovery days. Tap a day to make it today. Until then, this is a plan
            without calendar dates.
          </Text>
        </DevFitSurface>
      )}
      {editing && (
        <View style={{ gap: 12 }}>
          <DevFitField label="Home rotation time zone" value={zone || config.homeTimeZone || ""} onChange={setZone} />
          <DevFitAction
            label="Save home time zone"
            secondary
            onPress={() => {
              if (zone && Dates_zone(zone) === zone) {
                save({ ...config, homeTimeZone: zone });
              }
            }}
          />
          <DevFitAction
            label="Night shift · day changes at 3:00 PM"
            secondary
            onPress={() => save({ ...config, trainingDayRolloverMinutes: 900 })}
          />
          <DevFitAction
            label="Day changes at midnight"
            secondary
            onPress={() => save({ ...config, trainingDayRolloverMinutes: 0 })}
          />
          <Text className="text-sm" style={{ color: c.muted }}>
            Tap a day to assign a session or recovery and mark work / off context. This changes the calendar only.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[7, 8, 14, 21, 28].map((n) => (
              <DevFitAction
                key={n}
                label={`${n} days${config.cycleDays === n ? " ✓" : ""}`}
                secondary
                onPress={() => save({ ...config, cycleDays: n })}
              />
            ))}
          </View>
        </View>
      )}
      <View style={{ flexDirection: wide ? "row" : "column", flexWrap: "wrap", gap: 14 }}>
        {slots.map((slot) => (
          <View key={slot.day} style={{ width: wide ? "48.5%" : "100%" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Day ${slot.day}, ${slot.session?.name || "Recovery"}, ${slot.completed ? "completed" : slot.isNext ? "next session" : "planned"}`}
              onPress={() => setSelected(slot.day)}
            >
              <DevFitSurface accent={slot.isToday}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Text className="text-sm font-bold" style={{ color: c.accent }}>
                    DAY {String(slot.day).padStart(2, "0")}
                  </Text>
                  {slot.isToday && <DevFitTag label="Today" />}
                  {slot.completed ? (
                    <DevFitTag label={slot.completedLate ? "✓ Completed later" : "✓ Completed"} success />
                  ) : slot.missed ? (
                    <DevFitTag label="Not logged" />
                  ) : (
                    editing && slot.isNext && <DevFitTag label="Next session" />
                  )}
                  {slot.context && <DevFitTag label={slot.context === "work" ? "Work" : "Off"} />}
                </View>
                <Text className="text-xl font-bold" style={{ color: c.ink }}>
                  {slot.session?.name ?? (slot.isWorkSteps ? "Work Steps" : "Recovery / steps")}
                </Text>
                <Text className="text-sm" style={{ color: c.muted }}>
                  {slot.session
                    ? `${SESSION_LABELS[slot.session.kind]} · ${slot.session.duration} · ${slot.session.count} ${slot.session.count === 1 ? "exercise" : "exercises"}`
                    : slot.isWorkSteps
                      ? "Work-shift active recovery · steps & movement"
                      : "Rest, easy movement and work-day steps"}
                </Text>
                {slot.session && (
                  <Text className="text-xs" style={{ color: c.muted }}>
                    {slot.session.exercises
                      .slice(0, 4)
                      .map((e) => Session_displayName(e.label || e.name))
                      .join(" · ")}
                    {slot.session.count > 4 ? ` · +${slot.session.count - 4} more` : ""}
                  </Text>
                )}
                {slot.dateKey && (
                  <Text className="text-xs" style={{ color: c.muted }}>
                    {Dates_label(slot.dateKey)}
                  </Text>
                )}
                {!!slot.performed.length && (
                  <Text style={{ color: c.ink }}>
                    Performed: {slot.performed.map((r) => r.dayName).join(" · ")}
                    {slot.mismatched.length ? " · different / extra session" : ""}
                  </Text>
                )}
              </DevFitSurface>
            </Pressable>
          </View>
        ))}
      </View>
      <DevFitSection title="Program tools" detail="Advanced">
        <DevFitPlanUpgradePanel
          program={props.program}
          settings={props.settings}
          history={props.history}
          dispatch={props.dispatch}
          isOngoing={props.isOngoing}
        />
        <DevFitAction
          label="Edit exercises & progression rules"
          secondary
          onPress={() => props.dispatch(Thunk_pushToEditProgram())}
        />
      </DevFitSection>
      <Modal visible={selected != null} transparent animationType="slide" onRequestClose={() => setSelected(undefined)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View
            style={{
              maxHeight: "90%",
              width: "100%",
              maxWidth: 600,
              alignSelf: "center",
              backgroundColor: c.canvas,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
            }}
          >
            <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
              <DevFitTitle
                title={`Day ${selected ?? ""}`}
                subtitle={selectedSlot?.session?.name ?? "Recovery / steps"}
              />
              {selectedSlot?.dateKey &&
                selectedSlot.programDay != null &&
                selectedSlot.mismatched.map((record) => (
                  <DevFitSurface key={record.id}>
                    <Text style={{ color: c.ink }}>
                      Scheduled: {selectedSlot.session?.name}. Performed: {record.dayName}. Keep both facts, or
                      explicitly count this activity as a substitute.
                    </Text>
                    <DevFitAction
                      secondary
                      label={`Credit ${record.dayName} to this slot`}
                      onPress={() => {
                        props.dispatch(
                          CardioActions_credit(record.id, {
                            programId: props.program.id,
                            scheduledDate: selectedSlot.dateKey!,
                            rotationDay: selectedSlot.day,
                            programDay: selectedSlot.programDay!,
                          })
                        );
                      }}
                    />
                  </DevFitSurface>
                ))}
              <DevFitAction
                label="Make this day today"
                secondary
                onPress={() => {
                  save(Schedule_anchor(config, selected!, now));
                  setSelected(undefined);
                }}
              />
              {editing ? (
                <>
                  <Text className="font-bold" style={{ color: c.ink }}>
                    Day context
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {(["work", "off", undefined] as const).map((context) => (
                      <DevFitAction
                        key={context ?? "none"}
                        label={context === "work" ? "Work" : context === "off" ? "Off" : "No label"}
                        secondary
                        onPress={() => save(Schedule_assign(config, selected!, { context }))}
                      />
                    ))}
                  </View>
                  <Text className="font-bold" style={{ color: c.ink }}>
                    Assign training
                  </Text>
                  <DevFitAction
                    label="Recovery / steps"
                    secondary
                    onPress={() => {
                      save(Schedule_assign(config, selected!, { programDay: undefined }));
                      setSelected(undefined);
                    }}
                  />
                  {Program_getListOfDays(evaluated).map(([id, name]) => (
                    <DevFitAction
                      key={id}
                      label={name}
                      secondary
                      onPress={() => {
                        save(Schedule_assign(config, selected!, { programDay: Number(id) }));
                        setSelected(undefined);
                      }}
                    />
                  ))}
                </>
              ) : selectedSlot?.programDay != null && selectedSlot.session?.kind !== "recovery" ? (
                <DevFitAction
                  label={
                    props.isOngoing
                      ? "Continue current workout"
                      : `Train ${selectedSlot.session?.name ?? "this session"}`
                  }
                  onPress={() => {
                    props.dispatch(Thunk_startProgramDay(undefined, selectedSlot.programDay));
                    setSelected(undefined);
                  }}
                />
              ) : (
                <Text style={{ color: c.muted }}>Recovery is part of the plan. No workout record is needed.</Text>
              )}
              <DevFitAction label="Close" secondary onPress={() => setSelected(undefined)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </DevFitPage>
  );
}
