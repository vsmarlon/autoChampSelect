import { ConfigStore } from "@/core/ConfigStore";
import { LcuClient } from "@/core/LcuClient";
import { Logger } from "@/core/Logger";
import { ChampionRepository } from "@/core/ChampionRepository";
import { ReadyCheckController } from "../features/ready-check/ReadyCheckController";
import { ChampSelectController } from "../features/champ-select/ChampSelectController";
import { UiController } from "../features/ui/UiController";
import { CHAMP_SELECT_REPROCESS_KEYS, VERSION } from "../utils/constants";
import type { LcuSession } from "@/core/lcu/types";
import type { PenguContext, PenguObserverHandle, PenguSocketEvent } from "@/types/pengu";

export class AutoChampSelectApp {
  private logger: Logger;
  private configStore: ConfigStore;
  private lcuClient: LcuClient;
  private championRepository: ChampionRepository;
  private uiController: UiController;
  private readyCheckController: ReadyCheckController;
  private champSelectController: ChampSelectController;

  private socketObservers: PenguObserverHandle[] = [];
  private configCleanup: (() => void) | null = null;
  private currentPhase: string | null = null;
  private homeRefreshInFlight = false;
  private pendingHomeRefresh = false;

  constructor(stylesheetText: string) {
    this.logger = new Logger("select", true);
    this.configStore = new ConfigStore(this.logger.child("config"));
    this.lcuClient = new LcuClient(this.logger.child("lcu"));
    this.championRepository = new ChampionRepository(this.lcuClient, this.logger.child("champions"));
    this.uiController = new UiController(
      this.configStore,
      this.championRepository,
      this.logger.child("ui"),
      stylesheetText,
    );
    this.readyCheckController = new ReadyCheckController(
      this.configStore,
      this.lcuClient,
      this.logger.child("ready-check"),
    );
    this.champSelectController = new ChampSelectController(
      this.configStore,
      this.lcuClient,
      this.championRepository,
      this.logger.child("champ-select"),
    );
  }

  init(context: PenguContext): void {
    this.disconnectObservers();
    this.socketObservers = [
      context.socket.observe<string>("/lol-gameflow/v1/gameflow-phase", (event) =>
        this.handleGameflowPhaseEvent(event),
      ),
      context.socket.observe<LcuSession>("/lol-champ-select/v1/session", (event) =>
        this.handleChampSelectSessionEvent(event),
      ),
      context.socket.observe<{ state?: string; playerResponse?: string }>("/lol-matchmaking/v1/ready-check", (event) =>
        this.handleReadyCheckEvent(event),
      ),
    ];

    this.configCleanup?.();
    this.configCleanup = this.configStore.onChange(({ key }) => {
      if (this.currentPhase !== "ChampSelect") {
        return;
      }

      if (!CHAMP_SELECT_REPROCESS_KEYS.includes(key as (typeof CHAMP_SELECT_REPROCESS_KEYS)[number])) {
        return;
      }

      this.champSelectController.reprocessLatestSession();
    });

    this.logger.log(`v${VERSION} initialized`);
  }

  async load(): Promise<void> {
    this.logger.log("load() starting");
    this.uiController.initHomePanel();
    this.uiController.initChampSelectUI();
    this.logger.log("load() UI initialized, warming champion cache");
    this.warmChampionCache();

    try {
      const phase = await this.getInitialPhase();
      this.logger.log("load() current phase:", phase);
      if (phase && phase !== "None") {
        await this.handleGameflowPhase(phase, { force: true });
      }
    } catch (error) {
      this.logger.log("Could not get current phase", error);
    }

    this.logger.log(`v${VERSION} loaded`);
  }

  async warmChampionCache(): Promise<void> {
    try {
      await Promise.all([this.championRepository.getPlayableChampions(), this.championRepository.getAllChampions()]);
    } catch (error) {
      this.logger.log("warmChampionCache failed", error);
    }
  }

  private async getInitialPhase(): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const phase = await this.lcuClient.getGameflowPhase();
      if (phase !== null) {
        return phase;
      }

      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return null;
  }

  async handleGameflowPhaseEvent(event: PenguSocketEvent<string>): Promise<void> {
    if (event.eventType === "Delete") {
      return;
    }

    await this.handleGameflowPhase(event.data);
  }

  async handleGameflowPhase(phase: string | null, options: { force?: boolean } = {}): Promise<void> {
    const nextPhase = phase && phase !== "None" ? phase : null;

    const force = options.force === true;
    if (!force && this.currentPhase === nextPhase) {
      return;
    }

    const previousPhase = this.currentPhase;
    if (previousPhase === "ChampSelect" && nextPhase !== "ChampSelect") {
      this.uiController.cleanupChampSelectUI();
      this.champSelectController.clearSession();
    }

    this.currentPhase = nextPhase;
    this.uiController.setPhase(nextPhase);
    this.logger.log("gameflow phase", nextPhase ?? "None", "(previous:", previousPhase ?? "none", ")");

    if (!nextPhase) {
      return;
    }

    if (nextPhase === "ReadyCheck") {
      this.readyCheckController.handleReadyCheck();
      return;
    }

    if (nextPhase === "Lobby") {
      this.logger.log("Lobby: syncing champions");
      await this.championRepository.getPlayableChampions();
      await this.refreshHomeDropdowns("phase-lobby");
      return;
    }

    if (nextPhase === "ChampSelect") {
      this.champSelectController.clearSession();
      await this.bootstrapChampSelectSession();
      await this.refreshHomeDropdowns("phase-champ-select");
      return;
    }
  }

  handleChampSelectSessionEvent(event: PenguSocketEvent<LcuSession>): void {
    if (event.eventType === "Delete") {
      this.champSelectController.clearSession();
      return;
    }

    this.champSelectController.queueSession(event.data);
  }

  handleReadyCheckEvent(event: PenguSocketEvent<{ state?: string; playerResponse?: string }>): void {
    if (event.eventType === "Delete") {
      return;
    }

    if (event.data?.state === "InProgress" && event.data?.playerResponse === "None") {
      this.readyCheckController.handleReadyCheck();
    }
  }

  async refreshHomeDropdowns(reason: string): Promise<void> {
    this.pendingHomeRefresh = true;
    if (this.homeRefreshInFlight) {
      return;
    }

    this.homeRefreshInFlight = true;
    try {
      while (this.pendingHomeRefresh) {
        this.pendingHomeRefresh = false;
        this.logger.log("refreshHomeDropdowns reason", reason);
        // React UI handles this reactive now, but we keep the method for consistency
      }
    } finally {
      this.homeRefreshInFlight = false;
    }
  }

  async bootstrapChampSelectSession(): Promise<void> {
    const session = await this.lcuClient.getChampSelectSession();
    if (!session) {
      this.logger.log("ChampSelect session endpoint returned empty payload");
      return;
    }

    this.champSelectController.queueSession(session);
  }

  disconnectObservers(): void {
    this.socketObservers.forEach((observer) => observer?.disconnect?.());
    this.socketObservers = [];
  }
}
