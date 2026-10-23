import { Platform } from "react-native";
import { DevFitService } from "../devfit/service";
import { AudioInterface } from "../lib/audioInterface";
import { IEnv } from "../models/state";
import { navigationRef } from "../navigation/navigationRef";
import { getCurrentScreenData } from "../navigation/navigationService";
import NativeLiftosaurPush from "../specs/NativeLiftosaurPush";
import { AsyncQueue } from "./asyncQueue";
import { HealthAdapter } from "./health";
import { IapAdapter } from "./iap";
import { Keychain } from "./keychainStore";
import { TimerBridge } from "./nativeTimerBridge";
import { WatchBridge } from "./nativeWatchBridge";
import { WorkoutBridge } from "./nativeWorkoutBridge";
import { WorkoutMirroring } from "./nativeWorkoutMirroringBridge";
import { HeartRateStore } from "./heartRateStore";
import { Persistence } from "./persistence";
import { PushSyncClient } from "./pushSyncClient";
import { DevFitConfig } from "../devfit/config";

export function AppEnv_build(persistence: Persistence): IEnv {
  const service = new DevFitService(fetch);
  const timer = new TimerBridge();
  const mirroring = new WorkoutMirroring();
  return {
    service,
    audio: new AudioInterface(timer),
    queue: new AsyncQueue(),
    persistence,
    navigationRef,
    getCurrentScreenData,
    iap: DevFitConfig.storeEnabled ? new IapAdapter() : undefined,
    health: new HealthAdapter(),
    push: DevFitConfig.officialCloudEnabled
      ? new PushSyncClient(service, NativeLiftosaurPush, Platform.OS === "ios" ? "ios" : "android")
      : undefined,
    timer,
    mirroring,
    heartRate: new HeartRateStore(mirroring),
    workout: new WorkoutBridge(timer),
    watch: new WatchBridge(),
    keychain: new Keychain(),
  };
}
