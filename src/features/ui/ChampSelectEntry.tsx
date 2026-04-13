import React from "react";

interface ChampSelectEntryProps {
  onOpen: () => void;
}

export function ChampSelectEntry({ onOpen }: ChampSelectEntryProps): React.JSX.Element {
  return (
    <button type="button" className="select-action-button" onClick={onOpen}>
      Auto Select
    </button>
  );
}
