import { LABEL_STYLE, RESET_STYLE, SCOPE_STYLE } from "../utils/constants";

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
