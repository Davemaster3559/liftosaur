import { JSX, useEffect, useRef } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppState } from "../StateContext";
import { ModalScreenContainer } from "../ModalScreenContainer";
import { FormSheet } from "../FormSheet";
import { Button } from "../../components/button";
import { Text } from "../../components/primitives/text";
import { Dialog_confirm } from "../../utils/dialog";
import { DevFit_exportRecovery } from "../../devfit/recovery";
import { IState, updateState } from "../../models/state";
import { lb } from "lens-shmens";

export function NavModalCorruptedState(): JSX.Element {
  const { state, dispatch } = useAppState();
  const navigation = useNavigation();

  const corruptedstorage = state.errors.corruptedstorage;
  const isResettingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!isResettingRef.current) {
        e.preventDefault();
      }
    });
    return unsubscribe;
  }, [navigation]);

  const onReset = async (): Promise<void> => {
    if (corruptedstorage?.local && !await Dialog_confirm("Reset DevFit? This replaces your local profile with an empty one. Export and save the recovery file first. This action cannot be undone inside the app.")) return;
    isResettingRef.current = true;
    updateState(
      dispatch,
      [lb<IState>().p("errors").p("corruptedstorage").record(undefined)],
      "Reset corrupted storage"
    );
    navigation.goBack();
  };

  const shouldGoBack = !corruptedstorage;
  useEffect(() => {
    if (shouldGoBack) {
      isResettingRef.current = true;
      navigation.goBack();
    }
  }, [shouldGoBack]);

  if (shouldGoBack || !corruptedstorage) {
    return <></>;
  }

  return (
    <ModalScreenContainer onClose={() => undefined} shouldShowClose={false}>
      <FormSheet>
        <View>
          <Text className="pb-4 text-lg font-bold text-center">Local data needs recovery</Text>
        </View>
        <View className="pb-4">
          <Text>
            DevFit could not read your saved profile. Automatic saves are paused to preserve the original data.
          </Text>
        </View>
        <View className="pb-4">
          {corruptedstorage.backup ? (
            <Text className="font-bold text-center text-text-success">
              History was successfully backed up, user: <Text className="font-bold">{corruptedstorage.userid}</Text>
            </Text>
          ) : (
            <Text className="text-text-secondary">No cloud backup was created. Export the raw recovery file below and save it somewhere safe.</Text>
          )}
        </View>
        <View className="pb-4">
          <Text>
            The recovery file preserves your stored values, including any damaged sections. It is intended for manual repair and is not a normal import file. It may contain your private training data.
          </Text>
        </View>
        <View className="pb-4">
          {corruptedstorage.local ? (
            <Text>
              You can either wait until this is fixed (and close the app for now), or start with the empty state (but
              your history and programs will be gone).
            </Text>
          ) : (
            <Text className="pb-4">
              We will log out for now, and won't sync the changes to the cloud, to avoid even bigger mess.
            </Text>
          )}
        </View>
        <View className="items-center">
          <Button name="corrupted-state-export" kind="purple" onClick={() => dispatch(DevFit_exportRecovery())}>
            Export recovery file
          </Button>
          <Button name="corrupted-state-reset" kind="red" onClick={onReset}>
            {corruptedstorage.local ? "Reset and start from scratch" : "Continue"}
          </Button>
        </View>
      </FormSheet>
    </ModalScreenContainer>
  );
}
