import { JSX, memo, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, ISettings } from "../types";
import { IDispatch } from "../ducks/types";
import { RestTimerProgress_at, RestTimerProgress_context } from "../models/restTimerProgress";
import { Reps_findNextEntryAndSetIndex } from "../models/set";
import { History_clockNow, History_pauseTime } from "../models/history";
import { Thunk_updateTimer } from "../ducks/thunks";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Session_minutes } from "./presentation";
import { DevFitAction, DevFitBar, DevFitSurface, DevFitTag } from "./ui";

export const DevFitRestPanel = memo(function DevFitRestPanel(props: {
  progress: IHistoryRecord;
  settings: ISettings;
  dispatch: IDispatch;
}): JSX.Element | null {
  const { timer, timerSince } = props.progress;
  const pausedAt = History_pauseTime(props.progress.intervals);
  const [, tick] = useState(0);
  useEffect(() => {
    if (timerSince == null || pausedAt != null) {
      return undefined;
    }
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerSince, pausedAt]);
  if (timer == null || timerSince == null) {
    return null;
  }
  const c = Tailwind_semantic().devfit;
  const time = RestTimerProgress_at(timerSince, timer, History_clockNow(props.progress));
  const context = RestTimerProgress_context(props.progress, props.settings);
  const next =
    props.progress.timerEntryIndex != null
      ? Reps_findNextEntryAndSetIndex(
          props.progress,
          props.progress.timerEntryIndex,
          props.progress.timerMode ?? "workout"
        )
      : undefined;
  const remaining = Math.ceil(time.remainingMs / 1000);
  const overtime = Math.floor(Math.max(0, time.elapsedMs / 1000 - timer));
  return (
    <DevFitSurface testID="devfit-rest-panel">
      <DevFitTag
        label={pausedAt != null ? "Rest paused" : time.isTimeOut ? "Rest complete" : "Resting after"}
        success
      />
      <Text className="text-base font-semibold" testID="devfit-rest-context" style={{ color: c.ink }}>
        {context.after}
      </Text>
      <Text className="text-3xl font-bold" testID="devfit-rest-remaining" style={{ color: c.success }}>
        {time.isTimeOut
          ? `+${Session_minutes(overtime).padStart(5, "0")} overtime`
          : `${Session_minutes(remaining).padStart(5, "0")} remaining`}
      </Text>
      <DevFitBar value={Math.min(timer, time.elapsedMs / 1000)} total={timer} />
      <Text className="text-xs" style={{ color: c.muted }}>
        {Session_minutes(time.elapsedMs / 1000)} rested · {Session_minutes(timer)} planned
      </Text>
      {context.next && (
        <Text testID="devfit-rest-next" className="text-sm" style={{ color: c.ink }}>
          Next: {context.next}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <DevFitAction
          label="-15s"
          testID="devfit-rest-minus"
          secondary
          onPress={() =>
            props.dispatch(Thunk_updateTimer(Math.max(0, timer - 15), next?.entryIndex, next?.setIndex, false))
          }
        />
        <DevFitAction
          label="+15s"
          testID="devfit-rest-plus"
          secondary
          onPress={() => props.dispatch(Thunk_updateTimer(timer + 15, next?.entryIndex, next?.setIndex, false))}
        />
        <DevFitAction
          label="Skip"
          testID="devfit-rest-skip"
          secondary
          onPress={() => props.dispatch({ type: "StopTimer" })}
        />
      </View>
    </DevFitSurface>
  );
});
