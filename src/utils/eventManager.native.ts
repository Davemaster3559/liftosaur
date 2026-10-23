export function EventManager_isAvailable(): boolean {
  return true;
}

export function EventManager_log(_data: string): void {}

export async function EventManager_flush(): Promise<void> {}

export type IEventManagerTelemetryHandler = (event: {
  name: string;
  timestamp: number;
  extra: Record<string, string>;
}) => void;

export function EventManager_initTelemetry(_handler: IEventManagerTelemetryHandler): void {}
