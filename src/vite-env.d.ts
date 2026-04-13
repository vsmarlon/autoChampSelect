/// <reference types="vite/client" />

import type * as React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "lol-social-roster-group": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};
