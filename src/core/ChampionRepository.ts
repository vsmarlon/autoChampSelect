import { ChampionSummary } from "./lcu/types";
import { LcuClient } from "./LcuClient";
import { Logger } from "./Logger";

const EMPTY_CHAMPIONS: ChampionSummary[] = [];
const OWNED_CHAMPION_RETRY_DELAYS_MS = [500, 1500] as const;
const ALL_CHAMPION_RETRY_DELAYS_MS = [500] as const;

function sortByName(champions: ChampionSummary[]): ChampionSummary[] {
  return [...champions].sort((left, right) => left.name.localeCompare(right.name));
}

export class ChampionRepository {
  private lcuClient: LcuClient;
  private logger: Logger;
  private playableCache: ChampionSummary[] | null = null;
  private playableRequest: Promise<ChampionSummary[]> | null = null;
  private allCache: ChampionSummary[] | null = null;
  private allRequest: Promise<ChampionSummary[]> | null = null;
  private listeners = new Set<() => void>();

  constructor(lcuClient: LcuClient, logger: Logger) {
    this.lcuClient = lcuClient;
    this.logger = logger;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAllSnapshot(): ChampionSummary[] {
    return this.allCache ?? EMPTY_CHAMPIONS;
  }

  getPlayableSnapshot(): ChampionSummary[] {
    return this.playableCache ?? EMPTY_CHAMPIONS;
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  static isPlayableChampion(champion: ChampionSummary | null): boolean {
    if (!champion || champion.id <= 0) {
      return false;
    }

    if (champion.alias && champion.alias.startsWith("Ruby_")) {
      return false;
    }

    return true;
  }

  async getPlayableChampions(forceRefresh = false): Promise<ChampionSummary[]> {
    if (forceRefresh) {
      this.playableCache = null;
    }

    if (this.playableCache) {
      return this.playableCache;
    }

    if (this.playableRequest) {
      return this.playableRequest;
    }

    this.playableRequest = this.loadOwnedChampions().finally(() => {
      this.playableRequest = null;
    });

    return this.playableRequest;
  }

  async getAllChampions(): Promise<ChampionSummary[]> {
    if (this.allCache) {
      return this.allCache;
    }

    if (this.allRequest) {
      return this.allRequest;
    }

    this.allRequest = this.loadAllChampions().finally(() => {
      this.allRequest = null;
    });

    return this.allRequest;
  }

  clearPlayableCache(): void {
    this.playableCache = null;
  }

  private async loadOwnedChampions(): Promise<ChampionSummary[]> {
    for (let attempt = 0; attempt <= OWNED_CHAMPION_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const champions = await this.lcuClient.getOwnedChampions();
        if (Array.isArray(champions) && champions.length > 0) {
          this.playableCache = sortByName(champions.filter(ChampionRepository.isPlayableChampion));
          this.notify();
          return this.playableCache;
        }
      } catch (error) {
        if (attempt === OWNED_CHAMPION_RETRY_DELAYS_MS.length) {
          this.logger.log("owned champions request failed", error);
        }
      }

      if (attempt < OWNED_CHAMPION_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, OWNED_CHAMPION_RETRY_DELAYS_MS[attempt]));
      }
    }

    return this.playableCache ?? [];
  }

  private async loadAllChampions(): Promise<ChampionSummary[]> {
    for (let attempt = 0; attempt <= ALL_CHAMPION_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const champions = await this.lcuClient.getChampionSummary();
        if (!Array.isArray(champions) || champions.length === 0) {
          throw new Error("Champion summary endpoint returned empty payload");
        }

        const playable = champions.filter(ChampionRepository.isPlayableChampion);
        this.allCache = sortByName(playable);
        this.notify();
        return this.allCache;
      } catch (error) {
        if (attempt === ALL_CHAMPION_RETRY_DELAYS_MS.length) {
          this.logger.log("champion summary request failed", error);
        }
      }

      if (attempt < ALL_CHAMPION_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, ALL_CHAMPION_RETRY_DELAYS_MS[attempt]));
      }
    }

    return this.allCache ?? EMPTY_CHAMPIONS;
  }
}
