import { DevFitConfig } from "../devfit/config";

export const HEALTH_ANDROID_PACKAGE_NAME = DevFitConfig.applicationId;

export function HealthAndroidFilter_isSelfOrigin(record: unknown): boolean {
  const meta = (record as { metadata?: { dataOrigin?: string } } | undefined)?.metadata;
  return meta?.dataOrigin === HEALTH_ANDROID_PACKAGE_NAME;
}
