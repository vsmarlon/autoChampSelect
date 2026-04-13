export type Lane = "top" | "jungle" | "middle" | "bottom" | "utility";
export type AssignedPosition = Lane | "";

export interface ChampionSummary {
  id: number;
  name: string;
  alias: string;
}

export interface LcuAction {
  id: number;
  actorCellId: number;
  championId: number;
  completed: boolean;
  isAllyAction: boolean;
  isInProgress: boolean;
  pickTurn?: number;
  type: "pick" | "ban" | string;
}

export interface LcuPlayer {
  cellId: number;
  championId: number;
  championPickIntent: number;
  entitledFeatureType: string;
  selectedSkinId: number;
  spell1Id: number;
  spell2Id: number;
  summonerId: number;
  team: number;
  wardSkinId: number;
  assignedPosition: AssignedPosition;
}

export interface LcuBans {
  myTeamBans: number[];
  theirTeamBans: number[];
  numBans: number;
}

export interface LcuSession {
  actions: LcuAction[][];
  allowBattleBoost: boolean;
  allowDuplicatePicks: boolean;
  allowLockedEvents: boolean;
  allowRerolling: boolean;
  allowSummonerSpellEdit: boolean;
  bans: LcuBans;
  benchChampions: unknown[];
  benchEnabled: boolean;
  boostableSkinCount: number;
  chatDetails: unknown;
  counter: number;
  entitledFeatureState: unknown;
  gameId: number;
  hasPreMadeTeamSizeCheck: boolean;
  isCustomGame: boolean;
  isSpectating: boolean;
  localPlayerCellId: number;
  myTeam: LcuPlayer[];
  recoveryCounter: number;
  rerollsLeft: number;
  skipChampionSelect: boolean;
  theirTeam: LcuPlayer[];
  timer: {
    adjustedTimeLeftInPhase: number;
    internalNowInEpochMs: number;
    isInfinite: boolean;
    phase: string;
    totalTimeInPhase: number;
  };
}

export interface PluginConfig {
  "auto-accept": boolean;
  "auto-pick": boolean;
  "auto-ban": boolean;
  "pick-champions": number[];
  "ban-champions": number[];
  "lane-based-pick": boolean;
  "lane-based-ban": boolean;
  "lane-pick-champions": Record<Lane, number[]>;
  "lane-ban-champions": Record<Lane, number[]>;
  "force-pick": boolean;
  "force-ban": boolean;
}

export type ConfigKey = keyof PluginConfig;
