import {
  getActionsToProcess,
  getLocalPlayer,
  getPendingPickAction,
  getSessionSnapshot,
  isChampionPicked,
  selectChampionId,
} from "./selection.js";

export class ChampSelectController {
  constructor(configStore, lcuClient, championRepository, logger) {
    this.configStore = configStore;
    this.lcuClient = lcuClient;
    this.championRepository = championRepository;
    this.logger = logger;
    this.sessionProcessing = false;
    this.pendingSession = null;
    this.latestSession = null;
    this.declaredPickIntent = null;
  }

  reset() {
    this.declaredPickIntent = null;
  }

  clearSession() {
    this.declaredPickIntent = null;
    this.latestSession = null;
    this.pendingSession = null;
  }

  reprocessLatestSession() {
    if (!this.latestSession) {
      return;
    }

    this.queueSession(this.latestSession);
  }

  async queueSession(session) {
    this.pendingSession = session;
    this.latestSession = session;

    if (this.sessionProcessing) {
      return;
    }

    this.sessionProcessing = true;
    try {
      while (this.pendingSession) {
        const nextSession = this.pendingSession;
        this.pendingSession = null;
        await this.handleSession(nextSession);
      }
    } finally {
      this.sessionProcessing = false;
    }
  }

  async handleSession(session) {
    if (!session) {
      return;
    }

    const pickEnabled = this.configStore.get("auto-pick");
    const banEnabled = this.configStore.get("auto-ban");
    if (!pickEnabled && !banEnabled) {
      return;
    }

    const snapshot = getSessionSnapshot(session);
    if (this.declaredPickIntent && snapshot.bannedChampionIds.includes(this.declaredPickIntent)) {
      this.declaredPickIntent = null;
    }

    if (pickEnabled) {
      await this.declarePickIntent(session, snapshot);
    }

    for (const action of getActionsToProcess(session)) {
      await this.handleAction(action, session, snapshot);
    }
  }

  getChampionList(type, session) {
    const lane = getLocalPlayer(session)?.assignedPosition || "";
    return this.configStore.getEffectiveChampions(type, lane);
  }

  async declarePickIntent(session, snapshot) {
    const pickAction = getPendingPickAction(session);
    if (!pickAction || pickAction.isInProgress) {
      return;
    }

    const localPlayer = getLocalPlayer(session);
    const currentIntent = localPlayer?.championPickIntent ?? 0;
    const forcePick = this.configStore.get("force-pick");

    if (currentIntent && currentIntent === this.declaredPickIntent) {
      return;
    }

    if (this.isDeclaredPickIntentStillValid(snapshot, forcePick)) {
      return;
    }

    const championId = selectChampionId(this.getChampionList("pick", session), (candidateId) => {
      if (snapshot.bannedChampionIds.includes(candidateId)) {
        return false;
      }

      if (!forcePick && isChampionPicked(candidateId, snapshot.pickedChampions)) {
        return false;
      }

      if (currentIntent === candidateId || this.declaredPickIntent === candidateId) {
        return false;
      }

      return true;
    });

    if (!championId) {
      return;
    }

    const response = await this.lcuClient.updateSessionAction(pickAction.id, {
      championId,
    });

    if (response.ok) {
      this.declaredPickIntent = championId;
    } else {
      this.logger.log("failed to declare pick intent", response.status, championId);
      setTimeout(() => this.reprocessLatestSession(), 1000);
    }
  }

  isDeclaredPickIntentStillValid(snapshot, forcePick) {
    if (!this.declaredPickIntent) {
      return false;
    }

    if (snapshot.bannedChampionIds.includes(this.declaredPickIntent)) {
      this.declaredPickIntent = null;
      return false;
    }

    if (!forcePick && isChampionPicked(this.declaredPickIntent, snapshot.pickedChampions)) {
      this.declaredPickIntent = null;
      return false;
    }

    return true;
  }

  async handleAction(action, session, snapshot) {
    const isPickAction = action.type === "pick";
    const configPrefix = isPickAction ? "pick" : "ban";
    const enabled = this.configStore.get(`auto-${configPrefix}`);
    if (!enabled) {
      return;
    }

    const force = this.configStore.get(`force-${configPrefix}`);
    const championId = selectChampionId(this.getChampionList(configPrefix, session), (candidateId) => {
      if (snapshot.bannedChampionIds.includes(candidateId)) {
        return false;
      }

      if (isPickAction) {
        return force || !isChampionPicked(candidateId, snapshot.pickedChampions);
      }

      return force || !snapshot.teammateIntentChampionIds.includes(candidateId);
    });

    if (!championId) {
      return;
    }

    const response = await this.lcuClient.updateSessionAction(action.id, {
      championId,
      completed: true,
    });

    if (!response.ok) {
      this.logger.log(`failed to lock ${action.type}`, response.status, championId);
      setTimeout(() => this.reprocessLatestSession(), 1000);
    }
  }
}
