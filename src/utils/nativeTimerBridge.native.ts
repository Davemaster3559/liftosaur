import NativeLiftosaurTimer from "../specs/NativeLiftosaurTimer";
import { INativeTimerStartParams, ITimerBridge } from "./timerBridge";

export type { INativeTimerStartParams } from "./timerBridge";

export class TimerBridge implements ITimerBridge {
  private readonly scheduledHandlers = new Set<
    (event?: { eventId?: string; deadline?: number; eventRevision?: number; scheduled: boolean }) => void
  >();

  public startTimer(params: INativeTimerStartParams): void {
    NativeLiftosaurTimer.startTimer(params)
      .then((result) => {
        this.scheduledHandlers.forEach((h) =>
          h({
            eventId: params.eventId,
            deadline: params.deadline,
            eventRevision: params.eventRevision,
            scheduled: !!result?.scheduled,
          })
        );
      })
      .catch((e) => {
        this.scheduledHandlers.forEach((h) =>
          h({
            eventId: params.eventId,
            deadline: params.deadline,
            eventRevision: params.eventRevision,
            scheduled: false,
          })
        );
        console.warn("NativeLiftosaurTimer.startTimer failed", e);
      });
  }

  public stopTimer(eventId?: string, eventRevision?: number): void {
    NativeLiftosaurTimer.stopTimer(eventId, eventRevision).catch(() => {});
  }

  public playSound(volume: number, vibration: boolean, sound: string, ignoreDoNotDisturb = false): boolean {
    NativeLiftosaurTimer.playSound(volume, vibration, sound, ignoreDoNotDisturb).catch(() => {});
    return true;
  }

  public subscribeOnScheduled(
    handler: (event?: { eventId?: string; deadline?: number; eventRevision?: number; scheduled: boolean }) => void
  ): () => void {
    this.scheduledHandlers.add(handler);
    return () => {
      this.scheduledHandlers.delete(handler);
    };
  }

  public scheduleReminder(duration: number, title: string, body: string): void {
    NativeLiftosaurTimer.scheduleReminder(duration, title, body).catch(() => {});
  }

  public cancelReminder(): void {
    NativeLiftosaurTimer.cancelReminder().catch(() => {});
  }
}
