import { useSyncExternalStore } from "react";
import { ChampionRepository } from "../core/ChampionRepository";
import { ChampionSummary } from "../core/lcu/types";

/**
 * A hook that provides reactive access to the champion repository.
 * Eliminates the need for 'useEffect' for loading champions.
 */
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
