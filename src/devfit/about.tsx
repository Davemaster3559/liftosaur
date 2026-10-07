import type { JSX } from "react";
import { View, Pressable, Linking } from "react-native";
import { Text } from "../components/primitives/text";
import { DevFitConfig } from "./config";

export function DevFitAbout(): JSX.Element {
  return (
    <View className="py-4 gap-3" testID="devfit-about">
      <Text className="text-xl font-bold text-text-primary">DevFit</Text>
      <Text className="text-sm text-text-secondary">
        Your training stays on this device. No account or subscription is needed. Back up your data with JSON export.
      </Text>
      <Text className="text-sm text-text-secondary">
        Graphs, muscle analysis, insights, plates and workout notifications are available locally.
        Health Connect is optional. Analytics, cloud sync and automatic code updates are disabled.
      </Text>
      <Text className="text-sm text-text-secondary">Based on Liftosaur by Anton Astashov. Licensed under AGPL-3.0.</Text>
      {[
        ["DevFit source code", `${DevFitConfig.sourceUrl}/tree/devfit`],
        ["Open-source license", `${DevFitConfig.sourceUrl}/blob/devfit/LICENSE`],
        ["Liftosaur source and attribution", DevFitConfig.upstreamUrl],
        ["Liftoscript documentation", "https://www.liftosaur.com/doc"],
      ].map(([label, url]) => (
        <Pressable key={label} accessibilityRole="link" style={{ minHeight: 48, justifyContent: "center" }}
          onPress={() => Linking.openURL(url).catch(() => undefined)}>
          <Text className="text-base text-text-link">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
