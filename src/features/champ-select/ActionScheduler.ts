import { ConfigKey, LcuAction } from "../../core/lcu/types";
import { Logger } from "../../core/Logger";
import { LcuClient } from "../../core/LcuClient";
import { ConfigStore } from "../../core/ConfigStore";
import { ChampionRepository } from "../../core/ChampionRepository";
import { ScheduledActionLock, ScheduledPickIntent } from "../../utils/types";
import { DELAY_JITTER_MS } from "../../utils/constants";
import { getActionsToProcess, getLocalPlayer, getSessionSnapshot } from "./selection";
import {
  isDeclaredPickIntentStillValid,
  CandidateResolverDeps,
  resolvePickIntentCandidate,
  resolveActionCandidate,
} from "./CandidateResolver";
import { LcuSession } from "../../core/lcu/types";

export interface ActionSchedulerDeps {
  configStore: ConfigStore;
  lcuClient: LcuClient;
  championRepository: ChampionRepository;
  logger: Logger;
  getLatestSession: () => LcuSession | null;
  getDeclaredPickIntent: () => number | null;
  setDeclaredPickIntent: (id: number | null) => void;
  getSessionRevision: () => number;
  describeChampion: (id: number | null | undefined) => string | null;
  onSessionSync: (reason: string, revision: number) => Promise<void>;
}

export class ActionScheduler {
  private deps: ActionSchedulerDeps;
  private scheduledPickIntent: ScheduledPickIntent | null = null;
  private scheduledActionLocks = new Map<number, ScheduledActionLock>();

  constructor(deps: ActionSchedulerDeps) {
    this.deps = deps;
  }

  reset(): void {
    this.cancelScheduledPickIntent();
    this.cancelAllScheduledActionLocks();
  }

  pruneForSession(session: LcuSession, pickEnabled: boolean, banEnabled: boolean): void {
    const actionsToProcess = getActionsToProcess(session);
    const actionableActionIds = new Set(actionsToProcess.map((a) => a.id));

    for (const [actionId, lock] of this.scheduledActionLocks) {
      const enabled = lock.type === "pick" ? pickEnabled : banEnabled;
      if (enabled && actionableActionIds.has(actionId)) continue;
      this.clearScheduledActionLock(actionId);
    }

    const pickAction =
      session.actions
        .flat()
        .find((a) => a.type === "pick" && !a.completed && a.actorCellId === session.localPlayerCellId) ?? null;
    if (!pickEnabled || !pickAction) {
      this.cancelScheduledPickIntent();
    } else if (this.scheduledPickIntent && this.scheduledPickIntent.actionId !== pickAction.id) {
      this.cancelScheduledPickIntent();
    }
  }

  async handlePickIntent(session: LcuSession, snapshot: ReturnType<typeof getSessionSnapshot>): Promise<void> {
    const { configStore } = this.deps;
    const pickAction =
      session.actions
        .flat()
        .find((a) => a.type === "pick" && !a.completed && a.actorCellId === session.localPlayerCellId) ?? null;
    const forcePick = configStore.get("force-pick") || false;

    if (!pickAction) {
      this.cancelScheduledPickIntent();
      return;
    }

    const currentIntent = getLocalPlayer(session)?.championPickIntent ?? 0;
    const declaredPickIntent = this.deps.getDeclaredPickIntent();

    if (isDeclaredPickIntentStillValid(declaredPickIntent, snapshot, forcePick)) {
      this.cancelScheduledPickIntent();
      if (currentIntent && currentIntent === declaredPickIntent) return;
      return;
    }

    const baseDelayMs = Math.max(0, Number(configStore.get("pick-delay-seconds"))) * 1000;
    const existingSchedule = this.scheduledPickIntent;

    if (baseDelayMs <= 0) {
      if (existingSchedule?.executing && existingSchedule.actionId === pickAction.id) return;
      if (existingSchedule && existingSchedule.actionId !== pickAction.id) this.cancelScheduledPickIntent();
      if (existingSchedule?.timeoutId != null) window.clearTimeout(existingSchedule.timeoutId);

      this.scheduledPickIntent = {
        actionId: pickAction.id,
        startedAt: existingSchedule?.actionId === pickAction.id ? existingSchedule.startedAt : Date.now(),
        baseDelayMs: 0,
        delayMs: 0,
        timeoutId: null,
        executing: true,
      };
      await this.executePickIntent(pickAction.id, session);
      return;
    }

    if (existingSchedule && existingSchedule.actionId !== pickAction.id) this.cancelScheduledPickIntent();

    if (this.scheduledPickIntent) {
      if (this.scheduledPickIntent.executing) return;
      if (this.scheduledPickIntent.baseDelayMs === baseDelayMs && this.scheduledPickIntent.timeoutId !== null) return;

      const delayMs = this.applyJitter(baseDelayMs);
      const elapsedMs = Math.max(0, Date.now() - this.scheduledPickIntent.startedAt);
      this.schedulePickIntent({ ...this.scheduledPickIntent, baseDelayMs, delayMs }, Math.max(0, delayMs - elapsedMs));
      return;
    }

    const delayMs = this.applyJitter(baseDelayMs);
    this.schedulePickIntent(
      { actionId: pickAction.id, startedAt: Date.now(), baseDelayMs, delayMs, timeoutId: null, executing: false },
      delayMs,
    );
  }

