import { JSX, ReactNode } from "react";
import { View } from "react-native";
import { NavScreenContent } from "../navigation/NavScreenContent";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { useDevFitLayout } from "./ui";

export function DevFitPage(props: { children: ReactNode; testID?: string }): JSX.Element {
  const layout = useDevFitLayout();
  return (
    <NavScreenContent avoidSystemKeyboard>
      <View testID={props.testID} style={{ backgroundColor: Tailwind_semantic().devfit.canvas, flexGrow: 1 }}>
        <View
          style={{
            width: "100%",
            maxWidth: layout.maxWidth,
            alignSelf: "center",
            padding: layout.gutter,
            gap: 24,
            paddingBottom: 40,
          }}
        >
          {props.children}
        </View>
      </View>
    </NavScreenContent>
  );
}
