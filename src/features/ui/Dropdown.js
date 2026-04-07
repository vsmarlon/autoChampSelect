const SHADOW_READY_MAX_ATTEMPTS = 30;

export class Dropdown {
  constructor(configStore, label, configType, configIndex, championsGetter, options = {}) {
    this.configStore = configStore;
    this.label = label;
    this.configType = configType;
    this.configIndex = configIndex;
    this.championsGetter = championsGetter;
    this.dropUp = options.dropUp === true;
    this.lane = options.lane || null;
    this.champions = [];
    this.searchValue = "";
    this.setupDone = false;
    this.selectionObserver = null;
    this.element = document.createElement("lol-uikit-framed-dropdown");
    this.element.classList.add("select-dropdown");
    if (this.dropUp) {
      this.element.classList.add("select-dropdown--drop-up");
    }
    this.handleConfigChange = this.handleConfigChange.bind(this);
    this.handleDropdownChange = this.handleDropdownChange.bind(this);
  }

  async setup() {
    if (!this.setupDone) {
      this.setupDone = true;
      window.addEventListener(this.configStore.getChangeEventName(), this.handleConfigChange);
      this.element.addEventListener("change", this.handleDropdownChange);
    }

    this.champions = await this.championsGetter();
    if (!Array.isArray(this.champions)) {
      this.champions = [];
    }

    this.renderOptions();
    this.startSelectionObserver();
    await this.ensureShadowReady();
    this.decorateShadow();
    this.syncSelectionFromConfig();
    this.applyFilter(this.searchValue);
  }

  getSelectedChampionId() {
    if (this.lane) {
      return this.configStore.getLaneChampion(this.configType, this.lane, this.configIndex);
    }
    return this.configStore.getChampion(this.configType, this.configIndex);
  }

  setSelectedChampionId(championId) {
    if (this.lane) {
      this.configStore.setLaneChampion(this.configType, this.lane, this.configIndex, championId);
    } else {
      this.configStore.setChampion(this.configType, this.configIndex, championId);
    }
  }

  renderOptions() {
    const selectedChampionId = this.getSelectedChampionId();
    const added = new Set();
    this.element.replaceChildren();

    for (const champion of this.champions) {
      if (added.has(champion.name)) {
        continue;
      }

      added.add(champion.name);

      const option = document.createElement("lol-uikit-dropdown-option");
      option.setAttribute("slot", "lol-uikit-dropdown-option");
      option.dataset.championId = String(champion.id);
      option.innerText = champion.name;
      option.addEventListener("pointerdown", () => this.saveChampion(champion.id));
      option.addEventListener("click", () => this.saveChampion(champion.id));
      if (champion.id === selectedChampionId) {
        option.setAttribute("selected", "true");
      }
      this.element.appendChild(option);
    }
  }

  saveChampion(championId) {
    this.setSelectedChampionId(championId);
    this.syncSelectionFromConfig();
  }

  startSelectionObserver() {
    this.selectionObserver?.disconnect();
    this.selectionObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "attributes" || mutation.attributeName !== "selected") {
          continue;
        }

        const option = mutation.target;
        if (!(option instanceof Element) || !option.hasAttribute("selected")) {
          continue;
        }

