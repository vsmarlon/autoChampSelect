import { ChampionSummary, Lane } from "../core/lcu/types";

export interface Props {
  onOpen: () => void;
}

export interface ChampionDropdownProps {
  label: string;
  value: number;
  champions: ChampionSummary[];
  onChange: (_id: number) => void;
  placeholder?: string;
}

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (_checked: boolean) => void;
  id?: string;
}

export interface LaneTabsProps {
  activeLane: Lane;
  onLaneChange: (_lane: Lane) => void;
  compact?: boolean;
}

export interface PrioritySlotPairProps {
  type: "pick" | "ban";
  champions: ChampionSummary[];
  values: number[];
  onSlotChange: (_index: number, _id: number) => void;
}

export interface AppContextValue {
  configStore: import("../core/ConfigStore").ConfigStore;
  championRepository: import("../core/ChampionRepository").ChampionRepository;
  logger: import("../core/Logger").Logger;
}

export interface SettingsContentProps {
  variant?: "compact" | "modal";
}

export type DelayConfigKey = "pick-delay-seconds" | "ban-delay-seconds";

export interface UiRoot {
  render(_node: import("react").ReactNode): void;
  unmount(): void;
}

export interface ScheduledActionLock {
  actionId: number;
  type: "pick" | "ban";
  startedAt: number;
  baseDelayMs: number;
  delayMs: number;
  timeoutId: number | null;
  executing: boolean;
}

export interface ScheduledPickIntent {
  actionId: number;
  startedAt: number;
  baseDelayMs: number;
  delayMs: number;
  timeoutId: number | null;
  executing: boolean;
}

export interface CandidateSelection {
  championId: number | null;
  candidates: number[];
  rejectedCandidates: string[];
}

export interface SectionProps {
  config: { type: "pick" | "ban"; label: string; copy: string };
  champions: ChampionSummary[];
  values: number[];
  onSlotChange: (_index: number, _id: number) => void;
}
