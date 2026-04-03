import stylesheetText from "./assets/style.css?inline";
import { AutoChampSelectApp } from "./app/AutoChampSelectApp.js";

const app = new AutoChampSelectApp();

function ensureStylesheet() {
  if (document.querySelector("style[data-select-style]")) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.selectStyle = "true";
  style.textContent = stylesheetText;
  document.head.appendChild(style);
}

export function init(context) {
  app.init(context);
}

export async function load() {
  ensureStylesheet();
  await app.load();
}
