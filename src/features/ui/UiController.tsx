import React from "react";
import { createRoot } from "react-dom/client";
import { ConfigStore } from "../../core/ConfigStore";
import { ChampionRepository } from "../../core/ChampionRepository";
import { Logger } from "../../core/Logger";
import { createScopedMount } from "../../utils/dom";
import { AppProvider } from "./AppContext";
import { ChampSelectEntry } from "./ChampSelectEntry";
import { HomePanel } from "./HomePanel";
import { SettingsModal } from "./SettingsModal";

const HOME_PANEL_SELECTORS = [".lol-social-roster", "lol-social-roster", ".social-roster"] as const;

const CHAMP_SELECT_BUTTON_SELECTORS = [".bottom-right-buttons", ".bottom-right"] as const;

interface UiRoot {
  render(_node: React.ReactNode): void;
  unmount(): void;
}

export class UiController {
  private configStore: ConfigStore;
  private championRepository: ChampionRepository;
  private logger: Logger;
  private stylesheetText: string;

  private currentPhase: string | null = null;
  private homePanelRoot: UiRoot | null = null;
  private homePanelMount: HTMLDivElement | null = null;
  private homePanelObserverAttached = false;
  private homePanelEnsureTimer: number | null = null;
  private champSelectRoot: UiRoot | null = null;
  private champSelectMount: HTMLDivElement | null = null;
  private champSelectEnsureTimer: number | null = null;
  private champSelectUiInitialized = false;
  private modalRoot: UiRoot | null = null;
  private modalMount: HTMLDivElement | null = null;

  constructor(configStore: ConfigStore, championRepository: ChampionRepository, logger: Logger, stylesheetText: string) {
    this.configStore = configStore;
    this.championRepository = championRepository;
    this.logger = logger;
    this.stylesheetText = stylesheetText;
  }

  setPhase(phase: string | null) {
    this.currentPhase = phase;
    if (phase === "ChampSelect") {
      this.ensureChampSelectButton();
      this.startChampSelectEnsureLoop();
      return;
    }

    this.stopChampSelectEnsureLoop();
  }

  initHomePanel() {
    if (this.homePanelObserverAttached) {
      this.scheduleHomePanelEnsure();
      return;
    }

    this.homePanelObserverAttached = true;
    HOME_PANEL_SELECTORS.forEach((selector) => {
      this.subscribeToElementCreation(selector, () => this.ensureHomePanel());
    });
    this.ensureHomePanel();
    this.scheduleHomePanelEnsure();
  }

  initChampSelectUI() {
    if (this.champSelectUiInitialized) {
      return;
    }

    this.champSelectUiInitialized = true;
    CHAMP_SELECT_BUTTON_SELECTORS.forEach((selector) => {
      this.subscribeToElementCreation(selector, () => this.ensureChampSelectButton());
    });

    this.ensureChampSelectButton();
  }

  cleanupChampSelectUI() {
    this.stopChampSelectEnsureLoop();
    this.champSelectRoot?.unmount();
    this.champSelectRoot = null;
    this.champSelectMount?.remove();
    this.champSelectMount = null;
    this.closeModal();
  }

  private startChampSelectEnsureLoop() {
    if (this.champSelectEnsureTimer !== null) {
      return;
    }

    const run = () => {
      this.champSelectEnsureTimer = null;

      if (this.currentPhase !== "ChampSelect") {
        return;
      }

      this.ensureChampSelectButton();

      if (!this.champSelectMount?.isConnected) {
        this.champSelectEnsureTimer = window.setTimeout(run, 500);
      }
    };

    this.champSelectEnsureTimer = window.setTimeout(run, 0);
  }

  private scheduleHomePanelEnsure() {
    if (this.homePanelEnsureTimer !== null) {
      return;
    }

    this.homePanelEnsureTimer = window.setTimeout(() => {
      this.homePanelEnsureTimer = null;
      this.ensureHomePanel();
      this.scheduleHomePanelEnsure();
    }, 500);
  }

  private stopHomePanelEnsureLoop() {
    if (this.homePanelEnsureTimer !== null) {
      window.clearTimeout(this.homePanelEnsureTimer);
      this.homePanelEnsureTimer = null;
    }
  }

  private stopChampSelectEnsureLoop() {
    if (this.champSelectEnsureTimer !== null) {
      window.clearTimeout(this.champSelectEnsureTimer);
      this.champSelectEnsureTimer = null;
    }
  }

  openModal() {
    if (this.modalRoot) {
      return;
    }

    const { host, mount } = createScopedMount("select-modal-mount", this.stylesheetText);
    document.body.appendChild(host);
    this.modalMount = host;
    this.modalRoot = createRoot(mount);
    this.modalRoot.render(
      <AppProvider
        value={{
          configStore: this.configStore,
          championRepository: this.championRepository,
          logger: this.logger.child("modal"),
        }}
      >
        <SettingsModal onClose={() => this.closeModal()} />
      </AppProvider>,
    );
  }

