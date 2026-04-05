class Checkbox {
  constructor(configStore, label, configKey, logger) {
    this.configStore = configStore;
    this.label = label;
    this.configKey = configKey;
    this.logger = logger;
    this.element = document.createElement("lol-uikit-radio-input-option");
    this.element.classList.add("lol-settings-voice-input-mode-option", "select-checkbox");
    this.element.innerText = label;
    this.handleClick = this.handleClick.bind(this);
    this.handleConfigChange = this.handleConfigChange.bind(this);
  }

  setup() {
    this.element.addEventListener("click", this.handleClick);
    window.addEventListener(this.configStore.getChangeEventName(), this.handleConfigChange);
    this.render();
  }

  render() {
    this.element.toggleAttribute("selected", Boolean(this.configStore.get(this.configKey)));
  }

  handleClick() {
    this.configStore.toggle(this.configKey);
  }

  handleConfigChange(event) {
    if (event.detail?.key === this.configKey) {
      this.render();
    }
  }

  destroy() {
    this.element.removeEventListener("click", this.handleClick);
    window.removeEventListener(this.configStore.getChangeEventName(), this.handleConfigChange);
    this.element.remove();
  }
}

class Dropdown {
  constructor(configStore, label, configType, configIndex, championsGetter, logger, options = {}) {
    this.configStore = configStore;
    this.label = label;
    this.configType = configType;
    this.configIndex = configIndex;
    this.championsGetter = championsGetter;
    this.logger = logger;
    this.dropUp = options.dropUp === true;
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

    this.configStore.ensureChampionDefaults(this.configType, this.champions);
    this.renderOptions();
    this.startSelectionObserver();
    await this.ensureShadowReady();
    this.decorateShadow();
    this.syncSelectionFromConfig();
    this.applyFilter(this.searchValue);
  }

