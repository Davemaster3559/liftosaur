import { JSX, useEffect, useRef } from "react";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useAppState } from "../StateContext";
import { ModalScreenContainer } from "../ModalScreenContainer";
import { FormSheet } from "../FormSheet";
import { SetTimerBannerContent } from "../../components/setTimerBanner";
import {
  Program_evaluate,
  Program_fullProgram,
  Program_getProgramExercise,
  Program_getFullProgram,
} from "../../models/program";
import { buildPlaygroundDispatch, getPlaygroundProgress } from "./navModalPlaygroundUtils";
import { useClearOnModalRemove } from "../useClearOnModalRemove";
import { Progress_getActiveSetTimer } from "../../models/progress";
import type { IRootStackParamList } from "../types";
import { DevFitCardioActivityForm } from "../../devfit/cardioActivityForm";
import { Cardio_updateEntry } from "../../devfit/cardio";
import { Dates_zone } from "../../devfit/dates";
import { updateProgress } from "../../models/state";
import { IHistoryRecord } from "../../types";
import { lb } from "lens-shmens";
import { CardioFinish_step, ICardioTimerTarget } from "../../devfit/cardioFinish";

export function NavModalSetTimer(): JSX.Element {
  const { state, dispatch } = useAppState();
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: "setTimerModal"; params: IRootStackParamList["setTimerModal"] }>();
  const { context } = route.params;
  const isPlayground = context === "playground";
  const target = useRef<ICardioTimerTarget | undefined>(undefined);

  // Playground edits (exercise vars, units) live on playgroundState.settings, not the global storage copy — use
  // it so the dispatch, program evaluation, and display all run against what the user actually sees.
  const settings = isPlayground ? (state.playgroundState?.settings ?? state.storage.settings) : state.storage.settings;

  let progress: ReturnType<typeof getPlaygroundProgress>;
  let modalDispatch = dispatch;

  if (context === "playground") {
    const { weekIndex, dayIndex } = route.params;
    progress = getPlaygroundProgress(state, weekIndex, dayIndex);
    modalDispatch = buildPlaygroundDispatch(
      dispatch,
      weekIndex,
      dayIndex,
      () => getPlaygroundProgress(state, weekIndex, dayIndex),
      settings,
      // Real stats, not empty — a timed set's completion/auto-fire can run update scripts that read
      // stats/bodyweight/history (the in-card playground path passes these through too).
      state.storage.stats
    );
  } else {
    const { progressId } = route.params;
    progress = progressId === 0 ? state.storage.progress?.[0] : state.progress[progressId];
  }

  const setTimerModal = progress != null ? Progress_getActiveSetTimer(progress) : undefined;

  const evaluatedProgram = isPlayground
    ? state.playgroundState?.program
      ? Program_evaluate(Program_fullProgram(state.playgroundState.program, settings), settings)
      : undefined
    : progress?.programId
      ? (() => {
          const program = Program_getFullProgram(state, progress.programId);
          return program ? Program_evaluate(program, settings) : undefined;
        })()
      : undefined;
  const entry = setTimerModal != null ? progress?.entries[setTimerModal.entryIndex] : undefined;
  const programExercise =
    evaluatedProgram && progress
      ? Program_getProgramExercise(progress.day, evaluatedProgram, entry?.programExerciseId)
      : undefined;

  useClearOnModalRemove(() => {
    if (progress?.setTimer || progress?.setTimerGetReady) {
      modalDispatch({ type: "CloseSetTimerAction", isPlayground });
    }
  });

  const onClose = (): void => {
    navigation.goBack();
  };

  // Reindexing remaps entryIndex only, so the named set can be gone after a deletion; the banner then
  // renders null and stops its own tick, stranding an empty sheet. Deliberately checks the set rather than
  // "banner rendered null" — it also renders null under the AMRAP modal, which must stay mounted.
  const timedSet = entry != null && setTimerModal != null ? entry.sets[setTimerModal.setIndex] : undefined;
  const transition = CardioFinish_step(target.current, progress);
  target.current = transition.target;
  const finishTarget = isPlayground ? undefined : transition.finish;
  const finishedActivity = finishTarget?.activity;
  const shouldGoBack = !finishedActivity && (!progress || !setTimerModal || entry == null || timedSet == null);
  useEffect(() => {
    if (shouldGoBack) {
      navigation.goBack();
    }
  }, [shouldGoBack]);

  if (finishTarget && finishedActivity && progress) {
    return (
      <ModalScreenContainer onClose={onClose} maxWidth="700px" isFullWidth>
        <FormSheet>
          <DevFitCardioActivityForm
            settings={settings}
            history={state.storage.history}
            zone={finishedActivity.timeZone ?? Dates_zone()}
            activity={finishedActivity}
            mode="live"
            onCancel={onClose}
            onSave={(a) => {
              updateProgress(
                modalDispatch,
                lb<IHistoryRecord>()
                  .p("entries")
                  .i(finishTarget.entryIndex)
                  .recordModify((currentEntry) => Cardio_updateEntry(currentEntry, finishTarget.setIndex, a)),
                "Save actual cardio details"
              );
              navigation.goBack();
            }}
          />
        </FormSheet>
      </ModalScreenContainer>
    );
  }
  if (shouldGoBack || !progress || !setTimerModal) {
    return <></>;
  }

  return (
    <ModalScreenContainer onClose={onClose} maxWidth="480px" isFullWidth>
      <FormSheet>
        <SetTimerBannerContent
          progress={progress}
          settings={settings}
          setTimerModal={setTimerModal}
          dispatch={modalDispatch}
          onClose={onClose}
          isPlayground={isPlayground}
          programExercise={programExercise}
          otherStates={evaluatedProgram?.states}
        />
      </FormSheet>
    </ModalScreenContainer>
  );
}
