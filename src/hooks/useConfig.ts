import { useSyncExternalStore } from "react";
import { ConfigStore } from "../core/ConfigStore";
import { ConfigKey, PluginConfig } from "../core/lcu/types";

/**
 * A React hook that provides reactive access to a specific configuration key.
 * Uses useSyncExternalStore for robust synchronization with the ConfigStore.
 */
export function useConfig<K extends ConfigKey>(configStore: ConfigStore, key: K): PluginConfig[K] {
  return useSyncExternalStore(
    (onStoreChange) => configStore.onChange(onStoreChange),
    () => configStore.getSnapshot()[key],
  );
}

export function useFullConfig(configStore: ConfigStore): PluginConfig {
  return useSyncExternalStore(
    (onStoreChange) => configStore.onChange(onStoreChange),
    () => configStore.getSnapshot(),
  );
}
