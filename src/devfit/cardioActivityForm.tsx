import { JSX, useState } from "react";
import { View, TextInput } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, ISettings } from "../types";
import { ICardioActivity } from "./cardioSchema";
import {
  CARDIO_FIELDS,
  CARDIO_PRESETS,
  CardioForm_submission,
  CardioForm_draft,
  CardioForm_kind,
  ICardioDraft,
} from "./cardioForm";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { DevFitAction, DevFitColumns, DevFitSurface, DevFitTitle } from "./ui";

export function DevFitField(props: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  numeric?: boolean;
  testID?: string;
  editable?: boolean;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  return (
    <View style={{ gap: 6, flexGrow: 1, minWidth: 120 }}>
      <Text className="text-sm" style={{ color: c.muted }}>
        {props.label}
      </Text>
      <TextInput
        accessibilityLabel={props.label}
        testID={props.testID}
        value={props.value}
        onChangeText={props.onChange}
        editable={props.editable}
        keyboardType={props.numeric ? "decimal-pad" : "default"}
        autoCapitalize="none"
        placeholder="Not recorded"
        placeholderTextColor={c.muted}
        style={{
          color: c.ink,
          backgroundColor: c.surface,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: 12,
          minHeight: 52,
          padding: 12,
        }}
      />
    </View>
  );
}

