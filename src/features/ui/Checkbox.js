export class Checkbox {
  constructor(configStore, label, configKey) {
    this.configStore = configStore;
    this.configKey = configKey;
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
