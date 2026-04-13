import { CONFIG_CHANGE_EVENT, CONFIG_DEFAULTS, LANES } from "../utils/constants";
import { ConfigKey, Lane, PluginConfig } from "./lcu/types";
import { Logger } from "./Logger";

const STORE_KEY = "SelectAutoSelect";
const LEGACY_STORE_KEYS = ["SelectAutoSelect"];
const LEGACY_PREFIXES = ["select"];

interface StoredConfig extends Partial<PluginConfig> {
  __migratedV1?: boolean;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as unknown as T;
  }
  if (value && typeof value === "object") {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeChampionId(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function sanitizeChampionList(value: unknown, fallback: number[]): number[] {
  const source = Array.isArray(value) ? value : fallback;
  return fallback.map((fallbackChampionId, index) => sanitizeChampionId(source[index], fallbackChampionId));
}

function sanitizeLaneChampionMap(value: unknown, fallback: Record<Lane, number[]>): Record<Lane, number[]> {
  const source = isRecord(value) ? value : {};
  return LANES.reduce(
    (acc, lane) => {
      acc[lane] = sanitizeChampionList(source[lane], fallback[lane]);
      return acc;
    },
    {} as Record<Lane, number[]>,
  );
}

export class ConfigStore {
  private logger: Logger;
  private storeCache: StoredConfig | null = null;
  private snapshotCache: PluginConfig | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  getChangeEventName(): string {
    return CONFIG_CHANGE_EVENT;
  }

  getSnapshot(): PluginConfig {
    if (!this.snapshotCache) {
      this.snapshotCache = this.createSnapshot(this.readStore());
    }

    return this.snapshotCache;
  }

  get<K extends ConfigKey>(key: K): PluginConfig[K] {
    const fallback = cloneValue(CONFIG_DEFAULTS[key]);
    return this.readValue(key, fallback);
  }

  set<K extends ConfigKey>(key: K, value: PluginConfig[K]): void {
    const store = this.readStore();
    const sanitizedValue = this.sanitizeConfigValue(key, value);
    const nextStore: StoredConfig = {
      ...store,
      [key]: cloneValue(sanitizedValue),
    };

    this.storeCache = nextStore;
    this.snapshotCache = this.createSnapshot(nextStore);
    if (!window.DataStore.set(STORE_KEY, nextStore)) {
      this.logger.log("failed to persist config", key);
    }
    window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: { key, value: sanitizedValue } }));
  }

  toggle(key: ConfigKey): boolean {
    const current = this.get(key);
    if (typeof current !== "boolean") {
      throw new Error(`Cannot toggle non-boolean key: ${String(key)}`);
    }
    const nextValue = !current;
    this.set(key, nextValue as PluginConfig[ConfigKey]);
    return nextValue;
  }

  getChampion(type: "pick" | "ban", index: number): number {
    const key = `${type}-champions` as ConfigKey;
    const championIds = this.get(key) as number[];
    return championIds[index] ?? 0;
  }

  setChampion(type: "pick" | "ban", index: number, championId: number): void {
    const key = `${type}-champions` as ConfigKey;
    const championIds = [...(this.get(key) as number[])];
    championIds[index] = championId;
    this.set(key, championIds);
  }

  getLaneChampion(type: "pick" | "ban", lane: Lane, index: number): number {
    const key = `lane-${type}-champions` as ConfigKey;
    const laneChampions = this.get(key) as Record<Lane, number[]>;
    return laneChampions[lane]?.[index] ?? 0;
  }

  setLaneChampion(type: "pick" | "ban", lane: Lane, index: number, championId: number): void {
    const key = `lane-${type}-champions` as ConfigKey;
    const laneChampions = { ...(this.get(key) as Record<Lane, number[]>) };
    const list = laneChampions[lane] ? [...laneChampions[lane]] : [0, 0];
    list[index] = championId;
    laneChampions[lane] = list;
    this.set(key, laneChampions);
  }

  getEffectiveChampions(type: "pick" | "ban", lane?: Lane): number[] {
    const isPick = type === "pick";
    const modeKey = isPick ? "lane-based-pick" : "lane-based-ban";
    const laneActive = this.get(modeKey as ConfigKey);

    if (laneActive && lane && LANES.includes(lane)) {
      const key = `lane-${type}-champions` as ConfigKey;
      const laneChampions = this.get(key) as Record<Lane, number[]>;
      const laneList = laneChampions[lane];
      if (laneList && laneList.some((id) => id !== 0)) {
        return laneList;
      }
    }
    return this.get(`${type}-champions` as ConfigKey) as number[];
  }

  onChange(callback: (_detail: { key: string; value: unknown }) => void): () => void {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent;
      callback(customEvent.detail ?? {});
    };
    window.addEventListener(CONFIG_CHANGE_EVENT, listener);
    return () => window.removeEventListener(CONFIG_CHANGE_EVENT, listener);
  }

  getUiPreference<T>(key: string, fallback: T): T {
    return (window.DataStore.get(key, fallback) as T) ?? fallback;
  }

  setUiPreference<T>(key: string, value: T): void {
    if (!window.DataStore.set(key, value)) {
      this.logger.log("failed to persist ui preference", key);
    }
  }

  private readValue<K extends ConfigKey>(key: K, fallback: PluginConfig[K]): PluginConfig[K] {
    const store = this.readStore();
    if (Object.prototype.hasOwnProperty.call(store, key)) {
      const val = store[key];
      return val !== undefined ? (cloneValue(val) as PluginConfig[K]) : fallback;
    }
    return fallback;
  }

  private readStoredObject(): StoredConfig {
    for (const key of LEGACY_STORE_KEYS) {
      const value = window.DataStore.get(key);
      if (value && typeof value === "object") {
        return { ...(value as StoredConfig) };
      }
    }
    return {};
  }

  private readStore(): StoredConfig {
    if (!this.storeCache) {
      this.storeCache = this.migrateStore();
    }

    return this.storeCache;
  }

  private createSnapshot(store: StoredConfig): PluginConfig {
    return cloneValue(store as PluginConfig);
  }

  private sanitizeConfigValue<K extends ConfigKey>(key: K, value: unknown): PluginConfig[K] {
    switch (key) {
      case "auto-accept":
      case "auto-pick":
      case "auto-ban":
      case "lane-based-pick":
      case "lane-based-ban":
      case "force-pick":
      case "force-ban":
        return sanitizeBoolean(value, false) as PluginConfig[K];
      case "pick-champions":
        return sanitizeChampionList(value, CONFIG_DEFAULTS["pick-champions"]) as PluginConfig[K];
      case "ban-champions":
        return sanitizeChampionList(value, CONFIG_DEFAULTS["ban-champions"]) as PluginConfig[K];
      case "lane-pick-champions":
        return sanitizeLaneChampionMap(value, CONFIG_DEFAULTS["lane-pick-champions"]) as PluginConfig[K];
      case "lane-ban-champions":
        return sanitizeLaneChampionMap(value, CONFIG_DEFAULTS["lane-ban-champions"]) as PluginConfig[K];
      default:
        return cloneValue(CONFIG_DEFAULTS[key]);
    }
  }

  private migrateStore(): StoredConfig {
    const store = this.readStoredObject();
    const nextStore: StoredConfig = {};
    let changed = store.__migratedV1 !== true;

    for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
      const k = key as ConfigKey;
      let value: unknown = store[k];

      if (value === undefined) {
        for (const prefix of LEGACY_PREFIXES) {
          const legacyValue = window.DataStore.get(`${prefix}.${key}`);
          if (legacyValue !== undefined) {
            value = legacyValue;
            changed = true;
            break;
          }
        }
      }

      if (value === undefined) {
        value = cloneValue(defaultValue);
        changed = true;
      }

      const sanitizedValue = this.sanitizeConfigValue(k, value);
      (nextStore as Record<string, unknown>)[k] = sanitizedValue;
      if (!valuesEqual(sanitizedValue, store[k])) {
        changed = true;
      }
    }

    nextStore.__migratedV1 = true;

    if (changed || !store.__migratedV1) {
      if (!window.DataStore.set(STORE_KEY, nextStore)) {
        this.logger.log("failed to persist migrated store", STORE_KEY);
      }
      this.logger.log("store ready", nextStore);
    }

    this.storeCache = nextStore;
    return nextStore;
  }
}
