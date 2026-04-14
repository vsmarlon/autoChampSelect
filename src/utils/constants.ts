import { PluginConfig, Lane } from "../core/lcu/types";

export type { Lane };

export const VERSION = "3.2.6";

export const CONFIG_CHANGE_EVENT = "select-config-change";

export const LANES = ["top", "jungle", "middle", "bottom", "utility"] as const;

export const LANE_LABELS: Record<Lane, string> = {
  top: "Top",
  jungle: "Jungle",
  middle: "Mid",
  bottom: "Bot",
  utility: "Support",
};

export const LANE_SHORT_LABELS: Record<Lane, string> = {
  top: "Top",
  jungle: "Jg",
  middle: "Mid",
  bottom: "Bot",
  utility: "Sup",
};

export const PRIORITY_SLOTS = [
  { index: 0, label: "1st" },
  { index: 1, label: "2nd" },
] as const;

export const CHAMP_SELECT_REPROCESS_KEYS = [
  "auto-pick",
  "auto-ban",
  "pick-champions",
  "ban-champions",
  "force-pick",
  "force-ban",
  "lane-based-pick",
  "lane-based-ban",
  "lane-pick-champions",
  "lane-ban-champions",
] as const;

export const CONFIG_DEFAULTS: PluginConfig = {
  "auto-accept": false,
  "auto-pick": false,
  "auto-ban": false,
  "pick-champions": [0, 0],
  "ban-champions": [0, 0],
  "lane-based-pick": false,
  "lane-based-ban": false,
  "force-pick": false,
  "force-ban": false,
  "lane-pick-champions": {
    top: [0, 0],
    jungle: [0, 0],
    middle: [0, 0],
    bottom: [0, 0],
    utility: [0, 0],
  },
  "lane-ban-champions": {
    top: [0, 0],
    jungle: [0, 0],
    middle: [0, 0],
    bottom: [0, 0],
    utility: [0, 0],
  },
};
