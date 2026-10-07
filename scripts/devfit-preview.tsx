// Isolated visual fixture. Uses the production screen components, never reads or writes user storage.
import { ContextType, JSX, useState } from "react";
import { createRoot } from "react-dom/client";
import { View } from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DevFitToday } from "../src/devfit/today";
import { DevFitSchedule } from "../src/devfit/scheduleScreen";
import { DevFitWorkout } from "../src/devfit/workout";
import { DevFitProgress } from "../src/devfit/progressScreen";
import { DevFitMe } from "../src/devfit/me";
import { DevFitFinish } from "../src/devfit/finishScreen";
import { DevFitCardioTimer } from "../src/devfit/cardioTimer";
import { DevFitRotation_fixture } from "../test/fixtures/devfitRotation";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Program_evaluate, Program_nextHistoryRecord } from "../src/models/program";
import { Rem_set } from "../src/utils/useRem";
import { IDispatch } from "../src/ducks/types";
import { DevFitAction } from "../src/devfit/ui";
import { Footer2View } from "../src/components/footer2";
import { IHistoryRecord } from "../src/types";

const { program, schedule } = DevFitRotation_fixture();
const settings = { ...Settings_build(), devfitSchedules: { [program.id]: schedule } };
const stats = Stats_getEmpty();
const evaluated = Program_evaluate(program, settings);
const progress = Program_nextHistoryRecord(program, settings, stats);
const history: IHistoryRecord[] = [3, 6, 9].map((ago, index) => ({
  ...Program_nextHistoryRecord(program, settings, stats),
  vtype: "history_record",
  id: index + 1,
  startTime: Date.now() - ago * 86400000,
  endTime: Date.now() - ago * 86400000 + 3600000,
  entries: progress.entries.map((e) => ({
    ...e,
    sets: e.sets.map((s) => ({
      ...s,
      isCompleted: true,
      completedReps: s.reps,
      completedWeight: s.weight,
      completedSetTimer: s.setTimer,
    })),
  })),
}));
progress.entries[0].warmupSets.forEach((s) => {
  s.isCompleted = true;
});
progress.entries[0].sets[0] = {
  ...progress.entries[0].sets[0],
  isCompleted: true,
  completedWeight: progress.entries[0].sets[0].weight,
  completedReps: 12,
};
const noop = (): void => {};
const dispatch: IDispatch = () => {};
const navigation = { setOptions: noop, isFocused: () => true, addListener: () => noop } as unknown as NonNullable<
  ContextType<typeof NavigationContext>
>;
const subscription = { apple: [], google: [] };
const cardio = Program_nextHistoryRecord({ ...program, nextDay: 1 }, settings, stats);

function Preview(): JSX.Element {
  const [screen, setScreen] = useState("Today");
  const [dark, setDark] = useState(true);
  const [large, setLarge] = useState(false);
  const navCommon = { currentProgram: program, settings, stats, isOngoingProgress: false, loading: { items: {} } };
  return (
    <SafeAreaProvider>
      <NavigationContext.Provider value={navigation}>
        <div
          style={{
            fontFamily: "sans-serif",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            padding: 8,
            background: "#202635",
            color: "white",
          }}
        >
          {["Today", "Workout", "Schedule", "Progress", "Me", "Cardio", "Finish"].map((name) => (
            <button
              key={name}
              onClick={() => setScreen(name)}
              style={{
                minHeight: 36,
                background: name === screen ? "#C1ADFF" : "#30394B",
                color: name === screen ? "#211639" : "white",
                border: 0,
                borderRadius: 8,
                padding: "6px 10px",
              }}
            >
              {name}
            </button>
          ))}
          <button
            onClick={() => {
              document.documentElement.classList.toggle("dark", !dark);
              setDark(!dark);
            }}
          >
            {dark ? "Light theme" : "Dark theme"}
          </button>
          <button
            onClick={() => {
              Rem_set(large ? 16 : 24);
              setLarge(!large);
            }}
          >
            {large ? "Normal text" : "Large text"}
          </button>
          <span style={{ padding: 6, fontSize: 11 }}>EXAMPLE DATA · VISUAL PREVIEW</span>
        </div>
        <View style={{ flex: 1 }}>
          {screen === "Today" && (
            <DevFitToday
              program={program}
              settings={settings}
              stats={stats}
              history={history}
              onStart={() => setScreen("Workout")}
              onSchedule={() => setScreen("Schedule")}
              onProgress={() => setScreen("Progress")}
              onHistory={noop}
              onChooseDay={noop}
            />
          )}
          {screen === "Schedule" && (
            <DevFitSchedule
              program={program}
              settings={settings}
              history={history}
              dispatch={dispatch}
              isOngoing={false}
            />
          )}
          {screen === "Workout" && (
            <DevFitWorkout
              progress={progress}
              history={history}
              program={evaluated}
              settings={settings}
              subscription={subscription}
              dispatch={dispatch}
              onAdvanced={noop}
              finish={<DevFitAction label="Finish workout" onPress={() => setScreen("Finish")} />}
            />
          )}
          {screen === "Progress" && (
            <DevFitProgress
              program={program}
              settings={settings}
              stats={stats}
              history={history}
              onGraphs={noop}
              onMeasurements={noop}
              onInsights={noop}
            />
          )}
          {screen === "Me" && <DevFitMe settings={settings} dispatch={dispatch} onSettings={noop} />}
          {screen === "Cardio" && (
            <View style={{ flex: 1, padding: 16, backgroundColor: dark ? "#090B10" : "#F4F5F9" }}>
              <DevFitCardioTimer
                entry={cardio.entries[0]}
                exercise={Program_evaluate({ ...program, nextDay: 1 }, settings).weeks[0].days[0].exercises[0]}
                settings={settings}
                setIndex={0}
                elapsedSeconds={642}
                target={1800}
                completed={false}
                onStart={noop}
                onRecord={noop}
                onKeepTiming={noop}
                onClose={noop}
              />
            </View>
          )}
          {screen === "Finish" && (
            <DevFitFinish
              record={history[0]}
              history={history}
              settings={settings}
              stats={stats}
              program={program}
              onDetails={noop}
              onToday={() => setScreen("Today")}
            />
          )}
        </View>
        <Footer2View
          navCommon={navCommon}
          dispatch={dispatch}
          currentTab={
            screen === "Schedule"
              ? "program"
              : screen === "Progress"
                ? "graphs"
                : screen === "Me"
                  ? "me"
                  : screen === "Workout"
                    ? "workout"
                    : "home"
          }
        />
      </NavigationContext.Provider>
    </SafeAreaProvider>
  );
}
document.documentElement.classList.add("dark");
Rem_set(16);
createRoot(document.getElementById("root")!).render(<Preview />);
