import { ChampionSummary } from "../core/lcu/types";

export function sortByName(champions: ChampionSummary[]): ChampionSummary[] {
  return [...champions].sort((left, right) => left.name.localeCompare(right.name));
}
