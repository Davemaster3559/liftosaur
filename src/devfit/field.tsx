import { JSX } from "react";
import { View, TextInput } from "react-native";
import { Text } from "../components/primitives/text";
import { Tailwind_semantic } from "../utils/tailwindConfig";

export function DevFitField(props: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  numeric?: boolean;
  testID?: string;
  editable?: boolean;
  placeholder?: string;
}): JSX.Element {
  const c = Tailwind_semantic().devfit;
  return (
    <View style={{ gap: 6, flexGrow: 1, minWidth: 120 }}>
      <Text className="text-sm" style={{ color: c.muted }}>
        {props.label}
      </Text>
      <TextInput
        accessibilityLabel={props.label}
        testID={props.testID}
        data-cy={props.testID}
        value={props.value}
        onChangeText={props.onChange}
        editable={props.editable}
        keyboardType={props.numeric ? "decimal-pad" : "default"}
        autoCapitalize="none"
        placeholder={props.placeholder ?? "Not recorded"}
        placeholderTextColor={c.muted}
        style={{
          color: c.ink,
          backgroundColor: c.surface,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: 12,
          minHeight: 52,
          padding: 12,
        }}
      />
    </View>
  );
}
