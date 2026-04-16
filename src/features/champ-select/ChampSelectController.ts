import { ConfigStore } from "../../core/ConfigStore";
import { LcuClient } from "../../core/LcuClient";
import { ChampionRepository } from "../../core/ChampionRepository";
import { Logger } from "../../core/Logger";
import { LcuAction, LcuSession } from "../../core/lcu/types";
import { getActionsToProcess, getLocalPlayer, getPendingPickAction, getSessionSnapshot } from "./selection";
import { ActionScheduler, ActionSchedulerDeps } from "./ActionScheduler";

export class ChampSelectController {
  private configStore: ConfigStore;
  private lcuClient: LcuClient;
  private championRepository: ChampionRepository;
  private logger: Logger;
  private scheduler: ActionScheduler;

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

    const schedulerDeps: ActionSchedulerDeps = {
      configStore: this.configStore,
      lcuClient: this.lcuClient,
      championRepository: this.championRepository,
      logger: this.logger,
      getLatestSession: () => this.latestSession,
      getDeclaredPickIntent: () => this.declaredPickIntent,
      setDeclaredPickIntent: (id) => {
        this.declaredPickIntent = id;
      },
      getSessionRevision: () => this.sessionRevision,
      describeChampion: (id) => this.describeChampion(id),
      onSessionSync: (reason, revision) => this.syncSessionFromClient(reason, revision),
    };
    this.scheduler = new ActionScheduler(schedulerDeps);
  }

  reset(): void {
    this.scheduler.reset();
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
    if (!this.latestSession) return;
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
        this.logger.log("processing queued session", { revision, ...this.describeSession(nextSession) });
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
      this.logger.log("skipping stale session", { revision, currentRevision: this.sessionRevision });
      return;
    }

    const pickEnabled = this.configStore.get("auto-pick");
    const banEnabled = this.configStore.get("auto-ban");
    if (!pickEnabled && !banEnabled) {
      this.scheduler.reset();
      this.logger.log("skipping session because automation is disabled", { revision, pickEnabled, banEnabled });
      return;
    }

    const snapshot = getSessionSnapshot(session);
    if (this.declaredPickIntent && snapshot.bannedChampionIds.includes(this.declaredPickIntent)) {
      this.logger.log("clearing declared pick intent because champion is now banned", {
        declaredPickIntent: this.describeChampion(this.declaredPickIntent),
        bannedChampionIds: snapshot.bannedChampionIds.map((id) => this.describeChampion(id)),
      });
      this.declaredPickIntent = null;
    }

    this.scheduler.pruneForSession(session, pickEnabled, banEnabled);

    const pickAction = getPendingPickAction(session);
    const actionsToProcess = getActionsToProcess(session);

    this.logger.log("session actionable state", {
      revision,
      localPlayer: this.describeLocalPlayer(session),
      pendingPickAction: pickAction ? this.describeAction(pickAction) : null,
      actionsToProcess: actionsToProcess.map((a) => this.describeAction(a)),
      declaredPickIntent: this.describeChampion(this.declaredPickIntent),
      bannedChampionIds: snapshot.bannedChampionIds.map((id) => this.describeChampion(id)),
      teammateIntentChampionIds: snapshot.teammateIntentChampionIds.map((id) => this.describeChampion(id)),
      pickedChampionIds: snapshot.pickedChampionIds.map((id) => this.describeChampion(id)),
    });

    if (!pickAction && actionsToProcess.length === 0) {
      this.logger.log("no local pick or ban action is currently actionable");
      return;
    }

    if (pickEnabled) {
      await this.scheduler.handlePickIntent(session, snapshot);
    }

    if (this.isStaleRevision(revision)) {
      this.logger.log("session became stale after handlePickIntent", {
        revision,
        currentRevision: this.sessionRevision,
      });
      return;
    }

    for (const action of actionsToProcess) {
      if (this.isStaleRevision(revision)) return;
      await this.scheduler.handleAction(action, session);
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

    this.logger.log("syncing champ select session from client", { reason, revision });
    const session = await this.lcuClient.getChampSelectSession();
    if (!session) {
      this.logger.log("champ select session sync returned empty payload", { reason });
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
    if (!localPlayer) return null;
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
    if (!championId) return null;
    const champion =
      this.championRepository.getAllSnapshot().find((e) => e.id === championId) ??
      this.championRepository.getPlayableSnapshot().find((e) => e.id === championId);
    if (!champion) return String(championId);
    return `${champion.name} (${champion.id})`;
  }
}
