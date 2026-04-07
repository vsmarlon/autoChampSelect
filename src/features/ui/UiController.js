import { HomePanel } from "./HomePanel.js";
import { SettingsModal } from "./SettingsModal.js";

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

      this.homePanel = new HomePanel(this.configStore, this.championRepository);
      roster.append(this.homePanel.section, this.homePanel.checkboxesDiv, this.homePanel.laneTabsDiv, this.homePanel.dropdownsDiv);
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

  subscribeToElementCreation(selector, callback) {
    const observer = window.observer;
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

    this.modal = new SettingsModal(this.configStore, this.championRepository, () => this.closeModal());
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
