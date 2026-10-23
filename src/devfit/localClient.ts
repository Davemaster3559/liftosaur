import { DevFitConfig } from "./config";

export function DevFit_localClient(client: Window["fetch"]): Window["fetch"] {
  return async (input, init) => {
    const address = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(address);
    if (
      !DevFitConfig.officialCloudEnabled &&
      (url.hostname === "liftosaur.com" || url.hostname.endsWith(".liftosaur.com")) &&
      url.pathname.startsWith("/api/")
    ) {
      throw new Error("Liftosaur cloud services are disabled in DevFit. Use local import and export in Me.");
    }
    return client(input, init);
  };
}
