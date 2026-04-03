const STORE_KEY = "SelectAutoSelect";
const LEGACY_STORE_KEYS = ["SelectAutoSelect", "ControladoAutoSelect"];
const LEGACY_PREFIXES = ["select", "controlado"];
const CONFIG_CHANGE_EVENT = "select-config-change";
const DEBUG = false;

const DEFAULTS = {
    "auto-accept": false,
    "auto-pick": false,
    "auto-ban": false,
    "pick-champions": [0, 0],
    "ban-champions": [0, 0],
    "force-pick": false,
    "force-ban": false,
};

function log(...args) {
    if (DEBUG) {
        console.log("[select][config]", ...args);
    }
}

function cloneDefaultValue(value) {
    return Array.isArray(value) ? [...value] : value;
}

function getStore() {
    for (const key of LEGACY_STORE_KEYS) {
        const value = window.DataStore.get(key);
        if (value && typeof value === "object") {
            return { ...value };
        }
    }

    return {};
}

function setStore(store) {
    window.DataStore.set(STORE_KEY, store);
}

function migrateLegacyStore() {
    const store = getStore();

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
                log("migrated legacy key", `${prefix}.${key}`, legacyValue);
                break;
            }
        }

        if (Object.prototype.hasOwnProperty.call(nextStore, key)) {
            continue;
        }

        nextStore[key] = cloneDefaultValue(defaultValue);
        changed = true;
    }

    nextStore.__migratedV1 = true;

    if (changed || !store.__migratedV1) {
        setStore(nextStore);
        log("store ready", nextStore);
    }

    return nextStore;
}

const SelectData = {
    get(key, fallback = null) {
        const store = migrateLegacyStore();
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : fallback;
    },

    set(key, value) {
        const store = migrateLegacyStore();
        store[key] = value;
        setStore(store);
        log("set", key, value);
        return true;
    },

    has(key) {
        const store = migrateLegacyStore();
        return Object.prototype.hasOwnProperty.call(store, key);
    },
};

window.SelectData = SelectData;

export { CONFIG_CHANGE_EVENT };

export function get(key) {
    return SelectData.get(key, cloneDefaultValue(DEFAULTS[key]));
}

export function set(key, value) {
    SelectData.set(key, value);
    window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, {
        detail: { key, value },
    }));
}

export function toggle(key) {
    const nextValue = !Boolean(get(key));
    set(key, nextValue);
    return nextValue;
}

export function ensureChampionDefaults(type, champions) {
    const key = `${type}-champions`;
    const current = [...get(key)];
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
        log("defaulted champion", key, index, fallbackChampion.id);
    }

    if (changed) {
        set(key, current);
    }

    return current;
}

export function getChampion(type, index) {
    const champions = get(`${type}-champions`);
    return champions[index] ?? 0;
}

export function setChampion(type, index, championId) {
    const key = `${type}-champions`;
    const champions = [...get(key)];
    champions[index] = championId;
    set(key, champions);
}

export function onConfigChange(callback) {
    window.addEventListener(CONFIG_CHANGE_EVENT, callback);
    return () => window.removeEventListener(CONFIG_CHANGE_EVENT, callback);
}
