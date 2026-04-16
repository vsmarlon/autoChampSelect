import { useSyncExternalStore } from "react";
import { ChampionRepository } from "../core/ChampionRepository";
import { ChampionSummary } from "../core/lcu/types";

export function useAllChampions(repository: ChampionRepository): ChampionSummary[] {
  return useSyncExternalStore(
    (onStoreChange) => repository.subscribe(onStoreChange),
    () => repository.getAllSnapshot(),
  );
}

export function usePlayableChampions(repository: ChampionRepository): ChampionSummary[] {
  return useSyncExternalStore(
    (onStoreChange) => repository.subscribe(onStoreChange),
    () => repository.getPlayableSnapshot(),
  );
}