export function DevFitCardioActivityForm(props: {
  settings: ISettings;
  history: IHistoryRecord[];
  zone: string;
  activity?: ICardioActivity;
  recordId?: number;
  onSave: (activity: ICardioActivity) => void;
  onCancel: () => void;
  mode?: "live" | "manual";
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [draft, setDraft] = useState(() => CardioForm_draft(props.zone, Date.now(), props.activity));
  const [details, setDetails] = useState(!!props.activity);
  const [error, setError] = useState<string>();
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const kind = CardioForm_kind(draft.preset);
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
    props.onSave(result.activity);
  }
  return (
    <View testID="devfit-cardio-form" style={{ gap: 16 }}>
      <DevFitTitle
        title={
          props.mode === "live" ? "Your actual session" : props.recordId ? "Edit past activity" : "Log past activity"
        }
        subtitle="Date, activity and actual minutes are all you need. Other fields are optional."
      />
      <DevFitColumns
        primary={
          <DevFitSurface>
            <DevFitField
              label="Performed date (YYYY-MM-DD)"
              testID="cardio-date"
              editable={props.mode !== "live"}
              value={draft.date}
              onChange={(date) => patch({ date })}
            />
            {props.mode !== "live" && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CARDIO_PRESETS.map((preset) => (
                  <DevFitAction
                    key={preset}
                    label={`${preset}${draft.preset === preset ? " ✓" : ""}`}
                    secondary
                    onPress={() => patch({ preset })}
                  />
                ))}
              </View>
            )}
            <DevFitField
              label="Actual duration (minutes)"
              testID="cardio-minutes"
              editable={props.mode !== "live"}
              numeric
              value={draft.minutes}
              onChange={(minutes) => patch({ minutes })}
            />
            <DevFitAction
              label={details ? "Hide optional details" : "Add optional details"}
              secondary
              onPress={() => setDetails(!details)}
            />
            {details && (
              <>
                <DevFitField
                  label="Time (HH:MM, optional)"
                  editable={props.mode !== "live"}
                  value={draft.time}
                  onChange={(time) => patch({ time })}
                />
                <DevFitField
                  label="Home time zone"
                  editable={props.mode !== "live"}
                  value={draft.zone}
                  onChange={(zone) => patch({ zone })}
                />
                <DevFitField
                  label="Machine / model (optional)"
                  value={draft.fields.profile ?? ""}
                  onChange={(s) => field("profile", s)}
                />
              </>
            )}
            {(details || props.mode === "live") && (
              <>
                {kind !== "stair_climber" && (
                  <>
                    <DevFitField
                      label={kind === "stationary_bike" ? "Machine virtual distance" : "Machine distance"}
                      numeric
                      value={draft.fields.distance ?? ""}
                      onChange={(s) => field("distance", s)}
                    />
                    <DevFitAction
                      label={`Distance unit: ${draft.distanceUnit}`}
                      secondary
                      onPress={() => patch({ distanceUnit: draft.distanceUnit === "km" ? "mi" : "km" })}
                    />
                  </>
                )}
                <DevFitField
                  label="Effort RPE (1–10)"
                  numeric
                  value={draft.fields.rpe ?? ""}
                  onChange={(s) => field("rpe", s)}
                />
              </>
            )}
          </DevFitSurface>
        }
        secondary={
          details || props.mode === "live" ? (
            <DevFitSurface>
              {kind === "treadmill" && (
                <>
                  <DevFitAction
                    label={draft.detailed ? "Use quick summary" : "Use detailed phases"}
                    secondary
                    onPress={() => patch({ detailed: !draft.detailed })}
                  />
                  <DevFitAction
                    label={`Summary speed unit: ${draft.speedUnit === "mph" ? "mph" : "km/h"}`}
                    secondary
                    onPress={() => patch({ speedUnit: draft.speedUnit === "mph" ? "kmh" : "mph" })}
                  />
                  <Text style={{ color: c.muted }}>
                    Incline is percent grade. Enter settings actually used. Longest jog stays unknown unless you
                    remember it or record phases.
                  </Text>
                </>
              )}
              {CARDIO_FIELDS[kind]
                .filter(
                  ([key]) =>
                    !(
                      kind === "treadmill" &&
                      draft.detailed &&
                      ["walkMinutes", "jogMinutes", "longestMinutes"].includes(key)
                    )
                )
                .map(([key, label]) => (
                  <DevFitField
                    key={key}
                    label={label}
                    value={draft.fields[key] ?? ""}
                    numeric={!["level", "resistance", "damper", "name"].includes(key)}
                    onChange={(s) => field(key, s)}
                  />
                ))}
              {kind === "treadmill" && draft.detailed && (
                <>
                  {draft.segments.map((segment, index) => (
                    <DevFitSurface key={index}>
                      <Text style={{ color: c.ink }}>Phase {index + 1}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {(["walk", "jog", "run", "recovery", "other"] as const).map((phase) => (
                          <DevFitAction
                            key={phase}
                            label={`${phase}${phase === segment.phase ? " ✓" : ""}`}
                            secondary
                            onPress={() =>
                              patch({ segments: draft.segments.map((p, i) => (i === index ? { ...p, phase } : p)) })
                            }
                          />
                        ))}
                      </View>
                      {(
                        [
                          ["minutes", "Phase minutes"],
                          ["speed", "Phase speed"],
                          ["incline", "Phase incline (%)"],
                          ["distance", "Phase measured distance (meters)"],
                        ] as const
                      ).map(([key, label]) => (
                        <DevFitField
                          key={key}
                          label={`${label} ${index + 1}`}
                          numeric
                          value={segment[key]}
                          onChange={(s) =>
                            patch({ segments: draft.segments.map((p, i) => (i === index ? { ...p, [key]: s } : p)) })
                          }
                        />
                      ))}
                      <DevFitAction
                        label={`Phase ${index + 1} speed unit: ${segment.unit}`}
                        secondary
                        onPress={() =>
                          patch({
                            segments: draft.segments.map((p, i) =>
                              i === index ? { ...p, unit: p.unit === "mph" ? "kmh" : "mph" } : p
                            ),
                          })
                        }
                      />
                      <DevFitAction
                        label={`Remove phase ${index + 1}`}
                        secondary
                        onPress={() => patch({ segments: draft.segments.filter((_, i) => i !== index) })}
                      />
                    </DevFitSurface>
                  ))}
                  <DevFitAction
                    label="Add phase"
                    secondary
                    onPress={() =>
                      patch({
                        segments: [
                          ...draft.segments,
                          { phase: "walk", minutes: "", speed: "", unit: draft.speedUnit, incline: "", distance: "" },
                        ],
                      })
                    }
                  />
                </>
              )}
              <DevFitField label="Notes" value={draft.fields.notes ?? ""} onChange={(s) => field("notes", s)} />
            </DevFitSurface>
          ) : undefined
        }
      />
      {error && (
        <Text accessibilityRole="alert" style={{ color: c.accent }}>
          {error}
        </Text>
      )}
      {duplicateWarning && (
        <DevFitSurface>
          <Text style={{ color: c.ink }}>
            A similar activity is already recorded on this date. Two sessions are allowed.
          </Text>
          <DevFitAction
            label={duplicateConfirmed ? "Separate activity confirmed ✓" : "This is a separate activity"}
            secondary
            onPress={() => setDuplicateConfirmed(true)}
          />
        </DevFitSurface>
      )}
      <DevFitAction label="Save activity" testID="cardio-save" onPress={save} />
      <DevFitAction label="Cancel" secondary onPress={props.onCancel} />
    </View>
  );
}
