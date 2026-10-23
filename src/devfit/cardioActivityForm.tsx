import { JSX, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, ISettings } from "../types";
import { ICardioActivity } from "./cardioSchema";
import {
  CardioForm_submission,
  CardioForm_draft,
  CardioForm_kind,
  CardioForm_trainingPreview,
  ICardioDraft,
  ICardioPreset,
} from "./cardioForm";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { DevFitAction, DevFitColumns, DevFitSurface, DevFitTitle } from "./ui";
import { DevFitField } from "./field";
import { DevFitCardioDetails } from "./cardioDetails";
import { Dates_add, Dates_day, Dates_label } from "./dates";
import { ITrainingDate, TrainingDate_key } from "./trainingDates";

export { DevFitField } from "./field";

const machines: { preset: ICardioPreset; label: string }[] = [
  { preset: "Treadmill", label: "Treadmill" },
  { preset: "Bike", label: "Bike" },
  { preset: "Stairs", label: "Stairs" },
  { preset: "Row", label: "Row" },
  { preset: "Elliptical", label: "Elliptical" },
  { preset: "Other", label: "Other" },
];
const intentions = [
  ["general", "General"],
  ["run_a", "Run A"],
  ["run_b", "Run B"],
  ["incline_walk", "Incline walk"],
  ["endurance", "Endurance"],
  ["recovery", "Recovery"],
] as const;

