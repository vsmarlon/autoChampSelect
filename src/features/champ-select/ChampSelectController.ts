import { ConfigStore } from "../../core/ConfigStore";
import { LcuClient } from "../../core/LcuClient";
import { ChampionRepository } from "../../core/ChampionRepository";
import { Logger } from "../../core/Logger";
import {
  getActionsToProcess,
  getLocalPlayer,
  getPendingPickAction,
  getSessionSnapshot,
  isChampionPicked,
  selectChampionId,
  SessionSnapshot,
} from "./selection";
import { ConfigKey, Lane, LcuAction, LcuSession } from "../../core/lcu/types";

export class ChampSelectController {
  private configStore: ConfigStore;
  private lcuClient: LcuClient;
  private championRepository: ChampionRepository;
  private logger: Logger;

  private sessionProcessing = false;
  private pendingSession: LcuSession | null = null;
  private latestSession: LcuSession | null = null;
  private declaredPickIntent: number | null = null;
  private sessionRevision = 0;

  constructor(configStore: ConfigStore, lcuClient: LcuClient, championRepository: ChampionRepository, logger: Logger) {
    this.configStore = configStore;
    this.lcuClient = lcuClient;
    this.championRepository = championRepository;
    this.logger = logger;
  }

  reset(): void {
    if (this.declaredPickIntent) {
      this.logger.log("resetting declared pick intent", this.declaredPickIntent);
    }
    this.declaredPickIntent = null;
    this.sessionRevision += 1;
  }

  clearSession(): void {
    this.reset();
    this.latestSession = null;
    this.pendingSession = null;
  }

  reprocessLatestSession(): void {
    if (!this.latestSession) {
      return;
    }

    this.queueSession(this.latestSession);
  }

  async queueSession(session: LcuSession): Promise<void> {
    this.pendingSession = session;
    this.latestSession = session;
    this.logger.log("queue session", this.describeSession(session));

    if (this.sessionProcessing) {
      this.logger.log("session already processing, coalescing newer update");
      return;
    }

    this.sessionProcessing = true;
    try {
      while (this.pendingSession) {
        const nextSession = this.pendingSession;
        this.pendingSession = null;
        const revision = this.sessionRevision;
        this.logger.log("processing queued session", {
          revision,
          ...this.describeSession(nextSession),
        });
        await this.handleSession(nextSession, revision);

        if (this.isStaleRevision(revision)) {
          this.logger.log("stopping session processing due to stale revision", {
            revision,
            currentRevision: this.sessionRevision,
          });
          break;
        }
      }
    } finally {
      this.sessionProcessing = false;

      if (this.pendingSession) {
        const nextSession = this.pendingSession;
        this.pendingSession = null;
        this.logger.log("processing deferred queued session");
        void this.queueSession(nextSession);
      }
    }
  }

  private async handleSession(session: LcuSession, revision: number): Promise<void> {
    if (this.isStaleRevision(revision)) {
      this.logger.log("skipping stale session", {
        revision,
        currentRevision: this.sessionRevision,
      });
      return;
    }

    const pickEnabled = this.configStore.get("auto-pick");
    const banEnabled = this.configStore.get("auto-ban");
    if (!pickEnabled && !banEnabled) {
      this.logger.log("skipping session because automation is disabled", {
        revision,
        pickEnabled,
        banEnabled,
      });
      return;
    }

    const snapshot = getSessionSnapshot(session);
    if (this.declaredPickIntent && snapshot.bannedChampionIds.includes(this.declaredPickIntent)) {
      this.logger.log("clearing declared pick intent because champion is now banned", {
        declaredPickIntent: this.describeChampion(this.declaredPickIntent),
        bannedChampionIds: snapshot.bannedChampionIds.map((championId) => this.describeChampion(championId)),
      });
      this.declaredPickIntent = null;
    }

    const pickAction = getPendingPickAction(session);
    const actionsToProcess = getActionsToProcess(session);
    this.logger.log("session actionable state", {
      revision,
      localPlayer: this.describeLocalPlayer(session),
      pendingPickAction: pickAction ? this.describeAction(pickAction) : null,
      actionsToProcess: actionsToProcess.map((action) => this.describeAction(action)),
      declaredPickIntent: this.describeChampion(this.declaredPickIntent),
      bannedChampionIds: snapshot.bannedChampionIds.map((championId) => this.describeChampion(championId)),
      teammateIntentChampionIds: snapshot.teammateIntentChampionIds.map((championId) => this.describeChampion(championId)),
      pickedChampionIds: snapshot.pickedChampionIds.map((championId) => this.describeChampion(championId)),
    });
    if (!pickAction && actionsToProcess.length === 0) {
      this.logger.log("no local pick or ban action is currently actionable");
      return;
    }

    if (pickEnabled) {
      await this.declarePickIntent(session, snapshot, revision);
    }

    if (this.isStaleRevision(revision)) {
      this.logger.log("session became stale after declarePickIntent", {
        revision,
        currentRevision: this.sessionRevision,
      });
      return;
    }

    for (const action of actionsToProcess) {
      if (this.isStaleRevision(revision)) {
        return;
      }

      await this.handleAction(action, session, snapshot, revision);
    }
  }

