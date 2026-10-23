import { lb } from "lens-shmens";
import { IThunk } from "../ducks/types";
import { IState, updateState, updateProgress, updateSettings } from "../models/state";
import { Cardio_manualRecord, Cardio_applyPhase, ICardioPhaseRequest } from "./cardio";
import { ICardioActivity, IScheduleCredit } from "./cardioSchema";
import { Program_evaluate } from "../models/program";
import { Schedule_creditValid, Schedule_get } from "./schedule";
import { IHistoryRecord, ISettings } from "../types";
import { History_clockNow, History_isActivelyPaused } from "../models/history";
import { ITrainingDate, TrainingDate_config, TrainingDate_start } from "./trainingDates";
import { Dates_timestamp } from "./dates";

export function CardioActions_save(
  activity: ICardioActivity,
  previousId?: number,
  credit?: IScheduleCredit,
  trainingDate?: ITrainingDate
): IThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const previous =
      previousId == null
        ? undefined
        : state.storage.history.find((r) => r.id === previousId && r.source === "devfit_manual");
    if (previousId != null && !previous) {
      return;
    }
    const allRecords = [
      ...state.storage.history,
      ...Object.values(state.storage.progress),
      ...Object.values(state.progress),
    ].filter((r): r is IHistoryRecord => !!r);
    const dateConfig = TrainingDate_config(state.storage.settings, state.storage.currentProgramId);
    const defaultAssignment: ITrainingDate | undefined = previous
      ? undefined
      : activity.datePrecision === "date"
        ? { source: "training_date", date: activity.performedLocalDate, ...dateConfig }
        : TrainingDate_start(
            Dates_timestamp(activity.performedLocalDate, activity.timeZone, activity.performedLocalTime),
            dateConfig
          );
    const record = Cardio_manualRecord(
      activity,
      allRecords,
      state.storage.settings,
      Date.now(),
      previous,
      trainingDate ?? defaultAssignment
    );
    record.devfitScheduleCredit = credit ?? previous?.devfitScheduleCredit;
    updateState(
      dispatch,
      [
        lb<IState>()
          .p("storage")
          .p("history")
          .record(
            [record, ...state.storage.history.filter((r) => r.id !== record.id)].sort(
              (a, b) => b.startTime - a.startTime
            )
          ),
      ],
      "Save historical cardio"
    );
  };
}

export function CardioActions_delete(id: number): IThunk {
  return async (dispatch, getState) => {
    const state = getState();
    if (!state.storage.history.some((r) => r.id === id && r.source === "devfit_manual")) {
      return;
    }
    updateState(
      dispatch,
      [
        lb<IState>()
          .p("storage")
          .p("history")
          .record(state.storage.history.filter((r) => r.id !== id)),
      ],
      "Delete historical cardio"
    );
  };
}

export function CardioActions_credit(id: number, credit?: IScheduleCredit): IThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const program = credit && state.storage.programs.find((p) => p.id === credit.programId);
    if (
      credit &&
      (!program ||
        !Schedule_creditValid(
          credit,
          Program_evaluate(program, state.storage.settings),
          Schedule_get(Program_evaluate(program, state.storage.settings), state.storage.settings)
        ))
    ) {
      return;
    }
    updateState(
      dispatch,
      [
        lb<IState>()
          .p("storage")
          .p("history")
          .record(state.storage.history.map((r) => (r.id === id ? { ...r, devfitScheduleCredit: credit } : r))),
      ],
      "Credit scheduled session"
    );
  };
}

export function CardioActions_phase(request: ICardioPhaseRequest): IThunk {
  return async (dispatch, getState) => {
    const progress = getState().storage.progress[0];
    if (!progress) {
      return;
    }
    const updated = Cardio_applyPhase(
      progress,
      request,
      History_clockNow(progress),
      History_isActivelyPaused(progress.intervals)
    );
    if (updated === progress) {
      return;
    }
    updateProgress(dispatch, lb<IHistoryRecord>().p("entries").record(updated.entries), "Record running phase");
    if (request.kind === "settings" && request.value) {
      updateSettings(
        dispatch,
        lb<ISettings>()
          .p("devfitCardioSuggestions")
          .recordModify((s) => ({ ...s, [request.expectedPhase]: request.value })),
        "Remember phase suggestion"
      );
    }
  };
}
