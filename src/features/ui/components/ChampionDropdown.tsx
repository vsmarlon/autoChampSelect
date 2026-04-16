import React, { useDeferredValue, useMemo, useState } from "react";
import { ChampionDropdownProps } from "../../../utils/types";

export const ChampionDropdown: React.FC<ChampionDropdownProps> = ({
  label,
  value,
  champions,
  onChange,
  placeholder = "None",
}) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const selectedChampion = useMemo(
    () => champions.find((champion) => champion.id === value) ?? null,
    [champions, value],
  );

  const filteredChampions = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return champions.slice(0, 8);
    }

    return champions.filter((c) => c.name.toLowerCase().includes(normalizedSearch)).slice(0, 8);
  }, [champions, deferredSearch]);
  const inputValue = search || selectedChampion?.name || "";

  const selectChampion = (championId: number) => {
    onChange(championId);
    setSearch("");
    setIsOpen(false);
  };

  return (
    <div className="select-champion-dropdown">
      <label className="select-champion-dropdown__label">{label}</label>
      <div className="select-champion-dropdown__input-anchor">
        <div className="select-champion-dropdown__search-row">
          <input
            type="text"
            className="select-champion-dropdown__search-input"
            placeholder={placeholder}
            value={inputValue}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              setIsOpen(false);
              setSearch("");
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setIsOpen(true);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {(search || value !== 0) && (
            <button
              type="button"
              className="select-champion-dropdown__clear"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(0);
                setSearch("");
                setIsOpen(false);
              }}
            >
              Clear
            </button>
          )}
        </div>
        {isOpen ? (
          <div className="select-champion-dropdown__menu" role="listbox" aria-label={`${label} suggestions`}>
            {!search ? (
              <button
                type="button"
                className={`select-champion-dropdown__option ${value === 0 ? "select-champion-dropdown__option--active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectChampion(0)}
              >
                {placeholder}
              </button>
            ) : null}
            {filteredChampions.map((champion) => (
              <button
                type="button"
                key={champion.id}
                className={`select-champion-dropdown__option ${champion.id === value ? "select-champion-dropdown__option--active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectChampion(champion.id)}
              >
                {champion.name}
              </button>
            ))}
            {search && filteredChampions.length === 0 ? (
              <div className="select-champion-dropdown__empty">No champions match.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
