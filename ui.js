import { CONFIG_CHANGE_EVENT, ensureChampionDefaults, get, getChampion, setChampion, toggle } from "./config.js";
import * as champions from "./champions.js";

const DEBUG = false;

let currentPhase = null;
let modalElement = null;
let homePanel = null;
let homePanelObserverAttached = false;
let modalVisibilityWatchersAttached = false;
let modalVisibilityObserver = null;
let visibilityUpdateScheduled = false;
let lastChampSelectButtonHidden = null;

const NATIVE_MODAL_SELECTORS = [
    ".modal .dialog-alert .page_editor.perks-panel",
    ".modal .dialog-alert .runes-application",
    ".modal .dialog-alert .perks-body",
    ".modal .dialog-alert .loadouts-page",
];

function log(...args) {
    if (DEBUG) {
        console.log("[select][ui]", ...args);
    }
}

function getObserver() {
    return window.observer;
}

function subscribeToElementCreation(selector, callback) {
    const observer = getObserver();
    if (!observer?.subscribeToElementCreation) {
        console.log("[select][ui] missing window.observer for", selector, "using fallback observer");

        const runExisting = () => document.querySelectorAll(selector).forEach((element) => callback(element));
        runExisting();

        const fallbackObserver = new MutationObserver(() => runExisting());
        fallbackObserver.observe(document.body, { childList: true, subtree: true });
        return;
    }

    observer.subscribeToElementCreation(selector, callback);
    document.querySelectorAll(selector).forEach((element) => callback(element));
}

export function setPhase(phase) {
    currentPhase = phase;
    log("phase", phase);

    if (phase === "ChampSelect") {
        ensureChampSelectButton();
        updateChampSelectButtonVisibility();
    }
}

function ensureChampSelectButton() {
    if (currentPhase !== "ChampSelect") {
        return;
    }

    if (document.querySelector(".select-champ-select-container")) {
        return;
    }

    const bottomRightButtons = document.querySelector(".bottom-right-buttons");
    if (!bottomRightButtons) {
        log("bottom-right-buttons not found yet");
        return;
    }

    generateChampSelectButton(bottomRightButtons);
}

function hasNativeChampSelectModalOpen() {
    return NATIVE_MODAL_SELECTORS.some((selector) => {
        const element = document.querySelector(selector);
        if (!element || element === modalElement) {
            return false;
        }

        const modalRoot = element.closest(".modal") ?? element;
        const style = window.getComputedStyle(modalRoot);
        return style.display !== "none" && style.visibility !== "hidden";
    });
}

function applyChampSelectButtonVisibility() {
    const buttonContainer = document.querySelector(".select-champ-select-container");
    if (!buttonContainer) {
        return;
    }

    const shouldHide = currentPhase === "ChampSelect" && hasNativeChampSelectModalOpen();
    buttonContainer.classList.toggle("select-champ-select-container--hidden", shouldHide);

    if (lastChampSelectButtonHidden !== shouldHide) {
        lastChampSelectButtonHidden = shouldHide;
        log("champ select button visibility", shouldHide ? "hidden" : "visible");
    }
}

function updateChampSelectButtonVisibility() {
    if (visibilityUpdateScheduled) {
        return;
    }

    visibilityUpdateScheduled = true;
    requestAnimationFrame(() => {
        visibilityUpdateScheduled = false;
        applyChampSelectButtonVisibility();
    });
}

function attachModalVisibilityWatchers() {
    if (modalVisibilityWatchersAttached) {
        return;
    }

    modalVisibilityWatchersAttached = true;

    if (document.body) {
        modalVisibilityObserver = new MutationObserver(() => {
            ensureChampSelectButton();
            updateChampSelectButtonVisibility();
        });
        modalVisibilityObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style", "class", "open"],
        });
    }

    NATIVE_MODAL_SELECTORS.forEach((selector) => {
        subscribeToElementCreation(selector, () => {
            ensureChampSelectButton();
            updateChampSelectButtonVisibility();
        });
    });
}