  renderOptions() {
    const selectedChampionId = this.configStore.getChampion(this.configType, this.configIndex);
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
    this.configStore.setChampion(this.configType, this.configIndex, championId);
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
          this.configStore.setChampion(this.configType, this.configIndex, championId);
        }
      }
    });

    this.element.querySelectorAll("lol-uikit-dropdown-option").forEach((option) => {
      this.selectionObserver.observe(option, { attributes: true, attributeFilter: ["selected"] });
    });
  }

  syncSelectionFromConfig() {
    const selectedChampionId = String(this.configStore.getChampion(this.configType, this.configIndex));
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

    if (this.configStore.getChampion(this.configType, this.configIndex) === championId) {
      return;
    }

    this.configStore.setChampion(this.configType, this.configIndex, championId);
  }

  handleConfigChange(event) {
    if (event.detail?.key === `${this.configType}-champions`) {
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

class SocialSection {
  constructor(label, ...hiddableElements) {
    this.label = label;
    this.hiddableElements = hiddableElements;
    this.element = document.createElement("lol-social-roster-group");
    this.element.addEventListener("click", () => this.onClick());
    this.waitRender();
  }

  waitRender() {
    new MutationObserver((_, observer) => {
      const span = this.element.querySelector("span");
      if (!span) {
        return;
      }

      span.innerText = this.label;
      this.element.querySelector(".group-header")?.removeAttribute("draggable");
      this.element.querySelector(".arrow")?.setAttribute("open", "true");
      observer.disconnect();
    }).observe(this.element, { childList: true, subtree: true });
  }

  onClick() {
    this.hiddableElements.forEach((element) => element.classList.toggle("hidden"));
    this.element.querySelector(".arrow")?.toggleAttribute("open");
  }
}

class HomePanel {
  constructor(configStore, championRepository, logger) {
    this.configStore = configStore;
    this.championRepository = championRepository;
    this.logger = logger;
    this.controls = [];
    this.section = null;
    this.checkboxesDiv = null;
    this.dropdownsDiv = null;
    this.build();
  }

  build() {
    const autoAcceptCheckbox = new Checkbox(this.configStore, "Accept", "auto-accept", this.logger);
    const pickCheckbox = new Checkbox(this.configStore, "Pick", "auto-pick", this.logger);
    const banCheckbox = new Checkbox(this.configStore, "Ban", "auto-ban", this.logger);
    const firstPickDropdown = new Dropdown(
      this.configStore,
      "1st pick",
      "pick",
      0,
      () => this.championRepository.getPlayableChampions(),
      this.logger,
      { dropUp: true },
    );
    const secondPickDropdown = new Dropdown(
      this.configStore,
      "2nd pick",
      "pick",
      1,
      () => this.championRepository.getPlayableChampions(),
      this.logger,
      { dropUp: true },
    );
    const firstBanDropdown = new Dropdown(
      this.configStore,
      "1st ban",
      "ban",
      0,
      () => this.championRepository.getAllChampions(),
      this.logger,
      { dropUp: true },
    );
    const secondBanDropdown = new Dropdown(
      this.configStore,
      "2nd ban",
      "ban",
      1,
      () => this.championRepository.getAllChampions(),
      this.logger,
      { dropUp: true },
    );

    this.controls = [
      autoAcceptCheckbox,
      pickCheckbox,
      banCheckbox,
      firstPickDropdown,
      secondPickDropdown,
      firstBanDropdown,
      secondBanDropdown,
    ];

    this.checkboxesDiv = document.createElement("div");
    this.checkboxesDiv.classList.add("select-home-checkboxes");
    this.checkboxesDiv.append(autoAcceptCheckbox.element, pickCheckbox.element, banCheckbox.element);

    this.dropdownsDiv = document.createElement("div");
    this.dropdownsDiv.classList.add("select-home-dropdowns");
    this.dropdownsDiv.append(
      firstPickDropdown.element,
      secondPickDropdown.element,
      firstBanDropdown.element,
      secondBanDropdown.element,
    );

    const socialSection = new SocialSection("Auto Champion Select", this.checkboxesDiv, this.dropdownsDiv);
    this.section = socialSection.element;
  }

  async setup() {
    this.controls.slice(0, 3).forEach((control) => control.setup());
    await Promise.all(this.controls.slice(3).map((control) => control.setup()));
  }

  async refreshPlayableDropdowns() {
    await Promise.all(this.controls.slice(3, 5).map((control) => control.refresh()));
  }

  destroy() {
    this.controls.forEach((control) => control.destroy());
    this.section?.remove();
    this.checkboxesDiv?.remove();
    this.dropdownsDiv?.remove();
  }
}

class SettingsModal {
  constructor(configStore, championRepository, onClose, logger) {
    this.configStore = configStore;
    this.championRepository = championRepository;
    this.onClose = onClose;
    this.logger = logger;
    this.controls = [];
    this.element = null;
  }

  build() {
    const panel = document.createElement("div");
    panel.classList.add("select-settings-panel");

    const autoAcceptCheckbox = new Checkbox(this.configStore, "Accept", "auto-accept", this.logger);
    const pickCheckbox = new Checkbox(this.configStore, "Pick", "auto-pick", this.logger);
    const banCheckbox = new Checkbox(this.configStore, "Ban", "auto-ban", this.logger);
    const firstPickDropdown = new Dropdown(
      this.configStore,
      "1st pick",
      "pick",
      0,
      () => this.championRepository.getPlayableChampions(),
      this.logger,
    );
    const secondPickDropdown = new Dropdown(
      this.configStore,
      "2nd pick",
      "pick",
      1,
      () => this.championRepository.getPlayableChampions(),
      this.logger,
    );
    const firstBanDropdown = new Dropdown(
      this.configStore,
      "1st ban",
      "ban",
      0,
      () => this.championRepository.getAllChampions(),
      this.logger,
    );
    const secondBanDropdown = new Dropdown(
      this.configStore,
      "2nd ban",
      "ban",
      1,
      () => this.championRepository.getAllChampions(),
      this.logger,
    );

    this.controls = [
      autoAcceptCheckbox,
      pickCheckbox,
      banCheckbox,
      firstPickDropdown,
      secondPickDropdown,
      firstBanDropdown,
      secondBanDropdown,
    ];

    const toggleRow = document.createElement("div");
    toggleRow.classList.add("select-settings-panel__toggles");
    toggleRow.append(autoAcceptCheckbox.element, pickCheckbox.element, banCheckbox.element);

    panel.append(
      toggleRow,
      this.createDropdownSection("Pick priority", firstPickDropdown.element, secondPickDropdown.element),
      this.createDropdownSection("Ban priority", firstBanDropdown.element, secondBanDropdown.element),
    );

    const overlay = document.createElement("div");
    overlay.className = "select-modal-overlay";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.onClose();
      }
    });

    const dialog = document.createElement("div");
    dialog.className = "select-modal-dialog";

    const header = document.createElement("div");
    header.className = "select-modal-header";

    const titleBlock = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "select-modal-title";
    title.innerText = "Auto Champion Select";

    const subtitle = document.createElement("p");
    subtitle.className = "select-modal-subtitle";
    subtitle.innerText = "Configure auto accept, pick, and ban preferences.";
    titleBlock.append(title, subtitle);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "select-modal-close";
    closeButton.innerText = "X";
    closeButton.addEventListener("click", this.onClose);

    header.append(titleBlock, closeButton);

    const body = document.createElement("div");
    body.className = "select-modal-body";
    body.appendChild(panel);

    dialog.append(header, body);
    overlay.appendChild(dialog);
    this.element = overlay;
  }

  createDropdownSection(label, ...elements) {
    const section = document.createElement("div");
    section.classList.add("select-settings-panel__section");

    const labelElement = document.createElement("div");
    labelElement.classList.add("select-settings-panel__section-label");
    labelElement.innerText = label;

    const grid = document.createElement("div");
    grid.classList.add("select-settings-panel__grid");
    grid.append(...elements);

    section.append(labelElement, grid);
    return section;
  }

  async open() {
    this.build();
    document.body.appendChild(this.element);
    await Promise.all(
      this.controls.map((control, index) => (index < 3 ? Promise.resolve(control.setup()) : control.setup())),
    );
  }

  destroy() {
    this.controls.forEach((control) => control.destroy());
    this.controls = [];
    this.element?.remove();
    this.element = null;
  }
}

