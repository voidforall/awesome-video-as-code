# Decision-tree diagrams

The hand-drawn decision trees in the README are generated, not drawn by hand. Each tree is a small bilingual JSON spec in [`specs/`](specs/). [`render.mjs`](render.mjs) lays the spec out and draws it with the official Excalidraw library in headless Chromium. It writes four SVGs per spec to [`../assets/diagrams/`](../assets/diagrams/): English and Chinese, each in a light and a dark version.

The fonts (Excalifont and Xiaolai) are subset and embedded in each SVG, so the images look the same everywhere and need no network access to render.

## Render

```sh
cd diagrams
npm install
npm run render               # every spec
npm run render -- frameworks # one spec
```

The script needs Chromium for Playwright. If Playwright is already installed somewhere else, point the script at it with `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs` instead of installing a second copy.

Rendering is deterministic: the same spec always produces byte-identical SVGs, so a diff shows only real changes.

## Spec format

```json
{
  "title": { "en": "Choosing a framework", "zh": "如何选择框架" },
  "root": {
    "q": { "en": "Question?", "zh": "问题？" },
    "children": [
      { "edge": { "en": "answer", "zh": "回答" }, "node": { "tools": ["Tool A"], "note": { "en": "caveat", "zh": "提示" } } },
      { "edge": "React", "node": { "tools": ["Tool B"], "kind": "hybrid" } }
    ]
  }
}
```

- A node is either a **question** (`q` plus `children`) or a **leaf** (`tools`, plus optional `note` and `kind`).
- `kind` is `code` (the default), `hybrid`, or `pipeline`. It sets the fill colour, matching the README's labels. A legend for the kinds used is added automatically.
- Any text can be a plain string, used for both languages, or an `{ "en", "zh" }` object. Use `\n` to break a line.

## Editing by hand

Each render also writes an editable scene to `scenes/<id>.<lang>.excalidraw`, which opens in [excalidraw.com](https://excalidraw.com). The JSON spec is the source of truth, and the next render overwrites the scene. Copy a change you like back into the spec.
