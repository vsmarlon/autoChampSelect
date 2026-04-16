import React from "react";
import { PrioritySlotPairProps } from "../../../utils/types";
import { ChampionDropdown } from "./ChampionDropdown";

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
