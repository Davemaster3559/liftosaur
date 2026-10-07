import type { JSX } from "react";
import { View } from "react-native";
import { IDispatch } from "../ducks/types";
import { IHistoryRecord, IProgram, ISettings } from "../types";
import { ExercisesList } from "./exercisesList";
import { Program_fullProgram } from "../models/program";
import { INavCommon } from "../models/state";
import { useNavOptions } from "../navigation/useNavOptions";
import { DevFitTitle } from "../devfit/ui";

interface IProps {
  dispatch: IDispatch;
  settings: ISettings;
  program: IProgram;
  history: IHistoryRecord[];
  navCommon: INavCommon;
}

export function ScreenExercises(props: IProps): JSX.Element {
  useNavOptions({ navTitle: "Exercises", navHelpKey: "exercises" });

  return (
    <View className="px-gutter">
      <View style={{ paddingVertical: 20 }}>
        <DevFitTitle
          title="Exercise library"
          subtitle="Find your movements, equipment and personal favorites. Custom exercises stay on your device."
        />
      </View>
      <ExercisesList
        isLoggedIn={!!props.navCommon.userId}
        dispatch={props.dispatch}
        settings={props.settings}
        program={Program_fullProgram(props.program, props.settings)}
        history={props.history}
      />
    </View>
  );
}
