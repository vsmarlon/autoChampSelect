import React from "react";
import { CheckboxProps } from "../../../utils/types";

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, id }) => {
  return (
    <button
      type="button"
      id={id}
      className={`select-toggle ${checked ? "select-toggle--active" : ""}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="select-toggle__label">{label}</span>
      <span className="select-toggle__meta">
        <span className="select-toggle__state">{checked ? "On" : "Off"}</span>
        <span className="select-toggle__indicator" aria-hidden="true" />
      </span>
    </button>
  );
};
