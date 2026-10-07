import { JSX, useState } from "react";
import { NavScreenContent } from "../NavScreenContent";
import { ScreenGraphs as ScreenGraphsComponent } from "../../components/screenGraphs";
import { useScreenPerf } from "../../utils/useScreenPerf";
import { usePerfRenderCount } from "../../utils/usePerfRenderCount";
import { useTrackedState, useTrackedDispatch, untrack } from "../TrackedStateContext";
import { DevFitProgress } from "../../devfit/progressScreen";
import { DevFitAction } from "../../devfit/ui";
import { Thunk_pushScreen } from "../../ducks/thunks";
import { navigateToModal } from "../navigationService";
import { DateUtils_firstDayOfWeekTimestamp } from "../../utils/date";

export function NavScreenGraphs(): JSX.Element {
  useScreenPerf("graphsList");
  usePerfRenderCount("NavScreenGraphs");
  const state = useTrackedState();
  const dispatch = useTrackedDispatch();
  const [graphs, setGraphs] = useState(false);
  if (!graphs)
    return (
      <DevFitProgress
        history={untrack(state.storage.history)}
        settings={untrack(state.storage.settings)}
        stats={untrack(state.storage.stats)}
        program={untrack(state.storage.programs.find((p) => p.id === state.storage.currentProgramId))}
        onGraphs={() => setGraphs(true)}
        onMeasurements={() => dispatch(Thunk_pushScreen("measurements", { key: "weight" }, { tab: "me" }))}
        onInsights={() =>
          navigateToModal("weekInsightsDetailsModal", {
            selectedFirstDayOfWeek: DateUtils_firstDayOfWeekTimestamp(
              Date.now(),
              state.storage.settings.startWeekFromMonday
            ),
          })
        }
      />
    );
  return (
    <NavScreenContent>
      <DevFitAction label="Back to Progress" secondary onPress={() => setGraphs(false)} />
      <ScreenGraphsComponent />
    </NavScreenContent>
  );
}
