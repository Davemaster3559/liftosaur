import { JSX, memo, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord, ISettings } from "../types";
import { IDispatch } from "../ducks/types";
import { RestTimerProgress_at } from "../models/restTimerProgress";
import { Reps_findNextEntryAndSetIndex } from "../models/set";
import { Exercise_get } from "../models/exercise";
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
  const [, tick] = useState(0);
  useEffect(() => {
    if (timerSince == null) {
      return;
    }
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerSince]);
  if (timer == null || timerSince == null) {
    return null;
  }
  const c = Tailwind_semantic().devfit;
  const time = RestTimerProgress_at(timerSince, timer, Date.now());
  const next =
    props.progress.timerEntryIndex != null && props.progress.timerMode != null
      ? Reps_findNextEntryAndSetIndex(props.progress, props.progress.timerEntryIndex, props.progress.timerMode)
      : undefined;
  const nextEntry = next && props.progress.entries[next.entryIndex];
  return (
    <DevFitSurface testID="devfit-rest-panel">
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <DevFitTag label={time.isTimeOut ? "Rest complete" : "Recover"} success />
        <Text className="text-3xl font-bold" testID="devfit-rest-remaining" style={{ color: c.success }}>
          {Session_minutes(Math.max(0, time.remainingMs) / 1000)}
        </Text>
      </View>
      <DevFitBar value={Math.min(timer, time.elapsedMs / 1000)} total={timer} />
      <Text className="text-xs" style={{ color: c.muted }}>
        {Session_minutes(time.elapsedMs / 1000)} elapsed · {Session_minutes(timer)} total
        {nextEntry
          ? ` · Next: ${Exercise_get(nextEntry.exercise, props.settings.exercises).name}, set ${next!.setIndex + 1}`
          : ""}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <DevFitAction
          label="−15 sec"
          testID="devfit-rest-minus"
          secondary
          onPress={() =>
            props.dispatch(Thunk_updateTimer(Math.max(0, timer - 15), next?.entryIndex, next?.setIndex, false))
          }
        />
        <DevFitAction
          label="+15 sec"
          testID="devfit-rest-plus"
          secondary
          onPress={() => props.dispatch(Thunk_updateTimer(timer + 15, next?.entryIndex, next?.setIndex, false))}
        />
        <DevFitAction
          label="Skip rest"
          testID="devfit-rest-skip"
          secondary
          onPress={() => props.dispatch({ type: "StopTimer" })}
        />
      </View>
    </DevFitSurface>
  );
});
