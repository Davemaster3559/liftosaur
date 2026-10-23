export type INativeTimerStartParams = {
  duration: number;
  title: string;
  subtitleHeader: string;
  subtitle: string;
  bodyHeader: string;
  body: string;
  volume: number;
  vibration: boolean;
  ignoreDoNotDisturb: boolean;
  timerSinceMs: number;
  timerSeconds: number;
  eventId?: string;
  eventRevision?: number;
  deadline?: number;
};

export interface ITimerBridge {
  startTimer(params: INativeTimerStartParams): void;
  stopTimer(eventId?: string, eventRevision?: number): void;
  playSound(volume: number, vibration: boolean, sound: string, ignoreDoNotDisturb?: boolean): boolean;
  subscribeOnScheduled(
    handler: (event?: { eventId?: string; deadline?: number; eventRevision?: number; scheduled: boolean }) => void
  ): () => void;
  scheduleReminder(duration: number, title: string, body: string): void;
  cancelReminder(): void;
}
