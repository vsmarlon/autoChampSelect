import { CONFIG_CHANGE_EVENT, CONFIG_DEFAULTS, LANES } from "../constants.js";

const STORE_KEY = "SelectAutoSelect";
const LEGACY_STORE_KEYS = ["SelectAutoSelect"];
const LEGACY_PREFIXES = ["select"];

function cloneValue(value) {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (value && typeof value === "object") {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

export class ConfigStore {
  constructor(logger) {
    this.logger = logger;
  }

  getChangeEventName() {
    return CONFIG_CHANGE_EVENT;
  }

  get(key) {
    return this.readValue(key, cloneValue(CONFIG_DEFAULTS[key]));
  }

  set(key, value) {
    const store = this.migrateStore();
    store[key] = value;
    window.DataStore.set(STORE_KEY, store);
    window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: { key, value } }));
  }

  toggle(key) {
    const nextValue = !this.get(key);
    this.set(key, nextValue);
    return nextValue;
  }

  getChampion(type, index) {
    const championIds = this.get(`${type}-champions`);
    return championIds[index] ?? 0;
  }

  setChampion(type, index, championId) {
    const key = `${type}-champions`;
    const championIds = [...this.get(key)];
    championIds[index] = championId;
    this.set(key, championIds);
  }

  getLaneChampion(type, lane, index) {
    const laneChampions = this.get(`lane-${type}-champions`);
    return laneChampions[lane]?.[index] ?? 0;
  }

  setLaneChampion(type, lane, index, championId) {
    const key = `lane-${type}-champions`;
    const laneChampions = this.get(key);
    if (!laneChampions[lane]) {
      laneChampions[lane] = [0, 0];
    }
    laneChampions[lane][index] = championId;
    this.set(key, laneChampions);
  }

  getEffectiveChampions(type, lane) {
    const laneActive = this.get("lane-based-pick") || this.get("lane-based-ban");
    if (laneActive && lane && LANES.includes(lane)) {
      const laneChampions = this.get(`lane-${type}-champions`);
      const laneList = laneChampions[lane];
      if (laneList && laneList.some((id) => id !== 0)) {
        return laneList;
      }
    }
    return this.get(`${type}-champions`);
  }


  onChange(callback) {
    const listener = (event) => callback(event.detail ?? {});
    window.addEventListener(CONFIG_CHANGE_EVENT, listener);
    return () => window.removeEventListener(CONFIG_CHANGE_EVENT, listener);
  }

  readValue(key, fallback = null) {
    const store = this.migrateStore();
    if (Object.prototype.hasOwnProperty.call(store, key)) {
      return cloneValue(store[key]);
    }

    return fallback;
  }

  readStoredObject() {
    for (const key of LEGACY_STORE_KEYS) {
      const value = window.DataStore.get(key);
      if (value && typeof value === "object") {
        return { ...value };
      }
    }

    return {};
  }

  migrateStore() {
    const store = this.readStoredObject();
    if (store.__migratedV1) {
      return store;
    }

    const nextStore = { ...store };
    let changed = false;

    for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
      if (Object.prototype.hasOwnProperty.call(nextStore, key)) {
        continue;
      }

      for (const prefix of LEGACY_PREFIXES) {
        const legacyValue = window.DataStore.get(`${prefix}.${key}`);
        if (legacyValue !== undefined) {
          nextStore[key] = legacyValue;
          changed = true;
          break;
        }
      }

      if (Object.prototype.hasOwnProperty.call(nextStore, key)) {
        continue;
      }

      nextStore[key] = cloneValue(defaultValue);
      changed = true;
    }

    nextStore.__migratedV1 = true;

    if (changed || !store.__migratedV1) {
      window.DataStore.set(STORE_KEY, nextStore);
      this.logger.log("store ready", nextStore);
    }

    return nextStore;
  }
}
