import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { Logger } from "./Logger";
import { ChampionSummary, LcuSession } from "./lcu/types";

export class LcuClient {
  private logger: Logger;
  private api: AxiosInstance;

  constructor(logger: Logger) {
    this.logger = logger;
    this.api = axios.create({
      timeout: 10000,
    });
  }

  private async request<T>(path: string, options: AxiosRequestConfig = {}): Promise<T | null> {
    try {
      const response = await this.api.request<T>({
        url: path,
        ...options,
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logger.log(`Request to ${path} failed:`, {
          message: error.message,
          status: error.response?.status ?? null,
          data: error.response?.data ?? null,
        });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.log(`Request to ${path} failed:`, message);
      }

      return null;
    }
  }

  async acceptReadyCheck(): Promise<boolean> {
    const data = await this.request<void>("/lol-matchmaking/v1/ready-check/accept", { method: "POST" });
    return data !== null;
  }

  async updateSessionAction(actionId: number, body: Record<string, unknown>): Promise<boolean> {
    this.logger.log("PATCH session action", {
      actionId,
      body,
    });
    const data = await this.request<void>(`/lol-champ-select/v1/session/actions/${actionId}`, {
      method: "PATCH",
      data: body,
    });
    this.logger.log("PATCH session action result", {
      actionId,
      success: data !== null,
    });
    return data !== null;
  }

  async getGameflowPhase(): Promise<string | null> {
    return this.request<string>("/lol-gameflow/v1/gameflow-phase");
  }

  async getOwnedChampions(): Promise<ChampionSummary[] | null> {
    return this.request<ChampionSummary[]>("/lol-champions/v1/owned-champions-minimal");
  }

  async getChampionSummary(): Promise<ChampionSummary[] | null> {
    return this.request<ChampionSummary[]>("/lol-game-data/assets/v1/champion-summary.json");
  }

  async getPickableChampionIds(): Promise<number[] | null> {
    return this.request<number[]>("/lol-champ-select/v1/pickable-champion-ids");
  }

  async getBannableChampionIds(): Promise<number[] | null> {
    return this.request<number[]>("/lol-champ-select/v1/bannable-champion-ids");
  }

  async getChampSelectSession(): Promise<LcuSession | null> {
    return this.request<LcuSession>("/lol-champ-select/v1/session");
  }
}
