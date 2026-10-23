import { ContextType, JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { View } from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { lb } from "lens-shmens";
import { DevFitToday } from "../src/devfit/today";
import { DevFitSchedule } from "../src/devfit/scheduleScreen";
import { DevFitWorkout } from "../src/devfit/workout";
import { DevFitProgress } from "../src/devfit/progressScreen";
import { DevFitFinish } from "../src/devfit/finishScreen";
import { DevFitCardioTimer } from "../src/devfit/cardioTimer";
import { DevFitCardioLog } from "../src/devfit/cardioLog";
import { DevFitCardioCharts } from "../src/devfit/cardioCharts";
import { DevFitTrainingDateChoice } from "../src/devfit/trainingDateChoice";
import { DevFitField } from "../src/devfit/field";
import { DevFitAction, DevFitSurface, DevFitTitle } from "../src/devfit/ui";
import { DevFitPage } from "../src/devfit/page";
import { DevFitPersonalPlan_fixture } from "../test/fixtures/devfitPersonalPlan";
import { MockBridges_build } from "../test/utils/mockBridges";
import { Storage_getDefault } from "../src/models/storage";
import { Program_evaluate, Program_getListOfDays, Program_getProgramExercise } from "../src/models/program";
import { History_clockNow, History_isPaused } from "../src/models/history";
import { buildState, IEnv, IState } from "../src/models/state";
import { reducer } from "../src/ducks/reducer";
import { IDispatch } from "../src/ducks/types";
import { Thunk_checkSetTimer, Thunk_pauseWorkout, Thunk_recordSetTimer } from "../src/ducks/thunks";
import { CardioActions_phase } from "../src/devfit/cardioActions";
import { NativeEffects_apply } from "../src/models/nativeEffects";
import { AudioInterface } from "../src/lib/audioInterface";
import { DevFitService } from "../src/devfit/service";
import { Persistence } from "../src/utils/persistence";
import { AsyncQueue } from "../src/utils/asyncQueue";
import { HeartRateStore } from "../src/utils/heartRateStore";
import { Schedule_anchor } from "../src/devfit/schedule";
import { Rem_set } from "../src/utils/useRem";

const bridges = MockBridges_build();
const env: IEnv = {
  ...bridges,
  service: new DevFitService(async () => {
    throw new Error("Preview has no network service");
  }),
  audio: new AudioInterface(bridges.timer),
  persistence: new Persistence(),
  queue: new AsyncQueue(),
  heartRate: new HeartRateStore(bridges.mirroring),
};
const navigation = {
  setOptions: () => {},
  isFocused: () => true,
  addListener: () => () => {},
} as unknown as NonNullable<ContextType<typeof NavigationContext>>;

function initial(): IState {
  const { program, schedule } = DevFitPersonalPlan_fixture();
  const storage = Storage_getDefault();
  storage.programs = [program];
  storage.currentProgramId = program.id;
  storage.settings.devfitSchedules = { [program.id]: Schedule_anchor(schedule, 3, Date.now()) };
  return buildState({ storage, nosync: true, deviceId: "isolated-browser-fixture" });
}

function LiveCardio(props: { state: IState; dispatch: IDispatch }): JSX.Element | null {
  const progress = props.state.storage.progress[0];
  const clock = progress?.setTimer ?? progress?.setTimerGetReady;
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  if (!clock || !progress) {
    return null;
  }
  const entry = progress.entries[clock.entryIndex];
  const set = entry.sets[clock.setIndex];
  const program = props.state.storage.programs.find((p) => p.id === progress.programId)!;
  const exercise = Program_getProgramExercise(
    progress.day,
    Program_evaluate(program, props.state.storage.settings),
    entry.programExerciseId
  );
  const elapsed = Math.max(0, (History_clockNow(progress) - clock.startedAt) / 1000);
  const phase = set.cardioLaps?.slice(-1)[0]?.phase ?? "walk";
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 20, overflow: "scroll" }}>
      <DevFitCardioTimer
        entry={entry}
        exercise={exercise}
        settings={props.state.storage.settings}
        setIndex={clock.setIndex}
        elapsedSeconds={elapsed}
        target={set.setTimer ?? 0}
        completed={!!set.isCompleted}
        paused={History_isPaused(progress.intervals)}
        onStart={() => props.dispatch({ type: "StartSetTimerWorkAction" })}
        onRecord={() =>
          props.dispatch(Thunk_recordSetTimer(clock.entryIndex, clock.setIndex, false, elapsed, clock.id))
        }
        onKeepTiming={() =>
          props.dispatch(Thunk_recordSetTimer(clock.entryIndex, clock.setIndex, true, elapsed, clock.id))
        }
        onClose={() => props.dispatch({ type: "CloseSetTimerAction", isPlayground: false })}
        onResume={() => props.dispatch({ type: "ResumeWorkoutAction", isPlayground: false, hasSubscription: false })}
        onSwitchPhase={() =>
          props.dispatch(
            CardioActions_phase({
              entryIndex: clock.entryIndex,
              setIndex: clock.setIndex,
              setId: set.id,
              phaseId: clock.id,
              expectedPhase: phase,
              kind: "switch",
            })
          )
        }
        onPhaseSettings={(value) =>
          props.dispatch(
            CardioActions_phase({
              entryIndex: clock.entryIndex,
              setIndex: clock.setIndex,
              setId: set.id,
              phaseId: clock.id,
              expectedPhase: phase,
              kind: "settings",
              value,
            })
          )
        }
      />
      <DevFitAction
        secondary
        label={History_isPaused(progress.intervals) ? "Resume workout" : "Pause workout"}
        onPress={() =>
          History_isPaused(progress.intervals)
            ? props.dispatch({ type: "ResumeWorkoutAction", isPlayground: false, hasSubscription: false })
            : props.dispatch(Thunk_pauseWorkout())
        }
      />
    </View>
  );
}