  async handleAction(action: LcuAction, session: LcuSession): Promise<void> {
    const { configStore } = this.deps;
    const isPickAction = action.type === "pick";
    const configPrefix = isPickAction ? "pick" : "ban";
    const enabled = configStore.get(`auto-${configPrefix}` as ConfigKey);

    if (!enabled) return;
    if (!isPickAction && session.timer.phase !== "BAN_PICK") return;

    const delayKey = `${configPrefix}-delay-seconds` as ConfigKey;
    const baseDelayMs = Math.max(0, Number(configStore.get(delayKey))) * 1000;
    const existingLock = this.scheduledActionLocks.get(action.id);

    if (baseDelayMs <= 0) {
      if (existingLock?.executing) return;
      if (existingLock?.timeoutId != null) window.clearTimeout(existingLock.timeoutId);

      this.scheduledActionLocks.set(action.id, {
        actionId: action.id,
        type: configPrefix,
        startedAt: existingLock?.startedAt ?? Date.now(),
        baseDelayMs: 0,
        delayMs: 0,
        timeoutId: null,
        executing: true,
      });
      await this.executeActionLock(action.id, session);
      return;
    }

    if (existingLock) {
      if (existingLock.executing) return;
      if (existingLock.baseDelayMs === baseDelayMs && existingLock.timeoutId !== null) return;

      const delayMs = this.applyJitter(baseDelayMs);
      const elapsedMs = Math.max(0, Date.now() - existingLock.startedAt);
      this.scheduleActionLock(
        { ...existingLock, type: configPrefix, baseDelayMs, delayMs },
        Math.max(0, delayMs - elapsedMs),
      );
      return;
    }

    const delayMs = this.applyJitter(baseDelayMs);
    this.scheduleActionLock(
      {
        actionId: action.id,
        type: configPrefix,
        startedAt: Date.now(),
        baseDelayMs,
        delayMs,
        timeoutId: null,
        executing: false,
      },
      delayMs,
    );
  }

  private applyJitter(baseDelayMs: number): number {
    if (baseDelayMs <= 0) return 0;
    const jitter = (Math.random() * 2 - 1) * DELAY_JITTER_MS;
    return Math.max(0, Math.round(baseDelayMs + jitter));
  }

  private schedulePickIntent(schedule: ScheduledPickIntent, remainingMs: number): void {
    if (schedule.timeoutId !== null) window.clearTimeout(schedule.timeoutId);

    this.scheduledPickIntent = {
      ...schedule,
      timeoutId: window.setTimeout(() => {
        if (!this.scheduledPickIntent || this.scheduledPickIntent.actionId !== schedule.actionId) return;
        if (this.scheduledPickIntent.executing) return;

        this.scheduledPickIntent = { ...this.scheduledPickIntent, timeoutId: null, executing: true };
        const session = this.deps.getLatestSession();
        if (session) void this.executePickIntent(schedule.actionId, session);
      }, remainingMs),
      executing: false,
    };
  }

  private async executePickIntent(actionId: number, session: LcuSession): Promise<void> {
    const scheduledPickIntent = this.scheduledPickIntent;
    if (!scheduledPickIntent || scheduledPickIntent.actionId !== actionId) {
      this.cancelScheduledPickIntent();
      return;
    }

    const pickAction =
      session.actions
        .flat()
        .find((a) => a.type === "pick" && !a.completed && a.actorCellId === session.localPlayerCellId) ?? null;
    if (!pickAction || pickAction.id !== actionId) {
      this.cancelScheduledPickIntent();
      return;
    }

    const revision = this.deps.getSessionRevision();
    const snapshot = getSessionSnapshot(session);
    const currentIntent = getLocalPlayer(session)?.championPickIntent ?? 0;
    const forcePick = this.deps.configStore.get("force-pick") || false;
    const declaredPickIntent = this.deps.getDeclaredPickIntent();

    if (isDeclaredPickIntentStillValid(declaredPickIntent, snapshot, forcePick)) {
      this.cancelScheduledPickIntent();
      if (currentIntent && currentIntent === declaredPickIntent) return;
      return;
    }

    const candidateDeps: CandidateResolverDeps = {
      configStore: this.deps.configStore,
      championRepository: this.deps.championRepository,
      describeChampion: this.deps.describeChampion,
    };

    const selection = await resolvePickIntentCandidate(candidateDeps, session, snapshot);

    if (!selection.championId) {
      this.cancelScheduledPickIntent();
      return;
    }

    if (currentIntent === selection.championId) {
      this.deps.setDeclaredPickIntent(selection.championId);
      this.cancelScheduledPickIntent();
      return;
    }

    if (this.deps.getDeclaredPickIntent() === selection.championId) {
      this.cancelScheduledPickIntent();
      return;
    }

    const success = await this.deps.lcuClient.updateSessionAction(pickAction.id, { championId: selection.championId });

    if (!this.scheduledPickIntent || this.scheduledPickIntent.actionId !== actionId) return;
    if (revision !== this.deps.getSessionRevision()) return;

    if (success) {
      this.deps.setDeclaredPickIntent(selection.championId);
      this.cancelScheduledPickIntent();
      await this.deps.onSessionSync("pick-intent-declared", revision);
    } else {
      this.markScheduledPickIntentPendingRetry();
      await this.deps.onSessionSync("pick-intent-failed", revision);
    }
  }

