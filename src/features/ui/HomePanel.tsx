import React, { useState } from "react";
import { useApp } from "./AppContext";
import { useFullConfig } from "../../hooks/useConfig";
import { SettingsContent } from "./SettingsContent";
import { HOME_PANEL_STATE_KEY } from "../../utils/constants";

export const HomePanel: React.FC = () => {
  const { configStore } = useApp();
  const config = useFullConfig(configStore);
  const [isOpen, setIsOpen] = useState(() => configStore.getUiPreference(HOME_PANEL_STATE_KEY, true));
  const states = [
    { label: "Accept", key: "auto-accept" as const, enabled: config["auto-accept"] },
    { label: "Pick", key: "auto-pick" as const, enabled: config["auto-pick"] },
    { label: "Ban", key: "auto-ban" as const, enabled: config["auto-ban"] },
  ];

  const handleToggle = () => {
    setIsOpen((current) => {
      const next = !current;
      configStore.setUiPreference(HOME_PANEL_STATE_KEY, next);
      return next;
    });
  };

  return (
    <div className="select-home-panel">
      <button type="button" className="select-home-panel__header" onClick={handleToggle}>
        <span className="select-home-panel__header-text">
          <span className="select-home-panel__title">Auto Champion Select</span>
          <span className="select-home-panel__subtitle">Lobby control surface for ready, pick, and ban automation</span>
        </span>
        <span
          className={`select-home-panel__chevron ${isOpen ? "select-home-panel__chevron--open" : ""}`}
          aria-hidden="true"
        >
          ^
        </span>
      </button>
      <div className="select-home-panel__status-row">
        {states.map((state) => (
          <button
            type="button"
            key={state.label}
            className={`select-home-panel__status-chip ${state.enabled ? "select-home-panel__status-chip--enabled" : ""}`}
            aria-pressed={state.enabled}
            onClick={() => configStore.set(state.key, !state.enabled)}
          >
            <span className="select-home-panel__status-label">{state.label}</span>
            <span className="select-home-panel__status-dot" aria-hidden="true" />
          </button>
        ))}
      </div>
      {isOpen ? (
        <div className="select-home-panel__content">
          <SettingsContent variant="compact" />
        </div>
      ) : null}
    </div>
  );
};
