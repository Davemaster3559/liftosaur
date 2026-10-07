const localCapabilities = {
  graphs: true,
  plates: true,
  muscles: true,
  insights: true,
  notifications: true,
} as const;

export type ILocalCapability = keyof typeof localCapabilities;

export function Capabilities_hasLocal(feature: ILocalCapability): boolean {
  return Object.prototype.hasOwnProperty.call(localCapabilities, feature) && localCapabilities[feature] === true;
}