const SHADOW_READY_MAX_ATTEMPTS = 30;

export class UiController {
  constructor(configStore, championRepository, logger) {
    this.configStore = configStore;
    this.championRepository = championRepository;
    this.logger = logger;
    this.currentPhase = null;
    this.homePanel = null;
    this.homePanelObserverAttached = false;
    this.modal = null;
    this.handleEscapeClose = this.handleEscapeClose.bind(this);
  }

  setPhase(phase) {
    this.currentPhase = phase;

    if (phase === "ChampSelect") {
      this.ensureChampSelectButton();
    }
  }

  initHomePanel() {
    if (this.homePanelObserverAttached) {
      return;
    }

    this.homePanelObserverAttached = true;
    this.subscribeToElementCreation(".lol-social-roster", async (roster) => {
      if (this.homePanel?.section?.isConnected) {
        return;
      }

      this.homePanel = new HomePanel(this.configStore, this.championRepository, this.logger);
      roster.append(this.homePanel.section, this.homePanel.checkboxesDiv, this.homePanel.dropdownsDiv);
      await this.homePanel.setup();
    });
  }

  async refreshHomeDropdowns() {
    await this.homePanel?.refreshPlayableDropdowns?.();
  }

  initChampSelectUI() {
    this.subscribeToElementCreation(".bottom-right-buttons", (element) => {
      if (this.currentPhase !== "ChampSelect") {
        return;
      }

      if (document.querySelector(".select-champ-select-container")) {
        return;
      }

      this.generateChampSelectButton(element);
    });

    if (document.body) {
      new MutationObserver(() => this.ensureChampSelectButton()).observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    this.ensureChampSelectButton();
  }

  cleanupChampSelectUI() {
    document.querySelector(".select-champ-select-container")?.remove();
    this.closeModal();
  }

  getObserver() {
    return window.observer;
  }

  subscribeToElementCreation(selector, callback) {
    const observer = this.getObserver();
    if (!observer?.subscribeToElementCreation) {
      const runExisting = () => document.querySelectorAll(selector).forEach((element) => callback(element));
      runExisting();
      const fallbackObserver = new MutationObserver(() => runExisting());
      fallbackObserver.observe(document.body, { childList: true, subtree: true });
      return;
    }

    observer.subscribeToElementCreation(selector, callback);
    document.querySelectorAll(selector).forEach((element) => callback(element));
  }

  ensureChampSelectButton() {
    if (this.currentPhase !== "ChampSelect") {
      return;
    }

    if (document.querySelector(".select-champ-select-container")) {
      return;
    }

    const bottomRightButtons = document.querySelector(".bottom-right-buttons");
    if (!bottomRightButtons) {
      return;
    }

    this.generateChampSelectButton(bottomRightButtons);
  }

  handleEscapeClose(event) {
    if (event.key === "Escape") {
      this.closeModal();
    }
  }

  async openModal() {
    if (this.modal?.element?.isConnected) {
      return;
    }

    this.modal = new SettingsModal(this.configStore, this.championRepository, () => this.closeModal(), this.logger);
    document.addEventListener("keydown", this.handleEscapeClose);
    await this.modal.open();
  }

  closeModal() {
    this.modal?.destroy();
    this.modal = null;
    document.removeEventListener("keydown", this.handleEscapeClose);
  }

  generateChampSelectButton(siblingDiv) {
    const container = document.createElement("div");
    container.className = "select-champ-select-container";

    const wrapper = document.createElement("div");
    wrapper.className = "select-button-wrapper ember-view";

    const button = document.createElement("lol-uikit-flat-button");
    button.innerHTML = "Auto Select";
    button.addEventListener("click", () => this.openModal());

    wrapper.appendChild(button);
    container.appendChild(wrapper);
    siblingDiv?.parentNode?.insertBefore(container, siblingDiv);
  }
}
