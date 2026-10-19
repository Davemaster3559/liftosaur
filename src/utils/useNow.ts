import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = (): void => setNow(Date.now());
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  return now;
}
