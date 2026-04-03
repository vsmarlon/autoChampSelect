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
    try {
      const champions = await this.lcuClient.getOwnedChampions();
      if (!Array.isArray(champions)) {
        return this.playableCache ?? [];
      }

      this.playableCache = sortByName(champions);
      return this.playableCache;
    } catch (error) {
      this.logger.log("owned champions request failed", error);
      return this.playableCache ?? [];
    }
  }

  async loadAllChampions() {
    try {
      const champions = await this.lcuClient.getChampionSummary();
      if (!Array.isArray(champions)) {
        return this.allCache ?? [];
      }

      this.allCache = sortByName(champions);
      return this.allCache;
    } catch (error) {
      this.logger.log("all champions request failed", error);
      return this.allCache ?? [];
    }
  }
}
