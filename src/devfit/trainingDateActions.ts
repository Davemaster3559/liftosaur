import { lb } from "lens-shmens";
import { IThunk } from "../ducks/types";
import { IState, updateState } from "../models/state";
import { TrainingDate_assign, TrainingDate_config } from "./trainingDates";
import { Dates_day } from "./dates";

export function TrainingDateActions_assign(recordId: number, date: string): IThunk {
  return async (dispatch, getState) => {
    if (Dates_day(date) == null) {
      return;
    }
    const state = getState();
    const record = recordId === 0 ? state.storage.progress[0] : state.storage.history.find((r) => r.id === recordId);
    if (!record) {
      return;
    }
    const config =
      record.devfitTrainingDate ?? TrainingDate_config(state.storage.settings, record.catchUpFor ?? record.programId);
    const updated = TrainingDate_assign(record, date, config);
    if (recordId === 0) {
      updateState(
        dispatch,
        [lb<IState>().p("storage").p("progress").i(0).p("devfitTrainingDate").record(updated.devfitTrainingDate)],
        "Assign training date"
      );
    } else {
      updateState(
        dispatch,
        [
          lb<IState>()
            .p("storage")
            .p("history")
            .record(state.storage.history.map((r) => (r.id === recordId ? updated : r))),
          ...(state.progress[recordId]
            ? [
                lb<IState>()
                  .p("progress")
                  .p(recordId)
                  .record({ ...state.progress[recordId]!, devfitTrainingDate: updated.devfitTrainingDate }),
              ]
            : []),
        ],
        "Assign training date"
      );
    }
  };
}