function Preview(): JSX.Element {
  const [state, setState] = useState(initial);
  const current = useRef(state);
  const [screen, setScreen] = useState("Today");
  const [large, setLarge] = useState(false);
  const dispatch: IDispatch = useCallback((action) => {
    if (typeof action === "function") {
      return action(dispatch, () => current.current, env);
    }
    const effects: Parameters<typeof NativeEffects_apply>[1][number][] = [];
    current.current = reducer(current.current, action, effects);
    NativeEffects_apply(env, effects);
    setState(current.current);
    return undefined;
  }, []);
  useEffect(() => {
    const timer = setInterval(() => dispatch(Thunk_checkSetTimer()), 1000);
    return () => clearInterval(timer);
  }, [dispatch]);
  const storage = state.storage;
  const program = storage.programs[0];
  const progress = storage.progress[0];
  const evaluated = useMemo(() => Program_evaluate(program, storage.settings), [program, storage.settings]);
  function start(day?: number): void {
    if (!progress) {
      if (day) {
        dispatch({
          type: "UpdateState",
          desc: "Choose example day",
          lensRecording: [lb<IState>().p("storage").p("programs").i(0).p("nextDay").record(day)],
        });
      }
      dispatch({ type: "StartProgramDayAction", programId: program.id });
    }
    setScreen("Workout");
  }
  const show =
    (name: string): (() => void) =>
    () =>
      setScreen(name);
  function finish(): void {
    dispatch({ type: "FinishProgramDayAction", id: 0 });
    setScreen("Finish");
  }
  return (
    <SafeAreaProvider>
      <NavigationContext.Provider value={navigation}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, background: "#202635", color: "white" }}>
          {["Today", "Workout", "Schedule", "Progress", "Cardio", "History", "Choose day"].map((name) => (
            <button key={name} onClick={show(name)} style={{ minHeight: 44, padding: 10 }}>
              {name}
            </button>
          ))}
          <button
            onClick={() => {
              Rem_set(large ? 16 : 24);
              setLarge(!large);
            }}
          >
            Text {large ? "normal" : "large"}
          </button>
          <button
            onClick={() => {
              const next = initial();
              current.current = next;
              setState(next);
              setScreen("Today");
            }}
          >
            Reset example profile
          </button>
          <span>EXAMPLE PROFILE · memory only · simulated native bridges</span>
        </div>
        <View style={{ flex: 1 }}>
          {screen === "Today" && (
            <DevFitToday
              program={program}
              settings={storage.settings}
              stats={storage.stats}
              history={storage.history}
              progress={progress}
              dispatch={dispatch}
              onStart={start}
              onSchedule={show("Schedule")}
              onProgress={show("Progress")}
              onHistory={show("History")}
              onChooseDay={show("Choose day")}
            />
          )}
          {screen === "Schedule" && (
            <DevFitSchedule
              program={program}
              settings={storage.settings}
              history={storage.history}
              dispatch={dispatch}
              isOngoing={!!progress}
            />
          )}
          {screen === "Workout" &&
            (progress ? (
              <DevFitWorkout
                progress={progress}
                history={storage.history}
                program={evaluated}
                settings={storage.settings}
                subscription={storage.subscription}
                dispatch={dispatch}
                onAdvanced={show("Tools")}
                finish={<DevFitAction label="Finish workout" onPress={finish} />}
              />
            ) : (
              <DevFitPage>
                <DevFitAction label="Choose a training day" onPress={show("Choose day")} />
              </DevFitPage>
            ))}
          {screen === "Progress" && (
            <DevFitProgress
              program={program}
              settings={storage.settings}
              stats={storage.stats}
              history={storage.history}
              dispatch={dispatch}
              onGraphs={show("Charts")}
              onMeasurements={show("Body")}
              onInsights={show("History")}
            />
          )}
          {screen === "Cardio" && (
            <DevFitPage>
              <DevFitCardioLog
                program={program}
                settings={storage.settings}
                history={storage.history}
                dispatch={dispatch}
              />
              <DevFitAction label="Start Run A" onPress={() => start(1)} />
              <DevFitCardioCharts history={storage.history} settings={storage.settings} />
            </DevFitPage>
          )}
          {screen === "Choose day" && (
            <DevFitPage>
              <DevFitTitle title={progress ? "Continue your active workout" : "Choose a day"} />
              {Program_getListOfDays(evaluated).map(([day, name]) => (
                <DevFitAction key={day} secondary label={name} onPress={() => start(Number(day))} />
              ))}
            </DevFitPage>
          )}
          {screen === "History" && (
            <DevFitPage>
              <DevFitTitle title="Example history" />
              {storage.history.map((record) => (
                <DevFitSurface key={record.id}>
                  <DevFitTitle title={record.dayName} />
                  <DevFitTrainingDateChoice record={record} dispatch={dispatch} />
                </DevFitSurface>
              ))}
              <DevFitCardioLog
                program={program}
                settings={storage.settings}
                history={storage.history}
                dispatch={dispatch}
              />
            </DevFitPage>
          )}
          {screen === "Charts" && (
            <DevFitPage>
              <DevFitCardioCharts history={storage.history} settings={storage.settings} />
              <DevFitAction label="Back to Progress" onPress={show("Progress")} />
            </DevFitPage>
          )}
          {screen === "Tools" && progress && (
            <DevFitPage>
              <DevFitField
                label="Workout notes"
                value={progress.notes ?? ""}
                onChange={(notes) =>
                  dispatch({
                    type: "UpdateState",
                    desc: "Example notes",
                    lensRecording: [lb<IState>().p("storage").p("progress").i(0).p("notes").record(notes)],
                  })
                }
              />
              <DevFitAction label="Back to workout" onPress={show("Workout")} />
              <DevFitAction label="Finish workout" onPress={finish} />
            </DevFitPage>
          )}
          {screen === "Body" && (
            <DevFitPage>
              <DevFitTitle
                title="Body measurements"
                subtitle="Use the Android app to access the complete measurement logger. This isolated fixture has no personal measurements."
              />
              <DevFitAction label="Back to Progress" onPress={show("Progress")} />
            </DevFitPage>
          )}
          {screen === "Finish" && storage.history[0] && (
            <DevFitFinish
              record={storage.history[0]}
              history={storage.history}
              settings={storage.settings}
              stats={storage.stats}
              program={program}
              onDetails={show("History")}
              onToday={show("Today")}
            />
          )}
          {progress?.setTimer && <LiveCardio state={state} dispatch={dispatch} />}
        </View>
      </NavigationContext.Provider>
    </SafeAreaProvider>
  );
}
document.documentElement.classList.add("dark");
Rem_set(16);
createRoot(document.getElementById("root")!).render(<Preview />);
