import { JSX } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { CARDIO_FIELDS, CardioForm_kind, ICardioDraft } from "./cardioForm";
import { DevFitAction, DevFitSurface } from "./ui";
import { DevFitField } from "./field";

export function DevFitCardioDetails(props: {
  draft: ICardioDraft;
  patch: (p: Partial<ICardioDraft>) => void;
  field: (key: string, value: string) => void;
}): JSX.Element {
  const { draft, patch, field } = props;
  const c = Tailwind_semantic().devfit;
  const kind = CardioForm_kind(draft.preset);
  return (
    <View style={{ gap: 16 }}>
      {kind === "treadmill" && (
        <>
          <Text className="text-sm" style={{ color: c.muted }}>
            Was this a comfortable, controlled session? Leave unknown if unsure. Running progression also requires
            measured phases and your programmed target.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(
              [
                ["yes", "Comfortable / controlled"],
                ["no", "Not comfortable"],
                ["", "Not recorded"],
              ] as const
            ).map(([value, label]) => (
              <DevFitAction
                key={label}
                secondary
                label={`${draft.fields.controlledEffort === value ? "✓ " : ""}${label}`}
                onPress={() => field("controlledEffort", value)}
              />
            ))}
          </View>
          <DevFitAction
            label={draft.detailed ? "Use quick walk/jog summary" : "Record detailed walk/jog phases"}
            secondary
            onPress={() => patch({ detailed: !draft.detailed })}
          />
          <DevFitAction
            label={`Phase speed: ${draft.speedUnit === "mph" ? "mph" : "km/h"}`}
            secondary
            onPress={() => patch({ speedUnit: draft.speedUnit === "mph" ? "kmh" : "mph" })}
          />
          <Text className="text-sm" style={{ color: c.muted }}>
            Incline is percent grade. Longest jog stays unknown unless you enter it or record phases. A pause breaks
            continuous jogging.
          </Text>
        </>
      )}
      {CARDIO_FIELDS[kind]
        .filter(
          ([key]) =>
            !(kind === "treadmill" && draft.detailed && ["walkMinutes", "jogMinutes", "longestMinutes"].includes(key))
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
              <Text className="font-bold" style={{ color: c.ink }}>
                Phase {index + 1}
              </Text>
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
                  ["minutes", "Phase duration (mm:ss)"],
                  ["speed", "Phase speed"],
                  ["incline", "Phase incline (%)"],
                  ["distance", "Phase measured distance (meters)"],
                ] as const
              ).map(([key, label]) => (
                <DevFitField
                  key={key}
                  label={`${label} ${index + 1}`}
                  numeric={key !== "minutes"}
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
              <DevFitAction
                label={segment.breakBefore ? "Pause before this phase ✓" : "Mark a pause before this phase"}
                secondary
                onPress={() =>
                  patch({
                    segments: draft.segments.map((p, i) => (i === index ? { ...p, breakBefore: !p.breakBefore } : p)),
                  })
                }
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
      {(kind === "stationary_bike" || kind === "stair_climber" || kind === "rowing") && (
        <>
          <Text style={{ color: c.muted }}>
            Optional time blocks retain actual settings. Unreported time stays unspecified.
          </Text>
          {(draft.blocks ?? []).map((block, index) => (
            <DevFitSurface key={index}>
              <Text style={{ color: c.ink }}>Block {index + 1}</Text>
              {(
                [
                  ["duration", "Duration (mm:ss)"],
                  ["level", kind === "rowing" ? "Damper / resistance" : "Machine resistance / level"],
                  [
                    "cadence",
                    kind === "stationary_bike"
                      ? "Cadence (RPM)"
                      : kind === "stair_climber"
                        ? "Steps per minute"
                        : "Strokes per minute",
                  ],
                  ["watts", "Power (watts)"],
                  ["notes", "Block notes"],
                ] as const
              ).map(([key, label]) => (
                <DevFitField
                  key={key}
                  label={`Block ${index + 1} · ${label}`}
                  value={block[key]}
                  numeric={key === "cadence" || key === "watts"}
                  onChange={(s) =>
                    patch({ blocks: draft.blocks?.map((b, i) => (i === index ? { ...b, [key]: s } : b)) })
                  }
                />
              ))}
              <DevFitAction
                label={`Remove block ${index + 1}`}
                secondary
                onPress={() => patch({ blocks: draft.blocks?.filter((_, i) => i !== index) })}
              />
            </DevFitSurface>
          ))}
          <DevFitAction
            label="Add machine setting block"
            secondary
            onPress={() =>
              patch({
                blocks: [...(draft.blocks ?? []), { duration: "", level: "", cadence: "", watts: "", notes: "" }],
              })
            }
          />
        </>
      )}
      <DevFitField
        label="Machine / model (optional)"
        value={draft.fields.profile ?? ""}
        onChange={(s) => field("profile", s)}
      />
      <DevFitField
        label="Machine-reported average pace (mm:ss)"
        value={draft.fields.pace ?? ""}
        onChange={(s) => field("pace", s)}
      />
      <DevFitAction
        label={`Reported pace per ${draft.fields.paceUnit === "km" ? "km" : "mile"}`}
        secondary
        onPress={() => field("paceUnit", draft.fields.paceUnit === "km" ? "mi" : "km")}
      />
      <DevFitField
        label="Average heart rate (bpm, reported)"
        numeric
        value={draft.fields.heartRate ?? ""}
        onChange={(s) => field("heartRate", s)}
      />
      <DevFitField
        label="Machine calories (estimate, kcal)"
        numeric
        value={draft.fields.calories ?? ""}
        onChange={(s) => field("calories", s)}
      />
      <Text className="text-xs" style={{ color: c.muted }}>
        Reported pace is saved as entered. Machine calories are an estimate.
      </Text>
      <DevFitField label="Effort RPE (1–10)" numeric value={draft.fields.rpe ?? ""} onChange={(s) => field("rpe", s)} />
      <DevFitField label="Notes" value={draft.fields.notes ?? ""} onChange={(s) => field("notes", s)} />
    </View>
  );
}
