const STORE_KEY = "SelectAutoSelect";
const LEGACY_STORE_KEYS = ["SelectAutoSelect"];
const LEGACY_PREFIXES = ["select"];
const CONFIG_CHANGE_EVENT = "select-config-change";

const DEFAULTS = {
  "auto-accept": false,
  "auto-pick": false,
  "auto-ban": false,
  "pick-champions": [0, 0],
  "ban-champions": [0, 0],
  "force-pick": false,
  "force-ban": false,
};

function cloneValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

export class ConfigStore {
  constructor(logger) {
    this.logger = logger;
  }

  getChangeEventName() {
    return CONFIG_CHANGE_EVENT;
  }

  get(key) {
    return this.readValue(key, cloneValue(DEFAULTS[key]));
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

  ensureChampionDefaults(type, champions) {
    const key = `${type}-champions`;
    const current = [...this.get(key)];
    let changed = false;

    for (let index = 0; index < current.length; index += 1) {
      const championId = current[index];
      const hasSavedChampion = champions.some((champion) => champion.id === championId);

      if (hasSavedChampion) {
        continue;
      }

      const fallbackChampion = champions[index] ?? champions[0];
      if (!fallbackChampion) {
        continue;
      }

      current[index] = fallbackChampion.id;
      changed = true;
    }

    if (changed) {
      this.set(key, current);
    }

    return current;
  }

  onChange(callback) {
    const listener = (event) => callback(event.detail ?? {});
    window.addEventListener(CONFIG_CHANGE_EVENT, listener);
    return () => window.removeEventListener(CONFIG_CHANGE_EVENT, listener);
  }

  readValue(key, fallback = null) {
    const store = this.migrateStore();
    if (Object.prototype.hasOwnProperty.call(store, key)) {
      return store[key];
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

    for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
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
