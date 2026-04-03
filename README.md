# autochampselect

Auto accept, pick, and ban plugin for Pengu Loader.

## Install

Copy this repo's plugin folder into your Pengu `plugins` directory so you end up with:

```text
plugins/
  autochampselect/
    index.js
```

The `index.js` file is a pinned CDN bootstrap:

```js
export { init, load } from "https://cdn.jsdelivr.net/npm/autochampselect@3.1.2/dist/index.js";
```

Then reload the League client.

## Manual Setup

If you do not want the full repo, create `plugins/autochampselect/index.js` yourself and paste:

```js
export { init, load } from "https://cdn.jsdelivr.net/npm/autochampselect@3.1.2/dist/index.js";
```

## Update

When a new version is released, update the pinned version in `index.js`.

## Development

The npm package is built from `src/` and published from `dist/index.js`.

```bash
npm install
npm run build
```
