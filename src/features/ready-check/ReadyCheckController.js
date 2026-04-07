export class ReadyCheckController {
  constructor(configStore, lcuClient, logger) {
    this.configStore = configStore;
    this.lcuClient = lcuClient;
    this.logger = logger;
  }

  async handleReadyCheck() {
    if (!this.configStore.get("auto-accept")) {
      return;
    }

    try {
      const response = await this.lcuClient.acceptReadyCheck();
      if (!response.ok) {
        this.logger.log("ready check accept failed", response.status);
      }
    } catch (error) {
      this.logger.log("ready check accept failed", error);
    }
  }
}
