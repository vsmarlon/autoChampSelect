import React from "react";
import { DelayConfigKey } from "../../../utils/types";

export interface DelayInputProps {
  label: string;
  configKey: DelayConfigKey;
  maxValue: number;
  value: number;
  onChange: (_key: DelayConfigKey, _value: string) => void;
}

export const DelayInput: React.FC<DelayInputProps> = ({ label, configKey, maxValue, value, onChange }) => {
  return (
    <label className="select-delay-field">
      <span className="select-delay-field__label">{label}</span>
      <span className="select-delay-field__input-row">
        <input
          className="select-delay-field__input"
          type="number"
          min={0}
          max={maxValue}
          step={0.1}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(configKey, event.target.value)}
        />
        <span className="select-delay-field__unit">sec</span>
      </span>
    </label>
  );
};
