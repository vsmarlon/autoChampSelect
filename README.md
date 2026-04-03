# autochampselect

Auto accept, pick, and ban plugin for Pengu Loader.

## Install

Create this file in your Pengu `plugins` directory:

```text
plugins/
  autochampselect/
    index.js
```

Paste this into `index.js`:

```js
export { init, load } from "https://cdn.jsdelivr.net/npm/autochampselect/dist/index.js";
```

Then reload the League client.

## Update

The jsDelivr URL follows the latest published package automatically.

## Development

The npm package is built from `src/` and published from `dist/index.js`.

```bash
npm install
npm run build
```
