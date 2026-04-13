const LABEL_STYLE = "background: #7b1fa2; color: #fff; font-weight: bold; padding: 1px 6px; border-radius: 3px;";
const SCOPE_STYLE = "background: #333; color: #fff; font-weight: bold; padding: 1px 6px; border-radius: 3px;";
const RESET_STYLE = "color: inherit;";

export class Logger {
  public scope: string;
  public enabled: boolean;

  constructor(scope: string, enabled = false) {
    this.scope = scope;
    this.enabled = enabled;
  }

  child(scope: string): Logger {
    return new Logger(`${this.scope}][${scope}`, this.enabled);
  }

  log(...args: unknown[]): void {
    if (!this.enabled) {
      return;
    }

    console.log(`%cSelect%c %c${this.scope}%c`, LABEL_STYLE, RESET_STYLE, SCOPE_STYLE, RESET_STYLE, ...args);
  }
}
