function sortByName(champions) {
  return [...champions].sort((left, right) => left.name.localeCompare(right.name));
}

export class ChampionRepository {
  constructor(lcuClient, logger) {
    this.lcuClient = lcuClient;
    this.logger = logger;
    this.playableCache = null;
    this.playableRequest = null;
    this.allCache = null;
    this.allRequest = null;
  }

  static isPlayableChampion(champion) {
    if (!champion || champion.id <= 0) {
      return false;
    }

    if (champion.alias && champion.alias.startsWith("Ruby_")) {
      return false;
    }

    return true;
  }

  async getPlayableChampions(forceRefresh = false) {
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

  async getAllChampions() {
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

  clearPlayableCache() {
    this.playableCache = null;
  }

  async loadOwnedChampions() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const champions = await this.lcuClient.getOwnedChampions();
        if (Array.isArray(champions) && champions.length > 0) {
          this.playableCache = sortByName(champions.filter(ChampionRepository.isPlayableChampion));
          return this.playableCache;
        }
      } catch (error) {
        this.logger.log("owned champions request failed, attempt", attempt, error);
      }

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return this.playableCache ?? [];
  }

  async loadAllChampions() {
    try {
      const champions = await this.lcuClient.getChampionSummary();
      if (!Array.isArray(champions)) {
        return this.allCache ?? [];
      }

      const playable = champions.filter(ChampionRepository.isPlayableChampion);
      if (playable.length > 0) {
        this.allCache = sortByName(playable);
      }
      return this.allCache ?? [];
    } catch (error) {
      this.logger.log("all champions request failed", error);
      return this.allCache ?? [];
    }
  }
}
