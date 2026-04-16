import React from "react";
import { Props } from "../../utils/types";

export function ChampSelectEntry({ onOpen }: Props): React.JSX.Element {
  return (
    <button type="button" className="select-action-button" onClick={onOpen}>
      Auto Select
    </button>
  );
}
