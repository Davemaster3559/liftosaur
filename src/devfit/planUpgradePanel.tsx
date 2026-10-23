import { DevFitTargetSetup } from "./targetSetup";
import { DevFitCardioPlanSetup } from "./cardioPlanSetup";
import { JSX, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Text } from "../components/primitives/text";
import { DevFitBenchIllustration } from "./benchIllustration";
import { IDispatch } from "../ducks/types";
import { IHistoryRecord, IProgram, ISettings } from "../types";
import { Program_evaluate } from "../models/program";
import { PlanUpgrade_preview } from "./planUpgrade";
import { PlanActions_apply, PlanActions_bench, PlanActions_restore } from "./planActions";
import { IMilestoneTarget } from "./planSchema";
import { DevFitAction, DevFitSurface, DevFitTitle } from "./ui";
import { Tailwind_semantic } from "../utils/tailwindConfig";

export function DevFitPlanUpgradePanel(props: {
  program: IProgram;
  settings: ISettings;
  history: IHistoryRecord[];
  dispatch: IDispatch;
  isOngoing: boolean;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [restore, setRestore] = useState(false);
  const [overrides, setOverrides] = useState<{ fingerprint?: string; targets: Record<string, IMilestoneTarget> }>({
    targets: {},
  });
  const preview = useMemo(
    () =>
      open && !props.program.devfitPlan ? PlanUpgrade_preview(props.program, props.settings, props.history) : undefined,
    [open, props.program, props.settings, props.history]
  );
  const evaluated = useMemo(() => Program_evaluate(props.program, props.settings), [props.program, props.settings]);
  const names = useMemo(
    () =>
      new Map(
        (preview?.program ? Program_evaluate(preview.program, props.settings) : evaluated).weeks.flatMap((w) =>
          w.days.flatMap((d) => d.exercises.map((e) => [e.key, e.fullName] as const))
        )
      ),
    [preview?.program, evaluated, props.settings]
  );
  const plan = props.program.devfitPlan;
  const previewTargets = preview?.program?.devfitPlan
    ? {
        ...preview.program.devfitPlan.targets,
        ...(overrides.fingerprint === preview.fingerprint ? overrides.targets : {}),
      }
    : {};
  return (
    <DevFitSurface testID="devfit-plan-upgrade">
      <DevFitAction
        secondary
        label={open ? "Close plan setup" : plan ? "Plan setup · baselines and equipment" : "Update my existing plan"}
        onPress={() => setOpen(!open)}
      />
      {message && (
        <Text accessibilityRole="alert" style={{ color: c.ink }}>
          {message}
        </Text>
      )}
      {open && (
        <>
          <DevFitTitle title={plan ? "Your v0.5 plan" : "Review your plan update"} subtitle={props.program.name} />
          {props.isOngoing && (
            <Text style={{ color: c.muted }}>
              Save or discard your active workout before applying a plan update or bench choice.
            </Text>
          )}
          {preview && (
            <>
              {preview.changes.map((change) => (
                <Text key={change} style={{ color: c.ink }}>
                  • {change}
                </Text>
              ))}
              {preview.conflicts.map((conflict) => (
                <Text key={conflict} style={{ color: c.accent }}>
                  {conflict}
                </Text>
              ))}
              <FlatList
                scrollEnabled={false}
                data={Object.entries(previewTargets)}
                keyExtractor={([key]) => key}
                renderItem={({ item: [key, target] }) => (
                  <View style={{ paddingVertical: 12 }}>
                    <DevFitTargetSetup
                      programId={props.program.id}
                      exerciseKey={key}
                      target={target}
                      dispatch={props.dispatch}
                      label={names.get(key) ?? key}
                      onChange={(next) =>
                        setOverrides((old) => ({
                          fingerprint: preview.fingerprint,
                          targets: { ...(old.fingerprint === preview.fingerprint ? old.targets : {}), [key]: next },
                        }))
                      }
                    />
                  </View>
                )}
              />
              <DevFitAction
                label="Apply update to this plan"
                testID="devfit-apply-plan-upgrade"
                disabled={props.isOngoing || !preview.program || preview.conflicts.length > 0}
                onPress={() =>
                  props.dispatch(
                    PlanActions_apply(
                      {
                        ...preview,
                        program: preview.program?.devfitPlan
                          ? {
                              ...preview.program,
                              devfitPlan: { ...preview.program.devfitPlan, targets: previewTargets },
                            }
                          : preview.program,
                      },
                      (error) => setMessage(error ?? "Plan updated. Review the new exercise baselines before training.")
                    )
                  )
                }
              />
            </>
          )}
          {plan && (
            <>
              {plan.abdominal === "unknown" && (
                <View style={{ gap: 12 }}>
                  <Text className="font-semibold" style={{ color: c.ink }}>
                    Abdominal bench · identification pending
                  </Text>
                  <Text style={{ color: c.muted }}>
                    Choose only when the movement matches your bench. You can finish workouts while this remains
                    pending.
                  </Text>
                  {(
                    [
                      {
                        choice: "sit_up",
                        id: "sitUp",
                        title: "Sit-up bench",
                        note: "Face upward; curl your torso toward your knees.",
                      },
                      {
                        choice: "back_extension",
                        id: "backExtension",
                        title: "Back extension bench",
                        note: "Face downward with hips supported; hinge and extend at the hips.",
                      },
                    ] as const
                  ).map((item) => (
                    <View key={item.id} style={{ gap: 6 }}>
                      <DevFitBenchIllustration kind={item.choice} />
                      <Text style={{ color: c.ink }}>{item.note}</Text>
                      <DevFitAction
                        secondary
                        disabled={props.isOngoing}
                        label={`My bench is a ${item.title.toLowerCase()}`}
                        onPress={() =>
                          props.dispatch(
                            PlanActions_bench(props.program.id, item.choice, (error) =>
                              setMessage(error ?? `${item.title} selected.`)
                            )
                          )
                        }
                      />
                    </View>
                  ))}
                  <DevFitAction
                    secondary
                    label="Still unsure · leave pending"
                    onPress={() => setMessage("Bench choice remains pending. No abdominal success sets are required.")}
                  />
                </View>
              )}
              <FlatList
                scrollEnabled={false}
                data={Object.entries(plan.targets)}
                keyExtractor={([key]) => key}
                renderItem={({ item: [key, target] }) => (
                  <View style={{ paddingVertical: 12 }}>
                    <DevFitTargetSetup
                      programId={props.program.id}
                      exerciseKey={key}
                      target={target}
                      dispatch={props.dispatch}
                      label={names.get(key) ?? key}
                    />
                  </View>
                )}
              />
              <FlatList
                scrollEnabled={false}
                data={Object.entries(plan.cardio)}
                keyExtractor={([key]) => key}
                renderItem={({ item: [key, prescription] }) => (
                  <DevFitCardioPlanSetup
                    programId={props.program.id}
                    exerciseKey={key}
                    prescription={prescription}
                    dispatch={props.dispatch}
                    isOngoing={props.isOngoing}
                  />
                )}
              />
              <DevFitAction
                secondary
                label={restore ? "Cancel restore" : "Restore pre-upgrade plan…"}
                onPress={() => setRestore(!restore)}
              />
              {restore && (
                <>
                  <Text style={{ color: c.muted }}>
                    This restores the saved program snapshot. Workouts and measurements recorded since the update remain
                    in history.
                  </Text>
                  <DevFitAction
                    secondary
                    label="Restore saved plan snapshot"
                    disabled={props.isOngoing}
                    onPress={() =>
                      props.dispatch(
                        PlanActions_restore(props.program.id, (error) => {
                          setMessage(error ?? "Saved program snapshot restored.");
                          setRestore(false);
                        })
                      )
                    }
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </DevFitSurface>
  );
}
