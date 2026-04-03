export class Logger {
  constructor(scope, enabled = false) {
    this.scope = scope;
    this.enabled = enabled;
  }

  child(scope) {
    return new Logger(`${this.scope}][${scope}`, this.enabled);
  }

  log(...args) {
    if (!this.enabled) {
      return;
    }

    console.log(`[${this.scope}]`, ...args);
  }
}