  closeModal() {
    this.modalRoot?.unmount();
    this.modalRoot = null;
    this.modalMount?.remove();
    this.modalMount = null;
  }

  private ensureHomePanel() {
    if (this.homePanelMount && !this.homePanelMount.isConnected) {
      this.homePanelRoot?.unmount();
      this.homePanelRoot = null;
      this.homePanelMount = null;
    }

    if (this.homePanelRoot) {
      return;
    }

    const roster = this.findFirstVisibleElement(HOME_PANEL_SELECTORS);
    if (!roster) {
      this.scheduleHomePanelEnsure();
      return;
    }

    if (this.homePanelMount && this.homePanelMount.isConnected) {
      if (roster.contains(this.homePanelMount)) {
        this.stopHomePanelEnsureLoop();
        return;
      }

      const rootToUnmount = this.homePanelRoot as UiRoot | null;
      rootToUnmount?.unmount();
      this.homePanelRoot = null;
      this.homePanelMount.remove();
      this.homePanelMount = null;
    }

    this.logger.log("mounting home panel", roster.className || roster.tagName);

    const { host, mount } = createScopedMount("select-home-panel-mount", this.stylesheetText);
    roster.appendChild(host);
    this.homePanelMount = host;
    this.homePanelRoot = createRoot(mount);
    this.homePanelRoot.render(
      <AppProvider
        value={{
          configStore: this.configStore,
          championRepository: this.championRepository,
          logger: this.logger.child("home"),
        }}
      >
        <HomePanel />
      </AppProvider>,
    );
    this.stopHomePanelEnsureLoop();
  }

  private subscribeToElementCreation(selector: string, callback: (_el: HTMLElement) => void) {
    const observer = (
      window as Window & {
        observer?: {
          subscribeToElementCreation?: (_selector: string, _callback: (_element: HTMLElement) => void) => void;
        };
      }
    ).observer;
    if (!observer?.subscribeToElementCreation) {
      this.subscribeWithFallbackObserver(selector, callback);
      return;
    }

    observer.subscribeToElementCreation(selector, callback);
    document.querySelectorAll(selector).forEach((element) => callback(element as HTMLElement));
  }

  private subscribeWithFallbackObserver(selector: string, callback: (_el: HTMLElement) => void) {
    const notifyMatches = (): boolean => {
      const matches = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      matches.forEach((element) => callback(element));
      return matches.length > 0;
    };

    if (notifyMatches()) {
      return;
    }

    if (!document.body) {
      return;
    }

    const fallbackObserver = new MutationObserver(() => {
      if (!notifyMatches()) {
        return;
      }

      fallbackObserver.disconnect();
    });

    fallbackObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private ensureChampSelectButton() {
    if (this.currentPhase !== "ChampSelect") return;

    if (this.champSelectMount && !this.champSelectMount.isConnected) {
      this.champSelectRoot?.unmount();
      this.champSelectRoot = null;
      this.champSelectMount = null;
    }

    const bottomRightButtons = this.findFirstVisibleElement(CHAMP_SELECT_BUTTON_SELECTORS);
    if (!bottomRightButtons) return;

    if (this.champSelectMount && this.champSelectMount.isConnected) {
      if (bottomRightButtons.contains(this.champSelectMount)) {
        return;
      }

      this.champSelectRoot?.unmount();
      this.champSelectRoot = null;
      this.champSelectMount.remove();
      this.champSelectMount = null;
    }

    this.logger.log("mounting champ-select button", bottomRightButtons.className || bottomRightButtons.tagName);
    this.generateChampSelectButton(bottomRightButtons);
  }

  private findFirstVisibleElement(selectors: readonly string[]): HTMLElement | null {
    for (const selector of selectors) {
      const matches = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      const visibleMatch = matches.find((element) => this.isVisible(element));
      if (visibleMatch) {
        return visibleMatch;
      }
    }

    return null;
  }

  private isVisible(element: HTMLElement): boolean {
    return element.isConnected && element.getClientRects().length > 0;
  }

  private generateChampSelectButton(siblingDiv: HTMLElement) {
    if (this.champSelectMount && this.champSelectMount.isConnected) {
      return;
    }

    const { host, mount } = createScopedMount(
      "select-champ-select-entry-mount",
      this.stylesheetText,
      "select-champ-select-container",
    );
    siblingDiv.appendChild(host);
    this.champSelectMount = host;
    this.champSelectRoot = createRoot(mount);
    this.champSelectRoot.render(
      <AppProvider
        value={{
          configStore: this.configStore,
          championRepository: this.championRepository,
          logger: this.logger.child("modal"),
        }}
      >
        <ChampSelectEntry onOpen={() => this.openModal()} />
      </AppProvider>,
    );
  }
}
