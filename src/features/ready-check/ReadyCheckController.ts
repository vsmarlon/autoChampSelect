import { ConfigStore } from "../../core/ConfigStore";
import { LcuClient } from "../../core/LcuClient";
import { Logger } from "../../core/Logger";

export class ReadyCheckController {
  private configStore: ConfigStore;
  private lcuClient: LcuClient;
  private logger: Logger;
  private acceptInFlight = false;

  constructor(configStore: ConfigStore, lcuClient: LcuClient, logger: Logger) {
    this.configStore = configStore;
    this.lcuClient = lcuClient;
    this.logger = logger;
  }

  async handleReadyCheck(): Promise<void> {
    if (!this.configStore.get("auto-accept") || this.acceptInFlight) {
      return;
    }

    this.acceptInFlight = true;
    try {
      const accepted = await this.lcuClient.acceptReadyCheck();
      if (!accepted) {
        this.logger.log("ready check accept failed");
      }
    } finally {
      this.acceptInFlight = false;
    }
  }
}
