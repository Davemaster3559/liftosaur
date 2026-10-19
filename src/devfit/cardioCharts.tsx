import { JSX, useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, ISettings } from "../types";
import { ICardioActivity } from "./cardioSchema";
import { CARDIO_NAMES, Cardio_name } from "./cardio";
import {
  CARDIO_METRICS,
  CardioProgress_compare,
  CardioProgress_details,
  CardioProgress_metric,
  CardioProgress_records,
} from "./cardioProgress";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { DevFitAction, DevFitSection, DevFitSurface } from "./ui";

export function DevFitCardioCharts(props: { history: IHistoryRecord[]; settings: ISettings }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [kind, setKind] = useState<ICardioActivity["kind"]>("treadmill");
  const [metric, setMetric] = useState("duration");
  const [profile, setProfile] = useState<string>();
  const [complete, setComplete] = useState(false);
  const all = useMemo(() => CardioProgress_records(props.history, props.settings), [props.history, props.settings]);
  const byKind = all.filter((p) => p.activity.kind === kind);
  const profiles = [...new Set(byKind.map((p) => p.activity.machineProfile).filter((p): p is string => !!p))];
  const points = byKind
    .filter(
      (p) =>
        (!profile || p.activity.machineProfile === profile) &&
        (!complete || CardioProgress_metric(p.activity, metric) != null)
    )
    .slice(-20);
  const values = points.map((p) => CardioProgress_metric(p.activity, metric));
  const max = Math.max(1, ...values.filter((n): n is number => n != null));
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  return (
    <DevFitSection title="Cardio progress" detail="Actual measurements">
      <DevFitSurface>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(CARDIO_NAMES) as ICardioActivity["kind"][]).map((k) => (
            <DevFitAction
              key={k}
              label={`${CARDIO_NAMES[k]}${k === kind ? " ✓" : ""}`}
              secondary
              onPress={() => {
                setKind(k);
                setMetric("duration");
                setProfile(undefined);
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CARDIO_METRICS[kind].map(([key, label]) => (
            <DevFitAction
              key={key}
              secondary
              label={`${label}${key === metric ? " ✓" : ""}`}
              onPress={() => setMetric(key)}
            />
          ))}
        </View>
        {!!profiles.length && (
          <View style={{ gap: 8 }}>
            <DevFitAction
              label={profile ? "Show all machine profiles" : "All machine profiles ✓"}
              secondary
              onPress={() => setProfile(undefined)}
            />
            {profiles.map((p) => (
              <DevFitAction
                key={p}
                secondary
                label={`${p}${profile === p ? " ✓" : ""}`}
                onPress={() => setProfile(p)}
              />
            ))}
          </View>
        )}
        <DevFitAction
          label={complete ? "Show gaps for unrecorded metrics" : "Only sessions with this metric"}
          secondary
          onPress={() => setComplete(!complete)}
        />
        <Text style={{ color: c.muted }}>
          {CARDIO_METRICS[kind].find(([k]) => k === metric)?.[1]} · last {points.length} activities
        </Text>
        {!points.length ? (
          <Text style={{ color: c.muted }}>
            No {CARDIO_NAMES[kind].toLowerCase()} activities yet. Log a past activity or record a live timed set.
          </Text>
        ) : (
          <>
            <Svg
              width="100%"
              height={160}
              viewBox="0 0 300 160"
              accessibilityLabel={`${CARDIO_NAMES[kind]} ${metric} chart. Missing values are gaps.`}
            >
              <Line x1={12} y1={145} x2={290} y2={145} stroke={c.line} />
              {values.map((value, i) =>
                value == null ? null : (
                  <Circle
                    key={i}
                    cx={12 + (i * 276) / Math.max(1, values.length - 1)}
                    cy={140 - (value / max) * 120}
                    r={4}
                    fill={c.cardio}
                  />
                )
              )}
              {values.map((value, i) =>
                value == null || i === 0 || values[i - 1] == null ? null : (
                  <Polyline
                    key={i}
                    fill="none"
                    stroke={c.cardio}
                    strokeWidth={2}
                    points={`${12 + ((i - 1) * 276) / Math.max(1, values.length - 1)},${140 - (values[i - 1]! / max) * 120} ${12 + (i * 276) / Math.max(1, values.length - 1)},${140 - (value / max) * 120}`}
                  />
                )
              )}
            </Svg>
            {points.map((p, i) => (
              <Text key={p.key} style={{ color: c.muted }}>
                {p.activity.performedLocalDate} · {Cardio_name(p.activity)}:{" "}
                {values[i] == null ? "Not recorded" : +values[i]!.toFixed(2)}
              </Text>
            ))}
          </>
        )}
        {latest && (
          <>
            <Text className="font-semibold" style={{ color: c.ink }}>
              Latest · {Cardio_name(latest.activity)}
            </Text>
            {CardioProgress_details(latest.activity).map(([label, value]) => (
              <Text key={label} style={{ color: c.muted }}>
                {label}: {value}
              </Text>
            ))}
            {previous && (
              <>
                <Text style={{ color: c.ink }}>Previous · {previous.activity.performedLocalDate}</Text>
                {kind === "treadmill" &&
                  CardioProgress_details(previous.activity)
                    .filter(([label]) => ["Longest uninterrupted jog", "Jog settings"].includes(label))
                    .map(([label, value]) => (
                      <Text key={label} style={{ color: c.muted }}>
                        {label}: {value}
                      </Text>
                    ))}
                <Text testID="cardio-condition-comparison" style={{ color: c.cardio }}>
                  {CardioProgress_compare(previous.activity, latest.activity)}
                </Text>
              </>
            )}
          </>
        )}
        <Text className="text-xs" style={{ color: c.muted }}>
          {kind === "treadmill"
            ? "Compare jog endurance at similar speed and percent grade. Average speed uses actual machine distance / duration. No global intensity score."
            : "Compare machine levels and virtual distances within the same machine profile. Unknown measurements remain gaps."}
        </Text>
      </DevFitSurface>
    </DevFitSection>
  );
}
