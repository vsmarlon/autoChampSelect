import React from "react";
import { LANE_LABELS, LANE_SHORT_LABELS, Lane, LANES } from "../../../utils/constants";

interface LaneTabsProps {
  activeLane: Lane;
  onLaneChange: (_lane: Lane) => void;
  compact?: boolean;
}

export const LaneTabs: React.FC<LaneTabsProps> = ({ activeLane, onLaneChange, compact = false }) => {
  return (
    <div className="select-lane-tabs">
      {LANES.map((lane: Lane) => (
        <button
          type="button"
          key={lane}
          className={`select-lane-tabs__tab ${activeLane === lane ? "select-lane-tabs__tab--active" : ""}`}
          onClick={() => onLaneChange(lane)}
        >
          <span className="select-lane-tabs__text">{compact ? LANE_SHORT_LABELS[lane] : LANE_LABELS[lane]}</span>
        </button>
      ))}
    </div>
  );
};
