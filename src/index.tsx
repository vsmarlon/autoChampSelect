import stylesheetText from "./styles/app.css?inline";
import { AutoChampSelectApp } from "./app/AutoChampSelectApp";
import type { PenguContext } from "./types/pengu";

const app = new AutoChampSelectApp(stylesheetText);

export function init(context: PenguContext): void {
  app.init(context);
}

export async function load(): Promise<void> {
  await app.load();
}