class Checkbox {
    constructor(text, configKey) {
        this.configKey = configKey;
        this.element = document.createElement("lol-uikit-radio-input-option");
        this.element.classList.add("lol-settings-voice-input-mode-option", "select-checkbox");
        this.element.innerText = text;
        this.handleClick = this.handleClick.bind(this);
        this.handleConfigChange = this.handleConfigChange.bind(this);
    }

    setup() {
        this.element.addEventListener("click", this.handleClick);
        window.addEventListener(CONFIG_CHANGE_EVENT, this.handleConfigChange);
        this.render();
    }

    render() {
        this.element.toggleAttribute("selected", Boolean(get(this.configKey)));
    }

    handleClick() {
        const nextValue = toggle(this.configKey);
        log("toggle", this.configKey, nextValue);
    }

    handleConfigChange(event) {
        if (event.detail?.key === this.configKey) {
            this.render();
        }
    }

    destroy() {
        this.element.removeEventListener("click", this.handleClick);
        window.removeEventListener(CONFIG_CHANGE_EVENT, this.handleConfigChange);
        this.element.remove();
    }
}

class Dropdown {
    constructor(text, configType, configIndex, championsGetter, options = {}) {
        this.text = text;
        this.configType = configType;
        this.configIndex = configIndex;
        this.championsGetter = championsGetter;
        this.dropUp = options.dropUp === true;
        this.champions = [];
        this.searchValue = "";
        this.setupDone = false;
        this.shadowReady = false;
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
            window.addEventListener(CONFIG_CHANGE_EVENT, this.handleConfigChange);
            this.element.addEventListener("change", this.handleDropdownChange);
        }

        this.champions = await this.championsGetter();
        if (!Array.isArray(this.champions) || this.champions.length === 0) {
            return;
        }

