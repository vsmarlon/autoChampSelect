import { ConfigStore } from "../core/ConfigStore.js";
import { LcuClient } from "../core/LcuClient.js";
import { Logger } from "../core/Logger.js";
import { ChampionRepository } from "../core/ChampionRepository.js";
import { ReadyCheckController } from "../features/ready-check/ReadyCheckController.js";
import { ChampSelectController } from "../features/champ-select/ChampSelectController.js";
import { UiController } from "../features/ui/UiController.js";

const VERSION = "3.2.0";

export class AutoChampSelectApp {
  constructor() {
    this.logger = new Logger("select", false);
    this.configStore = new ConfigStore(this.logger.child("config"));
    this.lcuClient = new LcuClient(this.logger.child("lcu"));
    this.championRepository = new ChampionRepository(this.lcuClient, this.logger.child("champions"));
    this.uiController = new UiController(this.configStore, this.championRepository, this.logger.child("ui"));
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
    this.socketObservers = [];
    this.configCleanup = null;
    this.currentPhase = null;
  }

  init(context) {
    this.disconnectObservers();
    this.socketObservers = [
      context.socket.observe("/lol-gameflow/v1/gameflow-phase", (event) => this.handleGameflowPhaseEvent(event)),
      context.socket.observe("/lol-champ-select/v1/session", (event) => this.handleChampSelectSessionEvent(event)),
      context.socket.observe("/lol-matchmaking/v1/ready-check", (event) => this.handleReadyCheckEvent(event)),
      context.socket.observe("/lol-inventory/v1/wallet", (event) => this.handleWalletEvent(event)),
    ];

    this.configCleanup?.();
    this.configCleanup = this.configStore.onChange(({ key }) => {
      if (this.currentPhase !== "ChampSelect") {
        return;
      }

      if (!["auto-pick", "auto-ban", "pick-champions", "ban-champions", "force-pick", "force-ban"].includes(key)) {
        return;
      }

      this.champSelectController.reprocessLatestSession();
    });

    this.logger.log(`v${VERSION} initialized`);
  }

  async load() {
    this.uiController.initHomePanel();
    this.uiController.initChampSelectUI();

    try {
      const phase = await this.lcuClient.getGameflowPhase();
      if (phase) {
        await this.handleGameflowPhase(phase);
      }
    } catch (error) {
      this.logger.log("Could not get current phase", error);
    }

    this.logger.log(`v${VERSION} loaded`);
  }

  async handleGameflowPhaseEvent(event) {
    if (event.eventType === "Delete") {
      return;
    }

    await this.handleGameflowPhase(event.data);
  }

  async handleGameflowPhase(phase) {
    this.currentPhase = phase;
    this.uiController.setPhase(phase);
    this.logger.log("gameflow phase", phase);

    if (phase === "ReadyCheck") {
      this.readyCheckController.handleReadyCheck();
      return;
    }

    if (phase === "ChampSelect") {
      this.champSelectController.reset();
      this.championRepository.clearPlayableCache();
      await this.championRepository.getPlayableChampions(true);
      await this.uiController.refreshHomeDropdowns();
      return;
    }

    this.uiController.cleanupChampSelectUI();
    this.champSelectController.reset();
  }

  handleChampSelectSessionEvent(event) {
    if (event.eventType === "Delete") {
      this.champSelectController.clearSession();
      return;
    }

    this.champSelectController.queueSession(event.data);
  }

  handleReadyCheckEvent(event) {
    if (event.eventType === "Delete") {
      return;
    }

    if (event.data?.state === "InProgress" && event.data?.playerResponse === "None") {
      this.readyCheckController.handleReadyCheck();
    }
  }

  async handleWalletEvent(event) {
    if (event.eventType !== "Update") {
      return;
    }

    await this.championRepository.getPlayableChampions(true);
    await this.uiController.refreshHomeDropdowns();
  }

  disconnectObservers() {
    this.socketObservers.forEach((observer) => observer?.disconnect?.());
    this.socketObservers = [];
  }
}
