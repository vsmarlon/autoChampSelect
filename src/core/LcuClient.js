export class LcuClient {
  constructor(logger) {
    this.logger = logger;
  }

  async request(path, options) {
    return fetch(path, options);
  }

  async requestJson(path, options) {
    const response = await this.request(path, options);
    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  async acceptReadyCheck() {
    return this.request("/lol-matchmaking/v1/ready-check/accept", { method: "POST" });
  }

  async updateSessionAction(actionId, body) {
    return this.request(`/lol-champ-select/v1/session/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async getGameflowPhase() {
    return this.requestJson("/lol-gameflow/v1/gameflow-phase");
  }

  async getOwnedChampions() {
    return this.requestJson("/lol-champions/v1/owned-champions-minimal");
  }

  async getChampionSummary() {
    return this.requestJson("/lol-game-data/assets/v1/champion-summary.json");
  }
}
