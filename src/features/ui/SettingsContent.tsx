import React, { useState } from "react";
import { useApp } from "./AppContext";
import { useAllChampions } from "../../hooks/useChampions";
import { useFullConfig } from "../../hooks/useConfig";
import { LaneTabs } from "./components/LaneTabs";
import { PrioritySlotPair } from "./components/PrioritySlotPair";
import { Checkbox } from "./components/Checkbox";
import { Lane } from "../../utils/constants";

interface SettingsContentProps {
  variant?: "compact" | "modal";
}

function getEffectiveValues(
  values: number[],
  laneValues: Record<Lane, number[]>,
  laneEnabled: boolean,
  activeLane: Lane,
): number[] {
  if (!laneEnabled) {
    return values;
  }

  const activeValues = laneValues[activeLane];
  return activeValues && activeValues.some((value) => value !== 0) ? activeValues : values;
}

export function SettingsContent({ variant = "compact" }: SettingsContentProps): React.JSX.Element {
  const { configStore, championRepository } = useApp();
  const [activeLane, setActiveLane] = useState<Lane>("top");
  const config = useFullConfig(configStore);
  const champions = useAllChampions(championRepository);

  const pickValues = getEffectiveValues(
    config["pick-champions"],
    config["lane-pick-champions"],
    config["lane-based-pick"],
    activeLane,
  );
  const banValues = getEffectiveValues(
    config["ban-champions"],
    config["lane-ban-champions"],
    config["lane-based-ban"],
    activeLane,
  );

  return (
    <div className={`select-settings-content select-settings-content--${variant}`}>
      {variant === "modal" ? (
        <div className="select-settings-content__toggles-grid">
          <Checkbox
            label="Auto Accept"
            checked={config["auto-accept"]}
            onChange={(value) => configStore.set("auto-accept", value)}
          />
          <Checkbox
            label="Auto Pick"
            checked={config["auto-pick"]}
            onChange={(value) => configStore.set("auto-pick", value)}
          />
          <Checkbox
            label="Auto Ban"
            checked={config["auto-ban"]}
            onChange={(value) => configStore.set("auto-ban", value)}
          />
        </div>
      ) : null}

      <div className="select-settings-content__mode-grid">
        <Checkbox
          label="Lane-Based Picks"
          checked={config["lane-based-pick"]}
          onChange={(value) => configStore.set("lane-based-pick", value)}
        />
        <Checkbox
          label="Lane-Based Bans"
          checked={config["lane-based-ban"]}
          onChange={(value) => configStore.set("lane-based-ban", value)}
        />
      </div>

      {config["lane-based-pick"] || config["lane-based-ban"] ? (
        <section className="select-settings-content__section select-settings-content__section--framed">
          <div className="select-settings-content__section-header">
            <h3 className="select-settings-content__section-title">Lane Profiles</h3>
            <span className="select-settings-content__section-copy">Override global choices by assigned role.</span>
          </div>
          <div className="select-settings-content__lane-content">
            <LaneTabs activeLane={activeLane} onLaneChange={setActiveLane} compact={variant === "compact"} />
            {config["lane-based-pick"] ? (
              <PrioritySlotPair
                type="pick"
                champions={champions}
                values={pickValues}
                onSlotChange={(index, championId) => configStore.setLaneChampion("pick", activeLane, index, championId)}
              />
            ) : null}
            {config["lane-based-ban"] ? (
              <PrioritySlotPair
                type="ban"
                champions={champions}
                values={banValues}
                onSlotChange={(index, championId) => configStore.setLaneChampion("ban", activeLane, index, championId)}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {!config["lane-based-pick"] ? (
        <section className="select-settings-content__section select-settings-content__section--framed">
          <div className="select-settings-content__section-header">
            <h3 className="select-settings-content__section-title">Global Picks</h3>
            <span className="select-settings-content__section-copy">
              Default champion priority when no lane override applies.
            </span>
          </div>
          <PrioritySlotPair
            type="pick"
            champions={champions}
            values={config["pick-champions"]}
            onSlotChange={(index, championId) => configStore.setChampion("pick", index, championId)}
          />
        </section>
      ) : null}

      {!config["lane-based-ban"] ? (
        <section className="select-settings-content__section select-settings-content__section--framed">
          <div className="select-settings-content__section-header">
            <h3 className="select-settings-content__section-title">Global Bans</h3>
            <span className="select-settings-content__section-copy">
              Fallback ban priority shared across queues and lobbies.
            </span>
          </div>
          <PrioritySlotPair
            type="ban"
            champions={champions}
            values={config["ban-champions"]}
            onSlotChange={(index, championId) => configStore.setChampion("ban", index, championId)}
          />
        </section>
      ) : null}

      {champions.length === 0 ? (
        <div className="select-settings-content__state-text">Loading cached champion data...</div>
      ) : null}
    </div>
  );
}