  private getChampionList(type: "pick" | "ban", session: LcuSession): number[] {
    const pos = getLocalPlayer(session)?.assignedPosition;
    const lane: Lane | undefined = pos ? (pos as Lane) : undefined;
    return this.configStore.getEffectiveChampions(type, lane);
  }

  private async declarePickIntent(
    session: LcuSession,
    snapshot: SessionSnapshot,
    revision: number,
  ): Promise<void> {
    const pickAction = getPendingPickAction(session);
    if (!pickAction || pickAction.isInProgress) {
      this.logger.log("skipping pick intent declaration", {
        reason: !pickAction ? "no-pending-pick-action" : "pick-action-already-in-progress",
        pickAction: pickAction ? this.describeAction(pickAction) : null,
      });
      return;
    }

    const localPlayer = getLocalPlayer(session);
    const currentIntent = localPlayer?.championPickIntent ?? 0;
    const forcePick = this.configStore.get("force-pick") || false;

    if (this.isDeclaredPickIntentStillValid(snapshot, forcePick)) {
      if (currentIntent && currentIntent === this.declaredPickIntent) {
        this.logger.log("keeping current pick intent because current client intent already matches the validated declared intent", {
          currentIntent: this.describeChampion(currentIntent),
        });
        return;
      }

      this.logger.log("keeping previously declared pick intent", {
        declaredPickIntent: this.describeChampion(this.declaredPickIntent),
        forcePick,
      });
      return;
    }

    const pickList = this.getChampionList("pick", session);
    this.logger.log("evaluating pick intent candidates", {
      pickAction: this.describeAction(pickAction),
      currentIntent: this.describeChampion(currentIntent),
      declaredPickIntent: this.describeChampion(this.declaredPickIntent),
      forcePick,
      candidates: pickList.map((candidateId) => this.describeChampion(candidateId)),
    });
    const rejectedCandidates: string[] = [];
    const championId = selectChampionId(pickList, (candidateId) => {
      const championLabel = this.describeChampion(candidateId);
      if (snapshot.bannedChampionIds.includes(candidateId)) {
        rejectedCandidates.push(`${championLabel}: banned`);
        return false;
      }

      if (!forcePick && isChampionPicked(candidateId, snapshot.pickedChampionIds)) {
        rejectedCandidates.push(`${championLabel}: already-picked`);
        return false;
      }

      return true;
    });

    if (!championId) {
      this.logger.log("no valid pick intent candidate found", {
        candidates: pickList.map((candidateId) => this.describeChampion(candidateId)),
        rejectedCandidates,
      });
      return;
    }

    if (currentIntent === championId) {
      this.declaredPickIntent = championId;
      this.logger.log("keeping current pick intent because it already matches the highest-priority valid candidate", {
        championId: this.describeChampion(championId),
      });
      return;
    }

    if (this.declaredPickIntent === championId) {
      this.logger.log("skipping pick intent patch because the plugin already declared the highest-priority valid candidate", {
        championId: this.describeChampion(championId),
      });
      return;
    }

    this.logger.log("declaring pick intent", {
      action: this.describeAction(pickAction),
      championId: this.describeChampion(championId),
    });
    const success = await this.lcuClient.updateSessionAction(pickAction.id, { championId });

    if (this.isStaleRevision(revision)) {
      this.logger.log("pick intent result ignored because session became stale", {
        revision,
        currentRevision: this.sessionRevision,
      });
      return;
    }

    if (success) {
      this.declaredPickIntent = championId;
      if (!snapshot.teammateIntentChampionIds.includes(championId)) {
        snapshot.teammateIntentChampionIds.push(championId);
      }
      this.logger.log("pick intent declared", {
        championId: this.describeChampion(championId),
      });
      await this.syncSessionFromClient("pick-intent-declared", revision);
    } else {
      this.logger.log("failed to declare pick intent", championId);
    }
  }

  private isDeclaredPickIntentStillValid(snapshot: SessionSnapshot, forcePick: boolean): boolean {
    if (!this.declaredPickIntent) {
      return false;
    }

    if (snapshot.bannedChampionIds.includes(this.declaredPickIntent)) {
      this.logger.log("declared pick intent is no longer valid because it is banned", {
        declaredPickIntent: this.describeChampion(this.declaredPickIntent),
      });
      this.declaredPickIntent = null;
      return false;
    }

    if (!forcePick && isChampionPicked(this.declaredPickIntent, snapshot.pickedChampionIds)) {
      this.logger.log("declared pick intent is no longer valid because it was already picked", {
        declaredPickIntent: this.describeChampion(this.declaredPickIntent),
      });
      this.declaredPickIntent = null;
      return false;
    }

    return true;
  }