        const championId = Number(option.dataset.championId);
        if (!Number.isNaN(championId)) {
          this.setSelectedChampionId(championId);
        }
      }
    });

    this.element.querySelectorAll("lol-uikit-dropdown-option").forEach((option) => {
      this.selectionObserver.observe(option, { attributes: true, attributeFilter: ["selected"] });
    });
  }

  syncSelectionFromConfig() {
    const selectedChampionId = String(this.getSelectedChampionId());
    this.element.querySelectorAll("lol-uikit-dropdown-option").forEach((option) => {
      option.toggleAttribute("selected", option.dataset.championId === selectedChampionId);
    });
  }

  async ensureShadowReady() {
    for (let attempt = 0; attempt < SHADOW_READY_MAX_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const root = this.element.shadowRoot;
      if (root?.querySelector(".ui-dropdown-current")) {
        return true;
      }
    }

    return false;
  }

  decorateShadow() {
    const root = this.element.shadowRoot;
    if (!root) {
      return;
    }

    const currentDropdown = root.querySelector(".ui-dropdown-current");
    if (!currentDropdown) {
      return;
    }

    currentDropdown.style.display = "flex";
    currentDropdown.style.justifyContent = "space-between";
    currentDropdown.style.paddingRight = "28px";

    if (!root.querySelector("#select-placeholder")) {
      currentDropdown.appendChild(this.createSearchPlaceholder());
    }

    if (!root.querySelector("style[data-select='dropdown-tags']")) {
      const style = document.createElement("style");
      style.dataset.select = "dropdown-tags";
      style.textContent = `
        .select-filter-icon {
          cursor: default;
          display: inline-block;
          width: 18px;
          height: 18px;
          background-color: #c8aa6e;
          -webkit-mask-image: url('/fe/lol-social/search_mask.png');
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: center;
          -webkit-mask-size: 18px 18px;
        }
        .select-filter-icon--trash {
          cursor: pointer;
          background-color: #c86e6e;
          -webkit-mask-image: url('/fe/lol-uikit/images/icon_delete.png');
          -webkit-mask-size: 12px 12px;
        }
        .select-filter-input {
          width: 72px;
          color: inherit;
          background: transparent;
          border: none;
          text-align: center;
          outline: none;
          font-family: inherit;
          font-size: inherit;
        }
        .select-tag {
          cursor: default;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 10px;
          border-radius: 999px;
          border: 1px solid #d7b46a;
          background: linear-gradient(145deg, #1a232f, #0f1722);
          color: #f6e1b2;
          font-size: 11px;
          white-space: nowrap;
        }
      `;
      root.appendChild(style);
    }

    const dropdownMenu = root.querySelector(".ui-dropdown-options-container");
    if (dropdownMenu) {
      dropdownMenu.style.transform = "translateY(0)";
      if (this.dropUp) {
        dropdownMenu.style.top = "auto";
        dropdownMenu.style.bottom = "100%";
        dropdownMenu.style.transformOrigin = "bottom";
      } else {
        dropdownMenu.style.top = "100%";
        dropdownMenu.style.bottom = "auto";
        dropdownMenu.style.transformOrigin = "top";
      }
    }

    const scrollableOptions = root.querySelector("lol-uikit-scrollable");
    if (scrollableOptions) {
      scrollableOptions.style.maxHeight = "250px";
    }
  }

  createSearchPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.classList.add("select-tag");
    placeholder.id = "select-placeholder";

    const filterIcon = document.createElement("span");
    filterIcon.classList.add("select-filter-icon");

    const input = document.createElement("input");
    input.classList.add("select-filter-input");
    input.type = "text";
    input.placeholder = this.label;
    input.value = this.searchValue;

    filterIcon.addEventListener("click", () => {
      if (!filterIcon.classList.contains("select-filter-icon--trash")) {
        return;
      }

      input.value = "";
      this.searchValue = "";
      this.applyFilter("");
      filterIcon.classList.remove("select-filter-icon--trash");
    });

    input.addEventListener("input", (event) => {
      this.searchValue = event.target.value;
      this.ensureIsOpened();
      this.applyFilter(this.searchValue);
      filterIcon.classList.toggle("select-filter-icon--trash", Boolean(this.searchValue));
    });

    ["pointerdown", "click"].forEach((type) => {
      placeholder.addEventListener(type, (event) => event.stopPropagation());
      filterIcon.addEventListener(type, (event) => event.stopPropagation());
    });
    ["pointerdown", "focusin"].forEach((type) => {
      input.addEventListener(type, (event) => event.stopPropagation(), true);
    });

    placeholder.append(filterIcon, input);
    return placeholder;
  }

  applyFilter(query) {
    const normalizedQuery = query.toLowerCase();
    this.element.querySelectorAll("lol-uikit-dropdown-option").forEach((option) => {
      option.style.display = option.innerText.toLowerCase().includes(normalizedQuery) ? "" : "none";
    });
  }

  isOpen() {
    return this.element.classList.contains("active");
  }

  ensureIsOpened() {
    if (this.isOpen()) {
      return;
    }

    this.element.shadowRoot?.querySelector(".ui-dropdown-current")?.click();
  }

  handleDropdownChange(event) {
    const eventOption = event?.target?.closest?.("lol-uikit-dropdown-option") ?? null;
    const selectedOption = eventOption ?? this.element.querySelector("lol-uikit-dropdown-option[selected]");
    if (!selectedOption) {
      return;
    }

    const championId = Number(selectedOption.dataset.championId);
    if (Number.isNaN(championId)) {
      return;
    }

    if (this.getSelectedChampionId() === championId) {
      return;
    }

    this.setSelectedChampionId(championId);
  }

  handleConfigChange(event) {
    const expectedKey = this.lane ? `lane-${this.configType}-champions` : `${this.configType}-champions`;
    if (event.detail?.key === expectedKey) {
      this.syncSelectionFromConfig();
    }
  }

  async refresh() {
    await this.setup();
  }

  destroy() {
    this.selectionObserver?.disconnect();
    window.removeEventListener(this.configStore.getChangeEventName(), this.handleConfigChange);
    this.element.removeEventListener("change", this.handleDropdownChange);
    this.element.remove();
  }
}
