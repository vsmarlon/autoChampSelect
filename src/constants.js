export const VERSION = "3.2.4";

export const CONFIG_CHANGE_EVENT = "select-config-change";

export const LANES = ["top", "jungle", "middle", "bottom", "utility"];

export const LANE_LABELS = {
  top: "Top",
  jungle: "Jungle",
  middle: "Mid",
  bottom: "Bot",
  utility: "Support",
};

export const CONFIG_DEFAULTS = {
  "auto-accept": false,
  "auto-pick": false,
  "auto-ban": false,
  "pick-champions": [0, 0],
  "ban-champions": [0, 0],
  "force-pick": false,
  "force-ban": false,
  "lane-based-pick": false,
  "lane-based-ban": false,
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
