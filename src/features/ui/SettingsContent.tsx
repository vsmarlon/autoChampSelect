import React, { useState } from "react";
import { useApp } from "./AppContext";
import { useAllChampions } from "../../hooks/useChampions";
import { useFullConfig } from "../../hooks/useConfig";
import { LaneTabs } from "./components/LaneTabs";
import { PrioritySlotPair } from "./components/PrioritySlotPair";
import { Checkbox } from "./components/Checkbox";
import { DelayInput } from "./components/DelayInput";
import {
  Lane,
  MAX_BAN_DELAY_SECONDS,
  MAX_PICK_DELAY_SECONDS,
  TOGGLE_CONFIG,
  MODE_CONFIG,
  GLOBAL_PICK_CONFIG,
  GLOBAL_BAN_CONFIG,
} from "../../utils/constants";
import { SettingsContentProps, DelayConfigKey, SectionProps } from "../../utils/types";
import { parseDelaySeconds } from "../../utils/validation";
import { getEffectiveValues } from "../../utils/champions";

export function SettingsContent({ variant = "compact" }: SettingsContentProps): React.JSX.Element {
  const { configStore, championRepository } = useApp();
  const [activeLane, setActiveLane] = useState<Lane>("top");
  const config = useFullConfig(configStore);
  const champions = useAllChampions(championRepository);

  const setDelaySeconds = (key: DelayConfigKey, value: string) => {
    const max = key === "pick-delay-seconds" ? MAX_PICK_DELAY_SECONDS : MAX_BAN_DELAY_SECONDS;
    configStore.set(key, parseDelaySeconds(value, max));
  };

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

  const hasLaneProfiles = config["lane-based-pick"] || config["lane-based-ban"];
  const delayInputs = [
    {
      label: "Pick Delay",
      key: "pick-delay-seconds" as const,
      max: MAX_PICK_DELAY_SECONDS,
      value: config["pick-delay-seconds"],
    },
    {
      label: "Ban Delay",
      key: "ban-delay-seconds" as const,
      max: MAX_BAN_DELAY_SECONDS,
      value: config["ban-delay-seconds"],
    },
  ];

  return (
    <div className={`select-settings-content select-settings-content--${variant}`}>
      {variant === "modal" && (
        <div className="select-settings-content__toggles-grid">
          {TOGGLE_CONFIG.map(({ label, key }) => (
            <Checkbox key={key} label={label} checked={config[key]} onChange={(v) => configStore.set(key, v)} />
          ))}
        </div>
      )}

      <div className="select-settings-content__mode-grid">
        {MODE_CONFIG.map(({ label, key }) => (
          <Checkbox key={key} label={label} checked={config[key]} onChange={(v) => configStore.set(key, v)} />
        ))}
      </div>

      <section className="select-settings-content__section select-settings-content__section--framed">
        <div className="select-settings-content__section-header">
          <h3 className="select-settings-content__section-title">Action Delay</h3>
          <span className="select-settings-content__section-copy">
            Pick delay also controls pick intent. Pick max {MAX_PICK_DELAY_SECONDS} sec, ban max {MAX_BAN_DELAY_SECONDS}{" "}
            sec. Fractional seconds allowed. Use 0 for instant.
          </span>
        </div>
        <div className="select-settings-content__delay-grid">
          {delayInputs.map((input) => (
            <DelayInput
              key={input.key}
              label={input.label}
              configKey={input.key}
              maxValue={input.max}
              value={input.value}
              onChange={setDelaySeconds}
            />
          ))}
        </div>
      </section>

      {hasLaneProfiles && (
        <section className="select-settings-content__section select-settings-content__section--framed">
          <div className="select-settings-content__section-header">
            <h3 className="select-settings-content__section-title">Lane Profiles</h3>
            <span className="select-settings-content__section-copy">Override global choices by assigned role.</span>
          </div>
          <div className="select-settings-content__lane-content">
            <LaneTabs activeLane={activeLane} onLaneChange={setActiveLane} compact={variant === "compact"} />
            {config["lane-based-pick"] && (
              <PrioritySlotPair
                type="pick"
                champions={champions}
                values={pickValues}
                onSlotChange={(_i, _id) => configStore.setLaneChampion("pick", activeLane, _i, _id)}
              />
            )}
            {config["lane-based-ban"] && (
              <PrioritySlotPair
                type="ban"
                champions={champions}
                values={banValues}
                onSlotChange={(_i, _id) => configStore.setLaneChampion("ban", activeLane, _i, _id)}
              />
            )}
          </div>
        </section>
      )}

      {!config["lane-based-pick"] && (
        <SectionWithPrioritySlot
          config={GLOBAL_PICK_CONFIG}
          champions={champions}
          values={config["pick-champions"]}
          onSlotChange={(_i, _id) => configStore.setChampion("pick", _i, _id)}
        />
      )}

      {!config["lane-based-ban"] && (
        <SectionWithPrioritySlot
          config={GLOBAL_BAN_CONFIG}
          champions={champions}
          values={config["ban-champions"]}
          onSlotChange={(_i, _id) => configStore.setChampion("ban", _i, _id)}
        />
      )}

      {champions.length === 0 && (
        <div className="select-settings-content__state-text">Loading cached champion data...</div>
      )}
    </div>
  );
}

function SectionWithPrioritySlot({ config, champions, values, onSlotChange }: SectionProps): React.JSX.Element {
  return (
    <section className="select-settings-content__section select-settings-content__section--framed">
      <div className="select-settings-content__section-header">
        <h3 className="select-settings-content__section-title">{config.label}</h3>
        <span className="select-settings-content__section-copy">{config.copy}</span>
      </div>
      <PrioritySlotPair type={config.type} champions={champions} values={values} onSlotChange={onSlotChange} />
    </section>
  );
}
