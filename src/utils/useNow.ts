import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { ITrainingConfig, TrainingDate_bounds, TrainingDate_key } from "../devfit/trainingDates";

export function useNow(boundary?: ITrainingConfig): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = (): void => setNow(Date.now());
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleBoundary = (): void => {
      if (!boundary) {
        return;
      }
      const current = Date.now();
      const date = TrainingDate_key(current, boundary.timeZone, boundary.rolloverMinutes);
      const { end } = TrainingDate_bounds(date, boundary.timeZone, boundary.rolloverMinutes);
      boundaryTimer = setTimeout(
        () => {
          refresh();
          scheduleBoundary();
        },
        Math.max(1, end - current)
      );
    };
    scheduleBoundary();
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        if (boundaryTimer) {
          clearTimeout(boundaryTimer);
        }
        scheduleBoundary();
      }
    });
    return () => {
      clearInterval(timer);
      if (boundaryTimer) {
        clearTimeout(boundaryTimer);
      }
      listener.remove();
    };
  }, [boundary?.timeZone, boundary?.rolloverMinutes]);
  return now;
}
