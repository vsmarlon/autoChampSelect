import { LANE_LABELS } from "../../constants.js";
import { Checkbox } from "./Checkbox.js";
import { Dropdown } from "./Dropdown.js";

export class SettingsModal {
  constructor(configStore, championRepository, onClose) {
    this.configStore = configStore;
    this.championRepository = championRepository;
    this.onClose = onClose;
    this.controls = [];
    this.laneDropdowns = {};
    this.laneVisibilityCleanup = null;
    this.element = null;
  }

  build() {
    const panel = document.createElement("div");
    panel.classList.add("select-settings-panel");

    const autoAcceptCheckbox = new Checkbox(this.configStore, "Accept", "auto-accept");
    const pickCheckbox = new Checkbox(this.configStore, "Pick", "auto-pick");
    const banCheckbox = new Checkbox(this.configStore, "Ban", "auto-ban");
    const lanePickCheckbox = new Checkbox(this.configStore, "Lane Picks", "lane-based-pick");
    const laneBanCheckbox = new Checkbox(this.configStore, "Lane Bans", "lane-based-ban");

    const pickGetter = () => this.championRepository.getPlayableChampions();
    const banGetter = () => this.championRepository.getAllChampions();

    const firstPickDropdown = new Dropdown(this.configStore, "1st pick", "pick", 0, pickGetter);
    const secondPickDropdown = new Dropdown(this.configStore, "2nd pick", "pick", 1, pickGetter);
    const firstBanDropdown = new Dropdown(this.configStore, "1st ban", "ban", 0, banGetter);
    const secondBanDropdown = new Dropdown(this.configStore, "2nd ban", "ban", 1, banGetter);

    this.controls = [
      autoAcceptCheckbox,
      pickCheckbox,
      banCheckbox,
      lanePickCheckbox,
      laneBanCheckbox,
      firstPickDropdown,
      secondPickDropdown,
      firstBanDropdown,
      secondBanDropdown,
    ];

    const lanes = Object.keys(LANE_LABELS);
    for (const lane of lanes) {
      this.laneDropdowns[lane] = {
        pick: [
          new Dropdown(this.configStore, "1st pick", "pick", 0, pickGetter, { lane }),
          new Dropdown(this.configStore, "2nd pick", "pick", 1, pickGetter, { lane }),
        ],
        ban: [
          new Dropdown(this.configStore, "1st ban", "ban", 0, banGetter, { lane }),
          new Dropdown(this.configStore, "2nd ban", "ban", 1, banGetter, { lane }),
        ],
      };
      this.controls.push(...this.laneDropdowns[lane].pick, ...this.laneDropdowns[lane].ban);
    }

    const toggleRow = this.createToggleRow(autoAcceptCheckbox, pickCheckbox, banCheckbox);
    const laneToggleRow = this.createToggleRow(lanePickCheckbox, laneBanCheckbox);

    const globalPickSection = this.createDropdownSection(
      "Pick priority",
      firstPickDropdown.element,
      secondPickDropdown.element,
    );
    const globalBanSection = this.createDropdownSection(
      "Ban priority",
      firstBanDropdown.element,
      secondBanDropdown.element,
    );

    const { laneSection } = this.buildLaneTabs(lanes);

    const updateVisibility = () => {
      const lanePickOn = this.configStore.get("lane-based-pick");
      const laneBanOn = this.configStore.get("lane-based-ban");
      globalPickSection.style.display = lanePickOn ? "none" : "";
      globalBanSection.style.display = laneBanOn ? "none" : "";
      laneSection.style.display = lanePickOn || laneBanOn ? "" : "none";

      for (const lane of lanes) {
        const ld = this.laneDropdowns[lane];
        for (const d of ld.pick) {
          d.element.closest(".select-settings-panel__section").style.display = lanePickOn ? "" : "none";
        }
        for (const d of ld.ban) {
          d.element.closest(".select-settings-panel__section").style.display = laneBanOn ? "" : "none";
        }
      }
    };

    this.laneVisibilityCleanup = this.configStore.onChange(({ key }) => {
      if (key === "lane-based-pick" || key === "lane-based-ban") {
        updateVisibility();
      }
    });

    panel.append(toggleRow, laneToggleRow, globalPickSection, globalBanSection, laneSection);
    requestAnimationFrame(updateVisibility);

    this.element = this.wrapInModal(panel);
  }

  createToggleRow(...checkboxes) {
    const row = document.createElement("div");
    row.classList.add("select-settings-panel__toggles");
    row.append(...checkboxes.map((c) => c.element));
    return row;
  }

  buildLaneTabs(lanes) {
    const laneTabBar = document.createElement("div");
    laneTabBar.classList.add("select-lane-tabs");

    const laneContainers = {};
    let activeLane = lanes[0];

    for (const lane of lanes) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.classList.add("select-lane-tab");
      if (lane === activeLane) {
        tab.classList.add("select-lane-tab--active");
      }
      tab.innerText = LANE_LABELS[lane];
      tab.addEventListener("click", () => {
        laneTabBar.querySelectorAll(".select-lane-tab").forEach((t) => t.classList.remove("select-lane-tab--active"));
        tab.classList.add("select-lane-tab--active");
        activeLane = lane;
        for (const l of lanes) {
          laneContainers[l].style.display = l === lane ? "" : "none";
        }
      });
      laneTabBar.appendChild(tab);

      const container = document.createElement("div");
      container.classList.add("select-lane-container");
      container.style.display = lane === activeLane ? "" : "none";
      const ld = this.laneDropdowns[lane];
      container.append(
        this.createDropdownSection(`${LANE_LABELS[lane]} Pick`, ld.pick[0].element, ld.pick[1].element),
        this.createDropdownSection(`${LANE_LABELS[lane]} Ban`, ld.ban[0].element, ld.ban[1].element),
      );
      laneContainers[lane] = container;
    }

    const laneSection = document.createElement("div");
    laneSection.classList.add("select-lane-section");
    laneSection.appendChild(laneTabBar);
    for (const lane of lanes) {
      laneSection.appendChild(laneContainers[lane]);
    }

    return { laneSection, laneContainers };
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

  wrapInModal(panel) {
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
    return overlay;
  }

  async open() {
    this.build();
    document.body.appendChild(this.element);
    await Promise.all(
      this.controls.map((control, index) => (index < 5 ? Promise.resolve(control.setup()) : control.setup())),
    );
  }

  destroy() {
    this.laneVisibilityCleanup?.();
    this.controls.forEach((control) => control.destroy());
    this.controls = [];
    this.element?.remove();
    this.element = null;
  }
}