        ensureChampionDefaults(this.configType, this.champions);
        this.renderOptions();
        this.startSelectionObserver();
        await this.ensureShadowReady();
        this.decorateShadow();
        this.syncSelectionFromConfig();
        this.applyFilter(this.searchValue);
        log("dropdown setup", this.configType, this.configIndex, getChampion(this.configType, this.configIndex));
    }

    renderOptions() {
        const selectedChampionId = getChampion(this.configType, this.configIndex);
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
            option.addEventListener("pointerdown", () => {
                setChampion(this.configType, this.configIndex, champion.id);
                this.syncSelectionFromConfig();
                log("saved champion from option pointerdown", this.configType, this.configIndex, champion.id);
            });
            option.addEventListener("click", () => {
                setChampion(this.configType, this.configIndex, champion.id);
                this.syncSelectionFromConfig();
                log("saved champion from option click", this.configType, this.configIndex, champion.id);
            });
            if (champion.id === selectedChampionId) {
                option.setAttribute("selected", "true");
            }
            this.element.appendChild(option);
        }
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
                if (Number.isNaN(championId)) {
                    continue;
                }

                setChampion(this.configType, this.configIndex, championId);
                log("saved champion from selected attribute", this.configType, this.configIndex, championId);
            }
        });

        this.element.querySelectorAll("lol-uikit-dropdown-option").forEach((option) => {
            this.selectionObserver.observe(option, { attributes: true, attributeFilter: ["selected"] });
        });
    }

    syncSelectionFromConfig() {
        const selectedChampionId = String(getChampion(this.configType, this.configIndex));
        this.element.querySelectorAll("lol-uikit-dropdown-option").forEach((option) => {
            option.toggleAttribute("selected", option.dataset.championId === selectedChampionId);
        });
    }

    async ensureShadowReady() {
        for (let attempt = 0; attempt < 30; attempt += 1) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const root = this.element.shadowRoot;
            if (root?.querySelector(".ui-dropdown-current")) {
                this.shadowReady = true;
                return true;
            }
        }

        log("dropdown shadow not ready", this.configType, this.configIndex);
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
            const placeholder = this.createSearchPlaceholder();
            currentDropdown.appendChild(placeholder);
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
        input.placeholder = this.text;
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

        const root = this.element.shadowRoot;
        root?.querySelector(".ui-dropdown-current")?.click();
    }

    handleDropdownChange(event) {
        const eventOption = event?.target?.closest?.("lol-uikit-dropdown-option") ?? null;
        const selectedOption = eventOption ?? this.element.querySelector("lol-uikit-dropdown-option[selected]");
        if (!selectedOption) {
            log("dropdown change without selected option", this.configType, this.configIndex);
            return;
        }

        const championId = Number(selectedOption.dataset.championId);
        if (Number.isNaN(championId)) {
            return;
        }

        if (getChampion(this.configType, this.configIndex) === championId) {
            return;
        }

        setChampion(this.configType, this.configIndex, championId);
        log("saved champion", this.configType, this.configIndex, championId);
    }

    handleConfigChange(event) {
        if (event.detail?.key !== `${this.configType}-champions`) {
            return;
        }

        this.syncSelectionFromConfig();
    }

    async refresh() {
        await this.setup();
    }

    destroy() {
        this.selectionObserver?.disconnect();
        window.removeEventListener(CONFIG_CHANGE_EVENT, this.handleConfigChange);
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

function createHomePanel() {
    const autoAcceptCheckbox = new Checkbox("Accept", "auto-accept");
    const pickCheckbox = new Checkbox("Pick", "auto-pick");
    const banCheckbox = new Checkbox("Ban", "auto-ban");
    const firstPickDropdown = new Dropdown("1st pick", "pick", 0, champions.getPlayableChampions, { dropUp: true });
    const secondPickDropdown = new Dropdown("2nd pick", "pick", 1, champions.getPlayableChampions, { dropUp: true });
    const firstBanDropdown = new Dropdown("1st ban", "ban", 0, champions.getAllChampions, { dropUp: true });
    const secondBanDropdown = new Dropdown("2nd ban", "ban", 1, champions.getAllChampions, { dropUp: true });

    const checkboxesDiv = document.createElement("div");
    checkboxesDiv.classList.add("select-home-checkboxes");
    checkboxesDiv.append(autoAcceptCheckbox.element, pickCheckbox.element, banCheckbox.element);

    const dropdownsDiv = document.createElement("div");
    dropdownsDiv.classList.add("select-home-dropdowns");
    dropdownsDiv.append(firstPickDropdown.element, secondPickDropdown.element, firstBanDropdown.element, secondBanDropdown.element);

    const section = new SocialSection("Auto Champion Select", checkboxesDiv, dropdownsDiv);

    return {
        section: section.element,
        checkboxesDiv,
        dropdownsDiv,
        controls: [autoAcceptCheckbox, pickCheckbox, banCheckbox, firstPickDropdown, secondPickDropdown, firstBanDropdown, secondBanDropdown],
        async setup() {
            autoAcceptCheckbox.setup();
            pickCheckbox.setup();
            banCheckbox.setup();
            await Promise.all([
                firstPickDropdown.setup(),
                secondPickDropdown.setup(),
                firstBanDropdown.setup(),
                secondBanDropdown.setup(),
            ]);
        },
        async refreshPlayableDropdowns() {
            await Promise.all([firstPickDropdown.refresh(), secondPickDropdown.refresh()]);
        },
        destroy() {
            this.controls.forEach((control) => control.destroy());
            this.section.remove();
            this.checkboxesDiv.remove();
            this.dropdownsDiv.remove();
        },
    };
}

export function initHomePanel() {
    if (homePanelObserverAttached) {
        return;
    }

    homePanelObserverAttached = true;
    subscribeToElementCreation(".lol-social-roster", async (roster) => {
        if (homePanel?.section?.isConnected) {
            return;
        }

        homePanel = createHomePanel();
        roster.append(homePanel.section, homePanel.checkboxesDiv, homePanel.dropdownsDiv);
        await homePanel.setup();
        log("mounted home panel");
    });
}

export async function refreshHomeDropdowns() {
    await homePanel?.refreshPlayableDropdowns?.();
}

function createModalPanel() {
    const panel = document.createElement("div");
    panel.classList.add("select-settings-panel");

    const autoAcceptCheckbox = new Checkbox("Accept", "auto-accept");
    const pickCheckbox = new Checkbox("Pick", "auto-pick");
    const banCheckbox = new Checkbox("Ban", "auto-ban");
    const firstPickDropdown = new Dropdown("1st pick", "pick", 0, champions.getPlayableChampions);
    const secondPickDropdown = new Dropdown("2nd pick", "pick", 1, champions.getPlayableChampions);
    const firstBanDropdown = new Dropdown("1st ban", "ban", 0, champions.getAllChampions);
    const secondBanDropdown = new Dropdown("2nd ban", "ban", 1, champions.getAllChampions);

    const toggleRow = document.createElement("div");
    toggleRow.classList.add("select-settings-panel__toggles");
    toggleRow.append(autoAcceptCheckbox.element, pickCheckbox.element, banCheckbox.element);

    panel.append(
        toggleRow,
        createDropdownSection("Pick priority", firstPickDropdown.element, secondPickDropdown.element),
        createDropdownSection("Ban priority", firstBanDropdown.element, secondBanDropdown.element),
    );

    return {
        element: panel,
        controls: [autoAcceptCheckbox, pickCheckbox, banCheckbox, firstPickDropdown, secondPickDropdown, firstBanDropdown, secondBanDropdown],
        async setup() {
            autoAcceptCheckbox.setup();
            pickCheckbox.setup();
            banCheckbox.setup();
            await Promise.all([
                firstPickDropdown.setup(),
                secondPickDropdown.setup(),
                firstBanDropdown.setup(),
                secondBanDropdown.setup(),
            ]);
        },
        destroy() {
            this.controls.forEach((control) => control.destroy());
            this.element.remove();
        },
    };
}

function createDropdownSection(label, ...elements) {
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

function closeModal() {
    modalElement?.remove();
    modalElement = null;
    document.removeEventListener("keydown", handleEscapeClose);
    updateChampSelectButtonVisibility();
    log("closed modal");
}

function handleEscapeClose(event) {
    if (event.key === "Escape") {
        closeModal();
    }
}

async function openModal() {
    if (modalElement?.isConnected) {
        return;
    }

    log("opening modal with config", {
        pickChampions: get("pick-champions"),
        banChampions: get("ban-champions"),
        autoPick: get("auto-pick"),
        autoBan: get("auto-ban"),
    });

    const overlay = document.createElement("div");
    overlay.className = "select-modal-overlay";
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
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
    closeButton.addEventListener("click", closeModal);

    header.append(titleBlock, closeButton);

    const body = document.createElement("div");
    body.className = "select-modal-body";

    const panel = createModalPanel();
    body.appendChild(panel.element);
    dialog.append(header, body);
    overlay.appendChild(dialog);

    modalElement = overlay;
    document.body.appendChild(overlay);
    document.addEventListener("keydown", handleEscapeClose);
    await panel.setup();
    updateChampSelectButtonVisibility();
    log("opened modal");
}

function generateChampSelectButton(siblingDiv) {
    const container = document.createElement("div");
    container.className = "select-champ-select-container";

    const wrapper = document.createElement("div");
    wrapper.className = "select-button-wrapper ember-view";

    const button = document.createElement("lol-uikit-flat-button");
    button.innerHTML = "Auto Select";
    button.addEventListener("click", openModal);

    wrapper.appendChild(button);
    container.appendChild(wrapper);
    siblingDiv?.parentNode?.insertBefore(container, siblingDiv);
    updateChampSelectButtonVisibility();
    log("mounted champ select button");
}

export function initChampSelectUI() {
    attachModalVisibilityWatchers();

    subscribeToElementCreation(".bottom-right-buttons", (element) => {
        if (currentPhase !== "ChampSelect") {
            return;
        }

        if (document.querySelector(".select-champ-select-container")) {
            return;
        }

        generateChampSelectButton(element);
    });

    ensureChampSelectButton();
}

export function cleanupChampSelectUI() {
    document.querySelector(".select-champ-select-container")?.remove();
    closeModal();
}
