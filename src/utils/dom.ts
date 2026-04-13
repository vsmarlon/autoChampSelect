export interface ScopedMount {
  host: HTMLDivElement;
  mount: HTMLDivElement;
  root: ShadowRoot;
}

export const createScopedMount = (mountId: string, cssText: string, className?: string): ScopedMount => {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });

  const stylesheet = document.createElement("style");
  stylesheet.dataset.selectStyle = mountId;
  stylesheet.textContent = cssText;
  root.appendChild(stylesheet);

  const mount = document.createElement("div");
  mount.id = mountId;
  if (className) {
    mount.className = className;
  }

  root.appendChild(mount);
  return { host, mount, root };
};