  private scheduleActionLock(lock: ScheduledActionLock, remainingMs: number): void {
    if (lock.timeoutId !== null) window.clearTimeout(lock.timeoutId);

    const nextLock: ScheduledActionLock = {
      ...lock,
      timeoutId: window.setTimeout(() => {
        const activeLock = this.scheduledActionLocks.get(lock.actionId);
        if (!activeLock || activeLock.executing) return;
        activeLock.timeoutId = null;
        activeLock.executing = true;
        this.scheduledActionLocks.set(lock.actionId, activeLock);
        const session = this.deps.getLatestSession();
        if (session) void this.executeActionLock(lock.actionId, session);
      }, remainingMs),
      executing: false,
    };

    this.scheduledActionLocks.set(lock.actionId, nextLock);
  }

  private async executeActionLock(actionId: number, session: LcuSession): Promise<void> {
    const lock = this.scheduledActionLocks.get(actionId);
    if (!lock) {
      this.clearScheduledActionLock(actionId);
      return;
    }

    const action = getActionsToProcess(session).find((a) => a.id === actionId) ?? null;
    if (!action || action.type !== lock.type) {
      this.clearScheduledActionLock(actionId);
      return;
    }

    const configPrefix = lock.type;
    const enabled = this.deps.configStore.get(`auto-${configPrefix}` as ConfigKey);
    if (!enabled) {
      this.clearScheduledActionLock(actionId);
      return;
    }

    const revision = this.deps.getSessionRevision();
    const snapshot = getSessionSnapshot(session);

    const candidateDeps: CandidateResolverDeps = {
      configStore: this.deps.configStore,
      championRepository: this.deps.championRepository,
      describeChampion: this.deps.describeChampion,
    };

    const selection = await resolveActionCandidate(candidateDeps, configPrefix, session, snapshot);

    if (!selection.championId) {
      this.clearScheduledActionLock(actionId);
      return;
    }

    let success: boolean;
    if (action.type === "ban") {
      const hovered = await this.deps.lcuClient.updateSessionAction(action.id, { championId: selection.championId });
      if (!hovered) {
        success = false;
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        success = await this.deps.lcuClient.updateSessionAction(action.id, {
          championId: selection.championId,
          completed: true,
        });
      }
    } else {
      success = await this.deps.lcuClient.updateSessionAction(action.id, {
        championId: selection.championId,
        completed: true,
      });
    }

    if (!this.scheduledActionLocks.has(actionId)) return;
    if (revision !== this.deps.getSessionRevision()) return;

    if (success) {
      this.clearScheduledActionLock(actionId);
      await this.deps.onSessionSync(`${action.type}-locked`, revision);
    } else {
      this.markScheduledActionLockPendingRetry(actionId);
      await this.deps.onSessionSync(`${action.type}-lock-failed`, revision);
    }
  }

  private cancelScheduledPickIntent(): void {
    if (!this.scheduledPickIntent) return;
    if (this.scheduledPickIntent.timeoutId !== null) window.clearTimeout(this.scheduledPickIntent.timeoutId);
    this.scheduledPickIntent = null;
  }

  private clearScheduledActionLock(actionId: number): void {
    const lock = this.scheduledActionLocks.get(actionId);
    if (!lock) return;
    if (lock.timeoutId !== null) window.clearTimeout(lock.timeoutId);
    this.scheduledActionLocks.delete(actionId);
  }

  private markScheduledPickIntentPendingRetry(): void {
    if (!this.scheduledPickIntent) return;
    if (this.scheduledPickIntent.timeoutId !== null) window.clearTimeout(this.scheduledPickIntent.timeoutId);
    this.scheduledPickIntent = { ...this.scheduledPickIntent, timeoutId: null, executing: false };
  }

  private markScheduledActionLockPendingRetry(actionId: number): void {
    const lock = this.scheduledActionLocks.get(actionId);
    if (!lock) return;
    if (lock.timeoutId !== null) window.clearTimeout(lock.timeoutId);
    this.scheduledActionLocks.set(actionId, { ...lock, timeoutId: null, executing: false });
  }

  private cancelAllScheduledActionLocks(): void {
    for (const actionId of this.scheduledActionLocks.keys()) {
      this.clearScheduledActionLock(actionId);
    }
  }
}
