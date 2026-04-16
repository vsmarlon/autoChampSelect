import { ChampionSummary, Lane, PluginConfig } from "../core/lcu/types";

export type { Lane };

export const VERSION = "3.2.7";

export const STORE_KEY = "SelectAutoSelect";
export const LEGACY_STORE_KEYS = ["SelectAutoSelect"];
export const LEGACY_PREFIXES = ["select"];

export const EMPTY_CHAMPIONS: ChampionSummary[] = [];
export const OWNED_CHAMPION_RETRY_DELAYS_MS = [500, 1500] as const;
export const ALL_CHAMPION_RETRY_DELAYS_MS = [500] as const;

export const LABEL_STYLE = "background: #7b1fa2; color: #fff; font-weight: bold; padding: 1px 6px; border-radius: 3px;";
export const SCOPE_STYLE = "background: #333; color: #fff; font-weight: bold; padding: 1px 6px; border-radius: 3px;";
export const RESET_STYLE = "color: inherit;";

export const HOME_PANEL_STATE_KEY = "SelectAutoSelect.ui.home-open";
export const HOME_PANEL_SELECTORS = [".lol-social-roster", "lol-social-roster", ".social-roster"] as const;
export const CHAMP_SELECT_BUTTON_SELECTORS = [".bottom-right-buttons", ".bottom-right"] as const;

export const CONFIG_CHANGE_EVENT = "select-config-change";

export const MAX_PICK_DELAY_SECONDS = 25;
export const MAX_BAN_DELAY_SECONDS = 20;

export const DELAY_JITTER_MS = 500;

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
  "pick-delay-seconds",
  "ban-delay-seconds",
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
  "pick-delay-seconds": 0,
  "ban-delay-seconds": 0,
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

export const TOGGLE_CONFIG = [
  { label: "Auto Accept", key: "auto-accept" },
  { label: "Auto Pick", key: "auto-pick" },
  { label: "Auto Ban", key: "auto-ban" },
] as const;

export const MODE_CONFIG = [
  { label: "Lane-Based Picks", key: "lane-based-pick" as const },
  { label: "Lane-Based Bans", key: "lane-based-ban" as const },
];

export const GLOBAL_PICK_CONFIG = {
  type: "pick" as const,
  label: "Global Picks",
  copy: "Default champion priority when no lane override applies.",
};
export const GLOBAL_BAN_CONFIG = {
  type: "ban" as const,
  label: "Global Bans",
  copy: "Fallback ban priority shared across queues and lobbies.",
};
