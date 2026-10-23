import { JSX } from "react";
import { Platform, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IDispatch } from "../ducks/types";
import { Thunk_exportStorage, Thunk_pushScreen } from "../ducks/thunks";
import { ImporterStorage } from "../components/importerStorage";
import { ISettings } from "../types";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { DevFitAction, DevFitColumns, DevFitSection, DevFitSurface, DevFitTag, DevFitTitle } from "./ui";
import { DevFitPage } from "./page";

export function DevFitMe(props: { settings: ISettings; dispatch: IDispatch; onSettings: () => void }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  return (
    <DevFitPage testID="devfit-me">
      <DevFitTitle
        eyebrow="Your space"
        title="Me"
        subtitle={props.settings.nickname || "Training that fits your life."}
      />
      <DevFitColumns
        primary={
          <>
            <DevFitSurface accent>
              <DevFitTag label="On this device" success />
              <Text className="text-xl font-bold" style={{ color: c.ink }}>
                Your training. Your data.
              </Text>
              <Text className="text-sm" style={{ color: c.muted }}>
                DevFit saves your workouts locally. Keep a JSON backup somewhere safe so you can restore your history,
                programs and settings.
              </Text>
              <DevFitAction
                label="Back up everything · JSON"
                testID="devfit-backup"
                onPress={() => props.dispatch(Thunk_exportStorage())}
              />
              <ImporterStorage dispatch={props.dispatch} />
            </DevFitSurface>
            <DevFitSection title="Training setup">
              <DevFitSurface>
                <DevFitAction
                  label="Exercise library & favorites"
                  secondary
                  onPress={() => props.dispatch(Thunk_pushScreen("exercises", undefined, { tab: "me" }))}
                />
                <DevFitAction
                  label="Equipment & plate calculator"
                  secondary
                  onPress={() => props.dispatch(Thunk_pushScreen("plates", undefined, { tab: "me" }))}
                />
                <DevFitAction
                  label="Rest & workout timers"
                  secondary
                  onPress={() => props.dispatch(Thunk_pushScreen("timers", undefined, { tab: "me" }))}
                />
                <DevFitAction
                  label="Muscle groups & set weighting"
                  secondary
                  onPress={() => props.dispatch(Thunk_pushScreen("muscleGroups", undefined, { tab: "me" }))}
                />
              </DevFitSurface>
            </DevFitSection>
          </>
        }
        secondary={
          <>
            <DevFitSection title="Body & wellbeing">
              <DevFitSurface>
                <DevFitAction
                  label="Weight & body measurements"
                  secondary
                  onPress={() => props.dispatch(Thunk_pushScreen("measurements", undefined, { tab: "me" }))}
                />
                <DevFitAction
                  label="Sleep & nutrition"
                  secondary
                  onPress={() => props.dispatch(Thunk_pushScreen("sleepNutrition", undefined, { tab: "me" }))}
                />
              </DevFitSurface>
            </DevFitSection>
            <DevFitSection title="Connected health">
              <DevFitSurface>
                <Text className="text-sm" style={{ color: c.muted }}>
                  Choose what to share with your device’s health service. Permissions are requested when you enable a
                  sync option.
                </Text>
                <DevFitAction
                  label={Platform.OS === "ios" ? "Apple Health" : "Health Connect"}
                  secondary
                  onPress={() =>
                    props.dispatch(
                      Thunk_pushScreen(Platform.OS === "ios" ? "appleHealth" : "googleHealth", undefined, { tab: "me" })
                    )
                  }
                />
              </DevFitSurface>
            </DevFitSection>
            <DevFitAction label="Preferences, imports & all settings" secondary onPress={props.onSettings} />
            <View style={{ gap: 8, padding: 8 }}>
              <Text className="font-bold" style={{ color: c.ink }}>
                About DevFit
              </Text>
              <Text className="text-xs" style={{ color: c.muted }}>
                Built on Liftosaur’s open-source training engine. Offline logging, flexible progression and no account
                required.
              </Text>
            </View>
          </>
        }
      />
    </DevFitPage>
  );
}
