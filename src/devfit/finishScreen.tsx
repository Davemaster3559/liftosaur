import { JSX, useMemo } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, IProgram, ISettings, IStats } from "../types";
import {
  History_getNumberOfPersonalRecords,
  History_getPersonalRecords,
  History_totalRecordSets,
  History_totalRecordWeight,
  History_workoutTime,
} from "../models/history";
import { Program_evaluate, Program_getProgramDay } from "../models/program";
import { Exercise_get } from "../models/exercise";
import { Weight_display } from "../models/weight";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Finish_activity, Finish_nextTargets } from "./finish";
import { Session_minutes } from "./presentation";
import { DevFitAction, DevFitColumns, DevFitMetric, DevFitSection, DevFitSurface, DevFitTag, DevFitTitle } from "./ui";

export function DevFitFinish(props: {
  record: IHistoryRecord;
  history: IHistoryRecord[];
  settings: ISettings;
  stats: IStats;
  program?: IProgram;
  onDetails: () => void;
  onToday: () => void;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const targets = useMemo(
    () => Finish_nextTargets(props.record, props.program, props.settings, props.stats),
    [props.record, props.program, props.settings, props.stats]
  );
  const prs = useMemo(
    () => History_getNumberOfPersonalRecords([props.record], History_getPersonalRecords(props.history)),
    [props.record, props.history]
  );
  const evaluated = props.program && Program_evaluate(props.program, props.settings);
  const activity = Finish_activity(props.record, props.settings, evaluated);
  const next = evaluated && Program_getProgramDay(evaluated, evaluated.nextDay);
  return (
    <View testID="devfit-finish" style={{ width: "100%", maxWidth: 1180, alignSelf: "center", padding: 20, gap: 24 }}>
      <DevFitTag label="✓ Session saved" success />
      <DevFitTitle
        title={activity.hasStrength ? "Stronger by showing up." : "Time well spent."}
        subtitle={props.record.dayName || props.record.programName}
      />
      {prs > 0 && (
        <DevFitSurface accent>
          <Text className="text-xl font-bold" style={{ color: c.success }}>
            {prs} exercise personal record{prs === 1 ? "" : "s"}
          </Text>
          <Text className="text-sm" style={{ color: c.muted }}>
            A new best, recorded in your history.
          </Text>
        </DevFitSurface>
      )}
      <DevFitColumns
        primary={
          <>
            <DevFitSurface>
              <View testID="totals-summary" style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
                <DevFitMetric
                  value={`${Math.round(History_workoutTime(props.record) / 60000)} min`}
                  label="Training time"
                />
                {activity.hasStrength && (
                  <DevFitMetric value={`${History_totalRecordSets(activity.strength)}`} label="Working sets" />
                )}
                {activity.hasStrength && (
                  <DevFitMetric
                    value={Weight_display(History_totalRecordWeight(activity.strength, props.settings))}
                    label="Strength volume"
                  />
                )}
                {activity.cardioSegments > 0 && (
                  <DevFitMetric value={Session_minutes(activity.cardioSeconds)} label="Cardio time recorded" />
                )}
                {!activity.hasStrength && (
                  <DevFitMetric value={`${activity.cardioSegments}`} label="Segments recorded" />
                )}
              </View>
            </DevFitSurface>
            {(activity.hasStrength || targets.length > 0) && (
              <DevFitSection title="Progression applied" detail="Next occurrence of this day">
                <DevFitSurface>
                  {targets.length ? (
                    targets.map((t) => (
                      <View key={t.entry.id} style={{ gap: 6 }}>
                        <Text className="font-semibold" style={{ color: c.ink }}>
                          {Exercise_get(t.entry.exercise, props.settings.exercises).name}
                        </Text>
                        <Text className="text-sm" style={{ color: c.muted }}>
                          {t.before}
                        </Text>
                        <Text className="text-sm font-bold" style={{ color: c.success }}>
                          → {t.after}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: c.muted }}>
                      Your rules have been applied. No displayed weight or rep targets changed for this day. Counters
                      and custom state may still have updated.
                    </Text>
                  )}
                </DevFitSurface>
              </DevFitSection>
            )}
          </>
        }
        secondary={
          <>
            <DevFitSurface>
              <DevFitTag label="Next session" />
              <Text className="text-xl font-bold" style={{ color: c.ink }}>
                {next?.name || "Your next workout"}
              </Text>
              <Text className="text-sm" style={{ color: c.muted }}>
                Take the recovery you need. Your plan will be ready.
              </Text>
            </DevFitSurface>
            <DevFitAction label="Back to Today" testID="devfit-finish-done" onPress={props.onToday} />
            <DevFitAction label="Full session, PRs & share" secondary onPress={props.onDetails} />
          </>
        }
      />
    </View>
  );
}
