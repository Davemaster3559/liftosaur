const ignore = (): void => undefined;

export function DevFit_installDiagnostics(): void {
  (globalThis as unknown as { Rollbar: unknown }).Rollbar = {
    error: ignore,
    warning: ignore,
    warn: ignore,
    info: ignore,
    debug: ignore,
    critical: ignore,
    log: ignore,
    configure: ignore,
  };
}
