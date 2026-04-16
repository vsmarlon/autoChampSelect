import { Lane } from "../core/lcu/types";

export function getEffectiveValues(
  values: number[],
  laneValues: Record<Lane, number[]>,
  laneEnabled: boolean,
  activeLane: Lane,
): number[] {
  if (!laneEnabled) return values;

  const activeValues = laneValues[activeLane];
  return activeValues && activeValues.some((v) => v !== 0) ? activeValues : values;
}
