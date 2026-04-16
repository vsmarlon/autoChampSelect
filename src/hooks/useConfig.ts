import { useSyncExternalStore } from "react";
import { ConfigStore } from "../core/ConfigStore";
import { ConfigKey, PluginConfig } from "../core/lcu/types";

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