export function DevFitCardioActivityForm(props: {
  settings: ISettings;
  history: IHistoryRecord[];
  zone: string;
  activity?: ICardioActivity;
  recordId?: number;
  onSave: (activity: ICardioActivity, trainingDate?: ITrainingDate) => void;
  onCancel: () => void;
  mode?: "live" | "manual";
  trainingDate?: ITrainingDate;
  rolloverMinutes?: number;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [draft, setDraft] = useState(() =>
    CardioForm_draft(props.zone, Date.now(), props.activity, props.trainingDate, props.rolloverMinutes)
  );
  const [details, setDetails] = useState(false);
  const [dates, setDates] = useState(false);
  const [session, setSession] = useState(false);
  const [error, setError] = useState<string>();
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const kind = CardioForm_kind(draft.preset);
  const intention =
    draft.intention ??
    (draft.preset === "Run A"
      ? "run_a"
      : draft.preset === "Run B"
        ? "run_b"
        : draft.preset === "Incline walk"
          ? "incline_walk"
          : "general");
  function patch(p: Partial<ICardioDraft>): void {
    setDraft((d) => ({ ...d, ...p }));
    setDuplicateConfirmed(false);
    setDuplicateWarning(false);
  }
  function field(key: string, value: string): void {
    patch({ fields: { ...draft.fields, [key]: value } });
  }
  function save(): void {
    const result = CardioForm_submission(draft, props.history, Date.now(), {
      mode: props.mode,
      original: props.activity,
      recordId: props.recordId,
      duplicateConfirmed,
    });
    setDuplicateWarning(!!result.duplicateWarning);
    if (!result.activity) {
      setError(result.error);
      return;
    }
    props.onSave(result.activity, result.trainingDate);
  }
  const chosenDate = draft.trainingMode === "training" ? (draft.trainingDate ?? draft.date) : draft.date;
  const preview = CardioForm_trainingPreview(draft);
  const today = TrainingDate_key(Date.now(), draft.zone, draft.rolloverMinutes ?? 0);
  return (
    <View testID="devfit-cardio-form" style={{ gap: 16 }}>
      <DevFitTitle
        title={props.mode === "live" ? "Finish cardio" : props.recordId ? "Edit past activity" : "Log cardio"}
        subtitle={
          props.mode === "live"
            ? "Confirm machine distance. Other measurements are optional."
            : "Save a past activity · no live timer"
        }
      />
      <DevFitColumns
        primary={
          <DevFitSurface>
            {props.mode !== "live" && (
              <>
                <DevFitAction
                  secondary
                  label={
                    draft.trainingMode === "legacy"
                      ? "Confirm this activity's training date"
                      : (draft.trainingMode === "actual" ? "Actual start · " : "Training date · ") +
                        (Dates_day(chosenDate) != null ? Dates_label(chosenDate) : "Choose date")
                  }
                  onPress={() => setDates(!dates)}
                />
                {dates && (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <DevFitAction
                        secondary
                        label={"Training date" + (draft.trainingMode === "training" ? " ✓" : "")}
                        onPress={() =>
                          patch({ trainingMode: "training", trainingDate: draft.trainingDate ?? draft.date })
                        }
                      />
                      <DevFitAction
                        secondary
                        label={"Actual date and time" + (draft.trainingMode === "actual" ? " ✓" : "")}
                        onPress={() => patch({ trainingMode: "actual" })}
                      />
                    </View>
                    <DevFitField
                      label={
                        draft.trainingMode === "training" ? "Training date (YYYY-MM-DD)" : "Actual date (YYYY-MM-DD)"
                      }
                      testID="cardio-date"
                      value={chosenDate}
                      onChange={(date) =>
                        draft.trainingMode === "training"
                          ? patch({ trainingDate: date, ...(!props.activity ? { date } : {}) })
                          : patch({ date })
                      }
                    />
                    {draft.trainingMode === "training" && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <DevFitAction
                          secondary
                          label="Today"
                          onPress={() => patch({ trainingDate: today, ...(!props.activity ? { date: today } : {}) })}
                        />
                        <DevFitAction
                          secondary
                          label="Previous training day"
                          onPress={() =>
                            patch({
                              trainingDate: Dates_add(today, -1),
                              ...(!props.activity ? { date: Dates_add(today, -1) } : {}),
                            })
                          }
                        />
                      </View>
                    )}
                    {draft.trainingMode === "actual" && (
                      <>
                        <DevFitField
                          label="Actual start (HH:MM)"
                          value={draft.time}
                          onChange={(time) => patch({ time })}
                        />
                        <Text style={{ color: c.muted }}>
                          {preview
                            ? "Counts toward training date " + preview
                            : "Enter the actual time to preview its training date."}
                        </Text>
                      </>
                    )}
                    {draft.trainingMode === "legacy" && (
                      <Text style={{ color: c.muted }}>
                        The original date-only record stays unchanged. Choose Training date to confirm its intended day,
                        or enter a known actual start.
                      </Text>
                    )}
                    <Text className="text-xs" style={{ color: c.muted }}>
                      Home calendar · {draft.zone}. Day changes at {Math.floor((draft.rolloverMinutes ?? 0) / 60)}:00.
                    </Text>
                  </View>
                )}
                <Text className="text-xs font-bold" style={{ color: c.muted }}>
                  MACHINE
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {machines.map((machine) => (
                    <Pressable
                      key={machine.preset}
                      accessibilityRole="button"
                      accessibilityLabel={machine.label}
                      accessibilityState={{ selected: kind === CardioForm_kind(machine.preset) }}
                      onPress={() => patch({ preset: machine.preset, intention: "general" })}
                      style={{
                        minHeight: 48,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: kind === CardioForm_kind(machine.preset) ? c.cardio : c.line,
                        backgroundColor: kind === CardioForm_kind(machine.preset) ? c.cardiosoft : c.surface,
                      }}
                    >
                      <Text style={{ color: kind === CardioForm_kind(machine.preset) ? c.cardio : c.muted }}>
                        {machine.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <DevFitAction
                  secondary
                  label={"Session · " + (intentions.find(([key]) => key === intention)?.[1] ?? "General") + " · Change"}
                  onPress={() => setSession(!session)}
                />
                {session && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {intentions
                      .filter(
                        ([key]) =>
                          kind === "treadmill" || (key !== "run_a" && key !== "run_b" && key !== "incline_walk")
                      )
                      .map(([key, label]) => (
                        <DevFitAction
                          key={key}
                          label={label + (key === intention ? " ✓" : "")}
                          secondary
                          onPress={() => {
                            patch({ intention: key });
                            setSession(false);
                          }}
                        />
                      ))}
                  </View>
                )}
              </>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 120 }}>
                <DevFitField
                  label="Actual duration (mm:ss)"
                  testID="cardio-minutes"
                  editable={props.mode !== "live"}
                  value={draft.minutes}
                  onChange={(minutes) => patch({ minutes })}
                  placeholder="30:32"
                />
              </View>
              {kind !== "stair_climber" && (
                <View style={{ flex: 1, minWidth: 120 }}>
                  <DevFitField
                    label={
                      (kind === "stationary_bike" ? "Virtual distance" : "Machine distance") +
                      " (" +
                      draft.distanceUnit +
                      ")"
                    }
                    numeric
                    value={draft.fields.distance ?? ""}
                    onChange={(s) => field("distance", s)}
                  />
                </View>
              )}
            </View>
            {kind !== "stair_climber" && (
              <DevFitAction
                label={"Distance unit: " + draft.distanceUnit}
                secondary
                onPress={() => patch({ distanceUnit: draft.distanceUnit === "km" ? "mi" : "km" })}
              />
            )}
            {error && (
              <Text accessibilityRole="alert" style={{ color: c.accent }}>
                {error}
              </Text>
            )}
            {duplicateWarning && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: c.ink }}>
                  A similar activity is already recorded on this date. Two sessions are allowed.
                </Text>
                <DevFitAction
                  label={duplicateConfirmed ? "Separate activity confirmed ✓" : "This is a separate activity"}
                  secondary
                  onPress={() => setDuplicateConfirmed(true)}
                />
              </View>
            )}
            <DevFitAction
              label={props.mode === "live" ? "Save cardio details" : "Save activity"}
              testID="cardio-save"
              onPress={save}
            />
            <DevFitAction
              label={
                details
                  ? "Hide optional details"
                  : kind === "treadmill"
                    ? "Walk/jog phases, incline & machine details"
                    : "Machine details, effort & notes"
              }
              secondary
              onPress={() => setDetails(!details)}
            />
            <DevFitAction label="Cancel" secondary onPress={props.onCancel} />
          </DevFitSurface>
        }
        secondary={
          details ? (
            <DevFitSurface>
              <DevFitCardioDetails draft={draft} patch={patch} field={field} />
            </DevFitSurface>
          ) : undefined
        }
      />
    </View>
  );
}
