export {};

import type * as React from "react";

export interface PenguSocketEvent<T> {
  data: T;
  uri: string;
  eventType: "Create" | "Update" | "Delete";
}

export interface PenguObserverHandle {
  disconnect: () => void;
}

export interface PenguContext {
  socket: {
    observe: <T>(_api: string, _listener: (_message: PenguSocketEvent<T>) => void) => PenguObserverHandle;
  };
}

declare global {
  interface Window {
    DataStore: {
      get: <T>(_key: string | number, _fallback?: T) => T | undefined;
      set: (_key: string | number, _value: unknown) => boolean;
      has?: (_key: string | number) => boolean;
      remove?: (_key: string | number) => boolean;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      "lol-social-roster-group": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
