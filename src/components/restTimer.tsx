import { JSX, useEffect, useRef, useState } from "react";
import { View, Pressable, Platform, Animated, useWindowDimensions } from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomKeyboardActiveId } from "../navigation/CustomKeyboardContext";
import { useActiveSheet } from "../navigation/ActiveSheetHeightContext";
import { useTrackedState } from "../navigation/TrackedStateContext";
import { Text } from "./primitives/text";
import { TimeUtils_formatMMSS } from "../utils/time";
import { StringUtils_pad } from "../utils/string";
import { IDispatch } from "../ducks/types";
import { Thunk_playAudioNotification, Thunk_updateTimer, Thunk_checkSetTimer } from "../ducks/thunks";
import { IconTrash } from "./icons/iconTrash";
import { IconBack } from "./icons/iconBack";
import { IHistoryRecord, ISettings, ISubscription } from "../types";
import { Reps_findNextEntryAndSetIndex } from "../models/set";
import { Progress_getCurrentProgress } from "../models/progress";
import { useTrackClick } from "../utils/clickTracking";
import { useRem, useRemScale } from "../utils/useRem";
import { TEXT_SIZE_MAX } from "../models/settings";
import {
  IRestTimerNotice,
  RestTimerProgress_at,
  RestTimerProgress_context,
  RestTimerProgress_notice,
} from "../models/restTimerProgress";
import { History_clockNow, History_pauseTime } from "../models/history";
import { Tailwind_colors } from "../utils/tailwindConfig";
import { RestTimerWidth_em } from "../models/restTimerWidth";

const TEXT_2XL_PX = 24;

const TRANSITION_MS = 220;
const RestTimerLayoutTransition =
  Platform.OS === "web" ? undefined : LinearTransition.duration(TRANSITION_MS).easing(Easing.inOut(Easing.quad));
const RestTimerContentEntering = Platform.OS === "web" ? undefined : FadeIn.duration(TRANSITION_MS);
const RestTimerContentExiting = Platform.OS === "web" ? undefined : FadeOut.duration(TRANSITION_MS / 2);

function useRestTimerProgressStyle(
  timerSince: number | undefined,
  timer: number | undefined,
  pausedAt?: number
): ReturnType<typeof useAnimatedStyle> {
  const fraction = useSharedValue(0);
  // No cancelAnimation in cleanup: scheduleOnUI runs after the next .value write, so it stopped the new rest at 0.
  useEffect(() => {
    if (timerSince == null || timer == null) {
      return;
    }
    const progress = RestTimerProgress_at(timerSince, timer, pausedAt ?? Date.now());
    fraction.value = progress.fraction;
    if (progress.remainingMs > 0 && pausedAt == null) {
      fraction.value = withTiming(1, { duration: progress.remainingMs, easing: Easing.linear });
    }
  }, [timerSince, timer, fraction, pausedAt]);
  return useAnimatedStyle(() => ({ transform: [{ scaleX: fraction.value }] }));
}

function useRestTimerTick(isActive: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const intervalId = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(intervalId);
  }, [isActive]);
}

export function RestTimer_formatCompact(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor(ms / 1000 / 60);
  return `${minutes}:${StringUtils_pad(seconds.toString(), 2)}`;
}

interface IProps {
  hidePresentation?: boolean;
  progress: IHistoryRecord;
  dispatch: IDispatch;
  subscription: ISubscription;
  settings: ISettings;
}

const shadowStyle = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 8 },
  android: { elevation: 8 },
  default: { boxShadow: "0px 0px 8px rgb(0 0 0 / 25%)" },
});

