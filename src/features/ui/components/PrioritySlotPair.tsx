import React from "react";
import { ChampionSummary } from "../../../core/lcu/types";
import { ChampionDropdown } from "./ChampionDropdown";

interface PrioritySlotPairProps {
  type: "pick" | "ban";
  champions: ChampionSummary[];
  values: number[]; // [1stPick, 2ndPick]
  onSlotChange: (_index: number, _id: number) => void;
}

export const PrioritySlotPair: React.FC<PrioritySlotPairProps> = ({ type, champions, values, onSlotChange }) => {
  const labelPrefix = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div className="select-priority-pair">
      <ChampionDropdown
        label={`${labelPrefix} 1`}
        value={values[0]}
        champions={champions}
        onChange={(id) => onSlotChange(0, id)}
      />
      <ChampionDropdown
        label={`${labelPrefix} 2`}
        value={values[1]}
        champions={champions}
        onChange={(id) => onSlotChange(1, id)}
      />
    </div>
  );
};
