import { LANE_LABELS } from "../../constants.js";
import { Checkbox } from "./Checkbox.js";
import { Dropdown } from "./Dropdown.js";

export class HomePanel {
  constructor(configStore, championRepository) {
    this.configStore = configStore;
    this.championRepository = championRepository;
    this.checkboxes = [];
    this.pickDropdowns = [];
    this.banDropdowns = [];
    this.configCleanup = null;
    this.section = null;
    this.checkboxesDiv = null;
    this.laneTabsDiv = null;
    this.dropdownsDiv = null;
    this.activeLane = "top";
    this.build();
  }

  build() {
    const autoAcceptCheckbox = new Checkbox(this.configStore, "Accept", "auto-accept");
    const pickCheckbox = new Checkbox(this.configStore, "Pick", "auto-pick");
    const banCheckbox = new Checkbox(this.configStore, "Ban", "auto-ban");
    this.checkboxes = [autoAcceptCheckbox, pickCheckbox, banCheckbox];

    this.checkboxesDiv = document.createElement("div");
    this.checkboxesDiv.classList.add("select-home-checkboxes");
    this.checkboxesDiv.append(autoAcceptCheckbox.element, pickCheckbox.element, banCheckbox.element);

    this.laneTabsDiv = this.buildLaneTabs();

    this.dropdownsDiv = document.createElement("div");
    this.dropdownsDiv.classList.add("select-home-dropdowns");

    const socialSection = document.createElement("lol-social-roster-group");
    socialSection.addEventListener("click", () => {
      this.checkboxesDiv.classList.toggle("hidden");
      this.laneTabsDiv.classList.toggle("hidden");
      this.dropdownsDiv.classList.toggle("hidden");
      socialSection.querySelector(".arrow")?.toggleAttribute("open");
    });
    new MutationObserver((_, observer) => {
      const span = socialSection.querySelector("span");
      if (!span) {
        return;
      }
      span.innerText = "Auto Champion Select";
      socialSection.querySelector(".group-header")?.removeAttribute("draggable");
      socialSection.querySelector(".arrow")?.setAttribute("open", "true");
      observer.disconnect();
    }).observe(socialSection, { childList: true, subtree: true });

    this.section = socialSection;
  }

  buildLaneTabs() {
    const container = document.createElement("div");
    container.classList.add("select-home-lane-tabs");

    for (const [lane, label] of Object.entries(LANE_LABELS)) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.classList.add("select-home-lane-tab");
      if (lane === this.activeLane) {
        tab.classList.add("select-home-lane-tab--active");
      }
      tab.innerText = label;
      tab.addEventListener("click", () => {
        if (this.activeLane === lane) {
          return;
        }
        container.querySelectorAll(".select-home-lane-tab").forEach((t) => t.classList.remove("select-home-lane-tab--active"));
        tab.classList.add("select-home-lane-tab--active");
        this.activeLane = lane;
        this.rebuildDropdowns();
      });
      container.appendChild(tab);
    }

    return container;
  }

  async setup() {
    this.checkboxes.forEach((control) => control.setup());
    await this.rebuildDropdowns();

    this.configCleanup = this.configStore.onChange(({ key }) => {
      if (key === "lane-based-pick" || key === "lane-based-ban") {
        this.updateLaneTabsVisibility();
        this.rebuildDropdowns();
      }
    });

    this.updateLaneTabsVisibility();
  }

  updateLaneTabsVisibility() {
    const lanePickOn = this.configStore.get("lane-based-pick");
    const laneBanOn = this.configStore.get("lane-based-ban");
    this.laneTabsDiv.style.display = lanePickOn || laneBanOn ? "" : "none";
  }

  async rebuildDropdowns() {
    this.pickDropdowns.forEach((d) => d.destroy());
    this.banDropdowns.forEach((d) => d.destroy());
    this.dropdownsDiv.replaceChildren();

    const lanePickOn = this.configStore.get("lane-based-pick");
    const laneBanOn = this.configStore.get("lane-based-ban");
    const laneActive = lanePickOn || laneBanOn;
    const pickLane = laneActive ? this.activeLane : null;
    const banLane = laneActive ? this.activeLane : null;

    const pickGetter = () => this.championRepository.getPlayableChampions();
    const banGetter = () => this.championRepository.getAllChampions();

    this.pickDropdowns = [
      new Dropdown(this.configStore, "1st pick", "pick", 0, pickGetter, { dropUp: true, lane: pickLane }),
      new Dropdown(this.configStore, "2nd pick", "pick", 1, pickGetter, { dropUp: true, lane: pickLane }),
    ];
    this.banDropdowns = [
      new Dropdown(this.configStore, "1st ban", "ban", 0, banGetter, { dropUp: true, lane: banLane }),
      new Dropdown(this.configStore, "2nd ban", "ban", 1, banGetter, { dropUp: true, lane: banLane }),
    ];

    const allDropdowns = [...this.pickDropdowns, ...this.banDropdowns];
    this.dropdownsDiv.append(...allDropdowns.map((d) => d.element));
    await Promise.all(allDropdowns.map((d) => d.setup()));
  }

  async refreshPlayableDropdowns() {
    await Promise.all(this.pickDropdowns.map((d) => d.refresh()));
  }

  destroy() {
    this.configCleanup?.();
    this.checkboxes.forEach((control) => control.destroy());
    this.pickDropdowns.forEach((d) => d.destroy());
    this.banDropdowns.forEach((d) => d.destroy());
    this.section?.remove();
    this.checkboxesDiv?.remove();
    this.laneTabsDiv?.remove();
    this.dropdownsDiv?.remove();
  }
}