export function RestTimer(props: IProps): JSX.Element | null {
  const notice = useRef<IRestTimerNotice>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const trackClick = useTrackClick();
  const insets = useSafeAreaInsets();
  const keyboardActiveId = useCustomKeyboardActiveId();
  const { height: windowHeight } = useWindowDimensions();
  const activeSheet = useActiveSheet();
  const expandedSpacing = useRem() >= TEXT_SIZE_MAX ? 4 : 8;
  const remScale = useRemScale();
  const activeSheetHeight = activeSheet.height;
  // When the custom keyboard is open, the timer is shown inside it (see KeyboardRestTimer), so hide
  // the floating one here. We keep it mounted (not returning null) so the completion chirp still fires.
  const hideTimer = activeSheet.hidesFloatingUi || activeSheetHeight > windowHeight * 0.5 || keyboardActiveId != null;
  const baseBottom = insets.bottom + 80;
  const targetBottom = Math.max(baseBottom, activeSheetHeight > 0 ? activeSheetHeight + 16 : 0);
  const animatedTargetBottom = useRef(new Animated.Value(targetBottom)).current;
  const animatedOpacity = useRef(new Animated.Value(1)).current;
  const wasHiddenRef = useRef(false);
  useEffect(() => {
    if (hideTimer) {
      animatedTargetBottom.setValue(targetBottom);
      animatedOpacity.setValue(0);
      wasHiddenRef.current = true;
    } else if (wasHiddenRef.current) {
      animatedTargetBottom.setValue(targetBottom);
      animatedOpacity.setValue(0);
      Animated.timing(animatedOpacity, { toValue: 1, duration: 200, useNativeDriver: false }).start();
      wasHiddenRef.current = false;
    } else {
      animatedOpacity.setValue(1);
      Animated.timing(animatedTargetBottom, {
        toValue: targetBottom,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [hideTimer, targetBottom, animatedTargetBottom, animatedOpacity]);
  const { progress } = props;
  const { timer, timerSince } = progress;
  const pausedAt = History_pauseTime(progress.intervals);
  useRestTimerTick(timerSince != null && pausedAt == null);
  const progressStyle = useRestTimerProgressStyle(timerSince, timer, pausedAt);

  useEffect(() => {
    const time =
      timerSince != null && timer != null
        ? RestTimerProgress_at(timerSince, timer, History_clockNow(progress))
        : undefined;
    const result = RestTimerProgress_notice(
      notice.current,
      RestTimerProgress_context(progress, props.settings).key,
      time,
      timer,
      pausedAt != null,
      !!progress.ui?.nativeNotificationScheduled
    );
    notice.current = result.state;
    if (result.notify) {
      props.dispatch(Thunk_playAudioNotification());
    }
  });

  // The corner rest timer shows the rest for `auto` timed sets. Poll the model each tick so it advances
  // to the next set's work window when the rest expires; a cheap no-op otherwise (Progress_checkSetTimer).
  useEffect(() => {
    if (timer == null || timerSince == null) {
      return;
    }
    props.dispatch(Thunk_checkSetTimer());
  });

  if (timer == null || timerSince == null || props.hidePresentation) {
    return null;
  }
  const pointerEventsMode = hideTimer ? "none" : "box-none";

  const { elapsedMs, isTimeOut } = RestTimerProgress_at(timerSince, timer, History_clockNow(progress));
  const elapsedText = TimeUtils_formatMMSS(elapsedMs);
  const bgClass = isTimeOut ? "bg-background-darkred" : "bg-background-darkgray";
  const totalColorClass = isTimeOut ? "text-white" : "text-gray-300";
  const nextEntryAndSetIndex =
    progress.timerEntryIndex != null && progress.timerMode != null
      ? Reps_findNextEntryAndSetIndex(progress, progress.timerEntryIndex, progress.timerMode)
      : undefined;
  const expanded = (
    <View className="flex-row items-center" style={{ gap: expandedSpacing, padding: expandedSpacing }}>
      <Pressable
        data-testid="rest-timer-minus"
        testID="rest-timer-minus"
        className="relative items-center justify-center px-1 min-w-scaled-10 min-h-scaled-10"
        onPress={() => {
          trackClick("rest-timer-minus");
          props.dispatch(
            Thunk_updateTimer(timer - 15, nextEntryAndSetIndex?.entryIndex, nextEntryAndSetIndex?.setIndex, false)
          );
        }}
      >
        <View className="absolute inset-0 rounded-lg bg-background-default" style={{ opacity: 0.2 }} />
        <Text numberOfLines={1} className="font-bold text-text-alwayswhite" style={{ userSelect: "none" }}>
          -15s
        </Text>
      </Pressable>
      <Pressable
        data-testid="rest-timer-cancel"
        testID="rest-timer-cancel"
        className="relative items-center justify-center min-w-scaled-10 min-h-scaled-10"
        onPress={() => {
          trackClick("rest-timer-cancel");
          props.dispatch({ type: "StopTimer" });
        }}
      >
        <View className="absolute inset-0 rounded-lg bg-background-default" style={{ opacity: 0.2 }} />
        <IconTrash color="white" />
      </Pressable>
      <Pressable
        data-testid="rest-timer-expanded"
        testID="rest-timer-expanded"
        className="items-center justify-center flex-1"
        onPress={() => setIsExpanded(false)}
      >
        <Text
          numberOfLines={1}
          data-testid="rest-timer-current"
          className="text-2xl font-bold text-text-alwayswhite"
          style={{ userSelect: "none" }}
        >
          {elapsedText}
        </Text>
        <Text
          numberOfLines={1}
          data-testid="rest-timer-total"
          className={`text-sm ${totalColorClass}`}
          style={{ userSelect: "none" }}
        >
          {TimeUtils_formatMMSS(timer * 1000)}
        </Text>
      </Pressable>
      <Pressable
        data-testid="rest-timer-back"
        testID="rest-timer-back"
        className="relative items-center justify-center min-w-scaled-10 min-h-scaled-10"
        onPress={() => setIsExpanded(false)}
      >
        <View className="absolute inset-0 rounded-lg bg-background-default" style={{ opacity: 0.2 }} />
        <View style={{ transform: [{ rotate: "180deg" }] }}>
          <IconBack color="white" />
        </View>
      </Pressable>
      <Pressable
        data-testid="rest-timer-plus"
        testID="rest-timer-plus"
        className="relative items-center justify-center px-1 min-w-scaled-10 min-h-scaled-10"
        onPress={() => {
          trackClick("rest-timer-plus");
          props.dispatch(
            Thunk_updateTimer(timer + 15, nextEntryAndSetIndex?.entryIndex, nextEntryAndSetIndex?.setIndex, false)
          );
        }}
      >
        <View className="absolute inset-0 rounded-lg bg-background-default" style={{ opacity: 0.2 }} />
        <Text numberOfLines={1} className="font-bold text-text-alwayswhite" style={{ userSelect: "none" }}>
          +15s
        </Text>
      </Pressable>
    </View>
  );

  const collapsed = (
    <Pressable
      data-testid="rest-timer-collapsed"
      testID="rest-timer-collapsed"
      onPress={() => {
        trackClick("rest-timer-expand");
        setIsExpanded(true);
      }}
      className="items-center px-3 py-2 min-w-scaled-20"
    >
      <Text
        data-testid="rest-timer-current"
        numberOfLines={1}
        className="text-2xl font-bold text-center text-text-alwayswhite"
        style={{ minWidth: Math.ceil(RestTimerWidth_em(elapsedText) * TEXT_2XL_PX * remScale), userSelect: "none" }}
      >
        {elapsedText}
      </Text>
      <Text data-testid="rest-timer-total" numberOfLines={1} className={`text-sm ${totalColorClass} whitespace-nowrap`}>
        {TimeUtils_formatMMSS(timer * 1000)}
      </Text>
    </Pressable>
  );

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: animatedTargetBottom,
        zIndex: 30,
        opacity: animatedOpacity,
      }}
      pointerEvents={pointerEventsMode}
    >
      <Reanimated.View
        layout={RestTimerLayoutTransition}
        className={bgClass}
        style={[
          shadowStyle,
          { borderRadius: 8 },
          isExpanded ? { marginHorizontal: expandedSpacing * 2 } : { alignSelf: "flex-end", marginRight: 16 },
        ]}
      >
        <Reanimated.View layout={RestTimerLayoutTransition} style={{ borderRadius: 8, overflow: "hidden" }}>
          <Reanimated.View
            layout={RestTimerLayoutTransition}
            pointerEvents="none"
            style={[
              { position: "absolute", left: 0, right: 0, top: 0 },
              isExpanded ? { height: 5, opacity: 0.6 } : { bottom: 0, opacity: isTimeOut ? 0 : 0.3 },
            ]}
          >
            <Reanimated.View
              style={[
                {
                  flex: 1,
                  backgroundColor: isExpanded ? Tailwind_colors().white : Tailwind_colors().black,
                  transformOrigin: "left",
                },
                progressStyle,
              ]}
            />
          </Reanimated.View>
          <Reanimated.View
            key={isExpanded ? "expanded" : "collapsed"}
            entering={RestTimerContentEntering}
            exiting={RestTimerContentExiting}
          >
            {isExpanded ? expanded : collapsed}
          </Reanimated.View>
        </Reanimated.View>
      </Reanimated.View>
    </Animated.View>
  );
}

export function KeyboardRestTimer(): JSX.Element | null {
  const state = useTrackedState();
  const progress = Progress_getCurrentProgress(state);
  const timer = progress?.timer;
  const timerSince = progress?.timerSince;
  const pausedAt = History_pauseTime(progress?.intervals);
  useRestTimerTick(timerSince != null && pausedAt == null);

  if (timer == null || timerSince == null) {
    return null;
  }
  const { elapsedMs, isTimeOut } = RestTimerProgress_at(timerSince, timer, pausedAt ?? Date.now());
  return (
    <View pointerEvents="none" className="items-center absolute left-0 right-0 bottom-full mb-1">
      <Text
        data-testid="keyboard-rest-timer"
        testID="keyboard-rest-timer"
        numberOfLines={1}
        className={`text-xs font-bold ${isTimeOut ? "text-text-error" : "text-text-secondary"}`}
      >
        {RestTimer_formatCompact(elapsedMs)} /{RestTimer_formatCompact(timer * 1000)}
      </Text>
    </View>
  );
}
