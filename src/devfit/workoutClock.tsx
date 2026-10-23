import { JSX, memo, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../components/primitives/text";
import { IHistoryRecord } from "../types";
import {
  History_isNotStarted,
  History_isActivelyPaused,
  History_isPaused,
  History_workoutTime,
} from "../models/history";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { Session_minutes } from "./presentation";
import { DevFitTag } from "./ui";

export const DevFitWorkoutClock = memo(function DevFitWorkoutClock(props: {
  progress: IHistoryRecord;
  onPauseResume: () => void;
}): JSX.Element {
  const { progress, onPauseResume } = props;
  const c = Tailwind_semantic().devfit;
  const isNotStarted = History_isNotStarted(progress);
  const isActivelyPaused = History_isActivelyPaused(progress.intervals);
  const isPaused = History_isPaused(progress.intervals);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (isPaused) {
      return undefined;
    }
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const elapsedSeconds = isNotStarted ? 0 : Math.max(0, Math.floor(History_workoutTime(progress) / 1000));
  const statusLabel = isNotStarted ? "Ready" : isActivelyPaused ? "Workout paused" : "Workout active";

  return (
    <View style={{ gap: 10 }}>
      <View
        testID="devfit-workout-lifecycle"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          backgroundColor: c.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: isActivelyPaused ? c.accent : c.line,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View testID="devfit-workout-status">
            <DevFitTag label={statusLabel} success={!isNotStarted && !isActivelyPaused} />
          </View>
          <Text testID="devfit-workout-clock" className="text-lg font-bold" style={{ color: c.ink }}>
            {Session_minutes(elapsedSeconds)}
          </Text>
        </View>
        <Pressable
          testID="devfit-workout-pause-resume"
          accessibilityRole="button"
          accessibilityLabel={isNotStarted ? "Start session" : isActivelyPaused ? "Resume workout" : "Pause workout"}
          onPress={onPauseResume}
          style={{
            minHeight: 52,
            paddingHorizontal: 16,
            borderRadius: 10,
            backgroundColor: isActivelyPaused || isNotStarted ? c.accent : c.raised,
            borderWidth: 1,
            borderColor: isActivelyPaused || isNotStarted ? c.accent : c.line,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-sm font-bold" style={{ color: isActivelyPaused || isNotStarted ? c.onaccent : c.ink }}>
            {isNotStarted ? "Start session" : isActivelyPaused ? "Resume" : "Pause"}
          </Text>
        </Pressable>
      </View>
      {isActivelyPaused && (
        <Pressable
          testID="devfit-workout-paused-banner"
          accessibilityRole="button"
          accessibilityLabel="Workout Paused — Tap to Resume"
          onPress={onPauseResume}
          style={{
            backgroundColor: c.accentsoft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.accent,
            paddingHorizontal: 16,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text className="text-base font-bold" style={{ color: c.accent }}>
            Workout Paused — Tap to Resume
          </Text>
        </Pressable>
      )}
    </View>
  );
});