  private async handleAction(
    action: LcuAction,
    session: LcuSession,
    snapshot: SessionSnapshot,
    revision: number,
  ): Promise<void> {
    const isPickAction = action.type === "pick";
    const configPrefix = isPickAction ? "pick" : "ban";
    const enabled = this.configStore.get(`auto-${configPrefix}` as ConfigKey);
    if (!enabled) {
      this.logger.log("skipping action because automation is disabled for action type", {
        action: this.describeAction(action),
        enabled,
      });
      return;
    }

    const force = !!this.configStore.get(`force-${configPrefix}` as ConfigKey);
    const actionList = this.getChampionList(configPrefix, session);
    const currentIntent = getLocalPlayer(session)?.championPickIntent ?? 0;
    this.logger.log("evaluating action candidates", {
      action: this.describeAction(action),
      force,
      currentIntent: this.describeChampion(currentIntent),
      declaredPickIntent: this.describeChampion(this.declaredPickIntent),
      candidates: actionList.map((candidateId) => this.describeChampion(candidateId)),
    });

    const rejectedCandidates: string[] = [];
    const championId = selectChampionId(actionList, (candidateId) => {
      const championLabel = this.describeChampion(candidateId);
      if (snapshot.bannedChampionIds.includes(candidateId)) {
        rejectedCandidates.push(`${championLabel}: banned`);
        return false;
      }

      if (isPickAction) {
        if (!force && isChampionPicked(candidateId, snapshot.pickedChampionIds)) {
          rejectedCandidates.push(`${championLabel}: already-picked`);
          return false;
        }

        return true;
      }

      if (!force && snapshot.teammateIntentChampionIds.includes(candidateId)) {
        rejectedCandidates.push(`${championLabel}: teammate-intent`);
        return false;
      }

      if (candidateId === currentIntent) {
        rejectedCandidates.push(`${championLabel}: current-intent`);
        return false;
      }

      if (candidateId === this.declaredPickIntent) {
        rejectedCandidates.push(`${championLabel}: declared-pick-intent`);
        return false;
      }

      return true;
    });

    if (!championId) {
      this.logger.log("no valid action candidate found", {
        action: this.describeAction(action),
        candidates: actionList.map((candidateId) => this.describeChampion(candidateId)),
        rejectedCandidates,
      });
      return;
    }

    this.logger.log("locking champ select action", {
      action: this.describeAction(action),
      championId: this.describeChampion(championId),
    });
    const success = await this.lcuClient.updateSessionAction(action.id, {
      championId,
      completed: true,
    });

    if (this.isStaleRevision(revision)) {
      this.logger.log("action result ignored because session became stale", {
        revision,
        currentRevision: this.sessionRevision,
        action: this.describeAction(action),
      });
      return;
    }

    if (success) {
      this.logger.log("locked champ select action", {
        action: this.describeAction(action),
        championId: this.describeChampion(championId),
      });
      await this.syncSessionFromClient(`${action.type}-locked`, revision);
    } else {
      this.logger.log(`failed to lock ${action.type}`, championId);
    }
  }

  private isStaleRevision(revision: number): boolean {
    return revision !== this.sessionRevision;
  }

  private async syncSessionFromClient(reason: string, revision: number): Promise<void> {
    if (this.isStaleRevision(revision)) {
      this.logger.log("skipping client session sync because revision is stale", {
        reason,
        revision,
        currentRevision: this.sessionRevision,
      });
      return;
    }

    this.logger.log("syncing champ select session from client", {
      reason,
      revision,
    });
    const session = await this.lcuClient.getChampSelectSession();
    if (!session) {
      this.logger.log("champ select session sync returned empty payload", {
        reason,
      });
      return;
    }

    if (this.isStaleRevision(revision)) {
      this.logger.log("discarding synced session because revision is stale", {
        reason,
        revision,
        currentRevision: this.sessionRevision,
      });
      return;
    }

    await this.queueSession(session);
  }

  private describeSession(session: LcuSession): Record<string, unknown> {
    return {
      gameId: session.gameId,
      counter: session.counter,
      phase: session.timer.phase,
      timeLeftMs: session.timer.adjustedTimeLeftInPhase,
      localPlayerCellId: session.localPlayerCellId,
      skipChampionSelect: session.skipChampionSelect,
    };
  }

  private describeLocalPlayer(session: LcuSession): Record<string, unknown> | null {
    const localPlayer = getLocalPlayer(session);
    if (!localPlayer) {
      return null;
    }

    return {
      cellId: localPlayer.cellId,
      assignedPosition: localPlayer.assignedPosition || "unknown",
      championId: this.describeChampion(localPlayer.championId),
      championPickIntent: this.describeChampion(localPlayer.championPickIntent),
    };
  }

  private describeAction(action: LcuAction): Record<string, unknown> {
    return {
      id: action.id,
      type: action.type,
      championId: this.describeChampion(action.championId),
      completed: action.completed,
      isInProgress: action.isInProgress,
      pickTurn: action.pickTurn ?? null,
      actorCellId: action.actorCellId,
    };
  }

  private describeChampion(championId: number | null | undefined): string | null {
    if (!championId) {
      return null;
    }

    const champion =
      this.championRepository.getAllSnapshot().find((entry) => entry.id === championId) ??
      this.championRepository.getPlayableSnapshot().find((entry) => entry.id === championId);
    if (!champion) {
      return String(championId);
    }

    return `${champion.name} (${champion.id})`;
  }
}
