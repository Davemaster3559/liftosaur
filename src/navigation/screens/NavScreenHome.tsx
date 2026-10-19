import { JSX, useState, useEffect } from "react";
import { View } from "react-native";
import { lb } from "lens-shmens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useTrackedState, useTrackedDispatch, untrack } from "../TrackedStateContext";
import { buildNavCommon } from "../utils";
import { ProgramHistoryView } from "../../components/programHistory";
import { ChooseProgramView } from "../../components/chooseProgram";
import { Program_getProgram, Program_evaluate } from "../../models/program";
import { updateSettings } from "../../models/state";
import { ISettings } from "../../types";
import { Schedule_get } from "../../devfit/schedule";
import { useScreenPerf } from "../../utils/useScreenPerf";
import { DevFitToday } from "../../devfit/today";
import { DevFitAction } from "../../devfit/ui";
import { Thunk_pushScreen, Thunk_startProgramDay, Thunk_startCatchUp } from "../../ducks/thunks";
import { navigateToModal } from "../navigationService";
import { DevFitCardioLog } from "../../devfit/cardioLog";

export function NavScreenMain(): JSX.Element {
  const state = useTrackedState();
  const dispatch = useTrackedDispatch();
  useScreenPerf("main");

  const [historyVisible, setHistoryVisible] = useState(false);
  const navCommon = untrack(buildNavCommon(state));
  const route = useRoute<{ key: string; name: "main"; params?: { historyRecordId?: number } }>();
  useEffect(() => {
    if (route.params?.historyRecordId != null) {
      setHistoryVisible(true);
    }
  }, [route.params?.historyRecordId]);
  const ongoingProgress = untrack(state.storage.progress?.[0]);
  const currentProgram = untrack(
    state.storage.currentProgramId != null ? Program_getProgram(state, state.storage.currentProgramId) : undefined
  );
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!currentProgram) {
      return;
    }
    const resolved = Schedule_get(Program_evaluate(currentProgram, state.storage.settings), state.storage.settings);
    if (JSON.stringify(resolved) !== JSON.stringify(state.storage.settings.devfitSchedules?.[currentProgram.id])) {
      updateSettings(
        dispatch,
        lb<ISettings>()
          .p("devfitSchedules")
          .recordModify((s) => ({ ...s, [currentProgram.id]: resolved })),
        "Remember home rotation"
      );
    }
  }, [currentProgram, state.storage.settings.devfitSchedules, dispatch]);

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
          dispatch={dispatch}
          onStart={(day) => dispatch(Thunk_startProgramDay(undefined, day))}
          onCatchUp={(includeCardio) => dispatch(Thunk_startCatchUp(includeCardio))}
          onDismissSetup={() =>
            updateSettings(
              dispatch,
              lb<ISettings>()
                .p("devfitSchedules")
                .recordModify((s) => ({
                  ...s,
                  [currentProgram.id]: {
                    ...Schedule_get(Program_evaluate(currentProgram, state.storage.settings), state.storage.settings),
                    setupDismissed: true,
                  },
                })),
              "Dismiss rotation setup"
            )
          }
          onSchedule={() => dispatch(Thunk_pushScreen("programs", undefined, { tab: "program" }))}
          onProgress={() => dispatch(Thunk_pushScreen("graphsList", undefined, { tab: "graphs" }))}
          onHistory={() => setHistoryVisible(true)}
          onChooseDay={() => navigateToModal("changeNextDayModal")}
        />
      ) : (
        <>
          <DevFitAction label="Back to Today" secondary onPress={() => setHistoryVisible(false)} />
          <DevFitCardioLog
            history={untrack(state.storage.history)}
            settings={untrack(state.storage.settings)}
            dispatch={dispatch}
            program={currentProgram}
          />
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
