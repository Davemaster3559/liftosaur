import type { IPercentage, IUnit, IWeight } from "../types";

export const POUNDS_TO_KILOGRAMS = 0.45359237;

export function LiftingUnits_convert(weight: IWeight, unit: IUnit): IWeight {
  return weight.unit === unit
    ? weight
    : { value: unit === "kg" ? weight.value * POUNDS_TO_KILOGRAMS : weight.value / POUNDS_TO_KILOGRAMS, unit };
}

export function LiftingUnits_same(a: IWeight | undefined, b: IWeight | undefined): boolean {
  return !!a && !!b && Math.abs(LiftingUnits_convert(a, "kg").value - LiftingUnits_convert(b, "kg").value) < 0.00001;
}

export function LiftingUnits_print(weight: IWeight, unit: IUnit = "lb"): string {
  const converted = LiftingUnits_convert(weight, unit);
  return `${+converted.value.toFixed(1)} ${unit}`;
}

export function LiftingUnits_commit(
  value: IWeight | IPercentage | undefined,
  original?: IWeight
): IWeight | IPercentage | undefined {
  if (
    value?.unit === "lb" &&
    original &&
    Math.abs(value.value - +LiftingUnits_convert(original, "lb").value.toFixed(2)) < 0.000001
  ) {
    return original;
  }
  return value;
}
