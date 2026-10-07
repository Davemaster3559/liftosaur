import { JSX, useState, useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useTrackedState, useTrackedDispatch, untrack } from "../TrackedStateContext";
import { buildNavCommon } from "../utils";
import { ProgramHistoryView } from "../../components/programHistory";
import { ChooseProgramView } from "../../components/chooseProgram";
import { Program_getProgram } from "../../models/program";
import { useScreenPerf } from "../../utils/useScreenPerf";
import { DevFitToday } from "../../devfit/today";
import { DevFitAction } from "../../devfit/ui";
import { Thunk_pushScreen, Thunk_startProgramDay } from "../../ducks/thunks";
import { navigateToModal } from "../navigationService";

export function NavScreenMain(): JSX.Element {
  const state = useTrackedState();
  const dispatch = useTrackedDispatch();
  useScreenPerf("main");

  const [historyVisible, setHistoryVisible] = useState(false);
  const navCommon = untrack(buildNavCommon(state));
  const route = useRoute<{ key: string; name: "main"; params?: { historyRecordId?: number } }>();
  useEffect(() => {
    if (route.params?.historyRecordId != null) setHistoryVisible(true);
  }, [route.params?.historyRecordId]);
  const ongoingProgress = untrack(state.storage.progress?.[0]);
  const currentProgram = untrack(
    state.storage.currentProgramId != null ? Program_getProgram(state, state.storage.currentProgramId) : undefined
  );
  const insets = useSafeAreaInsets();

  if (currentProgram == null) {
    return (
      <View className="flex-1 bg-background-default" style={{ paddingTop: insets.top }}>
        <ChooseProgramView
          navCommon={navCommon}
          settings={untrack(state.storage.settings)}
          dispatch={dispatch}
          progress={ongoingProgress}
          programs={untrack(state.programs || [])}
          programsIndex={untrack(state.programsIndex || [])}
          customPrograms={untrack(state.storage.programs || [])}
          editProgramId={ongoingProgress?.programId}
          hasBottomNav={true}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background-default" style={{ paddingTop: insets.top }}>
      {!historyVisible ? (
        <DevFitToday
          program={currentProgram}
          settings={untrack(state.storage.settings)}
          history={untrack(state.storage.history)}
          stats={untrack(state.storage.stats)}
          progress={ongoingProgress}
          onStart={() => dispatch(Thunk_startProgramDay())}
          onSchedule={() => dispatch(Thunk_pushScreen("programs", undefined, { tab: "program" }))}
          onProgress={() => dispatch(Thunk_pushScreen("graphsList", undefined, { tab: "graphs" }))}
          onHistory={() => setHistoryVisible(true)}
          onChooseDay={() => navigateToModal("changeNextDayModal")}
        />
      ) : (
        <>
          <DevFitAction label="Back to Today" secondary onPress={() => setHistoryVisible(false)} />
          <ProgramHistoryView
            progress={ongoingProgress}
            navCommon={navCommon}
            program={currentProgram}
            settings={untrack(state.storage.settings)}
            history={untrack(state.storage.history)}
            subscription={untrack(state.storage.subscription)}
            dispatch={dispatch}
            initialHistoryRecordId={route.params?.historyRecordId}
          />
        </>
      )}
    </View>
  );
}
